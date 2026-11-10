(function () {
  'use strict';
  const data = window.Exam2Data, psets = window.Exam2Psets;
  const model = window.Exam2PsetsModel.createModel(psets, data);
  const topics = new Map(data.nodes.map(node => [node.id, node]));
  const store = window.Exam2Confidence.createStore(data, { psets });
  const $ = id => document.getElementById(id);
  const sets = new Map(), problems = new Map(), badges = [], setRatings = new Map();
  const labels = { confident: 'Confident', unsure: 'Unsure' };
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  function buildProblem(problem, setId) {
    const row = make('div', 'pset-problem-row');
    const section = make('details', 'pset-problem');
    section.id = problem.id;
    section.setAttribute('name', `problems-${setId}`);
    const summary = make('summary');
    summary.id = `${problem.id}-summary`;
    summary.append(make('span', 'problem-number', `Problem ${problem.number}`), make('span', 'problem-title', problem.title));
    if (problem.scopeNote) summary.append(make('span', 'problem-scope-badge', 'Not covered on Exam 2'));
    const rating = window.Exam2ConfidenceControls.create({
      id: `problem-rating-${problem.id}`, topicId: problem.id,
      label: `My confidence in Pset ${model.byId.get(problem.id).setNumber}, Problem ${problem.number}`,
      value: store.get(problem.id), compact: true,
      onChange(status) {
        store.set(problem.id, status);
        $('psets-announcement').textContent = `Pset ${model.byId.get(problem.id).setNumber}, Problem ${problem.number}: ${labels[status]}.`;
      }
    });
    const body = make('div', 'problem-body');
    if (problem.scopeNote) body.append(make('p', 'problem-scope-note', problem.scopeNote));
    const statement = make('div', 'math-copy problem-statement');
    const hints = make('details', 'useful-topics');
    const hintSummary = make('summary');
    const count = make('span', 'useful-topics-count');
    hintSummary.append(document.createTextNode('Useful topics'), count);
    hints.append(hintSummary);
    for (const group of problem.topicGroups) {
      if (!group.topicIds.length) continue;
      hints.append(make('h3', '', group.label));
      const list = make('ul', 'useful-topics-list');
      for (const id of group.topicIds) {
        const item = make('li');
        const link = make('a', '', topics.get(id).title);
        link.href = `index.html#${id}`;
        const badge = make('span', 'confidence-badge');
        badges.push({ id, badge });
        item.append(link, badge);
        list.append(item);
      }
      hints.append(list);
    }
    if (problem.extraTopics?.length) {
      hints.append(make('h3', '', 'Additional topics outside this map'));
      const list = make('ul', 'extra-topics-list');
      list.append(...problem.extraTopics.map(topic => make('li', '', topic)));
      hints.append(list);
    }
    const solution = make('details', 'problem-solution');
    solution.append(make('summary', '', 'Solution'));
    const solutionCopy = make('div', 'math-copy solution-copy');
    solution.append(solutionCopy);
    let solutionLoaded = false;
    solution.addEventListener('toggle', () => {
      if (!solution.open || solutionLoaded) return;
      solutionLoaded = true;
      window.CourseMath.set(solutionCopy, problem.solution);
    });
    body.append(statement, hints, solution);
    section.append(summary, body);
    let loaded = false;
    function loadStatement() {
      if (loaded) return;
      loaded = true;
      window.CourseMath.set(statement, problem.statement);
    }
    section.addEventListener('toggle', () => {
      if (!section.open) return;
      for (const other of sets.get(setId).querySelectorAll('.pset-problem')) if (other !== section) other.open = false;
      loadStatement();
    });
    // Sibling controls remain available when closed; keyboard focus reaches them before the expanded body.
    row.append(rating.element, section);
    problems.set(problem.id, { section, summary, count, setId, loadStatement, rating });
    return row;
  }
  for (const set of psets.sets) {
    const row = make('div', 'pset-group-row');
    const section = make('details', 'pset-group');
    section.id = set.id;
    section.setAttribute('name', 'problem-sets');
    const summary = make('summary');
    const count = make('span', 'pset-count');
    summary.append(make('span', 'pset-title', set.title), count);
    const memberIds = set.problems.map(problem => problem.id);
    const rating = window.Exam2ConfidenceControls.create({
      id: `pset-rating-${set.id}`, topicId: set.id,
      label: `Mark all problems in ${set.title}`,
      value: 'unsure', compact: true, allowMixed: true,
      onChange(status) {
        store.setMany(memberIds, status);
        $('psets-announcement').textContent = `${set.title}: all ${memberIds.length} problems marked ${labels[status]}.`;
      }
    });
    section.append(summary);
    sets.set(set.id, section);
    setRatings.set(set.id, { memberIds, count, rating });
    section.append(...set.problems.map(problem => buildProblem(problem, set.id)));
    section.addEventListener('toggle', () => {
      if (section.open) for (const other of sets.values()) if (other !== section) other.open = false;
    });
    row.append(rating.element, section);
    $('pset-list').append(row);
  }
  function updateConfidence() {
    const ratings = store.snapshot();
    for (const [id, { count, rating }] of problems) {
      rating.set(store.get(id));
      const { confident, total } = model.confidenceFor(id, ratings);
      count.textContent = total ? `${confident}/${total} linked topics confident` : 'Topics outside the map';
    }
    for (const { memberIds, count, rating } of setRatings.values()) {
      const confident = memberIds.filter(id => store.get(id) === 'confident').length;
      count.textContent = `${confident}/${memberIds.length} confident`;
      rating.set(confident === memberIds.length ? 'confident' : confident === 0 ? 'unsure' : null);
    }
    for (const { id, badge } of badges) {
      const status = store.get(id);
      badge.dataset.confidence = status;
      badge.textContent = status === 'confident' ? 'Confident' : 'Unsure';
    }
    const note = $('psets-storage-note');
    note.dataset.temporary = String(!store.persistent());
    note.textContent = store.persistent() ? '' : 'Browser storage is unavailable. Confidence selections may not be shared between pages.';
    if (location.protocol === 'file:') note.textContent += ' Use the local web preview to share confidence selections between pages.';
    note.hidden = !note.textContent;
  }
  function revealProblem() {
    const id = model.fromHash(location.hash);
    if (!id) return;
    const target = problems.get(id);
    for (const [setId, section] of sets) section.open = setId === target.setId;
    for (const [problemId, entry] of problems) entry.section.open = problemId === id;
    target.loadStatement();
    target.summary.focus({ preventScroll: true });
    requestAnimationFrame(() => target.summary.scrollIntoView({ block: 'start' }));
  }
  $('reset-confidence').addEventListener('click', () => {
    store.reset();
    $('psets-announcement').textContent = 'Confidence reset. Every topic and problem is now Unsure.';
  });
  store.subscribe(updateConfidence);
  window.addEventListener('hashchange', revealProblem);
  updateConfidence();
  revealProblem();
})();
