import React, {useEffect, useId, useRef, useState} from 'react';
import PriceChart from './PriceChart';
import {usePreferences} from './Preferences';
import {marketPulseCategories, marketPulseInstruments} from './marketPulseData';
import MarketExplorer from './MarketExplorer';
import './market-pulse.scss';

function Arrow({previous = false}) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={previous ? 'm14 6-6 6 6 6' : 'm10 6 6 6-6 6'}/></svg>;
}

export default function MarketPulse() {
  const {t, language} = usePreferences();
  const titleId = useId();
  const listId = useId();
  const listRef = useRef(null);
  const tabRefs = useRef({});
  const [visibleCount, setVisibleCount] = useState(3);
  const [category, setCategory] = useState('stocks');
  const [positions, setPositions] = useState({});
  const [exploring, setExploring] = useState(false);
  const [extraMarkets, setExtraMarkets] = useState([]);
  const instruments = marketPulseInstruments.filter(instrument => instrument.category === category || extraMarkets.includes(instrument.ticker));
  const availableInstruments = marketPulseInstruments.filter(instrument => instrument.category === category);
  const total = instruments.length;
  const count = Math.min(visibleCount, total);
  const start = Math.min(positions[category] || 0, Math.max(0, total - count));
  const panelId = listId + '-' + category;

  useEffect(() => {
    const element = listRef.current;
    function updateCount() {
      const width = element.clientWidth;
      const viewportLimit = window.innerWidth <= 650 ? 1 : window.innerWidth <= 1050 ? 2 : 4;
      const count = Math.min(viewportLimit, width >= 800 ? 4 : width >= 600 ? 3 : width >= 380 ? 2 : 1);
      setVisibleCount(count);
    }
    updateCount();
    const observer = new ResizeObserver(updateCount);
    observer.observe(element);
    window.addEventListener('resize', updateCount);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateCount);
    };
  }, []);

  const changeFormatter = new Intl.NumberFormat(language, {style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always'});
  const end = Math.min(start + count, total);

  function browse(direction) {
    setPositions(previous => ({...previous, [category]: Math.max(0, Math.min(total - count, start + direction * count))}));
  }

  function navigateTabs(event, index) {
    const direction = language === 'ar' ? -1 : 1;
    let next;
    if (event.key === 'ArrowRight') next = (index + direction + marketPulseCategories.length) % marketPulseCategories.length;
    else if (event.key === 'ArrowLeft') next = (index - direction + marketPulseCategories.length) % marketPulseCategories.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = marketPulseCategories.length - 1;
    else return;
    event.preventDefault();
    setCategory(marketPulseCategories[next].id);
    tabRefs.current[marketPulseCategories[next].id]?.focus();
  }

  return <section className="home-card market-pulse-card" aria-labelledby={titleId}>
    <header className="market-pulse-header">
      <div className="market-pulse-heading">
        <span className="market-pulse-eyebrow">{t('WORLD MARKETS · DAILY CONTEXT')}</span>
        <h2 id={titleId}>{t('Market pulse')}</h2>
        <span>{t('World indices, commodities & crypto')}</span>
      </div>
      <div className="market-pulse-controls">
        <span className="market-pulse-feed"><i aria-hidden="true"/>{t('Sample data · no live feed')}</span>
        <button className="market-explore-button" type="button" onClick={() => setExploring(true)}>{t('Explore Markets')}</button>
        <div className="market-pulse-arrows">
          <button type="button" aria-label={t('Previous markets')} aria-controls={panelId} disabled={start === 0} onClick={() => browse(-1)}><Arrow previous/></button>
          <button type="button" aria-label={t('Next markets')} aria-controls={panelId} disabled={end === total} onClick={() => browse(1)}><Arrow/></button>
        </div>
      </div>
    </header>
    <div className="market-pulse-tabs" role="tablist" aria-label={t('Market categories')}>
      {marketPulseCategories.map((item, index) => <button key={item.id} ref={element => {tabRefs.current[item.id] = element;}} type="button" role="tab" id={listId + '-' + item.id + '-tab'} aria-selected={category === item.id} aria-controls={listId + '-' + item.id} tabIndex={category === item.id ? 0 : -1} onClick={() => setCategory(item.id)} onKeyDown={event => navigateTabs(event, index)}>{t(item.label)}</button>)}<button type="button" className="market-pulse-add" aria-label={t('Add markets to watch')} title={t('Add markets to watch')} onClick={()=>setExploring(true)}>+</button>
    </div>
    <div role="tabpanel" id={panelId} aria-labelledby={panelId + '-tab'} tabIndex="0">
    <ul ref={listRef} className="market-pulse-instruments" style={{'--pulse-visible': count}}>
      {instruments.slice(start, end).map(instrument => <li className={'market-pulse-instrument ' + (instrument.change < 0 ? 'is-down' : 'is-up')} key={instrument.ticker}>
        <span className="market-pulse-region">{t(instrument.region)}</span>
        <div className="market-pulse-name"><h3>{t(instrument.name)}</h3><span aria-hidden="true">{instrument.change < 0 ? '↘' : '↗'}</span></div>
        <strong className="market-pulse-value" dir="ltr">{new Intl.NumberFormat(language, {minimumFractionDigits: instrument.precision ?? 2, maximumFractionDigits: instrument.precision ?? 2}).format(instrument.price)}</strong>
        <div className="market-pulse-quote"><span className="market-pulse-change" dir="ltr">{changeFormatter.format(instrument.change / 100)}</span><small>{t(instrument.unit)}</small></div>
        <PriceChart company={instrument} compact/>
      </li>)}
    </ul>
    </div>
    <footer className="market-pulse-footer"><span role="status" aria-live="polite" aria-atomic="true">{t('{start}–{end} of {total} markets', {start: start + 1, end, total})}</span><span>{t('Sample session change')}</span></footer>
    {exploring && <MarketExplorer onClose={()=>setExploring(false)} addedMarkets={extraMarkets} onAddMarket={ticker=>setExtraMarkets(current=>[...new Set([...current,ticker])])}/>}
  </section>;
}
