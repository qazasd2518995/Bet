// backend.js 中 settleBets 函数的修复版本
// 将此代码整合到现有的 backend.js 中

async function settleBets(period, winResult) {
  console.log(`结算第${period}期注单...`);
  
  // 获取系统时间内未结算的注单
  const bets = await BetModel.getUnsettledByPeriod(period);
  
  console.log(`找到${bets.length}个未结算注单`);
  
  if (bets.length === 0) {
    console.log(`第${period}期注单结算完成`);
    return;
  }
  
  // 获取总代理ID
  const adminAgent = await getAdminAgentId();
  if (!adminAgent) {
    console.error('结算注单失败: 找不到总代理帐户');
    return;
  }
  
  // 使用事务处理整个批次结算过程，确保原子性
  try {
    // 遍历并结算每个注单
    for (const bet of bets) {
      try {
        const username = bet.username;
        
        // 计算赢钱金额
        const winAmount = calculateWinAmount(bet, winResult);
        const isWin = winAmount > 0;
        
        console.log(`结算用户 ${username} 的注单 ${bet.id}，下注类型: ${bet.bet_type}，下注值: ${bet.bet_value}，赢钱金额: ${winAmount}`);
        
        // 标记为已结算 - 使用修改过的 updateSettlement 方法，防止重复结算
        const settledBet = await BetModel.updateSettlement(bet.id, isWin, winAmount);
        
        // 如果没有成功结算（可能已经被结算过），则跳过后续处理
        if (!settledBet) {
          console.log(`注单 ${bet.id} 已结算过或不存在，跳过处理`);
          continue;
        }
        
        // 如果赢了，直接增加会员余额（不从代理扣除）
        if (isWin) {
          try {
            // 获取当前余额用于日志记录
            const currentBalance = await getBalance(username);
            
            // 用户下注时已扣除本金，中奖时应返还总奖金
            const betAmount = parseFloat(bet.amount);
            const totalWinAmount = parseFloat(winAmount); // 这是总回报（含本金）
            const netProfit = totalWinAmount - betAmount; // 纯奖金部分
            
            console.log(`🎯 结算详情: 下注 ${betAmount} 元，总回报 ${totalWinAmount} 元，纯奖金 ${netProfit} 元`);
            
            // 原子性增加会员余额（增加总回报，因为下注时已扣除本金）
            const newBalance = await UserModel.addBalance(username, totalWinAmount);
            
            // 生成唯一的交易ID，用于防止重复处理
            const txId = `win_${bet.id}_${Date.now()}`;
            
            // 只同步余额到代理系统（不扣代理点数）
            try {
              await fetch(`${AGENT_API_URL}/api/agent/sync-member-balance`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  username: username,
                  balance: newBalance,
                  transactionId: txId, // 添加唯一交易ID
                  reason: `第${period}期中奖 ${bet.bet_type}:${bet.bet_value} (下注${betAmount}元，总回报${totalWinAmount}元，纯奖金${netProfit}元)`
                })
              });
            } catch (syncError) {
              console.warn('同步余额到代理系统失败，但会员余额已更新:', syncError);
            }
            
            console.log(`用户 ${username} 中奖结算: 下注${betAmount}元 → 总回报${totalWinAmount}元 → 纯奖金${netProfit}元，余额从 ${currentBalance} 更新为 ${newBalance}`);
          } catch (error) {
            console.error(`更新用户 ${username} 中奖余额失败:`, error);
          }
        }
        
        // 在结算时分配退水给代理（不论输赢，基于下注金额）
        try {
          // 生成唯一的退水交易ID
          const rebateTxId = `rebate_${bet.id}_${Date.now()}`;
          await distributeRebate(username, parseFloat(bet.amount), period, rebateTxId);
          console.log(`已为会员 ${username} 的注单 ${bet.id} 分配退水到代理 (交易ID: ${rebateTxId})`);
        } catch (rebateError) {
          console.error(`分配退水失败 (注单ID=${bet.id}):`, rebateError);
        }
      } catch (error) {
        console.error(`结算用户注单出错 (ID=${bet.id}):`, error);
      }
    }
  } catch (batchError) {
    console.error(`批量结算注单时发生错误:`, batchError);
  }
  
  console.log(`第${period}期注单结算完成`);
}

