// 修复 recent_draws 表的 period 栏位类型
import db from './db/config.js';

async function fixRecentDrawsColumnType() {
    console.log('🔧 修复 recent_draws 表的 period 栏位类型\n');

    try {
        // 1. 删除旧的触发器
        console.log('📌 步骤1：暂时停用触发器...');
        await db.none('DROP TRIGGER IF EXISTS auto_sync_recent_draws_trigger ON result_history');
        console.log('✅ 触发器已暂时停用');

        // 2. 备份现有数据
        console.log('\n📌 步骤2：备份现有数据...');
        const backupData = await db.manyOrNone('SELECT * FROM recent_draws');
        console.log(`备份了 ${backupData.length} 笔记录`);

        // 3. 删除旧表
        console.log('\n📌 步骤3：重建 recent_draws 表...');
        await db.none('DROP TABLE IF EXISTS recent_draws CASCADE');
        
        // 4. 创建新表（period 使用 BIGINT）
        await db.none(`
            CREATE TABLE recent_draws (
                id SERIAL PRIMARY KEY,
                period BIGINT UNIQUE NOT NULL,
                result JSONB,
                position_1 INTEGER,
                position_2 INTEGER,
                position_3 INTEGER,
                position_4 INTEGER,
                position_5 INTEGER,
                position_6 INTEGER,
                position_7 INTEGER,
                position_8 INTEGER,
                position_9 INTEGER,
                position_10 INTEGER,
                draw_time TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 创建索引
        await db.none(`
            CREATE INDEX idx_recent_draws_period ON recent_draws(period DESC);
            CREATE INDEX idx_recent_draws_draw_time ON recent_draws(draw_time DESC);
        `);
        
        console.log('✅ 新表创建成功（period 使用 BIGINT）');

        // 5. 还原数据
        console.log('\n📌 步骤4：还原数据...');
        for (const record of backupData) {
            await db.none(`
                INSERT INTO recent_draws (
                    period, result,
                    position_1, position_2, position_3, position_4, position_5,
                    position_6, position_7, position_8, position_9, position_10,
                    draw_time, created_at
                ) VALUES (
                    $1, $2,
                    $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12,
                    $13, $14
                )
            `, [
                parseInt(record.period), // 确保转换为整数
                record.result,
                record.position_1, record.position_2, record.position_3, record.position_4, record.position_5,
                record.position_6, record.position_7, record.position_8, record.position_9, record.position_10,
                record.draw_time, record.created_at
            ]);
        }
        console.log(`✅ 还原了 ${backupData.length} 笔记录`);

        // 6. 重新创建视图
        console.log('\n📌 步骤5：重新创建视图...');
        await db.none(`
            CREATE OR REPLACE VIEW v_api_recent_draws AS
            SELECT 
                period::text as period,
                result,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                draw_time,
                TO_CHAR(draw_time AT TIME ZONE 'Asia/Shanghai', 'MM-DD HH24:MI') as formatted_time,
                ROW_NUMBER() OVER (ORDER BY period DESC) as row_num
            FROM recent_draws
            ORDER BY period DESC;
        `);
        console.log('✅ 视图重新创建成功');

        // 7. 重新创建触发器函数（确保类型匹配）
        console.log('\n📌 步骤6：重新创建触发器函数...');
        await db.none('DROP FUNCTION IF EXISTS auto_sync_recent_draws()');
        await db.none(`
            CREATE OR REPLACE FUNCTION auto_sync_recent_draws()
            RETURNS TRIGGER AS $$
            DECLARE
                min_period BIGINT;
            BEGIN
                -- 只处理有效的新记录
                IF NEW.result IS NOT NULL 
                   AND NEW.position_1 IS NOT NULL 
                   AND LENGTH(NEW.period::text) = 11 THEN
                    
                    -- 插入或更新到 recent_draws
                    INSERT INTO recent_draws (
                        period, result,
                        position_1, position_2, position_3, position_4, position_5,
                        position_6, position_7, position_8, position_9, position_10,
                        draw_time
                    )
                    VALUES (
                        NEW.period, NEW.result,
                        NEW.position_1, NEW.position_2, NEW.position_3, NEW.position_4, NEW.position_5,
                        NEW.position_6, NEW.position_7, NEW.position_8, NEW.position_9, NEW.position_10,
                        NEW.draw_time
                    )
                    ON CONFLICT (period) DO UPDATE SET
                        result = EXCLUDED.result,
                        position_1 = EXCLUDED.position_1,
                        position_2 = EXCLUDED.position_2,
                        position_3 = EXCLUDED.position_3,
                        position_4 = EXCLUDED.position_4,
                        position_5 = EXCLUDED.position_5,
                        position_6 = EXCLUDED.position_6,
                        position_7 = EXCLUDED.position_7,
                        position_8 = EXCLUDED.position_8,
                        position_9 = EXCLUDED.position_9,
                        position_10 = EXCLUDED.position_10,
                        draw_time = EXCLUDED.draw_time;
                    
                    -- 获取第10笔记录的期号
                    SELECT period INTO min_period
                    FROM recent_draws
                    ORDER BY period DESC
                    LIMIT 1 OFFSET 9;
                    
                    -- 删除超过10笔的旧记录
                    IF min_period IS NOT NULL THEN
                        DELETE FROM recent_draws
                        WHERE period < min_period;
                    END IF;
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        // 8. 重新创建触发器
        await db.none(`
            CREATE TRIGGER auto_sync_recent_draws_trigger
            AFTER INSERT OR UPDATE ON result_history
            FOR EACH ROW
            EXECUTE FUNCTION auto_sync_recent_draws()
        `);
        console.log('✅ 触发器重新创建成功');

        // 9. 验证
        console.log('\n📌 步骤7：验证修复结果...');
        const finalCount = await db.one('SELECT COUNT(*) FROM recent_draws');
        console.log(`recent_draws 表最终有 ${finalCount.count} 笔记录`);
        
        // 检查数据类型
        const columnInfo = await db.one(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'recent_draws' 
            AND column_name = 'period'
        `);
        console.log(`period 栏位类型：${columnInfo.data_type}`);

        console.log('\n✅ 修复完成！');
        console.log('recent_draws.period 现在使用 BIGINT 类型');
        console.log('触发器已重新启用，系统将自动维护最新10期记录');

    } catch (error) {
        console.error('修复失败：', error);
        throw error;
    }
}

// 执行修复
fixRecentDrawsColumnType().then(() => {
    console.log('\n✅ 所有操作完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});