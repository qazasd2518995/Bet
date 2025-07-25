// manual-settle-229.js - 手動結算期號229
import db from './db/config.js';
import { improvedSettleBets } from './improved-settlement-system.js';

async function manualSettle229() {
    console.log('🔧 手動結算期號 20250714229...\n');
    
    try {
        // 1. 獲取開獎結果
        const result = await db.one(`
            SELECT period, result
            FROM result_history
            WHERE period = 20250714229
        `);
        
        console.log(`📊 期號: ${result.period}`);
        console.log(`開獎結果: ${result.result}`);
        
        // 解析開獎結果
        let positions = [];
        if (Array.isArray(result.result)) {
            positions = result.result;
        } else if (typeof result.result === 'string') {
            positions = result.result.split(',').map(n => parseInt(n.trim()));
        }
        
        console.log(`解析後結果: [${positions.join(',')}]`);
        console.log(`第6名開出: ${positions[5]}號\n`);
        
        // 2. 檢查未結算的注單
        const unsettledBets = await db.any(`
            SELECT id, username, bet_type, bet_value, position, amount, odds
            FROM bet_history
            WHERE period = 20250714229
            AND settled = false
        `);
        
        console.log(`找到 ${unsettledBets.length} 筆未結算注單`);
        
        // 3. 準備結算數據
        const winResult = { positions: positions };
        console.log(`準備結算數據: ${JSON.stringify(winResult)}\n`);
        
        // 4. 執行結算
        console.log('🎯 開始執行結算...');
        
        const settlementResult = await improvedSettleBets(20250714229, winResult);
        
        if (settlementResult.success) {
            console.log('\n✅ 結算成功！');
            console.log(`結算注單數: ${settlementResult.settledCount}`);
            console.log(`總中獎金額: $${settlementResult.totalWinAmount || 0}`);
            
            if (settlementResult.userWinnings && Object.keys(settlementResult.userWinnings).length > 0) {
                console.log('\n💰 中獎詳情:');
                Object.entries(settlementResult.userWinnings).forEach(([username, amount]) => {
                    console.log(`  ${username}: $${amount}`);
                });
            } else {
                console.log('\n📋 本期無中獎注單');
            }
        } else {
            console.log(`\n❌ 結算失敗: ${settlementResult.reason}`);
        }
        
        // 5. 驗證結算結果
        console.log('\n🔍 驗證結算結果...');
        
        const verifyBets = await db.any(`
            SELECT id, bet_value, win, win_amount, settled, settled_at
            FROM bet_history
            WHERE period = 20250714229
            AND position = 6
            ORDER BY id ASC
        `);
        
        console.log('\n第6名投注結算結果:');
        verifyBets.forEach(bet => {
            const shouldWin = parseInt(bet.bet_value) === positions[5]; // 第6名是positions[5]
            const status = bet.settled ? '✅ 已結算' : '❌ 未結算';
            const winStatus = bet.win ? `中獎 $${bet.win_amount}` : '未中獎';
            const correct = shouldWin === bet.win ? '✅' : '❌';
            
            console.log(`${status} ID ${bet.id}: 投注${bet.bet_value}號, ${winStatus} ${correct}`);
        });
        
        // 6. 檢查是否所有注單都已結算
        const stillUnsettled = await db.any(`
            SELECT COUNT(*) as count
            FROM bet_history
            WHERE period = 20250714229
            AND settled = false
        `);
        
        if (parseInt(stillUnsettled[0].count) === 0) {
            console.log('\n✅ 期號229所有注單已完成結算！');
        } else {
            console.log(`\n⚠️ 仍有 ${stillUnsettled[0].count} 筆注單未結算`);
        }
        
    } catch (error) {
        console.error('手動結算過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行手動結算
manualSettle229();