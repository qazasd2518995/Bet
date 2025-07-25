import db from './db/config.js';

async function checkTableStructureIssue() {
    try {
        console.log('=== 检查资料库表结构问题 ===\n');
        
        // 1. 检查 transaction_records 表结构
        console.log('1. 检查 transaction_records 表结构...');
        const tableStructure = await db.any(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable, 
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'transaction_records' 
            ORDER BY ordinal_position
        `);
        
        console.log('transaction_records 表结构:');
        tableStructure.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}, nullable: ${col.is_nullable}, default: ${col.column_default || 'N/A'}`);
        });
        
        // 2. 检查 period 栏位的数据类型问题
        console.log('\n2. 检查 period 栏位的数据类型...');
        const periodTypeCheck = await db.any(`
            SELECT DISTINCT 
                data_type as tr_period_type
            FROM information_schema.columns 
            WHERE table_name = 'transaction_records' AND column_name = 'period'
            
            UNION ALL
            
            SELECT DISTINCT 
                data_type as bh_period_type
            FROM information_schema.columns 
            WHERE table_name = 'bet_history' AND column_name = 'period'
            
            UNION ALL
            
            SELECT DISTINCT 
                data_type as rh_period_type
            FROM information_schema.columns 
            WHERE table_name = 'result_history' AND column_name = 'period'
        `);
        
        console.log('各表的 period 栏位类型:');
        periodTypeCheck.forEach(type => {
            console.log(`  ${type.tr_period_type || type.bh_period_type || type.rh_period_type}`);
        });
        
        // 3. 尝试重现错误的查询
        console.log('\n3. 测试问题查询...');
        try {
            const testQuery = await db.any(`
                SELECT COUNT(*) as count
                FROM transaction_records
                WHERE period = 20250716154 AND transaction_type = 'rebate'
            `);
            console.log('✅ 查询成功:', testQuery);
        } catch (error) {
            console.log('❌ 查询失败:', error.message);
            
            // 尝试使用字符串比较
            try {
                const testQuery2 = await db.any(`
                    SELECT COUNT(*) as count
                    FROM transaction_records
                    WHERE period = '20250716154' AND transaction_type = 'rebate'
                `);
                console.log('✅ 使用字符串查询成功:', testQuery2);
            } catch (error2) {
                console.log('❌ 字符串查询也失败:', error2.message);
            }
        }
        
        // 4. 检查最近的数据类型
        console.log('\n4. 检查最近期数的数据类型...');
        const recentPeriods = await db.any(`
            SELECT period, pg_typeof(period) as period_type
            FROM transaction_records
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        console.log('最近的期数数据类型:');
        recentPeriods.forEach(p => {
            console.log(`  期号: ${p.period}, 类型: ${p.period_type}`);
        });
        
        // 5. 检查是否有修复脚本
        console.log('\n5. 检查是否需要修复 period 栏位类型...');
        
        // 检查 bet_history 的 period 类型
        const betHistoryPeriodType = await db.one(`
            SELECT data_type
            FROM information_schema.columns 
            WHERE table_name = 'bet_history' AND column_name = 'period'
        `);
        
        // 检查 transaction_records 的 period 类型  
        const transactionPeriodType = await db.one(`
            SELECT data_type
            FROM information_schema.columns 
            WHERE table_name = 'transaction_records' AND column_name = 'period'
        `);
        
        console.log(`bet_history.period 类型: ${betHistoryPeriodType.data_type}`);
        console.log(`transaction_records.period 类型: ${transactionPeriodType.data_type}`);
        
        if (betHistoryPeriodType.data_type !== transactionPeriodType.data_type) {
            console.log('⚠️ 发现期号栏位类型不匹配！这会导致 JOIN 和比较操作失败');
            console.log('需要统一期号栏位的数据类型');
        } else {
            console.log('✅ 期号栏位类型匹配');
        }
        
    } catch (error) {
        console.error('错误:', error);
    } finally {
        process.exit(0);
    }
}

checkTableStructureIssue();