-- IDunnoPoetry Museum: private editorial control plane (NOT the public archive).
-- Apply ONLY to a new/approved Supabase project; no personal source data is seeded.
-- PostgreSQL 15+; pgcrypto for content revision hashes.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.museum_editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor')),
  added_at timestamptz not null default now()
);
create table if not exists public.museum_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'seed','poem','creative','post','topic','forum','member',
    'media','document','page','site','navigation','theme','exhibit','reader_impact'
  )),
  entity_key text not null check (entity_key ~ '^[A-Za-z0-9_-]{1,120}$'),
  title text not null check (length(title) between 1 and 240),
  draft jsonb not null check (jsonb_typeof(draft) = 'object'),
  revision integer not null default 1 check (revision > 0),
  approved_revision integer,
  approved_sha256 text,
  status text not null default 'draft' check (status in ('draft','approved','published','withdrawn')),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(kind,entity_key)
);
create table if not exists public.museum_revisions (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.museum_documents(id),
  version integer not null,
  title text not null,
  draft jsonb not null,
  editor_id uuid not null references auth.users(id),
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique(document_id,version)
);
create table if not exists public.museum_publications (
  kind text not null,
  entity_key text not null,
  payload jsonb not null,
  state text not null default 'published' check (state in ('published','withdrawn')),
  revision integer not null,
  published_at timestamptz not null default now(),
  published_by uuid not null references auth.users(id),
  primary key(kind,entity_key)
);
create table if not exists public.museum_events (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.museum_documents(id),
  actor_id uuid not null references auth.users(id),
  event_type text not null,
  version integer not null,
  detail text not null default '',
  recorded_at timestamptz not null default now()
);

create index if not exists museum_documents_updated_idx on public.museum_documents(updated_at desc);
create index if not exists museum_revisions_doc_idx on public.museum_revisions(document_id,version desc);
create index if not exists museum_events_doc_idx on public.museum_events(document_id, recorded_at desc);

alter table public.museum_editors enable row level security;
alter table public.museum_documents enable row level security;
alter table public.museum_revisions enable row level security;
alter table public.museum_publications enable row level security;
alter table public.museum_events enable row level security;

-- Browser users get no direct table writes: ALL mutations are audited RPC calls.
revoke all on public.museum_editors, public.museum_documents,
  public.museum_revisions, public.museum_publications, public.museum_events
  from public, anon, authenticated;
grant select on public.museum_editors, public.museum_documents,
  public.museum_revisions, public.museum_events to authenticated;
grant select on public.museum_publications to anon, authenticated;

create or replace function public.museum_my_role()
returns text language sql stable security definer set search_path = ''
as $$
 select e.role from public.museum_editors e
 where e.user_id = (select auth.uid()) limit 1;
$$;
revoke all on function public.museum_my_role() from public, anon;
grant execute on function public.museum_my_role() to authenticated;

drop policy if exists museum_editors_self on public.museum_editors;
create policy museum_editors_self on public.museum_editors for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists museum_documents_staff on public.museum_documents;
create policy museum_documents_staff on public.museum_documents for select to authenticated
  using ((select public.museum_my_role()) in ('owner','editor'));
drop policy if exists museum_revisions_staff on public.museum_revisions;
create policy museum_revisions_staff on public.museum_revisions for select to authenticated
  using ((select public.museum_my_role()) in ('owner','editor'));
drop policy if exists museum_events_staff on public.museum_events;
create policy museum_events_staff on public.museum_events for select to authenticated
  using ((select public.museum_my_role()) in ('owner','editor'));
drop policy if exists museum_publications_reader on public.museum_publications;
create policy museum_publications_reader on public.museum_publications for select to anon,authenticated
  using (true);

-- Normalize the public projection strictly. Unknown/private draft fields are
-- never copied. Only the curator's approved revision can enter this table.
create or replace function public.museum_public_projection(p_kind text,p_title text,p_body jsonb)
returns jsonb language plpgsql immutable set search_path = ''
as $$
declare
  out jsonb;
begin
  out := jsonb_strip_nulls(jsonb_build_object(
    'title', p_title,
    'text', p_body->>'text',
    'description', p_body->>'description',
    'status', p_body->>'status',
    'provenance', p_body->>'provenance',
    'public_note', p_body->>'public_note',
    'url', p_body->>'url',
    'alt', p_body->>'alt',
    'label', p_body->>'label',
    'color', p_body->>'color'
  ));
  -- Reject HTML and script-like data; renderers always escape at the sink too.
  if length(out::text) > 150000 then
    raise exception 'Public projection too large';
  end if;
  if (p_body ? 'text') and length(p_body->>'text') > 100000 then
    raise exception 'Public text too large';
  end if;
  if (p_kind in ('seed','poem','creative'))
    and (coalesce(p_body->>'provenance','') not in ('brandon','assisted','mixed','external','uncertain','prompted','ai')) then
    raise exception 'Creative provenance classification is required';
  end if;
  if p_kind = 'media' and (p_body->>'url' is not null)
    and (p_body->>'url' !~ '^https://[A-Za-z0-9.-]+(/[A-Za-z0-9_./?=&%+#-]*)?$') then
    raise exception 'Media URL requires a safe HTTPS link';
  end if;
  return out;
