import React from 'react';
import {usePreferences} from './Preferences';
export const pageLabels={Home:'Dashboard',Compare:'Compare Companies',Stock:'Stock Analytics',Indicators:'Indicators & VSA',Research:'Investment Research',Trade:'Trade Planner',Markets:'Macro Regime Monitor',Events:'Event Scenarios',News:'Company News',Sources:'Data Sources & Reports',Portfolio:'Portfolio Monitor',Assistant:'Assistant',Help:'Help'};
export const pageHashes={Home:'dashboard',Compare:'compare-companies',Stock:'stock-analytics',Indicators:'indicators-vsa',Research:'investment-research',Trade:'trade-planner',Markets:'macro-regime-monitor',Events:'event-scenarios',News:'company-news',Sources:'data-sources-reports',Portfolio:'portfolio-risk',Assistant:'assistant',Help:'help'};
export const pageDescriptions={Compare:'Compare companies, valuations, and sample performance side by side.',Stock:'Explore price trends and the metrics behind the movement.',Indicators:'Study sample price, momentum, and volume in one place.',Trade:'Define entry, stop, target, and risk before saving a trade draft.',Markets:'Track global, regional, and country-level indicators and market trends.',Events:'Compare plausible outcomes using available evidence; outcomes are not probabilities until calibrated.',Sources:'See where workspace data comes from and export sample reports.',Portfolio:'Track what you own, what you watch, and what needs attention.'};
export const pageEyebrows={Home:'YOUR WORKSPACE',Compare:'COMPANY COMPARISON',Stock:'MARKET CONTEXT',Indicators:'TECHNICAL ANALYSIS',Research:'COMPANY VALUATION',Trade:'RISK-FIRST PLANNING',Markets:'MACRO RESEARCH',Events:'EVIDENCE-LED OUTLOOK',News:'MARKET INTELLIGENCE',Sources:'DATA & REPORTS',Portfolio:'PORTFOLIO MONITOR',Assistant:'RESEARCH ASSISTANT',Help:'WORKSPACE SUPPORT'};
const groups=[['',['Home','Compare']],['ANALYTICS',['Stock','Indicators','Research','Trade','Markets','Events']],['DATA',['News','Sources','Portfolio']]];
function NavigationIcon({page}){
 const paths={
 Home:['M3 3h7v7H3zM14 3h7v5h-7zM3 14h7v7H3zM14 12h7v9h-7z'],
 Compare:['M3 4h6v16H3zM15 4h6v16h-6z','M9 9h6m-2-2 2 2-2 2M15 15H9m2-2-2 2 2 2'],
 Stock:['M3 3v18h18','M7 7v10m-2-7h4v4H5zM13 4v12m-2-9h4v5h-4zM19 10v8m-2-5h4v3h-4z'],
 Indicators:['M3 18 8 11l4 4 5-9 4 3','M3 4h6m-3-2v4M14 20h7m-3-2v4'],
 Research:['M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7M7 7h5M7 11h3','M18 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8m3 7 2 4'],
 Trade:['M9 3H6a2 2 0 0 0-2 2v15h16V5a2 2 0 0 0-2-2h-3M9 2h6v4H9z','M8 10h8M8 14h4m1 3 2 2 3-4'],
 Markets:['M12 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16M4 10h16M12 2c-4 4-4 12 0 16 4-4 4-12 0-16','M4 22v-2m5 2v-3m5 3v-2m5 2v-4'],
 Events:['M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2M7 2v4m10-4v4M3 9h18','m13 11-4 5h4l-1 4 5-6h-4l1-3'],
 News:['M5 3h15v17a1 1 0 0 1-1 1H4a2 2 0 0 1-2-2V8h3v11M5 3v16','M8 6h9M8 10h4v4H8zM15 10h2m-2 4h2M8 17h9'],
 Sources:['M20 5c0 2-4 3-8 3S4 7 4 5s4-3 8-3 8 1 8 3M4 5v14c0 2 4 3 8 3s8-1 8-3V5','M4 12c0 2 4 3 8 3s8-1 8-3'],
 Portfolio:['m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5l8-3','M12 7v5h5M12 7a5 5 0 1 0 5 5'],
 };
 return <span className="navigation-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[page].map((d,i)=><path key={i} d={d}/>)}</svg></span>
}
export default function WorkspaceNavigation({page,navigate,isAdmin=false}){const {t}=usePreferences();return <nav className="workspace-navigation" aria-label={t('Main navigation')}>{groups.map(([title,items],index)=><React.Fragment key={index}>{title&&<span className="nav-section-label">{t(title)}</span>}{items.filter(item=>item!=='Sources'||isAdmin).map(item=><button key={item} aria-current={page===item?'page':undefined} className={page===item?'selected':''} onClick={()=>navigate(item)}><NavigationIcon page={item}/><span>{t(pageLabels[item])}</span></button>)}</React.Fragment>)}</nav>}
