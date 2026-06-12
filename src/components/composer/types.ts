import type { Capability, PlatformKey } from "@/lib/platforms";

// View-models for the composer (docs/implementation/06). Kept free of any server-only
// import so the client component can consume them; the server page passes plain data.

export interface ComposerAccount {
  id: string;
  platform: PlatformKey;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  capabilities: Capability[];
}

export interface UploadedMedia {
  id: string;
  kind: "image" | "video" | "pdf";
  url: string;
  width?: number | null;
  height?: number | null;
  order: number;
  name: string;
}
