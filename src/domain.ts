/**
 * 周六开放日的唯一业务模型。此文件不依赖 DOM、A-Frame 或设备能力。
 * 桌面、手机与 XR 的点选都调用相同函数；场景中的坐标来自 LAYOUTS。
 */
export type Policy = 'A' | 'B';
export type Layout = 'front' | 'side';
export type Identity = 'O09' | 'W01';
export type Point = [number, number];
export type Channel = 'online' | 'walk-in';
export interface Allocation {
  id: string;
  channel: Channel;
  rank: number;
  admitted: boolean;
  reason: string;
}
export const APPLICANTS = Object.freeze([
  ...Array.from({ length: 12 }, (_, i) => ({ id: `O${String(i + 1).padStart(2, '0')}`, channel: 'online' as const, rank: i + 1 })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `W${String(i + 1).padStart(2, '0')}`, channel: 'walk-in' as const, rank: i + 1 })),
]);

export function allocate(policy: Policy): Allocation[] {
  const onlineSeats = policy === 'A' ? 12 : 8;
  const walkInSeats = policy === 'A' ? 0 : 4;
  return APPLICANTS.map(person => {
    const capacity = person.channel === 'online' ? onlineSeats : walkInSeats;
    const admitted = person.rank <= capacity;
    const channelName = person.channel === 'online' ? '线上' : '现场';
    const reason = admitted
      ? `规则 ${policy} 给${channelName} ${capacity} 席；${person.id} 在${channelName}排第 ${person.rank}，获得 1 席。`
      : capacity === 0
        ? `规则 ${policy} 把 12 个公众席位全部在线发放，未预留现场席；${person.id} 未获席位，仍可参观公共展台。`
        : `规则 ${policy} 给${channelName} ${capacity} 席；${person.id} 排第 ${person.rank}，超过该渠道名额，仍可参观公共展台。`;
    return { ...person, admitted, reason };
  });
}

export interface ComparisonRow {
  id: string;
  before: boolean;
  after: boolean;
  change: 'gained' | 'lost' | 'same';
  reason: string;
}
export function compare(from: Policy, to: Policy) {
  const before = allocate(from);
  const after = allocate(to);
  const rows: ComparisonRow[] = after.map((person, i) => ({
    id: person.id,
    before: before[i].admitted,
    after: person.admitted,
    change: !before[i].admitted && person.admitted ? 'gained' : before[i].admitted && !person.admitted ? 'lost' : 'same',
    reason: person.reason,
  }));
  return {
    from, to, rows,
    gained: rows.filter(row => row.change === 'gained').map(row => row.id),
    lost: rows.filter(row => row.change === 'lost').map(row => row.id),
    same: rows.filter(row => row.change === 'same').map(row => row.id),
    filledBefore: before.filter(row => row.admitted).length,
    filledAfter: after.filter(row => row.admitted).length,
  };
}

export const GRID = Object.freeze({ width: 9, height: 7, gate: [1, 4] as Point, hall: [7, 4] as Point, cellSize: 2.4 });
const studentPath: Point[] = Array.from({ length: 7 }, (_, i) => [i + 1, 2]);
export interface CampusLayout {
  name: string;
  desk: Point;
  queue: Point[];
  path: Point[];
  studentPath: Point[];
}
export const LAYOUTS: Record<Layout, CampusLayout> = {
  front: {
    name: '门前', desk: [5, 4], queue: [[5, 3], [5, 2]],
    path: [[1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4]],
    studentPath,
  },
  side: {
    name: '侧廊', desk: [4, 5], queue: [[3, 5], [2, 5]],
    path: [[1, 4], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [7, 4]],
    studentPath,
  },
};
const pointKey = (point: Point) => point.join(',');
export function metrics(layout: Layout) {
  const data = LAYOUTS[layout];
  const studentCells = new Set(data.studentPath.map(pointKey));
  return {
    steps: data.path.slice(1).reduce((sum, point, i) => sum + Math.abs(point[0] - data.path[i][0]) + Math.abs(point[1] - data.path[i][1]), 0),
    overlap: new Set(data.queue.filter(point => studentCells.has(pointKey(point))).map(pointKey)).size,
  };
}

