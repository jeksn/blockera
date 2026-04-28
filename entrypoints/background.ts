import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { getBlockedSites } from '@/utils/storage';

export default defineBackground(() => {
  browser.webNavigation.onCompleted.addListener(async (details) => {
    if (details.frameId !== 0) return;

    const blockedSites = await getBlockedSites();
    if (blockedSites.length === 0) return;

    const url = new URL(details.url);
    const hostname = url.hostname.replace(/^www\./, '');

    const isBlocked = blockedSites.some((site: string) =>
      hostname === site || hostname.endsWith(`.${site}`)
    );

    if (isBlocked) {
      browser.tabs.sendMessage(details.tabId, { type: 'BLOCK_SITE' }).catch(() => {
        browser.scripting.executeScript({
          target: { tabId: details.tabId },
          files: ['/content-scripts/content.js']
        }).then(() => {
          setTimeout(() => {
            browser.tabs.sendMessage(details.tabId, { type: 'BLOCK_SITE' }).catch(console.error);
          }, 100);
        }).catch(console.error);
      });
    }
  });
});
