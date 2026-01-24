# Integración PayPal Friends & Family - PlugMarket

Este documento explica cómo configurar y usar PayPal Personal/Friends & Family para recibir pagos en PlugMarket.

## 📋 Resumen

La integración consiste en tres componentes principales:

1. **Cloudflare Worker IPN Forwarder** - Reenvía notificaciones IPN de PayPal a tu servidor
2. **Backend API** - Crea órdenes y procesa webhooks IPN
3. **Frontend UI** - Interfaz de usuario en el carrito de compras

## 🚀 Configuración Paso a Paso

### Paso 1: Desplegar el Worker IPN Forwarder

1. Abre una terminal en el directorio `paypal-ipn-forwarder/`:

```bash
cd paypal-ipn-forwarder
npm install -g wrangler
wrangler login
wrangler deploy
```

2. Copia la URL que te da Cloudflare, por ejemplo:
   ```
   https://plugmarket-paypal-ipn.tu-usuario.workers.dev
   ```

### Paso 2: Configurar PayPal IPN

1. Inicia sesión en tu cuenta **personal** de PayPal
2. Ve a: https://www.paypal.com/merchantnotification/ipn/preference
3. Haz click en **"Choose IPN Settings"**
4. Pega la URL de tu Worker (del paso anterior)
5. Marca **"Receive IPN messages (Enabled)"**
6. Guarda los cambios

### Paso 3: Verificar Variables de Entorno

En tu archivo `wrangler.toml` principal (el de PlugMarket), asegúrate de tener:

```toml
[vars]
PAYPAL_MANUAL_EMAIL = "tu-email@paypal.com"  # Tu email de PayPal personal
PAYPAL_ENV = "production"  # o "sandbox" para pruebas
```

### Paso 4: Desplegar Backend

```bash
# En el directorio principal de PlugMarket
wrangler deploy
```

### Paso 5: Probar la Integración

1. Ve a tu sitio web: `https://plugmarket.es`
2. Agrega productos al carrito
3. En checkout, selecciona la pestaña **"PayPal"**
4. Ingresa tu email
5. Haz click en **"Create Order"**
6. Sigue las instrucciones para enviar el pago desde tu PayPal
7. El sistema verificará automáticamente el pago en 2-5 minutos

## 🔧 Cómo Funciona

### Flujo de Pago

```
1. Cliente crea orden en el sitio web
   ↓
2. Backend genera Order ID único y note aleatorio
   ↓
3. Cliente envía pago F&F con el note especificado
   ↓
4. PayPal envía IPN → Worker Forwarder → Backend
   ↓
5. Backend verifica IPN con PayPal
   ↓
6. Backend busca orden por monto y note
   ↓
7. Backend marca orden como completada
   ↓
8. Cliente recibe productos vía email
```

### Archivos Creados/Modificados

#### Backend (`functions/`)
- ✅ `paypal-ff-create-order.js` - Crea órdenes PayPal F&F
- ✅ `paypal-ff-webhook.js` - Procesa IPNs de PayPal
- ✅ `paypal-ff-check-order.js` - Verifica estado de órdenes
- ✅ `_worker.js` - Rutas actualizadas

#### Frontend
- ✅ `cart.html` - UI de PayPal F&F agregada
- ✅ `js/cart.js` - Lógica de checkout PayPal F&F

#### Worker IPN
- ✅ `paypal-ipn-forwarder/worker.js` - Forwarder IPN
- ✅ `paypal-ipn-forwarder/wrangler.toml` - Configuración
- ✅ `paypal-ipn-forwarder/README.md` - Documentación

## 🛡️ Seguridad

### Verificación IPN

El webhook verifica cada IPN directamente con PayPal:

```javascript
// En paypal-ff-webhook.js
const verified = await verifyIPN(body, env);
if (!verified) {
  console.error('IPN verification failed');
  return new Response('Verification failed', { status: 400 });
}
```

### Header Personalizado

El forwarder incluye un header de identificación:

```javascript
'X-IPN-Forwarder': 'plugmarket-ipn-v1'
```

Puedes verificarlo en el webhook si quieres seguridad adicional.

