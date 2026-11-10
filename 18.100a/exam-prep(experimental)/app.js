(function () {
  'use strict';
  const data = window.Exam2Data;
  const model = window.Exam2Core.createModel(data);
  const practice = window.Exam2PsetsModel.createModel(window.Exam2Psets, data);
  const math = window.CourseMath;
  const confidence = window.Exam2Confidence.createStore(data, { psets: window.Exam2Psets });
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
  const state = {
    selected: model.fromHash(window.location.hash), query: '',
    activeEdge: null
  };
  state.openGroup = model.byId.get(state.selected).group;
  let visibleEdges = [];
  let pendingFrame = null;
  let resultRating = null, resultRatingId = null;

  function announce(message) { $('announcement').textContent = message; }
  function groupConfidenceLabel(groupId) {
    const members = data.nodes.filter(node => node.group === groupId);
    const ready = members.filter(node => confidence.get(node.id) === 'confident').length;
    return `${ready}/${members.length} confident`;
  }
  function renderIndex() {
    const matching = model.search(state.query);
    const matchingGroups = new Set(matching.map(node => node.group));
    if ((state.openGroup && !matchingGroups.has(state.openGroup)) || (!state.openGroup && state.query.trim())) {
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
        if (!section.isConnected) return;
        if (section.open) {
          state.openGroup = group.id;
          for (const other of $('topic-index').children) if (other !== section) other.open = false;
        } else if (state.openGroup === group.id) state.openGroup = null;
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
        const icon = make('span', 'topic-symbol', node.kind === 'definition' ? '◇' : '○');
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
    $('search-status').textContent = state.query.trim() ? `${matching.length} matching ${matching.length === 1 ? 'topic' : 'topics'}` : '◇ Definition   ○ Theorem';
    $('clear-search').hidden = !state.query;
  }

  function graphNode(id, selected = false) {
    const node = model.byId.get(id);
    const element = make(selected ? 'div' : 'button', `graph-node${selected ? ' node-selected' : ''}${node.group === 'foundations' ? ' node-prerequisite' : ''}`);
    element.id = `graph-${id}`;
    if (!selected) {
      element.type = 'button';
      element.dataset.nodeId = id;
      element.setAttribute('aria-label', `Explore ${node.title}`);
    }
    element.append(make('span', 'node-type', `${node.kind}${node.group === 'foundations' ? ' · Exam 1' : ''}`), make('span', 'node-name', node.title));
    return element;
  }
  function renderGraph() {
    const { incoming, outgoing } = model.neighborhood(state.selected);
    visibleEdges = [...incoming, ...outgoing];
    $('incoming-nodes').replaceChildren(...incoming.map(edge => graphNode(edge.from)));
    $('selected-node').replaceChildren(graphNode(state.selected, true));
    $('outgoing-nodes').replaceChildren(...outgoing.map(edge => graphNode(edge.to)));
    if (!incoming.length) $('incoming-nodes').append(make('p', 'empty-lane', 'No earlier prerequisites mapped.'));
    if (!outgoing.length) $('outgoing-nodes').append(make('p', 'empty-lane', 'No later results mapped within this exam scope.'));
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
    $('expectation').textContent = node.expectation || (node.group === 'foundations' ? 'Exam 1 prerequisite · recall it when a later argument needs it.' : node.kind === 'definition' ? 'Know the precise definition and its negation.' : 'Know the hypotheses and conclusion, and understand how the result is used.');
    $('statement-heading').textContent = node.kind === 'definition' ? 'Definition' : 'Statement';
    math.set($('statement'), node.statement);
    math.set($('idea'), node.idea);
    $('proof-section').hidden = !node.proof && !node.proofNote;
    $('proof-heading').textContent = node.proof ? 'Proof' : 'Exam scope';
    math.set($('proof'), node.proof || node.proofNote || '');
    $('negation-block').hidden = !node.negation;
    math.set($('negation'), node.negation || '');
    $('caution-block').hidden = !node.caution;
    math.set($('caution'), node.caution || '');
    document.title = `${node.title} · Exam 2 · 18.100A`;
    const exercises = practice.relatedTo(node.id);
    $('practice-section').hidden = !exercises.length;
    $('practice-links').replaceChildren(...exercises.map(problem => {
      const item = make('li');
      const link = make('a', '', `Pset ${problem.setNumber}, Problem ${problem.number}`);
      link.href = `psets.html#${problem.id}`;
      link.title = problem.title;
      item.append(link);
      if (problem.scopeNote) item.append(make('span', 'practice-scope', 'Not covered on Exam 2'));
      return item;
    }));
    renderConfidence();
  }
  function renderConfidence() {
    const id = state.selected;
    if (resultRatingId !== id) {
      resultRating = window.Exam2ConfidenceControls.create({
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
    const navigation = window.Exam2StudyNavigation.createNavigation(data, confidence.snapshot(), id);
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
    if (location.protocol === 'file:') note.textContent += ' Use the local web preview to share selections between pages.';
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
  function selectNode(id, changeHash = true, focus = false) {
    if (!model.byId.has(id)) return;
    state.selected = id;
    state.openGroup = model.byId.get(id).group;
    state.activeEdge = null;
    renderIndex();
    renderContent();
    renderGraph();
    if (changeHash && model.fromHash(window.location.hash) !== id) window.location.hash = id;
    if (focus) {
      $('topic-title').setAttribute('tabindex', '-1');
      $('topic-title').focus({ preventScroll: true });
      $('topic-title').scrollIntoView({ block: 'nearest' });
    }
    announce(`Selected ${model.byId.get(id).title}.`);
  }
  $('topic-index').addEventListener('click', event => {
    const button = event.target.closest('button[data-node-id]');
    if (button) selectNode(button.dataset.nodeId, true, true);
  });
  $('graph').addEventListener('click', event => {
    const button = event.target.closest('button[data-node-id]');
    if (button) selectNode(button.dataset.nodeId, true, true);
  });
  $('study-navigation').addEventListener('click', event => {
    const button = event.target.closest('button[data-node-id]');
    if (!button || button.disabled || !button.dataset.nodeId) return;
    state.query = '';
    $('search').value = '';
    selectNode(button.dataset.nodeId, true, true);
  });
  $('search').addEventListener('input', () => { state.query = $('search').value; renderIndex(); });
  $('clear-search').addEventListener('click', () => { $('search').value = ''; state.query = ''; renderIndex(); $('search').focus(); });
  $('reset-confidence').addEventListener('click', () => {
    confidence.reset();
    announce('Confidence reset. Every topic and problem is now Unsure.');
  });
  confidence.subscribe(renderConfidence);
  window.addEventListener('hashchange', () => {
    const id = model.fromHash(window.location.hash);
    if (id !== state.selected) selectNode(id, false, true);
  });
  window.addEventListener('resize', scheduleDraw);
  window.addEventListener('course-math-rendered', scheduleDraw);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleDraw).observe($('graph'));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleDraw);
  renderIndex();
  renderContent();
  renderGraph();
})();
