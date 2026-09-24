import fs from 'node:fs';
import {createRequire} from 'node:module';
import createVerovioModule from 'verovio/wasm';
import {VerovioToolkit} from 'verovio/esm';
const require=createRequire(import.meta.url);
const {Midi}=require('@tonejs/midi');
const out='public';fs.mkdirSync(out,{recursive:true});
// Agent supplies checked notation; no previous song is silently reused.
const input=JSON.parse(fs.readFileSync('score-input.json','utf8').replace(/^\uFEFF/,''));
const {upper:R,lower:L}=input;
if(!R?.length||R.length!==L?.length)throw Error('Provide verified upper and lower measure arrays in score-input.json');
const beats=input.beats||4,beatType=input.beatType||4,barBeats=beats*4/beatType,bpm=input.bpm||84,lead=5/30,beat=60/bpm,musicDuration=R.length*barBeats*beat,duration=lead+musicDuration+1.6;
const escapeXml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const pitch=p=>{const m=p.match(/^([A-G])([#b]?)(\d)$/);if(!m)throw Error("Invalid pitch "+p);const alter=m[2]==="#"?1:m[2]==="b"?-1:0;return {step:m[1],alter,octave:+m[3],midi:12*(+m[3]+1)+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]])+alter}};
const midi=new Midi();midi.header.setTempo(bpm);midi.header.name=input.title;
const tracks=[midi.addTrack(),midi.addTrack()];tracks[0].name='Upper staff';tracks[1].name='Lower staff';
const symbols=[],events=[];let parts='';
for(let m=0;m<R.length;m++){
 parts+=`<measure number="${m+1}">`;
 if(m===0)parts+=`<attributes><divisions>480</divisions><key><fifths>${input.fifths||0}</fifths></key><time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes><direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>`;
 for(let s=0;s<2;s++){
  if(s)parts+=`<backup><duration>${barBeats*480}</duration></backup>`;
  let pos=m*barBeats;
  const bar=[R,L][s][m];if(bar.reduce((a,n)=>a+n[1],0)!==barBeats)throw Error('bar duration');
  bar.forEach(([ps,d,tie],ni)=>{
   const pitches=Array.isArray(ps)?ps:[ps];
   pitches.forEach((p,ci)=>{
    const id=`n-s${s+1}-m${m+1}-i${ni}-c${ci}`;
    const types={4:'whole',2:'half',1:'quarter',0.5:'eighth',0.25:'16th',0.125:'32nd'};const dotted=!types[d]&&!!types[d/1.5];const type=types[d]||types[d/1.5];if(!type)throw Error('Unsupported duration; extend MusicXML notation for this rhythm: '+d);if(tie&&tie!=='start'&&tie!=='stop')throw Error('Extend tie-chain handling before using '+tie);
    const q=p?pitch(p):null;
    const bp=d===.5&&q&&ni>0&&bar[ni-1][0]&&bar[ni-1][1]===.5&&Math.floor((pos-.5)/2)===Math.floor(pos/2);
    const bn=d===.5&&q&&ni<bar.length-1&&bar[ni+1][0]&&bar[ni+1][1]===.5&&Math.floor((pos+.5)/2)===Math.floor(pos/2);
    const beam=bp||bn?`<beam number="1">${bp?(bn?'continue':'end'):'begin'}</beam>`:'';
    parts+=`<note id="${id}">${ci?'<chord/>':''}${q?`<pitch><step>${q.step}</step>${q.alter?`<alter>${q.alter}</alter>`:''}<octave>${q.octave}</octave></pitch>`:'<rest/>'}<duration>${d*480}</duration>${tie?`<tie type="${tie}"/>`:''}<voice>${s+1}</voice><type>${type}</type>${dotted?'<dot/>':''}<staff>${s+1}</staff>${beam}${tie?`<notations><tied type="${tie}"/></notations>`:''}</note>`;
    if(q){
     const symbol={id,staff:s+1,measure:m+1,pitch:p,midi:q.midi,beat:pos,time:lead+pos*beat,duration:d*beat,tie:tie||null};symbols.push(symbol);
     if(tie==='stop'){
      const prev=events.findLast(e=>e.staff===s+1&&e.midi===q.midi&&e.tieStart);
      if(!prev)throw Error('unmatched tie');prev.duration+=d*beat;prev.tieStart=false;
     }else events.push({...symbol,velocity:s===0?.79:.55,tieStart:tie==='start'});
    }
   });pos+=d;
  });
 }
 parts+='</measure>';
}
const xml=`<?xml version="1.0" encoding="utf-8"?><score-partwise version="4.0"><work><work-title>${escapeXml(input.title)}</work-title></work><identification><creator type="composer">${escapeXml(input.composer||'')}</creator><rights>${escapeXml(input.source||'Source recorded in project README')}</rights></identification><part-list><score-part id="P1"><part-name>Piano</part-name><part-abbreviation>Pno.</part-abbreviation><score-instrument id="I1"><instrument-name>Piano</instrument-name></score-instrument><midi-instrument id="I1"><midi-channel>1</midi-channel><midi-program>1</midi-program></midi-instrument></score-part></part-list><part id="P1">${parts}</part></score-partwise>`;
fs.writeFileSync(`${out}/score.musicxml`,xml);
for(const e of events)tracks[e.staff-1].addNote({midi:e.midi,time:e.time,duration:e.duration,velocity:e.velocity});
fs.writeFileSync(`${out}/performance.mid`,Buffer.from(midi.toArray()));
const toolkit=new VerovioToolkit(await createVerovioModule());
toolkit.setOptions({breaks:'none',pageWidth:60000,pageHeight:1500,adjustPageWidth:true,adjustPageHeight:true,header:'none',footer:'none',scale:40,svgViewBox:true,spacingStaff:14,spacingSystem:2,spacingLinear:.35,spacingNonLinear:.55});
if(!toolkit.loadData(xml))throw Error('MusicXML failed');
fs.writeFileSync(`${out}/score.svg`,toolkit.renderToSVG(1));
fs.writeFileSync(`${out}/score.mei`,toolkit.getMEI());
fs.writeFileSync(`${out}/notes.json`,JSON.stringify({title:input.title,theme:input.theme||'minimal',subtitle:input.subtitle||'钢琴乐句',tagline:input.tagline||'',label:input.label||'PIANO SCORE',bpm,lead,duration,musicDuration,symbols,events},null,2));
console.log({symbols:symbols.length,onsets:events.length,duration,pages:toolkit.getPageCount()});
