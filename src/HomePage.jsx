import React,{useEffect,useMemo,useRef,useState} from 'react';

import BrandLogo from './BrandLogo';

import PriceChart from './PriceChart';

import DashboardContext from './DashboardContext';

import Dialog from './Dialog';
import MarketCompaniesDialog from './MarketCompaniesDialog';
import IndustryExplorerDialog from './IndustryExplorerDialog';

import CompanyOverview from './CompanyOverview';

import CompanyResearch from './CompanyResearch';
import InvestmentResearch from './InvestmentResearch';

import {Avatar,useProfilePhoto} from './ProfilePhoto';

import {usePreferences,PreferenceControls} from './Preferences';

import {companies,defaultWatchlist,articles,money,percent} from './marketData';

import './home.scss';

import {WorkspaceLoader} from './LoadingScreen';

import AnalyticsPages,{analyticsPages} from './AnalyticsPages';
import {MacroRegime} from './MacroRegime.jsx';

import WorkspaceNavigation,{pageLabels,pageHashes,pageDescriptions,pageEyebrows} from './WorkspaceNavigation';

import {LayoutPicker,FocusView,Newsroom,PortfolioMonitor,PlansDialog} from './WorkspaceViews';



const pages=Object.keys(pageLabels);

function initialPage(){return pages.find(page=>page.toLowerCase()===window.location.hash.slice(1)||pageHashes[page]===window.location.hash.slice(1))||'Home'}

function readWatchlist(key){try{const saved=JSON.parse(localStorage.getItem(key));return Array.isArray(saved)?[...new Set(saved.filter(ticker=>companies.some(c=>c.ticker===ticker)))]:defaultWatchlist}catch{return defaultWatchlist}}

function Icon({name,size=20}){

  const paths={Home:'M3 11 12 3l9 8M5 10v11h5v-6h4v6h5V10',Research:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',Watchlist:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6',Markets:'M4 21V12m5 9V7m5 14V3m5 18V9',News:'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',Assistant:'M21 11a9 9 0 0 1-9 9H5l-3 2 1-6a9 9 0 1 1 18-5',Settings:'M9 3h6v2l2 1 2-1 3 5-2 1v2l2 1-3 5-2-1-2 1v2H9v-2l-2-1-2 1-3-5 2-1v-2l-2-1 3-5 2 1 2-1V3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',Help:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v1',Arrow:'M4 12h16m-6-6 6 6-6 6',Logout:'M10 17l5-5-5-5m5 5H3m9-9h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6',Menu:'M4 6h16M4 12h16M4 18h16',Download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',Bell:'M6 9a6 6 0 0 1 12 0v6l2 3H4l2-3V9m4 12h4',Close:'m6 6 12 12M6 18 18 6',Plus:'M12 5v14M5 12h14',Check:'m5 12 4 4L19 6'};

 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.News}/></svg>

}

function Mark({company}){return <span className="company-mark" style={{'--company-color':company.color}}>{company.ticker==='AAPL'?'a':company.ticker==='MSFT'?'M':company.ticker==='GOOGL'?'G':company.ticker.slice(0,2)}</span>}

function Link({children,onClick}){return <button className="home-link" onClick={onClick}>{children}<Icon name="Arrow" size={15}/></button>}

function Empty({title,children,onAction}){const {t}=usePreferences();return <div className="empty-state"><span><Icon name="Research" size={28}/></span><h3>{t(title)}</h3><p>{typeof children==='string'?t(children):children}</p>{onAction&&<button className="dashboard-button" onClick={onAction}>{t("Browse companies")}</button>}</div>}

function Bars(){return <div className="mini-bars" aria-hidden="true">{Array.from({length:22},(_,i)=><span key={i} style={{height:(25+(i*17+13)%70)+'%'}}/>)}</div>}



