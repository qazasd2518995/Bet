// fixed-draw-system.js - 修正後的開獎系統
import db from './db/config.js';
import fetch from 'node-fetch';

/**
 * 修正後的統一開獎流程管理器
 * 確保控制系統真正按照設定的機率執行
 */
class FixedDrawSystemManager {
    constructor() {
        this.AGENT_API_URL = process.env.NODE_ENV === 'production' 
            ? 'https://bet-agent.onrender.com' 
            : 'http://localhost:3003';
    }

    /**
     * 執行開獎 - 主要入口（優化版）
     */
    async executeDrawing(period) {
        console.log(`🎯 [統一開獎] 期號 ${period} 開始執行開獎...`);
        
        try {
            // 1. 並行執行控制檢查和下注分析，減少等待時間
            const [controlConfig, betAnalysis] = await Promise.all([
                this.checkActiveControl(period),
                this.analyzePeriodBets(period)
            ]);
            
            console.log(`🎯 [控制檢查] 期號 ${period} 控制設定:`, controlConfig);
            console.log(`📊 [下注分析] 期號 ${period} 分析結果:`, betAnalysis);
            
            // 2. 根據控制設定和下注情況生成結果
            const drawResult = await this.generateFinalResult(period, controlConfig, betAnalysis);
            console.log(`🎯 [結果生成] 期號 ${period} 最終結果:`, drawResult);
            
            // 3. 保存開獎結果到數據庫（關鍵操作，必須同步執行）
            await this.saveDrawResult(period, drawResult);
            console.log(`✅ [結果保存] 期號 ${period} 開獎結果已保存`);
            
            // 4. 異步執行後續操作（同步代理系統和結算）
            // 重要：延遲執行結算，確保所有投注都已停止
            setTimeout(async () => {
                try {
                    // 先同步到代理系統
                    const syncResult = await this.syncToAgentSystem(period, drawResult);
                    console.log(`✅ [代理同步] 期號 ${period} 已同步到代理系統`);
                    
                    // 延遲1秒後執行結算，確保所有投注記錄都已保存
                    setTimeout(async () => {
                        try {
                            const settlementResult = await this.executeSettlement(period, drawResult);
                            console.log(`✅ [結算完成] 期號 ${period} 結算結果:`, {
                                settledCount: settlementResult.settledCount,
                                winCount: settlementResult.winCount,
                                totalWinAmount: settlementResult.totalWinAmount
                            });
                        } catch (error) {
                            console.error(`❌ [結算執行] 期號 ${period} 結算失敗:`, error);
                        }
                    }, 1000); // 延遲1秒執行結算
                } catch (error) {
                    console.error(`❌ [後續處理] 期號 ${period} 後續處理失敗:`, error);
                }
            }, 2000); // 延遲2秒開始執行後續操作，確保開獎狀態已結束
            
            return {
                success: true,
                period: period,
                result: drawResult,
                settlement: { pending: true } // 結算異步執行中
            };
            
        } catch (error) {
            console.error(`❌ [統一開獎] 期號 ${period} 執行開獎失敗:`, error);
            return {
                success: false,
                period: period,
                error: error.message
            };
        }
    }

