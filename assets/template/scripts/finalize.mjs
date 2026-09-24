import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const d=JSON.parse(fs.readFileSync('public/score-data.json'));
execFileSync('ffmpeg',['-v','error','-y','-i','.cache/render-raw.mp4','-i','public/piano.wav','-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','320k','-ar','48000','-t',String(Math.ceil(d.duration*30)/30),'-movflags','+faststart','output/music-score.mp4'],{stdio:'inherit'});
console.log('Final MP4 muxed directly with the verified source WAV.');
