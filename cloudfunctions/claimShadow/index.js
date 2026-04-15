const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { bookId, shadowMemberId, nickname } = event

  if (!bookId || !shadowMemberId) {
    return { success: false, code: 'INVALID_PARAMS' }
  }

  try {
    // Check not already a member
    const existingMem = await db.collection('members')
      .where({ book_id: bookId, user_id: OPENID })
      .limit(1).get()
    if (existingMem.data.length > 0) {
      return { success: false, code: 'ALREADY_MEMBER', message: '你已是该账本成员' }
    }

    // Get shadow member
    const shadowRes = await db.collection('members').doc(shadowMemberId).get()
    const shadow = shadowRes.data

    if (shadow.book_id !== bookId) {
      return { success: false, code: 'INVALID_PARAMS', message: '成员不属于此账本' }
    }
    if (shadow.type !== 'shadow') {
      return { success: false, code: 'NOT_SHADOW', message: '该成员不是影子成员' }
    }
    if (shadow.is_claimed) {
      return { success: false, code: 'ALREADY_CLAIMED', message: '该影子成员已被认领' }
    }

    // Claim
    const now = Date.now()
    await db.collection('members').doc(shadowMemberId).update({
      data: {
        type: 'real',
        user_id: OPENID,
        nickname: nickname || shadow.shadow_name,
        is_claimed: true,
        claimed_by: OPENID,
        claimed_at: now,
        updated_at: now
      }
    })

    return {
      success: true,
      data: { memberId: shadowMemberId, bookId }
    }
  } catch (err) {
    console.error('claimShadow error:', err)
    return { success: false, code: 'CLAIM_ERROR', message: err.message }
  }
}
