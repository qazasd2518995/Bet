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
    API_BASE_URL = 'https://bet-agent.onrender.com/api/agent';
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
        // 將API_BASE_URL添加到Vue實例的data中，使模板可以訪問
        API_BASE_URL: API_BASE_URL,
        
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
        
        // 會員餘額修改相關
        modifyBalanceData: {
            memberId: null,
            memberUsername: '',
            currentBalance: 0,
            reason: ''
        },
        modifyBalanceType: 'absolute', // 'absolute' 或 'relative'
        modifyBalanceAmount: 0,
        balanceChangeDirection: 'increase', // 'increase' 或 'decrease'
        modifyMemberBalanceModal: null,
        
        // 代理餘額修改相關
        agentBalanceData: {
            agentId: null,
            agentUsername: '',
            currentBalance: 0,
            reason: '',
            description: '' // 新增: 點數轉移備註
        },
        agentModifyType: 'absolute', // 'absolute' 或 'relative'
        agentModifyAmount: 0,
        agentChangeDirection: 'increase', // 'increase' 或 'decrease'
        adjustAgentBalanceModal: null,
        
        // 新增: 代理點數轉移相關變量
        agentTransferType: 'deposit', // 'deposit' 或 'withdraw'
        agentTransferAmount: 0
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
                    // 測試不同可能的API路徑格式
                    console.log('嘗試獲取代理餘額，代理ID:', this.user.id);
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
            
            // 根據當前代理級別，設置默認的下級代理級別
            // 只能創建比自己高一級的代理
            this.newAgent = {
                username: '',
                password: '',
                level: (this.user.level + 1).toString(), // 設置為上級代理的下一級
                parent: this.user.id,
                commission: this.user.commission_rate ? parseFloat(this.user.commission_rate) * 0.9 : 0.2 // 默認佣金稍低於上級
            };
            
            this.$nextTick(() => {
                // 確保模態框元素已經被渲染到DOM後再初始化和顯示
                const modalEl = document.getElementById('createAgentModal');
                if (modalEl) {
                    this.agentModal = new bootstrap.Modal(modalEl);
                    this.agentModal.show();
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
                console.log('嘗試獲取儀表板數據，代理ID:', this.user.id);
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
                // 使用根路徑的health端點
                const healthUrl = 'https://bet-agent.onrender.com/api/health';
                console.log('開始API連接測試，使用URL:', healthUrl);
                
                const response = await fetch(healthUrl, {
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
            return date.toLocaleString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        },
        
        // 獲取系統公告
        async fetchNotices() {
            try {
                console.log('獲取系統公告...');
                const response = await fetch(`${API_BASE_URL}/notices`);
                
                if (!response.ok) {
                    console.error('獲取系統公告失敗:', response.status);
                    this.notices = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && Array.isArray(data.notices)) {
                    this.notices = data.notices;
                } else {
                    console.error('系統公告數據格式錯誤:', data);
                    this.notices = [];
                }
            } catch (error) {
                console.error('獲取系統公告錯誤:', error);
                this.notices = [];
            }
        },
        
        // 搜索代理
        async searchAgents() {
            this.loading = true;
            try {
                console.log('搜索代理...');
                const params = new URLSearchParams();
                if (this.agentFilters.level !== '-1') params.append('level', this.agentFilters.level);
                if (this.agentFilters.status !== '-1') params.append('status', this.agentFilters.status);
                if (this.agentFilters.keyword) params.append('keyword', this.agentFilters.keyword);
                params.append('parentId', this.user.id);
                
                const url = `${API_BASE_URL}/sub-agents?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('搜索代理失敗:', response.status);
                    this.agents = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.data) {
                    this.agents = data.data.list || [];
                    this.agentPagination.totalPages = Math.ceil(data.data.total / this.agentPagination.limit);
                    this.agentPagination.currentPage = data.data.page || 1;
                } else {
                    console.error('代理數據格式錯誤:', data);
                    this.agents = [];
                }
            } catch (error) {
                console.error('搜索代理錯誤:', error);
                this.agents = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索會員
        async searchMembers() {
            this.loading = true;
            try {
                console.log('搜索會員...');
                const params = new URLSearchParams();
                if (this.memberFilters.status !== '-1') params.append('status', this.memberFilters.status);
                if (this.memberFilters.keyword) params.append('keyword', this.memberFilters.keyword);
                params.append('agentId', this.user.id);
                
                const url = `${API_BASE_URL}/members?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('搜索會員失敗:', response.status);
                    this.members = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.data) {
                    this.members = data.data.list || [];
                    this.memberPagination.totalPages = Math.ceil(data.data.total / this.memberPagination.limit);
                    this.memberPagination.currentPage = data.data.page || 1;
                } else {
                    console.error('會員數據格式錯誤:', data);
                    this.members = [];
                }
            } catch (error) {
                console.error('搜索會員錯誤:', error);
                this.members = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 隱藏餘額調整模態框
        hideAdjustBalanceModal() {
            if (this.adjustBalanceModal) {
                this.adjustBalanceModal.hide();
            }
            this.showAdjustBalanceModal = false;
        },
        
        // 計算最終會員餘額
        calculateFinalMemberBalance() {
            const currentBalance = parseFloat(this.balanceAdjustData.currentBalance) || 0;
            const amount = parseFloat(this.transferAmount) || 0;
            if (this.transferType === 'deposit') {
                return currentBalance + amount;
            } else {
                return currentBalance - amount;
            }
        },
        
        // 計算最終代理餘額
        calculateFinalAgentBalance() {
            const currentBalance = parseFloat(this.agentCurrentBalance) || 0;
            const amount = parseFloat(this.transferAmount) || 0;
            if (this.transferType === 'deposit') {
                return currentBalance - amount;
            } else {
                return currentBalance + amount;
            }
        },
        
        // 搜索下注記錄
        async searchBets() {
            this.loading = true;
            try {
                console.log('搜索下注記錄...');
                const params = new URLSearchParams();
                if (this.betFilters.member) params.append('username', this.betFilters.member);
                if (this.betFilters.date) params.append('date', this.betFilters.date);
                if (this.betFilters.period) params.append('period', this.betFilters.period);
                params.append('agentId', this.user.id);
                
                const url = `${API_BASE_URL}/bets?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('搜索下注記錄失敗:', response.status);
                    this.bets = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success) {
                    this.bets = data.bets || [];
                    
                    this.betPagination.totalPages = Math.ceil(data.total / this.betPagination.limit);

                    // 更新統計數據
                    this.betStats = data.stats || {
                        totalBets: 0,
                        totalAmount: 0,
                        totalProfit: 0
                    };
                } else {
                    console.error('獲取下注記錄失敗:', data.message || '未知錯誤');
                    this.bets = [];
                    this.betPagination.totalPages = 1;
                    this.betStats = { totalBets: 0, totalAmount: 0, totalProfit: 0 };
                }
            } catch (error) {
                console.error('搜索下注記錄錯誤:', error);
                this.bets = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 加載開獎歷史
        async loadDrawHistory() {
            this.loading = true;
            try {
                console.log('加載開獎歷史...');
                const url = `${API_BASE_URL}/draw-history`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('加載開獎歷史失敗:', response.status);
                    this.drawRecords = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.records) {
                    this.drawRecords = data.records || [];
                    this.drawPagination.totalPages = Math.ceil(data.total / this.drawPagination.limit);
                    this.drawPagination.currentPage = data.page || 1;
                } else {
                    console.error('開獎歷史數據格式錯誤:', data);
                    this.drawRecords = [];
                }
            } catch (error) {
                console.error('加載開獎歷史錯誤:', error);
                this.drawRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索開獎歷史
        async searchDrawHistory() {
            this.loading = true;
            try {
                console.log('搜索開獎歷史...');
                const params = new URLSearchParams();
                if (this.drawFilters.period) params.append('period', this.drawFilters.period);
                if (this.drawFilters.date) params.append('date', this.drawFilters.date);
                params.append('page', this.drawPagination.currentPage);
                params.append('limit', this.drawPagination.limit);
                
                const url = `${API_BASE_URL}/draw-history?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('搜索開獎歷史失敗:', response.status);
                    this.drawRecords = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.records) {
                    this.drawRecords = data.records || [];
                    this.drawPagination.totalPages = Math.ceil(data.total / this.drawPagination.limit);
                    this.drawPagination.currentPage = data.page || 1;
                } else {
                    console.error('開獎歷史數據格式錯誤:', data);
                    this.drawRecords = [];
                }
            } catch (error) {
                console.error('搜索開獎歷史錯誤:', error);
                this.drawRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索今日開獎記錄
        async searchTodayDrawHistory() {
            this.drawFilters.date = new Date().toISOString().split('T')[0]; // 設置為今天日期 YYYY-MM-DD
            this.drawFilters.period = '';
            await this.searchDrawHistory();
        },
        
        // 獲取分頁範圍
        getPageRange(currentPage, totalPages) {
            const range = [];
            const maxVisible = 5;
            
            if (totalPages <= maxVisible) {
                // 如果總頁數小於要顯示的頁數，顯示所有頁
                for (let i = 1; i <= totalPages; i++) {
                    range.push(i);
                }
            } else {
                // 計算顯示哪些頁面
                let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                let end = start + maxVisible - 1;
                
                if (end > totalPages) {
                    end = totalPages;
                    start = Math.max(1, end - maxVisible + 1);
                }
                
                for (let i = start; i <= end; i++) {
                    range.push(i);
                }
            }
            
            return range;
        },
        
        // 格式化投注類型
        formatBetType(type) {
            const types = {
                'champion': '冠軍',
                'second': '亞軍',
                'third': '第三名',
                'fourth': '第四名',
                'fifth': '第五名',
                'sixth': '第六名',
                'seventh': '第七名',
                'eighth': '第八名',
                'ninth': '第九名',
                'tenth': '第十名',
                'sum': '冠亞和',
                'dragon_tiger': '龍虎'
            };
            return types[type] || type;
        },
        
        // 格式化位置
        formatPosition(position) {
            if (!position) return '-';
            
            if (position === 'champion') return '冠軍';
            if (position === 'second') return '亞軍';
            if (position === 'sum') return '冠亞和';
            if (position === 'dragon_tiger') return '龍虎';
            
            return position;
        },
        
        // 獲取龍虎結果
        getDragonTigerResult(record) {
            if (!record || !record.result || record.result.length < 10) {
                return { value: '-', class: '' };
            }
            
            const first = record.result[0];
            const tenth = record.result[9];
            
            if (first > tenth) {
                return { value: '龍', class: 'text-danger' };
            } else if (first < tenth) {
                return { value: '虎', class: 'text-primary' };
            } else {
                return { value: '和', class: 'text-warning' };
            }
        },
        
        // 格式化轉移類型
        formatTransferType(transfer) {
            const types = {
                'deposit': '存入',
                'withdraw': '提領',
                'bet': '下注',
                'win': '中獎',
                'commission': '佣金'
            };
            return types[transfer.type] || transfer.type;
        },
        
        // 格式化轉移方向
        formatTransferDirection(transfer) {
            // 使用後端返回的 from_username 和 to_username
            const fromName = transfer.from_username || `(${transfer.from_id})`;
            const toName = transfer.to_username || `(${transfer.to_id})`;
            const fromTypeDisplay = transfer.from_type === 'agent' ? '代理' : '會員';
            const toTypeDisplay = transfer.to_type === 'agent' ? '代理' : '會員';

            return `${fromTypeDisplay} ${fromName} → ${toTypeDisplay} ${toName}`;
        },
        
        // 獲取級別名稱
        getLevelName(level) {
            const levels = {
                0: '總代理',
                1: '一級代理', 
                2: '二級代理',
                3: '三級代理',
                4: '四級代理',
                5: '五級代理',
                6: '六級代理',
                7: '七級代理',
                8: '八級代理',
                9: '九級代理',
                10: '十級代理',
                11: '十一級代理',
                12: '十二級代理',
                13: '十三級代理',
                14: '十四級代理',
                15: '十五級代理'
            };
            return levels[level] || `${level}級代理`;
        },
        
        // 提交餘額調整
        async submitBalanceAdjustment() {
            if (!this.balanceAdjustData.memberId || !this.balanceAdjustData.currentBalance || !this.transferAmount || !this.transferType) {
                return this.showMessage('請填寫完整餘額調整資料', 'error');
            }
            
            this.loading = true;
            
            try {
                // 準備要傳送的數據，確保包含所有後端需要的欄位
                const payload = {
                    agentId: this.balanceAdjustData.agentId,
                    username: this.balanceAdjustData.memberUsername, // 後端需要 username
                    amount: this.transferType === 'deposit' ? this.transferAmount : -this.transferAmount, // 根據類型調整金額正負
                    type: this.transferType, // 轉移類型 'deposit' 或 'withdraw'
                    description: this.balanceAdjustData.description
                };

                const response = await axios.post(`${API_BASE_URL}/update-member-balance`, payload);
                
                if (response.data.success) {
                    this.showMessage('餘額調整成功', 'success');
                    // 更新前端顯示的代理和會員餘額
                    this.user.balance = response.data.agentBalance;
                    // 需要重新獲取會員列表或更新特定會員的餘額，以反映變更
                    this.searchMembers(); // 重新載入會員列表，會包含更新後的餘額
                    this.hideAdjustBalanceModal(); // 關閉模態框
                    await this.fetchDashboardData(); // 更新儀表板數據
                } else {
                    this.showMessage(response.data.message || '餘額調整失敗', 'error');
                }
            } catch (error) {
                console.error('提交餘額調整錯誤:', error);
                this.showMessage(error.response?.data?.message || '餘額調整失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        // 新增的方法，確保在Vue實例中定義
        async createMember() {
            // 實際的創建會員邏輯需要您來實現
            console.log('createMember 方法被調用', this.newMember);
            if (!this.newMember.username || !this.newMember.password || !this.newMember.confirmPassword) {
                this.showMessage('請填寫所有必填欄位', 'error');
                return;
            }
            if (this.newMember.password !== this.newMember.confirmPassword) {
                this.showMessage('兩次輸入的密碼不一致', 'error');
                return;
            }
            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/create-member`, {
                    username: this.newMember.username,
                    password: this.newMember.password,
                    agentId: this.user.id // 使用當前登入代理的ID
                });
                if (response.data.success) {
                    this.showMessage('會員創建成功!', 'success');
                    this.hideCreateMemberModal();
                    this.searchMembers(); // 刷新會員列表
                } else {
                    this.showMessage(response.data.message || '會員創建失敗', 'error');
                }
            } catch (error) {
                console.error('創建會員出錯:', error);
                this.showMessage(error.response?.data?.message || '創建會員出錯，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        async fetchParentAgents() {
            // 實際獲取上級代理列表的邏輯需要您來實現
            console.log('fetchParentAgents 方法被調用');
             if (this.user.level === 0) { // 總代理不能有上級
                this.parentAgents = [];
                return;
            }
            this.loading = true;
            try {
                // 通常是獲取可作為當前操作代理的上級代理列表
                // 這裡假設API會返回合適的代理列表
                const response = await axios.get(`${API_BASE_URL}/available-parents`);
                if (response.data.success) {
                    this.parentAgents = response.data.agents || [];
                } else {
                    this.showMessage(response.data.message || '獲取上級代理失敗', 'error');
                    this.parentAgents = [];
                }
            } catch (error) {
                console.error('獲取上級代理列表出錯:', error);
                this.showMessage('獲取上級代理列表出錯，請稍後再試', 'error');
                this.parentAgents = [];
            } finally {
                this.loading = false;
            }
        },
        async createAgent() {
            console.log('createAgent 方法被調用', this.newAgent);
            if (!this.newAgent.username || !this.newAgent.password) {
                this.showMessage('請填寫所有必填欄位', 'error');
                return;
            }
            
            this.loading = true;
            try {
                // 由於級別和上級已在模態框開啟時確定，只需發送到後端
                const payload = {
                    username: this.newAgent.username,
                    password: this.newAgent.password,
                    level: parseInt(this.newAgent.level),
                    commission_rate: parseFloat(this.newAgent.commission),
                    parent: this.newAgent.parent
                };
                
                console.log('創建代理請求數據:', payload);
                
                const response = await axios.post(`${API_BASE_URL}/create-agent`, payload);
                if (response.data.success) {
                    this.showMessage('代理創建成功!', 'success');
                    this.hideCreateAgentModal();
                    this.searchAgents(); // 刷新代理列表
                } else {
                    this.showMessage(response.data.message || '代理創建失敗', 'error');
                }
            } catch (error) {
                console.error('創建代理出錯:', error);
                this.showMessage(error.response?.data?.message || '創建代理出錯，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        // 加載點數轉移記錄
        async loadPointTransfers() {
            this.loading = true;
            try {
                console.log('加載點數轉移記錄...');
                const url = `${API_BASE_URL}/point-transfers?agentId=${this.user.id}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('加載點數轉移記錄失敗:', response.status);
                    this.pointTransfers = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success) {
                    this.pointTransfers = data.transfers || [];
                    console.log('點數轉移記錄載入成功，共有 ' + this.pointTransfers.length + ' 筆記錄');
                } else {
                    console.error('點數轉移記錄數據格式錯誤:', data);
                    this.pointTransfers = [];
                }
            } catch (error) {
                console.error('加載點數轉移記錄錯誤:', error);
                this.pointTransfers = [];
            } finally {
                this.loading = false;
            }
        },
        // 新增：處理會員餘額調整模態框的顯示
        adjustMemberBalance(member) {
            this.balanceAdjustData.memberId = member.id;
            this.balanceAdjustData.memberUsername = member.username;
            this.balanceAdjustData.currentBalance = member.balance;
            this.balanceAdjustData.agentId = this.user.id; // 設置代理ID
            this.agentCurrentBalance = this.user.balance; // 設置代理當前餘額
            this.transferAmount = 0; // 重置轉移金額
            this.transferType = 'deposit'; // 預設為存入

            this.showAdjustBalanceModal = true;
            this.$nextTick(() => {
                const modalEl = document.getElementById('adjustBalanceModal');
                if (modalEl) {
                    this.adjustBalanceModal = new bootstrap.Modal(modalEl);
                    this.adjustBalanceModal.show();
                } else {
                    console.error('找不到餘額調整模態框元素');
                    this.showMessage('系統錯誤，請稍後再試', 'error');
                }
            });
        },

        // 新增：切換會員狀態
        async toggleMemberStatus(memberId, currentStatus) {
            const newStatus = currentStatus === 1 ? 0 : 1;
            const actionText = newStatus === 1 ? '啟用' : '停用';
            if (!confirm(`確定要${actionText}該會員嗎？`)) {
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-member-status`, { memberId, status: newStatus });
                if (response.data.success) {
                    this.showMessage(`會員已${actionText}`, 'success');
                    // 更新本地會員列表中的狀態
                    const member = this.members.find(m => m.id === memberId);
                    if (member) {
                        member.status = newStatus;
                    }
                } else {
                    this.showMessage(response.data.message || `${actionText}會員失敗`, 'error');
                }
            } catch (error) {
                console.error(`${actionText}會員出錯:`, error);
                this.showMessage(error.response?.data?.message || `${actionText}會員失敗，請稍後再試`, 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 修改會員額度
        modifyMemberBalance(member) {
            this.modifyBalanceData.memberId = member.id;
            this.modifyBalanceData.memberUsername = member.username;
            this.modifyBalanceData.currentBalance = member.balance;
            this.modifyBalanceData.reason = '';
            this.modifyBalanceType = 'absolute';
            this.modifyBalanceAmount = 0;
            this.balanceChangeDirection = 'increase';
            
            this.$nextTick(() => {
                const modalEl = document.getElementById('modifyMemberBalanceModal');
                if (modalEl) {
                    this.modifyMemberBalanceModal = new bootstrap.Modal(modalEl);
                    this.modifyMemberBalanceModal.show();
                } else {
                    console.error('找不到修改會員額度模態框元素');
                    this.showMessage('系統錯誤，請稍後再試', 'error');
                }
            });
        },
        
        // 隱藏修改會員額度模態框
        hideModifyMemberBalanceModal() {
            if (this.modifyMemberBalanceModal) {
                this.modifyMemberBalanceModal.hide();
            }
        },
        
        // 計算最終修改後的會員餘額
        calculateFinalModifiedBalance() {
            const currentBalance = parseFloat(this.modifyBalanceData.currentBalance) || 0;
            const modifyAmount = parseFloat(this.modifyBalanceAmount) || 0;
            
            if (this.modifyBalanceType === 'absolute') {
                return modifyAmount;
            } else {
                if (this.balanceChangeDirection === 'increase') {
                    return currentBalance + modifyAmount;
                } else {
                    return currentBalance - modifyAmount;
                }
            }
        },
        
        // 提交修改會員額度
        async submitModifyMemberBalance() {
            if (!this.modifyBalanceData.memberId || !this.modifyBalanceAmount || !this.modifyBalanceData.reason) {
                return this.showMessage('請填寫完整資料', 'error');
            }
            
            // 檢查修改後的金額是否合理
            const finalBalance = this.calculateFinalModifiedBalance();
            if (finalBalance < 0) {
                return this.showMessage('修改後的額度不能小於0', 'error');
            }
            
            this.loading = true;
            
            try {
                // 準備發送到後端的數據
                let requestData = {
                    memberId: this.modifyBalanceData.memberId,
                    amount: finalBalance,
                    reason: this.modifyBalanceData.reason
                };
                
                // 相對值模式下，發送相對值變化量
                if (this.modifyBalanceType === 'relative') {
                    requestData.amount = this.balanceChangeDirection === 'increase' 
                        ? this.modifyBalanceAmount 
                        : -this.modifyBalanceAmount;
                    requestData.isRelative = true;
                } else {
                    requestData.isRelative = false;
                }
                
                const response = await axios.post(`${API_BASE_URL}/modify-member-balance`, requestData);
                
                if (response.data.success) {
                    this.showMessage('會員額度修改成功', 'success');
                    this.hideModifyMemberBalanceModal();
                    this.searchMembers(); // 重新載入會員列表
                } else {
                    this.showMessage(response.data.message || '會員額度修改失敗', 'error');
                }
            } catch (error) {
                console.error('修改會員額度錯誤:', error);
                this.showMessage(error.response?.data?.message || '會員額度修改失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 刪除會員
        async deleteMember(memberId, username) {
            if (!confirm(`確定要刪除會員 ${username} 嗎？此操作不可恢復！`)) {
                return;
            }
            
            this.loading = true;
            
            try {
                const response = await axios.delete(`${API_BASE_URL}/delete-member/${memberId}`);
                
                if (response.data.success) {
                    this.showMessage('會員刪除成功', 'success');
                    this.searchMembers(); // 重新載入會員列表
                } else {
                    this.showMessage(response.data.message || '會員刪除失敗', 'error');
                }
            } catch (error) {
                console.error('刪除會員錯誤:', error);
                this.showMessage(error.response?.data?.message || '會員刪除失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 代理額度修改相關方法
        adjustAgentBalance(agent) {
            this.agentBalanceData.agentId = agent.id;
            this.agentBalanceData.agentUsername = agent.username;
            this.agentBalanceData.currentBalance = agent.balance;
            this.agentBalanceData.description = '';
            this.agentTransferType = 'deposit'; // 預設為存入
            this.agentTransferAmount = 0; // 重置轉移金額
            
            this.$nextTick(() => {
                const modalEl = document.getElementById('adjustAgentBalanceModal');
                if (modalEl) {
                    this.adjustAgentBalanceModal = new bootstrap.Modal(modalEl);
                    this.adjustAgentBalanceModal.show();
                } else {
                    console.error('找不到代理點數轉移模態框元素');
                    this.showMessage('系統錯誤，請稍後再試', 'error');
                }
            });
        },
        
        // 計算最終下級代理餘額
        calculateFinalSubAgentBalance() {
            const currentBalance = parseFloat(this.agentBalanceData.currentBalance) || 0;
            const transferAmount = parseFloat(this.agentTransferAmount) || 0;
            
            if (this.agentTransferType === 'deposit') {
                return currentBalance + transferAmount;
            } else {
                return currentBalance - transferAmount;
            }
        },
        
        // 計算最終上級代理(自己)餘額
        calculateFinalParentAgentBalance() {
            const currentBalance = parseFloat(this.user.balance) || 0;
            const transferAmount = parseFloat(this.agentTransferAmount) || 0;
            
            if (this.agentTransferType === 'deposit') {
                return currentBalance - transferAmount;
            } else {
                return currentBalance + transferAmount;
            }
        },
        
        // 切換代理狀態
        async toggleAgentStatus(agent) {
            const newStatus = agent.status === 1 ? 0 : 1;
            const actionText = newStatus === 1 ? '啟用' : '停用';
            if (!confirm(`確定要${actionText}該代理嗎？`)) {
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-agent-status`, { 
                    agentId: agent.id, 
                    status: newStatus 
                });
                
                if (response.data.success) {
                    this.showMessage(`代理已${actionText}`, 'success');
                    // 更新本地代理列表中的狀態
                    const agentInList = this.agents.find(a => a.id === agent.id);
                    if (agentInList) {
                        agentInList.status = newStatus;
                    }
                } else {
                    this.showMessage(response.data.message || `${actionText}代理失敗`, 'error');
                }
            } catch (error) {
                console.error(`${actionText}代理出錯:`, error);
                this.showMessage(error.response?.data?.message || `${actionText}代理失敗，請稍後再試`, 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 隱藏代理額度修改模態框
        hideAdjustAgentBalanceModal() {
            if (this.adjustAgentBalanceModal) {
                this.adjustAgentBalanceModal.hide();
            }
        },
        
        // 計算最終代理餘額
        calculateFinalAgentBalance() {
            const currentBalance = parseFloat(this.agentBalanceData.currentBalance) || 0;
            const modifyAmount = parseFloat(this.agentModifyAmount) || 0;
            
            if (this.agentModifyType === 'absolute') {
                return modifyAmount;
            } else {
                if (this.agentChangeDirection === 'increase') {
                    return currentBalance + modifyAmount;
                } else {
                    return currentBalance - modifyAmount;
                }
            }
        },
        
        // 提交代理額度修改
        async submitAgentBalanceAdjustment() {
            if (!this.agentBalanceData.agentId || !this.agentTransferAmount || !this.agentBalanceData.description) {
                return this.showMessage('請填寫完整資料', 'error');
            }
            
            this.loading = true;
            
            try {
                // 準備要傳送的數據
                const payload = {
                    agentId: this.user.id,  // 當前代理ID（來源或目標）
                    subAgentId: this.agentBalanceData.agentId,  // 下級代理ID
                    amount: this.agentTransferType === 'deposit' ? this.agentTransferAmount : -this.agentTransferAmount, // 根據類型調整金額正負
                    type: this.agentTransferType, // 轉移類型 'deposit' 或 'withdraw'
                    description: this.agentBalanceData.description
                };

                const response = await axios.post(`${API_BASE_URL}/transfer-agent-balance`, payload);
                
                if (response.data.success) {
                    this.showMessage('代理點數轉移成功', 'success');
                    // 更新前端顯示的代理餘額
                    this.user.balance = response.data.parentBalance;
                    // 需要重新獲取代理列表或更新特定代理的餘額
                    this.searchAgents(); // 重新載入代理列表
                    this.hideAdjustAgentBalanceModal(); // 關閉模態框
                    await this.fetchDashboardData(); // 更新儀表板數據
                } else {
                    this.showMessage(response.data.message || '代理點數轉移失敗', 'error');
                }
            } catch (error) {
                console.error('提交代理點數轉移錯誤:', error);
                this.showMessage(error.response?.data?.message || '代理點數轉移失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 刪除代理
        async deleteAgent(agentId, username) {
            if (!confirm(`確定要刪除代理 ${username} 嗎？此操作將刪除該代理及其所有下級代理和會員，不可恢復！`)) {
                return;
            }
            
            this.loading = true;
            
            try {
                const response = await axios.delete(`${API_BASE_URL}/delete-agent/${agentId}`);
                
                if (response.data.success) {
                    this.showMessage('代理刪除成功', 'success');
                    this.searchAgents(); // 重新載入代理列表
                } else {
                    this.showMessage(response.data.message || '代理刪除失敗', 'error');
                }
            } catch (error) {
                console.error('刪除代理錯誤:', error);
                this.showMessage(error.response?.data?.message || '代理刪除失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        }
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
        },
        
        // 檢查代理點數轉移是否有效
        isValidAgentTransfer() {
            const amount = parseFloat(this.agentTransferAmount) || 0;
            if (amount <= 0) {
                return false;
            }
            
            if (this.agentTransferType === 'deposit') {
                // 存入時，檢查上級代理(自己)餘額是否足夠
                return parseFloat(this.user.balance) >= amount;
            } else if (this.agentTransferType === 'withdraw') {
                // 提領時，檢查下級代理餘額是否足夠
                return parseFloat(this.agentBalanceData.currentBalance) >= amount;
            }
            
            return false;
        },
        
        // 檢查會員餘額修改是否有效
        isValidBalanceModification() {
            const amount = parseFloat(this.modifyBalanceAmount) || 0;
            if (amount <= 0) return false;
            
            if (this.modifyBalanceType === 'absolute') {
                return true; // 絕對值模式下，只要金額大於0即可
            } else {
                // 相對值模式下，如果是減少，則不能超過當前餘額
                if (this.balanceChangeDirection === 'decrease') {
                    const currentBalance = parseFloat(this.modifyBalanceData.currentBalance) || 0;
                    return amount <= currentBalance;
                }
                return true;
            }
        },
        
        // 檢查代理餘額修改是否有效
        isValidAgentBalanceModification() {
            const amount = parseFloat(this.agentModifyAmount) || 0;
            if (amount <= 0) return false;
            
            if (this.agentModifyType === 'absolute') {
                return true; // 絕對值模式下，只要金額大於0即可
            } else {
                // 相對值模式下，如果是減少，則不能超過當前餘額
                if (this.agentChangeDirection === 'decrease') {
                    const currentBalance = parseFloat(this.agentBalanceData.currentBalance) || 0;
                    return amount <= currentBalance;
                }
                return true;
            }
        }
    },
    
    // 監聽屬性
    watch: {
        // 當活動分頁變更時，加載對應數據
        activeTab(newTab, oldTab) {
            if (newTab === 'dashboard' && oldTab !== 'dashboard') {
                this.fetchDashboardData();
            }
            if (newTab === 'members') {
                this.searchMembers();
            }
            if (newTab === 'agents') {
                this.searchAgents();
            }
            if (newTab === 'draw') {
                this.loadDrawHistory();
            }
            if (newTab === 'stats') {
                this.searchBets();
            }
            if (newTab === 'transactions' && this.transactionTab === 'transfers') {
                this.loadPointTransfers();
            }
        },
        transactionTab(newTab, oldTab) {
            if (this.activeTab === 'transactions' && newTab === 'transfers') {
                this.loadPointTransfers();
            }
        }
    }
});