"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Layers, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLATFORM_CONFIG } from "@/lib/platforms";
import {
  captionLimitFor,
  canSubmit,
  validatePostTargets,
  type PostTypeKey,
} from "@/lib/schemas/post";
import { AccountSelector } from "./AccountSelector";
import { CaptionField } from "./CaptionField";
import { ScheduleCard, type ComposerAction } from "./ScheduleCard";
import { UploadDropzone } from "./UploadDropzone";
import type { ComposerAccount, UploadedMedia } from "./types";

export interface InitialPost {
  id: string;
  type: PostTypeKey;
  status: "draft" | "scheduled" | "publishing" | "posted" | "failed";
  mainCaption: string;
  perPlatform: Record<string, string>;
  targets: string[];
  media: UploadedMedia[];
}

const TYPE_TITLE: Record<PostTypeKey, string> = {
  text: "Create text post",
  image: "Create image post",
  video: "Create video post",
  story: "Create story post",
};

const TYPE_TABS: { key: PostTypeKey; label: string }[] = [
  { key: "text", label: "Text" },
  { key: "image", label: "Image" },
  { key: "video", label: "Video" },
  { key: "story", label: "Story" },
];

function kindFor(mime: string): "image" | "video" | "pdf" {
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "image";
}

const REMEMBER_KEY = (type: PostTypeKey) => `spanly.composer.${type}`;

