// Script to simulate the exact API query
import db from './db/config.js';

async function simulateApiQuery() {
  try {
    console.log('Simulating the exact /api/history query...\n');
    
    // Simulate the query with the baseConditions filter
    const baseConditions = `result IS NOT NULL AND position_1 IS NOT NULL AND LENGTH(period::text) = 11`;
    
    console.log('=== Query with base conditions (as used by API) ===');
    console.log(`Base conditions: ${baseConditions}\n`);
    
    const filteredResults = await db.any(`
      SELECT period, result, created_at,
             position_1, position_2, position_3, position_4, position_5,
             position_6, position_7, position_8, position_9, position_10
      FROM result_history 
      WHERE ${baseConditions}
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log(`Records returned with filter: ${filteredResults.length}\n`);
    
    // Format like the API does
    console.log('API formatted results:');
    filteredResults.forEach((record, index) => {
      const positionArray = [];
      for (let i = 1; i <= 10; i++) {
        positionArray.push(record[`position_${i}`]);
      }
      
      console.log(`${index + 1}. Period ${record.period}:`);
      console.log(`   DB result column: ${JSON.stringify(record.result)}`);
      console.log(`   API returns: ${JSON.stringify(positionArray)}`);
      console.log(`   Match: ${JSON.stringify(record.result) === JSON.stringify(positionArray) ? '✅' : '❌'}`);
    });
    
    // Now check without the filter to see what's excluded
    console.log('\n=== Records excluded by the filter ===');
    const excludedRecords = await db.any(`
      SELECT period, result, position_1
      FROM result_history 
      WHERE NOT (${baseConditions})
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log(`\nRecords excluded: ${excludedRecords.length}`);
    excludedRecords.forEach(record => {
      console.log(`- Period ${record.period}: result=${JSON.stringify(record.result)}, position_1=${record.position_1}`);
    });
    
    // Important discovery!
    console.log('\n=== KEY FINDING ===');
    console.log('The API filters out records where position_1 IS NULL.');
    console.log('This means failed draws (with NULL results) are NOT shown in the history!');
    console.log('The frontend will only display successful draws with valid results.');
    
  } catch (error) {
    console.error('Error simulating API query:', error);
  } finally {
    process.exit(0);
  }
}

simulateApiQuery();