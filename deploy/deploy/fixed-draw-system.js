// fixed-draw-system.js - 修正后的开奖系统
import db from './db/config.js';
import fetch from 'node-fetch';
import { generateBlockchainData } from './utils/blockchain.js';

/**
 * 修正后的统一开奖流程管理器
 * 确保控制系统真正按照设定的机率执行
 */
class FixedDrawSystemManager {
    constructor() {
        this.AGENT_API_URL = process.env.NODE_ENV === 'production' 
            ? 'https://bet-agent.onrender.com' 
            : 'http://localhost:3003';
    }

    /**
     * 执行开奖 - 主要入口（优化版）
     */
    async executeDrawing(period) {
        console.log(`🎯 [统一开奖] 期号 ${period} 开始执行开奖...`);
        
        try {
            // 1. 并行执行控制检查和下注分析，减少等待时间
            const [controlConfig, betAnalysis] = await Promise.all([
                this.checkActiveControl(period),
                this.analyzePeriodBets(period)
            ]);
            
            console.log(`🎯 [控制检查] 期号 ${period} 控制设定:`, controlConfig);
            console.log(`📊 [下注分析] 期号 ${period} 分析结果:`, betAnalysis);
            
            // 2. 根据控制设定和下注情况生成结果
            const drawResult = await this.generateFinalResult(period, controlConfig, betAnalysis);
            console.log(`🎯 [结果生成] 期号 ${period} 最终结果:`, drawResult);
            
            // 3. 保存开奖结果到数据库（关键操作，必须同步执行）
            await this.saveDrawResult(period, drawResult);
            console.log(`✅ [结果保存] 期号 ${period} 开奖结果已保存`);
            
            // 4. 异步执行后续操作（同步代理系统和结算）
            // 重要：延迟执行结算，确保所有投注都已停止
            setTimeout(async () => {
                try {
                    // 先同步到代理系统
                    const syncResult = await this.syncToAgentSystem(period, drawResult);
                    console.log(`✅ [代理同步] 期号 ${period} 已同步到代理系统`);
                    
                    // 延迟1秒后执行结算，确保所有投注记录都已保存
                    setTimeout(async () => {
                        try {
                            const settlementResult = await this.executeSettlement(period, drawResult);
                            console.log(`✅ [结算完成] 期号 ${period} 结算结果:`, {
                                settledCount: settlementResult.settledCount,
                                winCount: settlementResult.winCount,
                                totalWinAmount: settlementResult.totalWinAmount
                            });
                        } catch (error) {
                            console.error(`❌ [结算执行] 期号 ${period} 结算失败:`, error);
                        }
                    }, 1000); // 延迟1秒执行结算
                } catch (error) {
                    console.error(`❌ [后续处理] 期号 ${period} 后续处理失败:`, error);
                }
            }, 2000); // 延迟2秒开始执行后续操作，确保开奖状态已结束
            
            return {
                success: true,
                period: period,
                result: drawResult,
                settlement: { pending: true } // 结算异步执行中
            };
            
        } catch (error) {
            console.error(`❌ [统一开奖] 期号 ${period} 执行开奖失败:`, error);
            return {
                success: false,
                period: period,
                error: error.message
            };
        }
    }

    /**
     * 检查当前活动的输赢控制设定
     */
    async checkActiveControl(period) {
        try {
            const response = await fetch(`${this.AGENT_API_URL}/api/agent/internal/win-loss-control/active`);
            if (!response.ok) {
                console.log(`🔧 [控制检查] 无法连接代理系统，使用正常模式`);
                return { mode: 'normal', enabled: false };
            }
            
            const result = await response.json();
            if (result.success && result.data) {
                return {
                    mode: result.data.control_mode,
                    enabled: true,
                    target_username: result.data.target_username,
                    control_percentage: result.data.control_percentage,
                    start_period: result.data.start_period
                };
            }
            
            return { mode: 'normal', enabled: false };
            
        } catch (error) {
            console.error(`❌ [控制检查] 检查控制设定失败:`, error);
            return { mode: 'normal', enabled: false };
        }
    }

