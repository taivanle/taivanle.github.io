const root = document.documentElement;
root.classList.add("js");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const arrivedByTransition = Boolean(root.dataset.pageTransition);
const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector("#navigation");
function closeMenu() {
  menuButton?.setAttribute("aria-expanded", "false");
  navigation?.classList.remove("is-open");
}
menuButton?.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  navigation?.classList.toggle("is-open", open);
});
navigation?.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    menuButton?.getAttribute("aria-expanded") === "true"
  ) {
    event.preventDefault();
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".site-header")) closeMenu();
});
window
  .matchMedia("(min-width: 761px)")
  .addEventListener("change", (event) => event.matches && closeMenu());

const veil = document.querySelector(".intro-veil");
veil?.addEventListener("animationend", (event) => {
  if (event.target === veil) veil.remove();
});

const filterButtons = [...document.querySelectorAll("[data-filter]")];
const projectCards = [...document.querySelectorAll("[data-category]")];
let filterRun = 0;
async function applyFilter(button) {
  const run = ++filterRun;
  const filter = button.dataset.filter;
  const matches = (card) =>
    filter === "all" || card.dataset.category === filter;
  filterButtons.forEach((item) =>
    item.setAttribute("aria-pressed", String(item === button)),
  );
  const leaving = projectCards.filter((card) => !card.hidden && !matches(card));
  if (leaving.length && !reducedMotion.matches)
    await Promise.all(
      leaving.map((card) =>
        card
          .animate(
            [
              { opacity: 1, transform: "none" },
              { opacity: 0, transform: "translateY(10px) scale(0.98)" },
            ],
            { duration: 200, easing: "cubic-bezier(0.4, 0, 1, 1)" },
          )
          .finished.catch(() => {}),
      ),
    );
  if (run !== filterRun) return;
  projectCards.forEach((card) => {
    card.hidden = !matches(card);
  });
  if (!reducedMotion.matches)
    projectCards
      .filter((card) => !card.hidden)
      .forEach((card, index) =>
        card.animate(
          [
            { opacity: 0, transform: "translateY(18px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 650, delay: index * 70, easing: ease, fill: "backwards" },
        ),
      );
  const count = projectCards.filter((card) => !card.hidden).length;
  document.querySelector("#filter-status").textContent =
    `${count} ${count === 1 ? "project" : "projects"} shown: ${button.textContent.trim().replace(/\s+\d+$/, "")}.`;
}
filterButtons.forEach((button) =>
  button.addEventListener("click", () => applyFilter(button)),
);

const copyButton = document.querySelector("[data-copy-email]");
copyButton?.addEventListener("click", async () => {
  const status = document.querySelector("#copy-status");
  try {
    await navigator.clipboard.writeText("taivan@hotmail.co.uk");
    status.textContent = "Email address copied.";
    copyButton.setAttribute("aria-label", "Email address copied");
    copyButton.classList.add("is-copied");
    setTimeout(() => {
      status.textContent = "";
      copyButton.setAttribute("aria-label", "Copy email address");
      copyButton.classList.remove("is-copied");
    }, 3500);
  } catch {
    status.textContent = "Please copy this address: taivan@hotmail.co.uk";
  }
});

const portraitVideo = document.querySelector("[data-portrait-video]");
const home = document.querySelector(".home-page");
if (home) {
  const links = [...navigation.querySelectorAll('.nav-link[href^="#"]')];
  const sections = links.map((link) => document.querySelector(link.hash));
  const indicator = navigation.querySelector(".nav-indicator");
  const rail = document.querySelector(".chapter-rail");
  const railLinks = rail ? [...rail.querySelectorAll("a")] : [];
  let trackingFrame = 0;
  let activeLink = null;
  let indicatorReady = false;
  navigation.classList.add("has-nav-indicator");
  function moveIndicator(link) {
    activeLink = link;
    const bounds = link?.getBoundingClientRect();
    if (!bounds?.width) {
      indicator.classList.remove("is-visible");
      return;
    }
    const parent = navigation.getBoundingClientRect();
    indicator.style.transform = `translate3d(${bounds.left - parent.left}px, ${bounds.top - parent.top}px, 0)`;
    indicator.style.width = `${bounds.width}px`;
    indicator.style.height = `${bounds.height}px`;
    indicator.classList.add("is-visible");
    if (!indicatorReady) {
      indicatorReady = true;
      requestAnimationFrame(() => indicator.classList.add("is-positioned"));
    }
  }
  function trackSection() {
    trackingFrame = 0;
    const padding = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    const line = Math.max(padding + 24, innerHeight * 0.25);
    const selected = sections.findLastIndex(
      (section) => section.getBoundingClientRect().top <= line,
    );
    const inContact =
      document.querySelector(".contact-section").getBoundingClientRect().top <=
      line;
    const current = !inContact && selected >= 0 ? links[selected] : null;
    links.forEach((link, index) => {
      if (link === current) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
      railLinks[index]?.classList.toggle("is-current", link === current);
    });
    rail?.classList.toggle("is-visible", Boolean(current));
    if (current !== activeLink || !indicator.classList.contains("is-visible"))
      moveIndicator(current);
  }
  function scheduleTracking() {
    if (!trackingFrame) trackingFrame = requestAnimationFrame(trackSection);
  }
  const stops = [
    ...document.querySelectorAll(
      ".intro-chapter, .chapter-section, .contact-section",
    ),
  ];
  let settleTimer = 0;
  let settleFrame = 0;
  let inputPending = false;
  let touching = false;
  let direction = 0;
  let lastY = scrollY;
  let lockedStop = null;
  const stopOffset = () =>
    parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
  const stopPosition = (element) =>
    Math.max(
      0,
      Math.min(
        scrollY + element.getBoundingClientRect().top - stopOffset(),
        root.scrollHeight - innerHeight,
      ),
    );
  function cancelSettle() {
    clearTimeout(settleTimer);
    cancelAnimationFrame(settleFrame);
    settleFrame = 0;
    inputPending = false;
    lastY = scrollY;
  }
  function rememberStop() {
    if (!inputPending && !settleFrame) {
      const aligned = stops.find(
        (element) => Math.abs(stopPosition(element) - scrollY) < 2,
      );
      if (aligned) lockedStop = aligned;
    }
  }
  function settleChapter() {
    if (
      !inputPending ||
      touching ||
      reducedMotion.matches ||
      menuButton.getAttribute("aria-expanded") === "true"
    )
      return;
    inputPending = false;
    const reach = Math.min(420, (innerHeight - stopOffset()) * 0.5);
    const candidates = stops
      .map((element) => ({ element, position: stopPosition(element) }))
      .filter(({ element, position }) => {
        const delta = position - scrollY;
        return (
          element !== lockedStop &&
          (direction > 0
            ? delta >= -48 && delta <= reach
            : delta <= 48 && delta >= -reach)
        );
      })
      .sort(
        (a, b) =>
          Math.abs(a.position - scrollY) - Math.abs(b.position - scrollY),
      );
    const target = candidates[0];
    if (!target) return;
    lockedStop = target.element;
    const start = scrollY;
    const end = target.position;
    const distance = Math.abs(end - start);
    if (distance < 2) return;
    const duration = Math.min(760, Math.max(480, distance * 1.6));
    const began = performance.now();
    function advance(now) {
      const progress = Math.min(1, (now - began) / duration);
      const eased =
        progress < 0.5 ? 8 * progress ** 4 : 1 - (-2 * progress + 2) ** 4 / 2;
      window.scrollTo({
        top: start + (end - start) * eased,
        behavior: "instant",
      });
      lastY = scrollY;
      settleFrame = progress < 1 ? requestAnimationFrame(advance) : 0;
    }
    settleFrame = requestAnimationFrame(advance);
  }
  function scheduleSettle() {
    clearTimeout(settleTimer);
    if (inputPending && !settleFrame)
      settleTimer = setTimeout(settleChapter, 140);
  }
  function scrollingInput(nextDirection) {
    cancelSettle();
    if (reducedMotion.matches) return;
    direction = nextDirection || direction;
    inputPending = true;
    scheduleSettle();
  }
  function onScroll() {
    scheduleTracking();
    if (!settleFrame) {
      if (inputPending && Math.abs(scrollY - lastY) > 0.5)
        direction = Math.sign(scrollY - lastY);
      lastY = scrollY;
      if (
        lockedStop &&
        Math.abs(stopPosition(lockedStop) - scrollY) >
          Math.min(180, innerHeight * 0.22)
      )
        lockedStop = null;
      rememberStop();
      scheduleSettle();
    }
  }
  window.addEventListener(
    "wheel",
    (event) => {
      if (
        event.ctrlKey ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX) ||
        event.target.closest("input, textarea, select, [contenteditable]")
      )
        return;
      scrollingInput(Math.sign(event.deltaY));
    },
    { passive: true },
  );
  window.addEventListener(
    "touchstart",
    () => {
      cancelSettle();
      touching = true;
    },
    { passive: true },
  );
  window.addEventListener(
    "touchmove",
    (event) => {
      if (!event.target.closest(".site-header")) scrollingInput(0);
    },
    { passive: true },
  );
  window.addEventListener(
    "touchend",
    () => {
      touching = false;
      scheduleSettle();
    },
    { passive: true },
  );
  window.addEventListener(
    "touchcancel",
    () => {
      touching = false;
      cancelSettle();
    },
    { passive: true },
  );
  window.addEventListener("keydown", (event) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.target.closest("input, textarea, select, button, [contenteditable]")
    )
      return;
    if (["ArrowDown", "PageDown", " "].includes(event.key))
      scrollingInput(event.shiftKey ? -1 : 1);
    else if (["ArrowUp", "PageUp"].includes(event.key)) scrollingInput(-1);
    else if (["Home", "End"].includes(event.key)) cancelSettle();
  });
  document.addEventListener("pointerdown", cancelSettle);
  document.addEventListener("click", (event) => {
    if (event.target.closest('a[href^="#"], .brand')) cancelSettle();
  });
  reducedMotion.addEventListener("change", cancelSettle);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    cancelSettle();
    trackSection();
    moveIndicator(activeLink);
  });
  rememberStop();
  window.addEventListener("pagehide", cancelSettle);
  window.addEventListener("pageshow", () => {
    cancelSettle();
    trackSection();
    rememberStop();
  });
  new ResizeObserver(() => moveIndicator(activeLink)).observe(navigation);
  document.fonts?.ready.then(() => {
    trackSection();
    moveIndicator(activeLink);
  });
  trackSection();
}

