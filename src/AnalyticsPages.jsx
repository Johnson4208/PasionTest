import React,{useId,useState} from 'react';
import {companies,chartValues,money,percent} from './marketData';
import {movingAverage,rsi,tradeSizing,downloadCSV} from './analytics';
import {companyOverviewIndicators} from './companyOverviewIndicators';
import PriceChart from './PriceChart';
import EventScenarios from './EventScenarios.jsx';
import Dialog from './Dialog';
import {usePreferences} from './Preferences';
import './analytics.scss';
import './stock-analytics.scss';
import './indicators-vsa.scss';
import './trade-planner.scss';

export const analyticsPages=['Compare','Stock','Indicators','Trade','Events','Sources'];
function SymbolSelect({company,onChange}){const {t}=usePreferences();const id=useId();return <div className="tool-field"><label htmlFor={id}>{t("Company")}</label><select id={id} value={company.ticker} onChange={e=>onChange(companies.find(c=>c.ticker===e.target.value))}>{companies.map(c=><option key={c.ticker} value={c.ticker}>{c.ticker} — {c.name}</option>)}</select></div>}
function Stat({label,value,note,tone=''}){const {t}=usePreferences();return <div className="analytics-stat"><span>{t(label)}</span><strong className={tone}>{typeof value==='string'?t(value):value}</strong>{note&&<small>{t(note)}</small>}</div>}
function SectionHeader({eyebrow,title,children}){const {t}=usePreferences();return <div className="tool-heading"><div><span className="eyebrow">{t(eyebrow)}</span><h2>{t(title)}</h2></div>{children}</div>}
export function CompareCompanies({query,onResearch}){
 const {t}=usePreferences();
 const [tickers,setTickers]=useState(['AAPL','MSFT','NVDA']),[metric,setMetric]=useState('change');
 const selected=companies.filter(c=>tickers.includes(c.ticker));
 const metrics=[['Sample price',c=>money(c.price)],['Session change',c=>percent(c.change)],['Market cap',c=>'$'+c.cap],['P/E ratio',c=>c.pe],['Sector',c=>c.sector]];
 function toggle(ticker){setTickers(list=>list.includes(ticker)?list.filter(t=>t!==ticker):list.length<4?[...list,ticker]:list)}
 return <div className="analytics-page"><section className="home-card"><SectionHeader eyebrow="SIDE BY SIDE" title="Different companies. One clear view."><span className="small-tag">{t("UP TO 4 COMPANIES")}</span></SectionHeader><div className="compare-picker" role="group" aria-label={t('Companies to compare')}>{companies.filter(c=>(c.ticker+' '+c.name).toLowerCase().includes(query.toLowerCase())).map(c=><button key={c.ticker} aria-pressed={tickers.includes(c.ticker)} disabled={!tickers.includes(c.ticker)&&tickers.length>=4} onClick={()=>toggle(c.ticker)}><span style={{background:c.color}}/>{c.ticker}{tickers.includes(c.ticker)&&' ✓'}</button>)}</div><div className="analytics-table-scroll"><table className="comparison-table"><thead><tr><th>{t("Metric")}</th>{selected.map(c=><th key={c.ticker}><button onClick={()=>onResearch(c)}>{c.ticker}<small>{c.name}</small></button></th>)}</tr></thead><tbody>{metrics.map(([label,fn])=><tr key={label}><th>{t(label)}</th>{selected.map(c=><td key={c.ticker}>{t(fn(c))}</td>)}</tr>)}</tbody></table></div>{!selected.length&&<p className="tool-note">{t("Choose companies to begin your comparison.")}</p>}<button className="dashboard-button secondary-action" disabled={!selected.length} onClick={()=>downloadCSV('pasion-company-comparison-sample.csv',[['Metric',...selected.map(c=>c.ticker)],...metrics.map(([label,fn])=>[label,...selected.map(fn)])])}>{t("Export comparison")}</button></section><section className="home-card"><SectionHeader eyebrow="COMPARE THE SIGNALS" title="Relative perspective"><label className="tool-field">{t("Comparison metric")}<select value={metric} onChange={e=>setMetric(e.target.value)}><option value="change">{t("Session change (%)")}</option><option value="pe">{t("P/E ratio")}</option></select></label></SectionHeader><div className="comparison-bars">{selected.map(c=>{const value=Number(c[metric]),max=Math.max(1,...selected.map(x=>Math.abs(Number(x[metric]))));return <div key={c.ticker}><strong>{c.ticker}</strong><span><i style={{width:Math.abs(value)/max*100+'%',background:value<0?'#e57888':c.color}}/></span><b>{metric==='change'?percent(value):value}</b></div>})}</div><p className="tool-note">{t("Compare like-for-like sectors and valuation measures. All values are illustrative.")}</p></section></div>
}
function StockMetricCard({id,group,extra,query,category='all',t}){
 if(!group)return null;
 const matches=row=>!query||(row.label+' '+row.value+' '+row.evidence).toLowerCase().includes(query.trim().toLowerCase());
 const groupRows=(category==='all'||category===group.name)?group.rows.filter(matches):[];
 const extraRows=extra&&(category==='all'||category===extra.name)?extra.rows.filter(matches):[];
 if(!groupRows.length&&!extraRows.length)return null;
 const renderRows=rows=>rows.map(row=><div className="stock-metric-row" id={row.label==='Price'?'stock-metrics-price':undefined} key={row.label} title={row.evidence}>
  <span>{t(row.label)}</span><strong dir="ltr">{row.value}</strong>
  <small className={'stock-evidence evidence-'+row.evidence.toLowerCase().replaceAll(' ','-')}>{t(row.evidence)}</small>
 </div>);
 return <section className="stock-metric-card" id={id}>
  {groupRows.length>0&&<header><span className="stock-metric-icon" aria-hidden="true">{group.name==='Income statement & growth'?'01':group.name==='Capital & efficiency'?'02':group.name==='Cash flow & reinvestment'?'03':group.name==='Valuation & market'?'04':'05'}</span><h3>{t(group.name)}</h3></header>}
  {groupRows.length>0&&<div className="stock-metric-list">{renderRows(groupRows)}</div>}
  {extra&&extraRows.length>0&&<section className="stock-metric-extra" id="stock-metrics-shareholders"><h4>{t(extra.name)}</h4><div className="stock-metric-list">{renderRows(extraRows)}</div></section>}
 </section>;
}

