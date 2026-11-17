import {vehicles,posts,roles,publicPhotoUrl,asDate,dateKey,shift,missing,findPost,orderedSections,orderedItems,isReminder,referencePath} from './model.js';
import {knownRoles,assertValidUser,dashboardStats,draftSections,buildStructure,recordsCsv} from './admin-model.js';
import * as api from './admin-api.js';
import {mountPhotoAdmin} from './photo-admin.js';

const $=s=>document.querySelector(s),main=$('#admin-main'),dialog=$('#admin-dialog'),dialogBody=$('#dialog-body');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titles={dashboard:'Tableau de bord',monitoring:'Suivi des vérifications',users:'Utilisateurs',fiches:'Fiches matériel',photos:'Gestion des photos'};
const fmt=d=>{if(!d)return '—';const x=asDate(d);return isNaN(x)?'—':x.toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'});};
const icon=(n)=>({check:'✓',warn:'!',clock:'◷',users:'♙',photos:'▧',file:'☷'}[n]||'•');
const button=(label,action,style='secondary')=>'<button type="button" class="'+style+'" data-action="'+action+'">'+esc(label)+'</button>';
const badge=(t,style='')=>'<span class="badge '+style+'">'+esc(t)+'</span>';
const heading=(k,t,d,actions='')=>'<div class="page-header"><div><span class="eyebrow">'+esc(k)+'</span><h1>'+esc(t)+'</h1><p>'+esc(d)+'</p></div><div class="page-actions">'+actions+'</div></div>';
const notice=(text,kind='')=>'<div class="notice '+kind+'">'+esc(text)+'</div>';
const loading=(text='Chargement…')=>'<div class="loading-card"><div class="spinner"></div><strong>'+esc(text)+'</strong></div>';
const metric=(label,value,sub,style='',sym='check')=>'<article class="metric '+style+'"><span class="metric-icon">'+icon(sym)+'</span><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><p>'+esc(sub)+'</p></article>';
const avatar=id=>esc(String(id).trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0).toUpperCase()).join('')||'?');
const photo=(v,cls='')=>'<img class="'+cls+'" src="./assets/vehicles/'+v.id+'.webp" alt="" loading="lazy">';
let adminId='',view='',seq=0,dirty=false,busy=false,photoController=null,toastTimer,dialogBusy=false,usersCache=[];
function toast(message,type='success'){const t=$('#toast');t.textContent=message;t.className=type;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,4500);}
function status(){const c=$('#connection');c.textContent=navigator.onLine?'● En ligne':'● Hors ligne';c.classList.toggle('offline',!navigator.onLine);}
function setMain(html){main.innerHTML=html;}
function fail(target,e,retry){target.innerHTML=notice(e?.message||'Erreur de connexion.','error')+'<button type="button" class="secondary" id="retry-admin">Réessayer</button>';target.querySelector('#retry-admin').onclick=retry;}
function leave(){if(busy||dialogBusy){toast('Un enregistrement est en cours.','error');return false;}if(photoController&&!photoController.canLeave())return false;if(dirty&&!confirm('Abandonner les modifications de la fiche non enregistrées ?'))return false;return true;}
function go(next,options={}){
  if(!adminId||!titles[next]||(!options.force&&!leave()))return;
  if(photoController){photoController.dispose();photoController=null;}
  dirty=false;view=next;const token=++seq;
  if(dialog.open)dialog.close();
  history.replaceState(null,'','#'+next);$('#current-page').textContent=titles[next];
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===next);if(b.dataset.view===next)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  window.scrollTo(0,0);
  if(next==='dashboard')dashboard(token);
  else if(next==='monitoring')monitoring(token,options);
  else if(next==='users')usersView(token);
  else if(next==='fiches')fichesView(token,options);
  else if(next==='photos')photosView(token,options);
}
document.querySelectorAll('[data-view]').forEach(b=>{b.disabled=true;b.onclick=()=>go(b.dataset.view);});
window.addEventListener('beforeunload',e=>{if(dirty||busy||dialogBusy||photoController?.hasChanges()){e.preventDefault();e.returnValue='';}});
function logout(){if(!leave())return;['userRole','bureauAccess','currentUser'].forEach(k=>localStorage.removeItem(k));location.replace('./index.html?view=office');}
$('#logout').onclick=logout;$('#mobile-logout').onclick=logout;
document.querySelectorAll('.back-site,.mobile-back').forEach(a=>a.onclick=e=>{if(!leave())e.preventDefault();});
window.addEventListener('online',status);window.addEventListener('offline',status);status();
function openDialog(title,content){dialogBody.innerHTML='<div class="dialog-head"><div><span class="eyebrow">ADMINISTRATION</span><h2>'+esc(title)+'</h2></div><button type="button" id="close-dialog" class="icon-btn" aria-label="Fermer">×</button></div>'+content;$('#close-dialog').onclick=()=>{if(!dialogBusy)dialog.close();};if(!dialog.open)dialog.showModal();}
dialog.addEventListener('cancel',e=>{if(dialogBusy)e.preventDefault();});
function bindAction(id,fn){const b=$(id);if(b)b.onclick=fn;}
function dashboard(token){
  const guard=shift(new Date());
  setMain(heading('PILOTAGE OPÉRATIONNEL','Tableau de bord','Vue d’ensemble du centre et de la garde en cours.',button('Actualiser ↻','refresh'))+
    '<div class="overview-banner"><div><span class="eyebrow">CIS TAVERNY · GARDE EN COURS</span><h2>'+esc(guard.start.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}))+'</h2><p>'+esc(guard.label)+'</p></div><span class="guard-tag">18 postes · 5 engins</span></div>'+
    '<div id="dashboard-data">'+loading('Chargement du suivi…')+'</div><div class="quick-heading"><h2>Gestion du centre</h2></div><div class="quick-grid"><button class="quick-card" data-jump="users"><span>♙</span><div><strong>Utilisateurs</strong><small>Comptes et droits</small></div><b>›</b></button><button class="quick-card" data-jump="fiches"><span>☷</span><div><strong>Fiches matériel</strong><small>18 fiches à gérer</small></div><b>›</b></button><button class="quick-card" data-jump="photos"><span>▧</span><div><strong>Visuels</strong><small>Présentation et repérage</small></div><b>›</b></button></div>');
  main.querySelector('[data-action=refresh]').onclick=()=>go('dashboard',{force:true});
  main.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>go(b.dataset.jump));
  api.records(guard.start,guard.end).then(records=>{
    if(token!==seq)return;
    const stats=dashboardStats(records),target=$('#dashboard-data');
    target.innerHTML='<div class="metrics">'+metric('Postes vérifiés',stats.verified+' / '+posts.length,'Dernière fiche de chaque poste','good','check')+metric('À vérifier',stats.notDone,'Postes sans contrôle','neutral','clock')+metric('Postes avec manquants',stats.anomalyPosts,'Dernier contrôle de la garde','danger','warn')+metric('Matériels manquants',stats.missingCount,'Sur les dernières fiches','danger','file')+'</div>'+
      (stats.anomalyPosts?'<button type="button" id="dashboard-alert" class="critical-banner"><span>⚠</span><div><strong>'+stats.anomalyPosts+' poste(s) avec matériel manquant</strong><small>Consulter les anomalies signalées sur la garde</small></div><b>›</b></button>':'')+
      '<section class="panel"><div class="panel-head"><div><h2>Avancement des engins</h2><p>Dernière vérification connue pour la garde.</p></div>'+badge(stats.verified+' / '+posts.length,'good')+'</div><div class="fleet-grid">'+stats.fleet.map(s=>'<button class="fleet-card '+(s.withMissing?'fleet-danger':'')+'" data-fleet="'+s.vehicle.id+'">'+photo(s.vehicle,'fleet-img')+'<div><strong>'+s.vehicle.id+'</strong><small>'+esc(s.vehicle.title)+'</small><div class="progress"><i style="width:'+(s.done/s.total*100)+'%"></i></div><div class="fleet-meta"><span>'+s.done+'/'+s.total+' vérifiés</span>'+(s.withMissing?badge('⚠ '+s.withMissing+' anomalie(s)','danger'):s.done===s.total?badge('Terminé','good'):badge('En cours'))+'</div></div></button>').join('')+'</div></section>'+
      '<section class="panel"><div class="panel-head"><div><h2>Dernières anomalies</h2><p>Manquants des dernières vérifications par poste.</p></div>'+button('Tout consulter','all-alerts')+'</div>'+(!stats.anomalies.length?'<div class="empty good-empty">✓ Aucun manquant sur les postes vérifiés pendant ce créneau.</div>':'<div class="record-list">'+stats.anomalies.slice(0,5).map((r,i)=>recordRow(r,i)).join('')+'</div>')+'</section>';
    target.querySelectorAll('[data-fleet]').forEach(b=>b.onclick=()=>go('monitoring',{vehicle:b.dataset.fleet,period:'shift'}));
    target.querySelector('[data-action=all-alerts]').onclick=()=>go('monitoring',{result:'missing',period:'shift'});
    bindAction('#dashboard-alert',()=>go('monitoring',{result:'missing',period:'shift'}));
    target.querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>showRecord(stats.anomalies[Number(b.dataset.record)]));
  }).catch(e=>{if(token===seq)fail($('#dashboard-data'),e,()=>go('dashboard',{force:true}));});
}
function recordRow(r,i){
  const p=findPost(r),m=missing(r).length;
  return '<button class="record-row '+(m?'record-danger':'')+'" data-record="'+i+'">'+(p?photo(p.vehicle,'record-thumb'):'<div class="record-thumb placeholder">?</div>')+'<div class="record-name"><strong>'+esc(r.nomDoc||'Vérification')+'</strong><small>'+esc(r.verificateur||'Non renseigné')+' · '+esc(fmt(r.date))+'</small></div>'+badge(m?'⚠ '+m+' manquant(s)':'Conforme',m?'danger':'good')+'<b class="row-chevron">›</b></button>';
}
async function showRecord(r){
  if(!r)return;const p=findPost(r),miss=missing(r);
  openDialog(r.nomDoc||'Détail de vérification','<p class="muted">'+esc(fmt(r.date))+' · '+esc(r.verificateur||'Non renseigné')+'</p>'+
    (miss.length?'<div class="critical-banner static"><span>⚠</span><div><strong>'+miss.length+' matériel(s) manquant(s)</strong><small>À contrôler sur l’engin</small></div></div><ul class="missing-list">'+miss.map(([k])=>'<li>'+esc(k.replaceAll('_',' '))+'</li>').join('')+'</ul>':notice('Aucun matériel manquant enregistré.','success'))+
    '<h3>Commentaire</h3><div class="comment-box">'+esc(r.commentaire||'Aucun commentaire.')+'</div><details class="detail-list"><summary>Voir tous les contrôles</summary>'+Object.entries(r.data||{}).map(([k,v])=>'<div><span>'+esc(k.replaceAll('_',' '))+'</span>'+badge(v===true?'Présent':v===false?'Absent':String(v??'Non renseigné'),v===false?'danger':v===true?'good':'')+'</div>').join('')+'</details>'+(p?.photos?'<h3>Photos de vérification</h3><div id="record-photos">'+loading('Chargement des photos…')+'</div>':''));
  if(p?.photos)try{
    const el=$('#record-photos');let urls=await api.verificationPhotos('CO-'+p.vehicle.id+'/'+r.id);if(!urls.length&&p.vehicle.id==='VSRM')urls=await api.verificationPhotos('CO-VRSM/'+r.id);
    if(!el?.isConnected)return;el.innerHTML=urls.length?'<div class="record-photos">'+urls.map((u,i)=>'<a href="'+esc(u)+'" target="_blank" rel="noopener"><img src="'+esc(u)+'" alt="Photo '+(i+1)+'"></a>').join('')+'</div>':notice('Aucune photo enregistrée.');
  }catch(e){const el=$('#record-photos');if(el)el.innerHTML=notice('Photos indisponibles.','error');}
}
function monitoring(token,options={}){
  const now=new Date(),prior=new Date(now);prior.setDate(prior.getDate()-6);
  setMain(heading('TRAÇABILITÉ','Suivi des vérifications','Filtre les fiches enregistrées et retrouve les anomalies.',button('Exporter CSV','export'))+
    '<section class="panel filters-panel"><div class="period-tabs"><button type="button" class="chip" data-period="shift">Garde en cours</button><button type="button" class="chip" data-period="1">Aujourd’hui</button><button type="button" class="chip" data-period="7">7 jours</button><button type="button" class="chip" data-period="30">30 jours</button></div><form id="monitor-form" class="filter-grid"><label>Du<input type="date" id="date-from" value="'+dateKey(prior)+'" required></label><label>Au<input type="date" id="date-to" value="'+dateKey(now)+'" required></label><button class="primary" type="submit">Actualiser</button></form><div class="filter-grid second"><label>Engin<select id="filter-vehicle"><option value="">Tous les engins</option>'+vehicles.map(v=>'<option value="'+v.id+'"'+(options.vehicle===v.id?' selected':'')+'>'+v.id+'</option>').join('')+'</select></label><label>Résultat<select id="filter-result"><option value="">Tous</option><option value="missing"'+(options.result==='missing'?' selected':'')+'>Avec manquants</option><option value="ok">Sans manquant</option></select></label><label>Rechercher<input type="search" id="filter-text" placeholder="Nom, poste, commentaire…"></label></div></section><div id="monitor-metrics"></div><div id="monitor-results">'+loading()+'</div>');
  let all=[],filtered=[],period=options.period||'7',inFlight=0;
  const filter=()=>{
    if(token!==seq)return;
    const v=$('#filter-vehicle').value,t=$('#filter-text').value.trim().toLocaleLowerCase('fr'),r=$('#filter-result').value;
    filtered=all.filter(x=>(!v||findPost(x)?.vehicle.id===v)&&(!r||(r==='missing')===!!missing(x).length)&&[x.nomDoc,x.verificateur,x.commentaire].join(' ').toLocaleLowerCase('fr').includes(t));
    $('#monitor-metrics').innerHTML='<div class="metrics compact">'+metric('Vérifications',filtered.length,'Selon les filtres')+metric('Sans manquant',filtered.filter(x=>!missing(x).length).length,'Fiches enregistrées','good')+metric('Avec manquants',filtered.filter(x=>missing(x).length).length,'À consulter','danger','warn')+'</div>';
    $('#monitor-results').innerHTML=filtered.length?'<section class="panel"><div class="panel-head"><h2>Résultats</h2>'+badge(filtered.length+' fiches')+'</div><div class="record-list">'+filtered.map((r,i)=>recordRow(r,i)).join('')+'</div></section>':'<div class="empty">Aucune vérification pour ces critères.</div>';
    $('#monitor-results').querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>showRecord(filtered[Number(b.dataset.record)]));
    main.querySelector('[data-action=export]').disabled=!filtered.length;
  };
  async function load(){
    const request=++inFlight;let start,end;
    if(period==='shift')({start,end}=shift(new Date()));else{start=new Date($('#date-from').value+'T00:00:00');end=new Date($('#date-to').value+'T00:00:00');end.setDate(end.getDate()+1);}
    if(isNaN(start)||isNaN(end)||end<=start||end-start>93*86400000){$('#monitor-results').innerHTML=notice('Sélectionne une période valide (92 jours maximum).','error');return;}
    all=[];filtered=[];$('#monitor-metrics').innerHTML='';$('#monitor-results').innerHTML=loading();main.querySelector('[data-action=export]').disabled=true;
    try{const records=await api.records(start,end);if(token!==seq||request!==inFlight)return;all=records;filter();}
    catch(e){if(token===seq&&request===inFlight)fail($('#monitor-results'),e,load);}
  }
  function setPeriod(p){period=p;if(p!=='shift'){const end=new Date(),start=new Date(end);start.setDate(start.getDate()-Number(p)+1);$('#date-from').value=dateKey(start);$('#date-to').value=dateKey(end);}else{const g=shift(new Date());$('#date-from').value=dateKey(g.start);$('#date-to').value=dateKey(new Date(g.end.getTime()-1));}main.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('active',b.dataset.period===p));load();}
  main.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>setPeriod(b.dataset.period));
  $('#monitor-form').onsubmit=e=>{e.preventDefault();period='custom';main.querySelectorAll('[data-period]').forEach(b=>b.classList.remove('active'));load();};
  ['filter-vehicle','filter-result','filter-text'].forEach(id=>$('#'+id).addEventListener('input',()=>{if(all.length||!$('#monitor-results .spinner'))filter();}));
  main.querySelector('[data-action=export]').onclick=()=>{const blob=new Blob([recordsCsv(filtered)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='verifications_'+dateKey(new Date())+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);};
  setPeriod(period);
}
function usersView(token){
  setMain(heading('DROITS ET ACCÈS','Gestion des utilisateurs','Crée les comptes, modifie les rôles et réinitialise les mots de passe.',button('+ Nouvel utilisateur','create','primary'))+
    '<div id="user-metrics"></div><section class="panel"><div class="panel-head"><div><h2>Comptes applicatifs</h2><p>Les mots de passe ne sont jamais affichés dans cette interface.</p></div>'+button('↻ Actualiser','refresh-users')+'</div><div class="filter-grid user-filters"><label>Rechercher<input type="search" id="user-search" placeholder="Identifiant…"></label><label>Rôle<select id="user-role"><option value="">Tous les rôles</option>'+Object.entries(knownRoles).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('')+'</select></label></div><div id="user-list">'+loading()+'</div></section>');
  async function load(){
    if(token!==seq)return;$('#user-list').innerHTML=loading();try{const users=await api.users();if(token!==seq)return;usersCache=users;render();}
    catch(e){if(token===seq)fail($('#user-list'),e,load);}
  }
  function render(){
    const f=$('#user-search').value.trim().toLocaleLowerCase('fr'),r=$('#user-role').value,list=usersCache.filter(u=>(!r||u.role===r)&&u.id.toLocaleLowerCase('fr').includes(f));
    $('#user-metrics').innerHTML='<div class="metrics compact">'+metric('Comptes',usersCache.length,'Tous les utilisateurs','neutral','users')+metric('Administrateurs',usersCache.filter(u=>u.role==='admin').length,'Droits de gestion','neutral','users')+metric('Bureau OPS',usersCache.filter(u=>u.role==='OPS').length,'Gestion opérationnelle','neutral','users')+'</div>';
    $('#user-list').innerHTML=list.length?'<div class="user-list">'+list.map((u,i)=>'<div class="user-row"><div class="user-avatar">'+avatar(u.id)+'</div><div class="user-info"><strong>'+esc(u.id)+'</strong><small>'+(u.id===adminId?'Ton compte · ':'')+'Créé : '+esc(fmt(u.createdAt))+'</small></div>'+badge(knownRoles[u.role]||u.role,u.role==='admin'?'red':'')+'<div class="user-actions"><button class="secondary small-btn" data-edit="'+i+'">Modifier</button><button class="danger small-btn" data-delete="'+i+'" '+(u.id===adminId?'disabled title="Ton propre compte"':'')+'>Supprimer</button></div></div>').join('')+'</div>':'<div class="empty">Aucun utilisateur trouvé.</div>';
    $('#user-list').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>userDialog(list[Number(b.dataset.edit)],load));
    $('#user-list').querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const u=list[Number(b.dataset.delete)];if(!u||u.id===adminId||!confirm('Supprimer définitivement le compte « '+u.id+' » ?'))return;b.disabled=true;try{await api.deleteUser(u.id);toast('Compte supprimé.');await load();}catch(e){toast(e.message,'error');b.disabled=false;}});
  }
  main.querySelector('[data-action=create]').onclick=()=>userDialog(null,load);
  main.querySelector('[data-action=refresh-users]').onclick=load;$('#user-search').oninput=render;$('#user-role').oninput=render;load();
}
function userDialog(user,reload){
  const edit=!!user,self=user?.id===adminId;
  openDialog(edit?'Modifier un utilisateur':'Créer un utilisateur','<form id="user-form"><label>Identifiant<input id="dialog-user" autocomplete="off" maxlength="100" '+(edit?'readonly':'required')+' value="'+esc(user?.id||'')+'" placeholder="Identifiant du compte"></label><label>Rôle<select id="dialog-role" '+(self?'disabled':'')+' required><option value="">Choisir un rôle</option>'+Object.entries(knownRoles).map(([k,v])=>'<option value="'+k+'"'+(user?.role===k?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label><label>'+(edit?'Nouveau mot de passe (facultatif)':'Mot de passe')+'<div class="password-entry"><input type="password" id="dialog-password" autocomplete="new-password" minlength="6" '+(edit?'':'required')+'><button type="button" class="secondary" id="show-password">Afficher</button></div></label><p class="muted">'+(edit?'Laisse le mot de passe vide pour le conserver.':'Six caractères minimum.')+'</p><div id="dialog-error" role="alert"></div><button class="primary" type="submit">'+(edit?'Enregistrer les modifications':'Créer le compte')+'</button></form>');
  $('#show-password').onclick=()=>{const p=$('#dialog-password');p.type=p.type==='password'?'text':'password';$('#show-password').textContent=p.type==='password'?'Afficher':'Masquer';};
  $('#user-form').onsubmit=async e=>{e.preventDefault();if(dialogBusy)return;const id=$('#dialog-user').value.trim(),role=self?'admin':$('#dialog-role').value,pw=$('#dialog-password').value.trim(),btn=e.target.querySelector('[type=submit]');try{assertValidUser(id,pw,role,!edit);}catch(err){$('#dialog-error').innerHTML=notice(err.message,'error');return;}
    dialogBusy=true;btn.disabled=true;btn.textContent='Enregistrement…';try{if(edit)await api.editUser(id,pw,role);else await api.createUser(id,pw,role);dialog.close();toast(edit?'Compte modifié.':'Compte créé.');reload();}
    catch(err){$('#dialog-error').innerHTML=notice(err.message,'error');btn.disabled=false;btn.textContent=edit?'Enregistrer les modifications':'Créer le compte';}finally{dialogBusy=false;}};
}
function fichesView(token,options={}){
  let current=posts.find(p=>p.id===options.post)||null,original=null,sections=[],editing=false,loadId=0;
  setMain(heading('STRUCTURE MATÉRIEL','Fiches de vérification','Sélectionne un engin et un poste, puis consulte ou modifie sa fiche.')+
    '<div class="vehicle-picker">'+vehicles.map(v=>'<button type="button" data-select-vehicle="'+v.id+'" class="vehicle-picker-card">'+photo(v)+'<strong>'+v.id+'</strong><small>'+v.posts.length+' postes</small></button>').join('')+'</div><section class="panel fiche-selection"><div class="panel-head"><div><h2>Choisir un poste</h2><p>Le choix de l’engin filtre les postes disponibles.</p></div></div><div id="post-picker" class="post-picker"></div></section><div id="fiche-editor"><div class="empty">Sélectionne un poste pour afficher sa fiche.</div></div>');
  const target=$('#fiche-editor'),picker=$('#post-picker');
  let selectedVehicle=current?.vehicle.id||vehicles[0].id;
  function selectVehicle(id){if(busy||!leave())return;dirty=false;selectedVehicle=id;current=null;loadId++;target.innerHTML='<div class="empty">Sélectionne un poste pour afficher sa fiche.</div>';renderPicker();}
  function renderPicker(){main.querySelectorAll('[data-select-vehicle]').forEach(b=>b.classList.toggle('active',b.dataset.selectVehicle===selectedVehicle));picker.innerHTML=posts.filter(p=>p.vehicle.id===selectedVehicle).map(p=>'<button class="post-option '+(current?.id===p.id?'active':'')+'" data-post="'+p.id+'"><strong>'+p.role+'</strong><span>'+esc(roles[p.role])+'</span></button>').join('');picker.querySelectorAll('[data-post]').forEach(b=>b.onclick=()=>selectPost(b.dataset.post));}
  async function selectPost(id,force=false){
    if(busy||(!force&&!leave()))return;dirty=false;editing=false;const p=posts.find(p=>p.id===id),r=++loadId;current=p;selectedVehicle=p.vehicle.id;renderPicker();target.innerHTML=loading('Chargement de '+p.nomDoc+'…');
    try{const data=await api.structure(id);if(token!==seq||r!==loadId)return;original=data;sections=draftSections(p,data);renderEditor();}
    catch(e){if(token===seq&&r===loadId)fail(target,e,()=>selectPost(id,true));}
  }
  function renderEditor(){
    if(!current)return;
    const count=sections.reduce((n,s)=>n+s.items.length,0);
    target.innerHTML='<section class="panel editor-top"><div class="panel-head"><div><span class="eyebrow">FICHE '+esc(current.id)+'</span><h2>'+esc(current.nomDoc)+' · '+esc(roles[current.role])+'</h2><p>'+sections.length+' compartiment(s) · '+count+' élément(s)</p></div>'+badge(editing?'Mode modification':'Consultation',editing?'red':'good')+'</div><div class="editor-actions">'+(editing?button('+ Compartiment','add-section','secondary')+button('Annuler','cancel','secondary')+button('Enregistrer la fiche','save','primary'):button(original?'Modifier la fiche':'Créer la fiche','edit','primary')+button('↻ Recharger','reload')+button('Photos de la fiche','photo'))+'</div>'+(editing?notice('Renommer un compartiment ou un matériel change son identifiant historique. Vérifie les photos après enregistrement. Les rappels restent en première position.'):'')+'<div id="editor-feedback"></div></section>'+
      (!sections.length?'<div class="empty">Aucun compartiment. '+(editing?'Ajoute un compartiment pour commencer.':'Clique sur Créer la fiche.')+'</div>':'<div class="sections-editor">'+sections.map((s,i)=>renderSection(s,i)).join('')+'</div>');
    target.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action,b));
    target.querySelectorAll('[data-section-name]').forEach(el=>el.oninput=()=>{sections[Number(el.dataset.sectionName)].name=el.value;changed();});
    target.querySelectorAll('[data-item-name]').forEach(el=>el.oninput=()=>{const [i,j]=el.dataset.itemName.split(':').map(Number);sections[i].items[j].name=el.value;changed();});
    target.querySelectorAll('[data-section-action]').forEach(b=>b.onclick=()=>sectionAction(b));
    target.querySelectorAll('[data-item-action]').forEach(b=>b.onclick=()=>itemAction(b));
  }
  function renderSection(s,i){
    const label=s.originalReminder?'RAPPEL':'COMPARTIMENT '+(i+1);
    return '<section class="panel edit-section"><div class="section-top"><div><span class="eyebrow">'+label+'</span>'+(editing?'<input class="section-input" data-section-name="'+i+'" aria-label="Nom du compartiment" value="'+esc(s.name)+'" placeholder="Nom du compartiment">':'<h3>'+esc(s.name)+'</h3>')+'</div>'+badge(s.items.length+' élément(s)')+'</div>'+
    (editing?'<div class="section-toolbar"><button class="secondary small-btn" data-section-action="up" data-index="'+i+'" '+(s.originalReminder||i===0||sections[i-1]?.originalReminder?'disabled':'')+'>↑ Monter</button><button class="secondary small-btn" data-section-action="down" data-index="'+i+'" '+(s.originalReminder||i===sections.length-1?'disabled':'')+'>↓ Descendre</button><button class="danger small-btn" data-section-action="delete" data-index="'+i+'">Supprimer</button></div>':(!s.originalReminder?'<button class="secondary small-btn photo-link" data-section-action="photo" data-index="'+i+'">▧ Gérer la photo du compartiment</button>':''))+
    '<div class="item-editor">'+s.items.map((it,j)=>editing?'<div class="item-edit-row"><input data-item-name="'+i+':'+j+'" value="'+esc(it.name)+'" aria-label="Matériel '+(j+1)+'" placeholder="Nom du matériel"><div class="item-buttons"><button class="secondary mini" data-item-action="up" data-index="'+i+':'+j+'" '+(j===0?'disabled':'')+' aria-label="Monter">↑</button><button class="secondary mini" data-item-action="down" data-index="'+i+':'+j+'" '+(j===s.items.length-1?'disabled':'')+' aria-label="Descendre">↓</button><button class="danger mini" data-item-action="delete" data-index="'+i+':'+j+'" aria-label="Supprimer">×</button></div></div>':'<div class="item-view-row"><span>'+String(j+1).padStart(2,'0')+'</span><strong>'+esc(it.name)+'</strong></div>').join('')+'</div>'+
    (editing?'<div class="add-item"><input id="add-item-'+i+'" placeholder="Ajouter un matériel…" aria-label="Nouveau matériel"><button type="button" class="secondary" data-section-action="add-item" data-index="'+i+'">+ Ajouter</button></div>':'')+'</section>';
  }
  function changed(){dirty=true;}
  function reRender(){changed();renderEditor();}
  function sectionAction(b){
    const i=Number(b.dataset.index),s=sections[i],a=b.dataset.sectionAction;if(!s)return;
    if(a==='photo'){go('photos',{post:current.id,section:s.name});return;}if(!editing||busy)return;
    if(a==='up'&&i>0&&!sections[i-1].originalReminder&&!s.originalReminder)[sections[i-1],sections[i]]=[sections[i],sections[i-1]];
    else if(a==='down'&&i<sections.length-1&&!s.originalReminder)[sections[i+1],sections[i]]=[sections[i],sections[i+1]];
    else if(a==='delete'){if(!confirm('Retirer le compartiment « '+s.name+' » de la fiche ?'))return;sections.splice(i,1);}
    else if(a==='add-item'){const input=$('#add-item-'+i),n=input.value.trim();if(!n){input.focus();return;}s.items.push({name:n,value:true});}
    else return;reRender();
  }
  function itemAction(b){if(!editing||busy)return;const [i,j]=b.dataset.index.split(':').map(Number),list=sections[i].items,a=b.dataset.itemAction;if(a==='up'&&j>0)[list[j-1],list[j]]=[list[j],list[j-1]];else if(a==='down'&&j<list.length-1)[list[j+1],list[j]]=[list[j],list[j+1]];else if(a==='delete'){if(!confirm('Retirer « '+list[j].name+' » de la fiche ?'))return;list.splice(j,1);}else return;reRender();}
  async function action(a,b){
    if(busy)return;
    if(a==='edit'){editing=true;sections=draftSections(current,original);renderEditor();return;}
    if(a==='cancel'){if(dirty&&!confirm('Abandonner les modifications ?'))return;dirty=false;editing=false;sections=draftSections(current,original);renderEditor();return;}
    if(a==='reload'){selectPost(current.id);return;}
    if(a==='photo'){go('photos',{post:current.id});return;}
    if(a==='add-section'){const name=prompt('Nom du compartiment');if(!name?.trim())return;sections.push({name:name.trim(),originalName:null,originalReminder:false,raw:{},items:[]});reRender();return;}
    if(a==='save'){
      let next;try{for(const s of sections){s.name=s.name.trim();for(const i of s.items)i.name=i.name.trim();}next=buildStructure(current,original,sections);}catch(e){$('#editor-feedback').innerHTML=notice(e.message,'error');$('#editor-feedback').scrollIntoView({block:'center'});return;}
      if(!confirm('Enregistrer les modifications de '+current.nomDoc+' ?'))return;
      busy=true;main.querySelectorAll('button,input').forEach(el=>el.disabled=true);b.textContent='Enregistrement…';
      try{await api.saveStructure(current.id,original,next);original=next;sections=draftSections(current,next);editing=false;dirty=false;toast('Fiche enregistrée.');}
      catch(e){toast(e.message,'error');}
      finally{busy=false;main.querySelectorAll('button,input').forEach(el=>el.disabled=false);renderEditor();}
    }
  }
  main.querySelectorAll('[data-select-vehicle]').forEach(b=>b.onclick=()=>selectVehicle(b.dataset.selectVehicle));renderPicker();if(current)selectPost(current.id,true);
}
function photosView(token,options={}){
  setMain(heading('VISUELS DU CENTRE','Gestion des photos','Change les photos d’accueil, des engins et des compartiments avec aperçu.')+
    '<section class="panel"><div class="panel-head"><div><h2>Modifier un visuel</h2><p>Choisis une destination ; le nom de fichier est généré automatiquement.</p></div></div><div id="photo-admin-mount"></div></section>'+
    '<details class="panel library-panel"><summary>Bibliothèque avancée des images en ligne</summary><p class="muted">Retrouver notamment les images orphelines d’anciennes fiches.</p><div id="library-tools"><button class="secondary" id="load-library">Afficher les fichiers</button></div><div id="library-result"></div></details>');
  $('#photo-admin-mount').classList.add('photo-management');photoController=mountPhotoAdmin($('#photo-admin-mount'),api);
  if(options.post)photoController.selectReference(options.post,options.section);
  let folder='',request=0;
  async function load(){
    if(token!==seq)return;const r=++request;$('#library-result').innerHTML=loading('Chargement des fichiers…');
    try{
      const files=await api.listPhotos(folder);if(token!==seq||r!==request)return;
      $('#library-tools').innerHTML='<button class="secondary" id="library-root">Racine</button><span class="muted">'+esc(folder||'/')+'</span><button class="secondary" id="library-refresh">↻ Actualiser</button>';
      $('#library-root').onclick=()=>{folder='';load();};$('#library-refresh').onclick=load;
      $('#library-result').innerHTML=files.length?'<div class="library-grid">'+files.map((f,i)=>{const dir=!f.id&&!f.metadata,path=folder?folder+'/'+f.name:f.name;return dir?'<button class="library-card" data-folder="'+i+'"><div class="folder-icon">▰</div><strong>'+esc(f.name)+'</strong><small>Dossier</small></button>':'<div class="library-card"><a href="'+esc(publicPhotoUrl(path,Date.now()))+'" target="_blank" rel="noopener"><img src="'+esc(publicPhotoUrl(path,Date.now()))+'" alt=""></a><strong>'+esc(f.name)+'</strong><small>'+esc(path)+'</small><button class="danger small-btn" data-remove="'+i+'">Supprimer</button></div>';}).join('')+'</div>':'<div class="empty">Ce dossier est vide.</div>';
      $('#library-result').querySelectorAll('[data-folder]').forEach(b=>b.onclick=()=>{const f=files[Number(b.dataset.folder)];folder=folder?folder+'/'+f.name:f.name;load();});
      $('#library-result').querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{const f=files[Number(b.dataset.remove)],path=folder?folder+'/'+f.name:f.name;if(!confirm('Supprimer définitivement '+path+' ?'))return;b.disabled=true;try{await api.removePhoto(path);toast('Photo supprimée.');load();}catch(e){toast(e.message,'error');b.disabled=false;}});
    }catch(e){if(token===seq&&r===request)fail($('#library-result'),e,load);}
  }
  $('#load-library').onclick=load;
}
async function init(){
  const id=api.currentUser();
  if(!id||localStorage.getItem('userRole')!=='admin'){location.replace('./index.html?view=office');return;}
  try{adminId=await api.assertAdmin();$('#account-name').textContent=adminId;document.querySelector('.account-icon').textContent=adminId.charAt(0).toUpperCase();document.querySelectorAll('[data-view]').forEach(b=>b.disabled=false);const first=location.hash.slice(1);go(Object.hasOwn(titles,first)?first:'dashboard',{force:true});}
  catch(e){setMain(heading('ACCÈS ADMINISTRATEUR','Connexion indisponible','Vérifie tes identifiants ou ta connexion.')+notice(e.message,'error')+'<a href="./index.html?view=office" class="primary">Retour à la connexion</a>');}
}
init();
