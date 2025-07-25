// security/middleware.js - 安全中间件模组
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import xss from 'xss';
import { body, validationResult } from 'express-validator';

// JWT 密钥（应该从环境变数读取）
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = '24h';

// 密码加密
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// 密码验证
export const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// 生成 JWT Token
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// 验证 JWT Token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Helmet 安全头设置
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
  crossOriginEmbedderPolicy: false, // 允许嵌入外部资源
});

// API 速率限制
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 限制每个 IP 100 个请求
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});

// 登入速率限制（更严格）
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 5, // 限制每个 IP 5 次登入尝试
  message: '登入尝试过多，请 15 分钟后再试',
  skipSuccessfulRequests: true, // 成功的请求不计入限制
});

// 注册速率限制
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 小时
  max: 3, // 限制每个 IP 每小时 3 次注册
  message: '注册请求过多，请稍后再试',
});

// JWT 认证中间件
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({
      success: false,
      message: '认证令牌无效或已过期'
    });
  }

  req.user = decoded;
  next();
};

// 管理员权限检查
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.level !== 0) {
    return res.status(403).json({
      success: false,
      message: '需要管理员权限'
    });
  }
  next();
};

// XSS 防护中间件
export const xssProtection = (req, res, next) => {
  // 清理请求体
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key]);
      }
    });
  }
  
  // 清理查询参数
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    });
  }
  
  next();
};

// 输入验证规则
export const validationRules = {
  login: [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('用户名长度必须在 3-50 个字符之间')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('用户名只能包含字母、数字和下划线'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('密码长度至少 6 个字符')
  ],
  
  register: [
    body('username')
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('用户名长度必须在 3-50 个字符之间')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('用户名只能包含字母、数字和下划线'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('密码长度至少 6 个字符')
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage('密码必须包含字母和数字'),
    body('confirmPassword')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('两次输入的密码不一致')
  ],
  
  createNotice: [
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('标题长度必须在 1-200 个字符之间'),
    body('content')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('内容长度必须在 1-5000 个字符之间'),
    body('category')
      .optional()
      .isIn(['系统公告', '维护通知', '活动公告', '紧急通知'])
      .withMessage('无效的公告类别')
  ],
  
  transferPoints: [
    body('amount')
      .isFloat({ min: 1 })
      .withMessage('转移金额必须大于 0'),
    body('targetId')
      .isInt({ min: 1 })
      .withMessage('无效的目标 ID'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('描述不能超过 500 个字符')
  ]
};

// 验证错误处理
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// SQL 注入防护（额外的参数检查）
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
  
  // 检查所有输入
  const inputs = { ...req.body, ...req.query, ...req.params };
  for (const [key, value] of Object.entries(inputs)) {
    if (checkValue(value)) {
      return res.status(400).json({
        success: false,
        message: '检测到可疑的输入内容'
      });
    }
  }
  
  next();
};

// CSRF Token 生成和验证
const csrfTokens = new Map(); // 实际应用中应使用 Redis 等持久化存储

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
      message: 'CSRF token 无效'
    });
  }
  
  next();
};

// 安全日志记录
export const securityLogger = (eventType, userId, details) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    userId,
    details,
    ip: details.ip || 'unknown'
  };
  
  // 这里应该将日志写入资料库或日志文件
  console.log('[SECURITY LOG]', JSON.stringify(logEntry));
  
  // TODO: 实现实际的日志存储
  // await db.none('INSERT INTO security_logs (...) VALUES (...)', logEntry);
};

// IP 白名单/黑名单管理
const blacklistedIPs = new Set(); // 实际应用中应使用资料库
const whitelistedIPs = new Set();

export const ipFilter = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // 检查白名单
  if (whitelistedIPs.size > 0 && !whitelistedIPs.has(clientIP)) {
    return res.status(403).json({
      success: false,
      message: '访问被拒绝'
    });
  }
  
  // 检查黑名单
  if (blacklistedIPs.has(clientIP)) {
    return res.status(403).json({
      success: false,
      message: '您的 IP 已被封锁'
    });
  }
  
  next();
};

// 添加 IP 到黑名单
export const blockIP = (ip) => {
  blacklistedIPs.add(ip);
  securityLogger('IP_BLOCKED', null, { ip });
};

// 移除 IP 从黑名单
export const unblockIP = (ip) => {
  blacklistedIPs.delete(ip);
  securityLogger('IP_UNBLOCKED', null, { ip });
};

// 敏感操作二次验证
export const requireSecondaryAuth = async (req, res, next) => {
  const { secondaryPassword } = req.body;
  
  if (!secondaryPassword) {
    return res.status(403).json({
      success: false,
      message: '此操作需要二次验证'
    });
  }
  
  // 验证二次密码（这里应该实现实际的验证逻辑）
  // const isValid = await verifySecondaryPassword(req.user.id, secondaryPassword);
  
  next();
};

// 导出所有中间件
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