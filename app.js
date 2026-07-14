/* NewsWell Annotator — static, no-backend block editor for NewsKick print layouts.
 * Draw editorial / ad / filler blocks over page images; export NewsWell-native JSON.
 * State lives in localStorage; page images are referenced by URL (samples) or data-URL (uploads). */
"use strict";

/* ============================================================ inlined defaults
 * External papers.json / types.json override these when fetch succeeds (served
 * over http). Inlined so the app also runs from file:// with no server. */
const FALLBACK_PAPERS = {
  "newswell-819x792": {
    label:"NewsWell Tab (819 × 792)", pageW:819, pageH:792,
    marginL:36, marginR:36, marginT:43, marginB:36, baseline:12, defaultGrid:"4",
    grids:{ "4":{label:"4-col",columns:4,colWidthPts:177.75,gutterPts:12},
            "10":{label:"10-col",columns:10,colWidthPts:63.9,gutterPts:12} },
    titles:["Beach & Bay Press","Peninsula Beacon","La Jolla Village News"]
  }
};
const FALLBACK_TYPES = [
  {id:"article",label:"Article",group:"Editorial",kind:"editorial",key:"a",color:"#2563eb",desc:"Standard editorial article — headline, body, art",roles:["secondary","lead","brief"]},
  {id:"wild-art",label:"Wild Art",group:"Editorial",kind:"wild-art",key:"w",color:"#10b981",desc:"Standalone photo / art with caption, no article"},
  {id:"what-inside",label:"What's Inside",group:"Editorial",kind:"what-inside",key:"i",color:"#8b5cf6",desc:"Inside / teaser / index box"},
  {id:"ad",label:"Ad",group:"Ad",kind:"ad",key:"d",color:"#e11d48",desc:"Advertisement"},
  {id:"filler",label:"Filler",group:"Filler",kind:"filler",key:"f",color:"#64748b",desc:"Filler content"}
];
// Beach & Bay sample — page images + EJ's seed annotations (image px @ 1707×1650).
const SAMPLE = {
  id:"beach-and-bay-2026-05-08",
  title:"Beach & Bay Press — May 8 2026",
  source:"beach-and-bay-press-may-8-2026.pdf",
  paperId:"newswell-819x792",
  pages:Array.from({length:16},(_,i)=>({name:"p-"+String(i+1).padStart(2,"0"),
    src:"samples/beach-and-bay-press-2026-05-08/pages/p-"+String(i+1).padStart(2,"0")+".png"})),
  annotations:{ "0":[
    {x:1261,y:268,w:367,h:744,cls:"article",role:"secondary"},
    {x:365,y:279,w:852,h:733,cls:"article",role:"lead"},
    {x:75,y:268,w:281,h:796,cls:"what-inside"},
    {x:75,y:1096,w:267,h:260,cls:"ad"},
    {x:75,y:1356,w:766,h:243,cls:"ad"},
    {x:866,y:1356,w:762,h:243,cls:"article",role:"secondary"},
    {x:365,y:1023,w:476,h:333,cls:"article",role:"secondary"},
    {x:866,y:1012,w:762,h:344,cls:"article",role:"secondary"}
  ]}
};

const LS_PROJ = "nwannot.project.v1";
const LS_PREFS = "nwannot.prefs.v1";
const AUTO_MAP = {editorial:"article",body:"article",headline:"article",article:"article",
  photo:"wild-art",image:"wild-art","wild-art":"wild-art","what-inside":"what-inside",
  ad:"ad",header:"filler",filler:"filler"};

/* ============================================================ state */
let PAPERS = FALLBACK_PAPERS, TYPES = FALLBACK_TYPES;
const COLOR={}, LABEL={}, KIND={}, BYKEY={};
let NPAGES = 0;
let edgeCache = {};

const S = {
  project:null, paperId:null, paper:null,
  page:0, boxes:{}, auto:{}, undo:{}, redo:{}, uid:1,
  sel:[], primary:null, hover:null, clip:[],
  natW:1, natH:1, zoom:1,
  snap:true, edgesOn:false, grid:false, gridMode:"4", defaultRole:{},
  staticX:[], staticY:[],
  space:false, inspFor:""
};

/* ============================================================ tiny utils */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const r1=v=>Math.round(v*10)/10;
const colorOf=id=>COLOR[id]||"#888";
const labelOf=id=>LABEL[id]||(id||"?").toUpperCase();
const kindOf =id=>KIND[id]||id;
const rolesFor=id=>{const t=TYPES.find(x=>x.id===id);return (t&&t.roles)||null;};
const pageKey=n=>"p-"+String(n+1).padStart(2,"0");
const boxById=id=>S.boxes[S.page].find(b=>b.id===id);
const normBox=b=>{const o={x:+b.x||0,y:+b.y||0,w:+b.w||0,h:+b.h||0,cls:b.cls};
  if(b.role)o.role=b.role; if(b.locked)o.locked=true; if(b.hidden)o.hidden=true; return o;};

const canvas=$("#canvas"), img=$("#page"), stage=$("#stage");

/* ============================================================ geometry */
const P = ()=>S.paper||FALLBACK_PAPERS["newswell-819x792"];
const gridDef=()=>{const p=P();return p.grids[S.gridMode]||p.grids[Object.keys(p.grids)[0]];};
function gridXPts(){ const p=P(),g=gridDef(),xs=[]; let x=p.marginL;
  for(let i=0;i<g.columns;i++){ xs.push(Math.round(x*100)/100); x+=g.colWidthPts;
    xs.push(Math.round(x*100)/100); x+=g.gutterPts; } return xs; }
const marginYPts=()=>{const p=P();return [p.marginT,p.pageH-p.marginB];};
// image px <-> content-relative points (origin = top-left inside margins)
const pxToPtX=px=>px*P().pageW/S.natW - P().marginL;
const pxToPtY=px=>px*P().pageH/S.natH - P().marginT;
const pxToPtW=w =>w*P().pageW/S.natW;
const pxToPtH=h =>h*P().pageH/S.natH;
const ptToPxX=pt=>(pt+P().marginL)*S.natW/P().pageW;
const ptToPxY=pt=>(pt+P().marginT)*S.natH/P().pageH;
const ptToPxW=pt=>pt*S.natW/P().pageW;
const ptToPxH=pt=>pt*S.natH/P().pageH;
const scale=()=>img.clientWidth/(S.natW||1);

/* ============================================================ config load */
async function loadConfig(){
  try{ const p=await (await fetch("papers.json",{cache:"no-store"})).json();
       if(p&&p.papers) PAPERS=p.papers; }catch(e){}
  try{ const t=await (await fetch("types.json",{cache:"no-store"})).json();
       if(t&&t.types&&t.types.length) TYPES=t.types; }catch(e){}
  for(const t of TYPES){ COLOR[t.id]=t.color; LABEL[t.id]=(t.label||t.id).toUpperCase();
    KIND[t.id]=t.kind||t.id; if(t.key) BYKEY[t.key.toLowerCase()]=t.id; }
}

/* ============================================================ prefs */
function loadPrefs(){ try{ const p=JSON.parse(localStorage.getItem(LS_PREFS)||"{}");
  if(p.snap!=null)S.snap=p.snap; if(p.edgesOn!=null)S.edgesOn=p.edgesOn;
  if(p.grid!=null)S.grid=p.grid; if(p.gridMode)S.gridMode=p.gridMode;
  if(p.defaultRole)S.defaultRole=p.defaultRole; }catch(e){} }
