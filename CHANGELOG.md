# Changelog

## Unreleased

### Features

- **Real time tracking.** Usage now counts actual minutes browsed
  (metered by a content-script heartbeat, only while the tab is visible),
  not minutes granted. Leaving early stops the meter; unused granted
  time no longer consumes the daily budget. Sessions are re-blocked
  mid-browse when a group's budget is exhausted. History is kept for 30
  days; old granted-minute data migrates to seconds.
- **Stats view** (options sidebar): today's time on blocked sites and
  block screens shown, per-group budget progress bars, and a 7-day
  stacked minutes chart per group. The popup shows a compact today
  summary. Factual numbers only — no streaks, points, or badges.
- **Backup:** export groups to a JSON file and import a previously
  exported one (Security section). Import replaces all groups; passwords
  and usage are never included.
- **Active hours** per group: block only during a set time window
  (e.g. 22:00–07:00; windows may cross midnight). Outside the window the
  group doesn't block at all.
- **Delay** per group: "Let me in" stays disabled for the first 5 or 10
  seconds after the block screen appears.
- **Attempt counter:** the block screen shows how many times you've hit
  it today (counted per site, reset daily).
- **Iframes:** blocked sites embedded in other pages are now covered —
  the content script runs in all frames, not just the top one.

### Changes

- Incognito limitation (overlay doesn't run there unless explicitly
  allowed) is now documented on the landing page.
- Firefox build verified to compile; browser testing still pending.

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
