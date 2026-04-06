# ModusOp Dock

**The missing project manager for Nova.**

Adding a new project to Nova used to be painful — clone the repo in Terminal, add it to Sourcetree, then manually open it as a Nova project. Three apps, multiple steps, every single time.

ModusOp Dock fixes this. Browse your GitHub repos right in Nova's sidebar, click to clone, and it's immediately open as a project. One step. One app.

## Features

### Multi-Repo Dashboard
See all your local repositories in a single sidebar — across all Nova workspaces. Color-coded status icons show you what needs attention at a glance:

- 🟢 **Green** — clean, up to date
- 🟠 **Orange** — uncommitted changes
- 🔵 **Blue** — unpushed commits (needs push)
- 🔴 **Red** — behind remote (needs pull)
- 🟣 **Purple** — diverged (ahead and behind)

Plus text badges with exact counts: `▲3` commits to push, `▼1` to pull, `✱7` uncommitted files.

### One-Click Clone & Open
Browse all repos from your GitHub account in the GitHub tab. See a repo you need? Double-click it — Dock clones it to your repos folder and opens it in Nova as a project. Done.

No Terminal. No Sourcetree. No manual project setup.

### Custom Folders
Organize repos into collapsible folders — Clients, Internal, Plugins, whatever makes sense. Right-click any repo to move it, or select multiple repos and move them together. Folders persist across restarts.

### Right-Click Actions
Every repo has a full context menu:
- **Open in Nova** — switch to any project instantly
- **Pull / Push** — git operations without leaving Nova
- **Open in GitHub** — jump to the repo in your browser
- **Move to Folder** — organize into custom groups
- **Clone** — for remote repos in the GitHub tab

### GitHub Integration
Connects to your GitHub account (personal or organization) and shows all your repos — including private ones. The Local tab shows what's on your machine, the GitHub tab shows what's available to clone.

A green ✅ indicator confirms your GitHub connection. Token stored securely in macOS Keychain — never in plaintext.

### Settings Backup
Your Nova settings are precious — clips, keybindings, behaviors, preferences. Dock backs them all up to a private GitHub repo automatically.

**What gets backed up:**
- Clips, key bindings, behaviors, user configuration
- Workspace layouts, server connections, color swatches
- A manifest of all installed extensions (name, version, identifier)

Sync manually with one click, or enable auto-sync on launch. Setting up a new Mac? Clone the backup repo, hit Restore, and your entire Nova environment is back.

**Note:** Project-specific clips and settings live in each project's `.nova/` directory, which is included in your git repo by default. Global settings are what Dock backs up.

### Secure by Default
- GitHub token stored in **macOS Keychain** — never in plaintext, never in config files
- Settings backup pushed to a **private** GitHub repo
- No external servers, no analytics, no tracking

## Setup

1. **Set your GitHub username** — Open extension preferences → "GitHub Username"
2. **Set your repos root** — Point "Local Repos Root" to where your repos live (e.g. `~/Sites`)
3. **Add a GitHub token** — Extensions menu → ModusOp Dock → Set GitHub Token. Create a token at [github.com/settings/tokens](https://github.com/settings/tokens) with `repo` scope.

That's it. Your repos appear in the sidebar, color-coded with git status.

## Privacy

All authentication uses your own GitHub token stored in macOS Keychain. Settings backups go to your own private GitHub repo. No data is sent to ModusOp or any third party. Ever.

## Roadmap

**v1.x** — Background polling, drag to reorder, notifications when repos fall behind.
**v2.0** — Optional ModusOp integration: client names on repos, retainer status badges, project mapping.

*Standalone: everything works without ModusOp. Better with it.*
