import React,{useState} from 'react';
import {usePreferences} from './Preferences';
import './macro-regime.scss';

const series=(seed,count=34)=>Array.from({length:count},(_,i)=>Math.max(8,Math.min(92,46+i*(seed%2 ? .72 : .48)+Math.sin((i+seed)*.36)*5+Math.sin((i+seed)*.13)*8)));
const periods={'1M':['Sep 9','Sep 16','Sep 23','Sep 30','Oct 7'],'3M':['Jul','Aug','Sep','Oct'],'6M':['May','Jun','Jul','Aug','Sep','Oct'],'1Y':['Nov','Jan','Mar','May','Jul','Sep','Oct'],'5Y':['2022','2023','2024','2025','2026']};
const marketTabs=['Stock Market','Bond Yield','Interest Rate','Inflation (CPI)','FX','Commodities'];
const globalMetrics=[['Global Unemployment Rate','5.2%','-0.1%'],['Global 10Y Bond Yield','4.3%','-0.2%'],['Global Stock Market (MSCI)','3,860','+1.4%'],['Global Interest Rate (Policy)','4.8%','0.0%'],['Gold Price (USD/oz)','2,634','+1.7%'],['Brent Oil Price (USD/bbl)','78.2','-0.8%']];
const scopes={
 europe:{name:'Europe',metrics:[['Unemployment Rate','6.1%','-0.3%'],['10Y Government Bond Yield','2.8%','+0.2%'],['GDP Growth (YoY)','1.2%','+0.1%']],factors:[['Inflation (CPI YoY)','2.4%','-0.2%','▤'],['ECB Interest Rate','2.5%','0.0%','⌂'],['EUR/USD','1.08','+0.3%','⇄'],['Industrial Production','0.7%','+0.2%','▥'],['Consumer Confidence','-6.8','+1.5','▣']]},
 americas:{name:'Americas',metrics:[['Unemployment Rate','4.1%','-0.1%'],['10Y Government Bond Yield','4.2%','+0.1%'],['GDP Growth (YoY)','2.4%','+0.2%']],factors:[['Inflation (CPI YoY)','3.1%','-0.1%','▤'],['Policy Interest Rate','4.75%','0.0%','⌂'],['US Dollar Index','104.2','+0.4%','＄'],['Industrial Production','1.1%','+0.2%','▥'],['Consumer Confidence','98.4','+1.2','▣']]},
 asia:{name:'Asia-Pacific',metrics:[['Unemployment Rate','4.7%','-0.2%'],['10Y Government Bond Yield','3.2%','+0.1%'],['GDP Growth (YoY)','4.1%','+0.3%']],factors:[['Inflation (CPI YoY)','2.8%','-0.1%','▤'],['Policy Interest Rate','3.6%','0.0%','⌂'],['Regional FX Basket','102.4','+0.2%','⇄'],['Industrial Production','3.2%','+0.4%','▥'],['Consumer Confidence','101.6','+1.1','▣']]},
};
const countries={
 vietnam:{name:'Vietnam',metrics:[['Unemployment Rate','2.2%','-0.1%'],['GDP Growth (YoY)','6.8%','+0.2%'],['10Y Government Bond Yield','4.6%','+0.1%']],factors:[['CPI (YoY)','3.6%','+0.2%','▤'],['USD/VND','25,450','+0.3%','＄'],['Interest Rate (SBV)','4.5%','0.0%','⌂'],['Trade Balance (USD)','4.88B','+12.5%','⇄'],['FDI (YTD, USD)','18.2B','+7.3%','▥']],charts:[['VN-Index','1,286.45','+1.5%',4],['10Y Government Bond Yield','2.9%','+0.1%',7],['USD/VND','25,450','+0.3%',10]]},
 unitedStates:{name:'United States',metrics:[['Unemployment Rate','4.1%','-0.1%'],['GDP Growth (YoY)','2.4%','+0.2%'],['10Y Government Bond Yield','4.3%','-0.2%']],factors:[['CPI (YoY)','2.9%','-0.3%','▤'],['Federal Funds Rate','4.75%','0.0%','⌂'],['10Y Treasury Yield','4.3%','-0.2%','⌁'],['Trade Balance (USD)','-78.8B','+2.1%','⇄'],['Industrial Production','0.8%','+0.2%','▥']],charts:[['S&P 500','5,996.76','+1.1%',3],['10Y Treasury Yield','4.3%','-0.2%',6],['US Dollar Index','104.2','+0.4%',9]]},
 japan:{name:'Japan',metrics:[['Unemployment Rate','2.5%','0.0%'],['GDP Growth (YoY)','1.1%','+0.1%'],['10Y Government Bond Yield','1.1%','+0.1%']],factors:[['CPI (YoY)','2.8%','-0.1%','▤'],['Policy Interest Rate','0.5%','+0.1%','⌂'],['USD/JPY','149.8','+0.3%','⇄'],['Industrial Production','1.2%','+0.4%','▥'],['Trade Balance (USD)','-3.4B','+8.2%','⇄']],charts:[['Nikkei 225','38,920.26','+1.2%',5],['10Y Government Bond Yield','1.1%','+0.1%',8],['USD/JPY','149.8','+0.2%',11]]},
};
const chartSets={
 'Stock Market':[['Regional Index','3,860','+1.4%',3],['Large-cap Index','5,996.76','+1.1%',5],['Market Breadth','62%','+3.2%',9]],
 'Bond Yield':[['10Y Government Bond Yield','4.3%','-0.2%',7],['2Y Government Bond Yield','3.9%','-0.1%',4],['Yield Curve Spread','+0.4 pp','+0.1 pp',9]],
 'Interest Rate':[['Policy Rate','4.8%','0.0%',3],['Real Policy Rate','+1.9%','+0.2 pp',6],['Rate Expectations','4.2%','-0.1 pp',10]],
 'Inflation (CPI)':[['Headline CPI (YoY)','2.9%','-0.3%',6],['Core CPI (YoY)','3.1%','-0.1%',3],['Producer Prices','2.4%','+0.2%',8]],
 FX:[['US Dollar Index','104.2','+0.4%',4],['EUR/USD','1.08','+0.3%',8],['USD/JPY','149.8','+0.2%',11]],
 Commodities:[['Gold (USD/oz)','2,634','+1.7%',5],['Brent Oil (USD/bbl)','78.2','-0.8%',8],['Copper (USD/tonne)','9,812','+0.6%',2]],
};
const regionalCharts={
 europe:{'Stock Market':[['Euro Stoxx 50','4,850','+1.2%',4],['10Y Germany Bond Yield','2.5%','+0.1%',7],['EUR/USD','1.08','+0.3%',10]],'Bond Yield':[['10Y Germany Bond Yield','2.5%','+0.1%',7],['10Y France Bond Yield','3.1%','+0.1%',5],['Euro yield spread','0.6 pp','0.0 pp',9]],'Interest Rate':[['ECB Deposit Rate','2.5%','0.0%',4],['ECB Main Refinancing Rate','2.65%','0.0%',8],['Market rate outlook','2.4%','-0.1 pp',10]],'Inflation (CPI)':[['Euro Area CPI (YoY)','2.4%','-0.2%',6],['Core Inflation (YoY)','2.8%','-0.1%',3],['Producer Prices','1.9%','+0.1%',8]],FX:[['EUR/USD','1.08','+0.3%',8],['GBP/EUR','1.18','+0.2%',4],['Euro Trade-Weighted Index','105.6','+0.1%',10]]},
 americas:{'Stock Market':[['S&P 500','5,996.76','+1.1%',3],['Dow Jones','42,732.13','+0.8%',6],['NASDAQ Composite','19,386.07','-0.6%',9]],'Bond Yield':[['10Y US Treasury Yield','4.3%','-0.2%',7],['2Y US Treasury Yield','3.9%','-0.1%',4],['US yield curve spread','+0.4 pp','+0.1 pp',9]],'Interest Rate':[['Federal Funds Rate','4.75%','0.0%',3],['Real Policy Rate','+1.9%','+0.2 pp',6],['Rate expectations','4.2%','-0.1 pp',10]],'Inflation (CPI)':[['US CPI (YoY)','2.9%','-0.3%',6],['Core CPI (YoY)','3.1%','-0.1%',3],['Producer Prices','2.4%','+0.2%',8]],FX:[['US Dollar Index','104.2','+0.4%',4],['USD/CAD','1.36','+0.2%',8],['USD/MXN','17.2','-0.1%',11]]},
 asia:{'Stock Market':[['Nikkei 225','38,920.26','+1.2%',5],['Shanghai Composite','3,120.4','+0.8%',8],['Hang Seng','18,412.28','-1.0%',11]],'Bond Yield':[['10Y Japan Government Bond','1.1%','+0.1%',7],['10Y China Government Bond','2.3%','0.0%',4],['Regional yield spread','1.2 pp','+0.1 pp',9]],'Interest Rate':[['Bank of Japan Rate','0.5%','+0.1%',3],['China Policy Rate','3.0%','0.0%',6],['Regional rate outlook','3.4%','-0.1 pp',10]],'Inflation (CPI)':[['Asia-Pacific CPI (YoY)','2.8%','-0.1%',6],['Core Inflation (YoY)','2.6%','0.0%',3],['Producer Prices','1.8%','+0.2%',8]],FX:[['USD/JPY','149.8','+0.2%',4],['USD/CNY','7.12','+0.1%',8],['Asia FX Basket','102.4','+0.2%',11]]},
};
const countryThematicCharts={
 vietnam:{'Bond Yield':[['10Y Vietnam Bond Yield','2.9%','+0.1%',7],['5Y Vietnam Bond Yield','2.4%','+0.1%',4],['Local yield spread','0.5 pp','0.0 pp',9]],'Interest Rate':[['SBV Policy Rate','4.5%','0.0%',3],['Refinancing Rate','4.5%','0.0%',6],['Rate outlook','4.4%','-0.1 pp',10]],'Inflation (CPI)':[['Vietnam CPI (YoY)','3.6%','+0.2%',6],['Core CPI (YoY)','2.7%','+0.1%',3],['Producer Prices','1.8%','+0.1%',8]],FX:[['USD/VND','25,450','+0.3%',4],['EUR/VND','27,880','+0.2%',8],['Asia FX Basket','102.4','+0.2%',11]]},
 unitedStates:{'Bond Yield':[['10Y US Treasury Yield','4.3%','-0.2%',7],['2Y US Treasury Yield','3.9%','-0.1%',4],['Treasury yield spread','+0.4 pp','+0.1 pp',9]],'Interest Rate':[['Federal Funds Rate','4.75%','0.0%',3],['Real Policy Rate','+1.9%','+0.2 pp',6],['Rate expectations','4.2%','-0.1 pp',10]],'Inflation (CPI)':[['US CPI (YoY)','2.9%','-0.3%',6],['Core CPI (YoY)','3.1%','-0.1%',3],['Producer Prices','2.4%','+0.2%',8]],FX:[['US Dollar Index','104.2','+0.4%',4],['EUR/USD','1.08','+0.3%',8],['USD/JPY','149.8','+0.2%',11]]},
 japan:{'Bond Yield':[['10Y Japan Government Bond','1.1%','+0.1%',7],['5Y Japan Government Bond','0.7%','0.0%',4],['Local yield spread','0.4 pp','+0.1 pp',9]],'Interest Rate':[['Bank of Japan Rate','0.5%','+0.1%',3],['Overnight Call Rate','0.5%','+0.1%',6],['Rate outlook','0.6%','+0.1 pp',10]],'Inflation (CPI)':[['Japan CPI (YoY)','2.8%','-0.1%',6],['Core CPI (YoY)','2.5%','0.0%',3],['Producer Prices','2.1%','+0.2%',8]],FX:[['USD/JPY','149.8','+0.3%',4],['EUR/JPY','161.7','+0.2%',8],['Yen Index','95.2','-0.1%',11]]},
};
const trendLines=[['Global equities','#2468f2',7],['Bond yields','#8155e8',5],['Commodities','#f39200',9]];

