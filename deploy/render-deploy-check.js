#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');

// Render服務URL（根據您的實際部署地址調整）
const RENDER_URLS = {
    GAME_SERVICE: 'https://bet-game.onrender.com',
    AGENT_SERVICE: 'https://bet-agent.onrender.com'
};

async function checkRenderDeployment() {
    console.log('🚀 Render部署狀態檢查...\n');

    // 1. 檢查本地文件結構
    console.log('=== 本地文件檢查 ===');
    const requiredFiles = [
        'backend.js',
        'agentBackend.js', 
        'package.json',
        'render.yaml',
        'frontend/index.html',
        'deploy/frontend/index.html'
    ];

    requiredFiles.forEach(file => {
        if (fs.existsSync(file)) {
            console.log(`✅ ${file} - 存在`);
        } else {
            console.log(`❌ ${file} - 缺失`);
        }
    });

    // 2. 檢查package.json腳本
    console.log('\n=== package.json 檢查 ===');
    try {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        
        console.log(`📦 專案名稱: ${pkg.name}`);
        console.log(`📋 版本: ${pkg.version}`);
        console.log(`🎯 主入口: ${pkg.main}`);
        
        const requiredScripts = ['start', 'start:agent'];
        requiredScripts.forEach(script => {
            if (pkg.scripts && pkg.scripts[script]) {
                console.log(`✅ ${script}: ${pkg.scripts[script]}`);
            } else {
                console.log(`❌ 缺少腳本: ${script}`);
            }
        });

        // 檢查關鍵依賴
        const requiredDeps = ['express', 'pg-promise', 'cors'];
        console.log('\n📚 關鍵依賴檢查:');
        requiredDeps.forEach(dep => {
            if (pkg.dependencies && pkg.dependencies[dep]) {
                console.log(`✅ ${dep}: ${pkg.dependencies[dep]}`);
            } else {
                console.log(`❌ 缺少依賴: ${dep}`);
            }
        });

    } catch (error) {
        console.log('❌ package.json 讀取失敗:', error.message);
    }

    // 3. 檢查render.yaml配置
    console.log('\n=== render.yaml 配置檢查 ===');
    try {
        const renderConfig = fs.readFileSync('render.yaml', 'utf8');
        
        // 檢查環境變量
        const requiredEnvVars = ['DATABASE_URL', 'NODE_ENV', 'PORT'];
        requiredEnvVars.forEach(envVar => {
            if (renderConfig.includes(envVar)) {
                console.log(`✅ 環境變量 ${envVar} 已配置`);
            } else {
                console.log(`❌ 缺少環境變量: ${envVar}`);
            }
        });

        // 檢查服務配置
        if (renderConfig.includes('type: web')) {
            console.log('✅ Web服務類型已配置');
        }
        if (renderConfig.includes('buildCommand:')) {
            console.log('✅ 建構命令已配置');
        }
        if (renderConfig.includes('startCommand:')) {
            console.log('✅ 啟動命令已配置');
        }

    } catch (error) {
        console.log('❌ render.yaml 讀取失敗:', error.message);
    }

    // 4. 檢查Git狀態
    console.log('\n=== Git 狀態檢查 ===');
    exec('git status --porcelain', (error, stdout, stderr) => {
        if (error) {
            console.log('❌ Git狀態檢查失敗:', error.message);
            return;
        }
        
        if (stdout.trim()) {
            console.log('⚠️  有未提交的更改:');
            console.log(stdout);
        } else {
            console.log('✅ 工作目錄乾淨，無待提交更改');
        }
    });

    // 5. 檢查最新提交
    exec('git log --oneline -5', (error, stdout, stderr) => {
        if (error) {
            console.log('❌ Git日誌檢查失敗:', error.message);
            return;
        }
        
        console.log('\n📝 最近5次提交:');
        console.log(stdout);
    });

    // 6. 測試服務連接（如果服務已部署）
    console.log('\n=== 服務連線測試 ===');
    await testServiceEndpoint(RENDER_URLS.GAME_SERVICE + '/api/health', '遊戲服務');
    await testServiceEndpoint(RENDER_URLS.AGENT_SERVICE + '/api/health', '代理服務');

    // 7. 提供部署建議
    console.log('\n=== 部署建議 ===');
    console.log('1. 確保所有更改已提交並推送到GitHub');
    console.log('2. 在Render中確認環境變量設置正確');
    console.log('3. 檢查數據庫連接字串是否正確');
    console.log('4. 確認PostgreSQL服務運行正常');
    console.log('5. 監控部署日誌查看任何錯誤');
}

async function testServiceEndpoint(url, serviceName) {
    return new Promise((resolve) => {
        const client = url.startsWith('https:') ? https : http;
        
        const request = client.get(url, (res) => {
            if (res.statusCode === 200) {
                console.log(`✅ ${serviceName} 健康檢查通過`);
            } else {
                console.log(`⚠️  ${serviceName} 返回狀態碼: ${res.statusCode}`);
            }
            resolve();
        });

        request.on('error', (error) => {
            console.log(`❌ ${serviceName} 連線失敗: ${error.message}`);
            resolve();
        });

        request.setTimeout(10000, () => {
            console.log(`⏰ ${serviceName} 連線超時`);
            request.abort();
            resolve();
        });
    });
}

// 如果直接執行此文件
if (require.main === module) {
    checkRenderDeployment().catch(console.error);
}

module.exports = { checkRenderDeployment }; 