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
  shadowMember.nickname = (userInfo && userInfo.nickName) || shadowMember.shadow_name
  shadowMember.avatar_url = (userInfo && userInfo.avatarUrl) || ''

  // 将该成员的账单归属权迁移（如有）
  migrateBillOwnership(bookId, shadowMemberId, userId)

  cache.set('books', books)
  return true
}

/**
 * 迁移账单归属权：将影子成员的记录迁移至真实用户 ID
 */
function migrateBillOwnership(bookId, shadowMemberId, userId) {
  const bills = cache.get('bills') || []
  let updated = false

  bills.forEach(bill => {
    if (bill.book_id !== bookId) return
    
    // Only update the is_shadow flag in splits, keep member_id unchanged
    ;(bill.splits || []).forEach(split => {
      if (split.member_id === shadowMemberId) {
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
 * 同时级联更新：移除该成员在账单分账中的记录，并将该成员份额均摊给剩余成员
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

  // 级联更新账单：移除该成员的分账记录并重新均摊
  _redistributeBillsForMember(bookId, memberId, book.members || [])

  cache.set('books', books)
  return true
}

/**
 * 将被移除成员的账单份额重新均摊给剩余成员
 * 同时处理被移除成员作为支付者的情况
 */
function _redistributeBillsForMember(bookId, removedMemberId, remainingMembers) {
  const bills = cache.get('bills') || []
  let updated = false

  const remainingIds = new Set(remainingMembers.map(m => m.id))

  bills.forEach(bill => {
    if (bill.book_id !== bookId) return

    let billUpdated = false
    const splits = bill.splits || []

    // 检查是否包含被移除的成员的分账
    const removedSplit = splits.find(s => s.member_id === removedMemberId)
    if (removedSplit) {
      // 移除该成员的分账
      const newSplits = splits.filter(s => s.member_id !== removedMemberId)
      const remainingCount = newSplits.length

      if (remainingCount > 0) {
        // 将被移除成员的份额均摊给剩余成员
        const sharePerPerson = Math.floor(removedSplit.share / remainingCount)
        const remainder = removedSplit.share - sharePerPerson * remainingCount
        for (let i = 0; i < remainingCount; i++) {
          newSplits[i].share += sharePerPerson + (i < remainder ? 1 : 0)
        }
      }

      bill.splits = newSplits
      billUpdated = true
    }

    // 处理被移除成员是支付者的情况：将支付者转移给剩余成员中的第一个
    if (bill.payer_id === removedMemberId && remainingMembers.length > 0) {
      const newPayer = remainingMembers[0]
      bill.payer_id = newPayer.id
      bill.payer_name = newPayer.nickname || newPayer.shadow_name || '未知'
      billUpdated = true
    }

    if (billUpdated) updated = true
  })

  if (updated) {
    cache.set('bills', bills)
  }
}

module.exports = {
  getMembers,
  addShadowMember,
  claimShadowMember,
  removeMember
}
