/**
 * 账本服务 - CRUD 操作
 * 云开发优先，本地降级
 */
const cache = require('../utils/cache')
const { generateBookId, generateMemberId } = require('../utils/id')
const { SKIN_COLORS } = require('../utils/constants')

const CACHE_KEY = 'books'
const ACTIVE_BOOK_ID_KEY = 'active_book_id'

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

function _getCloudApi() {
  return require('../utils/cloud')
}

function _getOpenid() {
  try {
    const app = getApp()
    return app && app.globalData ? app.globalData.openid : ''
  } catch (e) {
    return ''
  }
}

/**
 * 获取账本列表（本地优先）
 */
function getBookList() {
  return cache.get(CACHE_KEY) || []
}

/**
 * 获取当前活跃的账本
 */
function getCurrentBook() {
  const books = getBookList()
  const activeId = cache.get(ACTIVE_BOOK_ID_KEY)
  if (activeId) {
    return books.find(b => b.id === activeId) || null
  }
  return books.length > 0 ? books[0] : null
}

/**
 * 切换当前账本
 */
function setCurrentBook(bookId) {
  if (!bookId) return false
  const books = getBookList()
  const book = books.find(b => b.id === bookId)
  if (!book) return false
  cache.set(ACTIVE_BOOK_ID_KEY, bookId)
  return true
}

/**
 * 创建新账本（本地优先，后台同步云端）
 */
function createBook(data) {
  const creatorId = _getOpenid() || data.creatorId || ''

  // 先创建本地版本
  const book = _createBookLocal(data, creatorId)

  // 后台同步到云端
  if (_isCloudReady()) {
    _syncBookToCloud(book, data).catch(err => {
      console.error('Background cloud createBook failed:', err)
    })
  }

  return book
}

async function _syncBookToCloud(book, data) {
  const cloudApi = _getCloudApi()
  // 创建者昵称：优先用微信昵称（而非本地显示名"我"）
  var creatorNickname = ''
  try {
    var userInfo = getApp().globalData.userInfo
    if (userInfo && userInfo.nickname) creatorNickname = userInfo.nickname
  } catch (e) {}
  const result = await cloudApi.call('createBook', {
    name: data.name,
    cover_color: book.cover_color,
    currency: book.currency,
    currency_symbol: book.currency_symbol,
    start_date: book.start_date,
    end_date: null,
    shadowMembers: data.shadowMembers || [],
    creatorNickname: creatorNickname
  })

  // 更新本地缓存的 cloud_id 和 cloud_db_id（merge 避免覆盖其他并发写入）
  const books = getBookList()
  const idx = books.findIndex(b => b.id === book.id)
  if (idx !== -1) {
    books[idx].cloud_id = result.cloud_id
    books[idx].cloud_db_id = result.bookId
    // Re-read to merge with any books added during the async cloud call
    var freshBooks = getBookList()
    var freshIdx = freshBooks.findIndex(function(b) { return b.id === book.id })
    if (freshIdx !== -1) {
      freshBooks[freshIdx].cloud_id = result.cloud_id
      freshBooks[freshIdx].cloud_db_id = result.bookId
      cache.set(CACHE_KEY, freshBooks)
    }
  }
}

function _createBookLocal(data, creatorId) {
  const book = {
    id: generateBookId(),
    name: data.name,
    cover_color: data.coverColor || SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)].value,
    currency: data.currency || 'CNY',
    currency_symbol: data.currencySymbol || '¥',
    start_date: data.startDate || new Date().toISOString().split('T')[0],
    end_date: null,
    status: 'active',
    creator_id: creatorId,
    member_count: 1,
    created_at: Date.now(),
    updated_at: Date.now()
  }

  const creator = {
    id: generateMemberId(),
    book_id: book.id,
    type: 'real',
    user_id: creatorId,
    nickname: data.creatorName || '我',
    avatar_url: '',
    role: 'admin',
    joined_at: Date.now()
  }

  book.members = [creator]

  if (data.shadowMembers && data.shadowMembers.length > 0) {
    data.shadowMembers.forEach(name => {
      book.members.push({
        id: generateMemberId(),
        book_id: book.id,
        type: 'shadow',
        shadow_name: name,
        is_claimed: false,
        claimed_by: null,
        claimed_at: null,
        role: 'member',
        joined_at: Date.now()
      })
      book.member_count++
    })
  }

  const books = getBookList()
  books.push(book)
  cache.set(CACHE_KEY, books)
  cache.set(ACTIVE_BOOK_ID_KEY, book.id)

  return book
}

