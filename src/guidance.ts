import type {AppState,Layout} from './domain';

export interface Guidance {
 courseTopic?:string;
 step: number;
 role: string;
 goal: string;
 next: string;
 why: string;
 action?: string;
 label?: string;
 highlights?: string[];
}
export interface GuidanceContext {
 stage:string;
 state:AppState;
 selected:boolean;
 role:'visitor'|'student'|'staff';
 playing:boolean;
 observed:ReadonlySet<Layout>;
 walking:boolean;
 arrived:boolean;
}
// Guidance describes the same state as the campus; it never makes a choice for the visitor.
export function getGuidance(c:GuidanceContext):Guidance {
 const {stage,state,selected,role,playing,observed}=c;
 const receipt=state.receipts.at(-1);
 const visitor=state.identity?`访客 ${state.identity}`:'访客';
 const common={step:1,role:visitor,why:'整个体验分三步：先选规则，再挪签到桌，最后让修改对下一位访客生效。'};
 const g=(value:Partial<Guidance>&Pick<Guidance,'goal'|'next'>):Guidance=>({...common,...value});
 switch(stage){
 case 'course':return g({step:0,role:'课程原型体验者',goal:'先看原报告的三项制度创新',next:'分别查看规则协作、资源互惠、自愿共建；再开始开放日情境，观察制度要解决的问题。',why:'依据期中汇报第6至12页，创新对象包括规则、责任关系和参与方式。'});
 case 'course-rules':return g({step:0,role:'本校工作人员（模拟）',goal:'创新一：规则协作怎样兼顾秩序与复核',next:'选择一种情境，比较初次误入、反复扰乱与即时危险的不同处理，再查看申诉和跨校边界。',why:'原报告第8、19页只提议共享规则模板与匿名案例，个人信息共享和联合限入另行论证。'});
 case 'course-resources':return g({step:0,role:'校城资源协调员（模拟）',goal:'创新二：把开放成本写到具体责任方',next:'核对活动容量、学生保留、交通保洁支持和回馈资源，分别模拟学校、城市与社区的责任确认。',why:'原报告第9、17页要求明确容量、时段与成本承担者；本页确认只表示模拟核对，不代表已合作。'});
 case 'course-participation':return g({step:0,role:'自愿参与的公众',goal:'创新三：让意见得到评审和结果',next:'进入开放日观察通行问题，再提交纸卡或电子意见，由学生和工作人员共同评审，并在下一位来访时核验。',why:'原报告第10、11页要求自愿参与、纸卡与电子渠道、共同评审、反馈结果。普通参观不要求参与。'});
 case 'course-review':return g({step:0,role:'课程汇报者',goal:'用本次操作说明制度原型，保留证据边界',next:'看哪些操作已经做过、哪些环节还没完成，以及哪些仍是拟议。模拟结果不能当成真实试点成效。',why:'原报告第12、13页提出原型测试与四周迭代计划，实际效果仍待观察、访谈和情境测试。'});
 case 'welcome':return g({step:0,role:'准备开始',goal:'用四分钟，体验校园开放制度怎样运作',next:'点“开始开放日”，按提示完成三个小任务。可直接用按钮推进，也能在校园里自由走动。',action:'start',label:'开始第一步：定规则'});
 case 'policy':return g({role:'制定规则的老师',goal:'决定 12 个公众名额怎样发放',next:'在下面选 A 或 B，任意选一个。现在还不知道你会成为哪位申请人。',why:'先定规则再揭晓身份，才能观察同一条规则对不同人的影响。A 全给线上；B 留 4 席给现场。',highlights:['policy:A','policy:B']});
 case 'reveal':return g({goal:`规则已执行，现在你是 ${state.identity}`,next:'点“领取结果卡”，看看自己有没有席位，以及为什么。',why:'角色已经从老师切换为申请人。这个身份会保留，之后换规则也不会重新抽取。',action:'claim',label:'下一步：领取我的结果卡'});
 case 'card':{
  const compared=state.logs.some(log=>log.action==='更改名额规则');
  return g({goal:compared?'名额规则已比较，接下来去看现场':'先看自己的结果，再试另一条规则',next:compared?'点“前往展馆”，进入第二步：观察排队会不会挡住学生。':'建议点“换一条规则”，比较同一个人能否参加。未获席位也可以继续参观。',why:'只改发放规则，身份、16人名单和顺序都不变；两种规则都有4人新获得、4人失去、8人结果不变。',action:compared?'visit-hall':'switch-policy',label:compared?'下一步：前往展馆':'下一步：换规则，比较结果'});
 }
 case 'replay':{
  const base={step:2,role:'现场观察员',why:'固定两位访客 O01、O02 和学生 S01，重放相同顺序。要比较的是：学生是否被挡住，访客是否要多走路。'};
  if(selected&&state.preview==='front')return g({...base,goal:'桌子已选中，选一个新位置',next:'点“落点 · 侧廊（试摆）”。桌子、队列、方向牌和路线会一起移动。',action:'layout:side',label:'下一步：试摆到侧廊'});
  if(playing)return g({...base,goal:state.preview==='front'?'正在重放：看学生会在哪里停下':'正在重放：比较学生与访客的路',next:state.preview==='front'?'看蓝衣学生 S01：约第9秒会被队尾挡住。重放约17秒，可点“学生来向”换个角度。':'看蓝衣学生 S01 顺利通过，再看 O01、O02 绕到侧廊；访客比原来多走2格。',action:'go:student',label:'换到学生来向观察'});
  if(state.preview==='side'&&observed.has('side'))return g({...base,goal:'你看到了取舍：学生通畅，访客绕行',next:'点“把建议交给服务台”。现在只是试摆，还没有影响下一位访客。',action:'feedback',label:'下一步：提交改进建议'});
  if(state.preview==='side')return g({...base,goal:'侧廊已试摆，再看同样三个人走一次',next:'点“同一时刻重放”。观察学生是否通过，以及两名访客多走的路。',action:'replay',label:'下一步：重放侧廊方案'});
  if(observed.has('front'))return g({...base,goal:'门前队尾挡住了学生，试着挪桌',next:'先点场景里的签到桌，或下方“选中签到桌”；再选侧廊落点。',action:'select-desk',label:'下一步：选中签到桌'});
  return g({...base,goal:'先看门前签到有什么问题',next:'点“同一时刻重放”，看蓝衣学生 S01 是否被排队的访客挡住。',action:'replay',label:'下一步：播放门前布局'});
 }
 case 'feedback':return g({step:3,role:visitor,goal:'把试摆建议变成一张可追踪的意见',next:'点“提交电子意见”或“投递纸卡”。提交后还需要学生代表、工作人员各自确认。',why:'试摆只供观察。提出意见、两方确认并发布后，下一位访客才会遇见新版现场。',action:'submit:electronic',label:'下一步：提交电子意见',highlights:['submit:electronic','submit:paper']});
 case 'review':{
  const base={step:3,why:'这里由你轮流扮演两位审核人，不用找真人。学生代表确认通行，工作人员确认值守。两方都通过后才能发布；暂缓会保留原因。'};
  if(role!=='visitor')return g({...base,role:role==='student'?'学生代表':'工作人员',goal:role==='student'?'检查学生通道能否连续通行':'检查侧廊值守与原位置箭头',next:'阅读下面的条件；条件满足就点“确认条件通过”，不满足可点“暂缓”。',highlights:['approve','hold']});
  if(receipt?.status==='published')return g({...base,role:visitor,goal:'新版已发布，现在验证它真的生效',next:'点“接待下一位访客”，回到校门。下一轮将使用已发布的桌位和箭头。',action:'next',label:'下一步：接待下一位访客'});
  if(receipt?.status==='ready')return g({...base,role:visitor,goal:'两方都已通过，还差发布这一步',next:'点“双方通过后发布新版本”。只确认、不发布，下一位仍会遇见旧现场。',action:'publish',label:'下一步：发布新版本'});
  const pending=receipt?.reviews.student?.decision!=='approved'?'student':'staff';
  const held=receipt?.reviews[pending]?.decision==='held';
  return g({...base,role:visitor,goal:held?'意见已暂缓，需要重新确认条件':'意见已收件，接着完成两方确认',next:`${held?'先查看暂缓原因，再':'先'}点“切换${pending==='student'?'学生代表':'工作人员'}”，阅读条件并决定通过或暂缓。`,action:`role:${pending}`,label:`下一步：切换${pending==='student'?'学生代表':'工作人员'}`});
 }
 case 'next':return g({step:3,role:'下一位访客',goal:c.walking?'正在按正式路线前往展馆':c.arrived?'已经走完这次开放日':'回到校门，验证现场有没有真的改变',next:c.walking?'正在自动沿路线前进，请稍等。留意签到桌在哪里、原位置有没有箭头。':c.arrived?'你已到达展馆。可以查看服务台制度，或到“决策记录”回看每次选择影响了谁。':`点“按现场路线走到展馆”。${state.active.layout==='side'?'这次应看见侧廊桌子和原位置箭头。':'尚无新版生效，这次仍是门前签到。'}`,why:'这一轮只读取正式发布版本，临时试摆不会混入现场。',action:c.walking?undefined:c.arrived?'course-review':'follow-route',label:c.arrived?'回看课程问题与本次证据':'下一步：沿正式路线走一遍'});
 case 'allocation':return g({goal:'正在逐人查看名额结果',next:'用“上一位 / 下一位”看每张卡。看完点“返回体验”，继续刚才的任务。'});
 case 'receipt':return g({step:3,goal:'正在查看意见处理到哪一步',next:'看学生代表与工作人员的确认状态；点“返回审批面板”继续审核或发布。',action:'back-review',label:'返回审批，继续当前任务'});
 case 'history':return g({step:3,goal:'正在回看自己的决定',next:'每条记录都写着影响了谁、结果和原因。看完点“返回体验”继续。'});
 case 'service':return g({step:3,goal:'了解开放日需要谁共同支持',next:'阅读学校、社区、城市的安排；也可以看“两校共享的匿名案例”。'});
 case 'case':return g({step:3,goal:'了解误入限制区域后怎样得到帮助',next:'阅读指路、复核与申诉流程；看完可返回体验。'});
 case 'info-public':return g({step:2,goal:'这里是所有访客都能参观的展台',next:'没有工作坊席位也能看。点“返回体验”继续当前任务。'});
 case 'info-restriction':return g({step:2,goal:'你正在了解这处限制的原因',next:'看完说明可返回体验，或到服务台了解复核与申诉。'});
 default:return g({step:0,role:'体验者',goal:'了解操作方式',next:'电脑可直接点左侧按钮；手机点下方按钮。点击“返回体验”继续。'});
 }
}
