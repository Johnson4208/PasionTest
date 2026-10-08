import React from 'react';
import Dialog from './Dialog';
import {usePreferences} from './Preferences';
import './plans.scss';

function PlanIcon({pro=false}) {
 return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
  {pro?<><path d="m5 10 5 5 6-9 6 9 5-5-3 15H8L5 10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M9 29h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></>:<><circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.7"/><path d="m21 11-3 7-7 3 3-7 7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></>}
 </svg>;
}

function CheckIcon({planned=false}) {
 return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
  {planned?<><circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10 6.5V10l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>:<path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>}
 </svg>;
}

export default function PlansDialog({onClose}) {
 const {t}=usePreferences();
 const explorerFeatures=['Company research','Saved portfolios','News bookmarks','Sample price alerts'];
 const proFeatures=['Live market connections','Deeper evidence','Connected alerts'];
 return <Dialog title={t('PASION workspace plans')} fullScreen className="plans-dialog" onClose={onClose}>
  <div className="plans-content">
   <div className="plans-intro">
    <h3>{t('Your next chapter starts here.')}</h3>
    <p>{t('A clear view of what you can use today and what is coming next.')}</p>
   </div>
   <div className="workspace-plan-grid">
    <article className="workspace-plan explorer-plan" aria-labelledby="explorer-plan-title">
     <div className="workspace-plan-heading"><span className="workspace-plan-icon"><PlanIcon/></span><span className="workspace-plan-badge"><CheckIcon/>{t('Current workspace')}</span></div>
     <span className="workspace-plan-eyebrow">{t('Available today')}</span>
     <h3 id="explorer-plan-title">{t('Explorer')}</h3>
     <strong className="workspace-plan-price">{t('Free')}</strong>
     <p className="workspace-plan-description">{t('Everything you need to explore the workspace at your own pace.')}</p>
     <ul>{explorerFeatures.map(feature=><li key={feature}><CheckIcon/><span>{t(feature)}</span></li>)}</ul>
     <button className="dashboard-button workspace-plan-action" onClick={onClose}>{t('Explore workspace')}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
    </article>
    <article className="workspace-plan pro-plan" aria-labelledby="pro-plan-title">
     <div className="workspace-plan-heading"><span className="workspace-plan-icon"><PlanIcon pro/></span><span className="workspace-plan-badge">{t('Preview only')}</span></div>
     <span className="workspace-plan-eyebrow">{t('On the roadmap')}</span>
     <h3 id="pro-plan-title">{t('PASION Pro')}</h3>
     <strong className="workspace-plan-price">{t('Coming soon')}</strong>
     <p className="workspace-plan-description">{t('More connected tools for your investment research.')}</p>
     <ul>{proFeatures.map(feature=><li key={feature}><CheckIcon planned/><span>{t(feature)}</span></li>)}</ul>
     <div className="workspace-plan-unavailable">{t('Paid subscriptions are not available yet.')}</div>
    </article>
   </div>
   <p className="plans-roadmap-note">{t('Your Explorer workspace remains free. We will share availability when PASION Pro is ready.')}</p>
  </div>
 </Dialog>;
}
