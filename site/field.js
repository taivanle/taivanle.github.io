/* A slowly rotating signal field, drawn locally without a rendering library. */
(() => {
  const canvas = document.querySelector(".hero-field");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const host = canvas.parentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let width = 0,
    height = 0,
    frame = 0,
    last = 0,
    visible = true;
  let phase = 0;
  let pointer = { x: 0, y: 0 };
  let target = { x: 0, y: 0 };
  const tau = Math.PI * 2;

  function resize() {
    width = host.clientWidth;
    height = host.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  function draw() {
    context.clearRect(0, 0, width, height);
    const mobile = width <= 760;
    const cx = width * (mobile ? 0.65 : 0.73) + pointer.x;
    const cy = height * (mobile ? 0.68 : 0.5) + pointer.y;
    const radius = Math.min(
      mobile ? width * 0.8 : width * 0.34,
      height * 0.61,
      490,
    );
    const minor = radius * 0.24;
    const tilt = 0.62 + Math.sin(phase * 0.18) * 0.16;
    const yaw = 0.35 + phase * 0.07;
    const project = (u, v) => {
      const x = (radius + minor * Math.cos(v)) * Math.cos(u);
      const y = (radius + minor * Math.cos(v)) * Math.sin(u);
      const z = minor * Math.sin(v);
      const yy = y * Math.cos(tilt) - z * Math.sin(tilt);
      const zz = y * Math.sin(tilt) + z * Math.cos(tilt);
      const xx = x * Math.cos(yaw) + zz * Math.sin(yaw);
      const depth = -x * Math.sin(yaw) + zz * Math.cos(yaw);
      const scale = 1100 / (1100 + depth);
      return { x: cx + xx * scale, y: cy + yy * scale, depth };
    };
    context.lineWidth = 0.8;
    for (let ring = 0; ring < 26; ring++) {
      context.beginPath();
      const v = (ring / 26) * tau;
      for (let step = 0; step <= 110; step++) {
        const p = project((step / 110) * tau, v);
        if (step === 0) context.moveTo(p.x, p.y);
        else context.lineTo(p.x, p.y);
      }
      context.strokeStyle = `rgba(125, 216, 194, ${ring % 5 === 0 ? 0.3 : 0.11})`;
      context.stroke();
    }
    for (let ring = 0; ring < 64; ring++) {
      context.beginPath();
      const u = (ring / 64) * tau;
      for (let step = 0; step <= 34; step++) {
        const p = project(u, (step / 34) * tau);
        if (step === 0) context.moveTo(p.x, p.y);
        else context.lineTo(p.x, p.y);
      }
      context.strokeStyle = "rgba(101, 191, 171, .14)";
      context.stroke();
    }
    // A few continuous paths carry light around the same form.
    for (let trace = 0; trace < 3; trace++) {
      const start = phase * 0.16 + (trace * tau) / 3;
      context.beginPath();
      for (let step = 0; step <= 60; step++) {
        const p = project(start + (step / 60) * 1.1, trace * 2.1 + 0.6);
        if (step === 0) context.moveTo(p.x, p.y);
        else context.lineTo(p.x, p.y);
      }
      context.strokeStyle =
        trace === 1 ? "rgba(219, 198, 143, .7)" : "rgba(176, 244, 219, .85)";
      context.shadowColor = trace === 1 ? "#bd9c54" : "#8be9c9";
      context.shadowBlur = 14;
      context.lineWidth = 1.4;
      context.stroke();
      context.shadowBlur = 0;
    }
  }
  function animate(time) {
    if (time - last >= 32) {
      const elapsed = last ? Math.min((time - last) / 1000, 0.1) : 0;
      phase += elapsed;
      pointer.x += (target.x - pointer.x) * 0.07;
      pointer.y += (target.y - pointer.y) * 0.07;
      last = time;
      draw();
    }
    frame = requestAnimationFrame(animate);
  }
  function sync() {
    cancelAnimationFrame(frame);
    last = 0;
    if (!reduced.matches && visible && !document.hidden)
      frame = requestAnimationFrame(animate);
    else draw();
  }
  host.addEventListener(
    "pointermove",
    (event) => {
      if (reduced.matches || event.pointerType !== "mouse") return;
      const bounds = host.getBoundingClientRect();
      target = {
        x: (event.clientX / width - 0.5) * 18,
        y: ((event.clientY - bounds.top) / height - 0.5) * 14,
      };
    },
    { passive: true },
  );
  host.addEventListener("pointerleave", () => {
    target = { x: 0, y: 0 };
  });
  new ResizeObserver(resize).observe(host);
  if ("IntersectionObserver" in window)
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }).observe(host);
  reduced.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  resize();
  sync();
})();
