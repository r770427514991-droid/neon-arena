export const VERSION='3.0.0';
export const WEAPONS={
ak:{name:'AK-47',group:'Автоматы',damage:34,rate:110,mag:30,reload:2300,range:85,spread:.014,speed:6},
m4:{name:'M4A1',group:'Автоматы',damage:29,rate:95,mag:30,reload:2100,range:85,spread:.009,speed:6.2},
famas:{name:'FAMAS',group:'Автоматы',damage:25,rate:85,mag:25,reload:2100,range:75,spread:.014,speed:6.4},
glock:{name:'Glock',group:'Пистолеты',damage:22,rate:200,mag:20,reload:1400,range:60,spread:.018,speed:7},
deagle:{name:'Desert Eagle',group:'Пистолеты',damage:58,rate:450,mag:7,reload:1700,range:80,spread:.008,speed:6.8},
mp5:{name:'MP5',group:'Пистолеты-пулемёты',damage:20,rate:75,mag:30,reload:1700,range:55,spread:.025,speed:7},
p90:{name:'P90',group:'Пистолеты-пулемёты',damage:18,rate:65,mag:50,reload:2600,range:50,spread:.03,speed:6.8},
nova:{name:'Nova',group:'Дробовики',damage:13,pellets:8,rate:850,mag:8,reload:2500,range:35,spread:.12,speed:6.3},
xm:{name:'XM1014',group:'Дробовики',damage:10,pellets:7,rate:350,mag:7,reload:2600,range:30,spread:.13,speed:6.2},
awp:{name:'AWP',group:'Снайперские',damage:105,rate:1350,mag:5,reload:3000,range:120,spread:.002,speed:5},
scout:{name:'Scout',group:'Снайперские',damage:72,rate:950,mag:10,reload:2300,range:110,spread:.003,speed:6.2},
negev:{name:'Negev',group:'Пулемёты',damage:24,rate:80,mag:100,reload:4500,range:80,spread:.035,speed:4.8},
knife:{name:'Нож',group:'Ближний бой',damage:45,rate:400,mag:0,reload:0,range:2.8,spread:0,speed:8}};
// Original desert map, with A/B sites, mid and side lanes.
export const WALLS=[[-33,0,2,58,6],[33,0,2,58,6],[0,-29,68,2,6],[0,29,68,2,6],[-22,-23,12,10,5.5],[22,23,12,10,5.5],[-8,-17,3,14,5],[8,17,3,14,5],[-8,6,3,16,5],[8,-6,3,16,5],[-21,4,14,3,5],[21,-4,14,3,5],[-28,-9,6,3,5],[28,9,6,3,5],[-20,18,11,3,5],[20,-18,11,3,5],[-17,-13,3,8,4.5],[17,13,3,8,4.5],[-23,-14,3,3,2.3],[-21,-12,3,3,2.3],[-25,-16,3,3,2.3],[22,15,3,3,2.3],[25,16,3,3,2.3],[21,12,3,3,2.3],[1,-8,3,3,2.3],[-1,8,3,3,2.3],[-16,23,3,3,2.3],[16,-23,3,3,2.3]];
export function move(p,dx,dz,dt,speed){
  if(![dx,dz,dt,speed].every(Number.isFinite))return;
  const length=Math.hypot(dx,dz);if(length>1){dx/=length;dz/=length;}
  const steps=Math.max(1,Math.ceil(speed*Math.min(dt,.1)/.2)),r=.38;
  for(let s=0;s<steps;s++){
    let x=Math.max(-31.5,Math.min(31.5,p.x+dx*speed*dt/steps));
    for(const[wx,wz,w,d,h]of WALLS){if((p.y||0)>=h)continue;if(Math.abs(p.z-wz)<d/2+r&&Math.abs(x-wx)<w/2+r){if(dx>0&&p.x<=wx)x=wx-w/2-r;else if(dx<0&&p.x>=wx)x=wx+w/2+r;else x=p.x;}}
    p.x=x;
    let z=Math.max(-27.5,Math.min(27.5,p.z+dz*speed*dt/steps));
    for(const[wx,wz,w,d,h]of WALLS){if((p.y||0)>=h)continue;if(Math.abs(p.x-wx)<w/2+r&&Math.abs(z-wz)<d/2+r){if(dz>0&&p.z<=wz)z=wz-d/2-r;else if(dz<0&&p.z>=wz)z=wz+d/2+r;else z=p.z;}}
    p.z=z;
  }
}
export function simulate(p,input,weapon){
  const dt=Math.max(0,Math.min(.06,input.dt||0));
  if(input.jump&&!p.wasJump&&p.y<=.001)p.vy=7;
  p.wasJump=!!input.jump;
  move(p,input.x||0,input.z||0,dt,weapon.speed*(input.aim?.65:1));
  p.vy=(p.vy||0)-20*dt;p.y=Math.max(0,p.y+p.vy*dt);if(!p.y)p.vy=0;
}
export function rayBox(o,v,min,max,limit=150){let lo=0,hi=limit;for(let a=0;a<3;a++){if(Math.abs(v[a])<1e-8){if(o[a]<min[a]||o[a]>max[a])return Infinity;continue;}let a0=(min[a]-o[a])/v[a],a1=(max[a]-o[a])/v[a];if(a0>a1)[a0,a1]=[a1,a0];lo=Math.max(lo,a0);hi=Math.min(hi,a1);if(lo>hi)return Infinity;}return lo;}
export function wallDistance(o,v,limit=150){let best=limit;for(const[x,z,w,d,h]of WALLS)best=Math.min(best,rayBox(o,v,[x-w/2,0,z-d/2],[x+w/2,h,z+d/2],best));return best;}
