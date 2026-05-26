import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import type { TimeoutOption } from '@/utils/storage';

// Global type for timer animation frame
declare global {
  interface Window {
    annoimeTimerFrame?: number;
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('Annoime content script loaded on', window.location.hostname);
    const hostname = window.location.hostname.replace(/^www\./, '');
    
    // Cleanup function for page unload
    const cleanup = () => {
      if (window.annoimeTimerFrame) {
        cancelAnimationFrame(window.annoimeTimerFrame);
      }
      const overlay = document.getElementById('annoime-overlay');
      if (overlay) overlay.remove();
      const timer = document.getElementById('annoime-timer');
      if (timer) timer.remove();
    };
    
    // Add cleanup listeners
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);
    
    browser.runtime.onMessage.addListener(async (message) => {
      console.log('Content script received message:', message.type, message);
      if (message.type === 'BLOCK_SITE') {
        console.log('Processing BLOCK_SITE message');
        try {
          const timeout = await browser.runtime.sendMessage({ type: 'GET_TIMEOUT' }) as TimeoutOption;
          console.log('Got timeout:', timeout);
          showBlurOverlay(timeout);
        } catch (error) {
          console.error('Error getting timeout:', error);
          showBlurOverlay(0); // Default to 0 if there's an error
        }
      }
      
      if (message.type === 'SHOW_TIMER') {
        const site = message.site as string;
        console.log('SHOW_TIMER received for', site);
        const timerData = await browser.runtime.sendMessage({ type: 'GET_TIMER_FOR_SITE', site }) as { endTime: number } | null;
        console.log('Timer data:', timerData);
        if (timerData && timerData.endTime > Date.now()) {
          const remainingMs = timerData.endTime - Date.now();
          const remainingMinutes = remainingMs / 1000 / 60;
          console.log('Starting timer with', remainingMinutes, 'minutes remaining');
          startTimer(remainingMinutes, site, timerData.endTime);
        }
      }
    });
    
    // Check for timer on load with retry
    let attempts = 0;
    const maxAttempts = 5;
    
    const tryShowTimer = () => {
      attempts++;
      console.log(`Checking timer for ${hostname}, attempt ${attempts}`);
      
      browser.runtime.sendMessage({ type: 'GET_TIMER_FOR_SITE', site: hostname })
        .then((timerData: { endTime: number } | null) => {
          console.log('Timer check result:', timerData);
          if (timerData && timerData.endTime > Date.now()) {
            const remainingMs = timerData.endTime - Date.now();
            const remainingMinutes = remainingMs / 1000 / 60;
            startTimer(remainingMinutes, hostname, timerData.endTime);
          }
        })
        .catch((err) => {
          console.error('Timer check failed:', err);
          if (attempts < maxAttempts) {
            setTimeout(tryShowTimer, 200);
          }
        });
    };
    
    setTimeout(tryShowTimer, 50);
  }
});

const timeoutLabels: Record<TimeoutOption, string> = {
  0: 'Just this once',
  5: '5 minutes',
  15: '15 minutes',
  30: '30 minutes',
  60: '60 minutes',
};

const timerStyles = `
  #annoime-timer {
    position: fixed;
    top: 12px;
    right: 12px;
    background: rgba(255, 255, 255, 0.65);
    color: #000;
    padding: 6px 10px;
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    font-weight: 600;
    z-index: 999998;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(4px);
    cursor: pointer;
    user-select: none;
    transition: opacity 0.3s ease;
  }
  #annoime-timer:hover {
    background: rgba(255, 255, 255, 0.85);
  }
  #annoime-timer.annoime-hidden {
    opacity: 0;
    pointer-events: none;
  }
  #annoime-timer.annoime-warning {
    background: rgba(255, 165, 0, 0.75);
    color: #fff;
  }
  #annoime-timer.annoime-warning:hover {
    background: rgba(255, 165, 0, 0.9);
  }
  #annoime-timer.annoime-expired {
    background: rgba(220, 20, 60, 0.75);
    color: #fff;
  }
  #annoime-timer.annoime-expired:hover {
    background: rgba(220, 20, 60, 0.9);
  }
`;

