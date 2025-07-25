// simple-rebate-monitor.js - 簡化的退水監控系統
import db from './db/config.js';

class SimpleRebateMonitor {
    constructor() {
        this.isRunning = false;
        this.lastCheckedPeriod = null;
    }

    async start() {
        console.log('🚀 啟動簡化退水監控系統\n');
        console.log('=' .repeat(60));
        console.log('📊 監控功能:');
        console.log('✅ 檢測新下注');
        console.log('✅ 監控開獎結果');
        console.log('✅ 驗證退水處理');
        console.log('✅ 自動報警');
        console.log('=' .repeat(60));
        console.log('');

        this.isRunning = true;
        await this.monitorLoop();
    }

    async monitorLoop() {
        while (this.isRunning) {
            try {
                await this.checkLatestPeriod();
                await this.sleep(3000); // 每3秒檢查一次
            } catch (error) {
                console.error('❌ 監控錯誤:', error.message);
                await this.sleep(5000); // 出錯時等待5秒
            }
        }
    }

    async checkLatestPeriod() {
        // 獲取最新的下注期號
        const latestBet = await db.oneOrNone(`
            SELECT 
                bh.period,
                bh.username,
                bh.amount,
                bh.settled,
                bh.created_at,
                COUNT(*) OVER (PARTITION BY bh.period) as period_bet_count
            FROM bet_history bh
            ORDER BY bh.period DESC, bh.created_at DESC
            LIMIT 1
        `);

        if (!latestBet) {
            this.displayStatus('等待下注...');
            return;
        }

        const currentPeriod = latestBet.period;

        // 如果是新期號，開始監控
        if (this.lastCheckedPeriod !== currentPeriod) {
            console.log(`\n🎯 發現新期號: ${currentPeriod}`);
            console.log(`📝 最新下注: ${latestBet.username} $${latestBet.amount}`);
            console.log(`📊 本期總下注: ${latestBet.period_bet_count} 筆`);
            
            this.lastCheckedPeriod = currentPeriod;
            
            // 預估退水
            await this.estimateRebates(currentPeriod);
        }

        // 檢查期號狀態
        await this.checkPeriodStatus(currentPeriod);
    }

    async estimateRebates(period) {
        try {
            // 獲取本期所有下注
            const bets = await db.any(`
                SELECT 
                    bh.username,
                    bh.amount,
                    m.agent_id,
                    m.market_type
                FROM bet_history bh
                JOIN members m ON bh.username = m.username
                WHERE bh.period = $1
            `, [period]);

            if (bets.length === 0) return;

            console.log(`🔍 預估期號 ${period} 退水:`);
            
            let totalExpectedRebate = 0;

            for (const bet of bets) {
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

                let betExpectedRebate = 0;
                let previousRebate = 0;
                
                for (const agent of agentChain) {
                    const rebateDiff = (agent.rebate_percentage || 0) - previousRebate;
                    if (rebateDiff > 0) {
                        // rebate_percentage 已經是小數形式，不需要除以100
                        const rebateAmount = parseFloat(bet.amount) * rebateDiff;
                        betExpectedRebate += rebateAmount;
                        console.log(`     ${agent.username}: ${(rebateDiff * 100).toFixed(3)}% = $${rebateAmount.toFixed(2)}`);
                    }
                    previousRebate = agent.rebate_percentage || 0;
                }

                totalExpectedRebate += betExpectedRebate;
                console.log(`   ${bet.username}: $${betExpectedRebate.toFixed(2)}`);
            }

            console.log(`💵 預估總退水: $${totalExpectedRebate.toFixed(2)}`);

        } catch (error) {
            console.error('❌ 預估退水錯誤:', error.message);
        }
    }

