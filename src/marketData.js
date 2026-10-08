export const companies = [
 ['AAPL','Apple Inc.',189.42,1.8,'Technology','2.91T','29.4','Strong iPhone demand and a steady services business.','#132742'],
 ['NVDA','NVIDIA Corporation',427.11,-3.6,'Technology','1.05T','58.2','A pullback on higher volume after a strong run.','#73aa16'],
 ['MSFT','Microsoft Corporation',518.20,.9,'Technology','3.85T','35.1','Continued strength in cloud and enterprise software.','#008ed6'],
 ['AMZN','Amazon.com Inc.',161.34,1.2,'Consumer','1.68T','42.6','Retail efficiency and AWS demand support sentiment.','#d88a19'],
 ['GOOGL','Alphabet Inc.',142.76,.6,'Technology','1.79T','23.8','Advertising demand remains steady in this scenario.','#3976d6'],
 ['JPM','JPMorgan Chase & Co.',204.83,.8,'Financials','586B','12.3','Resilient net interest income and lending activity.','#205881'],
 ['V','Visa Inc.',281.34,1.1,'Financials','559B','30.6','Healthy payment volumes across the network.','#323aa7'],
 ['XOM','Exxon Mobil Corporation',116.52,-.7,'Energy','461B','14.7','Energy prices weigh on the sector in this scenario.','#d74044'],
 ['JNJ','Johnson & Johnson',158.61,.3,'Healthcare','382B','18.5','Defensive healthcare demand supports the shares.','#b2294d'],
 ['TSLA','Tesla Inc.',248.50,-1.4,'Consumer','793B','61.2','Investors weigh deliveries and operating margins.','#cb323f'],
].map(([ticker,name,price,change,sector,cap,pe,detail,color],index)=>({ticker,name,price,change,sector,cap,pe,detail,color,index}));
export const defaultWatchlist = ['AAPL','NVDA','MSFT','AMZN','GOOGL'];
export const articles = [
 {id:1,time:'8:41 AM',category:'Macro',title:'The rate outlook takes center stage',summary:'Investors weigh inflation expectations against a resilient economy.',body:'In this illustrative market briefing, investors are watching inflation, employment, and the path of interest rates. A balanced mix of economic indicators leaves markets focused on upcoming releases. This article is sample editorial content, not a report of current events.'},
 {id:2,time:'7:56 AM',category:'Economy',title:'Business investment stays in focus',summary:'Durable goods and investment trends offer a window into demand.',body:'Orders for durable goods are a useful way to explore the direction of business investment. In this sample scenario, market participants are looking for signs of broad demand and stable financing conditions. All figures and stories in this workspace are illustrative.'},
 {id:3,time:'7:22 AM',category:'Energy',title:'Energy markets watch the supply picture',summary:'Changing supply expectations create a mixed session for energy.',body:'Supply expectations and demand forecasts can influence energy stocks in different ways. This sample story explores how producers and consumers may respond to those changes. It is provided to demonstrate the research experience.'},
 {id:4,time:'6:18 AM',category:'Technology',title:'Cloud and AI remain key research themes',summary:'Enterprise demand and capital spending shape the technology story.',body:'Cloud adoption, enterprise software demand, and investment in AI infrastructure are useful themes for company research. This illustrative briefing highlights those topics without making a live market claim or an investment recommendation.'},
];
export const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
export const percent = value => (value>=0?'+':'')+value.toFixed(2)+'%';
export function chartValues(company,period='1D') {
 const scale={'1D':.012,'1W':.024,'1M':.055,'3M':.09,'1Y':.18}[period]||.012;
 const direction=company.change>=0?1:-1;
 return Array.from({length:36},(_,i)=>company.price*(1+scale*(direction*(i/35-.8)+Math.sin(i*1.5+company.index)*.13+Math.sin(i*.55)*.12)));
}
