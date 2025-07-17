// fix-settlement-logs-table.js - 修復 settlement_logs 表結構

import db from './db/config.js';

async function fixSettlementLogsTable() {
    try {
        console.log('🔧 修復 settlement_logs 表結構...\n');
        
        // 1. 檢查表是否存在
        const tableExists = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'settlement_logs'
            );
        `);
        
        if (!tableExists || !tableExists.exists) {
            console.log('❌ settlement_logs 表不存在，開始創建...');
            
            // 創建表
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
            
            // 創建索引
            await db.none(`
                CREATE INDEX idx_settlement_logs_period ON settlement_logs(period);
            `);
            
            await db.none(`
                CREATE INDEX idx_settlement_logs_created_at ON settlement_logs(created_at);
            `);
            
            console.log('✅ settlement_logs 表創建成功');
        } else {
            console.log('✅ settlement_logs 表已存在，檢查欄位...');
            
            // 檢查是否有 status 欄位
            const hasStatusColumn = await db.oneOrNone(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'settlement_logs' 
                    AND column_name = 'status'
                );
            `);
            
            if (!hasStatusColumn || !hasStatusColumn.exists) {
                console.log('⚠️ 缺少 status 欄位，開始添加...');
                
                // 添加 status 欄位
                await db.none(`
                    ALTER TABLE settlement_logs 
                    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'unknown';
                `);
                
                console.log('✅ status 欄位添加成功');
            } else {
                console.log('✅ status 欄位已存在');
            }
            
            // 檢查其他必要欄位
            const columns = await db.many(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'settlement_logs'
                ORDER BY ordinal_position;
            `);
            
            console.log('\n當前表結構：');
            columns.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type}`);
            });
            
            // 確保所有必要欄位都存在
            const requiredColumns = {
                'period': 'VARCHAR(20)',
                'status': 'VARCHAR(20)',
                'message': 'TEXT',
                'details': 'JSONB',
                'created_at': 'TIMESTAMP'
            };
            
            for (const [colName, colType] of Object.entries(requiredColumns)) {
                const exists = columns.some(col => col.column_name === colName);
                if (!exists) {
                    console.log(`\n⚠️ 缺少 ${colName} 欄位，開始添加...`);
                    
                    let defaultValue = '';
                    if (colName === 'created_at') {
                        defaultValue = 'DEFAULT NOW()';
                    } else if (colName === 'status') {
                        defaultValue = "NOT NULL DEFAULT 'unknown'";
                    } else if (colName === 'period') {
                        defaultValue = "NOT NULL DEFAULT ''";
                    }
                    
                    await db.none(`
                        ALTER TABLE settlement_logs 
                        ADD COLUMN IF NOT EXISTS ${colName} ${colType} ${defaultValue};
                    `);
                    
                    console.log(`✅ ${colName} 欄位添加成功`);
                }
            }
        }
        
        // 測試插入一條記錄
        console.log('\n測試插入記錄...');
        await db.none(`
            INSERT INTO settlement_logs (period, status, message, details, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [
            'TEST_' + Date.now(),
            'test',
            '測試記錄',
            JSON.stringify({ test: true })
        ]);
        
        console.log('✅ 測試插入成功');
        
        // 刪除測試記錄
        await db.none(`
            DELETE FROM settlement_logs WHERE status = 'test';
        `);
        
        console.log('✅ 測試記錄已刪除');
        
        // 顯示最近的記錄
        const recentLogs = await db.manyOrNone(`
            SELECT * FROM settlement_logs 
            ORDER BY created_at DESC 
            LIMIT 5;
        `);
        
        if (recentLogs && recentLogs.length > 0) {
            console.log('\n最近的結算日誌：');
            recentLogs.forEach(log => {
                console.log(`  ${log.period}: ${log.status} - ${log.message}`);
            });
        }
        
        console.log('\n✅ settlement_logs 表修復完成！');
        
    } catch (error) {
        console.error('修復失敗:', error);
    } finally {
        process.exit(0);
    }
}

// 執行修復
fixSettlementLogsTable();