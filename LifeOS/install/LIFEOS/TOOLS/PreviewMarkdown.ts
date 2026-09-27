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
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script>(function(){try{var t=localStorage.getItem("pulse-theme")==="light"?"light":"dark";var d=document.documentElement;d.setAttribute("data-theme",t);d.style.colorScheme=t;}catch(e){}})()</script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
  <style>
    :root {
      color-scheme: dark;
      --type-base: clamp(11px, calc(11px + (100vw - 390px) / 525), 13px);
      --type-figure: calc(var(--type-base) + 7px);
      --ground: #0a0a0a;
      --surface-1: #111111;
      --line-1: #1f1f1f;
      --line-2: #262626;
      --line-3: #3a3a3a;
      --ink-1: #f0e8d8;
      --ink-2: #98a8b3;
      --ink-3: #6b7d89;
      --accent: #3fb2c9;
      --primary-soft: rgba(63, 178, 201, 0.12);
    }
    html[data-theme="light"] {
      color-scheme: light;
      --ground: #faf9f5;
      --surface-1: #fff7ed;
      --line-1: #efe4d6;
      --line-2: #e7d8c8;
      --line-3: #cfb797;
      --ink-1: #292524;
      --ink-2: #57534e;
      --ink-3: #6b625b;
      --accent: #9a5800;
      --primary-soft: rgba(154, 88, 0, 0.12);
    }
    body {
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      font-family: "Albert Sans", system-ui, sans-serif;
      font-size: 15px;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
      line-height: 1.65;
      color: var(--ink-1);
      background: var(--ground);
    }
    h1, h2, h3 { font-family: "Outfit", "Albert Sans", system-ui, sans-serif; font-weight: 500; color: var(--ink-1); }
    h1 { font-size: var(--type-figure); letter-spacing: -0.02em; margin-bottom: 0.5em; }
    h2 { font-size: 16px; border-bottom: 1px solid var(--line-2); padding-bottom: 0.3em; margin-top: 1.5em; }
    h3 { font-size: 15px; }
    h4, h5, h6 { font: 400 10px/1.4 "Fira Code", ui-monospace, monospace; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-2); }
    p, li { color: var(--ink-1); }
    li::marker { color: var(--ink-3); }
    a { color: var(--ink-1); text-decoration: underline; text-decoration-thickness: 1px; text-decoration-color: var(--line-3); text-underline-offset: 3px; }
    a:hover { text-decoration-color: var(--accent); }
    pre { background: var(--surface-1); color: var(--ink-1); border: 1px solid var(--line-2); padding: 16px; overflow-x: auto; border-radius: 10px; }
    code { font-family: "Fira Code", ui-monospace, monospace; background: var(--surface-1); border: 1px solid var(--line-2); padding: 1px 5px; font-size: 0.88em; }
    pre code { padding: 0; background: none; border: 0; }
    blockquote { border-left: 1px solid var(--line-3); margin: 0; padding-left: 16px; color: var(--ink-2); }
    strong { color: var(--ink-1); font-weight: 500; }
    hr { border: none; border-top: 1px solid var(--line-2); margin: 2em 0; }
    table { border-collapse: collapse; border: 1px solid var(--line-2); }
    th, td { border-bottom: 1px solid var(--line-1); padding: 8px 12px; text-align: left; vertical-align: top; }
    th { font: 400 10px/1.4 "Fira Code", ui-monospace, monospace; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-2); border-bottom-color: var(--line-2); }
    img { max-width: 100%; border: 1px solid var(--line-2); border-radius: 10px; }
    @media (max-width: 600px) { body { margin: 16px auto; padding: 0 16px; } table { display: block; overflow-x: auto; } }

    .theme-switch { position: fixed; top: 16px; right: 16px; z-index: 100; display: flex; gap: 8px; }
    .theme-swatch { width: 28px; height: 28px; padding: 3px; border: 1px solid transparent; border-radius: 50%; background: transparent; cursor: pointer; }
    .theme-swatch:hover { border-color: var(--line-3); }
    .theme-swatch.active { border-color: var(--accent); background: var(--primary-soft); }
    .theme-swatch::before { content: ""; display: block; width: 100%; height: 100%; border-radius: 50%; background: conic-gradient(var(--swatch-ground) 0deg 180deg, var(--swatch-accent) 180deg 360deg); }
    .theme-swatch-dark  { --swatch-ground: #0a0a0a; --swatch-accent: #3fb2c9; }
    .theme-swatch-light { --swatch-ground: #faf9f5; --swatch-accent: #9a5800; }
  </style>
</head>
<body>
  <div class="theme-switch" role="group" aria-label="Theme">
    <button type="button" class="theme-swatch theme-swatch-dark" data-theme-choice="dark" aria-label="Dark theme" title="Dark"></button>
    <button type="button" class="theme-swatch theme-swatch-light" data-theme-choice="light" aria-label="Light theme" title="Light"></button>
  </div>
  <div id="content"></div>
  <script>
    // Sanitize rendered HTML before injection — markdown can carry raw <script>/onerror XSS
    document.getElementById('content').innerHTML = DOMPurify.sanitize(marked.parse(${JSON.stringify(content)}));
  </script>
  <script>(function(){
    var KEY = "pulse-theme";
    function apply(t) {
      document.documentElement.setAttribute("data-theme", t);
      document.documentElement.style.colorScheme = t;
      document.querySelectorAll(".theme-swatch").forEach(function(b){ b.classList.toggle("active", b.dataset.themeChoice === t); });
    }
    document.querySelectorAll(".theme-swatch").forEach(function(b){
      b.addEventListener("click", function(){
        var t = b.dataset.themeChoice;
        try { localStorage.setItem(KEY, t); } catch (e) {}
        apply(t);
      });
    });
    apply(document.documentElement.getAttribute("data-theme") || "dark");
  })();</script>
</body>
</html>`;

await writeFile(htmlPath, html);
await $`open ${htmlPath}`.quiet();

console.log(JSON.stringify({
  success: true,
  url: `file://${htmlPath}`,
  path: htmlPath
}, null, 2));
