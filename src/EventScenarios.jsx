import React,{useEffect,useState} from 'react';
import {usePreferences} from './Preferences';
import './event-scenarios.scss';

const categories={
 'Banking & Credit':['Credit conditions','Bank lending','Central bank policy'],
 Business:['M&A activity','Earnings outlook','Hiring plans'],
 Consumer:['Consumer demand','Household spending','Consumer confidence'],
 Economy:['Inflation','GDP growth','Labor market'],
 Energy:['Oil supply','Natural gas','Energy prices'],
 Geopolitics:['Conflict risk','Sanctions','Trade disruption'],
 Health:['Drug approvals','Healthcare costs','Public health'],
 Markets:['Equity volatility','Market liquidity','Risk appetite'],
 'Politics & Policy':['Fiscal policy','Regulation','Trade policy'],
 'Real Estate':['Property prices','Mortgage rates','Commercial demand'],
 Science:['Research funding','Clinical progress','Technology adoption'],
 Technology:['AI adoption','Semiconductor supply','Cybersecurity'],
};

const recommendations=[
 {category:'Geopolitics',factor:'Conflict risk',focus:'Vietnam',title:'Conflict and regional risk',detail:'Track developments that could change regional stability.'},
 {category:'Energy',factor:'Oil supply',focus:'Global energy',title:'Oil supply and shipping',detail:'Explore supply routes, energy costs, and disruption risk.'},
 {category:'Economy',factor:'Inflation',focus:'United States',title:'Inflation and rates',detail:'Compare price pressure with central-bank policy.'},
 {category:'Consumer',factor:'Consumer demand',focus:'Global consumer',title:'Consumer demand',detail:'Consider spending, confidence, and demand signals.'},
];

const outcomes=[
 {key:'weakening',label:'WEAKENING / RISK',fallback:'Risk increases',direction:'↓',tone:'red'},
 {key:'mixed',label:'MIXED / UNCHANGED',fallback:'Risk stays elevated/mixed',direction:'→',tone:'amber'},
 {key:'supportive',label:'IMPROVING / SUPPORTIVE',fallback:'Risk eases',direction:'↑',tone:'green'},
];

function outcomeNames(factor){
 const key=factor.toLowerCase();
 if(key.includes('conflict')||key.includes('sanction'))return ['Risk increases','Risk stays elevated/mixed','Risk eases'];
 if(key.includes('inflation'))return ['Inflation accelerates','Inflation stays sticky','Inflation cools'];
 if(key.includes('rate')||key.includes('credit'))return ['Conditions tighten','Conditions stay mixed','Conditions ease'];
 if(key.includes('oil')||key.includes('energy')||key.includes('supply'))return ['Disruption deepens','Supply stays uncertain','Supply conditions improve'];
 if(key.includes('demand')||key.includes('growth'))return ['Demand weakens','Demand stays mixed','Demand improves'];
 return [factor+' worsens',factor+' stays mixed',factor+' improves'];
}

function readStudies(key){
 try{const saved=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(saved)?saved:[]}catch{return []}
}

