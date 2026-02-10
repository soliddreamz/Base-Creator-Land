/* Base Free Live Bridge (no backend)
   - BroadcastChannel sends updates to Fan App instantly (same origin).
   - Creator-changeable key (NOT universal).
*/
(() => {
  const CHANNEL_NAME = "base-live-bridge";
  const bc = ("BroadcastChannel" in window) ? new BroadcastChannel(CHANNEL_NAME) : null;

  const el = (id) => document.getElementById(id);

  const state = {
    bridgeOn: false,
    key: "",
    app: {
      name: "Creator Name",
      bio: "This is my home on the web.",
      welcome: "Welcome to my Base.",
      mode: "TEST",
      updated: "",
      live: { isLive: false, url: "" },
      links: [
        { label: "Instagram", url: "https://instagram.com/" },
        { label: "YouTube", url: "https://youtube.com/" }
      ],
      media: [
        { title: "Latest Drop", subtitle: "new", url: "" }
      ]
    }
  };

  function todayISO(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function randKey(){
    // short + readable
    return Math.random().toString(36).slice(2, 8) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function setBridgeUI(on){
    state.bridgeOn = on;

    const dot = el("bridgeDot");
    dot.classList.remove("good","warn","bad");
    dot.classList.add(on ? "good" : "bad");

    el("bridgeText").textContent = on ? "Bridge: ON" : "Bridge: OFF";
    el("toggleBridgeBtn").textContent = on ? "Turn Bridge OFF" : "Turn Bridge ON";
  }

  function readInputs(){
    state.app.name = el("nameInput").value.trim() || "Creator Name";
    state.app.bio = el("bioInput").value || "";
    state.app.welcome = el("welcomeInput").value || "";
    state.app.mode = el("modeInput").value || "TEST";
    state.app.updated = todayISO();

    const isLive = el("isLiveInput").value === "true";
    state.app.live.isLive = isLive;
    state.app.live.url = el("liveUrlInput").value.trim();

    state.app.links = [
      { label: el("link1Label").value.trim() || "Instagram", url: el("link1Url").value.trim() || "https://instagram.com/" },
      { label: el("link2Label").value.trim() || "YouTube",    url: el("link2Url").value.trim() || "https://youtube.com/" }
    ];

    state.app.media = [
      { title: el("media1Title").value.trim() || "Latest Drop",
        subtitle: el("media1Subtitle").value.trim() || "",
        url: el("media1Url").value.trim() || "" }
    ];
  }

  function renderPayload(){
    el("updatedInput").value = state.app.updated;
    el("payloadPre").textContent = JSON.stringify(state.app, null, 2);
  }

  function broadcast(){
    if (!bc) return;
    if (!state.bridgeOn) return;

    const key = (state.key || "").trim();
    if (!key) return;

    bc.postMessage({
      type: "APP_UPDATE",
      key,
      payload: state.app
    });
  }

  function sync(){
    readInputs();
    renderPayload();
    broadcast();
  }

  function setKey(k){
    state.key = (k || "").trim();
    el("keyInput").value = state.key;
  }

  function openFanPreview(){
    // Fan folder is "Fan App" (space!) so URL encoding matters.
    const base = location.origin + location.pathname.replace(/creator-Dashboard\/.*$/,"");
    const fanUrl = base + "Fan%20App/?key=" + encodeURIComponent(state.key);
    window.open(fanUrl, "_blank", "noopener");
  }

  function wire(){
    // Key
    el("regenKeyBtn").addEventListener("click", () => {
      setKey(randKey());
      sync();
    });

    el("keyInput").addEventListener("input", () => {
      state.key = el("keyInput").value.trim();
      // do NOT auto-broadcast key changes until user types; we still sync to keep preview consistent
      sync();
    });

    // Bridge toggle
    el("toggleBridgeBtn").addEventListener("click", () => {
      setBridgeUI(!state.bridgeOn);
      sync();
    });

    el("openFanPreviewBtn").addEventListener("click", () => {
      if (!state.key) setKey(randKey());
      openFanPreview();
    });

    // Controller changes = immediate sync (DJ controller feel)
    const ids = [
      "nameInput","bioInput","welcomeInput","modeInput",
      "isLiveInput","liveUrlInput",
      "link1Label","link1Url","link2Label","link2Url",
      "media1Title","media1Subtitle","media1Url"
    ];
    for (const id of ids){
      el(id).addEventListener("input", sync);
      el(id).addEventListener("change", sync);
    }
  }

  function boot(){
    // default: creator has control of key (not universal)
    setKey(randKey());
    setBridgeUI(false);

    // seed inputs
    el("nameInput").value = state.app.name;
    el("bioInput").value = state.app.bio;
    el("welcomeInput").value = state.app.welcome;
    el("modeInput").value = state.app.mode;
    el("isLiveInput").value = String(state.app.live.isLive);
    el("liveUrlInput").value = state.app.live.url;

    el("link1Label").value = state.app.links[0].label;
    el("link1Url").value = state.app.links[0].url;
    el("link2Label").value = state.app.links[1].label;
    el("link2Url").value = state.app.links[1].url;

    el("media1Title").value = state.app.media[0].title;
    el("media1Subtitle").value = state.app.media[0].subtitle;
    el("media1Url").value = state.app.media[0].url;

    wire();
    sync();
  }

  boot();
})();
