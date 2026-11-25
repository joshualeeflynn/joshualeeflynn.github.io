(function () {
  'use strict';
  const data = window.Exam3Data;
  const isPractice = document.body.dataset.collection === 'practice';
  const collection = isPractice ? window.Exam3Practice : window.Exam3Psets;
  const model = window.Exam3PsetsModel.createModel(collection, data);
  const topics = new Map(data.nodes.map(node => [node.id, node]));
  const store = window.Exam3Confidence.createStore(data, { psets: window.Exam3Psets, practice: window.Exam3Practice });
  const $ = id => document.getElementById(id);
  const sets = new Map(), practiceUnits = new Map(), problems = new Map(), badges = [], groupRatings = [];
  const labels = { confident: 'Confident', unsure: 'Unsure' };
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  function mathDisclosure(title, className, html) {
    const details = make('details', className);
    const copy = make('div', 'math-copy solution-copy');
    details.append(make('summary', '', title), copy);
    let loaded = false;
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      if (copy.hidden) {
        details.open = false;
        return;
      }
      if (loaded) return;
      loaded = true;
      window.CourseMath.set(copy, html);
    });
    return details;
  }
  function addSolutionLock(solution, problem) {
    const summary = solution.querySelector('summary');
    const copy = solution.querySelector('.solution-copy');
    const icon = make('span', 'solution-lock-icon');
    icon.setAttribute('aria-hidden', 'true');
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('focusable', 'false');
    const body = document.createElementNS(svgNS, 'path');
    body.setAttribute('d', 'M4 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2Z M9 15v2');
    const shackle = document.createElementNS(svgNS, 'path');
    svg.append(body, shackle);
    icon.append(svg);
    summary.append(icon);
    summary.addEventListener('click', event => {
      if (copy.hidden) event.preventDefault();
    });

    const note = make('div', 'solution-lock-note');
    const instruction = make('p', '', 'Mark each topic Confident (thumbs up) to unlock this solution.');
    instruction.id = `${problem.id}-solution-requirements`;
    const list = make('ul');
    const controls = new Map();
    for (const id of problem.usefulTopicIds) {
      const item = make('li');
      const title = topics.get(id).title;
      const link = make('a', '', title);
      link.href = `index.html#${id}`;
      const rating = window.Exam3ConfidenceControls.create({
        id: `solution-rating-${problem.id}-${id}`, topicId: id,
        label: `My confidence in ${title}`,
        value: store.get(id), compact: true,
        onChange(status) {
          const wasLocked = copy.hidden;
          store.set(id, status);
          let message = `${title} marked ${labels[status]}.`;
          if (wasLocked !== copy.hidden) message += copy.hidden ? ' Solution locked.' : ' Solution unlocked.';
          $('psets-announcement').textContent = message;
        }
      });
      controls.set(id, rating);
      item.append(link, rating.element);
      list.append(item);
    }
    note.append(instruction, list);

    function update(ratings) {
      let locked = false;
      for (const [id, rating] of controls) {
        rating.set(ratings[id]);
        if (ratings[id] !== 'confident') locked = true;
      }
      copy.hidden = locked;
      instruction.hidden = !locked;
      shackle.setAttribute('d', locked ? 'M5 11V7a4 4 0 0 1 8 0v4' : 'M13 11V7a4.5 4.5 0 0 1 9 0v1');
      summary.setAttribute('aria-disabled', String(locked));
      if (locked) {
        solution.open = false;
        summary.setAttribute('aria-describedby', instruction.id);
      } else {
        summary.removeAttribute('aria-describedby');
      }
    }
    return { note, update };
  }
  function buildProblem(problem, unit) {
    const { setId, setNumber } = problem;
    const label = isPractice ? `${problem.problemLabel} ${problem.number}` : `Pset ${setNumber}, Problem ${problem.number}`;
    const row = make('div', 'pset-problem-row');
    const section = make('details', 'pset-problem');
    section.id = problem.id;
    section.setAttribute('name', `problems-${setId}`);
    const summary = make('summary');
    summary.id = `${problem.id}-summary`;
    const numberText = isPractice ? `Problem ${problem.number} · ` : `Problem ${problem.number}`;
    summary.append(make('span', 'problem-number', numberText));
    if (isPractice) summary.append(make('span', 'problem-tags', problem.tags.join(' · ')));
    else summary.append(make('span', 'problem-title', problem.title));
    if (problem.scopeNote) summary.append(make('span', 'problem-scope-badge', 'Additional background'));
    const rating = window.Exam3ConfidenceControls.create({
      id: `problem-rating-${problem.id}`, topicId: problem.id,
      label: `My confidence in ${label}`,
      value: store.get(problem.id), compact: true,
      onChange(status) {
        store.set(problem.id, status);
        $('psets-announcement').textContent = `${label}: ${labels[status]}.`;
      }
    });
    const body = make('div', 'problem-body');
    if (problem.scopeNote) body.append(make('p', 'problem-scope-note', problem.scopeNote));
    const statement = make('div', 'math-copy problem-statement');
    body.append(statement);
    if (problem.hint) body.append(mathDisclosure('Hint', 'problem-hint', problem.hint));
    let topicCount;
    if (!isPractice) {
      const topicFold = make('details', 'useful-topics');
      const topicSummary = make('summary');
      topicCount = make('span', 'useful-topics-count');
      topicSummary.append(document.createTextNode('Useful topics'), topicCount);
      topicFold.append(topicSummary);
      for (const group of problem.topicGroups) {
        if (!group.topicIds.length) continue;
        if (group.label) topicFold.append(make('h3', '', group.label));
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
        topicFold.append(list);
      }
      if (problem.extraTopics?.length) {
        topicFold.append(make('h3', '', 'Additional topics outside this map'));
        const list = make('ul', 'extra-topics-list');
        list.append(...problem.extraTopics.map(topic => make('li', '', topic)));
        topicFold.append(list);
      }
      body.append(topicFold);
    }
    let solutionLock;
    if (problem.solution) {
      const solution = mathDisclosure('Solution', 'problem-solution', problem.solution);
      body.append(solution);
      if (isPractice) {
        solutionLock = addSolutionLock(solution, problem);
        body.append(solutionLock.note);
      }
    }
    section.append(summary, body);
    let loaded = false;
    function loadStatement() {
      if (loaded) return;
      loaded = true;
      window.CourseMath.set(statement, problem.statement);
    }
    section.addEventListener('toggle', () => {
      if (!section.open) return;
      for (const other of problems.values()) {
        if (other.setId === setId && other.section !== section) other.section.open = false;
      }
      loadStatement();
    });
    // Sibling controls remain available when closed; keyboard focus reaches them before the expanded body.
    row.append(rating.element, section);
    problems.set(problem.id, { section, summary, topicCount, setId, unit, loadStatement, rating, solutionLock });
    return row;
  }
  function groupRating(groupId, title, members, count) {
    const memberIds = members.map(problem => problem.id);
    const rating = window.Exam3ConfidenceControls.create({
      id: `pset-rating-${groupId}`, topicId: groupId,
      label: `Mark all problems in ${title}`,
      value: 'unsure', compact: true, allowMixed: !isPractice,
      onChange(status) {
        store.setMany(memberIds, status);
        $('psets-announcement').textContent = `${title}: ${memberIds.length} ${memberIds.length === 1 ? 'problem' : 'problems'} marked ${labels[status]}.`;
      }
    });
    groupRatings.push({ memberIds, count, rating });
    return rating.element;
  }
  function appendPracticeUnits(set) {
    const subjects = new Map();
    for (const { id } of set.problems) {
      const problem = model.byId.get(id);
      if (!subjects.has(problem.section)) subjects.set(problem.section, []);
      subjects.get(problem.section).push(problem);
    }
    let unitNumber = 0;
    for (const [title, members] of subjects) {
      const unit = make('details', 'practice-unit');
      unit.setAttribute('name', `units-${set.id}`);
      unit.append(make('summary', '', title));
      practiceUnits.set(`${set.id}/${title}`, unit);
      for (const problem of members) unit.append(buildProblem(problem, unit));
      const row = make('div', 'practice-unit-row');
      const rating = groupRating(`${set.id}-unit-${++unitNumber}`, title, members);
      row.append(rating, unit);
      $('pset-list').append(row);
    }
  }
  function appendAssignedSet(set) {
    const row = make('div', 'pset-group-row');
    const section = make('details', 'pset-group');
    section.id = set.id;
    section.setAttribute('name', 'problem-sets');
    const summary = make('summary');
    const count = make('span', 'pset-count');
    summary.append(make('span', 'pset-title', set.title), count);
    const rating = groupRating(set.id, set.title, set.problems, count);
    section.append(summary);
    sets.set(set.id, section);
    for (const { id } of set.problems) {
      section.append(buildProblem(model.byId.get(id)));
    }
    section.addEventListener('toggle', () => {
      if (section.open) for (const other of sets.values()) if (other !== section) other.open = false;
    });
    row.append(rating, section);
    $('pset-list').append(row);
  }
  for (const set of collection.sets) {
    if (isPractice) appendPracticeUnits(set);
    else appendAssignedSet(set);
  }
  function updateConfidence() {
    const ratings = store.snapshot();
    for (const [id, { topicCount, rating, solutionLock }] of problems) {
      rating.set(store.get(id));
      solutionLock?.update(ratings);
      if (topicCount) {
        const { confident, total } = model.confidenceFor(id, ratings);
        topicCount.textContent = total ? `${confident}/${total} linked topics confident` : 'Topics outside the map';
      }
    }
    for (const { memberIds, count, rating } of groupRatings) {
      const confident = memberIds.filter(id => ratings[id] === 'confident').length;
      if (count) count.textContent = `${confident}/${memberIds.length} confident`;
      const incompleteRating = isPractice || confident === 0 ? 'unsure' : null;
      rating.set(confident === memberIds.length ? 'confident' : incompleteRating);
    }
    for (const { id, badge } of badges) {
      const status = store.get(id);
      badge.dataset.confidence = status;
      badge.textContent = status === 'confident' ? 'Confident' : 'Unsure';
    }
    const note = $('psets-storage-note');
    note.dataset.temporary = String(!store.persistent());
    note.textContent = store.persistent() ? '' : 'Browser storage is unavailable. Confidence selections may not be shared between pages.';
    note.hidden = !note.textContent;
  }
  function revealProblem() {
    const id = model.fromHash(location.hash);
    if (!id) return;
    const target = problems.get(id);
    for (const [setId, section] of sets) section.open = setId === target.setId;
    for (const unit of practiceUnits.values()) unit.open = unit === target.unit;
    for (const [problemId, entry] of problems) entry.section.open = problemId === id;
    target.loadStatement();
    target.summary.focus({ preventScroll: true });
    requestAnimationFrame(() => target.summary.scrollIntoView({ block: 'start' }));
  }
  function rememberPracticeFolds() {
    const memory = window.Exam3ViewMemory.create('practice', 'open');
    const folds = new Map(practiceUnits);
    for (const [id, { section }] of problems) {
      folds.set(id, section);
      for (const supplement of section.querySelectorAll('details')) {
        folds.set(`${id}/${supplement.className}`, supplement);
      }
    }
    function save() {
      const open = [];
      for (const [key, fold] of folds) if (fold.open) open.push(key);
      memory.save(open);
    }
    function restore() {
      const { saved: open, resume } = memory.read();
      if (Array.isArray(open) || resume || !location.hash) {
        const saved = new Set(Array.isArray(open) ? open : []);
        for (const [key, fold] of folds) {
          const locked = fold.className === 'problem-solution' && fold.querySelector('.solution-copy').hidden;
          fold.open = saved.has(key) && !locked;
        }
        const active = [...problems.values()].find(({ section, unit }) => section.open && unit.open);
        if (active) {
          active.loadStatement();
          if (resume) requestAnimationFrame(() => active.summary.scrollIntoView({ block: 'start' }));
        }
      } else {
        revealProblem();
      }
      save();
    }
    restore();
    for (const fold of folds.values()) fold.addEventListener('toggle', save);
    window.addEventListener('pagehide', save);
    window.addEventListener('hashchange', restore);
  }
  $('reset-confidence').addEventListener('click', () => {
    store.reset();
    $('psets-announcement').textContent = 'Confidence reset. Every topic and problem is now Unsure.';
  });
  store.subscribe(updateConfidence);
  updateConfidence();
  if (isPractice) rememberPracticeFolds();
  else {
    window.addEventListener('hashchange', revealProblem);
    revealProblem();
  }
})();
