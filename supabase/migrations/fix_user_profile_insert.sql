-- Migration: Add missing INSERT policy for users table and ensure trigger exists
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- 1. Enable the uuid extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create subscription_tier enum if it doesn't exist
DO $$ 
BEGIN
    CREATE TYPE subscription_tier AS ENUM ('basic', 'premium', 'premium_plus');
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'subscription_tier type already exists';
END $$;

-- 3. Add missing columns to users table if they don't exist
DO $$
BEGIN
    -- Add subscription_tier column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'subscription_tier') THEN
        ALTER TABLE public.users ADD COLUMN subscription_tier TEXT DEFAULT 'basic';
        RAISE NOTICE 'Added subscription_tier column';
    END IF;
    
    -- Add subscription_started_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'subscription_started_at') THEN
        ALTER TABLE public.users ADD COLUMN subscription_started_at TIMESTAMPTZ;
        RAISE NOTICE 'Added subscription_started_at column';
    END IF;
    
    -- Add full_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'full_name') THEN
        ALTER TABLE public.users ADD COLUMN full_name TEXT;
        RAISE NOTICE 'Added full_name column';
    END IF;
    
    -- Add avatar_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_url') THEN
        ALTER TABLE public.users ADD COLUMN avatar_url TEXT;
        RAISE NOTICE 'Added avatar_url column';
    END IF;
END $$;

-- 4. Add INSERT policy for users table (allows users to create their own profile)
DO $$ 
BEGIN
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
    
    -- Create the INSERT policy
    CREATE POLICY "Users can insert own profile" ON public.users
        FOR INSERT WITH CHECK (auth.uid() = id);
        
    RAISE NOTICE 'INSERT policy created successfully';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'INSERT policy may already exist or table not found: %', SQLERRM;
END $$;

-- 5. Ensure the handle_new_user function exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url, subscription_tier, subscription_started_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url',
        'basic',
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Create user profiles for any existing auth users that don't have profiles
INSERT INTO public.users (id, email, full_name, subscription_tier, subscription_started_at)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email::text, '@', 1)),
    'basic',
    NOW()
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- Done!
SELECT 'Migration completed successfully. You should now be able to add repositories.' as status;
