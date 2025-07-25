import db from './db/config.js';

async function checkTableStructureIssue() {
    try {
        console.log('=== 檢查資料庫表結構問題 ===\n');
        
        // 1. 檢查 transaction_records 表結構
        console.log('1. 檢查 transaction_records 表結構...');
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
        
        console.log('transaction_records 表結構:');
        tableStructure.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type}, nullable: ${col.is_nullable}, default: ${col.column_default || 'N/A'}`);
        });
        
        // 2. 檢查 period 欄位的數據類型問題
        console.log('\n2. 檢查 period 欄位的數據類型...');
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
        
        console.log('各表的 period 欄位類型:');
        periodTypeCheck.forEach(type => {
            console.log(`  ${type.tr_period_type || type.bh_period_type || type.rh_period_type}`);
        });
        
        // 3. 嘗試重現錯誤的查詢
        console.log('\n3. 測試問題查詢...');
        try {
            const testQuery = await db.any(`
                SELECT COUNT(*) as count
                FROM transaction_records
                WHERE period = 20250716154 AND transaction_type = 'rebate'
            `);
            console.log('✅ 查詢成功:', testQuery);
        } catch (error) {
            console.log('❌ 查詢失敗:', error.message);
            
            // 嘗試使用字符串比較
            try {
                const testQuery2 = await db.any(`
                    SELECT COUNT(*) as count
                    FROM transaction_records
                    WHERE period = '20250716154' AND transaction_type = 'rebate'
                `);
                console.log('✅ 使用字符串查詢成功:', testQuery2);
            } catch (error2) {
                console.log('❌ 字符串查詢也失敗:', error2.message);
            }
        }
        
        // 4. 檢查最近的數據類型
        console.log('\n4. 檢查最近期數的數據類型...');
        const recentPeriods = await db.any(`
            SELECT period, pg_typeof(period) as period_type
            FROM transaction_records
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        console.log('最近的期數數據類型:');
        recentPeriods.forEach(p => {
            console.log(`  期號: ${p.period}, 類型: ${p.period_type}`);
        });
        
        // 5. 檢查是否有修復腳本
        console.log('\n5. 檢查是否需要修復 period 欄位類型...');
        
        // 檢查 bet_history 的 period 類型
        const betHistoryPeriodType = await db.one(`
            SELECT data_type
            FROM information_schema.columns 
            WHERE table_name = 'bet_history' AND column_name = 'period'
        `);
        
        // 檢查 transaction_records 的 period 類型  
        const transactionPeriodType = await db.one(`
            SELECT data_type
            FROM information_schema.columns 
            WHERE table_name = 'transaction_records' AND column_name = 'period'
        `);
        
        console.log(`bet_history.period 類型: ${betHistoryPeriodType.data_type}`);
        console.log(`transaction_records.period 類型: ${transactionPeriodType.data_type}`);
        
        if (betHistoryPeriodType.data_type !== transactionPeriodType.data_type) {
            console.log('⚠️ 發現期號欄位類型不匹配！這會導致 JOIN 和比較操作失敗');
            console.log('需要統一期號欄位的數據類型');
        } else {
            console.log('✅ 期號欄位類型匹配');
        }
        
    } catch (error) {
        console.error('錯誤:', error);
    } finally {
        process.exit(0);
    }
}

checkTableStructureIssue();