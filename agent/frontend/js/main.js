// filepath: /Users/justin/Desktop/Bet/agent/frontend/js/main.js
// 代理管理系統前端 JavaScript 檔案
// 最後更新：2025-05-10

// API 基礎 URL - 根據環境調整
let API_BASE_URL;

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // 本地開發環境
    API_BASE_URL = '/api/agent';
} else {
    // Render 生產環境 - 不使用端口號，讓Render處理路由
    API_BASE_URL = 'https://bet-agent.onrender.com/api';
}

// 添加調試信息
console.log('當前API基礎URL:', API_BASE_URL, '主機名:', window.location.hostname);

// API請求通用配置
const API_CONFIG = {
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

// Vue 應用實例
const app = new Vue({
    el: '#app',
    data: {
        // 身份驗證狀態
        isLoggedIn: false,
        loading: false,
        
        // 登入表單
        loginForm: {
            username: '',
            password: ''
        },
        
        // 用戶資訊
        user: {
            id: '',
            username: '',
            level: 0,
            balance: 0
        },
        
        // 系統公告
        notices: [],
        
        // 當前活動分頁
        activeTab: 'dashboard',
        transactionTab: 'deposit',
        
        // 儀表板數據
        dashboardData: {
            totalAgents: 0,
            totalMembers: 0,
            todayTransactions: 0,
            monthlyCommission: 0
        },
        
        // 圖表實例
        transactionChart: null,
        
        // 代理管理相關
        agents: [],
        agentFilters: {
            level: '-1',
            status: '-1',
            keyword: ''
        },
        agentPagination: {
            currentPage: 1,
            totalPages: 1,
            limit: 20
        },
        
        // 新增代理相關
        showCreateAgentModal: false,
        newAgent: {
            username: '',
            password: '',
            level: '1',
            parent: '',
            commission: 0.2
        },
        parentAgents: [],
        
        // 編輯代理相關
        showEditAgentModal: false,
        editAgentData: {
            id: '',
            username: '',
            password: '',
            commission: 0.2,
            status: 1
        },
        editAgentModal: null,
        
        // 會員管理相關
        members: [],
        memberFilters: {
            status: '-1',
            keyword: ''
        },
        memberPagination: {
            currentPage: 1,
            totalPages: 1,
            limit: 20
        },
        
        // 新增會員相關
        showCreateMemberModal: false,
        newMember: {
            username: '',
            password: '',
            confirmPassword: ''
        },
        
        // 會員餘額調整相關
        showAdjustBalanceModal: false,
        balanceAdjustData: {
            memberId: null,
            memberUsername: '',
            agentId: null,
            currentBalance: 0,
            amount: 0,
            description: ''
        },
        transferType: 'deposit',
        transferAmount: 0,
        agentCurrentBalance: 0,
        adjustBalanceModal: null,
        
        // 點數轉移記錄
        pointTransfers: [],
        
        // 開獎記錄相關
        drawRecords: [],
        drawFilters: {
            period: '',
            date: ''
        },
        drawPagination: {
            currentPage: 1,
            totalPages: 1,
            limit: 20
        },
        
        // 添加下注記錄相關
        bets: [],
        betFilters: {
            member: '',
            date: '',
            period: ''
        },
        betPagination: {
            currentPage: 1,
            totalPages: 1,
            limit: 20
        },
        betStats: {
            totalBets: 0,
            totalAmount: 0,
            totalProfit: 0
        },
    },
    
    // 頁面載入時自動執行
    async mounted() {
        console.log('Vue應用已掛載');
        
        try {
            // 首先測試API連接
            console.log('開始測試API連接...');
            const apiConnected = await this.checkApiStatus();
            console.log('API連接測試結果:', apiConnected ? '成功' : '失敗');
            
            // 檢查登入狀態
            await this.checkAuth();
            
            // 獲取代理自身額度
            if (this.isLoggedIn && this.user && this.user.id) {
                try {
                    const response = await fetch(`${API_BASE_URL}/agent-balance?agentId=${this.user.id}`);
                    if (!response.ok) {
                        console.error('獲取代理額度HTTP錯誤:', response.status);
                        throw new Error(`HTTP錯誤: ${response.status}`);
                    }
                    const data = await response.json();
                    
                    if (data.success) {
                        this.user.balance = data.balance;
                        console.log('代理當前額度:', this.user.balance);
                    } else {
                        console.error('獲取代理額度失敗:', data.message);
                        this.showMessage('獲取代理額度失敗: ' + (data.message || '未知錯誤'), 'error');
                    }
                } catch (error) {
                    console.error('獲取代理額度出錯:', error);
                    // this.showMessage('獲取代理額度失敗，請檢查網絡連接或聯繫管理員', 'error');
                }
            }
            
            // 如果已登入，初始化儀表板和圖表
            if (this.isLoggedIn) {
                await this.fetchDashboardData();
                this.initTransactionChart();
                this.fetchNotices();
            }
        } catch (error) {
            console.error('Vue掛載期間出錯:', error);
        }
        
        // 初始化模態框
        this.initModals();
    },
    
    methods: {
        // 初始化 Bootstrap 5 模態框
        initModals() {
            // 不需要在此處初始化模態框，因為當它們通過v-if被渲染時才應該被初始化
        },
        
        // 顯示創建代理模態框
        showAgentModal() {
            this.showCreateAgentModal = true;
            this.$nextTick(() => {
                // 確保模態框元素已經被渲染到DOM後再初始化和顯示
                const modalEl = document.getElementById('createAgentModal');
                if (modalEl) {
                    this.agentModal = new bootstrap.Modal(modalEl);
                    this.agentModal.show();
                    this.fetchParentAgents();
                } else {
                    console.error('找不到代理模態框元素');
                    this.showMessage('系統錯誤，請稍後再試', 'error');
                }
            });
        },
        
        // 隱藏創建代理模態框
        hideCreateAgentModal() {
            if (this.agentModal) {
                this.agentModal.hide();
            }
            this.showCreateAgentModal = false;
        },
        
        // 顯示創建會員模態框
        showMemberModal() {
            this.showCreateMemberModal = true;
            this.$nextTick(() => {
                // 確保模態框元素已經被渲染到DOM後再初始化和顯示
                const modalEl = document.getElementById('createMemberModal');
                if (modalEl) {
                    this.memberModal = new bootstrap.Modal(modalEl);
                    this.memberModal.show();
                } else {
                    console.error('找不到會員模態框元素');
                    this.showMessage('系統錯誤，請稍後再試', 'error');
                }
            });
        },
        
        // 隱藏創建會員模態框
        hideCreateMemberModal() {
            if (this.memberModal) {
                this.memberModal.hide();
            }
            this.showCreateMemberModal = false;
        },
        
        // 檢查身份驗證狀態
        async checkAuth() {
            const token = localStorage.getItem('agent_token');
            const user = JSON.parse(localStorage.getItem('agent_user') || '{}');
            
            if (token && user.id) {
                this.isLoggedIn = true;
                this.user = user;
                
                // 設置 axios 身份驗證頭
                axios.defaults.headers.common['Authorization'] = token;
                return true;
            }
            return false;
        },
        
        // 登入方法
        async login() {
            if (!this.loginForm.username || !this.loginForm.password) {
                return this.showMessage('請輸入用戶名和密碼', 'error');
            }
            
            this.loading = true;
            
            try {
                const response = await axios.post(`${API_BASE_URL}/login`, this.loginForm);
                
                if (response.data.success) {
                    // 保存用戶資訊和 token
                    const { agent, token } = response.data;
                    localStorage.setItem('agent_token', token);
                    localStorage.setItem('agent_user', JSON.stringify(agent));
                    
                    // 設置 axios 身份驗證頭
                    axios.defaults.headers.common['Authorization'] = token;
                    
                    // 更新用戶資訊
                    this.user = agent;
                    this.isLoggedIn = true;
                    
                    // 獲取初始數據
                    await this.fetchDashboardData();
                    await this.fetchNotices();
                    
                    this.showMessage('登入成功', 'success');
                } else {
                    this.showMessage(response.data.message || '登入失敗', 'error');
                }
            } catch (error) {
                console.error('登入錯誤:', error);
                this.showMessage(error.response?.data?.message || '登入失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 登出方法
        logout() {
            // 清除本地存儲
            localStorage.removeItem('agent_token');
            localStorage.removeItem('agent_user');
            
            // 重置狀態
            this.isLoggedIn = false;
            this.user = {
                id: '',
                username: '',
                level: 0,
                balance: 0
            };
            
            // 重置 axios 身份驗證頭
            delete axios.defaults.headers.common['Authorization'];
            
            this.showMessage('已成功登出', 'success');
        },
        
        // 獲取儀表板數據
        async fetchDashboardData() {
            this.loading = true;
            
            try {
                const response = await axios.get(`${API_BASE_URL}/stats`, {
                    params: { agentId: this.user.id }
                });
                
                if (response.data.success) {
                    // 使用data屬性而非stats屬性
                    const data = response.data.data;
                    
                    if (!data) {
                        console.error('獲取儀表板數據錯誤: 返回數據格式異常', response.data);
                        this.showMessage('獲取數據失敗，數據格式異常', 'error');
                        return;
                    }
                    
                    this.dashboardData = {
                        totalAgents: this.user.level === 0 ? (data.agentCount || 10) : 0,
                        totalMembers: data.memberCount || 0,
                        todayTransactions: (data.totalDeposit || 0) + (data.totalWithdraw || 0),
                        monthlyCommission: data.totalRevenue || 0
                    };
                    
                    // 初始化交易圖表
                    this.$nextTick(() => {
                        this.initTransactionChart();
                    });
                } else {
                    // 處理成功但返回失敗的情況
                    console.error('獲取儀表板數據錯誤: API返回失敗', response.data);
                    this.showMessage(response.data.message || '獲取數據失敗，請稍後再試', 'error');
                }
            } catch (error) {
                console.error('獲取儀表板數據錯誤:', error);
                this.showMessage('獲取數據失敗，請檢查網絡連接', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 初始化交易趨勢圖表
        initTransactionChart() {
            const ctx = document.getElementById('transactionChart');
            if (!ctx) return;
            
            // 模擬數據 - 過去7天的交易數據
            const labels = Array(7).fill(0).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (6 - i));
                return `${date.getMonth() + 1}/${date.getDate()}`;
            });
            
            const transactionData = [15000, 22000, 19500, 24000, 28000, 21000, 26500];
            const commissionData = transactionData.map(val => val * 0.05);
            
            if (this.transactionChart) {
                this.transactionChart.destroy();
            }
            
            this.transactionChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: '交易金額',
                            data: transactionData,
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.2)',
                            borderWidth: 2,
                            fill: true
                        },
                        {
                            label: '佣金',
                            data: commissionData,
                            borderColor: 'rgba(255, 159, 64, 1)',
                            backgroundColor: 'rgba(255, 159, 64, 0.2)',
                            borderWidth: 2,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        },
        
        // 檢查API狀態
        async checkApiStatus() {
            try {
                console.log('開始API連接測試，使用URL:', `${API_BASE_URL}/health`);
                
                const response = await fetch(`${API_BASE_URL}/health`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    // 添加跨域支持
                    mode: 'cors',
                    cache: 'no-cache'
                });
                
                console.log('API響應狀態:', response.status, response.statusText);
                
                if (!response.ok) {
                    console.error('API健康檢查失敗:', response.status, response.statusText);
                    this.showMessage(`API連接失敗: ${response.status} ${response.statusText}`, 'error');
                    return false;
                }
                
                const data = await response.json();
                console.log('API健康狀態詳情:', data);
                
                if (data.status === 'ok') {
                    this.showMessage('API連接正常', 'success');
                    return true;
                } else {
                    this.showMessage(`API狀態異常: ${data.status || '未知狀態'}`, 'error');
                    return false;
                }
            } catch (error) {
                console.error('API連接測試出錯:', error.message);
                this.showMessage(`API連接出錯: ${error.message}`, 'error');
                return false;
            }
        },
        
        // 顯示訊息
        showMessage(message, type = 'info') {
            console.log(`[${type}] ${message}`);
            // 可根據項目需求使用 alert、toast 或自定義訊息組件
            if (type === 'error') {
                alert(`錯誤: ${message}`);
            } else if (type === 'success') {
                alert(`成功: ${message}`);
            } else {
                alert(message);
            }
        },
        
        // 格式化金額顯示
        formatMoney(amount) {
            if (amount === undefined || amount === null) return '0.00';
            return Number(amount).toLocaleString('zh-TW', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        },
        
        // 格式化日期顯示
        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleDateString('zh-TW');
        },
    },
    
    // 計算屬性
    computed: {
        // 檢查轉移是否有效
        isValidTransfer() {
            if (parseFloat(this.transferAmount) <= 0) {
                return false;
            }
            
            if (this.transferType === 'deposit') {
                return this.agentCurrentBalance >= parseFloat(this.transferAmount);
            } else if (this.transferType === 'withdraw') {
                return this.balanceAdjustData.currentBalance >= parseFloat(this.transferAmount);
            }
            
            return false;
        }
    },
    
    // 監聽屬性
    watch: {
        // 當活動分頁變更時，加載對應數據
        activeTab(newTab, oldTab) {
            if (newTab === 'dashboard' && oldTab !== 'dashboard') {
                this.fetchDashboardData();
            }
        }
    }
});