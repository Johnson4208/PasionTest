import {test,expect} from '@playwright/test';

const email='research-test@example.com';
const sections=['Financial strength','Growth','Profitability','Valuation','Cash flow','Peers'];

test.beforeEach(async({page})=>{
 await page.route('**/api/session',route=>route.fulfill({json:{authenticated:true,isAdmin:true,user:{name:'Research Tester',email}}}));
});

async function openResearch(page){
 await page.goto('/');
 await page.getByRole('button',{name:'Expand company overview'}).click();
 const dialog=page.locator('.company-research-dialog');
 await expect(dialog).toBeVisible();
 await expect(page.getByRole('dialog')).toHaveCount(1);
 return dialog;
}

function valueIn(text){
 return Number(text.replace(/[^0-9.-]/g,''));
}

test('full company research opens valuation and changes the research content for all six sections',async({page})=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const dialog=await openResearch(page);
 const tabs=dialog.getByRole('tablist',{name:'Research sections'});
 await expect(tabs.getByRole('tab')).toHaveCount(6);
 await expect(tabs.getByRole('tab',{name:'Valuation',exact:true})).toHaveAttribute('aria-selected','true');
 const valuation=dialog.getByRole('tabpanel',{name:'Valuation',exact:true});
 await expect(valuation).toBeVisible();
 await expect(valuation.getByRole('row').filter({hasText:'Share price'})).toContainText('$189.42');
 await expect(dialog.getByRole('heading',{name:'Peer position (P/E vs ROE)',exact:true})).toBeVisible();
 await expect(dialog.getByRole('heading',{name:'Revenue to free cash flow bridge',exact:true})).toBeVisible();
 await expect(dialog.getByRole('heading',{name:'Key indicators (detailed)',exact:true})).toBeVisible();
 await expect(dialog).toContainText(/sample|illustrative/i);
 await page.screenshot({path:'artifacts/ui/company-research-valuation.png'});
 const content=new Set();
 for(const name of sections){
  await tabs.getByRole('tab',{name,exact:true}).click();
  await expect(tabs.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true');
  await expect(tabs.locator('[aria-selected="true"]')).toHaveCount(1);
  const panel=dialog.getByRole('tabpanel',{name,exact:true});
  await expect(panel).toBeVisible();
  await expect(dialog.getByRole('tabpanel')).toHaveCount(1);
  content.add(await panel.innerText());
 }
 expect(content.size).toBe(sections.length);
 expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/ui/company-research-peers.png'});
});

test('indicator categories filter detailed data and source actions show provenance inside the existing dialog',async({page})=>{
 const dialog=await openResearch(page);
 const categories=dialog.getByRole('combobox',{name:'Indicator category'});
 const groups=dialog.locator('.research-indicator-group');
 const allGroups=await groups.count();
 const allReports=await dialog.getByRole('button',{name:'View report',exact:true}).count();
 expect(allGroups).toBeGreaterThan(1);
 const firstCategory=await categories.locator('option').nth(1).getAttribute('value');
 const categoryName=await categories.locator('option').nth(1).innerText();
 await categories.selectOption(firstCategory);
 await expect(groups).toHaveCount(1);
 await expect(groups.first()).toContainText(categoryName);
 expect(await dialog.getByRole('button',{name:'View report',exact:true}).count()).toBeLessThan(allReports);
 await dialog.getByRole('button',{name:'View report',exact:true}).first().click();
 const source=dialog.getByRole('region',{name:'Source details',exact:true});
 await expect(source).toBeVisible();
 await expect(source).toContainText(/sample|illustrative/i);
 await expect(page.getByRole('dialog')).toHaveCount(1);
 await source.getByRole('button',{name:'Close source details',exact:true}).click();
 await expect(source).toHaveCount(0);
 await categories.selectOption({label:'All categories'});
 await expect(groups).toHaveCount(allGroups);
 await dialog.getByRole('button',{name:'View source',exact:true}).click();
 await expect(source).toBeVisible();
 await expect(page.getByRole('dialog')).toHaveCount(1);
});

