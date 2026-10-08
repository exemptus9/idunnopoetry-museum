-- Run against disposable PostgreSQL 16 in CI, NEVER a production project.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema extensions;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema public,auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;

\ir ../supabase/migrations/20261008_museum_editorial_backend.sql

-- Provisioned only by the database owner. No self-registration or self-promotion.
insert into auth.users(id,email) values
  ('11111111-1111-1111-1111-111111111111','owner@example.test'),
  ('22222222-2222-2222-2222-222222222222','outsider@example.test');
insert into public.museum_editors(user_id,role)
values ('11111111-1111-1111-1111-111111111111','owner');

set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$
declare
  d public.museum_documents;
  pub public.museum_publications;
  denied boolean := false;
begin
  if public.museum_my_role() <> 'owner' then raise exception 'owner allowlist failed'; end if;
  d:=public.museum_save(null,'seed','seed-test-01','Test working seed',
     '{"text":"A tiny test fragment","status":"seed","provenance":"brandon","private_notebook":"NEVER LEAK THIS"}'::jsonb,
     0,'source evidence retained separately');
  if d.revision<>1 or d.status<>'draft' then raise exception 'draft save failed'; end if;
  begin
    perform public.museum_publish(d.id,1,'PUBLISH APPROVED VERSION');
    raise exception 'publish succeeded without approval';
  exception when others then
    if sqlerrm='publish succeeded without approval' then raise; end if;
  end;
  d:=public.museum_approve(d.id,1,'APPROVE EXACT PUBLIC VERSION');
  if d.status<>'approved' then raise exception 'approval state failed'; end if;
  pub:=public.museum_publish(d.id,1,'PUBLISH APPROVED VERSION');
  if pub.state<>'published' or pub.payload->>'text'<>'A tiny test fragment'
     or pub.payload ? 'private_notebook' then
    raise exception 'unsafe public projection';
  end if;
  begin
    d:=public.museum_save(d.id,'seed','seed-test-01','Test working seed',
       '{"text":"changed","status":"seed","provenance":"brandon"}'::jsonb,0,'stale edit');
    raise exception 'revision conflict was bypassed';
  exception when others then
    if sqlerrm='revision conflict was bypassed' then raise; end if;
  end;
  d:=public.museum_save(d.id,'seed','seed-test-01','Test working seed',
       '{"text":"Changed text","status":"seed","provenance":"brandon"}'::jsonb,1,'correct edit');
  begin
    perform public.museum_publish(d.id,2,'PUBLISH APPROVED VERSION');
    raise exception 'edited draft published without reapproval';
  exception when others then
    if sqlerrm='edited draft published without reapproval' then raise; end if;
  end;
  d:=public.museum_restore(d.id,2,1);
  if d.revision<>3 or d.status<>'draft' then raise exception 'non-destructive restore failed'; end if;
  pub:=public.museum_withdraw(d.id,3,'WITHDRAW PUBLIC VERSION');
  if pub.state<>'withdrawn' or pub.payload <> '{"hidden":true}'::jsonb then
    raise exception 'withdrawal did not create safe tombstone';
  end if;
end$$;

-- Anonymous visitors see only publication rows and cannot read/edit drafts.
reset role;
set role anon;
set request.jwt.claim.sub = '';
do $$
declare
  n bigint;
begin
  select count(*) into n from public.museum_publications;
  if n<>1 then raise exception 'public projection not readable'; end if;
  begin
    select count(*) into n from public.museum_documents;
    raise exception 'anonymous private read succeeded';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.museum_save(null,'seed','hack','hack','{}'::jsonb,0,'');
    raise exception 'anonymous RPC accepted';
  exception when insufficient_privilege or undefined_function then
    null;
  end;
end$$;

reset role;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare
  n bigint;
begin
  if public.museum_my_role() is not null then raise exception 'outsider role granted'; end if;
  select count(*) into n from public.museum_documents;
  if n<>0 then raise exception 'RLS exposed private documents'; end if;
  select count(*) into n from public.museum_revisions;
  if n<>0 then raise exception 'RLS exposed private revision history'; end if;
  begin
    perform public.museum_save(null,'seed','hack','hack','{}'::jsonb,0,'');
    raise exception 'outsider edit accepted';
  exception when insufficient_privilege then
    null;
  end;
end$$;
reset role;
select 'PASS: owner approval, immutable revisions, public projection, withdrawal and RLS gates' as result;
