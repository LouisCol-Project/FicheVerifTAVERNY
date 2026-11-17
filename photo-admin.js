import {vehicles,roles,posts,orderedSections,isReminder,referencePath,referenceSlots,presentationPhotos,publicPhotoUrl} from './model.js';
import {archivedReferences} from './assets-index.js';

export function mountPhotoAdmin(mount,services){
  mount.innerHTML=`
    <div class="pa-tabs" role="group" aria-label="Type de photo">
      <button type="button" data-mode="presentation" class="active">Présentation</button>
      <button type="button" data-mode="reference">Photos des fiches</button>
    </div>
    <div class="pa-selects" id="pa-presentation"><label>Visuel à modifier<select id="pa-target"></select></label></div>
    <div class="pa-selects" id="pa-reference" hidden>
      <label>Engin<select id="pa-vehicle"></select></label><label>Poste<select id="pa-post"></select></label>
      <label>Compartiment<select id="pa-section"></select></label><label>Photo<select id="pa-slot"></select></label>
    </div>
    <p id="pa-path" class="pa-path"></p>
    <div class="pa-previews">
      <div class="pa-preview"><strong>Photo actuellement utilisée</strong><img id="pa-current" alt="Visuel actuel" hidden><p id="pa-current-note">Choisir un visuel.</p></div>
      <div class="pa-preview"><strong>Nouvelle photo</strong><img id="pa-new" alt="Aperçu de la nouvelle photo" hidden><p id="pa-new-note">Sélectionner un fichier image.</p><label class="pa-file">Choisir une image<input id="pa-file" type="file" accept="image/*"></label></div>
    </div>
    <div class="pa-actions"><button id="pa-save" type="button" class="pa-save" disabled>Enregistrer la nouvelle photo</button><button id="pa-delete" type="button" class="danger" disabled>Supprimer le visuel en ligne</button></div>
    <p id="pa-status" class="pa-status" role="status" aria-live="polite"></p>
    <p class="pa-help">Le chemin est généré automatiquement. Après validation, la photo est remplacée ou créée dans le stockage existant. Les utilisateurs verront le nouveau visuel à la prochaine ouverture ou actualisation.</p>
  `;
  const $=id=>mount.querySelector('#'+id), buttons=[...mount.querySelectorAll('[data-mode]')];
  const fill=(select,entries)=>select.replaceChildren(...entries.map(([value,label])=>new Option(label,value)));
  let mode='presentation',target=null,selectedFile=null,previewUrl=null,loading=false,uploading=false,token=0,previewToken=0,onlinePhoto=false;
  function message(t,type=''){const el=$('pa-status');el.textContent=t;el.className='pa-status '+type;}
  function resetSelection(){selectedFile=null;$('pa-file').value='';if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;$('pa-new').hidden=true;$('pa-new').removeAttribute('src');$('pa-new-note').textContent='Sélectionner un fichier image.';updateControls();}
  function updateControls(){
    const busy=loading||uploading;
    buttons.forEach(b=>b.disabled=uploading);
    mount.querySelectorAll('select').forEach(el=>el.disabled=uploading||(loading&&['pa-section','pa-slot'].includes(el.id)));
    $('pa-save').disabled=busy||!target||!selectedFile;
    $('pa-file').disabled=busy||!target;
    $('pa-delete').disabled=busy||!target||!onlinePhoto;
  }
  function displayTarget(next){
    target=next;onlinePhoto=false;resetSelection();message('');
    const img=$('pa-current'),note=$('pa-current-note'),id=++previewToken;
    img.hidden=true;img.removeAttribute('src');img.onload=null;img.onerror=null;
    $('pa-path').textContent=next?'Emplacement : '+next.path:'Choisir un compartiment.';
    if(!next){note.textContent='Aucun emplacement sélectionné.';updateControls();return;}
    note.textContent='Chargement de la photo…';
    const remote=publicPhotoUrl(next.path,Date.now());let fallback=false;
    img.onload=()=>{if(id!==previewToken)return;img.hidden=false;onlinePhoto=!fallback;note.textContent=fallback?'Photo d’archive locale · aucune photo en ligne accessible.':'Photo en ligne.';updateControls();};
    img.onerror=()=>{if(id!==previewToken)return;if(next.fallback&&!fallback){fallback=true;img.src=next.fallback;}else{img.hidden=true;note.textContent='Aucune photo accessible. Tu peux en ajouter une.';}};
    img.src=remote;updateControls();
  }
  function presentation(){const p=presentationPhotos.find(p=>p.path===$('pa-target').value);displayTarget(p||null);}
  function showRef(){
    const post=posts.find(p=>p.id===$('pa-post').value),section=$('pa-section').value,slot=Number($('pa-slot').value)||1;
    if(!post||!section){displayTarget(null);return;}
    const path=referencePath(post,section,slot),stem=path.slice(0,-4);
    displayTarget({path,label:post.nomDoc+' · '+section+' · photo '+slot,fallback:archivedReferences.has(stem)?'./assets/reference/'+stem+'.webp':null});
  }
  async function fetchSections(){
    const post=posts.find(p=>p.id===$('pa-post').value),seq=++token;
    displayTarget(null);loading=true;fill($('pa-section'),[['','Chargement…']]);updateControls();
    if(!post){loading=false;updateControls();return;}
    fill($('pa-slot'),referenceSlots(post).map(n=>[String(n),'Photo '+n]));
    try{
      const data=await services.structure(post.id);
      if(seq!==token||mode!=='reference')return;
      const sections=orderedSections(data||{}).filter(s=>!isReminder(post,s));
      fill($('pa-section'),[['','Sélectionner un compartiment'],...sections.map(s=>[s.name,s.name])]);
      if(!sections.length)message('Aucun compartiment trouvé dans cette fiche.','error');
    }catch(e){if(seq===token){fill($('pa-section'),[['','Erreur de chargement']]);message('Impossible de charger la fiche : '+(e.message||e),'error');}}
    finally{if(seq===token){loading=false;updateControls();}}
  }
  function selectVehicle(){const v=$('pa-vehicle').value;fill($('pa-post'),posts.filter(p=>p.vehicle.id===v).map(p=>[p.id,roles[p.role]+' · '+p.role]));fetchSections();}
  function selectMode(value){
    if(uploading)return;
    mode=value;token++;loading=false;
    buttons.forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
    $('pa-presentation').hidden=mode!=='presentation';$('pa-reference').hidden=mode!=='reference';
    if(mode==='presentation')presentation();else selectVehicle();
  }
  fill($('pa-target'),presentationPhotos.map(p=>[p.path,p.label]));
  fill($('pa-vehicle'),vehicles.map(v=>[v.id,v.id]));
  buttons.forEach(b=>b.onclick=()=>selectMode(b.dataset.mode));
  $('pa-target').onchange=presentation;$('pa-vehicle').onchange=selectVehicle;$('pa-post').onchange=fetchSections;$('pa-section').onchange=showRef;$('pa-slot').onchange=showRef;
  $('pa-file').onchange=()=>{
    const f=$('pa-file').files[0];if(!f||!target)return;
    if(!f.type.startsWith('image/')&& !/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)){resetSelection();message('Sélectionne un fichier image.','error');return;}
    if(previewUrl)URL.revokeObjectURL(previewUrl);selectedFile=f;previewUrl=URL.createObjectURL(f);
    const img=$('pa-new');img.src=previewUrl;img.hidden=false;$('pa-new-note').textContent=f.name;message('');updateControls();
  };
  $('pa-save').onclick=async()=>{
    if(!target||!selectedFile||uploading)return;
    const dest=target, source=selectedFile;
    if(!confirm('Enregistrer la nouvelle image pour « '+dest.label+' » ? La photo en ligne sera remplacée si elle existe.'))return;
    uploading=true;updateControls();message('Préparation et envoi de la photo…');
    try{
      const blob=await convertImage(source,dest.path);
      await services.replacePhoto(dest.path,blob);
      displayTarget(dest);message('✓ Photo enregistrée. Elle sera visible à la prochaine ouverture des fiches.','success');
    }catch(e){message('Échec : '+(e.message||'Vérifie le fichier et les autorisations du stockage.'),'error');}
    finally{uploading=false;updateControls();}
  };
  $('pa-delete').onclick=async()=>{
    if(!target||uploading||!onlinePhoto)return;
    const dest=target;if(!confirm('Supprimer définitivement la photo en ligne « '+dest.label+' » ?'))return;
    uploading=true;updateControls();message('Suppression…');
    try{await services.removePhoto(dest.path);displayTarget(dest);message('✓ Photo en ligne supprimée. Une éventuelle archive locale reste disponible.','success');}
    catch(e){message('Échec : '+(e.message||e),'error');}
    finally{uploading=false;updateControls();}
  };
  selectMode('presentation');
  return {canLeave:()=>!uploading&&(!selectedFile||confirm('Abandonner la nouvelle photo non enregistrée ?')),hasChanges:()=>uploading||!!selectedFile,dispose:()=>{token++;previewToken++;if(previewUrl)URL.revokeObjectURL(previewUrl);},async selectReference(id,section){
    const p=posts.find(x=>x.id===id);if(!p)return;
    selectMode('reference');$('pa-vehicle').value=p.vehicle.id;fill($('pa-post'),posts.filter(x=>x.vehicle.id===p.vehicle.id).map(x=>[x.id,roles[x.role]+' · '+x.role]));$('pa-post').value=id;
    await fetchSections();if([...$('pa-section').options].some(o=>o.value===section)){$('pa-section').value=section;showRef();}
  }};
}
async function convertImage(file,path){
  let bitmap,url;
  try{
    if(typeof createImageBitmap==='function'){try{bitmap=await createImageBitmap(file);}catch{}}
    if(!bitmap){url=URL.createObjectURL(file);bitmap=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Image illisible : utilise un format JPEG ou PNG.'));im.src=url;});}
    const w=bitmap.naturalWidth||bitmap.width,h=bitmap.naturalHeight||bitmap.height,max=path==='logo.png'?512:1600,scale=Math.min(1,max/Math.max(w,h));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    const ctx=canvas.getContext('2d'),type=path.endsWith('.png')?'image/png':'image/jpeg';
    if(type==='image/jpeg'){ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);}
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Image illisible.')),type,.85));
  }finally{bitmap?.close?.();if(url)URL.revokeObjectURL(url);}
}
