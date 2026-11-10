/* Browser-local confidence selections, shared by the course tool's pages. */
(function (root) {
  'use strict';
  const STORAGE_KEY = 'exam2-confidence-v1';
  const STATUSES = new Set(['confident', 'unsure']);
  const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function createStore(data, options = {}) {
    const sets = Array.isArray(options.psets?.sets) ? options.psets.sets : [];
    const problems = sets.flatMap(set => Array.isArray(set?.problems) ? set.problems : []);
    const ids = new Set([...data.nodes, ...problems].map(item => item?.id)
      .filter(id => typeof id === 'string' && id.length > 0 && !unsafeKeys.has(id)));
    let storage = null;
    try { storage = own(options, 'storage') ? options.storage : root.localStorage; } catch { /* Blocked browser storage. */ }
    const events = own(options, 'events') ? options.events : root;
    const listeners = new Set();
    const dirty = new Map();
    let ratings = {}, saved = false;

    function sanitize(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      return Object.fromEntries([...ids]
        .filter(id => own(value, id) && (STATUSES.has(value[id]) || value[id] === 'okay'))
        .map(id => [id, value[id] === 'okay' ? 'unsure' : value[id]]));
    }
    function decode(raw) {
      if (raw === null) return {};
      try { return sanitize(JSON.parse(raw)); } catch { return null; }
    }
    function read() {
      try {
        if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return { ok: false };
        return { ok: true, value: decode(storage.getItem(STORAGE_KEY)) };
      } catch { return { ok: false }; }
    }
    function applyDirty(value) {
      const merged = { ...value };
      for (const [id, status] of dirty) merged[id] = status;
      return merged;
    }
    const initial = read();
    ratings = initial.value || {};
    saved = initial.ok;
    // Defaults are effective values, not eager writes over existing saved choices.
    function snapshot() { return Object.fromEntries([...ids].map(id => [id, get(id)])); }
    function notify() { for (const listener of listeners) listener(snapshot()); }
    function get(id) { return own(ratings, id) ? ratings[id] : 'unsure'; }
    function setMany(selectedIds, status) {
      if (!Array.isArray(selectedIds)) throw new TypeError('Confidence IDs must be an array.');
      if (!STATUSES.has(status)) throw new Error(`Invalid confidence status: ${status}.`);
      // Validate the complete batch before reading storage or changing any local choice.
      for (const id of selectedIds) {
        if (!ids.has(id)) throw new Error(`Unknown confidence item: ${id}.`);
      }
      if (selectedIds.length === 0) return snapshot();
      const latest = read();
      for (const id of selectedIds) dirty.set(id, status);
      ratings = applyDirty(latest.ok && latest.value !== null ? latest.value : ratings);
      try {
        if (!latest.ok) throw new Error('Storage unavailable.');
        storage.setItem(STORAGE_KEY, JSON.stringify(ratings));
        dirty.clear();
        saved = true;
      } catch { saved = false; }
      notify();
      return snapshot();
    }
    function set(id, status) {
      setMany([id], status);
      return get(id);
    }
    function reset() {
      // Keep every reset choice pending if saving fails, so later merges cannot restore it.
      for (const id of ids) dirty.set(id, 'unsure');
      ratings = Object.fromEntries([...ids].map(id => [id, 'unsure']));
      try {
        if (!storage || typeof storage.setItem !== 'function') throw new Error('Storage unavailable.');
        storage.setItem(STORAGE_KEY, JSON.stringify(ratings));
        dirty.clear();
        saved = true;
      } catch { saved = false; }
      notify();
      return snapshot();
    }
    if (events && typeof events.addEventListener === 'function') {
      events.addEventListener('storage', event => {
        if (event.key !== STORAGE_KEY && event.key !== null) return;
        if (event.storageArea && event.storageArea !== storage) return;
        // Read the latest value: a queued event can precede a newer local write.
        const latest = read();
        const value = latest.ok ? latest.value : decode(event.newValue);
        if (value === null) return;
        ratings = applyDirty(value);
        saved = latest.ok && dirty.size === 0;
        notify();
      });
      events.addEventListener('pageshow', event => {
        if (!event.persisted) return;
        // A page restored from the back/forward cache may have missed storage events.
        const latest = read();
        if (latest.ok && latest.value !== null) ratings = applyDirty(latest.value);
        saved = latest.ok && dirty.size === 0;
        notify();
      });
    }
    return {
      get, snapshot, set, setMany, reset,
      persistent: () => saved,
      subscribe(listener) {
        if (typeof listener !== 'function') throw new TypeError('Confidence subscriber must be a function.');
        listeners.add(listener);
        return () => listeners.delete(listener);
      }
    };
  }
  const api = { createStore, STORAGE_KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Exam2Confidence = api;
})(typeof window !== 'undefined' ? window : globalThis);