function savePrefs(){ try{ localStorage.setItem(LS_PREFS,JSON.stringify({
  snap:S.snap,edgesOn:S.edgesOn,grid:S.grid,gridMode:S.gridMode,defaultRole:S.defaultRole})); }catch(e){} }

/* ============================================================ project */
function loadProject(pr){
  S.project=pr; S.paperId=pr.paperId in PAPERS?pr.paperId:Object.keys(PAPERS)[0];
  S.paper=PAPERS[S.paperId];
  if(!S.paper.grids[S.gridMode]) S.gridMode=S.paper.defaultGrid||Object.keys(S.paper.grids)[0];
  NPAGES=pr.pages.length; S.boxes={}; S.undo={}; S.redo={}; S.auto={}; edgeCache={};
  for(let i=0;i<NPAGES;i++){
    const src=pr.annotations[i]||pr.annotations[String(i)]||[];
    S.boxes[i]=src.map(b=>({id:S.uid++,...normBox(b)})); S.undo[i]=[]; S.redo[i]=[];
  }
  $("#projTitle").value=pr.title||"Untitled";
  buildPaperSel(); loadAuto();
  S.page=0; S.sel=[]; S.primary=null;
  updateToggleUI(); showPage(0);
}
function collectAnnotations(){ const a={};
  for(let i=0;i<NPAGES;i++) a[i]=S.boxes[i].map(normBox); return a; }
let persistT=null;
function persist(){ S.project.title=$("#projTitle").value||"Untitled";
  S.project.paperId=S.paperId; S.project.annotations=collectAnnotations();
  try{ localStorage.setItem(LS_PROJ,JSON.stringify(S.project)); setSave("ok"); }
  catch(e){ setSave("err"); toast("Save failed — storage full? Export your JSON."); }
}
function save(){ setSave("dirty"); clearTimeout(persistT); persistT=setTimeout(persist,300); }
function setSave(k){ const e=$("#save");
  e.className=k; e.textContent=k==="dirty"?"unsaved":k==="ok"?"saved ✓":k==="err"?"save failed":"idle"; }

function buildPaperSel(){ const sel=$("#paperSel"); sel.innerHTML="";
  for(const id in PAPERS){ const o=document.createElement("option");
    o.value=id; o.textContent=PAPERS[id].label; sel.appendChild(o); }
  sel.value=S.paperId; }

async function loadAuto(){ // optional CV seeds served alongside the app
  S.auto={}; try{ const j=await (await fetch("auto_blocks.json",{cache:"no-store"})).json();
    for(const pg of (j.pages||[])){ const idx=pg.page-1;
      S.auto[idx]=(pg.blocks||[]).map(b=>({cls:b.cls,x:b.box[0],y:b.box[1],
        w:b.box[2]-b.box[0],h:b.box[3]-b.box[1]})); } }catch(e){} }

/* ============================================================ palette */
function buildPalette(){
  S.active=S.active||TYPES[0].id;
  const pal=$("#palette"); pal.innerHTML="";
  const order=[],members={};
  for(const t of TYPES){ const g=t.group||t.id; if(!(g in members)){members[g]=[];order.push(g);} members[g].push(t); }
  for(const g of order){
    if(order.length>1||members[g].length<TYPES.length){ const l=document.createElement("div");
      l.className="grpLabel"; l.textContent=g; pal.appendChild(l); }
    for(const t of members[g]){
      const el=document.createElement("div"); el.className="sw"; el.dataset.c=t.id; el.title=t.desc||t.label;
      el.innerHTML=`<i style="background:${t.color}"></i><span class="lab">${t.label}</span>`
        +(t.key?`<kbd>${t.key.toUpperCase()}</kbd>`:"");
      el.onclick=()=>setClass(t.id); pal.appendChild(el);
    }
  }
  paletteActive();
  $("#keysList").innerHTML = keyRows();
}
const paletteActive=()=>$$(".sw").forEach(s=>s.classList.toggle("active",s.dataset.c===S.active));
function keyRows(){
  const rows=TYPES.filter(t=>t.key).map(t=>[t.key.toUpperCase(),t.label]);
  const more=[["G","Toggle grid"],["C","Cycle grid columns"],["S","Toggle snapping"],
    ["Shift-drag","Bypass snap"],["Alt-drag","Marquee select"],["⌘/Ctrl A","Select all"],
    ["⌘/Ctrl D","Duplicate"],["⌘/Ctrl C / V","Copy / paste"],["⇧⌘V","Paste in place"],
    ["⌘/Ctrl Z","Undo"],["⇧⌘Z","Redo"],["Arrows","Nudge 1pt (⇧ = 10pt)"],
    ["Del / ⌫","Delete selection"],[", .  or  [ ]","Prev / next page"],["+ / − / 0","Zoom in / out / fit"],
    ["Space-drag","Pan"],["Esc","Deselect"]];
  return [...rows,...more].map(([k,v])=>`<div><span>${v}</span><kbd>${k}</kbd></div>`).join("");
}

/* ============================================================ page nav / zoom */
function showPage(n){
  S.page=clamp(n,0,NPAGES-1); S.sel=[]; S.primary=null;
  const pg=S.project.pages[S.page];
  img.onload=()=>{ S.natW=img.naturalWidth||1; S.natH=img.naturalHeight||1;
    edgeCache[S.page]=edgeCache[S.page]; layout(); };
  img.src=pg.src+(pg.src.startsWith("data:")?"":("?"+Date.now()));
  $("#pageno").textContent=(S.page+1)+" / "+NPAGES;
}
function fitScale(){ const pad=52;
  const sw=Math.max(60,stage.clientWidth-pad), sh=Math.max(60,stage.clientHeight-pad);
  return Math.min(sw/(S.natW||1),sh/(S.natH||1)); }
function layout(){ const f=fitScale()*S.zoom; img.style.width=(S.natW*f)+"px"; renderAll(); updateZoomLabel(); }
function updateZoomLabel(){ const pct=Math.round(S.zoom*100);
  $("#zoomval").textContent = S.zoom===1?"Fit":pct+"%"; $("#stZoom").textContent=pct+"%"; }
function clientToImg(cx,cy){ const r=canvas.getBoundingClientRect(),k=scale();
  return {x:(cx-r.left)/k,y:(cy-r.top)/k}; }
function zoomAt(mult,cx,cy){
  const before=clientToImg(cx,cy);
  S.zoom=clamp(S.zoom*mult,0.4,8); layout();
  const k=scale(),r=canvas.getBoundingClientRect();
  stage.scrollLeft += (r.left+before.x*k)-cx;
  stage.scrollTop  += (r.top +before.y*k)-cy;
  updateZoomLabel();
}
function zoomFit(){ S.zoom=1; layout(); }

