// 修复触发器类型错误
import db from './db/config.js';

async function fixTriggerTypeError() {
    console.log('🔧 修复触发器函数类型错误\n');

    try {
        // 1. 删除旧的触发器
        console.log('📌 步骤1：删除旧的触发器和函数...');
        await db.none('DROP TRIGGER IF EXISTS auto_sync_recent_draws_trigger ON result_history');
        await db.none('DROP FUNCTION IF EXISTS auto_sync_recent_draws()');
        console.log('✅ 旧的触发器和函数已删除');

        // 2. 创建修正后的函数
        console.log('\n📌 步骤2：创建修正后的触发器函数...');
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
                    
                    -- 插入或更新到 recent_draws（确保 period 类型转换）
                    INSERT INTO recent_draws (
                        period, result,
                        position_1, position_2, position_3, position_4, position_5,
                        position_6, position_7, position_8, position_9, position_10,
                        draw_time
                    )
                    VALUES (
                        NEW.period::bigint, NEW.result,
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
        console.log('✅ 新的触发器函数创建成功');

        // 3. 创建触发器
        console.log('\n📌 步骤3：创建触发器...');
        await db.none(`
            CREATE TRIGGER auto_sync_recent_draws_trigger
            AFTER INSERT OR UPDATE ON result_history
            FOR EACH ROW
            EXECUTE FUNCTION auto_sync_recent_draws()
        `);
        console.log('✅ 触发器创建成功');

        // 4. 测试触发器
        console.log('\n📌 步骤4：测试触发器功能...');
        
        // 插入测试记录
        const testPeriod = '20250718888';
        console.log(`插入测试记录，期号：${testPeriod}`);
        
        try {
            await db.none(`
                INSERT INTO result_history (
                    period, result,
                    position_1, position_2, position_3, position_4, position_5,
                    position_6, position_7, position_8, position_9, position_10,
                    draw_time, created_at
                ) VALUES (
                    $1, $2::jsonb,
                    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
                    NOW(), NOW()
                )
            `, [testPeriod, JSON.stringify([1,2,3,4,5,6,7,8,9,10])]);
            
            // 检查是否同步成功
            const syncedRecord = await db.oneOrNone(
                'SELECT * FROM recent_draws WHERE period = $1',
                [parseInt(testPeriod)]
            );
            
            if (syncedRecord) {
                console.log('✅ 触发器测试成功，新记录已同步');
                
                // 检查记录数
                const count = await db.one('SELECT COUNT(*) FROM recent_draws');
                console.log(`recent_draws 表目前有 ${count.count} 笔记录`);
            } else {
                console.log('❌ 触发器测试失败');
            }
            
            // 清理测试数据
            await db.none('DELETE FROM result_history WHERE period = $1', [testPeriod]);
            await db.none('DELETE FROM recent_draws WHERE period = $1', [parseInt(testPeriod)]);
            console.log('测试数据已清理');
            
        } catch (err) {
            console.error('测试过程出错：', err.message);
        }

        console.log('\n✅ 触发器修复完成！');
        console.log('系统现在会自动维护最新10期开奖记录');

    } catch (error) {
        console.error('修复失败：', error);
        throw error;
    }
}

// 执行修复
fixTriggerTypeError().then(() => {
    console.log('\n✅ 所有操作完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});