export default function HomePage({isAdmin,onAdmin,onAccount,onLogout,user}){

 const {t}=usePreferences();

 const {photo}=useProfilePhoto(user);

 const [pageLoading,setPageLoading]=useState(true),[companyOpen,setCompanyOpen]=useState(false),[companiesOpen,setCompaniesOpen]=useState(false),[companyMarket,setCompanyMarket]=useState('S&P 500'),[industriesOpen,setIndustriesOpen]=useState(false),[industryFocus,setIndustryFocus]=useState('Technology');

 const storageKey='pasion-watchlist:'+(user?.email||'demo');

 const [page,setPage]=useState(()=>{const initial=initialPage();return initial==='Sources'&&!isAdmin?'Home':initial}),[query,setQuery]=useState(''),[watchlist,setWatchlist]=useState(()=>readWatchlist(storageKey)),[selected,setSelected]=useState(companies[0]),[companyTab,setCompanyTab]=useState('Summary'),[period,setPeriod]=useState('1D'),[question,setQuestion]=useState(''),[messages,setMessages]=useState([]),[expanded,setExpanded]=useState(false),[sort,setSort]=useState('default'),[sector,setSector]=useState('All sectors'),[toast,setToast]=useState(''),[mobileOpen,setMobileOpen]=useState(false),[profileOpen,setProfileOpen]=useState(false),[adding,setAdding]=useState(false),[addQuery,setAddQuery]=useState(''),[article,setArticle]=useState(null),[error,setError]=useState(''),[signingOut,setSigningOut]=useState(false);

 const [portfolioTab,setPortfolioTab]=useState('Holdings');

 const focusedPage=page==='Assistant'||page==='Help';

 const [views,setViews]=useState(()=>{try{return JSON.parse(localStorage.getItem(storageKey+'-views'))||{}}catch{return {}}}),[plansOpen,setPlansOpen]=useState(false);

 const view=Number.isInteger(views[page])&&views[page]>=0&&views[page]<(page==='Home'?4:5)?views[page]:0;

 function changeView(value){const next={...views,[page]:value};setViews(next);try{localStorage.setItem(storageKey+'-views',JSON.stringify(next))}catch{setError('Your layout preference could not be saved.')}}

 useEffect(()=>{setPageLoading(true);const timer=setTimeout(()=>setPageLoading(false),window.matchMedia('(prefers-reduced-motion: reduce)').matches?60:320);return()=>clearTimeout(timer);},[page]);

 const search=useRef(null),profile=useRef(null);

 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Baku',hour:'numeric',hourCycle:'h23'}).format(new Date()));

 const name=user?.name||t('Your account'),firstName=name.split(' ')[0];

 const watched=companies.filter(c=>watchlist.includes(c.ticker));

 const matching=useMemo(()=>companies.filter(c=>(c.name+' '+c.ticker+' '+c.sector+' '+t(c.sector)).toLowerCase().includes(query.toLowerCase())&&(sector==='All sectors'||c.sector===sector)).sort((a,b)=>sort==='change'?b.change-a.change:sort==='price'?b.price-a.price:sort==='name'?a.name.localeCompare(b.name):a.index-b.index),[query,sector,sort,t]);

 useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(watchlist))}catch{setError('Your browser could not save the watchlist. Changes will last for this visit.')}},[watchlist,storageKey]);

 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(timer)},[toast]);

 useEffect(()=>{

  const key=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.current?.focus()}if(e.key==='Escape'){setProfileOpen(false);setMobileOpen(false)}};

  const outside=e=>{if(profile.current&&!profile.current.contains(e.target))setProfileOpen(false)};

  const hash=()=>{if(window.location.hash!=='#admin'){const next=initialPage();if(next==='Sources'&&!isAdmin){setPage('Home');setToast({text:'Data Sources & Reports is available to administrators only.'});window.history.replaceState(null,'','#'+pageHashes.Home)}else setPage(next)}};

  hash();window.addEventListener('keydown',key);window.addEventListener('pointerdown',outside);window.addEventListener('hashchange',hash);

  return()=>{window.removeEventListener('keydown',key);window.removeEventListener('pointerdown',outside);window.removeEventListener('hashchange',hash)};

 },[isAdmin]);

 function navigate(next,section){if(next==='Portfolio')setPortfolioTab(section==='Alerts'?'Alerts':section==='Watchlist'?'Watchlist':'Holdings');if(next==='Sources'&&!isAdmin){setToast({text:'Data Sources & Reports is available to administrators only.'});next='Home'}setCompanyOpen(false);setPage(next);window.location.hash=pageHashes[next]||next.toLowerCase();setMobileOpen(false);setProfileOpen(false);setQuery('');setSector('All sectors');window.scrollTo({top:0,left:0,behavior:'instant'})}

 function toggle(company){setWatchlist(list=>list.includes(company.ticker)?list.filter(t=>t!==company.ticker):[...list,company.ticker]);setToast({text:watchlist.includes(company.ticker)?'{ticker} removed from your watchlist':'{ticker} added to your watchlist',params:{ticker:company.ticker}})}

 function choose(company){setSelected(company);setPeriod('1D')}

 function openCompany(company=selected){choose(company);setCompanyOpen(true);setMobileOpen(false)}

 function ask(text=question){

  if(!text.trim())return;

  const mentioned=companies.find(c=>text.toLowerCase().includes(c.ticker.toLowerCase())||text.toLowerCase().includes(c.name.split(' ')[0].toLowerCase()));

  let reply,params={};

  if(/watchlist|portfolio/i.test(text)||text===t('Summarize my watchlist')){reply='Your watchlist has {count} companies, with {gainers} gainers and {decliners} decliners in the sample data. The average move is {move}.';params={count:watched.length,gainers,decliners:watched.length-gainers,move:percent(avg)}}

  else if(/market|macro|inflation|rate/i.test(text)||text===t('Explain the market overview'))reply='The sample market overview shows broad participation, with 64% of stocks advancing. Liquidity and money momentum are positive in this scenario. Check Macro context for the illustrative rates and inflation figures.';

  else {const company=mentioned||selected;reply='{name} ({ticker}) is {move} at {price} in the sample dataset. {detail} Sector: {sector}. Sample market cap: ${cap}.';params={name:company.name,ticker:company.ticker,move:percent(company.change),price:money(company.price),detail:company.detail,sector:company.sector,cap:company.cap}}

  setMessages(list=>[...list,{question:text,answer:reply,params}]);setQuestion('');

 }

 function translateReply(message){return t(message.answer,{...message.params,detail:t(message.params?.detail),sector:t(message.params?.sector)})}

 async function signOut(){setSigningOut(true);setError('');try{await onLogout()}catch{setError('Unable to sign out. Please try again.');setSigningOut(false)}}

 function exportWatchlist(){

  const rows=[['Ticker','Company','Sample price (USD)','Sample change (%)','Sector'],...watched.map(c=>[c.ticker,c.name,c.price,c.change,c.sector])];

  const csv=rows.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');

  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));

  const a=document.createElement('a');a.href=url;a.download='pasion-watchlist-sample.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setToast({text:'Watchlist exported with sample data labels'});

 }

 const briefing=<section className="home-card market-company-overview"><div className="card-heading"><div><span className="eyebrow">{t("MARKET MOVERS")}</span><h2>{t("Companies in {market}",{market:companyMarket})}</h2><p>{t("Follow the daily moves across the companies in your market.")}</p></div><button className="home-link" onClick={()=>setCompaniesOpen(true)}>{t("View all companies")}<Icon name="Arrow" size={15}/></button></div><div className="market-mover-grid">{companies.map(company=><button type="button" key={company.ticker} className={'market-mover '+(company.change<0?'is-down':'is-up')} onClick={()=>openCompany(company)}><span className="market-mover-ticker">{company.ticker}</span><strong>{percent(company.change)}</strong><small>{t(company.sector)}</small><PriceChart compact company={company}/></button>)}</div><div className="market-mover-foot"><span>{t("Illustrative company moves from sample data")}</span><button type="button" onClick={()=>setCompaniesOpen(true)}>{t("Explore all companies")}<Icon name="Arrow" size={14}/></button></div><div className="industry-performance"><div className="industry-performance-heading"><div><span className="eyebrow">{t("INDUSTRIES")}</span><h3>{t("Industry performance")}</h3></div><button type="button" className="industry-explore-button" onClick={()=>{setIndustryFocus('Technology');setIndustriesOpen(true)}}>{t("Explore Industries")}<Icon name="Arrow" size={14}/></button></div><div className="industry-performance-grid">{[['Technology',1.1],['Financials',.4],['Healthcare',-.3],['Energy',-1.2]].map(([industry,change])=><button type="button" key={industry} className={change<0?'is-down':'is-up'} onClick={()=>{setIndustryFocus(industry);setIndustriesOpen(true)}}><span>{t(industry)}</span><strong>{percent(change)}</strong></button>)}</div><div className="industry-performance-preview"><span aria-hidden="true"><Icon name="Markets" size={16}/></span><p>{t('Open an industry to see its outlook, key drivers, and related companies.')}</p></div></div></section>;

