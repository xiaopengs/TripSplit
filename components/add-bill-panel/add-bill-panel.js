/**
 * 手动记账面板组件
 */
const { fenToYuan, parseInputToFen, splitEqual, yuanToFen } = require('../../utils/currency')
const { CATEGORIES, CATEGORY_TAGS, SPLIT_TYPE, getSkinColor } = require('../../utils/constants')
const { formatAmount } = require('../../utils/currency')
const { formatDate } = require('../../utils/date')

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
    quickTags: [],

    // 金额
    rawValue: '',
    displayValue: '0.00',
    amount: 0, // 分

    // 类目
    selectedCategory: '',

    // 时间
    billDate: '',
    billTime: '',

    // 位置
    location: '',
    locationLoading: false,
    nearbyLocations: [],

    // 分摊
    splitMode: SPLIT_TYPE.EQUAL,
    selectedMembers: [],
    customSplitValues: {},
    perPersonAmount: '¥0.00',
    lastMemberAutoAmount: '',

    // 付款人
    selectedPayerId: '',

    // 备注
    note: '',
    selectedQuickTag: '',
    images: []
  },

  observers: {
    'visible': function(val) {
      if (val) {
        this._resetForm()
      }
    },
    'members': function(members) {
      // 默认付款人：第一个真实成员
      if (!this.data.selectedPayerId || !(members || []).find(m => m.id === this.data.selectedPayerId)) {
        const realMember = (members || []).find(m => m.type === 'real') || (members || [])[0]
        this.setData({ selectedPayerId: realMember ? realMember.id : '' })
      }
      this._selectAllMembers()
    },
    'amount, selectedMembers.length': function(amount, count) {
      if (amount > 0 && count > 0) {
        const perPerson = Math.floor(amount / count)
        this.setData({
          perPersonAmount: formatAmount(perPerson, this.data.currencySymbol)
        })
      } else {
        this.setData({ perPersonAmount: `${this.data.currencySymbol}0.00` })
      }
    },
    'selectedCategory': function(cat) {
      const tags = CATEGORY_TAGS[cat] || []
      this.setData({ quickTags: tags, selectedQuickTag: '' })
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

    // === 快捷标签 ===
    onQuickTag(e) {
      const tag = e.currentTarget.dataset.tag
      this.setData({ selectedQuickTag: tag, note: tag })
    },

    // === 时间选择 ===
    _initDateTime() {
      const now = new Date()
      this.setData({
        billDate: formatDate(now, 'YYYY-MM-DD'),
        billTime: formatDate(now, 'HH:mm')
      })
    },

    onDateChange(e) {
      this.setData({ billDate: e.detail.value })
    },

    onTimeChange(e) {
      this.setData({ billTime: e.detail.value })
    },

    // === 位置 ===
    onLocationTap() {
      if (this.data.location) return
      this.setData({ locationLoading: true })
      const location = require('../../utils/location')
      location.getLocation().then(loc => {
        const text = loc.city || loc.district || ''
        // 构建附近位置列表
        const nearby = []
        if (loc.street) nearby.push(loc.street)
        if (loc.district && loc.district !== text) nearby.push(loc.district)
        if (loc.city && loc.city !== text) nearby.push(loc.city)
        this.setData({
          location: text,
          locationLoading: false,
          nearbyLocations: nearby.slice(0, 5)
        })
      }).catch(() => {
        this.setData({ locationLoading: false })
      })
    },

    onSelectNearby(e) {
      const name = e.currentTarget.dataset.name
      this.setData({ location: name })
    },

    onClearLocation() {
      this.setData({ location: '', nearbyLocations: [] })
    },

    // === 键盘输入 ===
    onKeyboardInput(e) {
      const val = e.detail.key
      let raw = this.data.rawValue

      if (val === '.') {
        if (raw.includes('.')) return
      }

      raw += val
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
      this._updateLastMemberAutoAmount()
    },

    // === 分摊操作 ===
    onSplitModeTap(e) {
      const mode = e.currentTarget.dataset.mode
      if (this.data.splitMode === mode) return
      this.setData({ splitMode: mode })
      wx.vibrateShort({ type: 'light' })
    },

    // === 付款人选择 ===
    onPayerTap(e) {
      const id = e.currentTarget.dataset.id
      wx.vibrateShort({ type: 'light' })
      this.setData({ selectedPayerId: id })
      this._rebuildEnrichedMembers()
    },

    _rebuildEnrichedMembers() {
      const members = this.data.members || []
      const selected = this.data.selectedMembers || []
      const payerId = this.data.selectedPayerId
      const enriched = members.map(m => ({
        ...m,
        avatar_char: (m.nickname || m.shadow_name || '?')[0] || '?',
        _selected: selected.indexOf(m.id) > -1,
        _isPayer: m.id === payerId
      }))
      this.setData({ _enrichedMembers: enriched })
    },

    _selectAllMembers() {
      const list = this.data.members || []
      const ids = list.map(m => m.id)
      this.setData({ selectedMembers: ids })
      this._rebuildEnrichedMembers()
    },

    toggleMember(e) {
      const id = e.currentTarget.dataset.id
      wx.vibrateShort({ type: 'light' })

      let selected = [...this.data.selectedMembers]
      const index = selected.indexOf(id)

      if (index > -1) {
        if (selected.length <= 1) {
          wx.showToast({ title: '至少保留一个分摊人', icon: 'none' })
          return
        }
        selected.splice(index, 1)
        // 清除该成员的自定义分摊金额
        const values = { ...this.data.customSplitValues }
        delete values[id]
        this.setData({ selectedMembers: selected, customSplitValues: values })
      } else {
        selected.push(id)
        this.setData({ selectedMembers: selected })
      }

      // 同步选中状态到 _enrichedMembers
      this._rebuildEnrichedMembers()

      // 自定义模式下重新计算最后一位
      if (this.data.splitMode !== SPLIT_TYPE.EQUAL) {
        this._updateLastMemberAutoAmount()
      }
    },

    // 自定义分摊输入
    onCustomInput(e) {
      const id = e.currentTarget.dataset.id
      let value = e.detail.value

      // 实时限制：输入金额不能超过总消费金额
      if (value && this.data.amount > 0) {
        const inputFen = Math.round(parseFloat(value) * 100)
        if (inputFen > this.data.amount) {
          // 截断到总金额
          value = fenToYuan(this.data.amount)
        }
      }

      this.setData({
        [`customSplitValues.${id}`]: value
      })
      this._updateLastMemberAutoAmount()
    },

    // 自动计算最后一位成员的分摊金额
    _updateLastMemberAutoAmount() {
      const selected = this.data.selectedMembers
      if (selected.length < 2 || this.data.splitMode !== SPLIT_TYPE.CUSTOM || this.data.amount <= 0) {
        this.setData({ lastMemberAutoAmount: '', _lastMemberId: '' })
        return
      }

      const lastId = selected[selected.length - 1]
      let otherTotal = 0

      selected.slice(0, -1).forEach(mid => {
        const val = this.data.customSplitValues[mid]
        if (val) {
          otherTotal += Math.round(parseFloat(val) * 100)
        }
      })

      const remaining = this.data.amount - otherTotal
      const display = fenToYuan(Math.max(0, remaining))
      this.setData({
        lastMemberAutoAmount: display,
        _lastMemberId: lastId,
        [`customSplitValues.${lastId}`]: display
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

    removeImage(e) {
      const idx = e.currentTarget.dataset.index
      const images = [...this.data.images]
      images.splice(idx, 1)
      this.setData({ images })
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
        this.data.selectedMembers.forEach(mid => {
          const val = this.data.customSplitValues[mid]
          if (val) {
            const shareFen = Math.round(parseFloat(val) * 100)
            const member = memberList.find(m => m.id === mid)
            splits.push({
              member_id: mid,
              name: member ? (member.nickname || member.shadow_name || '?') : '?',
              share: shareFen,
              is_shadow: member && member.type === 'shadow'
            })
          }
        })

        if (splits.length === 0) {
          wx.showToast({ title: '请填写分摊金额', icon: 'none' })
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

      // 构建类目信息
      let catKey = this.data.selectedCategory
      let catName = ''
      const catInfo = CATEGORIES.find(c => c.key === catKey)
      if (catInfo) {
        catName = catInfo.name
      }

      // 构建时间
      let paidAt = new Date().toISOString()
      if (this.data.billDate) {
        const dateStr = this.data.billDate
        const timeStr = this.data.billTime || new Date().toTimeString().slice(0, 5)
        paidAt = `${dateStr}T${timeStr}:00.000Z`
      }

      const submitData = {
        amount: this.data.amount,
        category: { key: catKey, name: catName },
        note: this.data.note,
        images: this.data.images,
        location: this.data.location,
        paidAt: paidAt,
        payerId: null,
        payerName: '',
        memberIds: this.data.selectedMembers,
        members: memberList,
        splitType: this.data.splitMode,
        customSplits: splits.length > 0 ? splits : undefined
      }

      // 使用选中的付款人
      const payer = memberList.find(m => m.id === this.data.selectedPayerId)
      if (payer) {
        submitData.payerId = payer.id
        submitData.payerName = payer.nickname || payer.shadow_name || '我'
      }

      this.triggerEvent('onsubmit', submitData)

      setTimeout(() => this._resetForm(), 300)
    },

    _resetForm() {
      // 先确定默认付款人
      const members = this.data.members || []
      const realMember = members.find(m => m.type === 'real') || members[0]

      this.setData({
        rawValue: '',
        displayValue: '0.00',
        amount: 0,
        selectedCategory: '',
        splitMode: SPLIT_TYPE.EQUAL,
        selectedMembers: [],
        customSplitValues: {},
        lastMemberAutoAmount: '',
        selectedPayerId: realMember ? realMember.id : '',
        note: '',
        images: [],
        location: '',
        nearbyLocations: [],
        quickTags: []
      })
      this._selectAllMembers()
      this._initDateTime()
    }
  }
})
