/**
 * 设备检测模组
 * 自动检测用户设备类型并应用相应CSS样式
 */

// 设备类型枚举
const DeviceType = {
  MOBILE: 'mobile',
  DESKTOP: 'desktop'
};

// 设备检测功能
const DeviceDetector = {
  /**
   * 检测当前设备类型
   * @returns {string} 设备类型: 'mobile' 或 'desktop'
   */
  detectDevice: function() {
    // 使用 navigator.userAgent 进行基本检测
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);
    
    // 检查视窗宽度作为补充判断
    const isSmallScreen = window.innerWidth < 1024;
    
    // 返回设备类型
    return (isMobile || isSmallScreen) ? DeviceType.MOBILE : DeviceType.DESKTOP;
  },
  
  /**
   * 应用设备相关类别到 body 元素
   */
  applyDeviceClass: function() {
    const deviceType = this.detectDevice();
    const bodyElement = document.body;
    
    // 移除所有设备相关类别
    bodyElement.classList.remove('device-mobile', 'device-desktop');
    
    // 添加当前设备类别
    bodyElement.classList.add(`device-${deviceType}`);
    
    // 返回检测到的设备类型
    return deviceType;
  },
  
  /**
   * 在窗口大小改变时重新检测
   */
  setupResizeListener: function() {
    let resizeTimeout;
    
    window.addEventListener('resize', () => {
      // 防抖动处理，避免频繁触发
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.applyDeviceClass();
      }, 250);
    });
  },
  
  /**
   * 初始化设备检测
   */
  init: function() {
    // 页面载入时，检测并应用设备类型
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

// 导出模组供外部使用
window.DeviceDetector = DeviceDetector; 