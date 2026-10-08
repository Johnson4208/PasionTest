import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.route('**/api/session',route=>route.fulfill({json:{authenticated:true,isAdmin:true,user:{name:'Panel Tester',email:'panel-test@example.com'}}}));
});

async function expectFullScreen(page,dialog) {
 await expect(dialog).toBeVisible();
 const viewport=page.viewportSize();
 await expect.poll(async()=>{
  const box=await dialog.boundingBox();
  return box&&Math.abs(box.x)<1&&Math.abs(box.y)<1&&box.width>=viewport.width-1&&box.height>=viewport.height-1;
 }).toBe(true);
 await expect(page.locator('body')).toHaveCSS('overflow','hidden');
 await expect(page.locator('#root')).toHaveJSProperty('inert',true);
}

async function expectNoHorizontalOverflow(page) {
 const dimensions=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
 expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
}

test('workspace plans fill the screen and offer a working return to the workspace',async({page})=>{
 await page.goto('/');
 const opener=page.getByRole('button',{name:'View plans'});
 await opener.click();
 const dialog=page.getByRole('dialog',{name:'PASION workspace plans'});
 await expectFullScreen(page,dialog);
 await expect(dialog.getByRole('heading',{name:'Explorer',exact:true})).toBeVisible();
 await expect(dialog).toContainText('Current workspace');
 await expect(dialog).toContainText('Free');
 await expect(dialog).toContainText('Paid subscriptions are not available yet.');
 await expect(dialog.getByRole('heading',{name:'PASION Pro',exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/ui/plans-fullscreen.png'});
 await expect(dialog.getByRole('button',{name:'Close dialog'})).toBeFocused();
 await page.keyboard.press('Shift+Tab');
 await expect(dialog.getByRole('button',{name:'Explore workspace'})).toBeFocused();
 await page.keyboard.press('Tab');
 await expect(dialog.getByRole('button',{name:'Close dialog'})).toBeFocused();
 await dialog.getByRole('button',{name:'Explore workspace'}).click();
 await expect(dialog).toHaveCount(0);
 await expect(opener).toBeFocused();
 await expect(page.locator('#root')).toHaveJSProperty('inert',false);
 await expect(page.locator('body')).not.toHaveCSS('overflow','hidden');
 await opener.click();
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
 await expect(opener).toBeFocused();
 await expect(page.locator('#root')).toHaveJSProperty('inert',false);
});

test('company preview, Full tab and company selection open an interactive full screen',async({page})=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 const opener=page.getByRole('button',{name:'Expand company overview'});
 await opener.click();
 let dialog=page.getByRole('dialog');
 await expectFullScreen(page,dialog);
 await expect(dialog.locator('.company-selected strong')).toHaveText('AAPL');
 await dialog.getByRole('tab',{name:'Financial strength',exact:true}).click();
 await dialog.getByRole('button',{name:'1M',exact:true}).click();
 await expect(dialog.getByRole('button',{name:'1M',exact:true})).toHaveAttribute('aria-pressed','true');
 await dialog.getByRole('slider',{name:'Explore AAPL chart points'}).fill('10');
 await expect(dialog.locator('.chart-readout')).toContainText('Sample point 11');
 await page.screenshot({path:'artifacts/ui/company-fullscreen.png'});
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
 await expect(opener).toBeFocused();
 await expect(page.locator('#root')).toHaveJSProperty('inert',false);
 await page.getByRole('button',{name:'Full',exact:true}).click();
 await expectFullScreen(page,page.getByRole('dialog'));
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'View MSFT company details'}).click();
 dialog=page.getByRole('dialog');
 await expectFullScreen(page,dialog);
 await expect(dialog.locator('.company-selected strong')).toHaveText('MSFT');
 await page.keyboard.press('Escape');
 expect(errors).toEqual([]);
});

test('plans and company details fill a mobile viewport without horizontal scrolling',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByRole('button',{name:'Expand company overview'}).click();
 await expectFullScreen(page,page.getByRole('dialog'));
 await expectNoHorizontalOverflow(page);
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('button',{name:'View plans'}).click();
 const dialog=page.getByRole('dialog',{name:'PASION workspace plans'});
 await expectFullScreen(page,dialog);
 await expectNoHorizontalOverflow(page);
 await page.screenshot({path:'artifacts/ui/mobile-plans-fullscreen.png'});
 await dialog.getByRole('button',{name:'Explore workspace'}).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.locator('body')).not.toHaveCSS('overflow','hidden');
});

