import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const docs = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs",
);
const files = (await readdir(docs)).filter((file) => file.endsWith(".html"));
const pages = new Map(
  await Promise.all(
    files.map(async (file) => [
      file,
      await readFile(path.join(docs, file), "utf8"),
    ]),
  ),
);
const errors = [];
for (const [file, html] of pages) {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  if (new Set(ids).size !== ids.length)
    errors.push(`${file}: duplicate element ID`);
  if ((html.match(/<h1(?:\s|>)/g) || []).length !== 1)
    errors.push(`${file}: must have exactly one main heading`);
  if (/\{\{[^}]+\}\}/.test(html))
    errors.push(`${file}: unexpanded template token`);
  for (const [, target] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (/^(?:https?:|mailto:|data:)/.test(target)) continue;
    const [filename, fragment] = target.split("#");
    const destination = filename || file;
    try {
      if (!(await stat(path.join(docs, destination))).isFile())
        throw new Error("Not a file");
      if (fragment) {
        const content = pages.get(destination);
        if (!content || !content.includes(`id="${fragment}"`))
          errors.push(`${file}: missing fragment ${target}`);
      }
    } catch {
      errors.push(`${file}: missing local destination ${target}`);
    }
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Checked ${files.length} pages: local links, assets, anchors, headings, and template expansion pass.`,
  );
