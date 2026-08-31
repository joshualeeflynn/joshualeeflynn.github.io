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
      children: [
        {
          id: "mit",
          label: "mit/",
          href: "/mit/"
        },
        {
          id: "mcgill",
          label: "mcgill/",
          href: "/mcgill/"
        },
        {
          id: "uconn",
          label: "uconn/",
          href: "/uconn/"
        }
      ]
    },

    {
      id: "research",
      label: "research/",
      expandable: true,
      children: []
    },

    {
      id: "papers",
      label: "papers",
      href: "/papers/"
    },

    {
      id: "events",
      label: "events/",
      href: "/events/",
      children: [
        {
          id: "organized",
          label: "organized/",
          href: "/organized/"
        },
        {
          id: "given",
          label: "given/",
          href: "/given/"
        }
      ]
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

  const STORAGE_KEY = "site-tree-open-branches";
  const documentCache = new Map();

  let activeId = nav.dataset.active || "";
  let renderedUrl = new URL(window.location.href);

  /*
    Inline <style> blocks are treated as page-specific. This matters for the
    teaching graph, whose layout currently lives in teaching/index.html.
  */
  document.head.querySelectorAll("style").forEach(style => {
    style.dataset.softNavPageStyle = "";
  });

  function readOpenBranches() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeOpenBranches(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* Navigation still works if storage is unavailable. */
    }
  }

  const openBranches = readOpenBranches();

  function branchGlyph(index, siblings) {
    return index === siblings.length - 1 ? "└──" : "├──";
  }

  function makeBranchText(text) {
    const span = document.createElement("span");
    span.className = "branch";
    span.textContent = text;
    return span;
  }

  function makeLink(node) {
    const a = document.createElement("a");
    a.href = node.href;
    a.textContent = node.label;
    a.dataset.nodeId = node.id;

    if (node.id === activeId) {
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }

    return a;
  }

  function updateActiveNode(nextActiveId) {
    activeId = nextActiveId || "";
    nav.dataset.active = activeId;

    nav.querySelectorAll("[data-node-id]").forEach(element => {
      const isActive = element.dataset.nodeId === activeId;

      element.classList.toggle("active", isActive);

      if (isActive && element.tagName === "A") {
        element.setAttribute("aria-current", "page");
      } else {
        element.removeAttribute("aria-current");
      }
    });
  }

  function setBranchOpen(node, toggle, label, children, isOpen) {
    children.hidden = !isOpen;

    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.textContent = isOpen ? "[-]" : "[+]";

    if (label.tagName === "BUTTON") {
      label.setAttribute("aria-expanded", String(isOpen));
    }

    openBranches[node.id] = isOpen;
    writeOpenBranches(openBranches);
  }

  function makeDirectoryControls(node, children) {
    const toggle = document.createElement("button");
    toggle.className = "toggle";
    toggle.type = "button";

    let label;

    if (node.href) {
      label = makeLink(node);

      /*
        Clicking a directory page link also toggles that directory's folding
        state. The navigation itself proceeds normally / through soft-nav.
      */
      label.addEventListener("click", event => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        setBranchOpen(node, toggle, label, children, !isOpen);

        /*
          If we're already on this directory's page, clicking its label is
          purely a fold/unfold action. Prevent the browser from reloading the
          same document.
        */
        const targetUrl = new URL(node.href, window.location.href);
        const currentUrl = new URL(window.location.href);

        const samePage =
          targetUrl.origin === currentUrl.origin &&
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search;

        if (samePage) {
          event.preventDefault();
        }
      });
    } else {
      label = document.createElement("button");
      label.className = "branch-label";
      label.type = "button";
      label.textContent = node.label;
      label.dataset.nodeId = node.id;

      if (node.id === activeId) {
        label.classList.add("active");
      }
    }

    function flip() {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      setBranchOpen(node, toggle, label, children, !isOpen);
    }

    toggle.addEventListener("click", flip);

    if (!node.href) {
      label.addEventListener("click", flip);
    }

    const startsOpen = openBranches[node.id] === true;

    children.hidden = !startsOpen;
    toggle.setAttribute("aria-expanded", String(startsOpen));
    toggle.textContent = startsOpen ? "[-]" : "[+]";

    if (label.tagName === "BUTTON") {
      label.setAttribute("aria-expanded", String(startsOpen));
    }

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

        const controls = makeDirectoryControls(node, childContainer);

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

  /*
    ---------- Soft navigation ----------
    Shell pages all contain:
      .content-panel
      #site-tree[data-active]
    If a fetched page does not contain those, navigation falls back to a
    normal browser load. This keeps old course pages and PDFs untouched.
  */

  function sameDocument(a, b) {
    return (
      a.origin === b.origin &&
      a.pathname === b.pathname &&
      a.search === b.search
    );
  }

  function cacheKey(url) {
    return `${url.origin}${url.pathname}${url.search}`;
  }

  function looksLikeDocumentLink(url) {
    if (url.origin !== window.location.origin) return false;

    const lastPart = url.pathname.split("/").pop() || "";

    /*
      Directory URLs and extensionless URLs are candidates for soft nav.
      Explicit files such as .pdf, .zip, images, etc. use normal navigation.
    */
    return !lastPart.includes(".") || lastPart.endsWith(".html");
  }

  async function fetchDocument(url) {
    const key = cacheKey(url);

    if (documentCache.has(key)) {
      return documentCache.get(key);
    }

    const request = fetch(url.href, {
      credentials: "same-origin",
      headers: {
        "X-Soft-Navigation": "1"
      }
    })
      .then(async response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const contentType = response.headers.get("content-type") || "";

        if (!contentType.includes("text/html")) {
          return null;
        }

        const html = await response.text();
        return new DOMParser().parseFromString(html, "text/html");
      })
      .catch(error => {
        documentCache.delete(key);
        throw error;
      });

    documentCache.set(key, request);
    return request;
  }

  function preparePageStyles(nextDocument) {
    const oldStyles = [
      ...document.head.querySelectorAll("style[data-soft-nav-page-style]")
    ];

    const newStyles = [];

    nextDocument.head.querySelectorAll("style").forEach(style => {
      const copy = document.createElement("style");
      copy.dataset.softNavPageStyle = "next";
      copy.textContent = style.textContent;
      document.head.appendChild(copy);
      newStyles.push(copy);
    });

    return () => {
      oldStyles.forEach(style => style.remove());

      newStyles.forEach(style => {
        style.dataset.softNavPageStyle = "";
      });
    };
  }

  function scrollForUrl(url) {
    if (url.hash) {
      const id = decodeURIComponent(url.hash.slice(1));
      const target = document.getElementById(id);

      if (target) {
        target.scrollIntoView();
        return;
      }
    }

    window.scrollTo(0, 0);
  }

  async function softNavigate(url, pushHistory) {
    /*
      Hash-only movement on the current document should remain native.
    */
    if (sameDocument(url, renderedUrl)) {
      renderedUrl = new URL(url.href);
      scrollForUrl(url);
      return;
    }

    try {
      const nextDocument = await fetchDocument(url);

      if (!nextDocument) {
        window.location.assign(url.href);
        return;
      }

      const nextPanel = nextDocument.querySelector(".content-panel");
      const nextNav = nextDocument.querySelector("#site-tree");

      /*
        A page outside the shared shell (for example an archived course page)
        deliberately falls back to ordinary navigation.
      */
      if (!nextPanel || !nextNav) {
        window.location.assign(url.href);
        return;
      }

      const currentPanel = document.querySelector(".content-panel");

      if (!currentPanel) {
        window.location.assign(url.href);
        return;
      }

      const importedPanel = document.importNode(nextPanel, true);

      /*
        Install the incoming page styles before touching the current panel.
        Keep the outgoing styles alive through the panel replacement so the
        old page never flashes or shifts during the swap.
      */
      const finishStyleSwap = preparePageStyles(nextDocument);

      currentPanel.replaceWith(importedPanel);
      finishStyleSwap();

      document.title = nextDocument.title;

      const nextActiveId = nextNav.dataset.active || "";
      updateActiveNode(nextActiveId);

      if (pushHistory) {
        history.pushState({}, "", url.href);
      }

      renderedUrl = new URL(url.href);
      scrollForUrl(url);
    } catch {
      /*
        Reliability wins: any fetch/parser/network failure becomes an ordinary
        navigation instead of leaving the user on a broken partial page.
      */
      window.location.assign(url.href);
    }
  }

  function eligibleAnchor(anchor) {
    if (!anchor) return null;

    /*
      Use the literal attribute rather than anchor.href.
      HTMLAnchorElement.href is a string, but SVG <a> elements expose href
      differently in some browsers. getAttribute("href") is reliable for both.
    */
    const href = anchor.getAttribute("href");

    if (!href) return null;

    const target = anchor.getAttribute("target");
    if (target && target !== "_self") return null;

    if (anchor.hasAttribute("download")) return null;

    const url = new URL(href, window.location.href);

    if (!looksLikeDocumentLink(url)) return null;

    /*
      Leave hash-only links on the current page to the browser.
    */
    if (sameDocument(url, renderedUrl)) return null;

    return url;
  }

  document.addEventListener("click", event => {
    if (event.defaultPrevented) return;
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest("a[href]");
    const url = eligibleAnchor(anchor);

    if (!url) return;

    event.preventDefault();
    softNavigate(url, true);
  });

  /*
    Prefetch likely destinations before the click. On desktop this usually
    starts while the pointer is moving toward the link; keyboard focus also
    triggers it.
  */
  function prefetchFromEvent(event) {
    const anchor = event.target.closest("a[href]");
    const url = eligibleAnchor(anchor);

    if (!url) return;

    fetchDocument(url).catch(() => {
      /* A later click will simply use ordinary navigation on failure. */
    });
  }

  document.addEventListener("pointerover", prefetchFromEvent);
  document.addEventListener("focusin", prefetchFromEvent);

  window.addEventListener("popstate", () => {
    const url = new URL(window.location.href);

    if (sameDocument(url, renderedUrl)) {
      renderedUrl = url;
      scrollForUrl(url);
      return;
    }

    softNavigate(url, false);
  });
})();