/* ============================================================ snapping */
const snapActive=ev=>S.snap && !(ev&&ev.shiftKey);
function computeSnaps(){ const p=P();
  S.staticX=gridXPts().map(pt=>pt*S.natW/p.pageW);
  S.staticY=marginYPts().map(pt=>pt*S.natH/p.pageH);
  if(S.edgesOn){ const e=detectEdges(S.page); S.staticX=S.staticX.concat(e.x); S.staticY=S.staticY.concat(e.y); }
}
function xCandsT(excl){ const p=P(),a=[]; const gx=gridXPts();
  gx.forEach(pt=>{ const isM=pt===p.marginL||pt===(p.pageW-p.marginR);
    a.push({v:pt*S.natW/p.pageW,tag:isM?"margin":"col"}); });
  if(S.edgesOn) detectEdges(S.page).x.forEach(v=>a.push({v,tag:"edge"}));
  for(const b of S.boxes[S.page]) if(!excl.has(b.id)&&!b.hidden){ a.push({v:b.x,tag:"frame"},{v:b.x+b.w,tag:"frame"}); }
  return a; }
function yCandsT(excl){ const p=P(),a=[];
  marginYPts().forEach(pt=>a.push({v:pt*S.natH/p.pageH,tag:"margin"}));
  if(S.edgesOn) detectEdges(S.page).y.forEach(v=>a.push({v,tag:"edge"}));
  for(const b of S.boxes[S.page]) if(!excl.has(b.id)&&!b.hidden){ a.push({v:b.y,tag:"frame"},{v:b.y+b.h,tag:"frame"}); }
  return a; }
function snapT(v,cands){ const thr=10/scale(); let best=null,bd=thr;
  for(const c of cands){ const d=Math.abs(c.v-v); if(d<bd){bd=d;best=c;} } return best; }

function detectEdges(idx){
  if(edgeCache[idx]) return edgeCache[idx];
  const out={x:[],y:[]};
  try{
    const sw=Math.min(520,S.natW), s=sw/S.natW, cw=Math.round(S.natW*s), ch=Math.round(S.natH*s);
    const c=document.createElement("canvas"); c.width=cw; c.height=ch;
    const ctx=c.getContext("2d",{willReadFrequently:true}); ctx.drawImage(img,0,0,cw,ch);
    const d=ctx.getImageData(0,0,cw,ch).data;
    const rc=new Float32Array(ch), cc=new Float32Array(cw);
    for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){ const i=(y*cw+x)*4, r=d[i],g=d[i+1],b=d[i+2];
      const gray=0.299*r+0.587*g+0.114*b, sat=Math.max(r,g,b)-Math.min(r,g,b);
      if(gray<200||sat>45){ rc[y]++; cc[x]++; } }
    for(let y=0;y<ch;y++) rc[y]/=cw; for(let x=0;x<cw;x++) cc[x]/=ch;
    const smooth=(v,w)=>{ w=Math.max(3,w|1); const h=(w-1)/2,o=new Float32Array(v.length);
      for(let i=0;i<v.length;i++){ let sm=0,n=0; for(let k=-h;k<=h;k++){ const j=i+k; if(j>=0&&j<v.length){sm+=v[j];n++;} } o[i]=sm/n; } return o; };
    const band=(sm,thr)=>{ const e=[]; for(let i=1;i<sm.length;i++) if((sm[i-1]>thr)!==(sm[i]>thr)) e.push(i); return e; };
    const ys=band(smooth(rc,Math.round(0.012*ch)),0.04), xs=band(smooth(cc,Math.round(0.012*cw)),0.04);
    for(let i=2;i<ch-2;i++) if(rc[i]>0.5&&rc[i-2]<0.25&&rc[i+2]<0.25) ys.push(i);
    const merge=(v,tol)=>{ v=[...new Set(v.map(Math.round))].sort((a,b)=>a-b); const o=[];
      for(const x of v) if(!o.length||x-o[o.length-1]>tol) o.push(x); return o; };
    out.x=merge(xs,4).map(v=>v/s); out.y=merge(ys,4).map(v=>v/s);
  }catch(e){ /* tainted canvas (file://) or not ready — snapping still works on grid+frames */ }
  edgeCache[idx]=out; return out;
}

/* ============================================================ selection */
const isSel=id=>S.sel.includes(id);
const selBoxes=()=>S.boxes[S.page].filter(b=>isSel(b.id));
function setSel(ids,primary){ S.sel=ids.slice(); S.primary=primary!=null?primary:(ids[ids.length-1]??null); }
function toggleSel(id){ const i=S.sel.indexOf(id);
  if(i>=0){ S.sel.splice(i,1); if(S.primary===id) S.primary=S.sel[S.sel.length-1]??null; }
  else { S.sel.push(id); S.primary=id; } }
function clearSel(){ S.sel=[]; S.primary=null; }

/* ============================================================ undo/redo */
function snapshot(){ S.undo[S.page].push(JSON.stringify(S.boxes[S.page].map(normBox)));
  if(S.undo[S.page].length>80) S.undo[S.page].shift(); S.redo[S.page]=[]; }
function restore(str){ S.boxes[S.page]=JSON.parse(str).map(b=>({id:S.uid++,...b})); clearSel(); }
function undo(){ const u=S.undo[S.page]; if(!u.length) return;
  S.redo[S.page].push(JSON.stringify(S.boxes[S.page].map(normBox))); restore(u.pop()); renderAll(); save(); }
function redo(){ const r=S.redo[S.page]; if(!r.length) return;
  S.undo[S.page].push(JSON.stringify(S.boxes[S.page].map(normBox))); restore(r.pop()); renderAll(); save(); }

/* ============================================================ rendering */
function renderAll(){ computeSnaps(); renderBoxes(); renderGrid(); renderLayers(); renderInspector(); renderStatus(); }
function renderBoxes(){
  [...canvas.querySelectorAll(".box")].forEach(e=>e.remove());
  const k=scale(), single=S.sel.length===1;
  for(const b of S.boxes[S.page]){
    if(b.hidden) continue;
    const d=document.createElement("div");
    d.className="box"+(isSel(b.id)?" sel":"")+(b.locked?" locked":"")+(b.id===S.hover?" hover":"");
    d.style.setProperty("--c",colorOf(b.cls)); d.style.setProperty("--cf",colorOf(b.cls)+"2b");
    d.style.left=(b.x*k)+"px"; d.style.top=(b.y*k)+"px";
    d.style.width=(b.w*k)+"px"; d.style.height=(b.h*k)+"px"; d.dataset.id=b.id;
    const tag=document.createElement("div"); tag.className="tag";
    tag.textContent=labelOf(b.cls)+(b.role?" · "+b.role.toUpperCase():"");
    d.appendChild(tag);
    if(b.locked){ const lk=document.createElement("div"); lk.className="lk"; lk.textContent="🔒"; d.appendChild(lk); }
    if(single&&isSel(b.id)&&!b.locked) for(const h of ["nw","ne","sw","se","n","s","e","w"]){
      const g=document.createElement("div"); g.className="hnd "+h; g.dataset.handle=h; d.appendChild(g); }
    canvas.appendChild(d);
  }
}
function renderGrid(){
  const g=$("#grid"); g.className=S.grid?"on":""; g.innerHTML="";
  if(!S.grid) return;
  const p=P(),cw=img.clientWidth,ch=img.clientHeight;
  const xs=gridXPts();
  for(let i=0;i<xs.length;i++){ const pt=xs[i], isM=pt===p.marginL||pt===(p.pageW-p.marginR);
    const d=document.createElement("div"); d.className="gl v"+(isM?" m":"");
    d.style.left=(pt*cw/p.pageW)+"px"; g.appendChild(d);
    if(i%2===0&&i+1<xs.length){ const col=document.createElement("div"); col.className="gl v col";
      col.style.left=(pt*cw/p.pageW)+"px"; col.style.width=((xs[i+1]-pt)*cw/p.pageW)+"px"; g.appendChild(col); } }
  for(const pt of marginYPts()){ const d=document.createElement("div"); d.className="gl h m";
    d.style.top=(pt*ch/p.pageH)+"px"; g.appendChild(d); }
}
function showGuide(el,pos,axis,tag){
  if(pos==null){ el.style.display="none"; return; }
  el.style.display="block";
  if(axis==="x") el.style.left=(pos*scale())+"px"; else el.style.top=(pos*scale())+"px";
  el.querySelector(".glab").textContent = tag||"";
}
function clearGuides(){ $("#gx").style.display="none"; $("#gy").style.display="none"; }
function showHud(text,ix,iy){ const h=$("#hud"),k=scale();
  h.style.display="block"; h.textContent=text;
  h.style.left=(ix*k)+"px"; h.style.top=(Math.max(iy,0)*k-6)+"px"; }
