import React,{useState} from 'react';
import Dialog from './Dialog';
import {usePreferences} from './Preferences';
import './investment-research.scss';

const valuationModels=[
 {name:'DCF',full:'Discounted Cash Flow',value:'78,400',change:'+26.2%',tone:'positive',badge:'Highest value',drivers:[['WACC','9.5%'],['Terminal growth','2.5%'],['Forecast period','5 years']]},
 {name:'P/E',full:'Price to Earnings',value:'71,200',change:'+14.7%',tone:'positive',drivers:[['TTM P/E','12.27×'],['Industry P/E','16.8×'],['EPS (TTM)','5,062 VND']]},
 {name:'DDM',full:'Dividend Discount',value:'65,400',change:'+5.3%',tone:'positive',drivers:[['Dividend yield','2.9%'],['Growth rate','6.0%'],['Cost of equity','9.5%']]},
 {name:'Gordon',full:'Gordon Growth Model',value:'69,800',change:'+12.4%',tone:'positive',drivers:[['Dividend (D1)','1,800 VND'],['Growth rate','6.0%'],['Cost of equity','9.5%']]},
 {name:'Asset-based',full:'Asset-based Valuation',value:'58,700',change:'−5.5%',tone:'negative',drivers:[['Book value/share','23,940 VND'],['Adjustments','+3.2%'],['P/B','2.65×']]},
];
const financialRows=[
 ['Revenue (TTM)','62.1T VND','48.7T VND','+27.4%','positive'],
 ['Net Profit (TTM)','9.8T VND','6.2T VND','+58.1%','positive'],
 ['Net Margin','15.8%','12.7%','+3.1pp','positive'],
 ['EBITDA Margin','21.4%','17.3%','+4.1pp','positive'],
 ['ROE','18.6%','14.2%','+4.4pp','positive'],
 ['ROA','12.7%','9.8%','+2.9pp','positive'],
 ['Debt / Equity','0.42','0.68','−38.2%','positive'],
 ['Current Ratio','1.56','1.28','+21.9%','positive'],
 ['Free Cash Flow (TTM)','7.31T VND','4.91T VND','+49.0%','positive'],
];
const summaryItems=[
 ['Profitability','Net margin 15.8% (vs. industry 12.7%)','Good','positive'],
 ['Growth','Revenue CAGR (3Y) 13.2%','Good','positive'],
 ['Valuation','Forward P/E 12.27× (vs. industry 16.8×)','Attractive','positive'],
 ['Dividends','Dividend yield 2.9%','Stable','neutral'],
 ['Financial Health','Debt / Equity 0.42 (vs. industry 0.68)','Healthy','positive'],
];
const navSections=[
 ['Overview','ir-summary'],['Valuation','ir-valuation'],['Financials','ir-financials'],
 ['Comparison','ir-comparison'],['News & Analysis','ir-health'],['Event Probability','ir-recommendation'],
];