/**
 * 更新账本
 */
function updateBook(bookId, updates) {
  const books = getBookList()
  const index = books.findIndex(b => b.id === bookId)
  if (index === -1) return null

  Object.assign(books[index], updates, { updated_at: Date.now() })
  cache.set(CACHE_KEY, books)
  return books[index]
}

/**
 * 删除账本（本地优先，后台同步云端）
 * 仅创建者（admin）可删除，非创建者调用返回 false
 */
function deleteBook(bookId) {
  const books = getBookList()
  const book = books.find(b => b.id === bookId)

  // 权限校验：仅创建者可删除
  if (book) {
    var openid = _getOpenid()
    if (openid && book.creator_id && book.creator_id !== openid) {
      return false
    }
  }

  // 本地删除
  const filtered = books.filter(b => b.id !== bookId)
  cache.set(CACHE_KEY, filtered)
  const activeId = cache.get(ACTIVE_BOOK_ID_KEY)
  if (activeId === bookId) {
    cache.remove(ACTIVE_BOOK_ID_KEY)
  }

  // 删除本地账单
  const billService = require('./bill.service')
  billService.deleteBillsByBook(bookId)

  // 后台同步到云端（软删除）
  if (_isCloudReady() && book) {
    const cloudBookId = book.cloud_db_id || book.id
    const cloudApi = _getCloudApi()
    cloudApi.call('deleteBook', { bookId: cloudBookId }).catch(err => {
      console.error('Cloud deleteBook failed:', err)
    })
  }

  return true
}

/**
 * 归档账本 — 归档后任何人无法记账，但可查看
 */
function archiveBook(bookId) {
  return updateBook(bookId, { status: 'archived' })
}

/**
 * 取消归档 — 恢复为正常账本
 */
function unarchiveBook(bookId) {
  return updateBook(bookId, { status: 'active' })
}

/**
 * 仅删除本地账本副本（不调用云端，用于非创建者清理已删除的账本）
 */
function deleteBookLocal(bookId) {
  const books = getBookList()
  const filtered = books.filter(b => b.id !== bookId)
  cache.set(CACHE_KEY, filtered)
  const activeId = cache.get(ACTIVE_BOOK_ID_KEY)
  if (activeId === bookId) {
    cache.remove(ACTIVE_BOOK_ID_KEY)
  }
  const billService = require('./bill.service')
  billService.deleteBillsByBook(bookId)
  return true
}

/**
 * 通过 cloud_id 获取账本信息（用于邀请页）
 */
async function getBookByCloudId(cloudId) {
  if (!_isCloudReady()) return null
  try {
    const cloudApi = _getCloudApi()
    return await cloudApi.call('getBook', { cloudId })
  } catch (err) {
    console.error('getBookByCloudId error:', err)
    return null
  }
}

/**
 * 将云端账本数据导入本地缓存（用于认领/邀请成功后）
 * @param {object} cloudBook - getBook 返回的 book 对象
 * @param {array} cloudMembers - getBook 返回的 members 数组
 */
function importCloudBook(cloudBook, cloudMembers) {
  const books = getBookList()

  // 防止重复导入
  const existing = books.find(b => b.cloud_id === cloudBook.cloud_id || b.id === cloudBook._id)
  if (existing) return existing

  const book = {
    id: cloudBook._id,
    cloud_id: cloudBook.cloud_id,
    cloud_db_id: cloudBook._id,
    name: cloudBook.name,
    cover_color: cloudBook.cover_color,
    currency: cloudBook.currency || 'CNY',
    currency_symbol: cloudBook.currency_symbol || '¥',
    start_date: cloudBook.start_date,
    end_date: cloudBook.end_date || null,
    status: cloudBook.status || 'active',
    creator_id: cloudBook.creator_id,
    member_count: (cloudMembers || []).length,
    created_at: cloudBook.created_at,
    updated_at: cloudBook.updated_at || Date.now(),
    members: (cloudMembers || []).map(m => {
      // 已认领/真实成员 → nickname（微信用户名）优先，影子成员 → shadow_name 优先
      var displayName = (m.is_claimed || m.type === 'real')
        ? (m.nickname || m.shadow_name || '成员')
        : (m.shadow_name || m.nickname || '成员')
      return {
        id: m._id,
        book_id: cloudBook._id,
        type: m.type,
        user_id: m.user_id || '',
        nickname: m.nickname || displayName,
        avatar_url: m.avatar_url || '',
        shadow_name: m.shadow_name || '',
        is_claimed: m.is_claimed || false,
        claimed_by: m.claimed_by || null,
        claimed_at: m.claimed_at || null,
        role: m.role || 'member',
        joined_at: m.joined_at || Date.now()
      }
    })
  }

  books.push(book)
  cache.set(CACHE_KEY, books)
  return book
}

