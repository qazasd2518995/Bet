// security/config.js - 安全配置中心
import dotenv from 'dotenv';

dotenv.config();

export const securityConfig = {
  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    algorithm: 'HS256'
  },

  // 密碼策略
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12')
  },

  // 速率限制
  rateLimit: {
    // 通用 API 限制
    api: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 分鐘
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      message: '請求過於頻繁，請稍後再試'
    },
    // 登入限制
    login: {
      windowMs: 15 * 60 * 1000, // 15 分鐘
      max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '5'),
      skipSuccessfulRequests: true
    },
    // 註冊限制
    register: {
      windowMs: 60 * 60 * 1000, // 1 小時
      max: 3
    },
    // 密碼重設限制
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 小時
      max: 3
    },
    // 提款限制
    withdrawal: {
      windowMs: 60 * 60 * 1000, // 1 小時
      max: 10
    }
  },

  // CORS 配置
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? (process.env.ALLOWED_ORIGINS || '').split(',')
      : ['http://localhost:3000', 'http://localhost:3002', 'http://localhost:3003'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['X-CSRF-Token']
  },

  // 會話配置
  session: {
    secret: process.env.SESSION_SECRET || 'change-this-session-secret',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000'), // 24 小時
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  },

  // 安全頭配置
  headers: {
    // Helmet 配置
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", process.env.API_BASE_URL || "http://localhost:3002"],
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }
  },

  // 檔案上傳限制
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf'
    ],
    allowedExtensions: (process.env.ALLOWED_FILE_TYPES || 'jpg,jpeg,png,gif,pdf').split(',')
  },

  // IP 限制
  ipRestrictions: {
    whitelist: (process.env.IP_WHITELIST || '').split(',').filter(Boolean),
    blacklist: (process.env.IP_BLACKLIST || '').split(',').filter(Boolean),
    blockTorExitNodes: process.env.BLOCK_TOR_EXIT_NODES === 'true',
    blockVpnIps: process.env.BLOCK_VPN_IPS === 'true',
    blockKnownBots: process.env.BLOCK_KNOWN_BOTS === 'true'
  },

  // 地理位置限制
  geoRestrictions: {
    enabled: process.env.GEO_RESTRICTIONS_ENABLED === 'true',
    allowedCountries: (process.env.ALLOWED_COUNTRIES || 'TW,HK,MO,SG').split(','),
    blockedCountries: (process.env.BLOCKED_COUNTRIES || '').split(',').filter(Boolean)
  },

  // 兩步驗證
  twoFactor: {
    enabled: process.env.ENABLE_2FA === 'true',
    issuer: 'BET System',
    algorithm: 'SHA256',
    digits: 6,
    period: 30,
    window: 2
  },

  // 日誌配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableSecurityLogs: process.env.ENABLE_SECURITY_LOGS === 'true',
    logFilePath: process.env.LOG_FILE_PATH || './logs/security.log',
    maxFileSize: '10m',
    maxFiles: '7d',
    enableConsole: process.env.NODE_ENV !== 'production'
  },

  // 加密配置
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    saltLength: 64,
    iterations: 100000,
    digest: 'sha256'
  },

  // 安全警報閾值
  alerts: {
    failedLoginThreshold: parseInt(process.env.FAILED_LOGIN_THRESHOLD || '5'),
    suspiciousActivityThreshold: parseInt(process.env.SUSPICIOUS_ACTIVITY_THRESHOLD || '10'),
    abnormalTrafficThreshold: parseInt(process.env.ABNORMAL_TRAFFIC_THRESHOLD || '1000'),
    alertEmail: process.env.ALERT_EMAIL || 'security@example.com'
  },

  // DDoS 防護
  ddosProtection: {
    enabled: process.env.DDOS_PROTECTION_ENABLED === 'true',
    burst: parseInt(process.env.DDOS_BURST || '100'),
    rate: parseInt(process.env.DDOS_RATE || '50'),
    maxEventLoopDelay: 100,
    checkInterval: 1000,
    responseStatus: 503,
    retryAfter: 60
  },

  // 資料庫安全
  database: {
    enableSSL: process.env.NODE_ENV === 'production',
    statementTimeout: 30000, // 30 秒
    queryTimeout: 60000, // 60 秒
    connectionTimeout: 10000, // 10 秒
    idleInTransactionSessionTimeout: 60000, // 60 秒
    enableQueryLogging: process.env.NODE_ENV !== 'production',
    poolConfig: {
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      max: parseInt(process.env.DB_POOL_MAX || '10'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000')
    }
  },

  // API 安全
  api: {
    requireApiKey: process.env.REQUIRE_API_KEY === 'true',
    internalApiKey: process.env.INTERNAL_API_KEY || 'change-this-internal-api-key',
    apiVersioning: true,
    defaultVersion: 'v1',
    deprecationWarningDays: 30
  },

  // 備份配置
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // 每天凌晨 2 點
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
    encryptBackups: true,
    compressionLevel: 9
  },

  // 監控配置
  monitoring: {
    enabled: process.env.ENABLE_MONITORING === 'true',
    interval: parseInt(process.env.MONITORING_INTERVAL || '60000'), // 1 分鐘
    metrics: {
      cpu: true,
      memory: true,
      disk: true,
      network: true,
      database: true,
      api: true
    },
    alerting: {
      cpuThreshold: 80,
      memoryThreshold: 85,
      diskThreshold: 90,
      errorRateThreshold: 5
    }
  },

  // 安全模式
  securityMode: {
    strict: process.env.SECURITY_MODE === 'strict',
    paranoid: process.env.SECURITY_MODE === 'paranoid',
    allowedUserAgents: [
      'Mozilla',
      'Chrome',
      'Safari',
      'Firefox',
      'Edge'
    ],
    blockedUserAgents: [
      'bot',
      'crawler',
      'spider',
      'scraper'
    ]
  }
};

// 驗證必要的安全配置
export function validateSecurityConfig() {
  const errors = [];

  // 檢查 JWT 密鑰
  if (securityConfig.jwt.secret === 'change-this-secret-in-production') {
    errors.push('JWT_SECRET 必須設置為安全的隨機字符串');
  }

  // 檢查會話密鑰
  if (securityConfig.session.secret === 'change-this-session-secret') {
    errors.push('SESSION_SECRET 必須設置為安全的隨機字符串');
  }

  // 檢查內部 API 密鑰
  if (securityConfig.api.internalApiKey === 'change-this-internal-api-key') {
    errors.push('INTERNAL_API_KEY 必須設置為安全的隨機字符串');
  }

  // 生產環境額外檢查
  if (process.env.NODE_ENV === 'production') {
    if (!securityConfig.database.enableSSL) {
      errors.push('生產環境必須啟用資料庫 SSL');
    }

    if (!securityConfig.headers.helmet.hsts) {
      errors.push('生產環境必須啟用 HSTS');
    }

    if (!securityConfig.session.secure) {
      errors.push('生產環境必須使用安全的會話 cookie');
    }
  }

  return errors;
}

export default securityConfig; 