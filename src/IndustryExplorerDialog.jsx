import React,{useMemo,useState} from 'react';
import Dialog from './Dialog';
import PriceChart from './PriceChart';
import {companies,percent} from './marketData';
import {usePreferences} from './Preferences';

const industries=[
 {name:'Technology',move:1.1,ticker:'MSFT'}, {name:'Financials',move:.4,ticker:'JPM'}, {name:'Healthcare',move:-.3,ticker:'JNJ'}, {name:'Energy',move:-1.2,ticker:'XOM'},
 {name:'Consumer Discretionary',move:.7,ticker:'AMZN'}, {name:'Consumer Staples',move:.2,ticker:'AAPL'}, {name:'Industrials',move:.5,ticker:'MSFT'}, {name:'Materials',move:-.2,ticker:'XOM'},
 {name:'Utilities',move:.1,ticker:'JNJ'}, {name:'Real Estate',move:-.5,ticker:'JPM'}, {name:'Communication Services',move:.6,ticker:'GOOGL'},
];
const groupData={
 'Macroeconomics':{icon:'\u2197',factors:[['Interest rates','Steady','neutral'],['Inflation','Cooling','positive'],['GDP growth','Expanding','positive'],['Currency strength','Firming','negative']]},
 'Demand':{icon:'\u25CE',factors:[['Enterprise spending','Positive','positive'],['Consumer demand','Mixed','neutral'],['Public investment','Rising','positive'],['Replacement cycle','Stable','neutral']]},
 'Costs & supply':{icon:'\u25C7',factors:[['Core inputs','Tight','negative'],['Freight costs','Easing','positive'],['Energy costs','Stable','neutral'],['Labor costs','Rising','negative']]},
 'Policy & regulation':{icon:'\u2318',factors:[['Tax incentives','Supportive','positive'],['Trade policy','Uncertain','negative'],['Competition rules','Tightening','negative'],['Data privacy','Steady','neutral']]},
 'Technology cycle':{icon:'\u2727',factors:[['AI adoption','Accelerating','positive'],['Cloud demand','Positive','positive'],['Automation','Expanding','positive'],['New capacity','Building','neutral']]},
 'Market & sentiment':{icon:'\u25C9',factors:[['Valuation multiples','Elevated','negative'],['Risk appetite','Improving','positive'],['Fund flows','Positive','positive'],['Earnings outlook','Mixed','neutral']]},
};
const moreNames=industries.map(item=>item.name);
export default function IndustryExplorerDialog({industry='Technology',onClose}){
 const {t}=usePreferences();
 const [selected,setSelected]=useState(industry),[period,setPeriod]=useState('1D');
 const active=industries.find(item=>item.name===selected)||industries[0];
 const company=companies.find(item=>item.ticker===active.ticker)||companies[0];
 const groups=useMemo(()=>Object.entries(groupData),[]);
 const positive=groups.reduce((sum,[,group])=>sum+group.factors.filter(factor=>factor[2]==='positive').length,0);
 const neutral=groups.reduce((sum,[,group])=>sum+group.factors.filter(factor=>factor[2]==='neutral').length,0);
 const negative=groups.reduce((sum,[,group])=>sum+group.factors.filter(factor=>factor[2]==='negative').length,0);
 return <Dialog title={t('What is driving each industry?')} className="industry-explorer-dialog" onClose={onClose}>
  <div className="industry-explorer-intro"><div><span className="eyebrow">{t('INDUSTRY EXPLORER')}</span><p>{t('Explore the tangible and intangible forces shaping each industry.')}</p></div><span>{t('Illustrative sample factors')}</span></div>
  <div className="industry-selector-row" role="tablist" aria-label={t('Choose industry')}>
   {industries.slice(0,5).map(item=><button key={item.name} type="button" role="tab" aria-selected={selected===item.name} className={selected===item.name?'selected':''} onClick={()=>setSelected(item.name)}><span className="industry-glyph">{item.name==='Technology'?'\u25C8':item.name==='Financials'?'\u25A6':item.name==='Healthcare'?'\u2661':item.name==='Energy'?'\u03D9':'\u25C7'}</span><span><strong>{t(item.name)}</strong><small className={item.move<0?'negative':'positive'}>{percent(item.move)} {t('today')}</small></span><b>{'\u203A'}</b></button>)}
   <label className="industry-more"><span>{t('More industries')}</span><select value={selected} onChange={event=>setSelected(event.target.value)} aria-label={t('More industries')}>{moreNames.map(name=><option key={name} value={name}>{t(name)}</option>)}</select></label>
  </div>
  <div className="industry-explorer-layout">
   <main className="industry-explorer-main">
    <section className="industry-trend-card"><div><span className="eyebrow">{t('SECTOR PERFORMANCE')}</span><h3>{t(selected)}</h3><p>{t('Industry outlook based on sample indicators')}</p></div><div className="industry-trend-chart"><strong className={active.move<0?'negative':'positive'}>{percent(active.move)}</strong><div className="industry-periods" role="group" aria-label={t('Chart period')}>{['1D','1W','1M'].map(value=><button type="button" key={value} aria-pressed={period===value} className={period===value?'selected':''} onClick={()=>setPeriod(value)}>{value}</button>)}</div><PriceChart compact company={company} period={period}/></div></section>
    <h3 className="industry-factors-heading">{t('Key factors affecting the industry')}</h3>
    <div className="industry-factor-groups">{groups.map(([name,group])=><section className="industry-factor-card" key={name}><h4><i>{group.icon}</i>{t(name)}</h4><p>{t(name==='Costs & supply'?'Input prices and supply chain stability.':name==='Macroeconomics'?'Economic conditions that shape demand and cost.':name==='Demand'?'Buyer needs and enterprise spending.':name==='Policy & regulation'?'Government policies and market access.':name==='Technology cycle'?'Innovation cycles and product adoption.':'Investment sentiment and market expectations.')}</p><ul>{group.factors.map(([label,state,signal])=><li key={label}><span><b aria-hidden="true">{signal==='positive'?'\u2197':signal==='negative'?'\u2198':'\u2022'}</b>{t(label)}</span><em className={'factor-'+signal}>{t(state)}</em></li>)}</ul></section>)}</div>
   </main>
   <aside className="industry-outlook"><span className="eyebrow">{t('INDUSTRY OUTLOOK')}</span><span className="industry-current-name">{t(selected)}</span><h3 className={active.move<0?'negative':'positive'}>{percent(active.move)}</h3><small>{t('Today | illustrative')}</small><PriceChart compact company={company} period={period}/><div className="industry-outlook-rule"/><h4>{t('Factor balance')}</h4><div className="industry-balance-bar"><i style={{flex:positive}}/><i style={{flex:neutral}}/><i style={{flex:negative}}/></div><div className="industry-balance-labels"><span className="positive">{t('Positive')} {positive}</span><span>{t('Neutral')} {neutral}</span><span className="negative">{t('Negative')} {negative}</span></div><div className="industry-factor-score"><span>{t('Demand')}</span><b>0.7</b><i><em style={{width:'74%'}}/></i></div><div className="industry-factor-score"><span>{t('Costs & supply')}</span><b className="negative">-0.3</b><i><em className="is-negative" style={{width:'42%'}}/></i></div><div className="industry-factor-score"><span>{t('Market sentiment')}</span><b>0.6</b><i><em style={{width:'67%'}}/></i></div><div className="industry-outlook-note"><strong>{t('Outlook summary')}</strong><p>{t('Demand and innovation support the group, while input costs and policy remain key risks to track.')}</p></div><small className="industry-disclosure">{t('Factors are illustrative and are not investment advice.')}</small></aside>
  </div>
 </Dialog>;
}