function readStockFavorite(storageKey){try{return localStorage.getItem(storageKey+'-favorite-FPT')==='true'}catch{return false}}
export function StockAnalytics({storageKey}){
 const {t}=usePreferences();
 const [activeTab,setActiveTab]=useState('Financials');
 const [activeHorizon,setActiveHorizon]=useState('1 month');
 const [quotePeriod,setQuotePeriod]=useState('1M');
 const [fptFavorite,setFptFavorite]=useState(()=>readStockFavorite(storageKey));
 const [metricQuery,setMetricQuery]=useState('');
 const [metricCategory,setMetricCategory]=useState('all');
 const byName=Object.fromEntries(companyOverviewIndicators.map(group=>[group.name,group]));
 const navTabs=[
  {label:'Financials',target:'stock-metrics-income'},
  {label:'Valuation',target:'stock-metrics-valuation'},
  {label:'Market',target:'stock-metrics-price'},
  {label:'Shareholder Returns',target:'stock-metrics-shareholders'},
  {label:'Evidence & Coverage',target:'stock-metrics-evidence'},
 ];
 const horizons=[
  {label:'1 week',value:'42.8% up',days:'5 trading days',fill:'58%'},
  {label:'1 month',value:'55.8% up',days:'21 trading days',fill:'66%'},
  {label:'3 months',value:'30.9% up',days:'63 trading days',fill:'42%'},
  {label:'12 months',value:'Uncertain',days:'252 trading days',fill:'0%'},
 ];
 const factors=[
  ['Market trend','Bullish','up'],
  ['Technical signal','Positive','up'],
  ['Support / Resistance','Near support','flat'],
  ['Volume','Increasing','up'],
  ['Momentum','Mixed','flat'],
 ];
 const fptChart={ticker:'FPT',price:62100,change:1.97,index:4};
 const valuation=byName['Valuation & market'];
 const shareholders=byName['Shareholder returns'];
 const overviewGroups=[
  {id:'stock-metrics-income',group:byName['Income statement & growth']},
  {id:'stock-metrics-capital',group:byName['Capital & efficiency']},
  {id:'stock-metrics-cash',group:byName['Cash flow & reinvestment']},
  {id:'stock-metrics-valuation',group:valuation,extra:shareholders},
  {id:'stock-metrics-evidence',group:byName['Evidence & coverage']},
 ];
 const matchesMetric=row=>!metricQuery||(row.label+' '+row.value+' '+row.evidence).toLowerCase().includes(metricQuery.trim().toLowerCase());
 const visibleGroups=overviewGroups.filter(item=>metricCategory==='all'||item.group.name===metricCategory||item.extra?.name===metricCategory);
 const visibleMetricCount=visibleGroups.reduce((count,item)=>count+((metricCategory==='all'||metricCategory===item.group.name)?item.group.rows.filter(matchesMetric).length:0)+(item.extra&&(metricCategory==='all'||metricCategory===item.extra.name)?item.extra.rows.filter(matchesMetric).length:0),0);
 const totalMetricCount=companyOverviewIndicators.reduce((count,group)=>count+group.rows.length,0);
 function exportVisibleMetrics(){
  const rows=visibleGroups.flatMap(item=>[
   ...((metricCategory==='all'||metricCategory===item.group.name)?item.group.rows.filter(matchesMetric).map(row=>[item.group.name,row.label,row.value,row.evidence]):[]),
   ...(item.extra&&(metricCategory==='all'||metricCategory===item.extra.name)?item.extra.rows.filter(matchesMetric).map(row=>[item.extra.name,row.label,row.value,row.evidence]):[]),
  ]);
  downloadCSV('fpt-company-indicators.csv',[['Category','Indicator','Value','Evidence'],...rows]);
 }
 function jumpTo(tab){
  setMetricQuery('');
  setMetricCategory('all');
  setActiveTab(tab.label);
  requestAnimationFrame(()=>document.getElementById(tab.target)?.scrollIntoView({behavior:'smooth',block:'center'}));
 }
 return <div className="analytics-page stock-analytics">
  <header className="stock-analytics-heading">
   <div><span className="eyebrow">{t('MARKET CONTEXT')}</span><h2>{t('Stock analytics')}</h2><p>{t('Review market direction, technical context, and historical trading evidence.')}</p></div>
   <span className="stock-workspace-pill"><i/>{t('Local research workspace')}</span>
  </header>

  <section className="stock-company-summary">
   <div className="stock-company-overview">
    <div className="stock-company-identity"><span className="stock-company-mark">FPT</span><div><h3>FPT Corporation</h3><div className="stock-company-tags"><span>FPT</span><span>VN</span><button type="button" aria-pressed={fptFavorite} aria-label={t(fptFavorite?'Remove FPT from favorites':'Add FPT to favorites')} onClick={()=>setFptFavorite(value=>{const next=!value;try{localStorage.setItem(storageKey+'-favorite-FPT',String(next))}catch{}return next})}>{fptFavorite?'★':'☆'}</button></div><p>Information Technology <i/> Vietnam</p></div></div>
    <div className="stock-company-last-price"><div><strong dir="ltr">62,100</strong><span>VND</span></div><p><b>↑ 1,200 (+1.97%)</b><span>{t('Market data')}</span></p><small>{t('CLOSED')}</small></div>
    <div className="stock-company-sparkline"><PriceChart compact company={fptChart} period={quotePeriod}/><div className="stock-spark-periods" role="group" aria-label={t('Chart period')}>{['1D','1W','1M','1Y'].map(period=><button type="button" key={period} aria-pressed={quotePeriod===period} onClick={()=>setQuotePeriod(period)}>{period}</button>)}</div></div>
    <div className="stock-company-stat"><span>{t('Market Cap')}</span><strong>116.37T VND</strong></div>
    <div className="stock-company-stat"><span>{t('P/E (trailing)')}</span><strong>12.27×</strong></div>
    <div className="stock-company-stat"><span>{t('P/B')}</span><strong>2.65×</strong></div>
    <div className="stock-company-stat"><span>{t('Dividend Yield')}</span><strong>2.9%</strong></div>
   </div>
   <nav className="stock-analytics-tabs" aria-label={t('Company analytics sections')}>
    {navTabs.map(tab=><button type="button" key={tab.label} aria-pressed={activeTab===tab.label} className={activeTab===tab.label?'is-active':''} onClick={()=>jumpTo(tab)}>{t(tab.label)}</button>)}
   </nav>
  </section>

  <section className="stock-prediction-panel">
   <header className="stock-panel-heading"><div><span className="stock-section-index">01</span><h2>{t('Stock prediction analysis')}</h2></div><p>{t('Illustrative model snapshot · not a live forecast.')}</p></header>
   <div className="stock-prediction-layout">
    <div className="stock-prediction-primary">
     <div className="stock-prediction-stats">
      <article><span>{t('Up probability')}</span><strong>55.8% <b className="stock-up">↑</b></strong><small>{t('1 month')}</small></article>
      <article><span>{t('Down probability')}</span><strong>30.9% <b className="stock-down">↓</b></strong><small>{t('1 month')}</small></article>
      <article><span>{t('Brier skill')}</span><strong>4.4%</strong><small>{t('vs historical base rate')}</small></article>
      <article><span>{t('Model confidence')} <em>{t('Moderate')}</em></span><div className="stock-confidence-meter" role="meter" aria-label={t('Model confidence')} aria-valuemin="0" aria-valuemax="100" aria-valuenow="44" aria-valuetext={t('Moderate')}><i/></div><small>{t('Based on 135 sample outcomes')}</small></article>
     </div>
     <div className="stock-horizon-heading"><h3>{t('Multi-horizon outlook')}</h3></div>
     <div className="stock-horizons">
      {horizons.map(horizon=><button type="button" key={horizon.label} aria-pressed={activeHorizon===horizon.label} className={activeHorizon===horizon.label?'is-active':''} onClick={()=>setActiveHorizon(horizon.label)}><span>{t(horizon.label)}</span><small>({t(horizon.days)})</small><strong>{t(horizon.value)}</strong><i><b style={{width:horizon.fill}}/></i></button>)}
     </div>
    </div>
    <aside className="stock-key-factors"><h3><span aria-hidden="true">↗</span>{t('Key factors')}</h3>{factors.map(([name,value,tone])=><div key={name}><span className="stock-factor-dot"/><span>{t(name)}</span><b className={'factor-'+tone}>{tone==='up'?'↑':tone==='down'?'↓':'↕'}</b><strong className={'factor-'+tone}>{t(value)}</strong></div>)}</aside>
   </div>
  </section>

  <section className="stock-overview-panel">
   <header className="stock-overview-heading"><div><h2>{t('Company overview')} <span>·</span> {t('Key indices')}</h2><p>{t('Supplied FPT snapshot · VND values and evidence labels')}</p></div><button type="button" className="stock-export-button" disabled={!visibleMetricCount} onClick={exportVisibleMetrics}>{t('Export visible metrics')}</button></header>
   <div className="stock-metric-toolbar"><label className="stock-metric-search"><span>{t('Search indicators')}</span><input type="search" value={metricQuery} onChange={event=>setMetricQuery(event.target.value)} placeholder={t('Try “revenue”, “debt”, or “yield”')} /></label><label className="stock-category-select"><span>{t('Category')}</span><select value={metricCategory} onChange={event=>setMetricCategory(event.target.value)}><option value="all">{t('All categories')}</option>{companyOverviewIndicators.map(group=><option value={group.name} key={group.name}>{t(group.name)}</option>)}</select></label><p aria-live="polite">{t('Showing {visible} of {total} indicators',{visible:visibleMetricCount,total:totalMetricCount})}</p></div>
   <div className="stock-indicator-grid">{visibleGroups.map(item=><StockMetricCard key={item.id} {...item} query={metricQuery} category={metricCategory} t={t}/>)}</div>
   {!visibleMetricCount&&<p className="stock-metric-empty">{t('No indicators match your search. Try a different term or category.')}</p>}
  </section>
 </div>;
}
const VSA_EVENTS=[
 {code:'PS',name:'Preliminary Support',state:'Detected',tone:'green',at:.06,top:74},
 {code:'SC',name:'Selling Climax',state:'Detected',tone:'red',at:.14,top:205},
 {code:'AR',name:'Automatic Rally',state:'Possible',tone:'blue',at:.29,top:86},
 {code:'ST',name:'Secondary Test',state:'Possible',tone:'amber',at:.39,top:112},
 {code:'Spring',name:'Spring (Test)',state:'Possible',tone:'amber',at:.66,top:224},
 {code:'SOS',name:'Sign of Strength',state:'Detected',tone:'green',at:.82,top:52},
 {code:'LPS',name:'Last Point of Support',state:'Possible',tone:'blue',at:.91,top:96},
];
const VSA_ROWS=[
 ['2026-05-28','Up Day','1.42','1.38','Near High','up'],
 ['2026-05-27','Up Day','1.25','1.21','Near High','up'],
 ['2026-05-26','Down Day','0.87','0.76','Near Low','down'],
 ['2026-05-23','Up Day','1.18','1.05','Mid','mid'],
 ['2026-05-22','Up Day','1.34','1.28','Near High','up'],
];
const VSA_INDICATORS=[
 ['ADX (14)','22.2','Trend / hold','blue'],['Bollinger Bands','Mid 64.7, 79.3, 2','Near lower band','blue'],
 ['MACD','-927.357','Bearish','red'],['Money Flow Index','72.5','Overbought','red'],
 ['RSI (14)','29.2','Oversold','green'],['Moving Averages','26, 64, 73.2','Mixed','blue'],
 ['ATR (14)','1,234.12','Volatility','blue'],['Volume (10D)','2,937,300','Above average','green'],
];