test('light and dark preferences persist and apply to full screen panels',async({page})=>{
 await page.emulateMedia({colorScheme:'light'});
 await page.goto('/');
 await page.getByRole('navigation',{name:'Account navigation'}).getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Dark mode',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'View plans'}).click();
 const dialog=page.getByRole('dialog',{name:'PASION workspace plans'});
 await expectFullScreen(page,dialog);
 const panelBrightness=await dialog.evaluate(element=>{
  const rgb=getComputedStyle(element).backgroundColor.match(/\d+/g).slice(0,3).map(Number);
  return rgb.reduce((sum,value)=>sum+value,0)/3;
 });
 expect(panelBrightness).toBeLessThan(80);
 await page.screenshot({path:'artifacts/ui/plans-fullscreen-dark.png'});
 await page.keyboard.press('Escape');
 await page.locator('.theme-toggle').click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});

test('all nine languages can be selected and Arabic persists with right to left layout',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Account navigation'}).getByRole('button',{name:'Settings',exact:true}).click();
 const languageSelect=page.locator('.preference-settings .preference-language select');
 await expect(languageSelect.locator('option')).toHaveCount(9);
 const values=['en','az','tr','ru','zh','vi','es','fr','ar'];
 for(const language of values){
  await languageSelect.selectOption(language);
  await expect(languageSelect).toHaveValue(language);
  await expect(page.locator('html')).toHaveAttribute('lang',language);
  await expect(page.locator('html')).toHaveAttribute('dir',language==='ar'?'rtl':'ltr');
  if(language==='en')await expect(languageSelect).toHaveAccessibleName('Language');
  else await expect(languageSelect).not.toHaveAccessibleName('Language');
  await expectNoHorizontalOverflow(page);
 }
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('lang','ar');
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.locator('.home-shell')).toHaveCSS('direction','rtl');
 await expectNoHorizontalOverflow(page);
 await page.locator('.sidebar-bottom > button').nth(1).click();
 await expect(page.locator('.preference-settings .preference-language select')).toHaveValue('ar');
 await page.setViewportSize({width:390,height:844});
 await expectNoHorizontalOverflow(page);
 await page.locator('.settings-header > button').click();
 await page.locator('.mobile-menu').click();
 await page.locator('.pro-card button').click();
 await expectFullScreen(page,page.getByRole('dialog'));
 await expect(page.locator('.plans-intro')).toContainText(/[\u0600-\u06ff]/);
 await expect(page.locator('.workspace-plan-action')).not.toHaveText('Explore workspace');
 await expectNoHorizontalOverflow(page);
 await page.screenshot({path:'artifacts/ui/rtl-mobile-plans-fullscreen.png'});
});

test('Assistant and Help use the full workspace and remain usable on mobile',async({page})=>{
 await page.goto('/');
 const accountNavigation=page.getByRole('navigation',{name:'Account navigation'});
 for(const name of ['Assistant','Help & support']){
  const navigationButton=accountNavigation.getByRole('button',{name,exact:true});
  await navigationButton.click();
  await expect(navigationButton).toHaveAttribute('aria-current','page');
  await expect(page.locator('.workspace-page-content')).toHaveAttribute('aria-busy','false');
  const content=page.locator('.workspace-focused-section');
  await expect(content).toBeVisible();
  const grid=await page.locator('.dashboard-grid.workspace-single-column').boundingBox();
  const box=await content.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(grid.width-1);
  await expect(page.locator('.dashboard-right')).toBeHidden();
  if(name==='Assistant'){
   await content.getByRole('button',{name:'Summarize my watchlist',exact:true}).click();
   await expect(content.locator('.assistant-conversation')).toContainText('5 companies');
  }else{
   await content.getByText('Following companies',{exact:true}).click();
   await expect(content.getByText('Open Research and use the + button to add a company.',{exact:false})).toBeVisible();
  }
  await page.screenshot({path:'artifacts/ui/'+(name==='Assistant'?'assistant-workspace':'help-workspace')+'.png'});
 }
 await page.setViewportSize({width:390,height:844});
 for(const name of ['Assistant','Help & support']){
  await page.getByRole('button',{name:'Open navigation'}).click();
  const navigationButton=accountNavigation.getByRole('button',{name,exact:true});
  await navigationButton.click();
  await expect(navigationButton).toHaveAttribute('aria-current','page');
  await expect(page.locator('.workspace-page-content')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('.workspace-focused-section')).toBeVisible();
  await expect(page.getByRole('button',{name:'Close navigation'})).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
 }
 await page.screenshot({path:'artifacts/ui/help-workspace-mobile.png'});
});
