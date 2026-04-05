/**
 * 拼途记账 - 小程序入口
 * 初始化全局数据、Store、云环境、网络监听
 */

const store = require('./utils/store')
const cache = require('./utils/cache')
const syncService = require('./services/sync.service')

App({
  globalData: {
    userInfo: null,
    systemInfo: null,
    online: true
  },

  onLaunch() {
    console.log('🧩 拼途记账 TripSplit launched')

    // 获取系统信息（兼容新旧 API）
    this.globalData.systemInfo = this._getSystemInfo()

    // 初始化本地缓存
    cache.init()

    // Store 仅在内存中管理运行时状态，持久化由 cache.js 统一负责

    // 检查登录状态
    this.checkLogin()

    // 监听网络状态
    this.watchNetwork()
  },

  /**
   * 获取系统信息（兼容新旧基础库）
   * 新版 API: getWindowInfo + getDeviceInfo
   * 旧版回退: getSystemInfoSync
   */
  _getSystemInfo() {
    try {
      const info = {}
      // 新版分拆 API（基础库 2.20.1+）
      if (wx.getWindowInfo) {
        Object.assign(info, wx.getWindowInfo())
      }
      if (wx.getDeviceInfo) {
        Object.assign(info, wx.getDeviceInfo())
      }
      if (wx.getAppBaseInfo) {
        Object.assign(info, wx.getAppBaseInfo())
      }
      // 如果新 API 都拿到了数据就直接返回
      if (info.pixelRatio) return info
    } catch (e) {
      // 新 API 不可用时静默降级
    }
    // 回退到旧版 API
    try {
      return wx.getSystemInfoSync()
    } catch (e) {
      return {}
    }
  },

  /**
   * 检查登录状态，获取用户信息
   */
  checkLogin() {
    const userInfo = cache.get('userInfo')
    if (userInfo) {
      this.globalData.userInfo = userInfo
      store.setState('userInfo', userInfo)
    } else {
      // 后续在需要时调用 wx.getUserProfile 获取
    }
  },

  /**
   * 监听在线/离线状态
   */
  watchNetwork() {
    wx.onNetworkStatusChange(res => {
      console.log('Network:', res.isConnected ? 'online' : 'offline')
      this.globalData.online = res.isConnected
      store.setState('online', res.isConnected)

      // 网络恢复时触发离线队列同步
      if (res.isConnected) {
        syncService.syncOfflineQueue()
      }
    })
  },

  /**
   * 显示全局提示
   */
  showToast(title, icon = 'none', duration = 2000) {
    wx.showToast({ title, icon, duration })
  },

  /**
   * 显示加载中
   */
  showLoading(title = '加载中...') {
    wx.showLoading({ title, mask: true })
  },

  /**
   * 隐藏加载中
   */
  hideLoading() {
    wx.hideLoading()
  }
})
