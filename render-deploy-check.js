#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');

// Render服务URL（根据您的实际部署地址调整）
const RENDER_URLS = {
    GAME_SERVICE: 'https://bet-game.onrender.com',
    AGENT_SERVICE: 'https://bet-agent.onrender.com'
};

async function checkRenderDeployment() {
    console.log('🚀 Render部署状态检查...\n');

    // 1. 检查本地文件结构
    console.log('=== 本地文件检查 ===');
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

    // 2. 检查package.json脚本
    console.log('\n=== package.json 检查 ===');
    try {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        
        console.log(`📦 专案名称: ${pkg.name}`);
        console.log(`📋 版本: ${pkg.version}`);
        console.log(`🎯 主入口: ${pkg.main}`);
        
        const requiredScripts = ['start', 'start:agent'];
        requiredScripts.forEach(script => {
            if (pkg.scripts && pkg.scripts[script]) {
                console.log(`✅ ${script}: ${pkg.scripts[script]}`);
            } else {
                console.log(`❌ 缺少脚本: ${script}`);
            }
        });

        // 检查关键依赖
        const requiredDeps = ['express', 'pg-promise', 'cors'];
        console.log('\n📚 关键依赖检查:');
        requiredDeps.forEach(dep => {
            if (pkg.dependencies && pkg.dependencies[dep]) {
                console.log(`✅ ${dep}: ${pkg.dependencies[dep]}`);
            } else {
                console.log(`❌ 缺少依赖: ${dep}`);
            }
        });

    } catch (error) {
        console.log('❌ package.json 读取失败:', error.message);
    }

    // 3. 检查render.yaml配置
    console.log('\n=== render.yaml 配置检查 ===');
    try {
        const renderConfig = fs.readFileSync('render.yaml', 'utf8');
        
        // 检查环境变量
        const requiredEnvVars = ['DATABASE_URL', 'NODE_ENV', 'PORT'];
        requiredEnvVars.forEach(envVar => {
            if (renderConfig.includes(envVar)) {
                console.log(`✅ 环境变量 ${envVar} 已配置`);
            } else {
                console.log(`❌ 缺少环境变量: ${envVar}`);
            }
        });

        // 检查服务配置
        if (renderConfig.includes('type: web')) {
            console.log('✅ Web服务类型已配置');
        }
        if (renderConfig.includes('buildCommand:')) {
            console.log('✅ 建构命令已配置');
        }
        if (renderConfig.includes('startCommand:')) {
            console.log('✅ 启动命令已配置');
        }

    } catch (error) {
        console.log('❌ render.yaml 读取失败:', error.message);
    }

    // 4. 检查Git状态
    console.log('\n=== Git 状态检查 ===');
    exec('git status --porcelain', (error, stdout, stderr) => {
        if (error) {
            console.log('❌ Git状态检查失败:', error.message);
            return;
        }
        
        if (stdout.trim()) {
            console.log('⚠️  有未提交的更改:');
            console.log(stdout);
        } else {
            console.log('✅ 工作目录干净，无待提交更改');
        }
    });

    // 5. 检查最新提交
    exec('git log --oneline -5', (error, stdout, stderr) => {
        if (error) {
            console.log('❌ Git日志检查失败:', error.message);
            return;
        }
        
        console.log('\n📝 最近5次提交:');
        console.log(stdout);
    });

    // 6. 测试服务连接（如果服务已部署）
    console.log('\n=== 服务连线测试 ===');
    await testServiceEndpoint(RENDER_URLS.GAME_SERVICE + '/api/health', '游戏服务');
    await testServiceEndpoint(RENDER_URLS.AGENT_SERVICE + '/api/health', '代理服务');

    // 7. 提供部署建议
    console.log('\n=== 部署建议 ===');
    console.log('1. 确保所有更改已提交并推送到GitHub');
    console.log('2. 在Render中确认环境变量设置正确');
    console.log('3. 检查数据库连接字串是否正确');
    console.log('4. 确认PostgreSQL服务运行正常');
    console.log('5. 监控部署日志查看任何错误');
}

async function testServiceEndpoint(url, serviceName) {
    return new Promise((resolve) => {
        const client = url.startsWith('https:') ? https : http;
        
        const request = client.get(url, (res) => {
            if (res.statusCode === 200) {
                console.log(`✅ ${serviceName} 健康检查通过`);
            } else {
                console.log(`⚠️  ${serviceName} 返回状态码: ${res.statusCode}`);
            }
            resolve();
        });

        request.on('error', (error) => {
            console.log(`❌ ${serviceName} 连线失败: ${error.message}`);
            resolve();
        });

        request.setTimeout(10000, () => {
            console.log(`⏰ ${serviceName} 连线超时`);
            request.abort();
            resolve();
        });
    });
}

// 如果直接执行此文件
if (require.main === module) {
    checkRenderDeployment().catch(console.error);
}

module.exports = { checkRenderDeployment }; 