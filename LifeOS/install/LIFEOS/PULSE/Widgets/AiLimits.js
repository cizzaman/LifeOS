// AI-grenser — Scriptable-widget for iPhone (Hjem- og låseskjerm).
// Leser Pulse /api/usage/limits over Tailscale: Claude 5t/7d og Codex-vinduer.
// Oppsett: se README.md i denne mappen.

const PULSE = args.widgetParameter || "https://agent03.tail5af7c2.ts.net:31337";

const BG = new Color("#111111");
const FG = new Color("#e8e8e8");
const DIM = new Color("#8a8a8a");
const TRACK = new Color("#2a2a2a");

function fill(pct) {
  if (pct >= 90) return new Color("#d0675b");
  if (pct >= 75) return new Color("#c9a24a");
  return new Color("#5fa89a");
}

function resetIn(iso) {
  if (!iso) return "";
  const min = Math.max(0, Math.round((new Date(iso) - Date.now()) / 60000));
  if (min < 60) return `${min}m`;
  if (min < 48 * 60) return `${Math.floor(min / 60)}t ${min % 60}m`;
  return `${Math.round(min / 1440)}d`;
}

function bar(pct, width) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, 4);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  ctx.setFillColor(TRACK);
  ctx.fillRect(new Rect(0, 0, width, 4));
  ctx.setFillColor(fill(pct));
  ctx.fillRect(new Rect(0, 0, Math.round(width * Math.min(pct, 100) / 100), 4));
  return ctx.getImage();
}

async function load() {
  const req = new Request(`${PULSE}/api/usage/limits`);
  req.timeoutInterval = 10;
  return req.loadJSON();
}

function accessory(w, providers) {
  // Låseskjerm (rektangulær): én linje per leverandør.
  for (const p of providers) {
    const t = w.addText(`${p.name} ${p.windows.map((x) => `${x.label} ${Math.round(x.pct ?? 0)}%`).join(" · ")}`);
    t.font = Font.mediumSystemFont(12);
    t.lineLimit = 1;
  }
}

function home(w, providers) {
  const barWidth = config.widgetFamily === "small" ? 120 : 280;
  for (const p of providers) {
    const title = w.addText(p.plan ? `${p.name} · ${p.plan}` : p.name);
    title.font = Font.semiboldSystemFont(12);
    title.textColor = FG;
    w.addSpacer(3);
    for (const x of p.windows) {
      const pct = Math.round(x.pct ?? 0);
      const row = w.addStack();
      row.centerAlignContent();
      const label = row.addText(`${x.label} ${pct}%`);
      label.font = Font.regularMonospacedSystemFont(11);
      label.textColor = FG;
      row.addSpacer();
      const reset = row.addText(resetIn(x.resetsAt));
      reset.font = Font.regularMonospacedSystemFont(10);
      reset.textColor = DIM;
      w.addSpacer(2);
      w.addImage(bar(pct, barWidth));
      w.addSpacer(4);
    }
    w.addSpacer(4);
  }
}

const w = new ListWidget();
w.backgroundColor = BG;
w.setPadding(12, 12, 12, 12);
w.refreshAfterDate = new Date(Date.now() + 15 * 60000);

try {
  const data = await load();
  const providers = data.providers || [];
  if (config.widgetFamily?.startsWith("accessory")) accessory(w, providers);
  else home(w, providers);
  if (!config.widgetFamily?.startsWith("accessory")) {
    w.addSpacer();
    const ts = w.addText(`Oppdatert ${new Date().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}`);
    ts.font = Font.systemFont(9);
    ts.textColor = DIM;
  }
} catch (e) {
  const t = w.addText("Pulse utilgjengelig");
  t.font = Font.systemFont(12);
  t.textColor = DIM;
}

if (config.runsInWidget) Script.setWidget(w);
else await w.presentMedium();
Script.complete();
