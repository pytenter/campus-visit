import test from 'node:test';
import assert from 'node:assert/strict';
import {
 CHECK_ITEMS,CODEBOOK,QUOTA,TARGET_COMPREHENSION,initialFieldwork,emptyFieldworkEnvelope,
 comprehensionSummary,observationSummary,interviewSummary,quotaGap,demandStatus,
 appendFieldworkEvent,applyFieldworkEvent,fieldworkEnvelope,restoreFieldwork,importFieldwork,exportFieldwork,
 type ComprehensionRecord,type InterviewRecord,type ObservationRecord,type FieldworkState,type FieldworkEvent,
} from '../src/fieldwork.ts';
import * as courseModule from '../src/course.ts';
import * as domainModule from '../src/domain.ts';
import * as institutionsModule from '../src/institutions.ts';

function comprehension(id:string,understood:ComprehensionRecord['understood']=[...CHECK_ITEMS]):ComprehensionRecord {
 return {id,group:'student',understood,task:'digital'};
}
function interview(id:string,codes:InterviewRecord['codes']=['需要申诉渠道'],stance:InterviewRecord['stance']='支持',group:InterviewRecord['group']='student'):InterviewRecord {
 return {id,group,durationMinutes:12,quotes:[`${id} 的原话引语`],codes,stance};
}
function observation(id:string,zone:ObservationRecord['zone']='gate',slot:ObservationRecord['slot']='morning'):ObservationRecord {
 return {id,date:'2026-11-20',slot,zone,weather:'sunny',flow:'中',queueMinutes:id==='O-2'?6:undefined,conflict:id==='O-1'?'入口与上课路线交叉':'',photo:'gate.jpg'};
}
/** 与 observation() 相反，缺省字段不出现（不产生 undefined 键）。 */
function observationPayload(id:string):ObservationRecord {
 const {weather,queueMinutes,photo,...rest}=observation(id);
 return {...rest};
}
const records=(n:number,understood:ComprehensionRecord['understood']=[...CHECK_ITEMS])=>Array.from({length:n},(_,i)=>comprehension(`T-${i+1}`,understood));
const coded=(n:number,code='需要申诉渠道',stance:InterviewRecord['stance']='支持')=>Array.from({length:n},(_,i)=>interview(`I-${i+1}`,[code],stance));

test('空理解记录只报告未开始，不输出达标或样本结论',()=>{
 const summary=comprehensionSummary([]);
 assert.deepEqual(summary,{total:0,byItem:{'open-zone':{hit:0,rate:0},'restricted-zone':{hit:0,rate:0},'help-channel':{hit:0,rate:0}},allThree:0,threshold:0.8,verdict:'not-started',message:'尚未开始测试，无数据。'});
 assert.doesNotMatch(summary.message,/达标|样本不足/);
});

test('即使七人全部答对，n<8 也明确样本不足',()=>{
 const summary=comprehensionSummary(records(7));
 assert.equal(summary.verdict,'insufficient-n');assert.equal(summary.allThree,1);assert.match(summary.message,/样本不足，暂不判定/);assert.doesNotMatch(summary.message,/已达标/);
});

test('八人全对、再加两位只说出两项与一项的人，恰好八成且每项达标',()=>{
 const data=[...records(8),comprehension('T-9',['open-zone','restricted-zone']),comprehension('T-10',['open-zone'])];
 const summary=comprehensionSummary(data);
 assert.equal(summary.total,10);assert.equal(summary.allThree,0.8);assert.equal(summary.byItem['open-zone'].rate,1);assert.equal(summary.byItem['restricted-zone'].rate,0.9);assert.equal(summary.byItem['help-channel'].rate,0.8);assert.equal(summary.verdict,'meets-target');assert.equal(summary.threshold,TARGET_COMPREHENSION);
 const lower=comprehensionSummary([...records(8),comprehension('T-9',['open-zone','restricted-zone']),comprehension('T-10',[])]);
 assert.equal(lower.allThree,0.8);assert.equal(lower.byItem['help-channel'].rate,0.8);assert.equal(lower.verdict,'meets-target');
});

