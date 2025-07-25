import db from './db/config.js';

async function checkPeriod336() {
    console.log('🔍 檢查第336期相關資料...\n');
    
    try {
        // 1. 查詢下注記錄
        console.log('📋 1. 查詢第336期下注記錄:');
        const bets = await db.manyOrNone(`
            SELECT username, bet_type, bet_value, position, amount, odds, settled, win_amount, created_at
            FROM bet_history 
            WHERE period = '20250717336'
            ORDER BY created_at
        `);
        
        if (bets.length > 0) {
            console.log(`找到 ${bets.length} 筆下注記錄:`);
            bets.forEach((bet, index) => {
                console.log(`\n  下注 ${index + 1}:`);
                console.log(`    用戶: ${bet.username}`);
                console.log(`    類型: ${bet.bet_type}`);
                console.log(`    數值: ${bet.bet_value}`);
                console.log(`    位置: ${bet.position || 'N/A'}`);
                console.log(`    金額: ${bet.amount}`);
                console.log(`    賠率: ${bet.odds}`);
                console.log(`    已結算: ${bet.settled ? '是' : '否'}`);
                console.log(`    中獎金額: ${bet.win_amount || 0}`);
                console.log(`    時間: ${bet.created_at}`);
            });
        } else {
            console.log('沒有找到下注記錄');
        }
        
        // 2. 查詢開獎結果
        console.log('\n\n📊 2. 查詢第336期開獎結果:');
        const result = await db.oneOrNone(`
            SELECT period, result, position_1, position_2, position_3, position_4, position_5, 
                   position_6, position_7, position_8, position_9, position_10, draw_time
            FROM result_history 
            WHERE period = '20250717336'
        `);
        
        if (result) {
            console.log(`期號: ${result.period}`);
            console.log(`開獎時間: ${result.draw_time}`);
            console.log(`結果陣列: ${JSON.stringify(result.result)}`);
            console.log('各位置號碼:');
            for (let i = 1; i <= 10; i++) {
                console.log(`  第${i}名: ${result[`position_${i}`]}`);
            }
        } else {
            console.log('沒有找到開獎結果');
        }
        
        // 3. 查詢當時的控制設定
        console.log('\n\n🎮 3. 查詢輸贏控制設定:');
        const controls = await db.manyOrNone(`
            SELECT id, target_username, control_percentage, control_mode, 
                   start_period, end_period, is_active, created_at
            FROM win_loss_control 
            WHERE is_active = true 
            AND (start_period <= '20250717336' OR start_period IS NULL)
            AND (end_period >= '20250717336' OR end_period IS NULL)
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
                console.log(`    結束期號: ${control.end_period || '不限'}`);
                console.log(`    創建時間: ${control.created_at}`);
            });
        } else {
            console.log('沒有找到活動的控制設定');
        }
        
        // 4. 查詢結算記錄
        console.log('\n\n💰 4. 查詢第336期結算記錄:');
        const settlements = await db.manyOrNone(`
            SELECT username, bet_type, bet_value, position, amount, odds, 
                   win_amount, is_win, settled_at
            FROM settlement_records 
            WHERE period = '20250717336'
            ORDER BY settled_at
        `);
        
        if (settlements.length > 0) {
            console.log(`找到 ${settlements.length} 筆結算記錄:`);
            let totalBetAmount = 0;
            let totalWinAmount = 0;
            let winCount = 0;
            
            settlements.forEach((settlement, index) => {
                console.log(`\n  結算 ${index + 1}:`);
                console.log(`    用戶: ${settlement.username}`);
                console.log(`    下注類型: ${settlement.bet_type}`);
                console.log(`    下注值: ${settlement.bet_value}`);
                console.log(`    位置: ${settlement.position || 'N/A'}`);
                console.log(`    下注金額: ${settlement.amount}`);
                console.log(`    賠率: ${settlement.odds}`);
                console.log(`    中獎金額: ${settlement.win_amount}`);
                console.log(`    是否中獎: ${settlement.is_win ? '✅ 中獎' : '❌ 未中'}`);
                console.log(`    結算時間: ${settlement.settled_at}`);
                
                totalBetAmount += parseFloat(settlement.amount);
                totalWinAmount += parseFloat(settlement.win_amount || 0);
                if (settlement.is_win) winCount++;
            });
            
            console.log('\n📈 結算統計:');
            console.log(`  總下注金額: ${totalBetAmount}`);
            console.log(`  總中獎金額: ${totalWinAmount}`);
            console.log(`  中獎筆數: ${winCount}/${settlements.length}`);
            console.log(`  中獎率: ${(winCount/settlements.length * 100).toFixed(2)}%`);
            console.log(`  平台盈利: ${totalBetAmount - totalWinAmount}`);
        } else {
            console.log('沒有找到結算記錄');
        }
        
        // 5. 檢查權重計算日誌（如果有）
        console.log('\n\n📝 5. 檢查開獎計算日誌:');
        // 查看是否有相關的計算日誌
        const logs = await db.manyOrNone(`
            SELECT created_at, message 
            FROM system_logs 
            WHERE created_at >= '2025-01-17 00:00:00' 
            AND created_at <= '2025-01-17 23:59:59'
            AND (message LIKE '%336%' OR message LIKE '%控制%' OR message LIKE '%權重%')
            ORDER BY created_at
            LIMIT 20
        `).catch(() => []);
        
        if (logs.length > 0) {
            console.log(`找到 ${logs.length} 條相關日誌:`);
            logs.forEach(log => {
                console.log(`  ${log.created_at}: ${log.message}`);
            });
        } else {
            console.log('沒有找到相關日誌記錄');
        }
        
    } catch (error) {
        console.error('查詢過程中出錯:', error);
    } finally {
        await db.$pool.end();
    }
}

checkPeriod336();