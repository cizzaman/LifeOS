"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Braces,
  FileText,
  RefreshCw,
  X,
} from "lucide-react";
import {
  PageShell,
  PageHeader,
  Panel,
  PanelHeader,
  StatTile,
  TabBar,
  Pill,
  Marker,
  EmptyState,
  dimStyle,
  type TabSpec,
} from "@/components/ui/chrome";
import Md from "@/components/Md";

/**
 * Algorithm tab — the complete thinking chain, visible, summarized, editable.
 *
 * RULES & FILES is the primary surface and the landing tab: every file the
 * Algorithm system comprises — system prompt, context hooks, doctrine, ISA
 * system, run-layer hooks, on-demand rules — browsable and editable in one
 * place. Each file carries an AI-generated card: what it performs, when it
 * fires, how it affects the whole system. Doctrine edits run the REAL
 * versioning workflow (new v-file, changelog, LATEST, git commit); everything
 * else saves in place (TS syntax-gated for hooks) and git-commits in the
 * file's own repo.
 *
 * HOW IT WORKS is the simple explanation: one auto-generated plain-language
 * overview (server regenerates it whenever any chain file changes — the page
 * is never stale by design), the loop visual, and the teeth.
 *
 * Holds ZERO data and ZERO write logic: everything comes from
 * /api/algorithm-tab. The whitelist of what's editable lives server-side;
 * this page can't invent a path.
 */

type Stage = "context" | "doctrine" | "isa" | "run" | "ondemand";

interface ChainFile {
  id: string;
  name: string;
  rel: string;
  role: string;
  loaded: string;
  stage: Stage;
  editable: boolean;
  kind: "markdown" | "code";
  bytes: number;
  mtime: string | null;
  summary: { markdown: string; generated_at: string; stale: boolean } | null;
}
interface AlgoData {
  generated_at: string;
  version: string;
  claims: { total: number; hook: number; check: number; self: number };
  stages: Stage[];
  chain: ChainFile[];
  versions: { version: string; mtime: string }[];
  summary: { generated_at: string; level: string; stale: boolean; markdown: string } | null;
  generating: boolean;
  errors: Record<string, string> | null;
}
interface FilePayload {
  id: string;
  content: string;
  mtime: string;
  editable: boolean;
}

type TabId = "files" | "how";
const TABS: TabSpec<TabId>[] = [
  { id: "files", label: "Rules & Files" },
  { id: "how", label: "How It Works" },
];

const STAGE_META: Record<Stage, { label: string; desc: string }> = {
  context: { label: "Every turn", desc: "Loaded before the first token — the standing context and the hooks that inject it." },
  doctrine: { label: "The Algorithm", desc: "The doctrine itself — versioned, never edited in place — and its full history." },
  isa: { label: "ISA system", desc: "Where 'done' gets written down, synced, committed, and rendered." },
  run: { label: "During a run", desc: "The live layer — nudges and gates that fire while work happens." },
  ondemand: { label: "On demand", desc: "Rule files pulled in when their trigger fires — never resident." },
};

// The loop, as it actually runs. File chips jump to that file.
const FLOW: { name: string; desc: string; files: string[] }[] = [
  { name: "Load", desc: "System prompt (constitutional, wins conflicts) + CLAUDE.md @-imports + hook-injected context and memory.", files: ["system-prompt", "claude-md", "load-context-hook", "load-memory-hook"] },
  { name: "Judge", desc: "Trivial turn or a run? Discovered from the work, never a rubric. A principal depth directive outranks judgment.", files: ["doctrine", "nudge-hook"] },
  { name: "Articulate", desc: "Done gets written down first: an ISA whose claims each name the probe that would falsify them, plus anti-claims.", files: ["isa-format", "isa-skill"] },
  { name: "Climb", desc: "Build against the ISA. Skills, agents, research as needed; deterministic nudges fire the moment a question is answerable.", files: ["nudge-hook", "isasync-hook"] },
  { name: "Verify", desc: "No claim closes without tool evidence of the right modality. Hooks block mechanically; 'should work' is forbidden.", files: ["verification-gate", "verification-expanded", "checkpoint-hook"] },
  { name: "Learn", desc: "The run leaves a trail: ISA deltas, reflections, learnings routed to where they structurally live.", files: ["self-healing", "changelog"] },
  { name: "Respond", desc: "The ONE output format — answer first, CHANGE/VERIFY evidence when work mutated things. Gated on Stop.", files: ["system-prompt", "format-gate", "stop-gates"] },
];