const macroCard=<section className="home-card macro-card"><div className="card-heading"><h2><Icon name="Markets" size={18}/>{t("Macro context")}</h2><span className="small-tag">{t("Sample")}</span></div>{[['GDP (QoQ)','+2.3%','Above expectations'],['CPI (YoY)','+2.8%','In line with forecasts'],['10Y Treasury','4.12%','Down 6 bps in sample']].map(([label,value,note])=><div className="macro-row" key={label}><strong>{t(label)}</strong><span className={label==='10Y Treasury'?'':'positive'}>{value}</span><small>{t(note)}</small></div>)}</section>;

 const watchCard=<section className="home-card watch-card"><div className="card-heading"><div><span className="eyebrow">{t("YOUR COMPANIES, AT A GLANCE")}</span><h2>{t('Portfolio watchlist')}<span className="small-tag">{t('{count} companies',{count:watchlist.length})}</span></h2></div><button className="dashboard-button secondary-action" onClick={()=>{setAddQuery('');setAdding(true)}}><Icon name="Plus" size={16}/>{t("Add holding")}</button></div><div className="watch-toolbar"><p>{t("Keep the companies that matter in view.")}</p><div><label><span className="sr-only">{t("Sort watchlist")}</span><select aria-label={t("Sort watchlist")} value={sort} onChange={e=>setSort(e.target.value)}><option value="default">{t("Default order")}</option><option value="change">{t("Biggest movers")}</option><option value="price">{t("Highest price")}</option><option value="name">{t("Company name")}</option></select></label><button className="icon-button" aria-label={t("Export watchlist as CSV")} title={t("Export CSV")} onClick={exportWatchlist}><Icon name="Download" size={18}/></button></div></div>

 <div className="watch-columns"><span>{t("Company")}</span><span>{t("Trend")}</span><span>{t("Price")}</span><span>{t("Change")}</span><span>{t("What's happening")}</span></div><div className="watch-rows">{matching.filter(c=>watchlist.includes(c.ticker)).map(c=><div className={'watch-row '+(selected.ticker===c.ticker?'is-selected':'')} key={c.ticker}><button className="company-cell" onClick={()=>openCompany(c)} aria-label={t('View {ticker}',{ticker:c.ticker})}><Mark company={c}/><span className="company-name"><strong>{c.ticker}</strong><small>{c.name}</small></span></button><PriceChart compact company={c}/><strong className="stock-price">{money(c.price)}</strong><strong className={'stock-change '+(c.change<0?'negative':'positive')}>{percent(c.change)}</strong><p className="watch-detail">{t(c.detail)}</p><button className="icon-button" aria-label={t('Open {ticker}',{ticker:c.ticker})} onClick={()=>openCompany(c)}><Icon name="Arrow" size={16}/></button></div>)}</div></section>;

