/* BASE Creator Dashboard — V1 Publisher
   - Reads Fan App/content.json (public URL)
   - Publishes updates by committing Fan App/content.json via GitHub API (authority gate = token)
   - Static hosting limit respected (no backend)
*/
(() => {
  // ===== CONFIG (locked to your repo) =====
  const OWNER = "soliddreamz";
  const REPO = "Base-Creator-Land";
  const BRANCH = "main";
  const TARGET_PATH = "Fan App/content.json"; // exact repo path (space matters)
  const DEFAULT_CONTENT_URL = `https://${OWNER}.github.io/${REPO}/Fan%20App/content.json`;

  // ===== DOM =====
  const $ = (id) => document.getElementById(id);

  const el = {
    repoLabel: $("repoLabel"),
    token: $("token"),
    contentUrl: $("contentUrl"),
    btnLoad: $("btnLoad"),
    btnPublish: $("btnPublish"),
    btnResetToken: $("btnResetToken"),

    name: $("name"),
    bio: $("bio"),
    isLive: $("isLive"),
    liveUrl: $("liveUrl"),
    links: $("links"),

    preview: $("preview"),
    status: $("status"),
    lastSha: $("lastSha"),
    statePill: $("statePill"),
  };

  // ===== STATE =====
  const LS_TOKEN = "base_creator_token_v1";
  let lastRemoteSha = null;

  // ===== HELPERS =====
  function log(line) {
    const stamp = new Date().toLocaleString();
    el.status.textContent = `[${stamp}] ${line}\n` + el.status.textContent;
  }

  function setPill(type, text) {
    el.statePill.className = `pill ${type}`;
    el.statePill.textContent = text;
  }

  function safeJsonParse(s) {
    try { return { ok: true, value: JSON.parse(s) }; }
    catch (e) { return { ok: false, error: e }; }
  }

  function buildDraft() {
    const draft = {
      name: (el.name.value || "").trim(),
      bio: (el.bio.value || "").trim(),
      isLive: el.isLive.value === "true",
      liveUrl: (el.liveUrl.value || "").trim(),
    };

    // links must be a JSON array
    const linksRaw = (el.links.value || "").trim();
    if (linksRaw) {
      const parsed = safeJsonParse(linksRaw);
      if (!parsed.ok || !Array.isArray(parsed.value)) {
        throw new Error("links must be valid JSON ARRAY (or empty).");
      }
      draft.links = parsed.value;
    } else {
      draft.links = [];
    }

    // Clean empties
    if (!draft.name) delete draft.name;
    if (!draft.bio) delete draft.bio;
    if (!draft.liveUrl) delete draft.liveUrl;

    return draft;
  }

  function refreshPreview() {
    try {
      const draft = buildDraft();
      el.preview.value = JSON.stringify(draft, null, 2);
      setPill(draft.isLive ? "ok" : "warn", draft.isLive ? "STATUS: LIVE = true" : "STATUS: LIVE = false");
      return true;
    } catch (e) {
      el.preview.value = `// Preview error: ${e.message}`;
      setPill("bad", "STATUS: invalid input");
      return false;
    }
  }

  function requireToken() {
    const token = (el.token.value || "").trim();
    if (!token) throw new Error("Missing creator token. (Authority gate)");
    return token;
  }

  function ghHeaders(token) {
    return {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  function toBase64Utf8(str) {
    const utf8 = new TextEncoder().encode(str);
    let bin = "";
    utf8.forEach((b) => bin += String.fromCharCode(b));
    return btoa(bin);
  }

  async function fetchPublicJson(url) {
    const u = new URL(url);
    u.searchParams.set("ts", String(Date.now()));
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load content.json (${res.status})`);
    return await res.json();
  }

  async function ghGetFileSha(token) {
    // NOTE: encodeURIComponent does NOT encode "/". This is OK because the API path expects slashes.
    const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(TARGET_PATH)}?ref=${encodeURIComponent(BRANCH)}`;
    const res = await fetch(api, { headers: ghHeaders(token) });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GitHub GET contents failed (${res.status}). ${txt.slice(0, 180)}`);
    }
    const data = await res.json();
    if (!data?.sha) throw new Error("GitHub response missing sha.");
    return data.sha;
  }

  async function ghPutJson(token, sha, jsonText) {
    const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(TARGET_PATH)}`;
    const body = {
      message: `BASE V1: publish content.json via Creator Dashboard`,
      content: toBase64Utf8(jsonText),
      sha,
      branch: BRANCH,
    };

    const res = await fetch(api, {
      method: "PUT",
      headers: ghHeaders(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GitHub PUT failed (${res.status}). ${txt.slice(0, 220)}`);
    }

    const data = await res.json();
    return data?.content?.sha || data?.commit?.sha || null;
  }

  function fillForm(obj) {
    el.name.value = obj?.name || "";
    el.bio.value = obj?.bio || "";
    el.isLive.value = (obj?.isLive === true) ? "true" : "false";
    el.liveUrl.value = obj?.liveUrl || "";

    if (Array.isArray(obj?.links)) el.links.value = JSON.stringify(obj.links, null, 2);
    else el.links.value = "[]";

    refreshPreview();
  }

  function enablePublishIfReady() {
    const hasToken = (el.token.value || "").trim().length > 0;
    const previewOk = refreshPreview();
    el.btnPublish.disabled = !(hasToken && previewOk && lastRemoteSha);
  }

  // ===== EVENTS =====
  el.token.addEventListener("input", () => {
    const t = (el.token.value || "").trim();
    if (t) localStorage.setItem(LS_TOKEN, t);
    enablePublishIfReady();
  });

  ["input", "change"].forEach((evt) => {
    el.name.addEventListener(evt, enablePublishIfReady);
    el.bio.addEventListener(evt, enablePublishIfReady);
    el.isLive.addEventListener(evt, enablePublishIfReady);
    el.liveUrl.addEventListener(evt, enablePublishIfReady);
    el.links.addEventListener(evt, enablePublishIfReady);
    el.contentUrl.addEventListener(evt, () => {});
  });

  el.btnResetToken.addEventListener("click", () => {
    localStorage.removeItem(LS_TOKEN);
    el.token.value = "";
    lastRemoteSha = null;
    el.lastSha.textContent = "sha: —";
    log("Token cleared (local device). Publish disabled.");
    enablePublishIfReady();
  });

  el.btnLoad.addEventListener("click", async () => {
    try {
      setPill("warn", "STATUS: loading…");
      log("Loading current Fan App/content.json (public)…");

      const url = (el.contentUrl.value || DEFAULT_CONTENT_URL).trim();
      const current = await fetchPublicJson(url);

      log("Loaded public content.json.");
      fillForm(current);

      const token = (el.token.value || "").trim() || localStorage.getItem(LS_TOKEN) || "";
      if (token) {
        log("Fetching GitHub file sha (authority path)…");
        const sha = await ghGetFileSha(token);
        lastRemoteSha = sha;
        el.lastSha.textContent = `sha: ${lastRemoteSha}`;
        log(`GitHub sha loaded: ${lastRemoteSha}`);
      } else {
        lastRemoteSha = null;
        el.lastSha.textContent = "sha: —";
        log("No token present. Sha not loaded. Publish remains disabled.");
      }

      enablePublishIfReady();
      setPill("warn", "STATUS: loaded (not published)");
      log("Ready.");
    } catch (e) {
      setPill("bad", "STATUS: load failed");
      log(`ERROR: ${e.message}`);
      enablePublishIfReady();
    }
  });

  el.btnPublish.addEventListener("click", async () => {
    try {
      const token = requireToken();

      log("Re-checking GitHub sha…");
      const sha = await ghGetFileSha(token);
      lastRemoteSha = sha;
      el.lastSha.textContent = `sha: ${lastRemoteSha}`;

      const draft = buildDraft();
      const jsonText = JSON.stringify(draft, null, 2);

      log("Publishing (committing) to repo…");
      const newSha = await ghPutJson(token, lastRemoteSha, jsonText);

      if (newSha) {
        lastRemoteSha = newSha;
        el.lastSha.textContent = `sha: ${lastRemoteSha}`;
      }

      setPill(draft.isLive ? "ok" : "warn", draft.isLive ? "STATUS: LIVE published" : "STATUS: not-live published");
      log("Publish success.");
      enablePublishIfReady();
    } catch (e) {
      setPill("bad", "STATUS: publish failed");
      log(`ERROR: ${e.message}`);
      enablePublishIfReady();
    }
  });

  // ===== INIT =====
  function init() {
    el.repoLabel.textContent = `${OWNER}/${REPO}@${BRANCH}`;
    el.contentUrl.value = DEFAULT_CONTENT_URL;

    const saved = localStorage.getItem(LS_TOKEN);
    if (saved) el.token.value = saved;

    // Default form state
    el.links.value = "[]";
    refreshPreview();
    setPill("warn", "STATUS: not loaded");
    log("Open Dashboard → paste token → Load Current State → Publish.");
    enablePublishIfReady();
  }

  init();
})();
