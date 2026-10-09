const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function renderDiagram(diagram, name) {
  let number = 0;
  const pad = (value) => String(value).padStart(2, "0");
  const text = (value) =>
    [value].flat().filter(Boolean).map(escape).join("<br>");
  const card = (entry, index, numbered) => {
    const {
      title,
      lines = [],
      tone,
    } = Array.isArray(entry)
      ? { title: entry[0], lines: entry.slice(1) }
      : entry;
    return `<div class="diagram-item${tone ? ` tone-${escape(tone)}` : ""}">${numbered ? `<span class="diagram-step">${pad(index + 1)}</span>` : ""}<strong>${escape(title)}</strong>${lines.length ? `<span>${text(lines)}</span>` : ""}</div>`;
  };
  const group = (g) => {
    const numbered = g.title && !g.quiet;
    if (numbered) number += 1;
    const head = g.title
      ? `<header>${numbered ? `<span class="diagram-number">${pad(number)}</span>` : ""}<div><h3>${escape(g.title)}</h3>${g.subtitle ? `<p>${escape(g.subtitle)}</p>` : ""}</div></header>`
      : "";
    const body = [
      g.text ? `<p class="diagram-text">${text(g.text)}</p>` : "",
      g.items
        ? `<div class="diagram-items${g.stack ? " is-stack" : " is-row"}" style="--count:${g.items.length}">${g.items.map((item, i) => card(item, i, false)).join("")}</div>`
        : "",
      g.steps
        ? `<div class="diagram-items diagram-steps" style="--count:${g.steps.length}">${g.steps.map((item, i) => card(item, i, true)).join("")}</div>`
        : "",
      g.columns
        ? `<div class="diagram-columns${g.stackColumns ? " is-stack" : ""}" style="--count:${g.columns.length}">${g.columns.map((column) => `<div><h4>${escape(column.title)}</h4>${column.lines ? `<p>${text(column.lines)}</p>` : ""}</div>`).join("")}</div>`
        : "",
      g.points
        ? `<ul class="diagram-points${g.points.length > 4 || g.wide ? " is-wide" : ""}">${g.points.map((point) => `<li>${escape(point)}</li>`).join("")}</ul>`
        : "",
    ].join("");
    return `<section class="diagram-group tone-${escape(g.tone || "plain")}${g.dashed ? " is-dashed" : ""}${g.quiet ? " is-quiet" : ""}" style="--order:${number}">${head}${body}</section>`;
  };
  const layout = (row) => {
    const cells = [];
    row.groups.forEach((g, i) => {
      const join = i > 0 ? row.joins?.[i - 1] : null;
      if (join)
        cells.push({
          type: "join",
          between: [i - 1, i],
          join,
          width: join.label ? "minmax(84px, 100px)" : "34px",
        });
      cells.push({
        type: "group",
        index: i,
        width: `minmax(0, ${g.span || 1}fr)`,
      });
    });
    return { cells, template: cells.map((cell) => cell.width).join(" ") };
  };
  const joinCell = (join) =>
    join.spacer
      ? '<div class="diagram-join is-spacer" aria-hidden="true"></div>'
      : `<div class="diagram-join${join.both ? " is-both" : ""}${join.label ? " has-label" : ""}"><span class="diagram-join-line" aria-hidden="true"></span>${
          join.label
            ? `<span class="diagram-link-label">${[join.label]
                .flat()
                .map((word) => `<span>${escape(word)}</span>`)
                .join("")}</span>`
            : ""
        }</div>`;
  const rowMarkup = (row) => {
    const { cells, template } = layout(row);
    return `<div class="diagram-row" style="grid-template-columns:${template}">${cells.map((cell) => (cell.type === "join" ? joinCell(cell.join) : group(row.groups[cell.index]))).join("")}</div>`;
  };
  const flow = (connector, row) => {
    const label = (value) =>
      value ? `<span class="diagram-flow-label">${escape(value)}</span>` : "";
    if (!connector.drops)
      return `<div class="diagram-flow" aria-hidden="true"><span class="lane has-drop"><span class="diagram-drop${connector.both ? " is-both" : ""}"></span>${label(connector.label)}</span></div>`;
    const { cells, template } = layout(row);
    const from = connector.from;
    const bar = from !== undefined;
    const ends = connector.drops.concat(typeof from === "number" ? [from] : []);
    const low = Math.min(...ends);
    const high = Math.max(...ends);
    const lanes = cells.map((cell) => {
      const pieces = [];
      let drop = false;
      if (cell.type === "group") {
        const k = cell.index;
        if (connector.drops.includes(k)) {
          drop = true;
          pieces.push(
            `<span class="diagram-drop${bar ? " is-half" : ""}${connector.both?.includes?.(k) ? " is-both" : ""}" style="--lane:${k}"></span>`,
            label(connector.labels?.[k]),
          );
        }
        if (from === k) pieces.push('<span class="diagram-trunk"></span>');
        if (bar && k >= low && k <= high && low !== high)
          pieces.push(
            `<span class="diagram-bar ${k === low ? "bar-start" : k === high ? "bar-end" : "bar-mid"}"></span>`,
          );
      } else if (bar && cell.between[0] >= low && cell.between[1] <= high)
        pieces.push('<span class="diagram-bar bar-mid"></span>');
      return `<span class="lane${drop ? " has-drop" : ""}">${pieces.join("")}</span>`;
    });
    return `<div class="diagram-flow${bar ? " has-bar" : ""}" aria-hidden="true" style="grid-template-columns:${template}">${from === "center" ? '<span class="diagram-trunk is-center"></span>' : ""}${lanes.join("")}</div>`;
  };
  const rows = diagram.rows;
  const main = rows
    .map((entry, index) => {
      if (!entry.connector) return rowMarkup(entry);
      const target =
        entry.connector.align === "prev" ? rows[index - 1] : rows[index + 1];
      return flow(entry.connector, target);
    })
    .join("");
  const notes = diagram.notes
    ? `<aside class="diagram-notes" aria-label="Notes">${diagram.notes
        .map(
          (note) =>
            `<section class="diagram-note tone-${escape(note.tone || "plain")}"><h3>${escape(note.title)}</h3>${note.subtitle ? `<p class="diagram-note-subtitle">${escape(note.subtitle)}</p>` : ""}${note.text ? `<p>${text(note.text)}</p>` : ""}${note.points ? `<ul>${note.points.map((point) => `<li>${escape(point)}</li>`).join("")}</ul>` : ""}</section>`,
        )
        .join("")}</aside>`
    : "";
  return `<dialog class="diagram-dialog" aria-labelledby="diagram-title"><div class="diagram-head"><div><p class="label">${escape(name)} · ${escape(diagram.badge || "Architecture")}</p><h2 id="diagram-title">${escape(diagram.title)}</h2>${diagram.subtitle ? `<p class="diagram-subtitle">${escape(diagram.subtitle)}</p>` : ""}</div><button type="button" class="diagram-close" aria-label="Close architecture diagram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="diagram${notes ? " has-notes" : ""}"><div class="diagram-main">${main}</div>${notes}</div>${
    diagram.caption
      ? `<div class="diagram-caption">${[diagram.caption]
          .flat()
          .map((line) => `<p>${escape(line)}</p>`)
          .join("")}</div>`
      : ""
  }</dialog>`;
}

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
  const paragraphs = (value, className) =>
    [value]
      .flat()
      .map(
        (text) =>
          `<p${className ? ` class="${className}"` : ""}>${escape(text)}</p>`,
      )
      .join("");
  const list = (key, label, items) =>
    `<div data-detail-panel="${key}"><span class="label">${label}</span><ul>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul></div>`;
  const toggles = (controls, items) =>
    `<div class="detail-toggles">${items.map(([key, label]) => `<button class="detail-toggle" type="button" aria-pressed="false" aria-controls="${controls}" data-detail="${key}">${label} ${external}</button>`).join("")}</div>`;
  const source = (link) =>
    link
      ? `<a class="text-link scene-source" href="${escape(link.href)}" target="_blank" rel="noopener noreferrer">${escape(link.label)} ${external}</a>`
      : "";
  const numeric = /^[~+]?\d[\d.,]*\s?(%|pp)?$/;
  const heading = (number, label, title) =>
    `<div class="scene-heading"><p class="eyebrow">${number} / ${label}</p><h2 class="scene-title" tabindex="-1">${escape(title)}</h2></div>`;
  return `<main id="main" class="presentation-main theme-${escape(p.theme)}${p.details ? " has-details" : ""}">
    <div class="presentation-topbar wrap"><a class="breadcrumb" href="index.html#work">${arrow} Selected work</a><h1>${escape(p.name)}</h1><button class="reading-toggle presentation-control" type="button" aria-pressed="false">Read all at once ${external}</button></div>
    <div class="presentation-shell wrap" tabindex="0" role="region" aria-label="${escape(p.name)} project presentation">
      <div class="presentation-deck">
        <section class="scene intro-scene is-active" id="overview" aria-label="Overview">
          <div class="scene-intro-grid"><div>${heading("01", "THE OVERVIEW", p.title)}${p.overview ? `${paragraphs(p.overview[0], "scene-lead")}${paragraphs(p.overview.slice(1), "scene-detail")}` : paragraphs(p.summary, "scene-lead")}${p.contributions ? `<ul class="scene-contributions">${p.contributions.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>` : ""}<div class="scene-tags">${(p.technologies || p.tags).map((tag) => `<span>${escape(tag)}</span>`).join("")}</div><dl class="presentation-meta">${p.organisation ? `<div><dt>ORGANISATION</dt><dd>${escape(p.organisation)}</dd></div>` : ""}<div><dt>ROLE</dt><dd>${escape(p.role)}</dd></div>${p.period ? `<div><dt>PERIOD</dt><dd>${escape(p.period)}</dd></div>` : ""}<div><dt>STATUS</dt><dd>${escape(p.status)}</dd></div>${p.affiliation ? `<div><dt>PROJECT</dt><dd>${escape(p.affiliation)}</dd></div>` : ""}${p.dataset ? `<div><dt>DATASET</dt><dd>${escape(p.dataset)}</dd></div>` : ""}</dl></div><div class="intro-visual">${visual(p, index)}</div></div>
        </section>
        <section class="scene problem-scene" id="problem" aria-label="The problem">
          ${heading("02", "THE PROBLEM", p.problemHeadline)}
          <div class="problem-grid">${Array.isArray(p.challenge) ? `<div class="problem-copy">${paragraphs(p.challenge, "scene-lead")}${source(p.problemSource)}</div>` : paragraphs(p.challenge, "scene-lead")}<div class="focus-stack">${p.focus.map((point, i) => `<div><span class="label">0${i + 1}</span><strong>${escape(point)}</strong><span class="focus-signal" aria-hidden="true"></span></div>`).join("")}</div></div>
          <p class="scene-footnote">The problem that shaped the engineering decisions.</p>
        </section>
        <section class="scene architecture-scene" id="architecture" aria-label="Architecture">
          ${heading("03", "THE ARCHITECTURE", p.architectureHeadline || "Follow the system.")}${p.diagram ? `<button class="diagram-open" type="button" aria-haspopup="dialog" aria-label="Full architecture"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span>Full architecture</span></button>` : ""}
          <p class="scene-subtitle presentation-control">Select a stage to explore the design.</p>
          <div class="stage-explorer">
            <div class="stage-track" role="group" aria-label="System stages"><svg class="stage-wires" aria-hidden="true" focusable="false"></svg>${p.flow.map((stage, i) => `<button type="button" class="stage-button ${i === 0 ? "is-selected" : ""}" data-stage="${i}" aria-label="Stage ${i + 1}: ${escape(stage)}" aria-pressed="${i === 0}" aria-controls="stage-panel-${i}"><svg class="stage-outline" aria-hidden="true" focusable="false"><rect class="stage-charge" pathLength="100"/><rect class="stage-arrival" pathLength="100"/></svg><span class="stage-number">0${i + 1}</span><strong>${escape(stage)}</strong><span class="stage-dot" aria-hidden="true"></span></button>`).join("")}</div>
            ${
              p.integrations
                ? toggles("design-decision", [
                    ["decision", p.decisionToggle || "Design decision"],
                    ["integrations", "Enterprise integrations"],
                  ])
                : `<button class="design-toggle" type="button" aria-pressed="false" aria-controls="design-decision">${escape(p.decisionToggle || "Design decision")} ${external}</button>`
            }
            <div class="stage-panels">${p.stages.map((detail, i) => `<div class="stage-panel" id="stage-panel-${i}" data-stage-panel="${i}"><span class="label">STAGE 0${i + 1}</span><h3>${escape(p.flow[i])}</h3><p>${escape(detail)}</p></div>`).join("")}</div>
          </div>
          <div class="presentation-decision" id="design-decision">${p.integrations ? `<div data-detail-panel="decision"><span class="label">${escape(p.decisionLabel || "KEY DESIGN DECISION")}</span><p>${escape(p.decision)}</p></div><div data-detail-panel="integrations"><span class="label">ENTERPRISE INTEGRATIONS</span>${paragraphs(p.integrations, "")}</div>` : `<span class="label">${escape(p.decisionLabel || "KEY DESIGN DECISION")}</span><p>${escape(p.decision)}</p>`}</div>
          <p class="scene-footnote">${escape(p.architectureNote || "Conceptual flow · simplified to explain the engineering approach.")}</p>
        </section>
        <section class="scene build-scene" id="build" aria-label="The build">
          ${heading("04", "THE BUILD", p.buildHeadline || "What I designed and implemented.")}
          <div class="build-tabs" role="group" aria-label="Implementation details">${p.buildLabels.map((label, i) => `<button type="button" data-build="${i}" aria-pressed="${i === 0}" aria-controls="build-item-${i}"><span>0${i + 1}</span>${escape(label)}</button>`).join("")}</div>
          <div class="build-grid">${p.approach.map((item, i) => `<div class="build-item ${i === 0 ? "is-build-selected" : ""}" id="build-item-${i}"><span class="build-number">0${i + 1}</span><h3>${escape(p.buildLabels[i])}</h3><p>${escape(item)}</p></div>`).join("")}</div>
        </section>
        <section class="scene results-scene" id="results" aria-label="Results">
          ${heading("05", "THE EVIDENCE", p.resultsHeadline || "What the build demonstrates.")}${p.resultsSetting ? `<p class="results-setting">${escape(p.resultsSetting)}</p>` : ""}
          ${
            p.resultsScope
              ? toggles("results-context", [
                  ["context", "Context"],
                  ["scope", "Scope"],
                ])
              : `<button class="detail-toggle" type="button" aria-pressed="false" aria-controls="results-context">Context ${external}</button>`
          }
          <div class="presentation-results${p.results.length === 4 ? " is-quad" : ""}">${p.results.map((result, i) => `<div class="presentation-result ${numeric.test(result[0]) && !p.resultLabels ? "" : "result-label"}"><span class="label">0${i + 1} / ${escape(result[1].toUpperCase())}</span><strong>${escape(result[0])}</strong><p>${escape(result[2])}</p><span class="result-rule" aria-hidden="true"></span></div>`).join("")}</div>
          <div class="results-context" id="results-context"><span class="label">CONTEXT MATTERS</span>${p.resultsScope ? `<div data-detail-panel="context">${paragraphs(p.context, "")}</div><div data-detail-panel="scope">${paragraphs(p.resultsScope, "")}${source(p.source)}</div>` : `${paragraphs(p.context, "")}${source(p.source)}`}</div>
        </section>
        <section class="scene perspective-scene" id="scope" aria-label="Perspective">
          ${heading("06", "THE PERSPECTIVE", p.perspectiveHeadline || "What I take forward.")}
          ${
            p.limitations
              ? toggles("project-scope", [
                  ["limitations", "Limitations"],
                  ["next", "Next steps"],
                ])
              : p.scope || p.nextSteps
                ? `<button class="detail-toggle" type="button" aria-pressed="false" aria-controls="project-scope">${p.scope ? "Scope &amp; limitations" : "Next steps"} ${external}</button>`
                : ""
          }
          <blockquote>${Array.isArray(p.reflection) ? paragraphs(p.reflection, "") : escape(p.reflection)}</blockquote>
          ${p.scope || p.limitations || p.nextSteps ? `<div class="presentation-scope" id="project-scope"><span class="label">${p.scope || p.limitations ? "SCOPE & LIMITATIONS" : "PROPOSED NEXT STEPS"}</span>${p.scope ? `<p>${escape(p.scope)}</p>` : ""}${p.limitations ? `<div class="scope-lists">${list("limitations", "CURRENT LIMITATIONS", p.limitations)}${list("next", "NEXT STEPS", p.nextSteps)}</div>` : p.nextSteps ? `<ul class="scope-steps">${p.nextSteps.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>` : ""}</div>` : ""}${p.closing ? `<p class="presentation-closing">${escape(p.closing)}</p>` : ""}
          <div class="presentation-end"><a class="text-link" href="${next.slug}.html">Next project: ${escape(next.name)} ${arrow}</a><a class="text-link" href="assets/owen-le-resume.pdf" target="_blank" rel="noopener">View resume ${external}</a>${source(p.problemSource || p.source)}</div>
        </section>
      </div>
      <div class="presentation-navigation presentation-control"><button type="button" class="scene-prev" aria-label="Previous scene">${arrow}</button><nav class="scene-menu" aria-label="Presentation scenes">${scenes.map(([id, label], i) => `<button type="button" data-scene="${i}" aria-label="Scene ${i + 1}: ${label}" ${i === 0 ? 'aria-current="step"' : ""}><span>0${i + 1}</span><span class="scene-label">${label}</span></button>`).join("")}</nav><div class="scene-counter" aria-hidden="true">01 <span>/ 06</span></div><button type="button" class="scene-next" aria-label="Next scene">${arrow}</button></div>
      <p class="sr-only" id="presentation-status" role="status"></p>
      <p class="presentation-hint presentation-control"><span class="hint-keys">Use ← → to move between scenes · Esc to return</span><span class="hint-touch">Swipe to move between scenes</span></p>
    </div>
  </main>${p.diagram ? renderDiagram(p.diagram, p.name) : ""}`;
}
