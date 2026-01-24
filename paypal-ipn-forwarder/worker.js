/**
 * PayPal IPN Forwarder for Cloudflare Workers
 * 
 * Este Worker recibe notificaciones IPN de PayPal y las reenvía
 * a tu servidor de PlugMarket para procesarlas.
 * 
 * Configuración en PayPal:
 * 1. Ir a: https://www.paypal.com/merchantnotification/ipn/preference
 * 2. Click en "Choose IPN Settings"
 * 3. Pegar la URL de este Worker (ej: https://paypal-ipn.tu-usuario.workers.dev)
 * 4. Habilitar IPN
 * 5. Guardar
 */

export default {
  async fetch(request) {
    // Solo aceptar POST requests
    if (request.method !== 'POST') {
      return new Response('Only POST requests allowed', { status: 405 });
    }

    // Leer el cuerpo de la petición IPN
    const body = await request.text();

    // URL de tu servidor donde está desplegado tu Worker de PlugMarket
    // Actualiza esto con tu dominio real
    const targetUrl = 'https://plugmarket.es/api/paypal-ff/webhook';

    try {
      // Reenviar la petición IPN a tu servidor
      const upstreamResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Opcional: agregar un header secreto para verificar que viene del forwarder
          'X-IPN-Forwarder': 'plugmarket-ipn-v1'
        },
        body: body
      });

      // Leer la respuesta de tu servidor
      const responseBody = await upstreamResponse.text();

      // Devolver la misma respuesta a PayPal
      return new Response(responseBody, {
        status: upstreamResponse.status,
        headers: upstreamResponse.headers
      });
    } catch (err) {
      console.error('Error forwarding IPN:', err);
      return new Response('Forwarding error', { status: 500 });
    }
  }
};
