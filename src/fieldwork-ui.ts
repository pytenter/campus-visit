import type {PanelButton} from './components';
import {CODEBOOK,CHECK_ITEMS,GROUPS,QUOTA,TARGET_COMPREHENSION,comprehensionSummary,observationSummary,interviewSummary,quotaGap,demandStatus,type FieldworkEnvelope,type Group,type ComprehensionItem,type ObservationRecord} from './fieldwork';

export type ButtonFactory=(label:string,action:string,muted?:boolean)=>PanelButton;
export interface Panel {act:number;title:string;body:string;buttons:PanelButton[]}
export type FieldworkDraftTask='digital'|'paper-notice'|'paper-partnership'|'paper-feedback-card';
export type FieldworkStance='支持'|'有条件支持'|'反对'|'说不清';
export type FieldworkZone=ObservationRecord['zone'];
export type FieldworkSlot=ObservationRecord['slot'];
export type FieldworkFlow=ObservationRecord['flow'];
export interface FieldworkUiState {
 group:Group;
 task:FieldworkDraftTask;
 slot:FieldworkSlot;
 zone:FieldworkZone;
 flow:FieldworkFlow;
 stance:FieldworkStance;
 checks:Set<ComprehensionItem>;
 codes:Set<string>;
}
export const groupNames:Record<Group,string>={student:'学生',public:'公众',staff:'校方',city:'城市'};
export const itemNames:Record<ComprehensionItem,string>={'open-zone':'开放区','restricted-zone':'受限区','help-channel':'求助方式'};
export const zoneNames:Record<FieldworkZone,string>={gate:'校门',hall:'展馆',sports:'运动场',route:'路线','service-desk':'服务台'};
export const slotNames:Record<FieldworkSlot,string>={morning:'上午',noon:'中午',afternoon:'下午',evening:'傍晚'};
export const TASKS:readonly FieldworkDraftTask[]=['digital','paper-notice','paper-partnership','paper-feedback-card'];
export const STANCES:readonly FieldworkStance[]=['支持','有条件支持','反对','说不清'];
export const FLOWS:readonly FieldworkFlow[]=['低','中','高'];
export const taskNames:Record<FieldworkDraftTask,string>={digital:'电子测试','paper-notice':'纸面·公告','paper-partnership':'纸面·协作卡','paper-feedback-card':'纸面·反馈卡'};
const verdictNames:Record<string,string>={'not-started':'尚未开始','insufficient-n':'样本不足，暂不判定','below-target':'低于拟定门槛','meets-target':'达到拟定门槛'};
const demandNames:Record<string,string>={proposed:'无现场记录，仍是拟议',supported:'有现场支持',rejected:'现场反向',mixed:'分歧或证据不足'};
const percent=(rate:number)=>`${Math.round(rate*100)}%`;

export function fieldworkTestPanel(b:ButtonFactory,state:FieldworkEnvelope,ui:FieldworkUiState):Panel {
 const picked=[...ui.checks].map(item=>itemNames[item]).join('、')||'尚未勾选';
 return {act:0,title:'调研录入：只记原始观察',body:`只记录测试者当场能自主说出或指出的内容，不写姓名。\n当前对象：${groupNames[ui.group]}；理解测试任务：${taskNames[ui.task]}。\n本位勾选：${picked}。\n访谈编码：${[...ui.codes].join('、')||'尚未勾选'}。\n已存：理解测试 ${state.comprehension.length} 条 / 现场观察 ${state.observations.length} 条 / 访谈 ${state.interviews.length} 条。`,buttons:[
  ...GROUPS.map(group=>b(`${ui.group===group?'● ':'○ '}${groupNames[group]}`,`fieldwork:group:${group}`,ui.group!==group)),
  ...TASKS.map(task=>b(`${ui.task===task?'● ':'○ '}${taskNames[task]}`,`fieldwork:task:${task}`,ui.task!==task)),
  ...CHECK_ITEMS.map(item=>b(`${ui.checks.has(item)?'✓ ':'○ '}${itemNames[item]}`,`fieldwork:test:toggle:${item}`,!ui.checks.has(item))),
  b('保存本位理解测试','fieldwork:test:save'),
  b('填写现场观察','fieldwork:observation-form',true),
  b('填写访谈、引语与编码','fieldwork:interview-form',true),
  b('查看统计与覆盖缺口','fieldwork:report',true),
  b('返回课程复盘','course-review',true),
 ]};
}

