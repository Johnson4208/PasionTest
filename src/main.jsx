import React, {useState, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import './staticApi';
import './styles.scss';
import AdminPage from './AdminPage';
import ForgotPassword from './ForgotPassword';
import AnimatedHeight from './AnimatedHeight';
import BrandLogo from './BrandLogo';
import HomePage from './HomePage';
import AccountPage from './AccountPage';
import LandingPage from './LandingPage';
import LoadingScreen from './LoadingScreen';
import {PreferencesProvider, PreferenceControls, usePreferences} from './Preferences';
import './slate-theme.scss';
import './preferences.scss';
function Arrow(){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
function resetWorkspaceScroll(){window.scrollTo({top:0,left:0,behavior:'instant'});}
function ChangePassword({onClose,onExpired}){
 const {t}=usePreferences();
 const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(null);
 async function submit(event){
  event.preventDefault();
  const form=event.currentTarget,fields=Object.fromEntries(new FormData(form));
  if(fields.newPassword!==fields.confirmPassword){setNotice({type:'error',message:'Passwords do not match.'});return;}
  setBusy(true);setNotice(null);
  try{
   const response=await fetch('/api/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)});
   const data=await response.json();
   if(response.status===401){onExpired(data.message);return;}
   if(!response.ok)throw new Error(data.message||'Unable to change your password.');
   form.reset();setVisible(false);setNotice({type:'success',message:data.message});
  }catch(error){setNotice({type:'error',message:error instanceof TypeError?'Unable to connect. Please try again.':error.message});}
  finally{setBusy(false);}
 }
 return <form onSubmit={submit}>
  {[['currentPassword','Current password','current-password'],['newPassword','New password','new-password'],['confirmPassword','Confirm new password','new-password']].map(([name,label,autocomplete])=><div className="field" key={name}><label htmlFor={name}>{t(label)}</label><input id={name} name={name} type={visible?'text':'password'} placeholder={t(label)} autoComplete={autocomplete} minLength={name==='currentPassword'?undefined:8} maxLength={1024} required disabled={busy}/></div>)}
  <label className="remember"><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/><span>{t('Show passwords')}</span></label>
  {notice&&<p className={'notice '+notice.type} role={notice.type==='error'?'alert':'status'}>{t(notice.message)}</p>}
  <button className="primary" disabled={busy}>{t(busy?'Saving…':'Save password')}<Arrow/></button>
  <button className="secondary" type="button" disabled={busy} onClick={onClose}>{t('Back to account')}</button>
 </form>
}
function App(){
 const {t,language}=usePreferences();
 const [tab,setTab]=useState(window.location.hash==='#register'?'register':'signin'),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(null),[signedIn,setSignedIn]=useState(false),[dialog,setDialog]=useState(null);
 const [changingPassword,setChangingPassword]=useState(false);
 const [forgotPassword,setForgotPassword]=useState(false);
 const [accountOpen,setAccountOpen]=useState(false),[user,setUser]=useState(null);
 const [landing,setLanding]=useState(!['#login','#register'].includes(window.location.hash));
 function openAccount(mode){setLanding(false);setTab(mode);setNotice(null);setForgotPassword(false);window.location.hash=mode==='register'?'register':'login';resetWorkspaceScroll();}
 const [loadingSession,setLoadingSession]=useState(true);
 const [isAdmin,setIsAdmin]=useState(false),[adminOpen,setAdminOpen]=useState(window.location.hash==='#admin');
 function openAdmin(){setAccountOpen(false);setAdminOpen(true);window.location.hash='admin';resetWorkspaceScroll();}
 function closeAdmin(){setAdminOpen(false);window.location.hash='';resetWorkspaceScroll();}
 function openSettings(){setAccountOpen(true);resetWorkspaceScroll();}
 function closeSettings(){setAccountOpen(false);setChangingPassword(false);resetWorkspaceScroll();}
 function expired(message){setLanding(false);setSignedIn(false);setIsAdmin(false);setUser(null);setAccountOpen(false);closeAdmin();window.location.hash='login';setChangingPassword(false);setTab('signin');setNotice({type:'error',message});}
 async function logout(){const response=await fetch('/api/logout',{method:'POST'});if(!response.ok)throw new Error('Sign out failed');setSignedIn(false);setIsAdmin(false);setUser(null);setAccountOpen(false);closeAdmin();setLanding(true);setNotice(null);}
 useEffect(()=>{fetch('/api/session').then(r=>r.json()).then(data=>{if(data.authenticated){setSignedIn(true);setIsAdmin(Boolean(data.isAdmin));setUser(data.user);setNotice({type:'success',message:'You are signed in to PASION.'})}}).catch(()=>{}).finally(()=>setLoadingSession(false));},[]);
 useEffect(()=>{function route(){if(signedIn)return;const hash=window.location.hash;if(hash==='#login'||hash==='#register'){setLanding(false);setTab(hash==='#register'?'register':'signin');setForgotPassword(false);}else if(!hash||hash==='#')setLanding(true);}window.addEventListener('hashchange',route);return()=>window.removeEventListener('hashchange',route);},[signedIn]);
 useEffect(()=>{
  if(!signedIn)return;
  let active=true;
  async function refresh(){try{const response=await fetch('/api/session');if(!response.ok)return;const data=await response.json();if(!active)return;if(!data.authenticated)expired('Your session has ended. Please sign in again.');else{setIsAdmin(Boolean(data.isAdmin));setUser(data.user)}}catch{}}
  const interval=setInterval(refresh,60000);window.addEventListener('focus',refresh);
  return()=>{active=false;clearInterval(interval);window.removeEventListener('focus',refresh)};
 },[signedIn]);
 async function submit(e){
  e.preventDefault();setBusy(true);setNotice(null);
  const fields=new FormData(e.currentTarget);if(tab==='register' && fields.get('password')!==fields.get('confirmPassword')){setNotice({type:'error',message:'Passwords do not match.'});setBusy(false);return;}
  try{
   const response=await fetch('/api/'+(tab==='signin'?'login':'register'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(fields))});
   const data=await response.json();if(!response.ok)throw new Error(data.message||'Please try again.');
   setNotice({type:'success',message:data.message});if(tab==='signin'){setSignedIn(true);setIsAdmin(Boolean(data.isAdmin));setUser(data.user);setAccountOpen(false);closeAdmin();}else {setTab('signin');setVisible(false);}
  }catch(error){setNotice({type:'error',message:error instanceof TypeError?'Unable to connect. Please try again.':error.message});}
  finally{setBusy(false)}
 }
 if(loadingSession)return <LoadingScreen/>;
 if(signedIn&&isAdmin&&adminOpen)return <AdminPage onBack={closeAdmin} onExpired={expired}/>;
 if(signedIn&&accountOpen)return <AccountPage user={user} isAdmin={isAdmin} onBack={closeSettings} onAdmin={openAdmin} onLogout={logout}><ChangePassword onClose={closeSettings} onExpired={expired}/></AccountPage>;
 if(signedIn&&!accountOpen)return <HomePage isAdmin={isAdmin} user={user} onAdmin={openAdmin} onAccount={openSettings} onLogout={logout}/>;
 if(!signedIn&&landing)return <LandingPage onLogin={()=>openAccount('signin')} onRegister={()=>openAccount('register')}/>;
 return <main className="login-page">
  <section className="brand-panel" aria-label="PASION"><div className="brand-content">
   <a className="logo" href="/" aria-label={t('PASION home')}><BrandLogo/></a>
   <h1>{t('See the whole picture.')}</h1>
  </div></section>
  <section className="account-panel"><div className="account-content">
   <PreferenceControls compact/>
   <AnimatedHeight view={signedIn?(changingPassword?'change-password':'account'):forgotPassword?'forgot-password':tab}>
   {forgotPassword&&!signedIn?<ForgotPassword onBack={()=>setForgotPassword(false)} onComplete={message=>{setForgotPassword(false);setTab('signin');setNotice({type:'success',message});}}/>:<>
   <h2>{t(signedIn?(changingPassword?'Change password':'Welcome to PASION'):tab==='signin'?'Welcome back':'Register')}</h2>
   {signedIn&&<button className="forgot-link" onClick={()=>{setAccountOpen(false);setChangingPassword(false)}}>← {t('Back to home')}</button>}
   {(signedIn||tab==='register')&&<p className="subtitle">{t(signedIn?(changingPassword?'Choose a new password for your account.':'Your research starts here.'):'Create your PASION account.')}</p>}
   {signedIn?(changingPassword?<ChangePassword onClose={()=>setChangingPassword(false)} onExpired={expired}/>:<div className="signed-in"><p role={notice?.type==='error'?'alert':'status'}>{t(notice?.message)}</p>{isAdmin&&<button className="primary" onClick={openAdmin}>{t('Manage accounts')}<Arrow/></button>}<button className="secondary" onClick={()=>{setChangingPassword(true);setNotice(null)}}>{t('Change password')}</button><button className="primary" onClick={async()=>{try{const response=await fetch('/api/logout',{method:'POST'});if(!response.ok)throw new Error();setSignedIn(false);setIsAdmin(false);closeAdmin();setNotice(null)}catch{setNotice({type:'error',message:'Unable to sign out. Please try again.'})}}}>{t('Sign out')}<Arrow/></button></div>):<>
    <div className="tabs" data-active={tab} aria-label={t('Account action')}>{[['signin','Sign in'],['register','Register']].map(([value,label])=><button key={value} type="button" className={tab===value?'active':''} aria-pressed={tab===value} onClick={()=>{setTab(value);setNotice(null)}}>{t(label)}</button>)}</div>
    <form onSubmit={submit} key={tab}>
     {tab==='register'&&<div className="field"><label htmlFor="name">{t('Full name')}</label><input id="name" name="name" placeholder={t('Your full name')} autoComplete="name" required maxLength={100}/></div>}
     <div className="field"><label htmlFor="email">{t('Email address')}</label><input id="email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required maxLength={254}/></div>
     <div className="field"><label htmlFor="password">{t('Password')}</label><div className="password-input"><input id="password" name="password" type={visible?'text':'password'} placeholder={t('Enter your password')} autoComplete={tab === 'signin' ? 'current-password' : 'new-password'} minLength={tab === 'register' ? 8 : undefined} maxLength={1024} required/><button type="button" onClick={()=>setVisible(!visible)} aria-label={t(visible?'Hide password':'Show password')}>{t(visible?'Hide':'Show')}</button></div></div>
     {tab === 'register' && <div className="field"><label htmlFor="confirmPassword">{t('Confirm password')}</label><input id="confirmPassword" name="confirmPassword" type={visible ? 'text' : 'password'} placeholder={t('Confirm your password')} autoComplete="new-password" required minLength={8} maxLength={1024} /></div>}{tab === 'signin' && <label className="remember"><input type="checkbox" name="remember" value="true"/><span>{t('Keep me signed in for 7 days')}</span></label>}
     {notice&&<p className={'notice '+notice.type} role={notice.type==='error'?'alert':'status'}>{t(notice.message)}</p>}
     <button className="primary" type="submit" disabled={busy}>{t(busy?'Please wait…':tab==='signin'?'Sign in securely':'Register')}<Arrow/></button>
    </form>
    {tab==='signin'&&<button className="forgot-link" type="button" onClick={()=>{setForgotPassword(true);setNotice(null)}}>{t('Forgot password?')}</button>}
    <p className="account-note">{t(tab==='signin'?'Welcome to PASION. Sign in to see the whole picture.':'Create an account to get started with PASION.')}</p>
   </>}
   </>}
   </AnimatedHeight>
  </div><footer><nav aria-label={t('Legal and support')}>{['Privacy','Terms','Support'].map(item=><button key={item} onClick={()=>setDialog(item)}>{t(item)}</button>)}</nav><span>© {new Intl.DateTimeFormat(language,{timeZone:'Asia/Baku',year:'numeric'}).format(new Date())} PASION</span></footer></section>
  {dialog&&<div className="modal-backdrop" onClick={()=>setDialog(null)} onKeyDown={e=>{if(e.key==='Escape')setDialog(null)}}><section className="modal" role="dialog" aria-modal="true" aria-label={t(dialog)} onClick={e=>e.stopPropagation()}><h2>{t(dialog)}</h2><p>{t(dialog==='Support'?'Contact your organization’s PASION administrator for account access and sign-in assistance.':dialog==='Privacy'?'This demonstration sends form data to your local Python server. Registered accounts are stored locally with hashed passwords. Do not enter real account credentials.':'This is a demonstration of the PASION sign-in experience. Production access and terms must be provided by your organization.')}</p><button className="primary" autoFocus onClick={()=>setDialog(null)}>{t('Close')}</button></section></div>}
 </main>
}
createRoot(document.getElementById('root')).render(<PreferencesProvider><App/></PreferencesProvider>);
