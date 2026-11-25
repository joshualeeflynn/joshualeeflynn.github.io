/* Topological overview of the existing course graph. No DOM or network dependencies. */
(function (root) {
  'use strict';
  function createOverview(data) {
    if (!data || !Array.isArray(data.nodes)) throw new Error('Overview data must contain a nodes array.');
    const byId = new Map();
    const inputOrder = new Map();
    const groupOrder = new Map((data.groups || []).map((group, index) => [group.id, index]));
    const incoming = new Map(), outgoing = new Map();
    for (const [index, node] of data.nodes.entries()) {
      if (!node || typeof node.id !== 'string' || !node.id.trim()) throw new Error(`Invalid topic ID at position ${index}.`);
      if (byId.has(node.id)) throw new Error(`Duplicate topic ID: ${node.id}.`);
      if (!Array.isArray(node.dependencies)) throw new Error(`Dependencies for ${node.id} must be an array.`);
      byId.set(node.id, node);
      inputOrder.set(node.id, index);
      incoming.set(node.id, []);
      outgoing.set(node.id, []);
    }
    for (const node of data.nodes) {
      const seen = new Set();
      for (const dependency of node.dependencies) {
        if (!dependency || typeof dependency.id !== 'string') throw new Error(`Invalid dependency reference in ${node.id}.`);
        const from = dependency.id;
        if (!byId.has(from)) throw new Error(`Unknown dependency ${from} referenced by ${node.id}.`);
        if (seen.has(from)) throw new Error(`Duplicate dependency ${from} → ${node.id}.`);
        seen.add(from);
        incoming.get(node.id).push(from);
        outgoing.get(from).push(node.id);
      }
    }
    const compare = (a, b) => {
      const ga = groupOrder.get(byId.get(a).group) ?? groupOrder.size;
      const gb = groupOrder.get(byId.get(b).group) ?? groupOrder.size;
      return ga - gb || inputOrder.get(a) - inputOrder.get(b);
    };
    const remaining = new Map(data.nodes.map(node => [node.id, incoming.get(node.id).length]));
    const rankById = new Map(data.nodes.map(node => [node.id, 0]));
    const ready = data.nodes.filter(node => !remaining.get(node.id)).map(node => node.id);
    let processed = 0;
    while (ready.length) {
      ready.sort(compare);
      const id = ready.shift();
      processed += 1;
      for (const next of outgoing.get(id)) {
        rankById.set(next, Math.max(rankById.get(next), rankById.get(id) + 1));
        remaining.set(next, remaining.get(next) - 1);
        if (remaining.get(next) === 0) ready.push(next);
      }
    }
    if (processed !== data.nodes.length) {
      const unresolved = data.nodes.filter(node => remaining.get(node.id) > 0).map(node => node.id);
      throw new Error(`Dependency cycle detected; unresolved topics: ${unresolved.join(', ')}.`);
    }
    const layers = [];
    for (const node of data.nodes) {
      const rank = rankById.get(node.id);
      if (!layers[rank]) layers[rank] = [];
      layers[rank].push(node.id);
    }
    layers.forEach(layer => layer.sort(compare));
    function reachable(id, adjacency) {
      if (!byId.has(id)) throw new Error(`Unknown topic ID: ${id}.`);
      const result = new Set();
      const pending = [...adjacency.get(id)];
      while (pending.length) {
        const next = pending.pop();
        if (result.has(next)) continue;
        result.add(next);
        pending.push(...adjacency.get(next));
      }
      return new Set([...result].sort(compare));
    }
    return {
      layers, rankById,
      ancestors: id => reachable(id, incoming),
      descendants: id => reachable(id, outgoing)
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createOverview };
  else root.Exam3Overview = { createOverview };
})(typeof window !== 'undefined' ? window : globalThis);