function makeVSASessions(count=120){
 const anchors=[[0,.15,61800,52000],[.15,.47,52000,55400],[.47,.52,55400,51800],[.52,.73,51800,66600],[.73,.84,66600,58800],[.84,1,58800,62100]];
 const rows=[];let day=new Date('2026-05-28T12:00:00Z');
 for(let i=0;i<count;i++){
  while(day.getUTCDay()===0||day.getUTCDay()===6)day.setUTCDate(day.getUTCDate()-1);
  const index=count-1-i,t=index/(count-1),segment=anchors.find(([,end])=>t<=end)||anchors.at(-1);
  const [,end,start,finish]=segment,[begin]=segment,progress=(t-begin)/(end-begin||1);
  const wave=Math.sin(index*1.71)*760+Math.sin(index*.53)*430+Math.cos(index*.27)*260;
  let close=start+(finish-start)*progress+wave;
  if(i===count-1)close=62100;
  const previous=rows.at(-1)?.close??close-180,open=previous+Math.sin(index*2.4)*360;
  const high=Math.max(open,close)+420+Math.abs(Math.sin(index*3.7))*720;
  const low=Math.min(open,close)-390-Math.abs(Math.cos(index*2.2))*650;
  const volume=1900000+Math.abs(Math.sin(index*1.23))*1600000+([12,17,63,80].includes(index)?1900000:0);
  rows.push({date:new Date(day).toISOString().slice(0,10),open,high,low,close,volume});
  day.setUTCDate(day.getUTCDate()-1);
 }
 return rows.reverse();
}
const VSA_SESSIONS=makeVSASessions();
function WyckoffChart({sessions=60,ma20=true,ma60=true,expanded=false}){
 const {t}=usePreferences();
 const data=VSA_SESSIONS.slice(-sessions),plot={left:58,right:952,top:30,bottom:258,volumeTop:306,volumeBottom:368};
 const lows=data.map(d=>d.low),highs=data.map(d=>d.high),min=Math.floor((Math.min(...lows)-1200)/5000)*5000,max=Math.ceil((Math.max(...highs)+1200)/5000)*5000;
 const y=value=>plot.bottom-(value-min)/(max-min||1)*(plot.bottom-plot.top),x=index=>plot.left+index*(plot.right-plot.left)/(data.length-1||1),maxVolume=Math.max(...data.map(d=>d.volume));
 const average=(period)=>data.map((_,i)=>{const source=VSA_SESSIONS.slice(Math.max(0,VSA_SESSIONS.indexOf(data[i])-period+1),VSA_SESSIONS.indexOf(data[i])+1);return source.length<period?null:source.reduce((sum,row)=>sum+row.close,0)/source.length;});
 const line=(period)=>average(period).map((value,i)=>value===null?'':`${x(i)},${y(value)}`).filter(Boolean).join(' ');
 const grid=Array.from({length:5},(_,i)=>min+(max-min)*i/4),barWidth=Math.max(2,Math.min(8,(plot.right-plot.left)/data.length*.48));
 const markerPositions=VSA_EVENTS.map(event=>({...event,index:Math.round(event.at*(data.length-1))}));
 return <svg className={'vsa-chart '+(expanded?'is-expanded':'')} viewBox="0 0 1000 400" role="img" aria-label={t('Illustrative FPT candlestick, Wyckoff event, and volume chart')}>
  {grid.map((value,i)=><g key={i}><line x1={plot.left} x2={plot.right} y1={y(value)} y2={y(value)} className="vsa-gridline"/><text x="8" y={y(value)+4} className="vsa-axis-label">{Math.round(value/1000)},000</text></g>)}
  <line x1={plot.left} x2={plot.right} y1="284" y2="284" className="vsa-divider"/>
  {[54000,62400].map((value,i)=><g key={value}><line x1={plot.left} x2={plot.right} y1={y(value)} y2={y(value)} className={'vsa-level '+(i?'is-resistance':'is-support')}/><text x={plot.right-4} y={y(value)-5} textAnchor="end" className="vsa-level-label">{t(i?'Resistance':'Support')}</text></g>)}
  {data.map((d,i)=>{const up=d.close>=d.open,color=up?'#17a981':'#e87987';return <g key={d.date}><line x1={x(i)} x2={x(i)} y1={y(d.high)} y2={y(d.low)} stroke={color} strokeWidth="1.2"/><rect x={x(i)-barWidth/2} y={Math.min(y(d.open),y(d.close))} width={barWidth} height={Math.max(1.6,Math.abs(y(d.open)-y(d.close)))} rx=".7" fill={up?'#29bd99':'#eb8490'} stroke={color} strokeWidth=".7"/><rect x={x(i)-barWidth/2} y={plot.volumeBottom-d.volume/maxVolume*(plot.volumeBottom-plot.volumeTop)} width={barWidth} height={d.volume/maxVolume*(plot.volumeBottom-plot.volumeTop)} fill={color} opacity=".68"/></g>})}
  {ma20&&<polyline points={line(20)} fill="none" stroke="#2780ed" strokeWidth="2" vectorEffect="non-scaling-stroke"/>}
  {ma60&&<polyline points={line(60)} fill="none" stroke="#9a78e7" strokeWidth="1.8" vectorEffect="non-scaling-stroke"/>}
  {markerPositions.map(event=>{const d=data[event.index];if(!d)return null;const label=event.code==='Spring'?'Spring':event.code;return <g key={event.code} transform={`translate(${Math.max(plot.left,Math.min(plot.right-66,x(event.index)-22))} ${event.top})`}><line x1="28" y1={event.top>170?-3:32} x2="28" y2={y(d.close)-event.top} className={'vsa-event-leader tone-'+event.tone}/><rect width="68" height="40" rx="6" className={'vsa-event-badge tone-'+event.tone}/><text x="8" y="15" className="vsa-event-code">{label}</text><text x="8" y="31" className="vsa-event-state">{t(event.state)}</text></g>})}
  <text x={plot.left} y="300" className="vsa-volume-label">{t('Volume')}  —  {t('Volume MA (20)')}</text>
  {[0,Math.round((data.length-1)*.2),Math.round((data.length-1)*.4),Math.round((data.length-1)*.6),Math.round((data.length-1)*.8),data.length-1].map((i,n)=><text key={n} x={x(i)} y="391" textAnchor={n===0?'start':n===5?'end':'middle'} className="vsa-axis-label">{['Apr 10','Apr 18','Apr 28','May 08','May 16','May 26'][n]}</text>)}
  <g transform={`translate(${plot.left} 15)`}><line x1="0" x2="18" y1="0" y2="0" stroke="#2780ed" strokeWidth="2"/><text x="24" y="4" className="vsa-legend-label">MA20</text><line x1="82" x2="100" y1="0" y2="0" stroke="#9a78e7" strokeWidth="2"/><text x="106" y="4" className="vsa-legend-label">MA60</text><text x="180" y="4" className="vsa-legend-label">{t('FPT · 1D · Illustrative sample data')}</text></g>
 </svg>;
}
function VsaPanelTitle({eyebrow,title,action}){return <header className="vsa-panel-heading"><div>{eyebrow&&<span>{eyebrow}</span>}<h3>{title}</h3></div>{action}</header>}
function VsaStatus({children,tone='blue'}){return <span className={'vsa-status tone-'+tone}>{children}</span>}
function VSAEventTable(){return <div className="vsa-table-scroll"><table className="vsa-event-table"><thead><tr>{['Date','Event','Volume Ratio','Spread Ratio','Close Location'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{VSA_ROWS.map(row=><tr key={row[0]}>{row.slice(0,5).map((cell,i)=><td key={i} className={i===4?'close-'+row[5]:''}>{cell}</td>)}</tr>)}</tbody></table></div>}
export function IndicatorsVSA({initialCompany}){
 const {t}=usePreferences();
 const [period,setPeriod]=useState(60),[ma20,setMa20]=useState(true),[ma60,setMa60]=useState(true),[modal,setModal]=useState(null),[activeTab,setActiveTab]=useState('Overview');
 const tabs=['Overview','Financials','Valuation','Market','Shareholder Returns','Evidence & Coverage'];
 const phaseReasons=['Price is trading in a 60-session range (near lower half).','Volume shows reduced selling pressure and increased buying interest.','Moving averages are flattening.','CMF turns positive recently.','Recent VSA shows accumulation behavior (high volume on up days).'];
 const insight='The stock appears to be in an accumulation phase with signs of strength. A breakout above the resistance zone could signal the next uptrend, but confirmation is required with higher volume and follow-through.';
 function exportRows(){downloadCSV('fpt-vsa-sample-events.csv',[['Date','Event','Volume ratio','Spread ratio','Close location'],...VSA_ROWS.map(row=>row.slice(0,5))])}
 return <div className="analytics-page indicators-vsa-page">
  <header className="vsa-page-heading"><div><span className="eyebrow">{t('TECHNICAL ANALYSIS')}</span><h1>{t('Indicators & VSA')}</h1><p>{t('Volume Spread Analysis, Wyckoff method, and technical indicators for smarter trading decisions.')}</p></div><div className="vsa-heading-meta"><span>{t('Illustrative sample · May 28, 2026 14:32')}</span><span className="vsa-sample-chip"><i/>{t('Sample data · not live')}</span></div></header>
  <section className="vsa-company-summary">
   <div className="vsa-company-top"><div className="vsa-company-identity"><span className="vsa-company-mark">FPT</span><div><h2>FPT Corporation</h2><div className="vsa-company-tags"><span>FPT</span><span>VN</span><span aria-label={t('Watchlisted')}>☆</span></div><p>{t('Information Technology')} <i/> {t('Vietnam')}</p></div></div><div className="vsa-last-price"><strong>62,100 <small>VND</small></strong><span>↑ 1,200 (+1.97%)</span><VsaStatus tone="blue">{t('Market data')}</VsaStatus><small>{t('CLOSED')}</small></div><div className="vsa-summary-stat"><span>{t('Market Cap')}</span><strong>116.37T VND</strong></div><div className="vsa-summary-stat"><span>{t('P/E (trailing)')}</span><strong>12.27×</strong></div><div className="vsa-summary-stat"><span>{t('P/B')}</span><strong>2.65×</strong></div><div className="vsa-summary-stat"><span>{t('Dividend Yield')}</span><strong>2.9%</strong></div></div>
   <nav className="vsa-company-tabs" aria-label={t('Company overview sections')}>{tabs.map(tab=><button type="button" key={tab} aria-pressed={activeTab===tab} className={activeTab===tab?'is-active':''} onClick={()=>setActiveTab(tab)}>{t(tab)}</button>)}</nav>
  </section>
  <section className="vsa-primary-grid">
   <section className="vsa-panel vsa-chart-panel"><VsaPanelTitle eyebrow="01 · WYCKOFF METHOD" title={t('Wyckoff Analysis')} action={<div className="vsa-chart-actions"><label><span className="sr-only">{t('Chart sessions')}</span><select value={period} onChange={e=>setPeriod(Number(e.target.value))}><option value="60">60 {t('sessions')}</option><option value="90">90 {t('sessions')}</option><option value="120">120 {t('sessions')}</option></select></label><button type="button" onClick={()=>setModal('chart')}>{t('View full chart')} <span aria-hidden="true">↗</span></button></div>}/><p className="vsa-panel-subtitle">{t('Price action, volume spread and key Wyckoff events · last {count} trading sessions',{count:period})}</p><div className="vsa-chart-legend-controls"><label><input type="checkbox" checked={ma20} onChange={e=>setMa20(e.target.checked)}/><i className="ma20-line"/>MA20</label><label><input type="checkbox" checked={ma60} onChange={e=>setMa60(e.target.checked)}/><i className="ma60-line"/>MA60</label><span>● {t('Sample data')}</span></div><WyckoffChart sessions={period} ma20={ma20} ma60={ma60}/><p className="vsa-chart-note">{t('Illustrative candles and Wyckoff labels. Signals have not been verified against exchange data.')}</p></section>
   <section className="vsa-panel vsa-legend-panel"><VsaPanelTitle title={t('Wyckoff Event Legend')}/><div className="vsa-event-legend">{VSA_EVENTS.map(event=><div key={event.code}><i className={'event-dot tone-'+event.tone}/><b>{event.code}</b><span>{t(event.name)}</span><VsaStatus tone={event.tone}>{t(event.state)}</VsaStatus></div>)}</div><p className="vsa-panel-footnote">{t('Not every event must appear. The chart shows key events detected or possible based on VSA and price/volume behavior.')}</p></section>
   <section className="vsa-panel vsa-phase-panel"><VsaPanelTitle title={t('Wyckoff Phase Summary')} action={<VsaStatus tone="green">{t('Accumulation')}</VsaStatus>}/><span className="vsa-muted-label">{t('Current phase')}</span><h4>{t('Accumulation')}</h4><div className="vsa-confidence-row"><span>{t('Confidence')}</span><strong>72%</strong></div><div className="vsa-confidence-track"><i/></div><h5>{t('Why this phase?')}</h5><ul>{phaseReasons.map(reason=><li key={reason}>{t(reason)}</li>)}</ul><small>{t('Illustrative interpretation')}</small></section>
   <section className="vsa-panel vsa-ai-insight"><span className="vsa-insight-icon" aria-hidden="true">✦</span><div><h3>{t('AI Insight')} <VsaStatus tone="blue">{t('Sample')}</VsaStatus></h3><p>{t(insight)}</p><small>{t('Generated from illustrative sample data · not investment advice')}</small></div></section>
  </section>
  <section className="vsa-lower-grid">
   <section className="vsa-panel"><VsaPanelTitle eyebrow="PRICE · SPREAD · VOLUME" title={t('Volume Spread Analysis')} action={<button className="vsa-text-button" onClick={exportRows}>{t('Export CSV')} ↓</button>}/><p className="vsa-panel-subtitle">{t('Recent price-volume evidence')}</p><VSAEventTable/><button type="button" className="vsa-outline-button" onClick={()=>setModal('events')}>{t('View all VSA events')} <span>→</span></button></section>
   <section className="vsa-panel vsa-trap-panel"><VsaPanelTitle eyebrow="BREAKOUT QUALITY" title={t('Trap Radar')}/><div className="vsa-trap-rate"><span>{t('Failed break rate')}</span><strong>32.4%</strong><i><b/></i></div><div className="vsa-risk-row"><span>＋</span><span>{t('Bull-trap risk')}</span><i><b/></i><strong>0.0%</strong></div><div className="vsa-risk-row is-bear"><span>↗</span><span>{t('Bear-trap risk')}</span><i><b/></i><strong>32.4%</strong></div><h4>{t('Recent trap signals')}</h4>{[['2026-05-26','Bear trap','Detected','red'],['2026-05-20','Bear trap','Possible','amber'],['2026-05-14','Bull trap','Not confirmed','blue']].map(([date,label,state,tone])=><div className="vsa-trap-signal" key={date}><time>{date}</time><span>{label}</span><VsaStatus tone={tone}>{t(state)}</VsaStatus></div>)}</section>
   <section className="vsa-panel vsa-indicators-panel"><VsaPanelTitle title={t('Key Indicators')} action={<span className="vsa-sample-label">{t('Sample')}</span>}/><div className="vsa-indicator-grid">{VSA_INDICATORS.map(([name,value,note,tone])=><article key={name}><span className="vsa-indicator-symbol" aria-hidden="true">⌁</span><div><small>{t(name)}</small><strong>{value}</strong><em className={'tone-text-'+tone}>{t(note)}</em></div></article>)}</div><p className="vsa-panel-footnote">{t('Illustrative technical readings. Not live exchange data.')}</p></section>
  </section>
  <section className="vsa-support-grid">
   <section className="vsa-panel"><VsaPanelTitle title={t('Entry Confirmation')} action={<VsaStatus tone="blue">{t('Checklist')}</VsaStatus>}/><ul className="vsa-checklist">{['A daily close above the trigger or a successful low-volume retest of support.','Relative volume is normal or expanding on the confirming advance.','No fresh bull-trap warning appears during the confirmation window.'].map(item=><li key={item}><span>✓</span>{t(item)}</li>)}</ul></section>
   <section className="vsa-panel"><VsaPanelTitle title={t('Sell / Risk Rules')}/><ol className="vsa-rules-list">{['Review risk after a decisive daily close below sample support at 59,147.','Reduce risk if a high-volume up bar closes poorly and the next session confirms weakness.','Near 60,000, consider protecting a portion of gains rather than assuming the trend continues.','Recalculate after a financial statement, major company event, or abnormal volume shock.'].map(item=><li key={item}>{t(item)}</li>)}</ol><p className="vsa-panel-footnote">{t('Illustrative educational checklist only; not investment advice.')}</p></section>
   <section className="vsa-panel vsa-evidence-panel"><VsaPanelTitle title={t('Statement Evidence')}/><p className="vsa-panel-subtitle">{t('Sample research coverage and signal quality')}</p><div className="vsa-evidence-grid">{[['Coverage',64],['Research Health',78],['Momentum Balance',85],['Volume Evidence',45],['Trap Safety',80]].map(([label,value])=><div key={label}><span>{t(label)}</span><div className="vsa-gauge" style={{'--gauge-value':`${value*3.6}deg`}} role="meter" aria-label={t(label)} aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}><i>{value}%</i></div></div>)}</div><small className="vsa-panel-footnote">{t('Scores are illustrative and do not indicate certainty.')}</small></section>
  </section>
  <footer className="vsa-data-disclosure">{t('All prices, chart candles, VSA events, technical indicators and model interpretations on this page are illustrative sample data. No live exchange feed or verified trading signal is connected.')}</footer>
  {modal==='chart'&&<Dialog title={t('Wyckoff Analysis · FPT')} onClose={()=>setModal(null)} className="vsa-dialog vsa-chart-dialog" headerActions={<VsaStatus tone="blue">{period} {t('sessions')}</VsaStatus>}><div className="vsa-expanded-chart"><WyckoffChart sessions={period} ma20={ma20} ma60={ma60} expanded/></div><div className="vsa-dialog-controls"><label>{t('Sessions')}<select value={period} onChange={e=>setPeriod(Number(e.target.value))}><option value="60">60</option><option value="90">90</option><option value="120">120</option></select></label><label><input type="checkbox" checked={ma20} onChange={e=>setMa20(e.target.checked)}/> MA20</label><label><input type="checkbox" checked={ma60} onChange={e=>setMa60(e.target.checked)}/> MA60</label></div><div className="vsa-dialog-event-strip">{VSA_EVENTS.map(event=><span key={event.code}><i className={'event-dot tone-'+event.tone}/><b>{event.code}</b> {t(event.name)} · {t(event.state)}</span>)}</div></Dialog>}
  {modal==='events'&&<Dialog title={t('VSA events · FPT sample')} onClose={()=>setModal(null)} className="vsa-dialog vsa-events-dialog"><p className="vsa-panel-subtitle">{t('Price, spread and relative volume observations from the illustrative May 2026 snapshot.')}</p><VSAEventTable/><div className="vsa-event-definition-list">{VSA_EVENTS.map(event=><article key={event.code}><i className={'event-dot tone-'+event.tone}/><b>{event.code} · {t(event.name)}</b><VsaStatus tone={event.tone}>{t(event.state)}</VsaStatus><p>{t('Wyckoff labels are heuristic examples here and are not verified market events.')}</p></article>)}</div><button className="vsa-outline-button" onClick={exportRows}>{t('Download sample events')} ↓</button></Dialog>}
 </div>;
}
const tradePlannerUniverse=[
 {ticker:'FPT',name:'FPT Corporation',price:140000,change:1.97,sector:'Information Technology',currency:'VND',color:'#176df3'},
 ...companies.map(company=>({...company,currency:'USD'})),
];
const plannerWinRate=.398;
function plannerMoney(value,currency='USD'){
 const amount=Number(value)||0;
 return currency==='VND'?`${amount.toLocaleString('en-US',{maximumFractionDigits:0})} VND`:money(amount);
}
function plannerPercent(value){return `${value<0?'−':'+'}${Math.abs(value).toFixed(1)}%`}
function readPlannerPlans(key){
 try{
  const saved=JSON.parse(localStorage.getItem(key));if(!Array.isArray(saved))return [];
  return saved.filter(plan=>plan&&tradePlannerUniverse.some(item=>item.ticker===plan.ticker)&&!tradeSizing(plan).error).map(plan=>{
   const instrument=tradePlannerUniverse.find(item=>item.ticker===plan.ticker);
   const distance=Number(plan.entry)?Math.abs(Number(plan.entry)-Number(plan.stop))/Number(plan.entry)*100:3.2;
   const multiple=Number(plan.entry)!==Number(plan.stop)?Math.abs(Number(plan.target)-Number(plan.entry))/Math.abs(Number(plan.entry)-Number(plan.stop)):2;
   return {...plan,currency:plan.currency||instrument.currency,horizon:Number(plan.horizon)||20,sizingMode:plan.sizingMode||'fractional',stopDistancePct:Number(plan.stopDistancePct)||distance,rMultiple:Number(plan.rMultiple)||multiple};
  });
 }catch{return []}
}
function readPlannerWatchlist(key){try{const values=JSON.parse(localStorage.getItem(key));return Array.isArray(values)?values.filter(ticker=>tradePlannerUniverse.some(item=>item.ticker===ticker)):[]}catch{return []}}
export function TradePlanner({storageKey,watchlist=[],onToggleWatch,onNavigate}){
 const {t}=usePreferences();
 const [company,setCompany]=useState(tradePlannerUniverse[0]),[direction,setDirection]=useState('Long');
 const [entry,setEntry]=useState('140000'),[stopDistance,setStopDistance]=useState('3.2');
 const [equity,setEquity]=useState('2500000000'),[risk,setRisk]=useState('1');
 const [rMultiple,setRMultiple]=useState('2'),[horizon,setHorizon]=useState('20'),[sizingMode,setSizingMode]=useState('fractional');
 const [marketTab,setMarketTab]=useState('Technical'),[evidenceTab,setEvidenceTab]=useState('Recent signals');
 const [plans,setPlans]=useState(()=>readPlannerPlans(storageKey+'-plans'));
 const [plannerWatchlist,setPlannerWatchlist]=useState(()=>readPlannerWatchlist(storageKey+'-trade-watchlist'));
 const [notice,setNotice]=useState(''),[editingId,setEditingId]=useState(null);
 const equityValue=Number(equity),riskLimit=Number(risk),entryValue=Number(entry),stopPct=Number(stopDistance),rr=Number(rMultiple),days=Number(horizon);
 const unitRisk=entryValue*stopPct/100,stopPrice=direction==='Long'?entryValue-unitRisk:entryValue+unitRisk;
 const targetPrice=direction==='Long'?entryValue+unitRisk*rr:entryValue-unitRisk*rr;
 const expectancy=plannerWinRate*rr-(1-plannerWinRate),fullKelly=rr>0?Math.max(0,plannerWinRate-(1-plannerWinRate)/rr):0;
 const effectiveRisk=sizingMode==='fractional'?riskLimit:Math.min(riskLimit,fullKelly*(sizingMode==='half-kelly'?.5:1)*stopPct);
 const kellyError=sizingMode!=='fractional'&&expectancy<=0?'The sample win-rate assumption does not support a positive Kelly allocation at this reward multiple. Choose a higher R multiple or Fixed Fractional.':null;
 const draft={ticker:company.ticker,direction,capital:equityValue,risk:riskLimit,entry:entryValue,stop:stopPrice,target:targetPrice};
 const result=kellyError?{error:kellyError}:tradeSizing({...draft,risk:effectiveRisk}),hasPlan=!result.error&&result.shares>0;
 const capitalUse=hasPlan?Math.min(100,result.positionValue/equityValue*100):0;
 const workspaceCompany=companies.find(item=>item.ticker===company.ticker);
 const workspaceWatchlisted=watchlist.some(item=>item.ticker===company.ticker);
 const watchlisted=workspaceCompany?workspaceWatchlisted:plannerWatchlist.includes(company.ticker);
 const atr=company.currency==='VND'?1234.119:entryValue*.018,volume=company.currency==='VND'?18742800:2937300;
 const structureTabs=['Technical','Liquidity','Volatility'];
 const evidenceTabs=['Recent signals','Similar patterns','Historical trades'];
 const evidenceRows={
  'Recent signals':[['Sep 23, 2026','Breakout + volume','138,200','+6.8%','2.1'],['Sep 16, 2026','MA cross','135,400','+5.2%','1.6'],['Sep 08, 2026','RSI oversold','133,800','+4.3%','1.4'],['Aug 27, 2026','Positive earnings','137,600','+7.9%','2.4']],
  'Similar patterns':[['Jul 18, 2026','Range breakout','132,400','+5.9%','1.8'],['Jun 04, 2026','Pullback retest','128,900','+4.1%','1.5'],['May 12, 2026','Volume expansion','126,500','+7.2%','2.0']],
  'Historical trades':[['Apr 22, 2026','Trend continuation','124,800','+6.1%','1.9'],['Mar 09, 2026','Support rebound','119,600','+3.8%','1.3'],['Feb 14, 2026','Failed breakout','116,200','−2.6%','−0.8']],
 };
 const structureRows=marketTab==='Technical'?
  [['Support (20d)',plannerMoney(entryValue*.964,company.currency)],['Resistance (20d)',plannerMoney(entryValue*1.086,company.currency)],['Trend',company.change>=0?'Uptrend':'Pullback'],['Market volume (ADV)',volume.toLocaleString('en-US')],['Relative volume (RVOL)','1.32'],['Spread (approx.)','0.45%']]:marketTab==='Liquidity'?
  [['Average volume (10d)',volume.toLocaleString('en-US')],['Relative volume (RVOL)','1.32'],['Estimated turnover',plannerMoney(volume*entryValue,company.currency)],['Spread (approx.)','0.45%'],['Liquidity profile','Illustrative sample'],['Order book','Not connected']]:
  [['ATR (14)',plannerMoney(atr,company.currency)],['ATR / entry',`${(atr/entryValue*100||0).toFixed(2)}%`],['Planned stop distance',`${stopPct||0}%`],['Reward target',`${(stopPct*rr||0).toFixed(1)}%`],['Volatility window','14 sessions'],['Price series','Sample only']];
 const metrics=[
  ['Planned stop loss',hasPlan?plannerPercent(-stopPct):'—',hasPlan?`Per share: −${plannerMoney(unitRisk,company.currency)}`:'Review setup'],
  ['Reward target',hasPlan?plannerPercent(stopPct*rr):'—',hasPlan?`Per share: +${plannerMoney(unitRisk*rr,company.currency)}`:'Based on R-multiple'],
  ['Expected loss',hasPlan?`−${plannerMoney(result.maxLoss,company.currency)}`:'—','If stop is reached'],
  ['Expected gain',hasPlan?`+${plannerMoney(result.potentialProfit,company.currency)}`:'—','At planned target'],
  ['Expectancy',`${expectancy.toFixed(2)}R`,'At 39.8% sample win rate'],
  ['Win / loss assumption','39.8% / 60.2%','Illustrative model input'],
  ['Break-even win rate',rr>0?`${(100/(1+rr)).toFixed(1)}%`:'—','At this reward multiple'],
  ['Position value',hasPlan?plannerMoney(result.positionValue,company.currency):'—',hasPlan?`${capitalUse.toFixed(1)}% of equity`:'Based on account equity'],
  ['ATR14 sample',plannerMoney(atr,company.currency),'Illustrative reference only'],
  ['Holding horizon',days?`${days} days`:'—','Planning window'],
 ];
 function persist(next,message='Trade plan saved on this browser.'){
  try{localStorage.setItem(storageKey+'-plans',JSON.stringify(next));setPlans(next);setNotice(message)}catch{setNotice('Your browser could not save this trade plan.')}
 }
 function selectCompany(ticker){const next=tradePlannerUniverse.find(item=>item.ticker===ticker);if(!next)return;setCompany(next);setEntry(String(next.price));setEquity(next.currency==='VND'?'2500000000':'10000');setEditingId(null)}
 function resetDraft(){setCompany(tradePlannerUniverse[0]);setDirection('Long');setEntry('140000');setStopDistance('3.2');setEquity('2500000000');setRisk('1');setRMultiple('2');setHorizon('20');setSizingMode('fractional');setEditingId(null);setNotice('Draft reset to the FPT sample scenario.')}
 function savePlan(event){event?.preventDefault();if(!hasPlan)return;const plan={...draft,risk:effectiveRisk,riskLimitPercent:riskLimit,currency:company.currency,stopDistancePct:stopPct,rMultiple:rr,horizon:days,sizingMode,effectiveRiskPercent:effectiveRisk,id:editingId||Date.now(),savedAt:new Date().toISOString()};const next=editingId?plans.map(item=>item.id===editingId?plan:item):[plan,...plans];persist(next,editingId?'Trade plan updated on this browser.':'Trade plan saved on this browser.');setEditingId(null)}
 function loadPlan(plan){const next=tradePlannerUniverse.find(item=>item.ticker===plan.ticker);if(!next)return;const distance=Number(plan.entry)?Math.abs(Number(plan.entry)-Number(plan.stop))/Number(plan.entry)*100:3.2;const multiple=Number(plan.entry)!==Number(plan.stop)?Math.abs(Number(plan.target)-Number(plan.entry))/Math.abs(Number(plan.stop)-Number(plan.entry)):2;setCompany(next);setDirection(plan.direction);setEquity(String(plan.capital));setRisk(String(plan.riskLimitPercent??plan.risk));setEntry(String(plan.entry));setStopDistance(String(plan.stopDistancePct||distance));setRMultiple(String(plan.rMultiple||multiple));setHorizon(String(plan.horizon||20));setSizingMode(plan.sizingMode||'fractional');setEditingId(plan.id);setNotice(`${plan.ticker} plan loaded for editing.`);document.querySelector('.tp-trade-setup')?.scrollIntoView({behavior:'smooth',block:'start'})}
 function removePlan(id){persist(plans.filter(item=>item.id!==id),'Trade plan removed.');if(editingId===id)setEditingId(null)}
 function exportPlans(){downloadCSV('pasion-trade-plans-sample.csv',[["Ticker","Currency","Direction","Sizing mode","Equity","Risk limit %","Effective risk %","Entry","Stop","Target","Shares","Horizon days","R multiple"],...plans.map(plan=>{const size=tradeSizing(plan),currency=plan.currency||tradePlannerUniverse.find(item=>item.ticker===plan.ticker)?.currency||'USD';return [plan.ticker,currency,plan.direction,plan.sizingMode||'fractional',plan.capital,plan.riskLimitPercent??plan.risk,plan.effectiveRiskPercent||plan.risk,plan.entry,plan.stop,plan.target,size.shares,plan.horizon||20,plan.rMultiple||size.ratio]})])}
 function exportReport(){downloadCSV(`pasion-${company.ticker.toLowerCase()}-trade-plan-sample.csv`,[['Trade plan report','Illustrative sample only'],['Ticker',company.ticker],['Company',company.name],['Currency',company.currency],['Direction',direction],['Sizing mode',sizingMode],['Entry',entryValue],['Stop',stopPrice],['Target',targetPrice],['Account equity',equityValue],['Risk limit %',riskLimit],['Effective risk %',effectiveRisk],['Position shares',hasPlan?result.shares:''],['Position value',hasPlan?result.positionValue:''],['Expected loss',hasPlan?result.maxLoss:''],['Expected gain',hasPlan?result.potentialProfit:''],['Sample win rate assumption',plannerWinRate],['Holding horizon days',days]]);setNotice('Sample trade report downloaded.')}
 function toggleWatchlist(){
  if(workspaceCompany&&onToggleWatch){onToggleWatch(workspaceCompany);setNotice(workspaceWatchlisted?'Removed from your workspace watchlist.':'Added to your workspace watchlist.');return}
  const next=plannerWatchlist.includes(company.ticker)?plannerWatchlist.filter(ticker=>ticker!==company.ticker):[company.ticker,...plannerWatchlist];
  try{localStorage.setItem(storageKey+'-trade-watchlist',JSON.stringify(next));setPlannerWatchlist(next);setNotice(next.includes(company.ticker)?'Added to your planner watchlist on this browser.':'Removed from your planner watchlist.')}catch{setNotice('Your browser could not save the watchlist.')}
 }
 const canSave=hasPlan&&Number.isInteger(days)&&days>0&&days<=365;
 return <div className="analytics-page trade-planner-page">
  <header className="tp-page-heading"><div><span className="eyebrow">{t('RISK-FIRST PLANNING')}</span><h1>{t('Trade Planner')}</h1><p>{t('Model position size, payoff, and market context before you make a plan.')}</p></div><span className="tp-local-badge"><i/>{t('Illustrative sample · no live feed')}</span></header>
  <form className="tp-planner-form" onSubmit={savePlan}>
   <section className="tp-card tp-trade-setup">
    <header className="tp-section-heading"><div><span className="tp-step-number">01</span><div><h2>{t('Trade Setup')}</h2><p>{t('Set the instrument, planned levels, account size, and risk limit.')}</p></div></div><span className="tp-reference-pill">{t('Sample market context')}</span></header>
    <div className="tp-setup-grid">
      <label className="tp-field tp-company-field"><span>{t('Company / Ticker')}</span><select value={company.ticker} onChange={event=>selectCompany(event.target.value)}><option value="FPT">FPT · FPT Corporation</option><optgroup label={t('US sample companies')}>{companies.map(item=><option key={item.ticker} value={item.ticker}>{item.ticker} · {item.name}</option>)}</optgroup></select></label>
      <label className="tp-field"><span>{t('Entry Price')} <small>({company.currency})</small></span><div className="tp-input-wrap"><input aria-label={t('Entry price')} type="number" min={company.currency==='VND'?'100':'0.01'} step={company.currency==='VND'?'100':'0.01'} value={entry} onChange={event=>setEntry(event.target.value)}/><em>{company.currency}</em></div></label>
     <label className="tp-field"><span>{t('Stop Distance')} <small>(%)</small></span><div className="tp-input-wrap"><input aria-label={t('Stop distance percent')} type="number" min="0.1" max="50" step="0.1" value={stopDistance} onChange={event=>setStopDistance(event.target.value)}/><em>%</em></div></label>
     <fieldset className="tp-field tp-direction-field"><legend>{t('Direction')}</legend><div className="tp-direction-control"><button type="button" className={direction==='Long'?'is-active is-long':''} aria-pressed={direction==='Long'} onClick={()=>setDirection('Long')}>{t('Long')}</button><button type="button" className={direction==='Short'?'is-active is-short':''} aria-pressed={direction==='Short'} onClick={()=>setDirection('Short')}>{t('Short')}</button></div></fieldset>
     <label className="tp-field"><span>{t('Holding Horizon')} <small>({t('days')})</small></span><div className="tp-input-wrap"><input aria-label={t('Holding horizon in days')} type="number" min="1" max="365" step="1" value={horizon} onChange={event=>setHorizon(event.target.value)}/><em>{t('days')}</em></div></label>
     <label className="tp-field"><span>{t('Account Equity')} <small>({company.currency})</small></span><div className="tp-input-wrap"><input aria-label={t('Account equity')} type="number" min="0.01" step={company.currency==='VND'?'1000000':'100'} value={equity} onChange={event=>setEquity(event.target.value)}/><em>{company.currency}</em></div></label>
      <label className="tp-field"><span>{t('Risk per Trade')} <small>(%)</small></span><div className="tp-input-wrap"><input id="tp-risk-limit" aria-label={t('Risk per trade percent')} type="number" min="0.1" max="100" step="0.1" value={risk} onChange={event=>setRisk(event.target.value)}/><em>%</em></div></label>
     <label className="tp-field"><span>{t('R-Multiple')} <small>({t('reward / risk')})</small></span><div className="tp-input-wrap"><input aria-label={t('Reward to risk multiple')} type="number" min="0.1" max="10" step="0.1" value={rMultiple} onChange={event=>setRMultiple(event.target.value)}/><em>R</em></div></label>
    </div>
    <div className="tp-sizing-block"><div className="tp-sizing-heading"><div><h3>{t('Sizing Mode')}</h3><p>{t('Compare a fixed risk budget with model-based position sizing.')}</p></div><span>{t('39.8% sample win-rate assumption')}</span></div><div className="tp-mode-grid" role="group" aria-label={t('Position sizing mode')}>
     {[['fractional','Fixed Fractional','Risk a fixed percentage of account equity.','DEFAULT'],['kelly','Kelly Criterion','Uses the sample win rate and payoff ratio.','CALCULATED'],['half-kelly','Half-Kelly / Fractional Kelly','Uses half of the positive Kelly allocation.','CALCULATED']].map(([key,title,description,badge])=><button type="button" key={key} className={'tp-mode-card '+(sizingMode===key?'is-selected':'')} aria-pressed={sizingMode===key} onClick={()=>setSizingMode(key)}><span className="tp-radio" aria-hidden="true"/><span className="tp-mode-copy"><strong>{t(title)}</strong><small>{t(description)}</small></span><em>{t(badge)}</em></button>)}
    </div></div>
   </section>
   <section className="tp-card tp-backtest-section"><div className="tp-backtest-heading"><div><h2>{t('Backtest Results')} <span>{t('Selected mode: {mode}',{mode:t(sizingMode==='fractional'?'Fixed Fractional':sizingMode==='kelly'?'Kelly Criterion':'Half-Kelly')})}</span></h2><p>{t('Illustrative model outputs; no historical trades or live market feed are connected.')}</p></div><small>{t('Model assumption: {rate}% win rate',{rate:(plannerWinRate*100).toFixed(1)})}</small></div><div className="tp-backtest-grid" aria-label={t('Illustrative trade outcomes')}>{metrics.map(([label,value,note],index)=><article className="tp-backtest-metric" key={label}><span>{t(label)}</span><strong className={index===0||index===2?'is-risk':index===1||index===3?'is-reward':''}>{value}</strong><small>{t(note)}</small></article>)}</div></section>
   <section className="tp-workspace-grid">
    <section className="tp-card tp-sizing-summary"><header className="tp-section-heading"><div><span className="tp-step-number">02</span><div><h2>{t('Position Sizing Summary')}</h2><p>{t('Calculated size from the selected risk method.')}</p></div></div></header>{hasPlan?<><dl className="tp-sizing-rows"><div><dt>{t('Risk limit per trade')}</dt><dd>{riskLimit.toFixed(2)}% <small>({plannerMoney(equityValue*riskLimit/100,company.currency)})</small></dd></div><div><dt>{t('Effective risk used')}</dt><dd>{(result.maxLoss/equityValue*100).toFixed(2)}% <small>({plannerMoney(result.maxLoss,company.currency)})</small></dd></div><div><dt>{t('Position size (shares)')}</dt><dd>{result.shares.toLocaleString()}</dd></div><div><dt>{t('Position value')}</dt><dd>{plannerMoney(result.positionValue,company.currency)} <small>({capitalUse.toFixed(1)}% {t('of equity')})</small></dd></div><div><dt>{t('Planned stop price')}</dt><dd>{plannerMoney(stopPrice,company.currency)}</dd></div><div><dt>{t('Target price')}</dt><dd>{plannerMoney(targetPrice,company.currency)}</dd></div><div><dt>{t('Maximum equity size')}</dt><dd>{Math.floor(equityValue/entryValue).toLocaleString()} <small>({t('capital cap')})</small></dd></div></dl><div className="tp-limit-status"><strong>{t('Within risk limits')}</strong><small>{t('Position size is capped by risk budget and account equity.')}</small></div></>:<div className="tp-validation" role="alert"><strong>{t('Review this setup')}</strong><span>{t(result.error||'Enter valid values to calculate a position.')}</span></div>}{sizingMode!=='fractional'&&<p className="tp-kelly-note">{t('Kelly size is constrained by your risk limit and uses the sample win-rate assumption. It is not a tested trading edge.')}</p>}</section>
    <section className="tp-card tp-structure-card"><header className="tp-section-heading"><div><span className="tp-step-number">03</span><div><h2>{t('Market Structure References')}</h2><p>{t('Illustrative levels and market conditions.')}</p></div></div><button type="button" className="tp-text-action" onClick={()=>setMarketTab('Volatility')}>{t('View all')} →</button></header><div className="tp-structure-tabs" role="tablist" aria-label={t('Market structure category')}>{structureTabs.map(tab=><button key={tab} type="button" role="tab" aria-selected={marketTab===tab} className={marketTab===tab?'is-active':''} onClick={()=>setMarketTab(tab)}>{t(tab)}</button>)}</div><dl className="tp-structure-rows">{structureRows.map(([label,value])=><div key={label}><dt>{t(label)}</dt><dd className={label==='Trend'?(company.change>=0?'is-positive':'is-caution'):''}>{label==='Trend'?`${value} · Sample`:value}</dd></div>)}</dl><p className="tp-panel-disclosure">{t('Reference values are illustrative samples, not live market structure.')}</p></section>
    <aside className="tp-card tp-decision-card"><header className="tp-section-heading"><div><span className="tp-step-number">04</span><div><h2>{t('Trade Decision')}</h2><p>{t('Review the plan before saving.')}</p></div></div><span className={'tp-decision-status '+(hasPlan&&rr>=2?'is-ready':'')}>{t(hasPlan&&rr>=2?'Within limits':'Review plan')}</span></header><div className="tp-decision-instrument"><span className="tp-ticker-badge">{company.ticker.slice(0,3)}</span><div><strong>{company.ticker}</strong><small>{company.name} · {plannerMoney(entryValue,company.currency)}</small></div><span className={'tp-direction-tag '+(direction==='Short'?'is-short':'')}>{t(direction)}</span></div><div className="tp-decision-grid"><div><span>{t('Position Size')}</span><strong>{hasPlan?`${result.shares.toLocaleString()} ${t('shares')}`:'—'}</strong><small>{hasPlan?plannerMoney(result.positionValue,company.currency):t('Complete setup')}</small></div><div><span>{t('Risk / Reward')}</span><strong>1 : {rr.toFixed(1)}</strong><small>{t('R-Multiple {multiple}',{multiple:rr.toFixed(1)})}</small></div></div><button className={'tp-watchlist-button '+(watchlisted?'is-saved':'')} type="button" onClick={toggleWatchlist}>{watchlisted?t('On Watchlist'):t('Add to Watchlist')}</button>{!workspaceCompany&&<small className="tp-watchlist-note">{t('FPT is saved to a planner-only watchlist on this browser.')}</small>}<div className="tp-quick-actions"><h3>{t('Quick Actions')}</h3><div className="tp-quick-action-grid"><button type="button" onClick={()=>onNavigate?.('Portfolio')}><strong>{t('View Portfolio')}</strong><small>{t('Open positions and risk')}</small></button><button type="button" onClick={()=>onNavigate?.('Portfolio','Watchlist')}><strong>{t('Saved Companies')}</strong><small>{t('Review your saved company list')}</small></button><button type="button" onClick={()=>{setSizingMode('fractional');document.getElementById('tp-risk-limit')?.focus()}}><strong>{t('Set Risk Profile')}</strong><small>{t('Configure fixed fractional risk')}</small></button><button type="button" onClick={exportReport}><strong>{t('Download Report')}</strong><small>{t('Export this plan as CSV')}</small></button></div></div><button className="tp-save-button" type="submit" disabled={!canSave}>{editingId?t('Save plan changes'):t('Save trade plan')}</button></aside>
    <section className="tp-card tp-evidence-card"><header className="tp-section-heading"><div><span className="tp-step-number">05</span><div><h2>{t('Recent & Related Evidence')}</h2><p>{t('Illustrative sample signals and trade outcomes.')}</p></div></div><button type="button" className="tp-text-action" onClick={()=>setEvidenceTab('Historical trades')}>{t('View all')} →</button></header><div className="tp-evidence-tabs" role="tablist" aria-label={t('Evidence view')}>{evidenceTabs.map(tab=><button key={tab} type="button" role="tab" aria-selected={evidenceTab===tab} className={evidenceTab===tab?'is-active':''} onClick={()=>setEvidenceTab(tab)}>{t(tab)}</button>)}</div><div className="tp-evidence-table-wrap"><table className="tp-evidence-table"><thead><tr><th>{t('Date')}</th><th>{t('Signal')}</th><th>{t('Price')} ({company.currency})</th><th>{t('Outcome')}</th><th>{t('R-Multiple')}</th><th>{t('Details')}</th></tr></thead><tbody>{evidenceRows[evidenceTab].map(([date,signal,price,outcome,multiple])=>{const returnPct=Number(outcome.replace('−','-').replace('%',''));const samplePrice=company.currency==='VND'?Number(price.replaceAll(',','')):entryValue/(1+returnPct/100);return <tr key={`${date}-${signal}`}><td>{t(date)}</td><td>{t(signal)}</td><td>{plannerMoney(samplePrice,company.currency)}</td><td className={outcome.startsWith('−')?'is-caution':'is-positive'}>{outcome}</td><td>{multiple}</td><td><button type="button" onClick={()=>setNotice(`${date}: ${signal}. ${t('Illustrative sample evidence only.')}`)}>{t('View')}</button></td></tr>})}</tbody></table></div><p className="tp-panel-disclosure">{t('These examples are not verified historical trades and do not predict future results.')}</p></section>
   </section>
  </form>
  <section className="tp-card tp-saved-plans"><header className="tp-section-heading"><div><span className="tp-step-number">06</span><div><h2>{t('Saved Trade Plans')}</h2><p>{t('Reopen a saved setup or export your plan list.')}</p></div><span className="tp-plan-count">{plans.length}</span></div><button type="button" className="tp-export-button" disabled={!plans.length} onClick={exportPlans}>{t('Export CSV')}</button></header>{!plans.length?<div className="tp-empty-state"><strong>{t('No saved plans yet')}</strong><p>{t('Save this setup to keep its assumptions in your browser.')}</p></div>:<div className="tp-plans-table-wrap"><table className="tp-plans-table"><thead><tr><th>{t('Company')}</th><th>{t('Direction')}</th><th>{t('Sizing mode')}</th><th>{t('Shares')}</th><th>{t('Entry / stop / target')}</th><th>{t('Reward / risk')}</th><th>{t('Actions')}</th></tr></thead><tbody>{plans.map(plan=>{const size=tradeSizing(plan),currency=plan.currency||'USD';return <tr key={plan.id}><th scope="row"><span className="tp-saved-ticker">{plan.ticker.slice(0,3)}</span><span><strong>{plan.ticker}</strong><small>{plannerMoney(plan.capital,currency)}</small></span></th><td><span className={'tp-direction-tag '+(plan.direction==='Short'?'is-short':'')}>{t(plan.direction)}</span></td><td>{t(plan.sizingMode==='kelly'?'Kelly Criterion':plan.sizingMode==='half-kelly'?'Half-Kelly':'Fixed Fractional')}</td><td>{size.shares.toLocaleString()}</td><td>{plannerMoney(plan.entry,currency)} / {plannerMoney(plan.stop,currency)} / {plannerMoney(plan.target,currency)}</td><td>{(plan.rMultiple||size.ratio).toFixed(1)}R</td><td><div className="tp-plan-actions"><button type="button" onClick={()=>loadPlan(plan)}>{t('Edit')}</button><button type="button" className="is-delete" onClick={()=>removePlan(plan.id)}>{t('Delete')}</button></div></td></tr>})}</tbody></table></div>}</section>
  {notice&&<p className="tp-notice" role="status">{t(notice)}</p>}
  <footer className="tp-disclosure">{t('All values on this page are illustrative samples. Kelly outputs use an assumed 39.8% win rate; no verified historical backtest, live market feed, or order routing is connected.')}</footer>
 </div>;
}
export function DataSources({query}){
 const {t}=usePreferences();
 const [tab,setTab]=useState('Data inventory');
 const sources=[['Company universe','10 companies','Illustrative company profiles and prices','Bundled sample dataset'],['Price series','36 points per period','Generated series for 1D, 1W, 1M, and 1Y','Deterministic chart generator'],['Research metrics','Sample assessments','Quality coverage, growth, margins, and peer figures','Illustrative research model'],['News briefings','4 stories','Fictional editorial examples with local cover photographs','Bundled sample content'],['Portfolio & plans','Saved per account / browser','Positions, cost basis, alerts, and trade drafts','Browser local storage']];
 const filtered=sources.filter(row=>[...row,...row.map(text=>t(text))].join(' ').toLowerCase().includes(query.toLowerCase()));
 return <div className="analytics-page"><section className="home-card"><SectionHeader eyebrow="TRANSPARENCY DESK" title="Know what powers your workspace"><span className="connection-status"><i/>{t("Sample mode")}</span></SectionHeader><p className="tool-body">{t("No exchange, company filings, news feed, or AI provider is connected. This inventory explains what is bundled, generated, or saved locally.")}</p><div className="company-tabs">{['Data inventory','Reports','Connection status'].map(name=><button key={name} className={tab===name?'selected':''} aria-pressed={tab===name} onClick={()=>setTab(name)}>{t(name)}</button>)}</div>{tab==='Data inventory'?<div className="source-inventory">{filtered.map(([name,count,description,origin])=><article key={name}><div><h3>{t(name)}</h3><span className="small-tag">{t(count)}</span></div><p>{t(description)}</p><small>{t('Origin: {origin}',{origin:t(origin)})}</small><b>{t("Sample / local")}</b></article>)}{!filtered.length&&<p className="tool-note">{t("No matching data sources. Try another search.")}</p>}</div>:tab==='Reports'?<div className="report-library"><article><span>CSV</span><h3>{t("Company universe")}</h3><p>{t("Ten sample company profiles, prices, changes, and valuation metrics.")}</p><button className="dashboard-button" onClick={()=>downloadCSV('pasion-company-universe-sample.csv',[['Ticker','Company','Sector','Sample price USD','Sample change %','Sample market cap','Sample PE'],...companies.map(c=>[c.ticker,c.name,c.sector,c.price,c.change,c.cap,c.pe])])}>{t("Download company report")}</button></article><article><span>CSV</span><h3>{t("Source inventory")}</h3><p>{t("An export of the sources and limitations documented in this workspace.")}</p><button className="dashboard-button secondary-action" onClick={()=>downloadCSV('pasion-data-inventory.csv',[['Dataset','Coverage','Description','Origin'],...sources])}>{t("Download inventory")}</button></article></div>:<div className="connection-list">{['Live prices','Verified filings','Live company news','AI research provider'].map(name=><div key={name}><strong>{t(name)}</strong><span>{t("Not connected")}</span></div>)}<p className="tool-note">{t("A configured email sender supports password recovery separately from market data connections.")}</p></div>}</section><section className="home-card"><h2>{t("Data handling")}</h2><div className="indicator-lessons"><div><strong>{t("Account records")}</strong><p>{t("The Python server stores accounts with hashed passwords. Administrator permissions are checked on the server.")}</p></div><div><strong>{t("Workspace preferences")}</strong><p>{t("Layouts, bookmarks, holdings, alerts, and plans stay in this browser. They are not synced across devices.")}</p></div><div><strong>{t("Exported reports")}</strong><p>{t("CSV exports include sample labels. Clearing browser storage removes saved workspace choices.")}</p></div></div></section></div>
}
export default function AnalyticsPages({page,query,selected,watched,storageKey,onResearch,onToggleWatch,onNavigate}){
 if(page==='Compare')return <CompareCompanies query={query} onResearch={onResearch}/>;
 if(page==='Stock')return <StockAnalytics storageKey={storageKey}/>;
 if(page==='Indicators')return <IndicatorsVSA initialCompany={selected}/>;
 if(page==='Trade')return <TradePlanner storageKey={storageKey} watchlist={watched} onToggleWatch={onToggleWatch} onNavigate={onNavigate}/>;
 if(page==='Events')return <EventScenarios storageKey={storageKey}/>;
 if(page==='Sources')return <DataSources query={query}/>;
 return null;
}
