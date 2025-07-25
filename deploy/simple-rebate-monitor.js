// simple-rebate-monitor.js - 简化的退水监控系统
import db from './db/config.js';

class SimpleRebateMonitor {
    constructor() {
        this.isRunning = false;
        this.lastCheckedPeriod = null;
    }

    async start() {
        console.log('🚀 启动简化退水监控系统\n');
        console.log('=' .repeat(60));
        console.log('📊 监控功能:');
        console.log('✅ 检测新下注');
        console.log('✅ 监控开奖结果');
        console.log('✅ 验证退水处理');
        console.log('✅ 自动报警');
        console.log('=' .repeat(60));
        console.log('');

        this.isRunning = true;
        await this.monitorLoop();
    }

    async monitorLoop() {
        while (this.isRunning) {
            try {
                await this.checkLatestPeriod();
                await this.sleep(3000); // 每3秒检查一次
            } catch (error) {
                console.error('❌ 监控错误:', error.message);
                await this.sleep(5000); // 出错时等待5秒
            }
        }
    }

    async checkLatestPeriod() {
        // 获取最新的下注期号
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

        // 如果是新期号，开始监控
        if (this.lastCheckedPeriod !== currentPeriod) {
            console.log(`\n🎯 发现新期号: ${currentPeriod}`);
            console.log(`📝 最新下注: ${latestBet.username} $${latestBet.amount}`);
            console.log(`📊 本期总下注: ${latestBet.period_bet_count} 笔`);
            
            this.lastCheckedPeriod = currentPeriod;
            
            // 预估退水
            await this.estimateRebates(currentPeriod);
        }

        // 检查期号状态
        await this.checkPeriodStatus(currentPeriod);
    }

    async estimateRebates(period) {
        try {
            // 获取本期所有下注
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

            console.log(`🔍 预估期号 ${period} 退水:`);
            
            let totalExpectedRebate = 0;

            for (const bet of bets) {
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

                let betExpectedRebate = 0;
                let previousRebate = 0;
                
                for (const agent of agentChain) {
                    const rebateDiff = (agent.rebate_percentage || 0) - previousRebate;
                    if (rebateDiff > 0) {
                        // rebate_percentage 已经是小数形式，不需要除以100
                        const rebateAmount = parseFloat(bet.amount) * rebateDiff;
                        betExpectedRebate += rebateAmount;
                        console.log(`     ${agent.username}: ${(rebateDiff * 100).toFixed(3)}% = $${rebateAmount.toFixed(2)}`);
                    }
                    previousRebate = agent.rebate_percentage || 0;
                }

                totalExpectedRebate += betExpectedRebate;
                console.log(`   ${bet.username}: $${betExpectedRebate.toFixed(2)}`);
            }

            console.log(`💵 预估总退水: $${totalExpectedRebate.toFixed(2)}`);

        } catch (error) {
            console.error('❌ 预估退水错误:', error.message);
        }
    }

    async checkPeriodStatus(period) {
        try {
            // 检查开奖状态
            const drawResult = await db.oneOrNone(`
                SELECT result, created_at 
                FROM result_history 
                WHERE period = $1
            `, [period]);

            // 检查结算状态
            const settlementStatus = await db.oneOrNone(`
                SELECT 
                    COUNT(CASE WHEN settled = true THEN 1 END) as settled_count,
                    COUNT(*) as total_count
                FROM bet_history 
                WHERE period = $1
            `, [period]);

            // 检查退水状态
            const rebateStatus = await db.oneOrNone(`
                SELECT 
                    COUNT(*) as rebate_count,
                    COALESCE(SUM(amount), 0) as total_rebate
                FROM transaction_records 
                WHERE period = $1 AND transaction_type = 'rebate'
            `, [period]);

            // 检查结算日志
            const settlementLog = await db.oneOrNone(`
                SELECT id 
                FROM settlement_logs 
                WHERE period = $1
            `, [period]);

            // 显示状态
            const hasDrawn = !!drawResult;
            const allSettled = parseInt(settlementStatus.settled_count) === parseInt(settlementStatus.total_count);
            const hasRebates = parseInt(rebateStatus.rebate_count) > 0;
            const hasLog = !!settlementLog;

            const status = hasDrawn ? 
                (allSettled ? 
                    (hasRebates && hasLog ? '✅ 完成' : '⚠️ 退水缺失') 
                    : '🔄 结算中') 
                : '🎰 下注中';

            this.displayStatus(`期号 ${period}: ${status} | 注单 ${settlementStatus.settled_count}/${settlementStatus.total_count} | 退水 ${rebateStatus.rebate_count}笔 $${parseFloat(rebateStatus.total_rebate).toFixed(2)}`);

            // 如果已开奖但缺少退水，发出警报
            if (hasDrawn && allSettled && (!hasRebates || !hasLog)) {
                await this.alertMissingRebates(period, {
                    hasRebates,
                    hasLog,
                    totalBets: parseInt(settlementStatus.total_count),
                    drawTime: drawResult.created_at
                });
            }

        } catch (error) {
            console.error('❌ 检查期号状态错误:', error.message);
        }
    }

    async alertMissingRebates(period, details) {
        console.log(`\n🚨 退水处理异常警报 - 期号 ${period}`);
        console.log(`⏰ 检测时间: ${new Date().toLocaleString()}`);
        console.log(`📊 状态详情:`);
        console.log(`   - 总注单数: ${details.totalBets}`);
        console.log(`   - 开奖时间: ${details.drawTime}`);
        console.log(`   - 退水记录: ${details.hasRebates ? '✅' : '❌'}`);
        console.log(`   - 结算日志: ${details.hasLog ? '✅' : '❌'}`);
        
        console.log(`\n🔧 建议处理方案:`);
        console.log(`   1. 检查后端结算系统状态`);
        console.log(`   2. 运行手动补偿: node process-single-period-rebate.js ${period}`);
        console.log(`   3. 重启后端服务以载入修复`);
        
        // 记录到数据库
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
            console.error('记录失败结算错误:', error.message);
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
        console.log('\n\n🛑 停止退水监控系统...');
        this.isRunning = false;
        await db.$pool.end();
        console.log('✅ 监控系统已停止');
    }
}

// 启动监控
const monitor = new SimpleRebateMonitor();

// 处理退出信号
process.on('SIGINT', async () => {
    await monitor.stop();
    process.exit(0);
});

process.on('unhandledRejection', (reason) => {
    console.error('\n❌ 未处理的Promise错误:', reason);
});

// 启动
monitor.start().catch(error => {
    console.error('❌ 启动监控失败:', error);
    process.exit(1);
});