-- =====================================================
-- SUBSCRIPTION MANAGEMENT QUICK COMMANDS
-- Run these in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- VIEW ALL USERS AND THEIR SUBSCRIPTIONS
-- =====================================================
SELECT id, email, full_name, subscription_tier, subscription_started_at, subscription_expires_at
FROM public.users
ORDER BY created_at DESC;

-- =====================================================
-- CHANGE USER TO BASIC PLAN
-- =====================================================
-- Option 1: Using helper function
SELECT public.set_user_basic('user@example.com');

-- Option 2: Direct update
UPDATE public.users 
SET subscription_tier = 'basic', updated_at = NOW() 
WHERE email = 'user@example.com';

-- =====================================================
-- CHANGE USER TO PREMIUM PLAN
-- =====================================================
-- Option 1: Using helper function
SELECT public.set_user_premium('user@example.com');

-- Option 2: Direct update
UPDATE public.users 
SET subscription_tier = 'premium', updated_at = NOW() 
WHERE email = 'user@example.com';

-- =====================================================
-- CHANGE USER TO PREMIUM PLUS PLAN
-- =====================================================
-- Option 1: Using helper function
SELECT public.set_user_premium_plus('user@example.com');

-- Option 2: Direct update
UPDATE public.users 
SET subscription_tier = 'premium_plus', updated_at = NOW() 
WHERE email = 'user@example.com';

-- =====================================================
-- ADVANCED: UPDATE WITH EXPIRATION DATE
-- =====================================================
SELECT public.update_user_subscription(
    'user@example.com',           -- user email
    'premium'::subscription_tier, -- new tier: 'basic', 'premium', or 'premium_plus'
    '2027-12-31 23:59:59'::timestamptz  -- optional expiration date (NULL for no expiration)
);

-- =====================================================
-- BULK UPDATE: Set all users to a specific tier
-- =====================================================
-- Set all users to basic
UPDATE public.users SET subscription_tier = 'basic', updated_at = NOW();

-- Set all users to premium
UPDATE public.users SET subscription_tier = 'premium', updated_at = NOW();

-- =====================================================
-- FILTER USERS BY TIER
-- =====================================================
-- Get all basic users
SELECT email, full_name FROM public.users WHERE subscription_tier = 'basic';

-- Get all premium users
SELECT email, full_name FROM public.users WHERE subscription_tier = 'premium';

-- Get all premium plus users
SELECT email, full_name FROM public.users WHERE subscription_tier = 'premium_plus';

-- =====================================================
-- COUNT USERS BY TIER
-- =====================================================
SELECT subscription_tier, COUNT(*) as user_count
FROM public.users
GROUP BY subscription_tier
ORDER BY subscription_tier;
