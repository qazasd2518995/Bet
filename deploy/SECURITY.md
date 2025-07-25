# 🔒 安全部署与维护指南

## 📋 目录

1. [紧急安全修复步骤](#紧急安全修复步骤)
2. [安全配置检查清单](#安全配置检查清单)
3. [部署前准备](#部署前准备)
4. [安全功能说明](#安全功能说明)
5. [日常维护](#日常维护)
6. [事件应对](#事件应对)
7. [安全最佳实践](#安全最佳实践)

## 🚨 紧急安全修复步骤

### 1. 立即执行的命令

```bash
# 安装安全套件
npm install

# 执行资料库安全升级
psql -U your_db_user -d your_db_name -f security/database-schema.sql

# 生成安全密钥
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('INTERNAL_API_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

### 2. 更新环境变数

复制 `env.example` 到 `.env` 并设置所有必要的安全变数：

```bash
cp env.example .env
# 编辑 .env 文件，设置所有安全相关的环境变数
```

### 3. 更新现有密码

```sql
-- 紧急：将所有现有明文密码转换为杂凑密码
-- 注意：这需要在应用程式中实现密码迁移逻辑
UPDATE agents SET password = 'NEED_RESET' WHERE length(password) < 60;
UPDATE members SET password = 'NEED_RESET' WHERE length(password) < 60;
```

## ✅ 安全配置检查清单

### 环境变数检查

- [ ] `JWT_SECRET` - 至少 64 个字符的随机字符串
- [ ] `JWT_REFRESH_SECRET` - 不同于 JWT_SECRET 的随机字符串
- [ ] `SESSION_SECRET` - 至少 64 个字符的随机字符串
- [ ] `INTERNAL_API_KEY` - 内部服务通信密钥
- [ ] `DATABASE_URL` - 使用 SSL 连接（生产环境）
- [ ] `ENCRYPTION_KEY` - 32 字符的加密密钥
- [ ] `BCRYPT_ROUNDS` - 设置为 12 或更高
- [ ] `NODE_ENV` - 生产环境设置为 'production'

### 安全功能启用

- [ ] `ENABLE_HELMET=true` - 安全头部
- [ ] `ENABLE_RATE_LIMIT=true` - 速率限制
- [ ] `ENABLE_XSS_PROTECTION=true` - XSS 防护
- [ ] `ENABLE_SQL_INJECTION_PROTECTION=true` - SQL 注入防护
- [ ] `ENABLE_CSRF_PROTECTION=true` - CSRF 防护
- [ ] `ENABLE_SECURITY_LOGS=true` - 安全日志
- [ ] `ENABLE_2FA=true` - 两步验证（建议）

### 网路安全设置

- [ ] HTTPS 证书已配置
- [ ] 防火墙规则已设置
- [ ] DDoS 防护已启用
- [ ] IP 白名单/黑名单已配置
- [ ] 地理位置限制已设置

## 🚀 部署前准备

### 1. 资料库准备

```sql
-- 执行所有安全相关的资料库更新
\i security/database-schema.sql

-- 检查安全表是否创建成功
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%security%' OR table_name LIKE '%audit%';
```

### 2. 密码策略实施

所有新密码必须符合以下要求：
- 最少 8 个字符
- 包含大小写字母
- 包含数字
- 包含特殊字符
- 不能与用户名相同
- 不能包含常见密码

### 3. API 密钥生成

```javascript
// 生成 API 密钥的范例代码
const crypto = require('crypto');

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// 为每个外部整合生成独立的 API 密钥
console.log('Payment Gateway API Key:', generateApiKey());
console.log('Analytics API Key:', generateApiKey());
console.log('Notification Service API Key:', generateApiKey());
```

## 🛡️ 安全功能说明

### 1. 密码加密
- 使用 bcrypt 加密所有密码
- 盐值轮次：12 轮（可调整）
- 自动密码强度验证

### 2. JWT 认证
- Access Token 有效期：24 小时
- Refresh Token 有效期：7 天
- 支援 Token 黑名单机制

### 3. 速率限制
- 通用 API：15 分钟内最多 100 次请求
- 登入尝试：15 分钟内最多 5 次
- 注册：每小时最多 3 次
- 密码重设：每小时最多 3 次

### 4. 安全日志
- 所有登入尝试记录
- 敏感操作审计
- 异常活动警报
- IP 地址追踪

### 5. SQL 注入防护
- 参数化查询
- 输入验证
- 特殊字符转义
- 查询超时保护

### 6. XSS 防护
- 输入过滤
- 输出编码
- Content Security Policy
- HttpOnly Cookies

## 📅 日常维护

### 每日检查
1. 检查安全日志异常
2. 监控失败登入次数
3. 检查系统资源使用率
4. 验证备份完整性

### 每周任务
1. 更新 IP 黑名单
2. 审查用户权限
3. 检查过期的 API 密钥
4. 分析安全警报趋势

### 每月任务
1. 密码策略审查
2. 安全补丁更新
3. 渗透测试
4. 员工安全培训

### 每季任务
1. 完整安全审计
2. 灾难恢复演练
3. 密钥轮换
4. 合规性检查

## 🚨 事件应对

### 可疑活动处理

1. **立即响应**
   ```bash
   # 封锁可疑 IP
   psql -c "INSERT INTO ip_blacklist (ip_address, reason) VALUES ('suspicious_ip', 'Suspicious activity detected')"
   
   # 检查相关日志
   grep "suspicious_ip" logs/security.log
   ```

2. **调查步骤**
   - 检查安全日志
   - 分析访问模式
   - 识别受影响帐户
   - 评估数据泄露风险

3. **缓解措施**
   - 强制受影响用户重设密码
   - 撤销相关 API 密钥
   - 增强监控
   - 通知相关方

### 数据泄露应对

1. **隔离**：立即隔离受影响系统
2. **评估**：确定泄露范围和影响
3. **通知**：按法规要求通知用户和监管机构
4. **修复**：修补漏洞并加强安全措施
5. **审查**：进行事后审查并更新应对计划

## 🏆 安全最佳实践

### 开发阶段
1. 代码审查包含安全检查
2. 使用静态代码分析工具
3. 依赖项定期更新
4. 避免硬编码敏感信息
5. 实施最小权限原则

### 部署阶段
1. 使用安全的 CI/CD 管道
2. 环境隔离（开发/测试/生产）
3. 自动化安全测试
4. 配置管理和版本控制
5. 零信任网路架构

### 运营阶段
1. 24/7 安全监控
2. 定期安全审计
3. 事件响应计划
4. 业务连续性计划
5. 持续安全培训

## 📞 紧急联络

- 安全团队邮箱：security@example.com
- 24/7 紧急热线：+886-xxx-xxx-xxx
- 事件响应团队：incident-response@example.com

## 🔗 相关资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js 安全最佳实践](https://nodejs.org/en/docs/guides/security/)
- [PostgreSQL 安全文档](https://www.postgresql.org/docs/current/security.html)
- [Express.js 安全最佳实践](https://expressjs.com/en/advanced/best-practice-security.html)

---

**重要提醒**：安全是一个持续的过程，而不是一次性的任务。定期审查和更新安全措施，保持对最新威胁的警觉。 