# Configuración PayPal Manual con Detección Automática

## 🎯 Resumen
Sistema de pagos PayPal manual con verificación automática de transacciones mediante la API de PayPal.

## 📋 Variables de Entorno Requeridas

Agrega estas variables a tu archivo `.env` o en Cloudflare Workers:

```env
# PayPal API Credentials
PAYPAL_CLIENT_ID=tu_client_id
PAYPAL_SECRET=tu_secret
PAYPAL_ENV=live  # o 'sandbox' para pruebas

# Email de PayPal para recibir pagos (NUEVO)
PAYPAL_MANUAL_EMAIL=tu_email@paypal.com

# Supabase (ya configurado)
SUPABASE_URL=tu_supabase_url
SUPABASE_ANON_KEY=tu_supabase_key
```

## 🔧 Cómo Funciona

### 1. **Cliente solicita pago**
   - El cliente agrega productos al carrito
   - Selecciona PayPal como método de pago
   - Ingresa su email
   - Recibe instrucciones de pago con:
     * Email de PayPal destino
     * Monto exacto
     * Código de referencia único (ej: `PP-L8XYZ12-ABCDEF`)
     * Instrucción de enviar como "Amigos y Familiares"

### 2. **Cliente envía el pago**
   - Abre su app de PayPal
   - Envía el dinero a tu email por "Amigos y Familiares"
   - **IMPORTANTE**: Escribe el código de referencia en la nota

### 3. **Detección automática**
   - Un cron job ejecuta `/api/paypal/verify-payments` cada 2-5 minutos
   - Busca transacciones nuevas en tu cuenta PayPal
   - Compara las notas con los pedidos pendientes
   - Cuando encuentra coincidencia, asigna las cuentas automáticamente

### 4. **Pedido completado**
   - El sistema marca el pedido como completado
   - Las cuentas se asignan y marcan como vendidas
   - (Opcional) Envía email al cliente con sus credenciales

## ⚙️ Configuración del Cron Job

### Opción A: Cloudflare Workers Cron Triggers (Recomendado)

Agrega esto a tu `wrangler.toml`:

```toml
[triggers]
crons = ["*/3 * * * *"]  # Cada 3 minutos
```

Y crea un archivo `functions/_cron.js`:

```javascript
export default {
  async scheduled(event, env, ctx) {
    console.log('[Cron] Running PayPal verification...');
    
    try {
      const response = await fetch('https://tu-dominio.com/api/paypal/verify-payments', {
        method: 'POST'
      });
      
      const result = await response.json();
      console.log('[Cron] Verification result:', result);
      
      if (result.processed > 0) {
        console.log(`✅ Processed ${result.processed} orders`);
      }
    } catch (error) {
      console.error('[Cron] Error:', error);
    }
  }
};
```

### Opción B: Servicio Externo (EasyCron, cron-job.org)

1. Visita https://cron-job.org o https://www.easycron.com
2. Crea una cuenta gratuita
3. Configura un nuevo cron job:
   - **URL**: `https://tu-dominio.com/api/paypal/verify-payments`
   - **Método**: GET o POST
   - **Frecuencia**: Cada 3-5 minutos
   - **Timeout**: 30 segundos

### Opción C: Vercel Cron (si usas Vercel)

En `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/paypal/verify-payments",
    "schedule": "*/3 * * * *"
  }]
}
```

## 🧪 Pruebas

### 1. Probar creación de pedido manual:
```bash
curl -X POST https://tu-dominio.com/api/paypal/manual-create \
  -H "Content-Type: application/json" \
  -d '{
    "cart": [{"pid": "netflix", "plan": "1 Month", "qty": 1}],
    "customerEmail": "test@example.com"
  }'
```

Respuesta esperada:
```json
{
  "success": true,
  "reference": "PP-L8XYZ12-ABCDEF",
  "paypalEmail": "tu_email@paypal.com",
  "amount": "1.50",
  "instructions": { ... }
}
```

### 2. Probar verificación manual:
```bash
curl -X POST https://tu-dominio.com/api/paypal/verify-payments
```

Respuesta esperada:
```json
{
  "success": true,
  "processed": 0,
  "totalPending": 1,
  "transactionsChecked": 5
}
```

## ⚠️ Importante

1. **Permisos de PayPal API**: Asegúrate de que tu app de PayPal tenga permisos para:
   - Transaction Search
   - Reporting

2. **Notas en Pagos**: Pídele a tus clientes que escriban el código **EXACTAMENTE** como se muestra. El sistema buscará el patrón `PP-XXXXX-XXXXX`.

3. **Tiempo de procesamiento**: Los pagos se detectarán en la próxima ejecución del cron (2-5 minutos típicamente).

4. **Sandbox vs Live**: Para pruebas, usa `PAYPAL_ENV=sandbox` y credenciales de sandbox.

## 📊 Monitoreo

Puedes ver los logs en:
- **Cloudflare Workers**: Dashboard > Workers > Logs
- **Vercel**: Dashboard > Logs
- **Tu servidor**: `pm2 logs` o similar

## 🔍 Troubleshooting

### "No se detecta el pago"
1. Verifica que el cliente escribió la nota correctamente
2. Revisa los logs del cron job
3. Verifica que las credenciales de PayPal sean correctas
4. Asegúrate de que el cron esté ejecutándose

### "Error al buscar transacciones"
1. Verifica los permisos de la app de PayPal
2. Asegúrate de estar usando `PAYPAL_ENV=live` en producción
3. Revisa que las credenciales sean válidas

### "No hay cuentas disponibles"
1. Verifica el stock en Supabase tabla `accounts`
2. Asegúrate de que hay cuentas con `status='available'`
3. Verifica que el `product_id` y `plan` coincidan exactamente

## 🎉 ¡Listo!

Ahora tienes un sistema de PayPal completamente automático que:
- ✅ No requiere integración compleja con PayPal Checkout
- ✅ Acepta pagos de "Amigos y Familiares" (sin comisiones altas)
- ✅ Detecta y procesa pagos automáticamente
- ✅ Asigna cuentas sin intervención manual
