import fs from 'node:fs';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import * as THREE from 'three';
const require=createRequire(import.meta.url),{Midi}=require('@tonejs/midi');
const data=JSON.parse(fs.readFileSync('public/score-data.json'));
// Execute the actual motion functions from the film, not a second approximation.
const source=fs.readFileSync('src/index.tsx','utf8');
const motion=source.slice(source.indexOf('const S='),source.indexOf('function Camera('));
const js=transformSync(`const data=${JSON.stringify(data)};${motion}\nexport {groupsByStaff,cameraX,S,W};`,{loader:'ts',format:'esm'}).code;
const {ballAt,groupsByStaff,cameraX,S,W}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const midi=new Midi(fs.readFileSync('public/performance.mid'));const failures=[];
let maxTimingError=0,maxLandingError=0;
const counts=[];
for(let staff=1;staff<=2;staff++){
 const notes=midi.tracks[staff-1].notes,es=data.events.filter(n=>n.staff===staff);if(notes.length!==es.length)failures.push('MIDI count '+staff);
 const remaining=[...notes];for(const e of es){let i=remaining.findIndex(n=>n.midi===e.midi&&Math.abs(n.time-e.time)<.002);if(i<0){failures.push('Unmatched MIDI '+e.id);continue;}const n=remaining.splice(i,1)[0];maxTimingError=Math.max(maxTimingError,Math.abs(n.time-e.time));if(Math.abs(n.duration-e.duration)>.003)failures.push('Duration '+e.id);}
 for(const g of groupsByStaff[staff-1]){const p=ballAt(g.time,staff),error=Math.hypot(p.x-g.x*S,p.z-g.y*S,p.y-.115);maxLandingError=Math.max(error,maxLandingError);if(error>1e-8)failures.push('Landing '+g.id);}
 counts.push({staff,midiOnsets:notes.length,mapped:es.length,unmatched:remaining.length,tieContinuations:data.symbols.filter(n=>n.staff===staff&&n.tie==='stop').length});
}
let offscreen=0,maxCameraStep=0,prevX=null;
for(let frame=0;frame<Math.ceil(data.duration*30);frame++){
 const t=frame/30,raw=cameraX(t),limit=W-5.5,x=limit-.8*Math.log1p(Math.exp((limit-raw)/.8));
 const c=new THREE.PerspectiveCamera(43,1920/1080,.1,100);c.position.set(x-.75,5.8,8.1);c.lookAt(x+.4,0,2.35);c.updateMatrixWorld();
 if(prevX!==null)maxCameraStep=Math.max(maxCameraStep,Math.abs(x-prevX));prevX=x;
 for(let staff=1;staff<=2;staff++){const p=ballAt(t,staff),v=new THREE.Vector3(p.x,p.y,p.z).project(c);if(Math.abs(v.x)>.95||Math.abs(v.y)>.85||!Number.isFinite(v.x)){offscreen++;}}
}
if(offscreen)failures.push('Offscreen samples '+offscreen);
const result={passed:failures.length===0,failures,counts,maxMidiTimingErrorMs:maxTimingError*1000,maxLandingErrorWorldUnits:maxLandingError,framesChecked:Math.ceil(data.duration*30),offscreenBallSamples:offscreen,maxCameraStepWorldUnits:maxCameraStep,frameQuantizationLimitMs:1000/30,scope:'MIDI reparse, all onset landings, tied-note durations, every frame camera bounds. Audio and encoded video checked separately.'};fs.writeFileSync('verification.json',JSON.stringify(result,null,2));console.log(result);if(failures.length)process.exitCode=1;
