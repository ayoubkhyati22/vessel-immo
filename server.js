const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Simple cache to avoid repeated requests
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to get vessel data using axios (no browser needed)
async function getVesselData(imo) {
  const cacheKey = `vessel_${imo}`;
  const now = Date.now();
  
  // Check cache first
  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (now - timestamp < CACHE_DURATION) {
      console.log(`Returning cached data for IMO: ${imo}`);
      return { ...data, cached: true };
    }
  }

  console.log(`Fetching fresh data for IMO: ${imo}`);
  
  try {
    const url = `https://www.aisfriends.com/api/vessel/position/imo:${imo}`;
    console.log(`Making request to: ${url}`);
    
    // Try multiple approaches with different headers
    const attempts = [
      // Attempt 1: Standard browser headers
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Referer': 'https://www.aisfriends.com/',
          'Origin': 'https://www.aisfriends.com',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin'
        },
        timeout: 15000
      },
      // Attempt 2: Different user agent
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive'
        },
        timeout: 20000
      },
      // Attempt 3: Simple headers
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        timeout: 25000
      },
      // Attempt 4: Minimal approach
      {
        headers: {
          'User-Agent': 'curl/7.68.0',
          'Accept': '*/*'
        },
        timeout: 30000
      }
    ];

    let lastError = null;
    
    for (let i = 0; i < attempts.length; i++) {
      try {
        console.log(`Attempt ${i + 1}/${attempts.length}`);
        
        const response = await axios.get(url, attempts[i]);
        
        // Check if response looks like JSON
        if (response.data && typeof response.data === 'object') {
          console.log(`Success on attempt ${i + 1}`);
          
          // Cache the result
          cache.set(cacheKey, {
            data: response.data,
            timestamp: now
          });

          console.log(`Successfully fetched data for ${response.data.name || 'Unknown vessel'}`);
          return response.data;
        }
        
        // If response is HTML (Cloudflare challenge), continue to next attempt
        if (typeof response.data === 'string' && 
            (response.data.includes('challenge-platform') || 
             response.data.includes('Forbidden') || 
             response.data.includes('Just a moment'))) {
          console.log('Cloudflare challenge detected, trying next approach...');
          continue;
        }
        
        // If we get here, we have some data but it's not what we expected
        console.log('Unexpected response format, trying next approach...');
        
      } catch (error) {
        lastError = error;
        console.log(`Attempt ${i + 1} failed:`, error.message);
        
        // If it's a timeout or connection error, try next approach
        if (error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED') {
          console.log('Connection issue, trying next approach...');
          continue;
        }
        
        // If it's a 403/503, might be blocked, try next approach
        if (error.response && [403, 503, 429].includes(error.response.status)) {
          console.log('Blocked by server, trying next approach...');
          continue;
        }
        
        // If it's a 404, the vessel doesn't exist
        if (error.response && error.response.status === 404) {
          throw new Error('Vessel not found');
        }
      }
      
      // Wait between attempts
      if (i < attempts.length - 1) {
        console.log('Waiting before next attempt...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw lastError || new Error('All attempts failed - unable to bypass protection');

  } catch (error) {
    console.error(`Error fetching vessel ${imo}:`, error.message);
    throw error;
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Simple Vessel Tracker API (HTTP Only)',
    endpoints: {
      'GET /vessel/:imo': 'Get vessel position by IMO number',
      'GET /health': 'Health check'
    },
    example: '/vessel/XXXXXXX (replace with 7-digit IMO number)',
    note: 'This version uses HTTP requests only, no browser automation'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    cache_size: cache.size,
    version: 'HTTP-only'
  });
});

app.get('/vessel/:imo', async (req, res) => {
  const { imo } = req.params;
  
  // Simple validation
  if (!imo || imo.length !== 7 || isNaN(imo)) {
    return res.status(400).json({
      error: 'Invalid IMO number. Must be 7 digits.',
      example: 'Use: /vessel/XXXXXXX where XXXXXXX is a 7-digit IMO'
    });
  }

  try {
    const vesselData = await getVesselData(imo);
    
    res.json({
      success: true,
      data: vesselData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('API Error:', error.message);
    
    let statusCode = 500;
    let message = 'Failed to fetch vessel data';
    
    if (error.message.includes('Vessel not found')) {
      statusCode = 404;
      message = 'Vessel not found';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      statusCode = 503;
      message = 'Cannot connect to vessel tracking service';
    } else if (error.response && [403, 503].includes(error.response.status)) {
      statusCode = 503;
      message = 'Access blocked by remote service';
    } else if (error.message.includes('bypass protection')) {
      statusCode = 503;
      message = 'Unable to bypass security protection';
    }
    
    res.status(statusCode).json({
      success: false,
      error: message,
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Clear cache endpoint (useful for testing)
app.delete('/cache', (req, res) => {
  cache.clear();
  res.json({
    success: true,
    message: 'Cache cleared',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚢 Simple Vessel Tracker (HTTP Only) running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔍 Test: http://localhost:${PORT}/vessel/XXXXXXX (replace with 7-digit IMO)`);
  console.log(`🗑️  Clear cache: DELETE http://localhost:${PORT}/cache`);
  console.log(`💡 No browser automation - pure HTTP requests`);
});