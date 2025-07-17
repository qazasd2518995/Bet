import db from './db/config.js';

async function checkPeriod579Settlement() {
    try {
        console.log('🔍 檢查期號 20250717579 的結算情況...\n');
        
        // 1. 查詢開獎結果
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250717579'
        `);
        
        if (result) {
            console.log('=== 開獎結果 ===');
            console.log('期號:', result.period);
            console.log('第1名（冠軍）:', result.position_1, '號');
            console.log('開獎時間:', result.created_at);
            console.log('完整結果:', [
                result.position_1, result.position_2, result.position_3, 
                result.position_4, result.position_5, result.position_6,
                result.position_7, result.position_8, result.position_9, 
                result.position_10
            ].join(', '));
            
            // 判斷大小單雙
            const champion = parseInt(result.position_1);
            console.log('\n冠軍分析:');
            console.log(`  號碼: ${champion}`);
            console.log(`  大小: ${champion >= 6 ? '大' : '小'} (1-5小, 6-10大)`);
            console.log(`  單雙: ${champion % 2 === 1 ? '單' : '雙'}`);
        }
        
        // 2. 查詢該期所有投注
        const bets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = '20250717579' 
            AND username = 'justin111'
            ORDER BY id
        `);
        
        console.log(`\n=== 用戶 justin111 的投注記錄 (共 ${bets.length} 筆) ===`);
        
        bets.forEach((bet, index) => {
            console.log(`\n[${index + 1}] ID: ${bet.id}`);
            console.log(`  投注類型: ${bet.bet_type}`);
            console.log(`  投注內容: ${bet.bet_value}`);
            console.log(`  金額: $${bet.amount}`);
            console.log(`  賠率: ${bet.odds}`);
            console.log(`  結算狀態: ${bet.settled ? '已結算' : '未結算'}`);
            console.log(`  中獎: ${bet.win ? '是' : '否'}`);
            console.log(`  派彩: $${bet.win_amount || 0}`);
            console.log(`  創建時間: ${bet.created_at}`);
            console.log(`  結算時間: ${bet.settled_at || '未結算'}`);
            
            // 判斷應該的結果
            if (result && bet.bet_type === 'champion' || bet.bet_type === '冠軍') {
                const champion = parseInt(result.position_1);
                let shouldWin = false;
                
                if (bet.bet_value === 'small' || bet.bet_value === '小') {
                    shouldWin = champion <= 5;
                    console.log(`  ⚠️ 應該${shouldWin ? '贏' : '輸'} (冠軍${champion}號是${champion <= 5 ? '小' : '大'})`);
                } else if (bet.bet_value === 'big' || bet.bet_value === '大') {
                    shouldWin = champion >= 6;
                    console.log(`  ⚠️ 應該${shouldWin ? '贏' : '輸'} (冠軍${champion}號是${champion >= 6 ? '大' : '小'})`);
                } else if (bet.bet_value === 'odd' || bet.bet_value === '單') {
                    shouldWin = champion % 2 === 1;
                    console.log(`  ⚠️ 應該${shouldWin ? '贏' : '輸'} (冠軍${champion}號是${champion % 2 === 1 ? '單' : '雙'})`);
                } else if (bet.bet_value === 'even' || bet.bet_value === '雙') {
                    shouldWin = champion % 2 === 0;
                    console.log(`  ⚠️ 應該${shouldWin ? '贏' : '輸'} (冠軍${champion}號是${champion % 2 === 0 ? '雙' : '單'})`);
                }
                
                if (shouldWin !== bet.win) {
                    console.log(`  ❌ 結算錯誤！實際結算為${bet.win ? '贏' : '輸'}，但應該${shouldWin ? '贏' : '輸'}`);
                }
            }
        });
        
        // 3. 查詢結算日誌
        const logs = await db.manyOrNone(`
            SELECT * FROM settlement_logs 
            WHERE period = '20250717579'
            ORDER BY created_at
        `);
        
        if (logs.length > 0) {
            console.log('\n=== 結算日誌 ===');
            logs.forEach((log, index) => {
                console.log(`\n[${index + 1}] ${log.created_at}`);
                console.log(`  狀態: ${log.status}`);
                console.log(`  訊息: ${log.message}`);
                if (log.details) {
                    console.log(`  詳情: ${JSON.stringify(log.details)}`);
                }
            });
        }
        
    } catch (error) {
        console.error('查詢失敗:', error);
    } finally {
        process.exit(0);
    }
}

checkPeriod579Settlement();