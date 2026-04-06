# ModusOp Dock

**The missing project manager for Nova.** Browse your GitHub repos, check git status across all projects, clone with one click, and sync your Nova settings across machines — all from the sidebar.

## Features

- **Multi-repo dashboard** — see all local repositories in a single sidebar with colour-coded git status (clean, dirty, ahead, behind, diverged) and exact counts
- **One-click clone and open** — browse your GitHub repos, click to clone, and it opens as a Nova project immediately
- **Custom folders** — organise repos into collapsible groups (Clients, Internal, Plugins) with drag and drop
- **GitHub integration** — connects via personal access token, shows all repos including private ones, token stored in macOS Keychain
- **Settings backup** — back up Nova clips, keybindings, behaviours, and preferences to a private GitHub repo
- **Right-click actions** — open in Nova, pull, push, open in GitHub, move to folder from any repo's context menu
- **Secure by default** — all tokens in macOS Keychain, backups to private repos, no external servers or tracking

## Installation

### Via Nova Extension Library

1. Open **Nova > Extensions > Extension Library**
2. Search for **ModusOp Dock**
3. Click **Install**

### Manual Install from GitHub

```bash
git clone https://github.com/modusop-app/modusop-dock.git
ln -s "$(pwd)/modusop-dock/ModusOp Dock.novaextension" \
  ~/Library/Application\ Support/Nova/Extensions/
```

Restart Nova after installing.

## Requirements

- Nova 10 or later
- macOS 12.0 (Monterey) or later
- GitHub account (personal access token for private repos)

## Setup

1. **Set your GitHub username** — Extension preferences > "GitHub Username"
2. **Set your repos root** — Point "Local Repos Root" to where your repos live (e.g. `~/Sites`)
3. **Add a GitHub token** — Extensions menu > ModusOp Dock > Set GitHub Token. Create one at [github.com/settings/tokens](https://github.com/settings/tokens) with `repo` scope.

Your repos appear in the sidebar, colour-coded with git status.

## Standalone vs ModusOp Connected

### Standalone (available now)

Everything works independently as a local Nova extension. No account or internet connection required beyond GitHub access for repo browsing and settings backup.

### ModusOp Connected (coming soon)

Optional integration with your [ModusOp](https://modusop.app) workspace — client names on repos, retainer status badges, project mapping, and team-wide settings sync.

## Privacy

All authentication uses your own GitHub token stored in macOS Keychain. Settings backups go to your own private GitHub repo. No data is sent to ModusOp or any third party.

## Links

- [Extension page](https://modusop.app/extensions/nova-dock)
- [Report an issue](https://modusop.app/extensions/nova-dock/known-issues)
- [Release notes](https://modusop.app/extensions/nova-dock/releases)

## Licence

MIT - see [LICENSE](LICENSE) for details.
