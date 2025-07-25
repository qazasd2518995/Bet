// 分析期號 20250717375 的開獎情況和權重日誌
import db from './db/config.js';

async function analyzePeriod375() {
    console.log('🔍 分析期號 20250717375 的開獎情況\n');

    try {
        // 1. 查詢該期的下注記錄
        const bets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = '20250717375'
            AND username = 'justin111'
            ORDER BY position, bet_value
        `);

        console.log('📊 justin111 的下注情況：');
        if (bets.length > 0) {
            const position5Bets = bets.filter(b => b.position === '5');
            if (position5Bets.length > 0) {
                const betNumbers = position5Bets.map(b => b.bet_value).sort((a, b) => a - b);
                console.log(`位置：第5名`);
                console.log(`下注號碼：${betNumbers.join(', ')}`);
                console.log(`下注數量：${betNumbers.length}個`);
                console.log(`覆蓋率：${betNumbers.length}/10 = ${betNumbers.length * 10}%`);
                console.log(`總下注金額：$${position5Bets.reduce((sum, b) => sum + parseFloat(b.amount), 0)}`);
            }
        }

        // 2. 查詢開獎結果
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250717375'
        `);

        if (result) {
            console.log('\n🎯 開獎結果：');
            console.log(`第1名：${result.position_1}`);
            console.log(`第2名：${result.position_2}`);
            console.log(`第3名：${result.position_3}`);
            console.log(`第4名：${result.position_4}`);
            console.log(`第5名：${result.position_5} ⭐`);
            console.log(`第6名：${result.position_6}`);
            console.log(`第7名：${result.position_7}`);
            console.log(`第8名：${result.position_8}`);
            console.log(`第9名：${result.position_9}`);
            console.log(`第10名：${result.position_10}`);
            console.log(`開獎時間：${result.draw_time}`);

            // 檢查是否中獎
            const position5Bets = bets.filter(b => b.position === '5');
            if (position5Bets.length > 0) {
                const betNumbers = position5Bets.map(b => b.bet_value);
                const isWin = betNumbers.includes(result.position_5.toString());
                console.log(`\n💰 結果：${isWin ? '中獎' : '未中獎'}（第5名開出：${result.position_5}）`);
                
                if (isWin) {
                    const winBet = position5Bets.find(b => b.bet_value === result.position_5.toString());
                    if (winBet) {
                        const winAmount = parseFloat(winBet.amount) * parseFloat(winBet.odds);
                        console.log(`中獎金額：$${winAmount.toFixed(2)}`);
                    }
                }
            }
        }

        // 3. 查詢當時的控制設定
        const control = await db.oneOrNone(`
            SELECT * FROM win_loss_control
            WHERE target_username = 'justin111'
            AND is_active = true
            AND created_at <= (SELECT draw_time FROM result_history WHERE period = '20250717375')
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (control) {
            console.log('\n🎮 控制設定：');
            console.log(`控制模式：${control.control_mode}`);
            console.log(`目標用戶：${control.target_username}`);
            console.log(`控制百分比：${control.control_percentage}%`);
            console.log(`操作員：${control.operator_username}`);
            console.log(`開始期號：${control.start_period}`);
        } else {
            console.log('\n🎮 控制設定：無活躍控制');
        }

        // 4. 查詢權重日誌（如果有記錄）
        console.log('\n📝 查詢權重生成日誌...');
        
        // 檢查是否有專門的權重日誌表
        const hasWeightTable = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name = 'draw_weight_logs'
            );
        `);

        if (hasWeightTable && hasWeightTable.exists) {
            const weightLogs = await db.manyOrNone(`
                SELECT * FROM draw_weight_logs
                WHERE period = '20250717375'
                ORDER BY created_at
            `);

            if (weightLogs && weightLogs.length > 0) {
                console.log('\n🎲 權重生成日誌：');
                weightLogs.forEach(log => {
                    console.log(`時間：${log.created_at}`);
                    console.log(`內容：${JSON.stringify(log.weight_data, null, 2)}`);
                });
            } else {
                console.log('未找到該期的權重日誌');
            }
        } else {
            console.log('系統未記錄權重日誌（無 draw_weight_logs 表）');
        }

        // 5. 分析可能的原因
        console.log('\n🔍 分析可能原因：');
        
        if (bets.length > 0) {
            const position5Bets = bets.filter(b => b.position === '5');
            const coverage = position5Bets.length;
            
            if (coverage >= 8) {
                console.log(`1. 高覆蓋率下注（${coverage}/10 = ${coverage * 10}%）`);
                console.log('   - 當覆蓋率達到80%以上時，控制系統效果有限');
                console.log('   - 即使90%輸控制，仍有較高機率中獎');
            }
            
            if (!control || !control.is_active) {
                console.log('2. 控制可能未啟用或已過期');
            } else {
                console.log('2. 控制已啟用，但可能：');
                console.log('   - 屬於10%的"讓用戶贏"的機率');
                console.log('   - 或因高覆蓋率導致控制失效');
            }
            
            console.log('3. 建議查看後端運行日誌以了解詳細的控制決策過程');
        }

        // 6. 統計最近的中獎情況
        const recentWins = await db.manyOrNone(`
            SELECT 
                bh.period,
                bh.position,
                bh.bet_value,
                bh.amount,
                bh.odds,
                bh.is_win,
                rh.draw_time
            FROM bet_history bh
            JOIN result_history rh ON bh.period = rh.period
            WHERE bh.username = 'justin111'
            AND bh.is_win = true
            AND bh.position = '5'
            AND CAST(bh.period AS BIGINT) >= CAST('20250717350' AS BIGINT)
            ORDER BY CAST(bh.period AS BIGINT) DESC
            LIMIT 10
        `);

        if (recentWins && recentWins.length > 0) {
            console.log(`\n📊 最近第5名中獎記錄（最近10次）：`);
            recentWins.forEach(win => {
                console.log(`期號：${win.period}, 中獎號碼：${win.bet_value}, 金額：$${win.amount}, 賠率：${win.odds}`);
            });
        }

    } catch (error) {
        console.error('分析失敗：', error);
    }
}

// 執行分析
analyzePeriod375().then(() => {
    console.log('\n✅ 分析完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 分析錯誤：', error);
    process.exit(1);
});