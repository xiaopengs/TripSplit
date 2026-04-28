#!/usr/bin/env node
/**
 * TripSplit 一键发布脚本
 * 
 * 用法:
 *   node ci.js preview    预览版（手机扫码看效果）
 *   node ci.js upload     上传到微信后台
 */

const ci = require('miniprogram-ci')
const path = require('path')
const fs = require('fs')

const PROJECT_DIR = path.resolve(__dirname)
const APPID = 'wx86331a99c51be758'
const KEY_PATH = path.join(PROJECT_DIR, 'private.wx86331a99c51be758.key')

// 颜色输出
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function log(msg, color = '') {
  console.log(`${color}${msg}${RESET}`)
}

async function main() {
  const command = process.argv[2] || 'preview'

  log(`${BOLD}\n🚀 TripSplit 发布工具${RESET}`)
  log(`${BOLD}   AA友账 - 旅行分账小程序${RESET}\n`)

  // 检查私钥
  if (!fs.existsSync(KEY_PATH)) {
    log(`私钥文件不存在: ${KEY_PATH}`, RED)
    log(`请将私钥文件放到项目根目录`, YELLOW)
    process.exit(1)
  }

  // 读取私钥
  const privateKey = fs.readFileSync(KEY_PATH, 'utf-8')

  // 创建项目实例
  const project = new ci.Project({
    appid: APPID,
    type: 'miniProgram',
    projectPath: PROJECT_DIR,
    privateKey: privateKey,
    ignores: ['node_modules/**/*', 'tests/**/*', '*.cjs', 'publish.cjs', 'ci.js', 'run_preview.bat', 'preview-qrcode.jpg'],
    setting: {
      es6: true,
      minify: false,
      autoPrefixWXSS: false
    }
  })

  if (command === 'preview') {
    // 预览
    log(`[${GREEN}预览模式${RESET}] 生成预览二维码...`)
    try {
      const previewResult = await ci.preview({
        project,
        qrcodeFormat: 'image',
        qrcodeOutputDest: path.join(PROJECT_DIR, 'preview-qrcode.jpg'),
        setting: {
          es6: true,
          minify: false,
          autoPrefixWXSS: false,
          minified: false,
          postcss: false
        },
        onProgressUpdate: (query) => {
          log(`  状态: ${query._status || query.status}`)
        }
      })
      log(`\n  ${GREEN}✓ 预览版本已生成！${RESET}`)
      log(`  二维码路径: ${path.join(PROJECT_DIR, 'preview-qrcode.jpg')}`)
    } catch (err) {
      log(`  ${RED}预览失败: ${err.message}${RESET}`)
      process.exit(1)
    }
  } else if (command === 'upload') {
    // 上传
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'package.json')).toString())
    const version = pkg.version || '1.0.0'
    const desc = pkg.description || 'AA友账'

    log(`[${GREEN}上传模式${RESET}] 上传到微信后台...`)
    log(`  版本: ${version}`)
    log(`  描述: ${desc}\n`)

    try {
      const uploadResult = await ci.upload({
        project,
        version,
        desc,
        setting: {
          es6: true,
          minify: false,
          autoPrefixWXSS: false,
          minified: false,
          postcss: false
        },
        onProgressUpdate: (query) => {
          log(`  上传进度: ${query._status}`)
        }
      })
      log(`\n  ${GREEN}✓ 上传成功！${RESET}`)
      log(`  请到微信公众平台 → 管理 → 版本管理 查看并提交审核`)
    } catch (err) {
      log(`  ${RED}上传失败: ${err.message}${RESET}`)
      process.exit(1)
    }
  } else {
    log(`未知命令: ${command}`, RED)
    log(`用法: node ci.js [preview|upload]`, YELLOW)
    process.exit(1)
  }
}

main().catch(err => {
  log(`发布失败: ${err.message}`, RED)
  process.exit(1)
})
