<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BASE Creator Dashboard</title>

<style>
/* ===== Layout Stabilization (Prevents Resize Snap) ===== */
html, body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  background: #000;
  color: #fff;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

body {
  display: flex;
  flex-direction: column;
}

#app {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* ===== Base UI Styling ===== */
.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
  width: 100%;
  box-sizing: border-box;
}

h1 {
  margin: 0 0 8px 0;
  font-size: 28px;
}

.subtitle {
  opacity: 0.7;
  margin-bottom: 24px;
}

.card {
  border: 1px solid #222;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  background: #0a0a0a;
}

button {
  background: transparent;
  color: #fff;
  border: 1px solid #333;
  padding: 10px 16px;
  border-radius: 12px;
  cursor: pointer;
}

button:hover {
  border-color: #555;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

input, textarea {
  width: 100%;
  background: #000;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 10px;
  color: #fff;
  box-sizing: border-box;
}

input[type="color"] {
  height: 48px;
  padding: 4px;
  cursor: pointer;
}

.row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.col {
  flex: 1;
  min-width: 200px;
}

.pill {
  border: 2px solid gold;
  border-radius: 50px;
  padding: 8px 16px;
  display: inline-block;
}

.pill.ok { border-color: #0f0; }
.pill.bad { border-color: #f00; }
.pill.warn { border-color: gold; }

.linkRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.status-log {
  font-size: 12px;
  white-space: pre-wrap;
  margin-top: 12px;
  opacity: 0.7;
}
</style>
</head>

<body>
<div id="app">
<div class="container">

<h1>BASE Creator Dashboard</h1>
<div class="subtitle">Manage your home app. Publish when ready.</div>

<div class="card">
  <div class="row">
    <div class="col">
      Repo: <span id="repoLabel"></span><br>
      Target: Fan App/content.json
    </div>
    <div class="col" style="text-align:right;">
      <span id="statePill" class="pill warn">STATUS: ready</span>
    </div>
  </div>

  <div style="margin-top:16px;">
    <button id="btnLoad">Load Current State</button>
    <button id="btnPublish">Publish</button>
    <button id="btnResetToken">Reset Key</button>
  </div>

  <div style="margin-top:16px;">
    <label>Creator Key</label>
    <input id="token" type="password">
  </div>

  <div style="margin-top:16px;">
    <label>content.json URL</label>
    <input id="contentUrl">
  </div>
</div>

<div class="card">
  <div class="row">
    <div class="col">
      <label>Name</label>
      <input id="name">
    </div>
    <div class="col">
      <label>Bio</label>
      <input id="bio">
    </div>
  </div>

  <div style="margin-top:16px;">
    <label>Background Color</label>
    <input type="color" id="backgroundColor">
  </div>
</div>

<div class="card">
  <h3>Links</h3>
  <div class="row">
    <div class="col">
      <input id="linkLabelInput" placeholder="Link label">
    </div>
    <div class="col">
      <input id="linkUrlInput" placeholder="https://...">
    </div>
  </div>
  <div style="margin-top:12px;">
    <button id="addLinkBtn">Add Link</button>
    <button id="clearLinksBtn">Clear Links</button>
  </div>
  <div id="linksList"></div>
</div>

<div class="card">
  <h3>Connect Button</h3>
  <div class="row">
    <div class="col">
      <input id="contactEmail" placeholder="email@example.com">
    </div>
    <div class="col">
      <input id="contactLabel" placeholder="Button Text (optional)">
    </div>
  </div>
</div>

<div class="card">
  <h3>App Icon</h3>
  <input type="file" id="appIconFile" accept="image/png">
  <button id="btnUpdateIcon">Update Icon</button>
  <div id="appIconStatus"></div>
  <img id="appIconPreview" style="display:none;max-width:120px;margin-top:12px;">
</div>

<div class="card">
  <div id="status" class="status-log"></div>
  <div id="lastSha"></div>
</div>

</div>
</div>

<!-- KEEP YOUR EXISTING PUBLISHER SCRIPT EXACTLY BELOW THIS LINE -->
<script src="publisher.js"></script>

</body>
</html>
