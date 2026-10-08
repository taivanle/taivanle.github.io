document.documentElement.classList.add("js");

const projectRoute = /\/(?:themis|dueform|actifact)\.html$/;
function previousPortfolioUrl() {
  try {
    const value =
      window.navigation?.activation?.from?.url ||
      sessionStorage.getItem("portfolio-previous-url") ||
      document.referrer;
    const url = value ? new URL(value) : null;
    return url?.origin === location.origin ? url : null;
  } catch {
    return null;
  }
}
function setReturnTransition() {
  const previous = previousPortfolioUrl();
  document.documentElement.classList.toggle(
    "project-return",
    Boolean(
      previous &&
      projectRoute.test(previous.pathname) &&
      !projectRoute.test(location.pathname),
    ),
  );
}
setReturnTransition();
window.addEventListener("pagereveal", (event) => {
  setReturnTransition();
  event.viewTransition?.finished
    .finally(() => document.documentElement.classList.remove("project-return"))
    .catch(() => {});
});
window.addEventListener("pagehide", () => {
  try {
    sessionStorage.setItem("portfolio-previous-url", location.href);
  } catch {
    /* Navigation works when session storage is unavailable. */
  }
});

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
window.matchMedia("(min-width: 761px)").addEventListener("change", closeMenu);

const filterButtons = [...document.querySelectorAll("[data-filter]")];
const projectCards = [...document.querySelectorAll("[data-category]")];
filterButtons.forEach((button) =>
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    filterButtons.forEach((item) =>
      item.setAttribute("aria-pressed", String(item === button)),
    );
    projectCards.forEach((card) => {
      card.hidden = filter !== "all" && card.dataset.category !== filter;
    });
    const count = projectCards.filter((card) => !card.hidden).length;
    document.querySelector("#filter-status").textContent =
      `${count} ${count === 1 ? "project" : "projects"} shown: ${button.textContent.trim().replace(/\s+\d+$/, "")}.`;
  }),
);

const copyButton = document.querySelector("[data-copy-email]");
copyButton?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("taivan@hotmail.co.uk");
    document.querySelector("#copy-status").textContent =
      "Email address copied.";
    copyButton.setAttribute("aria-label", "Email address copied");
    setTimeout(() => {
      document.querySelector("#copy-status").textContent = "";
      copyButton.setAttribute("aria-label", "Copy email address");
    }, 3500);
  } catch {
    document.querySelector("#copy-status").textContent =
      "Please copy this address: taivan@hotmail.co.uk";
  }
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        document.querySelectorAll('.nav-link[href^="#"]').forEach((link) => {
          if (link.getAttribute("href") === `#${entry.target.id}`)
            link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      });
    },
    { rootMargin: "-15% 0px -65% 0px" },
  );
  document
    .querySelectorAll("main > section[id]")
    .forEach((section) => observer.observe(section));
}

const portraitVideo = document.querySelector("[data-portrait-video]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
if (portraitVideo) {
  let inView = false;
  const syncVideo = () => {
    const shouldPlay = inView && !document.hidden && !reducedMotion.matches;
    portraitVideo.autoplay = shouldPlay;
    if (shouldPlay)
      portraitVideo.play().catch(() => {
        /* Keep the poster if autoplay is unavailable. */
      });
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
document
  .querySelectorAll("[data-spotlight], .project-card, .presentation-deck")
  .forEach((surface) => {
    let frame;
    surface.addEventListener(
      "pointermove",
      (event) => {
        if (!responsiveMotion.matches) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const bounds = surface.getBoundingClientRect();
          const x = event.clientX - bounds.left;
          const y = event.clientY - bounds.top;
          surface.style.setProperty("--light-x", `${x}px`);
          surface.style.setProperty("--light-y", `${y}px`);
          if (
            surface.classList.contains("portrait-panel") ||
            surface.classList.contains("project-card")
          ) {
            surface.style.setProperty(
              "--tilt-x",
              `${(0.5 - y / bounds.height) * 4}deg`,
            );
            surface.style.setProperty(
              "--tilt-y",
              `${(x / bounds.width - 0.5) * 4}deg`,
            );
          }
        });
      },
      { passive: true },
    );
    surface.addEventListener("pointerleave", () => {
      cancelAnimationFrame(frame);
      surface.style.setProperty("--tilt-x", "0deg");
      surface.style.setProperty("--tilt-y", "0deg");
    });
  });

const animatedElements = document.querySelectorAll(
  ".project-card, .principles > div, .experience-row, .note-row, .speaking-feature, .summit-feature, .mentorship-panel",
);
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-inview");
          revealObserver.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 },
  );
  animatedElements.forEach((element) => revealObserver.observe(element));
} else {
  animatedElements.forEach((element) => element.classList.add("is-inview"));
}

