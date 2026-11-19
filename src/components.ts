import type {Guidance} from './guidance';
// One camera rig, renderer and action route for mouse, touch and XR.
export function registerComponents(dispatch:(action:string)=>void) {
 const A=(window as any).AFRAME;
 A.registerComponent('campus-action',{schema:{type:'string'},init(this:any){
  this.el.addEventListener('click',(e:any)=>{e.stopPropagation();dispatch(this.data)});
  this.el.addEventListener('mouseenter',()=>this.el.setAttribute('scale','1.025 1.025 1.025'));
  this.el.addEventListener('mouseleave',()=>this.el.setAttribute('scale','1 1 1'));
 }});
 const keys=new Set<string>();
 addEventListener('keydown',e=>{if(!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement))keys.add(e.code)});
 addEventListener('keyup',e=>keys.delete(e.code)); addEventListener('blur',()=>keys.clear());
 const touch={forward:0,right:0};
 (window as any).campusMove=touch;
 A.registerComponent('campus-walk',{tick(this:any,_t:number,dt:number){
  if(!dt || this.el.sceneEl.is('vr-mode'))return;
  const camera=document.querySelector('#camera') as any;if(!camera)return;
  const yaw=camera.object3D.rotation.y+this.el.object3D.rotation.y;
  const f=(Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')))+touch.forward;
  const r=(Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')))+touch.right;
  const speed=Math.min(dt,50)*.003, p=this.el.object3D.position;
  const nx=p.x+(-Math.sin(yaw)*f+Math.cos(yaw)*r)*speed,nz=p.z+(-Math.cos(yaw)*f-Math.sin(yaw)*r)*speed;
  // Union of walkable grid corridors, matching route cells. No flying or leaving campus.
  const gx=nx/2.4+4,gy=nz/2.4+3;
  const legal=gx>=.45&&gx<=7.55&&gy>=1.45&&gy<=5.55&&(Math.abs(gy-2)<.53||Math.abs(gy-4)<.53||Math.abs(gy-5)<.53||Math.abs(gx-1)<.53||Math.abs(gx-7)<.53||Math.abs(gx-4)<.53);
  const wall=nx>-.83&&nx<2.83&&nz>3.32&&nz<3.96;
  if(legal&&!wall){p.x=nx;p.z=nz;}
 }});
 A.registerComponent('xr-campus',{init(this:any){this.lastSnap=0},tick(this:any,t:number){
  const scene=this.el.sceneEl;if(!scene.is('vr-mode'))return;
  const session=scene.renderer?.xr.getSession();if(!session)return;
  for(const source of session.inputSources){const axes=source.gamepad?.axes;if(!axes?.length)continue;
   const x=axes.length>=4?axes[2]:axes[0];
   if(Math.abs(x)>.7&&t-this.lastSnap>450){const rig=document.querySelector('#rig') as any; const camera=document.querySelector('#camera') as any; const T=(window as any).AFRAME.THREE; const before=new T.Vector3(); camera.object3D.getWorldPosition(before); rig.object3D.rotation.y-=Math.sign(x)*Math.PI/6; rig.object3D.updateMatrixWorld(true); const after=new T.Vector3(); camera.object3D.getWorldPosition(after); rig.object3D.position.x+=before.x-after.x; rig.object3D.position.z+=before.z-after.z; this.lastSnap=t;}
  }
 }});
}
export type PanelButton={label:string;action:string;tone?:'primary'|'muted'};
const textures:any[]=[];
export function canvasPlane(parent:HTMLElement,w:number,h:number,canvas:HTMLCanvasElement,action?:string){
 const el=document.createElement('a-plane');el.setAttribute('width',String(w));el.setAttribute('height',String(h));
 el.setAttribute('material','shader: flat; side: double; transparent: true');
 const apply=()=>{const mesh=(el as any).getObject3D('mesh');if(!mesh)return;const texture=new (window as any).AFRAME.THREE.CanvasTexture(canvas);texture.colorSpace=(window as any).AFRAME.THREE.SRGBColorSpace;mesh.material.map=texture;mesh.material.depthTest=false;mesh.material.depthWrite=false;mesh.renderOrder=1000;mesh.material.needsUpdate=true;textures.push(texture)};
 el.addEventListener('loaded',apply,{once:true});
 if(action){el.classList.add('interactable');el.setAttribute('campus-action',action);el.dataset.action=action;}
 parent.append(el);return el;
}
function wrap(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,line=48){
 let row='';for(const char of text){if(char==='\n'||ctx.measureText(row+char).width>width){ctx.fillText(row,x,y);y+=line;row=char==='\n'?'':char}else row+=char}ctx.fillText(row,x,y);return y+line;
}
function lineCount(ctx:CanvasRenderingContext2D,text:string,width:number){let count=1,row='';for(const ch of text){if(ch==='\n'||ctx.measureText(row+ch).width>width){count++;row=ch==='\n'?'':ch}else row+=ch}return count;}
export function drawWorldPanel(root:HTMLElement,title:string,body:string,buttons:PanelButton[],guide?:Guidance){
 root.replaceChildren();textures.splice(0).forEach(t=>t.dispose());
 const c=document.createElement('canvas');c.width=1200;c.height=1320;const ctx=c.getContext('2d')!;
 ctx.fillStyle='#112f38';ctx.beginPath();ctx.roundRect(0,0,1200,1320,48);ctx.fill();
 ctx.fillStyle='#75e0c4';ctx.font='500 28px Campus, sans-serif';ctx.fillText('周 六 开 门 计 划  /  大 学 城 示 意 校 园',70,70);
 ctx.fillStyle='#ffffff';ctx.font='700 60px Campus,sans-serif';let y=wrap(ctx,title,70,170,1060,76);
 let bodyFont=37,bodyLine=54;const available=608-(y+20);let lines=0;for(;bodyFont>=26;bodyFont--){bodyLine=Math.round(bodyFont*1.37);ctx.font=`400 ${bodyFont}px Campus,sans-serif`;lines=lineCount(ctx,body,1060);if(lines*bodyLine<=available)break;}root.dataset.bodyFits=String(lines*bodyLine<=available);root.dataset.bodyFont=String(bodyFont);ctx.fillStyle='#daecec';wrap(ctx,body,70,y+20,1060,bodyLine);
 canvasPlane(root,3.4,3.74,c).setAttribute('position','0 0 0');
 if(guide){
  const gc=document.createElement('canvas');gc.width=1400;gc.height=260;const g=gc.getContext('2d')!;
  g.fillStyle='#e3f5d1';g.beginPath();g.roundRect(0,0,1400,260,28);g.fill();
  g.fillStyle='#31583f';g.font='500 30px Campus,sans-serif';g.fillText(`${guide.courseTopic?`课程：${guide.courseTopic}`:`你现在是${guide.role}`} · 点此查看说明`,40,48,1320);
  g.font='700 43px Campus,sans-serif';g.fillStyle='#16392e';wrap(g,guide.goal,40,112,1320,52);
  g.font='400 31px Campus,sans-serif';wrap(g,guide.next,40,172,1320,42);
  canvasPlane(root,3.4,.63,gc,'guide-help').setAttribute('position','0 2.25 .04');
 }
 const count=buttons.length;const bh=Math.min(.36,1.88/Math.max(count,1));
 buttons.forEach((b,i)=>{
  const bc=document.createElement('canvas');bc.width=1100;bc.height=140;const bctx=bc.getContext('2d')!;
  bctx.fillStyle=b.tone==='muted'?'#284650':'#b9f078';bctx.beginPath();bctx.roundRect(0,0,1100,140,24);bctx.fill();
  bctx.fillStyle=b.tone==='muted'?'#ffffff':'#15382b';bctx.font='600 42px Campus,sans-serif';bctx.textAlign='center';bctx.textBaseline='middle';bctx.fillText(b.label,550,70,1040);
  canvasPlane(root,3.02,bh*.88,bc,b.action).setAttribute('position',`0 ${-.05-i*bh} .025`);
 });
}
