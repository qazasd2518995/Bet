// 自动同步近期开奖记录 - 完整解决方案
import db from './db/config.js';

async function fixRecentDrawsAutoSync() {
    console.log('🔧 设置自动同步近期开奖记录（保持最新10期）\n');

    try {
        // 1. 创建 recent_draws 表
        console.log('📌 步骤1：创建 recent_draws 表...');
        await db.none(`
            CREATE TABLE IF NOT EXISTS recent_draws (
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT valid_period CHECK (LENGTH(period::text) = 11)
            );
        `);
        
        // 创建索引
        await db.none(`
            CREATE INDEX IF NOT EXISTS idx_recent_draws_period ON recent_draws(period DESC);
            CREATE INDEX IF NOT EXISTS idx_recent_draws_draw_time ON recent_draws(draw_time DESC);
        `);
        
        console.log('✅ recent_draws 表创建成功');

        // 2. 清理 result_history 中的无效数据
        console.log('\n📌 步骤2：清理无效开奖记录...');
        
        // 删除结果为空或期号格式错误的记录
        const deletedInvalid = await db.result(`
            DELETE FROM result_history 
            WHERE result IS NULL 
            OR position_1 IS NULL 
            OR LENGTH(period::text) != 11
            RETURNING period
        `);
        console.log(`删除了 ${deletedInvalid.rowCount} 笔无效记录`);

        // 3. 初始化 recent_draws 表
        console.log('\n📌 步骤3：初始化 recent_draws 表...');
        
        // 清空表
        await db.none('TRUNCATE TABLE recent_draws');
        
        // 插入最新10笔有效记录
        await db.none(`
            INSERT INTO recent_draws (
                period, result,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                draw_time
            )
            SELECT 
                period::bigint, result,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                draw_time
            FROM result_history
            WHERE result IS NOT NULL
            AND position_1 IS NOT NULL
            AND LENGTH(period::text) = 11
            ORDER BY period::bigint DESC
            LIMIT 10
        `);
        
        const count = await db.one('SELECT COUNT(*) FROM recent_draws');
        console.log(`✅ 初始化完成，已同步 ${count.count} 笔记录`);

        // 4. 创建自动维护函数
        console.log('\n📌 步骤4：创建自动维护函数...');
        
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
        
        console.log('✅ 自动维护函数创建成功');

        // 5. 创建触发器
        console.log('\n📌 步骤5：创建自动同步触发器...');
        
        await db.none(`
            DROP TRIGGER IF EXISTS auto_sync_recent_draws_trigger ON result_history;
            
            CREATE TRIGGER auto_sync_recent_draws_trigger
            AFTER INSERT OR UPDATE ON result_history
            FOR EACH ROW
            EXECUTE FUNCTION auto_sync_recent_draws();
        `);
        
        console.log('✅ 触发器创建成功');

        // 6. 创建优化的 API 视图
        console.log('\n📌 步骤6：创建 API 视图...');
        
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
        
        console.log('✅ API 视图创建成功');

        // 7. 验证结果
        console.log('\n📊 验证最新10期记录：');
        const recentDraws = await db.manyOrNone(`
            SELECT * FROM v_api_recent_draws
        `);
        
        recentDraws.forEach((draw) => {
            console.log(`${draw.row_num}. 期号：${draw.period} | 时间：${draw.formatted_time} | 第1名：${draw.position_1} | 第5名：${draw.position_5} | 第10名：${draw.position_10}`);
        });

        // 8. 提供 API 更新建议
        console.log('\n💡 后端 API 更新建议：');
        console.log('在 backend.js 中修改 /api/recent-results 端点：');
        console.log(`
// 方法1：使用 recent_draws 表
app.get('/api/recent-results', async (req, res) => {
    try {
        const results = await db.manyOrNone(\`
            SELECT * FROM v_api_recent_draws
        \`);
        
        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('获取近期开奖记录失败：', error);
        res.status(500).json({
            success: false,
            message: '获取近期开奖记录失败'
        });
    }
});

// 方法2：修改现有 /api/history 端点
// 在查询中加入有效性检查
const validConditions = "result IS NOT NULL AND position_1 IS NOT NULL AND LENGTH(period::text) = 11";
`);

        console.log('\n✅ 自动同步系统设置完成！');
        console.log('系统将自动维护最新10期开奖记录');
        console.log('每次新增开奖时会自动更新');

    } catch (error) {
        console.error('设置失败：', error);
        throw error;
    }
}

// 执行设置
fixRecentDrawsAutoSync().then(() => {
    console.log('\n✅ 所有设置完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});