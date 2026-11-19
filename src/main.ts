import 'aframe';
import './style.css';
import {getGuidance,type Guidance} from './guidance';
import {initialRules,resetRuleSelection,chooseRuleCase,reviewRuleCase,appealRuleCase,restoreRules,RESOURCE_ITEMS,initialResourcePlan,confirmResourceParty,restoreResourcePlan,resourceReadiness,type RuleCase,type ResourceParty} from './institutions';
import {COURSE_TITLE,COURSE_QUESTION,COURSE_MECHANISMS,courseContext,courseReview} from './course';
import {registerComponents,drawWorldPanel,type PanelButton} from './components';
import {buildCampus} from './scene';
import {initialState,executePolicy,claimCard,currentCard,allocate,compare,metrics,previewLayout,submitFeedback,reviewFeedback,publishFeedback,nextVisitor,serialize,restore,queryReceipt,LAYOUTS,type AppState,type Layout} from './domain';

const STORE='saturday-campus-v1';
let state:AppState=initialState();
let rulesState=initialRules(),resourcePlan=initialResourcePlan();
let courseReturnStage='welcome',resourceIndex=0,reviewIndex=0,ruleView='result',resourceView='offer';
let routeToken=0;
let stage='welcome', selected=false, role:'visitor'|'student'|'staff'='visitor';
try{const saved=JSON.parse(localStorage.getItem(STORE)||'null');if(saved){state=restore(saved.domain);rulesState=restoreRules(saved.rules);resourcePlan=restoreResourcePlan(saved.resources);courseReturnStage=['welcome','policy','reveal','card','replay','feedback','review','next','allocation','receipt','history','service','case'].includes(saved.resumeStage)?saved.resumeStage:state.cardClaimed?'card':state.policy?'reveal':state.started?'policy':'welcome';stage=['course','course-rules','course-resources','course-participation','course-review'].includes(saved.stage)||(state.started&&['policy','reveal','card','replay','feedback','review','next','allocation','receipt','history','service','case'].includes(saved.stage))?saved.stage:'welcome';}}catch{}
let xrMessage='正在检测头显支持',xrSupported=false,toastTimer=0;
let returnStage='card', pageIndex=0;
let helpReturnStage='welcome',helpContext:Guidance|null=null;
let replayPlaying=false,walking=false,arrived=false;
let renderedGuidance='';
const observed=new Set<Layout>();
let campus:ReturnType<typeof buildCampus>;
const app=document.querySelector('#app')!;
app.innerHTML=`<header><div class="brand"><div class="brandmark">门</div><div><strong>如果周六由你开校门</strong><small>设计思维·创新课程 · 制度情境原型</small></div></div><nav aria-label="课程进度"><button data-action="course:rules">校际规则协作</button><button data-action="course:resources">校城资源互惠</button><button data-action="course:participation">公众自愿共建</button></nav><div class="tools"><button data-action="guide-help">我该做什么？</button><button data-action="records">决策记录</button><button id="xr" data-action="enter-xr">检测头显</button></div></header>
<main class="layout"><aside class="sidebar"><div class="eyebrow">设计思维·创新课程 / 广州大学城</div><button class="course-anchor" data-action="course">课程项目：大学校园开放制度的创新设计</button><h1>怎样共享校园，<br>也保障学生日常？</h1><div class="intro">按原报告的三项创新，体验规则处理、成本责任和自愿共建。<br>每个操作都能查看它对应的课程问题。</div><div class="tagrow"><span class="tag">规则协作</span><span class="tag">资源互惠</span><span class="tag">自愿共建</span></div><section class="guide-card" aria-label="当前任务提示" aria-live="polite"><div class="guide-meta"><span id="guide-role"></span><span id="guide-step"></span></div><h2 id="guide-goal"></h2><p id="guide-next"></p><div class="course-bridge"><b id="course-topic"></b><p id="course-evidence"></p><button data-action="course">查看与原课程报告的对应</button></div><button id="guide-continue" hidden></button><button class="guide-more" data-action="guide-help">看不懂？查看这一步说明</button></section><div class="actline" id="actline">序章 / 今天由你开门</div><section class="panel" aria-live="polite"><h2 id="panel-title"></h2><p id="panel-body"></p><div class="actions" id="actions"></div></section><div class="footnote"><strong>开放的，不只是一扇门。</strong><br>示意校园与虚构人物 · 格数为课程推演<br><span id="xr-status"></span></div></aside>
<div class="viewport"><a-scene id="scene" embedded renderer="antialias: true; colorManagement: true" background="color: #b7dce7" fog="type: linear; color: #cce5e9; near: 28; far: 65" vr-mode-ui="enabled: false" webxr="optionalFeatures: local-floor, bounded-floor" loading-screen="enabled: false"><a-entity id="rig" position="-7.2 0 2.4" rotation="0 -90 0" campus-walk xr-campus><a-camera id="camera" position="0 1.65 0" wasd-controls="enabled: false" look-controls="pointerLockEnabled: false; touchEnabled: true" far="100"><a-entity cursor="rayOrigin: mouse; fuse: false" raycaster="objects: .interactable; far: 35"></a-entity></a-camera><a-entity id="left-hand" laser-controls="hand: left; model: false" raycaster="objects: .interactable; far: 30" line="color: #b9f078"></a-entity><a-entity id="right-hand" laser-controls="hand: right; model: false" raycaster="objects: .interactable; far: 30" line="color: #b9f078"></a-entity></a-entity><a-entity id="world-panel"></a-entity></a-scene><div class="scene-top"><div class="place-label"><b id="place-name">南门 · 开放日岗亭</b><small>GUANGZHOU UNIVERSITY TOWN</small></div><div class="live-tag" id="version-label">现场 v1 · 门前签到</div></div><div class="map" id="minimap"></div><div class="mobile-task" aria-hidden="true"><span id="mobile-task-role"></span><strong id="mobile-task-goal"></strong></div><div class="crosshair"></div><div class="touchpad" aria-label="触控行走"><button data-move="forward:1" aria-label="前进">前</button><button data-move="right:-1" aria-label="向左">左</button><button data-move="forward:-1" aria-label="后退">后</button><button data-move="right:1" aria-label="向右">右</button></div><div class="scene-bottom"><div class="hint">拖动视角 · W A S D 行走 · 点击实体互动<br>M 收放面板 · 头显：握键唤回 / 扳机点选 / 光圈传送</div><div class="hotspots"><button data-action="go:gate">校门</button><button data-action="go:hall">展馆</button><button data-action="go:student">学生来向</button><button data-action="go:queue">队尾</button><button data-action="service">服务台</button></div></div><div class="toast" id="toast" hidden></div></div></main>`;
registerComponents(dispatch);
const scene=document.querySelector('#scene') as any;
const worldPanel=document.querySelector('#world-panel') as any;
const rig=document.querySelector('#rig') as any;
const camera=document.querySelector('#camera') as any;
function save(){try{localStorage.setItem(STORE,JSON.stringify({domain:serialize(state),stage:stage==='step-help'?helpReturnStage:stage,rules:rulesState,resources:resourcePlan,resumeStage:courseReturnStage}))}catch{toast('浏览器存储不可用，本次进度将保留到关闭页面前。')}}
function toast(message:string){showXRToast(message);const el=document.querySelector('#toast')!;el.textContent=message;el.removeAttribute('hidden');clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>el.setAttribute('hidden',''),4200);}
let xrToastTimer=0;
function showXRToast(message:string){if(!scene?.is('vr-mode'))return;let holder=document.querySelector('#xr-toast') as any;if(!holder){holder=document.createElement('a-plane');holder.id='xr-toast';holder.setAttribute('width','2.6');holder.setAttribute('height','.62');holder.setAttribute('position','0 .66 -2.3');holder.setAttribute('material','shader: flat; transparent: true');camera.append(holder)}
 const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=320;const c=canvas.getContext('2d')!;c.fillStyle='#14363b';c.fillRect(0,0,1400,320);c.fillStyle='#ecffd8';c.font='44px Campus,sans-serif';let line='',y=80;for(const ch of message){if(c.measureText(line+ch).width>1280){c.fillText(line,60,y);line='';y+=65}line+=ch}c.fillText(line,60,y);
 const paint=()=>{const mesh=holder.getObject3D('mesh');if(!mesh)return;mesh.material.map?.dispose();const T=(window as any).AFRAME.THREE;mesh.material.map=new T.CanvasTexture(canvas);mesh.material.map.colorSpace=T.SRGBColorSpace;mesh.material.depthTest=false;mesh.material.needsUpdate=true;mesh.renderOrder=2000;};if(holder.hasLoaded)paint();else holder.addEventListener('loaded',paint,{once:true});holder.object3D.visible=true;clearTimeout(xrToastTimer);xrToastTimer=window.setTimeout(()=>holder.object3D.visible=false,5000);
}
function poseBoard(){if(!rig)return;const y=rig.object3D.rotation.y+camera.object3D.rotation.y;const p=rig.object3D.position;worldPanel.object3D.position.set(p.x-Math.sin(y)*4.7+Math.cos(y)*2.0,2.05,p.z-Math.cos(y)*4.7-Math.sin(y)*2.0);worldPanel.object3D.rotation.set(0,y-Math.atan2(2,4.7),0);}
function walkTo(place:'gate'|'hall'|'student'|'queue'|'service'){
 ++routeToken;walking=false;worldPanel.object3D.visible=true;
 campus.go(place);
 document.querySelector('#place-name')!.textContent={gate:'南门 · 开放日岗亭',hall:'展馆 · 纸桥工作坊',student:'教学楼 · 学生来向',queue:'签到区 · 队尾观察',service:'连廊 · 公共服务台'}[place];poseBoard();
}
function latest(){return state.receipts.at(-1)}
function guidance():Guidance{const g=stage==='step-help'&&helpContext?helpContext:getGuidance({stage,state,selected,role,playing:replayPlaying,observed,walking,arrived});return {...g,courseTopic:courseContext(stage==='step-help'?helpReturnStage:stage,state,{rules:rulesState,resources:resourcePlan}).topic};}
function startReplay(){replayPlaying=true;campus.replay()}
function renderGuidance(g:Guidance){
 const c=courseContext(stage==='step-help'?helpReturnStage:stage,state,{rules:rulesState,resources:resourcePlan});document.querySelector('#course-topic')!.textContent=`课程关联：${c.topic}`;document.querySelector('#course-evidence')!.textContent=c.evidence;
 document.querySelector('#guide-role')!.textContent=`你现在是：${g.role}`;
 document.querySelector('#guide-step')!.textContent=g.step?`情境 ${g.step} / 3`:'课程原型';
 document.querySelector('#guide-goal')!.textContent=g.goal;
 document.querySelector('#guide-next')!.textContent=g.next;
 const next=document.querySelector('#guide-continue') as HTMLButtonElement;
 next.hidden=!g.action;next.textContent=g.label||'';if(g.action)next.dataset.action=g.action;else delete next.dataset.action;
 document.querySelector('#mobile-task-role')!.textContent=g.step?`情境任务${g.step} · 课程原型`:'校园开放制度 · 课程原型';
 document.querySelector('#mobile-task-goal')!.textContent=g.goal;
 const recommendations=new Set(g.highlights||[g.action]);
 for(const el of document.querySelectorAll<HTMLElement>('#actions [data-action]'))el.classList.toggle('next-action',recommendations.has(el.dataset.action));
}
scene.addEventListener('campus-replay-ended',(e:CustomEvent)=>{replayPlaying=false;observed.add(e.detail.layout);if(stage==='replay')update()});
function panel():{title:string;body:string;buttons:PanelButton[];act:number}{
 const b=(label:string,action:string,muted=false):PanelButton=>({label,action,tone:muted?'muted':'primary'});
 const m=metrics(state.preview),r=latest(),card=currentCard(state);
 switch(stage){
 case 'course':return {act:0,title:COURSE_TITLE,body:`${COURSE_QUESTION}\n原报告第7页提出三项制度。名额比较和挪桌用于发现问题、检验边界。`,buttons:[...COURSE_MECHANISMS.map((m,i)=>b(`创新${['一','二','三'][i]}：${m.name}`,`course:${m.id}`)),b(state.started?'继续原来的情境任务':'开始四分钟情境体验',state.started?'course:resume':'start'),b('查看本次推演与证据边界','course-review',true),b('返回刚才的页面','course:back',true)]};
 case 'course-rules':{
  const r=rulesState,n=r.notice;
  if(ruleView==='shared')return {act:0,title:'两校共享什么，谁来处理个案？',body:`${r.sharedCase||'匿名案例：初次误入受限区，先说明边界并提供公共路线指引。'}\n两校共享规则模板和匿名案例。个案由本校告知、复核和受理申诉。个人信息共享与联合限入仍待论证。`,buttons:[b('返回处理流程','rules:result'),b('返回三项制度','course',true)]};
  if(ruleView==='evidence'&&n)return {act:0,title:'核对证据与处理是否相称',body:`证据：${n.evidence}\n理由：${n.reason}\n来源：原报告第8、19页，情境记录为课堂设定。`,buttons:[b('返回本校复核','rules:result'),b('查看范围、期限与申诉','rules:notice',true)]};
  if(ruleView==='notice'&&n)return {act:0,title:'本校处理通知与申诉入口',body:`适用范围：${n.scope}\n结束时间：${n.until}\n申诉方式：${n.appeal}\n课堂模拟，不执行真实限入。`,buttons:[b('查看事实、证据与理由','rules:result'),...(r.stage==='notice'?[b('访客申请本校复核','rules:appeal')]:[]),b('返回三项制度','course',true)]};
  if(r.case===null)return {act:0,title:'创新一：校际规则协作',body:'报告第8、19页：不同情境采用不同处理。初次误入先帮助理解，反复扰乱由本校留证、告知并复核，即时危险由专业人员响应。\n选择一个拟议案例，检验处理是否相称。',buttons:[b('案例：初次误入宿舍区','rules:case:first'),b('案例：反复扰乱正常秩序','rules:case:repeat'),b('案例：出现即时人身危险','rules:case:danger'),b('查看跨校共享边界','rules:shared',true),b('返回三项制度','course',true)]};
  const body=(r.stage==='review'||r.stage==='appeal')&&n?`事实：${n.facts}\n${r.stage==='review'?'当前只是待复核草案，尚未限制资格。':'访客已提出申诉，请由本校复核或更正。'}\n先查看证据与理由，再判断处理是否相称。`:r.result;
  return {act:0,title:{guidance:'初次误入：先说明与指路',review:'本校复核：检查事实与证据',notice:'本校处理：告知范围、期限与申诉',appeal:'收到申诉：本校再次复核',corrected:'复核更正：撤销不相称处理',emergency:'即时危险：现有应急流程响应',choose:'选择一个案例'}[r.stage],body,buttons:[...(['review','appeal'].includes(r.stage)?[b('查看证据与处理理由','rules:evidence',true),b('模拟复核：依据充分，维持','rules:uphold'),b('模拟复核：认错或不相称，更正','rules:correct')]:[]),...(r.stage==='notice'?[b('查看通知范围、期限与申诉','rules:notice'),b('访客申请本校复核','rules:appeal')]:[]),...(r.stage==='guidance'?[b('指向公共路线，继续参观','rules:directions')]:[]),b('查看两校可共享的匿名案例','rules:shared',true),b('换一种情境比较','rules:choose',true),b('返回三项制度','course',true)]};
 }
 case 'course-resources':{
  const item=RESOURCE_ITEMS[resourceIndex],ready=resourceReadiness(resourcePlan);
  const status=ready.missing.length?'待模拟核对：'+ready.missing.map(p=>({school:'学校',city:'城市',community:'社区'}[p])).join('、'):'三方已在课堂中核对责任，真实合作仍待确认';
  const detail=resourceView==='cost'?`成本承担：${item.cost}\n优先保障与边界：${item.note}`:`使用者：${item.users}。时段：${item.time}。\n容量：${item.capacity}。组织：${item.owner}。配套：${item.support}。`;
  return {act:0,title:resourceView==='cost'?'开放成本与优先保障':`创新二：${item.name}`,body:`报告${item.source}，拟议清单 ${resourceIndex+1}/${RESOURCE_ITEMS.length}。\n${detail}\n${status}。`,buttons:[b(resourceView==='cost'?'返回容量与时段':'查看谁承担成本、谁优先','resources:detail'),b('下一项资源与责任','resources:next'),...(['school','city','community'] as const).map(p=>b(`${resourcePlan.confirmations[p]?'已模拟确认':'模拟确认'}${{school:'学校：师生预留与活动组织',city:'城市：交通保洁与回馈资源',community:'社区：路线反馈与支持边界'}[p]}`,`resources:confirm:${p}`,resourcePlan.confirmations[p])),...(ready.status==='simulation-ready'?[b('重新核对责任清单','resources:reset',true)]:[]),b('返回三项制度','course',true)]};
 }
 case 'course-participation':return {act:0,title:'创新三：游客参与校园共建',body:'报告第10、11页：自愿观察路线问题，纸卡或电子提交，学生与工作人员共同评审，告知采纳或未采纳理由。\n网站把它做成“观察排队、试摆签到桌、提交建议、双审发布、下一位核验”。普通参观无需参与，志愿者不替代安保与保洁。',buttons:[b(state.policy?'进入共建意见流程':'先进入开放日，观察通行问题',state.policy?'feedback':'start'),b('查看本次反馈是否真的生效','course-review'),b('返回三项制度','course',true)]};
 case 'course-review':{
  const review=courseReview(state,{rules:rulesState,resources:resourcePlan}),item=review.items[reviewIndex%review.items.length];
  return {act:0,title:item.title,body:`${item.statusLabel}\n${item.evidence}\n对应原报告${item.slides}。课堂模拟与真实制度成效分开说明。`,buttons:[b('下一项课程证据','course-review:next'),b('查看三项制度原型','course'),b('查看已做过的决定','records',true),b('返回情境任务','course:resume',true)]};
 }
 case 'step-help':{const g=helpContext||guidance();return {act:g.step,title:'这一步怎么做',body:`你现在是：${g.role}。\n${g.next}\n${g.why}`,buttons:[b('明白了，返回当前任务','close-guide'),...(g.action?[b(g.label||'继续当前任务',g.action)]:[])]};}
 case 'welcome':return {act:0,title:'周六，欢迎来访。',body:'课程问题：保护教学与学生日常的前提下，怎样让公众共享资源、让多方承担开放成本？\n三项制度：规则协作、资源互惠、自愿共建。',buttons:[b('先看课程项目与三项制度','course'),b('开始开放日','start'),b('操作说明与无障碍控制','help',true)]};
 case 'policy':return {act:1,title:'先定规则，再揭晓身份',body:'20 个工位，8 个已安排给学生。\n余下 12 席：O01–O12 在线申请，W01–W04 现场办理；各按编号排序。每人一席。',buttons:[b('A · 12 席全部在线发放','policy:A'),b('B · 8 席在线，4 席留给现场','policy:B')]};
 case 'reveal':return {act:1,title:`你是 ${state.identity}`,body:`${state.identity==='O09'?'线上排第九的申请人。':'当天临时有空的附近居民。'}\n规则 ${state.policy} 已执行。请在岗亭窗口领取自己的结果卡。`,buttons:[b('在窗口领取结果卡','claim')]};
 case 'card':return {act:1,title:`${card?.id} · ${card?.admitted?'已取得席位':'未取得席位'}`,body:`${card?.reason}\n${card?.admitted?'请前往展馆签到，参加纸桥工作坊。':'仍可沿公共路线参观展台；工作坊工位需预约。'}`,buttons:[b('沿公共路线前往展馆','visit-hall'),b('换一条规则，再过一次周六','switch-policy',true),b('查看 16 人分配与规则比较','allocation',true)]};
 case 'replay':return {act:2,title:'一张桌子，三个人的路',body:`${state.preview==='front'?'门前':'侧廊'}签到：访客走 ${m.steps} 格，队列与学生通道重叠 ${m.overlap} 格。\n固定重放 O01、O02、S01 的十几秒。${selected?'桌子已选中，请点击落点。':'先播放，再选中场景里的签到桌。'}`,buttons:[b('同一时刻重放 · 16 秒','replay'),b(selected?'已选中桌子':'选中签到桌','select-desk',true),...(selected?[b('落点 · 侧廊（试摆）','layout:side'),b('落点 · 门前（试摆）','layout:front',true)]:[]),b('站到学生来向','go:student',true),b('把建议交给服务台','feedback',true),b('收起面板观察 · 握键/M唤回','toggle-board',true)]};
 case 'feedback':return {act:3,title:'让这次试摆成为下个周六',body:'建议：签到桌移到侧廊，在原位置增加箭头。\n试摆只供观察；正式版本须由学生代表确认通行、工作人员确认值守条件。',buttons:[b('以访客身份提交电子意见','submit:electronic'),b('投递纸卡（本地登记）','submit:paper',true),b('跳过反馈，接待下一位访客','next',true),b('返回空间重放','back-replay',true)]};
 case 'review':return {act:3,title:role==='visitor'?'意见已收件':role==='student'?'学生代表 · 核对通行':'工作人员 · 核对值守',body:`本地回执 ${r?.id}\n${role==='visitor'?`状态：${statusName(r?.status)}；可按回执号查询。`:role==='student'?'侧廊摆位不占学生通道；请确认连续通行条件。':'侧廊有值守视线；原位置须增加箭头，安排一名引导员。'}\n学生：${reviewName(r?.reviews.student)} / 工作人员：${reviewName(r?.reviews.staff)}`,buttons:role==='visitor'?[b('切换学生代表','role:student'),b('切换工作人员','role:staff',true),b('双方通过后发布新版本','publish'),b('查询回执','receipt',true),b('接待下一位访客','next',true)]:[b('确认条件通过','approve'),b('暂缓：条件尚未落实','hold',true),b('返回访客身份','role:visitor',true)]};
 case 'allocation':{const rows=allocate(state.policy||'A'),row=rows[pageIndex%rows.length],diff=compare(state.policy||'A',state.policy==='A'?'B':'A');return {act:1,title:`结果卡 ${row.id} · ${row.admitted?'取得席位':'公共参观'}`,body:`${row.reason}\n改另一规则：${diff.gained.length} 人新获得、${diff.lost.length} 人失去、${diff.same.length} 人相同；两场坐满。`,buttons:[b('下一位申请人','page:next'),b('上一位申请人','page:prev',true),b('完整名单表（桌面）','allocation-table',true),b('返回体验','return',true)]};}
 case 'receipt':return {act:3,title:'本地回执，可追踪',body:r?`${r.id} · ${statusName(r.status)}\n学生：${reviewName(r.reviews.student)}\n工作人员：${reviewName(r.reviews.staff)}\n建议：${r.suggestion}`:'尚未提交意见。',buttons:[b('返回审批面板','back-review'),b('输入回执号查询（桌面）','receipt-query',true)]};
 case 'history':{const l=state.logs[Math.min(pageIndex,state.logs.length-1)];return {act:3,title:l?l.action:'还没有决定',body:l?`影响：${l.who.join('、')}\n结果：${l.result}\n原因：${l.reason}`:'从岗亭公告板开始一次开放日。',buttons:[b('下一条记录','page:next'),b('上一条记录','page:prev',true),b('完整记录与回执（桌面）','records-table',true),b('返回体验','return',true)]};}
 case 'service':return {act:3,title:'共同值班，互相支持',body:'学校：09:00–12:00 纸桥工作坊与公共展。\n社区：校门引导、侧廊签到；08:45–10:30 / 10:30–12:15 轮班。\n城市：拟议博物馆研学券与公交实践支持，待确认。',buttons:[b('两校共享的匿名案例','case'),b('提交改进意见','feedback'),b('创新二：核对资源与成本责任','course:resources'),b('创新一：体验误入处理与复核','course:rules',true),b('完整值班表（桌面）','service-table',true),b('返回体验','return',true)]};
 case 'case':return {act:3,title:'匿名案例 C-01 · 初次误入',body:'先友善指路到公共展台，解释工位限制。\n本校服务台按当轮规则复核，受理纸卡或电子申诉并出回执。两校只共享位置、措辞与处理步骤，不共享姓名照片；各校独立复核。',buttons:[b('返回共同值班表','back-service'),b('提交改进意见','feedback'),b('返回体验','return',true)]};
 case 'info-public':return {act:2,title:'公共展台向所有人开放',body:'这里展示纸桥作品与建造方法，无需工坊席位。未获席位的来访者仍可沿公共路线参观。',buttons:[b('返回体验','return')]};
 case 'info-restriction':return {act:2,title:'这里为什么限制进入？',body:'教学楼有正在上课的学生；纸桥工作坊有20个工位。公共路线与展台开放。首次误入先友善指路，可到服务台复核与申诉。',buttons:[b('返回体验','return'),b('前往服务台','service',true)]};
 case 'help':return {act:0,title:'用身体理解一条规则',body:'电脑拖动转头，WASD行走，点击实体。\n手机拖动视角，方向按钮行走。\n头显扳机点中文面板与地面光圈传送，摇杆左右转向30°。退出头显保留进度。',buttons:[b('返回体验','return')]};
 case 'next':return {act:3,title:`下一位访客 · 现场 v${state.active.version}`,body:`已从校门重新出发。现在实际使用${state.active.layout==='side'?'侧廊签到与原位置箭头':'门前签到'}。\n${state.active.layout==='side'?'这次修改已正式生效。访客多走 2 格，学生通道保持畅通。':'意见尚未发布或已跳过反馈，现场继续执行 v1。'}公共路线一直开放。`,buttons:[b('按现场路线走到展馆','follow-route'),b('查看决策记录与回执','records',true),b('回看本次推演与课程结论','course-review'),b('查看服务台制度','service',true),b('重置课堂演示','reset',true)]};
 default:return {act:1,title:'开放日',body:'请选择岗亭公告板上的规则。',buttons:[b('返回岗亭','start')]};
 }
}
function statusName(s?:string){return ({submitted:'待审核',held:'暂缓，见原因',ready:'双方通过，待发布',published:'已发布'} as any)[s||'']||'未提交'}
function reviewName(r:any){return !r?'未确认':r.decision==='approved'?'已通过':`暂缓：${r.reason}`}
function update(){document.body.classList.toggle('experience-started',state.started);document.body.classList.toggle('course-view',stage.startsWith('course'));const p=panel(),g=guidance();document.querySelector('#panel-title')!.textContent=p.title;document.querySelector('#panel-body')!.textContent=p.body;document.querySelector('#actline')!.textContent=['课程原型 / 情境入口','情境任务一 / 比较参与机会','情境任务二 / 观察通行冲突','情境任务三 / 检验共建反馈'][p.act];document.querySelector('#actions')!.replaceChildren(...p.buttons.map(b=>{const el=document.createElement('button');el.textContent=b.label;el.dataset.action=b.action;if(b.tone==='muted')el.className='muted';return el}));document.querySelectorAll('header nav [data-action]').forEach(el=>el.classList.toggle('active',el.getAttribute('data-action')===`course:${stage.replace('course-','')}`));
 if(campus){campus.setLayout(state.preview,state.preview===state.active.layout&&state.active.arrow);campus.setAllocation?.(allocate(state.policy||'A'));drawWorldPanel(worldPanel,p.title,p.body,p.buttons,g);}
 const preview=state.preview!==state.active.layout;document.querySelector('#version-label')!.textContent=`现场 v${state.active.version} · ${preview?'临时试摆 / ':''}${state.preview==='side'?'侧廊':'门前'}签到`;
 renderGuidance(g);const guideKey=`${g.goal}:${g.action}`;if(guideKey!==renderedGuidance)document.querySelector('.sidebar')!.scrollTop=0;renderedGuidance=guideKey;if(stage.startsWith('course')){const sidebar=document.querySelector('.sidebar')!,content=document.querySelector('.panel')!;sidebar.scrollTop+=content.getBoundingClientRect().top-sidebar.getBoundingClientRect().top-18;}drawMap();save();
}
function drawMap(){const side=state.preview==='side';const path=LAYOUTS[state.preview].path.map(([x,y])=>`${16+(x-1)*18},${51+(y-4)*16}`).join(' ');document.querySelector('#minimap')!.innerHTML=`<svg viewBox="0 0 140 88" role="img" aria-label="9乘7课程格网"><defs><pattern id="g" width="18" height="16" patternUnits="userSpaceOnUse"><path d="M18 0H0V16" fill="none" stroke="#b8cfc2" stroke-width=".5"/></pattern></defs><rect width="140" height="88" fill="url(#g)"/><path d="M16 20H124" stroke="#e3a175" stroke-width="7" opacity=".65"/><polyline points="${path}" fill="none" stroke="#438f70" stroke-width="4"/><circle cx="16" cy="51" r="4" fill="#173e36"/><rect x="118" y="44" width="12" height="14" fill="#173e36"/><circle cx="${side?70:88}" cy="${side?67:51}" r="6" fill="#e27951"/></svg><small>公共路线 / 学生通道</small>`;}
function drawer(title:string,content:string){document.querySelector('.drawer')?.remove();const d=document.createElement('div');d.className='drawer';d.setAttribute('role','dialog');d.setAttribute('aria-modal','true');d.setAttribute('aria-label',title);d.innerHTML=`<button data-action="close">关闭</button><h2>${title}</h2>${content}`;app.append(d);(d.querySelector('button') as HTMLButtonElement).focus();}
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function allocationDrawer(){const target=state.policy==='A'?'B':'A';const diff=compare(state.policy||'A',target);drawer('每一个编号，都有一张结果卡',`<p>规则 ${state.policy} 与 ${target} 比较：${diff.gained.length} 人新获得、${diff.lost.length} 人失去、${diff.same.length} 人结果相同。两种规则均发放 12 席，加学生 8 席，20 工位全满。</p><table><tr><th>申请人</th><th>结果</th><th>原因</th></tr>${allocate(state.policy||'A').map(r=>`<tr><td>${r.id}</td><td>${r.admitted?'可参加':'公共参观'}</td><td>${esc(r.reason)}</td></tr>`).join('')}</table>`)}
function records(){drawer('可回看的决定',`<p>同一身份：${state.identity||'尚未揭晓'}。所有人物均为虚构；每条记录说明影响了谁、结果和原因。</p>${state.logs.map(l=>`<p><b>${esc(l.action)}</b> · ${esc(l.who.join('、'))}<br>${esc(l.result)}<br>原因：${esc(l.reason)}</p>`).join('')||'<p>还没有决定。请从公告板开始。</p>'}<h3>本地回执</h3>${state.receipts.map(r=>`<p>${esc(r.id)} · ${statusName(r.status)}<br>${esc(r.suggestion)}<br>学生：${esc(reviewName(r.reviews.student))}<br>值守：${esc(reviewName(r.reviews.staff))}</p>`).join('')}`)}
async function dispatch(action:string){try{
 if(action==='course'||action.startsWith('course:')){if(!stage.startsWith('course'))courseReturnStage=stage==='step-help'?helpReturnStage:stage;const target=action.split(':')[1];if(target==='back'||target==='resume'){stage=courseReturnStage;}else{stage=target?`course-${target}`:'course';}worldPanel.object3D.visible=true;poseBoard();update();return;}
 if(action==='course-review'||action==='course-review:next'){if(!stage.startsWith('course'))courseReturnStage=stage;stage='course-review';reviewIndex=action.endsWith(':next')?reviewIndex+1:0;worldPanel.object3D.visible=true;update();return;}
 if(action.startsWith('rules:')){const sub=action.split(':')[1];if(sub==='case'){rulesState=chooseRuleCase(rulesState,action.split(':')[2] as RuleCase);ruleView='result';}else if(sub==='uphold'||sub==='correct'){rulesState=reviewRuleCase(rulesState,sub);ruleView='result';}else if(sub==='appeal'){rulesState=appealRuleCase(rulesState);ruleView='result';}else if(sub==='choose'){rulesState=resetRuleSelection(rulesState);ruleView='result';}else if(sub==='directions'){walkTo('hall');toast('先说明边界，再指向公共参观路线；初次误入不自动限入。');}else ruleView=sub;stage='course-rules';update();return;}
 if(action.startsWith('resources:')){const sub=action.split(':')[1];if(sub==='next'){resourceIndex=(resourceIndex+1)%RESOURCE_ITEMS.length;resourceView='offer';}else if(sub==='detail')resourceView=resourceView==='cost'?'offer':'cost';else if(sub==='confirm')resourcePlan=confirmResourceParty(resourcePlan,action.split(':')[2] as ResourceParty);else if(sub==='reset')resourcePlan=initialResourcePlan();stage='course-resources';update();return;}
 if(action==='guide-help'){if(stage!=='step-help'){helpContext=guidance();helpReturnStage=stage;}stage='step-help';worldPanel.object3D.visible=true;poseBoard();document.querySelector('.sidebar')!.scrollTop=0;update();return;}
 if(action==='close-guide'){stage=helpReturnStage;helpContext=null;update();return;}
 if(action==='toggle-board'){worldPanel.object3D.visible=!worldPanel.object3D.visible;return;}
 if(action==='close'){document.querySelector('.drawer')?.remove();return;}
 if(action==='start'){state={...state,started:true};stage='policy';walkTo('gate');}
 else if(action.startsWith('policy:')){state=executePolicy(state,action.endsWith('A')?'A':'B');stage='reveal';}
 else if(action==='claim'){state=claimCard(state);stage='card';toast(`${state.identity} 已领取结果卡`);}
 else if(action==='switch-policy'){const before=state.policy||'A';state=executePolicy(state,before==='A'?'B':'A');state=claimCard(state);const d=compare(before,state.policy!);stage='card';toast(`规则已切换：${d.gained.length} 人新获得 / ${d.lost.length} 人失去 / ${d.same.length} 人结果相同`);}
 else if(action==='visit-hall'){walkTo('hall');stage='replay';startReplay();}
 else if(action==='replay'){startReplay();toast(`相同顺序重新到达：O01 → O02 → S01，${state.preview==='front'?'学生将在队尾停步':'学生顺利通过，访客绕行侧廊'}`);}
 else if(action==='select-desk'){selected=true;stage='replay';worldPanel.object3D.visible=true;poseBoard();toast('已选中签到桌，请点侧廊落点');}
 else if(action.startsWith('layout:')){if(!selected){toast('请先选中签到桌');return;}state=previewLayout(state,action.split(':')[1] as Layout);replayPlaying=false;campus.setLayout(state.preview);toast('临时试摆已更新桌子、队列、方向牌和路线；尚未发布');}
 else if(action==='go:service'){returnStage=stage;walkTo('service');stage='service';}
 else if(action.startsWith('go:')){const p=action.split(':')[1];walkTo(p as any);if(p==='hall'&&state.cardClaimed&&stage==='card')stage='replay';}
 else if(action.startsWith('teleport:')){const [,x,z]=action.split(':').map(Number);teleport(x,z);poseBoard();return;}
 else if(action==='feedback'){walkTo('service');stage='feedback';}
 else if(action==='back-replay'){stage='replay';walkTo('hall');}
 else if(action.startsWith('submit:')){state=submitFeedback(state,action.endsWith('paper')?'paper':'electronic');stage='review';role='visitor';toast(`本地回执：${latest()?.id}`);}
 else if(action.startsWith('role:')){role=action.split(':')[1] as any;stage='review';}
 else if(action==='approve'||action==='hold'){if(role==='visitor')throw Error('请先切换审核角色');const reason=action==='hold'?(role==='student'?'尚未确认课间连续通行，请补充观察':'侧廊引导员与箭头尚未到位，请落实值守'):undefined;state=reviewFeedback(state,role,action==='approve'?'approved':'held',reason);role='visitor';}
 else if(action==='publish'){state=publishFeedback(state);toast(`新版本 v${state.published.version} 已发布，下一位访客将使用新版`);}
 else if(action==='next'){state=nextVisitor(state);stage='next';arrived=false;selected=false;walkTo('gate');}
 else if(action==='follow-route'){followRoute();return;}
 else if(action==='allocation'){returnStage=stage;stage='allocation';pageIndex=0;}
 else if(action==='allocation-table'){allocationDrawer();return;}
 else if(action==='page:next'||action==='page:prev'){const n=stage==='allocation'?16:Math.max(1,state.logs.length);pageIndex=(pageIndex+(action==='page:next'?1:-1)+n)%n;}
 else if(action==='return'){stage=returnStage;}
 else if(action==='case'){stage='case';}
 else if(action==='back-service'){stage='service';}
 else if(action==='back-review'){stage='review';}
 else if(action==='records'){returnStage=stage;stage='history';pageIndex=0;}
 else if(action==='records-table'){records();return;}
 else if(action==='receipt'){stage='receipt';}
 else if(action==='receipt-query'){drawer('查询本地回执',`<p>回执仅保存在本浏览器，无需真实个人资料。</p><input id="receipt-id" aria-label="回执号" placeholder="输入回执号" value="${esc(latest()?.id||'')}"><button data-action="query">查询回执</button><div id="receipt-result"></div>`);return;}
 else if(action==='query'){const r=queryReceipt(state,(document.querySelector('#receipt-id') as HTMLInputElement).value);document.querySelector('#receipt-result')!.textContent=r?`${r.id}：${statusName(r.status)}。学生 ${reviewName(r.reviews.student)}；工作人员 ${reviewName(r.reviews.staff)}`:'未找到此回执';return;}
 else if(action==='service'||action==='go:service'){returnStage=stage;walkTo('service');stage='service';}
 else if(action==='service-table'){serviceDrawer();return;}
 else if(action==='detail:public'){returnStage=stage;stage='info-public';}
 else if(action==='detail:restriction'){returnStage=stage;stage='info-restriction';}
 else if(action==='help'){returnStage=stage;stage='help';}
 else if(action==='reset'){state=initialState();stage='welcome';role='visitor';selected=false;rulesState=initialRules();resourcePlan=initialResourcePlan();observed.clear();replayPlaying=false;walking=false;arrived=false;walkTo('gate');}
 else if(action==='enter-xr'){if(!xrSupported){toast(xrMessage);return;}try{await scene.enterVR()}catch{toast('未能进入头显，已继续桌面体验。角色与进度已保留。')}return;}
 update();
 }catch(e){toast(e instanceof Error?e.message:String(e));}}
