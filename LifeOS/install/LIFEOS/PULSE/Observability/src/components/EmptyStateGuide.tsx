"use client";

import { Sparkles, MessageSquare, FolderOpen, BookOpen } from "lucide-react";

interface EmptyStateGuideProps {
  /** What this section is — used in the headline. e.g. "Telos", "Knowledge Archive". */
  section: string;
  /** Short sentence describing what kind of content lives here. */
  description: string;
  /** Subdir under LIFEOS/USER/ that holds this section's data, if any. e.g. "TELOS". */
  userDir?: string;
  /** Concrete interview command to surface. Defaults to "/interview". */
  interviewCommand?: string;
  /** Optional CTA-style example prompt the user can paste to the DA. */
  daPromptExample?: string;
  /** Hide a path if it doesn't apply (e.g. some sections aren't interview-driven). */
  hideInterview?: boolean;
}

export default function EmptyStateGuide({
  section,
  description,
  userDir,
  interviewCommand = "/interview",
  daPromptExample,
  hideInterview = false,
}: EmptyStateGuideProps) {
  const userPath = userDir ? `~/.claude/LIFEOS/USER/${userDir}/` : "~/.claude/LIFEOS/USER/";
  const readmePath = userDir ? `~/.claude/LIFEOS/USER/${userDir}/README.md` : "~/.claude/LIFEOS/USER/README.md";
  const defaultDaPrompt = daPromptExample ?? `help me set up my ${section.toLowerCase()}`;

  return (
    <div className="rounded-[10px] border border-line-3 p-6">
      <div className="mb-4">
        <h3 className="text-base font-medium text-ink-1">
          {section} is empty — let's fill it in
        </h3>
        <p className="text-sm text-ink-2 mt-1">{description}</p>
      </div>

      <div className="space-y-2.5">
        {!hideInterview && (
          <div className="flex items-start gap-2.5 text-sm">
            <MessageSquare className="w-4 h-4 text-ink-3 mt-0.5 shrink-0" strokeWidth={1.5} />
            <div>
              <span className="text-ink-1">Run </span>
              <code className="mono text-xs text-ink-1">
                {interviewCommand}
              </code>
              <span className="text-ink-2">
                {" "}— your DA walks you through the questions and writes the answers to disk.
              </span>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2.5 text-sm">
          <FolderOpen className="w-4 h-4 text-ink-3 mt-0.5 shrink-0" strokeWidth={1.5} />
          <div className="min-w-0 break-words">
            <span className="text-ink-1">Edit files at </span>
            <code className="mono text-xs text-ink-1 break-all">
              {userPath}
            </code>
            <span className="text-ink-2">
              {" "}— or import existing data (Obsidian, Notion, journals) with the{" "}
            </span>
            <code className="mono text-xs text-ink-1">
              Migrate
            </code>
            <span className="text-ink-2"> skill.</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 text-sm">
          <BookOpen className="w-4 h-4 text-ink-3 mt-0.5 shrink-0" strokeWidth={1.5} />
          <div className="min-w-0 break-words">
            <span className="text-ink-1">Read </span>
            <code className="mono text-xs text-ink-1 break-all">
              {readmePath}
            </code>
            <span className="text-ink-2"> for the full layout and customization guide.</span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 text-sm pt-1">
          <Sparkles className="w-4 h-4 text-ink-3 mt-0.5 shrink-0" strokeWidth={1.5} />
          <div>
            <span className="text-ink-1">Or just ask your DA: </span>
            <span className="text-ink-2">"{defaultDaPrompt}"</span>
          </div>
        </div>
      </div>
    </div>
  );
}
