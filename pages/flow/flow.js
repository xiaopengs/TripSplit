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

    const formatted = grouped.map(group => {
      total += group.total
      return {
        ...group,
        dateLabel: formatChineseDate(group.date),
        totalDisplay: formatAmount(group.total, this.data.currencySymbol),
        items: group.items.map(bill => ({
          ...bill,
          category_icon: getCategoryByKey(bill.category)?.icon || '📦',
          amountDisplay: formatAmount(bill.amount, this.data.currencySymbol),
          timeDisplay: formatDateTimeCN(bill.paid_at)
        }))
      }
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
