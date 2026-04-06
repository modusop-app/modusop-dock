class LocalDataProvider {
  constructor(store, getTokenFn) {
    this._store = store;
    this._getToken = getTokenFn;
  }

  getChildren(element) {
    // Root level
    if (!element) {
      const items = [];

      // GitHub connection status
      const hasToken = !!this._getToken();
      const username = this._store.githubUsername;
      items.push({
        _isStatus: true,
        connected: hasToken && !!username,
        username: username || "not configured"
      });

      const repos = this._store.repos.filter(r => r.isLocal);
      const folders = this._store.folders;
      const folderNames = Object.keys(folders).sort();

      // Grouped repos — collapsible folders
      for (const folderName of folderNames) {
        const folderRepos = folders[folderName] || [];
        // Only show folder if it has repos that exist locally
        const matchedRepos = folderRepos
          .map(name => repos.find(r => r.name === name))
          .filter(Boolean);

        items.push({
          _isFolder: true,
          name: folderName,
          repoCount: matchedRepos.length
        });
      }

      // Ungrouped repos
      const allGrouped = new Set();
      for (const repoList of Object.values(folders)) {
        for (const name of repoList) allGrouped.add(name);
      }

      const ungrouped = repos.filter(r => !allGrouped.has(r.name));
      ungrouped.sort((a, b) => a.name.localeCompare(b.name));

      return items.concat(ungrouped);
    }

    // Folder children
    if (element._isFolder) {
      const folders = this._store.folders;
      const folderRepos = folders[element.name] || [];
      const repos = this._store.repos.filter(r => r.isLocal);

      return folderRepos
        .map(name => repos.find(r => r.name === name))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    return [];
  }

  getTreeItem(element) {
    // Status indicator row
    if (element._isStatus) {
      const label = element.connected
        ? `GitHub: ${element.username}`
        : "GitHub: not connected";
      const item = new TreeItem(label, TreeItemCollapsibleState.None);
      item.identifier = "_github_status";
      item.descriptiveText = element.connected ? "\u2705" : "\u26A0\uFE0F Set token \u2192";
      item.command = element.connected ? null : "modusop.dock.setToken";
      item.tooltip = element.connected
        ? "Connected to GitHub"
        : "Click to configure your GitHub token";
      return item;
    }

    // Folder row
    if (element._isFolder) {
      const item = new TreeItem(element.name, TreeItemCollapsibleState.Expanded);
      item.identifier = `folder:${element.name}`;
      item.image = "__builtin.path";
      item.contextValue = "folder";
      item.descriptiveText = `${element.repoCount}`;
      item.tooltip = `${element.repoCount} repos`;
      return item;
    }

    // Repo row
    const item = new TreeItem(element.name, TreeItemCollapsibleState.None);
    item.identifier = element.name;

    if (element.isLocal) {
      item.contextValue = "local";

      // Status-colored icon
      if (element.status === "diverged") item.image = "repo-diverged";
      else if (element.status === "ahead") item.image = "repo-ahead";
      else if (element.status === "behind") item.image = "repo-behind";
      else if (element.dirty > 0) item.image = "repo-dirty";
      else if (element.status === "clean") item.image = "repo-clean";
      else item.image = "repo-unknown";

      // Text badges for counts
      let parts = [];
      if (element.ahead > 0) parts.push(`\u25B2${element.ahead}`);
      if (element.behind > 0) parts.push(`\u25BC${element.behind}`);
      if (element.dirty > 0) parts.push(`\u2731${element.dirty}`);

      if (parts.length > 0) {
        item.descriptiveText = parts.join("  ");
      }

      item.command = "modusop.dock.openRepo";

      let tipParts = [element.localPath || element.name];
      if (element.ahead > 0) tipParts.push(`\u25B2 ${element.ahead} to push`);
      if (element.behind > 0) tipParts.push(`\u25BC ${element.behind} to pull`);
      if (element.dirty > 0) tipParts.push(`\u2731 ${element.dirty} uncommitted`);
      item.tooltip = tipParts.join("\n");
    } else {
      item.contextValue = "remote";
      item.command = "modusop.dock.cloneRepo";
      item.tooltip = "Not cloned locally";
    }

    return item;
  }
}

class GitHubDataProvider {
  constructor(store) {
    this._store = store;
    this._filter = "";
  }

  setFilter(text) {
    this._filter = (text || "").toLowerCase();
  }

  getChildren(element) {
    if (element) return [];

    let repos = this._store.repos.filter(r => !r.isLocal);

    if (this._filter) {
      repos = repos.filter(r => r.name.toLowerCase().includes(this._filter));
    }

    repos.sort((a, b) => a.name.localeCompare(b.name));
    return repos;
  }

  getTreeItem(element) {
    const item = new TreeItem(element.name, TreeItemCollapsibleState.None);
    item.identifier = `gh-${element.name}`;
    item.image = "repo-remote";
    item.contextValue = "github";
    item.command = "modusop.dock.cloneRepo";
    item.tooltip = element.fullName || element.name;
    return item;
  }
}

module.exports = { LocalDataProvider, GitHubDataProvider };
