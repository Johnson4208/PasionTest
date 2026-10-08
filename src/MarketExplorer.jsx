import React, {useMemo, useState} from 'react';
import Dialog from './Dialog';
import {marketPulseInstruments} from './marketPulseData';
import {usePreferences} from './Preferences';

const featuredMarkets=['VNINDEX','SPX','IXIC','DJI','FTSE','DAX','N225','HSI','SSE','BTC','BRENT'];
const chartCards=[['price','Price & volume'],['intraday','Intraday performance'],['average','Moving average'],['rsi','RSI'],['macd','MACD'],['breadth','Market breadth'],['advance','Advance/decline'],['highs','New highs vs new lows'],['profile','Volume profile'],['sectors','Sector performance'],['fear','VIX / Market fear']];

function Chart({type,seed,negative}) {
  const color=negative?'#d94f68':'#2ca987', blue='#4388d5', orange='#e7a043';
  const points=Array.from({length:38},(_,i)=>{
    const drift=negative?-.38:.38;
    const wave=Math.sin((i+seed)*.73)*7+Math.sin((i+seed)*.21)*5+Math.cos((i+seed)*1.47)*3;
    return [4+i*4.1,38-drift*i-wave];
  });
  const path=points.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(1)},${Math.max(7,Math.min(67,y)).toFixed(1)}`).join(' ');
  const secondary=points.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(1)},${Math.max(9,Math.min(65,y+Math.sin(i*.38+seed)*7+(negative?7:-7))).toFixed(1)}`).join(' ');
  if(type==='profile')return <div className="explorer-volume-profile" aria-label="Illustrative volume profile">{Array.from({length:8},(_,i)=><i key={i} style={{width:`${36+((i*29+seed*17)%59)}%`}}/>)}</div>;
  if(type==='sectors')return <div className="explorer-sector-blocks">{[['Technology','+1.8%'],['Healthcare','+0.3%'],['Financials','+0.4%'],['Consumer','+0.7%'],['Energy','−1.2%'],['Others','+0.1%']].map(([name,value],i)=><span className={i===4?'down':''} key={name}>{name}<b>{value}</b></span>)}</div>;
  if(type==='breadth'||type==='highs')return <div className={'explorer-bars '+(type==='highs'?'paired':'')}>{Array.from({length:22},(_,i)=><span key={i} style={{'--bar-height':`${23+((i*31+seed*11)%69)}%`,'--bar-alt':`${14+((i*23+seed*13)%45)}%`}}/>)}</div>;
  return <svg className={'explorer-chart-svg '+(type==='macd'?'is-macd':'')} viewBox="0 0 164 76" preserveAspectRatio="none" role="img" aria-label="Illustrative market chart"><path className="explorer-chart-grid" d="M0 17H164M0 38H164M0 59H164"/>{type==='price'&&<g className="explorer-volume-bars">{Array.from({length:20},(_,i)=><rect key={i} x={i*8.1+1} y={68-(10+((i*17+seed*9)%24))} width="3.8" height={10+((i*17+seed*9)%24)}/>)}</g>}{type==='macd'&&<g className="explorer-macd-bars">{Array.from({length:27},(_,i)=><rect key={i} x={i*6.1+1} y={37+Math.sin(i*.73+seed)*16} width="3.4" height={Math.abs(Math.sin(i*.73+seed)*16)}/>)}</g>}{['average','intraday','advance','macd'].includes(type)&&<path d={secondary} fill="none" stroke={orange} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>}<path d={path} fill="none" stroke={type==='rsi'?'#8d74cf':color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>{type==='rsi'&&<path d="M0 23H164M0 53H164" stroke="#d9d0ef" strokeDasharray="3 4"/>}</svg>;
}

