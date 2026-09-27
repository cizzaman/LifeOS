"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import Link from "next/link";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  content: string;
  onWikiLinkClick?: (slug: string) => void;
}

// Transform [[wikilinks]] into <a> tags before rendering
function preprocessWikilinks(content: string): string {
  return content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, slug, label) => {
      const displayText = label || slug;
      const href = slug.trim().toLowerCase().replace(/\s+/g, "-");
      return `<a href="/system?doc=${href}" class="wikilink" data-slug="${href}">${displayText}</a>`;
    }
  );
}

// Strip YAML frontmatter from content
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? content.slice(match[0].length) : content;
}

const LINK =
  "text-ink-1 underline decoration-1 decoration-line-3 underline-offset-[3px] transition-colors hover:decoration-[color:var(--accent-blue)]";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="font-display font-medium text-[28px] leading-tight text-ink-1 mb-6 pb-3 border-b border-line-2">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-display font-medium text-xl text-ink-1 mt-8 mb-4">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-display font-medium text-base text-ink-1 mt-6 mb-3">
      {children}
    </h3>
  ),
  h4: ({ children }) => <h4 className="label-caps mt-6 mb-2">{children}</h4>,
  h5: ({ children }) => <h5 className="label-caps mt-5 mb-2">{children}</h5>,
  h6: ({ children }) => <h6 className="label-caps text-ink-3 mt-5 mb-2">{children}</h6>,
  p: ({ children }) => (
    <p className="text-sm text-ink-2 leading-relaxed mb-4">
      {children}
    </p>
  ),
  a: ({ href, children, className, ...props }) => {
    // Wikilink (preprocessed)
    if (className === "wikilink" || href?.startsWith("/system?doc=")) {
      const slug = (props as Record<string, string>)["data-slug"] || href?.replace("/system?doc=", "") || "";
      return (
        <Link href={`/system?doc=${slug}`} className={LINK}>
          {children}
        </Link>
      );
    }
    // External link
    if (href?.startsWith("http")) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
          {children}
        </a>
      );
    }
    // Internal link
    return (
      <Link href={href || "#"} className={LINK}>
        {children}
      </Link>
    );
  },
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className={`${className} mono text-xs text-ink-1`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="mono px-1.5 py-0.5 text-xs bg-surface-1 text-ink-1 border border-line-2">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mono rounded-[10px] bg-surface-1 border border-line-2 p-4 mb-4 overflow-x-auto text-xs leading-relaxed text-ink-1">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-xs border-collapse border border-line-2">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  th: ({ children }) => (
    <th className="label-caps px-3 py-2 text-left border-b border-line-2">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-ink-2 border-b border-line-1">
      {children}
    </td>
  ),
  tr: ({ children }) => <tr>{children}</tr>,
  blockquote: ({ children }) => (
    <blockquote className="border-l border-line-3 pl-4 py-1 my-4 text-ink-2">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => (
    <ul className="list-none space-y-1 mb-4 pl-4">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 mb-4 pl-6 text-sm text-ink-2 marker:text-ink-3 marker:font-mono">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-sm text-ink-2 leading-relaxed relative pl-3 before:content-['–'] before:absolute before:left-0 before:text-ink-3">
      {children}
    </li>
  ),
  hr: () => <hr className="border-line-2 my-6" />,
  img: ({ src, alt }) => (
    <img src={src} alt={alt || ""} className="rounded-[10px] border border-line-2 max-w-full my-4" />
  ),
  strong: ({ children }) => <strong className="text-ink-1 font-medium">{children}</strong>,
  em: ({ children }) => <em className="text-ink-2 italic">{children}</em>,
};

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const processed = preprocessWikilinks(stripFrontmatter(content));

  return (
    <div className="wiki-content max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={components}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
