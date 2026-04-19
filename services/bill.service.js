/**
 * 账单服务 - CRUD + 分组
 * 云开发优先，本地降级
 */
const cache = require('../utils/cache')
const { generateBillId, generateRequestId } = require('../utils/id')
const { splitEqual } = require('../utils/currency')
const { SPLIT_TYPE } = require('../utils/constants')
const { sum } = require('../utils/calc')

const CACHE_KEY = 'bills'

/**
 * 检查云是否可用
 */
function _isCloudReady() {
  try {
    const app = getApp()
    return app && app.globalData && app.globalData.cloudReady && !!app.globalData.openid
  } catch (e) {
    return false
  }
}

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
    const dateKey = bill.paid_at ? bill.paid_at.split('T')[0] : (bill.local_created ? bill.local_created.split('T')[0] : new Date().toISOString().split('T')[0])
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: dateKey,
        total: 0,
        location: bill.location || '',
        items: []
      }
    }
    groups[dateKey].items.push(bill)
    groups[dateKey].total = groups[dateKey].total + (bill.amount || 0)
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
    const shares = splitEqual(amount || 0, memberIds.length)
    splits = memberIds.map((mid, idx) => {
      const member = (members || []).find(m => m.id === mid)
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
    category: category ? category.key : '',
    category_name: category ? category.name : '',
    note: note || '',
    images: images || [],
    location: data.location || '',
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

  // 后台同步到云端
  if (_isCloudReady()) {
    _syncBillToCloud(bill, data).catch(err => {
      console.error('Background cloud createBill failed:', err)
    })
  }

  return bill
}

/**
 * 后台同步账单到云端
 */
async function _syncBillToCloud(bill, data) {
  try {
    const bookService = require('./book.service')
    const books = bookService.getBookList()
    const book = books.find(b => b.id === bill.book_id)
    if (!book || !book.cloud_db_id) return

    // 使用 book 上存储的 local→cloud ID 映射
    const localToCloud = book._localToCloud || {}
    const remapId = function(localId) {
      return (localId && localToCloud[localId]) || localId
    }

    const cloudApi = require('../utils/cloud')
    await cloudApi.call('createBill', {
      bookId: book.cloud_db_id,
      amount: bill.amount,
      category: bill.category,
      category_name: bill.category_name,
      note: bill.note,
      images: bill.images,
      location: bill.location,
      payer_id: remapId(bill.payer_id),
      payer_name: bill.payer_name,
      splits: (bill.splits || []).map(function(s) {
        return {
          member_id: remapId(s.member_id),
          name: s.name,
          share: s.share,
          is_shadow: s.is_shadow
        }
      }),
      split_type: bill.split_type,
      source: bill.source,
      paid_at: bill.paid_at
    })

    // 标记为已同步
    const allBills = cache.get(CACHE_KEY) || []
    const idx = allBills.findIndex(b => b.id === bill.id)
    if (idx !== -1) {
      allBills[idx].synced = true
      cache.set(CACHE_KEY, allBills)
    }
  } catch (err) {
    console.error('_syncBillToCloud error:', err)
  }
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
  const bill = allBills.find(b => b.id === billId)
  const filtered = allBills.filter(b => b.id !== billId)
  cache.set(CACHE_KEY, filtered)

  // 后台同步删除到云端
  if (bill && _isCloudReady()) {
    _deleteBillFromCloud(bill).catch(err => {
      console.error('Background cloud deleteBill failed:', err)
    })
  }

  return true
}

/**
 * 后台从云端删除账单
 */
async function _deleteBillFromCloud(bill) {
  try {
    // 如果是云端同步的账单，id 就是云端 _id
    // 如果是本地创建的账单，暂时无法通过 id 匹配云端记录
    if (!bill.synced) return

    const cloudApi = require('../utils/cloud')
    await cloudApi.call('deleteBill', { billId: bill.id })
  } catch (err) {
    console.error('_deleteBillFromCloud error:', err)
  }
}

/**
 * 计算账本总支出
 */
function getTotalExpense(bookId) {
  const bills = getBills(bookId)
  return sum(bills.map(b => b.amount || 0))
}

/**
 * 导入云端账单到本地缓存（用于同步）
 * 已存在的账单不会重复导入
 * @param {string} localBookId - 本地 book.id
 * @param {array} cloudBills - syncData 返回的 bills 数组
 * @param {object|null} memberIdMap - cloud_member_id → local_member_id 映射（创建者模式需要）
 */
function importCloudBills(localBookId, cloudBills, memberIdMap) {
  const allBills = cache.get(CACHE_KEY) || []
  const existingIds = new Set(allBills.map(b => b.id))

  let added = 0
  cloudBills.forEach(cloudBill => {
    if (existingIds.has(cloudBill._id)) return

    // ID 映射：cloud_id → local_id
    const remapId = function(cloudId) {
      return (memberIdMap && cloudId && memberIdMap[cloudId]) || cloudId
    }

    allBills.push({
      id: cloudBill._id,
      book_id: localBookId,
      amount: cloudBill.amount,
      category: cloudBill.category,
      category_name: cloudBill.category_name,
      note: cloudBill.note || '',
      images: cloudBill.images || [],
      location: cloudBill.location || '',
      payer_id: remapId(cloudBill.payer_id),
      payer_name: cloudBill.payer_name,
      splits: (cloudBill.splits || []).map(function(s) {
        return {
          member_id: remapId(s.member_id),
          name: s.name,
          share: s.share,
          is_shadow: s.is_shadow
        }
      }),
      split_type: cloudBill.split_type || 'equal',
      source: cloudBill.source || 'cloud',
      paid_at: cloudBill.paid_at,
      synced: true,
      local_created: null,
      server_updated: cloudBill.updated_at
    })
    existingIds.add(cloudBill._id)
    added++
  })

  if (added > 0) {
    cache.set(CACHE_KEY, allBills)
  }
  return added
}

/**
 * 删除某账本的所有本地账单（用于删除账本时）
 */
function deleteBillsByBook(bookId) {
  const allBills = cache.get(CACHE_KEY) || []
  const filtered = allBills.filter(b => b.book_id !== bookId)
  cache.set(CACHE_KEY, filtered)
  return true
}

function formatAmountDisplay(fen) {
  if (fen == null || fen === '') return '0.00'
  const val = Number(fen)
  if (isNaN(val)) return '0.00'
  return (Math.abs(val) / 100).toFixed(2)
}

module.exports = {
  getBills,
  getBillsGroupedByDate,
  createBill,
  getBillById,
  updateBill,
  deleteBill,
  getTotalExpense,
  importCloudBills,
  deleteBillsByBook
}
