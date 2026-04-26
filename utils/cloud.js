/**
 * 云函数调用封装
 * 统一错误处理、重试、loading 状态
 */

const MAX_RETRIES = 2

/**
 * 调用云函数
 * @param {string} name 云函数名称
 * @param {object} data 参数
 * @param {object} options { showLoading, loadingText, retries }
 */
async function call(name, data = {}, options = {}) {
  const { showLoading = false, loadingText = '加载中...', retries = MAX_RETRIES } = options

  if (showLoading) {
    wx.showLoading({ title: loadingText, mask: true })
  }

  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await wx.cloud.callFunction({ name, data })
      const result = res.result || {}

      if (showLoading) wx.hideLoading()

      if (!result.success) {
        const err = new Error(result.message || '操作失败')
        err.code = result.code
        throw err
      }

      return result.data
    } catch (err) {
      lastError = err
      // Don't retry on permission or validation errors
      if (err.code === 'FORBIDDEN' || err.code === 'INVALID_PARAMS' ||
          err.code === 'TOKEN_INVALID' || err.code === 'TOKEN_EXPIRED' ||
          err.code === 'ALREADY_CLAIMED' || err.code === 'ALREADY_MEMBER') {
        if (showLoading) wx.hideLoading()
        throw err
      }
      // Don't retry on cloud platform errors (function not deployed, etc.)
      var errMsg = err.errMsg || err.message || ''
      if (errMsg.indexOf('-501000') !== -1 || errMsg.indexOf('-501001') !== -1) {
        if (showLoading) wx.hideLoading()
        throw err
      }
      // Retry on network errors
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }
  }

  if (showLoading) wx.hideLoading()
  throw lastError
}

module.exports = { call }
