import * as T from '/three.js';
import {WEAPONS,WALLS,simulate,VERSION} from '/shared.js';
import {buildWorld} from '/world.js';
import {weaponModel,weaponIcon} from '/weapons.js';

const $=id=>document.getElementById(id);
const ui=Object.fromEntries(['menu','game-ui','name','cards','filters','play','status','quality','sensitivity','sound','hp','ammo','weaponName','healthFill','detail','blue','orange','online','performance','feed','notice','flash','damage','board','arsenal','radar','cross','scope','hitmark','grenades','selectedIcon','selectedName','selectedInfo','network'].map(k=>[k,$(k)]));
const hitInfo=document.createElement('div');hitInfo.id='hitInfo';hitInfo.setAttribute('aria-live','off');ui['game-ui'].append(hitInfo);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const grenadeNames={frag:'Осколочная',smoke:'Дымовая',flash:'Световая'};
const defaults={name:'',quality:'medium',sensitivity:20,sound:true,weapon:'ak'};
let prefs={...defaults};try{prefs={...defaults,...JSON.parse(localStorage.getItem('dustline-settings')||'{}')};}catch{}
let selected=WEAPONS[prefs.weapon]?prefs.weapon:'ak',primary=selected,grenadeType='frag',socket,id,state,me,connected=false,inMenu=true,connecting=false;
let yaw=0,pitch=0,keys={},fire=false,aim=false,seq=0,pending=[],activeLife=0,netAt=0,rtt=0,lastInputAt=performance.now(),hadLock=false;
let renderScale=prefs.quality==='low'?.85:1,recoil=0,flash=0,hurt=0,hitUntil=0,damageNumber='',headshot=false,oldHP=100,lastShotAt=0,lastFireAt=0,weaponKey='',clockOffset=0,footstep=0;
let frames=0,frameSum=0,fps=0,ms=0,fpsAt=0,slow=0,statAt=0,feed=[],audio,noiseBuffer;
let local={x:0,y:0,z:0,vy:0,wasJump:false};const renderPos={x:0,y:0,z:0},viewOffset=new T.Vector3(),cameraTarget=new T.Vector3(),lookDirection=new T.Vector3(),dummy=new T.Object3D();
const vec=new T.Vector3(),color=new T.Color();

// Real lighting and directional form, with static contact shadows and no shadow-map passes.
const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.info.autoReset=false;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
renderer.domElement.style.cssText='width:100vw;height:100vh;touch-action:none';const canvas=renderer.domElement;document.body.prepend(canvas);
const scene=new T.Scene();const camera=new T.PerspectiveCamera(76,innerWidth/innerHeight,.06,120);scene.add(camera);const world=buildWorld(scene);
const viewScene=new T.Scene(),viewCamera=new T.PerspectiveCamera(52,innerWidth/innerHeight,.03,8);viewScene.add(new T.HemisphereLight(0xf1efdf,0x728188,2.8));const viewSun=new T.DirectionalLight(0xfff1db,2.4);viewSun.position.set(-2,4,3);viewScene.add(viewSun);const weaponRoot=new T.Group();viewScene.add(weaponRoot);let gun;
// Static menu camera is part of the actual map, so no external art download is needed.
camera.position.set(-28,7,-2);camera.lookAt(-17,1.5,-11);renderer.render(scene,camera);
function resize(){const cap=ui.quality.value==='low'?850000:1500000,s=Math.min(renderScale,Math.sqrt(cap/(innerWidth*innerHeight)));renderer.setSize(Math.floor(innerWidth*s),Math.floor(innerHeight*s),false);camera.aspect=viewCamera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();viewCamera.updateProjectionMatrix();if(inMenu)renderFrame();}
function save(){try{localStorage.setItem('dustline-settings',JSON.stringify({name:ui.name.value,quality:ui.quality.value,sensitivity:ui.sensitivity.value,sound:ui.sound.checked,weapon:selected}));}catch{}}
ui.name.value=String(prefs.name||'').slice(0,16);ui.quality.value=prefs.quality==='low'?'low':'medium';ui.sensitivity.value=prefs.sensitivity;ui.sound.checked=!!prefs.sound;
ui.quality.onchange=()=>{renderScale=ui.quality.value==='low'?.85:1;slow=0;resize();save();};ui.sensitivity.onchange=save;ui.sound.onchange=save;window.addEventListener('resize',resize);

