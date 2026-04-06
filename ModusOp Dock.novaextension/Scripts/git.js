function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const process = new Process("/usr/bin/git", {
      args: args,
      cwd: cwd
    });

    process.onStdout((line) => { stdout += line; });
    process.onStderr((line) => { stderr += line; });

    process.onDidExit((exitCode) => {
      if (exitCode === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `git exited with code ${exitCode}`));
      }
    });

    process.start();
  });
}

function scanForRepos(rootPath) {
  const repos = [];
  const items = nova.fs.listdir(rootPath);

  if (!items) return repos;

  for (const name of items) {
    if (name.startsWith(".")) continue;

    const fullPath = nova.path.join(rootPath, name);
    const gitPath = nova.path.join(fullPath, ".git");
    const stat = nova.fs.stat(fullPath);

    if (stat && stat.isDirectory()) {
      const gitStat = nova.fs.stat(gitPath);
      if (gitStat) {
        repos.push({ name: name, localPath: fullPath });
      }
    }
  }

  return repos;
}

async function getRemoteUrl(repoPath) {
  try {
    const url = await runGit(["config", "--get", "remote.origin.url"], repoPath);
    return url || null;
  } catch (e) {
    return null;
  }
}

function normalizeRemoteUrl(url) {
  if (!url) return "";
  let normalized = url.trim().toLowerCase();
  // Convert SSH to HTTPS format for comparison
  if (normalized.startsWith("git@github.com:")) {
    normalized = "https://github.com/" + normalized.substring(15);
  }
  // Strip .git suffix
  if (normalized.endsWith(".git")) {
    normalized = normalized.substring(0, normalized.length - 4);
  }
  // Strip trailing slash
  if (normalized.endsWith("/")) {
    normalized = normalized.substring(0, normalized.length - 1);
  }
  return normalized;
}

async function getStatus(repoPath, doFetch) {
  try {
    if (doFetch) {
      try {
        await runGit(["fetch", "--all"], repoPath);
      } catch (e) {
        console.warn("ModusOp Dock: fetch failed for", repoPath, e.message);
      }
    }

    // Get current branch name
    let branch;
    try {
      branch = await runGit(["symbolic-ref", "--short", "HEAD"], repoPath);
    } catch (e) {
      // Detached HEAD
      return { ahead: 0, behind: 0, status: "unknown" };
    }

    if (!branch) return { ahead: 0, behind: 0, status: "unknown" };

    // Get the upstream tracking branch
    let upstream;
    try {
      upstream = await runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", branch + "@{upstream}"], repoPath);
    } catch (e) {
      // No upstream configured
      return { ahead: 0, behind: 0, status: "unknown" };
    }

    if (!upstream) return { ahead: 0, behind: 0, status: "unknown" };

    // Get ahead/behind in one command
    let ahead = 0;
    let behind = 0;

    try {
      const counts = await runGit(["rev-list", "--left-right", "--count", branch + "..." + upstream], repoPath);
      const parts = counts.split(/\s+/);
      ahead = parseInt(parts[0], 10) || 0;
      behind = parseInt(parts[1], 10) || 0;
    } catch (e) {
      console.warn("ModusOp Dock: rev-list failed for", repoPath, e.message);
      return { ahead: 0, behind: 0, status: "unknown" };
    }

    // Count uncommitted changes (staged + unstaged + untracked)
    let dirty = 0;
    try {
      const statusOutput = await runGit(["status", "--short"], repoPath);
      if (statusOutput) {
        dirty = statusOutput.split("\n").filter(l => l.trim()).length;
      }
    } catch (e) {
      // Ignore
    }

    let status = "clean";
    if (ahead > 0 && behind > 0) status = "diverged";
    else if (ahead > 0) status = "ahead";
    else if (behind > 0) status = "behind";
    else if (dirty > 0) status = "dirty";

    return { ahead, behind, dirty, status };
  } catch (e) {
    console.warn("ModusOp Dock: getStatus failed for", repoPath, e.message);
    return { ahead: 0, behind: 0, dirty: 0, status: "unknown" };
  }
}

async function cloneRepo(url, destPath) {
  await runGit(["clone", url, destPath], nova.path.dirname(destPath));
}

async function pull(repoPath) {
  await runGit(["pull"], repoPath);
}

async function push(repoPath) {
  await runGit(["push"], repoPath);
}

module.exports = {
  runGit,
  scanForRepos,
  getRemoteUrl,
  normalizeRemoteUrl,
  getStatus,
  cloneRepo,
  pull,
  push
};
