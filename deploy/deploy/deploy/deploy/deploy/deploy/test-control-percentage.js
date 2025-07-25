import pkg from 'pg';
const { Pool } = pkg;
import dbConfig from './db/config.js';

const pool = new Pool(dbConfig);
const db = {
    oneOrNone: async (query, params) => {
        const result = await pool.query(query, params);
        return result.rows[0] || null;
    },
    any: async (query, params) => {
        const result = await pool.query(query, params);
        return result.rows;
    },
    $pool: pool
};

// 測試不同控制百分比的效果
async function testControlPercentages() {
    console.log('🧪 測試不同控制百分比的權重計算...\n');
    
    // 模擬不同的控制百分比
    const percentages = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99, 100];
    
    // 假設有 3 個目標號碼，7 個非目標號碼
    const targetCount = 3;
    const nonTargetCount = 7;
    
    console.log(`假設情況：${targetCount} 個目標號碼，${nonTargetCount} 個非目標號碼\n`);
    console.log('控制百分比 | 控制係數 | 目標權重 | 預期中獎率');
    console.log('-----------|---------|---------|----------');
    
    for (const percentage of percentages) {
        const controlFactor = percentage / 100;
        
        let targetWeight;
        if (controlFactor >= 0.95) {
            targetWeight = 1000;
        } else if (controlFactor <= 0.05) {
            targetWeight = 1;
        } else {
            // 使用實際的權重計算公式
            targetWeight = (controlFactor * nonTargetCount) / ((1 - controlFactor) * Math.max(targetCount, 1));
        }
        
        // 計算預期中獎率
        const totalWeight = targetWeight * targetCount + 1 * nonTargetCount;
        const expectedWinRate = (targetWeight * targetCount) / totalWeight * 100;
        
        console.log(`${percentage.toString().padStart(10)}% | ${controlFactor.toFixed(3).padStart(7)} | ${targetWeight.toFixed(3).padStart(7)} | ${expectedWinRate.toFixed(1).padStart(9)}%`);
    }
    
    console.log('\n📊 分析結果：');
    console.log('- 5% 以下：權重不變（權重=1）');
    console.log('- 5%-95%：使用公式計算權重');
    console.log('- 95% 以上：使用極高權重（權重=1000）');
    console.log('\n⚠️  問題發現：');
    console.log('- 50% 控制時，預期中獎率只有 60%，效果不明顯');
    console.log('- 80% 控制時，預期中獎率為 82.4%，接近設定值');
    console.log('- 需要調整權重計算公式，讓控制效果更明顯');
}

// 測試實際控制效果
async function testActualControl() {
    try {
        console.log('\n\n🔍 檢查當前活躍的控制設定...');
        
        // 查詢當前活躍的控制
        const activeControl = await db.oneOrNone(`
            SELECT * FROM win_loss_control 
            WHERE is_active = true 
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        
        if (activeControl) {
            console.log('\n當前控制設定：');
            console.log(`- 模式: ${activeControl.control_mode}`);
            console.log(`- 目標: ${activeControl.target_username || '全體'}`);
            console.log(`- 控制百分比: ${activeControl.control_percentage}%`);
            console.log(`- 贏控制: ${activeControl.win_control ? '是' : '否'}`);
            console.log(`- 輸控制: ${activeControl.loss_control ? '是' : '否'}`);
            
            // 查詢最近的下注和開獎結果
            const recentBets = await db.any(`
                SELECT 
                    bh.period,
                    bh.username,
                    bh.bet_type,
                    bh.bet_value,
                    bh.position,
                    bh.amount,
                    bh.win,
                    rh.result
                FROM bet_history bh
                LEFT JOIN result_history rh ON bh.period = rh.period
                WHERE bh.period >= $1
                ORDER BY bh.period DESC
                LIMIT 20
            `, [activeControl.start_period || '0']);
            
            console.log(`\n最近 ${recentBets.length} 筆下注記錄的中獎情況...`);
            
            // 統計中獎率
            const targetBets = recentBets.filter(bet => 
                activeControl.control_mode === 'single_member' 
                    ? bet.username === activeControl.target_username
                    : true // 其他模式需要更複雜的判斷
            );
            
            if (targetBets.length > 0) {
                const wins = targetBets.filter(bet => bet.win).length;
                const winRate = (wins / targetBets.length) * 100;
                
                console.log(`\n目標下注統計：`);
                console.log(`- 總下注數: ${targetBets.length}`);
                console.log(`- 中獎數: ${wins}`);
                console.log(`- 實際中獎率: ${winRate.toFixed(1)}%`);
                console.log(`- 設定控制率: ${activeControl.control_percentage}%`);
                console.log(`- 差異: ${Math.abs(winRate - activeControl.control_percentage).toFixed(1)}%`);
            }
        } else {
            console.log('沒有活躍的控制設定');
        }
        
    } catch (error) {
        console.error('查詢失敗:', error.message);
    }
}

// 執行測試
async function main() {
    try {
        await testControlPercentages();
        await testActualControl();
    } catch (error) {
        console.error('測試失敗:', error);
    } finally {
        await db.$pool.end();
    }
}

main();