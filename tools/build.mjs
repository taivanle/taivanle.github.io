import { createHash } from "node:crypto";
import { renderPresentation } from "./presentation.mjs";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docs = path.join(root, "docs");
const { projects } = JSON.parse(
  await readFile(path.join(root, "site/content.json"), "utf8"),
);
const assetVersions = Object.fromEntries(
  await Promise.all(
    ["styles.css", "app.js", "field.js"].map(async (name) => [
      name,
      createHash("sha256")
        .update(await readFile(path.join(root, "site", name)))
        .digest("hex")
        .slice(0, 12),
    ]),
  ),
);
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const arrow =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>';
const external =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 18 6M7 6h11v11"/></svg>';
const copy =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>';

function navigation(home = false) {
  const prefix = home ? "" : "index.html";
  return `<a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="header-inner wrap"><a class="brand" href="index.html" aria-label="Owen Le home"><span class="brand-mark" aria-hidden="true">OL</span><span class="brand-name">Owen Le<span class="brand-dot">.</span></span></a><button class="menu-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="navigation">Menu</button><nav class="navigation" id="navigation" aria-label="Main navigation"><a class="nav-link" href="${prefix}#work">Work</a><a class="nav-link" href="${prefix}#about">About</a><a class="nav-link" href="${prefix}#experience">Experience</a><a class="nav-link" href="${prefix}#community">Speaking</a><a class="nav-link" href="blog_homepage.html">Notes</a><a class="nav-resume" href="assets/owen-le-resume.pdf" target="_blank" rel="noopener" aria-label="View resume PDF (opens in a new tab)">Resume ${external}</a></nav></div></header>`;
}
function footer() {
  return `<footer id="contact" class="contact-section"><div class="wrap"><div class="contact-grid"><div><p class="eyebrow">HAVE SOMETHING IN MIND?</p><h2>Let’s build<br><span class="serif">something useful.</span></h2></div><div class="contact-copy"><p>Interested in applied AI, evaluation, or building a product that works in practice? I’d like to hear from you.</p><div class="email-row"><a class="email-link" href="mailto:taivan@hotmail.co.uk">taivan@hotmail.co.uk</a><button type="button" class="copy-button" data-copy-email aria-label="Copy email address">${copy}</button></div><p class="copy-status" id="copy-status" role="status"></p></div></div><div class="footer-inner"><span>© 2026 Owen Le · London, United Kingdom</span><div class="footer-links"><a href="https://www.linkedin.com/in/owen-le/" target="_blank" rel="noopener noreferrer">LinkedIn ${external}</a><a href="https://github.com/taivanle" target="_blank" rel="noopener noreferrer">GitHub ${external}</a><a href="assets/owen-le-resume.pdf" download="Owen-Le-Resume.pdf">Download resume ${arrow}</a></div></div></div></footer>`;
}
function page(
  file,
  title,
  description,
  content,
  { home = false, noindex = false } = {},
) {
  const canonical = `https://taivanle.github.io/${file === "index.html" ? "" : file}`;
  const ld = home
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: "Owen Le",
        url: canonical,
        jobTitle: "Forward Deployed / Applied AI Engineer",
        sameAs: [
          "https://github.com/taivanle",
          "https://www.linkedin.com/in/owen-le/",
        ],
        email: "mailto:taivan@hotmail.co.uk",
      }
    : {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: title,
        description,
        url: canonical,
        author: {
          "@type": "Person",
          name: "Owen Le",
          url: "https://taivanle.github.io/",
        },
      };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(title)}${home ? "" : " — Owen Le"}</title><meta name="description" content="${escape(description)}">${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${canonical}">`}<meta name="theme-color" content="#0c1c1a"><meta property="og:type" content="${home ? "website" : "article"}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="https://taivanle.github.io/assets/social-card.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Owen Le — Applied AI engineer"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><link rel="preload" href="assets/fonts/manrope-variable.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="assets/styles.css?v=${assetVersions["styles.css"]}"><script src="assets/app.js?v=${assetVersions["app.js"]}" defer></script>${home ? `<script src="assets/field.js?v=${assetVersions["field.js"]}" defer></script>` : ""}<script type="application/ld+json">${JSON.stringify(ld).replaceAll("<", "\\u003c")}</script></head><body class="${file === "projects.html" ? "projects-page" : home ? "home-page" : "content-page"}">${home ? '<canvas class="hero-field" aria-hidden="true"></canvas>' : ""}<div class="cursor-tracker" aria-hidden="true"><span class="cursor-ring"></span><span class="cursor-dot"></span><span class="cursor-caption">VIEW</span></div><div class="scroll-progress" aria-hidden="true"></div>${navigation(home)}${content}${footer()}</body></html>\n`;
}

