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
      activeTab: 'ongoing'
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
        'number': `第${bet.position || ''}名號碼`,
        'dragonTiger': '龍虎'
      };
      return typeMap[bet.betType || bet.type] || (bet.betType || bet.type);
    },
    
    getBetValueDesc(bet) {
      const value = bet.value;
      const betType = bet.betType || bet.type;
      
      if (betType === 'sumValue') {
        if (['big', 'small', 'odd', 'even'].includes(value)) {
          const valueMap = {
            'big': '大', 'small': '小', 'odd': '單', 'even': '雙'
          };
          return valueMap[value];
        } else {
          return `和值 ${value}`;
        }
      } else if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType)) {
        const valueMap = {
          'big': '大', 'small': '小', 'odd': '單', 'even': '雙'
        };
        return valueMap[value] || `號碼 ${value}`;
      } else if (betType === 'number') {
        return `號碼 ${value}`;
      } else if (betType === 'dragonTiger') {
        return value === 'dragon' ? '龍' : '虎';
      }
      return value;
    },
    
    formatTime(time) {
      if (!time) return '';
      const date = new Date(time);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${month}/${day} ${hours}:${minutes}`;
    },
    
    formatOdds(odds) {
      if (!odds) return '1.00';
      return parseFloat(odds).toFixed(2);
    },

    // 根據投注類型和值獲取正確的賠率 - 與後端一致
    getCorrectOdds(bet) {
      const betType = bet.betType || bet.type;
      const value = bet.value;
      
      // 如果bet對象已經有正確的賠率，直接使用
      if (bet.odds && bet.odds > 0) {
        return bet.odds;
      }
      
      // 根據投注類型計算賠率
      if (betType === 'sumValue') {
        if (['big', 'small', 'odd', 'even'].includes(value)) {
          return 1.96;
        } else {
          // 冠亞和值賠率表
          const sumOdds = {
            '3': 41.0, '4': 21.0, '5': 16.0, '6': 13.0, '7': 11.0,
            '8': 9.0, '9': 8.0, '10': 7.0, '11': 7.0, '12': 8.0,
            '13': 9.0, '14': 11.0, '15': 13.0, '16': 16.0, '17': 21.0,
            '18': 41.0, '19': 81.0
          };
          return sumOdds[value] || 1.0;
        }
      } else if (betType === 'number') {
        return 9.8;
      } else if (betType === 'dragonTiger') {
        return 1.96;
      } else if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType)) {
        if (['big', 'small', 'odd', 'even'].includes(value)) {
          return 1.96;
        } else {
          return 9.8;  // 單號投注
        }
      }
      
      return 1.0; // 預設賠率
    },
    
    formatMoney(amount) {
      if (!amount) return '$0';
      return `$${parseFloat(amount).toFixed(2)}`;
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
                    h('span', { class: 'bet-value' }, this.getBetTypeDesc(bet))
                  ]),
                  h('div', { class: 'bet-detail-row' }, [
                    h('span', { class: 'bet-label' }, '投注選項:'),
                    h('span', { class: 'bet-value' }, this.getBetValueDesc(bet))
                  ]),
                  h('div', { class: 'bet-detail-row' }, [
                    h('span', { class: 'bet-label' }, '賠率:'),
                    h('span', { class: 'bet-value' }, this.formatOdds(this.getCorrectOdds(bet)))
                  ]),
                  // 開獎號碼顯示
                  bet.drawResult ? h('div', { class: 'bet-detail-row draw-result-row' }, [
                    h('span', { class: 'bet-label' }, '開獎號碼:'),
                    h('div', { class: 'draw-result-balls' }, 
                      bet.drawResult.map((number, index) => 
                        h('div', { 
                          class: ['result-ball', `color-${number}`],
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
                      h('span', { class: 'amount-value' }, this.formatMoney(bet.amount))
                    ]),
                    bet.settled && bet.win && bet.winAmount ? 
                      h('div', { class: 'amount-row win-amount' }, [
                        h('span', { class: 'amount-label' }, '派彩金額:'),
                        h('span', { class: 'amount-value' }, this.formatMoney(bet.winAmount))
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