### Matching de Órdenes

Las órdenes se emparejan por:
1. **Monto exacto** ($X.XX USD)
2. **Note aleatorio** (ej: "Coffee", "Lunch", etc.)
3. **Estado** (pending_payment)

Esto previene pagos duplicados y fraudes.

## 🧪 Testing

### Modo Sandbox

Para probar sin dinero real:

1. Crea cuenta sandbox en PayPal Developer
2. Cambia en `wrangler.toml`:
   ```toml
   PAYPAL_ENV = "sandbox"
   ```
3. Usa email sandbox en `PAYPAL_MANUAL_EMAIL`

### Verificar IPNs

Revisa los logs del Worker:

```bash
# Worker principal
wrangler tail

# IPN Forwarder
cd paypal-ipn-forwarder
wrangler tail
```

### Base de Datos

Verifica órdenes en Supabase:

```sql
SELECT * FROM orders 
WHERE payment_method = 'paypal_ff' 
ORDER BY created_at DESC;
```

## 🔍 Troubleshooting

### ❌ IPN no llega al servidor

**Problema**: PayPal envía IPN pero no se recibe.

**Soluciones**:
1. Verifica que la URL en PayPal settings sea correcta
2. Revisa logs del forwarder: `wrangler tail`
3. Confirma que IPN esté habilitado en PayPal
4. Verifica que el Worker esté desplegado

### ❌ Orden no se marca como completada

**Problema**: Pago recibido pero orden sigue pending.

**Soluciones**:
1. Verifica que el monto sea exacto (incluyendo decimales)
2. Confirma que el "note" usado sea el correcto
3. Revisa logs del webhook
4. Verifica que `PAYPAL_MANUAL_EMAIL` coincida con el receptor

### ❌ Error "Failed to create order"

**Problema**: No se puede crear la orden.

**Soluciones**:
1. Verifica credenciales de Supabase
2. Revisa que la tabla `orders` exista
3. Confirma que los productos en el carrito sean válidos
4. Chequea que el email del cliente sea válido

## 📊 Monitoreo

### Métricas Importantes

- **Tiempo de verificación**: 2-5 minutos promedio
- **Tasa de éxito IPN**: Debería ser ~99%
- **Órdenes pendientes**: Monitorear las que llevan >10 min

### Query Útiles

```sql
-- Órdenes PayPal F&F pendientes hace más de 10 minutos
SELECT * FROM orders 
WHERE payment_method = 'paypal_ff' 
  AND status = 'pending_payment'
  AND created_at < NOW() - INTERVAL '10 minutes';

-- Estadísticas de PayPal F&F hoy
SELECT 
  COUNT(*) as total_orders,
  SUM(total) as total_revenue,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))/60) as avg_verification_time_minutes
FROM orders 
WHERE payment_method = 'paypal_ff'
  AND DATE(created_at) = CURRENT_DATE;
```

## 🎨 Personalización

### Cambiar Notes Casuales

Edita en `paypal-ff-create-order.js`:

```javascript
const CASUAL_NOTES = [
  'Thanks!',
  'For yesterday',
  'Coffee',
  // Agrega tus propios notes
];
```

### Cambiar Estilo UI

Modifica el HTML en `cart.html` dentro del `paypal-container`.

### Ajustar Polling

En `cart.js`, cambia el intervalo:

```javascript
paypalPoll = setInterval(async () => {
  // ...
}, 5000); // 5 segundos (5000ms)
```

## 📞 Soporte

Si tienes problemas:

1. Revisa los logs: `wrangler tail`
2. Verifica la base de datos en Supabase
3. Confirma que todas las variables de entorno estén configuradas
4. Asegúrate de que PayPal IPN esté habilitado y apuntando a la URL correcta

## 🎯 Próximos Pasos

- [ ] Implementar función de entrega de productos
- [ ] Agregar notificaciones por email al cliente
- [ ] Dashboard para monitorear órdenes PayPal F&F
- [ ] Reembolsos automáticos
- [ ] Multi-currency support

---

**¡Listo!** Ahora tu sitio puede recibir pagos con PayPal Personal/Friends & Family de manera automática. 🎉
