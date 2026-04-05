/**
 * 流水详情页
 */
const billService = require('../../services/bill.service')
const bookService = require('../../services/book.service')
const { formatAmount } = require('../../utils/currency')
const { getCategoryByKey } = require('../../utils/constants')
const { formatChineseDate, formatDateTimeCN } = require('../../utils/date')

Page({
  data: {
    bookId: '',
    groupedBills: [],
    totalDisplay: '¥0.00',
    billCount: 0,
    currencySymbol: '¥'
  },

  onLoad() {
    const book = bookService.getCurrentBook()
    if (!book) return

    this.setData({
      bookId: book.id,
      currencySymbol: book.currency_symbol || '¥'
    })

    this._loadData()
  },

  _loadData() {
    const grouped = billService.getBillsGroupedByDate(this.data.bookId)
    let total = 0
    const self = this

    const formatted = grouped.map(function(group) {
      total += group.total
      
      var items = group.items.map(function(bill) {
        var catInfo = getCategoryByKey(bill.category)
        return Object.assign({}, bill, {
          category_icon: (catInfo && catInfo.icon) || '📦',
          amountDisplay: formatAmount(bill.amount, self.data.currencySymbol),
          timeDisplay: formatDateTimeCN(bill.paid_at)
        })
      })
      
      return Object.assign({}, group, {
        dateLabel: formatChineseDate(group.date),
        totalDisplay: formatAmount(group.total, self.data.currencySymbol),
        items: items
      })
    })

    this.setData({
      groupedBills: formatted,
      totalDisplay: formatAmount(total, this.data.currencySymbol),
      billCount: formatted.reduce((sum, g) => sum + g.items.length, 0)
    })
  },

  onBillTap(e) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${e.currentTarget.dataset.id}` })
  },

  goBack() {
    wx.navigateBack()
  }
})
