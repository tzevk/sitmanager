import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:process.env.HOME+'/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const p=await b.newPage(); await p.setViewport({width:1440,height:900});
await p.goto('http://localhost:3123/public/corporate-training',{waitUntil:'networkidle2',timeout:120000});
await p.evaluate(()=>document.querySelector('#evaluation').scrollIntoView()); await new Promise(r=>setTimeout(r,1800)); await p.screenshot({path:'/private/tmp/claude-501/-Users-tanvikadam-Desktop-SIT-sitmanager/00c181a0-688a-4c4a-a47c-ed28be0e0180/scratchpad/y-eval.png'});
console.log(await p.evaluate(()=>[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+' '+f.weight).join(' | ')));
await b.close();