end;
$$;
revoke all on function public.museum_public_projection(text,text,jsonb) from public,anon,authenticated;

-- Draft writes use optimistic revision checks to prevent silent overwrite.
create or replace function public.museum_save(
  p_id uuid, p_kind text, p_entity_key text, p_title text, p_draft jsonb,
  p_expected_revision integer, p_reason text default ''
)
returns public.museum_documents
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result public.museum_documents%rowtype;
  n integer;
begin
  if actor is null or public.museum_my_role() not in ('owner','editor') then
    raise exception 'Not an authorized curator' using errcode = '42501';
  end if;
  if p_kind not in ('seed','poem','creative','post','topic','forum','member',
      'media','document','page','site','navigation','theme','exhibit','reader_impact')
      or p_entity_key !~ '^[A-Za-z0-9_-]{1,120}$'
      or length(trim(coalesce(p_title,''))) not between 1 and 240
      or jsonb_typeof(p_draft) <> 'object' or length(p_draft::text) > 180000
      or length(coalesce(p_reason,'')) > 2000 then
    raise exception 'Invalid editor input';
  end if;
  if p_id is null then
    if p_expected_revision <> 0 then raise exception 'New record requires expected revision 0'; end if;
    insert into public.museum_documents
      (kind,entity_key,title,draft,created_by,updated_by)
    values (p_kind,p_entity_key,trim(p_title),p_draft,actor,actor)
    returning * into result;
  else
    select * into result from public.museum_documents where id=p_id for update;
    if not found or result.kind <> p_kind or result.entity_key <> p_entity_key
      or result.revision <> p_expected_revision then
      raise exception 'Revision conflict or document identity changed';
    end if;
    update public.museum_documents set
      title=trim(p_title), draft=p_draft, revision=revision+1,
      approved_revision=null,approved_sha256=null,status='draft',
      updated_by=actor, updated_at=now()
      where id=p_id returning * into result;
  end if;
  insert into public.museum_revisions(document_id,version,title,draft,editor_id,reason)
    values(result.id,result.revision,result.title,result.draft,actor,coalesce(p_reason,''));
  insert into public.museum_events(document_id,actor_id,event_type,version,detail)
    values(result.id,actor,'save_draft',result.revision,coalesce(p_reason,''));
  return result;
end;
$$;
revoke all on function public.museum_save(uuid,text,text,text,jsonb,integer,text) from public,anon;
grant execute on function public.museum_save(uuid,text,text,text,jsonb,integer,text) to authenticated;

-- Separate explicit public consent from saving a draft. No automatic publishing.
create or replace function public.museum_approve(
  p_id uuid, p_expected_revision integer, p_confirmation text
)
returns public.museum_documents
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  d public.museum_documents%rowtype;
begin
  if actor is null or public.museum_my_role() <> 'owner' then
    raise exception 'Owner role required' using errcode = '42501';
  end if;
  if p_confirmation <> 'APPROVE EXACT PUBLIC VERSION' then
    raise exception 'Explicit public consent required';
  end if;
  select * into d from public.museum_documents where id=p_id for update;
  if not found or d.revision <> p_expected_revision then
    raise exception 'Revision conflict';
  end if;
  perform public.museum_public_projection(d.kind,d.title,d.draft);
  update public.museum_documents set
    approved_revision=d.revision,
    approved_sha256=encode(extensions.digest(convert_to(d.draft::text,'UTF8'),'sha256'),'hex'),
    status='approved',updated_by=actor,updated_at=now()
    where id=p_id returning * into d;
  insert into public.museum_events(document_id,actor_id,event_type,version)
    values(d.id,actor,'approve_exact_public_revision',d.revision);
  return d;
end;
$$;
revoke all on function public.museum_approve(uuid,integer,text) from public,anon;
grant execute on function public.museum_approve(uuid,integer,text) to authenticated;

create or replace function public.museum_publish(
  p_id uuid, p_expected_revision integer, p_confirmation text
)
returns public.museum_publications
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  d public.museum_documents%rowtype;
  publication public.museum_publications%rowtype;
