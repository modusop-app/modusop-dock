const Git = require("./git");
const GitHub = require("./github");

const NOVA_SUPPORT_DIR = nova.path.expanduser("~/Library/Application Support/Nova");

// Skip these — not user settings
const SKIP_ITEMS = new Set([
  "Extensions",
  "Logs",
  "Artwork",
  "Workspaces",
  "Changes.fastsync"
]);

function runProcess(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = new Process(cmd, { args });
    proc.onStdout(() => {});
    proc.onStderr(() => {});
    proc.onDidExit((code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} failed with code ${code}`));
    });
    proc.start();
  });
}

class SettingsSync {
  constructor(store) {
    this._store = store;
    this._syncing = false;
  }

  get repoName() {
    return nova.config.get("modusop.dock.settingsRepoName") || "nova-settings";
  }

  get localRepoPath() {
    const home = nova.path.expanduser("~");
    return nova.path.join(home, ".modusop", this.repoName);
  }

  get lastSyncTime() {
    return nova.config.get("modusop.dock.lastSettingsSync") || null;
  }

  set lastSyncTime(timestamp) {
    nova.config.set("modusop.dock.lastSettingsSync", timestamp);
  }

  get lastSyncDisplay() {
    const ts = this.lastSyncTime;
    if (!ts) return "Never synced";
    const date = new Date(ts);
    return "Last sync: " + date.toLocaleString();
  }

  isClonedLocally() {
    const gitDir = nova.path.join(this.localRepoPath, ".git");
    return nova.fs.stat(gitDir) !== null;
  }

  async checkRemoteExists(token, username) {
    if (!token || !username) return false;

    try {
      const response = await fetch(
        `https://api.github.com/repos/${username}/${this.repoName}`,
        {
          headers: {
            "Authorization": `token ${token}`,
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "ModusOp-Dock-Nova"
          }
        }
      );
      return response.status === 200;
    } catch (e) {
      return false;
    }
  }

  async createRemoteRepo(token) {
    if (!token) throw new Error("No GitHub token configured");

    const response = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "ModusOp-Dock-Nova",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: this.repoName,
        description: "Nova editor settings backup (managed by ModusOp Dock)",
        private: true,
        auto_init: true
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || `GitHub API error: ${response.status}`);
    }

    return await response.json();
  }

  async cloneRepo(token, username) {
    const parentDir = nova.path.dirname(this.localRepoPath);

    if (!nova.fs.stat(parentDir)) {
      await runProcess("/bin/mkdir", ["-p", parentDir]);
    }

    const url = `https://github.com/${username}/${this.repoName}.git`;
    await Git.cloneRepo(url, this.localRepoPath);
  }

  async sync() {
    if (this._syncing) return;
    this._syncing = true;

    try {
      const token = GitHub.getToken();
      const username = this._store.githubUsername;

      if (!token || !username) {
        throw new Error("Configure GitHub username and token first.");
      }

      // Ensure repo exists remotely
      console.log("ModusOp Dock: Sync — checking remote repo...");
      const exists = await this.checkRemoteExists(token, username);
      if (!exists) {
        console.log("ModusOp Dock: Sync — creating remote repo...");
        await this.createRemoteRepo(token);
      }

      // Ensure cloned locally
      if (!this.isClonedLocally()) {
        console.log("ModusOp Dock: Sync — cloning repo to", this.localRepoPath);
        await this.cloneRepo(token, username);
      }

      const repoPath = this.localRepoPath;
      console.log("ModusOp Dock: Sync — repo at", repoPath);

      // Pull latest first
      try {
        await Git.pull(repoPath);
      } catch (e) {
        console.log("ModusOp Dock: Sync — pull skipped:", e.message);
      }

      // Ensure .gitignore exists
      console.log("ModusOp Dock: Sync — writing .gitignore...");
      await this._writeGitignore(repoPath);

      // Auto-discover and copy Nova settings
      let filesCopied = 0;
      const items = nova.fs.listdir(NOVA_SUPPORT_DIR) || [];

      for (const itemName of items) {
        if (SKIP_ITEMS.has(itemName)) continue;
        if (itemName.startsWith(".")) continue;

        const sourcePath = nova.path.join(NOVA_SUPPORT_DIR, itemName);
        const destPath = nova.path.join(repoPath, itemName);
        const stat = nova.fs.stat(sourcePath);
        if (!stat) continue;

        if (stat.isDirectory()) {
          console.log("ModusOp Dock: Sync — copying", itemName + "/");
          await runProcess("/usr/bin/rsync", [
            "-a", "--delete", sourcePath + "/", destPath + "/"
          ]);
        } else if (stat.isFile()) {
          console.log("ModusOp Dock: Sync — copying", itemName);
          await runProcess("/bin/cp", [sourcePath, destPath]);
        }
        filesCopied++;
      }

      // Generate installed extensions manifest
      console.log("ModusOp Dock: Sync — generating extensions manifest...");
      await this._writeExtensionsManifest(repoPath);
      filesCopied++;

      if (filesCopied === 0) {
        this.lastSyncTime = Date.now();
        return;
      }

      // Stage all changes
      await Git.runGit(["add", "-A"], repoPath);

      // Check if there are changes to commit
      const status = await Git.runGit(["status", "--porcelain"], repoPath);
      if (status.trim().length > 0) {
        const timestamp = new Date().toISOString();
        await Git.runGit(["commit", "-m", `Nova settings backup ${timestamp}`], repoPath);

        // Detect default branch and push
        try {
          const branch = await Git.runGit(["symbolic-ref", "--short", "HEAD"], repoPath);
          await Git.runGit(["push", "origin", branch], repoPath);
        } catch (e) {
          throw new Error("Push failed: " + e.message);
        }
      }

      this.lastSyncTime = Date.now();
    } finally {
      this._syncing = false;
    }
  }

  async restore() {
    const token = GitHub.getToken();
    const username = this._store.githubUsername;

    if (!token || !username) {
      throw new Error("Configure GitHub username and token first.");
    }

    if (!this.isClonedLocally()) {
      const exists = await this.checkRemoteExists(token, username);
      if (!exists) {
        throw new Error("No settings backup found on GitHub.");
      }
      await this.cloneRepo(token, username);
    }

    try {
      await Git.pull(this.localRepoPath);
    } catch (e) {
      // May fail if no remote changes
    }

    let filesRestored = 0;
    const items = nova.fs.listdir(this.localRepoPath) || [];

    for (const itemName of items) {
      if (itemName.startsWith(".")) continue;
      if (itemName === "README.md") continue;
      if (itemName === "installed-extensions.json") continue;

      const sourcePath = nova.path.join(this.localRepoPath, itemName);
      const destPath = nova.path.join(NOVA_SUPPORT_DIR, itemName);
      const stat = nova.fs.stat(sourcePath);
      if (!stat) continue;

      if (stat.isDirectory()) {
        await runProcess("/usr/bin/rsync", ["-a", sourcePath + "/", destPath + "/"]);
      } else if (stat.isFile()) {
        await runProcess("/bin/cp", [sourcePath, destPath]);
      }
      filesRestored++;
    }

    return filesRestored;
  }

  async _writeGitignore(repoPath) {
    const gitignorePath = nova.path.join(repoPath, ".gitignore");
    if (!nova.fs.stat(gitignorePath)) {
      await runProcess("/bin/sh", ["-c", `printf '.DS_Store\\n*.cache\\n*.log\\n' > '${gitignorePath}'`]);
    }
  }

  async _writeExtensionsManifest(repoPath) {
    const extDir = nova.path.join(NOVA_SUPPORT_DIR, "Extensions");
    const manifestPath = nova.path.join(repoPath, "installed-extensions.json");

    const extensions = [];

    // Read Extensions.plist or scan extension dirs
    const items = nova.fs.listdir(extDir) || [];
    for (const item of items) {
      if (item.startsWith(".")) continue;
      const extPath = nova.path.join(extDir, item);

      // Try to read extension.json from installed extensions
      const jsonPath = nova.path.join(extPath, "extension.json");
      if (nova.fs.stat(jsonPath)) {
        try {
          const file = nova.fs.open(jsonPath, "r");
          const content = file.read(jsonPath);
          file.close();
          const manifest = JSON.parse(content);
          extensions.push({
            identifier: manifest.identifier || item,
            name: manifest.name || item,
            version: manifest.version || "unknown",
            organization: manifest.organization || ""
          });
        } catch (e) {
          extensions.push({ identifier: item, name: item, version: "unknown", organization: "" });
        }
      }
    }

    extensions.sort((a, b) => a.name.localeCompare(b.name));

    const manifest = {
      generated: new Date().toISOString(),
      count: extensions.length,
      extensions: extensions
    };

    const json = JSON.stringify(manifest, null, 2);
    await runProcess("/bin/sh", ["-c", `printf '%s' '${json.replace(/'/g, "'\\''")}' > '${manifestPath}'`]);
  }
}