if ("IntersectionObserver" in window) {
  const visibleDividers = new Set();
  let dividerFrame = 0;
  function moveDividers() {
    dividerFrame = 0;
    for (const divider of visibleDividers) {
      const bounds = divider.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(1, (innerHeight - bounds.top) / (innerHeight + bounds.height)),
      );
      divider.style.setProperty(
        "--chapter-shift",
        `${reducedMotion.matches ? 0 : (0.5 - progress) * Math.min(100, innerWidth * 0.18)}px`,
      );
      divider.style.setProperty(
        "--chapter-fill",
        reducedMotion.matches
          ? "0"
          : Math.max(
              0,
              Math.min(1, (innerHeight - bounds.top) / (innerHeight * 0.72)),
            ).toFixed(3),
      );
    }
  }
  function scheduleDividers() {
    if (!dividerFrame) dividerFrame = requestAnimationFrame(moveDividers);
  }
  const dividers = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        entry.target.classList.toggle(
          "is-divider-active",
          entry.isIntersecting,
        );
        if (entry.isIntersecting) visibleDividers.add(entry.target);
        else visibleDividers.delete(entry.target);
      }
      scheduleDividers();
    },
    { rootMargin: "-80px 0px 0px" },
  );
  window.addEventListener("scroll", scheduleDividers, { passive: true });
  window.addEventListener("resize", scheduleDividers);
  reducedMotion.addEventListener("change", scheduleDividers);
  const chapters = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target
          .closest(".chapter-section")
          .classList.add("is-chapter-active");
        chapters.unobserve(entry.target);
      }
    },
    { rootMargin: "-12% 0px -18% 0px" },
  );
  document.querySelectorAll(".chapter-section").forEach((section) => {
    const divider = section.querySelector(".chapter-rule");
    if (divider) dividers.observe(divider);
    const title = section.querySelector("h2");
    if (title) {
      title.classList.add("chapter-title");
      chapters.observe(title.parentElement);
    }
  });
}

