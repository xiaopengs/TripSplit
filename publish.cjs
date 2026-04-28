#!/usr/bin/env node
/**
 * TripSplit 一键发布脚本（使用 .cjs 后缀避免微信小程序扫描）
 * 
 * 功能:
 *   1. 运行全部测试
 *   2. 构建小程序（调用微信 CI 工具）
 *   3. 上传到微信后台 / 生成预览二维码
 * 
 * 用法:
 *   node publish.cjs test       仅运行测试
 *   node publish.cjs preview    生成预览二维码
 *   node publish.cjs upload     上传到微信后台
 *   node publish.cjs all        测试 + 上传（默认）
 *   node publish.cjs            同 all
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const PROJECT_DIR = path.resolve(__dirname)
const APPID = 'wx86331a99c51be758'

// 颜色
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function log(msg, color = '') {
  console.log(`${color}${msg}${RESET}`)
}

function logStep(step, msg) {
  log(`\n${BOLD}[${step}] ${msg}${RESET}`)
}

function run(cmd, options = {}) {
  try {
    const output = execSync(cmd, {
      cwd: PROJECT_DIR,
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    })
    return { success: true, output }
  } catch (err) {
    return { success: false, error: err.message, code: err.status }
  }
}

// === Step 1: 运行测试 ===
function runTests() {
  logStep('1/3', '运行测试套件...')
  
  const result = run('node tests/run.js', { silent: true })
  if (!result.success) {
    log('测试失败！输出:', RED)
    // 提取失败的测试
    const lines = result.output.split('\n')
    const errorSection = lines.findIndex(l => l.includes('个失败'))
    if (errorSection > -1) {
      log(lines.slice(Math.max(0, errorSection - 2)).join('\n'), RED)
    }
    process.exit(1)
  }

  // 提取统计信息
  const match = result.output.match(/结果:\s*(\d+)\/(\d+)\s*通过/)
  if (match) {
    log(`  ✓ 测试通过: ${GREEN}${match[1]}/${match[2]}${RESET}`)
  }

  return true
}

// === Step 2: 检查微信开发者工具 CLI ===
function checkCliTool() {
  logStep('2/3', '检查微信开发者工具 CLI...')

  // Windows 默认路径
  const winPaths = [
    'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat',
    process.env.LOCALAPPDATA + '\\Programs\\Tencent\\微信web开发者工具\\cli.bat'
  ]
  
  const isWin = process.platform === 'win32'
  const paths = isWin ? winPaths : [
    '/Applications/wechatwebdevtools.app/Contents/MACOS/cli',
    '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
  ]
  
  for (const p of paths) {
    if (fs.existsSync(p)) {
      log(`  ✓ 找到 CLI: ${p}`, GREEN)
      return p
    }
  }

  log(`  ${YELLOW}! 未找到微信开发者工具 CLI${RESET}`)
  log(`  ${YELLOW}  请确认已安装微信开发者工具，并开启"服务端口"${RESET}`)
  log(`  ${YELLOW}  设置 → 安全设置 → 服务端口（开启）${RESET}`)
  return null
}

// === Step 3: 构建与发布 ===
function publish(cliPath, mode = 'preview') {
  logStep('3/3', mode === 'preview' ? '生成预览二维码...' : '上传到微信后台...')

  if (!cliPath) {
    log(`  ${RED}无法发布：未找到微信开发者工具 CLI${RESET}`)
    log(`  ${YELLOW}提示：你可以手动在微信开发者工具中打开项目并点击上传/预览${RESET}`)
    
    // 输出项目信息
    log(`\n${BOLD}项目信息:${RESET}`)
    log(`  路径: ${PROJECT_DIR}`)
    log(`  AppID: ${APPID}`)
    log(`  页面数: ${JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'app.json'))).pages.length}`)
    
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'package.json')).toString())
    log(`  版本: ${pkg.version || '1.0.0'}`)
    log(`  描述: ${pkg.description || ''}`)
    
    return false
  }

  const cmd = `"${cliPath}" ${mode} --project ${PROJECT_DIR} --appid ${APPID}`
  const desc = mode === 'preview' ? '预览' : '上传'
  
  const result = run(cmd)
  if (!result.success) {
    log(`  ${RED}${desc}失败: ${result.error}${RESET}`)
    return false
  }

  log(`  ${GREEN}✓ ${desc}成功！${RESET}`)
  return true
}

// === 检查 package.json 是否存在 ===
function ensurePackageJson() {
  const pkgPath = path.join(PROJECT_DIR, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    const pkg = {
      name: 'tripsplit',
      version: '1.0.0',
      description: 'AA友账 - 旅行分账小程序',
      private: true,
      scripts: {
        test: 'node tests/run.js',
        'test:unit': 'node tests/run.js unit',
        'test:integration': 'node tests/run.js integration',
        preview: 'node publish.cjs preview',
        upload: 'node publish.cjs upload',
        publish: 'node publish.cjs all'
      }
    }
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf-8')
    log(`  ✓ 已创建 package.json`, GREEN)
  }
}

// === 主函数 ===
async function main() {
  const startTime = Date.now()
  
  log(`${BOLD}\n🚀 TripSplit 发布工具${RESET}`)
  log(`${BOLD}   AA友账 - 旅行分账小程序${RESET}\n`)

  ensurePackageJson()

  const command = process.argv[2] || 'all'
  
  switch (command) {
    case 'test':
      runTests()
      break
      
    case 'preview':
      runTests()
      publish(checkCliTool(), 'preview')
      break
      
    case 'upload':
      runTests()
      publish(checkCliTool(), 'upload')
      break
      
    case 'all':
    default:
      runTests()
      const cliPath = checkCliTool()
      publish(cliPath, 'upload')
      break
  }

  const elapsed = Date.now() - startTime
  log(`\n${BOLD}耗时: ${elapsed}ms${RESET}\n`)
}

main().catch(err => {
  log(`发布失败: ${err.message}`, RED)
  process.exit(1)
})