"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface SupportNoteVM {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; displayName: string | null; email: string };
}

// Support-notes panel for the user detail (doc 16). Lists notes newest-first and posts a
// new one to /api/admin/users/:id/notes, then router.refresh() to re-read from the RSC.

export function SupportNotes({
  userId,
  notes,
}: {
  userId: string;
  notes: SupportNoteVM[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addNote() {
    const trimmed = body.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not add the note.");
        return;
      }
      setBody("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-note">Add a support note</Label>
        <Textarea
          id="new-note"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Context for the next teammate who looks at this account…"
          maxLength={5000}
          className="bg-background/60"
        />
        {error ? <p className="text-xs text-status-failed">{error}</p> : null}
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={addNote}
            loading={pending}
            disabled={!body.trim()}
          >
            Add note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/60 px-6 py-10 text-center">
          <StickyNote className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No notes yet</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="glass flex flex-col gap-1.5 rounded-xl border border-border/50 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  {note.author.displayName ?? note.author.email}
                </span>
                <span title={note.createdAt.toLocaleString()}>
                  {formatDistanceToNow(note.createdAt, { addSuffix: true })}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {note.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
