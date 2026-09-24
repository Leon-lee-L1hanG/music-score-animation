import React,{useMemo,useLayoutEffect,Suspense} from 'react';
import {registerRoot,Composition,AbsoluteFill,Audio,staticFile,useCurrentFrame,useVideoConfig,interpolate} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree,useLoader,useFrame} from '@react-three/fiber';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {BokehPass} from 'three/examples/jsm/postprocessing/BokehPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import * as THREE from 'three';
import data from '../public/score-data.json';
const S=.025,W=data.geometry.width*S,H=data.geometry.height*S;
const colors=['#bc9aff','#ffc381'];
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const events=data.events;
function groups(staff:number){const map=new Map<number,any[]>();events.filter(n=>n.staff===staff).forEach(n=>map.set(n.time,[...(map.get(n.time)||[]),n]));return [...map].sort((a,b)=>a[0]-b[0]).map(([time,ns])=>({...ns.reduce((a,b)=>a.midi>b.midi?a:b),time,notes:ns}));}
const groupsByStaff=[groups(1),groups(2)];
export function ballAt(t:number,staff:number){
 const gs=groupsByStaff[staff-1],first=gs[0],last=gs[gs.length-1];
 if(t<first.time){const p=clamp((t-first.time+data.lead)/data.lead);return {x:first.x*S,z:first.y*S,y:.115+.4*(1-p*p),alpha:p};}
 if(t>=last.time){const p=clamp((t-last.time)/.4);return {x:last.x*S,z:last.y*S,y:.115,alpha:clamp((data.duration-t)/.7)};}
 const i=gs.findIndex((n,j)=>j<gs.length-1&&t>=n.time&&t<gs[j+1].time),a=gs[i],b=gs[i+1],p=(t-a.time)/(b.time-a.time);
 const h=.20+Math.min(.25,(b.time-a.time)*.08);
 return {x:(a.x+(b.x-a.x)*p)*S,z:(a.y+(b.y-a.y)*p)*S,y:.115+4*h*p*(1-p),alpha:1};
}
const timeline=[...new Set(events.map(n=>n.time))].sort((a,b)=>a-b).map(time=>({time,x:events.filter(n=>n.time===time).reduce((s,n)=>s+n.x,0)/events.filter(n=>n.time===time).length*S}));
function cameraX(t:number){
 if(t<timeline[0].time)return timeline[0].x-.10*(timeline[0].time-t);
 const i=timeline.findIndex((n,j)=>j<timeline.length-1&&t>=n.time&&t<timeline[j+1].time);
 if(i<0)return timeline[timeline.length-1].x+.10*(t-timeline[timeline.length-1].time);
 const a=timeline[i],b=timeline[i+1],u=(t-a.time)/(b.time-a.time);
 // Hermite interpolation creates a continuous camera velocity between score columns.
 const before=timeline[Math.max(0,i-1)],after=timeline[Math.min(timeline.length-1,i+2)];
 const d=b.time-a.time,m0=(b.x-before.x)/(b.time-before.time),m1=(after.x-a.x)/(after.time-a.time);
 return (2*u**3-3*u*u+1)*a.x+(u**3-2*u*u+u)*d*m0+(-2*u**3+3*u*u)*b.x+(u**3-u*u)*d*m1;
}
function Camera({t}:{t:number}){const {camera}=useThree();useLayoutEffect(()=>{const limit=W-5.5;const raw=cameraX(t);const x=limit-.8*Math.log1p(Math.exp((limit-raw)/.8));camera.position.set(x-.75,5.8,8.1);camera.lookAt(x+.4,0,2.35);camera.updateProjectionMatrix();},[t,camera]);return null;}
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragment=`uniform sampler2D score;uniform vec2 upper;uniform vec2 lower;uniform vec2 size;varying vec2 vUv;
void main(){vec2 p=vec2(vUv.x,1.-vUv.y)*size;float ink=texture2D(score,vUv).a;
vec3 paper=vec3(.018,.024,.032);vec3 notation=vec3(.42,.44,.41);
float u=exp(-dot(p-upper,p-upper)/1.65),l=exp(-dot(p-lower,p-lower)/1.65);
paper+=u*vec3(.045,.019,.075)+l*vec3(.075,.037,.014);
vec3 col=mix(paper,notation+u*vec3(.11,.05,.19)+l*vec3(.18,.08,.02),ink);
float edge=smoothstep(0.,.13,vUv.y)*smoothstep(0.,.13,1.-vUv.y);col*=.70+.30*edge;
gl_FragColor=vec4(col,1.);}`;
function Paper({t}:{t:number}){
 const texture=useLoader(THREE.TextureLoader,staticFile('score-texture.png'));
 const a=ballAt(t,1),b=ballAt(t,2);
 const uniforms=useMemo(()=>({score:{value:texture},upper:{value:new THREE.Vector2()},lower:{value:new THREE.Vector2()},size:{value:new THREE.Vector2(W,H)}}),[texture]);
 uniforms.upper.value.set(a.x,a.z);uniforms.lower.value.set(b.x,b.z);
 return <group><mesh rotation={[-Math.PI/2,0,0]} position={[W/2,-.035,H/2]}><planeGeometry args={[W+.5,H+.4]}/><meshStandardMaterial color="#161d27" roughness={.95}/></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[W/2,0,H/2]}><planeGeometry args={[W,H]}/><shaderMaterial uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment}/></mesh></group>;
}
function Ball({staff,t}:{staff:number,t:number}){const p=ballAt(t,staff),c=colors[staff-1];return <group position={[p.x,p.y,p.z]} visible={p.alpha>0}>
 <mesh><sphereGeometry args={[.105,24,16]}/><meshStandardMaterial color={c} emissive={c} emissiveIntensity={2.5} roughness={.23} metalness={.15} transparent opacity={p.alpha}/></mesh>
 <mesh><sphereGeometry args={[.138,20,12]}/><meshBasicMaterial color={c} transparent opacity={.07*p.alpha} depthWrite={false}/></mesh>
 <mesh position={[-.03,.044,.058]}><sphereGeometry args={[.03,12,8]}/><meshBasicMaterial color="#fff6eb" transparent opacity={p.alpha*.9}/></mesh>
 </group>;}