function visual(project, index) {
  let body = "";
  let note = "ILLUSTRATIVE SYSTEM VIEW";
  switch (project.theme) {
    case "themis":
      body =
        '<div class="benchmark-window"><div class="window-top"><span>THEMIS / COST PER RUN</span><span class="window-dots"><i></i><i></i><i></i></span></div><div class="cost-row"><span>Before</span><span class="bar"></span><b>~$25</b></div><div class="cost-row is-themis"><span>Themis</span><span class="bar"></span><b>$0.33</b></div><div class="cost-result"><span>Reported benchmark improvement</span><strong>↓ 98.7%</strong></div></div>';
      note = "REPORTED EVALUATION BENCHMARK";
      break;
    case "billing":
      body =
        '<div class="invoice-window"><div class="invoice-header"><span class="tiny-dot"></span>Billacord</div><div class="invoice-line"><span>Approved contract amount</span><b>£1,200.00</b></div><div class="invoice-line"><span>Invoiced amount</span><b>£1,350.00</b></div><div class="invoice-line difference"><span>Potential difference · review required</span><b>+£150.00</b></div></div>';
      note = "ILLUSTRATIVE / SYNTHETIC AMOUNTS";
      break;
    case "controls":
      body =
        '<div class="verification-window"><div class="window-top"><span>ACTIONPROOF / VERIFIER STATES</span><span>↗</span></div><div class="verification-row"><span>Approved action verified</span><span class="result-pill result-pass">PASS</span></div><div class="verification-row"><span>Wrong target changed</span><span class="result-pill result-fail">FAIL</span></div><div class="verification-row"><span>State evidence unavailable</span><span class="result-pill result-unknown">INCONCLUSIVE</span></div></div>';
      note = "SYNTHETIC REFERENCE SCENARIOS";
      break;
  }
  return `<div class="project-visual visual-${escape(project.theme)}" aria-hidden="true"><span class="visual-index">${String(index + 1).padStart(2, "0")} / ${escape(project.name.toUpperCase())}</span>${body}<span class="visual-note">${note}</span></div>`;
}
function cards() {
  return projects
    .map(
      (p, i) =>
        `<article class="project-card" data-category="${escape(p.category)}"><a href="${p.slug}.html" aria-label="Read case study: ${escape(p.name)}"><div class="card-frame"><svg class="card-outline" viewBox="0 0 420 520" preserveAspectRatio="none" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="M12 1H408Q419 1 419 12V452Q419 463 408 463H251C240 463 236 466 230 474L198 509C192 516 185 519 177 519H12Q1 519 1 508V12Q1 1 12 1Z"/></svg><div class="card-content"><div class="card-meta"><span class="mono">${String(i + 1).padStart(2, "0")}</span><span class="card-status">${escape(p.status)}</span></div><div class="card-copy"><p class="eyebrow">${escape(p.eyebrow)}</p><h3>${escape(p.name)}</h3><p class="card-description">${escape(p.summary)}</p></div><div class="card-skills">${p.tags.map((t) => `<span>${escape(t)}</span>`).join("")}</div></div><div class="card-caption"><span>Explore project</span>${arrow}</div></div></a></article>`,
    )
    .join("");
}
function flow(p) {
  return `<div class="architecture-flow" role="list">${p.flow.map((s, i) => `<div class="flow-step" role="listitem"><span class="mono">${String(i + 1).padStart(2, "0")}</span><strong>${escape(s)}</strong></div>`).join("")}</div><p class="architecture-caption">Conceptual flow · simplified to explain the engineering approach.</p>`;
}
function casePage(p, index) {
  const next = projects[(index + 1) % projects.length];
  return renderPresentation(p, next, { arrow, external, visual, index });
}

const noteLinks = `<a class="note-row" href="create_agent.html"><span class="mono">AGENTS / PRACTICAL GUIDE</span><h3>Building an agent with watsonx Orchestrate</h3><span class="round-arrow">${arrow}</span></a><a class="note-row" href="engineering-reliable-ai.html"><span class="mono">SYSTEMS / DESIGN NOTES</span><h3>Reason, verify, deliver: the system around the model</h3><span class="round-arrow">${arrow}</span></a>`;
function article(title, lead, body, toc) {
  return `<main id="main"><header class="page-hero wrap"><a class="breadcrumb" href="blog_homepage.html">${arrow} Back to engineering notes</a><p class="eyebrow">ENGINEERING NOTES</p><h1>${title}</h1><p class="page-lead">${lead}</p><p class="article-meta">Owen Le · Updated 8 October 2026</p></header><div class="case-layout wrap"><nav class="case-toc" aria-label="Article sections"><span>IN THIS NOTE</span>${toc.map(([id, label]) => `<a href="#${id}">${label}</a>`).join("")}</nav><article class="case-content article-content">${body}</article></div></main>`;
}

