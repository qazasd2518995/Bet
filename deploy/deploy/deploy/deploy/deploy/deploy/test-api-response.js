// Script to test the actual API response
import fetch from 'node-fetch';

async function testApiResponse() {
  try {
    console.log('Testing /api/history endpoint response...\n');
    
    // Test the API endpoint
    const response = await fetch('http://localhost:3000/api/history?page=1&limit=5');
    const data = await response.json();
    
    console.log('API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success && data.records) {
      console.log('\n=== Analyzing Response Structure ===');
      console.log(`Total records returned: ${data.records.length}`);
      
      data.records.forEach((record, index) => {
        console.log(`\nRecord ${index + 1}:`);
        console.log(`  Period: ${record.period}`);
        console.log(`  Result type: ${typeof record.result}`);
        console.log(`  Result is array: ${Array.isArray(record.result)}`);
        console.log(`  Result content: ${JSON.stringify(record.result)}`);
        console.log(`  Result length: ${record.result ? record.result.length : 'N/A'}`);
        
        // Check for any NULL values
        if (Array.isArray(record.result)) {
          const nullCount = record.result.filter(val => val === null).length;
          if (nullCount > 0) {
            console.log(`  ⚠️  Contains ${nullCount} NULL values`);
          }
        }
      });
    }
    
  } catch (error) {
    console.error('Error testing API:', error.message);
    console.log('\nNote: Make sure the backend server is running on port 3000');
  }
}

testApiResponse();