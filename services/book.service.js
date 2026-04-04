/**
 * 账本服务 - CRUD 操作
 */
const cache = require('../utils/cache')
const { generateBookId, generateMemberId } = require('../utils/id')
const { SKIN_COLORS } = require('../utils/constants')

const CACHE_KEY = 'books'

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
  return books.find(b => b.status === 'active') || null
}

/**
 * 创建新账本
 */
function createBook(data) {
  const book = {
    id: generateBookId(),
    name: data.name,
    cover_color: data.coverColor || SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)].value,
    currency: data.currency || 'CNY',
    currency_symbol: data.currencySymbol || '¥',
    start_date: data.startDate || new Date().toISOString().split('T')[0],
    end_date: null,
    status: 'active',
    creator_id: data.creatorId || '',
    member_count: 1,
    created_at: Date.now(),
    updated_at: Date.now()
  }

  // 添加创建者为第一个成员
  const creator = {
    id: generateMemberId(),
    book_id: book.id,
    type: 'real',
    user_id: data.creatorId || '',
    nickname: data.creatorName || '我',
    avatar_url: '',
    role: 'admin',
    joined_at: Date.now()
  }

  book.members = [creator]
  
  // 添加影子成员
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

  // 保存
  const books = getBookList()
  books.push(book)
  cache.set(CACHE_KEY, books)

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
 * 归档账本
 */
function archiveBook(bookId) {
  return updateBook(bookId, { status: 'archived', end_date: new Date().toISOString().split('T')[0] })
}

/**
 * 删除账本（软删除）
 */
function deleteBook(bookId) {
  const books = getBookList()
  const filtered = books.filter(b => b.id !== bookId)
  cache.set(CACHE_KEY, filtered)
  return true
}

module.exports = {
  getBookList,
  getCurrentBook,
  createBook,
  updateBook,
  archiveBook,
  deleteBook
}
