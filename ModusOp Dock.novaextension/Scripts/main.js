const Store = require("./store");
const Git = require("./git");
const GitHub = require("./github");
const { LocalDataProvider, GitHubDataProvider } = require("./sidebar");
const { SettingsSync, SettingsDataProvider } = require("./settings-sync");

let store;
let localTreeView;
let githubTreeView;
let settingsTreeView;
let localProvider;
let githubProvider;
let settingsProvider;
let settingsSync;
let refreshing = false;
let disposables = [];

exports.activate = async function() {
  console.log("=== ModusOp Dock: ACTIVATING ===");

  store = new Store();

  // Set up data providers and tree views
  localProvider = new LocalDataProvider(store, GitHub.getToken);
  localTreeView = new TreeView("modusop.dock.local", {
    dataProvider: localProvider
  });

  githubProvider = new GitHubDataProvider(store);
  githubTreeView = new TreeView("modusop.dock.github", {
    dataProvider: githubProvider
  });

  // Settings sync
  settingsSync = new SettingsSync(store);
  settingsProvider = new SettingsDataProvider(settingsSync);
  settingsTreeView = new TreeView("modusop.dock.settings", {
    dataProvider: settingsProvider
  });

  // Register commands
  registerCommands();

  // Reload tree views when store changes
  store.onDidChange(() => {
    localTreeView.reload();
    githubTreeView.reload();
  });

  // Re-load data when preferences change
  disposables.push(
    nova.config.onDidChange("modusop.dock.githubUsername", () => loadAllData()),
    nova.config.onDidChange("modusop.dock.localReposRoot", () => loadAllData())
  );

  // Initial data load
  await loadAllData();

  // Auto-sync settings on launch if enabled
  const syncOnActivate = nova.config.get("modusop.dock.syncOnActivate") || false;
  if (syncOnActivate) {
    settingsSync.sync()
      .then(() => {
        console.log("ModusOp Dock: Auto-sync settings complete");
        settingsTreeView.reload();
      })
      .catch(e => console.warn("ModusOp Dock: Auto-sync failed:", e.message));
  }
};

exports.deactivate = function() {
  if (localTreeView) localTreeView.dispose();
  if (githubTreeView) githubTreeView.dispose();
  if (settingsTreeView) settingsTreeView.dispose();
  for (const d of disposables) d.dispose();
  disposables = [];
};

function getSelection(type) {
  // Get the correct selection based on command type
  // "local" = prefer local repos, "remote" = prefer non-local repos, "any" = either
  const localSel = localTreeView.selection[0] || null;
  const ghSel = githubTreeView.selection[0] || null;

  if (type === "local") {
    // For open/pull/push — need a local repo
    if (localSel && localSel.isLocal) return localSel;
    if (ghSel && ghSel.isLocal) return ghSel;
    return null;
  }

  if (type === "remote") {
    // For clone — need a non-local repo
    // Prefer GitHub tab since that's the clone source
    if (ghSel && !ghSel.isLocal) return ghSel;
    if (localSel && !localSel.isLocal) return localSel;
    return null;
  }

  // "any" — prefer whichever tab has a selection, GitHub first for non-local
  return ghSel || localSel;
}

