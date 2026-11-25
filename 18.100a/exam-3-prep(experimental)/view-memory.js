/* Remember each history entry and the most recent view of a page in this tab. */
(function () {
  'use strict';
  function create(page, field = 'view') {
    const historyKey = 'exam3' + page[0].toUpperCase() + page.slice(1);
    const tabKey = `exam3-${page}-folds-v1`;

    function read() {
      const resume = location.hash === '#resume';
      let saved = null;
      try {
        const entry = window.history.state?.[historyKey];
        if (entry?.hash === location.hash) saved = entry[field] ?? null;
      } catch { /* Some browsers restrict access to history state. */ }
      if (resume) {
        try {
          // A newly opened tab can inherit a copy of its opener's storage.
          if (saved === null && window.history.length > 1) {
            saved = JSON.parse(window.sessionStorage.getItem(tabKey));
          }
        } catch { /* Use the page default if tab storage is unavailable. */ }
        try { window.history.replaceState(window.history.state, '', location.href.split('#')[0]); }
        catch { /* The view can still open with the return fragment. */ }
      }
      return { saved, resume };
    }

    function save(view) {
      const entry = { hash: location.hash, [field]: view };
      try {
        const state = window.history.state;
        if (JSON.stringify(state?.[historyKey]) !== JSON.stringify(entry)) {
          window.history.replaceState({ ...state, [historyKey]: entry }, '');
        }
      } catch { /* Tab storage can still remember the view. */ }
      try { window.sessionStorage.setItem(tabKey, JSON.stringify(view)); }
      catch { /* The history entry can still remember the view. */ }
    }
    return { read, save };
  }
  window.Exam3ViewMemory = { create };
})();
