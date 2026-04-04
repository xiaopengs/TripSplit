/**
 * 账单详情页
 */
const billService = require('../../services/bill.service')
const { formatAmount } = require('../../utils/currency')
const { getCategoryByKey } = require('../../utils/constants')
const { formatDateTimeCN } = require('../../utils/date')

Page({
  data: {
    bill: null,
    currencySymbol: '¥'
  },

  onLoad(options) {
    const id = options.id
    if (!id) { wx.navigateBack(); return }

    const bill = billService.getBillById(id)
    if (!bill) { wx.showToast({ title: '记录不存在', icon: 'none' }); return }

    this.setData({
      bill: {
        ...bill,
        category_icon: getCategoryByKey(bill.category)?.icon || '📦',
        amountDisplay: formatAmount(bill.amount, this.data.currencySymbol),
        timeDisplay: formatDateTimeCN(bill.paid_at),
        splits: (bill.splits || []).map(s => ({
          ...s,
          shareDisplay: formatAmount(s.share, this.data.currencySymbol)
        }))
      }
    })
  },

  previewImage(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({ current: url, urls: this.data.bill.images || [url] })
  },

  onEdit() {
    wx.showToast({ title: '编辑功能开发中', icon: 'none' })
  },

  onDelete() {
    wx.showModal({
      title: '确认删除', content: '删除后不可恢复',
      confirmColor: '#FF3B30',
      success: res => {
        if (res.confirm) {
          billService.deleteBill(this.data.bill.id)
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 500)
        }
      }
    })
  },

  goBack() { wx.navigateBack() }
})