/**
 * 从云端同步成员和账单数据到本地缓存
 * @param {string} bookId - 本地 book.id
 * @returns {boolean|string} true=成功, false=失败, 'deleted'=云端已删除
 */
async function syncCloudMembers(bookId) {
  if (!_isCloudReady()) return false
  try {
    const books = getBookList()
    const book = books.find(b => b.id === bookId)
    if (!book) return false

    // A（创建者）的 book.id 是本地 ID，需要用 cloud_db_id 调用云函数
    // B（被邀请者）的 book.id 就是云端 _id
    const cloudBookId = book.cloud_db_id || book.id
    if (!cloudBookId) return false

    const cloudApi = _getCloudApi()
    const result = await cloudApi.call('syncData', { bookId: cloudBookId })
    if (!result) return false

    // 判断是否为创建者（本地 ID 与云端 ID 不同）
    const isCreator = book.cloud_db_id && book.cloud_db_id !== book.id

    // 构建 cloud_id → local_id 映射（用于账单 ID 转换）
    const cloudToLocal = {}
    const localToCloud = {}

    // 检查云端账本是否已被删除（创建者已删除 → 本地标记为只读）
    if (result.book && result.book.status === 'deleted') {
      // 如果本地已经主动删除过该账本，不再重新写入缓存
      const currentBooks = getBookList()
      if (!currentBooks.find(b => b.id === bookId)) {
        return 'deleted'
      }

      book.status = 'deleted'
      book.updated_at = Date.now()
      cache.set(CACHE_KEY, currentBooks.map(function(b) {
        if (b.id === bookId) {
          // Preserve cloud_id / cloud_db_id that may have been set after initial read
          if (!book.cloud_id && b.cloud_id) book.cloud_id = b.cloud_id
          if (!book.cloud_db_id && b.cloud_db_id) book.cloud_db_id = b.cloud_db_id
          return book
        }
        return b
      }))

      // 同步账单（让用户仍能查看流水）
      if (result.bills && result.bills.length > 0) {
        const billService = require('./bill.service')
        billService.importCloudBills(bookId, result.bills, isCreator ? cloudToLocal : null)
      }

      return 'deleted'
    }

    if (isCreator) {
      // 创建者模式：匹配云端成员到本地成员，只更新认领状态，不改变 ID
      // 避免破坏本地账单中的 payer_id / splits.member_id 引用
      _mergeMemberClaimStatus(book, result.members, cloudToLocal, localToCloud)
    } else {
      // 被邀请者模式：完整替换（ID 本身就是云端 _id，不会冲突）
      if (result.members) {
        book.members = result.members.map(m => {
          // 已认领/真实成员 → nickname（微信用户名）优先，影子成员 → shadow_name 优先
          var displayName = (m.is_claimed || m.type === 'real')
            ? (m.nickname || m.shadow_name || '成员')
            : (m.shadow_name || m.nickname || '成员')
          return {
            id: m._id,
            book_id: bookId,
            type: m.type,
            user_id: m.user_id || '',
            nickname: m.nickname || displayName,
            avatar_url: m.avatar_url || '',
            shadow_name: m.shadow_name || '',
            is_claimed: m.is_claimed || false,
            claimed_by: m.claimed_by || null,
            claimed_at: m.claimed_at || null,
            role: m.role || 'member',
            joined_at: m.joined_at || Date.now()
          }
        })
        book.member_count = book.members.length
      }
    }

    // 保存 ID 映射到 book 上（供账单上传时使用）
    if (Object.keys(localToCloud).length > 0) {
      book._localToCloud = localToCloud
    }

    book.updated_at = Date.now()
    // Re-read book list to avoid overwriting books added/removed during async cloud call
    var freshBooks = getBookList()
    var freshIdx = freshBooks.findIndex(function(b) { return b.id === bookId })
    if (freshIdx !== -1) {
      // Preserve cloud_id / cloud_db_id that may have been set by _syncBookToCloud
      // after our initial read
      if (!book.cloud_id && freshBooks[freshIdx].cloud_id) {
        book.cloud_id = freshBooks[freshIdx].cloud_id
      }
      if (!book.cloud_db_id && freshBooks[freshIdx].cloud_db_id) {
        book.cloud_db_id = freshBooks[freshIdx].cloud_db_id
      }
      freshBooks[freshIdx] = book
    }
    cache.set(CACHE_KEY, freshBooks)

    // 同步云端账单（双方都需要）
    if (result.bills && result.bills.length > 0) {
      const billService = require('./bill.service')
      billService.importCloudBills(bookId, result.bills, isCreator ? cloudToLocal : null)
    }

    // 创建者模式：映射表构建完成后，重试上传之前因无映射而跳过的账单
    if (isCreator && Object.keys(localToCloud).length > 0) {
      const billService = require('./bill.service')
      billService.retryUnsyncedBills(bookId)
    }

    return true
  } catch (err) {
    console.error('syncCloudMembers error:', err)
    return false
  }
}

