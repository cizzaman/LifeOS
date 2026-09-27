import { type, space, radius, motion, layout, cssVars, THEME_PREPAINT_SCRIPT, type Mode } from "./Theme";
import type { CollectionPage, NarrativePage, ReferencePage, IndexPage, PageData } from "../Schema/PulseSchema";
import type { DataPlaneIndex } from "../lib/data-plane";

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function mdInline(s: string): string {
  return escape(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function mdBlock(s: string): string {
  const lines = s.split("\n");
  let html = "", inUl = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^[-*]\s/.test(line)) {
      if (!inUl) { html += "<ul>"; inUl = true; }
      html += `<li>${mdInline(line.replace(/^[-*]\s/, ""))}</li>`;
    } else {
      if (inUl) { html += "</ul>"; inUl = false; }
      if (line) html += `<p>${mdInline(line)}</p>`;
    }
  }
  if (inUl) html += "</ul>";
  return html;
}

export function baseStyles(): string {
  const caps = `font-family: ${type.fontMono}; font-size: 10px; font-weight: ${type.weight.normal}; letter-spacing: 0.16em; text-transform: uppercase;`;
  const key = `content: ""; display: inline-block; flex: none; width: 7px; height: 7px; border: 1px solid currentColor; background: color-mix(in srgb, currentColor 14%, transparent);`;
  return `
    ${cssVars()}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: var(--c-bg); color: var(--c-text); font-family: ${type.fontSans}; font-size: 15px; line-height: ${type.lineHeight.normal}; -webkit-font-smoothing: antialiased; }
    a { color: var(--c-text); text-decoration: underline; text-decoration-thickness: 1px; text-decoration-color: var(--c-borderStrong); text-underline-offset: 3px; transition: text-decoration-color ${motion.fast}; }
    a:hover { text-decoration-color: var(--c-accent); }
    code { font-family: ${type.fontMono}; font-size: 0.88em; background: var(--c-bgSubtle); border: 1px solid var(--c-border); padding: 0 ${space.xs}; border-radius: ${radius.none}; }
    .layout { display: grid; grid-template-columns: ${layout.sidebarWidth} minmax(0, 1fr); grid-template-rows: auto 1fr; min-height: 100vh; }
    header.app-header { grid-column: 1 / -1; min-height: ${layout.headerHeight}; background: var(--c-bg); border-bottom: 1px solid var(--c-border); display: flex; flex-wrap: wrap; align-items: center; padding: ${space.sm} ${space.xl}; gap: ${space.sm} ${space.lg}; position: sticky; top: 0; z-index: 10; }
    header.app-header .brand { font-family: ${type.fontSerif}; font-weight: ${type.weight.medium}; font-size: 17px; letter-spacing: -0.01em; }
    header.app-header .meta { ${caps} color: var(--c-textFaint); margin-left: auto; }
    aside.sidebar { background: transparent; border-right: 1px solid var(--c-border); padding: ${space.lg} ${space.md}; overflow-y: auto; }
    aside.sidebar nav { display: flex; flex-direction: column; gap: ${space.xs}; }
    aside.sidebar a.nav-item { color: var(--c-textMuted); text-decoration: none; padding: ${space.sm} ${space.md}; display: flex; flex-wrap: wrap; align-items: center; gap: ${space.sm}; font-size: ${type.scale.sm}; border: 1px solid transparent; border-radius: ${radius.lg}; transition: color ${motion.fast}, border-color ${motion.fast}; }
    aside.sidebar a.nav-item:hover { color: var(--c-text); }
    aside.sidebar a.nav-item.active { color: var(--c-text); background: var(--c-accentSoft); border-color: var(--c-accent); }
    .pill { ${caps} display: inline-flex; align-items: center; gap: 6px; color: var(--c-textMuted); vertical-align: middle; }
    .pill.template::before { ${key} color: var(--c-pillTemplate); }
    .pill.customized::before { ${key} color: var(--c-pillCustomized); }
    main.content { padding: ${space.xxxl} ${space.xxl}; max-width: ${layout.contentMaxWidth}; margin: 0 auto; width: 100%; }
    main.content h1, main.content h2, main.content h3 { font-family: ${type.fontSerif}; font-weight: ${type.weight.medium}; color: var(--c-text); }
    main.content h1 { font-size: clamp(26px, 4vw, 36px); line-height: 1.15; letter-spacing: -0.025em; margin-bottom: ${space.lg}; }
    main.content h2 { font-size: 20px; line-height: 1.3; margin-top: ${space.xxxl}; margin-bottom: ${space.md}; letter-spacing: -0.01em; }
    main.content h3 { font-size: 16px; line-height: 1.35; margin-top: ${space.xl}; margin-bottom: ${space.sm}; }
    main.content h4, main.content h5, main.content h6 { ${caps} color: var(--c-textMuted); margin-top: ${space.xl}; margin-bottom: ${space.sm}; }
    main.content p { margin-bottom: ${space.md}; color: var(--c-text); }
    main.content ul, main.content ol { margin-left: ${space.xl}; margin-bottom: ${space.md}; }
    main.content li { margin-bottom: ${space.xs}; }
    main.content li::marker { color: var(--c-textFaint); }
    .lede { font-size: 17px; color: var(--c-textMuted); line-height: ${type.lineHeight.snug}; margin-bottom: ${space.xxl}; }
    .pull-quote { font-size: 17px; line-height: ${type.lineHeight.snug}; padding: ${space.xs} 0 ${space.xs} ${space.lg}; border-left: 1px solid var(--c-borderStrong); margin: ${space.xl} 0; color: var(--c-textMuted); }
    .meta-row { display: flex; flex-wrap: wrap; align-items: center; gap: ${space.md}; margin-top: ${space.sm}; color: var(--c-textMuted); font-size: ${type.scale.sm}; }
    .stale-banner, .template-banner { display: flex; align-items: baseline; gap: ${space.sm}; border: 1px solid var(--c-borderStrong); border-radius: ${radius.lg}; padding: ${space.md} ${space.lg}; margin-bottom: ${space.xl}; color: var(--c-text); font-size: ${type.scale.sm}; }
    .stale-banner::before { ${key} color: var(--c-warn); }
    .template-banner::before { ${key} color: var(--c-pillTemplate); }
    .empty-state { padding: ${space.xxxl} ${space.lg}; text-align: center; color: var(--c-textMuted); }
    .empty-state h2 { ${caps} color: var(--c-textMuted); margin-bottom: ${space.md}; }
    .item-card { padding: ${space.md} ${space.lg}; border: 1px solid var(--c-border); border-radius: ${radius.lg}; margin-bottom: ${space.sm}; background: transparent; }
    .item-card .name { font-weight: ${type.weight.medium}; }
    .item-card .creator { color: var(--c-textMuted); margin-left: ${space.sm}; }
    .item-card .rating { font-family: ${type.fontMono}; font-size: ${type.scale.xs}; color: var(--c-textMuted); margin-left: ${space.sm}; }
    .item-card .notes { color: var(--c-textMuted); margin-top: ${space.xs}; font-size: ${type.scale.sm}; }
    .ref-table { width: 100%; border-collapse: collapse; }
    .ref-table th, .ref-table td { padding: ${space.sm} ${space.md}; text-align: left; vertical-align: top; border-bottom: 1px solid var(--c-border); font-size: ${type.scale.sm}; }
    .ref-table th { ${caps} color: var(--c-textMuted); }
    .ref-table td.key { font-family: ${type.fontMono}; font-size: 13px; color: var(--c-text); }
    .index-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: ${space.lg}; }
    .index-tile { display: block; padding: ${space.lg}; border: 1px solid var(--c-borderStrong); border-radius: ${radius.lg}; background: transparent; color: var(--c-text); text-decoration: none; transition: border-color ${motion.fast}; }
    .index-tile:hover { border-color: var(--c-accent); }
    main.content .index-tile h3 { margin: 0 0 ${space.xs} 0; }
    .index-tile .preview { color: var(--c-textMuted); font-size: ${type.scale.sm}; }
    button.rebuild-btn { ${caps} background: transparent; border: 1px solid var(--c-border); color: var(--c-text); padding: ${space.sm} ${space.md}; border-radius: ${radius.lg}; cursor: pointer; transition: border-color ${motion.fast}; }
    button.rebuild-btn:hover { border-color: var(--c-accent); }
    button.rebuild-btn[disabled] { opacity: 0.5; cursor: not-allowed; }
    .page-header { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: ${space.lg}; margin-bottom: ${space.xl}; }
    .page-header .actions { display: flex; gap: ${space.sm}; }
    @media (max-width: 720px) {
      .layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto 1fr; }
      aside.sidebar { border-right: 0; border-bottom: 1px solid var(--c-border); }
      main.content { padding: ${space.xl} ${space.lg}; }
    }
  `;
}