const hideHud=()=>$("#hud").style.display="none";

/* ---------------- layers ---------------- */
function renderLayers(){
  const list=$("#layerList"); list.innerHTML="";
  const boxes=S.boxes[S.page];
  $("#frameCount").textContent = boxes.length?("· "+boxes.length):"";
  if(!boxes.length){ list.innerHTML='<div class="empty">No frames yet.<br>Drag on the page to draw one.</div>'; return; }
  for(let i=boxes.length-1;i>=0;i--){ const b=boxes[i];  // front (last) on top
    const row=document.createElement("div");
    row.className="layer"+(isSel(b.id)?" sel":"")+(b.hidden?" hidden":"");
    const pw=Math.round(pxToPtW(b.w)), ph=Math.round(pxToPtH(b.h));
    row.innerHTML=`<button class="lbtn eye${b.hidden?" on":""}" title="Show/hide">${b.hidden?"◌":"◉"}</button>`
      +`<i style="background:${colorOf(b.cls)}"></i>`
      +`<span class="nm"><b>${labelOf(b.cls)}</b>${b.role?" "+b.role:""}<small>${pw}×${ph}</small></span>`
      +`<button class="lbtn lock${b.locked?" on":""}" title="Lock">${b.locked?"🔒":"🔓"}</button>`
      +`<button class="lbtn del" title="Delete">✕</button>`;
    row.onclick=e=>{ if(e.target.closest(".lbtn"))return;
      if(e.shiftKey) toggleSel(b.id); else setSel([b.id],b.id); renderAll(); };
    row.querySelector(".eye").onclick=()=>{ snapshot(); b.hidden=!b.hidden; if(b.hidden&&isSel(b.id)) clearSel(); renderAll(); save(); };
    row.querySelector(".lock").onclick=()=>{ snapshot(); b.locked=!b.locked; renderAll(); save(); };
    row.querySelector(".del").onclick=()=>{ snapshot(); S.boxes[S.page]=boxes.filter(x=>x.id!==b.id);
      if(isSel(b.id)) clearSel(); renderAll(); save(); };
    row.onmouseenter=()=>{ if(!drag){ S.hover=b.id; renderBoxes(); } };
    row.onmouseleave=()=>{ if(S.hover===b.id){ S.hover=null; renderBoxes(); } };
    list.appendChild(row);
  }
}

/* ---------------- inspector ---------------- */
function selSig(){ return S.sel.length===0?"none":S.sel.length===1?("one:"+S.sel[0]):("multi:"+S.sel.length); }
function renderInspector(){
  const sig=selSig();
  if(sig===S.inspFor && document.activeElement && document.activeElement.closest("#inspector")){
    syncInspectorValues(); return; }
  S.inspFor=sig; const ins=$("#inspector"); ins.innerHTML="";
  if(S.sel.length===0){ ins.innerHTML='<div class="empty">Nothing selected.<br>Pick a block type at left, then drag on the page.</div>'; return; }
  if(S.sel.length>1){ renderMultiInspector(ins); return; }
  const b=boxById(S.primary)||selBoxes()[0]; if(!b){ ins.innerHTML=""; return; }
  const roles=rolesFor(b.cls);
  const typeOpts=TYPES.map(t=>`<option value="${t.id}"${t.id===b.cls?" selected":""}>${t.label}</option>`).join("");
  ins.innerHTML=`
    <div class="paneTitle">Inspector</div>
    <div class="field"><label>Type</label><select id="iType">${typeOpts}</select></div>
    ${roles?`<div class="field" style="margin-top:9px"><label>Editorial role</label>
      <select id="iRole">${roles.map(r=>`<option value="${r}"${r===b.role?" selected":""}>${r}</option>`).join("")}</select></div>`:""}
    <div class="xy" style="margin-top:11px">
      <div class="numwrap"><span>X</span><input id="iX" type="number" step="1"><em class="u">pt</em></div>
      <div class="numwrap"><span>Y</span><input id="iY" type="number" step="1"><em class="u">pt</em></div>
      <div class="numwrap"><span>W</span><input id="iW" type="number" step="1"><em class="u">pt</em></div>
      <div class="numwrap"><span>H</span><input id="iH" type="number" step="1"><em class="u">pt</em></div>
    </div>
    <div class="inspRow">
      <button id="iFront" title="Bring to front">Front</button>
      <button id="iBack" title="Send to back">Back</button>
      <button id="iDup" title="Duplicate (⌘D)">Duplicate</button>
      <button id="iDel" title="Delete (Del)">Delete</button>
    </div>`;
  syncInspectorValues();
  $("#iType").onchange=e=>setClass(e.target.value);
  const rl=$("#iRole"); if(rl) rl.onchange=e=>{ snapshot(); b.role=e.target.value; S.defaultRole[b.cls]=e.target.value; savePrefs(); renderBoxes(); renderLayers(); save(); };
  bindNum("#iX",v=>{b.x=clamp(ptToPxX(v),0,S.natW-b.w);});
  bindNum("#iY",v=>{b.y=clamp(ptToPxY(v),0,S.natH-b.h);});
  bindNum("#iW",v=>{b.w=clamp(ptToPxW(v),4,S.natW-b.x);});
  bindNum("#iH",v=>{b.h=clamp(ptToPxH(v),4,S.natH-b.y);});
  $("#iFront").onclick=()=>zorder(b,1); $("#iBack").onclick=()=>zorder(b,-1);
  $("#iDup").onclick=()=>duplicate(); $("#iDel").onclick=()=>deleteSel();
}
function syncInspectorValues(){ const b=boxById(S.primary)||selBoxes()[0]; if(!b) return;
  const set=(id,val)=>{ const el=$(id); if(el&&el!==document.activeElement) el.value=Math.round(val); };
  set("#iX",pxToPtX(b.x)); set("#iY",pxToPtY(b.y)); set("#iW",pxToPtW(b.w)); set("#iH",pxToPtH(b.h)); }
function bindNum(sel,apply){ const el=$(sel); let began=false;
  el.onfocus=()=>{ began=false; };
  el.oninput=()=>{ const v=parseFloat(el.value); if(isNaN(v))return;
    if(!began){ snapshot(); began=true; } apply(v); renderBoxes(); renderStatus(); };
  el.onchange=()=>{ began=false; renderLayers(); save(); }; }
