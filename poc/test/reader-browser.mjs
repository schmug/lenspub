// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { once } from 'node:events';
const root = new URL('../../',import.meta.url);
const port = process.env.QA_PORT || '4174';
const server = spawn(process.execPath,['scripts/serve-reader.mjs'],{cwd:root,env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
await once(server.stdout,'data');
const browser = await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
let passed = 0;
const check = async (name,fn) => {await fn(); passed++; console.log(`PASS ${name}`);};
const dir = new URL('../../dist/reader-qa/',import.meta.url);
await mkdir(dir,{recursive:true});
try {
  const page = await browser.newPage({viewport:{width:1440,height:1100}});
  const errors = [], remote = [];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  page.on('request',req=>{if(!req.url().startsWith(`http://127.0.0.1:${port}/`))remote.push(req.url());});
  await page.goto(`http://127.0.0.1:${port}/reader/`);
  await page.waitForSelector('.annotation');
  const source = await page.locator('#article').innerHTML();
  const name = () => page.locator('#active-name').textContent();
  const originalName = await name();
  const click = id => page.locator(`#${id}`).click();
  const importFile = async text => {
    await page.locator('#file').setInputFiles({name:'lens.json',mimeType:'application/json',buffer:Buffer.from(text)});
  };
  const fixture = await readFile(new URL('../lenses/avery-daily.json',import.meta.url),'utf8');
  await check('bundled engine: 3 highlights, 1 citation signal, 1 summary',async()=>{
    assert.equal(await page.locator('.annotation.highlight').count(),3);
    assert.equal(await page.locator('.annotation.evidence-indicator').count(),1);
    assert.equal(await page.locator('.annotation.summary').count(),1);
    assert.equal(await page.evaluate(()=>CSS.highlights.get('priorities').size),3);
  });
  await page.screenshot({path:new URL('desktop.jpg',dir).pathname,fullPage:true,type:'jpeg',quality:80});
  await check('keyboard Why dialog, trace, envelope, Escape and focus restoration',async()=>{
    const why=page.locator('.annotation.highlight button').first();await why.focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#why').evaluate(d=>d.open),true);
    assert.match(await page.locator('#why-body').textContent(),/Priority rule/);
    assert.match(await page.locator('#why-body').textContent(),/rule-based/);
    await page.screenshot({path:new URL('why.jpg',dir).pathname,type:'jpeg',quality:80});
    await page.keyboard.press('Escape');assert.equal(await page.locator('#why').evaluate(d=>d.open),false);
    assert.equal(await why.evaluate(n=>n===document.activeElement),true);
  });
  await check('preview is nonmutating; apply and undo restore source and lens',async()=>{
    await page.selectOption('#preset','evidence');await click('preview');
    assert.equal(await name(),originalName);assert.equal(await page.locator('.annotation').count(),5);
    assert.match(await page.locator('#comparison').textContent(),/3 → 0/);
    await click('apply');assert.equal(await page.locator('.annotation').count(),1);
    assert.equal(await page.locator('#article').innerHTML(),source);
    await click('undo');assert.equal(await name(),originalName);
  });
  await check('keyboard adjustment, cancel and stale preview invalidation',async()=>{
    await page.locator('#weight-0').focus();await page.keyboard.press('Home');
    await click('preview');assert.match(await page.locator('#preview-details').textContent(),/0.9 → -1/);
    await click('cancel');assert.equal(await page.locator('#weight-0').inputValue(),'0.9');
    await click('preview');await page.selectOption('#summary','none');
    assert.equal(await page.locator('#review').isVisible(),false);
    assert.equal(await name(),originalName);
  });
  await check('12 repeated preset switches and applies preserve article HTML',async()=>{
    for(let i=0;i<12;i++){
      await page.selectOption('#preset',['privacy','evidence','daily'][i%3]);await click('preview');await click('apply');
      assert.equal(await page.locator('#article').innerHTML(),source);
    }
  });
  await check('overlay toggle clears highlights without changing source DOM',async()=>{
    await click('toggle');assert.equal(await page.evaluate(()=>CSS.highlights.size),0);
    assert.equal(await page.locator('#article').innerHTML(),source);
    await click('toggle');assert.equal(await page.evaluate(()=>CSS.highlights.get('priorities').size),3);
  });
  let exported;
  await check('export/import round trip is staged and history-free',async()=>{
    const downloadEvent=page.waitForEvent('download');await click('export');const download=await downloadEvent;
    exported=await readFile(await download.path(),'utf8');const manifest=JSON.parse(exported);
    assert.equal(manifest.type,'LensManifest');
    for(const field of ['target','annotations','envelope','textBlocks','visitedUrls'])assert.equal(manifest[field],undefined);
    assert.ok(!exported.includes('73 percent'));
    await importFile(exported);await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Imported lens'));
    await click('apply');assert.match(await name(),new RegExp(manifest.metadata.lensVersion.replaceAll('.','\\.')));
  });
  await check('invalid, oversized, history-bearing and canceled imports preserve active lens',async()=>{
    const before=await name();
    for(const content of ['not json','null','{}',JSON.stringify({...JSON.parse(fixture),visitedUrls:['https://private.example']}),'x'.repeat(100001)]){
      await importFile(content);await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Import refused'));
      assert.equal(await name(),before);
    }
    await page.locator('#file').setInputFiles([]);assert.equal(await name(),before);
    await importFile(fixture);await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Imported lens'));
    await click('cancel');assert.equal(await name(),before);
  });
  await check('stale asynchronous file completion cannot overwrite a newer draft',async()=>{
    await page.evaluate(()=>{window.readFileOriginal=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>{window.finishOldRead=()=>window.readFileOriginal.call(this).then(resolve);});};});
    await importFile(fixture);
    await page.waitForFunction(()=>!!window.finishOldRead);
    await page.selectOption('#preset','privacy');
    await page.evaluate(async()=>{await window.finishOldRead();File.prototype.text=window.readFileOriginal;});
    assert.equal(await page.locator('#review').isVisible(),false);
    assert.equal(await page.locator('#preset').inputValue(),'privacy');
  });
  await check('canceled and blank content input preserve source',async()=>{
    await click('content');await page.fill('#text-input','   ');await page.locator('#text-form button[type=submit]').click();
    assert.match(await page.locator('#text-error').textContent(),/nonblank/);
    await click('text-cancel');assert.equal(await page.locator('#article').innerHTML(),source);
    await click('content');await page.keyboard.press('Escape');assert.equal(await page.locator('#article').innerHTML(),source);
  });
  await check('untrusted content is inert text; no HTML elements or remote requests',async()=>{
    await click('content');await page.fill('#text-title','<img src=x>');
    const text='<script>window.pwned=true</script>\n\n<img src="https://untrusted.example/track"> local-first software\n\nA claim about 73 percent with no citation.';
    await page.fill('#text-input',text);await page.locator('#text-form button[type=submit]').click();
    assert.equal(await page.locator('#article script,#article img').count(),0);
    assert.equal(await page.evaluate(()=>window.pwned),undefined);
    assert.equal(await page.locator('#article p').allTextContents().then(p=>p.join('\n\n')),text);
  });
  await check('reset cancel preserves reading; confirm clears reading and undo; reload resets session',async()=>{
    await click('reset');await click('reset-cancel');assert.match(await page.locator('#source-label').textContent(),/PASTED/);
    await click('reset');await click('reset-confirm');assert.equal(await page.locator('#article').innerHTML(),source);
    assert.equal(await page.locator('#undo').isDisabled(),true);assert.equal(await name(),originalName);
    await page.selectOption('#preset','privacy');await click('preview');await click('apply');
    await page.reload();await page.waitForSelector('.annotation');assert.equal(await name(),originalName);
  });
  await check('mobile 390px: no overflow, dialog and lens workflow usable',async()=>{
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.selectOption('#preset','evidence');await click('preview');await click('apply');
    await page.locator('.annotation button').first().click();assert.equal(await page.locator('#why').evaluate(d=>d.open),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.keyboard.press('Escape');await click('reset');await click('reset-confirm');
    await page.screenshot({path:new URL('mobile.jpg',dir).pathname,fullPage:true,type:'jpeg',quality:80});
  });
  await check('keyboard skip link reaches article',async()=>{
    await page.reload();await page.waitForSelector('.annotation');await page.keyboard.press('Tab');
    assert.equal(await page.locator('.skip').evaluate(n=>n===document.activeElement),true);
    await page.keyboard.press('Enter');assert.equal(await page.locator('#article').evaluate(n=>n===document.activeElement),true);
  });
  await check('no runtime external network, browser errors, or persisted reading data',async()=>{
    assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);
    assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  });
  await check('static host denies repository and traversal paths',async()=>{
    for(const path of ['/.git/config','/../package.json','/reader/../../package.json','/engine/../manifest.json']){
      assert.equal((await page.request.get(`http://127.0.0.1:${port}${path}`)).status(),404);
    }
  });
  console.log(`\n${passed} browser scenarios passed; screenshots: dist/reader-qa/`);
} finally {await browser.close();server.kill();}
