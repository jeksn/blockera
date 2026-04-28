import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { getBlockedSites, getTimeout, addTempAllowedSite, isSiteTempAllowed, getTempAllowedSites } from '@/utils/storage';

export default defineBackground(() => {
  // Listen for messages from content script
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.type, message);
    
    // Handle async messages by returning true and calling sendResponse
    if (message.type === 'GET_TIMEOUT') {
      getTimeout().then(timeout => {
        console.log('GET_TIMEOUT returning:', timeout);
        sendResponse(timeout);
      });
      return true; // Keep channel open for async
    }
    
    if (message.type === 'GET_TIMER_FOR_SITE') {
      const { site } = message;
      getTempAllowedSites().then(sites => {
        console.log('GET_TIMER_FOR_SITE for:', site);
        console.log('All temp allowed sites:', sites);
        const siteData = sites.find(s => s.site === site);
        console.log('Found site data:', siteData);
        
        if (siteData && siteData.allowedUntil > Date.now()) {
          console.log('Returning endTime:', siteData.allowedUntil);
          sendResponse({ endTime: siteData.allowedUntil });
        } else {
          console.log('Site not found or expired');
          sendResponse(null);
        }
      });
      return true; // Keep channel open for async
    }
    
    if (message.type === 'TEMP_ALLOW') {
      const { site, minutes } = message;
      console.log('TEMP_ALLOW for', site, 'minutes:', minutes);
      if (minutes > 0) {
        addTempAllowedSite(site, minutes).then(() => {
          console.log(`Temporarily allowed ${site} for ${minutes} minutes`);
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: true });
      }
      return true; // Keep channel open for async
    }
    
    // Default: no async operation needed
    return false;
  });

  // Listen for navigation to check against blocked sites
  browser.webNavigation.onCompleted.addListener(async (details) => {
    if (details.frameId !== 0) return;

    const blockedSites = await getBlockedSites();
    if (blockedSites.length === 0) return;

    const url = new URL(details.url);
    const hostname = url.hostname.replace(/^www\./, '');
    console.log('Navigation to:', hostname, 'blocked sites:', blockedSites);

    // Check if this site is temporarily allowed
    const isTempAllowed = await isSiteTempAllowed(hostname);
    console.log('Is temp allowed:', isTempAllowed);
    
    if (isTempAllowed) {
      console.log(`${hostname} is temporarily allowed, showing timer`);
      
      // Send message to content script to show timer
      browser.tabs.sendMessage(details.tabId, { 
        type: 'SHOW_TIMER', 
        site: hostname 
      }).catch(() => {
        // Content script may not be loaded, inject it
        browser.scripting.executeScript({
          target: { tabId: details.tabId },
          files: ['/content-scripts/content.js']
        }).then(() => {
          setTimeout(() => {
            browser.tabs.sendMessage(details.tabId, { 
              type: 'SHOW_TIMER', 
              site: hostname 
            }).catch(console.error);
          }, 100);
        }).catch(console.error);
      });
      
      return;
    }

    const isBlocked = blockedSites.some((site: string) =>
      hostname === site || hostname.endsWith(`.${site}`)
    );

    if (isBlocked) {
      console.log(`${hostname} is blocked, showing overlay`);
      // Send message to content script
      browser.tabs.sendMessage(details.tabId, { type: 'BLOCK_SITE' }).catch(() => {
        // Content script may not be loaded, inject it
        browser.scripting.executeScript({
          target: { tabId: details.tabId },
          files: ['/content-scripts/content.js']
        }).then(() => {
          // Retry sending message after injection
          setTimeout(() => {
            browser.tabs.sendMessage(details.tabId, { type: 'BLOCK_SITE' }).catch(console.error);
          }, 100);
        }).catch(console.error);
      });
    }
  });
});
