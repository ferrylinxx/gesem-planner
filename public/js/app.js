// ── DADES ──────────────────────────────────────────────────────
const CATS={
  esp:{items:['Lideratge i management','Comunicació efectiva','Vendes i negociació','Excel i eines Office','Prevenció de riscos','Atenció al client','Treball en equip','Habilitats digitals','Recursos humans','Finances per no financers','Idiomes','Presentacions efectives']},
  modal:{items:['Presencial','Síncrona online','Híbrida','E-learning asíncron']},
  hsess:{items:['1.5','2','2.5','3','4']},
  torn:{items:['9:30–11:30h','12:00–15:00h','9:00–11:00h','16:00–18:00h','Qualsevol']}
};
// FESTIUS · es popula via /api/bootstrap amb dades calculades al servidor
// Format: { 'YYYY-MM-DD': { nom: 'Sant Joan', tipus: 'autonomic' } }
// Inclou Espanya + Catalunya + Barcelona (3 nivells). Pasqua mòbil calculada
// automàticament. Festius en diumenge omesos (no es traslladen a Espanya).
// Fallback per si el bootstrap falla: festius mínims hard-coded de l'any actual
let FESTIUS = (function fallback(){
  const y = new Date().getFullYear();
  return {
    [y+'-01-01']: { nom: "Cap d'Any", tipus: 'estatal' },
    [y+'-01-06']: { nom: 'Reis', tipus: 'estatal' },
    [y+'-05-01']: { nom: 'Festa del Treball', tipus: 'estatal' },
    [y+'-08-15']: { nom: 'Assumpció', tipus: 'estatal' },
    [y+'-09-11']: { nom: 'Diada', tipus: 'autonomic' },
    [y+'-10-12']: { nom: "Festa Nacional d'Espanya", tipus: 'estatal' },
    [y+'-12-08']: { nom: 'Immaculada', tipus: 'estatal' },
    [y+'-12-25']: { nom: 'Nadal', tipus: 'estatal' },
    [y+'-12-26']: { nom: 'Sant Esteve', tipus: 'autonomic' },
  };
})();
const DISTRIBS={1:[[1],[2],[3],[4],[5]],2:[[2,4],[1,3],[3,5],[1,4],[1,5],[2,5]],3:[[1,3,5],[2,4,5],[1,2,4],[1,3,4],[2,3,5]]};
const DLABELS={'1':'Dilluns','2':'Dimarts','3':'Dimecres','4':'Dijous','5':'Divendres','2,4':'Dm·Dj','1,3':'Dl·Dc','3,5':'Dc·Dv','1,4':'Dl·Dj','1,5':'Dl·Dv','2,5':'Dm·Dv','1,3,5':'Dl·Dc·Dv','2,4,5':'Dm·Dj·Dv','1,2,4':'Dl·Dm·Dj','1,3,4':'Dl·Dc·Dj','2,3,5':'Dm·Dc·Dv'};
const DL=['','Dl','Dm','Dc','Dj','Dv'];
const MONTHS=['Gener','Febrer','Març','Abril','Maig','Juny','Juliol','Agost','Setembre','Octubre','Novembre','Desembre'];
const AV_COLORS=['#1D9E75','#185FA5','#854F0B','#534AB7','#993C1D','#3B6D11','#72243E','#D85A30','#0F6E56','#3C3489'];

let AGENTS=[];
let selectedAgent='';
let preferredFormadorId=null;

let FORMADORS=[];

// ── HELPERS ────────────────────────────────────────────────────
function sd(n,mx){let v=n*2654435761|0;v=((v^(v>>>16))*2246822519|0);return Math.abs(v)%mx;}
function ini(n){return n.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase();}
function toISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fmtD(d){return d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear();}
function parseISO(s){return new Date(s+'T00:00:00');}
function isFest(d){return!!FESTIUS[toISO(d)];}
// Retorna l'objecte {nom, tipus} del festiu d'una data, o null si no és festiu
function getFestiu(d){
  const iso = typeof d === 'string' ? d : toISO(d);
  const f = FESTIUS[iso];
  if (!f) return null;
  // Suportem el format antic (string) per si quedessin caches obsolets
  if (typeof f === 'string') return { nom: f, tipus: 'estatal' };
  return f;
}

// Pinta una petita llista dels festius dins el rang previst del curs
// (~90 dies a partir de la data d'inici). Es crida quan canvia p-inici.
function renderFestiusInfo(){
  const el = document.getElementById('festius-info');
  if (!el) return;
  const iniStr = document.getElementById('p-inici')?.value;
  if (!iniStr) { el.innerHTML = ''; return; }
  const ini = parseISO(iniStr);
  const horizon = new Date(ini); horizon.setDate(horizon.getDate() + 90);
  const matches = Object.entries(FESTIUS)
    .filter(([iso]) => {
      const d = parseISO(iso);
      return d >= ini && d <= horizon;
    })
    .sort()
    .slice(0, 6);
  if (!matches.length) { el.innerHTML = ''; return; }
  const colorByTipus = { estatal:'#0C447C', autonomic:'#085041', local:'#633806' };
  const labelByTipus = { estatal:'ES', autonomic:'CAT', local:'BCN' };
  el.innerHTML = '🇪🇸 Festius pròxims: ' + matches.map(([iso, info]) => {
    const f = typeof info === 'string' ? { nom: info, tipus: 'estatal' } : info;
    const d = parseISO(iso);
    return `<span style="display:inline-block;background:rgba(0,0,0,0.04);border-radius:8px;padding:1px 6px;margin:1px 2px"><strong>${d.getDate()}/${d.getMonth()+1}</strong> ${f.nom} <span style="color:${colorByTipus[f.tipus]};font-size:9px;font-weight:600">${labelByTipus[f.tipus]}</span></span>`;
  }).join('');
}
function daysAgo(iso){return Math.floor((Date.now()-parseISO(iso).getTime())/86400000);}

function makeAv(nom,idx,sz=42){
  const c=document.createElement('canvas');c.width=sz;c.height=sz;
  const x=c.getContext('2d');
  x.fillStyle=AV_COLORS[idx%AV_COLORS.length];
  x.beginPath();x.arc(sz/2,sz/2,sz/2,0,Math.PI*2);x.fill();
  x.fillStyle='rgba(255,255,255,0.15)';x.beginPath();x.arc(sz/2,sz*0.38,sz*0.32,0,Math.PI*2);x.fill();
  x.fillStyle='white';x.font=`500 ${Math.round(sz*0.31)}px sans-serif`;x.textAlign='center';x.textBaseline='middle';
  x.fillText(ini(nom),sz/2,sz/2+1);
  return c.toDataURL();
}

// ── API HELPERS ────────────────────────────────────────────────
async function apiPost(path,data){try{await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}catch(e){console.error('API POST error',e);}}
async function apiPut(path,data){try{await fetch('/api/'+path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}catch(e){console.error('API PUT error',e);}}
async function apiDel(path){try{await fetch('/api/'+path,{method:'DELETE'});}catch(e){console.error('API DEL error',e);}}

let RESERVES=[],bDays=new Set(),exclD=new Set(),selDist=null,calY=2026,calM=3,eFId=-1,openIE={},activeFilter='',currentEmailResId=null,fotoDataURL=null;

// ── DADES DE CALENDARIS EN TEMPS REAL ─────────────────────────────
// calData[id] = { slots:[{date,startMin,endMin}], fullDayDates:Set<isoDate>, syncedAt:ms }
const calData={};
let calDataLoaded=false;
const CAL_CACHE_KEY='gesem.calData.v1';
const CAL_CACHE_TTL=24*60*60*1000; // 24h: després d'això es força fetch fresc

// Persisteix calData a localStorage. Important: serialitzem el Set com a array
// perquè JSON no suporta Sets nativament.
function persistCalData(){
  try{
    const out={};
    Object.entries(calData).forEach(([id,cd])=>{
      out[id]={
        slots:cd.slots||[],
        fullDayDates:[...(cd.fullDayDates||new Set())],
        syncedAt:cd.syncedAt||Date.now(),
      };
    });
    localStorage.setItem(CAL_CACHE_KEY,JSON.stringify(out));
  }catch(e){/* localStorage ple o desactivat — silenci */}
}

// Restaura calData des de localStorage (es crida al carregar la pàgina)
// Així evitem el flicker de "Calendari pendent de sincronitzar" abans que
// loadCalData() acabi de fer el fetch.
function restoreCalDataFromCache(){
  try{
    const raw=localStorage.getItem(CAL_CACHE_KEY);
    if(!raw)return;
    const data=JSON.parse(raw);
    Object.entries(data).forEach(([id,cd])=>{
      // Saltem entrades caducades (>24h sense sync)
      if(cd.syncedAt&&Date.now()-cd.syncedAt>CAL_CACHE_TTL)return;
      calData[id]={
        slots:cd.slots||[],
        fullDayDates:new Set(cd.fullDayDates||[]),
        syncedAt:cd.syncedAt||0,
      };
    });
  }catch(e){/* JSON corrupte: el sobreescriurem al primer save */}
}
// Restaurem immediatament en carregar el script (síncron) per tenir dades
// disponibles abans que renderFP/lf/etc s'executin
restoreCalDataFromCache();

// Mapa de torns a minuts del dia (start/end)
const TORN_MINUTS={
  '9:30–11:30h':  {start:570,  end:690},   // 9h30 - 11h30
  '9:00–11:00h':  {start:540,  end:660},   // 9h00 - 11h00
  '12:00–15:00h': {start:720,  end:900},   // 12h00 - 15h00
  '16:00–18:00h': {start:960,  end:1080},  // 16h00 - 18h00
  'Qualsevol':    {start:480,  end:1200},  // tot el dia laboral
};
function tornToMinuts(torn){
  if(TORN_MINUTS[torn])return TORN_MINUTS[torn];
  // Intentar parsejar formats com "10:00–12:00h"
  const m=torn.match(/(\d{1,2}):(\d{2})[^0-9]+(\d{1,2}):(\d{2})/);
  if(m)return{start:parseInt(m[1])*60+parseInt(m[2]),end:parseInt(m[3])*60+parseInt(m[4])};
  return{start:480,end:1200};
}

// Comprova si un slot de calendari solapa amb una franja horària
function slotsOverlap(slotStart,slotEnd,tornStart,tornEnd){
  return slotStart < tornEnd && slotEnd > tornStart;
}

function hasCalendar(f){return !!(f&&f.icsUrl);}

// Comprova si una data (ISO) és ocupada per al torn indicat
function isDateBusyForTorn(fId, isoDate, torn){
  const cd=calData[fId];
  if(!cd)return false;
  // 1. Dia complet bloquejat (all-day event)
  if(cd.fullDayDates.has(isoDate))return true;
  // 2. Comprovar solapament de franja horària
  const t=tornToMinuts(torn);
  return cd.slots.some(s=>s.date===isoDate && slotsOverlap(s.startMin,s.endMin,t.start,t.end));
}

// Retorna la llista de dates del calendari que estan ocupades en el torn
function calBusyDatesForTorn(fId, dates, torn){
  return dates.filter(d=>isDateBusyForTorn(fId,toISO(d),torn));
}

// Retorna detall per dia: per a cada data, quin motiu hi ha (null=lliure)
function datesBusyDetail(fId, dates, torn, resISO){
  return dates.map(d=>{
    const iso=toISO(d);
    const calBusy=hasCalendar({icsUrl:calData[fId]?'x':''})&&calData[fId]?isDateBusyForTorn(fId,iso,torn):false;
    const gesBusy=resISO.has(iso);
    return{iso,calBusy,gesBusy,busy:calBusy||gesBusy};
  });
}

async function loadCalData(){
  const withCal=FORMADORS.filter(f=>f.icsUrl);
  if(!withCal.length){calDataLoaded=true;return;}
  try{
    await Promise.all(withCal.map(async f=>{
      try{
        const r=await fetch('/api/disponibilitat/'+f.id).then(x=>x.json());
        calData[f.id]={
          slots: r.slots||[],
          fullDayDates: new Set(r.fullDayDates||[]),
          syncedAt: Date.now(),
        };
      }catch(e){
        // Si ja teníem dades en cache de localStorage, NO les sobreescrivim amb buit:
        // és preferible mostrar dades una mica antigues que "pendent de sincronitzar".
        if(!calData[f.id]){
          calData[f.id]={slots:[],fullDayDates:new Set(),syncedAt:0};
        }
      }
    }));
  }finally{
    calDataLoaded=true;
    persistCalData();
  }
}

async function refreshCal(formadorId, opts){
  const silent = opts && opts.silent === true;
  await fetch('/api/disponibilitat/'+formadorId+'/cache',{method:'DELETE'});
  try{
    const r=await fetch('/api/disponibilitat/'+formadorId).then(x=>x.json());
    calData[formadorId]={slots:r.slots||[],fullDayDates:new Set(r.fullDayDates||[]),syncedAt:Date.now()};
    persistCalData();
    if(!silent){
      const total=(r.fullDayDates||[]).length+(r.slots||[]).length;
      toast('📅 Calendari actualitzat · '+total+' events detectats');
    }
  }catch(e){if(!silent)toast('Error actualitzant calendari');}
}

// ── NAVEGACIÓ ───────────────────────────────────────────────────
function gv(id,btn){
  document.querySelectorAll('.vp').forEach(v=>v.classList.remove('act'));
  document.querySelectorAll('.nb').forEach(b=>{b.classList.remove('act');b.classList.remove('act-p');});
  document.getElementById('page-'+id).classList.add('act');
  if(btn)btn.classList.add('act');else{const nb=document.getElementById('nb-'+id);if(nb)nb.classList.add('act');}
  // Actualitzar títol de l'appbar
  const titles={p:'Nova petició',gest:'Gestió de reserves',canvis:'Gestió de canvis',f:'Formadors',entrades:'Entrades de peticions'};
  const t=document.getElementById('appbar-title');if(t&&titles[id])t.textContent=titles[id];
  if(id==='gest')renderGest();
  if(id==='entrades'){renderArxiu();}
  if(id==='f'){renderFP();initFiltreEsp();}
  if(id==='canvis')renderCanvis();
}

// ── CATÀLEGS ────────────────────────────────────────────────────
function fillSels(){
  ['esp','modal','hsess','torn'].forEach(k=>{
    const s=document.getElementById('p-'+k);if(!s)return;
    const cur=s.value;
    s.innerHTML=CATS[k].items.map(v=>`<option value="${v}">${k==='hsess'?v+'h':v}</option>`).join('');
    if(cur&&CATS[k].items.includes(cur))s.value=cur;
  });
  // Formadors selector
  const sf=document.getElementById('p-form-pref');
  if(sf){sf.innerHTML='<option value="">Cap preferència · flux habitual</option>'+FORMADORS.map(f=>`<option value="${f.id}">${f.nom} (${f.specs[0]||'—'})</option>`).join('');}
}

function togIE(cat,btn){
  if(openIE[cat]){document.getElementById('ie-'+cat).innerHTML='';openIE[cat]=false;btn.classList.remove('on');btn.textContent='+';return;}
  Object.keys(openIE).forEach(k=>{if(openIE[k]){document.getElementById('ie-'+k).innerHTML='';openIE[k]=false;const ob=document.querySelector(`.bi[onclick*="'${k}'"]`);if(ob){ob.classList.remove('on');ob.textContent='+'}}});
  openIE[cat]=true;btn.classList.add('on');btn.textContent='×';renderIE(cat);
}
function renderIE(cat){let h='<div class="ie">';CATS[cat].items.forEach((it,i)=>{h+=`<div class="ie-it" id="ie-i-${cat}-${i}"><span>${it}</span><button class="btn-g" style="font-size:10px" onclick="startIEed('${cat}',${i})">editar</button><button class="btn-g" style="color:#A32D2D;font-size:13px" onclick="delIE('${cat}',${i})">×</button></div>`;});h+=`<div class="ie-add"><input type="text" id="ie-n-${cat}" placeholder="Nova..." onkeydown="if(event.key==='Enter')addIE('${cat}')"/><button class="btn btn-p btn-sm" onclick="addIE('${cat}')">+</button></div></div>`;document.getElementById('ie-'+cat).innerHTML=h;}
function startIEed(cat,i){document.getElementById(`ie-i-${cat}-${i}`).innerHTML=`<input type="text" value="${CATS[cat].items[i]}" id="ie-e-${cat}-${i}" style="flex:1;padding:3px 6px;border:0.5px solid #1D9E75;border-radius:4px;background:#fff;color:#1a1a1a;font-size:11px;font-family:inherit" onkeydown="if(event.key==='Enter')saveIEed('${cat}',${i})"/><button class="btn btn-p btn-sm" onclick="saveIEed('${cat}',${i})">OK</button><button class="btn btn-sm" onclick="renderIE('${cat}')">×</button>`;document.getElementById(`ie-e-${cat}-${i}`).focus();}
function saveIEed(cat,i){const el=document.getElementById(`ie-e-${cat}-${i}`);if(!el)return;const v=el.value.trim();if(!v)return;CATS[cat].items[i]=v;apiPut('cats/'+cat,{items:CATS[cat].items});fillSels();renderIE(cat);lf();toast('Actualitzat');}
function addIE(cat){const el=document.getElementById('ie-n-'+cat);const v=el?el.value.trim():'';if(!v||CATS[cat].items.includes(v)){toast(v?'Ja existeix':'Buit');return;}CATS[cat].items.push(v);apiPut('cats/'+cat,{items:CATS[cat].items});fillSels();renderIE(cat);toast(typeof t==="function"?t("toast.afegit"):"Afegit");}
async function delIE(cat,i){
  if(CATS[cat].items.length<=1){toast(typeof t==="function"?t("toast.minim"):"Mínim 1");return;}
  const item=CATS[cat].items[i];
  const ok=await confirmDialog({
    title:'Eliminar de la llista?',
    message:`Vols eliminar <strong>${item}</strong> de ${cat}?`,
    confirmText:'Eliminar',danger:true,
  });
  if(!ok)return;
  CATS[cat].items.splice(i,1);
  apiPut('cats/'+cat,{items:CATS[cat].items});
  fillSels();renderIE(cat);toast(typeof t==="function"?t("toast.eliminat"):"Eliminat");
}

// ── FORMADOR PREFERIT ───────────────────────────────────────────
function setFormPref(){
  const sel=document.getElementById('p-form-pref');
  const val=sel.value;
  preferredFormadorId=val?parseInt(val):null;
  const disp=document.getElementById('form-pref-display');
  if(preferredFormadorId!==null){
    const f=FORMADORS.find(x=>x.id===preferredFormadorId);
    if(f){
      disp.innerHTML=`<div class="form-pref-box">
        <img src="${f.img}" width="30" height="30" style="border-radius:50%;object-fit:cover;flex-shrink:0"/>
        <div style="flex:1"><div style="font-size:12px;font-weight:500">${f.nom}</div><div style="font-size:10px;color:#085041">Formador prioritzat · s'examinarà primer la seva disponibilitat</div></div>
        <button class="form-pref-clear" onclick="clearFormPref()" title="Eliminar preferència">×</button>
      </div>`;
    }
  }else{disp.innerHTML='';}
  lf();
}
function clearFormPref(){preferredFormadorId=null;document.getElementById('p-form-pref').value='';document.getElementById('form-pref-display').innerHTML='';lf();}

// Demanar a l'IA quin formador és millor per a la petició actual
async function suggestFormadorAI(btn){
  const client=document.getElementById('p-client')?.value?.trim();
  const curs=document.getElementById('p-curs')?.value?.trim();
  const especialitat=document.getElementById('p-esp')?.value;
  if(!client||!curs){toast('Omple Client i Nom del curs primer');return;}

  const wrap=document.getElementById('ai-formador-suggest');
  const orig=btn.textContent;btn.disabled=true;btn.textContent='Pensant...';
  if(wrap){wrap.style.display='block';wrap.innerHTML='<div style="display:flex;align-items:center;gap:8px;color:#3C3489"><span class="spinner" style="width:13px;height:13px;border-width:2px;border-top-color:#534AB7"></span>L\'IA està analitzant l\'històric...</div>';}

  try{
    const peticio={
      client,curs,
      especialitat,
      modalitat:document.getElementById('p-modal')?.value,
      hores:parseInt(document.getElementById('p-hores')?.value)||16,
      preuHora:parseInt(document.getElementById('p-preu')?.value)||75,
    };
    const res=await fetch('/api/ai/suggest-formador',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({peticio}),
    });
    const data=await res.json();
    if(!res.ok||!data.ok)throw new Error(data.error||'Error');
    const top=data.parsed?.top3||[];
    if(!top.length){wrap.innerHTML='<div style="color:#6b6b67">Sense suggeriments</div>';return;}

    wrap.innerHTML=`
      <div style="font-size:11px;color:#3C3489;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">🤖 Top 3 IA · ${data.model||'Llama 3.3'}${data.ms?` · ${data.ms}ms`:''}</div>
      ${data.parsed.resum?`<div style="font-size:12px;color:#3C3489;margin-bottom:8px;font-style:italic">"${data.parsed.resum}"</div>`:''}
      ${top.map((s,i)=>{
        const f=FORMADORS.find(x=>x.id===s.formadorId)||FORMADORS.find(x=>x.nom===s.nom);
        const initials=(s.nom||'?').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase();
        return`<div style="display:flex;gap:8px;padding:7px;background:#fff;border-radius:8px;margin-bottom:5px;border:1px solid rgba(0,0,0,0.06);align-items:center">
          ${f&&f.img?`<img src="${f.img}" width="28" height="28" style="border-radius:50%;object-fit:cover;flex-shrink:0"/>`:`<div style="width:28px;height:28px;border-radius:50%;background:#534AB7;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;flex-shrink:0">${initials}</div>`}
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600">${i+1}. ${s.nom} <span style="font-size:10px;color:#5DCAA5;font-weight:600">${s.score}%</span> ${s.marge_pct!=null?`<span style="font-size:9.5px;color:#0C447C;background:#E6F1FB;padding:1px 5px;border-radius:6px">marge ${s.marge_pct}%</span>`:''}</div>
            <div style="font-size:10.5px;color:#6b6b67;line-height:1.45">${s.rao_principal||(s.raons||[]).join(' · ')}</div>
          </div>
          ${f?`<button class="btn btn-sm btn-p" style="font-size:10.5px;padding:4px 9px;flex-shrink:0" onclick="(function(){document.getElementById('p-form-pref').value=${f.id};setFormPref();})();this.disabled=true;this.textContent='✓ Triat'">Triar</button>`:''}
        </div>`;
      }).join('')}`;
  }catch(e){
    wrap.innerHTML=`<div style="color:#791F1F">Error: ${e.message}</div>`;
  }finally{
    btn.disabled=false;btn.textContent=orig;
  }
}

// ── AGENTS ─────────────────────────────────────────────────────
function renderAgentSelector(){
  document.getElementById('agent-selector').innerHTML=AGENTS.map(a=>{
    const isSel=selectedAgent===a.nom;
    const parts=a.nom.split(' ');
    // Prioritat: 1) imatge pròpia de l'agent, 2) imatge d'un formador amb el mateix nom, 3) inicials
    const ownImg=a.img && !String(a.img).includes('data:image/svg')?a.img:null;
    const matchedFormador=ownImg?null:FORMADORS.find(f=>f.nom===a.nom && f.img && !String(f.img).includes('data:image/svg'));
    const imgSrc=ownImg||matchedFormador?.img;
    const avHtml=imgSrc
      ? `<div class="agent-av" style="background:${a.color};overflow:hidden;padding:0"><img src="${imgSrc}" alt="${a.nom}" style="width:100%;height:100%;object-fit:cover;display:block"/></div>`
      : `<div class="agent-av" style="background:${a.color}">${ini(a.nom)}</div>`;
    return`<button class="agent-btn ${isSel?'sel':''}" onclick="selectAgent('${a.nom}')" ondblclick="event.preventDefault();editAgent('${a.nom.replace(/'/g,"\\'")}')" title="${a.nom} · doble clic per editar">${avHtml}<div class="agent-name">${parts[0]+(parts.length>1?'<br>'+parts.slice(1).join(' '):'')}</div></button>`;
  }).join('')+`<button class="agent-add-btn" onclick="document.getElementById('agent-new-form').classList.toggle('open')" title="Afegir agent"><div class="agent-add-icon">+</div><div class="agent-name" style="color:#6b6b67">Afegir</div></button>`;
  const cf=document.getElementById('gest-com-f');
  if(cf)cf.innerHTML='<option value="">Tots els agents</option>'+AGENTS.map(a=>`<option value="${a.nom}">${a.nom}</option>`).join('');
}
function selectAgent(nom){selectedAgent=nom;renderAgentSelector();}

// Retorna el correu real de l'agent comercial, amb fallback a un autogenerat
// si l'agent no té email guardat (per a registres antics o agents creats abans del v33)
function getAgentEmail(nom){
  if(!nom)return '';
  const a=AGENTS.find(x=>x.nom===nom);
  if(a && a.email)return a.email;
  return (nom||'').toLowerCase().replace(/\s+/g,'.')+'@gesem.es';
}

// ── EDIT AGENT (doble clic al chip) ────────────────────────────
function editAgent(nom){
  const a=AGENTS.find(x=>x.nom===nom);
  if(!a)return;
  // Crea l'overlay si no existeix
  let bg=document.getElementById('agent-edit-bg');
  if(!bg){
    bg=document.createElement('div');
    bg.id='agent-edit-bg';
    bg.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9999;align-items:center;justify-content:center';
    bg.innerHTML=`<div style="background:#fff;border-radius:14px;padding:18px 20px;width:400px;max-width:90vw;box-shadow:0 12px 40px rgba(0,0,0,0.18)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <label for="agent-edit-foto-inp" id="agent-edit-av-wrap" title="Clica per canviar la foto" style="position:relative;flex-shrink:0;cursor:pointer;display:block">
          <div id="agent-edit-av" style="width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:18px;transition:filter .15s"></div>
          <div id="agent-edit-av-overlay" style="position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;opacity:0;transition:opacity .15s;pointer-events:none">📷</div>
          <input type="file" id="agent-edit-foto-inp" accept="image/*" style="display:none" onchange="loadAgentFoto(this)"/>
        </label>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600">Editar agent comercial</div>
          <div id="agent-edit-original" style="font-size:11px;color:#71717A"></div>
          <div style="font-size:10px;color:#71717A;margin-top:2px">Clica l'avatar per pujar foto · JPG/PNG max 20MB</div>
        </div>
        <button id="agent-edit-foto-rm" type="button" style="display:none;background:#FEE2E2;border:1px solid #FCA5A5;color:#991B1B;padding:4px 8px;border-radius:6px;font-size:10px;cursor:pointer" onclick="removeAgentFoto()">Treure foto</button>
      </div>
      <style>#agent-edit-av-wrap:hover #agent-edit-av-overlay{opacity:1}</style>
      <label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:3px">Nom complet</label>
      <input type="text" id="agent-edit-nom" style="width:100%;padding:7px 10px;border:0.5px solid rgba(0,0,0,0.18);border-radius:8px;background:#f5f4f0;color:#1a1a1a;font-size:13px;font-family:inherit;box-sizing:border-box" onkeydown="if(event.key==='Enter')saveAgentEdit();if(event.key==='Escape')closeAgentEdit()"/>
      <label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin:10px 0 3px">Correu electrònic <span style="font-weight:400;color:#9CA3AF">(per a confirmacions)</span></label>
      <input type="email" id="agent-edit-email" placeholder="correu@gesem.es" style="width:100%;padding:7px 10px;border:0.5px solid rgba(0,0,0,0.18);border-radius:8px;background:#f5f4f0;color:#1a1a1a;font-size:13px;font-family:inherit;box-sizing:border-box" onkeydown="if(event.key==='Enter')saveAgentEdit();if(event.key==='Escape')closeAgentEdit()"/>
      <label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin:10px 0 5px">Color de l'avatar <span style="font-weight:400;color:#9CA3AF">(visible si no hi ha foto)</span></label>
      <div id="agent-edit-colors" style="display:flex;flex-wrap:wrap;gap:6px"></div>
      <div id="agent-edit-warn" style="display:none;margin-top:10px;padding:7px 10px;background:#FEF3C7;border:1px solid #FCD34D;border-radius:7px;font-size:11px;color:#92400E"></div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-top:14px">
        <button class="btn btn-sm" style="background:#FEE2E2;border-color:#FCA5A5;color:#991B1B" onclick="deleteAgent()">🗑 Eliminar</button>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick="closeAgentEdit()">Cancel·lar</button>
          <button class="btn btn-p btn-sm" onclick="saveAgentEdit()">Desar</button>
        </div>
      </div>
    </div>`;
    bg.addEventListener('click',e=>{if(e.target===bg)closeAgentEdit();});
    document.body.appendChild(bg);
  }
  // Marca l'agent en edició + reset de l'estat de foto pendent
  bg.dataset.editingNom=nom;
  bg.dataset.pendingImg=''; // si l'usuari puja una foto nova, es desa aquí
  bg.dataset.imgRemoved='';
  document.getElementById('agent-edit-nom').value=a.nom;
  document.getElementById('agent-edit-email').value=a.email||'';
  document.getElementById('agent-edit-original').textContent='Editant: '+a.nom;
  const av=document.getElementById('agent-edit-av');
  av.style.background=a.color;
  // Prioritat: imatge pròpia → formador match → inicials
  const ownImg=a.img && !String(a.img).includes('data:image/svg')?a.img:null;
  const matchedFormador=ownImg?null:FORMADORS.find(f=>f.nom===a.nom && f.img && !String(f.img).includes('data:image/svg'));
  const initialImg=ownImg||matchedFormador?.img;
  const rmBtn=document.getElementById('agent-edit-foto-rm');
  if(initialImg){
    av.innerHTML=`<img id="agent-edit-img" src="${initialImg}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>`;
    av.style.padding='0';
    if(rmBtn)rmBtn.style.display=ownImg?'block':'none'; // només es pot treure la foto pròpia
  }else{
    av.textContent=ini(a.nom);av.style.padding='';
    if(rmBtn)rmBtn.style.display='none';
  }
  // Pinta colors triables
  const cw=document.getElementById('agent-edit-colors');
  cw.innerHTML=AV_COLORS.map(c=>`<button type="button" data-color="${c}" onclick="pickAgentColor(this)" style="width:26px;height:26px;border-radius:50%;border:${c===a.color?'2.5px solid #1a1a1a':'1px solid rgba(0,0,0,0.15)'};background:${c};cursor:pointer;padding:0"></button>`).join('');
  // Warning si hi ha reserves amb aquest nom
  const reservesAmb=(window.RESERVES||[]).filter(r=>r.comercial===a.nom).length;
  const warn=document.getElementById('agent-edit-warn');
  if(reservesAmb>0){warn.style.display='block';warn.innerHTML=`⚠️ Aquest agent té <strong>${reservesAmb}</strong> reserva${reservesAmb>1?'s':''} associades. Si el renomenes, s'actualitzaran totes automàticament. Si l'elimines, perdran l'agent assignat.`;}
  else warn.style.display='none';
  bg.style.display='flex';
  setTimeout(()=>document.getElementById('agent-edit-nom').focus(),50);
}

