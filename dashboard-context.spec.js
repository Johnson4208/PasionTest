import {test,expect} from '@playwright/test';

const storageKey='pasion-watchlist:pulse-test@example.com';
test.beforeEach(async({page})=>{
 await page.route('**/api/session',route=>route.fulfill({json:{authenticated:true,isAdmin:false,user:{name:'Pulse Tester',email:'pulse-test@example.com'}}}));
});
async function go(page,name){
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true}).click();
}

test('dashboard shows stock markets above the watchlist and browses all nine indices',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 const pulse=page.locator('.market-pulse-card');
 await expect(pulse.getByRole('heading',{name:'Market pulse',exact:true})).toBeVisible();
 await expect(pulse.getByRole('tab',{name:'Stock Market',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.locator('.summary-strip')).toHaveCount(0);
 await expect(page.locator('.dashboard-right > .home-card').first()).toHaveClass(/macro-card/);
 await expect(page.locator('.dashboard-right .macro-card').getByRole('heading',{name:'Macro context'})).toBeVisible();
 await expect(page.locator('.dashboard-right .macro-row')).toContainText(['GDP (QoQ)','CPI (YoY)','10Y Treasury']);
 await expect(pulse.locator('.market-pulse-instrument')).toHaveCount(3);
 await expect(pulse.getByRole('button',{name:'Previous markets'})).toBeDisabled();
 const seen=new Set();
 for(let turn=0;turn<9;turn++){
  for(const name of await pulse.locator('.market-pulse-name h3').allTextContents())seen.add(name);
  if(await pulse.getByRole('button',{name:'Next markets'}).isDisabled())break;
  await pulse.getByRole('button',{name:'Next markets'}).click();
 }
 expect(seen.size).toBe(9);
 await expect(pulse.getByRole('button',{name:'Next markets'})).toBeDisabled();
 while(await pulse.getByRole('button',{name:'Previous markets'}).isEnabled())await pulse.getByRole('button',{name:'Previous markets'}).click();
 await expect(pulse.locator('.market-pulse-name h3').first()).toHaveText('S&P 500');
 const context=await page.locator('.dashboard-context').boundingBox();
 const watchlist=await page.locator('.watch-card').boundingBox();
 const panels=await page.locator('.dashboard-context > .home-card').evaluateAll(elements=>elements.map(element=>{const box=element.getBoundingClientRect();return {x:box.x,y:box.y,width:box.width};}));
 expect(context.y+context.height).toBeLessThan(watchlist.y);
 expect(panels[1].x).toBeGreaterThan(panels[0].x+panels[0].width);
 expect(panels[1].y).toBeCloseTo(panels[0].y,0);
 await page.locator('.dashboard-context').screenshot({path:'artifacts/ui/dashboard-market-pulse-light.png'});
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.locator('.dashboard-context').screenshot({path:'artifacts/ui/dashboard-market-pulse-dark.png'});
 expect(errors).toEqual([]);
});

test('market categories have separate graphs, navigation and crypto precision',async({page})=>{
 await page.goto('/');
 const pulse=page.locator('.market-pulse-card');
 await expect(pulse.getByRole('tab')).toHaveText(['Stock Market','Commodity market','Cryptos']);
 await pulse.getByRole('button',{name:'Next markets'}).click();
 await expect(pulse.locator('.market-pulse-name h3').first()).toHaveText('FTSE 100');
 await pulse.getByRole('tab',{name:'Commodity market',exact:true}).click();
 await expect(pulse.locator('.market-pulse-name h3')).toHaveText(['Gold','Brent oil','Silver']);
 await expect(pulse.getByRole('button',{name:'Previous markets'})).toBeDisabled();
 await expect(pulse.getByRole('button',{name:'Next markets'})).toBeDisabled();
 await pulse.getByRole('tab',{name:'Cryptos',exact:true}).click();
 await expect(pulse.locator('.market-pulse-name h3')).toHaveText(['Bitcoin','Ethereum','Solana']);
 await pulse.getByRole('button',{name:'Next markets'}).click();
 await expect(pulse.locator('.market-pulse-name h3')).toHaveText(['BNB','XRP','Dogecoin']);
 await expect(pulse.locator('.market-pulse-instrument').filter({hasText:'XRP'}).locator('.market-pulse-value')).toHaveText('0.5246');
 await expect(pulse.locator('.market-pulse-instrument').filter({hasText:'Dogecoin'}).locator('.market-pulse-value')).toHaveText('0.1284');
 await expect(pulse.getByRole('button',{name:'Next markets'})).toBeDisabled();
 await pulse.getByRole('tab',{name:'Stock Market',exact:true}).click();
 await expect(pulse.locator('.market-pulse-name h3').first()).toHaveText('FTSE 100');
 await pulse.getByRole('tab',{name:'Stock Market',exact:true}).press('ArrowRight');
 await expect(pulse.getByRole('tab',{name:'Commodity market',exact:true})).toBeFocused();
 await expect(pulse.getByRole('tabpanel',{name:'Commodity market',exact:true})).toBeVisible();
 await pulse.getByRole('tab',{name:'Commodity market',exact:true}).press('End');
 await expect(pulse.getByRole('tab',{name:'Cryptos',exact:true})).toBeFocused();
 await expect(pulse.locator('.market-pulse-name h3').first()).toHaveText('BNB');
 await pulse.screenshot({path:'artifacts/ui/dashboard-cryptos-light.png'});
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 await pulse.screenshot({path:'artifacts/ui/dashboard-cryptos-dark.png'});
});

test('dashboard shares triggered and monitoring alerts with the watchlist',async({page})=>{
 await page.goto('/');
 await go(page,'Watchlist & Alerts');
 await page.getByLabel('Alert company').selectOption('AAPL');
 await page.getByLabel('Alert target (USD)').fill('180');
 await page.getByRole('button',{name:'Create alert'}).click();
 await page.getByLabel('Alert company').selectOption('NVDA');
 await page.getByLabel('Alert target (USD)').fill('500');
 await page.getByRole('button',{name:'Create alert'}).click();
 await go(page,'Dashboard');
 const context=page.locator('.dashboard-context');
 await expect(context).toContainText('AAPL price target');
 await expect(context).toContainText('Target reached');
 await expect(context).toContainText('NVDA price target');
 await expect(context).toContainText('Monitoring');
 await expect(context).toContainText('NVDA moving lower');
 await context.getByRole('button',{name:'Manage alerts'}).click();
 await expect(page.getByRole('heading',{name:'Your price alerts'})).toBeVisible();
 await page.locator('.saved-plans > div').filter({hasText:'AAPL'}).getByRole('button',{name:'Acknowledge alert'}).click();
 await go(page,'Dashboard');
 await expect(context).not.toContainText('AAPL price target');
 await expect(context).toContainText('NVDA price target');
 await context.getByRole('button',{name:'Review risk'}).click();
 await expect(page.getByRole('heading',{name:'Portfolio Risk',exact:true})).toBeVisible();
});

test('empty saved data stays calm and dashboard panels fit mobile and Arabic',async({page})=>{
 await page.addInitScript(key=>{
  localStorage.setItem(key,'[]');
  localStorage.setItem(key+'-portfolio','[]');
  localStorage.setItem(key+'-alerts',JSON.stringify([null,{ticker:'UNKNOWN',target:180},{ticker:'AAPL',target:-1}]));
 },storageKey);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.locator('.dashboard-context')).toContainText('No alerts or risk signals');
 await expect(page.locator('.market-pulse-instrument')).toHaveCount(1);
 for(const width of [390,768]){
  await page.setViewportSize({width,height:1000});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('.home-topbar .preference-language select').selectOption('ar');
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.locator('.dashboard-context').screenshot({path:'artifacts/ui/dashboard-market-pulse-mobile-arabic.png'});
});

test('dashboard risk signals follow saved portfolio cost and allocation',async({page})=>{
 await page.addInitScript(key=>{
  localStorage.setItem(key,JSON.stringify(['AAPL','XOM']));
  localStorage.setItem(key+'-portfolio',JSON.stringify([{ticker:'AAPL',shares:2,cost:200},{ticker:'XOM',shares:1,cost:140}]));
 },storageKey);
 await page.goto('/');
 const panel=page.locator('.dashboard-alerts');
 await expect(panel).toContainText('Technology is 76% of portfolio value.');
 await expect(panel).toContainText('Portfolio below cost');
 await expect(panel).toContainText('$44.64 unrealized loss');
 await expect(panel).toContainText('AAPL below cost');
 await panel.getByRole('button',{name:'Review risk'}).click();
 await expect(page.locator('.portfolio-stats > div').nth(1)).toContainText('-$44.64');
 await page.getByRole('button',{name:'Remove AAPL position',exact:true}).click();
 await go(page,'Dashboard');
 await expect(panel).toContainText('Energy is 100% of portfolio value.');
 await expect(panel).not.toContainText('AAPL below cost');
 await expect(panel).toContainText('$23.48 unrealized loss');
});