function registerCommands() {
  disposables.push(
    nova.commands.register("modusop.dock.refresh", () => loadAllData()),

    nova.commands.register("modusop.dock.refreshGitHub", () => loadGitHubRepos()),

    nova.commands.register("modusop.dock.setToken", async () => {
      const token = await GitHub.setToken();
      if (token) {
        await loadAllData();
      }
    }),

    nova.commands.register("modusop.dock.openRepo", (workspace) => {
      const selection = getSelection("local");
      if (!selection || !selection.localPath) return;

      const process = new Process("/usr/bin/open", {
        args: ["-a", "Nova", selection.localPath]
      });
      process.start();
    }),

    nova.commands.register("modusop.dock.cloneRepo", async (workspace) => {
      const selection = getSelection("remote");
      if (!selection || !selection.cloneUrl) {
        console.log("ModusOp Dock: No selection or no clone URL");
        return;
      }

      const rootPath = store.localReposRoot;
      if (!rootPath) {
        nova.workspace.showWarningMessage("Set your Local Repos Root in extension preferences first.");
        return;
      }

      const destPath = nova.path.join(rootPath, selection.name);

      // Check if already exists
      if (nova.fs.stat(destPath)) {
        nova.workspace.showWarningMessage(
          `"${selection.name}" already exists at ${destPath}.`
        );
        return;
      }

      try {
        console.log("ModusOp Dock: Cloning", selection.cloneUrl, "to", destPath);
        nova.workspace.showInformativeMessage(`Cloning ${selection.name}...`);
        await Git.cloneRepo(selection.cloneUrl, destPath);

        // Update store
        store.setRepoLocalPath(selection.name, destPath);

        nova.workspace.showInformativeMessage(`Cloned ${selection.name} successfully!`);

        // Open in Nova
        const openProcess = new Process("/usr/bin/open", {
          args: ["-a", "Nova", destPath]
        });
        openProcess.start();
      } catch (e) {
        console.error("ModusOp Dock: Clone failed:", e.message);
        nova.workspace.showErrorMessage(`Clone failed: ${e.message}`);

        // Clean up partial clone
        try {
          if (nova.fs.stat(destPath)) {
            const rm = new Process("/bin/rm", {
              args: ["-rf", destPath]
            });
            rm.start();
          }
        } catch (cleanupErr) {
          // Ignore cleanup errors
        }
      }
    }),

    nova.commands.register("modusop.dock.pull", async (workspace) => {
      const selection = localTreeView.selection[0];
      if (!selection || !selection.localPath) return;

      try {
        await Git.pull(selection.localPath);
        const status = await Git.getStatus(selection.localPath, false);
        store.updateRepoStatus(selection.name, status);
        nova.workspace.showInformativeMessage(`Pulled ${selection.name} successfully.`);
      } catch (e) {
        nova.workspace.showErrorMessage(`Pull failed: ${e.message}`);
      }
    }),

    nova.commands.register("modusop.dock.push", async (workspace) => {
      const selection = localTreeView.selection[0];
      if (!selection || !selection.localPath) return;

      try {
        await Git.push(selection.localPath);
        const status = await Git.getStatus(selection.localPath, false);
        store.updateRepoStatus(selection.name, status);
        nova.workspace.showInformativeMessage(`Pushed ${selection.name} successfully.`);
      } catch (e) {
        nova.workspace.showErrorMessage(`Push failed: ${e.message}`);
      }
    }),

    nova.commands.register("modusop.dock.openInGitHub", (workspace) => {
      const selection = getSelection("any");
      if (!selection || !selection.htmlUrl) return;
      nova.openURL(selection.htmlUrl);
    }),

    nova.commands.register("modusop.dock.filterGitHub", (workspace) => {
      nova.workspace.showInputPanel(
        "Search GitHub repos:",
        { prompt: "Filter", placeholder: "repo name..." },
        (value) => {
          githubProvider.setFilter(value || "");
          githubTreeView.reload();
        }
      );
    }),

    nova.commands.register("modusop.dock.newFolder", (workspace) => {
      nova.workspace.showInputPanel(
        "Folder name:",
        { prompt: "Create", placeholder: "e.g. Clients" },
        (value) => {
          if (value && value.trim()) {
            store.createFolder(value.trim());
            localTreeView.reload();
          }
        }
      );
    }),

    nova.commands.register("modusop.dock.renameFolder", (workspace) => {
      const selection = localTreeView.selection[0];
      if (!selection || !selection._isFolder) return;

      nova.workspace.showInputPanel(
        "Rename folder:",
        { prompt: "Rename", value: selection.name },
        (value) => {
          if (value && value.trim() && value.trim() !== selection.name) {
            store.renameFolder(selection.name, value.trim());
            localTreeView.reload();
          }
        }
      );
    }),

    nova.commands.register("modusop.dock.deleteFolder", (workspace) => {
      const selection = localTreeView.selection[0];
      if (!selection || !selection._isFolder) return;

      nova.workspace.showActionPanel(
        `Delete folder "${selection.name}"? Repos will be ungrouped, not deleted.`,
        { buttons: ["Delete", "Cancel"] },
        (index) => {
          if (index === 0) {
            store.deleteFolder(selection.name);
            localTreeView.reload();
          }
        }
      );
    }),

    nova.commands.register("modusop.dock.moveToFolder", (workspace) => {
      // Support multi-select
      const selections = (localTreeView.selection || []).filter(s => s.isLocal);
      if (selections.length === 0) return;

      const names = selections.map(s => s.name);
      const label = selections.length === 1 ? `"${names[0]}"` : `${selections.length} repos`;

      const folders = store.folders;
      const folderNames = Object.keys(folders).sort();
      const choices = ["Ungrouped (no folder)", ...folderNames, "New Folder..."];

      nova.workspace.showChoicePalette(choices, {
        placeholder: `Move ${label} to folder...`
      }, (choice) => {
        if (!choice) return;

        if (choice === "New Folder...") {
          nova.workspace.showInputPanel(
            "New folder name:",
            { prompt: "Create & Move" },
            (value) => {
              if (value && value.trim()) {
                store.createFolder(value.trim());
                for (const name of names) {
                  store.moveRepoToFolder(name, value.trim());
                }
                localTreeView.reload();
              }
            }
          );
        } else if (choice === "Ungrouped (no folder)") {
          for (const name of names) {
            store.moveRepoToFolder(name, null);
          }
          localTreeView.reload();
        } else {
          for (const name of names) {
            store.moveRepoToFolder(name, choice);
          }
          localTreeView.reload();
        }
      });
    }),

    nova.commands.register("modusop.dock.syncSettings", async (workspace) => {
      try {
        nova.workspace.showInformativeMessage("Syncing Nova settings...");
        await settingsSync.sync();
        settingsTreeView.reload();
        nova.workspace.showInformativeMessage("Nova settings synced successfully!");
      } catch (e) {
        console.error("ModusOp Dock: Settings sync failed:", e.message);
        nova.workspace.showErrorMessage(`Settings sync failed: ${e.message}`);
      }
    }),

    nova.commands.register("modusop.dock.restoreSettings", async (workspace) => {
      nova.workspace.showActionPanel(
        "Restore Nova settings from backup?",
        { buttons: ["Restore", "Cancel"] },
        async (index) => {
          if (index !== 0) return;

          try {
            nova.workspace.showInformativeMessage("Restoring Nova settings...");
            const count = await settingsSync.restore();
            settingsTreeView.reload();
            nova.workspace.showInformativeMessage(
              `Restored ${count} setting${count !== 1 ? "s" : ""}. Restart Nova to apply.`
            );
          } catch (e) {
            console.error("ModusOp Dock: Settings restore failed:", e.message);
            nova.workspace.showErrorMessage(`Restore failed: ${e.message}`);
          }
        }
      );
    })
  );
}

