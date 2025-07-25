// fix-settlement-logic.js - 修复结算逻辑，防止重复结算

console.log(`
🔧 修复结算逻辑说明
===================

问题诊断：
1. 系统同时运行了两套结算逻辑：
   - improved-settlement-system.js 的 improvedSettleBets（正确）
   - backend.js 的 legacySettleBets 中的余额更新逻辑（导致重复）

2. 重复结算的流程：
   - improvedSettleBets 正确增加中奖金额（989元）
   - backend.js 第 2920 行又调用 UserModel.addBalance 增加余额
   - backend.js 第 2924-2934 行调用代理系统 sync-member-balance API
   - 代理系统执行 MemberModel.setBalance，产生 "会员点数设置" 的 adjustment 交易

修复方案：
---------
请手动修改 backend.js 文件：

1. 注释掉第 2906-2943 行的中奖处理逻辑：
   找到这段代码：
   \`\`\`javascript
   // 如果赢了，直接增加会员余额（不从代理扣除）
   if (isWin) {
     try {
       // ... 省略中间代码 ...
       // 原子性增加会员余额（增加总回报，因为下注时已扣除本金）
       const newBalance = await UserModel.addBalance(username, totalWinAmount);
       
       // 只同步余额到代理系统（不扣代理点数）
       try {
         await fetch(\`\${AGENT_API_URL}/api/agent/sync-member-balance\`, {
           // ... 省略 ...
         });
       } catch (syncError) {
         console.warn('同步余额到代理系统失败，但会员余额已更新:', syncError);
       }
       
       console.log(\`用户 \${username} 中奖结算: ...\`);
     } catch (error) {
       console.error(\`更新用户 \${username} 中奖余额失败:\`, error);
     }
   }
   \`\`\`

2. 将其替换为：
   \`\`\`javascript
   // 如果赢了，记录日志（余额更新已在 improvedSettleBets 中处理）
   if (isWin) {
     console.log(\`用户 \${username} 中奖，金额 \${winAmount}（余额更新已在 improvedSettleBets 中处理）\`);
   }
   \`\`\`

3. 或者更简单的方案，直接删除整个 legacySettleBets 函数（第 2872-2958 行），
   因为它已经被标记为"备份"，实际上不应该被使用。

预防措施：
---------
1. 确保只有 improvedSettleBets 处理结算
2. 移除所有调用 sync-member-balance API 的代码
3. 在 improved-settlement-system.js 中统一处理所有结算逻辑
4. 定期检查是否有重复的 adjustment 交易

测试建议：
---------
修改后请进行以下测试：
1. 下注 900 元（9个号码各 100 元）
2. 确认余额减少 900 元
3. 等待开奖并中奖
4. 确认余额增加 989 元（而不是 1978 元）
5. 检查交易记录，应该只有一笔 win 类型的交易，没有 adjustment
`);

console.log('\n请按照上述说明手动修改 backend.js 文件。');