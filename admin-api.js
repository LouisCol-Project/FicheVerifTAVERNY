import {assertValidUser,normalizeRole,canonical} from './admin-model.js';
const config={apiKey:"AIzaSyD14dNcDQW4SygSlo8YC8bJWisLYOh0Es",authDomain:"veriftav.firebaseapp.com",projectId:"veriftav",storageBucket:"veriftav.firebasestorage.app",messagingSenderId:"401217101102",appId:"1:401217101102:web:dd375734d4f0464c146ebf"};
let dbPromise,storagePromise;
async function firebase(){
  return dbPromise ||= Promise.all([import('https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js')]).then(([a,f])=>({f,db:f.getFirestore(a.getApps().length?a.getApp():a.initializeApp(config))})).catch(e=>{dbPromise=null;throw e;});
}
async function storage(){
  return storagePromise ||= import('https://esm.sh/@supabase/supabase-js@2').then(m=>m.createClient('https://crekdqowqtivflqhhxfc.supabase.co','sb_publishable_556tCAQOJpCdKuBCM2lM7Q_962-59jD').storage).catch(e=>{storagePromise=null;throw e;});
}
export function currentUser(){return localStorage.getItem('currentUser')||'';}
export async function assertAdmin(){
  const id=currentUser();if(localStorage.getItem('userRole')!=='admin'||!id)throw Error('Accès administrateur requis.');
  const {f,db}=await firebase(),snap=await f.getDoc(f.doc(db,'users',id));
  if(!snap.exists()||snap.data().role!=='admin')throw Error('Ce compte ne dispose plus des droits administrateur.');
  return id;
}
export async function users(){
  const {f,db}=await firebase(),s=await f.getDocs(f.collection(db,'users'));
  return s.docs.map(d=>({id:d.id,role:normalizeRole(d.data().role),createdAt:d.data().createdAt||null})).sort((a,b)=>a.id.localeCompare(b.id,'fr',{sensitivity:'base'}));
}
async function transactionAdmin(operation){
  const id=currentUser();if(localStorage.getItem('userRole')!=='admin'||!id)throw Error('Accès administrateur requis.');
  const {f,db}=await firebase();
  return f.runTransaction(db,async tx=>{const ownRef=f.doc(db,'users',id),own=await tx.get(ownRef);if(!own.exists()||own.data().role!=='admin')throw Error('Tes droits administrateur ont changé.');return operation({f,db,tx,id,own,ownRef});});
}
export async function createUser(username,password,role){
  assertValidUser(username,password,role,true);
  return transactionAdmin(async ({f,db,tx})=>{
    const ref=f.doc(db,'users',username),snap=await tx.get(ref);if(snap.exists())throw Error('Cet identifiant existe déjà.');
    tx.set(ref,{password,role,createdAt:new Date()});
  });
}
export async function editUser(username,password,role){
  assertValidUser(username,password,role,false);
  return transactionAdmin(async ({f,db,tx,id,own,ownRef})=>{
    const ref=username===id?ownRef:f.doc(db,'users',username),snap=username===id?own:await tx.get(ref);
    if(!snap.exists())throw Error('Cet utilisateur n’existe plus.');
    if(username===id&&role!=='admin')throw Error('Impossible de retirer ton propre accès administrateur.');
    const update={role,updatedAt:new Date()};if(password)update.password=password;tx.update(ref,update);
  });
}
export async function deleteUser(username){
  if(!username||username.includes('/'))throw Error('Identifiant invalide.');
  return transactionAdmin(async ({f,db,tx,id})=>{
    if(username===id)throw Error('Impossible de supprimer ton propre compte.');
    const ref=f.doc(db,'users',username),snap=await tx.get(ref);if(!snap.exists())throw Error('Utilisateur déjà supprimé.');tx.delete(ref);
  });
}
export async function structure(id){const {f,db}=await firebase(),s=await f.getDoc(f.doc(db,'FICHEVerif',id));return s.exists()?s.data():null;}
export async function saveStructure(id,original,next){
  return transactionAdmin(async ({f,db,tx})=>{
    const ref=f.doc(db,'FICHEVerif',id),snap=await tx.get(ref),current=snap.exists()?snap.data():null;
    if(canonical(current)!==canonical(original))throw Error('La fiche a été modifiée ailleurs. Recharge-la avant d’enregistrer.');tx.set(ref,next);
  });
}
export async function records(start,end){
  const {f,db}=await firebase(),q=f.query(f.collection(db,'verifications'),f.where('date','>=',start),f.where('date','<',end),f.orderBy('date','desc'));
  const s=await f.getDocs(q);return s.docs.map(d=>({...d.data(),id:d.id}));
}
export async function replacePhoto(path,blob){
  await assertAdmin();const s=await storage(),{error}=await s.from('Photo_Engins').upload(path,blob,{upsert:true,cacheControl:'60',contentType:blob.type});if(error)throw Error(error.message);
}
export async function removePhoto(path){await assertAdmin();const s=await storage(),{error}=await s.from('Photo_Engins').remove([path]);if(error)throw Error(error.message);}
export async function listPhotos(folder=''){const s=await storage(),{data,error}=await s.from('Photo_Engins').list(folder,{limit:100,sortBy:{column:'name',order:'asc'}});if(error)throw Error(error.message);return data||[];}
export async function verificationPhotos(folder){const s=await storage(),bucket=s.from('photo_verif'),{data,error}=await bucket.list(folder,{limit:100});if(error)throw Error(error.message);return (data||[]).filter(x=>x.name&&x.id).map(x=>bucket.getPublicUrl(folder+'/'+x.name).data.publicUrl);}
