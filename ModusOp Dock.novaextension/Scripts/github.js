const GITHUB_API = "https://api.github.com";

function getToken() {
  try {
    return nova.credentials.getPassword("modusop.dock", "github-token");
  } catch (e) {
    return null;
  }
}

function setToken() {
  return new Promise((resolve) => {
    nova.workspace.showInputPanel(
      "Enter your GitHub Personal Access Token:",
      { prompt: "Save", placeholder: "ghp_..." },
      (value) => {
        if (value && value.trim()) {
          try {
            nova.credentials.setPassword("modusop.dock", "github-token", value.trim());
            resolve(value.trim());
          } catch (e) {
            nova.workspace.showErrorMessage("Failed to save token: " + e.message);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      }
    );
  });
}

async function fetchAllRepos(token, username) {
  if (!token || !username) return [];

  const headers = {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "ModusOp-Dock-Nova"
  };

  console.log("ModusOp Dock: Fetching repos for", username);

  // Try org endpoint first
  let repos = await _fetchPaginated(
    `${GITHUB_API}/orgs/${username}/repos`,
    headers
  );

  if (repos === null) {
    // Not an org — use authenticated /user/repos endpoint (includes private repos)
    console.log("ModusOp Dock: Not an org, using authenticated user endpoint");
    repos = await _fetchPaginated(
      `${GITHUB_API}/user/repos?affiliation=owner`,
      headers
    );
  }

  if (!repos) return [];

  console.log("ModusOp Dock: Got", repos.length, "repos from GitHub API");

  return repos.map(r => ({
    name: r.name,
    fullName: r.full_name,
    cloneUrl: r.clone_url,
    htmlUrl: r.html_url,
    isPrivate: r.private,
    defaultBranch: r.default_branch
  }));
}

async function _fetchPaginated(baseUrl, headers) {
  let page = 1;
  let allResults = [];

  while (true) {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${sep}per_page=100&page=${page}`;

    console.log("ModusOp Dock: Fetching", url);

    let response;
    try {
      response = await fetch(url, { headers });
    } catch (e) {
      console.error("ModusOp Dock: Network error:", e.message);
      throw new Error(`Network error: ${e.message}`);
    }

    console.log("ModusOp Dock: Response status:", response.status);

    if (response.status === 404 && page === 1) {
      return null; // Signal to try different endpoint
    }

    if (response.status === 401) {
      throw new Error("GitHub token is invalid. Update it via Extensions → ModusOp Dock → Set GitHub Token.");
    }

    if (response.status === 403) {
      const resetHeader = response.headers.get("X-RateLimit-Reset");
      if (resetHeader) {
        const resetTime = new Date(parseInt(resetHeader, 10) * 1000);
        throw new Error(`GitHub rate limit reached. Try again after ${resetTime.toLocaleTimeString()}.`);
      }
      throw new Error("GitHub API forbidden. Check your token permissions.");
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) break;

    allResults = allResults.concat(data);
    page++;
  }

  return allResults;
}

module.exports = {
  getToken,
  setToken,
  fetchAllRepos
};
