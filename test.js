// Simple test script to verify the API works
const axios = require('axios');

const API_BASE = 'http://localhost:3005';
const TEST_IMO = 'XXXXXXX'; // Replace with a valid 7-digit IMO for testing

async function testAPI() {
  console.log('🧪 Testing Simple Vessel Tracker API...\n');
  console.log('⚠️  Note: Replace XXXXXXX with a valid 7-digit IMO number for full testing\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check:', healthResponse.data.status);

    // Test 2: Documentation endpoint
    console.log('\n2. Testing documentation endpoint...');
    const docResponse = await axios.get(`${API_BASE}/`);
    console.log('✅ Documentation loaded:', docResponse.data.name);

    // Test 3: Invalid IMO
    console.log('\n3. Testing invalid IMO...');
    try {
      await axios.get(`${API_BASE}/vessel/invalid`);
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected invalid IMO');
      } else {
        console.log('❌ Unexpected error for invalid IMO');
      }
    }

    // Test 4: Valid IMO format but placeholder
    console.log('\n4. Testing with placeholder IMO...');
    if (TEST_IMO !== 'XXXXXXX' && TEST_IMO.length === 7 && !isNaN(TEST_IMO)) {
      try {
        const vesselResponse = await axios.get(`${API_BASE}/vessel/${TEST_IMO}`);
        
        if (vesselResponse.data.success) {
          const vessel = vesselResponse.data.data;
          console.log('✅ Vessel data retrieved successfully');
          console.log(`   Name: ${vessel.name}`);
          console.log(`   Type: ${vessel.detailed_type}`);
          console.log(`   Position: ${vessel.latitude}, ${vessel.longitude}`);
          console.log(`   Speed: ${vessel.speed_over_ground} knots`);
          console.log(`   Heading: ${vessel.course_over_ground}°`);
          console.log(`   Status: ${vessel.navigational_status}`);
          console.log(`   Flag: ${vessel.country}`);
          console.log(`   Cached: ${vessel.cached || false}`);
        } else {
          console.log('❌ Failed to get vessel data');
        }
      } catch (error) {
        console.log('⚠️  Could not fetch vessel data (expected with placeholder IMO)');
        console.log('   Error:', error.response?.data?.error || error.message);
      }
    } else {
      console.log('ℹ️  Skipping vessel test - replace TEST_IMO with valid 7-digit number');
    }

    console.log('\n📋 API ready for use!');
    console.log('💡 To test with real data, replace XXXXXXX in the code with a valid IMO number');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the server is running: npm start');
    }
  }
}

// Run tests
testAPI();