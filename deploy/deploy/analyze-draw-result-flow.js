// analyze-draw-result-flow.js - 分析開獎結果在系統中的流動
import db from './db/config.js';

async function analyzeDrawResultFlow() {
    console.log('🔍 分析開獎結果在系統中的流動\n');
    console.log('系統架構：');
    console.log('1. 主遊戲系統 (backend.js) - 端口 3000');
    console.log('   - 儲存到: result_history 表');
    console.log('   - 使用: GameModel.addResult()');
    console.log('');
    console.log('2. 代理系統 (agentBackend.js) - 端口 3003'); 
    console.log('   - 儲存到: draw_records 表');
    console.log('   - 接收: /api/agent/sync-draw-record');
    console.log('');
    console.log('3. 彩票網站 (lottery-website)');
    console.log('   - 讀取自: draw_records 表');
    console.log('   - 使用: getLatestDrawRecords()');
    console.log('\n' + '='.repeat(80) + '\n');

    try {
        // 1. 檢查兩個表的資料差異
        console.log('📊 比較 result_history 和 draw_records 表：\n');
        
        // 獲取最近的記錄進行比較
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

        // 組織資料以便比較
        const periodMap = {};
        for (const record of comparison) {
            if (!periodMap[record.period]) {
                periodMap[record.period] = {};
            }
            periodMap[record.period][record.source] = record;
        }

        console.log('期號對比（最近20期）：');
        console.log('-'.repeat(80));
        console.log('期號'.padEnd(15) + '主系統'.padEnd(25) + '代理系統'.padEnd(25) + '狀態');
        console.log('-'.repeat(80));

        for (const period of Object.keys(periodMap).sort((a, b) => b.localeCompare(a)).slice(0, 20)) {
            const data = periodMap[period];
            const mainExists = data.result_history ? '✓' : '✗';
            const agentExists = data.draw_records ? '✓' : '✗';
            
            let status = '✅ 同步';
            if (!data.result_history) status = '⚠️  只在代理系統';
            else if (!data.draw_records) status = '❌ 未同步到代理';
            else {
                // 比較結果是否一致
                const mainResult = JSON.stringify(data.result_history.result);
                const agentResult = JSON.stringify(data.draw_records.result);
                if (mainResult !== agentResult) {
                    status = '❌ 結果不一致';
                }
            }
            
            console.log(
                period.padEnd(15) + 
                mainExists.padEnd(25) + 
                agentExists.padEnd(25) + 
                status
            );
        }

        // 2. 檢查同步延遲
        console.log('\n📊 檢查同步延遲：\n');
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
            console.log('最近10期的同步延遲：');
            for (const record of syncDelay) {
                const delayStr = record.delay_seconds 
                    ? `${Math.abs(record.delay_seconds).toFixed(1)} 秒`
                    : '即時';
                console.log(`期號 ${record.period}: ${delayStr}`);
            }
        }

        // 3. 檢查期號生成邏輯
        console.log('\n📊 檢查期號生成邏輯：\n');
        const today = new Date();
        const todayStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}`;
        
        console.log(`今日日期前綴: ${todayStr}`);
        
        // 檢查今日的期號範圍
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
            console.log(`今日總期數: ${todayPeriods[0].count}`);
            
            const expectedCount = parseInt(todayPeriods[0].last_period.toString().slice(-3)) - parseInt(todayPeriods[0].first_period.toString().slice(-3)) + 1;
            if (expectedCount !== todayPeriods[0].count) {
                console.log(`⚠️  期號有跳躍: 預期 ${expectedCount} 期，實際 ${todayPeriods[0].count} 期`);
            }
        }

        // 4. 找出問題根源
        console.log('\n📊 潛在問題分析：\n');
        
        // 檢查未同步的記錄
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
            console.log(`❌ 發現 ${unsyncedRecords.length} 筆未同步到代理系統的記錄：`);
            for (const record of unsyncedRecords.slice(0, 5)) {
                console.log(`   - 期號 ${record.period} (${record.created_at})`);
            }
        }

        // 檢查重複開獎
        const duplicateDraws = await db.any(`
            SELECT period, COUNT(*) as count
            FROM result_history
            GROUP BY period
            HAVING COUNT(*) > 1
            ORDER BY period DESC
            LIMIT 5
        `);

        if (duplicateDraws.length > 0) {
            console.log(`\n⚠️  發現重複開獎記錄：`);
            for (const dup of duplicateDraws) {
                console.log(`   - 期號 ${dup.period}: ${dup.count} 次`);
            }
        }

        // 5. 解決方案建議
        console.log('\n💡 問題總結與解決方案：\n');
        console.log('1. 資料流動路徑:');
        console.log('   backend.js → result_history → (同步API) → draw_records → lottery-website');
        console.log('');
        console.log('2. 可能的問題原因:');
        console.log('   - 同步API調用失敗或延遲');
        console.log('   - 期號生成邏輯在系統重啟時可能出現跳號');
        console.log('   - 並發開獎導致期號混亂');
        console.log('');
        console.log('3. 建議修復方案:');
        console.log('   - 確保同步API的可靠性和重試機制');
        console.log('   - 在期號生成時檢查最後一期，避免跳號');
        console.log('   - 添加分布式鎖防止並發開獎');
        console.log('   - 定期執行資料一致性檢查和修復');

    } catch (error) {
        console.error('❌ 分析失敗:', error);
    } finally {
        process.exit(0);
    }
}

// 執行分析
analyzeDrawResultFlow();