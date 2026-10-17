import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import {
  getBlockedSites,
  getTimeout,
  addTempAllowedSite,
  isSiteTempAllowed,
  getTempAllowedSites,
  cleanupExpiredTempAllowed,
} from '@/utils/storage';

const hostnameFromUrl = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};

const isBlockedSite = async (hostname: string) => {
  const blockedSites = await getBlockedSites();
  return blockedSites.some(
    (site) => hostname === site || hostname.endsWith(`.${site}`),
  );
};

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_TIMEOUT') {
      getTimeout().then(sendResponse);
      return true; // Keep channel open for async
    }

    if (message.type === 'IS_BLOCKED') {
      const hostname = String(message.site || '');
      if (!hostname) {
        sendResponse(false);
        return false;
      }
      (async () => {
        try {
          const tempAllowed = await isSiteTempAllowed(hostname);
          sendResponse(!tempAllowed && (await isBlockedSite(hostname)));
        } catch {
          sendResponse(false);
        }
      })();
      return true;
    }

    if (message.type === 'GET_TIMER_FOR_SITE') {
      const { site } = message;
      getTempAllowedSites()
        .then((sites) => {
          const siteData = sites.find((s) => s.site === site);
          if (siteData && siteData.allowedUntil > Date.now()) {
            sendResponse({ endTime: siteData.allowedUntil });
          } else {
            sendResponse(null);
          }
        })
        .catch(() => sendResponse(null));
      return true;
    }

    if (message.type === 'TEMP_ALLOW') {
      const { site, minutes } = message;
      if (minutes > 0) {
        addTempAllowedSite(site, minutes)
          .then(() => sendResponse({ success: true }))
          .catch(() => sendResponse({ success: false }));
        return true;
      }
      sendResponse({ success: true });
      return false;
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

      const tempAllowed = await isSiteTempAllowed(hostname);
      if (tempAllowed) {
        await injectAndSendMessage(details.tabId, {
          type: 'SHOW_TIMER',
          site: hostname,
        });
        return;
      }

      if (await isBlockedSite(hostname)) {
        await injectAndSendMessage(details.tabId, { type: 'BLOCK_SITE' });
      }
    } catch {
      // Navigation raced or the tab is gone; the content script's
      // self-check on load covers missed events.
    }
  };

  // onCompleted covers full page loads; onHistoryStateUpdated covers SPA
  // route changes (pushState/replaceState), which never trigger onCompleted.
  browser.webNavigation.onCompleted.addListener(handleNavigation);
  browser.webNavigation.onHistoryStateUpdated.addListener(handleNavigation);

  // Purge expired temporary allowances when the browser or extension starts.
  browser.runtime.onStartup.addListener(cleanupExpiredTempAllowed);
  browser.runtime.onInstalled.addListener(cleanupExpiredTempAllowed);
});
