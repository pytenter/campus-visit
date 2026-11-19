import {currentCard,metrics,type AppState} from './domain';
import type {RulesState,ResourcePlan,ResourceParty} from './institutions';

/** Text checked against the supplied 20-slide midterm presentation. */
export const COURSE_TITLE='大学校园开放制度的创新设计';
export const COURSE_QUESTION='我们如何在保护教学与生活空间的前提下，让不同能力的公众公平获得大学资源，并让开放成本由多方共同承担？';
export const COURSE_MECHANISMS:ReadonlyArray<{
 id:'rules'|'resources'|'participation';name:string;question:string;proposal:string;slides:string;origin:string;experiment:string;
}>=[
 {
  id:'rules',name:'校际规则协作',question:'违反规则怎样处理？',
  proposal:'初次误入先说明边界并指路；反复扰乱由本校留证、告知并复核。先试两校共享规则模板与匿名案例，保留理由、期限和申诉入口。',
  slides:'第7—8页、附录第19页',
  origin:'原报告创新一：分级处理与复核流程。个人信息共享和联合限入另行论证。',
  experiment:'选择初次误入、反复扰乱或即时危险情境；在本地操作本校复核、处理通知与申诉更正，并保留匿名案例。全部是课堂模拟，尚未进行真实跨校联调。',
 },
 {
  id:'resources',name:'大学与城市资源互惠',question:'开放成本谁来分担？',
  proposal:'高校提供展览、科普活动与有余量场馆时段；城市支持接驳、保洁和运营，并提供学生可预约的体育文化资源。清单写清容量、时段和成本承担者，师生日常使用优先。',
  slides:'第7、9页、附录第17页',
  origin:'原报告创新二：资源与成本责任清单。每周一场活动和资源容量都是拟议填写示例。',
  experiment:'查看容量、时段、责任方与成本缺口，轮流模拟核对学校、城市与社区的责任。三方模拟就绪仍是拟议清单，全部安排待真实管理方确认。',
 },
 {
  id:'participation',name:'游客参与校园共建',question:'公众怎样参与维护？',
  proposal:'公众自愿观察路线问题，使用纸卡或电子入口提交意见；学生与工作人员共同评审，说明采纳改动或未采纳原因。普通参观无需参与，志愿者不替代安保与保洁岗位。',
  slides:'第7、10—12页',
  origin:'原报告创新三：自愿观察与意见反馈；原拟议项目是无障碍路线反馈。',
  experiment:'把签到桌试摆意见交给两位角色复核，取得本地回执；发布后接待下一位访客，核对桌位和箭头。这是反馈流程的课堂情境延展。',
 },
];

