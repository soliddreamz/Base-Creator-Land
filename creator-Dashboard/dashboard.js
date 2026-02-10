/* BASE Creator Dashboard — V1 (NO DRIFT)
   Model (LOCKED):
   {
     "name": "Creator Name",
     "bio": "This is my home on the web.",
     "links": [ { "label": "...", "url": "..." } ]
   }

   - Reads Fan App/content.json (public URL)
   - Publishes by committing Fan App/content.json via GitHub API (authority gate = token)
   - No backend. GitHub Pages limit respected.
*/

(() => {
  // ===== LOCKED REPO CONFIG =====
  const OWNER = "soliddreamz";
  const REPO = "Base-Creator-Land";
  const BRANCH = "main";
  const TARGET_PATH = "Fan App/content.json"; // exact repo path (space matters)

  // Read URL (public)
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

  function requireToken() {
    const token = (el.token.value || "").trim();
    if (!token) throw new Error("Missing creator token (authority gate).");
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
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  function normalizeLinks(value) {
    // Accepts: empty => []
    // Accepts: JSON array of objects with label/url strings.
    const raw = (value || "").trim();
    if (!raw) return [];

    const parsed = safeJsonParse(raw);
    if (!parsed.ok || !Array.isArray(parsed.value)) {
      throw new Error("links must be valid JSON ARRAY (or empty).");
    }

    // sanitize
    const cleaned = parsed.value.map((item) => {
      const label = (item?.label ?? "").toString().trim();
      const url = (item?.url ?? "").toString().trim();
      const out = {};
      if (label) out.label = label;
      if (url) out.url = url;
      return out;
    }).filter((x) => x.label || x.url);

    return cleaned;
  }

  function buildDraft() {
    const name = (el.name.value || "").trim();
    const bio  = (el.bio.value || "").trim();
    const links = normalizeLinks(el.links.value);

    // LOCKED shape: only these keys
    const draft = { name, bio, links };

    // Keep strings even if empty? Your original file had all keys.
    // We'll preserve keys, but keep them as empty strings if user cleared them.
    // links always an array.
    return draft;
  }

  function refreshPreview() {
    try {
      const draft = buildDraft();
      el.preview.value = JSON.stringify(draft, null, 2);

      // simple status
      if ((draft.name || "").trim()) setPill("ok", "STATUS: draft ready");
      else setPill("warn", "STATUS: name empty");

      return true;
    } catch (e) {
      el.preview.value = `// Preview error: ${e.message}`;
      setPill("bad", "STATUS: invalid input");
      return false;
    }
  }

  async function fetchPublicContentJson(url) {
    const u = new URL(url);
    u.searchParams.set("ts", String(Date.now()));
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load content.json (${res.status})`);
    return await res.json();
  }

  async function ghGetFileSha(token) {
    const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(TARGET_PATH)}?ref=${encodeURIComponent(BRANCH)}`;
    const res = await fetch(api, { headers: ghHeaders(token) });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GitHub GET contents failed (${res.status}). ${txt.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!data?.sha) throw new Error("GitHub response missing sha.");
    return data.sha;
  }

  async function ghPutContentJson(token, sha, jsonText) {
    const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(TARGET_PATH)}`;

    const body = {
      message: `BASE V1: publish Fan App/content.json via Creator Dashboard`,
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
      throw new Error(`GitHub PUT failed (${res.status}). ${txt.slice(0, 260)}`);
    }

    return await res.json();
  }

  function fillFromJson(obj) {
    el.name.value = obj?.name ?? "";
    el.bio.value  = obj?.bio ?? "";
    el.links.value = Array.isArray(obj?.links) ? JSON.stringify(obj.links, null, 2) : "[]";
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

  ["input","change"].forEach((evt) => {
    el.name.addEventListener(evt, enablePublishIfReady);
    el.bio.addEventListener(evt, enablePublishIfReady);
    el.links.addEventListener(evt, enablePublishIfReady);
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
      const current = await fetchPublicContentJson(url);

      log("Loaded public content.json.");
      fillFromJson(current);

      const token = (el.token.value || "").trim() || localStorage.getItem(LS_TOKEN) || "";
      if (token) {
        log("Fetching GitHub sha (authority path)…");
        lastRemoteSha = await ghGetFileSha(token);
        el.lastSha.textContent = `sha: ${lastRemoteSha}`;
        log(`GitHub sha loaded: ${lastRemoteSha}`);
      } else {
        lastRemoteSha = null;
        el.lastSha.textContent = "sha: —";
        log("No token present. Sha not loaded. Publish remains disabled.");
      }

      setPill("ok", "STATUS: loaded");
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
      lastRemoteSha = await ghGetFileSha(token);
      el.lastSha.textContent = `sha: ${lastRemoteSha}`;

      const draft = buildDraft();
      const jsonText = JSON.stringify(draft, null, 2);

      log("Publishing (committing) to repo…");
      const res = await ghPutContentJson(token, lastRemoteSha, jsonText);

      const newSha = res?.content?.sha || res?.commit?.sha || "(updated)";
      if (res?.content?.sha) lastRemoteSha = res.content.sha;
      el.lastSha.textContent = `sha: ${lastRemoteSha || newSha}`;

      setPill("ok", "STATUS: published");
      log(`Publish success. New sha: ${newSha}`);
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
    log("Workflow: paste token → Load Current State → Publish.");
    enablePublishIfReady();
  }

  init();
})();
