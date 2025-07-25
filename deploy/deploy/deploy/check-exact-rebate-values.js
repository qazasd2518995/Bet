import pkg from 'pg-promise';
const pgp = pkg();
const db = pgp({
    connectionString: 'postgresql://bet_db_sldl_user:iAT91cS1Cl1tWANmgp3vLNarADrTNvKh@dpg-ct6go256l47c738ju4kg-a.oregon-postgres.render.com/bet_db_sldl?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function checkExactRebateValues() {
    console.log('=== 檢查 A 系列代理的退水精確值 ===\n');
    
    try {
        // 查詢 A01, A02, A03 代理的詳細資料
        const agents = await db.any(`
            SELECT 
                id, 
                username, 
                level, 
                parent_id,
                rebate_percentage,
                max_rebate_percentage,
                rebate_mode
            FROM agents
            WHERE username IN ('A01agent', 'A02agent', 'A03agent')
            ORDER BY level
        `);
        
        console.log('代理退水詳細資料：');
        console.log('=================\n');
        
        for (const agent of agents) {
            console.log(`${agent.username} (Level ${agent.level}):`);
            console.log(`  ID: ${agent.id}`);
            console.log(`  Parent ID: ${agent.parent_id}`);
            console.log(`  退水模式: ${agent.rebate_mode}`);
            console.log(`  退水比例 (rebate_percentage): ${agent.rebate_percentage}`);
            console.log(`  退水比例 (百分比): ${agent.rebate_percentage * 100}%`);
            console.log(`  最大退水 (max_rebate_percentage): ${agent.max_rebate_percentage}`);
            console.log(`  最大退水 (百分比): ${agent.max_rebate_percentage * 100}%`);
            
            // 檢查顯示問題
            const displayPercent = agent.rebate_percentage * 100;
            console.log(`  如果用 toFixed(1) 會顯示: ${displayPercent.toFixed(1)}%`);
            console.log('');
        }
        
        // 檢查級聯關係
        console.log('\n級聯關係檢查：');
        console.log('=============');
        
        const a01 = agents.find(a => a.username === 'A01agent');
        const a02 = agents.find(a => a.username === 'A02agent');
        const a03 = agents.find(a => a.username === 'A03agent');
        
        if (a01 && a02) {
            console.log(`\nA01agent -> A02agent:`);
            console.log(`  A01 退水: ${a01.rebate_percentage * 100}%`);
            console.log(`  A02 最大退水: ${a02.max_rebate_percentage * 100}%`);
            if (a02.max_rebate_percentage === a01.rebate_percentage) {
                console.log(`  ✅ 正確：A02 的最大退水等於 A01 的退水`);
            } else {
                console.log(`  ❌ 錯誤：A02 的最大退水應該是 ${a01.rebate_percentage * 100}%`);
            }
        }
        
        if (a02 && a03) {
            console.log(`\nA02agent -> A03agent:`);
            console.log(`  A02 退水: ${a02.rebate_percentage * 100}%`);
            console.log(`  A03 最大退水: ${a03.max_rebate_percentage * 100}%`);
            if (a03.max_rebate_percentage === a02.rebate_percentage) {
                console.log(`  ✅ 正確：A03 的最大退水等於 A02 的退水`);
            } else {
                console.log(`  ❌ 錯誤：A03 的最大退水應該是 ${a02.rebate_percentage * 100}%`);
            }
        }
        
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

checkExactRebateValues();