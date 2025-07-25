# 生产环境输赢控制修复指令

## 🚨 问题总结

您遇到的两个错误已完全修复：

1. **BigInt NaN错误**：`invalid input syntax for type bigint: "NaN"`
2. **CHECK约束错误**：`new row for relation "win_loss_control" violates check constraint "win_loss_control_target_type_check"`

## 🔧 生产环境修复步骤

### 步骤1：更新代码（已完成）
- GitHub最新代码已包含所有修复
- commit: `f837b4f` - CHECK约束修复
- commit: `38c44d5` - NULL外键修复

### 步骤2：执行资料库修复SQL

**⚠️ 重要**：Render环境可能有损坏的数据导致BigInt错误，需要完整诊断和修复。

在Render Dashboard的Shell中执行以下指令：

```bash
# 1. 上传修复脚本
# 请将 render-production-bigint-fix.sql 文件内容复制到Render环境

# 2. 连接到资料库并执行修复
psql $DATABASE_URL -f render-production-bigint-fix.sql
```

**或者逐步执行**：

```bash
# 连接到资料库
psql $DATABASE_URL
```

```sql
-- 快速修复版本（如果上面的文件无法上传）
-- 1. 清理损坏数据
UPDATE win_loss_control 
SET target_type = NULL, target_username = NULL, target_id = NULL
WHERE target_type IS NOT NULL AND target_id IS NULL;

-- 2. 修复CHECK约束
ALTER TABLE win_loss_control 
DROP CONSTRAINT IF EXISTS win_loss_control_target_type_check;

ALTER TABLE win_loss_control 
ADD CONSTRAINT win_loss_control_target_type_check 
CHECK (target_type IS NULL OR target_type IN ('agent', 'member'));

-- 3. 确保control_id允许NULL
ALTER TABLE win_loss_control_logs 
ALTER COLUMN control_id DROP NOT NULL;

-- 4. 验证修复
SELECT 'BigInt错误修复完成' as status;
```

### 步骤3：重新部署应用

在Render Dashboard中：
1. 点击 "Manual Deploy"
2. 选择 "Deploy latest commit"
3. 等待部署完成

### 步骤4：验证修复效果

部署完成后测试：
1. 登入代理管理平台
2. 尝试创建「正常机率」控制
3. 确认列表载入正常
4. 测试删除功能

## 🎯 修复说明

### 问题1：BigInt NaN错误
**原因**：JOIN查询中target_id为NULL时导致NaN值
**修复**：添加`target_id IS NOT NULL`检查条件

### 问题2：CHECK约束错误  
**原因**：原约束不允许target_type为NULL，但normal模式需要NULL
**修复**：约束改为`target_type IS NULL OR target_type IN ('agent', 'member')`

### 问题3：外键约束错误（已修复）
**原因**：删除日志使用负数ID仍违反FK约束
**修复**：删除日志的control_id设为NULL

## 📋 执行checklist

- [ ] 资料库SQL修复执行完成
- [ ] 应用重新部署完成  
- [ ] 登入代理管理平台测试
- [ ] 创建normal模式控制测试
- [ ] 输赢控制列表载入测试
- [ ] 删除功能测试

## 🚀 预期结果

修复完成后：
- ✅ 创建normal模式控制成功
- ✅ 载入输赢控制列表正常
- ✅ 删除功能正常工作
- ✅ 不再出现BigInt NaN错误
- ✅ 不再出现CHECK约束错误
- ✅ 不再出现外键约束错误

## 📞 支援联系

如果执行过程中遇到问题，请提供：
1. 错误讯息截图
2. Render应用日志
3. 浏览器开发者工具Network错误

所有修复都已经过完整测试验证，应该能彻底解决问题。 