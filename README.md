# Blockera

A browser extension that blocks distracting sites with a dismissible blur overlay.

Sites are organised into block groups, each with its own rules. When you visit
a blocked site you get a "Stay Focused" screen — dismiss it for a one-time
pass, or pick a duration to temporarily allow access with a countdown timer.

Built with [WXT](https://wxt.dev) + React + TypeScript.

## Block groups

Each group holds a list of sites (a site matches its domain and all
subdomains) and a set of rules:

- **Override** — "Allow temporary access" enables the rules below; "Always
  block" makes the group's sites hard-blocked with no way to dismiss the
  overlay (for adult sites and other no-go sites).
- **Access per dismiss** — how long a "Let me in" click unblocks the site
  (just this once, or 5 / 15 / 30 / 60 minutes).
- **Daily limit** — optionally cap total allowed time per day (e.g.
  30 min/day). Once the budget is spent, the site is locked until midnight
  and the overlay offers no way out.

The first group that matches a site wins. A temporary allowance lasts for
the granted minutes; the countdown timer shows the remaining time and the
overlay returns when it expires.

## Settings

All configuration lives in the full-page settings (popup → "Open settings").
The popup itself only shows a summary of your groups.

Settings sync across browsers via `chrome.storage.sync`; temporary
allowances and daily usage are stored locally per browser.

## Development

```sh
pnpm install
pnpm dev        # dev server with auto-reload
pnpm build      # production build to .output/chrome-mv3
pnpm zip        # store-ready zip
```

Load the built extension via `chrome://extensions` → Developer mode →
Load unpacked → select `.output/chrome-mv3`.