// Distinct operator uniforms, equipment, animated arms/legs and readable faces.
const boxGeo=new T.BoxGeometry(1,1,1),bodyMat=new T.MeshLambertMaterial({color:0xffffff});
const bodyParts=[
  [0,1.13,0,.56,.65,.33,'shirt'],[0,1.19,-.19,.47,.43,.10,'vest'],[0,.83,0,.58,.13,.36,'dark'],
  [-.14,1.14,-.27,.16,.18,.075,'pouch'],[.14,1.14,-.27,.16,.18,.075,'pouch'],[0,1.43,-.03,.30,.06,.32,'vest'],
  [0,1.73,0,.37,.42,.34,'skin'],[0,1.95,.01,.43,.13,.39,'helmet'],[-.21,1.82,.03,.055,.19,.18,'dark'],[.21,1.82,.03,.055,.19,.18,'dark'],
  [-.37,1.25,0,.19,.30,.22,'shirt','armL'],[.37,1.25,0,.19,.30,.22,'shirt','armR'],
  [-.32,1.11,-.26,.18,.19,.36,'shirt'],[.32,1.11,-.26,.18,.19,.36,'shirt'],[-.22,1.11,-.45,.17,.17,.17,'glove'],[.22,1.11,-.45,.17,.17,.17,'glove'],
  [-.15,.57,0,.235,.40,.26,'pants','legL'],[.15,.57,0,.235,.40,.26,'pants','legR'],[-.15,.22,0,.21,.30,.24,'pants','legL'],[.15,.22,0,.21,.30,.24,'pants','legR'],
  [-.15,.07,-.055,.25,.14,.36,'dark','legL'],[.15,.07,-.055,.25,.14,.36,'dark','legR'],
  [.17,1.22,-.62,.10,.11,.54,'gun'],[.17,1.23,-.93,.045,.045,.15,'gun'],[.17,1.10,-.60,.065,.17,.10,'dark']
];
const bodies=new T.InstancedMesh(boxGeo,bodyMat,32*bodyParts.length);bodies.instanceMatrix.setUsage(T.DynamicDrawUsage);bodies.frustumCulled=false;scene.add(bodies);
const palette=[{shirt:0x587184,vest:0x35454f,pouch:0x445058,helmet:0x4a5a60,pants:0x58666c},{shirt:0x9c8c70,vest:0x625f50,pouch:0x79735e,helmet:0x7b765f,pants:0x736f61}];
const sharedColors={skin:0xd4ae8c,dark:0x303b3e,glove:0x4f554c,gun:0x41494b};
const faceCanvas=document.createElement('canvas');faceCanvas.width=128;faceCanvas.height=128;const fc=faceCanvas.getContext('2d');fc.fillStyle='#d4ae8c';fc.fillRect(0,0,128,128);fc.fillStyle='#c19a7c';fc.fillRect(0,80,128,48);fc.fillStyle='#755c49';fc.fillRect(20,29,31,6);fc.fillRect(77,29,31,6);fc.fillStyle='#ede6d1';fc.fillRect(22,41,26,12);fc.fillRect(80,41,26,12);fc.fillStyle='#393c34';fc.fillRect(33,42,10,13);fc.fillRect(84,42,10,13);fc.fillStyle='#b4876a';fc.fillRect(60,48,8,30);fc.fillStyle='#a57b61';fc.fillRect(53,74,23,5);fc.fillStyle='#76594c';fc.fillRect(44,94,39,4);fc.fillStyle='#b38d72';fc.fillRect(38,104,52,9);
const faceTex=new T.CanvasTexture(faceCanvas);faceTex.colorSpace=T.SRGBColorSpace;faceTex.magFilter=T.LinearFilter;
const faces=new T.InstancedMesh(new T.PlaneGeometry(.345,.36),new T.MeshLambertMaterial({map:faceTex}),32);faces.instanceMatrix.setUsage(T.DynamicDrawUsage);faces.frustumCulled=false;scene.add(faces);
const remote=new Map(),shadowMat=new T.Matrix4();
function updateActors(now){let count=0,faceCount=0,blobCount=0;const time=now-85;
  for(const p of state.players){if(p.id===id||p.dead)continue;let r=remote.get(p.id);if(!r)continue;
    let a=r.prev,b=r.next;const alpha=clamp((time-a.at)/Math.max(1,b.at-a.at),0,1);let px=T.MathUtils.lerp(a.x,b.x,alpha),py=T.MathUtils.lerp(a.y,b.y,alpha),pz=T.MathUtils.lerp(a.z,b.z,alpha);
    const turn=Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw)),rot=a.yaw+turn*alpha,sn=Math.sin(rot),cs=Math.cos(rot);
    const moving=Math.hypot(b.x-a.x,b.z-a.z)>.015,walk=moving?Math.sin(now*.012+p.id)*.09:0;
    const pal=palette[p.team];
    for(const[x,y,z,w,h,d,key,joint]of bodyParts){const swing=joint==='legL'?walk:joint==='legR'?-walk:0;dummy.position.set(px+x*cs-z*sn,py+y+(joint?.startsWith('leg')?Math.abs(swing)*.12:0),pz+x*sn+z*cs);dummy.rotation.set(swing*3,-rot,0);dummy.scale.set(w,h,d);dummy.updateMatrix();bodies.setMatrixAt(count,dummy.matrix);color.setHex(pal[key]??sharedColors[key]);if(now<r.hurt)color.lerp(new T.Color(0xb95745),.55);bodies.setColorAt(count++,color);}
    dummy.position.set(px+.174*sn,py+1.74,pz-.174*cs);dummy.rotation.set(0,Math.PI-rot,0);dummy.scale.set(1,1,1);dummy.updateMatrix();faces.setMatrixAt(faceCount++,dummy.matrix);
    dummy.position.set(px,.004,pz);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(1.4,1,1);dummy.updateMatrix();world.blobs.setMatrixAt(blobCount++,dummy.matrix);
  }
  bodies.count=count;bodies.instanceMatrix.needsUpdate=true;if(bodies.instanceColor)bodies.instanceColor.needsUpdate=true;faces.count=faceCount;faces.instanceMatrix.needsUpdate=true;world.blobs.count=blobCount;world.blobs.instanceMatrix.needsUpdate=true;
}

