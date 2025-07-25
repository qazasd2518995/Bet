import pkg from 'pg-promise';
import axios from 'axios';

const pgp = pkg();
const db = pgp({
    connectionString: 'postgresql://bet_db_sldl_user:iAT91cS1Cl1tWANmgp3vLNarADrTNvKh@dpg-ct6go256l47c738ju4kg-a.oregon-postgres.render.com/bet_db_sldl?ssl=true',
    ssl: { rejectUnauthorized: false }
});

async function fixCascadeUpdate() {
    console.log('=== 修复级联更新 ===\n');
    
    try {
        // 获取 A02agent 的资料
        const a02 = await db.one(`
            SELECT id, username, rebate_percentage, max_rebate_percentage
            FROM agents
            WHERE username = 'A02agent'
        `);
        
        console.log(`A02agent 当前状态:`);
        console.log(`  退水: ${a02.rebate_percentage} (${a02.rebate_percentage * 100}%)`);
        console.log(`  最大退水: ${a02.max_rebate_percentage} (${a02.max_rebate_percentage * 100}%)`);
        
        // 触发 API 更新来执行级联
        console.log('\n透过 API 重新设定 A02agent 的退水，触发级联更新...');
        
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
            
            // 检查 A03agent 的更新结果
            const a03After = await db.oneOrNone(`
                SELECT id, username, rebate_percentage, max_rebate_percentage
                FROM agents
                WHERE username = 'A03agent'
            `);
            
            if (a03After) {
                console.log(`\nA03agent 更新后:`);
                console.log(`  退水: ${a03After.rebate_percentage} (${a03After.rebate_percentage * 100}%)`);
                console.log(`  最大退水: ${a03After.max_rebate_percentage} (${a03After.max_rebate_percentage * 100}%)`);
                
                if (a03After.max_rebate_percentage === a02.rebate_percentage) {
                    console.log(`  ✅ 级联更新成功`);
                } else {
                    console.log(`  ❌ 级联更新失败`);
                }
            }
        } else {
            console.log('❌ API 更新失败:', response.data.message);
        }
        
    } catch (error) {
        console.error('修复过程中发生错误:', error.message);
    } finally {
        await db.$pool.end();
    }
}

fixCascadeUpdate();