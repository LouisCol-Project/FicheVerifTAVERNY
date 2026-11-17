import {vehicles,roles,posts,validVerifier,verifierKey,publicPhotoUrl,referenceSlots,referencePath,itemId,isReminder,orderedSections,pressureId,asDate,dateKey,shift,missing,findPost,validDraft} from './model.js';
import * as api from './backend.js';
import {archivedReferences} from './assets-index.js';
const $=s=>document.querySelector(s), main=$('#main');
const params=new URLSearchParams(location.search), view=params.get('view')||'home';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=(v,extra={})=>'./index.html?'+new URLSearchParams({view:v,...extra});
const fmt=d=>asDate(d).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});
const read=(k,f=null)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}};
const rev=Date.now();
try{const last=Number(sessionStorage.getItem('verif-tav-last-activity'));if(!last||rev-last>3600000)sessionStorage.removeItem('verif-tav-confirmed-name');sessionStorage.setItem('verif-tav-last-activity',String(rev));}catch{}
const name=()=>{try{const n=sessionStorage.getItem('verif-tav-confirmed-name')||'';return validVerifier(n)?n:'';}catch{return '';}};
const draftKey=p=>'verif-tav-draft:'+p.id+':'+verifierKey(name());
function confirmName(n){n=n.trim().replace(/\s+/g,' ');if(!validVerifier(n))return false;try{sessionStorage.setItem('verif-tav-confirmed-name',n);sessionStorage.setItem('verif-tav-last-activity',String(Date.now()));localStorage.setItem('nomVerificateur',n);return true;}catch{return false;}}
const routeNav=view==='check'||view==='vehicle'?'vehicles':view;
document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===routeNav)a.setAttribute('aria-current','page');});
function network(){const el=$('#network');el.textContent=navigator.onLine?'● En ligne':'● Hors ligne';el.classList.toggle('offline',!navigator.onLine);}
network();window.addEventListener('online',network);window.addEventListener('offline',network);
const heading=(k,t,d)=>'<div class="heading"><span class="eyebrow">'+esc(k)+'</span><h1>'+esc(t)+'</h1><p>'+esc(d)+'</p></div>';
const back=(v,x={},label='Retour')=>'<a class="back" href="'+esc(url(v,x))+'">← '+esc(label)+'</a>';
const state=(message,type='info')=>'<div class="notice '+type+'" role="status">'+esc(message)+'</div>';
const badge=(label,type='')=>'<span class="badge '+type+'">'+esc(label)+'</span>';
const photo=(src,alt,cls='')=>'<img class="'+cls+'" src="'+esc(src)+'" alt="'+esc(alt)+'" loading="lazy" decoding="async" data-optional>';
function hideBroken(){main.querySelectorAll('img[data-optional]').forEach(img=>{img.addEventListener('error',()=>img.hidden=true);if(img.complete&&!img.naturalWidth)img.hidden=true;});}
function show(html){document.body.classList.remove('check-active','booting');main.innerHTML=html;hideBroken();bindPhotos();}
function fail(el,e,action){el.innerHTML=state(action+' '+(e?.message||'Vérifie ta connexion.'),'error')+'<button class="secondary" id="retry">Réessayer</button>';el.querySelector('#retry').onclick=()=>location.reload();}
function vehicleImage(v){return '<div class="vehicle-image"><img class="archive-preview" src="./assets/vehicles/'+v.id+'.webp" alt="Vue d’archive '+v.id+'" loading="lazy" decoding="async">'+photo(publicPhotoUrl(v.legacy+'.png',rev),v.id,'vehicle-live')+'<span class="image-chip">Photo d’archive</span></div>';}
function vehicleCard(v){return '<a class="vehicle-card" style="--accent:'+v.color+'" href="'+esc(url('vehicle',{id:v.id}))+'">'+vehicleImage(v)+'<div class="vehicle-copy"><div><h3>'+v.id+'</h3><p>'+esc(v.title)+'</p></div><div class="vehicle-meta"><small id="vehicle-status-'+v.id+'">'+v.posts.length+' postes</small><strong class="arrow" aria-hidden="true">›</strong></div></div></a>';}
function draftFor(p){if(!name())return null;const d=read(draftKey(p))||read('verif-tav-draft:'+p.id);return validDraft(d)&&verifierKey(d.verifier)===verifierKey(name())?d:null;}
function resumeCard(){
  const drafts=posts.map(p=>({p,d:draftFor(p)})).filter(x=>x.d).sort((a,b)=>b.d.updated-a.d.updated);
  if(!drafts.length)return '';
  const {p}=drafts[0];return '<a class="resume-card panel" href="'+esc(url('check',{id:p.id}))+'"><span class="resume-icon" aria-hidden="true">↻</span><div><small>BROUILLON EN COURS</small><strong>Reprendre '+esc(p.nomDoc)+'</strong><p>Retrouve ta dernière saisie.</p></div><span class="arrow">›</span></a>';
}
function setVehicleStatuses(records){
  const recent=new Map();for(const r of records){const p=findPost(r);if(p&&!recent.has(p.id))recent.set(p.id,r);}
  for(const v of vehicles){const el=$('#vehicle-status-'+v.id);if(!el)continue;const entries=[...recent].filter(([id])=>posts.find(p=>p.id===id)?.vehicle.id===v.id),alerts=entries.filter(([,r])=>missing(r).length).length;el.textContent=alerts?'⚠ '+alerts+' poste(s) avec manquants':entries.length+' / '+v.posts.length+' vérifiés';el.classList.toggle('done',entries.length===v.posts.length&&!alerts);el.closest('.vehicle-card')?.classList.toggle('vehicle-alert',!!alerts);}
}
function sectionGallery(post,section){
  return '<div class="reference-gallery"><div class="gallery-heading"><span class="gallery-icon" aria-hidden="true">▧</span> Photo de repérage <small>Toucher pour agrandir</small></div><div class="reference-grid">'+referenceSlots(post).map(n=>{
    const path=referencePath(post,section.name,n),stem=path.slice(0,-4),local=archivedReferences.has(stem)?'./assets/reference/'+stem+'.webp':'';
    return '<button type="button" class="reference-photo" data-photo-label="'+esc(section.name)+'" data-photo-kind="reference" '+(local?'data-fallback="'+esc(local)+'"':'')+'><img loading="lazy" decoding="async" data-reference src="'+esc(publicPhotoUrl(path,rev))+'" alt="'+esc(section.name)+'"><span class="reference-caption">Agrandir la photo</span></button>';
  }).join('')+'</div><p class="reference-empty" hidden>⚠ Aucune photo de repérage disponible. Contrôler le rangement réel de l’engin.</p></div>';
}
function bindPhotos(){
  main.querySelectorAll('img.vehicle-live:not([data-bound])').forEach(img=>{
    img.dataset.bound='true';
    const loaded=()=>{if(!img.naturalWidth)return;img.classList.add('loaded');img.closest('.vehicle-image').querySelector('.image-chip').hidden=true;};
    img.addEventListener('load',loaded);if(img.complete)loaded();
  });
  main.querySelectorAll('img[data-reference]:not([data-bound])').forEach(img=>{
    img.dataset.bound='true';const btn=img.closest('.reference-photo'),fallback=btn.dataset.fallback;
    const unavailable=()=>{if(fallback&&!btn.classList.contains('archived')){btn.classList.add('archived');btn.querySelector('.reference-caption').textContent='Archive · agrandir';img.src=fallback;return;}btn.hidden=true;const gallery=btn.closest('.reference-gallery');if([...gallery.querySelectorAll('.reference-photo')].every(b=>b.hidden))gallery.querySelector('.reference-empty').hidden=false;};
    img.addEventListener('error',unavailable);if(img.complete&&!img.naturalWidth)unavailable();
  });
}
main.addEventListener('click',e=>{
  const b=e.target.closest('[data-photo-kind]');if(!b)return;const im=b.querySelector('img');if(!im?.naturalWidth)return;
  $('#image-caption').textContent=b.dataset.photoLabel||'Photo';
  $('#image-full').src=im.currentSrc||im.src;$('#image-full').alt=im.alt;
  $('#image-note').textContent=b.dataset.photoKind==='verification'?'Photo prise pendant la vérification.':b.classList.contains('archived')?'Photo d’archive : contrôler le rangement réel de l’engin.':'Photo de repérage : vérifier le matériel réellement présent.';
  $('#image-viewer').showModal();
});
$('#image-close').onclick=()=>$('#image-viewer').close();
$('#image-viewer').addEventListener('click',e=>{if(e.target===$('#image-viewer'))$('#image-viewer').close();});
function home(){
  const now=new Date(),s=shift(now);
  show('<section class="hero photo-hero"><img class="hero-photo-live" src="'+esc(publicPhotoUrl('TAV.png',rev))+'" alt="" data-optional><div class="hero-content"><span class="eyebrow">CIS TAVERNY · '+esc(now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}))+'</span><h1>Prêts pour la garde.</h1><p>Vérifie ton engin en quelques gestes.</p><a class="primary light" href="'+url('vehicles')+'">Vérifier un engin <span>→</span></a></div></section>'+
  '<div id="identity-home">'+(name()?identity():identityForm())+'</div>'+resumeCard()+'<section class="section fleet-section"><div class="section-title"><div><span class="eyebrow">ACCÈS RAPIDE</span><h2>Choisir un engin</h2></div>'+badge('5 engins')+'</div><div id="fleet-alert"></div><div class="vehicles">'+vehicles.map(vehicleCard).join('')+'</div></section>'+
  '<section class="section"><div class="section-title"><div><span class="eyebrow">SUIVI OPÉRATIONNEL</span><h2>Garde en cours</h2></div>'+badge(s.label)+'</div><div id="summary">'+state('Chargement des contrôles…')+'</div></section>'+
  '<p class="footer">CIS TAVERNY · Vérif Taverny 4.2</p>');
  bindIdentity();
  api.records(s.start,s.end).then(records=>{
    const recent=new Map();records.forEach(r=>{const p=findPost(r);if(p&&!recent.has(p.id))recent.set(p.id,r);});
    setVehicleStatuses(records);
    const alerts=[...recent.values()].filter(r=>missing(r).length).length;
    if(alerts)$('#fleet-alert').innerHTML='<div class="critical-banner" role="status"><span>⚠</span><div><strong>MATÉRIEL MANQUANT</strong><p>'+alerts+' poste(s) avec manquants signalés pendant cette garde.</p></div></div>';
    $('#summary').innerHTML='<div class="metrics"><div class="metric"><small>Postes vérifiés</small><strong>'+recent.size+'<small> / '+posts.length+'</small></strong></div><div class="metric good"><small>Sans manquant</small><strong>'+(recent.size-alerts)+'</strong></div><div class="metric warn"><small>Avec manquants</small><strong>'+alerts+'</strong></div></div><div class="progress"><i style="width:'+Math.round(recent.size/posts.length*100)+'%"></i></div><p class="muted">'+(posts.length-recent.size)+' postes sans vérification enregistrée pour ce créneau.</p>';
  }).catch(()=>{$('#summary').innerHTML=state('Suivi indisponible. Les fiches restent accessibles depuis les engins.','warn');});
}
function identityForm(){return '<form id="identity-form" class="panel identity identity-entry"><span class="eyebrow">IDENTIFICATION OBLIGATOIRE</span><label for="identity-name">Nom et prénom du vérificateur *</label><input id="identity-name" name="verifier" required minlength="2" maxlength="80" autocomplete="name" autocapitalize="words" placeholder="NOM Prénom" value="'+esc(localStorage.getItem('nomVerificateur')||'')+'"><p id="identity-error" role="alert" hidden></p><button type="submit" class="primary">Valider mon identité →</button><small>Le nom sera enregistré sur chaque vérification. Vérifie-le si le téléphone est partagé.</small></form>';}
function identity(){return '<div class="panel identity identity-confirmed"><div><span class="eyebrow">VÉRIFICATEUR</span><strong>'+esc(name())+'</strong><input id="verifier" type="hidden" value="'+esc(name())+'"></div>'+(view==='check'?'':'<button type="button" id="change-verifier" class="secondary">Changer</button>')+'</div>';}
function bindIdentity(){
  const form=$('#identity-form');if(form)form.onsubmit=e=>{e.preventDefault();if(!confirmName($('#identity-name').value)){const err=$('#identity-error');err.hidden=false;err.textContent='Renseigne un nom valide pour continuer (2 à 80 caractères).';return;}location.reload();};
  const change=$('#change-verifier');if(change)change.onclick=()=>{sessionStorage.removeItem('verif-tav-confirmed-name');location.reload();};
}
function identityGate(){show('<section class="identity-gate"><img src="./assets/logo.png" alt=""><span class="eyebrow">CIS TAVERNY</span><h1>Qui vérifie l’engin ?</h1><p>Identifie-toi pour accéder à la fiche.</p></section>'+identityForm()+back('home',{},'Retour à l’accueil'));bindIdentity();$('#identity-name')?.focus();}
function vehiclesPage(){show(heading('VÉRIFICATIONS','Choisir un engin','Sélectionne ton véhicule.')+resumeCard()+identity()+'<div class="vehicles">'+vehicles.map(vehicleCard).join('')+'</div>');bindIdentity();const s=shift(new Date());api.records(s.start,s.end).then(setVehicleStatuses).catch(()=>{});}
function vehiclePage(){
  const v=vehicles.find(x=>x.id===params.get('id'));if(!v){show(state('Engin introuvable.','error')+back('vehicles'));return;}
  show(back('vehicles',{},'Tous les engins')+'<section class="vehicle-hero" style="--accent:'+v.color+'"><div>'+heading(v.title,v.id,'Choisis ton poste.')+'</div>'+vehicleImage(v)+'</section>'+identity()+'<div class="section-title"><h2>Postes disponibles</h2>'+badge(v.posts.length+' fiches')+'</div><div class="posts">'+posts.filter(p=>p.vehicle===v).map(p=>'<a class="panel post" href="'+esc(url('check',{id:p.id}))+'"><span class="role">'+p.role+'</span><div><strong>'+esc(roles[p.role])+'</strong><small id="status-'+p.id+'">'+(draftFor(p)?'↻ Reprendre le brouillon':'Ouvrir la fiche')+'</small></div><span class="arrow">›</span></a>').join('')+'</div>');
  bindIdentity();
  const s=shift(new Date());api.records(s.start,s.end).then(records=>{for(const p of posts.filter(p=>p.vehicle===v)){const r=records.find(r=>findPost(r)?.id===p.id);if(r){const e=$('#status-'+p.id),count=missing(r).length;e.textContent=(count?'⚠ '+count+' MANQUANT(S)':'Vérifié')+' · '+fmt(r.date)+' · '+(r.verificateur||'');e.className=count?'missing-post':'good-text';e.closest('.post').classList.toggle('post-alert',!!count);}}}).catch(()=>{});
}
async function checkPage(){
  const p=posts.find(x=>x.id===params.get('id'));if(!p){show(state('Poste introuvable.','error')+back('vehicles'));return;}
  const key=draftKey(p), structureKey='verif-tav-structure:'+p.id;
  let draft=draftFor(p), draftWasValid=!!draft;
  if(!draftWasValid)localStorage.removeItem(key);
  show(back('vehicle',{id:p.vehicle.id},p.vehicle.id+' · postes')+heading(p.vehicle.id+' / '+p.role,roles[p.role],'Contrôle chaque élément avant de valider la fiche.')+
    '<div id="check-status">'+state('Chargement de la fiche…')+'</div><div id="check-body"></div>');
  const status=$('#check-status'), body=$('#check-body');
  let structureData,cached=false;
  try{structureData=await api.structure(p.id);write(structureKey,{data:structureData,updated:Date.now()});}
  catch(e){const saved=read(structureKey);if(saved?.data){structureData=saved.data;cached=true;}else{fail(status,e,'Impossible de charger la fiche.');return;}}
  const sections=orderedSections(structureData);
  if(!sections.length){status.innerHTML=state('Fiche vide : contacte le bureau OPS. Aucun enregistrement possible.','error');return;}
  const items=[], reminders=[], pressureSection=p.pressure&&sections.find(s=>s.name===p.pressure&&Object.keys(s.items).some(l=>l.includes(p.role==='CO'?'ARI complet derrière le siège':'ARI complet')));
  for(const s of sections)for(const label of Object.keys(s.items)){if(isReminder(p,s))reminders.push(label);else items.push({section:s.name,label,id:itemId(s.name,label)});}
  if(!items.length||new Set(items.map(i=>i.id)).size!==items.length){status.innerHTML=state('Fiche vide ou identifiants de matériel dupliqués. Contacte le bureau OPS.','error');return;}
  const values={};for(const item of items){const v=draft?.values?.[item.id];if(v===true||v===false)values[item.id]=v;}
  let photos=[], busy=false, preparing=false, dirty=false, last=null, finished=false;
  status.innerHTML=(cached?state('Fiche mémorisée, connexion indisponible. Vérifie la version avant de transmettre.','warn'):'')+(draftWasValid?state('Brouillon récupéré (moins d’une heure). Les photos doivent être reprises si la page a été fermée.','good'):'')+'<div id="previous-status"></div>';
  if(p.id==='CAVSSUAP')reminders.unshift('Remplir le registre de désinfection et le contrôle du Touch7.');
  const checkSections=sections.filter(s=>!isReminder(p,s));
  body.innerHTML=identity()+(reminders.length?'<details class="panel reminders" open><summary>Consignes à respecter</summary><ul>'+reminders.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></details>':'')+
    '<div class="panel check-progress"><div class="section-title"><div><strong>Avancement</strong><span id="progress-number"></span></div><button type="button" id="next-item" class="chip">Suivant ↓</button></div><div class="progress"><i id="progress-fill"></i></div><p class="muted" id="progress-detail"></p><button type="button" id="missing-alert" class="missing-alert" hidden></button></div>'+
    '<div class="panel check-tools"><label for="jump-section">Accéder à un compartiment</label><select id="jump-section"><option value="">Choisir le compartiment…</option>'+checkSections.map((s,i)=>'<option value="'+i+'">'+esc(s.name)+'</option>').join('')+'</select><input id="search-material" type="search" placeholder="Rechercher un matériel…" aria-label="Rechercher un matériel"><div class="filters" role="group" aria-label="Filtrer le matériel"><button class="chip selected" data-filter="all">Tout</button><button class="chip" data-filter="pending">À contrôler</button><button class="chip" data-filter="missing">Manquants</button></div></div>'+
    '<div id="sections">'+checkSections.map((s,i)=>'<section class="panel check-section" id="section-'+i+'"><div class="section-title"><div><span class="section-kicker">COMPARTIMENT '+(i+1)+' / '+checkSections.length+'</span><h2>'+esc(s.name)+'</h2></div><small class="section-count"></small></div>'+sectionGallery(p,s)+items.filter(i=>i.section===s.name).map(i=>'<div class="check-row" data-item="'+esc(i.id)+'"><div class="item-label"><strong>'+esc(i.label)+'</strong><small class="previous" hidden></small></div><div class="choice" role="group" aria-label="'+esc(i.label)+'"><button type="button" data-value="true" aria-pressed="false"><span aria-hidden="true">✓</span> Présent</button><button type="button" data-value="false" aria-pressed="false"><span aria-hidden="true">!</span> Absent</button></div></div>').join('')+(s===pressureSection?'<label class="pressure">Pression de la bouteille ARI (bar)<input id="pressure" type="number" inputmode="numeric" min="280" step="1" placeholder="300" value="'+esc(draft?.pressure??'')+'"><small>Minimum 280 bar selon la consigne de la fiche.</small></label>':'')+'</section>').join('')+'</div>'+
    '<section class="panel" id="finish-form"><div class="section-title"><h2>Fin de vérification</h2></div><label for="comment">Commentaire</label><textarea id="comment" rows="3" placeholder="Décris les anomalies constatées…">'+esc(draft?.comment||'')+'</textarea>'+(p.photos?'<div class="photo-area"><label>Photos de vérification</label><div class="photo-actions"><label class="photo-action" for="camera"><span aria-hidden="true">📷</span> Prendre une photo</label><label class="photo-action" for="files"><span aria-hidden="true">▧</span> Galerie</label></div><input class="file-accessible" type="file" id="camera" accept="image/*" capture="environment"><input class="file-accessible" type="file" id="files" accept="image/*" multiple><small id="photo-count">0 / 6 photos</small><div id="previews" class="previews"></div></div>':'')+'<button id="reset" class="reset-link" type="button">Réinitialiser la fiche</button></section><div class="savebar"><div id="save-status" aria-live="polite"></div><div class="save-actions"><a class="save-back" href="'+esc(url('vehicle',{id:p.vehicle.id}))+'" aria-label="Retour aux postes">←</a><button id="save" class="primary">Enregistrer la vérification</button></div><p id="save-hint">Contrôle chaque élément</p></div>';
  document.body.classList.add('check-active');
  hideBroken();bindPhotos();bindIdentity();
  let filter='all';
  const inputName=$('#verifier'), comment=$('#comment'), pressure=$('#pressure');
  function persist(){dirty=true;const ok=write(key,{updated:Date.now(),values,verifier:inputName.value.trim(),comment:comment.value,pressure:pressure?.value||''});if(!ok)$('#save-status').innerHTML=state('Brouillon non sauvegardé : stockage local indisponible.','warn');}
  function render(){
    const done=items.filter(i=>typeof values[i.id]==='boolean').length, absent=items.filter(i=>values[i.id]===false).length, previousPending=items.filter(i=>last?.data?.[i.id]===false&&typeof values[i.id]!=='boolean').length;
    $('#progress-number').textContent=done+' / '+items.length;$('#progress-fill').style.width=(100*done/items.length)+'%';$('#progress-detail').textContent=(items.length-done)+' à contrôler · '+absent+' absent(s)';
    const q=$('#search-material').value.toLowerCase().trim();
    body.querySelectorAll('.check-row').forEach(row=>{
      const i=items.find(i=>i.id===row.dataset.item), v=values[i.id];row.dataset.state=v===true?'present':v===false?'absent':'pending';
      row.querySelectorAll('[data-value]').forEach(b=>b.setAttribute('aria-pressed',String(typeof v==='boolean'&&String(v)===b.dataset.value)));
      const prior=last?.data?.[i.id]===false;
      row.classList.toggle('previous-missing',prior&&v!==true);row.classList.toggle('resolved-missing',prior&&v===true);
      row.hidden=!(i.label.toLowerCase().includes(q)||i.section.toLowerCase().includes(q))||(filter==='pending'&&typeof v==='boolean')||(filter==='missing'&&v!==false&&!(prior&&typeof v!=='boolean'));
      const prev=row.querySelector('.previous');prev.hidden=!(v===false||prior);prev.textContent=v===false?'⚠ MATÉRIEL MANQUANT SIGNALÉ':prior&&v===true?'✓ Manquant précédent · retrouvé':'⚠ MANQUANT AU DERNIER CONTRÔLE — À VÉRIFIER';
    });
    body.querySelectorAll('.check-section').forEach(s=>{const rows=[...s.querySelectorAll('.check-row')],alerts=rows.filter(r=>r.dataset.state==='absent'||r.classList.contains('previous-missing')).length;s.classList.toggle('section-alert',!!alerts);s.querySelector('.section-count').textContent=rows.filter(r=>r.dataset.state!=='pending').length+'/'+rows.length+(alerts?' · ⚠ '+alerts:'');s.hidden=rows.every(r=>r.hidden)&&!s.querySelector('.pressure');});
    $('#save').disabled=busy||preparing;
    $('#next-item').textContent=done===items.length?'Terminer ↓':'Suivant ↓';
    $('#save-hint').textContent=preparing?'Préparation des photos…':done===items.length?'Tous les éléments ont été contrôlés':(items.length-done)+' élément(s) à contrôler';
    const alert=$('#missing-alert');alert.hidden=!(absent||previousPending);alert.textContent=(absent?'⚠ '+absent+' MATÉRIEL(S) MANQUANT(S)':'')+(previousPending?(absent?' · ':'⚠ ')+previousPending+' manquant(s) précédent(s) à contrôler':'')+' →';$('#save-hint').classList.toggle('missing-save-hint',!!absent);
  }
  function previews(){const el=$('#previews');if(!el)return;el.innerHTML='';$('#photo-count').textContent=photos.length+' / 6 photos';photos.forEach((p,i)=>{const wrap=document.createElement('div');const im=document.createElement('img');im.src=p.url;im.alt='Photo '+(i+1);const b=document.createElement('button');b.textContent='Retirer';b.type='button';b.disabled=busy||preparing;b.onclick=()=>{URL.revokeObjectURL(p.url);photos.splice(i,1);previews();};wrap.append(im,b);el.append(wrap);});}
  body.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||busy)return;
    if(b.dataset.value){const id=b.closest('[data-item]').dataset.item,v=b.dataset.value==='true';if(values[id]===v)delete values[id];else values[id]=v;persist();$('#save-status').innerHTML='';render();}
    if(b.dataset.filter){filter=b.dataset.filter;body.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));render();}
  });
  $('#search-material').oninput=render;
  function resetFilters(){filter='all';$('#search-material').value='';body.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter==='all'));render();}
  function nextItem(){resetFilters();const next=body.querySelector('.check-row[data-state="pending"]')||$('#finish-form');next.scrollIntoView({behavior:'smooth',block:'start'});}
  $('#next-item').onclick=nextItem;
  $('#missing-alert').onclick=()=>{filter='missing';$('#search-material').value='';body.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.filter==='missing'));render();body.querySelector('.check-row:not([hidden])')?.scrollIntoView({behavior:'smooth',block:'start'});};
  $('#jump-section').onchange=e=>{if(e.target.value==='')return;resetFilters();$('#section-'+e.target.value)?.scrollIntoView({behavior:'smooth',block:'start'});e.target.value='';};
  [inputName,comment,pressure].filter(Boolean).forEach(i=>i.addEventListener('input',persist));
  const fileInputs=[$('#files'),$('#camera')].filter(Boolean);
  for(const fileInput of fileInputs)fileInput.onchange=async()=>{
    const selected=[...fileInput.files];fileInput.value='';if(preparing||busy)return;
    if(photos.length>=6){$('#save-status').innerHTML=state('Six photos maximum. Retire une photo pour en ajouter.','warn');return;}
    const capacity=6-photos.length;preparing=true;fileInputs.forEach(i=>i.disabled=true);render();
    try{for(const f of selected.slice(0,capacity)){const blob=await compress(f);photos.push({blob,url:URL.createObjectURL(blob),token:crypto.randomUUID()});dirty=true;}if(selected.length>capacity)$('#save-status').innerHTML=state('Six photos maximum ont été retenues.','warn');}
    catch(e){$('#save-status').innerHTML=state('Une image n’a pas pu être préparée. Utilise un fichier JPEG ou PNG.','error');}finally{preparing=false;fileInputs.forEach(i=>i.disabled=busy);render();previews();}
  };
  function clearDraft(){localStorage.removeItem(key);const oldKey='verif-tav-draft:'+p.id;if(verifierKey(read(oldKey)?.verifier)===verifierKey(name()))localStorage.removeItem(oldKey);}
  $('#reset').onclick=()=>{if(!confirm('Effacer le brouillon et les contrôles de cette fiche ?'))return;clearDraft();location.reload();};
  let saveId=null, saveDate=null, uploaded=new Set();
  $('#save').onclick=async()=>{
    const feedback=$('#save-status');feedback.innerHTML='';
    if(!validVerifier(name())||name()!==inputName.value){feedback.innerHTML=state('Identité obligatoire : confirme ton nom avant de poursuivre.','error');return;}
    if(items.some(i=>typeof values[i.id]!=='boolean')){feedback.innerHTML=state('Tous les éléments doivent être contrôlés.','warn');nextItem();return;}
    if(pressure&&(!pressure.value||!pressure.checkValidity())){feedback.innerHTML=state('Renseigne une pression ARI valide (au moins 280 bar).','error');pressure.focus();return;}
    const absent=items.filter(i=>values[i.id]===false).length;
    if(absent&&!comment.value.trim()){feedback.innerHTML=state('Décris les éléments absents et les anomalies dans le commentaire.','warn');comment.focus();return;}
    if(!navigator.onLine){feedback.innerHTML=state('Hors ligne : brouillon conservé, aucune transmission effectuée.','warn');persist();return;}
    if(cached&&!confirm('La fiche a été chargée depuis le cache. Enregistrer malgré tout ?'))return;
    if(absent&&!confirm('Confirmer la vérification avec '+absent+' manquant(s) ?'))return;
    busy=true;render();previews();body.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=true);$('#save').textContent='Transmission…';
    saveDate ||= new Date();saveId ||= p.nomDoc+'_'+saveDate.getTime();
    try{
      for(const ph of photos){if(uploaded.has(ph.token))continue;feedback.innerHTML=state('Envoi des photos…');await api.upload('CO-'+p.vehicle.id+'/'+saveId+'/photo_'+ph.token+'.jpg',ph.blob);uploaded.add(ph.token);}
      const data={...values};if(pressure)data[pressureId(p)]=Number(pressure.value);
      feedback.innerHTML=state('Enregistrement en cours…');
      await api.save(saveId,{nomDoc:p.nomDoc,date:saveDate,verificateur:inputName.value.trim(),commentaire:comment.value.trim(),data});
      try{sessionStorage.setItem('verif-tav-last-activity',String(Date.now()));}catch{}
      finished=true;clearDraft();dirty=false;photos.forEach(p=>URL.revokeObjectURL(p.url));show(heading('VÉRIFICATION ENREGISTRÉE','C’est terminé !','La fiche a été transmise avec succès.')+'<div class="panel success-screen"><strong>✓</strong><h2>'+esc(p.nomDoc)+'</h2><p>'+items.length+' éléments contrôlés · '+absent+' manquant(s)</p>'+(absent?'<div class="critical-banner"><span>⚠</span><div><strong>MATÉRIEL MANQUANT</strong><p>'+absent+' manquant(s) enregistré(s).</p></div></div>':'')+'<a class="primary" href="'+esc(url('vehicle',{id:p.vehicle.id}))+'">Retour aux postes</a><a class="secondary" href="'+url('history')+'">Voir l’historique</a></div>');
    }catch(e){feedback.innerHTML=state('Échec de transmission. La fiche n’est pas confirmée ; les saisies sont conservées. Réessaie. ('+(e.message||'Erreur réseau')+')','error');persist();busy=false;body.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=false);$('#save').textContent='Réessayer l’enregistrement';render();previews();}
  };
  window.addEventListener('beforeunload',e=>{if(dirty&&photos.length){e.preventDefault();e.returnValue='';}});
  render();
  api.latest(p.nomDoc).then(r=>{if(finished)return;last=r;if(r){const n=missing(r).length;$('#previous-status').innerHTML=n?'<div class="critical-banner"><span>⚠</span><div><strong>'+n+' MANQUANT(S) AU DERNIER CONTRÔLE</strong><p>'+esc(fmt(r.date)+' · '+(r.verificateur||'Non renseigné'))+'</p></div></div>':state('Dernier contrôle : '+fmt(r.date)+' · '+(r.verificateur||'Non renseigné')+' · aucun manquant.','info');render();}}).catch(()=>{if(!finished)$('#previous-status').innerHTML=state('Dernier contrôle non disponible.','warn');});
}
async function compress(file){
  let bitmap, imgUrl;
  try{
    if(typeof createImageBitmap==='function'){try{bitmap=await createImageBitmap(file);}catch{}}
    if(!bitmap){imgUrl=URL.createObjectURL(file);bitmap=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=imgUrl;});}
    const width=bitmap.naturalWidth||bitmap.width,height=bitmap.naturalHeight||bitmap.height,scale=Math.min(1,1600/Math.max(width,height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image invalide')),'image/jpeg',.82));
  }finally{bitmap?.close?.();if(imgUrl)URL.revokeObjectURL(imgUrl);}
}
function history(){
  const today=new Date(),from=new Date(today);from.setDate(from.getDate()-6);
  show(heading('TRAÇABILITÉ','Historique','Retrouve les contrôles par période, engin, poste ou vérificateur.')+
    '<form id="history-form" class="panel history-filters"><div class="period-actions"><button type="button" class="chip" data-days="1">Aujourd’hui</button><button type="button" class="chip selected" data-days="7">7 jours</button><button type="button" class="chip" data-days="30">30 jours</button></div><div><label for="from">Du</label><input id="from" type="date" value="'+dateKey(from)+'" required></div><div><label for="to">Au</label><input id="to" type="date" value="'+dateKey(today)+'" required></div><button class="primary" type="submit">Afficher</button></form>'+
    '<div class="panel history-filters"><div><label for="vehicle-filter">Engin</label><select id="vehicle-filter"><option value="">Tous les engins</option>'+vehicles.map(v=>'<option>'+v.id+'</option>').join('')+'</select></div><div><label for="result-filter">Résultat</label><select id="result-filter"><option value="">Tous</option><option value="missing">Avec manquants</option><option value="ok">Sans manquant</option></select></div><div><label for="history-search">Recherche</label><input id="history-search" type="search" placeholder="Poste, nom, commentaire…"></div></div><div id="history-summary"></div><div id="history-results"></div><dialog id="record-modal"><div id="record-detail"></div><button class="secondary" id="close-record">Fermer</button></dialog>');
  let all=[], loading=false;
  const result=$('#history-results');
  function render(){
    const v=$('#vehicle-filter').value,r=$('#result-filter').value,q=$('#history-search').value.trim().toLowerCase();
    const list=all.filter(x=>(!v||findPost(x)?.vehicle.id===v)&&(!r||(r==='missing')===!!missing(x).length)&&[x.nomDoc,x.verificateur,x.commentaire].join(' ').toLowerCase().includes(q));
    $('#history-summary').innerHTML='<div class="metrics"><div class="metric"><small>Vérifications</small><strong>'+list.length+'</strong></div><div class="metric good"><small>Sans manquant</small><strong>'+list.filter(r=>!missing(r).length).length+'</strong></div><div class="metric warn"><small>Avec manquants</small><strong>'+list.filter(r=>missing(r).length).length+'</strong></div></div>';
    if(!list.length){result.innerHTML=state('Aucune vérification correspondant aux filtres.');return;}
    const groups=new Map();list.forEach(x=>{const d=asDate(x.date);if(isNaN(d))return;const s=shift(d);if(!groups.has(s.key))groups.set(s.key,{s,rows:[]});groups.get(s.key).rows.push(x);});
    result.innerHTML=[...groups.values()].map(({s,rows})=>'<section class="section"><div class="section-title"><h2>'+esc(s.start.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))+'</h2>'+badge(s.label)+'</div><div class="records">'+rows.map(x=>{const p=findPost(x);return '<button class="record panel" data-record="'+esc(x.id)+'">'+(p?'<img class="record-thumb" src="./assets/vehicles/'+p.vehicle.id+'.webp" alt="" loading="lazy">':'')+'<div><strong>'+esc(x.nomDoc||'Poste inconnu')+'</strong><small>'+esc(x.verificateur||'Inconnu')+' · '+esc(fmt(x.date))+'</small></div>'+badge(missing(x).length?missing(x).length+' absent(s)':'Sans manquant',missing(x).length?'warn':'good')+'<span class="arrow">›</span></button>';}).join('')+'</div></section>').join('');
  }
  async function load(){
    if(loading)return;const start=new Date($('#from').value+'T00:00:00'),end=new Date($('#to').value+'T00:00:00');end.setDate(end.getDate()+1);
    if(isNaN(start)||isNaN(end)||end<=start||end-start>93*86400000){result.innerHTML=state('Choisis une période valide de 92 jours maximum.','warn');return;}
    loading=true;$('#history-form').querySelectorAll('button,input').forEach(el=>el.disabled=true);result.innerHTML=state('Chargement des vérifications…');$('#history-summary').innerHTML='';
    try{all=await api.records(start,end);render();}catch(e){all=[];result.innerHTML=state('Impossible de charger l’historique : '+e.message,'error');}
    finally{loading=false;$('#history-form').querySelectorAll('button,input').forEach(el=>el.disabled=false);}
  }
  $('#history-form').onsubmit=e=>{e.preventDefault();load();};
  $('#history-form').querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{const end=new Date(),start=new Date(end);start.setDate(start.getDate()-Number(b.dataset.days)+1);$('#from').value=dateKey(start);$('#to').value=dateKey(end);$('#history-form').querySelectorAll('[data-days]').forEach(x=>x.classList.toggle('selected',x===b));load();});
  ['from','to'].forEach(id=>$('#'+id).addEventListener('change',()=>$('#history-form').querySelectorAll('[data-days]').forEach(b=>b.classList.remove('selected'))));
  ['vehicle-filter','result-filter','history-search'].forEach(id=>$('#'+id).addEventListener('input',()=>{if(!loading)render();}));
  $('#close-record').onclick=()=>$('#record-modal').close();
  result.onclick=async e=>{
    const b=e.target.closest('[data-record]');if(!b)return;const x=all.find(x=>x.id===b.dataset.record);if(!x)return;
    const pp=findPost(x), detail=$('#record-detail');
    detail.innerHTML=heading('DÉTAIL DU CONTRÔLE',x.nomDoc||'Vérification',fmt(x.date)+' · '+(x.verificateur||'Inconnu'))+'<h3>Matériel manquant</h3>'+(missing(x).length?'<ul>'+missing(x).map(([k])=>'<li>'+esc(k.replaceAll('_',' '))+'</li>').join('')+'</ul>':state('Aucun matériel manquant enregistré.','good'))+'<h3>Commentaire</h3><p class="comment-text">'+esc(x.commentaire||'Aucun commentaire.')+'</p>'+
    '<details><summary>Contrôle complet</summary><ul>'+Object.entries(x.data||{}).map(([k,v])=>'<li>'+esc(k.replaceAll('_',' '))+' : '+esc(v===true?'Présent':v===false?'Absent':v??'Non renseigné')+'</li>').join('')+'</ul></details>'+(pp?.photos?'<h3>Photos</h3><div id="record-photos">'+state('Chargement…')+'</div>':'');
    $('#record-modal').showModal();
    if(pp?.photos){const target=$('#record-photos');try{let urls=await api.photos('CO-'+pp.vehicle.id+'/'+x.id);if(!urls.length&&pp.vehicle.id==='VSRM')urls=await api.photos('CO-VRSM/'+x.id);target.innerHTML=urls.length?'<div class="reference-grid">'+urls.map((u,i)=>'<button type="button" class="reference-photo" data-photo-kind="verification" data-photo-label="Photo '+(i+1)+'">'+photo(u,'Photo de vérification')+'<span class="reference-caption">Agrandir</span></button>').join('')+'</div>':state('Aucune photo.');hideBroken();}catch(e){target.innerHTML=state('Photos indisponibles.','warn');}}
  };
  load();
}
function office(){
  show(heading('GESTION','Espace bureau','Accès réservé aux personnels autorisés.')+'<section class="panel"><form id="login-form"><label for="office-type">Espace</label><select id="office-type"><option value="OPS">Bureau OPS</option><option value="ADMIN">Administration</option></select><label for="user">Identifiant</label><input id="user" autocomplete="username" required><label for="password">Mot de passe</label><input id="password" type="password" autocomplete="current-password" required><div id="login-status" aria-live="polite"></div><button class="primary" type="submit">Se connecter</button></form></section><p class="muted">L’accès utilise les comptes existants. La sécurité des données dépend des règles de la base.</p>');
  $('#login-form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button'),s=$('#login-status'),u=$('#user').value.trim(),p=$('#password').value.trim(),type=$('#office-type').value;
    b.disabled=true;s.innerHTML=state('Connexion…');['userRole','bureauAccess','currentUser'].forEach(k=>localStorage.removeItem(k));
    try{const role=await api.login(u,p);if(!(type==='ADMIN'?role==='admin':['admin','OPS'].includes(role)))throw Error('Accès refusé.');
      localStorage.setItem('userRole',role);localStorage.setItem('bureauAccess',type);localStorage.setItem('currentUser',u);location.href=type==='ADMIN'?'./admin.html':'./bureau-ops.html';
    }catch(e){s.innerHTML=state(e.message||'Connexion impossible.','error');b.disabled=false;}
  };
}
const liveLogo=$('#brand-logo');
if(liveLogo){const img=new Image();img.onload=()=>{liveLogo.src=img.src;};img.src=publicPhotoUrl('logo.png',rev);}
if(['vehicles','vehicle','check'].includes(view)&&!name())identityGate();
else switch(view){case 'home':home();break;case 'vehicles':vehiclesPage();break;case 'vehicle':vehiclePage();break;case 'check':checkPage();break;case 'history':history();break;case 'office':office();break;default:show(heading('NAVIGATION','Page introuvable','Reviens à l’accueil.')+back('home'));}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
window.addEventListener('beforeinstallprompt',e=>{
  if(view!=='home')return;
  e.preventDefault();
  const b=document.createElement('button');b.className='secondary install';b.textContent='Installer l’application';
  b.onclick=async()=>{await e.prompt();b.remove();};
  main.append(b);
});