return <div className="home-shell">
 {mobileOpen&&<button className="sidebar-backdrop" aria-label={t("Close navigation")} onClick={()=>setMobileOpen(false)}/>}
 <aside className={'home-sidebar '+(mobileOpen?'is-open':'')}>
  <a className="logo" href="#home" aria-label={t("PASION home")} onClick={event=>{event.preventDefault();navigate('Home')}}><BrandLogo/></a>
   <span className="workspace-label">{t("RESEARCH WORKSPACE")}</span><WorkspaceNavigation page={page} navigate={navigate} isAdmin={isAdmin}/>
  <div className="sidebar-tip"><span>?</span><strong>{t("See the whole picture.")}</strong><p>{t("A clearer view of the companies and markets that matter.")}</p><button onClick={()=>navigate('Research')}>{t("Start exploring")} <Icon name="Arrow" size={15}/></button></div>
  <div className="pro-card"><span>?</span><strong>{t("Upgrade to PASION Pro")}</strong><p>{t("Deeper insights, connected alerts, and advanced tools.")}</p><button onClick={()=>setPlansOpen(true)}>{t("View plans")} ?</button></div>
  <nav className="sidebar-bottom" aria-label={t("Account navigation")}><button aria-current={page==='Assistant'?'page':undefined} onClick={()=>navigate('Assistant')}><Icon name="Assistant"/>{t("Assistant")}</button><button onClick={onAccount}><Icon name="Settings"/>{t("Settings")}</button>{isAdmin&&<button onClick={onAdmin}><Icon name="Settings"/>{t("Administration")}</button>}<button aria-current={page==='Help'?'page':undefined} onClick={()=>navigate('Help')}><Icon name="Help"/>{t("Help & support")}</button></nav>
  <div className="sidebar-user"><Avatar photo={photo} name={name}/><div><strong>{firstName}</strong><small>{isAdmin?t('Administrator'):t('Member')}</small></div><button className="icon-button" aria-label={t("Sign out")} title={t('Sign out')} disabled={signingOut} onClick={signOut}><Icon name="Logout" size={17}/></button></div>
 </aside>
 <main className="home-main">
  <header className="home-topbar"><div className="header-context"><button className="icon-button mobile-menu" aria-label={t("Open navigation")} aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><Icon name="Menu"/></button><span className="header-breadcrumb">{t("Workspace")} <span>/</span> <strong>{t(pageLabels[page])}</strong></span></div><div className="topbar-tools"><PreferenceControls compact/><label className="dashboard-search"><Icon name="Research" size={18}/><input ref={search} aria-label={t("Search companies")} value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("Search companies, tickers, sectors?")}/><kbd>? K</kbd>{query&&<button className="icon-button" aria-label={t("Clear search")} onClick={()=>setQuery('')}>?</button>}</label><button className="icon-button notification-button" aria-label={t("Open news briefings")} onClick={()=>navigate('News')}><Icon name="Bell"/><i/></button><div className="profile-menu" ref={profile}><button className="user-avatar" aria-expanded={profileOpen} aria-label={t("Open account menu")} onClick={()=>setProfileOpen(value=>!value)}><Avatar photo={photo} name={name}/></button>{profileOpen&&<div className="profile-dropdown"><strong>{name}</strong><small>{user?.email}</small><button onClick={onAccount}>{t("Account settings")}</button>{isAdmin&&<button onClick={onAdmin}>{t("Administration")}</button>}<button onClick={signOut} disabled={signingOut}>{t(signingOut?'Signing out?':'Sign out')}</button></div>}</div></div></header>
  <div className="workspace-content-shell">{pageLoading&&<WorkspaceLoader label={t(pageLabels[page])}/>}<div className={'workspace-page-content '+(pageLoading?'is-loading':'')} aria-busy={pageLoading} inert={pageLoading?true:undefined}>
    {page!=='Stock'&&page!=='Indicators'&&page!=='Research'&&page!=='Trade'&&<><div className="page-intro"><div><p>{t(pageEyebrows[page]||'WORKSPACE')}</p><h1>{page==='Home'?t(hour<12?'Good morning, {name}.':hour<18?'Good afternoon, {name}.':'Good evening, {name}.',{name:firstName}):page==='Help'?t('A little help goes a long way.'):t(pageLabels[page])}</h1><span>{t(pageDescriptions[page]||(page==='Home'?'Your daily perspective on companies, markets, and what comes next.':page==='Markets'?'Understand the forces shaping the bigger picture.':page==='News'?'The stories behind the market moves.':page==='Portfolio'?'Track positions, allocation, and sample alerts.':page==='Assistant'?'Turn a question into a clearer perspective.':'Everything you need to find your way.'))}</span></div><span className="workspace-status"><i/>{t("Sample workspace")}</span></div>
   <div className="demo-banner"><Icon name="Help" size={14}/><span>{t("Explore freely. Prices, charts, news, and insights use illustrative data.")}</span></div></>}{error&&<p className="notice error" role="alert">{t(error)}</p>}
   {page==='Home'&&<DashboardContext storageKey={storageKey} watched={watched} onNavigate={navigate} onChoose={openCompany}/>}
   {page!=='Home'&&page!=='Stock'&&page!=='Indicators'&&page!=='Research'&&page!=='Trade'&&<LayoutPicker page={page} value={view} onChange={changeView}/>}{page==='Research'&&<InvestmentResearch storageKey={storageKey}/>}{page==='News'&&<Newsroom variant={view} query={query} onArticle={setArticle} onCompany={openCompany} onClearSearch={()=>setQuery("")} watched={watched} storageKey={storageKey}/>}{analyticsPages.includes(page)&&<AnalyticsPages key={'analytics-'+page} page={page} query={query} selected={selected} watched={watched} storageKey={storageKey} onToggleWatch={toggle} onNavigate={navigate} onResearch={company=>{choose(company);navigate('Research')}}/>}{page==='Markets'&&<MacroRegime onCompany={openCompany}/>}{page==='Portfolio'&&<PortfolioMonitor variant={view} storageKey={storageKey} watchlist={watchlist} initialTab={portfolioTab} onChoose={company=>{choose(company);navigate('Research')}}/>}
   <div className={'dashboard-grid dashboard-view-'+view+(focusedPage?' workspace-single-column':'')+(page==='News'||page==='Portfolio'||page==='Research'||page==='Markets'||analyticsPages.includes(page)?' page-contained':'')} key={'grid-'+page}><div className="dashboard-left">
    {page==='Home'&&watchCard}
    {(page==='Home'||page==='Markets')&&briefing}
    {page==='Research'&&<section className="home-card research-card"><div className="card-heading"><div><span className="eyebrow">{t("GO DEEPER")}</span><h2>{t("Company universe")} <span className="small-tag">{t('{count} companies',{count:matching.length})}</span></h2></div><select aria-label={t("Filter research by sector")} value={sector} onChange={event=>setSector(event.target.value)}>{['All sectors','Technology','Financials','Consumer','Healthcare','Energy'].map(value=><option key={value} value={value}>{t(value)}</option>)}</select></div><div className="research-grid">{matching.map(company=><article className="research-company" key={company.ticker}><header><Mark company={company}/><button className={'icon-button '+(watchlist.includes(company.ticker)?'saved':'')} aria-label={t(watchlist.includes(company.ticker)?'Remove {ticker} from watchlist':'Add {ticker} to watchlist',{ticker:company.ticker})} onClick={()=>toggle(company)}><Icon name={watchlist.includes(company.ticker)?'Check':'Plus'} size={18}/></button></header><button className="research-name" onClick={()=>openCompany(company)}><strong>{company.ticker}</strong><span>{company.name}</span></button><span className="sector-tag">{t(company.sector)}</span><div className="research-price"><strong>{money(company.price)}</strong><span className={company.change<0?'negative':'positive'}>{percent(company.change)}</span></div><PriceChart compact company={company}/><Link onClick={()=>openCompany(company)}>{t("View company")}</Link></article>)}</div>{!matching.length&&<Empty title={t("No companies found")}>{t("Try a ticker, company name, or another sector.")}</Empty>}</section>}
    {page==='Assistant'&&<section className="home-card assistant-main workspace-focused-section"><div className="assistant-welcome"><span>?</span><h2>{t("A clearer perspective starts with a good question.")}</h2><p>{t("Explore this sample workspace with PASION Assistant.")}</p></div><div className="assistant-prompts">{['Summarize my watchlist','What?s happening with NVDA?','Explain the market overview'].map(text=><button key={text} onClick={()=>ask(text)}>{t(text)}<Icon name="Arrow" size={16}/></button>)}</div><div className="assistant-conversation" aria-live="polite">{messages.map((message,index)=><div key={index}><p className="user-message">{t(message.question)}</p><p className="assistant-answer"><strong>{t("? PASION ? Sample insight")}</strong>{translateReply(message)}</p></div>)}</div><form className="assistant-input" onSubmit={event=>{event.preventDefault();ask()}}><input aria-label={t("Ask the assistant")} placeholder={t("Ask about a company or your watchlist?")} value={question} onChange={event=>setQuestion(event.target.value)} required/><button aria-label={t("Send assistant question")}><Icon name="Arrow"/></button></form><p className="assistant-disclosure">{t("Illustrative responses from the sample dataset. A live AI service is not connected.")}</p></section>}
    {page==='Help'&&<section className="home-card help-card workspace-focused-section"><span className="eyebrow">{t("MAKE YOURSELF AT HOME")}</span><h2>{t("Your workspace, explained.")}</h2>{[['Following companies','Open Research and use the + button to add a company. Your watchlist is saved separately for your account on this browser.'],['Exploring company details','Select a company to see its overview. Switch chart periods or use the chart slider to explore the sample price history.'],['Managing your account','Open Settings to change your language, appearance, or password. Administrators can manage accounts from Administration.'],['Resetting your password','Use Forgot password on the sign-in screen. Real email delivery requires your administrator to configure the sender.'],['About the market data','All prices, charts, stories, and assistant responses are illustrative. No live market or AI connection is active.']].map(([title,text])=><details key={title}><summary>{t(title)}</summary><p>{t(text)}</p></details>)}</section>}
