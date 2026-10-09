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
const navigationScript = await readFile(
  path.join(root, "site/navigation.js"),
  "utf8",
);
const cardTransitionScript = await readFile(
  path.join(root, "site/card-transition.js"),
  "utf8",
);
const fieldScript = await readFile(path.join(root, "site/field.js"), "utf8");
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
const linkedin =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';
const github =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.838 1.236 1.838 1.236 1.071 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.605-2.665-.3-5.466-1.334-5.466-5.93 0-1.312.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.52 11.52 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.771.841 1.235 1.912 1.235 3.221 0 4.609-2.804 5.625-5.475 5.922.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .322.216.694.825.576C20.565 22.093 24 17.593 24 12.297c0-6.627-5.373-12-12-12z"/></svg>';

const railPath = "M0 32H92L120 4H1200";
const lightRail = (extra = "") =>
  `<svg class="light-rail${extra}" viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true"><path class="rail-line" pathLength="1" d="${railPath}"/><path class="rail-current rail-halo" pathLength="100" d="${railPath}"/><path class="rail-current rail-core" pathLength="100" d="${railPath}"/></svg>`;
const shortcutRow = (keys, label) =>
  `<div><dt>${keys.map((key) => `<kbd>${key}</kbd>`).join("")}</dt><dd>${label}</dd></div>`;
const shortcuts = (presentation) =>
  `<dialog class="shortcuts" aria-labelledby="shortcuts-title"><div class="shortcuts-head"><h2 id="shortcuts-title">Keyboard shortcuts</h2><button type="button" class="shortcuts-close" aria-label="Close shortcuts"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><dl>${[
    ...(presentation
      ? [
          [["←", "→"], "Move between scenes"],
          [["Esc"], "Back to the previous page"],
        ]
      : []),
    [["G", "W"], "Work"],
    [["G", "A"], "About"],
    [["G", "E"], "Experience"],
    [["G", "S"], "Speaking"],
    [["G", "N"], "Notes"],
    [["G", "P"], "All projects"],
    [["G", "H"], "Home"],
    [["?"], "Show or hide this panel"],
  ]
    .map(([keys, label]) => shortcutRow(keys, label))
    .join("")}</dl></dialog>`;

const chapters = [
  ["work", "Work"],
  ["about", "About"],
  ["experience", "Experience"],
  ["community", "Speaking"],
  ["notes", "Notes"],
];

