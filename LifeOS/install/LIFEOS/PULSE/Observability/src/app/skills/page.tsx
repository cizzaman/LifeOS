"use client";

import { Suspense, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import MarkdownRenderer from "@/components/wiki/MarkdownRenderer";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  PageShell,
  PageHeader,
  Panel,
  StatTile,
  TabBar,
  Pill,
  Marker,
} from "@/components/ui/chrome";

interface SkillMeta {
  name: string;
  dir?: string;
  description: string;
  effort: string;
  hasWorkflows: boolean;
  lastModified: string;
}

// A skill is "private" purely by naming convention: its on-disk directory
// starts with "_" and the rest is all-caps (e.g. _EXAMPLE, _MY_TOOL).
// No skill names are hardcoded — whatever the user has that matches shows up.
function isPrivateSkill(skill: SkillMeta): boolean {
  const key = skill.dir ?? skill.name;
  return key.startsWith("_") && key === key.toUpperCase();
}

interface SkillDetail {
  name: string;
  description: string;
  effort: string;
  content: string;
  filePath: string;
  lastModified: string;
  wordCount: number;
}

function SkillsLanding({ skills }: { skills: SkillMeta[] }) {
  const [tab, setTab] = useState<"public" | "private">("public");
  const privateSkills = skills.filter(isPrivateSkill);
  const publicSkills = skills.filter((s) => !isPrivateSkill(s));
  const active = tab === "public" ? publicSkills : privateSkills;

  return (
    <PageShell>
      <PageHeader
        title="Skills"
        subtitle="Domain-specific capabilities that activate on trigger phrases. Each skill bundles prompts, workflows, tools, and templates into a self-contained unit."
      />

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 220px))" }}>
        <StatTile label="Skills" value={skills.length} />
      </div>

      <TabBar
        tabs={[
          { id: "public", label: "Public", hint: publicSkills.length },
          { id: "private", label: "Private", hint: privateSkills.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "private" && (
        <p className="-mt-2 text-[13px] text-ink-3">
          Prefixed with _ and all-caps — personal integrations and platform-specific
          automations, read live from your skills directory.
        </p>
      )}

      {/* Private skills describe personal domains — Observer mode blurs them. */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
        data-sensitive={tab === "private" ? "" : undefined}
      >
        {active.map((skill) => (
          <SkillCard key={skill.name} skill={skill} />
        ))}
      </div>
    </PageShell>
  );
}

function SkillCard({ skill }: { skill: SkillMeta }) {
  return (
    <Link href={`/skills?name=${encodeURIComponent(skill.name)}`} className="block">
      <Panel hover className="h-full flex flex-col gap-2">
        <span className="font-medium text-ink-1 break-words">{skill.name}</span>
        <p className="text-[13px] leading-relaxed text-ink-2 break-words">{skill.description}</p>
        <div className="flex items-center gap-3 mt-auto pt-1">
          <Pill>{skill.effort}</Pill>
          {skill.hasWorkflows && <Pill>workflows</Pill>}
        </div>
      </Panel>
    </Link>
  );
}

function SkillDetailView({ skill }: { skill: SkillDetail }) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(skill.content);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/wiki/skills/${encodeURIComponent(skill.name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-detail", skill.name] });
      setEditing(false);
    },
  });

  const btnBase =
    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border mono text-[11px] uppercase tracking-[0.12em] cursor-pointer transition-colors hover:border-[color:var(--accent-blue)] hover:text-ink-1";

  const isPrivate = skill.name.startsWith("_") && skill.name === skill.name.toUpperCase();

  return (
    <div
      className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-4"
      data-sensitive={isPrivate ? "" : undefined}
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/skills" aria-label="Back to skills" className="text-ink-3 hover:text-ink-1 transition-colors">
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-ink-1 break-words">{skill.name}</h1>
            <p className="mt-0.5 mono text-[11px] text-ink-3">
              {skill.wordCount} words ·{" "}
              {new Date(skill.lastModified).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => mutation.mutate(editContent)}
                disabled={mutation.isPending}
                className={`${btnBase} border-line-3 text-ink-1`}
                style={{
                  cursor: mutation.isPending ? "not-allowed" : "pointer",
                  opacity: mutation.isPending ? 0.6 : 1,
                }}
              >
                {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-3" strokeWidth={1.5} />}
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditContent(skill.content);
                }}
                className={`${btnBase} border-line-2 text-ink-2`}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setEditing(true);
                setEditContent(skill.content);
              }}
              className={`${btnBase} border-line-2 text-ink-2`}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {mutation.isError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] border border-line-2 text-[13px] text-ink-2">
          <Marker dim="err" />
          Failed to save changes.
        </div>
      )}

      {editing ? (
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="w-full h-[600px] rounded-[10px] p-4 text-[13px] mono resize-y bg-transparent border border-line-2 text-ink-1 outline-none focus:border-[color:var(--accent-blue)] transition-colors"
          spellCheck={false}
        />
      ) : (
        <Panel>
          <div className="prose prose-invert max-w-none">
            <MarkdownRenderer content={skill.content} />
          </div>
        </Panel>
      )}
    </div>
  );
}

function SkillsPageInner() {
  const searchParams = useSearchParams();
  const skillName = searchParams.get("name");
  const isViewing = !!skillName;

  const { data: listData } = useQuery<{ skills: SkillMeta[]; total: number }>({
    queryKey: ["skills-list"],
    queryFn: async () => {
      const res = await fetch("/api/wiki/skills");
      if (!res.ok) throw new Error("Failed to fetch skills");
      return res.json();
    },
    staleTime: 30_000,
    enabled: !isViewing,
  });

  const { data: detailData } = useQuery<SkillDetail>({
    queryKey: ["skill-detail", skillName],
    queryFn: async () => {
      const res = await fetch(`/api/wiki/skills/${encodeURIComponent(skillName!)}`);
      if (!res.ok) throw new Error("Failed to fetch skill");
      return res.json();
    },
    enabled: isViewing,
  });

  if (isViewing && detailData) {
    return <SkillDetailView skill={detailData} />;
  }

  if (!isViewing && listData) {
    return <SkillsLanding skills={listData.skills} />;
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-[13px] text-ink-3">Loading...</div>
    </div>
  );
}

export default function SkillsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <div className="text-[13px] text-ink-3">Loading...</div>
        </div>
      }
    >
      <SkillsPageInner />
    </Suspense>
  );
}
