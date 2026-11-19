import test from 'node:test';
import assert from 'node:assert/strict';
import {claimCard,executePolicy,initialState,nextVisitor,previewLayout,publishFeedback,reviewFeedback,submitFeedback,type AppState} from '../src/domain.ts';
import {appealRuleCase,chooseRuleCase,confirmResourceParty,initialResourcePlan,initialRules,reviewRuleCase} from '../src/institutions.ts';
import {COURSE_MECHANISMS,COURSE_QUESTION,COURSE_TITLE,courseContext,courseReview,type CoursePrototypes} from '../src/course.ts';

const prototypes=():CoursePrototypes=>({rules:initialRules(),resources:initialResourcePlan()});
const row=(state:AppState,id:string,p?:CoursePrototypes)=>courseReview(state,p).items.find(item=>item.id===id)!;
function reviewedFeedback():AppState {
 let state=claimCard(executePolicy(initialState(),'A',()=>0));
 state=submitFeedback(previewLayout(state,'side'),'paper');
 return reviewFeedback(reviewFeedback(state,'student','approved'),'staff','approved');
}

test('课程题目、核心问题和原报告三机制准确，不把三幕延展冒充三项创新',()=>{
 assert.equal(COURSE_TITLE,'大学校园开放制度的创新设计');
 assert.match(COURSE_QUESTION,/保护教学与生活空间/);assert.match(COURSE_QUESTION,/不同能力的公众公平获得大学资源/);assert.match(COURSE_QUESTION,/开放成本由多方共同承担/);
 assert.deepEqual(COURSE_MECHANISMS.map(item=>[item.id,item.name]),[['rules','校际规则协作'],['resources','大学与城市资源互惠'],['participation','游客参与校园共建']]);
 assert.equal(COURSE_MECHANISMS[0].slides,'第7—8页、附录第19页');assert.equal(COURSE_MECHANISMS[1].slides,'第7、9页、附录第17页');assert.equal(COURSE_MECHANISMS[2].slides,'第7、10—12页');
 assert.match(courseContext('policy',initialState()).connection,/课堂延展/);assert.match(courseContext('replay',initialState()).slides,/9×7格网/);
 assert.match(COURSE_MECHANISMS[0].proposal,/个人信息|匿名案例/);assert.match(COURSE_MECHANISMS[2].proposal,/普通参观无需参与/);
});

test('初始状态没有假完成：课堂、本校模拟、三方确认及实地研究分别显示',()=>{
 const state=initialState(),p=prototypes(),review=courseReview(state,p);
 assert.ok(review.items.every(item=>item.status!=='completed'));
 assert.equal(row(state,'rules',p).status,'proposed');assert.equal(row(state,'resources',p).status,'proposed');assert.equal(row(state,'fieldwork',p).status,'pending');
 assert.match(review.summary,/课堂情境证据0\/3/);assert.match(review.summary,/本校处理模拟尚未开始/);assert.match(review.summary,/三方模拟核对0\/3/);
 assert.match(courseContext('course-rules',state,p).evidence,/尚未操作/);assert.match(courseContext('course-resources',state,p).evidence,/三方尚未操作/);
 assert.doesNotThrow(()=>courseReview(state),'不传机构参数仍兼容');
});

test('名额比较与试摆产生的只是课堂证据，不能宣称反馈闭环或制度已落实',()=>{
 let state=claimCard(executePolicy(initialState(),'A',()=>0));
 assert.equal(row(state,'allocation').status,'pending');
 state=claimCard(executePolicy(state,'B'));assert.equal(row(state,'allocation').status,'completed');assert.match(row(state,'allocation').evidence,/4 人新获得/);
 state=previewLayout(state,'side');assert.equal(row(state,'layout').status,'completed');assert.match(row(state,'layout').evidence,/试摆记录不等于/);
 assert.equal(row(state,'participation').status,'pending');assert.match(courseContext('feedback',state).evidence,/只改变试摆/);assert.equal(state.active.layout,'front');
 assert.equal(row(state,'resources').status,'proposed');assert.equal(row(state,'rules').status,'proposed');
});

