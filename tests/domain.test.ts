import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocate, APPLICANTS, claimCard, compare, currentCard, executePolicy, GRID, initialState, LAYOUTS,
  metrics, nextVisitor, previewLayout, publishFeedback, queryReceipt, restore, reviewFeedback,
  serialize, submitFeedback, type AppState, type Policy,
} from '../src/domain.ts';

test('16 人固定名单且两种政策都坐满 20 工位中的 12 个公众席位', () => {
  assert.equal(APPLICANTS.length, 16);
  assert.deepEqual(APPLICANTS.map(person => person.id), [
    ...Array.from({ length: 12 }, (_, i) => `O${String(i + 1).padStart(2, '0')}`), 'W01', 'W02', 'W03', 'W04',
  ]);
  for (const policy of ['A', 'B'] as const) {
    assert.equal(allocate(policy).filter(person => person.admitted).length, 12);
    assert.ok(allocate(policy).every(person => person.reason.includes(person.id)));
  }
  assert.ok(allocate('A').filter(person => person.admitted).every(person => person.channel === 'online'));
  assert.equal(allocate('B').filter(person => person.admitted && person.channel === 'online').length, 8);
  assert.equal(allocate('B').filter(person => person.admitted && person.channel === 'walk-in').length, 4);
});

test('A→B 是 4 得 4 失 8 不变，反向恰好交换', () => {
  const ab = compare('A', 'B');
  const ba = compare('B', 'A');
  assert.deepEqual(ab.gained, ['W01', 'W02', 'W03', 'W04']);
  assert.deepEqual(ab.lost, ['O09', 'O10', 'O11', 'O12']);
  assert.equal(ab.same.length, 8);
  assert.deepEqual(ba.gained, ab.lost);
  assert.deepEqual(ba.lost, ab.gained);
  assert.deepEqual(ba.same, ab.same);
  assert.equal(ab.filledBefore, 12);
  assert.equal(ab.filledAfter, 12);
  assert.equal(compare('A', 'A').same.length, 16);
});

for (const policy of ['A', 'B'] as Policy[]) {
  for (const identity of ['O09', 'W01'] as const) {
    test(`${policy} 起始，${identity} 执行后才揭晓，同一身份重跑只改规则`, () => {
      const original = initialState();
      assert.equal(original.identity, null);
      assert.equal(currentCard(original), null);
      assert.throws(() => claimCard(original), /请先/);
      const first = executePolicy(original, policy, () => identity === 'O09' ? 0 : 0.99);
      assert.equal(first.identity, identity);
      const card = currentCard(first)!;
      assert.equal(card.admitted, (policy === 'A') === (identity === 'O09'));
      const claimed = claimCard(first);
      assert.equal(claimed.cardClaimed, true);
      const otherPolicy = policy === 'A' ? 'B' : 'A';
      const rerun = executePolicy(claimed, otherPolicy, () => { throw new Error('身份不应重抽'); });
      assert.equal(rerun.identity, identity);
      assert.equal(rerun.firstPolicy, policy);
      assert.equal(rerun.policy, otherPolicy);
      assert.notEqual(currentCard(rerun)!.admitted, card.admitted);
      assert.equal(original.identity, null, '不原地修改旧状态');
      assert.ok(rerun.logs.every(log => log.who.length && log.reason && log.result));
    });
  }
}

test('路径与地图共用格网坐标；每步横竖相邻并经过签到桌', () => {
  for (const layout of ['front', 'side'] as const) {
    const { path, desk, queue, studentPath } = LAYOUTS[layout];
    assert.deepEqual(path[0], GRID.gate);
    assert.deepEqual(path.at(-1), GRID.hall);
    assert.ok(path.some(point => point[0] === desk[0] && point[1] === desk[1]));
    for (let i = 1; i < path.length; i++) {
      assert.equal(Math.abs(path[i][0] - path[i - 1][0]) + Math.abs(path[i][1] - path[i - 1][1]), 1);
    }
    assert.deepEqual(studentPath[0], [1, 2]);
    assert.deepEqual(studentPath.at(-1), [7, 2]);
    assert.ok([...path, ...queue, desk].every(([x, y]) => x >= 0 && x < 9 && y >= 0 && y < 7));
  }
  assert.deepEqual(LAYOUTS.front.queue, [[5, 3], [5, 2]]);
  assert.deepEqual(LAYOUTS.side.queue, [[3, 5], [2, 5]]);
  assert.deepEqual(metrics('front'), { steps: 6, overlap: 1 });
  assert.deepEqual(metrics('side'), { steps: 8, overlap: 0 });
});

test('试摆不会发布；未提交意见的普通访客也能接待下一位', () => {
  const state = previewLayout(initialState(), 'side');
  assert.equal(state.preview, 'side');
  assert.deepEqual(state.published, { version: 1, layout: 'front', arrow: false });
  const next = nextVisitor(state);
  assert.equal(next.preview, 'front');
  assert.equal(next.active.layout, 'front');
  assert.equal(next.active.version, 1);
  assert.equal(next.nextVisits, 1);
});

