import React, {useEffect,useState} from 'react';
import {usePreferences} from './Preferences';

export default function ForgotPassword({onBack,onComplete}){
 const {t}=usePreferences();
 const [email,setEmail]=useState(''),[stage,setStage]=useState('email'),[busy,setBusy]=useState(false),[notice,setNotice]=useState(null),[visible,setVisible]=useState(false),[remaining,setRemaining]=useState(0);
 useEffect(()=>{if(remaining<=0)return;const timer=setTimeout(()=>setRemaining(value=>Math.max(0,value-1)),1000);return()=>clearTimeout(timer);},[remaining]);
 async function request(path,data){
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const result=await response.json();
  if(!response.ok)throw new Error(result.message||'Please try again.');
  return result;
 }
 async function sendCode(event){
  event?.preventDefault();setBusy(true);setNotice(null);
  try{const data=await request('/api/forgot-password',{email:email.trim()});setEmail(email.trim());setStage('code');setRemaining(60);setNotice({type:'success',message:data.message});}
  catch(error){setNotice({type:'error',message:error instanceof TypeError?'Unable to connect. Please try again.':error.message});}
  finally{setBusy(false);}
 }
 async function reset(event){
  event.preventDefault();const fields=Object.fromEntries(new FormData(event.currentTarget));
  if(fields.newPassword!==fields.confirmPassword){setNotice({type:'error',message:'Passwords do not match.'});return;}
  setBusy(true);setNotice(null);
  try{const data=await request('/api/reset-password',{email,...fields});onComplete(data.message);}
  catch(error){setNotice({type:'error',message:error instanceof TypeError?'Unable to connect. Please try again.':error.message});}
  finally{setBusy(false);}
 }
 return <div className="reset-stage" key={stage}>
  <h2>{t('Reset password')}</h2><p className="subtitle">{t(stage==='email'?'Enter your account email to receive a six-digit code.':'Enter the code from your email and choose a new password.')}</p>
  {stage==='email'?<form onSubmit={sendCode}><div className="field"><label htmlFor="reset-email">{t('Email address')}</label><input id="reset-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" maxLength={254} required disabled={busy}/></div>{notice&&<p className={'notice '+notice.type} role="alert">{t(notice.message)}</p>}<button className="primary" disabled={busy}>{t(busy?'Sending…':'Send code')}</button></form>:<form onSubmit={reset}>
   <p className="reset-recipient">{email}<button type="button" disabled={busy} onClick={()=>{setStage('email');setNotice(null)}}>{t('Change email')}</button></p>
   <div className="field"><label htmlFor="reset-code">{t('Six-digit email code')}</label><input id="reset-code" className="code-input" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} placeholder="000000" required disabled={busy}/></div>
   {[['newPassword','New password'],['confirmPassword','Confirm new password']].map(([name,label])=><div className="field" key={name}><label htmlFor={'reset-'+name}>{t(label)}</label><input id={'reset-'+name} name={name} type={visible?'text':'password'} placeholder={t(label)} autoComplete="new-password" minLength={8} maxLength={1024} required disabled={busy}/></div>)}
   <label className="remember"><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/><span>{t('Show passwords')}</span></label>
   {notice&&<p className={'notice '+notice.type} role={notice.type==='error'?'alert':'status'}>{t(notice.message)}</p>}
   <button className="primary" disabled={busy}>{t(busy?'Resetting…':'Reset password')}</button><button className="secondary" type="button" onClick={()=>sendCode()} disabled={busy||remaining>0}>{remaining>0?t('Resend code in {seconds}s',{seconds:remaining}):t('Resend code')}</button><p className="reset-help">{t('Codes expire after 10 minutes.')}</p>
  </form>}
  <button className="secondary" type="button" disabled={busy} onClick={onBack}>{t('Back to sign in')}</button>
 </div>;
}
