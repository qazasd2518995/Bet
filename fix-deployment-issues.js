// 修复部署问题脚本
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 开始修复部署问题...');

// 1. 更新前端 package.json 确保正确的构建命令
const frontendPackagePath = path.join(__dirname, 'frontend', 'package.json');
if (fs.existsSync(frontendPackagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(frontendPackagePath, 'utf8'));
    
    // 确保有正确的构建脚本
    if (!packageJson.scripts) {
        packageJson.scripts = {};
    }
    
    packageJson.scripts.build = "echo 'Frontend is static, no build needed'";
    
    fs.writeFileSync(frontendPackagePath, JSON.stringify(packageJson, null, 2));
    console.log('✅ 更新了 frontend/package.json');
}

// 2. 创建 deploy 目录并同步文件
const deployDir = path.join(__dirname, 'deploy');
if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
}

// 3. 创建部署说明文件
const deployReadme = `# 部署说明

## Render 部署配置

### 游戏端 (bet-game-vcje.onrender.com)
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

## 常见问题解决

### 1. API 请求失败
- 检查 CORS 设定是否包含正确的域名
- 确认前端 API_BASE_URL 设定正确

### 2. 静态文件无法载入
- 确认 express.static 路径正确
- 检查文件权限

### 3. 旧版页面快取
- 清除浏览器快取
- 使用版本号防止快取 (例如: main.js?v=timestamp)
`;

fs.writeFileSync(path.join(deployDir, 'README.md'), deployReadme);
console.log('✅ 创建了部署说明文件');

// 4. 创建环境检查脚本
const envCheckScript = `
// 环境检查脚本
console.log('🔍 检查部署环境...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('当前目录:', process.cwd());
console.log('文件结构:');

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
        console.error('无法读取目录:', dir, err.message);
    }
}

listDir('.');
`;

fs.writeFileSync(path.join(deployDir, 'check-env.js'), envCheckScript);
console.log('✅ 创建了环境检查脚本');

// 5. 更新 package.json 确保正确的启动命令
const mainPackagePath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(mainPackagePath, 'utf8'));

// 确保有正确的脚本
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

console.log('\n✨ 修复完成！');
console.log('\n下一步：');
console.log('1. 提交更改: git add -A && git commit -m "修复部署问题"');
console.log('2. 推送到 GitHub: git push');
console.log('3. Render 会自动重新部署');
console.log('\n如果问题持续，执行: npm run check:env');