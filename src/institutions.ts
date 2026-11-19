/**
 * Original course prototypes, based on the supplied report pages 8–9 and 17–20.
 * Every event is a classroom simulation. Nothing here creates a real access ban,
 * shares personal information, or confirms an actual institutional partnership.
 */
export type RuleCase = 'first' | 'repeat' | 'danger';
export type RulesStage = 'choose' | 'guidance' | 'review' | 'notice' | 'appeal' | 'corrected' | 'emergency';
type RuleEvent = 'choose-menu' | `choose:${RuleCase}` | 'review:uphold' | 'review:correct' | 'appeal';
export interface PrototypeHistory { action:string; result:string; reason:string }
export interface RuleHistory extends PrototypeHistory { event:RuleEvent }
export interface RuleNotice {
 facts:string;
 evidence:string;
 reason:string;
 scope:string;
 until:string;
 appeal:string;
 status:'draft'|'reviewed'|'corrected';
}
export interface RulesState {
 schemaVersion:1;
 case:RuleCase|null;
 stage:RulesStage;
 restricted:boolean;
 notice:RuleNotice|null;
 result:string;
 sharedCase:string|null;
 history:RuleHistory[];
}
export const RULES_BOUNDARY='课程模拟：两校只共享规则模板与匿名案例。本校独立核对事实、说明理由和受理申诉；不公开姓名证件，不自动评分，不让轻微误入触发跨校联动。';
export const RULE_CASES:ReadonlyArray<{id:RuleCase;name:string;summary:string}>=Object.freeze([
 {id:'first',name:'初次误入，愿意配合',summary:'先解释教学生活区边界，提供返程指引与公共路线。'},
 {id:'repeat',name:'反复扰乱正常秩序',summary:'本校留证、告知并复核，必要的拟议限制须有范围、期限和申诉入口。'},
 {id:'danger',name:'即时人身危险',summary:'按既有应急流程由专业人员响应，不能按普通误入处理。'},
]);
export function initialRules():RulesState {
 return {schemaVersion:1,case:null,stage:'choose',restricted:false,notice:null,result:'请选择一个拟议情境，体验分级处理与本校复核。',sharedCase:null,history:[]};
}
function ruleLog(state:RulesState,event:RuleEvent,action:string,result:string,reason:string):RulesState {
 return {...state,result,history:[...state.history,{event,action,result,reason}]};
}
function draftNotice():RuleNotice {
 return {
  facts:'虚构情境 R-02：一名访客经边界说明后，仍反复扰乱正常秩序。',
  evidence:'课堂情境提供本校现场记录与两次说明记录。须检查是否认错人员、证据是否完整、处理是否相称；不代表已完成现实取证。',
  reason:'拟议规则区分初次误入与反复扰乱；只有本校复核后，才讨论必要且相称的参访资格限制。',
  scope:'拟议：仅限本校本次开放日的后续参访资格，不跨校联动。求助与申诉渠道继续开放。',
  until:'课堂设定：本次开放日 12:00 结束时撤销，不自动续期；实际期限须由管理方另行确认。',
  appeal:'本校服务台受理纸卡或电子申诉，由本校复核人员说明维持、撤销或更正结果。联系人为本校服务台值守人员（情境角色）。',
  status:'draft',
 };
}
export function resetRuleSelection(state:RulesState):RulesState {
 return ruleLog({...initialRules(),history:state.history},'choose-menu','返回情境选择','请选择另一个拟议情境。之前的匿名课堂操作记录仍保留。','比较初次误入、反复扰乱与即时危险应采用的不同处理程序。');
}
export function chooseRuleCase(state:RulesState,which:RuleCase):RulesState {
 if(which!=='first'&&which!=='repeat'&&which!=='danger')throw new Error('请选择初次误入、反复扰乱或即时人身危险。');
 const next:RulesState={...state,case:which,restricted:false,notice:null,sharedCase:null,stage:which==='first'?'guidance':which==='repeat'?'review':'emergency'};
 if(which==='first')return ruleLog({...next,sharedCase:'拟议匿名案例 C-01：初次误入且愿意配合，先解释边界并指向公共路线；帮助理解规则，不限制资格。'},'choose:first','初次误入：解释并指路','说明受限区边界，提供返程和公共参观路线；不限制本次参访资格。','原报告第8页优先帮助理解规则；第19页不让轻微误入触发联动。');
 if(which==='danger')return ruleLog(next,'choose:danger','即时危险：专业响应','按既有应急流程交由专业人员响应，保障现场人员安全；不以普通指路或资格复核代替应急处置。','原报告第8页区分秩序管理与警情。本原型不模拟真实报警处置或真实人员处罚。');
 return ruleLog({...next,notice:draftNotice()},'choose:repeat','反复扰乱：本校留证告知','已生成课堂模拟处理草案，尚未限制资格。请先由本校复核事实、证据与处理是否相称。','原报告第8、19页要求本校留证、告知、复核，通知说明事实、理由、范围、期限与申诉入口。');
}
export function reviewRuleCase(state:RulesState,decision:'uphold'|'correct'):RulesState {
 if(state.case!=='repeat'||!state.notice||!['review','appeal'].includes(state.stage))throw new Error('请先选择反复扰乱情境，或对处理通知提出申诉，再由本校复核。');
 if(decision!=='uphold'&&decision!=='correct')throw new Error('请选择维持拟议处理或撤销更正。');
 if(decision==='correct'){
  const notice:RuleNotice={...state.notice,status:'corrected',reason:'课堂复核分支：证据不足以确认原处理，或处理不相称，撤销并更正拟议限制。',scope:'已撤销本校该拟议限制；不向其他学校传播限入结果。',until:'拟议限制立即结束。'};
  return ruleLog({...state,stage:'corrected',restricted:false,notice,sharedCase:'拟议匿名复盘：本校复核发现证据或相称性问题，撤销、更正处理；两校只共享核对步骤。'},'review:correct','本校复核：撤销更正','本校撤销拟议限制并说明理由，保留匿名复盘；不建立跨校个人黑名单。','原报告第19页要求检查是否认错人员、证据是否完整、处理是否相称，并说明何时撤销或更正。');
 }
 return ruleLog({...state,stage:'notice',restricted:true,notice:{...state.notice,status:'reviewed'},sharedCase:'拟议匿名复盘：本校核对证据与相称性后，说明有限范围、结束时间及申诉入口；两校只共享匿名处理步骤，不将个人结果跨校联动。'},'review:uphold',state.stage==='appeal'?'申诉复核：维持拟议处理':'本校复核：模拟发出通知','课堂模拟中维持本校本次开放日的拟议处理，完整告知范围、期限和申诉入口；其他学校不联动。','原报告第8、19页要求本校独立复核和相称处理。这只是情境分支，不代表真实限制或政策效果。');
}
export function appealRuleCase(state:RulesState):RulesState {
 if(state.case!=='repeat'||state.stage!=='notice'||!state.notice||!state.restricted)throw new Error('只有已发出的本校模拟处理通知可以进入申诉复核。');
 return ruleLog({...state,stage:'appeal'},'appeal','访客申诉：重新核对','已登记课堂模拟申诉，交本校重新核对人员、证据、相称性与期限；请决定维持或撤销更正。','原报告第19页保留本校申诉入口和更正程序，跨校只共享匿名案例与规则模板。');
}

