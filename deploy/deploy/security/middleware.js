// security/middleware.js - 安全中間件模組
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import xss from 'xss';
import { body, validationResult } from 'express-validator';

// JWT 密鑰（應該從環境變數讀取）
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = '24h';

// 密碼加密
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// 密碼驗證
export const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// 生成 JWT Token
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// 驗證 JWT Token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Helmet 安全頭設置
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://bet-game.onrender.com", "https://bet-agent.onrender.com"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // 允許嵌入外部資源
});

// API 速率限制
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100, // 限制每個 IP 100 個請求
  message: '請求過於頻繁，請稍後再試',
  standardHeaders: true,
  legacyHeaders: false,
});

// 登入速率限制（更嚴格）
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 5, // 限制每個 IP 5 次登入嘗試
  message: '登入嘗試過多，請 15 分鐘後再試',
  skipSuccessfulRequests: true, // 成功的請求不計入限制
});

// 註冊速率限制
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小時
  max: 3, // 限制每個 IP 每小時 3 次註冊
  message: '註冊請求過多，請稍後再試',
});

// JWT 認證中間件
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供認證令牌'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({
      success: false,
      message: '認證令牌無效或已過期'
    });
  }

  req.user = decoded;
  next();
};

// 管理員權限檢查
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.level !== 0) {
    return res.status(403).json({
      success: false,
      message: '需要管理員權限'
    });
  }
  next();
};

// XSS 防護中間件
export const xssProtection = (req, res, next) => {
  // 清理請求體
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    });
  }
  
  // 清理查詢參數
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    });
  }
  
  next();
};

// 輸入驗證規則
export const validationRules = {
  login: [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('用戶名長度必須在 3-50 個字符之間')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('用戶名只能包含字母、數字和下劃線'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('密碼長度至少 6 個字符')
  ],
  
  register: [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('用戶名長度必須在 3-50 個字符之間')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('用戶名只能包含字母、數字和下劃線'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('密碼長度至少 6 個字符')
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage('密碼必須包含字母和數字'),
    body('confirmPassword')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('兩次輸入的密碼不一致')
  ],
  
  createNotice: [
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('標題長度必須在 1-200 個字符之間'),
    body('content')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('內容長度必須在 1-5000 個字符之間'),
    body('category')
      .optional()
      .isIn(['系統公告', '維護通知', '活動公告', '緊急通知'])
      .withMessage('無效的公告類別')
  ],
  
  transferPoints: [
    body('amount')
      .isFloat({ min: 1 })
      .withMessage('轉移金額必須大於 0'),
    body('targetId')
      .isInt({ min: 1 })
      .withMessage('無效的目標 ID'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('描述不能超過 500 個字符')
  ]
};

// 驗證錯誤處理
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '輸入驗證失敗',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// SQL 注入防護（額外的參數檢查）
export const sqlInjectionProtection = (req, res, next) => {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\b)/gi,
    /(--|#|\/\*|\*\/|;)/g,
    /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s*\d+\s*=\s*\d+)/gi
  ];
  
  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    }
    return false;
  };
  
  // 檢查所有輸入
  const inputs = { ...req.body, ...req.query, ...req.params };
  for (const [key, value] of Object.entries(inputs)) {
    if (checkValue(value)) {
      return res.status(400).json({
        success: false,
        message: '檢測到可疑的輸入內容'
      });
    }
  }
  
  next();
};

// CSRF Token 生成和驗證
const csrfTokens = new Map(); // 實際應用中應使用 Redis 等持久化存儲

export const generateCSRFToken = (userId) => {
  const token = jwt.sign({ userId, csrf: true }, JWT_SECRET, { expiresIn: '1h' });
  csrfTokens.set(userId, token);
  return token;
};

export const verifyCSRFToken = (req, res, next) => {
  const token = req.headers['x-csrf-token'];
  const userId = req.user?.id;
  
  if (!token || !userId) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token 缺失'
    });
  }
  
  const storedToken = csrfTokens.get(userId);
  if (token !== storedToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token 無效'
    });
  }
  
  next();
};

// 安全日誌記錄
export const securityLogger = (eventType, userId, details) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    userId,
    details,
    ip: details.ip || 'unknown'
  };
  
  // 這裡應該將日誌寫入資料庫或日誌文件
  console.log('[SECURITY LOG]', JSON.stringify(logEntry));
  
  // TODO: 實現實際的日誌存儲
  // await db.none('INSERT INTO security_logs (...) VALUES (...)', logEntry);
};

// IP 白名單/黑名單管理
const blacklistedIPs = new Set(); // 實際應用中應使用資料庫
const whitelistedIPs = new Set();

export const ipFilter = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // 檢查白名單
  if (whitelistedIPs.size > 0 && !whitelistedIPs.has(clientIP)) {
    return res.status(403).json({
      success: false,
      message: '訪問被拒絕'
    });
  }
  
  // 檢查黑名單
  if (blacklistedIPs.has(clientIP)) {
    return res.status(403).json({
      success: false,
      message: '您的 IP 已被封鎖'
    });
  }
  
  next();
};

// 添加 IP 到黑名單
export const blockIP = (ip) => {
  blacklistedIPs.add(ip);
  securityLogger('IP_BLOCKED', null, { ip });
};

// 移除 IP 從黑名單
export const unblockIP = (ip) => {
  blacklistedIPs.delete(ip);
  securityLogger('IP_UNBLOCKED', null, { ip });
};

// 敏感操作二次驗證
export const requireSecondaryAuth = async (req, res, next) => {
  const { secondaryPassword } = req.body;
  
  if (!secondaryPassword) {
    return res.status(403).json({
      success: false,
      message: '此操作需要二次驗證'
    });
  }
  
  // 驗證二次密碼（這裡應該實現實際的驗證邏輯）
  // const isValid = await verifySecondaryPassword(req.user.id, secondaryPassword);
  
  next();
};

// 導出所有中間件
export default {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  helmetConfig,
  apiLimiter,
  loginLimiter,
  registerLimiter,
  authenticateToken,
  requireAdmin,
  xssProtection,
  validationRules,
  handleValidationErrors,
  sqlInjectionProtection,
  generateCSRFToken,
  verifyCSRFToken,
  securityLogger,
  ipFilter,
  blockIP,
  unblockIP,
  requireSecondaryAuth
}; 