// Fixed-size effect pools bound CPU/GPU use during sustained fire.
const traceData=new Float32Array(40*6),traceGeo=new T.BufferGeometry();traceGeo.setAttribute('position',new T.BufferAttribute(traceData,3).setUsage(T.DynamicDrawUsage));traceGeo.setDrawRange(0,0);const traces=new T.LineSegments(traceGeo,new T.LineBasicMaterial({color:0xf1ce8e,transparent:true,opacity:.7,depthWrite:false}));traces.frustumCulled=false;scene.add(traces);
const tracePool=Array.from({length:40},()=>({end:0,a:[0,0,0],b:[0,0,0]}));let traceIndex=0;
const effectGeo=new T.IcosahedronGeometry(1,0),impactMat=new T.MeshBasicMaterial({color:0xc4ae8a});
const impacts=Array.from({length:24},()=>{const mesh=new T.Mesh(effectGeo,impactMat);mesh.visible=false;scene.add(mesh);return{mesh,at:0};});let impactIndex=0;
const blasts=Array.from({length:5},()=>{const mesh=new T.Mesh(effectGeo,new T.MeshBasicMaterial({color:0xcd9d64,transparent:true,opacity:.55,depthWrite:false}));mesh.visible=false;scene.add(mesh);return{mesh,at:0};});let blastIndex=0;
const grenadeMat={frag:new T.MeshLambertMaterial({color:0x66725d}),smoke:new T.MeshLambertMaterial({color:0x829492}),flash:new T.MeshLambertMaterial({color:0xc2b9a2})};
const grenadeGeo=new T.SphereGeometry(.12,8,6),grenadeModels=new Map(),smokes=new Map();
const smokeGeo=new T.IcosahedronGeometry(1,1),smokeMat=new T.MeshLambertMaterial({color:0x999d98,transparent:true,opacity:.86,depthWrite:false});
function syncEffects(now){
  for(const g of state.grenades){let o=grenadeModels.get(g.id);if(!o){o=new T.Mesh(grenadeGeo,grenadeMat[g.type]);scene.add(o);grenadeModels.set(g.id,o);}o.position.set(g.x,g.y,g.z);}
  for(const[k,o]of grenadeModels)if(!state.grenades.some(g=>g.id===k)){scene.remove(o);grenadeModels.delete(k);}
  for(const c of state.clouds){let o=smokes.get(c.id);if(!o){o=new T.Group();for(let i=0;i<5;i++){const puff=new T.Mesh(smokeGeo,smokeMat);const a=i*2.4;puff.position.set(Math.sin(a)*1.4,.8+(i%2)*.7,Math.cos(a)*1.4);puff.scale.set(2.2,1.8,2.2);o.add(puff);}o.userData.born=now;scene.add(o);smokes.set(c.id,o);}o.position.set(c.x,0,c.z);const fade=clamp((c.until-(Date.now()-clockOffset))/1000,0,1),growth=clamp((now-o.userData.born)/600,.1,1);o.scale.setScalar(Math.min(growth,fade));}
  for(const[k,o]of smokes)if(!state.clouds.some(c=>c.id===k)){scene.remove(o);smokes.delete(k);}
  let n=0;for(const t of tracePool)if(t.end>now){traceData.set(t.a,n++*3);traceData.set(t.b,n++*3);}traceGeo.setDrawRange(0,n);traceGeo.attributes.position.needsUpdate=true;
  for(const e of impacts){const age=(now-e.at)/1000;e.mesh.visible=e.at>0&&age<.16;if(e.mesh.visible)e.mesh.scale.setScalar(.03+age*.3);}
  for(const e of blasts){const age=(now-e.at)/1000;e.mesh.visible=e.at>0&&age<.35;if(e.mesh.visible){e.mesh.scale.setScalar(.3+age*8);e.mesh.material.opacity=.5*(1-age/.35);}}
}

