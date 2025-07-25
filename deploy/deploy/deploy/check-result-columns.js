// Script to check result column data types and sample data
import db from './db/config.js';

async function checkResultColumns() {
  try {
    console.log('Checking result column data types and formats...\n');
    
    // Check column information from information_schema
    console.log('=== Column Data Types ===');
    const columnInfo = await db.any(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name IN ('result_history', 'draw_records')
        AND column_name = 'result'
      ORDER BY table_name, ordinal_position
    `);
    
    console.table(columnInfo);
    
    // Get sample data from result_history
    console.log('\n=== Sample data from result_history (last 3 records) ===');
    const resultHistorySamples = await db.any(`
      SELECT 
        id,
        period,
        result,
        pg_typeof(result) as result_type,
        jsonb_typeof(result::jsonb) as json_type
      FROM result_history
      ORDER BY created_at DESC
      LIMIT 3
    `);
    
    for (const sample of resultHistorySamples) {
      console.log(`\nPeriod: ${sample.period}`);
      console.log(`Result type: ${sample.result_type} (${sample.json_type})`);
      console.log(`Result content:`, sample.result);
      console.log(`Result as string:`, JSON.stringify(sample.result));
    }
    
    // Get sample data from draw_records
    console.log('\n=== Sample data from draw_records (last 3 records) ===');
    const drawRecordsSamples = await db.any(`
      SELECT 
        id,
        period,
        result,
        pg_typeof(result) as result_type,
        jsonb_typeof(result) as json_type
      FROM draw_records
      ORDER BY created_at DESC
      LIMIT 3
    `);
    
    for (const sample of drawRecordsSamples) {
      console.log(`\nPeriod: ${sample.period}`);
      console.log(`Result type: ${sample.result_type} (${sample.json_type})`);
      console.log(`Result content:`, sample.result);
      console.log(`Result as string:`, JSON.stringify(sample.result));
    }
    
    // Check if there are any differences in the data format
    console.log('\n=== Checking for format differences ===');
    
    // Compare a specific period if it exists in both tables
    const commonPeriod = await db.oneOrNone(`
      SELECT rh.period
      FROM result_history rh
      INNER JOIN draw_records dr ON rh.period::text = dr.period
      ORDER BY rh.created_at DESC
      LIMIT 1
    `);
    
    if (commonPeriod) {
      console.log(`\nComparing period ${commonPeriod.period} in both tables:`);
      
      const rhResult = await db.one(`
        SELECT result FROM result_history WHERE period = $1
      `, [commonPeriod.period]);
      
      const drResult = await db.one(`
        SELECT result FROM draw_records WHERE period = $1
      `, [commonPeriod.period.toString()]);
      
      console.log('result_history result:', rhResult.result);
      console.log('draw_records result:', drResult.result);
      console.log('Are they equal?', JSON.stringify(rhResult.result) === JSON.stringify(drResult.result));
    }
    
    // Check for any malformed data
    console.log('\n=== Checking for malformed data ===');
    
    // Check result_history for non-array results
    const malformedRH = await db.any(`
      SELECT count(*) as count
      FROM result_history
      WHERE jsonb_typeof(result::jsonb) != 'array'
    `);
    console.log(`result_history non-array results: ${malformedRH[0].count}`);
    
    // Check draw_records for non-array results
    const malformedDR = await db.any(`
      SELECT count(*) as count
      FROM draw_records
      WHERE jsonb_typeof(result) != 'array'
    `);
    console.log(`draw_records non-array results: ${malformedDR[0].count}`);
    
    // Check array lengths
    console.log('\n=== Checking array lengths ===');
    const arrayLengthsRH = await db.any(`
      SELECT 
        jsonb_array_length(result::jsonb) as array_length,
        count(*) as count
      FROM result_history
      GROUP BY array_length
      ORDER BY array_length
    `);
    console.log('result_history array lengths:');
    console.table(arrayLengthsRH);
    
    const arrayLengthsDR = await db.any(`
      SELECT 
        jsonb_array_length(result) as array_length,
        count(*) as count
      FROM draw_records
      GROUP BY array_length
      ORDER BY array_length
    `);
    console.log('draw_records array lengths:');
    console.table(arrayLengthsDR);
    
  } catch (error) {
    console.error('Error checking result columns:', error);
  } finally {
    process.exit(0);
  }
}

checkResultColumns();