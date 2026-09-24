import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const file='output/music-score.mp4';
function decode(path,sr,stereo=false){const b=execFileSync('ffmpeg',['-v','error','-i',path,'-vn',...(stereo?['-ac','2']:['-af','pan=mono|c0=0.5*c0+0.5*c1']),'-ar',String(sr),'-f','f32le','pipe:1'],{maxBuffer:30e6});return new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));}
const a=decode('public/piano.wav',8000),b=decode(file,8000);let best=-Infinity,lag=0;
for(let shift=-400;shift<=400;shift++){let ab=0,aa=0,bb=0;for(let i=800;i<Math.min(a.length,b.length)-800;i+=4){const x=a[i],y=b[i+shift];ab+=x*y;aa+=x*x;bb+=y*y;}const corr=ab/Math.sqrt(aa*bb);if(corr>best){best=corr;lag=shift;}}
const full=decode(file,48000,true);let peak=0,clipped=0;for(const v of full){peak=Math.max(peak,Math.abs(v));if(Math.abs(v)>=.999)clipped++;}
const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate,start_time,duration,sample_rate','-of','json',file],{encoding:'utf8'}));
const report={passed:Math.abs(lag)<=8&&clipped===0,encodedAudioOffsetMs:lag/8,correlation:best,stereoPeakDb:20*Math.log10(peak),clippedSamples:clipped,probe,note:'Cross-correlation checks the decoded final AAC against the source WAV. Visual onset quantization remains 30 fps.'};fs.writeFileSync('encoded-verification.json',JSON.stringify(report,null,2));console.log(report);if(!report.passed)process.exitCode=1;
