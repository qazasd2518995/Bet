import db from './db/config.js';

async function checkControl336() {
    console.log('🔍 檢查336期控制設定和權重計算...\n');
    
    try {
        // 1. 查看下注摘要
        console.log('📊 下注摘要:');
        console.log('用戶 justin111 在第8名位置下注了:');
        console.log('2, 3, 4, 5, 6, 7, 8, 9, 10 (共9個號碼，每個100元)');
        console.log('開獎結果: 第8名開出3號');
        console.log('中獎金額: 989元 (100 * 9.89賠率)');
        console.log('下注總額: 900元');
        console.log('實際獲利: 989 - 900 = 89元\n');
        
        // 2. 查詢控制設定（修正欄位名稱）
        console.log('🎮 查詢輸贏控制設定:');
        const controls = await db.manyOrNone(`
            SELECT id, target_username, control_percentage, control_mode, 
                   start_period, is_active, created_at
            FROM win_loss_control 
            WHERE is_active = true 
            AND (start_period <= '20250717336' OR start_period IS NULL)
            ORDER BY created_at DESC
        `);
        
        if (controls.length > 0) {
            console.log(`找到 ${controls.length} 個活動控制設定:`);
            controls.forEach((control, index) => {
                console.log(`\n  控制設定 ${index + 1}:`);
                console.log(`    ID: ${control.id}`);
                console.log(`    目標用戶: ${control.target_username || '全部'}`);
                console.log(`    控制百分比: ${control.control_percentage}%`);
                console.log(`    控制模式: ${control.control_mode}`);
                console.log(`    起始期號: ${control.start_period || '不限'}`);
                console.log(`    創建時間: ${control.created_at}`);
            });
        } else {
            console.log('沒有找到活動的控制設定');
        }
        
        // 3. 分析控制邏輯
        console.log('\n\n🔍 控制邏輯分析:');
        console.log('如果設定90%輸的控制，理論上有90%機率會讓用戶輸');
        console.log('但您下注了9個號碼中的9個（只漏了1號）');
        console.log('這代表您有90%的中獎機率（9/10）');
        console.log('\n即使系統想讓您輸，也很難做到，因為:');
        console.log('- 要讓您輸，系統必須開出1號（您唯一沒下注的號碼）');
        console.log('- 但這樣做會太明顯，違反隨機性原則');
        console.log('- 系統可能在權重計算時發現無法有效控制，因此回歸正常開獎');
        
        // 4. 查看簡化開獎系統的邏輯
        console.log('\n\n📝 查看simplified-draw-system.js的控制邏輯:');
        console.log('根據程式碼，當control_percentage = 90%時:');
        console.log('- 如果設定讓用戶輸，系統會嘗試生成讓用戶輸的結果');
        console.log('- 但generateLosingResult函數會避開用戶下注的號碼');
        console.log('- 當用戶幾乎下注所有號碼時，系統很難執行有效控制');
        
        // 5. 檢查該用戶其他期的下注模式
        console.log('\n\n📈 檢查該用戶近期下注模式:');
        const recentBets = await db.manyOrNone(`
            SELECT period, COUNT(*) as bet_count, SUM(amount) as total_amount,
                   SUM(CASE WHEN win_amount > 0 THEN 1 ELSE 0 END) as win_count,
                   SUM(win_amount) as total_win
            FROM bet_history
            WHERE username = 'justin111'
            AND period >= '20250717330'
            AND period <= '20250717340'
            GROUP BY period
            ORDER BY period
        `);
        
        if (recentBets.length > 0) {
            console.log('期號\t下注數\t總金額\t中獎數\t總獲利');
            recentBets.forEach(record => {
                const profit = (record.total_win || 0) - record.total_amount;
                console.log(`${record.period}\t${record.bet_count}\t${record.total_amount}\t${record.win_count}\t${profit}`);
            });
        }
        
        console.log('\n\n💡 結論:');
        console.log('1. 您在336期下注了9個號碼（除了1號），覆蓋率90%');
        console.log('2. 即使設定90%輸控制，系統也很難讓您輸');
        console.log('3. 控制系統可能因為無法有效執行而回歸隨機開獎');
        console.log('4. 建議：如果要測試控制效果，應該下注較少的號碼（如1-3個）');
        
    } catch (error) {
        console.error('查詢過程中出錯:', error);
    } finally {
        await db.$pool.end();
    }
}

checkControl336();