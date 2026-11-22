import { SUS_ITEMS, susScore } from '../study/sus.js';
import { TASKS } from '../study/taskRunner.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const fmtMs = (ms) => `${(ms / 1000).toFixed(1)} s`;

/** Study screens: panel fields, task card, localization card, summaries, SUS form, blackout. */
export function createStudyUI({ store, logger, actions }) {
  // ---------- cards (created once) ----------
  const main = $('main');
  const taskCard = el('div', 'study-card task-card', `
    <div class="sc-head"><span id="tcStep">Task 1/5</span><span id="tcTime" class="sc-time">0.0 s</span></div>
    <div class="sc-title" id="tcText"></div>
    <div class="sc-sub" id="tcHint"></div>
    <div class="sc-bar"><i id="tcBar"></i></div>
    <div class="sc-actions"><button class="btn sm-text" id="tcGiveUp">Give up (Enter)</button><button class="btn sm-text" id="tcStop">Stop (Esc)</button></div>`);
  taskCard.hidden = true;
  const locCard = el('div', 'study-card loc-card', `
    <div class="sc-head"><span id="lcStep">Trial 1/21</span><span id="lcMode" class="sc-time">HRTF</span></div>
    <div class="sc-title" id="lcText"></div>
    <div class="sc-bar"><i id="lcBar"></i></div>
    <div class="sc-actions"><button class="btn sm-text" id="lcStop">Stop (Esc)</button></div>`);
  locCard.hidden = true;
  main.append(taskCard, locCard);

  const modal = el('div', 'overlay-help', '<div class="help-card study-modal"><button class="btn icon sm close" aria-label="Close">✕</button><div class="modal-body"></div></div>');
  modal.hidden = true;
  document.body.appendChild(modal);
  const modalBody = modal.querySelector('.modal-body');
  const closeModal = () => { modal.hidden = true; };
  modal.querySelector('.close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => e.target === modal && closeModal());
  window.addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());
  const showModal = (node) => {
    modalBody.textContent = '';
    modalBody.appendChild(node);
    modal.hidden = false;
  };

  const blackout = el('div', 'blackout', '<div>Screen off<br><small>Press X to restore</small></div>');
  blackout.hidden = true;
  document.body.appendChild(blackout);

  // ---------- panel wiring ----------
  const fields = () => ({ participantId: $('studyId').value.trim(), condition: $('studyCond').value });
  $('btnRunTasks').addEventListener('click', () => actions.runTasks(fields()));
  $('btnRunLoc').addEventListener('click', () => actions.runLoc('front', fields()));
  $('btnRunFB').addEventListener('click', () => actions.runLoc('frontback', fields()));
  $('btnSus').addEventListener('click', () => showSUS());
  $('btnExport').addEventListener('click', () => actions.exportLog());
  $('btnClearLog').addEventListener('click', () => actions.clearLog());
  $('studyCond').addEventListener('change', () => {
    store.set({ study: { ...store.state.study, ...fields() } });
    actions.toast(fields().condition === 'slider' ? 'Slider condition: gestures are off' : 'Gesture condition');
  });
  $('studyId').addEventListener('input', () => store.set({ study: { ...store.state.study, ...fields() } }));
  $('tcGiveUp').addEventListener('click', () => actions.giveUp());
  $('tcStop').addEventListener('click', () => actions.cancelStudy());
  $('lcStop').addEventListener('click', () => actions.cancelStudy());

  const toggle = (id, on) => {
    const b = $(id);
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('on', on);
  };
  $('tglA11y').addEventListener('click', () => actions.toggleA11y());
  $('tglScreen').addEventListener('click', () => actions.toggleScreenOff());

  // ---------- renderers ----------
  let taskStart = 0;
  let timerOn = false;
  function renderTask(s) {
    taskCard.hidden = !s.running;
    timerOn = s.running;
    if (!s.running) return;
    taskStart = s.startAt;
    $('tcStep').textContent = `Task ${s.index + 1}/${s.total}`;
    $('tcText').textContent = s.task.text;
    $('tcHint').textContent = `Tolerance ${s.task.hint}. Hold it for 1 s to finish.`;
    $('tcBar').style.transform = `scaleX(${(s.holdProgress ?? 0).toFixed(2)})`;
    taskCard.classList.toggle('holding', (s.holdProgress ?? 0) > 0);
  }
  function tickTimer(now) {
    if (timerOn) $('tcTime').textContent = fmtMs(Math.max(0, now - taskStart));
  }

  function renderLoc(s) {
    locCard.hidden = !s.running;
    if (!s.running) return;
    $('lcStep').textContent = `Trial ${Math.min(s.index + 1, s.total)}/${s.total}`;
    $('lcMode').textContent = s.mode === 'hrtf' ? '3D · HRTF' : 'Stereo';
    $('lcText').textContent = s.waiting ? s.prompt : 'Get ready…';
    $('lcBar').style.transform = `scaleX(${(s.index / s.total).toFixed(3)})`;
    locCard.classList.toggle('waiting', s.waiting);
  }

  function showTaskSummary(results, then) {
    const wrap = el('div', '');
    const rows = results
      .map((r) => `<tr><td>${r.id}</td><td class="${r.success ? 'ok' : 'bad'}">${r.success ? '✓ done' : '✗ gave up'}</td><td>${fmtMs(r.timeMs)}</td><td>${r.grabs} grabs · ${r.adjusts} adjusts</td></tr>`)
      .join('');
    wrap.innerHTML = `<h2>Tasks finished</h2><table class="sum"><tr><th>Task</th><th>Result</th><th>Time</th><th>Interactions</th></tr>${rows}</table>
      <div class="sc-actions"><button class="btn primary" id="toSus">Continue to questionnaire</button></div>`;
    showModal(wrap);
    wrap.querySelector('#toSus').addEventListener('click', () => (then ? then() : showSUS()));
  }

  function showLocSummary(summary) {
    const wrap = el('div', '');
    const f = Object.entries(summary.front)
      .map(([m, v]) => `<tr><td>${m === 'hrtf' ? '3D · HRTF' : 'Stereo'}</td><td>${v.n}</td><td>${v.meanAbsError.toFixed(1)}°</td><td>${fmtMs(v.meanRtMs)}</td></tr>`)
      .join('');
    const fb = summary.frontBack.n
      ? `<h3>Front / back</h3><p>${(summary.frontBack.confusionRate * 100).toFixed(0)}% confused (${summary.frontBack.n} trials)</p>`
      : '';
    wrap.innerHTML = `<h2>Localization results</h2>
      ${f ? `<table class="sum"><tr><th>Mode</th><th>Trials</th><th>Mean error</th><th>Mean time</th></tr>${f}</table>` : ''}
      ${fb}
      <p class="muted">Run again in the other spatial mode (press S) to compare 3D vs stereo.</p>`;
    showModal(wrap);
  }

  function showSUS() {
    const wrap = el('div', '');
    const items = SUS_ITEMS.map(
      (t, i) => `<div class="sus-row"><div class="sus-q">${i + 1}. ${t}</div><div class="sus-scale"><span>Strongly disagree</span>${[1, 2, 3, 4, 5]
        .map((v) => `<label><input type="radio" name="sus${i}" value="${v}"><span>${v}</span></label>`)
        .join('')}<span>Strongly agree</span></div></div>`,
    ).join('');
    wrap.innerHTML = `<h2>System Usability Scale</h2><p class="muted">Please rate each statement about the system you just used.</p>${items}
      <div class="sc-actions"><button class="btn primary" id="susSubmit" disabled>Submit</button><span id="susScore" class="muted"></span></div>`;
    showModal(wrap);
    const submit = wrap.querySelector('#susSubmit');
    const answers = () => SUS_ITEMS.map((_, i) => Number(wrap.querySelector(`input[name=sus${i}]:checked`)?.value ?? 0));
    wrap.addEventListener('change', () => {
      submit.disabled = answers().some((a) => !a);
    });
    submit.addEventListener('click', () => {
      const a = answers();
      const score = susScore(a);
      logger.setContext({ task_id: 'SUS' });
      logger.log('sus', { value: score, extra: { answers: a } });
      logger.setContext({ task_id: '' });
      wrap.querySelector('#susScore').textContent = `SUS score: ${score.toFixed(1)}`;
      submit.disabled = true;
      updateLogCount();
      actions.toast(`SUS score ${score.toFixed(1)} logged`, { ms: 3000 });
      setTimeout(closeModal, 1200);
    });
  }

  function updateLogCount() {
    $('logCount').textContent = `${logger.count} event${logger.count === 1 ? '' : 's'} logged${logger.active ? ' · recording' : ''}`;
  }

  return {
    renderTask,
    renderLoc,
    tickTimer,
    showTaskSummary,
    showLocSummary,
    showSUS,
    updateLogCount,
    setA11y: (on) => toggle('tglA11y', on),
    setScreenOff(on) {
      toggle('tglScreen', on);
      blackout.hidden = !on;
      document.body.classList.toggle('screen-off', on);
    },
    fieldValues: fields,
    taskCount: TASKS.length,
  };
}
