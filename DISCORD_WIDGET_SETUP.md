# Discord Widget Setup - Plug Market

## 🔧 Configuración del Widget de Discord

Para que el widget de Discord en la página de reviews muestre datos reales y actualizados de tu servidor, necesitas configurar el **Server ID** de Discord.

### Paso 1: Obtener tu Discord Server ID

1. **Abre Discord** (aplicación de escritorio o web)
2. Ve a **Configuración de Usuario** (⚙️ abajo a la izquierda)
3. Ve a **Avanzado** (Advanced)
4. Activa **Modo de Desarrollador** (Developer Mode)
5. Cierra la configuración
6. Haz **clic derecho** en tu servidor "Plug Market"
7. Selecciona **Copiar ID** (Copy ID)
8. Guarda este número, es tu Server ID

### Paso 2: Habilitar el Widget en Discord

1. En tu servidor de Discord, haz clic en el nombre del servidor (arriba)
2. Selecciona **Configuración del Servidor** (Server Settings)
3. Ve a **Widget**
4. Activa **Habilitar Widget del Servidor** (Enable Server Widget)
5. Opcionalmente, selecciona un canal de invitación
6. Guarda los cambios

### Paso 3: Actualizar el código

Abre el archivo `reviews.html` y busca esta línea (aproximadamente línea 1090):

```javascript
const serverId = '1234567890'; // Replace with your Discord server ID
```

Reemplaza `'1234567890'` con tu Server ID real:

```javascript
const serverId = 'TU_SERVER_ID_AQUI'; // Ej: '1147895632147895632'
```

### Paso 4: Verificar que funciona

1. Guarda el archivo
2. Despliega los cambios con: `npm run deploy`
3. Visita tu página de reviews
4. Deberías ver los datos actualizados de tu Discord

---

## 📊 Datos que se muestran

El widget muestra:
- ✅ **Miembros online**: Actualizado en tiempo real
- ✅ **Total de miembros**: Estimado basado en la API de Discord
- ✅ **Órdenes resueltas**: Dato estático (puedes actualizarlo manualmente)
- ✅ **Tiempo de respuesta**: Dato estático (puedes actualizarlo manualmente)

---

## 🎨 Personalización

### Cambiar los textos de la animación

En `reviews.html`, busca (línea ~1070):

```javascript
const texts = [
  'Discord.',
  'Community.',
  'Support Hub.',
  'Team.',
  'Family.'
];
```

Puedes agregar o cambiar los textos que quieras que aparezcan en la animación.

### Actualizar estadísticas estáticas

En la línea del HTML donde dice:

```html
<div class="discord-stat-value" id="discord-orders">23,567</div>
```

Cambia `23,567` por el número real de órdenes que has procesado.

---

## 🚨 Solución de Problemas

### El widget no muestra datos actualizados

1. **Verifica que el Widget está habilitado** en la configuración del servidor de Discord
2. **Verifica el Server ID** - debe ser un número largo (18 dígitos aprox.)
3. **Espera unos minutos** - la API de Discord puede tardar en actualizar
4. **Revisa la consola del navegador** (F12) para ver si hay errores

### Los datos no se actualizan

- El widget se actualiza automáticamente cada 5 minutos
- Si quieres actualizar más frecuentemente, cambia esta línea (línea ~1125):

```javascript
setInterval(fetchDiscordWidget, 5 * 60 * 1000); // 5 minutos
```

Por ejemplo, para actualizar cada 2 minutos:

```javascript
setInterval(fetchDiscordWidget, 2 * 60 * 1000); // 2 minutos
```

---

## 📝 Notas

- La API del Widget de Discord tiene limitaciones y **no proporciona el número total de miembros**
- Si no configuras el Server ID o el widget no está habilitado, se mostrarán datos estáticos de fallback
- Los datos estáticos (órdenes, tiempo de respuesta) debes actualizarlos manualmente en el HTML

---

## 🔗 Links útiles

- [Discord Developer Portal](https://discord.com/developers/docs/resources/guild#get-guild-widget)
- [Widget Documentation](https://discord.com/developers/docs/resources/guild#guild-widget-object)