export interface CourseContext {
 topic:string;
 question:string;
 evidence:string;
 connection:string;
 slides:string;
}
export interface CoursePrototypes {rules:RulesState;resources:ResourcePlan}
const RESOURCE_NAMES:Record<ResourceParty,string>={school:'学校',city:'城市',community:'社区'};
const RESOURCE_ORDER:ResourceParty[]=['school','city','community'];
function simulatedResourceParties(plan?:ResourcePlan):ResourceParty[]{
 return RESOURCE_ORDER.filter(party=>plan?.confirmations[party]&&plan.history.some(item=>item.event===`confirm:${party}`));
}
function rulesSimulationEvidence(rules?:RulesState):string {
 if(!rules||!rules.history.some(item=>item.event.startsWith('choose:')))return '尚未操作本校处理模拟。可选择初次误入、反复扰乱或即时危险，比较处理、复核和申诉的不同步骤。';
 const boundary='上述结果只在课堂情境中生效，未开展真实跨校试点。';
 if(rules.notice?.status==='corrected'&&!rules.restricted&&rules.history.some(item=>item.event==='review:correct'))return `本校角色已撤销并更正拟议处理，当前模拟限制已解除。${rules.notice.reason}${boundary}`;
 if(rules.stage==='appeal')return `已登记本地模拟申诉，等待本校重新核对人员、证据、相称性和期限；原模拟通知仍待复核结论。${boundary}`;
 if(rules.stage==='notice'&&rules.notice?.status==='reviewed')return `已由本校角色复核并模拟发出通知，告知事实、理由、本校范围、结束时间与申诉入口；当前仅在情境中保留拟议限制。${boundary}`;
 if(rules.stage==='review')return `已生成本地模拟处理草案，尚未限制资格；等待本校核对证据与处理是否相称。${boundary}`;
 if(rules.stage==='guidance')return `已模拟初次误入的边界解释与公共路线指引，没有限制资格；可共享匿名指路案例，不触发跨校联动。${boundary}`;
 if(rules.stage==='emergency')return `已选择即时危险分支：按既有应急流程交专业人员响应，不生成普通参访资格处理。本地未发出真实报警或处罚。${boundary}`;
 return `当前回到情境选择，保留了${rules.history.length}条本地模拟操作记录。${boundary}`;
}
function resourceSimulationEvidence(plan?:ResourcePlan):string {
 const done=simulatedResourceParties(plan),missing=RESOURCE_ORDER.filter(party=>!done.includes(party));
 const boundary='容量、时段、人时与费用仍待真实管理方确认，未达成真实合作。';
 if(!done.length)return `三方尚未操作责任核对。当前清单列出容量、时段、责任方与成本缺口，全部为拟议示例。${boundary}`;
 if(!missing.length&&plan?.status==='simulation-ready')return `学校、城市与社区已在课堂中完成三方责任核对，当前仅为“模拟就绪”。${boundary}`;
 return `已在课堂核对${done.map(party=>RESOURCE_NAMES[party]).join('、')}的拟议责任；${missing.length?missing.map(party=>RESOURCE_NAMES[party]).join('、')+'仍待模拟核对':'模拟状态尚待核对'}。${boundary}`;
}
const hasLog=(state:AppState,action:string)=>state.logs.some(log=>log.action===action);
const latest=(state:AppState)=>state.receipts.at(-1);
function participationEvidence(state:AppState):string {
 const receipt=latest(state);
 if(state.active.version>1&&state.active.layout==='side'&&state.active.arrow&&(!receipt||receipt.status==='published'&&(receipt.version??0)<=state.active.version)){
  const pendingVersion=state.published.version>state.active.version?`另有v${state.published.version}已发布，等待下一轮采用。`:'';
  return `本轮现场已采用v${state.active.version}：侧廊签到、原位置增加箭头。${pendingVersion}这是本地课堂原型中的现场变化。`;
 }
 if(!receipt)return state.nextVisits>0?'你没有提交意见，已作为普通访客继续参观；现场仍采用v1。参与反馈始终自愿。':'尚未提交意见；移动桌子只改变试摆，下一位访客仍使用正式版本。';
 if(receipt.status==='held'){
  const reasons=Object.values(receipt.reviews).filter(review=>review?.decision==='held').map(review=>review!.reason).join('；');
  return `回执${receipt.id}暂缓：${reasons}。现场尚未采用这次建议。`;
 }
 if(receipt.status==='ready')return `回执${receipt.id}已由两方通过，但尚未发布；下一位访客不会自动使用试摆方案。`;
 if(receipt.status==='published')return `回执${receipt.id}已发布为v${receipt.version}；当前现场仍为v${state.active.version}，需要接待下一位访客才能核对生效。`;
 const confirmed=[receipt.reviews.student?.decision==='approved'?'学生代表':null,receipt.reviews.staff?.decision==='approved'?'工作人员':null].filter(Boolean);
 return `已生成回执${receipt.id}；${confirmed.length?`${confirmed.join('、')}已确认，另一方仍待复核`:'学生代表与工作人员尚待复核'}。`;
}