function pickAgentColor(btn){
  document.querySelectorAll('#agent-edit-colors button').forEach(b=>{b.style.border='1px solid rgba(0,0,0,0.15)';});
  btn.style.border='2.5px solid #1a1a1a';
  document.getElementById('agent-edit-av').style.background=btn.dataset.color;
}

function loadAgentFoto(input){
  const file=input.files[0];
  if(!file)return;
  if(file.size>20*1024*1024){toast('Fitxer massa gran (max 20MB)');input.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    processAvatarImage(e.target.result,cropped=>{
      const bg=document.getElementById('agent-edit-bg');
      if(bg){bg.dataset.pendingImg=cropped;bg.dataset.imgRemoved='';}
      const av=document.getElementById('agent-edit-av');
      av.innerHTML=`<img id="agent-edit-img" src="${cropped}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>`;
      av.style.padding='0';
      const rmBtn=document.getElementById('agent-edit-foto-rm');
      if(rmBtn)rmBtn.style.display='block';
    });
  };
  reader.readAsDataURL(file);
}

// Helper compartit: processa una imatge per a avatars/perfils
//  · 256×256 (suficient per a retina fins ~128px de visualització)
//  · Cover crop centrat (manté aspect ratio · NO deforma)
//  · Smoothing high-quality en 2 passos (downsample progressiu) per evitar pixelació
//  · JPEG quality 0.92 si no cal transparència — PNG en cas contrari
function processAvatarImage(dataURL, cb, opts={}){
  const target=opts.size||256;
  const isPng=String(dataURL).startsWith('data:image/png');
  const img=new Image();
  img.onload=()=>{
    // Pas 1: si la imatge original és gran (>2× target), fem un primer downsample a 2× target
    // perquè drawImage en un sol pas pot quedar pixelat amb factors d'escala extrems.
    let src=img,sw=img.width,sh=img.height;
    const maxScale=2;
    if(Math.min(sw/target,sh/target)>maxScale){
      const ratio=Math.max((target*maxScale)/sw,(target*maxScale)/sh);
      const w1=Math.round(sw*ratio),h1=Math.round(sh*ratio);
      const c1=document.createElement('canvas');c1.width=w1;c1.height=h1;
      const x1=c1.getContext('2d');
      x1.imageSmoothingEnabled=true;x1.imageSmoothingQuality='high';
      x1.drawImage(img,0,0,w1,h1);
      src=c1;sw=w1;sh=h1;
    }
    // Pas 2: cover crop centrat sobre el target final
    const c=document.createElement('canvas');c.width=target;c.height=target;
    const ctx=c.getContext('2d');
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    const r=Math.max(target/sw,target/sh);
    const w=sw*r,h=sh*r;
    ctx.drawImage(src,(target-w)/2,(target-h)/2,w,h);
    // Per a PNG conservem la qualitat lossless; per a la resta usem JPEG q=0.92 (3-5× més petit)
    const out=isPng?c.toDataURL('image/png'):c.toDataURL('image/jpeg',0.92);
    cb(out);
  };
  img.src=dataURL;
}

function removeAgentFoto(){
  const bg=document.getElementById('agent-edit-bg');
  if(!bg)return;
  bg.dataset.pendingImg='';
  bg.dataset.imgRemoved='1';
  const oldNom=bg.dataset.editingNom;
  const a=AGENTS.find(x=>x.nom===oldNom);
  const av=document.getElementById('agent-edit-av');
  av.innerHTML=ini(a?.nom||'?');
  av.style.padding='';
  document.getElementById('agent-edit-foto-rm').style.display='none';
  const inp=document.getElementById('agent-edit-foto-inp');
  if(inp)inp.value='';
}

function closeAgentEdit(){
  const bg=document.getElementById('agent-edit-bg');
  if(bg)bg.style.display='none';
}

async function saveAgentEdit(){
  const bg=document.getElementById('agent-edit-bg');
  const oldNom=bg?.dataset.editingNom;
  const a=AGENTS.find(x=>x.nom===oldNom);
  if(!a){closeAgentEdit();return;}
  const newNom=document.getElementById('agent-edit-nom').value.trim();
  const newEmail=(document.getElementById('agent-edit-email').value||'').trim().toLowerCase();
  if(!newNom){toast('El nom no pot estar buit');return;}
  if(newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)){toast('Correu no vàlid');return;}
  const selBtn=document.querySelector('#agent-edit-colors button[style*="2.5px"]');
  const newColor=selBtn?.dataset.color||a.color;
  if(newNom!==oldNom && AGENTS.find(x=>x.nom===newNom)){toast('Ja existeix un agent amb aquest nom');return;}
  // Resoldre la imatge a desar
  const pendingImg=bg.dataset.pendingImg||'';
  const imgRemoved=bg.dataset.imgRemoved==='1';
  let finalImg;
  if(pendingImg)finalImg=pendingImg;          // nova foto pujada
  else if(imgRemoved)finalImg=null;            // explícitament treta
  else finalImg=a.img||null;                   // mantenir l'existent
  // Actualitzar al servidor (PUT amb nom antic com a key)
  try{
    const r=await fetch('/api/agents/'+encodeURIComponent(oldNom),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nom:newNom,email:newEmail,color:newColor,img:finalImg})});
    if(!r.ok){const d=await r.json().catch(()=>({}));toast('Error: '+(d.error||r.status));return;}
    const result=await r.json();
    a.nom=newNom;a.email=newEmail;a.color=newColor;a.img=finalImg||null;
    // Propagació local a reserves (el servidor ja ho ha fet, però mantenim memòria sincronitzada)
    if(newNom!==oldNom){
      (window.RESERVES||[]).forEach(r=>{if(r.comercial===oldNom)r.comercial=newNom;});
      if(selectedAgent===oldNom)selectedAgent=newNom;
      if(typeof renderGest==='function')renderGest();
    }
    renderAgentSelector();
    closeAgentEdit();
    const updated=result.reservesUpdated||0;
    toast('✓ Agent actualitzat'+(updated>0?' · '+updated+' reserves migrades':''));
  }catch(e){toast('Error de connexió: '+e.message);}
}

async function deleteAgent(){
  const bg=document.getElementById('agent-edit-bg');
  const oldNom=bg?.dataset.editingNom;
  if(!oldNom)return;
  const reservesAmb=(window.RESERVES||[]).filter(r=>r.comercial===oldNom).length;
  const msg=reservesAmb>0
    ?`Eliminar "${oldNom}"? Hi ha ${reservesAmb} reserva${reservesAmb>1?'s':''} amb aquest agent que perdran l'assignació.`
    :`Eliminar "${oldNom}"?`;
  if(!confirm(msg))return;
  const idx=AGENTS.findIndex(x=>x.nom===oldNom);
  if(idx<0){closeAgentEdit();return;}
  AGENTS.splice(idx,1);
  await fetch('/api/agents/'+encodeURIComponent(oldNom),{method:'DELETE'});
  if(selectedAgent===oldNom)selectedAgent=AGENTS[0]?.nom||null;
  renderAgentSelector();
  closeAgentEdit();
  toast('✓ Agent eliminat');
}
function addAgent(){
  const inp=document.getElementById('agent-new-input');
  const inpEmail=document.getElementById('agent-new-email');
  const nom=inp.value.trim();
  const email=(inpEmail?.value||'').trim().toLowerCase();
  if(!nom){toast(typeof t==="function"?t("toast.write_name"):"Escriu el nom");return;}
  if(!email){toast('Cal el correu de l\'agent (per enviar confirmacions)');inpEmail?.focus();return;}
  // Validació bàsica d'email
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Correu no vàlid');inpEmail?.focus();return;}
  if(AGENTS.find(a=>a.nom===nom)){toast(typeof t==="function"?t("toast.exists"):"Ja existeix");return;}
  const a={nom,email,color:AV_COLORS[AGENTS.length%AV_COLORS.length]};
  AGENTS.push(a);
  apiPost('agents',a);
  selectedAgent=nom;
  inp.value='';
  if(inpEmail)inpEmail.value='';
  document.getElementById('agent-new-form').classList.remove('open');
  renderAgentSelector();
  toast(typeof t==="function"?t("toast.agent_added"):"Agent afegit");
}

// ── DIES / DISTRIBUCIÓ ──────────────────────────────────────────
function upD(){
  const ssw=parseInt(document.getElementById('p-ssw').value)||2;
  const opts=DISTRIBS[ssw]||[[2,4]];
  if(!selDist||!opts.some(o=>o.join(',')===selDist.join(','))){
    const valid=opts.filter(o=>!o.some(d=>bDays.has(d)));
    selDist=valid.length>0?valid[0]:opts[0];
  }
  document.getElementById('dh').textContent=ssw===1?'Dia de la setmana:':'Distribució òptima:';
  document.getElementById('do').innerHTML=opts.map((opt,i)=>{
    const k=opt.join(',');const isSel=selDist&&selDist.join(',')===k;
    const isBlocked=opt.some(d=>bDays.has(d));
    return`<button class="do-btn ${isSel&&!isBlocked?'sel':''}" id="do-${i}" onclick="selD(${i})" ${isBlocked?'disabled title="Conté un dia bloquejat"':''}>${DLABELS[k]||opt.map(d=>DL[d]).join('·')}${isBlocked?' 🚫':''}</button>`;
  }).join('');
}
function selD(i){const ssw=parseInt(document.getElementById('p-ssw').value)||2;const opt=(DISTRIBS[ssw]||[[2,4]])[i];if(opt&&!opt.some(d=>bDays.has(d))){selDist=opt;document.querySelectorAll('.do-btn').forEach((b,j)=>{b.classList.toggle('sel',j===i&&!b.disabled);});lf();}}
function togDay(btn){const d=parseInt(btn.dataset.d);if(bDays.has(d)){bDays.delete(d);btn.classList.remove('blocked');}else{bDays.add(d);btn.classList.add('blocked');}upD();ua();}
function addEx(){const v=document.getElementById('excl-in').value;if(!v)return;exclD.add(v);renderExcl();ua();}
function removeEx(d){exclD.delete(d);renderExcl();ua();}
function renderExcl(){document.getElementById('excl-list').innerHTML=[...exclD].map(d=>`<span class="excl-tag" onclick="removeEx('${d}')">${d} ×</span>`).join('');}
function ua(){upR();lf();}
function upR(){
  const h=parseInt(document.getElementById('p-hores').value)||16;const hs=parseFloat(document.getElementById('p-hsess').value)||2;const ssw=parseInt(document.getElementById('p-ssw').value)||2;const pc=parseFloat(document.getElementById('p-preu').value)||0;const ns=Math.ceil(h/hs),sw=Math.ceil(ns/ssw);
  document.getElementById('rsm-t').innerHTML=`<strong>${ns} sessions</strong> · <strong>${hs}h/sessió</strong> · ~<strong>${sw} setmanes</strong>`;
  document.getElementById('rsm-e').textContent=pc>0?`Ingressos estimats: ${(pc*h).toFixed(0)}€`:'';
}
function clearPeticio(){document.getElementById('p-client').value='';document.getElementById('p-curs').value='';document.getElementById('p-hores').value='16';document.getElementById('p-inici').value='2026-04-14';document.getElementById('p-preu').value='75';document.getElementById('excl-in').value='';bDays=new Set();exclD=new Set();selDist=null;preferredFormadorId=null;document.getElementById('p-form-pref').value='';document.getElementById('form-pref-display').innerHTML='';document.querySelectorAll('.ds').forEach(b=>b.classList.remove('blocked'));renderExcl();upD();upR();lf();document.getElementById('r-live').style.display='';document.getElementById('r-prop').style.display='none';document.querySelectorAll('.nb').forEach(b=>{b.classList.remove('act','act-p');});document.getElementById('nb-p').classList.add('act');clearPeticioDraft();toast(typeof t==="function"?t("toast.netejada"):"Petició netejada");}

// ── DATES ──────────────────────────────────────────────────────
function validDay(d){const dw=d.getDay();if(dw===0||dw===6)return false;if(bDays.has(dw))return false;if(isFest(d))return false;if(exclD.has(toISO(d)))return false;return true;}
function buildDates(startStr,n,dist,extraExcl){const res=[];const cur=new Date(startStr+'T00:00:00');let it=0;while(res.length<n&&it<500){const dw=cur.getDay()||7;if(dist.includes(dw)&&validDay(cur)&&(!extraExcl||!extraExcl.has(toISO(cur))))res.push(new Date(cur));cur.setDate(cur.getDate()+1);it++;}return res;}
function findFirstAvailable(startStr,dist){const cur=new Date(startStr+'T00:00:00');for(let i=0;i<60;i++){const dw=cur.getDay()||7;if(dist.includes(dw)&&validDay(cur))return new Date(cur);cur.setDate(cur.getDate()+1);}return new Date(startStr+'T00:00:00');}

// Construeix el detall de dates per a un formador:
// - Les dates originals (algunes poden estar ocupades → taronja)
// - Per cada data ocupada, afegeix una data de substitució lliure (→ verd amb ↩)
// Retorna array de {d, iso, calBusy, gesBusy, isReplacement}
function buildDateDetailWithReplacements(f, dates, tornL, fGesISO, hasRealCal){
  const detail=[];
  const usedIsos=new Set(dates.map(d=>toISO(d)));
  let busyCount=0;
  for(const d of dates){
    const iso=toISO(d);
    const calBusy=hasRealCal?isDateBusyForTorn(f.id,iso,tornL):false;
    const gesBusy=fGesISO.has(iso);
    detail.push({d,iso,calBusy,gesBusy,isReplacement:false});
    if(calBusy||gesBusy)busyCount++;
  }
  if(busyCount>0&&dates.length>0){
    // Busca dates de substitució lliures a partir de l'endemà de l'última data
    const last=dates[dates.length-1];
    const nextDay=new Date(last.getTime()+86400000);
    // Busquem busyCount*3 candidats per tenir marge si alguns també estan ocupats
    const candidates=buildDates(toISO(nextDay),busyCount*3,dates.length>=2?[dates[0].getDay()||7,dates[1].getDay()||7]:[dates[0].getDay()||7],usedIsos);
    let added=0;
    for(const d of candidates){
      if(added>=busyCount)break;
      const iso=toISO(d);
      const calBusy=hasRealCal?isDateBusyForTorn(f.id,iso,tornL):false;
      const gesBusy=fGesISO.has(iso);
      if(!calBusy&&!gesBusy){
        detail.push({d,iso,calBusy:false,gesBusy:false,isReplacement:true});
        usedIsos.add(iso);
        added++;
      }
    }
  }
  return detail;
}

// ── PUNTUACIÓ ──────────────────────────────────────────────────
// gesReservesPerF: Map<formadorId, Set<isoDate>> — només dates d'aquest formador a GESEM
// torn: string com '9:30–11:30h' per comprovar solapament exacte
function calcScore(f,esp,dates,gesReservesPerF,pc,isPref,torn){
  if(!f.specs.includes(esp))return{score:0,match:false,blocked:false,marge:null};

  const hasRealCal=hasCalendar(f)&&calData[f.id]!==undefined;

  // ── Conflictes GESEM: dates on AQUEST formador ja té un altre curs ──
  const fGesISO=gesReservesPerF[f.id]||new Set();
  const gesConflDates=dates.filter(d=>fGesISO.has(toISO(d)));

  // ── Conflictes per calendari propi del formador ──
  // Ara comprovem la franja horària exacta, no el dia sencer
  let calConflDates=[];
  if(hasRealCal&&torn){
    calConflDates=calBusyDatesForTorn(f.id,dates,torn);
  }

  // ── Si el calendari bloqueja el 100% de les dates → no disponible ──
  const totalDates=dates.length;
  const uniqueBusy=new Set([...gesConflDates.map(d=>toISO(d)),...calConflDates.map(d=>toISO(d))]);
  const blocked=totalDates>0&&uniqueBusy.size>=totalDates;
  if(blocked)return{
    score:0,match:true,blocked:true,
    gesConflicts:gesConflDates.length,calConflicts:calConflDates.length,
    hasRealCal,marge:pc>0?Math.round((pc-f.preu_hora)/pc*100):null,
    dispScore:0,ratingScore:0,costScore:0
  };

  // ── PRIORITAT 1 (60 pts): Disponibilitat ──
  const totalConflicts=uniqueBusy.size;
  // Si té calendari real, ignorem la disponibilitat declarada (dades fiables)
  const dispDeclarada=hasRealCal?0:{alta:20,parcial:10,baixa:0}[f.disp]||10;
  const dispDates=Math.max(0,40-totalConflicts*Math.ceil(40/Math.max(totalDates,1)));
  // Bonus si té calendari real i cap conflicte (dades verificades)
  const calBonus=hasRealCal&&calConflDates.length===0?10:0;
  const disponibilitatScore=Math.min(60,dispDeclarada+dispDates+calBonus);

  // ── PRIORITAT 2 (25 pts): Valoració ──
  const ratingScore=Math.round((parseFloat(f.rating||4)-3)/2*25);

  // ── PRIORITAT 3 (15 pts): Cost ──
  const maxPreu=80,minPreu=20;
  const costScore=Math.round((1-(Math.max(minPreu,Math.min(maxPreu,f.preu_hora))-minPreu)/(maxPreu-minPreu))*15);

  let score=Math.min(99,Math.max(5,disponibilitatScore+ratingScore+costScore));
  if(isPref)score=Math.min(99,score+20);

  const marge=pc>0?Math.round((pc-f.preu_hora)/pc*100):null;
  return{
    score,match:true,blocked:false,
    gesConflicts:gesConflDates.length,
    calConflicts:calConflDates.length,
    totalConflicts,hasRealCal,marge,
    dispScore:disponibilitatScore,ratingScore,costScore
  };
}

// ── LIVE FILTER ────────────────────────────────────────────────
function lf(){
  const esp=document.getElementById('p-esp').value;
  const h=parseInt(document.getElementById('p-hores').value)||16;
  const hs=parseFloat(document.getElementById('p-hsess').value)||2;
  const ssw=parseInt(document.getElementById('p-ssw').value)||2;
  const pc=parseFloat(document.getElementById('p-preu').value)||0;
  const torn=document.getElementById('p-torn').value||'Qualsevol';
  const inici=document.getElementById('p-inici').value||'2026-04-14';
  const ns=Math.ceil(h/hs);
  const dist=selDist||(DISTRIBS[ssw]||[[2,4]])[0];
  // Map per formador: dates que JA TÉ assignades a GESEM (no les de la resta)
  const gesReservesPerF={};
  RESERVES.filter(r=>r.estat!=='cancel'&&r.formadorId!=null).forEach(r=>{
    if(!gesReservesPerF[r.formadorId])gesReservesPerF[r.formadorId]=new Set();
    (r.dates||[]).forEach(d=>gesReservesPerF[r.formadorId].add(d));
  });
  const firstAvail=findFirstAvailable(inici,dist);
  const sDates=buildDates(toISO(firstAvail),ns,dist);

  const scored=FORMADORS.map(f=>{
    const s=calcScore(f,esp,sDates,gesReservesPerF,pc,f.id===preferredFormadorId,torn);
    return{...f,...s};
  });

  // Separar: no match esp | bloquejats del tot | disponibles
  const available=scored.filter(f=>f.match&&!f.blocked).sort((a,b)=>{
    if(a.id===preferredFormadorId)return -1;
    if(b.id===preferredFormadorId)return 1;
    return b.score-a.score;
  });
  const blocked=scored.filter(f=>f.match&&f.blocked);
  const noMatch=scored.filter(f=>!f.match);

  const sub=document.getElementById('fc-sub');const badge=document.getElementById('fc-badge');
  const hasAnyCal=FORMADORS.some(f=>f.icsUrl&&calData[f.id]);
  if(available.length){
    const prefMsg=preferredFormadorId!==null?' · Formador preferit prioritzat':'';
    const calMsg=hasAnyCal?` · Calendaris verificats`:'';
    sub.textContent=`${available.length} disponibles${prefMsg}${calMsg}`;
    badge.style.display='';badge.textContent=available.length+' disponibles';
  }else{
    sub.textContent='Cap formador disponible amb aquests criteris';badge.style.display='none';
  }

  document.getElementById('flive').innerHTML=[...available,...blocked,...noMatch].map((f,i)=>{
    const rank=available.indexOf(f);
    const isPref=f.id===preferredFormadorId;
    const isBlocked=f.blocked&&f.match;
    const isNoMatch=!f.match;

    let cls='fcard';
    if(isNoMatch)cls+=' nm';
    else if(isBlocked)cls+=' rc'; // vermell = totalment bloquejat
    else if(isPref)cls+=' preferred';
    else if(rank===0)cls+=' r1';
    else if(rank===1)cls+=' r2';
    else if(rank===2)cls+=' r3';

    let rb='';
    if(isBlocked)rb='<div class="preferred-badge" style="background:#E24B4A">No disp.</div>';
    else if(isPref)rb='<div class="preferred-badge">Preferit</div>';
    else if(rank===0)rb='<div class="rb rb1">1</div>';
    else if(rank===1)rb='<div class="rb rb2">2</div>';
    else if(rank===2)rb='<div class="rb rb3">3</div>';

    const bw=f.match&&!isBlocked?f.score:0;
    const bColor=isPref?'#1D9E75':isBlocked?'#E24B4A':f.score>=75?'#1D9E75':f.score>=55?'#378ADD':'#BA7517';

    // Indicadors de disponibilitat clars
    let dispIndicator='';
    if(isNoMatch){
      dispIndicator='<span style="font-size:10px;color:#A32D2D">Especialitat no coincident</span>';
    }else if(isBlocked){
      const raons=[];
      if(f.calConflicts>0)raons.push(`📅 Agenda ocupada (${f.calConflicts} sess.)`);
      if(f.gesConflicts>0)raons.push(`🔒 Ja reservat GESEM (${f.gesConflicts} sess.)`);
      dispIndicator=`<span style="font-size:10px;color:#791F1F;font-weight:500">${raons.join(' · ')}</span>`;
    }else{
      const ddCls=f.hasRealCal?'dd-a':f.disp==='alta'?'dd-a':f.disp==='parcial'?'dd-p':'dd-b';
      const dispTxt=f.hasRealCal?'Calendari verificat':f.disp==='alta'?'Alta disp.':f.disp==='parcial'?'Parcial':'Poca disp.';
      const warns=[];
      if(f.calConflicts>0)warns.push(`<span style="font-size:10px;color:#BA7517">📅 ${f.calConflicts} sess. ocupades agenda</span>`);
      if(f.gesConflicts>0)warns.push(`<span style="font-size:10px;color:#BA7517">🔒 ${f.gesConflicts} solapament GESEM</span>`);
      let mc='';if(pc>0&&f.marge!=null){const c=f.marge>=30?'mc-ok':f.marge>=15?'mc-w':'mc-b';mc=`<span class="mc ${c}">${f.marge}% marge</span>`;}
      dispIndicator=`
        <span style="display:flex;align-items:center;gap:3px;font-size:11px;color:#6b6b67"><span class="dd ${ddCls}"></span>${dispTxt}${f.hasRealCal?' ✓':''}</span>
        <span style="font-size:11px;font-weight:500;color:${bColor}" title="Disponibilitat ${f.dispScore||0}pt · Valoració ${f.ratingScore||0}pt · Cost ${f.costScore||0}pt">${bw}%</span>
        ${mc}${warns.join('')}`;
    }

    return`<div class="${cls}" id="fc-${f.id}" onclick="selFC(${f.id})">${rb}
      <div style="display:flex;align-items:flex-start;gap:9px;margin-bottom:7px">
        <img src="${f.img}" width="42" height="42" style="border-radius:50%;display:block;flex-shrink:0;object-fit:cover;${isBlocked?'opacity:.5':''}"/>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500;${isBlocked?'color:#6b6b67':''}">${f.nom}</div>
          <div style="font-size:11px;color:#6b6b67">${f.tipus==='intern'?'Intern':'Extern'} · ${f.preu_hora}€/h · ★${f.rating}</div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px">${f.specs.map(s=>`<span class="${s===esp?'fsp-m':'fsp-o'}">${s}</span>`).join('')}</div>
      ${!isBlocked&&f.match?`<div style="height:3px;border-radius:2px;background:#f5f4f0;margin:5px 0 4px"><div style="height:100%;border-radius:2px;background:${bColor};width:${bw}%"></div></div>`:''}
      <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">${dispIndicator}</div>
    </div>`;
  }).join('');
}
function selFC(id){document.querySelectorAll('.fcard').forEach(c=>c.classList.remove('fsel'));const el=document.getElementById('fc-'+id);if(el)el.classList.add('fsel');}

