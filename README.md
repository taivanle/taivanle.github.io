# Owen Le — engineering portfolio

Live at **https://taivanle.github.io/**. GitHub Pages serves the committed `docs/` directory from `main`.

The portfolio covers applied AI, evaluation, enterprise delivery, and independent product engineering. It includes six case studies, current career details, engineering notes, and the supplied resume PDF.

## Update the site

Use Node.js 22 or newer. No framework or runtime dependencies are shipped to visitors.

```sh
npm ci
npm run build
npm run check
npm run preview
```

Open `http://127.0.0.1:4178`. The preview server binds to loopback only.

- `site/content.json`: project descriptions, results, scope, and case-study content.
- `site/index.html`: homepage content and structure.
- `site/styles.css` and `site/app.js`: shared styling and progressive interactions.
- `tools/build.mjs`: common page layout, article content, metadata, and generation.
- `docs/assets/owen-le-resume.pdf`: the provided resume, served without alteration.
- `docs/assets/social-card.png`: share preview image.

After editing source, run the build and commit both source and generated `docs/` changes. All six original page URLs remain valid. Git history retains the previous design and long-form guide.

## Browser verification

```sh
npx playwright install chromium
npm test
```

Tests cover project filters, mobile navigation, Escape and responsive resizing, essential content without JavaScript, PDF delivery, accessibility, page errors, and horizontal overflow at 320, 390, 768, and 1440 pixels. `npm run check` checks local links, assets, fragments, unique IDs, headings, and template expansion. GitHub Actions repeats the build, generated-file consistency check, and browser tests on pushes and pull requests.

If using an existing Chrome installation locally, set `CHROME_PATH` to its executable before running the tests. GitHub Actions installs its own Chromium.

## Content and scope

Career history and Themis outcomes come from the supplied resume. Independent-project descriptions reflect current project documentation and implementation summaries. Prototype status and benchmark limitations are explicit in each case study. Illustrative product visuals are labelled. Private employer/product source code and datasets are not included. Billacord is the current working name; older project folders used ClauseTally and ReplyLedger.

The watsonx Orchestrate note links to current IBM documentation instead of hard-coding installation versions, credentials, or UI procedures.

## Delivery and accessibility

Static semantic HTML, self-hosted Manrope, native links, accessible filter states and feedback, reduced-motion support, print styles, canonical URLs, structured metadata, social sharing, sitemap, robots file, and a custom 404. Core content and navigation work without JavaScript. No third-party scripts, analytics, client keys, forms, or runtime CDN requests.

Manrope is distributed under the SIL Open Font License; see `docs/assets/fonts/OFL.txt`. Older template assets retain their existing attribution in `readme/readme.txt`.
