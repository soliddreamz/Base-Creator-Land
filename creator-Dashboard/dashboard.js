// dashboard.js
// Base Creator Authority — Local, Changeable, Non-Permanent

const CREATOR_KEY_STORAGE = "base_creator_key";
const CREATOR_KEY_ACTIVE = "base_creator_active";

// --- Utilities ---
function generateKey() {
  return crypto.randomUUID();
}

function getStoredKey() {
  return localStorage.getItem(CREATOR_KEY_STORAGE);
}

function isCreatorActive() {
  return localStorage.getItem(CREATOR_KEY_ACTIVE) === "true";
}

// --- Creator Actions ---
function createCreatorKey() {
  const key = generateKey();
  localStorage.setItem(CREATOR_KEY_STORAGE, key);
  localStorage.setItem(CREATOR_KEY_ACTIVE, "true");
  applyMode();
  return key;
}

function rotateCreatorKey() {
  return createCreatorKey();
}

function revokeCreatorKey() {
  localStorage.removeItem(CREATOR_KEY_STORAGE);
  localStorage.removeItem(CREATOR_KEY_ACTIVE);
  applyMode();
}

// --- Mode Handling ---
function applyMode() {
  const creatorKey = getStoredKey();
  const creatorEnabled = isCreatorActive();

  document.body.setAttribute(
    "data-mode",
    creatorKey && creatorEnabled ? "creator" : "fan"
  );
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  applyMode();
});

// --- Expose for UI ---
window.BaseCreator = {
  createKey: createCreatorKey,
  rotateKey: rotateCreatorKey,
  revokeKey: revokeCreatorKey,
  isCreator: () => document.body.dataset.mode === "creator",
};