/** Current learning question and only the evidence supported by this run. */
export function courseContext(stage:string,state:AppState,prototypes?:CoursePrototypes):CourseContext {
 if(['policy','reveal','card','allocation'].includes(stage)){
  const card=currentCard(state);
  const lastChange=[...state.logs].reverse().find(log=>log.action==='更改名额规则');
  const allocation=state.policy?`规则${state.policy}已执行：${state.policy==='A'?'12席线上、0席现场':'8席线上、4席现场'}。`:'还没有执行名额规则。';
  const result=state.cardClaimed&&card?`${card.id}${card.admitted?'取得':'未取得'}工坊席位，公共路线仍可参观。`:'';
  return {
   topic:'公平获取资源与低数字门槛',question:'名额同样有限，线上和现场的分配方式会让谁得到机会？',
   evidence:`${allocation}${result}${lastChange?lastChange.result:''}`,
   connection:'对应原报告的公平获取、低数字门槛与师生需求优先。这段是名额分配的课堂延展；原报告的“校际规则协作”另以规则模板、匿名案例和复核流程呈现。',
   slides:'第2、5—6、11页；课堂名额情境来自本项目任务书',
  };
 }
 if(stage==='replay'){
  const current=metrics(state.preview),front=metrics('front'),side=metrics('side');
  return {
   topic:'教学生活优先与开放成本的取舍',question:'便利访客的安排，会不会让赶去上课的学生承担代价？',
   evidence:`当前${state.preview==='front'?'门前':'侧廊'}试摆：访客走${current.steps}格，队列与学生通道重叠${current.overlap}格。门前为${front.steps}格、重叠${front.overlap}格；侧廊为${side.steps}格、重叠${side.overlap}格。`,
   connection:'对应原报告的学生通行、人流干扰与成本分担。格网显示一种空间取舍，实际校园效果仍待观察验证；挪桌本身尚未落实大学与城市的资源互惠清单。',
   slides:'第5—6、13页；9×7格网与人物重放来自本项目任务书',
  };
 }
 if(['feedback','review','receipt','next','participation','course-participation'].includes(stage))return {
  topic:'创新三：游客参与校园共建',question:'一条访客建议，怎样经过共同评审并改变下一次参观？',
  evidence:participationEvidence(state),
  connection:'对应原报告“自愿选择、提交意见、共同评审、反馈结果”。回执和下一轮现场用于检查本地反馈流程是否跑通，尚不能证明真实公众的参与意愿或试点成效。',
  slides:'第7、10—12页',
 };
 if(['case','info-restriction','rules','course-rules'].includes(stage))return {
  topic:'创新一：校际规则协作',question:'初次误入时怎样友善指路，又怎样保证处理可以复核与申诉？',
  evidence:rulesSimulationEvidence(prototypes?.rules),
  connection:'对应原报告的分级处理、说明理由与期限、保留申诉入口。两校目前共享的是拟议规则模板和匿名案例；个人信息共享与联合限入仍须另行论证。',
  slides:'第7—8页、附录第19页',
 };
 if(['service','resources','course-resources'].includes(stage))return {
  topic:'创新二：大学与城市资源互惠',question:'谁提供活动，谁承担接驳、维护和值守，又给学生什么回馈？',
  evidence:resourceSimulationEvidence(prototypes?.resources),
  connection:'对应原报告的资源与成本责任清单。展示清单用于讨论责任安排，尚未完成实际资源确认、成本核算或合作执行。',
  slides:'第7、9页、附录第17页',
 };
 if(['history','course-review','course-summary'].includes(stage))return {
  topic:'回看原型证据与尚未验证的部分',question:'这一轮实际做到了什么，还有哪些课程问题需要实地研究？',
  evidence:courseReview(state,prototypes).summary,
  connection:'原报告把理解规则、确认责任和查询反馈列为原型测试任务。程序可运行与课堂统计属于原型证据，不能替代访谈、管理方确认与真实场景测试。',
  slides:'第12—13、20页',
 };
 return {
  topic:'课程总问题：怎样共享才可持续？',question:COURSE_QUESTION,
  evidence:'原报告提出校际规则协作、大学与城市资源互惠、游客参与校园共建三项机制。网站用一个周六情境让你检查其中的规则、责任和反馈关系。',
  connection:'名额分配与挪桌是任务书增加的课堂推演；原报告三项创新需分别查看规则案例、互惠清单与共建反馈。全部制度情境与资源额度仍属拟议。',
  slides:'第1、6—7、20页',
 };
}

export interface CourseReviewItem {
 id:string;
 title:string;
 status:'completed'|'pending'|'proposed';
 statusLabel:string;
 evidence:string;
 connection:string;
 slides:string;
}
export interface CourseReview {summary:string;boundary:string;items:CourseReviewItem[]}

