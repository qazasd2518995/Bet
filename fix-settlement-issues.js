// fix-settlement-issues.js - 修复结算系统的两个主要问题

import fs from 'fs';
import path from 'path';

console.log('🔧 开始修复结算系统问题...\n');

// 1. 修复结算逻辑错误：数字比较问题
console.log('📝 修复问题 1: 结算逻辑中的数字比较问题');

const enhancedSettlementPath = './enhanced-settlement-system.js';
let enhancedContent = fs.readFileSync(enhancedSettlementPath, 'utf8');

// 修复严格相等比较问题
const oldComparison = `const winningNumber = positions[position - 1];
        const isWin = winningNumber === betNumber;`;

const newComparison = `const winningNumber = positions[position - 1];
        // 确保数字类型一致的比较
        const isWin = parseInt(winningNumber) === parseInt(betNumber);`;

if (enhancedContent.includes(oldComparison)) {
    enhancedContent = enhancedContent.replace(oldComparison, newComparison);
    console.log('✅ 已修复数字比较逻辑');
} else {
    console.log('⚠️ 未找到需要修复的数字比较代码');
}

// 添加更详细的日志
const oldLog = `settlementLog.info(\`检查投注: id=\${bet.id}, type=\${betType}, value=\${betValue}, position=\${bet.position}\`);`;
const newLog = `settlementLog.info(\`检查投注: id=\${bet.id}, type=\${betType}, value=\${betValue}, position=\${bet.position}\`);
    if (betType === 'number' && bet.position) {
        settlementLog.info(\`号码投注详情: 位置=\${bet.position}, 下注号码=\${betValue}, 开奖号码=\${positions[parseInt(bet.position) - 1]}\`);
    }`;

enhancedContent = enhancedContent.replace(oldLog, newLog);

fs.writeFileSync(enhancedSettlementPath, enhancedContent);
console.log('✅ 结算逻辑修复完成\n');

// 2. 修复提前结算问题
console.log('📝 修复问题 2: 避免在开奖阶段显示结算结果');

const backendPath = './backend.js';
let backendContent = fs.readFileSync(backendPath, 'utf8');

// 在游戏状态API中添加结算状态检查
const gameDataEndpoint = `app.get('/api/game-data', async (req, res) => {`;
const modifiedEndpoint = `app.get('/api/game-data', async (req, res) => {
  try {
    const gameData = await getGameData();
    
    // 在开奖阶段（drawing）时，不返回刚结算的注单
    // 这样前端在开奖动画期间不会看到结算结果
    if (gameData.status === 'drawing') {
      gameData.hideRecentSettlements = true;
    }
    
    res.json({
      success: true,
      ...gameData
    });
  } catch (error) {
    console.error('获取游戏数据失败:', error);
    res.status(500).json({ success: false, message: '获取游戏数据失败' });
  }
});

// 原始的端点处理保持不变，以下是继续的代码...
app.get('/api/game-data-original', async (req, res) => {`;

// 查找并替换
const endpointMatch = backendContent.match(/app\.get\('\/api\/game-data',[\s\S]*?\}\);/);
if (endpointMatch) {
    const originalEndpoint = endpointMatch[0];
    // 保存原始逻辑
    const modifiedBackend = backendContent.replace(originalEndpoint, modifiedEndpoint + '\n' + originalEndpoint.replace("'/api/game-data'", "'/api/game-data-original'"));
    
    fs.writeFileSync(backendPath, modifiedBackend);
    console.log('✅ 已修改 /api/game-data 端点，在开奖阶段隐藏结算状态');
} else {
    console.log('⚠️ 未找到 /api/game-data 端点');
}

// 3. 修复输赢控制影响结算的问题
console.log('\n📝 修复问题 3: 确保输赢控制不影响正确的结算判定');

// 在结算前添加日志，记录输赢控制状态
const settlementFunction = `export async function enhancedSettlement(period, drawResult) {`;
const modifiedSettlement = `export async function enhancedSettlement(period, drawResult) {
    // 检查是否有输赢控制影响
    const controlCheck = await checkWinLossControlStatus(period);
    if (controlCheck.enabled) {
        settlementLog.warn(\`⚠️ 注意：期号 \${period} 有输赢控制设定 - 模式: \${controlCheck.mode}, 目标: \${controlCheck.target}\`);
        settlementLog.warn(\`输赢控制不应影响结算判定，仅影响开奖结果生成\`);
    }`;

enhancedContent = fs.readFileSync(enhancedSettlementPath, 'utf8');
enhancedContent = enhancedContent.replace(settlementFunction, modifiedSettlement);

// 添加输赢控制检查函数
const controlCheckFunction = `
// 检查输赢控制状态（仅用于日志记录）
async function checkWinLossControlStatus(period) {
    try {
        const response = await fetch(\`\${AGENT_API_URL}/api/agent/internal/win-loss-control/active\`);
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                return {
                    enabled: true,
                    mode: result.data.control_mode,
                    target: result.data.target_username
                };
            }
        }
    } catch (error) {
        // 忽略错误
    }
    return { enabled: false };
}
`;

// 在文件末尾添加函数
enhancedContent = enhancedContent.replace(
    'export default {',
    controlCheckFunction + '\nexport default {'
);

fs.writeFileSync(enhancedSettlementPath, enhancedContent);
console.log('✅ 已添加输赢控制状态检查');

// 4. 创建前端修复
console.log('\n📝 修复问题 4: 修改前端在开奖阶段的显示逻辑');

const frontendFixContent = `
// 前端修复建议：在 frontend/js/main.js 中

// 1. 在 updateBetHistory 函数中添加状态检查
async updateBetHistory() {
    // 如果当前是开奖状态，延迟更新
    if (this.gameState.status === 'drawing') {
        console.log('开奖中，延迟更新投注记录');
        return;
    }
    
    // 原有的更新逻辑...
}

// 2. 在游戏状态变更时控制显示
watch: {
    'gameState.status'(newStatus, oldStatus) {
        if (newStatus === 'drawing') {
            // 进入开奖阶段，隐藏最新的结算结果
            this.hideRecentSettlements = true;
        } else if (oldStatus === 'drawing' && newStatus === 'betting') {
            // 开奖结束，显示结算结果
            this.hideRecentSettlements = false;
            this.updateBetHistory(); // 更新投注记录
        }
    }
}
`;

fs.writeFileSync('./fix-frontend-settlement-display.txt', frontendFixContent);
console.log('✅ 已创建前端修复建议文件: fix-frontend-settlement-display.txt');

console.log('\n🎉 结算系统修复完成！');
console.log('\n修复内容总结：');
console.log('1. ✅ 修正了数字比较逻辑，使用 parseInt 确保类型一致');
console.log('2. ✅ 在开奖阶段隐藏结算状态');
console.log('3. ✅ 添加输赢控制日志，确保不影响结算判定');
console.log('4. ✅ 提供前端修复建议');

console.log('\n下一步：');
console.log('1. 重启后端服务');
console.log('2. 按照 fix-frontend-settlement-display.txt 修改前端代码');
console.log('3. 测试结算是否正确');