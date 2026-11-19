/** Original lightweight campus. All plan geometry uses the same 9×7 course grid. */
import { GRID, LAYOUTS } from './domain';
export type Layout = 'front' | 'side';
export type Cell = readonly [number, number];
export const grid = (x:number,y:number,height=0) => ({x:(x-4)*GRID.cellSize,y:height,z:(y-3)*GRID.cellSize});
export const world = grid;

type Entity = HTMLElement & {object3D?:any; getObject3D?:(name:string)=>any};
type Allocation = {id:string;admitted?:boolean;selected?:boolean;allocated?:boolean;hasSeat?:boolean}[] | Record<string,any>;

function entity(tag:string,parent:HTMLElement,attrs:Record<string,any>={}):Entity {
 const el=document.createElement(tag) as Entity;
 for(const [k,v] of Object.entries(attrs)) el.setAttribute(k,typeof v==='object'?`${v.x} ${v.y} ${v.z}`:String(v));
 parent.append(el);return el;
}
function box(parent:HTMLElement,p:number[],size:number[],color:string,extra:Record<string,any>={}){
 return entity('a-box',parent,{position:p.join(' '),width:size[0],height:size[1],depth:size[2],color,roughness:'.86',...extra});
}
function label(parent:HTMLElement,text:string,p:number[],width=2.1,rotation='0 -90 0',color='#123c43',back='#f6fff4',action?:string){
 const c=document.createElement('canvas');c.width=1024;c.height=260;const ctx=c.getContext('2d')!;
 ctx.fillStyle=back;ctx.beginPath();ctx.roundRect(0,0,1024,260,30);ctx.fill();
 ctx.fillStyle=color;ctx.font='700 78px Campus, "Noto Sans SC",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
 const lines=text.split('\n');lines.forEach((line,i)=>ctx.fillText(line,512,130+(i-(lines.length-1)/2)*94,950));
 const el=entity('a-plane',parent,{position:p.join(' '),rotation,width,height:width*260/1024,material:'shader: flat; side: double'});
 const apply=()=>{const mesh=el.getObject3D?.('mesh');if(mesh){const A=(window as any).AFRAME;const tex=new A.THREE.CanvasTexture(c);tex.colorSpace=A.THREE.SRGBColorSpace;mesh.material.map=tex;mesh.material.needsUpdate=true}};
 el.addEventListener('loaded',apply,{once:true});
 if(action){el.classList.add('interactable');el.dataset.action=action;el.setAttribute('campus-action',action)}
 return el;
}
function person(parent:HTMLElement,name:string,color:string):Entity {
 const el=entity('a-entity',parent,{'data-person':name});
 entity('a-cylinder',el,{position:'0 .76 0',radius:'.24',height:'.70',color,segments:8});
 entity('a-sphere',el,{position:'0 1.37 0',radius:'.23',color:'#e4b791','segments-width':12,'segments-height':8});
 entity('a-sphere',el,{position:'0 1.48 .015',radius:'.235',scale:'1 .45 1',color:'#223a40','segments-width':10,'segments-height':6});
 for(const x of [-.13,.13]){
  box(el,[x,.25,0],[.16,.5,.19],'#203d51');
  box(el,[x,.045,.06],[.19,.09,.32],'#f5f4dd');
  box(el,[Math.sign(x)*.32,.72,0],[.13,.62,.15],color,{rotation:`0 0 ${Math.sign(x)*10}`});
 }
 label(el,name,[0,1.95,0],1.0,'0 -90 0','#143a43','#f6fff4');
 return el;
}
function move(el:Entity,cell:Cell,height=0){const p=grid(cell[0],cell[1],height);el.setAttribute('position',`${p.x} ${p.y} ${p.z}`);}
function interpolate(route:readonly Cell[],progress:number):Cell {
 const value=Math.max(0,Math.min(route.length-1,progress*(route.length-1))),i=Math.min(route.length-2,Math.floor(value)),u=value-i;
 return [route[i][0]+(route[i+1][0]-route[i][0])*u,route[i][1]+(route[i+1][1]-route[i][1])*u];
}
const paths:Record<Layout,readonly Cell[]>={
 front:LAYOUTS.front.path,
 side:LAYOUTS.side.path,
};
const queueCells:Record<Layout,readonly Cell[]>={front:LAYOUTS.front.queue,side:LAYOUTS.side.queue};

