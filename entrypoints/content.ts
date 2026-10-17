import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';

interface SiteState {
  blocked: boolean;
  groupName?: string;
  allowPresets: number[];
  defaultAllow: number;
  hardBlock: boolean;
  budgetRemaining: number | null;
  tempAllowedUntil?: number;
}

interface TempAllowResponse {
  success: boolean;
  grantedMinutes?: number;
  reason?: string;
}

const OVERLAY_ID = 'blockera-overlay';
const OVERLAY_STYLE_ID = 'blockera-overlay-style';
const TIMER_ID = 'blockera-timer';
const TIMER_STYLE_ID = 'blockera-timer-style';

const timerStyles = `
  #blockera-timer {
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
  #blockera-timer:hover {
    background: rgba(255, 255, 255, 0.85);
  }
  #blockera-timer.blockera-hidden {
    opacity: 0;
    pointer-events: none;
  }
  #blockera-timer.blockera-warning {
    background: rgba(255, 165, 0, 0.75);
    color: #fff;
  }
  #blockera-timer.blockera-warning:hover {
    background: rgba(255, 165, 0, 0.9);
  }
  #blockera-timer.blockera-expired {
    background: rgba(220, 20, 60, 0.75);
    color: #fff;
  }
  #blockera-timer.blockera-expired:hover {
    background: rgba(220, 20, 60, 0.9);
  }
`;

const overlayStyles = `
  #blockera-overlay {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    backdrop-filter: blur(20px);
    background: rgba(0, 0, 0, 0.5) !important;
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
  }
  #blockera-overlay .blockera-content {
    text-align: center;
    color: white;
    padding: 40px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 16px;
    max-width: 420px;
    width: 90%;
  }
  #blockera-overlay h1 {
    margin: 0 0 16px 0;
    font-size: 28px;
  }
  #blockera-overlay p {
    margin: 0 0 20px 0;
    opacity: 0.9;
    font-size: 16px;
  }
  .blockera-timeout-section {
    margin: 24px 0;
  }
  .blockera-timeout-label {
    font-size: 14px;
    opacity: 0.8;
    margin-bottom: 12px !important;
  }
  .blockera-timeout-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
  .blockera-timeout-btn {
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
    user-select: none !important;
  }
  .blockera-timeout-btn:hover {
    background: rgba(255, 255, 255, 0.1) !important;
    border-color: rgba(255, 255, 255, 0.5) !important;
  }
  .blockera-timeout-btn.blockera-selected {
    background: white !important;
    color: #333 !important;
    border-color: white !important;
  }
  .blockera-dismiss-btn {
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
    min-height: 44px !important;
    box-sizing: border-box !important;
    transition: background 0.2s !important;
    user-select: none !important;
  }
  .blockera-dismiss-btn:hover {
    background: #f0f0f0 !important;
  }
  .blockera-info {
    font-size: 12px;
    opacity: 0.65;
    margin-top: 16px !important;
    margin-bottom: 0 !important;
  }
  ${timerStyles}
`;

const labelForMinutes = (min: number) =>
  min === 0 ? 'Just this once' : `${min} minutes`;

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    // Guard against double registration when the background script injects
    // this file into a tab where it already auto-loaded.
    const w = window as typeof window & { __blockeraLoaded?: boolean };
    if (w.__blockeraLoaded) return;
    w.__blockeraLoaded = true;

    const hostname = window.location.hostname.replace(/^www\./, '');

    browser.runtime.onMessage.addListener((message) => {
      if (message.type === 'CHECK_SITE') {
        void applySiteState();
      }
    });

    // Self-check on load: don't rely solely on the background push, which
    // can miss navigations (prerendering, cached loads).
    void applySiteState();

    async function applySiteState() {
      let state: SiteState | null = null;
      try {
        state = (await browser.runtime.sendMessage({
          type: 'GET_SITE_STATE',
          site: hostname,
        })) as SiteState | null;
      } catch {
        return; // Extension context unavailable; nothing to do.
      }
      if (!state) return;

      // A temp-allowed site still reports blocked=true; the active
      // allowance wins until it expires.
      if (state.tempAllowedUntil && state.tempAllowedUntil > Date.now()) {
        startTimer(
          (state.tempAllowedUntil - Date.now()) / 60000,
          state.tempAllowedUntil,
        );
        return;
      }
      if (state.blocked) {
        showOverlay(state);
      }
    }
  },
});

let timerInterval: ReturnType<typeof setInterval> | undefined;

function stopTimerLoop() {
  if (timerInterval !== undefined) {
    clearInterval(timerInterval);
    timerInterval = undefined;
  }
  window.removeEventListener('pagehide', stopTimerLoop);
}