const countFormat = (value, decimals) =>
  value.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
function countUp(element) {
  const text = element.firstChild;
  const target = parseFloat(element.dataset.count);
  if (text?.nodeType !== Node.TEXT_NODE || !Number.isFinite(target)) return;
  const decimals = (element.dataset.count.split(".")[1] || "").length;
  const final = countFormat(target, decimals);
  if (reducedMotion.matches) return;
  const began = performance.now();
  const duration = 1600;
  function step(now) {
    const progress = Math.min(1, (now - began) / duration);
    const eased = 1 - (1 - progress) ** 4;
    text.textContent =
      progress < 1 ? countFormat(target * eased, decimals) : final;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const revealGroups = [
  ".project-card",
  ".about-intro, .about-background, .about-section .text-link",
  ".principles > div",
  ".impact-strip a",
  ".experience-row, .education, .credentials",
  ".toolkit",
  ".speaking-feature > *",
  ".summit-feature, .mentorship-intro",
  ".student-projects a",
  ".note-row",
  ".contact-grid > *",
  ".case-content section",
];
if (
  "IntersectionObserver" in window &&
  !arrivedByTransition &&
  !reducedMotion.matches
) {
  const pending = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target;
        element.classList.add("is-inview");
        element
          .querySelectorAll("[data-count]")
          .forEach((counter) => countUp(counter));
        pending.unobserve(element);
        setTimeout(
          () => {
            element.classList.remove("reveal");
            element.style.removeProperty("--reveal-delay");
          },
          parseFloat(element.style.getPropertyValue("--reveal-delay")) + 1700,
        );
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  for (const selector of revealGroups) {
    const group = [...document.querySelectorAll(selector)];
    group.forEach((element, index) => {
      const siblings = group.filter(
        (item) => item.parentElement === element.parentElement,
      );
      const order = siblings.indexOf(element);
      if (element.getBoundingClientRect().top < innerHeight * 0.92) return;
      element.style.setProperty(
        "--reveal-delay",
        `${Math.min(order >= 0 ? order : index, 5) * 90}ms`,
      );
      element.classList.add("reveal");
      pending.observe(element);
    });
  }
}

if (portraitVideo) {
  let inView = false;
  const syncVideo = () => {
    const shouldPlay = inView && !document.hidden && !reducedMotion.matches;
    portraitVideo.autoplay = shouldPlay;
    if (shouldPlay) portraitVideo.play().catch(() => {});
    else portraitVideo.pause();
  };
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        syncVideo();
      },
      { threshold: 0.15 },
    ).observe(portraitVideo);
  } else {
    inView = true;
    syncVideo();
  }
  reducedMotion.addEventListener("change", syncVideo);
  document.addEventListener("visibilitychange", syncVideo);
}

const responsiveMotion = window.matchMedia(
  "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
);

let glowFrame = 0;
let glowTarget = null;
let glowPoint = null;
document.addEventListener(
  "pointermove",
  (event) => {
    if (!responsiveMotion.matches || event.pointerType !== "mouse") return;
    const frame = event.target.closest?.(".card-frame");
    if (!frame) return;
    glowTarget = frame;
    glowPoint = [event.clientX, event.clientY];
    if (glowFrame) return;
    glowFrame = requestAnimationFrame(() => {
      glowFrame = 0;
      const bounds = glowTarget.getBoundingClientRect();
      const x = glowPoint[0] - bounds.left;
      const y = glowPoint[1] - bounds.top;
      glowTarget.style.setProperty("--glow-x", `${x}px`);
      glowTarget.style.setProperty("--glow-y", `${y}px`);
      glowTarget.style.setProperty(
        "--tilt-x",
        `${((0.5 - y / bounds.height) * 5).toFixed(2)}deg`,
      );
      glowTarget.style.setProperty(
        "--tilt-y",
        `${((x / bounds.width - 0.5) * 6).toFixed(2)}deg`,
      );
    });
  },
  { passive: true },
);
document.querySelectorAll(".card-frame").forEach((frame) =>
  frame.addEventListener("pointerleave", () => {
    frame.style.removeProperty("--tilt-x");
    frame.style.removeProperty("--tilt-y");
  }),
);

let attracted = null;
function releaseMagnet() {
  attracted?.element.style.removeProperty("translate");
  attracted = null;
}
document
  .querySelectorAll(".button, .copy-button, .nav-resume, .nav-social")
  .forEach((magnet) =>
    magnet.addEventListener("pointerenter", (event) => {
      if (
        !responsiveMotion.matches ||
        event.pointerType !== "mouse" ||
        attracted?.element === magnet
      )
        return;
      releaseMagnet();
      const bounds = magnet.getBoundingClientRect();
      const [shiftX = 0, shiftY = 0] = getComputedStyle(magnet)
        .translate.split(" ")
        .map((value) => parseFloat(value) || 0);
      attracted = {
        element: magnet,
        x: bounds.left - shiftX + bounds.width / 2,
        y: bounds.top - shiftY + bounds.height / 2,
        reachX: bounds.width / 2 + 14,
        reachY: bounds.height / 2 + 14,
      };
    }),
  );
