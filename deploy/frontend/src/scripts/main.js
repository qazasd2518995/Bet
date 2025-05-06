// main.js - 極速賽車前端邏輯

// 檢查用戶是否已登入
function checkLogin() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (!isLoggedIn && window.location.pathname.indexOf('login.html') === -1) {
        window.location.href = '../../login.html';
        return false;
    }
    return true;
}

// API 設置
// 根據環境自動選擇 API 基礎 URL
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3002/api'  // 本地開發環境
    : `${window.location.protocol}//${window.location.hostname}/api`;  // 生產環境

// 通用API請求函數
async function apiRequest(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_BASE_URL}/${endpoint}`, options);
        
        if (!response.ok) {
            throw new Error(`API 請求失敗: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API 請求錯誤:', error);
        throw error;
    }
}

// 格式化金額顯示
function formatMoney(amount) {
    return new Intl.NumberFormat('zh-TW', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

// 獲取用戶餘額
async function getUserBalance() {
    if (!checkLogin()) return 0;
    try {
        const data = await apiRequest('balance');
        return data.balance || 0;
    } catch (error) {
        console.error('獲取餘額失敗:', error);
        return 0;
    }
}

// 獲取遊戲數據
async function getGameData() {
    if (!checkLogin()) return null;
    try {
        return await apiRequest('game-data');
    } catch (error) {
        console.error('獲取遊戲數據失敗:', error);
        return null;
    }
}

// 獲取歷史記錄
async function getHistory() {
    if (!checkLogin()) return [];
    try {
        return await apiRequest('history');
    } catch (error) {
        console.error('獲取歷史記錄失敗:', error);
        return [];
    }
}

// 獲取下注記錄
async function getBetHistory() {
    if (!checkLogin()) return [];
    try {
        return await apiRequest('bet-history');
    } catch (error) {
        console.error('獲取下注記錄失敗:', error);
        return [];
    }
}

// 下注函數
async function placeBet(betType, value, position = null, amount) {
    if (!checkLogin()) return null;
    try {
        return await apiRequest('bet', 'POST', {
            betType,
            value,
            position,
            amount
        });
    } catch (error) {
        console.error('下注失敗:', error);
        return null;
    }
}

// 登出處理
function logout() {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('username');
    window.location.href = '../../login.html';
}

// 在頁面載入時執行登入檢查
document.addEventListener('DOMContentLoaded', function() {
    checkLogin();
});

// 導出函數供其他模塊使用
window.gameAPI = {
    formatMoney,
    getUserBalance,
    getGameData,
    getHistory,
    getBetHistory,
    placeBet,
    logout
};