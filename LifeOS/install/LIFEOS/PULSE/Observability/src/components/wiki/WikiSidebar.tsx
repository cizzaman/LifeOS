"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { wikiPageUrl, WIKI_GRAPH_URL } from "@/lib/wiki-links";
import {
  ChevronRight,
  BookOpen,
  Cpu,
  Layers,
  Server,
  FileText,
  FlaskConical,
  GraduationCap,
  Users,
  Building2,
  Lightbulb,
  Search,
  Network,
  Library,
  BookCopy,
  Sparkles,
  Workflow,
  Folder,
  Compass,
  ShieldCheck,
  Webhook,
  TreePine,
  Zap,
  Bot,
  Heart,
  Database,
  Bell,
  Eye,
  Activity,
  Wrench,
  GitBranch,
  Radio,
} from "lucide-react";

interface TreeNode {
  label: string;
  slug?: string;
  category?: string;
  children?: TreeNode[];
  count?: number;
  icon?: string;
}

interface WikiSidebarProps {
  tree: TreeNode[];
  onSearchClick: () => void;
  className?: string;
}

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  // Top-level tree nodes
  "Knowledge Archive": Library,
  Documentation: BookCopy,
  // Documentation groups (one per LIFEOS/DOCUMENTATION/ subfolder + Overview)
  Overview: Compass,
  Agents: Bot,
  Algorithm: Cpu,
  Arbol: TreePine,
  Config: Wrench,
  Delegation: GitBranch,
  Fabric: Layers,
  Feed: Radio,
  Hooks: Webhook,
  LifeOs: Heart,
  Memory: Database,
  Notifications: Bell,
  Observability: Eye,
  Pulse: Activity,
  Security: ShieldCheck,
  Skills: Zap,
  Tools: Server,
  // Memory object types
  People: Users,
  Companies: Building2,
  Ideas: Lightbulb,
  Blogs: FileText,
  Books: BookOpen,
  Research: FlaskConical,
  ISAs: Workflow,
  Lessons: GraduationCap,
  Wisdom: Sparkles,
  // Fallback
  Other: Folder,
};

function TreeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const hasChildren = node.children && node.children.length > 0;
  const Icon = CATEGORY_ICONS[node.label] || FileText;

  const linkPath = node.slug && node.category
    ? wikiPageUrl(node.category, node.slug)
    : undefined;

  const isActive = linkPath && pathname === linkPath;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-[13px] text-left rounded-[10px] text-ink-2 hover:text-ink-1 transition-colors"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight
            className={cn("w-3 h-3 shrink-0 text-ink-3 transition-transform", expanded && "rotate-90")}
            strokeWidth={1.5}
          />
          <Icon className="w-3.5 h-3.5 shrink-0 text-ink-3" strokeWidth={1.5} />
          <span className="min-w-0 break-words">{node.label}</span>
          {node.count !== undefined && (
            <span className="ml-auto mono text-[11px] text-ink-3">{node.count}</span>
          )}
        </button>
        {expanded && (
          <div className="mt-0.5">
            {node.children!.map((child, i) => (
              <TreeItem key={child.slug || child.label + i} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Leaf node
  return (
    <Link
      href={linkPath || "#"}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 text-[13px] rounded-[10px] border transition-colors",
        isActive
          ? "text-ink-1 bg-[color:var(--primary-soft)] border-[color:var(--accent-blue)]"
          : "text-ink-2 border-transparent hover:text-ink-1"
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <span className="w-1 h-1 rounded-full bg-current shrink-0 opacity-40" />
      <span className="min-w-0 break-words">{node.label}</span>
    </Link>
  );
}

export default function WikiSidebar({ tree, onSearchClick, className }: WikiSidebarProps) {
  return (
    <aside className={cn("w-64 shrink-0 border-r border-line-2 bg-[color:var(--panel)] overflow-y-auto h-[calc(100vh-3.5rem)]", className)}>
      {/* Search trigger */}
      <div className="p-3 border-b border-line-2">
        <button
          onClick={onSearchClick}
          className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-ink-3 rounded-[10px] border border-line-2 bg-transparent hover:border-[color:var(--accent-blue)] hover:text-ink-1 transition-colors"
        >
          <Search className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>Search...</span>
          <kbd className="ml-auto mono text-[10px] text-ink-3">⌘K</kbd>
        </button>
      </div>

      {/* Graph link — one graph over the whole memory corpus */}
      <div className="px-3 pt-3 pb-1">
        <Link
          href={WIKI_GRAPH_URL}
          className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-ink-2 rounded-[10px] hover:text-ink-1 transition-colors"
        >
          <Network className="w-3.5 h-3.5 text-ink-3" strokeWidth={1.5} />
          <span>Graph</span>
        </Link>
      </div>

      {/* Tree navigation — memory object types render directly, no section
          header (2026-07-19 directive: it's all just objects in memory). */}
      <nav className="p-3 space-y-1">
        {(() => {
          const docNodes = tree.filter((n) => n.label === "Documentation");
          const memoryNodes = tree.filter((n) => n.label !== "Documentation");
          return (
            <>
              {docNodes.length > 0 && (
                <div className="mb-3">
                  <div className="label-caps px-2 mb-2">Documentation</div>
                  {docNodes.map((node, i) => (
                    <TreeItem key={node.label + i} node={node} />
                  ))}
                </div>
              )}

              {memoryNodes.map((node, i) => (
                <TreeItem key={node.label + i} node={node} />
              ))}
            </>
          );
        })()}
      </nav>
    </aside>
  );
}