</div><div className="dashboard-right" hidden={focusedPage}>

 {page==='Home'&&macroCard}

 {!companyOpen&&<CompanyOverview company={selected} watchlist={watchlist} onToggle={toggle} onChoose={openCompany} tab={companyTab} onTabChange={setCompanyTab} period={period} onPeriodChange={setPeriod} onExpand={()=>setCompanyOpen(true)}/>}

 <section className="home-card assistant-card"><h2><span className="assistant-star">{'\u2726'}</span>{t("A little clarity, on demand.")}</h2><p>{t("Ask about the companies and themes in your workspace.")}</p><form className="assistant-input" onSubmit={e=>{e.preventDefault();ask()}}><input aria-label={t("Assistant question")} placeholder={t("What would you like to know?")} value={question} onChange={e=>setQuestion(e.target.value)} required/><button aria-label={t("Send question")}><Icon name="Arrow" size={17}/></button></form><div className="suggested-questions"><button onClick={()=>ask('Summarize my watchlist')}>{t("My watchlist")}</button><button onClick={()=>ask('What is happening with NVDA?')}>{t("NVDA in focus")}</button></div>{messages.length>0&&<p className="assistant-answer" role="status"><strong>{t("Sample insight")}</strong>{translateReply(messages.at(-1))}</p>}<Link onClick={()=>navigate('Assistant')}>{t("Open assistant")}</Link></section>

 {page!=='Home'&&macroCard}

 {page!=='News'&&<section className="home-card news-card"><div className="card-heading"><h2>{t("On the radar")}</h2><Link onClick={()=>navigate('News')}>{t("All news")}</Link></div><ul className="news-list">{articles.slice(0,3).map(a=><li key={a.id}><button onClick={()=>setArticle(a)}><span className="news-category">{t(a.category)}</span><strong>{a.title}</strong><time>{a.time} Ã‚Â· {t('Sample briefing')}</time></button></li>)}</ul></section>}

 </div></div><footer className="dashboard-footer"><span>{'\u00A9'} {new Date().getFullYear()} PASION</span><span>{t("See the whole picture.")}</span><button onClick={()=>navigate('Help')}>{t("Help & support")}</button></footer>

 </div></div></main>

 {companiesOpen&&<MarketCompaniesDialog market={companyMarket} onMarketChange={setCompanyMarket} onClose={()=>setCompaniesOpen(false)} onChoose={openCompany}/> }
 {industriesOpen&&<IndustryExplorerDialog industry={industryFocus} onClose={()=>setIndustriesOpen(false)}/> }

 {companyOpen&&<CompanyResearch company={selected} watchlist={watchlist} onToggle={toggle} onChoose={choose} period={period} onPeriodChange={setPeriod} onExploreIndustry={industry=>{setCompanyOpen(false);setIndustryFocus(industry);setIndustriesOpen(true)}} onClose={()=>setCompanyOpen(false)}/>}

 {plansOpen&&<PlansDialog onClose={()=>setPlansOpen(false)}/>}

 {toast&&<div className="dashboard-toast" role="status"><Icon name="Check" size={18}/>{t(toast.text,toast.params)}</div>}

 {adding&&<Dialog title={t("Build your watchlist")} onClose={()=>setAdding(false)}><p className="dialog-description">{t("Find a company and add it to your daily perspective.")}</p><label className="company-search"><Icon name="Research" size={18}/><input aria-label={t("Search companies to add")} placeholder={t("Company name or ticker")} value={addQuery} onChange={e=>setAddQuery(e.target.value)}/></label><div className="add-company-list">{companies.filter(c=>(c.ticker+' '+c.name).toLowerCase().includes(addQuery.toLowerCase())).map(c=><div key={c.ticker}><Mark company={c}/><div><strong>{c.ticker}</strong><small>{c.name}</small></div><button className={'dashboard-button '+(watchlist.includes(c.ticker)?'secondary-action':'')} aria-label={t(watchlist.includes(c.ticker)?'Remove {ticker} in holding picker':'Add {ticker} in holding picker',{ticker:c.ticker})} onClick={()=>toggle(c)}><Icon name={watchlist.includes(c.ticker)?'Check':'Plus'} size={15}/>{t(watchlist.includes(c.ticker)?'Added':'Add')}</button></div>)}</div>{!companies.some(c=>(c.ticker+' '+c.name).toLowerCase().includes(addQuery.toLowerCase()))&&<Empty title={t("No companies found")}>{t("Try another name or ticker.")}</Empty>}</Dialog>}

 {article&&<Dialog title={article.title} onClose={()=>setArticle(null)}><div className="article-meta"><span className="category-pill">{t(article.category)}</span><span>{article.time} Ã‚Â· {t('Sample briefing')}</span></div><p className="article-summary">{article.summary}</p><p className="article-body">{article.body}</p><button className="dashboard-button" onClick={()=>{setArticle(null);navigate('News')}}>{t("Explore more briefings")}<Icon name="Arrow" size={16}/></button></Dialog>}
 </div>;
}
