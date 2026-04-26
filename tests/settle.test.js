/**
 * 结算服务 - 单元测试
 */
const { describe, it, expect, beforeEach, runSuites } = require('./test.helper')
const { clearMockStorage } = require('./wx.mock')
const {
  calculateSettlement
} = require('../services/settle.service')

// === 辅助函数 ===
function makeMembers(names) {
  return names.map((name, i) => ({ id: `m${i}`, nickname: name }))
}

function makeBill(payerId, amount, splitMemberIds) {
  const share = Math.floor(amount / splitMemberIds.length)
  const remainder = amount - share * splitMemberIds.length
  const splits = splitMemberIds.map((mid, idx) => ({
    member_id: mid,
    name: mid,
    share: share + (idx < remainder ? 1 : 0)
  }))
  return { payer_id: payerId, amount, splits }
}

// === 核心结算算法 ===
describe('settle.calculateSettlement 核心结算', () => {
  beforeEach(() => clearMockStorage())

  it('无人付款无转账', () => {
    const members = makeMembers(['A', 'B', 'C'])
    const result = calculateSettlement(members, [])
    expect(result.transfers.length).toBe(0)
    expect(result.totalAmount).toBe(0)
  })

  it('一人付全款，其他人需均摊', () => {
    const members = makeMembers(['A', 'B'])
    const bills = [makeBill('m0', 30000, ['m0', 'm1'])]
    const result = calculateSettlement(members, bills)

    expect(result.transfers.length).toBe(1)
    expect(result.transfers[0].from_id).toBe('m1')
    expect(result.transfers[0].to_id).toBe('m0')
    expect(result.transfers[0].amount).toBe(15000)
  })

  it('3人场景：A支付600元，3人均分', () => {
    const members = makeMembers(['A', 'B', 'C'])
    const bills = [makeBill('m0', 60000, ['m0', 'm1', 'm2'])]
    const result = calculateSettlement(members, bills)

    expect(result.transfers.length).toBe(2)
    const bToA = result.transfers.find(t => t.from_id === 'm1')
    const cToA = result.transfers.find(t => t.from_id === 'm2')
    expect(bToA.amount).toBe(20000)
    expect(cToA.amount).toBe(20000)
  })

  it('对冲优化：A欠B、B欠C → A直接给C', () => {
    const members = makeMembers(['A', 'B', 'C'])
    const bills = [
      makeBill('m0', 5000, ['m0', 'm1']),
      makeBill('m1', 5000, ['m1', 'm2'])
    ]
    const result = calculateSettlement(members, bills)

    expect(result.totalAmount).toBe(2500)
  })

  it('精确零尾差不产生转账', () => {
    const members = makeMembers(['A', 'B'])
    const bills = [makeBill('m0', 99, ['m0', 'm1'])]
    const result = calculateSettlement(members, bills)

    expect(result.transfers.length).toBe(0)
  })

  it('抹零模式 roundToYuan', () => {
    const members = makeMembers(['A', 'B'])
    const bills = [makeBill('m0', 251, ['m0', 'm1'])]
    const result = calculateSettlement(members, bills, { roundToYuan: true })

    if (result.transfers.length > 0) {
      expect(result.transfers[0].amount % 100).toBe(0)
    }
  })
})

describe('settle 边界情况', () => {
  beforeEach(() => clearMockStorage())

  it('空成员列表', () => {
    const result = calculateSettlement([], [])
    expect(result.transfers.length).toBe(0)
  })

  it('null 账单', () => {
    const members = makeMembers(['A'])
    const result = calculateSettlement(members, null)
    expect(result.transfers.length).toBe(0)
  })

  it('多人多笔复杂结算', () => {
    const members = makeMembers(['A', 'B', 'C', 'D'])
    const bills = [
      makeBill('m0', 40000, ['m0', 'm1', 'm2', 'm3']),
      makeBill('m1', 30000, ['m0', 'm1', 'm2']),
      makeBill('m2', 20000, ['m1', 'm2', 'm3']),
    ]
    const result = calculateSettlement(members, bills)

    expect(result.totalAmount).toBeGreaterThan(0)
    expect(result.transfers.length).toBeGreaterThanOrEqual(1)
    expect(result.transfers.length).toBeLessThanOrEqual(3)
  })

  it('统计信息正确', () => {
    const members = makeMembers(['A', 'B'])
    const bills = [makeBill('m0', 60000, ['m0', 'm1'])]
    const result = calculateSettlement(members, bills)

    expect(result.memberCount).toBe(2)
    expect(result.billCount).toBe(1)
  })

  it('memberSummary 正确', () => {
    const members = makeMembers(['A', 'B'])
    const bills = [makeBill('m0', 4000, ['m0', 'm1'])]
    const result = calculateSettlement(members, bills)

    expect(result.memberSummary.length).toBe(2)
    const a = result.memberSummary.find(m => m.id === 'm0')
    const b = result.memberSummary.find(m => m.id === 'm1')
    // A paid 4000, share 2000 → net +2000
    expect(a.paid).toBe(4000)
    expect(a.share).toBe(2000)
    expect(a.net).toBe(2000)
    // B paid 0, share 2000 → net -2000
    expect(b.paid).toBe(0)
    expect(b.share).toBe(2000)
    expect(b.net).toBe(-2000)
  })
})

