const config={apiKey:"AIzaSyD14dNcDQW4SygSlo8YC8bJWisLYOh0Es",authDomain:"veriftav.firebaseapp.com",projectId:"veriftav",storageBucket:"veriftav.firebasestorage.app",messagingSenderId:"401217101102",appId:"1:401217101102:web:dd375734d4f0464c146ebf"};
let firebasePromise, storagePromise;
async function firebase(){
  return firebasePromise ||= Promise.all([
    import('https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js')
  ]).then(([a,f])=>({f,db:f.getFirestore(a.initializeApp(config))})).catch(e=>{firebasePromise=null;throw e;});
}
async function storage(){
  return storagePromise ||= import('https://esm.sh/@supabase/supabase-js@2').then(m=>m.createClient('https://crekdqowqtivflqhhxfc.supabase.co','sb_publishable_556tCAQOJpCdKuBCM2lM7Q_962-59jD').storage.from('photo_verif')).catch(e=>{storagePromise=null;throw e;});
}
export async function structure(id){const {f,db}=await firebase();const s=await f.getDoc(f.doc(db,'FICHEVerif',id));if(!s.exists())throw Error('Fiche absente de la base.');return s.data();}
export async function latest(nomDoc){const {f,db}=await firebase();const s=await f.getDocs(f.query(f.collection(db,'verifications'),f.where('nomDoc','==',nomDoc),f.orderBy('date','desc'),f.limit(1)));return s.empty?null:{id:s.docs[0].id,...s.docs[0].data()};}
export async function records(start,end){const {f,db}=await firebase();const s=await f.getDocs(f.query(f.collection(db,'verifications'),f.where('date','>=',start),f.where('date','<',end),f.orderBy('date','desc')));return s.docs.map(d=>({...d.data(),id:d.id}));}
export async function save(id,data){const {f,db}=await firebase();await f.setDoc(f.doc(db,'verifications',id),data);}
export async function login(username,password){const {f,db}=await firebase();const d=await f.getDoc(f.doc(db,'users',username));if(!d.exists()||d.data().password!==password)throw Error('Identifiants incorrects.');return d.data().role;}
export async function upload(path,blob){const s=await storage();const {error}=await s.upload(path,blob,{contentType:'image/jpeg',upsert:false});if(error&&String(error.statusCode)!=='409')throw Error(error.message);}
export async function photos(folder){const s=await storage();const {data,error}=await s.list(folder,{limit:100});if(error)throw Error(error.message);return data.filter(x=>x.name && x.id).map(x=>s.getPublicUrl(folder+'/'+x.name).data.publicUrl);}
