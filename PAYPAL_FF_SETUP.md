# Guía de Configuración: PayPal Friends & Family con IPN

## ✅ Sistema Implementado

Se ha implementado un sistema completo de pagos con PayPal Friends & Family que incluye:

### Archivos Creados:

1. **`functions/paypal-ff-create-order.js`** - Genera órdenes de PayPal F&F
2. **`functions/paypal-ff-webhook.js`** - Procesa notificaciones IPN de PayPal
3. **`paypal-ff.html`** - Interfaz de usuario con instrucciones de pago
4. **Actualizaciones en:**
   - `functions/_worker.js` - Rutas para las nuevas funciones
   - `cart.html` - Botón "PayPal F&F" añadido
   - `js/cart.js` - Lógica para manejar pagos F&F

---

## 🔧 Configuración Requerida en PayPal

### Paso 1: Configurar IPN en PayPal

1. Ve a: https://www.paypal.com/merchantnotification/ipn/preference
2. Click en "Choose IPN Settings"
3. En el campo de URL, ingresa:
   ```
   https://plugmarket-api.soyalex123.workers.dev/api/paypal-ff/webhook
   ```
4. Marca la casilla "Receive IPN messages (Enabled)"
5. Click en "Save"

### Paso 2: Verificar la Configuración

PayPal enviará una notificación de prueba a tu URL. Puedes verificar que funciona en:
- PayPal Dashboard → Account Settings → Notifications → Instant Payment Notifications

---

## 🚀 Cómo Funciona

### Flujo del Cliente:

1. El cliente selecciona productos y va al carrito
2. Click en el botón "PayPal F&F"
3. Se genera una orden con ID único (Ejemplo: `FF-L3X4M2P5-A8K9D1`)
4. Se muestran instrucciones paso a paso:
   - Cantidad exacta a enviar
   - Tu correo de PayPal: `soyalexesp123@gmail.com`
   - ID de orden que debe incluir en la nota
5. Cliente envía el pago a través de PayPal F&F
6. PayPal envía notificación IPN a tu webhook
7. Sistema verifica automáticamente el pago
8. Orden se marca como completada

### Flujo Backend:

```
Cliente → paypal-ff.html 
    ↓
Create Order (paypal-ff-create-order.js)
    ↓
Guardar orden en DB (status: pending)
    ↓
Cliente envía pago por PayPal F&F
    ↓
PayPal envía IPN → paypal-ff-webhook.js
    ↓
Verificar IPN con PayPal
    ↓
Validar monto y orden ID
    ↓
Actualizar orden (status: completed)
    ↓
Cliente recibe productos
```

---

## ⚠️ Consideraciones Importantes

### Ventajas:
- ✅ Sin tarifas (o tarifas mínimas)
- ✅ Pago directo a tu cuenta
- ✅ Verificación automática vía IPN
- ✅ Proceso simple para el cliente

### Desventajas y Riesgos:
- ❌ **Viola los términos de servicio de PayPal** - Usar F&F para ventas comerciales está prohibido
- ❌ Tu cuenta de PayPal podría ser suspendida o limitada
- ❌ Sin protección al comprador (no pueden hacer chargebacks fácilmente)
- ❌ Requiere que los clientes confíen en ti
- ❌ Cliente debe incluir el ID de orden manualmente

### Recomendaciones:
1. Usa una cuenta de PayPal "secundaria" para minimizar riesgos
2. Ten un plan de respaldo (Stripe, PayPal Business, Crypto)
3. Informa claramente a los clientes que es F&F (sin protección)
4. Mantén un excelente servicio al cliente para evitar reportes

---

## 🧪 Probar el Sistema

### Prueba en Sandbox (Opcional):
1. Cambia `PAYPAL_ENV` a `sandbox` en `wrangler.toml`
2. Crea una cuenta sandbox en: https://developer.paypal.com/
3. Configura IPN en el sandbox