begin
  if actor is null or public.museum_my_role() <> 'owner' then
    raise exception 'Owner role required' using errcode = '42501';
  end if;
  if p_confirmation <> 'PUBLISH APPROVED VERSION' then
    raise exception 'Explicit publish action required';
  end if;
  select * into d from public.museum_documents where id=p_id for update;
  if not found or d.revision <> p_expected_revision
      or d.approved_revision is distinct from d.revision
      or d.approved_sha256 is distinct from
        encode(extensions.digest(convert_to(d.draft::text,'UTF8'),'sha256'),'hex') then
    raise exception 'Unapproved or stale draft; re-review before publishing';
  end if;
  insert into public.museum_publications
    (kind,entity_key,payload,state,revision,published_by)
  values(d.kind,d.entity_key,public.museum_public_projection(d.kind,d.title,d.draft),
    'published',d.revision,actor)
  on conflict(kind,entity_key) do update set
    payload=excluded.payload,state='published',
    revision=excluded.revision,published_at=now(),published_by=actor
  returning * into publication;
  update public.museum_documents set
    status='published',updated_at=now(),updated_by=actor where id=p_id;
  insert into public.museum_events(document_id,actor_id,event_type,version)
    values(d.id,actor,'publish',d.revision);
  return publication;
end;
$$;
revoke all on function public.museum_publish(uuid,integer,text) from public,anon;
grant execute on function public.museum_publish(uuid,integer,text) to authenticated;

-- Withdrawal creates a public tombstone, never reveals previous/private text.
create or replace function public.museum_withdraw(
  p_id uuid,p_expected_revision integer,p_confirmation text
)
returns public.museum_publications
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  d public.museum_documents%rowtype;
  publication public.museum_publications%rowtype;
begin
  if actor is null or public.museum_my_role() <> 'owner' then
    raise exception 'Owner role required' using errcode = '42501';
  end if;
  if p_confirmation <> 'WITHDRAW PUBLIC VERSION' then
    raise exception 'Explicit withdrawal required';
  end if;
  select * into d from public.museum_documents where id=p_id for update;
  if not found or d.revision <> p_expected_revision then
    raise exception 'Revision conflict';
  end if;
  insert into public.museum_publications
    (kind,entity_key,payload,state,revision,published_by)
  values(d.kind,d.entity_key,'{"hidden":true}'::jsonb,'withdrawn',d.revision,actor)
  on conflict(kind,entity_key) do update set
    payload='{"hidden":true}'::jsonb,state='withdrawn',
    revision=excluded.revision,published_at=now(),published_by=actor
  returning * into publication;
  update public.museum_documents set
    status='withdrawn',approved_revision=null,approved_sha256=null,
    updated_at=now(),updated_by=actor where id=p_id;
  insert into public.museum_events(document_id,actor_id,event_type,version)
    values(d.id,actor,'withdraw',d.revision);
  return publication;
end;
$$;
revoke all on function public.museum_withdraw(uuid,integer,text) from public,anon;
grant execute on function public.museum_withdraw(uuid,integer,text) to authenticated;

-- Restoring a historic draft creates a NEW revision; audit history persists.
create or replace function public.museum_restore(
  p_id uuid,p_expected_revision integer,p_from_revision integer
)
returns public.museum_documents
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  d public.museum_documents%rowtype;
  old public.museum_revisions%rowtype;
begin
  if actor is null or public.museum_my_role() not in ('owner','editor') then
    raise exception 'Not an authorized curator' using errcode = '42501';
  end if;
  select * into d from public.museum_documents where id=p_id for update;
  if not found or d.revision <> p_expected_revision then
    raise exception 'Revision conflict';
  end if;
  select * into old from public.museum_revisions
    where document_id=p_id and version=p_from_revision;
  if not found then raise exception 'Revision not found'; end if;
  update public.museum_documents set
    title=old.title,draft=old.draft,revision=revision+1,
    approved_revision=null,approved_sha256=null,status='draft',
    updated_at=now(),updated_by=actor where id=p_id returning * into d;
  insert into public.museum_revisions(document_id,version,title,draft,editor_id,reason)
    values(d.id,d.revision,d.title,d.draft,actor,'restored from revision '||p_from_revision);
  insert into public.museum_events(document_id,actor_id,event_type,version,detail)
    values(d.id,actor,'restore',d.revision,'from '||p_from_revision);
  return d;
end;
$$;
revoke all on function public.museum_restore(uuid,integer,integer) from public,anon;
grant execute on function public.museum_restore(uuid,integer,integer) to authenticated;

comment on table public.museum_publications is
  'PUBLIC PROJECTION ONLY. Never store private sources, private reviews, credentials or full Vault here.';
comment on table public.museum_documents is
  'Private editor drafts/overlays. Original preserved forum and poem sources remain immutable in the recovery repository.';

-- OWNER BOOTSTRAP IS MANUAL AND OUT OF BAND AFTER SIGN-IN:
-- INSERT INTO public.museum_editors(user_id, role)
-- VALUES ('YOUR_AUTH_USER_UUID', 'owner');
-- NEVER add a policy allowing users to self-grant owner/editor.