// ── GENERAR PROPOSTA ───────────────────────────────────────────
function genProp(){
  const esp=document.getElementById('p-esp').value;
  const h=parseInt(document.getElementById('p-hores').value)||16;
  const hs=parseFloat(document.getElementById('p-hsess').value)||2;
  const ssw=parseInt(document.getElementById('p-ssw').value)||2;
  const torn=document.getElementById('p-torn').value;
  const iniOri=document.getElementById('p-inici').value||'2026-04-14';
  const pc=parseFloat(document.getElementById('p-preu').value)||75;
  const client=document.getElementById('p-client').value;
  const curs=document.getElementById('p-curs').value;
  const comercial=selectedAgent;
  const ns=Math.ceil(h/hs);
  const dist=selDist||(DISTRIBS[ssw]||[[2,4]])[0];
  // Map per formador: dates que JA TÉ assignades a GESEM
  const gesReservesPerF={};
  RESERVES.filter(r=>r.estat!=='cancel'&&r.formadorId!=null).forEach(r=>{
    if(!gesReservesPerF[r.formadorId])gesReservesPerF[r.formadorId]=new Set();
    (r.dates||[]).forEach(d=>gesReservesPerF[r.formadorId].add(d));
  });
  const tornL=torn==='Qualsevol'?'9:30–11:30h':torn;
  const sw=Math.ceil(ns/ssw);
  const agentObj=AGENTS.find(a=>a.nom===comercial);
  const firstAvail=findFirstAvailable(iniOri,dist);
  const iniReal=toISO(firstAvail);
  // Si la data orientativa és un festiu, ho indiquem al missatge per claredat
  const iniFestiu = getFestiu(iniOri);
  const deltaMsg = iniReal>iniOri
    ? `Inici ajustat: ${fmtD(firstAvail)} (des de data orientativa ${iniOri}${iniFestiu?` · festiu: ${iniFestiu.nom}`:''})`
    : '';

  let candList=FORMADORS.filter(f=>f.specs.includes(esp));
  if(preferredFormadorId!==null){
    candList=candList.sort((a,b)=>{if(a.id===preferredFormadorId)return -1;if(b.id===preferredFormadorId)return 1;return 0;});
  }
  const cands=candList.map(f=>{
    const dates=buildDates(iniReal,ns,dist);
    const s=calcScore(f,esp,dates,gesReservesPerF,pc,f.id===preferredFormadorId,tornL);
    const cF=f.preu_hora*h,cC=pc*h,marge=cC>0?((cC-cF)/cC*100):0;
    const fGesISO=gesReservesPerF[f.id]||new Set();
    // Detall per data: originals (algunes ocupades) + substitucions per les ocupades
    const dateDetail=buildDateDetailWithReplacements(f,dates,tornL,fGesISO,s.hasRealCal);
    // Dates confirmades per a la reserva: originals lliures + substitucions (excloent les ocupades)
    const confirmedDates=dateDetail.filter(x=>!x.calBusy&&!x.gesBusy).map(x=>x.d);
    return{f,dates,confirmedDates,dateDetail,blocked:s.blocked,gesConflicts:s.gesConflicts||0,calConflicts:s.calConflicts||0,hasRealCal:s.hasRealCal,score:s.score,cF,cC,marge,torn:tornL,hs,ns,h,pc,comercial,client,curs,iniOri,iniReal,isPref:f.id===preferredFormadorId};
  })
  .filter(p=>!p.blocked) // Excloure formadors totalment bloquejats
  .sort((a,b)=>{if(a.isPref)return -1;if(b.isPref)return 1;return b.score-a.score;});

  const rLabels=['1a opció','2a opció','3a opció','Alternativa'];
  const rColors=['#085041','#0C447C','#3C3489','#5F5E5A'];
  const rBgs=['#E1F5EE','#E6F1FB','#EEEDFE','#f5f4f0'];
  const barColors=['#1D9E75','#378ADD','#7F77DD','#888780'];
  document.getElementById('prop-sub').textContent=`${curs||'Curs'} · ${client||'Client'} · ${cands.length} opcions`;

  let propHTML='';
  if(deltaMsg)propHTML+=`<div style="background:#FAEEDA;border-radius:8px;padding:7px 11px;margin-bottom:8px;font-size:12px;color:#633806">ℹ ${deltaMsg}</div>`;
  if(preferredFormadorId!==null)propHTML+=`<div style="background:#E1F5EE;border:0.5px solid #5DCAA5;border-radius:8px;padding:7px 11px;margin-bottom:8px;font-size:12px;color:#085041">★ Formador preferit prioritzat. La proposta examina primer la seva disponibilitat.</div>`;

  if(!cands.length){
    propHTML+=`<div style="background:#fff;border:1.5px solid #7F77DD;border-radius:12px;padding:16px;text-align:center"><div style="font-size:13px;font-weight:500;color:#3C3489;margin-bottom:6px">Cap formador disponible amb els criteris actuals</div><button class="btn btn-p" style="background:#534AB7;border-color:#534AB7" onclick="generateAltCalendars()">Cercar alternatives de calendari amb IA</button></div><div id="alt-calendars"></div>`;
  }else{
    propHTML+=`<div class="ps"><span class="psi"><strong>${client||'—'}</strong></span><span class="psi">${curs||'—'}</span><span class="psi"><strong>${h}h</strong> · ${ns} sess. de ${hs}h · ~${sw} setm</span><span class="psi">${tornL}</span><span class="psi">Preu/h: <strong>${pc}€</strong> · Ingressos: <strong>${(pc*h).toFixed(0)}€</strong></span><span class="psi" style="display:flex;align-items:center;gap:5px">Comercial: <span style="width:20px;height:20px;border-radius:50%;background:${agentObj?agentObj.color:'#6b6b67'};display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:500;color:#fff">${ini(comercial)}</span><strong>${comercial}</strong></span></div>`;
    propHTML+=cands.map((p,i)=>{
      const ri=Math.min(i,3);const mC=p.marge.toFixed(0);const mCl=p.marge>=30?'mc-ok':p.marge>=15?'mc-w':'mc-b';const mColor=p.marge>=30?'#085041':p.marge>=15?'#633806':'#791F1F';
      // Píndoles de dates amb estat visual per sessió
      const _detail=p.dateDetail||p.dates.map(d=>({d,iso:toISO(d),calBusy:false,gesBusy:false,isReplacement:false}));
      const _busyInDetail=_detail.filter(x=>x.calBusy||x.gesBusy).length;
      const _replCount=_detail.filter(x=>x.isReplacement).length;
      const pills=_detail.map(({d,calBusy,gesBusy,isReplacement})=>{
        const dw=d.getDay()||7;
        const isBusy=calBusy||gesBusy;
        const cls=isBusy?'pill p-c':'pill p-ok';
        const icon=calBusy?'📅':gesBusy?'🔒':isReplacement?'↩':'';
        const borderStyle=isReplacement?'border-style:dashed':'';
        const title=calBusy?'Agenda ocupada · substituïda':gesBusy?'GESEM ocupat · substituïda':isReplacement?'Data de substitució · lliure':'Lliure';
        return`<span class="${cls}" style="${borderStyle}" title="${title}">${DL[dw]} ${d.getDate()}/${d.getMonth()+1}${icon}</span>`;
      }).join('')+(_busyInDetail>0?`<span style="font-size:10px;color:#633806;margin-left:3px">+${_replCount} substit.</span>`:'');
      const waMsg=encodeURIComponent(`Hola ${p.f.nom}! Tenim disponibilitat per al curs "${curs}" del client ${client}? Dates: ${p.dates.slice(0,3).map(d=>fmtD(d)).join(', ')}... (${p.dates.length} sessions de ${hs}h, ${tornL}). Pots confirmar? Gràcies!`);
      const prefLabel=p.isPref?'Formador preferit pel client':rLabels[ri];
      const prefBg=p.isPref?'#E1F5EE':rBgs[ri];const prefColor=p.isPref?'#085041':rColors[ri];
      // Avisos de disponibilitat parcial
      const availWarns=[];
      if(p.hasRealCal&&p.calConflicts===0)availWarns.push('<span style="background:#E1F5EE;color:#085041;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500">📅 Agenda verificada ✓</span>');
      if(p.calConflicts>0)availWarns.push(`<span style="background:#FAEEDA;color:#633806;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500">📅 ${p.calConflicts} sess. ocupades agenda</span>`);
      if(p.gesConflicts>0)availWarns.push(`<span style="background:#FAEEDA;color:#633806;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:500">🔒 ${p.gesConflicts} solapament GESEM</span>`);
      return`<div class="pr ${i===0?'best':''}" id="pp-${i}" onclick="selP(${i})">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px">
            <img src="${p.f.img}" width="38" height="38" style="border-radius:50%;display:block;flex-shrink:0;object-fit:cover"/>
            <div><div style="font-size:13px;font-weight:500">${p.f.nom}${p.isPref?' ★':''}</div><div style="font-size:11px;color:#6b6b67">${p.f.tipus==='intern'?'Intern':'Extern'} · ${p.f.preu_hora}€/h · ★${p.f.rating}</div></div>
          </div>
          <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
            <span style="background:${prefBg};color:${prefColor};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500">${prefLabel}</span>
            <span class="mc ${mCl}">${mC}% marge</span>
            ${availWarns.join('')}
          </div>
        </div>
        <div style="height:3px;border-radius:2px;background:#f5f4f0;margin-bottom:5px"><div style="height:100%;border-radius:2px;background:${p.isPref?'#1D9E75':barColors[ri]};width:${p.score}%"></div></div>
        <div style="display:flex;gap:10px;font-size:11px;margin-bottom:5px;flex-wrap:wrap">
          <span style="color:${p.score>=75?'#085041':p.score>=55?'#0C447C':'#791F1F'};font-weight:500">Compatibilitat: ${p.score}%</span>
          <span style="color:#6b6b67">Cost: <strong>${p.cF.toFixed(0)}€</strong></span>
          <span style="color:#6b6b67">Marge: <strong style="color:${mColor}">${(p.cC-p.cF).toFixed(0)}€</strong></span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px">${pills}</div>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;border-top:0.5px solid rgba(0,0,0,0.07);padding-top:8px">
          <button class="btn btn-sm" style="background:#E1F5EE;border-color:#5DCAA5;color:#085041" onclick="event.stopPropagation();openEmailFormador(${i})">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="vertical-align:-1px;margin-right:2px"><rect x=".5" y="1.5" width="9" height="7" rx="1" stroke="currentColor" stroke-width=".8" fill="none"/><path d=".5 3l4.5 3 4.5-3" stroke="currentColor" stroke-width=".8"/></svg>Email formador
          </button>
          <a href="https://wa.me/?text=${waMsg}" target="_blank" onclick="event.stopPropagation()" class="btn btn-sm" style="background:#25D366;border-color:#25D366;color:#fff;text-decoration:none">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="vertical-align:-1px;margin-right:2px"><circle cx="5" cy="5" r="4.5" stroke="white" stroke-width=".7"/><path d="M2.5 7c.5-1 1.5-2.5 3-2.5s2 1 2 1.5-1 .8-1.3.3-.8-1.3-.8-1.3" stroke="white" stroke-width=".6" fill="none"/></svg>WhatsApp
          </a>
          <div style="flex:1"></div>
          <button class="btn btn-p btn-sm" onclick="event.stopPropagation();confirmarReserva(${i},true)">Reservar + email (Comercial) ↗</button>
        </div>
      </div>`;
    }).join('');
    if(cands.length<2)propHTML+=`<div style="margin-top:8px;background:#EEEDFE;border-radius:10px;padding:10px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><div style="font-size:12px;color:#3C3489">Poques opcions. Vols alternatives de calendari?</div><button class="btn btn-sm" style="background:#534AB7;border-color:#534AB7;color:#fff" onclick="generateAltCalendars()">Cercar alternatives</button></div><div id="alt-calendars"></div>`;
    propHTML+=`<div style="text-align:right;margin-top:4px"><button class="btn btn-sm" onclick="showLive()">← Tornar</button></div>`;
  }
  document.getElementById('prop-body').innerHTML=propHTML;
  window._pr=cands;
  document.getElementById('r-live').style.display='none';document.getElementById('r-prop').style.display='';
  document.querySelectorAll('.nb').forEach(b=>{b.classList.remove('act');b.classList.remove('act-p');});document.getElementById('nb-p').classList.add('act-p');
}

function generateAltCalendars(){
  const el=document.getElementById('alt-calendars');if(!el)return;
  const esp=document.getElementById('p-esp').value;
  const h=parseInt(document.getElementById('p-hores').value)||16;
  const hs=parseFloat(document.getElementById('p-hsess').value)||2;
  const ns=Math.ceil(h/hs);
  const inici=document.getElementById('p-inici').value||'2026-04-14';
  const pc=parseFloat(document.getElementById('p-preu').value)||75;
  const torn=document.getElementById('p-torn').value||'9:30–11:30h';
  const tornL=torn==='Qualsevol'?'9:30–11:30h':torn;

  el.innerHTML=`<div style="text-align:center;padding:16px;color:#3C3489;font-size:12px"><span class="spinner" style="margin-right:8px"></span>Analitzant alternatives amb agendes reals dels formadors...</div>`;

  // Build gesReservesPerF
  const gesReservesPerF={};
  RESERVES.filter(r=>r.estat!=='cancel'&&r.formadorId!=null).forEach(r=>{
    if(!gesReservesPerF[r.formadorId])gesReservesPerF[r.formadorId]=new Set();
    (r.dates||[]).forEach(d=>gesReservesPerF[r.formadorId].add(d));
  });

  setTimeout(()=>{
    const alts=[
      {label:'A',desc:'Dl + Dc · mateixa setmana',dist:[1,3],ssw:2,offset:0},
      {label:'B',desc:'Dm + Dj · +2 setmanes',dist:[2,4],ssw:2,offset:14},
      {label:'C',desc:'Dl + Dj · distribució àmplia',dist:[1,4],ssw:2,offset:7},
      {label:'D',desc:'1 sessió/setmana · màxima flexibilitat',dist:[3],ssw:1,offset:0}
    ];

    el.innerHTML=`<div style="margin-top:10px;font-size:11px;color:#3C3489;font-weight:600;margin-bottom:6px">Alternatives verificades amb agendes reals:</div>`+alts.map(alt=>{
      const startDate=new Date(inici+'T00:00:00');
      startDate.setDate(startDate.getDate()+alt.offset);
      const iniStr=toISO(findFirstAvailable(toISO(startDate),alt.dist));
      const dates=buildDates(iniStr,ns,alt.dist);
      const sw=Math.ceil(ns/alt.ssw);

      // Avaluar tots els formadors amb la disponibilitat real
      const scored=FORMADORS
        .filter(f=>f.specs.includes(esp))
        .map(f=>{
          const s=calcScore(f,esp,dates,gesReservesPerF,pc,f.id===preferredFormadorId,tornL);
          return{f,s};
        })
        .filter(x=>x.s.match&&!x.s.blocked)
        .sort((a,b)=>{
          if(a.f.id===preferredFormadorId)return -1;
          if(b.f.id===preferredFormadorId)return 1;
          return b.s.score-a.s.score;
        });

      const best=scored[0];
      const availCount=scored.length;
      const calVerified=best&&best.s.hasRealCal;

      // Píndoles verificades per al millor formador, amb substitucions per les dates ocupades
      let altDetail=[];
      if(best){
        const fGes=gesReservesPerF[best.f.id]||new Set();
        altDetail=buildDateDetailWithReplacements(best.f,dates,tornL,fGes,best.s.hasRealCal);
      } else {
        altDetail=dates.map(d=>({d,iso:toISO(d),calBusy:false,gesBusy:false,isReplacement:false}));
      }
      const altBusy=altDetail.filter(x=>x.calBusy||x.gesBusy).length;
      const altRepl=altDetail.filter(x=>x.isReplacement).length;
      const pills=altDetail.slice(0,7).map(({d,calBusy,gesBusy,isReplacement})=>{
        const dw=d.getDay()||7;
        const isBusy=calBusy||gesBusy;
        const cls=isBusy?'pill p-c':'pill p-ok';
        const icon=calBusy?'📅':gesBusy?'🔒':isReplacement?'↩':'';
        const bStyle=isReplacement?'border-style:dashed':'';
        const title=calBusy?'Agenda ocupada · substituïda':gesBusy?'GESEM ocupat · substituïda':isReplacement?'Substitució · lliure':'Lliure';
        return`<span class="${cls}" style="${bStyle}" title="${title}">${DL[dw]} ${d.getDate()}/${d.getMonth()+1}${icon}</span>`;
      }).join('')
      +(altDetail.length>7?`<span style="font-size:10px;color:#6b6b67"> +${altDetail.length-7}</span>`:'')
      +(altBusy>0?`<span style="font-size:10px;color:#633806;margin-left:3px">+${altRepl} substit.</span>`:'');

      const calBadge=calVerified
        ?`<span style="background:#E1F5EE;color:#085041;padding:1px 6px;border-radius:10px;font-size:10px;font-weight:500">📅 Agenda verificada</span>`
        :`<span style="background:#f5f4f0;color:#6b6b67;padding:1px 6px;border-radius:10px;font-size:10px">Sense calendari connectat</span>`;

      const bestLabel=best
        ?`<span style="font-size:10px;color:#085041">Millor opció: <strong>${best.f.nom}</strong> · ${best.s.score}% compatibilitat</span>`
        :`<span style="font-size:10px;color:#791F1F;font-weight:500">⚠️ Cap formador disponible</span>`;

      const scoreBar=best?`<div style="height:3px;border-radius:2px;background:#f5f4f0;margin:5px 0 4px"><div style="height:100%;border-radius:2px;background:${best.s.score>=75?'#1D9E75':best.s.score>=55?'#378ADD':'#EF9F27'};width:${best.s.score}%"></div></div>`:'';

      return`<div class="alt-card" style="margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
          <span class="badge bpu" style="font-size:11px;padding:2px 8px">Opció ${alt.label}</span>
          <span style="font-size:11px;color:#6b6b67">${alt.desc} · ~${sw} setm · ${availCount} formador${availCount!==1?'s':''} disponible${availCount!==1?'s':''}</span>
          ${calBadge}
        </div>
        ${scoreBar}
        ${bestLabel}
        <div style="display:flex;flex-wrap:wrap;gap:3px;margin:6px 0">${pills||'<span style="font-size:10px;color:#791F1F">No s\'han pogut generar dates</span>'}</div>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-sm" style="background:#EEEDFE;border-color:#AFA9EC;color:#3C3489" ${availCount===0?'disabled title="Cap formador disponible"':''} onclick="applyAlt(${JSON.stringify(alt.dist)},${alt.ssw},'${iniStr}')">Aplicar alternativa</button>
          ${availCount===0?`<span style="font-size:10px;color:#791F1F">⚠️ Cap formador lliure en aquesta distribució</span>`:''}
        </div>
      </div>`;
    }).join('');
  },600);
}

// ── CONFIRMAR RESERVA AMB VERIFICACIÓ ───────────────────────────
function confirmarReserva(idx,ambEmail){
  const p=window._pr[idx];if(!p)return;
  const noCalendar=!hasCalendar(p.f)||calData[p.f.id]===undefined;
  const parcialConfl=p.calConflicts>0||p.gesConflicts>0;

  // Si no té calendari verificat → avís crític
  if(noCalendar){
    const msg=`⚠️ DISPONIBILITAT NO VERIFICADA\n\nEl formador "${p.f.nom}" no té calendari connectat. No es pot confirmar automàticament que estigui lliure les dates proposades.\n\nVols continuar igualment i crear la reserva pendent de confirmació manual?`;
    if(!confirm(msg))return;
  } else if(parcialConfl){
    const parts=[];
    if(p.calConflicts>0)parts.push(`${p.calConflicts} sessió/ns ocupades a la seva agenda personal (📅)`);
    if(p.gesConflicts>0)parts.push(`${p.gesConflicts} solapament/s amb altres cursos GESEM (🔒)`);
    const msg=`⚠️ CONFLICTES DETECTATS\n\n${parts.join('\n')}\n\nVols continuar igualment amb les dates proposades?`;
    if(!confirm(msg))return;
  }

  // Si l'usuari ha clicat "Reservar + email", obrim primer el modal de PREVIEW
  // SENSE crear encara la reserva. La reserva es crearà només si confirma l'enviament.
  if(ambEmail){
    openPreviewBeforeReserva(idx);
    return;
  }

  // Cas "Reservar" simple (sense email) — manté el comportament antic
  const r=confP(idx);
  if(typeof clearPeticioDraft==='function')clearPeticioDraft();
  refreshAllCalendars(p.f.id).catch(e=>console.warn('Refresh cal failed:',e));
  toast('Reserva creada · '+r.id);
}

// Refrescar caches de calendaris després d'una nova reserva
// opts.showToast=true → mostra UNA SOLA toast resum al final (no una per formador)
async function refreshAllCalendars(priorityId, opts){
  const showToast = opts && opts.showToast === true;
  const withCal=FORMADORS.filter(f=>f.icsUrl);
  if(!withCal.length)return;
  // Primer el formador assignat (prioritat) — silenci per evitar 1 toast per formador
  if(priorityId!=null){
    try{await refreshCal(priorityId,{silent:true});}catch(e){}
  }
  // La resta sense bloqueig (també silencios)
  await Promise.all(withCal.filter(f=>f.id!==priorityId).map(f=>refreshCal(f.id,{silent:true}).catch(()=>{})));
  if(showToast)toast(`📅 ${withCal.length} calendaris actualitzats`);
}
function applyAlt(dist,ssw,ini){selDist=dist;document.getElementById('p-ssw').value=ssw;document.getElementById('p-inici').value=ini;upD();ua();document.getElementById('r-live').style.display='';document.getElementById('r-prop').style.display='none';document.querySelectorAll('.nb').forEach(b=>{b.classList.remove('act','act-p');});document.getElementById('nb-p').classList.add('act');toast(typeof t==="function"?t("toast.alt.applied"):"Alternativa aplicada");}
function selP(i){document.querySelectorAll('.pr').forEach((el,j)=>{el.classList.toggle('sel',j===i);el.style.borderColor=j===i?'#1D9E75':'';});}
function showLive(){document.getElementById('r-live').style.display='';document.getElementById('r-prop').style.display='none';document.querySelectorAll('.nb').forEach(b=>{b.classList.remove('act','act-p');});document.getElementById('nb-p').classList.add('act');}

function confP(idx){
  const p=window._pr[idx];
  // Usar confirmedDates (lliures: originals lliures + substitucions), mai les dates ocupades
  const datesPerReserva=(p.confirmedDates&&p.confirmedDates.length>0)?p.confirmedDates:p.dates;
  const res={id:'R'+Date.now(),client:p.client,curs:p.curs,formador:p.f.nom,formadorId:p.f.id,formadorEmail:p.f.email,formadorTel:p.f.tel,comercial:p.comercial,dates:datesPerReserva.map(d=>toISO(d)),torn:p.torn,hs:p.hs,ns:p.ns,h:p.h,pc:p.pc,estat:'pendent-cli',emailEnviat:false,emailFormadorEnviat:false,createdAt:toISO(new Date()),cF:p.cF.toFixed(2),cC:p.cC.toFixed(2),marge:p.marge.toFixed(1),dist:datesPerReserva.length>=2?[datesPerReserva[0].getDay()||7,datesPerReserva[1].getDay()||7]:[datesPerReserva[0]?.getDay()||7]};
  RESERVES.push(res);if(res.dates.length){calY=parseISO(res.dates[0]).getFullYear();calM=parseISO(res.dates[0]).getMonth();}
  apiPost('reserves',res);
  return res;
}

// ── EMAIL FORMADOR ──────────────────────────────────────────────
function openEmailFormador(idx){
  const p=window._pr[idx];if(!p)return;
  // Guardem l'idx perquè el botó "Crear reserva + Enviar amb confirmació"
  // pugui crear la reserva al moment d'enviar
  window._emailfPendingIdx=idx;
  window._emailfResId=null; // encara no hi ha reserva
  const curs=document.getElementById('p-curs').value;const client=document.getElementById('p-client').value;

  // Separar dates disponibles vs ocupades (no incloure ocupades al text principal)
  const availDates=[];const busyDates=[];
  p.dates.forEach(d=>{
    const iso=toISO(d);
    const busy=hasCalendar(p.f) && calData[p.f.id]!==undefined && isDateBusyForTorn(p.f.id,iso,p.torn);
    (busy?busyDates:availDates).push(d);
  });

  const sessText=availDates.map((d,i)=>{const dw=d.getDay()||7;return`  Sessió ${String(i+1).padStart(2,' ')}: ${DL[dw]} ${fmtD(d)} · ${p.torn} · ${p.hs}h`;}).join('\n');
  const busyNote=busyDates.length
    ? `\n\n⚠️ AQUESTES DATES SEMBLEN OCUPADES A LA TEVA AGENDA i NO les he inclòs:\n${busyDates.map(d=>{const dw=d.getDay()||7;return`  · ${DL[dw]} ${fmtD(d)}`;}).join('\n')}\nCaldrà buscar dates alternatives per aquestes sessions.`
    : '';

  document.getElementById('emailf-title').textContent=`Email al formador · ${p.f.nom}`;
  document.getElementById('emailf-para').value=p.f.email||'';
  document.getElementById('emailf-assumpte').value=`Reserva de formació · ${curs} · ${client}`;
  document.getElementById('emailf-cos').value=`Hola ${p.f.nom},\n\nT'escric per reservar-te les dates per al curs "${curs}" del client ${client}.\n\nCALENDARI PROPOSAT (${availDates.length} sessions)\n${'─'.repeat(40)}\n${sessText||'  (sense dates disponibles confirmades)'}${busyNote}\n\nCaldrà la teva confirmació per formalitzar la reserva.\n\nGràcies i salutacions,\nEquip de gestió docent\nGESEM digital & SoftSkills · www.gesem.es`;
  document.getElementById('emailf-bg').style.display='flex';
}
function copyEmailF(){const full=`Per a: ${document.getElementById('emailf-para').value}\nAssumpte: ${document.getElementById('emailf-assumpte').value}\n\n${document.getElementById('emailf-cos').value}`;navigator.clipboard.writeText(full).then(()=>toast(typeof t==="function"?t("toast.copiat"):"Text copiat"));}

// ── GESTIÓ RESERVES ─────────────────────────────────────────────
function setFilter(f,btn){activeFilter=f;document.querySelectorAll('.filter-chip').forEach(b=>b.classList.remove('act'));btn.classList.add('act');renderGest();}

function renderGest(){
  const fc=document.getElementById('gest-com-f').value;
  const sort=document.getElementById('gest-sort').value;
  let list=activeFilter?RESERVES.filter(r=>r.estat===activeFilter):RESERVES.filter(r=>r.estat!=='vf');
  if(fc)list=list.filter(r=>r.comercial===fc);
  if(sort==='agent')list.sort((a,b)=>(a.comercial||'').localeCompare(b.comercial||''));
  else if(sort==='client')list.sort((a,b)=>a.client.localeCompare(b.client));
  else list.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));

  const st={total:RESERVES.filter(r=>r.estat!=='vf').length,'pendent-cli':0,'pendent-form':0,confirmada:0,cancel:0,vf:0};
  RESERVES.forEach(r=>st[r.estat]=(st[r.estat]||0)+1);
  const alerta=RESERVES.filter(r=>r.estat==='pendent-cli'&&daysAgo(r.createdAt)>=5);
  // Actualitzar comptadors inline als chips
  const upd=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val||'0';};
  upd('st-total',st.total);
  upd('st-pc',st['pendent-cli']||0);
  upd('st-pf',st['pendent-form']||0);
  upd('st-co',st.confirmada||0);
  upd('st-ca',st.cancel||0);
  upd('st-vf',st.vf||0);
  const alertEl=document.getElementById('gest-alert');
  if(alerta.length){alertEl.style.display='flex';document.getElementById('gest-alert-txt').textContent=`${alerta.length} reserva(es) porten +5 dies pendents de confirmació del client.`;}
  else alertEl.style.display='none';

  if(!list.length){
    const isFiltered=activeFilter||fc;
    document.getElementById('gest-list').innerHTML=emptyState({
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>',
      title:isFiltered?'Cap reserva amb aquests filtres':'Encara no hi ha cap reserva',
      desc:isFiltered?'Prova de canviar els filtres o esborrar-los per veure totes les reserves.':'Les reserves apareixeran aquí. Comença creant-ne una des de la pàgina Petició.',
      ctaLabel:isFiltered?null:'Crear primera reserva →',
      ctaHref:isFiltered?null:'/peticio',
    });
    return;
  }

  const stLabel={'pendent-cli':'Pendent client','pendent-form':'Pendent formador','confirmada':'Confirmada','cancel':'Cancel·lada','vf':'VF · Arxivat'};
  const stDot={'pendent-cli':'ed-pc','pendent-form':'ed-pf','confirmada':'ed-co','cancel':'ed-ca','vf':'ed-vf'};
  const agentColor=nom=>{const a=AGENTS.find(x=>x.nom===nom);return a?a.color:'#6b6b67';};

  // Agrupar per agent si el sort és per agent, o mostrar taula plana
  const byAgent=sort==='agent';
  if(byAgent){
    const groups={};list.forEach(r=>{const k=r.comercial||'Sense agent';if(!groups[k])groups[k]=[];groups[k].push(r);});
    document.getElementById('gest-list').innerHTML=Object.entries(groups).map(([agentNom,rows])=>{
      const aObj=AGENTS.find(a=>a.nom===agentNom);
      return`<div class="agent-group">
        <div class="agent-group-hdr">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:28px;border-radius:50%;background:${aObj?aObj.color:'#888'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;color:#fff">${ini(agentNom)}</div>
            <div style="font-size:13px;font-weight:500">${agentNom}</div>
            <span class="badge bgr">${rows.length} reserva${rows.length!==1?'es':''}</span>
          </div>
        </div>
        ${renderResTable(rows,stLabel,stDot,agentColor)}
      </div>`;
    }).join('');
  }else{
    document.getElementById('gest-list').innerHTML=`<div class="res-table-wrap">${renderResTable(list,stLabel,stDot,agentColor)}</div>`;
  }
}

function renderResTable(list,stLabel,stDot,agentColor){
  // Mostrar barra de bulk si hi ha elements seleccionables (cancel·lades o VF)
  const hasDeletable=list.some(r=>r.estat==='cancel'||r.estat==='vf');
  return`${hasDeletable?`<div id="bulk-bar" style="display:none;background:var(--bg-muted);border-bottom:1px solid var(--border);padding:9px 14px;align-items:center;gap:10px;font-size:12.5px"><span id="bulk-count" style="font-weight:600">0 seleccionades</span><div style="flex:1"></div><button class="btn btn-sm" onclick="bulkClearSelection()">Desseleccionar</button><button class="btn btn-sm btn-danger" style="background:var(--accent-red);color:#fff;border-color:var(--accent-red)" onclick="bulkDeleteReserves()">🗑 Eliminar seleccionades</button></div>`:''}
  <div style="overflow-x:auto"><table class="rt">
    <thead><tr>
      ${hasDeletable?`<th style="width:28px;padding:8px"><input type="checkbox" id="bulk-select-all" onchange="bulkToggleAll(this)" title="Seleccionar totes"/></th>`:''}
      <th></th>
      <th>Agent</th>
      <th>Client · Curs</th>
      <th>Formador</th>
      <th>Dates</th>
      <th>Estat</th>
      <th>Dies</th>
      <th>Accions</th>
    </tr></thead>
    <tbody>${list.map(r=>{
      const dies=daysAgo(r.createdAt);const urgent=r.estat==='pendent-cli'&&dies>=5;
      const f=FORMADORS.find(x=>x.id===r.formadorId);
      const datePills=r.dates.slice(0,8).map(d=>{const dt=parseISO(d);const dw=dt.getDay()||7;return`<span class="dp">${DL[dw]} ${dt.getDate()}/${dt.getMonth()+1}</span>`;}).join('')+(r.dates.length>8?`<span style="font-size:9px;color:#6b6b67">+${r.dates.length-8}</span>`:'');
      const waMsg=encodeURIComponent(`Hola ${r.formador}! Recordatori reserva "${r.curs}" per a ${r.client}. Dates: ${r.dates.slice(0,2).map(d=>fmtD(parseISO(d))).join(', ')}...`);
      const canDelete=(r.estat==='cancel'||r.estat==='vf');
      return`<tr class="${urgent?'urgent':''}">
        ${hasDeletable?`<td style="padding:8px">${canDelete?`<input type="checkbox" class="bulk-cb" data-id="${r.id}" onchange="bulkUpdateBar()"/>`:''}</td>`:''}
        <td><span class="estat-dot ${stDot[r.estat]}" title="${stLabel[r.estat]}"></span></td>
        <td style="white-space:nowrap">
          <div style="display:flex;align-items:center;gap:4px">
            <span style="width:18px;height:18px;border-radius:50%;background:${agentColor(r.comercial)};display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:500;color:#fff;flex-shrink:0">${ini(r.comercial||'?')}</span>
            <span style="font-size:11px">${r.comercial||'—'}</span>
          </div>
        </td>
        <td style="max-width:160px">
          <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.client}</div>
          <div style="font-size:11px;color:#6b6b67;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.curs}</div>
        </td>
        <td style="white-space:nowrap">
          <div style="display:flex;align-items:center;gap:5px">
            ${f?`<img src="${f.img}" width="22" height="22" style="border-radius:50%;flex-shrink:0;object-fit:cover"/>`:''}
            <span style="font-size:11px">${r.formador}</span>
          </div>
        </td>
        <td style="max-width:220px"><div class="date-pills-row">${datePills}</div><div style="font-size:10px;color:#6b6b67;margin-top:2px">${r.dates.length} sess · ${r.torn}</div></td>
        <td style="white-space:nowrap">
          <span class="badge ${r.estat==='confirmada'?'bg':r.estat==='cancel'?'br':r.estat==='pendent-form'?'bb':r.estat==='vf'?'bpu':'ba'}">${stLabel[r.estat]}</span>
          ${urgent?'<div style="font-size:9px;color:#791F1F;margin-top:2px">⚠ fa '+dies+' d</div>':''}
        </td>
        <td style="font-size:10px;color:#6b6b67;white-space:nowrap">${dies===0?'avui':dies===1?'ahir':'fa '+dies+'d'}<br><span style="font-size:9px">${!r.emailEnviat?'📧 pendent':'📧 enviat'}</span></td>
        <td>
          <div style="display:flex;gap:3px;align-items:center;flex-wrap:nowrap">
            ${r.estat==='pendent-cli'?`<button class="btn-icon" onclick="updR('${r.id}','confirmada')" title="Confirmar client" style="background:#E1F5EE;border-color:#5DCAA5;color:#085041;font-size:11px">✓</button>`:''}
            ${r.estat==='confirmada'?`<button class="btn-icon" onclick="finalitzarVF('${r.id}')" title="Finalitzar i arxivar · VF" style="background:#EEEDFE;border-color:#AFA9EC;color:#3C3489;font-size:9px;font-weight:500;width:32px;white-space:nowrap">VF</button>`:''}
            <button class="btn-icon" onclick="openEmailModal('${r.id}')" title="Email comercial" style="background:#E6F1FB;border-color:#85B7EB;color:#0C447C">
              <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><rect x=".5" y=".5" width="10" height="8" rx="1" stroke="currentColor" stroke-width=".8" fill="none"/><path d=".5 2l5 3.5 5-3.5" stroke="currentColor" stroke-width=".8"/></svg>
            </button>
            ${(()=>{
              // Estat visual dinàmic segons la resposta del formador:
              //   · null/undefined sense email enviat = neutre gris
              //   · null amb email enviat = pendent (groc/ambre)
              //   · true = acceptat (verd amb ✓)
              //   · false = declinat (vermell amb ✕)
              const sent=!!r.emailFormadorEnviat;
              const accepted=r.formadorAccepted;
              let bg='#F4F4F5',border='#D4D4D8',fg='#52525B',badge='',tip='Email formador';
              if(accepted===true){bg='#DCFCE7';border='#22C55E';fg='#15803D';badge='✓';tip='Formador ha ACCEPTAT';}
              else if(accepted===false){bg='#FEE2E2';border='#EF4444';fg='#991B1B';badge='✕';tip='Formador ha DECLINAT';}
              else if(sent){bg='#FEF3C7';border='#F59E0B';fg='#92400E';tip='Email enviat · pendent de resposta';}
              const badgeHtml=badge?`<span style="position:absolute;top:-4px;right:-4px;background:${accepted===true?'#16A34A':'#DC2626'};color:#fff;width:13px;height:13px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;border:1.5px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,0.15)">${badge}</span>`:'';
              return `<button class="btn-icon" onclick="openEmailFormadorFromRes('${r.id}')" title="${tip}" style="background:${bg};border-color:${border};color:${fg};position:relative">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="3.5" r="2.5" stroke="currentColor" stroke-width=".8" fill="none"/><path d="M1 10c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" stroke-width=".8" fill="none"/></svg>
                ${badgeHtml}
              </button>`;
            })()}
            <a href="https://wa.me/?text=${waMsg}" target="_blank" class="btn-icon" title="WhatsApp formador" style="background:#dcfce7;border-color:#86efac;color:#16a34a;text-decoration:none">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" stroke-width=".8"/><path d="M3 7c.4-.8 1.2-2 2.5-2s1.8.8 1.8 1.3-1 .8-1.3.3-.7-1.3-.7-1.3" stroke="currentColor" stroke-width=".6" fill="none"/></svg>
            </a>
            <button class="btn-icon" onclick="gv('canvis',document.getElementById('nb-canvis'));canvisSelReserva('${r.id}')" title="Modificar dates (IA)" style="background:#EEEDFE;border-color:#AFA9EC;color:#3C3489">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M7 1.5l2.5 2.5-6 6H1v-2.5l6-6z" stroke="currentColor" stroke-width=".8" fill="none"/><path d="M6 3l2 2" stroke="currentColor" stroke-width=".8"/></svg>
            </button>
            ${r.estat!=='cancel'&&r.estat!=='vf'?`<button class="btn-icon" onclick="updR('${r.id}','cancel')" title="Cancel·lar" style="color:#A32D2D;border-color:#F09595">✕</button>`:''}
            ${r.estat==='cancel'||r.estat==='vf'?`<button class="btn-icon" onclick="deleteReserva('${r.id}')" title="Eliminar permanentment" style="background:#FCEBEB;border-color:#F09595;color:#791F1F">🗑</button>`:''}
          </div>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

