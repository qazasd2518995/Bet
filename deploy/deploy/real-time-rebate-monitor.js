// real-time-rebate-monitor.js - 實時退水機制監控系統
import db from './db/config.js';
import fetch from 'node-fetch';

class RealTimeRebateMonitor {
    constructor() {
        this.monitoringPeriods = new Map(); // 監控中的期號
        this.isRunning = false;
        this.gameApiUrl = 'http://localhost:3000'; // 遊戲後端URL
        this.agentApiUrl = 'http://localhost:3003'; // 代理系統URL
        this.checkInterval = 1000; // 每秒檢查一次
        this.maxWaitTime = 180000; // 最多等待3分鐘
    }

    async start() {
        console.log('🚀 啟動實時退水機制監控系統\n');
        console.log('=' .repeat(80));
        
        this.isRunning = true;
        
        // 啟動主監控循環
        this.startMainMonitorLoop();
        
        // 啟動遊戲狀態監控
        this.startGameStateMonitor();
        
        console.log('✅ 監控系統已啟動');
        console.log('📊 實時監控面板:');
        console.log('   - 遊戲狀態: 監控中');
        console.log('   - 下注檢測: 啟用');
        console.log('   - 開獎等待: 啟用');
        console.log('   - 退水驗證: 啟用');
        console.log('   - 檢查間隔: 1秒');
        console.log('');
    }

    async startMainMonitorLoop() {
        while (this.isRunning) {
            try {
                await this.checkMonitoringPeriods();
                await this.detectNewBets();
                await this.checkDrawResults();
                await this.verifyRebateProcessing();
                
                // 清理過期監控
                this.cleanupExpiredMonitoring();
                
            } catch (error) {
                console.error('❌ 監控循環錯誤:', error);
            }
            
            await this.sleep(this.checkInterval);
        }
    }

    async startGameStateMonitor() {
        while (this.isRunning) {
            try {
                await this.displayCurrentGameState();
            } catch (error) {
                console.error('❌ 遊戲狀態監控錯誤:', error);
            }
            
            await this.sleep(5000); // 每5秒更新一次遊戲狀態
        }
    }

    async detectNewBets() {
        try {
            // 檢查最近5分鐘的新下注
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
            console.error('❌ 檢測新下注錯誤:', error);
        }
    }

    async startMonitoringPeriod(period, initialBet) {
        console.log(`\n🎯 開始監控期號 ${period}`);
        console.log(`📝 觸發下注: ID ${initialBet.id}, 用戶 ${initialBet.username}, 金額 $${initialBet.amount}`);
        
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
        
        // 預估代理退水
        await this.estimateExpectedRebates(period, initialBet);
    }

    async estimateExpectedRebates(period, bet) {
        try {
            // 獲取代理鏈
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

            console.log(`🔍 期號 ${period} 預估退水:`);
            
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
            console.error(`❌ 預估退水錯誤:`, error);
        }
    }

    async checkDrawResults() {
        for (const [period, monitorData] of this.monitoringPeriods) {
            if (monitorData.status === 'betting') {
                // 檢查是否有開獎結果
                const drawResult = await db.oneOrNone(`
                    SELECT result, created_at 
                    FROM result_history 
                    WHERE period = $1
                `, [period]);

                if (drawResult) {
                    monitorData.drawResult = drawResult;
                    monitorData.status = 'drawn';
                    monitorData.drawTime = new Date();
                    
                    console.log(`\n🎲 期號 ${period} 已開獎!`);
                    console.log(`📊 開獎結果: ${JSON.stringify(drawResult.result)}`);
                    console.log(`⏰ 開獎時間: ${drawResult.created_at}`);
                    console.log(`🔄 開始等待結算和退水處理...`);
                }
            }
        }
    }

    async verifyRebateProcessing() {
        for (const [period, monitorData] of this.monitoringPeriods) {
            if (monitorData.status === 'drawn' && !monitorData.settlementChecked) {
                // 等待1秒後檢查結算（給結算系統時間處理）
                const timeSinceDraw = Date.now() - monitorData.drawTime.getTime();
                
                if (timeSinceDraw >= 2000) { // 2秒後開始檢查
                    await this.checkSettlementAndRebates(period, monitorData);
                }
            }
        }
    }

    async checkSettlementAndRebates(period, monitorData) {
        console.log(`\n🔍 檢查期號 ${period} 結算和退水狀態...`);
        
        try {
            // 1. 檢查注單是否已結算
            const settledBets = await db.any(`
                SELECT id, username, amount, settled, win, win_amount
                FROM bet_history 
                WHERE period = $1
            `, [period]);

            const allSettled = settledBets.every(bet => bet.settled);
            
            console.log(`📝 注單結算狀態: ${settledBets.length} 筆注單, ${allSettled ? '✅ 全部已結算' : '⏳ 等待結算'}`);

            if (allSettled) {
                // 2. 檢查結算日誌
                const settlementLog = await db.oneOrNone(`
                    SELECT id, created_at, settled_count 
                    FROM settlement_logs 
                    WHERE period = $1
                `, [period]);

                console.log(`📋 結算日誌: ${settlementLog ? '✅ 已創建' : '❌ 缺失'}`);

                // 3. 檢查退水記錄
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

                console.log(`💰 退水記錄: ${rebateRecords.length} 筆`);
                
                if (rebateRecords.length > 0) {
                    console.log(`✅ 退水處理成功:`);
                    let totalRebate = 0;
                    rebateRecords.forEach(rebate => {
                        console.log(`   ${rebate.agent_username}: $${rebate.amount} (${rebate.rebate_percentage}%)`);
                        totalRebate += parseFloat(rebate.amount);
                    });
                    console.log(`💵 總退水金額: $${totalRebate.toFixed(2)}`);
                    
                    monitorData.rebateProcessed = true;
                    monitorData.status = 'completed';
                } else {
                    console.log(`❌ 退水記錄缺失！`);
                    monitorData.issues.push('missing_rebates');
                    
                    // 觸發警報和補償
                    await this.triggerRebateAlert(period, monitorData);
                }

                if (!settlementLog) {
                    monitorData.issues.push('missing_settlement_log');
                }

                monitorData.settlementChecked = true;
                monitorData.checkTime = new Date();
            }

        } catch (error) {
            console.error(`❌ 檢查期號 ${period} 結算狀態錯誤:`, error);
            monitorData.issues.push(`check_error: ${error.message}`);
        }
    }

