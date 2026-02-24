// Chat Widget - Plug Market Support Bot
(function() {
  'use strict';

  // SVG del bot - logo Plug transformado en cara
  const botFaceSVG = `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="plugGrad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ff2743"/>
        <stop offset="100%" stop-color="#ff5f6d"/>
      </linearGradient>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <!-- Fondo oscuro -->
    <rect width="100" height="100" rx="22" fill="#0b0b0c"/>
    <!-- Círculo exterior con glow -->
    <circle cx="50" cy="50" r="38" fill="none" stroke="url(#plugGrad)" stroke-width="5" filter="url(#glow)"/>
    <!-- Ojos - los pines del enchufe -->
    <rect x="34" y="28" width="8" height="18" rx="3" fill="url(#plugGrad)" filter="url(#glow)"/>
    <rect x="58" y="28" width="8" height="18" rx="3" fill="url(#plugGrad)" filter="url(#glow)"/>
    <!-- Brillos en los ojos -->
    <circle cx="40" cy="33" r="2" fill="#fff" opacity="0.8"/>
    <circle cx="64" cy="33" r="2" fill="#fff" opacity="0.8"/>
    <!-- Boca sonriente - cuerpo del enchufe -->
    <path d="M30 52 L30 58 Q30 72 50 72 Q70 72 70 58 L70 52 L62 52 L62 58 Q62 65 50 65 Q38 65 38 58 L38 52 Z" fill="url(#plugGrad)" filter="url(#glow)"/>
  </svg>`;

  // Configuración de respuestas del bot - EN/ES
  const botResponses = {
    en: {
      // === ACCOUNT ISSUES ===
      'account not working': {
        message: '😔 Sorry to hear you\'re having issues with your account. To fix it quickly:\n\n1. Make sure you\'re using the exact credentials we sent\n2. Try logging out from all devices\n3. Wait 5 minutes and try again\n\n📩 If the problem persists, **open a ticket on Discord** with your order number and we\'ll help you right away.',
        buttons: ['Open Discord', 'View my orders']
      },
      'password changed': {
        message: '🔄 **If the password was changed:**\n\nThis sometimes happens. Don\'t worry!\n\n1. Open a ticket on Discord immediately\n2. Provide your order number\n3. We\'ll send you new credentials\n\n⚡ Replacements are usually done within 1-2 hours.',
        buttons: ['Open Discord', 'View my orders']
      },
      '2fa problem': {
        message: '🔐 **2FA/Verification Issues:**\n\nIf the account asks for 2FA or verification code:\n\n1. **DO NOT** try to set up your own 2FA\n2. Open a Discord ticket immediately\n3. We\'ll provide the verification or replace the account\n\n⏱️ This is usually resolved within 30 minutes.',
        buttons: ['Open Discord', 'View my orders']
      },
      'account banned': {
        message: '🚫 **If Account Was Banned:**\n\nWe offer replacement if:\n• Account was banned within warranty period\n• You didn\'t violate terms of service\n• You didn\'t change password/email\n\n📩 Open a Discord ticket with proof of the ban and we\'ll replace it.',
        buttons: ['Open Discord', 'View terms']
      },
      'wrong credentials': {
        message: '❌ **Wrong Credentials?**\n\nTry these steps:\n\n1. **Copy & paste** - don\'t type manually\n2. Check for **spaces** before/after\n3. Some passwords have special characters like: | \\ / @ #\n4. Make sure CAPS LOCK is off\n\n📩 If still not working, open a ticket with your order number.',
        buttons: ['Open Discord', 'View my orders']
      },

      // === ORDERS ===
      'where is my order': {
        message: '📦 To view your order:\n\n1. Go to "My Orders" in the menu\n2. Search with your purchase email\n3. Credentials appear there directly\n\n⏱️ Orders are delivered **instantly** after payment. If you don\'t see it, check the email you used.',
        buttons: ['View my orders', 'Contact support']
      },
      'instant delivery': {
        message: '⚡ **Instant Delivery:**\n\nYes! All orders are delivered **immediately** after payment:\n\n• Credentials appear on screen\n• Also sent to your email\n• Available in "My Orders"\n\n📱 No waiting - start using your account in seconds!',
        buttons: ['View products', 'View my orders']
      },
      'didnt receive email': {
        message: '📧 **Didn\'t Receive Email?**\n\n1. Check your **SPAM/Junk** folder\n2. Search for "Plug Market" or "plugmarket"\n3. Verify you used the correct email\n\n💡 You can always view credentials in "My Orders" without email.\n\n📩 If still missing, contact support.',
        buttons: ['View my orders', 'Open Discord']
      },

      // === PAYMENTS ===
      'payment methods': {
        message: '💳 We accept various payment methods:\n\n• **Credit/debit card** (Visa, Mastercard, Amex)\n• **PayPal**\n• **Cryptocurrencies** (Bitcoin, ETH, USDT, etc.)\n• **Account balance** (if you have balance)\n\nAll payments are 100% secure and encrypted.',
        buttons: ['View products', 'Contact support']
      },
      'payment failed': {
        message: '❌ **Payment Failed?**\n\nThis can happen due to:\n\n• Card declined by bank (try another card)\n• Insufficient funds\n• 3D Secure not completed\n• VPN/Proxy blocking\n\n💡 **Try**: Disable VPN, use another browser, or try PayPal/crypto.',
        buttons: ['Contact support', 'View products']
      },
      'crypto payment': {
        message: '₿ **Crypto Payments:**\n\nWe accept:\n• Bitcoin (BTC)\n• Ethereum (ETH)\n• USDT (TRC20 & ERC20)\n• Litecoin (LTC)\n• And more!\n\n⏱️ Delivery after 1 network confirmation.\n💡 Some cryptos are faster than others (LTC, USDT recommended).',
        buttons: ['View products', 'Contact support']
      },
      'discount code': {
        message: '🎁 **Discount Codes:**\n\nTo use a discount code:\n\n1. Add products to cart\n2. Enter code in the discount field\n3. Click "Apply"\n\n📢 Follow us on Discord for exclusive promo codes and flash sales!',
        buttons: ['Open Discord', 'View products']
      },
      'prices': {
        message: '💰 **Our Prices:**\n\nWe offer the best prices in the market!\n\n• Monthly accounts from $2-5\n• Annual accounts from $8-20\n• Lifetime accounts from $15-40\n\n🔥 Check current prices on each product page. Prices vary by service and duration.',
        buttons: ['View products', 'Open Discord']
      },

      // === WARRANTY & TERMS ===
      'warranty': {
        message: '🛡️ **Our Warranty:**\n\n• Free replacement if the account stops working\n• 24/7 support on Discord\n• Quick ticket response\n\n⚠️ Warranty doesn\'t cover if you change the password or account data.',
        buttons: ['View terms', 'Open Discord']
      },
      'refund': {
        message: '💰 **Refund Policy:**\n\n• We offer **FREE replacement** if the account stops working\n• Refunds are evaluated case-by-case\n• You must contact us within 24 hours\n\n📩 Open a Discord ticket for refund requests.',
        buttons: ['View terms', 'Open Discord']
      },
      'is it legal': {
        message: '📋 **About Legality:**\n\nWe sell access to legitimate premium accounts. These are accounts acquired through various promotional methods and reseller programs.\n\n✅ The accounts are real and functional\n🔒 Your purchases are confidential\n📩 For more details, check our terms.',
        buttons: ['View terms', 'Contact support']
      },

      // === ACCOUNT TYPES ===
      'shared or private': {
        message: '🔐 **Account Types:**\n\n• **FA (Full Access):** Private account, only you use it. You can manage profile but NOT change email/password.\n\n• **Shared:** Multiple users share the account. You get your own profile.\n\n• **Screen/Slot:** Your own screen on a shared account.\n\n📄 Check the product page for the exact type you purchased.',
        buttons: ['View products', 'Open Discord']
      },
      'what is fa': {
        message: '🔓 **FA = Full Access**\n\nThis means you have FULL access to the account:\n\n• Complete control of all features\n• No other users on your account\n• Can create/delete profiles\n• Premium features included\n\n⚠️ Just don\'t change the email or password.',
        buttons: ['View products', 'Open Discord']
      },
      'what is slot': {
        message: '📺 **What is a Slot/Screen?**\n\nA slot is your own screen/profile on a shared account:\n\n• You get 1 dedicated profile\n• Other users have their own profiles\n• You can watch simultaneously\n• Same premium features\n\n✅ More affordable option with same quality!',
        buttons: ['View products', 'Open Discord']
      },
      'can change password': {
        message: '⚠️ **Important about passwords:**\n\n**NO, you cannot change the password.** This will void your warranty and may deactivate the account.\n\nYou CAN:\n• Add/edit profiles\n• Change profile PIN\n• Modify preferences\n\nYou CANNOT:\n• Change email/password\n• Enable 2FA\n• Link external accounts',
        buttons: ['View terms', 'Open Discord']
      },
      'how long last': {
        message: '⏰ **Account Duration:**\n\nDepends on what you purchased:\n\n• **1 Month:** 30 days guaranteed\n• **3 Months:** 90 days guaranteed\n• **1 Year:** 365 days guaranteed\n• **Lifetime:** As long as the account exists\n\n🛡️ If it stops working within warranty, we replace it FREE.',
        buttons: ['View products', 'View terms']
      },

      // === DEVICES & USAGE ===
      'how many devices': {
        message: '📱 **Device Limits:**\n\nDepends on the service and plan:\n\n• **Netflix:** 1-4 screens depending on plan\n• **Spotify:** 1 device at a time (Premium)\n• **Disney+:** Up to 4 devices\n• **HBO Max:** 3 simultaneous streams\n\n📄 Check each product page for specific limits.',
        buttons: ['View products', 'Contact support']
      },
      'works on tv': {
        message: '📺 **Smart TV Compatible:**\n\nYes! Works on all devices:\n\n• Smart TV (Samsung, LG, Sony, etc.)\n• Chromecast / Fire Stick\n• Apple TV\n• Gaming consoles (PS4/5, Xbox)\n• Phone/Tablet/PC\n\n✅ Just log in with the credentials we provide.',
        buttons: ['View products', 'Open Discord']
      },
      'need vpn': {
        message: '🌐 **VPN Required?**\n\nMost accounts work worldwide without VPN!\n\n⚠️ Some exceptions:\n• Regional accounts may need VPN\n• Check product description for details\n\n💡 If VPN is needed, we recommend NordVPN or ExpressVPN.',
        buttons: ['View products', 'Contact support']
      },
      'which country': {
        message: '🌍 **Country/Region:**\n\nMost of our accounts are:\n\n• **Global/International** - Work everywhere\n• **US accounts** - Work worldwide\n• **EU accounts** - Work in Europe\n\n📄 Check product description for region info. Most services work globally!',
        buttons: ['View products', 'Contact support']
      },
      'download offline': {
        message: '📥 **Offline Downloads:**\n\nDepends on account type:\n\n• **FA (Full Access):** Usually YES ✅\n• **Shared accounts:** Depends on the service\n• **Slots:** Limited downloads\n\n📄 Check product description for download capabilities.',
        buttons: ['View products', 'Open Discord']
      },
      'video quality': {
        message: '🎬 **Video Quality:**\n\nMost of our accounts include:\n\n• **4K Ultra HD** (where available)\n• **HDR/Dolby Vision** support\n• **Dolby Atmos** audio\n\n📺 Quality depends on your internet speed and device capabilities.',
        buttons: ['View products', 'Contact support']
      },

      // === PROFILES ===
      'create profiles': {
        message: '👤 **Creating Profiles:**\n\n• **FA accounts:** Yes, create unlimited profiles\n• **Shared:** Use assigned profile only\n• **Slots:** 1 profile included\n\n⚠️ Don\'t delete other users\' profiles on shared accounts!',
        buttons: ['View products', 'Open Discord']
      },
      'profile pin': {
        message: '🔒 **Profile PIN:**\n\nYes! You can set a PIN on your profile:\n\n• Go to profile settings\n• Set a 4-digit PIN\n• This protects YOUR profile\n\n✅ Recommended for shared accounts to prevent others from accessing your profile.',
        buttons: ['View products', 'Contact support']
      },

      // === GENERAL ===
      'how it works': {
        message: '🚀 **How it works:**\n\n1. Choose your product\n2. Add to cart\n3. Pay (card, PayPal, crypto)\n4. **Instant delivery!**\n\nYou receive login credentials immediately after payment. Start using your account in seconds!',
        buttons: ['View products', 'View my orders']
      },
      'contact support': {
        message: '📞 **Ways to contact us:**\n\n• **Discord** (recommended): Fastest response\n• **Discord tickets**: For specific issues\n\n💬 Our team is available 24/7 to help you.',
        buttons: ['Open Discord', 'View FAQ']
      },
      'why so cheap': {
        message: '💵 **Why Our Prices Are Low:**\n\nWe can offer great prices because:\n\n• Bulk purchasing agreements\n• Promotional account sourcing\n• Low overhead costs\n• Direct-to-customer sales\n\n✅ Same premium features, better prices!',
        buttons: ['View products', 'View terms']
      },
      'is it safe': {
        message: '🔒 **Is It Safe?**\n\nYes! Your purchase is safe:\n\n• Secure payment processing\n• No personal data stored\n• Encrypted transactions\n• Thousands of happy customers\n\n⭐ Check our reviews and join our Discord community!',
        buttons: ['Open Discord', 'View terms']
      },
      'renewal': {
        message: '🔄 **Account Renewal:**\n\nWhen your account expires:\n\n1. Simply purchase a new one\n2. Instant delivery as always\n3. Continue enjoying premium\n\n💡 **Tip:** Buy longer duration for better value!',
        buttons: ['View products', 'Open Discord']
      },
      'upgrade account': {
        message: '⬆️ **Upgrading Account:**\n\nTo upgrade (e.g., 1 month to 1 year):\n\n1. Purchase the duration you want\n2. We send new credentials\n3. Start using immediately\n\n📩 Contact support if you want to credit existing time.',
        buttons: ['View products', 'Open Discord']
      },
      'reseller': {
        message: '🤝 **Reseller Program:**\n\nInterested in reselling?\n\n• Bulk discounts available\n• API access for automation\n• White-label options\n\n📩 Contact us on Discord for reseller pricing!',
        buttons: ['Open Discord', 'Contact support']
      },
      'affiliate': {
        message: '💸 **Affiliate Program:**\n\nEarn money referring customers!\n\n• Earn commission on sales\n• Unique referral link\n• Monthly payouts\n\n📩 Join our Discord to learn more about the affiliate program!',
        buttons: ['Open Discord', 'Contact support']
      },
      'available services': {
        message: '🎬 **Available Services:**\n\n• **Streaming:** Netflix, Disney+, HBO Max, Prime, Crunchyroll\n• **Music:** Spotify, YouTube Premium\n• **Gaming:** Discord Nitro, Xbox Game Pass, Minecraft\n• **Software:** ChatGPT Pro, CapCut, NordVPN\n• **And more!**\n\n🛒 Check our full catalog!',
        buttons: ['View products', 'Open Discord']
      },
      'out of stock': {
        message: '📦 **Out of Stock:**\n\nIf a product shows "Out of Stock":\n\n• We restock frequently (check back soon!)\n• Join Discord for restock notifications\n• Some products restock daily\n\n🔔 Enable notifications to get alerted!',
        buttons: ['Open Discord', 'View products']
      },
      'bulk order': {
        message: '📦 **Bulk Orders:**\n\nNeed multiple accounts?\n\n• Discounts for 5+ accounts\n• Better rates for 10+ accounts\n• Special pricing for 50+\n\n📩 Contact us on Discord for bulk pricing!',
        buttons: ['Open Discord', 'Contact support']
      },
      'greeting': {
        message: '👋 Hey there! Welcome to **Plug Market**!\n\nI\'m here to help you. What would you like to know?\n\n• Account issues?\n• Payment questions?\n• Product info?\n\nJust ask! 😊',
        buttons: ['View products', 'Open Discord']
      },
      'thanks': {
        message: '😊 You\'re welcome! Happy to help!\n\nIf you have any other questions, feel free to ask.\n\n⭐ Enjoy your premium account!',
        buttons: ['View products', 'Open Discord']
      },
      'where credentials': {
        message: '🔑 **Where to find your credentials:**\n\n1. Go to **My Dashboard** (top menu)\n2. Enter your purchase email\n3. Your credentials appear there directly!\n\n📧 They were also sent to your email after purchase. Check SPAM if not found.',
        buttons: ['My dashboard', 'Open Discord']
      },
      'how to login': {
        message: '🔓 **How to log in:**\n\n1. Go to the official app/website of the service\n2. Click "Log in" or "Sign in"\n3. Enter the email and password we sent you\n4. **Copy & paste** for best results!\n\n⚠️ Don\'t use "Sign in with Google/Facebook"',
        buttons: ['My dashboard', 'Open Discord']
      },
      'kicked out': {
        message: '😰 **Getting kicked out?**\n\nIf you\'re being logged out frequently:\n\n1. **Shared accounts**: This can happen, just log in again\n2. **FA accounts**: Open a ticket, this shouldn\'t happen\n3. Check you\'re not on too many devices\n\n📩 If it persists, contact us on Discord.',
        buttons: ['Open Discord', 'View my orders']
      },
      'session expired': {
        message: '⏰ **Session Expired?**\n\nThis is normal! Just:\n\n1. Log in again with your credentials\n2. Don\'t worry, your account still works\n3. For FA accounts, you have full control\n\n🔑 Find your credentials in the dashboard.',
        buttons: ['My dashboard', 'Open Discord']
      },

      'default': {
        message: '🤖 I\'m not sure how to help with that specifically.\n\n📩 I recommend **opening a ticket on Discord** where our team can assist you personally.\n\nIs there anything else I can help with?',
        buttons: ['Open Discord', 'View FAQ', 'View my orders']
      },
      'welcome': '👋 Hi! I\'m the **Plug Market** assistant.\n\nHow can I help you today? Select an option or type your question.'
    },
    es: {
      // === PROBLEMAS DE CUENTA ===
      'cuenta no funciona': {
        message: '😔 Lamento que tengas problemas con tu cuenta. Para solucionarlo rápidamente:\n\n1. Verifica que estés usando las credenciales exactas que te enviamos\n2. Intenta cerrar sesión en todos los dispositivos\n3. Espera 5 minutos y vuelve a intentar\n\n📩 Si el problema persiste, **abre un ticket en Discord** con tu número de pedido y te ayudaremos de inmediato.',
        buttons: ['Abrir Discord', 'Ver mis pedidos']
      },
      'cambiaron contrasena': {
        message: '🔄 **Si cambiaron la contraseña:**\n\nEsto a veces pasa. ¡No te preocupes!\n\n1. Abre un ticket en Discord inmediatamente\n2. Proporciona tu número de pedido\n3. Te enviaremos nuevas credenciales\n\n⚡ Los reemplazos suelen hacerse en 1-2 horas.',
        buttons: ['Abrir Discord', 'Ver mis pedidos']
      },
      'problema 2fa': {
        message: '🔐 **Problemas con 2FA/Verificación:**\n\nSi la cuenta pide 2FA o código de verificación:\n\n1. **NO** intentes configurar tu propio 2FA\n2. Abre un ticket en Discord inmediatamente\n3. Te daremos la verificación o reemplazamos la cuenta\n\n⏱️ Esto se resuelve normalmente en 30 minutos.',
        buttons: ['Abrir Discord', 'Ver mis pedidos']
      },
      'cuenta baneada': {
        message: '🚫 **Si la Cuenta Fue Baneada:**\n\nOfrecemos reemplazo si:\n• La cuenta fue baneada dentro del período de garantía\n• No violaste términos de servicio\n• No cambiaste contraseña/email\n\n📩 Abre un ticket en Discord con prueba del baneo y lo reemplazamos.',
        buttons: ['Abrir Discord', 'Ver términos']
      },
      'credenciales incorrectas': {
        message: '❌ **¿Credenciales Incorrectas?**\n\nIntenta estos pasos:\n\n1. **Copia y pega** - no escribas manualmente\n2. Revisa si hay **espacios** antes/después\n3. Algunas contraseñas tienen caracteres especiales: | \\ / @ #\n4. Asegúrate de que BLOQ MAYÚS esté desactivado\n\n📩 Si sigue sin funcionar, abre un ticket con tu número de pedido.',
        buttons: ['Abrir Discord', 'Ver mis pedidos']
      },

      // === PEDIDOS ===
      'donde esta mi pedido': {
        message: '📦 Para ver tu pedido:\n\n1. Ve a "Mis Pedidos" en el menú\n2. Busca con tu email de compra\n3. Las credenciales aparecen ahí directamente\n\n⏱️ Los pedidos se entregan **instantáneamente** después del pago. Si no lo ves, verifica el email que usaste.',
        buttons: ['Ver mis pedidos', 'Contactar soporte']
      },
      'entrega instantanea': {
        message: '⚡ **Entrega Instantánea:**\n\n¡Sí! Todos los pedidos se entregan **inmediatamente** después del pago:\n\n• Las credenciales aparecen en pantalla\n• También se envían a tu email\n• Disponible en "Mis Pedidos"\n\n📱 ¡Sin esperas - comienza a usar tu cuenta en segundos!',
        buttons: ['Ver productos', 'Ver mis pedidos']
      },
      'no llego email': {
        message: '📧 **¿No Llegó el Email?**\n\n1. Revisa tu carpeta de **SPAM/Correo no deseado**\n2. Busca "Plug Market" o "plugmarket"\n3. Verifica que usaste el email correcto\n\n💡 Siempre puedes ver las credenciales en "Mis Pedidos" sin email.\n\n📩 Si aún falta, contacta soporte.',
        buttons: ['Ver mis pedidos', 'Abrir Discord']
      },

      // === PAGOS ===
      'metodos de pago': {
        message: '💳 Aceptamos varios métodos de pago:\n\n• **Tarjeta de crédito/débito** (Visa, Mastercard, Amex)\n• **PayPal**\n• **Criptomonedas** (Bitcoin, ETH, USDT, etc.)\n• **Saldo de cuenta** (si tienes balance)\n\nTodos los pagos son 100% seguros y encriptados.',
        buttons: ['Ver productos', 'Contactar soporte']
      },
      'pago fallido': {
        message: '❌ **¿Pago Fallido?**\n\nEsto puede pasar por:\n\n• Tarjeta rechazada por el banco (prueba otra tarjeta)\n• Fondos insuficientes\n• 3D Secure no completado\n• VPN/Proxy bloqueando\n\n💡 **Prueba**: Desactiva VPN, usa otro navegador, o prueba PayPal/crypto.',
        buttons: ['Contactar soporte', 'Ver productos']
      },
      'pago crypto': {
        message: '₿ **Pagos con Crypto:**\n\nAceptamos:\n• Bitcoin (BTC)\n• Ethereum (ETH)\n• USDT (TRC20 y ERC20)\n• Litecoin (LTC)\n• ¡Y más!\n\n⏱️ Entrega después de 1 confirmación de red.\n💡 Algunas cryptos son más rápidas (LTC, USDT recomendados).',
        buttons: ['Ver productos', 'Contactar soporte']
      },
      'codigo descuento': {
        message: '🎁 **Códigos de Descuento:**\n\nPara usar un código de descuento:\n\n1. Añade productos al carrito\n2. Ingresa el código en el campo de descuento\n3. Haz clic en "Aplicar"\n\n📢 ¡Síguenos en Discord para códigos promocionales exclusivos y ofertas flash!',
        buttons: ['Abrir Discord', 'Ver productos']
      },
      'precios': {
        message: '💰 **Nuestros Precios:**\n\n¡Ofrecemos los mejores precios del mercado!\n\n• Cuentas mensuales desde $2-5\n• Cuentas anuales desde $8-20\n• Cuentas lifetime desde $15-40\n\n🔥 Consulta precios actuales en cada página de producto.',
        buttons: ['Ver productos', 'Abrir Discord']
      },

      // === GARANTÍA Y TÉRMINOS ===
      'garantia': {
        message: '🛡️ **Nuestra Garantía:**\n\n• Reemplazo gratuito si la cuenta deja de funcionar\n• Soporte 24/7 en Discord\n• Respuesta rápida a tickets\n\n⚠️ La garantía no cubre si cambias la contraseña o datos de la cuenta.',
        buttons: ['Ver términos', 'Abrir Discord']
      },
      'reembolso': {
        message: '💰 **Política de Reembolso:**\n\n• Ofrecemos **reemplazo GRATIS** si la cuenta deja de funcionar\n• Los reembolsos se evalúan caso por caso\n• Debes contactarnos dentro de 24 horas\n\n📩 Abre un ticket en Discord para solicitar reembolso.',
        buttons: ['Ver términos', 'Abrir Discord']
      },
      'es legal': {
        message: '📋 **Sobre la Legalidad:**\n\nVendemos acceso a cuentas premium legítimas. Son cuentas adquiridas a través de varios métodos promocionales y programas de revendedores.\n\n✅ Las cuentas son reales y funcionales\n🔒 Tus compras son confidenciales\n📩 Para más detalles, consulta nuestros términos.',
        buttons: ['Ver términos', 'Contactar soporte']
      },

      // === TIPOS DE CUENTA ===
      'compartida o privada': {
        message: '🔐 **Tipos de Cuenta:**\n\n• **FA (Full Access):** Cuenta privada, solo tú la usas. Puedes gestionar perfiles pero NO cambiar email/contraseña.\n\n• **Compartida:** Varios usuarios comparten la cuenta. Tienes tu propio perfil.\n\n• **Pantalla/Slot:** Tu propia pantalla en una cuenta compartida.\n\n📄 Revisa la página del producto para ver el tipo exacto.',
        buttons: ['Ver productos', 'Abrir Discord']
      },
      'que es fa': {
        message: '🔓 **FA = Full Access (Acceso Completo)**\n\nEsto significa que tienes acceso TOTAL a la cuenta:\n\n• Control completo de todas las funciones\n• Ningún otro usuario en tu cuenta\n• Puedes crear/eliminar perfiles\n• Funciones premium incluidas\n\n⚠️ Solo no cambies el email ni la contraseña.',
        buttons: ['Ver productos', 'Abrir Discord']
      },
      'que es slot': {
        message: '📺 **¿Qué es un Slot/Pantalla?**\n\nUn slot es tu propia pantalla/perfil en una cuenta compartida:\n\n• Tienes 1 perfil dedicado\n• Otros usuarios tienen sus propios perfiles\n• Puedes ver simultáneamente\n• Mismas funciones premium\n\n✅ ¡Opción más económica con la misma calidad!',
        buttons: ['Ver productos', 'Abrir Discord']
      },
      'cambiar contrasena': {
        message: '⚠️ **Importante sobre contraseñas:**\n\n**NO, no puedes cambiar la contraseña.** Esto anulará tu garantía y puede desactivar la cuenta.\n\nPuedes:\n• Añadir/editar perfiles\n• Cambiar PIN del perfil\n• Modificar preferencias\n\nNO puedes:\n• Cambiar email/contraseña\n• Activar 2FA\n• Vincular cuentas externas',
        buttons: ['Ver términos', 'Abrir Discord']
      },
      'cuanto dura': {
        message: '⏰ **Duración de la Cuenta:**\n\nDepende de lo que compraste:\n\n• **1 Mes:** 30 días garantizados\n• **3 Meses:** 90 días garantizados\n• **1 Año:** 365 días garantizados\n• **Lifetime:** Mientras exista la cuenta\n\n🛡️ Si deja de funcionar dentro de la garantía, lo reemplazamos GRATIS.',
        buttons: ['Ver productos', 'Ver términos']
      },

      // === DISPOSITIVOS Y USO ===
      'cuantos dispositivos': {
        message: '📱 **Límites de Dispositivos:**\n\nDepende del servicio y plan:\n\n• **Netflix:** 1-4 pantallas según el plan\n• **Spotify:** 1 dispositivo a la vez (Premium)\n• **Disney+:** Hasta 4 dispositivos\n• **HBO Max:** 3 streams simultáneos\n\n📄 Consulta cada página de producto para límites específicos.',
        buttons: ['Ver productos', 'Contactar soporte']
      },
      'funciona en tv': {
        message: '📺 **Compatible con Smart TV:**\n\n¡Sí! Funciona en todos los dispositivos:\n\n• Smart TV (Samsung, LG, Sony, etc.)\n• Chromecast / Fire Stick\n• Apple TV\n• Consolas de juegos (PS4/5, Xbox)\n• Teléfono/Tablet/PC\n\n✅ Solo inicia sesión con las credenciales que te damos.',
        buttons: ['Ver productos', 'Abrir Discord']
      },
      'necesito vpn': {
        message: '🌐 **¿Necesito VPN?**\n\n¡La mayoría de cuentas funcionan en todo el mundo sin VPN!\n\n⚠️ Algunas excepciones:\n• Cuentas regionales pueden necesitar VPN\n• Revisa la descripción del producto\n\n💡 Si necesitas VPN, recomendamos NordVPN o ExpressVPN.',
        buttons: ['Ver productos', 'Contactar soporte']
      },
      'que pais': {
        message: '🌍 **País/Región:**\n\nLa mayoría de nuestras cuentas son:\n\n• **Globales/Internacionales** - Funcionan en todas partes\n• **Cuentas US** - Funcionan mundial\n• **Cuentas EU** - Funcionan en Europa\n\n📄 Revisa la descripción del producto para info de región. ¡La mayoría funcionan globalmente!',
        buttons: ['Ver productos', 'Contactar soporte']
      },
      'descargar offline': {
        message: '📥 **Descargas Offline:**\n\nDepende del tipo de cuenta:\n\n• **FA (Full Access):** Normalmente SÍ ✅\n• **Cuentas compartidas:** Depende del servicio\n• **Slots:** Descargas limitadas\n\n📄 Revisa la descripción del producto para capacidades de descarga.',
        buttons: ['Ver productos', 'Abrir Discord']
      },
      'calidad video': {
        message: '🎬 **Calidad de Video:**\n\nLa mayoría de nuestras cuentas incluyen:\n\n• **4K Ultra HD** (donde disponible)\n• Soporte **HDR/Dolby Vision**\n• Audio **Dolby Atmos**\n\n📺 La calidad depende de tu velocidad de internet y capacidades del dispositivo.',
        buttons: ['Ver productos', 'Contactar soporte']
      },

      // === PERFILES ===
      'crear perfiles': {
        message: '👤 **Crear Perfiles:**\n\n• **Cuentas FA:** Sí, crea perfiles ilimitados\n• **Compartidas:** Usa solo el perfil asignado\n• **Slots:** 1 perfil incluido\n\n⚠️ ¡No borres los perfiles de otros usuarios en cuentas compartidas!',
        buttons: ['Ver productos', 'Abrir Discord']
      },
      'pin perfil': {
        message: '🔒 **PIN de Perfil:**\n\n¡Sí! Puedes poner un PIN en tu perfil:\n\n• Ve a configuración del perfil\n• Establece un PIN de 4 dígitos\n• Esto protege TU perfil\n\n✅ Recomendado para cuentas compartidas para evitar que otros accedan a tu perfil.',
        buttons: ['Ver productos', 'Contactar soporte']
      },

      // === GENERAL ===
      'como funciona': {
        message: '🚀 **Cómo funciona:**\n\n1. Elige tu producto\n2. Añade al carrito\n3. Paga (tarjeta, PayPal, crypto)\n4. **¡Entrega instantánea!**\n\nRecibes las credenciales inmediatamente después del pago. ¡Empieza a usar tu cuenta en segundos!',
        buttons: ['Ver productos', 'Ver mis pedidos']
      },
      'contactar soporte': {
        message: '📞 **Formas de contactarnos:**\n\n• **Discord** (recomendado): Respuesta más rápida\n• **Tickets en Discord**: Para problemas específicos\n\n💬 Nuestro equipo está disponible 24/7 para ayudarte.',
        buttons: ['Abrir Discord', 'Ver FAQ']
      },
      'por que tan barato': {
        message: '💵 **Por Qué Nuestros Precios Son Bajos:**\n\nPodemos ofrecer buenos precios porque:\n\n• Acuerdos de compra al por mayor\n• Fuentes de cuentas promocionales\n• Bajos costos operativos\n• Ventas directas al cliente\n\n✅ ¡Mismas funciones premium, mejores precios!',
        buttons: ['Ver productos', 'Ver términos']
      },
      'es seguro': {
        message: '🔒 **¿Es Seguro?**\n\n¡Sí! Tu compra es segura:\n\n• Procesamiento de pago seguro\n• No guardamos datos personales\n• Transacciones encriptadas\n• Miles de clientes satisfechos\n\n⭐ ¡Revisa nuestras reseñas y únete a nuestra comunidad en Discord!',
        buttons: ['Abrir Discord', 'Ver términos']
      },
      'renovar': {
        message: '🔄 **Renovar Cuenta:**\n\nCuando tu cuenta expire:\n\n1. Simplemente compra una nueva\n2. Entrega instantánea como siempre\n3. Continúa disfrutando premium\n\n💡 **Tip:** ¡Compra mayor duración para mejor valor!',
        buttons: ['Ver productos', 'Abrir Discord']
      },
      'mejorar cuenta': {
        message: '⬆️ **Mejorar Cuenta:**\n\nPara mejorar (ej: 1 mes a 1 año):\n\n1. Compra la duración que quieras\n2. Te enviamos nuevas credenciales\n3. Empieza a usar inmediatamente\n\n📩 Contacta soporte si quieres acreditar tiempo existente.',
        buttons: ['Ver productos', 'Abrir Discord']
      },
      'revendedor': {
        message: '🤝 **Programa de Revendedores:**\n\n¿Interesado en revender?\n\n• Descuentos por volumen disponibles\n• Acceso API para automatización\n• Opciones de marca blanca\n\n📩 ¡Contáctanos en Discord para precios de revendedor!',
        buttons: ['Abrir Discord', 'Contactar soporte']
      },
      'afiliados': {
        message: '💸 **Programa de Afiliados:**\n\n¡Gana dinero refiriendo clientes!\n\n• Gana comisión por ventas\n• Link de referido único\n• Pagos mensuales\n\n📩 ¡Únete a nuestro Discord para saber más del programa de afiliados!',
        buttons: ['Abrir Discord', 'Contactar soporte']
      },
      'servicios disponibles': {
        message: '🎬 **Servicios Disponibles:**\n\n• **Streaming:** Netflix, Disney+, HBO Max, Prime, Crunchyroll\n• **Música:** Spotify, YouTube Premium\n• **Gaming:** Discord Nitro, Xbox Game Pass, Minecraft\n• **Software:** ChatGPT Pro, CapCut, NordVPN\n• **¡Y más!**\n\n🛒 ¡Revisa nuestro catálogo completo!',
        buttons: ['Ver productos', 'Abrir Discord']
      },
      'sin stock': {
        message: '📦 **Sin Stock:**\n\nSi un producto muestra "Sin Stock":\n\n• Reponemos frecuentemente (¡vuelve pronto!)\n• Únete a Discord para notificaciones de restock\n• Algunos productos se reponen diariamente\n\n🔔 ¡Activa notificaciones para recibir alertas!',
        buttons: ['Abrir Discord', 'Ver productos']
      },
      'compra masiva': {
        message: '📦 **Compras al Por Mayor:**\n\n¿Necesitas múltiples cuentas?\n\n• Descuentos para 5+ cuentas\n• Mejores precios para 10+ cuentas\n• Precios especiales para 50+\n\n📩 ¡Contáctanos en Discord para precios por volumen!',
        buttons: ['Abrir Discord', 'Contactar soporte']
      },
      'saludo': {
        message: '👋 ¡Hola! Bienvenido a **Plug Market**!\n\nEstoy aquí para ayudarte. ¿Qué te gustaría saber?\n\n• ¿Problemas con cuenta?\n• ¿Preguntas de pago?\n• ¿Info de productos?\n\n¡Solo pregunta! 😊',
        buttons: ['Ver productos', 'Abrir Discord']
      },
      'gracias': {
        message: '😊 ¡De nada! ¡Encantado de ayudar!\n\nSi tienes más preguntas, no dudes en preguntar.\n\n⭐ ¡Disfruta tu cuenta premium!',
        buttons: ['Ver productos', 'Abrir Discord']
      },
      'donde credenciales': {
        message: '🔑 **Dónde encontrar tus credenciales:**\n\n1. Ve a **Mi Dashboard** (menú superior)\n2. Ingresa tu email de compra\n3. ¡Tus credenciales aparecen ahí directamente!\n\n📧 También fueron enviadas a tu email después de la compra. Revisa SPAM si no las encuentras.',
        buttons: ['Mi dashboard', 'Abrir Discord']
      },
      'como iniciar sesion': {
        message: '🔓 **Cómo iniciar sesión:**\n\n1. Ve a la app/web oficial del servicio\n2. Haz clic en "Iniciar sesión"\n3. Ingresa el email y contraseña que te enviamos\n4. **¡Copia y pega** para mejores resultados!\n\n⚠️ No uses "Iniciar con Google/Facebook"',
        buttons: ['Mi dashboard', 'Abrir Discord']
      },
      'me desconecta': {
        message: '😰 **¿Te desconecta?**\n\nSi te cierra sesión frecuentemente:\n\n1. **Cuentas compartidas**: Puede pasar, solo vuelve a entrar\n2. **Cuentas FA**: Abre ticket, esto no debería pasar\n3. Verifica que no estés en muchos dispositivos\n\n📩 Si persiste, contáctanos en Discord.',
        buttons: ['Abrir Discord', 'Ver mis pedidos']
      },
      'sesion expirada': {
        message: '⏰ **¿Sesión Expirada?**\n\n¡Es normal! Solo:\n\n1. Vuelve a iniciar sesión con tus credenciales\n2. No te preocupes, tu cuenta sigue funcionando\n3. Para cuentas FA, tienes control total\n\n🔑 Encuentra tus credenciales en el dashboard.',
        buttons: ['Mi dashboard', 'Abrir Discord']
      },

      'default': {
        message: '🤖 No estoy seguro de cómo ayudarte con eso específicamente.\n\n📩 Te recomiendo **abrir un ticket en Discord** donde nuestro equipo podrá asistirte personalmente.\n\n¿Hay algo más en lo que pueda ayudarte?',
        buttons: ['Abrir Discord', 'Ver FAQ', 'Ver mis pedidos']
      },
      'welcome': '👋 ¡Hola! Soy el asistente de **Plug Market**.\n\n¿En qué puedo ayudarte hoy? Selecciona una opción o escribe tu pregunta.'
    }
  };

  // Patrones de detección de intención (regex patterns) - ORDENADOS POR PRIORIDAD
  const intentPatterns = {
    en: [
      // HIGH PRIORITY - Specific questions first
      { pattern: /where\s*(are|is|can\s*i\s*(find|see|get))\s*(my\s*)?(credentials?|login|password|email\s*and\s*pass)/i, response: 'where credentials' },
      { pattern: /how\s*(do\s*i|to|can\s*i)?\s*(log\s*in|login|sign\s*in|enter|access)/i, response: 'how to login' },
      { pattern: /(kick|log)\s*(me\s*)?(out|off)|disconnect|keeps?\s*(logging|kicking)\s*(me\s*)?out/i, response: 'kicked out' },
      { pattern: /session\s*(expired|ended|timeout)|expired\s*session/i, response: 'session expired' },
      
      // Account type questions - BEFORE generic account issues
      { pattern: /(is\s*(my|the|this)\s*(account\s*)?)?private|shared|only\s*(me|mine)|my\s*own|exclusive|personal|just\s*(for\s*)?me|solo\s*yo/i, response: 'shared or private' },
      { pattern: /what\s*(is|does)\s*fa\b|fa\s*(mean|account)|full\s*access|que\s*(es|significa)\s*fa/i, response: 'what is fa' },
      { pattern: /what\s*(is|does)\s*(a\s*)?slot|slot\s*(mean)?|screen\s*(mean)?/i, response: 'what is slot' },
      
      // Password issues
      { pattern: /can\s*i\s*change|change\s*(the\s*)?(password|pass|email)|modify\s*(password|credentials)/i, response: 'can change password' },
      { pattern: /password\s*(was\s*)?(changed|different|new)|someone\s*changed|they\s*changed/i, response: 'password changed' },
      
      // Auth issues
      { pattern: /2fa|two\s*factor|verification\s*(code|required)|authenticator|otp/i, response: '2fa problem' },
      { pattern: /banned|suspended|terminated|blocked|deactivated/i, response: 'account banned' },
      { pattern: /wrong\s*(password|credentials|login)|incorrect|doesn'?t\s*match|invalid/i, response: 'wrong credentials' },
      
      // Generic account issues - LOWER PRIORITY
      { pattern: /(not|doesn'?t?|won'?t?|can'?t?)\s*(work|login|enter|access|connect)|problem|issue|error|no\s*(funciona|entra|sirve)/i, response: 'account not working' },
      
      // Orders
      { pattern: /where\s*(is)?\s*(my)?\s*order|track|didn'?t\s*receive|no\s*email|find\s*order/i, response: 'where is my order' },
      { pattern: /instant|immediate|how\s*fast|delivery\s*time|when\s*(do\s*)?i\s*(get|receive)/i, response: 'instant delivery' },
      { pattern: /email\s*(not|didn'?t)\s*(arrive|come|receive)|no\s*email|check\s*spam/i, response: 'didnt receive email' },
      
      // Payments
      { pattern: /pay(ment)?s?\s*(method|option)?|how\s*(can\s*i\s*|to\s*)?pay|accept|card|crypto|paypal|bitcoin/i, response: 'payment methods' },
      { pattern: /payment\s*(failed|declined|error|problem)|card\s*(declined|rejected)|transaction\s*fail/i, response: 'payment failed' },
      { pattern: /crypto(currency)?|bitcoin|btc|ethereum|eth|usdt|litecoin|ltc/i, response: 'crypto payment' },
      { pattern: /discount|coupon|promo(tion)?\s*code|voucher/i, response: 'discount code' },
      { pattern: /price|cost|how\s*much|cheap|expensive|pricing/i, response: 'prices' },
      
      // Duration & Warranty
      { pattern: /how\s*long|duration|expire|last|valid\s*(for)?|warranty\s*(period|time)|days|months/i, response: 'how long last' },
      { pattern: /warranty|guarantee|replace(ment)?|broken|stopped\s*working/i, response: 'warranty' },
      { pattern: /refund|money\s*back|return|cancel|chargeback/i, response: 'refund' },
      
      // Devices & Usage
      { pattern: /how\s*many\s*(device|screen)|device\s*(limit)?|simultaneous|at\s*(the\s*)?same\s*time/i, response: 'how many devices' },
      { pattern: /smart\s*tv|television|tv\s*(work)?|chromecast|fire\s*stick|roku|apple\s*tv|console/i, response: 'works on tv' },
      { pattern: /vpn|geo.?block|region\s*lock|country\s*restrict/i, response: 'need vpn' },
      { pattern: /which\s*country|what\s*region|work\s*(in\s*)?my\s*country|international|global/i, response: 'which country' },
      { pattern: /download|offline|save\s*(for\s*)?later|watch\s*offline/i, response: 'download offline' },
      { pattern: /quality|4k|hd|uhd|resolution|dolby|hdr/i, response: 'video quality' },
      
      // Profiles
      { pattern: /create\s*(a\s*)?profile|add\s*profile|new\s*profile|how\s*many\s*profile/i, response: 'create profiles' },
      { pattern: /profile\s*pin|set\s*(a\s*)?pin|lock\s*profile|protect\s*profile/i, response: 'profile pin' },
      
      // General
      { pattern: /how\s*(does\s*it\s*)?work|how\s*to\s*(buy|order|use|start)|process|steps|tutorial/i, response: 'how it works' },
      { pattern: /support|contact|help|talk\s*to|reach|discord|customer\s*service/i, response: 'contact support' },
      { pattern: /why\s*(so\s*)?cheap|low\s*price|too\s*cheap|how\s*can\s*you|affordable/i, response: 'why so cheap' },
      { pattern: /legal|safe|legit|secure|scam|trust|real|fake|fraud/i, response: 'is it safe' },
      { pattern: /renew|extend|continue|when\s*expire|buy\s*again/i, response: 'renewal' },
      { pattern: /upgrade|improve|better\s*plan|higher\s*tier/i, response: 'upgrade account' },
      { pattern: /resell|wholesale|bulk\s*sell|distributor|vendor/i, response: 'reseller' },
      { pattern: /affiliate|referral|commission|earn\s*money|partner/i, response: 'affiliate' },
      { pattern: /what\s*(do\s*you\s*)?(sell|have|offer)|available|services|products|catalog/i, response: 'available services' },
      { pattern: /out\s*of\s*stock|no\s*stock|sold\s*out|unavailable|restock/i, response: 'out of stock' },
      { pattern: /bulk|multiple|many\s*accounts|wholesale|quantity/i, response: 'bulk order' },
      { pattern: /^(hi|hello|hey|good\s*(morning|afternoon|evening)|what'?s?\s*up)/i, response: 'greeting' },
      { pattern: /(thank|thanks|thx|ty|appreciate|gracias)/i, response: 'thanks' }
    ],
    es: [
      // ALTA PRIORIDAD - Preguntas específicas primero
      { pattern: /d[oó]nde\s*(est[aá]n?|veo|encuentro|consigo|saco|miro|busco).*(credenciales?|datos?|login|contrase[nñ]a|email|usuario)/i, response: 'donde credenciales' },
      { pattern: /(ver|encontrar|buscar|conseguir|sacar|obtener)\s*(las?|mis?)?\s*(credenciales?|datos?|login|contrase[nñ]a)/i, response: 'donde credenciales' },
      { pattern: /(mis?\s*)?(credenciales?|datos?\s*(de\s*acceso)?|login|usuario\s*y\s*contrase[nñ]a)/i, response: 'donde credenciales' },
      { pattern: /como\s*(inicio|entro|accedo|hago\s*(para)?\s*(entrar|iniciar)|me\s*conecto|uso\s*(la|mi)\s*cuenta)/i, response: 'como iniciar sesion' },
      { pattern: /me\s*(desconecta|echa|saca|cierra|expulsa)|desconectando|cierra\s*sesi[oó]n/i, response: 'me desconecta' },
      { pattern: /sesi[oó]n\s*(expirad[ao]|caducad[ao]|terminad[ao])/i, response: 'sesion expirada' },
      
      // Tipo de cuenta - ANTES de problemas genéricos
      { pattern: /(mi\s*cuenta\s*(es\s*)?)?(privad[ao]|compartid[ao])|solo\s*(para\s*)?(yo|mi)|exclusiv[ao]/i, response: 'compartida o privada' },
      { pattern: /que\s*(es|significa)\s*fa\b|fa\s*(significa|quiere\s*decir)|full\s*access|acceso\s*completo/i, response: 'que es fa' },
      { pattern: /que\s*(es|significa)\s*(un\s*)?(slot|pantalla)|slot\s*(significa)?/i, response: 'que es slot' },
      
      // Problemas de contraseña
      { pattern: /puedo\s*cambiar|cambiar\s*(la\s*)?(contrase[nñ]a|clave|password|email)|modificar\s*(contrase[nñ]a|credenciales)/i, response: 'cambiar contrasena' },
      { pattern: /(contrase[nñ]a|clave)\s*(fue\s*)?(cambiad[ao]|diferente|nuev[ao])|alguien\s*cambi[oó]|cambiaron/i, response: 'cambiaron contrasena' },
      
      // Problemas de autenticación
      { pattern: /2fa|verificaci[oó]n\s*(en)?\s*(dos)?|c[oó]digo\s*(de)?\s*(verificaci[oó]n)?|autenticador|doble\s*factor/i, response: 'problema 2fa' },
      { pattern: /banead[ao]|suspendid[ao]|terminad[ao]|bloquead[ao]|desactivad[ao]/i, response: 'cuenta baneada' },
      { pattern: /(contrase[nñ]a|credenciales?)\s*(incorrecta|mal|err[oó]nea)|no\s*coincide|inv[aá]lid[ao]/i, response: 'credenciales incorrectas' },
      
      // Problemas genéricos de cuenta - MENOR PRIORIDAD  
      { pattern: /(no|sin)\s*(me\s*)?(funciona|entra|acceso|puedo|conecta|sirve|deja)|problema|error|falla|mal/i, response: 'cuenta no funciona' },
      
      // Pedidos
      { pattern: /d[oó]nde\s*(est[aá])?\s*(mi)?\s*pedido|seguimiento|no\s*(lleg[oó]|recib[ií])|encontrar\s*pedido/i, response: 'donde esta mi pedido' },
      { pattern: /instant[aá]ne[ao]|inmediat[ao]|qu[eé]\s*tan\s*r[aá]pido|tiempo\s*(de\s*)?entrega|cu[aá]ndo\s*(recibo|llega)/i, response: 'entrega instantanea' },
      { pattern: /email\s*(no|sin)\s*(lleg|recib)|no\s*(hay\s*)?email|revisar\s*spam/i, response: 'no llego email' },
      
      // Pagos
      { pattern: /pago|pagar|m[eé]todo|aceptan|tarjeta|crypto|paypal|bitcoin|c[oó]mo\s*pag/i, response: 'metodos de pago' },
      { pattern: /pago\s*(fall[oó]|rechazad|error|problema)|tarjeta\s*(rechazad|declinad)/i, response: 'pago fallido' },
      { pattern: /crypto|bitcoin|btc|ethereum|eth|usdt|litecoin/i, response: 'pago crypto' },
      { pattern: /descuento|cup[oó]n|c[oó]digo\s*promo|promoci[oó]n/i, response: 'codigo descuento' },
      { pattern: /precio|cuesta|cu[aá]nto|barat[ao]|car[ao]/i, response: 'precios' },
      
      // Duración y Garantía
      { pattern: /cu[aá]nto\s*(dura|tiempo)|duraci[oó]n|expira|caduca|v[aá]lid[ao]|d[ií]as|meses/i, response: 'cuanto dura' },
      { pattern: /garant[ií]a|reemplazo|sustituci[oó]n|dej[oó]\s*de\s*funcionar/i, response: 'garantia' },
      { pattern: /reembolso|devoluci[oó]n|devolver|cancelar|contracargo/i, response: 'reembolso' },
      
      // Dispositivos y Uso
      { pattern: /cu[aá]ntos?\s*(dispositivo|pantalla)|l[ií]mite|simult[aá]neo|al\s*mismo\s*tiempo/i, response: 'cuantos dispositivos' },
      { pattern: /smart\s*tv|televisi[oó]n|tele|chromecast|fire\s*stick|roku|apple\s*tv|consola/i, response: 'funciona en tv' },
      { pattern: /vpn|geo.?bloque|restricci[oó]n\s*regional/i, response: 'necesito vpn' },
      { pattern: /qu[eé]\s*pa[ií]s|qu[eé]\s*regi[oó]n|funciona\s*(en\s*)?mi\s*pa[ií]s|internacional|global/i, response: 'que pais' },
      { pattern: /descargar|offline|sin\s*conexi[oó]n|guardar/i, response: 'descargar offline' },
      { pattern: /calidad|4k|hd|uhd|resoluci[oó]n|dolby|hdr/i, response: 'calidad video' },
      
      // Perfiles
      { pattern: /crear\s*(un\s*)?perfil|a[ñn]adir\s*perfil|nuevo\s*perfil|cu[aá]ntos\s*perfil/i, response: 'crear perfiles' },
      { pattern: /pin\s*(de\s*)?perfil|poner\s*pin|bloquear\s*perfil|proteger\s*perfil/i, response: 'pin perfil' },
      
      // General
      { pattern: /c[oó]mo\s*(funciona|comprar|usar|empezar)|proceso|pasos|tutorial/i, response: 'como funciona' },
      { pattern: /soporte|contacto|contactar|ayuda|hablar\s*con|discord|atenci[oó]n/i, response: 'contactar soporte' },
      { pattern: /por\s*qu[eé]\s*(tan\s*)?barat|precio\s*bajo|tan\s*barato|c[oó]mo\s*pueden/i, response: 'por que tan barato' },
      { pattern: /legal|segur[ao]|leg[ií]tim[ao]|estafa|confiable|real|falso|fraude/i, response: 'es seguro' },
      { pattern: /renovar|extender|continuar|cuando\s*expira|comprar\s*(de\s*)?nuevo/i, response: 'renovar' },
      { pattern: /mejorar|upgrade|mejor\s*plan|plan\s*superior/i, response: 'mejorar cuenta' },
      { pattern: /revender|mayorista|vender|distribuidor/i, response: 'revendedor' },
      { pattern: /afiliado|referido|comisi[oó]n|ganar\s*dinero/i, response: 'afiliados' },
      { pattern: /qu[eé]\s*(venden|tienen|ofrecen)|disponible|servicios|productos|cat[aá]logo/i, response: 'servicios disponibles' },
      { pattern: /sin\s*stock|agotad[ao]|no\s*hay|no\s*disponible|restock/i, response: 'sin stock' },
      { pattern: /mayoreo|m[uú]ltiples|muchas\s*cuentas|cantidad|por\s*mayor/i, response: 'compra masiva' },
      { pattern: /^(hola|buenos?\s*(d[ií]as?|tardes?|noches?)|saludos|qu[eé]\s*tal)/i, response: 'saludo' },
      { pattern: /(gracias|grax|ty|thanks|agradec)/i, response: 'gracias' }
    ]
  };

  // Detectar idioma del texto
  const spanishWords = ['hola', 'cuenta', 'pedido', 'pago', 'donde', 'como', 'que', 'mi', 'no', 'funciona', 'ayuda', 'gracias', 'por', 'favor', 'quiero', 'necesito', 'tengo', 'problema', 'garantia', 'soporte', 'es', 'para', 'solo', 'puedo', 'cambiar'];
  
  function detectLanguage(text) {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);
    let spanishCount = 0;
    words.forEach(word => {
      if (spanishWords.includes(word) || word.includes('ñ') || word.includes('á') || word.includes('é') || word.includes('í') || word.includes('ó') || word.includes('ú') || word.includes('¿') || word.includes('¡')) {
        spanishCount++;
      }
    });
    return spanishCount >= 1 ? 'es' : 'en';
  }

  // Detectar intención del mensaje - MEJORADO
  function detectIntent(text, lang) {
    // Normalizar texto: quitar acentos para mejor matching
    const normalizedText = text.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
      .replace(/[¿¡]/g, ''); // quitar signos invertidos
    
    // Primero buscar en el idioma detectado
    const primaryPatterns = intentPatterns[lang] || intentPatterns.en;
    for (const { pattern, response } of primaryPatterns) {
      if (pattern.test(text) || pattern.test(normalizedText)) {
        return response;
      }
    }
    
    // Si no encuentra, buscar en el otro idioma (fallback)
    const fallbackLang = lang === 'es' ? 'en' : 'es';
    const fallbackPatterns = intentPatterns[fallbackLang];
    for (const { pattern, response } of fallbackPatterns) {
      if (pattern.test(text) || pattern.test(normalizedText)) {
        return response;
      }
    }
    
    return null;
  }

  // Idioma actual de la sesión
  let currentLang = 'en';

  // Opciones rápidas en ambos idiomas  
  const quickOptionsLang = {
    en: [
      { text: '❓ My account not working', query: 'my account is not working' },
      { text: '🔑 Where are my credentials?', query: 'where are my credentials' },
      { text: '📦 Where is my order?', query: 'where is my order' },
      { text: '💳 Payment methods', query: 'what payment methods' },
      { text: '🛡️ Warranty info', query: 'warranty info' },
      { text: '📞 Contact support', query: 'contact support' }
    ],
    es: [
      { text: '❓ Mi cuenta no funciona', query: 'mi cuenta no funciona' },
      { text: '🔑 ¿Dónde veo mis credenciales?', query: 'donde veo mis credenciales' },
      { text: '📦 ¿Dónde está mi pedido?', query: 'donde esta mi pedido' },
      { text: '💳 Métodos de pago', query: 'metodos de pago' },
      { text: '🛡️ Info de garantía', query: 'info de garantia' },
      { text: '📞 Contactar soporte', query: 'contactar soporte' }
    ]
  };

  // Opciones rápidas actuales
  let quickOptions = quickOptionsLang.en;

  // Enlaces de acciones (EN + ES)
  const actionLinks = {
    // English
    'Open Discord': 'https://discord.gg/plugmarket',
    'View my orders': './dashboard.html',
    'My dashboard': './dashboard.html',
    'View products': './index.html#categories',
    'View offers': './index.html',
    'View terms': './terms.html',
    'View warranty': './terms.html',
    'View FAQ': '#faq',
    'Contact support': 'https://discord.gg/plugmarket',
    // Spanish  
    'Abrir Discord': 'https://discord.gg/plugmarket',
    'Ver mis pedidos': './dashboard.html',
    'Mi dashboard': './dashboard.html',
    'Ver productos': './index.html#categories',
    'Ver ofertas': './index.html',
    'Ver términos': './terms.html',
    'Ver garantía': './terms.html',
    'Ver FAQ': '#faq',
    'Contactar soporte': 'https://discord.gg/plugmarket'
  };

  // ===== HISTORIAL DEL CHAT =====
  const CHAT_HISTORY_KEY = 'plugmarket_chat_history';
  
  function saveToHistory(type, text, buttons = []) {
    try {
      const history = JSON.parse(sessionStorage.getItem(CHAT_HISTORY_KEY) || '[]');
      history.push({ type, text, buttons, timestamp: Date.now() });
      // Limitar a últimos 50 mensajes
      if (history.length > 50) history.shift();
      sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('Error saving chat history:', e);
    }
  }

  function loadHistory() {
    try {
      return JSON.parse(sessionStorage.getItem(CHAT_HISTORY_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function clearHistory() {
    sessionStorage.removeItem(CHAT_HISTORY_KEY);
  }

  function hasHistory() {
    const history = loadHistory();
    return history.length > 0;
  }

  // Crear el HTML del widget
  function createWidget() {
    const widgetHTML = `
      <div id="chat-widget" class="chat-widget">
        <!-- Botón flotante -->
        <button id="chat-toggle" class="chat-toggle" aria-label="Open support chat">
          <svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          <span class="chat-badge">1</span>
        </button>

        <!-- Ventana de chat -->
        <div id="chat-window" class="chat-window">
          <div class="chat-header">
            <div class="chat-header-info">
              <div class="chat-avatar chat-avatar--face">
                <img src="./assets/logo.svg" alt="Plug Market" />
              </div>
              <div class="chat-header-text">
                <h4>Plug Market Support</h4>
                <span class="chat-status">🟢 Online</span>
              </div>
            </div>
            <button id="chat-close" class="chat-close" aria-label="Close chat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div id="chat-messages" class="chat-messages">
            <!-- Los mensajes se agregan aquí -->
          </div>

          <div id="chat-quick-options" class="chat-quick-options">
            <!-- Opciones rápidas -->
          </div>

          <div class="chat-input-area">
            <input type="text" id="chat-input" placeholder="Type your question..." autocomplete="off" />
            <button id="chat-send" class="chat-send" aria-label="Enviar mensaje">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHTML);
  }

  // Crear estilos del widget
  function createStyles() {
    const styles = `
      .chat-widget {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 99999;
        font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
      }

      /* Botón flotante */
      .chat-toggle {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ff2743 0%, #ff0a54 100%);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(255, 39, 67, 0.4), 0 0 40px rgba(255, 39, 67, 0.2);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
      }

      .chat-toggle:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 30px rgba(255, 39, 67, 0.5), 0 0 60px rgba(255, 39, 67, 0.3);
      }

      .chat-toggle svg {
        width: 28px;
        height: 28px;
        color: white;
        transition: all 0.3s ease;
      }

      .chat-toggle .chat-icon {
        opacity: 1;
        transform: scale(1);
      }

      .chat-toggle .close-icon {
        position: absolute;
        opacity: 0;
        transform: scale(0.5) rotate(-90deg);
      }

      .chat-widget.open .chat-toggle .chat-icon {
        opacity: 0;
        transform: scale(0.5) rotate(90deg);
      }

      .chat-widget.open .chat-toggle .close-icon {
        opacity: 1;
        transform: scale(1) rotate(0);
      }

      .chat-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        background: #ffffff;
        color: #ff2743;
        font-size: 12px;
        font-weight: 700;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        animation: pulse 2s infinite;
      }

      .chat-widget.open .chat-badge {
        display: none;
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      /* Ventana de chat */
      .chat-window {
        position: absolute;
        bottom: 80px;
        right: 0;
        width: 380px;
        max-width: calc(100vw - 48px);
        height: 520px;
        max-height: calc(100vh - 150px);
        background: #0f1214;
        border-radius: 20px;
        box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        visibility: hidden;
        transform: translateY(20px) scale(0.95);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .chat-widget.open .chat-window {
        opacity: 1;
        visibility: visible;
        transform: translateY(0) scale(1);
      }

      /* Header del chat */
      .chat-header {
        background: linear-gradient(135deg, #ff2743 0%, #ff0a54 100%);
        padding: 10px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .chat-header-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .chat-avatar {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;
        font-size: 18px;
      }

      .chat-avatar--face {
        padding: 0;
        background: transparent;
        overflow: hidden;
      }

      .chat-avatar--face svg {
        width: 100%;
        height: 100%;
      }

      .chat-avatar img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .chat-header-text h4 {
        color: white;
        font-size: 14px;
        font-weight: 600;
        margin: 0 0 1px 0;
      }

      .chat-status {
        color: rgba(255, 255, 255, 0.9);
        font-size: 11px;
      }

      .chat-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .chat-close:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .chat-close svg {
        width: 14px;
        height: 14px;
        color: white;
      }

      /* Área de mensajes */
      .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
      }

      .chat-messages::-webkit-scrollbar {
        width: 6px;
      }

      .chat-messages::-webkit-scrollbar-track {
        background: transparent;
      }

      .chat-messages::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }

      /* Mensajes */
      .chat-message {
        display: flex;
        gap: 10px;
        animation: messageIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      @keyframes messageIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .chat-message.user {
        flex-direction: row-reverse;
      }

      .message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #1f2937;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
        overflow: hidden;
      }

      .chat-message.bot .message-avatar {
        background: transparent;
        padding: 0;
      }

      .chat-message.bot .message-avatar svg {
        width: 100%;
        height: 100%;
      }

      .chat-message.user .message-avatar {
        background: linear-gradient(135deg, #ff2743 0%, #ff0a54 100%);
      }

      .message-content {
        max-width: 75%;
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.5;
      }

      .chat-message.bot .message-content {
        background: #1a1d24;
        color: #e0e0e0;
        border-bottom-left-radius: 4px;
      }

      .chat-message.user .message-content {
        background: linear-gradient(135deg, #ff2743 0%, #ff0a54 100%);
        color: white;
        border-bottom-right-radius: 4px;
      }

      .message-content strong {
        color: #ff4757;
      }

      .chat-message.user .message-content strong {
        color: white;
      }

      /* Botones de acción en mensajes */
      .message-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      .message-action-btn {
        background: rgba(255, 39, 67, 0.15);
        border: 1px solid rgba(255, 39, 67, 0.3);
        color: #ff4757;
        padding: 8px 14px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
      }

      .message-action-btn:hover {
        background: rgba(255, 39, 67, 0.25);
        border-color: rgba(255, 39, 67, 0.5);
        transform: translateY(-1px);
      }

      /* Opciones rápidas */
      .chat-quick-options {
        padding: 12px 16px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(0, 0, 0, 0.2);
      }

      .quick-option-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #d0d0d0;
        padding: 8px 14px;
        border-radius: 20px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
      }

      .quick-option-btn:hover {
        background: rgba(255, 39, 67, 0.15);
        border-color: rgba(255, 39, 67, 0.3);
        color: #ff4757;
      }

      /* Input area */
      .chat-input-area {
        display: flex;
        gap: 8px;
        padding: 10px 12px;
        background: #0a0d0f;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }

      #chat-input {
        flex: 1;
        background: #1a1d24;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 10px 16px;
        color: white;
        font-size: 13px;
        font-family: inherit;
        outline: none;
        transition: all 0.2s ease;
      }

      #chat-input::placeholder {
        color: #6b7280;
      }

      #chat-input:focus {
        border-color: rgba(255, 39, 67, 0.5);
        box-shadow: 0 0 0 3px rgba(255, 39, 67, 0.1);
      }

      .chat-send {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ff2743 0%, #ff0a54 100%);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }

      .chat-send svg {
        width: 16px;
        height: 16px;
      }

      .chat-send:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 15px rgba(255, 39, 67, 0.4);
      }

      .chat-send:active {
        transform: scale(0.95);
      }

      .chat-send svg {
        width: 20px;
        height: 20px;
        color: white;
      }

      /* Typing indicator */
      .typing-indicator {
        display: flex;
        gap: 4px;
        padding: 12px 16px;
      }

      .typing-indicator span {
        width: 8px;
        height: 8px;
        background: #6b7280;
        border-radius: 50%;
        animation: typing 1.4s infinite;
      }

      .typing-indicator span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .typing-indicator span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes typing {
        0%, 60%, 100% {
          transform: translateY(0);
          opacity: 0.4;
        }
        30% {
          transform: translateY(-6px);
          opacity: 1;
        }
      }

      /* Responsive */
      @media (max-width: 480px) {
        .chat-widget {
          bottom: 16px;
          right: 16px;
        }

        .chat-window {
          width: calc(100vw - 32px);
          height: calc(100vh - 120px);
          bottom: 76px;
          right: -8px;
          border-radius: 16px;
        }

        .chat-toggle {
          width: 54px;
          height: 54px;
        }

        .chat-toggle svg {
          width: 24px;
          height: 24px;
        }
      }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  // Funciones del chat
  function initChat() {
    const widget = document.getElementById('chat-widget');
    const toggle = document.getElementById('chat-toggle');
    const closeBtn = document.getElementById('chat-close');
    const messages = document.getElementById('chat-messages');
    const quickOptionsEl = document.getElementById('chat-quick-options');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    let isFirstOpen = true;
    let historyRestored = false;

    // Toggle chat
    toggle.addEventListener('click', () => {
      widget.classList.toggle('open');
      if (widget.classList.contains('open') && isFirstOpen) {
        isFirstOpen = false;
        
        // Restaurar historial o mostrar bienvenida
        const history = loadHistory();
        if (history.length > 0) {
          // Restaurar mensajes del historial
          history.forEach(msg => {
            if (msg.type === 'user') {
              renderUserMessage(msg.text);
            } else if (msg.type === 'bot') {
              renderBotMessage(msg.text, msg.buttons || []);
            }
          });
          historyRestored = true;
          // Ocultar quick options si hay historial
          quickOptionsEl.style.display = 'none';
        } else {
          // Mensaje de bienvenida en inglés
          setTimeout(() => {
            addBotMessage(botResponses.en.welcome);
          }, 300);
        }
      }
      if (widget.classList.contains('open')) {
        input.focus();
      }
    });

    closeBtn.addEventListener('click', () => {
      widget.classList.remove('open');
    });

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && widget.classList.contains('open')) {
        widget.classList.remove('open');
      }
    });

    // Manejar clic en opciones rápidas
    quickOptionsEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('quick-option-btn')) {
        const query = e.target.dataset.query;
        const text = e.target.textContent;
        // Ocultar las opciones rápidas después de seleccionar
        quickOptionsEl.style.display = 'none';
        handleUserMessage(text, query);
      }
    });

    // Enviar mensaje
    function sendMessage() {
      const text = input.value.trim();
      if (text) {
        handleUserMessage(text);
        input.value = '';
      }
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });

    // Renderizar opciones rápidas
    function renderQuickOptionsUI() {
      quickOptionsEl.innerHTML = quickOptions.map(opt => 
        `<button class="quick-option-btn" data-query="${opt.query}">${opt.text}</button>`
      ).join('');
    }

    renderQuickOptionsUI();
  }

  // Renderizar mensaje del usuario (sin guardar)
  function renderUserMessage(text) {
    const messages = document.getElementById('chat-messages');
    const messageHTML = `
      <div class="chat-message user">
        <div class="message-avatar">👤</div>
        <div class="message-content">${escapeHtml(text)}</div>
      </div>
    `;
    messages.insertAdjacentHTML('beforeend', messageHTML);
    scrollToBottom();
  }

  // Renderizar mensaje del bot (sin guardar)
  function renderBotMessage(text, buttons = []) {
    const messages = document.getElementById('chat-messages');
    let buttonsHTML = '';
    
    if (buttons.length > 0) {
      buttonsHTML = `
        <div class="message-actions">
          ${buttons.map(btn => `<button class="message-action-btn" data-action="${btn}">${btn}</button>`).join('')}
        </div>
      `;
    }

    const messageHTML = `
      <div class="chat-message bot">
        <div class="message-avatar">${botFaceSVG}</div>
        <div class="message-content">
          ${formatMessage(text)}
          ${buttonsHTML}
        </div>
      </div>
    `;
    messages.insertAdjacentHTML('beforeend', messageHTML);
    scrollToBottom();

    // Agregar event listeners a los botones de acción
    const actionBtns = messages.querySelectorAll('.message-action-btn:not([data-bound])');
    actionBtns.forEach(btn => {
      btn.setAttribute('data-bound', 'true');
      btn.addEventListener('click', () => handleAction(btn.dataset.action));
    });
  }

  // Agregar mensaje del usuario (y guardar)
  function addUserMessage(text, save = true) {
    renderUserMessage(text);
    if (save) {
      saveToHistory('user', text);
    }
  }

  // Agregar mensaje del bot (y guardar)
  function addBotMessage(text, buttons = [], save = true) {
    renderBotMessage(text, buttons);
    if (save) {
      saveToHistory('bot', text, buttons);
    }
  }

  // Mostrar indicador de escritura
  function showTyping() {
    const messages = document.getElementById('chat-messages');
    const typingHTML = `
      <div class="chat-message bot typing-message">
        <div class="message-avatar">${botFaceSVG}</div>
        <div class="message-content">
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    `;
    messages.insertAdjacentHTML('beforeend', typingHTML);
    scrollToBottom();
  }

  // Ocultar indicador de escritura
  function hideTyping() {
    const typingMsg = document.querySelector('.typing-message');
    if (typingMsg) typingMsg.remove();
  }

  // Procesar mensaje del usuario
  function handleUserMessage(text, query = null) {
    addUserMessage(text);
    
    // Ocultar quick options cuando el usuario envía un mensaje
    const quickOptionsEl = document.getElementById('chat-quick-options');
    if (quickOptionsEl) {
      quickOptionsEl.style.display = 'none';
    }
    
    // Simular tiempo de respuesta
    showTyping();
    
    const searchQuery = (query || text);
    
    // Detectar idioma del usuario
    currentLang = detectLanguage(text);
    const responses = botResponses[currentLang];
    
    setTimeout(() => {
      hideTyping();
      
      let response = null;
      
      // Primero buscar por query directa (opciones rápidas)
      if (responses[searchQuery.toLowerCase()]) {
        response = responses[searchQuery.toLowerCase()];
      }
      
      // Usar detección de intención con regex
      if (!response) {
        const intentKey = detectIntent(searchQuery, currentLang);
        if (intentKey && responses[intentKey]) {
          response = responses[intentKey];
        }
      }
      
      // Usar respuesta por defecto si no se encontró nada
      if (!response) {
        response = responses.default;
      }
      
      addBotMessage(response.message, response.buttons || []);
    }, 800 + Math.random() * 400);
  }

  // Manejar acciones de botones
  function handleAction(action) {
    const link = actionLinks[action];
    if (link) {
      if (link.startsWith('http') || link.startsWith('./')) {
        window.open(link, link.startsWith('http') ? '_blank' : '_self');
      } else if (link.startsWith('#')) {
        document.getElementById('chat-widget').classList.remove('open');
        if (link === '#faq') {
          // Scroll a FAQ si existe
          const faq = document.querySelector('.faq-section, #faq');
          if (faq) faq.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }

  // Utilidades
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatMessage(text) {
    // Convertir **texto** a <strong>texto</strong>
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function scrollToBottom() {
    const messages = document.getElementById('chat-messages');
    messages.scrollTop = messages.scrollHeight;
  }

  // Inicializar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    createStyles();
    createWidget();
    initChat();
  }
})();