const macroIconPaths={
 globe:['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20','M2 12h20','M12 2c-2.8 2.8-4 6.1-4 10s1.2 7.2 4 10','M12 2c2.8 2.8 4 6.1 4 10s-1.2 7.2-4 10'],
 continent:['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20','M2 12h20','M12 2c-2.8 2.8-4 6.1-4 10s1.2 7.2 4 10','M12 2c2.8 2.8 4 6.1 4 10s-1.2 7.2-4 10','m7 7 2 1-1 2 2 1-1 2'],
 pin:['M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0','M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6'],
 chart:['M3 20h18','M5 17l4-5 4 3 7-9','M15 6h5v5'],
 key:['M21 2l-2 2m-7.6 7.6a5 5 0 1 1-7.1 7.1 5 5 0 0 1 7.1-7.1ZM15 5l4 4m-2-6 3 3'],
 price:['M3 3v18h18','M7 15l4-5 4 3 5-7'],
 people:['M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2','M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M20 21v-2a4 4 0 0 0-3-3.9','M16 3.1a4 4 0 0 1 0 7.8'],
 bank:['M3 10h18','M5 10v9','M9 10v9','M15 10v9','M19 10v9','M3 21h18','m2 8 10-6 10 6'],
 exchange:['M4 7h15l-3-3','M20 17H5l3 3','M19 7l-3 3','M5 17l3-3'],
 industry:['M3 21V9l6 3V9l6 3V5h6v16H3Z','M7 16h.01','M11 16h.01','M15 16h.01','M19 16h.01'],
 consumer:['M20 21a8 8 0 0 0-16 0','M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
 dollar:['M12 2v20','M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
 volatility:['M3 20V9','M8 20V4','M13 20v-7','M18 20V7','M2 20h20'],
 trend:['M3 17l6-6 4 4 8-9','M15 6h6v6'],
 insight:['M9 18h6','M10 22h4','M8 14a7 7 0 1 1 8 0c-.9.7-1 1.3-1 2H9c0-.7-.1-1.3-1-2Z','M12 4v3','M5 7l2 2','M19 7l-2 2'],
 info:['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20','M12 11v5','M12 7h.01'],
};
function MacroIcon({name,size=16}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{(macroIconPaths[name]||macroIconPaths.trend).map((path,index)=><path d={path} key={index}/>)}</svg>}
function factorIcon(label){if(/inflation|CPI/i.test(label))return 'price';if(/rate|yield|bank/i.test(label))return 'bank';if(/USD|EUR|FX|balance/i.test(label))return 'exchange';if(/industrial|FDI/i.test(label))return 'industry';if(/confidence|unemployment/i.test(label))return 'people';if(/VIX|volatility/i.test(label))return 'volatility';return 'trend'}
function Sparkline({seed=3,color='#2468f2',className=''}){const points=series(seed).map((v,i)=>`${i/33*100},${92-v*.78}`).join(' ');return <svg className={`mr-sparkline ${className}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/></svg>}
function OverviewMetric({item,index,region=false}){const [label,value,change]=item;const down=change.startsWith('-');return <article className={region?'mr-region-metric':'mr-overview-metric'}><span>{label}</span><strong>{value}</strong><small className={down?'is-down':'is-up'}>{change}{!region&&<em> (vs prev)</em>}</small><Sparkline seed={index+(region?9:3)} color={down?'#3475ff':'#18a880'}/></article>}
function FactorList({items}){return <div className="mr-factor-list">{items.map(([label,value,change])=><article key={label}><span className="mr-factor-icon"><MacroIcon name={factorIcon(label)}/></span><strong>{label}</strong><b>{value}</b><small className={change.startsWith('-')?'is-down':'is-up'}>{change}</small></article>)}</div>}

export function MacroRegime(){
 const {t}=usePreferences();
 const [scope,setScope]=useState('world'),[continent,setContinent]=useState('europe'),[country,setCountry]=useState('vietnam'),[period,setPeriod]=useState('1Y'),[marketTab,setMarketTab]=useState('Stock Market');
 const area=scope==='world'?null:scope==='continent'?scopes[continent]:countries[country];
 const title=scope==='world'?'Global':area.name;
 const metrics=scope==='country'?area.metrics:scope==='world'?globalMetrics:area.metrics;
 const charts=scope==='country'?(marketTab==='Stock Market'?area.charts:countryThematicCharts[country][marketTab]||chartSets[marketTab].map(([label,value,change,seed],index)=>[`${area.name} · ${label}`,value,change,seed+country.length+index])):scope==='continent'?regionalCharts[continent][marketTab]:chartSets[marketTab];
 const periodLabels=periods[period];
 const periodSeed=Object.keys(periods).indexOf(period)*9;
 return <section className="analytics-page macro-regime-page">
  <div className="mr-workspace-note"><span><i/>{t('Illustrative sample data')}</span><small>{t('No live macroeconomic data feed is connected.')}</small></div>
  <nav className="mr-scope-bar" aria-label={t('Choose market scope')}><div className="mr-scope-tabs" role="group" aria-label={t('Market scope')}>
   {[['world','globe','World'],['continent','continent','Continent'],['country','pin','Choose your country']].map(([id,icon,label])=><button key={id} type="button" aria-pressed={scope===id} className={scope===id?'is-active':''} onClick={()=>setScope(id)}><span><MacroIcon name={icon}/></span>{t(label)}</button>)}
  </div>
  {scope==='continent'&&<label className="mr-scope-select"><span className="sr-only">{t('Choose continent')}</span><select value={continent} onChange={e=>setContinent(e.target.value)}>{Object.entries(scopes).map(([id,item])=><option key={id} value={id}>{item.name}</option>)}</select></label>}
  {scope==='country'&&<label className="mr-scope-select"><span className="sr-only">{t('Choose country')}</span><select value={country} onChange={e=>setCountry(e.target.value)}>{Object.entries(countries).map(([id,item])=><option key={id} value={id}>{item.name}</option>)}</select></label>}
  </nav>
  {scope==='world'?<>
   <div className="mr-world-grid">
    <section className="home-card mr-overview-card"><header className="mr-card-heading"><div><h2><span><MacroIcon name="globe"/></span>{t('Global Overview')}</h2><p>{t('Key indicators of the global economy and financial markets.')}</p></div></header><div className="mr-overview-metrics">{metrics.map((item,index)=><OverviewMetric key={item[0]} item={item} index={index}/>)}</div></section>
    <section className="home-card mr-factor-card"><header className="mr-card-heading"><h2><span><MacroIcon name="key"/></span>{t('Key Global Indicators')}</h2></header><FactorList items={[[ 'CPI (YoY)','2.9%','-0.3%','price'],['Unemployment Rate','5.2%','-0.1%','people'],['10Y US Treasury Yield','4.3%','-0.2%','bank'],['USD Index (DXY)','104.2','+0.4%','dollar'],['VIX (Volatility Index)','16.8','-2.1%','volatility'],['RSI (Global Market)','56.3','+1.2%','trend']]}/></section>
    <section className="home-card mr-trend-card"><header className="mr-trend-heading"><h2>{t('Global Market Trend')}</h2><div className="mr-period-tabs" role="group" aria-label={t('Trend period')}>{Object.keys(periods).map(item=><button key={item} type="button" aria-pressed={period===item} className={period===item?'is-active':''} onClick={()=>setPeriod(item)}>{item}</button>)}</div></header><div className="mr-trend-chart"><svg viewBox="0 0 600 280" preserveAspectRatio="none" role="img" aria-label={t('Illustrative global market trend over {period}',{period})}>{[50,105,160,215].map(y=><line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#e9eef6" strokeDasharray="3 5"/>)}{trendLines.map(([name,color,seed],index)=>{const points=series(seed+periodSeed,42).map((v,i)=>`${i/41*600},${235-v*1.95-index*3}`).join(' ');return <polyline key={name} points={points} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={index===2?'6 7':undefined} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>})}</svg><div className="mr-trend-labels">{periodLabels.map(label=><span key={label}>{label}</span>)}</div></div><div className="mr-trend-legend">{trendLines.map(([name,color])=><span key={name}><i style={{background:color}}/>{t(name)}</span>)}</div></section>
   </div>
   <section className="home-card mr-regime-insight"><div className="mr-insight-icon"><MacroIcon name="insight" size={22}/></div><div className="mr-insight-copy"><div><h2>{t('Global Regime Insight')}</h2><span className="mr-regime-badge">{t('MODERATE GROWTH')}</span></div><p>{t('The global economy remains in a moderate growth phase, supported by easing inflation and steady corporate earnings. However, risks from geopolitical tensions and commodity price volatility remain.')}</p></div><aside><strong>{t('KEY FACTORS')}</strong><ul><li>{t('Easing inflation (CPI trending lower)')}</li><li>{t('Stable interest rates')}</li><li>{t('Geopolitical risks & commodity price volatility')}</li></ul></aside></section>
  </>:<>
   <div className="mr-region-grid">
    <section className="home-card mr-region-overview"><header className="mr-card-heading"><div><h2>{t('{name} Overview',{name:title})}</h2><p>{t(scope==='country'?'Key indicators and factors affecting the {name} market.':'Key indicators and trends for the {name} region.',{name:title})}</p></div></header><div className="mr-region-metrics">{metrics.map((item,index)=><OverviewMetric key={item[0]} item={item} index={index} region/>)}</div></section>
    <section className="home-card mr-region-factors"><header className="mr-card-heading"><h2><span><MacroIcon name="key"/></span>{t('Key Factors for {name}',{name:title})}</h2></header><FactorList items={area.factors}/></section>
   </div>
   <section className="home-card mr-market-section"><header className="mr-market-heading"><div><h2>{t('{name} Market Charts',{name:title})}</h2><p>{t('Explore illustrative market trends across six macro themes.')}</p></div><div className="mr-market-tabs" role="group" aria-label={t('Market chart category')}>{marketTabs.map(item=><button key={item} type="button" aria-pressed={marketTab===item} className={marketTab===item?'is-active':''} onClick={()=>setMarketTab(item)}>{t(item)}</button>)}</div></header><div className="mr-market-chart-grid">{charts.map(([label,value,change,seed])=><article key={label}><span>{t(label)}</span><div><strong>{value}</strong><small className={change.startsWith('-')?'is-down':'is-up'}>{change}</small></div><Sparkline seed={seed+(scope==='country'?country.length:continent.length)} className="mr-market-sparkline"/><footer><span>{t('6 months ago')}</span><span>{t('Latest')}</span></footer></article>)}</div><p className="mr-market-disclaimer">{t('Charts and values are illustrative examples for interface preview. They are not live prices or investment advice.')}</p></section>
   <section className="home-card mr-region-note"><span><MacroIcon name="info"/></span><p><strong>{t('Reading this regional view')}</strong>{t('Select another region or country above to update the overview, key factors, and chart series together.')}</p><span className="mr-sample-chip">{t('Sample data')}</span></section>
  </>}
 </section>;
}
