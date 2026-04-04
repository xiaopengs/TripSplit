/**
 * 网络请求封装
 * - 统一错误处理
 * - 幂等支持（request_id）
 * - Token 注入
 * - 离线检测
 */

const app = getApp()

const BASE_URL = 'https://api.tripsplit.com/v1' // TODO: 替换为实际 API 地址

// 请求队列：离线时暂存
let pendingRequests = []

function request(options) {
  const { url, method = 'GET', data = {}, header = {}, showLoading: showLoad = false, skipOfflineCheck = false } = options

  if (showLoading) wx.showLoading({ title: '加载中...', mask: true })

  // 生成幂等 ID
  const requestId = generateRequestId()
  
  const reqHeader = Object.assign({
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
    'Authorization': getToken() || ''
  }, header)

  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`

  return new Promise((resolve, reject) => {
    // 离线检查
    if (!app.globalData.online && !skipOfflineCheck) {
      if (showLoad) wx.hideLoading()
      // 将请求加入离线队列
      pendingRequests.push({ url, method, data, header: reqHeader, requestId })
      reject({ code: -1, message: '网络不可用，已加入待发送队列' })
      return
    }

    wx.request({
      url: fullUrl,
      method,
      data,
      header: reqHeader,
      success(res) {
        if (showLoad) wx.hideLoading()
        const { statusCode, data: resData } = res
        
        if (statusCode >= 200 && statusCode < 300) {
          resolve(resData)
        } else if (statusCode === 401) {
          // Token 过期，重新登录
          handleAuthError()
          reject({ code: 401, message: '登录已过期' })
        } else {
          const errMsg = (resData && resData.message) || `请求失败(${statusCode})`
          wx.showToast({ title: errMsg, icon: 'none' })
          reject({ code: statusCode, message: errMsg })
        }
      },
      fail(err) {
        if (showLoad) wx.hideLoading()
        console.error('Request failed:', url, err)
        wx.showToast({ title: '网络异常', icon: 'none' })
        reject(err)
      }
    })
  })
}

// === Helper Functions ===

function generateRequestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function getToken() {
  try {
    return wx.getStorageSync('token') || ''
  } catch { return '' }
}

function handleAuthError() {
  wx.removeStorageSync('token')
  wx.removeStorageSync('userInfo')
  app.globalData.userInfo = null
  // 跳转到重新登录页
}

function getPendingCount() {
  return pendingRequests.length
}

function getPendingRequests() {
  return pendingRequests
}

function clearPending() {
  pendingRequests = []
}

module.exports = {
  request,
  getPendingCount,
  getPendingRequests,
  clearPending,
  BASE_URL
}
