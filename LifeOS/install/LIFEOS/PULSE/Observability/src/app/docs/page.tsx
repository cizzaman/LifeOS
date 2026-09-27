"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import MarkdownRenderer from "@/components/wiki/MarkdownRenderer";
import WikiMeta from "@/components/wiki/WikiMeta";
import Link from "next/link";
import { wikiPageUrl } from "@/lib/wiki-links";
import { PageShell, PageHeader, Panel, StatTile, Pill } from "@/components/ui/chrome";

interface TreeNode {
  label: string;
  slug?: string;
  category?: string;
  children?: TreeNode[];
  count?: number;
}

interface WikiPage {
  slug: string;
  title: string;
  category: string;
  tags?: string[];
  quality?: number;
  lastModified: string;
  wordCount: number;
  group?: string;
}

interface WikiIndex {
  tree: TreeNode[];
  recentChanges: WikiPage[];
  stats: { totalSystem: number };
}

interface PageDetail {
  slug: string;
  title: string;
  category: string;
  content: string;
  wordCount: number;
  lastModified: string;
  backlinks: Array<{ slug: string; title: string; category: string }>;
  wikilinks: string[];
  tags?: string[];
  quality?: number;
  filePath?: string;
  group?: string;
}

// The card look, matching chrome Panel + hover, applied to Link elements.
const CARD_CLASS =
  "flex flex-col gap-2 bg-transparent border border-line-3 rounded-[10px] p-5 transition-colors duration-200 hover:border-[color:var(--accent-blue)] hover:bg-[color:var(--primary-soft)]";

const START_HERE_SLUGS = [
  {
    slug: "PAISystemArchitecture",
    tagline: "The master architecture document — every subsystem in context",
  },
  {
    slug: "LifeOs__LifeOsThesis",
    tagline: "Why LifeOS exists — the Life Operating System thesis",
  },
  {
    slug: "ARCHITECTURE_SUMMARY",
    tagline: "One-page architecture summary — auto-generated, always current",
  },
];

function qualityLabel(quality: number | undefined): string {
  if (quality === undefined) return "quality n/a";
  return `${Math.round(quality * 100)}% quality`;
}

function flattenTree(nodes: TreeNode[] | undefined): TreeNode[] {
  if (!nodes) return [];
  const out: TreeNode[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children) out.push(...flattenTree(n.children));
  }
  return out;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="label-caps mb-4">{children}</h2>;
}

