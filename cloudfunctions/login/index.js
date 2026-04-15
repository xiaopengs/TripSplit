const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  try {
    const userRes = await db.collection('users')
      .where({ openid: OPENID })
      .limit(1)
      .get()

    let user
    if (userRes.data.length > 0) {
      user = userRes.data[0]
      await db.collection('users').doc(user._id).update({
        data: { updated_at: Date.now() }
      })
    } else {
      const newUser = {
        openid: OPENID,
        nickname: '',
        avatar_url: '',
        created_at: Date.now(),
        updated_at: Date.now(),
        settings: {}
      }
      const createRes = await db.collection('users').add({ data: newUser })
      user = { ...newUser, _id: createRes._id }
    }

    return {
      success: true,
      data: {
        openid: OPENID,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        isNew: userRes.data.length === 0
      }
    }
  } catch (err) {
    console.error('login error:', err)
    return { success: false, code: 'LOGIN_ERROR', message: err.message }
  }
}
