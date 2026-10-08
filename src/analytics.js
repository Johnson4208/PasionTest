export function movingAverage(values,window=10){return values.map((_,i)=>i<window-1?null:values.slice(i-window+1,i+1).reduce((sum,n)=>sum+n,0)/window)}
export function rsi(values,window=14){
 if(values.length<=window)return null;
 const changes=values.slice(-window-1).slice(1).map((n,i)=>n-values[values.length-window-1+i]);
 const gains=changes.reduce((sum,n)=>sum+Math.max(n,0),0)/window,losses=changes.reduce((sum,n)=>sum+Math.max(-n,0),0)/window;
 return !gains&&!losses?50:!losses?100:100-100/(1+gains/losses);
}
export function tradeSizing({capital,risk,entry,stop,target,direction='Long'}){
 const inputs=[capital,risk,entry,stop,target];
 if(inputs.some(n=>!Number.isFinite(n))||capital<=0||risk<=0||risk>100||entry<=0||stop<=0||target<=0)return {error:'Enter positive prices, capital, and a risk percentage between 0 and 100.'};
 if(direction==='Long'?(stop>=entry||target<=entry):(stop<=entry||target>=entry))return {error:direction==='Long'?'For a long trade, the stop must be below entry and the target above entry.':'For a short trade, the stop must be above entry and the target below entry.'};
 const riskBudget=capital*risk/100,unitRisk=Math.abs(entry-stop),unitReward=Math.abs(target-entry);
 const shares=Math.floor(Math.min(riskBudget/unitRisk,capital/entry));
 return {shares,riskBudget,maxLoss:shares*unitRisk,potentialProfit:shares*unitReward,positionValue:shares*entry,ratio:unitReward/unitRisk};
}
export function downloadCSV(filename,rows){
 const csv=rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
