const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const crypto = require('crypto')

async function verifyAdmin(openid, bookId) {
  const res = await db.collection('members')
    .where({ book_id: bookId, user_id: openid, role: 'admin' })
    .limit(1).get()
  return res.data.length > 0
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { bookId, type = 'generic', shadowMemberId } = event

  if (!bookId) return { success: false, code: 'INVALID_PARAMS' }

  try {
    if (!await verifyAdmin(OPENID, bookId)) {
      return { success: false, code: 'FORBIDDEN', message: 'Admin required' }
    }

    const now = Date.now()
    const token = crypto.randomBytes(16).toString('hex')

    const inviteDoc = {
      book_id: bookId,
      token,
      created_by: OPENID,
      type,
      target_shadow_member_id: type === 'shadow_claim' ? (shadowMemberId || null) : null,
      used_by: null,
      used_at: null,
      expires_at: now + 7 * 24 * 60 * 60 * 1000, // 7 days
      created_at: now
    }

    await db.collection('invites').add({ data: inviteDoc })

    return {
      success: true,
      data: { token, expires_at: inviteDoc.expires_at }
    }
  } catch (err) {
    console.error('generateInvite error:', err)
    return { success: false, code: 'CREATE_ERROR', message: err.message }
  }
}
