#!/usr/bin/env node
/**
 * TripSplit 测试运行器
 * 
 * 用法:
 *   node tests/run.js          运行所有测试
 *   node tests/run.js unit     仅运行单元测试
 *   node tests/run.js integration 仅运行集成测试
 */

const path = require('path')

// 初始化微信模拟环境
require('./wx.mock')

// 测试模块注册
const testSuites = {
  // === 单元测试 ===
  unit: [
    require('./calc.test'),
    require('./currency.test'),
    require('./date.test'),
    require('./id.test'),
    require('./cache.test'),
    require('./store.test'),
    require('./settle.test'),
    require('./book.test'),
    require('./bill.test'),
    require('./member.test'),
    require('./sync.test')
  ],
  // === 集成测试 ===
  integration: [
    require('./integration.test')
  ]
}

// 解析命令行参数
const mode = process.argv[2] || 'all'
const { runSuites } = require('./test.helper')

async function main() {
  console.log(`\n🧪 TripSplit 测试 - 模式: ${mode === 'all' ? '全部' : mode}`)
  console.log(`📅 ${new Date().toLocaleString('zh-CN')}\n`)

  try {
    if (mode === 'all' || mode === 'unit') {
      // 单元测试已在 require 时自动注册到 describe/it 系统
    }
    if (mode === 'all' || mode === 'integration') {
      // 集成测试同上
    }
    
    await runSuites()
  } catch (err) {
    console.error('测试运行失败:', err)
    process.exit(2)
  }
}

main()
