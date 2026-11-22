/** Global shortcuts. Ignored while typing in an input. */
export function installKeyboard(actions) {
  window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key.toLowerCase()) {
      case ' ':
        if (tag === 'BUTTON' || tag === 'SELECT') return;
        e.preventDefault();
        actions.togglePlay();
        break;
      case 's': actions.toggleSpatial(); break;
      case 'm': actions.toggleInput(); break;
      case 'd': actions.toggleDebug(); break;
      default: break;
    }
  });
}
