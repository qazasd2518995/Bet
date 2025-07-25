// 修復部署問題腳本
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 開始修復部署問題...');

// 1. 更新前端 package.json 確保正確的構建命令
const frontendPackagePath = path.join(__dirname, 'frontend', 'package.json');
if (fs.existsSync(frontendPackagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(frontendPackagePath, 'utf8'));
    
    // 確保有正確的構建腳本
    if (!packageJson.scripts) {
        packageJson.scripts = {};
    }
    
    packageJson.scripts.build = "echo 'Frontend is static, no build needed'";
    
    fs.writeFileSync(frontendPackagePath, JSON.stringify(packageJson, null, 2));
    console.log('✅ 更新了 frontend/package.json');
}

// 2. 創建 deploy 目錄並同步文件
const deployDir = path.join(__dirname, 'deploy');
if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
}

// 3. 創建部署說明文件
const deployReadme = `# 部署說明

## Render 部署配置

### 遊戲端 (bet-game-vcje.onrender.com)
- **Build Command**: \`npm install\`
- **Start Command**: \`npm start\`
- **Environment Variables**:
  - \`NODE_ENV=production\`
  - \`PORT=3000\`

### 代理端 (bet-agent.onrender.com)
- **Build Command**: \`npm install\`
- **Start Command**: \`npm run start:agent\`
- **Environment Variables**:
  - \`NODE_ENV=production\`
  - \`PORT=3003\`

## 常見問題解決

### 1. API 請求失敗
- 檢查 CORS 設定是否包含正確的域名
- 確認前端 API_BASE_URL 設定正確

### 2. 靜態文件無法載入
- 確認 express.static 路徑正確
- 檢查文件權限

### 3. 舊版頁面快取
- 清除瀏覽器快取
- 使用版本號防止快取 (例如: main.js?v=timestamp)
`;

fs.writeFileSync(path.join(deployDir, 'README.md'), deployReadme);
console.log('✅ 創建了部署說明文件');

// 4. 創建環境檢查腳本
const envCheckScript = `
// 環境檢查腳本
console.log('🔍 檢查部署環境...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('當前目錄:', process.cwd());
console.log('文件結構:');

const fs = require('fs');
const path = require('path');

function listDir(dir, prefix = '') {
    try {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stats = fs.statSync(fullPath);
            console.log(prefix + (stats.isDirectory() ? '📁 ' : '📄 ') + item);
            if (stats.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                listDir(fullPath, prefix + '  ');
            }
        });
    } catch (err) {
        console.error('無法讀取目錄:', dir, err.message);
    }
}

listDir('.');
`;

fs.writeFileSync(path.join(deployDir, 'check-env.js'), envCheckScript);
console.log('✅ 創建了環境檢查腳本');

// 5. 更新 package.json 確保正確的啟動命令
const mainPackagePath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(mainPackagePath, 'utf8'));

// 確保有正確的腳本
packageJson.scripts = {
    ...packageJson.scripts,
    "start": "node backend.js",
    "start:agent": "node agentBackend.js",
    "start:all": "concurrently \"npm start\" \"npm run start:agent\"",
    "dev": "nodemon backend.js",
    "dev:agent": "nodemon agentBackend.js",
    "dev:all": "concurrently \"npm run dev\" \"npm run dev:agent\"",
    "check:env": "node deploy/check-env.js"
};

fs.writeFileSync(mainPackagePath, JSON.stringify(packageJson, null, 2));
console.log('✅ 更新了主 package.json');

console.log('\n✨ 修復完成！');
console.log('\n下一步：');
console.log('1. 提交更改: git add -A && git commit -m "修復部署問題"');
console.log('2. 推送到 GitHub: git push');
console.log('3. Render 會自動重新部署');
console.log('\n如果問題持續，執行: npm run check:env');