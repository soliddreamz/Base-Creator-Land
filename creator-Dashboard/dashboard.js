/* Creator Dashboard — Base Free V1
   - No JSON copy/paste
   - Realtime preview to Fan App using BroadcastChannel
   - Creator-owned changeable key (token)
*/

(function () {
  const CH = "base_creator_preview_channel_v1";
  const LS_TOKEN = "base_creator_preview_token_v1";
  const LS_DRAFT = "base_creator_preview_draft_v1";

  const el = (id) => document.getElementById(id);

  const $name = el("name");
  const $bio = el("bio");
  const $mode = el("mode");
  const $isLive = el("isLive");
  const $liveUrl = el("liveUrl");

  const $preview = el("preview");
  const $pillMode = el("pillMode");
  const $pillUpdated = el("pillUpdated");
  const $pillToken = el("pillToken");

  const $dot = el("dot");
  const $status = el("statusText");

  const $btnPush = el("btnPush");
  const $btnOpenFan = el("btnOpenFan");
  const $btnRotate = el("btnRotate");
  const $btnReset = el("btnReset");

  const channel = ("BroadcastChannel" in window) ? new BroadcastChannel(CH) : null;

  function nowDateISO() {
    // YYYY-MM-DD
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function randomToken() {
    // creator-owned preview key
    // short, readable, enough uniqueness for preview gate
    const a = crypto.getRandomValues(new Uint32Array(4));
    return Array.from(a).map(n => n.toString(16).padStart(8, "0")).join("").slice(0, 16);
  }

  function getToken() {
    let t = localStorage.getItem(LS_TOKEN);
    if (!t) {
      t = randomToken();
      localStorage.setItem(LS_TOKEN, t);
    }
    return t;
  }

  function setToken(t) {
    localStorage.setItem(LS_TOKEN, t);
    renderPills();
  }

  function buildPayload() {
    const token = getToken();

    const payload = {
      v: 1,
      token,
      updated: nowDateISO(),
      name: ($name.value || "Creator Name").trim(),
      bio: ($bio.value || "This is my home on the web.").trim(),
      mode: $mode.value || "TEST",
      live: {
        isLive: ($isLive.value === "true"),
        url: ($liveUrl.value || "").trim()
      }
    };

    return payload;
  }

  function saveDraft(payload) {
    localStorage.setItem(LS_DRAFT, JSON.stringify(payload));
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(LS_DRAFT);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function applyToForm(payload) {
    $name.value = payload?.name ?? "Creator Name";
    $bio.value = payload?.bio ?? "This is my home on the web.";
    $mode.value = payload?.mode ?? "TEST";
    $isLive.value = String(payload?.live?.isLive ?? false);
    $liveUrl.value = payload?.live?.url ?? "";
  }

  function renderPreview(payload) {
    $preview.textContent = JSON.stringify(payload, null, 2);
  }

  function renderPills() {
    const token = getToken();
    $pillMode.textContent = `Mode: ${$mode.value || "—"}`;
    $pillUpdated.textContent = `Updated: ${nowDateISO()}`;
    $pillToken.textContent = `Key: ${token}`;
  }

  function setStatus(ok, text) {
    $dot.classList.toggle("on", !!ok);
    $status.textContent = text;
  }

  function pushPreview() {
    const payload = buildPayload();
    saveDraft(payload);
    renderPreview(payload);
    renderPills();

    if (!channel) {
      setStatus(false, "BroadcastChannel not available in this browser");
      return;
    }

    channel.postMessage({
      type: "BASE_CREATOR_PREVIEW_PUSH",
      payload
    });

    setStatus(true, "Pushed preview to Fan App (open Fan App preview tab)");
  }

  function openFanPreview() {
    // Opens Fan App in preview mode WITH token automatically
    // No manual typing.
    const token = getToken();

    // Fan App path EXACTLY as your repo folder name:
    // Base-Creator-Land/Fan App/
    const url = new URL(window.location.href);

    // Replace /creator-Dashboard/ with /Fan%20App/
    // (space in folder name must be encoded)
    url.pathname = url.pathname.replace(/\/creator-Dashboard\/?$/, "/Fan%20App/");
    url.searchParams.set("preview", "1");
    url.searchParams.set("token", token);

    window.open(url.toString(), "_blank", "noopener,noreferrer");
    setStatus(true, "Opened Fan App preview (token auto-applied)");
  }

  function rotateToken() {
    const newToken = randomToken();
    setToken(newToken);

    // also update draft token so next push matches
    const d = loadDraft();
    if (d) {
      d.token = newToken;
      saveDraft(d);
      renderPreview(d);
    } else {
      renderPreview(buildPayload());
    }

    setStatus(true, "Key rotated (open Fan App preview again)");
  }

  function resetAll() {
    localStorage.removeItem(LS_DRAFT);
    // keep token (creator key) unless you want reset it too
    // localStorage.removeItem(LS_TOKEN);

    const payload = buildPayload();
    applyToForm(payload);
    renderPreview(payload);
    renderPills();
    setStatus(false, "Dashboard reset (not pushed)");
  }

  // Live update preview as you type (controller feel)
  function onInput() {
    const payload = buildPayload();
    saveDraft(payload);
    renderPreview(payload);
    renderPills();
  }

  // Init
  (function init() {
    const token = getToken();

    const draft = loadDraft();
    if (draft) {
      // Force token consistency with current token
      draft.token = token;
      applyToForm(draft);
      renderPreview(draft);
    } else {
      const payload = buildPayload();
      applyToForm(payload);
      renderPreview(payload);
      saveDraft(payload);
    }

    renderPills();
    setStatus(false, "Ready");

    [$name, $bio, $mode, $isLive, $liveUrl].forEach(inp => {
      inp.addEventListener("input", onInput);
      inp.addEventListener("change", onInput);
    });

    $btnPush.addEventListener("click", pushPreview);
    $btnOpenFan.addEventListener("click", openFanPreview);
    $btnRotate.addEventListener("click", rotateToken);
    $btnReset.addEventListener("click", resetAll);
  })();
})();
