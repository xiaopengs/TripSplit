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

    cloudBookData: null,
    cloudMembersData: null,

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
      // Call joinBook to validate token and get book info
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
        this.setData({ loading: false, joined: true, bookName: result.book.name })
        return
      }

      const unclaimed = result.members.filter(m => m.type === 'shadow' && !m.is_claimed)
      this.setData({
        loading: false,
        bookId: result.book._id || bookId,
        bookName: result.book.name,
        memberCount: result.book.member_count,
        unclaimedShadows: unclaimed,
        cloudBookData: result.book,
        cloudMembersData: result.members
      })
    } catch (err) {
      this.setData({ loading: false, error: err.message || '加载失败' })
    }
  },

  onSelectShadow(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ selectedShadowId: this.data.selectedShadowId === id ? '' : id })
  },

  async onClaimAndJoin() {
    const { selectedShadowId, bookId, cloudBookData, cloudMembersData } = this.data
    if (!selectedShadowId) {
      wx.showToast({ title: '请选择你的身份', icon: 'none' })
      return
    }

    this.setData({ joining: true })
    try {
      await cloudApi.call('claimShadow', {
        bookId: bookId,
        shadowMemberId: selectedShadowId
      })

      // 认领成功 → 将云端账本数据写入本地缓存
      if (cloudBookData && cloudMembersData) {
        const book = bookService.importCloudBook(cloudBookData, cloudMembersData)
        bookService.setCurrentBook(book.id)

        // 后台同步账单（让 B 能看到 A 的流水）
        bookService.syncCloudMembers(book.id).catch(() => {})
      }

      this.setData({ joined: true, joining: false })
      wx.showToast({ title: '加入成功', icon: 'success' })
    } catch (err) {
      this.setData({ joining: false })
      wx.showToast({ title: err.message || '认领失败', icon: 'none' })
    }
  },

  async onDirectJoin() {
    const { bookId } = this.data
    this.setData({ joining: true })
    try {
      const result = await cloudApi.call('generateInvite', { bookId, type: 'generic' })
      // Actually, we should use joinBook with a token. But in share mode,
      // we just claim the shadow. If no shadow selected, generate a generic invite.
      // For direct join without shadow, use claimShadow is not right.
      // Instead, create a real member directly via a simplified path.
      // Actually we should just call joinBook with a fresh token.
      const joinResult = await cloudApi.call('joinBook', { token: result.token })
      this.setData({ joined: true, joining: false })
      wx.showToast({ title: '加入成功', icon: 'success' })
    } catch (err) {
      this.setData({ joining: false })
      wx.showToast({ title: err.message || '加入失败', icon: 'none' })
    }
  },

  onGoHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
