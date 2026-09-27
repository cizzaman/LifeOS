#!/usr/bin/env bun
/**
 * Preview a markdown file in the browser
 * Usage: bun PreviewMarkdown.ts <path-to-markdown>
 */

import { writeFile, mkdtemp, readFile } from "fs/promises";
import { join, basename } from "path";
import { tmpdir } from "os";
import { $ } from "bun";

const mdPath = process.argv[2];
if (!mdPath) {
  console.error("Usage: bun PreviewMarkdown.ts <path-to-markdown>");
  process.exit(1);
}

const content = await readFile(mdPath, "utf-8");
const title = basename(mdPath, ".md");

const tempDir = await mkdtemp(join(tmpdir(), "pai-preview-"));
const htmlPath = join(tempDir, "preview.html");

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
  <style>
    body {
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      font-family: "Albert Sans", system-ui, sans-serif;
      font-size: 15px;
      line-height: 1.65;
      color: #f0e8d8;
      background: #0a0a0a;
    }
    h1, h2, h3 { font-family: "Outfit", "Albert Sans", system-ui, sans-serif; font-weight: 500; color: #f0e8d8; }
    h1 { font-size: 2em; letter-spacing: -0.02em; margin-bottom: 0.5em; }
    h2 { border-bottom: 1px solid #262626; padding-bottom: 0.3em; margin-top: 1.5em; }
    h4, h5, h6 { font: 400 11px/1.4 "Fira Code", ui-monospace, monospace; letter-spacing: 0.16em; text-transform: uppercase; color: #98a8b3; }
    a { color: #a8e2ee; }
    pre { background: #111111; color: #d9d2c4; border: 1px solid #262626; padding: 16px; overflow-x: auto; border-radius: 10px; }
    code { font-family: "Fira Code", ui-monospace, monospace; background: #181818; border: 1px solid #262626; padding: 1px 6px; border-radius: 4px; font-size: 0.88em; }
    pre code { padding: 0; background: none; border: 0; }
    blockquote { border-left: 1px solid #3fb2c9; margin: 0; padding-left: 20px; color: #98a8b3; }
    strong { color: #f0e8d8; font-weight: 600; }
    hr { border: none; border-top: 1px solid #262626; margin: 2em 0; }
    table { border-collapse: collapse; } th, td { border: 1px solid #262626; padding: 6px 10px; }
  </style>
</head>
<body>
  <div id="content"></div>
  <script>
    // Sanitize rendered HTML before injection — markdown can carry raw <script>/onerror XSS
    document.getElementById('content').innerHTML = DOMPurify.sanitize(marked.parse(${JSON.stringify(content)}));
  </script>
</body>
</html>`;

await writeFile(htmlPath, html);
await $`open ${htmlPath}`.quiet();

console.log(JSON.stringify({
  success: true,
  url: `file://${htmlPath}`,
  path: htmlPath
}, null, 2));
