const STATE_KEY = "BASE_CREATOR_STATE_V1";

// Load existing state
const state = JSON.parse(localStorage.getItem(STATE_KEY)) || {
  name: "",
  bio: "",
  theme: "#2563eb",
  live: { isLive:false, url:"" }
};

// Bind inputs
const nameInput = document.getElementById("name");
const bioInput = document.getElementById("bio");
const themeInput = document.getElementById("theme");
const liveUrlInput = document.getElementById("liveUrl");
const isLiveInput = document.getElementById("isLive");
const publishBtn = document.getElementById("publish");

// Populate UI
nameInput.value = state.name;
bioInput.value = state.bio;
themeInput.value = state.theme;
liveUrlInput.value = state.live.url;
isLiveInput.checked = state.live.isLive;

// Save + publish
publishBtn.onclick = () => {
  const updated = {
    name: nameInput.value,
    bio: bioInput.value,
    theme: themeInput.value,
    live:{
      isLive: isLiveInput.checked,
      url: liveUrlInput.value
    }
  };

  localStorage.setItem(STATE_KEY, JSON.stringify(updated));
  window.dispatchEvent(new Event("storage"));

  alert("Fan App updated");
};
