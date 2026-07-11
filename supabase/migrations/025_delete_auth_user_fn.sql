-- Função para apagar auth.users pelo e-mail, chamada pela Edge Function delete-student
CREATE OR REPLACE FUNCTION public.delete_auth_user_by_email(p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM auth.users WHERE email = p_email;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_auth_user_by_email FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_auth_user_by_email TO service_role;
