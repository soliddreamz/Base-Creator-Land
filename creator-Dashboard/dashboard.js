/* BASE Creator Dashboard — V1
   - Reads Fan App/content.json (public URL)
   - Publishes updates by committing Fan App/content.json via GitHub API (authority gate = token)
   - No backend. GitHub Pages limit respected.
*/
(() => {
  // ===== CONFIG (locked to your repo) =====
  const OWNER = "soliddreamz";
  const REPO = "Base-Creator-Land";
  const BRANCH = "main";
  const TARGET_PATH = "Fan App/content.json"; // exact repo path (space matters)

  // Fan App content.json public URL (for reading)
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
    isLive: $("isLive"),
    liveTitle: $("liveTitle"),
    streamUrl: $("streamUrl"),
    announcement: $("announcement"),
    theme: $("theme"),
    archive: $("archive"),
    preview: $("preview"),
    status: $("status"),
    lastSha: $("lastSha"),
    livePill: $("livePill"),
  };

  // ===== STATE =====
  const LS_TOKEN = "base_creator_token_v1";
  let lastRemoteSha = null;
  let lastLoadedJson = null;

  // ===== HELPERS =====
  function log(line) {
    const stamp = new Date().toLocaleString();
    el.status.textContent = `[${stamp}] ${line}\n` + el.status.textContent;
  }

  function setPill(type, text) {
    el.livePill.className = `pill ${type}`;
    el.livePill.textContent = text;
  }

  function safeJsonParse(s) {
    try { return { ok: true, value: JSON.parse(s) }; }
    catch (e) { return { ok: false, error: e }; }
  }

  function buildDraft() {
    // Controlled shape. (No raw file editing.)
    const draft = {
      isLive: el.isLive.value === "true",
      liveTitle: (el.liveTitle.value || "").trim(),
      streamUrl: (el.streamUrl.value || "").trim(),
      announcement: (el.announcement.value || "").trim(),
      theme: (el.theme.value || "").trim(),
    };

    // Optional archive array from textarea (must be valid JSON array or empty)
    const archRaw = (el.archive.value || "").trim();
    if (archRaw) {
      const parsed = safeJsonParse(archRaw);
      if (!parsed.ok || !Array.isArray(parsed.value)) {
        throw new Error("archive must be valid JSON ARRAY (or empty).");
      }
      draft.archive = parsed.value;
    } else {
      // keep absent (clean)
    }

    // Remove empty strings for cleanliness
    Object.keys(draft).forEach((k) => {
      if (typeof draft[k] === "string" && draft[k] === "") delete draft[k];
    });

    return draft;
  }

  function refreshPreview() {
    try {
      const draft = buildDraft();
      el.preview.value = JSON.stringify(draft, null, 2);
      if (draft.isLive) setPill("ok", "STATUS: LIVE = true");
      else setPill("warn", "STATUS: LIVE = false");
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
    // Fine-grained PAT works with "Bearer"
    return {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  function toBase64Utf8(str) {
    // Proper UTF-8 base64
    const utf8 = new TextEncoder().encode(str);
    let bin = "";
    utf8.forEach((b) => bin += String.fromCharCode(b));
    return btoa(bin);
  }

  async function fetchPublicContentJson(url) {
    // cache-bust + no-store
    const u = new URL(url);
    u.searchParams.set("ts", String(Date.now()));
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load content.json (${res.status})`);
    return await res.json();
  }

  async function ghGetFileMeta(token) {
    const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(TARGET_PATH)}?ref=${encodeURIComponent(BRANCH)}`;
    const res = await fetch(api, { headers: ghHeaders(token) });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GitHub GET contents failed (${res.status}). ${txt.slice(0, 180)}`);
    }
    const data = await res.json();
    if (!data || !data.sha) throw new Error("GitHub response missing sha.");
    return { sha: data.sha, api };
  }

  async function ghPutContentJson(token, sha, jsonText) {
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
    const newSha = data?.content?.sha || data?.commit?.sha || null;
    return { newSha, data };
  }

  function fillFromJson(obj) {
    // Tolerant read (if older file has extra keys, we ignore)
    el.isLive.value = (obj?.isLive === true) ? "true" : "false";
    el.liveTitle.value = obj?.liveTitle || "";
    el.streamUrl.value = obj?.streamUrl || "";
    el.announcement.value = obj?.announcement || "";
    el.theme.value = obj?.theme || "";

    if (Array.isArray(obj?.archive)) el.archive.value = JSON.stringify(obj.archive, null, 2);
    else el.archive.value = "";

    lastLoadedJson = obj;
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

  ["change", "input"].forEach((evt) => {
    el.isLive.addEventListener(evt, enablePublishIfReady);
    el.liveTitle.addEventListener(evt, enablePublishIfReady);
    el.streamUrl.addEventListener(evt, enablePublishIfReady);
    el.announcement.addEventListener(evt, enablePublishIfReady);
    el.theme.addEventListener(evt, enablePublishIfReady);
    el.archive.addEventListener(evt, enablePublishIfReady);
  });

  el.btnResetToken.addEventListener("click", () => {
    localStorage.removeItem(LS_TOKEN);
    el.token.value = "";
    log("Token cleared (local device). Publish disabled.");
    enablePublishIfReady();
  });

  el.btnLoad.addEventListener("click", async () => {
    try {
      setPill("warn", "STATUS: loading…");
      log("Loading current Fan App/content.json (public)…");

      const url = (el.contentUrl.value || DEFAULT_CONTENT_URL).trim();
      const current = await fetchPublicContentJson(url);

      log("Loaded public content.json.");
      fillFromJson(current);

      // If token exists, also fetch sha so publish is possible
      const token = (el.token.value || "").trim() || localStorage.getItem(LS_TOKEN) || "";
      if (token) {
        log("Fetching GitHub file sha (authority path)…");
        const meta = await ghGetFileMeta(token);
        lastRemoteSha = meta.sha;
        el.lastSha.textContent = `sha: ${lastRemoteSha}`;
        log(`GitHub sha loaded: ${lastRemoteSha}`);
      } else {
        lastRemoteSha = null;
        el.lastSha.textContent = "sha: —";
        log("No token present. Sha not loaded. Publish remains disabled.");
      }

      enablePublishIfReady();
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

      // Always re-fetch sha right before publishing (avoid conflicts)
      log("Re-checking GitHub sha…");
      const meta = await ghGetFileMeta(token);
      lastRemoteSha = meta.sha;
      el.lastSha.textContent = `sha: ${lastRemoteSha}`;

      const draft = buildDraft();
      const jsonText = JSON.stringify(draft, null, 2);

      log("Publishing (committing) to repo…");
      const result = await ghPutContentJson(token, lastRemoteSha, jsonText);

      const newSha = result.newSha || "(sha updated)";
      lastRemoteSha = result.data?.content?.sha || lastRemoteSha;
      el.lastSha.textContent = `sha: ${lastRemoteSha}`;

      log(`Publish success. New sha: ${newSha}`);
      setPill(draft.isLive ? "ok" : "warn", draft.isLive ? "STATUS: LIVE published" : "STATUS: not-live published");
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

    // restore token (local device only)
    const saved = localStorage.getItem(LS_TOKEN);
    if (saved) el.token.value = saved;

    refreshPreview();
    setPill("warn", "STATUS: not loaded");
    log("Open Dashboard → paste token → Load Current State → Publish.");
    enablePublishIfReady();
  }

  init();
})();