async function loadAllData() {
  if (refreshing) return;
  refreshing = true;

  try {
    // Fetch GitHub repos (or use cache)
    let githubRepos = [];
    const token = GitHub.getToken();
    const username = store.githubUsername;

    console.log("ModusOp Dock: token present:", !!token, "username:", username);

    if (token && username) {
      try {
        githubRepos = await GitHub.fetchAllRepos(token, username);
        console.log("ModusOp Dock: fetched", githubRepos.length, "repos from GitHub");
        store.cachedRepos = githubRepos;
      } catch (e) {
        console.error("ModusOp Dock: GitHub fetch failed:", e.message);
        githubRepos = store.cachedRepos;

        if (e.message.includes("token is invalid")) {
          nova.workspace.showWarningMessage(e.message);
        }
      }
    } else {
      console.log("ModusOp Dock: no token or username, using cache");
      githubRepos = store.cachedRepos;
    }

    // Scan local directory for repos
    const rootPath = store.localReposRoot;
    let localRepos = [];

    if (rootPath && nova.fs.stat(rootPath)) {
      localRepos = Git.scanForRepos(rootPath);

      // Get remote URLs for cross-referencing
      for (const repo of localRepos) {
        repo.remoteUrl = await Git.getRemoteUrl(repo.localPath);
      }
    }

    // Merge lists
    console.log("ModusOp Dock: merging", githubRepos.length, "GitHub repos with", localRepos.length, "local repos");
    const merged = mergeRepoLists(githubRepos, localRepos);
    console.log("ModusOp Dock: merged total:", merged.length, "local:", merged.filter(r => r.isLocal).length);
    store.repos = merged;

    // Get git status for all local repos, then reload once
    const doFetch = store.autoFetch;
    const localMerged = merged.filter(r => r.isLocal);
    const statusPromises = localMerged.map(repo =>
      Git.getStatus(repo.localPath, doFetch)
        .then(status => {
          console.log("ModusOp Dock: Status for", repo.name, ":", status.status, "ahead:", status.ahead, "behind:", status.behind);
          return { name: repo.name, status };
        })
        .catch(e => {
          console.warn("ModusOp Dock: Status failed for", repo.name, e.message);
          return null;
        })
    );

    Promise.all(statusPromises).then(results => {
      let changed = false;
      for (const result of results) {
        if (!result) continue;
        const repo = store.repos.find(r => r.name === result.name);
        if (repo) {
          repo.ahead = result.status.ahead;
          repo.behind = result.status.behind;
          repo.dirty = result.status.dirty;
          repo.status = result.status.status;
          changed = true;
        }
      }
      if (changed) {
        console.log("ModusOp Dock: All statuses updated, reloading");
        store._notifyChange();
      }
    });
  } catch (e) {
    console.error("ModusOp Dock: loadAllData error:", e.message);
  } finally {
    refreshing = false;
  }
}

