/**
 * 结算服务 - 最少转账次数算法
 * 支持部分结算：已结算金额保留，新增账单后自动计算剩余待结算金额
 */
const { add, subtract, roundToYuan } = require('../utils/calc')
const cache = require('../utils/cache')

const TRANSFER_STATUS_KEY = 'transfer_statuses'

/**
 * 核心结算算法：计算最优转账方案
 *
 * 流程：
 * 1. 基于账单计算每人的净收支
 * 2. 将已结算的转账纳入余额（相当于 from 已实际付给 to）
 * 3. 对调整后余额执行贪心匹配，得到剩余待结算转账
 * 4. 叠加已结算信息，计算每笔转账的 total/settled/pending
 *
 * @param {Array} members - 成员列表
 * @param {Array} bills - 账单列表
 * @param {Object} options - { roundToYuan: boolean }
 * @returns {Object} { transfers: [], summary: {} }
 */
function calculateSettlement(members, bills, options = {}) {
  const threshold = options.roundToYuan ? 100 : 50

  // Step 1: 计算每个成员的净收支（分）— 仅基于账单
  const balance = {}

  members.forEach(m => {
    balance[m.id] = 0
    m._name = m.nickname || m.shadow_name || '未知'
  })

  ;(bills || []).forEach(bill => {
    if (!bill.payer_id) return

    if (balance[bill.payer_id] !== undefined) {
      balance[bill.payer_id] = add(balance[bill.payer_id], bill.amount)
    }

    ;(bill.splits || []).forEach(split => {
      if (balance[split.member_id] !== undefined) {
        balance[split.member_id] = subtract(balance[split.member_id], split.share)
      }
    })
  })

  // Step 2: 将已结算金额纳入余额
  // 已结算 = 实际已发生的付款，from 已付给 to
  const settlements = _getSettlements()
  for (const info of Object.values(settlements)) {
    if (info.from_id && info.to_id && info.amount > 0 &&
        balance[info.from_id] !== undefined &&
        balance[info.to_id] !== undefined) {
      balance[info.from_id] = add(balance[info.from_id], info.amount)
      balance[info.to_id] = subtract(balance[info.to_id], info.amount)
    }
  }

  // Step 3: 分离债权人和债务人（基于调整后余额）
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

  // Step 4: 降序排序
  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  // Step 5: 贪心匹配
  const transfers = []
  let totalTransferAmount = 0
  let i = 0, j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const transferAmount = Math.min(debtor.amount, creditor.amount)
    const transferId = `t_${debtor.id}_${creditor.id}`

    transfers.push({
      id: transferId,
      from_id: debtor.id,
      from_name: debtor.name,
      to_id: creditor.id,
      to_name: creditor.name,
      amount: transferAmount,
      status: 'pending',
      settledAmount: 0,
      totalAmount: transferAmount,
      pendingAmount: transferAmount
    })

    totalTransferAmount += transferAmount
    debtor.amount -= transferAmount
    creditor.amount -= transferAmount

    if (debtor.amount <= threshold) i++
    if (creditor.amount <= threshold) j++
  }

  // Step 6: 叠加已结算信息
  transfers.forEach(t => {
    const settlement = settlements[t.id]
    if (settlement && settlement.amount > 0) {
      t.settledAmount = settlement.amount
      t.totalAmount = add(t.amount, settlement.amount)
      t.pendingAmount = t.amount

      if (t.amount > 0) {
        // 还有剩余待结算 → 自动打开为 pending
        t.status = 'pending'
      } else {
        // 完全结算完毕，保持原状态
        t.status = settlement.status
        t.amount = 0
        t.pendingAmount = 0
        t.totalAmount = settlement.amount
      }
    }
  })

  // Step 7: 补回已完全结算的转账卡片（保留可见，支持撤销）
  const activeTransferCount = transfers.filter(t => t.status === 'pending').length
  for (const [transferId, info] of Object.entries(settlements)) {
    if (info.amount <= 0) continue
    const existing = transfers.find(t => t.id === transferId)
    if (!existing) {
      transfers.push({
        id: transferId,
        from_id: info.from_id,
        from_name: (members.find(m => m.id === info.from_id) || {})._name || '未知',
        to_id: info.to_id,
        to_name: (members.find(m => m.id === info.to_id) || {})._name || '未知',
        amount: 0,
        status: info.status,
        settledAmount: info.amount,
        totalAmount: info.amount,
        pendingAmount: 0
      })
    }
  }

  // 排序：pending 在前，已结算在后
  transfers.sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return 0
  })

  // 计算汇总
  const pendingAmount = transfers
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => add(sum, t.pendingAmount), 0)

  return {
    transfers,
    totalTransfers: activeTransferCount,
    totalAmount: totalTransferAmount,
    pendingAmount,
    settledCount: transfers.filter(t => t.status !== 'pending').length,
    memberCount: members.length,
    billCount: (bills || []).length,
    rawBalance: balance
  }
}

/**
 * 获取所有已结算记录
 */
function _getSettlements() {
  return cache.get(TRANSFER_STATUS_KEY) || {}
}

/**
 * 保存结算记录
 */
function _saveSettlement(transferId, status, amount, fromId, toId) {
  const settlements = _getSettlements()
  settlements[transferId] = { status, amount, from_id: fromId, to_id: toId }
  cache.set(TRANSFER_STATUS_KEY, settlements)
}

/**
 * 标记转账已完成
 * @param {string|Object} transferOrId - transferId 字符串（兼容旧调用）或 transfer 对象
 */
function markTransferPaid(transferOrId) {
  if (typeof transferOrId === 'string') {
    const settlements = _getSettlements()
    settlements[transferOrId] = { status: 'paid', amount: 0 }
    cache.set(TRANSFER_STATUS_KEY, settlements)
    return true
  }
  _saveSettlement(
    transferOrId.id, 'paid',
    transferOrId.totalAmount,
    transferOrId.from_id,
    transferOrId.to_id
  )
  return true
}

/**
 * 标记"下顿他请"（免除债务）
 * @param {string|Object} transferOrId - transferId 字符串（兼容旧调用）或 transfer 对象
 */
function forgiveTransfer(transferOrId) {
  if (typeof transferOrId === 'string') {
    const settlements = _getSettlements()
    settlements[transferOrId] = { status: 'forgiven', amount: 0 }
    cache.set(TRANSFER_STATUS_KEY, settlements)
    return true
  }
  _saveSettlement(
    transferOrId.id, 'forgiven',
    transferOrId.totalAmount,
    transferOrId.from_id,
    transferOrId.to_id
  )
  return true
}

/**
 * 撤销转账状态 → 恢复为 pending
 */
function unmarkTransfer(transferId) {
  const settlements = _getSettlements()
  delete settlements[transferId]
  cache.set(TRANSFER_STATUS_KEY, settlements)
  return true
}

/**
 * 重置所有结算状态
 */
function resetAllStatuses() {
  cache.remove(TRANSFER_STATUS_KEY)
  return true
}

/**
 * 获取转账状态
 */
function getTransferStatuses() {
  return cache.get(TRANSFER_STATUS_KEY) || {}
}

module.exports = {
  calculateSettlement,
  markTransferPaid,
  forgiveTransfer,
  unmarkTransfer,
  resetAllStatuses,
  getTransferStatuses
}
