-- Create profiles for existing users who don't have one yet
INSERT INTO public.profiles (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO NOTHING;