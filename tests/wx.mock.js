/**
 * 微信小程序 API 模拟层
 * 在 Node.js 环境中模拟 wx 全局对象，使业务代码可脱离小程序运行测试
 */

// 模拟同步存储
const _storage = {}

const wx = {
  // === 存储相关 ===
  getStorageSync(key) {
    const val = _storage[key]
    if (val === undefined) return ''
    return val
  },
  setStorageSync(key, data) {
    _storage[key] = data
  },
  removeStorageSync(key) {
    delete _storage[key]
  },
  getStorageInfoSync() {
    return {
      keys: Object.keys(_storage),
      limitSize: 10240,
      currentSize: Object.keys(_storage).length
    }
  },

  // === 网络 ===
  request(opts) {
    // 默认空操作，测试时可覆盖
    if (opts.success) setTimeout(() => opts.success({ statusCode: 200, data: {} }), 0)
  },

  // === 媒体 ===
  chooseMedia() {},
  chooseImage() {},
  previewImage() {},

  // === 导航 ===
  navigateTo() {},
  redirectTo() {},
  switchTab() {},
  navigateBack() {},

  // === 界面 ===
  showToast() {},
  showLoading() {},
  hideLoading() {},
  showModal() {},

  // === 震动 ===
  vibrateShort() {},

  // === 定位 ===
  getLocation() {},

  // === 系统 ===
  getSystemInfoSync() {
    return {
      platform: 'devtools',
      system: 'test',
      windowHeight: 700,
      windowWidth: 375,
      pixelRatio: 2
    }
  },

  // === 云开发（占位） ===
  cloud: {
    init() {},
    callFunction() {},
    uploadFile() {},
    getTempFileURL() {}
  }
}

// 注入全局
global.wx = wx

// 测试工具：清空模拟存储
function clearMockStorage() {
  Object.keys(_storage).forEach(k => delete _storage[k])
}

// 测试工具：预置模拟存储
function setMockStorage(data) {
  clearMockStorage()
  Object.entries(data).forEach(([k, v]) => { _storage[k] = v })
}

module.exports = { wx, clearMockStorage, setMockStorage }
