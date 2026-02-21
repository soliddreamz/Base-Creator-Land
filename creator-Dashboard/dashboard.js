/* BASE Creator Dashboard — V1 Publisher (Tier 0 Clean + Email Capture) */
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

    emailCaptureToggle: $("emailCaptureToggle"),
    emailEndpoint: $("emailEndpoint"),

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

  function log(line){
    const stamp = new Date().toLocaleString();
    el.status.textContent = `[${stamp}] ${line}\n` + el.status.textContent;
  }

  function setPill(type,text){
    el.statePill.className = `pill ${type}`;
    el.statePill.textContent = text;
  }

  function syncLinks(){ el.links.value = JSON.stringify(linkState,null,2); }

  function renderLinks(){
    el.linksList.innerHTML="";
    el.previewLinks.innerHTML="";
    linkState.forEach((l,i)=>{
      const row=document.createElement("div");
      row.className="linkRow";
      row.innerHTML=`<div class="linkText">${l.label} — ${l.url}</div>`;
      const btn=document.createElement("button");
      btn.textContent="Remove";
      btn.onclick=()=>{ linkState.splice(i,1); renderLinks(); syncLinks(); };
      row.appendChild(btn);
      el.linksList.appendChild(row);
      const p=document.createElement("div");
      p.textContent=l.label;
      el.previewLinks.appendChild(p);
    });
  }

  function hydrateLinks(arr){
    linkState = Array.isArray(arr)? [...arr]:[];
    renderLinks(); syncLinks();
  }

  function buildDraft(){
    const draft={
      name: el.name.value.trim(),
      bio: el.bio.value.trim(),
      links: linkState,
      backgroundColor: el.backgroundColor.value||"#000000"
    };

    if(el.emailCaptureToggle.checked && el.emailEndpoint.value.trim()){
      draft.emailCapture=true;
      draft.emailEndpoint=el.emailEndpoint.value.trim();
    }

    if(!draft.name) delete draft.name;
    if(!draft.bio) delete draft.bio;
    return draft;
  }

  function refreshPreview(){
    const d=buildDraft();
    el.previewName.textContent=d.name||"—";
    el.previewBio.textContent=d.bio||"—";
  }

  function requireToken(){
    const t=el.token.value.trim();
    if(!t) throw new Error("Missing creator key.");
    return t;
  }

  function ghHeaders(t){
    return {
      "Accept":"application/vnd.github+json",
      "Authorization":`Bearer ${t}`,
      "X-GitHub-Api-Version":"2022-11-28",
      "Content-Type":"application/json",
    };
  }

  function toBase64Utf8(str){
    const utf8=new TextEncoder().encode(str);
    let bin=""; utf8.forEach(b=>bin+=String.fromCharCode(b));
    return btoa(bin);
  }

  async function fetchPublicJson(url){
    const u=new URL(url);
    u.searchParams.set("ts",Date.now());
    const r=await fetch(u.toString(),{cache:"no-store"});
    if(!r.ok) throw new Error();
    return r.json();
  }

  async function ghGetFileSha(t){
    const api=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(TARGET_PATH)}?ref=${BRANCH}`;
    const r=await fetch(api,{headers:ghHeaders(t)});
    if(!r.ok) throw new Error();
    return (await r.json()).sha;
  }

  async function ghPutJson(t,sha,jsonText){
    const api=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(TARGET_PATH)}`;
    const body={
      message:`BASE V1: publish content.json`,
      content:toBase64Utf8(jsonText),
      sha,
      branch:BRANCH,
    };
    const r=await fetch(api,{method:"PUT",headers:ghHeaders(t),body:JSON.stringify(body)});
    if(!r.ok) throw new Error();
    return (await r.json())?.content?.sha||null;
  }

  el.addLinkBtn.onclick=()=>{
    const l=el.linkLabelInput.value.trim();
    const u=el.linkUrlInput.value.trim();
    if(!l||!u) return;
    linkState.push({label:l,url:u});
    el.linkLabelInput.value="";
    el.linkUrlInput.value="";
    renderLinks(); syncLinks();
  };

  el.clearLinksBtn.onclick=()=>{ linkState=[]; renderLinks(); syncLinks(); };

  el.btnLoad.onclick=async()=>{
    try{
      setPill("warn","STATUS: loading…");
      const cur=await fetchPublicJson(el.contentUrl.value||DEFAULT_CONTENT_URL);
      el.name.value=cur?.name||"";
      el.bio.value=cur?.bio||"";
      el.backgroundColor.value=cur?.backgroundColor||"#000000";
      hydrateLinks(cur?.links);
      el.emailCaptureToggle.checked=cur?.emailCapture===true;
      el.emailEndpoint.value=cur?.emailEndpoint||"";
      const t=el.token.value||localStorage.getItem(LS_TOKEN);
      if(t){
        lastRemoteSha=await ghGetFileSha(t);
        el.lastSha.textContent=`sha: ${lastRemoteSha}`;
      }
      refreshPreview();
      setPill("warn","STATUS: loaded");
    }catch(e){ setPill("bad","STATUS: load failed"); }
  };

  el.btnPublish.onclick=async()=>{
    try{
      const t=requireToken();
      lastRemoteSha=await ghGetFileSha(t);
      const draft=buildDraft();
      const jsonText=JSON.stringify(draft,null,2);
      const newSha=await ghPutJson(t,lastRemoteSha,jsonText);
      if(newSha) el.lastSha.textContent=`sha: ${newSha}`;
      setPill("ok","STATUS: published");
    }catch(e){ setPill("bad","STATUS: publish failed"); }
  };

  function init(){
    el.repoLabel.textContent=`${OWNER}/${REPO}@${BRANCH}`;
    el.contentUrl.value=DEFAULT_CONTENT_URL;
    const saved=localStorage.getItem(LS_TOKEN);
    if(saved) el.token.value=saved;
    hydrateLinks([]);
    refreshPreview();
  }

  init();
})();
