// 投注記錄組件 - 顯示用戶的下注記錄和派彩結果
Vue.component('bet-records', {
  // 使用render函數而不是template字符串，避免TypeScript錯誤提示
  props: {
    records: {
      type: Array,
      default: () => []
    }
  },
  
  data() {
    return {
      activeTab: 'ongoing',
      drawResults: {} // 存儲各期開獎結果，格式: { period: [result] }
    }
  },
  
  computed: {
    filteredRecords() {
      if (this.activeTab === 'ongoing') {
        return this.records.filter(bet => !bet.settled);
      } else {
        return this.records.filter(bet => bet.settled);
      }
    }
  },
  
  watch: {
    records: {
      handler(newRecords) {
        if (newRecords && newRecords.length > 0) {
          this.fetchDrawResults(newRecords);
        }
      },
      immediate: true
    }
  },
  
  methods: {
    getBetStatus(bet) {
      if (!bet.settled) return '進行中';
      return bet.win ? '贏' : '輸';
    },
    
    getBetTypeDesc(bet) {
      const typeMap = {
        'sumValue': '冠亞和',
        'champion': '冠軍',
        'runnerup': '亞軍',
        'third': '第三名',
        'fourth': '第四名',
        'fifth': '第五名',
        'sixth': '第六名',
        'seventh': '第七名',
        'eighth': '第八名',
        'ninth': '第九名',
        'tenth': '第十名',
        'dragonTiger': '龍虎',
        'number': '單號'
      };
      
      const betType = bet.type || bet.betType;
      if (!betType) return '未知類型';
      
      if (betType === 'number') {
        return `第${bet.position}名號碼`;
      } else if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType) && 
                 ['big', 'small', 'odd', 'even'].includes(bet.value)) {
        return `${typeMap[betType]} 雙面`;
      } else if (betType === 'sumValue' && ['big', 'small', 'odd', 'even'].includes(bet.value)) {
        return '冠亞和 雙面';
      } else if (betType === 'dragonTiger') {
        return '龍虎';
      }
      
      return typeMap[betType] || betType;
    },
    
    getBetValueDesc(bet) {
      const betType = bet.type || bet.betType;
      const betValue = bet.value || bet.betValue;
      
      // 添加熱門標記顯示邏輯
      let isHot = bet.isHot || false;
      let hotDisplay = isHot ? '<span class="hot-badge">熱門</span>' : '';
      
      if (!betValue) return '無';
      
      if (betType === 'dragonTiger') {
        const dragonTigerMap = {
          'dragon': '龍',
          'tiger': '虎'
        };
        return dragonTigerMap[betValue] + hotDisplay;
      } else if (['big', 'small', 'odd', 'even'].includes(betValue)) {
        const valueMap = {
          'big': '大',
          'small': '小',
          'odd': '單',
          'even': '雙'
        };
        return valueMap[betValue] + hotDisplay;
      } else if (betType === 'sumValue' && !isNaN(betValue)) {
        return `總和值 ${betValue}` + hotDisplay;
      } else if (!isNaN(betValue)) {
        return `號碼 ${betValue}` + hotDisplay;
      }
      
      return betValue + hotDisplay;
    },
    
    formatTime(time) {
      if (!time) return '';
      const date = new Date(time);
      return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    },
    
    formatOdds(odds) {
      if (!odds) return ''; 
      // 將賠率顯示為帶兩位小數的數字
      const oddsNum = parseFloat(odds);
      return oddsNum ? oddsNum.toFixed(2) : '';
    },
    
    // 獲取投注記錄對應的開獎結果
    async fetchDrawResults(records) {
      try {
        // 提取所有未獲取過的期數
        const periods = [...new Set(records.map(bet => bet.period))];
        const missingPeriods = periods.filter(period => !this.drawResults[period]);
        
        if (missingPeriods.length === 0) return;
        
        // 批量獲取開獎結果
        for (const period of missingPeriods) {
          try {
                            const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                    ? 'http://localhost:3002' : '';
                const response = await fetch(`${apiBase}/api/history?period=${period}&limit=1`);
            const data = await response.json();
            
            if (data.success && data.records && data.records.length > 0) {
              this.drawResults[period] = data.records[0].result;
            }
          } catch (error) {
            console.error(`獲取期數 ${period} 開獎結果失敗:`, error);
          }
        }
        
        // 強制更新組件
        this.$forceUpdate();
      } catch (error) {
        console.error('獲取開獎結果失敗:', error);
      }
    },
    
    // 獲取指定期數的開獎結果
    getDrawResult(period) {
      return this.drawResults[period] || null;
    }
  },
  
  render(h) {
    // 使用render函數創建模板，避免TypeScript檢查錯誤
    return h('div', { class: 'bet-records' }, [
      // 頭部
      h('div', { class: 'record-header' }, [
        h('div', { class: 'title' }, '投注記錄'),
        h('button', { 
          class: 'close-btn',
          on: { click: () => this.$emit('close') } 
        }, '×')
      ]),
      
      // 標籤頁
      h('div', { class: 'record-tabs' }, [
        h('div', { 
          class: ['tab', this.activeTab === 'ongoing' ? 'active' : ''],
          on: { click: () => this.activeTab = 'ongoing' } 
        }, '進行中'),
        h('div', { 
          class: ['tab', this.activeTab === 'settled' ? 'active' : ''],
          on: { click: () => this.activeTab = 'settled' } 
        }, '已結算')
      ]),
      
      // 記錄列表
      this.filteredRecords.length > 0 
        ? h('div', { class: 'record-list' }, 
            this.filteredRecords.map(bet => 
              h('div', { class: 'record-item', key: bet.id }, [
                // 頂部信息：期數和狀態
                h('div', { class: 'record-top' }, [
                  h('div', { class: 'period' }, `${bet.period}期`),
                  h('div', { 
                    class: ['status', bet.settled ? (bet.win ? 'win' : 'lose') : 'ongoing'] 
                  }, this.getBetStatus(bet))
                ]),
                
                // 投注資訊區域：投注類型和選項
                h('div', { class: 'record-bet-info' }, [
                  h('div', { class: 'bet-detail-row' }, [
                    h('span', { class: 'bet-label' }, '投注類型:'),
                    h('span', { class: 'bet-value' }, this.getBetTypeDesc(bet)),
                  ]),
                  h('div', { class: 'bet-detail-row' }, [
                    h('span', { class: 'bet-label' }, '投注選項:'),
                    h('span', { class: 'bet-value' }, this.getBetValueDesc(bet)),
                  ]),
                  h('div', { class: 'bet-detail-row' }, [
                    h('span', { class: 'bet-label' }, '賠率:'),
                    h('span', { class: 'bet-value' }, this.formatOdds(bet.odds) || '1.95'),
                  ]),
                  // 開獎號碼顯示
                  this.getDrawResult(bet.period) ? 
                    h('div', { class: 'bet-detail-row draw-result-row' }, [
                      h('span', { class: 'bet-label' }, '開獎號碼:'),
                      h('div', { class: 'draw-result-balls' }, 
                        this.getDrawResult(bet.period).map((number, index) =>
                          h('div', { 
                            class: ['result-ball', 'color-' + number],
                            key: index
                          }, number)
                        )
                      )
                    ]) : null
                ]),
                
                // 底部信息：金額和時間
                h('div', { class: 'record-bottom' }, [
                  // 時間信息
                  h('div', { class: 'bet-time-info' }, [
                    h('span', { class: 'bet-label' }, '下注時間:'),
                    h('span', { class: 'time-value' }, this.formatTime(bet.time))
                  ]),
                  
                  // 金額信息
                  h('div', { class: 'bet-amount-info' }, [
                    h('div', { class: 'amount-row' }, [
                      h('span', { class: 'amount-label' }, '下注金額:'),
                      h('span', { class: 'amount-value' }, `$${bet.amount}`)
                    ]),
                    bet.settled && bet.win && bet.winAmount ? 
                      h('div', { class: 'amount-row win-amount' }, [
                        h('span', { class: 'amount-label' }, '派彩金額:'),
                        h('span', { class: 'amount-value' }, `$${bet.winAmount}`)
                      ]) : null
                  ])
                ])
              ])
            )
          )
        : h('div', { class: 'no-records' }, '暫無記錄')
    ]);
  }
});