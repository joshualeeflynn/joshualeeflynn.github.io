(function (root) {
  'use strict';
  function createModel(data, topics) {
    const topicIds = new Set(topics.nodes.map(node => node.id));
    const byId = new Map(), byTopic = new Map(topics.nodes.map(node => [node.id, []]));
    const setIds = new Set();
    for (const set of data.sets) {
      if (setIds.has(set.id)) throw new Error(`Duplicate problem set: ${set.id}`);
      setIds.add(set.id);
      for (const problem of set.problems) {
        if (byId.has(problem.id)) throw new Error(`Duplicate problem: ${problem.id}`);
        const topicGroups = problem.topicGroups || [{ topicIds: problem.topicIds }];
        const usefulTopicIds = [...new Set(topicGroups.flatMap(group => group.topicIds))];
        const relatedIds = [...new Set([...usefulTopicIds, ...(problem.relatedTopicIds || [])])];
        const entry = { ...problem, setId: set.id, setNumber: set.number, problemLabel: set.problemLabel || 'Practice problem', topicGroups, usefulTopicIds };
        byId.set(problem.id, entry);
        for (const id of relatedIds) {
          if (!topicIds.has(id)) throw new Error(`Unknown topic ${id} in ${problem.id}`);
          byTopic.get(id).push(entry);
        }
      }
    }
    function fromHash(hash) {
      try {
        const id = decodeURIComponent(hash.replace(/^#/, ''));
        return byId.has(id) ? id : null;
      } catch { return null; }
    }
    function confidenceFor(id, ratings = {}) {
      const ids = byId.get(id).usefulTopicIds;
      const confident = ids.filter(topic => ratings && Object.prototype.hasOwnProperty.call(ratings, topic) && ratings[topic] === 'confident').length;
      return { confident, total: ids.length };
    }
    return { byId, fromHash, confidenceFor, relatedTo: id => [...(byTopic.get(id) || [])] };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createModel };
  else root.Exam3PsetsModel = { createModel };
})(typeof window !== 'undefined' ? window : globalThis);
