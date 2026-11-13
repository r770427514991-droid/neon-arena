import http from 'node:http';
import fs from 'node:fs';
import {WebSocketServer} from 'ws';
import {WEAPONS,WALLS,simulate,rayBox,wallDistance,VERSION} from './shared.js';
const files={'/':'index.html','/style.css':'style.css','/client.js':'client.js','/world.js':'world.js','/weapons.js':'weapons.js','/shared.js':'shared.js','/three.js':'node_modules/three/build/three.module.js'};
const cached=new Map(Object.entries(files).map(([url,path])=>[url,fs.readFileSync(new URL(path,import.meta.url))]));
const server=http.createServer((req,res)=>{
  const url=req.url?.split('?')[0];
  if(url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({version:VERSION,players:players.size}));}
  const b=cached.get(url);res.writeHead(b?200:404,{'Content-Type':url==='/'?'text/html; charset=utf-8':url?.endsWith('.css')?'text/css':'text/javascript','Cache-Control':url==='/three.js'?'public, max-age=86400':'no-cache'});res.end(b||'Not found');
});
const wss=new WebSocketServer({server,maxPayload:2048});
const players=new Map(),grenades=[],clouds=[];const scores=[0,0];let next=0,eventId=0,events=[],lastTick=Date.now(),tick=0;
function send(ws,obj){if(ws.readyState===1&&ws.bufferedAmount<131072)ws.send(typeof obj==='string'?obj:JSON.stringify(obj));}
function emit(e){events.push({...e,id:++eventId});}
function spawn(p){
  const index=[...players.values()].filter(q=>q.team===p.team).indexOf(p),now=Date.now();
  Object.assign(p,{x:(index%5-2)*1.7,z:(p.team===0?-1:1)*(25-Math.floor(index/5)*1.5),y:0,vy:0,wasJump:false,yaw:p.team===0?Math.PI:0,pitch:0,hp:100,dead:0,invuln:now+2000,reload:0,input:{},lastInput:now,lastFire:0,throwAt:0,queue:[],budget:.1,ack:p.seq||0});
  p.life=(p.life||0)+1;p.inventory={};for(const[k,w]of Object.entries(WEAPONS))p.inventory[k]={ammo:w.mag,reload:0};p.ammo=WEAPONS[p.weapon].mag;p.grenades={frag:2,smoke:1,flash:1};
}
function damage(q,amount,p,weapon,now,head=false){
  if(q.dead||q.team===p.team||now<q.invuln)return;
  const dealt=Math.min(q.hp,amount);q.hp=Math.max(0,q.hp-amount);emit({type:'hit',target:q.id,by:p.id,damage:dealt,head,x:q.x,y:q.y+1.5,z:q.z});
  if(!q.hp){q.dead=now+3500;q.deaths++;p.kills++;scores[p.team]++;emit({type:'kill',by:p.name,target:q.name,team:p.team,weapon});}
}
function reload(p,now){if(!p.dead&&!p.reload&&p.ammo<WEAPONS[p.weapon].mag)p.reload=now+WEAPONS[p.weapon].reload;}
function shoot(p,now){
  const w=WEAPONS[p.weapon];if(p.reload||now-p.lastFire<w.rate)return;
  if(p.weapon!=='knife'&&p.ammo<=0){reload(p,now);return;}
  p.lastFire=now;if(w.mag)p.ammo--;const o=[p.x,p.y+1.65,p.z];
  for(let n=0;n<(w.pellets||1);n++){
    const spread=w.spread*(p.input.aim?.4:1),yaw=p.yaw+(Math.random()-.5)*spread,pitch=p.pitch+(Math.random()-.5)*spread;
    const v=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
    let best=wallDistance(o,v,w.range),victim;
    for(const q of players.values()){
      if(q===p||q.dead||q.team===p.team||now<q.invuln)continue;
      const t=rayBox(o,v,[q.x-.38,q.y,q.z-.38],[q.x+.38,q.y+2.02,q.z+.38],best);
      if(t<best){best=t;victim=q;}
    }
    if(victim){const head=o[1]+v[1]*best>victim.y+1.65;damage(victim,Math.round(w.damage*(head?1.7:1)),p,w.name,now,head);}
    if(!n)emit({type:'shot',by:p.id,weapon:p.weapon,a:o,b:o.map((x,i)=>x+v[i]*best)});
  }
}
function throwGrenade(p,type,now){
  if(!['frag','smoke','flash'].includes(type)||p.dead||!p.grenades[type]||now-p.throwAt<700)return;
  p.grenades[type]--;p.throwAt=now;
  grenades.push({id:++eventId,owner:p.id,team:p.team,name:p.name,type,x:p.x,y:p.y+1.5,z:p.z,vx:Math.sin(p.yaw)*15,vz:-Math.cos(p.yaw)*15,vy:4.5+Math.sin(p.pitch)*8,until:now+2200});
}
function balanceAfterLeave(){
  const counts=[0,0];for(const p of players.values())counts[p.team]++;
  if(Math.abs(counts[0]-counts[1])<2)return;
  const from=counts[0]>counts[1]?0:1,p=[...players.values()].filter(p=>p.team===from).at(-1);
  if(p){p.team=1-from;spawn(p);emit({type:'balance',target:p.id,team:p.team});}
}
function acceptInput(p,m,now){
  const seq=Number.isSafeInteger(m.seq)?m.seq:(p.seq||0)+1;
  if(seq<=(p.seq||0)||p.queue.length>=6)return;
  const number=v=>Number.isFinite(v)?v:0;
  const dt=Math.max(.005,Math.min(.06,number(m.dt)||((now-p.lastInput)/1000)));
  const input={seq,dt,x:Math.max(-1,Math.min(1,number(m.x))),z:Math.max(-1,Math.min(1,number(m.z))),yaw:number(m.yaw),pitch:Math.max(-1.3,Math.min(1.3,number(m.pitch))),fire:!!m.fire,jump:!!m.jump,aim:!!m.aim};
  p.seq=seq;p.lastInput=now;p.queue.push(input);p.input=input;
}
wss.on('connection',ws=>{
  if(wss.clients.size>32){send(ws,{error:'Сервер заполнен: 32 игрока.'});return ws.close();}
  let p,budget=0;const budgetTimer=setInterval(()=>budget=0,1000),joinTimer=setTimeout(()=>{if(!p)ws.close();},10000);
  ws.on('error',()=>{});ws.on('message',raw=>{
    if(++budget>90)return;let m;try{m=JSON.parse(raw);}catch{return;}if(!m||typeof m!=='object'||Array.isArray(m))return;const now=Date.now();
    if(m.type==='ping'){send(ws,{type:'pong',sent:m.sent});return;}
    if(m.type==='join'&&!p){
      const count=[0,0];for(const q of players.values())count[q.team]++;
      p={id:++next,name:String(m.name||'Игрок').replace(/[\x00-\x1f]/g,'').slice(0,16),team:count[0]<=count[1]?0:1,weapon:Object.hasOwn(WEAPONS,m.weapon)?m.weapon:'ak',kills:0,deaths:0,seq:0};players.set(ws,p);spawn(p);clearTimeout(joinTimer);send(ws,{id:p.id,version:VERSION});return;
    }
    if(!p)return;
    if(m.type==='input')acceptInput(p,m,now);
    if(m.type==='reload')reload(p,now);
    if(m.type==='grenade')throwGrenade(p,m.grenade,now);
    if(m.type==='weapon'&&!p.dead&&Object.hasOwn(WEAPONS,m.weapon)&&m.weapon!==p.weapon&&now-(p.switchAt||0)>700){
      p.inventory[p.weapon]={ammo:p.ammo,reload:p.reload};p.weapon=m.weapon;const saved=p.inventory[p.weapon];
      p.ammo=saved.reload&&now>=saved.reload?WEAPONS[p.weapon].mag:saved.ammo;p.reload=saved.reload>now?saved.reload:0;p.switchAt=now;p.lastFire=now+300;
    }
  });
  ws.on('close',()=>{clearInterval(budgetTimer);clearTimeout(joinTimer);players.delete(ws);balanceAfterLeave();});
});
function stepGrenade(g,dt){
  const steps=3,r=.16;
  for(let step=0;step<steps;step++){
    const delta=dt/steps;g.vy-=12*delta;
    for(const axis of ['x','z']){
      const vel=axis==='x'?'vx':'vz',previous=g[axis];g[axis]+=g[vel]*delta;
      for(const[x,z,w,d,h]of WALLS){
        if(g.y-r>h)continue;
        if(Math.abs(g.x-x)<w/2+r&&Math.abs(g.z-z)<d/2+r){g[axis]=previous;g[vel]*=-.6;break;}
      }
    }
    const prevY=g.y;g.y+=g.vy*delta;
    for(const[x,z,w,d,h]of WALLS)if(Math.abs(g.x-x)<w/2&&Math.abs(g.z-z)<d/2&&prevY>=h+r&&g.y<h+r){g.y=h+r;g.vy=Math.abs(g.vy)*.35;}
    if(g.y<r){g.y=r;g.vy=Math.abs(g.vy)*.35;g.vx*=.9;g.vz*=.9;}
  }
}
const timer=setInterval(()=>{
  const now=Date.now(),dt=Math.min(.1,(now-lastTick)/1000);lastTick=now;
  for(const p of players.values()){
    if(p.dead){if(now>p.dead)spawn(p);continue;}
    p.budget=Math.min(.15,p.budget+dt);
    while(p.queue.length&&p.queue[0].dt<=p.budget+.001){const cmd=p.queue.shift();simulate(p,cmd,WEAPONS[p.weapon]);p.budget-=cmd.dt;p.ack=cmd.seq;}
    const i=now-p.lastInput>300?{}:p.input;p.yaw=i.yaw??p.yaw;p.pitch=i.pitch??p.pitch;
    if(p.reload&&now>=p.reload){p.reload=0;p.ammo=WEAPONS[p.weapon].mag;}
    if(i.fire)shoot(p,now);
  }
  for(let n=grenades.length-1;n>=0;n--){
    const g=grenades[n];stepGrenade(g,dt);if(now<g.until)continue;grenades.splice(n,1);emit({type:'blast',kind:g.type,x:g.x,y:g.y,z:g.z});
    if(g.type==='smoke'){clouds.push({id:g.id,x:g.x,z:g.z,until:now+9000});continue;}
    const owner=[...players.values()].find(p=>p.id===g.owner)||{id:g.owner,team:g.team,name:g.name,kills:0};
    for(const q of players.values()){
      if(q.dead)continue;const dx=q.x-g.x,dy=q.y+1.2-g.y,dz=q.z-g.z,dist=Math.hypot(dx,dy,dz);if(dist>12)continue;
      if(dist>.001&&wallDistance([g.x,g.y,g.z],[dx/dist,dy/dist,dz/dist],dist)<dist-.1)continue;
      if(g.type==='frag')damage(q,Math.round(95*(1-dist/12)),owner,'Граната',now);else emit({type:'flash',target:q.id,strength:1-dist/12});
    }
  }
  for(let n=clouds.length-1;n>=0;n--)if(clouds[n].until<now)clouds.splice(n,1);
  if(++tick%2===0){
    const state=JSON.stringify({type:'state',time:now,scores,players:[...players.values()].map(p=>({id:p.id,name:p.name,team:p.team,x:+p.x.toFixed(4),y:+p.y.toFixed(4),z:+p.z.toFixed(4),vy:p.vy,wasJump:p.wasJump,ack:p.ack,life:p.life,yaw:p.yaw,pitch:p.pitch,hp:p.hp,weapon:p.weapon,ammo:p.ammo,reload:p.reload,dead:p.dead,kills:p.kills,deaths:p.deaths,grenades:p.grenades,invuln:p.invuln})),grenades:grenades.map(({id,type,x,y,z})=>({id,type,x,y,z})),clouds,events});
    for(const ws of players.keys())send(ws,state);events=[];
  }
},1000/30);
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log(`DUSTLINE ${VERSION} listening on ${server.address().port}`));
function stop(){clearInterval(timer);for(const ws of wss.clients)ws.terminate();server.close(()=>process.exit(0));}process.on('SIGTERM',stop);process.on('SIGINT',stop);


