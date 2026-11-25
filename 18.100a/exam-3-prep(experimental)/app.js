(function () {
  'use strict';
  const data = window.Exam3Data;
  const model = window.Exam3Core.createModel(data);
  const psets = window.Exam3PsetsModel.createModel(window.Exam3Psets, data);
  const practice = window.Exam3PsetsModel.createModel(window.Exam3Practice, data);
  const math = window.CourseMath;
  const memory = window.Exam3ViewMemory.create('topics');
  const confidence = window.Exam3Confidence.createStore(data, { psets: window.Exam3Psets, practice: window.Exam3Practice });
  const confidenceLabels = { confident: 'Confident', unsure: 'Unsure' };
  const $ = id => document.getElementById(id);
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const makeMath = (tag, className, html) => {
    const element = make(tag, className);
    element.innerHTML = html;
    return element;
  };
  const state = { selected: null, query: '', openGroup: null, activeEdge: null };
  let displayedHash = null;
  let visibleEdges = [];
  let pendingFrame = null;
  let resultRating = null, resultRatingId = null;

  function announce(message) { $('announcement').textContent = message; }
  function groupConfidenceLabel(groupId) {
    const members = data.nodes.filter(node => node.group === groupId);
    const ready = members.filter(node => confidence.get(node.id) === 'confident').length;
    return `${ready}/${members.length} confident`;
  }
  function openIndexGroup() {
    return Array.from($('topic-index').children).find(section => section.open)?.dataset.group || null;
  }
  function saveView() {
    if (displayedHash !== window.location.hash) return;
    // Read the native disclosure state even if its toggle event is still queued.
    memory.save({ selected: state.selected, query: state.query, openGroup: openIndexGroup() });
  }
  function renderIndex(searchChanged = false) {
    const matching = model.search(state.query);
    const matchingGroups = new Set(matching.map(node => node.group));
    if ((state.openGroup && !matchingGroups.has(state.openGroup)) || (searchChanged && !state.openGroup && state.query.trim())) {
      state.openGroup = matching[0]?.group || null;
    }
    const fragment = document.createDocumentFragment();
    for (const group of data.groups) {
      const members = matching.filter(node => node.group === group.id);
      if (!members.length) continue;
      const section = make('details', 'topic-group');
      section.dataset.group = group.id;
      section.setAttribute('name', 'results-units');
      section.open = state.openGroup === group.id;
      section.addEventListener('toggle', () => {
        if (section.parentElement !== $('topic-index')) return;
        if (section.open) {
          state.openGroup = group.id;
          for (const other of $('topic-index').children) if (other !== section) other.open = false;
        } else if (state.openGroup === group.id) state.openGroup = null;
        saveView();
      });
      const summary = make('summary');
      const count = make('span', 'group-confidence-count', groupConfidenceLabel(group.id));
      count.dataset.groupConfidence = group.id;
      summary.append(make('span', 'group-number', group.number), document.createTextNode(group.label + ' '), count);
      section.append(summary);
      const list = make('ul', 'topic-list');
      for (const node of members) {
        const item = make('li');
        const button = make('button', 'topic-button');
        button.type = 'button';
        button.dataset.nodeId = node.id;
        if (node.id === state.selected) button.setAttribute('aria-current', 'true');
        const icon = make('span', 'topic-symbol', model.kinds[node.kind].symbol);
        icon.setAttribute('aria-hidden', 'true');
        const label = make('span', 'topic-label', node.title);
        const badge = make('span', 'confidence-badge', confidenceLabels[confidence.get(node.id)]);
        badge.dataset.confidence = confidence.get(node.id);
        label.append(badge);
        button.append(icon, label);
        item.append(button);
        list.append(item);
      }
      section.append(list);
      fragment.append(section);
    }
    if (!matching.length) fragment.append(make('p', 'no-results', 'No matching topics. Try a shorter term, or clear the search.'));
    $('topic-index').replaceChildren(fragment);
    $('topic-count').textContent = `${data.nodes.length} topics`;
    $('search-status').textContent = state.query.trim() ? `${matching.length} matching ${matching.length === 1 ? 'topic' : 'topics'}` : '◇ Definition   ○ Theorem   △ Example';
    $('clear-search').hidden = !state.query;
  }

  function graphNode(id, selected = false) {
    const node = model.byId.get(id);
    const element = make(selected ? 'div' : 'button', `graph-node${selected ? ' node-selected' : ''}`);
    element.id = `graph-${id}`;
    if (!selected) {
      element.type = 'button';
      element.dataset.nodeId = id;
      element.setAttribute('aria-label', `Explore ${node.title}`);
    }
    element.append(make('span', 'node-type', node.kind), make('span', 'node-name', node.title));
    return element;
  }
  function renderGraph() {
    const { incoming, outgoing } = model.neighborhood(state.selected);
    visibleEdges = [...incoming, ...outgoing];
    $('incoming-nodes').replaceChildren(...incoming.map(edge => graphNode(edge.from)));
    $('selected-node').replaceChildren(graphNode(state.selected, true));
    $('outgoing-nodes').replaceChildren(...outgoing.map(edge => graphNode(edge.to)));
    if (!incoming.length) $('incoming-nodes').append(make('p', 'empty-lane', 'No earlier prerequisites mapped.'));
    if (!outgoing.length) $('outgoing-nodes').append(make('p', 'empty-lane', 'No later uses in the current map.'));
    $('edge-explanation').hidden = true;
    scheduleDraw();
  }
  function scheduleDraw() {
    if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
    pendingFrame = window.requestAnimationFrame(() => { pendingFrame = null; drawEdges(); });
  }
  function drawEdges() {
    const container = $('graph').getBoundingClientRect();
    const paths = $('edge-paths');
    paths.replaceChildren();
    if (!container.width || window.matchMedia('(max-width: 520px)').matches) return;
    $('connections-svg').setAttribute('viewBox', `0 0 ${container.width} ${container.height}`);
    for (const edge of visibleEdges) {
      const from = $(`graph-${edge.from}`).getBoundingClientRect();
      const to = $(`graph-${edge.to}`).getBoundingClientRect();
      const x1 = from.right - container.left;
      const y1 = from.top + from.height / 2 - container.top;
      const x2 = to.left - container.left - 3;
      const y2 = to.top + to.height / 2 - container.top;
      const middle = (x1 + x2) / 2;
      const d = `M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', `graph-edge ${edge.kind}${state.activeEdge === edge.key ? ' active' : ''}`);
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hit.setAttribute('d', d);
      hit.setAttribute('class', 'edge-hit');
      hit.addEventListener('click', () => activateEdge(edge.key));
      paths.append(path, hit);
    }
  }
  function activateEdge(key) {
    const edge = model.edges.find(item => item.key === key);
    if (!edge) return;
    state.activeEdge = key;
    const explanation = $('edge-explanation');
    math.update(explanation, () => explanation.replaceChildren(
      make('h3', '', `${model.byId.get(edge.from).title} → ${model.byId.get(edge.to).title}`),
      makeMath('p', '', edge.why)
    ));
    explanation.hidden = false;
    announce(`Connection explanation opened: ${model.byId.get(edge.from).title} to ${model.byId.get(edge.to).title}.`);
    scheduleDraw();
  }
  function renderContent() {
    const node = model.byId.get(state.selected);
    $('topic-title').textContent = node.title;
    $('topic-group').textContent = `${model.groupById.get(node.group).number} / ${model.groupById.get(node.group).label}`;
    const prompts = {
      definition: node.negation ? 'Know the precise definition and its negation.' : 'Know the precise definition.',
      theorem: 'Know the hypotheses and conclusion, and understand how the result is used.',
      example: 'Work through the example and identify the tools it uses.'
    };
    $('expectation').textContent = node.expectation || prompts[node.kind];
    $('statement-heading').textContent = node.kind === 'theorem' ? 'Statement' : model.kinds[node.kind].label;
    math.set($('statement'), node.statement);
    math.set($('idea'), node.idea);
    $('proof-section').hidden = !node.proof && !node.proofNote;
    $('proof-heading').textContent = node.kind === 'example' ? 'Solution' : 'Proof';
    math.set($('proof'), node.proof || node.proofNote || '');
    $('negation-block').hidden = !node.negation;
    math.set($('negation'), node.negation || '');
    $('caution-block').hidden = !node.caution;
    math.set($('caution'), node.caution || '');
    document.title = `${node.title} · Exam 3 · 18.100A`;
    const exercises = [...psets.relatedTo(node.id), ...practice.relatedTo(node.id)];
    $('practice-section').hidden = !exercises.length;
    $('practice-links').replaceChildren(...exercises.map(problem => {
      const item = make('li');
      const isAssigned = psets.byId.has(problem.id);
      const label = isAssigned ? `Pset ${problem.setNumber}, Problem ${problem.number}` : `${problem.problemLabel} ${problem.number} · ${problem.tags.join(' · ')}`;
      const link = make('a', '', label);
      link.href = `${isAssigned ? 'psets' : 'practice'}.html#${problem.id}`;
      if (isAssigned) link.title = problem.title;
      item.append(link);
      if (problem.scopeNote) item.append(make('span', 'practice-scope', 'Additional background'));
      return item;
    }));
    renderConfidence();
  }
  function renderConfidence() {
    const id = state.selected;
    if (resultRatingId !== id) {
      resultRating = window.Exam3ConfidenceControls.create({
        id: `result-rating-${id}`, topicId: id,
        label: `My confidence in ${model.byId.get(id).title}`,
        value: confidence.get(id),
        onChange(status) {
          confidence.set(id, status);
          announce(`${model.byId.get(id).title}: ${confidenceLabels[status]}.`);
        }
      });
      resultRatingId = id;
      $('result-confidence').replaceChildren(resultRating.element);
    } else resultRating.set(confidence.get(id));
    const navigation = window.Exam3StudyNavigation.createNavigation(data, confidence.snapshot(), id);
    const destinations = [
      ['first', 'First unsure', navigation.first === id ? 'You are at the first unsure topic.' : 'No unsure topics remain.'],
      ['previous', 'Previous unsure', 'No earlier unsure topic.'],
      ['next', 'Next unsure', 'No later unsure topic.']
    ];
    for (const [direction, label, boundaryMessage] of destinations) {
      const button = $(`${direction}-unsure`);
      const target = navigation[direction];
      const canMove = Boolean(target && target !== id);
      button.disabled = !canMove;
      button.dataset.nodeId = canMove ? target : '';
      button.setAttribute('aria-label', canMove ? `${label}: ${model.byId.get(target).title}` : label);
      button.title = canMove ? model.byId.get(target).title : boundaryMessage;
    }
    $('unsure-count').textContent = `${navigation.remaining} ${navigation.remaining === 1 ? 'topic' : 'topics'} unsure`;
    $('topic-checklist-link').href = `checklist.html#${state.selected}`;
    const note = $('result-storage-note');
    note.dataset.temporary = String(!confidence.persistent());
    note.textContent = confidence.persistent() ? 'Your confidence is saved in this browser.' : 'Browser storage is unavailable. Selections last only while this page is open.';
    for (const count of $('topic-index').querySelectorAll('[data-group-confidence]')) {
      count.textContent = groupConfidenceLabel(count.dataset.groupConfidence);
    }
    for (const button of $('topic-index').querySelectorAll('button[data-node-id]')) {
      const status = confidence.get(button.dataset.nodeId);
      const badge = button.querySelector('.confidence-badge');
      badge.textContent = confidenceLabels[status];
      badge.dataset.confidence = status;
    }
  }
  function renderSelection(focus) {
    state.activeEdge = null;
    $('search').value = state.query;
    renderIndex();
    renderContent();
    renderGraph();
    if (focus) {
      $('topic-title').setAttribute('tabindex', '-1');
      $('topic-title').focus({ preventScroll: true });
      $('topic-title').scrollIntoView({ block: 'nearest' });
      announce(`Selected ${model.byId.get(state.selected).title}.`);
    }
  }
  function selectNode(id, clearSearch = false) {
    if (!model.byId.has(id)) return;
    if (state.selected !== id || model.fromHash(window.location.hash) !== id) {
      saveView();
      window.location.hash = id;
    }
    displayedHash = window.location.hash;
    state.selected = id;
    state.openGroup = model.byId.get(id).group;
    if (clearSearch) state.query = '';
    renderSelection(true);
    saveView();
  }
  function restoreView(focus = false) {
    const { saved, resume } = memory.read();
    const view = model.byId.has(saved?.selected) ? saved : null;
    let linked;
    try { linked = model.byId.get(decodeURIComponent(window.location.hash.slice(1))); }
    catch { /* An invalid fragment uses the fresh Topics view. */ }
    const selected = view?.selected || linked?.id || data.defaultNode;
    if (resume && view && selected !== data.defaultNode) {
      try { window.history.replaceState(window.history.state, '', '#' + selected); }
      catch { /* The saved selection is still available for this visit. */ }
    }
    displayedHash = window.location.hash;
    const openGroup = view && (view.openGroup === null || model.groupById.has(view.openGroup))
      ? view.openGroup : linked?.group || null;
    const query = typeof view?.query === 'string' ? view.query : '';
    if (selected !== state.selected || openGroup !== openIndexGroup() || query !== state.query) {
      state.selected = selected;
      state.openGroup = openGroup;
      state.query = query;
      renderSelection(focus);
    }
    saveView();
  }
  function updateSearch() {
    state.query = $('search').value;
    renderIndex(true);
    saveView();
  }
  $('topic-index').addEventListener('click', event => {
    const button = event.target.closest('button[data-node-id]');
    if (button) selectNode(button.dataset.nodeId);
  });
  $('graph').addEventListener('click', event => {
    const button = event.target.closest('button[data-node-id]');
    if (button) selectNode(button.dataset.nodeId);
  });
  $('study-navigation').addEventListener('click', event => {
    const button = event.target.closest('button[data-node-id]');
    if (!button || button.disabled || !button.dataset.nodeId) return;
    selectNode(button.dataset.nodeId, true);
  });
  $('search').addEventListener('input', updateSearch);
  $('clear-search').addEventListener('click', () => { $('search').value = ''; updateSearch(); $('search').focus(); });
  $('reset-confidence').addEventListener('click', () => {
    confidence.reset();
    announce('Confidence reset. Every topic and problem is now Unsure.');
  });
  confidence.subscribe(renderConfidence);
  window.addEventListener('hashchange', () => restoreView(true));
  window.addEventListener('pagehide', saveView);
  window.addEventListener('resize', scheduleDraw);
  window.addEventListener('course-math-rendered', scheduleDraw);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleDraw).observe($('graph'));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleDraw);
  restoreView();
})();
