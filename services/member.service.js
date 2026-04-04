/**
 * 成员管理服务
 */
const cache = require('../utils/cache')
const { generateMemberId } = require('../utils/id')
const { MEMBER_TYPE } = require('../utils/constants')
const bookService = require('./book.service')

/**
 * 获取账本成员列表
 */
function getMembers(bookId) {
  const book = bookService.getCurrentBook()
  if (!book || book.id !== bookId) return []
  return book.members || []
}

/**
 * 添加影子成员
 */
function addShadowMember(bookId, name) {
  const books = bookService.getBookList()
  const book = books.find(b => b.id === bookId)
  if (!book) return null

  const member = {
    id: generateMemberId(),
    book_id: bookId,
    type: MEMBER_TYPE.SHADOW,
    shadow_name: name,
    is_claimed: false,
    claimed_by: null,
    claimed_at: null,
    role: 'member',
    joined_at: Date.now()
  }

  if (!book.members) book.members = []
  book.members.push(member)
  book.member_count++
  book.updated_at = Date.now()

  cache.set('books', books)
  return member
}

/**
 * 认领影子身份
 */
function claimShadowMember(bookId, shadowMemberId, userId, userInfo) {
  const books = bookService.getBookList()
  const book = books.find(b => b.id === bookId)
  if (!book) return false

  const shadowMember = (book.members || []).find(
    m => m.id === shadowMemberId && m.type === MEMBER_TYPE.SHADOW
  )
  
  if (!shadowMember || shadowMember.is_claimed) return false

  // 更新影子成员为已认领
  shadowMember.is_claimed = true
  shadowMember.claimed_by = userId
  shadowMember.claimed_at = Date.now()
  shadowMember.user_id = userId
  shadowMember.nickname = userInfo?.nickName || shadowMember.shadow_name
  shadowMember.avatar_url = userInfo?.avatarUrl || ''

  // 将该成员的账单归属权迁移（如有）
  migrateBillOwnership(bookId, shadowMemberId, userId)

  cache.set('books', books)
  return true
}

/**
 * 迁移账单归属权：将影子成员的记录迁移至真实用户 ID
 */
function migrateBillOwnership(bookId, oldMemberId, newUserId) {
  const bills = cache.get('bills') || []
  let updated = false

  bills.forEach(bill => {
    if (bill.book_id !== bookId) return
    
    // 更新支付人
    if (bill.payer_id === oldMemberId) {
      bill.payer_id = `user_${newUserId}`
      updated = true
    }

    // 更新分摊列表
    ;(bill.splits || []).forEach(split => {
      if (split.member_id === oldMemberId) {
        split.member_id = `user_${newUserId}`
        split.is_shadow = false
        updated = true
      }
    })
  })

  if (updated) {
    cache.set('bills', bills)
  }
}

/**
 * 移除成员
 */
function removeMember(bookId, memberId) {
  const books = bookService.getBookList()
  const book = books.find(b => b.id === bookId)
  if (!book) return false

  const index = (book.members || []).findIndex(m => m.id === memberId)
  if (index === -1) return false

  book.members.splice(index, 1)
  book.member_count--
  book.updated_at = Date.now()

  cache.set('books', books)
  return true
}

module.exports = {
  getMembers,
  addShadowMember,
  claimShadowMember,
  removeMember
}