function renderMultiInspector(ins){
  ins.innerHTML=`<div class="paneTitle">Inspector</div>
    <div class="selcount">${S.sel.length} frames selected</div>
    <div class="align" style="margin-top:10px">
      <button data-al="l" title="Align left">⇤</button><button data-al="ch" title="Align h-center">⇔</button><button data-al="r" title="Align right">⇥</button>
      <button data-al="t" title="Align top">⤒</button><button data-al="cv" title="Align v-center">⇕</button><button data-al="b" title="Align bottom">⤓</button>
    </div>
    <div class="inspRow">
      <button data-al="dh" ${S.sel.length<3?"disabled":""} title="Distribute horizontally">Distribute →</button>
      <button data-al="dv" ${S.sel.length<3?"disabled":""} title="Distribute vertically">Distribute ↓</button>
    </div>
    <div class="inspRow"><button id="iDup">Duplicate</button><button id="iDel">Delete</button></div>`;
  ins.querySelectorAll("[data-al]").forEach(btn=>btn.onclick=()=>align(btn.dataset.al));
  $("#iDup").onclick=()=>duplicate(); $("#iDel").onclick=()=>deleteSel();
}
function zorder(b,dir){ snapshot(); const arr=S.boxes[S.page]; const i=arr.indexOf(b); arr.splice(i,1);
  if(dir>0) arr.push(b); else arr.unshift(b); renderAll(); save(); }

/* ---------------- status ---------------- */
function renderStatus(){
  const p=P(); const cx0=ptToPxX(0),cy0=ptToPxY(0),cx1=ptToPxX(p.pageW-p.marginL-p.marginR),cy1=ptToPxY(p.pageH-p.marginT-p.marginB);
  const cArea=Math.max(1,(cx1-cx0)*(cy1-cy0));
  let covered=0, overlaps=0; const bs=S.boxes[S.page].filter(b=>!b.hidden);
  for(const b of bs){ const ix0=Math.max(b.x,cx0),iy0=Math.max(b.y,cy0),ix1=Math.min(b.x+b.w,cx1),iy1=Math.min(b.y+b.h,cy1);
    if(ix1>ix0&&iy1>iy0) covered+=(ix1-ix0)*(iy1-iy0); }
  for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++){ const a=bs[i],c=bs[j];
    if(a.x<c.x+c.w&&c.x<a.x+a.w&&a.y<c.y+c.h&&c.y<a.y+a.h) overlaps++; }
  const pct=Math.min(999,Math.round(covered/cArea*100));
  $("#covBar").style.width=Math.min(100,pct)+"%"; $("#stCov").textContent=pct+"%";
  $("#stOverlap").innerHTML = overlaps?`<span class="warnpill">⚠ ${overlaps} overlap${overlaps>1?"s":""}</span>`:`<span class="okpill">✓ no overlaps</span>`;
  $("#coverageHint").textContent = `${bs.length} frame${bs.length===1?"":"s"} · ${pct}% of content covered`;
}

/* ============================================================ interaction */
let drag=null, panning=null;
canvas.addEventListener("pointerdown",ev=>{
  if(ev.button!==0) return;
  if(S.space){ startPan(ev); return; }
  ev.preventDefault(); canvas.setPointerCapture(ev.pointerId);
  const p=toImg(ev);
  const handle=ev.target.dataset&&ev.target.dataset.handle;
  const boxEl=ev.target.closest&&ev.target.closest(".box");
  if(handle&&boxEl){ const b=boxById(+boxEl.dataset.id); if(!b||b.locked)return;
    setSel([b.id],b.id); snapshot();
    drag={mode:"resize",handle,box:b,orig:{...b},sx:p.x,sy:p.y,moved:false}; renderBoxes(); return; }
  if(boxEl){ const id=+boxEl.dataset.id, b=boxById(id);
    if(ev.shiftKey){ toggleSel(id); drag=null; renderAll(); return; }
    if(!isSel(id)) setSel([id],id); else S.primary=id;
    renderAll();
    if(b.locked){ drag=null; return; }
    snapshot(); drag={mode:"move",box:b,origs:selBoxes().map(x=>({id:x.id,x:x.x,y:x.y,w:x.w,h:x.h})),sx:p.x,sy:p.y,moved:false};
    return; }
  // empty space
  if(ev.altKey){ drag={mode:"marquee",sx:p.x,sy:p.y,add:ev.shiftKey,base:ev.shiftKey?S.sel.slice():[]}; return; }
  snapshot();
  let sx0=p.x,sy0=p.y;
  if(snapActive(ev)){ const a=snapT(p.x,xCandsT(new Set())); if(a)sx0=a.v;
                      const c=snapT(p.y,yCandsT(new Set())); if(c)sy0=c.v; }
  const nb={id:S.uid++,x:sx0,y:sy0,w:0,h:0,cls:S.active};
  const rr=rolesFor(S.active); if(rr) nb.role=S.defaultRole[S.active]||rr[0];
  S.boxes[S.page].push(nb); setSel([nb.id],nb.id);
  drag={mode:"draw",box:nb,sx:sx0,sy:sy0,moved:false}; renderBoxes();
});
canvas.addEventListener("pointermove",ev=>{
  cursorReadout(ev);
  if(panning){ doPan(ev); return; }
  if(!drag) return;
  const p=toImg(ev), dx=p.x-drag.sx, dy=p.y-drag.sy;
  if(Math.abs(dx)>2||Math.abs(dy)>2) drag.moved=true;
  const snapOn=snapActive(ev); let gX=null,gY=null,tX="",tY="";
  if(drag.mode==="marquee"){ updateMarquee(drag.sx,drag.sy,p.x,p.y); return; }
  const b=drag.box, excl=new Set(S.sel);
  if(drag.mode==="draw"){
    let qx=p.x,qy=p.y;
    if(snapOn){ const a=snapT(qx,xCandsT(new Set([b.id]))); if(a){qx=a.v;gX=a.v;tX=a.tag;}
                const c=snapT(qy,yCandsT(new Set([b.id]))); if(c){qy=c.v;gY=c.v;tY=c.tag;} }
    b.x=Math.min(drag.sx,qx); b.y=Math.min(drag.sy,qy); b.w=Math.abs(qx-drag.sx); b.h=Math.abs(qy-drag.sy);
    showHud(`${Math.round(pxToPtW(b.w))} × ${Math.round(pxToPtH(b.h))} pt`,b.x,b.y);
  } else if(drag.mode==="move"){
    let ddx=dx,ddy=dy;
    for(const o of drag.origs){ ddx=clamp(ddx,-o.x,S.natW-o.w-o.x); ddy=clamp(ddy,-o.y,S.natH-o.h-o.y); }
    if(snapOn){ const pr=drag.origs.find(o=>o.id===S.primary)||drag.origs[0];
      const xC=xCandsT(excl),yC=yCandsT(excl);
      const nl=pr.x+ddx,nr=pr.x+pr.w+ddx, sL=snapT(nl,xC),sR=snapT(nr,xC);
      if(sL&&(!sR||Math.abs(sL.v-nl)<=Math.abs(sR.v-nr))){ ddx+=sL.v-nl; gX=sL.v; tX=sL.tag; }
      else if(sR){ ddx+=sR.v-nr; gX=sR.v; tX=sR.tag; }
      for(const o of drag.origs) ddx=clamp(ddx,-o.x,S.natW-o.w-o.x);
      const nt=pr.y+ddy,nb=pr.y+pr.h+ddy, sT=snapT(nt,yC),sB=snapT(nb,yC);
      if(sT&&(!sB||Math.abs(sT.v-nt)<=Math.abs(sB.v-nb))){ ddy+=sT.v-nt; gY=sT.v; tY=sT.tag; }
      else if(sB){ ddy+=sB.v-nb; gY=sB.v; tY=sB.tag; }
      for(const o of drag.origs) ddy=clamp(ddy,-o.y,S.natH-o.h-o.y);
    }
    for(const o of drag.origs){ const bb=boxById(o.id); bb.x=o.x+ddx; bb.y=o.y+ddy; }
    showHud(`${Math.round(pxToPtX(b.x))}, ${Math.round(pxToPtY(b.y))} pt`,b.x,b.y);
  } else if(drag.mode==="resize"){
    const o=drag.orig,h=drag.handle; let x0=o.x,y0=o.y,x1=o.x+o.w,y1=o.y+o.h;
    if(h.includes("w"))x0=clamp(o.x+dx,0,x1-6); if(h.includes("e"))x1=clamp(o.x+o.w+dx,x0+6,S.natW);
    if(h.includes("n"))y0=clamp(o.y+dy,0,y1-6); if(h.includes("s"))y1=clamp(o.y+o.h+dy,y0+6,S.natH);
    if(snapOn){ const xC=xCandsT(excl),yC=yCandsT(excl);
      if(h.includes("w")){ const s=snapT(x0,xC); if(s){x0=s.v;gX=s.v;tX=s.tag;} }
      if(h.includes("e")){ const s=snapT(x1,xC); if(s){x1=s.v;gX=s.v;tX=s.tag;} }
      if(h.includes("n")){ const s=snapT(y0,yC); if(s){y0=s.v;gY=s.v;tY=s.tag;} }
      if(h.includes("s")){ const s=snapT(y1,yC); if(s){y1=s.v;gY=s.v;tY=s.tag;} } }
    b.x=x0;b.y=y0;b.w=x1-x0;b.h=y1-y0;
    showHud(`${Math.round(pxToPtW(b.w))} × ${Math.round(pxToPtH(b.h))} pt`,b.x,b.y);
  }
  showGuide($("#gx"),gX,"x",tX); showGuide($("#gy"),gY,"y",tY);
  renderBoxes(); renderStatus();
});
canvas.addEventListener("pointerup",ev=>{
  if(panning){ endPan(); return; }
  if(!drag) return;
  if(drag.mode==="marquee"){ finalizeMarquee(); hideMarquee(); drag=null; renderAll(); return; }
  clearGuides(); hideHud();
  const b=drag.box;
  if(drag.mode==="draw"&&(b.w<8||b.h<8)){ S.boxes[S.page]=S.boxes[S.page].filter(x=>x.id!==b.id);
    if(!drag.moved) clearSel(); }
  drag=null; renderAll(); save();
});
function toImg(ev){ const r=canvas.getBoundingClientRect(),k=scale();
  return {x:clamp((ev.clientX-r.left)/k,0,S.natW),y:clamp((ev.clientY-r.top)/k,0,S.natH)}; }
