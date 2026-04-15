const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function verifyAdmin(openid, bookId) {
  const res = await db.collection('members')
    .where({ book_id: bookId, user_id: openid, role: 'admin' })
    .limit(1).get()
  return res.data.length > 0
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { bookId, shadowName } = event

  if (!bookId || !shadowName) return { success: false, code: 'INVALID_PARAMS' }

  try {
    if (!await verifyAdmin(OPENID, bookId)) {
      return { success: false, code: 'FORBIDDEN', message: 'Admin required' }
    }

    const now = Date.now()
    const memberDoc = {
      book_id: bookId, type: 'shadow', user_id: '',
      nickname: '', avatar_url: '',
      shadow_name: shadowName, is_claimed: false,
      claimed_by: null, claimed_at: null,
      role: 'member', joined_at: now
    }
    const res = await db.collection('members').add({ data: memberDoc })

    // Increment member count
    await db.collection('books').doc(bookId).update({
      data: { member_count: db.command.inc(1), updated_at: now }
    })

    return { success: true, data: { memberId: res._id } }
  } catch (err) {
    console.error('addShadowMember error:', err)
    return { success: false, code: 'CREATE_ERROR', message: err.message }
  }
}