    async checkPeriodStatus(period) {
        try {
            // 檢查開獎狀態
            const drawResult = await db.oneOrNone(`
                SELECT result, created_at 
                FROM result_history 
                WHERE period = $1
            `, [period]);

            // 檢查結算狀態
            const settlementStatus = await db.oneOrNone(`
                SELECT 
                    COUNT(CASE WHEN settled = true THEN 1 END) as settled_count,
                    COUNT(*) as total_count
                FROM bet_history 
                WHERE period = $1
            `, [period]);

            // 檢查退水狀態
            const rebateStatus = await db.oneOrNone(`
                SELECT 
                    COUNT(*) as rebate_count,
                    COALESCE(SUM(amount), 0) as total_rebate
                FROM transaction_records 
                WHERE period = $1 AND transaction_type = 'rebate'
            `, [period]);

            // 檢查結算日誌
            const settlementLog = await db.oneOrNone(`
                SELECT id 
                FROM settlement_logs 
                WHERE period = $1
            `, [period]);

            // 顯示狀態
            const hasDrawn = !!drawResult;
            const allSettled = parseInt(settlementStatus.settled_count) === parseInt(settlementStatus.total_count);
            const hasRebates = parseInt(rebateStatus.rebate_count) > 0;
            const hasLog = !!settlementLog;

            const status = hasDrawn ? 
                (allSettled ? 
                    (hasRebates && hasLog ? '✅ 完成' : '⚠️ 退水缺失') 
                    : '🔄 結算中') 
                : '🎰 下注中';

            this.displayStatus(`期號 ${period}: ${status} | 注單 ${settlementStatus.settled_count}/${settlementStatus.total_count} | 退水 ${rebateStatus.rebate_count}筆 $${parseFloat(rebateStatus.total_rebate).toFixed(2)}`);

            // 如果已開獎但缺少退水，發出警報
            if (hasDrawn && allSettled && (!hasRebates || !hasLog)) {
                await this.alertMissingRebates(period, {
                    hasRebates,
                    hasLog,
                    totalBets: parseInt(settlementStatus.total_count),
                    drawTime: drawResult.created_at
                });
            }

        } catch (error) {
            console.error('❌ 檢查期號狀態錯誤:', error.message);
        }
    }

    async alertMissingRebates(period, details) {
        console.log(`\n🚨 退水處理異常警報 - 期號 ${period}`);
        console.log(`⏰ 檢測時間: ${new Date().toLocaleString()}`);
        console.log(`📊 狀態詳情:`);
        console.log(`   - 總注單數: ${details.totalBets}`);
        console.log(`   - 開獎時間: ${details.drawTime}`);
        console.log(`   - 退水記錄: ${details.hasRebates ? '✅' : '❌'}`);
        console.log(`   - 結算日誌: ${details.hasLog ? '✅' : '❌'}`);
        
        console.log(`\n🔧 建議處理方案:`);
        console.log(`   1. 檢查後端結算系統狀態`);
        console.log(`   2. 運行手動補償: node process-single-period-rebate.js ${period}`);
        console.log(`   3. 重啟後端服務以載入修復`);
        
        // 記錄到數據庫
        try {
            await db.none(`
                INSERT INTO failed_settlements (period, error_message, created_at)
                VALUES ($1, $2, NOW())
                ON CONFLICT (period) DO UPDATE SET
                    error_message = $2,
                    retry_count = failed_settlements.retry_count + 1,
                    updated_at = NOW()
            `, [period, `Missing rebates detected: rebates=${details.hasRebates}, log=${details.hasLog}`]);
        } catch (error) {
            console.error('記錄失敗結算錯誤:', error.message);
        }
    }

    displayStatus(message) {
        const timestamp = new Date().toLocaleTimeString();
        process.stdout.write(`\r[${timestamp}] ${message}`.padEnd(100));
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async stop() {
        console.log('\n\n🛑 停止退水監控系統...');
        this.isRunning = false;
        await db.$pool.end();
        console.log('✅ 監控系統已停止');
    }
}

// 啟動監控
const monitor = new SimpleRebateMonitor();

// 處理退出信號
process.on('SIGINT', async () => {
    await monitor.stop();
    process.exit(0);
});

process.on('unhandledRejection', (reason) => {
    console.error('\n❌ 未處理的Promise錯誤:', reason);
});

// 啟動
monitor.start().catch(error => {
    console.error('❌ 啟動監控失敗:', error);
    process.exit(1);
});