function serviceDrawer(){drawer('服务台 · 开放，也需要相互支持',`<h3>周六共同值班表（课程提案）</h3><table><tr><th>提供方</th><th>岗位 / 活动 / 资源</th><th>时段或状态</th></tr><tr><td>学校</td><td>纸桥工作坊、公共作品展；教师与场地</td><td>09:00–12:00</td></tr><tr><td>社区</td><td>校门引导 1 人、侧廊签到 1 人</td><td>08:45–10:30 / 10:30–12:15 轮班</td></tr><tr><td>城市</td><td>回馈学生的博物馆研学券、公交实践支持</td><td>拟议资源，待合作方确认</td></tr></table><h3>两校共享匿名案例 C-01</h3><p>一名首次来访者沿公共路线误入需预约的工作坊。工作人员先说明工位限制、指向公共展台与服务台，不记录姓名、照片或身份号码。共享内容只有“误入位置、指路措辞、处理步骤”。</p><p>本校服务台依据当轮名单与规则复核结果卡；来访者可提交纸卡或电子申诉，取得本地回执。学生代表核对通行，工作人员核对值守；暂缓需写明原因，再次审核保留记录。另一学校可复用流程，由其本校独立复核，不交换个人名单。</p><button data-action="feedback">提交改进意见</button>`)}
// Re-center a tracked headset without discarding its current physical offset.
function teleport(x:number,z:number){const T=(window as any).AFRAME.THREE;const head=new T.Vector3();camera.object3D.getWorldPosition(head);rig.object3D.position.x+=x-head.x;rig.object3D.position.z+=z-head.z;}
async function followRoute(){const token=++routeToken;walking=true;arrived=false;update();const path=LAYOUTS[state.active.layout].path;worldPanel.object3D.visible=false;toast('按正式现场路线步行：可观察原签到点的箭头');for(const [x,y] of path){if(token!==routeToken)return;teleport((x-4)*2.4,(y-3)*2.4);await new Promise(r=>setTimeout(r,650));}walking=false;arrived=true;worldPanel.object3D.visible=true;poseBoard();update();toast(`已抵达展馆，沿用现场 v${state.active.version}，共走 ${metrics(state.active.layout).steps} 格`);}
document.addEventListener('click',e=>{const el=(e.target as HTMLElement).closest<HTMLElement>('[data-action]');if(el&&!el.hasAttribute('campus-action'))void dispatch(el.dataset.action!)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('.drawer')?.remove();if(e.code==='KeyM'&&!(e.target instanceof HTMLInputElement))void dispatch('toggle-board')});
document.querySelectorAll<HTMLButtonElement>('[data-move]').forEach(btn=>{const [axis,value]=btn.dataset.move!.split(':');const clear=()=>{(window as any).campusMove[axis]=0;};btn.addEventListener('pointerdown',e=>{btn.setPointerCapture(e.pointerId);(window as any).campusMove[axis]=Number(value)});btn.addEventListener('pointerup',clear);btn.addEventListener('pointercancel',clear)});
for(const hand of document.querySelectorAll('#left-hand,#right-hand'))hand.addEventListener('gripdown',()=>void dispatch('toggle-board'));
async function detectXR(){if(!isSecureContext)xrMessage='当前不是安全上下文，继续桌面体验；头显需可信 HTTPS。';else if(!navigator.xr)xrMessage='此浏览器未提供 WebXR，桌面与触控体验可用。';else try{xrSupported=await navigator.xr.isSessionSupported('immersive-vr');xrMessage=xrSupported?'头显可用，点击进入；退出后保留进度。':'未检测到 immersive-vr 设备，继续桌面体验。'}catch{xrMessage='头显检测未获许可，继续桌面体验。'}document.querySelector('#xr')!.textContent=xrSupported?'进入头显':'桌面模式';document.querySelector('#xr-status')!.textContent=xrMessage;}
scene.addEventListener('enter-vr',()=>document.body.classList.add('xr-mode'));
scene.addEventListener('exit-vr',()=>{document.body.classList.remove('xr-mode');save();});
async function init(){try{await document.fonts.load('40px Campus')}catch{console.error('本地中文字体加载失败，请检查 assets/NotoSansSC-Regular.otf')} campus=buildCampus(scene);walkTo('gate');
 // Fixed teleport targets share the exact course grid.
 for(const [x,y] of [[1,4],[3,4],[5,4],[7,4],[1,2],[4,5],[2,5]]){const pad=document.createElement('a-cylinder');pad.setAttribute('position',`${(x-4)*2.4} .035 ${(y-3)*2.4}`);pad.setAttribute('radius','.36');pad.setAttribute('height','.035');pad.setAttribute('material','color: #64ba98; opacity: .7');pad.classList.add('interactable');pad.setAttribute('campus-action',`teleport:${(x-4)*2.4}:${(y-3)*2.4}`);scene.append(pad);}
 update();void detectXR();let prev=0;function frame(t:number){campus.tick(t,prev?t-prev:16);prev=t;requestAnimationFrame(frame)}requestAnimationFrame(frame);
 (window as any).__campus={get state(){return state},get stage(){return stage},dispatch,get panel(){return panel()},get scene(){return campus}};
}
if(scene.hasLoaded)void init();else scene.addEventListener('loaded',()=>void init(),{once:true});