document.addEventListener(
  "pointermove",
  (event) => {
    if (!attracted) return;
    const x = event.clientX - attracted.x;
    const y = event.clientY - attracted.y;
    if (Math.abs(x) > attracted.reachX || Math.abs(y) > attracted.reachY) {
      releaseMagnet();
      return;
    }
    const pull = (distance, limit) =>
      Math.max(-limit, Math.min(limit, distance * 0.3)).toFixed(1);
    attracted.element.style.translate = `${pull(x, 10)}px ${pull(y, 7)}px`;
  },
  { passive: true },
);
window.addEventListener("scroll", releaseMagnet, { passive: true });
root.addEventListener("pointerleave", releaseMagnet);
responsiveMotion.addEventListener("change", releaseMagnet);

let scrollQueued = false;
function updateScrollProgress() {
  const available = root.scrollHeight - window.innerHeight;
  root.style.setProperty(
    "--scroll-progress",
    String(available > 0 ? Math.min(1, window.scrollY / available) : 0),
  );
  scrollQueued = false;
}
window.addEventListener(
  "scroll",
  () => {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(updateScrollProgress);
    }
  },
  { passive: true },
);
window.addEventListener("resize", updateScrollProgress);
updateScrollProgress();

const tocLinks = [...document.querySelectorAll(".case-toc a[href^='#']")];
if (tocLinks.length && "IntersectionObserver" in window) {
  const targets = tocLinks.map((link) =>
    document.getElementById(decodeURIComponent(link.hash.slice(1))),
  );
  const visible = new Set();
  const markCurrent = () => {
    const current =
      targets.find((target) => visible.has(target)) ||
      targets.findLast(
        (target) => target && target.getBoundingClientRect().top < 140,
      ) ||
      targets[0];
    tocLinks.forEach((link, index) => {
      if (targets[index] === current) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  };
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      markCurrent();
    },
    { rootMargin: "-120px 0px -55% 0px" },
  );
  targets.forEach((target) => target && spy.observe(target));
}

