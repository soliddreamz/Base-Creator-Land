// Creator Dashboard V1
// - Reads Fan App/content.json from same repo
// - Writes back to Fan App/content.json by committing via GitHub API
// - No manual JSON. No copy/paste. No shared universal key.
// - Creator token is stored only in localStorage on this device.

const $ = (id) => document.getElementById(id);

const AUTH_KEY = "base_creator_auth_v1";

function nowISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function setStatus(el, text) {
  el.innerHTML = `Status: <strong>${text}</strong>`;
}

function setPills({mode, updated, deploy}) {
  $("pillMode").textContent = `Mode: ${mode ?? "—"}`;
  $("pillUpdated").textContent = `Updated: ${updated ?? "—"}`;
  $("pillDeploy").textContent = `Deploy: ${deploy ?? "—"}`;
}

function getAuth() {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function putAuth(auth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

function currentAuthFromInputs() {
  return {
    owner: $("ghOwner").value.trim(),
    repo: $("ghRepo").value.trim(),
    branch: $("ghBranch").value.trim(),
    path: $("ghPath").value.trim(),
    token: $("ghToken").value.trim(),
  };
}

function hydrateAuthInputs() {
  const a = getAuth();
  if (!a) return;
  $("ghOwner").value = a.owner || $("ghOwner").value;
  $("ghRepo").value = a.repo || $("ghRepo").value;
  $("ghBranch").value = a.branch || $("ghBranch").value;
  $("ghPath").value = a.path || $("ghPath").value;
  // do NOT auto-fill token field for safety; keep token stored but not shown
}

function getToken() {
  // Prefer input if user pasted a new one; else use stored.
  const inputTok = $("ghToken").value.trim();
  if (inputTok) return inputTok;
  const a = getAuth();
  return a?.token || "";
}

function saveAuthFromInputs() {
  const a = currentAuthFromInputs();
  // if token input blank but stored exists, preserve stored token
  const stored = getAuth();
  if (!a.token && stored?.token) a.token = stored.token;
  putAuth(a);
}

function ghHeaders() {
  const token = getToken();
  if (!token) throw new Error("Missing token");
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function baseApiUrl() {
  const a = currentAuthFromInputs();
  return `https://api.github.com/repos/${encodeURIComponent(a.owner)}/${encodeURIComponent(a.repo)}`;
}

async function ghFetch(url, opts = {}) {
  const headers = Object.assign({}, opts.headers || {}, ghHeaders());
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const txt = await res.text().catch(()=> "");
    throw new Error(`GitHub API error ${res.status}: ${txt || res.statusText}`);
  }
  return res.json();
}

async function fetchFileContentJSON() {
  const a = currentAuthFromInputs();
  const api = baseApiUrl();
  const url = `${api}/contents/${encodeURIComponent(a.path)}?ref=${encodeURIComponent(a.branch)}`;
  const data = await ghFetch(url);
  if (!data.content) throw new Error("No content field in GitHub response");
  const decoded = atob(data.content.replace(/\n/g, ""));
  const json = JSON.parse(decoded);
  return { json, sha: data.sha };
}

function buildNextJSON() {
  const isLive = $("liveIsLive").value === "true";
  const obj = {
    name: $("creatorName").value.trim() || "Creator Name",
    bio: $("creatorBio").value.trim() || "",
    mode: $("creatorMode").value,
    updated: nowISODate(),
    live: {
      isLive,
      url: $("liveUrl").value.trim() || ""
    },
    notes: {
      session: $("creatorNotes").value || ""
    }
  };
  // links: keep simple v1 (2 links) but allow empty
  obj.links = [];
  // If you later add UI rows for multiple links, expand here.
  // For now mirror your existing screenshot structure:
  obj.links.push({ label: "Instagram", url: "https://instagram.com/" });
  obj.links.push({ label: "YouTube", url: "https://youtube.com/" });

  return obj;
}

function applyJSONToControls(json) {
  $("creatorName").value = json.name || "";
  $("creatorBio").value = json.bio || "";
  $("creatorMode").value = json.mode || "TEST";
  $("creatorUpdated").value = json.updated || "";
  $("liveIsLive").value = String(!!json?.live?.isLive);
  $("liveUrl").value = json?.live?.url || "";
  $("creatorNotes").value = json?.notes?.session || "";

  setPills({ mode: $("creatorMode").value, updated: json.updated || "—", deploy: "—" });
}

async function testAuth() {
  setStatus($("authStatus"), "Testing…");
  saveAuthFromInputs();

  const a = getAuth() || currentAuthFromInputs();
  if (!getToken()) {
    setStatus($("authStatus"), "Missing token");
    return;
  }

  try {
    const api = baseApiUrl();
    const repo = await ghFetch(api);
    setStatus($("authStatus"), `OK — ${repo.full_name}`);
  } catch (e) {
    setStatus($("authStatus"), `FAIL — ${e.message}`);
  }
}

async function loadCurrent() {
  setStatus($("mirrorStatus"), "Loading…");
  setStatus($("ctlStatus"), "Loading current…");
  try {
    const { json } = await fetchFileContentJSON();
    $("mirror").textContent = JSON.stringify(json, null, 2);
    applyJSONToControls(json);
    setStatus($("mirrorStatus"), "Loaded Fan App/content.json");
    setStatus($("ctlStatus"), "Loaded");
  } catch (e) {
    setStatus($("mirrorStatus"), `FAIL — ${e.message}`);
    setStatus($("ctlStatus"), "Idle");
  }
}

async function preview() {
  const next = buildNextJSON();
  $("mirror").textContent = JSON.stringify(next, null, 2);
  setStatus($("mirrorStatus"), "Preview (not published)");
  setPills({ mode: next.mode, updated: next.updated, deploy: "—" });
}

async function publish() {
  // Commit next JSON to Fan App/content.json
  setStatus($("ctlStatus"), "Publishing… (commit to repo)");
  saveAuthFromInputs();

  try {
    const a = currentAuthFromInputs();
    if (!getToken()) throw new Error("Missing token");
    if (!a.owner || !a.repo || !a.branch || !a.path) throw new Error("Missing repo info");

    const { sha } = await fetchFileContentJSON();
    const next = buildNextJSON();
    const contentB64 = btoa(unescape(encodeURIComponent(JSON.stringify(next, null, 2))));

    const api = baseApiUrl();
    const url = `${api}/contents/${encodeURIComponent(a.path)}`;

    const body = {
      message: `Base Free V1: update content.json (${next.updated})`,
      content: contentB64,
      sha,
      branch: a.branch
    };

    const result = await ghFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    $("mirror").textContent = JSON.stringify(next, null, 2);
    setStatus($("mirrorStatus"), `Published — commit ${result.commit?.sha?.slice(0,7) || "OK"}`);
    setStatus($("ctlStatus"), "Published. Now wait for Pages deploy.");
    setPills({ mode: next.mode, updated: next.updated, deploy: "Deploying…" });

  } catch (e) {
    setStatus($("ctlStatus"), `FAIL — ${e.message}`);
  }
}

async function checkDeploy() {
  setStatus($("deployStatus"), "Checking…");
  try {
    saveAuthFromInputs();
    const api = baseApiUrl();

    // latest commit on branch
    const a = currentAuthFromInputs();
    const commits = await ghFetch(`${api}/commits?sha=${encodeURIComponent(a.branch)}&per_page=1`);
    const sha = commits?.[0]?.sha?.slice(0,7) || "—";

    // pages build status (best effort)
    // Not every repo exposes detailed status; we still show something.
    let deploy = "Unknown";
    try {
      const pages = await ghFetch(`${api}/pages`);
      deploy = pages?.status || "OK";
    } catch {
      deploy = "OK (no status endpoint)";
    }

    setStatus($("deployStatus"), `Latest commit: ${sha} — Pages: ${deploy}`);
    setPills({ mode: $("creatorMode").value, updated: $("creatorUpdated").value || "—", deploy });
  } catch (e) {
    setStatus($("deployStatus"), `FAIL — ${e.message}`);
  }
}

function init() {
  hydrateAuthInputs();

  $("creatorUpdated").value = nowISODate();
  setPills({ mode: "—", updated: "—", deploy: "—" });

  $("btnSaveAuth").addEventListener("click", () => {
    saveAuthFromInputs();
    setStatus($("authStatus"), "Saved locally (changeable)");
  });

  $("btnClearAuth").addEventListener("click", () => {
    clearAuth();
    $("ghToken").value = "";
    setStatus($("authStatus"), "Removed locally");
  });

  $("btnTestAuth").addEventListener("click", testAuth);
  $("btnLoad").addEventListener("click", loadCurrent);
  $("btnPreview").addEventListener("click", preview);
  $("btnPublish").addEventListener("click", publish);
  $("btnCheckDeploy").addEventListener("click", checkDeploy);
}

init();
