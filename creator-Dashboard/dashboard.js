/* BASE Creator Dashboard — V1 Publisher (Tier 0 Stable)
   - Publishes Fan App/content.json
   - Updates app icons (192 + 512)
   - Automatically bumps manifest icon version (?v=)
   - No structural changes
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

  async function fetchPublicJson(url) {
    const u = new URL(url);
    u.searchParams.set("ts", Date.now());
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load content.json");
    return res.json();
  }

  // ===== Publish content.json =====

  el.btnPublish?.addEventListener("click", async () => {
    try {
      const token = requireToken();
      const file = await ghGetFile(token, TARGET_PATH);

      const draft = buildDraft();
      const jsonText = JSON.stringify(draft, null, 2);

      const result = await ghPutFile(
        token,
        TARGET_PATH,
        file.sha,
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

  // ===== Complete Icon Chain =====

  el.btnUpdateIcon?.addEventListener("click", async () => {
    try {
      const token = requireToken();
      const file = el.appIconFile?.files?.[0];
      if (!file) throw new Error("No file selected.");

      el.appIconStatus.textContent = "Uploading…";

      const base64Data = await fileToBase64(file);

      // Overwrite icon files
      const icon192Path = "Fan App/icons/icon-192.png";
      const icon512Path = "Fan App/icons/icon-512.png";

      const icon192File = await ghGetFile(token, icon192Path);
      const icon512File = await ghGetFile(token, icon512Path);

      await ghPutFile(token, icon192Path, icon192File.sha, base64Data, "BASE V1: update icon 192");
      await ghPutFile(token, icon512Path, icon512File.sha, base64Data, "BASE V1: update icon 512");

      // Update manifest version
      const manifestFile = await ghGetFile(token, MANIFEST_PATH);
      const manifestJson = JSON.parse(atob(manifestFile.content));

      const bumpVersion = (src) => {
        const match = src.match(/\?v=(\d+)/);
        if (!match) return src + "?v=1";
        const next = parseInt(match[1], 10) + 1;
        return src.replace(/\?v=\d+/, `?v=${next}`);
      };

      manifestJson.icons = manifestJson.icons.map(icon => ({
        ...icon,
        src: bumpVersion(icon.src)
      }));

      const updatedManifest = JSON.stringify(manifestJson, null, 2);

      await ghPutFile(
        token,
        MANIFEST_PATH,
        manifestFile.sha,
        toBase64Utf8(updatedManifest),
        "BASE V1: bump manifest icon version"
      );

      el.appIconStatus.textContent = "Icon updated everywhere.";
      log("Icon chain completed successfully.");

    } catch (e) {
      el.appIconStatus.textContent = `Error: ${e.message}`;
      log(e.message);
    }
  });

  function init() {
    if (el.repoLabel)
      el.repoLabel.textContent = `${OWNER}/${REPO}@${BRANCH}`;

    if (el.contentUrl)
      el.contentUrl.value = DEFAULT_CONTENT_URL;

    const saved = localStorage.getItem(LS_TOKEN);
    if (saved && el.token)
      el.token.value = saved;
  }

  init();

})();