const presentation = document.querySelector(".presentation-main");
if (presentation) {
  const shell = presentation.querySelector(".presentation-shell");
  const scenes = [...presentation.querySelectorAll(".scene")];
  const sceneButtons = [...presentation.querySelectorAll("[data-scene]")];
  const previous = presentation.querySelector(".scene-prev");
  const next = presentation.querySelector(".scene-next");
  const reading = presentation.querySelector(".reading-toggle");
  const stageButtons = [...presentation.querySelectorAll("[data-stage]")];
  const stagePanels = [...presentation.querySelectorAll("[data-stage-panel]")];
  const stageTrack = presentation.querySelector(".stage-track");
  const stageWires = stageTrack.querySelector(".stage-wires");
  const svgNamespace = "http://www.w3.org/2000/svg";
  const connections = stageButtons.slice(1).map(() => {
    const wire = document.createElementNS(svgNamespace, "path");
    const current = document.createElementNS(svgNamespace, "path");
    wire.classList.add("stage-wire");
    current.classList.add("stage-current");
    current.setAttribute("pathLength", "100");
    stageWires.append(wire, current);
    return { wire, current };
  });
  let stageAnimations = [];

  function stopStageCurrent() {
    stageAnimations.forEach((animation) => animation.cancel());
    stageAnimations = [];
  }

  function measureStages() {
    const track = stageTrack.getBoundingClientRect();
    if (!track.width || !track.height) return;
    stageWires.setAttribute("viewBox", `0 0 ${track.width} ${track.height}`);
    const boxes = stageButtons.map((button) => {
      const box = button.getBoundingClientRect();
      const outline = button.querySelector(".stage-outline");
      outline.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      outline.querySelectorAll("rect").forEach((rect) => {
        rect.setAttribute("x", "1");
        rect.setAttribute("y", "1");
        rect.setAttribute("width", String(box.width - 2));
        rect.setAttribute("height", String(box.height - 2));
        rect.setAttribute("rx", "9");
      });
      return {
        left: box.left - track.left,
        right: box.right - track.left,
        top: box.top - track.top,
        bottom: box.bottom - track.top,
        x: box.left - track.left + box.width / 2,
        y: box.top - track.top + box.height / 2,
      };
    });
    connections.forEach(({ wire, current }, i) => {
      const from = boxes[i];
      const to = boxes[i + 1];
      const d =
        Math.abs(from.top - to.top) < 2
          ? `M ${from.right} ${from.y} H ${to.left}`
          : `M ${from.x} ${from.bottom} V ${(from.bottom + to.top) / 2} H ${to.x} V ${to.top}`;
      wire.setAttribute("d", d);
      current.setAttribute("d", d);
    });
  }

  function sendStageCurrent(from, to) {
    stopStageCurrent();
    if (reducedMotion.matches || readAll || from === to) return;
    measureStages();
    const direction = to > from ? 1 : -1;
    stageTrack.dataset.direction = direction > 0 ? "forward" : "reverse";
    const hopDuration = 520;
    const hops = Math.abs(to - from);
    stageButtons[to].style.setProperty(
      "--charge-delay",
      `${hops * hopDuration}ms`,
    );
    for (let hop = 0; hop < hops; hop++) {
      const departure = from + hop * direction;
      const arrival = departure + direction;
      const { current } = connections[Math.min(departure, arrival)];
      stageAnimations.push(
        current.animate(
          [
            { strokeDashoffset: direction > 0 ? 28 : -100, opacity: 0 },
            { opacity: 1, offset: 0.15 },
            { opacity: 1, offset: 0.8 },
            { strokeDashoffset: direction > 0 ? -100 : 28, opacity: 0 },
          ],
          {
            duration: hopDuration,
            delay: hop * hopDuration,
            easing: "ease-in-out",
          },
        ),
        stageButtons[arrival]
          .querySelector(".stage-arrival")
          .animate(
            [{ opacity: 0 }, { opacity: 0.95, offset: 0.3 }, { opacity: 0 }],
            {
              duration: 650,
              delay: (hop + 1) * hopDuration - 70,
              easing: "ease-out",
            },
          ),
      );
    }
  }
  const stageResize = new ResizeObserver(measureStages);
  stageResize.observe(stageTrack);
  reducedMotion.addEventListener("change", stopStageCurrent);
  const hashAliases = { challenge: "problem", implementation: "build" };
  const requested = location.hash.slice(1);
  let current = Math.max(
    0,
    scenes.findIndex(
      (scene) => scene.id === (hashAliases[requested] || requested),
    ),
  );
  let stage = 0;
  let readAll = new URL(location.href).searchParams.get("view") === "all";
  let sceneAnimations = [];

  function stopSceneMotion() {
    sceneAnimations.forEach((animation) => animation.cancel());
    sceneAnimations = [];
  }

  function showStage(index) {
    presentation
      .querySelector(".architecture-scene")
      .classList.remove("is-design-selected");
    presentation
      .querySelector(".design-toggle")
      ?.setAttribute("aria-pressed", "false");
    const previousStage = stage;
    stage = index;
    stageButtons.forEach((button, i) => {
      button.style.removeProperty("--charge-delay");
      button.setAttribute("aria-pressed", String(i === index));
      button.classList.toggle("is-selected", i === index);
    });
    stagePanels.forEach((panel, i) => {
      panel.hidden = !readAll && i !== index;
    });
    connections.forEach(({ wire }, i) =>
      wire.classList.toggle("is-energized", i < index),
    );
    sendStageCurrent(previousStage, index);
  }
  function commitScene(index, { focus = false, updateUrl = true } = {}) {
    current = Math.max(0, Math.min(scenes.length - 1, index));
    scenes.forEach((scene, i) => {
      scene.hidden = !readAll && i !== current;
      scene.classList.toggle("is-active", i === current);
    });
    if (readAll || scenes[current].id !== "architecture") stopStageCurrent();
    sceneButtons.forEach((button, i) => {
      if (i === current) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    previous.disabled = current === 0;
    next.disabled = current === scenes.length - 1;
    presentation.querySelector(".scene-counter").innerHTML =
      `${String(current + 1).padStart(2, "0")} <span>/ ${String(scenes.length).padStart(2, "0")}</span>`;
    presentation.querySelector("#presentation-status").textContent =
      `${presentation.querySelector("h1").textContent}: scene ${current + 1} of ${scenes.length}, ${scenes[current].getAttribute("aria-label")}.`;
    if (updateUrl && !readAll) {
      const url = new URL(location.href);
      url.hash = scenes[current].id;
      history.replaceState(null, "", url);
    }
    if (focus)
      scenes[current]
        .querySelector(".scene-title")
        .focus({ preventScroll: true });
    if (
      !readAll &&
      shell.getBoundingClientRect().top <
        document.querySelector(".site-header").getBoundingClientRect().bottom
    )
      shell.scrollIntoView({ block: "start", behavior: "instant" });
    updateScrollProgress();
  }
  function showScene(index, options = {}) {
    const destination = Math.max(0, Math.min(scenes.length - 1, index));
    const departed = current;
    stopSceneMotion();
    commitScene(destination, options);
    if (destination === departed || readAll || reducedMotion.matches) return;
    const direction = destination > departed ? 1 : -1;
    sceneAnimations.push(
      scenes[current].animate(
        [
          {
            opacity: 0,
            transform: `translateX(${direction * 32}px)`,
            filter: "blur(4px)",
          },
          { opacity: 1, transform: "translateX(0)", filter: "blur(0)" },
        ],
        { duration: 620, easing: ease },
      ),
    );
  }
  reducedMotion.addEventListener("change", stopSceneMotion);
  function setReading(value) {
    readAll = value;
    presentation.classList.toggle("presentation-mode", !value);
    presentation.classList.toggle("reading-mode", value);
    reading.setAttribute("aria-pressed", String(value));
    reading.textContent = value ? "Presentation view" : "Read all at once";
    const url = new URL(location.href);
    if (value) url.searchParams.set("view", "all");
    else url.searchParams.delete("view");
    history.replaceState(null, "", url);
    showStage(stage);
    showScene(current, { updateUrl: false });
  }
  previous.addEventListener("click", () => showScene(current - 1));
  next.addEventListener("click", () => showScene(current + 1));
  sceneButtons.forEach((button) =>
    button.addEventListener("click", () =>
      showScene(Number(button.dataset.scene)),
    ),
  );
  stageButtons.forEach((button) =>
    button.addEventListener("click", () =>
      showStage(Number(button.dataset.stage)),
    ),
  );
  const buildButtons = [...presentation.querySelectorAll("[data-build]")];
  buildButtons.forEach((button) =>
    button.addEventListener("click", () => {
      buildButtons.forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
      presentation
        .querySelectorAll(".build-item")
        .forEach((item, index) =>
          item.classList.toggle(
            "is-build-selected",
            index === Number(button.dataset.build),
          ),
        );
    }),
  );
  const designToggle = presentation.querySelector(".design-toggle");
  designToggle?.addEventListener("click", () => {
    const selected = designToggle.getAttribute("aria-pressed") !== "true";
    designToggle.setAttribute("aria-pressed", String(selected));
    presentation
      .querySelector(".architecture-scene")
      .classList.toggle("is-design-selected", selected);
  });
  presentation.querySelectorAll(".detail-toggle").forEach((button) =>
    button.addEventListener("click", () => {
      const scene = button.closest(".scene");
      const selected = button.getAttribute("aria-pressed") !== "true";
      scene
        .querySelectorAll(".detail-toggle")
        .forEach((item) =>
          item.setAttribute(
            "aria-pressed",
            String(item === button && selected),
          ),
        );
      scene.classList.toggle("is-detail-selected", selected);
      if (button.dataset.detail)
        scene.dataset.detail = selected ? button.dataset.detail : "";
    }),
  );
  reading.addEventListener("click", () => setReading(!readAll));
  let swipe = null;
  shell.addEventListener(
    "touchstart",
    (event) => {
      swipe =
        event.touches.length === 1
          ? [event.touches[0].clientX, event.touches[0].clientY]
          : null;
    },
    { passive: true },
  );
  shell.addEventListener(
    "touchend",
    (event) => {
      if (!swipe || readAll) return;
      const dx = event.changedTouches[0].clientX - swipe[0];
      const dy = event.changedTouches[0].clientY - swipe[1];
      swipe = null;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6)
        showScene(current + (dx < 0 ? 1 : -1));
    },
    { passive: true },
  );
  document.addEventListener("keydown", (event) => {
    if (
      readAll ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey ||
      menuButton?.getAttribute("aria-expanded") === "true" ||
      event.target.closest("input,textarea,select,[contenteditable],dialog")
    )
      return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      showScene(current + (event.key === "ArrowRight" ? 1 : -1), {
        focus: true,
      });
    }
  });
  setReading(readAll);
}

