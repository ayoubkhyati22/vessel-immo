const axios = require('axios');
const UserAgent = require('user-agents');

// Simple in-memory cache (Note: Vercel functions are stateless, so this resets on each cold start)
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
    const userAgent = new UserAgent();
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
          'User-Agent': userAgent.toString(),
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive'
        },
        timeout: 20000
      },
      // Attempt 3: Minimal headers
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 25000
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
        if (typeof response.data === 'string' && response.data.includes('challenge-platform')) {
          console.log('Cloudflare challenge detected, trying next approach...');
          continue;
        }
        
      } catch (error) {
        lastError = error;
        console.log(`Attempt ${i + 1} failed:`, error.message);
        
        // If it's a timeout or connection error, try next approach
        if (error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED') {
          continue;
        }
        
        // If it's a 403/503, might be blocked, try next approach
        if (error.response && [403, 503].includes(error.response.status)) {
          console.log('Blocked by server, trying next approach...');
          continue;
        }
      }
      
      // Wait between attempts (shorter for serverless)
      if (i < attempts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw lastError || new Error('All attempts failed');

  } catch (error) {
    console.error(`Error fetching vessel ${imo}:`, error.message);
    throw error;
  }
}

// Validate IMO number
function validateIMO(imo) {
  if (!imo) {
    return { valid: false, error: 'IMO number is required' };
  }
  
  if (typeof imo !== 'string' || imo.length !== 7 || isNaN(imo)) {
    return { valid: false, error: 'IMO must be exactly 7 digits' };
  }
  
  return { valid: true };
}

// Main handler function
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
      allowedMethods: ['GET']
    });
  }
  
  try {
    // Get IMO from query parameter or URL path
    const { imo } = req.query;
    
    // Validate IMO
    const validation = validateIMO(imo);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        example: 'Usage: /api/vessel?imo=XXXXXXX (7-digit IMO number)'
      });
    }
    
    // Get vessel data
    const vesselData = await getVesselData(imo);
    
    // Return successful response
    res.status(200).json({
      success: true,
      data: vesselData,
      imo: imo,
      timestamp: new Date().toISOString(),
      cached: vesselData.cached || false
    });
    
  } catch (error) {
    console.error('API Error:', error.message);
    
    let statusCode = 500;
    let message = 'Failed to fetch vessel data';
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      statusCode = 503;
      message = 'Cannot connect to vessel tracking service';
    } else if (error.response && error.response.status === 404) {
      statusCode = 404;
      message = 'Vessel not found';
    } else if (error.response && [403, 503].includes(error.response.status)) {
      statusCode = 503;
      message = 'Access blocked by remote service';
    }
    
    res.status(statusCode).json({
      success: false,
      error: message,
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}