export default function EventScenarios({storageKey='pasion-event-scenarios'}){
 const {t}=usePreferences();
 const savedKey=storageKey+'-event-research';
 const [category,setCategory]=useState('Geopolitics');
 const [factor,setFactor]=useState('Conflict risk');
 const [focus,setFocus]=useState('Vietnam');
 const [horizon,setHorizon]=useState('30 days');
 const [hasRun,setHasRun]=useState(false);
 const [runAt,setRunAt]=useState(null);
 const [expanded,setExpanded]=useState('');
 const [studies,setStudies]=useState(()=>readStudies(savedKey));
 const [activeHistoryTab,setActiveHistoryTab]=useState('History');
 const [drafts,setDrafts]=useState({});
 const [notice,setNotice]=useState('');

 useEffect(()=>{try{localStorage.setItem(savedKey,JSON.stringify(studies))}catch{}},[savedKey,studies]);

 const names=outcomeNames(factor);
 const filteredFactors=categories[category]||[];
 const visibleStudies=activeHistoryTab==='Saved'?studies.filter(study=>study.saved):studies;

 function editCategory(value){setCategory(value);setFactor(categories[value]?.[0]||'');setHasRun(false);setNotice('')}
 function chooseRecommendation(item){setCategory(item.category);setFactor(item.factor);setFocus(item.focus);setHasRun(false);setNotice('')}
 function runAnalysis(){setHasRun(true);setRunAt(new Date());setExpanded('');setNotice('')}
 function reset(){setCategory('Geopolitics');setFactor('Conflict risk');setFocus('Vietnam');setHorizon('30 days');setHasRun(false);setRunAt(null);setExpanded('');setNotice('')}
 function saveResearch(){
  const entry={id:Date.now(),category,factor,focus:focus.trim(),horizon,createdAt:new Date().toISOString(),saved:true,observed:'unresolved',note:''};
  setStudies(current=>[entry,...current]);
  setNotice('Research saved to this browser.');
 }
 function updateStudy(id){
  const draft=drafts[id]||{};
  setStudies(current=>current.map(study=>study.id===id?{...study,...draft}:study));
  setNotice('Forecast record updated.');
 }
 function toggleSaved(id){setStudies(current=>current.map(study=>study.id===id?{...study,saved:!study.saved}:study))}
 function removeStudy(id){setStudies(current=>current.filter(study=>study.id!==id))}
 function applyDraft(id,key,value){setDrafts(current=>({...current,[id]:{...(current[id]||{}),[key]:value}}))}

 return <div className="analytics-page event-scenarios-page">
  <section className="home-card events-intro-card">
   <div><span className="events-eyebrow">{t('EVENT SCENARIOS · EVIDENCE-LED')}</span><h2>{t('Frame one question. Compare plausible outcomes.')}</h2><p>{t('Choose a category and factor, then inspect evidence-weighted shares, source quality, and key monitoring signals.')}</p></div>
   <aside className="events-research-status"><strong>{t('RESEARCH STATUS')}</strong><span>{t('No live research source is connected. Without source evidence, outcomes remain at an equal baseline.')}</span></aside>
  </section>

  <section className="home-card events-question-card">
   <div className="events-section-kicker">{t('01 · DEFINE EVENT QUESTION')}</div>
   <div className="events-question-grid">
    <label>{t('Investment category')}<select value={category} onChange={event=>editCategory(event.target.value)}>{Object.keys(categories).map(item=><option key={item} value={item}>{t(item)}</option>)}</select></label>
    <label>{t('Specific factor')}<select value={factor} onChange={event=>{setFactor(event.target.value);setHasRun(false)}}>{filteredFactors.map(item=><option key={item} value={item}>{t(item)}</option>)}</select></label>
    <label>{t('Focus / entity (optional)')}<input value={focus} onChange={event=>{setFocus(event.target.value);setHasRun(false)}} placeholder={t('e.g. Vietnam, FPT, banking sector, Asia')}/></label>
    <label>{t('Research horizon')}<select value={horizon} onChange={event=>{setHorizon(event.target.value);setHasRun(false)}}>{['7 days','30 days','90 days','180 days'].map(item=><option key={item} value={item}>{t(item)}</option>)}</select></label>
    <button className="events-run-button" type="button" onClick={runAnalysis}>{t('Run event analysis')}<span aria-hidden="true">→</span></button>
   </div>
   {!hasRun&&<div className="events-recommendations"><div className="events-recommendations-heading"><div><span className="events-section-kicker">{t('START WITH A TOPIC')}</span><h3>{t('Recommended research prompts')}</h3></div><p>{t('Pick a topic to fill the question. You can edit every field before running it.')}</p></div><div className="events-topic-list">{recommendations.map(item=><button type="button" key={item.title} className={category===item.category&&factor===item.factor?'is-selected':''} onClick={()=>chooseRecommendation(item)}><span className="events-topic-text"><small>{t(item.category)}</small><strong>{t(item.title)}</strong><span>{t(item.detail)}</span></span><span aria-hidden="true">↗</span></button>)}</div><p className="events-prompt-note">{t('Prompts are broad starting points, not claims about current events.')}</p></div>}
  </section>

  {hasRun&&<>
   <section className="home-card events-result-card">
    <header className="events-result-heading"><div><span className="events-section-kicker">{t('EVIDENCE-WEIGHTED OUTLOOK · {category} / {factor}',{category:t(category),factor:t(factor)})}</span><h2>{t('No clear leading outcome')}</h2><p>{t('Question: What happens with {factor}? · {focus} · {horizon}',{factor:t(factor.toLowerCase()),focus:focus.trim()||t('All regions'),horizon:t(horizon)})}</p></div><div className="events-result-actions"><div className="events-share-total"><strong>33.3%</strong><span>{t('EACH OUTCOME · BASELINE')}</span></div><button className="events-save-button" type="button" onClick={saveResearch}>☆ {t('Save research')}</button></div></header>
    {notice&&<p className="events-live-notice" role="status">{t(notice)}</p>}
    <div className="events-kpi-grid">
     <article><span>{t('EVIDENCE')}</span><strong>0</strong><small>{t('ranked items')}</small></article>
     <article><span>{t('SOURCES')}</span><strong>0</strong><small>{t('independent groups')}</small></article>
     <article><span>{t('EVIDENCE QUALITY')}</span><strong>—</strong><small>{t('Not scored · no source evidence')}</small></article>
     <article><span>{t('MODEL CONFIDENCE')}</span><strong>{t('Limited')}</strong><small>{t('equal baseline only')}</small></article>
     <article><span>{t('DISTRIBUTION')}</span><strong>100%</strong><small>{t('three outcomes · totals 100%')}</small></article>
    </div>
    <div className="events-outlook-heading"><span className="events-section-kicker">{t('EXPLAINED OUTLOOK')}</span><h3>{t('Why each scenario receives its evidence share')}</h3><p>{t('The shares are relative comparison weights, not calibrated probabilities. With no source evidence, each outcome remains at the equal starting point.')}</p></div>
    <div className="events-outcomes">{outcomes.map((item,index)=><article className={'events-outcome-card tone-'+item.tone} key={item.key}>
      <header><div><span className="events-outcome-label"><b aria-hidden="true">{item.direction}</b>{t(item.label)}</span><h4>{t(names[index])}</h4></div><strong>33.{index===0?'4':'3'}%</strong></header>
      <div className="events-share-bar" aria-label={t('Equal baseline share')}><i style={{width:'33.3%'}}/></div>
      <div className="events-outcome-range"><span>{t('Share range')}</span><strong>{t('Unavailable · no evidence')}</strong></div>
      <p className="events-outcome-explanation"><b>{t('Why this share:')}</b> {t('No source items were returned. This outcome stays at the equal baseline; there are no supporting, mixed, or opposing drivers to inspect.')}</p>
      <div className="events-evidence-counts"><div><strong>0</strong><span>{t('SUPPORTS')}</span><small>{t('items')}</small></div><div><strong>0</strong><span>{t('MIXED')}</span><small>{t('items')}</small></div><div><strong>0</strong><span>{t('OPPOSES')}</span><small>{t('items')}</small></div></div>
      <button type="button" className="events-inspect-button" aria-expanded={expanded===item.key} onClick={()=>setExpanded(expanded===item.key?'':item.key)}><span>{t('Inspect evidence drivers')}</span><b>0</b></button>
      {expanded===item.key&&<div className="events-no-drivers">{t('No evidence drivers were returned for this outcome.')}</div>}
     </article>)}</div>
   </section>

   <div className="events-analysis-grid">
    <section className="home-card events-logic-card"><span className="events-section-kicker">{t('02 · EVIDENCE-SHARE LOGIC')}</span><h3>{t('How the model normalizes the shares to 100%')}</h3><p>{t('Three mutually exclusive outcomes start at equal weights. Source reliability, freshness, relevance, and direction can shift the shares when evidence is available. No sources were returned for this analysis, so no adjustment was made.')}</p><ol>{[['Start equal','Each outcome begins at the same 33.3% baseline.'],['Weight sources','Reliable, recent, relevant sources carry more influence.'],['Read direction','Evidence language is grouped as supportive, mixed, or opposing.'],['Temper uncertainty','Weak evidence pulls estimates toward the equal baseline.']].map(([title,detail],index)=><li key={title}><b>{String(index+1).padStart(2,'0')}</b><span><strong>{t(title)}</strong><small>{t(detail)}</small></span></li>)}</ol><small className="events-method-note">{t('Evidence shares are normalized comparison weights. They are not calibrated outcome probabilities or guarantees.')}</small></section>
    <section className="home-card events-driver-card"><span className="events-section-kicker">{t('03 · TOP-OUTCOME DRIVERS')}</span><h3>{t('No leading outcome')}</h3><div className="events-driver-columns"><div><strong>{t('RAISES OR PRESERVES THIS SHARE')}</strong><p>{t('No aligned evidence returned.')}</p></div><div><strong>{t('PULLS THIS SHARE LOWER')}</strong><p>{t('No counter-signal returned.')}</p></div></div></section>
    <section className="home-card events-movement-card"><span className="events-section-kicker">{t('04 · CHANGE SINCE LAST RUN')}</span><h3>{t('Forecast movement')}</h3><p className="events-first-run">{t('This is the first comparable analysis in this session.')}{runAt&&<small>{t('Run at {time}',{time:runAt.toLocaleString()})}</small>}</p></section>
    <section className="home-card events-monitor-card"><span className="events-section-kicker">{t('05 · WHAT WOULD CHANGE THIS?')}</span><h3>{t('Signals worth monitoring')}</h3><div className="events-monitor-list"><article><b className="is-up">↑</b><div><strong>{t('Confirmation of improving conditions')}</strong><p>{t('Recent primary sources aligned with improvement would raise the supportive share.')}</p></div></article><article><b className="is-down">↓</b><div><strong>{t('Evidence conditions are weakening')}</strong><p>{t('An official release or independent sources could shift weight toward the risk outcome.')}</p></div></article><article><b className="is-neutral">→</b><div><strong>{t('A more balanced signal set')}</strong><p>{t('Conflicting or older reports keep outcomes closer to the equal baseline.')}</p></div></article><article><b className="is-info">i</b><div><strong>{t('More primary evidence')}</strong><p>{t('Original reporting can improve source coverage before outcome weights move.')}</p></div></article></div></section>
   </div>

   <section className="home-card events-integrity-card"><span className="events-section-kicker">{t('06 · RESEARCH INTEGRITY')}</span><h3>{t('Source diversity & quality')}</h3><p>{t('Repeated coverage should be grouped, cached items discounted, and original sources credited for quality.')}</p><div className="events-integrity-metrics"><article className="is-quality"><strong>— <small>/100</small></strong><span>{t('Not scored')}</span></article><article><strong>0</strong><span>{t('live sources')}</span></article><article><strong>0</strong><span>{t('cached')}</span></article><article><strong>0</strong><span>{t('domains')}</span></article><article><strong>0</strong><span>{t('duplicates grouped')}</span></article></div><div className="events-source-types"><span>{t('Primary 0')}</span><span>{t('Academic 0')}</span><span>{t('Publishers 0')}</span><span>{t('Aggregators 0')}</span></div></section>

   <section className="home-card events-evidence-card"><header><div><span className="events-section-kicker">{t('07 · SOURCE EVIDENCE')}</span><h3>{t('Key supporting documents')}</h3></div><span className="events-count-pill">0 {t('surfaced')}</span></header><div className="events-no-evidence">{t('No online evidence returned.')}</div><div className="events-source-notice"><b aria-hidden="true">i</b><p><strong>{t('Live research is not connected')}</strong><span>{t('This workspace has no connected news or research feed. The analysis uses an equal baseline and does not invent source items.')}</span></p></div></section>
  </>}

  <section className="home-card events-forecast-lab"><header className="events-lab-heading"><div><span className="events-section-kicker">{t('FORECAST LAB')}</span><h3>{t('Calibration & track record')}</h3><p>{t('Review saved analyses, record observed outcomes, and keep later results separate from the original shares.')}</p></div><div className="events-history-tabs" role="tablist" aria-label={t('Forecast records')}><button type="button" role="tab" aria-selected={activeHistoryTab==='History'} className={activeHistoryTab==='History'?'is-active':''} onClick={()=>setActiveHistoryTab('History')}>{t('History')}</button><button type="button" role="tab" aria-selected={activeHistoryTab==='Saved'} className={activeHistoryTab==='Saved'?'is-active':''} onClick={()=>setActiveHistoryTab('Saved')}>{t('Saved')} <span>{studies.filter(study=>study.saved).length}</span></button></div></header>
   <div className="events-calibration"><div><h4>{t('Probability calibration')}</h4><p>{t('Recorded outcomes stay separate from the original evidence shares.')}</p></div><div className="events-calibration-note"><span aria-hidden="true">◎</span><div><strong>{studies.some(study=>study.observed&&study.observed!=='unresolved')?t('Observed outcomes are recorded'):t('Calibration begins when outcomes are recorded')}</strong><p>{t('After a research horizon passes, record what happened. The original analysis stays unchanged; a forecast history can then be compared with observed outcomes.')}</p></div></div></div>
   <div className="events-history-heading"><h4>{t(activeHistoryTab==='Saved'?'Saved research':'Forecast history')}</h4><span>{t(visibleStudies.length===1?'1 study':'{count} studies',{count:visibleStudies.length})}</span></div>
   {!visibleStudies.length?<div className="events-history-empty"><strong>{t(activeHistoryTab==='Saved'?'No saved research yet':'No forecast history yet')}</strong><p>{t(activeHistoryTab==='Saved'?'Run an analysis and save it to keep a decision record.':'Run an analysis, then save it to start a track record.')}</p></div>:<div className="events-history-list">{visibleStudies.map(study=>{
    const draft=drafts[study.id]||{};
    const observed=draft.observed??study.observed??'unresolved';
    const note=draft.note??study.note??'';
    const savedNames=outcomeNames(study.factor);
    return <article className="events-history-item" key={study.id}><header><div><span>{t(study.category)} · {t(study.factor)}</span><h4>{t(observed==='unresolved'?'No leading outcome':'Saved evidence-share baseline')}</h4><small>{new Date(study.createdAt).toLocaleString()} · {t(study.horizon)}</small></div><div className="events-history-actions"><strong>33.3%</strong><button type="button" aria-label={t(study.saved?'Remove from saved research':'Save this research')} title={t(study.saved?'Remove from saved research':'Save this research')} onClick={()=>toggleSaved(study.id)}>{study.saved?'★':'☆'}</button><button type="button" aria-label={t('Delete research record')} title={t('Delete research record')} onClick={()=>removeStudy(study.id)}>×</button></div></header><div className="events-history-form"><label>{t('Observed outcome')}<select value={observed} onChange={event=>applyDraft(study.id,'observed',event.target.value)}><option value="unresolved">{t('Not resolved yet')}</option><option value="weakening">{t(savedNames[0])}</option><option value="mixed">{t(savedNames[1])}</option><option value="supportive">{t(savedNames[2])}</option></select></label><label>{t('Research note')}<input value={note} onChange={event=>applyDraft(study.id,'note',event.target.value)} placeholder={t('Add a decision note or follow-up')}/></label><button type="button" onClick={()=>updateStudy(study.id)}>{t('Update')}</button></div></article>
   })}</div>}
  </section>
 </div>;
}
