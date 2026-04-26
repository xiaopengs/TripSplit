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
      try {
        const res = await db.collection('books').doc(bookId).get()
        book = res.data
      } catch (docErr) {
        // bookId 可能是本地 ID（非云端 _id），尝试用 cloudId 降级查找
        if (cloudId) {
          const res = await db.collection('books').where({ cloud_id: cloudId }).limit(1).get()
          if (res.data.length === 0) return { success: false, code: 'NOT_FOUND', message: '账本不存在' }
          book = res.data[0]
        } else {
          return { success: false, code: 'NOT_FOUND', message: '账本不存在，可能尚未同步到云端' }
        }
      }
    } else if (cloudId) {
      const res = await db.collection('books').where({ cloud_id: cloudId }).limit(1).get()
      if (res.data.length === 0) return { success: false, code: 'NOT_FOUND', message: '账本不存在' }
      book = res.data[0]
    } else {
      return { success: false, code: 'INVALID_PARAMS' }
    }

    // Check membership
    const memRes = await db.collection('members')
      .where({ book_id: book._id, user_id: OPENID })
      .limit(1).get()
    const isMember = memRes.data.length > 0

    // Get all members (分页获取，默认 get() 最多返回 20 条)
    var members = []
    var batchSize = 100
    var batch = await db.collection('members')
      .where({ book_id: book._id }).limit(batchSize).get()
    members = members.concat(batch.data)
    while (batch.data.length === batchSize) {
      batch = await db.collection('members')
        .where({ book_id: book._id }).skip(members.length).limit(batchSize).get()
      members = members.concat(batch.data)
    }

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
