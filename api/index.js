// API documentation endpoint
export default function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }
    
    return res.status(200).json({
      name: 'Vessel Tracker API',
      version: '1.0.0',
      description: 'Get vessel position data by IMO number',
      endpoints: {
        '/api/vessel?imo={imo}': 'Get vessel position by IMO number'
      },
      example: '/api/vessel?imo=1234567',
      parameters: {
        imo: 'Required. 7-digit IMO number'
      },
      timestamp: new Date().toISOString()
    });
  }