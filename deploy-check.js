import fs from 'fs';
import path from 'path';

console.log('🔍 部署前檢查開始...\n');

// 檢查必要文件是否存在
const requiredFiles = [
    'package.json',
    'Procfile',
    'render.yaml',
    'backend.js',
    'agentBackend.js',
    'deploy/frontend/index.html',
    'deploy/frontend/login.html'
];

console.log('📁 檢查必要文件...');
let missingFiles = [];
for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - 缺失`);
        missingFiles.push(file);
    }
}

if (missingFiles.length > 0) {
    console.log(`\n❌ 缺失文件: ${missingFiles.join(', ')}`);
    process.exit(1);
}

// 檢查package.json
console.log('\n📦 檢查package.json...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

if (packageJson.scripts.start) {
    console.log('✅ start script 已配置');
} else {
    console.log('❌ start script 缺失');
}

if (packageJson.scripts['start:agent']) {
    console.log('✅ start:agent script 已配置');
} else {
    console.log('❌ start:agent script 缺失');
}

if (packageJson.engines && packageJson.engines.node) {
    console.log(`✅ Node.js 版本要求: ${packageJson.engines.node}`);
} else {
    console.log('⚠️ 建議設置 Node.js 版本要求');
}

// 檢查Procfile
console.log('\n🚀 檢查Procfile...');
const procfile = fs.readFileSync('Procfile', 'utf8').trim();
if (procfile.includes('npm start')) {
    console.log('✅ Procfile 配置正確');
} else {
    console.log('❌ Procfile 配置可能有問題');
}

// 檢查前端文件中的API配置
console.log('\n🌐 檢查前端API配置...');
const indexHtml = fs.readFileSync('deploy/frontend/index.html', 'utf8');

if (indexHtml.includes('window.location.hostname')) {
    console.log('✅ 前端API配置支持動態環境');
} else if (indexHtml.includes('localhost:3002')) {
    console.log('⚠️ 前端仍有硬編碼的localhost URL');
} else {
    console.log('✅ 前端API配置正確');
}

// 檢查後端CORS配置
console.log('\n🔐 檢查後端CORS配置...');
const backendJs = fs.readFileSync('backend.js', 'utf8');

if (backendJs.includes('bet-game.onrender.com')) {
    console.log('✅ 後端CORS包含Render域名');
} else {
    console.log('⚠️ 後端CORS可能需要更新Render域名');
}

if (backendJs.includes('localhost:8082')) {
    console.log('✅ 後端CORS包含開發環境端口');
} else {
    console.log('⚠️ 後端CORS缺少開發環境端口');
}

// 檢查環境變量
console.log('\n🔧 檢查環境變量配置...');
const renderYaml = fs.readFileSync('render.yaml', 'utf8');

if (renderYaml.includes('DATABASE_URL')) {
    console.log('✅ 數據庫連接已配置');
} else {
    console.log('❌ 數據庫連接配置缺失');
}

if (renderYaml.includes('NODE_ENV')) {
    console.log('✅ NODE_ENV 已配置');
} else {
    console.log('❌ NODE_ENV 配置缺失');
}

// 檢查健康檢查端點
if (backendJs.includes('/api/health')) {
    console.log('✅ 健康檢查端點已配置');
} else {
    console.log('❌ 健康檢查端點缺失');
}

console.log('\n🎉 部署前檢查完成！');
console.log('\n📋 部署步驟提醒:');
console.log('1. git add .');
console.log('2. git commit -m "更新UI和修復API配置"');
console.log('3. git push origin main');
console.log('4. 在Render中檢查部署狀態');
console.log('5. 測試前端和API功能'); 