// 修改退水分配函数，添加交易ID防止重复处理
async function distributeRebate(username, betAmount, period, transactionId = null) {
  try {
    console.log(`开始为会员 ${username} 分配退水，下注金额: ${betAmount}`);
    
    // 生成唯一交易ID，如果没有提供
    const txId = transactionId || `rebate_${username}_${period}_${Date.now()}`;
    
    // 获取会员的代理链来确定最大退水比例
    const agentChain = await getAgentChain(username);
    if (!agentChain || agentChain.length === 0) {
      console.log(`会员 ${username} 没有代理链，退水归平台所有`);
      return;
    }
    
    // 计算固定的总退水池（根据盘口类型）
    const directAgent = agentChain[0]; // 第一个是直属代理
    const maxRebatePercentage = directAgent.market_type === 'A' ? 0.011 : 0.041; // A盘1.1%, D盘4.1%
    const totalRebatePool = parseFloat(betAmount) * maxRebatePercentage; // 固定总池
    
    console.log(`会员 ${username} 的代理链:`, agentChain.map(a => `${a.username}(L${a.level}-${a.rebate_mode}:${(a.rebate_percentage*100).toFixed(1)}%)`));
    console.log(`固定退水池: ${totalRebatePool.toFixed(2)} 元 (${(maxRebatePercentage*100).toFixed(1)}%)`);
    
    // 按层级顺序分配退水，上级只拿差额
    let remainingRebate = totalRebatePool;
    let distributedPercentage = 0; // 已经分配的退水比例
    
    for (let i = 0; i < agentChain.length; i++) {
      const agent = agentChain[i];
      let agentRebateAmount = 0;
      
      // 如果没有剩余退水，结束分配
      if (remainingRebate <= 0.01) {
        console.log(`退水池已全部分配完毕`);
        break;
      }
      
      const rebatePercentage = parseFloat(agent.rebate_percentage);
      
      if (isNaN(rebatePercentage) || rebatePercentage <= 0) {
        // 退水比例为0，该代理不拿退水，全部给上级
        agentRebateAmount = 0;
        console.log(`代理 ${agent.username} 退水比例为 ${(rebatePercentage*100).toFixed(1)}%，不拿任何退水，剩余 ${remainingRebate.toFixed(2)} 元继续向上分配`);
      } else {
        // 计算该代理实际能拿的退水比例（不能超过已分配的）
        const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
        
        if (actualRebatePercentage <= 0) {
          console.log(`代理 ${agent.username} 退水比例 ${(rebatePercentage*100).toFixed(1)}% 已被下级分完，不能再获得退水`);
          agentRebateAmount = 0;
        } else {
          // 计算该代理实际获得的退水金额
          agentRebateAmount = parseFloat(betAmount) * actualRebatePercentage;
          // 确保不超过剩余退水池
          agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
          // 四舍五入到小数点后2位
          agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
          remainingRebate -= agentRebateAmount;
          distributedPercentage += actualRebatePercentage;
          
          console.log(`代理 ${agent.username} 退水比例为 ${(rebatePercentage*100).toFixed(1)}%，实际获得 ${(actualRebatePercentage*100).toFixed(1)}% = ${agentRebateAmount.toFixed(2)} 元，剩余池额 ${remainingRebate.toFixed(2)} 元`);
        }
        
        // 如果该代理的比例达到或超过最大值，说明是全拿模式
        if (rebatePercentage >= maxRebatePercentage) {
          console.log(`代理 ${agent.username} 拿了全部退水池，结束分配`);
          remainingRebate = 0;
        }
      }
      
      if (agentRebateAmount > 0) {
        // 分配退水给代理，添加交易ID防止重复处理
        await allocateRebateToAgent(agent.id, agent.username, agentRebateAmount, username, betAmount, period, `${txId}_${agent.username}`);
        console.log(`✅ 分配退水 ${agentRebateAmount.toFixed(2)} 给代理 ${agent.username} (比例: ${(parseFloat(agent.rebate_percentage)*100).toFixed(1)}%, 剩余: ${remainingRebate.toFixed(2)})`);
        
        // 如果没有剩余退水了，结束分配
        if (remainingRebate <= 0.01) {
          break;
        }
      }
    }
    
    // 剩余退水归平台所有
    if (remainingRebate > 0.01) { // 考虑浮点数精度问题
      console.log(`剩余退水池 ${remainingRebate.toFixed(2)} 元归平台所有`);
    }
    
    console.log(`✅ 退水分配完成，总池: ${totalRebatePool.toFixed(2)}元，已分配: ${(totalRebatePool - remainingRebate).toFixed(2)}元，平台保留: ${remainingRebate.toFixed(2)}元`);
    
  } catch (error) {
    console.error('分配退水时发生错误:', error);
  }
}

// 修改退水分配给代理的函数，添加交易ID
async function allocateRebateToAgent(agentId, agentUsername, amount, memberUsername, betAmount, period, transactionId = null) {
  try {
    // 生成唯一交易ID，如果没有提供
    const txId = transactionId || `rebate_${agentUsername}_${memberUsername}_${period}_${Date.now()}`;
    
    // 调用代理系统API分配退水
    const response = await fetch(`${AGENT_API_URL}/api/agent/allocate-rebate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_username: agentUsername,
        amount: amount,
        member_username: memberUsername,
        bet_amount: betAmount,
        period: period,
        transaction_id: txId // 添加交易ID防止重复处理
      })
    });
    
    if (!response.ok) {
      throw new Error(`分配退水API返回错误: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(`分配退水API操作失败: ${result.message}`);
    }
    
    return result;
  } catch (error) {
    console.error(`给代理 ${agentUsername} 分配退水失败:`, error);
    throw error;
  }
}
