import {test,expect} from '@playwright/test';
test('company-memory prototype persists, retrieves with citations, exports and forgets',async({page})=>{
 page.on('dialog',d=>d.accept());await page.goto('/');
 await page.getByRole('button',{name:'Company memory',exact:true}).first().click();
 const dialog=page.getByRole('dialog',{name:'Company memory'});
 await dialog.getByLabel('Memory title').fill('Quote 1276 — Dave’s Electrical');
 await dialog.getByLabel('Reference material').fill('Install lighting. Price 1200 AUD. New site details must be confirmed.');
 await dialog.getByRole('button',{name:'Keep in company memory',exact:true}).click();await expect(dialog.getByRole('status').filter({hasText:'Kept in company memory'})).toBeVisible();
 const download=page.waitForEvent('download');await dialog.getByRole('button',{name:'Export record',exact:true}).click();await download;
 await dialog.getByRole('button',{name:'Close memory'}).click();await page.reload();
 await page.getByLabel('Message Naxium').fill('Find quote 1276');await page.getByRole('button',{name:'Send message'}).click();
 const chat=page.getByRole('region',{name:'Conversation workspace'});await expect(chat.getByRole('region',{name:'Sources behind this answer'})).toContainText('Install lighting');
 await chat.getByRole('button',{name:/Quote 1276/}).click();await expect(dialog.getByLabel('Reference material')).toHaveValue(/Install lighting/);await page.screenshot({path:test.info().outputPath('company-memory-desktop.png')});
 await page.setViewportSize({width:390,height:844});await expect(dialog).toBeVisible();expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.screenshot({path:test.info().outputPath('company-memory-mobile.png')});await page.setViewportSize({width:1440,height:1080});
 await dialog.getByRole('button',{name:'Use in chat'}).click();await expect(page.locator('.memory-context')).toContainText('Quote 1276');
 await page.getByLabel('Message Naxium').fill('Help me adapt this for John’s Electrical');await page.getByRole('button',{name:'Send message'}).click();await expect(chat.getByText(/AI drafting needs an enabled business account/)).toBeVisible();
 await page.getByRole('button',{name:'Remove reference'}).click();await page.getByRole('button',{name:'Company memory',exact:true}).first().click();
 await dialog.getByRole('button',{name:/Quote 1276/}).click();await dialog.getByRole('button',{name:'Delete memory',exact:true}).click();await expect(dialog.getByText('No permanent records yet.')).toBeVisible();await dialog.getByRole('button',{name:'Close memory'}).click();
 await page.getByLabel('Message Naxium').fill('Find quote 1276');await page.getByRole('button',{name:'Send message'}).click();await expect(chat.getByText(/couldn't find a matching record/)).toBeVisible();
});
test('an attached sheet does not trap general chat and live answers cite web search',async({page,request})=>{
 await page.goto('/');await page.getByLabel('Upload spreadsheet').setInputFiles({name:'data.csv',mimeType:'text/csv',buffer:Buffer.from('Amount\n10')});await expect(page.locator('.attached-file')).toContainText('data.csv');
 await page.getByLabel('Message Naxium').fill('What is the weather in Melbourne today?');await page.getByRole('button',{name:'Send message'}).click();
 const chat=page.getByRole('region',{name:'Conversation workspace'});await expect(chat.getByText(/Melbourne weather/)).toBeVisible();await expect(chat.getByRole('link',{name:/bom.gov.au/})).toBeVisible();
 await page.getByLabel('Message Naxium').fill('Total Amount');await page.getByRole('button',{name:'Send message'}).click();await expect(chat.getByText(/All rows: 10/)).toBeVisible();
 const requests=JSON.stringify(await (await request.get('http://127.0.0.1:4010/requests')).json());expect(requests).toContain('web_search_20250305');
 expect((await request.post('/api/memory/search',{headers:{origin:'https://foreign.example'},data:{question:'1276'}})).status()).toBe(403);expect((await request.get('/api/memory')).status()).toBe(404);
});
