import {test,expect} from '@playwright/test';

test.beforeEach(async({page})=>{
 await page.route('**/api/session',route=>route.fulfill({json:{authenticated:true,isAdmin:false,user:{name:'Photo Tester',email:'photo-test@example.com'}}}));
});

test('profile photo updates all avatars, persists, validates files and can be removed',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 await page.getByRole('navigation',{name:'Account navigation'}).getByRole('button',{name:'Settings',exact:true}).click();
 const picker=page.getByLabel('Upload profile photo');
 await picker.setInputFiles({name:'photo.txt',mimeType:'text/plain',buffer:Buffer.from('not a photo')});
 await expect(page.getByRole('alert')).toHaveText('Choose a JPG, PNG, or WebP image.');
 const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=','base64');
 await picker.setInputFiles({name:'photo.png',mimeType:'image/png',buffer:pixel});
 await expect(page.getByRole('status')).toHaveText('Profile photo updated.');
 await expect(page.locator('.profile-avatar img')).toBeVisible();
 await page.getByRole('button',{name:'Back to workspace'}).click();
 await expect(page.locator('.home-topbar .account-avatar img')).toBeVisible();
 await expect(page.locator('.sidebar-user .account-avatar img')).toBeVisible();
 await page.reload();
 await expect(page.locator('.home-topbar .account-avatar img')).toBeVisible();
 await page.getByRole('navigation',{name:'Account navigation'}).getByRole('button',{name:'Settings',exact:true}).click();
 await page.screenshot({path:'artifacts/ui/profile-photo-settings.png',fullPage:true});
 await page.getByRole('button',{name:'Remove photo',exact:true}).click();
 await expect(page.locator('.profile-avatar img')).toHaveCount(0);
 await expect(page.locator('.profile-avatar')).toHaveText('PT');
 await page.getByRole('button',{name:'Back to workspace'}).click();
 await expect(page.locator('.home-topbar .account-avatar img')).toHaveCount(0);
 await page.reload();
 await expect(page.locator('.home-topbar .account-avatar img')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('dark market cards have legible sector colors and a clean chart cursor',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Switch to dark mode'}).click();
 const colors=await page.locator('.heatmap button').evaluateAll(elements=>elements.map(element=>({background:getComputedStyle(element).backgroundColor,text:getComputedStyle(element).color})));
 for(const color of colors){
  const rgb=value=>value.match(/\d+/g).slice(0,3).map(Number);
  const brightness=value=>rgb(value).reduce((sum,channel)=>sum+channel,0)/3;
  expect(brightness(color.background)).toBeLessThan(90);
  expect(brightness(color.text)).toBeGreaterThan(180);
 }
 await expect(page.getByRole('button',{name:'About market breadth'})).toBeVisible();
 await page.locator('.market-card').screenshot({path:'artifacts/ui/dark-market-cards.png'});
 await page.getByRole('button',{name:'Expand company overview'}).click();
 await page.getByRole('dialog').getByRole('tab',{name:'Financial strength',exact:true}).click();
 const chart=page.getByRole('dialog').locator('.price-chart svg');
 await chart.hover({position:{x:100,y:100}});
 await expect(chart.locator('.chart-hover-guide')).toHaveCount(1);
 await expect(page.getByRole('dialog').locator('.chart-readout')).toContainText('Sample point');
 await expect(chart.locator('circle')).toHaveCount(0);
 await page.screenshot({path:'artifacts/ui/dark-chart-cursor.png'});
});
