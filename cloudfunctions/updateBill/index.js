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
  const { billId, updates } = event

  if (!billId || !updates) return { success: false, code: 'INVALID_PARAMS' }

  try {
    // Get bill to check book ownership
    const billRes = await db.collection('bills').doc(billId).get()
    const bill = billRes.data

    const member = await getMemberRole(OPENID, bill.book_id)
    if (!member) return { success: false, code: 'FORBIDDEN' }

    // Only bill creator or admin can edit
    if (bill.created_by !== OPENID && member.role !== 'admin') {
      return { success: false, code: 'FORBIDDEN', message: 'Not bill creator or admin' }
    }

    const allowedFields = ['amount', 'category', 'category_name', 'note', 'images',
                           'location', 'payer_id', 'payer_name', 'splits', 'split_type', 'paid_at']
    const safeUpdates = {}
    for (const key of allowedFields) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key]
    }
    safeUpdates.updated_at = Date.now()

    await db.collection('bills').doc(billId).update({ data: safeUpdates })

    return { success: true }
  } catch (err) {
    console.error('updateBill error:', err)
    return { success: false, code: 'UPDATE_ERROR', message: err.message }
  }
}
