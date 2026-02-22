/* BASE Creator Dashboard — V1 Publisher (Tier 0 Clean)
   - Publishes Fan App/content.json via GitHub API
   - Restores Pilot icon overwrite behavior (via versioned filenames)
   - Universal identity fix:
       * Updates Fan App/manifest.json name + short_name
       * Updates Fan App/index.html <title> + apple-mobile-web-app-title
       * Updates apple-touch-icon to match versioned icon
   - Safely bumps version for icon refresh
   - No architecture changes
*/
(() => {

  const OWNER = "soliddreamz";
  const REPO = "Base-Creator-Land";
  const BRANCH = "main";

  const TARGET_PATH = "Fan App/content.json";
  const MANIFEST_PATH = "Fan App/manifest.json";
  const FAN_INDEX_PATH = "Fan App/index.html";

  const DEFAULT_CONTENT_URL =
    `https://${OWNER}.github.io/${REPO}/Fan%20App/content.json`;

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
    backgroundColor: $("backgroundColor"),
    links: $("links"),

    linkLabelInput: $("linkLabelInput"),
    linkUrlInput: $("linkUrlInput"),
    addLinkBtn: $("addLinkBtn"),
    clearLinksBtn: $("clearLinksBtn"),
    linksList: $("linksList"),

    contactEmail: $("contactEmail"),
    contactLabel: $("contactLabel"),

    appIconFile: $("appIconFile"),
    btnUpdateIcon: $("btnUpdateIcon"),
    appIconStatus: $("appIconStatus"),
    appIconPreview: $("appIconPreview"),

    previewName: $("pName"),
    previewBio: $("pBio"),
    previewLinks: $("pLinks"),

    status: $("status"),
    lastSha: $("lastSha"),
    statePill: $("statePill"),
  };

  const LS_TOKEN = "base_creator_token_v1";
  let lastRemoteSha = null;
  let linkState = [];

  function log(line) {
    const stamp = new Date().toLocaleString();
    if (!el.status) return;
    el.status.textContent = `[${stamp}] ${line}\n` + el.status.textContent;
  }

  function setPill(type, text) {
    if (!el.statePill) return;
    el.statePill.className = `pill ${type}`;
    el.statePill.textContent = text;
  }

  function syncLinksToEngine() {
    if (el.links) el.links.value = JSON.stringify(linkState, null, 2);
  }

  function renderLinks() {
    if (!el.linksList) return;

    el.linksList.innerHTML = "";
    if (el.previewLinks) el.previewLinks.innerHTML = "";

    linkState.forEach((link, index) => {
      const row = document.createElement("div");
      row.className = "linkRow";

      const text = document.createElement("div");
      text.className = "linkText";
      text.textContent = `${link.label} — ${link.url}`;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      removeBtn.onclick = () => {
        linkState.splice(index, 1);
        renderLinks();
        syncLinksToEngine();
        enablePublishIfReady();
      };

      row.appendChild(text);
      row.appendChild(removeBtn);
      el.linksList.appendChild(row);

      if (el.previewLinks) {
        const p = document.createElement("div");
        p.textContent = link.label;
        el.previewLinks.appendChild(p);
      }
    });
  }

  function hydrateLinks(arr) {
    linkState = Array.isArray(arr) ? [...arr] : [];
    renderLinks();
    syncLinksToEngine();
  }

  function buildDraft() {
    const draft = {
      name: (el.name?.value || "").trim(),
      bio: (el.bio?.value || "").trim(),
      links: linkState,
      backgroundColor: el.backgroundColor?.value || "#000000"
    };

    const ce = (el.contactEmail?.value || "").trim();
    const cl = (el.contactLabel?.value || "").trim();

    if (ce) draft.contactEmail = ce;
    if (cl) draft.contactLabel = cl;

    if (!draft.name) delete draft.name;
    if (!draft.bio) delete draft.bio;

    return draft;
  }

  function refreshPreview() {
    const draft = buildDraft();
    if (el.previewName) el.previewName.textContent = draft.name || "—";
    if (el.previewBio) el.previewBio.textContent = draft.bio || "—";
  }

  function enablePublishIfReady() {
    const hasToken = (el.token?.value || "").trim().length > 0;
    if (el.btnPublish) el.btnPublish.disabled = !(hasToken && lastRemoteSha);
    refreshPreview();
  }

  function requireToken() {
    const token = (el.token?.value || "").trim();
    if (!token) throw new Error("Missing creator key.");
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

  function fromBase64Utf8(b64) {
    const bytes = Uint8Array.from(atob(b64.replace(/\s/g, "")), c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ✅ encode path segments, NOT slashes
  function ghEncodePath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  async function ghGetFileMeta(token, path) {
    const api =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${ghEncodePath(path)}?ref=${BRANCH}`;
    const res = await fetch(api, { headers: ghHeaders(token) });
    if (!res.ok) throw new Error(`GitHub GET failed (${res.status})`);
    return await res.json();
  }

  async function ghGetFileSha(token, path) {
    const data = await ghGetFileMeta(token, path);
    return data.sha;
  }

  async function ghPutFile(token, path, sha, contentBase64, message) {
    const api =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${ghEncodePath(path)}`;

    const body = {
      message,
      content: contentBase64,
      branch: BRANCH,
    };

    // If sha is provided, this is an update. If not, this creates a new file.
    if (sha) body.sha = sha;

    const res = await fetch(api, {
      method: "PUT",
      headers: ghHeaders(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`GitHub PUT failed (${res.status})`);
    return await res.json();
  }

  async function ghUpsertFile(token, path, contentBase64, message) {
    try {
      const sha = await ghGetFileSha(token, path);
      return await ghPutFile(token, path, sha, contentBase64, message);
    } catch (e) {
      // If file doesn't exist (404), create it without sha
      if (String(e.message || "").includes("(404)")) {
        return await ghPutFile(token, path, null, contentBase64, message);
      }
      throw e;
    }
  }

  async function fetchPublicJson(url) {
    const u = new URL(url);
    u.searchParams.set("ts", String(Date.now()));
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load content.json (${res.status})`);
    return await res.json();
  }

  // ===== Identity helpers =====

  function safeAppNameFromDraft(draft) {
    const n = String(draft?.name || "").trim();
    return n || "Creator Home";
  }

  function makeShortName(name) {
    const n = String(name || "").trim();
    if (!n) return "Home";
    // iOS/Android labels look best short. Keep it readable.
    return n.length > 16 ? n.slice(0, 16).trim() : n;
  }

  function ensureManifestIdentity(manifestObj, appName) {
    manifestObj.name = appName;
    manifestObj.short_name = makeShortName(appName);
    return manifestObj;
  }

  function getIconSrcFromManifest(manifestObj, size) {
    const icons = Array.isArray(manifestObj?.icons) ? manifestObj.icons : [];
    const target = icons.find(i => String(i?.sizes || "") === size) || icons[0];
    const src = String(target?.src || "icons/icon-192.png");
    return src;
  }

  function updateFanIndexHtmlIdentity(htmlText, appName, appleTouchHref) {
    let html = String(htmlText || "");

    // 1) <title>
    if (/<title>.*?<\/title>/i.test(html)) {
      html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(appName)}</title>`);
    } else {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n<title>${escapeHtml(appName)}</title>`);
    }

    // 2) apple-mobile-web-app-title
    if (/<meta[^>]+name=["']apple-mobile-web-app-title["'][^>]*>/i.test(html)) {
      html = html.replace(
        /<meta[^>]+name=["']apple-mobile-web-app-title["'][^>]*>/i,
        `<meta name="apple-mobile-web-app-title" content="${escapeAttr(appName)}">`
      );
    } else {
      html = html.replace(/<\/head>/i,
        `  <meta name="apple-mobile-web-app-title" content="${escapeAttr(appName)}">\n</head>`
      );
    }

    // 3) application-name (nice for some Android launchers)
    if (/<meta[^>]+name=["']application-name["'][^>]*>/i.test(html)) {
      html = html.replace(
        /<meta[^>]+name=["']application-name["'][^>]*>/i,
        `<meta name="application-name" content="${escapeAttr(appName)}">`
      );
    } else {
      html = html.replace(/<\/head>/i,
        `  <meta name="application-name" content="${escapeAttr(appName)}">\n</head>`
      );
    }

    // 4) apple-touch-icon (iOS Home Screen icon)
    const appleTag = `<link rel="apple-touch-icon" href="${escapeAttr(appleTouchHref)}">`;
    if (/<link[^>]+rel=["']apple-touch-icon["'][^>]*>/i.test(html)) {
      html = html.replace(
        /<link[^>]+rel=["']apple-touch-icon["'][^>]*>/i,
        appleTag
      );
    } else {
      html = html.replace(/<\/head>/i, `  ${appleTag}\n</head>`);
    }

    // 5) regular favicon (helps tabs)
    const icoTag = `<link rel="icon" href="${escapeAttr(appleTouchHref)}">`;
    if (/<link[^>]+rel=["']icon["'][^>]*>/i.test(html)) {
      html = html.replace(/<link[^>]+rel=["']icon["'][^>]*>/i, icoTag);
    } else {
      html = html.replace(/<\/head>/i, `  ${icoTag}\n</head>`);
    }

    return html;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
  function escapeAttr(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll(`"`, "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // ===== Version bump =====
  // IMPORTANT: iOS ignores querystring caching sometimes for Home Screen.
  // Fix = versioned FILENAMES so the URL path changes.
  function bumpManifestVersionAndIconPaths(manifestObj) {
    const currentStart = String(manifestObj.start_url || "./?v=1");
    const m = currentStart.match(/v=(\d+)/);
    const next = m ? Number(m[1]) + 1 : 2;

    manifestObj.start_url = `./?v=${next}`;

    // Force versioned filename paths (no ?v=)
    manifestObj.icons = [
      { src: `icons/icon-192-v${next}.png`, sizes: "192x192", type: "image/png" },
      { src: `icons/icon-512-v${next}.png`, sizes: "512x512", type: "image/png" },
    ];

    return next;
  }

  // ===== UI EVENTS =====

  el.token?.addEventListener("input", () => {
    const t = (el.token.value || "").trim();
    if (t) localStorage.setItem(LS_TOKEN, t);
    enablePublishIfReady();
  });

  el.btnResetToken?.addEventListener("click", () => {
    localStorage.removeItem(LS_TOKEN);
    if (el.token) el.token.value = "";
    lastRemoteSha = null;
    if (el.lastSha) el.lastSha.textContent = "sha: —";
    enablePublishIfReady();
    log("Creator key reset.");
  });

  [el.name, el.bio, el.backgroundColor, el.contactEmail, el.contactLabel].forEach((node) => {
    node?.addEventListener("input", () => enablePublishIfReady());
  });

  el.addLinkBtn?.addEventListener("click", () => {
    const label = (el.linkLabelInput?.value || "").trim();
    const url = (el.linkUrlInput?.value || "").trim();
    if (!url) return;

    linkState.push({
      label: label || url,
      url
    });

    if (el.linkLabelInput) el.linkLabelInput.value = "";
    if (el.linkUrlInput) el.linkUrlInput.value = "";

    renderLinks();
    syncLinksToEngine();
    enablePublishIfReady();
  });

  el.clearLinksBtn?.addEventListener("click", () => {
    linkState = [];
    renderLinks();
    syncLinksToEngine();
    enablePublishIfReady();
  });

  el.appIconFile?.addEventListener("change", () => {
    const file = el.appIconFile?.files?.[0];
    if (!file || !el.appIconPreview) return;
    const url = URL.createObjectURL(file);
    el.appIconPreview.src = url;
    el.appIconPreview.style.display = "block";
  });

  // ===== LOAD CURRENT STATE =====

  el.btnLoad?.addEventListener("click", async () => {
    try {
      setPill("warn", "STATUS: loading…");

      const current = await fetchPublicJson(el.contentUrl.value || DEFAULT_CONTENT_URL);

      if (el.name) el.name.value = current?.name || "";
      if (el.bio) el.bio.value = current?.bio || "";
      if (el.backgroundColor) el.backgroundColor.value = current?.backgroundColor || "#000000";
      hydrateLinks(current?.links);

      if (el.contactEmail) el.contactEmail.value = current?.contactEmail || "";
      if (el.contactLabel) el.contactLabel.value = current?.contactLabel || "";

      const token = (el.token?.value || localStorage.getItem(LS_TOKEN) || "").trim();
      if (token) {
        try {
          lastRemoteSha = await ghGetFileSha(token, TARGET_PATH);
          if (el.lastSha) el.lastSha.textContent = `sha: ${lastRemoteSha}`;
        } catch (shaErr) {
          lastRemoteSha = null;
          if (el.lastSha) el.lastSha.textContent = "sha: —";
          log(`SHA lookup skipped: ${shaErr.message}`);
        }
      }

      enablePublishIfReady();
      setPill("warn", "STATUS: loaded");
      log("Loaded.");

    } catch (e) {
      setPill("bad", "STATUS: load failed");
      log(e.message);
    }
  });

  // ===== PUBLISH (content.json + identity sync) =====

  el.btnPublish?.addEventListener("click", async () => {
    try {
      const token = requireToken();

      lastRemoteSha = await ghGetFileSha(token, TARGET_PATH);
      if (el.lastSha) el.lastSha.textContent = `sha: ${lastRemoteSha}`;

      const draft = buildDraft();
      const jsonText = JSON.stringify(draft, null, 2);

      const result = await ghPutFile(
        token,
        TARGET_PATH,
        lastRemoteSha,
        toBase64Utf8(jsonText),
        "BASE V1: publish content.json"
      );

      if (result?.content?.sha) {
        if (el.lastSha) el.lastSha.textContent = `sha: ${result.content.sha}`;
      }

      // ✅ Universal: keep manifest + iOS head identity in sync with creator name
      const appName = safeAppNameFromDraft(draft);

      try {
        const mf = await ghGetFileMeta(token, MANIFEST_PATH);
        const mfText = fromBase64Utf8(mf.content || "");
        const mfJson = JSON.parse(mfText);

        ensureManifestIdentity(mfJson, appName);

        await ghPutFile(
          token,
          MANIFEST_PATH,
          mf.sha,
          toBase64Utf8(JSON.stringify(mfJson, null, 2)),
          "BASE V1: sync manifest name"
        );

        // Update Fan App index.html for iOS name/icon binding
        const idx = await ghGetFileMeta(token, FAN_INDEX_PATH);
        const idxText = fromBase64Utf8(idx.content || "");

        const iconHref = getIconSrcFromManifest(mfJson, "192x192");
        const idxNew = updateFanIndexHtmlIdentity(idxText, appName, iconHref);

        await ghPutFile(
          token,
          FAN_INDEX_PATH,
          idx.sha,
          toBase64Utf8(idxNew),
          "BASE V1: sync iOS app title"
        );

        log("Identity synced (manifest + iOS head).");
      } catch (idErr) {
        // Non-fatal: content publish is the main action
        log(`Identity sync skipped: ${idErr.message}`);
      }

      setPill("ok", "STATUS: published");
      log("Publish success.");

    } catch (e) {
      setPill("bad", "STATUS: publish failed");
      log(e.message);
    }
  });

  // ===== ICON UPDATE + MANIFEST BUMP + iOS HEAD UPDATE =====

  el.btnUpdateIcon?.addEventListener("click", async () => {
    try {
      const token = requireToken();
      const file = el.appIconFile?.files?.[0];
      if (!file) throw new Error("No file selected.");

      if (el.appIconStatus) el.appIconStatus.textContent = "Uploading…";

      const base64Data = await fileToBase64(file);

      // Read manifest, bump version, switch to versioned icon filenames
      const mf = await ghGetFileMeta(token, MANIFEST_PATH);
      const mfText = fromBase64Utf8(mf.content || "");
      const mfJson = JSON.parse(mfText);

      // Keep identity synced too
      const draft = buildDraft();
      const appName = safeAppNameFromDraft(draft);
      ensureManifestIdentity(mfJson, appName);

      const nextV = bumpManifestVersionAndIconPaths(mfJson);

      // Upload icons to the NEW versioned paths (creates files if missing)
      const icon192Src = String(mfJson.icons?.[0]?.src || `icons/icon-192-v${nextV}.png`);
      const icon512Src = String(mfJson.icons?.[1]?.src || `icons/icon-512-v${nextV}.png`);

      const path192 = `Fan App/${icon192Src}`;
      const path512 = `Fan App/${icon512Src}`;

      await ghUpsertFile(token, path192, base64Data, `BASE V1: write ${icon192Src}`);
      await ghUpsertFile(token, path512, base64Data, `BASE V1: write ${icon512Src}`);

      // Write manifest
      await ghPutFile(
        token,
        MANIFEST_PATH,
        mf.sha,
        toBase64Utf8(JSON.stringify(mfJson, null, 2)),
        `BASE V1: bump manifest + identity v=${nextV}`
      );

      // Update Fan App index.html (iOS Home Screen uses this)
      const idx = await ghGetFileMeta(token, FAN_INDEX_PATH);
      const idxText = fromBase64Utf8(idx.content || "");
      const idxNew = updateFanIndexHtmlIdentity(idxText, appName, icon192Src);

      await ghPutFile(
        token,
        FAN_INDEX_PATH,
        idx.sha,
        toBase64Utf8(idxNew),
        `BASE V1: sync iOS icon+title v=${nextV}`
      );

      if (el.appIconStatus) el.appIconStatus.textContent = `Icon updated. Version v=${nextV}`;
      log(`Icon updated + manifest/index synced to v=${nextV}.`);

    } catch (e) {
      if (el.appIconStatus) el.appIconStatus.textContent = `Error: ${e.message}`;
      log(e.message);
    }
  });

  function init() {
    if (el.repoLabel) el.repoLabel.textContent = `${OWNER}/${REPO}@${BRANCH}`;
    if (el.contentUrl) el.contentUrl.value = DEFAULT_CONTENT_URL;

    const saved = localStorage.getItem(LS_TOKEN);
    if (saved && el.token) el.token.value = saved;

    if (el.backgroundColor) el.backgroundColor.value = "#000000";
    hydrateLinks([]);
    refreshPreview();
    enablePublishIfReady();
    setPill("warn", "STATUS: ready");
  }

  init();

})();
