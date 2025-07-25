# Render PostgreSQL 部署指南

## 资料库连接资讯

您提供的Render PostgreSQL连接资讯：
```
postgresql://bet_game_user:Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy@dpg-d0e2imc9c44c73che3kg-a/bet_game
```

### 连接参数分解
- **主机**: `dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com`
- **端口**: `5432`
- **资料库**: `bet_game`
- **用户**: `bet_game_user`
- **密码**: `Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy`
- **SSL**: 必须启用

## 🔧 Render 环境变数设置

在Render控制台中设置以下环境变数：

### 基本应用设置
```bash
NODE_ENV=production
PORT=3002
AGENT_PORT=3003
```

### 资料库设置
```bash
DATABASE_URL=postgresql://bet_game_user:Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy@dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com/bet_game
DB_HOST=dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com
DB_PORT=5432
DB_USER=bet_game_user
DB_PASSWORD=Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy
DB_NAME=bet_game
```

### 安全设置
```bash
JWT_SECRET=生成一个强密钥
ENCRYPTION_KEY=生成32字符加密密钥
SESSION_SECRET=生成会话密钥
BCRYPT_ROUNDS=12
```

### CORS 设置
```bash
CORS_ORIGIN=https://your-app-name.onrender.com
ALLOWED_ORIGINS=https://your-game-app.onrender.com,https://your-agent-app.onrender.com
```

## 🗄️ 资料库表结构检查

执行以下脚本检查资料库：
```bash
node database-security-check.js
```

### 核心业务表
- ✅ `users` - 用户基本资料
- ✅ `agents` - 代理商资料
- ✅ `members` - 会员资料
- ✅ `bet_history` - 投注历史
- ✅ `result_history` - 开奖结果
- ✅ `game_state` - 游戏状态
- ✅ `transfer_records` - 转帐记录
- ✅ `transaction_records` - 交易记录
- ✅ `draw_records` - 开奖记录
- ✅ `announcements` - 公告资料

### 安全相关表
- 🔒 `security_logs` - 安全日志
- 🔒 `login_attempts` - 登入尝试记录
- 🔒 `user_sessions` - 会话管理
- 🔒 `audit_logs` - 审计日志
- 🔒 `ip_blacklist` - IP黑名单
- 🔒 `permissions` - 权限管理

## 📊 资料安全性保证

### 1. 连接安全
- ✅ SSL/TLS 加密连接
- ✅ 连接池管理 (最大30连接)
- ✅ 连接超时保护 (15秒)
- ✅ 查询超时保护 (15秒)

### 2. 资料加密
- ✅ 密码使用 bcrypt 加密
- ✅ 敏感资料栏位加密
- ✅ JWT Token 安全签名
- ✅ 会话资料加密

### 3. 存取控制
- ✅ 用户角色权限管理
- ✅ API 端点存取控制
- ✅ 资料库层级权限控制
- ✅ IP 白名单/黑名单

### 4. 审计追踪
- ✅ 所有操作日志记录
- ✅ 登入尝试追踪
- ✅ 资料变更审计
- ✅ 安全事件警报

## 🚀 部署步骤

### 1. 准备工作
```bash
# 1. 确保所有必要文件存在
ls -la package.json backend.js agentBackend.js

# 2. 检查资料库连接
node database-security-check.js

# 3. 测试本地环境
npm start
```

### 2. Render 部署设置
1. 连接GitHub repository
2. 设置环境变数（见上方清单）
3. 设置建置命令：`npm install`
4. 设置启动命令：`npm start`

### 3. 资料库初始化
部署后第一次执行：
```bash
# 自动执行资料库初始化
# 已在 backend.js 和 agentBackend.js 中包含
```

## 🔍 监控和维护

### 日常检查
- 监控资料库连接数
- 检查错误日志
- 验证备份状态
- 检查安全警报

### 定期任务
- 每日：检查安全日志
- 每周：资料库效能检查
- 每月：密钥轮换
- 每季：安全审计

## 🛡️ 安全最佳实践

### 1. 密钥管理
- 使用强随机密钥
- 定期轮换密钥
- 不在代码中硬编码敏感资讯
- 使用环境变数存储秘密

### 2. 资料库安全
- 启用SSL连接
- 限制连接来源IP
- 定期备份资料
- 监控异常查询

### 3. 应用安全
- 启用HTTPS
- 设置CORS政策
- 实施速率限制
- 使用安全标头

### 4. 监控告警
- 设置资料库连接告警
- 监控磁盘使用率
- 追踪异常登入
- 检测可疑活动

## 📞 紧急联络

如果遇到资料库问题：
1. 检查Render控制台状态
2. 验证环境变数设置
3. 查看应用日志
4. 联络Render支援

## ✅ 检查清单

部署前确认：
- [ ] 所有环境变数已设置
- [ ] 资料库连接测试通过
- [ ] SSL证书已配置
- [ ] 安全功能已启用
- [ ] 监控告警已设置
- [ ] 备份策略已实施 