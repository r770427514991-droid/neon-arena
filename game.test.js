import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {WEAPONS,move,simulate,rayBox,wallDistance} from './shared.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('collision and weapon categories',()=>{
  assert.equal(new Set(Object.values(WEAPONS).map(w=>w.group)).size,7);
  assert.equal(rayBox([0,1,0],[0,0,1],[-1,0,5],[1,2,6]),5);
  assert.equal(rayBox([0,1,0],[0,0,1],[3,0,5],[4,2,6]),Infinity);
  assert.ok(wallDistance([0,1,-25],[0,0,-1])<5);
  const p={x:0,z:0,y:0};for(let i=0;i<300;i++)move(p,1,0,.033,6);
  assert.ok(p.x<31.7,'cannot walk through boundary');
  const jumper={x:0,y:0,z:0,vy:0};simulate(jumper,{dt:.02,jump:true},WEAPONS.ak);assert.ok(jumper.y>0);
  for(let i=0;i<100;i++)simulate(jumper,{dt:.02,jump:true},WEAPONS.ak);
  assert.equal(jumper.y,0,'holding jump must not auto jump on landing');
  simulate(jumper,{dt:.02,jump:false},WEAPONS.ak);simulate(jumper,{dt:.02,jump:true},WEAPONS.ak);assert.ok(jumper.y>0);
});
test('server: combat, reload, grenades, balanced 32-player arena and departure',{timeout:30000},async()=>{
  const child=spawn(process.execPath,['server.js'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:'3002'},stdio:'pipe'});
  let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
  const clients=[];let shooting;
  async function wait(fn,ms=5000){const until=Date.now()+ms;while(Date.now()<until){if(fn())return;await delay(30);}throw Error('Timeout: '+logs);}
  async function client(name,weapon='awp'){
    const ws=new WebSocket('ws://localhost:3002');const c={ws,name,state:null,id:null,events:[]};clients.push(c);
    ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id)c.id=m.id;if(m.type==='state'){c.state=m;c.events.push(...m.events);}};
    await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});ws.send(JSON.stringify({type:'join',name,weapon}));await wait(()=>c.id&&c.state);return c;
  }
  try{
    await wait(()=>logs.includes('listening'));
    const health=await(await fetch('http://localhost:3002/health')).json();assert.equal(health.version,'3.0.0');
    const a=await client('alpha'),b=await client('bravo');
    await wait(()=>a.state.players.length===2);
    assert.notEqual(a.state.players[0].team,a.state.players[1].team);
    assert.equal('drops'in a.state,false);
    await delay(2100);
    shooting=setInterval(()=>a.ws.send(JSON.stringify({type:'input',yaw:Math.PI,pitch:.005,fire:true,x:0,z:0})),50);
    await wait(()=>a.events.some(e=>e.type==='kill'),3500);clearInterval(shooting);
    a.ws.send(JSON.stringify({type:'input',yaw:Math.PI,pitch:0,fire:false}));
    assert.ok(a.state.scores[0]>=1);
    const hit=a.events.find(e=>e.type==='hit');assert.equal(hit.target,b.id);assert.equal(hit.damage,100);assert.equal(hit.head,true,'headshot metadata is authoritative');assert.ok([hit.x,hit.y,hit.z].every(Number.isFinite));
    a.ws.send(JSON.stringify({type:'reload'}));await wait(()=>a.state.players.find(p=>p.id===a.id).reload>0);
    await wait(()=>!a.state.players.find(p=>p.id===a.id).reload,4000);
    assert.equal(a.state.players.find(p=>p.id===a.id).ammo,5);
    const self=()=>a.state.players.find(p=>p.id===a.id);
    a.ws.send(JSON.stringify({type:'input',fire:true,yaw:Math.PI}));await wait(()=>self().ammo===4);
    a.ws.send(JSON.stringify({type:'input',fire:false}));a.ws.send(JSON.stringify({type:'weapon',weapon:'glock'}));await wait(()=>self().weapon==='glock');
    await delay(750);a.ws.send(JSON.stringify({type:'weapon',weapon:'awp'}));await wait(()=>self().weapon==='awp');assert.equal(self().ammo,4,'switching weapons preserves the magazine');
    const oldX=self().x;a.ws.send(JSON.stringify({type:'input',seq:1000,dt:.02,x:1,z:0}));await wait(()=>self().ack===1000);assert.ok(self().x>oldX&&self().x<oldX+.2);
    a.ws.send(JSON.stringify({type:'input',seq:1000,dt:.06,x:1,z:0}));await delay(100);assert.equal(self().ack,1000);assert.ok(self().x<oldX+.2,'duplicate sequence does not move twice');
    for(const raw of ['null','[]','false','{'])a.ws.send(raw);
    a.ws.send(JSON.stringify({type:'weapon',weapon:'toString'}));
    a.ws.send(JSON.stringify({type:'input',seq:1001,dt:900,x:'bad',z:null,pitch:'bad',yaw:'bad'}));await wait(()=>self().ack===1001);
    assert.ok([self().x,self().y,self().z,self().yaw,self().pitch].every(Number.isFinite));assert.equal(self().weapon,'awp');
    a.ws.send(JSON.stringify({type:'grenade',grenade:'smoke'}));
    await wait(()=>a.state.grenades.length>0);
    await wait(()=>a.state.clouds.length===1,3500);
    assert.equal(a.state.players.find(p=>p.id===a.id).grenades.smoke,0);
    for(let i=2;i<32;i++)await client('load'+i,'m4');
    await wait(()=>a.state.players.length===32);
    const count=[0,0];for(const p of a.state.players)count[p.team]++;
    assert.deepEqual(count,[16,16]);
    const rejected=new WebSocket('ws://localhost:3002');let closed=false;rejected.onclose=()=>closed=true;await wait(()=>closed);
    const blue=a.state.players.filter(p=>p.team===0).slice(0,4).map(p=>p.id);
    for(const c of clients)if(blue.includes(c.id))c.ws.close();
    const remaining=clients.find(c=>!blue.includes(c.id));await wait(()=>remaining.state.players.length===28);
    const final=[0,0];for(const p of remaining.state.players)final[p.team]++;
    assert.deepEqual(final,[14,14]);
  }finally{clearInterval(shooting);for(const c of clients)c.ws.close();child.kill();}
});