    /**
     * 分析当期下注情况
     */
    async analyzePeriodBets(period) {
        try {
            console.log(`📊 [下注分析] 开始分析期号 ${period} 的下注情况`);
            const allBets = await db.manyOrNone(`
                SELECT bet_type, bet_value, position, amount, username
                FROM bet_history 
                WHERE period = $1
            `, [period]);
            
            if (!allBets || allBets.length === 0) {
                console.log(`📊 [下注分析] 期号 ${period} 没有找到任何下注记录`);
                return {
                    totalAmount: 0,
                    betCount: 0,
                    positionBets: {},
                    userBets: {},
                    platformRisk: 0
                };
            }
            
            let totalAmount = 0;
            const positionBets = {}; // 各位置的下注情况
            const userBets = {}; // 各用户的下注情况
            
            for (const bet of allBets) {
                totalAmount += parseFloat(bet.amount);
                
                // 记录用户下注
                if (!userBets[bet.username]) {
                    userBets[bet.username] = [];
                }
                userBets[bet.username].push({
                    betType: bet.bet_type,
                    betValue: bet.bet_value,
                    position: bet.position,
                    amount: parseFloat(bet.amount)
                });
                
                // 记录位置下注
                if (bet.bet_type === 'number' && bet.position) {
                    const pos = parseInt(bet.position);
                    if (!positionBets[pos]) {
                        positionBets[pos] = {};
                    }
                    const num = parseInt(bet.bet_value);
                    if (!positionBets[pos][num]) {
                        positionBets[pos][num] = 0;
                    }
                    positionBets[pos][num] += parseFloat(bet.amount);
                }
            }
            
            // 计算平台风险
            const platformRisk = this.calculatePlatformRisk(positionBets, totalAmount);
            
            return {
                totalAmount,
                betCount: allBets.length,
                positionBets,
                userBets,
                platformRisk
            };
            
        } catch (error) {
            console.error(`❌ [下注分析] 期号 ${period} 分析失败:`, error);
            return {
                totalAmount: 0,
                betCount: 0,
                positionBets: {},
                userBets: {},
                platformRisk: 0
            };
        }
    }

    /**
     * 计算平台风险
     */
    calculatePlatformRisk(positionBets, totalBetAmount) {
        if (totalBetAmount === 0) return 0;
        
        let maxPotentialPayout = 0;
        
        // 计算每个位置如果开出热门号码的潜在赔付
        for (const [position, bets] of Object.entries(positionBets)) {
            let maxPayoutForPosition = 0;
            for (const [number, amount] of Object.entries(bets)) {
                const potentialPayout = amount * 9.89; // 假设赔率9.89
                if (potentialPayout > maxPayoutForPosition) {
                    maxPayoutForPosition = potentialPayout;
                }
            }
            maxPotentialPayout += maxPayoutForPosition;
        }
        
        // 风险系数 = 潜在最大赔付 / 总下注额
        const riskFactor = maxPotentialPayout / totalBetAmount;
        return riskFactor;
    }

    /**
     * 根据控制设定和下注分析生成最终结果
     */
    async generateFinalResult(period, controlConfig, betAnalysis) {
        console.log(`🎲 [结果生成] 期号 ${period} 开始生成最终结果...`);
        
        // 如果没有下注，直接随机生成
        if (betAnalysis.totalAmount === 0) {
            console.log(`🎲 [结果生成] 期号 ${period} 没有下注，使用纯随机模式`);
            return this.generateRandomResult();
        }
        
        // 根据不同控制模式生成结果
        switch (controlConfig.mode) {
            case 'auto_detect':
                return this.generateAutoDetectResult(period, betAnalysis);
            
            case 'single_member':
                return this.generateTargetMemberResult(period, controlConfig, betAnalysis);
            
            case 'agent_line':
                return this.generateAgentLineResult(period, controlConfig, betAnalysis);
            
            default:
                console.log(`🎲 [结果生成] 期号 ${period} 使用正常模式`);
                return this.generateRandomResult();
        }
    }

    /**
     * 生成纯随机结果
     */
    generateRandomResult() {
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        
        // Fisher-Yates 洗牌算法
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        
        return numbers;
    }

    /**
     * 自动侦测模式结果生成
     */
    generateAutoDetectResult(period, betAnalysis) {
        console.log(`🤖 [自动侦测] 期号 ${period} 开始自动侦测分析...`);
        
        // 计算平台风险
        const riskFactor = betAnalysis.platformRisk;
        console.log(`📊 [自动侦测] 平台风险系数: ${riskFactor.toFixed(2)}`);
        
        // 如果风险系数过高（潜在赔付超过下注额的8倍），则生成对平台有利的结果
        if (riskFactor > 8) {
            console.log(`⚠️ [自动侦测] 风险过高，生成平台有利结果`);
            return this.generatePlatformFavorableResult(betAnalysis);
        }
        
        // 如果风险系数过低（潜在赔付低于下注额的5倍），则生成较平衡的结果
        if (riskFactor < 5) {
            console.log(`📊 [自动侦测] 风险较低，生成平衡结果`);
            return this.generateBalancedResult(betAnalysis);
        }
        
        // 其他情况使用随机
        console.log(`🎲 [自动侦测] 风险正常，使用随机结果`);
        return this.generateRandomResult();
    }

