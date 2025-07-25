import pkg from 'pg-promise';
import axios from 'axios';

const pgp = pkg();
const db = pgp({
    connectionString: 'postgresql://bet_db_sldl_user:iAT91cS1Cl1tWANmgp3vLNarADrTNvKh@dpg-ct6go256l47c738ju4kg-a.oregon-postgres.render.com/bet_db_sldl?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function fixCascadeUpdate() {
    console.log('=== 修復級聯更新 ===\n');
    
    try {
        // 獲取 A02agent 的資料
        const a02 = await db.one(`
            SELECT id, username, rebate_percentage, max_rebate_percentage
            FROM agents
            WHERE username = 'A02agent'
        `);
        
        console.log(`A02agent 當前狀態:`);
        console.log(`  退水: ${a02.rebate_percentage} (${a02.rebate_percentage * 100}%)`);
        console.log(`  最大退水: ${a02.max_rebate_percentage} (${a02.max_rebate_percentage * 100}%)`);
        
        // 觸發 API 更新來執行級聯
        console.log('\n透過 API 重新設定 A02agent 的退水，觸發級聯更新...');
        
        const response = await axios.put(
            `http://localhost:3003/api/agent/update-rebate-settings/${a02.id}`,
            {
                rebate_mode: 'percentage',
                rebate_percentage: a02.rebate_percentage
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (response.data.success) {
            console.log('✅ API 更新成功');
            
            // 檢查 A03agent 的更新結果
            const a03After = await db.oneOrNone(`
                SELECT id, username, rebate_percentage, max_rebate_percentage
                FROM agents
                WHERE username = 'A03agent'
            `);
            
            if (a03After) {
                console.log(`\nA03agent 更新後:`);
                console.log(`  退水: ${a03After.rebate_percentage} (${a03After.rebate_percentage * 100}%)`);
                console.log(`  最大退水: ${a03After.max_rebate_percentage} (${a03After.max_rebate_percentage * 100}%)`);
                
                if (a03After.max_rebate_percentage === a02.rebate_percentage) {
                    console.log(`  ✅ 級聯更新成功`);
                } else {
                    console.log(`  ❌ 級聯更新失敗`);
                }
            }
        } else {
            console.log('❌ API 更新失敗:', response.data.message);
        }
        
    } catch (error) {
        console.error('修復過程中發生錯誤:', error.message);
    } finally {
        await db.$pool.end();
    }
}

fixCascadeUpdate();