import React,{useMemo,useState} from 'react';
import Dialog from './Dialog';
import PriceChart from './PriceChart';
import {companies,money,percent} from './marketData';
import {usePreferences} from './Preferences';

const markets=[['S&P 500','\u{1F1FA}\u{1F1F8}'],['NASDAQ','\u{1F1FA}\u{1F1F8}'],['DOW JONES','\u{1F1FA}\u{1F1F8}'],['FTSE 100','\u{1F1EC}\u{1F1E7}'],['DAX','\u{1F1E9}\u{1F1EA}'],['Nikkei 225','\u{1F1EF}\u{1F1F5}'],['Hang Seng','\u{1F1ED}\u{1F1F0}'],['Shanghai Composite','\u{1F1E8}\u{1F1F3}'],['VNINDEX','\u{1F1FB}\u{1F1F3}']];
const sectors=['All sectors','Technology','Financials','Healthcare','Consumer','Energy'];
function capValue(value){const [,number,suffix]=String(value).match(/^([\d.]+)([TB])?$/)||[];return Number(number||0)*(suffix==='T'?1e12:suffix==='B'?1e9:1)}

export default function MarketCompaniesDialog({market='S&P 500',onMarketChange=()=>{},onClose,onChoose}){
 const {t}=usePreferences();
 const [activeMarket,setActiveMarket]=useState(market),[query,setQuery]=useState(''),[sector,setSector]=useState('All sectors'),[sort,setSort]=useState('change');
 const visible=useMemo(()=>companies.filter(c=>(sector==='All sectors'||c.sector===sector)&&(c.name+' '+c.ticker+' '+c.sector).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sort==='cap'?capValue(b.cap)-capValue(a.cap):sort==='price'?b.price-a.price:sort==='name'?a.name.localeCompare(b.name):b.change-a.change),[query,sector,sort]);
 const sectorCounts=Object.fromEntries(sectors.slice(1).map(value=>[value,companies.filter(c=>c.sector===value).length]));
 return <Dialog title={t('Companies in {market}',{market:activeMarket})} className="market-companies-dialog" onClose={onClose}>
  <div className="market-companies-intro"><div><span className="eyebrow">{t('MARKET COMPANIES')}</span><p>{t('Track company moves in each market. Select a company to open its profile.')}</p></div><span className="market-companies-note">{t('Illustrative sample data')}</span></div>
  <div className="company-market-layout">
   <nav className="company-market-list" aria-label={t('Markets')}><span className="company-market-list-label">{t('MARKETS')}</span>{markets.map(([name,flag])=><button type="button" key={name} className={activeMarket===name?'selected':''} aria-pressed={activeMarket===name} onClick={()=>{setActiveMarket(name);onMarketChange(name)}}><span className="market-flag">{flag}</span><span><strong>{t(name)}</strong><small>{companies.length} {t('sample companies')}</small></span><i>›</i></button>)}</nav>
   <div className="company-market-results">
    <div className="company-market-toolbar"><label className="company-market-search"><span aria-hidden="true">⌕</span><input type="search" aria-label={t('Search company, ticker, or sector')} placeholder={t('Search company, ticker, or sector')} value={query} onChange={event=>setQuery(event.target.value)}/></label><label className="company-market-sort"><span className="sr-only">{t('Sort companies')}</span><select value={sort} onChange={event=>setSort(event.target.value)} aria-label={t('Sort companies')}><option value="change">{t('Sort by: Biggest movers')}</option><option value="cap">{t('Sort by: Market cap')}</option><option value="price">{t('Sort by: Price')}</option><option value="name">{t('Sort by: Company name')}</option></select></label></div>
    <div className="company-sector-filters" role="group" aria-label={t('Filter by sector')}>{sectors.map(name=><button type="button" key={name} className={sector===name?'selected':''} aria-pressed={sector===name} onClick={()=>setSector(name)}>{t(name)} <small>{name==='All sectors'?companies.length:sectorCounts[name]}</small></button>)}</div>
    <div className="company-table-wrap"><table className="market-company-table"><thead><tr><th scope="col">#</th><th scope="col">{t('Company')}</th><th scope="col">{t('Sector')}</th><th scope="col">{t('Price')}</th><th scope="col">{t('Change (1D)')}</th><th scope="col">{t('Market cap')}</th><th scope="col">{t('Trend')}</th><th scope="col"><span className="sr-only">{t('Open company')}</span></th></tr></thead><tbody>{visible.map((company,index)=><tr key={company.ticker} onClick={()=>{onChoose(company);onClose()}} tabIndex="0" onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onChoose(company);onClose()}}}><td>{index+1}</td><td><span className="market-table-company"><i style={{'--company-color':company.color}}>{company.ticker.slice(0,1)}</i><span><strong>{company.name.replace(' Corporation','').replace(' Inc.','')}</strong><small>{company.ticker}</small></span></span></td><td><span className={'market-sector-tag sector-'+company.sector.toLowerCase().replaceAll(' ','-')}>{t(company.sector)}</span></td><td dir="ltr">{money(company.price)}</td><td><strong className={company.change<0?'negative':'positive'}>{percent(company.change)} {company.change<0?'▼':'▲'}</strong></td><td dir="ltr">${company.cap}</td><td><PriceChart company={company} compact/></td><td><button type="button" className="market-row-open" aria-label={t('Open {ticker} profile',{ticker:company.ticker})} onClick={event=>{event.stopPropagation();onChoose(company);onClose()}}>›</button></td></tr>)}</tbody></table>{!visible.length&&<p className="market-company-empty">{t('No companies match your search.')}</p>}</div>
    <footer className="company-market-footer"><span>{t('Showing {count} sample companies in {market}',{count:visible.length,market:t(activeMarket)})}</span><span>{t('Company membership is illustrative')}</span></footer>
   </div>
  </div>
 </Dialog>;
}
