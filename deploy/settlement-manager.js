// settlement-manager.js - 结算管理器，确保结算只执行一次

const settledPeriods = new Set();
const pendingSettlements = new Map();

/**
 * 注册待结算的期号
 */
export function registerPendingSettlement(period) {
    if (!settledPeriods.has(period) && !pendingSettlements.has(period)) {
        pendingSettlements.set(period, {
            registeredAt: new Date(),
            status: 'pending'
        });
        console.log(`📝 [结算管理] 注册待结算期号: ${period}`);
    }
}

/**
 * 执行结算（确保只执行一次）
 */
export async function executeManagedSettlement(period) {
    // 检查是否已结算
    if (settledPeriods.has(period)) {
        console.log(`⏭️ [结算管理] 期号 ${period} 已结算，跳过`);
        return { success: true, skipped: true, message: '已结算' };
    }
    
    // 标记为结算中
    if (pendingSettlements.has(period)) {
        pendingSettlements.get(period).status = 'settling';
    }
    
    try {
        // 执行结算
        const { safeExecuteSettlement } = await import('./safe-settlement-executor.js');
        const result = await safeExecuteSettlement(period);
        
        // 标记为已结算
        settledPeriods.add(period);
        pendingSettlements.delete(period);
        
        // 清理旧记录（保留最近100期）
        if (settledPeriods.size > 100) {
            const sorted = Array.from(settledPeriods).sort();
            const toRemove = sorted.slice(0, sorted.length - 100);
            toRemove.forEach(p => settledPeriods.delete(p));
        }
        
        return result;
        
    } catch (error) {
        // 结算失败，从待结算列表移除但不加入已结算
        pendingSettlements.delete(period);
        throw error;
    }
}

export default {
    registerPendingSettlement,
    executeManagedSettlement
};
