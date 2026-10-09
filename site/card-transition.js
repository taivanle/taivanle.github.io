(() => {
  if (window.PortfolioCardMotion) return;

  const green = "#d7f4af";
  const easing = "cubic-bezier(.22,.72,.24,1)";
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
    direction = "open",
    arrival = false,
    duration = 0,
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
      "box-sizing:border-box;isolation:isolate;" +
      `left:${source.x}px;top:${source.y}px;` +
      `width:${source.width}px;height:${source.height}px`;

    const rotor = document.createElement("div");
    rotor.className = "navigation-card-rotor";
    rotor.style.cssText =
      "position:absolute;inset:0;transform-style:preserve-3d;" +
      "transform-origin:50% 50%;pointer-events:none";

    function face(className) {
      const node = document.createElement("div");
      node.className = className;
      node.style.cssText =
        "position:absolute;inset:0;box-sizing:border-box;" +
        "backface-visibility:hidden;-webkit-backface-visibility:hidden;" +
        "pointer-events:none;overflow:hidden;border-radius:9px";
      return node;
    }
    const front = face("navigation-card-front");
    const back = face("navigation-card-back");
    back.style.cssText +=
      ";transform:rotateX(180deg);background:#10241c;" +
      "border:1px solid #78916b88;color:#e9efe6;" +
      "display:flex;flex-direction:column;justify-content:center;" +
      "padding:clamp(24px,4vw,48px);container-type:size;" +
      "box-shadow:0 24px 65px -25px #0006";

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
        transform: `scale(${source.width / width}, ${source.height / height})`,
        animation: "none",
        transition: "none",
        pointerEvents: "none",
      });
      faceNode.append(node);
      paintedFrames.push({ node, width, height, scaling: null });
      return node;
    }
    if (!mountFrame(frame, front)) {
      front.style.background = "#10241c";
      front.style.border = "1px solid #78916b88";
    }

    const title = document.createElement("div");
    title.className = "navigation-card-name";
    title.textContent = name;
    title.style.cssText =
      "font-family:Manrope,Arial,sans-serif;font-size:clamp(26px,5cqw,44px);" +
      "font-weight:500;line-height:1.15;letter-spacing:-1.2px;margin:0";
    back.append(title);

    const progress = document.createElement("div");
    progress.className = "navigation-card-progress";
    progress.style.cssText =
      "position:absolute;left:clamp(24px,4vw,48px);" +
      "right:clamp(24px,4vw,48px);bottom:clamp(24px,4vw,48px);" +
      "height:2px;background:#d7f4af24;overflow:hidden;border-radius:2px";
    const fill = document.createElement("div");
    fill.className = "navigation-card-progress-fill";
    fill.style.cssText =
      `height:100%;width:100%;background:${green};` +
      "transform-origin:left center;transform:scaleX(.15)";
    progress.append(fill);
    back.append(progress);

    for (const [vertical, horizontal] of [
      ["top", "left"],
      ["top", "right"],
      ["bottom", "left"],
      ["bottom", "right"],
    ]) {
      const corner = document.createElement("span");
      corner.style.cssText =
        "position:absolute;width:9px;height:9px;" +
        `${vertical}:12px;${horizontal}:12px;` +
        `border-${vertical}:1px solid #d7f4af66;` +
        `border-${horizontal}:1px solid #d7f4af66`;
      back.append(corner);
    }
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
      // Cancellation is part of normal navigation, including an early Escape.
      animation.finished.catch(() => {});
      return animation;
    }
    const geometry = animate(
      element,
      [
        {
          left: `${source.x}px`,
          top: `${source.y}px`,
          width: `${source.width}px`,
          height: `${source.height}px`,
        },
        {
          left: `${destination.x}px`,
          top: `${destination.y}px`,
          width: `${destination.width}px`,
          height: `${destination.height}px`,
        },
      ],
      { duration: milliseconds, easing, fill: "forwards" },
    );
    const angles =
      direction === "close"
        ? arrival
          ? [45, 0]
          : [0, -135]
        : arrival
          ? [135, 180]
          : [0, 135];
    const rotation = animate(
      rotor,
      angles.map((angle) => ({ transform: `rotateX(${angle}deg)` })),
      { duration: milliseconds, easing, fill: "forwards" },
    );
    for (const painted of paintedFrames)
      painted.scaling = animate(
        painted.node,
        [
          {
            transform: `scale(${source.width / painted.width}, ${source.height / painted.height})`,
          },
          {
            transform: `scale(${destination.width / painted.width}, ${destination.height / painted.height})`,
          },
        ],
        { duration: milliseconds, easing, fill: "forwards" },
      );
    const progressStart = arrival ? 0.48 : 0.15;
    const progressEnd = arrival ? 0.86 : 0.48;
    fill.style.transform = `scaleX(${progressStart})`;
    const loading =
      !backFrame?.html && (arrival || direction === "open")
        ? animate(
            fill,
            [
              { transform: `scaleX(${progressStart})` },
              { transform: `scaleX(${progressEnd})` },
            ],
            {
              duration: milliseconds,
              easing: "ease-out",
              fill: "forwards",
            },
          )
        : null;
    const finished = Promise.allSettled(
      [
        geometry,
        rotation,
        ...paintedFrames.map((painted) => painted.scaling),
        loading,
      ]
        .filter(Boolean)
        .map((animation) => animation.finished),
    ).then(() => {});

    function cancel() {
      if (cancelled) return;
      cancelled = true;
      for (const animation of animations) animation.cancel();
      animations.clear();
      scan?.remove();
      element.remove();
    }

    function reveal(actualFrame) {
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
        for (const painted of paintedFrames) painted.scaling?.cancel();
        Object.assign(element.style, {
          left: `${actual.x}px`,
          top: `${actual.y}px`,
          width: `${actual.width}px`,
          height: `${actual.height}px`,
        });
        for (const painted of paintedFrames)
          painted.node.style.transform = `scale(${actual.width / painted.width}, ${actual.height / painted.height})`;
        loading?.cancel();
        fill.style.transform = "scaleX(.86)";
        animate(
          fill,
          [{ transform: "scaleX(.86)" }, { transform: "scaleX(1)" }],
          {
            duration: 70,
            fill: "forwards",
            easing: "ease-out",
          },
        );

        let unveiling;
        if (direction === "close") {
          animate(actualFrame, [{ opacity: 0 }, { opacity: 1 }], {
            duration: 120,
            easing: "ease-out",
          });
          unveiling = animate(element, [{ opacity: 1 }, { opacity: 0 }], {
            duration: 120,
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
            { duration: 120, easing: "ease-out" },
          );
          unveiling = animate(
            element,
            [
              { clipPath: "inset(0% 0 0 0)" },
              { clipPath: "inset(100% 0 0 0)" },
            ],
            { duration: 120, easing: "ease-out", fill: "forwards" },
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
            { duration: 120, easing: "ease-out", fill: "forwards" },
          );
        }
        await unveiling.finished.catch(() => {});
        cancel();
      })();
      return revealing;
    }

    return { element, rotor, finished, reveal, cancel };
  }

  window.PortfolioCardMotion = { create };
})();
