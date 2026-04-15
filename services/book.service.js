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
  const result = await cloudApi.call('createBook', {
    name: data.name,
    cover_color: book.cover_color,
    currency: book.currency,
    currency_symbol: book.currency_symbol,
    start_date: book.start_date,
    end_date: null,
    shadowMembers: data.shadowMembers || []
  })

  // 更新本地缓存的 cloud_id
  const books = getBookList()
  const idx = books.findIndex(b => b.id === book.id)
  if (idx !== -1) {
    books[idx].cloud_id = result.cloud_id
    cache.set(CACHE_KEY, books)
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
 */
function deleteBook(bookId) {
  // 本地删除
  const books = getBookList()
  const filtered = books.filter(b => b.id !== bookId)
  cache.set(CACHE_KEY, filtered)
  const activeId = cache.get(ACTIVE_BOOK_ID_KEY)
  if (activeId === bookId) {
    cache.remove(ACTIVE_BOOK_ID_KEY)
  }

  // 后台同步到云端
  if (_isCloudReady()) {
    const cloudApi = _getCloudApi()
    cloudApi.call('deleteBook', { bookId }).catch(err => {
      console.error('Cloud deleteBook failed:', err)
    })
  }

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

module.exports = {
  getBookList,
  getCurrentBook,
  setCurrentBook,
  createBook,
  updateBook,
  deleteBook,
  getBookByCloudId
}