export type ReviewRole = 'student' | 'staff';
export type ReviewDecision = 'approved' | 'held';
export interface Review { decision: ReviewDecision; reason: string }
export interface Receipt {
  id: string;
  channel: 'paper' | 'electronic';
  suggestion: string;
  createdAt: number;
  status: 'submitted' | 'held' | 'ready' | 'published';
  reviews: Record<ReviewRole, Review | null>;
  version?: number;
}
export interface DecisionLog {
  id: string;
  at: number;
  action: string;
  who: string[];
  result: string;
  reason: string;
}
export interface PublishedLayout { version: number; layout: Layout; arrow: boolean }
export interface AppState {
  schemaVersion: 1;
  started: boolean;
  policy: Policy | null;
  firstPolicy: Policy | null;
  identity: Identity | null;
  cardClaimed: boolean;
  preview: Layout;
  published: PublishedLayout;
  active: PublishedLayout;
  nextVisits: number;
  receipts: Receipt[];
  logs: DecisionLog[];
}
export const STORAGE_KEY = 'saturday-campus-v1';
export const FEEDBACK_SUGGESTION = '签到桌移到侧廊，在原位置增加箭头';

export function initialState(): AppState {
  return {
    schemaVersion: 1, started: false, policy: null, firstPolicy: null, identity: null,
    cardClaimed: false, preview: 'front',
    published: { version: 1, layout: 'front', arrow: false },
    active: { version: 1, layout: 'front', arrow: false },
    nextVisits: 0, receipts: [], logs: [],
  };
}

function logged(state: AppState, action: string, who: string[], result: string, reason: string): AppState {
  return { ...state, logs: [...state.logs, { id: `L${state.logs.length + 1}`, at: Date.now(), action, who, result, reason }] };
}

export function executePolicy(state: AppState, policy: Policy, random: () => number = Math.random): AppState {
  const identity = state.identity ?? (random() < 0.5 ? 'O09' : 'W01');
  const next = { ...state, started: true, policy, firstPolicy: state.firstPolicy ?? policy, identity, cardClaimed: false };
  if (state.policy) {
    const result = compare(state.policy, policy);
    return logged(next, '更改名额规则', result.rows.map(row => row.id),
      `${result.gained.length} 人新获得、${result.lost.length} 人失去、${result.same.length} 人结果相同；公众席位 ${result.filledAfter}/12。`,
      `保持身份 ${identity}、16 人名单与排序，只把规则 ${state.policy} 改成 ${policy}。新获得：${result.gained.join('、') || '无'}；失去：${result.lost.join('、') || '无'}。`);
  }
  return logged(next, '执行第一轮规则', APPLICANTS.map(person => person.id),
    `公众席位 12/12，学生预留 8/8；执行后揭晓身份 ${identity}。`,
    policy === 'A' ? '12 席按线上编号发放，现场不留席。' : '8 席按线上编号发放，4 席按现场编号发放。');
}

export function currentCard(state: AppState): Allocation | null {
  if (!state.policy || !state.identity) return null;
  return allocate(state.policy).find(person => person.id === state.identity) ?? null;
}
export function claimCard(state: AppState): AppState {
  const card = currentCard(state);
  if (!card) throw new Error('请先在岗亭公告板执行一条规则，再领取身份与结果卡。');
  if (state.cardClaimed) return state;
  return logged({ ...state, cardClaimed: true }, '窗口领取结果卡', [card.id],
    card.admitted ? '获得纸桥工作坊席位，可前往展馆签到。' : '未获得工作坊席位，可继续走公共路线并参观公共展台。', card.reason);
}

export function previewLayout(state: AppState, layout: Layout): AppState {
  const data = metrics(layout);
  return logged({ ...state, preview: layout }, '临时试摆签到桌', ['O01', 'O02', 'S01'],
    `${LAYOUTS[layout].name}方案：访客走 ${data.steps} 格，与学生通道重叠 ${data.overlap} 格。`,
    '此操作仅改变试摆预览，未发布的摆位不会用于下一位访客。格数属于课程推演。');
}