let scrollQueued = false;
function updateScrollProgress() {
  const available = document.documentElement.scrollHeight - window.innerHeight;
  document.documentElement.style.setProperty(
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
        rect.setAttribute("rx", "6");
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
      // At the row break, route the wire through the gap between rows.
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

  function showStage(index) {
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
  function showScene(index, { focus = false, updateUrl = true } = {}) {
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
  reading.addEventListener("click", () => setReading(!readAll));
  shell.addEventListener("keydown", (event) => {
    if (
      readAll ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.target.closest("input,textarea,select,[contenteditable]")
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

if (presentation) {
  let returning = false;
  const returnToPreviousPage = () => {
    if (returning) return;
    returning = true;
    const previous = previousPortfolioUrl();
    if (
      previous &&
      /\/(?:index\.html|projects\.html|themis\.html|dueform\.html|actifact\.html)?$/.test(
        previous.pathname,
      ) &&
      history.length > 1
    )
      history.back();
    else location.assign("index.html#work");
  };
  document.addEventListener("click", (event) => {
    if (
      event.button !== 0 ||
      event.defaultPrevented ||
      !event.detail ||
      window.getSelection()?.toString()
    )
      return;
    if (
      event.target.closest(
        ".presentation-shell, .presentation-topbar, .site-header, .contact-section, a, button",
      )
    )
      return;
    returnToPreviousPage();
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      event.target.closest("input, textarea, select, [contenteditable]")
    )
      return;
    if (menuButton?.getAttribute("aria-expanded") === "true") return;
    returnToPreviousPage();
  });
  window.addEventListener("pageshow", () => {
    returning = false;
  });
}

// A soft light follows the pointer only after mouse movement.
const cursorTracker = document.querySelector(".cursor-tracker");
if (cursorTracker) {
  let cursorFrame = 0;
  let cursorVisible = false;
  let currentX = 0,
    currentY = 0,
    targetX = 0,
    targetY = 0;
  const hideCursor = () => {
    cursorVisible = false;
    cancelAnimationFrame(cursorFrame);
    cursorFrame = 0;
    cursorTracker.classList.remove("is-visible", "is-link", "is-pressed");
    document.documentElement.classList.remove("cursor-active");
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
          "input, textarea, select, iframe, [contenteditable]",
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
        document.documentElement.classList.add("cursor-active");
      }
      cursorTracker.classList.toggle(
        "is-link",
        !!event.target.closest("a, button"),
      );
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
  document.documentElement.addEventListener("pointerleave", hideCursor);
  window.addEventListener("blur", hideCursor);
  document.addEventListener("keydown", hideCursor);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hideCursor();
  });
  responsiveMotion.addEventListener("change", hideCursor);
}

// A slow, silent slideshow, suspended during interaction and outside the viewport.
document.querySelectorAll("[data-event-gallery]").forEach((gallery) => {
  const photos = [...gallery.querySelectorAll("[data-event-photo]")];
  const buttons = [...gallery.querySelectorAll("[data-event-select]")];
  let current = 0,
    timer = 0,
    visible = false,
    hovered = false;
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
        duration: 900,
        easing: "ease-in-out",
      });
      photos[index].animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 900,
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
