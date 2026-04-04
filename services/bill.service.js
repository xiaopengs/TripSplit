/**
 * 账单服务 - CRUD + 分组
 */
const cache = require('../utils/cache')
const { generateBillId, generateRequestId } = require('../utils/id')
const { splitEqual } = require('../utils/currency')
const { SPLIT_TYPE } = require('../utils/constants')

const CACHE_KEY = 'bills'

/**
 * 获取某账本的所有账单
 */
function getBills(bookId) {
  const allBills = cache.get(CACHE_KEY) || []
  return allBills.filter(b => b.book_id === bookId).sort((a, b) => {
    // 按支付时间降序（最新的在前）
    return new Date(b.paid_at) - new Date(a.paid_at)
  })
}

/**
 * 按日期分组账单
 */
function getBillsGroupedByDate(bookId) {
  const bills = getBills(bookId)
  const groups = {}

  bills.forEach(bill => {
    const dateKey = bill.paid_at ? bill.paid_at.split('T')[0] : bill.local_created.split('T')[0]
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: dateKey,
        total: 0,
        location: bill.location || '',
        items: []
      }
    }
    groups[dateKey].items.push(bill)
    groups[dateKey].total += (bill.amount || 0)
  })

  // 转为数组并按日期倒序
  return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * 创建账单
 */
function createBill(data) {
  const { 
    bookId, amount, category, note, images,
    payerId, payerName, memberIds, members,
    source = 'manual', aiConfidence = null
  } = data

  let splits = []
  
  if (data.splitType === SPLIT_TYPE.CUSTOM && data.customSplits) {
    splits = data.customSplits
  } else if (memberIds && memberIds.length > 0) {
    // 均分
    const shares = splitEqual(amount, memberIds.length)
    splits = memberIds.map((mid, idx) => {
      const member = members.find(m => m.id === mid)
      return {
        member_id: mid,
        name: member ? (member.nickname || member.shadow_name || '未知') : '未知',
        share: shares[idx],
        is_shadow: member && member.type === 'shadow'
      }
    })
  }

  const bill = {
    id: generateBillId(),
    book_id: bookId,
    amount: amount,
    amount_display: formatAmountDisplay(amount),
    category: category.key,
    category_name: category.name,
    note: note || '',
    images: images || [],
    payer_id: payerId,
    payer_name: payerName,
    splits: splits,
    split_type: data.splitType || SPLIT_TYPE.EQUAL,
    source: source,
    ai_confidence: aiConfidence,
    paid_at: data.paidAt || new Date().toISOString(),
    request_id: generateRequestId(),
    synced: false,
    local_created: new Date().toISOString(),
    server_updated: null
  }

  // 存入本地
  const allBills = cache.get(CACHE_KEY) || []
  allBills.unshift(bill)
  cache.set(CACHE_KEY, allBills)

  return bill
}

/**
 * 获取单个账单详情
 */
function getBillById(billId) {
  const allBills = cache.get(CACHE_KEY) || []
  return allBills.find(b => b.id === billId) || null
}

/**
 * 更新账单
 */
function updateBill(billId, updates) {
  const allBills = cache.get(CACHE_KEY) || []
  const index = allBills.findIndex(b => b.id === billId)
  if (index === -1) return null
  
  Object.assign(allBills[index], updates)
  cache.set(CACHE_KEY, allBills)
  return allBills[index]
}

/**
 * 删除账单
 */
function deleteBill(billId) {
  const allBills = cache.get(CACHE_KEY) || []
  const filtered = allBills.filter(b => b.id !== billId)
  cache.set(CACHE_KEY, filtered)
  return true
}

/**
 * 计算账本总支出
 */
function getTotalExpense(bookId) {
  const bills = getBills(bookId)
  return bills.reduce((sum, b) => sum + (b.amount || 0), 0)
}

function formatAmountDisplay(fen) {
  if (!fen && fen !== 0) return '0.00'
  return (Math.abs(fen) / 100).toFixed(2)
}

module.exports = {
  getBills,
  getBillsGroupedByDate,
  createBill,
  getBillById,
  updateBill,
  deleteBill,
  getTotalExpense
}
