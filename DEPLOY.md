# Render 部署指南

## 前置准备

1. 确保您已经有一个 Render 帐号
2. 确保您的 PostgreSQL 资料库已经在 Render 上设置完成

## 资料库资讯

本专案使用以下 PostgreSQL 资料库：
- **Host**: `dpg-d0e2imc9c44c73che3kg-a`
- **Port**: `5432`
- **Database**: `bet_game`
- **Username**: `bet_game_user`
- **Password**: `Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy`
- **Internal URL**: `postgresql://bet_game_user:Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy@dpg-d0e2imc9c44c73che3kg-a/bet_game`

## 部署步骤

### 1. 推送代码到 GitHub

确保您的代码已经推送到 GitHub 储存库。

### 2. 在 Render 中部署

#### 方法一：使用 render.yaml（推荐）

1. 在 Render Dashboard 中点击 "New +"
2. 选择 "Blueprint"
3. 连接您的 GitHub 储存库
4. Render 会自动读取 `render.yaml` 档案并创建两个服务：
   - `bet-game` (主游戏服务)
   - `bet-agent` (代理管理服务)

#### 方法二：手动创建服务

**创建主游戏服务 (bet-game)：**
1. 选择 "Web Service"
2. 连接您的 GitHub 储存库
3. 设置以下参数：
   - **Name**: `bet-game`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

**创建代理服务 (bet-agent)：**
1. 选择 "Web Service"
2. 连接您的 GitHub 储存库
3. 设置以下参数：
   - **Name**: `bet-agent`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:agent`
   - **Plan**: `Free`

### 3. 环境变数设置

对于每个服务，请设置以下环境变数：

```
NODE_ENV=production
DATABASE_URL=postgresql://bet_game_user:Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy@dpg-d0e2imc9c44c73che3kg-a/bet_game
DB_HOST=dpg-d0e2imc9c44c73che3kg-a
DB_PORT=5432
DB_NAME=bet_game
DB_USER=bet_game_user
DB_PASSWORD=Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy
```

**bet-game 服务额外设置：**
```
PORT=3002
```

**bet-agent 服务额外设置：**
```
PORT=3003
```

### 4. 初始化资料库

部署完成后，访问以下 URL 来初始化资料库：
- **主游戏服务**: `https://bet-game.onrender.com/api/init-db`
- **代理服务**: `https://bet-agent.onrender.com/api/init-db`

### 5. 健康检查

您可以通过以下 URL 检查服务状态：
- **主游戏服务**: `https://bet-game.onrender.com/api/health`
- **代理服务**: `https://bet-agent.onrender.com/api/health`

## 服务 URL

部署完成后，您的应用将可通过以下 URL 访问：
- **主游戏**: `https://bet-game.onrender.com`
- **代理管理**: `https://bet-agent.onrender.com`

## 重要注意事项

1. **免费方案限制**: Render 的免费方案有一些限制，包括：
   - 服务在无活动 15 分钟后会休眠
   - 每月有 750 小时的使用时间限制
   - 冷启动时间较长

2. **资料库连接**: 所有资料库配置已经在代码中设置完成，会自动使用提供的 PostgreSQL 资料库

3. **SSL 设置**: 代码已经配置为接受 Render PostgreSQL 的 SSL 连接

4. **跨域设置**: 已经配置为允许 Render 上的服务互相通信

## 故障排除

如果遇到问题，请检查：

1. **环境变数**: 确保所有必要的环境变数都已设置
2. **资料库连接**: 检查 Render logs 中的资料库连接状态
3. **依赖项**: 确保 `package.json` 中的所有依赖项都能正常安装
4. **端口设置**: 确保每个服务使用正确的端口

### 常见错误解决方案

#### 客服操作错误 (Multiple rows were not expected)
如果遇到客服操作出现 "Multiple rows were not expected" 错误：

```bash
# 1. 运行修复脚本
npm run fix-db

# 2. 测试资料库查询
npm run test-db

# 3. 重新部署应用
```

#### 资料库连接问题
- 确认 PostgreSQL 服务正在运行
- 检查 DATABASE_URL 环境变数是否正确
- 验证资料库表格是否已创建

#### API 500 错误
- 检查 Render logs 中的详细错误信息
- 确认所有必要的表格都存在
- 运行资料库初始化: `/api/init-db`

## 重新部署

如果需要重新部署：
1. 推送新代码到 GitHub
2. Render 会自动触发重新部署（如果启用了 auto-deploy）
3. 或者在 Render Dashboard 中手动触发部署 