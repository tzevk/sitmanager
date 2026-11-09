import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:process.env.HOME+'/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const p=await b.newPage(); await p.setViewport({width:1440,height:900});
await p.goto('http://localhost:3123/public/corporate-training',{waitUntil:'networkidle2',timeout:120000});
const H=await p.evaluate(()=>Math.max(document.body.scrollHeight,document.documentElement.scrollHeight));
let i=0; for(let y=0;y<H;y+=900){ await p.evaluate(v=>{document.body.scrollTop=v;document.documentElement.scrollTop=v;window.scrollTo(0,v)},y); await new Promise(r=>setTimeout(r,1800)); await p.screenshot({path:'/private/tmp/claude-501/-Users-tanvikadam-Desktop-SIT-sitmanager/00c181a0-688a-4c4a-a47c-ed28be0e0180/scratchpad/v'+String(i++).padStart(2,'0')+'.png'}); }
console.log(i); await b.close();