/**
 * 创建者模式：将云端成员的认领状态合并到本地成员
 * 同时构建 cloud→local 和 local→cloud 的 ID 映射
 * 匹配规则：按 shadow_name 匹配（影子成员可能已被认领为 real），真实成员按 user_id 匹配
 * 未匹配的云端成员（如 directJoin 新加入的）会被添加到本地
 */
function _mergeMemberClaimStatus(book, cloudMembers, cloudToLocal, localToCloud) {
  if (!cloudMembers || !book.members) return

  cloudMembers.forEach(cm => {
    const local = book.members.find(lm => {
      // 按影子名字匹配（覆盖已认领的情况：云端已变为 real 但仍有 shadow_name）
      if (cm.shadow_name && lm.shadow_name && cm.shadow_name === lm.shadow_name) {
        return true
      }
      // 按 user_id 匹配（真实成员）
      if (cm.user_id && lm.user_id && cm.user_id === lm.user_id) {
        return true
      }
      return false
    })

    if (local) {
      // 构建 ID 映射
      cloudToLocal[cm._id] = local.id
      localToCloud[local.id] = cm._id

      // 更新认领状态
      local.is_claimed = cm.is_claimed || false
      local.claimed_by = cm.claimed_by || null
      local.claimed_at = cm.claimed_at || null
      // 如果影子成员被认领为真实成员
      if (cm.type === 'real' && local.type === 'shadow' && cm.is_claimed) {
        local.type = 'real'
        local.nickname = cm.nickname || local.shadow_name
        local.user_id = cm.user_id || ''
      }
      // 同步云端昵称（如果本地为空但云端有值）
      if (!local.nickname && cm.nickname) {
        local.nickname = cm.nickname
      }
    } else if (cm.type === 'real' && cm.user_id) {
      // 云端新增的真实成员（如通过 directJoin 加入），本地尚无对应条目
      // 直接使用云端 _id 作为本地 ID（与被邀请者模式一致）
      var newMember = {
        id: cm._id,
        book_id: book.id,
        type: 'real',
        user_id: cm.user_id || '',
        nickname: cm.nickname || '',
        avatar_url: cm.avatar_url || '',
        shadow_name: cm.shadow_name || '',
        is_claimed: cm.is_claimed || false,
        claimed_by: cm.claimed_by || null,
        claimed_at: cm.claimed_at || null,
        role: cm.role || 'member',
        joined_at: cm.joined_at || Date.now()
      }
      book.members.push(newMember)
      book.member_count = book.members.length

      // ID 映射：云端 _id 直接作为本地 id
      cloudToLocal[cm._id] = newMember.id
      localToCloud[newMember.id] = cm._id
    }
  })
}

module.exports = {
  getBookList,
  getCurrentBook,
  setCurrentBook,
  createBook,
  updateBook,
  deleteBook,
  deleteBookLocal,
  archiveBook,
  unarchiveBook,
  getBookByCloudId,
  importCloudBook,
  syncCloudMembers
}
