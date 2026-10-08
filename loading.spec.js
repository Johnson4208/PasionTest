import {test,expect} from '@playwright/test';
test('session loading stays visible until the session request finishes',async({page})=>{
 let release;const pending=new Promise(resolve=>{release=resolve});
 await page.route('**/api/session',async route=>{await pending;await route.fulfill({json:{authenticated:false,isAdmin:false,user:null}})});
 await page.goto('/');await expect(page.getByRole('status')).toContainText('Checking your session');await expect(page.getByRole('heading',{name:'A clearer view awaits.'})).toBeVisible();
 release();await expect(page.getByRole('heading',{name:'Trusted Guidance for a Changing World'})).toBeVisible();await expect(page.locator('.branded-loading')).toHaveCount(0);
});
test('navigation shows a loading state, finishes, and honors reduced motion',async({page})=>{
 await page.route('**/api/session',r=>r.fulfill({json:{authenticated:true,isAdmin:false,user:{name:'Loader Tester',email:'loader@example.com'}}}));
 await page.goto('/');await expect(page.getByRole('heading',{name:/Good .*Loader/})).toBeVisible();
 // Record the transient state in the browser, avoiding timing-dependent assertions.
 await page.evaluate(()=>{window.loadingStates=[];window.loadingObserver=new MutationObserver(()=>{const loader=document.querySelector('.workspace-loader');if(loader)window.loadingStates.push(loader.textContent)});window.loadingObserver.observe(document.body,{subtree:true,childList:true,attributes:true})});
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Trade Planner',exact:true}).click();await expect(page.getByRole('heading',{name:'Define a sample trade'})).toBeVisible();expect(await page.evaluate(()=>loadingStates.some(text=>text.includes('Opening Trade Planner')))).toBe(true);await expect(page.locator('.workspace-page-content')).toHaveAttribute('aria-busy','false');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Stock Analytics',exact:true}).click();await expect(page.getByRole('heading',{name:'Apple Inc.',exact:true})).toBeVisible();await expect(page.locator('.workspace-loader')).toHaveCount(0);
});
