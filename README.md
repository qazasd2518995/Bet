# FS金彩赛车游戏与代理管理系统

这是一个包含游戏前后端和管理前后端的FS金彩赛车游戏系统。

## 专案结构

- `backend.js`: 游戏主后端
- `agentBackend.js`: 代理管理系统后端
- `deploy/frontend/`: 游戏前端文件
- `agent/frontend/`: 代理管理系统前端文件
- `db/`: 数据库模型和配置

## 数据库

系统使用PostgreSQL数据库来保存数据，确保即使服务重启也能保持数据持久化：

- 用户数据（会员资料、余额）
- 下注记录
- 游戏结果历史
- 代理信息

## 在本地运行

安装依赖：

```bash
npm install
```

运行游戏后端：

```bash
npm run dev
```

运行代理后端：

```bash
npm run dev:agent
```

同时运行两个后端：

```bash
npm run dev:all
```

## 在Render部署

### 前置准备

1. 注册 [Render](https://render.com/) 帐号
2. 将本专案推送到您的GitHub仓库
3. 在Render中连接GitHub帐号

### 使用Blueprint自动部署

Render Blueprint是一种通过`render.yaml`文件一次部署多个服务的方式。

1. 登入 [Render](https://render.com/)
2. 点击顶部导航的 "New"，选择 "Blueprint"
3. 选择包含本专案的GitHub仓库
4. Render将自动扫描`render.yaml`文件并显示将要创建的服务
5. 点击 "Apply" 完成部署，Render会自动：
   - 创建PostgreSQL数据库
   - 部署游戏后端服务
   - 部署代理后端服务

### 手动部署各个服务

如果Blueprint选项不可用，可以分别部署各个服务：

#### 1. 创建PostgreSQL数据库

1. 在Render控制台点击 "New" > "PostgreSQL"
2. 填写以下信息：
   - **Name**: `bet-db`
   - **Database**: `bet_game`
   - **User**: 自动生成
   - **Region**: 选择最近的地区
   - **Plan**: Free
3. 点击 "Create Database"
4. 保存显示的数据库连接信息

#### 2. 部署游戏后端

1. 在Render控制台点击 "New" > "Web Service"
2. 连接此GitHub仓库
3. 填写以下信息：
   - **Name**: `bet-game`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
4. 添加环境变量：
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: 之前创建的PostgreSQL数据库URL
5. 点击 "Create Web Service"

#### 3. 部署代理后端

1. 在Render控制台点击 "New" > "Web Service"
2. 连接此GitHub仓库
3. 填写以下信息：
   - **Name**: `bet-agent`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:agent`
   - **Plan**: Free
4. 添加环境变量：
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: 之前创建的PostgreSQL数据库URL
5. 点击 "Create Web Service"

## 数据持久化

- 系统使用PostgreSQL保存所有重要数据
- 即使Render服务休眠或重启，数据也会保持完整
- Render的免费PostgreSQL提供1GB存储空间，足够一般使用场景

## 默认帐号

### 代理系统
- 帐号: `admin`
- 密码: `adminpwd`

### 玩家帐号
- 帐号: `aaa`
- 密码: `aaapwd`

## 代理后端部署

如需单独部署代理后端，可以创建另一个Web Service，使用`npm run start:agent`作为启动命令。

## 环境变量

可以在Render的环境变量设置中添加以下变量：

- `PORT`: 应用端口（Render会自动指定）
- `NODE_ENV`: production（部署环境）

## 注意事项

- Render免费方案有使用限制，较长时间不活动会休眠服务
- 资料仅保存在内存中，服务重启后会重置

# FS金彩赛车游戏系统修复总结

## 已修复的问题
1. **startUpdateTimers函数已添加** - 解决了`TypeError: this.startUpdateTimers is not a function`错误，现在系统可以正常更新游戏数据、倒计时和余额。

2. **音效播放问题已修复** - 解决了音效资源404错误和NotAllowedError问题：
   - 修正了音效文件路径
   - 添加了更好的错误处理与提示
   - 使用Promise处理自动播放策略限制

3. **getOdds函数已实现** - 修复了下注API 500内部伺服器错误，现在可以正确取得赔率。

4. **余额显示问题已修复** - 确保了数字类型转换正确：
   - 使用`parseFloat`处理API返回的余额值 
   - 防止字符串与数字混合计算导致的不一致

5. **今日盈亏计算逻辑已修正** - 优化了计算方式，确保金额数据类型正确。

6. **下注API 500错误已修复** - 解决了下注操作后伺服器返回500内部错误的问题：
   - 添加了缺失的`updateMemberBalance`函数
   - 修正了`createBet`函数的错误处理，使用`BetModel.create`代替直接查询
   - 优化了下注API的错误处理和日志记录

## 仍需关注的部分
1. **开奖动画相关代码** - 虽然修复了部分问题，但在游戏界面中仍未看到完整的开奖动画实现。

2. **资源加载优化** - 应考虑以下改进：
   - 使用preload预加载关键音效资源
   - 实现资源加载失败后的重试机制

3. **错误处理优化** - 应添加更全面的错误处理机制：
   - API请求失败的友好提示
   - 网络中断时的自动重连
   - 系统状态异常时的恢复策略

4. **性能优化建议**:
   - 考虑使用WebSocket替代轮询，减少服务器负担
   - 实现更高效的状态管理
   - 添加数据缓存机制，减少API请求次数

5. **测试覆盖** - 建议添加自动化测试以确保系统稳定性：
   - 主要功能的单元测试
   - 关键流程的集成测试
   - 负载测试，特别是高并发下注场景

## 未来优化方向
1. 重构前端代码为更现代的组件结构，提高可维护性
2. 添加更详细的系统监控和日志记录
3. 优化数据库结构和查询性能
4. 增强安全性，包括输入验证和防止SQL注入
5. 优化移动端体验
6. 实现更丰富的投注统计和分析功能 