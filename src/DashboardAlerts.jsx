import React, {useEffect, useState} from 'react';
import {companies, money, percent} from './marketData';
import {usePreferences} from './Preferences';
import './dashboard-alerts.scss';

// Match the portfolio's initial positions when this account has no saved holdings.
const initialHoldings = [
  {ticker: 'AAPL', shares: 25, cost: 175},
  {ticker: 'MSFT', shares: 12, cost: 480},
  {ticker: 'JPM', shares: 20, cost: 190},
  {ticker: 'XOM', shares: 30, cost: 120},
];
const companyByTicker = new Map(companies.map(company => [company.ticker, company]));

function readArray(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

function readSignals(storageKey) {
  return {
    holdings: readArray(storageKey + '-portfolio', initialHoldings).filter(holding =>
      holding && companyByTicker.has(holding.ticker) &&
      Number.isFinite(holding.shares) && holding.shares > 0 &&
      Number.isFinite(holding.cost) && holding.cost >= 0 &&
      Number.isFinite(holding.shares * holding.cost) &&
      Number.isFinite(holding.shares * companyByTicker.get(holding.ticker).price)
    ),
    alerts: readArray(storageKey + '-alerts', []).filter(alert =>
      alert && companyByTicker.has(alert.ticker) &&
      Number.isFinite(alert.target) && alert.target > 0 && !alert.acknowledged
    ),
  };
}

function SignalIcon({type}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'monitoring' ? <><path d="M6 9a6 6 0 0 1 12 0v6l2 3H4l2-3V9"/><path d="M10 21h4"/></> :
      type === 'danger' ? <><path d="m5 7 6 6 4-4 5 8"/><path d="M15 17h5v-5"/></> :
        <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.1"/></>}
  </svg>;
}

export default function DashboardAlerts({storageKey, watched = [], onNavigate, onChoose}) {
  const {t} = usePreferences();
  const [saved, setSaved] = useState(() => readSignals(storageKey));

  useEffect(() => {
    const refresh = () => setSaved(readSignals(storageKey));
    const sync = event => {
      if (event.key === null || event.key === storageKey + '-portfolio' || event.key === storageKey + '-alerts') refresh();
    };
    refresh();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', refresh);
    };
  }, [storageKey]);

  const triggered = [], monitoring = [], risks = [];
  saved.alerts.forEach((alert, index) => {
    const company = companyByTicker.get(alert.ticker);
    const reached = company.price >= alert.target;
    const signal = {
      id: 'alert-' + index,
      type: reached ? 'warning' : 'monitoring',
      title: t('{ticker} price target', {ticker: company.ticker}),
      detail: t('Target {target} · sample {price}', {target: money(alert.target), price: money(company.price)}),
      label: t(reached ? 'Target reached' : 'Monitoring'),
      action: () => onNavigate('Portfolio', 'Alerts'),
    };
    (reached ? triggered : monitoring).push(signal);
  });

  watched.filter(company => company && Number.isFinite(company.change) && company.change < 0)
    .sort((a, b) => a.change - b.change).forEach(company => risks.push({
      id: 'downside-' + company.ticker,
      type: 'danger',
      title: t('{ticker} moving lower', {ticker: company.ticker}),
      detail: t('{change} in the sample session.', {change: percent(company.change)}),
      label: percent(company.change),
      action: () => onChoose(company),
    }));

  const positions = saved.holdings.map(holding => ({...holding, company: companyByTicker.get(holding.ticker)}));
  const total = positions.reduce((sum, holding) => sum + holding.shares * holding.company.price, 0);
  const invested = positions.reduce((sum, holding) => sum + holding.shares * holding.cost, 0);
  const exposure = new Map();
  positions.forEach(holding => exposure.set(holding.company.sector,
    (exposure.get(holding.company.sector) || 0) + holding.shares * holding.company.price));
  const largestSector = [...exposure].sort((a, b) => b[1] - a[1])[0];
  const concentration = total ? (largestSector?.[1] || 0) / total * 100 : 0;
  if (Math.round(concentration) > 50) risks.push({
    id: 'concentration',
    type: 'warning',
    title: t('Sector concentration'),
    detail: t('{sector} is {percent}% of portfolio value.', {sector: t(largestSector[0]), percent: Math.round(concentration)}),
    label: Math.round(concentration) + '%',
    action: () => onNavigate('Portfolio'),
  });
  if (total < invested) risks.push({
    id: 'portfolio-loss',
    type: 'danger',
    title: t('Portfolio below cost'),
    detail: t('{loss} unrealized loss ({percent}).', {loss: money(invested - total), percent: percent((total - invested) / invested * 100)}),
    label: percent((total - invested) / invested * 100),
    action: () => onNavigate('Portfolio'),
  });
  positions.forEach((holding, index) => {
    if (holding.company.price >= holding.cost) return;
    const change = (holding.company.price - holding.cost) / holding.cost * 100;
    risks.push({
      id: 'position-loss-' + index,
      type: 'danger',
      title: t('{ticker} below cost', {ticker: holding.ticker}),
      detail: t('{loss} below purchase cost ({percent}).', {loss: money(holding.shares * (holding.cost - holding.company.price)), percent: percent(change)}),
      label: percent(change),
      action: () => onNavigate('Portfolio'),
    });
  });

  const signals = [...triggered, ...risks, ...monitoring];
  const attentionCount = triggered.length + risks.length;
  return <section className="home-card dashboard-alerts" aria-label={t('Alerts & risk')}>
    <header className="dashboard-alerts-heading">
      <div><span className="eyebrow">{t('YOUR ATTENTION')}</span><h2>{t('Alerts & risk')}</h2></div>
      <span className={'dashboard-alerts-emblem' + (!attentionCount ? ' is-clear' : '')}><SignalIcon type="monitoring"/></span>
    </header>
    <div className="dashboard-alerts-status">
      <span className={attentionCount ? 'has-attention' : ''}><i/>{t('{count} need attention', {count: attentionCount})}</span>
      <span>{t('{count} monitoring', {count: monitoring.length})}</span>
    </div>
    {signals.length ? <ul className="dashboard-alerts-list" tabIndex="0" aria-label={t('Alerts & risk')}>
      {signals.map(signal => <li key={signal.id}><button className={'dashboard-alerts-item is-' + signal.type} onClick={signal.action}>
        <span className="dashboard-alerts-icon"><SignalIcon type={signal.type}/></span>
        <span className="dashboard-alerts-copy"><span className="dashboard-alerts-line"><strong>{signal.title}</strong><b>{signal.label}</b></span><small>{signal.detail}</small></span>
      </button></li>)}
    </ul> : <div className="dashboard-alerts-empty"><SignalIcon type="monitoring"/><strong>{t('No alerts or risk signals')}</strong><p>{t('Create a price target or add companies to your watchlist.')}</p></div>}
    <footer><div className="dashboard-alerts-actions"><button onClick={() => onNavigate('Portfolio', 'Alerts')}>{t('Manage alerts')} <span aria-hidden="true">→</span></button><button onClick={() => onNavigate('Portfolio', 'Holdings')}>{t('Review risk')} <span aria-hidden="true">→</span></button></div><small>{t('Sample signals · saved locally')}</small></footer>
  </section>;
}
