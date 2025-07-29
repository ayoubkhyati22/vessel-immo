// Main API documentation endpoint
export default async function handler(req, res) {
    // Enable CORS
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
    
    try {
      return res.status(200).json({
        name: 'Vessel Tracker API',
        version: '1.0.0',
        description: 'Get vessel position data by IMO number',
        endpoints: {
          'GET /api/vessel?imo={imo}': 'Get vessel position by IMO number',
          'GET /vessel?imo={imo}': 'Alternative endpoint for vessel data'
        },
        usage: {
          example: '/api/vessel?imo=XXXXXXX',
          parameters: {
            imo: 'Required. 7-digit IMO number'
          }
        },
        response_format: {
          success: true,
          data: {
            id: 'number',
            imo: 'number',
            name: 'string',
            latitude: 'number',
            longitude: 'number',
            speed_over_ground: 'number',
            course_over_ground: 'number',
            navigational_status: 'string',
            '...': 'other vessel data'
          },
          timestamp: 'ISO string',
          cached: 'boolean'
        },
        notes: [
          'Data is cached for 5 minutes',
          'IMO must be exactly 7 digits',
          'Returns vessel position and details from AIS data'
        ],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Documentation endpoint error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }