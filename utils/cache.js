/**
 * 本地存储封装
 * 统一管理 wx.getStorage / wx.setStorage / wx.removeStorage
 */

const PREFIX = 'ts_' // TripSplit 前缀，避免与其他小程序冲突

function init() {
  // 检查存储空间（可选）
}

function get(key) {
  try {
    const value = wx.getStorageSync(PREFIX + key)
    if (value === undefined || value === '' || value === null) return null
    if (typeof value === 'string') {
      // 尝试 JSON 解析，失败则返回原始字符串
      try {
        return JSON.parse(value)
      } catch (e) {
        return value
      }
    }
    return value
  } catch (e) {
    console.error('Cache get error:', key, e)
    return null
  }
}

function set(key, value) {
  try {
    const data = typeof value === 'object' ? JSON.stringify(value) : value
    wx.setStorageSync(PREFIX + key, data)
    return true
  } catch (e) {
    console.error('Cache set error:', key, e)
    return false
  }
}

function remove(key) {
  try {
    wx.removeStorageSync(PREFIX + key)
    return true
  } catch (e) {
    console.error('Cache remove error:', key, e)
    return false
  }
}

/**
 * 清除所有 TripSplit 相关缓存
 */
function clearAll() {
  try {
    const res = wx.getStorageInfoSync()
    ;(res.keys || []).forEach(key => {
      if (key.startsWith(PREFIX)) {
        wx.removeStorageSync(key)
      }
    })
  } catch (e) {
    console.error('Cache clearAll error:', e)
  }
}

module.exports = {
  init,
  get,
  set,
  remove,
  clearAll
}
