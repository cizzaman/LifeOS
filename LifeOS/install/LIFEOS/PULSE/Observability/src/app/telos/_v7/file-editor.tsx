"use client";

// Click-to-edit markdown file editor for TELOS source files.
// Opens as a fixed-overlay modal. Fetches GET /api/telos/file?name=,
// PUTs /api/telos/file on save, calls onSaved() + onClose().

import { useCallback, useEffect, useState } from "react";
import { Marker } from "@/components/ui/chrome";
import { Icons } from "./icons";

export interface FileEditorProps {
  open: boolean;
  filename: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

interface TelosFilePayload {
  content?: unknown;
  error?: unknown;
}

async function responseError(res: Response): Promise<string> {
  try {
    const body = await res.json() as TelosFilePayload;
    return typeof body.error === "string" ? body.error : `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function FileEditor({ open, filename, onClose, onSaved }: FileEditorProps) {
  const [content, setContent] = useState<string>("");
  const [original, setOriginal] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const dirty = content !== original;

  const closeWithConfirm = useCallback(() => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    onClose();
  }, [dirty, onClose]);

  const save = useCallback(async () => {
    if (!filename || saving) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/telos/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: filename, content }),
      });
      if (!res.ok) throw new Error(await responseError(res));
      setOriginal(content);
      setStatus("Saved");
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [content, filename, onClose, onSaved, saving]);

  useEffect(() => {
    if (!open || !filename) {
      setContent("");
      setOriginal("");
      setError(null);
      setStatus(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setStatus(null);
    fetch(`/api/telos/file?name=${encodeURIComponent(filename)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await responseError(res));
        return res.json() as Promise<TelosFilePayload>;
      })
      .then((body) => {
        if (typeof body.content !== "string") throw new Error("invalid file response");
        setContent(body.content);
        setOriginal(body.content);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, filename]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeWithConfirm();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeWithConfirm, open, save]);

  if (!open || !filename) return null;

  return (
    <div className="telos-editor-backdrop" onClick={closeWithConfirm}>
      <div className="telos-editor" onClick={(event) => event.stopPropagation()}>
        <header className="telos-editor-head">
          <div className="telos-editor-name">{filename}</div>
          <button type="button" className="modal-x" onClick={closeWithConfirm} aria-label="Close editor">
            <Icons.X size={16} />
          </button>
        </header>
        <textarea
          className="telos-editor-text"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={loading || saving}
          spellCheck={false}
        />
        <footer className="telos-editor-foot">
          <div className="telos-editor-status">
            {error && <Marker dim="err" />}
            {error ?? status ?? (loading ? "Loading..." : dirty ? "Unsaved changes" : "Ready")}
          </div>
          <button type="button" className="telos-btn" onClick={closeWithConfirm} disabled={saving}>Cancel</button>
          <button type="button" className="telos-btn" onClick={() => void save()} disabled={loading || saving || !dirty}>
            {saving ? "Saving..." : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}
