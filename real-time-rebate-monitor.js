// real-time-rebate-monitor.js - 实时退水机制监控系统
import db from './db/config.js';
import fetch from 'node-fetch';

class RealTimeRebateMonitor {
    constructor() {
        this.monitoringPeriods = new Map(); // 监控中的期号
        this.isRunning = false;
        this.gameApiUrl = 'http://localhost:3000'; // 游戏后端URL
        this.agentApiUrl = 'http://localhost:3003'; // 代理系统URL
        this.checkInterval = 1000; // 每秒检查一次
        this.maxWaitTime = 180000; // 最多等待3分钟
    }

    async start() {
        console.log('🚀 启动实时退水机制监控系统\n');
        console.log('=' .repeat(80));
        
        this.isRunning = true;
        
        // 启动主监控循环
        this.startMainMonitorLoop();
        
        // 启动游戏状态监控
        this.startGameStateMonitor();
        
        console.log('✅ 监控系统已启动');
        console.log('📊 实时监控面板:');
        console.log('   - 游戏状态: 监控中');
        console.log('   - 下注检测: 启用');
        console.log('   - 开奖等待: 启用');
        console.log('   - 退水验证: 启用');
        console.log('   - 检查间隔: 1秒');
        console.log('');
    }

    async startMainMonitorLoop() {
        while (this.isRunning) {
            try {
                await this.checkMonitoringPeriods();
                await this.detectNewBets();
                await this.checkDrawResults();
                await this.verifyRebateProcessing();
                
                // 清理过期监控
                this.cleanupExpiredMonitoring();
                
            } catch (error) {
                console.error('❌ 监控循环错误:', error);
            }
            
            await this.sleep(this.checkInterval);
        }
    }

    async startGameStateMonitor() {
        while (this.isRunning) {
            try {
                await this.displayCurrentGameState();
            } catch (error) {
                console.error('❌ 游戏状态监控错误:', error);
            }
            
            await this.sleep(5000); // 每5秒更新一次游戏状态
        }
    }

    async detectNewBets() {
        try {
            // 检查最近5分钟的新下注
            const newBets = await db.any(`
                SELECT 
                    bh.id,
                    bh.period,
                    bh.username,
                    bh.amount,
                    bh.bet_type,
                    bh.bet_value,
                    bh.created_at,
                    bh.settled,
                    m.agent_id,
                    m.market_type
                FROM bet_history bh
                JOIN members m ON bh.username = m.username
                WHERE bh.created_at >= NOW() - INTERVAL '5 minutes'
                    ${this.monitoringPeriods.size > 0 ? `AND bh.period NOT IN (${Array.from(this.monitoringPeriods.keys()).join(',')})` : ''}
                ORDER BY bh.created_at DESC
            `);

            for (const bet of newBets) {
                if (!this.monitoringPeriods.has(bet.period)) {
                    await this.startMonitoringPeriod(bet.period, bet);
                }
            }

        } catch (error) {
            console.error('❌ 检测新下注错误:', error);
        }
    }

    async startMonitoringPeriod(period, initialBet) {
        console.log(`\n🎯 开始监控期号 ${period}`);
        console.log(`📝 触发下注: ID ${initialBet.id}, 用户 ${initialBet.username}, 金额 $${initialBet.amount}`);
        
        const monitorData = {
            period,
            startTime: new Date(),
            bets: [initialBet],
            status: 'betting',
            drawResult: null,
            settlementChecked: false,
            rebateProcessed: false,
            issues: []
        };

        this.monitoringPeriods.set(period, monitorData);
        
        // 预估代理退水
        await this.estimateExpectedRebates(period, initialBet);
    }

    async estimateExpectedRebates(period, bet) {
        try {
            // 获取代理链
            const agentChain = await db.any(`
                WITH RECURSIVE agent_chain AS (
                    SELECT id, username, parent_id, rebate_percentage, 0 as level
                    FROM agents 
                    WHERE id = $1
                    
                    UNION ALL
                    
                    SELECT a.id, a.username, a.parent_id, a.rebate_percentage, ac.level + 1
                    FROM agents a
                    JOIN agent_chain ac ON a.id = ac.parent_id
                    WHERE ac.level < 10
                )
                SELECT * FROM agent_chain ORDER BY level
            `, [bet.agent_id]);

            console.log(`🔍 期号 ${period} 预估退水:`);
            
            let previousRebate = 0;
            for (const agent of agentChain) {
                const rebateDiff = (agent.rebate_percentage || 0) - previousRebate;
                if (rebateDiff > 0) {
                    const rebateAmount = (parseFloat(bet.amount) * rebateDiff / 100);
                    console.log(`   ${agent.username}: ${rebateDiff.toFixed(3)}% = $${rebateAmount.toFixed(2)}`);
                }
                previousRebate = agent.rebate_percentage || 0;
            }

        } catch (error) {
            console.error(`❌ 预估退水错误:`, error);
        }
    }