const pillButton = "text-[12px] px-2.5 py-1 rounded-full transition-opacity hover:opacity-80";

const REFRESH_MS = 60_000;

function ago(ts: string | null | undefined): string {
  if (!ts) return "—";
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return "—";
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
const kb = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(1)}k` : `${n}`);

export default function AlgorithmPage() {
  const [data, setData] = useState<AlgoData | null>(null);
  const [evals, setEvals] = useState<{ suite: string; passed: boolean; pass_to_k: number; cases: unknown[] }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("files");

  // files state
  const [selectedId, setSelectedId] = useState<string>("doctrine");
  const [file, setFile] = useState<FilePayload | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [rawView, setRawView] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // doctrine-specific state (versioned flow, lives inside the Files surface)
  const [doctrineVersion, setDoctrineVersion] = useState<string | null>(null); // null = current
  const [docBump, setDocBump] = useState<"patch" | "feature">("patch");
  const [docNote, setDocNote] = useState("");

  const [regenerating, setRegenerating] = useState(false);
  // The regenerate poll starts in a click handler, not an effect — hold its id
  // so unmount can clear it (it otherwise runs for up to 15 minutes).
  // ported from public PR #1735, @elhoim
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const load = useCallback(() => {
    fetch("/api/algorithm-tab")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const loadEvals = () => fetch("/api/evals")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEvals(d?.suites ?? []))
      .catch(() => {});
    loadEvals();
    const t = setInterval(loadEvals, REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (h === "how") setTab("how");
    else if (h) { setSelectedId(h); setTab("files"); }
  }, []);
  const switchTab = (t: TabId) => {
    setTab(t);
    window.history.replaceState(null, "", t === "files" ? window.location.pathname : "#how");
  };

  const isDoctrine = selectedId === "doctrine";

  // ── file loading ──
  const loadFile = useCallback((id: string, version?: string | null) => {
    setFileLoading(true);
    const qs = version ? `?id=${id}&version=${version}` : `?id=${id}`;
    return fetch(`/api/algorithm-tab/file${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .finally(() => setFileLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== "files") return;
    setEditing(false);
    setSaveMsg(null);
    loadFile(selectedId, isDoctrine ? doctrineVersion : null)
      .then(setFile)
      .catch((e) => setSaveMsg(String(e?.message ?? e)));
  }, [tab, selectedId, doctrineVersion, isDoctrine, loadFile]);

  const selectedSpec = useMemo(() => data?.chain.find((c) => c.id === selectedId) ?? null, [data, selectedId]);

  const selectFile = (id: string) => {
    if (id !== "doctrine") setDoctrineVersion(null);
    setSelectedId(id);
    setTab("files");
    window.history.replaceState(null, "", `#${id}`);
  };

  // ── saves ──
  const saveInPlace = async () => {
    if (!file) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await fetch("/api/algorithm-tab/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId, content: draft, expectedMtime: file.mtime }),
      });
      const out = await r.json();
      if (!r.ok) { setSaveMsg(out.error ?? `HTTP ${r.status}`); return; }
      setSaveMsg(`Saved · commit ${out.commit?.detail ?? "n/a"}`);
      setEditing(false);
      const fresh = await loadFile(selectedId);
      setFile(fresh);
      load();
    } catch (e: any) {
      setSaveMsg(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const saveDoctrine = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const r = await fetch("/api/algorithm-tab/doctrine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft, bump: docBump, note: docNote }),
      });
      const out = await r.json();
      if (!r.ok) { setSaveMsg(out.error ?? `HTTP ${r.status}`); return; }
      setSaveMsg(`v${out.previous} → v${out.version} · ${out.commit?.committed ? `commit ${out.commit.detail}` : out.commit?.detail}`);
      setEditing(false);
      setDocNote("");
      setDoctrineVersion(null);
      const fresh = await loadFile("doctrine");
      setFile(fresh);
      load();
    } catch (e: any) {
      setSaveMsg(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const r = await fetch("/api/algorithm-tab/summary/regenerate", { method: "POST" });
      if (!r.ok && r.status !== 202) {
        const out = await r.json().catch(() => ({}));
        setError(out.error ?? `regenerate failed: HTTP ${r.status}`);
        setRegenerating(false);
        return;
      }
      const startedAt = Date.now();
      const poll = setInterval(async () => {
        try {
          const d = await fetch("/api/algorithm-tab").then((x) => x.json());
          setData(d);
          if (!d.generating || Date.now() - startedAt > 15 * 60_000) {
            clearInterval(poll);
            pollRef.current = null;
            setRegenerating(false);
          }
        } catch { /* keep polling */ }
      }, 5000);
      pollRef.current = poll;
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setRegenerating(false);
    }
  };

  const editorClass =
    "w-full h-[65vh] bg-transparent border border-line-2 rounded-[10px] p-4 text-[13px] leading-relaxed text-ink-1 mono resize-y focus:outline-none focus:border-[color:var(--accent-blue)]";

  const nextPatch = data?.version.replace(/\.(\d+)$/, (_, p) => `.${Number(p) + 1}`);
  const nextFeature = data?.version.replace(/^(\d+)\.(\d+)\..*$/, (_, a, f) => `${a}.${Number(f) + 1}.0`);

  return (
    <PageShell className="max-w-[1400px]">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Algorithm
            {data && <Pill>v{data.version}</Pill>}
            {data?.generating && (
              <span className="flex items-center gap-1.5 text-[11px] text-ink-3 normal-case tracking-normal">
                <RefreshCw className="w-3 h-3 animate-spin" strokeWidth={1.5} /> refreshing explanations…
              </span>
            )}
          </span>
        }
        subtitle="Every rule, hook, and doctrine file the system thinks with — read it, understand it, edit it. The page keeps itself current: change anything and the explanations regenerate."
      />

      <TabBar
        tabs={TABS}
        active={tab}
        onChange={switchTab}
        right={
          <div className="flex items-center gap-2 mono text-[10px] text-ink-3">
            <Marker dim={error ? "err" : "ok"} />
            <span className="whitespace-nowrap">{error ? "offline" : data ? `updated ${ago(data.generated_at)}` : "loading…"}</span>
          </div>
        }
      />

      {error && (
        <div className="flex items-center gap-2 text-ink-2 text-sm">
          <Marker dim="err" /> Couldn&apos;t reach the Algorithm API: {error}
        </div>
      )}
      {!data && !error && <div className="text-ink-3 text-sm">Loading…</div>}

      {/* ════ RULES & FILES — the primary surface ════ */}
      {data && tab === "files" && (
        <div className="grid lg:grid-cols-[320px_1fr] gap-4 items-start">
          {/* ── the chain, grouped ── */}
          <div className="flex flex-col gap-3">
            {data.stages.map((stage) => {
              const files = data.chain.filter((c) => c.stage === stage);
              if (!files.length) return null;
              const meta = STAGE_META[stage];
              return (
                <div key={stage}>
                  <div className="mb-1.5 px-1">
                    <span className="label-caps">{meta.label}</span>
                  </div>
                  <Panel className="p-1.5 max-sm:p-1.5 flex flex-col gap-0.5">
                    {files.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => selectFile(f.id)}
                        className={`flex items-center gap-2 text-left px-2.5 py-2 rounded-[10px] border text-[13px] transition-colors ${selectedId === f.id ? "border-[color:var(--accent-blue)] bg-[color:var(--primary-soft)] text-ink-1" : "border-transparent text-ink-2 hover:text-ink-1"}`}
                        title={f.rel}
                      >
                        {f.kind === "code" ? <Braces className="w-3.5 h-3.5 shrink-0 text-ink-3" strokeWidth={1.5} /> : <FileText className="w-3.5 h-3.5 shrink-0 text-ink-3" strokeWidth={1.5} />}
                        <span className="flex-1 min-w-0 break-words">{f.name}</span>
                        <span className="mono text-[10px] text-ink-3">{kb(f.bytes)}B</span>
                      </button>
                    ))}
                  </Panel>
                </div>
              );
            })}
            <p className="text-[11px] text-ink-3 px-1 leading-snug">
              Everything is editable. Markdown saves bump freshness and git-commit in the file&apos;s own repo;
              hook source is syntax-checked before it can reach disk; doctrine edits always cut a new version.
            </p>
          </div>

          {/* ── viewer / editor ── */}
          <div className="flex flex-col gap-3 min-w-0">
            {selectedSpec && (
              <>
                {/* per-file understanding card */}
                <Panel>
                  <PanelHeader
                    title={`${selectedSpec.name} — what this does`}
                    meta={selectedSpec.summary ? `generated ${ago(selectedSpec.summary.generated_at)}` : undefined}
                    actions={selectedSpec.summary?.stale ? <Pill title="File changed since this card was written — regenerating on the next pass">refreshing</Pill> : undefined}
                  />
                  <div className="text-[12px] text-ink-3 mb-2 leading-snug">
                    {selectedSpec.role} <span className="text-ink-2">Loads: {selectedSpec.loaded}.</span>
                  </div>
                  {selectedSpec.summary ? (
                    <div className="text-[13px] leading-relaxed text-ink-1"><Md content={selectedSpec.summary.markdown} /></div>
                  ) : (
                    <div className="text-[12px] text-ink-3 flex items-center gap-2">
                      <RefreshCw className={`w-3 h-3 ${data.generating ? "animate-spin" : ""}`} strokeWidth={1.5} />
                      {data.generating ? "writing this file's summary…" : "summary not generated yet — it will appear on the next refresh pass"}
                    </div>
                  )}
                </Panel>

                {/* doctrine version chips */}
                {isDoctrine && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="label-caps mr-1">Versions</span>
                    {data.versions.slice(0, 12).map((v) => {
                      const isCurrent = v.version === data.version;
                      const isViewing = doctrineVersion ? v.version === doctrineVersion : isCurrent;
                      return (
                        <button
                          key={v.version}
                          onClick={() => setDoctrineVersion(isCurrent ? null : v.version)}
                          className="mono text-[11px] px-2 py-0.5 rounded-full transition-colors"
                          style={dimStyle("neutral", isViewing)}
                          title={`frozen ${ago(v.mtime)}`}
                        >
                          v{v.version}{isCurrent ? " ·current" : ""}
                        </button>
                      );
                    })}
                  </div>
                )}

                <Panel>
                  <PanelHeader
                    title={
                      isDoctrine
                        ? doctrineVersion
                          ? `The Algorithm v${doctrineVersion} — frozen snapshot`
                          : `The Algorithm v${data.version} — live doctrine`
                        : selectedSpec.name
                    }
                    meta={file ? `${selectedSpec.rel} · disk ${ago(file.mtime)}` : selectedSpec.rel}
                    actions={
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedSpec.kind === "markdown" && !editing && (
                          <button onClick={() => setRawView(!rawView)} className={pillButton} style={dimStyle("neutral", rawView)}>
                            {rawView ? "rendered" : "raw"}
                          </button>
                        )}
                        {!editing && (!isDoctrine || !doctrineVersion) && (
                          <button
                            onClick={() => { setDraft(file?.content ?? ""); setEditing(true); setSaveMsg(null); }}
                            disabled={!file}
                            className={`${pillButton} disabled:opacity-50`}
                            style={dimStyle("neutral", true)}
                          >
                            {isDoctrine ? "edit → new version" : "edit"}
                          </button>
                        )}
                      </div>
                    }
                  />

                  {isDoctrine && doctrineVersion && (
                    <div className="text-[12px] text-ink-3 mb-3">
                      Tagged versions are immutable — this is history, not the live file. Select v{data.version} to edit.
                    </div>
                  )}

                  {saveMsg && (
                    <div className="text-[12px] mb-3 flex items-center gap-2 text-ink-2">
                      <Marker dim={saveMsg.startsWith("Saved") || saveMsg.startsWith("v") ? "ok" : "warn"} />
                      <span className="min-w-0 break-words">{saveMsg}</span>
                    </div>
                  )}

                  {fileLoading && <div className="text-ink-3 text-sm">Loading…</div>}

                  {!editing && file && (
                    selectedSpec.kind === "code" || rawView ? (
                      <pre className="text-[12px] leading-relaxed text-ink-2 mono whitespace-pre-wrap border border-line-2 rounded-[10px] p-4 overflow-x-auto max-h-[70vh] overflow-y-auto">
                        {file.content}
                      </pre>
                    ) : (
                      <div className="max-h-[70vh] overflow-y-auto pr-2">
                        <Md content={file.content} />
                      </div>
                    )
                  )}

                  {editing && (
                    <div className="flex flex-col gap-3">
                      <textarea className={editorClass} value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
                      {isDoctrine ? (
                        <>
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              {(["patch", "feature"] as const).map((b) => (
                                <button key={b} onClick={() => setDocBump(b)} className={pillButton} style={dimStyle("neutral", docBump === b)}>
                                  {b} → v{b === "patch" ? nextPatch : nextFeature}
                                </button>
                              ))}
                            </div>
                            <input
                              value={docNote}
                              onChange={(e) => setDocNote(e.target.value)}
                              placeholder="Changelog note — what changed and why (required)"
                              className="flex-1 min-w-[min(280px,100%)] bg-transparent border border-line-2 rounded-[10px] px-3 py-1.5 text-[13px] text-ink-1 placeholder:text-ink-3 focus:outline-none focus:border-[color:var(--accent-blue)]"
                            />
                            <button
                              onClick={saveDoctrine}
                              disabled={saving || docNote.trim().length < 10}
                              className="text-[12px] px-3 py-1.5 rounded-full transition-opacity hover:opacity-80 disabled:opacity-40"
                              style={dimStyle("neutral", true)}
                            >
                              {saving ? "cutting version…" : "save as new version"}
                            </button>
                            <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-full text-ink-3 hover:text-ink-1">
                              <X className="w-3.5 h-3.5" strokeWidth={1.5} /> cancel
                            </button>
                          </div>
                          <p className="text-[11px] text-ink-3">
                            Saving runs the real workflow: writes <span className="mono">v&#123;next&#125;.md</span> (H1 bumped, prior versions untouched),
                            prepends the changelog entry, updates <span className="mono">LATEST</span>, and git-commits all three.
                          </p>
                        </>
                      ) : (
                        <div className="flex items-center gap-3 flex-wrap">
                          <button
                            onClick={saveInPlace}
                            disabled={saving}
                            className="text-[12px] px-3 py-1.5 rounded-full transition-opacity hover:opacity-80 disabled:opacity-40"
                            style={dimStyle("neutral", true)}
                          >
                            {saving ? "saving…" : "save & commit"}
                          </button>
                          <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-full text-ink-3 hover:text-ink-1">
                            <X className="w-3.5 h-3.5" strokeWidth={1.5} /> cancel
                          </button>
                          <span className="text-[11px] text-ink-3">
                            {selectedSpec.kind === "code"
                              ? "Syntax-checked server-side — a hook that doesn't parse never reaches disk. Conflict-guarded (409 if changed on disk)."
                              : "Conflict-guarded: if the file changed on disk since load, the save 409s instead of clobbering."}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </Panel>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════ HOW IT WORKS ════ */}
      {data && tab === "how" && (
        <>
          <Panel>
            <PanelHeader
              title="How this system thinks — plain language, always current"
              meta={data.summary ? `generated ${ago(data.summary.generated_at)} from the live files` : undefined}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  {data.summary?.stale && (
                    <Pill title="A chain file changed — the server is regenerating this automatically">refreshing</Pill>
                  )}
                  <button
                    onClick={regenerate}
                    disabled={regenerating || data.generating}
                    className={`flex items-center gap-1.5 ${pillButton} disabled:opacity-50`}
                    style={dimStyle("neutral", true)}
                  >
                    <RefreshCw className={`w-3 h-3 text-ink-3 ${regenerating || data.generating ? "animate-spin" : ""}`} strokeWidth={1.5} />
                    {regenerating || data.generating ? "regenerating…" : "force regenerate"}
                  </button>
                </div>
              }
            />
            {data.summary ? (
              <Md content={data.summary.markdown} />
            ) : (
              <EmptyState
                title="Writing the explanation…"
                hint="The server generates this automatically from the live chain files. If it hasn't appeared in a few minutes, hit force regenerate."
              />
            )}
          </Panel>

          <div>
            <h2 className="label-caps mb-3">The loop — how a message becomes verified work</h2>
            <div className="flex flex-wrap items-stretch gap-2">
              {FLOW.map((step, i) => (
                <div key={step.name} className="contents">
                  <div className="flex-1 min-w-[170px] rounded-[10px] border border-line-3 p-3 flex flex-col">
                    <div className="label-caps text-ink-1"><span className="text-ink-3">{i + 1}</span> · {step.name}</div>
                    <div className="text-[11px] text-ink-3 mt-1 leading-snug flex-1">{step.desc}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {step.files.map((fid) => {
                        const f = data.chain.find((c) => c.id === fid);
                        return f ? (
                          <button
                            key={fid}
                            onClick={() => selectFile(fid)}
                            className="mono text-[10px] px-2 py-0.5 rounded-full border border-line-2 text-ink-2 hover:text-ink-1 hover:border-[color:var(--accent-blue)] transition-colors"
                            title={f.rel}
                          >
                            {f.name}
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                  {i < FLOW.length - 1 && (
                    <div className="hidden xl:flex items-center text-ink-3"><ArrowRight className="w-4 h-4" strokeWidth={1.5} /></div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[12px] text-ink-3 mt-2">
              Trivial turns skip straight from Judge to Respond — no ISA, no ceremony. Dynamic range is the design goal:
              seconds on almost nothing, or agents + audits + days, discovered from the work and its evidence gates.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <StatTile label="Claims" value={data.claims.total} sub="what must be true when a run completes" />
            <StatTile label="Hook" value={data.claims.hook} sub="teeth that block mechanically — no honor system" />
            <StatTile label="Check" value={data.claims.check} sub="gates the run executes and records" />
            <StatTile label="Self" value={data.claims.self} sub="honest self-attestation, watched for decay" />
            <StatTile label="Versions" value={data.versions.length >= 20 ? "20+" : data.versions.length} sub={`current v${data.version} · every edit is a new frozen version`} />
          </div>

          {evals && evals.length > 0 && (
            <div>
              <h2 className="label-caps mb-1">Evals — verification suites (elected, not required)</h2>
              <p className="text-[12px] text-ink-3 mb-3">
                pass^k across trials for the behavioural regression class the Algorithm elects. A config-change fires the configured dispositions suite automatically.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                {evals.map((s) => (
                  <div key={s.suite} className="rounded-[10px] border border-line-3 p-4">
                    <div className="label-caps mb-2 break-all">{s.suite}</div>
                    <div className="mono text-2xl leading-none text-ink-1">
                      {Math.round((s.pass_to_k ?? 0) * 100)}%
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-ink-3 mt-1.5">
                      <Marker dim={s.passed ? "ok" : "err"} />
                      <span>pass^k · {s.passed ? "passing" : "REGRESSED"} · {s.cases?.length ?? 0} cases</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {data?.errors && (
        <div className="text-[11px] text-ink-3">degraded probes: {Object.keys(data.errors).join(", ")}</div>
      )}
    </PageShell>
  );
}
