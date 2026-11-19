import {test,expect,type Page} from '@playwright/test';
async function ready(page:Page){await page.goto('/');await page.waitForFunction(()=>(window as any).__campus);await page.waitForTimeout(700);}
async function state(page:Page){return page.evaluate(()=>(window as any).__campus.state)}
async function action(page:Page,name:string){await page.locator(`#actions [data-action="${name}"]`).click();}
async function worldClick(page:Page,name:string){const p=await page.evaluate((name)=>{const el=document.querySelector(`#world-panel [data-action="${name}"]`) as any;const scene=document.querySelector('a-scene') as any;scene.object3D.updateMatrixWorld(true);const v=new (window as any).AFRAME.THREE.Vector3();el.object3D.getWorldPosition(v);v.project(scene.camera);const r=scene.canvas.getBoundingClientRect();return {x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2}},name);expect(p.x).toBeGreaterThan(380);await page.mouse.move(p.x,p.y);await page.waitForTimeout(180);await page.mouse.down();await page.waitForTimeout(60);await page.mouse.up();}
async function start(page:Page,policy='A'){await ready(page);await action(page,'start');await action(page,`policy:${policy}`);await action(page,'claim');}

test('桌面真实三维点选，固定身份切换规则，完整双审发布与下一访客',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const external:string[]=[];
 await page.route('**/*',route=>{if(!new URL(route.request().url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)){external.push(route.request().url());return route.abort()}return route.continue()});
 await ready(page);await expect(page.locator('#guide-goal')).toContainText('四分钟');await worldClick(page,'start');await expect(page.locator('#guide-role')).toContainText('老师');await expect(page.locator('#panel-title')).toContainText('先定规则');
 await worldClick(page,'policy:A');await expect(page.locator('#guide-next')).toContainText('领取结果卡');expect((await state(page)).policy).toBe('A');await worldClick(page,'claim');const first=await state(page);
 await action(page,'switch-policy');const second=await state(page);expect(second.identity).toBe(first.identity);expect(second.policy).toBe('B');
 expect(await page.locator('#allocation-crowd [data-destination="hall"]').count()).toBe(10);expect(await page.locator('#allocation-crowd [data-destination="public-exhibit"]').count()).toBe(4);
 await action(page,'visit-hall');await action(page,'select-desk');await worldClick(page,'layout:side');let s=await state(page);expect(s.preview).toBe('side');expect(s.published.layout).toBe('front');
 expect(await page.locator('#desk').evaluate((e:any)=>e.object3D.position.toArray())).toEqual([0,0,4.8]);
 await action(page,'feedback');await action(page,'submit:electronic');await action(page,'role:student');await worldClick(page,'approve');await expect(page.locator('#guide-continue')).toHaveAttribute('data-action','role:staff');
 await action(page,'publish');expect((await state(page)).published.version).toBe(1);
 await action(page,'role:staff');await worldClick(page,'approve');await expect(page.locator('#guide-continue')).toHaveAttribute('data-action','publish');await worldClick(page,'publish');await expect(page.locator('#guide-continue')).toHaveAttribute('data-action','next');expect((await state(page)).published.version).toBe(2);
 await action(page,'receipt');await expect(page.locator('#panel-body')).toContainText('已发布');await action(page,'back-review');await action(page,'next');s=await state(page);expect(s.active).toEqual({version:2,layout:'side',arrow:true});
 expect(await page.locator('#published-arrow').evaluate((e:any)=>e.object3D.visible)).toBe(true);
 await page.reload();await page.waitForFunction(()=>(window as any).__campus);expect((await state(page)).active.version).toBe(2);expect((await state(page)).identity).toBe(first.identity);
 await action(page,'follow-route');await page.waitForTimeout(6500);expect(await page.locator('#rig').evaluate((e:any)=>e.object3D.position.x)).toBeCloseTo(7.2);
 await page.screenshot({path:'docs/published.png'});expect(errors).toEqual([]);expect(external).toEqual([]);
});

