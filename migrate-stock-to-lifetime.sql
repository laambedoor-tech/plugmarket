-- Script para migrar stock de variantes antiguas (1 Month, 3 Months, 6 Months, 12 Months) a Lifetime
-- Ejecutar en el SQL Editor de Supabase

-- Productos a migrar (los que ahora tienen solo Lifetime):
-- spotify, disney, youtube-premium, geoguessr, filmora, duolingo, crunchly, capcut, movistar, nordvpn, prime

-- SPOTIFY
UPDATE accounts 
SET plan = 'Lifetime'
WHERE product_id = 'spotify' 
  AND plan IN ('1 Month', '3 Months', '6 Months', '12 Months')
  AND status = 'available';

-- DISNEY+
UPDATE accounts 
SET plan = 'Lifetime'
WHERE product_id = 'disney' 
  AND plan IN ('1 Month', '3 Months', '6 Months', '12 Months')
  AND status = 'available';

-- YOUTUBE PREMIUM
UPDATE accounts 
SET plan = 'Lifetime'
WHERE product_id = 'youtube-premium' 
  AND plan IN ('1 Month', '3 Months', '6 Months', '12 Months')
  AND status = 'available';

-- GEOGUESSR
UPDATE accounts 
SET plan = 'Lifetime'
WHERE product_id = 'geoguessr' 
  AND plan IN ('1 Month', '3 Months', '6 Months', '12 Months')
  AND status = 'available';

-- FILMORA
UPDATE accounts 
SET plan = 'Lifetime'
WHERE product_id = 'filmora' 
  AND plan IN ('1 Month', '3 Months', '6 Months', '12 Months')
  AND status = 'available';

-- DUOLINGO
UPDATE accounts 
SET plan = 'Lifetime'
WHERE product_id = 'duolingo' 
  AND plan IN ('1 Month', '3 Months', '6 Months', '12 Months')
  AND status = 'available';

-- CRUNCHYROLL
UPDATE accounts 
SET plan = 'Lifetime'
WHERE product_id = 'crunchly' 
  AND plan IN ('1 Month', '3 Months', '6 Months', '12 Months')
  AND status = 'available';

-- CAPCUT
UPDATE accounts 
SET plan = 'Lifetime'
WHERE product_id = 'capcut' 
  AND plan IN ('1 Month', '3 Months', '6 Months', '12 Months')
  AND status = 'available';

-- MOVISTAR
UPDATE accounts 
SET plan = 'Lifetime'
WHERE product_id = 'movistar' 
  AND plan IN ('1 Month', '3 Months', '6 Months', '12 Months')
  AND status = 'available';

-- NORDVPN
UPDATE accounts 
SET plan = 'Lifetime'
WHERE product_id = 'nordvpn' 
  AND plan IN ('1 Month', '3 Months', '6 Months', '12 Months')
  AND status = 'available';

-- AMAZON PRIME VIDEO
UPDATE accounts 
SET plan = 'Lifetime'
WHERE product_id = 'prime' 
  AND plan IN ('1 Month', '3 Months', '6 Months', '12 Months')
  AND status = 'available';

-- NETFLIX (Cambiar 1 Month, 3 Months, 12 Months a Lifetime, mantener Bulk sin cambios)
UPDATE accounts 
SET plan = 'Lifetime'
WHERE product_id = 'netflix' 
  AND plan IN ('1 Month', '3 Months', '12 Months')
  AND status = 'available';

-- Para verificar los cambios antes de aplicarlos, puedes ejecutar estas consultas SELECT:
-- SELECT product_id, plan, COUNT(*) as cantidad 
-- FROM accounts 
-- WHERE product_id IN ('spotify', 'disney', 'youtube-premium', 'geoguessr', 'filmora', 'duolingo', 'crunchly', 'capcut', 'movistar', 'nordvpn', 'prime', 'netflix')
--   AND status = 'available'
-- GROUP BY product_id, plan
-- ORDER BY product_id, plan;
