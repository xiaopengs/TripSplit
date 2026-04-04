/**
 * 结算服务 - 最少转账次数算法
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
  // Step 1: 计算每个成员的净收支（分）
  // 正数 = 应收款，负数 = 应付款
  const balance = {}
  
  // 初始化
  members.forEach(m => {
    balance[m.id] = 0
    m._name = m.nickname || m.shadow_name || '未知'
  })

  // 遍历账单
  ;(bills || []).forEach(bill => {
    if (!bill.payer_id) return
    
    // 支付者增加应收款
    if (balance[bill.payer_id] !== undefined) {
      balance[bill.payer_id] = add(balance[bill.payer_id], bill.amount)
    }

    // 分摊者增加应付款
    ;(bill.splits || []).forEach(split => {
      if (balance[split.member_id] !== undefined) {
        balance[split.member_id] = subtract(balance[split.member_id], split.share)
      }
    })
  })

  // Step 2: 分离债权人和债务人
  const THRESHOLD = options.roundToYuan ? 100 : 50 // 抹零时阈值1元
  const debtors = []   // 应付款人
  const creditors = [] // 应收款人

  for (const [id, amount] of Object.entries(balance)) {
    if (amount < -THRESHOLD) {
      let debtAmount = -amount
      if (options.roundToYuan) {
        debtAmount = roundToYuan(debtAmount)
      }
      debtors.push({ id, name: members.find(m => m.id === id)?._name || '未知', amount: debtAmount })
    } else if (amount > THRESHOLD) {
      let creditAmount = amount
      if (options.roundToYuan) {
        creditAmount = roundToYuan(creditAmount)
      }
      creditors.push({ id, name: members.find(m => m.id === id)?._name || '未知', amount: creditAmount })
    }
  }

  // Step 3: 降序排序
  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  // Step 4: 贪心匹配
  const transfers = []
  let i = 0, j = 0
  let totalTransferAmount = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]

    const transferAmount = Math.min(debtor.amount, creditor.amount)

    transfers.push({
      id: `transfer_${transfers.length}`,
      from_id: debtor.id,
      from_name: debtor.name,
      to_id: creditor.id,
      to_name: creditor.name,
      amount: transferAmount,
      status: 'pending' // pending / paid / forgiven
    })

    totalTransferAmount += transferAmount
    debtor.amount -= transferAmount
    creditor.amount -= transferAmount

    if (debtor.amount <= THRESHOLD) i++
    if (creditor.amount <= THRESHOLD) j++
  }

  return {
    transfers,
    totalTransfers: transfers.length,
    totalAmount: totalTransferAmount,
    memberCount: members.length,
    billCount: (bills || []).length,
    rawBalance: balance
  }
}

/**
 * 标记转账已完成
 */
function markTransferPaid(transferId) {
  // TODO: 更新本地/云端状态
  return true
}

/**
 * 标记"下顿他请"（免除债务）
 */
function forgiveTransfer(transferId) {
  // TODO: 免除并记录
  return true
}

module.exports = {
  calculateSettlement,
  markTransferPaid,
  forgiveTransfer
}
