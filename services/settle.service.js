/**
 * 结算服务 - 最少转账次数算法
 * 纯计算：基于账单得出最优转账方案，无状态跟踪
 */
const { add, subtract, roundToYuan } = require('../utils/calc')

/**
 * 核心结算算法：计算最优转账方案
 *
 * @param {Array} members - 成员列表
 * @param {Array} bills - 账单列表
 * @param {Object} options - { roundToYuan: boolean }
 * @returns {Object} { transfers: [], summary: {} }
 */
function calculateSettlement(members, bills, options = {}) {
  const threshold = options.roundToYuan ? 100 : 50

  // Step 1: 计算每个成员的净收支（分）
  const balance = {}
  const totalPaid = {}
  const totalShare = {}

  members.forEach(m => {
    balance[m.id] = 0
    totalPaid[m.id] = 0
    totalShare[m.id] = 0
    m._name = (m.is_claimed || m.type === 'real') ? (m.nickname || m.shadow_name) : (m.shadow_name || m.nickname)
    if (!m._name) m._name = '未知'
  })

  ;(bills || []).forEach(bill => {
    if (!bill.payer_id) return

    if (balance[bill.payer_id] !== undefined) {
      balance[bill.payer_id] = add(balance[bill.payer_id], bill.amount)
      totalPaid[bill.payer_id] = add(totalPaid[bill.payer_id], bill.amount)
    }

    ;(bill.splits || []).forEach(split => {
      if (balance[split.member_id] !== undefined) {
        balance[split.member_id] = subtract(balance[split.member_id], split.share)
        totalShare[split.member_id] = add(totalShare[split.member_id], split.share)
      }
    })
  })

  // Step 2: 分离债权人和债务人
  const debtors = []
  const creditors = []

  for (const [id, amount] of Object.entries(balance)) {
    if (amount < -threshold) {
      let debtAmount = -amount
      if (options.roundToYuan) debtAmount = roundToYuan(debtAmount)
      debtors.push({
        id, name: (members.find(m => m.id === id) || {})._name || '未知',
        amount: debtAmount
      })
    } else if (amount > threshold) {
      let creditAmount = amount
      if (options.roundToYuan) creditAmount = roundToYuan(creditAmount)
      creditors.push({
        id, name: (members.find(m => m.id === id) || {})._name || '未知',
        amount: creditAmount
      })
    }
  }

  // Step 3: 降序排序
  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  // Step 4: 贪心匹配
  const transfers = []
  let totalTransferAmount = 0
  let i = 0, j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const transferAmount = Math.min(debtor.amount, creditor.amount)

    transfers.push({
      id: `t_${debtor.id}_${creditor.id}`,
      from_id: debtor.id,
      from_name: debtor.name,
      to_id: creditor.id,
      to_name: creditor.name,
      amount: transferAmount
    })

    totalTransferAmount += transferAmount
    debtor.amount -= transferAmount
    creditor.amount -= transferAmount

    if (debtor.amount <= threshold) i++
    if (creditor.amount <= threshold) j++
  }

  // 每人收支明细
  const memberSummary = members.map(m => ({
    id: m.id,
    name: m._name,
    paid: totalPaid[m.id] || 0,
    share: totalShare[m.id] || 0,
    net: balance[m.id] || 0
  }))

  return {
    transfers,
    totalTransfers: transfers.length,
    totalAmount: totalTransferAmount,
    memberCount: members.length,
    billCount: (bills || []).length,
    memberSummary
  }
}

module.exports = {
  calculateSettlement
}