async function loadGitHubRepos() {
  const token = GitHub.getToken();
  const username = store.githubUsername;

  if (!token || !username) {
    nova.workspace.showWarningMessage(
      "Configure your GitHub username in preferences and set a token via Extensions → ModusOp Dock → Set GitHub Token."
    );
    return;
  }

  try {
    const githubRepos = await GitHub.fetchAllRepos(token, username);
    store.cachedRepos = githubRepos;
    await loadAllData();
  } catch (e) {
    nova.workspace.showErrorMessage(`GitHub refresh failed: ${e.message}`);
  }
}

function mergeRepoLists(githubRepos, localRepos) {
  const merged = [];
  const matched = new Set();

  // Build a lookup from normalized remote URLs to local repos
  const localByUrl = new Map();
  const localByName = new Map();

  for (const local of localRepos) {
    if (local.remoteUrl) {
      const normalized = Git.normalizeRemoteUrl(local.remoteUrl);
      localByUrl.set(normalized, local);
    }
    localByName.set(local.name.toLowerCase(), local);
  }

  // Process GitHub repos — try to match each with a local clone
  for (const gh of githubRepos) {
    const ghUrlNorm = Git.normalizeRemoteUrl(gh.cloneUrl);
    let local = localByUrl.get(ghUrlNorm);

    // Fallback: match by name
    if (!local) {
      local = localByName.get(gh.name.toLowerCase());
    }

    if (local) {
      matched.add(local.name);
      merged.push({
        name: gh.name,
        fullName: gh.fullName,
        cloneUrl: gh.cloneUrl,
        htmlUrl: gh.htmlUrl,
        isPrivate: gh.isPrivate,
        defaultBranch: gh.defaultBranch,
        localPath: local.localPath,
        isLocal: true,
        ahead: 0,
        behind: 0,
        status: "unknown"
      });
    } else {
      merged.push({
        name: gh.name,
        fullName: gh.fullName,
        cloneUrl: gh.cloneUrl,
        htmlUrl: gh.htmlUrl,
        isPrivate: gh.isPrivate,
        defaultBranch: gh.defaultBranch,
        localPath: null,
        isLocal: false,
        ahead: 0,
        behind: 0,
        status: "unknown"
      });
    }
  }

  // Add local-only repos that didn't match any GitHub repo
  for (const local of localRepos) {
    if (!matched.has(local.name)) {
      merged.push({
        name: local.name,
        fullName: local.name,
        cloneUrl: null,
        htmlUrl: null,
        isPrivate: false,
        defaultBranch: null,
        localPath: local.localPath,
        isLocal: true,
        ahead: 0,
        behind: 0,
        status: "unknown"
      });
    }
  }

  return merged;
}
