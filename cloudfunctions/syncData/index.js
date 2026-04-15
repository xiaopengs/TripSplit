const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function verifyMember(openid, bookId) {
  const res = await db.collection('members')
    .where({ book_id: bookId, user_id: openid })
    .limit(1).get()
  return res.data.length > 0
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { bookId, since } = event

  if (!bookId) return { success: false, code: 'INVALID_PARAMS' }

  try {
    if (!await verifyMember(OPENID, bookId)) {
      return { success: false, code: 'FORBIDDEN' }
    }

    const now = Date.now()

    // Get book
    const bookRes = await db.collection('books').doc(bookId).get()

    // Get all members
    const membersRes = await db.collection('members')
      .where({ book_id: bookId }).get()

    // Get bills (optionally since a timestamp)
    const billQuery = { book_id: bookId }
    if (since) billQuery.updated_at = _.gt(since)

    const billsRes = await db.collection('bills')
      .where(billQuery).orderBy('paid_at', 'desc').limit(500).get()

    return {
      success: true,
      data: {
        book: bookRes.data,
        members: membersRes.data,
        bills: billsRes.data,
        serverTimestamp: now
      }
    }
  } catch (err) {
    console.error('syncData error:', err)
    return { success: false, code: 'SYNC_ERROR', message: err.message }
  }
}
