/**
 * 手动记账面板组件
 */
const { fenToYuan, parseInputToFen, splitEqual } = require('../../utils/currency')
const { CATEGORIES, SPLIT_TYPE, getSkinColor } = require('../../utils/constants')
const { formatAmount } = require('../../utils/currency')

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    members: {
      type: Array,
      value: []
    },
    currencySymbol: {
      type: String,
      value: '¥'
    }
  },

  data: {
    categories: CATEGORIES,
    
    // 金额
    rawValue: '',
    displayValue: '0.00',
    amount: 0, // 分

    // 类目
    selectedCategory: '',

    // 分摊
    splitMode: SPLIT_TYPE.EQUAL, // equal / custom
    selectedMembers: [],
    customSplitValues: {},
    perPersonAmount: '¥0.00',

    // 备注
    note: '',
    images: []
  },

  observers: {
    'visible': function(val) {
      if (val) {
        this._resetForm()
        this._selectAllMembers()
      }
    },
    'members': function(members) {
      // 预处理头像首字（WXML 不支持 expr[0]）
      const enriched = (members || []).map(m => ({
        ...m,
        avatar_char: (m.nickname || m.shadow_name || '?')[0] || '?'
      }))
      this.setData({ _enrichedMembers: enriched })
      this._selectAllMembers()
    },
    'amount, selectedMembers.length': function(amount, count) {
      if (amount > 0 && count > 0) {
        const perPerson = Math.floor(amount / count)
        this.setData({
          perPersonAmount: formatAmount(perPerson, this.data.currencySymbol)
        })
      } else {
        this.setData({ perPersonAmount: `¥${this.data.currencySymbol === '$' ? '0' : '0.00'}` })
      }
    }
  },

  methods: {
    // === 关闭 ===
    onClose() {
      this.triggerEvent('onclose')
    },

    preventMove() {},

    // === 类目选择 ===
    onCategoryTap(e) {
      const key = e.currentTarget.dataset.key
      wx.vibrateShort({ type: 'light' })
      this.setData({ selectedCategory: key })
    },

    // === 键盘输入 ===
    onKeyboardInput(e) {
      const val = e.detail
      let raw = this.data.rawValue

      // 输入限制：最多2位小数
      if (val === '.') {
        if (raw.includes('.')) return
      }

      raw += val

      // 最大长度保护
      if (raw.replace('.', '').length > 9) return

      this._updateAmount(raw)
    },

    onKeyboardBackspace() {
      let raw = this.data.rawValue.slice(0, -1)
      this._updateAmount(raw)
    },

    _updateAmount(raw) {
      const amount = parseInputToFen(raw || '0')
      this.setData({
        rawValue: raw,
        displayValue: fenToYuan(amount),
        amount: amount
      })
    },

    // === 分摊操作 ===
    toggleSplitMode() {
      const newMode = this.data.splitMode === SPLIT_TYPE.EQUAL ? SPLIT_TYPE.CUSTOM : SPLIT_TYPE.EQUAL
      this.setData({ splitMode: newMode })
      wx.vibrateShort({ type: 'light' })
    },

    _selectAllMembers() {
      const list = this.data._enrichedMembers || this.data.members || []
      const ids = list.map(m => m.id)
      this.setData({ selectedMembers: ids })
    },

    toggleMember(e) {
      const id = e.currentTarget.dataset.id
      wx.vibrateShort({ type: 'light' })

      let selected = [...this.data.selectedMembers]
      const index = selected.indexOf(id)

      if (index > -1) {
        // 至少保留一个人
        if (selected.length <= 1) {
          wx.showToast({ title: '至少保留一个分摊人', icon: 'none' })
          return
        }
        selected.splice(index, 1)
      } else {
        selected.push(id)
      }

      this.setData({ selectedMembers: selected })
    },

    // 自定义分摊输入
    onCustomInput(e) {
      const id = e.currentTarget.dataset.id
      const value = e.detail.value
      this.setData({
        [`customSplitValues.${id}`]: value
      })
    },

    // === 备注 ===
    onNoteInput(e) {
      this.setData({ note: e.detail.value })
    },

    // === 图片 ===
    chooseImage() {
      wx.chooseMedia({
        count: 3 - this.data.images.length,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: res => {
          const newImages = res.tempFiles.map(f => f.tempFilePath)
          this.setData({
            images: [...this.data.images, ...newImages]
          })
        }
      })
    },

    previewImage(e) {
      const url = e.currentTarget.dataset.url
      wx.previewImage({
        current: url,
        urls: this.data.images
      })
    },

    // === 提交 ===
    onSubmit() {
      if (!this.data.amount || this.data.amount <= 0) {
        wx.showToast({ title: '请输入金额', icon: 'none' })
        return
      }

      if (!this.data.selectedCategory) {
        wx.showToast({ title: '请选择类目', icon: 'none' })
        return
      }

      if (this.data.selectedMembers.length === 0) {
        wx.showToast({ title: '请选择分摊人', icon: 'none' })
        return
      }

      // 构建提交数据
      let splits = []

      const memberList = this.data._enrichedMembers || this.data.members || []

      if (this.data.splitMode === SPLIT_TYPE.CUSTOM) {
        // 自定义模式：验证总额
        let customTotal = 0
        memberList.forEach(m => {
          const val = this.data.customSplitValues[m.id]
          if (val) {
            customTotal += parseFloat(val) * 100
            splits.push({
              member_id: m.id,
              name: m.nickname || m.shadow_name || '?',
              share: Math.round(parseFloat(val) * 100),
              is_shadow: m.type === 'shadow'
            })
          }
        })

        // 验证自定义总额是否匹配
        if (Math.abs(customTotal - this.data.amount) > 1) {
          wx.showToast({ title: `分摊总额不匹配（差${Math.abs(customTotal - this.data.amount)/100}元）`, icon: 'none' })
          return
        }
      } else {
        const shares = splitEqual(this.data.amount, this.data.selectedMembers.length)
        splits = this.data.selectedMembers.map((mid, idx) => {
          const member = memberList.find(m => m.id === mid)
          return {
            member_id: mid,
            name: member ? (member.nickname || member.shadow_name || '?') : '?',
            share: shares[idx],
            is_shadow: member && member.type === 'shadow'
          }
        })
      }

      const submitData = {
        amount: this.data.amount,
        category: { key: this.data.selectedCategory, name: '' },
        note: this.data.note,
        images: this.data.images,
        payerId: null,
        payerName: '',
        memberIds: this.data.selectedMembers,
        members: memberList,
        splitType: this.data.splitMode,
        customSplits: splits.length > 0 ? splits : undefined
      }

      // 填充类目名称
      const catInfo = CATEGORIES.find(c => c.key === this.data.selectedCategory)
      if (catInfo) submitData.category.name = catInfo.name

      // 默认支付人为第一个真实成员
      const realMember = memberList.find(m => m.type === 'real') || memberList[0]
      if (realMember) {
        submitData.payerId = realMember.id
        submitData.payerName = realMember.nickname || '我'
      }

      this.triggerEvent('onsubmit', { detail: submitData })
      
      // 提交后重置
      setTimeout(() => this._resetForm(), 300)
    },

    _resetForm() {
      this.setData({
        rawValue: '',
        displayValue: '0.00',
        amount: 0,
        selectedCategory: '',
        splitMode: SPLIT_TYPE.EQUAL,
        selectedMembers: [],
        customSplitValues: {},
        note: '',
        images: []
      })
      this._selectAllMembers()
    }
  }
})
