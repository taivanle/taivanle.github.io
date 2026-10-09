// Install navigation before external styles/scripts can delay first paint.
(() => {
  const root = document.documentElement;
  root.style.viewTransitionName = "none";
  // The shared build supplies these routes from the project content file.
  const projectRoutes = new Map(
    (root.dataset.projectRoutes || "")
      .split(" ")
      .filter(Boolean)
      .map((file) => [
        new URL(file, location.href).pathname,
        file.slice(0, -5),
      ]),
  );
  const isProject = projectRoutes.has(location.pathname);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const transitionKey = "portfolio-navigation-transition";
  const openingDuration = 650;
  const closingDuration = 550;
  const cardMotion = window.PortfolioCardMotion;
  let departing = false;
  let pendingUrl = null;
  let departureTimer = 0;
  let revealTimer = 0;
  let initialized = false;
  let arrivalAnimation = null;
  let coverAnimation = null;
  let arrivalSource = null;
  let entrySource = null;
  let returnFrame = null;
  let returnCardAnimation = null;
  let outgoingCard = null;
  let incomingCard = null;
  let preparation = null;
  const preparedPages = new Map();
  const pageShown = new Promise((resolve) =>
    window.addEventListener("pageshow", resolve, { once: true }),
  );

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
      return true;
    } catch {
      return false;
    }
  }
  function previousPortfolioUrl() {
    let previousEntry = null;
    try {
      const navigation = window.navigation;
      const index = navigation?.currentEntry?.index;
      if (index > 0)
        previousEntry = navigation
          .entries()
          .find((entry) => entry.index === index - 1)?.url;
    } catch {}
    for (const value of [previousEntry, entrySource, document.referrer]) {
      try {
        const url = value ? new URL(value) : null;
        // A reload's activation can point back to the very same project.
        if (
          url?.origin === location.origin &&
          url.pathname !== location.pathname
        )
          return url;
      } catch {}
    }
    return null;
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
  // Preserve this history entry's source when a later cached return arrives.
  entrySource = incoming?.from || document.referrer || null;
  const knownSource = Boolean(incoming);
  // This state paints a solid dark cover before the external stylesheet arrives.
  if (incoming && !motion.matches) root.dataset.pageTransition = "entering";
  if (incoming?.flip && !motion.matches) startCardArrival(incoming);

  function deckRect() {
    const mobile = innerWidth <= 760;
    const width = mobile ? innerWidth - 24 : Math.min(1200, innerWidth - 96);
    return {
      x: (innerWidth - width) / 2,
      y: mobile ? 122 : 142,
      width,
      height: Math.max(100, innerHeight - (mobile ? 212 : 250)),
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
    };
  }
  function between(a, b) {
    return {
      ...a,
      ...Object.fromEntries(
        ["x", "y", "width", "height"].map((key) => [
          key,
          a[key] + (b[key] - a[key]) * 0.55,
        ]),
      ),
    };
  }
  function startCardArrival(marker) {
    const flip = marker?.flip;
    if (
      !cardMotion ||
      !flip?.frame?.html ||
      !flip.rect ||
      !flip.target ||
      Math.abs(flip.rect.viewportWidth - innerWidth) > 2 ||
      Math.abs(flip.rect.viewportHeight - innerHeight) > 2
    )
      return false;
    root.dataset.cardTransition = "true";
    root.dataset.pageTransition = "entering";
    incomingCard = cardMotion.create({
      ...flip,
      direction: marker.direction,
      arrival: true,
      duration: marker.direction === "open" ? 270 : 210,
    });
    signal(
      "entering",
      marker.direction === "open" ? 390 : 330,
      marker.direction,
    );
    return true;
  }
  function preparePage(to) {
    if (!preparedPages.has(to)) {
      const controller = new AbortController();
      const ready = fetch(to, {
        credentials: "same-origin",
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error("Page unavailable");
          return response.text();
        })
        .catch(() => null);
      preparedPages.set(to, { ready, controller });
    }
    return preparedPages.get(to);
  }
  function clearCardMotion() {
    outgoingCard?.cancel();
    incomingCard?.cancel();
    outgoingCard = incomingCard = null;
    root.removeAttribute("data-card-transition");
  }
  function restoreCardScroll(marker, frame) {
    if (
      !isProject &&
      marker?.direction === "close" &&
      frame &&
      Number.isFinite(marker.flip?.target?.y)
    )
      window.scrollTo({
        top: scrollY + frame.getBoundingClientRect().top - marker.flip.target.y,
        behavior: "instant",
      });
  }

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
  function rectTransform(element, rect, fullCard = false) {
    if (
      !rect ||
      Math.abs(rect.viewportWidth - innerWidth) > 2 ||
      Math.abs(rect.viewportHeight - innerHeight) > 2
    )
      return "translateY(18px) scale(0.96)";
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) return "scale(0.96)";
    // On entry, expand the entire selected card, as the earlier opening did.
    if (fullCard)
      return `translate(${rect.x - box.x}px, ${rect.y - box.y}px) scale(${rect.width / box.width}, ${rect.height / box.height})`;
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
  function captureExitFrame(frame) {
    if (!frame) return null;
    // Carry only the painted DOM. Freezing its styles preserves the active
    // slide on the landing page without browser page or canvas snapshots.
    function paintedClone(node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return node.cloneNode();
      if (/^(SCRIPT|IFRAME|OBJECT|EMBED|STYLE|LINK)$/.test(node.tagName))
        return null;
      const style = getComputedStyle(node);
      if (style.display === "none" || node.hidden) return null;
      const copy = node.cloneNode(false);
      for (const attribute of [...copy.attributes])
        if (
          attribute.name === "id" ||
          attribute.name.startsWith("on") ||
          attribute.name.startsWith("data-")
        )
          copy.removeAttribute(attribute.name);
      copy.style.cssText = [...style]
        .map((property) => `${property}:${style.getPropertyValue(property)};`)
        .join("");
      copy.style.animation = "none";
      copy.style.transition = "none";
      for (const child of node.childNodes) {
        const cloned = paintedClone(child);
        if (cloned) copy.append(cloned);
      }
      return copy;
    }
    const copy = paintedClone(frame);
    const style = getComputedStyle(frame);
    return copy
      ? {
          html: copy.outerHTML,
          rect: originRect(frame),
          width: parseFloat(style.width),
          height: parseFloat(style.height),
        }
      : null;
  }
  function restoreExitFrame(marker, card) {
    const saved = marker?.exitFrame;
    if (
      !card ||
      !saved?.html ||
      !saved.rect ||
      Math.abs(saved.rect.viewportWidth - innerWidth) > 2 ||
      Math.abs(saved.rect.viewportHeight - innerHeight) > 2
    )
      return null;
    const template = document.createElement("template");
    template.innerHTML = saved.html;
    const frame = template.content.firstElementChild;
    if (!frame) return null;
    frame.className = "navigation-return-frame presentation-page";
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("inert", "");
    Object.assign(frame.style, {
      position: "fixed",
      left: `${saved.rect.x}px`,
      top: `${saved.rect.y}px`,
      width: `${saved.width}px`,
      height: `${saved.height}px`,
      minWidth: "0",
      maxWidth: "none",
      minHeight: "0",
      maxHeight: "none",
      margin: "0",
      transform: "none",
      transformOrigin: "top left",
      opacity: "1",
      pointerEvents: "none",
      overflow: "hidden",
      zIndex: "2147483500",
    });
    document.body.append(frame);
    return frame;
  }
  function clearReturnFrame() {
    returnFrame?.remove();
    returnFrame = null;
    returnCardAnimation?.cancel();
    returnCardAnimation = null;
  }
  function settled(direction) {
    root.removeAttribute("data-page-transition");
    root.removeAttribute("data-cover-ready");
    root.removeAttribute("data-card-transition");
    signal("settled", 0, direction);
  }
  function reveal() {
    departing = false;
    pendingUrl = null;
    clearTimeout(departureTimer);
    clearTimeout(revealTimer);
    arrivalAnimation?.cancel();
    coverAnimation?.cancel();
    clearReturnFrame();
    outgoingCard?.cancel();
    outgoingCard = null;
    root.classList.remove("project-return");
    focusPresentation();
    const previous = previousPortfolioUrl();
    const marker =
      incoming ||
      (previous && projectRoutes.has(previous.pathname)
        ? { from: previous.href, direction: "close" }
        : null);
    incoming = null;
    const direction = marker?.direction || "open";
    const element = cover();
    if (element) element.style.pointerEvents = "none";
    if (marker?.flip && !motion.matches) {
      if (!incomingCard) startCardArrival(marker);
      const slug = marker.from
        ? projectRoutes.get(new URL(marker.from).pathname)
        : null;
      const actual = isProject
        ? document.querySelector(".presentation-deck")
        : document.querySelector(`.card-frame[data-project="${slug}"]`);
      if (incomingCard && actual) {
        if (element) element.style.opacity = "0";
        const card = incomingCard;
        const section = actual.closest(".chapter-section");
        section?.classList.add("is-chapter-active");
        const title = section?.querySelector(".chapter-title");
        if (title) title.style.animation = "none";
        card.finished.then(async () => {
          if (departing || incomingCard !== card) return;
          if (direction === "close") {
            await pageShown;
            await new Promise(requestAnimationFrame);
            if (departing || incomingCard !== card) return;
            restoreCardScroll(marker, actual);
          }
          root.dataset.coverReady = "true";
          root.removeAttribute("data-card-transition");
          await card.reveal(actual);
          if (departing || incomingCard !== card) return;
          incomingCard = null;
          settled(direction);
        });
        return;
      }
    }
    clearCardMotion();
    if ((!marker && !isProject) || motion.matches) {
      if (element) element.style.opacity = "0";
      settled(direction);
      return;
    }
    root.dataset.pageTransition = "entering";
    // The real DOM animates; no browser-generated page or canvas snapshots exist.
    const slug = marker?.from
      ? projectRoutes.get(new URL(marker.from).pathname)
      : null;
    const frame = isProject
      ? document.querySelector(".presentation-deck")
      : slug
        ? document.querySelector(`.card-frame[data-project="${slug}"]`)
        : null;
    if (!isProject && direction === "close") {
      const section = frame?.closest(".chapter-section");
      section?.classList.add("is-chapter-active");
      const title = section?.querySelector(".chapter-title");
      // A fresh document return must be as steady as a cached history return.
      if (title) title.style.animation = "none";
    }
    returnFrame = !isProject ? restoreExitFrame(marker, frame) : null;
    const duration = returnFrame
      ? closingDuration
      : isProject
        ? openingDuration
        : 320;
    signal("entering", duration, direction);
    if (element) {
      element.style.opacity = "1";
      // A DOM cover takes over before the head's first-paint cover is removed.
      root.dataset.coverReady = "true";
      coverAnimation = element.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: returnFrame || (isProject && marker?.rect) ? 80 : 220,
        fill: "forwards",
        easing: "ease-out",
      });
    }
    if (returnFrame) {
      const target = originRect(frame);
      arrivalAnimation = returnFrame.animate(
        [
          {
            transform: rectTransform(returnFrame, marker.exitFrame.rect, true),
            opacity: 1,
            easing: "cubic-bezier(.22,1,.36,1)",
          },
          { opacity: 1, offset: 0.7, easing: "linear" },
          { transform: rectTransform(returnFrame, target, true), opacity: 0 },
        ],
        { duration, fill: "forwards", easing: "linear" },
      );
      returnCardAnimation = frame.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: duration * 0.3,
        delay: duration * 0.7,
        fill: "backwards",
      });
    } else if (
      frame &&
      frame.getBoundingClientRect().bottom > 0 &&
      frame.getBoundingClientRect().top < innerHeight
    ) {
      frame.style.transformOrigin = "top left";
      arrivalAnimation = frame.animate(
        [
          {
            transform: isProject
              ? rectTransform(frame, marker?.rect, true)
              : "translateY(8px) scale(0.98)",
            opacity: isProject && marker?.rect ? 1 : 0.3,
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
      clearReturnFrame();
      settled(direction);
    }, duration);
  }
  function leave(to, { back = false, rect = null, card = null } = {}) {
    if (departing) return;
    departing = true;
    pendingUrl = to;
    incoming = null;
    clearTimeout(revealTimer);
    const direction = isProject ? "close" : "open";
    const duration =
      motion.matches || document.hidden || !isProject ? 0 : closingDuration;
    const marker = { from: location.href, to, direction, rect, at: Date.now() };
    const frame =
      !initialized && incomingCard
        ? incomingCard.element
        : document.querySelector(".presentation-deck");
    const origin = isProject
      ? read(`portfolio-project-origin:${location.pathname}`)
      : null;
    const snapshot = captureExitFrame(isProject ? frame : card);
    const destinationIsProject = projectRoutes.has(new URL(to).pathname);
    const canFlip =
      !motion.matches &&
      !document.hidden &&
      cardMotion &&
      snapshot &&
      (isProject
        ? !destinationIsProject &&
          origin?.card &&
          destinationMatchesOrigin(origin.from, to)
        : destinationIsProject && card);
    const target = isProject ? origin?.rect : deckRect();
    const source = snapshot?.rect;
    if (canFlip)
      marker.flip = {
        frame: isProject ? origin.card : snapshot,
        rect: between(source, target),
        target,
        name:
          origin?.name ||
          card?.querySelector("h3")?.textContent ||
          document.querySelector("h1")?.textContent ||
          "",
      };
    if (duration && !projectRoutes.has(new URL(to).pathname))
      marker.exitFrame = captureExitFrame(frame);
    const stored = write(transitionKey, marker);
    // The destination displays the landing page behind the contracting card.
    // If storage is unavailable, retain the dark-backed in-page fallback.
    const destinationClose = stored && Boolean(marker.exitFrame);
    if (projectRoutes.has(new URL(to).pathname) && rect)
      write(`portfolio-project-origin:${new URL(to).pathname}`, {
        from: location.href,
        rect,
        card: snapshot,
        name: card?.querySelector("h3")?.textContent || "",
      });
    const element = cover();
    const first = frame
      ? {
          transform: getComputedStyle(frame).transform,
          opacity: getComputedStyle(frame).opacity,
        }
      : null;
    arrivalAnimation?.cancel();
    coverAnimation?.cancel();
    clearReturnFrame();
    root.dataset.pageTransition = "leaving";
    root.dataset.coverReady = "true";
    if (stored && marker.flip) {
      const travel = isProject ? 220 : 260;
      clearCardMotion();
      root.dataset.cardTransition = "true";
      root.dataset.pageTransition = "leaving";
      if (element) {
        element.style.opacity = "0";
        element.style.pointerEvents = "auto";
      }
      outgoingCard = cardMotion.create({
        frame: snapshot,
        backFrame: isProject ? origin.card : null,
        rect: source,
        target: marker.flip.rect,
        name: marker.flip.name,
        direction,
        arrival: false,
        duration: travel,
      });
      preparation = back ? null : preparePage(to);
      signal("leaving", travel, direction);
      const departureCard = outgoingCard;
      Promise.all([departureCard.finished, preparation?.ready]).then(() => {
        if (!departing || pendingUrl !== to || outgoingCard !== departureCard)
          return;
        if (back) history.back();
        else location.assign(to);
      });
      return;
    }
    clearCardMotion();
    signal("leaving", duration, direction);
    if (element) {
      element.style.pointerEvents = "auto";
      if (duration && !destinationClose) {
        element.style.opacity = "0";
        coverAnimation = element.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 80,
          delay: duration - 80,
          fill: "forwards",
          easing: "ease-in-out",
        });
      } else element.style.opacity = "1";
    }
    if (frame && duration && !destinationClose) {
      const origin = read(`portfolio-project-origin:${location.pathname}`);
      const target =
        origin && destinationMatchesOrigin(origin.from, to)
          ? origin.rect
          : null;
      frame.style.transformOrigin = "top left";
      arrivalAnimation = frame.animate(
        [first, { transform: rectTransform(frame, target, true), opacity: 1 }],
        { duration, fill: "forwards", easing: "cubic-bezier(.22,1,.36,1)" },
      );
    }
    const commit = () => {
      if (element) element.style.opacity = "1";
      if (back) history.back();
      else location.assign(to);
    };
    if (duration && !destinationClose)
      departureTimer = setTimeout(commit, duration);
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
      (projectRoutes.has(previous.pathname) ||
        /\/(?:index\.html|projects\.html)?$/.test(previous.pathname)) &&
      history.length > 1;
    // An older, already-open portfolio cannot supply our transition marker.
    // Reload its URL instead of restoring its stale scripts from page cache.
    leave(
      allowed ? previous.href : new URL("index.html#work", location.href).href,
      { back: Boolean(allowed && knownSource) },
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
      projectRoutes.has(new URL(pendingUrl).pathname)
    ) {
      event.preventDefault();
      window.stop();
      preparation?.controller.abort();
      preparedPages.delete(pendingUrl);
      preparation = null;
      clearCardMotion();
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
      const card = link.querySelector(".card-frame");
      leave(to.href, { rect: originRect(card), card });
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
  for (const type of ["pointerover", "focusin"])
    document.addEventListener(
      type,
      (event) => {
        const link = event.target.closest?.(".project-card a[href]");
        if (
          link &&
          link.origin === location.origin &&
          projectRoutes.has(new URL(link.href).pathname)
        )
          preparePage(link.href);
      },
      { passive: true },
    );
})();
