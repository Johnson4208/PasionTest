import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.route('**/api/session',route=>route.fulfill({json:{authenticated:true,isAdmin:false,user:{name:'Workspace Tester',email:'workspace-test@example.com'}}}));});
async function go(page,name){name=({Home:'Dashboard',Research:'Investment Research',News:'Company News',Portfolio:'Portfolio Risk'})[name]||name;await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name,exact:true}).click();}
test('research evidence, core value and all layout preferences work',async({page})=>{
 await page.goto('/');await go(page,'Research');
 await expect(page.getByText('28 of 33 checks with usable sample data')).toBeVisible();
 await page.getByRole('button',{name:'Continue to Core Value'}).click();
 await expect(page.getByText('Valuation sensitivities')).toBeVisible();
 await page.getByRole('button',{name:'Evidence',exact:true}).click();
 await expect(page.locator('.peer-evidence').first()).toContainText('Financial statements: sample');
 for(const name of ['Evidence Split','Peer Rail','Research Matrix','Sector Radar','Story and Benchmark']){await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');}
 await page.reload();await expect(page.getByRole('button',{name:'Story and Benchmark',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:'test-results/research-workspace.png',fullPage:true});
});
test('news bookmarks persist, reading modes and plan preview work',async({page})=>{
 await page.goto('/');await go(page,'News');
 await page.getByRole('button',{name:'Save The rate outlook takes center stage',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'Saved stories (1)'}).click();
 await expect(page.locator('.editorial-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Unsave The rate outlook takes center stage'}).click();
 await expect(page.getByText('No stories in this view')).toBeVisible();
 await page.getByRole('button',{name:'Saved stories (0)'}).click();
 for(const name of ['Morning Edition','Three-Desk Newsroom','Reading Focus','Signal Timeline','Topic Library']){await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('.editorial-card')).toHaveCount(4);}
 await page.getByRole('button',{name:'Morning Edition',exact:true}).click();
 await page.screenshot({path:'test-results/news-workspace.png',fullPage:true});
 await page.getByRole('button',{name:'View plans'}).click();await expect(page.getByRole('dialog')).toContainText('Paid subscriptions are not available yet');await page.keyboard.press('Escape');
});
test('portfolio adds positions, updates totals, saves alerts and acknowledges them',async({page})=>{
 await page.goto('/');await go(page,'Portfolio');
 const total=page.locator('.portfolio-stats>div').first().locator('strong');await expect(total).toBeVisible();const initial=await total.innerText();
 await page.getByRole('button',{name:'Add symbol',exact:false}).click();
 await page.getByRole('dialog').getByLabel('Company',{exact:true}).selectOption('TSLA');
 await page.getByLabel('Shares',{exact:true}).fill('5');await page.getByLabel('Average purchase price (USD)').fill('200');
 await page.getByRole('button',{name:'Save position'}).click();await expect(total).not.toHaveText(initial);
 await page.reload();await expect(page.locator('.portfolio-table')).toContainText('TSLA');
 await page.getByRole('button',{name:'Set TSLA alert',exact:true}).click();await page.getByLabel('Target price (USD)').fill('240');await page.getByRole('button',{name:'Save alert'}).click();
 await expect(page.locator('.recent-alerts')).toContainText('TSLA — Price target reached');
 await page.locator('.recent-alerts').getByRole('button',{name:'Acknowledge'}).click();await expect(page.locator('.recent-alerts')).toContainText("You're up to date");
 await page.reload();await page.getByRole('button',{name:'Alerts (1)',exact:true}).click();await expect(page.locator('.portfolio-alert-list')).toContainText('Acknowledged');
 await page.getByRole('button',{name:'Delete TSLA alert'}).click();await expect(page.getByRole('button',{name:'Alerts (0)',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Holdings (5)',exact:true}).click();await page.getByRole('button',{name:'Remove TSLA position'}).click();await expect(total).toHaveText(initial);
 for(const name of ['Portfolio Cockpit','Holdings Board','Risk First','Change Timeline','Sector Groups']){await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');}
 await page.getByRole('button',{name:'Portfolio Cockpit',exact:true}).click();await page.screenshot({path:'test-results/portfolio-workspace.png',fullPage:true});
});
test('all twenty views fit mobile and produce no browser errors',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 const groups={Home:['Focus Pulse','Heatmap Command Center','Morning Market Brief','Analyst Canvas','Quiet Monitor'],Research:['Evidence Split','Peer Rail','Research Matrix','Sector Radar','Story and Benchmark'],News:['Morning Edition','Three-Desk Newsroom','Reading Focus','Signal Timeline','Topic Library'],Portfolio:['Portfolio Cockpit','Holdings Board','Risk First','Change Timeline','Sector Groups']};
 for(const [section,views]of Object.entries(groups)){
  await page.getByRole('button',{name:'Open navigation'}).click();await go(page,section);
  for(const name of views){await page.getByRole('button',{name,exact:true}).click();const size=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));expect(size.content,name).toBeLessThanOrEqual(size.viewport);}
 }
 await page.screenshot({path:'test-results/mobile-portfolio.png',fullPage:true});expect(errors).toEqual([]);
});
