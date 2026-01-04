# Configuración ChatGPT - Credenciales Extendidas

## 📋 Resumen

Se ha actualizado el sistema para soportar credenciales extendidas de ChatGPT, mostrando:
- Instrucciones de acceso (Domain Access + Extra Info)
- HOTMAIL (mail) y HOTMAIL (pw)
- CHATGPT (pw) - opcional
- CHATGPT (Code) - opcional

## 🗄️ Configuración de Supabase

### Paso 1: Ejecutar SQL

Ve a tu proyecto de Supabase → SQL Editor y ejecuta:

```sql
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS chatgpt_password TEXT,
ADD COLUMN IF NOT EXISTS chatgpt_code TEXT;
```

O también puedes ejecutar el archivo completo: `supabase-chatgpt-setup.sql`

### Paso 2: Agregar Cuentas de ChatGPT

Cuando agregues cuentas de ChatGPT en Supabase, usa esta estructura:

| Columna | Ejemplo | Descripción |
|---------|---------|-------------|
| `product_id` | `chatgpt` | ID del producto |
| `plan` | `1 Month` | Plan de suscripción |
| `status` | `available` | Estado de la cuenta |
| `email` | `posadacarlston95678@outlook.com` | Email de Hotmail |
| `password` | `4Z9MSU5MJ1` | Contraseña de Hotmail |
| `chatgpt_password` | `Alone@123456` | Contraseña de ChatGPT (opcional) |
| `chatgpt_code` | `chatgpt.com/p/C8R8J6GW4WKWJ5Z4` | Código de ChatGPT (opcional) |

**Nota:** Los campos `chatgpt_password` y `chatgpt_code` son opcionales. Si no los agregas, solo se mostrará el email y contraseña de Hotmail.

### Ejemplo de Inserción Manual:

```sql
INSERT INTO accounts (
  product_id,
  plan,
  status,
  email,
  password,
  chatgpt_password,
  chatgpt_code,
  created_at
) VALUES (
  'chatgpt',
  '1 Month',
  'available',
  'posadacarlston95678@outlook.com',
  '4Z9MSU5MJ1',
  'Alone@123456',
  'chatgpt.com/p/C8R8J6GW4WKWJ5Z4',
  NOW()
);
```

## 🎨 Cómo se Muestra al Cliente

### Para Productos ChatGPT:

Cuando un cliente compre ChatGPT, verá en su página de pedidos:

```
📋 Instrucciones
Domain Access: outlook/hotmail
Extra Info: Si la cuenta no tiene "Plus Plan", por favor inicia sesión 
en la cuenta y luego usa el código chatgpt (lo encontrarás en la entrega)

📦 Deliverables

HOTMAIL (mail)
posadacarlston95678@outlook.com

HOTMAIL (pw)
4Z9MSU5MJ1

CHATGPT (pw)
Alone@123456

CHATGPT (Code)
chatgpt.com/p/C8R8J6GW4WKWJ5Z4
```

### Para Otros Productos:

Los demás productos mantienen el formato original:
- Email
- Contraseña

## 🔧 Archivos Modificados

### Frontend:
- ✅ `js/orders.js` - Renderizado de credenciales con formato especial para ChatGPT

### Backend (Cloudflare Workers):
- ✅ `functions/paypal-capture-order.js` - Asignación de cuentas PayPal
- ✅ `functions/stripe-webhook.js` - Asignación de cuentas Stripe
- ✅ `functions/crypto-now-ipn.js` - Asignación de cuentas Crypto
- ✅ `functions/coinbase-webhook.js` - Asignación de cuentas Coinbase

### Backend (Netlify Functions):
- ✅ `netlify/functions/stripe-webhook.js` - Versión alternativa Stripe

## 🧪 Probar la Configuración

1. Ejecuta el SQL en Supabase
2. Agrega una cuenta de prueba de ChatGPT con todos los campos
3. Haz una compra de prueba
4. Ve a la página de pedidos (orders.html) e ingresa tu email
5. Verifica que las credenciales se muestren con el formato correcto

## ⚠️ Importante

- Los campos `chatgpt_password` y `chatgpt_code` son **opcionales**
- Si no existen en la base de datos, solo se mostrará email y password normal
- El sistema detecta automáticamente si el producto es ChatGPT por su `pid === 'chatgpt'`
- Para otros productos, el formato permanece sin cambios
