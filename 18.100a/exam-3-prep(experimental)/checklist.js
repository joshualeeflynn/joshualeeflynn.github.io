(function () {
  'use strict';
  const data = window.Exam3Data;
  const model = window.Exam3Core.createModel(data);
  const memory = window.Exam3ViewMemory.create('checklist');
  const store = window.Exam3Confidence.createStore(data, { psets: window.Exam3Psets, practice: window.Exam3Practice });
  const $ = id => document.getElementById(id);
  const labels = { confident: 'Confident', unsure: 'Unsure' };
  const rows = new Map(), groups = new Map();
  let firstUnsure = null;
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  function ratingControl(id) {
    return window.Exam3ConfidenceControls.create({
      id: `checklist-rating-${id}`, topicId: id,
      label: `My confidence in ${model.byId.get(id).title}`,
      value: store.get(id), compact: true,
      onChange(status) {
        store.set(id, status);
        $('checklist-announcement').textContent = `${model.byId.get(id).title}: ${labels[status]}.`;
      }
    });
  }
  function buildChecklist() {
    for (const group of data.groups) {
      const section = make('details', 'checklist-group');
      section.id = `checklist-unit-${group.id}`;
      section.setAttribute('name', 'checklist-units');
      const summary = make('summary');
      summary.id = `checklist-group-${group.id}`;
      const title = make('span', 'checklist-unit-title', `${group.number} / ${group.label}`);
      const count = make('span', 'checklist-unit-count');
      summary.append(title, count);
      const list = make('ul');
      const members = data.nodes.filter(node => node.group === group.id);
      for (const node of members) {
        const row = make('li', 'checklist-row');
        row.id = node.id;
        const title = make('a', 'checklist-topic', node.title);
        title.href = `index.html#${node.id}`;
        const rating = ratingControl(node.id);
        row.append(title, rating.element);
        list.append(row);
        rows.set(node.id, { row, rating });
      }
      section.append(summary, list);
      section.addEventListener('toggle', () => {
        if (section.open) openUnit(group.id);
        saveView();
      });
      $('checklist-groups').append(section);
      groups.set(group.id, { section, count, members });
    }
  }
  function updateChecklist() {
    for (const [id, { rating }] of rows) rating.set(store.get(id));
    for (const { count, members } of groups.values()) {
      const ready = members.filter(node => store.get(node.id) === 'confident').length;
      count.textContent = `${ready}/${members.length} confident`;
    }
  }
  function openUnit(id) {
    for (const [groupId, { section }] of groups) section.open = groupId === id;
  }
  function saveView() {
    const openGroup = [...groups].find(([, group]) => group.section.open)?.[0] ?? null;
    memory.save({ openGroup });
  }
  function revealChecklistTarget() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const node = model.byId.get(id);
    if (!node) return;
    openUnit(node.group);
    rows.get(id).row.scrollIntoView({ block: 'center' });
  }
  function restoreView() {
    const { saved, resume } = memory.read();
    if (saved && (saved.openGroup === null || groups.has(saved.openGroup))) {
      openUnit(saved.openGroup);
      if (resume && saved.openGroup) {
        groups.get(saved.openGroup).section.querySelector('summary').scrollIntoView({ block: 'start' });
      }
    } else if (location.hash && !resume) {
      revealChecklistTarget();
    } else {
      openUnit(null);
    }
    saveView();
  }
  function updateSummary() {
    const confident = data.nodes.filter(node => store.get(node.id) === 'confident').length;
    $('confidence-progress').max = data.nodes.length;
    $('confidence-progress').value = confident;
    $('confidence-progress-label').textContent = `${confident}/${data.nodes.length} confident`;
    firstUnsure = window.Exam3StudyNavigation.createNavigation(data, store.snapshot()).first;
    const startReview = $('start-review');
    startReview.disabled = !firstUnsure;
    startReview.setAttribute('aria-label', firstUnsure ? `Start review: ${model.byId.get(firstUnsure).title}` : 'Start review');
    startReview.title = firstUnsure ? `Start with ${model.byId.get(firstUnsure).title}` : 'All topics are Confident.';
    const note = $('checklist-storage-note');
    note.dataset.temporary = String(!store.persistent());
    note.textContent = store.persistent() ? 'Saved in this browser.' : 'Storage unavailable: changes last only while this page is open.';
  }
  function refresh() { updateChecklist(); updateSummary(); }
  $('start-review').addEventListener('click', () => {
    if (firstUnsure) location.href = `index.html#${firstUnsure}`;
  });
  $('reset-confidence').addEventListener('click', () => {
    store.reset();
    $('checklist-announcement').textContent = 'Confidence reset. Every topic and problem is now Unsure.';
  });
  buildChecklist();
  store.subscribe(refresh);
  refresh();
  restoreView();
  window.addEventListener('hashchange', restoreView);
  window.addEventListener('pagehide', saveView);
})();