export function Composer({
  type,
  accounts,
  timezone,
  initialPost = null,
  initialDate,
}: {
  type: PostTypeKey;
  accounts: ComposerAccount[];
  timezone: string;
  initialPost?: InitialPost | null;
  initialDate?: string;
}) {
  const router = useRouter();
  const isEdit = initialPost !== null;
  const editable = !isEdit || initialPost.status === "draft" || initialPost.status === "scheduled";

  const [targets, setTargets] = useState<string[]>(initialPost?.targets ?? []);
  const [mainCaption, setMainCaption] = useState(initialPost?.mainCaption ?? "");
  const [perPlatform, setPerPlatform] = useState<Record<string, string>>(
    initialPost?.perPlatform ?? {},
  );
  const [media, setMedia] = useState<UploadedMedia[]>(initialPost?.media ?? []);
  const [activeTab, setActiveTab] = useState<string>("main"); // "main" | accountId
  const [platformCaptionsOpen, setPlatformCaptionsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [scheduleOn, setScheduleOn] = useState(Boolean(initialDate));
  const [scheduleTab, setScheduleTab] = useState<"time" | "queue">("time");
  const [date, setDate] = useState(initialDate ?? "");
  const [time, setTime] = useState("12:00");

  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState<ComposerAction | null>(null);
  const [busy, setBusy] = useState(false); // delete/duplicate
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ action: ComposerAction; publishAt?: string } | null>(null);

  // Restore remembered selection/settings (doc 01 "Remember" toggle) — create mode only.
  useEffect(() => {
    if (isEdit) return;
    try {
      const raw = localStorage.getItem(REMEMBER_KEY(type));
      if (!raw) return;
      const saved = JSON.parse(raw) as { targets?: string[]; remember?: boolean };
      if (saved.remember) {
        setRemember(true);
        const valid = (saved.targets ?? []).filter((id) => accounts.some((a) => a.id === id));
        setTargets(valid);
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, [type, accounts, isEdit]);

  const selectedAccounts = useMemo(
    () => accounts.filter((a) => targets.includes(a.id)),
    [accounts, targets],
  );
  const selectedPlatforms = selectedAccounts.map((a) => a.platform);
  const mainLimit = captionLimitFor(selectedPlatforms);

  const validationErrors = useMemo(
    () =>
      validatePostTargets({
        type,
        mainCaption,
        perPlatform,
        mediaCount: media.length,
        accounts: selectedAccounts,
      }),
    [type, mainCaption, perPlatform, media.length, selectedAccounts],
  );
  const invalidIds = useMemo(
    () => new Set(validationErrors.map((e) => e.socialAccountId)),
    [validationErrors],
  );

  const submitEnabled = canSubmit({
    type,
    targets,
    mainCaption,
    mediaCount: media.length,
    validationErrors,
  });

  const showPlatformCaptions = type !== "story" && selectedAccounts.length >= 2;
  const activeAccount = accounts.find((a) => a.id === activeTab);
  const activeLimit = activeAccount
    ? PLATFORM_CONFIG[activeAccount.platform].limits.captionMax
    : mainLimit;
  const activeValue = activeAccount ? perPlatform[activeTab] ?? "" : mainCaption;

  function toggleAccount(id: string) {
    setTargets((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function setActiveCaption(v: string) {
    if (activeAccount) setPerPlatform((p) => ({ ...p, [activeTab]: v }));
    else setMainCaption(v);
  }

  async function handleFiles(files: File[]) {
    setError(null);
    setUploading(true);
    try {
      // Story = exactly one media: replace the set.
      let order = type === "story" ? 0 : media.length;
      const next: UploadedMedia[] = type === "story" ? [] : [...media];
      const list = type === "story" ? files.slice(0, 1) : files;
      for (const file of list) {
        const presign = await fetch("/api/media/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        });
        if (!presign.ok) throw new Error("Could not start upload.");
        const { uploadUrl, publicUrl } = await presign.json();

        const put = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!put.ok) throw new Error("Upload failed.");

        const kind = kindFor(file.type);
        const finalize = await fetch("/api/media/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: publicUrl.split("/").slice(-3).join("/"),
            publicUrl,
            kind,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        });
        if (!finalize.ok) throw new Error("Could not save media.");
        const saved = await finalize.json();
        next.push({
          id: saved.id,
          kind: saved.kind,
          url: saved.url,
          width: saved.width,
          height: saved.height,
          order: order++,
          name: file.name,
        });
      }
      setMedia(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function removeMedia(id: string) {
    setMedia((prev) => prev.filter((m) => m.id !== id).map((m, i) => ({ ...m, order: i })));
  }

  function persistRemember(on: boolean) {
    setRemember(on);
    try {
      if (on) localStorage.setItem(REMEMBER_KEY(type), JSON.stringify({ remember: true, targets }));
      else localStorage.removeItem(REMEMBER_KEY(type));
    } catch {
      /* ignore */
    }
  }

  async function submit(action: ComposerAction) {
    setSubmitting(action);
    setError(null);
    try {
      const payload = {
        type,
        mainCaption,
        perPlatform,
        targets,
        media: media.map((m) => ({ mediaId: m.id, order: m.order })),
      };

      // 1. Persist: PATCH the existing post in edit mode, else POST a new draft.
      let id: string;
      if (isEdit) {
        const patch = await fetch(`/api/posts/${initialPost.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!patch.ok) throw new Error("Could not update the post.");
        id = initialPost.id;
      } else {
        const draftRes = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!draftRes.ok) throw new Error("Could not save the post.");
        id = (await draftRes.json()).id;
      }

      if (action === "draft") {
        if (remember) persistRemember(true);
        setSuccess({ action });
        return;
      }

      // 2. Transition to publishing / scheduled.
      let url = `/api/posts/${id}/publish`;
      let body: Record<string, unknown> = { targets };
      if (action === "schedule") {
        url = `/api/posts/${id}/schedule`;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || timezone;
        const publishAt = new Date(`${date}T${time}`).toISOString();
        body = { targets, publishAt, timezone: tz };
      } else if (action === "queue") {
        url = `/api/posts/${id}/queue`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          typeof data.error === "string"
            ? data.error
            : Array.isArray(data.error)
              ? data.error.flatMap((e: { errors: string[] }) => e.errors).join(" · ")
              : "Could not complete the action.";
        throw new Error(msg);
      }
      const out = await res.json();
      if (remember) persistRemember(true);

      // "Post now" → straight to the publishing progress/result screen (doc 09).
      if (action === "now") {
        router.push(`/publishing/${id}`);
        return;
      }
      setSuccess({ action, publishAt: out.publishAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${initialPost.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete the post.");
      router.push("/posts/all");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    if (!isEdit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${initialPost.id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error("Could not duplicate the post.");
      const { id } = await res.json();
      router.push(`/create/${type}?postId=${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not duplicate.");
      setBusy(false);
    }
  }

  function reset() {
    setSuccess(null);
    setError(null);
    setMainCaption("");
    setPerPlatform({});
    setMedia([]);
    setScheduleOn(false);
    if (!remember) setTargets([]);
  }

  if (success) {
    return <SuccessPanel type={type} success={success} onAnother={reset} />;
  }

  const disabledReason =
    targets.length === 0
      ? "Select an account to post to"
      : media.length === 0 && mainCaption.trim().length === 0
        ? "Add a caption or media"
        : validationErrors.length > 0
          ? "Fix the highlighted account(s) before posting"
          : null;

  const title = isEdit ? TYPE_TITLE[type].replace("Create", "Edit") : TYPE_TITLE[type];

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {isEdit ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={busy}>
              <Copy />
              Duplicate
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete} disabled={busy}>
              <Trash2 />
              Delete
            </Button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => persistRemember(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Remember accounts
          </label>
        )}
      </div>

      {!editable && (
        <div className="mb-4 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          This post is {initialPost.status}. It can&apos;t be edited — use Duplicate to make a new
          version.
        </div>
      )}

      {!isEdit && (
        <div className="mb-6 flex w-fit gap-1 rounded-lg bg-muted p-1 text-sm">
          {TYPE_TABS.map((t) => (
            <Link
              key={t.key}
              href={`/create/${t.key}`}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors",
                t.key === type ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Left: account row + composer body ── */}
        <div className="flex flex-col gap-6">
          <AccountSelector
            accounts={accounts}
            selected={targets}
            invalidIds={invalidIds}
            onToggle={toggleAccount}
          />

          {type !== "text" && (
            <UploadDropzone
              type={type}
              media={media}
              busy={uploading}
              onFiles={handleFiles}
              onRemove={removeMedia}
            />
          )}

          {type !== "story" && (
            <div className="flex flex-col gap-3">
              {/* Caption tabs (main + per-account when ≥2 selected) */}
              {showPlatformCaptions && platformCaptionsOpen && (
                <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm">
                  <CaptionTab
                    label="Main"
                    active={activeTab === "main"}
                    invalid={false}
                    onClick={() => setActiveTab("main")}
                  />
                  {selectedAccounts.map((a) => (
                    <CaptionTab
                      key={a.id}
                      label={a.handle}
                      active={activeTab === a.id}
                      invalid={invalidIds.has(a.id)}
                      onClick={() => setActiveTab(a.id)}
                    />
                  ))}
                </div>
              )}

              <CaptionField
                value={activeValue}
                onChange={setActiveCaption}
                limit={activeLimit}
                label={activeAccount ? `${activeAccount.handle} caption` : "Main Caption"}
                placeholder={
                  activeAccount
                    ? "Override the main caption for this account…"
                    : "Start writing your post here…"
                }
              />

              {showPlatformCaptions && (
                <button
                  type="button"
                  onClick={() => setPlatformCaptionsOpen((o) => !o)}
                  className={cn(
                    "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
                    platformCaptionsOpen && "border-primary text-primary",
                  )}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Platform Captions
                </button>
              )}
              {showPlatformCaptions && platformCaptionsOpen && (
                <p className="text-xs text-muted-foreground">
                  Customize the caption used for each account. Accounts without an override use the
                  main caption.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* ── Right: schedule card ── */}
        <ScheduleCard
          scheduleOn={scheduleOn}
          setScheduleOn={setScheduleOn}
          scheduleTab={scheduleTab}
          setScheduleTab={setScheduleTab}
          date={date}
          setDate={setDate}
          time={time}
          setTime={setTime}
          submitEnabled={submitEnabled && editable && !busy}
          submitting={submitting}
          onAction={submit}
          disabledReason={editable ? disabledReason : "This post can no longer be edited"}
        />
      </div>
    </div>
  );
}

function CaptionTab({
  label,
  active,
  invalid,
  onClick,
}: {
  label: string;
  active: boolean;
  invalid: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "max-w-[120px] truncate rounded-md px-3 py-1.5 font-medium transition-colors",
        active ? "bg-background shadow-sm" : "text-muted-foreground",
        invalid && "text-destructive",
      )}
    >
      {label}
    </button>
  );
}

function SuccessPanel({
  type,
  success,
  onAnother,
}: {
  type: PostTypeKey;
  success: { action: ComposerAction; publishAt?: string };
  onAnother: () => void;
}) {
  const message =
    success.action === "draft"
      ? "Saved to drafts."
      : success.action === "now"
        ? "Your post is publishing."
        : success.publishAt
          ? `Scheduled for ${new Date(success.publishAt).toLocaleString()}.`
          : "Scheduled.";
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 p-12 text-center">
      <CheckCircle2 className="h-12 w-12 text-primary" />
      <h2 className="text-xl font-semibold">{message}</h2>
      <div className="flex gap-3">
        <Button onClick={onAnother} variant="outline">
          <RotateCcw />
          Create another {type} post
        </Button>
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
