import React,{useState} from 'react';
import BrandLogo from './BrandLogo';
import ProfilePhotoPicker,{Avatar,useProfilePhoto} from './ProfilePhoto';
import {PreferenceControls, usePreferences} from './Preferences';

export default function AccountPage({user,isAdmin,onBack,onAdmin,onLogout,children}){
 const {t}=usePreferences();
 const {photo}=useProfilePhoto(user);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function logout(){setBusy(true);try{await onLogout()}catch{setError('Unable to sign out. Please try again.');setBusy(false)}}
 return <main className="settings-screen">
  <header className="settings-header"><a className="logo" href="#home" onClick={e=>{e.preventDefault();onBack()}} aria-label={t('PASION home')}><BrandLogo/></a><button className="dashboard-button secondary-action" onClick={onBack}>← {t('Back to workspace')}</button></header>
  <div className="settings-intro"><span className="eyebrow">{t('YOUR ACCOUNT')}</span><h1>{t('A space that’s yours.')}</h1><p>{t('Manage your profile and keep your account secure.')}</p></div>
  <div className="settings-layout"><section className="home-card profile-card"><Avatar photo={photo} name={user?.name} className="profile-avatar"/><ProfilePhotoPicker user={user}/><h2>{user?.name||t('Your account')}</h2><p>{user?.email}</p><span className="category-pill">{t(isAdmin?'Administrator':'Member')}</span><dl><div><dt>{t('Account status')}</dt><dd className="positive">{t('Active')}</dd></div><div><dt>{t('Workspace')}</dt><dd>PASION</dd></div><div><dt>{t('Watchlist')}</dt><dd>{t('Saved on this browser')}</dd></div></dl>{isAdmin&&<button className="dashboard-button secondary-action" onClick={onAdmin}>{t('Manage accounts')}</button>}<button className="profile-logout" onClick={logout} disabled={busy}>{t(busy?'Signing out…':'Sign out of your account')}</button>{error&&<p className="notice error" role="alert">{t(error)}</p>}</section>
   <div className="settings-panels"><section className="home-card preference-settings" aria-labelledby="account-preferences-title"><span className="eyebrow">{t('Preferences')}</span><h2 id="account-preferences-title">{t('Make PASION feel like yours.')}</h2><p>{t('Choose your language and appearance.')}</p><PreferenceControls/></section><section className="home-card password-settings" aria-labelledby="account-security-title"><span className="eyebrow">{t('ACCOUNT SECURITY')}</span><h2 id="account-security-title">{t('Change your password')}</h2><p>{t('Choose a strong password with at least eight characters.')}</p>{children}</section></div>
  </div>
 </main>;
}