    /**
     * 目标会员控制结果生成（修正版）
     */
    generateTargetMemberResult(period, controlConfig, betAnalysis) {
        console.log(`👤 [目标会员] 期号 ${period} 为 ${controlConfig.target_username} 生成控制结果...`);
        
        // 找出目标用户的下注
        const targetBets = betAnalysis.userBets[controlConfig.target_username] || [];
        
        if (targetBets.length === 0) {
            console.log(`👤 [目标会员] 期号 ${period} 目标用户没有下注，使用随机结果`);
            return this.generateRandomResult();
        }
        
        // 解析控制百分比
        let controlPercentage = parseFloat(controlConfig.control_percentage);
        if (isNaN(controlPercentage)) controlPercentage = 0;
        if (controlPercentage > 1) controlPercentage = controlPercentage / 100;
        
        console.log(`🎮 [目标会员] 控制百分比: ${(controlPercentage * 100).toFixed(1)}%`);
        
        // 生成一个随机数来决定这次是否要让用户输
        const shouldLose = Math.random() < controlPercentage;
        
        if (shouldLose) {
            console.log(`❌ [目标会员] 根据${(controlPercentage * 100).toFixed(1)}%机率，这次让用户输`);
            return this.generateLosingResultFixed(targetBets, betAnalysis.positionBets);
        } else {
            console.log(`✅ [目标会员] 根据${(100 - controlPercentage * 100).toFixed(1)}%机率，这次让用户赢`);
            return this.generateWinningResultFixed(targetBets, betAnalysis.positionBets);
        }
    }

    /**
     * 代理线控制结果生成
     */
    generateAgentLineResult(period, controlConfig, betAnalysis) {
        console.log(`🏢 [代理线] 期号 ${period} 为代理线生成控制结果...`);
        
        // 获取代理线下所有用户的下注
        // 这里简化处理，实际应该查询代理关系
        const agentBets = [];
        for (const [username, bets] of Object.entries(betAnalysis.userBets)) {
            // 这里应该检查用户是否属于目标代理线
            agentBets.push(...bets);
        }
        
        if (agentBets.length === 0) {
            return this.generateRandomResult();
        }
        
        let controlPercentage = parseFloat(controlConfig.control_percentage);
        if (controlPercentage > 1) controlPercentage = controlPercentage / 100;
        
        const shouldLose = Math.random() < controlPercentage;
        
        if (shouldLose) {
            return this.generateLosingResultFixed(agentBets, betAnalysis.positionBets);
        } else {
            return this.generateWinningResultFixed(agentBets, betAnalysis.positionBets);
        }
    }

    /**
     * 生成平台获利的结果
     */
    generatePlatformFavorableResult(betAnalysis) {
        const result = Array(10).fill(0);
        const availableNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        
        // 对每个位置，选择下注最少的号码
        for (let position = 1; position <= 10; position++) {
            const positionBets = betAnalysis.positionBets[position] || {};
            
            // 找出该位置下注最少的号码
            let minBetNumber = 0;
            let minBetAmount = Infinity;
            
            for (const num of availableNumbers) {
                const betAmount = positionBets[num] || 0;
                if (betAmount < minBetAmount) {
                    minBetAmount = betAmount;
                    minBetNumber = num;
                }
            }
            
            // 选择下注最少的号码
            if (minBetNumber > 0) {
                result[position - 1] = minBetNumber;
                // 从可用号码中移除
                const index = availableNumbers.indexOf(minBetNumber);
                if (index > -1) {
                    availableNumbers.splice(index, 1);
                }
            }
        }
        
        // 填充剩余位置
        let fillIndex = 0;
        for (let i = 0; i < 10; i++) {
            if (result[i] === 0) {
                result[i] = availableNumbers[fillIndex++];
            }
        }
        
        console.log(`💰 [平台获利] 生成结果: ${result.join(', ')}`);
        return result;
    }

    /**
     * 生成平衡的结果
     */
    generateBalancedResult(betAnalysis) {
        // 部分随机，部分考虑下注情况
        const result = this.generateRandomResult();
        
        // 对前几个位置进行调整，避免过度集中的热门号码
        for (let position = 1; position <= 3; position++) {
            const positionBets = betAnalysis.positionBets[position] || {};
            
            // 检查当前号码是否是热门号码
            const currentNumber = result[position - 1];
            const currentBetAmount = positionBets[currentNumber] || 0;
            
            // 如果是热门号码（下注额超过平均值的2倍），考虑替换
            const avgBet = Object.values(positionBets).reduce((a, b) => a + b, 0) / 10;
            if (currentBetAmount > avgBet * 2 && Math.random() < 0.7) {
                // 70%机率替换为冷门号码
                for (let i = position; i < 10; i++) {
                    const candidateNumber = result[i];
                    const candidateBetAmount = positionBets[candidateNumber] || 0;
                    if (candidateBetAmount < avgBet) {
                        // 交换
                        [result[position - 1], result[i]] = [result[i], result[position - 1]];
                        break;
                    }
                }
            }
        }
        
        return result;
    }