export default function MarketExplorer({onClose,addedMarkets,onAddMarket}) {
  const {t}=usePreferences();
  const [selected,setSelected]=useState('SPX');
  const [showAdd,setShowAdd]=useState(false);
  const instruments=useMemo(()=>marketPulseInstruments,[]);
  const watching=[...new Set([...featuredMarkets,...addedMarkets])];
  const market=instruments.find(item=>item.ticker===selected)||instruments[0];
  const available=instruments.filter(item=>!watching.includes(item.ticker));
  const addMarket=(event)=>{const value=event.target.value;if(!value)return;onAddMarket(value);setSelected(value);setShowAdd(false);event.target.value='';};
  const price=new Intl.NumberFormat('en-US',{minimumFractionDigits:market.precision,maximumFractionDigits:market.precision}).format(market.price);
  const change=(market.change>=0?'+':'')+market.change.toFixed(2)+'%';
  const sampleSeed=market.index||0;
  const detailCards=market.category==='stocks'?[
    ['VNINDEX','Vietnam index','Foreign net flow · Market breadth'],['S&P 500','Large-cap US equities','VIX · Sectors · Advance/decline'],['NASDAQ','US technology shares','Nasdaq breadth · Tech volatility'],['Commodities','Materials & energy','Open interest · Futures curve'],['Crypto','Digital assets','Funding rate · Open interest'],
  ]:[['Price trend',market.name,'Session move · Recent range'],['Relative strength',market.category==='crypto'?'Digital assets':'Commodities','Momentum · Volatility'],['Volume profile',market.name,'Trading activity · Liquidity'],['Related markets',market.region,'Cross-market moves · Correlation'],['Market context','Illustrative indicators','Risk appetite · Sentiment']];
  return <Dialog title={t('Explore the market in depth')} className="market-explorer-dialog" onClose={onClose}>
    <div className="market-explorer-heading"><div><span className="eyebrow">{t('MARKET EXPLORER')}</span><p>{t('View detailed charts, key indicators, and market insights for the selected market.')}</p></div><div className="market-selected-summary"><span className="market-flag">{market.region==='United States'?'🇺🇸':market.region==='United Kingdom'?'🇬🇧':market.region==='Japan'?'🇯🇵':market.region==='Germany'?'🇩🇪':market.region==='Vietnam'?'🇻🇳':market.region==='China'?'🇨🇳':market.category==='crypto'?'◈':'◎'}</span><div><strong>{market.name}</strong><span><b>{price}</b><i className={market.change<0?'negative':'positive'}>{change}</i><small>• {t('Illustrative · no live feed')}</small></span></div></div></div>
    <div className="market-explorer-marketbar"><div className="market-market-tabs" role="tablist" aria-label={t('Markets you follow')}>{watching.map(id=>{const item=instruments.find(value=>value.ticker===id);return item&&<button key={id} role="tab" aria-selected={selected===id} className={selected===id?'selected':''} onClick={()=>setSelected(id)}>{item.name}</button>})}</div><div className="market-add-control"><button type="button" className="market-add-button" aria-expanded={showAdd} aria-label={t('Add a market to follow')} onClick={()=>setShowAdd(value=>!value)}>+</button>{showAdd&&<select autoFocus aria-label={t('Choose a market to add')} value="" onChange={addMarket}><option value="">{t('Add a market…')}</option>{available.map(item=><option key={item.ticker} value={item.ticker}>{item.name} · {item.region}</option>)}</select>}</div></div>
    <section className="market-key-charts"><header><h3>{t('Key charts & indicators')}</h3><span>{market.ticker}</span></header><div className="market-indicator-grid">{chartCards.map(([type,label],index)=><article className={'market-indicator-card indicator-'+type} key={type}><header><h4><i aria-hidden="true">{['⌁','◔','⌁','◌','≋','▥','⌁','▥','▤','◫','⌁'][index]}</i>{t(label)}</h4><span>{market.ticker}</span></header>{type==='price'&&<div className="market-indicator-value">{price}<small className="positive">{change}</small></div>}{type==='fear'&&<div className="market-indicator-value">{market.category==='crypto'?'28.4':'16.24'}<small className="negative">−2.31%</small></div>}{type==='rsi'&&<div className="market-chart-legend"><span>RSI (14)</span><b>52.8</b></div>}{type==='average'&&<div className="market-chart-legend"><span><i className="legend-blue"/> MA20</span><span><i className="legend-orange"/> MA50</span></div>}{type==='intraday'&&<div className="market-chart-legend"><span>Session performance</span><b className={market.change<0?'negative':'positive'}>{change}</b></div>}{type==='breadth'&&<div className="market-chart-legend"><span><i className="legend-green"/> Advancers</span><span><i className="legend-red"/> Decliners</span></div>}{type==='highs'&&<div className="market-chart-legend"><span><i className="legend-green"/> New highs</span><span><i className="legend-red"/> New lows</span></div>}<Chart type={type} seed={sampleSeed+index} negative={market.change<0}/>{['price','intraday','rsi','advance','fear'].includes(type)&&<div className="market-chart-axis"><span>09:30</span><span>12:00</span><span>16:00</span></div>}</article>)}</div></section>
    <section className="market-specific-indicators"><header><div><h3>{t('Market-specific indicators')}</h3><p>{t('Different markets have different key indicators. Choose a market to see its specialized indicators.')}</p></div></header><div className="market-special-grid">{detailCards.map(([title,subtitle,details],index)=><button key={title} type="button" className={index===1&&market.category==='stocks'?'selected':''} onClick={()=>{const linked=instruments.find(item=>item.name===title);if(linked)setSelected(linked.ticker)}}><strong><i aria-hidden="true">{index===0?'◉':index===1?'▤':index===2?'⌁':'◈'}</i>{t(title)}</strong><span>{t(subtitle)}</span><small>· {t(details.split(' · ')[0])}<br/>· {t(details.split(' · ')[1]||details)}</small></button>)}</div></section>
  </Dialog>;
}
