import {test,expect,type Page} from '@playwright/test';
const csv='Amount,Status,Category\n100,Posted,Sales\n900,Pending,Sales\n-20,Posted,Travel';
async function upload(page:Page,name='first.csv',data=csv){await page.getByLabel('Upload spreadsheet').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from(data)});await page.getByRole('button',{name:'Back to conversation'}).click();}
async function ask(page:Page,text='Total Amount'){await page.getByLabel('Message Naxium').fill(text);await page.getByRole('button',{name:'Send message'}).click();await expect(page.getByRole('button',{name:'Send message'})).toBeDisabled();}
const chat=(page:Page)=>page.getByRole('region',{name:'Conversation workspace'});
const learning=(page:Page)=>chat(page).getByRole('region',{name:'Refine this result'}).last();
async function adjust(page:Page,text:string){await learning(page).getByRole('button',{name:'Adjust result',exact:true}).click();await learning(page).getByLabel('What should change?').fill(text);await learning(page).getByRole('button',{name:'Update result'}).click();}

test('a natural correction establishes a method that is reused after refresh on fresh data',async({page})=>{
 page.on('dialog',d=>d.accept());await page.goto('/');await upload(page);await ask(page);
 await expect(chat(page).getByText(/All rows: 980/)).toBeVisible();
 await adjust(page,'Only Posted');await expect(chat(page).getByText(/All rows: 80/)).toBeVisible();
 await learning(page).getByRole('button',{name:'That’s right',exact:true}).click();
 await expect(learning(page).getByRole('status')).toContainText('Accepted for matching requests');
 await page.reload();await upload(page,'next.csv','Amount,Status,Category\n200,Posted,Sales\n700,Pending,Sales\n-50,Posted,Travel');await ask(page,'TOTAL Amount!');
 await expect(chat(page).getByText(/All rows: 150/)).toBeVisible();
 await expect(learning(page).getByRole('button',{name:'Established approach · version 1'})).toBeVisible();
 await page.screenshot({path:test.info().outputPath('learned-approach-desktop.png')});
 await ask(page,'How many rows?');await expect(chat(page).getByText(/All rows: 3/)).toBeVisible();
 await expect(learning(page).getByRole('button',{name:/Established approach/})).toHaveCount(0);
});

test('accepting this result only never changes later requests',async({page})=>{
 page.on('dialog',d=>d.accept());await page.goto('/');await upload(page);await ask(page);
 await adjust(page,'Only Posted');await expect(chat(page).getByText(/All rows: 80/)).toBeVisible();
 await learning(page).getByLabel('Acceptance scope').selectOption('once');
 await learning(page).getByRole('button',{name:'That’s right'}).click();
 await expect(learning(page).getByRole('status')).toContainText('this result only');
 await ask(page);await expect(chat(page).getByText(/All rows: 980/)).toHaveCount(2);
});

test('accepted changes make versions, restore changes future runs, and forget leaves historical answers intact',async({page})=>{
 page.on('dialog',d=>d.accept());await page.goto('/');await upload(page);await ask(page);
 await learning(page).getByRole('button',{name:'That’s right'}).click();await expect(learning(page).getByRole('status')).toContainText('matching');
 await adjust(page,'Only Posted');await expect(chat(page).getByText(/All rows: 80/)).toBeVisible();
 await learning(page).getByRole('button',{name:'That’s right'}).click();await expect(learning(page).getByRole('button',{name:'Established approach · version 2'})).toBeVisible();
 await learning(page).getByRole('button',{name:'View or change approach'}).click();
 const library=page.getByRole('region',{name:'Established approaches'});
 await library.getByText(/Version history/).click();await library.getByRole('button',{name:'Restore version 1'}).click();
 await expect(library.getByRole('button',{name:/Total Amount Version 3/})).toBeVisible();
 await library.getByRole('button',{name:'Run on current data'}).click();
 await expect(learning(page).getByRole('button',{name:'Established approach · version 3'})).toBeVisible();
 await expect(chat(page).getByText(/All rows: 80/)).toBeVisible();
 await learning(page).getByRole('button',{name:'Established approach · version 3'}).click();
 await library.getByRole('button',{name:'Forget approach',exact:true}).click();await expect(library.getByText(/Nothing established yet/)).toBeVisible();
 await page.getByRole('button',{name:'Back to conversation'}).click();await ask(page);
 await expect(learning(page).getByRole('button',{name:/Established approach/})).toHaveCount(0);
 await expect(chat(page).getByText(/All rows: 980/)).toHaveCount(3);
});

test('changed headings block remembered rules and offer an explicit fresh calculation',async({page})=>{
 page.on('dialog',d=>d.accept());await page.goto('/');await upload(page);await ask(page);await adjust(page,'Only Posted');
 await learning(page).getByRole('button',{name:'That’s right'}).click();await expect(learning(page).getByRole('status')).toContainText('matching');
 await upload(page,'changed.csv','Amount,Category\n9,Sales\n1,Travel');await ask(page);
 await expect(chat(page).getByText(/sheet headings have changed/)).toBeVisible();
 await expect(chat(page).getByText(/All rows: 10/)).toHaveCount(0);
 await chat(page).getByRole('button',{name:'Run as a new task'}).click();await expect(chat(page).getByText(/All rows: 10/)).toBeVisible();
 await page.setViewportSize({width:390,height:844});await expect.poll(async()=>{const box=await page.locator('.sidebar').boundingBox();return box!.x+box!.width;}).toBeLessThanOrEqual(1);await expect.poll(()=>page.locator('.conversation-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);await page.screenshot({path:test.info().outputPath('learned-approach-mobile.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('ambiguous corrections clarify, and method APIs enforce authentication and same-origin',async({page,request})=>{
 await page.goto('/');await upload(page,'ambiguous.csv','Amount,Status,Other\n10,Posted,Posted');await ask(page);
 await adjust(page,'Only Posted');await expect(learning(page).getByRole('alert')).toBeVisible();
 expect((await request.get('/api/methods')).status()).toBe(404);
 expect((await request.post('/api/methods',{headers:{origin:'https://foreign.example'},data:{}})).status()).toBe(403);
});

test('a correction explicitly limited to this time defaults to one-off acceptance',async({page})=>{
 page.on('dialog',d=>d.accept());await page.goto('/');await upload(page);await ask(page);
 await adjust(page,'Only Posted this time');
 await expect(chat(page).getByText(/All rows: 80/)).toBeVisible();
 await expect(learning(page).getByLabel('Acceptance scope')).toHaveValue('once');
 await learning(page).getByRole('button',{name:'That’s right'}).click();
 await ask(page);await expect(chat(page).getByText(/All rows: 980/)).toHaveCount(2);
});
