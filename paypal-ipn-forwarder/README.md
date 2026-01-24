# PayPal IPN Forwarder - Guía de Configuración

Este Cloudflare Worker reenvía las notificaciones IPN (Instant Payment Notification) de PayPal a tu servidor de PlugMarket.

## ¿Por qué es necesario?

PayPal puede bloquear o filtrar enlaces IPN directos que apuntan a ciertos dominios. Al usar tu propio Worker de Cloudflare con tu dominio o un subdominio `.workers.dev`, evitas estos filtros y aseguras que las notificaciones de pago lleguen correctamente.

## Pasos de Configuración

### 1. Desplegar el Worker en Cloudflare

```bash
# Desde el directorio paypal-ipn-forwarder/
npm install -g wrangler
wrangler login
wrangler deploy
```

Después del despliegue, obtendrás una URL como:
```
https://plugmarket-paypal-ipn.tu-usuario.workers.dev
```

### 2. (Opcional) Usar tu propio dominio

Si prefieres usar tu dominio personalizado:

1. En el dashboard de Cloudflare: **Workers & Pages** → **Settings** → **Domains & Routes**
2. Click en **Add**
3. Selecciona **Custom domain**
4. Ingresa la ruta que desees, por ejemplo: `https://plugmarket.es/paypal-ipn`
5. Selecciona el Worker que creaste

Ahora puedes usar `https://plugmarket.es/paypal-ipn` como tu URL de IPN.

### 3. Configurar IPN en PayPal

1. Inicia sesión en tu cuenta de PayPal personal
2. Ve a: https://www.paypal.com/merchantnotification/ipn/preference
3. Click en **"Choose IPN Settings"**
4. En "Notification URL", pega tu URL del Worker:
   - Si usas workers.dev: `https://plugmarket-paypal-ipn.tu-usuario.workers.dev`
   - Si usas dominio propio: `https://plugmarket.es/paypal-ipn`
5. Marca la casilla **"Receive IPN messages (Enabled)"**
6. Click en **Save**

### 4. Verificar que Funciona

Después de configurar:

1. Realiza una transacción de prueba (envío de dinero F&F a tu cuenta)
2. PayPal enviará una notificación IPN a tu Worker
3. El Worker la reenviará a `https://plugmarket.es/api/paypal-ff/webhook`
4. Tu servidor procesará el pago y creará la orden automáticamente

## Actualizar el Worker

Si necesitas cambiar la URL de destino o hacer modificaciones:

1. Edita `worker.js`
2. Actualiza la variable `targetUrl` con tu nueva URL
3. Ejecuta: `wrangler deploy`

## Troubleshooting

### El IPN no llega a mi servidor

1. Verifica en PayPal que IPN esté habilitado
2. Comprueba que la URL en PayPal sea correcta
3. Revisa los logs del Worker: `wrangler tail`
4. Verifica que tu servidor en `https://plugmarket.es/api/paypal-ff/webhook` esté funcionando

### Error 500 en el Worker

1. Revisa los logs: `wrangler tail`
2. Asegúrate de que la `targetUrl` en `worker.js` sea correcta
3. Verifica que tu servidor esté respondiendo correctamente

## Seguridad

El Worker incluye un header personalizado `X-IPN-Forwarder: plugmarket-ipn-v1` que puedes verificar en tu servidor para asegurar que la petición viene de tu forwarder y no directamente.

En `functions/paypal-ff-webhook.js`, puedes agregar esta validación:

```javascript
const forwarderHeader = request.headers.get('X-IPN-Forwarder');
if (forwarderHeader !== 'plugmarket-ipn-v1') {
  console.warn('IPN request not from official forwarder');
  // Opcionalmente rechazar la petición
}
```
