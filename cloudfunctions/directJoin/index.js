const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 直接加入账本（不认领任何影子成员）
 * 以微信昵称作为新成员加入
 */
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { bookId, nickname } = event

  if (!bookId) {
    return { success: false, code: 'INVALID_PARAMS', message: '缺少账本ID' }
  }

  try {
    // 1. Check not already a member
    const existingMem = await db.collection('members')
      .where({ book_id: bookId, user_id: OPENID })
      .limit(1).get()
    if (existingMem.data.length > 0) {
      return { success: false, code: 'ALREADY_MEMBER', message: '你已是该账本成员' }
    }

    // 2. Check book exists and is active
    let book = null
    try {
      const bookRes = await db.collection('books').doc(bookId).get()
      book = bookRes.data
    } catch (e) {
      return { success: false, code: 'BOOK_NOT_FOUND', message: '账本不存在' }
    }

    if (book.status === 'archived' || book.status === 'deleted') {
      return { success: false, code: 'BOOK_UNAVAILABLE', message: '账本已不可用' }
    }

    // 3. Create a new real member
    const now = Date.now()
    await db.collection('members').add({
      data: {
        book_id: bookId,
        type: 'real',
        user_id: OPENID,
        nickname: nickname || '',
        avatar_url: '',
        shadow_name: '',
        is_claimed: false,
        claimed_by: null,
        claimed_at: null,
        role: 'member',
        joined_at: now
      }
    })

    // 4. Increment member count
    await db.collection('books').doc(bookId).update({
      data: { member_count: _.inc(1), updated_at: now }
    })

    return {
      success: true,
      data: { bookId, bookName: book.name }
    }
  } catch (err) {
    console.error('directJoin error:', err)
    return { success: false, code: 'JOIN_ERROR', message: err.message }
  }
}
