// Script to check records with NULL position columns
import db from './db/config.js';

async function checkNullPositions() {
  try {
    console.log('Checking records with NULL position columns...\n');
    
    // Get records with NULL positions
    const nullRecords = await db.any(`
      SELECT 
        id,
        period,
        result,
        position_1, position_2, position_3, position_4, position_5,
        position_6, position_7, position_8, position_9, position_10,
        created_at
      FROM result_history
      WHERE position_1 IS NULL 
         OR position_2 IS NULL 
         OR position_3 IS NULL 
         OR position_4 IS NULL 
         OR position_5 IS NULL
         OR position_6 IS NULL 
         OR position_7 IS NULL 
         OR position_8 IS NULL 
         OR position_9 IS NULL 
         OR position_10 IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${nullRecords.length} records with NULL positions (showing first 10):\n`);
    
    for (const record of nullRecords) {
      console.log(`Period ${record.period} (${record.created_at}):`);
      console.log(`  Result JSON: ${JSON.stringify(record.result)}`);
      console.log(`  Position columns: [${record.position_1}, ${record.position_2}, ${record.position_3}, ${record.position_4}, ${record.position_5}, ${record.position_6}, ${record.position_7}, ${record.position_8}, ${record.position_9}, ${record.position_10}]`);
      
      // Check if we can extract positions from the result JSON
      if (Array.isArray(record.result) && record.result.length === 10) {
        console.log(`  ✅ Result JSON is valid, can be used to populate position columns`);
      } else {
        console.log(`  ❌ Result JSON is invalid or incomplete`);
      }
      console.log('');
    }
    
    // Check date range of NULL position records
    const dateRange = await db.one(`
      SELECT 
        MIN(created_at) as earliest,
        MAX(created_at) as latest,
        COUNT(*) as total
      FROM result_history
      WHERE position_1 IS NULL
    `);
    
    console.log('=== Date range of NULL position records ===');
    console.log(`Earliest: ${dateRange.earliest}`);
    console.log(`Latest: ${dateRange.latest}`);
    console.log(`Total count: ${dateRange.total}`);
    
    // Fix suggestion
    console.log('\n=== Fix Suggestion ===');
    console.log('These NULL position columns are likely from older records before the position columns were added.');
    console.log('The frontend is showing different results because:');
    console.log('1. The API uses position columns to build the result array');
    console.log('2. When position columns are NULL, the API returns an array of NULLs');
    console.log('3. But the actual result is stored correctly in the result JSON column');
    console.log('\nTo fix this, we should populate the position columns from the result JSON for these records.');
    
  } catch (error) {
    console.error('Error checking NULL positions:', error);
  } finally {
    process.exit(0);
  }
}

checkNullPositions();