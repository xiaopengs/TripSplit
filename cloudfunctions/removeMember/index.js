const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function verifyAdmin(openid, bookId) {
  const res = await db.collection('members')
    .where({ book_id: bookId, user_id: openid, role: 'admin' })
    .limit(1).get()
  return res.data.length > 0
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { bookId, memberId } = event

  if (!bookId || !memberId) return { success: false, code: 'INVALID_PARAMS' }

  try {
    if (!await verifyAdmin(OPENID, bookId)) {
      return { success: false, code: 'FORBIDDEN', message: 'Admin required' }
    }

    // Verify target member belongs to this book
    const targetRes = await db.collection('members').doc(memberId).get()
    if (targetRes.data.book_id !== bookId) {
      return { success: false, code: 'INVALID_PARAMS', message: 'Member not in this book' }
    }

    // Don't remove last admin
    if (targetRes.data.role === 'admin') {
      const adminCount = await db.collection('members')
        .where({ book_id: bookId, role: 'admin' }).count()
      if (adminCount.total <= 1) {
        return { success: false, code: 'LAST_ADMIN', message: 'Cannot remove last admin' }
      }
    }

    // Remove member
    await db.collection('members').doc(memberId).remove()

    // Decrement member count
    await db.collection('books').doc(bookId).update({
      data: { member_count: _.inc(-1), updated_at: Date.now() }
    })

    return { success: true }
  } catch (err) {
    console.error('removeMember error:', err)
    return { success: false, code: 'REMOVE_ERROR', message: err.message }
  }
}
