import * as T from '/three.js';
import {Builder} from '/world.js';
import {WEAPONS} from '/shared.js';
const materials={steel:new T.MeshLambertMaterial({color:0x41494b}),edge:new T.MeshLambertMaterial({color:0x778185}),black:new T.MeshLambertMaterial({color:0x252d30}),wood:new T.MeshLambertMaterial({color:0x956344}),tan:new T.MeshLambertMaterial({color:0xb09a72}),glove:new T.MeshLambertMaterial({color:0x393d35}),sleeve:new T.MeshLambertMaterial({color:0x8e927d}),lens:new T.MeshBasicMaterial({color:0x668f9b})};
const cache=new Map();
function model(key){
  const b=new Builder(),m=materials,w=WEAPONS[key],rifle=['ak','m4','famas'].includes(key),pistol=['glock','deagle'].includes(key),sniper=['awp','scout'].includes(key),shotgun=['nova','xm'].includes(key),smg=['mp5','p90'].includes(key);
  if(key==='knife'){
    b.box(.07,.09,.24,m.black,0,-.02,.05);b.box(.16,.025,.035,m.edge,0,.02,-.09);
    const s=new T.Shape();s.moveTo(0,0);s.lineTo(.06,.08);s.lineTo(.045,.41);s.lineTo(0,.49);s.lineTo(-.025,.39);s.lineTo(-.025,0);s.closePath();const blade=new T.ExtrudeGeometry(s,{depth:.009,bevelEnabled:false});b.add(blade,m.edge,0,.02,-.1,1,1,1,-Math.PI/2,0,0);
  }else if(pistol){
    b.box(.085,.09,.29,key==='deagle'?m.edge:m.steel,0,.03,-.08);b.box(.08,.12,.18,m.black,0,-.025,-.04);b.box(.074,.16,.11,m.black,0,-.13,.02,-.15);b.cylinder(.019,.33,m.black,0,.035,-.12,Math.PI/2);b.box(.01,.03,.025,m.edge,0,.095,-.205);b.box(.08,.025,.015,m.edge,0,.095,.04);b.box(.075,.025,.11,m.edge,0,-.21,.025);b.box(.08,.012,.08,m.steel,0,-.09,-.09);
  }else{
    const long=sniper?1.05:shotgun?.85:key==='mp5'?.62:.8;
    b.box(.115,.13,.38,m.steel,0,0,-.12);b.box(.085,.11,.25,m.black,0,-.035,.12);b.box(.11,.17,.12,m.black,0,-.15,.03,-.22);b.box(.085,.025,.19,m.edge,0,.082,-.09);
    // Stocks, pistol grips and muzzle assemblies have distinct silhouettes.
    if(key!=='p90'&&key!=='famas'){b.box(.105,.16,.24,key==='ak'?m.wood:m.black,0,-.025,.3,.12);b.box(.12,.19,.04,m.black,0,-.03,.42);}else b.box(.13,.19,.34,m.tan,0,-.04,.21);
    b.cylinder(sniper?.018:.022,long,m.steel,0,.014,-long*.5-.13,Math.PI/2);b.cylinder(sniper?.028:.03,.055,m.black,0,.014,-long-.15,Math.PI/2);
    const foreZ=sniper?-.36:-.38;
    if(key==='ak'){
      b.box(.1,.105,.3,m.wood,0,-.015,-.41);for(let i=0;i<3;i++)b.box(.076,.105,.13,m.steel,0,-.12-i*.065,-.19+i*.018,-i*.18);b.box(.012,.1,.04,m.edge,.067,.025,-.09);b.box(.035,.11,.035,m.black,0,.075,-.67);b.cylinder(.007,.4,m.edge,.06,-.02,-.4,Math.PI/2);
    }else if(key==='p90'){
      b.box(.16,.15,.48,m.tan,0,-.01,-.19);b.box(.13,.04,.44,m.edge,0,.11,-.2);b.box(.14,.1,.11,m.black,0,.16,-.13);b.box(.065,.045,.05,m.lens,0,.17,-.2);
    }else if(key==='negev'){
      b.box(.14,.18,.5,m.steel,0,.01,-.27);b.box(.19,.22,.23,m.tan,-.06,-.2,-.19);b.box(.025,.035,.32,m.black,.08,.15,-.23);for(let i=0;i<4;i++)b.cylinder(.008,.11,m.edge,-.12-i*.015,-.08,-.2,0,0,Math.PI/2);
    }else{
      b.box(.1,.095,sniper?.39:.29,sniper?m.tan:m.black,0,-.035,foreZ);
      if(!shotgun)b.box(.075,.23,.12,m.black,0,-.16,-.18,-.08);
      if(shotgun){b.cylinder(.025,.58,m.edge,0,-.045,-.38,Math.PI/2);b.cylinder(.052,.22,key==='nova'?m.wood:m.black,0,-.03,-.39,Math.PI/2);}
      if(key==='m4'){b.cylinder(.027,.21,m.black,0,.014,-1.02,Math.PI/2);b.box(.1,.035,.18,m.black,0,.13,-.04);b.box(.023,.07,.023,m.edge,0,.085,-.62);}
      if(key==='famas')b.box(.15,.04,.32,m.black,0,.14,-.04);
      if(smg){b.cylinder(.048,.23,m.black,0,-.01,-.37,Math.PI/2);b.box(.073,.27,.1,m.black,0,-.17,-.17,-.13);}
    }
    if(sniper){
      b.box(.026,.09,.03,m.black,0,.12,-.12);b.box(.026,.09,.03,m.black,0,.12,-.35);b.cylinder(key==='awp'?.044:.035,.36,m.black,0,.19,-.25,Math.PI/2);b.cylinder(key==='awp'?.055:.043,.09,m.black,0,.19,-.45,Math.PI/2);b.cylinder(key==='awp'?.046:.035,.006,m.lens,0,.19,-.5,Math.PI/2);b.cylinder(.025,.04,m.edge,.04,.19,-.23,0,0,Math.PI/2);b.box(.03,.03,.12,m.edge,.08,.02,.03);
    }else if(!['p90','famas'].includes(key))for(let i=0;i<7;i++)b.box(.13,.008,.012,m.edge,0,.082,-.3+i*.05);
  }
  // Sleeves and tactical gloves, kept below the aiming line.
  b.cylinder(.057,.32,m.sleeve,.11,-.22,.27,Math.PI/2,0,-.25);b.box(.09,.11,.14,m.glove,.03,-.11,.055,-.2);b.box(.095,.04,.06,m.black,.03,-.07,.06);
  if(key!=='knife'&&!pistol){b.cylinder(.053,.32,m.sleeve,-.17,-.24,-.12,Math.PI/2,.65,0);b.box(.115,.1,.14,m.glove,-.035,-.1,-.38);b.box(.12,.025,.06,m.black,-.035,-.05,-.38);}
  return b.build();
}
export function weaponModel(key){if(!cache.has(key))cache.set(key,model(key));return cache.get(key).clone();}
export function weaponIcon(key){const pistol=['glock','deagle'].includes(key),knife=key==='knife',sniper=['awp','scout'].includes(key),shotgun=['nova','xm'].includes(key);const path=knife?'M20 39L67 25 139 22 154 26 143 32 67 34 59 43 47 43 45 37 25 46Z':pistol?'M36 24H112V34H83L76 57H59L64 36H36ZM39 20H114V24H39Z':sniper?'M14 34H160V39H88L76 58H65L69 40H46L34 48H15ZM64 17H111V24H64ZM74 24H79V32H74ZM103 24H108V32H103Z':shotgun?'M14 29H157V35H77L65 51H52L56 36H34L18 45H12ZM92 35H130V41H89Z':'M10 31H151V37H88L78 59H64L67 40H49L38 50H13ZM58 24H119V30H58ZM100 37H131V42H100Z';return `<svg viewBox="0 0 174 70" aria-hidden="true"><path d="${path}" fill="currentColor"/></svg>`;}
