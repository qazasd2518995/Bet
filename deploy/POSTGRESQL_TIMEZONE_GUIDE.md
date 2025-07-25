# PostgreSQL 时区设定完整指南

## 问题说明
PostgreSQL 预设使用 UTC 时间，这导致储存的时间与台北时间相差 8 小时。

## 解决方案

### 方案 1：修改资料库时区设定（推荐用于自己管理的资料库）

```sql
-- 1. 设定当前会话的时区
SET timezone = 'Asia/Taipei';

-- 2. 设定整个资料库的时区
ALTER DATABASE bet_game SET timezone TO 'Asia/Taipei';

-- 3. 验证设定
SHOW timezone;
SELECT NOW();
```

**注意**：在 Render 等云端服务上，可能没有权限修改资料库层级的时区设定。

### 方案 2：使用 TIMESTAMP WITH TIME ZONE（最佳实践）

```sql
-- 修改表格栏位类型
ALTER TABLE result_history 
ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN draw_time TYPE TIMESTAMP WITH TIME ZONE;

-- 设定预设值
ALTER TABLE result_history 
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN draw_time SET DEFAULT CURRENT_TIMESTAMP;
```

### 方案 3：在应用程式层处理（最灵活）

这是我们已经实施的方案，在 Node.js 中：

```javascript
// 储存时使用 JavaScript Date
const drawTime = new Date().toISOString();

// 或者使用 moment.js 处理时区
import moment from 'moment-timezone';
const drawTime = moment().tz('Asia/Taipei').format();
```

### 方案 4：使用 PostgreSQL 函数

```sql
-- 创建取得台北时间的函数
CREATE OR REPLACE FUNCTION get_taipei_time() 
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei';
END;
$$ LANGUAGE plpgsql;

-- 在插入时使用
INSERT INTO result_history (period, draw_time) 
VALUES ('20250725100', get_taipei_time());
```

## Render PostgreSQL 特别注意事项

在 Render 的 PostgreSQL 上，您可能遇到以下限制：

1. **无法修改系统时区**：Render 的资料库时区固定为 UTC
2. **无法使用 ALTER SYSTEM**：没有超级用户权限
3. **建议方案**：
   - 使用 `TIMESTAMP WITH TIME ZONE` 类型
   - 在应用程式层处理时区转换
   - 插入时明确指定时区

## 最佳实践建议

1. **始终使用 TIMESTAMP WITH TIME ZONE**
   ```sql
   CREATE TABLE example (
       id SERIAL PRIMARY KEY,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **在查询时转换时区**
   ```sql
   SELECT 
       period,
       created_at AT TIME ZONE 'Asia/Taipei' as taipei_time
   FROM result_history;
   ```

3. **在应用程式中统一处理**
   - 储存：始终储存 UTC 时间
   - 显示：在前端转换为使用者的本地时区

## 检查和诊断指令

```sql
-- 检查当前设定
SHOW timezone;
SHOW log_timezone;

-- 检查可用时区
SELECT * FROM pg_timezone_names WHERE name LIKE '%Taipei%';

-- 测试时区转换
SELECT 
    NOW() as "UTC时间",
    NOW() AT TIME ZONE 'Asia/Taipei' as "台北时间",
    NOW() AT TIME ZONE 'America/New_York' as "纽约时间";
```

## 结论

对于 Render PostgreSQL，最实用的方案是：
1. 保持资料库时区为 UTC（因为无法更改）
2. 使用 `TIMESTAMP WITH TIME ZONE` 类型
3. 在应用程式层（Node.js）处理时区转换
4. 前端显示时使用 `toLocaleString` 转换为正确时区

这就是为什么我们修改了 `fixed-draw-system.js` 中的程式码，使用 `new Date().toISOString()` 来确保储存正确的时间戳记。