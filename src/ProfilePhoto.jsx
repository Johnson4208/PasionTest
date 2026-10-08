import React,{useEffect,useRef,useState} from 'react';
import {usePreferences} from './Preferences';

const photoEvent='pasion-profile-photo';
function readPhoto(key){try{const value=localStorage.getItem(key)||'';return /^data:image\/(webp|png|jpeg);base64,/.test(value)&&value.length<350000?value:''}catch{return ''}}
export function useProfilePhoto(user){
 const key='pasion-profile-photo:'+(user?.email||'demo');
 const [photo,setPhoto]=useState(()=>readPhoto(key));
 useEffect(()=>{
  const sync=()=>setPhoto(readPhoto(key));sync();
  window.addEventListener(photoEvent,sync);window.addEventListener('storage',sync);
  return()=>{window.removeEventListener(photoEvent,sync);window.removeEventListener('storage',sync)};
 },[key]);
 function savePhoto(value){
  if(value)localStorage.setItem(key,value);else localStorage.removeItem(key);
  setPhoto(value);window.dispatchEvent(new Event(photoEvent));
 }
 return {photo,savePhoto};
}

export function Avatar({photo,name,className=''}){
 const {t}=usePreferences();
 const initials=(name||'User').split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase();
 return <span className={'account-avatar '+className}>{photo?<img src={photo} alt={t('Profile photo')} width="256" height="256"/>:initials}</span>;
}

async function resizePhoto(file){
 const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
 const picture=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=source});
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
 const size=Math.min(picture.naturalWidth,picture.naturalHeight);
 const context=canvas.getContext('2d');
 if(!context||!size)throw new Error('Invalid image');
 context.drawImage(picture,(picture.naturalWidth-size)/2,(picture.naturalHeight-size)/2,size,size,0,0,256,256);
 return canvas.toDataURL('image/webp',.9);
}

export default function ProfilePhotoPicker({user}){
 const {t}=usePreferences(),{photo,savePhoto}=useProfilePhoto(user);
 const input=useRef(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(null);
 async function upload(event){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  setNotice(null);
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setNotice({error:true,text:'Choose a JPG, PNG, or WebP image.'});return;}
  if(file.size>5*1024*1024){setNotice({error:true,text:'Choose an image smaller than 5 MB.'});return;}
  setBusy(true);
  try{
   const value=await resizePhoto(file);
   try{savePhoto(value)}catch{setNotice({error:true,text:'Your browser could not save this photo. Please try again.'});return;}
   setNotice({text:'Profile photo updated.'});
  }catch{setNotice({error:true,text:'This image could not be opened. Try another photo.'});}
  finally{setBusy(false);}
 }
 function remove(){try{savePhoto('');setNotice({text:'Profile photo removed.'})}catch{setNotice({error:true,text:'Your browser could not save this photo. Please try again.'})}}
 return <div className="profile-photo-picker">
  <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label={t('Upload profile photo')} onChange={upload} disabled={busy}/>
  <div className="profile-photo-actions"><button type="button" className="dashboard-button secondary-action" disabled={busy} onClick={()=>input.current?.click()}>{t(busy?'Updating photo…':'Change photo')}</button>{photo&&<button type="button" className="profile-photo-remove" disabled={busy} onClick={remove}>{t('Remove photo')}</button>}</div>
  <p className="profile-photo-hint">{t('JPG, PNG, or WebP · Up to 5 MB')}</p>
  {notice&&<p className={'notice '+(notice.error?'error':'success')} role={notice.error?'alert':'status'}>{t(notice.text)}</p>}
 </div>;
}
