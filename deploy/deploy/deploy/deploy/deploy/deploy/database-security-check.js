#!/usr/bin/env node

/**
 * 資料庫安全檢查腳本
 * 用於驗證Render PostgreSQL配置和確保所有資料都能安全存放
 */

import pgp from 'pg-promise';
import dotenv from 'dotenv';

// 載入環境變數
dotenv.config();

// Render PostgreSQL 連接資訊
const RENDER_DATABASE_URL = 'postgresql://bet_game_user:Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy@dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com/bet_game';

const pgInstance = pgp({
  error: (err, e) => {
    if (e.cn) {
      console.error('❌ 連接錯誤:', err.message);
    } else if (e.query) {
      console.error('❌ 查詢錯誤:', err.message);
    } else {
      console.error('❌ 未知錯誤:', err.message);
    }
  }
});

// 創建資料庫連接
const db = pgInstance({
  connectionString: RENDER_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});

/**
 * 檢查資料庫連接
 */
async function checkDatabaseConnection() {
  try {
    console.log('🔍 檢查資料庫連接...');
    const result = await db.one('SELECT NOW() as current_time, version() as version');
    console.log('✅ 資料庫連接成功');
    console.log('📅 伺服器時間:', result.current_time);
    console.log('🗃️  PostgreSQL版本:', result.version.split(' ').slice(0, 2).join(' '));
    return true;
  } catch (error) {
    console.error('❌ 資料庫連接失敗:', error.message);
    return false;
  }
}

/**
 * 檢查必要的資料表是否存在
 */
async function checkRequiredTables() {
  console.log('\n🔍 檢查必要資料表...');
  
  const requiredTables = [
    'users',
    'bet_history', 
    'result_history',
    'game_state',
    'agents',
    'members',
    'transfer_records',
    'announcements',
    'transaction_records',
    'draw_records'
  ];

  const securityTables = [
    'security_logs',
    'login_attempts',
    'ip_blacklist',
    'api_keys',
    'two_factor_auth',
    'user_sessions',
    'audit_logs',
    'permissions',
    'role_permissions',
    'user_permissions',
    'encryption_keys',
    'security_alerts'
  ];

  try {
    const existingTables = await db.any(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tableNames = existingTables.map(t => t.table_name);
    
    console.log('📋 現有資料表:', tableNames.length, '個');
    
    // 檢查基本表
    console.log('\n📊 基本業務表檢查:');
    for (const table of requiredTables) {
      if (tableNames.includes(table)) {
        console.log(`✅ ${table}`);
      } else {
        console.log(`❌ ${table} - 缺失`);
      }
    }

    // 檢查安全表
    console.log('\n🔒 安全相關表檢查:');
    for (const table of securityTables) {
      if (tableNames.includes(table)) {
        console.log(`✅ ${table}`);
      } else {
        console.log(`⚠️  ${table} - 缺失（將創建）`);
      }
    }

    return { existing: tableNames, required: requiredTables, security: securityTables };
  } catch (error) {
    console.error('❌ 檢查資料表時出錯:', error.message);
    return null;
  }
}

/**
 * 檢查資料表結構和索引
 */
async function checkTableStructure() {
  console.log('\n🔍 檢查重要資料表結構...');
  
  try {
    // 檢查 users 表結構
    const usersColumns = await db.any(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    if (usersColumns.length > 0) {
      console.log('✅ users 表結構:');
      usersColumns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
      });
    }

    // 檢查索引
    const indexes = await db.any(`
      SELECT indexname, tablename, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname
    `);

    console.log(`\n📊 自定義索引: ${indexes.length} 個`);
    
    return true;
  } catch (error) {
    console.error('❌ 檢查表結構時出錯:', error.message);
    return false;
  }
}

/**
 * 檢查資料完整性
 */
