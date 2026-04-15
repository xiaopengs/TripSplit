/**
 * 客户端权限检查工具
 * 仅用于 UI 层面的判断，真正的权限执行在云函数
 */

function getOpenid() {
  const app = getApp()
  return app && app.globalData ? app.globalData.openid : null
}

/**
 * 判断当前用户是否是指定账本的成员
 */
function isMember(members) {
  const openid = getOpenid()
  if (!openid || !members) return false
  return members.some(m => m.user_id === openid)
}

/**
 * 判断当前用户是否是指定账本的管理员
 */
function isAdmin(members) {
  const openid = getOpenid()
  if (!openid || !members) return false
  return members.some(m => m.user_id === openid && m.role === 'admin')
}

/**
 * 获取当前用户在账本中的角色
 * @returns {'admin'|'member'|null}
 */
function getRole(members) {
  const openid = getOpenid()
  if (!openid || !members) return null
  const me = members.find(m => m.user_id === openid)
  return me ? me.role : null
}

/**
 * 判断当前用户是否可以编辑指定账单
 */
function canEditBill(bill, members) {
  const role = getRole(members)
  if (role === 'admin') return true
  const openid = getOpenid()
  return bill && bill.created_by === openid
}

module.exports = { getOpenid, isMember, isAdmin, getRole, canEditBill }
