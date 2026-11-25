/* Shared, keyboard-accessible two-way confidence control. */
(function (root) {
  'use strict';
  const choices = [
    { status: 'unsure', label: 'Unsure', rotation: 180 },
    { status: 'confident', label: 'Confident', rotation: 0 }
  ];
  const allowed = new Set(choices.map(choice => choice.status));
  const svgNamespace = 'http://www.w3.org/2000/svg';
  function create({ id, topicId, label, value = 'unsure', onChange, compact = false, allowMixed = false }) {
    const document = root.document;
    const element = document.createElement('div');
    element.className = `confidence-control thumbs-control${compact ? ' compact-thumbs' : ''}`;
    element.setAttribute('role', 'group');
    element.setAttribute('aria-label', label);
    const buttons = new Map();
    function set(status) {
      // A group with mixed member ratings has neither bulk action selected.
      if (!allowed.has(status) && !(allowMixed && status === null)) throw new RangeError(`Invalid confidence status: ${status}.`);
      for (const [choice, button] of buttons) button.setAttribute('aria-pressed', String(choice === status));
    }
    for (const choice of choices) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = `${id}-${choice.status}`;
      button.className = 'confidence-thumb';
      button.dataset.ratingId = topicId;
      button.dataset.confidence = choice.status;
      button.setAttribute('aria-label', `${label}: ${choice.label}`);
      button.title = `${label}: ${choice.label}`;
      const icon = document.createElementNS(svgNamespace, 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      icon.setAttribute('focusable', 'false');
      const path = document.createElementNS(svgNamespace, 'path');
      path.setAttribute('d', 'M7 10H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3V10Zm0 0 4-7a2 2 0 0 1 3 2l-1 5h6a2 2 0 0 1 2 2l-2 7a3 3 0 0 1-3 2H7');
      path.setAttribute('transform', `rotate(${choice.rotation} 12 12)`);
      icon.append(path);
      const text = document.createElement('span');
      text.className = 'thumb-label';
      text.textContent = choice.label;
      button.append(icon, text);
      button.addEventListener('click', () => {
        set(choice.status);
        if (typeof onChange === 'function') onChange(choice.status);
      });
      buttons.set(choice.status, button);
      element.append(button);
    }
    set(value);
    return { element, set };
  }
  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Exam3ConfidenceControls = api;
})(typeof window !== 'undefined' ? window : globalThis);
