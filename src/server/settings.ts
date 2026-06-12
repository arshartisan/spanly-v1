import "server-only";
import { prisma } from "@/server/db";
import {
  DEFAULT_SETTINGS,
  userSettingsSchema,
  type SettingsPatch,
  type UserSettings,
} from "@/lib/schemas/settings";

/**
 * Settings service (docs/implementation/11). The General tab is backed by the `User.settings`
 * JSON column (+ a few User scalar columns) and the Queue tab by `QueueSettings`/`QueueSlot`.
 */

/** Parse stored settings JSON, filling any missing keys with defaults (forward-compatible). */
export function readSettings(raw: unknown): UserSettings {
  const parsed = userSettingsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Merge partial/legacy JSON over defaults so older rows still resolve.
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    emailPrefs: { ...DEFAULT_SETTINGS.emailPrefs, ...(obj.emailPrefs as object) },
    platformPrefs: { ...DEFAULT_SETTINGS.platformPrefs, ...(obj.platformPrefs as object) },
    weeklyPostingGoal:
      typeof obj.weeklyPostingGoal === "number" ? obj.weeklyPostingGoal : DEFAULT_SETTINGS.weeklyPostingGoal,
    mcpUrl: typeof obj.mcpUrl === "string" ? obj.mcpUrl : undefined,
  };
}

/** Apply a partial patch to a user's profile columns + settings JSON. Returns merged settings. */
export async function updateSettings(userId: string, patch: SettingsPatch): Promise<UserSettings> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found.");
  const current = readSettings(user.settings);

  const next: UserSettings = {
    emailPrefs: { ...current.emailPrefs, ...patch.emailPrefs },
    platformPrefs: { ...current.platformPrefs, ...patch.platformPrefs },
    weeklyPostingGoal: patch.weeklyPostingGoal ?? current.weeklyPostingGoal,
    mcpUrl: patch.mcpUrl === null ? undefined : (patch.mcpUrl ?? current.mcpUrl),
  };

  const data: Record<string, unknown> = { settings: next };
  if (patch.displayName !== undefined) data.displayName = patch.displayName;
  if (patch.avatarUrl !== undefined) data.avatarUrl = patch.avatarUrl;
  if (patch.timezone !== undefined) data.timezone = patch.timezone;

  await prisma.user.update({ where: { id: userId }, data });
  return next;
}

// ─────────────────────────── Queue ───────────────────────────

export interface QueueView {
  timezone: string;
  randomizeWithinMinutes: number;
  slots: { time: string; days: boolean[] }[];
}

/** Load a user's queue settings, or sensible defaults if none exist yet. */
export async function getQueue(userId: string, userTimezone: string): Promise<QueueView> {
  const qs = await prisma.queueSettings.findUnique({
    where: { userId },
    include: { slots: true },
  });
  if (!qs) {
    return { timezone: userTimezone, randomizeWithinMinutes: 0, slots: [] };
  }
  return {
    timezone: qs.timezone,
    randomizeWithinMinutes: qs.randomizeWithinMinutes,
    slots: qs.slots
      .map((s) => ({ time: s.time, days: s.days }))
      .sort((a, b) => a.time.localeCompare(b.time)),
  };
}

/** Replace a user's queue settings + slots atomically (PUT semantics). */
export async function replaceQueue(
  userId: string,
  input: { timezone: string; randomizeWithinMinutes: number; slots: { time: string; days: boolean[] }[] },
): Promise<QueueView> {
  await prisma.$transaction(async (tx) => {
    const qs = await tx.queueSettings.upsert({
      where: { userId },
      create: { userId, timezone: input.timezone, randomizeWithinMinutes: input.randomizeWithinMinutes },
      update: { timezone: input.timezone, randomizeWithinMinutes: input.randomizeWithinMinutes },
    });
    await tx.queueSlot.deleteMany({ where: { settingsId: qs.id } });
    if (input.slots.length > 0) {
      await tx.queueSlot.createMany({
        data: input.slots.map((s) => ({ settingsId: qs.id, time: s.time, days: s.days })),
      });
    }
  });
  return getQueue(userId, input.timezone);
}
