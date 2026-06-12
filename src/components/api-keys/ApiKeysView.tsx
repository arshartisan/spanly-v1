"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiKeyView } from "@/server/api-keys";
import type { WebhookView } from "@/server/webhooks";

// API Keys page (doc 12). Add-on gating banner + key management (copy-once secret) + webhook
// config + API docs. All actions no-op server-side without the add-on; UI mirrors that.
export function ApiKeysView({
  addonActive,
  initialKeys,
  initialWebhook,
}: {
  addonActive: boolean;
  initialKeys: ApiKeyView[];
  initialWebhook: WebhookView | null;
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ name: string; plaintext: string } | null>(null);

  async function createKey() {
    if (!newName.trim()) return;
    setBusy(true);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok) {
      setKeys((k) => [data.key, ...k]);
      setRevealed({ name: data.key.name, plaintext: data.plaintext });
      setNewName("");
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    if (res.ok) setKeys((k) => k.filter((x) => x.id !== id));
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">API Keys</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage API keys for programmatic access to your account.
          </p>
        </div>
        <Button disabled={!addonActive || creating} onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" /> Create API Key
        </Button>
      </div>

      {!addonActive && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">API Access Required</p>
            <p className="mt-0.5 text-sm text-amber-800">
              API access is not included in your current subscription. To create and manage API
              keys, enable the API add-on for your plan.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href="/settings/billing">Manage Billing</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Copy-once secret reveal */}
      {revealed && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium">Your new API key “{revealed.name}”</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Copy it now — for your security, it won't be shown again.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-background px-3 py-2 font-mono text-xs">
              {revealed.plaintext}
            </code>
            <CopyButton value={revealed.plaintext} />
          </div>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => setRevealed(null)}>
            I've saved it
          </Button>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <div className="flex items-center gap-2 rounded-xl border bg-muted/30 p-4">
          <Input
            autoFocus
            placeholder="Key name (e.g. Production server)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={60}
          />
          <Button disabled={busy || !newName.trim()} onClick={createKey}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
          <Button variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Keys list */}
      <section className="rounded-xl border bg-background">
        {keys.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <KeyRound className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No API keys yet</p>
            <p className="text-xs text-muted-foreground">
              Create your first API key to start using the Spanly API.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{k.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{k.maskedKey}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Created {formatDate(k.createdAt)} ·{" "}
                    {k.lastUsedAt ? `last used ${formatDate(k.lastUsedAt)}` : "never used"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => revoke(k.id)}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <WebhookCard addonActive={addonActive} initial={initialWebhook} />

      {/* API documentation */}
      <section className="rounded-xl border bg-background p-5">
        <h2 className="text-sm font-semibold">API Documentation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Authenticate requests with{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">Authorization: Bearer &lt;key&gt;</code>.
          Endpoints: <code className="rounded bg-muted px-1 py-0.5 text-xs">GET /api/v1/me</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">GET /api/v1/accounts</code>,{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">POST /api/v1/posts</code>.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Keep your API keys secure and never expose them in client-side code or public
          repositories.
        </p>
      </section>
    </div>
  );
}

function WebhookCard({ addonActive, initial }: { addonActive: boolean; initial: WebhookView | null }) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [secret, setSecret] = useState(initial?.secret ?? null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    const res = await fetch("/api/webhook", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && data?.webhook) {
      setSecret(data.webhook.secret);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <section className="rounded-xl border bg-background p-5">
      <h2 className="text-sm font-semibold">Webhook</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Get notified when a post finishes. We'll POST results to your URL, signed with{" "}
        <span className="font-medium">HMAC-SHA256</span> in the{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">X-Spanly-Signature</code> header.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Input
          placeholder="https://your-server.com/webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={!addonActive}
        />
        <Button disabled={!addonActive || busy || !url.trim()} onClick={save}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
        {saved && <Check className="h-4 w-4 text-primary" />}
      </div>
      {secret && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">Signing secret</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
              {secret}
            </code>
            <CopyButton value={secret} />
          </div>
        </div>
      )}
    </section>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(iso),
  );
}
