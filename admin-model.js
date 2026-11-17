import {posts,vehicles,findPost,missing,asDate,itemId,isReminder,orderedSections,orderedItems,normalize} from './model.js';
export const knownRoles={admin:'Administrateur',OPS:'Bureau OPS',BMM:'Bureau BMM',SAP:'Bureau SAP',Chef:'Chef de centre'};
export function normalizeRole(role){const r=String(role||'').trim();return Object.keys(knownRoles).find(k=>k.toLowerCase()===r.toLowerCase())||r||'Inconnu';}
export function assertValidUser(id,password,role,create){
  if(!id||id.length>100||id.includes('/')||id==='.'||id==='..'||/^__.*__$/.test(id))throw Error('Identifiant invalide (sans barre oblique).');
  if(!Object.hasOwn(knownRoles,role))throw Error('Sélectionne un rôle valide.');
  if((create||password)&&password.length<6)throw Error('Le mot de passe doit contenir au moins 6 caractères.');
}
export function canonical(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(typeof value.toJSON==='function')return canonical(value.toJSON());
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
export function dashboardStats(records){
  const recent=new Map();const sorted=[...records].sort((a,b)=>asDate(b.date)-asDate(a.date));
  for(const r of sorted){const p=findPost(r);if(p&&!recent.has(p.id))recent.set(p.id,r);}
  const anomalies=[...recent.values()].filter(r=>missing(r).length);
  return {verified:recent.size,notDone:posts.length-recent.size,anomalyPosts:anomalies.length,missingCount:anomalies.reduce((n,r)=>n+missing(r).length,0),recent,anomalies,fleet:vehicles.map(v=>{
    const list=posts.filter(p=>p.vehicle.id===v.id).map(p=>({p,r:recent.get(p.id)}));
    return {vehicle:v,total:list.length,done:list.filter(x=>x.r).length,withMissing:list.filter(x=>x.r&&missing(x.r).length).length,list};
  })};
}
export const draftSections=(post,data)=>orderedSections(data||{}).map(s=>({name:s.name,originalName:s.name,originalReminder:isReminder(post,s),raw:s,items:orderedItems(s).map(name=>({name,value:s.items[name]}))}));
export const safeField=n=>typeof n==='string'&&n.trim()===n&&n.length>0&&n.length<=250&&!/^__.*__$/.test(n)&&!['__proto__','constructor','prototype'].includes(n);
export function buildStructure(post,original,sections){
  if(!sections.length)throw Error('La fiche doit contenir au moins un compartiment.');
  const names=new Set(),ids=new Set(),paths=new Set(),firstReminder=sections[0]?.originalReminder===true;
  if(sections.some((s,i)=>s.originalReminder&&i!==0))throw Error('Le rappel doit rester en première position.');
  const base=post.reminderAll&&!firstReminder?2:1,result=Object.fromEntries(Object.entries(original||{}).filter(([,v])=>!v?.items));
  for(const [i,s] of sections.entries()){
    if(!safeField(s.name))throw Error('Nom de compartiment invalide : '+s.name);
    if(names.has(s.name)||Object.hasOwn(result,s.name))throw Error('Compartiment en double : '+s.name);names.add(s.name);
    const folder=normalize(s.name);if(!folder||paths.has(folder))throw Error('Deux compartiments ont le même identifiant de photo : '+s.name);paths.add(folder);
    const order=base+i,isNowReminder=isReminder(post,{name:s.name,order});if(isNowReminder!==!!s.originalReminder)throw Error('Le changement transformerait un compartiment en rappel. Conserve le rappel et sa position.');
    if(!s.items.length)throw Error('Le compartiment « '+s.name+' » est vide.');
    const itemNames=new Set();
    for(const item of s.items){if(!safeField(item.name))throw Error('Nom de matériel invalide : '+item.name);if(itemNames.has(item.name))throw Error('Matériel en double : '+item.name);itemNames.add(item.name);if(!isNowReminder){const id=itemId(s.name,item.name);if(!id||ids.has(id))throw Error('Identifiant de matériel dupliqué : '+item.name);ids.add(id);}}
    const {name:discard,items:oldItems,order:oldOrder,itemOrder:oldItemOrder,...meta}=s.raw||{};
    result[s.name]={...meta,order,items:Object.fromEntries(s.items.map(item=>[item.name,item.value])),itemOrder:s.items.map(item=>item.name)};
  }
  if(!ids.size)throw Error('La fiche doit contenir au moins un matériel à contrôler.');
  const pressureTrigger=data=>post.pressure&&Object.keys(data?.[post.pressure]?.items||{}).some(n=>n.includes(post.role==='CO'?'ARI complet derrière le siège':'ARI complet'));
  if(pressureTrigger(original)&&!pressureTrigger(result))throw Error('La fiche doit conserver le matériel ARI dans le compartiment '+post.pressure+' pour maintenir le contrôle de pression obligatoire.');
  return result;
}
export function csvCell(value){let s=String(value??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function recordsCsv(records){
  const rows=[['Date','Engin / poste','Vérificateur','Manquants','Liste des manquants','Commentaire'],...records.map(r=>[asDate(r.date).toLocaleString('fr-FR'),r.nomDoc||'',r.verificateur||'',missing(r).length,missing(r).map(([k])=>k).join(' | '),r.commentaire||''])];return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
}