async function deleteReserva(id){
  const r=RESERVES.find(x=>x.id===id);
  if(!r)return;
  const ok=await confirmDialog({
    title:'Eliminar reserva permanentment?',
    message:`<strong>${r.client}</strong> · ${r.curs}<br>Aquesta acció <strong>no es pot desfer</strong>. Es perdran totes les dades d'aquesta reserva.`,
    confirmText:'Sí, eliminar',danger:true,
  });
  if(!ok)return;
  try{
    await fetch('/api/reserves/'+id,{method:'DELETE'});
    RESERVES=RESERVES.filter(x=>x.id!==id);
    renderGest();
    toast('Reserva eliminada permanentment');
  }catch(e){toast('Error: '+e.message);}
}

// ── BULK SELECTION & DELETE ──────────────────────────────────
function bulkUpdateBar(){
  const checked=document.querySelectorAll('.bulk-cb:checked');
  const bar=document.getElementById('bulk-bar');
  const count=document.getElementById('bulk-count');
  if(!bar)return;
  if(checked.length>0){
    bar.style.display='flex';
    if(count)count.textContent=checked.length+' seleccionades';
  }else{
    bar.style.display='none';
  }
  // Sincronitzar el "select all"
  const all=document.querySelectorAll('.bulk-cb');
  const sa=document.getElementById('bulk-select-all');
  if(sa)sa.checked=all.length>0&&checked.length===all.length;
}
function bulkToggleAll(input){
  document.querySelectorAll('.bulk-cb').forEach(cb=>cb.checked=input.checked);
  bulkUpdateBar();
}
function bulkClearSelection(){
  document.querySelectorAll('.bulk-cb').forEach(cb=>cb.checked=false);
  const sa=document.getElementById('bulk-select-all');if(sa)sa.checked=false;
  bulkUpdateBar();
}
async function bulkDeleteReserves(){
  const ids=[...document.querySelectorAll('.bulk-cb:checked')].map(cb=>cb.dataset.id);
  if(!ids.length){toast('Cap reserva seleccionada');return;}
  const ok=await confirmDialog({
    title:`Eliminar ${ids.length} reserva${ids.length===1?'':'s'} permanentment?`,
    message:`Eliminaràs <strong>${ids.length}</strong> reserva${ids.length===1?'':'s'} de l'historial. Aquesta acció <strong>no es pot desfer</strong>.`,
    confirmText:`Sí, eliminar ${ids.length}`,danger:true,
  });
  if(!ok)return;
  let deleted=0;let failed=0;
  for(const id of ids){
    try{
      await fetch('/api/reserves/'+id,{method:'DELETE'});
      RESERVES=RESERVES.filter(x=>x.id!==id);
      deleted++;
    }catch(e){failed++;}
  }
  renderGest();
  toast(failed?`✓ ${deleted} eliminades · ${failed} errors`:`✓ ${deleted} eliminades`);
}

async function updR(id,est){
  const r=RESERVES.find(x=>x.id===id);
  if(!r)return;
  // Confirmar només si és una acció destructiva (cancel·lar)
  if(est==='cancel'){
    const ok=await confirmDialog({
      title:'Cancel·lar reserva?',
      message:`<strong>${r.client}</strong> · ${r.curs}<br>Les ${r.dates?.length||0} sessions s'alliberaran. Aquesta acció es pot revertir canviant l'estat a "Pendent".`,
      confirmText:'Sí, cancel·lar',danger:true,
    });
    if(!ok)return;
  }
  r.estat=est;
  apiPut('reserves/'+id,r);
  renderGest();
  toast({confirmada:'✓ Confirmada','cancel':'Cancel·lada · dates alliberades'}[est]||'Actualitzat');
  // Auto-sync amb Google Calendar quan es confirma (silenciós si no està connectat)
  if(est==='confirmada'){
    fetch('/api/google/sync-reserva',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reservaId:id})})
      .then(x=>x.json()).then(d=>{
        if(d&&d.ok&&d.created&&d.created.length){
          toast('📅 '+d.created.length+' events creats al Google Calendar');
        }
      }).catch(()=>{/* silent */});
  }
}

function finalitzarVF(id){
  const r=RESERVES.find(x=>x.id===id);if(!r)return;
  r.estat='vf';
  r.vfAt=toISO(new Date());
  apiPut('reserves/'+id,r);
  renderGest();
  renderArxiu();
  toast('✓ "'+r.curs+'" finalitzat i arxivat · VF');
}

// ── EMAIL RESUM PENDENTS PER AGENT ──────────────────────────────
// ── RESUM PENDENTS PER AGENT (email independent per cada comercial) ─
let _pendentsAgents=[];
let _pendentsIdx=0;

function openEmailPendentsPerAgent(){
  const pendents=RESERVES.filter(r=>r.estat==='pendent-cli'||r.estat==='pendent-form');
  if(!pendents.length){toast('No hi ha reserves pendents');return;}

  // Agrupar per agent
  const groups={};
  pendents.forEach(r=>{
    const k=r.comercial||'Sense agent';
    if(!groups[k])groups[k]=[];
    groups[k].push(r);
  });

  // Construir array d'agents amb el seu email
  _pendentsAgents=Object.entries(groups).map(([agent,reserves])=>{
    const email=agent.toLowerCase().replace(/\s+/g,'.')+'@gesem.es';
    const avui=new Date().toLocaleDateString('ca-ES',{day:'2-digit',month:'2-digit',year:'numeric'});
    const assumpte=`GESEM Planner · Reserves pendents de confirmació · ${avui}`;
    // Construir cos del missatge
    let cos=`Hola ${agent.split(' ')[0]},\n\n`;
    cos+=`Et fem arribar el recordatori de les teves reserves pendents de confirmació.\n`;
    cos+=`Les dates estan BLOQUEJADES al calendari però necessitem la confirmació del client o el VF per tancar-les.\n\n`;
    cos+=`${'═'.repeat(56)}\n`;
    cos+=`RESERVES PENDENTS · ${agent.toUpperCase()}\n`;
    cos+=`${'═'.repeat(56)}\n\n`;
    reserves.forEach((r,i)=>{
      const ini=r.dates.length?fmtD(parseISO(r.dates[0])):'—';
      const fi=r.dates.length?fmtD(parseISO(r.dates[r.dates.length-1])):'—';
      const dies=daysAgo(r.createdAt);
      const estat=r.estat==='pendent-cli'?'Pendent client':'Pendent formador';
      cos+=`${i+1}. ${r.curs}\n`;
      cos+=`   Client:    ${r.client}\n`;
      cos+=`   Formador:  ${r.formador}\n`;
      cos+=`   Dates:     ${ini} → ${fi} · ${r.dates.length} sessions · ${r.torn}\n`;
      cos+=`   Estat:     ${estat} · fa ${dies} dies\n`;
      cos+=`   Dates bloquejades:\n`;
      r.dates.forEach((d,j)=>{
        const dt=parseISO(d);const dw=dt.getDay()||7;
        cos+=`     Sessió ${String(j+1).padStart(2,' ')}: ${DL[dw]} ${fmtD(dt)}\n`;
      });
      cos+=`\n`;
    });
    cos+=`${'─'.repeat(56)}\n`;
    cos+=`Total: ${reserves.length} reserva${reserves.length!==1?'s':''} pendent${reserves.length!==1?'s':''}\n\n`;
    cos+=`Accions necessàries:\n`;
    cos+=`  ✓ Confirmar amb el client i actualitzar l'estat\n`;
    cos+=`  ✓ Marcar com a VF si el curs ja s'ha impartit\n`;
    cos+=`  ✓ Cancel·lar si el curs no es farà per alliberar les dates\n\n`;
    cos+=`Salutacions,\nEquip de gestió docent\nGESEM digital & SoftSkills · www.gesem.es`;
    return{agent,email,assumpte,cos,reserves};
  });

  _pendentsIdx=0;
  renderPendentsModal();
  document.getElementById('pendents-bg').style.display='flex';
}

function renderPendentsModal(){
  const data=_pendentsAgents[_pendentsIdx];
  if(!data)return;
  const total=_pendentsAgents.length;

  // Subtítol
  document.getElementById('pendents-subtitle').textContent=
    `${data.reserves.length} reserva${data.reserves.length!==1?'s':''} pendent${data.reserves.length!==1?'s':''} · Email ${_pendentsIdx+1} de ${total}`;

  // Navegació per agents (chips)
  const nav=document.getElementById('pendents-nav');
  nav.innerHTML='<span style="font-size:11px;color:#6b6b67;font-weight:500;margin-right:4px">Agent:</span>'+
    _pendentsAgents.map((a,i)=>`
      <button onclick="goToPendentsAgent(${i})" style="padding:3px 10px;border-radius:20px;border:0.5px solid ${i===_pendentsIdx?'#534AB7':'rgba(0,0,0,0.15)'};background:${i===_pendentsIdx?'#EEEDFE':'transparent'};color:${i===_pendentsIdx?'#3C3489':'#6b6b67'};font-size:11px;font-weight:${i===_pendentsIdx?'500':'400'};cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:5px">
        ${a.agent.split(' ')[0]}
        <span style="background:${i===_pendentsIdx?'#534AB7':'rgba(0,0,0,0.12)'};color:${i===_pendentsIdx?'#fff':'#6b6b67'};padding:1px 5px;border-radius:20px;font-size:10px">${a.reserves.length}</span>
      </button>`).join('');

  // Destinatari i assumpte
  document.getElementById('pendents-para').textContent=data.email;
  document.getElementById('pendents-assumpte').textContent=data.assumpte;

  // Cos
  document.getElementById('pendents-cos').value=data.cos;

  // Botons nav
  document.getElementById('pendents-prev-btn').disabled=_pendentsIdx===0;
  document.getElementById('pendents-prev-btn').style.opacity=_pendentsIdx===0?'0.4':'1';
  document.getElementById('pendents-next-btn').disabled=_pendentsIdx===total-1;
  document.getElementById('pendents-next-btn').style.opacity=_pendentsIdx===total-1?'0.4':'1';

  // Progrés
  document.getElementById('pendents-progress').textContent=
    `${_pendentsIdx+1} / ${total} agents comercials`;
}

function goToPendentsAgent(i){_pendentsIdx=i;renderPendentsModal();}
function navPendentsAgent(dir){
  _pendentsIdx=Math.max(0,Math.min(_pendentsAgents.length-1,_pendentsIdx+dir));
  renderPendentsModal();
}
function copyPendentsEmail(){
  const data=_pendentsAgents[_pendentsIdx];if(!data)return;
  const cos=document.getElementById('pendents-cos').value;
  navigator.clipboard.writeText(`Per a: ${data.email}\nAssumpte: ${data.assumpte}\n\n${cos}`)
    .then(()=>toast('Email de '+data.agent.split(' ')[0]+' copiat al porta-retalls'));
}
function markPendentsEnviat(){
  const data=_pendentsAgents[_pendentsIdx];if(!data)return;
  toast('✓ Email de '+data.agent.split(' ')[0]+' marcat com a enviat');
  // Avançar automàticament al següent si n'hi ha
  if(_pendentsIdx<_pendentsAgents.length-1){
    setTimeout(()=>{navPendentsAgent(1);},800);
  }
}

// ── PREVIEW · ABANS DE CREAR LA RESERVA ────────────────────────
// Construeix les mateixes dades que tindria la reserva i mostra el modal
// d'email al comercial. La reserva NO es crea fins que l'usuari clica "Enviar".
function openPreviewBeforeReserva(idx){
  const p=window._pr[idx];if(!p)return;
  // Construïm un objecte "reserva temporal" idèntic al que generarà confP
  const datesPerReserva=(p.confirmedDates&&p.confirmedDates.length>0)?p.confirmedDates:p.dates;
  const tmp={
    id:'(pendent de crear)',
    client:p.client,curs:p.curs,
    formador:p.f.nom,formadorId:p.f.id,formadorEmail:p.f.email,formadorTel:p.f.tel,
    comercial:p.comercial,
    dates:datesPerReserva.map(d=>toISO(d)),
    torn:p.torn,hs:p.hs,ns:p.ns,h:p.h,pc:p.pc,
    cF:p.cF.toFixed(2),cC:p.cC.toFixed(2),
  };
  const sessText=tmp.dates.map((d,i)=>{const dt=parseISO(d);const dw=dt.getDay()||7;return`  Sessió ${String(i+1).padStart(2,' ')}: ${DL[dw]} ${fmtD(dt)} · ${tmp.torn} · ${tmp.hs}h`;}).join('\n');
  document.getElementById('email-modal-title').textContent=`Previsualitzant email al comercial · ${tmp.comercial}`;
  document.getElementById('email-de').value='comunicacions@gesem.cat';
  document.getElementById('email-para').value=getAgentEmail(tmp.comercial);
  document.getElementById('email-assumpte').value=`GESEM Planner · Proposta formació · ${tmp.curs} · ${tmp.client}`;
  document.getElementById('email-cos').value=`Hola ${tmp.comercial},\n\nT'envio la proposta de formació per al client ${tmp.client}.\nDates RESERVADES al sistema, pendents de confirmació del client.\n\nDADES\n${'─'.repeat(44)}\nCurs:     ${tmp.curs}\nClient:   ${tmp.client}\nFormador: ${tmp.formador}\nHores:    ${tmp.h}h · ${tmp.ns} sessions de ${tmp.hs}h · ${tmp.torn}\nTotal:    ${tmp.cC}€\n\nCALENDARI\n${'─'.repeat(44)}\n${sessText}\n\nIMPORTANT: Dates reservades però no confirmades. Si el client no confirma aviat, s'alliberaran.\n\nSalutacions,\nGESEM digital & SoftSkills · www.gesem.es`;
  // Marquem el mode "preview pre-reserva" perquè els botons sàpiguen què fer
  window._previewPendingIdx=idx;
  // Reescrivim els botons inferiors del modal: substituïm "Enviar"/"Marcar com a enviat"
  // pels d'aquesta acció especial (Crear reserva + Enviar / Crear reserva sense enviar)
  const bg=document.getElementById('email-bg');
  const actionsBar=bg?.querySelector('.modal-box > div:last-child');
  if(actionsBar){
    actionsBar.innerHTML=`
      <button class="btn btn-sm" onclick="closeEmail();window._previewPendingIdx=null">Cancel·lar</button>
      <button class="btn btn-sm" onclick="copyEmail()">Copiar text</button>
      <button class="btn btn-sm" style="background:#fff" onclick="confirmPreviewSenseEmail()">Crear reserva sense enviar</button>
      <button class="btn btn-p btn-sm" onclick="confirmPreviewAndSend()">📤 Crear reserva i enviar email</button>
    `;
  }
  document.getElementById('email-bg').style.display='flex';
}

async function confirmPreviewAndSend(){
  const idx=window._previewPendingIdx;
  if(idx==null){toast('Sessió de previsualització perduda');return;}
  // 1) Crear la reserva ara
  const r=confP(idx);
  if(typeof clearPeticioDraft==='function')clearPeticioDraft();
  refreshAllCalendars(r.formadorId).catch(()=>{});
  currentEmailResId=r.id;
  window._previewPendingIdx=null;
  // 2) Enviar l'email amb el contingut actual del modal (sendEmailGeneric llegeix els camps)
  // Reactivem la barra d'accions estàndard perquè sendEmailGeneric/markEmailSent funcionin bé al re-obrir
  const btn=document.querySelector('#email-bg .btn-p');
  if(typeof sendEmailGeneric==='function'){
    await sendEmailGeneric(btn);
  }
  // 3) Marcar com a enviat i tancar
  if(r){r.emailEnviat=true;apiPut('reserves/'+r.id,r);}
  closeEmail();
  // Restaurar barra d'accions per defecte
  resetEmailModalActions();
  if(typeof renderGest==='function')renderGest();
  if(typeof gv==='function')gv('gest',document.getElementById('nb-gest'));
  toast('✅ Reserva creada i email enviat al comercial');
}

function confirmPreviewSenseEmail(){
  const idx=window._previewPendingIdx;
  if(idx==null){toast('Sessió de previsualització perduda');return;}
  const r=confP(idx);
  if(typeof clearPeticioDraft==='function')clearPeticioDraft();
  refreshAllCalendars(r.formadorId).catch(()=>{});
  window._previewPendingIdx=null;
  closeEmail();
  resetEmailModalActions();
  if(typeof renderGest==='function')renderGest();
  toast('Reserva creada sense enviar email · '+r.id);
}

function resetEmailModalActions(){
  const bg=document.getElementById('email-bg');
  const actionsBar=bg?.querySelector('.modal-box > div:last-child');
  if(actionsBar){
    actionsBar.innerHTML=`
      <button class="btn btn-sm" onclick="closeEmail()">Cancel·lar</button>
      <button class="btn btn-sm" onclick="copyEmail()">Copiar text</button>
      <button class="btn btn-p btn-sm" onclick="sendEmailGeneric(this)">📤 Enviar</button>
      <button class="btn btn-p btn-sm" onclick="markEmailSent()">Marcar com a enviat ✓</button>
    `;
  }
}

// ── MODALS EMAIL ────────────────────────────────────────────────
function openEmailModal(resId){
  // Si abans s'havia obert en mode preview, restaurar la barra d'accions estàndard
  resetEmailModalActions();
  currentEmailResId=resId;const r=RESERVES.find(x=>x.id===resId);if(!r)return;
  const sessText=r.dates.map((d,i)=>{const dt=parseISO(d);const dw=dt.getDay()||7;return`  Sessió ${String(i+1).padStart(2,' ')}: ${DL[dw]} ${fmtD(dt)} · ${r.torn} · ${r.hs}h`;}).join('\n');
  document.getElementById('email-modal-title').textContent=`Email al comercial · ${r.comercial}`;
  document.getElementById('email-de').value='comunicacions@gesem.cat';
  document.getElementById('email-para').value=getAgentEmail(r.comercial);
  document.getElementById('email-assumpte').value=`GESEM Planner · Proposta formació · ${r.curs} · ${r.client}`;
  document.getElementById('email-cos').value=`Hola ${r.comercial},\n\nT'envio la proposta de formació per al client ${r.client}.\nDates RESERVADES al sistema, pendents de confirmació del client.\n\nDADES\n${'─'.repeat(44)}\nCurs:     ${r.curs}\nClient:   ${r.client}\nFormador: ${r.formador}\nHores:    ${r.h}h · ${r.ns} sessions de ${r.hs}h · ${r.torn}\nTotal:    ${r.cC}€\n\nCALENDARI\n${'─'.repeat(44)}\n${sessText}\n\nIMPORTANT: Dates reservades però no confirmades. Si el client no confirma aviat, s'alliberaran.\n\nSalutacions,\nGESEM digital & SoftSkills · www.gesem.es`;
  document.getElementById('email-bg').style.display='flex';
}
function openEmailFormadorFromRes(resId){
  const r=RESERVES.find(x=>x.id===resId);if(!r)return;
  window._emailfResId=resId; // exposat per al botó "Enviar amb confirmació"
  window._emailfPendingIdx=null; // ja hi ha reserva, no cal crear-la
  const sessText=r.dates.map((d,i)=>{const dt=parseISO(d);const dw=dt.getDay()||7;return`  Sessió ${String(i+1).padStart(2,' ')}: ${DL[dw]} ${fmtD(dt)} · ${r.torn} · ${r.hs}h`;}).join('\n');
  document.getElementById('emailf-title').textContent=`Email al formador · ${r.formador}`;
  document.getElementById('emailf-para').value=r.formadorEmail||'';
  document.getElementById('emailf-assumpte').value=`Reserva de formació · ${r.curs} · ${r.client}`;
  document.getElementById('emailf-cos').value=`Hola ${r.formador},\n\nConfirmem la reserva per al curs "${r.curs}" del client ${r.client}.\n\nCALENDARI\n${'─'.repeat(40)}\n${sessText}\n\nSi us plau, confirma la recepció d'aquest email amb els botons inferiors.\n\nSalutacions,\nEquip de gestió docent · GESEM digital & SoftSkills`;
  document.getElementById('emailf-bg').style.display='flex';
}
function copyEmail(){const full=`De: ${document.getElementById('email-de').value}\nPer a: ${document.getElementById('email-para').value}\nAssumpte: ${document.getElementById('email-assumpte').value}\n\n${document.getElementById('email-cos').value}`;navigator.clipboard.writeText(full).then(()=>toast(typeof t==="function"?t("toast.copiat"):"Text copiat"));}
function markEmailSent(){if(currentEmailResId){const r=RESERVES.find(x=>x.id===currentEmailResId);if(r){r.emailEnviat=true;apiPut('reserves/'+currentEmailResId,r);}}closeEmail();renderGest();toast(typeof t==="function"?t("toast.email_marked"):"Marcat com a enviat");}
function closeEmail(){document.getElementById('email-bg').style.display='none';}
document.getElementById('email-bg')?.addEventListener('click',e=>{if(e.target===document.getElementById('email-bg'))closeEmail();});
document.getElementById('emailf-bg')?.addEventListener('click',e=>{if(e.target===document.getElementById('emailf-bg'))document.getElementById('emailf-bg').style.display='none';});

// ── CANVIS: MÒDUL COMPLET ────────────────────────────────────────
let canvisSelResId=null,canvisTipus='inici',canvisPendingProp=null,canvisPendingApplyIdx=null;
const TORNS_ALL=['9:30–11:30h','12:00–15:00h','9:00–11:00h','16:00–18:00h'];

function fmtDL(d){const dt=typeof d==='string'?parseISO(d):d;const dw=dt.getDay()||7;return DL[dw]+' '+dt.getDate()+'/'+(dt.getMonth()+1);}
function addDaysISO(iso,n){const d=parseISO(iso);d.setDate(d.getDate()+n);return toISO(d);}

function renderCanvis(){
  const stDot={confirmada:'ed-co','pendent-cli':'ed-pc','pendent-form':'ed-pf',cancel:'ed-ca',vf:'ed-vf'};
  const actives=RESERVES.filter(r=>r.estat!=='cancel'&&r.estat!=='vf');
  document.getElementById('canvis-reserves-list').innerHTML=actives.length?actives.map(r=>`
    <div style="display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:10px;border:${canvisSelResId===r.id?'2px solid #534AB7':'0.5px solid rgba(0,0,0,0.1)'};background:${canvisSelResId===r.id?'#EEEDFE':'#fff'};cursor:pointer;margin-bottom:6px;transition:all .12s" onclick="canvisSelReserva('${r.id}')">
      <span class="estat-dot ${stDot[r.estat]||'ed-pc'}"></span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.curs}</div>
        <div style="font-size:11px;color:#6b6b67;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.client} · ${r.formador}</div>
        <div style="font-size:10px;color:#6b6b67;margin-top:1px">${r.dates.length} sess · ${r.torn}</div>
      </div>
      ${r.canvis&&r.canvis.length?`<span class="badge bpu" style="font-size:9px">${r.canvis.length} canvi${r.canvis.length!==1?'s':''}</span>`:''}
    </div>`).join(''):emptyState({
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
      title:'No hi ha reserves actives',
      desc:'Per fer canvis a una reserva, primer cal que existeixi i estigui en estat actiu.',
      ctaLabel:'Crear reserva →',ctaHref:'/peticio',
    });
}

function canvisSelReserva(id){
  canvisSelResId=id;
  renderCanvis();
  const r=RESERVES.find(x=>x.id===id);if(!r)return;
  document.getElementById('canvis-tipus-section').style.display='';
  document.getElementById('canvis-rc-empty').style.display='none';
  document.getElementById('canvis-rc-content').style.display='';
  renderCanvisForm();
  canvisRenderHist();
  // Mostrar la reserva actual
  document.getElementById('canvis-prop-result').innerHTML=`
    <div style="background:#fff;border:0.5px solid rgba(0,0,0,0.1);border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <img src="${FORMADORS.find(f=>f.id===r.formadorId)?.img||''}" width="36" height="36" style="border-radius:50%;object-fit:cover;flex-shrink:0"/>
        <div>
          <div style="font-size:13px;font-weight:500">${r.curs} · ${r.client}</div>
          <div style="font-size:11px;color:#6b6b67">${r.formador} · ${r.dates.length} sessions de ${r.hs}h · ${r.torn}</div>
        </div>
      </div>
      <div style="font-size:11px;color:#6b6b67;margin-bottom:6px">Sessions actuals:</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${r.dates.map(d=>`<span style="padding:2px 6px;border-radius:4px;font-size:10px;background:#f5f4f0;color:#6b6b67;border:0.5px solid rgba(0,0,0,0.1)">${fmtDL(d)}</span>`).join('')}</div>
    </div>
    <div style="background:#EEEDFE;border-radius:10px;padding:11px 13px;font-size:12px;color:#3C3489">Selecciona el tipus de canvi i omple el formulari. La IA analitzarà totes les opcions disponibles.</div>`;
  showCanvisTab('prop',document.getElementById('canvis-tab-prop-btn'));
}

function selCanviTipus(tipus,btn){
  canvisTipus=tipus;
  document.querySelectorAll('[id^="ctb-"]').forEach(b=>{b.style.border='0.5px solid rgba(0,0,0,0.15)';b.style.background='transparent';b.querySelector('span:nth-child(2)').style.color='#1a1a1a';});
  btn.style.border='2px solid #534AB7';btn.style.background='#EEEDFE';btn.querySelector('span:nth-child(2)').style.color='#3C3489';
  renderCanvisForm();
}

