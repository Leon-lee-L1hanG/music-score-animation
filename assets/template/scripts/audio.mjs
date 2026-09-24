import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const data=JSON.parse(fs.readFileSync('public/score-data.json'));
const sf=fs.readFileSync('sources/acoustic_grand_piano-mp3.js','utf8');
const samples=new Map([...sf.matchAll(/"([A-G](?:b|#)?\d)":\s*"data:audio\/mp3;base64,([^"\s]+)"/g)].map(m=>[m[1],m[2]]));
const enh={'C#':'Db','D#':'Eb','F#':'Gb','G#':'Ab','A#':'Bb'};
const sr=44100,n=Math.ceil(data.duration*sr),left=new Float32Array(n),right=new Float32Array(n),decoded=new Map();
fs.mkdirSync('.cache/audio',{recursive:true});
for(const pitch of new Set(data.events.map(e=>e.pitch))){
 const key=pitch.replace(/[A-G]#/,s=>enh[s]);const encoded=samples.get(key)||samples.get(pitch);if(!encoded)throw Error('No piano sample '+pitch);
 const path=`.cache/audio/${pitch.replace('#','s')}.mp3`;fs.writeFileSync(path,Buffer.from(encoded,'base64'));
 const raw=execFileSync('ffmpeg',['-v','error','-i',path,'-f','f32le','-ac','1','-ar',String(sr),'pipe:1'],{maxBuffer:20e6});
 const a=new Float32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
 const peak=a.reduce((m,v)=>Math.max(m,Math.abs(v)),0);let start=0;while(start<a.length&&Math.abs(a[start])<peak*.0015)start++;
 decoded.set(pitch,a.slice(Math.max(0,start-44)));
}
for(const e of data.events){
 const a=decoded.get(e.pitch),start=Math.round(e.time*sr),gate=e.duration*sr,release=.38*sr;
 const pan=e.staff===1?.18:-.18,gain=e.velocity*.8;
 for(let i=0;i<a.length&&start+i<n&&i<gate+release;i++){
  const env=i<gate?1:Math.exp(-6*(i-gate)/release);const v=a[i]*gain*env;
  left[start+i]+=v*Math.sqrt((1-pan)/2);right[start+i]+=v*Math.sqrt((1+pan)/2);
 }
}
// Short, quiet room reflections; the dry onset remains sample-aligned.
for(const [delay,g] of [[.043,.09],[.079,.06],[.127,.035]]){
 const d=Math.round(sr*delay);for(let i=n-1;i>=d;i--){left[i]+=right[i-d]*g;right[i]+=left[i-d]*g;}
}
let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));const norm=.84/peak;
const pcm=Buffer.alloc(n*4);for(let i=0;i<n;i++){const fade=Math.min(1,(n-i)/(sr*.8));pcm.writeInt16LE(Math.round(left[i]*norm*fade*32767),i*4);pcm.writeInt16LE(Math.round(right[i]*norm*fade*32767),i*4+2);}
const wav=Buffer.alloc(44);wav.write('RIFF');wav.writeUInt32LE(pcm.length+36,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(sr,24);wav.writeUInt32LE(sr*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);
fs.writeFileSync('public/piano.wav',Buffer.concat([wav,pcm]));fs.writeFileSync('audio-report.json',JSON.stringify({sampleRate:sr,channels:2,peakDb:20*Math.log10(.84),duration:n/sr,firstOnset:data.lead,source:'FluidR3_GM acoustic_grand_piano via gleitz/midi-js-soundfonts; same events as performance.mid',notes:data.events.length},null,2));console.log({samples:decoded.size,seconds:n/sr,peak:.84});
