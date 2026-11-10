(function (root) {
  'use strict';
  function createModel(data) {
    const byId = new Map(data.nodes.map(node => [node.id, node]));
    const groupById = new Map(data.groups.map(group => [group.id, group]));
    const edges = data.nodes.flatMap(node => node.dependencies.map(dep => ({
      from: dep.id, to: node.id, kind: dep.kind, why: dep.why, key: `${dep.id}--${node.id}`
    })));
    const plain = value => value.replace(/<[^>]*>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const normalize = value => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    function search(query) {
      const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
      return data.nodes.filter(node => {
        const text = normalize([node.title, groupById.get(node.group).label, plain(node.statement)].join(' '));
        return terms.every(term => text.includes(term));
      });
    }
    function neighborhood(id) {
      return { incoming: edges.filter(edge => edge.to === id), outgoing: edges.filter(edge => edge.from === id) };
    }
    function fromHash(hash) {
      try {
        const id = decodeURIComponent(hash.replace(/^#/, ''));
        return byId.has(id) ? id : data.defaultNode;
      } catch { return data.defaultNode; }
    }
    return { byId, groupById, edges, search, neighborhood, fromHash, plain };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createModel };
  else root.Exam2Core = { createModel };
})(typeof window !== 'undefined' ? window : globalThis);