function showOverlay(state: SiteState) {
  document.getElementById(OVERLAY_ID)?.remove();

  const hostname = window.location.hostname.replace(/^www\./, '');
  let selectedTimeout = state.defaultAllow;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;

  const description = state.hardBlock
    ? `You've used your daily limit for ${state.groupName ?? 'this site'}.`
    : 'This site is on your block list.';

  let budgetInfo = '';
  if (!state.hardBlock && state.budgetRemaining !== null) {
    budgetInfo = `<p class="blockera-info">${
      state.budgetRemaining > 0
        ? `${state.budgetRemaining} min left today`
        : 'No time left today'
    }</p>`;
  }

  const optionsHTML = state.hardBlock
    ? ''
    : `
      <div class="blockera-timeout-section">
        <p class="blockera-timeout-label">Allow access for:</p>
        <div class="blockera-timeout-options">
          ${state.allowPresets
            .map(
              (min) => `
            <button
              class="blockera-timeout-btn ${min === selectedTimeout ? 'blockera-selected' : ''}"
              data-minutes="${min}"
            >
              ${labelForMinutes(min)}
            </button>
          `,
            )
            .join('')}
        </div>
      </div>
      <button id="blockera-dismiss" class="blockera-dismiss-btn">Let me in</button>
      ${budgetInfo}
    `;

  const hardBlockFooter = state.hardBlock
    ? '<p class="blockera-info">It will unlock at midnight.</p>'
    : '';

  overlay.innerHTML = `
    <div class="blockera-content">
      <h1>Stay Focused</h1>
      <p>${description}</p>
      ${optionsHTML}
      ${hardBlockFooter}
    </div>
  `;

  if (!document.getElementById(OVERLAY_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = OVERLAY_STYLE_ID;
    style.textContent = overlayStyles;
    document.head.appendChild(style);
  }

  if (!state.hardBlock) {
    overlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target.classList.contains('blockera-timeout-btn')) {
        e.preventDefault();
        overlay.querySelectorAll('.blockera-timeout-btn').forEach((b) => {
          b.classList.remove('blockera-selected');
        });
        target.classList.add('blockera-selected');
        selectedTimeout = parseInt(target.getAttribute('data-minutes') || '0', 10);
        return;
      }

      if (target.id === 'blockera-dismiss' || target.classList.contains('blockera-dismiss-btn')) {
        e.preventDefault();
        void (async () => {
          let response: TempAllowResponse | null = null;
          try {
            response = (await browser.runtime.sendMessage({
              type: 'TEMP_ALLOW',
              site: hostname,
              minutes: selectedTimeout,
            })) as TempAllowResponse | null;
          } catch {
            return; // Extension context unavailable; keep the overlay up.
          }
          if (!response?.success) {
            // Budget ran out between render and click (or clamped to zero):
            // fall back to the hard-block overlay.
            showOverlay({ ...state, hardBlock: true, budgetRemaining: 0 });
            return;
          }
          overlay.remove();
          if ((response.grantedMinutes ?? 0) > 0) {
            startTimer(response.grantedMinutes!);
          }
        })();
      }
    });
  }

  const root = document.body || document.documentElement;
  root.appendChild(overlay);
}

function startTimer(minutes: number, existingEndTime?: number) {
  stopTimerLoop();

  const existingTimer = document.getElementById(TIMER_ID);
  if (existingTimer) existingTimer.remove();

  if (!document.getElementById(TIMER_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = TIMER_STYLE_ID;
    style.textContent = timerStyles;
    document.head.appendChild(style);
  }

  const endTime = existingEndTime ?? Date.now() + minutes * 60 * 1000;

  const timerEl = document.createElement('div');
  timerEl.id = TIMER_ID;
  timerEl.title = 'Click to hide timer';
  timerEl.addEventListener('click', () => {
    timerEl.classList.add('blockera-hidden');
  });

  document.body.appendChild(timerEl);

  window.addEventListener('pagehide', stopTimerLoop);

  const update = () => {
    const remaining = endTime - Date.now();

    if (remaining <= 0) {
      stopTimerLoop();
      timerEl.classList.remove('blockera-hidden');
      timerEl.classList.add('blockera-expired');
      timerEl.textContent = '00:00';
      timerEl.title = 'Time expired';

      setTimeout(() => {
        timerEl.remove();
        if (!document.getElementById(TIMER_ID)) {
          document.getElementById(TIMER_STYLE_ID)?.remove();
        }
        // Re-check state: the site may now be budget-locked or unblocked.
        void browser.runtime
          .sendMessage({
            type: 'GET_SITE_STATE',
            site: window.location.hostname.replace(/^www\./, ''),
          })
          .then((state) => {
            const s = state as SiteState;
            if (s?.blocked) showOverlay(s);
          })
          .catch(() => {
            // Extension context unavailable.
          });
      }, 2000);
      return;
    }

    timerEl.textContent = formatTime(remaining);
    timerEl.classList.toggle('blockera-warning', remaining < 60000);
  };

  update();
  timerInterval = setInterval(update, 250);
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