test('任一单项不足八成时不能通过，n=8 时一人未说出即失败',()=>{
 const insufficientItem=[...records(7),comprehension('T-8',['open-zone','restricted-zone'])];
 assert.equal(comprehensionSummary(insufficientItem).byItem['help-channel'].rate,0.875);assert.equal(comprehensionSummary(insufficientItem).allThree,0.875);
 const failing=[...records(7),comprehension('T-8',[])];
 assert.equal(comprehensionSummary(failing).byItem['help-channel'].rate,0.875);assert.equal(comprehensionSummary(failing).allThree,0.875);
 const data=[...records(6),comprehension('T-7',['open-zone','restricted-zone']),comprehension('T-8',['open-zone']),comprehension('T-9',['open-zone']),comprehension('T-10',[])];
 const summary=comprehensionSummary(data);
 assert.ok(summary.byItem['help-channel'].rate<0.8);assert.equal(summary.verdict,'below-target');
 const insufficient=[...records(7),...Array.from({length:72},(_,i)=>comprehension(`B-${i}`,[]))];
 assert.equal(comprehensionSummary(insufficient).byItem['open-zone'].rate,7/79);assert.ok(7/79<0.8);assert.equal(comprehensionSummary(insufficient).verdict,'below-target');
});

test('某单项低于八成时，即使 allThree 较高也不能通过',()=>{
 const data=[...records(8,['open-zone','restricted-zone']),...records(2)];
 const summary=comprehensionSummary(data);
 assert.equal(summary.allThree,0.2);assert.equal(summary.byItem['help-channel'].rate,0.2);assert.equal(summary.verdict,'below-target');
});

test('观察汇总提供区域、时段、排队均值及完整覆盖矩阵',()=>{
 const data=[observation('O-1'),observation('O-2'),observation('O-3','hall','evening')];
 const summary=observationSummary(data);
 assert.equal(summary.total,3);assert.deepEqual(summary.byZone.gate,{n:2,avgQueue:6,conflicts:1});assert.equal(summary.bySlot.morning.n,2);assert.equal(summary.bySlot.evening.avgQueue,null);
 assert.deepEqual(summary.coverage.sort(),['gate×morning','hall×evening']);assert.equal(summary.matrix.gate.morning,2);assert.equal(summary.matrix.sports.noon,0);
});

test('访谈配额按 8/8/2/2 给出缺口并汇总实际人数',()=>{
 const full=[...coded(8),...coded(8).map((r,i)=>({...r,id:`P-${i}`,group:'public' as const})),...coded(2).map((r,i)=>({...r,id:`S-${i}`,group:'staff' as const})),...coded(2).map((r,i)=>({...r,id:`C-${i}`,group:'city' as const}))];
 assert.deepEqual(quotaGap(full),{student:0,public:0,staff:0,city:0});assert.deepEqual(interviewSummary(full).byGroup.staff,{n:2,target:2,gap:0});assert.equal(interviewSummary(full).total,20);
 assert.deepEqual(quotaGap(full.slice(0,5)),{student:3,public:8,staff:2,city:2});assert.deepEqual(QUOTA,{student:8,public:8,staff:2,city:2});
});

test('需求无记录保持拟议，少于三条不能 supported',()=>{
 assert.deepEqual(demandStatus('需要申诉渠道',[]),{status:'proposed',n:0,quotes:[]});
 assert.equal(demandStatus('需要申诉渠道',coded(2)).status,'mixed');
});

test('同向至少三条且达到三分之二才支持，反向及条件支持口径固定',()=>{
 const supported=[...coded(2),interview('I-3',['需要申诉渠道'],'有条件支持')];
 assert.equal(demandStatus('需要申诉渠道',supported).status,'supported');
 assert.equal(demandStatus('需要申诉渠道',coded(3,'需要申诉渠道','反对')).status,'rejected');
 assert.equal(demandStatus('需要申诉渠道',[...coded(2),interview('I-3',['需要申诉渠道'],'反对')]).status,'supported');
 assert.equal(demandStatus('需要申诉渠道',[interview('I-1'),interview('I-2',['需要申诉渠道'],'反对'),interview('I-3',['需要申诉渠道'],'反对')]).status,'mixed');
 assert.equal(demandStatus('制度没必要',coded(3,'制度没必要')).status,'rejected','负向编码的“支持”应计作需求反向');
 assert.throws(()=>demandStatus('临时分类',coded(3)),/预定义编码/);
});

test('所有非拟议需求结论携带原话引语，缺失时拒绝结论',()=>{
 const result=demandStatus('需要申诉渠道',coded(3));assert.equal(result.quotes.length,3);assert.ok(result.quotes.every(Boolean));
 assert.throws(()=>demandStatus('需要申诉渠道',[{...interview('I-1'),quotes:[]}]),/原话引语/);
 assert.throws(()=>demandStatus('需要申诉渠道',[{...interview('I-1'),quotes:['  ']}]),/原话引语/);
});

