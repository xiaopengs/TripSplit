const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function verifyMember(openid, bookId) {
  const res = await db.collection('members')
    .where({ book_id: bookId, user_id: openid })
    .limit(1).get()
  return res.data.length > 0 ? res.data[0] : null
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { bookId, since } = event

  if (!bookId) return { success: false, code: 'INVALID_PARAMS' }

  try {
    const member = await verifyMember(OPENID, bookId)
    if (!member) return { success: false, code: 'FORBIDDEN' }

    const query = { book_id: bookId }
    if (since) query.updated_at = _.gt(since)

    const billsRes = await db.collection('bills').where(query)
      .orderBy('paid_at', 'desc').limit(200).get()

    return {
      success: true,
      data: {
        bills: billsRes.data,
        count: billsRes.data.length
      }
    }
  } catch (err) {
    console.error('getBookBills error:', err)
    return { success: false, code: 'GET_ERROR', message: err.message }
  }
}
