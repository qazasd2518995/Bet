// fix-settlement-logs-table.js - 修复 settlement_logs 表结构

import db from './db/config.js';

async function fixSettlementLogsTable() {
    try {
        console.log('🔧 修复 settlement_logs 表结构...\n');
        
        // 1. 检查表是否存在
        const tableExists = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'settlement_logs'
            );
        `);
        
        if (!tableExists || !tableExists.exists) {
            console.log('❌ settlement_logs 表不存在，开始创建...');
            
            // 创建表
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
            
            // 创建索引
            await db.none(`
                CREATE INDEX idx_settlement_logs_period ON settlement_logs(period);
            `);
            
            await db.none(`
                CREATE INDEX idx_settlement_logs_created_at ON settlement_logs(created_at);
            `);
            
            console.log('✅ settlement_logs 表创建成功');
        } else {
            console.log('✅ settlement_logs 表已存在，检查栏位...');
            
            // 检查是否有 status 栏位
            const hasStatusColumn = await db.oneOrNone(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'settlement_logs' 
                    AND column_name = 'status'
                );
            `);
            
            if (!hasStatusColumn || !hasStatusColumn.exists) {
                console.log('⚠️ 缺少 status 栏位，开始添加...');
                
                // 添加 status 栏位
                await db.none(`
                    ALTER TABLE settlement_logs 
                    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'unknown';
                `);
                
                console.log('✅ status 栏位添加成功');
            } else {
                console.log('✅ status 栏位已存在');
            }
            
            // 检查其他必要栏位
            const columns = await db.many(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'settlement_logs'
                ORDER BY ordinal_position;
            `);
            
            console.log('\n当前表结构：');
            columns.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type}`);
            });
            
            // 确保所有必要栏位都存在
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
                    console.log(`\n⚠️ 缺少 ${colName} 栏位，开始添加...`);
                    
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
                    
                    console.log(`✅ ${colName} 栏位添加成功`);
                }
            }
        }
        
        // 测试插入一条记录
        console.log('\n测试插入记录...');
        await db.none(`
            INSERT INTO settlement_logs (period, status, message, details, created_at)
            VALUES ($1, $2, $3, $4, NOW())
        `, [
            'TEST_' + Date.now(),
            'test',
            '测试记录',
            JSON.stringify({ test: true })
        ]);
        
        console.log('✅ 测试插入成功');
        
        // 删除测试记录
        await db.none(`
            DELETE FROM settlement_logs WHERE status = 'test';
        `);
        
        console.log('✅ 测试记录已删除');
        
        // 显示最近的记录
        const recentLogs = await db.manyOrNone(`
            SELECT * FROM settlement_logs 
            ORDER BY created_at DESC 
            LIMIT 5;
        `);
        
        if (recentLogs && recentLogs.length > 0) {
            console.log('\n最近的结算日志：');
            recentLogs.forEach(log => {
                console.log(`  ${log.period}: ${log.status} - ${log.message}`);
            });
        }
        
        console.log('\n✅ settlement_logs 表修复完成！');
        
    } catch (error) {
        console.error('修复失败:', error);
    } finally {
        process.exit(0);
    }
}

// 执行修复
fixSettlementLogsTable();