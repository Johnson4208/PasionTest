import React, {useEffect, useState} from 'react';
import {articles, companies, percent} from './marketData';
import {usePreferences} from './Preferences';
import './company-news.scss';

export const newsLayouts=['Morning Edition','Three-Desk Newsroom','Reading Focus','Signal Timeline','Topic Library'];

const storyImages=['macro','economy','energy','technology'];
const relatedTickers={1:['JPM'],2:['MSFT','AMZN'],3:['XOM'],4:['NVDA','MSFT','AAPL','AMZN','GOOGL']};
const timeInMinutes=value=>{
 const [clock,period='AM']=value.split(' ');
 let [hour,minute]=clock.split(':').map(Number);
 hour%=12;
 if(period==='PM')hour+=12;
 return hour*60+(minute||0);
};

export function Newsroom({variant=0,query='',onArticle,storageKey,watched=[],onCompany,onClearSearch}){
 const {t}=usePreferences();
 const [topic,setTopic]=useState('All');
 const [companyFilter,setCompanyFilter]=useState('All companies');
 const [sortBy,setSortBy]=useState('latest');
 const [saved,setSaved]=useState(()=>{
  try{const value=JSON.parse(localStorage.getItem(storageKey+'-news'));return Array.isArray(value)?value:[]}
  catch{return []}
 });
 const [onlySaved,setOnlySaved]=useState(false);
 const [saveError,setSaveError]=useState('');

 useEffect(()=>{
  try{localStorage.setItem(storageKey+'-news',JSON.stringify(saved));setSaveError('')}
  catch{setSaveError('Bookmarks could not be saved on this browser.')}
 },[saved,storageKey]);

 const topicOptions=['All',...new Set(articles.map(article=>article.category))];
 const allRelatedTickers=[...new Set(Object.values(relatedTickers).flat())];
 const companyOptions=companies.filter(company=>allRelatedTickers.includes(company.ticker));
 const stories=articles
  .filter(article=>(topic==='All'||article.category===topic)
   &&(!onlySaved||saved.includes(article.id))
   &&(companyFilter==='All companies'||relatedTickers[article.id]?.includes(companyFilter))
   &&(`${article.title} ${article.summary} ${article.body}`).toLowerCase().includes(query.toLowerCase()))
  .sort((a,b)=>sortBy==='topic'
   ?a.category.localeCompare(b.category)||timeInMinutes(b.time)-timeInMinutes(a.time)
   :timeInMinutes(b.time)-timeInMinutes(a.time));
 const savedStories=articles.filter(article=>saved.includes(article.id));
 const toggleSaved=article=>setSaved(current=>current.includes(article.id)?current.filter(id=>id!==article.id):[...current,article.id]);
 const clearFilters=()=>{setTopic('All');setCompanyFilter('All companies');setSortBy('latest');setOnlySaved(false);onClearSearch?.()};

 function storyCard(article,index){
  const related=(relatedTickers[article.id]||[]).map(ticker=>companies.find(company=>company.ticker===ticker)).filter(Boolean);
  return <article key={article.id} className={'editorial-card company-news-card '+(index===0?'lead-story':'')}>
   <div className="editorial-image company-news-image" style={{backgroundImage:`url(/news/${storyImages[article.id-1]||'macro'}.jpg)`}}>
    <span className="category-pill">{t(article.category)}</span>
    {index===0&&<span className="company-news-featured">{t("EDITOR'S PICK")}</span>}
    <button type="button" aria-label={t(saved.includes(article.id)?'Unsave {title}':'Save {title}',{title:article.title})} aria-pressed={saved.includes(article.id)} onClick={()=>toggleSaved(article)}>{saved.includes(article.id)?'★':'☆'}</button>
   </div>
   <div className="company-news-story-content">
    <div className="company-news-story-meta"><span>{t(article.category+' briefing')}</span><time>{article.time}</time><span>{t('Sample story')}</span></div>
    <button type="button" className="news-article company-news-open" onClick={()=>onArticle(article)}>
     <h3>{article.title}</h3><p>{article.summary}</p><b>{t('Read briefing')} <span aria-hidden="true">→</span></b>
    </button>
    <div className="company-news-lenses"><span>{t('Companies in context')}</span><div>{related.map(company=><button type="button" key={company.ticker} onClick={()=>onCompany?.(company)} aria-label={t('Explore {ticker}',{ticker:company.ticker})}><strong>{company.ticker}</strong><span className={company.change<0?'is-negative':'is-positive'}>{percent(company.change)}</span></button>)}</div></div>
   </div>
  </article>;
 }

 return <section className={'newsroom newsroom-'+variant+' company-news'}>
  <header className="company-news-masthead">
   <div><span className="eyebrow">{t('COMPANY & MARKET BRIEFINGS')}</span><h2>{t(newsLayouts[variant]||newsLayouts[0])}</h2><p>{t('Follow the stories behind your companies and the markets around them.')}</p></div>
   <div className="company-news-head-actions"><span className="company-news-sample"><i/>{t('Illustrative feed')}</span><button type="button" className="company-news-save-toggle" aria-pressed={onlySaved} onClick={()=>setOnlySaved(value=>!value)}><span aria-hidden="true">☆</span>{t('Saved')} <b>{saved.length}</b></button></div>
  </header>

  <div className="company-news-context" aria-label={t('Newsroom overview')}>
   <div><span>{t('Briefings')}</span><strong>{articles.length}</strong><small>{t('Editorial examples')}</small></div>
   <div><span>{t('Topic desks')}</span><strong>{topicOptions.length-1}</strong><small>{t('Across the sample feed')}</small></div>
   <div><span>{t('Saved by you')}</span><strong>{saved.length}</strong><small>{t('Stored on this browser')}</small></div>
   <div className="company-news-context-note"><span className="company-news-spark" aria-hidden="true">✳</span><p>{t('Stories are illustrative and are not live news.')}</p></div>
  </div>

  <div className="company-news-controls">
   <div className="company-news-topics" role="group" aria-label={t('Filter stories by topic')}>
    {topicOptions.map(option=><button type="button" key={option} aria-pressed={topic===option} onClick={()=>setTopic(option)}>{t(option)}{option==='All'&&<span>{articles.length}</span>}</button>)}
   </div>
   <div className="company-news-filters">
    <label><span>{t('Company')}</span><select aria-label={t('Filter by company')} value={companyFilter} onChange={event=>setCompanyFilter(event.target.value)}><option value="All companies">{t('All companies')}</option>{companyOptions.map(company=><option value={company.ticker} key={company.ticker}>{company.ticker} · {company.name}</option>)}</select></label>
    <label><span>{t('Sort')}</span><select aria-label={t('Sort stories')} value={sortBy} onChange={event=>setSortBy(event.target.value)}><option value="latest">{t('Latest first')}</option><option value="topic">{t('Topic')}</option></select></label>
    <button type="button" className="company-news-clear" onClick={clearFilters}>{t('Clear filters')}</button>
   </div>
  </div>
  {saveError&&<p role="alert" className="company-news-error">{t(saveError)}</p>}
  {variant===4&&<div className="topic-library company-news-topic-library">{topicOptions.filter(option=>option!=='All').map(option=><button type="button" key={option} onClick={()=>{setTopic(option);setOnlySaved(false)}}><strong>{t(option)}</strong><span>{t('{count} briefings →',{count:articles.filter(article=>article.category===option).length})}</span></button>)}</div>}

  <div className="company-news-layout">
   <div className="company-news-main">
    <div className="company-news-feed-heading"><div><span className="eyebrow">{t(onlySaved?'YOUR READING LIST':'THE LATEST')}</span><h3>{t(onlySaved?'Saved stories':'Market desk')}</h3></div><span>{t('{count} stories',{count:stories.length})}</span></div>
    <div className="company-news-story-grid">
     {stories.map(storyCard)}
     {!stories.length&&<div className="home-card empty-state company-news-empty"><span aria-hidden="true">⌕</span><h3>{t('No briefings found')}</h3><p>{t('Try a different topic, company, or search term.')}</p><button type="button" className="dashboard-button secondary-action" onClick={clearFilters}>{t('Clear filters')}</button></div>}
    </div>
   </div>

   <aside className="company-news-sidebar">
    <section className="home-card company-news-watchlist">
     <header><div><span className="eyebrow">{t('YOUR UNIVERSE')}</span><h3>{t('Companies to follow')}</h3></div><span>{watched.length}</span></header>
     {watched.length?watched.slice(0,5).map(company=><button type="button" className="company-news-watch-row" key={company.ticker} onClick={()=>onCompany?.(company)}><span className="company-news-ticker" style={{'--ticker-color':company.color}}>{company.ticker.slice(0,2)}</span><span className="company-news-watch-name"><strong>{company.ticker}</strong><small>{t(company.sector)}</small></span><span className={company.change<0?'is-negative':'is-positive'}>{percent(company.change)}</span><span className="company-news-row-arrow" aria-hidden="true">↗</span></button>):<p className="company-news-empty-copy">{t('Follow companies to see them here.')}</p>}
     <p className="company-news-aside-note">{t('Sample watchlist moves; select a company to open its research.')}</p>
    </section>

    <section className="home-card company-news-reading-list">
     <header><div><span className="eyebrow">{t('PICK UP WHERE YOU LEFT OFF')}</span><h3>{t('Reading list')}</h3></div><span>{savedStories.length}</span></header>
     {savedStories.length?savedStories.map(article=><button type="button" key={article.id} onClick={()=>onArticle(article)}><span className="category-pill">{t(article.category)}</span><strong>{article.title}</strong><small>{t('Saved briefing')} · {article.time}</small></button>):<div className="company-news-empty-copy"><span aria-hidden="true">☆</span><p>{t('Save a briefing to build your reading list.')}</p></div>}
    </section>

    <div className="company-news-disclaimer"><span aria-hidden="true">i</span><p>{t('Sample editorial content only. No live news feed is connected.')}</p></div>
   </aside>
  </div>
 </section>;
}
