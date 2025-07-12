/**
 * 检测是否为微信浏览器
 * @returns {boolean} 如果是微信浏览器返回true，否则返回false
 */
export const isWeChatBrowser = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('micromessenger');
};

/**
 * 检测是否为移动设备
 * @returns {boolean} 如果是移动设备返回true，否则返回false
 */
export const isMobileDevice = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
};

/**
 * 获取浏览器信息
 * @returns {object} 包含浏览器类型和版本信息的对象
 */
export const getBrowserInfo = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  return {
    isWeChat: userAgent.includes('micromessenger'),
    isMobile: /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent),
    isIOS: /iphone|ipad|ipod/i.test(userAgent),
    isAndroid: /android/i.test(userAgent),
    userAgent: navigator.userAgent
  };
};
