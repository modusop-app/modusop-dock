# Changelog

## Roadmap

### v2.0 — ModusOp Integration (optional)
- Show client name alongside each repo (via MO project mappings)
- Retainer status badge per repo
- One-click open client in MO browser
- Core repo management works without MO — integration is opt-in

### v1.x — Planned
- Background polling (configurable interval)
- Drag to reorder repos
- Notifications when repos fall behind
- Issue/PR status per repo

## 1.0.0

- Release version
- All features from 0.x development consolidated

## 0.8.0

- Auto-discover Nova settings — backs up everything in the support directory automatically
- Installed extensions manifest — generates `installed-extensions.json` with name, version, identifier for every installed extension
- Future-proof — if Nova adds new settings files, they're picked up automatically

## 0.7.0

- Fixed settings backup to sync actual Nova files (Clips.json, Behaviors.json, etc.)
- Nova stores clips in Clips.json, not a Clips/ directory

## 0.6.0

- Custom folders for repo organization — collapsible groups like Sourcetree
- New Folder header button
- Right-click → Move to Folder with multi-select support
- Right-click folder → Rename / Delete
- Folder assignments persist across restarts

## 0.5.0

- Color-coded status icons: green (clean), orange (dirty), blue (ahead), red (behind), purple (diverged)
- PAT stored securely in macOS Keychain via Set GitHub Token command
- GitHub connection status indicator in sidebar (green ✅ / ⚠️)

## 0.4.0

- Settings backup: sync Nova settings to a private GitHub repo
- Right-click context menus: Open, Pull, Push, Open in GitHub, Clone
- Uncommitted changes count (✱N) alongside push/pull badges
- Informative tooltips with full status breakdown on hover
- Extension Library preparation: license, homepage, bug reports

## 0.3.0

- Settings backup feature with Sync Now and Restore commands
- Configurable backup repo name
- Optional sync on launch

## 0.2.0

- Right-click context menus via contextCommands
- Sidebar icons in proper subfolder structure with metadata.json
- Semver versioning

## 0.1.0

- Initial release
- GitHub API integration with private repo support
- Local repo scanning with git status badges
- One-click clone and open workflow
- GitHub tab with search/filter
- Manual refresh
