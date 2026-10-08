import {test,expect} from '@playwright/test';

test('translated research, comparison and portfolio controls keep their behavior',async({page})=>{
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/session',route=>route.fulfill({json:{authenticated:true,isAdmin:false,user:{name:'Language Tester',email:'language-test@example.com'}}}));
 await page.goto('/');
 await page.locator('.home-topbar .preference-language select').selectOption('es');
 await expect(page.locator('html')).toHaveAttribute('lang','es');
 const destinations=page.locator('.workspace-navigation button');

 await destinations.nth(4).click();
 const sector=page.locator('.research-card select');
 await expect(sector.locator('option[value="Energy"]')).toHaveText('Energía');
 await sector.selectOption('Energy');
 await expect(page.locator('.research-company')).toHaveCount(1);
 await page.locator('.research-company .home-link').click();
 const overview=page.getByRole('dialog');
 await expect(overview).toBeVisible();
 await expect(overview.locator('.company-selected strong')).toHaveText('XOM');
 await expect(overview.getByRole('tab').first()).not.toHaveText('Financial strength');
 await overview.getByRole('tab').first().click();
 await overview.getByRole('button',{name:'1M',exact:true}).click();
 await expect(overview.getByRole('button',{name:'1M',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('Escape');
 await expect(overview).toHaveCount(0);

 await destinations.nth(1).click();
 await expect(page.locator('.tool-heading h2').first()).not.toHaveText('Different companies. One clear view.');
 await expect(page.locator('.comparison-table thead th')).toHaveCount(4);
 await page.locator('.compare-picker').getByRole('button',{name:'NVDA'}).click();
 await expect(page.locator('.comparison-table thead th')).toHaveCount(3);
 await expect(page.locator('.analytics-page .dashboard-button').first()).not.toHaveText('Export comparison');

 await destinations.nth(10).click();
 const add=page.locator('.holdings-board .dashboard-button');
 await expect(add).not.toHaveText('+ Add symbol');
 await add.click();
 const position=page.getByRole('dialog');
 await position.locator('select').selectOption('TSLA');
 await position.locator('input[type="number"]').nth(0).fill('5');
 await position.locator('input[type="number"]').nth(1).fill('200');
 await expect(position.locator('.portfolio-form button')).not.toHaveText('Save position');
 await position.locator('.portfolio-form button').click();
 await expect(page.locator('.portfolio-table')).toContainText('TSLA');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('lang','es');
 await expect(page.locator('.portfolio-table')).toContainText('TSLA');
 expect(errors).toEqual([]);
});
