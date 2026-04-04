/**
 * 账单详情弹窗组件
 */
const { formatAmount, fenToYuan } = require('../../utils/currency')
const { getCategoryByKey } = require('../../utils/constants')
const { formatDateTimeCN } = require('../../utils/date')

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    bill: {
      type: Object,
      value: null
    },
    currencySymbol: {
      type: String,
      value: '¥'
    }
  },

  observers: {
    'bill': function(bill) {
      if (!bill) return
      
      // 格式化账单数据
      const formatted = Object.assign({}, bill, {
        category_icon: getCategoryByKey(bill.category)?.icon || '📦',
        amountDisplay: formatAmount(bill.amount, this.data.currencySymbol),
        timeDisplay: formatDateTimeCN(bill.paid_at),
        splits: (bill.splits || []).map(s => ({
          ...s,
          shareDisplay: formatAmount(s.share, this.data.currencySymbol)
        }))
      })

      this.setData({ _formattedBill: formatted })
    }
  },

  data: {
    _formattedBill: null
  },

  methods: {
    onClose() {
      this.triggerEvent('onclose')
    },

    preventMove() {},

    previewImage(e) {
      const url = e.currentTarget.dataset.url
      const images = this.data._formattedBill?.images || []
      wx.previewImage({ current: url, urls: images })
    },

    onEdit() {
      wx.showToast({ title: '编辑功能开发中', icon: 'none' })
    },

    onDelete() {
      wx.showModal({
        title: '确认删除',
        content: '删除后不可恢复，确定删除这笔记录吗？',
        confirmColor: '#FF3B30',
        success: res => {
          if (res.confirm) {
            this.triggerEvent('ondelete', { id: this.data.bill?.id })
            this.triggerEvent('onclose')
          }
        }
      })
    }
  }
})
