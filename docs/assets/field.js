(() => {
  const canvas = document.querySelector(".hero-field");
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  const host = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const follow = "follow" in canvas.dataset;
  let width = 0,
    height = 0,
    frame = 0,
    last = 0;
  let phase = (Date.now() / 1000) % 86400;
  let pointer = { x: 0, y: 0, strength: 0 };
  let target = { x: 0, y: 0, strength: 0 };
  const tau = Math.PI * 2;
  const pointerKey = "portfolio-field-pointer";
  let seed = 7;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const dust = Array.from({ length: 260 }, () => ({
    x: random(),
    y: random(),
    depth: 0.25 + random() * 0.75,
    size: 0.6 + random() * 1.1,
    twinkle: random() * tau,
    speed: 0.25 + random() * 0.8,
    offsetX: 0,
    offsetY: 0,
    velocityX: 0,
    velocityY: 0,
  }));
  const cursor = { x: 0, y: 0, at: -Infinity, inside: false };
  const ripples = [];
  let spin = 0;
  let spinVelocity = 0;
  let lastScroll = window.scrollY;
  let step = 1;
  const beads = Array.from({ length: 8 }, (_, index) => ({
    u: random() * tau,
    v: random() * tau,
    speed: (0.035 + random() * 0.05) * (index % 3 ? 1 : -1),
  }));

  function restorePointer() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(pointerKey));
      if (!saved || Date.now() - saved.at > 15000) return;
      const valid = (value) =>
        value &&
        Number.isFinite(value.x) &&
        Math.abs(value.x) <= 1 &&
        Number.isFinite(value.y) &&
        Math.abs(value.y) <= 1 &&
        Number.isFinite(value.strength) &&
        value.strength >= 0 &&
        value.strength <= 1;
      if (valid(saved.pointer) && valid(saved.target)) {
        pointer = saved.pointer;
        target = saved.target;
      }
    } catch {}
  }
  restorePointer();
  window.addEventListener("pagehide", () => {
    if (!host.hasAttribute("data-card-transition")) return;
    try {
      sessionStorage.setItem(
        pointerKey,
        JSON.stringify({ pointer, target, at: Date.now() }),
      );
    } catch {}
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      restorePointer();
      draw();
    }
  });

  function resize() {
    width = host.clientWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  function draw() {
    context.clearRect(0, 0, width, height);
    const mobile = width <= 760;
    if (pointer.strength > 0.01) {
      const lightX = ((pointer.x + 1) / 2) * width;
      const lightY = ((pointer.y + 1) / 2) * height;
      const light = context.createRadialGradient(
        lightX,
        lightY,
        0,
        lightX,
        lightY,
        Math.max(360, Math.min(650, width * 0.55)),
      );
      light.addColorStop(0, `rgba(127, 218, 185, ${pointer.strength * 0.34})`);
      light.addColorStop(
        0.25,
        `rgba(127, 218, 185, ${pointer.strength * 0.14})`,
      );
      light.addColorStop(1, "rgba(127, 218, 185, 0)");
      context.fillStyle = light;
      context.fillRect(0, 0, width, height);
    }
    const count = Math.round(
      Math.max(70, Math.min(dust.length, (width * height) / 5200)),
    );
    const reach = 190;
    const live = cursor.inside && !reduced.matches;
    const now = performance.now();
    const near = [];
    context.fillStyle = "#b9ecd6";
    for (let index = 0; index < count; index++) {
      const mote = dust[index];
      const drift = (((mote.y - phase * 0.004 * mote.depth) % 1) + 1) % 1;
      const baseX = mote.x * width + pointer.x * mote.depth * 22;
      const baseY = drift * (height + 40) - 20 + pointer.y * mote.depth * 14;
      let x = baseX + mote.offsetX;
      let y = baseY + mote.offsetY;
      let lift = 0;
      if (live) {
        const dx = x - cursor.x;
        const dy = y - cursor.y;
        const distance = Math.hypot(dx, dy) || 1;
        if (distance < reach) {
          const force = (1 - distance / reach) ** 2 * 1.4 * step;
          mote.velocityX += (dx / distance) * force;
          mote.velocityY += (dy / distance) * force;
          lift = Math.sqrt(1 - distance / reach);
          near.push({ x, y, lift });
        }
      }
      for (const ripple of ripples) {
        const age = (now - ripple.at) / 1400;
        const dx = x - ripple.x;
        const dy = y - ripple.y;
        const distance = Math.hypot(dx, dy) || 1;
        const band = 1 - Math.abs(distance - age * ripple.reach) / 36;
        if (band > 0) {
          const force = band * (1 - age) * 2.4 * step;
          mote.velocityX += (dx / distance) * force;
          mote.velocityY += (dy / distance) * force;
          lift = Math.max(lift, band * (1 - age));
        }
      }
      mote.velocityX =
        (mote.velocityX - mote.offsetX * 0.03 * step) * 0.9 ** step;
      mote.velocityY =
        (mote.velocityY - mote.offsetY * 0.03 * step) * 0.9 ** step;
      mote.offsetX += mote.velocityX * step;
      mote.offsetY += mote.velocityY * step;
      x = baseX + mote.offsetX;
      y = baseY + mote.offsetY;
      const glow = 0.5 + 0.5 * Math.sin(phase * mote.speed + mote.twinkle);
      context.globalAlpha = Math.min(
        1,
        mote.depth * (0.2 + glow * 0.5) + lift * 0.7,
      );
      const size = mote.size + lift * 1.4;
      context.fillRect(x - size / 2, y - size / 2, size, size);
    }
    context.globalAlpha = 1;
    if (near.length > 1) {
      context.lineWidth = 0.7;
      for (let a = 0; a < near.length; a++)
        for (let b = a + 1; b < near.length; b++) {
          const gap = Math.hypot(near[a].x - near[b].x, near[a].y - near[b].y);
          if (gap > 130) continue;
          context.strokeStyle = `rgba(185, 236, 214, ${(1 - gap / 130) * Math.min(near[a].lift, near[b].lift) * 0.85})`;
          context.beginPath();
          context.moveTo(near[a].x, near[a].y);
          context.lineTo(near[b].x, near[b].y);
          context.stroke();
        }
    }
    for (let index = ripples.length - 1; index >= 0; index--) {
      const ripple = ripples[index];
      const age = (now - ripple.at) / 1400;
      if (age >= 1) {
        ripples.splice(index, 1);
        continue;
      }
      const eased = 1 - (1 - age) ** 3;
      context.strokeStyle = `rgba(213, 231, 174, ${(1 - age) * 0.55})`;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(ripple.x, ripple.y, eased * ripple.reach, 0, tau);
      context.stroke();
      context.strokeStyle = `rgba(182, 230, 203, ${(1 - age) * 0.28})`;
      context.beginPath();
      context.arc(ripple.x, ripple.y, eased * ripple.reach * 0.62, 0, tau);
      context.stroke();
    }
    const radius = follow
      ? Math.min(width * (mobile ? 0.42 : 0.2), height * 0.3, 300)
      : Math.min(
          mobile ? width * 0.6 : width * 0.25,
          height * (mobile ? 0.5 : 0.4),
          400,
        );
    const cx = follow
      ? width * (0.5 + pointer.x * 0.4)
      : width * (mobile ? 0.62 : 0.72) + pointer.x * radius * 0.13;
    const cy = follow
      ? height * (0.5 + pointer.y * 0.4)
      : height * (mobile ? 0.7 : 0.5) + pointer.y * radius * 0.09;
    const minor = radius * 0.24;
    const tilt = 0.62 + Math.sin(phase * 0.18) * 0.16 + pointer.y * 0.35;
    const yaw = 0.35 + phase * 0.07 + pointer.x * 0.48 + spin;
    const place = (x, y, z) => {
      const yy = y * Math.cos(tilt) - z * Math.sin(tilt);
      const zz = y * Math.sin(tilt) + z * Math.cos(tilt);
      const xx = x * Math.cos(yaw) + zz * Math.sin(yaw);
      const depth = -x * Math.sin(yaw) + zz * Math.cos(yaw);
      const scale = 1100 / (1100 + depth);
      return { x: cx + xx * scale, y: cy + yy * scale, depth };
    };
    const project = (u, v, major = radius, tube = minor) =>
      place(
        (major + tube * Math.cos(v)) * Math.cos(u),
        (major + tube * Math.cos(v)) * Math.sin(u),
        tube * Math.sin(v),
      );
    const nearness = (depth, reach) =>
      Math.max(0, Math.min(1, 0.5 - depth / (2 * reach)));
    const dial = radius * 1.42;
    context.lineWidth = 0.8;
    for (let tick = 0; tick < 120; tick++) {
      const u = (tick / 120) * tau;
      const major = tick % 10 === 0;
      const inner = project(u, 0, dial, 0);
      const outer = project(u, 0, dial + (major ? 18 : 7), 0);
      const light = nearness(inner.depth, dial);
      context.strokeStyle = `rgba(150, 214, 190, ${(major ? 0.26 : 0.1) + light * (major ? 0.34 : 0.16)})`;
      context.beginPath();
      context.moveTo(inner.x, inner.y);
      context.lineTo(outer.x, outer.y);
      context.stroke();
    }
    const satellite = phase * 0.09;
    context.beginPath();
    for (let step = 0; step <= 40; step++) {
      const p = project(satellite - (step / 40) * 0.9, 0, dial, 0);
      if (step === 0) context.moveTo(p.x, p.y);
      else context.lineTo(p.x, p.y);
    }
    const head = project(satellite, 0, dial, 0);
    const tail = project(satellite - 0.9, 0, dial, 0);
    const trail = context.createLinearGradient(head.x, head.y, tail.x, tail.y);
    trail.addColorStop(0, "rgba(213, 231, 174, .55)");
    trail.addColorStop(1, "rgba(213, 231, 174, 0)");
    context.strokeStyle = trail;
    context.lineWidth = 1.2;
    context.stroke();
    context.fillStyle = "#e4f1c8";
    context.shadowColor = "#d5e7ae";
    context.shadowBlur = 10;
    context.beginPath();
    context.arc(head.x, head.y, 2.2, 0, tau);
    context.fill();
    context.shadowBlur = 0;
    context.lineWidth = 0.8;
    for (let ring = 0; ring < 26; ring++) {
      context.beginPath();
      const v = (ring / 26) * tau;
      for (let step = 0; step <= 110; step++) {
        const p = project((step / 110) * tau, v);
        if (step === 0) context.moveTo(p.x, p.y);
        else context.lineTo(p.x, p.y);
      }
      context.strokeStyle = `rgba(125, 216, 194, ${ring % 5 === 0 ? 0.32 : 0.12})`;
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
      context.strokeStyle = "rgba(101, 191, 171, .15)";
      context.stroke();
    }
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
    context.shadowColor = "#8be9c9";
    for (const bead of beads) {
      const p = project(bead.u + phase * bead.speed, bead.v);
      const light = nearness(p.depth, radius + minor);
      context.globalAlpha = 0.3 + light * 0.7;
      context.fillStyle = "#d8fbe9";
      context.shadowBlur = 6 + light * 8;
      context.beginPath();
      context.arc(p.x, p.y, 1 + light * 1.6, 0, tau);
      context.fill();
    }
    context.shadowBlur = 0;
    context.globalAlpha = 1;
    if (follow) return;
    const fade = context.createLinearGradient(0, 0, width, 0);
    fade.addColorStop(
      0,
      mobile ? "rgba(0, 0, 0, .267)" : "rgba(0, 0, 0, .533)",
    );
    if (!mobile) fade.addColorStop(0.5, "rgba(0, 0, 0, .8)");
    fade.addColorStop(1, "#000");
    context.globalCompositeOperation = "destination-in";
    context.fillStyle = fade;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";
  }
  function animate(time) {
    const busy =
      time - cursor.at < 2500 ||
      ripples.length > 0 ||
      Math.abs(spinVelocity) > 0.0004;
    if (time - last >= (busy ? 0 : 32)) {
      step = last ? Math.min(3, (time - last) / 16.7) : 1;
      phase = ((performance.timeOrigin + time) / 1000) % 86400;
      const ease = 1 - 0.93 ** step;
      pointer.x += (target.x - pointer.x) * ease;
      pointer.y += (target.y - pointer.y) * ease;
      pointer.strength += (target.strength - pointer.strength) * ease;
      const scrolled = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      spinVelocity += Math.max(-40, Math.min(40, scrolled)) * 0.00022;
      spinVelocity *= 0.92 ** step;
      spin += spinVelocity * step;
      last = time;
      draw();
    }
    frame = requestAnimationFrame(animate);
  }
  function sync() {
    cancelAnimationFrame(frame);
    last = 0;
    if (reduced.matches) {
      pointer = { x: 0, y: 0, strength: 0 };
      target = { x: 0, y: 0, strength: 0 };
      ripples.length = 0;
      spinVelocity = 0;
      for (const mote of dust)
        mote.offsetX = mote.offsetY = mote.velocityX = mote.velocityY = 0;
    }
    if (!reduced.matches && !document.hidden)
      frame = requestAnimationFrame(animate);
    else draw();
  }
  host.addEventListener(
    "pointermove",
    (event) => {
      if (reduced.matches || event.pointerType !== "mouse") return;
      target = {
        x: Math.max(-1, Math.min(1, (event.clientX / width - 0.5) * 2)),
        y: Math.max(-1, Math.min(1, (event.clientY / height - 0.5) * 2)),
        strength: 1,
      };
      cursor.x = event.clientX;
      cursor.y = event.clientY;
      cursor.at = performance.now();
      cursor.inside = true;
    },
    { passive: true },
  );
  host.addEventListener(
    "pointerdown",
    (event) => {
      if (reduced.matches || !event.isPrimary) return;
      ripples.push({
        x: event.clientX,
        y: event.clientY,
        at: performance.now(),
        reach: Math.min(320, Math.max(180, width * 0.2)),
      });
      if (ripples.length > 4) ripples.shift();
    },
    { passive: true },
  );
  host.addEventListener("pointerleave", () => {
    target = { x: 0, y: 0, strength: 0 };
    cursor.inside = false;
  });
  new ResizeObserver(resize).observe(host);
  window.addEventListener("resize", resize);
  reduced.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  resize();
  sync();
})();
