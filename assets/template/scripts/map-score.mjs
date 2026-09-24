import fs from 'node:fs';
import {openBrowser} from '@remotion/renderer';
const browser=await openBrowser('chrome',{browserExecutable:process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':null),chromiumOptions:{headless:true}});
try{
 const page=await browser.newPage({context:()=>{},logLevel:'error',indent:false,pageIndex:0,onBrowserLog:null,onLog:()=>{}});
 const svg=fs.readFileSync('public/score.svg','utf8');
 await page.goto({url:'data:text/html;charset=utf-8,'+encodeURIComponent(`<body style="margin:0">${svg}</body>`),timeout:30000});
 const data=JSON.parse(fs.readFileSync('public/notes.json'));
 const geometry=await page.evaluate(()=>{
  const root=document.querySelector('svg'),vb=root.viewBox.baseVal,rect=root.getBoundingClientRect();
  const notes={};document.querySelectorAll('g.note').forEach(n=>{const h=n.querySelector('.notehead');if(!h)return;const r=h.getBoundingClientRect();notes[n.id]={x:(r.x+r.width/2-rect.x)/rect.width*vb.width,y:(r.y+r.height/2-rect.y)/rect.height*vb.height,w:r.width/rect.width*vb.width,h:r.height/rect.height*vb.height};});
  return {width:vb.width,height:vb.height,notes};
 });
 for(const n of [...data.symbols,...data.events]){if(!geometry.notes[n.id])throw Error('Missing notehead '+n.id);Object.assign(n,geometry.notes[n.id]);}
 const png=await page.evaluate(async(source)=>{
  const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(source)));await img.decode();
  const canvas=document.createElement('canvas');canvas.width=Math.min(12000,img.width*8);canvas.height=Math.round(canvas.width*img.height/img.width);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png').split(',')[1];
 },svg);
 fs.writeFileSync('public/score-texture.png',Buffer.from(png,'base64'));
 data.geometry=geometry;fs.writeFileSync('public/score-data.json',JSON.stringify(data));
 const report={staffs:[1,2].map(staff=>({staff,midiOnsets:data.events.filter(n=>n.staff===staff).length,mapped:data.events.filter(n=>n.staff===staff&&Number.isFinite(n.x)).length,unmatched:0,tieContinuations:data.symbols.filter(n=>n.staff===staff&&n.tie==='stop').length})),noteheads:data.symbols.length,source:'MusicXML → Verovio SVG note IDs → browser notehead bounding boxes',duration:data.duration};
 fs.writeFileSync('mapping-report.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close({silent:true});}