test('编码表与原始访谈结构固定，不能事后新增分类',()=>{
 assert.equal(Object.keys(CODEBOOK).length,5);assert.ok(Object.values(CODEBOOK).every(codes=>codes.length>=3));
 const bad=interview('I-bad');bad.codes=['临时支持分类'];
 const state={...initialFieldwork(),interviews:[bad]};
 assert.deepEqual(restoreFieldwork(fieldworkEnvelope(state)),initialFieldwork());
 const invalidStance={...fieldworkEnvelope(state),interviews:[{...interview('I-bad'),stance:'非常支持'}],events:[{type:'interview:add',record:{...interview('I-bad'),stance:'非常支持'}}]};
 assert.deepEqual(restoreFieldwork(invalidStance),initialFieldwork());
});

test('事件重放恢复增删记录，不信任伪造的原始数组和派生字段',()=>{
 let envelope=emptyFieldworkEnvelope();
 const add:FieldworkEvent={type:'comprehension:add',record:comprehension('T-1')};
 envelope=appendFieldworkEvent(envelope,add);envelope=appendFieldworkEvent(envelope,{type:'comprehension:add',record:comprehension('T-2')});envelope=appendFieldworkEvent(envelope,{type:'comprehension:remove',id:'T-1'});
 envelope=appendFieldworkEvent(envelope,{type:'observation:add',record:observation('O-1')});envelope=appendFieldworkEvent(envelope,{type:'observation:add',record:observation('O-2')});envelope=appendFieldworkEvent(envelope,{type:'observation:remove',id:'O-2'});envelope=appendFieldworkEvent(envelope,{type:'interview:add',record:interview('I-1')});
 assert.deepEqual(restoreFieldwork(envelope),{schemaVersion:1,comprehension:[comprehension('T-2')],observations:[observation('O-1')],interviews:[interview('I-1')]});
 assert.deepEqual(restoreFieldwork({...envelope,comprehension:records(20),summary:{verdict:'meets-target'}}),initialFieldwork());
 assert.deepEqual(restoreFieldwork({...envelope,events:[...envelope.events,{type:'unknown'}]}),initialFieldwork());
 assert.throws(()=>applyFieldworkEvent(initialFieldwork(),add.record?{type:'comprehension:remove',id:'missing'}:add),/不存在/);
});

test('json 导出导入完整往返，非法 json、版本和矛盾数据均回初始',()=>{
 const state:FieldworkState={schemaVersion:1,comprehension:records(8),observations:[observationPayload('O-1')],interviews:coded(3)};
 const json=exportFieldwork(state),restored=importFieldwork(json);
 assert.deepEqual(restored,state);assert.notEqual(JSON.parse(json).events,undefined);
 assert.deepEqual(importFieldwork('{bad json'),initialFieldwork());
 assert.deepEqual(importFieldwork(JSON.stringify({...JSON.parse(json),schemaVersion:2})),initialFieldwork());
 const tampered=JSON.stringify({...JSON.parse(json),observations:[]});assert.deepEqual(importFieldwork(tampered),initialFieldwork());
 const extra=JSON.stringify({...JSON.parse(json),interviews:[...coded(3),interview('I-extra')],events:[...JSON.parse(json).events,{type:'interview:add',record:interview('I-extra')}]});
 assert.equal(importFieldwork(extra).interviews.length,4);
});

test('重复编号、非法理解和观察数据不会进入恢复结果',()=>{
 const duplicate=emptyFieldworkEnvelope();duplicate.events=[{type:'comprehension:add',record:comprehension('T-1')},{type:'comprehension:add',record:comprehension('T-1')}];duplicate.comprehension=[comprehension('T-1')];
 assert.deepEqual(restoreFieldwork(duplicate),initialFieldwork());
 const bad={...fieldworkEnvelope({...initialFieldwork(),observations:[observation('O-1')]})};(bad.observations[0] as ObservationRecord).queueMinutes=-1;(bad.events[0] as {record:ObservationRecord}).record.queueMinutes=-1;
 assert.deepEqual(restoreFieldwork(bad),initialFieldwork());
});

