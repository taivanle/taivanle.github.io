(() => {
  if (window.PortfolioCardMotion) return;

  const green = "#d7f4af";
  const easing = "cubic-bezier(.65,0,.25,1)";
  function bounds(value, fallback = {}) {
    const number = (key, otherwise) => {
      const result = Number(value?.[key] ?? fallback[key]);
      return Number.isFinite(result) ? result : otherwise;
    };
    return {
      x: number("x", 0),
      y: number("y", 0),
      width: Math.max(1, number("width", 1)),
      height: Math.max(1, number("height", 1)),
    };
  }

  function create({
    frame,
    backFrame,
    rect,
    target,
    name = "",
    summary = "",
    index = "",
    direction = "open",
    arrival = false,
    duration = 0,
    progress: carriedProgress = 0.86,
  }) {
    const source = bounds(rect, frame);
    const destination = bounds(target, source);
    const milliseconds = Math.max(0, Number(duration) || 0);
    const animations = new Set();
    let cancelled = false;
    let revealing = null;
    let scan = null;

    const element = document.createElement("div");
    element.className = "navigation-flip-stage";
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("inert", "");
    element.style.cssText =
      "position:fixed;z-index:2147483500;pointer-events:none;" +
      "perspective:1600px;perspective-origin:50% 50%;" +
      "margin:0;padding:0;border:0;background:transparent;" +
      "box-sizing:border-box;isolation:isolate;transform-origin:top left;" +
      "will-change:transform;" +
      `left:${destination.x}px;top:${destination.y}px;` +
      `width:${destination.width}px;height:${destination.height}px`;

    const rotor = document.createElement("div");
    rotor.className = "navigation-card-rotor";
    rotor.style.cssText =
      "position:absolute;inset:0;transform-style:preserve-3d;" +
      "transform-origin:50% 50%;pointer-events:none;will-change:transform";

    function face(className) {
      const node = document.createElement("div");
      node.className = className;
      node.style.cssText =
        "position:absolute;inset:0;box-sizing:border-box;" +
        "backface-visibility:hidden;-webkit-backface-visibility:hidden;" +
        "pointer-events:none;overflow:hidden;border-radius:12px";
      return node;
    }
    const front = face("navigation-card-front");
    const back = face("navigation-card-back");
    back.style.cssText +=
      ";transform:rotateX(180deg);" +
      "background:radial-gradient(120% 90% at 0% 0%,#1b3a2d 0%,#10241c 58%);" +
      "border:1px solid #78916b8c;color:#eaf0e7;" +
      "display:flex;flex-direction:column;justify-content:center;gap:14px;" +
      "padding:clamp(24px,4vw,56px);container-type:size;" +
      "box-shadow:inset 0 1px 0 #d2edd810,0 30px 70px -28px #000a";

    const paintedFrames = [];
    function mountFrame(payload, faceNode) {
      const template = document.createElement("template");
      template.innerHTML = payload?.html || "";
      template.content
        .querySelectorAll("script,iframe,object,embed,style,link")
        .forEach((node) => node.remove());
      for (const node of template.content.querySelectorAll("*")) {
        for (const attribute of [...node.attributes])
          if (attribute.name === "id" || attribute.name.startsWith("on"))
            node.removeAttribute(attribute.name);
      }
      const node = template.content.firstElementChild;
      if (!node) return null;
      const width = Math.max(1, Number(payload?.width) || source.width);
      const height = Math.max(1, Number(payload?.height) || source.height);
      Object.assign(node.style, {
        position: "absolute",
        inset: "0 auto auto 0",
        width: `${width}px`,
        height: `${height}px`,
        minWidth: "0",
        maxWidth: "none",
        minHeight: "0",
        maxHeight: "none",
        margin: "0",
        transformOrigin: "top left",
        transform: `scale(${destination.width / width}, ${destination.height / height})`,
        animation: "none",
        transition: "none",
        pointerEvents: "none",
      });
      faceNode.append(node);
      paintedFrames.push({ node, width, height });
      return node;
    }
    if (!mountFrame(frame, front)) {
      front.style.background = "#10241c";
      front.style.border = "1px solid #78916b88";
    }

    const counting = direction === "open";
    const caption = document.createElement("div");
    caption.className = "navigation-card-caption";
    caption.textContent =
      direction === "close" ? "Closing" : "Opening case study";
    caption.style.cssText =
      "font-family:Manrope,Arial,sans-serif;font-size:11px;font-weight:600;" +
      "letter-spacing:.14em;text-transform:uppercase;color:#c0d9a7;margin:0";
    const title = document.createElement("div");
    title.className = "navigation-card-name";
    title.style.cssText =
      `font-family:Manrope,Arial,sans-serif;font-size:${Math.min(72, Math.max(30, destination.width * 0.065))}px;` +
      "font-weight:500;line-height:1.08;letter-spacing:-.04em;margin:0;" +
      "overflow:hidden;padding-bottom:.08em";
    const titleText = document.createElement("span");
    titleText.textContent = name;
    titleText.style.cssText = "display:block";
    title.append(titleText);
    back.append(caption, title);
    const details = document.createElement("p");
    details.className = "navigation-card-summary";
    details.textContent = summary;
    details.style.cssText =
      "font-family:Manrope,Arial,sans-serif;font-size:15px;line-height:1.6;" +
      "color:#a3b5a9;max-width:36ch;margin:4px 0 0";
    if (counting && summary) back.append(details);
    const numeral = document.createElement("div");
    numeral.className = "navigation-card-index";
    numeral.textContent = index;
    numeral.style.cssText =
      "position:absolute;right:clamp(24px,4vw,56px);top:50%;" +
      `margin-top:-${Math.min(240, destination.height * 0.4) * 0.55}px;` +
      `font-family:Manrope,Arial,sans-serif;font-size:${Math.min(240, destination.height * 0.4)}px;` +
      "font-weight:300;line-height:1.1;letter-spacing:-.06em;color:transparent;" +
      "-webkit-text-stroke:1px #d7f4af4d;font-variant-numeric:tabular-nums";
    if (counting && index && destination.width >= 720) back.append(numeral);

    const svgNamespace = "http://www.w3.org/2000/svg";
    const outline = document.createElementNS(svgNamespace, "svg");
    outline.setAttribute("class", "navigation-card-progress");
    outline.setAttribute(
      "viewBox",
      `0 0 ${destination.width} ${destination.height}`,
    );
    outline.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none";
    const inset = 0.75;
    const radius = 11.25;
    const right = destination.width - inset;
    const bottom = destination.height - inset;
    const edge =
      `M${inset + radius} ${inset}H${right - radius}` +
      `A${radius} ${radius} 0 0 1 ${right} ${inset + radius}V${bottom - radius}` +
      `A${radius} ${radius} 0 0 1 ${right - radius} ${bottom}H${inset + radius}` +
      `A${radius} ${radius} 0 0 1 ${inset} ${bottom - radius}V${inset + radius}` +
      `A${radius} ${radius} 0 0 1 ${inset + radius} ${inset}Z`;
    const traces = [
      ["navigation-card-progress-halo", "6", "#d7f4af2e"],
      ["navigation-card-progress-fill", "1.5", green],
    ].map(([className, width, colour]) => {
      const path = document.createElementNS(svgNamespace, "path");
      path.setAttribute("class", className);
      path.setAttribute("d", edge);
      path.setAttribute("pathLength", "100");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", colour);
      path.setAttribute("stroke-width", width);
      path.style.strokeDasharray = "100 100";
      outline.append(path);
      return path;
    });
    const fill = traces[1];
    back.append(outline);

    const status = document.createElement("div");
    status.className = "navigation-card-status";
    status.style.cssText =
      "position:absolute;left:clamp(24px,4vw,56px);right:clamp(24px,4vw,56px);" +
      "bottom:clamp(20px,3.4vw,44px);display:flex;justify-content:space-between;" +
      "align-items:baseline;font-family:Manrope,Arial,sans-serif;font-size:11px;" +
      "font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#8a9d91";
    const statusLabel = document.createElement("span");
    statusLabel.textContent = "Loading";
    const counter = document.createElement("span");
    counter.className = "navigation-card-counter";
    counter.style.cssText =
      "font-size:13px;letter-spacing:.04em;color:#d5e7ae;" +
      "font-variant-numeric:tabular-nums";
    status.append(statusLabel, counter);
    if (counting) back.append(status);

    if (backFrame?.html) {
      back.replaceChildren();
      back.style.padding = "0";
      back.style.background = "transparent";
      back.style.border = "0";
      mountFrame(backFrame, back);
    }

    rotor.append(front, back);
    element.append(rotor);
    (document.body || document.documentElement).append(element);

    function animate(node, frames, options) {
      const animation = node.animate(frames, options);
      animations.add(animation);
      animation.finished.catch(() => {});
      return animation;
    }
    const geometry = animate(
      element,
      [
        {
          transform: `translate3d(${source.x - destination.x}px,${source.y - destination.y}px,0) scale(${source.width / destination.width},${source.height / destination.height})`,
        },
        {
          transform: "translate3d(0,0,0) scale(1,1)",
        },
      ],
      { duration: milliseconds, easing, fill: "forwards" },
    );
    const angles =
      direction === "close"
        ? arrival
          ? [0, 0]
          : [0, -180]
        : arrival
          ? [180, 180]
          : [0, 180];
    const rotation = animate(
      rotor,
      angles.map((angle) => ({ transform: `rotateX(${angle}deg)` })),
      { duration: milliseconds, easing, fill: "forwards" },
    );
    const progressStart = arrival
      ? Math.max(0.86, Math.min(0.96, Number(carriedProgress) || 0.86))
      : 0;
    const progressEnd = arrival ? progressStart : 0.86;
    const dash = (value) => `${100 - value * 100}`;
    let progressRun = [];
    function setProgress(value) {
      progressRun.forEach((animation) => animation.cancel());
      progressRun = [];
      for (const path of traces) path.style.strokeDashoffset = dash(value);
    }
    function runProgress(frames, options) {
      progressRun.forEach((animation) => animation.cancel());
      progressRun = traces.map((path) =>
        animate(
          path,
          frames.map(({ value, ...frame }) => ({
            ...frame,
            strokeDashoffset: dash(value),
          })),
          options,
        ),
      );
      return progressRun[1];
    }
    setProgress(counting || arrival ? progressStart : 1);
    const loading =
      !backFrame?.html && (arrival || direction === "open")
        ? runProgress(
            arrival
              ? [{ value: progressStart }, { value: progressEnd }]
              : [
                  { value: 0 },
                  {
                    value: 0.04,
                    offset: 0.42,
                    easing: "cubic-bezier(.45,0,.25,1)",
                  },
                  { value: progressEnd },
                ],
            { duration: milliseconds, fill: "forwards" },
          )
        : null;
    const finished = Promise.allSettled(
      [geometry, rotation, loading]
        .filter(Boolean)
        .map((animation) => animation.finished),
    ).then(() => {
      if (cancelled || direction !== "open" || backFrame?.html) return;
      runProgress([{ value: progressEnd }, { value: 0.96 }], {
        duration: 2600,
        easing: "ease-out",
        fill: "forwards",
      });
    });
    if (!arrival && counting && !backFrame?.html) {
      const rise = {
        duration: milliseconds * 0.62,
        easing: "cubic-bezier(.22,1,.36,1)",
        fill: "backwards",
      };
      animate(
        titleText,
        [{ transform: "translateY(110%)" }, { transform: "none" }],
        { ...rise, delay: milliseconds * 0.38 },
      );
      animate(
        caption,
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "none" },
        ],
        { ...rise, delay: milliseconds * 0.32 },
      );
      animate(
        details,
        [
          { opacity: 0, transform: "translateY(12px)" },
          { opacity: 1, transform: "none" },
        ],
        { ...rise, delay: milliseconds * 0.46 },
      );
      animate(
        numeral,
        [
          { opacity: 0, transform: "translateX(24px)" },
          { opacity: 1, transform: "none" },
        ],
        { ...rise, delay: milliseconds * 0.4 },
      );
    }

    function progressValue(hold = false) {
      const value =
        1 - parseFloat(getComputedStyle(fill).strokeDashoffset) / 100;
      const settled = Number.isFinite(value) ? value : 1;
      if (hold) setProgress(settled);
      return settled;
    }
    let counterFrame = 0;
    function count() {
      counter.textContent = `${Math.round(progressValue() * 100)}%`;
      counterFrame = requestAnimationFrame(count);
    }
    if (counting && !backFrame?.html) count();

    function cancel() {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(counterFrame);
      for (const animation of animations) animation.cancel();
      animations.clear();
      scan?.remove();
      element.remove();
    }

    function reveal(actualFrame, showContent = () => {}) {
      if (revealing) return revealing;
      revealing = (async () => {
        await finished;
        if (cancelled) return;
        if (!actualFrame?.isConnected) {
          cancel();
          return;
        }
        const actual = bounds(actualFrame.getBoundingClientRect());
        geometry.cancel();
        Object.assign(element.style, {
          left: `${actual.x}px`,
          top: `${actual.y}px`,
          width: `${actual.width}px`,
          height: `${actual.height}px`,
          transform: "none",
        });
        for (const painted of paintedFrames)
          painted.node.style.transform = `scale(${actual.width / painted.width}, ${actual.height / painted.height})`;
        const loadedProgress = progressValue(true);
        const completed = runProgress(
          [{ value: loadedProgress }, { value: 1 }],
          {
            duration: 160,
            fill: "forwards",
            easing: "ease-out",
          },
        );
        if (direction === "open") {
          await completed.finished.catch(() => {});
          if (cancelled || !actualFrame.isConnected) return;
        }
        showContent();

        let unveiling;
        if (direction === "close") {
          animate(actualFrame, [{ opacity: 0 }, { opacity: 1 }], {
            duration: 140,
            easing: "ease-out",
          });
          unveiling = animate(element, [{ opacity: 1 }, { opacity: 0 }], {
            duration: 140,
            easing: "ease-out",
            fill: "forwards",
          });
        } else {
          animate(
            actualFrame,
            [
              { clipPath: "inset(0 0 100% 0)" },
              { clipPath: "inset(0 0 0% 0)" },
            ],
            { duration: 180, easing: "cubic-bezier(.25,.1,.25,1)" },
          );
          unveiling = animate(
            element,
            [
              { clipPath: "inset(0% 0 0 0)" },
              { clipPath: "inset(100% 0 0 0)" },
            ],
            {
              duration: 180,
              easing: "cubic-bezier(.25,.1,.25,1)",
              fill: "forwards",
            },
          );
          scan = document.createElement("div");
          scan.className = "navigation-card-scan";
          scan.setAttribute("aria-hidden", "true");
          scan.style.cssText =
            "position:fixed;z-index:2147483501;pointer-events:none;height:1px;" +
            `left:${actual.x}px;top:${actual.y}px;width:${actual.width}px;` +
            `background:${green};box-shadow:0 0 6px #d7f4af44`;
          (document.body || document.documentElement).append(scan);
          animate(
            scan,
            [
              { transform: "translateY(0px)", opacity: 0.7 },
              { transform: `translateY(${actual.height}px)`, opacity: 0 },
            ],
            {
              duration: 180,
              easing: "cubic-bezier(.25,.1,.25,1)",
              fill: "forwards",
            },
          );
        }
        await unveiling.finished.catch(() => {});
        cancel();
      })();
      return revealing;
    }

    return {
      element,
      rotor,
      finished,
      reveal,
      cancel,
      progress: progressValue,
    };
  }

  window.PortfolioCardMotion = { create };
})();
