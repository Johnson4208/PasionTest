import React, {useEffect, useState} from 'react';
import BrandLogo from './BrandLogo';
import Dialog from './Dialog';
import AdminDocuments from './AdminDocuments';
import {usePreferences,PreferenceControls} from './Preferences';

export default function AdminPage({onBack,onExpired}) {
 const {t,language}=usePreferences();
 const [section,setSection]=useState('accounts');
 const [accounts,setAccounts]=useState([]),[query,setQuery]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState(null),[editing,setEditing]=useState(null),[adminEmail,setAdminEmail]=useState('');
 async function api(options){
  const response=await fetch('/api/admin/accounts',options);
  const data=await response.json();
  if(response.status===401||response.status===403){onExpired(data.message);throw new Error(data.message);}
  if(!response.ok)throw new Error(data.message||'Unable to manage accounts.');
  return data;
 }
 async function load(){
  setLoading(true);
  try{const data=await api();setAccounts(data.accounts);}catch(error){setNotice({type:'error',message:error.message});}
  finally{setLoading(false);}
 }
 useEffect(()=>{load();},[]);
 async function action(email,action,extra={}){
  setBusy(true);setNotice(null);
  try{
   const data=await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,action,...extra})});
   setNotice({type:'success',message:data.message});setEditing(null);await load();
  }catch(error){setNotice({type:'error',message:error.message});}
  finally{setBusy(false);}
 }
 const filtered=accounts.filter(account=>(account.email+' '+account.name).toLowerCase().includes(query.toLowerCase()));
 return <main className="admin-page">
  <header className="admin-header"><a className="logo" href="#" aria-label={t("PASION home")} onClick={e=>{e.preventDefault();onBack();}}><BrandLogo/></a><div><PreferenceControls compact/><span>{t("Administrator")}</span><button className="secondary" onClick={onBack}>{t("Back to workspace")}</button></div></header>
  <section className="admin-content">
   <nav className="admin-section-navigation" aria-label={t('Administration sections')}>
    <button type="button" aria-pressed={section==='accounts'} onClick={()=>setSection('accounts')}>{t('Accounts')}</button>
    <button type="button" aria-pressed={section==='documents'} onClick={()=>setSection('documents')}>{t('Document workspace')}</button>
   </nav>
   {section==='documents'?<AdminDocuments onExpired={onExpired}/>:<>
   <div className="admin-title"><div><p className="eyebrow">{t("ADMINISTRATION")}</p><h1>{t("Account management")}</h1><p>{t("View and manage all PASION accounts.")}</p></div><button className="secondary" onClick={load} disabled={busy||loading}>{t("Refresh accounts")}</button></div>
   <div className="admin-stats"><div><strong>{accounts.length}</strong><span>{t("Total accounts")}</span></div><div><strong>{accounts.filter(a=>!a.disabled).length}</strong><span>{t("Active accounts")}</span></div><div><strong>{accounts.filter(a=>a.disabled).length}</strong><span>{t("Disabled accounts")}</span></div></div>
   <section className="admin-add"><h2>{t("Add administrator")}</h2><p className="admin-note">{t("Choose an active account to give it access to account management.")}</p><form onSubmit={e=>{e.preventDefault();const account=accounts.find(a=>a.email===adminEmail);if(account){setNotice(null);setEditing({account,action:'grant-admin'});}}}><div className="field"><label htmlFor="new-admin">{t("Account")}</label><select id="new-admin" value={adminEmail} onChange={e=>setAdminEmail(e.target.value)} required disabled={loading||busy}><option value="">{t("Select an account")}</option>{accounts.filter(a=>!a.isAdmin&&!a.disabled).map(a=><option value={a.email} key={a.email}>{a.name} — {a.email}</option>)}</select></div><button className="primary" disabled={busy||loading||!accounts.some(a=>a.email===adminEmail&&!a.isAdmin&&!a.disabled)}>{t("Add administrator")}</button></form></section>
   <div className="field admin-search"><label htmlFor="account-search">{t("Search accounts")}</label><input id="account-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("Search by name or email")} type="search"/></div>
   {notice&&<p className={'notice '+notice.type} role={notice.type==='error'?'alert':'status'}>{t(notice.message)}</p>}
   <div className="account-table"><table><thead><tr><th>{t("Name / email")}</th><th>{t("Role")}</th><th>{t("Status")}</th><th>{t("Created")}</th><th>{t("Actions")}</th></tr></thead><tbody>
    {loading?<tr><td colSpan="5">{t("Loading accounts…")}</td></tr>:filtered.length===0?<tr><td colSpan="5">{t("No accounts found.")}</td></tr>:filtered.map(account=><tr key={account.email}>
     <td><strong>{account.name}</strong><span className="account-email">{account.email}</span></td><td>{t(account.isOwner?'Owner':account.isAdmin?'Admin':'Member')}</td><td><span className={'status-badge '+(account.disabled?'disabled':'')}>{t(account.disabled?'Disabled':'Active')}</span></td><td>{account.created?new Date(account.created*1000).toLocaleDateString(language,{timeZone:'Asia/Baku'}):'—'}</td>
     <td><div className="account-actions"><button disabled={busy} onClick={()=>setEditing({account,action:'rename'})}>{t("Edit name")}</button>{!account.isOwner&&<>{account.isAdmin&&<button disabled={busy} onClick={()=>{setNotice(null);setEditing({account,action:'revoke-admin'})}}>{t("Remove admin")}</button>}<button disabled={busy} onClick={()=>action(account.email,account.disabled?'enable':'disable')}>{t(account.disabled?'Enable':'Disable')}</button><button disabled={busy} onClick={()=>setEditing({account,action:'reset-password'})}>{t("Reset password")}</button><button disabled={busy} className="danger" onClick={()=>setEditing({account,action:'delete'})}>{t("Delete")}</button></>}</div></td>
    </tr>)}
   </tbody></table></div>
   <p className="admin-note">{t("Administrators can manage accounts and grant admin access. Passwords are never displayed. The owner account cannot be disabled, deleted, or have its admin access removed.")}</p>
   </>}
  </section>
  {editing&&<Dialog title={t(editing.action==='rename'?'Edit name':editing.action==='delete'?'Delete account':editing.action==='grant-admin'?'Add administrator':editing.action==='revoke-admin'?'Remove admin access':'Reset password')} onClose={()=>{if(!busy)setEditing(null)}}><p>{editing.account.email}</p><form onSubmit={e=>{e.preventDefault();const fields=Object.fromEntries(new FormData(e.currentTarget));action(editing.account.email,editing.action,fields);}}>
   {editing.action==='rename'?<div className="field"><label htmlFor="edit-name">{t("Full name")}</label><input autoFocus id="edit-name" name="name" defaultValue={editing.account.name} required maxLength={100} disabled={busy}/></div>:editing.action==='reset-password'?<div className="field"><label htmlFor="reset-password">{t("New password")}</label><input autoFocus id="reset-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={1024} disabled={busy}/><p className="admin-note">{t("At least 8 characters. Existing sessions will be signed out.")}</p></div>:<p>{t(editing.action==='grant-admin'?'This account will be able to manage users and grant administrator access.':editing.action==='revoke-admin'?'This account will become a member and its existing sessions will be signed out.':'This permanently deletes the account and signs it out. This action cannot be undone.')}</p>}
   {notice?.type==='error'&&<p className="notice error" role="alert">{t(notice.message)}</p>}
   <button className={'primary '+(editing.action==='delete'?'delete-confirm':'')} disabled={busy}>{t(busy?'Saving…':editing.action==='delete'?'Delete account':'Save changes')}</button><button className="secondary" type="button" disabled={busy} onClick={()=>setEditing(null)}>{t("Cancel")}</button>
  </form></Dialog>}
 </main>;
}
