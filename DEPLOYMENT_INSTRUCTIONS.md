# 🚀 Pasos para Activar PayPal Automático

## ✅ Lo que se ha implementado

1. **Nuevo flujo de pago manual** con instrucciones visuales para el cliente
2. **Detección automática** de pagos mediante PayPal Transaction Search API
3. **Procesamiento automático** que asigna cuentas cuando detecta el pago
4. **Cron job** configurado para verificar cada 3 minutos

## 📦 Archivos Creados/Modificados

- ✅ `functions/paypal-manual-create.js` - Genera pedidos pendientes con código único
- ✅ `functions/paypal-verify-payments.js` - Verifica y procesa pagos automáticamente
- ✅ `functions/_worker.js` - Rutas y cron handler añadidos
- ✅ `js/cart.js` - UI modificada para mostrar instrucciones
- ✅ `wrangler.toml` - Cron trigger configurado
- ✅ `PAYPAL_MANUAL_SETUP.md` - Documentación completa

## 🔧 Pasos para Activar

### 1. **Configurar Secreto en Cloudflare**

Ve a tu Dashboard de Cloudflare Workers y añade:

```bash
# Opción A: Desde la terminal con wrangler CLI
wrangler secret put PAYPAL_MANUAL_EMAIL
# Cuando te pregunte, ingresa: tu_email@paypal.com

# Opción B: Desde el Dashboard
# 1. Ve a Workers & Pages > plugmarket-api > Settings > Variables
# 2. Click "Add variable" > Type: Secret
# 3. Name: PAYPAL_MANUAL_EMAIL
# 4. Value: tu_email@paypal.com
```

### 2. **Verificar Permisos de PayPal API**

Tu app de PayPal necesita estos permisos:

1. Ve a https://developer.paypal.com/dashboard/applications/sandbox (o /live)
2. Selecciona tu app
3. En "Features" asegúrate de tener habilitado:
   - ✅ **Transaction Search**
   - ✅ **Reporting**

Si no están habilitados:
- Puede que necesites solicitar acceso adicional
- O usa las credenciales de una cuenta Business PayPal real

### 3. **Desplegar a Cloudflare**

```bash
# Desde la carpeta del proyecto
cd c:\Users\Alex\Desktop\PlugMarket

# Desplegar
wrangler deploy

# Verificar que el cron esté activo
wrangler deployments list
```

### 4. **Verificar que el Cron esté funcionando**

```bash
# Ver logs en tiempo real
wrangler tail

# Deberías ver cada 3 minutos:
# [Cron] Running PayPal payment verification...
# ℹ️ [Cron] No pending orders to process
# (o el resultado del procesamiento)
```

### 5. **Probar el flujo completo**

#### A. Crear un pedido de prueba:

1. Ve a https://plugmarket.pages.dev/cart.html
2. Agrega un producto al carrito
3. Click en "Checkout"
4. Selecciona la pestaña "PayPal"
5. Ingresa tu email
6. Click "Continuar con PayPal"
7. Verás las instrucciones con un código como `PP-L8XYZ12-ABCDEF`

#### B. Enviar el pago (SANDBOX):

1. Abre tu cuenta de PayPal Sandbox
2. Envía el dinero exacto a tu email de prueba
3. **IMPORTANTE**: En la nota escribe exactamente el código `PP-L8XYZ12-ABCDEF`
4. Envía como "Amigos y Familiares"

#### C. Esperar detección automática:

- En máximo 3 minutos, el cron job detectará el pago
- El pedido se completará automáticamente
- Las cuentas se asignarán
- Verás en los logs: `✅ [Cron] Processed 1 orders automatically`

### 6. **Verificar en Base de Datos**

```sql
-- Ver pedidos pendientes
SELECT * FROM orders 
WHERE payment_method = 'paypal_manual' 
AND status = 'pending_payment';

-- Ver pedidos completados
SELECT * FROM orders 
WHERE payment_method = 'paypal_manual' 
AND status = 'completed';
```

## 🧪 Modo Sandbox vs Live

### Para pruebas (Sandbox):
```env
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=AWBRnqor... (tus credenciales sandbox)
PAYPAL_SECRET=... (secret sandbox)
PAYPAL_MANUAL_EMAIL=sb-tu-cuenta@business.example.com
```

### Para producción (Live):
```env
PAYPAL_ENV=live
PAYPAL_CLIENT_ID=... (credenciales live)
PAYPAL_SECRET=... (secret live)
PAYPAL_MANUAL_EMAIL=tu_email_real@paypal.com
```

## ⚠️ Troubleshooting

### Error: "PayPal manual payments not configured"
- Falta agregar `PAYPAL_MANUAL_EMAIL` en los secretos
- Ejecuta: `wrangler secret put PAYPAL_MANUAL_EMAIL`

### Error: "Failed to get PayPal token"
- Verifica que `PAYPAL_CLIENT_ID` y `PAYPAL_SECRET` sean correctos
- Asegúrate de que coincidan con el entorno (sandbox/live)

### Error: "No pending orders to verify"
- Normal si no hay pedidos esperando pago
- Crea un pedido de prueba primero

### Los pagos no se detectan automáticamente
1. Verifica que el cron esté activo: `wrangler deployments list`
2. Revisa los logs: `wrangler tail`
3. Verifica que la nota del pago sea exacta
4. Asegúrate de que tu app tenga permisos de Transaction Search

### "No available accounts"
- Necesitas agregar cuentas a la tabla `accounts` en Supabase
- Verifica que tengan `status='available'`

## 📊 Monitorear Pagos en Tiempo Real

```bash
# Terminal 1: Ver logs del worker
wrangler tail

# Terminal 2: Ver logs del cron
wrangler tail --format=json | grep "Cron"

# Ver solo verificaciones de PayPal
wrangler tail | grep "PayPal"
```

## 🎯 Resultado Final

Ahora tu tienda tiene:

✅ **Pago con PayPal "Amigos y Familiares"** (sin comisiones altas)
✅ **Instrucciones claras** mostradas al cliente con código único
✅ **Detección automática** cada 3 minutos
✅ **Procesamiento automático** de pedidos sin intervención
✅ **Escalable** para manejar múltiples pedidos simultáneos

## 🔥 Próximos Pasos Opcionales

1. **Email de confirmación**: Añadir envío de email cuando se complete el pedido
2. **Notificaciones**: Integrar Discord/Telegram para alertas de nuevos pedidos
3. **Panel admin**: Crear interfaz para ver pedidos pendientes manualmente
4. **Reembolsos**: Sistema para marcar pedidos como reembolsados

---

**¿Dudas?** Revisa `PAYPAL_MANUAL_SETUP.md` para más detalles técnicos.
