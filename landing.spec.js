import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.route('**/api/session',r=>r.fulfill({json:{authenticated:false,isAdmin:false,user:null}}));});
test('public homepage has the brief sections, sample disclosure and working insights',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.getByRole('heading',{name:'Trusted Guidance for a Changing World'})).toBeVisible();await expect(page.getByText('Illustrative portfolio · Not account data')).toBeVisible();
 await expect(page.locator('.preview-allocation b')).toHaveText(['35%','30%','20%','15%']);
 await expect.poll(()=>page.locator('.site-brand img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
 await page.getByRole('link',{name:'Explore Our Solutions'}).click();await expect(page.getByRole('heading',{name:'Clarity for every step of your journey.'})).toBeVisible();
 await page.locator('.site-article-grid>button').first().click();await expect(page.getByRole('dialog')).toContainText('illustrative');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/slate-homepage.png',fullPage:true});expect(errors).toEqual([]);
});
test('public actions open login and registration without losing account functionality',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Client Login',exact:true}).first().click();await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();await expect(page.getByLabel('Email address')).toBeVisible();
 await page.locator('.brand-content').getByRole('link',{name:'PASION home'}).click();await expect(page.getByRole('heading',{name:'Trusted Guidance for a Changing World'})).toBeVisible();
 await page.getByRole('button',{name:'Get Started',exact:false}).first().click();await expect(page.getByLabel('Full name')).toBeVisible();await expect(page.getByLabel('Confirm password',{exact:true})).toBeVisible();
 await page.goto('/#login');await page.getByRole('button',{name:'Forgot password?'}).click();await expect(page.getByRole('heading',{name:/password/i})).toBeVisible();
});
test('mobile menu, sections and auth fit without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('button',{name:'Open menu'}).click();await expect(page.getByRole('navigation',{name:'Website navigation'})).toBeVisible();await page.getByRole('navigation',{name:'Website navigation'}).getByRole('link',{name:'Solutions',exact:true}).click();await expect(page.getByRole('button',{name:'Open menu'})).toHaveAttribute('aria-expanded','false');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/slate-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Open menu'}).click();await page.getByRole('navigation',{name:'Website navigation'}).getByRole('button',{name:'Client Login'}).click();await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
