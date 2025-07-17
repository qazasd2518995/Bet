// run-migration.js - Apply database migration for failed settlements
import db from './db/config.js';

async function runMigration() {
    console.log('📊 APPLYING DATABASE MIGRATION\n');
    
    try {
        // Create failed_settlements table
        await db.none(`
            CREATE TABLE IF NOT EXISTS failed_settlements (
                id SERIAL PRIMARY KEY,
                period BIGINT UNIQUE NOT NULL,
                error_message TEXT,
                retry_count INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        console.log('✅ failed_settlements table created');
        
        // Create indexes
        await db.none(`
            CREATE INDEX IF NOT EXISTS idx_failed_settlements_period ON failed_settlements(period)
        `);
        
        await db.none(`
            CREATE INDEX IF NOT EXISTS idx_failed_settlements_created_at ON failed_settlements(created_at)
        `);
        
        console.log('✅ Indexes created');
        
        // Verify table structure
        const tableInfo = await db.any(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'failed_settlements'
            ORDER BY ordinal_position
        `);
        
        console.log('\n📋 Table structure:');
        tableInfo.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });
        
        console.log('\n🎉 Database migration completed successfully');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await db.$pool.end();
    }
}

runMigration();