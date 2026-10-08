// Install navigation before external styles/scripts can delay first paint.
(() => {
  const root = document.documentElement;
  const projectRoute = /\/(themis|dueform|actifact)\.html$/;
  const isProject = projectRoute.test(location.pathname);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const transitionKey = "portfolio-navigation-transition";
  let departing = false;
  let pendingUrl = null;
  let departureTimer = 0;
  let revealTimer = 0;
  let initialized = false;
  let arrivalAnimation = null;
  let coverAnimation = null;
  let arrivalSource = null;

  function read(key) {
    try {
      return JSON.parse(sessionStorage.getItem(key));
    } catch {
      return null;
    }
  }
  function write(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }
  function previousPortfolioUrl() {
    try {
      const value =
        window.navigation?.activation?.from?.url ||
        arrivalSource ||
        document.referrer;
      const url = value ? new URL(value) : null;
      return url?.origin === location.origin ? url : null;
    } catch {
      return null;
    }
  }
  function destinationMatches(value) {
    try {
      const to = new URL(value);
      return (
        to.origin === location.origin &&
        to.pathname === location.pathname &&
        to.search === location.search
      );
    } catch {
      return false;
    }
  }
  function consumeTransition() {
    const marker = read(transitionKey);
    try {
      sessionStorage.removeItem(transitionKey);
    } catch {}
    return marker &&
      Date.now() - marker.at < 15000 &&
      destinationMatches(marker.to)
      ? marker
      : null;
  }
  let incoming = consumeTransition();
  arrivalSource = incoming?.from || null;
  // This state paints a solid dark cover before the external stylesheet arrives.
  if (incoming && !motion.matches) root.dataset.pageTransition = "entering";

  function signal(phase, duration, direction) {
    document.dispatchEvent(
      new CustomEvent("portfolio-transition", {
        detail: { phase, duration, direction },
      }),
    );
  }
  function cover() {
    if (!document.body) return null;
    let element = document.getElementById("navigation-cover");
    if (!element) {
      element = document.createElement("div");
      element.id = "navigation-cover";
      element.setAttribute("aria-hidden", "true");
      element.style.cssText =
        "position:fixed;inset:0;z-index:2147483600;background:#0c1c1a;opacity:0;pointer-events:none";
      document.body.append(element);
    }
    return element;
  }
  function originRect(element) {
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    };
  }
  function rectTransform(element, rect) {
    if (
      !rect ||
      Math.abs(rect.viewportWidth - innerWidth) > 2 ||
      Math.abs(rect.viewportHeight - innerHeight) > 2
    )
      return "translateY(18px) scale(0.96)";
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) return "scale(0.96)";
    // Keep type and diagrams proportional while the frame travels to its card.
    const scale = Math.min(rect.width / box.width, rect.height / box.height);
    const x = rect.x + (rect.width - box.width * scale) / 2 - box.x;
    const y = rect.y + (rect.height - box.height * scale) / 2 - box.y;
    return `translate(${x}px, ${y}px) scale(${scale})`;
  }
  function focusPresentation() {
    if (isProject && [document.body, root].includes(document.activeElement))
      document
        .querySelector(".presentation-shell")
        ?.focus({ preventScroll: true });
  }
  function settled(direction) {
    root.removeAttribute("data-page-transition");
    root.removeAttribute("data-cover-ready");
    signal("settled", 0, direction);
  }
  function reveal() {
    departing = false;
    pendingUrl = null;
    clearTimeout(departureTimer);
    clearTimeout(revealTimer);
    arrivalAnimation?.cancel();
    coverAnimation?.cancel();
    root.classList.remove("project-return");
    focusPresentation();
    const previous = previousPortfolioUrl();
    const marker =
      incoming ||
      (previous && projectRoute.test(previous.pathname)
        ? { from: previous.href, direction: "close" }
        : null);
    incoming = null;
    const direction = marker?.direction || "open";
    const element = cover();
    if (element) element.style.pointerEvents = "none";
    if ((!marker && !isProject) || motion.matches) {
      if (element) element.style.opacity = "0";
      settled(direction);
      return;
    }
    root.dataset.pageTransition = "entering";
    // The real DOM animates; no browser-generated page or canvas snapshots exist.
    const slug = marker?.from
      ? projectRoute.exec(new URL(marker.from).pathname)?.[1]
      : null;
    const frame = isProject
      ? document.querySelector(".presentation-deck")
      : slug
        ? document.querySelector(`.card-frame[data-project="${slug}"]`)
        : null;
    const duration = isProject ? 560 : 320;
    signal("entering", duration, direction);
    if (element) {
      element.style.opacity = "1";
      // A DOM cover takes over before the head's first-paint cover is removed.
      root.dataset.coverReady = "true";
      coverAnimation = element.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 220,
        fill: "forwards",
        easing: "ease-out",
      });
    }
    if (
      frame &&
      frame.getBoundingClientRect().bottom > 0 &&
      frame.getBoundingClientRect().top < innerHeight
    ) {
      frame.style.transformOrigin = "top left";
      arrivalAnimation = frame.animate(
        [
          {
            transform: isProject
              ? rectTransform(frame, marker?.rect)
              : "translateY(8px) scale(0.98)",
            opacity: 0.3,
          },
          { transform: "none", opacity: 1 },
        ],
        { duration, easing: "cubic-bezier(.22,1,.36,1)" },
      );
    }
    revealTimer = setTimeout(() => {
      if (departing) return;
      if (element) element.style.opacity = "0";
      coverAnimation?.cancel();
      settled(direction);
    }, duration);
  }
  function leave(to, { back = false, rect = null } = {}) {
    if (departing) return;
    departing = true;
    pendingUrl = to;
    incoming = null;
    clearTimeout(revealTimer);
    const direction = isProject ? "close" : "open";
    const duration = motion.matches || document.hidden || !isProject ? 0 : 900;
    const marker = { from: location.href, to, direction, rect, at: Date.now() };
    write(transitionKey, marker);
    if (projectRoute.test(new URL(to).pathname) && rect)
      write(`portfolio-project-origin:${new URL(to).pathname}`, {
        from: location.href,
        rect,
      });
    const element = cover();
    const frame = document.querySelector(".presentation-deck");
    const first = frame
      ? {
          transform: getComputedStyle(frame).transform,
          opacity: getComputedStyle(frame).opacity,
        }
      : null;
    arrivalAnimation?.cancel();
    coverAnimation?.cancel();
    root.dataset.pageTransition = "leaving";
    root.dataset.coverReady = "true";
    signal("leaving", duration, direction);
    if (element) {
      element.style.pointerEvents = "auto";
      if (duration) {
        element.style.opacity = "0";
        coverAnimation = element.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 300,
          delay: duration - 300,
          fill: "forwards",
          easing: "ease-in-out",
        });
      } else element.style.opacity = "1";
    }
    if (frame && duration) {
      const origin = read(`portfolio-project-origin:${location.pathname}`);
      const target =
        origin && destinationMatchesOrigin(origin.from, to)
          ? origin.rect
          : null;
      frame.style.transformOrigin = "top left";
      arrivalAnimation = frame.animate(
        [first, { transform: rectTransform(frame, target), opacity: 0.15 }],
        { duration, fill: "forwards", easing: "cubic-bezier(.65,0,.35,1)" },
      );
    }
    const commit = () => {
      if (element) element.style.opacity = "1";
      if (back) history.back();
      else location.assign(to);
    };
    if (duration) departureTimer = setTimeout(commit, duration);
    else commit();
  }
  function destinationMatchesOrigin(from, to) {
    try {
      const a = new URL(from),
        b = new URL(to);
      return a.pathname === b.pathname && a.search === b.search;
    } catch {
      return false;
    }
  }
  function returnToPreviousPage() {
    const previous = previousPortfolioUrl();
    const allowed =
      previous &&
      /\/(?:index\.html|projects\.html|themis\.html|dueform\.html|actifact\.html)?$/.test(
        previous.pathname,
      ) &&
      history.length > 1;
    leave(
      allowed ? previous.href : new URL("index.html#work", location.href).href,
      { back: Boolean(allowed) },
    );
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      initialized = true;
      // Deferred scripts completing must not cancel an exit already requested.
      if (!departing) reveal();
    },
    { once: true },
  );
  window.addEventListener("pageshow", (event) => {
    if (!initialized || event.persisted) {
      incoming = incoming || consumeTransition();
      arrivalSource = incoming?.from || arrivalSource;
      const element = document.getElementById("navigation-cover");
      if (element) element.style.pointerEvents = "none";
      reveal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      event.target.closest?.("input, textarea, select, [contenteditable]") ||
      document.querySelector('.menu-toggle[aria-expanded="true"]')
    )
      return;
    if (isProject) {
      event.preventDefault();
      returnToPreviousPage();
    } else if (
      departing &&
      pendingUrl &&
      projectRoute.test(new URL(pendingUrl).pathname)
    ) {
      event.preventDefault();
      window.stop();
      incoming = null;
      try {
        sessionStorage.removeItem(transitionKey);
      } catch {}
      reveal();
    }
  });
  document.addEventListener("click", (event) => {
    if (
      event.button !== 0 ||
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    )
      return;
    const link = event.target.closest?.("a[href]");
    if (link) {
      if (
        (link.target && link.target !== "_self") ||
        link.hasAttribute("download")
      )
        return;
      const to = new URL(link.href, location.href);
      if (
        to.origin !== location.origin ||
        !/\/(?:[^/]*\.html)?$/.test(to.pathname) ||
        (to.pathname === location.pathname && to.search === location.search)
      )
        return;
      event.preventDefault();
      leave(to.href, { rect: originRect(link.querySelector(".card-frame")) });
      return;
    }
    if (
      isProject &&
      !window.getSelection()?.toString() &&
      !event.target.closest?.(
        ".presentation-deck, .presentation-navigation, .presentation-hint, .site-header, a, button",
      )
    )
      returnToPreviousPage();
  });
})();