await mkdir(path.join(docs, "assets"), { recursive: true });
await copyFile(
  path.join(root, "site/styles.css"),
  path.join(docs, "assets/styles.css"),
);
await copyFile(
  path.join(root, "site/app.js"),
  path.join(docs, "assets/app.js"),
);
await copyFile(
  path.join(root, "site/field.js"),
  path.join(docs, "assets/field.js"),
);
await writeFile(
  path.join(docs, "assets/favicon.svg"),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#1d3028"/><text x="32" y="42" text-anchor="middle" font-family="Georgia,serif" font-size="29" letter-spacing="-3" fill="#d5e7ae">OL</text></svg>\n',
);
const outputs = [];
async function emit(file, title, description, content, options) {
  await writeFile(
    path.join(docs, file),
    page(file, title, description, content, options),
  );
  if (!options?.noindex) outputs.push(file);
}
const home = (await readFile(path.join(root, "site/index.html"), "utf8"))
  .replaceAll("{{arrow}}", arrow)
  .replaceAll("{{external}}", external)
  .replace("{{projects}}", cards());
await emit(
  "index.html",
  "Owen Le — Forward Deployed / Applied AI Engineer",
  "Applied AI, evaluation, and enterprise engineering. Selected work by London-based engineer Owen Le, previously Aptura and IBM.",
  home,
  { home: true },
);
for (const [index, project] of projects.entries())
  await emit(
    `${project.slug}.html`,
    project.name,
    project.summary,
    casePage(project, index),
  );
