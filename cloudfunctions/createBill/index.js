const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function verifyMember(openid, bookId) {
  const res = await db.collection('members')
    .where({ book_id: bookId, user_id: openid })
    .limit(1).get()
  return res.data.length > 0
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { bookId, amount, category, category_name, note, images, location,
          payer_id, payer_name, splits, split_type, source, paid_at } = event

  if (!bookId || amount === undefined) {
    return { success: false, code: 'INVALID_PARAMS' }
  }

  try {
    if (!await verifyMember(OPENID, bookId)) {
      return { success: false, code: 'FORBIDDEN' }
    }

    const now = Date.now()
    const billDoc = {
      book_id: bookId,
      amount,
      category: category || 'other',
      category_name: category_name || '其他',
      note: note || '',
      images: images || [],
      location: location || '',
      payer_id: payer_id || '',
      payer_name: payer_name || '',
      splits: (splits || []).map(s => ({
        member_id: s.member_id, name: s.name,
        share: s.share, is_shadow: s.is_shadow
      })),
      split_type: split_type || 'equal',
      source: source || 'manual',
      paid_at: paid_at || new Date().toISOString(),
      created_by: OPENID,
      created_at: now,
      updated_at: now,
      version: 1
    }

    const res = await db.collection('bills').add({ data: billDoc })

    // Update book timestamp
    await db.collection('books').doc(bookId).update({
      data: { updated_at: now }
    })

    return {
      success: true,
      data: { billId: res._id, created_at: now }
    }
  } catch (err) {
    console.error('createBill error:', err)
    return { success: false, code: 'CREATE_ERROR', message: err.message }
  }
}
