/* BASE Creator Dashboard — V1 Publisher (Tier 0 Clean)
   - Reads Fan App/content.json (public URL)
   - Publishes updates by committing Fan App/content.json via GitHub API (authority gate = token)
   - Adds Tier 0 App Icon Sovereignty (manifest + icons + version bump)
   - Static hosting only. No backend.
*/
(() => {

  // ===== CONFIG (locked) =====
  const OWNER = "soliddreamz";
  const REPO = "Base-Creator-Land";
  const BRANCH = "main";

  const TARGET_CONTENT_PATH = "Fan App/content.json";
  const TARGET_MANIFEST_PATH = "Fan App/manifest.json";
  const ICON_192_PATH = "Fan App/icons/icon-192.png";
  const ICON_512_PATH = "Fan App/icons/icon-512.png";

  const DEFAULT_CONTENT_URL =
    `https://${OWNER}.github.io/${REPO}/Fan%20App/content.json`;

  const DEFAULT_MANIFEST_URL =
    `https://${OWNER}.github.io/${REPO}/Fan%20App/manifest.json`;

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

    // ICON
    iconFile: $("appIconFile"),
    btnUpdateIcon: $("btnUpdateIcon"),
    iconStatus: $("appIconStatus"),
    iconPreview: $("appIconPreview")
  };

  // ===== STATE =====
  const LS_TOKEN = "base_creator_token_v1";
  let lastRemoteSha = null;

  // ===== UTIL =====
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
    if (!token) throw new Error("Missing creator token.");
    return token;
  }

  function ghHeaders(token) {
    return {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    };
  }

  function toBase64Utf8(str) {
    const utf8 = new TextEncoder().encode(str);
    let bin = "";
    utf8.forEach((b) => bin += String.fromCharCode(b));
    return btoa(bin);
  }

  function toBase64Binary(uint8) {
    let bin = "";
    uint8.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
  }

  async function fetchPublicJson(url) {
    const u = new URL(url);
    u.searchParams.set("ts", String(Date.now()));
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Load failed (${res.status})`);
    return await res.json();
  }

  async function ghGetFile(token, path) {
    const api =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`;
    const res = await fetch(api, { headers: ghHeaders(token) });
    if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
    return await res.json();
  }

  async function ghPutFile(token, path, sha, base64Content, message) {
    const api =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;
    const body = {
      message,
      content: base64Content,
      sha,
      branch: BRANCH
    };

    const res = await fetch(api, {
      method: "PUT",
      headers: ghHeaders(token),
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`PUT ${path} failed (${res.status})`);
    return await res.json();
  }

  function buildDraft() {
    const draft = {
      name: (el.name.value || "").trim(),
      bio: (el.bio.value || "").trim()
    };

    const linksRaw = (el.links.value || "").trim();
    if (linksRaw) {
      const parsed = safeJsonParse(linksRaw);
      if (!parsed.ok || !Array.isArray(parsed.value)) {
        throw new Error("links must be valid JSON ARRAY.");
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
      el.preview.value =
        JSON.stringify(buildDraft(), null, 2);
      setPill("warn", "STATUS: draft ready");
      return true;
    } catch (e) {
      el.preview.value = `// ${e.message}`;
      setPill("bad", "STATUS: invalid input");
      return false;
    }
  }

  function enablePublishIfReady() {
    const hasToken = (el.token.value || "").trim();
    const previewOk = refreshPreview();
    el.btnPublish.disabled = !(hasToken && previewOk && lastRemoteSha);
  }

  // ===== ICON FLOW =====
  async function resizeImage(file, size) {
    const img = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, size, size);

    const blob = await new Promise(res =>
      canvas.toBlob(res, "image/png")
    );

    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  async function updateIconFlow() {
    const token = requireToken();
    const file = el.iconFile.files[0];
    if (!file) throw new Error("Select an image first.");

    el.iconStatus.textContent = "Processing...";

    const icon192 = await resizeImage(file, 192);
    const icon512 = await resizeImage(file, 512);

    const file192 = await ghGetFile(token, ICON_192_PATH).catch(() => null);
    const file512 = await ghGetFile(token, ICON_512_PATH).catch(() => null);

    await ghPutFile(
      token,
      ICON_192_PATH,
      file192?.sha,
      toBase64Binary(icon192),
      "BASE V1: update 192 icon"
    );

    await ghPutFile(
      token,
      ICON_512_PATH,
      file512?.sha,
      toBase64Binary(icon512),
      "BASE V1: update 512 icon"
    );

    const manifestFile = await ghGetFile(token, TARGET_MANIFEST_PATH);
    const manifestJson =
      JSON.parse(atob(manifestFile.content.replace(/\n/g, "")));

    const version = Date.now();

    manifestJson.start_url = `./?v=${version}`;
    manifestJson.icons = [
      {
        src: `icons/icon-192.png?v=${version}`,
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: `icons/icon-512.png?v=${version}`,
        sizes: "512x512",
        type: "image/png"
      }
    ];

    await ghPutFile(
      token,
      TARGET_MANIFEST_PATH,
      manifestFile.sha,
      toBase64Utf8(JSON.stringify(manifestJson, null, 2)),
      "BASE V1: manifest version bump (icon update)"
    );

    el.iconStatus.textContent = "Icon updated.";
    log("App icon + manifest version updated.");
  }

  el.btnUpdateIcon.addEventListener("click", async () => {
    try {
      await updateIconFlow();
    } catch (e) {
      el.iconStatus.textContent = "Failed.";
      log(`ICON ERROR: ${e.message}`);
    }
  });

  // ===== INIT =====
  function init() {
    el.repoLabel.textContent = `${OWNER}/${REPO}@${BRANCH}`;
    el.contentUrl.value = DEFAULT_CONTENT_URL;

    const saved = localStorage.getItem(LS_TOKEN);
    if (saved) el.token.value = saved;

    el.links.value = "[]";
    refreshPreview();
    setPill("warn", "STATUS: not loaded");
    log("Load → Edit → Publish. Icon control enabled.");
    enablePublishIfReady();
  }

  init();

})();
