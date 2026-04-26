const cloudApi = require('../../utils/cloud')
const cache = require('../../utils/cache')
const bookService = require('../../services/book.service')

Page({
  data: {
    loading: true,
    mode: '', // 'token' | 'share'
    token: '',
    bookId: '',
    cloudId: '',

    bookName: '',
    creatorName: '',
    memberCount: 0,
    unclaimedShadows: [],
    selectedShadowId: '',

    // 'shadow' = selected a shadow member, 'self' = join with own name
    joinMode: '',

    cloudBookData: null,
    cloudMembersData: null,
    myNickname: '',

    error: '',
    joined: false,
    joining: false
  },

  onLoad(options) {
    const { token, bookId, cloudId, from } = options

    if (token) {
      this.setData({ mode: 'token', token })
      this._loadByToken(token)
    } else if (bookId || cloudId) {
      this.setData({ mode: 'share', bookId: bookId || '', cloudId: cloudId || '' })
      this._loadByShare(bookId, cloudId)
    } else {
      this.setData({ loading: false, error: '无效的邀请链接' })
    }
  },

  async _loadByToken(token) {
    try {
      const result = await cloudApi.call('joinBook', { token })
      if (result.alreadyMember) {
        this.setData({ loading: false, joined: true, bookName: result.bookName })
        return
      }
      this.setData({
        loading: false,
        joined: true,
        bookName: result.bookName
      })
    } catch (err) {
      if (err.code === 'TOKEN_EXPIRED') {
        this.setData({ loading: false, error: '邀请已过期，请联系创建者重新分享' })
      } else if (err.code === 'TOKEN_INVALID') {
        this.setData({ loading: false, error: '邀请链接无效' })
      } else {
        this.setData({ loading: false, error: err.message || '加载失败' })
      }
    }
  },

  async _loadByShare(bookId, cloudId) {
    try {
      const result = await cloudApi.call('getBook', { bookId, cloudId })

      if (result.isMember) {
        // 已是成员 → 确保本地有这本书并设为当前
        var imported = bookService.importCloudBook(result.book, result.members)
        bookService.setCurrentBook(imported.id)
        this.setData({ loading: false, joined: true, bookName: result.book.name })
        return
      }

      // 预填已有昵称
      var nickname = ''
      try {
        var userInfo = getApp().globalData.userInfo
        if (userInfo && userInfo.nickname) nickname = userInfo.nickname
      } catch (e) {}

      const unclaimed = result.members.filter(m => m.type === 'shadow' && !m.is_claimed)
      this.setData({
        loading: false,
        bookId: result.book._id || bookId,
        bookName: result.book.name,
        memberCount: result.book.member_count,
        unclaimedShadows: unclaimed,
        // 如果没有影子成员，默认选择"以自己名称加入"
        joinMode: unclaimed.length === 0 ? 'self' : '',
        cloudBookData: result.book,
        cloudMembersData: result.members,
        myNickname: nickname
      })
    } catch (err) {
      this.setData({ loading: false, error: err.message || '加载失败' })
    }
  },

  onSelectShadow(e) {
    const id = e.currentTarget.dataset.id
    if (this.data.selectedShadowId === id) {
      // 取消选择
      this.setData({ selectedShadowId: '', joinMode: '' })
    } else {
      this.setData({ selectedShadowId: id, joinMode: 'shadow' })
    }
  },

  onSelectSelf() {
    if (this.data.joinMode === 'self') {
      this.setData({ joinMode: '' })
    } else {
      this.setData({ joinMode: 'self', selectedShadowId: '' })
    }
  },

  onNicknameInput(e) {
    this.setData({ myNickname: e.detail.value })
  },

  async onJoin() {
    const { joinMode, selectedShadowId, bookId, cloudBookData, cloudMembersData } = this.data

    if (!joinMode) {
      wx.showToast({ title: '请选择加入方式', icon: 'none' })
      return
    }

    if (joinMode === 'shadow' && !selectedShadowId) {
      wx.showToast({ title: '请选择你的身份', icon: 'none' })
      return
    }

    this.setData({ joining: true })
    try {
      // 保存用户昵称到全局 & 缓存
      var nickname = this.data.myNickname.trim()
      if (nickname) {
        var app = getApp()
        var userInfo = app.globalData.userInfo || {}
        userInfo.nickname = nickname
        app.globalData.userInfo = userInfo
        cache.set('userInfo', userInfo)
      }

      if (joinMode === 'shadow') {
        // 认领影子成员
        await cloudApi.call('claimShadow', {
          bookId: bookId,
          shadowMemberId: selectedShadowId,
          nickname: nickname || undefined
        })
      } else {
        // 以自己名称直接加入
        await cloudApi.call('directJoin', {
          bookId: bookId,
          nickname: nickname || undefined
        })
      }

      // 加入成功 → 将云端账本数据写入本地缓存
      if (cloudBookData && cloudMembersData) {
        // 需要重新获取最新的成员列表（包含新加入的成员）
        try {
          const latestResult = await cloudApi.call('getBook', { bookId })
          if (latestResult.members) {
            const book = bookService.importCloudBook(latestResult.book, latestResult.members)
            bookService.setCurrentBook(book.id)
          }
        } catch (syncErr) {
          // 如果获取最新数据失败，用之前的数据
          const book = bookService.importCloudBook(cloudBookData, cloudMembersData)
          bookService.setCurrentBook(book.id)
        }

        // 后台同步账单
        bookService.syncCloudMembers(bookService.getCurrentBook().id).catch(() => {})
      }

      this.setData({ joined: true, joining: false })
      wx.showToast({ title: '加入成功', icon: 'success' })
    } catch (err) {
      this.setData({ joining: false })
      // 云函数未部署或平台级错误给出友好提示
      var msg = err.message || ''
      if (msg.indexOf('-501000') !== -1 || msg.indexOf('callFunction:fail') !== -1) {
        msg = '服务暂时不可用，请稍后再试'
      }
      wx.showToast({ title: msg || '加入失败', icon: 'none' })
    }
  },

  onGoHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