// Saved loadout, small icons and category filters.
const groups=[['Все','Все'],['Автоматы','Автоматы'],['Пистолеты','Пистолеты'],['ПП','Пистолеты-пулемёты'],['Ещё','Ещё']];let currentFilter='Все';
for(const[label,group]of groups){const b=document.createElement('button');b.className='filter'+(group==='Все'?' active':'');b.textContent=label;b.onclick=()=>{currentFilter=group;for(const x of ui.filters.children)x.classList.toggle('active',x===b);for(const x of ui.cards.children)x.hidden=group==='Ещё'?['Автоматы','Пистолеты','Пистолеты-пулемёты'].includes(WEAPONS[x.dataset.key].group):group!=='Все'&&WEAPONS[x.dataset.key].group!==group;};ui.filters.append(b);}
function choose(k){selected=k;if(!['knife','glock','deagle'].includes(k))primary=k;for(const b of ui.cards.children)b.classList.toggle('selected',b.dataset.key===k);ui.selectedIcon.innerHTML=weaponIcon(k);ui.selectedName.textContent=WEAPONS[k].name;ui.selectedInfo.textContent=WEAPONS[k].group+' · '+(WEAPONS[k].mag?WEAPONS[k].mag+' патронов':'ближний бой');save();}
for(const[k,w]of Object.entries(WEAPONS)){const b=document.createElement('button');b.className='weapon';b.dataset.key=k;b.innerHTML=weaponIcon(k);const name=document.createElement('strong'),info=document.createElement('small');name.textContent=w.name;info.textContent=w.mag?w.mag+' ПАТР.':'БЛИЖНИЙ БОЙ';b.append(name,info);b.onclick=()=>choose(k);ui.cards.append(b);}choose(selected);
function setWeapon(k){if(weaponKey===k)return;weaponKey=k;if(gun)weaponRoot.remove(gun);gun=weaponModel(k);gun.scale.setScalar(.85);weaponRoot.add(gun);weaponRoot.position.set(.22,-.24,-.70);}

