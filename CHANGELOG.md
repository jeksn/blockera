# Changelog

## v0.2.0 — 2026-10-17

### Features

- **Block groups.** Sites are organised into groups, each with its own rules.
  The first matching group wins; a site matches its domain and all subdomains.
  - **Override:** allow temporary access, or always block with no way to
    dismiss the overlay (for no-go sites).
  - **Access per dismiss:** how long a "Let me in" click unblocks the site
    (just this once / 5 / 15 / 30 / 60 minutes).
  - **Daily limit:** optional minutes-per-day budget per group. Grants are
    clamped to the remaining budget; once spent, sites are hard-blocked
    until midnight.
- **Settings password.** Optional password (salted SHA-256, stored locally)
  required to open the settings page. No in-app reset — recovery is
  removing and reinstalling the extension.
- **Landing page** with a setup guide and personal-responsibility
  disclaimer, shown on first install and as the default Home view in
  settings.
- **New settings UI:** full-page options with sidebar navigation (Home,
  Security, groups), dark neutral-grey theme, full group editor.
- **Legacy migration:** the old flat blocked-sites list and timeout setting
  become a "Default" group automatically.

### Fixes

- SPA route changes (pushState) now re-check the block list via
  `webNavigation.onHistoryStateUpdated` — previously the overlay never
  reappeared on sites like YouTube or Twitter.
- The content script self-checks its block status on load instead of
  relying solely on background push messages.
- Removed the destructive "hide all high z-index elements" hack, the
  duplicated fallback overlay, and debug logging; the countdown timer
  uses a 250ms interval instead of a 60fps animation frame.
- Finished the Blockera rebrand (no more annoime identifiers) and fixed
  the leftover "Default Popup Title" action title.

## v0.1.0 — 2026-10-17

Initial rebranded release: dismissible blur overlay on blocked sites,
temporary access with a countdown timer, popup and options UI.
