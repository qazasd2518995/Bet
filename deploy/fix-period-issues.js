import pg from 'pg';
import config from './db/config.js';

const { Pool } = pg;
const pool = new Pool(config);

async function fixPeriodIssues() {
    console.log('🔧 修复期号问题\n');
    
    try {
        // 1. 检查并删除异常长度的期号
        console.log('📊 检查异常期号:');
        const abnormalPeriods = await pool.query(`
            SELECT period, draw_time, LENGTH(period::text) as len
            FROM draw_records
            WHERE LENGTH(period::text) != 11
            ORDER BY draw_time DESC
            LIMIT 20
        `);
        
        if (abnormalPeriods.rows.length > 0) {
            console.log(`发现 ${abnormalPeriods.rows.length} 笔异常期号:`);
            abnormalPeriods.rows.forEach(row => {
                console.log(`- 期号: ${row.period} (长度: ${row.len})`);
            });
            
            // 删除异常期号
            const deleteResult = await pool.query(`
                DELETE FROM draw_records
                WHERE LENGTH(period::text) != 11
            `);
            console.log(`✅ 已删除 ${deleteResult.rowCount} 笔异常期号记录\n`);
        } else {
            console.log('✅ 没有发现异常期号\n');
        }
        
        // 2. 检查最新的同步状态
        console.log('📊 检查最新同步状态:');
        const syncStatus = await pool.query(`
            SELECT 
                rh.period::text as main_period,
                rh.result as main_result,
                dr.period as agent_period,
                dr.result as agent_result,
                rh.created_at
            FROM result_history rh
            LEFT JOIN draw_records dr ON rh.period::text = dr.period
            WHERE rh.period IS NOT NULL
            ORDER BY rh.created_at DESC
            LIMIT 10
        `);
        
        let unsyncedCount = 0;
        syncStatus.rows.forEach(row => {
            if (!row.agent_period) {
                console.log(`❌ 期号 ${row.main_period}: 未同步到代理系统`);
                unsyncedCount++;
            } else if (JSON.stringify(row.main_result) !== JSON.stringify(row.agent_result)) {
                console.log(`❌ 期号 ${row.main_period}: 结果不一致`);
                unsyncedCount++;
            } else {
                console.log(`✅ 期号 ${row.main_period}: 已同步`);
            }
        });
        
        if (unsyncedCount > 0) {
            console.log(`\n⚠️  发现 ${unsyncedCount} 笔未同步或不一致的记录`);
            console.log('建议重启游戏服务以确保同步机制正常运作');
        } else {
            console.log('\n✅ 所有记录都已正确同步');
        }
        
        // 3. 验证 v_api_recent_draws 视图
        console.log('\n📊 验证 API 视图资料:');
        const apiView = await pool.query(`
            SELECT period, result
            FROM v_api_recent_draws
            LIMIT 5
        `);
        
        console.log('API 视图返回的最新5笔资料:');
        apiView.rows.forEach(row => {
            console.log(`期号: ${row.period}, 结果: [${row.result.join(',')}]`);
        });
        
        // 4. 总结
        console.log('\n📊 资料总结:');
        const summary = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM result_history WHERE period IS NOT NULL) as main_count,
                (SELECT COUNT(*) FROM draw_records WHERE LENGTH(period::text) = 11) as agent_count,
                (SELECT MAX(period::text) FROM result_history WHERE period IS NOT NULL) as latest_period
        `);
        
        const row = summary.rows[0];
        console.log(`主系统记录数: ${row.main_count}`);
        console.log(`代理系统记录数: ${row.agent_count}`);
        console.log(`最新期号: ${row.latest_period}`);
        console.log(`同步差异: ${row.main_count - row.agent_count} 笔`);
        
    } catch (error) {
        console.error('修复过程发生错误:', error.message);
    } finally {
        await pool.end();
    }
}

fixPeriodIssues().catch(console.error);