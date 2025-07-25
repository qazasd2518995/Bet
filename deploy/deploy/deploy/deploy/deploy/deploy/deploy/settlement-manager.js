// settlement-manager.js - 結算管理器，確保結算只執行一次

const settledPeriods = new Set();
const pendingSettlements = new Map();

/**
 * 註冊待結算的期號
 */
export function registerPendingSettlement(period) {
    if (!settledPeriods.has(period) && !pendingSettlements.has(period)) {
        pendingSettlements.set(period, {
            registeredAt: new Date(),
            status: 'pending'
        });
        console.log(`📝 [結算管理] 註冊待結算期號: ${period}`);
    }
}

/**
 * 執行結算（確保只執行一次）
 */
export async function executeManagedSettlement(period) {
    // 檢查是否已結算
    if (settledPeriods.has(period)) {
        console.log(`⏭️ [結算管理] 期號 ${period} 已結算，跳過`);
        return { success: true, skipped: true, message: '已結算' };
    }
    
    // 標記為結算中
    if (pendingSettlements.has(period)) {
        pendingSettlements.get(period).status = 'settling';
    }
    
    try {
        // 執行結算
        const { safeExecuteSettlement } = await import('./safe-settlement-executor.js');
        const result = await safeExecuteSettlement(period);
        
        // 標記為已結算
        settledPeriods.add(period);
        pendingSettlements.delete(period);
        
        // 清理舊記錄（保留最近100期）
        if (settledPeriods.size > 100) {
            const sorted = Array.from(settledPeriods).sort();
            const toRemove = sorted.slice(0, sorted.length - 100);
            toRemove.forEach(p => settledPeriods.delete(p));
        }
        
        return result;
        
    } catch (error) {
        // 結算失敗，從待結算列表移除但不加入已結算
        pendingSettlements.delete(period);
        throw error;
    }
}

export default {
    registerPendingSettlement,
    executeManagedSettlement
};
