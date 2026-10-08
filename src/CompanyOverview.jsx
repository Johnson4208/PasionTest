import React,{useState} from 'react';
import PriceChart from './PriceChart';
import {companies,percent} from './marketData';
import {usePreferences} from './Preferences';

function SearchIcon(){return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></svg>}
function ExpandIcon(){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6"/></svg>}

export default function CompanyOverview({company,watchlist,onToggle,onChoose,tab,onTabChange,period,onPeriodChange,onExpand,expanded=false}){
 const {t}=usePreferences();
 const [query,setQuery]=useState('');
 const matches=companies.filter(item=>(item.ticker+' '+item.name).toLowerCase().includes(query.toLowerCase()));
 const saved=watchlist.includes(company.ticker);
 const metrics=<dl className="company-metrics">
  <div><dt>{t('Market cap')}</dt><dd dir="ltr">{'$'+company.cap}</dd></div>
  <div><dt>{t('P/E ratio')}</dt><dd>{company.pe}</dd></div>
  <div><dt>{t('Sector')}</dt><dd>{t(company.sector)}</dd></div>
  <div><dt>{t('Sample move')}</dt><dd dir="ltr" className={company.change<0?'negative':'positive'}>{percent(company.change)}</dd></div>
 </dl>;
 return <section className={expanded?'company-overview-expanded':'home-card overview-card'} aria-label={t('Company overview')}>
  {!expanded&&<div className="card-heading"><div><span className="eyebrow">{t('COMPANY LENS')}</span><h2><button type="button" className="overview-title" onClick={onExpand}>{t('Company overview')}</button></h2></div><button type="button" className="icon-button overview-expand" aria-label={t('Expand company overview')} title={t('Expand company overview')} onClick={onExpand}><ExpandIcon/></button></div>}
  <div className="company-overview-toolbar"><div className="company-overview-search"><label className="company-search"><SearchIcon/><input value={query} onChange={event=>setQuery(event.target.value)} aria-label={t('Find company for overview')} placeholder={t('Find a company or ticker…')}/></label>
  {query&&<div className="company-results">{matches.map(item=><button type="button" key={item.ticker} onClick={()=>{onChoose(item);setQuery('')}}><strong>{item.ticker}</strong>{item.name}</button>)}{!matches.length&&<p>{t('No matching companies.')}</p>}</div>}</div>
  <div className="company-selected"><span className="company-mark" style={{'--company-color':company.color}}>{company.ticker==='AAPL'?'a':company.ticker==='MSFT'?'▦':company.ticker==='GOOGL'?'G':company.ticker.slice(0,2)}</span><div><strong>{company.ticker}</strong><small>{company.name}</small></div><button type="button" className={'icon-button '+(saved?'saved':'')} aria-label={t(saved?'Remove {ticker} from watchlist from overview':'Add {ticker} to watchlist from overview',{ticker:company.ticker})} title={t(saved?'Remove from watchlist':'Add to watchlist')} onClick={()=>onToggle(company)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={saved?'m5 12 4 4L19 6':'M12 5v14M5 12h14'}/></svg></button></div></div>
  <div className="company-overview-layout"><div className="company-overview-chart"><div className="company-tabs" role="group" aria-label={t('Company overview view')}>{['Summary','Metrics','Full'].map(value=><button type="button" key={value} aria-pressed={tab===value} className={tab===value?'selected':''} onClick={()=>{onTabChange(value);if(value==='Full'&&!expanded)onExpand()}}>{t(value)}</button>)}</div>
   <div className="company-detail">{tab!=='Metrics'&&<p>{t(company.detail)}</p>}{!expanded&&tab!=='Summary'&&metrics}<PriceChart key={company.ticker+'-'+period} company={company} period={period}/><div className="chart-periods" role="group" aria-label={t('Chart period')}>{['1D','1W','1M','1Y'].map(value=><button type="button" key={value} aria-pressed={period===value} className={period===value?'selected':''} onClick={()=>onPeriodChange(value)}>{value}</button>)}</div><span className="sample-caption">{t('Illustrative price history · USD')}</span></div>
  </div>{expanded&&<aside className="company-overview-facts"><span className="eyebrow">{t('COMPANY LENS')}</span><h3>{t('Key metrics')}</h3>{metrics}<div className="company-research-note"><h3>{t('Research perspective')}</h3><p>{t(company.detail)}</p><p>{t('This company profile uses illustrative data. Compare sector trends and valuation figures to build a fuller research picture.')}</p></div></aside>}</div>
 </section>;
}
