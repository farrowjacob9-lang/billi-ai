import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
test.beforeEach(async ({page}) => { page.on("dialog", dialog => dialog.accept()); });

test("real multi-sheet Excel supports totals, category questions, matching rows and switching sheets", async ({ page, request }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Expenses").addRows([
    ["Date", "Description", "Category", "Amount"],
    ["2026-10-01", "Private vendor alpha", "Travel", -10.10],
    ["2026-11-01", "Private vendor beta", "Travel", -20.20],
    ["2026-11-15", "Private vendor gamma", "Software", -50],
  ]);
  workbook.addWorksheet("Other").addRows([["Name", "Amount"], ["Example", 200]]);
  await page.goto("/");
  await page.getByLabel("Upload spreadsheet").setInputFiles({ name: "real-expenses.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) });
  await expect(page.getByRole("region", { name: "Spreadsheet preview" })).toBeVisible();
  const composer = page.getByLabel("Message Naxium");
  async function ask(q: string) { await composer.fill(q); await page.getByRole("button", { name: "Send message" }).click(); }
  await ask("total Amount");
  await expect(page.getByRole("region", {name:"Conversation workspace"}).getByText(/All rows: -80.3/)).toBeVisible();
  await ask("sum Amount by Category");
  await expect(page.getByRole("region", {name:"Conversation workspace"}).getByText(/Travel: -30.3\s+Software: -50/)).toBeVisible();
  await ask("Show the largest negative Amount transaction");
  await expect(page.getByRole("region", {name:"Conversation workspace"}).getByText(/Row 4: Date: 2026-11-15/)).toBeVisible();
  const sent = JSON.stringify(await (await request.get("http://127.0.0.1:4010/requests")).json());
  expect(sent).toContain("Translate a spreadsheet question");
  expect(sent).not.toContain("Private vendor");
  await page.getByLabel("Active sheet").selectOption("1");
  await ask("total Amount");
  await expect(page.getByRole("region", {name:"Conversation workspace"}).getByText(/All rows: 200/)).toBeVisible();
  await expect(page.getByRole("region", {name:"Conversation workspace"}).getByText(/All rows: -80.3/)).toHaveCount(0);
  await page.getByLabel("Active sheet").selectOption("0");
  await expect(page.getByRole("region", {name:"Conversation workspace"}).getByText(/All rows: -80.3/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Spreadsheet preview" })).toHaveCount(0);
});

test("invalid plans cannot invent a column and formula cells are rejected", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Upload spreadsheet").setInputFiles({ name: "test.csv", mimeType: "text/csv", buffer: Buffer.from("Category,Amount\nTravel,-12.50") });
  await expect(page.getByRole("region", { name: "Spreadsheet preview" })).toBeVisible();
  await page.getByLabel("Message Naxium").fill("invent a total");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("region", {name:"Conversation workspace"}).getByText("Which numeric column should I use?")).toBeVisible();
  const book = new ExcelJS.Workbook();
  const ws = book.addWorksheet("Formulas");
  ws.addRow(["Amount"]); ws.addRow([{ formula: "1+1", result: 2 }]);
  await page.getByLabel("Upload spreadsheet").setInputFiles({ name: "formulas.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await book.xlsx.writeBuffer()) });
  await expect(page.getByRole("region", { name: "Conversation workspace" }).getByRole("alert")).toContainText("contains formulas");
});

test("spreadsheet endpoint enforces AI access and rejects cross-site requests", async ({ request }) => {
  const body = { sheet: { name: "test", columns: ["Amount"], rows: [[10]] }, question: "total Amount" };
  const crossSite = await request.post("/api/sheet-question", { data: body, headers: { origin: "https://evil.example" } });
  expect(crossSite.status()).toBe(403);
  const invalid = await request.post("/api/sheet-question", { data: { ...body, sheet: { name: "x", columns: ["Amount"], rows: [[{}]] } } });
  expect(invalid.status()).toBe(422);
});

test("the downloadable tricky workbook opens with formatting, filters and two sheets", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Upload spreadsheet").setInputFiles("tests/tricky-transactions.xlsx");
  await expect(page.getByRole("region", { name: "Spreadsheet preview" })).toBeVisible();
  await expect(page.getByLabel("Active sheet").locator("option")).toHaveCount(2);
  await page.getByLabel("Message Naxium").fill("total Amount");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("region", {name:"Conversation workspace"}).getByText(/All rows: 9,808.97/)).toBeVisible();
});

