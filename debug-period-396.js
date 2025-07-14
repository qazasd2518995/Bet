// debug-period-396.js - 檢查396期結算問題
import db from './db/config.js';

async function debugPeriod396() {
    try {
        console.log('🔍 檢查期號 20250714396 的結算問題...\n');
        
        // 1. 檢查期號396的開獎結果
        const result = await db.oneOrNone(`
            SELECT period, result, created_at 
            FROM result_history 
            WHERE period = 20250714396
        `);
        
        if (result) {
            console.log(`期號 ${result.period} 開獎結果:`, result.result);
            console.log(`開獎時間: ${result.created_at}`);
            
            if (Array.isArray(result.result)) {
                console.log('各位置號碼:');
                result.result.forEach((num, index) => {
                    const position = index + 1;
                    console.log(`  第${position}名: ${num}`);
                });
            }
        } else {
            console.log('❌ 找不到期號 20250714396 的開獎結果');
            return;
        }
        
        // 2. 檢查用戶在該期的投注
        const bets = await db.any(`
            SELECT id, bet_type, bet_value, position, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE period = 20250714396 AND username = 'justin111'
            ORDER BY id
        `);
        
        console.log(`\n找到 ${bets.length} 筆投注:`);
        bets.forEach((bet, index) => {
            console.log(`\n投注 ${index + 1}: ID=${bet.id}`);
            console.log(`  類型: ${bet.bet_type}`);
            console.log(`  值: ${bet.bet_value}`);
            console.log(`  位置: ${bet.position}`);
            console.log(`  金額: ${bet.amount}`);
            console.log(`  賠率: ${bet.odds}`);
            console.log(`  結果: ${bet.win ? '中獎' : '未中獎'}`);
            console.log(`  派彩: ${bet.win_amount}`);
            console.log(`  已結算: ${bet.settled ? '是' : '否'}`);
            console.log(`  下注時間: ${bet.created_at}`);
            
            // 檢查是否應該中獎
            if (result && Array.isArray(result.result)) {
                if (bet.bet_type === 'number' && bet.position) {
                    const positionIndex = parseInt(bet.position) - 1;
                    const actualNumber = result.result[positionIndex];
                    const betNumber = parseInt(bet.bet_value);
                    
                    console.log(`  位置 ${bet.position} 實際號碼: ${actualNumber}`);
                    console.log(`  投注號碼: ${betNumber}`);
                    
                    if (actualNumber === betNumber) {
                        console.log(`  ✅ 應該中獎！預期派彩: ${bet.amount * bet.odds}`);
                        if (!bet.win) {
                            console.log(`  ❌ 但標記為未中獎，需要修正`);
                        }
                    } else {
                        console.log(`  ❌ 應該未中獎`);
                        if (bet.win) {
                            console.log(`  ⚠️ 但標記為中獎，可能有錯誤`);
                        }
                    }
                }
            }
        });
        
        // 3. 檢查結算日誌
        const settlementLog = await db.oneOrNone(`
            SELECT * FROM settlement_logs 
            WHERE period = 20250714396
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        
        if (settlementLog) {
            console.log('\n📋 結算日誌:');
            console.log(`  結算數量: ${settlementLog.settled_count}`);
            console.log(`  總中獎金額: ${settlementLog.total_win_amount}`);
            console.log(`  結算時間: ${settlementLog.created_at}`);
        } else {
            console.log('\n❌ 找不到結算日誌');
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

debugPeriod396();