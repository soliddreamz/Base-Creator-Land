/* BASE Creator Dashboard — V1 Publisher (Tier 0 Clean)
   - Reads Fan App/content.json (public URL)
   - Publishes updates by committing Fan App/content.json via GitHub API (authority gate = token)
   - Adds Tier 0 App Icon Sovereignty (icons + manifest version bump) WITHOUT changing existing flow
   - Static hosting limit respected (no backend)
*/
(() => {
  // ===== CONFIG (locked to your repo) =====
  const OWNER = "soliddreamz";
  const REPO = "Base-Creator-Land";
  const BRANCH = "main";
  const TARGET_PATH = "Fan App/content.json";
  const DEFAULT_CONTENT_URL = `https://${OWNER}.github.io/${REPO}/Fan%20App/content.json`;

  // ===== ICON/MANIFEST PATHS (Tier 0 extension) =====
  const ICON_192_PATH = "Fan App/icons/icon-192.png";
  const ICON_512_PATH = "Fan App/icons/icon-512.png";
  const MANIFEST_PATH = "Fan App/manifest.json";

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

    // ===== Tier 0 Icon UI (must exist in HTML) =====
    appIconFile: $("appIconFile"),
    btnUpdateIcon: $("btnUpdateIcon"),
    appIconStatus: $("appIconStatus"),
    appIconPreview: $("appIconPreview"),
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
    };

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

    if (!draft.name) delete draft.name;
    if (!draft.bio) delete draft.bio;

    return draft;
  }

  function refreshPreview() {
    try {
      const draft = buildDraft();
      el.preview.value = JSON.stringify(draft, null, 2);
      setPill("warn", "STATUS: draft ready");
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

  function toBase64Bytes(uint8) {
    let bin = "";
    uint8.forEach((b) => bin += String.fromCharCode(b));
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

  // ===== Tier 0 EXTENSION: generic GET + PUT for icon + manifest =====
  async function ghGetFile(token, path) {
    const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`;
    const res = await fetch(api, { headers: ghHeaders(token) });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GitHub GET failed for ${path} (${res.status}). ${txt.slice(0, 160)}`);
    }
    return await res.json();
  }

  async function ghPutFile(token, path, shaOrNull, base64Content, message) {
    const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;
    const body = {
      message,
      content: base64Content,
      branch: BRANCH,
    };
    // GitHub requires sha ONLY when updating an existing file
    if (shaOrNull) body.sha = shaOrNull;

    const res = await fetch(api, {
      method: "PUT",
      headers: ghHeaders(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GitHub PUT failed for ${path} (${res.status}). ${txt.slice(0, 220)}`);
    }
    return await res.json();
  }

  function fillForm(obj) {
    el.name.value = obj?.name || "";
    el.bio.value = obj?.bio || "";

    if (Array.isArray(obj?.links)) el.links.value = JSON.stringify(obj.links, null, 2);
    else el.links.value = "[]";

    refreshPreview();
  }

  function enablePublishIfReady() {
    const hasToken = (el.token.value || "").trim().length > 0;
    const previewOk = refreshPreview();
    el.btnPublish.disabled = !(hasToken && previewOk && lastRemoteSha);

    // Tier 0 icon button gating (optional)
    if (el.btnUpdateIcon) {
      el.btnUpdateIcon.disabled = !hasToken;
    }
  }

  el.token.addEventListener("input", () => {
    const t = (el.token.value || "").trim();
    if (t) localStorage.setItem(LS_TOKEN, t);
    enablePublishIfReady();
  });

  ["input", "change"].forEach((evt) => {
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

      setPill("ok", "STATUS: published");
      log("Publish success.");
      enablePublishIfReady();
    } catch (e) {
      setPill("bad", "STATUS: publish failed");
      log(`ERROR: ${e.message}`);
      enablePublishIfReady();
    }
  });

  // ===== Tier 0 ICON CONTROL (B): icons + manifest version bump =====
  async function fileToImage(file) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // cover + center crop to square, then resize to size x size
  async function makeSquarePngBytes(file, size) {
    const img = await fileToImage(file);

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    const side = Math.min(iw, ih);
    const sx = Math.floor((iw - side) / 2);
    const sy = Math.floor((ih - side) / 2);

    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const buf = await blob.arrayBuffer();
    return new Uint8Array(buf);
  }

  async function updateAppIconAndManifest() {
    const token = requireToken();

    if (!el.appIconFile || !el.btnUpdateIcon || !el.appIconStatus) {
      throw new Error("Icon UI elements missing in index.html.");
    }

    const file = el.appIconFile.files?.[0];
    if (!file) throw new Error("Select an icon image first.");

    el.appIconStatus.textContent = "processing…";
    log("ICON: processing selected image…");

    // preview (optional)
    if (el.appIconPreview) {
      el.appIconPreview.style.display = "block";
      el.appIconPreview.src = URL.createObjectURL(file);
    }

    const bytes192 = await makeSquarePngBytes(file, 192);
    const bytes512 = await makeSquarePngBytes(file, 512);

    // fetch existing icon shas if present (icons may not exist yet)
    let sha192 = null;
    let sha512 = null;

    try { sha192 = (await ghGetFile(token, ICON_192_PATH))?.sha || null; }
    catch (_) { sha192 = null; }

    try { sha512 = (await ghGetFile(token, ICON_512_PATH))?.sha || null; }
    catch (_) { sha512 = null; }

    log("ICON: committing icon-192.png…");
    await ghPutFile(
      token,
      ICON_192_PATH,
      sha192,
      toBase64Bytes(bytes192),
      "BASE V1: Tier 0 update app icon (192)"
    );

    log("ICON: committing icon-512.png…");
    await ghPutFile(
      token,
      ICON_512_PATH,
      sha512,
      toBase64Bytes(bytes512),
      "BASE V1: Tier 0 update app icon (512)"
    );

    log("ICON: loading manifest.json sha…");
    const mf = await ghGetFile(token, MANIFEST_PATH);
    if (!mf?.sha || !mf?.content) throw new Error("Manifest load failed (missing sha/content).");

    // GitHub returns base64 with newlines sometimes
    const mfText = atob(String(mf.content).replace(/\n/g, ""));
    const parsed = safeJsonParse(mfText);
    if (!parsed.ok) throw new Error("Manifest is not valid JSON.");

    const manifest = parsed.value;

    const v = Date.now();
    manifest.start_url = `./?v=${v}`;
    manifest.icons = [
      { src: `icons/icon-192.png?v=${v}`, sizes: "192x192", type: "image/png" },
      { src: `icons/icon-512.png?v=${v}`, sizes: "512x512", type: "image/png" }
    ];

    log("ICON: committing manifest.json version bump…");
    await ghPutFile(
      token,
      MANIFEST_PATH,
      mf.sha,
      toBase64Utf8(JSON.stringify(manifest, null, 2)),
      "BASE V1: Tier 0 manifest version bump (icon update)"
    );

    el.appIconStatus.textContent = "done";
    log("ICON: success. If installed, reinstall or refresh app icon cache if needed.");
  }

  // Bind icon controls (if UI exists)
  if (el.btnUpdateIcon) {
    el.btnUpdateIcon.addEventListener("click", async () => {
      try {
        setPill("warn", "STATUS: working…");
        await updateAppIconAndManifest();
        setPill("ok", "STATUS: icon updated");
        enablePublishIfReady();
      } catch (e) {
        setPill("bad", "STATUS: icon failed");
        if (el.appIconStatus) el.appIconStatus.textContent = "failed";
        log(`ICON ERROR: ${e.message}`);
        enablePublishIfReady();
      }
    });
  }

  function init() {
    el.repoLabel.textContent = `${OWNER}/${REPO}@${BRANCH}`;
    el.contentUrl.value = DEFAULT_CONTENT_URL;

    const saved = localStorage.getItem(LS_TOKEN);
    if (saved) el.token.value = saved;

    el.links.value = "[]";
    refreshPreview();
    setPill("warn", "STATUS: not loaded");
    log("Open Dashboard → paste token → Load Current State → Publish.");
    enablePublishIfReady();
  }

  init();
})();
