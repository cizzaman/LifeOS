"use client";

import { useQuery } from "@tanstack/react-query";
import WikiSidebar from "@/components/wiki/WikiSidebar";
import { openPalette } from "@/lib/palette/events";

interface TreeNode {
  label: string;
  slug?: string;
  category?: string;
  children?: TreeNode[];
  count?: number;
}

export default function LifeosLayout({ children }: { children: React.ReactNode }) {
  // ⌘K is handled globally by CommandPalette (opens WIKI-scoped on this route).
  const { data } = useQuery<{ tree: TreeNode[] }>({
    queryKey: ["wiki-tree"],
    queryFn: async () => {
      const res = await fetch("/api/wiki");
      if (!res.ok) throw new Error("Failed to fetch wiki index");
      return res.json();
    },
    staleTime: 30_000,
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] max-md:flex-col max-md:h-auto">
      <WikiSidebar tree={data?.tree || []} onSearchClick={() => openPalette("wiki")} className="max-md:w-full max-md:h-auto max-md:border-r-0 max-md:border-b" />
      <div className="flex-1 min-w-0 overflow-hidden max-md:overflow-visible">{children}</div>
    </div>
  );
}
