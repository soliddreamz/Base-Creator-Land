/* BASE Creator Dashboard — V1 Publisher (Tier 0 Clean)
   - Publishes Fan App/content.json via GitHub API
   - Restores Pilot icon overwrite behavior
   - No architecture changes
*/
(() => {

  const OWNER = "soliddreamz";
  const REPO = "Base-Creator-Land";
  const BRANCH = "main";
  const TARGET_PATH = "Fan App/content.json";
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
    el.status.textContent = `[${stamp}] ${line}\n` + el.status.textContent;
  }

  function setPill(type, text) {
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
    return true;
  }

  function enablePublishIfReady() {
    const hasToken = (el.token?.value || "").trim().length > 0;
    el.btnPublish.disabled = !(hasToken && lastRemoteSha);
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

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function ghGetFileSha(token, path) {
    const api =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`;
    const res = await fetch(api, { headers: ghHeaders(token) });
    if (!res.ok) throw new Error(`GitHub GET failed (${res.status})`);
    const data = await res.json();
    return data.sha;
  }

  async function ghPutFile(token, path, sha, contentBase64, message) {
    const api =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;

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

      const token = el.token?.value || localStorage.getItem(LS_TOKEN);
      if (token) {
        lastRemoteSha = await ghGetFileSha(token, TARGET_PATH);
        el.lastSha.textContent = `sha: ${lastRemoteSha}`;
      }

      enablePublishIfReady();
      setPill("warn", "STATUS: loaded");
      log("Loaded.");
    } catch (e) {
      setPill("bad", "STATUS: load failed");
      log(e.message);
    }
  });

  el.btnPublish?.addEventListener("click", async () => {
    try {
      const token = requireToken();
      lastRemoteSha = await ghGetFileSha(token, TARGET_PATH);

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
        el.lastSha.textContent = `sha: ${result.content.sha}`;
      }

      setPill("ok", "STATUS: published");
      log("Publish success.");
    } catch (e) {
      setPill("bad", "STATUS: publish failed");
      log(e.message);
    }
  });

  // ===== RESTORED PILOT ICON UPDATE =====

  el.btnUpdateIcon?.addEventListener("click", async () => {
    try {
      const token = requireToken();
      const file = el.appIconFile?.files?.[0];
      if (!file) throw new Error("No file selected.");

      el.appIconStatus.textContent = "Uploading…";

      const base64Data = await fileToBase64(file);

      const path192 = "Fan App/icons/icon-192.png";
      const path512 = "Fan App/icons/icon-512.png";

      const sha192 = await ghGetFileSha(token, path192);
      const sha512 = await ghGetFileSha(token, path512);

      await ghPutFile(token, path192, sha192, base64Data, "BASE V1: update icon 192");
      await ghPutFile(token, path512, sha512, base64Data, "BASE V1: update icon 512");

      el.appIconStatus.textContent = "Icon updated. Reinstall app if needed.";
      log("Icon updated successfully.");

    } catch (e) {
      el.appIconStatus.textContent = `Error: ${e.message}`;
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
  }

  init();

})();
