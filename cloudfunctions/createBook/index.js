const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { name, cover_color, currency, currency_symbol, start_date, end_date, shadowMembers, creatorNickname } = event

  if (!name) {
    return { success: false, code: 'INVALID_PARAMS', message: 'Missing book name' }
  }

  try {
    const now = Date.now()
    const cloud_id = now.toString(36) + Math.random().toString(36).substring(2, 8)

    // 1. Create book
    const bookDoc = {
      name, cover_color: cover_color || '#34C759',
      currency: currency || 'CNY', currency_symbol: currency_symbol || '¥',
      start_date: start_date || '', end_date: end_date || null,
      status: 'active', creator_id: OPENID,
      member_count: 1 + (shadowMembers ? shadowMembers.length : 0),
      created_at: now, updated_at: now,
      cloud_id, version: 1
    }
    const bookRes = await db.collection('books').add({ data: bookDoc })
    const bookId = bookRes._id

    // 2. Create creator member
    const creatorDoc = {
      book_id: bookId, type: 'real', user_id: OPENID,
      nickname: creatorNickname || '', avatar_url: '',
      shadow_name: '', is_claimed: false,
      claimed_by: null, claimed_at: null,
      role: 'admin', joined_at: now
    }
    await db.collection('members').add({ data: creatorDoc })

    // 3. Create shadow members
    const shadowDocs = []
    if (shadowMembers && shadowMembers.length > 0) {
      for (const sm of shadowMembers) {
        shadowDocs.push({
          book_id: bookId, type: 'shadow', user_id: '',
          nickname: '', avatar_url: '',
          shadow_name: sm, is_claimed: false,
          claimed_by: null, claimed_at: null,
          role: 'member', joined_at: now
        })
      }
      for (const doc of shadowDocs) {
        await db.collection('members').add({ data: doc })
      }
    }

    return {
      success: true,
      data: {
        bookId, cloud_id, member_count: bookDoc.member_count,
        created_at: now
      }
    }
  } catch (err) {
    console.error('createBook error:', err)
    return { success: false, code: 'CREATE_ERROR', message: err.message }
  }
}
