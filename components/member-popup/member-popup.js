/**
 * 成员管理弹窗组件
 */
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
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
      const real = (members || []).filter(m => m.type === 'real' || !m.type)
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

    onShare() {
      wx.showToast({ title: '分享功能开发中', icon: 'none' })
    },

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
    }
  }
})