export type ResourceParty='school'|'city'|'community';
export interface ResourceItem {
 id:'science'|'culture'|'route';
 name:string;
 users:string;
 time:string;
 capacity:string;
 owner:string;
 support:string;
 cost:string;
 note:string;
 source:string;
 proposed:true;
}
export const RESOURCE_ITEMS:ReadonlyArray<Readonly<ResourceItem>>=Object.freeze([
 {id:'science',name:'校园科普活动',users:'社会公众',time:'周末非教学时段',capacity:'每场20人（拟议填写示例）',owner:'学校组织',support:'城市支持交通与保洁',cost:'学校核定活动组织与场地投入；城市确认交通、保洁支持。金额与人时待协商。',note:'先保留师生需求。此20人是报告清单示例，与本体验8学生+12公众的课堂工位设定分开。',source:'第9、17页',proposed:true},
 {id:'culture',name:'城市文化活动',users:'本校学生',time:'每月指定场次',capacity:'每月20个名额（拟议填写示例）',owner:'城市场馆提供名额',support:'校方统一发布信息与预约办法',cost:'城市场馆核定名额与运营投入；学校承担信息发布和预约组织，费用待确认。',note:'学生可预约的城市文化资源属于拟议互惠，尚无真实合作或已发放名额。',source:'第9、17页',proposed:true},
 {id:'route',name:'公共参访路线',users:'社会公众',time:'公告开放时段',capacity:'由承载量确定（待现场确认）',owner:'校方负责标识与求助服务',support:'社区自愿反馈路线问题',cost:'路线标识、求助和维护由管理方安排负责岗位；社区反馈不替代安保、保洁。',note:'检查无障碍条件。普通参观无需承担志愿岗位，不能用资源共享要求游客强制劳动。',source:'第10、17页',proposed:true},
]);
export const RESOURCE_PARTIES:ReadonlyArray<{id:ResourceParty;name:string;conditions:string}>=Object.freeze([
 {id:'school',name:'学校',conditions:'先保障师生日常，核对活动容量、开放时段、标识与求助负责人。'},
 {id:'city',name:'城市',conditions:'核对接驳、保洁、运营支持和学生可预约资源；明确费用与责任方。'},
 {id:'community',name:'社区',conditions:'确认可自愿支持的反馈与协作；普通参观无需参与，不替代专业岗位。'},
]);
export const RESOURCE_BOUNDARY='拟议责任清单：所有容量、时段、人时和费用仍须实际管理方确认。课堂中的三方确认只用于讨论责任是否清楚，不表示已达成真实合作。';
export interface ResourceHistory extends PrototypeHistory { event:`confirm:${ResourceParty}` }
export interface ResourcePlan {
 schemaVersion:1;
 confirmations:Record<ResourceParty,boolean>;
 status:'pending'|'simulation-ready';
 proposed:true;
 history:ResourceHistory[];
}
export function initialResourcePlan():ResourcePlan {
 return {schemaVersion:1,confirmations:{school:false,city:false,community:false},status:'pending',proposed:true,history:[]};
}
export function resourceReadiness(state:ResourcePlan):{status:ResourcePlan['status'];missing:ResourceParty[];summary:string;proposed:true} {
 const missing=RESOURCE_PARTIES.filter(p=>!state.confirmations[p.id]).map(p=>p.id);
 return {status:missing.length?'pending':'simulation-ready',missing,proposed:true,summary:missing.length?`拟议清单仍待${RESOURCE_PARTIES.filter(p=>missing.includes(p.id)).map(p=>p.name).join('、')}核对责任。`:'三方已在课堂中完成责任核对；仅为模拟就绪，容量、时段与费用仍待真实管理方确认，尚无已合作或试点成效。'};
}
export function confirmResourceParty(state:ResourcePlan,party:ResourceParty):ResourcePlan {
 const who=RESOURCE_PARTIES.find(p=>p.id===party);
 if(!who)throw new Error('请选择学校、城市或社区核对责任。');
 if(state.confirmations[party])return state;
 const confirmations={...state.confirmations,[party]:true};
 const status=RESOURCE_PARTIES.every(p=>confirmations[p.id])?'simulation-ready':'pending';
 return {...state,confirmations,status,proposed:true,history:[...state.history,{event:`confirm:${party}`,action:`${who.name}：模拟核对责任`,result:`已在课堂中核对${who.name}承担的拟议事项，尚非真实合作确认。`,reason:who.conditions}]};
}

