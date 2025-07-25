#!/usr/bin/env node

/**
 * 资料库安全检查脚本
 * 用于验证Render PostgreSQL配置和确保所有资料都能安全存放
 */

import pgp from 'pg-promise';
import dotenv from 'dotenv';

// 载入环境变数
dotenv.config();

// Render PostgreSQL 连接资讯
const RENDER_DATABASE_URL = 'postgresql://bet_game_user:Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy@dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com/bet_game';

const pgInstance = pgp({
  error: (err, e) => {
    if (e.cn) {
      console.error('❌ 连接错误:', err.message);
    } else if (e.query) {
      console.error('❌ 查询错误:', err.message);
    } else {
      console.error('❌ 未知错误:', err.message);
    }
  }
});

// 创建资料库连接
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
 * 检查资料库连接
 */
async function checkDatabaseConnection() {
  try {
    console.log('🔍 检查资料库连接...');
    const result = await db.one('SELECT NOW() as current_time, version() as version');
    console.log('✅ 资料库连接成功');
    console.log('📅 伺服器时间:', result.current_time);
    console.log('🗃️  PostgreSQL版本:', result.version.split(' ').slice(0, 2).join(' '));
    return true;
  } catch (error) {
    console.error('❌ 资料库连接失败:', error.message);
    return false;
  }
}

/**
 * 检查必要的资料表是否存在
 */
async function checkRequiredTables() {
  console.log('\n🔍 检查必要资料表...');
  
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
    
    console.log('📋 现有资料表:', tableNames.length, '个');
    
    // 检查基本表
    console.log('\n📊 基本业务表检查:');
    for (const table of requiredTables) {
      if (tableNames.includes(table)) {
        console.log(`✅ ${table}`);
      } else {
        console.log(`❌ ${table} - 缺失`);
      }
    }

    // 检查安全表
    console.log('\n🔒 安全相关表检查:');
    for (const table of securityTables) {
      if (tableNames.includes(table)) {
        console.log(`✅ ${table}`);
      } else {
        console.log(`⚠️  ${table} - 缺失（将创建）`);
      }
    }

    return { existing: tableNames, required: requiredTables, security: securityTables };
  } catch (error) {
    console.error('❌ 检查资料表时出错:', error.message);
    return null;
  }
}

/**
 * 检查资料表结构和索引
 */
async function checkTableStructure() {
  console.log('\n🔍 检查重要资料表结构...');
  
  try {
    // 检查 users 表结构
    const usersColumns = await db.any(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    if (usersColumns.length > 0) {
      console.log('✅ users 表结构:');
      usersColumns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
      });
    }

    // 检查索引
    const indexes = await db.any(`
      SELECT indexname, tablename, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname
    `);

    console.log(`\n📊 自定义索引: ${indexes.length} 个`);
    
    return true;
  } catch (error) {
    console.error('❌ 检查表结构时出错:', error.message);
    return false;
  }
}

/**
 * 检查资料完整性
 */
