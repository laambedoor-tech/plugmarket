-- ============================================
-- SUPABASE: Configuración para ChatGPT
-- ============================================
-- Este script agrega las columnas necesarias para soportar
-- las credenciales extendidas de ChatGPT (hotmail + chatgpt)

-- 1. Agregar columnas para credenciales adicionales de ChatGPT
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS chatgpt_password TEXT,
ADD COLUMN IF NOT EXISTS chatgpt_code TEXT;

-- 2. Comentarios para documentación
COMMENT ON COLUMN accounts.chatgpt_password IS 'Contraseña específica de ChatGPT (CHATGPT pw)';
COMMENT ON COLUMN accounts.chatgpt_code IS 'Código de invitación de ChatGPT (CHATGPT Code) - URL chatgpt.com/p/...';

-- ============================================
-- INSERTAR CUENTA DE CHATGPT
-- ============================================
-- Esta cuenta mostrará al cliente:
--
-- 📋 Instrucciones
-- [+] Domain Acces => outlook/hotmail
-- [+] Extra Info => If the account dont have "Plus Plan", 
--     please login in account and then use the chatgpt code 
--     (Can find in the delivery)
--
-- 📦 Deliverables
-- [HOTMAIL (mail)] = posadacarlston95678@outlook.com
-- [HOTMAIL (pw)] = 4Z9MSU5MJ1
-- [CHATGPT (pw)] = Alone@123456
-- [CHATGPT (Code)] = chatgpt.com/p/C8R8J6GW4WKWJ5Z4
--
-- Ejecuta este comando en Supabase SQL Editor:

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

-- ============================================
-- CONSULTA: Ver cuentas de ChatGPT disponibles
-- ============================================
-- Ejecuta esto para verificar tus cuentas de ChatGPT:

SELECT 
  id,
  product_id,
  plan,
  status,
  email,
  password,
  chatgpt_password,
  chatgpt_code,
  created_at
FROM accounts
WHERE product_id = 'chatgpt'
ORDER BY created_at DESC;