function approved(state: AppState): AppState {
  return reviewFeedback(reviewFeedback(state, 'student', 'approved'), 'staff', 'approved');
}

test('纸卡/电子意见都生成可查询本地回执，双审前禁止发布，暂缓必须有原因', () => {
  for (const channel of ['paper', 'electronic'] as const) {
    let state = submitFeedback(initialState(), channel);
    const id = state.receipts[0].id;
    assert.equal(queryReceipt(state, ` ${id} `)?.channel, channel);
    assert.equal(queryReceipt(state, '不存在'), null);
    assert.throws(() => publishFeedback(state), /分别确认/);
    assert.throws(() => reviewFeedback(state, 'student', 'held'), /写明原因/);
    state = reviewFeedback(state, 'student', 'held', '需要确认课间疏散宽度');
    assert.equal(state.receipts[0].status, 'held');
    assert.equal(state.receipts[0].reviews.student?.reason, '需要确认课间疏散宽度');
    assert.throws(() => publishFeedback(state), /分别确认/);
    state = reviewFeedback(state, 'staff', 'approved');
    assert.equal(state.receipts[0].status, 'held');
    state = reviewFeedback(state, 'student', 'approved');
    assert.equal(state.receipts[0].status, 'ready');
    state = publishFeedback(state);
    assert.equal(queryReceipt(state, id)?.status, 'published');
    assert.equal(queryReceipt(state, id)?.version, 2);
    assert.throws(() => publishFeedback(state), /已经发布/);
    assert.throws(() => reviewFeedback(state, 'student', 'held', '改变意见'), /已经发布/);
  }
});

test('正式发布只改变下次使用版本，下一位访客实际采用 v2 侧廊与原位箭头', () => {
  const before = initialState();
  const reviewed = approved(submitFeedback(previewLayout(before, 'side'), 'electronic'));
  const published = publishFeedback(reviewed);
  assert.deepEqual(published.published, { version: 2, layout: 'side', arrow: true });
  assert.deepEqual(published.active, before.active);
  const changedPreview = previewLayout(published, 'front');
  assert.equal(changedPreview.preview, 'front');
  const next = nextVisitor(changedPreview);
  assert.equal(next.preview, 'side');
  assert.deepEqual(next.active, { version: 2, layout: 'side', arrow: true });
  assert.deepEqual(next.published, next.active);
  assert.equal(before.published.version, 1);
});

test('刷新恢复保留身份/回执/日志及正式版本；损坏或不兼容保存容错', () => {
  const state = nextVisitor(publishFeedback(approved(submitFeedback(claimCard(executePolicy(initialState(), 'B', () => 0.9)), 'paper'))));
  const restored = restore(serialize(state));
  assert.deepEqual(restored, state);
  assert.equal(restored.identity, 'W01');
  assert.equal(restored.active.version, 2);
  for (const broken of [null, '', '{broken', '{}', 'null', '[]', JSON.stringify({ ...state, preview: 'roof' }), JSON.stringify({ ...state, published: null }), JSON.stringify({ ...state, receipts: [null] }), JSON.stringify({ ...state, schemaVersion: 999 })]) {
    assert.deepEqual(restore(broken), initialState());
  }
  assert.deepEqual(restore(JSON.stringify({ ...initialState(), identity: 'W01' })), initialState());
});

test('恢复拒绝审批状态伪造、试摆冒充正式版本、缺失发布证据和重复回执', () => {
  const base = initialState();
  const submitted = submitFeedback(base, 'paper');
  const ready = approved(submitted);
  const published = publishFeedback(ready);
  const active = nextVisitor(published);
  const corrupt = [
    { ...base, published: { version: 1, layout: 'side', arrow: false } },
    { ...base, published: { version: 2, layout: 'side', arrow: true } },
    { ...base, active: { version: 2, layout: 'side', arrow: true } },
    { ...submitted, receipts: [{ ...submitted.receipts[0], status: 'ready' }] },
    { ...ready, receipts: [{ ...ready.receipts[0], status: 'submitted' }] },
    { ...submitted, receipts: [{ ...submitted.receipts[0], status: 'held', reviews: { student: { decision: 'held', reason: ' ' }, staff: null } }] },
    { ...published, receipts: [{ ...published.receipts[0], reviews: { student: null, staff: null } }] },
    { ...published, receipts: [{ ...published.receipts[0], version: 3 }] },
    { ...published, receipts: [published.receipts[0], published.receipts[0]] },
    { ...active, nextVisits: 0 },
    { ...active, active: { version: 3, layout: 'side', arrow: true } },
  ];
  corrupt.forEach(value => assert.deepEqual(restore(JSON.stringify(value)), base));
  for (const state of [base, submitted, ready, published, active, previewLayout(active, 'front')]) {
    assert.deepEqual(restore(serialize(state)), state, '合法预览和历史正式版本正常恢复');
  }
});
