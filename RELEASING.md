# Releasing

How to cut a release. Followed for v0.2.0; adjust as the process evolves.

## Versioning

- `X.Y.Z` in `package.json` and git tags (`vX.Y.Z`).
- Pre-1.0: bump the **minor** for features, the **patch** for fixes.
- The zip filename is derived from the version — bump it *before*
  running `pnpm zip`.

## Steps

```sh
# 1. Update CHANGELOG.md — add a "## vX.Y.Z — YYYY-MM-DD" section
#    (keep the format: ### Features / ### Fixes).

# 2. Bump "version" in package.json.

# 3. Verify everything is clean and build the store-ready zip.
pnpm compile
pnpm zip          # → .output/blockera-X.Y.Z-chrome.zip

# 4. Commit and tag (annotated tag — it carries the release notes).
git add CHANGELOG.md package.json
git commit -m "chore(release): vX.Y.Z"
git tag -a vX.Y.Z -m "<one-paragraph release summary>"

# 5. Push the branch and the tag together.
git push origin main vX.Y.Z

# 6. Create the GitHub release with the zip attached. Generate notes from
#    the changelog section plus install instructions:
awk '/^## v0\.2\.0/{f=1;next}/^## v0\.1\.0/{f=0}f' CHANGELOG.md
gh release create vX.Y.Z .output/blockera-X.Y.Z-chrome.zip \
  --title "vX.Y.Z — <short summary>" \
  --notes-file <notes.md>

# 7. Verify.
gh release view vX.Y.Z
```

## Notes

- Firefox zips: `pnpm zip:firefox` → `.output/blockera-X.Y.Z-firefox.zip`
  (only after verifying the build actually works in Firefox — see ROADMAP).
- The zip lives only on the GitHub release; `.output/` is gitignored, so
  don't try to commit build artifacts.
- The `gh release create --notes-file` input is throwaway — the canonical
  changelog is `CHANGELOG.md` in the repo.
- Annotated tags (`git tag -a`), never lightweight, so
  `git show vX.Y.Z` shows the release notes.
