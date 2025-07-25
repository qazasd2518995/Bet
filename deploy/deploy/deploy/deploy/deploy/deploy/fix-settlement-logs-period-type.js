// fix-settlement-logs-period-type.js - 修復 settlement_logs 表的 period 欄位類型

import db from './db/config.js';

async function fixSettlementLogsPeriodType() {
    try {
        console.log('🔧 修復 settlement_logs 表的 period 欄位類型...\n');
        
        // 1. 檢查當前表結構
        const columns = await db.many(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'settlement_logs'
            ORDER BY ordinal_position;
        `);
        
        console.log('當前表結構：');
        columns.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });
        
        // 2. 備份現有數據
        console.log('\n備份現有數據...');
        const backupData = await db.manyOrNone(`
            SELECT * FROM settlement_logs;
        `);
        console.log(`備份了 ${backupData.length} 條記錄`);
        
        // 3. 刪除舊表並重建
        console.log('\n重建 settlement_logs 表...');
        
        // 刪除舊表
        await db.none(`DROP TABLE IF EXISTS settlement_logs CASCADE;`);
        console.log('✅ 舊表已刪除');
        
        // 創建新表（正確的結構）
        await db.none(`
            CREATE TABLE settlement_logs (
                id SERIAL PRIMARY KEY,
                period VARCHAR(20) NOT NULL,
                status VARCHAR(20) NOT NULL,
                message TEXT,
                details JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('✅ 新表已創建');
        
        // 創建索引
        await db.none(`
            CREATE INDEX idx_settlement_logs_period ON settlement_logs(period);
        `);
        
        await db.none(`
            CREATE INDEX idx_settlement_logs_created_at ON settlement_logs(created_at);
        `);
        
        await db.none(`
            CREATE INDEX idx_settlement_logs_status ON settlement_logs(status);
        `);
        
        console.log('✅ 索引已創建');
        
        // 4. 恢復數據（如果有的話）
        if (backupData.length > 0) {
            console.log('\n恢復備份數據...');
            for (const row of backupData) {
                try {
                    // 構建詳情對象
                    let details = {};
                    if (row.settlement_details) {
                        details = row.settlement_details;
                    }
                    if (row.settled_count !== undefined) {
                        details.settled_count = row.settled_count;
                    }
                    if (row.total_win_amount !== undefined) {
                        details.total_win_amount = row.total_win_amount;
                    }
                    
                    // 構建訊息
                    let message = row.message || `結算完成: ${row.settled_count || 0}筆`;
                    
                    // 插入數據
                    await db.none(`
                        INSERT INTO settlement_logs (period, status, message, details, created_at)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [
                        row.period.toString(),
                        row.status || 'success',
                        message,
                        JSON.stringify(details),
                        row.created_at
                    ]);
                } catch (err) {
                    console.error(`恢復記錄失敗 (期號 ${row.period}):`, err.message);
                }
            }
            console.log('✅ 數據恢復完成');
        }
        
        // 5. 測試新表
        console.log('\n測試新表...');
        
        // 測試插入
        await db.none(`
            INSERT INTO settlement_logs (period, status, message, details)
            VALUES ($1, $2, $3, $4)
        `, [
            '20250717999',
            'test',
            '測試記錄',
            JSON.stringify({ test: true, timestamp: new Date().toISOString() })
        ]);
        console.log('✅ 測試插入成功');
        
        // 測試查詢
        const testRecord = await db.oneOrNone(`
            SELECT * FROM settlement_logs WHERE status = 'test';
        `);
        
        if (testRecord) {
            console.log('✅ 測試查詢成功');
            console.log(`  期號: ${testRecord.period}`);
            console.log(`  狀態: ${testRecord.status}`);
            console.log(`  訊息: ${testRecord.message}`);
        }
        
        // 刪除測試記錄
        await db.none(`
            DELETE FROM settlement_logs WHERE status = 'test';
        `);
        console.log('✅ 測試記錄已刪除');
        
        // 6. 顯示最終表結構
        const finalColumns = await db.many(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'settlement_logs'
            ORDER BY ordinal_position;
        `);
        
        console.log('\n最終表結構：');
        finalColumns.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
        });
        
        // 顯示記錄數
        const count = await db.one(`
            SELECT COUNT(*) as count FROM settlement_logs;
        `);
        console.log(`\n總記錄數: ${count.count}`);
        
        console.log('\n✅ settlement_logs 表修復完成！');
        
    } catch (error) {
        console.error('修復失敗:', error);
    } finally {
        process.exit(0);
    }
}

// 執行修復
fixSettlementLogsPeriodType();