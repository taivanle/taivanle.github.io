# Owen Le — engineering portfolio

Live at **https://taivanle.github.io/**. GitHub Pages serves the committed `docs/` directory from `main`.

The portfolio covers applied AI, evaluation, enterprise delivery, and independent product engineering. Themis, Billacord, and ActionProof each have a six-scene interactive presentation, alongside current career details, engineering notes, and the supplied resume PDF.

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
- `site/field.js`: the original canvas signal-field visual, fixed behind the homepage, project gallery, and project presentations.
- `tools/build.mjs`: common page layout, article content, metadata, and generation.
- `tools/presentation.mjs`: project scenes, interactive architecture stages, and reading view.
- `docs/assets/owen-le-resume.pdf`: the provided resume, served without alteration.
- `docs/assets/social-card.png`: share preview image.
- `docs/assets/media/`: compressed, silent ten-second demonstration clip from the supplied `owen.MP4`, plus a poster frame. Visible captions and surrounding labels are omitted for the video and event photographs as requested. The original source remains untouched. The video autoplays silently and loops while visible. It pauses off screen and for reduced-motion preferences. Event photographs are optimised WebP copies of the supplied originals.

After editing source, run the build and commit both source and generated `docs/` changes. Styles and scripts receive content-based version queries so published updates load without stale browser assets. Existing homepage, projects, and notes URLs remain valid. Git history retains the previous design and long-form guide.

## Browser verification

```sh
npx playwright install chromium
npm test
```

Tests cover project filters, mobile navigation, Escape and responsive resizing, presentation navigation and architecture stages, reading view and direct scene links, essential content without JavaScript, automatic video looping, the backdrop while scrolling, pointer feedback and unobstructed navigation, reduced-motion and touch support, the manual photo gallery and mentorship links, PDF delivery, accessibility, page errors, and horizontal overflow at 320, 390, 768, 1024, 1440, and 1920 pixels. Card text and presentation illustration layout are also checked at 2560 pixels and enlarged zoom. Result text is checked against its own column bounds across all three projects and seven screen widths. `npm run check` checks local links, assets, fragments, unique IDs, headings, and template expansion. GitHub Actions repeats the build, generated-file consistency check, and browser tests on pushes and pull requests.

If using an existing Chrome installation locally, set `CHROME_PATH` to its executable before running the tests. GitHub Actions installs its own Chromium.

## Content and scope

Career history and Themis outcomes come from the supplied resume. At Owen’s request, the site does not associate Themis with Aptura or assign it employment dates; the career timeline is separate. Independent-project descriptions reflect current project documentation and implementation summaries. Prototype status and benchmark limitations are explicit in each case study. Illustrative product visuals are labelled. Private employer/product source code and datasets are not included. Billacord is the current working name; older project folders used ClauseTally and ReplyLedger.

Additional background, developer enablement, selected learning, and the profile URL come from [Owen’s LinkedIn](https://www.linkedin.com/in/owen-le/). The speaking and workshops section combines Owen’s explicit descriptions with [his IBM retrospective](https://www.linkedin.com/feed/update/urn:li:activity:7477268324196782081/). Birmingham photographs are from the user, with 2024 visible on the event backdrop. The London showcase is explicitly dated 2025 by Owen and has no incorrectly relabelled Birmingham photo. Mentoring covers two University of Nottingham final-year groups, with details and team reflections linked from [the immersive VR learning project](https://www.linkedin.com/posts/vuong-luu-nguyen-4510b4204_for-the-past-year-me-and-my-team-abdullah-ugcPost-7196899451309805568-Zqw8/) and [Security Crisis](https://www.linkedin.com/posts/alexgeoman_after-months-of-designing-coding-testing-ugcPost-7328587937892233216-oOb2/). These are credited as student-built projects. Resume dates and metrics remain the source for the career timeline and Themis results.

Visual references supplied by Owen were [Abdalla Elradi](https://aelradi.engineer/) and [Yash Ahire](https://yashahire.info/). The project gallery also draws on Owen’s supplied Lando Norris card-system screenshot. The portfolio uses original styling and motion: a continuous luminous signal-field backdrop, a matching dark header, a mouse-only glass cursor with pointer-responsive lighting and rotation, staggered, text-led project frames with notched outlines and a dark translucent fill, matching dark project presentations with browser-native card-to-deck transitions, lighting on presentation illustrations, scene transitions, interactive architecture illumination, and the supplied personal video. The canvas renders locally at a capped pixel density and about 30 frames per second, suspends when the tab is hidden, and becomes static for reduced motion. No visible pause controls are shown, as requested.

The watsonx Orchestrate note links to current IBM documentation instead of hard-coding installation versions, credentials, or UI procedures.

## Delivery and accessibility

Static semantic HTML, self-hosted Manrope, native links, accessible filter states and feedback, reduced-motion support, print styles, canonical URLs, structured metadata, social sharing, sitemap, robots file, and a custom 404. Core content and navigation work without JavaScript. No third-party scripts, analytics, client keys, forms, or runtime CDN requests.

Manrope is distributed under the SIL Open Font License; see `docs/assets/fonts/OFL.txt`. Older template assets retain their existing attribution in `readme/readme.txt`.
