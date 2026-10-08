import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
 await page.route('**/api/session',route=>route.fulfill({json:{authenticated:true,isAdmin:true,user:{name:'Dashboard Tester',email:'browser-test@example.com'}}}));
});
test('watchlist persists, picker works, CSV downloads',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/Good .*Dashboard/})).toBeVisible();
 await page.getByRole('button',{name:'Remove AAPL from watchlist',exact:true}).click();
 await expect(page.getByRole('button',{name:'View AAPL company details'})).toHaveCount(0);
 await page.reload();
 await expect(page.getByRole('heading',{name:/Good .*Dashboard/})).toBeVisible();
 await expect(page.getByRole('button',{name:'View AAPL company details'})).toHaveCount(0);
 await page.getByRole('button',{name:'Add holding',exact:true}).click();
 await page.getByRole('textbox',{name:'Search companies to add'}).fill('JPM');
 await page.getByRole('button',{name:'Add JPM in holding picker'}).click();
 await page.getByRole('button',{name:'Close dialog'}).click();
 await expect(page.getByRole('button',{name:'View JPM company details'})).toBeVisible();
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Export watchlist as CSV'}).click();
 expect((await download).suggestedFilename()).toBe('pasion-watchlist-sample.csv');
 await page.getByRole('combobox',{name:'Sort watchlist'}).selectOption('change');
 await expect(page.locator('.watch-rows .company-name strong').first()).toHaveText('AMZN');
});
test('research, chart, news and assistant work without browser errors',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Investment Research',exact:true}).click();
 await page.getByRole('combobox',{name:'Filter research by sector'}).selectOption('Energy');
 await expect(page.locator('.research-company')).toHaveCount(1);
 await page.locator('.research-company').getByRole('button',{name:'View company'}).click();
 await expect(page.locator('.company-selected strong')).toHaveText('XOM');
 await page.getByRole('dialog').getByRole('tab',{name:'Financial strength',exact:true}).click();
 await page.getByRole('button',{name:'1M',exact:true}).click();
 await expect(page.getByRole('button',{name:'1M',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('slider',{name:'Explore XOM chart points'}).fill('10');
 await expect(page.locator('.chart-readout')).toContainText('Sample point 11');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Company News',exact:true}).click();
 await page.locator('.news-article').first().click();
 await expect(page.getByRole('dialog')).toContainText('illustrative');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('navigation',{name:'Account navigation'}).getByRole('button',{name:'Assistant',exact:true}).click();
 await page.getByRole('button',{name:'Summarize my watchlist',exact:true}).click();
 await expect(page.locator('.assistant-conversation')).toContainText('5 companies');
 expect(errors).toEqual([]);
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Dashboard',exact:true}).click();
 await page.screenshot({path:'test-results/desktop-dashboard.png',fullPage:true});
});
test('mobile navigation and layout fit the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Open navigation'})).toBeVisible();
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Investment Research',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Investment Research',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Close navigation'})).toHaveCount(0);
 const width=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:window.innerWidth}));
 expect(width.content).toBeLessThanOrEqual(width.viewport);
 await page.screenshot({path:'test-results/mobile-dashboard.png',fullPage:true});
});

test('settings preserves workspace and changes password through the API',async({page})=>{
 await page.route('**/api/change-password',async route=>{
  expect(route.request().postDataJSON()).toEqual({currentPassword:'Current123!',newPassword:'Updated123!',confirmPassword:'Updated123!'});
  await route.fulfill({json:{message:'Your password has been changed.'}});
 });
 await page.goto('/');
 await page.getByRole('navigation',{name:'Account navigation'}).getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByRole('heading',{name:'A space that’s yours.'})).toBeVisible();
 await page.getByLabel('Current password',{exact:true}).fill('Current123!');
 await page.getByLabel('New password',{exact:true}).fill('Updated123!');
 await page.getByLabel('Confirm new password',{exact:true}).fill('Updated123!');
 await page.getByRole('button',{name:'Save password'}).click();
 await expect(page.getByRole('status')).toContainText('password has been changed');
 await page.getByRole('button',{name:'Back to workspace'}).click();
 await expect(page.getByRole('heading',{name:/Good .*Dashboard/})).toBeVisible();
});
test('login card expands smoothly for registration',async({page})=>{
 await page.unroute('**/api/session');
 await page.route('**/api/session',route=>route.fulfill({json:{authenticated:false,isAdmin:false,user:null}}));
 await page.goto('/#login');
 const card=page.locator('.account-panel');
 await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
 await page.waitForTimeout(700);
 const initial=(await card.boundingBox()).height;
 await page.getByRole('button',{name:'Register',exact:true}).first().click();
 await expect(page.getByLabel('Full name')).toBeVisible();
 await expect.poll(async()=>(await card.boundingBox()).height).toBeGreaterThan(initial+70);
 const width=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:window.innerWidth}));
 expect(width.content).toBeLessThanOrEqual(width.viewport);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByLabel('Full name')).toHaveCount(0);
});
test('admin account controls remain accessible from the workspace',async({page})=>{
 const accounts=[{email:'eyyubxankisiyev@gmail.com',name:'Owner',isAdmin:true,isOwner:true,disabled:false},{email:'member@example.com',name:'Member',isAdmin:false,isOwner:false,disabled:false}];
 await page.route('**/api/admin/accounts',async route=>{
  if(route.request().method()==='POST'){
   const data=route.request().postDataJSON();
   expect(data.action).toBe('grant-admin');
   accounts[1].isAdmin=true;
   await route.fulfill({json:{message:'Administrator access granted.'}});
  }else await route.fulfill({json:{accounts}});
 });
 await page.goto('/');
 await page.getByRole('navigation',{name:'Account navigation'}).getByRole('button',{name:'Administration'}).click();
 await expect(page.getByRole('heading',{name:'Account management'})).toBeVisible();
 await page.getByRole('combobox',{name:'Account',exact:true}).selectOption('member@example.com');
 await page.getByRole('button',{name:'Add administrator',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Save changes'}).click();
 await expect(page.getByRole('status')).toContainText('Administrator access granted');
 await expect(page.getByRole('button',{name:'Remove admin'})).toBeVisible();
 await page.getByRole('button',{name:'Back to workspace'}).click();
 await expect(page.getByRole('heading',{name:/Good .*Dashboard/})).toBeVisible();
});
