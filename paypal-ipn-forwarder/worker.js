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
  async fetch(request, env, ctx) {
    // Solo aceptar POST requests
    if (request.method !== 'POST') {
      return new Response('Only POST requests allowed', { status: 405 });
    }

    // Leer el cuerpo de la petición IPN
    const body = await request.text();

    console.log('IPN received from PayPal, forwarding...');

    // URL de tu servidor donde está desplegado tu Worker de PlugMarket
    // Actualiza esto con tu dominio real
    const targetUrl = 'https://plugmarket.es/api/paypal-ff/webhook';

    // Responder inmediatamente a PayPal con 200 OK
    // Esto evita que PayPal marque el IPN como fallido y lo reintente
    const paypalResponse = new Response('OK', { status: 200 });

    // Procesar el reenvío de forma asíncrona usando waitUntil
    ctx.waitUntil(
      fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-IPN-Forwarder': 'plugmarket-ipn-v1'
        },
        body: body
      })
      .then(res => {
        console.log(`Forwarded to webhook, status: ${res.status}`);
        return res.text();
      })
      .then(text => {
        console.log(`Webhook response: ${text}`);
      })
      .catch(err => {
        console.error('Error forwarding to webhook:', err);
      })
    );

    return paypalResponse;
  }
};