function readSaved(raw:unknown):Record<string,unknown>|null {
 try{const value=typeof raw==='string'?JSON.parse(raw):raw;return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null}catch{return null}
}
function equal(a:unknown,b:unknown){return JSON.stringify(a)===JSON.stringify(b)}
/** Rebuild derived fields from known events rather than trusting saved restrictions. */
export function restoreRules(raw:unknown):RulesState {
 const saved=readSaved(raw);
 if(!saved||saved.schemaVersion!==1||!Array.isArray(saved.history))return initialRules();
 try{
  let state=initialRules();
  for(const item of saved.history){
   if(!item||typeof item!=='object')return initialRules();
   const event=item.event;
   if(event==='choose-menu')state=resetRuleSelection(state);
   else if(event==='choose:first'||event==='choose:repeat'||event==='choose:danger')state=chooseRuleCase(state,event.slice(7) as RuleCase);
   else if(event==='review:uphold'||event==='review:correct')state=reviewRuleCase(state,event.slice(7) as 'uphold'|'correct');
   else if(event==='appeal')state=appealRuleCase(state);
   else return initialRules();
  }
  return ['case','stage','restricted','notice','result','sharedCase','history'].every(key=>equal(saved[key],state[key as keyof RulesState]))?state:initialRules();
 }catch{return initialRules()}
}
/** Real partnership readiness is deliberately absent from this prototype's state. */
export function restoreResourcePlan(raw:unknown):ResourcePlan {
 const saved=readSaved(raw);
 if(!saved||saved.schemaVersion!==1||saved.proposed!==true||!Array.isArray(saved.history))return initialResourcePlan();
 try{
  let state=initialResourcePlan();
  for(const item of saved.history){
   if(!item||typeof item!=='object'||!['confirm:school','confirm:city','confirm:community'].includes(item.event))return initialResourcePlan();
   state=confirmResourceParty(state,item.event.slice(8) as ResourceParty);
  }
  return ['confirmations','status','history'].every(key=>equal(saved[key],state[key as keyof ResourcePlan]))?state:initialResourcePlan();
 }catch{return initialResourcePlan()}
}
