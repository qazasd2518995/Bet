// Script to check mismatches between result column and position columns
import db from './db/config.js';

async function checkResultPositionMismatch() {
  try {
    console.log('Checking for mismatches between result column and position columns...\n');
    
    // Get the most recent records that might have issues
    const records = await db.any(`
      SELECT 
        id,
        period,
        result,
        position_1, position_2, position_3, position_4, position_5,
        position_6, position_7, position_8, position_9, position_10,
        created_at
      FROM result_history
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    let mismatchCount = 0;
    console.log('=== Checking recent records for mismatches ===\n');
    
    for (const record of records) {
      const resultArray = record.result;
      const positionArray = [
        record.position_1, record.position_2, record.position_3, record.position_4, record.position_5,
        record.position_6, record.position_7, record.position_8, record.position_9, record.position_10
      ];
      
      // Check if they match
      let hasError = false;
      
      // Check if result is an array
      if (!Array.isArray(resultArray)) {
        console.log(`❌ Period ${record.period}: result is not an array`);
        hasError = true;
      } else if (resultArray.length !== 10) {
        console.log(`❌ Period ${record.period}: result array length is ${resultArray.length}, expected 10`);
        hasError = true;
      } else {
        // Compare each position
        for (let i = 0; i < 10; i++) {
          if (resultArray[i] !== positionArray[i]) {
            if (!hasError) {
              console.log(`❌ Period ${record.period}: MISMATCH FOUND!`);
              console.log(`   Result array:    [${resultArray.join(', ')}]`);
              console.log(`   Position cols:   [${positionArray.join(', ')}]`);
              hasError = true;
              mismatchCount++;
            }
            console.log(`   Position ${i+1}: result[${i}]=${resultArray[i]} vs position_${i+1}=${positionArray[i]}`);
          }
        }
      }
      
      if (!hasError) {
        console.log(`✅ Period ${record.period}: All positions match correctly`);
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Total records checked: ${records.length}`);
    console.log(`Records with mismatches: ${mismatchCount}`);
    
    // Check for any records where position columns are NULL
    console.log('\n=== Checking for NULL position columns ===');
    const nullPositions = await db.any(`
      SELECT count(*) as count
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
    `);
    console.log(`Records with NULL position columns: ${nullPositions[0].count}`);
    
    // Get a sample of mismatched records if any exist
    if (mismatchCount > 0) {
      console.log('\n=== Finding all mismatched records ===');
      const allMismatches = await db.any(`
        SELECT period, created_at
        FROM result_history
        WHERE 
          (result::jsonb->0)::int != position_1 OR
          (result::jsonb->1)::int != position_2 OR
          (result::jsonb->2)::int != position_3 OR
          (result::jsonb->3)::int != position_4 OR
          (result::jsonb->4)::int != position_5 OR
          (result::jsonb->5)::int != position_6 OR
          (result::jsonb->6)::int != position_7 OR
          (result::jsonb->7)::int != position_8 OR
          (result::jsonb->8)::int != position_9 OR
          (result::jsonb->9)::int != position_10
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      console.log('Sample of mismatched periods:');
      allMismatches.forEach(record => {
        console.log(`  - Period ${record.period} (${record.created_at})`);
      });
    }
    
  } catch (error) {
    console.error('Error checking result position mismatch:', error);
  } finally {
    process.exit(0);
  }
}

checkResultPositionMismatch();