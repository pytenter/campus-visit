export const TARGET_COMPREHENSION=0.8;
export const MIN_COMPREHENSION_SAMPLE=8;
export const CHECK_ITEMS=['open-zone','restricted-zone','help-channel'] as const;
export type ComprehensionItem=typeof CHECK_ITEMS[number];
export type Group='student'|'public'|'staff'|'city';
export interface ComprehensionRecord {
 id:string;
 group:Group;
 understood:ComprehensionItem[];
 task:'digital'|'paper-notice'|'paper-partnership'|'paper-feedback-card';
 note?:string;
}
export interface ObservationRecord {
 id:string;
 date:string;
 slot:'morning'|'noon'|'afternoon'|'evening';
 zone:'gate'|'hall'|'sports'|'route'|'service-desk';
 weather?:'sunny'|'cloudy'|'rain';
 flow:'低'|'中'|'高';
 queueMinutes?:number;
 conflict:string;
 photo?:string;
}
export interface InterviewRecord {
 id:string;
 group:Group;
 durationMinutes:number;
 quotes:string[];
 codes:string[];
 stance:'支持'|'有条件支持'|'反对'|'说不清';
}
export interface FieldworkState {
 schemaVersion:1;
 comprehension:ComprehensionRecord[];
 observations:ObservationRecord[];
 interviews:InterviewRecord[];
}
export type FieldworkEvent=
 |{type:'comprehension:add';record:ComprehensionRecord}
 |{type:'observation:add';record:ObservationRecord}
 |{type:'interview:add';record:InterviewRecord}
 |{type:'comprehension:remove';id:string}
 |{type:'observation:remove';id:string}
 |{type:'interview:remove';id:string};
export interface FieldworkEnvelope extends FieldworkState {events:FieldworkEvent[]}
export const CODEBOOK={
 access:['开放区不清楚','受限区不清楚','求助方式不清楚'],
 cost:['成本无人承担','成本可分散','愿意付费','不愿意付费'],
 fairness:['师生优先','公众公平','名额分配不公'],
 trust:['不信任校方处理','担心个人信息','需要申诉渠道'],
 feasibility:['管理人力不足','制度没必要','现有措施已够'],
} as const;
export type CodeCategory=keyof typeof CODEBOOK;
export type FieldworkCode=typeof CODEBOOK[CodeCategory][number];
export const QUOTA:Record<Group,number>={student:8,public:8,staff:2,city:2};
export const GROUPS:readonly Group[]=['student','public','staff','city'];
export const OBSERVATION_ZONES:readonly ObservationRecord['zone'][]=['gate','hall','sports','route','service-desk'];
export const OBSERVATION_SLOTS:readonly ObservationRecord['slot'][]=['morning','noon','afternoon','evening'];
export type DemandStatus='proposed'|'supported'|'rejected'|'mixed';
export type EvidenceLevel='none'|'classroom'|'field';

