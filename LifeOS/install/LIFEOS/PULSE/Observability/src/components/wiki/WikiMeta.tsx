"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { wikiPageUrl } from "@/lib/wiki-links";
import { Copy, Link as LinkIcon } from "lucide-react";
import { Marker, type Dim } from "@/components/ui/chrome";
import { cn } from "@/lib/utils";

interface Backlink {
  slug: string;
  title: string;
  category: string;
}

interface WikiMetaProps {
  title: string;
  category: string;
  tags?: string[];
  quality?: number;
  lastModified?: string;
  wordCount?: number;
  backlinks?: Backlink[];
  filePath?: string;
  author?: string;
  source?: string;
  sourceUrl?: string;
  postDate?: string;
  related?: Backlink[];
  className?: string;
}

function qualityDim(q: number): Dim {
  if (q >= 7) return "ok";
  if (q >= 4) return "warn";
  return "err";
}

function readingTime(words: number): string {
  const mins = Math.ceil(words / 200);
  return `${mins} min read`;
}

const categoryLink = wikiPageUrl;

function MetaBlock({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="label-caps mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function LinkList({ items }: { items: Backlink[] }) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <Link
          key={item.slug}
          href={categoryLink(item.category, item.slug)}
          className="block py-1 text-[13px] leading-snug text-ink-2 hover:text-ink-1 transition-colors break-words"
        >
          {item.title}
        </Link>
      ))}
    </div>
  );
}

export default function WikiMeta({
  title: _title,
  category,
  tags,
  quality,
  lastModified,
  wordCount,
  backlinks,
  filePath,
  author,
  source,
  sourceUrl,
  postDate,
  related,
  className,
}: WikiMetaProps) {
  void _title;

  return (
    <aside className={cn("w-56 shrink-0 border-l border-line-2 bg-transparent overflow-y-auto h-[calc(100vh-3.5rem)] p-4 space-y-5", className)}>
      {/* Category */}
      <div className="label-caps text-ink-1">{category.replace("-", " ")}</div>

      {author && (
        <MetaBlock label="Author">
          <div className="text-[13px] text-ink-1">{author}</div>
        </MetaBlock>
      )}

      {(source || sourceUrl) && (
        <MetaBlock label="Source">
          {source && <div className="text-[13px] text-ink-1 mb-1">{source}</div>}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener"
              className="flex items-start gap-1.5 text-xs text-ink-2 hover:text-ink-1 transition-colors break-all"
            >
              <LinkIcon className="w-3 h-3 shrink-0 mt-0.5 text-ink-3" strokeWidth={1.5} />
              <span>{sourceUrl.replace(/^https?:\/\//, "")}</span>
            </a>
          )}
        </MetaBlock>
      )}

      {/* Post date (original publication) */}
      {postDate && (
        <MetaBlock label="Published">
          <div className="mono text-xs text-ink-2">
            {(() => {
              // Parse YYYY-MM-DD as local date, not UTC, to avoid timezone shift.
              const m = postDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
              const d = m
                ? new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10))
                : new Date(postDate);
              return d.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              });
            })()}
          </div>
        </MetaBlock>
      )}

      {/* Quality (knowledge notes only) */}
      {quality !== undefined && (
        <MetaBlock label="Quality">
          <div className="flex items-center gap-2">
            <Marker dim={qualityDim(quality)} />
            <span className="mono text-[13px] text-ink-1">{quality}/10</span>
          </div>
        </MetaBlock>
      )}

      {/* Word count & reading time */}
      {wordCount !== undefined && (
        <MetaBlock label="Length">
          <div className="mono text-xs text-ink-2">{wordCount.toLocaleString()} words</div>
          <div className="mono text-xs text-ink-3 mt-1">{readingTime(wordCount)}</div>
        </MetaBlock>
      )}

      {lastModified && (
        <MetaBlock label="Updated">
          <div className="mono text-xs text-ink-2">
            {new Date(lastModified).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
        </MetaBlock>
      )}

      {tags && tags.length > 0 && (
        <MetaBlock label="Tags">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {tags.map((tag) => (
              <span key={tag} className="mono text-[10px] uppercase tracking-[0.1em] text-ink-2">
                {tag}
              </span>
            ))}
          </div>
        </MetaBlock>
      )}

      {/* Related (frontmatter cross-links) */}
      {related && related.length > 0 && (
        <MetaBlock label={`Related (${related.length})`}>
          <LinkList items={related} />
        </MetaBlock>
      )}

      {backlinks && backlinks.length > 0 && (
        <MetaBlock label={`Linked from (${backlinks.length})`}>
          <LinkList items={backlinks} />
        </MetaBlock>
      )}

      {/* File path (copy to clipboard) */}
      {filePath && (
        <div>
          <button
            onClick={() => navigator.clipboard.writeText(filePath)}
            className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink-1 transition-colors"
            title="Copy file path"
          >
            <Copy className="w-3 h-3" strokeWidth={1.5} />
            <span>Copy path</span>
          </button>
        </div>
      )}
    </aside>
  );
}
