import test from 'node:test';
import assert from 'node:assert/strict';
import {appealRuleCase,chooseRuleCase,confirmResourceParty,initialResourcePlan,initialRules,RESOURCE_BOUNDARY,RESOURCE_ITEMS,resourceReadiness,resetRuleSelection,restoreResourcePlan,restoreRules,reviewRuleCase,RULES_BOUNDARY} from '../src/institutions.ts';

test('原报告初次误入分支先说明边界、指路，不限制也不触发跨校联动',()=>{
 const initial=initialRules(),state=chooseRuleCase(initial,'first');
 assert.equal(initial.case,null,'保留旧状态');
 assert.equal(state.stage,'guidance');assert.equal(state.restricted,false);assert.equal(state.notice,null);
 assert.match(state.result,/公共参观路线/);assert.match(state.result,/不限制/);assert.match(state.sharedCase!,/帮助理解/);
 assert.match(RULES_BOUNDARY,/不自动评分/);assert.match(RULES_BOUNDARY,/不让轻微误入触发跨校联动/);
 assert.throws(()=>reviewRuleCase(state,'uphold'),/本校复核/);
 assert.throws(()=>appealRuleCase(state),/处理通知/);
});

test('反复扰乱先核对证据，模拟通知保留事实、理由、范围、期限与申诉入口',()=>{
 const draft=chooseRuleCase(initialRules(),'repeat');
 assert.equal(draft.stage,'review');assert.equal(draft.restricted,false);assert.equal(draft.notice!.status,'draft');
 const state=reviewRuleCase(draft,'uphold');
 assert.equal(state.stage,'notice');assert.equal(state.restricted,true);assert.equal(state.notice!.status,'reviewed');
 for(const key of ['facts','evidence','reason','scope','until','appeal'] as const)assert.ok(state.notice![key].trim());
 assert.match(state.notice!.scope,/仅限本校/);assert.match(state.notice!.scope,/不跨校联动/);
 assert.match(state.notice!.until,/12:00/);assert.match(state.notice!.until,/不自动续期/);
 assert.match(state.notice!.appeal,/本校服务台/);assert.match(state.notice!.evidence,/是否认错人员/);
 assert.match(state.result,/课堂模拟/);assert.match(state.sharedCase!,/只共享/);
});

test('访客可申诉、本校可撤销更正，不能用全校联合黑名单替代复核',()=>{
 const notice=reviewRuleCase(chooseRuleCase(initialRules(),'repeat'),'uphold');
 const appealed=appealRuleCase(notice);assert.equal(appealed.stage,'appeal');
 const corrected=reviewRuleCase(appealed,'correct');
 assert.equal(corrected.stage,'corrected');assert.equal(corrected.restricted,false);assert.equal(corrected.notice!.status,'corrected');
 assert.match(corrected.notice!.until,/立即结束/);assert.match(corrected.result,/不建立跨校个人黑名单/);
 assert.equal(notice.restricted,true,'申诉与更正不修改旧通知');
 assert.match(corrected.history.at(-1)!.reason,/是否相称/);
 const upheld=reviewRuleCase(appealRuleCase(notice),'uphold');assert.equal(upheld.stage,'notice');assert.match(upheld.history.at(-1)!.action,/申诉复核/);
});

test('即时人身危险分支由专业人员响应，不生成普通参访资格处理',()=>{
 const state=chooseRuleCase(initialRules(),'danger');
 assert.equal(state.stage,'emergency');assert.equal(state.restricted,false);assert.equal(state.notice,null);
 assert.match(state.result,/专业人员/);assert.match(state.result,/不以普通指路/);
 assert.throws(()=>reviewRuleCase(state,'uphold'),/本校复核/);
});

test('互惠原型保留报告的容量时段责任方与成本缺口，所有条目均为拟议',()=>{
 assert.equal(RESOURCE_ITEMS.length,3);
 assert.match(RESOURCE_ITEMS[0].capacity,/每场20人/);assert.match(RESOURCE_ITEMS[1].capacity,/每月20个名额/);assert.match(RESOURCE_ITEMS[2].capacity,/待现场确认/);
 for(const item of RESOURCE_ITEMS){assert.equal(item.proposed,true);assert.ok(item.time&&item.owner&&item.support&&item.cost&&item.source)}
 assert.match(RESOURCE_ITEMS[0].note,/8学生\+12公众/);
 assert.match(RESOURCE_ITEMS[2].note,/普通参观无需/);
 assert.match(RESOURCE_BOUNDARY,/不表示已达成真实合作/);
});

test('责任清单必须三方核对，完成也只表示课堂模拟就绪',()=>{
 let state=initialResourcePlan();assert.deepEqual(resourceReadiness(state).missing,['school','city','community']);
 const initial=state;state=confirmResourceParty(state,'school');state=confirmResourceParty(state,'city');
 assert.equal(initial.confirmations.school,false);assert.equal(state.status,'pending');assert.deepEqual(resourceReadiness(state).missing,['community']);
 state=confirmResourceParty(state,'community');assert.equal(state.status,'simulation-ready');assert.equal(state.proposed,true);
 assert.match(resourceReadiness(state).summary,/尚无已合作或试点成效/);
 assert.strictEqual(confirmResourceParty(state,'school'),state,'重复核对不制造新的确认记录');
});

test('保存恢复重放合法情境与责任确认，拒绝伪造限制或已合作状态',()=>{
 const first=chooseRuleCase(initialRules(),'first');assert.deepEqual(restoreRules(JSON.stringify(first)),first);
 const rules=reviewRuleCase(appealRuleCase(reviewRuleCase(chooseRuleCase(first,'repeat'),'uphold')),'correct');
 assert.deepEqual(restoreRules(rules),rules);const menu=resetRuleSelection(rules);assert.equal(menu.stage,'choose');assert.equal(menu.case,null);assert.equal(menu.restricted,false);assert.deepEqual(restoreRules(menu),menu);assert.deepEqual(restoreRules({...first,restricted:true}),initialRules());
 assert.deepEqual(restoreRules({...rules,notice:{...rules.notice,until:'永远禁止'}}),initialRules());
 assert.deepEqual(restoreRules('broken'),initialRules());
 let plan=confirmResourceParty(initialResourcePlan(),'school');assert.deepEqual(restoreResourcePlan(JSON.stringify(plan)),plan);
 assert.deepEqual(restoreResourcePlan({...plan,status:'simulation-ready'}),initialResourcePlan());
 plan=confirmResourceParty(confirmResourceParty(plan,'city'),'community');assert.deepEqual(restoreResourcePlan(plan),plan);
 assert.deepEqual(restoreResourcePlan({...plan,proposed:false}),initialResourcePlan());
});
