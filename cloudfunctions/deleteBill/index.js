const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function getMemberRole(openid, bookId) {
  const res = await db.collection('members')
    .where({ book_id: bookId, user_id: openid })
    .limit(1).get()
  return res.data.length > 0 ? res.data[0] : null
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { billId } = event

  if (!billId) return { success: false, code: 'INVALID_PARAMS' }

  try {
    const billRes = await db.collection('bills').doc(billId).get()
    const bill = billRes.data

    const member = await getMemberRole(OPENID, bill.book_id)
    if (!member) return { success: false, code: 'FORBIDDEN' }

    if (bill.created_by !== OPENID && member.role !== 'admin') {
      return { success: false, code: 'FORBIDDEN', message: 'Not bill creator or admin' }
    }

    await db.collection('bills').doc(billId).remove()

    return { success: true }
  } catch (err) {
    console.error('deleteBill error:', err)
    return { success: false, code: 'DELETE_ERROR', message: err.message }
  }
}