export function buildCampus(scene:HTMLElement){
 const campus=entity('a-entity',scene,{id:'campus-geometry'});
 entity('a-sky',campus,{color:'#dceff5'});
 entity('a-light',campus,{type:'ambient',intensity:1.0,color:'#f8fff5'});
 entity('a-light',campus,{type:'directional',position:'-5 10 -6',intensity:1.4,color:'#fff3d7',castShadow:false});
 box(campus,[0,-.17,0],[75,.3,65],'#98c5a5');
 // Pale routes connect every visitor destination; green islands stay non-walkable.
 for(let x=0;x<9;x++)for(let y=0;y<7;y++){
  const p=grid(x,y);const road=y===2||y===4||y===5||x===1||x===7||x===4;
  box(campus,[p.x,-.012,p.z],[2.35,.04,2.35],road?'#e1e7dc':((x+y)%2?'#8dbd98':'#8ab895'));
  if(road){box(campus,[p.x,.012,p.z],[.04,.012,.13],'#bdcbbb');}
 }
 // Fine edge studs make this an explicit teaching model without a flat-map overlay.
 for(let x=0;x<9;x++){const p=grid(x,6);label(campus,String(x),[p.x,.04,p.z+.45],.30,'-90 0 0','#486f67','#d6e7d1')}
 for(let y=0;y<7;y++){const p=grid(0,y);label(campus,String(y),[p.x-.45,.04,p.z],.30,'-90 0 0','#486f67','#d6e7d1')}
 // Canal and characteristic low skyline, deliberately schematic rather than a real campus map.
 box(campus,[0,-.05,-11],[32,.04,3.4],'#68b6c1');
 for(let i=0;i<8;i++)box(campus,[-16+i*4,1.4+(i%3)*.4,-16],[2.8,2.8+(i%3)*.8,3],'#b3d2ce');
 // West gate, open portal with original bilingual architectural lettering.
 for(const z of [-.5,5.5]){box(campus,[-9.5,1.65,z],[.58,3.3,.58],'#f6f2de');box(campus,[-9.5,.12,z],[.95,.24,.95],'#537c72')}
 box(campus,[-9.5,3.4,2.5],[.82,.45,7.1],'#20515c');
 label(campus,'周六 · 开门计划',[-9.05,3.41,2.5],3.9,'0 90 0','#efffe8','#20515c');
 // Gate kiosk: the window is where the visitor receives the result card.
 box(campus,[-7.5,1.1,6],[2.3,2.2,1.8],'#f4f1dd');
 box(campus,[-7.5,2.3,6],[2.65,.25,2.2],'#21505a');
 box(campus,[-7.5,1.35,5.08],[1.66,.9,.08],'#8cbac1',{opacity:.72});
 box(campus,[-7.5,.86,4.96],[1.96,.14,.42],'#c37255');
 label(campus,'访客领卡窗口',[-7.5,2.05,5.04],1.7,'0 0 0','#173b43','#e5f5dc','claim');
 // Campus exhibit hall is visible across the open main route.
 box(campus,[10.5,2.0,1.9],[5.0,4.0,8.3],'#e9efdf');
 box(campus,[8.0,2.05,1.9],[.09,3.0,6.5],'#3c727b');
 for(const z of [-.65,1.9,4.45])box(campus,[7.92,1.5,z],[.14,2.5,2.1],'#76b2bd',{opacity:.80});
 box(campus,[8.0,3.85,1.9],[.6,.3,8.7],'#215362');
 box(campus,[6.85,2.8,2.4],[2.6,.18,5.3],'#cf815e');
 for(const z of [.05,4.75])box(campus,[5.8,1.4,z],[.17,2.8,.17],'#e9efdf');
 label(campus,'纸桥工作坊', [7.7,3.44,2.4],3.35,'0 -90 0','#fffbe8','#20515c');
 label(campus,'20 工位 · 8 学生 + 12 公众',[7.68,2.95,2.4],2.9,'0 -90 0','#254b50','#e9efdf');
 // Paper bridge display outside the workshop is open to everyone.
 box(campus,[5.8,.76,6.3],[2.1,.14,1.0],'#d5aa74');
 for(const x of [5.05,6.55])for(const z of [6.02,6.58])box(campus,[x,.37,z],[.12,.74,.12],'#245464');
 for(let i=0;i<9;i++){const x=5.0+i*.20,h=.37*Math.sin(i/8*Math.PI);box(campus,[x,1.02+h,6.3],[.24,.07,.55],'#f8f0c4',{rotation:`0 0 ${32*Math.cos(i/8*Math.PI)}`})}
 label(campus,'公共展台 · 无需工坊席位',[5.8,1.9,6.3],2.2,'0 -90 0','#143e45','#fff8d4','detail:public');
 // The side check-in is screened by a colonnade: turn around its west end to see it.
 box(campus,[1.0,1.03,3.64],[3.2,2.06,.18],'#aec5b5');
 for(const x of [-1.0,1.2,3.4])box(campus,[x,1.48,6.2],[.16,2.96,.16],'#f4f3dd');
 box(campus,[1.2,3.0,4.9],[5.0,.16,3.0],'#386b65');
 label(campus,'侧廊 · 转过连廊进入',[-1.2,2.6,4.7],1.8,'0 -90 0','#e5f9da','#386b65');
 // Original trees, benches and circular beds give the crossroads a recognisable silhouette.
 for(const [x,z,s] of [[-6,-5.5,1.1],[-2.5,-5.4,1.35],[2,-5.4,.95],[6,-5.3,1.1],[-5.8,7.9,1.0],[-2.5,8.2,1.2],[3,9,1.3],[-3.8,.1,.85]]){
  const tree=entity('a-entity',campus,{position:`${x} 0 ${z}`,scale:`${s} ${s} ${s}`});
  entity('a-cylinder',tree,{position:'0 .15 0',radius:'1.1',height:'.24',color:'#6e9b7d','segments-radial':16});
  entity('a-cylinder',tree,{position:'0 1.35 0',radius:'.15',height:'2.6',color:'#937452','segments-radial':7});
  entity('a-dodecahedron',tree,{position:'0 2.9 0',radius:'1.2',scale:'1.25 1 1.15',color:'#38775d'});
  entity('a-dodecahedron',tree,{position:'.6 2.55 .3',radius:'.85',color:'#5b9971'});
  box(campus,[x, .57,z+1.45],[1.7,.12,.46],'#c6a579');
  for(const bx of [-.6,.6])box(campus,[x+bx,.3,z+1.45],[.12,.5,.35],'#3c6b65');
 }
 // Student route is permanent; amber queue markings will visibly cross it in the first layout.
 for(let x=1;x<=7;x++){const p=grid(x,2);box(campus,[p.x,.025,p.z],[2.1,.025,.16],'#75b7bc')}
 label(campus,'学生通道 · 去上课',[0,.04,-2.4],2.4,'-90 0 0','#eafff4','#477e86');
 label(campus,'限制区域 · 教学楼\n点此了解原因',[7.1,1.6,-3.6],2.0,'0 -90 0','#fff4dd','#a76049','detail:restriction');
 for(const z of [-4.2,-3.7,-3.2])box(campus,[7.5,.7,z],[.12,1.4,.12],'#bd8466');
 // Student teaching wing is separate from the public workshop.
 box(campus,[10.3,2.5,-5.5],[4.6,5,4],'#91b4af');
 for(let row=0;row<3;row++)for(let col=0;col<3;col++)box(campus,[7.97,.9+row*1.45,-6.8+col*1.3],[.07,.8,.86],'#456b77');
 // Service station sits on the public path, not inside the teaching wing.
 box(campus,[-5.8,.9,-.7],[1.6,.14,1.1],'#e6bf7b');
 for(const x of [-6.4,-5.2])box(campus,[x,.43,-.7],[.1,.86,.8],'#345764');
 label(campus,'服务台 · 意见与回执',[-5.8,1.8,-.7],1.9,'0 -90 0','#effdf1','#386b65','go:service');
 // Distinguish green navigation rings from orange information signs.
 for(const [id,cell,title] of [['hall',[6.6,4],'前往展馆'],['gate',[1,4],'返回校门'],['student',[1,2],'学生来向'],['queue',[5.3,2.3],'队尾观察']] as const){
  const p=grid(cell[0],cell[1]);const ring=entity('a-ring',campus,{position:`${p.x} .045 ${p.z}`,rotation:'-90 0 0','radius-inner':'.30','radius-outer':'.49',color:'#2f8c77',material:'shader: flat; side: double',class:'interactable','campus-action':`go:${id}`,'data-action':`go:${id}`});
  ring.dataset.destination=id;label(campus,title,[p.x,.055,p.z+.70],1.1,'-90 0 0','#215a50','#e1f6dc',`go:${id}`);
 }
 for(const [layoutName,cell] of [['front',LAYOUTS.front.desk],['side',LAYOUTS.side.desk]] as const){const p=grid(...cell);entity('a-ring',campus,{position:`${p.x} .07 ${p.z}`,rotation:'-90 0 0','radius-inner':'.75','radius-outer':'.88',color:'#e19c58',material:'shader: flat; side: double',class:'interactable','campus-action':`layout:${layoutName}`});label(campus,`落点 · ${layoutName==='front'?'门前':'侧廊'}`,[p.x,.09,p.z+.98],1.25,'-90 0 0','#633c24','#f8d69b',`layout:${layoutName}`)}
 const dynamic=entity('a-entity',campus,{id:'layout-objects'});
 const routeRoot=entity('a-entity',dynamic,{id:'visitor-route'});
 const queueRoot=entity('a-entity',dynamic,{id:'queue-markers'});
 const desk=entity('a-entity',dynamic,{id:'desk',class:'interactable','campus-action':'select-desk','data-action':'select-desk'});
 box(desk,[0,.92,0],[1.65,.17,.95],'#e8b567');
 box(desk,[0,.55,.16],[1.4,.7,.12],'#2b666c');
 for(const x of [-.65,.65])box(desk,[x,.45,-.30],[.10,.9,.10],'#34545b');
 box(desk,[.4,1.07,.06],[.42,.12,.32],'#edf6df');
 label(desk,'签到桌 · 点我挪动',[0,1.53,0],1.7,'0 -90 0','#fff8d7','#245563','select-desk');
 const arrow=entity('a-entity',dynamic,{id:'direction-sign'});
 box(arrow,[0,.7,0],[.10,1.4,.10],'#425d5c');
 const arrowText=label(arrow,'签到 · 门前',[0,1.60,0],1.7,'0 -90 0','#153f43','#f5d38d');
 const feedbackArrow=entity('a-entity',dynamic,{id:'published-arrow',visible:false});
 label(feedbackArrow,'签到在侧廊\n沿黄色路线右转',[0,1.62,0],2.0,'0 -90 0','#153f43','#f5d38d');
 box(feedbackArrow,[0,.7,0],[.1,1.4,.1],'#425d5c');move(feedbackArrow,[5,4]);
 const visitor1=person(dynamic,'O01','#d88a58'),visitor2=person(dynamic,'O02','#d1a64d'),student=person(dynamic,'S01 学生','#4085b2');
 const statusLabel=entity('a-entity',dynamic,{id:'replay-world-status'});
 const statusText=label(statusLabel,'同一时刻 · 等待重放',[0,0,0],3.3,'0 -90 0','#fff8e8','#305e67');
 statusLabel.setAttribute('position','4.2 2.7 -1.5');
 let layout:Layout='front',replayStart=-1,playing=false,lastText='',route=paths.front,layoutReady=false,allocationSummary='';
 const allApplicants=entity('a-entity',dynamic,{id:'allocation-crowd'});

 function setStatus(text:string){if(text===lastText)return;lastText=text;const next=label(statusLabel,text,[0,0,0],3.3,'0 -90 0','#fff8e8','#305e67');statusLabel.replaceChildren(next)}
 function setLayout(next:Layout,published=false){
  feedbackArrow.setAttribute('visible',String(published&&next==='side'));
  // UI refreshes do not restart the shared simulation clock.
  if(layoutReady&&next===layout)return;
  layoutReady=true;
  layout=next;route=paths[layout];move(desk,LAYOUTS[next].desk);
  routeRoot.replaceChildren();queueRoot.replaceChildren();
  route.forEach((cell,i)=>{const p=grid(cell[0],cell[1]);
   entity('a-ring',routeRoot,{position:`${p.x} .055 ${p.z}`,rotation:'-90 0 0','radius-inner':'.20','radius-outer':'.27',color:'#c58b3c',material:'shader: flat; side: double'});
   if(i<route.length-1){const q=grid(route[i+1][0],route[i+1][1]);box(routeRoot,[(p.x+q.x)/2,.047,(p.z+q.z)/2],[Math.abs(q.x-p.x)||.07,.023,Math.abs(q.z-p.z)||.07],'#cb9847')}
  });
  queueCells[layout].forEach((cell,i)=>{const p=grid(cell[0],cell[1]);box(queueRoot,[p.x,.04,p.z],[1.45,.035,1.45],layout==='front'&&i===1?'#d48362':'#dfbf78');label(queueRoot,`排队 ${i+1}`,[p.x,.067,p.z],.9,'-90 0 0','#61492c','#f5d999')});
  move(arrow,next==='front'?[4.3,4.3]:[2,4.4]);
  const newArrow=label(arrow,next==='front'?'签到 · 门前':'签到 · 侧廊',[0,1.60,0],1.7,'0 -90 0','#153f43','#f5d38d');
  // Keep exactly one direction label when moving the physical sign repeatedly.
  [...arrow.children].filter(el=>el.tagName.toLowerCase()==='a-plane'&&el!==newArrow).forEach(el=>el.remove());
  move(visitor1,queueCells[next][0]);move(visitor2,queueCells[next][1]);move(student,[1,2]);
  playing=false;replayStart=-1;setStatus(next==='front'?'门前签到 · 学生通道重叠 1 格':'侧廊签到 · 学生通道重叠 0 格');
 }
 function replay(){playing=true;replayStart=-1;move(visitor1,[1,4]);move(visitor2,[1,4]);move(student,[1,2]);setStatus('00 秒 · 同样的三个人，再来一次')}
 function go(place:'gate'|'hall'|'student'|'queue'|'service'){
  const rig=document.querySelector('#rig') as Entity|null,camera=document.querySelector('#camera') as Entity|null;if(!rig)return;
  const destination:Record<string,Cell>={gate:[1,4],hall:[6.25,4],student:[1,2],queue:layout==='front'?[4.3,2]:[1.7,5],service:[1,3]};
  const yaw=place==='hall'?90:-90;
  rig.setAttribute('rotation',`0 ${yaw} 0`);
  if((scene as any).is?.('vr-mode')&&camera?.object3D&&rig.object3D){
   // Rotate the rig first, then compensate the tracked room-space offset.
   // The headset's physical orientation and look-controls tracking stay intact.
   rig.object3D.updateMatrixWorld(true);
   const head=new (window as any).AFRAME.THREE.Vector3();
   camera.object3D.getWorldPosition(head);
   const target=grid(...destination[place]);
   rig.object3D.position.x+=target.x-head.x;
   rig.object3D.position.z+=target.z-head.z;
  }else{
   move(rig,destination[place]);
   if(camera?.object3D){camera.object3D.rotation.set(0,0,0);const controls=(camera as any).components?.['look-controls'];if(controls){controls.pitchObject.rotation.x=0;controls.yawObject.rotation.y=0}}
  }
 }
 function tick(_time:number,delta:number){
  if(!playing)return;
  if(replayStart<0)replayStart=_time;
  // Use the shared real-time clock so slow projection frames do not lengthen the replay.
  const t=(_time-replayStart)/1000;
  // All actors use one clock. Queue shuffling is separate from the course's route-length metric.
  const visitor=(actor:Entity,index:number)=>{
   const wait=queueCells[layout][index],start=index*1.15;
   const approach:Cell[]=layout==='front'?[[1,4],[2,4],[3,4],[4,4],[5,4],[5,3],...(index===1?[[5,2] as Cell]:[])]:[[1,4],[1,5],[2,5],...(index===0?[[3,5] as Cell]:[])];
   const deskCell:Cell=layout==='front'?[5,4]:[4,5];
   const exit:Cell[]=layout==='front'?[wait,[5,3],deskCell,[6,4],[7,4]]:[wait,[3,5],deskCell,[5,5],[6,5],[7,5],[7,4]];
   let p:Cell;
   if(t<start)p=[1,4];else if(t<6.5+start)p=interpolate(approach,(t-start)/6.5);else if(t<10.5+index*1.2)p=wait;else p=interpolate(exit,(t-10.5-index*1.2)/(layout==='front'?3.3:4.8));
   move(actor,p);
  };
  visitor(visitor1,0);visitor(visitor2,1);
  const begin=5.5,speed=1.1;let sx=1+Math.max(0,t-begin)*speed;
  if(layout==='front'){
   const reach=begin+3.55/speed,release=12.6;
   if(t>=reach&&t<release)sx=4.55;
   else if(t>=release)sx=4.55+(t-release)*speed;
  }
  move(student,[Math.min(7,sx),2]);
  const blocked=layout==='front'&&t>8.75&&t<12.6;
  setStatus(`${Math.min(17,Math.floor(t)).toString().padStart(2,'0')} 秒 · ${blocked?'S01 被队尾挡住，正在等候':layout==='side'?'学生顺利通过，访客多走 2 格':'O01、O02 到达签到队列'}`);
  for(const actor of [visitor1,visitor2,student]){const mesh=actor.object3D;if(mesh){const idle=(actor===student&&blocked)||t>16;mesh.rotation.z=idle?0:Math.sin(t*7)*.022;}}
  if(t>=17){playing=false;scene.dispatchEvent(new CustomEvent('campus-replay-ended',{detail:{layout}}));setStatus(layout==='front'?'重放结束 · 学生等候约 4 秒':'重放结束 · 学生通过 / 访客多走 2 格')}
 }
 function setAllocation(allocation:Allocation){
  const entries=Array.isArray(allocation)?allocation:Object.entries(allocation).map(([id,v])=>typeof v==='boolean'?{id,admitted:v}:{id,...v});
  const summary=entries.map((entry:any)=>`${entry.id}:${Boolean(entry.admitted??entry.selected??entry.allocated??entry.hasSeat??entry.accepted)}`).join('|');
  if(summary===allocationSummary)return;
  allocationSummary=summary;
  allApplicants.replaceChildren();
  entries.forEach((entry:any,i:number)=>{
   if(entry.id==='O01'||entry.id==='O02')return;
   const admitted=Boolean(entry.admitted??entry.selected??entry.allocated??entry.hasSeat??entry.accepted);
   const el=person(allApplicants,entry.id,admitted?'#609a82':'#8b9dac');el.setAttribute('scale','.70 .70 .70');
   // Result-derived destinations: a seat leads to hall; no seat to the public paper bridge display.
   const n=entries.slice(0,i).filter((e:any)=>Boolean(e.admitted??e.selected??e.allocated??e.hasSeat??e.accepted)===admitted).length;
   const p=admitted?grid(6.8+(n%3)*.22,3.4-Math.floor(n/3)*.27):grid(6+(n%2)*.34,5.7+Math.floor(n/2)*.30);
   el.setAttribute('position',`${p.x} ${p.y} ${p.z}`);el.dataset.destination=admitted?'hall':'public-exhibit';
  });
 }
 setLayout('front');
 return {setLayout,replay,go,tick,setAllocation};
}