test('双审通过或已发布还不算反馈闭环，下一轮实际采用才完成',()=>{
 let state=reviewedFeedback();assert.equal(row(state,'participation').status,'pending');assert.match(courseContext('review',state).evidence,/尚未发布/);
 state=publishFeedback(state);assert.equal(row(state,'participation').status,'pending');assert.match(courseContext('review',state).evidence,/需要接待下一位/);assert.equal(state.active.version,1);
 state=nextVisitor(state);assert.equal(row(state,'participation').status,'completed');assert.match(row(state,'participation').evidence,/本轮现场已采用v2/);assert.equal(state.active.arrow,true);
 assert.equal(row(state,'rules').status,'proposed');assert.equal(row(state,'resources').status,'proposed');assert.match(courseReview(state).boundary,/尚无试点成效/);
});

test('未发布的跳过和暂缓不会成为下一轮成效，新的暂缓也不冒充旧版采用',()=>{
 let skipped=nextVisitor(previewLayout(initialState(),'side'));assert.equal(row(skipped,'participation').status,'pending');assert.match(row(skipped,'participation').evidence,/普通访客继续参观/);
 let state=submitFeedback(executePolicy(initialState(),'B',()=>1),'electronic');state=reviewFeedback(state,'student','held','引导员尚未到位');
 assert.match(courseContext('review',state).evidence,/引导员尚未到位/);assert.equal(row(state,'participation').status,'pending');
 state=nextVisitor(publishFeedback(reviewedFeedback()));state=submitFeedback(state,'electronic');state=reviewFeedback(state,'staff','held','新箭头需补充');
 assert.match(courseContext('review',state).evidence,/新箭头需补充/);assert.doesNotMatch(courseContext('review',state).evidence,/本轮现场已采用/);
});

test('本校处理原型显示真实模拟步骤，撤销更正以当前通知结果为准',()=>{
 const state=initialState(),p=prototypes();
 p.rules=chooseRuleCase(p.rules,'first');assert.match(courseContext('rules',state,p).evidence,/已模拟初次误入/);assert.match(row(state,'rules',p).evidence,/没有限制资格/);
 p.rules=chooseRuleCase(p.rules,'repeat');assert.match(row(state,'rules',p).evidence,/尚未限制资格/);
 p.rules=reviewRuleCase(p.rules,'uphold');assert.match(row(state,'rules',p).evidence,/模拟发出通知/);assert.equal(p.rules.restricted,true);
 p.rules=appealRuleCase(p.rules);assert.match(row(state,'rules',p).statusLabel,/申诉待复核/);
 p.rules=reviewRuleCase(p.rules,'correct');assert.equal(p.rules.notice!.status,'corrected');assert.equal(p.rules.restricted,false);assert.match(row(state,'rules',p).evidence,/当前模拟限制已解除/);assert.match(row(state,'rules',p).statusLabel,/撤销更正/);
 assert.equal(row(state,'rules',p).status,'proposed');assert.match(courseReview(state,p).summary,/已体验2种情境/);assert.match(courseReview(state,p).summary,/尚无真实试点成效/);
});

test('三方确认只提升本地模拟核对进度，永不变成真实合作或试点成效',()=>{
 const state=initialState(),p=prototypes();
 p.resources=confirmResourceParty(p.resources,'school');assert.match(row(state,'resources',p).evidence,/学校/);assert.match(row(state,'resources',p).evidence,/城市、社区仍待模拟核对/);assert.match(courseReview(state,p).summary,/三方模拟核对1\/3/);
 p.resources=confirmResourceParty(confirmResourceParty(p.resources,'city'),'community');assert.equal(p.resources.status,'simulation-ready');
 assert.match(row(state,'resources',p).evidence,/仅为“模拟就绪”/);assert.match(row(state,'resources',p).evidence,/未达成真实合作/);assert.equal(row(state,'resources',p).status,'proposed');assert.match(courseReview(state,p).summary,/三方模拟核对3\/3（仅模拟就绪）/);
 assert.equal(row(state,'fieldwork',p).status,'pending');assert.match(courseReview(state,p).boundary,/真实制度成效应分开/);
 const unsupported={...p,resources:{...p.resources,history:[]}};assert.match(courseReview(state,unsupported).summary,/三方模拟核对0\/3/,'没有操作记录不能凭确认标记称已操作');
});
