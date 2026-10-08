import React, {useEffect, useId, useMemo, useRef, useState} from 'react';
import Dialog from './Dialog';
import PriceChart from './PriceChart';
import {articles, companies, money, percent} from './marketData';
import {usePreferences} from './Preferences';
import {getCompanyResearch, researchTabs} from './companyResearchData';
import {companyOverviewIndicators} from './companyOverviewIndicators';
import './company-research.scss';


const industryDetails={Technology:'Semiconductors, software, and digital infrastructure.',Financials:'Banking, payments, and financial services.',Healthcare:'Medical products, pharmaceuticals, and healthcare services.',Energy:'Energy production, refining, and services.',Consumer:'Retail, mobility, and consumer products.'};
const inputPrices={
 Technology:[['Silicon wafers','$628.00 / wafer','+1.2%','High'],['Copper','$9,842 / ton','+0.6%','Medium'],['Rare earth metals','$138,000 / ton','-0.8%','High'],['Electricity','$0.12 / kWh','+0.5%','Medium']],
 Consumer:[['Crude oil','$78.40 / barrel','-0.4%','Medium'],['Aluminum','$2,678 / ton','+0.3%','Low'],['Freight index','1,842 points','+1.1%','Medium'],['Electricity','$0.12 / kWh','+0.5%','Low']],
 Financials:[['10Y Treasury yield','4.12%','-0.06%','High'],['Credit spreads','1.18%','+0.03%','Medium'],['Cloud services','$0.09 / unit','+0.7%','Low'],['Labor costs','+3.4% YoY','+0.2%','Medium']],
 Healthcare:[['Active ingredients','$84.20 / kg','+0.8%','High'],['Medical resin','$1.42 / kg','+0.3%','Medium'],['Cold-chain freight','2,145 points','+0.6%','Medium'],['Electricity','$0.12 / kWh','+0.5%','Low']],
 Energy:[['WTI crude','$78.40 / barrel','-0.4%','High'],['Natural gas','$2.84 / MMBtu','+1.6%','High'],['Steel','$721 / ton','+0.2%','Medium'],['Carbon credits','$62.10 / ton','-0.3%','Medium']],
};

const descriptions = {
  'Financial strength': 'Balance sheet resilience, liquidity, and debt coverage.',
  Growth: 'Changes in revenue, earnings, and operating performance.',
  Profitability: 'Margins and returns on the capital employed by the business.',
  Valuation: 'Market multiples and per-share indicators from the sample snapshot.',
  'Cash flow': 'Cash generation, investment spending, and shareholder returns.',
  Peers: 'Compare the company with the available sample sector peers.',
};

