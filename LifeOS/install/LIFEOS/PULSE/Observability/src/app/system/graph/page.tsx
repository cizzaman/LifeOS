"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { wikiPageUrl } from "@/lib/wiki-links";
import KnowledgeGraph from "@/components/wiki/KnowledgeGraph";
import { PageShell } from "@/components/ui/chrome";

interface GraphData {
  nodes: Array<{
    id: string;
    title: string;
    category: string;
    quality?: number;
    backlinkCount: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
  }>;
}

export default function GraphPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery<GraphData>({
    queryKey: ["wiki-graph"],
    queryFn: async () => {
      const res = await fetch("/api/wiki/graph");
      if (!res.ok) throw new Error("Failed to fetch graph data");
      return res.json();
    },
    staleTime: 60_000,
  });

  const handleNodeClick = (slug: string, category: string) => {
    router.push(wikiPageUrl(category, slug));
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="label-caps text-ink-3">Loading graph...</div>
      </div>
    );
  }

  return (
    <PageShell fullBleed className="h-full">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-line-2 shrink-0">
        <h1 className="label-caps">Knowledge Graph</h1>
        <span className="mono text-[10px] text-ink-3">
          {data.nodes.length} nodes · {data.edges.length} edges
        </span>

        {/* Legend — key colours are the graph node colour scale */}
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
          {[
            { label: "System", color: "#5cc4d8" },
            { label: "People", color: "#5cc4d8" },
            { label: "Companies", color: "#f5c451" },
            { label: "Ideas", color: "#a78bfa" },
          ].map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.1em] text-ink-2">
              <span className="fig-key is-round" style={{ color: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 overflow-hidden">
        <KnowledgeGraph
          nodes={data.nodes}
          edges={data.edges}
          onNodeClick={handleNodeClick}
        />
      </div>
    </PageShell>
  );
}
