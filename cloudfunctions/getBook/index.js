const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { bookId, cloudId } = event

  try {
    // Find book by _id or cloud_id
    let book
    if (bookId) {
      const res = await db.collection('books').doc(bookId).get()
      book = res.data
    } else if (cloudId) {
      const res = await db.collection('books').where({ cloud_id: cloudId }).limit(1).get()
      if (res.data.length === 0) return { success: false, code: 'NOT_FOUND' }
      book = res.data[0]
    } else {
      return { success: false, code: 'INVALID_PARAMS' }
    }

    // Check membership
    const memRes = await db.collection('members')
      .where({ book_id: book._id, user_id: OPENID })
      .limit(1).get()
    const isMember = memRes.data.length > 0

    // Get all members
    const allMembersRes = await db.collection('members')
      .where({ book_id: book._id }).get()
    const members = allMembersRes.data

    return {
      success: true,
      data: {
        book,
        members,
        isMember,
        memberRole: isMember ? memRes.data[0].role : null
      }
    }
  } catch (err) {
    console.error('getBook error:', err)
    return { success: false, code: 'GET_ERROR', message: err.message }
  }
}
