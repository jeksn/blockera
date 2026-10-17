import { browser } from 'wxt/browser';

const GROUPS_KEY = 'blockGroups';
const TEMP_ALLOWED_KEY = 'tempAllowed';
const USAGE_KEY = 'groupUsage';

// Legacy keys (pre-groups storage), used for migration only.
const LEGACY_BLOCKED_SITES_KEY = 'blockedSites';
const LEGACY_TIMEOUT_KEY = 'timeoutMinutes';

export const ALLOW_PRESETS = [0, 5, 15, 30, 60] as const;
export const BUDGET_PRESETS = [0, 5, 10, 15, 30, 60] as const;

export interface BlockGroup {
  id: string;
  name: string;
  /** Sites blocked by this group. A site matches its domain and all subdomains. */
  sites: string[];
  /** Minutes granted per "Let me in" dismiss. 0 = just this once. */
  allowMinutes: number;
  /** Total grantable minutes per day. 0 = no limit. */
  dailyBudgetMinutes: number;
}

export interface TempAllowedSite {
  site: string;
  allowedUntil: number;
}

export interface GroupUsage {
  /** Local date as YYYY-MM-DD. */
  date: string;
  /** Total minutes granted today. */
  usedMinutes: number;
}

export function siteMatches(hostname: string, site: string): boolean {
  return hostname === site || hostname.endsWith(`.${site}`);
}

export function normalizeSiteInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*/, '')
    .replace(/:\d+$/, '');
}

export function localDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateGroupId(): string {
  return `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getGroups(): Promise<BlockGroup[]> {
  const result = await browser.storage.sync.get(GROUPS_KEY);
  const groups = result[GROUPS_KEY] as BlockGroup[] | undefined;

  if (Array.isArray(groups)) return groups;

  // Migrate legacy flat block list (plus its timeout setting) into a
  // single default group.
  const legacy = await browser.storage.sync.get([
    LEGACY_BLOCKED_SITES_KEY,
    LEGACY_TIMEOUT_KEY,
  ]);
  const sites = (legacy[LEGACY_BLOCKED_SITES_KEY] as string[]) || [];
  const allowMinutes = (legacy[LEGACY_TIMEOUT_KEY] as number) || 0;

  const migrated: BlockGroup[] = [
    {
      id: 'default',
      name: 'Default',
      sites,
      allowMinutes,
      dailyBudgetMinutes: 0,
    },
  ];
  await browser.storage.sync.set({ [GROUPS_KEY]: migrated });
  return migrated;
}

export async function saveGroups(groups: BlockGroup[]): Promise<void> {
  await browser.storage.sync.set({ [GROUPS_KEY]: groups });
}

export async function findGroupForSite(hostname: string): Promise<BlockGroup | null> {
  const groups = await getGroups();
  for (const group of groups) {
    if (group.sites.some((site) => siteMatches(hostname, site))) {
      return group;
    }
  }
  return null;
}

export async function getTempAllowedSites(): Promise<TempAllowedSite[]> {
  const result = await browser.storage.local.get(TEMP_ALLOWED_KEY);
  return (result[TEMP_ALLOWED_KEY] as TempAllowedSite[]) || [];
}

export async function addTempAllowedSite(site: string, minutes: number): Promise<void> {
  const sites = await getTempAllowedSites();
  const allowedUntil = Date.now() + minutes * 60 * 1000;
  const filtered = sites.filter((s) => s.site !== site);
  filtered.push({ site, allowedUntil });
  await browser.storage.local.set({ [TEMP_ALLOWED_KEY]: filtered });
}

export async function isSiteTempAllowed(site: string): Promise<boolean> {
  try {
    const sites = await getTempAllowedSites();
    const now = Date.now();
    const valid = sites.filter((s) => s.allowedUntil > now);
    if (valid.length !== sites.length) {
      await browser.storage.local.set({ [TEMP_ALLOWED_KEY]: valid });
    }
    return valid.some((s) => s.site === site);
  } catch {
    return false;
  }
}

export async function getUsage(groupId: string): Promise<GroupUsage> {
  const result = await browser.storage.local.get(USAGE_KEY);
  const usage = (result[USAGE_KEY] as Record<string, GroupUsage>) || {};
  const today = localDateString();
  const entry = usage[groupId];
  if (entry && entry.date === today) return entry;
  return { date: today, usedMinutes: 0 };
}

/**
 * Record granted minutes against a group's daily budget. Callers should
 * clamp the requested minutes to the remaining budget first. Returns the
 * group's total used minutes for today after the update.
 */
export async function addUsage(groupId: string, minutes: number): Promise<number> {
  const result = await browser.storage.local.get(USAGE_KEY);
  const usage = (result[USAGE_KEY] as Record<string, GroupUsage>) || {};
  const today = localDateString();
  const entry = usage[groupId] && usage[groupId].date === today
    ? usage[groupId]
    : { date: today, usedMinutes: 0 };

  entry.usedMinutes += minutes;
  usage[groupId] = entry;
  await browser.storage.local.set({ [USAGE_KEY]: usage });
  return entry.usedMinutes;
}

/** Minutes of budget left for a group today; null = no limit configured. */
export async function getBudgetRemaining(group: BlockGroup): Promise<number | null> {
  if (group.dailyBudgetMinutes <= 0) return null;
  const usage = await getUsage(group.id);
  return Math.max(0, group.dailyBudgetMinutes - usage.usedMinutes);
}

export async function cleanupExpiredTempAllowed(): Promise<void> {
  try {
    const sites = await getTempAllowedSites();
    const now = Date.now();
    const valid = sites.filter((s) => s.allowedUntil > now);
    if (valid.length !== sites.length) {
      await browser.storage.local.set({ [TEMP_ALLOWED_KEY]: valid });
    }

    // Drop stale usage entries (groups deleted or days rolled over).
    const result = await browser.storage.local.get(USAGE_KEY);
    const usage = (result[USAGE_KEY] as Record<string, GroupUsage>) || {};
    const today = localDateString();
    const groups = await getGroups();
    const validUsage: Record<string, GroupUsage> = {};
    for (const group of groups) {
      const entry = usage[group.id];
      if (entry && entry.date === today) validUsage[group.id] = entry;
    }
    await browser.storage.local.set({ [USAGE_KEY]: validUsage });
  } catch {
    // Storage unavailable; nothing to clean.
  }
}

export function createGroup(name: string): BlockGroup {
  return {
    id: generateGroupId(),
    name,
    sites: [],
    allowMinutes: 0,
    dailyBudgetMinutes: 0,
  };
}
