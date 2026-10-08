import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.route('**/api/session',r=>r.fulfill({json:{authenticated:true,isAdmin:false,user:{name:'Analytics Tester',email:'analytics@example.com'}}}));});
async function open(page,name){await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true}).click();}
test('sidebar has the complete grouped menu and comparison controls work',async({page})=>{
 await page.goto('/');const nav=page.getByRole('navigation',{name:'Main navigation'});
 const labels=['Dashboard','Compare Companies','Stock Analytics','Indicators & VSA','Investment Research','Trade Planner','Macro Regime Monitor','Event Scenarios','Company News','Data Sources & Reports','Portfolio Risk','Watchlist & Alerts'];
 await expect(nav.getByRole('button')).toHaveText(labels);await expect(nav).toContainText('ANALYTICS');await expect(nav).toContainText('DATA');
 await open(page,'Compare Companies');await expect(page.locator('.comparison-table thead th')).toHaveCount(4);
 await page.getByRole('group',{name:'Companies to compare'}).getByRole('button',{name:'NVDA'}).click();await expect(page.locator('.comparison-table thead th')).toHaveCount(3);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export comparison'}).click();expect((await download).suggestedFilename()).toContain('comparison');
 await page.screenshot({path:'test-results/company-comparison.png',fullPage:true});
 await page.locator('.comparison-table').getByRole('button',{name:'AAPL'}).click();await expect(page.getByRole('heading',{name:'Investment Research',exact:true})).toBeVisible();
});
test('stock, indicator, macro and event controls update their views',async({page})=>{
 await page.goto('/');await open(page,'Stock Analytics');await page.getByLabel('Company',{exact:true}).selectOption('JPM');await expect(page.getByRole('heading',{name:'JPMorgan Chase & Co.'})).toBeVisible();await page.getByRole('button',{name:'1Y',exact:true}).click();await expect(page.getByRole('img',{name:'JPM illustrative 1Y price chart'})).toBeVisible();
 await open(page,'Indicators & VSA');await page.getByLabel('Moving average period').selectOption('20');await expect(page.locator('.analytics-stat')).toContainText(['14-point RSI','20-point SMA','Relative sample volume','Trend context']);await expect(page.locator('.indicator-chart polyline')).toHaveCount(2);await page.getByLabel('Show moving average').uncheck();await expect(page.locator('.indicator-chart polyline')).toHaveCount(1);
 await open(page,'Macro Regime Monitor');await page.getByRole('slider',{name:/GDP growth/}).fill('-1');await expect(page.getByRole('heading',{name:'Contraction',exact:true})).toBeVisible();await page.getByRole('button',{name:'Reset scenario'}).click();await expect(page.getByRole('heading',{name:'Balanced expansion',exact:true})).toBeVisible();
 await open(page,'Event Scenarios');await page.getByRole('button',{name:'Energy supply shock',exact:true}).click();await page.getByRole('slider',{name:/Shock magnitude/}).fill('0');for(const cell of await page.locator('.scenario-impacts>div>b').all())await expect(cell).toHaveText('+0.00%');await page.getByLabel('Company scope').selectOption('Watchlist');await expect(page.locator('.scenario-impacts>div')).toHaveCount(5);
});
test('trade plans validate risk, persist and export without placing orders',async({page})=>{
 await page.goto('/');await open(page,'Trade Planner');
 await page.getByLabel('Entry price (USD)').fill('100');await page.getByLabel('Stop price (USD)').fill('95');await page.getByLabel('Target price (USD)').fill('110');await expect(page.locator('.trade-shares strong')).toHaveText('20');await page.getByRole('button',{name:'Save trade plan'}).click();await expect(page.locator('.saved-plans')).toContainText('20 shares');
 await page.reload();await expect(page.locator('.saved-plans')).toContainText('20 shares');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export plans'}).click();expect((await download).suggestedFilename()).toBe('pasion-trade-plans.csv');
 await page.getByLabel('Stop price (USD)').fill('200');await expect(page.getByRole('button',{name:'Save trade plan'})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('stop must be below entry');
 await page.getByRole('button',{name:'Delete plan'}).click();await expect(page.locator('.saved-plans')).toContainText('Your saved plans will appear here');
});
test('watchlist alerts are shared with portfolio and data reports download',async({page})=>{
 await page.goto('/');await open(page,'Watchlist & Alerts');await page.getByLabel('Alert company').selectOption('AAPL');await page.getByLabel('Alert target (USD)').fill('180');await page.getByRole('button',{name:'Create alert'}).click();await expect(page.locator('.saved-plans')).toContainText('Target reached');await open(page,'Portfolio Risk');await expect(page.locator('.recent-alerts')).toContainText('AAPL — Price target reached');
 await open(page,'Data Sources & Reports');await expect(page.locator('.source-inventory article')).toHaveCount(5);await page.getByRole('button',{name:'Reports',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download company report'}).click();expect((await download).suggestedFilename()).toContain('company-universe');
 await page.getByRole('button',{name:'Connection status',exact:true}).click();await expect(page.locator('.connection-list')).toContainText('Not connected');
});
test('all sidebar destinations fit mobile and support direct routes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:390,height:844});await page.goto('/');
 const labels=['Dashboard','Compare Companies','Stock Analytics','Indicators & VSA','Investment Research','Trade Planner','Macro Regime Monitor','Event Scenarios','Company News','Data Sources & Reports','Portfolio Risk','Watchlist & Alerts'];
 for(const name of labels){await page.getByRole('button',{name:'Open navigation'}).click();await open(page,name);await expect(page.getByRole('button',{name:'Close navigation'})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth),name).toBeLessThanOrEqual(390)}
 await page.goto('/#trade-planner');await expect(page.getByRole('heading',{name:'Trade Planner',exact:true})).toBeVisible();await page.screenshot({path:'test-results/mobile-trade-planner.png',fullPage:true});expect(errors).toEqual([]);
});
