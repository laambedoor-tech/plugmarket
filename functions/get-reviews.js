export default {
  async fetch(request, env, ctx) {
    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_ANON_KEY;

      // Get all reviews, ordered by created_at descending (newest first)
      const response = await fetch(
        `${supabaseUrl}/rest/v1/reviews?order=created_at.desc&limit=500`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Supabase error:', response.status, errorText);
        
        // If table doesn't exist, return empty array
        if (response.status === 404) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ error: 'Failed to fetch reviews' }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const reviews = await response.json();
      
      // Transform reviews to match frontend format
      const transformedReviews = reviews.map(r => ({
        stars: r.stars,
        date: r.date,
        message: r.message,
        product: r.product,
        userGenerated: r.user_generated || false,
        name: r.name,
        orderId: r.order_id
      }));

      return new Response(JSON.stringify(transformedReviews), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error:', error);
      
      // Return empty array as fallback
      return new Response(JSON.stringify([]), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
