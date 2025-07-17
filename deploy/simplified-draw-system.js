// simplified-draw-system.js - 簡化的開獎系統
import db from './db/config.js';
import fetch from 'node-fetch';

/**
 * 統一的開獎流程管理器
 * 簡化版本：移除預先生成，只在開獎時執行
 */
class DrawSystemManager {
    constructor() {
        this.AGENT_API_URL = process.env.NODE_ENV === 'production' 
            ? 'https://bet-agent.onrender.com' 
            : 'http://localhost:3003';
    }

    /**
     * 執行開獎 - 主要入口
     * - 檢查控制設定
     * - 分析下注情況
     * - 生成開獎結果
     * - 保存到數據庫
     * - 執行結算
     */
    async executeDrawing(period) {
        console.log(`🎯 [統一開獎] 期號 ${period} 開始執行開獎...`);
        
        try {
            // 1. 檢查輸贏控制設定
            const controlConfig = await this.checkActiveControl(period);
            console.log(`🎯 [控制檢查] 期號 ${period} 控制設定:`, controlConfig);
            
            // 2. 分析當期下注情況 (只檢查未結算的注單)
            const betAnalysis = await this.analyzePeriodBets(period);
            console.log(`📊 [下注分析] 期號 ${period} 分析結果:`, betAnalysis);
            
            // 3. 根據控制設定和下注情況生成結果
            const drawResult = await this.generateFinalResult(period, controlConfig, betAnalysis);
            console.log(`🎯 [結果生成] 期號 ${period} 最終結果:`, drawResult);
            
            // 4. 保存開獎結果到數據庫
            await this.saveDrawResult(period, drawResult);
            console.log(`✅ [結果保存] 期號 ${period} 開獎結果已保存`);
            
            // 5. 同步到代理系統
            await this.syncToAgentSystem(period, drawResult);
            console.log(`✅ [代理同步] 期號 ${period} 已同步到代理系統`);
            
            // 6. 執行結算
            const settlementResult = await this.executeSettlement(period, drawResult);
            console.log(`✅ [結算完成] 期號 ${period} 結算結果:`, {
                settledCount: settlementResult.settledCount,
                winCount: settlementResult.winCount,
                totalWinAmount: settlementResult.totalWinAmount
            });
            
            console.log(`🎉 [統一開獎] 期號 ${period} 開獎流程完全完成`);
            return {
                success: true,
                period: period,
                result: drawResult,
                settlement: settlementResult
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
     * 分析當期下注情況 (只檢查未結算注單)
     */
    async analyzePeriodBets(period) {
        try {
            // 獲取所有未結算的下注
            const allBets = await db.manyOrNone(`
                SELECT bet_type, bet_value, position, amount, username
                FROM bet_history 
                WHERE period = $1 AND settled = false
            `, [period]);
            
            if (!allBets || allBets.length === 0) {
                console.log(`📊 [下注分析] 期號 ${period} 沒有未結算的下注`);
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
                
                // 統計號碼投注
                if (bet.bet_type === 'number' && bet.position) {
                    const key = `${bet.position}_${bet.bet_value}`;
                    numberBets[key] = (numberBets[key] || 0) + parseFloat(bet.amount);
                }
                
                // 統計冠亞和投注
                if (bet.bet_type === 'sum' || bet.bet_type === 'sumValue') {
                    sumValueBets[bet.bet_value] = (sumValueBets[bet.bet_value] || 0) + parseFloat(bet.amount);
                }
                
                // 記錄所有用戶下注(用於後續目標用戶分析)
                targetUserBets.push({
                    username: bet.username,
                    betType: bet.bet_type,
                    betValue: bet.bet_value,
                    position: bet.position,
                    amount: parseFloat(bet.amount)
                });
            }
            
            console.log(`📊 [下注分析] 期號 ${period} 未結算下注統計: 總額=${totalAmount}, 筆數=${allBets.length}`);
            
            return {
                totalAmount,
                betCount: allBets.length,
                numberBets,
                sumValueBets,
                targetUserBets
            };
            
        } catch (error) {
            console.error(`❌ [下注分析] 期號 ${period} 分析失敗:`, error);
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
     * 根據控制設定和下注分析生成最終結果
     */
    async generateFinalResult(period, controlConfig, betAnalysis) {
        console.log(`🎲 [結果生成] 期號 ${period} 開始生成最終結果...`);
        
        // 如果是正常模式或沒有下注，直接隨機生成
        if (controlConfig.mode === 'normal' || !controlConfig.enabled || betAnalysis.totalAmount === 0) {
            console.log(`🎲 [結果生成] 期號 ${period} 使用純隨機模式`);
            return this.generateRandomResult();
        }
        
        // 根據不同控制模式生成結果
        switch (controlConfig.mode) {
            case 'auto_detect':
                return await this.generateAutoDetectResult(period, betAnalysis);
            
            case 'single_member':
                return await this.generateTargetMemberResult(period, controlConfig, betAnalysis);
            
            case 'agent_line':
                return await this.generateAgentLineResult(period, controlConfig, betAnalysis);
            
            default:
                console.log(`🎲 [結果生成] 期號 ${period} 未知控制模式，使用隨機`);
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
    async generateAutoDetectResult(period, betAnalysis) {
        console.log(`🤖 [自動偵測] 期號 ${period} 開始自動偵測分析...`);
        
        // 簡化的自動偵測邏輯：如果總下注額較大，傾向於讓平台獲利
        if (betAnalysis.totalAmount > 100) {
            console.log(`🤖 [自動偵測] 期號 ${period} 大額投注期，生成平台獲利結果`);
            return this.generatePlatformFavorableResult(betAnalysis);
        } else {
            console.log(`🤖 [自動偵測] 期號 ${period} 小額投注期，使用隨機結果`);
            return this.generateRandomResult();
        }
    }

    /**
     * 目標會員控制結果生成
     */
    async generateTargetMemberResult(period, controlConfig, betAnalysis) {
        console.log(`👤 [目標會員] 期號 ${period} 為 ${controlConfig.target_username} 生成控制結果...`);
        
        // 找出目標用戶的下注
        const targetBets = betAnalysis.targetUserBets.filter(bet => 
            bet.username === controlConfig.target_username
        );
        
        if (targetBets.length === 0) {
            console.log(`👤 [目標會員] 期號 ${period} 目標用戶沒有下注，使用隨機結果`);
            return this.generateRandomResult();
        }
        
        // 根據控制百分比決定輸贏
        // 資料庫有可能存 0.5 代表 50% 或 50 代表 50%
        let pct = parseFloat(controlConfig.control_percentage);
        if (isNaN(pct)) pct = 0;
        // 如果 >1 代表使用 0-100 百分比，轉成 0-1
        if (pct > 1) pct = pct / 100;
        const shouldWin = Math.random() < pct;
        
        if (shouldWin) {
            console.log(`👤 [目標會員] 期號 ${period} 生成讓目標用戶獲勝的結果`);
            return this.generateWinningResult(targetBets);
        } else {
            console.log(`👤 [目標會員] 期號 ${period} 生成讓目標用戶失敗的結果`);
            return this.generateLosingResult(targetBets);
        }
    }

    /**
     * 代理線控制結果生成
     */
    async generateAgentLineResult(period, controlConfig, betAnalysis) {
        console.log(`🏢 [代理線] 期號 ${period} 為代理線生成控制結果...`);
        // 簡化實現，可以後續擴展
        return this.generateRandomResult();
    }

    /**
     * 生成平台獲利的結果
     */
    generatePlatformFavorableResult(betAnalysis) {
        // 避開熱門號碼投注
        const hotNumbers = new Set();
        
        Object.keys(betAnalysis.numberBets).forEach(key => {
            const [position, number] = key.split('_');
            if (betAnalysis.numberBets[key] > 10) { // 下注額超過10的號碼
                hotNumbers.add(parseInt(number));
            }
        });
        
        // 生成避開熱門號碼的結果
        const result = this.generateRandomResult();
        
        // 如果前兩名包含熱門號碼，重新洗牌
        if (hotNumbers.has(result[0]) || hotNumbers.has(result[1])) {
            return this.generateRandomResult(); // 簡化處理，可以優化
        }
        
        return result;
    }

    /**
     * 生成讓特定下注獲勝的結果
     */
    generateWinningResult(targetBets) {
        const result = this.generateRandomResult();
        
        // 簡化實現：讓第一個號碼投注中獎
        const numberBet = targetBets.find(bet => bet.bet_type === 'number' && bet.position);
        if (numberBet) {
            const position = parseInt(numberBet.position) - 1;
            const targetNumber = parseInt(numberBet.bet_value);
            
            // 將目標號碼放到指定位置
            const currentIndex = result.indexOf(targetNumber);
            if (currentIndex !== -1) {
                [result[position], result[currentIndex]] = [result[currentIndex], result[position]];
            }
        }
        
        return result;
    }

    /**
     * 生成讓特定下注失敗的結果
     */
    generateLosingResult(targetBets) {
        const result = this.generateRandomResult();
        
        // 確保目標用戶的號碼投注不中獎
        targetBets.forEach(bet => {
            if (bet.bet_type === 'number' && bet.position) {
                const position = parseInt(bet.position) - 1;
                const targetNumber = parseInt(bet.bet_value);
                
                // 如果目標號碼在對應位置，將其移走
                if (result[position] === targetNumber) {
                    const swapIndex = (position + 1) % 10;
                    [result[position], result[swapIndex]] = [result[swapIndex], result[position]];
                }
            }
        });
        
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
            // 不拋出錯誤，避免影響主流程
        }
    }

    /**
     * 執行結算
     */
    async executeSettlement(period, result) {
        try {
            // 動態導入結算系統
            const { enhancedSettlement } = await import('./enhanced-settlement-system.js');
            
            const settlementResult = await enhancedSettlement(period, { positions: result });
            
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
const drawSystemManager = new DrawSystemManager();

export default drawSystemManager;
export { DrawSystemManager };