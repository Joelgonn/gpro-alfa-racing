-- Migration: ALFA-007.4-FIX-DB — car_characteristic para ALFA-007.4
-- Objetivo: persistir pontos de característica Power/Handling/Accel (tPower/tHandl/tAccel) de UpdateCar
-- Idempotente e segura para registros antigos (null fallback)

ALTER TABLE public.user_state
ADD COLUMN IF NOT EXISTS car_characteristic jsonb;

-- Reload schema cache para PostgREST (Supabase)
NOTIFY pgrst, 'reload schema';
