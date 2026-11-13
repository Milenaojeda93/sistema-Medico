-- Medvia · Funciones internas no invocables vía API
revoke execute on function public.audit_trigger() from authenticated, public, anon;
revoke execute on function public.enforce_same_clinic() from authenticated, public, anon;
revoke execute on function public.handle_new_user() from authenticated, public, anon;
revoke execute on function public.require_perm(uuid, text, text) from authenticated, public, anon;
revoke execute on function public.set_updated_at() from authenticated, public, anon;
revoke execute on function public.check_pi_plan() from authenticated, public, anon;
revoke execute on function public.check_appt_insurance() from authenticated, public, anon;
revoke execute on function public.protect_closed_consultation() from authenticated, public, anon;
revoke execute on function public.protect_amendments() from authenticated, public, anon;
