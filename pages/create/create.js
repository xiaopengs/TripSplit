/**
 * 创建账本页面
 */
const bookService = require('../../services/book.service')
const cache = require('../../utils/cache')
const { SKIN_COLORS, CURRENCIES } = require('../../utils/constants')
const { formatDate } = require('../../utils/date')
const locationUtil = require('../../utils/location')

Page({
  data: {
    bookName: '',
    currencies: [],
    currencyIndex: 0,
    startDate: '',
    skinColors: SKIN_COLORS,
    selectedSkinIndex: Math.floor(Math.random() * SKIN_COLORS.length),
    selectedSkinColor: SKIN_COLORS[0].value,
    shadowMembers: [],
    newShadowName: '',
    canCreate: false,
    creatorNickname: '',
    logoIcons: ['🧩', '🏔️', '🏖️', '🎒', '✈️', '🚗', '🏨', '🍜'],
    logoIndex: 0
  },

  onLoad() {
    const displayCurrencies = CURRENCIES.map(c => ({
      ...c,
      display: `${c.flag} ${c.name} (${c.symbol})`
    }))

    // 预填已有昵称
    var nickname = ''
    try {
      var userInfo = getApp().globalData.userInfo
      if (userInfo && userInfo.nickname) nickname = userInfo.nickname
    } catch (e) {}

    this.setData({
      currencies: displayCurrencies,
      startDate: formatDate(new Date()),
      selectedSkinColor: SKIN_COLORS[this.data.selectedSkinIndex].value,
      creatorNickname: nickname
    })
  },

  onNameInput(e) {
    const name = e.detail.value
    this.setData({ bookName: name, canCreate: name.trim().length > 0 })
  },

  onNicknameInput(e) {
    this.setData({ creatorNickname: e.detail.value })
  },

  onCurrencyChange(e) {
    this.setData({ currencyIndex: parseInt(e.detail.value) })
  },

  onDateChange(e) {
    this.setData({ startDate: e.detail.value })
  },

  onSkinTap(e) {
    const index = e.currentTarget.dataset.index
    const color = e.currentTarget.dataset.color
    wx.vibrateShort({ type: 'light' })
    this.setData({ selectedSkinIndex: index, selectedSkinColor: color })
  },

  onShadowInput(e) {
    this.setData({ newShadowName: e.detail.value })
  },

  addShadowMember() {
    const name = this.data.newShadowName.trim()
    if (!name) {
      wx.showToast({ title: '请输入成员名称', icon: 'none' })
      return
    }

    if (this.data.shadowMembers.includes(name)) {
      wx.showToast({ title: '该成员已添加', icon: 'none' })
      return
    }

    if (this.data.shadowMembers.length >= 20) {
      wx.showToast({ title: '最多添加20个成员', icon: 'none' })
      return
    }

    this.setData({
      shadowMembers: [...this.data.shadowMembers, name],
      newShadowName: ''
    })
    wx.vibrateShort({ type: 'light' })
  },

  removeShadow(e) {
    const index = e.currentTarget.dataset.index
    const list = [...this.data.shadowMembers]
    list.splice(index, 1)
    this.setData({ shadowMembers: list })
  },

  onAutoDetect() {
    wx.showLoading({ title: '定位中...', mask: true })
    
    locationUtil.getLocation()
      .then(loc => {
        wx.hideLoading()
        const currency = locationUtil.detectCurrency(loc.city, '')
        
        const idx = this.data.currencies.findIndex(c => c.code === currency)
        if (idx > -1) {
          this.setData({ currencyIndex: idx })
          wx.showToast({ title: `检测到 ${this.data.currencies[idx].name}`, icon: 'success' })
        } else {
          wx.showToast({ title: '默认使用人民币', icon: 'none' })
        }
      })
      .catch(err => {
        wx.hideLoading()
        wx.showToast({ title: '定位失败，使用默认币种', icon: 'none' })
      })
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      // 没有上一页时跳转到首页
      wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  onLogoTap() {
    // 切换图标
    const nextIndex = (this.data.logoIndex + 1) % this.data.logoIcons.length
    this.setData({ logoIndex: nextIndex })
    wx.vibrateShort({ type: 'light' })
  },

  onCreate() {
    if (!this.data.canCreate) return

    wx.showLoading({ title: '创建中...', mask: true })

    try {
      const currency = this.data.currencies[this.data.currencyIndex]
      const app = getApp()
      const openid = app && app.globalData ? app.globalData.openid : ''

      // 保存用户昵称到全局 & 缓存
      var nickname = this.data.creatorNickname.trim()
      if (nickname) {
        var userInfo = app.globalData.userInfo || { openid: openid }
        userInfo.nickname = nickname
        app.globalData.userInfo = userInfo
        cache.set('userInfo', userInfo)
      }

      const book = bookService.createBook({
        name: this.data.bookName.trim(),
        currency: currency.code,
        currencySymbol: currency.symbol,
        coverColor: this.data.skinColors[this.data.selectedSkinIndex].value,
        startDate: this.data.startDate,
        creatorId: openid,
        creatorName: nickname || '',
        shadowMembers: this.data.shadowMembers
      })

      wx.hideLoading()
      wx.showToast({ title: '创建成功', icon: 'success' })

      setTimeout(() => {
        // 创建成功后返回首页
        wx.reLaunch({ url: '/pages/index/index' })
      }, 500)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '创建失败', icon: 'none' })
      console.error('Create book error:', err)
    }
  }
})
