/* BASE Creator Dashboard — V1 Publisher (Tier 0 Clean)
   - Publishes Fan App/content.json via GitHub API
   - Restores Pilot icon overwrite behavior
   - Safely bumps Fan App manifest ?v= for icon refresh
   - No architecture changes
*/
(() => {

  const OWNER = "soliddreamz";
  const REPO = "Base-Creator-Land";
  const BRANCH = "main";

  const TARGET_PATH = "Fan App/content.json";
  const MANIFEST_PATH = "Fan App/manifest.json";

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

  // ✅ CRITICAL FIX: encode path segments, NOT slashes
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
      sha,
      branch: BRANCH,
    };

    const res = await fetch(api, {
      method: "PUT",
      headers: ghHeaders(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`GitHub PUT failed (${res.status})`);
    return await res.json();
  }

  async function fetchPublicJson(url) {
    const u = new URL(url);
    u.searchParams.set("ts", String(Date.now()));
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load content.json (${res.status})`);
    return await res.json();
  }

  function bumpManifestVersion(manifestObj) {
    const currentStart = String(manifestObj.start_url || "./?v=1");
    const m = currentStart.match(/v=(\d+)/);
    const next = m ? Number(m[1]) + 1 : 2;

    manifestObj.start_url = `./?v=${next}`;

    if (Array.isArray(manifestObj.icons)) {
      manifestObj.icons = manifestObj.icons.map((icon) => {
        const src = String(icon.src || "");
        const clean = src.split("?")[0];
        return { ...icon, src: `${clean}?v=${next}` };
      });
    }

    return next;
  }

  // ===== UI EVENTS (kept minimal, no redesign) =====

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

      // Always load public JSON first (never blocked by GitHub API)
      const current = await fetchPublicJson(el.contentUrl.value || DEFAULT_CONTENT_URL);

      if (el.name) el.name.value = current?.name || "";
      if (el.bio) el.bio.value = current?.bio || "";
      if (el.backgroundColor) el.backgroundColor.value = current?.backgroundColor || "#000000";
      hydrateLinks(current?.links);

      if (el.contactEmail) el.contactEmail.value = current?.contactEmail || "";
      if (el.contactLabel) el.contactLabel.value = current?.contactLabel || "";

      // Then try SHA (non-fatal if it fails)
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

  // ===== PUBLISH =====

  el.btnPublish?.addEventListener("click", async () => {
    try {
      const token = requireToken();

      // Get fresh SHA (will work because path encoding is fixed)
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

      setPill("ok", "STATUS: published");
      log("Publish success.");

    } catch (e) {
      setPill("bad", "STATUS: publish failed");
      log(e.message);
    }
  });

  // ===== ICON UPDATE + MANIFEST BUMP =====

  el.btnUpdateIcon?.addEventListener("click", async () => {
    try {
      const token = requireToken();
      const file = el.appIconFile?.files?.[0];
      if (!file) throw new Error("No file selected.");

      if (el.appIconStatus) el.appIconStatus.textContent = "Uploading…";

      const base64Data = await fileToBase64(file);

      const path192 = "Fan App/icons/icon-192.png";
      const path512 = "Fan App/icons/icon-512.png";

      const sha192 = await ghGetFileSha(token, path192);
      const sha512 = await ghGetFileSha(token, path512);

      await ghPutFile(token, path192, sha192, base64Data, "BASE V1: update icon 192");
      await ghPutFile(token, path512, sha512, base64Data, "BASE V1: update icon 512");

      // bump manifest ?v= so installed PWAs pull new icon URLs
      const mf = await ghGetFileMeta(token, MANIFEST_PATH);
      const mfText = fromBase64Utf8(mf.content || "");
      const mfJson = JSON.parse(mfText);

      const nextV = bumpManifestVersion(mfJson);

      await ghPutFile(
        token,
        MANIFEST_PATH,
        mf.sha,
        toBase64Utf8(JSON.stringify(mfJson, null, 2)),
        `BASE V1: bump manifest icon version v=${nextV}`
      );

      if (el.appIconStatus) el.appIconStatus.textContent = `Icon updated. Manifest v=${nextV}`;
      log(`Icon updated + manifest bumped to v=${nextV}.`);

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