test('相同时间轴两种摆位，学生停步与通过；试摆不会成为下一访客现场',async({page})=>{
 await start(page,'B');await action(page,'visit-hall');await action(page,'replay');await page.waitForTimeout(10000);
 const x1=await page.locator('[data-person="S01 学生"]').evaluate((e:any)=>e.object3D.position.x);await page.waitForTimeout(1000);const x2=await page.locator('[data-person="S01 学生"]').evaluate((e:any)=>e.object3D.position.x);expect(x1).toBeCloseTo(1.32,1);expect(x2).toBeCloseTo(x1,1);await expect(page.locator('#guide-goal')).toContainText('正在重放');await page.waitForTimeout(6500);await expect(page.locator('#guide-continue')).toHaveAttribute('data-action','select-desk');
 await action(page,'select-desk');await action(page,'layout:side');await action(page,'replay');await page.waitForTimeout(11500);await expect.poll(()=>page.locator('[data-person="S01 学生"]').evaluate((e:any)=>e.object3D.position.x),{timeout:3000}).toBeCloseTo(7.2);
 await page.screenshot({path:'docs/replay-side.png'});await action(page,'feedback');await action(page,'next');const s=await state(page);expect(s.preview).toBe('front');expect(s.active.version).toBe(1);expect(await page.locator('#desk').evaluate((e:any)=>e.object3D.position.toArray())).toEqual([2.4,0,2.4]);
});

test('纸卡暂缓有原因，回执查询可用，刷新损坏恢复初始',async({page})=>{
 await start(page,'B');await action(page,'visit-hall');await action(page,'feedback');await action(page,'submit:paper');const id=(await state(page)).receipts[0].id;
 await action(page,'role:student');await action(page,'hold');await action(page,'publish');expect((await state(page)).published.version).toBe(1);await action(page,'receipt');await expect(page.locator('#panel-body')).toContainText('课间连续通行');await action(page,'receipt-query');await page.locator('[data-action="query"]').click();await expect(page.locator('#receipt-result')).toContainText(id);await page.locator('[data-action="close"]').click();
 await page.reload();await page.waitForFunction(()=>(window as any).__campus);expect((await state(page)).receipts[0].reviews.student.decision).toBe('held');
 await page.evaluate(()=>localStorage.setItem('saturday-campus-v1','{"domain":"broken","stage":"next"}'));await page.reload();await page.waitForFunction(()=>(window as any).__campus);await expect(page.locator('#panel-title')).toContainText('周六，欢迎');
});

test('XR不可用和非安全上下文继续桌面并保留身份',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(navigator,'xr',{value:{isSessionSupported:async()=>false,addEventListener(){},removeEventListener(){}}})});await start(page);const before=await state(page);await page.locator('#xr').click();expect((await state(page)).identity).toBe(before.identity);await expect(page.locator('#xr-status')).toContainText('未检测到');
 await page.addInitScript(()=>Object.defineProperty(window,'isSecureContext',{value:false}));await page.reload();await page.waitForFunction(()=>(window as any).__campus);await expect(page.locator('#xr-status')).toContainText('安全上下文');
});

test('模拟XR控制器扳机选择同一三维公告板、脚点传送和30度转向',async({page})=>{
 await ready(page);
 await page.evaluate(()=>{const scene=document.querySelector('a-scene') as any;const hand=document.querySelector('#right-hand') as any;const target=document.querySelector('#world-panel [data-action="start"]') as any;const T=(window as any).AFRAME.THREE;const dest=new T.Vector3();target.object3D.getWorldPosition(dest);hand.object3D.position.set(0,1.65,0);hand.object3D.lookAt(dest);hand.object3D.rotateY(Math.PI);hand.emit('controllerconnected',{name:'generic-tracked-controller-controls'});hand.setAttribute('raycaster','direction','0 0 -1');hand.components.raycaster.refreshObjects();});
 await page.waitForTimeout(500);
 await page.evaluate(()=>{const hand=document.querySelector('#right-hand') as any;hand.emit('triggerdown');hand.emit('triggerup')});
 await expect(page.locator('#panel-title')).toContainText('先定规则');
 const result=await page.evaluate(()=>{const scene=document.querySelector('a-scene') as any,rig=document.querySelector('#rig') as any,camera=document.querySelector('#camera') as any,T=(window as any).AFRAME.THREE;const original=scene.is.bind(scene),getSession=scene.renderer.xr.getSession.bind(scene.renderer.xr);scene.is=(name:string)=>name==='vr-mode'?true:original(name);scene.renderer.xr.getSession=()=>({inputSources:[{gamepad:{axes:[0,0,1,0]}}]});camera.object3D.position.x=.6;const before=new T.Vector3();camera.object3D.getWorldPosition(before);const yaw=rig.object3D.rotation.y;rig.components['xr-campus'].tick(1000);const after=new T.Vector3();camera.object3D.getWorldPosition(after);const snapped=rig.object3D.rotation.y-yaw;(window as any).__campus.scene.go('gate');const landed=new T.Vector3();camera.object3D.getWorldPosition(landed);scene.is=original;scene.renderer.xr.getSession=getSession;return {delta:snapped,before:before.toArray(),after:after.toArray(),landed:landed.toArray()}});
 expect(result.delta).toBeCloseTo(-Math.PI/6);expect(result.before[0]).toBeCloseTo(result.after[0]);expect(result.before[2]).toBeCloseTo(result.after[2]);expect(result.landed[0]).toBeCloseTo(-7.2);expect(result.landed[2]).toBeCloseTo(2.4);
});

test('手机触控模拟：拖动、方向行走和点选，布局无横向溢出',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const page=await context.newPage();await ready(page);await page.locator('#actions [data-action="start"]').tap();await page.locator('#actions [data-action="policy:B"]').tap();await page.locator('#actions [data-action="claim"]').tap();
 await expect(page.locator('#guide-role')).toBeInViewport();const initial=await page.locator('#rig').evaluate((e:any)=>e.object3D.position.x);const cdp=await context.newCDPSession(page);const r=await page.locator('[data-move="forward:1"]').boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r!.x+20,y:r!.y+20}]});await page.waitForTimeout(400);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});expect(await page.locator('#rig').evaluate((e:any)=>e.object3D.position.x)).toBeGreaterThan(initial);
 const yaw=await page.locator('#camera').evaluate((e:any)=>e.object3D.rotation.y);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:100,y:260}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:240,y:270}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(100);expect(await page.locator('#camera').evaluate((e:any)=>e.object3D.rotation.y)).not.toBe(yaw);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);await page.screenshot({path:'docs/mobile.png'});await context.close();
});


test('模拟用户拒绝头显请求与退出事件，角色和进度保持',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'xr',{value:{isSessionSupported:async()=>true,addEventListener(){},removeEventListener(){}}}));await start(page,'B');const before=await state(page);
 await page.evaluate(()=>{(document.querySelector('a-scene') as any).enterVR=()=>Promise.reject(new Error('NotAllowedError'))});await page.locator('#xr').click();await expect(page.locator('#toast')).toContainText('继续桌面体验');expect((await state(page)).identity).toBe(before.identity);
 await page.evaluate(()=>{const scene=document.querySelector('a-scene') as any;scene.emit('enter-vr');scene.emit('exit-vr')});expect(await page.locator('body').getAttribute('class')).not.toContain('xr-mode');expect((await state(page)).policy).toBe('B');
});


test('任务卡与随时求助：沿推荐动作推进，帮助返回保留角色与进度',async({page})=>{
 await ready(page);await page.locator('#guide-continue').click();await expect(page.locator('#guide-goal')).toContainText('12 个公众名额');await expect(page.locator('#guide-continue')).toBeHidden();
 await page.locator('header [data-action="guide-help"]').click();await expect(page.locator('#panel-title')).toContainText('这一步怎么做');await expect(page.locator('#panel-body')).toContainText('A 全给线上');expect(await page.locator('#world-panel [data-action="close-guide"]').count()).toBe(1);
 await action(page,'close-guide');await action(page,'policy:B');await page.locator('#guide-continue').click();const identity=(await state(page)).identity;
 await expect(page.locator('#guide-continue')).toHaveAttribute('data-action','switch-policy');await page.locator('#guide-continue').click();expect((await state(page)).identity).toBe(identity);await expect(page.locator('#guide-continue')).toHaveAttribute('data-action','visit-hall');
 await page.locator('#guide-continue').click();await expect(page.locator('#guide-goal')).toContainText('正在重放');await page.locator('header [data-action="guide-help"]').click();await expect(page.locator('#panel-body')).toContainText('蓝衣学生');await page.reload();await page.waitForFunction(()=>(window as any).__campus);await expect(page.locator('#guide-role')).toContainText('现场观察员');expect((await state(page)).identity).toBe(identity);
});