function DocsLanding({ data }: { data: WikiIndex }) {
  const documentationNode =
    data.tree.find((n) => n.label.toLowerCase() === "documentation") ?? null;

  const groups: TreeNode[] = documentationNode?.children ?? [];

  const allLeaves = flattenTree(groups).filter((n) => n.slug);

  const slugToNode = new Map<string, TreeNode>();
  for (const leaf of allLeaves) {
    if (leaf.slug) slugToNode.set(leaf.slug, leaf);
  }

  type StartHereEntry = {
    slug: string;
    tagline: string;
    title: string;
    category: string | undefined;
  };

  const startHere: StartHereEntry[] = START_HERE_SLUGS.flatMap((entry) => {
    const node = slugToNode.get(entry.slug);
    if (!node) return [];
    return [{ slug: entry.slug, tagline: entry.tagline, title: node.label, category: node.category }];
  });

  return (
    <div className="h-full overflow-y-auto">
      <PageShell>
        <PageHeader
          title="Docs"
          subtitle="LifeOS subsystem architecture, algorithm, and reference"
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Documents" value={data.stats.totalSystem} />
          <StatTile label="Sections" value={groups.length} />
        </div>

        {startHere.length > 0 && (
          <div>
            <SectionHeading>Start Here</SectionHeading>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {startHere.map((entry) => (
                <Link
                  key={entry.slug}
                  href={wikiPageUrl(entry.category ?? "system-doc", entry.slug)}
                  className={`${CARD_CLASS} group`}
                >
                  <div className="text-base font-medium text-ink-1">{entry.title}</div>
                  <div className="text-[13px] leading-relaxed text-ink-2">{entry.tagline}</div>
                  <div className="mt-auto flex items-center gap-3 pt-2">
                    <Pill>start here</Pill>
                    <span className="label-caps text-ink-3 group-hover:text-ink-1 transition-colors">Open</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {groups.length > 0 && (
          <div>
            <SectionHeading>Browse by Section</SectionHeading>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {groups.map((group) => {
                const firstChild = group.children?.find((c) => c.slug);
                const href =
                  firstChild && firstChild.slug
                    ? wikiPageUrl(firstChild.category ?? "system-doc", firstChild.slug)
                    : "#";

                return (
                  <Link key={group.label} href={href} className={CARD_CLASS}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="label-caps text-ink-1 break-words min-w-0">{group.label}</div>
                      {group.count !== undefined && (
                        <span className="mono text-[11px] text-ink-3 shrink-0">{group.count}</span>
                      )}
                    </div>
                    <div className="text-[13px] text-ink-2 leading-relaxed">
                      {(group.children ?? [])
                        .filter((c) => c.slug)
                        .slice(0, 3)
                        .map((c) => c.label)
                        .join(" · ")}
                      {(group.children?.length ?? 0) > 3 && " · …"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {data.recentChanges.length > 0 && (
          <div>
            <SectionHeading>Recently Updated</SectionHeading>
            <Panel className="p-0">
              <div className="divide-y divide-line-2">
                {data.recentChanges.slice(0, 6).map((page, index) => (
                  <Link
                    key={page.slug}
                    href={wikiPageUrl(page.category, page.slug)}
                    className="flex items-center gap-4 px-5 py-3 group"
                  >
                    <div className="mono text-[11px] text-ink-3 shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] text-ink-2 group-hover:text-ink-1 transition-colors break-words">
                        {page.title}
                      </div>
                      <div className="mono text-[11px] text-ink-3">
                        {page.category} · {page.wordCount.toLocaleString()} words
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 shrink-0">
                      <Pill>updated</Pill>
                      <span className="mono text-[11px] text-ink-3">
                        {new Date(page.lastModified).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <Pill className="shrink-0">
                      {qualityLabel(page.quality)}
                    </Pill>
                  </Link>
                ))}
              </div>
            </Panel>
          </div>
        )}
      </PageShell>
    </div>
  );
}

function DocsPageInner() {
  const searchParams = useSearchParams();
  const docSlug = searchParams.get("doc");
  const isViewing = !!docSlug;

  const { data: indexData } = useQuery<WikiIndex>({
    queryKey: ["wiki-index"],
    queryFn: async () => {
      const res = await fetch("/api/wiki");
      if (!res.ok) throw new Error("Failed to fetch wiki index");
      return res.json();
    },
    staleTime: 30_000,
    enabled: !isViewing,
  });

  const { data: docDetail } = useQuery<PageDetail>({
    queryKey: ["wiki-doc", docSlug],
    queryFn: async () => {
      const res = await fetch(`/api/wiki/doc/${docSlug}`);
      if (!res.ok) throw new Error("Failed to fetch doc");
      return res.json();
    },
    enabled: isViewing,
  });

  if (isViewing && docDetail) {
    return (
      <div className="flex h-full max-md:flex-col max-md:h-auto">
        {/* inline flex: `flex-1` here loses its grow to an unlayered CSS rule and collapses the body to width 0 — inline restores it */}
        <div className="flex-1 overflow-y-auto p-6 max-sm:p-4 max-w-4xl" style={{ flex: "1 1 auto", minWidth: 0 }}>
          <MarkdownRenderer content={docDetail.content} />
        </div>
        <WikiMeta
          title={docDetail.title}
          category={docDetail.category}
          tags={docDetail.tags}
          quality={docDetail.quality}
          lastModified={docDetail.lastModified}
          wordCount={docDetail.wordCount}
          backlinks={docDetail.backlinks}
          filePath={docDetail.filePath}
          className="max-md:w-full max-md:h-auto max-md:border-l-0 max-md:border-t"
        />
      </div>
    );
  }

  if (!isViewing && indexData) {
    return <DocsLanding data={indexData} />;
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-[13px] text-ink-3">Loading...</div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <div className="text-[13px] text-ink-3">Loading...</div>
        </div>
      }
    >
      <DocsPageInner />
    </Suspense>
  );
}