function ValuationChart(){
 const values=[67800,71200,65400,69800,58700],current=62100,max=100000;
 const top=26,bottom=190,left=55,right=770,barW=34,gap=23,groupW=(right-left)/values.length;
 const y=value=>bottom-(value/max)*(bottom-top);
 return <svg className="ir-comparison-chart" viewBox="0 0 820 235" role="img" aria-label="Illustrative FPT current price and valuation model comparison in Vietnamese dong">
  {[0,20000,40000,60000,80000,100000].map(value=><g key={value}><line x1={left} x2={right} y1={y(value)} y2={y(value)} className="ir-chart-grid"/><text x={left-9} y={y(value)+4} textAnchor="end" className="ir-chart-axis">{value===0?'0':`${value/1000}k`}</text></g>)}
  {values.map((value,index)=>{const center=left+groupW*(index+.5),currentY=y(current),valueY=y(value);return <g key={valuationModels[index].name}><rect x={center-gap/2-barW} y={valueY} width={barW} height={bottom-valueY} rx="5" className="ir-chart-bar-target"/><rect x={center+gap/2} y={currentY} width={barW} height={bottom-currentY} rx="5" className="ir-chart-bar-current"/><text x={center-gap/2-barW/2} y={valueY-7} textAnchor="middle" className="ir-chart-value">{(value/1000).toFixed(1)}k</text><text x={center+gap/2+barW/2} y={currentY-7} textAnchor="middle" className="ir-chart-value">62.1k</text><text x={center} y={bottom+21} textAnchor="middle" className="ir-chart-model-label">{valuationModels[index].name}</text></g>})}
 </svg>;
}
function ValueModelCard({model,onDetails,t}){
 return <article className="ir-model-card">
  <header><span className="ir-model-icon" aria-hidden="true">{model.name==='DCF'?'D':model.name==='P/E'?'P/E':model.name==='DDM'?'◉':model.name==='Gordon'?'G':'▣'}</span><div><h4>{t(model.name)}</h4><p>{t(model.full)}</p></div><button type="button" onClick={()=>onDetails(model)}>{t('View details')} <span aria-hidden="true">→</span></button></header>
  <div className="ir-model-value"><strong>{model.value}</strong><span>VND</span>{model.badge&&<em>{t(model.badge)}</em>}</div>
  <span className={'ir-model-change '+model.tone}>{model.change}</span>
  <dl>{model.drivers.map(([label,value])=><div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}</dl>
 </article>;
}

export default function InvestmentResearch({storageKey='pasion'}){
 const {t}=usePreferences();
 const [activeSection,setActiveSection]=useState('Valuation');
 const [detail,setDetail]=useState(null);
 const [saved,setSaved]=useState(()=>{try{return localStorage.getItem(storageKey+'-fpt-research-saved')==='true'}catch{return false}});
 function saveResearch(){setSaved(value=>{const next=!value;try{localStorage.setItem(storageKey+'-fpt-research-saved',String(next))}catch{}return next})}
 function jumpTo([label,id]){setActiveSection(label);document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'})}
 return <div className="investment-research">
  <header className="ir-page-heading"><div><span className="eyebrow">{t('COMPANY VALUATION')}</span><h1>{t('Investment Research')}</h1><p>{t('Assess company value, financial strength, and the factors behind an investment decision.')}</p></div></header>
  <section className="ir-company-card" id="ir-summary" aria-label={t('FPT company snapshot')}>
   <div className="ir-company-overview">
    <div className="ir-company-identity"><span className="ir-company-logo" aria-hidden="true">FPT</span><div><h1>FPT Corporation</h1><div className="ir-company-tags"><b>FPT</b><b>VN</b><span aria-hidden="true">☆</span></div><p>{t('Information Technology')} <i/> {t('Vietnam')}</p></div></div>
    <div className="ir-quote"><strong>62,100 <small>VND</small></strong><span>↑ 1,200 (+1.97%)</span><em>{t('Sample market data')}</em></div>
    <div className="ir-company-stat"><span>{t('Market Cap')}</span><strong>116.37T VND</strong></div>
    <div className="ir-company-stat"><span>{t('P/E (trailing)')}</span><strong>12.27×</strong></div>
    <div className="ir-company-stat"><span>{t('P/B')}</span><strong>2.65×</strong></div>
    <div className="ir-company-stat"><span>{t('Dividend Yield')}</span><strong>2.9%</strong></div>
    <button type="button" className={'ir-watch-button '+(saved?'is-saved':'')} aria-pressed={saved} onClick={saveResearch}><span aria-hidden="true">{saved?'✓':'☆'}</span>{t(saved?'Saved to research list':'Save research')}</button>
   </div>
   <nav className="ir-tabs" aria-label={t('Investment research sections')}>
    {navSections.map(item=><button type="button" key={item[0]} aria-pressed={activeSection===item[0]} className={activeSection===item[0]?'is-active':''} onClick={()=>jumpTo(item)}>{t(item[0])}</button>)}
   </nav>
   <div className="ir-disclosure"><span className="ir-disclosure-dot"/>{t('Illustrative research snapshot · May 28, 2026 · Not investment advice')}</div>
  </section>

  <section className="ir-top-grid" id="ir-valuation">
   <article className="ir-card ir-valuation-summary"><header className="ir-section-heading"><span className="ir-heading-icon" aria-hidden="true">◈</span><div><h2>{t('Valuation Summary')}</h2><p>{t('Multiple models indicate a range of illustrative fair values for FPT.')}</p></div></header>
    <div className="ir-valuation-highlight"><span>{t('Estimated Fair Value')}</span><div className="ir-fair-value"><strong>67,800</strong><small>VND</small><b>↑ +9.2%</b></div><p>{t('Compared with sample price')} <strong>62,100 VND</strong></p><small className="ir-range-caption">{t('Illustrative model consensus')}</small></div>
    <div className="ir-recommendation-box"><span>{t('Model signal')}</span><strong className="ir-buy-label">{t('BUY')}</strong><dl><div><dt>{t('Target Price Range')}</dt><dd>64,000 – 72,500 VND</dd></div><div><dt>{t('Suggested Holding Period')}</dt><dd>12 – 36 {t('months')}</dd></div></dl></div>
   </article>
   <article className="ir-card ir-chart-card" id="ir-comparison"><header className="ir-section-heading"><div><h2>{t('Valuation Comparison')}</h2><p>{t('Model estimate compared with the sample market price')}</p></div><div className="ir-chart-legend"><span><i className="is-current"/>{t('Current Price')}</span><span><i className="is-target"/>{t('Target Price')}</span></div></header><ValuationChart/></article>
  </section>

  <section className="ir-model-section">
   <header className="ir-section-heading ir-section-title"><span className="ir-heading-icon" aria-hidden="true">◫</span><div><h2>{t('Valuation Models')}</h2><p>{t('Five complementary methods, using illustrative assumptions')}</p></div><span className="ir-model-count">{t('5 models')}</span></header>
   <div className="ir-model-grid">{valuationModels.map(model=><ValueModelCard key={model.name} model={model} onDetails={setDetail} t={t}/>)}</div>
  </section>

  <section className="ir-bottom-grid">
   <article className="ir-card ir-financial-card" id="ir-financials"><header className="ir-section-heading"><span className="ir-heading-icon" aria-hidden="true">▤</span><div><h2>{t('Key Financial Indicators')}</h2><p>{t('Core sample metrics compared with illustrative industry averages')}</p></div></header>
    <div className="ir-table-scroll"><table className="ir-financial-table"><thead><tr><th>{t('Metric')}</th><th>{t('Value')}</th><th>{t('Industry Avg.')}</th><th>{t('vs. Industry')}</th></tr></thead><tbody>{financialRows.map(([metric,value,average,delta,tone])=><tr key={metric}><th scope="row">{t(metric)}</th><td>{value}</td><td>{average}</td><td className={tone}>{delta}</td></tr>)}</tbody></table></div>
   </article>
   <article className="ir-card ir-health-card" id="ir-health"><header className="ir-section-heading"><span className="ir-heading-icon" aria-hidden="true">◉</span><div><h2>{t('Financial Health Assessment')}</h2><p>{t('Balanced strength across key sample checks')}</p></div><span className="ir-health-state">● {t('Healthy')} <b>→</b></span></header>
    <div className="ir-health-content"><div className="ir-health-gauge" role="meter" aria-label={t('Illustrative financial health score')} aria-valuemin="0" aria-valuemax="100" aria-valuenow="82"><div><strong>82<small> / 100</small></strong><span>{t('Overall Score')}</span></div></div><ul className="ir-health-checks">{['Stable revenue growth','Healthy profit margin','Manageable debt level','Strong cash flow','Good liquidity'].map(text=><li key={text}><span>✓</span>{t(text)}</li>)}</ul></div>
    <aside className="ir-key-insight"><span aria-hidden="true">♧</span><div><strong>{t('Key Insight')}</strong><p>{t('The sample profile combines steady growth, healthy margins, and positive free cash flow. Compare the assumptions with current company filings before drawing conclusions.')}</p></div></aside>
   </article>
   <article className="ir-card ir-summary-card"><header className="ir-section-heading"><span className="ir-heading-icon" aria-hidden="true">✥</span><div><h2>{t('Summary')}</h2><p>{t('Key metrics and research context')}</p></div></header>
    <div className="ir-summary-list">{summaryItems.map(([title,description,status,tone])=><div className="ir-summary-row" key={title}><span className="ir-summary-icon" aria-hidden="true">{title==='Profitability'?'◉':title==='Growth'?'↗':title==='Valuation'?'▣':title==='Dividends'?'♧':'⬡'}</span><div><strong>{t(title)}</strong><p>{t(description)}</p></div><span className={'ir-summary-status '+tone}>{t(status)}</span></div>)}</div>
   </article>
  </section>

  <section className="ir-final-recommendation" id="ir-recommendation"><span className="ir-heading-icon" aria-hidden="true">◈</span><div><h2>{t('Final Recommendation')}</h2><p>{t('The illustrative model combines sample fundamentals, valuation assumptions, and growth estimates. Treat the indicated price range and holding period as research examples, not a personalized recommendation.')}</p><small>{t('Sample target range: 64,000 – 72,500 VND · Example horizon: 12 – 36 months')}</small></div><button type="button" onClick={()=>setDetail({name:'Research report',full:'FPT valuation and financial assessment',value:'67,800',drivers:[['Sample price','62,100 VND'],['Illustrative fair value','67,800 VND'],['Target range','64,000 – 72,500 VND'],['Snapshot date','May 28, 2026']]})}>{t('View detailed report')} <span aria-hidden="true">→</span></button></section>
  <footer className="ir-page-footnote">{t('All market figures, peer averages, financial indicators, model outputs, and recommendations on this page are illustrative sample data. No live market feed or verified research report is connected.')}</footer>

  {detail&&<Dialog title={t(detail.full||detail.name)} onClose={()=>setDetail(null)} className="ir-detail-dialog"><p className="ir-detail-description">{t('Illustrative FPT research snapshot · inputs shown for demonstration only.')}</p>{detail.drivers&&<dl>{detail.drivers.map(([label,value])=><div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}</dl>}<p>{t('Model values are sensitive to growth, discount rates, financial statement quality, and market conditions. Review source documents and update the assumptions before using this analysis.')}</p><button type="button" className="ir-dialog-close" onClick={()=>setDetail(null)}>{t('Close')}</button></Dialog>}
 </div>;
}
