import React from 'react';
import MarketPulse from './MarketPulse';
import DashboardAlerts from './DashboardAlerts';
import {usePreferences} from './Preferences';
import './dashboard-context.scss';

export default function DashboardContext({storageKey,watched,onNavigate,onChoose}) {
 const {t}=usePreferences();
 return <div className="dashboard-context" role="region" aria-label={t('Market context and alerts')}>
  <MarketPulse/>
  <DashboardAlerts storageKey={storageKey} watched={watched} onNavigate={onNavigate} onChoose={onChoose}/>
 </div>;
}
