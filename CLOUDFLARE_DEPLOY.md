# Desplegar PlugMarket a Cloudflare Pages + Workers

**Tiempo estimado: 15 minutos**

## ¿Por qué Cloudflare?

- ✅ **100% gratuito** (sin límites de requests como Netlify)
- ✅ **Sin sorpresas de billing**
- ✅ **Deploy automático desde GitHub**
- ✅ **Funciones serverless incluidas** (Workers)
- ✅ **Performance global** (red de Cloudflare)

---

## 1️⃣ Crear cuenta Cloudflare

1. Ve a https://dash.cloudflare.com/sign-up
2. Regístrate con email + contraseña
3. Verifica tu email
4. Elige el plan **Free** (gratis, sin límites)

---

## 2️⃣ Desplegar el sitio en Cloudflare Pages

### 2.1 Conectar GitHub a Cloudflare Pages

1. En el dashboard de Cloudflare, ve a la izquierda: **Pages** → **Connect to Git**
2. Selecciona **GitHub** y autoriza Cloudflare
3. Busca tu repo: `laambedoor-tech/plugmarket`
4. Clic en **Connect account**

### 2.2 Configurar el deploy

En la pantalla de configuración:

| Campo | Valor |
|-------|-------|
| **Production branch** | `main` |
| **Framework preset** | `None` (estático con Workers) |
| **Build command** | (dejar vacío) |
| **Build output directory** | `.` |

5. Clic en **Save and Deploy**

Cloudflare desplegará tu sitio en **1-2 minutos**. Te mostrará una URL como:

```
https://plugmarket.pages.dev
```

✅ Tu sitio estático ya está online.

---

## 3️⃣ Crear y configurar Cloudflare Workers (funciones)

Los Workers son las "serverless functions" de Cloudflare (equivalentes a Netlify Functions).

### 3.1 Crear un Worker

1. En Cloudflare, ve a **Workers & Pages** en la izquierda
2. Clic en **Create Application** → **Create Worker**
3. Clic en **Create Service**
4. Dale un nombre, ej: `plugmarket-api`
5. Clic en **Create Service** (se abrirá un editor)
6. **No necesitas editar nada por ahora**; dejalo por defecto y guarda

### 3.2 Conectar Workers al sitio (routing)

1. Ve a tu sitio Pages: **Pages** → **plugmarket** → **Settings**
2. En la izquierda, clic en **Functions** 
3. En "Function routing", añade una nueva ruta:
   - **Pattern**: `/api/*`
   - **Function**: `plugmarket-api` (o el nombre que le diste)
4. Clic en **Save**

Esto redirige todas las peticiones a `/api/*` hacia tu Worker.

---

## 4️⃣ Configurar variables de entorno

Las variables de entorno (Stripe keys, Supabase config) deben estar en el Worker.

### 4.1 En Cloudflare Dashboard

1. Ve a **Workers & Pages** → **plugmarket-api** → **Settings**
2. En la izquierda, clic en **Environment Variables**
3. Clic en **Add Variable** y copia-pega estas variables:

