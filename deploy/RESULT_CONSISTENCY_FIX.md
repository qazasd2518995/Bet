# 开奖结果一致性问题修复报告

## 问题描述

期号 20250718493 出现开奖结果显示与结算不一致的问题：
- 结算时使用的结果：第1名是2号（正确）
- 资料库显示的结果：第1名是7号（错误）

## 根本原因

`result_history` 表有两种储存开奖结果的方式：
1. `result` 栏位 - JSON 格式的阵列
2. `position_1` 到 `position_10` 栏位 - 个别储存每个位置的号码

问题发生在 `db/models/game.js` 中的某些 INSERT/UPDATE 语句只更新了 `result` 栏位，没有同时更新 `position_*` 栏位，导致两者不一致。

## 修复方案

### 1. 修复历史资料
- 执行 `fix-result-json-consistency.js` 修复了所有不一致的记录
- 以 `position_*` 栏位为准，更新 `result` JSON 栏位

### 2. 修正程式码
修改 `db/models/game.js` 中的三处 SQL 语句：

#### a) INSERT 语句（第122-129行）
```javascript
// 修改前：只插入 period 和 result
INSERT INTO result_history (period, result) VALUES ($1, $2)

// 修改后：同时插入所有 position_* 栏位
INSERT INTO result_history (
  period, result,
  position_1, position_2, position_3, position_4, position_5,
  position_6, position_7, position_8, position_9, position_10
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
```

#### b) INSERT ON CONFLICT 语句（第107-122行）
```javascript
// 修改后：确保 ON CONFLICT 时也更新所有 position_* 栏位
ON CONFLICT (period) DO UPDATE SET
  result = EXCLUDED.result,
  position_1 = EXCLUDED.position_1, position_2 = EXCLUDED.position_2,
  ...
```

#### c) UPDATE 语句（第83-91行、第152-160行）
```javascript
// 修改后：UPDATE 时同时更新所有栏位
UPDATE result_history 
SET result = $1,
    position_1 = $3, position_2 = $4, ..., position_10 = $12,
    created_at = CURRENT_TIMESTAMP 
WHERE period = $2
```

### 3. 新增辅助函数
创建 `ensure-result-consistency.js` 提供：
- `ensureResultConsistency(period)` - 验证并修复单个期号的一致性
- `getDrawResult(period)` - 统一使用 position_* 栏位获取结果
- `getDrawResults(limit)` - 批量获取结果

## 预防措施

1. **统一数据源**：前端应该统一使用 `position_*` 栏位，而不是 `result` JSON
2. **保存时验证**：每次保存后立即验证两种格式是否一致
3. **使用辅助函数**：使用 `getDrawResult()` 函数确保获取正确的数据

## 影响范围

- 修复了共 29 笔历史记录的不一致问题
- 期号 20250718493 现在正确显示第1名是2号
- 未来的开奖结果将自动保持一致性

## 后续建议

1. 考虑移除 `result` JSON 栏位，只使用 `position_*` 栏位
2. 或者建立资料库触发器，确保两者始终同步
3. 监控系统日志，确保不再出现类似问题