export function submitFeedback(state: AppState, channel: Receipt['channel']): AppState {
  const now = Date.now();
  const receipt: Receipt = {
    id: `SAT-${now.toString(36).toUpperCase()}-${String(state.receipts.length + 1).padStart(3, '0')}`,
    channel, suggestion: FEEDBACK_SUGGESTION, createdAt: now, status: 'submitted',
    reviews: { student: null, staff: null },
  };
  return logged({ ...state, receipts: [...state.receipts, receipt] }, '提交访客意见', [state.identity ?? '普通访客'],
    `已生成本地回执 ${receipt.id}，等待两方复核。`, `${channel === 'paper' ? '纸卡' : '电子意见'}：${receipt.suggestion}。`);
}
export function queryReceipt(state: AppState, id: string): Receipt | null {
  return state.receipts.find(receipt => receipt.id === id.trim()) ?? null;
}
function receiptIndex(state: AppState, id?: string): number {
  const index = id ? state.receipts.findIndex(receipt => receipt.id === id) : state.receipts.length - 1;
  if (index < 0) throw new Error('请先提交意见，取得本地回执。');
  return index;
}
export function reviewFeedback(state: AppState, role: ReviewRole, decision: ReviewDecision, reason = '', id?: string): AppState {
  const index = receiptIndex(state, id);
  const receipt = state.receipts[index];
  if (receipt.status === 'published') throw new Error('该回执已经发布；新的意见请重新提交。');
  if (decision === 'held' && !reason.trim()) throw new Error('暂缓时请写明原因，便于下一位复核者和访客查询。');
  const defaultReason = role === 'student' ? '侧廊队列不占用学生通道，学生可顺利通过。' : '侧廊可安排现场值守，在原签到点增加箭头，接引绕行访客。';
  const reviews = { ...receipt.reviews, [role]: { decision, reason: reason.trim() || defaultReason } };
  const status: Receipt['status'] = Object.values(reviews).some(review => review?.decision === 'held')
    ? 'held' : Object.values(reviews).every(review => review?.decision === 'approved') ? 'ready' : 'submitted';
  const receipts = state.receipts.map((item, i) => i === index ? { ...receipt, reviews, status } : item);
  return logged({ ...state, receipts }, role === 'student' ? '学生代表复核' : '工作人员复核', [role === 'student' ? 'S01' : '现场工作人员'],
    decision === 'approved' ? '同意；两方均通过后才能发布。' : '暂缓发布。', reviews[role]!.reason);
}
export function publishFeedback(state: AppState, id?: string): AppState {
  const index = receiptIndex(state, id);
  const receipt = state.receipts[index];
  if (receipt.status === 'published') throw new Error('该回执已经发布，无需重复发布。');
  if (receipt.reviews.student?.decision !== 'approved' || receipt.reviews.staff?.decision !== 'approved') {
    throw new Error('学生代表与工作人员必须分别确认通过，才能发布新版本。');
  }
  const published = { version: state.published.version + 1, layout: 'side' as const, arrow: true };
  const receipts = state.receipts.map((item, i) => i === index ? { ...receipt, status: 'published' as const, version: published.version } : item);
  return logged({ ...state, published, receipts }, '发布新版本', ['O01', 'O02', 'S01', '下一位访客'],
    `v${published.version} 已发布：侧廊签到桌与原位置箭头。`,
    '学生代表确认通行，工作人员确认值守与接引。点击“接待下一位访客”后，现场采用此正式版本。');
}
export function nextVisitor(state: AppState): AppState {
  const active = { ...state.published };
  return logged({ ...state, active, preview: active.layout, nextVisits: state.nextVisits + 1 }, '接待下一位访客', ['下一位访客'],
    `从校门重新出发，现场采用 v${active.version}：${LAYOUTS[active.layout].name}签到${active.arrow ? '，原位置有箭头' : ''}。`,
    '读取正式发布版本；清除试摆预览。普通访客可以不提交反馈，直接继续公共参观。');
}

