import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import type { TimeoutOption } from '@/utils/storage';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('Annoime content script loaded on', window.location.hostname);
    const hostname = window.location.hostname.replace(/^www\./, '');
    
    browser.runtime.onMessage.addListener(async (message) => {
      console.log('Content script received message:', message.type);
      if (message.type === 'BLOCK_SITE') {
        const timeout = await browser.runtime.sendMessage({ type: 'GET_TIMEOUT' }) as TimeoutOption;
        showBlurOverlay(timeout);
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
  if (document.getElementById('annoime-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'annoime-overlay';
  
  const hostname = window.location.hostname.replace(/^www\./, '');
  
  const defaultSelection: TimeoutOption = 0;
  
  overlay.innerHTML = `
    <div class="annoime-content">
      <h1>Stay Focused</h1>
      <p>This site is on your block list.</p>
      <div class="annoime-timeout-section">
        <p class="annoime-timeout-label">Allow access for:</p>
        <div class="annoime-timeout-options">
          ${[0, 5, 15, 30, 60].map((min) => `
            <button 
              class="annoime-timeout-btn ${min === defaultSelection ? 'annoime-selected' : ''}" 
              data-minutes="${min}"
            >
              ${timeoutLabels[min as TimeoutOption]}
            </button>
          `).join('')}
        </div>
      </div>
      <button id="annoime-dismiss" class="annoime-dismiss-btn">Let me in</button>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #annoime-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      backdrop-filter: blur(20px);
      background: rgba(0, 0, 0, 0.5);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
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
      padding: 8px 16px;
      background: transparent;
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }
    .annoime-timeout-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.5);
    }
    .annoime-timeout-btn.annoime-selected {
      background: white;
      color: #333;
      border-color: white;
    }
    .annoime-dismiss-btn {
      margin-top: 20px;
      padding: 12px 32px;
      background: white;
      color: #333;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 500;
      transition: background 0.2s;
    }
    .annoime-dismiss-btn:hover {
      background: #f0f0f0;
    }
    ${timerStyles}
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  let selectedTimeout: TimeoutOption = 0;

  overlay.querySelectorAll('.annoime-timeout-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.annoime-timeout-btn').forEach((b) => {
        b.classList.remove('annoime-selected');
      });
      btn.classList.add('annoime-selected');
      selectedTimeout = parseInt(btn.getAttribute('data-minutes') || '0', 10) as TimeoutOption;
    });
  });

  document.getElementById('annoime-dismiss')?.addEventListener('click', () => {
    browser.runtime.sendMessage({
      type: 'TEMP_ALLOW',
      site: hostname,
      minutes: selectedTimeout,
    });
    
    overlay.remove();
    style.remove();
    
    if (selectedTimeout > 0) {
      startTimer(selectedTimeout, hostname);
    }
  });
}

function startTimer(minutes: number, site: string, existingEndTime?: number) {
  console.log('startTimer called for', site, 'minutes:', minutes, 'endTime:', existingEndTime);
  
  // Remove existing timer first
  const existingTimer = document.getElementById('annoime-timer');
  if (existingTimer) {
    existingTimer.remove();
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
        const style = document.getElementById('annoime-timer-style');
        if (style) style.remove();
        showBlurOverlay(0);
      }, 2000);
      
      return;
    }
    
    timerEl.textContent = formatTime(remaining);
    
    if (remaining < 60000) {
      timerEl.classList.add('annoime-warning');
    }
    
    requestAnimationFrame(updateTimer);
  };
  
  updateTimer();
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
