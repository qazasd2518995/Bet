// simplified-draw-system.js - 简化的开奖系统
import db from './db/config.js';
import fetch from 'node-fetch';

/**
 * 统一的开奖流程管理器
 * 简化版本：移除预先生成，只在开奖时执行
 */
class DrawSystemManager {
    constructor() {
        this.AGENT_API_URL = process.env.NODE_ENV === 'production' 
            ? 'https://bet-agent.onrender.com' 
            : 'http://localhost:3003';
    }

    /**
     * 执行开奖 - 主要入口
     * - 检查控制设定
     * - 分析下注情况
     * - 生成开奖结果
     * - 保存到数据库
     * - 执行结算
     */
    async executeDrawing(period) {
        console.log(`🎯 [统一开奖] 期号 ${period} 开始执行开奖...`);
        
        try {
            // 1. 检查输赢控制设定
            const controlConfig = await this.checkActiveControl(period);
            console.log(`🎯 [控制检查] 期号 ${period} 控制设定:`, controlConfig);
            
            // 2. 分析当期下注情况 (只检查未结算的注单)
            const betAnalysis = await this.analyzePeriodBets(period);
            console.log(`📊 [下注分析] 期号 ${period} 分析结果:`, betAnalysis);
            
            // 3. 根据控制设定和下注情况生成结果
            const drawResult = await this.generateFinalResult(period, controlConfig, betAnalysis);
            console.log(`🎯 [结果生成] 期号 ${period} 最终结果:`, drawResult);
            
            // 4. 保存开奖结果到数据库
            await this.saveDrawResult(period, drawResult);
            console.log(`✅ [结果保存] 期号 ${period} 开奖结果已保存`);
            
            // 5. 同步到代理系统
            await this.syncToAgentSystem(period, drawResult);
            console.log(`✅ [代理同步] 期号 ${period} 已同步到代理系统`);
            
            // 6. 执行结算
            const settlementResult = await this.executeSettlement(period, drawResult);
            console.log(`✅ [结算完成] 期号 ${period} 结算结果:`, {
                settledCount: settlementResult.settledCount,
                winCount: settlementResult.winCount,
                totalWinAmount: settlementResult.totalWinAmount
            });
            
            console.log(`🎉 [统一开奖] 期号 ${period} 开奖流程完全完成`);
            return {
                success: true,
                period: period,
                result: drawResult,
                settlement: settlementResult
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
     * 分析当期下注情况 (只检查未结算注单)
     */
    async analyzePeriodBets(period) {
        try {
            // 获取所有未结算的下注
            const allBets = await db.manyOrNone(`
                SELECT bet_type, bet_value, position, amount, username
                FROM bet_history 
                WHERE period = $1 AND settled = false
            `, [period]);
            
            if (!allBets || allBets.length === 0) {
                console.log(`📊 [下注分析] 期号 ${period} 没有未结算的下注`);
                return {
                    totalAmount: 0,
                    betCount: 0,
                    numberBets: {},
                    sumValueBets: {},
                    targetUserBets: []
                };
            }
            
            let totalAmount = 0;
            const numberBets = {};
            const sumValueBets = {};
            const targetUserBets = [];
            
            for (const bet of allBets) {
                totalAmount += parseFloat(bet.amount);
                
                // 统计号码投注
                if (bet.bet_type === 'number' && bet.position) {
                    const key = `${bet.position}_${bet.bet_value}`;
                    numberBets[key] = (numberBets[key] || 0) + parseFloat(bet.amount);
                }
                
                // 统计冠亚和投注
                if (bet.bet_type === 'sum' || bet.bet_type === 'sumValue') {
                    sumValueBets[bet.bet_value] = (sumValueBets[bet.bet_value] || 0) + parseFloat(bet.amount);
                }
                
                // 记录所有用户下注(用于后续目标用户分析)
                targetUserBets.push({
                    username: bet.username,
                    betType: bet.bet_type,
                    betValue: bet.bet_value,
                    position: bet.position,
                    amount: parseFloat(bet.amount)
                });
            }
            
            console.log(`📊 [下注分析] 期号 ${period} 未结算下注统计: 总额=${totalAmount}, 笔数=${allBets.length}`);
            
            return {
                totalAmount,
                betCount: allBets.length,
                numberBets,
                sumValueBets,
                targetUserBets
            };
            
        } catch (error) {
            console.error(`❌ [下注分析] 期号 ${period} 分析失败:`, error);
            return {
                totalAmount: 0,
                betCount: 0,
                numberBets: {},
                sumValueBets: {},
                targetUserBets: []
            };
        }
    }

    /**
     * 根据控制设定和下注分析生成最终结果
     */
    async generateFinalResult(period, controlConfig, betAnalysis) {
        console.log(`🎲 [结果生成] 期号 ${period} 开始生成最终结果...`);
        
        // 如果是正常模式或没有下注，直接随机生成
        if (controlConfig.mode === 'normal' || !controlConfig.enabled || betAnalysis.totalAmount === 0) {
            console.log(`🎲 [结果生成] 期号 ${period} 使用纯随机模式`);
            return this.generateRandomResult();
        }
        
        // 根据不同控制模式生成结果
        switch (controlConfig.mode) {
            case 'auto_detect':
                return await this.generateAutoDetectResult(period, betAnalysis);
            
            case 'single_member':
                return await this.generateTargetMemberResult(period, controlConfig, betAnalysis);
            
            case 'agent_line':
                return await this.generateAgentLineResult(period, controlConfig, betAnalysis);
            
            default:
                console.log(`🎲 [结果生成] 期号 ${period} 未知控制模式，使用随机`);
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
    async generateAutoDetectResult(period, betAnalysis) {
        console.log(`🤖 [自动侦测] 期号 ${period} 开始自动侦测分析...`);
        
        // 简化的自动侦测逻辑：如果总下注额较大，倾向于让平台获利
        if (betAnalysis.totalAmount > 100) {
            console.log(`🤖 [自动侦测] 期号 ${period} 大额投注期，生成平台获利结果`);
            return this.generatePlatformFavorableResult(betAnalysis);
        } else {
            console.log(`🤖 [自动侦测] 期号 ${period} 小额投注期，使用随机结果`);
            return this.generateRandomResult();
        }
    }

    /**
     * 目标会员控制结果生成
     */
    async generateTargetMemberResult(period, controlConfig, betAnalysis) {
        console.log(`👤 [目标会员] 期号 ${period} 为 ${controlConfig.target_username} 生成控制结果...`);
        
        // 找出目标用户的下注
        const targetBets = betAnalysis.targetUserBets.filter(bet => 
            bet.username === controlConfig.target_username
        );
        
        if (targetBets.length === 0) {
            console.log(`👤 [目标会员] 期号 ${period} 目标用户没有下注，使用随机结果`);
            return this.generateRandomResult();
        }
        
        // 根据控制百分比决定输赢
        // 资料库有可能存 0.5 代表 50% 或 50 代表 50%
        let pct = parseFloat(controlConfig.control_percentage);
        if (isNaN(pct)) pct = 0;
        // 如果 >1 代表使用 0-100 百分比，转成 0-1
        if (pct > 1) pct = pct / 100;
        const shouldWin = Math.random() < pct;
        
        if (shouldWin) {
            console.log(`👤 [目标会员] 期号 ${period} 生成让目标用户获胜的结果`);
            return this.generateWinningResult(targetBets);
        } else {
            console.log(`👤 [目标会员] 期号 ${period} 生成让目标用户失败的结果`);
            return this.generateLosingResult(targetBets);
        }
    }

    /**
     * 代理线控制结果生成
     */
    async generateAgentLineResult(period, controlConfig, betAnalysis) {
        console.log(`🏢 [代理线] 期号 ${period} 为代理线生成控制结果...`);
        // 简化实现，可以后续扩展
        return this.generateRandomResult();
    }

    /**
     * 生成平台获利的结果
     */
    generatePlatformFavorableResult(betAnalysis) {
        // 避开热门号码投注
        const hotNumbers = new Set();
        
        Object.keys(betAnalysis.numberBets).forEach(key => {
            const [position, number] = key.split('_');
            if (betAnalysis.numberBets[key] > 10) { // 下注额超过10的号码
                hotNumbers.add(parseInt(number));
            }
        });
        
        // 生成避开热门号码的结果
        const result = this.generateRandomResult();
        
        // 如果前两名包含热门号码，重新洗牌
        if (hotNumbers.has(result[0]) || hotNumbers.has(result[1])) {
            return this.generateRandomResult(); // 简化处理，可以优化
        }
        
        return result;
    }

    /**
     * 生成让特定下注获胜的结果
     */
    generateWinningResult(targetBets) {
        const result = this.generateRandomResult();
        
        // 简化实现：让第一个号码投注中奖
        const numberBet = targetBets.find(bet => bet.bet_type === 'number' && bet.position);
        if (numberBet) {
            const position = parseInt(numberBet.position) - 1;
            const targetNumber = parseInt(numberBet.bet_value);
            
            // 将目标号码放到指定位置
            const currentIndex = result.indexOf(targetNumber);
            if (currentIndex !== -1) {
                [result[position], result[currentIndex]] = [result[currentIndex], result[position]];
            }
        }
        
        return result;
    }

    /**
     * 生成让特定下注失败的结果
     */
    generateLosingResult(targetBets) {
        const result = this.generateRandomResult();
        
        // 确保目标用户的号码投注不中奖
        targetBets.forEach(bet => {
            if (bet.bet_type === 'number' && bet.position) {
                const position = parseInt(bet.position) - 1;
                const targetNumber = parseInt(bet.bet_value);
                
                // 如果目标号码在对应位置，将其移走
                if (result[position] === targetNumber) {
                    const swapIndex = (position + 1) % 10;
                    [result[position], result[swapIndex]] = [result[swapIndex], result[position]];
                }
            }
        });
        
        return result;
    }

    /**
     * 保存开奖结果到数据库
     */
    async saveDrawResult(period, result) {
        try {
            // 使用 JavaScript Date 确保储存正确的时间
            const drawTime = new Date().toISOString();
            
            await db.none(`
                INSERT INTO result_history (period, result, position_1, position_2, position_3, position_4, position_5, position_6, position_7, position_8, position_9, position_10, draw_time)
                VALUES ($1, $2::json, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (period) DO UPDATE SET
                result = $2::json,
                position_1 = $3, position_2 = $4, position_3 = $5, position_4 = $6, position_5 = $7,
                position_6 = $8, position_7 = $9, position_8 = $10, position_9 = $11, position_10 = $12,
                draw_time = $13
            `, [period, JSON.stringify(result), ...result, drawTime]);
            
            console.log(`✅ [结果保存] 期号 ${period} 结果已保存: [${result.join(', ')}]`);
            
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
            // 不抛出错误，避免影响主流程
        }
    }

    /**
     * 执行结算
     */
    async executeSettlement(period, result) {
        try {
            // 动态导入结算系统
            const { enhancedSettlement } = await import('./enhanced-settlement-system.js');
            
            const settlementResult = await enhancedSettlement(period, { positions: result });
            
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
const drawSystemManager = new DrawSystemManager();

export default drawSystemManager;
export { DrawSystemManager };