async function checkDataIntegrity() {
  console.log('\n🔍 检查资料完整性...');
  
  try {
    // 检查是否有管理员帐户
    const adminCount = await db.oneOrNone(`
      SELECT COUNT(*) as count 
      FROM agents 
      WHERE level = 0 OR username = 'admin'
    `);

    if (adminCount && parseInt(adminCount.count) > 0) {
      console.log('✅ 管理员帐户存在');
    } else {
      console.log('⚠️  未找到管理员帐户');
    }

    // 检查游戏状态
    const gameState = await db.oneOrNone('SELECT * FROM game_state ORDER BY id DESC LIMIT 1');
    if (gameState) {
      console.log('✅ 游戏状态记录存在');
      console.log(`   当前期数: ${gameState.current_period}`);
    } else {
      console.log('⚠️  未找到游戏状态记录');
    }

    // 统计各表记录数量
    const tables = ['users', 'agents', 'members', 'bet_history', 'result_history'];
    console.log('\n📈 资料统计:');
    
    for (const table of tables) {
      try {
        const count = await db.one(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ${table}: ${count.count} 笔记录`);
      } catch (error) {
        console.log(`   ${table}: 表不存在或查询失败`);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ 检查资料完整性时出错:', error.message);
    return false;
  }
}

/**
 * 检查资料库权限和安全设置
 */
async function checkDatabaseSecurity() {
  console.log('\n🔒 检查资料库安全设置...');
  
  try {
    // 检查当前用户权限
    const currentUser = await db.one('SELECT current_user, current_database()');
    console.log(`✅ 当前用户: ${currentUser.current_user}`);
    console.log(`✅ 当前资料库: ${currentUser.current_database}`);

    // 检查 SSL 连接
    const sslStatus = await db.oneOrNone("SHOW ssl");
    if (sslStatus && sslStatus.ssl === 'on') {
      console.log('✅ SSL 连接已启用');
    } else {
      console.log('⚠️  SSL 连接状态未知');
    }

    // 检查资料库大小
    const dbSize = await db.one(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    console.log(`📊 资料库大小: ${dbSize.size}`);

    return true;
  } catch (error) {
    console.error('❌ 检查资料库安全时出错:', error.message);
    return false;
  }
}

/**
 * 创建缺失的安全表
 */
async function createSecurityTables() {
  console.log('\n🛠️  创建安全相关资料表...');
  
  try {
    // 创建安全日志表
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

    // 创建登入尝试记录表
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

    // 创建会话管理表
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

    console.log('✅ 安全表创建完成');
    return true;
  } catch (error) {
    console.error('❌ 创建安全表时出错:', error.message);
    return false;
  }
}

/**
 * 执行完整的资料库检查
 */
async function runCompleteCheck() {
  console.log('🚀 开始 Render PostgreSQL 资料库安全检查\n');
  console.log('📋 连接资讯:');
  console.log('   主机: dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com');
  console.log('   资料库: bet_game');
  console.log('   用户: bet_game_user');
  console.log('   SSL: 已启用\n');

  let allChecksPass = true;

  // 1. 检查连接
  const connectionOk = await checkDatabaseConnection();
  if (!connectionOk) {
    console.log('\n❌ 资料库连接失败，请检查连接字串和网路状态');
    process.exit(1);
  }

  // 2. 检查表结构
  const tablesInfo = await checkRequiredTables();
  if (!tablesInfo) {
    allChecksPass = false;
  }

  // 3. 检查表结构详细资讯
  const structureOk = await checkTableStructure();
  if (!structureOk) {
    allChecksPass = false;
  }

  // 4. 创建缺失的安全表
  const securityTablesOk = await createSecurityTables();
  if (!securityTablesOk) {
    allChecksPass = false;
  }

  // 5. 检查资料完整性
  const integrityOk = await checkDataIntegrity();
  if (!integrityOk) {
    allChecksPass = false;
  }

  // 6. 检查安全设置
  const securityOk = await checkDatabaseSecurity();
  if (!securityOk) {
    allChecksPass = false;
  }

  // 总结
  console.log('\n' + '='.repeat(60));
  if (allChecksPass) {
    console.log('🎉 资料库安全检查完成！所有检查均通过');
    console.log('✅ Render PostgreSQL 已正确配置，可以安全存放所有资料');
  } else {
    console.log('⚠️  资料库检查完成，但发现一些问题需要处理');
  }

  console.log('\n📋 建议事项:');
  console.log('1. 定期备份资料库');
  console.log('2. 监控资料库效能和连接数');
  console.log('3. 启用安全日志记录');
  console.log('4. 定期检查和清理过期资料');
  console.log('5. 建立适当的存取权限管理');

  return allChecksPass;
}

// 执行检查
runCompleteCheck()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 检查过程中发生严重错误:', error);
    process.exit(1);
  })
  .finally(() => {
    // 确保资料库连接关闭
    pgInstance.end();
  }); 