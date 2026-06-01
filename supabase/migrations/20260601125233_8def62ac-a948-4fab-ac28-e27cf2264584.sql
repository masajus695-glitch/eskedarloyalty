DROP POLICY IF EXISTS "users update own profile name" ON public.profiles;

CREATE POLICY "users update own display_name only"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND beans = (SELECT p.beans FROM public.profiles p WHERE p.user_id = auth.uid())
  AND total_redeemed = (SELECT p.total_redeemed FROM public.profiles p WHERE p.user_id = auth.uid())
);