// Charts render the same numeric sample scenarios as the accompanying tables.
function ResearchChart({kind, research, company}) {
  const canvas = useRef(null);
  const {t, theme} = usePreferences();
  useEffect(() => {
    const element = canvas.current;
    const draw = () => {
      const width = element.clientWidth, height = element.clientHeight;
      if (!width || !height) return;
      const density = window.devicePixelRatio || 1;
      element.width = width * density; element.height = height * density;
      const ctx = element.getContext('2d');
      ctx.scale(density, density);
      const style = getComputedStyle(element);
      const muted = style.getPropertyValue('--pref-muted').trim();
      const border = style.getPropertyValue('--pref-border').trim();
      const soft = style.getPropertyValue('--pref-soft').trim();
      const blue = theme === 'dark' ? '#67b9ff' : '#2779d8';
      const left = 38, top = 17, bottom = height - 34, right = width - 12;
      const plotWidth = right - left, plotHeight = bottom - top;
      ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = muted;
      if (kind === 'peers') {
        const maxPe = Math.ceil(Math.max(40, ...research.peerPositions.map(peer => peer.pe)) / 10) * 10;
        const maxRoe = Math.ceil(Math.max(30, ...research.peerPositions.map(peer => peer.roe)) / 10) * 10;
        ctx.fillStyle = soft; ctx.fillRect(left, top, plotWidth / 2, plotHeight / 2);
        ctx.fillRect(left + plotWidth / 2, top + plotHeight / 2, plotWidth / 2, plotHeight / 2);
        for (let i = 0; i <= 4; i++) {
          const x = left + plotWidth * i / 4, y = bottom - plotHeight * i / 4;
          ctx.strokeStyle = border; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
          ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.fillText(String(maxPe * i / 4), x, bottom + 15);
          ctx.textAlign = 'right'; ctx.fillText(String(maxRoe * i / 4), left - 7, y + 3);
        }
        ctx.font = '9px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = muted;
        ctx.fillText(t('High ROE · Low P/E'), left + 6, top + 12);
        ctx.textAlign = 'right'; ctx.fillText(t('High ROE · High P/E'), right - 6, top + 12);
        research.peerPositions.forEach(peer => {
          const x = left + peer.pe / maxPe * plotWidth, y = bottom - peer.roe / maxRoe * plotHeight;
          ctx.fillStyle = peer.isSelected ? blue : theme === 'dark' ? '#7995b0' : '#aec9e7';
          ctx.beginPath(); ctx.arc(x, y, peer.isSelected ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
          if (peer.isSelected) {ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(peer.ticker, Math.max(left + 18, Math.min(right - 18, x)), y - 10);}
        });
        ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = muted; ctx.textAlign = 'center';
        ctx.fillText('P/E (×)', left + plotWidth / 2, height - 3);
        ctx.save(); ctx.translate(11, top + plotHeight / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('ROE (%)', 0, 0); ctx.restore();
      } else {
        const values = [research.revenue, research.operatingCashFlow - research.revenue, research.operatingCashFlow, -research.capitalExpenditure, research.freeCashFlow];
        const labels = ['Revenue', 'Operating costs', 'Operating cash flow', 'Capital expenditures', 'Free cash flow'];
        const max = research.revenue * 1.12;
        const xStep = plotWidth / values.length, barWidth = xStep * .62;
        for (let i = 0; i <= 4; i++) {
          const y = bottom - plotHeight * i / 4;
          ctx.strokeStyle = border; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
          ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.fillText((max * i / 4).toFixed(0), left - 7, y + 3);
        }
        let running = 0;
        values.forEach((value, i) => {
          const total = i === 0 || i === 2 || i === 4;
          const start = total ? 0 : running;
          const end = total ? value : running + value;
          const x = left + xStep * i + (xStep - barWidth) / 2;
          const y = bottom - Math.max(start, end) / max * plotHeight;
          const barHeight = Math.max(2, Math.abs(end - start) / max * plotHeight);
          ctx.fillStyle = total ? (i === 4 ? '#25a58a' : blue) : theme === 'dark' ? '#7891ab' : '#afc1d5';
          ctx.fillRect(x, y, barWidth, barHeight);
          ctx.fillStyle = muted; ctx.textAlign = 'center'; ctx.font = '9px Inter, sans-serif';
          ctx.fillText((value < 0 ? '−' : '') + '$' + Math.abs(value).toFixed(1) + 'B', x + barWidth / 2, Math.max(10, y - 5));
          const words = t(labels[i]).split(' '), middle = Math.ceil(words.length / 2);
          ctx.fillText(words.slice(0, middle).join(' '), x + barWidth / 2, bottom + 13);
          ctx.fillText(words.slice(middle).join(' '), x + barWidth / 2, bottom + 24);
          running = end;
        });
      }
    };
    const observer = new ResizeObserver(draw); observer.observe(element); draw();
    return () => observer.disconnect();
  }, [kind, research, t, theme]);
  const label = kind === 'peers' ? t('{ticker} sample P/E and ROE comparison', {ticker: company.ticker}) : t('{ticker} sample revenue and cash flow bridge', {ticker: company.ticker});
  return <canvas ref={canvas} className="research-chart" role="img" aria-label={label}>{label}</canvas>;
}

function CoreValue({research, onClose}) {
  const {t} = usePreferences();
  const [growth, setGrowth] = useState(String(research.coreValueAssumptions.annualGrowth));
  const [discount, setDiscount] = useState('9');
  const [terminal, setTerminal] = useState('2.5');
  const fields = [growth, discount, terminal].map(value => value.trim() ? Number(value) : NaN);
  const [g, d, terminalRate] = fields.map(value => value / 100);
  const valid = fields.every(Number.isFinite) && g >= -.5 && g <= .5 && d > 0 && d <= .5 && terminalRate >= 0 && terminalRate < d;
  let estimate = 0;
  if (valid) {
    for (let year = 1; year <= 5; year++) estimate += research.freeCashFlow * (1 + g) ** year / (1 + d) ** year;
    estimate += research.freeCashFlow * (1 + g) ** 5 * (1 + terminalRate) / (d - terminalRate) / (1 + d) ** 5;
    estimate = Math.max(0, (estimate + research.cash - research.debt) / research.sharesOutstanding);
  }
  return <section className="research-inline-panel research-calculator" aria-label={t('Core value calculator')}>
    <header><div><h3>{t('Core value calculator')}</h3><p>{t('Explore a five-year discounted cash flow scenario.')}</p></div><button type="button" onClick={onClose}>{t('Close calculator')}</button></header>
    <div className="research-assumptions">{[[t('Revenue growth (%)'), growth, setGrowth], [t('Discount rate (%)'), discount, setDiscount], [t('Terminal growth (%)'), terminal, setTerminal]].map(([label, value, setValue]) => <label key={label}>{label}<input type="number" step="0.5" value={value} onChange={event => setValue(event.target.value)}/></label>)}<div className="research-value"><span>{t('Estimated core value')}</span><output aria-label={t('Estimated core value')} dir="ltr">{valid ? money(estimate) : '—'}</output><small>{t('Per share · USD')}</small></div></div>
    {!valid && <p role="alert">{t('Use growth between −50% and 50%, a discount rate above terminal growth and at most 50%, and non-negative terminal growth.')}</p>}
    <p className="research-disclosure">{t('Illustrative assumptions and sample cash flows. This scenario is not a company valuation or investment recommendation.')}</p>
  </section>;
}

export default function CompanyResearch({company, watchlist, onToggle, onChoose, onExploreIndustry=()=>{}, period, onPeriodChange, onClose}) {
  const {t} = usePreferences();
  const [query, setQuery] = useState(''), [tab, setTab] = useState('Overview');
  const [category, setCategory] = useState('all'), [source, setSource] = useState(null), [calculator, setCalculator] = useState(false), [indicatorQuery,setIndicatorQuery] = useState('');
  const [statementTab, setStatementTab] = useState('Income statement & growth');
  const [following,setFollowing] = useState(false);
  const research = useMemo(() => getCompanyResearch(company), [company]);
  const materials = inputPrices[company.sector] || inputPrices.Technology;
  const prefix = useId();
  const detailPanel = useRef(null), sourceOpener = useRef(null);
  const saved = watchlist.includes(company.ticker);
  const matches = companies.filter(item => (item.ticker + ' ' + item.name).toLowerCase().includes(query.toLowerCase()));
  const categories = companyOverviewIndicators.map(group=>({...group,rows:group.rows.filter(row=>(category==='all'||group.name===category)&&(!indicatorQuery||(row.label+' '+row.value+' '+row.evidence).toLowerCase().includes(indicatorQuery.toLowerCase())))})).filter(group=>group.rows.length);
  const indicatorCount = companyOverviewIndicators.reduce((sum, group) => sum + group.rows.length, 0);
  const rows = tab === 'Overview' ? [] : research.metricsByTab[tab] || [];
  const suppliedRows = companyOverviewIndicators.flatMap(group => group.rows);
  const suppliedMetric = label => suppliedRows.find(row => row.label === label);
  const overviewHighlights = ['Gross revenue','Revenue growth (YoY)','Net income used in analysis','Gross margin','Return on equity']
    .map(suppliedMetric).filter(Boolean);
  const statementTabs = ['Income statement & growth','Capital & efficiency','Cash flow & reinvestment'];
  const statementRows = statementTab === 'Income statement & growth'
    ? ['Gross revenue','Net revenue','Gross profit','Operating profit','EBITDA','Net income used in analysis']
    : statementTab === 'Capital & efficiency'
      ? ['Total assets','Total liabilities','Shareholders’ equity','Current assets','Current liabilities','Total debt']
      : ['Statement operating cash flow','Cash flow margin','Operating cash flow (market)','Free cash flow','Capital expenditure','Free cash flow conversion'];
  const activeStatementRows = statementRows.map(suppliedMetric).filter(Boolean);
  useEffect(() => {setSource(null); setCalculator(false); setCategory('all'); setIndicatorQuery(''); setTab('Overview'); setStatementTab('Income statement & growth'); setFollowing(false);}, [company.ticker]);
  useEffect(() => {if (source || calculator) {detailPanel.current?.scrollIntoView({block: 'nearest'}); detailPanel.current?.focus({preventScroll: true});}}, [source, calculator]);
  function showSource(title, event) {sourceOpener.current = event.currentTarget; setCalculator(false); setSource(title);}
  function closeSource() {setSource(null); requestAnimationFrame(() => sourceOpener.current?.focus());}
  function tabKeydown(event, index) {
    const horizontal = document.documentElement.dir === 'rtl' ? -1 : 1;
    let next;
    if (event.key === 'ArrowRight') next = (index + horizontal + researchTabs.length) % researchTabs.length;
    if (event.key === 'ArrowLeft') next = (index - horizontal + researchTabs.length) % researchTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = researchTabs.length - 1;
    if (next !== undefined) {event.preventDefault(); setTab(researchTabs[next]); document.getElementById(prefix + '-tab-' + next)?.focus();}
  }
  const search = <div className="research-header-search company-overview-search"><label className="company-search"><input value={query} onChange={event => setQuery(event.target.value)} aria-label={t('Find company for overview')} placeholder={t('Find a company or ticker…')} autoComplete="off"/></label>{query && <div className="company-results">{matches.map(item => <button type="button" key={item.ticker} onClick={() => {onChoose(item); setQuery('');}}><strong>{item.ticker}</strong><span>{item.name}</span></button>)}{!matches.length && <p>{t('No matching companies.')}</p>}</div>}</div>;
  const industryPanel = <section className="research-industry-context"><header><span className="context-icon">{ '\u25C8' }</span><div><h3>{t('Industry & sector')}</h3><p>{t(company.sector)}</p></div><span className="research-sector-chip">{t(company.sector)}</span></header><strong>{t(industryDetails[company.sector]||industryDetails.Technology)}</strong><p>{t(company.detail)}</p><button type="button" onClick={()=>onExploreIndustry(company.sector)}>{t('Explore industry factors')} <span aria-hidden="true">{ '\u2192' }</span></button></section>;
  const materialsPanel = <section className="research-material-context"><header><div><span className="context-icon">{ '\u25C9' }</span><div><h3>{t('Materials & input prices')}</h3><p>{t('Illustrative prices that may influence this company or industry.')}</p></div></div><span>{t('Sample data')}</span></header><table><thead><tr><th>{t('Material / input')}</th><th>{t('Price')}</th><th>{t('Change (1D)')}</th><th>{t('Impact')}</th></tr></thead><tbody>{materials.map(([name,price,change,impact])=><tr key={name}><th scope="row">{t(name)}</th><td dir="ltr">{price}</td><td className={change.startsWith('-')?'negative':'positive'} dir="ltr">{change}</td><td><span className={'material-impact impact-'+impact.toLowerCase()}>{t(impact)}</span></td></tr>)}</tbody></table></section>;
  return <Dialog title={t('Company overview · Full research')} fullScreen className="company-dialog company-research-dialog" onClose={onClose} headerActions={<>{search}<span className="research-snapshot"><i/>{t(tab==='Overview'?'Supplied company indicators · VND':'Illustrative research · USD')}</span></>}>
    <div className="company-research">
      <aside className="research-company-rail" aria-label={t('Company summary')}>
        <div className="company-selected"><span className="company-mark">{company.ticker}</span><div><strong>{company.ticker}</strong><small>{t(company.sector)}</small></div></div>
        <span className="research-evidence"><i/>{t('Sample evidence')}</span>
        <div className="research-price"><strong dir="ltr">{money(company.price)}</strong><span>{t('Sample market snapshot')}</span><small className={company.change < 0 ? 'negative' : 'positive'} dir="ltr">{percent(company.change)}</small></div>
        <dl className="research-rail-metrics"><div><dt>{t('Market cap')}</dt><dd dir="ltr">{'$' + company.cap}</dd></div><div><dt>{t('P/E ratio')}</dt><dd>{company.pe}×</dd></div></dl>
        <section className="research-thesis"><h3>{t('Investment thesis')}</h3><p>{t(company.detail)}</p><p>{t('Review the source-linked indicators to build your research judgment.')}</p></section>
        <dl className="research-coverage"><div><dt>{t('Report date')}</dt><dd>{t('Sample dataset')}</dd></div><div><dt>{t('Coverage')}</dt><dd>{t('{count} indicators', {count: indicatorCount})}<span>{t('Complete')}</span></dd></div></dl>
        <button type="button" className="research-primary" onClick={() => {setSource(null); setCalculator(true);}}>{t('Calculate core value')}</button>
        <div className="research-rail-actions"><button type="button" onClick={event => showSource('Full sample report', event)}>{t('View full report')}</button><button type="button" aria-label={t(saved ? 'Remove {ticker} from watchlist from overview' : 'Add {ticker} to watchlist from overview', {ticker: company.ticker})} aria-pressed={saved} onClick={() => onToggle(company)}>{t(saved ? 'Remove from watchlist' : 'Add to watchlist')}</button><button type="button" onClick={event => showSource('Sample methodology', event)}>{t('Research methodology')}</button></div>
        <p className="research-rail-disclosure">{t('Illustrative data. No live market feed or company report is connected.')}</p>
      </aside>
      <main className="research-main">
        <div className="research-tabs" role="tablist" aria-label={t('Research sections')}>{researchTabs.map((name, index) => <button type="button" key={name} role="tab" id={prefix + '-tab-' + index} aria-controls={prefix + '-panel'} aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} onKeyDown={event => tabKeydown(event, index)} onClick={() => setTab(name)}>{t(name)}</button>)}</div>
        {tab!=='Overview'&&<div className="research-company-context">{industryPanel}{materialsPanel}</div>}
        {(source || calculator) && <div ref={detailPanel} tabIndex="-1" className="research-detail-focus">{source ? <section className="research-inline-panel" aria-label={t('Source details')}><header><div><h3>{t('Source details')}</h3><p>{t(source)}</p></div><button type="button" onClick={closeSource}>{t('Close source details')}</button></header><p>{source==='Supplied company overview snapshot'?t('This panel reproduces the supplied VND values and evidence labels.'):t('These figures are generated from the workspace sample dataset, not a published company report. Prior values, peers, and statements are illustrative scenarios.')}</p><dl><div><dt>{t('Company')}</dt><dd>{company.name} ({company.ticker})</dd></div><div><dt>{t('Source')}</dt><dd>{source==='Supplied company overview snapshot'?t('User-supplied snapshot'):t('Sample dataset')}</dd></div><div><dt>{t('Currency')}</dt><dd>{source==='Supplied company overview snapshot'?'VND':'USD'}</dd></div></dl>{source === 'Full sample report' && <div className="research-report-tables">{research.categories.map(group => <section key={group.name}><h4>{t(group.name)}</h4><dl>{group.rows.map(row => <div key={row.label}><dt>{t(row.label)}</dt><dd dir="ltr">{row.value}</dd></div>)}</dl></section>)}</div>}</section> : <CoreValue key={company.ticker} research={research} onClose={() => setCalculator(false)}/>}</div>}
        <div role="tabpanel" id={prefix + '-panel'} aria-labelledby={prefix + '-tab-' + researchTabs.indexOf(tab)} className="research-tab-panel">
          {tab === 'Overview' ? <div className="company-overview-page">
            <section className="company-overview-identity"><div className="overview-company-brand"><span className="company-mark">{company.ticker}</span><div><span className="eyebrow">{t('COMPANY OVERVIEW')}</span><h2>{company.name} <small>({company.ticker})</small></h2><div className="overview-company-tags"><span>{t(company.sector)}</span><span>{t(industryDetails[company.sector]||industryDetails.Technology)}</span></div></div></div><div className="overview-company-price"><strong dir="ltr">{money(company.price)}</strong><span className={company.change<0?'negative':'positive'}>{percent(company.change)} {t('sample change')}</span><small>{t('Illustrative sample price · USD')}</small></div><div className="overview-company-spark"><PriceChart compact company={company} period={period}/></div><div className="overview-company-actions"><button type="button" aria-pressed={saved} onClick={()=>onToggle(company)}>{saved?t('In watchlist'):t('Watchlist')}</button><button type="button" aria-pressed={following} onClick={()=>setFollowing(value=>!value)}>{following?t('Following'):t('Follow')}</button><span className="positive outlook-tag">{t('Positive outlook')}</span></div></section>
            <section className="research-overview-kpis"><header><div><h3>{t('Key Financial Indicators')}</h3><p>{t('Supplied company overview · VND')}</p></div><span>{t('Illustrative sample')}</span></header><div className="overview-highlight-grid">{overviewHighlights.map(row=><article className="overview-highlight" key={row.label}><span>{t(row.label)}</span><strong dir="ltr">{row.value}</strong><small className={'indicator-source source-'+row.evidence.toLowerCase().replaceAll(' ','-')}>{t(row.evidence)}</small></article>)}</div></section>
            <div className="company-overview-dashboard"><div className="company-overview-primary">
              <div className="company-overview-chart-ratios"><section className="research-price-history overview-stock-performance"><header><div><h3>{t('Stock performance')}</h3><span>{t('Illustrative price history · USD')}</span></div><div className="chart-periods" role="group" aria-label={t('Chart period')}>{['1D','1W','1M','3M','1Y'].map(value=><button type="button" key={value} aria-pressed={period===value} className={period===value?'selected':''} onClick={()=>onPeriodChange(value)}>{value}</button>)}</div></header><PriceChart key={company.ticker+'-'+period} company={company} period={period}/><div className="overview-chart-summary"><span><small>{t('Market cap')}</small><strong dir="ltr">{'$'+company.cap}</strong></span><span><small>{t('Average volume (10D)')}</small><strong dir="ltr">2,937,300</strong></span><span><small>{t('P/E ratio')}</small><strong>{company.pe}×</strong></span><span><small>{t('52-week range')}</small><strong dir="ltr">{money(company.price*.78)} — {money(company.price*1.18)}</strong></span></div></section>
                <section className="overview-key-ratios"><header><h3>{t('Key ratios')}</h3><span>{t('VND snapshot')}</span></header><div className="overview-ratio-grid">{['Gross margin','Operating margin','Return on equity','Current ratio','Debt / equity','Net debt / EBITDA'].map(label=>{const row=suppliedMetric(label);return row&&<article key={label}><span>{t(label)}</span><strong dir="ltr">{row.value}</strong><small className={'indicator-source source-'+row.evidence.toLowerCase().replaceAll(' ','-')}>{t(row.evidence)}</small></article>})}</div></section></div>
              <div className="company-overview-lower-grid"><section className="overview-statements"><header><div><h3>{t('Financial statements overview')}</h3><p>{t('Key values from the supplied VND snapshot.')}</p></div><button type="button" onClick={()=>document.getElementById('company-overview-indicators')?.scrollIntoView({behavior:'smooth',block:'start'})}>{t('View full report')} <span aria-hidden="true">→</span></button></header><div className="statement-tabs" role="tablist" aria-label={t('Financial statement')} >{statementTabs.map(name=><button type="button" key={name} role="tab" aria-selected={statementTab===name} onClick={()=>setStatementTab(name)}>{t(name==='Income statement & growth'?'Income statement':name==='Capital & efficiency'?'Balance sheet':'Cash flow')}</button>)}</div><table><thead><tr><th>{t('Item')}</th><th>{t('Value')}</th><th>{t('Evidence')}</th></tr></thead><tbody>{activeStatementRows.map(row=><tr key={row.label}><th scope="row">{t(row.label)}</th><td dir="ltr">{row.value}</td><td><span className={'indicator-evidence '+(row.evidence==='Verified report'?'is-verified':row.evidence==='Derived'?'is-derived':'is-market')}>{t(row.evidence)}</span></td></tr>)}</tbody></table></section>
                <section className="overview-recent-news"><header><div><h3>{t('Recent news & insights')}</h3><p>{t('Illustrative workspace stories')}</p></div><span>{t('Sample')}</span></header>{articles.slice(0,3).map(article=><article key={article.id}><span className="news-dot"/><div><strong>{t(article.title)}</strong><p>{t(article.summary)}</p><small>{t(article.category)} · {t(article.time)}</small></div><span className="news-sentiment">{t('Context')}</span></article>)}</section></div>
            </div><aside className="company-overview-aside">{industryPanel}{materialsPanel}<section className="overview-takeaways"><header><h3>{t('Key takeaways')}</h3><span>✧</span></header><ul><li><b>✓</b><span>{t('Revenue growth (YoY)')} <strong>16.4%</strong> {t('supports the current profile.')}</span></li><li><b>✓</b><span>{t('Gross margin')} <strong>31.0%</strong> · {t('Operating margin')} <strong>20.9%</strong></span></li><li className="takeaway-risk"><b>!</b><span>{t('Statement operating cash flow')} <strong>−1.14T VND</strong>; {t('review cash conversion.')}</span></li></ul><p>{t('VND figures and evidence classifications are reproduced from the supplied snapshot.')}</p></section></aside></div>
            <section className="research-indicators supplied-indicators" id="company-overview-indicators" aria-label={t('Company overview indicators')}>
              <header className="supplied-indicators-header"><div><span className="eyebrow">{t('COMPANY OVERVIEW')}</span><h3>{t('All company indicators')}</h3><p>{t('Supplied VND snapshot · evidence labels retained from your brief.')}</p></div><div className="research-indicator-actions"><input type="search" value={indicatorQuery} onChange={event=>setIndicatorQuery(event.target.value)} placeholder={t('Search indicators')} aria-label={t('Search indicators')}/><select aria-label={t('Indicator category')} value={category} onChange={event => setCategory(event.target.value)}><option value="all">{t('All categories')}</option>{companyOverviewIndicators.map(group => <option value={group.name} key={group.name}>{t(group.name)}</option>)}</select><button type="button" onClick={event => showSource('Supplied company overview snapshot', event)}>{t('Evidence notes')}</button></div></header>
              <div className="research-indicator-section-heading"><h4>{t('Financial details')}</h4><span>{t('{count} indicators across six sections',{count:indicatorCount})}</span></div>
              <div className="research-indicator-grid">{categories.map(group => <section className="research-indicator-group" key={group.name}><h4>{t(group.name)}</h4><table><thead><tr><th>{t('Indicator')}</th><th>{t('Value')}</th><th>{t('Evidence')}</th></tr></thead><tbody>{group.rows.map(row => <tr key={row.label}><th scope="row">{t(row.label)}</th><td dir="ltr">{row.value}</td><td><span className={'indicator-evidence '+(row.evidence==='Verified report'?'is-verified':row.evidence==='Derived'?'is-derived':'is-market')}>{t(row.evidence)}</span></td></tr>)}</tbody></table></section>)}</div>
              {!categories.length&&<p className="research-indicator-empty">{t('No indicators match your search.')}</p>}
            </section>
          </div> : <>
            <div className="research-top-grid">
              <section className="research-metric-card"><header><h3>{t(tab)}</h3><p>{t(descriptions[tab])}</p></header><div className="research-table-scroll"><table className="research-metric-table"><thead><tr>{['Metric', 'Current', 'Prior', 'Trend', 'Peer median', 'Evidence'].map(label => <th key={label} scope="col">{t(label)}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row"><strong>{t(row.label)}</strong><small>{t(row.note)}</small></th><td dir="ltr">{row.value}</td><td dir="ltr">{row.prior}</td><td><span className="research-trend" aria-label={t('Compare current and prior values')}>—</span></td><td dir="ltr">{row.peer === 'Unavailable' ? t('Unavailable') : row.peer}</td><td><button type="button" onClick={event => showSource(row.label, event)}>{t(row.evidence)}</button></td></tr>)}</tbody></table></div></section>
              <div className="research-supporting-charts"><section className="research-chart-card"><h3>{t('Peer position (P/E vs ROE)')}</h3><ResearchChart kind="peers" research={research} company={company}/>{!research.peerCount && <small>{t('No additional sector peers in the sample dataset.')}</small>}</section><section className="research-chart-card"><h3>{t('Revenue to free cash flow bridge')}</h3><ResearchChart kind="cash" research={research} company={company}/></section></div>
            </div>
            {tab === 'Peers' && <section className="research-peer-list"><h3>{t('Sample sector peers')}</h3><p>{t('Select a peer to open its research.')}</p>{research.peerPositions.filter(peer => !peer.isSelected).map(peer => <button type="button" key={peer.ticker} onClick={() => onChoose(companies.find(item => item.ticker === peer.ticker))}><strong>{peer.ticker}</strong><span>{peer.name}</span><span>P/E {peer.pe.toFixed(1)}×</span><span>ROE {peer.roe.toFixed(1)}%</span></button>)}{!research.peerCount && <p>{t('No additional sector peers in the sample dataset.')}</p>}</section>}
          </>}
        </div>
        {tab === 'Financial strength' && <section className="research-price-history"><header><h3>{t('Price history')}</h3><span>{t('Illustrative price history · USD')}</span></header><PriceChart key={company.ticker + '-' + period} company={company} period={period}/><div className="chart-periods" role="group" aria-label={t('Chart period')}>{['1D', '1W', '1M', '1Y'].map(value => <button type="button" key={value} aria-pressed={period === value} className={period === value ? 'selected' : ''} onClick={() => onPeriodChange(value)}>{value}</button>)}</div></section>}
      </main>
    </div>
  </Dialog>;
}