class SettingsDataProvider {
  constructor(settingsSync) {
    this._sync = settingsSync;
  }

  getChildren(element) {
    if (element) return [];

    const items = [
      { type: "status", label: this._sync.lastSyncDisplay, repoName: this._sync.repoName }
    ];

    // Auto-discover backed up items
    const novaItems = nova.fs.listdir(NOVA_SUPPORT_DIR) || [];
    for (const name of novaItems.sort()) {
      if (SKIP_ITEMS.has(name)) continue;
      if (name.startsWith(".")) continue;

      const stat = nova.fs.stat(nova.path.join(NOVA_SUPPORT_DIR, name));
      if (stat) {
        const label = stat.isDirectory() ? name + "/" : name;
        items.push({ type: "item", label: label, path: name });
      }
    }

    // Extensions manifest
    items.push({ type: "item", label: "Installed Extensions", path: "_extensions" });

    return items;
  }

  getTreeItem(element) {
    const item = new TreeItem(element.label, TreeItemCollapsibleState.None);

    if (element.type === "status") {
      item.identifier = "settings-status";
      item.descriptiveText = element.repoName;
      item.contextValue = "settings-status";
    } else {
      item.identifier = `settings-${element.path}`;
      item.contextValue = "settings-item";

      if (element.path === "_extensions") {
        // Count installed extensions
        const extDir = nova.path.join(NOVA_SUPPORT_DIR, "Extensions");
        const extItems = nova.fs.listdir(extDir) || [];
        const count = extItems.filter(e => !e.startsWith(".")).length;
        item.descriptiveText = `${count} extensions`;
      } else {
        item.descriptiveText = "Ready";
      }
    }

    return item;
  }
}

module.exports = { SettingsSync, SettingsDataProvider };
