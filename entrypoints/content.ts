import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === 'BLOCK_SITE') {
        showBlurOverlay();
      }
    });
  }
});

function showBlurOverlay() {
  if (document.getElementById('annoime-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'annoime-overlay';
  overlay.innerHTML = `
    <div class="annoime-content">
      <h1>Stay Focused</h1>
      <p>This site is on your block list.</p>
      <button id="annoime-dismiss">I understand, let me in</button>
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
      background: rgba(0, 0, 0, 0.4);
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
      background: rgba(0, 0, 0, 0.6);
      border-radius: 16px;
      max-width: 400px;
    }
    #annoime-overlay h1 {
      margin: 0 0 16px 0;
      font-size: 32px;
    }
    #annoime-overlay p {
      margin: 0 0 24px 0;
      opacity: 0.8;
      font-size: 16px;
    }
    #annoime-overlay button {
      padding: 12px 24px;
      background: white;
      color: #333;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }
    #annoime-overlay button:hover {
      background: #f0f0f0;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(overlay);

  document.getElementById('annoime-dismiss')?.addEventListener('click', () => {
    overlay.remove();
    style.remove();
  });
}
