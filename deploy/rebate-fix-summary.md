# 退水计算修正总结

## 问题描述
justin111 是 A盘会员（通过代理 justin2025A），但系统错误地使用了 D盘的 4.1% 退水池，而应该使用 A盘的 1.1% 退水池。

## 问题原因
`agentBackend.js` 中的 `getAgentChainForMember` 函数在查询代理资讯时，没有包含 `market_type` 栏位，导致退水计算逻辑无法正确判断代理的盘口类型。

## 代理链关系
- 会员: justin111 (A盘)
- 直属代理: justin2025A (Level 1, A盘, 退水 0.5%)
- 上级代理: ti2025A (Level 0, A盘, 退水 1.1%)

## 修正内容

### 1. agentBackend.js (第 3047-3062 行)
```javascript
// 原始代码
const agent = await db.oneOrNone(`
  SELECT id, username, level, rebate_mode, rebate_percentage, max_rebate_percentage, parent_id
  FROM agents 
  WHERE id = $1 AND status = 1
`, [currentAgentId]);

// 修正后
const agent = await db.oneOrNone(`
  SELECT id, username, level, rebate_mode, rebate_percentage, max_rebate_percentage, parent_id, market_type
  FROM agents 
  WHERE id = $1 AND status = 1
`, [currentAgentId]);

// 并在返回对象中添加
market_type: agent.market_type || 'D'  // 添加 market_type，预设为 D 盘
```

### 2. deploy/agentBackend.js
同样的修改已应用到部署目录中的文件。

## 退水计算逻辑（已正确实现）

### enhanced-settlement-system.js (第 509-510 行)
```javascript
const directAgent = agentChain[0]; // 第一个是直属代理
const maxRebatePercentage = directAgent.market_type === 'A' ? 0.011 : 0.041; // A盘1.1%, D盘4.1%
```

### backend.js (第 3005-3007 行)
```javascript
const directAgent = agentChain[0]; // 第一个是直属代理
const maxRebatePercentage = directAgent.market_type === 'A' ? 0.011 : 0.041; // A盘1.1%, D盘4.1%
const totalRebatePool = parseFloat(betAmount) * maxRebatePercentage; // 固定总池
```

## 修正后的退水计算范例
假设 justin111 下注 1000 元：
- 总退水池: 11 元 (1.1%)
- justin2025A 获得: 5 元 (0.5%)
- ti2025A 获得: 6 元 (0.6%)
- 平台保留: 0 元

## 部署步骤
1. 确保 agentBackend.js 和 deploy/agentBackend.js 都已更新
2. 重新部署代理系统到 Render
3. 验证 API 返回的代理链包含正确的 market_type 栏位

## 验证方法
使用 test-local-agent-chain.js 脚本可以验证修正是否生效：
```bash
node test-local-agent-chain.js
```

预期输出应显示：
- 直属代理的盘口类型为 A
- 总退水池为 1.1%
- 正确的退水分配金额