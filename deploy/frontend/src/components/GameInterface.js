// filepath: /Users/justin/Desktop/Bet/frontend/src/components/GameInterface.js
// 游戏界面主组件 - 根据设备类型提供适当的游戏界面布局

Vue.component('game-interface', {
  props: {
    // 接受父组件传递的赔率
    parentOdds: {
      type: Object,
      default: () => ({})
    },
    // 接受父组件传递的用户市场类型
    userMarketType: {
      type: String,
      default: 'D'
    }
  },
  template: /* html */`
    <div class="game-interface game-container">
      <!-- 比赛结果显示区 -->
      <div class="race-result">
        <h2 class="result-title">FS金彩赛车 第{{currentPeriod}}期</h2>
        <div class="countdown">
          <div class="countdown-label">距离下期开奖:</div>
          <div class="countdown-timer">{{formatCountdown(countdown)}}</div>
        </div>
        
        <!-- 赛车轨道区域 - 根据设备类型有不同布局 -->
        <div class="race-track" :class="{'desktop-layout': isDesktop}">
          <!-- 赛车内容（游戏动画）-->
          <div class="racing-content">
            <!-- 赛车会在这里动画显示 -->
          </div>
          
          <!-- 当前开奖结果 - 球号显示 -->
          <div class="current-result">
            <div v-for="(number, index) in currentResult" :key="index" 
                 :class="['number-ball', 'color-' + number]">
              {{ number }}
            </div>
          </div>
        </div>
      </div>
      
      <!-- 下注区域 - 根据设备类型自动调整排列方向 -->
      <div class="betting-area">
        <!-- 下注选项 -->
        <div class="bet-options">
          <div class="bet-type-tabs">
            <div :class="['tab', activeTab === 'number' ? 'active' : '']" 
                 @click="activeTab = 'number'">号码</div>
            <div :class="['tab', activeTab === 'bigSmall' ? 'active' : '']" 
                 @click="activeTab = 'bigSmall'">大小</div>
            <div :class="['tab', activeTab === 'oddEven' ? 'active' : '']" 
                 @click="activeTab = 'oddEven'">单双</div>
            <div :class="['tab', activeTab === 'combo' ? 'active' : '']" 
                 @click="activeTab = 'combo'">冠亚和/龙虎</div>
          </div>
          
          <div class="betting-content">
            <!-- 号码投注 -->
            <div v-if="activeTab === 'number'" class="number-betting">
              <div class="ball-grid">
                <div v-for="num in 10" :key="num-1" 
                     :class="['ball-option', {'selected': isBetSelected('number', num-1)}]" 
                     @click="toggleBet('number', num-1)">
                  <div :class="['number-ball', 'color-' + (num-1)]">{{ num-1 }}</div>
                  <div class="odds">{{getBetOdds('number', num-1)}}</div>
                </div>
              </div>
            </div>
            
            <!-- 大小投注 -->
            <div v-if="activeTab === 'bigSmall'" class="bigsmall-betting">
              <div class="option-row">
                <div v-for="(option, index) in ['大', '小']" :key="index"
                     :class="['bet-option', {'selected': isBetSelected('bigSmall', option)}]" 
                     @click="toggleBet('bigSmall', option)">
                  <div class="option-label">{{ option }}</div>
                  <div class="odds">{{getBetOdds('bigSmall', option)}}</div>
                </div>
              </div>
            </div>
            
            <!-- 单双投注 -->
            <div v-if="activeTab === 'oddEven'" class="oddeven-betting">
              <div class="option-row">
                <div v-for="(option, index) in ['单', '双']" :key="index"
                     :class="['bet-option', {'selected': isBetSelected('oddEven', option)}]" 
                     @click="toggleBet('oddEven', option)">
                  <div class="option-label">{{ option }}</div>
                  <div class="odds">{{getBetOdds('oddEven', option)}}</div>
                </div>
              </div>
            </div>
            
            <!-- 冠亚和/龙虎投注 -->
            <div v-if="activeTab === 'combo'" class="combo-betting">
              <div class="option-section">
                <h3>冠亚和</h3>
                <div class="combo-grid">
                  <div v-for="sum in 19" :key="'sum-' + sum"
                       :class="['bet-option', {'selected': isBetSelected('sum', sum)}]" 
                       @click="toggleBet('sum', sum)">
                    <div class="option-label">{{ sum }}</div>
                    <div class="odds">{{getBetOdds('sum', sum)}}</div>
                  </div>
                </div>
              </div>
              
              <div class="option-section">
                <h3>龙虎</h3>
                <div class="option-row">
                  <div v-for="(option, index) in ['龙', '虎', '和']" :key="index"
                       :class="['bet-option', {'selected': isBetSelected('dragonTiger', option)}]" 
                       @click="toggleBet('dragonTiger', option)">
                    <div class="option-label">{{ option }}</div>
                    <div class="odds">{{getBetOdds('dragonTiger', option)}}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 投注单 -->
        <div class="bet-sidebar">
          <div class="bet-slip">
            <h3>投注单</h3>
            <div class="bet-list">
              <div v-for="(bet, index) in currentBets" :key="index" class="bet-item">
                <div class="bet-info">
                  <span class="bet-type">{{ getBetTypeLabel(bet.type) }}</span>
                  <span class="bet-value">{{ bet.value }}</span>
                  <span class="bet-odds">{{ bet.odds }}</span>
                </div>
                <div class="bet-amount">
                  <input type="number" v-model="bet.amount" placeholder="金额">
                  <button class="remove-bet" @click="removeBet(index)">×</button>
                </div>
              </div>
            </div>
            <div class="bet-actions">
              <div class="total-info">
                <div>总金额: {{calculateTotalAmount()}}</div>
                <div>可赢金额: {{calculatePossibleWin()}}</div>
              </div>
              <button class="place-bet-btn" @click="placeBets" :disabled="!canPlaceBet">投注</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 显示/隐藏历史记录控制按钮 - 现在放在顶部 -->
      <div class="history-buttons">
        <button @click="toggleHistory" class="history-control-btn">
          {{ showHistory ? '关闭开奖历史' : '开奖历史' }}
        </button>
        <button @click="toggleBetRecords" class="history-control-btn">
          {{ showBetRecords ? '关闭住单资讯' : '住单资讯' }}
        </button>
      </div>
      
      <!-- 历史记录区域 - 浮动复盖显示 -->
      <div class="modal-overlay" v-if="showHistory || showBetRecords" @click="closeAllModals"></div>
      
      <div class="history-modal" v-if="showHistory">
        <draw-history 
          :initialDate="new Date()" 
          @close="showHistory = false">
        </draw-history>
      </div>
      
      <div class="history-modal" v-if="showBetRecords">
        <bet-records 
          :userId="userId" 
          @close="showBetRecords = false">
        </bet-records>
      </div>
    </div>
  `,
  
  data() {
    return {
      isDesktop: false, // 是否为桌面设备
      activeTab: 'number', // 当前活跃的投注标签
      currentPeriod: '20230001', // 当前期数
      countdown: 60, // 倒计时（秒）
      currentResult: [1, 3, 5, 7, 9, 2, 4, 6, 8, 0], // 当前开奖结果
      currentBets: [], // 当前投注清单
      userId: 'user123', // 用户ID
      showHistory: false, // 是否显示开奖历史
      showBetRecords: false, // 是否显示投注记录
      // 赔率表 - 通常从伺服器加载
      odds: {
        number: [9.8, 9.8, 9.8, 9.8, 9.8, 9.8, 9.8, 9.8, 9.8, 9.8],
        bigSmall: { '大': 1.95, '小': 1.95 },
        oddEven: { '单': 1.95, '双': 1.95 },
        sum: { 3: 40, 4: 20, 5: 10, 6: 8, 7: 7, 8: 6, 9: 5, 10: 4.5, 11: 4, 
               12: 4, 13: 4.5, 14: 5, 15: 6, 16: 7, 17: 8, 18: 10, 19: 20 },
        dragonTiger: { '龙': 1.95, '虎': 1.95, '和': 9.0 }
      }
    };
  },
  
  computed: {
    // 是否可以下注
    canPlaceBet() {
      return this.currentBets.length > 0 && 
             this.currentBets.every(bet => bet.amount > 0 && !isNaN(bet.amount));
    }
  },
  
  created() {
    // 监听设备检测模组的事件
    this.checkDeviceType();
    window.addEventListener('resize', this.checkDeviceType);
    
    // 模拟倒计时更新
    this.startCountdown();
  },
  
  beforeDestroy() {
    window.removeEventListener('resize', this.checkDeviceType);
    clearInterval(this.countdownInterval);
  },
  
  methods: {
    // 检查设备类型
    checkDeviceType() {
      if (window.DeviceDetector) {
        this.isDesktop = window.DeviceDetector.detectDevice() === 'desktop';
        
        // 在桌面设备上同时显示两个历史记录区域
        if (this.isDesktop) {
          this.showHistory = true;
          this.showBetRecords = true;
        }
      }
    },
    
    // 格式化倒计时显示
    formatCountdown(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs < 10 ? '0' + secs : secs}`;
    },
    
    // 开始倒计时
    startCountdown() {
      this.countdownInterval = setInterval(() => {
        if (this.countdown > 0) {
          this.countdown--;
        } else {
          // 当倒计时结束时，模拟新的一期开始
          this.countdown = 60; // 重设倒计时
          this.currentPeriod = String(parseInt(this.currentPeriod) + 1); // 更新期数
          this.generateNewResult(); // 生成新的结果
        }
      }, 1000);
    },
    
    // 生成新的开奖结果（模拟）
    generateNewResult() {
      // 随机生成10个不重复的数字（0-9）
      const numbers = Array.from({length: 10}, (_, i) => i);
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]]; // 洗牌算法
      }
      this.currentResult = numbers;
    },
    
    // 检查投注是否被选中
    isBetSelected(type, value) {
      return this.currentBets.some(bet => bet.type === type && bet.value === value);
    },
    
    // 切换投注选择
    toggleBet(type, value) {
      const index = this.currentBets.findIndex(bet => bet.type === type && bet.value === value);
      if (index === -1) {
        // 添加新投注
        this.currentBets.push({
          type: type,
          value: value,
          odds: this.getBetOdds(type, value),
          amount: ''
        });
      } else {
        // 移除已有投注
        this.removeBet(index);
      }
    },
    
    // 获取投注赔率
    getBetOdds(type, value) {
      if (type === 'number') {
        return this.parentOdds.number[value] || this.odds.number[value];
      } else if (type === 'bigSmall') {
        return this.parentOdds.bigSmall[value] || this.odds.bigSmall[value];
      } else if (type === 'oddEven') {
        return this.parentOdds.oddEven[value] || this.odds.oddEven[value];
      } else if (type === 'sum') {
        return this.parentOdds.sum[value] || this.odds.sum[value] || 0;
      } else if (type === 'dragonTiger') {
        return this.parentOdds.dragonTiger[value] || this.odds.dragonTiger[value];
      }
      return 0;
    },
    
    // 移除投注
    removeBet(index) {
      this.currentBets.splice(index, 1);
    },
    
    // 计算总金额
    calculateTotalAmount() {
      return this.currentBets.reduce((total, bet) => {
        return total + (parseFloat(bet.amount) || 0);
      }, 0).toFixed(2);
    },
    
    // 计算可能获胜金额
    calculatePossibleWin() {
      return this.currentBets.reduce((total, bet) => {
        return total + (parseFloat(bet.amount) || 0) * parseFloat(bet.odds);
      }, 0).toFixed(2);
    },
    
    // 提交投注（实际应用中会发送到伺服器）
    placeBets() {
      if (!this.canPlaceBet) return;
      
      // 这里应该有API调用将投注发送到伺服器
      alert(`已投注 ${this.calculateTotalAmount()} 元`);
      
      // 清空投注单
      this.currentBets = [];
    },
    
    // 获取投注类型标签
    getBetTypeLabel(type) {
      const typeMap = {
        'number': '号码',
        'bigSmall': '大小',
        'oddEven': '单双',
        'sum': '冠亚和',
        'dragonTiger': '龙虎'
      };
      return typeMap[type] || type;
    },
    
    // 切换开奖历史显示
    toggleHistory() {
      this.showHistory = !this.showHistory;
      // 确保不会同时显示两个模态窗口
      if (this.showHistory) this.showBetRecords = false;
    },
    
    // 切换投注记录显示
    toggleBetRecords() {
      this.showBetRecords = !this.showBetRecords;
      // 确保不会同时显示两个模态窗口
      if (this.showBetRecords) this.showHistory = false;
    },
    
    // 关闭所有模态窗口
    closeAllModals() {
      this.showHistory = false;
      this.showBetRecords = false;
    }
  }
}); 