export function renderShell(opts: {
  // Seeds the initial data-theme attribute (before THEME_PREPAINT_SCRIPT
  // corrects it from localStorage). Dark stays the product default; callers
  // that don't run JS against the output (snapshot/screenshot tooling) still
  // get a deterministic render, which is the one reason this param stays.
  mode: Mode;
  pageId: string;
  pageTitle: string;
  index: DataPlaneIndex | null;
  body: string;
}): string {
  const { mode, pageId, pageTitle, index, body } = opts;
  const navItems = (index?.pages ?? [])
    .map((e) => {
      const active = e.id === pageId ? "active" : "";
      const pill = e.provenance === "template" ? `<span class="pill template">template</span>` : "";
      return `<a class="nav-item ${active}" href="/v2/${escape(e.id)}">${escape(e.title)} ${pill}</a>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en" data-theme="${escape(mode)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pulse | ${escape(pageTitle)}</title>
${THEME_PREPAINT_SCRIPT}
<style>${baseStyles()}</style>
</head>
<body>
<div class="layout">
  <header class="app-header">
    <span class="brand">Pulse</span>
    <span class="meta">${index ? `${index.pages.length} pages · last build ${escape(index.generatedAt.slice(0, 16))}` : "no index yet"}</span>
  </header>
  <aside class="sidebar">
    <nav>${navItems}</nav>
  </aside>
  <main class="content">
    ${body}
  </main>
</div>
</body>
</html>`;
}

export function renderEmpty(pageId: string, message: string): string {
  return `<div class="empty-state"><h2>${escape(pageId)} — no data yet</h2><p>${escape(message)}</p></div>`;
}

export function renderTemplateBanner(): string {
  return `<div class="template-banner">This page is on template defaults — customize it by editing the underlying USER/ file.</div>`;
}

export function renderStaleBanner(ageHours: number): string {
  return `<div class="stale-banner">Data is stale (${Math.round(ageHours)}h old). Click Rebuild to refresh.</div>`;
}

function renderHeader(title: string, pageId: string, rebuildable: boolean, isTemplate: boolean): string {
  const pill = isTemplate ? `<span class="pill template">template</span>` : "";
  const btn = rebuildable ? `<button class="rebuild-btn" onclick="fetch('/api/pulse/rebuild/${escape(pageId)}',{method:'POST'}).then(()=>location.reload())">Rebuild</button>` : "";
  return `<div class="page-header"><div><h1>${escape(title)} ${pill}</h1></div><div class="actions">${btn}</div></div>`;
}

export function renderCollection(p: CollectionPage, opts: { rebuildable: boolean }): string {
  const isTemplate = p.meta.provenance === "template";
  const items = p.items.length === 0
    ? `<div class="empty-state"><h2>No items yet</h2><p>${escape(p.title)} is empty. Add entries to your USER/ source file.</p></div>`
    : p.items.map((it) => {
        const creator = it.creator ? `<span class="creator">— ${escape(it.creator)}</span>` : "";
        const rating = it.rating ? `<span class="rating">★${it.rating}</span>` : "";
        const notes = it.notes ? `<div class="notes">${mdInline(it.notes)}</div>` : "";
        const priv = it.private ? ` <span class="pill template">private</span>` : "";
        return `<div class="item-card"><span class="name">${escape(it.name)}</span>${creator}${rating}${priv}${notes}</div>`;
      }).join("\n");
  return [
    renderHeader(p.title, p.meta.pageId, opts.rebuildable, isTemplate),
    isTemplate ? renderTemplateBanner() : "",
    p.description ? `<p class="lede">${mdInline(p.description)}</p>` : "",
    items,
  ].filter(Boolean).join("\n");
}

export function renderNarrative(p: NarrativePage, opts: { rebuildable: boolean }): string {
  const isTemplate = p.meta.provenance === "template";
  const sections = p.sections.length === 0
    ? `<div class="empty-state"><h2>No content yet</h2><p>${escape(p.title)} has no narrative sections. Customize the source file.</p></div>`
    : p.sections.map((s) => `<h${s.level}>${escape(s.heading)}</h${s.level}>${mdBlock(s.body)}`).join("\n");
  const quotes = p.pullQuotes.map((q) => `<blockquote class="pull-quote">${escape(q)}</blockquote>`).join("\n");
  return [
    renderHeader(p.title, p.meta.pageId, opts.rebuildable, isTemplate),
    isTemplate ? renderTemplateBanner() : "",
    p.lede ? `<p class="lede">${mdInline(p.lede)}</p>` : "",
    sections,
    quotes,
  ].filter(Boolean).join("\n");
}

export function renderReference(p: ReferencePage, opts: { rebuildable: boolean }): string {
  const isTemplate = p.meta.provenance === "template";
  const grouped = new Map<string, typeof p.entries>();
  for (const e of p.entries) {
    const g = e.group ?? "";
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(e);
  }
  const tables = p.entries.length === 0
    ? `<div class="empty-state"><h2>No entries</h2></div>`
    : Array.from(grouped.entries()).map(([g, entries]) => {
        const heading = g ? `<h2>${escape(g)}</h2>` : "";
        const rows = entries.map((e) => {
          const notes = e.notes ? `<td class="notes">${escape(e.notes)}</td>` : "<td></td>";
          return `<tr><td class="key">${escape(e.key)}</td><td>${escape(e.value)}</td>${notes}</tr>`;
        }).join("");
        return `${heading}<table class="ref-table"><thead><tr><th>Key</th><th>Value</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>`;
      }).join("\n");
  return [
    renderHeader(p.title, p.meta.pageId, opts.rebuildable, isTemplate),
    isTemplate ? renderTemplateBanner() : "",
    p.description ? `<p class="lede">${mdInline(p.description)}</p>` : "",
    tables,
  ].filter(Boolean).join("\n");
}

export function renderIndex(p: IndexPage, opts: { rebuildable: boolean }): string {
  const isTemplate = p.meta.provenance === "template";
  const tiles = p.children.length === 0
    ? `<div class="empty-state"><h2>No children indexed</h2></div>`
    : `<div class="index-grid">${p.children.map((c) => `<a class="index-tile" href="${escape(c.path)}"><h3>${escape(c.title)}</h3>${c.preview ? `<div class="preview">${escape(c.preview)}</div>` : ""}</a>`).join("\n")}</div>`;
  return [
    renderHeader(p.title, p.meta.pageId, opts.rebuildable, isTemplate),
    isTemplate ? renderTemplateBanner() : "",
    p.description ? `<p class="lede">${mdInline(p.description)}</p>` : "",
    tiles,
  ].filter(Boolean).join("\n");
}

export function renderPage(p: PageData, opts: { rebuildable: boolean }): string {
  switch (p.kind) {
    case "collection": return renderCollection(p, opts);
    case "narrative": return renderNarrative(p, opts);
    case "reference": return renderReference(p, opts);
    case "index": return renderIndex(p, opts);
  }
}

