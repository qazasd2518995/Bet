#!/usr/bin/env node
// check-deploy.js - 部署前检查脚本

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 开始检查部署环境...\n');

// 检查必要的档案
const requiredFiles = [
  'package.json',
  'render.yaml',
  'backend.js',
  'agentBackend.js',
  'db/config.js',
  'db/init.js',
  'deploy/frontend/index.html',
  'deploy/frontend/favicon.svg',
  'agent/frontend/index.html',
  'agent/frontend/favicon.svg'
];

let allFilesExist = true;

console.log('📁 检查必要档案:');
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - 档案不存在`);
    allFilesExist = false;
  }
});

// 检查 package.json 中的脚本
console.log('\n📦 检查 package.json 脚本:');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  
  const requiredScripts = ['start', 'start:agent'];
  requiredScripts.forEach(script => {
    if (packageJson.scripts[script]) {
      console.log(`  ✅ ${script}: ${packageJson.scripts[script]}`);
    } else {
      console.log(`  ❌ ${script} 脚本未定义`);
      allFilesExist = false;
    }
  });
} catch (error) {
  console.log('  ❌ 无法读取 package.json');
  allFilesExist = false;
}

// 检查环境变数配置
console.log('\n🔧 检查环境变数配置:');
const requiredEnvVars = [
  'DATABASE_URL',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD'
];

try {
  const renderYaml = fs.readFileSync(path.join(__dirname, 'render.yaml'), 'utf8');
  requiredEnvVars.forEach(envVar => {
    if (renderYaml.includes(envVar)) {
      console.log(`  ✅ ${envVar} 已在 render.yaml 中配置`);
    } else {
      console.log(`  ❌ ${envVar} 未在 render.yaml 中配置`);
      allFilesExist = false;
    }
  });
} catch (error) {
  console.log('  ❌ 无法读取 render.yaml');
  allFilesExist = false;
}

// 检查资料库配置
console.log('\n🗄️ 检查资料库配置:');
try {
  const dbConfig = fs.readFileSync(path.join(__dirname, 'db/config.js'), 'utf8');
  if (dbConfig.includes('dpg-d0e2imc9c44c73che3kg-a')) {
    console.log('  ✅ 资料库主机已配置');
  } else {
    console.log('  ❌ 资料库主机配置不正确');
    allFilesExist = false;
  }
  
  if (dbConfig.includes('bet_game')) {
    console.log('  ✅ 资料库名称已配置');
  } else {
    console.log('  ❌ 资料库名称配置不正确');
    allFilesExist = false;
  }
} catch (error) {
  console.log('  ❌ 无法读取资料库配置档案');
  allFilesExist = false;
}

// 总结
console.log('\n' + '='.repeat(50));
if (allFilesExist) {
  console.log('🎉 所有检查都通过！您的专案已准备好部署到 Render。');
  console.log('\n📋 接下来的步骤:');
  console.log('1. 推送代码到 GitHub');
  console.log('2. 在 Render 中创建 Blueprint 或手动创建服务');
  console.log('3. 设置环境变数');
  console.log('4. 部署完成后访问 /api/init-db 初始化资料库');
} else {
  console.log('❌ 发现问题，请修复后再尝试部署。');
  process.exit(1);
}

console.log('\n🔧 修复建议:');
console.log('如果遇到客服操作错误，请运行: node fix-db-issues.js');
console.log('然后运行资料库测试: node test-db-queries.js');
console.log('\n📖 详细部署指南请参考 DEPLOY.md 档案'); 