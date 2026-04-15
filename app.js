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
    openid: null,
    systemInfo: null,
    online: true,
    cloudReady: false
  },

  onLaunch() {
    console.log('🧩 拼途记账 TripSplit launched')

    // 获取系统信息（兼容新旧 API）
    this.globalData.systemInfo = this._getSystemInfo()

    // 初始化本地缓存
    cache.init()

    // 初始化云开发
    this._initCloud()
  },

  /**
   * 初始化云开发环境
   */
  _initCloud() {
    if (!wx.cloud) {
      console.warn('请使用 2.2.3 或以上的基础库以使用云能力')
      this.checkLogin()
      this.watchNetwork()
      return
    }

    wx.cloud.init({
      traceUser: true
    })

    this.globalData.cloudReady = true

    // 云登录
    this._cloudLogin().then(() => {
      // 登录完成后检查是否需要迁移
      this._checkMigration()
    }).catch(err => {
      console.error('Cloud login failed:', err)
      // 降级到本地模式
      this.checkLogin()
    })

    // 监听网络状态
    this.watchNetwork()
  },

  /**
   * 云登录 — 获取 openid
   */
  async _cloudLogin() {
    try {
      const res = await wx.cloud.callFunction({ name: 'login' })
      const result = res.result || {}

      if (!result.success) {
        throw new Error(result.message || 'Login failed')
      }

      const { openid, nickname, avatar_url } = result.data

      this.globalData.openid = openid
      cache.set('openid', openid)

      // 更新 userInfo
      if (nickname || avatar_url) {
        const userInfo = { nickname, avatar_url, openid }
        this.globalData.userInfo = userInfo
        cache.set('userInfo', userInfo)
        store.setState('userInfo', userInfo)
      } else {
        this.checkLogin()
      }

      console.log('Cloud login success, openid:', openid)
    } catch (err) {
      console.error('Cloud login error:', err)
      // 降级：尝试从缓存获取 openid
      const cachedOpenid = cache.get('openid')
      if (cachedOpenid) {
        this.globalData.openid = cachedOpenid
      }
      this.checkLogin()
    }
  },

  /**
   * 检查是否需要迁移本地数据到云端
   */
  async _checkMigration() {
    const migrated = cache.get('migrated_to_cloud')
    if (migrated) return

    const bookService = require('./services/book.service')
    const books = bookService.getBookList()

    if (!books || books.length === 0) {
      // 没有本地数据，标记为已迁移
      cache.set('migrated_to_cloud', true)
      return
    }

    // 获取所有账单
    const billService = require('./services/bill.service')
    const allBills = cache.get('bills') || []

    // 构建迁移数据
    const booksWithBills = books.map(book => ({
      ...book,
      _bills: allBills.filter(b => b.book_id === book.id)
    }))

    try {
      console.log('Starting local data migration...')
      const res = await wx.cloud.callFunction({
        name: 'migrateLocal',
        data: { books: booksWithBills }
      })

      const result = res.result || {}
      if (result.success) {
        cache.set('migrated_to_cloud', true)
        cache.set('migration_timestamp', Date.now())
        if (result.data && result.data.idMapping) {
          cache.set('id_mapping', result.data.idMapping)
        }
        console.log('Migration complete:', result.data)
      } else {
        console.error('Migration failed:', result.message)
      }
    } catch (err) {
      console.error('Migration error:', err)
    }
  },

  /**
   * 获取系统信息（兼容新旧基础库）
   */
  _getSystemInfo() {
    try {
      const info = {}
      if (wx.getWindowInfo) Object.assign(info, wx.getWindowInfo())
      if (wx.getDeviceInfo) Object.assign(info, wx.getDeviceInfo())
      if (wx.getAppBaseInfo) Object.assign(info, wx.getAppBaseInfo())
      if (info.pixelRatio) return info
    } catch (e) {}
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

      if (res.isConnected) {
        syncService.syncOfflineQueue()
      }
    })
  },

  showToast(title, icon = 'none', duration = 2000) {
    wx.showToast({ title, icon, duration })
  },

  showLoading(title = '加载中...') {
    wx.showLoading({ title, mask: true })
  },

  hideLoading() {
    wx.hideLoading()
  }
})
