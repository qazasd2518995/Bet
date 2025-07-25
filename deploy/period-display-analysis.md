# 期号显示问题分析报告

## 问题描述
- 主画面显示完整期号格式：`202507241372`（YYYYMMDD + 序号）
- 历史开奖只显示当天序号：`214`、`213` 等
- 近期开奖记录也有类似问题

## 期号处理逻辑分析

### 1. 后端期号生成逻辑
在 `backend.js` 中，期号生成遵循以下规则：
```javascript
// 期号格式：YYYYMMDD + 3位序号（001-999）
// 超过999则使用4位数字
const newPeriod = parseInt(`${gameDateStr}${suffix.toString().padStart(3, '0')}`);
```

### 2. 前端期号显示逻辑

#### formatPeriodDisplay 函数（index.html 第9963-9975行）
```javascript
formatPeriodDisplay(period) {
    if (!period) return '';
    const periodStr = period.toString();
    if (periodStr.length >= 8) {
        // 将期号格式化为 YYYY-MM-DD-期数 的形式显示
        const year = periodStr.substring(0, 4);
        const month = periodStr.substring(4, 6);
        const day = periodStr.substring(6, 8);
        const num = periodStr.substring(8);
        return `${month}/${day} ${num}期`;  // 输出：07/24 1372期
    }
    return periodStr;
}
```

#### 路线图期号显示（index.html 第7553行）
```javascript
<div class="period-info">{{ cell.period.toString().slice(-3) }}</div>
```
这里使用 `slice(-3)` 只取最后3位数字。

## 问题根源

1. **formatPeriodDisplay 函数的逻辑问题**
   - 该函数将完整期号 `202507241372` 格式化为 `07/24 1372期`
   - 但在某些情况下，可能只显示序号部分 `1372期`

2. **不一致的期号处理**
   - 主画面：显示完整期号
   - 历史开奖：使用 `formatPeriodDisplay` 格式化
   - 路线图：使用 `slice(-3)` 只取最后3位

3. **序号超过999的处理**
   - 当序号超过999时（如1372），`slice(-3)` 只会显示 `372`
   - 这导致显示不完整

## 建议修复方案

### 方案1：统一显示格式
修改 `formatPeriodDisplay` 函数，根据需求统一显示格式：
```javascript
formatPeriodDisplay(period, showDate = true) {
    if (!period) return '';
    const periodStr = period.toString();
    if (periodStr.length >= 8) {
        const month = periodStr.substring(4, 6);
        const day = periodStr.substring(6, 8);
        const num = periodStr.substring(8);
        
        if (showDate) {
            return `${month}/${day} ${num}期`;
        } else {
            return `${num}期`;  // 只显示序号
        }
    }
    return periodStr;
}
```

### 方案2：修复路线图期号显示
```javascript
// 不使用 slice(-3)，改为提取序号部分
<div class="period-info">{{ cell.period.toString().substring(8) }}</div>
```

### 方案3：修改历史开奖显示逻辑
在历史开奖中保持完整期号或只显示序号，保持一致性。

## 影响范围

1. **主画面**：`frontend/index.html` - 第7892-7896行
2. **历史开奖**：`frontend/index.html` - 第7193行、第9947行
3. **近期开奖记录**：`frontend/index.html` - 第7067行
4. **路线图**：`frontend/index.html` - 第7553行

## 测试建议

1. 检查当天第1期（序号001）的显示
2. 检查序号999和1000交界处的显示
3. 检查跨日期时的期号显示
4. 确保所有位置的期号显示一致性