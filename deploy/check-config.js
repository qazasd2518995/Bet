// 配置检查脚本
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 检查系统配置...\n');

// 检查环境变量
console.log('📋 环境变量:');
console.log('NODE_ENV:', process.env.NODE_ENV || '(未设定 - 将强制使用 production)');
console.log('PORT:', process.env.PORT || '(未设定 - 将使用预设值)');

// 检查资料库配置
console.log('\n📊 资料库配置:');
try {
    const dbConfig = await import('./db/config.js');
    console.log('✅ 资料库配置载入成功');
    console.log('资料库主机:', 'dpg-cqe5tjlds78s73fm1ppg-a.oregon-postgres.render.com');
    console.log('资料库名称:', 'lottery_2npu');
} catch (err) {
    console.error('❌ 资料库配置载入失败:', err.message);
}

// 检查 API URLs
console.log('\n🌐 API 配置:');
console.log('游戏端本地 URL: http://localhost:3000');
console.log('代理端本地 URL: http://localhost:3003');
console.log('游戏端生产 URL: https://bet-game-vcje.onrender.com');
console.log('代理端生产 URL: https://bet-agent.onrender.com');

// 检查重要档案
console.log('\n📁 档案检查:');
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

// 检查最新修改
console.log('\n🕐 最新修改:');
const checkFile = (path) => {
    if (fs.existsSync(path)) {
        const stats = fs.statSync(path);
        const mtime = new Date(stats.mtime);
        return mtime.toLocaleString('zh-TW');
    }
    return '档案不存在';
};

console.log('frontend/src/scripts/vue-app.js:', checkFile('frontend/src/scripts/vue-app.js'));
console.log('agent/frontend/index.html:', checkFile('agent/frontend/index.html'));
console.log('agentBackend.js:', checkFile('agentBackend.js'));

console.log('\n✅ 配置检查完成！');
console.log('\n💡 提示:');
console.log('1. 本地测试: 执行 ./test-local-setup.sh');
console.log('2. 同步到 deploy: 执行 ./sync-to-deploy.sh');
console.log('3. 部署到 Render: git add -A && git commit -m "更新" && git push');