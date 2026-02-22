/* BASE Creator Dashboard — V1 Publisher (Tier 0 Clean)
   - Publishes Fan App/content.json via GitHub API
   - Creator-facing UI only
   - Engine hidden
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
    el.links.value = JSON.stringify(linkState, null, 2);
  }

  function renderLinks() {
    el.linksList.innerHTML = "";
    el.previewLinks.innerHTML = "";

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

      const actions = document.createElement("div");
      actions.className = "linkActions";
      actions.appendChild(removeBtn);

      row.appendChild(text);
      row.appendChild(actions);

      el.linksList.appendChild(row);

      // Preview
      const p = document.createElement("div");
      p.textContent = link.label;
      el.previewLinks.appendChild(p);
    });
  }

  function hydrateLinks(arr) {
    linkState = Array.isArray(arr) ? [...arr] : [];
    renderLinks();
    syncLinksToEngine();
  }

  function buildDraft() {
    const draft = {
      name: (el.name.value || "").trim(),
      bio: (el.bio.value || "").trim(),
      links: linkState,
      backgroundColor: el.backgroundColor.value || "#000000"
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
    el.previewName.textContent = draft.name || "—";
    el.previewBio.textContent = draft.bio || "—";
    el.previewName.style.color = "#fff";
    el.previewBio.style.color = "#ccc";
    return true;
  }

  function enablePublishIfReady() {
    const hasToken = (el.token.value || "").trim().length > 0;
    el.btnPublish.disabled = !(hasToken && lastRemoteSha);
    refreshPreview();
  }

  function requireToken() {
    const token = (el.token.value || "").trim();
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

  async function fetchPublicJson(url) {
    const u = new URL(url);
    u.searchParams.set("ts", String(Date.now()));
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load content.json (${res.status})`);
    return await res.json();
  }

  async function ghGetFileSha(token) {
    const api =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(TARGET_PATH)}?ref=${BRANCH}`;
    const res = await fetch(api, { headers: ghHeaders(token) });
    if (!res.ok) throw new Error(`GitHub GET failed (${res.status})`);
    const data = await res.json();
    return data.sha;
  }

  async function ghPutJson(token, sha, jsonText) {
    const api =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(TARGET_PATH)}`;

    const body = {
      message: `BASE V1: publish content.json`,
      content: toBase64Utf8(jsonText),
      sha,
      branch: BRANCH,
    };

    const res = await fetch(api, {
      method: "PUT",
      headers: ghHeaders(token),
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`GitHub PUT failed (${res.status})`);
    const data = await res.json();
    return data?.content?.sha || null;
  }

  el.addLinkBtn.addEventListener("click", () => {
    const label = (el.linkLabelInput.value || "").trim();
    const url = (el.linkUrlInput.value || "").trim();
    if (!label || !url) return;

    linkState.push({ label, url });
    el.linkLabelInput.value = "";
    el.linkUrlInput.value = "";
    renderLinks();
    syncLinksToEngine();
    enablePublishIfReady();
  });

  el.clearLinksBtn.addEventListener("click", () => {
    linkState = [];
    renderLinks();
    syncLinksToEngine();
    enablePublishIfReady();
  });

  el.btnLoad.addEventListener("click", async () => {
    try {
      setPill("warn", "STATUS: loading…");
      const current = await fetchPublicJson(el.contentUrl.value || DEFAULT_CONTENT_URL);

      el.name.value = current?.name || "";
      el.bio.value = current?.bio || "";
      el.backgroundColor.value = current?.backgroundColor || "#000000";
      hydrateLinks(current?.links);

      if (el.contactEmail) el.contactEmail.value = current?.contactEmail || "";
      if (el.contactLabel) el.contactLabel.value = current?.contactLabel || "";

      const token = el.token.value || localStorage.getItem(LS_TOKEN);
      if (token) {
        lastRemoteSha = await ghGetFileSha(token);
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

  el.btnPublish.addEventListener("click", async () => {
    try {
      const token = requireToken();
      lastRemoteSha = await ghGetFileSha(token);

      const draft = buildDraft();
      const jsonText = JSON.stringify(draft, null, 2);
      const newSha = await ghPutJson(token, lastRemoteSha, jsonText);

      if (newSha) el.lastSha.textContent = `sha: ${newSha}`;

      setPill("ok", "STATUS: published");
      log("Publish success.");
    } catch (e) {
      setPill("bad", "STATUS: publish failed");
      log(e.message);
    }
  });

  function init() {
    el.repoLabel.textContent = `${OWNER}/${REPO}@${BRANCH}`;
    el.contentUrl.value = DEFAULT_CONTENT_URL;

    const saved = localStorage.getItem(LS_TOKEN);
    if (saved) el.token.value = saved;

    el.backgroundColor.value = "#000000";
    hydrateLinks([]);
    refreshPreview();
    enablePublishIfReady();
  }

  init();
})();