const cursorTracker = document.querySelector(".cursor-tracker");
if (cursorTracker) {
  const cursorLabel = cursorTracker.querySelector(".cursor-label");
  let cursorFrame = 0;
  let cursorVisible = false;
  let currentX = 0;
  let currentY = 0;
  let targetX = 0;
  let targetY = 0;
  const hideCursor = () => {
    cursorVisible = false;
    cancelAnimationFrame(cursorFrame);
    cursorFrame = 0;
    cursorTracker.classList.remove(
      "is-visible",
      "is-link",
      "is-pressed",
      "is-view",
    );
    root.classList.remove("cursor-active");
  };
  const renderCursor = () => {
    currentX += (targetX - currentX) * 0.4;
    currentY += (targetY - currentY) * 0.4;
    cursorTracker.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
    if (Math.hypot(targetX - currentX, targetY - currentY) > 0.1)
      cursorFrame = requestAnimationFrame(renderCursor);
    else cursorFrame = 0;
  };
  document.addEventListener(
    "pointermove",
    (event) => {
      if (
        !responsiveMotion.matches ||
        event.pointerType !== "mouse" ||
        event.target.closest(
          "input, textarea, select, iframe, [contenteditable], dialog",
        )
      ) {
        hideCursor();
        return;
      }
      targetX = event.clientX;
      targetY = event.clientY;
      if (!cursorVisible) {
        currentX = targetX;
        currentY = targetY;
        cursorVisible = true;
        cursorTracker.classList.add("is-visible");
        root.classList.add("cursor-active");
      }
      cursorTracker.classList.toggle(
        "is-link",
        !!event.target.closest("a, button"),
      );
      const labelled = event.target.closest(".project-card a, .event-slides a");
      if (labelled)
        cursorLabel.textContent = labelled.closest(".project-card")
          ? "View"
          : "Open";
      cursorTracker.classList.toggle("is-view", !!labelled);
      if (!cursorFrame) cursorFrame = requestAnimationFrame(renderCursor);
    },
    { passive: true },
  );
  document.addEventListener(
    "pointerdown",
    () => cursorTracker.classList.add("is-pressed"),
    { passive: true },
  );
  document.addEventListener(
    "pointerup",
    () => cursorTracker.classList.remove("is-pressed"),
    { passive: true },
  );
  root.addEventListener("pointerleave", hideCursor);
  window.addEventListener("blur", hideCursor);
  document.addEventListener("keydown", hideCursor);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hideCursor();
  });
  responsiveMotion.addEventListener("change", hideCursor);
}

document.querySelectorAll("[data-event-gallery]").forEach((gallery) => {
  const photos = [...gallery.querySelectorAll("[data-event-photo]")];
  const buttons = [...gallery.querySelectorAll("[data-event-select]")];
  let current = 0;
  let timer = 0;
  let visible = false;
  let hovered = false;
  const showPhoto = (index, announce = true, animate = true) => {
    const previous = current;
    current = index;
    photos.forEach((photo, i) => {
      photo.getAnimations().forEach((animation) => animation.cancel());
      photo.hidden = i !== index;
      photo.setAttribute("aria-hidden", String(i !== index));
    });
    if (animate && !reducedMotion.matches && index !== previous) {
      const outgoing = photos[previous];
      outgoing.hidden = false;
      outgoing.classList.add("is-outgoing");
      const exit = outgoing.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 1100,
        easing: "ease-in-out",
      });
      photos[index].animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 1100,
        easing: "ease-in-out",
      });
      exit.finished
        .then(() => {
          if (current !== previous) outgoing.hidden = true;
          outgoing.classList.remove("is-outgoing");
        })
        .catch(() => {
          outgoing.classList.remove("is-outgoing");
        });
    }
    buttons.forEach((button, i) =>
      button.setAttribute("aria-pressed", String(i === index)),
    );
    if (announce)
      gallery.querySelector("[data-event-status]").textContent =
        `Photo ${index + 1} of ${photos.length}: ${photos[index].querySelector("img").alt}.`;
  };
  const schedule = () => {
    clearTimeout(timer);
    if (
      !visible ||
      hovered ||
      document.hidden ||
      reducedMotion.matches ||
      gallery.contains(document.activeElement)
    )
      return;
    timer = setTimeout(() => {
      showPhoto((current + 1) % photos.length, false);
      schedule();
    }, 7000);
  };
  buttons.forEach((button, index) =>
    button.addEventListener("click", () => {
      showPhoto(index);
      schedule();
    }),
  );
  gallery.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") {
      hovered = true;
      schedule();
    }
  });
  gallery.addEventListener("pointerleave", () => {
    hovered = false;
    schedule();
  });
  gallery.addEventListener("focusin", schedule);
  gallery.addEventListener("focusout", () => requestAnimationFrame(schedule));
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    },
    { threshold: 0.2 },
  ).observe(gallery);
  document.addEventListener("visibilitychange", schedule);
  reducedMotion.addEventListener("change", () => {
    showPhoto(current, false, false);
    schedule();
  });
  showPhoto(0, false, false);
});