function navigation(home = false) {
  const prefix = home ? "" : "index.html";
  return `<a class="skip-link" href="#main">Skip to content</a><header class="site-header"><div class="header-inner wrap"><a class="brand" href="index.html" aria-label="Owen Le home"><span class="brand-mark" aria-hidden="true">OL</span><span class="brand-name">Owen Le</span></a><span class="header-time" hidden><span class="header-time-label">Your time</span> <span data-local-time></span></span><button class="menu-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="navigation">Menu</button><nav class="navigation" id="navigation" aria-label="Main navigation"><span class="nav-indicator" aria-hidden="true"></span>${chapters.map(([hash, label]) => `<a class="nav-link" href="${prefix}#${hash}">${label}</a>`).join("")}<div class="header-actions"><a class="nav-resume" href="assets/owen-le-resume.pdf" target="_blank" rel="noopener" aria-label="View resume PDF (opens in a new tab)">Resume ${external}</a><a class="nav-social" href="https://www.linkedin.com/in/owen-le/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn profile (opens in a new tab)" title="LinkedIn">${linkedin}</a><a class="nav-social" href="https://github.com/taivanle" target="_blank" rel="noopener noreferrer" aria-label="GitHub profile (opens in a new tab)" title="GitHub">${github}</a></div></nav></div></header>`;
}
function footer() {
  return `<footer id="contact" class="contact-section"><div class="wrap"><div class="contact-grid"><div><p class="eyebrow">Have something in mind?</p><h2>Let’s build<br><span class="soft">something useful.</span></h2>${lightRail(" contact-rail")}</div><div class="contact-copy"><p>Interested in applied AI, evaluation, or building a product that works in practice? I’d like to hear from you.</p><div class="email-row"><a class="email-link" href="mailto:taivan@hotmail.co.uk">taivan@hotmail.co.uk</a><button type="button" class="copy-button" data-copy-email aria-label="Copy email address">${copy}</button></div><p class="copy-status" id="copy-status" role="status"></p></div></div><div class="footer-inner"><span>© 2026 Owen Le · London, United Kingdom<span class="footer-time" data-london-time hidden></span></span><button type="button" class="shortcut-hint" data-shortcuts>Press <kbd>?</kbd> for shortcuts</button><div class="footer-links"><a href="https://www.linkedin.com/in/owen-le/" target="_blank" rel="noopener noreferrer">LinkedIn ${external}</a><a href="https://github.com/taivanle" target="_blank" rel="noopener noreferrer">GitHub ${external}</a><a href="assets/owen-le-resume.pdf" download="Owen-Le-Resume.pdf">Download resume ${arrow}</a></div></div></div></footer>`;
}
function page(
  file,
  title,
  description,
  content,
  { home = false, noindex = false } = {},
) {
  const isPresentation = projects.some(
    (project) => file === `${project.slug}.html`,
  );
  const missing = file === "404.html";
  const ambient = home || isPresentation || file === "projects.html" || missing;
  const bodyClass = `${home ? "home-page" : isPresentation ? "presentation-page" : file === "projects.html" ? "projects-page" : "content-page"}${ambient ? " ambient-page" : ""}`;
  const foreground = [
    "body>main",
    "body>.site-header",
    "body>.contact-section",
    "body>.scroll-progress",
    "body>.chapter-rail",
  ];
  const held = foreground
    .map((selector) => `html[data-card-transition] ${selector}`)
    .join(",");
  const criticalStyle = `<style>html{--page-background:#0c1c1a;background:#0c1c1a;color-scheme:dark}body{background:#0c1c1a}.hero-field{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;transition:opacity 400ms ease}${foreground.join(",")}{transition:filter 420ms cubic-bezier(.33,1,.68,1)}${held}{filter:blur(12px) brightness(.42);pointer-events:none;transition:filter 520ms cubic-bezier(.22,1,.36,1)}html[data-card-transition] .hero-field{opacity:.62!important;filter:none!important}html[data-page-transition="entering"]:not([data-cover-ready]):not([data-card-transition])::before{content:"";position:fixed;inset:0;z-index:2147483600;background:#0c1c1a;pointer-events:none}@view-transition{navigation:none}@media(prefers-reduced-motion:reduce){.hero-field,${foreground.join(",")}{transition:none!important}}</style>`;
  const intro = home
    ? `<script>(()=>{try{const root=document.documentElement;if(root.dataset.pageTransition||location.hash||matchMedia("(prefers-reduced-motion: reduce)").matches||sessionStorage.getItem("portfolio-intro"))return;sessionStorage.setItem("portfolio-intro","1");root.dataset.intro=""}catch{}})()</script>`
    : "";
  const veil = home
    ? `<div class="intro-veil" aria-hidden="true"><div class="intro-mark"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" pathLength="100"/><text x="32" y="40" text-anchor="middle">OL</text></svg><span class="intro-progress"></span><span class="intro-name">Owen Le</span></div></div>`
    : "";
  const rail = home
    ? `<div class="chapter-rail" aria-hidden="true">${chapters.map(([hash, label], index) => `<a href="#${hash}" tabindex="-1"><span>${String(index + 1).padStart(2, "0")}</span><em>${label}</em></a>`).join("")}</div>`
    : "";
  const canonical = `https://taivanle.github.io/${file === "index.html" ? "" : file}`;
  const ld = home
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: "Owen Le",
        url: canonical,
        jobTitle: [
          "Forward Deployed Engineer",
          "Applied AI Engineer",
          "Member of Technical Staff",
        ],
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
<html lang="en" data-project-routes="${escape(projects.map((project) => `${project.slug}.html`).join(" "))}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${criticalStyle}<script>${cardTransitionScript}</script><script>${navigationScript}</script>${intro}<meta name="color-scheme" content="dark"><title>${escape(title)}${home ? "" : " — Owen Le"}</title><meta name="description" content="${escape(description)}">${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${canonical}">`}<meta name="theme-color" content="#0c1c1a"><meta property="og:type" content="${home ? "website" : "article"}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="https://taivanle.github.io/assets/social-card.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Owen Le — Applied AI Engineer"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><link rel="preload" href="assets/fonts/manrope-variable.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="assets/styles.css?v=${assetVersions["styles.css"]}"><script src="assets/app.js?v=${assetVersions["app.js"]}" defer></script><script type="application/ld+json">${JSON.stringify(ld).replaceAll("<", "\\u003c")}</script></head><body class="${bodyClass}">${veil}${ambient ? `<canvas class="hero-field" aria-hidden="true"${missing ? " data-follow" : ""}></canvas><script>${fieldScript}</script>` : ""}<div class="cursor-tracker" aria-hidden="true"><span class="cursor-label">View</span></div><div class="scroll-progress" aria-hidden="true"></div>${navigation(home)}${rail}${content}${isPresentation ? "" : footer()}${shortcuts(isPresentation)}</body></html>\n`;
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
        '<div class="invoice-window"><div class="invoice-header"><span class="tiny-dot"></span>DueForm</div><div class="invoice-line"><span>Approved contract amount</span><b>£1,200.00</b></div><div class="invoice-line"><span>Invoiced amount</span><b>£1,350.00</b></div><div class="invoice-line difference"><span>Potential difference · review required</span><b>+£150.00</b></div></div>';
      note = "ILLUSTRATIVE / SYNTHETIC AMOUNTS";
      break;
    case "rag":
      body =
        '<div class="verification-window"><div class="window-top"><span>DOCUMENT QUERY / ONE QUESTION</span><span class="window-dots"><i></i><i></i><i></i></span></div><div class="verification-row"><span>Question and source material</span><span class="result-pill result-pass">RECEIVED</span></div><div class="verification-row"><span>Relevant document content</span><span class="result-pill result-pass">RETRIEVED</span></div><div class="verification-row"><span>Response with retrieved context</span><span class="result-pill result-pass">GENERATED</span></div><div class="verification-row"><span>Behaviour and output</span><span class="result-pill result-unknown">EVALUATED</span></div></div>';
      break;
    case "governance":
      body =
        '<div class="verification-window"><div class="window-top"><span>GOVERNANCE / LIFECYCLE GATE</span><span class="window-dots"><i></i><i></i><i></i></span></div><div class="verification-row"><span>Risk tier assigned</span><span class="result-pill result-pass">CLASSIFIED</span></div><div class="verification-row"><span>Required evidence</span><span class="result-pill result-unknown">REQUESTED</span></div><div class="verification-row"><span>Approval checkpoint</span><span class="result-pill result-unknown">IN REVIEW</span></div><div class="verification-row"><span>Skip to approval</span><span class="result-pill result-fail">BLOCKED</span></div></div>';
      break;
    case "conversation":
      body =
        '<div class="verification-window conversation-window"><div class="window-top"><span>CONVFINQA / ONE TURN</span><span class="window-dots"><i></i><i></i><i></i></span></div><div class="verification-row"><span>Conversation history</span><span class="result-pill result-pass">CARRIED</span></div><div class="verification-row"><span>Structured response</span><span class="result-pill result-pass">VALIDATED</span></div><div class="verification-row"><span>Restricted arithmetic</span><span class="result-pill result-pass">COMPUTED</span></div><div class="verification-row"><span>Unsupported question</span><span class="result-pill result-unknown">ABSTAIN</span></div></div>';
      break;
    case "controls":
      body =
        '<div class="verification-window"><div class="window-top"><span>ACTIFACT / VERIFIER STATES</span><span>↗</span></div><div class="verification-row"><span>Approved action verified</span><span class="result-pill result-pass">PASS</span></div><div class="verification-row"><span>Wrong target changed</span><span class="result-pill result-fail">FAIL</span></div><div class="verification-row"><span>State evidence unavailable</span><span class="result-pill result-unknown">INCONCLUSIVE</span></div></div>';
      note = "SYNTHETIC REFERENCE SCENARIOS";
      break;
  }
  return `<div class="project-visual visual-${escape(project.theme)}" aria-hidden="true"><span class="visual-index">${String(index + 1).padStart(2, "0")} / ${escape(project.name.toUpperCase())}</span>${body}<span class="visual-note">${note}</span></div>`;
}
function cards() {
  return projects
    .map(
      (p, i) =>
        `<article class="project-card" data-category="${escape(p.category)}"><a href="${p.slug}.html" aria-label="Read case study: ${escape(p.name)}"><div class="card-frame" data-project="${p.slug}"><div class="card-tilt"><svg class="card-outline" viewBox="0 0 420 520" preserveAspectRatio="none" aria-hidden="true"><path vector-effect="non-scaling-stroke" d="M12 1H408Q419 1 419 12V452Q419 463 408 463H251C240 463 236 466 230 474L198 509C192 516 185 519 177 519H12Q1 519 1 508V12Q1 1 12 1Z"/></svg><div class="card-content"><div class="card-meta"><span class="label">${String(i + 1).padStart(2, "0")}</span><span class="card-status">${escape(p.status)}</span></div><div class="card-copy"><p class="eyebrow">${escape(p.eyebrow)}</p><h3>${escape(p.name)}</h3><p class="card-description">${escape(p.summary)}</p></div><div class="card-skills">${p.tags.map((t) => `<span>${escape(t)}</span>`).join("")}</div></div><div class="card-caption"><span>Explore project</span>${arrow}</div></div></div></a></article>`,
    )
    .join("");
}
function casePage(p, index) {
  const next = projects[(index + 1) % projects.length];
  return renderPresentation(p, next, { arrow, external, visual, index });
}

