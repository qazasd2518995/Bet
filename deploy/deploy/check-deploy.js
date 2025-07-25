#!/usr/bin/env node
// check-deploy.js - 部署前檢查腳本

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 開始檢查部署環境...\n');

// 檢查必要的檔案
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

console.log('📁 檢查必要檔案:');
requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - 檔案不存在`);
    allFilesExist = false;
  }
});

// 檢查 package.json 中的腳本
console.log('\n📦 檢查 package.json 腳本:');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  
  const requiredScripts = ['start', 'start:agent'];
  requiredScripts.forEach(script => {
    if (packageJson.scripts[script]) {
      console.log(`  ✅ ${script}: ${packageJson.scripts[script]}`);
    } else {
      console.log(`  ❌ ${script} 腳本未定義`);
      allFilesExist = false;
    }
  });
} catch (error) {
  console.log('  ❌ 無法讀取 package.json');
  allFilesExist = false;
}

// 檢查環境變數配置
console.log('\n🔧 檢查環境變數配置:');
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
  console.log('  ❌ 無法讀取 render.yaml');
  allFilesExist = false;
}

// 檢查資料庫配置
console.log('\n🗄️ 檢查資料庫配置:');
try {
  const dbConfig = fs.readFileSync(path.join(__dirname, 'db/config.js'), 'utf8');
  if (dbConfig.includes('dpg-d0e2imc9c44c73che3kg-a')) {
    console.log('  ✅ 資料庫主機已配置');
  } else {
    console.log('  ❌ 資料庫主機配置不正確');
    allFilesExist = false;
  }
  
  if (dbConfig.includes('bet_game')) {
    console.log('  ✅ 資料庫名稱已配置');
  } else {
    console.log('  ❌ 資料庫名稱配置不正確');
    allFilesExist = false;
  }
} catch (error) {
  console.log('  ❌ 無法讀取資料庫配置檔案');
  allFilesExist = false;
}

// 總結
console.log('\n' + '='.repeat(50));
if (allFilesExist) {
  console.log('🎉 所有檢查都通過！您的專案已準備好部署到 Render。');
  console.log('\n📋 接下來的步驟:');
  console.log('1. 推送代碼到 GitHub');
  console.log('2. 在 Render 中創建 Blueprint 或手動創建服務');
  console.log('3. 設置環境變數');
  console.log('4. 部署完成後訪問 /api/init-db 初始化資料庫');
} else {
  console.log('❌ 發現問題，請修復後再嘗試部署。');
  process.exit(1);
}

console.log('\n🔧 修復建議:');
console.log('如果遇到客服操作錯誤，請運行: node fix-db-issues.js');
console.log('然後運行資料庫測試: node test-db-queries.js');
console.log('\n📖 詳細部署指南請參考 DEPLOY.md 檔案'); 