// Soft, bounded procedural audio. No sharp oscillator beeps.
function initAudio(){if(!ui.sound.checked)return;try{if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();noiseBuffer=audio.createBuffer(1,Math.floor(audio.sampleRate*.5),audio.sampleRate);const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}audio.resume().catch(()=>{});}catch{}}
function noise(duration=.06,volume=.03,frequency=1100){if(!audio||audio.state!=='running'||!ui.sound.checked)return;const src=audio.createBufferSource(),gain=audio.createGain(),filter=audio.createBiquadFilter();src.buffer=noiseBuffer;filter.type='lowpass';filter.frequency.value=frequency;gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);src.connect(filter);filter.connect(gain);gain.connect(audio.destination);src.start();src.stop(audio.currentTime+duration);}
function shotFeedback(){recoil=.055;lastShotAt=performance.now();noise(weaponKey==='awp'?.16:.07,.045,weaponKey==='awp'?850:1600);}
function send(m){if(socket?.readyState===1&&socket.bufferedAmount<16384)socket.send(JSON.stringify(m));}
function locked(){return document.pointerLockElement===canvas;}
function lockMouse(){try{canvas.requestPointerLock?.()?.catch?.(()=>{});}catch{}}
function enterMenu(){if(!connected)return;inMenu=true;keys={};fire=false;aim=false;document.exitPointerLock?.();ui.menu.classList.remove('hidden');ui.status.textContent='Выбирай оружие. Команда и счёт сохранятся.';ui.play.innerHTML='ВЕРНУТЬСЯ В БОЙ <span>→</span>';renderFrame();}
function connect(){
  save();initAudio();lockMouse();
  if(connected){send({type:'weapon',weapon:selected});inMenu=false;ui.menu.classList.add('hidden');fpsAt=performance.now();frames=0;return;}
  if(connecting)return;connecting=true;ui.play.disabled=true;ui.status.textContent='Подключаемся к арене… После простоя сервер может запускаться около минуты.';
  socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);
  socket.onopen=()=>send({type:'join',name:ui.name.value.trim()||'Игрок',weapon:selected});
  socket.onmessage=e=>{
    const s=JSON.parse(e.data),now=performance.now();
    if(s.error){ui.status.textContent=s.error;return;}
    if(s.type==='pong'){rtt=Math.round(now-s.sent);return;}
    if(s.id){id=s.id;connected=true;connecting=false;inMenu=false;seq=0;pending=[];activeLife=0;ui.play.disabled=false;ui.menu.classList.add('hidden');ui['game-ui'].classList.remove('hidden');frames=0;fpsAt=now;lastInputAt=now;netAt=now;return;}
    if(s.type!=='state')return;
    netAt=now;clockOffset=Date.now()-s.time;state=s;me=s.players.find(p=>p.id===id);if(!me)return;
    if(activeLife!==me.life){activeLife=me.life;pending=[];local={x:me.x,y:me.y,z:me.z,vy:me.vy,wasJump:me.wasJump};renderPos.x=me.x;renderPos.y=me.y;renderPos.z=me.z;viewOffset.set(0,0,0);yaw=me.yaw;pitch=0;keys={};fire=false;aim=false;oldHP=100;}
    else if(!me.dead){
      pending=pending.filter(c=>c.seq>me.ack);
      const reconciled={x:me.x,y:me.y,z:me.z,vy:me.vy,wasJump:me.wasJump};for(const cmd of pending)simulate(reconciled,cmd,WEAPONS[cmd.weapon]);
      viewOffset.x+=local.x-reconciled.x;viewOffset.y+=local.y-reconciled.y;viewOffset.z+=local.z-reconciled.z;if(viewOffset.length()>1.4)viewOffset.set(0,0,0);local=reconciled;
    }
    if(me.hp<oldHP)hurt=.55;oldHP=me.hp;setWeapon(me.weapon);
    for(const p of s.players){if(p.id===id)continue;let r=remote.get(p.id);const sample={x:p.x,y:p.y,z:p.z,yaw:p.yaw,at:now};if(!r||r.life!==p.life){r={prev:sample,next:sample,life:p.life,hurt:0};remote.set(p.id,r);}else{r.prev=r.next;r.next=sample;}}
    for(const key of remote.keys())if(!s.players.some(p=>p.id===key))remote.delete(key);
    for(const ev of s.events)handleEvent(ev,now);updateHUD();
  };
  socket.onclose=()=>{connected=false;connecting=false;inMenu=true;id=undefined;keys={};pending=[];fire=false;aim=false;ui.play.disabled=false;ui.play.innerHTML='ПОДКЛЮЧИТЬСЯ <span>→</span>';ui.menu.classList.remove('hidden');ui.status.textContent='Связь потеряна. Нажми «Подключиться», чтобы вернуться.';document.exitPointerLock?.();};
  socket.onerror=()=>{ui.status.textContent='Не удалось подключиться. Дождись запуска сервера и попробуй снова.';};
}
function handleEvent(e,now){
  if(e.type==='shot'){
    if(e.weapon!=='knife'){const t=tracePool[traceIndex++%tracePool.length];t.a=e.a;t.b=e.b;t.end=now+65;const p=impacts[impactIndex++%impacts.length];p.at=now;p.mesh.position.fromArray(e.b);}
    if(e.by===id){if(now-lastShotAt>80)shotFeedback();}else{const d=me?Math.hypot(e.a[0]-local.x,e.a[2]-local.z):60;if(d<35)noise(.055,.018*(1-d/40),1000);}
  }
  if(e.type==='hit'){
    const r=remote.get(e.target);if(r)r.hurt=now+130;
    if(e.by===id){hitUntil=now+650;headshot=!!e.head;damageNumber='−'+e.damage+(e.head?' · В ГОЛОВУ':'');noise(.035,.035,2800);}
    if(e.target===id)hurt=.55;
  }
  if(e.type==='blast'&&e.kind==='frag'){const b=blasts[blastIndex++%blasts.length];b.at=now;b.mesh.position.set(e.x,e.y,e.z);if(Math.hypot(e.x-local.x,e.z-local.z)<35)noise(.25,.06,480);}
  if(e.type==='flash'&&e.target===id)flash=Math.max(flash,Math.min(.82,e.strength));
  if(e.type==='kill'){feed.unshift({text:e.by+'  ·  '+e.weapon+'  ·  '+e.target,until:now+6500});feed=feed.slice(0,4);if(e.by===me?.name)damageNumber='ЦЕЛЬ УСТРАНЕНА';}
}
function updateHUD(){if(!me)return;ui.hp.textContent=me.hp;ui.healthFill.style.width=me.hp+'%';ui.ammo.innerHTML=me.weapon==='knife'?'∞':me.ammo+' <span>/ '+WEAPONS[me.weapon].mag+'</span>';ui.weaponName.textContent=WEAPONS[me.weapon].name;ui.detail.textContent=me.team===0?'СИНЯЯ КОМАНДА':'ОРАНЖЕВАЯ КОМАНДА';ui.grenades.textContent='G · '+grenadeNames[grenadeType]+' × '+me.grenades[grenadeType]+'  /  H';ui.blue.textContent=state.scores[0];ui.orange.textContent=state.scores[1];ui.online.textContent=state.players.length+' / 32';ui.board.textContent='ТАБЛИЦА СЧЁТА\n\n'+[0,1].map(team=>(team===0?'СИНИЕ':'ОРАНЖЕВЫЕ')+'\n'+state.players.filter(p=>p.team===team).sort((a,b)=>b.kills-a.kills).map(p=>p.name+'     '+p.kills+' / '+p.deaths).join('\n')).join('\n\n');}
ui.play.onclick=connect;ui.arsenal.onclick=enterMenu;
canvas.addEventListener('pointerdown',e=>{if(inMenu||!connected)return;initAudio();if(!locked()){lockMouse();return;}if(e.button===0)fire=true;if(e.button===2)aim=true;});
window.addEventListener('pointerup',e=>{if(e.button===0)fire=false;if(e.button===2)aim=false;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('mousemove',e=>{if(inMenu||!locked())return;const sens=Number(ui.sensitivity.value)*.0001;yaw+=e.movementX*sens;pitch=clamp(pitch-e.movementY*sens,-1.3,1.3);});
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
  if(['Space','Tab','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.repeat)return;
  keys[e.code]=true;if(e.code==='KeyB'){enterMenu();return;}if(inMenu)return;
  if(e.code==='KeyV'){document.exitPointerLock?.();keys={};fire=false;aim=false;return;}
  if(e.code==='KeyR')send({type:'reload'});
  if(e.code==='KeyG')send({type:'grenade',grenade:grenadeType});
  if(e.code==='KeyH'){grenadeType={frag:'smoke',smoke:'flash',flash:'frag'}[grenadeType];updateHUD();}
  if(e.code==='Digit1')send({type:'weapon',weapon:primary});if(e.code==='Digit2')send({type:'weapon',weapon:'glock'});if(e.code==='Digit3')send({type:'weapon',weapon:'knife'});
});
window.addEventListener('keyup',e=>keys[e.code]=false);
function clearInput(){keys={};fire=false;aim=false;}
window.addEventListener('blur',clearInput);document.addEventListener('pointerlockchange',()=>{if(!locked())clearInput();hadLock=locked();});
document.addEventListener('visibilitychange',()=>{clearInput();pending=[];lastInputAt=performance.now();});
function inputCommand(dt){const fw=(keys.KeyW?1:0)-(keys.KeyS?1:0),side=(keys.KeyD?1:0)-(keys.KeyA?1:0),enabled=!inMenu&&!document.hidden&&!me?.dead;
  return{type:'input',seq:++seq,dt,x:enabled?Math.sin(yaw)*fw+Math.cos(yaw)*side:0,z:enabled?-Math.cos(yaw)*fw+Math.sin(yaw)*side:0,yaw,pitch,fire:enabled&&fire,aim:enabled&&aim,jump:enabled&&!!keys.Space,weapon:me?.weapon||selected};
}
setInterval(()=>{if(!connected||!me)return;const now=performance.now(),cmd=inputCommand(clamp((now-lastInputAt)/1000,.005,.06));lastInputAt=now;send(cmd);if(!me.dead&&!document.hidden){simulate(local,cmd,WEAPONS[me.weapon]);pending.push(cmd);if(pending.length>150)pending.shift();}},1000/60);
setInterval(()=>{if(connected&&!document.hidden)send({type:'ping',sent:performance.now()});},2000);

const radar=document.createElement('canvas');radar.width=radar.height=144;ui.radar.append(radar);const rc=radar.getContext('2d');
function drawRadar(){rc.clearRect(0,0,144,144);rc.fillStyle='#aea48e';rc.fillRect(6,12,132,120);rc.fillStyle='#5e655f';for(const[x,z,w,d]of WALLS)rc.fillRect(72+(x-w/2)*2,72+(z-d/2)*2,w*2,d*2);rc.font='bold 11px Arial';rc.fillStyle='#8d5138';rc.fillText('A',20,56);rc.fillStyle='#385f68';rc.fillText('B',115,94);for(const p of state.players){if(p.dead||p.team!==me.team)continue;rc.fillStyle=p.id===id?'#f5f0d5':p.team===0?'#b1d4e1':'#e5b48b';rc.beginPath();rc.arc(72+p.x*2,72+p.z*2,2.3,0,7);rc.fill();}rc.strokeStyle='#f8f1d5';rc.lineWidth=1;rc.beginPath();rc.moveTo(72+local.x*2,72+local.z*2);rc.lineTo(72+local.x*2+Math.sin(yaw)*7,72+local.z*2-Math.cos(yaw)*7);rc.stroke();}
function renderFrame(){renderer.info.reset();renderer.autoClear=true;renderer.render(scene,camera);if(connected&&!inMenu&&!me?.dead&&!(aim&&['awp','scout'].includes(weaponKey))){renderer.autoClear=false;renderer.clearDepth();renderer.render(viewScene,viewCamera);renderer.autoClear=true;}}
let last=performance.now(),menuRender=0;
function frame(now){
  requestAnimationFrame(frame);const rawDt=(now-last)/1000;last=now;if(document.hidden)return;const dt=clamp(rawDt,0,.05);
  if(!connected||inMenu){if(now-menuRender>200){menuRender=now;renderFrame();}return;}
  if(!me||!state)return;
  frames++;frameSum+=rawDt*1000;
  if(now-fpsAt>1200){fps=Math.round(frames*1000/(now-fpsAt));ms=frameSum/Math.max(1,frames);frames=0;frameSum=0;fpsAt=now;
    if(fps<42&&rawDt<.15)slow++;else slow=0;if(slow>=3&&renderScale>.65){renderScale=Math.max(.65,renderScale-.08);resize();slow=0;}
    ui.performance.textContent=fps+' FPS · '+rtt+' мс';canvas.dataset.fps=String(fps);canvas.dataset.drawCalls=String(renderer.info.render.calls);
  }
  if(!me.dead&&!inMenu){yaw+=((keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0))*dt*1.6;}
  viewOffset.multiplyScalar(Math.exp(-16*dt));const blend=1-Math.exp(-32*dt);
  renderPos.x+=(local.x+viewOffset.x-renderPos.x)*blend;renderPos.z+=(local.z+viewOffset.z-renderPos.z)*blend;renderPos.y+=(local.y+viewOffset.y-renderPos.y)*blend;
  if(me.dead){renderPos.y=me.y+.15;}
  camera.position.set(renderPos.x,renderPos.y+1.65,renderPos.z);lookDirection.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));cameraTarget.copy(camera.position).add(lookDirection);camera.lookAt(cameraTarget);
  const sniper=aim&&['awp','scout'].includes(weaponKey),fov=sniper?28:aim?58:76;const nextFov=T.MathUtils.lerp(camera.fov,fov,1-Math.exp(-16*dt));if(Math.abs(nextFov-camera.fov)>.01){camera.fov=nextFov;camera.updateProjectionMatrix();}
  ui.scope.style.display=sniper?'block':'none';ui.cross.style.display=sniper?'none':'block';
  if(fire&&!me.dead&&!me.reload&&me.ammo>0&&now-lastFireAt>=WEAPONS[me.weapon].rate){shotFeedback();lastFireAt=now;}
  recoil*=Math.exp(-19*dt);const moving=!!(keys.KeyW||keys.KeyS||keys.KeyA||keys.KeyD),bob=moving&&local.y<.01?Math.sin(now*.012)*.003:0;
  const reloadPhase=me.reload?clamp((me.reload-(Date.now()-clockOffset))/WEAPONS[me.weapon].reload,0,1):0,reloadTilt=reloadPhase?Math.sin(reloadPhase*Math.PI):0;
  weaponRoot.position.set(.22-(aim?.185:0),-.24+(aim?.05:0)+bob-reloadTilt*.18,-.70+recoil+(aim?.12:0));weaponRoot.rotation.set(recoil*1.3-reloadTilt*.35,0,reloadTilt*-.35);weaponRoot.visible=!me.dead;
  updateActors(now);syncEffects(now);flash=Math.max(0,flash-dt*.5);hurt=Math.max(0,hurt-dt*2);ui.flash.style.opacity=flash;ui.damage.style.opacity=hurt;
  const hit=now<hitUntil;ui.hitmark.style.display=hit?'block':'none';ui.hitmark.style.color=headshot?'#e2a27f':'#e2d4ae';hitInfo.textContent=hit?damageNumber:'';hitInfo.style.color=headshot?'#f1b697':'#f1dfb6';ui.cross.style.transform='translate(-50%,-50%) scale('+(1+recoil*7)+')';
  ui.board.style.display=keys.Tab?'block':'none';ui.network.classList.toggle('hidden',now-netAt<2000);
  if(now-statAt>120){statAt=now;drawRadar();ui.feed.textContent=feed.filter(f=>f.until>now).map(f=>f.text).join('\n');
    ui.notice.textContent=me.dead?'Возрождение через '+Math.max(1,Math.ceil((me.dead-(Date.now()-clockOffset))/1000))+'…':hit?damageNumber:me.reload?'ПЕРЕЗАРЯДКА':!locked()?'Нажми на игру для управления мышью · V — курсор':'';
    ui.notice.style.display=ui.notice.textContent?'block':'none';
  }
  if(moving&&!me.dead&&now-footstep>370&&local.y<.02){footstep=now;noise(.04,.007,600);}
  renderFrame();
}
resize();requestAnimationFrame(frame);