    /**
     * 生成让特定下注失败的结果（修正版）
     */
    generateLosingResultFixed(targetBets, positionBets) {
        console.log(`🎯 [输控制] 生成让目标用户输的结果`);
        console.log(`目标用户下注:`, targetBets.map(b => `${b.betType} ${b.betValue}`).join(', '));
        
        // 先生成一个随机结果
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        
        // 收集目标用户的下注
        const userBetsByPosition = {};
        const twoSidesBets = {}; // 收集大小单双的下注
        const sumBets = []; // 收集冠亚和的下注
        const dragonTigerBets = []; // 收集龙虎下注
        
        targetBets.forEach(bet => {
            if (bet.betType === 'number' && bet.position) {
                // 1. 号码投注
                const pos = parseInt(bet.position);
                if (!userBetsByPosition[pos]) {
                    userBetsByPosition[pos] = new Set();
                }
                userBetsByPosition[pos].add(parseInt(bet.betValue));
            } else if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 
                        'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
                        '冠军', '亚军', '季军', '第三名', '第四名', 
                        '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'].includes(bet.betType)) {
                // 2. 位置大小单双投注
                const positionMap = {
                    'champion': 1, '冠军': 1,
                    'runnerup': 2, '亚军': 2,
                    'third': 3, '季军': 3, '第三名': 3,
                    'fourth': 4, '第四名': 4,
                    'fifth': 5, '第五名': 5,
                    'sixth': 6, '第六名': 6,
                    'seventh': 7, '第七名': 7,
                    'eighth': 8, '第八名': 8,
                    'ninth': 9, '第九名': 9,
                    'tenth': 10, '第十名': 10
                };
                
                const position = positionMap[bet.betType];
                if (position && ['big', 'small', 'odd', 'even', '大', '小', '单', '双'].includes(bet.betValue)) {
                    if (!twoSidesBets[position]) {
                        twoSidesBets[position] = [];
                    }
                    twoSidesBets[position].push({
                        type: bet.betValue,
                        amount: bet.amount
                    });
                }
            } else if (bet.betType === 'sum' || bet.betType === 'sumValue' || bet.betType === '冠亚和') {
                // 3. 冠亚和投注
                sumBets.push({
                    value: bet.betValue,
                    amount: bet.amount
                });
            } else if (bet.betType === 'dragon_tiger' || bet.betType === 'dragonTiger' || bet.betType === '龙虎') {
                // 4. 龙虎投注
                dragonTigerBets.push({
                    value: bet.betValue,
                    amount: bet.amount
                });
            }
        });
        
        let adjustmentsMade = 0;
        
        // 1. 处理冠亚和的输控制
        if (sumBets.length > 0) {
            const currentSum = numbers[0] + numbers[1];
            console.log(`  当前冠亚和: ${currentSum}`);
            
            for (const sumBet of sumBets) {
                let needAdjust = false;
                
                if (/^\d+$/.test(sumBet.value)) {
                    // 和值投注
                    const betSum = parseInt(sumBet.value);
                    needAdjust = currentSum === betSum;
                } else if (['big', '大'].includes(sumBet.value)) {
                    needAdjust = currentSum >= 12;
                } else if (['small', '小'].includes(sumBet.value)) {
                    needAdjust = currentSum <= 11;
                } else if (['odd', '单'].includes(sumBet.value)) {
                    needAdjust = currentSum % 2 === 1;
                } else if (['even', '双'].includes(sumBet.value)) {
                    needAdjust = currentSum % 2 === 0;
                }
                
                if (needAdjust) {
                    // 尝试交换冠军或亚军的号码
                    for (let i = 2; i < 10; i++) {
                        const newSum1 = numbers[i] + numbers[1];
                        const newSum2 = numbers[0] + numbers[i];
                        
                        // 检查交换后是否会让用户输
                        if (this.checkSumLose(newSum1, sumBet.value)) {
                            [numbers[0], numbers[i]] = [numbers[i], numbers[0]];
                            adjustmentsMade++;
                            console.log(`  冠亚和控制: 交换冠军${numbers[i]}与第${i+1}名${numbers[0]}`);
                            break;
                        } else if (this.checkSumLose(newSum2, sumBet.value)) {
                            [numbers[1], numbers[i]] = [numbers[i], numbers[1]];
                            adjustmentsMade++;
                            console.log(`  冠亚和控制: 交换亚军${numbers[i]}与第${i+1}名${numbers[1]}`);
                            break;
                        }
                    }
                }
            }
        }
        
        // 2. 处理龙虎的输控制
        if (dragonTigerBets.length > 0) {
            for (const dtBet of dragonTigerBets) {
                const parts = dtBet.value.split('_');
                if (parts.length >= 3) {
                    const pos1 = parseInt(parts[1]) - 1;
                    const pos2 = parseInt(parts[2]) - 1;
                    const betSide = parts[0]; // dragon or tiger
                    
                    const currentWinner = numbers[pos1] > numbers[pos2] ? 'dragon' : 'tiger';
                    
                    if (currentWinner === betSide) {
                        // 需要让用户输，交换其中一个位置
                        [numbers[pos1], numbers[pos2]] = [numbers[pos2], numbers[pos1]];
                        adjustmentsMade++;
                        console.log(`  龙虎控制: 交换位置${pos1+1}与位置${pos2+1}`);
                    }
                }
            }
        }
        
        // 3. 处理大小单双的输控制
        for (const [position, bets] of Object.entries(twoSidesBets)) {
            const pos = parseInt(position) - 1;
            const currentNumber = numbers[pos];
            
            // 检查当前号码是否会让用户赢
            const willWin = bets.some(bet => {
                if (bet.type === 'big' || bet.type === '大') return currentNumber >= 6;
                if (bet.type === 'small' || bet.type === '小') return currentNumber <= 5;
                if (bet.type === 'odd' || bet.type === '单') return currentNumber % 2 === 1;
                if (bet.type === 'even' || bet.type === '双') return currentNumber % 2 === 0;
                return false;
            });
            
            if (willWin) {
                // 找一个会让用户输的号码来交换
                let swapped = false;
                for (let i = 0; i < 10; i++) {
                    if (i !== pos) {
                        const candidateNumber = numbers[i];
                        // 检查这个号码是否会让用户输
                        const willLose = bets.every(bet => {
                            if (bet.type === 'big' || bet.type === '大') return candidateNumber < 6;
                            if (bet.type === 'small' || bet.type === '小') return candidateNumber > 5;
                            if (bet.type === 'odd' || bet.type === '单') return candidateNumber % 2 === 0;
                            if (bet.type === 'even' || bet.type === '双') return candidateNumber % 2 === 1;
                            return true;
                        });
                        
                        if (willLose) {
                            // 交换号码
                            [numbers[pos], numbers[i]] = [numbers[i], numbers[pos]];
                            adjustmentsMade++;
                            console.log(`  位置${position}: 将号码${currentNumber}换成${numbers[pos]}（让用户输）`);
                            swapped = true;
                            break;
                        }
                    }
                }
                
                if (!swapped) {
                    console.log(`  位置${position}: 无法找到合适的号码让用户输`);
                }
            }
        }
        
        // 4. 处理号码投注的输控制
        for (const [position, userNumbers] of Object.entries(userBetsByPosition)) {
            const pos = parseInt(position) - 1;
            const currentNumber = numbers[pos];
            
            // 如果当前号码是用户下注的
            if (userNumbers.has(currentNumber)) {
                // 找一个用户没下注的号码来交换
                let swapped = false;
                for (let i = 0; i < 10; i++) {
                    if (!userNumbers.has(numbers[i])) {
                        // 交换号码
                        [numbers[pos], numbers[i]] = [numbers[i], numbers[pos]];
                        adjustmentsMade++;
                        console.log(`  位置${position}: 将号码${currentNumber}换成${numbers[pos]}（避开用户下注）`);
                        swapped = true;
                        break;
                    }
                }
                
                if (!swapped) {
                    console.log(`  位置${position}: 无法避开用户下注（覆盖率100%）`);
                }
            } else {
                console.log(`  位置${position}: 号码${currentNumber}已经不在用户下注中`);
            }
        }
        
        console.log(`❌ [输控制] 调整了${adjustmentsMade}个位置，最终结果: ${numbers.join(', ')}`);
        return numbers;
    }

    /**
     * 生成让特定下注成功的结果（修正版）
     */
    generateWinningResultFixed(targetBets, positionBets) {
        console.log(`🎯 [赢控制] 生成让目标用户赢的结果`);
        console.log(`目标用户下注:`, targetBets.map(b => `${b.betType} ${b.betValue}`).join(', '));
        
        // 收集目标用户的下注
        const userBetsByPosition = {};
        const twoSidesBets = {}; // 收集大小单双的下注
        const sumBets = []; // 收集冠亚和的下注
        const dragonTigerBets = []; // 收集龙虎下注
        
        targetBets.forEach(bet => {
            if (bet.betType === 'number' && bet.position) {
                // 1. 号码投注
                const pos = parseInt(bet.position);
                if (!userBetsByPosition[pos]) {
                    userBetsByPosition[pos] = [];
                }
                userBetsByPosition[pos].push({
                    number: parseInt(bet.betValue),
                    amount: bet.amount
                });
            } else if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 
                        'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
                        '冠军', '亚军', '季军', '第三名', '第四名', 
                        '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'].includes(bet.betType)) {
                // 2. 位置大小单双投注
                const positionMap = {
                    'champion': 1, '冠军': 1,
                    'runnerup': 2, '亚军': 2,
                    'third': 3, '季军': 3, '第三名': 3,
                    'fourth': 4, '第四名': 4,
                    'fifth': 5, '第五名': 5,
                    'sixth': 6, '第六名': 6,
                    'seventh': 7, '第七名': 7,
                    'eighth': 8, '第八名': 8,
                    'ninth': 9, '第九名': 9,
                    'tenth': 10, '第十名': 10
                };
                
                const position = positionMap[bet.betType];
                if (position && ['big', 'small', 'odd', 'even', '大', '小', '单', '双'].includes(bet.betValue)) {
                    if (!twoSidesBets[position]) {
                        twoSidesBets[position] = [];
                    }
                    twoSidesBets[position].push({
                        type: bet.betValue,
                        amount: bet.amount
                    });
                    console.log(`  收集到两面投注: 第${position}名 ${bet.betValue}`);
                }
            } else if (bet.betType === 'sum' || bet.betType === 'sumValue' || bet.betType === '冠亚和') {
                // 3. 冠亚和投注
                sumBets.push({
                    value: bet.betValue,
                    amount: bet.amount
                });
                console.log(`  收集到冠亚和投注: ${bet.betValue}`);
            } else if (bet.betType === 'dragon_tiger' || bet.betType === 'dragonTiger' || bet.betType === '龙虎') {
                // 4. 龙虎投注
                dragonTigerBets.push({
                    value: bet.betValue,
                    amount: bet.amount
                });
                console.log(`  收集到龙虎投注: ${bet.betValue}`);
            }
        });
        
        // 生成结果
        const result = Array(10).fill(0);
        const usedNumbers = new Set();
        
        // 1. 处理冠亚和投注 - 优先处理，因为会影响前两个位置
        if (sumBets.length > 0) {
            // 同时考虑前两个位置的其他投注条件
            const championConditions = twoSidesBets[1] || [];
            const runnerupConditions = twoSidesBets[2] || [];
            const championNumber = userBetsByPosition[1] ? userBetsByPosition[1][0]?.number : null;
            const runnerupNumber = userBetsByPosition[2] ? userBetsByPosition[2][0]?.number : null;
            
            // 找出所有可能的冠亚组合
            const possiblePairs = [];
            for (let i = 1; i <= 10; i++) {
                for (let j = 1; j <= 10; j++) {
                    if (i !== j) {
                        const sum = i + j;
                        let isValid = true;
                        
                        // 检查是否符合所有冠亚和投注
                        for (const sumBet of sumBets) {
                            if (!this.checkSumWin(sum, sumBet.value)) {
                                isValid = false;
                                break;
                            }
                        }
                        
                        // 检查是否符合冠军的其他条件
                        if (isValid && championConditions.length > 0) {
                            for (const condition of championConditions) {
                                if (condition.type === 'big' || condition.type === '大') {
                                    if (i < 6) { isValid = false; break; }
                                } else if (condition.type === 'small' || condition.type === '小') {
                                    if (i > 5) { isValid = false; break; }
                                } else if (condition.type === 'odd' || condition.type === '单') {
                                    if (i % 2 === 0) { isValid = false; break; }
                                } else if (condition.type === 'even' || condition.type === '双') {
                                    if (i % 2 === 1) { isValid = false; break; }
                                }
                            }
                        }
                        
                        // 检查是否符合亚军的其他条件
                        if (isValid && runnerupConditions.length > 0) {
                            for (const condition of runnerupConditions) {
                                if (condition.type === 'big' || condition.type === '大') {
                                    if (j < 6) { isValid = false; break; }
                                } else if (condition.type === 'small' || condition.type === '小') {
                                    if (j > 5) { isValid = false; break; }
                                } else if (condition.type === 'odd' || condition.type === '单') {
                                    if (j % 2 === 0) { isValid = false; break; }
                                } else if (condition.type === 'even' || condition.type === '双') {
                                    if (j % 2 === 1) { isValid = false; break; }
                                }
                            }
                        }
                        
                        // 优先选择符合号码投注的组合
                        if (isValid) {
                            const priority = (championNumber === i ? 10 : 0) + (runnerupNumber === j ? 10 : 0);
                            possiblePairs.push([i, j, priority]);
                        }
                    }
                }
            }
            
            if (possiblePairs.length > 0) {
                // 优先选择高优先级的组合
                possiblePairs.sort((a, b) => b[2] - a[2]);
                const selectedPair = possiblePairs[0];
                result[0] = selectedPair[0];
                result[1] = selectedPair[1];
                usedNumbers.add(selectedPair[0]);
                usedNumbers.add(selectedPair[1]);
                console.log(`  冠亚和控制: 选择冠军${selectedPair[0]}，亚军${selectedPair[1]}，和值${selectedPair[0] + selectedPair[1]}`);
            }
        }
        
        // 2. 处理龙虎投注
        if (dragonTigerBets.length > 0) {
            for (const dtBet of dragonTigerBets) {
                const parts = dtBet.value.split('_');
                if (parts.length >= 3) {
                    const pos1 = parseInt(parts[1]);
                    const pos2 = parseInt(parts[2]);
                    const betSide = parts[0]; // dragon or tiger
                    
                    // 如果这两个位置还没有设定
                    if (result[pos1 - 1] === 0 && result[pos2 - 1] === 0) {
                        const availableNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(n => !usedNumbers.has(n));
                        if (availableNumbers.length >= 2) {
                            // 随机选择两个数字
                            const idx1 = Math.floor(Math.random() * availableNumbers.length);
                            const num1 = availableNumbers[idx1];
                            availableNumbers.splice(idx1, 1);
                            
                            const idx2 = Math.floor(Math.random() * availableNumbers.length);
                            const num2 = availableNumbers[idx2];
                            
                            // 根据投注设定大小
                            if (betSide === 'dragon') {
                                result[pos1 - 1] = Math.max(num1, num2);
                                result[pos2 - 1] = Math.min(num1, num2);
                            } else {
                                result[pos1 - 1] = Math.min(num1, num2);
                                result[pos2 - 1] = Math.max(num1, num2);
                            }
                            
                            usedNumbers.add(result[pos1 - 1]);
                            usedNumbers.add(result[pos2 - 1]);
                            console.log(`  龙虎控制: 位置${pos1}=${result[pos1 - 1]}，位置${pos2}=${result[pos2 - 1]}，${betSide}赢`);
                        }
                    }
                }
            }
        }
        
        // 3. 处理大小单双投注
        for (let position = 1; position <= 10; position++) {
            const posTwoSides = twoSidesBets[position] || [];
            
            if (posTwoSides.length > 0 && result[position - 1] === 0) {
                // 找出符合所有条件的号码
                const availableNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(n => !usedNumbers.has(n));
                const validNumbers = availableNumbers.filter(num => {
                    return posTwoSides.every(bet => {
                        if (bet.type === 'big' || bet.type === '大') return num >= 6;
                        if (bet.type === 'small' || bet.type === '小') return num <= 5;
                        if (bet.type === 'odd' || bet.type === '单') return num % 2 === 1;
                        if (bet.type === 'even' || bet.type === '双') return num % 2 === 0;
                        return true;
                    });
                });
                
                if (validNumbers.length > 0) {
                    const selected = validNumbers[Math.floor(Math.random() * validNumbers.length)];
                    result[position - 1] = selected;
                    usedNumbers.add(selected);
                    console.log(`  位置${position}: 选择符合条件的号码${selected} (条件: ${posTwoSides.map(b => b.type).join(', ')})`);
                }
            }
        }
        
        // 4. 处理号码投注
        for (let position = 1; position <= 10; position++) {
            const userBets = userBetsByPosition[position] || [];
            
            if (userBets.length > 0 && result[position - 1] === 0) {
                // 随机选择用户下注的一个号码
                const selectedBet = userBets[Math.floor(Math.random() * userBets.length)];
                if (!usedNumbers.has(selectedBet.number)) {
                    result[position - 1] = selectedBet.number;
                    usedNumbers.add(selectedBet.number);
                    console.log(`  位置${position}: 选择用户下注号码${selectedBet.number}`);
                }
            }
        }
        
        // 填充剩余位置
        const allNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const remainingNumbers = allNumbers.filter(n => !usedNumbers.has(n));
        
        // 随机填充剩余位置
        for (let i = 0; i < 10; i++) {
            if (result[i] === 0 && remainingNumbers.length > 0) {
                const idx = Math.floor(Math.random() * remainingNumbers.length);
                result[i] = remainingNumbers[idx];
                remainingNumbers.splice(idx, 1);
            }
        }
        
        console.log(`✅ [赢控制] 最终结果: ${result.join(', ')}`);
        return result;
    }

    /**
     * 检查和值是否会让用户输
     */
    checkSumLose(sum, betValue) {
        if (/^\d+$/.test(betValue)) {
            return sum !== parseInt(betValue);
        } else if (['big', '大'].includes(betValue)) {
            return sum < 12;
        } else if (['small', '小'].includes(betValue)) {
            return sum > 11;
        } else if (['odd', '单'].includes(betValue)) {
            return sum % 2 === 0;
        } else if (['even', '双'].includes(betValue)) {
            return sum % 2 === 1;
        }
        return true;
    }

    /**
     * 检查和值是否会让用户赢
     */
    checkSumWin(sum, betValue) {
        if (/^\d+$/.test(betValue)) {
            return sum === parseInt(betValue);
        } else if (['big', '大'].includes(betValue)) {
            return sum >= 12;
        } else if (['small', '小'].includes(betValue)) {
            return sum <= 11;
        } else if (['odd', '单'].includes(betValue)) {
            return sum % 2 === 1;
        } else if (['even', '双'].includes(betValue)) {
            return sum % 2 === 0;
        }
        return false;
    }

    /**
     * 保存开奖结果到数据库
     */
    async saveDrawResult(period, result) {
        try {
            // 生成区块链资料
            const blockchainData = generateBlockchainData(period, result);
            
            // 使用 JavaScript Date 确保储存正确的时间
            const drawTime = new Date().toISOString();
            
            await db.none(`
                INSERT INTO result_history (period, result, position_1, position_2, position_3, position_4, position_5, position_6, position_7, position_8, position_9, position_10, draw_time, block_height, block_hash)
                VALUES ($1, $2::json, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                ON CONFLICT (period) DO UPDATE SET
                result = $2::json,
                position_1 = $3, position_2 = $4, position_3 = $5, position_4 = $6, position_5 = $7,
                position_6 = $8, position_7 = $9, position_8 = $10, position_9 = $11, position_10 = $12,
                draw_time = $13,
                block_height = $14, block_hash = $15
            `, [period, JSON.stringify(result), ...result, drawTime, blockchainData.blockHeight, blockchainData.blockHash]);
            
            console.log(`✅ [结果保存] 期号 ${period} 结果已保存: [${result.join(', ')}] 区块高度: ${blockchainData.blockHeight}`);
            
            // 验证保存的结果
            const savedResult = await db.oneOrNone(`
                SELECT position_1, position_2, position_3, position_4, position_5,
                       position_6, position_7, position_8, position_9, position_10
                FROM result_history
                WHERE period = $1
            `, [period]);
            
            if (savedResult) {
                const savedPositions = [];
                for (let i = 1; i <= 10; i++) {
                    savedPositions.push(savedResult[`position_${i}`]);
                }
                
                // 验证每个位置的号码是否正确
                const allCorrect = result.every((num, index) => parseInt(num) === parseInt(savedPositions[index]));
                
                if (!allCorrect) {
                    console.error(`❌ [数据验证] 警告：保存的结果与原始结果不符！`);
                    console.error(`   原始结果: [${result.join(', ')}]`);
                    console.error(`   保存结果: [${savedPositions.join(', ')}]`);
                    
                    // 找出不符的位置
                    result.forEach((num, index) => {
                        if (parseInt(num) !== parseInt(savedPositions[index])) {
                            console.error(`   ❌ 第${index + 1}名: 应该是 ${num}，但保存为 ${savedPositions[index]}`);
                        }
                    });
                    
                    throw new Error('开奖结果保存验证失败');
                } else {
                    console.log(`✅ [数据验证] 开奖结果保存验证通过`);
                }
            }
            
        } catch (error) {
            console.error(`❌ [结果保存] 期号 ${period} 保存失败:`, error);
            throw error;
        }
    }

    /**
     * 同步结果到代理系统
     */
    async syncToAgentSystem(period, result) {
        try {
            const response = await fetch(`${this.AGENT_API_URL}/api/agent/sync-draw-record`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    period: period.toString(),
                    result: result,
                    draw_time: new Date().toISOString()
                })
            });
            
            if (response.ok) {
                console.log(`✅ [代理同步] 期号 ${period} 同步成功`);
            } else {
                console.error(`❌ [代理同步] 期号 ${period} 同步失败: ${response.status}`);
            }
            
        } catch (error) {
            console.error(`❌ [代理同步] 期号 ${period} 同步错误:`, error);
        }
    }

    /**
     * 执行结算
     */
    async executeSettlement(period, result) {
        try {
            const { safeExecuteSettlement } = await import('./safe-settlement-executor.js');
            
            const settlementResult = await safeExecuteSettlement(period);
            
            if (settlementResult.success) {
                console.log(`✅ [结算执行] 期号 ${period} 结算成功`);
                return settlementResult;
            } else {
                throw new Error(settlementResult.error || '结算失败');
            }
            
        } catch (error) {
            console.error(`❌ [结算执行] 期号 ${period} 结算失败:`, error);
            throw error;
        }
    }
}

// 创建全局单例
const fixedDrawSystemManager = new FixedDrawSystemManager();

export default fixedDrawSystemManager;
export { FixedDrawSystemManager };