const guideBody = await readFile(
  path.join(root, "site/orchestrate-guide.html"),
  "utf8",
);
const reliableBody = await readFile(
  path.join(root, "site/reliable-ai.html"),
  "utf8",
);
const readingMinutes = (html) =>
  Math.max(
    1,
    Math.round(
      html
        .replace(/<[^>]+>/g, " ")
        .split(/\s+/)
        .filter(Boolean).length / 220,
    ),
  );
const guideToc = [
  ["build-path", "Choose a build path"],
  ["task", "Define the task"],
  ["adk-setup", "Developer setup"],
  ["adk-tool", "Python FAQ tool"],
  ["adk-agent", "Agent configuration"],
  ["visual-builder", "Visual builder"],
  ["evaluate", "Check behaviour"],
];
const reliableToc = [
  ["context", "Useful context"],
  ["boundary", "Clear boundaries"],
  ["effects", "Observable effects"],
  ["measure", "Repeatable evaluation"],
];
const notes = [
  {
    href: "create_agent.html",
    topic: "Agents / Practical guide",
    title: "Building an agent with watsonx Orchestrate",
    lead: "A complete walkthrough of the developer and visual builder routes: installation, environment setup, a Python FAQ tool, agent configuration, knowledge, and testing.",
    sections: guideToc.length,
    minutes: readingMinutes(guideBody),
  },
  {
    href: "engineering-reliable-ai.html",
    topic: "Systems / Design notes",
    title: "Reason, verify, deliver: the system around the model",
    lead: "The engineering around the model determines whether an AI capability becomes a reliable product.",
    sections: reliableToc.length,
    minutes: readingMinutes(reliableBody),
  },
];
const noteRow = ({ href, topic, title, lead, sections, minutes }) =>
  `<a class="note-row" href="${href}" data-preview="${escape(lead)}" data-preview-meta="${sections} sections · ${minutes} min read"><span class="label">${topic}</span><h3>${title}</h3><span class="round-arrow">${arrow}</span></a>`;
