import { browser } from 'wxt/browser';

const BLOCKED_SITES_KEY = 'blockedSites';
const TIMEOUT_KEY = 'timeoutMinutes';
const TEMP_ALLOWED_KEY = 'tempAllowed';

export type TimeoutOption = 0 | 5 | 15 | 30 | 60;

export interface TempAllowedSite {
  site: string;
  allowedUntil: number;
}

export async function getBlockedSites(): Promise<string[]> {
  const result = await browser.storage.sync.get(BLOCKED_SITES_KEY);
  return (result[BLOCKED_SITES_KEY] as string[]) || [];
}

export async function saveBlockedSites(sites: string[]): Promise<void> {
  await browser.storage.sync.set({ [BLOCKED_SITES_KEY]: sites });
}

export async function getTimeout(): Promise<TimeoutOption> {
  const result = await browser.storage.sync.get(TIMEOUT_KEY);
  return (result[TIMEOUT_KEY] as TimeoutOption) || 0;
}

export async function saveTimeout(minutes: TimeoutOption): Promise<void> {
  await browser.storage.sync.set({ [TIMEOUT_KEY]: minutes });
}

export async function getTempAllowedSites(): Promise<TempAllowedSite[]> {
  const result = await browser.storage.local.get(TEMP_ALLOWED_KEY);
  return (result[TEMP_ALLOWED_KEY] as TempAllowedSite[]) || [];
}

export async function addTempAllowedSite(site: string, minutes: number): Promise<void> {
  const sites = await getTempAllowedSites();
  const allowedUntil = Date.now() + minutes * 60 * 1000;
  
  // Remove existing entry for this site if present
  const filtered = sites.filter(s => s.site !== site);
  filtered.push({ site, allowedUntil });
  
  await browser.storage.local.set({ [TEMP_ALLOWED_KEY]: filtered });
}

export async function isSiteTempAllowed(site: string): Promise<boolean> {
  const sites = await getTempAllowedSites();
  const now = Date.now();
  
  // Clean up expired entries
  const valid = sites.filter(s => s.allowedUntil > now);
  if (valid.length !== sites.length) {
    await browser.storage.local.set({ [TEMP_ALLOWED_KEY]: valid });
  }
  
  return valid.some(s => s.site === site);
}