function showBlurOverlay(currentTimeout: TimeoutOption) {
  console.log('showBlurOverlay called with timeout:', currentTimeout);
  
  if (document.getElementById('annoime-overlay')) {
    console.log('Overlay already exists, skipping');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'annoime-overlay';
  
  const hostname = window.location.hostname.replace(/^www\./, '');
  console.log('Creating overlay for hostname:', hostname);
  
  // Debug: Check for potential CSS conflicts
  console.log('Document styles:', {
    computedZIndex: window.getComputedStyle(document.body).zIndex,
    computedPosition: window.getComputedStyle(document.body).position,
    computedOverflow: window.getComputedStyle(document.body).overflow,
    computedPointerEvents: window.getComputedStyle(document.body).pointerEvents,
    bodyClasses: document.body.className,
    htmlClasses: document.documentElement.className,
    siteSpecific: {
      hostname: hostname,
      currentURL: window.location.href,
      userAgent: navigator.userAgent.substring(0, 50),
      hasReact: !!(window.React || window.ReactDOM),
      hasJQuery: !!(window.jQuery || window.$),
      documentReady: document.readyState
    }
  });
  
  // Check for any existing overlays or modals that might interfere
  const existingOverlays = document.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"], .modal, .overlay, .popup');
  console.log('Existing overlays/modals:', existingOverlays.length, Array.from(existingOverlays).map(el => ({
    tagName: el.tagName,
    className: el.className,
    id: el.id,
    zIndex: window.getComputedStyle(el).zIndex
  })));
  
  const defaultSelection: TimeoutOption = currentTimeout || 0;
  
  const buttonsHTML = [0, 5, 15, 30, 60].map((min) => `
            <button 
              class="annoime-timeout-btn ${min === defaultSelection ? 'annoime-selected' : ''}" 
              data-minutes="${min}"
            >
              ${timeoutLabels[min as TimeoutOption]}
            </button>
          `).join('');
          
  overlay.innerHTML = `
    <div class="annoime-content">
      <h1>Stay Focused</h1>
      <p>This site is on your block list.</p>
      <div class="annoime-timeout-section">
        <p class="annoime-timeout-label">Allow access for:</p>
        <div class="annoime-timeout-options">
          ${buttonsHTML}
        </div>
      </div>
      <button id="annoime-dismiss" class="annoime-dismiss-btn">Let me in</button>
    </div>
  `;
  
  console.log('Overlay HTML set. Default selection:', defaultSelection);

  const style = document.createElement('style');
  style.textContent = `
    #annoime-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      backdrop-filter: blur(20px);
      background: rgba(0, 0, 0, 0.5) !important;
      z-index: 999999999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      pointer-events: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      transform: none !important;
      opacity: 1 !important;
      visibility: visible !important;
      isolation: isolate !important;
      contain: layout style paint !important;
    }
    #annoime-overlay .annoime-content {
      text-align: center;
      color: white;
      padding: 40px;
      background: rgba(0, 0, 0, 0.7);
      border-radius: 16px;
      max-width: 420px;
      width: 90%;
    }
    #annoime-overlay h1 {
      margin: 0 0 16px 0;
      font-size: 28px;
    }
    #annoime-overlay p {
      margin: 0 0 20px 0;
      opacity: 0.9;
      font-size: 16px;
    }
    .annoime-timeout-section {
      margin: 24px 0;
    }
    .annoime-timeout-label {
      font-size: 14px;
      opacity: 0.8;
      margin-bottom: 12px !important;
    }
    .annoime-timeout-options {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }
    .annoime-timeout-btn {
      padding: 8px 16px !important;
      background: transparent !important;
      color: white !important;
      border: 1px solid rgba(255, 255, 255, 0.3) !important;
      border-radius: 6px !important;
      cursor: pointer !important;
      font-size: 13px !important;
      font-family: inherit !important;
      text-align: center !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      min-height: 32px !important;
      box-sizing: border-box !important;
      transition: all 0.2s !important;
      pointer-events: auto !important;
      position: relative !important;
      z-index: 999999999 !important;
      isolation: isolate !important;
      user-select: none !important;
    }
    .annoime-timeout-btn:hover {
      background: rgba(255, 255, 255, 0.1) !important;
      border-color: rgba(255, 255, 255, 0.5) !important;
    }
    .annoime-timeout-btn.annoime-selected {
      background: white !important;
      color: #333 !important;
      border-color: white !important;
    }
    .annoime-dismiss-btn {
      margin-top: 20px !important;
      padding: 12px 32px !important;
      background: white !important;
      color: #333 !important;
      border: none !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      font-size: 15px !important;
      font-weight: 500 !important;
      font-family: inherit !important;
      text-align: center !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      min-height: 44px !important;
      box-sizing: border-box !important;
      transition: background 0.2s !important;
      pointer-events: auto !important;
      position: relative !important;
      z-index: 999999999 !important;
      isolation: isolate !important;
      user-select: none !important;
    }
    .annoime-dismiss-btn:hover {
      background: #f0f0f0 !important;
    }
    ${timerStyles}
  `;

  document.head.appendChild(style);
  
  // Aggressively disable other overlays that might interfere
  console.log('Disabling interfering overlays...');
  const allElements = document.querySelectorAll('*');
  let disabledCount = 0;
  allElements.forEach(el => {
    const style = window.getComputedStyle(el);
    const zIndex = parseInt(style.zIndex);
    if (zIndex > 100000 && el.id !== 'annoime-overlay' && !el.id.includes('annoime')) {
      console.log('Disabling high z-index element:', el.tagName, el.id, el.className, 'z-index:', zIndex);
      (el as HTMLElement).style.pointerEvents = 'none';
      (el as HTMLElement).style.visibility = 'hidden';
      disabledCount++;
    }
  });
  if (disabledCount > 0) {
    console.log(`Disabled ${disabledCount} interfering elements`);
  }
  
  // Try multiple insertion methods to ensure overlay gets added
  try {
    document.body.appendChild(overlay);
    console.log('Overlay appended to body');
  } catch (error) {
    console.error('Failed to append to body, trying documentElement:', error);
    try {
      document.documentElement.appendChild(overlay);
      console.log('Overlay appended to documentElement');
    } catch (error2) {
      console.error('Failed to append to documentElement, trying direct insertion:', error2);
      document.body.insertAdjacentHTML('beforeend', overlay.outerHTML);
      console.log('Overlay inserted via insertAdjacentHTML');
    }
  }
  
  // Debug: Check if overlay was properly added
  setTimeout(() => {
    const addedOverlay = document.getElementById('annoime-overlay');
    if (addedOverlay) {
      const computedStyle = window.getComputedStyle(addedOverlay);
      console.log('Overlay successfully added:', {
        exists: true,
        visible: computedStyle.display !== 'none',
        zIndex: computedStyle.zIndex,
        position: computedStyle.position,
        pointerEvents: computedStyle.pointerEvents,
        width: computedStyle.width,
        height: computedStyle.height,
        top: computedStyle.top,
        left: computedStyle.left
      });
      
      // Test if overlay is actually covering the viewport
      const rect = addedOverlay.getBoundingClientRect();
      console.log('Overlay rect:', {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        right: rect.right,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight
      });
      
      // If overlay is not covering the full viewport, try a more aggressive approach
      if (rect.width < window.innerWidth * 0.9 || rect.height < window.innerHeight * 0.9) {
        console.warn('Overlay not covering full viewport, trying fallback approach');
        createFallbackOverlay(hostname, currentTimeout);
      }
    } else {
      console.error('Overlay was not added to DOM! Trying fallback approach.');
      createFallbackOverlay(hostname, currentTimeout);
    }
  }, 100);

  let selectedTimeout: TimeoutOption = 0;

  // Wait a moment for the DOM to be fully processed
  setTimeout(() => {
    console.log('Setting up event listeners for overlay buttons');
    
    // Setup timeout button listeners
    const timeoutButtons = overlay.querySelectorAll('.annoime-timeout-btn');
    console.log('Found timeout buttons:', timeoutButtons.length);
    
    timeoutButtons.forEach((btn, index) => {
      console.log(`Setting up listener for button ${index}:`, btn.textContent);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Timeout button clicked:', btn.textContent);
        
        overlay.querySelectorAll('.annoime-timeout-btn').forEach((b) => {
          b.classList.remove('annoime-selected');
        });
        btn.classList.add('annoime-selected');
        selectedTimeout = parseInt(btn.getAttribute('data-minutes') || '0', 10) as TimeoutOption;
        console.log('Selected timeout:', selectedTimeout);
      });
    });

    // Setup dismiss button listener
    const dismissBtn = document.getElementById('annoime-dismiss');
    if (dismissBtn) {
      console.log('Setting up dismiss button listener');
      dismissBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Dismiss button clicked, selectedTimeout:', selectedTimeout);
        
        try {
          const response = await browser.runtime.sendMessage({
            type: 'TEMP_ALLOW',
            site: hostname,
            minutes: selectedTimeout,
          });
          console.log('TEMP_ALLOW response:', response);
          
          overlay.remove();
          style.remove();
          
          if (selectedTimeout > 0) {
            startTimer(selectedTimeout, hostname);
          }
        } catch (error) {
          console.error('Error sending TEMP_ALLOW message:', error);
        }
      });
    } else {
      console.error('Dismiss button not found! Available elements:', 
        Array.from(overlay.querySelectorAll('button')).map(b => b.id || b.className));
    }
    
    // Add event delegation as a backup
    overlay.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      console.log('Overlay clicked, target:', target.tagName, target.className, target.textContent);
      
      if (target.classList.contains('annoime-timeout-btn')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Timeout button clicked via delegation:', target.textContent);
        
        overlay.querySelectorAll('.annoime-timeout-btn').forEach((b) => {
          b.classList.remove('annoime-selected');
        });
        target.classList.add('annoime-selected');
        selectedTimeout = parseInt(target.getAttribute('data-minutes') || '0', 10) as TimeoutOption;
        console.log('Selected timeout via delegation:', selectedTimeout);
      }
      
      if (target.id === 'annoime-dismiss' || target.classList.contains('annoime-dismiss-btn')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Dismiss button clicked via delegation, selectedTimeout:', selectedTimeout);
        
        try {
          const response = await browser.runtime.sendMessage({
            type: 'TEMP_ALLOW',
            site: hostname,
            minutes: selectedTimeout,
          });
          console.log('TEMP_ALLOW response via delegation:', response);
          
          overlay.remove();
          style.remove();
          
          if (selectedTimeout > 0) {
            startTimer(selectedTimeout, hostname);
          }
        } catch (error) {
          console.error('Error sending TEMP_ALLOW message via delegation:', error);
        }
      }
    });
  }, 10);
}