    async checkDrawResults() {
        for (const [period, monitorData] of this.monitoringPeriods) {
            if (monitorData.status === 'betting') {
                // 检查是否有开奖结果
                const drawResult = await db.oneOrNone(`
                    SELECT result, created_at 
                    FROM result_history 
                    WHERE period = $1
                `, [period]);

                if (drawResult) {
                    monitorData.drawResult = drawResult;
                    monitorData.status = 'drawn';
                    monitorData.drawTime = new Date();
                    
                    console.log(`\n🎲 期号 ${period} 已开奖!`);
                    console.log(`📊 开奖结果: ${JSON.stringify(drawResult.result)}`);
                    console.log(`⏰ 开奖时间: ${drawResult.created_at}`);
                    console.log(`🔄 开始等待结算和退水处理...`);
                }
            }
        }
    }

    async verifyRebateProcessing() {
        for (const [period, monitorData] of this.monitoringPeriods) {
            if (monitorData.status === 'drawn' && !monitorData.settlementChecked) {
                // 等待1秒后检查结算（给结算系统时间处理）
                const timeSinceDraw = Date.now() - monitorData.drawTime.getTime();
                
                if (timeSinceDraw >= 2000) { // 2秒后开始检查
                    await this.checkSettlementAndRebates(period, monitorData);
                }
            }
        }
    }

    async checkSettlementAndRebates(period, monitorData) {
        console.log(`\n🔍 检查期号 ${period} 结算和退水状态...`);
        
        try {
            // 1. 检查注单是否已结算
            const settledBets = await db.any(`
                SELECT id, username, amount, settled, win, win_amount
                FROM bet_history 
                WHERE period = $1
            `, [period]);

            const allSettled = settledBets.every(bet => bet.settled);
            
            console.log(`📝 注单结算状态: ${settledBets.length} 笔注单, ${allSettled ? '✅ 全部已结算' : '⏳ 等待结算'}`);

            if (allSettled) {
                // 2. 检查结算日志
                const settlementLog = await db.oneOrNone(`
                    SELECT id, created_at, settled_count 
                    FROM settlement_logs 
                    WHERE period = $1
                `, [period]);

                console.log(`📋 结算日志: ${settlementLog ? '✅ 已创建' : '❌ 缺失'}`);

                // 3. 检查退水记录
                const rebateRecords = await db.any(`
                    SELECT 
                        tr.amount,
                        tr.rebate_percentage,
                        tr.created_at,
                        a.username as agent_username
                    FROM transaction_records tr
                    JOIN agents a ON tr.user_id = a.id
                    WHERE tr.period = $1 AND tr.transaction_type = 'rebate'
                    ORDER BY tr.created_at
                `, [period]);

                console.log(`💰 退水记录: ${rebateRecords.length} 笔`);
                
                if (rebateRecords.length > 0) {
                    console.log(`✅ 退水处理成功:`);
                    let totalRebate = 0;
                    rebateRecords.forEach(rebate => {
                        console.log(`   ${rebate.agent_username}: $${rebate.amount} (${rebate.rebate_percentage}%)`);
                        totalRebate += parseFloat(rebate.amount);
                    });
                    console.log(`💵 总退水金额: $${totalRebate.toFixed(2)}`);
                    
                    monitorData.rebateProcessed = true;
                    monitorData.status = 'completed';
                } else {
                    console.log(`❌ 退水记录缺失！`);
                    monitorData.issues.push('missing_rebates');
                    
                    // 触发警报和补偿
                    await this.triggerRebateAlert(period, monitorData);
                }

                if (!settlementLog) {
                    monitorData.issues.push('missing_settlement_log');
                }

                monitorData.settlementChecked = true;
                monitorData.checkTime = new Date();
            }

        } catch (error) {
            console.error(`❌ 检查期号 ${period} 结算状态错误:`, error);
            monitorData.issues.push(`check_error: ${error.message}`);
        }
    }

