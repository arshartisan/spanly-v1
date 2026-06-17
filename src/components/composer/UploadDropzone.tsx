"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostTypeKey } from "@/lib/schemas/post";
import type { UploadedMedia } from "./types";

const ACCEPT: Record<Exclude<PostTypeKey, "text">, { accept: string; helper: string }> = {
  image: { accept: "image/*,application/pdf", helper: "Image(s) or PDF" },
  video: { accept: "video/*", helper: "Video" },
};

/**
 * Upload affordance for image/video posts (doc 01/06). Click, drag-drop, or paste.
 * The actual presign→PUT→finalize round-trip lives in the parent (Composer); this just
 * surfaces files and renders the attached thumbnails.
 */
export function UploadDropzone({
  type,
  media,
  busy,
  onFiles,
  onRemove,
}: {
  type: "image" | "video";
  media: UploadedMedia[];
  busy: boolean;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const cfg = ACCEPT[type];

  function pick(files: FileList | null) {
    if (!files || files.length === 0) return;
    onFiles(Array.from(files));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onPaste={(e) => pick(e.clipboardData.files)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging
            ? "border-primary bg-primary/10"
            : "border-border/70 bg-card/30 hover:border-primary/50 hover:bg-primary/5",
        )}
      >
        {busy ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">Click to upload or drag and drop</p>
        <p className="text-xs text-muted-foreground">or hover and paste from clipboard</p>
        <p className="text-xs text-muted-foreground">{cfg.helper}</p>
        <input
          ref={inputRef}
          type="file"
          accept={cfg.accept}
          multiple
          hidden
          onChange={(e) => pick(e.target.files)}
        />
      </div>

      {media.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {media.map((m) => (
            <div
              key={m.id}
              className="group relative h-20 w-20 overflow-hidden rounded-xl border border-border/70 bg-muted"
            >
              {m.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] uppercase text-muted-foreground">
                  {m.kind}
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(m.id)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove media"
              >
                <X className="h-3 w-3" />
              </button>
              <span className="absolute bottom-0 left-0 bg-black/60 px-1 text-[10px] text-white">
                {m.order + 1}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