export function serialize(state: AppState): string { return JSON.stringify(state); }
const isPolicy = (value: unknown): value is Policy => value === 'A' || value === 'B';
const isLayout = (value: unknown): value is Layout => value === 'front' || value === 'side';
function isPublished(value: any): value is PublishedLayout {
  if (!value || !Number.isInteger(value.version) || value.version < 1 || !isLayout(value.layout) || typeof value.arrow !== 'boolean') return false;
  // v1 is the original entrance desk. Every published improvement is the
  // reviewed side-corridor desk plus an arrow at its original position.
  return value.version === 1 ? value.layout === 'front' && !value.arrow : value.layout === 'side' && value.arrow;
}
function isReview(value: any): boolean {
  return value === null || value && (value.decision === 'approved' || value.decision === 'held') && typeof value.reason === 'string' && Boolean(value.reason.trim());
}
function isReceipt(value: any): boolean {
  const shape = value && typeof value.id === 'string' && value.id.trim() && (value.channel === 'paper' || value.channel === 'electronic') &&
    typeof value.suggestion === 'string' && Number.isFinite(value.createdAt) &&
    ['submitted', 'held', 'ready', 'published'].includes(value.status) && value.reviews &&
    isReview(value.reviews.student) && isReview(value.reviews.staff) &&
    (value.version === undefined || Number.isInteger(value.version));
  if (!shape) return false;
  const reviews = [value.reviews.student, value.reviews.staff];
  const held = reviews.some(review => review?.decision === 'held');
  const approved = reviews.every(review => review?.decision === 'approved');
  if (value.status === 'published') return approved && value.version >= 2;
  if (value.version !== undefined) return false;
  return value.status === (held ? 'held' : approved ? 'ready' : 'submitted');
}
/** Old/partial/corrupt saves reset safely rather than silently publishing a preview. */
export function restore(raw: string | null): AppState {
  if (!raw) return initialState();
  try {
    const state = JSON.parse(raw);
    const valid = state && state.schemaVersion === 1 && typeof state.started === 'boolean' &&
      (state.policy === null || isPolicy(state.policy)) && (state.firstPolicy === null || isPolicy(state.firstPolicy)) &&
      (state.identity === null || state.identity === 'O09' || state.identity === 'W01') &&
      typeof state.cardClaimed === 'boolean' && isLayout(state.preview) && isPublished(state.published) && isPublished(state.active) &&
      Number.isInteger(state.nextVisits) && state.nextVisits >= 0 &&
      Array.isArray(state.receipts) && state.receipts.every(isReceipt) &&
      Array.isArray(state.logs) && state.logs.every((log: any) => log && typeof log.id === 'string' && Number.isFinite(log.at) &&
        typeof log.action === 'string' && Array.isArray(log.who) && log.who.every((who: any) => typeof who === 'string') &&
        typeof log.result === 'string' && typeof log.reason === 'string');
    if (!valid) return initialState();
    // A saved identity is only valid after the first rule has actually executed.
    if (state.policy === null && (state.identity !== null || state.cardClaimed || state.firstPolicy !== null)) return initialState();
    if (state.policy !== null && (state.identity === null || state.firstPolicy === null || !state.started)) return initialState();
    if (state.active.version > state.published.version || (state.active.version > 1 && state.nextVisits < 1)) return initialState();
    // Receipt history is the evidence for every formal version. A preview,
    // one-sided review or forged status must never become a live layout on load.
    const publishedVersions = state.receipts.filter((receipt: Receipt) => receipt.status === 'published')
      .map((receipt: Receipt) => receipt.version as number).sort((a: number, b: number) => a - b);
    if (publishedVersions.length !== state.published.version - 1 || publishedVersions.some((version: number, i: number) => version !== i + 2)) return initialState();
    if (new Set(state.receipts.map((receipt: Receipt) => receipt.id)).size !== state.receipts.length) return initialState();
    return state;
  } catch { return initialState(); }
}
