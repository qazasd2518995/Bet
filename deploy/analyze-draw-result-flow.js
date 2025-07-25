// analyze-draw-result-flow.js - 分析开奖结果在系统中的流动
import db from './db/config.js';

async function analyzeDrawResultFlow() {
    console.log('🔍 分析开奖结果在系统中的流动\n');
    console.log('系统架构：');
    console.log('1. 主游戏系统 (backend.js) - 端口 3000');
    console.log('   - 储存到: result_history 表');
    console.log('   - 使用: GameModel.addResult()');
    console.log('');
    console.log('2. 代理系统 (agentBackend.js) - 端口 3003'); 
    console.log('   - 储存到: draw_records 表');
    console.log('   - 接收: /api/agent/sync-draw-record');
    console.log('');
    console.log('3. 彩票网站 (lottery-website)');
    console.log('   - 读取自: draw_records 表');
    console.log('   - 使用: getLatestDrawRecords()');
    console.log('\n' + '='.repeat(80) + '\n');

    try {
        // 1. 检查两个表的资料差异
        console.log('📊 比较 result_history 和 draw_records 表：\n');
        
        // 获取最近的记录进行比较
        const comparison = await db.any(`
            WITH rh_data AS (
                SELECT 
                    period::text as period,
                    result,
                    created_at as time,
                    'result_history' as source
                FROM result_history
                WHERE period IS NOT NULL
                ORDER BY period DESC
                LIMIT 20
            ),
            dr_data AS (
                SELECT 
                    period,
                    result,
                    draw_time as time,
                    'draw_records' as source
                FROM draw_records
                WHERE period ~ '^[0-9]+$'
                ORDER BY period::bigint DESC
                LIMIT 20
            )
            SELECT * FROM (
                SELECT * FROM rh_data
                UNION ALL
                SELECT * FROM dr_data
            ) combined
            ORDER BY period DESC
        `);

        // 组织资料以便比较
        const periodMap = {};
        for (const record of comparison) {
            if (!periodMap[record.period]) {
                periodMap[record.period] = {};
            }
            periodMap[record.period][record.source] = record;
        }

        console.log('期号对比（最近20期）：');
        console.log('-'.repeat(80));
        console.log('期号'.padEnd(15) + '主系统'.padEnd(25) + '代理系统'.padEnd(25) + '状态');
        console.log('-'.repeat(80));

        for (const period of Object.keys(periodMap).sort((a, b) => b.localeCompare(a)).slice(0, 20)) {
            const data = periodMap[period];
            const mainExists = data.result_history ? '✓' : '✗';
            const agentExists = data.draw_records ? '✓' : '✗';
            
            let status = '✅ 同步';
            if (!data.result_history) status = '⚠️  只在代理系统';
            else if (!data.draw_records) status = '❌ 未同步到代理';
            else {
                // 比较结果是否一致
                const mainResult = JSON.stringify(data.result_history.result);
                const agentResult = JSON.stringify(data.draw_records.result);
                if (mainResult !== agentResult) {
                    status = '❌ 结果不一致';
                }
            }
            
            console.log(
                period.padEnd(15) + 
                mainExists.padEnd(25) + 
                agentExists.padEnd(25) + 
                status
            );
        }

        // 2. 检查同步延迟
        console.log('\n📊 检查同步延迟：\n');
        const syncDelay = await db.any(`
            SELECT 
                rh.period,
                rh.created_at as main_time,
                dr.draw_time as agent_time,
                EXTRACT(EPOCH FROM (dr.draw_time - rh.created_at)) as delay_seconds
            FROM result_history rh
            JOIN draw_records dr ON rh.period::text = dr.period
            WHERE dr.draw_time IS NOT NULL
            ORDER BY rh.period DESC
            LIMIT 10
        `);

        if (syncDelay.length > 0) {
            console.log('最近10期的同步延迟：');
            for (const record of syncDelay) {
                const delayStr = record.delay_seconds 
                    ? `${Math.abs(record.delay_seconds).toFixed(1)} 秒`
                    : '即时';
                console.log(`期号 ${record.period}: ${delayStr}`);
            }
        }

        // 3. 检查期号生成逻辑
        console.log('\n📊 检查期号生成逻辑：\n');
        const today = new Date();
        const todayStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}`;
        
        console.log(`今日日期前缀: ${todayStr}`);
        
        // 检查今日的期号范围
        const todayPeriods = await db.any(`
            SELECT 
                MIN(period) as first_period,
                MAX(period) as last_period,
                COUNT(*) as count
            FROM result_history
            WHERE period::text LIKE $1 || '%'
        `, [todayStr]);

        if (todayPeriods[0].count > 0) {
            console.log(`今日首期: ${todayPeriods[0].first_period}`);
            console.log(`今日末期: ${todayPeriods[0].last_period}`);
            console.log(`今日总期数: ${todayPeriods[0].count}`);
            
            const expectedCount = parseInt(todayPeriods[0].last_period.toString().slice(-3)) - parseInt(todayPeriods[0].first_period.toString().slice(-3)) + 1;
            if (expectedCount !== todayPeriods[0].count) {
                console.log(`⚠️  期号有跳跃: 预期 ${expectedCount} 期，实际 ${todayPeriods[0].count} 期`);
            }
        }

        // 4. 找出问题根源
        console.log('\n📊 潜在问题分析：\n');
        
        // 检查未同步的记录
        const unsyncedRecords = await db.any(`
            SELECT period, created_at
            FROM result_history rh
            WHERE NOT EXISTS (
                SELECT 1 FROM draw_records dr 
                WHERE dr.period = rh.period::text
            )
            AND rh.created_at > NOW() - INTERVAL '24 hours'
            ORDER BY period DESC
        `);

        if (unsyncedRecords.length > 0) {
            console.log(`❌ 发现 ${unsyncedRecords.length} 笔未同步到代理系统的记录：`);
            for (const record of unsyncedRecords.slice(0, 5)) {
                console.log(`   - 期号 ${record.period} (${record.created_at})`);
            }
        }

        // 检查重复开奖
        const duplicateDraws = await db.any(`
            SELECT period, COUNT(*) as count
            FROM result_history
            GROUP BY period
            HAVING COUNT(*) > 1
            ORDER BY period DESC
            LIMIT 5
        `);

        if (duplicateDraws.length > 0) {
            console.log(`\n⚠️  发现重复开奖记录：`);
            for (const dup of duplicateDraws) {
                console.log(`   - 期号 ${dup.period}: ${dup.count} 次`);
            }
        }

        // 5. 解决方案建议
        console.log('\n💡 问题总结与解决方案：\n');
        console.log('1. 资料流动路径:');
        console.log('   backend.js → result_history → (同步API) → draw_records → lottery-website');
        console.log('');
        console.log('2. 可能的问题原因:');
        console.log('   - 同步API调用失败或延迟');
        console.log('   - 期号生成逻辑在系统重启时可能出现跳号');
        console.log('   - 并发开奖导致期号混乱');
        console.log('');
        console.log('3. 建议修复方案:');
        console.log('   - 确保同步API的可靠性和重试机制');
        console.log('   - 在期号生成时检查最后一期，避免跳号');
        console.log('   - 添加分布式锁防止并发开奖');
        console.log('   - 定期执行资料一致性检查和修复');

    } catch (error) {
        console.error('❌ 分析失败:', error);
    } finally {
        process.exit(0);
    }
}

// 执行分析
analyzeDrawResultFlow();