const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export function renderPresentation(
  project,
  next,
  { arrow, external, visual, index },
) {
  const p = project;
  const scenes = [
    ["overview", "Overview"],
    ["problem", "The problem"],
    ["architecture", "Architecture"],
    ["build", "The build"],
    ["results", "Results"],
    ["scope", "Perspective"],
  ];
  const heading = (number, label, title) =>
    `<div class="scene-heading"><p class="eyebrow">${number} / ${label}</p><h2 class="scene-title" tabindex="-1">${escape(title)}</h2></div>`;
  return `<main id="main" class="presentation-main theme-${escape(p.theme)}">
    <div class="presentation-topbar wrap"><a class="breadcrumb" href="index.html#work">${arrow} Selected work</a><h1>${escape(p.name)}</h1><button class="reading-toggle presentation-control" type="button" aria-pressed="false">Read all at once ${external}</button></div>
    <div class="presentation-shell wrap" tabindex="0" role="region" aria-label="${escape(p.name)} project presentation">
      <div class="presentation-deck" style="view-transition-name: project-${p.slug}">
        <section class="scene intro-scene is-active" id="overview" aria-label="Overview">
          <div class="scene-intro-grid"><div>${heading("01", "THE OVERVIEW", p.title)}<p class="scene-lead">${escape(p.summary)}</p><div class="scene-tags">${p.tags.map((tag) => `<span>${escape(tag)}</span>`).join("")}</div><dl class="presentation-meta"><div><dt>ROLE</dt><dd>${escape(p.role)}</dd></div>${p.period ? `<div><dt>PERIOD</dt><dd>${escape(p.period)}</dd></div>` : ""}<div><dt>STATUS</dt><dd>${escape(p.status)}</dd></div></dl></div><div class="intro-visual">${visual(p, index)}</div></div>
        </section>
        <section class="scene problem-scene" id="problem" aria-label="The problem">
          ${heading("02", "THE PROBLEM", p.problemHeadline)}
          <div class="problem-grid"><p class="scene-lead">${escape(p.challenge)}</p><div class="focus-stack">${p.focus.map((point, i) => `<div><span class="mono">0${i + 1}</span><strong>${escape(point)}</strong><span class="focus-signal" aria-hidden="true"></span></div>`).join("")}</div></div>
          <p class="scene-footnote">The problem that shaped the engineering decisions.</p>
        </section>
        <section class="scene architecture-scene" id="architecture" aria-label="Architecture">
          ${heading("03", "THE ARCHITECTURE", "Follow the system, stage by stage.")}
          <p class="scene-subtitle presentation-control">Select a stage to explore the design.</p>
          <div class="stage-explorer">
            <div class="stage-track" role="group" aria-label="System stages"><svg class="stage-wires" aria-hidden="true" focusable="false"></svg>${p.flow.map((stage, i) => `<button type="button" class="stage-button ${i === 0 ? "is-selected" : ""}" data-stage="${i}" aria-pressed="${i === 0}" aria-controls="stage-panel-${i}"><svg class="stage-outline" aria-hidden="true" focusable="false"><rect class="stage-charge" pathLength="100"/><rect class="stage-arrival" pathLength="100"/></svg><span class="stage-number">0${i + 1}</span><strong>${escape(stage)}</strong><span class="stage-dot" aria-hidden="true"></span></button>`).join("")}</div>
            <div class="stage-panels">${p.stages.map((detail, i) => `<div class="stage-panel" id="stage-panel-${i}" data-stage-panel="${i}"><span class="mono">STAGE 0${i + 1}</span><h3>${escape(p.flow[i])}</h3><p>${escape(detail)}</p></div>`).join("")}</div>
          </div>
          <div class="presentation-decision"><span class="mono">KEY DESIGN DECISION</span><p>${escape(p.decision)}</p></div>
          <p class="scene-footnote">Conceptual flow · simplified to explain the engineering approach.</p>
        </section>
        <section class="scene build-scene" id="build" aria-label="The build">
          ${heading("04", "THE BUILD", "What I designed and implemented.")}
          <div class="build-grid">${p.approach.map((item, i) => `<div class="build-item"><span class="build-number">0${i + 1}</span><h3>${escape(p.buildLabels[i])}</h3><p>${escape(item)}</p></div>`).join("")}</div>
        </section>
        <section class="scene results-scene" id="results" aria-label="Results">
          ${heading("05", "THE EVIDENCE", p.slug === "themis" ? "A measurable change in the workflow." : "What the build demonstrates.")}
          <div class="presentation-results">${p.results.map((result, i) => `<div class="presentation-result ${p.slug === "themis" || /^\d+$/.test(result[0]) ? "" : "result-label"}"><span class="mono">0${i + 1} / ${escape(result[1].toUpperCase())}</span><strong>${escape(result[0])}</strong><p>${escape(result[2])}</p><span class="result-rule" aria-hidden="true"></span></div>`).join("")}</div>
          <div class="results-context"><span class="mono">CONTEXT MATTERS</span><p>${escape(p.slug === "themis" ? "Resume-reported outcomes for a specific evaluation benchmark. The accuracy figures describe that test set and workflow." : p.slug === "dueform" ? "A private local MVP verified with synthetic cases. Commercial outcomes and an independent live extraction baseline remain unvalidated." : "Five isolated synthetic scenarios against our own broken and corrected references. This demonstrates verification behaviour within that example.")}</p></div>
        </section>
        <section class="scene perspective-scene" id="scope" aria-label="Perspective">
          ${heading("06", "THE PERSPECTIVE", "What I take forward.")}
          <blockquote>${escape(p.reflection)}</blockquote>
          <div class="presentation-scope"><span class="mono">SCOPE & LIMITATIONS</span><p>${escape(p.scope)}</p></div>
          <div class="presentation-end"><a class="text-link" href="${next.slug}.html">Next project: ${escape(next.name)} ${arrow}</a><a class="text-link" href="assets/owen-le-resume.pdf" target="_blank" rel="noopener">View resume ${external}</a></div>
        </section>
      </div>
      <div class="presentation-navigation presentation-control"><button type="button" class="scene-prev" aria-label="Previous scene">${arrow}</button><nav class="scene-menu" aria-label="Presentation scenes">${scenes.map(([id, label], i) => `<button type="button" data-scene="${i}" aria-label="Scene ${i + 1}: ${label}" ${i === 0 ? 'aria-current="step"' : ""}><span>0${i + 1}</span><span class="scene-label">${label}</span></button>`).join("")}</nav><div class="scene-counter" aria-hidden="true">01 <span>/ 06</span></div><button type="button" class="scene-next" aria-label="Next scene">${arrow}</button></div>
      <p class="sr-only" id="presentation-status" role="status"></p>
      <p class="presentation-hint presentation-control">Your pace. No autoplay. <span>← → to navigate when the presentation is focused.</span></p>
    </div>
  </main>`;
}
