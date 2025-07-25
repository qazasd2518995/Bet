// 新增: 批量扣除会员余额API（用于多笔下注）
// 这段代码应该插入到 agentBackend.js 的第 6942 行之后
// 即在 deduct-member-balance API 结束后，登录日志API 开始前

app.post(`${API_PREFIX}/batch-deduct-member-balance`, async (req, res) => {
  const { username, bets } = req.body;
  
  console.log(`收到批量扣除会员余额请求: 会员=${username}, 下注笔数=${bets?.length || 0}`);
  
  try {
    if (!username || !bets || !Array.isArray(bets) || bets.length === 0) {
      return res.json({
        success: false,
        message: '请提供会员用户名和下注列表'
      });
    }
    
    // 验证所有下注金额
    for (let i = 0; i < bets.length; i++) {
      const bet = bets[i];
      if (!bet.amount || parseFloat(bet.amount) <= 0) {
        return res.json({
          success: false,
          message: `第 ${i + 1} 笔下注金额无效`
        });
      }
    }
    
    // 生成每笔下注的唯一ID
    const betsWithIds = bets.map((bet, index) => ({
      amount: parseFloat(bet.amount),
      bet_id: bet.bet_id || `bet_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
    }));
    
    try {
      // 使用批量扣款函数
      const result = await db.one(`
        SELECT * FROM batch_bet_deduction($1, $2::jsonb)
      `, [username, JSON.stringify(betsWithIds)]);
      
      if (result.success) {
        console.log(`成功批量扣除会员 ${username} 余额，总金额: ${result.total_deducted} 元，新余额: ${result.balance}`);
        
        // 记录交易历史
        try {
          const member = await MemberModel.findByUsername(username);
          if (member) {
            await db.none(`
              INSERT INTO transaction_records 
              (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, ['member', member.id, -result.total_deducted, 'game_bet', 
                parseFloat(result.balance) + parseFloat(result.total_deducted), 
                parseFloat(result.balance), 
                `批量下注 ${bets.length} 笔`]);
          }
        } catch (logError) {
          console.error('记录交易历史失败:', logError);
          // 不影响主要操作
        }
        
        res.json({
          success: true,
          message: '批量余额扣除成功',
          balance: parseFloat(result.balance),
          totalDeducted: parseFloat(result.total_deducted),
          processedBets: betsWithIds,
          failedBets: result.failed_bets || []
        });
      } else {
        console.log(`批量扣除余额失败: ${result.message}`);
        res.json({
          success: false,
          message: result.message,
          balance: parseFloat(result.balance),
          failedBets: result.failed_bets || bets
        });
      }
    } catch (dbError) {
      console.error('执行批量扣款函数失败:', dbError);
      
      // 如果函数不存在，降级到逐笔处理
      if (dbError.code === '42883') { // function does not exist
        console.log('批量扣款函数不存在，降级到逐笔处理');
        
        // 使用事务逐笔处理
        let totalDeducted = 0;
        let finalBalance = 0;
        const processedBets = [];
        const failedBets = [];
        
        try {
          await db.tx(async t => {
            // 先检查总余额是否足够
            const member = await t.oneOrNone('SELECT * FROM members WHERE username = $1 FOR UPDATE', [username]);
            if (!member) {
              throw new Error('会员不存在');
            }
            
            const totalAmount = betsWithIds.reduce((sum, bet) => sum + bet.amount, 0);
            if (parseFloat(member.balance) < totalAmount) {
              throw new Error('余额不足');
            }
            
            // 执行批量扣款
            finalBalance = await t.one(`
              UPDATE members 
              SET balance = balance - $1 
              WHERE username = $2 
              RETURNING balance
            `, [totalAmount, username]).then(r => parseFloat(r.balance));
            
            totalDeducted = totalAmount;
            processedBets.push(...betsWithIds);
          });
          
          console.log(`降级处理成功: 总扣款 ${totalDeducted} 元，新余额 ${finalBalance}`);
          
          res.json({
            success: true,
            message: '批量余额扣除成功（降级处理）',
            balance: finalBalance,
            totalDeducted: totalDeducted,
            processedBets: processedBets,
            failedBets: failedBets
          });
        } catch (txError) {
          console.error('降级处理失败:', txError);
          res.json({
            success: false,
            message: txError.message || '批量扣款失败',
            failedBets: betsWithIds
          });
        }
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('批量扣除会员余额出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
}); 