function renderCanvisForm(){
  const r=RESERVES.find(x=>x.id===canvisSelResId);if(!r)return;
  const fc=document.getElementById('canvis-form-dinamic');
  const inputStyle='padding:6px 9px;border:0.5px solid rgba(0,0,0,0.18);border-radius:8px;background:#f5f4f0;color:#1a1a1a;font-size:13px;width:100%;font-family:inherit;margin-bottom:7px';
  if(canvisTipus==='inici'){
    fc.innerHTML=`<div class="fi"><label>Nova data d'inici desitjada</label><input type="date" id="canvis-fc-inici" value="${r.dates[0]||''}" style="${inputStyle}"/></div>
    <div style="font-size:11px;color:#6b6b67;margin-bottom:8px;background:#f5f4f0;padding:7px 9px;border-radius:8px">Mantindrà la distribució original (${(r.dist||[2,4]).map(d=>DL[d]).join('·')}) recalculant des de la nova data.</div>`;
  }else if(canvisTipus==='data'){
    fc.innerHTML=`<div class="fi"><label>Sessions a modificar</label>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${r.dates.map((d,i)=>`<label style="display:flex;align-items:center;gap:4px;cursor:pointer;background:#f5f4f0;padding:4px 8px;border-radius:20px;border:0.5px solid rgba(0,0,0,0.12)"><input type="checkbox" value="${d}" id="canvis-cs-${i}" style="accent-color:#534AB7;width:auto"/> <span style="font-size:11px">${fmtDL(d)}</span></label>`).join('')}
      </div></div>
      <div class="fi"><label>Data de referència</label><input type="date" id="canvis-fc-inici" value="${r.dates[0]||''}" style="${inputStyle}"/></div>`;
  }else if(canvisTipus==='horari'){
    fc.innerHTML=`<div class="fi"><label>Nou torn preferit</label>
      <select id="canvis-fc-torn" style="${inputStyle}">${TORNS_ALL.map(t=>`<option value="${t}" ${t===r.torn?'selected':''}>${t}</option>`).join('')}<option value="Qualsevol">Qualsevol torn disponible</option></select></div>
    <div style="font-size:11px;color:#6b6b67;margin-bottom:8px;background:#FAEEDA;padding:7px 9px;border-radius:8px">⚠ El canvi d'horari requerirà confirmació del formador.</div>`;
  }else if(canvisTipus==='tot'){
    fc.innerHTML=`<div class="g2" style="margin-bottom:7px">
      <div class="fi"><label>Nova data d'inici</label><input type="date" id="canvis-fc-inici" value="" style="${inputStyle}"/></div>
      <div class="fi"><label>Nova distribució</label>
        <select id="canvis-fc-dist" style="${inputStyle}"><option value="2,4">Dm·Dj</option><option value="1,3">Dl·Dc</option><option value="3,5">Dc·Dv</option><option value="1,4">Dl·Dj</option><option value="1,3,5">Dl·Dc·Dv</option><option value="3">Dimecres</option></select></div>
    </div>
    <div class="fi"><label>Nou torn (opcional)</label>
      <select id="canvis-fc-torn" style="${inputStyle}"><option value="">Mantenir torn actual (${r.torn})</option>${TORNS_ALL.map(t=>`<option value="${t}">${t}</option>`).join('')}</select></div>`;
  }
}

async function runCanvisIA(){
  const r=RESERVES.find(x=>x.id===canvisSelResId);if(!r)return;
  const motiu=document.getElementById('canvis-motiu').value||'Canvi sol·licitat pel client';
  const canviFormOpt=document.getElementById('canvis-form-opt').value;
  let novaInici=r.dates[0],novaDistRaw=r.dist||[2,4],nouTorn=r.torn,sessionsACanviar=[];
  if(canvisTipus==='inici'||canvisTipus==='tot'){novaInici=document.getElementById('canvis-fc-inici')?.value||addDaysISO(r.dates[r.dates.length-1],7);}
  if(canvisTipus==='data'){novaInici=document.getElementById('canvis-fc-inici')?.value||r.dates[0];document.querySelectorAll('[id^="canvis-cs-"]:checked').forEach(cb=>sessionsACanviar.push(cb.value));if(!sessionsACanviar.length)sessionsACanviar=r.dates.slice();}
  if(canvisTipus==='horari'){nouTorn=document.getElementById('canvis-fc-torn')?.value||r.torn;}
  if(canvisTipus==='tot'){const dv=document.getElementById('canvis-fc-dist')?.value||'2,4';novaDistRaw=dv.split(',').map(Number);const tv=document.getElementById('canvis-fc-torn')?.value||'';if(tv)nouTorn=tv;}
  document.getElementById('canvis-ia-spin').style.display='inline-block';
  document.getElementById('canvis-ia-icon').style.display='none';
  showCanvisTab('prop',document.getElementById('canvis-tab-prop-btn'));
  document.getElementById('canvis-prop-result').innerHTML=`<div style="text-align:center;padding:30px;color:#3C3489;font-size:13px"><span class="spinner" style="width:20px;height:20px;border-width:2.5px;margin-right:8px;border-top-color:#534AB7"></span>Analitzant amb IA · Llama 3.3 70B...</div>`;

  // Intent IA real (Groq) primer; fallback a heurística si falla
  let props;
  try{
    const res=await fetch('/api/ai/suggest-changes',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({reservaId:r.id,tipus:canvisTipus,motiu}),
    });
    const data=await res.json();
    if(!res.ok||!data.ok||!data.parsed?.propostes)throw new Error(data.error||'Sense propostes');
    // Mapejar les propostes IA al format que espera canvisRenderPropostes
    props=data.parsed.propostes.map(p=>{
      const formador=FORMADORS.find(f=>f.nom===p.formadorNom)||FORMADORS.find(f=>f.id===r.formadorId);
      const dates=(p.novesDates||[]).map(d=>parseISO(d));
      return{
        tipus:canvisTipus,
        label:p.label,
        sublabel:p.sublabel,
        formador,
        torn:p.nouTorn||r.torn,
        dates,
        canviForm:!!p.canviForm,
        canviTorn:!!p.canviTorn,
        canviDates:!!p.canviDates,
        score:p.score||50,
        color:p.color||'opt2',
        motiu,
        desc:p.desc||'',
        _aiRaonament:p.raonament,
        _aiModel:data.model,
        _aiMs:data.ms,
      };
    });
  }catch(e){
    console.warn('IA suggest-changes fallida, fallback heurística:',e.message);
    props=canvisGenerarPropostes(r,canvisTipus,novaInici,novaDistRaw,nouTorn,sessionsACanviar,motiu,canviFormOpt);
  }finally{
    document.getElementById('canvis-ia-spin').style.display='none';
    document.getElementById('canvis-ia-icon').style.display='';
  }

  canvisPendingProp={r,props,motiu,tipusCanvi:canvisTipus,nouTorn,sessionsACanviar};
  canvisRenderPropostes(props,r,motiu);
}

function canvisGenerarPropostes(r,tipus,novaInici,dist,torn,sessACanviar,motiu,canviFormOpt){
  const allResISO=new Set(RESERVES.filter(x=>x.id!==r.id&&x.estat!=='cancel').flatMap(x=>x.dates));
  const formActual=FORMADORS.find(f=>f.id===r.formadorId);
  const props=[];

  if(tipus==='horari'){
    props.push({tipus:'horari',label:'Canvi de torn · mateix formador',sublabel:'Solució recomanada',formador:formActual,torn,dates:r.dates.slice(),canviForm:false,canviTorn:true,canviDates:false,score:95,color:'best',motiu,desc:`Mateixa distribució de dates, nou torn ${torn}.`});
    const fAlt=FORMADORS.find(f=>f.id!==r.formadorId&&f.specs.some(s=>formActual?.specs.includes(s))&&f.disp!=='baixa');
    if(fAlt)props.push({tipus:'horari',label:`${fAlt.nom} · nou torn`,sublabel:'Si el formador no pot al nou torn',formador:fAlt,torn,dates:r.dates.slice(),canviForm:true,canviTorn:true,canviDates:false,score:80,color:'opt2',motiu,desc:`Formador alternatiu amb disponibilitat al torn ${torn}.`});
    return props;
  }
  // Proposta 1: formador actual + noves dates
  if(formActual&&formActual.disp!=='baixa'){
    const nd=buildDates(novaInici,r.ns||r.dates.length,dist,allResISO);
    if(nd.length>0)props.push({tipus,label:`${formActual.nom} · noves dates`,sublabel:'Recomanada · mateix formador',formador:formActual,torn,dates:nd,canviForm:false,canviTorn:torn!==r.torn,canviDates:true,score:95,color:'best',motiu,desc:`Mantenim el formador actual. Nova distribució des de ${fmtDL(novaInici||nd[0])}.`});
  }
  // Proposta 2: formador actual + distribució alternativa
  if(formActual){
    const altDist=dist.map(d=>d<5?d+1:1).filter((v,i,a)=>a.indexOf(v)===i);
    const nd2=buildDates(novaInici||r.dates[0],r.ns||r.dates.length,altDist,allResISO);
    if(nd2.length>0&&JSON.stringify(altDist)!==JSON.stringify(dist))props.push({tipus,label:`${formActual.nom} · dies alternatius`,sublabel:'Canvia distribució de dies',formador:formActual,torn,dates:nd2,dist:altDist,canviForm:false,canviTorn:torn!==r.torn,canviDates:true,score:82,color:'opt2',motiu,desc:`Mateixa formadora, dies ${altDist.map(d=>DL[d]).join('·')} en lloc de ${dist.map(d=>DL[d]).join('·')}.`});
  }
  // Proposta 3: formador alternatiu
  if(canviFormOpt!=='no'){
    const fAlt=FORMADORS.filter(f=>f.id!==r.formadorId&&f.specs.some(s=>formActual?.specs.includes(s))&&f.disp==='alta').sort((a,b)=>parseFloat(b.rating)-parseFloat(a.rating))[0];
    if(fAlt){const nd3=buildDates(novaInici||r.dates[0],r.ns||r.dates.length,dist,allResISO);if(nd3.length>0)props.push({tipus,label:`${fAlt.nom} · alta disponibilitat`,sublabel:'Canvi de formador recomanat',formador:fAlt,torn,dates:nd3,canviForm:true,canviTorn:torn!==r.torn,canviDates:true,score:78,color:'opt3',motiu,desc:`Formador/a alternatiu/va amb alta disponibilitat. ★${fAlt.rating}`});}
  }
  // Proposta 4: inici molt posterior
  const iniLluny=addDaysISO(r.dates[r.dates.length-1],21);
  const nd4=buildDates(iniLluny,r.ns||r.dates.length,dist,allResISO);
  const f4=canviFormOpt==='prioritat'?(FORMADORS.filter(f=>f.specs.some(s=>formActual?.specs.includes(s))&&f.disp==='alta').sort((a,b)=>parseFloat(b.rating)-parseFloat(a.rating))[0]||formActual):formActual;
  if(nd4.length>0)props.push({tipus,label:`Inici ${fmtDL(iniLluny)} · màxima flexibilitat`,sublabel:'Opció de darrer recurs',formador:f4,torn,dates:nd4,canviForm:f4?.id!==r.formadorId,canviTorn:torn!==r.torn,canviDates:true,score:60,color:'opt-alt',motiu,desc:`Planificació posterior per assegurar disponibilitat sense restriccions.`});
  return props;
}

function canvisRenderPropostes(props,r,motiu){
  if(!props.length){document.getElementById('canvis-prop-result').innerHTML=`<div style="background:#FCEBEB;border-radius:10px;padding:14px;color:#791F1F;font-size:13px">No s'han trobat alternatives. Prova canviant la data d'inici o permetent canvi de formador.</div>`;return;}
  const colorMap={best:'1a opció recomanada',opt2:'2a opció',opt3:'3a opció','opt-alt':'Contingència'};
  const bgMap={best:'#E1F5EE',opt2:'#E6F1FB',opt3:'#EEEDFE','opt-alt':'#FAEEDA'};
  const tcMap={best:'#085041',opt2:'#0C447C',opt3:'#3C3489','opt-alt':'#633806'};
  document.getElementById('canvis-prop-result').innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px">
      <div style="font-size:13px;font-weight:500">${props.length} propostes de canvi</div>
      <div style="font-size:11px;color:#6b6b67">Selecciona la millor opció</div>
    </div>
    ${props.map((p,i)=>{
      const canviTags=[];
      if(p.canviForm)canviTags.push(`<span class="badge ba" style="font-size:9px">Canvi formador</span>`);
      if(p.canviTorn)canviTags.push(`<span class="badge bb" style="font-size:9px">Canvi torn</span>`);
      if(p.canviDates)canviTags.push(`<span class="badge bgr" style="font-size:9px">Noves dates</span>`);
      const sessOld=r.dates.slice(0,5),sessNew=p.dates.slice(0,5);
      return`<div style="background:#fff;border:0.5px solid rgba(0,0,0,0.1);border-radius:12px;overflow:hidden;margin-bottom:10px;${p.color==='best'?'border:2px solid #1D9E75':''}">
        <div style="padding:11px 13px;border-bottom:0.5px solid rgba(0,0,0,0.07);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:9px">
            <img src="${p.formador?.img||''}" width="34" height="34" style="border-radius:50%;object-fit:cover;flex-shrink:0"/>
            <div><div style="font-size:13px;font-weight:500">${p.label}</div><div style="font-size:11px;color:#6b6b67">${p.sublabel}</div></div>
          </div>
          <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
            <span style="background:${bgMap[p.color]};color:${tcMap[p.color]};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500">${colorMap[p.color]}</span>
            <span style="background:#f5f4f0;color:#6b6b67;padding:2px 7px;border-radius:20px;font-size:10px">${p.score}% compat.</span>
            ${canviTags.join('')}
          </div>
        </div>
        <div style="padding:11px 13px">
          <div style="font-size:12px;color:#6b6b67;margin-bottom:8px">${p.desc}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div style="background:#FCEBEB;border:0.5px solid #F09595;border-radius:8px;padding:9px">
              <div style="font-size:10px;font-weight:500;color:#791F1F;margin-bottom:5px">Sessions anteriors</div>
              <div style="display:flex;flex-wrap:wrap;gap:3px">${sessOld.map(d=>`<span style="padding:2px 6px;border-radius:4px;font-size:10px;background:#FCEBEB;color:#791F1F;border:0.5px solid #F09595;text-decoration:line-through;opacity:.7">${fmtDL(d)}</span>`).join('')}${r.dates.length>5?`<span style="font-size:10px;color:#791F1F">+${r.dates.length-5} més</span>`:''}</div>
            </div>
            <div style="background:#E1F5EE;border:0.5px solid #5DCAA5;border-radius:8px;padding:9px">
              <div style="font-size:10px;font-weight:500;color:#085041;margin-bottom:5px">Nova proposta</div>
              <div style="display:flex;flex-wrap:wrap;gap:3px">${sessNew.map(d=>`<span style="padding:2px 6px;border-radius:4px;font-size:10px;background:#E1F5EE;color:#085041;border:0.5px solid #5DCAA5">${fmtDL(d)}</span>`).join('')}${p.dates.length>5?`<span style="font-size:10px;color:#085041">+${p.dates.length-5} més</span>`:''}
                ${p.canviTorn?`<div style="font-size:10px;color:#0C447C;margin-top:4px;width:100%">Torn: ${p.torn}</div>`:''}
              </div>
            </div>
          </div>
          <div style="font-size:11px;color:#6b6b67;display:flex;align-items:center;gap:6px">
            <img src="${p.formador?.img||''}" width="20" height="20" style="border-radius:50%;object-fit:cover"/>
            ${p.formador?.nom||'—'} · ★${p.formador?.rating||'—'} · ${p.formador?.preu_hora||'—'}€/h · Disp. ${p.formador?.disp||'—'}
          </div>
        </div>
        <div style="padding:9px 13px;border-top:0.5px solid rgba(0,0,0,0.07);background:#f5f4f0;display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="canvisOpenApplyModal(${i})">Vista prèvia</button>
          <button class="btn btn-sm" style="background:#E6F1FB;border-color:#85B7EB;color:#0C447C" onclick="canvisPrepareEmail(${i})">Preparar email</button>
          <button class="btn btn-p btn-sm" onclick="canvisApplyProp(${i})">Aplicar i notificar</button>
        </div>
      </div>`;
    }).join('')}`;
}

function canvisOpenApplyModal(idx){
  canvisPendingApplyIdx=idx;
  const p=canvisPendingProp.props[idx];const r=canvisPendingProp.r;
  document.getElementById('canvis-apply-title').textContent=`Vista prèvia · ${p.label}`;
  document.getElementById('canvis-apply-body').innerHTML=`
    <div style="margin-bottom:12px">
      <div style="font-size:12px;color:#6b6b67;margin-bottom:5px">Comparativa completa:</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:#FCEBEB;border:0.5px solid #F09595;border-radius:8px;padding:9px">
          <div style="font-size:10px;font-weight:500;color:#791F1F;margin-bottom:5px">DATES ANTERIORS</div>
          ${r.dates.map(d=>`<div style="font-size:11px;color:#791F1F;padding:2px 0">— ${fmtDL(d)} · ${r.torn}</div>`).join('')}
        </div>
        <div style="background:#E1F5EE;border:0.5px solid #5DCAA5;border-radius:8px;padding:9px">
          <div style="font-size:10px;font-weight:500;color:#085041;margin-bottom:5px">DATES NOVES ✓</div>
          ${p.dates.map(d=>`<div style="font-size:11px;color:#085041;padding:2px 0">✓ ${fmtDL(d)} · ${p.torn}</div>`).join('')}
        </div>
      </div>
    </div>
    ${p.canviForm?`<div style="background:#FAEEDA;border-radius:8px;padding:8px 11px;font-size:12px;color:#633806;margin-bottom:8px">⚠ Canvi de formador: ${r.formador} → ${p.formador?.nom}</div>`:''}
    <div style="font-size:12px;color:#6b6b67">Motiu: <strong style="color:#1a1a1a">${canvisPendingProp.motiu||'No especificat'}</strong></div>`;
  document.getElementById('canvis-apply-bg').style.display='flex';
}

function canvisApplyProp(idx){canvisPendingApplyIdx=idx;canvisApplyChange();}

function canvisApplyChange(){
  if(canvisPendingApplyIdx===null||!canvisPendingProp)return;
  const p=canvisPendingProp.props[canvisPendingApplyIdx];const r=canvisPendingProp.r;
  const antigas=r.dates.slice();
  r.dates=p.dates.map(d=>typeof d==='string'?d:toISO(d));
  if(p.canviTorn)r.torn=p.torn;
  if(p.canviForm&&p.formador){r.formador=p.formador.nom;r.formadorId=p.formador.id;r.formadorEmail=p.formador.email;}
  if(!r.canvis)r.canvis=[];
  r.canvis.push({data:toISO(new Date()),tipus:canvisPendingProp.tipusCanvi,motiu:canvisPendingProp.motiu,label:p.label,antigas,noves:r.dates});
  apiPut('reserves/'+r.id,r);
  document.getElementById('canvis-apply-bg').style.display='none';
  renderCanvis();renderGest();canvisRenderHist();
  canvisSelReserva(r.id);
  toast('Canvi aplicat · '+r.dates.length+' sessions actualitzades');
}

function canvisApplyAndEmail(){canvisApplyChange();setTimeout(()=>canvisPrepareEmail(canvisPendingApplyIdx||0),300);}

function canvisPrepareEmail(idx){
  const p=canvisPendingProp?.props[idx];const r=canvisPendingProp?.r;if(!p||!r)return;
  showCanvisTab('email',document.getElementById('canvis-tab-email-btn'));
  const sessOldText=(r.canvis&&r.canvis.length?r.canvis[r.canvis.length-1].antigas:r.dates).map((d,i)=>`  Sessió ${String(i+1).padStart(2,' ')}: ${fmtDL(d)} · ${r.torn}`).join('\n');
  const sessNewText=p.dates.map((d,i)=>`  Sessió ${String(i+1).padStart(2,' ')}: ${fmtDL(d)} · ${p.torn}`).join('\n');
  const canviMsg=p.canviForm?`\nIMPORTANT: El formador ha canviat de ${r.formador} a ${p.formador?.nom}. El perfil i l'especialitat es mantenen.\n`:'';
  const cos=`Hola ${r.comercial},\n\nT'informem d'un canvi en les dates de la formació del client ${r.client}.\n\nMOTIU DEL CANVI: ${canvisPendingProp.motiu||'Petició del client'}\n\n${'═'.repeat(52)}\nDATES ANTERIORS\n${'═'.repeat(52)}\n${sessOldText}\n\n${'═'.repeat(52)}\nNOVA PROPOSTA DE DATES ✓\n${'═'.repeat(52)}\n${sessNewText}\n${canviMsg}\nDETALLS\n${'─'.repeat(44)}\nCurs:     ${r.curs}\nClient:   ${r.client}\nFormador: ${p.formador?.nom||r.formador}\nHores:    ${r.h}h · ${r.ns} sessions de ${r.hs}h · ${p.torn}\n\nSi us plau, confirma amb el client l'acceptació d'aquesta nova proposta.\n\nSalutacions,\nEquip de gestió docent · GESEM digital & SoftSkills · www.gesem.es`;
  document.getElementById('canvis-email-wrap').innerHTML=`
    <div style="background:#fff;border:0.5px solid rgba(0,0,0,0.1);border-radius:12px;overflow:hidden">
      <div style="background:#f5f4f0;padding:10px 13px;border-bottom:0.5px solid rgba(0,0,0,0.08)">
        <div style="font-size:11px;font-weight:500;margin-bottom:6px">Email de canvi de dates · editable</div>
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:0.5px solid rgba(0,0,0,0.05);font-size:12px"><label style="font-size:10px;color:#6b6b67;font-weight:500;width:60px;flex-shrink:0">De</label><input value="comunicacions@gesem.cat" style="flex:1;border:none;background:transparent;color:#1a1a1a;font-size:12px;font-family:inherit;outline:none"/></div>
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:0.5px solid rgba(0,0,0,0.05);font-size:12px"><label style="font-size:10px;color:#6b6b67;font-weight:500;width:60px;flex-shrink:0">Per a</label><input id="canvis-em-para" value="${getAgentEmail(r.comercial)}; ${p.formador?.email||r.formadorEmail||''}" style="flex:1;border:none;background:transparent;color:#1a1a1a;font-size:12px;font-family:inherit;outline:none"/></div>
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px"><label style="font-size:10px;color:#6b6b67;font-weight:500;width:60px;flex-shrink:0">Assumpte</label><input id="canvis-em-assumpte" value="Canvi de dates · ${r.curs} · ${r.client}" style="flex:1;border:none;background:transparent;color:#1a1a1a;font-size:12px;font-family:inherit;outline:none"/></div>
      </div>
      <div style="padding:13px">
        <textarea id="canvis-em-cos" style="width:100%;min-height:280px;border:none;background:transparent;color:#1a1a1a;font-size:12px;font-family:'Courier New',monospace;resize:vertical;outline:none;line-height:1.7">${cos}</textarea>
      </div>
    </div>
    <div style="display:flex;gap:7px;justify-content:space-between;margin-top:8px;flex-wrap:wrap">
      <button class="btn btn-sm" style="background:#E1F5EE;border-color:#5DCAA5;color:#085041" onclick="canvisPrepareEmailFormador(${idx})">Email formador separat</button>
      <div style="display:flex;gap:5px">
        <button class="btn btn-sm" onclick="canvisCopyEmail()">Copiar text</button>
        <button class="btn btn-p btn-sm" onclick="toast('Email de canvi marcat com a enviat ✓')">Marcat com a enviat ✓</button>
      </div>
    </div>`;
}

function canvisPrepareEmailFormador(idx){
  const p=canvisPendingProp?.props[idx];const r=canvisPendingProp?.r;if(!p||!r)return;
  showCanvisTab('email',document.getElementById('canvis-tab-email-btn'));
  const sessText=p.dates.map((d,i)=>`  Sessió ${String(i+1).padStart(2,' ')}: ${fmtDL(d)} · ${p.torn}`).join('\n');
  document.getElementById('canvis-email-wrap').innerHTML=`
    <div style="background:#E1F5EE;border:0.5px solid #5DCAA5;border-radius:8px;padding:8px 11px;margin-bottom:8px;font-size:12px;color:#085041">Email directe al formador · independent del comercial</div>
    <div style="background:#fff;border:0.5px solid rgba(0,0,0,0.1);border-radius:12px;overflow:hidden">
      <div style="background:#f5f4f0;padding:10px 13px;border-bottom:0.5px solid rgba(0,0,0,0.08)">
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px"><label style="font-size:10px;color:#6b6b67;font-weight:500;width:60px;flex-shrink:0">Per a</label><input value="${p.formador?.email||''}" style="flex:1;border:none;background:transparent;color:#1a1a1a;font-size:12px;font-family:inherit;outline:none"/></div>
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px"><label style="font-size:10px;color:#6b6b67;font-weight:500;width:60px;flex-shrink:0">Assumpte</label><input value="Actualització dates · ${r.curs} · ${r.client}" style="flex:1;border:none;background:transparent;color:#1a1a1a;font-size:12px;font-family:inherit;outline:none"/></div>
      </div>
      <div style="padding:13px">
        <textarea style="width:100%;min-height:200px;border:none;background:transparent;color:#1a1a1a;font-size:13px;font-family:inherit;resize:vertical;outline:none;line-height:1.65">Hola ${p.formador?.nom},\n\nT'informem que les dates del curs "${r.curs}" per al client ${r.client} han canviat.\n\nNOVES DATES ASSIGNADES\n${'─'.repeat(40)}\n${sessText}\n\nSi tens algun impediment amb alguna d'aquestes dates, si us plau contacta'ns.\n\nGràcies.\nEquip de gestió docent · GESEM digital & SoftSkills</textarea>
      </div>
    </div>
    <div style="display:flex;gap:7px;justify-content:space-between;margin-top:8px">
      <button class="btn btn-sm" onclick="canvisPrepareEmail(${idx})">← Tornar al comercial</button>
      <button class="btn btn-p btn-sm" onclick="toast('Email formador marcat com enviat ✓')">Marcat com a enviat ✓</button>
    </div>`;
}

function canvisCopyEmail(){
  const cos=document.getElementById('canvis-em-cos')?.value||'';
  const assumpte=document.getElementById('canvis-em-assumpte')?.value||'';
  const para=document.getElementById('canvis-em-para')?.value||'';
  navigator.clipboard.writeText(`Per a: ${para}\nAssumpte: ${assumpte}\n\n${cos}`).then(()=>toast('Text copiat al porta-retalls'));
}

function canvisRenderHist(){
  const r=RESERVES.find(x=>x.id===canvisSelResId);if(!r)return;
  const el=document.getElementById('canvis-hist-content');if(!el)return;
  if(!r.canvis||!r.canvis.length){el.innerHTML='<div style="font-size:12px;color:#6b6b67;padding:8px 0">Sense canvis registrats per a aquesta reserva.</div>';return;}
  el.innerHTML=[{data:r.createdAt,motiu:'Reserva creada',label:'Creació inicial',noves:[]},{...r.canvis[r.canvis.length-1]},...r.canvis.slice(0,-1)].map(c=>`
    <div style="padding:8px 11px;border-left:2px solid ${c.label==='Creació inicial'?'#1D9E75':'#534AB7'};margin-bottom:6px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px">
        <span style="font-size:12px;font-weight:500">${c.label}</span>
        <span style="font-size:10px;color:#6b6b67">${c.data}</span>
      </div>
      <div style="font-size:11px;color:#6b6b67;margin-bottom:4px">Motiu: ${c.motiu||'—'}</div>
      ${c.noves&&c.noves.length?`<div style="display:flex;flex-wrap:wrap;gap:3px">${c.noves.slice(0,6).map(d=>`<span style="padding:2px 6px;border-radius:4px;font-size:10px;background:#E1F5EE;color:#085041;border:0.5px solid #5DCAA5">${fmtDL(d)}</span>`).join('')}${c.noves.length>6?`<span style="font-size:10px;color:#085041">+${c.noves.length-6} més</span>`:''}</div>`:''}
    </div>`).join('');
}

function showCanvisTab(id,btn){
  ['prop','email','hist'].forEach(t=>{const el=document.getElementById('canvis-tab-'+t+'-content');if(el)el.style.display=t===id?'block':'none';});
  ['canvis-tab-prop-btn','canvis-tab-email-btn','canvis-tab-hist-btn'].forEach(t=>{const el=document.getElementById(t);if(!el)return;const isAct=t.includes(id);el.style.background=isAct?'#534AB7':'';el.style.borderColor=isAct?'#534AB7':'';el.style.color=isAct?'#fff':'';});
  if(id==='hist')canvisRenderHist();
}

document.getElementById('canvis-apply-bg')?.addEventListener('click',e=>{if(e.target===document.getElementById('canvis-apply-bg'))document.getElementById('canvis-apply-bg').style.display='none';});

// ── ARXIU VF ────────────────────────────────────────────────────
function renderArxiu(){
  const arxivats=RESERVES.filter(r=>r.estat==='vf').sort((a,b)=>(b.vfAt||'').localeCompare(a.vfAt||''));
  const el=document.getElementById('arxiu-list');
  const cnt=document.getElementById('arxiu-count');
  if(cnt)cnt.textContent=arxivats.length+' curs'+(arxivats.length!==1?'os':'')+' arxivat'+(arxivats.length!==1?'s':'');
  if(!el)return;
  if(!arxivats.length){
    el.innerHTML=emptyState({
      icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
      title:'Cap curs arxivat encara',
      desc:'Quan finalitzis cursos, apareixeran aquí amb tot l\'històric.',
    });
    return;
  }
  el.innerHTML=arxivats.map(r=>`
    <div style="background:#fff;border:0.5px solid rgba(0,0,0,0.1);border-left:3px solid #534AB7;border-radius:12px;padding:11px 14px;margin-bottom:7px;opacity:.85">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:9px">
          <img src="${FORMADORS.find(f=>f.id===r.formadorId)?.img||''}" width="28" height="28" style="border-radius:50%;object-fit:cover;flex-shrink:0"/>
          <div>
            <div style="font-size:12px;font-weight:500">${r.curs} · <span style="color:#6b6b67;font-weight:400">${r.client}</span></div>
            <div style="font-size:11px;color:#6b6b67">${r.formador} · ${r.dates.length} sessions · ${r.torn} · Arxivat: ${r.vfAt||'—'}</div>
          </div>
        </div>
        <div style="display:flex;gap:5px;align-items:center">
          <span style="background:#EEEDFE;color:#3C3489;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500">VF</span>
          <span style="font-size:11px;color:#6b6b67">Cost: ${r.cF}€ · Marge: ${r.marge}%</span>
        </div>
      </div>
    </div>`).join('');
}

// ── ENTRADES: NAVEGACIÓ TABS ────────────────────────────────────
function showEntradaTab(id,btn){
  ['manual','email','massiu'].forEach(t=>{
    const el=document.getElementById('etab-'+t+'-content');if(el)el.style.display=t===id?'block':'none';
  });
  ['etab-manual-btn','etab-email-btn','etab-massiu-btn'].forEach(t=>{
    const el=document.getElementById(t);if(!el)return;
    const isAct=t.includes(id);
    el.style.background=isAct?'#1D9E75':'';
    el.style.borderColor=isAct?'#1D9E75':'';
    el.style.color=isAct?'#fff':'';
  });
}

