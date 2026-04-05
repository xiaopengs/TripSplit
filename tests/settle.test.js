/**
 * 结算服务 - 单元测试
 */
const { describe, it, expect, beforeEach, runSuites } = require('./test.helper')
const { clearMockStorage } = require('./wx.mock')
const { calculateSettlement, markTransferPaid, forgiveTransfer } = require('../services/settle.service')

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
    // A 支付 30000 分（300元），A和B均分
    const bills = [makeBill('m0', 30000, ['m0', 'm1'])]
    const result = calculateSettlement(members, bills)
    
    // A 多付 15000，应收 B 15000
    expect(result.transfers.length).toBe(1)
    expect(result.transfers[0].from_id).toBe('m1')
    expect(result.transfers[0].to_id).toBe('m0')
    expect(result.transfers[0].amount).toBe(15000)
  })

  it('3人场景：A支付600元，3人均分', () => {
    const members = makeMembers(['A', 'B', 'C'])
    // A 支付 60000 分，3人均分每人 20000
    const bills = [makeBill('m0', 60000, ['m0', 'm1', 'm2'])]
    const result = calculateSettlement(members, bills)

    // A 应收 40000（多付了 B和C 的份额）
    expect(result.transfers.length).toBe(2)
    const bToA = result.transfers.find(t => t.from_id === 'm1')
    const cToA = result.transfers.find(t => t.from_id === 'm2')
    expect(bToA.amount).toBe(20000)
    expect(cToA.amount).toBe(20000)
  })

  it('对冲优化：A欠B、B欠C → A直接给C', () => {
    // 构造场景：A付给B 50元，B付给C 50元
    // A 付 5000 分，A和B分摊 → B欠A 2500
    // B 付 5000 分，B和C分摊 → C欠B 2500
    const members = makeMembers(['A', 'B', 'C'])
    const bills = [
      makeBill('m0', 5000, ['m0', 'm1']),
      makeBill('m1', 5000, ['m1', 'm2'])
    ]
    const result = calculateSettlement(members, bills)

    // 最优解：B 收 2500（来自A），B 付 2500（给C）→ 抵消
    // 最终 A 给 C 2500（或者 A 给 B 和 C 给 B 分别抵消后算出）
    // 实际算法：A净收+2500, B净收0, C净收-2500
    // 所以 C 给 A 2500
    expect(result.totalAmount).toBe(2500)
  })

  it('精确零尾差不产生转账', () => {
    const members = makeMembers(['A', 'B'])
    // A 付 99分，AB均分，各49.5分 → A多付49.5分
    // 阈值50分，49.5 < 50，不产生转账
    const bills = [makeBill('m0', 99, ['m0', 'm1'])]
    const result = calculateSettlement(members, bills)
    
    // 49.5分 < 阈值50分，不产生转账
    expect(result.transfers.length).toBe(0)
  })

  it('抹零模式 roundToYuan', () => {
    const members = makeMembers(['A', 'B'])
    const bills = [makeBill('m0', 251, ['m0', 'm1'])] // 2.51元，A付，均分
    const result = calculateSettlement(members, bills, { roundToYuan: true })

    // 不抹零时 B 欠 A 125.5分
    // 抹零后 100分 = 1元
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
      makeBill('m0', 40000, ['m0', 'm1', 'm2', 'm3']), // A付400, 4人均分
      makeBill('m1', 30000, ['m0', 'm1', 'm2']),         // B付300, 3人均分
      makeBill('m2', 20000, ['m1', 'm2', 'm3']),         // C付200, 3人均分
    ]
    const result = calculateSettlement(members, bills)
    
    // 总转账金额应合理
    expect(result.totalAmount).toBeGreaterThan(0)
    // 转账数应 <= 成员数 - 1
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
})

describe('settle.markTransferPaid / forgiveTransfer', () => {
  it('markTransferPaid 返回 true', () => {
    expect(markTransferPaid('test_id')).toBe(true)
  })

  it('forgiveTransfer 返回 true', () => {
    expect(forgiveTransfer('test_id')).toBe(true)
  })
})
