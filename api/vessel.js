// Enhanced vessel API for Vercel with multiple bypass strategies
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Only GET allowed
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }
    
    try {
      // Get IMO from query
      const imo = req.query.imo;
      
      // Basic validation
      if (!imo) {
        return res.status(400).json({
          success: false,
          error: 'IMO parameter is required',
          example: '?imo=1234567'
        });
      }
      
      if (imo.length !== 7 || isNaN(imo)) {
        return res.status(400).json({
          success: false,
          error: 'IMO must be exactly 7 digits',
          provided: imo
        });
      }
      
      // Import axios dynamically
      const axios = (await import('axios')).default;
      
      // URL to fetch
      const url = `https://www.aisfriends.com/api/vessel/position/imo:${imo}`;
      
      // Multiple strategies to bypass blocking
      const strategies = [
        // Strategy 1: Standard browser
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
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"'
          },
          timeout: 15000
        },
        // Strategy 2: Mobile browser
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive'
          },
          timeout: 20000
        },
        // Strategy 3: Different desktop browser
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.5'
          },
          timeout: 25000
        },
        // Strategy 4: Minimal approach
        {
          headers: {
            'User-Agent': 'curl/7.68.0',
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      ];
      
      let lastError = null;
      
      // Try each strategy
      for (let i = 0; i < strategies.length; i++) {
        try {
          console.log(`Trying strategy ${i + 1}/${strategies.length}`);
          
          const response = await axios.get(url, strategies[i]);
          
          // Check if we got valid JSON data
          if (response.data && typeof response.data === 'object' && !response.data.error) {
            console.log(`Success with strategy ${i + 1}`);
            
            return res.status(200).json({
              success: true,
              data: response.data,
              imo: imo,
              strategy: i + 1,
              timestamp: new Date().toISOString()
            });
          }
          
          // If we get HTML or error response, continue to next strategy
          if (typeof response.data === 'string') {
            console.log(`Strategy ${i + 1}: Got HTML response, trying next...`);
            continue;
          }
          
        } catch (error) {
          lastError = error;
          console.log(`Strategy ${i + 1} failed:`, error.message);
          
          // If it's a 404, vessel doesn't exist
          if (error.response && error.response.status === 404) {
            return res.status(404).json({
              success: false,
              error: 'Vessel not found',
              imo: imo
            });
          }
          
          // For other errors, continue to next strategy
          continue;
        }
        
        // Small delay between strategies
        if (i < strategies.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // All strategies failed
      console.error('All strategies failed');
      
      return res.status(503).json({
        success: false,
        error: 'All bypass strategies failed',
        details: 'The remote service is blocking all requests',
        tried_strategies: strategies.length,
        last_error: lastError?.message,
        suggestion: 'Try again later or use a different IMO number'
      });
      
    } catch (error) {
      console.error('Unexpected error:', error.message);
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }