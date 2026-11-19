import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '@playwright/test';
const root=path.resolve('video');
const narrationScale=process.env.CAMPUS_VIDEO_DRY_RUN==='1'?.005:1;
const segments=JSON.parse(await fs.readFile(path.join(root,'assets/voice-manifest.json'),'utf8'));
await fs.mkdir(path.join(root,'work/raw'),{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal','--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1920,height:900},deviceScaleFactor:1,recordVideo:{dir:path.join(root,'work/raw'),size:{width:1920,height:900}}});
// Reproducible demonstration identity; Three.js still receives normal randomness.
await context.addInitScript(()=>{const original=Math.random;Math.random=function(){return new Error().stack?.includes('executePolicy')?0:original()}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){await page.waitForFunction(()=>window.__campus);await page.waitForTimeout(600);}
async function dress(){
 await page.addStyleTag({content:`.layout{grid-template-columns:470px 1fr!important}.sidebar{padding:24px 28px!important}.panel h2{font-size:28px!important}.panel p{font-size:19px!important;line-height:1.85!important}.actions button{font-size:16px!important;padding:13px 16px!important}.guide-card{position:relative!important}.guide-card p{font-size:16px!important}.guide-card h2{font-size:21px!important}.drawer{font-size:18px!important}.drawer p,.drawer table{font-size:18px!important}.brand strong{font-size:21px!important}.scene-bottom .hint{font-size:13px!important}#film-pointer{position:fixed;left:0;top:0;z-index:999999;pointer-events:none;width:28px;height:28px;border-radius:50%;border:2px solid #ffd56c;box-shadow:0 0 0 5px #ffd56c22;transform:translate(-100px,-100px)}#film-pointer:after{content:'';position:absolute;left:10px;top:10px;background:#ffd56c;border-radius:50%;width:4px;height:4px}#film-pointer.down{background:#ffd56c66;box-shadow:0 0 0 12px #ffd56c33}`});
 await page.evaluate(()=>{document.querySelector('#film-pointer')?.remove();const c=document.createElement('div');c.id='film-pointer';document.body.append(c);document.addEventListener('mousemove',e=>c.style.transform=`translate(${e.clientX-14}px,${e.clientY-14}px)`);document.addEventListener('mousedown',()=>c.classList.add('down'));document.addEventListener('mouseup',()=>c.classList.remove('down'));});
}
async function focusPanel(){await page.evaluate(()=>{const side=document.querySelector('.sidebar'),panel=document.querySelector('.panel');side.scrollTop+=panel.getBoundingClientRect().top-side.getBoundingClientRect().top-18});}
async function focusGuide(){await page.evaluate(()=>{const side=document.querySelector('.sidebar'),g=document.querySelector('.guide-card');side.scrollTop+=g.getBoundingClientRect().top-side.getBoundingClientRect().top-18});}
async function clickSelector(selector){const el=page.locator(selector).first();await el.waitFor({state:'visible'});await el.scrollIntoViewIfNeeded();const b=await el.boundingBox();if(!b)throw Error(`Missing clickable ${selector}`);await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5,{steps:12});await sleep(180);await el.evaluate(e=>{e.style.outline='3px solid #ffbf70';setTimeout(()=>e.style.outline='',900)});await page.mouse.down();await sleep(75);await page.mouse.up();await sleep(200);}
async function click(action){await clickSelector(`#actions [data-action="${action}"]`);}
async function shortcut(action){await clickSelector(`.hotspots [data-action="${action}"]`);}
async function top(action){await clickSelector(`header [data-action="${action}"]`);}
async function world(selector){await page.waitForTimeout(250);const p=await page.evaluate(selector=>{const el=document.querySelector(selector),scene=document.querySelector('a-scene');scene.object3D.updateMatrixWorld(true);const v=new AFRAME.THREE.Vector3();el.object3D.getWorldPosition(v);v.project(scene.camera);const r=scene.canvas.getBoundingClientRect();return{x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2,z:v.z}},selector);if(p.x<470||p.x>1915||p.y<90||p.y>895)throw Error(`3D target outside view ${selector}: ${JSON.stringify(p)}`);await page.mouse.move(p.x,p.y,{steps:18});await sleep(250);await page.mouse.down();await sleep(90);await page.mouse.up();await sleep(300);}
async function worldAction(action){await world(`#world-panel [data-action="${action}"]`);}
async function board(visible){const current=await page.locator('#world-panel').evaluate(e=>e.object3D.visible);if(current!==visible){await page.keyboard.press('KeyM');await sleep(180)}}
async function studentView(){await shortcut('go:student');await page.keyboard.down('KeyA');await sleep(330);await page.keyboard.up('KeyA');await board(false);}
async function queueView(){await shortcut('go:queue');await page.keyboard.down('KeyD');await sleep(330);await page.keyboard.up('KeyD');await board(false);}
async function assertState(fn,message){const ok=await page.evaluate(fn);if(!ok)throw Error(`Recording state check failed: ${message}`);}
await page.goto('http://localhost:5173/');await ready();await dress();await page.waitForTimeout(600);
// This magenta leader is trimmed using its actual decoded video-frame boundary.
await page.evaluate(()=>{const m=document.createElement('div');m.id='film-start-marker';m.style.cssText='position:fixed;inset:0;background:#ff00ff;z-index:2147483647';document.body.append(m)});
await sleep(1000);await page.evaluate(()=>document.querySelector('#film-start-marker').remove());const start=performance.now();
const timeline=[];let lastEnd=0;
function now(){return(performance.now()-start)/1000;}
const plans={
 '01_opening':{before:async()=>{await page.mouse.move(180,38,{steps:10});}},
 '02_course':{before:async()=>{await clickSelector('.course-anchor');await focusPanel();}},
 '03_guidance':{before:focusGuide,onLine:async(i)=>{if(i===1){await top('guide-help');await focusPanel()}} ,after:async()=>{await click('close-guide')}},
 '04_first':{before:async()=>{await top('course:rules');await worldAction('rules:case:first');await focusPanel();}},
 '05_repeat':{before:async()=>{await click('rules:choose');await click('rules:case:repeat');await focusPanel()},onLine:async(i)=>{if(i===1){await click('rules:evidence');await focusPanel()}}},
 '06_notice':{before:async()=>{await click('rules:result');await click('rules:uphold');await click('rules:notice');await focusPanel()}},
 '07_appeal':{before:async()=>{await click('rules:appeal');await focusPanel()},onLine:async(i)=>{if(i===1){await click('rules:correct');await focusPanel()}}},
 '08_sharing':{before:async()=>{await click('rules:shared');await focusPanel()},onLine:async(i)=>{if(i===2){await click('rules:result');await click('rules:choose');await click('rules:case:danger');await focusPanel()}}},
 '09_resources':{before:async()=>{await top('course:resources');await focusPanel()}},
 '10_cost':{before:async()=>{await click('resources:detail');await focusPanel()}},
 '11_return':{before:async()=>{await click('resources:next');await focusPanel()},onLine:async(i)=>{if(i===2){await click('resources:confirm:school');await click('resources:confirm:city');await click('resources:confirm:community');await focusPanel()}}},
 '12_proposed':{before:focusPanel,onLine:async(i)=>{if(i===2){await click('course');await click('start');await focusPanel()}}},
 '13_policy':{before:focusPanel,onLine:async(i)=>{if(i===2){await worldAction('policy:A');await focusPanel();await assertState(()=>__campus.state.identity==='O09','fixed demo identity O09')}}},
 '14_card':{onLine:async(i)=>{if(i===1){await worldAction('claim');await focusPanel()}}},
 '15_compare':{before:async()=>{await click('switch-policy');await focusPanel();await assertState(()=>__campus.state.identity==='O09'&&__campus.state.policy==='B','same identity rule B')},onLine:async(i)=>{if(i===2){await click('allocation');await click('allocation-table');await page.locator('.drawer').evaluate(e=>e.scrollTop=e.scrollHeight-650)}},after:async()=>{await clickSelector('.drawer [data-action="close"]');await click('return')}},
 '16_campus':{before:async()=>{await shortcut('go:gate');await board(false);await page.keyboard.down('KeyW');await sleep(850);await page.keyboard.up('KeyW');await page.mouse.move(1180,400,{steps:10});},onLine:async(i)=>{if(i===1){await shortcut('go:hall');await focusPanel();await board(false)}}},
 '17_front':{before:async()=>{await studentView();await click('replay');await focusPanel();await board(false)},minDuration:17.7},
 '18_move':{before:async()=>{await board(false);await world('#desk [data-action="select-desk"]');await focusPanel()},onLine:async(i)=>{if(i===1){await worldAction('layout:side');await focusPanel();await assertState(()=>__campus.state.preview==='side'&&__campus.state.published.layout==='front','preview isolated')}}},
 '19_side':{before:async()=>{await studentView();await click('replay');await focusPanel();await board(false)},onLine:async(i)=>{if(i===1){await queueView()}},minDuration:17.7},
 '20_tradeoff':{before:async()=>{await board(true);await focusPanel()}},
 '21_participation':{before:async()=>{await top('course:participation');await focusPanel()},onLine:async(i)=>{if(i===1){await click('feedback');await focusPanel()}}},
 '22_receipt':{before:async()=>{await click('submit:electronic');await focusPanel()},onLine:async(i)=>{if(i===2){await click('receipt');await focusPanel()}},after:async()=>{await click('back-review')}},
 '23_student':{before:async()=>{await click('role:student');await focusPanel()},onLine:async(i)=>{if(i===2){await worldAction('approve');await focusPanel()}}},
 '24_hold':{before:async()=>{await click('role:staff');await focusPanel()},onLine:async(i)=>{if(i===1){await click('hold');await focusPanel()}if(i===2){await click('publish');await assertState(()=>__campus.state.published.version===1,'held cannot publish')}}},
 '25_publish':{before:async()=>{await click('role:staff');await focusPanel()},onLine:async(i)=>{if(i===1){await worldAction('approve');await focusPanel()}if(i===2){await worldAction('publish');await focusPanel();await assertState(()=>__campus.state.published.version===2&&__campus.state.active.version===1,'published pending next')}}},
 '26_next':{before:async()=>{await worldAction('next');await focusPanel();await assertState(()=>__campus.state.active.version===2&&document.querySelector('#published-arrow').object3D.visible,'v2 actual sign')},onLine:async(i)=>{if(i===1)await board(false)}},
 '27_route':{before:async()=>{await click('follow-route')},minDuration:8},
 '28_records':{before:async()=>{await top('records');await click('records-table');await page.locator('.drawer').evaluate(e=>e.scrollTop=e.scrollHeight)},onLine:async(i)=>{if(i===1){await clickSelector('.drawer [data-action="close"]');await page.reload();await ready();await dress();await focusPanel();await assertState(()=>__campus.state.identity==='O09'&&__campus.state.active.version===2,'refresh retained')}}},
 '29_modes':{before:async()=>{await click('return');await focusPanel()},onLine:async(i)=>{if(i===0){await page.evaluate(()=>{const card=document.createElement('div');card.id='film-modes';card.style.cssText='position:fixed;inset:18px 110px;z-index:10000;background:#102f36f7;border:1px solid #b9f07877;border-radius:20px;padding:38px 70px;display:flex;align-items:center;justify-content:space-between;gap:60px;color:#fff';card.innerHTML='<div style="flex:1;font-family:Campus,sans-serif"><p style="font-size:18px;color:#b9f078">同一场景 · 同一份业务状态</p><h2 style="font-size:40px;line-height:1.6">电脑、手机与兼容头显</h2><p style="font-size:24px;line-height:2.2">电脑：鼠标点选，键盘行走<br>手机：拖动视角，按钮行走<br>头显：可信 HTTPS，主动进入<br>手柄：点选、定点传送、30° 转向</p><p style="font-size:18px;color:#b7d2ce;line-height:1.9">右侧为浏览器尺寸演示<br>本视频为桌面录制，尚无实体头显实测</p></div><div><p style="font-size:16px;text-align:center;color:#b9f078">手机界面 / 390 × 744</p><iframe src="http://localhost:5173/" style="width:390px;height:744px;border:8px solid #385951;border-radius:22px;background:#102f36"></iframe></div>';document.body.append(card);document.querySelector('a-scene').pause();})}} ,after:async()=>{await page.evaluate(()=>{document.querySelector('#film-modes')?.remove();document.querySelector('a-scene').play()})}},
 '30_conclusion':{before:async()=>{await top('records');await click('return');await top('course:participation');await click('course-review');await focusPanel()},onLine:async(i)=>{if(i===1){for(let n=0;n<3;n++)await click('course-review:next');await focusPanel()}if(i===2){await click('course-review:next');await focusPanel()}},after:async()=>{await click('course');await focusPanel()}}
};
try{
 for(const s of segments){const plan=plans[s.id]||{};if(plan.before)await plan.before();const begin=now();const item={id:s.id,chapter:s.chapter,title:s.title,start:begin,lines:[],end:begin};console.log(`RECORD ${s.id} ${begin.toFixed(2)} ${s.title}`);for(let i=0;i<s.voices.length;i++){if(plan.onLine)await plan.onLine(i);const v=s.voices[i];const lineStart=now();item.lines.push({...v,start:lineStart,end:lineStart+v.duration});await sleep((v.duration*1000+260)*narrationScale)}if(plan.minDuration){const remaining=plan.minDuration*narrationScale-(now()-begin);if(remaining>0)await sleep(remaining*1000)}item.end=now();timeline.push(item);await fs.writeFile(path.join(root,'work/timeline.json'),JSON.stringify({width:1920,height:900,segments:timeline,errors},null,2));if(plan.after)await plan.after();lastEnd=now();await sleep(220);}
 await sleep(2500);const duration=now();const video=page.video();const raw=await video.path();await context.close();await browser.close();await fs.writeFile(path.join(root,'work/recording.json'),JSON.stringify({raw,duration,lastEnd,errors,width:1920,height:900,segments:timeline},null,2));console.log(`COMPLETE ${duration.toFixed(3)} ${raw}`);
}catch(e){await page.screenshot({path:path.join(root,'work/recording-error.png')});await fs.writeFile(path.join(root,'work/recording-failure.json'),JSON.stringify({error:e.stack,segments:timeline,errors},null,2));await context.close();await browser.close();console.error(e);process.exitCode=1}
