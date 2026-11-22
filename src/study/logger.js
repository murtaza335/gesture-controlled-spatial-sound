// @ts-check
export const COLUMNS = ['timestamp_ms', 'participant', 'condition', 'task_id', 'event', 'source_id', 'param', 'value', 'az', 'el', 'dist', 'extra'];

/** RFC 4180-style escaping: quote fields containing comma, quote or newline; double inner quotes. */
export function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** gsam_<participant>_<condition>_<yyyymmdd-hhmm>.csv */
export function exportFilename(participant, condition, date = new Date()) {
  const p = (participant || 'anon').replace(/[^\w-]+/g, '_');
  const z = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${z(date.getMonth() + 1)}${z(date.getDate())}-${z(date.getHours())}${z(date.getMinutes())}`;
  return `gsam_${p}_${condition}_${stamp}.csv`;
}

/** Event log with CSV export. Does nothing until `start()` (so normal use isn't recorded). */
export function createLogger({ now = () => performance.now() } = {}) {
  /** @type {any[]} */
  let rows = [];
  let t0 = now();
  let active = false;
  const ctx = { participant: '', condition: 'gesture', task_id: '' };

  return {
    get active() { return active; },
    get count() { return rows.length; },
    get context() { return ctx; },
    setContext(patch) { Object.assign(ctx, patch); },
    start() { active = true; t0 = now(); },
    stop() { active = false; },
    clear() { rows = []; },
    /** @param {string} event @param {Partial<Record<string, any>>} fields */
    log(event, fields = {}) {
      if (!active) return;
      rows.push({
        timestamp_ms: Math.round(now() - t0),
        participant: ctx.participant,
        condition: ctx.condition,
        task_id: ctx.task_id,
        event,
        ...fields,
      });
    },
    rows() { return rows; },
    toCSV() {
      const lines = [COLUMNS.join(',')];
      for (const r of rows) lines.push(COLUMNS.map((c) => csvEscape(r[c])).join(','));
      return lines.join('\n') + '\n';
    },
    filename(date = new Date()) { return exportFilename(ctx.participant, ctx.condition, date); },
    download() {
      const blob = new Blob([this.toCSV()], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = this.filename();
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  };
}