// ── ENTRADES: CANAL B - EMAIL ────────────────────────────────────
function clearEmailEntrada(){
  const el=document.getElementById('email-entrada-text');if(el)el.value='';
  document.getElementById('email-extraccio-result').innerHTML=`
    <div style="background:#fff;border:0.5px solid rgba(0,0,0,0.1);border-radius:12px;padding:20px;text-align:center;color:#6b6b67;min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
      <div style="font-size:13px;font-weight:500;color:#1a1a1a">Resultat de l'extracció</div>
      <div style="font-size:12px">Enganxa un email i clica "Analitzar amb IA"</div>
    </div>`;
}

async function processarEmailEntrada(){
  const text=document.getElementById('email-entrada-text')?.value?.trim();
  if(!text){toast('Enganxa el text del correu primer');return;}
  document.getElementById('email-ia-spin').style.display='inline-block';
  document.getElementById('email-ia-icon').style.display='none';
  document.getElementById('email-extraccio-result').innerHTML=`<div style="text-align:center;padding:30px;color:#3C3489;font-size:13px"><span class="spinner" style="margin-right:8px;border-top-color:#534AB7"></span>Analitzant el missatge amb IA...</div>`;

  try{
    // Intent 1: IA real (Groq + Llama 3.3 70B)
    const res=await fetch('/api/ai/parse-email',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text}),
    });
    const data=await res.json();
    if(!res.ok||!data.ok){
      // Fallback a heurística si l'IA falla
      console.warn('IA error, fallback heurística:',data.error);
      const extracted=extractFromEmail(text);
      renderEmailExtraccio(extracted);
      toast('IA no disponible · usant heurística');
      return;
    }
    // Adaptar la resposta de l'IA al format de renderEmailExtraccio
    const p=data.parsed;
    const distMap={
      'Dilluns,Dimecres':{v:[1,3],l:'Dl·Dc'},
      'Dimarts,Dijous':{v:[2,4],l:'Dm·Dj'},
      'Dimecres,Divendres':{v:[3,5],l:'Dc·Dv'},
      'Dilluns,Dimecres,Divendres':{v:[1,3,5],l:'Dl·Dc·Dv'},
    };
    const distKey=(p.distribucio_dies||[]).join(',');
    const dist=distMap[distKey]||{l:p.distribucio_dies?p.distribucio_dies.join('·'):'Dm·Dj',v:[2,4]};
    const extracted={
      curs:p.curs||'Curs a confirmar',
      client:p.client||'Client a confirmar',
      hores:p.hores||16,
      dist,
      torn:p.torn||'9:30–11:30h',
      agent:p.agent_comercial||AGENTS[0]?.nom||'',
      confiança:p.confianca||50,
      _aiNotes:p.notes,
      _aiModel:data.model,
      _aiMs:data.ms,
    };
    renderEmailExtraccio(extracted);
  }catch(e){
    console.error('Error fetch IA:',e);
    // Fallback a heurística
    const extracted=extractFromEmail(text);
    renderEmailExtraccio(extracted);
    toast('Error de xarxa · usant heurística local');
  }finally{
    document.getElementById('email-ia-spin').style.display='none';
    document.getElementById('email-ia-icon').style.display='';
  }
}

function extractFromEmail(text){
  const t=text.toLowerCase();
  // Extracció heurística simple (en producció seria una crida a l'API)
  const cursos=['lideratge','comunicació','excel','vendes','prevenció','atenció al client','treball en equip','habilitats','recursos humans'];
  const curs=cursos.find(c=>t.includes(c))||'Curs a determinar';
  const horesMatch=t.match(/(\d+)\s*h/);
  const hores=horesMatch?parseInt(horesMatch[1]):16;
  const distribucions=[{k:'dimarts i dijous',v:[2,4],l:'Dm·Dj'},{k:'dilluns i dimecres',v:[1,3],l:'Dl·Dc'},{k:'dimecres i divendres',v:[3,5],l:'Dc·Dv'},{k:'setmanal',v:[3],l:'Dimecres'},{k:'dimarts',v:[2],l:'Dimarts'}];
  const dist=distribucions.find(d=>t.includes(d.k))||{l:'Dm·Dj',v:[2,4]};
  const torn=t.includes('matí')||t.includes('mati')?'9:30–11:30h':t.includes('tarda')?'16:00–18:00h':'9:30–11:30h';
  // Detectar agent
  const agents=AGENTS.map(a=>a.nom);
  const agent=agents.find(a=>text.toLowerCase().includes(a.toLowerCase().split(' ')[0].toLowerCase()))||agents[0];
  // Detectar client
  const clientMatch=text.match(/empresa\s+([A-Z][a-zA-ZÀ-ú\s]{2,30}?)[\s,\n]/)||text.match(/client\s+([A-Z][a-zA-ZÀ-ú\s]{2,30}?)[\s,\n]/);
  const client=clientMatch?clientMatch[1].trim():'Client a confirmar';
  // Detectar data
  const dataMatch=text.match(/(\d{1,2})[\s\/]*(de\s+)?([a-zA-ZÀ-ú]+)(\s+de\s+\d{4})?/)||text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return{curs:curs.charAt(0).toUpperCase()+curs.slice(1),client,hores,dist,torn,agent,confiança:72};
}

function renderEmailExtraccio(d){
  document.getElementById('email-extraccio-result').innerHTML=`
    <div style="background:#fff;border:0.5px solid rgba(0,0,0,0.1);border-radius:12px;overflow:hidden">
      <div style="padding:10px 13px;border-bottom:0.5px solid rgba(0,0,0,0.08);background:#f5f4f0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <div style="font-size:12px;font-weight:500">Dades extretes per la IA${d._aiModel?` <span style="font-size:9.5px;color:#6b6b67;font-weight:500">· ${d._aiModel}${d._aiMs?` · ${d._aiMs}ms`:''}</span>`:''}</div>
        <span style="background:#EEEDFE;color:#3C3489;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500">${d.confiança}% confiança</span>
      </div>
      ${d._aiNotes?`<div style="background:#FEF3C7;border-bottom:1px solid #FCD34D;padding:9px 13px;font-size:11.5px;color:#92400E;line-height:1.5"><strong>💡 Notes IA:</strong> ${d._aiNotes}</div>`:''}
      <div style="padding:13px">
        <div style="font-size:11px;color:#6b6b67;margin-bottom:10px">Revisa i ajusta si cal abans d'enviar al formulari:</div>
        <div class="g2" style="gap:8px">
          <div class="fi"><label>Client</label><input id="ext-client" value="${d.client}" style="padding:6px 9px;border:0.5px solid rgba(0,0,0,0.18);border-radius:8px;background:#f5f4f0;color:#1a1a1a;font-size:12px;width:100%;font-family:inherit"/></div>
          <div class="fi"><label>Nom del curs</label><input id="ext-curs" value="${d.curs}" style="padding:6px 9px;border:0.5px solid rgba(0,0,0,0.18);border-radius:8px;background:#f5f4f0;color:#1a1a1a;font-size:12px;width:100%;font-family:inherit"/></div>
          <div class="fi"><label>Hores totals</label><input id="ext-hores" type="number" value="${d.hores}" style="padding:6px 9px;border:0.5px solid rgba(0,0,0,0.18);border-radius:8px;background:#f5f4f0;color:#1a1a1a;font-size:12px;width:100%;font-family:inherit"/></div>
          <div class="fi"><label>Torn</label>
            <select id="ext-torn" style="padding:6px 9px;border:0.5px solid rgba(0,0,0,0.18);border-radius:8px;background:#f5f4f0;color:#1a1a1a;font-size:12px;width:100%;font-family:inherit">
              ${['9:30–11:30h','12:00–15:00h','9:00–11:00h','16:00–18:00h'].map(t=>`<option ${t===d.torn?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="fi"><label>Distribució detectada</label><input id="ext-dist" value="${d.dist.l}" style="padding:6px 9px;border:0.5px solid rgba(0,0,0,0.18);border-radius:8px;background:#f5f4f0;color:#1a1a1a;font-size:12px;width:100%;font-family:inherit"/></div>
          <div class="fi"><label>Agent comercial</label>
            <select id="ext-agent" style="padding:6px 9px;border:0.5px solid rgba(0,0,0,0.18);border-radius:8px;background:#f5f4f0;color:#1a1a1a;font-size:12px;width:100%;font-family:inherit">
              ${AGENTS.map(a=>`<option ${a.nom===d.agent?'selected':''}>${a.nom}</option>`).join('')}
            </select>
          </div>
        </div>
        <button class="btn btn-p" style="width:100%;margin-top:10px" onclick="enviarExtractAlFormulari()">
          Carregar al formulari de petició →
        </button>
      </div>
    </div>`;
}

function enviarExtractAlFormulari(){
  const client=document.getElementById('ext-client')?.value||'';
  const curs=document.getElementById('ext-curs')?.value||'';
  const hores=document.getElementById('ext-hores')?.value||'16';
  const torn=document.getElementById('ext-torn')?.value||'9:30–11:30h';
  const agent=document.getElementById('ext-agent')?.value||AGENTS[0].nom;
  // Emplenar el formulari de petició
  const pc=document.getElementById('p-client');if(pc)pc.value=client;
  const pcu=document.getElementById('p-curs');if(pcu)pcu.value=curs;
  const ph=document.getElementById('p-hores');if(ph)ph.value=hores;
  const pt=document.getElementById('p-torn');if(pt){for(let o of pt.options){if(o.value===torn){pt.value=torn;break;}}}
  selectedAgent=agent;
  renderAgentSelector();
  lf();
  // Navegar a petició
  gv('p',document.getElementById('nb-p'));
  toast('Dades carregades al formulari · Revisa i genera la proposta');
}

// ── ENTRADES: CANAL C - CÀRREGA MASSIVA ────────────────────────
function loadMassiuFile(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const text=e.target.result;
    document.getElementById('massiu-text').value=text;
    toast('Fitxer carregat · '+file.name);
  };
  reader.readAsText(file);
}

function processarMassiu(){
  const text=document.getElementById('massiu-text')?.value?.trim();
  if(!text){toast('Enganxa dades o puja un fitxer primer');return;}
  document.getElementById('massiu-ia-spin').style.display='inline-block';
  document.getElementById('massiu-ia-icon').style.display='none';
  document.getElementById('massiu-result').innerHTML=`<div style="text-align:center;padding:30px;color:#3C3489;font-size:13px"><span class="spinner" style="margin-right:8px;border-top-color:#534AB7"></span>Analitzant i assignant calendaris...</div>`;

  setTimeout(()=>{
    document.getElementById('massiu-ia-spin').style.display='none';
    document.getElementById('massiu-ia-icon').style.display='';
    const files=parseMassiuText(text);
    renderMassiuResult(files);
  },1800);
}

function parseMassiuText(text){
  const lines=text.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')&&!l.toLowerCase().startsWith('client'));
  const resISO=new Set(RESERVES.filter(r=>r.estat!=='cancel'&&r.estat!=='vf').flatMap(r=>r.dates));
  return lines.map((line,i)=>{
    const parts=line.split(/[|\t;]/).map(p=>p.trim());
    const client=parts[0]||'Client '+(i+1);
    const curs=parts[1]||'Curs a definir';
    // Detectar especialitat (columna 3, obligatòria per a l'assignació)
    const espRaw=parts[2]||'';
    const esp=CATS.esp.items.find(e=>e.toLowerCase()===espRaw.toLowerCase())||
              CATS.esp.items.find(e=>e.toLowerCase().includes(espRaw.toLowerCase()))||
              espRaw||CATS.esp.items[0];
    const hores=parseInt(parts[3])||16;
    const ssw=parseInt(parts[4])||2;
    // Torn: acceptar 'Matí','matí','mati','Tarda','tarda', o el text exacte
    const tornRaw=(parts[5]||'').toLowerCase();
    const torn=tornRaw.includes('tarda')||tornRaw.includes('16')?'16:00–18:00h':
               tornRaw.includes('migdia')||tornRaw.includes('12')?'12:00–15:00h':
               tornRaw.includes('9:00')?'9:00–11:00h':'9:30–11:30h';
    const iniRaw=parts[6]||'';
    const agent=parts[7]?AGENTS.find(a=>a.nom.toLowerCase().includes(parts[7].toLowerCase()))?.nom||AGENTS[0].nom:AGENTS[0].nom;
    const dist=[2,4];
    const hs=2;
    const ns=Math.ceil(hores/hs);
    // Data d'inici
    let iniISO='2026-06-01';
    if(iniRaw){const dm=iniRaw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?/);if(dm){const y=dm[3]?parseInt(dm[3])+(dm[3].length===2?2000:0):2026;iniISO=y+'-'+String(dm[2]).padStart(2,'0')+'-'+String(dm[1]).padStart(2,'0');}}
    // Buscar data real disponible
    const firstAvail=findFirstAvailable(iniISO,dist);
    const iniReal=toISO(firstAvail);
    const dates=buildDates(iniReal,ns,dist,resISO);
    // Assignar formador usant calcScore: disponibilitat → ranking → cost
    const pc=75;
    const candidats=FORMADORS
      .filter(f=>f.specs.includes(esp))
      .map(f=>{const s=calcScore(f,esp,dates,resISO,pc,false);return{...f,...s};})
      .filter(f=>f.match)
      .sort((a,b)=>b.score-a.score);
    const formCandidat=candidats[0]||
      FORMADORS.filter(f=>f.disp!=='baixa').sort((a,b)=>parseFloat(b.rating)-parseFloat(a.rating))[0]||
      FORMADORS[0];
    const noEsp=candidats.length===0;
    // Bloquejar dates per a la resta de la llista
    dates.forEach(d=>resISO.add(toISO(d)));
    return{client,curs,esp,hores,ssw,torn,iniISO:iniReal,agent,dist,hs,ns,formador:formCandidat,dates,pc,ok:dates.length>=ns,noEsp,score:candidats[0]?.score||0};
  });
}

function renderMassiuResult(files){
  // Guardar les dades pendents per al botó de confirmar
  window._massiuPending=files.filter(f=>f.ok).map(f=>({
    client:f.client,curs:f.curs,
    formador:f.formador.nom,formadorId:f.formador.id,formadorEmail:f.formador.email,
    comercial:f.agent,
    dates:f.dates.map(d=>toISO(d)),
    torn:f.torn,hs:f.hs,ns:f.ns,h:f.hores,pc:f.pc,
    cF:(f.formador.preu_hora*f.hores).toFixed(2),
    cC:(f.pc*f.hores).toFixed(2),
    marge:((f.pc-f.formador.preu_hora)/f.pc*100).toFixed(1)
  }));

  const ok=files.filter(f=>f.ok).length;
  const ko=files.filter(f=>!f.ok).length;
  document.getElementById('massiu-result').innerHTML=`
    <div style="background:#fff;border:0.5px solid rgba(0,0,0,0.1);border-radius:12px;overflow:hidden">
      <div style="padding:10px 13px;border-bottom:0.5px solid rgba(0,0,0,0.08);background:#f5f4f0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <div style="font-size:12px;font-weight:500">${files.length} cursos detectats</div>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="badge bg">${ok} amb calendari</span>
          ${ko?`<span class="badge br">${ko} sense disponibilitat</span>`:''}
        </div>
      </div>
      <div style="max-height:380px;overflow-y:auto">
        ${files.map((f,i)=>`
          <div style="padding:9px 13px;border-bottom:0.5px solid rgba(0,0,0,0.05);display:flex;align-items:flex-start;gap:8px;${!f.ok?'opacity:.6':''}">
            <span style="width:18px;height:18px;border-radius:50%;background:${f.ok?'#E1F5EE':'#FCEBEB'};display:inline-flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;margin-top:2px">${f.ok?'✓':'!'}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:500">${f.curs} · <span style="color:#6b6b67;font-weight:400">${f.client}</span></div>
              <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:2px">
                <span style="font-size:10px;background:#E6F1FB;color:#0C447C;padding:1px 6px;border-radius:20px;white-space:nowrap">${f.esp}</span>
                <span style="font-size:11px;color:#6b6b67">${f.formador.nom} · ★${f.formador.rating} · ${f.formador.preu_hora}€/h</span>
                ${f.score?`<span style="font-size:10px;color:${f.score>=70?'#085041':f.score>=50?'#633806':'#791F1F'};font-weight:500">${f.score}%</span>`:''}
                ${f.noEsp?`<span style="font-size:10px;color:#BA7517;font-weight:500">⚠ Sense formador per "${f.esp}"</span>`:''}
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:4px">${f.dates.slice(0,5).map(d=>`<span style="padding:1px 5px;border-radius:3px;font-size:9px;background:#E1F5EE;color:#085041">${fmtDL(d)}</span>`).join('')}${f.dates.length>5?`<span style="font-size:9px;color:#6b6b67">+${f.dates.length-5}</span>`:''}</div>
            </div>
            <span style="font-size:10px;color:#6b6b67;white-space:nowrap">${f.agent}</span>
          </div>`).join('')}
      </div>
      <div style="padding:10px 13px;border-top:0.5px solid rgba(0,0,0,0.08);background:#f5f4f0;display:flex;gap:7px;justify-content:flex-end">
        <button class="btn btn-sm" onclick="document.getElementById('massiu-text').value='';document.getElementById('massiu-result').innerHTML='';toast('Netejat')">Netejar</button>
        <button class="btn btn-p btn-sm" onclick="confirmarMassiu()">
          Confirmar i reservar ${ok} cursos
        </button>
      </div>
    </div>`;
}

function confirmarMassiu(){
  const cursos=window._massiuPending||[];
  if(!cursos.length){toast('Cap curs per confirmar');return;}
  cursos.forEach(c=>{
    const res={
      id:'R'+Date.now()+Math.random().toString(36).slice(2,6),
      ...c,
      estat:'pendent-cli',emailEnviat:false,emailFormadorEnviat:false,
      createdAt:toISO(new Date()),canvis:[],dist:[2,4]
    };
    RESERVES.push(res);
    apiPost('reserves',res);
  });
  window._massiuPending=[];
  renderGest();
  toast(`✓ ${cursos.length} curs${cursos.length!==1?'os':''} reservat${cursos.length!==1?'s':''} al sistema`);
  gv('gest',document.getElementById('nb-gest'));
}

// ── FORMADORS PAGE ──────────────────────────────────────────────
// Estat filtre especialitat formadors
let filtreEsp='';

function initFiltreEsp(){
  const container=document.getElementById('fsp-chips');if(!container)return;
  // Recollir totes les especialitats dels formadors
  const esps=[...new Set(FORMADORS.flatMap(f=>f.specs||[]))].sort();
  container.innerHTML=esps.map(e=>`<button class="filter-chip" onclick="selFiltreEsp('${e.replace(/'/g,"\\'")}',this)" style="font-size:11px">${e}</button>`).join('');
}

function selFiltreEsp(esp,btn){
  filtreEsp=esp;
  document.querySelectorAll('#fsp-chips .filter-chip, #fsp-all').forEach(b=>b.classList.remove('act'));
  btn.classList.add('act');
  renderFP();
}

function renderFP(){
  const q=(document.getElementById('fs-q').value||'').toLowerCase();
  const ft=document.getElementById('fs-t').value;
  const sort=document.getElementById('fs-sort')?.value||'nom';
  let list=FORMADORS.filter(f=>{
    const matchQ=!q||(f.nom.toLowerCase().includes(q)||f.specs.some(s=>s.toLowerCase().includes(q)));
    const matchT=!ft||f.tipus===ft;
    const matchEsp=!filtreEsp||f.specs.includes(filtreEsp);
    return matchQ&&matchT&&matchEsp;
  });

  // Càlcul de stats per formador
  const statsPerF=calcStatsFormadors();

  // Ordenació
  if(sort==='volum') list=[...list].sort((a,b)=>(statsPerF[b.id]?.hores||0)-(statsPerF[a.id]?.hores||0));
  else if(sort==='disp') list=[...list].sort((a,b)=>(statsPerF[b.id]?.dispPct||0)-(statsPerF[a.id]?.dispPct||0));
  else if(sort==='rating') list=[...list].sort((a,b)=>parseFloat(b.rating)-parseFloat(a.rating));
  else list=[...list].sort((a,b)=>a.nom.localeCompare(b.nom));

  // Banner filtre especialitat
  const banner=document.getElementById('fp-esp-banner');
  if(banner){
    if(filtreEsp){
      banner.style.display='flex';
      banner.innerHTML=`<span><strong>${list.length}</strong> formador${list.length!==1?'s':''} disponible${list.length!==1?'s':''} per a <strong>${filtreEsp}</strong></span><button class="btn-g" onclick="selFiltreEsp('',document.getElementById('fsp-all'))" style="font-size:11px;color:#0C447C">Veure tots ×</button>`;
    }else{
      banner.style.display='none';
    }
  }

  document.getElementById('fp-grid').innerHTML=list.length?list.map(f=>{
    const st=statsPerF[f.id]||{hores:0,reserves:0,dispPct:100,semColor:'#1D9E75',semLabel:'Alta'};
    const matchedEsp=filtreEsp&&f.specs.includes(filtreEsp);
    const waUrl=`https://wa.me/${f.tel?.replace(/\D/g,'')||''}?text=${encodeURIComponent('Hola '+f.nom.split(' ')[0]+', t\'escric des de GESEM per consultar la teva disponibilitat.')}`;
    const mailUrl=`mailto:${f.email}?subject=Consulta disponibilitat&body=Hola ${f.nom.split(' ')[0]},`;
    return`<div style="background:#fff;border:${matchedEsp?'2px solid #1D9E75':'0.5px solid rgba(0,0,0,0.1)'};border-radius:12px;padding:12px;cursor:pointer;transition:border-color .12s;position:relative" onmouseenter="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)'" onmouseleave="this.style.boxShadow=''" onclick="openFM(${f.id})">
      <!-- Dot semàfor cantonada -->
      <div style="position:absolute;top:10px;right:10px;width:9px;height:9px;border-radius:50%;background:${st.semColor}" title="${st.semLabel} · ${st.dispPct}% disponible"></div>
      ${matchedEsp?`<div style="position:absolute;top:8px;left:8px;background:#1D9E75;color:#fff;padding:1px 6px;border-radius:20px;font-size:9px;font-weight:500">✓ Especialitat</div>`:''}
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:8px;${matchedEsp?'margin-top:16px':''}">
        <img src="${f.img}" width="40" height="40" style="border-radius:50%;display:block;flex-shrink:0;object-fit:cover"/>
        <div style="min-width:0;flex:1">
          <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:14px">${f.nom}</div>
          <div style="font-size:10px;color:#6b6b67">${f.tipus==='intern'?'Intern':'Extern'} · ★${f.rating} · ${f.preu_hora}€/h</div>
        </div>
      </div>
      <!-- Especialitats -->
      <div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px">${(f.specs||[]).map(s=>`<span style="padding:2px 6px;border-radius:20px;font-size:10px;font-weight:500;background:${s===filtreEsp&&filtreEsp?'#E1F5EE':'#f5f4f0'};color:${s===filtreEsp&&filtreEsp?'#085041':'#6b6b67'}">${s}</span>`).join('')}</div>
      <!-- Barra disponibilitat -->
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <span style="font-size:10px;color:#6b6b67">Disponibilitat</span>
          <span style="font-size:10px;font-weight:500;color:${st.semColor}">${st.dispPct}%</span>
        </div>
        <div style="height:4px;border-radius:2px;background:#f5f4f0">
          <div style="height:100%;border-radius:2px;background:${st.semColor};width:${st.dispPct}%"></div>
        </div>
      </div>
      <!-- Footer: badge + volum + contacte -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
        <div style="display:flex;align-items:center;gap:5px">
          <span class="badge ${f.tipus==='intern'?'bb':'bg'}" style="font-size:10px">${f.tipus==='intern'?'Intern':'Extern'}</span>
          ${st.hores>0?`<span style="font-size:10px;color:#534AB7;font-weight:500">${st.hores}h GESEM</span>`:''}
        </div>
        <!-- Botons contacte ràpid -->
        <div style="display:flex;gap:4px" onclick="event.stopPropagation()">
          <a href="${mailUrl}" title="Email directe" style="width:26px;height:26px;border-radius:6px;border:0.5px solid rgba(0,0,0,0.15);background:#E6F1FB;display:inline-flex;align-items:center;justify-content:center;text-decoration:none" onclick="event.stopPropagation()">
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><rect x=".5" y=".5" width="11" height="9" rx="1.5" stroke="#0C447C" stroke-width=".8" fill="none"/><path d=".5 2l5.5 3.5L11.5 2" stroke="#0C447C" stroke-width=".8"/></svg>
          </a>
          <a href="${waUrl}" target="_blank" title="WhatsApp directe" style="width:26px;height:26px;border-radius:6px;border:0.5px solid #86efac;background:#dcfce7;display:inline-flex;align-items:center;justify-content:center;text-decoration:none" onclick="event.stopPropagation()">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5.5" stroke="#16a34a" stroke-width=".8"/><path d="M3 8.5c.5-1 1.5-2.8 3-2.8s2.2 1 2.2 1.7-1.2 1-1.5.5-.9-1.5-.9-1.5" stroke="#16a34a" stroke-width=".7" fill="none"/></svg>
          </a>
          ${f.icsUrl?`<button title="Actualitzar calendari" onclick="event.stopPropagation();refreshCal(${f.id}).then(()=>renderFP())" style="width:26px;height:26px;border-radius:6px;border:0.5px solid #5DCAA5;background:#E1F5EE;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px">🔄</button>`:''}
        </div>
      </div>
      ${f.icsUrl?(()=>{
        const cd=calData[f.id];
        const isSynced=cd!==undefined && (cd.fullDayDates?.size>0 || cd.slots?.length>0 || cd.syncedAt>0);
        const total=cd?((cd.fullDayDates?.size||0)+(cd.slots?.length||0)):0;
        let timeAgo='';
        if(cd&&cd.syncedAt){
          const min=Math.round((Date.now()-cd.syncedAt)/60000);
          timeAgo=min<1?' · ara':min<60?` · fa ${min} min`:min<1440?` · fa ${Math.round(min/60)}h`:` · fa ${Math.round(min/1440)}d`;
        }
        return `<div style="margin-top:7px;padding-top:7px;border-top:0.5px solid rgba(0,0,0,0.06);display:flex;align-items:center;gap:5px"><span style="width:7px;height:7px;border-radius:50%;background:${isSynced?'#1D9E75':'#BA7517'};flex-shrink:0"></span><span style="font-size:10px;color:${isSynced?'#085041':'#633806'};font-weight:500">${isSynced?'Calendari sincronitzat · '+total+' dies ocupats'+timeAgo:'Calendari pendent de sincronitzar'}</span></div>`;
      })():''}
    </div>`;
  }).join(''):`<div style="background:#fff;border:0.5px solid rgba(0,0,0,0.1);border-radius:12px;padding:24px;text-align:center;color:#6b6b67;font-size:13px;grid-column:1/-1">Cap formador amb els filtres seleccionats.</div>`;

  renderFPDisponibilitat(statsPerF);
  renderFPVolum(statsPerF);
}

function calcStatsFormadors(){
  const HORES_ANY=1800;
  const stats={};
  FORMADORS.forEach(f=>{
    const reserves=RESERVES.filter(r=>r.formadorId===f.id&&r.estat!=='cancel');
    const hores=reserves.reduce((s,r)=>s+r.dates.length*(parseFloat(r.hs)||2),0);
    const reservesActives=reserves.filter(r=>r.estat!=='vf').length;

    let dispPct, source;
    // Si té calendari sincronitzat: càlcul REAL pels propers 60 dies (només laborables)
    if(f.icsUrl && calData[f.id]){
      const cd=calData[f.id];
      const today=new Date();
      let busyWorkdays=0, totalWorkdays=0;
      for(let i=0;i<60;i++){
        const d=new Date(today);d.setDate(d.getDate()+i);
        const dw=d.getDay();
        if(dw===0||dw===6)continue; // saltar caps de setmana
        totalWorkdays++;
        const iso=toISO(d);
        if(cd.fullDayDates?.has(iso))busyWorkdays++;
        else if(cd.slots?.some(s=>s.date===iso))busyWorkdays++;
      }
      // També comptem reserves GESEM que ocupen dies laborables
      const gesemBusy=new Set(reserves.flatMap(r=>r.dates));
      let extraGesem=0;
      gesemBusy.forEach(iso=>{
        const d=parseISO(iso);
        if(d>=today && d<=new Date(today.getTime()+60*86400000)){
          if(!cd.fullDayDates?.has(iso) && !cd.slots?.some(s=>s.date===iso)){
            extraGesem++;
          }
        }
      });
      const totalBusy=busyWorkdays+extraGesem;
      dispPct=totalWorkdays?Math.max(0,Math.round((totalWorkdays-totalBusy)/totalWorkdays*100)):0;
      source='calendari';
    } else {
      // Fallback: disp declarada + bookings GESEM
      const dispBase={alta:90,parcial:60,baixa:30}[f.disp]||70;
      const ocupacioActual=Math.min(50,Math.round(hores/HORES_ANY*100*2));
      dispPct=Math.max(5,dispBase-ocupacioActual);
      source='declarada';
    }
    const semColor=dispPct>=70?'#1D9E75':dispPct>=40?'#EF9F27':'#E24B4A';
    const semLabel=dispPct>=70?'Alta disponibilitat':dispPct>=40?'Disponibilitat parcial':'Poc disponible';
    stats[f.id]={hores,reserves:reservesActives,dispPct,semColor,semLabel,source};
  });
  return stats;
}

function renderFPDisponibilitat(stats){
  const el=document.getElementById('fp-disponibilitat');if(!el)return;
  const sorted=[...FORMADORS].sort((a,b)=>(stats[b.id]?.dispPct||0)-(stats[a.id]?.dispPct||0));
  el.innerHTML=sorted.map(f=>{
    const st=stats[f.id]||{dispPct:0,semColor:'#6b6b67',semLabel:'—',hores:0};
    return`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid rgba(0,0,0,0.05);cursor:pointer" onclick="openFM(${f.id})" onmouseenter="this.style.background='#fafaf8'" onmouseleave="this.style.background=''">
      <img src="${f.img}" width="24" height="24" style="border-radius:50%;object-fit:cover;flex-shrink:0"/>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.nom.split(' ')[0]} ${f.nom.split(' ')[1]||''}</div>
        <div style="height:3px;border-radius:2px;background:#f5f4f0;margin-top:3px">
          <div style="height:100%;border-radius:2px;background:${st.semColor};width:${st.dispPct}%"></div>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:11px;font-weight:500;color:${st.semColor}">${st.dispPct}%</div>
        <div style="font-size:9px;color:#6b6b67">${st.semLabel.split(' ')[0]}</div>
      </div>
      <div style="width:8px;height:8px;border-radius:50%;background:${st.semColor};flex-shrink:0"></div>
    </div>`;
  }).join('');
}

