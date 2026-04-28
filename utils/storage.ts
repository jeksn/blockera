import { browser } from 'wxt/browser';

const BLOCKED_SITES_KEY = 'blockedSites';

export async function getBlockedSites(): Promise<string[]> {
  const result = await browser.storage.sync.get(BLOCKED_SITES_KEY);
  return (result[BLOCKED_SITES_KEY] as string[]) || [];
}

export async function saveBlockedSites(sites: string[]): Promise<void> {
  await browser.storage.sync.set({ [BLOCKED_SITES_KEY]: sites });
}
