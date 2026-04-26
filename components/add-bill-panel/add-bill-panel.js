/**
 * 手动记账面板组件
 */
const { fenToYuan, parseInputToFen, splitEqual, yuanToFen } = require('../../utils/currency')
const { CATEGORIES, CATEGORY_TAGS, SPLIT_TYPE, getSkinColor } = require('../../utils/constants')
const { formatAmount } = require('../../utils/currency')
const { formatDate } = require('../../utils/date')

// 辅助：两位补零
function _padTime(n) { return String(n).padStart(2, '0') }

// 辅助：生成不含 Z 的本地时间字符串
function _formatLocalISO(d) {
  return `${d.getFullYear()}-${_padTime(d.getMonth() + 1)}-${_padTime(d.getDate())}T${_padTime(d.getHours())}:${_padTime(d.getMinutes())}:${_padTime(d.getSeconds())}.000`
}

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
    myMemberId: {
      type: String,
      value: ''
    },
    currencySymbol: {
      type: String,
      value: '¥'
    },
    editBill: {
      type: Object,
      value: null
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
    images: [],

    // 滚动位置控制
    scrollTop: 0,

    // 编辑模式
    _editingBillId: null
  },

  observers: {
    'visible': function(val) {
      if (val) {
        if (this.data.editBill) {
          this._populateForm(this.data.editBill)
        } else {
          this._resetForm()
        }
        // 重置滚动位置到顶部（先设为 1 再设为 0，确保即使上次也是 0 也能触发滚动）
        var self = this
        self.setData({ scrollTop: 1 })
        wx.nextTick(function() {
          self.setData({ scrollTop: 0 })
        })
      }
    },
    'members': function(members) {
      // 默认付款人：当前用户 > 第一个真实成员 > 第一个成员
      if (!this.data.selectedPayerId || !(members || []).find(m => m.id === this.data.selectedPayerId)) {
        const myId = this.data.myMemberId
        const defaultPayer = (myId && (members || []).find(m => m.id === myId)) || (members || []).find(m => m.type === 'real') || (members || [])[0]
        this.setData({ selectedPayerId: defaultPayer ? defaultPayer.id : '' })
      }
      this._selectAllMembers()
    },
    'myMemberId': function() {
      this._rebuildEnrichedMembers()
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
      wx.chooseLocation({
        success: (res) => {
          const text = res.name || res.address || ''
          this.setData({
            location: text,
            locationLoading: false,
            nearbyLocations: []
          })
        },
        fail: (err) => {
          this.setData({ locationLoading: false })
          if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
            wx.showToast({ title: '无法获取位置信息', icon: 'none' })
          }
        }
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
      const myId = this.data.myMemberId
      const enriched = members.map(m => {
        const isMe = m.id === myId && myId
        const displayName = isMe ? '我' : (m.shadow_name || m.nickname || '?')
        return {
          ...m,
          avatar_char: displayName[0] || '?',
          display_name: displayName,
          _selected: selected.indexOf(m.id) > -1,
          _isPayer: m.id === payerId
        }
      })
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

      // 构建时间（不使用 Z 后缀，保持本地时间语义）
      let paidAt = _formatLocalISO(new Date())
      if (this.data.billDate) {
        const dateStr = this.data.billDate
        const timeStr = this.data.billTime || _padTime(new Date().getHours()) + ':' + _padTime(new Date().getMinutes())
        paidAt = `${dateStr}T${timeStr}:00.000`
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

      // 标记编辑模式
      if (this.data._editingBillId) {
        submitData._editingBillId = this.data._editingBillId
      }

      this.triggerEvent('onsubmit', submitData)

      setTimeout(() => this._resetForm(), 300)
    },

    _resetForm() {
      // 默认付款人：当前用户 > 第一个真实成员 > 第一个成员
      const members = this.data.members || []
      const myId = this.data.myMemberId
      const defaultPayer = (myId && members.find(m => m.id === myId)) || members.find(m => m.type === 'real') || members[0]

      this.setData({
        rawValue: '',
        displayValue: '0.00',
        amount: 0,
        selectedCategory: '',
        splitMode: SPLIT_TYPE.EQUAL,
        selectedMembers: [],
        customSplitValues: {},
        lastMemberAutoAmount: '',
        selectedPayerId: defaultPayer ? defaultPayer.id : '',
        note: '',
        images: [],
        location: '',
        nearbyLocations: [],
        quickTags: [],
        _editingBillId: null
      })
      this._selectAllMembers()
      this._initDateTime()
    },

    _populateForm(bill) {
      if (!bill) return

      var amountYuan = fenToYuan(bill.amount || 0)
      var rawValue = amountYuan

      // 解析分摊成员
      var selectedMembers = (bill.splits || []).map(function(s) { return s.member_id })
      if (selectedMembers.length === 0) {
        this._selectAllMembers()
        selectedMembers = this.data.selectedMembers
      }

      // 解析自定义分摊
      var customSplitValues = {}
      if (bill.split_type === SPLIT_TYPE.CUSTOM && bill.splits) {
        bill.splits.forEach(function(s) {
          customSplitValues[s.member_id] = fenToYuan(s.share)
        })
      }

      // 解析日期时间
      var billDate = ''
      var billTime = ''
      if (bill.paid_at) {
        var d = new Date(bill.paid_at)
        if (!isNaN(d.getTime())) {
          billDate = formatDate(d, 'YYYY-MM-DD')
          billTime = formatDate(d, 'HH:mm')
        }
      }

      var note = bill.note || ''
      var selectedQuickTag = ''

      this.setData({
        rawValue: rawValue,
        displayValue: amountYuan,
        amount: bill.amount || 0,
        selectedCategory: bill.category || '',
        splitMode: bill.split_type || SPLIT_TYPE.EQUAL,
        selectedMembers: selectedMembers,
        customSplitValues: customSplitValues,
        lastMemberAutoAmount: '',
        selectedPayerId: bill.payer_id || '',
        note: note,
        selectedQuickTag: selectedQuickTag,
        images: bill.images || [],
        location: bill.location || '',
        nearbyLocations: [],
        billDate: billDate,
        billTime: billTime,
        _editingBillId: bill.id || null
      })

      this._rebuildEnrichedMembers()

      // 加载类目标签
      var catKey = bill.category || ''
      var tags = CATEGORY_TAGS[catKey] || []
      this.setData({ quickTags: tags })
    }
  }
})
