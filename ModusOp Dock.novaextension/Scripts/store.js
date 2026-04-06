class Store {
  constructor() {
    this._repos = [];
    this._listeners = [];
  }

  get githubUsername() {
    return nova.config.get("modusop.dock.githubUsername") || "";
  }

  get localReposRoot() {
    let root = nova.config.get("modusop.dock.localReposRoot") || "";
    if (root.startsWith("~")) {
      const home = nova.path.expanduser("~");
      root = home + root.substring(1);
    }
    return root;
  }

  get autoFetch() {
    return nova.config.get("modusop.dock.autoFetch") || false;
  }

  get repos() {
    return this._repos;
  }

  set repos(list) {
    this._repos = list;
    this._notifyChange();
  }

  get cachedRepos() {
    const json = nova.config.get("modusop.dock.cachedRepos");
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch (e) {
      return [];
    }
  }

  set cachedRepos(repos) {
    nova.config.set("modusop.dock.cachedRepos", JSON.stringify(repos));
    nova.config.set("modusop.dock.cacheTimestamp", Date.now());
  }

  get cacheTimestamp() {
    return nova.config.get("modusop.dock.cacheTimestamp") || 0;
  }

  updateRepoStatus(name, statusData) {
    const repo = this._repos.find(r => r.name === name);
    if (repo) {
      repo.ahead = statusData.ahead;
      repo.behind = statusData.behind;
      repo.dirty = statusData.dirty;
      repo.status = statusData.status;
      this._notifyChange();
    }
  }

  // Folder management — stored as JSON in nova.config
  get folders() {
    const json = nova.config.get("modusop.dock.folders");
    if (!json) return {};
    try {
      return JSON.parse(json);
    } catch (e) {
      return {};
    }
  }

  _saveFolders(folders) {
    nova.config.set("modusop.dock.folders", JSON.stringify(folders));
    this._notifyChange();
  }

  createFolder(name) {
    const folders = this.folders;
    if (!folders[name]) {
      folders[name] = [];
      this._saveFolders(folders);
    }
  }

  renameFolder(oldName, newName) {
    const folders = this.folders;
    if (folders[oldName] && !folders[newName]) {
      folders[newName] = folders[oldName];
      delete folders[oldName];
      this._saveFolders(folders);
    }
  }

  deleteFolder(name) {
    const folders = this.folders;
    if (folders[name]) {
      delete folders[name];
      this._saveFolders(folders);
    }
  }

  moveRepoToFolder(repoName, folderName) {
    const folders = this.folders;
    // Remove from all folders first
    for (const key of Object.keys(folders)) {
      folders[key] = folders[key].filter(r => r !== repoName);
    }
    // Add to target folder (null = ungrouped)
    if (folderName && folders[folderName]) {
      folders[folderName].push(repoName);
    }
    this._saveFolders(folders);
  }

  getFolderForRepo(repoName) {
    const folders = this.folders;
    for (const [folderName, repos] of Object.entries(folders)) {
      if (repos.includes(repoName)) return folderName;
    }
    return null;
  }

  setRepoLocalPath(name, localPath) {
    const repo = this._repos.find(r => r.name === name);
    if (repo) {
      repo.localPath = localPath;
      repo.isLocal = true;
      this._notifyChange();
    }
  }

  onDidChange(callback) {
    this._listeners.push(callback);
    return {
      dispose: () => {
        const idx = this._listeners.indexOf(callback);
        if (idx >= 0) this._listeners.splice(idx, 1);
      }
    };
  }

  _notifyChange() {
    for (const listener of this._listeners) {
      try {
        listener();
      } catch (e) {
        console.error("ModusOp Dock: Store listener error:", e.message);
      }
    }
  }
}

module.exports = Store;
