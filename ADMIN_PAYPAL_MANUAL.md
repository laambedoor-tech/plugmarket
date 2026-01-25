# Panel de Administración PayPal F&F - Manual de Uso

## 🎯 ¿Para qué sirve?

Este panel te permite confirmar manualmente los pagos de PayPal Friends & Family y actualizar automáticamente la pantalla del cliente en tiempo real.

## 🚀 Cómo Usar

### 1. Acceder al Panel

Abre en tu navegador:
```
https://plugmarket.es/admin-paypal.html
```

### 2. Ver Órdenes Pendientes

El panel muestra automáticamente:
- ✅ Todas las órdenes PayPal FF pendientes de confirmación
- 💰 Monto total y cantidad de órdenes pendientes
- 📧 Email del cliente
- 📦 Productos comprados
- ⏰ Tiempo transcurrido desde la creación

### 3. Confirmar un Pago

Cuando recibas un pago de PayPal:

1. **Verifica en PayPal** que el pago ha sido recibido
2. **Busca la orden** en el panel (por monto o email)
3. **Haz click** en "✅ Confirmar Pago Recibido"
4. **(Opcional)** Añade el ID de transacción de PayPal
5. **Confirma** la acción

### 4. Actualización en Tiempo Real del Cliente

Una vez confirmes el pago:
- ✅ La orden se marca como completada **instantáneamente**
- 🔄 La pantalla del cliente se actualiza **automáticamente** (polling cada 5 segundos)
- 🎉 El cliente ve el mensaje de éxito y puede acceder a sus productos
- 🛒 El carrito del cliente se vacía automáticamente
- 📧 El cliente recibe el email con sus productos

**No necesitas hacer nada más** - el sistema se encarga de todo.

## 🔄 Actualización Automática

El panel se actualiza automáticamente cada 30 segundos para mostrar nuevas órdenes. También puedes hacer click en el botón "🔄 Actualizar" para refrescar manualmente.

## 📋 Características

### En el Panel de Admin:
- ✅ Vista en tiempo real de órdenes pendientes
- 📊 Estadísticas de órdenes y montos
- 📋 Copiar Order ID al portapapeles
- 🔍 Ver detalles completos de cada pedido
- ⏱️ Tiempo transcurrido desde la creación
- 🔄 Auto-refresh cada 30 segundos

### En la Pantalla del Cliente:
- 🔄 Polling automático cada 5 segundos
- ✅ Detección instantánea de pago confirmado
- 🎉 Modal de éxito automático
- 🛒 Limpieza automática del carrito
- 📧 Acceso inmediato a productos

## 🛠️ Integración Técnica

### Flujo Completo:

1. **Cliente crea orden** → Se genera un `PPFF-xxxxx`
2. **Cliente envía pago** → Sigue las instrucciones de PayPal
3. **Tú recibes pago** → Lo ves en tu cuenta PayPal
4. **Confirmas en admin** → Click en "Confirmar Pago Recibido"
5. **Sistema actualiza BD** → `PPFF-xxxxx` → `PPFF-xxxxx_completed_timestamp`
6. **Cliente detecta cambio** → Polling cada 5 seg detecta `_completed_`
7. **Cliente ve éxito** → Modal automático + carrito vaciado

### Endpoints Utilizados:

- `GET /api/get-orders` - Lista todas las órdenes (admin)
- `POST /api/paypal-ff/manual-complete` - Confirma pago (admin)
- `GET /api/paypal-ff/check-order?orderId=PPFF-xxx` - Verifica estado (cliente)

### Polling del Cliente:

El archivo `cart.js` ya incluye el sistema de polling:
```javascript
// Se ejecuta cada 5 segundos
paypalPoll = setInterval(async () => {
  const statusRes = await fetch(`${API_BASE}/api/paypal-ff/check-order?orderId=${orderId}`);
  const statusData = await statusRes.json();
  
  if (statusData.status === 'completed') {
    // ✅ Mostrar éxito y vaciar carrito
    setPayPalStatus('confirmed');
    setCart([]);
    // Modal de éxito
  }
}, 5000);
```

## 🔒 Seguridad

**Importante:** Este panel NO tiene autenticación. Para producción, deberías:

1. Añadir autenticación básica
2. Proteger con `.htaccess` o similar
3. Usar HTTPS siempre
4. Considerar añadir un token de admin en las peticiones

### Ejemplo de Protección Simple:

Puedes proteger la página con un password simple añadiendo al inicio del HTML:

```javascript
<script>
  const ADMIN_PASSWORD = 'tu-password-seguro';
  const entered = prompt('Ingresa la contraseña de administrador:');
  if (entered !== ADMIN_PASSWORD) {
    document.body.innerHTML = '<h1>Acceso Denegado</h1>';
  }
</script>
```

## 📱 Uso Móvil

El panel es totalmente responsive y funciona perfectamente en móvil. Puedes confirmar pagos desde tu teléfono mientras estés fuera.

## ❓ Preguntas Frecuentes

### ¿Qué pasa si confirmo una orden dos veces?
El sistema detecta si ya está completada y no la duplica.

### ¿Puedo cancelar una confirmación?
No, una vez confirmada, la orden se marca como completada permanentemente.

### ¿El cliente ve la actualización inmediatamente?
Sí, máximo en 5 segundos (el intervalo del polling).

### ¿Puedo ver órdenes ya completadas?
No, este panel solo muestra pendientes. Usa `/orders.html` para ver todas las órdenes.

### ¿Necesito estar conectado todo el tiempo?
No, puedes cerrar el panel. El cliente seguirá haciendo polling hasta que confirmes.

## 🎨 Personalización

El panel usa los mismos estilos de PlugMarket. Puedes modificar `admin-paypal.html` para ajustar:
- Colores
- Intervalo de auto-refresh
- Campos mostrados
- Orden de visualización

## 📞 Soporte

Para problemas o sugerencias, revisa los logs del navegador (F12) y los logs de Cloudflare Workers.

---

**Desarrollado para PlugMarket** | PayPal F&F Manual Confirmation System
