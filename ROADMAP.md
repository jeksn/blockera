# Roadmap

Where Blockera is headed. Ordered by phase; anything below "Now" is
negotiable. The guiding rule stays: friction over force, and no option
cramming — every feature has to earn its place.

## Now — launch readiness

The gap between "works for me" and "safe to publish on the Chrome Web
Store".

- **Real-browser test pass.** The whole flow (migration, overlay, timers,
  budget clamp, hard block, password lock, SPA re-check on YouTube) has
  never been systematically tested in Chrome. Before anything else.
- **Chrome Web Store listing.** Single-purpose statement, description,
  screenshots, 1280x800 promo art, privacy policy (linking to one — even
  though Blockera collects nothing, the store requires the disclosure).
- **Permission justification.** `<all_urls>` + `storage`,
  `webNavigation`, `scripting` will get review scrutiny. Write the
  justification ("checks every navigation against a local block list;
  no data leaves the device") into the review notes.
- **Firefox browser testing.** The build compiles for Firefox; verify the
  overlay, timers, and password flow actually work there before listing.
- **Edge cases.** Prerendered pages (may skip webNavigation events — the
  load-time self-check mitigates); attempt-counter accuracy across SPA
  navigations.

## Next — features with clear value

- **Commitment lock.** Freeze a group's rules until a chosen time
  (tomorrow, this week) — even the settings page can't change them
  without the password. Natural extension of the existing password.

## Later — polish and reach

- **Preset category lists.** One-click "add top 20 social sites" style
  suggestions when creating a group.
- **Cross-device budgets.** Daily usage currently counts per device.
  Syncing it is possible via `storage.sync` but has merge/latency caveats;
  needs design work before promising it.
- **Custom overlay.** User-defined message/quote on the block screen.
- **i18n** and **Safari** (WXT supports both).
- **Group UX.** Reorder, duplicate, search sites — only when the number
  of groups actually makes these necessary.

## Explicitly not doing

- **Hard, unbypassable blocking.** Not possible for a browser extension,
  and pretending otherwise would be dishonest — see the landing page.
- **Remote-server anything.** Accounts, telemetry, cloud sync services.
  Local-only is a feature.
- **Per-site rule explosion.** If a rule can't be expressed as a group
  property, it doesn't get added. Keep the LeechBlock lesson.
