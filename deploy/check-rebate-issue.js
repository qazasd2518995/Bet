import db from './db/config.js';

async function checkRebateIssue() {
  try {
    console.log('=== 检查退水计算问题 ===\n');

    // 1. 检查 justin2025A 的代理链关系
    console.log('1. 检查 justin2025A 的代理链关系：');
    const memberQuery = `
      WITH RECURSIVE agent_chain AS (
        -- 起始：找到会员的直属代理
        SELECT 
          m.username as member_username,
          m.agent_id,
          m.market_type as member_market_type,
          a.id,
          a.username,
          a.parent_id,
          a.level,
          a.rebate_percentage,
          a.market_type,
          1 as chain_level
        FROM members m
        JOIN agents a ON m.agent_id = a.id
        WHERE m.username = 'justin2025A'
        
        UNION ALL
        
        -- 递回：找上级代理
        SELECT 
          ac.member_username,
          ac.agent_id,
          ac.member_market_type,
          a.id,
          a.username,
          a.parent_id,
          a.level,
          a.rebate_percentage,
          a.market_type,
          ac.chain_level + 1
        FROM agent_chain ac
        JOIN agents a ON ac.parent_id = a.id
      )
      SELECT * FROM agent_chain
      ORDER BY chain_level;
    `;
    
    const agentChain = await db.query(memberQuery);
    console.log('代理链：');
    agentChain.forEach(agent => {
      console.log(`  层级 ${agent.chain_level}: ${agent.username} (Level: ${agent.level}, 盘口: ${agent.market_type}, 退水: ${agent.rebate_percentage}%)`);
    });
    
    if (agentChain.length > 0) {
      console.log(`\n会员 justin2025A 的盘口类型: ${agentChain[0].member_market_type || '未设定（跟随代理）'}`);
      console.log(`直属代理 ${agentChain[0].username} 的盘口类型: ${agentChain[0].market_type}`);
    }

    // 2. 检查最近的投注记录
    console.log('\n2. 检查 justin2025A 最近的投注记录：');
    const betsQuery = `
      SELECT 
        b.id,
        b.member_id,
        b.amount,
        b.rebate_amount,
        b.agent_chain,
        b.created_at,
        ROUND((b.rebate_amount / b.amount * 100)::numeric, 2) as rebate_percentage
      FROM bet_history b
      JOIN members m ON b.member_id = m.id
      WHERE m.username = 'justin2025A'
      ORDER BY b.created_at DESC
      LIMIT 5;
    `;
    
    const bets = await db.query(betsQuery);
    console.log('最近投注：');
    bets.forEach(bet => {
      console.log(`\n  投注ID: ${bet.id}`);
      console.log(`  金额: ${bet.amount}, 退水: ${bet.rebate_amount}, 退水率: ${bet.rebate_percentage}%`);
      console.log(`  代理链: ${bet.agent_chain}`);
      console.log(`  时间: ${new Date(bet.created_at).toLocaleString()}`);
    });

    // 3. 检查退水分配记录
    console.log('\n3. 检查退水分配详情：');
    if (bets.length > 0) {
      const betId = bets[0].id;
      const rebateQuery = `
        SELECT 
          tr.bet_id,
          tr.agent_id,
          a.username,
          a.market_type,
          a.level,
          a.rebate_percentage,
          tr.type,
          tr.amount,
          tr.description
        FROM transaction_records tr
        JOIN agents a ON tr.agent_id = a.id
        WHERE tr.type = 'rebate' AND tr.bet_id = $1
        ORDER BY a.level;
      `;
      
      const rebateRecords = await db.query(rebateQuery, [betId]);
      console.log(`\n最近一笔投注（ID: ${betId}）的退水分配：`);
      let totalRebate = 0;
      rebateRecords.forEach(record => {
        totalRebate += parseFloat(record.amount);
        console.log(`  ${record.username} (Level ${record.level}, ${record.market_type}盘, 退水${record.rebate_percentage}%): ${record.amount}`);
      });
      console.log(`  总退水: ${totalRebate.toFixed(2)}`);
      
      if (bets[0].amount) {
        const totalRebatePercent = (totalRebate / bets[0].amount * 100).toFixed(2);
        console.log(`  总退水率: ${totalRebatePercent}%`);
      }
    }

    // 4. 分析问题
    console.log('\n=== 问题分析 ===');
    if (agentChain.length > 0 && bets.length > 0) {
      const directAgent = agentChain[0];
      const avgRebatePercent = bets.reduce((sum, bet) => sum + parseFloat(bet.rebate_percentage || 0), 0) / bets.length;
      
      console.log(`\n退水计算分析：`);
      console.log(`- 会员直属代理: ${directAgent.username} (${directAgent.market_type}盘)`);
      console.log(`- 平均退水率: ${avgRebatePercent.toFixed(2)}%`);
      
      if (directAgent.market_type === 'A') {
        console.log(`- A盘标准退水池: 1.1%`);
        if (avgRebatePercent > 2) {
          console.log(`\n❌ 问题确认：A盘会员使用了过高的退水率！`);
          console.log(`   应该使用 1.1% 的总退水池，但实际使用了约 ${avgRebatePercent.toFixed(2)}%`);
          console.log(`   可能原因：系统错误地使用了 D盘的 4.1% 退水池`);
        }
      } else if (directAgent.market_type === 'D') {
        console.log(`- D盘标准退水池: 4.1%`);
        if (avgRebatePercent > 4.1) {
          console.log(`\n⚠️  退水率超过D盘标准！`);
        }
      }
    }

    // 5. 检查结算系统文件
    console.log('\n5. 寻找结算系统文件：');
    const { readdirSync } = await import('fs');
    const files = readdirSync('.');
    const settlementFiles = files.filter(f => 
      f.includes('settlement') || 
      f.includes('rebate') || 
      f === 'backend.js' || 
      f === 'agentBackend.js'
    );
    
    console.log('相关文件：');
    settlementFiles.forEach(file => {
      console.log(`  - ${file}`);
    });

  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    process.exit();
  }
}

checkRebateIssue();