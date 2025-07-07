// filepath: /Users/justin/Desktop/Bet/agent/frontend/js/main.js
// 代理管理系统前端 JavaScript 档案
// 最后更新：2025-05-10

// API 基礎 URL - 根據環境调整
let API_BASE_URL;

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // 本地開發環境 - 代理系统运行在3003端口
    API_BASE_URL = 'http://localhost:3003/api/agent';
} else {
    // Render 生產環境 - 不使用端口号，讓Render处理路由
    API_BASE_URL = 'https://bet-agent.onrender.com/api/agent';
}

// 添加調試信息
console.log('当前API基礎URL:', API_BASE_URL, '主機名:', window.location.hostname);

// API请求通用配置
const API_CONFIG = {
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

console.log('开始初始化Vue应用');
console.log('Vue是否可用:', typeof Vue);

if (typeof Vue === 'undefined') {
    console.error('Vue未定義！请检查Vue腳本是否正确加載。');
    alert('Vue未定義！请检查Vue腳本是否正确加載。');
    throw new Error('Vue未定義');
}

const { createApp } = Vue;
console.log('createApp是否可用:', typeof createApp);

const app = createApp({
    data() {
        return {
            // 將API_BASE_URL添加到Vue實例的data中，使模板可以訪問
            API_BASE_URL: API_BASE_URL,
            
            // 身份驗證狀態
            isLoggedIn: false,
            loading: false,
            
            // 登录表單
            loginForm: {
                username: '',
                password: '',
                captcha: ''
            },
            
            // 驗證碼
            currentCaptcha: '',
            
            // 用戶资讯
            user: {
                id: null,
                username: '',
                level: 0,
                balance: 0
            },
            
            // 系统公告
            notices: [],
            noticeCategories: [],
            selectedNoticeCategory: 'all',
            
            // 公告表單相关
            showNoticeForm: false,
            editingNoticeId: null,
            noticeForm: {
                title: '',
                content: '',
                category: '最新公告'
            },
            
            // 当前活動分頁
            activeTab: 'dashboard',
            transactionTab: 'transfers',
            customerServiceTab: 'transactions', // 客服功能標籤頁：'transactions' 或 'win-loss-control'
            
            // 儀表板數據
            dashboardData: {
                totalDeposit: 0,
                totalWithdraw: 0,
                totalRevenue: 0,
                totalTransactions: 0,
                memberCount: 0,
                activeMembers: 0,
                subAgentsCount: 0
            },
            
            // 圖表實例
            transactionChart: null,
            
            // 代理管理相关
            agents: [],
            agentFilters: {
                level: '-1',
                status: '-1', // 顯示所有狀態（物理删除後不會有已删除項目）
                keyword: ''
            },
            agentPagination: {
                currentPage: 1,
                totalPages: 1,
                limit: 20
            },
            
            // 新增代理相关
            showCreateAgentModal: false,
            newAgent: {
                username: '',
                password: '',
                level: '1',
                parent: '',
                market_type: 'D', // 默認D盤
                rebate_mode: 'percentage',
                rebate_percentage: 2.0, // 將在showAgentModal中根據盤口動態設定
                notes: ''
            },
            parentAgents: [],
            
            // 代理层级導航相关
            agentBreadcrumbs: [],
            currentManagingAgent: {
                id: null,
                username: '',
                level: 0,
                max_rebate_percentage: 0.041
            },
            
            // 退水设定相关
            showRebateModal: false,
            rebateAgent: {
                id: null,
                username: '',
                rebate_mode: '',
                rebate_percentage: 0,
                max_rebate_percentage: 0
            },
            rebateSettings: {
                rebate_mode: '',
                rebate_percentage: 0
            },
            
            // 编辑代理相关
            showEditAgentModal: false,
            editAgentData: {
                id: '',
                username: '',
                password: '',
                status: 1
            },
            editAgentModal: null,
            editAgentNotesModal: null,
            
            // 編輯備註相关
            showEditAgentNotesModal: false,
            showEditMemberNotesModal: false,
            
            // 顯示限紅調整模態框
            showBettingLimitModal: false,
            editNotesData: {
                id: null,
                username: '',
                notes: '',
                type: '' // 'agent' 或 'member'
            },
            
            // 会员管理相关
            members: [],
            memberFilters: {
                status: '-1', // 顯示所有狀態（物理删除後不會有已删除項目）
                keyword: ''
            },
            memberPagination: {
                currentPage: 1,
                totalPages: 1,
                limit: 20
            },
            memberViewMode: 'direct', // 'direct' 或 'downline'
            
            // 層級會員管理相關
            hierarchicalMembers: [], // 統一的代理+會員列表
            memberBreadcrumb: [], // 會員管理導航麵包屑
            memberHierarchyStats: {
                agentCount: 0,
                memberCount: 0
            },
            currentMemberManagingAgent: {
                id: null,
                username: '',
                level: 0
            },
            
            // 新增会员相关
            showCreateMemberModal: false,
            modalSystemReady: false, // 模態框系统是否准备就緒
            newMember: {
                username: '',
                password: '',
                confirmPassword: '',
                balance: 0,
                status: 1,
                notes: '',
                market_type: 'D' // 默認繼承代理盤口
            },
            

            
            // 会员余额调整相关
            showAdjustBalanceModal: false,
            balanceAdjustData: {
                memberId: null,
                memberUsername: '',
                agentId: null,
                currentBalance: 0,
                amount: 0,
                description: ''
            },

            // 報表查詢相关
            reportFilters: {
                startDate: new Date().toISOString().split('T')[0], // 今日
                endDate: new Date().toISOString().split('T')[0],   // 今日
                gameTypes: {
                    pk10: true  // 只支援極速賽車
                },
                settlementStatus: '', // 'settled', 'unsettled', ''(全部)
                username: ''
            },
            reportData: {
                success: true,
                reportData: [],
                totalSummary: {
                    betCount: 0,
                    betAmount: 0.0,
                    validAmount: 0.0,
                    memberWinLoss: 0.0,
                    ninthAgentWinLoss: 0.0,
                    upperDelivery: 0.0,
                    upperSettlement: 0.0,
                    rebate: 0.0,
                    profitLoss: 0.0,
                    downlineReceivable: 0.0,
                    commission: 0.0,
                    commissionAmount: 0.0,
                    commissionResult: 0.0,
                    actualRebate: 0.0,
                    rebateProfit: 0.0,
                    finalProfitLoss: 0.0
                },
                hasData: false,
                message: ''
            },
            
            // 報表層級追蹤
            reportBreadcrumb: [],

            // 登錄日誌相关
            loginLogs: [],
            loginLogFilters: {
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7天前
                endDate: new Date().toISOString().split('T')[0] // 今日
            },
            loginLogPagination: {
                currentPage: 1,
                totalPages: 1,
                limit: 20
            },
            transferType: 'deposit',
            transferAmount: 0,
            agentCurrentBalance: 0,
            adjustBalanceModal: null,
            
            // 点数转移记录
            pointTransfers: [],
            
            // 退水记录相关
            rebateRecords: [],
            rebateFilters: {
                member: '',
                date: ''
            },
            totalRebateAmount: 0,
            
            // 开奖记录相关
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
            
            // 添加下注记录相关
            bets: [],
            betFilters: {
                member: '',
                date: '',
                startDate: new Date().toISOString().split('T')[0], // 預設今天
                endDate: new Date().toISOString().split('T')[0],   // 預設今天
                period: '',
                viewScope: 'own', // 'own', 'downline', 'specific'
                specificAgent: ''
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
            
            // 代理線管理相关
            allDownlineAgents: [], // 所有下級代理
            availableMembers: [], // 当前可用的会员列表
            lastMembersLoadTime: null, // 會員列表載入時間（緩存用）
            
            // 会员余额修改相关
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
            
            // 代理余额修改相关
            agentBalanceData: {
                agentId: null,
                agentUsername: '',
                currentBalance: 0,
                reason: '',
                description: '' // 新增: 点数转移備註
            },
            agentModifyType: 'absolute', // 'absolute' 或 'relative'
            agentModifyAmount: 0,
            agentChangeDirection: 'increase', // 'increase' 或 'decrease'
            adjustAgentBalanceModal: null,
            
            // 新增: 代理点数转移相关變量
            agentTransferType: 'deposit', // 'deposit' 或 'withdraw'
            agentTransferAmount: 0,

            // 客服專用數據
            isCustomerService: false, // 是否為客服 - 根據用戶權限動態設定
            showCSOperationModal: false, // 客服操作模態框
            csOperation: {
                targetAgentId: '',
                operationTarget: '', // 'agent' 或 'member'
                targetMemberId: '',
                transferType: '', // 'deposit' 或 'withdraw'
                amount: '',
                description: ''
            },
            csTransactions: [], // 客服交易记录
            csTransactionFilters: {
                userType: 'all',
                transactionType: 'all'
            },
            csTransactionsPagination: {
                page: 1,
                limit: 20,
                total: 0
            },
            allAgents: [], // 所有代理列表（供客服选择）
            
            // 輸贏控制相關
            winLossControls: [],
            activeWinLossControl: {
                control_mode: 'normal',
                is_active: false
            },
            newWinLossControl: {
                control_mode: 'normal',
                target_type: '',
                target_username: '',
                control_percentage: 50,
                win_control: false,
                loss_control: false,
                start_period: null
            },
            agentMembers: [], // 選中代理的会员列表
            csOperationModal: null, // 客服操作模態框
            
            // 存款记录
            depositRecords: [],
            depositPagination: {
                page: 1,
                limit: 20,
                total: 0
            },
            
            // 提款记录
            withdrawRecords: [],
            withdrawPagination: {
                page: 1,
                limit: 20,
                total: 0
            },
            
            // 重设密碼數據
            resetPasswordData: {
                userType: '', // 'agent' 或 'member'
                userId: null,
                username: '',
                newPassword: '',
                confirmPassword: ''
            },
            
            // 調整限紅數據
            bettingLimitData: {
                loading: false,
                submitting: false,
                member: {
                    id: null,
                    username: '',
                    bettingLimitLevel: '',
                    levelDisplayName: '',
                    description: ''
                },
                configs: [],
                newLimitLevel: '',
                reason: ''
            },
            
            // 个人资料數據
            profileData: {
                realName: '',
                phone: '',
                email: '',
                lineId: '',
                telegram: '',
                address: '',
                remark: ''
            },
            
            // 顯示用的用戶信息
            displayUsername: '载入中...',
            displayUserLevel: '载入中...',
            // 个人资料储存專用载入狀態
            profileLoading: false,
            // 控制个人资料 modal 顯示
            isProfileModalVisible: false,

            // 會員餘額調整相關
            memberBalanceData: {
                memberId: null,
                memberUsername: '',
                currentBalance: 0,
                description: ''
            },
            memberTransferType: 'deposit',
            memberTransferAmount: 0,
            adjustMemberBalanceModal: null,
            
            // 輸贏控制用戶清單
            availableAgents: [],
            availableMembers: [],
            currentPeriodInfo: {
                current_period: 0,
                next_period: 0,
                suggested_start: 0
            },
            
            // 會員注單詳情相關
            memberBetDetails: {
                memberUsername: '',
                memberId: null,
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
                bets: [],
                currentPage: 1,
                totalPages: 1,
                totalBets: 0,
                loading: false
            },
            
            // 佔成明細
            commissionDetails: [],
            
            // 開獎結果
            drawResult: {
                period: '',
                numbers: []
            },
        };
    },
    
    // 頁面载入時自動执行
    async mounted() {
        console.log('Vue应用已掛載');
        
        // 強制确保所有模態框初始狀態為关闭，防止登录前意外顯示
        this.showCreateMemberModal = false;
        this.showCreateAgentModal = false;
        this.isProfileModalVisible = false;
        this.showCSOperationModal = false;
        this.showAdjustBalanceModal = false;
        console.log('🔒 所有模態框狀態已重置為关闭');
        
        // 添加全域保護機制：監聽所有模態框狀態變化
        this.$watch('showCreateMemberModal', (newVal) => {
            if (newVal && (!this.isLoggedIn || !this.user || !this.user.id)) {
                console.warn('🚫 阻止未登录狀態顯示新增会员模態框');
                this.$nextTick(() => {
                    this.showCreateMemberModal = false;
                });
            }
        });
        
        this.$watch('isProfileModalVisible', (newVal) => {
            if (newVal && (!this.isLoggedIn || !this.user || !this.user.id)) {
                console.warn('🚫 阻止未登录狀態顯示个人资料模態框');
                this.$nextTick(() => {
                    this.isProfileModalVisible = false;
                });
            }
        });
        
        console.log('初始數據检查:', {
            noticeForm: this.noticeForm,
            showNoticeForm: this.showNoticeForm,
            isCustomerService: this.isCustomerService
        });
        
        // 测试模板插值功能
        this.$nextTick(() => {
            console.log('nextTick 检查模板數據:', {
                'noticeForm.title': this.noticeForm.title,
                'noticeForm.title.length': this.noticeForm.title.length,
                'noticeForm.content.length': this.noticeForm.content.length
            });
        });
        
        // 生成初始驗證碼
        this.refreshCaptcha();
        
        // 先檢查會話有效性，如果會話無效則清除本地存儲
        const sessionValid = await this.checkSession();
        
        if (!sessionValid) {
            // 會話無效，清除本地存儲
            localStorage.removeItem('agent_token');
            localStorage.removeItem('agent_user');
            localStorage.removeItem('agent_session_token');
            console.log('會話無效，已清除本地存儲');
        }
        
        // 检查是否已登录
        const isAuthenticated = await this.checkAuth();
        
        if (isAuthenticated && sessionValid) {
            console.log('用戶已認證，开始加載初始數據');
            // 检查是否為客服
            this.isCustomerService = this.user.level === 0;
            console.log('是否為客服:', this.isCustomerService);
            
            // 如果是客服，加載所有代理列表
            if (this.isCustomerService) {
                await this.loadAllAgents();
            }
            
            // 获取初始數據
            await Promise.all([
                this.fetchDashboardData(),
                this.fetchNotices()
            ]);
            
            // 获取代理現有的点数余额
            console.log('嘗試获取代理余额，代理ID:', this.user.id);
            try {
                // 修改API路徑格式，使其與後端一致
                const response = await axios.get(`${API_BASE_URL}/agent-balance?agentId=${this.user.id}`);
                if (response.data.success) {
                    console.log('代理当前额度:', response.data.balance);
                    this.user.balance = response.data.balance;
                }
            } catch (error) {
                console.error('获取代理额度错误:', error);
                // 遇到错误時嘗試備用API格式
                try {
                    console.log('嘗試備用API路徑获取代理余额');
                    const fallbackResponse = await axios.get(`${API_BASE_URL}/agent/${this.user.id}`);
                    if (fallbackResponse.data.success) {
                        console.log('備用API路徑获取代理额度成功:', fallbackResponse.data.agent?.balance);
                        this.user.balance = fallbackResponse.data.agent?.balance || 0;
                    }
                } catch (fallbackError) {
                    console.error('備用API路徑获取代理额度也失败:', fallbackError);
                }
            }
        } else {
            console.log('用戶未認證，顯示登录表單');
        }
        
        // 初始化模態框
        this.$nextTick(() => {
            this.initModals();
            
            // 延遲启用模態框系统，确保所有組件都已初始化
            setTimeout(() => {
                this.modalSystemReady = true;
                console.log('🔓 模態框系统已启用');
                
                // 隱藏加載遮罩層
                const loadingOverlay = document.getElementById('loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.style.opacity = '0';
                    setTimeout(() => {
                        loadingOverlay.style.display = 'none';
                    }, 300); // 0.3秒淡出動畫
                }
            }, 1000); // 延遲1秒确保一切就緒
        });
    },
    
    methods: {
        // 初始化 Bootstrap 5 模態框
        initModals() {
            console.log('初始化所有模態框');
            
            // 初始化创建代理模態框
            const createAgentModalEl = document.getElementById('createAgentModal');
            if (createAgentModalEl) {
                console.log('初始化创建代理模態框');
                this.agentModal = new bootstrap.Modal(createAgentModalEl);
            }
            
            // 初始化创建会员模態框
            const createMemberModalEl = document.getElementById('createMemberModal');
            if (createMemberModalEl) {
                console.log('初始化创建会员模態框');
                this.memberModal = new bootstrap.Modal(createMemberModalEl);
            }
            
            // 初始化会员余额调整模態框
            const adjustBalanceModalEl = document.getElementById('adjustBalanceModal');
            if (adjustBalanceModalEl) {
                console.log('初始化会员余额调整模態框');
                this.adjustBalanceModal = new bootstrap.Modal(adjustBalanceModalEl);
            }
            
            // 初始化代理余额调整模態框
            const adjustAgentBalanceModalEl = document.getElementById('adjustAgentBalanceModal');
            if (adjustAgentBalanceModalEl) {
                console.log('初始化代理余额调整模態框');
                this.adjustAgentBalanceModal = new bootstrap.Modal(adjustAgentBalanceModalEl);
            }
            
            // 初始化修改会员余额模態框
            const modifyMemberBalanceModalEl = document.getElementById('modifyMemberBalanceModal');
            if (modifyMemberBalanceModalEl) {
                console.log('初始化修改会员余额模態框');
                this.modifyMemberBalanceModal = new bootstrap.Modal(modifyMemberBalanceModalEl);
            }
            
            // 初始化會員點數轉移模態框
            const adjustMemberBalanceModalEl = document.getElementById('adjustMemberBalanceModal');
            if (adjustMemberBalanceModalEl) {
                console.log('初始化會員點數轉移模態框');
                this.adjustMemberBalanceModal = new bootstrap.Modal(adjustMemberBalanceModalEl);
            }
            
            // 初始化客服操作模態框
            const csOperationModalEl = document.getElementById('csOperationModal');
            if (csOperationModalEl) {
                console.log('初始化客服操作模態框');
                this.csOperationModal = new bootstrap.Modal(csOperationModalEl);
                
                // 監聽模態框隱藏事件，重置表單
                csOperationModalEl.addEventListener('hidden.bs.modal', () => {
                    this.hideCSOperationModal();
                });
            }
            
            // 初始化代理備註編輯模態框
            const editAgentNotesModalEl = document.getElementById('editAgentNotesModal');
            if (editAgentNotesModalEl) {
                console.log('初始化代理備註編輯模態框');
                this.editAgentNotesModal = new bootstrap.Modal(editAgentNotesModalEl);
            }
        },
        
        // 顯示创建代理模態框
        showAgentModal() {
            this.showCreateAgentModal = true;
            
            // 確定使用的管理代理 - 優先使用當前層級管理代理
            let managingAgent;
            if (this.activeTab === 'accounts' && this.currentMemberManagingAgent && this.currentMemberManagingAgent.id) {
                managingAgent = this.currentMemberManagingAgent;
            } else {
                managingAgent = this.currentManagingAgent;
            }
            
            // 確保管理代理有完整信息
            if (!managingAgent || !managingAgent.id) {
                managingAgent = this.currentManagingAgent;
            }
            
            // 確定盤口類型和選擇權限
            let marketType = 'D'; // 默認D盤
            let canChooseMarket = false;
            
            if (this.user.level === 0 && managingAgent.id === this.user.id) {
                // 總代理為自己創建一級代理，可自由選擇
                canChooseMarket = true;
                marketType = 'D'; // 預設D盤
            } else {
                // 其他情況：固定繼承當前管理代理的盤口類型
                canChooseMarket = false;
                marketType = managingAgent.market_type || this.user.market_type || 'D';
            }
            
            // 根據盤口類型設定合適的默認退水比例
            const defaultRebatePercentage = marketType === 'A' ? 0.5 : 2.0; // A盤用0.5%，D盤用2.0%
            
            this.newAgent = {
                username: '',
                password: '',
                level: (managingAgent.level + 1).toString(),
                parent: managingAgent.id,
                market_type: marketType,  // 設置盤口繼承
                rebate_mode: 'percentage',
                rebate_percentage: defaultRebatePercentage,
                notes: ''
            };
            
            console.log('🔧 創建代理模態框設定:', {
                activeTab: this.activeTab,
                currentUserLevel: this.user.level,
                managingAgentLevel: managingAgent.level,
                managingAgentMarketType: managingAgent.market_type,
                isCreatingForSelf: managingAgent.id === this.user.id,
                marketType: marketType,
                canChooseMarket: canChooseMarket
            });
            
            this.$nextTick(() => {
                // 确保模態框元素已经被渲染到DOM後再初始化和顯示
                const modalEl = document.getElementById('createAgentModal');
                if (modalEl) {
                    this.agentModal = new bootstrap.Modal(modalEl);
                    this.agentModal.show();
                } else {
                    console.error('找不到代理模態框元素');
                    this.showMessage('系统错误，请稍後再試', 'error');
                }
            });
        },
        
        // 隱藏创建代理模態框
        hideCreateAgentModal() {
            if (this.agentModal) {
                this.agentModal.hide();
            }
            this.showCreateAgentModal = false;
        },
        
        // 顯示新增会员模態框 - 重定向到统一函數
        showMemberModal() {
            console.log('showMemberModal 已棄用，重定向到 quickCreateMember');
            this.quickCreateMember();
        },
        
        // 快速新增会员 - 專為会员管理頁面和下級代理管理設計
        quickCreateMember() {
            // 安全检查：确保已登录且有用戶资讯
            if (!this.isLoggedIn || !this.user || !this.user.id) {
                console.warn('⚠️ 未登录或用戶资讯不完整，無法新增会员');
                return;
            }
            
            console.log('🚀 快速新增会员啟動');
            console.log('当前狀態:');
            console.log('- activeTab:', this.activeTab);
            console.log('- currentMemberManagingAgent:', this.currentMemberManagingAgent);
            console.log('- currentManagingAgent:', this.currentManagingAgent);
            console.log('- user:', this.user);
            
            // 重置表單
            this.newMember = { 
                username: '', 
                password: '', 
                confirmPassword: '',
                balance: 0,
                status: 1,
                notes: ''
            };
            
            // 確定目標代理 - 優先使用當前層級管理代理
            let targetAgent = null;
            
            if (this.activeTab === 'accounts' && this.currentMemberManagingAgent && this.currentMemberManagingAgent.id) {
                // 在帳號管理頁面，使用當前層級管理代理
                targetAgent = this.currentMemberManagingAgent;
                console.log('📋 帳號管理模式：為當前層級代理', targetAgent.username, '新增會員');
            } else if (this.currentManagingAgent && this.currentManagingAgent.id) {
                // 使用當前管理代理
                targetAgent = this.currentManagingAgent;
                console.log('📋 管理代理模式：為', targetAgent.username, '新增會員');
            } else {
                // 預設情況：為自己新增会员
                const defaultMaxRebate = this.user.market_type === 'A' ? 0.011 : 0.041;
                targetAgent = {
                    id: this.user.id,
                    username: this.user.username,
                    level: this.user.level,
                    max_rebate_percentage: this.user.max_rebate_percentage || defaultMaxRebate
                };
                console.log('🔄 預設模式：為自己新增会员');
            }
            
            if (!targetAgent || !targetAgent.id) {
                console.error('❌ 無法确定目標代理');
                this.showMessage('無法确定代理信息，请重新整理頁面', 'error');
                return;
            }
            
            // 设置当前管理代理
            this.currentManagingAgent = targetAgent;
            console.log('✅ 设置目標代理:', this.currentManagingAgent);
            
            // 簡化模態框顯示邏輯，只设置Vue狀態
            this.showCreateMemberModal = true;
            console.log('✅ 新增会员模態框已设置為顯示');
        },
        
        // 隱藏创建会员模態框 - 簡化版本
        hideCreateMemberModal() {
            console.log('🚫 关闭新增会员模態框');
            
            // 设置Vue響應式狀態
            this.showCreateMemberModal = false;
            
            // 重置表單數據
            this.newMember = { 
                username: '', 
                password: '', 
                confirmPassword: '',
                balance: 0,
                status: 1,
                notes: ''
            };
            
            console.log('✅ 模態框已关闭，數據已重置');
        },
        
        // 生成驗證碼
        generateCaptcha() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 4; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        },
        
        // 刷新驗證碼
        refreshCaptcha() {
            this.currentCaptcha = this.generateCaptcha();
            this.loginForm.captcha = '';
        },
        
        // 设置活動標籤並关闭漢堡選單
        setActiveTab(tab) {
            console.log('🔄 切換頁籤到:', tab);
            
            // 如果不是在帳號管理頁面，重置当前管理代理為自己
            if (tab !== 'accounts') {
                if (this.currentManagingAgent.id !== this.user.id) {
                    console.log('📍 重置管理視角：從', this.currentManagingAgent.username, '回到', this.user.username);
                    const defaultMaxRebate = this.user.market_type === 'A' ? 0.011 : 0.041;
                    this.currentManagingAgent = {
                        id: this.user.id,
                        username: this.user.username,
                        level: this.user.level,
                        market_type: this.user.market_type,
                        rebate_percentage: this.user.rebate_percentage || this.user.max_rebate_percentage || defaultMaxRebate,
                        max_rebate_percentage: this.user.max_rebate_percentage || defaultMaxRebate
                    };
                    
                    // 清空代理導航面包屑
                    this.agentBreadcrumbs = [];
                    
                    // 如果切換到帳號管理，重新載入相關數據
                    if (tab === 'accounts') {
                        // 初始化層級會員管理
                        this.currentMemberManagingAgent = {
                            id: this.currentManagingAgent.id,
                            username: this.currentManagingAgent.username,
                            level: this.currentManagingAgent.level
                        };
                        this.memberBreadcrumb = [];
                        this.loadHierarchicalMembers();
                    } else if (tab === 'bets') {
                        this.searchBets();
                    }
                }
            } else {
                // 切換到帳號管理時，初始化層級管理
                this.currentMemberManagingAgent = {
                    id: this.user.id,
                    username: this.user.username,
                    level: this.user.level
                };
                this.memberBreadcrumb = [];
                this.loadHierarchicalMembers();
            }
            
            this.activeTab = tab;
            
            // 关闭漢堡選單
            const navbarToggler = document.querySelector('.navbar-toggler');
            const navbarCollapse = document.querySelector('.navbar-collapse');
            if (navbarToggler && navbarCollapse && navbarCollapse.classList.contains('show')) {
                const bootstrapCollapse = new bootstrap.Collapse(navbarCollapse, {
                    toggle: false
                });
                bootstrapCollapse.hide();
            }
        },
        
        // 检查會話狀態
        async checkSession() {
            try {
                const sessionToken = localStorage.getItem('agent_session_token');
                const legacyToken = localStorage.getItem('agent_token');
                
                if (!sessionToken && !legacyToken) {
                    console.log('沒有會話憑證');
                    return false;
                }
                
                const headers = {};
                if (sessionToken) {
                    headers['X-Session-Token'] = sessionToken;
                }
                if (legacyToken) {
                    headers['Authorization'] = legacyToken;
                }
                
                const response = await axios.get(`${API_BASE_URL}/check-session`, { headers });
                
                if (response.data.success && response.data.isAuthenticated) {
                    return true;
                } else if (response.data.reason === 'session_invalid') {
                    console.warn('⚠️ 检测到代理會話已失效，可能在其他裝置登录');
                    if (confirm('您的账号已在其他裝置登录，请重新登录。')) {
                        this.logout();
                        return false;
                    }
                }
                
                return false;
            } catch (error) {
                console.error('會話检查失败:', error);
                return false;
            }
        },
        
        // 检查身份驗證狀態
        async checkAuth() {
            const token = localStorage.getItem('agent_token');
            const userStr = localStorage.getItem('agent_user');
            console.log('检查認證，localStorage中的user字符串:', userStr);
            
            if (!userStr || !token) {
                console.log('認證失败，缺少token或user數據');
                return false;
            }
            
            try {
                const user = JSON.parse(userStr);
                console.log('解析後的user對象:', user);
                
                if (user && user.id) {
                    this.isLoggedIn = true;
                    this.user = user;
                    console.log('设置user對象成功:', this.user);
                    
                    // 初始化当前管理代理為自己
                    this.currentManagingAgent = {
                        id: this.user.id,
                        username: this.user.username,
                        level: this.user.level,
                        market_type: this.user.market_type,
                        rebate_percentage: this.user.rebate_percentage || this.user.max_rebate_percentage || (this.user.market_type === 'A' ? 0.011 : 0.041),
                        max_rebate_percentage: this.user.max_rebate_percentage || (this.user.market_type === 'A' ? 0.011 : 0.041)
                    };
                    
                    // 检查是否為客服（總代理）
                    this.isCustomerService = this.user.level === 0;
                    console.log('checkAuth設定客服權限:', this.isCustomerService, '用戶级别:', this.user.level);
                    
                    // 设置 axios 身份驗證頭
                    axios.defaults.headers.common['Authorization'] = token;
                    
                    // 設置session token header（優先使用）
                    const sessionToken = localStorage.getItem('agent_session_token');
                    if (sessionToken) {
                        axios.defaults.headers.common['x-session-token'] = sessionToken;
                    }
                    
                    // 強制Vue更新
                    this.$forceUpdate();
                    return true;
                }
            } catch (error) {
                console.error('解析用戶數據失败:', error);
                // 清除損壞的數據
                localStorage.removeItem('agent_token');
                localStorage.removeItem('agent_user');
            }
            
            console.log('認證失败');
            return false;
        },
        
        // 登录方法
        async login() {
            if (!this.loginForm.username || !this.loginForm.password || !this.loginForm.captcha) {
                return this.showMessage('请填寫完整的登录资讯', 'error');
            }
            
            // 驗證驗證碼
            if (this.loginForm.captcha.toUpperCase() !== this.currentCaptcha) {
                this.showMessage('驗證碼输入错误，请重新输入', 'error');
                this.refreshCaptcha();
                return;
            }
            
            this.loading = true;
            
            try {
                const response = await axios.post(`${API_BASE_URL}/login`, this.loginForm);
                
                if (response.data.success) {
                    // 保存用戶资讯和 token
                    const { agent, token, sessionToken } = response.data;
                    localStorage.setItem('agent_token', token);
                    localStorage.setItem('agent_user', JSON.stringify(agent));
                    
                    // 保存新的會話token
                    if (sessionToken) {
                        localStorage.setItem('agent_session_token', sessionToken);
                        console.log('✅ 代理會話token已保存');
                    }
                    
                    // 设置 axios 身份驗證頭
                    axios.defaults.headers.common['Authorization'] = token;
                    
                    // 設置session token header（優先使用）
                    if (sessionToken) {
                        axios.defaults.headers.common['x-session-token'] = sessionToken;
                    }
                    
                    // 更新用戶资讯
                    this.user = agent;
                    this.isLoggedIn = true;
                    
                    // 設置當前管理代理為自己 - 修復儀表板數據獲取問題
                    this.currentManagingAgent = {
                        id: agent.id,
                        username: agent.username,
                        level: agent.level,
                        market_type: agent.market_type,
                        rebate_percentage: agent.rebate_percentage || agent.max_rebate_percentage || (agent.market_type === 'A' ? 0.011 : 0.041),
                        max_rebate_percentage: agent.max_rebate_percentage || (agent.market_type === 'A' ? 0.011 : 0.041)
                    };
                    
                    console.log('✅ 登錄成功，設置當前管理代理:', this.currentManagingAgent);
                    
                    // 检查是否為客服
                    this.isCustomerService = this.user.level === 0;
                    console.log('登录後是否為客服:', this.isCustomerService, '用戶级别:', this.user.level);
                    
                    // 如果是客服，加載所有代理列表
                    if (this.isCustomerService) {
                        await this.loadAllAgents();
                    }
                    
                    // 获取初始數據
                    await this.fetchDashboardData();
                    await this.fetchNotices();
                    
                                    // 载入当前代理的下級代理和会员列表
                await this.searchAgents();
                await this.searchMembers();
                
                // 初始化可用会员列表
                this.availableMembers = this.members;
                    
                    // 移除登入成功訊息視窗
                    // this.showMessage('登录成功', 'success');
                } else {
                    this.showMessage(response.data.message || '登录失败', 'error');
                    this.refreshCaptcha();
                }
            } catch (error) {
                console.error('登录错误:', error);
                this.showMessage(error.response?.data?.message || '登录失败，请稍後再試', 'error');
                this.refreshCaptcha();
            } finally {
                this.loading = false;
            }
        },
        
        // 登出方法
        async logout() {
            console.log('执行登出操作');
            
            // 如果有會話token，通知伺服器登出
            const sessionToken = localStorage.getItem('agent_session_token');
            if (sessionToken) {
                try {
                    await axios.post(`${API_BASE_URL}/logout`, { sessionToken });
                    console.log('✅ 會話已在伺服器端登出');
                } catch (error) {
                    console.error('伺服器端登出失败:', error);
                }
            }
            
            // 清除本地存儲
            localStorage.removeItem('agent_token');
            localStorage.removeItem('agent_user');
            localStorage.removeItem('agent_session_token');
            
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
            delete axios.defaults.headers.common['x-session-token'];
            
            this.showMessage('已成功登出', 'success');
            
            // 重定向到登录頁面
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        },
        
        // 获取儀表板數據
        async fetchDashboardData() {
            this.loading = true;
            
            try {
                console.log('嘗試获取儀表板數據，代理ID:', this.currentManagingAgent.id);
                const response = await axios.get(`${API_BASE_URL}/stats`, {
                    params: { agentId: this.currentManagingAgent.id }
                });
                
                if (response.data.success) {
                    // 使用data屬性而非stats屬性
                    const data = response.data.data;
                    
                    if (!data) {
                        console.error('获取儀表板數據错误: 返回數據格式异常', response.data);
                        this.showMessage('获取數據失败，數據格式异常', 'error');
                        return;
                    }
                    
                    this.dashboardData = {
                        totalDeposit: data.totalDeposit || 0,
                        totalWithdraw: data.totalWithdraw || 0,
                        totalRevenue: data.totalRevenue || 0,
                        totalTransactions: data.totalTransactions || 0,
                        memberCount: data.memberCount || 0,
                        activeMembers: data.activeMembers || 0,
                        subAgentsCount: data.subAgentsCount || 0
                    };
                    
                    // 初始化交易圖表
                    this.$nextTick(() => {
                        this.initTransactionChart();
                    });
                } else {
                    // 处理成功但返回失败的情況
                    console.error('获取儀表板數據错误: API返回失败', response.data);
                    this.showMessage(response.data.message || '获取數據失败，请稍後再試', 'error');
                }
            } catch (error) {
                console.error('获取儀表板數據错误:', error);
                this.showMessage('获取數據失败，请检查网络连接', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 初始化交易趨勢圖表
        initTransactionChart() {
            const ctx = document.getElementById('transactionChart');
            if (!ctx) return;
            
            // 检查 Chart.js 是否已加載
            if (typeof Chart === 'undefined') {
                console.warn('Chart.js 尚未加載，延遲初始化圖表');
                setTimeout(() => this.initTransactionChart(), 500);
                return;
            }
            
            // 模擬數據 - 過去7天的交易數據
            const labels = Array(7).fill(0).map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - (6 - i));
                return `${date.getMonth() + 1}/${date.getDate()}`;
            });
            
            const transactionData = [15000, 22000, 19500, 24000, 28000, 21000, 26500];

            
            if (this.transactionChart) {
                this.transactionChart.destroy();
            }
            
            this.transactionChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: '交易金额',
                            data: transactionData,
                            borderColor: 'rgba(54, 162, 235, 1)',
                            backgroundColor: 'rgba(54, 162, 235, 0.2)',
                            borderWidth: 2,
                            fill: true
                        },

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
        

        
        // 顯示訊息
        showMessage(message, type = 'info') {
            console.log(`[${type}] ${message}`);
            // 可根據項目需求使用 alert、toast 或自定義訊息組件
            if (type === 'error') {
                alert(`错误: ${message}`);
            } else if (type === 'success') {
                alert(`成功: ${message}`);
            } else {
                alert(message);
            }
        },
        
        // 格式化金额顯示
        formatMoney(amount) {
            if (amount === undefined || amount === null) return '0.00';
            return Number(amount).toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        },
        
        // 格式化日期顯示
        formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        },
        
        // 格式化日期时间（與 formatDate 相同，為了模板兼容性）
        formatDateTime(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        },
        
        // 客服交易记录分頁 - 上一頁
        loadCSTransactionsPrevPage() {
            const prevPage = Math.max(1, this.csTransactionsPagination.page - 1);
            this.loadCSTransactions(prevPage);
        },
        
        // 客服交易记录分頁 - 下一頁
        loadCSTransactionsNextPage() {
            const maxPage = Math.ceil(this.csTransactionsPagination.total / this.csTransactionsPagination.limit);
            const nextPage = Math.min(maxPage, this.csTransactionsPagination.page + 1);
            this.loadCSTransactions(nextPage);
        },
        
        // 获取系统公告
        async fetchNotices(category = null) {
            try {
                console.log('获取系统公告...');
                let url = `${API_BASE_URL}/notices`;
                if (category && category !== 'all') {
                    url += `?category=${encodeURIComponent(category)}`;
                }
                
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('获取系统公告失败:', response.status);
                    this.notices = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success) {
                    if (Array.isArray(data.notices)) {
                        this.notices = data.notices;
                    } else {
                        this.notices = [];
                    }
                    
                    if (Array.isArray(data.categories)) {
                        this.noticeCategories = ['all', ...data.categories];
                    }
                } else {
                    console.error('系统公告數據格式错误:', data);
                    this.notices = [];
                }
            } catch (error) {
                console.error('获取系统公告错误:', error);
                this.notices = [];
            }
        },
        
        // 根據分類過濾公告
        async filterNoticesByCategory(category) {
            this.selectedNoticeCategory = category;
            await this.fetchNotices(category === 'all' ? null : category);
        },
        
        // 顯示新增公告模態框
        // 开始编辑公告
        startEditNotice(notice) {
            if (this.user.level !== 0) {
                this.showMessage('權限不足，只有總代理可以编辑系统公告', 'error');
                return;
            }
            
            // 设置编辑數據
            this.editingNoticeId = notice.id;
            this.noticeForm = {
                title: notice.title,
                content: notice.content,
                category: notice.category
            };
            this.showNoticeForm = true;
            
            // 滾動到表單
            this.$nextTick(() => {
                const formElement = document.querySelector('.card .card-header h5');
                if (formElement) {
                    formElement.scrollIntoView({ behavior: 'smooth' });
                }
            });
        },
        
        // 取消编辑公告
        cancelNoticeEdit() {
            this.showNoticeForm = false;
            this.editingNoticeId = null;
            this.noticeForm = {
                title: '',
                content: '',
                category: '最新公告'
            };
        },
        
        // 提交公告（新增或编辑）
        async submitNotice() {
            try {
                // 驗證输入
                if (!this.noticeForm.title.trim()) {
                    this.showMessage('请输入公告標題', 'error');
                    return;
                }
                
                if (!this.noticeForm.content.trim()) {
                    this.showMessage('请输入公告內容', 'error');
                    return;
                }
                
                // 標題長度限制
                if (this.noticeForm.title.length > 100) {
                    this.showMessage('公告標題不能超過100個字符', 'error');
                    return;
                }
                
                this.loading = true;
                
                let response;
                if (this.editingNoticeId) {
                    // 编辑現有公告
                    response = await axios.put(`${API_BASE_URL}/notice/${this.editingNoticeId}`, {
                        operatorId: this.user.id,
                        title: this.noticeForm.title.trim(),
                        content: this.noticeForm.content.trim(),
                        category: this.noticeForm.category
                    });
                } else {
                    // 新增公告
                    response = await axios.post(`${API_BASE_URL}/create-notice`, {
                        operatorId: this.user.id,
                        title: this.noticeForm.title.trim(),
                        content: this.noticeForm.content.trim(),
                        category: this.noticeForm.category
                    });
                }
                
                if (response.data.success) {
                    this.showMessage(this.editingNoticeId ? '系统公告更新成功' : '系统公告创建成功', 'success');
                    this.cancelNoticeEdit();
                    
                    // 刷新公告列表
                    await this.fetchNotices();
                } else {
                    this.showMessage(response.data.message || '操作失败', 'error');
                }
                
            } catch (error) {
                console.error('公告操作出錯:', error);
                this.showMessage('操作出錯，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 获取当前日期时间
        getCurrentDateTime() {
            return new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        
        // 删除公告
        async deleteNotice(notice) {
            if (this.user.level !== 0) {
                this.showMessage('權限不足，只有總代理可以删除系统公告', 'error');
                return;
            }
            
            // 确认删除
            if (!confirm(`确定要删除公告「${notice.title}」嗎？此操作無法恢復。`)) {
                return;
            }
            
            try {
                this.loading = true;
                
                const response = await axios.delete(`${API_BASE_URL}/notice/${notice.id}`, {
                    data: {
                        operatorId: this.user.id
                    }
                });
                
                if (response.data.success) {
                    this.showMessage('系统公告删除成功', 'success');
                    
                    // 刷新公告列表
                    await this.fetchNotices();
                } else {
                    this.showMessage(response.data.message || '删除公告失败', 'error');
                }
                
            } catch (error) {
                console.error('删除公告出錯:', error);
                this.showMessage('删除公告出錯，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索代理
        async searchAgents() {
            this.loading = true;
            try {
                console.log('搜索代理...');
                const params = new URLSearchParams();
                if (this.agentFilters.status !== '-1') params.append('status', this.agentFilters.status);
                if (this.agentFilters.keyword) params.append('keyword', this.agentFilters.keyword);
                // 使用当前管理代理的ID作為parentId
                params.append('parentId', this.currentManagingAgent.id);
                
                const url = `${API_BASE_URL}/sub-agents?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('搜索代理失败:', response.status);
                    this.agents = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.data) {
                    this.agents = data.data.list || [];
                    this.agentPagination.totalPages = Math.ceil(data.data.total / this.agentPagination.limit);
                    this.agentPagination.currentPage = data.data.page || 1;
                    
                    // ✅ 簡化邏輯：後端已返回正確的數字級別，無需額外轉換
                } else {
                    console.error('代理數據格式错误:', data);
                    this.agents = [];
                }
            } catch (error) {
                console.error('搜索代理错误:', error);
                this.agents = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索会员
        async searchMembers() {
            this.loading = true;
            try {
                console.log('搜索会员...当前管理代理ID:', this.currentManagingAgent.id, '查看模式:', this.memberViewMode);
                
                if (this.memberViewMode === 'downline') {
                    // 下級代理会员模式：获取整條代理線的会员
                    await this.loadDownlineMembers();
                } else {
                    // 直屬会员模式：只获取当前代理的会员
                    await this.loadDirectMembers();
                }
            } catch (error) {
                console.error('搜索会员错误:', error);
                this.members = [];
            } finally {
                this.loading = false;
            }
        },

        // 層級會員管理相關函數
        async loadHierarchicalMembers() {
            this.loading = true;
            try {
                const agentId = this.currentMemberManagingAgent.id || this.currentManagingAgent.id;
                console.log('🔄 載入層級會員管理數據...', { agentId });
                
                const response = await axios.get(`${API_BASE_URL}/hierarchical-members`, {
                    params: {
                        agentId: agentId,
                        status: this.memberFilters.status !== '-1' ? this.memberFilters.status : undefined,
                        keyword: this.memberFilters.keyword || undefined
                    }
                });
                
                if (response.data.success) {
                    this.hierarchicalMembers = response.data.data || [];
                    this.memberHierarchyStats = response.data.stats || { agentCount: 0, memberCount: 0 };
                    
                    // 🔧 防禦性修復：強制將所有代理的level轉換為數字
                    this.hierarchicalMembers.forEach(item => {
                        if (item.userType === 'agent') {
                            let numLevel = parseInt(item.level);
                            
                            // 如果parseInt失敗，嘗試從字符串級別名稱轉換
                            if (isNaN(numLevel)) {
                                const levelMap = {
                                    '總代理': 0,
                                    '一級代理': 1,
                                    '二級代理': 2,
                                    '三級代理': 3,
                                    '四級代理': 4,
                                    '五級代理': 5,
                                    '六級代理': 6,
                                    '七級代理': 7,
                                    '八級代理': 8,
                                    '九級代理': 9,
                                    '十級代理': 10,
                                    '十一級代理': 11,
                                    '十二級代理': 12,
                                    '十三級代理': 13,
                                    '十四級代理': 14,
                                    '十五級代理': 15
                                };
                                
                                numLevel = levelMap[item.level];
                                if (numLevel === undefined) {
                                    console.warn('⚠️ 代理 level 無效:', item.level, '使用預設值 0');
                                    numLevel = 0;
                                } else {
                                    console.log('✅ 成功轉換字符串級別:', item.level, '->', numLevel);
                                }
                            }
                            
                            item.level = numLevel;
                        }
                    });
                    
                    console.log('✅ 層級會員管理數據載入成功:', this.hierarchicalMembers.length, '項');
                    
                    // 調試：輸出代理的退水設定
                    const agents = this.hierarchicalMembers.filter(m => m.userType === 'agent');
                    if (agents.length > 0) {
                        console.log('🔍 代理退水設定數據:', agents.map(agent => ({
                            id: agent.id,
                            username: agent.username,
                            level: agent.level,
                            rebate_mode: agent.rebate_mode,
                            rebate_percentage: agent.rebate_percentage,
                            max_rebate_percentage: agent.max_rebate_percentage
                        })));
                    }
                } else {
                    console.error('❌ 載入層級會員管理數據失败:', response.data.message);
                    this.hierarchicalMembers = [];
                    this.memberHierarchyStats = { agentCount: 0, memberCount: 0 };
                }
            } catch (error) {
                console.error('❌ 載入層級會員管理數據错误:', error);
                this.hierarchicalMembers = [];
                this.memberHierarchyStats = { agentCount: 0, memberCount: 0 };
            } finally {
                this.loading = false;
            }
        },

        async refreshHierarchicalMembers() {
            await this.loadHierarchicalMembers();
        },

        async enterAgentMemberManagement(agent) {
            console.log('🔽 進入代理的會員管理:', agent);
            
            // 添加到麵包屑
            this.memberBreadcrumb.push({
                id: this.currentMemberManagingAgent.id || this.currentManagingAgent.id,
                username: this.currentMemberManagingAgent.username || this.currentManagingAgent.username,
                level: this.currentMemberManagingAgent.level || this.currentManagingAgent.level,
                levelName: this.getLevelName(this.currentMemberManagingAgent.level || this.currentManagingAgent.level)
            });
            
            // 確保 level 是數字
            let agentLevel = parseInt(agent.level, 10);
            if (isNaN(agentLevel) || agentLevel < 0) {
                console.warn('⚠️ 代理 level 無效:', agent.level, '使用預設值');
                agentLevel = 0;
            }
            
            // 保留完整的代理數據，特別是退水設定相關資訊
            this.currentMemberManagingAgent = {
                id: agent.id,
                username: agent.username,
                level: agentLevel,
                rebate_percentage: agent.rebate_percentage,
                max_rebate_percentage: agent.max_rebate_percentage,
                rebate_mode: agent.rebate_mode,
                market_type: agent.market_type,
                balance: agent.balance,
                status: agent.status
            };
            
            console.log('✅ 設定當前會員管理代理:', this.currentMemberManagingAgent);
            
            // 載入新代理的會員
            await this.loadHierarchicalMembers();
        },

        async goBackToParentMember() {
            if (this.memberBreadcrumb.length > 0) {
                const parent = this.memberBreadcrumb.pop();
                
                // 嘗試從 agents 數組中找到完整的代理資料
                const fullAgentData = this.agents.find(a => a.id === parent.id);
                
                if (fullAgentData) {
                    // 使用完整的代理資料
                    this.currentMemberManagingAgent = {
                        id: fullAgentData.id,
                        username: fullAgentData.username,
                        level: fullAgentData.level,
                        rebate_percentage: fullAgentData.rebate_percentage,
                        max_rebate_percentage: fullAgentData.max_rebate_percentage,
                        rebate_mode: fullAgentData.rebate_mode,
                        market_type: fullAgentData.market_type,
                        balance: fullAgentData.balance,
                        status: fullAgentData.status
                    };
                } else {
                    // 如果找不到，使用基本資料（向下兼容）
                    this.currentMemberManagingAgent = {
                        id: parent.id,
                        username: parent.username,
                        level: 0 // 預設為總代理
                    };
                }
                
                console.log('🔙 返回上級代理:', this.currentMemberManagingAgent);
                await this.loadHierarchicalMembers();
            }
        },

        async goBackToMemberLevel(targetItem) {
            // 嘗試從 agents 數組中找到完整的代理資料
            const fullAgentData = this.agents.find(a => a.id === targetItem.id);
            
            if (fullAgentData) {
                // 使用完整的代理資料
                this.currentMemberManagingAgent = {
                    id: fullAgentData.id,
                    username: fullAgentData.username,
                    level: fullAgentData.level,
                    rebate_percentage: fullAgentData.rebate_percentage,
                    max_rebate_percentage: fullAgentData.max_rebate_percentage,
                    rebate_mode: fullAgentData.rebate_mode,
                    market_type: fullAgentData.market_type,
                    balance: fullAgentData.balance,
                    status: fullAgentData.status
                };
            } else {
                // 如果找不到，使用基本資料（向下兼容）
                this.currentMemberManagingAgent = {
                    id: targetItem.id,
                    username: targetItem.username,
                    level: 0 // 預設為總代理
                };
            }
            
            console.log('🎯 跳轉到指定代理層級:', this.currentMemberManagingAgent);
            await this.loadHierarchicalMembers();
        },


        
        // 载入直屬会员
        async loadDirectMembers() {
            const params = new URLSearchParams();
            if (this.memberFilters.status !== '-1') params.append('status', this.memberFilters.status);
            if (this.memberFilters.keyword) params.append('keyword', this.memberFilters.keyword);
            params.append('agentId', this.currentManagingAgent.id);
            params.append('page', this.memberPagination.currentPage);
            params.append('limit', this.memberPagination.limit);
            
            const url = `${API_BASE_URL}/members?${params.toString()}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                console.error('搜索直屬会员失败:', response.status);
                this.members = [];
                return;
            }
            
            const data = await response.json();
            if (data.success && data.data) {
                this.members = data.data.list || [];
                this.memberPagination.totalPages = Math.ceil(data.data.total / this.memberPagination.limit);
                this.memberPagination.currentPage = data.data.page || 1;
            } else {
                console.error('直屬会员數據格式错误:', data);
                this.members = [];
            }
        },
        
        // 载入下級代理会员
        async loadDownlineMembers() {
            try {
                console.log('📡 载入下級代理会员...');
                const response = await axios.get(`${API_BASE_URL}/downline-members`, {
                    params: { 
                        rootAgentId: this.currentManagingAgent.id,
                        status: this.memberFilters.status !== '-1' ? this.memberFilters.status : undefined,
                        keyword: this.memberFilters.keyword || undefined
                    }
                });
                
                if (response.data.success) {
                    this.members = response.data.members || [];
                    // 為下級代理会员模式设定分頁（簡化版）
                    this.memberPagination.totalPages = 1;
                    this.memberPagination.currentPage = 1;
                    console.log('✅ 载入下級代理会员成功:', this.members.length, '個');
                } else {
                    console.error('❌ 载入下級代理会员失败:', response.data.message);
                    this.members = [];
                }
            } catch (error) {
                console.error('❌ 载入下級代理会员错误:', error);
                this.members = [];
            }
        },
        
        // 处理会员查看模式變更
        async handleMemberViewModeChange() {
            console.log('🔄 会员查看模式變更:', this.memberViewMode);
            // 重置分頁
            this.memberPagination.currentPage = 1;
            // 重新载入会员列表
            await this.searchMembers();
        },
        
        // 隱藏余额调整模態框
        hideAdjustBalanceModal() {
            if (this.adjustBalanceModal) {
                this.adjustBalanceModal.hide();
            }
            this.showAdjustBalanceModal = false;
        },
        
        // 计算最终会员余额
        calculateFinalMemberBalance() {
            const currentBalance = parseFloat(this.balanceAdjustData.currentBalance) || 0;
            const amount = parseFloat(this.transferAmount) || 0;
            if (this.transferType === 'deposit') {
                return currentBalance + amount;
            } else {
                return currentBalance - amount;
            }
        },
        
        // 计算最终代理余额（会员点数转移用）
        calculateFinalAgentBalance() {
            const currentBalance = parseFloat(this.agentCurrentBalance) || 0;
            const amount = parseFloat(this.transferAmount) || 0;
            
            if (this.transferType === 'deposit') {
                // 代理存入点数給会员，代理余额減少
                return currentBalance - amount;
            } else {
                // 代理從会员提领点数，代理余额增加
                return currentBalance + amount;
            }
        },

        // 设置最大转移金额（会员点数转移）
        setMaxAmount() {
            if (this.transferType === 'deposit') {
                // 存入：使用代理的全部余额
                this.transferAmount = parseFloat(this.agentCurrentBalance) || 0;
            } else if (this.transferType === 'withdraw') {
                // 提领：使用会员的全部余额
                this.transferAmount = parseFloat(this.balanceAdjustData.currentBalance) || 0;
            }
        },
        
        // 格式化时间
        formatTime(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleTimeString('zh-CN', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false
            });
        },
        
        // 獲取盤口最大退水比例
        getMaxRebateForMarket(marketType) {
            if (marketType === 'A') {
                return 1.1; // A盤最大1.1%
            } else if (marketType === 'D') {
                return 4.1; // D盤最大4.1%
            }
            return 4.1; // 默認D盤
        },
        
        // 獲取盤口信息
        getMarketInfo(marketType) {
            if (marketType === 'A') {
                return {
                    name: 'A盤',
                    rebate: '1.1%',
                    description: '高賠率盤口',
                    numberOdds: '9.89',
                    twoSideOdds: '1.9'
                };
            } else if (marketType === 'D') {
                return {
                    name: 'D盤',
                    rebate: '4.1%',
                    description: '標準盤口',
                    numberOdds: '9.59',
                    twoSideOdds: '1.88'
                };
            }
            return this.getMarketInfo('D'); // 默認D盤
        },
        
        // 处理查看范围變更（優化性能）
        async handleViewScopeChange() {
            console.log('🔄 查看范围變更:', this.betFilters.viewScope);
            
            // 重置相关篩選
            this.betFilters.member = '';
            this.betFilters.specificAgent = '';
            
            // 延遲載入會員列表，只在真正需要時載入
            if (this.betFilters.viewScope === 'own') {
                // 僅本代理下級会员 - 快速載入直屬會員
                this.loadDirectMembersForBets();
            } else if (this.betFilters.viewScope === 'downline') {
                // 整條代理線 - 使用緩存優化
                this.loadDownlineAgentsAndMembers();
            } else if (this.betFilters.viewScope === 'specific') {
                // 指定代理/会员 - 延遲載入
                this.availableMembers = [];
                this.loadAllDownlineAgents();
            }
            
            // 不自動搜索，等用戶操作後再搜索
            console.log('✅ 查看範圍已切換，等待用戶進一步操作');
        },
        
        // 載入直屬會員用於下注記錄
        async loadDirectMembersForBets() {
            try {
                console.log('📡 载入直屬会员用於下注记录...');
                const response = await axios.get(`${API_BASE_URL}/members`, {
                    params: { 
                        agentId: this.currentManagingAgent.id,
                        page: 1,
                        limit: 1000  // 載入所有直屬會員
                    }
                });
                
                if (response.data.success && response.data.data) {
                    this.availableMembers = response.data.data.list || [];
                    console.log('✅ 载入直屬会员成功:', this.availableMembers.length, '個');
                } else {
                    console.error('❌ 载入直屬会员失败:', response.data.message);
                    this.availableMembers = [];
                }
            } catch (error) {
                console.error('❌ 载入直屬会员错误:', error);
                this.availableMembers = [];
            }
        },
        
        // 载入所有下級代理
        async loadAllDownlineAgents() {
            try {
                console.log('📡 载入所有下級代理...');
                const response = await axios.get(`${API_BASE_URL}/downline-agents`, {
                    params: { 
                        rootAgentId: this.currentManagingAgent.id 
                    }
                });
                
                if (response.data.success) {
                    this.allDownlineAgents = response.data.agents || [];
                    console.log('✅ 载入下級代理成功:', this.allDownlineAgents.length, '個');
                } else {
                    console.error('❌ 载入下級代理失败:', response.data.message);
                }
            } catch (error) {
                console.error('❌ 载入下級代理错误:', error);
                this.showMessage('载入代理列表失败', 'error');
            }
        },
        
        // 载入整條代理線的代理和会员（優化緩存版本）
        async loadDownlineAgentsAndMembers() {
            try {
                // 如果已有緩存且不超過5分鐘，直接使用
                if (this.availableMembers.length > 0 && 
                    this.lastMembersLoadTime && 
                    Date.now() - this.lastMembersLoadTime < 5 * 60 * 1000) {
                    console.log('🚀 使用緩存的代理線會員數據:', this.availableMembers.length, '個');
                    return;
                }
                
                console.log('📡 载入整條代理線的会员...');
                
                const response = await axios.get(`${API_BASE_URL}/downline-members`, {
                    params: { 
                        rootAgentId: this.currentManagingAgent.id,
                        limit: 500  // 限制數量提升性能
                    }
                });
                
                if (response.data.success) {
                    this.availableMembers = response.data.members || [];
                    this.lastMembersLoadTime = Date.now(); // 記錄載入時間
                    console.log('✅ 载入整條代理線会员成功:', this.availableMembers.length, '個');
                } else {
                    console.error('❌ 载入整條代理線会员失败:', response.data.message);
                    this.availableMembers = [];
                }
            } catch (error) {
                console.error('❌ 载入整條代理線会员错误:', error);
                this.availableMembers = [];
            }
        },
        
        // 载入指定代理的会员
        async loadSpecificAgentMembers() {
            if (!this.betFilters.specificAgent) {
                this.availableMembers = [];
                return;
            }
            
            try {
                console.log('📡 载入指定代理的会员...', this.betFilters.specificAgent);
                const response = await axios.get(`${API_BASE_URL}/agent-members`, {
                    params: { 
                        agentId: this.betFilters.specificAgent 
                    }
                });
                
                if (response.data.success) {
                    this.availableMembers = response.data.members || [];
                    console.log('✅ 载入指定代理会员成功:', this.availableMembers.length, '個');
                } else {
                    console.error('❌ 载入指定代理会员失败:', response.data.message);
                }
            } catch (error) {
                console.error('❌ 载入指定代理会员错误:', error);
                this.showMessage('载入会员列表失败', 'error');
            }
        },
        
        // 重置下注篩選條件
        resetBetFilters() {
            console.log('🔄 重置下注篩選條件');
            this.betFilters = {
                member: '',
                date: '',
                startDate: '',
                endDate: '',
                period: '',
                viewScope: 'own',
                specificAgent: ''
            };
            // 重新載入直屬會員列表
            this.loadDirectMembersForBets();
            this.searchBets();
        },
        
        // 搜索下注记录
        async searchBets() {
            this.loading = true;
            try {
                console.log('🔍 搜索下注记录...当前管理代理ID:', this.currentManagingAgent.id);
                console.log('📊 查看范围:', this.betFilters.viewScope);
                
                const params = new URLSearchParams();
                if (this.betFilters.member) params.append('username', this.betFilters.member);
                if (this.betFilters.date) params.append('date', this.betFilters.date);
                if (this.betFilters.startDate) params.append('startDate', this.betFilters.startDate);
                if (this.betFilters.endDate) params.append('endDate', this.betFilters.endDate);
                if (this.betFilters.period) params.append('period', this.betFilters.period);
                
                // 根據查看范围设置不同的查询參數
                if (this.betFilters.viewScope === 'own') {
                    // 僅本代理下級会员
                    params.append('agentId', this.currentManagingAgent.id);
                } else if (this.betFilters.viewScope === 'downline') {
                    // 整條代理線
                    params.append('rootAgentId', this.currentManagingAgent.id);
                    params.append('includeDownline', 'true');
                } else if (this.betFilters.viewScope === 'specific' && this.betFilters.specificAgent) {
                    // 指定代理
                    params.append('agentId', this.betFilters.specificAgent);
                }
                
                // 添加分頁參數
                params.append('page', this.betPagination.currentPage);
                params.append('limit', this.betPagination.limit);
                
                const url = `${API_BASE_URL}/bets?${params.toString()}`;
                console.log('📡 请求URL:', url);
                
                // 確保認證標頭正確設置
                const headers = {};
                const sessionToken = localStorage.getItem('agent_session_token');
                const legacyToken = localStorage.getItem('agent_token');
                
                if (sessionToken) {
                    headers['x-session-token'] = sessionToken;
                    headers['X-Session-Token'] = sessionToken;
                }
                if (legacyToken) {
                    headers['Authorization'] = legacyToken;
                }
                
                const response = await axios.get(url, { headers });
                
                if (!response.data.success) {
                    console.error('❌ 搜索下注记录失败:', response.data.message);
                    this.bets = [];
                    return;
                }
                
                const data = response.data;
                if (data.success) {
                    this.bets = data.bets || [];
                    console.log('✅ 获取下注记录成功:', this.bets.length, '筆');
                    
                    this.betPagination.totalPages = Math.ceil(data.total / this.betPagination.limit);

                    // 更新统计數據
                    this.betStats = data.stats || {
                        totalBets: 0,
                        totalAmount: 0,
                        totalProfit: 0
                    };
                } else {
                    console.error('❌ 获取下注记录失败:', data.message || '未知错误');
                    this.bets = [];
                    this.betPagination.totalPages = 1;
                    this.betStats = { totalBets: 0, totalAmount: 0, totalProfit: 0 };
                }
            } catch (error) {
                console.error('❌ 搜索下注记录错误:', error);
                this.bets = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 加載开奖历史
        async loadDrawHistory() {
            this.loading = true;
            try {
                console.log('加載开奖历史...');
                const url = `${API_BASE_URL}/draw-history`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('加載开奖历史失败:', response.status);
                    this.drawRecords = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.records) {
                    this.drawRecords = data.records || [];
                    this.drawPagination.totalPages = Math.ceil(data.total / this.drawPagination.limit);
                    this.drawPagination.currentPage = data.page || 1;
                } else {
                    console.error('开奖历史數據格式错误:', data);
                    this.drawRecords = [];
                }
            } catch (error) {
                console.error('加載开奖历史错误:', error);
                this.drawRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索开奖历史
        async searchDrawHistory() {
            this.loading = true;
            try {
                console.log('搜索开奖历史...');
                const params = new URLSearchParams();
                if (this.drawFilters.period) params.append('period', this.drawFilters.period);
                if (this.drawFilters.date) params.append('date', this.drawFilters.date);
                params.append('page', this.drawPagination.currentPage);
                params.append('limit', this.drawPagination.limit);
                
                const url = `${API_BASE_URL}/draw-history?${params.toString()}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('搜索开奖历史失败:', response.status);
                    this.drawRecords = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success && data.records) {
                    this.drawRecords = data.records || [];
                    this.drawPagination.totalPages = Math.ceil(data.total / this.drawPagination.limit);
                    this.drawPagination.currentPage = data.page || 1;
                } else {
                    console.error('开奖历史數據格式错误:', data);
                    this.drawRecords = [];
                }
            } catch (error) {
                console.error('搜索开奖历史错误:', error);
                this.drawRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 搜索今日开奖记录
        async searchTodayDrawHistory() {
            this.drawFilters.date = new Date().toISOString().split('T')[0]; // 设置為今天日期 YYYY-MM-DD
            this.drawFilters.period = '';
            await this.searchDrawHistory();
        },
        
        // 获取分頁范围
        getPageRange(currentPage, totalPages) {
            const range = [];
            const maxVisible = 5;
            
            if (totalPages <= maxVisible) {
                // 如果總頁數小於要顯示的頁數，顯示所有頁
                for (let i = 1; i <= totalPages; i++) {
                    range.push(i);
                }
            } else {
                // 计算顯示哪些頁面
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
            // 根據後端邏輯，重新分類投注類型
            if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(type)) {
                return '雙面';
            } else if (type === 'number') {
                return '号码';
            } else if (type === 'sumValue') {
                return '冠亞和值';
            } else if (type === 'dragonTiger' || type === 'dragon_tiger') {
                return '龍虎';
            }
            
            // 備用映射（向下相容）
            const types = {
                'sum': '冠亞和值',
                'second': '雙面'
            };
            return types[type] || type;
        },
        
        // 格式化位置
        formatPosition(position, betType) {
            // 對於号码投注，position是數字（1-10），代表第幾位
            if (betType === 'number' && position) {
                const positionMap = {
                    '1': '冠军',
                    '2': '亚军', 
                    '3': '第三名',
                    '4': '第四名',
                    '5': '第五名',
                    '6': '第六名',
                    '7': '第七名',
                    '8': '第八名',
                    '9': '第九名',
                    '10': '第十名'
                };
                return positionMap[position.toString()] || `第${position}名`;
            }
            
            // 對於位置投注，bet_type本身就是位置
            if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType)) {
                const positionMap = {
                    'champion': '冠军',
                    'runnerup': '亚军',
                    'third': '第三名',
                    'fourth': '第四名',
                    'fifth': '第五名',
                    'sixth': '第六名',
                    'seventh': '第七名',
                    'eighth': '第八名',
                    'ninth': '第九名',
                    'tenth': '第十名'
                };
                return positionMap[betType] || betType;
            }
            
            // 其他情況（冠亞和值、龍虎等）不需要位置
            return '-';
        },
        
        // 获取龍虎结果
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
        
        // 格式化转移類型
        formatTransferType(transfer) {
            // 以当前登录代理身份為第一人稱，只顯示存款或提领
            const currentAgentId = this.user.id;
            
            // 如果当前代理是转出方，顯示為「提领」（我转出給其他人）
            if (transfer.from_id === currentAgentId && transfer.from_type === 'agent') {
                return '提领';
            }
            // 如果当前代理是转入方，顯示為「存款」（其他人转入給我）
            else if (transfer.to_id === currentAgentId && transfer.to_type === 'agent') {
                return '存款';
            }
            // 備用邏輯（適用於查看其他代理记录的情況）
            else if (transfer.from_type === 'agent' && transfer.to_type === 'member') {
                return '存入';
            } else if (transfer.from_type === 'member' && transfer.to_type === 'agent') {
                return '提领';
            } else if (transfer.from_type === 'agent' && transfer.to_type === 'agent') {
                return '存入';  // 代理間转移统一顯示為存入
            } else {
                return '点数转移';
            }
        },
        
        // 格式化转移方向
        formatTransferDirection(transfer) {
            // 以当前登录代理身份為第一人稱，從其观点描述转移方向
            const currentAgentId = this.user.id;
            
            // 如果当前代理是转出方
            if (transfer.from_id === currentAgentId && transfer.from_type === 'agent') {
                if (transfer.to_type === 'member') {
                    return `我 → ${transfer.to_username || '未知会员'}`;
                } else if (transfer.to_type === 'agent') {
                    return `我 → ${transfer.to_username || '未知代理'}`;
                }
            }
            // 如果当前代理是转入方
            else if (transfer.to_id === currentAgentId && transfer.to_type === 'agent') {
                if (transfer.from_type === 'member') {
                    return `${transfer.from_username || '未知会员'} → 我`;
                } else if (transfer.from_type === 'agent') {
                    return `${transfer.from_username || '未知代理'} → 我`;
                }
            }
            // 其他情況（查看他人记录）
            else {
                const fromName = transfer.from_username || (transfer.from_type === 'agent' ? '代理' : '会员');
                const toName = transfer.to_username || (transfer.to_type === 'agent' ? '代理' : '会员');
                return `${fromName} → ${toName}`;
            }
            
            return '未知方向';
        },
        
        // 格式化交易類型
        formatTransactionType(transaction) {
            const type = transaction.transaction_type || transaction.type;
            switch (type) {
                case 'cs_deposit':
                    return '客服存款';
                case 'cs_withdraw':
                    return '客服提款';
                case 'deposit':
                    return '存款';
                case 'withdraw':
                    return '提款';
                case 'transfer_in':
                    return '转入';
                case 'transfer_out':
                    return '转出';
                case 'adjustment':
                    return '余额调整';
                case 'password_reset':
                    return '密碼重设';
                case 'game_bet':
                    return '游戏下注';
                case 'game_win':
                    return '游戏中獎';
                case 'rebate':
                    return '退水';
                default:
                    return type || '未知';
            }
        },
        
        // 格式化用戶類型
        formatUserType(userType) {
            switch (userType) {
                case 'agent':
                    return '代理';
                case 'member':
                    return '会员';
                default:
                    return userType || '未知';
            }
        },
        
        // 获取级别名稱 - 簡化邏輯，直接處理數字級別
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
            
            // 確保 level 是數字
            const n = parseInt(level, 10);
            
            // 如果轉換失敗，返回預設值
            if (isNaN(n) || n < 0) {
                console.warn('⚠️ getLevelName 收到無效 level:', level, '使用預設值');
                return '未知級別';
            }
            
            return levels[n] || `${n}級代理`;
        },

        // 獲取級別簡短名稱（用於帳號管理表格）
        getLevelShortName(level) {
            // 確保 level 是數字
            const n = parseInt(level, 10);
            if (isNaN(n) || n < 0) return '未知';
            
            if (n === 0) return '總代理';
            const chinese = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];
            return `${chinese[n] || n}級`;
        },

        // 獲取下一級級別名稱（用於新增代理）
        getNextLevelName() {
            let currentLevel = 0;
            
            // 確定當前管理代理的級別
            if (this.activeTab === 'accounts' && this.currentMemberManagingAgent && this.currentMemberManagingAgent.level !== undefined) {
                currentLevel = this.currentMemberManagingAgent.level;
            } else if (this.currentManagingAgent && this.currentManagingAgent.level !== undefined) {
                currentLevel = this.currentManagingAgent.level;
            } else {
                currentLevel = this.user.level || 0;
            }
            
            // 確保 currentLevel 是數字
            const n = parseInt(currentLevel, 10);
            if (isNaN(n) || n < 0) {
                console.warn('⚠️ getNextLevelName 收到無效 level:', currentLevel, '使用預設值');
                currentLevel = 0;
            } else {
                currentLevel = n;
            }
            
            // 返回下一級的級別名稱
            const nextLevel = currentLevel + 1;
            return this.getLevelName(nextLevel);
        },
        
        // 提交余额调整
        async submitBalanceAdjustment() {
            if (!this.balanceAdjustData.memberId || !this.balanceAdjustData.currentBalance || !this.transferAmount || !this.transferType) {
                return this.showMessage('请填寫完整余额调整资料', 'error');
            }
            
            this.loading = true;
            
            try {
                // 准备要傳送的數據，确保包含所有後端需要的欄位
                const payload = {
                    agentId: this.balanceAdjustData.agentId,
                    username: this.balanceAdjustData.memberUsername, // 後端需要 username
                    amount: this.transferType === 'deposit' ? this.transferAmount : -this.transferAmount, // 根據類型调整金额正負
                    type: this.transferType, // 转移類型 'deposit' 或 'withdraw'
                    description: this.balanceAdjustData.description
                };

                const response = await axios.post(`${API_BASE_URL}/update-member-balance`, payload);
                
                if (response.data.success) {
                    this.showMessage('余额调整成功', 'success');
                    // 更新前端顯示的代理和会员余额
                    this.user.balance = response.data.agentBalance;
                    // 同时更新localStorage中的用戶资讯
                    localStorage.setItem('agent_user', JSON.stringify(this.user));
                    this.agentCurrentBalance = parseFloat(response.data.agentBalance) || 0; // 同步更新代理当前余额
                    // 需要重新获取会员列表或更新特定会员的余额，以反映變更
                    this.searchMembers(); // 重新载入会员列表，會包含更新後的余额
                    this.hideAdjustBalanceModal(); // 关闭模態框
                    await this.fetchDashboardData(); // 更新儀表板數據
                } else {
                    this.showMessage(response.data.message || '余额调整失败', 'error');
                }
            } catch (error) {
                console.error('提交余额调整错误:', error);
                this.showMessage(error.response?.data?.message || '余额调整失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        // 新增的方法，确保在Vue實例中定義
        async createMember() {
            // 實際的创建会员邏輯需要您來實現
            console.log('createMember 方法被調用', this.newMember);
            if (!this.newMember.username || !this.newMember.password || !this.newMember.confirmPassword) {
                this.showMessage('请填寫所有必填欄位', 'error');
                return;
            }
            
            // 驗證用戶名格式（只允許英文、數字）
            const usernameRegex = /^[a-zA-Z0-9]+$/;
            if (!usernameRegex.test(this.newMember.username)) {
                this.showMessage('用戶名只能包含英文字母和數字', 'error');
                return;
            }
            
            // 驗證密碼長度（至少6碼）
            if (this.newMember.password.length < 6) {
                this.showMessage('密碼至少需要6個字符', 'error');
                return;
            }
            
            if (this.newMember.password !== this.newMember.confirmPassword) {
                this.showMessage('兩次输入的密碼不一致', 'error');
                return;
            }
            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/create-member`, {
                    username: this.newMember.username,
                    password: this.newMember.password,
                    agentId: this.currentManagingAgent.id, // 使用当前管理代理的ID而非登录代理
                    notes: this.newMember.notes || ''
                });
                if (response.data.success) {
                    const agentName = this.currentManagingAgent.username;
                    const isCurrentUser = this.currentManagingAgent.id === this.user.id;
                    const memberUsername = this.newMember.username;
                    
                    this.hideCreateMemberModal();
                    // 重置新增会员表單
                    this.newMember = {
                        username: '',
                        password: '',
                        confirmPassword: '',
                        balance: 0,
                        status: 1,
                        notes: ''
                    };
                    
                    // 統一處理：創建會員成功後顯示訊息並刷新列表，不進行跳轉
                    const message = isCurrentUser 
                        ? `会员 ${memberUsername} 创建成功!`
                        : `已為代理 ${agentName} 创建会员 ${memberUsername}，請根據需求調整點數及限紅`;
                    
                    this.showMessage(message, 'success');
                    
                    // 根據當前標籤頁決定刷新方式
                    if (this.activeTab === 'accounts') {
                        // 在層級會員管理介面時刷新層級會員數據
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面時刷新會員列表
                        await this.searchMembers();
                    }
                } else {
                    this.showMessage(response.data.message || '会员创建失败', 'error');
                }
            } catch (error) {
                console.error('创建会员出錯:', error);
                this.showMessage(error.response?.data?.message || '创建会员出錯，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        

        async fetchParentAgents() {
            // 實際获取上級代理列表的邏輯需要您來實現
            console.log('fetchParentAgents 方法被調用');
             if (this.user.level === 0) { // 總代理不能有上級
                this.parentAgents = [];
                return;
            }
            this.loading = true;
            try {
                // 通常是获取可作為当前操作代理的上級代理列表
                // 这里假設API會返回合適的代理列表
                const response = await axios.get(`${API_BASE_URL}/available-parents`);
                if (response.data.success) {
                    this.parentAgents = response.data.agents || [];
                } else {
                    this.showMessage(response.data.message || '获取上級代理失败', 'error');
                    this.parentAgents = [];
                }
            } catch (error) {
                console.error('获取上級代理列表出錯:', error);
                this.showMessage('获取上級代理列表出錯，请稍後再試', 'error');
                this.parentAgents = [];
            } finally {
                this.loading = false;
            }
        },
        async createAgent() {
            console.log('createAgent 方法被調用', this.newAgent);
            
            // 檢查15級代理限制
            let currentLevel = 0;
            if (this.activeTab === 'accounts' && this.currentMemberManagingAgent && this.currentMemberManagingAgent.level !== undefined) {
                currentLevel = this.currentMemberManagingAgent.level;
            } else if (this.currentManagingAgent && this.currentManagingAgent.level !== undefined) {
                currentLevel = this.currentManagingAgent.level;
            } else {
                currentLevel = this.user.level || 0;
            }
            
            if (currentLevel >= 15) {
                this.showMessage('15級代理已達最大層級限制，只能創建會員，不能創建下級代理', 'error');
                return;
            }
            
            if (!this.newAgent.username || !this.newAgent.password) {
                this.showMessage('请填寫所有必填欄位', 'error');
                return;
            }
            
            // 驗證用戶名格式（只允許英文、數字）
            const usernameRegex = /^[a-zA-Z0-9]+$/;
            if (!usernameRegex.test(this.newAgent.username)) {
                this.showMessage('用戶名只能包含英文字母和數字', 'error');
                return;
            }
            
            // 驗證密碼長度（至少6碼）
            if (this.newAgent.password.length < 6) {
                this.showMessage('密碼至少需要6個字符', 'error');
                return;
            }
            
                            // 驗證退水设定
            if (this.newAgent.rebate_mode === 'percentage') {
                const rebatePercentage = parseFloat(this.newAgent.rebate_percentage);
                // 修復：使用当前管理代理的實際退水比例作為最大限制
                const managingAgent = this.currentMemberManagingAgent || this.currentManagingAgent;
                const actualRebate = managingAgent.rebate_percentage || managingAgent.max_rebate_percentage || (managingAgent.market_type === 'A' ? 0.011 : 0.041);
                const maxRebate = actualRebate * 100;
                
                if (isNaN(rebatePercentage) || rebatePercentage < 0 || rebatePercentage > maxRebate) {
                    this.showMessage(`退水比例必須在 0% - ${maxRebate.toFixed(1)}% 之間`, 'error');
                    return;
                }
            }
            
            this.loading = true;
            try {
                const payload = {
                    username: this.newAgent.username,
                    password: this.newAgent.password,
                    level: parseInt(this.newAgent.level),
                    parent: this.newAgent.parent,
                    market_type: this.newAgent.market_type,
                    rebate_mode: this.newAgent.rebate_mode,
                    notes: this.newAgent.notes || ''
                };
                
                // 只有在选择具體比例時才傳送退水比例
                if (this.newAgent.rebate_mode === 'percentage') {
                    payload.rebate_percentage = parseFloat(this.newAgent.rebate_percentage) / 100;
                }
                
                console.log('创建代理请求數據:', payload);
                
                const response = await axios.post(`${API_BASE_URL}/create-agent`, payload);
                if (response.data.success) {
                    this.showMessage('代理创建成功!', 'success');
                    this.hideCreateAgentModal();
                    
                    // 重置表單
                    this.newAgent = {
                        username: '',
                        password: '',
                        level: '1',
                        parent: '',
                        market_type: 'D',
                        rebate_mode: 'percentage',
                        rebate_percentage: 2.0, // 重置時使用D盤默認值
                        notes: ''
                    };
                    
                    // 根據當前標籤頁決定刷新方式
                    if (this.activeTab === 'accounts') {
                        // 在帳號管理介面時刷新層級數據
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面時刷新代理列表
                        await this.searchAgents();
                    }
                } else {
                    this.showMessage(response.data.message || '代理创建失败', 'error');
                }
            } catch (error) {
                console.error('创建代理出錯:', error);
                this.showMessage(error.response?.data?.message || '创建代理出錯，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        // 加載点数转移记录
        async loadPointTransfers() {
            this.loading = true;
            try {
                console.log('加載点数转移记录...');
                const url = `${API_BASE_URL}/point-transfers?agentId=${this.user.id}`;
                const response = await fetch(url);
                
                if (!response.ok) {
                    console.error('加載点数转移记录失败:', response.status);
                    this.pointTransfers = [];
                    return;
                }
                
                const data = await response.json();
                if (data.success) {
                    this.pointTransfers = data.transfers || [];
                    console.log('点数转移记录载入成功，共有 ' + this.pointTransfers.length + ' 筆记录');
                } else {
                    console.error('点数转移记录數據格式错误:', data);
                    this.pointTransfers = [];
                }
            } catch (error) {
                console.error('加載点数转移记录错误:', error);
                this.pointTransfers = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 清空所有转移记录（僅用於测试）
        async clearAllTransfers() {
            if (!confirm('确定要清空所有点数转移记录嗎？此操作無法撤銷！')) {
                return;
            }
            
            this.loading = true;
            try {
                const response = await fetch(`${API_BASE_URL}/agent/clear-transfers`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.showMessage('所有转移记录已清空', 'success');
                    this.pointTransfers = [];
                } else {
                    this.showMessage(data.message || '清空记录失败', 'error');
                }
            } catch (error) {
                console.error('清空记录出錯:', error);
                this.showMessage('清空记录失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        // 新增：处理会员余额调整模態框的顯示
        adjustMemberBalance(member) {
            // 設置要修改的會員資料
            this.memberBalanceData = {
                memberId: member.id,
                memberUsername: member.username,
                currentBalance: member.balance,
                description: ''
            };
            
            // 設置默認值
            this.memberTransferType = 'deposit';
            this.memberTransferAmount = 0;
            
            console.log('會員點數轉移數據準備完成:', {
                member: member,
                user: this.user,
                memberBalanceData: this.memberBalanceData
            });
            
            // 使用Bootstrap 5標準方式顯示模態框
            const modalElement = document.getElementById('adjustMemberBalanceModal');
            if (!modalElement) {
                console.error('找不到會員點數轉移模態框元素');
                return this.showMessage('系統錯誤：找不到模態框元素', 'error');
            }
            
            // 直接使用Bootstrap 5的Modal方法
            const modal = new bootstrap.Modal(modalElement);
            this.adjustMemberBalanceModal = modal;
            modal.show();
        },

        // 計算最終會員餘額（會員點數轉移）
        calculateFinalMemberBalanceTransfer() {
            // 確保使用有效數值
            const currentBalance = parseFloat(this.memberBalanceData?.currentBalance) || 0;
            const transferAmount = parseFloat(this.memberTransferAmount) || 0;
            
            if (this.memberTransferType === 'deposit') {
                return currentBalance + transferAmount;
            } else {
                return currentBalance - transferAmount;
            }
        },
        
        // 計算最終代理餘額（會員點數轉移）
        calculateFinalAgentBalanceFromMember() {
            // 確保使用有效數值
            const currentBalance = parseFloat(this.user.balance) || 0;
            const transferAmount = parseFloat(this.memberTransferAmount) || 0;
            
            if (this.memberTransferType === 'deposit') {
                return currentBalance - transferAmount;
            } else {
                return currentBalance + transferAmount;
            }
        },

        // 設置最大轉移金額（會員點數轉移）
        setMaxMemberAmount() {
            if (this.memberTransferType === 'deposit') {
                // 存入：使用代理（自己）的全部餘額
                this.memberTransferAmount = parseFloat(this.user.balance) || 0;
            } else if (this.memberTransferType === 'withdraw') {
                // 提領：使用會員的全部餘額
                this.memberTransferAmount = parseFloat(this.memberBalanceData.currentBalance) || 0;
            }
        },

        // 隱藏會員點數轉移模態框
        hideAdjustMemberBalanceModal() {
            if (this.adjustMemberBalanceModal) {
                this.adjustMemberBalanceModal.hide();
            }
        },

        // 提交會員點數轉移
        async submitMemberBalanceTransfer() {
            console.log('嘗試提交會員點數轉移');
            if (!this.memberBalanceData.memberId || !this.memberTransferAmount) {
                console.log('資料不完整:', {
                    memberId: this.memberBalanceData.memberId,
                    transferAmount: this.memberTransferAmount,
                    description: this.memberBalanceData.description
                });
                return this.showMessage('請填寫轉移金額', 'error');
            }
            
            this.loading = true;
            console.log('開始提交會員點數轉移數據');
            
            try {
                // 準備要傳送的數據
                const payload = {
                    agentId: this.user.id,  // 當前代理ID（來源或目標）
                    memberId: this.memberBalanceData.memberId,  // 會員ID
                    amount: this.memberTransferType === 'deposit' ? this.memberTransferAmount : -this.memberTransferAmount, // 根據類型調整金額正負
                    type: this.memberTransferType, // 轉移類型 'deposit' 或 'withdraw'
                    description: this.memberBalanceData.description
                };

                console.log('準備發送的數據:', payload);
                const response = await axios.post(`${API_BASE_URL}/transfer-member-balance`, payload);
                console.log('伺服器返回結果:', response.data);
                
                if (response.data.success) {
                    this.showMessage('會員點數轉移成功', 'success');
                    // 更新前端顯示的代理餘額
                    this.user.balance = response.data.parentBalance;
                    // 同時更新localStorage中的用戶資訊
                    localStorage.setItem('agent_user', JSON.stringify(this.user));
                    // 需要重新獲取會員列表或更新特定會員的餘額
                    if (this.activeTab === 'accounts') {
                        // 在層級會員管理介面時刷新層級會員數據
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面時刷新會員列表
                        this.searchMembers();
                    }
                    this.hideAdjustMemberBalanceModal(); // 關閉模態框
                    await this.fetchDashboardData(); // 更新儀表板數據
                } else {
                    this.showMessage(response.data.message || '會員點數轉移失敗', 'error');
                }
            } catch (error) {
                console.error('提交會員點數轉移錯誤:', error);
                this.showMessage(error.response?.data?.message || '會員點數轉移失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },

        // 进入代理管理（導航到下級代理）
        async enterAgentManagement(agent) {
            // 添加到面包屑導航
            this.agentBreadcrumbs.push({
                id: this.currentManagingAgent.id,
                username: this.currentManagingAgent.username,
                level: this.currentManagingAgent.level,
                market_type: this.currentManagingAgent.market_type,
                rebate_percentage: this.currentManagingAgent.rebate_percentage,
                max_rebate_percentage: this.currentManagingAgent.max_rebate_percentage
            });
            
            // 更新当前管理代理 - 包含完整的退水比例和盤口类型资讯
            const defaultMaxRebate = agent.market_type === 'A' ? 0.011 : 0.041;
            this.currentManagingAgent = {
                id: agent.id,
                username: agent.username,
                level: agent.level,
                market_type: agent.market_type,
                rebate_percentage: agent.rebate_percentage || agent.max_rebate_percentage || defaultMaxRebate,
                max_rebate_percentage: agent.max_rebate_percentage || defaultMaxRebate
            };
            
            console.log('🔄 进入代理管理，更新currentManagingAgent:', this.currentManagingAgent);
            
            // 重新载入代理列表和会员列表（該代理的下級）
            await this.searchAgents();
            await this.searchMembers();
        },
        
        // 導航到指定代理层级
        async navigateToAgentLevel(agentId, username) {
            // 查找面包屑中的位置
            const targetIndex = this.agentBreadcrumbs.findIndex(b => b.id === agentId);
            
            if (agentId === this.user.id) {
                // 返回到自己
                this.agentBreadcrumbs = [];
                const defaultMaxRebate = this.user.market_type === 'A' ? 0.011 : 0.041;
                this.currentManagingAgent = {
                    id: this.user.id,
                    username: this.user.username,
                    level: this.user.level,
                    market_type: this.user.market_type,
                    rebate_percentage: this.user.rebate_percentage || this.user.max_rebate_percentage || defaultMaxRebate,
                    max_rebate_percentage: this.user.max_rebate_percentage || defaultMaxRebate
                };
            } else if (targetIndex >= 0) {
                // 移除該位置之後的所有面包屑
                const targetBreadcrumb = this.agentBreadcrumbs[targetIndex];
                this.agentBreadcrumbs = this.agentBreadcrumbs.slice(0, targetIndex);
                const defaultMaxRebate = targetBreadcrumb.market_type === 'A' ? 0.011 : 0.041;
                this.currentManagingAgent = {
                    id: targetBreadcrumb.id,
                    username: targetBreadcrumb.username,
                    level: targetBreadcrumb.level,
                    market_type: targetBreadcrumb.market_type,
                    rebate_percentage: targetBreadcrumb.rebate_percentage || targetBreadcrumb.max_rebate_percentage || defaultMaxRebate,
                    max_rebate_percentage: targetBreadcrumb.max_rebate_percentage || defaultMaxRebate
                };
            }
            
            console.log('🧭 導航到代理层级，更新currentManagingAgent:', this.currentManagingAgent);
            
            // 重新载入代理列表和会员列表
            await this.searchAgents();
            await this.searchMembers();
        },
        
        // 返回上級代理
        async goBackToParentLevel() {
            if (this.agentBreadcrumbs.length > 0) {
                const parentBreadcrumb = this.agentBreadcrumbs.pop();
                const defaultMaxRebate = parentBreadcrumb.market_type === 'A' ? 0.011 : 0.041;
                this.currentManagingAgent = {
                    id: parentBreadcrumb.id,
                    username: parentBreadcrumb.username,
                    level: parentBreadcrumb.level,
                    market_type: parentBreadcrumb.market_type,
                    rebate_percentage: parentBreadcrumb.rebate_percentage || parentBreadcrumb.max_rebate_percentage || defaultMaxRebate,
                    max_rebate_percentage: parentBreadcrumb.max_rebate_percentage || defaultMaxRebate
                };
            } else {
                // 返回到自己
                const defaultMaxRebate = this.user.market_type === 'A' ? 0.011 : 0.041;
                this.currentManagingAgent = {
                    id: this.user.id,
                    username: this.user.username,
                    level: this.user.level,
                    market_type: this.user.market_type,
                    rebate_percentage: this.user.rebate_percentage || this.user.max_rebate_percentage || defaultMaxRebate,
                    max_rebate_percentage: this.user.max_rebate_percentage || defaultMaxRebate
                };
            }
            
            console.log('⬆️ 返回上級代理，更新currentManagingAgent:', this.currentManagingAgent);
            
            // 重新载入代理列表和会员列表
            await this.searchAgents();
            await this.searchMembers();
        },
        
        // 顯示退水设定模態框
        showRebateSettingsModal(agent) {
            // 修復：根據當前頁面選擇正確的數據源，確保獲取最新數據
            let latestAgent;
            if (this.activeTab === 'accounts') {
                // 帳號管理頁面：從 hierarchicalMembers 中查找最新數據
                latestAgent = this.hierarchicalMembers.find(a => a.id === agent.id);
                if (!latestAgent) {
                    // 如果在層級會員中找不到，可能是代理，從 agents 中查找
                    latestAgent = this.agents.find(a => a.id === agent.id) || agent;
                }
            } else {
                // 其他頁面：從 agents 中查找最新數據
                latestAgent = this.agents.find(a => a.id === agent.id) || agent;
            }
            
            console.log('🔍 查找最新代理數據:', {
                activeTab: this.activeTab,
                searchId: agent.id,
                foundAgent: latestAgent,
                originalAgent: agent,
                agentsCount: this.agents.length,
                hierarchicalMembersCount: this.hierarchicalMembers.length
            });
            
            // 修復：正確取得上級代理的盤口類型和退水限制
            const marketType = this.currentManagingAgent.market_type || this.user.market_type || 'D';
            const defaultMaxRebate = marketType === 'A' ? 0.011 : 0.041;
            const maxRebate = this.currentManagingAgent.rebate_percentage || this.currentManagingAgent.max_rebate_percentage || defaultMaxRebate;
            
            this.rebateAgent = {
                id: latestAgent.id,
                username: latestAgent.username,
                rebate_mode: latestAgent.rebate_mode || 'percentage',
                rebate_percentage: latestAgent.rebate_percentage || 0, // 使用代理本身的退水比例，而非上級限制
                max_rebate_percentage: maxRebate // 使用上級代理的退水限制作為最大值
            };
            
            // 確保正確處理退水比例的格式轉換
            const agentRebatePercentage = parseFloat(latestAgent.rebate_percentage || 0);
            
            this.rebateSettings = {
                rebate_mode: latestAgent.rebate_mode || 'percentage',
                rebate_percentage: (agentRebatePercentage * 100).toFixed(1)
            };
            
            console.log('📋 顯示退水設定 - 使用最新代理資料:', {
                activeTab: this.activeTab,
                agentId: latestAgent.id,
                username: latestAgent.username,
                rebate_mode: latestAgent.rebate_mode,
                rebate_percentage: latestAgent.rebate_percentage,
                parsedRebatePercentage: agentRebatePercentage,
                displayPercentage: this.rebateSettings.rebate_percentage + '%',
                rebateAgent: this.rebateAgent,
                rebateSettings: this.rebateSettings
            });
            
            this.showRebateModal = true;
            this.$nextTick(() => {
                const modalEl = document.getElementById('rebateSettingsModal');
                if (modalEl) {
                    this.rebateSettingsModal = new bootstrap.Modal(modalEl);
                    this.rebateSettingsModal.show();
                }
            });
        },
        
        // 隱藏退水设定模態框
        hideRebateSettingsModal() {
            if (this.rebateSettingsModal) {
                this.rebateSettingsModal.hide();
            }
            this.showRebateModal = false;
        },
        
        // 更新退水设定
        async updateRebateSettings() {
            this.loading = true;
            try {
                const payload = {
                    rebate_mode: this.rebateSettings.rebate_mode
                };
                
                if (this.rebateSettings.rebate_mode === 'percentage') {
                    payload.rebate_percentage = parseFloat(this.rebateSettings.rebate_percentage) / 100;
                }
                
                const response = await axios.put(`${API_BASE_URL}/update-rebate-settings/${this.rebateAgent.id}`, payload);
                
                if (response.data.success) {
                    this.showMessage('退水设定更新成功', 'success');
                    this.hideRebateSettingsModal();
                    
                    // 強制刷新所有相關數據
                    console.log('🔄 強制刷新所有相關數據...');
                    
                    // 如果更新的是當前管理代理自己，更新 currentManagingAgent
                    if (this.rebateAgent.id === this.currentManagingAgent.id) {
                        console.log('🔄 更新當前管理代理的退水資料...');
                        this.currentManagingAgent.rebate_mode = response.data.agent.rebate_mode;
                        this.currentManagingAgent.rebate_percentage = response.data.agent.rebate_percentage;
                    }
                    
                    // 如果更新的是用戶自己，也更新 user 對象
                    if (this.rebateAgent.id === this.user.id) {
                        console.log('🔄 更新用戶的退水資料...');
                        this.user.rebate_mode = response.data.agent.rebate_mode;
                        this.user.rebate_percentage = response.data.agent.rebate_percentage;
                    }
                    
                    if (this.activeTab === 'accounts') {
                        // 帳號管理頁面：刷新層級會員數據
                        await this.loadHierarchicalMembers();
                    } else {
                        // 其他頁面：刷新代理數據
                        await this.searchAgents();
                    }
                    
                    // 強制觸發 Vue 響應性更新
                    this.$forceUpdate();
                    
                    console.log('✅ 數據刷新完成');
                } else {
                    this.showMessage(response.data.message || '更新退水设定失败', 'error');
                }
            } catch (error) {
                console.error('更新退水设定错误:', error);
                this.showMessage(error.response?.data?.message || '更新退水设定失败', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 获取退水模式文本
        getRebateModeText(mode) {
            switch (mode) {
                case 'all':
                    return '全拿退水';
                case 'none':
                    return '全退下級';
                case 'percentage':
                    return '自定比例';
                default:
                    return '未设定';
            }
        },

        // 新增：切換会员狀態
        async toggleMemberStatus(memberId, currentStatus) {
            // 支援三種狀態的切換：启用(1) -> 停用(0) -> 凍結(2) -> 启用(1)
            let newStatus, actionText;
            
            if (currentStatus === 1) {
                newStatus = 0;
                actionText = '停用';
            } else if (currentStatus === 0) {
                newStatus = 2;
                actionText = '凍結';
            } else {
                newStatus = 1;
                actionText = '启用';
            }
            
            if (!confirm(`确定要${actionText}該会员嗎？`)) {
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-member-status`, { memberId, status: newStatus });
                if (response.data.success) {
                    this.showMessage(`会员已${actionText}`, 'success');
                    
                    // 立即更新本地会员列表中的狀態
                    const member = this.members.find(m => m.id === memberId);
                    if (member) {
                        member.status = newStatus;
                    }
                    
                    // 如果在帳號管理頁面，也更新層級管理中的會員狀態
                    if (this.activeTab === 'accounts' && this.hierarchicalMembers) {
                        const hierarchicalMember = this.hierarchicalMembers.find(m => m.id === memberId);
                        if (hierarchicalMember) {
                            hierarchicalMember.status = newStatus;
                        }
                    }
                    
                    // 重新載入會員列表以確保狀態同步
                    if (this.activeTab === 'accounts') {
                        // 在層級會員管理介面時刷新層級會員數據
                        await this.refreshHierarchicalMembers();
                    } else if (this.activeTab === 'accounts') {
                        // 在帳號管理頁面時，重新載入當前層級的數據
                        await this.loadHierarchicalMembers();
                    } else {
                        // 在其他介面時刷新會員列表
                        await this.searchMembers();
                    }
                } else {
                    this.showMessage(response.data.message || `${actionText}会员失败`, 'error');
                }
            } catch (error) {
                console.error(`${actionText}会员出錯:`, error);
                this.showMessage(error.response?.data?.message || `${actionText}会员失败，请稍後再試`, 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 获取狀態文字
        getStatusText(status) {
            switch (parseInt(status)) {
                case 1:
                    return '启用';
                case 0:
                    return '停用';
                case 2:
                    return '凍結';
                default:
                    return '未知';
            }
        },
        
        // 获取狀態徽章樣式類別
        getStatusBadgeClass(status) {
            switch (parseInt(status)) {
                case 1:
                    return 'badge bg-success'; // 绿色 - 启用
                case 0:
                    return 'badge bg-secondary'; // 灰色 - 停用
                case 2:
                    return 'badge bg-warning text-dark'; // 黄色 - 凍結
                default:
                    return 'badge bg-dark'; // 黑色 - 未知狀態
            }
        },
        
        // 获取狀態圖標類別
        getStatusIconClass(status) {
            switch (parseInt(status)) {
                case 1:
                    return 'fa-check'; // 勾選 - 启用
                case 0:
                    return 'fa-ban'; // 禁止 - 停用
                case 2:
                    return 'fa-snowflake'; // 雪花 - 凍結
                default:
                    return 'fa-question'; // 問號 - 未知狀態
            }
        },
        
        // 修改会员额度
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
                    console.error('找不到修改会员额度模態框元素');
                    this.showMessage('系统错误，请稍後再試', 'error');
                }
            });
        },
        
        // 隱藏修改会员额度模態框
        hideModifyMemberBalanceModal() {
            if (this.modifyMemberBalanceModal) {
                this.modifyMemberBalanceModal.hide();
            }
        },
        
        // 计算最终修改後的会员余额
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
        
        // 提交修改会员额度
        async submitModifyMemberBalance() {
            if (!this.modifyBalanceData.memberId || !this.modifyBalanceAmount || !this.modifyBalanceData.reason) {
                return this.showMessage('请填寫完整资料', 'error');
            }
            
            // 检查修改後的金额是否合理
            const finalBalance = this.calculateFinalModifiedBalance();
            if (finalBalance < 0) {
                return this.showMessage('修改後的额度不能小於0', 'error');
            }
            
            this.loading = true;
            
            try {
                // 准备發送到後端的數據
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
                    this.showMessage('会员额度修改成功', 'success');
                    this.hideModifyMemberBalanceModal();
                    // 根據當前介面決定刷新方式
                    if (this.activeTab === 'accounts') {
                        // 在層級會員管理介面時刷新層級會員數據
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面時刷新會員列表
                        this.searchMembers();
                    }
                } else {
                    this.showMessage(response.data.message || '会员额度修改失败', 'error');
                }
            } catch (error) {
                console.error('修改会员额度错误:', error);
                this.showMessage(error.response?.data?.message || '会员额度修改失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 删除会员
        async deleteMember(memberId, username) {
            if (!confirm(`⚠️ 警告：确定要永久删除会员 ${username} 嗎？\n\n此操作將：\n✓ 完全從系统中移除該会员\n✓ 無法恢复任何數據\n✓ 必須确保会员余额為0\n\n请确认您真的要执行此不可逆操作！`)) {
                return;
            }
            
            this.loading = true;
            
            try {
                const response = await axios.delete(`${API_BASE_URL}/delete-member/${memberId}`);
                
                if (response.data.success) {
                    this.showMessage('会员删除成功', 'success');
                    // 根據當前介面決定刷新方式
                    if (this.activeTab === 'accounts') {
                        // 在層級會員管理介面時刷新層級會員數據
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面時刷新會員列表
                        this.searchMembers();
                    }
                } else {
                    this.showMessage(response.data.message || '会员删除失败', 'error');
                }
            } catch (error) {
                console.error('删除会员错误:', error);
                // 提取具體的错误信息
                let errorMessage = '会员删除失败，请稍後再試';
                if (error.response?.data?.message) {
                    errorMessage = error.response.data.message;
                } else if (error.message) {
                    errorMessage = error.message;
                }
                this.showMessage(errorMessage, 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 代理额度修改相关方法
        adjustAgentBalance(agent) {
            // 设置要修改的代理资料
            this.agentBalanceData = {
                agentId: agent.id,
                agentUsername: agent.username,
                currentBalance: agent.balance,
                description: ''
            };
            
            // 设置默認值
            this.agentTransferType = 'deposit';
            this.agentTransferAmount = 0;
            
            console.log('代理点数转移數據准备完成:', {
                agent: agent,
                user: this.user,
                agentBalanceData: this.agentBalanceData
            });
            
            // 使用Bootstrap 5標準方式顯示模態框
            const modalElement = document.getElementById('adjustAgentBalanceModal');
            if (!modalElement) {
                console.error('找不到模態框元素');
                return this.showMessage('系统错误：找不到模態框元素', 'error');
            }
            
            // 直接使用Bootstrap 5的Modal方法
            const modal = new bootstrap.Modal(modalElement);
            this.adjustAgentBalanceModal = modal;
            modal.show();
        },
        
        // 计算最终下級代理余额
        calculateFinalSubAgentBalance() {
            // 确保使用有效數值
            const currentBalance = parseFloat(this.agentBalanceData?.currentBalance) || 0;
            const transferAmount = parseFloat(this.agentTransferAmount) || 0;
            
            if (this.agentTransferType === 'deposit') {
                return currentBalance + transferAmount;
            } else {
                return currentBalance - transferAmount;
            }
        },
        
        // 计算最终上級代理(自己)余额
        calculateFinalParentAgentBalance() {
            // 确保使用有效數值
            const currentBalance = parseFloat(this.user.balance) || 0;
            const transferAmount = parseFloat(this.agentTransferAmount) || 0;
            
            if (this.agentTransferType === 'deposit') {
                return currentBalance - transferAmount;
            } else {
                return currentBalance + transferAmount;
            }
        },

        // 设置最大转移金额（代理点数转移）
        setMaxAgentAmount() {
            if (this.agentTransferType === 'deposit') {
                // 存入：使用上級代理（自己）的全部余额
                this.agentTransferAmount = parseFloat(this.user.balance) || 0;
            } else if (this.agentTransferType === 'withdraw') {
                // 提领：使用下級代理的全部余额
                this.agentTransferAmount = parseFloat(this.agentBalanceData.currentBalance) || 0;
            }
        },
        
        // 切換代理狀態
        async toggleAgentStatus(agent) {
            // 支援三種狀態的切換：启用(1) -> 停用(0) -> 凍結(2) -> 启用(1)
            let newStatus, actionText;
            
            if (agent.status === 1) {
                newStatus = 0;
                actionText = '停用';
            } else if (agent.status === 0) {
                newStatus = 2;
                actionText = '凍結';
            } else {
                newStatus = 1;
                actionText = '启用';
            }
            
            if (!confirm(`确定要${actionText}該代理嗎？`)) {
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
                    // 根據當前介面決定刷新方式
                    if (this.activeTab === 'accounts') {
                        // 在層級會員管理介面時刷新層級會員數據
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面時刷新代理列表
                        await this.searchAgents();
                    }
                } else {
                    this.showMessage(response.data.message || `${actionText}代理失败`, 'error');
                }
            } catch (error) {
                console.error(`${actionText}代理出錯:`, error);
                this.showMessage(error.response?.data?.message || `${actionText}代理失败，请稍後再試`, 'error');
            } finally {
                this.loading = false;
            }
        },

        // 直接設定代理狀態（新的下拉選單功能）
        async changeAgentStatus(agent, newStatus) {
            const statusNames = { 1: '启用', 0: '停用', 2: '凍結' };
            const actionText = statusNames[newStatus];
            
            if (!confirm(`确定要将代理 ${agent.username} 设为${actionText}状态嗎？`)) {
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-agent-status`, { 
                    agentId: agent.id, 
                    status: newStatus 
                });
                
                if (response.data.success) {
                    this.showMessage(`代理已设为${actionText}`, 'success');
                    
                    // 立即更新本地代理列表中的狀態
                    const agentInList = this.agents.find(a => a.id === agent.id);
                    if (agentInList) {
                        agentInList.status = newStatus;
                    }
                    
                    // 如果在帳號管理頁面，也更新層級管理中的代理狀態
                    if (this.activeTab === 'accounts' && this.hierarchicalMembers) {
                        const hierarchicalAgent = this.hierarchicalMembers.find(a => a.id === agent.id);
                        if (hierarchicalAgent) {
                            hierarchicalAgent.status = newStatus;
                        }
                    }
                    
                    // 根據當前介面決定是否需要重新載入數據
                    if (this.activeTab === 'accounts') {
                        // 在層級會員管理介面時刷新層級會員數據
                        await this.refreshHierarchicalMembers();
                    } else if (this.activeTab === 'accounts') {
                        // 在帳號管理頁面時，重新載入當前層級的數據
                        await this.loadHierarchicalMembers();
                    } else {
                        // 在其他介面時刷新代理列表
                        await this.searchAgents();
                    }
                } else {
                    this.showMessage(response.data.message || `设置代理状态失败`, 'error');
                }
            } catch (error) {
                console.error(`设置代理状态出錯:`, error);
                this.showMessage(error.response?.data?.message || `设置代理状态失败，请稍後再試`, 'error');
            } finally {
                this.loading = false;
            }
        },

        // 直接設定會員狀態（新的下拉選單功能）
        async changeMemberStatus(member, newStatus) {
            const statusNames = { 1: '启用', 0: '停用', 2: '凍結' };
            const actionText = statusNames[newStatus];
            
            if (!confirm(`确定要将会员 ${member.username} 设为${actionText}状态嗎？`)) {
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/toggle-member-status`, { 
                    memberId: member.id, 
                    status: newStatus 
                });
                
                if (response.data.success) {
                    this.showMessage(`会员已设为${actionText}`, 'success');
                    
                    // 立即更新本地會員列表中的狀態
                    const memberInList = this.members.find(m => m.id === member.id);
                    if (memberInList) {
                        memberInList.status = newStatus;
                    }
                    
                    // 如果在帳號管理頁面，也更新層級管理中的會員狀態
                    if (this.activeTab === 'accounts' && this.hierarchicalMembers) {
                        const hierarchicalMember = this.hierarchicalMembers.find(m => m.id === member.id);
                        if (hierarchicalMember) {
                            hierarchicalMember.status = newStatus;
                        }
                    }
                    
                    // 根據當前介面決定是否需要重新載入數據
                    if (this.activeTab === 'accounts') {
                        // 在層級會員管理介面時刷新層級會員數據
                        await this.refreshHierarchicalMembers();
                    } else if (this.activeTab === 'accounts') {
                        // 在帳號管理頁面時，重新載入當前層級的數據
                        await this.loadHierarchicalMembers();
                    } else {
                        // 在其他介面時刷新會員列表
                        await this.searchMembers();
                    }
                } else {
                    this.showMessage(response.data.message || `设置会员状态失败`, 'error');
                }
            } catch (error) {
                console.error(`设置会员状态出錯:`, error);
                this.showMessage(error.response?.data?.message || `设置会员状态失败，请稍後再試`, 'error');
            } finally {
                this.loading = false;
            }
        },

        // 編輯代理備註
        editAgentNotes(agent) {
            console.log('editAgentNotes 方法被調用，agent:', agent);
            
            this.editNotesData = {
                id: agent.id,
                username: agent.username,
                notes: agent.notes || '',
                type: 'agent'
            };
            
            // 確保在下一個tick執行，讓Vue完成渲染
            this.$nextTick(() => {
                // 使用已初始化的Modal實例，如果沒有則重新創建
                if (!this.editAgentNotesModal) {
                    const modalEl = document.getElementById('editAgentNotesModal');
                    if (modalEl) {
                        // 檢查Bootstrap是否可用
                        if (typeof bootstrap === 'undefined') {
                            console.error('Bootstrap未加載');
                            this.showMessage('系統組件未完全加載，請重新整理頁面', 'error');
                            return;
                        }
                        this.editAgentNotesModal = new bootstrap.Modal(modalEl);
                    } else {
                        console.error('找不到editAgentNotesModal元素');
                        this.showMessage('系統錯誤，請重新整理頁面', 'error');
                        return;
                    }
                }
                
                try {
                    this.editAgentNotesModal.show();
                } catch (error) {
                    console.error('顯示Modal時出錯:', error);
                    this.showMessage('無法打開備註編輯視窗，請重新整理頁面', 'error');
                }
            });
        },

        // 隱藏編輯代理備註模態框
        hideEditAgentNotesModal() {
            if (this.editAgentNotesModal) {
                this.editAgentNotesModal.hide();
            }
            this.editNotesData = {
                id: null,
                username: '',
                notes: '',
                type: ''
            };
        },

        // 更新代理備註
        async updateAgentNotes() {
            if (!this.editNotesData.id) {
                this.showMessage('無效的代理ID', 'error');
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/update-agent-notes`, {
                    agentId: this.editNotesData.id,
                    notes: this.editNotesData.notes || ''
                });

                if (response.data.success) {
                    this.showMessage('代理備註更新成功', 'success');
                    
                    // 更新本地代理列表中的備註
                    const agentInList = this.agents.find(a => a.id === this.editNotesData.id);
                    if (agentInList) {
                        agentInList.notes = this.editNotesData.notes;
                    }
                    
                    this.hideEditAgentNotesModal();
                    // 根據當前介面決定刷新方式
                    if (this.activeTab === 'accounts') {
                        // 在層級會員管理介面時刷新層級會員數據
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面時刷新代理列表
                        await this.searchAgents();
                    }
                } else {
                    this.showMessage(response.data.message || '更新代理備註失敗', 'error');
                }
            } catch (error) {
                console.error('更新代理備註錯誤:', error);
                this.showMessage(error.response?.data?.message || '更新代理備註失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },

        // 編輯會員備註
        editMemberNotes(member) {
            console.log('🔧 editMemberNotes 方法被調用，member:', member);
            
            // 重置loading狀態
            this.loading = false;
            
            // 確保數據設置正確
            this.editNotesData = {
                id: member.id,
                username: member.username,
                notes: member.notes || '',
                type: 'member'
            };
            
            console.log('🔧 設置editNotesData:', this.editNotesData);
            
            // 使用Vue.js反應式方式顯示模態框
            this.showEditMemberNotesModal = true;
            
            // 添加背景和防止滾動
            this.$nextTick(() => {
                // 添加模態框背景
                if (!document.querySelector('.modal-backdrop')) {
                    const backdrop = document.createElement('div');
                    backdrop.className = 'modal-backdrop fade show';
                    document.body.appendChild(backdrop);
                }
                
                // 防止背景滾動
                document.body.classList.add('modal-open');
                document.body.style.paddingRight = '17px';
                
                console.log('🔧 會員備註模態框已顯示，Vue綁定應該正常工作');
            });
        },

        // 隱藏編輯會員備註模態框
        hideEditMemberNotesModal() {
            console.log('🔧 hideEditMemberNotesModal 方法被調用');
            
            // 重置Vue.js狀態
            this.showEditMemberNotesModal = false;
            this.loading = false;
            
            // 移除模態框背景和body樣式
            document.body.classList.remove('modal-open');
            document.body.style.paddingRight = '';
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
            
            // 清理編輯數據
            this.editNotesData = {
                id: null,
                username: '',
                notes: '',
                type: ''
            };
            
            console.log('🔧 會員備註模態框已隱藏，數據已重置');
        },

        // 更新會員備註
        async updateMemberNotes() {
            if (!this.editNotesData.id) {
                this.showMessage('無效的會員ID', 'error');
                return;
            }

            this.loading = true;
            try {
                const response = await axios.post(`${API_BASE_URL}/update-member-notes`, {
                    memberId: this.editNotesData.id,
                    notes: this.editNotesData.notes || ''
                });

                if (response.data.success) {
                    this.showMessage('會員備註更新成功', 'success');
                    
                    // 更新本地會員列表中的備註
                    const memberInList = this.members.find(m => m.id === this.editNotesData.id);
                    if (memberInList) {
                        memberInList.notes = this.editNotesData.notes;
                    }
                    
                    this.hideEditMemberNotesModal();
                    
                    // 根據當前介面決定刷新方式
                    if (this.activeTab === 'accounts') {
                        // 在層級會員管理介面時刷新層級會員數據
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面時刷新會員列表
                        await this.searchMembers();
                    }
                } else {
                    this.showMessage(response.data.message || '更新會員備註失敗', 'error');
                }
            } catch (error) {
                console.error('更新會員備註錯誤:', error);
                this.showMessage(error.response?.data?.message || '更新會員備註失敗，請稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 隱藏代理额度修改模態框
        hideAdjustAgentBalanceModal() {
            console.log('嘗試隱藏代理点数转移模態框');
            try {
                if (this.adjustAgentBalanceModal) {
                    console.log('找到模態框實例，嘗試隱藏');
                    this.adjustAgentBalanceModal.hide();
                    console.log('模態框隱藏方法已調用');
                } else {
                    console.log('找不到模態框實例，嘗試手動隱藏');
                    const modalEl = document.getElementById('adjustAgentBalanceModal');
                    if (modalEl) {
                        modalEl.style.display = 'none';
                        modalEl.classList.remove('show');
                        document.body.classList.remove('modal-open');
                        const backdrop = document.querySelector('.modal-backdrop');
                        if (backdrop) backdrop.remove();
                        console.log('已手動隱藏模態框');
                    }
                }
            } catch (error) {
                console.error('隱藏模態框時出錯:', error);
            }
        },
        
        // 计算最终代理余额（代理额度修改用）
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
        
        // 提交代理额度修改
        async submitAgentBalanceAdjustment() {
            console.log('嘗試提交代理点数转移');
            if (!this.agentBalanceData.agentId || !this.agentTransferAmount) {
                console.log('资料不完整:', {
                    agentId: this.agentBalanceData.agentId,
                    transferAmount: this.agentTransferAmount,
                    description: this.agentBalanceData.description
                });
                return this.showMessage('请填寫转移金额', 'error');
            }
            
            this.loading = true;
            console.log('开始提交代理点数转移數據');
            
            try {
                // 准备要傳送的數據
                const payload = {
                    agentId: this.user.id,  // 当前代理ID（來源或目標）
                    subAgentId: this.agentBalanceData.agentId,  // 下級代理ID
                    amount: this.agentTransferType === 'deposit' ? this.agentTransferAmount : -this.agentTransferAmount, // 根據類型调整金额正負
                    type: this.agentTransferType, // 转移類型 'deposit' 或 'withdraw'
                    description: this.agentBalanceData.description
                };

                console.log('准备發送的數據:', payload);
                const response = await axios.post(`${API_BASE_URL}/transfer-agent-balance`, payload);
                console.log('伺服器返回结果:', response.data);
                
                if (response.data.success) {
                    this.showMessage('代理点数转移成功', 'success');
                    // 更新前端顯示的代理余额
                    this.user.balance = response.data.parentBalance;
                    // 同时更新localStorage中的用戶资讯
                    localStorage.setItem('agent_user', JSON.stringify(this.user));
                    // 根據當前介面決定刷新方式
                    if (this.activeTab === 'accounts') {
                        // 在層級會員管理介面時刷新層級會員數據
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面時刷新代理列表
                        await this.searchAgents();
                    }
                    this.hideAdjustAgentBalanceModal(); // 关闭模態框
                    await this.fetchDashboardData(); // 更新儀表板數據
                } else {
                    this.showMessage(response.data.message || '代理点数转移失败', 'error');
                }
            } catch (error) {
                console.error('提交代理点数转移错误:', error);
                this.showMessage(error.response?.data?.message || '代理点数转移失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 删除代理
        async deleteAgent(agentId, username) {
            if (!confirm(`⚠️ 警告：确定要永久删除代理 ${username} 嗎？\n\n此操作將：\n✓ 完全從系统中移除該代理\n✓ 無法恢复任何數據\n✓ 必須确保代理余额為0且無下級代理/会员\n\n请确认您真的要执行此不可逆操作！`)) {
                return;
            }
            
            this.loading = true;
            
            try {
                const response = await axios.delete(`${API_BASE_URL}/delete-agent/${agentId}`);
                
                if (response.data.success) {
                    this.showMessage('代理删除成功', 'success');
                    // 根據當前介面決定刷新方式
                    if (this.activeTab === 'accounts') {
                        // 在層級會員管理介面時刷新層級會員數據
                        await this.refreshHierarchicalMembers();
                    } else {
                        // 在其他介面時刷新代理列表
                        await this.searchAgents();
                    }
                } else {
                    this.showMessage(response.data.message || '代理删除失败', 'error');
                }
            } catch (error) {
                console.error('删除代理错误:', error);
                // 提取具體的错误信息
                let errorMessage = '代理删除失败，请稍後再試';
                if (error.response?.data?.message) {
                    errorMessage = error.response.data.message;
                } else if (error.message) {
                    errorMessage = error.message;
                }
                this.showMessage(errorMessage, 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 改變頁碼
        changePage(page, type) {
            if (page < 1) return;
            
            switch (type) {
                case 'agents':
                    if (page > this.agentPagination.totalPages) return;
                    this.agentPagination.currentPage = page;
                    this.searchAgents();
                    break;
                case 'members':
                    if (page > this.memberPagination.totalPages) return;
                    this.memberPagination.currentPage = page;
                    this.searchMembers();
                    break;
                case 'draw':
                    if (page > this.drawPagination.totalPages) return;
                    this.drawPagination.currentPage = page;
                    this.searchDrawHistory();
                    break;
                case 'bets':
                    if (page > this.betPagination.totalPages) return;
                    this.betPagination.currentPage = page;
                    this.searchBets();
                    break;
                default:
                    console.warn('未知的分頁類型:', type);
            }
        },
        
        // 格式化佣金比例顯示

        
        // 格式化投注選項顯示
        formatBetValue(value) {
            if (!value) return '-';
            
            // 處理龍虎投注格式：dragon_1_10 -> 龍(冠軍vs第10名)
            if (value && value.includes('_')) {
                const parts = value.split('_');
                if (parts.length === 3 && (parts[0] === 'dragon' || parts[0] === 'tiger')) {
                    const dragonTiger = parts[0] === 'dragon' ? '龍' : '虎';
                    const pos1 = parts[1] === '1' ? '冠軍' : parts[1] === '2' ? '亞軍' : `第${parts[1]}名`;
                    const pos2 = parts[2] === '10' ? '第十名' : `第${parts[2]}名`;
                    return `${dragonTiger}(${pos1}vs${pos2})`;
                }
            }
            
            const valueMap = {
                // 大小
                'big': '大',
                'small': '小',
                // 單雙
                'odd': '單',
                'even': '雙',
                // 龍虎
                'dragon': '龍',
                'tiger': '虎',
                // 和值相关
                'sumBig': '总和大',
                'sumSmall': '总和小',
                'sumOdd': '总和單',
                'sumEven': '总和雙',
            };
            
            // 如果是純數字，直接返回
            if (!isNaN(value) && !isNaN(parseFloat(value))) {
                return value;
            }
            
            // 查找對應的中文翻譯
            return valueMap[value] || value;
        },
        
        // 客服專用方法
        async loadAllAgents() {
            try {
                this.loading = true;
                console.log('开始加載所有代理...');
                // 遞歸获取所有代理
                const response = await axios.get(`${API_BASE_URL}/sub-agents`, {
                    params: {
                        parentId: '', // 空值获取所有代理
                        level: -1,
                        status: -1,
                        page: 1,
                        limit: 1000 // 设置較大的limit获取所有代理
                    }
                });
                
                console.log('API響應:', response.data);
                
                if (response.data.success) {
                    this.allAgents = response.data.data.list || [];
                    console.log('加載所有代理成功:', this.allAgents.length, this.allAgents);
                    
                    // 确保每個代理都有正确的屬性
                    this.allAgents.forEach((agent, index) => {
                        console.log(`代理 ${index}:`, {
                            id: agent.id,
                            username: agent.username,
                            level: agent.level,
                            balance: agent.balance,
                            levelName: this.getLevelName(agent.level),
                            formattedBalance: this.formatMoney(agent.balance)
                        });
                        
                        // 确保數據類型正确
                        agent.balance = parseFloat(agent.balance) || 0;
                        agent.level = parseInt(agent.level) || 0;
                    });
                    
                    // 手動更新代理选择下拉列表
                    this.updateAgentSelect();
                } else {
                    console.error('API返回失败:', response.data.message);
                    this.showMessage('加載代理列表失败', 'error');
                }
            } catch (error) {
                console.error('加載所有代理出錯:', error);
                this.showMessage('加載代理列表出錯', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        async loadCSTransactions(page = 1) {
            if (!this.isCustomerService) return;
            
            try {
                this.loading = true;
                // 确保 page 是一個有效的數字
                const pageNum = parseInt(page) || 1;
                const response = await axios.get(`${API_BASE_URL}/cs-transactions`, {
                    params: {
                        operatorId: this.user.id,
                        page: pageNum,
                        limit: this.csTransactionsPagination.limit,
                        userType: this.csTransactionFilters.userType,
                        transactionType: this.csTransactionFilters.transactionType
                    }
                });
                
                if (response.data.success) {
                    this.csTransactions = response.data.data.list || [];
                    this.csTransactionsPagination = {
                        page: response.data.data.page,
                        limit: response.data.data.limit,
                        total: response.data.data.total
                    };
                    console.log('加載客服交易记录成功:', this.csTransactions.length);
                } else {
                    this.showMessage(response.data.message || '加載客服交易记录失败', 'error');
                }
            } catch (error) {
                console.error('加載客服交易记录出錯:', error);
                this.showMessage('加載客服交易记录出錯', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 輸贏控制相關方法
        
        // 載入輸贏控制列表
        async loadWinLossControls(page = 1) {
            try {
                this.loading = true;
                console.log('載入輸贏控制列表...');
                
                // 🔧 確保認證標頭設置正確
                const headers = {};
                const sessionToken = localStorage.getItem('agent_session_token');
                const legacyToken = localStorage.getItem('agent_token');
                
                if (sessionToken) {
                    headers['x-session-token'] = sessionToken;
                    headers['X-Session-Token'] = sessionToken; // 確保大小寫兼容
                }
                if (legacyToken) {
                    headers['Authorization'] = legacyToken;
                }
                
                console.log('🔐 使用認證標頭:', { hasSessionToken: !!sessionToken, hasLegacyToken: !!legacyToken });
                
                const response = await axios.get(`${API_BASE_URL}/win-loss-control?page=${page}&limit=20`, { headers });
                
                if (response.data.success) {
                    this.winLossControls = response.data.data || [];
                    console.log('輸贏控制列表載入成功:', this.winLossControls.length, '項記錄');
                    
                    // 同時載入當前活躍控制、用戶清單和期數信息
                    await Promise.all([
                        this.loadActiveWinLossControl(),
                        this.loadAvailableAgents(),
                        this.loadAvailableMembers(),
                        this.loadCurrentPeriod()
                    ]);
                } else {
                    console.error('載入輸贏控制列表失敗:', response.data.message);
                    this.showMessage('載入控制列表失敗: ' + response.data.message, 'error');
                }
            } catch (error) {
                console.error('載入輸贏控制列表錯誤:', error);
                
                // 🔧 特殊處理401錯誤
                if (error.response?.status === 401) {
                    console.warn('⚠️ 認證失敗，嘗試重新認證...');
                    this.showMessage('會話已過期，請重新登入', 'warning');
                    
                    // 清除過期的認證信息
                    delete axios.defaults.headers.common['Authorization'];
                    delete axios.defaults.headers.common['x-session-token'];
                    
                    // 提示用戶重新登入
                    setTimeout(() => {
                        this.logout();
                    }, 2000);
                } else {
                    this.showMessage('載入控制列表時發生錯誤', 'error');
                }
            } finally {
                this.loading = false;
            }
        },
        
        // 載入可用代理清單
        async loadAvailableAgents() {
            try {
                // 🔧 確保認證標頭設置正確
                const headers = {};
                const sessionToken = localStorage.getItem('agent_session_token');
                const legacyToken = localStorage.getItem('agent_token');
                
                if (sessionToken) {
                    headers['x-session-token'] = sessionToken;
                    headers['X-Session-Token'] = sessionToken;
                }
                if (legacyToken) {
                    headers['Authorization'] = legacyToken;
                }
                
                const response = await axios.get(`${API_BASE_URL}/win-loss-control/agents`, { headers });
                if (response.data.success) {
                    this.availableAgents = response.data.data || [];
                    console.log('載入代理清單成功:', this.availableAgents.length, '個代理');
                }
            } catch (error) {
                console.error('載入代理清單錯誤:', error);
            }
        },
        
        // 載入可用會員清單
        async loadAvailableMembers() {
            try {
                // 🔧 確保認證標頭設置正確
                const headers = {};
                const sessionToken = localStorage.getItem('agent_session_token');
                const legacyToken = localStorage.getItem('agent_token');
                
                if (sessionToken) {
                    headers['x-session-token'] = sessionToken;
                    headers['X-Session-Token'] = sessionToken;
                }
                if (legacyToken) {
                    headers['Authorization'] = legacyToken;
                }
                
                const response = await axios.get(`${API_BASE_URL}/win-loss-control/members`, { headers });
                if (response.data.success) {
                    this.availableMembers = response.data.data || [];
                    console.log('載入會員清單成功:', this.availableMembers.length, '個會員');
                }
            } catch (error) {
                console.error('載入會員清單錯誤:', error);
            }
        },
        
        // 載入當前期數信息
        async loadCurrentPeriod() {
            try {
                const response = await axios.get(`${API_BASE_URL}/win-loss-control/current-period`);
                if (response.data.success) {
                    this.currentPeriodInfo = response.data.data;
                    // 自動設定建議的開始期數
                    this.newWinLossControl.start_period = this.currentPeriodInfo.suggested_start;
                    console.log('載入期數信息成功:', this.currentPeriodInfo);
                }
            } catch (error) {
                console.error('載入期數信息錯誤:', error);
            }
        },
        
        // 載入當前活躍的輸贏控制
        async loadActiveWinLossControl() {
            try {
                // 🔧 確保認證標頭設置正確
                const headers = {};
                const sessionToken = localStorage.getItem('agent_session_token');
                const legacyToken = localStorage.getItem('agent_token');
                
                if (sessionToken) {
                    headers['x-session-token'] = sessionToken;
                    headers['X-Session-Token'] = sessionToken;
                }
                if (legacyToken) {
                    headers['Authorization'] = legacyToken;
                }
                
                const response = await axios.get(`${API_BASE_URL}/win-loss-control/active`, { headers });
                
                if (response.data.success) {
                    this.activeWinLossControl = response.data.data || { control_mode: 'normal', is_active: false };
                    console.log('當前活躍控制:', this.activeWinLossControl);
                } else {
                    console.error('載入活躍控制失敗:', response.data.message);
                }
            } catch (error) {
                console.error('載入活躍控制錯誤:', error);
            }
        },
        
        // 創建輸贏控制
        async createWinLossControl() {
            try {
                this.loading = true;
                console.log('創建輸贏控制:', this.newWinLossControl);
                
                const response = await axios.post(`${API_BASE_URL}/win-loss-control`, this.newWinLossControl);
                
                if (response.data.success) {
                    this.showMessage('輸贏控制設定成功', 'success');
                    
                    // 重新載入列表和活躍控制
                    await this.loadWinLossControls();
                    
                    // 重置表單
                    this.newWinLossControl = {
                        control_mode: 'normal',
                        target_type: '',
                        target_username: '',
                        control_percentage: 50,
                        win_control: false,
                        loss_control: false,
                        start_period: this.currentPeriodInfo.suggested_start
                    };
                } else {
                    this.showMessage('設定失敗: ' + response.data.message, 'error');
                }
            } catch (error) {
                console.error('創建輸贏控制錯誤:', error);
                this.showMessage('設定時發生錯誤', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 啟用輸贏控制
        async activateWinLossControl(controlId) {
            try {
                console.log('啟用輸贏控制:', controlId);
                
                const response = await axios.put(`${API_BASE_URL}/win-loss-control/${controlId}`, {
                    is_active: true
                });
                
                if (response.data.success) {
                    this.showMessage('控制已啟用', 'success');
                    await this.loadWinLossControls();
                } else {
                    this.showMessage('啟用失敗: ' + response.data.message, 'error');
                }
            } catch (error) {
                console.error('啟用輸贏控制錯誤:', error);
                this.showMessage('啟用時發生錯誤', 'error');
            }
        },
        
        // 停用輸贏控制
        async deactivateWinLossControl(controlId) {
            try {
                console.log('停用輸贏控制:', controlId);
                
                const response = await axios.put(`${API_BASE_URL}/win-loss-control/${controlId}`, {
                    is_active: false
                });
                
                if (response.data.success) {
                    this.showMessage('控制已停用', 'success');
                    await this.loadWinLossControls();
                } else {
                    this.showMessage('停用失敗: ' + response.data.message, 'error');
                }
            } catch (error) {
                console.error('停用輸贏控制錯誤:', error);
                this.showMessage('停用時發生錯誤', 'error');
            }
        },
        
        // 刪除輸贏控制
        async deleteWinLossControl(controlId) {
            try {
                if (!confirm('確定要刪除此輸贏控制設定嗎？')) {
                    return;
                }
                
                console.log('刪除輸贏控制:', controlId);
                
                const response = await axios.delete(`${API_BASE_URL}/win-loss-control/${controlId}`);
                
                if (response.data.success) {
                    this.showMessage('控制設定已刪除', 'success');
                    await this.loadWinLossControls();
                } else {
                    this.showMessage('刪除失敗: ' + response.data.message, 'error');
                }
            } catch (error) {
                console.error('刪除輸贏控制錯誤:', error);
                this.showMessage('刪除時發生錯誤', 'error');
            }
        },
        
        // 獲取控制模式文字
        getControlModeText(mode) {
            const modes = {
                'normal': '正常機率',
                'agent_line': '代理線控制',
                'single_member': '單會員控制',
                'auto_detect': '自動偵測控制'
            };
            return modes[mode] || mode;
        },
        
        // 顯示客服操作模態框
        async showCSOperationModalFunc() {
            console.log('=== 开始顯示客服操作模態框 ===');
            
            // 重置表單數據
            this.csOperation = {
                targetAgentId: '',
                operationTarget: '',
                targetMemberId: '',
                transferType: '',
                amount: '',
                description: ''
            };
            this.agentMembers = [];
            
            console.log('当前allAgents數量:', this.allAgents.length);
            
            // 确保代理列表已加載
            if (this.allAgents.length === 0) {
                console.log('代理列表為空，开始加載...');
                await this.loadAllAgents();
            }
            
            console.log('加載後allAgents數量:', this.allAgents.length);
            console.log('allAgents內容:', this.allAgents);
            
            // 手動更新代理选择列表
            this.updateAgentSelect();
            
            // 顯示模態框
            if (this.csOperationModal) {
                this.csOperationModal.show();
            } else {
                // 如果模態框還沒初始化，先初始化再顯示
                const csOperationModalEl = document.getElementById('csOperationModal');
                if (csOperationModalEl) {
                    this.csOperationModal = new bootstrap.Modal(csOperationModalEl);
                    this.csOperationModal.show();
                }
            }
            
            // 设置初始操作對象（默認為代理）
            setTimeout(() => {
                const targetAgent = document.getElementById('csTargetAgent');
                if (targetAgent) {
                    targetAgent.checked = true;
                    this.csOperation.operationTarget = 'agent';
                    this.onOperationTargetChange();
                }
            }, 200);
            
            // 添加事件監聽器
            setTimeout(() => {
                const targetAgent = document.getElementById('csTargetAgent');
                const targetMember = document.getElementById('csTargetMember');
                const agentSelect = document.getElementById('agentSelect');
                const memberSelect = document.getElementById('memberSelect');
                const amountInput = document.getElementById('amountInput');
                const depositRadio = document.getElementById('csDeposit');
                const withdrawRadio = document.getElementById('csWithdraw');
                
                // 移除之前的事件監聽器（避免重複）
                if (targetAgent) {
                    targetAgent.removeEventListener('change', this.handleOperationTargetChange);
                    targetAgent.addEventListener('change', this.handleOperationTargetChange.bind(this));
                }
                if (targetMember) {
                    targetMember.removeEventListener('change', this.handleOperationTargetChange);
                    targetMember.addEventListener('change', this.handleOperationTargetChange.bind(this));
                }
                if (agentSelect) {
                    agentSelect.removeEventListener('change', this.handleAgentSelectionChange);
                    agentSelect.addEventListener('change', this.handleAgentSelectionChange.bind(this));
                }
                if (memberSelect) {
                    memberSelect.removeEventListener('change', this.handleMemberSelectionChange);
                    memberSelect.addEventListener('change', this.handleMemberSelectionChange.bind(this));
                }
                if (amountInput) {
                    amountInput.removeEventListener('input', this.handleAmountChange);
                    amountInput.addEventListener('input', this.handleAmountChange.bind(this));
                }
                if (depositRadio) {
                    depositRadio.removeEventListener('change', this.handleTransferTypeChange);
                    depositRadio.addEventListener('change', this.handleTransferTypeChange.bind(this));
                }
                if (withdrawRadio) {
                    withdrawRadio.removeEventListener('change', this.handleTransferTypeChange);
                    withdrawRadio.addEventListener('change', this.handleTransferTypeChange.bind(this));
                }
                
                // 添加表單提交事件監聽器
                const submitBtn = document.getElementById('csOperationSubmitBtn');
                if (submitBtn) {
                    submitBtn.removeEventListener('click', this.handleSubmitCSOperation);
                    submitBtn.addEventListener('click', this.handleSubmitCSOperation.bind(this));
                }
                
                console.log('事件監聽器已添加');
            }, 300);
            
            console.log('=== 客服操作模態框顯示完成 ===');
        },
        
        // 事件处理器方法
        handleOperationTargetChange() {
            this.onOperationTargetChange();
        },
        
        handleAgentSelectionChange() {
            this.onAgentSelectionChange();
        },
        
        handleMemberSelectionChange() {
            const memberSelect = document.getElementById('memberSelect');
            const memberId = memberSelect ? memberSelect.value : '';
            this.csOperation.targetMemberId = memberId;
            this.updateCurrentBalanceDisplay();
        },
        
        handleAmountChange() {
            const amountInput = document.getElementById('amountInput');
            this.csOperation.amount = amountInput ? amountInput.value : '';
            this.updateFinalBalanceDisplay();
        },
        
        handleTransferTypeChange() {
            const depositRadio = document.getElementById('csDeposit');
            const withdrawRadio = document.getElementById('csWithdraw');
            
            if (depositRadio && depositRadio.checked) {
                this.csOperation.transferType = 'deposit';
            } else if (withdrawRadio && withdrawRadio.checked) {
                this.csOperation.transferType = 'withdraw';
            }
            this.updateFinalBalanceDisplay();
        },
        
        handleSubmitCSOperation() {
            console.log('处理表單提交');
            // 防止重複提交
            const submitBtn = document.getElementById('csOperationSubmitBtn');
            const spinner = document.getElementById('csOperationSpinner');
            
            if (submitBtn.disabled) {
                console.log('按鈕已禁用，防止重複提交');
                return;
            }
            
            // 驗證表單
            if (!this.isValidCSOperation) {
                console.log('表單驗證失败');
                this.showMessage('请填寫完整的操作信息', 'error');
                return;
            }
            
            // 顯示载入狀態
            submitBtn.disabled = true;
            spinner.style.display = 'inline-block';
            
            // 調用提交方法
            this.submitCSOperation().finally(() => {
                // 恢復按鈕狀態
                submitBtn.disabled = false;
                spinner.style.display = 'none';
            });
        },
        
        hideCSOperationModal() {
            this.showCSOperationModal = false;
            this.csOperation = {
                targetAgentId: '',
                operationTarget: '',
                targetMemberId: '',
                transferType: '',
                amount: '',
                description: ''
            };
            this.agentMembers = [];
        },
        
        // 操作對象變化時的处理
        async onOperationTargetChange() {
            const targetAgent = document.getElementById('csTargetAgent');
            const targetMember = document.getElementById('csTargetMember');
            
            let operationTarget = '';
            if (targetAgent && targetAgent.checked) {
                operationTarget = 'agent';
            } else if (targetMember && targetMember.checked) {
                operationTarget = 'member';
            }
            
            console.log('操作對象變化:', operationTarget);
            this.csOperation.operationTarget = operationTarget;
            
            // 重置会员选择和操作相关欄位（但保留代理选择）
            this.csOperation.targetMemberId = '';
            this.csOperation.transferType = '';
            this.csOperation.amount = '';
            this.agentMembers = [];
            
            // 清空表單
            const memberSelect = document.getElementById('memberSelect');
            const amountInput = document.getElementById('amountInput');
            const currentBalanceInput = document.getElementById('currentBalanceInput');
            const finalBalanceInput = document.getElementById('finalBalanceInput');
            const depositRadio = document.getElementById('csDeposit');
            const withdrawRadio = document.getElementById('csWithdraw');
            
            if (memberSelect) memberSelect.value = '';
            if (amountInput) amountInput.value = '';
            if (currentBalanceInput) currentBalanceInput.value = '';
            if (finalBalanceInput) finalBalanceInput.value = '';
            if (depositRadio) depositRadio.checked = false;
            if (withdrawRadio) withdrawRadio.checked = false;
            
            // 顯示/隱藏相关元素
            const agentSelectDiv = document.getElementById('agentSelectDiv');
            const memberSelectDiv = document.getElementById('memberSelectDiv');
            const currentBalanceDiv = document.getElementById('currentBalanceDiv');
            const operationTypeDiv = document.getElementById('operationTypeDiv');
            const amountDiv = document.getElementById('amountDiv');
            const finalBalanceDiv = document.getElementById('finalBalanceDiv');
            
            if (operationTarget) {
                agentSelectDiv.style.display = 'block';
                this.updateAgentSelect();
            } else {
                agentSelectDiv.style.display = 'none';
                memberSelectDiv.style.display = 'none';
                currentBalanceDiv.style.display = 'none';
                operationTypeDiv.style.display = 'none';
                amountDiv.style.display = 'none';
                finalBalanceDiv.style.display = 'none';
            }
            
            // 清空会员选择列表
            this.updateMemberSelect();
            
            // 如果改為会员操作且已经选择了代理，則加載会员列表
            if (operationTarget === 'member' && this.csOperation.targetAgentId) {
                console.log('需要加載代理会员列表，代理ID:', this.csOperation.targetAgentId);
                await this.loadAgentMembers(this.csOperation.targetAgentId);
            }
            
            // 更新当前余额顯示
            setTimeout(() => {
                this.updateCurrentBalanceDisplay();
            }, 100);
        },
        
        // 代理选择變化時的处理
        async onAgentSelectionChange() {
            const agentSelect = document.getElementById('agentSelect');
            const agentId = agentSelect ? agentSelect.value : '';
            
            console.log('代理选择變化:', agentId, '操作對象:', this.csOperation.operationTarget);
            this.csOperation.targetAgentId = agentId;
            
            // 重置会员选择和操作相关欄位
            this.csOperation.targetMemberId = '';
            this.csOperation.transferType = '';
            this.csOperation.amount = '';
            this.agentMembers = [];
            
            // 清空表單
            const memberSelect = document.getElementById('memberSelect');
            const amountInput = document.getElementById('amountInput');
            const currentBalanceInput = document.getElementById('currentBalanceInput');
            const finalBalanceInput = document.getElementById('finalBalanceInput');
            const depositRadio = document.getElementById('csDeposit');
            const withdrawRadio = document.getElementById('csWithdraw');
            
            if (memberSelect) memberSelect.value = '';
            if (amountInput) amountInput.value = '';
            if (currentBalanceInput) currentBalanceInput.value = '';
            if (finalBalanceInput) finalBalanceInput.value = '';
            if (depositRadio) depositRadio.checked = false;
            if (withdrawRadio) withdrawRadio.checked = false;
            
            // 顯示/隱藏相关元素
            const memberSelectDiv = document.getElementById('memberSelectDiv');
            const currentBalanceDiv = document.getElementById('currentBalanceDiv');
            const operationTypeDiv = document.getElementById('operationTypeDiv');
            const amountDiv = document.getElementById('amountDiv');
            const finalBalanceDiv = document.getElementById('finalBalanceDiv');
            
            if (agentId) {
                // 根據操作對象決定是否顯示会员选择
                if (this.csOperation.operationTarget === 'member') {
                    memberSelectDiv.style.display = 'block';
                    console.log('开始加載選中代理的会员列表，代理ID:', agentId);
                    await this.loadAgentMembers(agentId);
                } else {
                    memberSelectDiv.style.display = 'none';
                }
                
                currentBalanceDiv.style.display = 'block';
                operationTypeDiv.style.display = 'block';
                amountDiv.style.display = 'block';
                finalBalanceDiv.style.display = 'block';
            } else {
                memberSelectDiv.style.display = 'none';
                currentBalanceDiv.style.display = 'none';
                operationTypeDiv.style.display = 'none';
                amountDiv.style.display = 'none';
                finalBalanceDiv.style.display = 'none';
            }
            
            // 清空会员选择列表
            this.updateMemberSelect();
            
            // 更新当前余额顯示
            setTimeout(() => {
                this.updateCurrentBalanceDisplay();
            }, 100);
        },
        
        // 加載指定代理的会员列表
        async loadAgentMembers(agentId) {
            try {
                const response = await axios.get(`${API_BASE_URL}/members`, {
                    params: {
                        agentId: agentId,
                        status: -1, // 获取所有狀態的会员
                        page: 1,
                        limit: 1000 // 设置較大的limit获取所有会员
                    }
                });
                if (response.data.success) {
                    this.agentMembers = response.data.data.list || [];
                    console.log('加載代理会员列表成功:', this.agentMembers.length, this.agentMembers);
                    
                    // 确保每個会员都有正确的屬性
                    this.agentMembers.forEach((member, index) => {
                        console.log(`会员 ${index}:`, {
                            id: member.id,
                            username: member.username,
                            balance: member.balance,
                            formattedBalance: this.formatMoney(member.balance)
                        });
                        
                        // 确保數據類型正确
                        member.balance = parseFloat(member.balance) || 0;
                    });
                    
                    // 手動更新会员选择下拉列表
                    this.updateMemberSelect();
                    
                    // 為会员选择添加change事件監聽器
                    this.$nextTick(() => {
                        const memberSelect = document.getElementById('memberSelect');
                        if (memberSelect) {
                            memberSelect.addEventListener('change', () => {
                                this.updateCurrentBalanceDisplay();
                            });
                        }
                        this.updateCurrentBalanceDisplay();
                    });
                } else {
                    console.error('加載代理会员列表失败:', response.data.message);
                    this.agentMembers = [];
                }
            } catch (error) {
                console.error('加載代理会员列表出錯:', error);
                this.agentMembers = [];
            }
        },
        
        // 手動更新代理选择下拉列表
        updateAgentSelect() {
            const agentSelect = document.getElementById('agentSelect');
            if (!agentSelect) return;
            
            // 清除現有選項（保留第一個）
            while (agentSelect.children.length > 1) {
                agentSelect.removeChild(agentSelect.lastChild);
            }
            
            // 添加代理選項
            this.allAgents.forEach(agent => {
                // 代理操作：排除總代理（避免自己操作自己）
                // 会员操作：包含總代理（可以操作自己旗下的会员）
                const shouldInclude = this.csOperation.operationTarget === 'member' || agent.level !== 0;
                
                if (shouldInclude) {
                    const option = document.createElement('option');
                    option.value = agent.id;
                    option.textContent = `${agent.username} (${this.getLevelName(agent.level)}) - 余额: ${this.formatMoney(agent.balance)}`;
                    agentSelect.appendChild(option);
                }
            });
            
            const totalOptions = agentSelect.children.length - 1; // 排除第一個默認選項
            console.log('已更新代理选择列表，共', totalOptions, '個選項，操作類型:', this.csOperation.operationTarget);
        },
        
        // 手動更新会员选择下拉列表
        updateMemberSelect() {
            const memberSelect = document.getElementById('memberSelect');
            if (!memberSelect) return;
            
            // 清除現有選項（保留第一個）
            while (memberSelect.children.length > 1) {
                memberSelect.removeChild(memberSelect.lastChild);
            }
            
            // 添加会员選項
            this.agentMembers.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = `${member.username} - 余额: ${this.formatMoney(member.balance)}`;
                memberSelect.appendChild(option);
            });
            
            console.log('已更新会员选择列表，共', this.agentMembers.length, '個選項');
        },
        
        // 更新当前余额顯示
        updateCurrentBalanceDisplay() {
            const currentBalanceInput = document.getElementById('currentBalanceInput');
            if (currentBalanceInput) {
                const balance = this.getCurrentBalance();
                currentBalanceInput.value = balance !== null ? this.formatMoney(balance) : '';
                console.log('更新当前余额顯示:', balance);
            }
        },
        
        // 更新操作後余额顯示
        updateFinalBalanceDisplay() {
            const finalBalanceInput = document.getElementById('finalBalanceInput');
            if (finalBalanceInput) {
                const finalBalance = this.calculateFinalBalance();
                finalBalanceInput.value = this.formatMoney(finalBalance);
                console.log('更新操作後余额顯示:', finalBalance);
            }
        },
        
        // 获取当前選中用戶的余额
        getCurrentBalance() {
            console.log('获取当前余额:', {
                operationTarget: this.csOperation.operationTarget,
                targetAgentId: this.csOperation.targetAgentId,
                targetMemberId: this.csOperation.targetMemberId,
                allAgents: this.allAgents.length,
                agentMembers: this.agentMembers.length
            });
            
            if (this.csOperation.operationTarget === 'agent' && this.csOperation.targetAgentId) {
                const selectedAgent = this.allAgents.find(agent => agent.id == this.csOperation.targetAgentId);
                console.log('找到代理:', selectedAgent);
                return selectedAgent ? parseFloat(selectedAgent.balance) : null;
            } else if (this.csOperation.operationTarget === 'member' && this.csOperation.targetMemberId) {
                const selectedMember = this.agentMembers.find(member => member.id == this.csOperation.targetMemberId);
                console.log('找到会员:', selectedMember);
                return selectedMember ? parseFloat(selectedMember.balance) : null;
            }
            return null;
        },
        
        // 计算操作後的最终余额
        calculateFinalBalance() {
            const currentBalance = this.getCurrentBalance();
            const amount = parseFloat(this.csOperation.amount) || 0;
            
            if (currentBalance === null || amount <= 0) {
                return currentBalance || 0;
            }
            
            if (this.csOperation.transferType === 'deposit') {
                return currentBalance + amount;
            } else if (this.csOperation.transferType === 'withdraw') {
                return currentBalance - amount;
            }
            
            return currentBalance;
        },
        
        async submitCSOperation() {
            console.log('开始提交客服操作');
            
            // 從DOM元素获取最新值
            const targetAgent = document.getElementById('csTargetAgent');
            const targetMember = document.getElementById('csTargetMember');
            const agentSelect = document.getElementById('agentSelect');
            const memberSelect = document.getElementById('memberSelect');
            const amountInput = document.getElementById('amountInput');
            const depositRadio = document.getElementById('csDeposit');
            const withdrawRadio = document.getElementById('csWithdraw');
            const descriptionInput = document.getElementById('csOperationDescription');
            
            // 更新csOperation數據
            if (targetAgent && targetAgent.checked) {
                this.csOperation.operationTarget = 'agent';
            } else if (targetMember && targetMember.checked) {
                this.csOperation.operationTarget = 'member';
            }
            
            this.csOperation.targetAgentId = agentSelect ? agentSelect.value : '';
            this.csOperation.targetMemberId = memberSelect ? memberSelect.value : '';
            this.csOperation.amount = amountInput ? amountInput.value : '';
            
            if (depositRadio && depositRadio.checked) {
                this.csOperation.transferType = 'deposit';
            } else if (withdrawRadio && withdrawRadio.checked) {
                this.csOperation.transferType = 'withdraw';
            }
            
            this.csOperation.description = descriptionInput ? descriptionInput.value : '';
            
            console.log('表單數據:', this.csOperation);
            
            if (!this.isValidCSOperation) {
                this.showMessage('请检查输入资料', 'error');
                return;
            }
            
            try {
                this.loading = true;
                let response;
                
                const currentBalance = this.getCurrentBalance();
                const amount = parseFloat(this.csOperation.amount);
                
                console.log('操作詳情:', {
                    操作對象: this.csOperation.operationTarget,
                    当前余额: currentBalance,
                    操作金额: amount,
                    操作類型: this.csOperation.transferType
                });
                
                if (this.csOperation.operationTarget === 'agent') {
                    // 代理操作 - 客服代表總代理进行点数转移
                    // 存款 = 總代理轉給目標代理
                    // 提款 = 目標代理轉給總代理
                    response = await axios.post(`${API_BASE_URL}/cs-agent-transfer`, {
                        operatorId: this.user.id,
                        targetAgentId: this.csOperation.targetAgentId,
                        amount: amount,
                        transferType: this.csOperation.transferType, // 'deposit' 或 'withdraw'
                        description: this.csOperation.description || `客服${this.csOperation.transferType === 'deposit' ? '存款' : '提款'}`
                    });
                } else {
                    // 会员操作 - 客服代表代理进行点数转移
                    // 存款 = 代理轉給会员
                    // 提款 = 会员轉給代理
                    const selectedMember = this.agentMembers.find(member => member.id == this.csOperation.targetMemberId);
                    response = await axios.post(`${API_BASE_URL}/cs-member-transfer`, {
                        operatorId: this.user.id,
                        agentId: this.csOperation.targetAgentId,
                        targetMemberUsername: selectedMember.username,
                        amount: amount,
                        transferType: this.csOperation.transferType, // 'deposit' 或 'withdraw'
                        description: this.csOperation.description || `客服${this.csOperation.transferType === 'deposit' ? '存款' : '提款'}`
                    });
                }
                
                if (response.data.success) {
                    this.showMessage('余额调整成功!', 'success');
                    
                    // 更新客服餘額（如果後端返回了csBalance）
                    if (response.data.csBalance !== undefined) {
                        this.user.balance = response.data.csBalance;
                        localStorage.setItem('agent_user', JSON.stringify(this.user));
                        console.log('✅ 客服餘額已即時更新:', this.formatMoney(this.user.balance));
                    }
                    
                    // 保存操作類型和代理ID，用於後續刷新
                    const wasMembeOperation = this.csOperation.operationTarget === 'member';
                    const targetAgentId = this.csOperation.targetAgentId;
                    
                    // 隱藏模態框
                    if (this.csOperationModal) {
                        this.csOperationModal.hide();
                    }
                    this.hideCSOperationModal();
                    
                    // 重置操作表單
                    this.csOperation = {
                        targetAgentId: '',
                        operationTarget: '',
                        targetMemberId: '',
                        transferType: '',
                        amount: '',
                        description: ''
                    };
                    
                    // 全面刷新所有相关數據
                    const refreshPromises = [
                        this.loadCSTransactions(), // 刷新客服交易记录
                        this.loadAllAgents(),      // 刷新代理列表
                        this.fetchDashboardData()  // 刷新儀表板统计
                    ];
                    
                    // 如果操作的是会员，也要刷新会员列表
                    if (wasMembeOperation && targetAgentId) {
                        refreshPromises.push(this.loadAgentMembers(targetAgentId));
                    }
                    
                    // 如果当前在会员頁面，刷新会员列表
                    if (this.activeTab === 'accounts') {
                        refreshPromises.push(this.searchMembers());
                    }
                    
                    // 执行所有刷新操作
                    await Promise.all(refreshPromises);
                    
                    console.log('✅ 客服操作完成，所有數據已刷新');
                } else {
                    this.showMessage(response.data.message || '余额调整失败', 'error');
                }
            } catch (error) {
                console.error('客服操作出錯:', error);
                this.showMessage(error.response?.data?.message || '操作失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 刷新当前用戶余额
        async refreshUserBalance() {
            try {
                // 從所有代理列表中找到当前用戶並更新余额
                if (this.isCustomerService && this.allAgents.length > 0) {
                    const currentUserAgent = this.allAgents.find(agent => agent.id == this.user.id);
                    if (currentUserAgent) {
                        this.user.balance = currentUserAgent.balance;
                        // 同时更新localStorage中的用戶资讯
                        localStorage.setItem('agent_user', JSON.stringify(this.user));
                        console.log('✅ 用戶余额已更新:', this.formatMoney(this.user.balance));
                    }
                }
            } catch (error) {
                console.error('刷新用戶余额失败:', error);
            }
        },
        
        // 加載存款记录
        async loadDepositRecords(page = 1) {
            this.loading = true;
            try {
                console.log('加載存款记录...');
                const response = await axios.get(`${API_BASE_URL}/transactions?agentId=${this.user.id}&type=deposit&page=${page}&limit=${this.depositPagination.limit}`);
                
                if (!response.data.success) {
                    console.error('加載存款记录失败:', response.data.message);
                    this.depositRecords = [];
                    return;
                }
                
                const data = response.data;
                if (data.success) {
                    this.depositRecords = data.data.list || [];
                    this.depositPagination = {
                        page: data.data.page || 1,
                        limit: data.data.limit || 20,
                        total: data.data.total || 0
                    };
                    console.log('存款记录载入成功，共有 ' + this.depositRecords.length + ' 筆记录');
                } else {
                    console.error('存款记录數據格式错误:', data);
                    this.depositRecords = [];
                }
            } catch (error) {
                console.error('加載存款记录错误:', error);
                this.depositRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 加載提款记录
        async loadWithdrawRecords(page = 1) {
            this.loading = true;
            try {
                console.log('加載提款记录...');
                const response = await axios.get(`${API_BASE_URL}/transactions?agentId=${this.user.id}&type=withdraw&page=${page}&limit=${this.withdrawPagination.limit}`);
                
                if (!response.data.success) {
                    console.error('加載提款记录失败:', response.data.message);
                    this.withdrawRecords = [];
                    return;
                }
                
                const data = response.data;
                if (data.success) {
                    this.withdrawRecords = data.data.list || [];
                    this.withdrawPagination = {
                        page: data.data.page || 1,
                        limit: data.data.limit || 20,
                        total: data.data.total || 0
                    };
                    console.log('提款记录载入成功，共有 ' + this.withdrawRecords.length + ' 筆记录');
                } else {
                    console.error('提款记录數據格式错误:', data);
                    this.withdrawRecords = [];
                }
            } catch (error) {
                console.error('加載提款记录错误:', error);
                this.withdrawRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 载入退水记录
        async loadRebateRecords() {
            if (!this.isLoggedIn) return;
            
            this.loading = true;
            try {
                console.log('载入退水记录...');
                const response = await axios.get(`${API_BASE_URL}/transactions?agentId=${this.user.id}&type=rebate`);
                
                if (!response.data.success) {
                    console.error('载入退水记录失败:', response.data.message);
                    this.rebateRecords = [];
                    return;
                }
                
                const data = response.data;
                console.log('退水记录API回應:', data);
                
                if (data.success) {
                    this.rebateRecords = data.data.list || [];
                    // 计算總退水金额
                    this.totalRebateAmount = this.rebateRecords.reduce((sum, record) => {
                        return sum + (parseFloat(record.amount) || 0);
                    }, 0);
                    
                    console.log('退水记录载入成功:', this.rebateRecords.length, '筆，總金额:', this.totalRebateAmount);
                } else {
                    console.error('载入退水记录失败:', data.message);
                    this.showMessage(`载入退水记录失败: ${data.message}`, 'error');
                    this.rebateRecords = [];
                }
            } catch (error) {
                console.error('载入退水记录時發生错误:', error);
                this.showMessage('载入退水记录時發生错误', 'error');
                this.rebateRecords = [];
            } finally {
                this.loading = false;
            }
        },
        
        // 篩選退水记录
        filterRebateRecords() {
            // 觸發computed屬性重新计算
            console.log('篩選退水记录，條件:', this.rebateFilters);
        },
        
        // 清除退水记录篩選條件
        clearRebateFilters() {
            this.rebateFilters.member = '';
            this.rebateFilters.date = '';
        },
        
        // 重设代理密碼
        resetAgentPassword(agent) {
            this.resetPasswordData = {
                userType: 'agent',
                userId: agent.id,
                username: agent.username,
                newPassword: '',
                confirmPassword: ''
            };
            
            const modal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
            modal.show();
        },
        
        // 重设会员密碼
        resetMemberPassword(member) {
            this.resetPasswordData = {
                userType: 'member',
                userId: member.id,
                username: member.username,
                newPassword: '',
                confirmPassword: ''
            };
            
            const modal = new bootstrap.Modal(document.getElementById('resetPasswordModal'));
            modal.show();
        },
        
        // 提交密碼重设
        async submitPasswordReset() {
            if (!this.isPasswordResetValid) {
                this.showMessage('请确认密碼格式正确且兩次输入一致', 'error');
                return;
            }
            
            this.loading = true;
            
            try {
                const endpoint = this.resetPasswordData.userType === 'agent' ? 'reset-agent-password' : 'reset-member-password';
                
                const response = await axios.post(`${API_BASE_URL}/${endpoint}`, {
                    userId: this.resetPasswordData.userId,
                    newPassword: this.resetPasswordData.newPassword,
                    operatorId: this.user.id // 记录操作者
                });
                
                if (response.data.success) {
                    this.showMessage(`${this.resetPasswordData.userType === 'agent' ? '代理' : '会员'}密碼重设成功`, 'success');
                    
                    // 关闭模態框
                    const modal = bootstrap.Modal.getInstance(document.getElementById('resetPasswordModal'));
                    modal.hide();
                    
                    // 清空表單數據
                    this.resetPasswordData = {
                        userType: '',
                        userId: null,
                        username: '',
                        newPassword: '',
                        confirmPassword: ''
                    };
                } else {
                    this.showMessage(response.data.message || '密碼重设失败', 'error');
                }
            } catch (error) {
                console.error('重设密碼错误:', error);
                this.showMessage(error.response?.data?.message || '密碼重设失败，请稍後再試', 'error');
            } finally {
                this.loading = false;
            }
        },
        
        // 顯示个人资料模態框
        async showProfileModal() {
            // 安全检查：确保已登录且有用戶资讯
            if (!this.isLoggedIn || !this.user || !this.user.id) {
                console.warn('⚠️ 未登录或用戶资讯不完整，無法顯示个人资料');
                return;
            }
            
            console.log('顯示个人资料模態框');
            // 载入个人资料數據
            await this.loadProfileData();
            // 顯示 modal
            this.isProfileModalVisible = true;
        },
        
        // 隱藏个人资料模態框
        hideProfileModal() {
            this.isProfileModalVisible = false;
        },
        
        // 载入个人资料數據
        async loadProfileData() {
            this.profileLoading = true;
            
            try {
                const response = await axios.get(`${API_BASE_URL}/agent-profile/${this.user.id}`);
                
                if (response.data.success) {
                    // 更新个人资料數據
                    this.profileData = {
                        realName: response.data.data.real_name || '',
                        phone: response.data.data.phone || '',
                        email: response.data.data.email || '',
                        lineId: response.data.data.line_id || '',
                        telegram: response.data.data.telegram || '',
                        address: response.data.data.address || '',
                        remark: response.data.data.remark || ''
                    };
                } else {
                    console.log('首次载入个人资料，使用空白數據');
                }
            } catch (error) {
                console.error('载入个人资料错误:', error);
                // 如果载入失败，使用空白數據
                this.profileData = {
                    realName: '',
                    phone: '',
                    email: '',
                    lineId: '',
                    telegram: '',
                    address: '',
                    remark: ''
                };
            } finally {
                this.profileLoading = false;
            }
        },
        
        // 更新个人资料
        async updateProfile() {
            console.log('开始更新个人资料...', this.user?.id);
             
             if (!this.user?.id) {
                 this.showMessage('用戶信息错误，请重新登录', 'error');
                 return;
             }
             
             this.profileLoading = true;
             
             try {
                 console.log('發送更新请求到:', `${API_BASE_URL}/update-agent-profile`);
                 
                 const response = await axios.post(`${API_BASE_URL}/update-agent-profile`, {
                     agentId: this.user.id,
                     realName: this.profileData.realName,
                     phone: this.profileData.phone,
                     email: this.profileData.email,
                     lineId: this.profileData.lineId,
                     telegram: this.profileData.telegram,
                     address: this.profileData.address,
                     remark: this.profileData.remark
                 }, {
                     timeout: 10000, // 10秒超時
                     headers: {
                         'Content-Type': 'application/json'
                     }
                 });
                 
                 console.log('收到API回應:', response.data);
                 
                 if (response.data.success) {
                     this.showMessage('个人资料更新成功', 'success');
                     
                     // 关闭 modal
                     this.hideProfileModal();
                 } else {
                     this.showMessage(response.data.message || '个人资料更新失败', 'error');
                 }
             } catch (error) {
                 console.error('更新个人资料错误:', error);
                 console.error('错误詳情:', error.response);
                 
                 let errorMessage = '个人资料更新失败，请稍後再試';
                 if (error.response?.data?.message) {
                     errorMessage = error.response.data.message;
                 } else if (error.message) {
                     errorMessage = error.message;
                 }
                 
                 this.showMessage(errorMessage, 'error');
             } finally {
                 console.log('更新个人资料完成');
                 this.profileLoading = false;
                 
                 // 額外的安全機制：确保按鈕狀態正确重置
                 setTimeout(() => {
                     if (this.profileLoading) {
                         console.warn('检测到 profileLoading 狀態异常，強制重置');
                         this.profileLoading = false;
                     }
                 }, 1000);
             }
         },

         // 報表查詢相關方法
         getCurrentDateText() {
             const today = new Date();
             return today.toLocaleDateString('zh-CN', {
                 year: 'numeric',
                 month: '2-digit',
                 day: '2-digit'
             });
         },

         setDateRange(type) {
             const today = new Date();
             const yesterday = new Date(today);
             yesterday.setDate(today.getDate() - 1);
             
             switch(type) {
                 case 'today':
                     this.reportFilters.startDate = today.toISOString().split('T')[0];
                     this.reportFilters.endDate = today.toISOString().split('T')[0];
                     break;
                 case 'yesterday':
                     this.reportFilters.startDate = yesterday.toISOString().split('T')[0];
                     this.reportFilters.endDate = yesterday.toISOString().split('T')[0];
                     break;
                 case 'week':
                     const weekStart = new Date(today);
                     weekStart.setDate(today.getDate() - today.getDay());
                     this.reportFilters.startDate = weekStart.toISOString().split('T')[0];
                     this.reportFilters.endDate = today.toISOString().split('T')[0];
                     break;
                 case 'month':
                     const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                     this.reportFilters.startDate = monthStart.toISOString().split('T')[0];
                     this.reportFilters.endDate = today.toISOString().split('T')[0];
                     break;
             }
         },



         async searchReports() {
             this.loading = true;
             
             try {
                 const params = new URLSearchParams();
                 if (this.reportFilters.startDate) params.append('startDate', this.reportFilters.startDate);
                 if (this.reportFilters.endDate) params.append('endDate', this.reportFilters.endDate);
                 if (this.reportFilters.username) params.append('username', this.reportFilters.username);
                 
                 console.log('📡 报表查詢參數:', this.reportFilters);
                 
                 const url = `${API_BASE_URL}/agent-hierarchical-analysis?${params.toString()}&agentId=${this.currentManagingAgent.id}`;
                 const response = await fetch(url, {
                     method: 'GET',
                     headers: {
                         'Content-Type': 'application/json',
                         'Authorization': localStorage.getItem('agent_token') || '',
                         'x-session-token': localStorage.getItem('agent_session_token') || ''
                     }
                 });
                 
                 if (!response.ok) {
                     throw new Error(`HTTP error! status: ${response.status}`);
                 }
                 
                 const data = await response.json();
                 
                 console.log('📊 代理層級分析數據:', data);
                 
                 // 新的簡化數據結構
                 this.reportData = {
                     success: data.success,
                     reportData: data.reportData || [],                  // 統一的代理+會員列表
                     totalSummary: data.totalSummary || {
                         betCount: 0,
                         betAmount: 0.0,
                         validAmount: 0.0,
                         memberWinLoss: 0.0,
                         rebate: 0.0,
                         profitLoss: 0.0,
                         actualRebate: 0.0,
                         rebateProfit: 0.0,
                         finalProfitLoss: 0.0
                     },
                     hasData: data.hasData || false,
                     agentInfo: data.agentInfo || {},                    // 代理信息：下級數量等
                     message: data.message
                 };
                 
             } catch (error) {
                 console.error('查詢報表失敗:', error);
                 
                 // 設置空的報表數據結構
                 this.reportData = {
                     success: false,
                     reportData: [],
                     totalSummary: {
                         betCount: 0,
                         betAmount: 0.0,
                         validAmount: 0.0,
                         memberWinLoss: 0.0,
                         rebate: 0.0,
                         profitLoss: 0.0,
                         actualRebate: 0.0,
                         rebateProfit: 0.0,
                         finalProfitLoss: 0.0
                     },
                     hasData: false,
                     agentInfo: {},
                     message: error.message
                 };
             } finally {
                 this.loading = false;
             }
         },



         async refreshReportData() {
             await this.searchReports();
         },
         
         async enterAgentReport(agent) {
             try {
                 // 設置載入狀態，避免短暫顯示「沒有資料」
                 this.loading = true;
                 
                 // 添加到面包屑導航
                 this.reportBreadcrumb.push({
                     username: agent.username,
                     level: agent.level,
                     agentId: agent.id || agent.username,
                     viewType: 'agents'
                 });
                 
                 console.log('🔍 進入代理報表:', agent.username, '層級:', agent.level);
                 
                 // 準備參數
                 const params = new URLSearchParams();
                 
                 // 保持當前篩選條件
                 if (this.reportFilters.startDate) {
                     params.append('startDate', this.reportFilters.startDate);
                 }
                 if (this.reportFilters.endDate) {
                     params.append('endDate', this.reportFilters.endDate);
                 }
                 if (this.reportFilters.settlementStatus) {
                     params.append('settlementStatus', this.reportFilters.settlementStatus);
                 }
                 if (this.reportFilters.username && this.reportFilters.username.trim()) {
                     params.append('username', this.reportFilters.username.trim());
                 }
                 
                 // 指定查看該代理
                 params.append('targetAgent', agent.username);
                 params.append('gameTypes', 'pk10');
                 
                 const response = await fetch(`${this.API_BASE_URL}/reports/agent-analysis?${params.toString()}`, {
                     method: 'GET',
                     headers: {
                         'Content-Type': 'application/json',
                         'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                     }
                 });

                 if (!response.ok) {
                     throw new Error(`HTTP error! status: ${response.status}`);
                 }

                 const data = await response.json();
                 
                 console.log('📊 代理層級報表數據:', data);
                 
                 // 更新報表數據
                 this.reportData = {
                     success: data.success,
                     reportData: data.reportData || [],                  // 統一的代理+會員列表
                     totalSummary: data.totalSummary || {
                         betCount: 0,
                         betAmount: 0.0,
                         validAmount: 0.0,
                         memberWinLoss: 0.0,
                         rebate: 0.0,
                         profitLoss: 0.0,
                         actualRebate: 0.0,
                         rebateProfit: 0.0,
                         finalProfitLoss: 0.0
                     },
                     hasData: data.hasData || false,
                     agentInfo: data.agentInfo || {},                    // 代理信息：下級數量等
                     message: data.message
                 };
                 
                 // 移除成功提示訊息，讓HTML模板來處理空數據顯示
                 
             } catch (error) {
                 console.error('查看代理報表失敗:', error);
                 this.showMessage('查看代理報表失敗: ' + error.message, 'error');
             } finally {
                 // 取消載入狀態
                 this.loading = false;
             }
         },

         async viewAgentMembers(agent) {
             try {
                 this.loading = true;
                 
                 // 添加到面包屑導航
                 this.reportBreadcrumb.push({
                     username: agent.username,
                     level: `${agent.level} - 會員列表`,
                     agentId: agent.id || agent.username,
                     viewType: 'members'
                 });
                 
                 console.log('👥 查看代理會員:', agent.username);
                 
                 // 準備參數
                 const params = new URLSearchParams();
                 
                 // 保持當前篩選條件
                 if (this.reportFilters.startDate) {
                     params.append('startDate', this.reportFilters.startDate);
                 }
                 if (this.reportFilters.endDate) {
                     params.append('endDate', this.reportFilters.endDate);
                 }
                 if (this.reportFilters.settlementStatus) {
                     params.append('settlementStatus', this.reportFilters.settlementStatus);
                 }
                 if (this.reportFilters.username && this.reportFilters.username.trim()) {
                     params.append('username', this.reportFilters.username.trim());
                 }
                 
                 // 指定查看該代理的會員
                 params.append('targetAgent', agent.username);
                 params.append('viewType', 'members');
                 params.append('gameTypes', 'pk10');
                 
                 const response = await fetch(`${this.API_BASE_URL}/reports/agent-analysis?${params.toString()}`, {
                     method: 'GET',
                     headers: {
                         'Content-Type': 'application/json',
                         'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                     }
                 });

                 if (!response.ok) {
                     throw new Error(`HTTP error! status: ${response.status}`);
                 }

                 const data = await response.json();
                 
                 console.log('👥 會員報表數據:', data);
                 
                 // 更新報表數據
                 this.reportData = {
                     success: data.success,
                     reportData: data.reportData || [],
                     totalSummary: data.totalSummary || {
                         betCount: 0,
                         betAmount: 0.0,
                         validAmount: 0.0,
                         memberWinLoss: 0.0,
                         ninthAgentWinLoss: 0.0,
                         upperDelivery: 0.0,
                         upperSettlement: 0.0,
                         rebate: 0.0,
                         profitLoss: 0.0,
                         downlineReceivable: 0.0,
                         commission: 0.0,
                         commissionAmount: 0.0,
                         commissionResult: 0.0,
                         actualRebate: 0.0,
                         rebateProfit: 0.0,
                         finalProfitLoss: 0.0
                     },
                     hasData: data.hasData || false,
                     message: data.message
                 };
                 
                 if (data.hasData && data.reportData && data.reportData.length > 0) {
                     this.showMessage(`查看 ${agent.username} 的會員報表完成`, 'success');
                 }
                 
             } catch (error) {
                 console.error('查看會員報表失敗:', error);
                 this.showMessage('查看會員報表失敗: ' + error.message, 'error');
             } finally {
                 this.loading = false;
             }
         },
         
         goBackToParentReport() {
             if (this.reportBreadcrumb.length === 0) {
                 // 回到根報表
                 this.searchReports();
                 return;
             }
             
             // 移除最後一個層級
             this.reportBreadcrumb.pop();
             
             if (this.reportBreadcrumb.length === 0) {
                 // 回到根報表
                 this.searchReports();
             } else {
                 // 回到上一個層級
                 const parentAgent = this.reportBreadcrumb[this.reportBreadcrumb.length - 1];
                 this.enterAgentReport(parentAgent);
             }
         },
         
         goBackToLevel(targetItem) {
             // 直接進入該層級的報表
             this.enterAgentReport(targetItem);
         },

         async exportReport() {
             try {
                 this.loading = true;
                 
                 // 準備篩選參數
                 const params = new URLSearchParams({
                     startDate: this.reportFilters.startDate,
                     endDate: this.reportFilters.endDate,
                     settlementStatus: this.reportFilters.settlementStatus,
                     betType: this.reportFilters.betType,
                     username: this.reportFilters.username,
                     minAmount: this.reportFilters.minAmount,
                     maxAmount: this.reportFilters.maxAmount,
                     export: 'true'
                 });

                 // 處理遊戲類型篩選
                 const selectedGameTypes = [];
                 if (!this.reportFilters.gameTypes.all) {
                     if (this.reportFilters.gameTypes.pk10) selectedGameTypes.push('pk10');
                     if (this.reportFilters.gameTypes.ssc) selectedGameTypes.push('ssc');
                     if (this.reportFilters.gameTypes.lottery539) selectedGameTypes.push('lottery539');
                     if (this.reportFilters.gameTypes.lottery) selectedGameTypes.push('lottery');
                     if (this.reportFilters.gameTypes.other) selectedGameTypes.push('other');
                 }
                 
                 if (selectedGameTypes.length > 0) {
                     params.append('gameTypes', selectedGameTypes.join(','));
                 }

                 const response = await fetch(`${this.API_BASE_URL}/reports/export?${params.toString()}`, {
                     method: 'GET',
                     headers: {
                         'Authorization': `Bearer ${localStorage.getItem('agent_token')}`
                     }
                 });

                 if (!response.ok) {
                     throw new Error(`HTTP error! status: ${response.status}`);
                 }

                 // 處理檔案下載
                 const blob = await response.blob();
                 const url = window.URL.createObjectURL(blob);
                 const a = document.createElement('a');
                 a.href = url;
                 a.download = `報表_${this.reportFilters.startDate}_${this.reportFilters.endDate}.xlsx`;
                 document.body.appendChild(a);
                 a.click();
                 window.URL.revokeObjectURL(url);
                 document.body.removeChild(a);
                 
                 this.showMessage('報表匯出完成', 'success');
                 
             } catch (error) {
                 console.error('匯出報表失敗:', error);
                 this.showMessage('匯出報表失敗: ' + error.message, 'error');
             } finally {
                 this.loading = false;
             }
         },



         formatGameType(gameType) {
             const gameTypeMap = {
                 'pk10': 'AR PK10',
                 'ssc': 'AR 時時彩',
                 'lottery539': 'AR 539',
                 'lottery': 'AR 六合彩',
                 'racing': '極速賽車'
             };
             return gameTypeMap[gameType] || '其他遊戲';
         },

         formatBetContent(record) {
             if (!record.bet_content) return '-';
             
             try {
                 // 如果是JSON字符串，解析它
                 const content = typeof record.bet_content === 'string' ? 
                               JSON.parse(record.bet_content) : record.bet_content;
                 
                 if (content.position) {
                     return `位置投注: ${content.position}`;
                 } else if (content.numbers) {
                     return `號碼投注: ${content.numbers.join(', ')}`;
                 } else if (content.type) {
                     return `${content.type}投注`;
                 }
                 return JSON.stringify(content);
             } catch (e) {
                 return record.bet_content;
             }
         },

         getProfitClass(profit) {
             if (!profit || profit === 0) return 'text-muted';
             return profit > 0 ? 'text-success fw-bold' : 'text-danger fw-bold';
         },

         formatProfit(amount) {
             if (!amount || amount === 0) return '$0.00';
             const formatted = this.formatMoney(Math.abs(amount));
             return amount > 0 ? `+${formatted}` : `-${formatted}`;
         },

         formatPercentage(rate) {
             if (!rate) return '0%';
             return `${(rate * 100).toFixed(1)}%`;
         },

         // 登錄日誌相關方法
         async loadLoginLogs() {
             try {
                 this.loading = true;
                 
                 const params = new URLSearchParams({
                     startDate: this.loginLogFilters.startDate,
                     endDate: this.loginLogFilters.endDate
                 });

                 const response = await axios.get(`${API_BASE_URL}/login-logs?${params.toString()}`);
                 const data = response.data;
                 this.loginLogs = data.logs || [];
                 this.calculateLoginLogPagination();
                 
             } catch (error) {
                 console.error('載入登錄日誌失敗:', error);
                 this.showMessage('載入登錄日誌失敗: ' + error.message, 'error');
             } finally {
                 this.loading = false;
             }
         },



         searchLoginLogs() {
             this.loadLoginLogs();
         },

         setLoginLogDateRange(type) {
             const today = new Date();
             const yesterday = new Date(today);
             yesterday.setDate(today.getDate() - 1);
             
             switch(type) {
                 case 'today':
                     this.loginLogFilters.startDate = today.toISOString().split('T')[0];
                     this.loginLogFilters.endDate = today.toISOString().split('T')[0];
                     break;
                 case 'yesterday':
                     this.loginLogFilters.startDate = yesterday.toISOString().split('T')[0];
                     this.loginLogFilters.endDate = yesterday.toISOString().split('T')[0];
                     break;
                 case 'week':
                     const weekStart = new Date(today);
                     weekStart.setDate(today.getDate() - today.getDay());
                     this.loginLogFilters.startDate = weekStart.toISOString().split('T')[0];
                     this.loginLogFilters.endDate = today.toISOString().split('T')[0];
                     break;
                 case '7days':
                     const sevenDaysAgo = new Date(today);
                     sevenDaysAgo.setDate(today.getDate() - 7);
                     this.loginLogFilters.startDate = sevenDaysAgo.toISOString().split('T')[0];
                     this.loginLogFilters.endDate = today.toISOString().split('T')[0];
                     break;
             }
             // 設定日期範圍後自動查詢
             this.loadLoginLogs();
         },

         calculateLoginLogPagination() {
             this.loginLogPagination.totalPages = Math.ceil(this.loginLogs.length / this.loginLogPagination.limit);
             if (this.loginLogPagination.currentPage > this.loginLogPagination.totalPages) {
                 this.loginLogPagination.currentPage = 1;
             }
         },

         changeLoginLogPage(page) {
             if (page >= 1 && page <= this.loginLogPagination.totalPages) {
                 this.loginLogPagination.currentPage = page;
             }
         },

         getLoginLogPageRange() {
             const currentPage = this.loginLogPagination.currentPage;
             const totalPages = this.loginLogPagination.totalPages;
             const range = [];
             
             const startPage = Math.max(1, currentPage - 2);
             const endPage = Math.min(totalPages, currentPage + 2);
             
             for (let i = startPage; i <= endPage; i++) {
                 range.push(i);
             }
             
             return range;
         },

         formatLoginDate(dateString) {
             if (!dateString) return '-';
             const date = new Date(dateString);
             return date.toLocaleDateString('zh-CN', {
                 year: 'numeric',
                 month: '2-digit',
                 day: '2-digit'
             });
         },

                   formatLoginTime(dateString) {
              if (!dateString) return '-';
              const date = new Date(dateString);
              return date.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
              });
          },

          formatLoginDateTime(dateString) {
              if (!dateString) return '-';
              const date = new Date(dateString);
                                  return date.toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
              });
          },

          formatUserType(userType) {
              const typeMap = {
                  'member': '會員',
                  'agent': '代理',
                  'admin': '管理員'
              };
              return typeMap[userType] || userType;
          },

          formatIPAddress(ipAddress) {
              if (!ipAddress) return '-';
              // 移除IPv6映射的前綴 ::ffff:
              return ipAddress.replace(/^::ffff:/i, '');
          },

          // 查看會員下注記錄
          async viewMemberBets(memberUsername, dateRange = null) {
              try {
                  console.log('🎯 查看會員下注記錄:', memberUsername, '期間:', dateRange);
                  
                  // 切換到下注記錄頁面
                  this.activeTab = 'stats';
                  
                  // 等待頁面切換完成
                  await this.$nextTick();
                  
                  // 設置篩選條件為該會員
                  this.betFilters.member = memberUsername;
                  this.betFilters.viewScope = 'downline'; // 使用整條代理線模式確保能查到
                  
                  // 如果有傳入期間範圍，設置期間篩選
                  if (dateRange && dateRange.startDate && dateRange.endDate) {
                      this.betFilters.startDate = dateRange.startDate;
                      this.betFilters.endDate = dateRange.endDate;
                      // 清空單日查詢，使用期間查詢
                      this.betFilters.date = '';
                      console.log('📅 設置期間查詢:', dateRange.startDate, '至', dateRange.endDate);
                  }
                  
                  // 載入直屬會員數據並搜索
                  await this.loadDirectMembersForBets();
                  await this.searchBets();
                  
                  const dateMsg = dateRange ? ` (${dateRange.startDate} 至 ${dateRange.endDate})` : '';
                  this.showMessage(`正在查看 ${memberUsername} 的下注記錄${dateMsg}`, 'info');
                  
              } catch (error) {
                  console.error('查看會員下注記錄失敗:', error);
                  this.showMessage('查看會員下注記錄失敗: ' + error.message, 'error');
              }
          },

          // 顯示會員注單詳情Modal
          async showMemberBetDetails(member) {
              try {
                  console.log('🔍 顯示會員注單詳情:', member);
                  
                  this.memberBetDetails.memberUsername = member.username;
                  this.memberBetDetails.memberId = member.id;
                  this.memberBetDetails.currentPage = 1;
                  
                  // 重置數據
                  this.memberBetDetails.bets = [];
                  this.memberBetDetails.totalPages = 1;
                  this.memberBetDetails.totalBets = 0;
                  
                  // 顯示Modal
                  const modal = new bootstrap.Modal(document.getElementById('memberBetDetailsModal'));
                  modal.show();
                  
                  // 載入注單數據
                  await this.loadMemberBetDetails();
                  
              } catch (error) {
                  console.error('顯示會員注單詳情失敗:', error);
                  this.showMessage('顯示會員注單詳情失敗: ' + error.message, 'error');
              }
          },

          // 載入會員注單詳情
          async loadMemberBetDetails() {
              if (!this.memberBetDetails.memberUsername) return;
              
              try {
                  this.memberBetDetails.loading = true;
                  
                  const params = {
                      username: this.memberBetDetails.memberUsername,
                      startDate: this.memberBetDetails.startDate,
                      endDate: this.memberBetDetails.endDate,
                      page: this.memberBetDetails.currentPage,
                      limit: 20
                  };
                  
                  console.log('🔄 載入會員注單詳情:', params);
                  
                  const response = await axios.get(`${API_BASE_URL}/member-bet-details`, {
                      params,
                      headers: {
                          'Authorization': `Bearer ${this.sessionToken}`,
                          'X-Session-Token': this.sessionToken
                      }
                  });
                  
                  if (response.data.success) {
                      this.memberBetDetails.bets = response.data.bets || [];
                      this.memberBetDetails.totalPages = response.data.totalPages || 1;
                      this.memberBetDetails.totalBets = response.data.total || 0;
                      
                      console.log('✅ 注單詳情載入成功:', response.data);
                  } else {
                      throw new Error(response.data.message || '載入注單詳情失敗');
                  }
                  
              } catch (error) {
                  console.error('載入會員注單詳情失敗:', error);
                  this.showMessage('載入注單詳情失敗: ' + error.message, 'error');
              } finally {
                  this.memberBetDetails.loading = false;
              }
          },

          // 刷新會員注單詳情
          async refreshMemberBetDetails() {
              this.memberBetDetails.currentPage = 1;
              await this.loadMemberBetDetails();
          },

          // 切換會員注單頁面
          async changeMemberBetPage(page) {
              if (page < 1 || page > this.memberBetDetails.totalPages) return;
              this.memberBetDetails.currentPage = page;
              await this.loadMemberBetDetails();
          },

          // 獲取會員注單分頁範圍
          getMemberBetPageRange() {
              const current = this.memberBetDetails.currentPage;
              const total = this.memberBetDetails.totalPages;
              const range = [];
              
              const start = Math.max(1, current - 2);
              const end = Math.min(total, current + 2);
              
              for (let i = start; i <= end; i++) {
                  range.push(i);
              }
              
              return range;
          },

          // 顯示佔成明細
          async showCommissionDetails(bet) {
              try {
                  console.log('🔍 顯示佔成明細:', bet);
                  
                  const response = await axios.get(`${API_BASE_URL}/bet-commission-details/${bet.id}`, {
                      headers: {
                          'Authorization': `Bearer ${this.sessionToken}`,
                          'X-Session-Token': this.sessionToken
                      }
                  });
                  
                  if (response.data.success) {
                      this.commissionDetails = response.data.details || [];
                      
                      // 顯示Modal
                      const modal = new bootstrap.Modal(document.getElementById('commissionDetailsModal'));
                      modal.show();
                  } else {
                      throw new Error(response.data.message || '載入佔成明細失敗');
                  }
                  
              } catch (error) {
                  console.error('顯示佔成明細失敗:', error);
                  this.showMessage('顯示佔成明細失敗: ' + error.message, 'error');
              }
          },

          // 顯示開獎結果
          async showDrawResult(period) {
              try {
                  console.log('🔍 顯示開獎結果:', period);
                  
                  const response = await axios.get(`${API_BASE_URL}/draw-result/${period}`, {
                      headers: {
                          'Authorization': `Bearer ${this.sessionToken}`,
                          'X-Session-Token': this.sessionToken
                      }
                  });
                  
                  if (response.data.success) {
                      this.drawResult.period = period;
                      this.drawResult.numbers = response.data.result || [];
                      
                      // 顯示Modal
                      const modal = new bootstrap.Modal(document.getElementById('drawResultModal'));
                      modal.show();
                  } else {
                      throw new Error(response.data.message || '載入開獎結果失敗');
                  }
                  
              } catch (error) {
                  console.error('顯示開獎結果失敗:', error);
                  this.showMessage('顯示開獎結果失敗: ' + error.message, 'error');
              }
          },

          // 格式化投注時間
          formatBetTime(dateString) {
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

          // 格式化投注內容
          formatBetContent(bet) {
              if (bet.bet_type === 'number') {
                  return `第${bet.position}名 ${bet.bet_value}`;
              } else if (bet.bet_type === 'size') {
                  return `第${bet.position}名 ${bet.bet_value === 'big' ? '大' : '小'}`;
              } else if (bet.bet_type === 'odd_even') {
                  return `第${bet.position}名 ${bet.bet_value === 'odd' ? '單' : '雙'}`;
              } else if (bet.bet_type === 'dragon_tiger') {
                  return `龍虎 ${bet.bet_value === 'dragon' ? '龍' : '虎'}`;
              }
              return `${bet.bet_type} ${bet.bet_value}`;
          },

          // 獲取位置名稱
          getPositionName(position) {
              const positions = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
              return positions[position - 1] || position;
          },

          // 設置下注記錄期間查詢
          setBetDateRange(type) {
              const today = new Date();
              let startDate, endDate;
              
              switch(type) {
                  case 'today':
                      startDate = endDate = today.toISOString().split('T')[0];
                      break;
                  case 'yesterday':
                      const yesterday = new Date(today);
                      yesterday.setDate(today.getDate() - 1);
                      startDate = endDate = yesterday.toISOString().split('T')[0];
                      break;
                  case 'thisWeek':
                      const firstDay = new Date(today);
                      firstDay.setDate(today.getDate() - today.getDay());
                      startDate = firstDay.toISOString().split('T')[0];
                      endDate = today.toISOString().split('T')[0];
                      break;
                  case 'lastWeek':
                      const lastWeekEnd = new Date(today);
                      lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
                      const lastWeekStart = new Date(lastWeekEnd);
                      lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
                      startDate = lastWeekStart.toISOString().split('T')[0];
                      endDate = lastWeekEnd.toISOString().split('T')[0];
                      break;
                  case 'thisMonth':
                      startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                      endDate = today.toISOString().split('T')[0];
                      break;
                  case 'lastMonth':
                      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                      startDate = lastMonthStart.toISOString().split('T')[0];
                      endDate = lastMonthEnd.toISOString().split('T')[0];
                      break;
                  case 'clear':
                      this.betFilters.startDate = '';
                      this.betFilters.endDate = '';
                      this.betFilters.date = '';
                      return;
                  default:
                      return;
              }
              
              this.betFilters.startDate = startDate;
              this.betFilters.endDate = endDate;
              this.betFilters.date = ''; // 清空單日查詢
              
              console.log('📅 設置下注記錄期間查詢:', type, startDate, '至', endDate);
              
              // 自動執行搜索
              this.searchBets();
          },

        // 調整會員限紅 - 使用v-if控制顯示
        async adjustMemberBettingLimit(member) {
            try {
                console.log('開始調整會員限紅:', member);
                
                // 重置數據
                this.bettingLimitData = {
                    loading: true,
                    submitting: false,
                    member: {
                        id: member.id,
                        username: member.username,
                        bettingLimitLevel: '',
                        levelDisplayName: '',
                        description: ''
                    },
                    configs: [],
                    newLimitLevel: '',
                    reason: ''
                };
                
                // 顯示Modal
                this.showBettingLimitModal = true;
                console.log('✅ 限紅調整Modal已顯示！');
                
                // 並行載入數據
                const [memberResponse, configsResponse] = await Promise.all([
                    axios.get(`${API_BASE_URL}/member-betting-limit/${member.id}`),
                    axios.get(`${API_BASE_URL}/betting-limit-configs`)
                ]);
                
                if (memberResponse.data.success) {
                    this.bettingLimitData.member = {
                        ...this.bettingLimitData.member,
                        bettingLimitLevel: memberResponse.data.member.bettingLimitLevel,
                        levelDisplayName: memberResponse.data.member.levelDisplayName,
                        description: memberResponse.data.member.description
                    };
                }
                
                if (configsResponse.data.success) {
                    this.bettingLimitData.configs = configsResponse.data.configs;
                }
                
                this.bettingLimitData.loading = false;
                
            } catch (error) {
                console.error('載入限紅設定失敗:', error);
                this.showMessage('載入限紅設定失敗，請稍後再試', 'error');
                this.bettingLimitData.loading = false;
                this.showBettingLimitModal = false;
            }
        },
        
        // 隱藏限紅調整Modal
        hideBettingLimitModal() {
            this.showBettingLimitModal = false;
        },

        // 提交限紅調整
        async submitBettingLimitAdjustment() {
            try {
                this.bettingLimitData.submitting = true;
                
                const response = await axios.post(`${API_BASE_URL}/update-member-betting-limit`, {
                    operatorId: this.user.id,
                    memberId: this.bettingLimitData.member.id,
                    newLimitLevel: this.bettingLimitData.newLimitLevel,
                    reason: this.bettingLimitData.reason
                });
                
                if (response.data.success) {
                    this.showMessage('限紅設定調整成功', 'success');
                    
                    // 關閉Modal
                    this.showBettingLimitModal = false;
                    
                    // 刷新會員列表
                    if (this.activeTab === 'accounts') {
                        await this.searchMembers();
                    } else if (this.activeTab === 'hierarchical') {
                        await this.refreshHierarchicalMembers();
                    }
                } else {
                    this.showMessage(response.data.message || '調整限紅失敗', 'error');
                }
                
            } catch (error) {
                console.error('調整限紅失敗:', error);
                this.showMessage('調整限紅失敗，請稍後再試', 'error');
            } finally {
                this.bettingLimitData.submitting = false;
            }
        },

        // 格式化投注類型名稱
        formatBetTypeName(key) {
            const names = {
                'number': '1-10車號',
                'twoSide': '兩面',
                'sumValueSize': '冠亞軍和大小',
                'sumValueOddEven': '冠亞軍和單雙',
                'sumValue': '冠亞軍和',
                'dragonTiger': '龍虎'
            };
            return names[key] || key;
        }
    },

    // 计算屬性
    computed: {
        // 分頁後的登錄日誌
        paginatedLoginLogs() {
            const start = (this.loginLogPagination.currentPage - 1) * this.loginLogPagination.limit;
            const end = start + this.loginLogPagination.limit;
            return this.loginLogs.slice(start, end);
        },
        
        // 计算最终代理余额（会员点数转移用）- 作為计算屬性
        finalAgentBalance() {
            const currentBalance = parseFloat(this.agentCurrentBalance) || 0;
            const amount = parseFloat(this.transferAmount) || 0;
            
            if (this.transferType === 'deposit') {
                // 代理存入点数給会员，代理余额減少
                return currentBalance - amount;
            } else {
                // 代理從会员提领点数，代理余额增加
                return currentBalance + amount;
            }
        },
        
        // 检查转移是否有效
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
        
        // 检查代理点数转移是否有效
        isValidAgentTransfer() {
            // 确保數值正确
            const amount = parseFloat(this.agentTransferAmount) || 0;
            const userBalance = parseFloat(this.user.balance) || 0;
            const agentBalance = parseFloat(this.agentBalanceData?.currentBalance) || 0;
            
            console.log('驗證代理点数转移:', {
                amount, 
                userBalance, 
                agentBalance, 
                type: this.agentTransferType
            });
            
            // 金额必須大於0
            if (amount <= 0) {
                return false;
            }
            
            if (this.agentTransferType === 'deposit') {
                // 存入時，检查上級代理(自己)余额是否足夠
                return userBalance >= amount;
            } else if (this.agentTransferType === 'withdraw') {
                // 提领時，检查下級代理余额是否足夠
                return agentBalance >= amount;
            }
            
            return false;
        },

        // 檢查會員點數轉移是否有效
        isValidMemberTransfer() {
            // 確保數值正確
            const amount = parseFloat(this.memberTransferAmount) || 0;
            const userBalance = parseFloat(this.user.balance) || 0;
            const memberBalance = parseFloat(this.memberBalanceData?.currentBalance) || 0;
            
            console.log('驗證會員點數轉移:', {
                amount, 
                userBalance, 
                memberBalance, 
                type: this.memberTransferType
            });
            
            // 金額必須大於0
            if (amount <= 0) {
                return false;
            }
            
            if (this.memberTransferType === 'deposit') {
                // 存入時，檢查代理(自己)餘額是否足夠
                return userBalance >= amount;
            } else if (this.memberTransferType === 'withdraw') {
                // 提領時，檢查會員餘額是否足夠
                return memberBalance >= amount;
            }
            
            return false;
        },
        
        // 检查会员余额修改是否有效
        isValidBalanceModification() {
            const amount = parseFloat(this.modifyBalanceAmount) || 0;
            if (amount <= 0) return false;
            
            if (this.modifyBalanceType === 'absolute') {
                return true; // 絕對值模式下，只要金额大於0即可
            } else {
                // 相對值模式下，如果是減少，則不能超過当前余额
                if (this.balanceChangeDirection === 'decrease') {
                    const currentBalance = parseFloat(this.modifyBalanceData.currentBalance) || 0;
                    return amount <= currentBalance;
                }
                return true;
            }
        },
        
        // 检查代理余额修改是否有效
        isValidAgentBalanceModification() {
            const amount = parseFloat(this.agentModifyAmount) || 0;
            if (amount <= 0) return false;
            
            if (this.agentModifyType === 'absolute') {
                return true; // 絕對值模式下，只要金额大於0即可
            } else {
                // 相對值模式下，如果是減少，則不能超過当前余额
                if (this.agentChangeDirection === 'decrease') {
                    const currentBalance = parseFloat(this.agentBalanceData.currentBalance) || 0;
                    return amount <= currentBalance;
                }
                return true;
            }
        },
        
        // 检查客服操作是否有效
        isValidCSOperation() {
            const amount = parseFloat(this.csOperation.amount) || 0;
            
            if (amount <= 0) return false;
            if (!this.csOperation.operationTarget) return false;
            if (!this.csOperation.targetAgentId) return false;
            if (this.csOperation.operationTarget === 'member' && !this.csOperation.targetMemberId) return false;
            if (!this.csOperation.transferType) return false;
            
            return true;
        },
        
        // 检查密碼重设是否有效
        isPasswordResetValid() {
            return (
                this.resetPasswordData.newPassword && 
                this.resetPasswordData.confirmPassword &&
                this.resetPasswordData.newPassword.length >= 6 &&
                this.resetPasswordData.newPassword === this.resetPasswordData.confirmPassword
            );
        },
        
        // 当前用戶名
        currentUsername() {
            console.log('计算currentUsername，user:', this.user);
            const username = this.user?.username || '载入中...';
            console.log('计算得到的username:', username);
            return username;
        },
        
        // 当前用戶级别
        currentUserLevel() {
            console.log('计算currentUserLevel，user.level:', this.user?.level);
            if (this.user?.level !== undefined && this.user?.level !== null) {
                const levelName = this.getLevelName(this.user.level);
                console.log('计算得到的levelName:', levelName);
                return levelName;
            }
            console.log('回傳载入中...');
            return '载入中...';
        },
        
        // 過濾後的退水记录
        filteredRebateRecords() {
            let filtered = [...this.rebateRecords];
            
            // 按会员名稱篩選
            if (this.rebateFilters.member) {
                const keyword = this.rebateFilters.member.toLowerCase();
                filtered = filtered.filter(record => 
                    record.member_username && record.member_username.toLowerCase().includes(keyword)
                );
            }
            
            // 按日期篩選
            if (this.rebateFilters.date) {
                const filterDate = this.rebateFilters.date;
                filtered = filtered.filter(record => {
                    if (!record.created_at) return false;
                    const recordDate = new Date(record.created_at).toISOString().split('T')[0];
                    return recordDate === filterDate;
                });
            }
            
            return filtered;
        },
        
        // 總下注金额（過濾後）
        totalFilteredBetAmount() {
            return this.filteredRebateRecords.reduce((sum, record) => {
                return sum + (parseFloat(record.bet_amount) || 0);
            }, 0);
        },
        
        // 總退水金额（過濾後）
        totalFilteredRebateAmount() {
            return this.filteredRebateRecords.reduce((sum, record) => {
                return sum + (parseFloat(record.amount) || 0);
            }, 0);
        },
        
        // 平均退水比例
        averageRebatePercentage() {
            if (this.filteredRebateRecords.length === 0) return '0.0';
            
            const totalPercentage = this.filteredRebateRecords.reduce((sum, record) => {
                return sum + ((parseFloat(record.rebate_percentage) || 0) * 100);
            }, 0);
            
            return (totalPercentage / this.filteredRebateRecords.length).toFixed(1);
        },
        
        // 计算選中的限紅配置
        selectedLimitConfig() {
            if (!this.bettingLimitData.newLimitLevel || !this.bettingLimitData.configs.length) {
                return {};
            }
            
            const selectedConfig = this.bettingLimitData.configs.find(
                config => config.level_name === this.bettingLimitData.newLimitLevel
            );
            
            return selectedConfig ? selectedConfig.config : {};
        },
        
        // 計算可用的最大退水比例（用於新增代理時的限制）
        availableMaxRebatePercentage() {
            // 確定使用的管理代理
            let managingAgent;
            if (this.activeTab === 'accounts' && this.currentMemberManagingAgent && this.currentMemberManagingAgent.id) {
                managingAgent = this.currentMemberManagingAgent;
            } else {
                managingAgent = this.currentManagingAgent;
            }
            
            // 如果沒有管理代理，回退到用戶自己
            if (!managingAgent || !managingAgent.id) {
                managingAgent = this.user;
            }
            
            console.log('🔍 第一步 - 確定管理代理:', {
                managingAgent: managingAgent.username,
                level: managingAgent.level,
                rebate_percentage: managingAgent.rebate_percentage,
                max_rebate_percentage: managingAgent.max_rebate_percentage,
                market_type: managingAgent.market_type
            });
            
            // 修復：區分總代理和一般代理的邏輯
            let actualRebatePercentage;
            
            // 如果是總代理（level 0），應該使用盤口的全部退水限制
            if (managingAgent.level === 0) {
                const marketType = managingAgent.market_type || this.user.market_type || 'D';
                actualRebatePercentage = marketType === 'A' ? 0.011 : 0.041; // A盤1.1%，D盤4.1%
                console.log('🔍 第二步 - 總代理使用盤口全部退水:', actualRebatePercentage, '(' + marketType + '盤)');
            } else {
                // 一般代理：使用該代理被分配到的退水比例（rebate_percentage）
                actualRebatePercentage = managingAgent.rebate_percentage;
                
                console.log('🔍 第二步 - 一般代理使用 rebate_percentage:', actualRebatePercentage, typeof actualRebatePercentage);
                
                // 確保轉換為數字類型
                if (actualRebatePercentage !== undefined && actualRebatePercentage !== null && actualRebatePercentage !== '') {
                    actualRebatePercentage = parseFloat(actualRebatePercentage);
                    console.log('🔍 第三步 - parseFloat 後:', actualRebatePercentage);
                } else {
                    actualRebatePercentage = null;
                    console.log('🔍 第三步 - rebate_percentage 為空或undefined');
                }
                
                // 如果 rebate_percentage 無效，使用 max_rebate_percentage
                if (actualRebatePercentage === null || isNaN(actualRebatePercentage) || actualRebatePercentage <= 0) {
                    console.log('🔍 第四步 - rebate_percentage 無效，使用 max_rebate_percentage');
                    actualRebatePercentage = parseFloat(managingAgent.max_rebate_percentage) || 0;
                    console.log('🔍 第四步 - 使用 max_rebate_percentage:', actualRebatePercentage);
                }
                
                // 最後的兜底邏輯：如果還是沒有有效值，根據盤口類型使用默認值
                if (isNaN(actualRebatePercentage) || actualRebatePercentage <= 0) {
                    const marketType = managingAgent.market_type || this.user.market_type || 'D';
                    actualRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
                    console.log('🔍 第五步 - 使用盤口默認值:', actualRebatePercentage);
                }
            }
            
            console.log('💡 計算 availableMaxRebatePercentage 最終結果:', {
                managingAgent: managingAgent.username,
                level: managingAgent.level,
                isTotalAgent: managingAgent.level === 0,
                原始_rebate_percentage: managingAgent.rebate_percentage,
                原始_max_rebate_percentage: managingAgent.max_rebate_percentage,
                最終使用值: actualRebatePercentage,
                顯示百分比: (actualRebatePercentage * 100).toFixed(1) + '%'
            });
            
            return actualRebatePercentage;
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
                this.loadHierarchicalMembers();
            }
            if (newTab === 'agents') {
                this.searchAgents();
            }
            if (newTab === 'draw') {
                this.loadDrawHistory();
            }
            if (newTab === 'stats') {
                // 載入下注記錄頁面時，先載入直屬會員列表（預設模式）
                this.loadDirectMembersForBets();
                this.searchBets();
            }
            if (newTab === 'notices') {
                this.fetchNotices();
            }
            if (newTab === 'transactions' && this.transactionTab === 'transfers') {
                this.loadPointTransfers();
            }
            if (newTab === 'reports') {
                // 載入報表查詢頁面時，自動執行一次查詢（今日報表）
                this.searchReports();
            }
            if (newTab === 'login-logs') {
                // 載入登錄日誌頁面時，自動執行一次查詢（最近7天）
                this.loadLoginLogs();
            }
                                 if (newTab === 'customer-service' && this.user.level === 0) {
                         this.loadCSTransactions();
                     }
        },
        transactionTab(newTab, oldTab) {
            if (this.activeTab === 'transactions') {
                if (newTab === 'transfers') {
                    this.loadPointTransfers();
                } else if (newTab === 'rebate') {
                    this.loadRebateRecords();
                } else if (newTab === 'deposit') {
                    this.loadDepositRecords();
                } else if (newTab === 'withdraw') {
                    this.loadWithdrawRecords();
                }
            }
        },
        
        // 監聽輸贏控制模式變更
        'newWinLossControl.control_mode'(newMode, oldMode) {
            console.log('控制模式變更:', oldMode, '->', newMode);
            
            // 當切換到自動偵測模式時，重置相關設定
            if (newMode === 'auto_detect') {
                // 自動偵測模式不需要手動設定比例和控制類型
                this.newWinLossControl.control_percentage = 50; // 保留預設值但不顯示
                this.newWinLossControl.win_control = false;
                this.newWinLossControl.loss_control = false;
                this.newWinLossControl.target_type = '';
                this.newWinLossControl.target_username = '';
                console.log('✅ 自動偵測模式：已清空手動設定');
            }
            
            // 當切換到正常模式時，清空所有控制設定
            if (newMode === 'normal') {
                this.newWinLossControl.control_percentage = 50;
                this.newWinLossControl.win_control = false;
                this.newWinLossControl.loss_control = false;
                this.newWinLossControl.target_type = '';
                this.newWinLossControl.target_username = '';
                this.newWinLossControl.start_period = null;
                console.log('✅ 正常模式：已清空所有控制設定');
            }
            
            // 當切換到其他模式時，確保有合理的預設值
            if (newMode === 'agent_line' || newMode === 'single_member') {
                if (!this.newWinLossControl.control_percentage) {
                    this.newWinLossControl.control_percentage = 50;
                }
                console.log('✅', newMode, '模式：已設定預設比例');
            }
        }
    }
});

// 延遲掛載 Vue 应用，确保所有依賴都已载入
setTimeout(function() {
    console.log('延遲掛載 Vue 应用');
    console.log('Vue 可用性:', typeof Vue);
    console.log('Document 狀態:', document.readyState);
    
    const appElement = document.getElementById('app');
    console.log('找到 app 元素:', appElement);
    
    if (appElement && typeof Vue !== 'undefined') {
        try {
            // 检查是否已经掛載過
            if (appElement.__vue_app__) {
                console.log('Vue 应用已经掛載過，跳過');
                return;
            }
            
            const mountedApp = app.mount('#app');
            console.log('Vue 应用掛載成功:', mountedApp);
            // 暴露到全域方便除錯
            window.vueApp = mountedApp;
            
            // 添加全域調試函數
            window.debugVue = function() {
                console.log('=== Vue 除錯资讯 ===');
                console.log('Vue 實例:', mountedApp);
                console.log('showNoticeForm:', mountedApp.showNoticeForm);
                console.log('noticeForm:', mountedApp.noticeForm);
                console.log('isCustomerService:', mountedApp.isCustomerService);
                
                // 测试顯示公告表單
                console.log('测试顯示公告表單...');
                mountedApp.startEditNotice({
                    id: 1,
                    title: '测试公告',
                    content: '這是测试內容',
                    category: '最新公告'
                });
            };
            
            window.closeForm = function() {
                mountedApp.showNoticeForm = false;
                console.log('強制关闭公告表單');
            };
            
            console.log('全域除錯函數已添加：debugVue() 和 closeForm()');
            
            // 額外检查：确保響應式變數正常工作
            setTimeout(() => {
                if (mountedApp && mountedApp.noticeForm) {
                    console.log('Vue 響應式數據检查:', {
                        noticeForm: mountedApp.noticeForm,
                        showNoticeForm: mountedApp.showNoticeForm
                    });
                }
            }, 1000);
            
        } catch (error) {
            console.error('Vue 应用掛載失败:', error);
            console.error('错误詳情:', error.stack);
            
            // 嘗試重新整理頁面
            setTimeout(() => {
                if (confirm('系统载入失败，是否重新整理頁面？')) {
                    window.location.reload();
                }
            }, 2000);
        }
    } else {
        console.error('條件不滿足:', {
            appElement: !!appElement,
            Vue: typeof Vue
        });
        
        // 嘗試等待更長时间
        setTimeout(arguments.callee, 500);
    }
}, 100);