function renderFPVolum(stats){
  const el=document.getElementById('fp-volum');if(!el)return;
  const withHores=FORMADORS.filter(f=>(stats[f.id]?.hores||0)>0).sort((a,b)=>(stats[b.id]?.hores||0)-(stats[a.id]?.hores||0));
  const maxH=Math.max(...withHores.map(f=>stats[f.id]?.hores||0),1);
  if(!withHores.length){el.innerHTML='<div style="font-size:12px;color:#6b6b67;padding:8px 0">Sense reserves registrades encara.</div>';return;}
  el.innerHTML=withHores.map((f,i)=>{
    const st=stats[f.id];
    const pct=Math.round(st.hores/maxH*100);
    const medals=['🥇','🥈','🥉'];
    return`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid rgba(0,0,0,0.05);cursor:pointer" onclick="openFM(${f.id})" onmouseenter="this.style.background='#fafaf8'" onmouseleave="this.style.background=''">
      <span style="font-size:13px;width:18px;text-align:center;flex-shrink:0">${medals[i]||String(i+1)}</span>
      <img src="${f.img}" width="24" height="24" style="border-radius:50%;object-fit:cover;flex-shrink:0"/>
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.nom.split(' ')[0]} ${f.nom.split(' ')[1]||''}</div>
        <div style="height:3px;border-radius:2px;background:#f5f4f0;margin-top:3px">
          <div style="height:100%;border-radius:2px;background:#534AB7;width:${pct}%"></div>
        </div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:11px;font-weight:500;color:#534AB7">${st.hores}h</div>
        <div style="font-size:9px;color:#6b6b67">${st.reserves} res.</div>
      </div>
    </div>`;
  }).join('');
}
function openFM(id){
  eFId=id;fotoDataURL=null;
  const f=id===-1?{nom:'',email:'',tel:'',tipus:'extern',specs:[],preu_hora:40,agenda:'manual',rating:'4.5',cursos:0,notes:'',img:null,disp:'alta'}:FORMADORS.find(x=>x.id===id);
  window._fmEditing=f; // referència per a deleteFormador()
  // Mostrar el botó Eliminar només quan editem un formador existent
  setTimeout(()=>{
    const btn=document.getElementById('fm-delete-btn');
    if(btn)btn.style.display=(id===-1)?'none':'inline-flex';
  },0);
  document.getElementById('fm-title').textContent=id===-1?'Nou formador':'Editar · '+f.nom;
  const prevImg=f.img||makeAv(f.nom||'?',0);
  const inp='padding:6px 9px;border:0.5px solid rgba(0,0,0,0.18);border-radius:8px;background:#f5f4f0;color:#1a1a1a;font-size:13px;width:100%;font-family:inherit';
  const noEnter='onkeydown="if(event.key===\'Enter\')event.preventDefault()"';
  document.getElementById('fm-body').innerHTML=`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
      <div class="foto-prev"><img id="fm-foto-prev" src="${prevImg}" width="56" height="56"/></div>
      <div><label class="foto-btn" for="fm-foto-inp">Canviar foto</label><input type="file" id="fm-foto-inp" accept="image/*" onchange="loadFoto(this)"/><div style="font-size:10px;color:#6b6b67;margin-top:4px">JPG, PNG · max 20MB</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="grid-column:1/-1"><label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:3px">Nom complet</label><input id="fm-nom" value="${f.nom}" ${noEnter} style="${inp}"/></div>
      <div><label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:3px">Email</label><input id="fm-email" value="${f.email||''}" type="email" ${noEnter} style="${inp}"/></div>
      <div><label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:3px">Telèfon</label><input id="fm-tel" value="${f.tel||''}" ${noEnter} style="${inp}"/></div>
      <div><label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:3px">Tipus</label><select id="fm-tipus" style="${inp}"><option value="intern" ${f.tipus==='intern'?'selected':''}>Intern</option><option value="extern" ${f.tipus==='extern'?'selected':''}>Extern</option></select></div>
      <div><label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:3px">Cost/hora (€)</label><input id="fm-ph" type="number" value="${f.preu_hora||0}" min="0" step="1" ${noEnter} style="${inp}"/></div>
      <div><label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:3px">Valoració (0–5)</label><input id="fm-rat" type="number" value="${parseFloat(f.rating||4.5).toFixed(1)}" min="0" max="5" step="0.1" ${noEnter} style="${inp}"/></div>
      <div><label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:3px">Cursos impartits</label><input id="fm-cursos" type="number" value="${f.cursos||0}" min="0" step="1" ${noEnter} style="${inp}"/></div>
      <div><label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:3px">Disponibilitat</label><select id="fm-disp" style="${inp}"><option value="alta" ${(f.disp||'alta')==='alta'?'selected':''}>Alta</option><option value="parcial" ${f.disp==='parcial'?'selected':''}>Parcial</option><option value="baixa" ${f.disp==='baixa'?'selected':''}>Baixa</option></select></div>
      <div style="grid-column:1/-1">
        <label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:5px">Especialitats assignades</label>
        <div id="fm-specs-grid" style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">
          ${CATS.esp.items.map(s=>{
            const checked=(f.specs||[]).includes(s);
            return`<label style="display:flex;align-items:center;gap:5px;cursor:pointer;padding:4px 9px;border-radius:20px;border:0.5px solid ${checked?'#1D9E75':'rgba(0,0,0,0.15)'};background:${checked?'#E1F5EE':'transparent'};transition:all .12s;user-select:none" id="fmsp-lbl-${s.replace(/\s/g,'_')}">
              <input type="checkbox" value="${s}" ${checked?'checked':''} onchange="toggleFmSpec(this)" style="accent-color:#1D9E75;width:12px;height:12px;flex-shrink:0"/>
              <span style="font-size:11px;font-weight:500;color:${checked?'#085041':'#6b6b67'}">${s}</span>
            </label>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:5px;align-items:center;margin-top:4px">
          <input type="text" id="fm-nova-esp" placeholder="Afegir nova especialitat..." onkeydown="if(event.key==='Enter'){event.preventDefault();addFmEsp();}" style="flex:1;padding:5px 9px;border:0.5px dashed rgba(0,0,0,0.2);border-radius:8px;background:#f5f4f0;color:#1a1a1a;font-size:12px;font-family:inherit"/>
          <button class="btn btn-p btn-sm" onclick="addFmEsp()" style="white-space:nowrap">+ Afegir</button>
        </div>
        <div style="font-size:10px;color:#6b6b67;margin-top:4px">Les noves especialitats s'afegiran al catàleg global de l'aplicació.</div>
      </div>
      <div><label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:3px">Gestió agenda</label>
        <select id="fm-agenda" style="${inp}" onchange="toggleIcsUrlPanel(this.value)">
          <option value="manual" ${(f.agenda||'manual')==='manual'?'selected':''}>Manual GESEM</option>
          <option value="google" ${f.agenda==='google'?'selected':''}>Google Calendar</option>
          <option value="outlook" ${f.agenda==='outlook'?'selected':''}>Outlook / Microsoft 365</option>
          <option value="ical" ${f.agenda==='ical'?'selected':''}>Altre (iCal/ICS)</option>
        </select>
      </div>
      <div style="grid-column:1/-1;display:${(f.agenda&&f.agenda!=='manual')?'block':'none'}" id="fm-ical-panel">
        <label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:4px">URL del calendari (iCal)</label>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="url" id="fm-icsUrl" value="${f.icsUrl||''}" placeholder="https://calendar.google.com/... o webcal://..." style="flex:1;${inp}" onkeydown="if(event.key==='Enter')event.preventDefault()"/>
          <button class="btn btn-sm" style="white-space:nowrap;background:#E6F1FB;border-color:#85B7EB;color:#0C447C" onclick="verificarICS()">Verificar ✓</button>
          <button class="btn btn-sm" style="white-space:nowrap;background:#FEF3C7;border-color:#FCD34D;color:#92400E" onclick="requestCalendarUrl(${f.id||-1})" title="Enviar email al formador demanant la seva URL d'iCal">✉️ Demanar</button>
        </div>
        <div id="fm-ics-result" style="font-size:10px;margin-top:4px;padding:4px 7px;border-radius:5px;display:none"></div>
        ${(eFId!==-1&&f.icsUrl)?`<div style="margin-top:6px;display:flex;align-items:center;gap:8px;padding:6px 9px;background:${calData[eFId]!==undefined?'#E1F5EE':'#FAEEDA'};border-radius:8px">
          <span style="font-size:11px;color:${calData[eFId]!==undefined?'#085041':'#633806'};flex:1">
            ${calData[eFId]!==undefined?'📅 Calendari sincronitzat · '+((calData[eFId].fullDayDates?.size||0)+(calData[eFId].slots?.length||0))+' dies ocupats detectats':'⏳ Calendari pendent de sincronitzar'}
          </span>
          <button class="btn btn-sm" style="white-space:nowrap;font-size:10px" onclick="forceRefreshModal(${eFId})">🔄 Actualitzar ara</button>
        </div>`:''}
        <div style="background:#f5f4f0;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:10px;color:#6b6b67;line-height:1.6">
          <div id="fm-ical-help"></div>
        </div>
      </div>
      ${eFId!==-1?`<div style="grid-column:1/-1;background:linear-gradient(135deg,#FEF7ED 0%,#FFFBEB 100%);border:0.5px solid #FDE68A;border-radius:10px;padding:11px 13px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:18px">🔗</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:600;color:#78350F">Google Calendar · 2-way sync</div>
            <div style="font-size:10px;color:#92400E;line-height:1.4">Permet que GESEM creï events directament al calendari del formador quan es confirma una reserva.</div>
          </div>
        </div>
        <div id="fm-google-status" style="font-size:11px;color:#92400E;padding:7px 10px;background:rgba(255,255,255,0.6);border-radius:7px;margin-bottom:7px">⏳ Comprovant estat...</div>
        <div id="fm-google-actions" style="display:flex;gap:6px;flex-wrap:wrap"></div>
      </div>`:''}
      <div style="grid-column:1/-1"><label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:3px">Notes internes</label><textarea id="fm-notes" style="height:48px;resize:none;${inp}">${f.notes||''}</textarea></div>
    </div>
    <div style="margin-top:7px;background:#f5f4f0;padding:6px 9px;border-radius:8px;font-size:11px;color:#6b6b67">El preu/hora al client s'introdueix a cada petició.</div>`;
  // Mostrar la ajuda correcta
  requestAnimationFrame(()=>toggleIcsUrlPanel(document.getElementById('fm-agenda')?.value||'manual'));
  document.getElementById('fm-bg').style.display='flex';
  // Activar autosave només per a formadors nous (id===-1)
  setTimeout(()=>{if(typeof initFormadorDraft==='function')initFormadorDraft();},50);
  // Carregar l'estat de connexió Google (només per a formadors existents)
  if(id!==-1)setTimeout(()=>loadGoogleStatusForFormador(id),60);
}

async function loadGoogleStatusForFormador(formadorId){
  const stEl=document.getElementById('fm-google-status');
  const acEl=document.getElementById('fm-google-actions');
  if(!stEl||!acEl)return;
  try{
    const [statusR,connR]=await Promise.all([
      fetch('/api/google/status').then(x=>x.json()),
      fetch('/api/google/connections').then(x=>x.json()),
    ]);
    if(!statusR.configured){
      stEl.innerHTML='⚠️ <strong>OAuth no configurat al servidor.</strong> Cal afegir <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> i <code>GOOGLE_REDIRECT_URI</code> al fitxer <code>.env</code>.';
      acEl.innerHTML='';
      return;
    }
    const conn=(connR.connected||[]).find(c=>c.formadorId===formadorId);
    if(conn){
      const dt=conn.connectedAt?new Date(conn.connectedAt).toLocaleString('ca-ES',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
      stEl.innerHTML=`✅ <strong>Connectat a Google Calendar</strong>${dt?' · des del '+dt:''}`;
      acEl.innerHTML=`
        <button class="btn btn-sm" type="button" style="background:#FEE2E2;border-color:#FCA5A5;color:#991B1B" onclick="disconnectGoogleCalendar(${formadorId})">🔌 Desconnectar</button>
        <button class="btn btn-sm" type="button" style="background:#DCFCE7;border-color:#86EFAC;color:#166534" onclick="testSyncGoogle(${formadorId})">🧪 Provar sync</button>
      `;
    }else{
      stEl.innerHTML='⚪ No connectat · l\'app farà fallback a llegir l\'iCal en mode lectura.';
      acEl.innerHTML=`<button class="btn btn-sm" type="button" style="background:#FEF3C7;border-color:#FCD34D;color:#92400E;font-weight:600" onclick="connectGoogleCalendar(${formadorId})">🔗 Connectar Google Calendar</button>`;
    }
  }catch(e){
    stEl.innerHTML='⚠️ Error comprovant estat: '+(e.message||e);
    acEl.innerHTML='';
  }
}

function connectGoogleCalendar(formadorId){
  // Obrir finestra OAuth
  const w=window.open('/api/google/auth/start?formadorId='+formadorId,'gesem_gauth','width=560,height=720');
  if(!w){toast('El navegador ha bloquejat la finestra emergent');return;}
  // Polling: quan la finestra es tanca, refrescar l'estat
  const iv=setInterval(()=>{
    if(w.closed){
      clearInterval(iv);
      loadGoogleStatusForFormador(formadorId);
    }
  },800);
}

async function disconnectGoogleCalendar(formadorId){
  if(!confirm('Desconnectar Google Calendar? Els events ja creats no es tocaran.'))return;
  try{
    const r=await fetch('/api/google/disconnect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({formadorId})});
    const d=await r.json();
    if(d.ok){toast('Google Calendar desconnectat');loadGoogleStatusForFormador(formadorId);}
    else toast('Error: '+(d.error||'desconegut'));
  }catch(e){toast('Error de connexió');}
}

async function testSyncGoogle(formadorId){
  // Buscar la primera reserva confirmada d'aquest formador
  const r=(window.RESERVES||[]).find(x=>x.formadorId===formadorId&&x.estat==='confirmada');
  if(!r){toast('No hi ha cap reserva confirmada d\'aquest formador per provar');return;}
  toast('Sincronitzant amb Google Calendar...');
  try{
    const res=await fetch('/api/google/sync-reserva',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reservaId:r.id})});
    const d=await res.json();
    if(d.ok)toast('✅ '+(d.created?.length||0)+' events creats');
    else toast('⚠️ '+(d.error||d.reason||'sync amb errors'));
  }catch(e){toast('Error: '+e.message);}
}
function loadFoto(input){
  const file=input.files[0];if(!file)return;
  if(file.size>20*1024*1024){toast('Fitxer massa gran (max 20MB)');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    // Processem la imatge ja en alta resolució aquí mateix perquè la previsualització
    // ja sigui nítida (no esperem a saveFM, que abans la reescalava a 42×42)
    processAvatarImage(e.target.result,cropped=>{
      fotoDataURL=cropped;
      document.getElementById('fm-foto-prev').src=cropped;
    });
  };
  reader.readAsDataURL(file);
}

const ICS_HELP={
  google:`<strong>Google Calendar:</strong><br>1. Obre Google Calendar → Configuració (⚙) → nom del calendari<br>2. "Integrar el calendari" → copia l'<strong>Adreça privada en format iCal</strong><br>3. Enganxa la URL aquí (comença per <code>https://calendar.google.com/calendar/ical/...</code>)`,
  outlook:`<strong>Outlook / Microsoft 365:</strong><br>1. Outlook Web → Calendari → ⚙ Configuració → Calendaris compartits<br>2. "Publicar calendari" → tria el teu calendari → copiar l'<strong>enllaç ICS</strong><br>3. Alternativa: obre <code>outlook.office.com</code> → dalt dreta Settings → View all → Calendar → Shared calendars`,
  ical:`<strong>Altre calendari (iCal):</strong><br>Qualsevol app de calendari (Apple, Fastmail, etc.) permet exportar o compartir una URL amb extensió <code>.ics</code> o protocol <code>webcal://</code>. Cerca l'opció "Compartir" o "Publicar calendari".`
};

function toggleIcsUrlPanel(val){
  const panel=document.getElementById('fm-ical-panel');
  const help=document.getElementById('fm-ical-help');
  if(!panel)return;
  panel.style.display=(val&&val!=='manual')?'block':'none';
  if(help)help.innerHTML=ICS_HELP[val]||ICS_HELP.ical;
}

async function verificarICS(){
  const url=(document.getElementById('fm-icsUrl')?.value||'').trim();
  const res=document.getElementById('fm-ics-result');
  if(!res)return;
  if(!url){res.style.display='block';res.style.background='#FCEBEB';res.style.color='#791F1F';res.textContent='Introdueix una URL';return;}
  res.style.display='block';res.style.background='#f5f4f0';res.style.color='#6b6b67';res.textContent='Verificant connexió...';
  try{
    const r=await fetch('/api/verificar-ical',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});
    const d=await r.json();
    if(d.ok){res.style.background='#E1F5EE';res.style.color='#085041';res.textContent='✓ '+d.message;}
    else{res.style.background='#FCEBEB';res.style.color='#791F1F';res.textContent='✗ Error: '+d.error;}
  }catch(e){res.style.background='#FCEBEB';res.style.color='#791F1F';res.textContent='Error de connexió amb el servidor';}
}

async function forceRefreshModal(formadorId){
  const statusEl=document.querySelector('#fm-ical-panel [style*="Actualitzar ara"]')?.previousElementSibling||null;
  if(statusEl)statusEl.textContent='⏳ Actualitzant...';
  await fetch('/api/disponibilitat/'+formadorId+'/cache',{method:'DELETE'});
  try{
    const r=await fetch('/api/disponibilitat/'+formadorId).then(x=>x.json());
    calData[formadorId]={slots:r.slots||[],fullDayDates:new Set(r.fullDayDates||[]),syncedAt:Date.now()};
    persistCalData();
    toast('📅 Calendari actualitzat · '+(r.count||0)+' dies ocupats');
    // Re-obrir el modal per refrescar l'estat
    openFM(formadorId);
  }catch(e){toast('Error actualitzant el calendari');}
}
function toggleFmSpec(cb){
  const lbl=document.getElementById('fmsp-lbl-'+cb.value.replace(/\s/g,'_'));
  if(!lbl)return;
  lbl.style.borderColor=cb.checked?'#1D9E75':'rgba(0,0,0,0.15)';
  lbl.style.background=cb.checked?'#E1F5EE':'transparent';
  lbl.querySelector('span').style.color=cb.checked?'#085041':'#6b6b67';
}

function addFmEsp(){
  const inp=document.getElementById('fm-nova-esp');
  if(!inp)return;
  const val=inp.value.trim();
  if(!val){toast('Escriu el nom de l\'especialitat');return;}
  if(CATS.esp.items.includes(val)){
    // Ja existeix: marcar-la si no ho estava
    const cb=document.querySelector(`#fm-specs-grid input[value="${val}"]`);
    if(cb&&!cb.checked){cb.checked=true;toggleFmSpec(cb);}
    inp.value='';
    toast('Especialitat ja existent · marcada');
    return;
  }
  // Afegir al catàleg global
  CATS.esp.items.push(val);
  apiPut('cats/esp',{items:CATS.esp.items});
  fillSels(); // Actualitza tots els desplegables de l'app
  initFiltreEsp(); // Actualitza els chips de formadors
  // Afegir el nou checkbox a la fitxa
  const grid=document.getElementById('fm-specs-grid');
  if(grid){
    const id=val.replace(/\s/g,'_');
    const lbl=document.createElement('label');
    lbl.id=`fmsp-lbl-${id}`;
    lbl.style.cssText='display:flex;align-items:center;gap:5px;cursor:pointer;padding:4px 9px;border-radius:20px;border:1.5px solid #1D9E75;background:#E1F5EE;transition:all .12s;user-select:none';
    lbl.innerHTML=`<input type="checkbox" value="${val}" checked onchange="toggleFmSpec(this)" style="accent-color:#1D9E75;width:12px;height:12px;flex-shrink:0"/><span style="font-size:11px;font-weight:500;color:#085041">${val}</span>`;
    grid.appendChild(lbl);
  }
  inp.value='';
  toast('Especialitat "'+val+'" afegida al catàleg global');
}

function saveFM(){
  const nom=document.getElementById('fm-nom').value.trim();
  if(!nom){toast('Nom obligatori');return;}
  // Llegir especialitats des dels checkboxes
  const specs=[...document.querySelectorAll('#fm-specs-grid input[type="checkbox"]:checked')].map(cb=>cb.value);
  if(specs.length===0){toast('Selecciona almenys una especialitat');return;}
  const rating=parseFloat(document.getElementById('fm-rat').value)||4.5;
  if(rating<0||rating>5){toast('La valoració ha de ser entre 0 i 5');return;}
  const agenda=document.getElementById('fm-agenda').value;
  const icsUrl=(agenda!=='manual'?(document.getElementById('fm-icsUrl')?.value||'').trim():'');
  const data={nom,email:document.getElementById('fm-email').value,tel:document.getElementById('fm-tel').value,tipus:document.getElementById('fm-tipus').value,preu_hora:parseFloat(document.getElementById('fm-ph').value)||0,specs,agenda,icsUrl,rating:rating.toFixed(1),cursos:parseInt(document.getElementById('fm-cursos').value)||0,notes:document.getElementById('fm-notes').value,disp:document.getElementById('fm-disp').value};
  if(fotoDataURL){
    // fotoDataURL ja ve processada per processAvatarImage (256×256, smooth, cover crop).
    // Només cal aplicar el clip circular preservant la resolució completa.
    const SIZE=256;
    const c=document.createElement('canvas');c.width=SIZE;c.height=SIZE;
    const x=c.getContext('2d');
    x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
    x.beginPath();x.arc(SIZE/2,SIZE/2,SIZE/2,0,Math.PI*2);x.clip();
    const img=new Image();
    img.onload=()=>{x.drawImage(img,0,0,SIZE,SIZE);data.img=c.toDataURL('image/png');_saveFM(data);};
    img.src=fotoDataURL;
  }else{
    if(eFId===-1)data.img=makeAv(data.nom,FORMADORS.length);
    else{const f=FORMADORS.find(x=>x.id===eFId);data.img=f?f.img:makeAv(data.nom,0);}
    _saveFM(data);
  }
}
function _saveFM(data){
  if(eFId===-1){
    data.id=Date.now();
    FORMADORS.push(data);
    apiPost('formadors',data);
    // Esborrar el draft un cop creat amb èxit
    if(typeof clearFormadorDraft==='function')clearFormadorDraft();
  }else{
    data.id=eFId; // ← fix: sempre usar eFId, no data.id
    const idx=FORMADORS.findIndex(f=>f.id===eFId);
    if(idx>-1){
      const prevIcsUrl=FORMADORS[idx].icsUrl||'';
      FORMADORS[idx]={...FORMADORS[idx],...data};
      apiPut('formadors/'+eFId,FORMADORS[idx]);
      // Només invalidem el calendari si la URL HA CANVIAT.
      // Abans s'invalidava SEMPRE perquè `data.icsUrl!==undefined` sempre era true
      // (el form sempre porta el camp), i a més el codi de re-fetch utilitzava
      // un format de calData obsolet (`new Set(busyDates)`) que feia que el
      // card mai més tornés a detectar-se com a sincronitzat.
      const newIcsUrl=(data.icsUrl||'').trim();
      if(newIcsUrl!==(prevIcsUrl||'').trim()){
        delete calData[eFId];
        if(typeof persistCalData==='function')persistCalData();
        if(newIcsUrl){
          // refreshCal ja gestiona el format correcte ({slots, fullDayDates, syncedAt})
          // i persisteix a localStorage automàticament
          refreshCal(eFId,{silent:true}).then(()=>{
            if(typeof renderFP==='function')renderFP();
            if(typeof lf==='function')lf();
          }).catch(()=>{});
        }
      }
    }
  }
  closeFM();renderFP();lf();fillSels();toast('Formador desat ✓');
}
function closeFM(){document.getElementById('fm-bg').style.display='none';}

// Sol·licitar URL del calendari per email al formador
async function requestCalendarUrl(fId){
  // Llegir nom + email del formulari obert (encara no desat) o del FORMADORS
  const nom=document.getElementById('fm-nom')?.value?.trim() || (FORMADORS.find(x=>x.id===fId)?.nom) || '';
  const email=document.getElementById('fm-email')?.value?.trim() || (FORMADORS.find(x=>x.id===fId)?.email) || '';
  if(!email){toast('Falta email del formador');return;}
  const subject='GESEM Planner · Sol·licitud URL calendari iCal';
  const body=`Hola ${nom||''},

Per millorar la coordinació de les reserves de formació, ens agradaria connectar el teu calendari personal al sistema de GESEM Planner. Així podrem detectar automàticament les teves dates ocupades i no et proposarem sessions que coincideixin amb els teus compromisos.

Per fer-ho, només necessitem la URL "iCal" del teu calendari (NO comparteixes res, només és una URL de subscripció en mode lectura):

GOOGLE CALENDAR
${'─'.repeat(40)}
1. Obre Google Calendar al navegador (no funciona des de l'app mòbil)
2. A la barra esquerra, passa el ratolí sobre el teu calendari
3. Clica els 3 punts verticals · "Configuració i ús compartit"
4. Baixa fins a "URL secreta en format iCal"
5. Copia la URL i envia-la per email

OUTLOOK / OFFICE 365
${'─'.repeat(40)}
1. Outlook web · Configuració · Calendari · Calendaris compartits
2. Publica el teu calendari "Pot veure tots els detalls"
3. Copia el link "ICS"
4. Envia'ns la URL

APPLE iCLOUD
${'─'.repeat(40)}
1. iCloud.com · Calendari
2. Clica la icona de wifi al costat del teu calendari
3. Activa "Calendari públic"
4. Copia el link · canvia "webcal://" per "https://"
5. Envia'ns la URL

Si tens dubtes, contesta'ns aquest email i t'ajudem.

Gràcies,
Equip de gestió docent · GESEM digital & SoftSkills`;

  // Confirmació
  const ok=await confirmDialog({
    title:'Enviar email a '+(nom||email)+'?',
    message:'S\'enviarà un email a <strong>'+email+'</strong> demanant-li la URL del seu calendari iCal amb instruccions per a Google, Outlook i iCloud.',
    confirmText:'Sí, enviar',
  });
  if(!ok)return;

  // Enviar via SMTP
  try{
    const res=await fetch('/api/email/send',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({to:email,subject,text:body}),
    });
    const data=await res.json();
    if(!res.ok||!data.ok)throw new Error(data.error||'Error');
    toast('✓ Email enviat a '+email);
  }catch(e){
    toast('✗ Error: '+e.message);
  }
}

async function deleteFormador(){
  const f=window._fmEditing;
  if(!f||f.id==null||f.id===-1){toast('No es pot eliminar un formador no desat');return;}
  // Comprovar si té reserves actives
  const activeRes=RESERVES.filter(r=>r.formadorId===f.id&&r.estat!=='cancel'&&r.estat!=='vf');
  const msg=activeRes.length
    ? `<strong>${f.nom}</strong> té <strong>${activeRes.length} reserves actives</strong>. Si l'elimines, les reserves quedaran sense formador assignat.<br><br>Aquesta acció no es pot desfer.`
    : `Vols eliminar <strong>${f.nom}</strong>?<br><br>Aquesta acció no es pot desfer.`;
  const ok=await confirmDialog({title:'Eliminar formador?',message:msg,confirmText:'Sí, eliminar',danger:true});
  if(!ok)return;
  try{
    await fetch('/api/formadors/'+f.id,{method:'DELETE'});
    FORMADORS=FORMADORS.filter(x=>x.id!==f.id);
    delete calData[f.id];
    closeFM();
    if(typeof renderFP==='function')renderFP();
    toast('Formador eliminat');
  }catch(e){
    toast('Error eliminant: '+e.message);
  }
}
document.getElementById('fm-bg')?.addEventListener('click',e=>{if(e.target===document.getElementById('fm-bg'))closeFM();});

function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);}

// ── EMAIL · enviament real via SMTP ────────────────────────────
async function sendEmailViaSMTP({to, subject, body, replyTo, btn}){
  if(!to||!subject){toast('Falten destinatari o assumpte');return false;}
  const orig=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='Enviant...';}
  try{
    const res=await fetch('/api/email/send',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({to,subject,text:body,replyTo}),
    });
    const data=await res.json();
    if(!res.ok||!data.ok)throw new Error(data.error||'Error desconegut');
    toast('✓ Email enviat a '+to);
    return true;
  }catch(e){
    console.error('SMTP error:',e);
    toast('✗ Error: '+e.message);
    return false;
  }finally{
    if(btn){btn.disabled=false;btn.textContent=orig;}
  }
}

// Wrappers per als modals existents
async function sendEmailGeneric(btn){
  const ok=await sendEmailViaSMTP({
    to:document.getElementById('email-para').value,
    subject:document.getElementById('email-assumpte').value,
    body:document.getElementById('email-cos').value,
    btn,
  });
  if(ok){
    if(currentEmailResId){const r=RESERVES.find(x=>x.id===currentEmailResId);if(r){r.emailEnviat=true;apiPut('reserves/'+currentEmailResId,r);}}
    closeEmail();renderGest();
  }
}
async function sendEmailFormador(btn){
  const ok=await sendEmailViaSMTP({
    to:document.getElementById('emailf-para').value,
    subject:document.getElementById('emailf-assumpte').value,
    body:document.getElementById('emailf-cos').value,
    btn,
  });
  if(ok)document.getElementById('emailf-bg').style.display='none';
}