function cursorReadout(ev){ const p=toImg(ev);
  $("#stCursor").textContent=`${Math.round(pxToPtX(p.x))}, ${Math.round(pxToPtY(p.y))} pt`; }

/* marquee */
function updateMarquee(x0,y0,x1,y1){ const m=$("#marquee"),k=scale();
  const l=Math.min(x0,x1),t=Math.min(y0,y1),w=Math.abs(x1-x0),h=Math.abs(y1-y0);
  m.style.display="block"; m.style.left=(l*k)+"px"; m.style.top=(t*k)+"px";
  m.style.width=(w*k)+"px"; m.style.height=(h*k)+"px"; drag._rect=[l,t,l+w,t+h]; }
function hideMarquee(){ $("#marquee").style.display="none"; }
function finalizeMarquee(){ const rc=drag._rect; if(!rc){ if(!drag.add)clearSel(); return; }
  const [x0,y0,x1,y1]=rc; const hit=S.boxes[S.page].filter(b=>!b.hidden&&
    b.x<x1&&x0<b.x+b.w&&b.y<y1&&y0<b.y+b.h).map(b=>b.id);
  const set=drag.add?[...new Set([...drag.base,...hit])]:hit;
  setSel(set,set[set.length-1]); }

/* pan */
function startPan(ev){ canvas.setPointerCapture(ev.pointerId); canvas.classList.add("panning");
  panning={sx:ev.clientX,sy:ev.clientY,l:stage.scrollLeft,t:stage.scrollTop}; }
function doPan(ev){ stage.scrollLeft=panning.l-(ev.clientX-panning.sx); stage.scrollTop=panning.t-(ev.clientY-panning.sy); }
function endPan(){ canvas.classList.remove("panning"); panning=null; }

/* ============================================================ class / ops */
function setClass(c){ if(!c)return; S.active=c; paletteActive();
  const sel=selBoxes();
  if(sel.length){ snapshot(); for(const b of sel){ if(b.cls!==c){ b.cls=c; const rr=rolesFor(c);
    if(rr){ if(!b.role)b.role=S.defaultRole[c]||rr[0]; } else delete b.role; } } renderAll(); save(); }
  else renderInspector();
}
function deleteSel(){ if(!S.sel.length)return; snapshot();
  S.boxes[S.page]=S.boxes[S.page].filter(b=>!isSel(b.id)||b.locked);
  clearSel(); renderAll(); save(); }
function duplicate(){ if(!S.sel.length)return; copySel(); paste(true); }
function copySel(){ S.clip=selBoxes().map(normBox); if(S.clip.length) toast(S.clip.length+" copied"); }
function paste(offset){ if(!S.clip.length)return; snapshot();
  const off=offset?ptToPxW(12):0, ids=[];
  for(const c of S.clip){ const nb={id:S.uid++,...normBox(c),x:clamp(c.x+off,0,S.natW-c.w),y:clamp(c.y+off,0,S.natH-c.h)};
    delete nb.locked; delete nb.hidden; S.boxes[S.page].push(nb); ids.push(nb.id); }
  setSel(ids,ids[ids.length-1]); renderAll(); save(); }
function align(op){ const bs=selBoxes(); if(bs.length<2)return; snapshot();
  const L=Math.min(...bs.map(b=>b.x)), R=Math.max(...bs.map(b=>b.x+b.w));
  const T=Math.min(...bs.map(b=>b.y)), B=Math.max(...bs.map(b=>b.y+b.h));
  const CX=(L+R)/2, CY=(T+B)/2;
  if(op==="l") bs.forEach(b=>b.x=L);
  else if(op==="r") bs.forEach(b=>b.x=R-b.w);
  else if(op==="ch") bs.forEach(b=>b.x=CX-b.w/2);
  else if(op==="t") bs.forEach(b=>b.y=T);
  else if(op==="b") bs.forEach(b=>b.y=B-b.h);
  else if(op==="cv") bs.forEach(b=>b.y=CY-b.h/2);
  else if(op==="dh"){ const s=[...bs].sort((a,c)=>a.x-c.x); const tot=R-L, sw=s.reduce((n,b)=>n+b.w,0);
    const gap=(tot-sw)/(s.length-1); let x=L; s.forEach(b=>{b.x=x;x+=b.w+gap;}); }
  else if(op==="dv"){ const s=[...bs].sort((a,c)=>a.y-c.y); const tot=B-T, sh=s.reduce((n,b)=>n+b.h,0);
    const gap=(tot-sh)/(s.length-1); let y=T; s.forEach(b=>{b.y=y;y+=b.h+gap;}); }
  renderAll(); save();
}
function nudge(dx,dy){ const bs=selBoxes(); if(!bs.length)return; snapshot();
  for(const b of bs){ if(b.locked)continue; b.x=clamp(b.x+dx,0,S.natW-b.w); b.y=clamp(b.y+dy,0,S.natH-b.h); }
  renderAll(); save(); }

