// fix-settlement-logs-period-type.js - 修复 settlement_logs 表的 period 栏位类型

import db from './db/config.js';

async function fixSettlementLogsPeriodType() {
    try {
        console.log('🔧 修复 settlement_logs 表的 period 栏位类型...\n');
        
        // 1. 检查当前表结构
        const columns = await db.many(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'settlement_logs'
            ORDER BY ordinal_position;
        `);
        
        console.log('当前表结构：');
        columns.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type}`);
        });
        
        // 2. 备份现有数据
        console.log('\n备份现有数据...');
        const backupData = await db.manyOrNone(`
            SELECT * FROM settlement_logs;
        `);
        console.log(`备份了 ${backupData.length} 条记录`);
        
        // 3. 删除旧表并重建
        console.log('\n重建 settlement_logs 表...');
        
        // 删除旧表
        await db.none(`DROP TABLE IF EXISTS settlement_logs CASCADE;`);
        console.log('✅ 旧表已删除');
        
        // 创建新表（正确的结构）
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
        console.log('✅ 新表已创建');
        
        // 创建索引
        await db.none(`
            CREATE INDEX idx_settlement_logs_period ON settlement_logs(period);
        `);
        
        await db.none(`
            CREATE INDEX idx_settlement_logs_created_at ON settlement_logs(created_at);
        `);
        
        await db.none(`
            CREATE INDEX idx_settlement_logs_status ON settlement_logs(status);
        `);
        
        console.log('✅ 索引已创建');
        
        // 4. 恢复数据（如果有的话）
        if (backupData.length > 0) {
            console.log('\n恢复备份数据...');
            for (const row of backupData) {
                try {
                    // 构建详情对象
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
                    
                    // 构建讯息
                    let message = row.message || `结算完成: ${row.settled_count || 0}笔`;
                    
                    // 插入数据
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
                    console.error(`恢复记录失败 (期号 ${row.period}):`, err.message);
                }
            }
            console.log('✅ 数据恢复完成');
        }
        
        // 5. 测试新表
        console.log('\n测试新表...');
        
        // 测试插入
        await db.none(`
            INSERT INTO settlement_logs (period, status, message, details)
            VALUES ($1, $2, $3, $4)
        `, [
            '20250717999',
            'test',
            '测试记录',
            JSON.stringify({ test: true, timestamp: new Date().toISOString() })
        ]);
        console.log('✅ 测试插入成功');
        
        // 测试查询
        const testRecord = await db.oneOrNone(`
            SELECT * FROM settlement_logs WHERE status = 'test';
        `);
        
        if (testRecord) {
            console.log('✅ 测试查询成功');
            console.log(`  期号: ${testRecord.period}`);
            console.log(`  状态: ${testRecord.status}`);
            console.log(`  讯息: ${testRecord.message}`);
        }
        
        // 删除测试记录
        await db.none(`
            DELETE FROM settlement_logs WHERE status = 'test';
        `);
        console.log('✅ 测试记录已删除');
        
        // 6. 显示最终表结构
        const finalColumns = await db.many(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'settlement_logs'
            ORDER BY ordinal_position;
        `);
        
        console.log('\n最终表结构：');
        finalColumns.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
        });
        
        // 显示记录数
        const count = await db.one(`
            SELECT COUNT(*) as count FROM settlement_logs;
        `);
        console.log(`\n总记录数: ${count.count}`);
        
        console.log('\n✅ settlement_logs 表修复完成！');
        
    } catch (error) {
        console.error('修复失败:', error);
    } finally {
        process.exit(0);
    }
}

// 执行修复
fixSettlementLogsPeriodType();