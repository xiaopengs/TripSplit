/**
 * 成员管理弹窗组件
 */
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    bookId: {
      type: String,
      value: ''
    },
    bookName: {
      type: String,
      value: ''
    },
    members: {
      type: Array,
      value: []
    }
  },

  data: {
    showTip: true,
    realMembers: [],
    shadowMembers: [],
    unclaimedCount: 0
  },

  observers: {
    'members': function(members) {
      const addChar = list => list.map(m => ({
        ...m,
        avatar_char: (m.nickname || m.shadow_name || '?')[0] || '?'
      }))
      const real = addChar((members || []).filter(m => m.type === 'real' || !m.type))
      const shadow = (members || []).filter(m => m.type === 'shadow')
      const unclaimed = shadow.filter(m => !m.is_claimed).length

      this.setData({
        realMembers: real,
        shadowMembers: shadow,
        unclaimedCount: unclaimed
      })
    }
  },

  methods: {
    onClose() {
      this.triggerEvent('onclose')
    },

    preventMove() {},

    onClaimTap(e) {
      const id = e.currentTarget.dataset.id
      const name = e.currentTarget.dataset.name
      this.triggerEvent('onclaim', { shadowMemberId: id, name })
    },

    onAddShadow() {
      wx.showModal({
        title: '添加影子成员',
        editable: true,
        placeholderText: '输入成员名称',
        confirmText: '添加',
        confirmColor: '#34C759',
        success: res => {
          if (res.confirm && res.content && res.content.trim()) {
            this.triggerEvent('onaddshadow', { name: res.content.trim() })
          }
        }
      })
    },

    onManageBooks() {
      this.triggerEvent('onclose')
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/books/books' })
      }, 300)
    }
  }
})