// courseReview 兼容与证据分级：旧调用（不传现场数据）必须与提交 08bcd12 逐字段等价。
const {courseReview,courseContext}=courseModule;
const {initialState,executePolicy,claimCard}=domainModule;
const {initialRules,initialResourcePlan}=institutionsModule;
import type {CourseReview} from '../src/course.ts';
const BASELINE_SUMMARY='课堂情境证据0/3项；本校处理模拟尚未开始；三方模拟核对0/3。校际协作与校城互惠仍是拟议方案，尚无真实试点成效。';
const BASELINE_BOUNDARY='原报告第20页明确：全部制度情境、资源额度与测试目标均属拟议，尚无试点成效。本地模拟结果与真实制度成效应分开说明。';
test('不传第三参数时与提交 08bcd12 逐字段等价，且不新增 evidenceLevel',()=>{
 const review=courseReview(initialState());
 assert.equal(review.summary,BASELINE_SUMMARY);assert.equal(review.boundary,BASELINE_BOUNDARY);
 assert.deepEqual(review.items.map((item:CourseReview['items'][number])=>item.id),['allocation','layout','participation','rules','resources','fieldwork']);
 assert.ok(review.items.every((item:CourseReview['items'][number])=>item.evidenceLevel===undefined));
 assert.ok(review.items.every((item:CourseReview['items'][number])=>['completed','pending','proposed'].includes(item.status)));
 assert.deepEqual(review.items.find((item:CourseReview['items'][number])=>item.id==='fieldwork'),{id:'fieldwork',title:'访谈、现场观察与实际成效',status:'pending',statusLabel:'尚待实地验证',evidence:'原报告将四周观察、访谈、共创和情境测试列为下一阶段计划。本地点击、回执和格网结果不构成真实试点成效。',connection:'第12页的80%理解门槛是拟定目标；第13页的访谈人数是计划样本，均不能写成已实现的数据。',slides:'第12—13、20页'});
});
test('旧调用路径在已执行规则与领卡状态下仍逐字段等价于基线',()=>{
 const policy=courseReview(executePolicy(initialState(),'A')),claimed=courseReview(claimCard(executePolicy(initialState(),'B')));
 for(const review of [policy,claimed])assert.ok(review.items.every((item:CourseReview['items'][number])=>item.evidenceLevel===undefined));
 assert.equal(policy.items.find((item:CourseReview['items'][number])=>item.id==='allocation')!.statusLabel,'尚未完成课堂比较');
 assert.equal(claimed.items.find((item:CourseReview['items'][number])=>item.id==='allocation')!.evidence,'已执行规则B；尚未形成“领取结果卡后换规则比较”的完整记录。');
});
test('传入现场数据只提升证据等级，制度结论仍为拟议，且门槛未达时不写达标',()=>{
 const fieldwork={...initialFieldwork(),interviews:coded(3,'需要申诉渠道'),comprehension:records(7)};
 const review=courseReview(initialState(),undefined,fieldwork);
 const rules=review.items.find((item:CourseReview['items'][number])=>item.id==='rules')!;
 assert.equal(rules.status,'proposed');assert.equal(rules.evidenceLevel,'field');
 assert.match(rules.evidence,/3条对应编码的实地访谈记录/);assert.doesNotMatch(rules.evidence,/已试点|已达标|已合作|已验证/);
 const fieldworkItem=review.items.find((item:CourseReview['items'][number])=>item.id==='fieldwork')!;
 assert.equal(fieldworkItem.status,'pending');assert.match(fieldworkItem.statusLabel,/样本不足暂不判定/);assert.doesNotMatch(fieldworkItem.statusLabel,/达标/);
 assert.match(review.summary,/已收集10条现场记录/);assert.doesNotMatch(review.summary,/已试点|已达标|已合作|已验证/);
 const two=courseReview(initialState(),undefined,{...initialFieldwork(),interviews:coded(2)});
 assert.equal(two.items.find((item:CourseReview['items'][number])=>item.id==='rules')!.evidenceLevel,'none');
});
test('主流程各阶段文案不受调研数据影响（只有课程复盘读现场数据）',()=>{
 const field={...initialFieldwork(),interviews:coded(3,'需要申诉渠道'),comprehension:records(8)};
 const state=executePolicy(initialState(),'A'),plainState=initialState();
 for(const stage of ['welcome','policy','reveal','card','replay','feedback','review','next','allocation','receipt','service','case','course-rules','course-resources','course-participation']){
  const withData=courseContext(stage,state,{rules:initialRules(),resources:initialResourcePlan()},field);
  const without=courseContext(stage,state,{rules:initialRules(),resources:initialResourcePlan()});
  assert.deepEqual(withData,without,stage);
 }
 const reviewWith=courseContext('course-review',plainState,{rules:initialRules(),resources:initialResourcePlan()},field);
 const reviewWithout=courseContext('course-review',plainState,{rules:initialRules(),resources:initialResourcePlan()});
 assert.notEqual(reviewWith.evidence,reviewWithout.evidence);
});
