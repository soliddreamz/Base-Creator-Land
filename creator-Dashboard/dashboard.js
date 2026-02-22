/* BASE Creator Dashboard — V1 Publisher (Tier 0 Clean)
   - Publishes Fan App/content.json via GitHub API
   - Updates App Icons (192 + 512)
   - Safely bumps Fan App manifest version (?v=)
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
    el.status.textContent = `[${stamp}] ${line}\n` + el.status.textContent;
  }

  function setPill(type, text) {
    el.statePill.className = `pill ${type}`;
    el.statePill.textContent = text;
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

  async function ghGetFile(token, path) {
    const api =
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`;
    const res = await fetch(api, { headers: ghHeaders(token) });
    if (!res.ok) throw new Error(`GitHub GET failed (${res.status})`);
    return await res.json();
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

  function bumpManifestVersion(manifestObj) {
    const current = manifestObj.start_url || "./?v=1";
    const match = current.match(/v=(\d+)/);
    const next = match ? Number(match[1]) + 1 : 2;

    manifestObj.start_url = `./?v=${next}`;

    manifestObj.icons = manifestObj.icons.map(icon => {
      const clean = icon.src.split("?")[0];
      return {
        ...icon,
        src: `${clean}?v=${next}`
      };
    });

    return manifestObj;
  }

  el.btnUpdateIcon?.addEventListener("click", async () => {
    try {
      const token = requireToken();
      const file = el.appIconFile?.files?.[0];
      if (!file) throw new Error("No file selected.");

      el.appIconStatus.textContent = "Uploading…";

      const base64Data = await fileToBase64(file);

      const path192 = "Fan App/icons/icon-192.png";
      const path512 = "Fan App/icons/icon-512.png";

      const file192 = await ghGetFile(token, path192);
      const file512 = await ghGetFile(token, path512);

      await ghPutFile(token, path192, file192.sha, base64Data, "BASE V1: update icon 192");
      await ghPutFile(token, path512, file512.sha, base64Data, "BASE V1: update icon 512");

      // ===== BUMP MANIFEST VERSION =====

      const manifestFile = await ghGetFile(token, MANIFEST_PATH);
      const manifestJson = JSON.parse(atob(manifestFile.content));
      const bumped = bumpManifestVersion(manifestJson);

      await ghPutFile(
        token,
        MANIFEST_PATH,
        manifestFile.sha,
        toBase64Utf8(JSON.stringify(bumped, null, 2)),
        "BASE V1: bump manifest icon version"
      );

      el.appIconStatus.textContent = "Icon updated. Manifest version bumped.";
      log("Icon updated + manifest version bumped.");

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

    setPill("warn", "STATUS: ready");
  }

  init();

})();