test("Excel parser refuses malformed uploads and cross-site requests", async ({ request }) => {
  const malformed = await request.post('/api/spreadsheets', { data: { fileName: 'bad.xlsx', data: 'not base64!' } });
  expect(malformed.status()).toBe(400);
  const corrupt = await request.post('/api/spreadsheets', { data: { fileName: 'bad.xlsx', data: Buffer.from('not a workbook').toString('base64') } });
  expect(corrupt.status()).toBe(422);
  const crossSite = await request.post('/api/spreadsheets', { data: {}, headers: { origin: 'https://evil.example' } });
  expect(crossSite.status()).toBe(403);
});

test('Naxium saved work survives refresh, keeps review decisions, and exports Excel and PDF',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Upload spreadsheet').setInputFiles('tests/tricky-transactions.xlsx');
 await expect(page.getByRole('region',{name:'Spreadsheet preview'})).toBeVisible();
 await page.getByLabel('Message Naxium').fill('total Amount');await page.getByRole('button',{name:'Send message'}).click();
 await expect(page.getByRole("region", {name:"Conversation workspace"}).getByText(/All rows: 9,808.97/)).toBeVisible();
 await page.getByRole('button',{name:'Workspace tools',exact:true}).click();
 await page.getByText('Saved work, exports & routines',{exact:true}).click();
 await page.getByText('Review answers',{exact:true}).click();
 await page.getByRole('button',{name:'Approve',exact:true}).click();
 await page.getByLabel('Workspace name').fill('Tricky financial review');
 await page.getByRole('button',{name:'Save workspace',exact:true}).click();
 await expect(page.getByText(/Workspace saved for 30 days/)).toBeVisible();
 for(const kind of ['Excel','PDF']){
  const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Export '+kind,exact:true}).click();const download=await wait;const stream=await download.createReadStream();const parts:Buffer[]=[];for await(const c of stream!)parts.push(Buffer.from(c));const bytes=Buffer.concat(parts);if(kind==='PDF')expect(bytes.subarray(0,4).toString()).toBe('%PDF');else{const b=new ExcelJS.Workbook();await b.xlsx.load(bytes as never);expect(b.getWorksheet('Source data')!.rowCount).toBe(19);expect(b.getWorksheet('Answers and review')!.getRow(2).getCell(3).value).toBe('approved');}
 }
 await page.getByRole('button',{name:'Dark theme',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.reload();
 await page.getByRole('navigation',{name:'Saved workspaces'}).getByRole('button',{name:'Tricky financial review',exact:true}).click();
 await expect(page.getByRole('region',{name:'Spreadsheet preview'})).toBeVisible();
 await expect(page.getByRole("region", {name:"Conversation workspace"}).getByText(/All rows: 9,808.97/).first()).toBeVisible();
 await expect(page.locator('.workspace-tools')).not.toHaveAttribute('open', '');
 await expect(page.getByText('Opened Tricky financial review. Your spreadsheet and conversation are ready.')).toBeVisible();
 await page.getByRole('button',{name:'Workspace tools',exact:true}).click();
 await page.getByText('Saved work, exports & routines',{exact:true}).click();
 await page.getByText('Review answers',{exact:true}).click();await expect(page.getByText('approved',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Delete saved workspace',exact:true}).click();
 await expect(page.getByLabel('Saved workspaces').locator('option')).toHaveCount(1);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect.poll(async()=>((await page.locator('.sidebar').boundingBox())?.x??0)+224).toBeLessThanOrEqual(1);
 await page.screenshot({path:test.info().outputPath('naxium-workspace-mobile.png'),fullPage:true});
});

test('explorer searches every row, reviews data and suggests questions without changing calculations', async ({ page }) => {
 await page.goto('/');
 const rows = Array.from({length:30}, (_,i) => `Travel,${i+1},note-${i}`);
 rows.push('Travel,1,note-0', 'Other,unknown,');
 await page.getByLabel('Upload spreadsheet').setInputFiles({name:'explorer.csv',mimeType:'text/csv',buffer:Buffer.from('Category,Amount,Note\n'+rows.join('\n'))});
 const preview = page.getByRole('region',{name:'Spreadsheet preview'});
 await expect(preview.getByRole('cell',{name:'note-29',exact:true})).toHaveCount(0);
 await preview.getByRole('button',{name:'Next rows'}).click();
 await expect(preview.getByRole('cell',{name:'note-29',exact:true})).toBeVisible();
 await preview.getByLabel('Search rows').fill('note-29');
 await expect(preview.getByRole('status')).toContainText('1 of 32');
 await expect(preview.getByRole('rowheader',{name:'31',exact:true})).toBeVisible();
 await preview.getByLabel('Search rows').fill('');
 await preview.getByText(/Data checks/).click();
 await expect(preview.getByText(/Mixed numeric and non-numeric/)).toBeVisible();
 await preview.getByLabel('Review rows').selectOption('duplicates');
 await expect(preview.getByRole('status')).toContainText('1 of 32');
 await expect(preview.getByRole('rowheader',{name:'32',exact:true})).toBeVisible();
 await preview.getByLabel('Review rows').selectOption('blanks');
 await expect(preview.getByRole('rowheader',{name:'33',exact:true})).toBeVisible();
 await preview.getByRole('button',{name:'How many rows?',exact:true}).click();
 await expect(page.getByLabel('Message Naxium')).toHaveValue('How many rows?');
 await page.getByRole('button',{name:'Send message'}).click();
 await expect(page.getByRole('region',{name:'Conversation workspace'}).getByText(/All rows: 32/)).toBeVisible();
});

test('approved workflow remembers steps and reuses them on a fresh file with schema checks', async ({page}) => {
 await page.goto('/');
 async function upload(name:string, csv:string) { await page.getByLabel('Upload spreadsheet').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from(csv)}); }
 await upload('first.csv','Category,Amount\nTravel,-20\nSoftware,-10');
 const composer=page.getByLabel('Message Naxium');
 for(const question of ['Total Amount','How many rows?']) {
  await composer.fill(question);await page.getByRole('button',{name:'Send message'}).click();
  await expect(page.getByRole('button',{name:'Send message'})).toBeDisabled();
 }
 await page.getByRole('tab',{name:'Workflow',exact:true}).click();
 const builder=page.getByRole('region',{name:'Workflow builder'});
 await builder.getByText(/Build from successful answers/).click();
 await builder.getByLabel('Workflow name',{exact:true}).fill('Expense checks');
 await builder.getByRole('button',{name:'Add answer 1 as step',exact:true}).click();
 await builder.getByRole('button',{name:'Add answer 2 as step',exact:true}).click();
 await builder.getByRole('button',{name:'Approve and remember workflow'}).click();
 await expect(page.getByText(/Workflow remembered/)).toBeVisible();
 await upload('new.csv','Category,Amount\nTravel,-50\nSoftware,-5\nFees,-1');
 await page.getByRole('tab',{name:'Workflow',exact:true}).click();
 await builder.getByLabel('Saved workflow',{exact:true}).selectOption({label:'Expense checks'});
 await builder.getByRole('button',{name:'Run workflow on current sheet'}).click();
 await expect(builder.getByRole('status')).toContainText('Completed 2 steps');
 const conversation=page.getByRole('region',{name:'Conversation workspace'});
 await expect(conversation.getByText(/All rows: -56/)).toBeVisible();
 await expect(conversation.getByText(/All rows: 3/)).toBeVisible();
 await conversation.getByRole('button',{name:'Inspect 3 source rows'}).first().click();
 await expect(page.getByText('Inspecting answer source rows.')).toBeVisible();
 await upload('wrong.csv','Other\n1');
 await page.getByRole('tab',{name:'Workflow',exact:true}).click();
 await expect(builder.getByRole('alert')).toContainText('Missing columns: Amount');
 await expect(builder.getByRole('button',{name:'Run workflow on current sheet'})).toBeDisabled();
 await builder.getByRole('button',{name:'Forget workflow'}).click();
 await expect(builder.getByLabel('Saved workflow').locator('option')).toHaveCount(1);
});

test('header choice keeps original row references and explicit autosave preserves new questions',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Workspace tools',exact:true}).click();
 await page.getByText('Import settings',{exact:true}).click();
 await page.getByLabel('Header row').fill('2');
 await page.getByLabel('Upload spreadsheet').setInputFiles({name:'bank.csv',mimeType:'text/csv',buffer:Buffer.from('Bank statement\nCategory,Amount\nTravel,-12\nSoftware,-8')});
 const preview=page.getByRole('region',{name:'Spreadsheet preview'});
 await expect(preview.getByRole('rowheader',{name:'3',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Workspace tools',exact:true}).click();
 await page.getByText('Saved work, exports & routines',{exact:true}).click();
 await page.getByLabel('Workspace name').fill('Bank import');
 await page.getByRole('button',{name:'Save workspace',exact:true}).click();
 await page.getByRole('checkbox',{name:/Autosave changes/}).check();
 await page.getByLabel('Message Naxium').fill('Total Amount');
 await page.getByRole('button',{name:'Send message'}).click();
 await expect(page.getByText(/All changes saved/)).toBeVisible({timeout:10000});
 await page.reload();
 await page.getByRole('navigation',{name:'Saved workspaces'}).getByRole('button',{name:'Bank import',exact:true}).click();
 await expect(page.getByRole('region',{name:'Conversation workspace'}).getByText(/All rows: -20/)).toBeVisible();
 await expect(page.getByRole('region',{name:'Spreadsheet preview'}).getByRole('rowheader',{name:'3',exact:true})).toBeVisible();
});

test('clarification and monthly results remain distinguishable and service health is minimal',async({page,request})=>{
 await page.goto('/');
 await page.getByLabel('Upload spreadsheet').setInputFiles({name:'periods.csv',mimeType:'text/csv',buffer:Buffer.from('Date,Amount\n2026-09-01,-10\n2026-09-15,5\n2026-10-01,-3')});
 const chat=page.getByRole('region',{name:'Conversation workspace'});
 await page.getByLabel('Message Naxium').fill('How much did we spend?');await page.getByRole('button',{name:'Send message'}).click();
 await expect(chat.getByText(/Which amount column and sign convention/)).toBeVisible();
 await expect(chat.getByRole('button',{name:/Inspect .* source rows/})).toHaveCount(0);
 await page.getByLabel('Message Naxium').fill('Show monthly total Amount by Date');await page.getByRole('button',{name:'Send message'}).click();
 await expect(chat.getByText(/2026-09: -5/)).toBeVisible();
 await expect(chat.getByRole('figure',{name:'Result comparison'})).toBeVisible();
 const health=await request.get('/api/health');expect(await health.json()).toEqual({status:'ok',service:'naxium'});
 expect([401,404]).toContain((await request.get('/api/readiness')).status());
 const invalid=await request.post('/api/sheet-question',{data:{}});expect(invalid.headers()['x-request-id']).toBeTruthy();
});

test('the exact namespace-prefixed CRM uploads and totals successfully',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Upload spreadsheet').setInputFiles('tests/fixtures/naxium-sales-crm-prefixed.xlsx');
 await expect(page.getByRole('region',{name:'Spreadsheet preview'})).toBeVisible();
 await page.getByLabel('Message Naxium').fill('Total Deal value');
 await page.getByRole('button',{name:'Send message'}).click();
 await expect(page.getByRole('region',{name:'Conversation workspace'}).getByText(/All rows: 442,300/)).toBeVisible();
});

test('one conversational sales-review request produces a proposal and one save action',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Upload spreadsheet').setInputFiles({name:'sales.csv',mimeType:'text/csv',buffer:Buffer.from('Company,Stage,Deal value,Next follow-up\nAlpha,Proposal,100,2026-10-20\nBeta,Qualified,200,2026-10-23')});
 await page.getByLabel('Message Naxium').fill('Create my daily sales review.');await page.getByRole('button',{name:'Send message'}).click();
 const proposal=page.getByRole('region',{name:'Proposed daily sales review'});
 await expect(proposal.getByRole('heading',{name:'Daily sales review',exact:true})).toBeVisible();
 await expect(proposal.getByText('Overdue follow-ups',{exact:true}).first()).toBeVisible();
 await expect(proposal.getByText('Follow-ups due today',{exact:true}).first()).toBeVisible();
 await proposal.getByRole('button',{name:'Save sales review',exact:true}).click();
 await expect(page.getByText(/Daily sales review saved/)).toBeVisible();
 await page.getByLabel('Saved workflow',{exact:true}).selectOption({label:'Daily sales review'});
 await page.getByRole('button',{name:'Run workflow on current sheet'}).click();
 await expect(page.getByText(/Completed 3 steps/)).toBeVisible();
});