### Prueba en Producción:
1. Asegúrate que `PAYPAL_ENV = "live"` en producción
2. Configura el IPN como se describió arriba
3. Haz una prueba con una cantidad pequeña ($1-2)
4. Verifica que:
   - Se crea la orden
   - Aparecen las instrucciones correctas
   - El pago se detecta automáticamente
   - La orden se completa

---

## 📊 Monitoreo

### Ver Notificaciones IPN:
- Ve a PayPal → Account Settings → Notifications → IPN History
- Verás todas las notificaciones enviadas y su estado

### Debugging:
- Revisa los logs de Cloudflare Workers:
  ```bash
  wrangler tail
  ```
- Los errores aparecerán en tiempo real

### Base de Datos:
Las órdenes se guardan en Supabase con:
- `order_id`: ID único de la orden
- `payment_method`: "paypal_ff"
- `payment_status`: "pending" → "completed"
- `txn_id`: Transaction ID de PayPal (después del pago)
- `payer_email`: Email del que envió el pago

---

## 🔒 Seguridad

El sistema incluye verificación IPN con PayPal para prevenir pagos falsos:

```javascript
// En paypal-ff-webhook.js
async function verifyIPN(ipnData, env) {
  // Envía los datos de vuelta a PayPal
  // PayPal responde "VERIFIED" o "INVALID"
  // Solo procesamos si es "VERIFIED"
}
```

Esto asegura que todas las notificaciones son genuinas de PayPal.

---

## 📝 Variables de Entorno

En `wrangler.toml`:
```toml
PAYPAL_MANUAL_EMAIL = "soyalexesp123@gmail.com"  # Tu correo de PayPal
PAYPAL_ENV = "live"  # o "sandbox" para pruebas
```

En Cloudflare Dashboard (Secrets):
- `SUPABASE_ANON_KEY` - Para guardar órdenes

---

## 🆘 Solución de Problemas

### IPN no funciona:
1. Verifica la URL en PayPal Settings
2. Asegúrate que el Worker está desplegado: `wrangler deploy`
3. Revisa los logs: `wrangler tail`
4. Verifica que la ruta `/api/paypal-ff/webhook` esté en `_worker.js`

### Orden no se completa:
1. Verifica que el cliente incluyó el ID de orden en la nota
2. Revisa IPN History en PayPal
3. Verifica el monto (debe ser exacto)
4. Chequea que `payment_status` en IPN sea "Completed"

### Cliente no recibe instrucciones:
1. Verifica que el carrito tenga items
2. Chequea la consola del navegador (F12)
3. Verifica que el API_URL sea correcto en `paypal-ff.html`

---

## 📞 Soporte

Si algo no funciona:
1. Revisa los logs de Cloudflare
2. Verifica el IPN History en PayPal
3. Chequea la base de datos en Supabase
4. Contacta con los clientes que reportan problemas

---

## 🎯 Próximos Pasos

1. **Despliega los cambios:**
   ```bash
   wrangler deploy
   ```

2. **Configura IPN en PayPal** (paso 1 arriba)

3. **Prueba con un pago real pequeño**

4. **Opcional: Implementa notificaciones por email** cuando se completen pagos

5. **Opcional: Agrega auto-fulfillment** para entregar productos automáticamente

---

## ⚖️ Alternativas Recomendadas

Si prefieres evitar los riesgos de PayPal F&F:

1. **PayPal Business API** (ya implementado)
   - Con protección al comprador
   - Legal y según términos de servicio
   - Tarifas: 3.4% + $0.30

2. **Stripe** (ya implementado)
   - Profesional y confiable
   - Tarifas similares a PayPal

3. **Crypto** (ya implementado)
   - Sin intermediarios
   - Sin chargebacks
   - Anónimo

El sistema de PayPal F&F es una opción adicional para clientes que prefieren este método, pero úsalo bajo tu propio riesgo.