export function initialFieldwork():FieldworkState {
 return {schemaVersion:1,comprehension:[],observations:[],interviews:[]};
}
export function emptyFieldworkEnvelope():FieldworkEnvelope {return {...initialFieldwork(),events:[]}}
function includes<T extends string>(values:readonly T[],value:unknown):value is T {return typeof value==='string'&&(values as readonly string[]).includes(value)}
const isObject=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const isText=(value:unknown):value is string=>typeof value==='string'&&value.trim().length>0;
function optionalText(value:unknown):boolean {return value===undefined||typeof value==='string'}
function validComprehension(value:unknown):value is ComprehensionRecord {
 if(!isObject(value)||!isText(value.id)||!includes(GROUPS,value.group)||!Array.isArray(value.understood)||!includes(['digital','paper-notice','paper-partnership','paper-feedback-card'],value.task)||!optionalText(value.note))return false;
 return value.understood.every(item=>includes(CHECK_ITEMS,item))&&new Set(value.understood).size===value.understood.length;
}
function validObservation(value:unknown):value is ObservationRecord {
 if(!isObject(value)||!isText(value.id)||!includes(OBSERVATION_SLOTS,value.slot)||!includes(OBSERVATION_ZONES,value.zone)||!['低','中','高'].includes(value.flow as string)||!isText(value.date)||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||typeof value.conflict!=='string'||!optionalText(value.photo))return false;
 if(value.weather!==undefined&&!includes(['sunny','cloudy','rain'],value.weather))return false;
 return value.queueMinutes===undefined||(typeof value.queueMinutes==='number'&&Number.isFinite(value.queueMinutes)&&value.queueMinutes>=0);
}
export function isFieldworkCode(value:unknown):value is FieldworkCode {
 return typeof value==='string'&&Object.values(CODEBOOK).some(codes=>(codes as readonly string[]).includes(value));
}
function validInterview(value:unknown):value is InterviewRecord {
 return isObject(value)&&isText(value.id)&&includes(GROUPS,value.group)&&typeof value.durationMinutes==='number'&&Number.isFinite(value.durationMinutes)&&value.durationMinutes>0&&Array.isArray(value.quotes)&&value.quotes.length>0&&value.quotes.every(isText)&&Array.isArray(value.codes)&&value.codes.length>0&&value.codes.every(isFieldworkCode)&&new Set(value.codes).size===value.codes.length&&includes(['支持','有条件支持','反对','说不清'],value.stance);
}
function sameIds(records:Array<{id:string}>):boolean {return new Set(records.map(record=>record.id)).size===records.length}
function validEvent(value:unknown):value is FieldworkEvent {
 if(!isObject(value)||typeof value.type!=='string')return false;
 if(value.type==='comprehension:add')return validComprehension(value.record);
 if(value.type==='observation:add')return validObservation(value.record);
 if(value.type==='interview:add')return validInterview(value.record);
 if(value.type==='comprehension:remove'||value.type==='observation:remove'||value.type==='interview:remove')return isText(value.id);
 return false;
}
export function applyFieldworkEvent(state:FieldworkState,event:FieldworkEvent):FieldworkState {
 const collection=event.type.startsWith('comprehension:')?'comprehension':event.type.startsWith('observation:')?'observations':'interviews';
 if('record' in event){
  const record=event.record;
  if(state[collection].some(item=>item.id===record.id))throw new Error('调研记录编号必须唯一。');
  return {...state,[collection]:[...state[collection],record]} as FieldworkState;
 }
 const id=event.id;
 if(!state[collection].some(item=>item.id===id))throw new Error('不能删除不存在的调研记录。');
 return {...state,[collection]:state[collection].filter(item=>item.id!==id)} as FieldworkState;
}
export function appendFieldworkEvent(state:FieldworkEnvelope,event:FieldworkEvent):FieldworkEnvelope {
 const next=applyFieldworkEvent(state,event);
 return {...next,events:[...state.events,event]};
}
export function fieldworkEnvelope(state:FieldworkState):FieldworkEnvelope {
 const events:FieldworkEvent[]=[
  ...state.comprehension.map(record=>({type:'comprehension:add',record}) as const),
  ...state.observations.map(record=>({type:'observation:add',record}) as const),
  ...state.interviews.map(record=>({type:'interview:add',record}) as const),
 ];
 return {...state,events};
}

export interface ComprehensionSummary {
 total:number;
 byItem:Record<ComprehensionItem,{hit:number;rate:number}>;
 allThree:number;
 threshold:typeof TARGET_COMPREHENSION;
 verdict:'not-started'|'below-target'|'meets-target'|'insufficient-n';
 message:string;
}
export function comprehensionSummary(records:ComprehensionRecord[]):ComprehensionSummary {
 const total=records.length;
 const byItem=Object.fromEntries(CHECK_ITEMS.map(item=>{const hit=records.filter(record=>record.understood.includes(item)).length;return [item,{hit,rate:total?hit/total:0}]})) as ComprehensionSummary['byItem'];
 const allThree=total?records.filter(record=>CHECK_ITEMS.every(item=>record.understood.includes(item))).length/total:0;
 const verdict=total===0?'not-started':total<MIN_COMPREHENSION_SAMPLE?'insufficient-n':allThree>=TARGET_COMPREHENSION&&CHECK_ITEMS.every(item=>byItem[item].rate>=TARGET_COMPREHENSION)?'meets-target':'below-target';
 const basis=total===0?'尚未开始测试，无数据。':total<MIN_COMPREHENSION_SAMPLE?'样本不足，暂不判定。':verdict==='meets-target'?'各项及三项全部说出的比例均达到拟定门槛。':'至少一项或三项全部说出的比例低于拟定门槛。';
 const limitation=total?`本结果为 ${total} 位测试者的现场记录，样本量有限，不能推广为全体公众的理解水平。`:'';
 return {total,byItem,allThree,threshold:TARGET_COMPREHENSION,verdict,message:`${basis}${limitation}`};
}
export interface ObservationBucket {n:number;avgQueue:number|null;conflicts:number}
export interface ObservationSummary {
 byZone:Record<string,ObservationBucket>;
 bySlot:Record<string,ObservationBucket>;
 total:number;
 coverage:string[];
 matrix:Record<string,Record<string,number>>;
}
function observationBucket(records:ObservationRecord[]):ObservationBucket {
 const queues=records.filter(record=>record.queueMinutes!==undefined).map(record=>record.queueMinutes!);
 return {n:records.length,avgQueue:queues.length?queues.reduce((a,b)=>a+b,0)/queues.length:null,conflicts:records.filter(record=>record.conflict.trim().length>0).length};
}
export function observationSummary(records:ObservationRecord[]):ObservationSummary {
 const byZone=Object.fromEntries(OBSERVATION_ZONES.map(zone=>[zone,observationBucket(records.filter(record=>record.zone===zone))]));
 const bySlot=Object.fromEntries(OBSERVATION_SLOTS.map(slot=>[slot,observationBucket(records.filter(record=>record.slot===slot))]));
 const matrix=Object.fromEntries(OBSERVATION_ZONES.map(zone=>[zone,Object.fromEntries(OBSERVATION_SLOTS.map(slot=>[slot,records.filter(record=>record.zone===zone&&record.slot===slot).length]))]));
 const coverage=OBSERVATION_ZONES.flatMap(zone=>OBSERVATION_SLOTS.filter(slot=>records.some(record=>record.zone===zone&&record.slot===slot)).map(slot=>`${zone}×${slot}`));
 return {byZone,bySlot,total:records.length,coverage,matrix};
}
export function quotaGap(records:InterviewRecord[]):Record<Group,number> {
 return Object.fromEntries(GROUPS.map(group=>[group,Math.max(0,QUOTA[group]-records.filter(record=>record.group===group).length)])) as Record<Group,number>;
}
export function interviewSummary(records:InterviewRecord[]):{total:number;target:number;byGroup:Record<Group,{n:number;target:number;gap:number}>} {
 const gap=quotaGap(records);
 return {total:records.length,target:Object.values(QUOTA).reduce((a,b)=>a+b,0),byGroup:Object.fromEntries(GROUPS.map(group=>[group,{n:records.filter(record=>record.group===group).length,target:QUOTA[group],gap:gap[group]}])) as Record<Group,{n:number;target:number;gap:number}>};
}

