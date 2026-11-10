(function () {
  'use strict';
  const data = window.Exam2Data;
  const math = window.CourseMath;
  const $ = id => document.getElementById(id);
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  let overview, model;
  try {
    overview = window.Exam2Overview.createOverview(data);
    model = window.Exam2Core.createModel(data);
  }
  catch (error) {
    $('overview-error').textContent = `The full map could not be arranged: ${error.message} The topics are still available from the navigation above.`;
    $('overview-error').hidden = false;
    return;
  }
  const confidence = window.Exam2Confidence.createStore(data, { psets: window.Exam2Psets });
  const confidenceLabels = { confident: 'Confident', unsure: 'Unsure' };
  let selected = null;
  let selectedRating = null, selectedRatingId = null;
  let ancestors = new Set();
  let descendants = new Set();
  let frame = null;
  const buttons = new Map();
  const edgeElements = new Map();
  const relation = id => id === selected ? 'selected' : ancestors.has(id) ? 'earlier' : descendants.has(id) ? 'later' : selected ? 'off-path' : '';
  function readHash() {
    try { const id = decodeURIComponent(location.hash.slice(1)); return model.byId.has(id) ? id : null; }
    catch { return null; }
  }
  function renderAllTopics() {
    const levels = document.createDocumentFragment();
    overview.layers.forEach((ids, rank) => {
      const section = make('section', 'overview-level');
      section.setAttribute('aria-labelledby', `level-heading-${rank}`);
      const heading = make('h2');
      heading.id = `level-heading-${rank}`;
      heading.append(make('span', '', `${String(rank).padStart(2, '0')} / ${rank ? `Level ${rank}` : 'Starting points'} · ${ids.length} topics`));
      section.append(heading);
      const list = make('ul');
      ids.forEach(id => {
        const node = model.byId.get(id);
        const group = model.groupById.get(node.group);
        const item = make('li');
        const button = make('button', `overview-topic${node.group === 'foundations' ? ' exam-one' : ''}`);
        button.type = 'button';
        button.id = `map-node-${id}`;
        button.dataset.selectId = id;
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', `${node.title}. ${node.kind}. ${group.label}. Select to trace connections.`);
        const meta = make('span', 'topic-meta');
        meta.append(make('span', '', node.kind === 'definition' ? '◇ Definition' : '○ Theorem'), make('span', '', node.group === 'foundations' ? 'Exam 1' : `Unit ${group.number}`));
        button.append(meta, make('span', 'overview-topic-title', node.title), make('span', 'confidence-badge'), make('span', 'trace-label', ' '));
        buttons.set(id, button);
        item.append(button);
        list.append(item);
      });
      section.append(list);
      levels.append(section);
    });
    $('overview-levels').append(levels);
    for (const group of data.groups) {
      const options = make('optgroup');
      options.label = group.label;
      for (const node of data.nodes.filter(node => node.group === group.id)) {
        const option = make('option', '', node.title);
        option.value = node.id;
        options.append(option);
      }
      $('find-topic').append(options);
    }
    $('overview-count').textContent = `${data.nodes.length} topics · ${model.edges.length} connections · ${overview.layers.length} dependency levels`;
  }
  function renderConfidence() {
    for (const [id, button] of buttons) {
      const status = confidence.get(id);
      const node = model.byId.get(id);
      const badge = button.querySelector('.confidence-badge');
      badge.dataset.confidence = status;
      badge.textContent = confidenceLabels[status];
      button.setAttribute('aria-label', `${node.title}. ${node.kind}. ${model.groupById.get(node.group).label}. My confidence: ${confidenceLabels[status]}. Select to trace connections.`);
    }
    $('overview-confidence').hidden = !selected;
    if (selected) {
      const id = selected;
      if (selectedRatingId !== id) {
        selectedRating = window.Exam2ConfidenceControls.create({
          id: `overview-rating-${id}`, topicId: id,
          label: `My confidence in ${model.byId.get(id).title}`,
          value: confidence.get(id),
          onChange(status) {
            confidence.set(id, status);
            $('overview-announcement').textContent = `${model.byId.get(id).title}: ${confidenceLabels[status]}.`;
          }
        });
        selectedRatingId = id;
        $('selected-confidence').replaceChildren(selectedRating.element);
      } else selectedRating.set(confidence.get(id));
    }
    const note = $('confidence-save-status');
    note.dataset.temporary = String(!confidence.persistent());
    note.textContent = confidence.persistent()
      ? 'Selections save automatically in this browser.'
      : 'Browser storage is unavailable. Selections last only while this page is open.';
    if (location.protocol === 'file:') note.textContent += ' Use the local web preview to share selections between pages.';
    scheduleDraw();
  }
  function showConnections(id) {
    const { incoming, outgoing } = model.neighborhood(id);
    const content = document.createDocumentFragment();
    for (const [title, edges, endpoint] of [['Builds on', incoming, 'from'], ['Used directly by', outgoing, 'to']]) {
      const section = make('section');
      section.append(make('h3', '', title));
      if (!edges.length) section.append(make('p', '', 'None recorded in this map.'));
      else {
        const list = make('ul');
        for (const edge of edges) {
          const item = make('li');
          const button = make('button', '', model.byId.get(edge[endpoint]).title);
          button.type = 'button';
          button.dataset.selectId = edge[endpoint];
          const explanation = make('p');
          explanation.innerHTML = `${edge.kind === 'definition' ? 'Definition / meaning' : 'Proof use'}: ${edge.why}`;
          item.append(button, explanation);
          list.append(item);
        }
        section.append(list);
      }
      content.append(section);
    }
    math.update($('selected-connections'), () => $('selected-connections').replaceChildren(content));
  }
  function select(id, updateHash = true, jump = false) {
    if (id !== null && !model.byId.has(id)) return;
    selected = id;
    ancestors = id ? overview.ancestors(id) : new Set();
    descendants = id ? overview.descendants(id) : new Set();
    for (const [nodeId, button] of buttons) {
      const status = relation(nodeId);
      button.setAttribute('aria-pressed', String(nodeId === id));
      for (const name of ['earlier', 'later', 'off-path']) button.classList.toggle(name, name === status);
      button.querySelector('.trace-label').textContent = ({selected: 'Selected topic', earlier: 'Earlier tool', later: 'Later result'})[status] || ' ';
    }
    $('find-topic').value = id || '';
    $('open-result').hidden = !id;
    $('selection-details').hidden = !id;
    $('clear-selection').disabled = !id;
    if (id) {
      const node = model.byId.get(id);
      $('selection-title').textContent = node.title;
      $('selection-summary').textContent = `${ancestors.size} earlier ${ancestors.size === 1 ? 'tool' : 'tools'} (green) · ${descendants.size} later ${descendants.size === 1 ? 'result' : 'results'} (blue). Includes indirect connections.`;
      math.set($('selected-statement'), node.statement);
      $('selected-proof-section').hidden = !node.proof && !node.proofNote;
      $('selected-proof-section').open = false;
      math.set($('selected-proof'), node.proof || node.proofNote || '');
      $('selected-expectation').textContent = node.expectation || '';
      $('open-result').href = `index.html#${id}`;
      $('results-nav').href = `index.html#${id}`;
      showConnections(id);
      $('overview-announcement').textContent = `${node.title}. ${ancestors.size} earlier tools and ${descendants.size} later results highlighted.`;
    } else {
      $('selection-title').textContent = 'Select a topic to trace its connections';
      $('selection-summary').textContent = 'All topics stay visible. Earlier tools are highlighted in green; later results in blue.';
      $('selection-details').open = false;
      $('open-result').removeAttribute('href');
      $('results-nav').href = 'index.html';
      $('overview-announcement').textContent = 'Selection cleared. All topics are shown equally.';
    }
    if (updateHash && readHash() !== id) location.hash = id || '';
    renderConfidence();
    updateEdges();
    if (jump && id) {
      $('selection-details').open = false;
      buttons.get(id).focus({ preventScroll: true });
      buttons.get(id).scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }
  function edgeRelation(edge) {
    if (!selected) return '';
    if ((ancestors.has(edge.from)) && (ancestors.has(edge.to) || edge.to === selected)) return 'earlier';
    if ((edge.from === selected || descendants.has(edge.from)) && descendants.has(edge.to)) return 'later';
    return 'off-path';
  }
  function updateEdges() {
    const showAll = $('show-all-lines').checked;
    for (const edge of model.edges) {
      const path = edgeElements.get(edge.key);
      if (!path) continue;
      const status = edgeRelation(edge);
      path.setAttribute('class', `overview-edge ${edge.kind} ${status}`);
      path.style.display = showAll || status === 'earlier' || status === 'later' ? '' : 'none';
      // Paint highlighted paths last so the traced route stays legible over other connections.
      if (status === 'earlier' || status === 'later') path.parentNode.append(path);
    }
  }
  function drawEdges() {
    const graph = $('overview-graph').getBoundingClientRect();
    if (!graph.width || !graph.height) return;
    $('overview-lines').setAttribute('viewBox', `0 0 ${graph.width} ${graph.height}`);
    $('overview-edge-paths').replaceChildren();
    edgeElements.clear();
    // Route through row gaps and side gutters, keeping every path out of the topic boxes.
    const gutter = graph.width < 500 ? 24 : 40;
    model.edges.forEach((edge, index) => {
      const start = buttons.get(edge.from).getBoundingClientRect();
      const end = buttons.get(edge.to).getBoundingClientRect();
      const x1 = start.left + start.width / 2 - graph.left;
      const y1 = start.bottom - graph.top;
      const x2 = end.left + end.width / 2 - graph.left;
      const y2 = end.top - graph.top - 3;
      const track = 5 + (index % 7) * ((gutter - 11) / 7);
      const side = (x1 + x2) / 2 < graph.width / 2 ? track : graph.width - track;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} V ${y1 + 12} H ${side} V ${y2 - 12} H ${x2} V ${y2}`);
      $('overview-edge-paths').append(path);
      edgeElements.set(edge.key, path);
    });
    updateEdges();
  }
  function scheduleDraw() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => { frame = null; drawEdges(); });
  }
  $('overview-levels').addEventListener('click', event => {
    const button = event.target.closest('button[data-select-id]');
    if (button) select(button.dataset.selectId);
  });
  $('selected-connections').addEventListener('click', event => {
    const button = event.target.closest('button[data-select-id]');
    if (button) select(button.dataset.selectId, true, true);
  });
  $('find-topic').addEventListener('change', () => select($('find-topic').value || null, true, true));
  $('clear-selection').addEventListener('click', () => select(null));
  $('show-all-lines').addEventListener('change', updateEdges);
  $('reset-confidence').addEventListener('click', () => {
    confidence.reset();
    $('overview-announcement').textContent = 'Confidence reset. Every topic and problem is now Unsure.';
  });
  confidence.subscribe(renderConfidence);
  window.addEventListener('hashchange', () => { if (readHash() !== selected) select(readHash(), false); });
  window.addEventListener('resize', scheduleDraw);
  window.addEventListener('course-math-rendered', scheduleDraw);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleDraw).observe($('overview-graph'));
  if (document.fonts?.ready) document.fonts.ready.then(scheduleDraw);
  renderAllTopics();
  select(readHash(), false);
  scheduleDraw();
})();