/* ============================================================ export / import */
function exportData(){
  const p=P(); const cW=p.pageW-p.marginL-p.marginR, cH=p.pageH-p.marginT-p.marginB;
  const g=gridDef();
  const out={ kind:"newswell-block-annotations", schemaVersion:1,
    source:S.project.source||S.project.title, paper:S.paperId,
    pageWidth:cW, pageHeight:cH, gridColumns:Array(g.columns).fill(g.colWidthPts), gutterPts:g.gutterPts,
    pages:{} };
  for(let i=0;i<NPAGES;i++){ out.pages[pageKey(i)]={ blocks:S.boxes[i].map(b=>{
    const kind=kindOf(b.cls);
    const blk={ id:Math.random().toString(36).slice(2,10), kind,
      x:r1(b.x*p.pageW/S.natW-p.marginL), y:r1(b.y*p.pageH/S.natH-p.marginT),
      width:r1(b.w*p.pageW/S.natW), height:r1(b.h*p.pageH/S.natH) };
    if(b.role&&(kind==="editorial")) blk.role=b.role;
    if(kind==="what-inside") blk.whatsInside={showPageNumbers:true};
    return blk; })}; }
  return out;
}
function download(name,text){ const b=new Blob([text],{type:"application/json"});
  const u=URL.createObjectURL(b),a=document.createElement("a"); a.href=u; a.download=name; a.click(); URL.revokeObjectURL(u); }
function importJson(obj){
  // accept our export (points, content-relative) OR internal px format
  if(obj&&obj.pages&&obj.kind==="newswell-block-annotations"){ const p=P();
    for(let i=0;i<NPAGES;i++){ const pg=obj.pages[pageKey(i)]; if(!pg)continue;
      S.boxes[i]=(pg.blocks||[]).map(bl=>{ const cls=(TYPES.find(t=>t.kind===bl.kind)||{}).id||"article";
        const b={id:S.uid++,cls, x:(bl.x+p.marginL)*S.natW/p.pageW, y:(bl.y+p.marginT)*S.natH/p.pageH,
          w:bl.width*S.natW/p.pageW, h:bl.height*S.natH/p.pageH}; if(bl.role)b.role=bl.role; return b; }); }
    clearSel(); renderAll(); save(); toast("Imported NewsWell JSON"); return; }
  toast("Unrecognized JSON format");
}
function renderOverlayPNG(){ // burn current page's frames onto the image → download PNG
  const c=document.createElement("canvas"); c.width=S.natW; c.height=S.natH;
  const ctx=c.getContext("2d"); ctx.drawImage(img,0,0,S.natW,S.natH);
  const bw=Math.max(4,S.natW/240);
  const sorted=[...S.boxes[S.page]].filter(b=>!b.hidden).sort((a,b)=>b.w*b.h-a.w*a.h);
  for(const b of sorted){ ctx.fillStyle=colorOf(b.cls)+"38"; ctx.fillRect(b.x,b.y,b.w,b.h); }
  for(const b of sorted){ ctx.strokeStyle=colorOf(b.cls); ctx.lineWidth=bw;
    ctx.strokeRect(b.x+bw/2,b.y+bw/2,b.w-bw,b.h-bw);
    const tag=labelOf(b.cls)+(b.role?" · "+b.role.toUpperCase():""); ctx.font="bold "+Math.max(20,S.natW/54)+"px sans-serif";
    const tw=ctx.measureText(tag).width, th=Math.max(20,S.natW/54);
    ctx.fillStyle=colorOf(b.cls); ctx.fillRect(b.x,b.y,tw+18,th+12);
    ctx.fillStyle="#fff"; ctx.textBaseline="top"; ctx.fillText(tag,b.x+9,b.y+6); }
  c.toBlob(bl=>{ const u=URL.createObjectURL(bl),a=document.createElement("a");
    a.href=u; a.download=pageKey(S.page)+"-overlay.png"; a.click(); URL.revokeObjectURL(u); });
}

/* ============================================================ new project from images */
function newFromFiles(files,append){
  const list=[...files].filter(f=>f.type.startsWith("image/"))
    .sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  if(!list.length){ toast("No image files"); return; }
  let done=0; const pages= append?S.project.pages.slice():[];
  const startIdx=pages.length;
  const anns= append?collectAnnotations():{};
  list.forEach((f,k)=>{ const rd=new FileReader();
    rd.onload=()=>{ pages[startIdx+k]={name:f.name.replace(/\.[^.]+$/,""),src:rd.result};
      if(++done===list.length){
        const pr= append? {...S.project,pages,annotations:anns}
          : { id:"proj-"+Math.random().toString(36).slice(2,8), title:"Untitled project",
              source:"", paperId:S.paperId||Object.keys(PAPERS)[0], pages, annotations:{} };
        loadProject(pr); persist();
        toast((append?"Added ":"New project · ")+list.length+" page"+(list.length>1?"s":"")); } };
    rd.readAsDataURL(f); });
}

/* ============================================================ misc UI */
let toastT=null;
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("on");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),1700); }
function updateToggleUI(){ $("#snapToggle").classList.toggle("on",S.snap);
  $("#edgeToggle").classList.toggle("on",S.edgesOn);
  $("#gridToggle").classList.toggle("on",S.grid);
  $("#gridCols").textContent=S.gridMode+"-col"; $("#gridCols").classList.toggle("on",S.gridMode!==(P().defaultGrid||"4")); }
const openOverlay =id=>$(id).classList.add("on");
const closeOverlay=id=>$(id).classList.remove("on");

