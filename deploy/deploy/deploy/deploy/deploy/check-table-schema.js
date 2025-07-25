// check-table-schema.js - Check the actual schema of the tables
import db from './db/config.js';

async function checkTableSchema() {
  try {
    console.log('=== Checking Table Schemas ===\n');

    // 1. Check result_history columns
    console.log('1. result_history table columns:');
    const resultHistoryColumns = await db.manyOrNone(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'result_history'
      ORDER BY ordinal_position
    `);
    
    if (resultHistoryColumns.length > 0) {
      resultHistoryColumns.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('  Table not found or no columns');
    }

    // 2. Check draw_records columns
    console.log('\n2. draw_records table columns:');
    const drawRecordsColumns = await db.manyOrNone(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'draw_records'
      ORDER BY ordinal_position
    `);
    
    if (drawRecordsColumns.length > 0) {
      drawRecordsColumns.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('  Table not found or no columns');
    }

    // 3. Check bet_history columns
    console.log('\n3. bet_history table columns:');
    const betHistoryColumns = await db.manyOrNone(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bet_history'
      ORDER BY ordinal_position
    `);
    
    if (betHistoryColumns.length > 0) {
      betHistoryColumns.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('  Table not found or no columns');
    }

    // 4. List all tables in the database
    console.log('\n4. All tables in the database:');
    const allTables = await db.manyOrNone(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    allTables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

  } catch (error) {
    console.error('Error checking table schema:', error);
  } finally {
    await db.$pool.end();
  }
}

checkTableSchema();