# 退水計算修正總結

## 問題描述
justin111 是 A盤會員（通過代理 justin2025A），但系統錯誤地使用了 D盤的 4.1% 退水池，而應該使用 A盤的 1.1% 退水池。

## 問題原因
`agentBackend.js` 中的 `getAgentChainForMember` 函數在查詢代理資訊時，沒有包含 `market_type` 欄位，導致退水計算邏輯無法正確判斷代理的盤口類型。

## 代理鏈關係
- 會員: justin111 (A盤)
- 直屬代理: justin2025A (Level 1, A盤, 退水 0.5%)
- 上級代理: ti2025A (Level 0, A盤, 退水 1.1%)

## 修正內容

### 1. agentBackend.js (第 3047-3062 行)
```javascript
// 原始代碼
const agent = await db.oneOrNone(`
  SELECT id, username, level, rebate_mode, rebate_percentage, max_rebate_percentage, parent_id
  FROM agents 
  WHERE id = $1 AND status = 1
`, [currentAgentId]);

// 修正後
const agent = await db.oneOrNone(`
  SELECT id, username, level, rebate_mode, rebate_percentage, max_rebate_percentage, parent_id, market_type
  FROM agents 
  WHERE id = $1 AND status = 1
`, [currentAgentId]);

// 並在返回對象中添加
market_type: agent.market_type || 'D'  // 添加 market_type，預設為 D 盤
```

### 2. deploy/agentBackend.js
同樣的修改已應用到部署目錄中的文件。

## 退水計算邏輯（已正確實現）

### enhanced-settlement-system.js (第 509-510 行)
```javascript
const directAgent = agentChain[0]; // 第一個是直屬代理
const maxRebatePercentage = directAgent.market_type === 'A' ? 0.011 : 0.041; // A盤1.1%, D盤4.1%
```

### backend.js (第 3005-3007 行)
```javascript
const directAgent = agentChain[0]; // 第一個是直屬代理
const maxRebatePercentage = directAgent.market_type === 'A' ? 0.011 : 0.041; // A盤1.1%, D盤4.1%
const totalRebatePool = parseFloat(betAmount) * maxRebatePercentage; // 固定總池
```

## 修正後的退水計算範例
假設 justin111 下注 1000 元：
- 總退水池: 11 元 (1.1%)
- justin2025A 獲得: 5 元 (0.5%)
- ti2025A 獲得: 6 元 (0.6%)
- 平台保留: 0 元

## 部署步驟
1. 確保 agentBackend.js 和 deploy/agentBackend.js 都已更新
2. 重新部署代理系統到 Render
3. 驗證 API 返回的代理鏈包含正確的 market_type 欄位

## 驗證方法
使用 test-local-agent-chain.js 腳本可以驗證修正是否生效：
```bash
node test-local-agent-chain.js
```

預期輸出應顯示：
- 直屬代理的盤口類型為 A
- 總退水池為 1.1%
- 正確的退水分配金額