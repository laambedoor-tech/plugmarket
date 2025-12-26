export default {
  async fetch(request, env, ctx) {
    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const data = await request.json();
      
      // Validate required fields
      if (!data.message || !data.product || !data.stars) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Validate stars is 1-5
      const stars = parseInt(data.stars, 10);
      if (isNaN(stars) || stars < 1 || stars > 5) {
        return new Response(JSON.stringify({ error: 'Invalid rating' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
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
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify(review)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Supabase error:', response.status, errorText);
        return new Response(JSON.stringify({ error: 'Failed to save review' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Review submitted successfully',
        review: review
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
