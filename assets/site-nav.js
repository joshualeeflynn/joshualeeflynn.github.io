(() => {
  const tree = [
    {
      id: "home",
      label: "home",
      href: "/"
    },

    {
      id: "teaching",
      label: "teaching/",
      href: "/teaching/",
      open: true,
      children: [
        {
          id: "18-100a",
          label: "18.100A",
          href: "/#18-100a"
        },
        {
          id: "previous-courses",
          label: "previous_courses/",
          children: [
            {
              id: "previous-mit",
              label: "MIT(2)",
              href: "/previous-courses/#mit"
            },
            {
              id: "previous-mcgill",
              label: "McGill(2)",
              href: "/previous-courses/#mcgill"
            },
            {
              id: "previous-uconn",
              label: "UConn(14)",
              href: "/previous-courses/#uconn"
            }
          ]
        }
      ]
    },

    {
      id: "research",
      label: "research/",
      open: false,
      expandable: true,
      children: []
    },

    {
      id: "papers",
      label: "papers",
      href: "/papers/"
    },

    {
      id: "talks",
      label: "talks",
      href: "/talks/"
    },

    {
      id: "about",
      label: "about",
      href: "/about/"
    },

    {
      id: "cv",
      label: "cv.pdf",
      href: "/cv.pdf"
    }
  ];

  const nav = document.getElementById("site-tree");
  if (!nav) return;

  let activeId = nav.dataset.active || "";

  const hashActive = {
    "#mit": "previous-mit",
    "#mcgill": "previous-mcgill",
    "#uconn": "previous-uconn"
  };

  if (
    activeId === "previous-courses" &&
    hashActive[window.location.hash]
  ) {
    activeId = hashActive[window.location.hash];
  }

  function containsActive(node) {
    if (node.id === activeId) return true;
    return (node.children || []).some(containsActive);
  }

  function branchGlyph(index, siblings) {
    return index === siblings.length - 1 ? "└──" : "├──";
  }

  function makeBranchText(text) {
    const span = document.createElement("span");
    span.className = "branch";
    span.textContent = text;
    return span;
  }

  function makeLink(node, extraClass = "") {
    const a = document.createElement("a");
    a.href = node.href;
    a.textContent = node.label;

    if (extraClass) {
      a.className = extraClass;
    }

    if (node.id === activeId) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }

    return a;
  }

  function setBranchOpen(toggle, label, children, isOpen) {
    children.hidden = !isOpen;

    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.textContent = isOpen ? "[-]" : "[+]";

    if (label.tagName === "BUTTON") {
      label.setAttribute("aria-expanded", String(isOpen));
    }
  }

  function makeDirectoryControls(node, children, startsOpen) {
    const toggle = document.createElement("button");
    toggle.className = "toggle";
    toggle.type = "button";

    let label;

    if (node.href) {
      label = makeLink(node);
    } else {
      label = document.createElement("button");
      label.className = "branch-label";
      label.type = "button";
      label.textContent = node.label;

      if (node.id === activeId) {
        label.classList.add("active");
      }
    }

    function flip() {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      setBranchOpen(toggle, label, children, !isOpen);
    }

    toggle.addEventListener("click", flip);

    if (!node.href) {
      label.addEventListener("click", flip);
    }

    setBranchOpen(toggle, label, children, startsOpen);

    return { toggle, label };
  }

  function renderNodes(nodes, depth = 0, container = nav) {
    nodes.forEach((node, index) => {
      const row = document.createElement("div");
      row.className = "node";
      row.style.paddingLeft = `${depth * 2}ch`;

      if (depth === 0 && index === 0 && node.id === "home") {
        row.classList.add("root-node");
        row.appendChild(makeLink(node));
        container.appendChild(row);
        return;
      }

      row.appendChild(makeBranchText(branchGlyph(index, nodes)));

      const hasChildren = (node.children || []).length > 0;
      const isExpandable = hasChildren || node.expandable === true;

      if (isExpandable) {
        const childContainer = document.createElement("div");
        childContainer.className = "children";

        const startsOpen =
          containsActive(node) ||
          node.open === true;

        const controls = makeDirectoryControls(
          node,
          childContainer,
          startsOpen
        );

        row.appendChild(controls.toggle);
        row.appendChild(controls.label);
        container.appendChild(row);

        if (hasChildren) {
          renderNodes(node.children, depth + 1, childContainer);
        }

        container.appendChild(childContainer);
      } else {
        const spacer = document.createElement("span");
        spacer.textContent = "    ";
        row.appendChild(spacer);
        row.appendChild(makeLink(node));
        container.appendChild(row);
      }
    });
  }

  renderNodes(tree);

  window.addEventListener("hashchange", () => {
    if (
      nav.dataset.active === "previous-courses" &&
      hashActive[window.location.hash]
    ) {
      window.location.reload();
    }
  });
})();
