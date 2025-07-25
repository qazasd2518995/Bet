# 子帐号功能实现说明

## 功能概述

为代理管理系统新增了子帐号功能，每个代理可以创建最多 2 个子帐号。子帐号只能查看报表，无法进行其他操作。

## 实现内容

### 1. 前端修改

#### 导航栏更新
- 将「帐号管理」改为下拉选单，包含：
  - 代理＆会员
  - 子帐号

#### 新增子帐号管理页面
- 显示子帐号列表
- 新增子帐号按钮（最多 2 个）
- 子帐号操作：启用/停用、删除

#### 子帐号权限限制
- 子帐号登入后只显示「报表查询」选项
- 隐藏所有其他功能选单
- 自动切换到报表查询页面

### 2. 后端实现

#### 数据库表结构
```sql
CREATE TABLE sub_accounts (
    id SERIAL PRIMARY KEY,
    parent_agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    status INTEGER DEFAULT 1, -- 1: 启用, 0: 停用
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### API 端点
- `GET /api/agent/subaccounts` - 获取子帐号列表
- `POST /api/agent/subaccounts` - 创建子帐号
- `PUT /api/agent/subaccounts/:id/status` - 更新子帐号状态
- `DELETE /api/agent/subaccounts/:id` - 删除子帐号

#### 登入修改
- 支持子帐号登入
- 返回 `is_sub_account: true` 标记
- 记录子帐号登入日志

### 3. 使用说明

1. **创建子帐号**
   - 登入代理帐号
   - 进入「帐号管理」→「子帐号」
   - 点击「新增子帐号」
   - 输入子帐号名称和密码

2. **子帐号登入**
   - 使用子帐号名称和密码登入
   - 登入后只能看到「报表查询」功能
   - 无法进行其他操作

3. **管理子帐号**
   - 可以启用/停用子帐号
   - 可以删除子帐号
   - 每个代理最多 2 个子帐号

## 文件修改清单

### 前端
- `/agent/frontend/index.html` - 添加子帐号页面和模态框
- `/agent/frontend/js/main.js` - 添加子帐号相关逻辑

### 后端
- `/agentBackend.js` - 添加子帐号 API 和修改登入逻辑

### 数据库
- `/create-subaccounts-table.sql` - 创建表的 SQL
- `/init-subaccounts.js` - 初始化脚本
- `/check-subaccounts-table.js` - 检查和重建表脚本

## 注意事项

1. 子帐号使用父代理的 ID 进行报表查询
2. 子帐号无法修改任何数据
3. 子帐号的密码使用 bcrypt 加密
4. 删除代理时会自动删除其所有子帐号（CASCADE）