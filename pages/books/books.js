/**
 * 账本管理页 - 多账本列表、切换、删除
 */
const bookService = require('../../services/book.service')
const billService = require('../../services/bill.service')
const memberService = require('../../services/member.service')
const { formatAmount } = require('../../utils/currency')
const { formatDate } = require('../../utils/date')
const { SKIN_COLORS } = require('../../utils/constants')

Page({
  data: {
    // 导航栏
    navPaddingTop: 0,
    navPaddingBottom: 0,

    // 账本列表
    books: [],
    filteredBooks: [],
    sortBy: 'updated',

    // 状态
    refreshing: false,
    currentBookId: '',

    // 成员弹窗
    memberPopupVisible: false,
    memberPopupBookId: '',
    memberPopupBookName: '',
    memberPopupMembers: []
  },

  onLoad: function() {
    this._calcNavHeight()
  },

  onShow: function() {
    this.loadBooks()
  },

  onRefresh: function() {
    this.setData({ refreshing: true })
    this.loadBooks()
    this.setData({ refreshing: false })
  },

  // === 核心数据加载 ===

  loadBooks: function() {
    var allBooks = bookService.getBookList()
    var currentBook = bookService.getCurrentBook()
    var currentBookId = currentBook ? currentBook.id : ''
    var self = this

    var enriched = allBooks.map(function(book) {
      return self._enrichBook(book, currentBookId)
    })

    this.setData({ books: enriched, currentBookId: currentBookId })
    this._applyFilterAndSort()

    // 后台同步云端成员数据
    this._syncCloudMembers()
  },

  _syncCloudMembers: function() {
    try {
      var app = getApp()
      if (!app || !app.globalData || !app.globalData.cloudReady) return
    } catch (e) { return }

    var allBooks = bookService.getBookList()
    var hasSync = false
    var self = this

    allBooks.forEach(function(book) {
      if (book.cloud_id) {
        hasSync = true
        bookService.syncCloudMembers(book.id).catch(function() {})
      }
    })

    // 如果有同步任务，延迟刷新列表
    if (hasSync) {
      setTimeout(function() { self.loadBooks() }, 2000)
    }
  },

  _enrichBook: function(book, currentBookId) {
    var skin = SKIN_COLORS.find(function(s) { return s.value === book.cover_color })
    if (!skin) skin = SKIN_COLORS[0]

    var totalExpense = billService.getTotalExpense(book.id)
    var billCount = billService.getBills(book.id).length

    var memberAvatars = (book.members || []).slice(0, 5).map(function(m) {
      var name = m.nickname || m.shadow_name || '?'
      return {
        id: m.id,
        char: name.charAt(0),
        color: skin.value
      }
    })

    var createdDate = ''
    if (book.created_at) {
      createdDate = formatDate(new Date(book.created_at).toISOString(), 'YYYY-MM-DD')
    }

    // 只传递卡片显示需要的字段，避免 setData 过大
    return {
      id: book.id,
      name: book.name,
      cover_color: book.cover_color,
      currency_symbol: book.currency_symbol,
      status: book.status,
      member_count: book.member_count,
      created_at: book.created_at,
      updated_at: book.updated_at,
      members: book.members || [],
      skinColor: skin.value,
      skinColorLight: skin.light,
      totalExpenseDisplay: formatAmount(totalExpense, book.currency_symbol || '¥'),
      billCount: billCount,
      memberAvatars: memberAvatars,
      createdDateDisplay: createdDate,
      isCurrentBook: book.id === currentBookId
    }
  },

  _applyFilterAndSort: function() {
    var books = this.data.books
    var sortBy = this.data.sortBy

    var sorted = books.slice()
    if (sortBy === 'updated') {
      sorted.sort(function(a, b) { return (b.updated_at || 0) - (a.updated_at || 0) })
    } else {
      sorted.sort(function(a, b) { return (b.created_at || 0) - (a.created_at || 0) })
    }

    this.setData({ filteredBooks: sorted })
  },

  // === 导航 ===

  goBack: function() {
    var pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  // === 排序 ===

  onSortTap: function() {
    var self = this
    wx.showActionSheet({
      itemList: ['最近活跃', '创建时间'],
      success: function(res) {
        var sortBy = res.tapIndex === 0 ? 'updated' : 'created'
        self.setData({ sortBy: sortBy })
        self._applyFilterAndSort()
      }
    })
  },

  // === 账本操作 ===

  onBookTap: function(e) {
    var id = e.currentTarget.dataset.id
    if (!id) return

    bookService.setCurrentBook(id)
    wx.reLaunch({ url: '/pages/index/index' })
  },

  onCreateBook: function() {
    wx.navigateTo({ url: '/pages/create/create' })
  },

  onDeleteBook: function(e) {
    var id = e.currentTarget.dataset.id
    var name = e.currentTarget.dataset.name
    var self = this

    wx.showModal({
      title: '删除账本',
      content: '确定要删除「' + name + '」吗？此操作不可恢复，所有账单数据将丢失。',
      confirmColor: '#FF3B30',
      success: function(res) {
        if (res.confirm) {
          bookService.deleteBook(id)
          wx.showToast({ title: '已删除', icon: 'success' })
          self.loadBooks()
        }
      }
    })
  },

  // === 成员管理 ===

  onMemberManage: function(e) {
    var id = e.currentTarget.dataset.id
    var book = this.data.books.find(function(b) { return b.id === id })
    if (!book) return

    this.setData({
      memberPopupVisible: true,
      memberPopupBookId: id,
      memberPopupBookName: book.name,
      memberPopupMembers: book.members || []
    })
  },

  closeMemberPopup: function() {
    this.setData({ memberPopupVisible: false })
  },

  onAddShadowMember: function(e) {
    var name = e.detail.name
    if (!name || !name.trim()) return

    var member = memberService.addShadowMember(this.data.memberPopupBookId, name.trim())
    if (member) {
      this.loadBooks()
      wx.showToast({ title: '已添加 ' + name, icon: 'success' })
    }
  },

  preventBubble: function() {
    // 阻止事件冒泡
  },

  // === 私有方法 ===

  _calcNavHeight: function() {
    try {
      var menuBtn = wx.getMenuButtonBoundingClientRect()
      this.setData({
        navPaddingTop: menuBtn.top,
        navPaddingBottom: menuBtn.height
      })
    } catch (e) {
      this.setData({
        navPaddingTop: 20,
        navPaddingBottom: 24
      })
    }
  }
})