// Crea la reserva al moment + envia email amb confirmació (per al cas /peticio
// on encara no existeix cap reserva). Combina confP + sendEmailFormadorConfirm.
async function createReservaAndSendConfirm(btn){
  const idx=window._emailfPendingIdx;
  if(idx==null||!window._pr||!window._pr[idx]){
    toast('No hi ha proposta activa. Cancel·la el modal i torna-ho a obrir.');
    return;
  }
  const orig=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='Creant reserva...';}
  try{
    const r=confP(idx);
    if(typeof clearPeticioDraft==='function')clearPeticioDraft();
    if(typeof refreshAllCalendars==='function')refreshAllCalendars(r.formadorId).catch(()=>{});
    // Ara que tenim reserva, posa l'id i delega al fluxe estàndard
    window.currentEmailResId=r.id;
    window._emailfResId=r.id;
    window._emailfPendingIdx=null;
    if(btn)btn.textContent='Enviant email...';
    await sendEmailFormadorConfirm(btn);
    // Refrescar la pàgina de gestió perquè vegi la nova reserva
    if(typeof renderGest==='function')renderGest();
  }catch(e){
    toast('✗ Error: '+e.message);
    if(btn){btn.disabled=false;btn.textContent=orig;}
  }
}

// Envia email al formador AMB botons d'Acceptar/Declinar + .ics adjunt
async function sendEmailFormadorConfirm(btn){
  // Necessitem una reserva creada (id). Obtenim-la del context.
  const resId=window.currentEmailResId || window._emailfResId;
  if(!resId){
    // Si estem al /peticio (no hi ha reserva encara), oferim la opció directa
    if(window._emailfPendingIdx!=null){
      return createReservaAndSendConfirm(btn);
    }
    toast('Aquest botó només funciona quan hi ha una reserva creada. Crea la reserva primer i torna a enviar des de Gestió.');
    return;
  }
  const to=document.getElementById('emailf-para').value;
  const subject=document.getElementById('emailf-assumpte').value;
  const body=document.getElementById('emailf-cos').value;
  if(!to||!subject){toast('Falten destinatari o assumpte');return;}
  const orig=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='Enviant...';}
  try{
    const res=await fetch('/api/email/send-formador-confirm',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({reservaId:resId,to,subject,body}),
    });
    const data=await res.json();
    if(!res.ok||!data.ok)throw new Error(data.error||'Error');
    toast('✓ Enviat amb botons + calendari (.ics)');
    document.getElementById('emailf-bg').style.display='none';
    if(typeof renderGest==='function')renderGest();
  }catch(e){
    toast('✗ Error: '+e.message);
  }finally{
    if(btn){btn.disabled=false;btn.textContent=orig;}
  }
}
async function sendPendentsEmail(btn){
  const ok=await sendEmailViaSMTP({
    to:document.getElementById('pendents-para').value,
    subject:document.getElementById('pendents-assumpte').value,
    body:document.getElementById('pendents-cos').value,
    btn,
  });
  if(ok&&typeof markPendentsEnviat==='function')markPendentsEnviat();
}

// ── DRAFT del formulari Petició (autosave a localStorage) ──────
const PETICIO_DRAFT_KEY='gesem.peticio.draft';
const PETICIO_FIELDS=['p-client','p-curs','p-esp','p-modal','p-form-pref','p-hores','p-hsess','p-ssw','p-torn','p-inici','p-preu'];

let _draftSaveTimer=null;
function savePeticioDraft(){
  clearTimeout(_draftSaveTimer);
  _draftSaveTimer=setTimeout(()=>{
    const data={
      ts:Date.now(),
      fields:{},
      bDays:[...(typeof bDays!=='undefined'?bDays:[])],
      exclD:[...(typeof exclD!=='undefined'?exclD:[])],
      selectedAgent:typeof selectedAgent!=='undefined'?selectedAgent:'',
      preferredFormadorId:typeof preferredFormadorId!=='undefined'?preferredFormadorId:null,
    };
    PETICIO_FIELDS.forEach(id=>{const el=document.getElementById(id);if(el)data.fields[id]=el.value;});
    try{localStorage.setItem(PETICIO_DRAFT_KEY,JSON.stringify(data));}catch(e){}
  },400);
}

function clearPeticioDraft(){
  try{localStorage.removeItem(PETICIO_DRAFT_KEY);}catch(e){}
  const banner=document.getElementById('draft-banner');if(banner)banner.remove();
}

function loadPeticioDraft(){
  try{
    const raw=localStorage.getItem(PETICIO_DRAFT_KEY);
    if(!raw)return null;
    const data=JSON.parse(raw);
    // Caduca al cap de 7 dies
    if(Date.now()-data.ts>7*86400000){clearPeticioDraft();return null;}
    return data;
  }catch(e){return null;}
}

function applyPeticioDraft(data){
  Object.entries(data.fields||{}).forEach(([id,val])=>{
    const el=document.getElementById(id);if(el&&val)el.value=val;
  });
  if(typeof bDays!=='undefined'){bDays.clear();(data.bDays||[]).forEach(d=>bDays.add(d));}
  if(typeof exclD!=='undefined'){exclD.clear();(data.exclD||[]).forEach(d=>exclD.add(d));}
  if(data.selectedAgent&&typeof selectedAgent!=='undefined')selectedAgent=data.selectedAgent;
  if(data.preferredFormadorId!=null&&typeof preferredFormadorId!=='undefined')preferredFormadorId=data.preferredFormadorId;
  // Re-renderitzar tot
  if(typeof renderAgentSelector==='function')renderAgentSelector();
  if(typeof renderExcl==='function')renderExcl();
  // Marcar dies bloquejats al UI
  document.querySelectorAll('.day-sel .ds').forEach(b=>{
    const d=parseInt(b.dataset.d);
    if(bDays.has(d))b.classList.add('blocked');else b.classList.remove('blocked');
  });
  if(typeof upD==='function')upD();
  if(typeof ua==='function')ua();
}

function showDraftBanner(data){
  const lc=document.querySelector('.lc');if(!lc)return;
  const minutes=Math.round((Date.now()-data.ts)/60000);
  const ago=minutes<60?`fa ${minutes} min`:minutes<1440?`fa ${Math.round(minutes/60)} h`:`fa ${Math.round(minutes/1440)} dies`;
  const banner=document.createElement('div');
  banner.id='draft-banner';
  banner.className='draft-banner';
  // Important: escapem amb HTML entity (&quot;) les cometes dobles dins de
  // l'atribut onclick per no trencar el parser HTML. Abans amb cometes dobles
  // crues el botó "Restaurar" no funcionava perquè l'atribut acabava al primer ".
  banner.innerHTML=`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    <span>Hi ha un esborrany sense desar (${ago})</span>
    <span class="draft-banner-actions">
      <button class="btn btn-sm" onclick="discardPeticioDraftWithToast()">Descartar</button>
      <button class="btn btn-p btn-sm" onclick="restorePeticioDraftWithToast()">Restaurar</button>
    </span>`;
  lc.insertBefore(banner,lc.firstChild);
}

// Wrappers nets — es criden des dels botons del banner per evitar problemes
// d'escape de cometes dins d'atributs onclick.
function restorePeticioDraftWithToast(){
  const draft=loadPeticioDraft();
  if(!draft){toast('No hi ha esborrany per restaurar');return;}
  applyPeticioDraft(draft);
  // Esborrar el banner però NO l'esborrany del localStorage encara — l'usuari
  // potser vol seguir editant-lo i el següent edit el sobreescriurà
  const banner=document.getElementById('draft-banner');
  if(banner)banner.remove();
  toast(typeof t==='function'?t('toast.draft.restored'):'Esborrany restaurat');
}

function discardPeticioDraftWithToast(){
  clearPeticioDraft();
  toast(typeof t==='function'?t('toast.draft.discard'):'Esborrany descartat');
}

function initPeticioDraft(){
  // Bind d'autosave als camps
  PETICIO_FIELDS.forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.addEventListener('input',savePeticioDraft);
    el.addEventListener('change',savePeticioDraft);
  });
  // També dies bloquejats i exclusions: re-saven via les seves funcions togDay/addEx (interceptem manualment al lf())
  // El restore: només mostrar banner, no aplicar automàticament (l'usuari pot voler començar net)
  const draft=loadPeticioDraft();
  if(draft&&Object.values(draft.fields||{}).some(v=>v)){
    showDraftBanner(draft);
  }
}

// ── DRAFT del formulari de FORMADOR (autosave a localStorage) ──
// Només quan crees un nou formador (id=-1), no per a edicions existents
const FM_DRAFT_KEY='gesem.formador.draft';
const FM_FIELDS=['fm-nom','fm-email','fm-tel','fm-tipus','fm-ph','fm-rating','fm-cursos','fm-notes','fm-disp','fm-agenda','fm-icsUrl'];

let _fmDraftTimer=null;
function saveFormadorDraft(){
  if(eFId!==-1)return; // només per nous (no per editar existents)
  clearTimeout(_fmDraftTimer);
  _fmDraftTimer=setTimeout(()=>{
    const data={ts:Date.now(),fields:{},specs:[]};
    FM_FIELDS.forEach(id=>{const el=document.getElementById(id);if(el)data.fields[id]=el.value;});
    // Specs (checkboxes)
    document.querySelectorAll('#fm-specs input[type="checkbox"]:checked').forEach(cb=>data.specs.push(cb.value));
    if(fotoDataURL)data.foto=fotoDataURL;
    try{localStorage.setItem(FM_DRAFT_KEY,JSON.stringify(data));}catch(e){}
  },400);
}

function clearFormadorDraft(){
  try{localStorage.removeItem(FM_DRAFT_KEY);}catch(e){}
}

function loadFormadorDraft(){
  try{
    const raw=localStorage.getItem(FM_DRAFT_KEY);
    if(!raw)return null;
    const data=JSON.parse(raw);
    if(Date.now()-data.ts>7*86400000){clearFormadorDraft();return null;}
    return data;
  }catch(e){return null;}
}

function applyFormadorDraft(data){
  Object.entries(data.fields||{}).forEach(([id,val])=>{
    const el=document.getElementById(id);if(el&&val)el.value=val;
  });
  if(data.specs){
    document.querySelectorAll('#fm-specs input[type="checkbox"]').forEach(cb=>{
      cb.checked=data.specs.includes(cb.value);
    });
  }
  if(data.foto){
    fotoDataURL=data.foto;
    const prev=document.getElementById('fm-foto-prev');if(prev)prev.src=data.foto;
  }
}

function initFormadorDraft(){
  if(eFId!==-1)return; // només quan és nou
  // Bind autosave als camps
  FM_FIELDS.forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.addEventListener('input',saveFormadorDraft);
    el.addEventListener('change',saveFormadorDraft);
  });
  // Specs checkboxes
  document.querySelectorAll('#fm-specs input[type="checkbox"]').forEach(cb=>{
    cb.addEventListener('change',saveFormadorDraft);
  });
  // Si hi ha draft i el formulari està buit, oferir restaurar
  const draft=loadFormadorDraft();
  if(draft&&Object.values(draft.fields||{}).some(v=>v)){
    showFormadorDraftBanner(draft);
  }
}

function showFormadorDraftBanner(data){
  const body=document.getElementById('fm-body');if(!body)return;
  const minutes=Math.round((Date.now()-data.ts)/60000);
  const ago=minutes<60?`fa ${minutes} min`:minutes<1440?`fa ${Math.round(minutes/60)} h`:`fa ${Math.round(minutes/1440)} dies`;
  const banner=document.createElement('div');
  banner.id='fm-draft-banner';
  banner.style.cssText='background:var(--accent-amber-soft);border:1px solid #FCD34D;border-radius:8px;padding:9px 12px;font-size:12px;color:var(--accent-amber-text);display:flex;align-items:center;gap:10px;margin-bottom:10px';
  banner.innerHTML=`
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
    <span style="flex:1">Hi ha un esborrany sense desar (${ago})</span>
    <button class="btn btn-sm" onclick="clearFormadorDraft();document.getElementById('fm-draft-banner').remove();toast('Esborrany descartat')">Descartar</button>
    <button class="btn btn-p btn-sm" onclick="(function(){applyFormadorDraft(loadFormadorDraft()||{});document.getElementById('fm-draft-banner').remove();toast('Esborrany restaurat')})()">Restaurar</button>
  `;
  body.insertBefore(banner,body.firstChild);
}

// Helper per a estats buits (taules/llistes sense dades)
function emptyState({icon,title,desc,ctaLabel,ctaHref}){
  const cta=ctaHref?`<a href="${ctaHref}" class="btn btn-p btn-sm es-cta">${ctaLabel||'Començar'}</a>`:'';
  return `<div class="empty-state">
    <div class="es-icon">${icon||'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'}</div>
    <div class="es-title">${title}</div>
    <div class="es-desc">${desc||''}</div>
    ${cta}
  </div>`;
}

// ── ROUTING: detectar pàgina actual des de la URL ─────────────────
function getCurrentPage(){
  const p=window.location.pathname.replace(/\/$/,'')||'/';
  if(p==='/'||p==='/peticio'||p==='/peticio.html')return 'p';
  if(p==='/gestio'||p==='/gestio.html')return 'gest';
  if(p==='/canvis'||p==='/canvis.html')return 'canvis';
  if(p==='/formadors'||p==='/formadors.html')return 'f';
  if(p==='/entrades'||p==='/entrades.html')return 'entrades';
  return 'p';
}

// Navegació entre pàgines: ara usa URLs reals
function gv(id, btn){
  const routes={p:'/peticio',gest:'/gestio',canvis:'/canvis',f:'/formadors',entrades:'/entrades'};
  if(routes[id]) window.location.href=routes[id];
}

function setActiveNavButton(){
  const id=getCurrentPage();
  document.querySelectorAll('.nb').forEach(b=>{b.classList.remove('act');b.classList.remove('act-p');});
  const nb=document.getElementById('nb-'+id);
  if(nb)nb.classList.add('act');
}

// ── INIT: CÀRREGA DE DADES DES DEL SERVIDOR ──────────────────────
async function loadAllData(){
  // Intent ràpid: 1 sol fetch via /api/bootstrap (millor per a temps de càrrega)
  try{
    const all=await fetch('/api/bootstrap').then(r=>{if(!r.ok)throw new Error('Bootstrap KO');return r.json();});
    return all;
  }catch(e){
    // Fallback: 4 fetches paral·lels (compat amb backends antics)
    console.warn('Bootstrap no disponible, usant fallback amb 4 fetches');
    const [cats,agents,formadors,reserves]=await Promise.all([
      fetch('/api/cats').then(r=>r.json()),
      fetch('/api/agents').then(r=>r.json()),
      fetch('/api/formadors').then(r=>r.json()),
      fetch('/api/reserves').then(r=>r.json()),
    ]);
    return {cats,agents,formadors,reserves};
  }
}

// ── MAINTENANCE GUARD · client-side ─────────────────────────────
// Si el manteniment està actiu, redirigeix a la pàgina /maintenance.
// Es comprova al carregar i periòdicament cada 30s (per cobrir BFCache i
// pestanyes obertes des d'abans d'activar el manteniment).
async function checkMaintenanceMode(){
  try{
    const r=await fetch('/api/admin/maintenance',{cache:'no-store'});
    const d=await r.json();
    if(d&&d.active===true){
      // Guard: només redirigir si NO estem ja a /maintenance ni a /admin
      const p=window.location.pathname;
      if(p!=='/maintenance'&&p!=='/admin'&&!p.startsWith('/admin/')&&!p.startsWith('/r/')){
        window.location.href='/maintenance';
      }
    }
  }catch(e){/* silenci si l'API falla */}
}
// Disparar al carregar (abans de qualsevol render) i quan torna el focus a la pestanya
checkMaintenanceMode();
window.addEventListener('focus',checkMaintenanceMode);
// També quan el navegador restaura una pàgina del BFCache
window.addEventListener('pageshow',(e)=>{if(e.persisted)checkMaintenanceMode();});
// Polling periòdic com a últim recurs (poc agressiu)
setInterval(checkMaintenanceMode,30000);

// Carrega l'usuari autenticat i decora la sidebar amb el seu nom + logout
async function loadCurrentUser(){
  try{
    const r=await fetch('/api/auth/me',{credentials:'include'});
    const d=await r.json();
    if(!d.authenticated || !d.user) return null;
    const u=d.user;
    window.currentUser=u;
    renderSidebarUser(u);
    // Afegim un botó "Sortir" al footer de la sidebar si no hi és
    const foot=document.querySelector('.sidebar-foot');
    if(foot && !document.getElementById('sb-logout-btn')){
      const btn=document.createElement('button');
      btn.id='sb-logout-btn';
      btn.className='sb-foot-item';
      btn.setAttribute('aria-label','Sortir');
      btn.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg><span>Sortir</span>`;
      btn.onclick=async()=>{
        try{ await fetch('/api/auth/logout',{method:'POST',credentials:'include'}); }catch(e){}
        window.location.href='/login';
      };
      foot.appendChild(btn);
    }
    return u;
  }catch(e){
    console.warn('[auth] no s\'ha pogut carregar l\'usuari:',e);
    return null;
  }
}

// Renderitza el bloc d'usuari a la sidebar (avatar + nom). Clicable → obre editor.
function renderSidebarUser(u){
  const userBlock=document.querySelector('.sidebar-user');
  const av=document.querySelector('.sidebar-user-av');
  const nameEl=document.querySelector('.sidebar-user span');
  if(av){
    const initials=(u.name||u.email||'?').trim().split(/\s+/).map(s=>s[0]).join('').slice(0,2).toUpperCase();
    if(u.img && !String(u.img).includes('data:image/svg')){
      av.innerHTML=`<img src="${u.img}" alt="${u.name||u.email}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>`;
      av.style.padding='0';
      av.style.background='transparent';
    }else{
      av.textContent=initials;
      av.style.padding='';
    }
    av.title=u.email;
  }
  if(nameEl){
    nameEl.textContent=u.name||u.email.split('@')[0];
    nameEl.title='Editar perfil';
  }
  // Fer tot el bloc clicable per editar el perfil
  if(userBlock && !userBlock.dataset.editable){
    userBlock.dataset.editable='1';
    userBlock.style.cursor='pointer';
    userBlock.title='Editar perfil';
    userBlock.addEventListener('click',()=>openProfileEditor());
    // Hover subtle feedback
    userBlock.addEventListener('mouseenter',()=>userBlock.style.background='rgba(0,0,0,0.04)');
    userBlock.addEventListener('mouseleave',()=>userBlock.style.background='');
    userBlock.style.borderRadius='10px';
    userBlock.style.transition='background .15s';
  }
}

// ── MODAL · Editar el meu perfil ─────────────────────────────────
function openProfileEditor(){
  const u=window.currentUser;
  if(!u){toast('Cal estar autenticat');return;}
  let bg=document.getElementById('profile-edit-bg');
  if(!bg){
    bg=document.createElement('div');
    bg.id='profile-edit-bg';
    bg.style.cssText='display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;align-items:center;justify-content:center;padding:20px';
    bg.innerHTML=`
    <div style="background:#fff;border-radius:14px;padding:22px 24px;width:420px;max-width:100%;box-shadow:0 14px 50px rgba(0,0,0,0.25);max-height:90vh;overflow-y:auto">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        <label for="profile-foto-inp" id="profile-av-wrap" title="Clica per canviar foto" style="position:relative;flex-shrink:0;cursor:pointer;display:block">
          <div id="profile-av" style="width:64px;height:64px;border-radius:50%;background:#059669;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;overflow:hidden"></div>
          <div id="profile-av-overlay" style="position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;opacity:0;transition:opacity .15s;pointer-events:none">📷</div>
          <input type="file" id="profile-foto-inp" accept="image/*" style="display:none" onchange="loadProfileFoto(this)"/>
        </label>
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;font-weight:700">Editar perfil</div>
          <div id="profile-email" style="font-size:12px;color:#71717A"></div>
          <div style="font-size:10px;color:#71717A;margin-top:2px">Clica la foto per canviar-la · JPG/PNG max 20MB</div>
        </div>
        <button id="profile-foto-rm" type="button" style="display:none;background:#FEE2E2;border:1px solid #FCA5A5;color:#991B1B;padding:5px 8px;border-radius:7px;font-size:10px;cursor:pointer;align-self:flex-start" onclick="removeProfileFoto()">Treure foto</button>
      </div>
      <style>#profile-av-wrap:hover #profile-av-overlay{opacity:1}</style>

      <div style="margin-bottom:12px">
        <label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:4px">Nom complet</label>
        <input type="text" id="profile-nom" style="width:100%;padding:9px 11px;border:0.5px solid rgba(0,0,0,0.18);border-radius:9px;background:#f5f4f0;color:#1a1a1a;font-size:13px;font-family:inherit;box-sizing:border-box"/>
      </div>

      <div style="margin:18px 0 10px 0;padding-top:14px;border-top:0.5px solid rgba(0,0,0,0.08)">
        <div style="font-size:13px;font-weight:600;margin-bottom:6px">Canviar contrasenya</div>
        <div style="font-size:11px;color:#71717A;margin-bottom:10px">Deixa-ho buit si no la vols canviar</div>
        <div style="margin-bottom:9px">
          <label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:4px">Contrasenya actual</label>
          <input type="password" id="profile-cur-pwd" autocomplete="current-password" style="width:100%;padding:9px 11px;border:0.5px solid rgba(0,0,0,0.18);border-radius:9px;background:#f5f4f0;color:#1a1a1a;font-size:13px;font-family:inherit;box-sizing:border-box"/>
        </div>
        <div>
          <label style="font-size:11px;color:#6b6b67;font-weight:500;display:block;margin-bottom:4px">Nova contrasenya <span style="font-weight:400;color:#9CA3AF">(min 8 caràcters)</span></label>
          <input type="password" id="profile-new-pwd" autocomplete="new-password" style="width:100%;padding:9px 11px;border:0.5px solid rgba(0,0,0,0.18);border-radius:9px;background:#f5f4f0;color:#1a1a1a;font-size:13px;font-family:inherit;box-sizing:border-box"/>
        </div>
      </div>

      <div id="profile-err" style="display:none;margin-top:10px;padding:8px 12px;background:#FEE2E2;border:0.5px solid #FCA5A5;border-radius:7px;font-size:11px;color:#991B1B"></div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-sm" onclick="closeProfileEditor()">Cancel·lar</button>
        <button class="btn btn-p btn-sm" onclick="saveProfile()" id="profile-save-btn">Desar canvis</button>
      </div>
    </div>`;
    bg.addEventListener('click',e=>{if(e.target===bg)closeProfileEditor();});
    document.body.appendChild(bg);
  }
  // Reset estats
  bg.dataset.pendingImg='';
  bg.dataset.imgRemoved='';
  document.getElementById('profile-email').textContent=u.email;
  document.getElementById('profile-nom').value=u.name||'';
  document.getElementById('profile-cur-pwd').value='';
  document.getElementById('profile-new-pwd').value='';
  document.getElementById('profile-err').style.display='none';
  // Avatar
  const av=document.getElementById('profile-av');
  const initials=(u.name||u.email||'?').trim().split(/\s+/).map(s=>s[0]).join('').slice(0,2).toUpperCase();
  const rmBtn=document.getElementById('profile-foto-rm');
  if(u.img && !String(u.img).includes('data:image/svg')){
    av.innerHTML=`<img id="profile-av-img" src="${u.img}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>`;
    av.style.padding='0';av.style.background='transparent';
    rmBtn.style.display='block';
  }else{
    av.textContent=initials;
    av.style.padding='';av.style.background='#059669';
    rmBtn.style.display='none';
  }
  bg.style.display='flex';
  setTimeout(()=>document.getElementById('profile-nom').focus(),60);
}

function closeProfileEditor(){
  const bg=document.getElementById('profile-edit-bg');
  if(bg)bg.style.display='none';
}

function loadProfileFoto(input){
  const file=input.files[0];
  if(!file)return;
  if(file.size>20*1024*1024){toast('Fitxer massa gran (max 20MB)');input.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{
    processAvatarImage(e.target.result,cropped=>{
      const bg=document.getElementById('profile-edit-bg');
      if(bg){bg.dataset.pendingImg=cropped;bg.dataset.imgRemoved='';}
      const av=document.getElementById('profile-av');
      av.innerHTML=`<img src="${cropped}" style="width:100%;height:100%;border-radius:50%;object-fit:cover"/>`;
      av.style.padding='0';av.style.background='transparent';
      document.getElementById('profile-foto-rm').style.display='block';
    });
  };
  reader.readAsDataURL(file);
}

function removeProfileFoto(){
  const bg=document.getElementById('profile-edit-bg');
  if(!bg)return;
  bg.dataset.pendingImg='';
  bg.dataset.imgRemoved='1';
  const u=window.currentUser||{};
  const av=document.getElementById('profile-av');
  av.innerHTML='';
  av.textContent=(u.name||u.email||'?').trim().split(/\s+/).map(s=>s[0]).join('').slice(0,2).toUpperCase();
  av.style.padding='';av.style.background='#059669';
  document.getElementById('profile-foto-rm').style.display='none';
  const inp=document.getElementById('profile-foto-inp');
  if(inp)inp.value='';
}

async function saveProfile(){
  const bg=document.getElementById('profile-edit-bg');
  const errEl=document.getElementById('profile-err');
  const btn=document.getElementById('profile-save-btn');
  const showErr=(msg)=>{errEl.textContent=msg;errEl.style.display='block';};
  errEl.style.display='none';
  const nom=document.getElementById('profile-nom').value.trim();
  const curPwd=document.getElementById('profile-cur-pwd').value;
  const newPwd=document.getElementById('profile-new-pwd').value;
  if(!nom){showErr('El nom no pot estar buit');return;}
  if(newPwd && newPwd.length<8){showErr('La nova contrasenya ha de tenir mínim 8 caràcters');return;}
  if(newPwd && !curPwd){showErr('Cal la contrasenya actual per a canviar-la');return;}
  // Determinar img
  const pendingImg=bg.dataset.pendingImg||'';
  const imgRemoved=bg.dataset.imgRemoved==='1';
  const payload={name:nom};
  if(pendingImg)payload.img=pendingImg;
  else if(imgRemoved)payload.img=null;
  if(newPwd){payload.currentPassword=curPwd;payload.newPassword=newPwd;}
  btn.disabled=true;btn.textContent='Desant...';
  try{
    const r=await fetch('/api/auth/me',{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json();
    if(!r.ok||!d.ok){showErr(d.error||'Error desant');btn.disabled=false;btn.textContent='Desar canvis';return;}
    window.currentUser=d.user;
    renderSidebarUser(d.user);
    closeProfileEditor();
    toast('✓ Perfil actualitzat');
  }catch(e){showErr('Error de connexió: '+e.message);}
  finally{btn.disabled=false;btn.textContent='Desar canvis';}
}

async function initApp(){
  setActiveNavButton();
  // Carrega l'usuari en paral·lel (no bloqueja la càrrega de dades)
  loadCurrentUser();
  try{
    const data=await loadAllData();

    Object.keys(data.cats).forEach(k=>{if(CATS[k])CATS[k].items=data.cats[k];});
    AGENTS=data.agents;
    selectedAgent=AGENTS[0]?.nom||'';
    FORMADORS=data.formadors.map(f=>{
      if(!f.img)f.img=makeAv(f.nom,f.id);
      return f;
    });
    RESERVES=data.reserves;
    // Festius oficials (Espanya + Catalunya + Barcelona) calculats al servidor
    if (data.festius && Object.keys(data.festius).length) {
      FESTIUS = data.festius;
    }

    // Render específic per pàgina
    const page=getCurrentPage();
    try{
      if(page==='p'){
        fillSels();upD();upR();lf();renderAgentSelector();initPeticioDraft();
        if(typeof renderFestiusInfo==='function')renderFestiusInfo();
        // Refresc proactiu dels calendaris en segon pla (no bloqueja la UI)
        // Es força un re-fetch dels iCal per tenir les dades més recents abans
        // de generar la proposta de candidats
        if(typeof refreshAllCalendars==='function'){
          setTimeout(()=>refreshAllCalendars().then(()=>{if(typeof lf==='function')lf();}).catch(()=>{}), 500);
        }
      }
      else if(page==='gest'){renderGest();}
      else if(page==='canvis'){renderCanvis();}
      else if(page==='f'){
        renderFP();initFiltreEsp();
        // Auto-refresc proactiu dels calendaris en entrar a /formadors —
        // forcem cache-bust perquè cada vegada que l'usuari entra té dades fresques
        // (a part del cron diari de les 03:00 al servidor).
        if(typeof refreshAllCalendars==='function'){
          setTimeout(()=>{
            refreshAllCalendars(null,{showToast:true}).then(()=>{
              if(typeof renderFP==='function')renderFP();
            }).catch(()=>{});
          },400);
        }
      }
      else if(page==='entrades'){renderArxiu();}
    }catch(renderErr){
      console.error('Error renderitzant pàgina',page,renderErr);
    }

    const overlay=document.getElementById('loading-overlay');
    if(overlay)overlay.style.display='none';

    // Carregar dades de calendaris en segon pla (només si afecta la pàgina actual)
    loadCalData().then(()=>{
      const nb=FORMADORS.filter(f=>f.icsUrl).length;
      if(nb>0){
        if(page==='p'&&typeof lf==='function')lf();
        // Important: re-render de /formadors quan acaba el load perquè es vegi
        // l'estat actualitzat (especialment "fa N min" del temps de sincronització)
        if(page==='f'&&typeof renderFP==='function')renderFP();
        // Mostrar toast només un cop per sessió (no cada navegació)
        if(!sessionStorage.getItem('calToastShown')){
          toast('📅 '+nb+' calendari'+(nb!==1?'s':'')+ ' sincronitzat'+(nb!==1?'s':''));
          sessionStorage.setItem('calToastShown','1');
        }
      }
    });
  }catch(e){
    console.error('Error carregant dades:',e);
    const overlay=document.getElementById('loading-overlay');
    if(overlay)overlay.innerHTML='<div style="text-align:center;padding:40px"><div style="font-size:14px;color:#991B1B;font-weight:600">Error de connexió</div><div style="font-size:12px;color:#71717A;margin-top:6px">No es pot connectar al servidor. Comprova que està en marxa.</div></div>';
  }
}
initApp();