    async triggerRebateAlert(period, monitorData) {
        console.log(`\n🚨 退水处理失败警报 - 期号 ${period}`);
        console.log(`⏰ 检查时间: ${new Date().toLocaleString()}`);
        console.log(`📊 问题详情:`);
        monitorData.issues.forEach(issue => {
            console.log(`   - ${issue}`);
        });

        // 尝试触发补偿机制
        console.log(`🔧 尝试触发补偿机制...`);
        
        try {
            // 调用手动补偿脚本
            const { spawn } = await import('child_process');
            const compensateProcess = spawn('node', ['process-single-period-rebate.js', period.toString()], {
                stdio: 'pipe'
            });

            compensateProcess.stdout.on('data', (data) => {
                console.log(`补偿输出: ${data.toString().trim()}`);
            });

            compensateProcess.stderr.on('data', (data) => {
                console.error(`补偿错误: ${data.toString().trim()}`);
            });

            compensateProcess.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ 期号 ${period} 补偿完成`);
                } else {
                    console.error(`❌ 期号 ${period} 补偿失败，退出码: ${code}`);
                }
            });

        } catch (error) {
            console.error(`❌ 触发补偿机制失败:`, error);
        }
    }

    async checkMonitoringPeriods() {
        if (this.monitoringPeriods.size === 0) return;

        const now = new Date();
        
        for (const [period, monitorData] of this.monitoringPeriods) {
            const elapsedTime = now - monitorData.startTime;
            
            // 显示监控状态
            if (elapsedTime % 30000 < this.checkInterval) { // 每30秒显示一次状态
                this.displayMonitoringStatus(period, monitorData, elapsedTime);
            }
        }
    }

    displayMonitoringStatus(period, monitorData, elapsedTime) {
        const statusIcons = {
            'betting': '🎰',
            'drawn': '🎲',
            'completed': '✅',
            'failed': '❌'
        };

        const icon = statusIcons[monitorData.status] || '❓';
        const elapsed = Math.floor(elapsedTime / 1000);
        
        console.log(`${icon} 期号 ${period}: ${monitorData.status.toUpperCase()} (${elapsed}s) ${monitorData.issues.length > 0 ? '⚠️' : ''}`);
    }

    cleanupExpiredMonitoring() {
        const now = new Date();
        const expiredPeriods = [];

        for (const [period, monitorData] of this.monitoringPeriods) {
            const elapsedTime = now - monitorData.startTime;
            
            // 如果超过最大等待时间或已完成，清理监控
            if (elapsedTime > this.maxWaitTime || monitorData.status === 'completed') {
                expiredPeriods.push(period);
            }
        }

        expiredPeriods.forEach(period => {
            const monitorData = this.monitoringPeriods.get(period);
            console.log(`\n🧹 清理期号 ${period} 监控 (状态: ${monitorData.status})`);
            
            if (monitorData.issues.length > 0) {
                console.log(`⚠️ 最终问题列表:`);
                monitorData.issues.forEach(issue => {
                    console.log(`   - ${issue}`);
                });
            }
            
            this.monitoringPeriods.delete(period);
        });
    }

    async displayCurrentGameState() {
        try {
            // 获取当前游戏状态
            const gameState = await this.getCurrentGameState();
            
            if (gameState) {
                process.stdout.write(`\r🎮 游戏状态: 期号 ${gameState.period} | ${gameState.status} | 倒计时 ${gameState.countdown}s | 监控中期号: ${this.monitoringPeriods.size}`);
            }

        } catch (error) {
            // 静默处理游戏状态获取错误
        }
    }

    async getCurrentGameState() {
        try {
            const response = await fetch(`${this.gameApiUrl}/api/game-state`, {
                timeout: 2000
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            // 如果API不可用，从数据库获取最新期号
            const latestPeriod = await db.oneOrNone(`
                SELECT period FROM bet_history 
                ORDER BY period DESC LIMIT 1
            `);
            
            return latestPeriod ? {
                period: latestPeriod.period,
                status: 'unknown',
                countdown: '?'
            } : null;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async stop() {
        console.log('\n🛑 停止退水机制监控系统...');
        this.isRunning = false;
        
        // 显示最终统计
        console.log(`\n📊 监控统计:`);
        console.log(`   - 监控期号数: ${this.monitoringPeriods.size}`);
        
        for (const [period, monitorData] of this.monitoringPeriods) {
            console.log(`   - 期号 ${period}: ${monitorData.status} ${monitorData.issues.length > 0 ? '(有问题)' : ''}`);
        }
        
        await db.$pool.end();
        console.log('✅ 监控系统已停止');
    }
}

// 启动监控系统
const monitor = new RealTimeRebateMonitor();

// 处理 Ctrl+C 退出
process.on('SIGINT', async () => {
    console.log('\n\n收到退出信号...');
    await monitor.stop();
    process.exit(0);
});

// 处理未捕获的错误
process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    process.exit(1);
});

// 启动监控
monitor.start().catch(error => {
    console.error('❌ 启动监控系统失败:', error);
    process.exit(1);
});