// Script to find records where result has values but positions are NULL
import db from './db/config.js';

async function findActualMismatch() {
  try {
    console.log('Finding records where result JSON has values but position columns are NULL...\n');
    
    // Find records with valid result but NULL positions
    const mismatchedRecords = await db.any(`
      SELECT 
        id,
        period,
        result,
        position_1,
        created_at
      FROM result_history
      WHERE result IS NOT NULL 
        AND result::text != '[null,null,null,null,null,null,null,null,null,null]'
        AND jsonb_array_length(result::jsonb) = 10
        AND position_1 IS NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (mismatchedRecords.length === 0) {
      console.log('✅ No records found with valid result JSON but NULL position columns.');
      console.log('\nThis means the issue is not a data mismatch.');
      console.log('The frontend is correctly showing NULL values for failed draw periods.');
      
      // Let's check a specific period to understand the flow
      console.log('\n=== Checking a specific recent period to trace the data flow ===');
      
      const recentPeriod = await db.oneOrNone(`
        SELECT 
          period,
          result,
          position_1, position_2, position_3, position_4, position_5,
          position_6, position_7, position_8, position_9, position_10
        FROM result_history
        WHERE position_1 IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      `);
      
      if (recentPeriod) {
        console.log(`\nMost recent valid period: ${recentPeriod.period}`);
        console.log(`Result JSON: ${JSON.stringify(recentPeriod.result)}`);
        console.log(`Position array from API: [${recentPeriod.position_1}, ${recentPeriod.position_2}, ${recentPeriod.position_3}, ${recentPeriod.position_4}, ${recentPeriod.position_5}, ${recentPeriod.position_6}, ${recentPeriod.position_7}, ${recentPeriod.position_8}, ${recentPeriod.position_9}, ${recentPeriod.position_10}]`);
        
        // Simulate API response
        const apiResponse = [];
        for (let i = 1; i <= 10; i++) {
          apiResponse.push(recentPeriod[`position_${i}`]);
        }
        console.log(`\nAPI /api/history would return: ${JSON.stringify(apiResponse)}`);
        console.log(`Frontend displays this as: ${apiResponse.join(', ')}`);
      }
      
      // Check if there's a pattern in the data
      console.log('\n=== Checking data consistency patterns ===');
      const stats = await db.one(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(CASE WHEN position_1 IS NOT NULL THEN 1 END) as records_with_positions,
          COUNT(CASE WHEN result::text = '[null,null,null,null,null,null,null,null,null,null]' THEN 1 END) as null_results,
          COUNT(CASE WHEN result IS NOT NULL AND result::text != '[null,null,null,null,null,null,null,null,null,null]' THEN 1 END) as valid_results
        FROM result_history
      `);
      
      console.log(`Total records: ${stats.total_records}`);
      console.log(`Records with position columns filled: ${stats.records_with_positions}`);
      console.log(`Records with NULL result array: ${stats.null_results}`);
      console.log(`Records with valid result array: ${stats.valid_results}`);
      
    } else {
      console.log(`Found ${mismatchedRecords.length} records with mismatches:\n`);
      
      for (const record of mismatchedRecords) {
        console.log(`Period ${record.period}:`);
        console.log(`  Result JSON: ${JSON.stringify(record.result)}`);
        console.log(`  Position_1: ${record.position_1} (NULL indicates all positions are NULL)`);
        console.log('');
      }
    }
    
    // Final check: Are we looking at the right table?
    console.log('\n=== Verifying we are checking the correct source ===');
    console.log('The frontend fetches from /api/history which queries result_history table.');
    console.log('The draw_records table is used by the agent system, not the main game frontend.');
    
  } catch (error) {
    console.error('Error finding actual mismatch:', error);
  } finally {
    process.exit(0);
  }
}

findActualMismatch();