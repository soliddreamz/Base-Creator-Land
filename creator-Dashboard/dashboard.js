const FAN_CONTENT_PATH = "../Fan App/content.json";

let current = {};

async function load() {
  const res = await fetch(FAN_CONTENT_PATH, { cache: "no-store" });
  current = await res.json();

  document.getElementById("name").value = current.name || "";
  document.getElementById("bio").value = current.bio || "";
  document.getElementById("mode").value = current.mode || "TEST";

  document.getElementById("links").value = (current.links || [])
    .map(l => `${l.label} | ${l.url}`)
    .join("\n");

  document.getElementById("preview").textContent =
    JSON.stringify(current, null, 2);
}

async function save() {
  const updated = {
    name: document.getElementById("name").value.trim(),
    bio: document.getElementById("bio").value.trim(),
    mode: document.getElementById("mode").value,
    updated: new Date().toISOString().split("T")[0],
    links: document.getElementById("links").value
      .split("\n")
      .map(l => l.split("|"))
      .filter(p => p.length === 2)
      .map(p => ({
        label: p[0].trim(),
        url: p[1].trim()
      }))
  };

  document.getElementById("preview").textContent =
    JSON.stringify(updated, null, 2);

  alert(
    "CONTENT UPDATED.\n\nNext step (for now): commit this repo.\n\nFan App will reflect changes on reload."
  );
}

load();
