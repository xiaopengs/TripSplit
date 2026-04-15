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
  const { bookId, updates } = event

  if (!bookId || !updates) {
    return { success: false, code: 'INVALID_PARAMS' }
  }

  try {
    if (!await verifyAdmin(OPENID, bookId)) {
      return { success: false, code: 'FORBIDDEN', message: 'Admin required' }
    }

    const allowedFields = ['name', 'cover_color', 'currency', 'currency_symbol', 'start_date', 'end_date']
    const safeUpdates = {}
    for (const key of allowedFields) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key]
    }
    safeUpdates.updated_at = Date.now()

    await db.collection('books').doc(bookId).update({ data: safeUpdates })

    return { success: true, data: { updatedFields: Object.keys(safeUpdates) } }
  } catch (err) {
    console.error('updateBook error:', err)
    return { success: false, code: 'UPDATE_ERROR', message: err.message }
  }
}
