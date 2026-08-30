(() => {
  const tree = [
    { id: "home", label: "home", href: "/" },
    {
      id: "teaching",
      label: "teaching/",
      href: "/#teaching",
      open: true,
      children: [
        { id: "18-100a", label: "18.100A", href: "/#18-100a" },
        { id: "previous-courses", label: "previous courses", href: "/previous-courses/" }
      ]
    },
    {
      id: "research",
      label: "research/",
      href: "/#research",
      open: false,
      expandable: true,
      children: []
    },
    { id: "papers", label: "papers", href: "/papers/" },
    { id: "about", label: "about", href: "/about/" },
    { id: "cv", label: "cv.pdf", href: "/cv.pdf" }
  ];

  const nav = document.getElementById("site-tree");
  if (!nav) return;

  const activeId = nav.dataset.active || "";

  function containsActive(node) {
    if (node.id === activeId) return true;
    return (node.children || []).some(containsActive);
  }

  function makeLink(node) {
    const a = document.createElement("a");
    a.href = node.href;
    a.textContent = node.label;

    if (node.id === activeId) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
    return a;
  }

  function makeBranchText(text) {
    const span = document.createElement("span");
    span.className = "branch";
    span.textContent = text;
    return span;
  }

  function makeToggle(children, startsOpen) {
    const button = document.createElement("button");
    button.className = "toggle";
    button.type = "button";
    button.setAttribute("aria-expanded", String(startsOpen));
    button.textContent = startsOpen ? "[-]" : "[+]";

    button.addEventListener("click", () => {
      const isOpen = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!isOpen));
      button.textContent = isOpen ? "[+]" : "[-]";
      children.hidden = isOpen;
    });

    return button;
  }

  tree.forEach((node, index) => {
    if (index === 0) {
      const root = document.createElement("div");
      root.className = "node root-node";
      root.appendChild(makeLink(node));
      nav.appendChild(root);
      return;
    }

    const isLast = index === tree.length - 1;
    const hasChildren = (node.children || []).length > 0;
    const isExpandable = hasChildren || node.expandable === true;

    const row = document.createElement("div");
    row.className = "node";
    row.appendChild(makeBranchText(isLast ? "└──" : "├──"));

    let childContainer = null;

    if (isExpandable) {
      childContainer = document.createElement("div");
      childContainer.className = "children";

      const startsOpen = containsActive(node) || node.open === true;
      childContainer.hidden = !startsOpen;

      row.appendChild(makeToggle(childContainer, startsOpen));
    } else {
      const spacer = document.createElement("span");
      spacer.textContent = "    ";
      row.appendChild(spacer);
    }

    row.appendChild(makeLink(node));
    nav.appendChild(row);

    if (childContainer) {
      (node.children || []).forEach((child, childIndex, children) => {
        const childRow = document.createElement("div");
        childRow.className = "node child";
        childRow.appendChild(
          makeBranchText(childIndex === children.length - 1 ? "└──" : "├──")
        );
        childRow.appendChild(makeLink(child));
        childContainer.appendChild(childRow);
      });

      nav.appendChild(childContainer);
    }
  });
})();