| Variable | Valor |
|----------|-------|
| `STRIPE_PUBLISHABLE_KEY` | Tu key pública de Stripe (comienza con `pk_test_` o `pk_live_`) |
| `STRIPE_SECRET_KEY` | Tu key secreta de Stripe (comienza con `sk_test_` o `sk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | **(Se completa en el paso 5.2)** |
| `SUPABASE_URL` | URL de tu proyecto Supabase (ej: `https://twewcjgphqunpjchwliv.supabase.co`) |
| `SUPABASE_ANON_KEY` | Tu clave anónima de Supabase |

Deja `STRIPE_WEBHOOK_SECRET` en blanco por ahora; lo rellenarás después.

4. Haz clic en **Save** después de cada variable

### 4.2 Obtener tus claves

**Stripe:**
- Ve a https://dashboard.stripe.com/apikeys
- Copia `Publishable Key` (pk_...)
- Copia `Secret Key` (sk_...)

**Supabase:**
- Ve a tu proyecto Supabase
- **Settings** → **API** en la izquierda
- Copia `Project URL` (SUPABASE_URL)
- Copia `anon` key (SUPABASE_ANON_KEY)

---

## 5️⃣ Configurar Stripe Webhook

### 5.1 Crear endpoint en Stripe

1. Ve a https://dashboard.stripe.com/webhooks
2. Clic en **Add an Endpoint**
3. En "Endpoint URL", pega:
   ```
   https://plugmarket.pages.dev/api/stripe-webhook
   ```
   (Reemplaza `plugmarket` con tu URL real si es diferente)

4. En "Events to send", selecciona:
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`

5. Clic en **Add Endpoint**

### 5.2 Obtener el Signing Secret

1. En la lista de webhooks, haz clic en el que acabas de crear
2. En la sección "Signing secret", clic en **Reveal**
3. Copia el secret (comienza con `whsec_`)
4. Ve a **Cloudflare** → **plugmarket-api** → **Environment Variables**
5. Añade o actualiza:
   - **Variable**: `STRIPE_WEBHOOK_SECRET`
   - **Valor**: El secret que copiaste
6. Clic en **Save**

---

## 6️⃣ Deploy automático

¡Listo! Ahora:

1. **Cloudflare redesplegará tu sitio automáticamente** cuando hagas push a `main` en GitHub
2. Las funciones se actualizarán automáticamente

Para verificar:

```powershell
git status
git add -A
git commit -m "Migrate to Cloudflare"
git push origin main
```

Cloudflare detectará el push en segundos y redesplegará.

---

## 7️⃣ Verificar que todo funciona

1. Abre tu sitio: https://plugmarket.pages.dev
2. Añade un producto al carrito
3. Clic en "Checkout"
4. Completa un pago con tarjeta de prueba: `4242 4242 4242 4242`
5. Verifica en los **Logs** de Cloudflare que el webhook se ejecutó correctamente

### Ver logs

- Ve a **plugmarket-api** → **Logs** en Cloudflare
- Revisa que los eventos `payment_intent.succeeded` se procesen sin errores
- Verifica que Supabase reciba la asignación de cuenta

---

## 📝 Resumen

| Paso | Lo que hicimos |
|------|----------------|
| 1 | Cuenta Cloudflare |
| 2 | Sitio estático en Pages (URL: plugmarket.pages.dev) |
| 3 | Worker creado (`plugmarket-api`) |
| 4 | Rutas `/api/*` → Worker |
| 5 | Variables de entorno en el Worker |
| 6 | Webhook de Stripe configurado |
| 7 | Deploy automático desde GitHub |

---

## 🆘 Si algo falla

**El sitio se ve pero el checkout no funciona:**
- Revisa que todas las variables de entorno estén configuradas en Cloudflare
- Comprueba en los logs del Worker si hay errores

**El webhook no asigna cuentas:**
- Verifica que `STRIPE_WEBHOOK_SECRET` esté bien copiado en Cloudflare
- Comprueba que `SUPABASE_URL` y `SUPABASE_ANON_KEY` sean correctos
- Revisa los logs de Cloudflare para ver qué error ocurre

**¿Cómo accedo a los logs?**
- **Cloudflare**: Ve a **plugmarket-api** → **Logs** y filtra por tus eventos
- **Stripe**: Ve a https://dashboard.stripe.com/webhooks → tu endpoint → Event logs

---

## 🎉 ¡Listo!

Tu sitio está ahora desplegado en Cloudflare, **100% gratuito y sin límites**.

- Frontend: https://plugmarket.pages.dev
- APIs: /api/get-stripe-config, /api/create-payment-intent, /api/stripe-webhook
- **Sin más suspeniones por créditos**
- Deploy automático con cada push a GitHub