test('课程对应：三项原报告创新有独立入口，误入处理可复核更正',async({page})=>{
 await ready(page);await expect(page.locator('.course-anchor')).toContainText('大学校园开放制度的创新设计');await action(page,'course');await expect(page.locator('#panel-body')).toContainText('保护教学');await expect(page.locator('#actions')).toContainText('校际规则协作');await expect(page.locator('#actions')).toContainText('大学与城市资源互惠');await expect(page.locator('#actions')).toContainText('游客参与校园共建');
 await worldClick(page,'course:rules');await expect(page.locator('#panel-title')).toContainText('创新一');await action(page,'rules:case:first');await expect(page.locator('#panel-body')).toContainText('不限制');await expect(page.locator('#world-panel')).toHaveAttribute('data-body-fits','true');
 await action(page,'rules:choose');await action(page,'rules:case:repeat');await expect(page.locator('#panel-body')).toContainText('尚未限制');await action(page,'rules:evidence');await expect(page.locator('#panel-body')).toContainText('是否相称');await expect(page.locator('#world-panel')).toHaveAttribute('data-body-fits','true');await action(page,'rules:result');await action(page,'rules:uphold');await action(page,'rules:notice');await expect(page.locator('#panel-body')).toContainText('12:00');await expect(page.locator('#panel-body')).toContainText('申诉');await expect(page.locator('#world-panel')).toHaveAttribute('data-body-fits','true');
 await action(page,'rules:appeal');await action(page,'rules:correct');await expect(page.locator('#panel-body')).toContainText('撤销');await page.reload();await page.waitForFunction(()=>(window as any).__campus);await expect(page.locator('#panel-title')).toContainText('更正');await action(page,'rules:shared');await expect(page.locator('#panel-body')).toContainText('匿名');await expect(page.locator('#panel-body')).toContainText('仍待论证');await page.screenshot({path:'docs/course-rules.png'});
});

test('互惠清单显示成本与责任，确认仍属拟议，并可回到共建情境',async({page})=>{
 await ready(page);await page.locator('header [data-action="course:resources"]').click();await expect(page.locator('#panel-title')).toContainText('创新二');await expect(page.locator('#panel-body')).toContainText('20人');await action(page,'resources:detail');await expect(page.locator('#panel-body')).toContainText('成本承担');await expect(page.locator('#panel-body')).toContainText('师生');await expect(page.locator('#world-panel')).toHaveAttribute('data-body-fits','true');
 await action(page,'resources:confirm:school');await action(page,'resources:confirm:city');await action(page,'resources:confirm:community');await expect(page.locator('#panel-body')).toContainText('真实合作仍待确认');await page.reload();await page.waitForFunction(()=>(window as any).__campus);await expect(page.locator('#panel-body')).toContainText('真实合作仍待确认');await action(page,'resources:next');await expect(page.locator('#panel-body')).toContainText('本校学生');await expect(page.locator('#panel-body')).toContainText('20个名额');await page.screenshot({path:'docs/course-resources.png'});
 await action(page,'course');await action(page,'course:participation');await expect(page.locator('#panel-body')).toContainText('自愿');await expect(page.locator('#panel-body')).toContainText('共同评审');await expect(page.locator('#panel-body')).toContainText('不替代');await action(page,'start');await action(page,'policy:A');await action(page,'claim');await expect(page.locator('#course-topic')).toContainText('公平');await expect(page.locator('#course-evidence')).toContainText('规则A');const before=await state(page);await page.locator('.course-anchor').click();await page.reload();await page.waitForFunction(()=>(window as any).__campus);await action(page,'course:resume');await expect(page.locator('#panel-title')).toContainText(before.identity);expect((await state(page)).identity).toBe(before.identity);
});
