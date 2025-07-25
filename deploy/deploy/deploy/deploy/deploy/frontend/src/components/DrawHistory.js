// filepath: /Users/justin/Desktop/Bet/frontend/src/components/DrawHistory.js
// 开奖历史組件 - 显示历史开奖结果，支持多種視圖模式
Vue.component('draw-history', {
  template: /* html */`
    <div class="draw-history">
      <div class="history-header">
        <div class="title">历史开奖</div>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div class="draw-type-tabs">
        <div class="tabs">
          <div :class="['tab', viewMode === 'number' ? 'active' : '']" @click="viewMode = 'number'">号码</div>
          <div :class="['tab', viewMode === 'bigSmall' ? 'active' : '']" @click="viewMode = 'bigSmall'">大小</div>
          <div :class="['tab', viewMode === 'oddEven' ? 'active' : '']" @click="viewMode = 'oddEven'">單双</div>
          <div :class="['tab', viewMode === 'dragonTiger' ? 'active' : '']" @click="viewMode = 'dragonTiger'">冠亞和/龙虎</div>
        </div>
      </div>
      
      <!-- 日期选择區域 -->
      <div class="date-selector">
        <div class="current-date" @click="showDatePicker = !showDatePicker">
          {{ formatDate(selectedDate) }} <i class="fas fa-calendar-alt"></i>
        </div>
        <!-- 日期选择器彈窗 -->
        <div class="date-picker" v-if="showDatePicker">
          <div class="picker-header">
            <button @click="changeMonth(-1)">&lt;</button>
            <div class="month-year">{{ currentMonth }}月 <span @click="toggleYearSelector">{{ currentYear }}</span></div>
            <button @click="changeMonth(1)">&gt;</button>
          </div>
          
          <div class="weekdays">
            <div class="weekday" v-for="day in ['周日', '周一', '周二', '周三', '周四', '周五', '周六']">{{ day }}</div>
          </div>
          
          <div class="days">
            <div v-for="day in calendarDays" 
                 :class="['day', day.currentMonth ? '' : 'other-month', day.date.toDateString() === selectedDate.toDateString() ? 'selected' : '']"
                 @click="selectDate(day.date)">
              {{ day.date.getDate() }}
            </div>
          </div>
          
          <div class="picker-actions">
            <button class="cancel-btn" @click="showDatePicker = false">取消</button>
            <button class="confirm-btn" @click="confirmDateSelection">确认</button>
          </div>
        </div>
      </div>
      
      <!-- 开奖记录列表 -->
      <div class="history-list">
        <!-- 号码視圖 -->
        <div v-if="viewMode === 'number'" class="number-view">
          <div v-for="(record, index) in historyRecords" :key="record.period" class="history-item">
            <div class="period-info">
              <div class="period">{{ record.period }}期</div>
              <div class="time">{{ formatTime(record.time) }}</div>
            </div>
            <div class="result-balls">
              <div v-for="(number, ballIndex) in record.result" :key="ballIndex" 
                   :class="['number-ball', 'color-' + number]">
                {{ number }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 大小視圖 -->
        <div v-if="viewMode === 'bigSmall'" class="bigsmall-view">
          <div v-for="(record, index) in historyRecords" :key="record.period" class="history-item">
            <div class="period-info">
              <div class="period">{{ record.period }}期</div>
              <div class="time">{{ formatTime(record.time) }}</div>
            </div>
            <div class="result-indicators">
              <div v-for="(number, ballIndex) in record.result" :key="ballIndex" 
                   :class="['indicator', number > 5 ? 'big' : 'small']">
                {{ number > 5 ? '大' : '小' }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 單双視圖 -->
        <div v-if="viewMode === 'oddEven'" class="oddeven-view">
          <div v-for="(record, index) in historyRecords" :key="record.period" class="history-item">
            <div class="period-info">
              <div class="period">{{ record.period }}期</div>
              <div class="time">{{ formatTime(record.time) }}</div>
            </div>
            <div class="result-indicators">
              <div v-for="(number, ballIndex) in record.result" :key="ballIndex" 
                   :class="['indicator', number % 2 === 1 ? 'odd' : 'even']">
                {{ number % 2 === 1 ? '單' : '双' }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 冠亞和/龙虎視圖 -->
        <div v-if="viewMode === 'dragonTiger'" class="dragontiger-view">
          <div v-for="(record, index) in historyRecords" :key="record.period" class="history-item">
            <div class="period-info">
              <div class="period">{{ record.period }}期</div>
              <div class="time">{{ formatTime(record.time) }}</div>
            </div>
            <div class="special-values">
              <div class="sum-value">
                {{ record.result[0] + record.result[1] }} 
                <span :class="getSumClass(record.result[0] + record.result[1])">
                  {{ getSumLabel(record.result[0] + record.result[1]) }}
                </span>
              </div>
              <div class="dragon-tiger">
                <span :class="record.result[0] > record.result[1] ? 'dragon' : 'tiger'">
                  {{ record.result[0] > record.result[1] ? '龙' : '虎' }}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 加载更多按钮 -->
        <div class="load-more" @click="loadMoreHistory" v-if="hasMoreHistory">
          查看更多开奖结果
        </div>
        
        <!-- 無记录提示 -->
        <div class="no-records" v-if="historyRecords.length === 0">
          暫無开奖记录
        </div>
      </div>
    </div>
  `,
  
  props: {
    initialDate: {
      type: Date,
      default: () => new Date()
    }
  },
  
  data() {
    return {
      viewMode: 'number', // 視圖模式: number, bigSmall, oddEven, dragonTiger
      historyRecords: [], // 历史记录
      selectedDate: new Date(), // 当前选中日期
      currentYear: new Date().getFullYear(), // 当前日曆年份
      currentMonth: new Date().getMonth() + 1, // 当前日曆月份
      showDatePicker: false, // 是否显示日期选择器
      hasMoreHistory: true, // 是否有更多历史记录
      page: 1, // 当前页碼
      itemsPerPage: 10 // 每页记录數
    };
  },
  
  computed: {
    // 计算日曆天數
    calendarDays() {
      const year = this.currentYear;
      const month = this.currentMonth - 1;
      
      // 获取当前月份第一天
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      
      // 获取当前月份第一天是星期幾
      const firstDayWeekday = firstDayOfMonth.getDay();
      
      // 获取上个月的最后幾天
      const days = [];
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      
      // 添加上个月的日期
      for (let i = 0; i < firstDayWeekday; i++) {
        const date = new Date(year, month - 1, prevMonthLastDay - firstDayWeekday + i + 1);
        days.push({ date, currentMonth: false });
      }
      
      // 添加当前月份的日期
      for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
        const date = new Date(year, month, i);
        days.push({ date, currentMonth: true });
      }
      
      // 添加下个月的日期
      const remainingDays = 42 - days.length;
      for (let i = 1; i <= remainingDays; i++) {
        const date = new Date(year, month + 1, i);
        days.push({ date, currentMonth: false });
      }
      
      return days;
    }
  },
  
  created() {
    // 设置初始日期
    if (this.initialDate) {
      this.selectedDate = new Date(this.initialDate);
      this.currentYear = this.selectedDate.getFullYear();
      this.currentMonth = this.selectedDate.getMonth() + 1;
    }
    
    // 载入初始历史记录
    this.loadHistoryRecords();
  },
  
  methods: {
    // 载入历史记录
    async loadHistoryRecords() {
      try {
        // 格式化日期为YYYYMMDD格式
        const dateStr = this.formatDateForApi(this.selectedDate);
        
        const response = await axios.get(`${API_BASE_URL}/history`, {
          params: {
            date: dateStr,
            page: this.page,
            limit: this.itemsPerPage
          }
        });
        
        if (this.page === 1) {
          // 首次载入替換所有记录
          this.historyRecords = response.data.records || [];
        } else {
          // 加载更多时追加记录
          this.historyRecords = [...this.historyRecords, ...(response.data.records || [])];
        }
        
        // 判断是否还有更多记录
        this.hasMoreHistory = (response.data.records || []).length >= this.itemsPerPage;
      } catch (error) {
        console.error('获取历史记录失败:', error);
      }
    },
    
    // 载入更多历史记录
    loadMoreHistory() {
      this.page++;
      this.loadHistoryRecords();
    },
    
    // 选择日期
    selectDate(date) {
      this.selectedDate = new Date(date);
    },
    
    // 确认日期选择
    confirmDateSelection() {
      this.showDatePicker = false;
      this.page = 1;
      this.loadHistoryRecords();
    },
    
    // 改變月份
    changeMonth(diff) {
      let newMonth = this.currentMonth + diff;
      let newYear = this.currentYear;
      
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      } else if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
      
      this.currentMonth = newMonth;
      this.currentYear = newYear;
    },
    
    // 切換年份选择器
    toggleYearSelector() {
      // 这里可以實現年份选择的彈窗
      // 簡化版先不實現
    },
    
    // 格式化日期显示
    formatDate(date) {
      if (!date) return '';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },
    
    // 格式化日期为API请求格式
    formatDateForApi(date) {
      if (!date) return '';
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },
    
    // 格式化时间显示
    formatTime(time) {
      if (!time) return '';
      const date = new Date(time);
      // 直接使用本地时间，不需要手动转换
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    },
    
    // 获取和值的樣式類
    getSumClass(sum) {
      let classes = [];
      if (sum > 11) {
        classes.push('big');
      } else {
        classes.push('small');
      }
      
      if (sum % 2 === 1) {
        classes.push('odd');
      } else {
        classes.push('even');
      }
      
      return classes.join(' ');
    },
    
    // 获取和值的標籤
    getSumLabel(sum) {
      let label = '';
      if (sum > 11) {
        label += '大';
      } else {
        label += '小';
      }
      
      if (sum % 2 === 1) {
        label += '單';
      } else {
        label += '双';
      }
      
      return label;
    }
  }
});