function Rings({t}:{t:number}){return <>{data.symbols.filter(n=>t>=n.time&&t-n.time<.9).map(n=>{const age=t-n.time,p=age/.9,weak=n.tie==='stop'?.3:1;return <mesh key={n.id} position={[n.x*S,.014,n.y*S]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.115+age*.13,.128+age*.13,48]}/><meshBasicMaterial color={colors[n.staff-1]} transparent opacity={weak*(1-p)**2*.92} toneMapped={false} depthWrite={false}/></mesh>})}</>;}
function Trail({t,staff}:{t:number,staff:number}){const geometry=useMemo(()=>{const points=[];for(let i=0;i<12;i++){const q=ballAt(Math.max(0,t-i*.012),staff);points.push(new THREE.Vector3(q.x,q.y,q.z));}return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),18,.009,5,false);},[t,staff]);useLayoutEffect(()=>()=>geometry.dispose(),[geometry]);return t<data.lead?null:<mesh geometry={geometry}><meshBasicMaterial color={colors[staff-1]} transparent opacity={.2} depthWrite={false}/></mesh>;}
function Post(){const {gl,scene,camera,size}=useThree();const composer=useMemo(()=>{const c=new EffectComposer(gl);c.setSize(size.width,size.height);c.addPass(new RenderPass(scene,camera));c.addPass(new BokehPass(scene,camera,{focus:8.17,aperture:.000012,maxblur:.0013}));c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width,size.height),.24,.25,1.05));c.addPass(new OutputPass());return c;},[gl,scene,camera,size.width,size.height]);useFrame(()=>composer.render(),1);useLayoutEffect(()=>()=>{composer.passes.forEach(p=>p.dispose?.());composer.dispose();},[composer]);return null;}
function Scene({t}:{t:number}){return <><color attach="background" args={['#091019']}/><Camera t={t}/><ambientLight intensity={.6}/><directionalLight position={[1,8,3]} intensity={1.3} color="#e7e2fd"/><Paper t={t}/><Ball staff={1} t={t}/><Ball staff={2} t={t}/><Rings t={t}/><Trail staff={1} t={t}/><Trail staff={2} t={t}/><Post/></>;}
const Film=()=>{const frame=useCurrentFrame(),{fps}=useVideoConfig(),t=frame/fps;const fade=interpolate(t,[0,.25,data.duration-.7,data.duration],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});return <AbsoluteFill style={{background:'#080e16',color:'#e6ddc9',fontFamily:'"Microsoft YaHei",sans-serif'}}>
 <ThreeCanvas width={1920} height={1080} camera={{fov:43,near:.1,far:100}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}}><Scene t={t}/></ThreeCanvas>
 <AbsoluteFill style={{pointerEvents:'none',background:'radial-gradient(ellipse at 51% 58%,transparent 32%,rgba(2,6,13,.42) 100%)'}}/>
 <div style={{position:'absolute',top:60,left:76,display:'flex',alignItems:'center',gap:25}}>{data.theme==='midautumn'&&<div style={{width:48,height:48,borderRadius:'50%',background:'radial-gradient(circle at 38% 34%,#f3e5bf,#9d8d6c)',boxShadow:'0 0 45px #dec79817',opacity:.75}}/>}<div><div style={{fontSize:17,letterSpacing:7,color:'#cdbfa4'}}>{data.subtitle}</div><div style={{fontSize:44,letterSpacing:7,fontFamily:'"SimSun",serif',marginTop:8}}>{data.title}</div></div></div>
 <div style={{position:'absolute',top:71,right:79,textAlign:'right',color:'#b5b8c1',fontSize:14,letterSpacing:4,lineHeight:2}}>{data.label}<br/><span style={{fontSize:12,color:'#858c9c'}}>PIANO STUDY</span></div>
 <div style={{position:'absolute',bottom:66,left:80,fontFamily:'"SimSun",serif',fontSize:24,letterSpacing:8,color:'#d5c8ad'}}>{data.tagline}</div>
 <div style={{position:'absolute',bottom:69,right:80,display:'flex',gap:28,fontSize:13,letterSpacing:3,color:'#aeb2bf'}}><span style={{color:'#bc9aff'}}>● 旋律</span><span style={{color:'#ffc381'}}>● 伴奏</span></div>
 <div style={{position:'absolute',bottom:35,left:80,right:80,height:1,background:'#ffffff13'}}><div style={{height:1,width:`${clamp((t-data.lead)/(data.musicDuration))*100}%`,background:'#cfb897'}}/></div>
 <AbsoluteFill style={{background:'#080e16',opacity:1-fade,pointerEvents:'none'}}/>
 <Audio src={staticFile('piano.wav')}/>
 </AbsoluteFill>};
const Root=()=> <Composition id="ScoreFilm" component={Film} durationInFrames={Math.ceil(data.duration*30)} fps={30} width={1920} height={1080}/>;
registerRoot(Root);