const clocks = [
  ...[...document.querySelectorAll("[data-london-time]")].map((element) => ({
    element,
    zone: "Europe/London",
  })),
  ...[...document.querySelectorAll("[data-local-time]")].map((element) => ({
    element,
  })),
];
if (clocks.length) {
  const formats = new Map();
  const timeIn = (zone) => {
    if (!formats.has(zone))
      formats.set(
        zone,
        new Intl.DateTimeFormat("en-GB", {
          timeZone: zone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
          timeZoneName: "short",
        }),
      );
    return Object.fromEntries(
      formats
        .get(zone)
        .formatToParts(new Date())
        .map(({ type, value }) => [type, value]),
    );
  };
  const showTime = () => {
    const london = timeIn("Europe/London");
    for (const { element, zone } of clocks) {
      const time = zone ? london : timeIn();
      const colon = document.createElement("span");
      colon.className = "time-colon";
      colon.textContent = ":";
      const name = document.createElement("span");
      name.className = "time-zone";
      name.textContent = time.timeZoneName;
      element.replaceChildren(time.hour, colon, time.minute, " ", name);
      const holder = element.closest(".header-time") || element;
      if (!zone)
        holder.title = `Owen’s time in London: ${london.hour}:${london.minute} ${london.timeZoneName}`;
      holder.hidden = false;
    }
    setTimeout(showTime, 60000 - (Date.now() % 60000) + 50);
  };
  showTime();
}

document.querySelectorAll(".marquee").forEach((marquee) => {
  const track = marquee.querySelector(".marquee-track");
  const list = track.querySelector(".marquee-list");
  let measuredWidth = 0;
  function stop() {
    track
      .querySelectorAll("[data-marquee-copy]")
      .forEach((copy) => copy.remove());
    marquee.classList.remove("is-running");
    measuredWidth = 0;
  }
  function start() {
    if (reducedMotion.matches) {
      stop();
      return;
    }
    if (marquee.clientWidth === measuredWidth) return;
    stop();
    marquee.classList.add("is-running");
    const span =
      list.getBoundingClientRect().width +
      parseFloat(getComputedStyle(track).columnGap || "0");
    if (!span) {
      stop();
      return;
    }
    measuredWidth = marquee.clientWidth;
    for (
      let copies = Math.ceil(measuredWidth / span) + 1;
      copies > 0;
      copies--
    ) {
      const copy = list.cloneNode(true);
      copy.dataset.marqueeCopy = "";
      copy.setAttribute("aria-hidden", "true");
      track.append(copy);
    }
    marquee.style.setProperty("--marquee-shift", `${span}px`);
    marquee.style.setProperty(
      "--marquee-duration",
      `${(span / 36).toFixed(1)}s`,
    );
  }
  new ResizeObserver(() => requestAnimationFrame(start)).observe(marquee);
  reducedMotion.addEventListener("change", start);
  document.fonts?.ready.then(() => {
    measuredWidth = 0;
    start();
  });
  if ("IntersectionObserver" in window)
    new IntersectionObserver(([entry]) =>
      marquee.classList.toggle("is-paused", !entry.isIntersecting),
    ).observe(marquee);
});

if ("IntersectionObserver" in window) {
  const rails = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) =>
        entry.target.classList.toggle("is-lit", entry.isIntersecting),
      ),
    { rootMargin: "0px 0px -10% 0px" },
  );
  document
    .querySelectorAll(".light-rail")
    .forEach((rail) => rails.observe(rail));
} else {
  document
    .querySelectorAll(".light-rail")
    .forEach((rail) => rail.classList.add("is-lit"));
}

const heroTitle = document.querySelector(".hero h1");
if (heroTitle) {
  const lines = [...heroTitle.querySelectorAll(".line > span")];
  const text = lines.map((line) => line.textContent);
  let glyphs = [];
  let pointer = null;
  let frame = 0;
  heroTitle.setAttribute(
    "aria-label",
    text.map((line) => line.trim()).join(" "),
  );
  lines.forEach((line) =>
    line.parentElement.setAttribute("aria-hidden", "true"),
  );
  function split() {
    glyphs = lines.flatMap((line, index) => {
      const pieces = [...text[index]].map((character) => {
        const glyph = document.createElement("span");
        glyph.textContent = character;
        return { element: glyph, weight: 500 };
      });
      line.replaceChildren(...pieces.map(({ element }) => element));
      return pieces;
    });
  }
  function join() {
    lines.forEach((line, index) => (line.textContent = text[index]));
    glyphs = [];
  }
  function sway() {
    frame = 0;
    if (!glyphs.length) split();
    const centres = glyphs.map(({ element }) => {
      const box = element.getBoundingClientRect();
      return [box.left + box.width / 2, box.top + box.height / 2];
    });
    let moving = false;
    glyphs.forEach((glyph, index) => {
      const distance = pointer
        ? Math.hypot(
            centres[index][0] - pointer[0],
            (centres[index][1] - pointer[1]) * 1.4,
          )
        : Infinity;
      const pull = Math.max(0, 1 - distance / 190) ** 1.6;
      const target = 500 + pull * 300;
      glyph.weight += (target - glyph.weight) * 0.16;
      if (Math.abs(target - glyph.weight) > 0.6) moving = true;
      else glyph.weight = target;
      glyph.element.style.fontWeight = glyph.weight.toFixed(0);
    });
    if (moving) frame = requestAnimationFrame(sway);
    else if (!pointer) join();
  }
  document.addEventListener(
    "pointermove",
    (event) => {
      if (!responsiveMotion.matches || event.pointerType !== "mouse") return;
      const box = heroTitle.getBoundingClientRect();
      const near =
        event.clientX > box.left - 160 &&
        event.clientX < box.right + 160 &&
        event.clientY > box.top - 140 &&
        event.clientY < box.bottom + 140;
      pointer = near ? [event.clientX, event.clientY] : null;
      if ((near || glyphs.length) && !frame)
        frame = requestAnimationFrame(sway);
    },
    { passive: true },
  );
  root.addEventListener("pointerleave", () => {
    pointer = null;
  });
  responsiveMotion.addEventListener("change", () => {
    pointer = null;
    cancelAnimationFrame(frame);
    frame = 0;
    join();
  });
}