await emit(
  "projects.html",
  "Selected work",
  "Case studies in applied AI, evaluation, full-stack products, and enterprise governance by Owen Le.",
  `<main id="main" class="wrap listing-page"><header class="page-hero"><p class="eyebrow">SELECTED WORK</p><h1>From idea to implementation.</h1><p class="page-lead">Professional work and independent builds, with the decisions, evidence, and scope behind each.</p></header><div class="project-grid">${cards()}</div></main>`,
);
await emit(
  "blog_homepage.html",
  "Engineering notes",
  "Practical notes on building agents, evaluation, and reliable AI systems.",
  `<main id="main" class="wrap listing-page"><header class="page-hero"><p class="eyebrow">ENGINEERING NOTES</p><h1>Thinking <span class="serif">out loud.</span></h1><p class="page-lead">Notes on building agents and the engineering that turns a model into a useful system.</p></header>${noteLinks}</main>`,
);
await emit(
  "orchestrate_simplified.html",
  "watsonx Orchestrate — Simplified",
  "A practical guide to building an agent with watsonx Orchestrate.",
  `<main id="main" class="wrap listing-page"><header class="page-hero"><a class="breadcrumb" href="blog_homepage.html">${arrow} Back to engineering notes</a><p class="eyebrow">PRACTICAL GUIDE</p><h1>watsonx Orchestrate.<br><span class="serif">Simplified.</span></h1><p class="page-lead">An engineering-first introduction to building an agent, connecting tools, and checking its behaviour.</p></header>${noteLinks.split('<a class="note-row" href="engineering-reliable-ai.html">')[0]}</main>`,
);
await emit(
  "create_agent.html",
  "Building an agent with watsonx Orchestrate",
  "Choose a build path, define a narrow task, connect tools, and evaluate your watsonx Orchestrate agent.",
  article(
    'Building an agent with<br><span class="serif">watsonx Orchestrate.</span>',
    "Start with a small task and a clear tool boundary. Build confidence through repeatable checks before expanding the agent’s scope.",
    `
<section id="build-path"><h2>Choose your build path</h2><p>IBM provides a visual agent builder and the Agent Development Kit. The ADK is a Python library and command-line tool for configuring agents on the Orchestrate platform. Use the visual path for rapid assembly and the ADK when you want configuration and custom tools in a developer workflow. <a href="https://www.ibm.com/docs/en/watsonx/watson-orchestrate/base?topic=agents-creating-adk">IBM’s ADK overview</a> explains that path.</p><p>My preference is to decide what needs to be explicit before choosing an interface: tool inputs, permitted actions, useful evidence, and the behaviour to check.</p></section>
<section id="task"><h2>Define one useful task</h2><p>A café FAQ assistant is a good starting point. Give it a small source containing opening hours and service policies, then ask it to answer only from that source. Define what it should do when an answer is missing.</p><p>Write a handful of questions first: a direct lookup, a paraphrase, an ambiguous request, and a question the source cannot answer. Those examples become the first evaluation set.</p></section>
<section id="tools"><h2>Make the tool contract explicit</h2><p>Keep retrieval behind a narrow function: a question enters; matching source content and an identifier return. If the tool queries a live service, enforce access in that service and retain enough source information to inspect the answer.</p><p>The ADK supports building and importing custom tools. Use <a href="https://www.ibm.com/docs/en/watsonx/watson-orchestrate/base?topic=building-tools">IBM’s current tool documentation</a> for supported formats and import procedures. Keep credentials in the environment’s supported connection setup.</p></section>
<section id="evaluate"><h2>Check behaviour before adding scope</h2><p>Run the same questions after each change. Inspect whether the agent used the appropriate tool, answered from the returned information, and handled missing information correctly. Record a failure separately from a missing observation.</p><p>For this FAQ example, a convincing demonstration is a correct sourced answer, an honest response to an unsupported question, and a repeatable record of both. Expand from there to larger knowledge sources or additional actions.</p><div class="design-decision"><p class="eyebrow">KEEP THE EXAMPLE SMALL</p><p>A narrow tool and a few explicit checks teach more about the system’s behaviour than a large set of untested capabilities.</p></div></section>`,
    [
      ["build-path", "Choose a build path"],
      ["task", "Define the task"],
      ["tools", "Connect tools"],
      ["evaluate", "Check behaviour"],
    ],
  ),
);
await emit(
  "engineering-reliable-ai.html",
  "Reason, verify, deliver",
  "Design notes on context, model boundaries, observable effects, and evaluation in reliable AI systems.",
  article(
    'Reason. Verify.<br><span class="serif">Deliver.</span>',
    "The engineering around the model determines whether an AI capability becomes a reliable product.",
    `
<section id="context"><h2>Give the model useful context</h2><p>Start with the information the task requires and the information the user may access. A context layer can select, rank, and assemble source material within a token budget. Preserve provenance so a later answer or failure can be traced back to the material actually supplied.</p><p>A useful baseline starts with a small, well-understood source set. Measure whether the right information reaches the model before adding retrieval complexity.</p></section>
<section id="boundary"><h2>Separate judgement from computation</h2><p>A model can propose a structured interpretation without owning every downstream decision. In Billacord, proposed commercial terms go through source review and human approval before deterministic invoice checking. In Themis, machine-checkable properties go through deterministic validation, while rubric-guided judgement handles other criteria.</p><p>The right boundary depends on the task. Make it visible so each stage can be checked independently.</p></section>
<section id="effects"><h2>Observe what actually changed</h2><p>An action returning “allowed” is an observation about a decision. It does not prove that the correct record changed. ActionProof tests the resulting ticket state against the scoped approval. If that state cannot be read, the verifier reports an inconclusive result.</p><p>This principle applies beyond agents: define the effect you need, collect the evidence, and avoid converting missing observations into a pass.</p></section>
<section id="measure"><h2>Make evaluation part of delivery</h2><p>Choose explicit criteria, representative cases, and a repeatable execution path. Disclose the sample size and test conditions with the score. Track cost and time alongside quality so improvements are useful in practice.</p><p>Themis brings these concerns together with deterministic validation, structured rubrics, and model judgement. The goal is an evaluation workflow that can be repeated and understood.</p><div class="design-decision"><p class="eyebrow">THE COMMON THREAD</p><p>Keep context, reasoning, approval, execution, and evidence as distinct responsibilities. Clear boundaries make both the product and its failures easier to understand.</p></div></section>`,
    [
      ["context", "Useful context"],
      ["boundary", "Clear boundaries"],
      ["effects", "Observable effects"],
      ["measure", "Repeatable evaluation"],
    ],
  ),
);
await emit(
  "404.html",
  "Page not found",
  "Return to Owen Le’s portfolio and selected engineering projects.",
  `<main id="main" class="wrap not-found"><p class="eyebrow" style="justify-content:center">PAGE NOT FOUND</p><h1>Wrong turn.</h1><p>This page may have moved. Find my latest projects, experience, and engineering notes on the homepage.</p><a class="button primary" href="index.html">Back to the portfolio ${arrow}</a></main>`,
  { noindex: true },
);
await writeFile(
  path.join(docs, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${outputs.map((file) => `<url><loc>https://taivanle.github.io/${file === "index.html" ? "" : file}</loc><lastmod>2026-10-08</lastmod></url>`).join("")}</urlset>\n`,
);
await writeFile(
  path.join(docs, "robots.txt"),
  "User-agent: *\nAllow: /\nSitemap: https://taivanle.github.io/sitemap.xml\n",
);
await writeFile(path.join(docs, ".nojekyll"), "");
console.log(`Built ${outputs.length + 1} pages into docs/.`);
