const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { token } = event

  if (!token) return { success: false, code: 'INVALID_PARAMS' }

  try {
    // 1. Look up invite
    const inviteRes = await db.collection('invites')
      .where({ token, used_by: null })
      .limit(1).get()

    if (inviteRes.data.length === 0) {
      return { success: false, code: 'TOKEN_INVALID', message: '邀请码无效或已使用' }
    }

    const invite = inviteRes.data[0]
    const now = Date.now()

    if (invite.expires_at && invite.expires_at < now) {
      return { success: false, code: 'TOKEN_EXPIRED', message: '邀请已过期' }
    }

    // 2. Check book exists and is active
    const bookRes = await db.collection('books').doc(invite.book_id).get()
    const book = bookRes.data
    if (book.status !== 'active') {
      return { success: false, code: 'BOOK_UNAVAILABLE', message: '账本已不可用' }
    }

    // 3. Check not already a member
    const existingMem = await db.collection('members')
      .where({ book_id: book._id, user_id: OPENID })
      .limit(1).get()
    if (existingMem.data.length > 0) {
      // Already a member — just return book info
      return {
        success: true,
        data: { bookId: book._id, alreadyMember: true, bookName: book.name }
      }
    }

    // 4. Join based on invite type
    if (invite.type === 'shadow_claim' && invite.target_shadow_member_id) {
      // Claim a specific shadow member
      const shadowRes = await db.collection('members').doc(invite.target_shadow_member_id).get()
      const shadow = shadowRes.data

      if (shadow.type !== 'shadow' || shadow.is_claimed) {
        return { success: false, code: 'ALREADY_CLAIMED', message: '该影子成员已被认领' }
      }

      await db.collection('members').doc(shadow._id).update({
        data: {
          type: 'real',
          user_id: OPENID,
          is_claimed: true,
          claimed_by: OPENID,
          claimed_at: now,
          nickname: shadow.shadow_name,
          updated_at: now
        }
      })
    } else {
      // Generic invite — create a new real member
      await db.collection('members').add({
        data: {
          book_id: book._id, type: 'real', user_id: OPENID,
          nickname: '', avatar_url: '',
          shadow_name: '', is_claimed: false,
          claimed_by: null, claimed_at: null,
          role: 'member', joined_at: now
        }
      })

      // Increment member count
      await db.collection('books').doc(book._id).update({
        data: { member_count: _.inc(1), updated_at: now }
      })
    }

    // 5. Mark invite as used
    await db.collection('invites').doc(invite._id).update({
      data: { used_by: OPENID, used_at: now }
    })

    return {
      success: true,
      data: {
        bookId: book._id,
        bookName: book.name,
        alreadyMember: false
      }
    }
  } catch (err) {
    console.error('joinBook error:', err)
    return { success: false, code: 'JOIN_ERROR', message: err.message }
  }
}
