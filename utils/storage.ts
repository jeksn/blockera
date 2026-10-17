import { browser } from 'wxt/browser';

const GROUPS_KEY = 'blockGroups';
const TEMP_ALLOWED_KEY = 'tempAllowed';
const USAGE_KEY = 'groupUsage';
const PASSWORD_KEY = 'settingsPassword';

// Legacy keys (pre-groups storage), used for migration only.
const LEGACY_BLOCKED_SITES_KEY = 'blockedSites';
const LEGACY_TIMEOUT_KEY = 'timeoutMinutes';

export const ALLOW_PRESETS = [0, 5, 15, 30, 60] as const;
export const BUDGET_PRESETS = [0, 5, 10, 15, 30, 60] as const;
export const DELAY_PRESETS = [0, 5, 10] as const;

export interface BlockGroup {
  id: string;
  name: string;
  /** Sites blocked by this group. A site matches its domain and all subdomains. */
  sites: string[];
  /** Minutes granted per "Let me in" dismiss. 0 = just this once. */
  allowMinutes: number;
  /** Total grantable minutes per day. 0 = no limit. */
  dailyBudgetMinutes: number;
  /**
   * When false, sites in this group are always blocked with no way to
   * dismiss the overlay (for sites you never want to talk yourself into).
   */
  allowOverride: boolean;
  /** Seconds the "Let me in" button stays disabled after the overlay shows. */
  delaySeconds: number;
  /** Blocking window start ("HH:MM"). null = always active. */
  activeFrom: string | null;
  /** Blocking window end ("HH:MM"). null = always active. */
  activeTo: string | null;
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

  if (Array.isArray(groups)) {
    // Normalize groups stored before a field was introduced.
    return groups.map((g) => ({
      ...g,
      allowOverride: g.allowOverride ?? true,
      delaySeconds: g.delaySeconds ?? 0,
      activeFrom: g.activeFrom ?? null,
      activeTo: g.activeTo ?? null,
    }));
  }

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
      allowOverride: true,
      delaySeconds: 0,
      activeFrom: null,
      activeTo: null,
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

const ATTEMPTS_KEY = 'blockAttempts';

export interface SiteAttempts {
  date: string;
  count: number;
  lastAt: number;
}

/**
 * Count a block-screen encounter for today. Throttled so the same page
 * load (self-check + navigation push) counts once. Returns today's count.
 */
export async function addBlockAttempt(site: string): Promise<number> {
  const result = await browser.storage.local.get(ATTEMPTS_KEY);
  const map = (result[ATTEMPTS_KEY] as Record<string, SiteAttempts>) || {};
  const today = localDateString();
  const now = Date.now();

  let entry = map[site];
  if (!entry || entry.date !== today) {
    entry = { date: today, count: 0, lastAt: 0 };
  }
  if (now - entry.lastAt > 5000) {
    entry.count += 1;
    entry.lastAt = now;
  }
  map[site] = entry;
  await browser.storage.local.set({ [ATTEMPTS_KEY]: map });
  return entry.count;
}

/** Serialized groups file. */
export interface BackupFile {
  version: 1;
  exportedAt: string;
  groups: BlockGroup[];
}

export async function exportGroupsJSON(): Promise<string> {
  const groups = await getGroups();
  const backup: BackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    groups,
  };
  return JSON.stringify(backup, null, 2);
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Parse and validate a backup file. Throws with a human-readable message
 * on bad input. Does not persist anything — callers save the result.
 */
export async function importGroupsFromJSON(json: string): Promise<BlockGroup[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Not a valid JSON file.');
  }

  const container = parsed as Partial<BackupFile>;
  const list = Array.isArray(parsed) ? (parsed as unknown[]) : container?.groups;
  if (!Array.isArray(list)) throw new Error('No groups found in file.');
  if (list.length > 50) throw new Error('Too many groups (max 50).');

  const clampInt = (value: unknown, max: number) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? Math.min(Math.floor(value), max)
      : 0;

  const usedIds = new Set<string>();
  const groups: BlockGroup[] = [];
  for (const raw of list) {
    const item = raw as Partial<BlockGroup>;

    const name =
      typeof item.name === 'string' && item.name.trim()
        ? item.name.trim().slice(0, 50)
        : 'Group';

    const sites: string[] = [];
    const rawSites = Array.isArray(item.sites) ? item.sites : [];
    for (const s of rawSites.slice(0, 500)) {
      if (typeof s !== 'string') continue;
      const normalized = normalizeSiteInput(s);
      if (normalized && !sites.includes(normalized)) sites.push(normalized);
    }

    let id = typeof item.id === 'string' && item.id ? item.id : generateGroupId();
    while (usedIds.has(id)) id = generateGroupId();
    usedIds.add(id);

    const activeFrom =
      typeof item.activeFrom === 'string' && TIME_RE.test(item.activeFrom)
        ? item.activeFrom
        : null;
    const activeTo =
      typeof item.activeTo === 'string' && TIME_RE.test(item.activeTo)
        ? item.activeTo
        : null;

    groups.push({
      id,
      name,
      sites,
      allowMinutes: clampInt(item.allowMinutes, 60),
      dailyBudgetMinutes: clampInt(item.dailyBudgetMinutes, 720),
      allowOverride: item.allowOverride !== false,
      delaySeconds: clampInt(item.delaySeconds, 60),
      activeFrom,
      activeTo,
    });
  }
  return groups;
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

    // Reset attempt counters — they're per-day stats.
    await browser.storage.local.set({ [ATTEMPTS_KEY]: {} });
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
    allowOverride: true,
    delaySeconds: 0,
    activeFrom: null,
    activeTo: null,
  };
}

/**
 * Whether the group's blocking applies right now. Windows may cross
 * midnight (e.g. 22:00–07:00); null times mean always active.
 */
export function isGroupActive(group: BlockGroup, now = new Date()): boolean {
  if (!group.activeFrom || !group.activeTo) return true;
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const minutes = now.getHours() * 60 + now.getMinutes();
  const from = toMinutes(group.activeFrom);
  const to = toMinutes(group.activeTo);
  if (from === to) return true;
  if (from < to) return minutes >= from && minutes < to;
  return minutes >= from || minutes < to;
}

export interface PasswordSetting {
  /** Random per-install hex salt. */
  salt: string;
  /** SHA-256 of `${salt}:${password}` as hex. */
  hash: string;
}

export async function getPasswordSetting(): Promise<PasswordSetting | null> {
  const result = await browser.storage.local.get(PASSWORD_KEY);
  return (result[PASSWORD_KEY] as PasswordSetting) || null;
}

export async function savePasswordSetting(setting: PasswordSetting): Promise<void> {
  await browser.storage.local.set({ [PASSWORD_KEY]: setting });
}

export async function clearPasswordSetting(): Promise<void> {
  await browser.storage.local.remove(PASSWORD_KEY);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password: string): Promise<boolean> {
  const setting = await getPasswordSetting();
  if (!setting) return true;
  const hash = await hashPassword(password, setting.salt);
  return hash === setting.hash;
}
