# My Account System - Configuration Guide

## Overview
Sistema de autenticación por email con código de verificación de 6 dígitos para Plug Market.

## Archivos Creados

### Frontend
- `my-account.html` - Página de login con formulario de email y código
- `dashboard.html` - Panel del usuario con estadísticas y órdenes
- `js/auth.js` - Lógica de autenticación del cliente
- `js/dashboard.js` - Lógica del dashboard

### Backend (Cloudflare Functions)
- `functions/send-verification-code.js` - Envía código al email
- `functions/verify-code.js` - Verifica código y genera JWT
- `functions/get-user-orders.js` - Obtiene órdenes del usuario
- `functions/delete-account.js` - Elimina cuenta del usuario

### Database
- `schema-auth.sql` - Esquema de base de datos

## Configuración Requerida

### 1. Variables de Entorno (Cloudflare Workers)

Agrega estas variables en tu dashboard de Cloudflare Workers:

```bash
SENDGRID_API_KEY=your_sendgrid_api_key_here
FROM_EMAIL=noreply@plugmarket.com
JWT_SECRET=your_secure_random_secret_here
```

### 2. Base de Datos (Cloudflare D1)

Ejecuta el schema SQL en tu base de datos D1:

```bash
wrangler d1 execute DB --file=./schema-auth.sql
```

O crea las tablas manualmente en el dashboard de Cloudflare.

### 3. SendGrid Setup

1. Crea una cuenta en SendGrid (sendgrid.com)
2. Verifica tu dominio de email
3. Crea una API Key con permisos de envío
4. Agrega la API key a las variables de entorno

### 4. Configurar CORS

Asegúrate de que tus Workers tengan CORS habilitado para el dominio de tu sitio.

## Cómo Funciona

### Flujo de Autenticación

1. **Usuario ingresa email** → Click "Send code"
2. **Sistema genera código de 6 dígitos** → Se guarda en DB con expiración de 15 min
3. **Email enviado** → Usuario recibe código por email
4. **Usuario ingresa código** → Sistema verifica contra DB
5. **Código válido** → Sistema genera JWT token (válido 30 días)
6. **Usuario autenticado** → Redirige al dashboard

### Seguridad

- Códigos expiran en 15 minutos
- Códigos de un solo uso (se eliminan después de usar)
- JWT tokens válidos por 30 días
- Tokens verificados en cada request protegido
- Email template profesional con warnings de seguridad

## Testing

### Test Local

1. Abre `my-account.html` en el navegador
2. Ingresa un email válido
3. Verifica que el email llegue (revisa spam)
4. Ingresa el código de 6 dígitos
5. Deberías ser redirigido al dashboard

### Test de Endpoints

```bash
# Send code
curl -X POST https://your-worker.workers.dev/send-verification-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Verify code
curl -X POST https://your-worker.workers.dev/verify-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","code":"123456"}'

# Get user orders (requires auth token)
curl -X POST https://your-worker.workers.dev/get-user-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"email":"test@example.com"}'
```

## Personalización

### Cambiar duración del código
En `send-verification-code.js`, línea 20:
```javascript
const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
```

### Cambiar duración del token
En `verify-code.js`, línea 46:
```javascript
exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 días
```

### Personalizar email
Edita el HTML en `send-verification-code.js`, líneas 49-96.

## Troubleshooting

### Los emails no llegan
- Verifica que SENDGRID_API_KEY esté correctamente configurada
- Verifica que el dominio esté verificado en SendGrid
- Revisa la carpeta de spam
- Verifica los logs de Cloudflare Workers

### Código inválido
- Verifica que el código no haya expirado (15 min)
- Asegúrate de que la tabla `verification_codes` exista en D1
- Verifica que el email sea exactamente el mismo

### Token inválido
- Verifica que JWT_SECRET esté configurado
- El token expira después de 30 días
- Limpia localStorage y vuelve a hacer login

## Mantenimiento

### Limpiar códigos expirados

Ejecuta periódicamente (cron job recomendado):
```sql
DELETE FROM verification_codes WHERE expires_at < datetime('now');
```

### Estadísticas de usuarios

```sql
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN last_login > datetime('now', '-7 days') THEN 1 END) as active_users_7d
FROM users;
```

## Próximas Mejoras

- [ ] Rate limiting para prevenir spam
- [ ] Recuperación de cuenta
- [ ] Notificaciones por email de nuevas órdenes
- [ ] Preferencias de usuario
- [ ] Historial de logins
- [ ] Two-factor authentication (2FA)

## Soporte

Para problemas o preguntas, contacta al equipo de desarrollo o abre un ticket en Discord.
