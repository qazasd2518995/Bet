// 配置檢查腳本
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 檢查系統配置...\n');

// 檢查環境變量
console.log('📋 環境變量:');
console.log('NODE_ENV:', process.env.NODE_ENV || '(未設定 - 將強制使用 production)');
console.log('PORT:', process.env.PORT || '(未設定 - 將使用預設值)');

// 檢查資料庫配置
console.log('\n📊 資料庫配置:');
try {
    const dbConfig = await import('./db/config.js');
    console.log('✅ 資料庫配置載入成功');
    console.log('資料庫主機:', 'dpg-cqe5tjlds78s73fm1ppg-a.oregon-postgres.render.com');
    console.log('資料庫名稱:', 'lottery_2npu');
} catch (err) {
    console.error('❌ 資料庫配置載入失敗:', err.message);
}

// 檢查 API URLs
console.log('\n🌐 API 配置:');
console.log('遊戲端本地 URL: http://localhost:3000');
console.log('代理端本地 URL: http://localhost:3003');
console.log('遊戲端生產 URL: https://bet-game-vcje.onrender.com');
console.log('代理端生產 URL: https://bet-agent.onrender.com');

// 檢查重要檔案
console.log('\n📁 檔案檢查:');
const files = [
    'backend.js',
    'agentBackend.js',
    'frontend/src/scripts/vue-app.js',
    'agent/frontend/js/main.js',
    'deploy/backend.js',
    'deploy/agentBackend.js'
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        const size = (stats.size / 1024).toFixed(2);
        console.log(`✅ ${file} (${size} KB)`);
    } else {
        console.log(`❌ ${file} - 不存在`);
    }
});

// 檢查最新修改
console.log('\n🕐 最新修改:');
const checkFile = (path) => {
    if (fs.existsSync(path)) {
        const stats = fs.statSync(path);
        const mtime = new Date(stats.mtime);
        return mtime.toLocaleString('zh-TW');
    }
    return '檔案不存在';
};

console.log('frontend/src/scripts/vue-app.js:', checkFile('frontend/src/scripts/vue-app.js'));
console.log('agent/frontend/index.html:', checkFile('agent/frontend/index.html'));
console.log('agentBackend.js:', checkFile('agentBackend.js'));

console.log('\n✅ 配置檢查完成！');
console.log('\n💡 提示:');
console.log('1. 本地測試: 執行 ./test-local-setup.sh');
console.log('2. 同步到 deploy: 執行 ./sync-to-deploy.sh');
console.log('3. 部署到 Render: git add -A && git commit -m "更新" && git push');