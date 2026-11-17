export const vehicles = [
  { id:'VSSUAP', legacy:'VSAV', title:'Secours à personne', color:'#ad2737', icon:'✚', posts:['CA','CO','EQ'] },
  { id:'FPTGP', legacy:'FPT', title:'Incendie', color:'#be4b24', icon:'♨', posts:['CA','CO','CEBAT','EQBAT','CEBAL','EQBAL'] },
  { id:'CCFM', legacy:'CCF', title:'Feux de forêt', color:'#38735a', icon:'▲', posts:['CA','CO','EQ1','EQ2'] },
  { id:'VSRM', legacy:'VSR', title:'Secours routier', color:'#315d89', icon:'◆', posts:['CA','CO','EQ'] },
  { id:'VTU', legacy:'VTU', title:'Interventions diverses', color:'#685795', icon:'▣', posts:['CA','CO'] }
];
export const roles = {CA:"Chef d’agrès",CO:'Conducteur',EQ:'Équipier',CEBAT:'Chef BAT',EQBAT:'Équipier BAT',CEBAL:'Chef BAL',EQBAL:'Équipier BAL',EQ1:'Équipier 1',EQ2:'Équipier 2'};
export const posts = vehicles.flatMap(v => v.posts.map(role => ({vehicle:v, role, id:role+v.id, nomDoc:role+' '+v.id,
  photos:role==='CO', reminderAll:['CAVSSUAP','COVSSUAP','EQVSSUAP','COCCFM','COVSRM','COVTU'].includes(role+v.id),
  pressure:v.id==='FPTGP' ? (role==='CO'?'CABINE':'CABINE ARRIERE') : null
})));
export const imageRoot = 'https://crekdqowqtivflqhhxfc.supabase.co/storage/v1/object/public/Photo_Engins/';
export const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_').replace(/[^\w_]/g,'');
export const itemId = (s,l) => normalize(s+'_'+l);
export const isReminder = (post,section) => Number(section.order)===1 && (post.reminderAll || section.name.toUpperCase()==='RAPPEL');
export const orderedSections = data => Object.entries(data||{}).filter(([,s])=>s?.items && typeof s.items==='object').map(([name,s])=>({...s,name})).sort((a,b)=>Number(a.order)-Number(b.order));
export const pressureId = post => itemId(post.pressure,"Pression de la bouteille de l'ARI");
export const asDate = d => d?.toDate ? d.toDate() : d?.seconds ? new Date(d.seconds*1000) : new Date(d);
export const dateKey = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
export function shift(d) {
  const start=new Date(d); start.setMinutes(0,0,0);
  if(d.getHours()<8){start.setDate(start.getDate()-1);start.setHours(20);}
  else start.setHours(d.getHours()<20?8:20);
  const end=new Date(start);end.setHours(start.getHours()+12);
  return {start,end,label:start.getHours()===8?'Jour · 08h–20h':'Nuit · 20h–08h',key:dateKey(start)+'-'+start.getHours()};
}
export const missing = record => Object.entries(record?.data||{}).filter(([,v])=>v===false);
export const findPost = record => {const raw=String(record.nomDoc||'').toUpperCase().replace(/\s/g,'').replace('VRSM','VSRM').replace('VSAV','VSSUAP');return posts.find(p=>p.id===raw);};
export function validDraft(d,now=Date.now()){return !!d && Number.isFinite(d.updated) && now>=d.updated && now-d.updated<3600000;}
