import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import {
  findGroupForSite,
  isSiteTempAllowed,
  getTempAllowedSites,
  getBudgetRemaining,
  addTempAllowedSite,
  addUsage,
  cleanupExpiredTempAllowed,
  ALLOW_PRESETS,
} from '@/utils/storage';

export interface SiteState {
  blocked: boolean;
  groupName?: string;
  /** Minutes offered on the overlay; 0 = just this once. */
  allowPresets: number[];
  defaultAllow: number;
  /** No way past the overlay until midnight (budget) or ever (strict). */
  hardBlock: boolean;
  /** Why the site is hard-blocked. */
  hardBlockReason?: 'strict' | 'budget';
  /** Minutes of budget left today; null = no limit configured. */
  budgetRemaining: number | null;
  /** Set when the site is currently temp-allowed. */
  tempAllowedUntil?: number;
}

const hostnameFromUrl = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

const NOT_BLOCKED: SiteState = {
  blocked: false,
  allowPresets: [],
  defaultAllow: 0,
  hardBlock: false,
  budgetRemaining: null,
};

const getSiteState = async (hostname: string): Promise<SiteState> => {
  const group = await findGroupForSite(hostname);
  if (!group) return NOT_BLOCKED;

  if (!group.allowOverride) {
    return {
      blocked: true,
      groupName: group.name,
      allowPresets: [],
      defaultAllow: 0,
      hardBlock: true,
      hardBlockReason: 'strict',
      budgetRemaining: null,
    };
  }

  const budgetRemaining = await getBudgetRemaining(group);
  const tempAllowed = await isSiteTempAllowed(hostname);
  let tempAllowedUntil: number | undefined;
  if (tempAllowed) {
    const sites = await getTempAllowedSites();
    tempAllowedUntil = sites.find((s) => s.site === hostname)?.allowedUntil;
  }

  const hardBlock = budgetRemaining !== null && budgetRemaining <= 0;

  return {
    blocked: true,
    groupName: group.name,
    allowPresets: [...ALLOW_PRESETS],
    defaultAllow: group.allowMinutes,
    hardBlock,
    hardBlockReason: hardBlock ? 'budget' : undefined,
    budgetRemaining,
    tempAllowedUntil,
  };
};

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_SITE_STATE') {
      const hostname = String(message.site || '');
      if (!hostname) {
        sendResponse(NOT_BLOCKED);
        return false;
      }
      getSiteState(hostname)
        .then(sendResponse)
        .catch(() => sendResponse(NOT_BLOCKED));
      return true;
    }

    if (message.type === 'TEMP_ALLOW') {
      const { site, minutes } = message as { site: string; minutes: number };
      (async () => {
        try {
          const group = await findGroupForSite(site);
          if (!group) {
            sendResponse({ success: true, grantedMinutes: 0 });
            return;
          }

          if (!group.allowOverride) {
            sendResponse({ success: false, reason: 'strict' });
            return;
          }

          if (minutes > 0) {
            const remaining = await getBudgetRemaining(group);
            if (remaining !== null && remaining <= 0) {
              sendResponse({ success: false, reason: 'budget' });
              return;
            }
            // Clamp to whatever budget is left (null = no limit).
            const grant = remaining === null ? minutes : Math.min(minutes, remaining);
            await addTempAllowedSite(site, grant);
            await addUsage(group.id, grant);
            sendResponse({ success: true, grantedMinutes: grant });
          } else {
            // "Just this once": single page-view pass, nothing recorded.
            sendResponse({ success: true, grantedMinutes: 0 });
          }
        } catch {
          sendResponse({ success: false, reason: 'error' });
        }
      })();
      return true;
    }

    return false;
  });

  // Inject the content script if it isn't running in the tab yet, then
  // deliver the message.
  const injectAndSendMessage = async (tabId: number, message: unknown, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await browser.tabs.sendMessage(tabId, message);
        return true;
      } catch {
        if (i === retries - 1) {
          try {
            await browser.scripting.executeScript({
              target: { tabId },
              files: ['/content-scripts/content.js'],
            });
            await new Promise((resolve) => setTimeout(resolve, 200));
            await browser.tabs.sendMessage(tabId, message);
            return true;
          } catch {
            return false;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return false;
  };

  const handleNavigation = async (details: {
    tabId: number;
    url: string;
    frameId: number;
  }) => {
    if (details.frameId !== 0) return;

    try {
      const hostname = hostnameFromUrl(details.url);
      if (!hostname) return;

      const group = await findGroupForSite(hostname);
      if (!group) return;

      // Content script re-checks its own state (blocked, budget, timer)
      // when it receives this.
      await injectAndSendMessage(details.tabId, { type: 'CHECK_SITE' });
    } catch {
      // Navigation raced or the tab is gone; the content script's
      // self-check on load covers missed events.
    }
  };

  // onCompleted covers full page loads; onHistoryStateUpdated covers SPA
  // route changes (pushState/replaceState), which never trigger onCompleted.
  browser.webNavigation.onCompleted.addListener(handleNavigation);
  browser.webNavigation.onHistoryStateUpdated.addListener(handleNavigation);

  // Purge expired temporary allowances and stale usage when the browser
  // or extension starts; open the landing page on first install.
  browser.runtime.onStartup.addListener(cleanupExpiredTempAllowed);
  browser.runtime.onInstalled.addListener((details) => {
    cleanupExpiredTempAllowed();
    if (details.reason === 'install') {
      browser.runtime.openOptionsPage();
    }
  });
});