const noteLinks = notes.map(noteRow).join("");
function article(title, lead, body, toc) {
  return `<main id="main"><header class="page-hero wrap"><a class="breadcrumb" href="blog_homepage.html">${arrow} Back to engineering notes</a><p class="eyebrow">Engineering notes</p><h1>${title}</h1>${lightRail(" title-rail")}<p class="page-lead">${lead}</p><p class="article-meta">Owen Le · Updated 8 October 2026</p></header><div class="case-layout wrap"><nav class="case-toc" aria-label="Article sections"><span>In this note</span>${toc.map(([id, label]) => `<a href="#${id}">${label}</a>`).join("")}</nav><article class="case-content article-content">${body}</article></div></main>`;
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
  .replace("{{projectCount}}", String(projects.length).padStart(2, "0"))
  .replace("{{projects}}", cards())
  .replace("{{notes}}", noteLinks);
await emit(
  "index.html",
  "Owen Le — Forward Deployed Engineer / Applied AI Engineer / Member of Technical Staff",
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
for (const [oldSlug, newSlug, name] of [
  ["billacord", "dueform", "DueForm"],
  ["actionproof", "actifact", "ActiFact"],
]) {
  await writeFile(
    path.join(docs, `${oldSlug}.html`),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>html,body{background:#0c1c1a;color:#e9efe6;color-scheme:dark}@view-transition{navigation:none}</style><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name} — Owen Le</title><meta name="robots" content="noindex"><link rel="canonical" href="https://taivanle.github.io/${newSlug}.html"><meta http-equiv="refresh" content="0;url=${newSlug}.html"><script>location.replace("${newSlug}.html" + location.search + location.hash)</script></head><body><main><h1>${name}</h1><a href="${newSlug}.html">Continue to the project presentation.</a></main></body></html>\n`,
  );
}
await emit(
  "projects.html",
  "Selected work",
  "Case studies in applied AI, evaluation, full-stack products, and enterprise governance by Owen Le.",
  `<main id="main" class="wrap listing-page"><header class="page-hero"><p class="eyebrow">Selected work</p><h1>From idea to <span class="soft">implementation.</span></h1>${lightRail(" title-rail")}<p class="page-lead">Professional work and independent builds, with the decisions, evidence, and scope behind each.</p></header><div class="project-grid">${cards()}</div></main>`,
);
await emit(
  "blog_homepage.html",
  "Engineering notes",
  "Practical notes on building agents, evaluation, and reliable AI systems.",
  `<main id="main" class="wrap listing-page"><header class="page-hero"><p class="eyebrow">Engineering notes</p><h1>Thinking <span class="soft">out loud.</span></h1>${lightRail(" title-rail")}<p class="page-lead">Notes on building agents and the engineering that turns a model into a useful system.</p></header>${noteLinks}</main>`,
);
await emit(
  "orchestrate_simplified.html",
  "watsonx Orchestrate — Simplified",
  "A practical guide to building an agent with watsonx Orchestrate.",
  `<main id="main" class="wrap listing-page"><header class="page-hero"><a class="breadcrumb" href="blog_homepage.html">${arrow} Back to engineering notes</a><p class="eyebrow">Practical guide</p><h1>watsonx Orchestrate.<br><span class="soft">Simplified.</span></h1>${lightRail(" title-rail")}<p class="page-lead">An engineering-first introduction to building an agent, connecting tools, and checking its behaviour.</p></header>${noteRow(notes[0])}</main>`,
);
await emit(
  "create_agent.html",
  "Building an agent with watsonx Orchestrate",
  "Choose a build path, define a narrow task, connect tools, and evaluate your watsonx Orchestrate agent.",
  article(
    'Building an agent with<br><span class="soft">watsonx Orchestrate.</span>',
    "A complete walkthrough of the developer and visual builder routes: installation, environment setup, a Python FAQ tool, agent configuration, knowledge, and testing.",
    guideBody,
    guideToc,
  ),
);
await emit(
  "engineering-reliable-ai.html",
  "Reason, verify, deliver",
  "Design notes on context, model boundaries, observable effects, and evaluation in reliable AI systems.",
  article(
    'Reason. Verify.<br><span class="soft">Deliver.</span>',
    "The engineering around the model determines whether an AI capability becomes a reliable product.",
    reliableBody,
    reliableToc,
  ),
);
await emit(
  "404.html",
  "Page not found",
  "Return to Owen Le’s portfolio and selected engineering projects.",
  `<main id="main" class="wrap not-found"><p class="not-found-code" aria-hidden="true">404</p>${lightRail(" not-found-rail")}<p class="eyebrow">Page not found</p><h1>Wrong turn.</h1><p>This page may have moved. Find my latest projects, experience, and engineering notes on the homepage.</p><div class="not-found-actions"><a class="button primary" href="index.html#work">Back to work ${arrow}</a><a class="button quiet" href="index.html">Home</a></div></main>`,
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
console.log(`Built ${outputs.length + 3} pages into docs/.`);