/** 同向=编码方向与受访者立场一致（支持/有条件支持为正、反对为负）；反向=两者相乘为负。 */
const CODE_DIRECTION:Record<FieldworkCode,1|-1>={
 '开放区不清楚':1,'受限区不清楚':1,'求助方式不清楚':1,
 '成本无人承担':1,'成本可分散':1,'愿意付费':1,'不愿意付费':-1,
 '师生优先':1,'公众公平':1,'名额分配不公':1,
 '不信任校方处理':1,'担心个人信息':1,'需要申诉渠道':1,
 '管理人力不足':1,'制度没必要':-1,'现有措施已够':-1,
};
function stanceDirection(stance:InterviewRecord['stance']):1|-1|0 {return stance==='支持'||stance==='有条件支持'?1:stance==='反对'?-1:0}
export function demandStatus(code:string,records:InterviewRecord[]):{status:DemandStatus;n:number;quotes:string[]} {
 if(!isFieldworkCode(code))throw new Error('需求结论只能使用预定义编码。');
 const relevant=records.filter(record=>record.codes.includes(code));
 if(!relevant.length)return {status:'proposed',n:0,quotes:[]};
 if(relevant.some(record=>!record.quotes.length||record.quotes.some(quote=>!quote.trim())))throw new Error('非拟议结论必须附原话引语。');
 const quotes=relevant.flatMap(record=>record.quotes);
 const n=relevant.length;
 const direction=CODE_DIRECTION[code];
 const aligned=relevant.filter(record=>stanceDirection(record.stance)*direction===1).length;
 const opposed=relevant.filter(record=>stanceDirection(record.stance)*direction===-1).length;
 if(n<3)return {status:'mixed',n,quotes};
 if(opposed===n)return {status:'rejected',n,quotes};
 if(aligned/n>=2/3)return {status:'supported',n,quotes};
 return {status:'mixed',n,quotes};
}

function equal(a:unknown,b:unknown):boolean {return JSON.stringify(a)===JSON.stringify(b)}
function parse(raw:unknown):Record<string,unknown>|null {
 try{const value=typeof raw==='string'?JSON.parse(raw):raw;return isObject(value)?value:null}catch{return null}
}
/** Only events are trusted. Saved records and all derived statistics must equal the replay exactly. */
export function restoreFieldwork(raw:unknown):FieldworkState {
 const saved=parse(raw);
 if(!saved||saved.schemaVersion!==1||!Array.isArray(saved.events)||!saved.events.every(validEvent))return initialFieldwork();
 try{
  let replayed=emptyFieldworkEnvelope();
  for(const event of saved.events)replayed=appendFieldworkEvent(replayed,event);
  if(!['comprehension','observations','interviews'].every(key=>Array.isArray(saved[key])&&equal(saved[key],replayed[key as keyof FieldworkState])))return initialFieldwork();
  const state:FieldworkState={schemaVersion:1,comprehension:replayed.comprehension,observations:replayed.observations,interviews:replayed.interviews};
  return sameIds(state.comprehension)&&sameIds(state.observations)&&sameIds(state.interviews)?state:initialFieldwork();
 }catch{return initialFieldwork()}
}
export function importFieldwork(text:unknown):FieldworkState {return restoreFieldwork(text)}
export function exportFieldwork(state:FieldworkState|FieldworkEnvelope):string {
 const envelope='events'in state?state:fieldworkEnvelope(state);
 return JSON.stringify({schemaVersion:1,comprehension:envelope.comprehension,observations:envelope.observations,interviews:envelope.interviews,events:envelope.events});
}