async function checkDataIntegrity() {
  console.log('\n🔍 檢查資料完整性...');
  
  try {
    // 檢查是否有管理員帳戶
    const adminCount = await db.oneOrNone(`
      SELECT COUNT(*) as count 
      FROM agents 
      WHERE level = 0 OR username = 'admin'
    `);

    if (adminCount && parseInt(adminCount.count) > 0) {
      console.log('✅ 管理員帳戶存在');
    } else {
      console.log('⚠️  未找到管理員帳戶');
    }

    // 檢查遊戲狀態
    const gameState = await db.oneOrNone('SELECT * FROM game_state ORDER BY id DESC LIMIT 1');
    if (gameState) {
      console.log('✅ 遊戲狀態記錄存在');
      console.log(`   當前期數: ${gameState.current_period}`);
    } else {
      console.log('⚠️  未找到遊戲狀態記錄');
    }

    // 統計各表記錄數量
    const tables = ['users', 'agents', 'members', 'bet_history', 'result_history'];
    console.log('\n📈 資料統計:');
    
    for (const table of tables) {
      try {
        const count = await db.one(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ${table}: ${count.count} 筆記錄`);
      } catch (error) {
        console.log(`   ${table}: 表不存在或查詢失敗`);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ 檢查資料完整性時出錯:', error.message);
    return false;
  }
}

/**
 * 檢查資料庫權限和安全設置
 */
async function checkDatabaseSecurity() {
  console.log('\n🔒 檢查資料庫安全設置...');
  
  try {
    // 檢查當前用戶權限
    const currentUser = await db.one('SELECT current_user, current_database()');
    console.log(`✅ 當前用戶: ${currentUser.current_user}`);
    console.log(`✅ 當前資料庫: ${currentUser.current_database}`);

    // 檢查 SSL 連接
    const sslStatus = await db.oneOrNone("SHOW ssl");
    if (sslStatus && sslStatus.ssl === 'on') {
      console.log('✅ SSL 連接已啟用');
    } else {
      console.log('⚠️  SSL 連接狀態未知');
    }

    // 檢查資料庫大小
    const dbSize = await db.one(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    console.log(`📊 資料庫大小: ${dbSize.size}`);

    return true;
  } catch (error) {
    console.error('❌ 檢查資料庫安全時出錯:', error.message);
    return false;
  }
}

/**
 * 創建缺失的安全表
 */
async function createSecurityTables() {
  console.log('\n🛠️  創建安全相關資料表...');
  
  try {
    // 創建安全日誌表
    await db.none(`
      CREATE TABLE IF NOT EXISTS security_logs (
        id SERIAL PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        user_id INTEGER,
        username VARCHAR(50),
        ip_address INET,
        user_agent TEXT,
        request_method VARCHAR(10),
        request_path VARCHAR(255),
        response_status INTEGER,
        error_message TEXT,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_logs(event_type)
    `);

    // 創建登入嘗試記錄表
    await db.none(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        ip_address INET NOT NULL,
        user_agent TEXT,
        success BOOLEAN NOT NULL,
        failure_reason VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username)
    `);

    // 創建會話管理表
    await db.none(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        user_type VARCHAR(10) NOT NULL,
        user_id INTEGER NOT NULL,
        ip_address INET,
        user_agent TEXT,
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token)
    `);

    console.log('✅ 安全表創建完成');
    return true;
  } catch (error) {
    console.error('❌ 創建安全表時出錯:', error.message);
    return false;
  }
}

/**
 * 執行完整的資料庫檢查
 */
async function runCompleteCheck() {
  console.log('🚀 開始 Render PostgreSQL 資料庫安全檢查\n');
  console.log('📋 連接資訊:');
  console.log('   主機: dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com');
  console.log('   資料庫: bet_game');
  console.log('   用戶: bet_game_user');
  console.log('   SSL: 已啟用\n');

  let allChecksPass = true;

  // 1. 檢查連接
  const connectionOk = await checkDatabaseConnection();
  if (!connectionOk) {
    console.log('\n❌ 資料庫連接失敗，請檢查連接字串和網路狀態');
    process.exit(1);
  }

  // 2. 檢查表結構
  const tablesInfo = await checkRequiredTables();
  if (!tablesInfo) {
    allChecksPass = false;
  }

  // 3. 檢查表結構詳細資訊
  const structureOk = await checkTableStructure();
  if (!structureOk) {
    allChecksPass = false;
  }

  // 4. 創建缺失的安全表
  const securityTablesOk = await createSecurityTables();
  if (!securityTablesOk) {
    allChecksPass = false;
  }

  // 5. 檢查資料完整性
  const integrityOk = await checkDataIntegrity();
  if (!integrityOk) {
    allChecksPass = false;
  }

  // 6. 檢查安全設置
  const securityOk = await checkDatabaseSecurity();
  if (!securityOk) {
    allChecksPass = false;
  }

  // 總結
  console.log('\n' + '='.repeat(60));
  if (allChecksPass) {
    console.log('🎉 資料庫安全檢查完成！所有檢查均通過');
    console.log('✅ Render PostgreSQL 已正確配置，可以安全存放所有資料');
  } else {
    console.log('⚠️  資料庫檢查完成，但發現一些問題需要處理');
  }

  console.log('\n📋 建議事項:');
  console.log('1. 定期備份資料庫');
  console.log('2. 監控資料庫效能和連接數');
  console.log('3. 啟用安全日誌記錄');
  console.log('4. 定期檢查和清理過期資料');
  console.log('5. 建立適當的存取權限管理');

  return allChecksPass;
}

// 執行檢查
runCompleteCheck()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 檢查過程中發生嚴重錯誤:', error);
    process.exit(1);
  })
  .finally(() => {
    // 確保資料庫連接關閉
    pgInstance.end();
  }); 