export function fieldworkReportPanel(b:ButtonFactory,state:FieldworkEnvelope):Panel {
 const c=comprehensionSummary(state.comprehension),o=observationSummary(state.observations),i=interviewSummary(state.interviews);
 const items=CHECK_ITEMS.map(item=>`${itemNames[item]} ${percent(c.byItem[item].rate)}（${c.byItem[item].hit}/${c.total}）`).join('；');
 const coverage=(Object.keys(o.matrix) as FieldworkZone[]).map(zone=>`${zoneNames[zone]}：${Object.values(o.matrix[zone]).join('/')}`).join('\n');
 const groups=GROUPS.map(group=>`${groupNames[group]} ${i.byGroup[group].n}/${QUOTA[group]}`).join('；');
 const gap=quotaGap(state.interviews);
 const codes=Object.values(CODEBOOK).flat().map(code=>{const d=demandStatus(code,state.interviews);return `${code}：${demandNames[d.status]}（n=${d.n}）`}).join('\n');
 const quotes=state.interviews.flatMap(record=>record.quotes.map(quote=>`${record.id} ${groupNames[record.group]}：「${quote}」`));
 return {act:0,title:'调研统计：数据与结论分开',body:`理解测试 ${c.total} 条，门槛 ${percent(TARGET_COMPREHENSION)}（拟定值，尚未实测）：${verdictNames[c.verdict]}。\n${items}；三项全部说出 ${percent(c.allThree)}。\n${c.message}\n访谈 ${i.total}/${i.target}：${groups}；仍缺 ${GROUPS.map(group=>`${groupNames[group]}${gap[group]}`).join('、')}。\n现场观察 ${o.total} 条；区域×时段（上午/中午/下午/傍晚，0 即空缺）：\n${coverage}\n编码状态（不足三条或方向不一致时一律不作结论）：\n${codes}\n${quotes.length?'已录入原话：\n'+quotes.join('\n'):'尚无访谈原话，因此不产生任何“已证实”结论。'}`,buttons:[
  b('继续录入','fieldwork:test:new'),
  b('查看匿名记录','fieldwork:records',true),
  b('导出全部调研 JSON','fieldwork:export',true),
  b('导入调研 JSON','fieldwork:import',true),
  b('返回课程复盘','course-review',true),
 ]};
}

export function fieldworkDrawer(kind:'observation'|'interview'|'records'|'import',state:FieldworkEnvelope,ui:FieldworkUiState,esc:(text:string)=>string):string {
 const groupOptions=GROUPS.map(group=>`<option value="${group}" ${ui.group===group?'selected':''}>${groupNames[group]}</option>`).join('');
 if(kind==='observation')return `<label>匿名编号<input id="obs-id" value="O-${String(state.observations.length+1).padStart(2,'0')}"></label><label>日期<input id="obs-date" type="date"></label><label>时段<select id="obs-slot">${(Object.keys(slotNames) as FieldworkSlot[]).map(slot=>`<option value="${slot}" ${ui.slot===slot?'selected':''}>${slotNames[slot]}</option>`).join('')}</select></label><label>区域<select id="obs-zone">${(Object.keys(zoneNames) as FieldworkZone[]).map(zone=>`<option value="${zone}" ${ui.zone===zone?'selected':''}>${zoneNames[zone]}</option>`).join('')}</select></label><label>天气<select id="obs-weather"><option value="">未记录</option><option value="sunny">晴</option><option value="cloudy">阴</option><option value="rain">雨</option></select></label><label>人流<select id="obs-flow">${FLOWS.map(flow=>`<option ${ui.flow===flow?'selected':''}>${flow}</option>`).join('')}</select></label><label>排队分钟（可空）<input id="obs-queue" type="number" min="0" step="1"></label><label>冲突原始描述<input id="obs-conflict" placeholder="没有冲突也请如实填写，如：未见冲突"></label><label>照片文件名（可空）<input id="obs-photo" placeholder="只记文件名，不上传图片"></label><button data-action="fieldwork:observation:save">保存观察</button>`;
 if(kind==='interview')return `<label>匿名编号<input id="int-id" value="I-${String(state.interviews.length+1).padStart(2,'0')}"></label><label>对象<select id="int-group">${groupOptions}</select></label><label>访谈分钟<input id="int-duration" type="number" min="1" value="10"></label><label>立场<select id="int-stance">${STANCES.map(stance=>`<option ${ui.stance===stance?'selected':''}>${stance}</option>`).join('')}</select></label><label>原话引语（每行一条，必填）<textarea id="int-quotes" rows="4"></textarea></label><fieldset><legend>只选预定义编码</legend>${Object.values(CODEBOOK).flat().map(code=>`<label><input type="checkbox" name="fieldwork-code" value="${esc(code)}">${esc(code)}</label>`).join('')}</fieldset><button data-action="fieldwork:interview:save">保存访谈</button>`;
 if(kind==='records')return `<h3>理解测试</h3>${state.comprehension.map(record=>`<p>${esc(record.id)} / ${groupNames[record.group]} / ${record.understood.map(item=>itemNames[item]).join('、')||'未说出'} / ${taskNames[record.task]}</p>`).join('')||'<p>无记录</p>'}<h3>访谈原话</h3>${state.interviews.map(record=>`<p>${esc(record.id)} / ${groupNames[record.group]} / ${esc(record.stance)}<br>${record.quotes.map(esc).join('<br>')}<br>编码：${record.codes.map(esc).join('、')}</p>`).join('')||'<p>无记录</p>'}<h3>现场观察</h3>${state.observations.map(record=>`<p>${esc(record.id)} / ${esc(record.date)} / ${slotNames[record.slot]} / ${zoneNames[record.zone]} / ${record.flow}<br>${esc(record.conflict)}</p>`).join('')||'<p>无记录</p>'}`;
 return `<label>粘贴导出的调研 JSON<textarea id="int-json" rows="8"></textarea></label><button data-action="fieldwork:import:save">导入并替换当前记录</button><p>导入按事件重放核对，记录与统计不一致时整份拒绝。</p>`;
}
