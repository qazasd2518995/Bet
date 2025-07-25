import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: { rejectUnauthorized: false }
});

async function checkA02Issue() {
    try {
        console.log('=== 檢查 A02agent 退水問題 ===\n');
        
        // 1. 查看 A01agent 的資料
        const a01Result = await pool.query(`
            SELECT id, username, level, parent_id, rebate_percentage, max_rebate_percentage
            FROM agents
            WHERE username = 'A01agent'
        `);
        
        if (a01Result.rows.length > 0) {
            const a01 = a01Result.rows[0];
            console.log('A01agent 資料:');
            console.log(`  ID: ${a01.id}, Level: ${a01.level}`);
            console.log(`  退水: ${(a01.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`  最大退水: ${(a01.max_rebate_percentage * 100).toFixed(1)}%`);
            console.log(`  上級ID: ${a01.parent_id}`);
            
            // 2. 查看 A02agent 的資料
            const a02Result = await pool.query(`
                SELECT id, username, level, parent_id, rebate_percentage, max_rebate_percentage
                FROM agents
                WHERE username = 'A02agent'
            `);
            
            if (a02Result.rows.length > 0) {
                const a02 = a02Result.rows[0];
                console.log('\nA02agent 資料:');
                console.log(`  ID: ${a02.id}, Level: ${a02.level}`);
                console.log(`  退水: ${(a02.rebate_percentage * 100).toFixed(1)}%`);
                console.log(`  最大退水: ${(a02.max_rebate_percentage * 100).toFixed(1)}%`);
                console.log(`  上級ID: ${a02.parent_id}`);
                
                // 3. 檢查是否是父子關係
                if (a02.parent_id === a01.id) {
                    console.log('\n✓ 確認 A02agent 是 A01agent 的下級');
                    
                    // 4. 檢查最大退水是否正確
                    if (a02.max_rebate_percentage !== a01.rebate_percentage) {
                        console.log('\n✗ 問題發現: A02agent 的最大退水應該是', (a01.rebate_percentage * 100).toFixed(1) + '%');
                        console.log('  但實際是', (a02.max_rebate_percentage * 100).toFixed(1) + '%');
                        
                        // 5. 修復 A02agent 的最大退水
                        console.log('\n修復中...');
                        await pool.query(`
                            UPDATE agents
                            SET max_rebate_percentage = $1, updated_at = CURRENT_TIMESTAMP
                            WHERE id = $2
                        `, [a01.rebate_percentage, a02.id]);
                        
                        console.log('✓ 已更新 A02agent 的最大退水為', (a01.rebate_percentage * 100).toFixed(1) + '%');
                        
                        // 6. 查看所有 A01agent 的下級
                        const allChildren = await pool.query(`
                            SELECT id, username, level, rebate_percentage, max_rebate_percentage
                            FROM agents
                            WHERE parent_id = $1 AND status = 1
                            ORDER BY level, username
                        `, [a01.id]);
                        
                        console.log('\n檢查 A01agent 的所有下級:');
                        for (const child of allChildren.rows) {
                            console.log(`  ${child.username} (Level ${child.level}): 退水 ${(child.rebate_percentage * 100).toFixed(1)}%, max ${(child.max_rebate_percentage * 100).toFixed(1)}%`);
                            
                            // 修復所有不正確的最大退水
                            if (child.max_rebate_percentage !== a01.rebate_percentage) {
                                await pool.query(`
                                    UPDATE agents
                                    SET max_rebate_percentage = $1, updated_at = CURRENT_TIMESTAMP
                                    WHERE id = $2
                                `, [a01.rebate_percentage, child.id]);
                                console.log(`    → 已修復最大退水為 ${(a01.rebate_percentage * 100).toFixed(1)}%`);
                            }
                        }
                    } else {
                        console.log('\n✓ A02agent 的最大退水已經正確');
                    }
                } else {
                    console.log('\n⚠️ A02agent 不是 A01agent 的直接下級');
                    
                    // 查找 A02agent 的實際上級
                    if (a02.parent_id) {
                        const parentResult = await pool.query(`
                            SELECT id, username, rebate_percentage
                            FROM agents
                            WHERE id = $1
                        `, [a02.parent_id]);
                        
                        if (parentResult.rows.length > 0) {
                            const parent = parentResult.rows[0];
                            console.log(`  A02agent 的上級是: ${parent.username}`);
                            console.log(`  上級退水: ${(parent.rebate_percentage * 100).toFixed(1)}%`);
                        }
                    }
                }
            } else {
                console.log('\n找不到 A02agent');
            }
        } else {
            console.log('找不到 A01agent');
        }
        
    } catch (error) {
        console.error('檢查失敗:', error);
    } finally {
        await pool.end();
    }
}

checkA02Issue();