/** A simulated local publication is distinct from a field-tested institution. */
export function courseReview(state:AppState,prototypes?:CoursePrototypes):CourseReview {
 const compared=state.logs.some(log=>log.action==='更改名额规则'&&(log.reason.includes('规则 A 改成 B')||log.reason.includes('规则 B 改成 A')))&&hasLog(state,'窗口领取结果卡');
 const change=[...state.logs].reverse().find(log=>log.action==='更改名额规则');
 const simulatedSide=state.logs.some(log=>log.action==='临时试摆签到桌'&&log.result.includes('侧廊方案'));
 const proof=state.receipts.find(receipt=>receipt.status==='published'&&receipt.version===state.active.version&&receipt.reviews.student?.decision==='approved'&&receipt.reviews.staff?.decision==='approved');
 const live=Boolean(proof&&state.active.version>1&&state.active.layout==='side'&&state.active.arrow&&state.active.version<=state.published.version&&state.logs.some(log=>log.action==='发布新版本'&&log.result.includes(`v${state.active.version} `))&&state.logs.some(log=>log.action==='接待下一位访客'&&log.result.includes(`v${state.active.version}：`)));
 const receipt=latest(state);
 const rules=prototypes?.rules,resources=prototypes?.resources;
 const simulatedCases=new Set(rules?.history.filter(item=>item.event.startsWith('choose:')).map(item=>item.event)||[]);
 const confirmedParties=simulatedResourceParties(resources);
 const rulesLabel=!simulatedCases.size?'拟议流程，尚未操作':rules?.notice?.status==='corrected'&&!rules.restricted?'拟议流程，模拟处理已撤销更正':rules?.stage==='appeal'?'拟议流程，模拟申诉待复核':rules?.stage==='notice'?'拟议流程，已模拟发出本校通知':rules?.stage==='guidance'?'拟议流程，已模拟解释并指路':rules?.stage==='emergency'?'拟议流程，已查看专业响应分支':'拟议流程，本校模拟复核待完成';
 const resourcesLabel=confirmedParties.length===3&&resources?.status==='simulation-ready'?'拟议清单，三方模拟就绪':`拟议清单，模拟核对${confirmedParties.length}/3`;
 const items:CourseReviewItem[]=[
  {
   id:'allocation',title:'名额分配的公平影响（课堂延展）',status:compared?'completed':'pending',statusLabel:compared?'已完成课堂比较':'尚未完成课堂比较',
   evidence:compared?change!.result:state.policy?`已执行规则${state.policy}；尚未形成“领取结果卡后换规则比较”的完整记录。`:'尚未执行规则并领取结果卡。',
   connection:'用于讨论公平获取与数字门槛。20工位中8席学生、12席公众以及16人名单，是本项目任务书的推演设定。',slides:'第2、5—6、11页',
  },
  {
   id:'layout',title:'学生通行与访客绕行（课堂延展）',status:simulatedSide?'completed':'pending',statusLabel:simulatedSide?'已完成课堂试摆':'尚未完成侧廊试摆',
   evidence:simulatedSide?'本轮记录了侧廊试摆：8格、重叠0格；门前模型为6格、重叠1格。试摆记录不等于已经完整观察过两次重放。':'尚无侧廊试摆记录。可用相同人物重放，比较学生通行与访客绕行。',
   connection:'用于讨论保障教学生活时的空间取舍。9×7格网、固定人物与格数是课程推演，不是现场测量。',slides:'第5—6、13页',
  },
  {
   id:'participation',title:'游客参与校园共建（原报告创新三）',status:live?'completed':'pending',statusLabel:live?'已完成本地反馈闭环':receipt?.status==='held'?'已暂缓，待完善条件':receipt?'尚未完成下一轮生效核对':'尚未参与，可自愿跳过',
   evidence:participationEvidence(state),
   connection:'本地闭环须包括意见、双角色确认、发布及下一轮采用；它验证课堂流程，公众参与意愿与真实效果仍待实测。',slides:'第7、10—12页',
  },
  {
   id:'rules',title:'校际规则协作（原报告创新一）',status:'proposed',statusLabel:rulesLabel,
   evidence:rulesSimulationEvidence(rules),
   connection:'先讨论两校共享规则模板与匿名案例。原报告要求个人信息共享和联合限入另行论证。',slides:'第7—8页、附录第19页',
  },
  {
   id:'resources',title:'大学与城市资源互惠（原报告创新二）',status:'proposed',statusLabel:resourcesLabel,
   evidence:resourceSimulationEvidence(resources),
   connection:'应由资源方共同确认，并提前保留师生日常需求。把桌子挪到侧廊不能单独证明校城互惠机制已落实。',slides:'第7、9页、附录第17页',
  },
  {
   id:'fieldwork',title:'访谈、现场观察与实际成效',status:'pending',statusLabel:'尚待实地验证',
   evidence:'原报告将四周观察、访谈、共创和情境测试列为下一阶段计划。本地点击、回执和格网结果不构成真实试点成效。',
   connection:'第12页的80%理解门槛是拟定目标；第13页的访谈人数是计划样本，均不能写成已实现的数据。',slides:'第12—13、20页',
  },
 ];
 const count=items.slice(0,3).filter(item=>item.status==='completed').length;
 return {
  summary:`课堂情境证据${count}/3项；本校处理模拟${simulatedCases.size?`已体验${simulatedCases.size}种情境`:'尚未开始'}；三方模拟核对${confirmedParties.length}/3${confirmedParties.length===3&&resources?.status==='simulation-ready'?'（仅模拟就绪）':''}。校际协作与校城互惠仍是拟议方案，尚无真实试点成效。`,
  boundary:'原报告第20页明确：全部制度情境、资源额度与测试目标均属拟议，尚无试点成效。本地模拟结果与真实制度成效应分开说明。',
  items,
 };
}