function createFallbackOverlay(hostname: string, currentTimeout: TimeoutOption) {
  console.log('Creating fallback overlay for hostname:', hostname);
  
  // Remove any existing overlay first
  const existingOverlay = document.getElementById('annoime-overlay');
  if (existingOverlay) existingOverlay.remove();
  
  // Create a more intrusive overlay
  const fallbackOverlay = document.createElement('div');
  fallbackOverlay.id = 'annoime-overlay-fallback';
  fallbackOverlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: rgba(0, 0, 0, 0.9) !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-family: system-ui, -apple-system, sans-serif !important;
    pointer-events: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    transform: none !important;
    opacity: 1 !important;
    visibility: visible !important;
  `;
  
  const defaultSelection: TimeoutOption = currentTimeout || 0;
  
  fallbackOverlay.innerHTML = `
    <div style="
      text-align: center;
      color: white;
      padding: 40px;
      background: rgba(0, 0, 0, 0.8);
      border-radius: 16px;
      max-width: 420px;
      width: 90%;
    ">
      <h1 style="margin: 0 0 16px 0; font-size: 28px;">Stay Focused</h1>
      <p style="margin: 0 0 20px 0; opacity: 0.9; font-size: 16px;">This site is on your block list.</p>
      <div style="margin: 24px 0;">
        <p style="font-size: 14px; opacity: 0.8; margin-bottom: 12px;">Allow access for:</p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">
          ${[0, 5, 15, 30, 60].map((min) => `
            <button 
              class="annoime-timeout-btn-fallback" 
              data-minutes="${min}"
              style="
                padding: 8px 16px;
                background: ${min === defaultSelection ? 'white' : 'transparent'};
                color: ${min === defaultSelection ? '#333' : 'white'};
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                font-family: inherit;
                text-align: center;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 32px;
                box-sizing: border-box;
                transition: all 0.2s;
                pointer-events: auto !important;
                position: relative;
                z-index: 2147483648 !important;
              "
            >
              ${timeoutLabels[min as TimeoutOption]}
            </button>
          `).join('')}
        </div>
      </div>
      <button 
        id="annoime-dismiss-fallback" 
        style="
          margin-top: 20px;
          padding: 12px 32px;
          background: white;
          color: #333;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
          font-family: inherit;
          text-align: center;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          box-sizing: border-box;
          transition: background 0.2s;
          pointer-events: auto !important;
          position: relative;
          z-index: 2147483648 !important;
        "
      >
        Let me in
      </button>
    </div>
  `;
  
  document.body.appendChild(fallbackOverlay);
  console.log('Fallback overlay added to DOM');
  
  let selectedTimeout: TimeoutOption = defaultSelection;
  
  // Setup event listeners for fallback
  setTimeout(() => {
    const timeoutButtons = fallbackOverlay.querySelectorAll('.annoime-timeout-btn-fallback');
    console.log('Setting up fallback timeout buttons:', timeoutButtons.length);
    
    timeoutButtons.forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Fallback timeout button clicked:', btn.textContent);
        
        timeoutButtons.forEach((b) => {
          (b as HTMLElement).style.background = 'transparent';
          (b as HTMLElement).style.color = 'white';
        });
        (btn as HTMLElement).style.background = 'white';
        (btn as HTMLElement).style.color = '#333';
        selectedTimeout = parseInt(btn.getAttribute('data-minutes') || '0', 10) as TimeoutOption;
      });
    });
    
    const dismissBtn = document.getElementById('annoime-dismiss-fallback');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Fallback dismiss button clicked, selectedTimeout:', selectedTimeout);
        
        try {
          const response = await browser.runtime.sendMessage({
            type: 'TEMP_ALLOW',
            site: hostname,
            minutes: selectedTimeout,
          });
          console.log('Fallback TEMP_ALLOW response:', response);
          
          fallbackOverlay.remove();
          
          if (selectedTimeout > 0) {
            startTimer(selectedTimeout, hostname);
          }
        } catch (error) {
          console.error('Fallback error sending TEMP_ALLOW message:', error);
        }
      });
    }
  }, 50);
}

function startTimer(minutes: number, site: string, existingEndTime?: number) {
  console.log('startTimer called for', site, 'minutes:', minutes, 'endTime:', existingEndTime);
  
  // Clean up any existing timer and animation frame
  const existingTimer = document.getElementById('annoime-timer');
  if (existingTimer) {
    existingTimer.remove();
  }
  
  // Cancel any existing animation frame
  if (window.annoimeTimerFrame) {
    cancelAnimationFrame(window.annoimeTimerFrame);
  }

  // Add timer styles if not already present
  if (!document.getElementById('annoime-timer-style')) {
    const style = document.createElement('style');
    style.id = 'annoime-timer-style';
    style.textContent = timerStyles;
    document.head.appendChild(style);
  }

  const endTime = existingEndTime || Date.now() + minutes * 60 * 1000;
  
  const timerEl = document.createElement('div');
  timerEl.id = 'annoime-timer';
  timerEl.title = 'Click to hide timer';
  
  // Click to hide (only hides until next page load)
  timerEl.addEventListener('click', () => {
    timerEl.classList.add('annoime-hidden');
  });
  
  document.body.appendChild(timerEl);
  console.log('Timer element added to body');
  
  const updateTimer = () => {
    const remaining = endTime - Date.now();
    
    if (remaining <= 0) {
      timerEl.classList.remove('annoime-hidden');
      timerEl.classList.add('annoime-expired');
      timerEl.textContent = '00:00';
      timerEl.title = 'Time expired';
      
      setTimeout(() => {
        timerEl.remove();
        // Only remove styles if no other timer exists
        if (!document.getElementById('annoime-timer')) {
          const style = document.getElementById('annoime-timer-style');
          if (style) style.remove();
        }
        showBlurOverlay(0);
      }, 2000);
      
      return;
    }
    
    timerEl.textContent = formatTime(remaining);
    
    if (remaining < 60000) {
      timerEl.classList.add('annoime-warning');
    } else {
      timerEl.classList.remove('annoime-warning');
    }
    
    window.annoimeTimerFrame = requestAnimationFrame(updateTimer);
  };
  
  updateTimer();
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
