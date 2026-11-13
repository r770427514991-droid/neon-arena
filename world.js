import * as T from '/three.js';
import {WALLS} from '/shared.js';
const cube=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,10,1),sphere=new T.IcosahedronGeometry(1,1);
export class Builder{
  constructor(){this.parts=[];this.temp=new T.Object3D();}
  add(geometry,material,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){const o=this.temp;o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.set(rx,ry,rz);o.updateMatrix();this.parts.push({geometry,material,matrix:o.matrix.clone()});return this;}
  box(w,h,d,material,x=0,y=0,z=0,rx=0,ry=0,rz=0){return this.add(cube,material,x,y,z,w,h,d,rx,ry,rz);}
  cylinder(r,h,material,x=0,y=0,z=0,rx=0,ry=0,rz=0){return this.add(cylinder,material,x,y,z,r,h,r,rx,ry,rz);}
  sphere(r,material,x=0,y=0,z=0,sx=1,sy=1,sz=1){return this.add(sphere,material,x,y,z,r*sx,r*sy,r*sz);}
  build(){const groups=new Map();for(const p of this.parts){let list=groups.get(p.material);if(!list){list=[];groups.set(p.material,list);}list.push(p);}const out=new T.Group();for(const[material,parts]of groups){const pos=[],norm=[],uv=[];for(const p of parts){const g=p.geometry.clone().applyMatrix4(p.matrix),flat=g.index?g.toNonIndexed():g;for(const v of flat.attributes.position.array)pos.push(v);for(const v of flat.attributes.normal.array)norm.push(v);const u=flat.attributes.uv;if(u)for(const v of u.array)uv.push(v);else for(let i=0;i<flat.attributes.position.count*2;i++)uv.push(0);if(flat!==g)flat.dispose();g.dispose();}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(norm,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeBoundingSphere();out.add(new T.Mesh(geo,material));}return out;}
}
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
function canvasTexture(w,h,paint){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=2;return tex;}
function plasterTexture(){return canvasTexture(128,128,(ctx,w,h)=>{const rand=seeded(42);ctx.fillStyle='#e5dfd4';ctx.fillRect(0,0,w,h);for(let i=0;i<1600;i++){ctx.fillStyle=rand()<.5?'rgba(78,66,48,.035)':'rgba(255,255,255,.09)';ctx.fillRect(rand()*w,rand()*h,rand()*3+1,rand()*2+1);}});}
function groundTexture(){return canvasTexture(1024,1024,(ctx,w,h)=>{const rand=seeded(8),px=x=>(x+34)/68*w,py=z=>(z+30)/60*h;ctx.fillStyle='#c5b49b';ctx.fillRect(0,0,w,h);for(let i=0;i<9000;i++){const v=rand();ctx.fillStyle=v>.5?'rgba(255,251,237,.045)':'rgba(69,61,48,.035)';ctx.fillRect(rand()*w,rand()*h,rand()*6+1,rand()*3+1);}ctx.fillStyle='#b7ab97';ctx.fillRect(px(-5),0,px(5)-px(-5),h);ctx.strokeStyle='rgba(64,57,44,.09)';ctx.lineWidth=1;for(let y=0;y<h;y+=23){ctx.beginPath();ctx.moveTo(px(-5),y);ctx.lineTo(px(5),y);ctx.stroke();for(let x=px(-5)+(y%46?12:0);x<px(5);x+=27){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+23);ctx.stroke();}}for(const[x,z,bw,bd,bh]of WALLS){const a=x-bw/2,b=z-bd/2,c=x+bw/2,d=z+bd/2,shift=bh*.75;ctx.fillStyle='rgba(56,66,69,.14)';ctx.beginPath();ctx.moveTo(px(a),py(b));ctx.lineTo(px(c),py(b));ctx.lineTo(px(c+shift),py(b-shift*.5));ctx.lineTo(px(a+shift),py(b-shift*.5));ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(px(c),py(b));ctx.lineTo(px(c),py(d));ctx.lineTo(px(c+shift),py(d-shift*.5));ctx.lineTo(px(c+shift),py(b-shift*.5));ctx.closePath();ctx.fill();ctx.fillStyle='rgba(41,44,40,.13)';ctx.fillRect(px(a-.1),py(b-.1),bw/68*w+3,bd/60*h+3);}});}
export function buildWorld(scene){
  scene.background=new T.Color('#bbcbd1');scene.fog=new T.Fog('#bbcbd1',55,115);
  scene.add(new T.HemisphereLight(0xe1edf4,0x9c8062,2.1));const sun=new T.DirectionalLight(0xffedcf,2.1);sun.position.set(-18,35,22);scene.add(sun);
  const plaster=plasterTexture();const wallColors=[0xd5c4ac,0xc9b59b,0xdacbb6,0xc3b59e];const walls=wallColors.map(color=>new T.MeshLambertMaterial({color,map:plaster}));
  const stone=new T.MeshLambertMaterial({color:0xe6d8c2}),darkStone=new T.MeshLambertMaterial({color:0x9c8c76}),wood=new T.MeshLambertMaterial({color:0x8c7657}),woodLight=new T.MeshLambertMaterial({color:0xa28d6c}),metal=new T.MeshLambertMaterial({color:0x4f5753}),teal=new T.MeshLambertMaterial({color:0x577b77}),terra=new T.MeshLambertMaterial({color:0xaa7356}),leaf=new T.MeshLambertMaterial({color:0x637a56}),shadow=new T.MeshBasicMaterial({color:0x50554d,transparent:true,opacity:.14,depthWrite:false});
  const ground=new T.Mesh(new T.PlaneGeometry(68,60),new T.MeshLambertMaterial({map:groundTexture(),color:0xffffff}));ground.rotation.x=-Math.PI/2;ground.position.y=-.015;scene.add(ground);
  const b=new Builder();
  WALLS.forEach(([x,z,w,d,h],i)=>{
    if(h<3){b.box(w,h,d,wood,x,h/2,z);for(const py of [.2,h-.2]){b.box(w+.025,.12,d+.025,metal,x,py,z);}for(let off=-w/2+.4;off<w/2;off+=.6){b.box(.025,h-.4,.035,darkStone,x+off,h/2,z+d/2+.02);b.box(.025,h-.4,.035,darkStone,x+off,h/2,z-d/2-.02);}b.box(w*.85,.14,.07,woodLight,x,h*.55,z+d/2+.05,0,0,.45);return;}
    b.box(w,h,d,walls[i%walls.length],x,h/2,z);b.box(w+.1,.18,d+.1,stone,x,h+.09,z);b.box(w+.04,.5,d+.04,darkStone,x,.25,z);b.box(w+.05,.09,d+.05,stone,x,h-.35,z);
    if(w>d&&w>5){for(let off=-w/2+1.8;off<w/2;off+=3.2)for(const side of[-1,1]){b.box(.88,1.32,.09,stone,x+off,h*.62,z+side*(d/2+.05));b.box(.7,1.14,.1,teal,x+off,h*.62,z+side*(d/2+.11));b.box(.045,1.16,.035,darkStone,x+off,h*.62,z+side*(d/2+.18));b.box(1.05,.09,.24,stone,x+off,h*.62-.7,z+side*(d/2+.12));}}
    if(d>w&&d>5){for(let off=-d/2+1.8;off<d/2;off+=3.2)for(const side of[-1,1]){b.box(.09,1.32,.88,stone,x+side*(w/2+.05),h*.62,z+off);b.box(.1,1.14,.7,teal,x+side*(w/2+.11),h*.62,z+off);b.box(.035,1.16,.045,darkStone,x+side*(w/2+.18),h*.62,z+off);b.box(.24,.09,1.05,stone,x+side*(w/2+.12),h*.62-.7,z+off);}}
  });
  // Rooftops and parapets make a city silhouette, outside the play area.
  for(let i=0;i<9;i++)for(const side of[-1,1]){const x=-32+i*8,z=side*33,h=6.5+(i*7%4);b.box(7.8,h,5,walls[i%4],x,h/2,z);b.box(8,.25,5.2,stone,x,h+.12,z);b.box(1.5,.7,1.5,darkStone,x+2,h+.5,z);for(const off of[-2,0,2]){b.box(.85,1.5,.05,teal,x+off,h*.63,z-side*2.53);b.box(1,.12,.16,stone,x+off,h*.63-.8,z-side*2.55);}}
  // Market canopies and lanterns: decorative geometry above player height.
  for(const[x,z,rot]of[[-28,2,0],[28,-2,Math.PI],[-21,17,0],[21,-17,Math.PI]]){b.box(4,.08,2,teal,x,4,z,.12,rot);for(const off of[-1.7,1.7])b.box(.08,4,.08,wood,x+off,2,z+.8);b.box(4,.2,.1,stone,x,3.8,z+1);}
  // Palms, planters and detailed barrels sit beyond the arena boundary.
  for(const[x,z]of[[-36,-20],[-36,7],[36,-7],[36,20]]){b.cylinder(.28,7,wood,x,3.5,z,0,0,.06);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;b.box(.7,.08,4,leaf,x+Math.sin(a)*1.5,7,z+Math.cos(a)*1.5,.3,a);}}
  for(const[x,z]of[[-30,-26],[30,26],[-30,25],[30,-25]]){b.cylinder(.45,.85,terra,x,.43,z);b.sphere(.45,leaf,x,1,z,1,1.5,1);}
  for(const[x,z]of[[-30,-18],[30,18]]){b.cylinder(.45,1.15,teal,x,.57,z);for(const y of[.15,.55,1])b.cylinder(.46,.045,metal,x,y,z);}
  // Painted site boundaries and soft crate contact shadows.
  for(const[x,z,color]of[[-24,-9,0xb86e4d],[24,9,0x5a8589]]){const m=new T.MeshBasicMaterial({color});const lines=new Builder();for(const off of[-2.9,2.9]){lines.box(6,.012,.08,m,x,.01,z+off);lines.box(.08,.012,6,m,x+off,.01,z);}scene.add(lines.build());}
  scene.add(b.build());
  function label(text,x,y,z,ry=0,color='#bc6945',w=1.8,h=1.8){const tex=canvasTexture(256,256,ctx=>{ctx.clearRect(0,0,256,256);ctx.fillStyle=color;ctx.font='bold 180px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,137);});const o=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));o.position.set(x,y,z);o.rotation.y=ry;scene.add(o);return o;}
  label('A',-17,2.4,-8.94,0);label('B',17,2.4,8.94,Math.PI,'#527f83');label('A ←',-6.46,2.2,2,-Math.PI/2,'#ac6344',2.1,1.3);label('→ B',6.46,2.2,-2,Math.PI/2,'#527f83',2.1,1.3);
  // Contact blobs are instanced, avoiding real-time shadow maps.
  const blobs=new T.InstancedMesh(new T.CircleGeometry(.5,12),shadow,32);blobs.instanceMatrix.setUsage(T.DynamicDrawUsage);blobs.frustumCulled=false;scene.add(blobs);
  return {blobs};
}