const noteRows = [...document.querySelectorAll(".note-row[data-preview]")];
if (noteRows.length) {
  const preview = document.createElement("div");
  preview.className = "note-preview";
  preview.setAttribute("aria-hidden", "true");
  const topic = document.createElement("span");
  topic.className = "label";
  const lead = document.createElement("p");
  const meta = document.createElement("span");
  meta.className = "note-preview-meta";
  preview.append(topic, lead, meta);
  document.body.append(preview);
  let active = null;
  let frame = 0;
  let current = [0, 0];
  let target = [0, 0];
  function place() {
    current = current.map(
      (value, index) => value + (target[index] - value) * 0.2,
    );
    preview.style.transform = `translate3d(${current[0].toFixed(1)}px, ${current[1].toFixed(1)}px, 0)`;
    frame =
      Math.hypot(target[0] - current[0], target[1] - current[1]) > 0.3
        ? requestAnimationFrame(place)
        : 0;
  }
  function aim(event) {
    const width = preview.offsetWidth;
    const height = preview.offsetHeight;
    const right = event.clientX + 28 + width < innerWidth - 16;
    target = [
      right ? event.clientX + 28 : event.clientX - 28 - width,
      Math.max(
        16,
        Math.min(innerHeight - height - 16, event.clientY - height / 2),
      ),
    ];
  }
  function hide() {
    active = null;
    preview.classList.remove("is-visible");
  }
  noteRows.forEach((row) => {
    row.addEventListener("pointerenter", (event) => {
      if (!responsiveMotion.matches || event.pointerType !== "mouse") return;
      topic.textContent = row.querySelector(".label").textContent;
      lead.textContent = row.dataset.preview;
      meta.textContent = row.dataset.previewMeta;
      aim(event);
      if (!active) {
        current = [...target];
        preview.style.transform = `translate3d(${current[0]}px, ${current[1]}px, 0)`;
      }
      active = row;
      preview.classList.add("is-visible");
    });
    row.addEventListener("pointermove", (event) => {
      if (active !== row) return;
      aim(event);
      if (!frame) frame = requestAnimationFrame(place);
    });
    row.addEventListener("pointerleave", hide);
    row.addEventListener("pointerdown", hide);
  });
  window.addEventListener("scroll", hide, { passive: true });
  responsiveMotion.addEventListener("change", hide);
}

const shortcutPanel = document.querySelector(".shortcuts");
if (shortcutPanel?.showModal) {
  const openShortcuts = () => {
    closeMenu();
    if (!shortcutPanel.open) shortcutPanel.showModal();
  };
  shortcutPanel.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    shortcutPanel.close();
  });
  shortcutPanel.addEventListener("click", (event) => {
    if (
      event.target === shortcutPanel ||
      event.target.closest(".shortcuts-close")
    )
      shortcutPanel.close();
  });
  document
    .querySelectorAll("[data-shortcuts]")
    .forEach((button) => button.addEventListener("click", openShortcuts));
  const destinations = {
    w: "#work",
    a: "#about",
    e: "#experience",
    s: "#community",
    n: "#notes",
  };
  function follow(href) {
    const link = document.createElement("a");
    link.href = href;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
  }
  let leader = 0;
  document.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.target.closest("input, textarea, select, [contenteditable]")
    )
      return;
    if (event.key === "?") {
      event.preventDefault();
      if (shortcutPanel.open) shortcutPanel.close();
      else openShortcuts();
      return;
    }
    const key = event.key.toLowerCase();
    if (leader && performance.now() - leader < 1200) {
      leader = 0;
      const hash = destinations[key];
      if (!hash && key !== "h" && key !== "p") return;
      event.preventDefault();
      shortcutPanel.close();
      if (key === "p") follow("projects.html");
      else if (key === "h")
        home
          ? window.scrollTo({
              top: 0,
              behavior: reducedMotion.matches ? "auto" : "smooth",
            })
          : follow("index.html");
      else {
        const link = navigation?.querySelector(`.nav-link[href$="${hash}"]`);
        if (link) link.click();
        else follow(`index.html${hash}`);
      }
      return;
    }
    leader = key === "g" && !event.shiftKey ? performance.now() : 0;
  });
}

const diagramDialog = document.querySelector(".diagram-dialog");
if (diagramDialog?.showModal) {
  document
    .querySelector(".diagram-open")
    ?.addEventListener("click", () => diagramDialog.showModal());
  diagramDialog.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    diagramDialog.close();
  });
  diagramDialog.addEventListener("click", (event) => {
    if (
      event.target === diagramDialog ||
      event.target.closest(".diagram-close")
    )
      diagramDialog.close();
  });
}
