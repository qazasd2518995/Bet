// 檢查期號 375 的詳細下注情況
import db from './db/config.js';

async function checkPeriod375() {
    console.log('🔍 檢查期號 20250717375 的詳細情況\n');

    try {
        // 1. 查詢所有下注記錄
        const allBets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = '20250717375'
            ORDER BY username, position, bet_value
        `);

        console.log(`📊 總下注記錄數：${allBets.length}`);

        // 2. 查詢 justin111 的下注
        const justinBets = allBets.filter(b => b.username === 'justin111');
        
        if (justinBets.length > 0) {
            console.log(`\n👤 justin111 的下注（共${justinBets.length}筆）：`);
            
            // 按位置分組
            const betsByPosition = {};
            justinBets.forEach(bet => {
                if (!betsByPosition[bet.position]) {
                    betsByPosition[bet.position] = [];
                }
                betsByPosition[bet.position].push(bet);
            });

            // 顯示每個位置的下注
            Object.keys(betsByPosition).sort().forEach(position => {
                const positionBets = betsByPosition[position];
                const betNumbers = positionBets.map(b => b.bet_value).sort((a, b) => a - b);
                const totalAmount = positionBets.reduce((sum, b) => sum + parseFloat(b.amount), 0);
                
                console.log(`\n第${position}名：`);
                console.log(`  下注號碼：${betNumbers.join(', ')}`);
                console.log(`  覆蓋率：${betNumbers.length}/10 = ${betNumbers.length * 10}%`);
                console.log(`  總金額：$${totalAmount}`);
            });
        } else {
            console.log('\njustin111 在此期沒有下注');
        }

        // 3. 查詢開獎結果
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250717375'
        `);

        if (result) {
            console.log('\n🎯 開獎結果：');
            const positions = [
                result.position_1, result.position_2, result.position_3, 
                result.position_4, result.position_5, result.position_6,
                result.position_7, result.position_8, result.position_9, 
                result.position_10
            ];
            
            positions.forEach((num, idx) => {
                const star = (idx === 4) ? ' ⭐' : ''; // 第5名標記
                console.log(`第${idx + 1}名：${num}${star}`);
            });

            // 檢查 justin111 是否中獎
            if (justinBets.length > 0) {
                console.log('\n💰 中獎檢查：');
                let totalWin = 0;
                
                justinBets.forEach(bet => {
                    const positionIndex = parseInt(bet.position) - 1;
                    const drawnNumber = positions[positionIndex];
                    
                    if (bet.bet_value === drawnNumber.toString()) {
                        const winAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
                        console.log(`✅ 第${bet.position}名 - 號碼${bet.bet_value}中獎！金額：$${bet.amount} x ${bet.odds} = $${winAmount.toFixed(2)}`);
                        totalWin += winAmount;
                    }
                });
                
                if (totalWin > 0) {
                    console.log(`總中獎金額：$${totalWin.toFixed(2)}`);
                } else {
                    console.log('未中獎');
                }
            }
        } else {
            console.log('\n❌ 未找到該期的開獎結果');
        }

        // 4. 檢查控制記錄
        const controlLog = await db.oneOrNone(`
            SELECT * FROM win_loss_control
            WHERE target_username = 'justin111'
            AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        `);

        if (controlLog) {
            console.log('\n🎮 當前控制設定：');
            console.log(`模式：${controlLog.control_mode}`);
            console.log(`百分比：${controlLog.control_percentage}%`);
            console.log(`操作員：${controlLog.operator_username}`);
        }

        // 5. 嘗試查找系統日誌（如果有）
        console.log('\n📝 查找系統日誌...');
        
        // 檢查是否有系統日誌表
        const hasLogTable = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public'
                AND table_name = 'system_logs'
            );
        `);

        if (hasLogTable && hasLogTable.exists) {
            const logs = await db.manyOrNone(`
                SELECT * FROM system_logs
                WHERE log_data::text LIKE '%20250717375%'
                ORDER BY created_at DESC
                LIMIT 10
            `);

            if (logs && logs.length > 0) {
                console.log('找到相關日誌：');
                logs.forEach(log => {
                    console.log(`[${log.created_at}] ${JSON.stringify(log.log_data)}`);
                });
            }
        } else {
            console.log('系統未配置日誌表');
            console.log('建議檢查後端服務器的控制台輸出或日誌文件');
        }

    } catch (error) {
        console.error('查詢失敗：', error);
    }
}

// 執行檢查
checkPeriod375().then(() => {
    console.log('\n✅ 檢查完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});