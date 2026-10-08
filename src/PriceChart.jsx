import React, {useId,useState} from 'react';
import {chartValues,money} from './marketData';
import {usePreferences} from './Preferences';

export default function PriceChart({company,period='1D',compact=false}) {
 const {t}=usePreferences();
 const [index,setIndex]=useState(null);
 const id=useId().replaceAll(':','');
 const values=chartValues(company,period),min=Math.min(...values),max=Math.max(...values),range=max-min||1;
 const width=500,height=compact?60:180;
 const point=i=>[i*width/(values.length-1),height-12-(values[i]-min)/range*(height-24)];
 const points=values.map((_,i)=>point(i).join(',')).join(' ');
 const current=index===null?null:point(Math.min(index,values.length-1));
 const color=company.change>=0?'var(--pref-chart-up, #1675ed)':'var(--pref-chart-down, #ee3560)';
 return <div className={'price-chart '+(compact?'compact':'')}>
  {!compact&&<div className="chart-readout"><span>{index===null?t('Sample price'):t('Sample point {point}',{point:index+1})}</span><strong dir="ltr">{money(index===null?company.price:values[index])}</strong></div>}
  <svg viewBox={'0 0 '+width+' '+height} preserveAspectRatio="none" role="img" aria-label={t('{ticker} illustrative {period} price chart',{ticker:company.ticker,period})} onPointerMove={compact?undefined:e=>{const box=e.currentTarget.getBoundingClientRect();setIndex(Math.max(0,Math.min(values.length-1,Math.round((e.clientX-box.left)/box.width*(values.length-1)))));}} onPointerLeave={()=>setIndex(null)}>
   <defs><linearGradient id={'chart-'+id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".22"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
   {!compact&&[.2,.5,.8].map(y=><line key={y} x1="0" x2={width} y1={height*y} y2={height*y} stroke="currentColor" strokeOpacity=".07" strokeDasharray="4 5"/>)}
   <polygon points={'0,'+height+' '+points+' '+width+','+height} fill={'url(#chart-'+id+')'}/>
   <polyline points={points} stroke={color} strokeWidth={compact?1.7:2.4} fill="none" vectorEffect="non-scaling-stroke"/>
   {current&&!compact&&<line className="chart-hover-guide" x1={current[0]} x2={current[0]} y1="0" y2={height} stroke={color} strokeOpacity=".3" strokeWidth="1" strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>}
  </svg>
  {!compact&&<><input className="chart-scrubber" type="range" min="0" max={values.length-1} value={index??values.length-1} onChange={e=>setIndex(Number(e.target.value))} aria-label={t('Explore {ticker} chart points',{ticker:company.ticker})}/><div className="chart-axis" dir="ltr"><span>{t(period==='1D'?'09:30':period==='1W'?'Monday':period==='1M'?'Week 1':period==='3M'?'March':'January')}</span><span>{t(period==='1D'?'12:00':period==='1W'?'Wednesday':period==='1M'?'Week 2':period==='3M'?'April':'June')}</span><span>{t(period==='1D'?'16:00':period==='1W'?'Friday':period==='1M'?'Week 4':period==='3M'?'June':'December')}</span></div></>}
 </div>;
}
