export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      const data = await request.json();
      
      // Validate required fields
      if (!data.message || !data.product || !data.stars) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
          status: 400,
          headers: corsHeaders
        });
      }

      // Validate stars is 1-5
      const stars = parseInt(data.stars, 10);
      if (isNaN(stars) || stars < 1 || stars > 5) {
        return new Response(JSON.stringify({ error: 'Invalid rating' }), { 
          status: 400,
          headers: corsHeaders
        });
      }

      // Format date
      const date = new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: '2-digit', 
        year: 'numeric' 
      }).format(new Date());

      // Prepare review data
      const review = {
        name: data.name || 'Anonymous',
        product: data.product,
        stars: stars,
        message: data.message.substring(0, 240),
        date: date,
        order_id: data.order_id || null,
        created_at: new Date().toISOString(),
        user_generated: true
      };

      // Insert into Supabase
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/rest/v1/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(review)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Supabase error:', response.status, errorText);
        return new Response(JSON.stringify({ 
          error: 'Failed to save review',
          details: errorText,
          status: response.status 
        }), { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Review submitted successfully',
        review: review
      }), {
        status: 201,
        headers: corsHeaders
      });

    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }), { 
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
