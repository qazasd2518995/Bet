require('dotenv').config();
const { Client } = require('pg');

// 確保使用 Render PostgreSQL
const dbConfig = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: {
        rejectUnauthorized: false
    }
};

console.log('使用 Render PostgreSQL 配置');

async function checkTi2025RebateAnalysis() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 檢查 ti2025A 和 ti2025D 的退水設定
        console.log('\n=== ti2025A 和 ti2025D 退水設定分析 ===');
        
        const ti2025AQuery = `SELECT * FROM agents WHERE username = 'ti2025A'`;
        const ti2025DQuery = `SELECT * FROM agents WHERE username = 'ti2025D'`;
        
        const ti2025AResult = await client.query(ti2025AQuery);
        const ti2025DResult = await client.query(ti2025DQuery);
        
        if (ti2025AResult.rows.length > 0) {
            const agent = ti2025AResult.rows[0];
            console.log('\n🔍 ti2025A (A盤總代理):');
            console.log(`  目前退水比例: ${(agent.rebate_percentage * 100).toFixed(3)}% (${agent.rebate_percentage})`);
            console.log(`  最大退水比例: ${(agent.max_rebate_percentage * 100).toFixed(3)}% (${agent.max_rebate_percentage})`);
            console.log(`  預期設定: 1.1%`);
            console.log(`  實際設定: ${(agent.rebate_percentage * 100).toFixed(3)}%`);
            console.log(`  設定正確: ${agent.rebate_percentage === 0.011 ? '✅' : '❌ 需要修正'}`);
            console.log(`  最大退水正確: ${agent.max_rebate_percentage === 0.011 ? '✅' : '❌ 需要修正'}`);
            console.log(`  餘額: ${agent.balance}`);
            
            if (agent.rebate_percentage !== 0.011) {
                console.log(`  ⚠️  問題: rebate_percentage 應該是 0.011，但實際是 ${agent.rebate_percentage}`);
            }
            if (agent.max_rebate_percentage !== 0.011) {
                console.log(`  ⚠️  問題: max_rebate_percentage 應該是 0.011，但實際是 ${agent.max_rebate_percentage}`);
            }
        }
        
        if (ti2025DResult.rows.length > 0) {
            const agent = ti2025DResult.rows[0];
            console.log('\n🔍 ti2025D (D盤總代理):');
            console.log(`  目前退水比例: ${(agent.rebate_percentage * 100).toFixed(3)}% (${agent.rebate_percentage})`);
            console.log(`  最大退水比例: ${(agent.max_rebate_percentage * 100).toFixed(3)}% (${agent.max_rebate_percentage})`);
            console.log(`  預期設定: 4.1%`);
            console.log(`  實際設定: ${(agent.rebate_percentage * 100).toFixed(3)}%`);
            console.log(`  設定正確: ${agent.rebate_percentage === 0.041 ? '✅' : '❌ 需要修正'}`);
            console.log(`  最大退水正確: ${agent.max_rebate_percentage === 0.041 ? '✅' : '❌ 需要修正'}`);
            console.log(`  餘額: ${agent.balance}`);
            
            if (agent.rebate_percentage !== 0.041) {
                console.log(`  ⚠️  問題: rebate_percentage 應該是 0.041，但實際是 ${agent.rebate_percentage}`);
            }
            if (agent.max_rebate_percentage !== 0.041) {
                console.log(`  ⚠️  問題: max_rebate_percentage 應該是 0.041，但實際是 ${agent.max_rebate_percentage}`);
            }
        }
        
        // 查詢所有代理的退水設定
        console.log('\n\n=== 所有代理退水設定 ===');
        const allAgentsQuery = `
            SELECT 
                username, 
                market_type, 
                level,
                parent_id,
                rebate_percentage,
                max_rebate_percentage,
                balance
            FROM agents 
            ORDER BY market_type, level, username
        `;
        
        const allAgentsResult = await client.query(allAgentsQuery);
        
        let aMarketTotal = 0;
        let dMarketTotal = 0;
        
        console.log('\nA 盤代理:');
        allAgentsResult.rows.filter(a => a.market_type === 'A').forEach(agent => {
            const rebatePercent = (agent.rebate_percentage * 100).toFixed(3);
            console.log(`  ${agent.username}: ${rebatePercent}% (層級: ${agent.level}, parent_id: ${agent.parent_id || '無'}, 餘額: ${agent.balance})`);
            aMarketTotal += parseFloat(agent.rebate_percentage || 0);
        });
        console.log(`A 盤總退水: ${(aMarketTotal * 100).toFixed(3)}%`);
        
        console.log('\nD 盤代理:');
        allAgentsResult.rows.filter(a => a.market_type === 'D').forEach(agent => {
            const rebatePercent = (agent.rebate_percentage * 100).toFixed(3);
            console.log(`  ${agent.username}: ${rebatePercent}% (層級: ${agent.level}, parent_id: ${agent.parent_id || '無'}, 餘額: ${agent.balance})`);
            dMarketTotal += parseFloat(agent.rebate_percentage || 0);
        });
        console.log(`D 盤總退水: ${(dMarketTotal * 100).toFixed(3)}%`);
        
        // 檢查代理階層關係
        console.log('\n\n=== 代理階層關係 ===');
        const hierarchyQuery = `
            SELECT 
                a1.username as agent,
                a1.market_type,
                a1.level,
                a1.rebate_percentage,
                a2.username as parent_agent,
                a2.rebate_percentage as parent_rebate
            FROM agents a1
            LEFT JOIN agents a2 ON a1.parent_id = a2.id
            ORDER BY a1.market_type, a1.level, a1.username
        `;
        
        const hierarchyResult = await client.query(hierarchyQuery);
        
        hierarchyResult.rows.forEach(rel => {
            const rebatePercent = (rel.rebate_percentage * 100).toFixed(3);
            const parentRebate = rel.parent_rebate ? (rel.parent_rebate * 100).toFixed(3) : 'N/A';
            console.log(`${rel.agent} (${rel.market_type}): ${rebatePercent}% <- ${rel.parent_agent || '頂層'} (${parentRebate}%)`);
        });
        
        // 檢查最近的退水分配記錄
        console.log('\n\n=== 最近的退水分配記錄 ===');
        const recentRebateQuery = `
            SELECT 
                agent_username,
                amount,
                bet_amount,
                percentage,
                period,
                created_at
            FROM agent_rebates 
            WHERE agent_username IN ('ti2025A', 'ti2025D', 'justin2025A')
            ORDER BY created_at DESC
            LIMIT 10
        `;
        
        const recentRebateResult = await client.query(recentRebateQuery);
        
        if (recentRebateResult.rows.length > 0) {
            recentRebateResult.rows.forEach(rebate => {
                console.log(`${rebate.agent_username}: +${rebate.amount}元 (下注: ${rebate.bet_amount}元, 比例: ${rebate.percentage}%, 期數: ${rebate.period}, 時間: ${rebate.created_at})`);
            });
        } else {
            console.log('未找到最近的退水記錄');
        }
        
        // 分析問題
        console.log('\n\n=== 問題分析 ===');
        
        const ti2025A = ti2025AResult.rows[0];
        if (ti2025A && ti2025A.rebate_percentage !== 0.011) {
            console.log('❌ ti2025A 退水設定錯誤:');
            console.log(`   目前: ${(ti2025A.rebate_percentage * 100).toFixed(3)}%`);
            console.log(`   應該: 1.1%`);
            console.log(`   修正 SQL: UPDATE agents SET rebate_percentage = 0.011, max_rebate_percentage = 0.011 WHERE username = 'ti2025A';`);
        } else if (ti2025A) {
            console.log('✅ ti2025A 退水設定正確');
        }
        
        const ti2025D = ti2025DResult.rows[0];
        if (ti2025D && ti2025D.rebate_percentage === 0.041) {
            console.log('✅ ti2025D 退水設定正確');
        } else if (ti2025D) {
            console.log('❓ ti2025D 退水設定檢查');
        }
        
        if (aMarketTotal > 0.011) {
            console.log(`❌ A 盤總退水超標: ${(aMarketTotal * 100).toFixed(3)}% > 1.1%`);
        } else {
            console.log('✅ A 盤總退水在限制內');
        }
        
        if (dMarketTotal > 0.041) {
            console.log(`❌ D 盤總退水超標: ${(dMarketTotal * 100).toFixed(3)}% > 4.1%`);
        } else {
            console.log('✅ D 盤總退水在限制內');
        }
        
    } catch (error) {
        console.error('檢查退水設定時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

checkTi2025RebateAnalysis();
