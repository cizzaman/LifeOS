"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import MarkdownRenderer from "@/components/wiki/MarkdownRenderer";
import WikiMeta from "@/components/wiki/WikiMeta";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { wikiPageUrl } from "@/lib/wiki-links";
import { PageShell, PageHeader, Panel, PanelHeader, StatTile, Pill } from "@/components/ui/chrome";

interface WikiPage {
  slug: string;
  title: string;
  category: string;
  tags?: string[];
  quality?: number;
  lastModified: string;
  wordCount: number;
}

interface WikiIndex {
  tree: unknown[];
  recentChanges: WikiPage[];
  stats: {
    totalPages: number;
    totalSystem: number;
    totalPeople: number;
    totalCompanies: number;
    totalIdeas: number;
    totalBooks: number;
  };
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
}

interface BookmarkDetail {
  slug: string;
  id: string;
  title: string;
  category: "bookmark";
  url: string;
  excerpt: string;
  note: string;
  folder: string;
  tags: string[];
  created: string;
  cover: string;
  favorite: boolean;
  wordCount: number;
  lastModified: string;
}

const pageLink = wikiPageUrl;

// Landing page — shown when no doc/knowledge is selected
function WikiLanding({ data }: { data: WikiIndex }) {
  const tiles: Array<{ label: string; count: number }> = [
    { label: "Total", count: data.stats.totalPages },
    { label: "System", count: data.stats.totalSystem },
    { label: "People", count: data.stats.totalPeople },
    { label: "Companies", count: data.stats.totalCompanies },
    { label: "Ideas", count: data.stats.totalIdeas },
    { label: "Books", count: data.stats.totalBooks },
  ];

  return (
    <PageShell>
      <PageHeader
        title="System"
        subtitle="System documentation & knowledge archive"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {tiles.map((t) => (
          <StatTile key={t.label} label={t.label} value={t.count} />
        ))}
      </div>

      {/* Recent changes */}
      <Panel>
        <PanelHeader title="Recent Changes" />
        <div className="flex flex-col">
          {data.recentChanges.slice(0, 20).map((page) => (
            <Link
              key={page.slug + page.category}
              href={pageLink(page.category, page.slug)}
              className="flex items-baseline gap-3 py-2 group"
            >
              {/* Knowledge-archive entries (people, companies, ideas…) are personal;
                  system docs stay readable in Observer mode. */}
              <span
                className="min-w-0 break-words text-[13px] text-ink-2 group-hover:text-ink-1 transition-colors"
                data-sensitive={page.category !== "system-doc" ? "" : undefined}
              >
                {page.title}
              </span>
              <span className="ml-auto mono text-[11px] text-ink-3 shrink-0">
                {new Date(page.lastModified).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              {page.quality != null && (
                <span className="mono text-[11px] text-ink-3 shrink-0">Q{page.quality}</span>
              )}
            </Link>
          ))}
        </div>
      </Panel>
    </PageShell>
  );
}

// Document viewer — shown when a doc or knowledge note is selected
function DocViewer({ detail }: { detail: PageDetail }) {
  return (
    <div className="flex h-full max-md:flex-col max-md:h-auto">
      {/* inline flex: `flex-1` here loses its grow to an unlayered CSS rule and collapses the body to width 0 — inline restores it */}
      <div className="flex-1 overflow-y-auto p-6 max-sm:p-4 max-w-4xl" style={{ flex: "1 1 auto", minWidth: 0 }}>
        <MarkdownRenderer content={detail.content} />
      </div>
      <WikiMeta
        title={detail.title}
        category={detail.category}
        tags={detail.tags}
        quality={detail.quality}
        lastModified={detail.lastModified}
        wordCount={detail.wordCount}
        backlinks={detail.backlinks}
        filePath={detail.filePath}
        className="max-md:w-full max-md:h-auto max-md:border-l-0 max-md:border-t"
      />
    </div>
  );
}

// Bookmark viewer — shown when a bookmark is selected
function BookmarkViewer({ detail }: { detail: BookmarkDetail }) {
  return (
    <PageShell className="max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className="label-caps">Bookmark</span>
          {detail.favorite && <span className="label-caps text-ink-3">Favorite</span>}
        </div>
        <h1 className="text-ink-1 break-words">{detail.title}</h1>
      </div>

      {/* URL */}
      {detail.url && (
        <a
          href={detail.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 mono text-[12px] text-ink-2 hover:text-ink-1 transition-colors break-all"
        >
          <ExternalLink className="w-3.5 h-3.5 shrink-0 text-ink-3" strokeWidth={1.5} />
          {detail.url}
        </a>
      )}

      {/* Cover image */}
      {detail.cover && (
        <div className="rounded-[10px] overflow-hidden border border-line-3">
          <img
            src={detail.cover}
            alt={detail.title}
            className="w-full max-h-64 object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      {/* Excerpt */}
      {detail.excerpt && (
        <Panel className="p-4">
          <div className="label-caps mb-2">Excerpt</div>
          <p className="text-[13px] text-ink-2 leading-relaxed">
            {detail.excerpt}
          </p>
        </Panel>
      )}

      {/* Note */}
      {detail.note && (
        <Panel className="p-4">
          <div className="label-caps mb-2">Note</div>
          <p className="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">
            {detail.note}
          </p>
        </Panel>
      )}

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 text-[13px]">
        {detail.folder && (
          <div>
            <span className="label-caps text-ink-3">Folder</span>
            <p className="text-ink-2 mt-0.5">{detail.folder}</p>
          </div>
        )}
        {detail.created && (
          <div>
            <span className="label-caps text-ink-3">Saved</span>
            <p className="text-ink-2 mt-0.5">
              {new Date(detail.created).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        )}
        {detail.tags.length > 0 && (
          <div className="col-span-2">
            <span className="label-caps text-ink-3">Tags</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1">
              {detail.tags.map((tag) => (
                <Pill key={tag} dim="neutral">{tag}</Pill>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function LifeosPageInner() {
  const searchParams = useSearchParams();
  const docSlug = searchParams.get("doc");
  const knowledgeCategory = searchParams.get("knowledge");
  const knowledgeSlug = searchParams.get("slug");
  const bookmarkSlug = searchParams.get("bookmark");

  const isViewingDoc = !!docSlug;
  const isViewingKnowledge = !!knowledgeCategory && !!knowledgeSlug;
  const isViewingBookmark = !!bookmarkSlug;
  const isViewing = isViewingDoc || isViewingKnowledge || isViewingBookmark;

  // Fetch wiki index (for landing page)
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

  // Fetch individual doc
  const { data: docDetail, isError: docError, error: docErr } = useQuery<PageDetail>({
    queryKey: ["wiki-doc", docSlug],
    queryFn: async () => {
      const res = await fetch(`/api/wiki/doc/${docSlug}`);
      if (!res.ok) throw new Error(`Failed to fetch doc: ${res.status} ${res.statusText}`);
      return res.json();
    },
    enabled: isViewingDoc,
    retry: false,
  });

  // Fetch individual knowledge note
  const { data: knowledgeDetail, isError: knowledgeError, error: knowledgeErr } = useQuery<PageDetail>({
    queryKey: ["wiki-knowledge", knowledgeCategory, knowledgeSlug],
    queryFn: async () => {
      const res = await fetch(`/api/wiki/knowledge/${knowledgeCategory}/${knowledgeSlug}`);
      if (!res.ok) throw new Error(`Failed to fetch knowledge note: ${res.status} ${res.statusText}`);
      return res.json();
    },
    enabled: isViewingKnowledge,
    retry: false,
  });

  // Fetch individual bookmark
  const { data: bookmarkDetail, isError: bookmarkError, error: bookmarkErr } = useQuery<BookmarkDetail>({
    queryKey: ["wiki-bookmark", bookmarkSlug],
    queryFn: async () => {
      const res = await fetch(`/api/wiki/bookmark/${bookmarkSlug}`);
      if (!res.ok) throw new Error(`Failed to fetch bookmark: ${res.status} ${res.statusText}`);
      return res.json();
    },
    enabled: isViewingBookmark,
    retry: false,
  });

  const detail = docDetail || knowledgeDetail;
  const fetchError = docError || knowledgeError || bookmarkError;
  const errorMessage =
    (docErr as Error | null)?.message ||
    (knowledgeErr as Error | null)?.message ||
    (bookmarkErr as Error | null)?.message ||
    "Unknown error";

  if (isViewingBookmark && bookmarkDetail) {
    // Bookmarks carry the principal's own notes — Observer mode blurs them.
    return (
      <div data-sensitive>
        <BookmarkViewer detail={bookmarkDetail} />
      </div>
    );
  }

  if (isViewing && detail) {
    return <DocViewer detail={detail} />;
  }

  if (!isViewing && indexData) {
    return <WikiLanding data={indexData} />;
  }

  // Error state — fetch failed (e.g. 404 for an unknown slug)
  if (isViewing && fetchError) {
    const requestedSlug = docSlug || knowledgeSlug || bookmarkSlug || "";
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 max-w-md mx-auto text-center">
        <div className="label-caps text-ink-1 mb-2">Page not found</div>
        <div className="mono text-[12px] text-ink-2 mb-4 break-all">{requestedSlug}</div>
        <div className="text-[13px] text-ink-3 mb-4">{errorMessage}</div>
        <Link
          href="/system"
          className="text-[13px] text-ink-2 underline underline-offset-2 hover:text-ink-1 transition-colors"
        >
          Back to wiki index
        </Link>
      </div>
    );
  }

  // Loading state
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-[13px] text-ink-3">Loading...</div>
    </div>
  );
}

export default function LifeosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <div className="text-[13px] text-ink-3">Loading...</div>
        </div>
      }
    >
      <LifeosPageInner />
    </Suspense>
  );
}