/* ============================================================ wire up */
function bindUI(){
  $("#prev").onclick=()=>{ persist(); showPage(S.page-1); };
  $("#next").onclick=()=>{ persist(); showPage(S.page+1); };
  $("#projTitle").onchange=save;
  $("#paperSel").onchange=e=>{ S.paperId=e.target.value; S.paper=PAPERS[S.paperId];
    if(!S.paper.grids[S.gridMode]) S.gridMode=S.paper.defaultGrid||Object.keys(S.paper.grids)[0];
    updateToggleUI(); renderAll(); save(); };
  $("#gridToggle").onclick=()=>{ S.grid=!S.grid; updateToggleUI(); renderGrid(); savePrefs(); };
  $("#gridCols").onclick=cycleGrid;
  $("#snapToggle").onclick=()=>{ S.snap=!S.snap; updateToggleUI(); savePrefs(); };
  $("#edgeToggle").onclick=()=>{ S.edgesOn=!S.edgesOn; edgeCache={}; updateToggleUI(); renderAll(); savePrefs(); };
  $("#clearPage").onclick=()=>{ if(!S.boxes[S.page].length)return;
    if(!confirm("Delete all "+S.boxes[S.page].length+" frames on this page?"))return;
    snapshot(); S.boxes[S.page]=[]; clearSel(); renderAll(); save(); };
  $("#importAuto").onclick=()=>{ const a=S.auto[S.page]||[]; if(!a.length){ toast("No auto blocks for this page"); return; }
    snapshot(); const fb=TYPES[0].id;
    for(const b of a){ let cls=AUTO_MAP[b.cls]||b.cls; if(!COLOR[cls])cls=fb;
      S.boxes[S.page].push({id:S.uid++,x:b.x,y:b.y,w:b.w,h:b.h,cls}); }
    renderAll(); save(); toast("Imported "+a.length+" auto blocks"); };
  $("#exportJson").onclick=()=>download((S.project.id||"annotations")+".newswell.json",JSON.stringify(exportData(),null,2));
  $("#newProj").onclick=()=>$("#fileImgs").dataset.mode="new",$("#fileImgs").click();
  $("#importImgs").onclick=()=>{ $("#fileImgs").dataset.mode="append"; $("#fileImgs").click(); };
  $("#fileImgs").onchange=e=>{ if(e.target.files.length) newFromFiles(e.target.files,$("#fileImgs").dataset.mode==="append"); e.target.value=""; };
  $("#helpBtn").onclick=()=>openOverlay("#help"); $("#helpClose").onclick=()=>closeOverlay("#help");
  $("#help").onclick=e=>{ if(e.target.id==="help")closeOverlay("#help"); };
  $("#menuBtn").onclick=()=>{ $("#mMeta").textContent="Project: "+S.project.title+" · "+NPAGES+" pages · paper "+S.paperId;
    openOverlay("#menu"); };
  $("#menuClose").onclick=()=>closeOverlay("#menu");
  $("#menu").onclick=e=>{ if(e.target.id==="menu")closeOverlay("#menu"); };
  $("#mRender").onclick=()=>{ renderOverlayPNG(); closeOverlay("#menu"); };
  $("#mImportJson").onclick=()=>$("#fileJson").click();
  $("#fileJson").onchange=e=>{ const f=e.target.files[0]; if(!f)return; const rd=new FileReader();
    rd.onload=()=>{ try{ importJson(JSON.parse(rd.result)); closeOverlay("#menu"); }catch(x){ toast("Bad JSON"); } };
    rd.readAsText(f); e.target.value=""; };
  $("#mDupProject").onclick=()=>{ download((S.project.id||"project")+".project.json",JSON.stringify(S.project,null,2)); closeOverlay("#menu"); toast("Project JSON downloaded"); };
  $("#mReset").onclick=()=>{ if(!confirm("Reset to the Beach & Bay sample? Your current project stays in its exported files only."))return;
    localStorage.removeItem(LS_PROJ); loadProject(JSON.parse(JSON.stringify(SAMPLE))); persist(); closeOverlay("#menu"); };
  $("#zoomIn").onclick=()=>zoomAt(1.2,cx(),cy()); $("#zoomOut").onclick=()=>zoomAt(1/1.2,cx(),cy());
  $("#zoomval").onclick=zoomFit;
  stage.addEventListener("wheel",e=>{ if(e.ctrlKey||e.metaKey){ e.preventDefault(); zoomAt(e.deltaY<0?1.1:1/1.1,e.clientX,e.clientY); } },{passive:false});
  addEventListener("resize",()=>layout());
}
const cx=()=>stage.getBoundingClientRect().left+stage.clientWidth/2;
const cy=()=>stage.getBoundingClientRect().top+stage.clientHeight/2;
function cycleGrid(){ const keys=Object.keys(P().grids); const i=keys.indexOf(S.gridMode);
  S.gridMode=keys[(i+1)%keys.length]; updateToggleUI(); if(!S.grid){S.grid=true;updateToggleUI();}
  renderAll(); savePrefs(); }

/* keyboard */
addEventListener("keydown",e=>{
  const typing=e.target.matches&&e.target.matches("input,select,textarea");
  if(e.key==="Escape"){ if($("#help").classList.contains("on"))return closeOverlay("#help");
    if($("#menu").classList.contains("on"))return closeOverlay("#menu");
    if(typing){ e.target.blur(); return; } clearSel(); renderAll(); return; }
  if(typing) return;
  const meta=e.metaKey||e.ctrlKey, k=e.key.toLowerCase();
  if(k===" "){ if(!S.space){ S.space=true; canvas.classList.add("pan"); } e.preventDefault(); return; }
  if(meta){
    if(k==="z"){ e.preventDefault(); e.shiftKey?redo():undo(); }
    else if(k==="a"){ e.preventDefault(); setSel(S.boxes[S.page].filter(b=>!b.hidden).map(b=>b.id)); renderAll(); }
    else if(k==="d"){ e.preventDefault(); duplicate(); }
    else if(k==="c"){ e.preventDefault(); copySel(); }
    else if(k==="v"){ e.preventDefault(); paste(!e.shiftKey); }
    return;
  }
  if(k==="g") toggleAndSave("grid");
  else if(k==="s") toggleAndSave("snap");
  else if(k==="c") cycleGrid();
  else if(BYKEY[k]) setClass(BYKEY[k]);
  else if(k==="delete"||k==="backspace"){ e.preventDefault(); deleteSel(); }
  else if(k===","||k==="["){ persist(); showPage(S.page-1); }
  else if(k==="."||k==="]"){ persist(); showPage(S.page+1); }
  else if(k==="arrowleft"){ if(S.sel.length){ e.preventDefault(); nudge(-ptToPxW(e.shiftKey?10:1),0);} }
  else if(k==="arrowright"){ if(S.sel.length){ e.preventDefault(); nudge(ptToPxW(e.shiftKey?10:1),0);} }
  else if(k==="arrowup"){ if(S.sel.length){ e.preventDefault(); nudge(0,-ptToPxH(e.shiftKey?10:1));} }
  else if(k==="arrowdown"){ if(S.sel.length){ e.preventDefault(); nudge(0,ptToPxH(e.shiftKey?10:1));} }
  else if(k==="+"||k==="="){ zoomAt(1.2,cx(),cy()); }
  else if(k==="-"||k==="_"){ zoomAt(1/1.2,cx(),cy()); }
  else if(k==="0"){ zoomFit(); }
  else if(k==="?"||k==="/"){ openOverlay("#help"); }
});
addEventListener("keyup",e=>{ if(e.key===" "){ S.space=false; canvas.classList.remove("pan"); if(panning)endPan(); } });
function toggleAndSave(which){ if(which==="grid"){ S.grid=!S.grid; renderGrid(); }
  else if(which==="snap"){ S.snap=!S.snap; } updateToggleUI(); savePrefs(); }

/* ============================================================ boot */
async function boot(){
  await loadConfig(); loadPrefs(); buildPalette(); bindUI();
  let pr=null;
  try{ const raw=localStorage.getItem(LS_PROJ); if(raw) pr=JSON.parse(raw); }catch(e){}
  if(!pr||!pr.pages||!pr.pages.length) pr=JSON.parse(JSON.stringify(SAMPLE));
  loadProject(pr); if(!localStorage.getItem(LS_PROJ)) persist();
}
boot();
