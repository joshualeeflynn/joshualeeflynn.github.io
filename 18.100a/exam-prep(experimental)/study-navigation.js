/* Review navigation uses the same unit and topic order as the Topics sidebar. */
(function (root) {
  'use strict';
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function createNavigation(data, ratings = {}, currentId = null) {
    const ordered = data.groups.flatMap(group => data.nodes.filter(node => node.group === group.id));
    const unsure = id => !(ratings && own(ratings, id) && ratings[id] === 'confident');
    const pending = ordered.filter(node => unsure(node.id));
    const current = ordered.findIndex(node => node.id === currentId);
    let previous = null, next = null;
    if (current >= 0) {
      for (let index = current - 1; index >= 0; index--) {
        if (unsure(ordered[index].id)) { previous = ordered[index].id; break; }
      }
      for (let index = current + 1; index < ordered.length; index++) {
        if (unsure(ordered[index].id)) { next = ordered[index].id; break; }
      }
    }
    return { first: pending[0]?.id || null, previous, next, remaining: pending.length };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createNavigation };
  else root.Exam2StudyNavigation = { createNavigation };
})(typeof window !== 'undefined' ? window : globalThis);
