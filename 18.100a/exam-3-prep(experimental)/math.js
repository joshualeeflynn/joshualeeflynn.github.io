/* A single serialized queue owns MathJax replacements on the math pages. */
(function () {
  'use strict';
  const pending = new Map();
  const rendered = new Set();
  const failed = new Set();
  let ready = false, busy = false, scheduled = false, cleanupFailed = false;
  let loadError = '';
  function status(message) {
    const element = document.getElementById('math-status');
    if (element) { element.textContent = message; element.hidden = !message; }
  }
  function updateStatus() {
    status(loadError || (cleanupFailed
      ? 'Math formatting stopped. New content is shown as text. Reload the page to try again.'
      : failed.size ? 'Some mathematics could not be formatted. Reload the page to try again.' : ''));
  }
  function enqueue(element, change) {
    if (!element) return;
    pending.set(element, change);
    schedule();
  }
  function schedule() {
    if (scheduled || busy) return;
    scheduled = true;
    queueMicrotask(flush);
  }
  async function flush() {
    scheduled = false;
    if (busy || !pending.size) return;
    busy = true;
    const batch = [...pending];
    pending.clear();
    const elements = batch.map(([element]) => element).filter(element => element.isConnected);
    try {
      if (ready && !cleanupFailed && elements.length) {
        try { window.MathJax.typesetClear(elements); }
        catch {
          // Cleanup may have left stale MathItems. Keep showing current source,
          // but do not reuse that renderer state until the page is reloaded.
          cleanupFailed = true;
        }
      }
      for (const [element, change] of batch) {
        if (element.isConnected) { change(); rendered.add(element); }
      }
      if (ready && !cleanupFailed && elements.length) {
        await window.MathJax.typesetPromise(elements);
        for (const element of elements) failed.delete(element);
        window.dispatchEvent(new Event('course-math-rendered'));
      }
    } catch (error) {
      for (const element of elements) failed.add(element);
    } finally {
      for (const element of rendered) if (!element.isConnected) rendered.delete(element);
      for (const element of failed) if (!element.isConnected) failed.delete(element);
      updateStatus();
      busy = false;
      if (pending.size) schedule();
    }
  }
  window.CourseMath = {
    set(element, html) { enqueue(element, () => { element.innerHTML = html; }); },
    update: enqueue,
    typeset(element) { if (!pending.has(element)) enqueue(element, () => {}); }
  };
  window.MathJax = {
    tex: {
      inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']],
      packages: ['base', 'ams', 'newcommand', 'noundefined'], tags: 'none'
    },
    svg: { fontCache: 'local' },
    options: { enableMenu: false, skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] },
    startup: { typeset: false }
  };
  const script = document.createElement('script');
  script.id = 'course-mathjax';
  script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
  script.async = true;
  script.onload = () => {
    Promise.resolve(window.MathJax.startup.promise).then(() => {
      ready = true;
      loadError = '';
      updateStatus();
      for (const element of rendered) if (!pending.has(element)) pending.set(element, () => {});
      schedule();
    }).catch(() => {
      loadError = 'Mathematics could not be formatted. Check your connection and reload the page.';
      updateStatus();
    });
  };
  script.onerror = () => {
    loadError = 'Math rendering could not load. Check your internet connection and reload the page.';
    updateStatus();
  };
  document.head.append(script);
})();