test('company search updates research and overview watchlist changes survive reload',async({page})=>{
 let dialog=await openResearch(page);
 const search=dialog.getByRole('textbox',{name:'Find company for overview'});
 await search.fill('no-such-company');
 await expect(dialog.getByText('No matching companies.',{exact:true})).toBeVisible();
 await search.fill('MSFT');
 await dialog.locator('.company-results').getByRole('button',{name:/MSFT/}).click();
 await expect(dialog.locator('.company-selected strong')).toHaveText('MSFT');
 await expect(dialog.getByRole('tabpanel',{name:'Valuation',exact:true}).getByRole('row').filter({hasText:'Share price'})).toContainText('$518.20');
 await expect(search).toHaveValue('');
 await dialog.getByRole('button',{name:'Remove MSFT from watchlist from overview',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Add MSFT to watchlist from overview',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await page.reload();
 await expect(page.getByRole('button',{name:'View MSFT company details',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Expand company overview'}).click();
 dialog=page.locator('.company-research-dialog');
 await dialog.getByRole('textbox',{name:'Find company for overview'}).fill('MSFT');
 await dialog.locator('.company-results').getByRole('button',{name:/MSFT/}).click();
 await expect(dialog.getByRole('button',{name:'Add MSFT to watchlist from overview',exact:true})).toBeVisible();
 await dialog.getByRole('button',{name:'Add MSFT to watchlist from overview',exact:true}).click();
 await page.keyboard.press('Escape');
 await page.reload();
 await expect(page.getByRole('button',{name:'View MSFT company details',exact:true})).toBeVisible();
});

test('core value calculator responds to growth and discount assumptions',async({page})=>{
 const dialog=await openResearch(page);
 await dialog.getByRole('button',{name:'Calculate core value',exact:true}).click();
 const calculator=dialog.getByRole('region',{name:'Core value calculator',exact:true});
 await expect(calculator).toBeVisible();
 const output=calculator.getByLabel('Estimated core value',{exact:true});
 const growth=calculator.getByLabel('Revenue growth (%)',{exact:true});
 const discount=calculator.getByLabel('Discount rate (%)',{exact:true});
 await expect(calculator.getByLabel('Terminal growth (%)',{exact:true})).toBeVisible();
 const before=valueIn(await output.innerText());
 expect(before).toBeGreaterThan(0);
 await growth.fill(String(Number(await growth.inputValue())+2));
 await expect.poll(async()=>valueIn(await output.innerText())).toBeGreaterThan(before);
 const increasedGrowth=valueIn(await output.innerText());
 await discount.fill(String(Number(await discount.inputValue())+2));
 await expect.poll(async()=>valueIn(await output.innerText())).toBeLessThan(increasedGrowth);
 await expect(calculator).toContainText(/sample|illustrative/i);
 await expect(page.getByRole('dialog')).toHaveCount(1);
});

test('research remains contained and usable on mobile in dark right-to-left mode',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>localStorage.setItem('pasion-preferences',JSON.stringify({language:'ar',theme:'dark'})));
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.locator('.overview-expand').click();
 const dialog=page.locator('.company-research-dialog');
 await expect(dialog).toBeVisible();
 const box=await dialog.boundingBox();
 expect(box.width).toBeGreaterThanOrEqual(389);
 expect(box.height).toBeGreaterThanOrEqual(843);
 const dimensions=await dialog.evaluate(element=>({document:document.documentElement.scrollWidth,viewport:innerWidth,dialog:element.scrollWidth,client:element.clientWidth}));
 expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
 expect(dimensions.dialog).toBeLessThanOrEqual(dimensions.client);
 const brightness=await dialog.evaluate(element=>{
  const rgb=getComputedStyle(element).backgroundColor.match(/\d+/g).slice(0,3).map(Number);
  return rgb.reduce((sum,value)=>sum+value,0)/3;
 });
 expect(brightness).toBeLessThan(80);
 await dialog.getByRole('tab').first().click();
 await expect(dialog.getByRole('tabpanel')).toBeVisible();
 await dialog.getByRole('combobox').selectOption({index:1});
 await expect(dialog.locator('.research-indicator-group')).toHaveCount(1);
 await page.screenshot({path:'artifacts/ui/company-research-mobile-dark-rtl.png'});
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
 await expect(page.locator('.overview-expand')).toBeFocused();
 await expect(page.locator('#root')).toHaveJSProperty('inert',false);
});