// === 纯计算场景（无状态跟踪） ===
describe('settle 多人复杂结算场景', () => {
  beforeEach(() => clearMockStorage())

  it('场景A: 双方各自记账后结算金额一致', () => {
    const members = makeMembers(['A', 'B'])
    const allBills = [
      makeBill('m0', 10000, ['m0', 'm1']),
      makeBill('m1', 6000, ['m0', 'm1'])
    ]
    const result = calculateSettlement(members, allBills)

    expect(result.transfers.length).toBe(1)
    expect(result.transfers[0].amount).toBe(2000)
    expect(result.transfers[0].from_id).toBe('m1')
    expect(result.transfers[0].to_id).toBe('m0')
  })

  it('场景C: 3人各付均摊 → 结算金额正确', () => {
    const members = makeMembers(['A', 'B', 'C'])
    const bills = [
      makeBill('m0', 9000, ['m0', 'm1', 'm2']),
      makeBill('m1', 6000, ['m0', 'm1', 'm2']),
      makeBill('m2', 3000, ['m0', 'm1', 'm2'])
    ]
    const result = calculateSettlement(members, bills)

    expect(result.transfers.length).toBe(1)
    expect(result.transfers[0].from_id).toBe('m2')
    expect(result.transfers[0].to_id).toBe('m0')
    expect(result.transfers[0].amount).toBe(3000)
  })

  it('场景F: 3人复杂链路 → 结算正确', () => {
    const members = makeMembers(['A', 'B', 'C'])
    const bills = [
      makeBill('m0', 12000, ['m0', 'm1', 'm2']),
      makeBill('m1', 6000, ['m0', 'm1', 'm2']),
      makeBill('m2', 3000, ['m0', 'm1', 'm2'])
    ]
    const result = calculateSettlement(members, bills)

    expect(result.transfers.length).toBe(2)
    var bToA = result.transfers.find(t => t.from_id === 'm1')
    var cToA = result.transfers.find(t => t.from_id === 'm2')
    expect(bToA.amount).toBe(1000)
    expect(cToA.amount).toBe(4000)
  })

  it('transfer 字段完整性', () => {
    const members = makeMembers(['A', 'B'])
    const bills = [makeBill('m1', 4000, ['m0', 'm1'])]
    const result = calculateSettlement(members, bills)

    const t = result.transfers[0]
    expect(t.id).toBeTruthy()
    expect(t.from_id).toBe('m0')
    expect(t.to_id).toBe('m1')
    expect(t.from_name).toBe('A')
    expect(t.to_name).toBe('B')
    expect(typeof t.amount).toBe('number')
  })

  it('幂等性：相同输入得到相同结果', () => {
    const members = makeMembers(['A', 'B', 'C'])
    const bills = [makeBill('m0', 6000, ['m0', 'm1', 'm2'])]

    const r1 = calculateSettlement(members, bills)
    const r2 = calculateSettlement(members, bills)

    expect(r1.transfers.length).toBe(r2.transfers.length)
    expect(r1.totalAmount).toBe(r2.totalAmount)
  })

  it('新增账单后重新计算反映最新余额', () => {
    const members = makeMembers(['A', 'B'])

    // 初始：A欠B 20
    const bills1 = [makeBill('m1', 4000, ['m0', 'm1'])]
    const r1 = calculateSettlement(members, bills1)
    expect(r1.transfers[0].amount).toBe(2000)

    // 新增B付30均摊 → A欠B 15(新增), 净欠B 35
    const bills2 = [makeBill('m1', 4000, ['m0', 'm1']), makeBill('m1', 3000, ['m0', 'm1'])]
    const r2 = calculateSettlement(members, bills2)
    expect(r2.transfers.length).toBe(1)
    expect(r2.transfers[0].amount).toBe(3500)
  })
})

// === 名称显示场景 ===
describe('settle 名称显示 - 已认领用nickname优先', () => {
  beforeEach(() => clearMockStorage())

  it('影子成员（未认领）用 shadow_name', () => {
    const members = [
      { id: 'm0', nickname: 'Alice', shadow_name: '', type: 'real', is_claimed: false },
      { id: 'm1', nickname: '', shadow_name: '小明', type: 'shadow', is_claimed: false }
    ]
    const bills = [makeBill('m0', 4000, ['m0', 'm1'])]
    const result = calculateSettlement(members, bills)

    expect(result.transfers.length).toBe(1)
    expect(result.transfers[0].from_name).toBe('小明')
    expect(result.transfers[0].to_name).toBe('Alice')
  })

  it('已认领成员用 nickname 优先', () => {
    const members = [
      { id: 'm0', nickname: 'Alice', shadow_name: '', type: 'real', is_claimed: false },
      { id: 'm1', nickname: '张三', shadow_name: '小明', type: 'real', is_claimed: true }
    ]
    const bills = [makeBill('m0', 4000, ['m0', 'm1'])]
    const result = calculateSettlement(members, bills)

    expect(result.transfers.length).toBe(1)
    expect(result.transfers[0].from_name).toBe('张三')
    expect(result.transfers[0].to_name).toBe('Alice')
  })

  it('已认领但 nickname 为空时 fallback 到 shadow_name', () => {
    const members = [
      { id: 'm0', nickname: 'Alice', shadow_name: '', type: 'real', is_claimed: false },
      { id: 'm1', nickname: '', shadow_name: '小明', type: 'real', is_claimed: true }
    ]
    const bills = [makeBill('m0', 4000, ['m0', 'm1'])]
    const result = calculateSettlement(members, bills)

    expect(result.transfers.length).toBe(1)
    expect(result.transfers[0].from_name).toBe('小明')
  })

  it('memberSummary 名称也遵循已认领优先级', () => {
    const members = [
      { id: 'm0', nickname: 'Alice', shadow_name: '', type: 'real', is_claimed: false },
      { id: 'm1', nickname: '张三', shadow_name: '小明', type: 'real', is_claimed: true }
    ]
    const bills = [makeBill('m0', 4000, ['m0', 'm1'])]
    const result = calculateSettlement(members, bills)

    const m1Summary = result.memberSummary.find(m => m.id === 'm1')
    expect(m1Summary.name).toBe('张三')
  })
})
