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
    myOpenid: '',

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
    // 1) 立即从本地缓存渲染，用户看到的是上一次的数据，无闪屏
    this._loadBooksFromCache()

    // 2) 后台同步云端数据（仅首次进入触发一次，所有同步完成后统一刷新一次）
    if (!this._synced) {
      this._synced = true
      this._syncAllCloudMembers()
    }
  },

  onRefresh: function() {
    var self = this
    // 先刷本地
    this._loadBooksFromCache()
    // 再同步云端，完成后关闭刷新动画
    this._syncAllCloudMembers(function() {
      self.setData({ refreshing: false })
    })
  },

  // === 核心数据加载 ===

  /** 从本地缓存加载数据，立即渲染（无异步，无闪屏） */
  _loadBooksFromCache: function() {
    var allBooks = bookService.getBookList()
    var currentBook = bookService.getCurrentBook()
    var currentBookId = currentBook ? currentBook.id : ''
    var myOpenid = ''
    try { myOpenid = getApp().globalData.openid || '' } catch(e) {}

    var self = this
    var enriched = allBooks.map(function(book) {
      return self._enrichBook(book, currentBookId, myOpenid)
    })

    this.setData({ books: enriched, currentBookId: currentBookId, myOpenid: myOpenid })
    this._applyFilterAndSort()
  },

  /**
   * 同步所有云端账本的成员数据
   * 关键：所有 syncCloudMembers 全部完成后，只做一次 _loadBooksFromCache
   * 避免多个云账本各自触发独立刷新导致多次 setData
   */
  _syncAllCloudMembers: function(onComplete) {
    try {
      var app = getApp()
      if (!app || !app.globalData || !app.globalData.cloudReady) {
        onComplete && onComplete()
        return
      }
    } catch (e) {
      onComplete && onComplete()
      return
    }

    var allBooks = bookService.getBookList()
    var cloudBooks = allBooks.filter(function(b) { return b.cloud_id })

    if (cloudBooks.length === 0) {
      onComplete && onComplete()
      return
    }

    var self = this
    var promises = cloudBooks.map(function(book) {
      return bookService.syncCloudMembers(book.id)
        .then(function(changed) { return changed })
        .catch(function() { return false })
    })

    // 等全部同步完毕，只要有任何一本变了就统一刷新一次
    Promise.all(promises).then(function(results) {
      var anyChanged = results.some(function(c) { return c })
      if (anyChanged) {
        self._loadBooksFromCache()
      }
      onComplete && onComplete()
    })
  },

  _enrichBook: function(book, currentBookId, myOpenid) {
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

    var isCreator = !book.creator_id || book.creator_id === myOpenid
    var isDeleted = book.status === 'deleted'
    var isArchived = book.status === 'archived'

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
      isCurrentBook: book.id === currentBookId,
      isCreator: isCreator,
      isDeleted: isDeleted,
      isArchived: isArchived
    }
  },

  /**
   * 排序：当前账本始终置顶，其余按选定规则排序
   */
  _applyFilterAndSort: function() {
    var books = this.data.books
    var sortBy = this.data.sortBy
    var currentBookId = this.data.currentBookId

    // 分离当前账本
    var currentBook = null
    var others = []
    for (var i = 0; i < books.length; i++) {
      if (books[i].id === currentBookId) {
        currentBook = books[i]
      } else {
        others.push(books[i])
      }
    }

    // 对非当前账本排序
    if (sortBy === 'updated') {
      others.sort(function(a, b) {
        var diff = (b.updated_at || 0) - (a.updated_at || 0)
        if (diff !== 0) return diff
        return (b.created_at || 0) - (a.created_at || 0)
      })
    } else {
      others.sort(function(a, b) {
        var diff = (b.created_at || 0) - (a.created_at || 0)
        if (diff !== 0) return diff
        return (a.name || '').localeCompare(b.name || '')
      })
    }

    // 当前账本始终排第一
    var sorted = currentBook ? [currentBook].concat(others) : others
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
      content: '确定要删除「' + name + '」吗？所有成员将无法继续记账，此操作不可恢复。',
      confirmColor: '#FF3B30',
      success: function(res) {
        if (res.confirm) {
          var result = bookService.deleteBook(id)
          if (result) {
            wx.showToast({ title: '已删除', icon: 'success' })
            self._loadBooksFromCache()
          } else {
            wx.showToast({ title: '仅创建者可删除', icon: 'none' })
          }
        }
      }
    })
  },

  onDeleteBookLocal: function(e) {
    var id = e.currentTarget.dataset.id
    var self = this

    wx.showModal({
      title: '删除本地副本',
      content: '确定删除该账本的本地数据？删除后将无法恢复。',
      confirmColor: '#FF3B30',
      success: function(res) {
        if (res.confirm) {
          bookService.deleteBookLocal(id)
          wx.showToast({ title: '已删除', icon: 'success' })
          self._loadBooksFromCache()
        }
      }
    })
  },

  onArchiveBook: function(e) {
    var id = e.currentTarget.dataset.id
    var name = e.currentTarget.dataset.name
    var self = this

    wx.showModal({
      title: '归档账本',
      content: '归档后所有成员将无法继续记账，但可查看已有数据。确定归档「' + name + '」？',
      confirmColor: '#FF9500',
      success: function(res) {
        if (res.confirm) {
          bookService.archiveBook(id)
          wx.showToast({ title: '已归档', icon: 'success' })
          self._loadBooksFromCache()
        }
      }
    })
  },

  onUnarchiveBook: function(e) {
    var id = e.currentTarget.dataset.id
    var self = this

    bookService.unarchiveBook(id)
    wx.showToast({ title: '已恢复', icon: 'success' })
    this._loadBooksFromCache()
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
      this._loadBooksFromCache()
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