    async triggerRebateAlert(period, monitorData) {
        console.log(`\n🚨 退水處理失敗警報 - 期號 ${period}`);
        console.log(`⏰ 檢查時間: ${new Date().toLocaleString()}`);
        console.log(`📊 問題詳情:`);
        monitorData.issues.forEach(issue => {
            console.log(`   - ${issue}`);
        });

        // 嘗試觸發補償機制
        console.log(`🔧 嘗試觸發補償機制...`);
        
        try {
            // 調用手動補償腳本
            const { spawn } = await import('child_process');
            const compensateProcess = spawn('node', ['process-single-period-rebate.js', period.toString()], {
                stdio: 'pipe'
            });

            compensateProcess.stdout.on('data', (data) => {
                console.log(`補償輸出: ${data.toString().trim()}`);
            });

            compensateProcess.stderr.on('data', (data) => {
                console.error(`補償錯誤: ${data.toString().trim()}`);
            });

            compensateProcess.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ 期號 ${period} 補償完成`);
                } else {
                    console.error(`❌ 期號 ${period} 補償失敗，退出碼: ${code}`);
                }
            });

        } catch (error) {
            console.error(`❌ 觸發補償機制失敗:`, error);
        }
    }

    async checkMonitoringPeriods() {
        if (this.monitoringPeriods.size === 0) return;

        const now = new Date();
        
        for (const [period, monitorData] of this.monitoringPeriods) {
            const elapsedTime = now - monitorData.startTime;
            
            // 顯示監控狀態
            if (elapsedTime % 30000 < this.checkInterval) { // 每30秒顯示一次狀態
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
        
        console.log(`${icon} 期號 ${period}: ${monitorData.status.toUpperCase()} (${elapsed}s) ${monitorData.issues.length > 0 ? '⚠️' : ''}`);
    }

    cleanupExpiredMonitoring() {
        const now = new Date();
        const expiredPeriods = [];

        for (const [period, monitorData] of this.monitoringPeriods) {
            const elapsedTime = now - monitorData.startTime;
            
            // 如果超過最大等待時間或已完成，清理監控
            if (elapsedTime > this.maxWaitTime || monitorData.status === 'completed') {
                expiredPeriods.push(period);
            }
        }

        expiredPeriods.forEach(period => {
            const monitorData = this.monitoringPeriods.get(period);
            console.log(`\n🧹 清理期號 ${period} 監控 (狀態: ${monitorData.status})`);
            
            if (monitorData.issues.length > 0) {
                console.log(`⚠️ 最終問題列表:`);
                monitorData.issues.forEach(issue => {
                    console.log(`   - ${issue}`);
                });
            }
            
            this.monitoringPeriods.delete(period);
        });
    }

    async displayCurrentGameState() {
        try {
            // 獲取當前遊戲狀態
            const gameState = await this.getCurrentGameState();
            
            if (gameState) {
                process.stdout.write(`\r🎮 遊戲狀態: 期號 ${gameState.period} | ${gameState.status} | 倒計時 ${gameState.countdown}s | 監控中期號: ${this.monitoringPeriods.size}`);
            }

        } catch (error) {
            // 靜默處理遊戲狀態獲取錯誤
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
            // 如果API不可用，從數據庫獲取最新期號
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
        console.log('\n🛑 停止退水機制監控系統...');
        this.isRunning = false;
        
        // 顯示最終統計
        console.log(`\n📊 監控統計:`);
        console.log(`   - 監控期號數: ${this.monitoringPeriods.size}`);
        
        for (const [period, monitorData] of this.monitoringPeriods) {
            console.log(`   - 期號 ${period}: ${monitorData.status} ${monitorData.issues.length > 0 ? '(有問題)' : ''}`);
        }
        
        await db.$pool.end();
        console.log('✅ 監控系統已停止');
    }
}

// 啟動監控系統
const monitor = new RealTimeRebateMonitor();

// 處理 Ctrl+C 退出
process.on('SIGINT', async () => {
    console.log('\n\n收到退出信號...');
    await monitor.stop();
    process.exit(0);
});

// 處理未捕獲的錯誤
process.on('unhandledRejection', (reason, promise) => {
    console.error('未處理的Promise拒絕:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('未捕獲的異常:', error);
    process.exit(1);
});

// 啟動監控
monitor.start().catch(error => {
    console.error('❌ 啟動監控系統失敗:', error);
    process.exit(1);
});