    /**
     * 檢查當前活動的輸贏控制設定
     */
    async checkActiveControl(period) {
        try {
            const response = await fetch(`${this.AGENT_API_URL}/api/agent/internal/win-loss-control/active`);
            if (!response.ok) {
                console.log(`🔧 [控制檢查] 無法連接代理系統，使用正常模式`);
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
            console.error(`❌ [控制檢查] 檢查控制設定失敗:`, error);
            return { mode: 'normal', enabled: false };
        }
    }

    /**
     * 分析當期下注情況
     */
    async analyzePeriodBets(period) {
        try {
            const allBets = await db.manyOrNone(`
                SELECT bet_type, bet_value, position, amount, username
                FROM bet_history 
                WHERE period = $1 AND settled = false
            `, [period]);
            
            if (!allBets || allBets.length === 0) {
                return {
                    totalAmount: 0,
                    betCount: 0,
                    positionBets: {},
                    userBets: {},
                    platformRisk: 0
                };
            }
            
            let totalAmount = 0;
            const positionBets = {}; // 各位置的下注情況
            const userBets = {}; // 各用戶的下注情況
            
            for (const bet of allBets) {
                totalAmount += parseFloat(bet.amount);
                
                // 記錄用戶下注
                if (!userBets[bet.username]) {
                    userBets[bet.username] = [];
                }
                userBets[bet.username].push({
                    betType: bet.bet_type,
                    betValue: bet.bet_value,
                    position: bet.position,
                    amount: parseFloat(bet.amount)
                });
                
                // 記錄位置下注
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
            
            // 計算平台風險
            const platformRisk = this.calculatePlatformRisk(positionBets, totalAmount);
            
            return {
                totalAmount,
                betCount: allBets.length,
                positionBets,
                userBets,
                platformRisk
            };
            
        } catch (error) {
            console.error(`❌ [下注分析] 期號 ${period} 分析失敗:`, error);
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
     * 計算平台風險
     */
    calculatePlatformRisk(positionBets, totalBetAmount) {
        if (totalBetAmount === 0) return 0;
        
        let maxPotentialPayout = 0;
        
        // 計算每個位置如果開出熱門號碼的潛在賠付
        for (const [position, bets] of Object.entries(positionBets)) {
            let maxPayoutForPosition = 0;
            for (const [number, amount] of Object.entries(bets)) {
                const potentialPayout = amount * 9.89; // 假設賠率9.89
                if (potentialPayout > maxPayoutForPosition) {
                    maxPayoutForPosition = potentialPayout;
                }
            }
            maxPotentialPayout += maxPayoutForPosition;
        }
        
        // 風險係數 = 潛在最大賠付 / 總下注額
        const riskFactor = maxPotentialPayout / totalBetAmount;
        return riskFactor;
    }

    /**
     * 根據控制設定和下注分析生成最終結果
     */
    async generateFinalResult(period, controlConfig, betAnalysis) {
        console.log(`🎲 [結果生成] 期號 ${period} 開始生成最終結果...`);
        
        // 如果沒有下注，直接隨機生成
        if (betAnalysis.totalAmount === 0) {
            console.log(`🎲 [結果生成] 期號 ${period} 沒有下注，使用純隨機模式`);
            return this.generateRandomResult();
        }
        
        // 根據不同控制模式生成結果
        switch (controlConfig.mode) {
            case 'auto_detect':
                return this.generateAutoDetectResult(period, betAnalysis);
            
            case 'single_member':
                return this.generateTargetMemberResult(period, controlConfig, betAnalysis);
            
            case 'agent_line':
                return this.generateAgentLineResult(period, controlConfig, betAnalysis);
            
            default:
                console.log(`🎲 [結果生成] 期號 ${period} 使用正常模式`);
                return this.generateRandomResult();
        }
    }

    /**
     * 生成純隨機結果
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
     * 自動偵測模式結果生成
     */
    generateAutoDetectResult(period, betAnalysis) {
        console.log(`🤖 [自動偵測] 期號 ${period} 開始自動偵測分析...`);
        
        // 計算平台風險
        const riskFactor = betAnalysis.platformRisk;
        console.log(`📊 [自動偵測] 平台風險係數: ${riskFactor.toFixed(2)}`);
        
        // 如果風險係數過高（潛在賠付超過下注額的8倍），則生成對平台有利的結果
        if (riskFactor > 8) {
            console.log(`⚠️ [自動偵測] 風險過高，生成平台有利結果`);
            return this.generatePlatformFavorableResult(betAnalysis);
        }
        
        // 如果風險係數過低（潛在賠付低於下注額的5倍），則生成較平衡的結果
        if (riskFactor < 5) {
            console.log(`📊 [自動偵測] 風險較低，生成平衡結果`);
            return this.generateBalancedResult(betAnalysis);
        }
        
        // 其他情況使用隨機
        console.log(`🎲 [自動偵測] 風險正常，使用隨機結果`);
        return this.generateRandomResult();
    }

    /**
     * 目標會員控制結果生成（修正版）
     */
    generateTargetMemberResult(period, controlConfig, betAnalysis) {
        console.log(`👤 [目標會員] 期號 ${period} 為 ${controlConfig.target_username} 生成控制結果...`);
        
        // 找出目標用戶的下注
        const targetBets = betAnalysis.userBets[controlConfig.target_username] || [];
        
        if (targetBets.length === 0) {
            console.log(`👤 [目標會員] 期號 ${period} 目標用戶沒有下注，使用隨機結果`);
            return this.generateRandomResult();
        }
        
        // 解析控制百分比
        let controlPercentage = parseFloat(controlConfig.control_percentage);
        if (isNaN(controlPercentage)) controlPercentage = 0;
        if (controlPercentage > 1) controlPercentage = controlPercentage / 100;
        
        console.log(`🎮 [目標會員] 控制百分比: ${(controlPercentage * 100).toFixed(1)}%`);
        
        // 生成一個隨機數來決定這次是否要讓用戶輸
        const shouldLose = Math.random() < controlPercentage;
        
        if (shouldLose) {
            console.log(`❌ [目標會員] 根據${(controlPercentage * 100).toFixed(1)}%機率，這次讓用戶輸`);
            return this.generateLosingResultFixed(targetBets, betAnalysis.positionBets);
        } else {
            console.log(`✅ [目標會員] 根據${(100 - controlPercentage * 100).toFixed(1)}%機率，這次讓用戶贏`);
            return this.generateWinningResultFixed(targetBets, betAnalysis.positionBets);
        }
    }

    /**
     * 代理線控制結果生成
     */
    generateAgentLineResult(period, controlConfig, betAnalysis) {
        console.log(`🏢 [代理線] 期號 ${period} 為代理線生成控制結果...`);
        
        // 獲取代理線下所有用戶的下注
        // 這裡簡化處理，實際應該查詢代理關係
        const agentBets = [];
        for (const [username, bets] of Object.entries(betAnalysis.userBets)) {
            // 這裡應該檢查用戶是否屬於目標代理線
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
     * 生成平台獲利的結果
     */
    generatePlatformFavorableResult(betAnalysis) {
        const result = Array(10).fill(0);
        const availableNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        
        // 對每個位置，選擇下注最少的號碼
        for (let position = 1; position <= 10; position++) {
            const positionBets = betAnalysis.positionBets[position] || {};
            
            // 找出該位置下注最少的號碼
            let minBetNumber = 0;
            let minBetAmount = Infinity;
            
            for (const num of availableNumbers) {
                const betAmount = positionBets[num] || 0;
                if (betAmount < minBetAmount) {
                    minBetAmount = betAmount;
                    minBetNumber = num;
                }
            }
            
            // 選擇下注最少的號碼
            if (minBetNumber > 0) {
                result[position - 1] = minBetNumber;
                // 從可用號碼中移除
                const index = availableNumbers.indexOf(minBetNumber);
                if (index > -1) {
                    availableNumbers.splice(index, 1);
                }
            }
        }
        
        // 填充剩餘位置
        let fillIndex = 0;
        for (let i = 0; i < 10; i++) {
            if (result[i] === 0) {
                result[i] = availableNumbers[fillIndex++];
            }
        }
        
        console.log(`💰 [平台獲利] 生成結果: ${result.join(', ')}`);
        return result;
    }

    /**
     * 生成平衡的結果
     */
    generateBalancedResult(betAnalysis) {
        // 部分隨機，部分考慮下注情況
        const result = this.generateRandomResult();
        
        // 對前幾個位置進行調整，避免過度集中的熱門號碼
        for (let position = 1; position <= 3; position++) {
            const positionBets = betAnalysis.positionBets[position] || {};
            
            // 檢查當前號碼是否是熱門號碼
            const currentNumber = result[position - 1];
            const currentBetAmount = positionBets[currentNumber] || 0;
            
            // 如果是熱門號碼（下注額超過平均值的2倍），考慮替換
            const avgBet = Object.values(positionBets).reduce((a, b) => a + b, 0) / 10;
            if (currentBetAmount > avgBet * 2 && Math.random() < 0.7) {
                // 70%機率替換為冷門號碼
                for (let i = position; i < 10; i++) {
                    const candidateNumber = result[i];
                    const candidateBetAmount = positionBets[candidateNumber] || 0;
                    if (candidateBetAmount < avgBet) {
                        // 交換
                        [result[position - 1], result[i]] = [result[i], result[position - 1]];
                        break;
                    }
                }
            }
        }
        
        return result;
    }

    /**
     * 生成讓特定下注失敗的結果（修正版）
     */
    generateLosingResultFixed(targetBets, positionBets) {
        console.log(`🎯 [輸控制] 生成讓目標用戶輸的結果`);
        
        // 先生成一個隨機結果
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        
        // 收集目標用戶在各位置的下注號碼
        const userBetsByPosition = {};
        targetBets.forEach(bet => {
            if (bet.betType === 'number' && bet.position) {
                const pos = parseInt(bet.position);
                if (!userBetsByPosition[pos]) {
                    userBetsByPosition[pos] = new Set();
                }
                userBetsByPosition[pos].add(parseInt(bet.betValue));
            }
        });
        
        // 對每個有下注的位置，嘗試調整結果讓用戶輸
        let adjustmentsMade = 0;
        for (const [position, userNumbers] of Object.entries(userBetsByPosition)) {
            const pos = parseInt(position) - 1;
            const currentNumber = numbers[pos];
            
            // 如果當前號碼是用戶下注的
            if (userNumbers.has(currentNumber)) {
                // 找一個用戶沒下注的號碼來交換
                let swapped = false;
                for (let i = 0; i < 10; i++) {
                    if (!userNumbers.has(numbers[i])) {
                        // 交換號碼
                        [numbers[pos], numbers[i]] = [numbers[i], numbers[pos]];
                        adjustmentsMade++;
                        console.log(`  位置${position}: 將號碼${currentNumber}換成${numbers[pos]}（避開用戶下注）`);
                        swapped = true;
                        break;
                    }
                }
                
                if (!swapped) {
                    console.log(`  位置${position}: 無法避開用戶下注（覆蓋率100%）`);
                }
            } else {
                console.log(`  位置${position}: 號碼${currentNumber}已經不在用戶下注中`);
            }
        }
        
        console.log(`❌ [輸控制] 調整了${adjustmentsMade}個位置，最終結果: ${numbers.join(', ')}`);
        return numbers;
    }

    /**
     * 生成讓特定下注成功的結果（修正版）
     */
    generateWinningResultFixed(targetBets, positionBets) {
        console.log(`🎯 [贏控制] 生成讓目標用戶贏的結果`);
        
        // 收集目標用戶的下注
        const userBetsByPosition = {};
        targetBets.forEach(bet => {
            if (bet.betType === 'number' && bet.position) {
                const pos = parseInt(bet.position);
                if (!userBetsByPosition[pos]) {
                    userBetsByPosition[pos] = [];
                }
                userBetsByPosition[pos].push({
                    number: parseInt(bet.betValue),
                    amount: bet.amount
                });
            }
        });
        
        // 生成結果
        const result = Array(10).fill(0);
        const usedNumbers = new Set();
        
        // 對每個位置，如果用戶有下注，優先選擇其下注的號碼
        for (let position = 1; position <= 10; position++) {
            const userBets = userBetsByPosition[position] || [];
            
            if (userBets.length > 0) {
                // 隨機選擇用戶下注的一個號碼
                const selectedBet = userBets[Math.floor(Math.random() * userBets.length)];
                if (!usedNumbers.has(selectedBet.number)) {
                    result[position - 1] = selectedBet.number;
                    usedNumbers.add(selectedBet.number);
                    console.log(`  位置${position}: 選擇用戶下注號碼${selectedBet.number}`);
                }
            }
        }
        
        // 填充剩餘位置
        const allNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const remainingNumbers = allNumbers.filter(n => !usedNumbers.has(n));
        
        // 隨機填充剩餘位置
        for (let i = 0; i < 10; i++) {
            if (result[i] === 0 && remainingNumbers.length > 0) {
                const idx = Math.floor(Math.random() * remainingNumbers.length);
                result[i] = remainingNumbers[idx];
                remainingNumbers.splice(idx, 1);
            }
        }
        
        console.log(`✅ [贏控制] 最終結果: ${result.join(', ')}`);
        return result;
    }

    /**
     * 保存開獎結果到數據庫
     */
    async saveDrawResult(period, result) {
        try {
            await db.none(`
                INSERT INTO result_history (period, result, position_1, position_2, position_3, position_4, position_5, position_6, position_7, position_8, position_9, position_10, draw_time)
                VALUES ($1, $2::json, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                ON CONFLICT (period) DO UPDATE SET
                result = $2::json,
                position_1 = $3, position_2 = $4, position_3 = $5, position_4 = $6, position_5 = $7,
                position_6 = $8, position_7 = $9, position_8 = $10, position_9 = $11, position_10 = $12,
                draw_time = NOW()
            `, [period, JSON.stringify(result), ...result]);
            
            console.log(`✅ [結果保存] 期號 ${period} 結果已保存: [${result.join(', ')}]`);
            
            // 驗證保存的結果
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
                
                // 驗證每個位置的號碼是否正確
                const allCorrect = result.every((num, index) => parseInt(num) === parseInt(savedPositions[index]));
                
                if (!allCorrect) {
                    console.error(`❌ [數據驗證] 警告：保存的結果與原始結果不符！`);
                    console.error(`   原始結果: [${result.join(', ')}]`);
                    console.error(`   保存結果: [${savedPositions.join(', ')}]`);
                    
                    // 找出不符的位置
                    result.forEach((num, index) => {
                        if (parseInt(num) !== parseInt(savedPositions[index])) {
                            console.error(`   ❌ 第${index + 1}名: 應該是 ${num}，但保存為 ${savedPositions[index]}`);
                        }
                    });
                    
                    throw new Error('開獎結果保存驗證失敗');
                } else {
                    console.log(`✅ [數據驗證] 開獎結果保存驗證通過`);
                }
            }
            
        } catch (error) {
            console.error(`❌ [結果保存] 期號 ${period} 保存失敗:`, error);
            throw error;
        }
    }

    /**
     * 同步結果到代理系統
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
                console.log(`✅ [代理同步] 期號 ${period} 同步成功`);
            } else {
                console.error(`❌ [代理同步] 期號 ${period} 同步失敗: ${response.status}`);
            }
            
        } catch (error) {
            console.error(`❌ [代理同步] 期號 ${period} 同步錯誤:`, error);
        }
    }

    /**
     * 執行結算
     */
    async executeSettlement(period, result) {
        try {
            const { safeExecuteSettlement } = await import('./safe-settlement-executor.js');
            
            const settlementResult = await safeExecuteSettlement(period);
            
            if (settlementResult.success) {
                console.log(`✅ [結算執行] 期號 ${period} 結算成功`);
                return settlementResult;
            } else {
                throw new Error(settlementResult.error || '結算失敗');
            }
            
        } catch (error) {
            console.error(`❌ [結算執行] 期號 ${period} 結算失敗:`, error);
            throw error;
        }
    }
}

// 創建全局單例
const fixedDrawSystemManager = new FixedDrawSystemManager();

export default fixedDrawSystemManager;
export { FixedDrawSystemManager };