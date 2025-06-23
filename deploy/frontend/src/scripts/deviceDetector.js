/**
 * 設備檢測模組
 * 自動檢測用戶設備類型並應用相應CSS樣式
 */

// 設備類型枚舉
const DeviceType = {
  MOBILE: 'mobile',
  DESKTOP: 'desktop'
};

// 設備檢測功能
const DeviceDetector = {
  /**
   * 檢測當前設備類型
   * @returns {string} 設備類型: 'mobile' 或 'desktop'
   */
  detectDevice: function() {
    // 使用 navigator.userAgent 進行基本檢測
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);
    
    // 檢查視窗寬度作為補充判斷
    const isSmallScreen = window.innerWidth < 1024;
    
    // 返回設備類型
    return (isMobile || isSmallScreen) ? DeviceType.MOBILE : DeviceType.DESKTOP;
  },
  
  /**
   * 應用設備相關類別到 body 元素
   */
  applyDeviceClass: function() {
    const deviceType = this.detectDevice();
    const bodyElement = document.body;
    
    // 移除所有設備相關類別
    bodyElement.classList.remove('device-mobile', 'device-desktop');
    
    // 添加當前設備類別
    bodyElement.classList.add(`device-${deviceType}`);
    
    // 返回檢測到的設備類型
    return deviceType;
  },
  
  /**
   * 在窗口大小改變時重新檢測
   */
  setupResizeListener: function() {
    let resizeTimeout;
    
    window.addEventListener('resize', () => {
      // 防抖動處理，避免頻繁觸發
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.applyDeviceClass();
      }, 250);
    });
  },
  
  /**
   * 初始化設備檢測
   */
  init: function() {
    // 頁面載入時，檢測並應用設備類型
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.applyDeviceClass();
        this.setupResizeListener();
      });
    } else {
      this.applyDeviceClass();
      this.setupResizeListener();
    }
    
    return this;
  }
};

// 立即初始化
DeviceDetector.init();

// 導出模組供外部使用
window.DeviceDetector = DeviceDetector; 