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
  const { bookId } = event

  if (!bookId) return { success: false, code: 'INVALID_PARAMS' }

  try {
    if (!await verifyAdmin(OPENID, bookId)) {
      return { success: false, code: 'FORBIDDEN', message: 'Admin required' }
    }

    // Soft delete
    await db.collection('books').doc(bookId).update({
      data: { status: 'deleted', updated_at: Date.now() }
    })

    return { success: true }
  } catch (err) {
    console.error('deleteBook error:', err)
    return { success: false, code: 'DELETE_ERROR', message: err.message }
  }
}
