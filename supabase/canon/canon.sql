-- Universal Writing Canon v1. Additive; no historic Museum or external site writes.
create schema if not exists canon_private;
revoke all on schema canon_private from public,anon;
grant usage on schema canon_private to authenticated;
create table canon_private.works (
 work_id text primary key check(work_id ~ '^[A-Za-z0-9_-]{1,120}$'),
 title text not null check(length(title) between 1 and 240),
 kind text not null default 'poem', classification text not null default 'working',
 source jsonb not null default '{}' check(jsonb_typeof(source)='object'), holds jsonb not null default '[]' check(jsonb_typeof(holds)='array'),
 selected_revision int, confirmed_revision int, author_label text,
 seq int not null default 0, updated_at timestamptz not null default now()
);
create table canon_private.versions (
 work_id text not null references canon_private.works(work_id), revision int not null check(revision>0),
 witness_id text not null, title text not null check(length(title) between 1 and 240),
 body text not null check(octet_length(body)<=1048576), sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 source jsonb not null default '{}', actor uuid, created_at timestamptz not null default now(),
 primary key(work_id,revision), unique(work_id,witness_id)
);
alter table canon_private.works add constraint selected_version_fk
 foreign key(work_id,selected_revision) references canon_private.versions(work_id,revision) deferrable initially deferred;
alter table canon_private.works add constraint confirmed_version_fk
 foreign key(work_id,confirmed_revision) references canon_private.versions(work_id,revision) deferrable initially deferred;
create table canon_private.placements (
 book text not null check(book in ('brandonmeant','wreckage')), position int not null check(position between 1 and 10000),
 work_id text not null references canon_private.works(work_id), source jsonb not null default '{}',
 primary key(book,position)
);
create table canon_private.events (
 id bigint generated always as identity primary key, work_id text references canon_private.works(work_id),
 action text not null, detail jsonb not null default '{}', actor uuid, at timestamptz not null default now()
);
create table canon_private.redirects (
 old_id text primary key check(old_id ~ '^[A-Za-z0-9_-]{1,120}$'), work_id text not null references canon_private.works(work_id), source jsonb not null default '{}', check(old_id<>work_id)
);
create table public.canon_publications (
 destination text not null check(destination in ('museum','rhymemosaic','brandonmeant','wreckage')),
 work_id text not null, revision int, title text, body text, sha256 text, author_label text,
 state text not null check(state in ('published','withdrawn')), published_at timestamptz not null default now(),
 primary key(destination,work_id)
);
-- No browser role may write tables directly. Mutations must pass exact-revision RPC gates.
revoke all on all tables in schema canon_private from public,anon,authenticated;
revoke all on all sequences in schema canon_private from public,anon,authenticated;
revoke all on public.canon_publications from public,anon,authenticated;
alter table public.canon_publications enable row level security;
grant select on public.canon_publications to anon,authenticated;
create policy canonical_public_only on public.canon_publications for select to anon,authenticated using(true);
alter table canon_private.works enable row level security;
alter table canon_private.versions enable row level security;
alter table canon_private.placements enable row level security;
alter table canon_private.events enable row level security;
alter table canon_private.redirects enable row level security;

create function canon_private.sha(p_text text) returns text language sql immutable set search_path='' as $$
 select encode(extensions.digest(convert_to(p_text,'UTF8'),'sha256'),'hex')
$$;
revoke all on function canon_private.sha(text) from public,anon,authenticated;

create function canon_private.engine(p_action text,p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); w canon_private.works%rowtype; v canon_private.versions%rowtype;
 item jsonb; witness jsonb; placement jsonb; red jsonb; work_key text; wid text; b text; h text;
 n int; rev int; chosen int; added int:=0; version_count int:=0; destinations text[]; dest text;
 result jsonb; snapshot jsonb; before_seq int;
begin
 if actor is null or not exists(select 1 from public.museum_editors e where e.user_id=actor and e.role='owner') then
  raise exception 'Owner authorization required' using errcode='42501';
 end if;
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>8388608 then raise exception 'Invalid or oversized request'; end if;
 if p_action='restore' then
  if p->>'confirmation' is distinct from 'RESTORE INTO EMPTY CANON' or exists(select 1 from canon_private.works) then raise exception 'Recovery requires an empty canon and explicit confirmation'; end if;
  snapshot:=p->'snapshot';
  if exists(select 1 from public.canon_publications) then raise exception 'Recovery target still has publication snapshots; use a genuinely empty recovery environment';end if;
  if snapshot->>'format' is distinct from 'UniversalWritingCanonSnapshot/1' or jsonb_typeof(snapshot->'works') is distinct from 'array' or jsonb_typeof(snapshot->'versions') is distinct from 'array' or jsonb_array_length(snapshot->'works')>5000 or jsonb_array_length(snapshot->'versions')>50000 then raise exception 'Invalid canonical recovery scope'; end if;
  for item in select value from jsonb_array_elements(snapshot->'works') loop
   insert into canon_private.works(work_id,title,kind,classification,source,holds)
    values(item->>'work_id',item->>'title',coalesce(item->>'kind','poem'),coalesce(item->>'classification','working'),coalesce(item->'source','{}'),coalesce(item->'holds','[]'));
  end loop;
  for item in select value from jsonb_array_elements(snapshot->'versions') loop
   if item->>'body' is null or item->>'sha256' is distinct from canon_private.sha(item->>'body') then raise exception 'Recovery witness checksum mismatch'; end if;
   insert into canon_private.versions(work_id,revision,witness_id,title,body,sha256,source,actor,created_at)
    values(item->>'work_id',(item->>'revision')::int,item->>'witness_id',item->>'title',item->>'body',item->>'sha256',coalesce(item->'source','{}'),actor,coalesce((item->>'created_at')::timestamptz,now()));
  end loop;
  if exists(select 1 from canon_private.versions group by work_id having count(*)<>max(revision)) then raise exception 'Recovery history has missing revisions';end if;
  for item in select value from jsonb_array_elements(snapshot->'works') loop
   update canon_private.works set selected_revision=(item->>'selected_revision')::int,confirmed_revision=null,seq=1 where work_id=item->>'work_id';
  end loop;
  for item in select value from jsonb_array_elements(coalesce(snapshot->'placements','[]')) loop
   insert into canon_private.placements(book,position,work_id,source) values(item->>'book',(item->>'position')::int,item->>'work_id',coalesce(item->'source','{}'));
  end loop;
  for item in select value from jsonb_array_elements(coalesce(snapshot->'redirects','[]')) loop
   if exists(select 1 from canon_private.works where work_id=item->>'old_id') then raise exception 'Recovery redirect collides with a primary identity';end if;
   insert into canon_private.redirects(old_id,work_id,source) values(item->>'old_id',item->>'work_id',coalesce(item->'source','{}'));
  end loop;
  -- Preserve the complete old audit/release evidence privately without replaying permissions.
  insert into canon_private.events(action,detail,actor) values('restored_private_snapshot',snapshot,actor);
  return jsonb_build_object('restored_works',(select count(*) from canon_private.works),'restored_versions',(select count(*) from canon_private.versions),'permissions_replayed',false,'published',0);
 elsif p_action='status' then
  return jsonb_build_object('works',(select count(*) from canon_private.works),
   'selected',(select count(*) from canon_private.works where selected_revision is not null),
   'confirmed',(select count(*) from canon_private.works where confirmed_revision=selected_revision),
   'versions',(select count(*) from canon_private.versions),
   'publications',(select count(*) from public.canon_publications where state='published'),
   'placements',(select count(*) from canon_private.placements),'schema','UniversalWritingCanon/1');
 elsif p_action='library' then
  return coalesce((select jsonb_agg(row_to_json(t) order by t.title,t.work_id) from (
   select x.work_id,coalesce(vv.title,x.title) title,x.kind,x.classification,x.selected_revision,x.confirmed_revision,
    x.author_label,x.holds,x.seq,x.updated_at,vv.sha256,
    (select max(revision) from canon_private.versions where work_id=x.work_id) latest_revision,
    (select coalesce(jsonb_agg(jsonb_build_object('book',s.book,'position',s.position)),'[]') from canon_private.placements s where s.work_id=x.work_id) placements,
    (select coalesce(jsonb_agg(jsonb_build_object('destination',a.destination,'revision',a.revision,'state',a.state,'current',a.revision=x.selected_revision)),'[]') from public.canon_publications a where a.work_id=x.work_id) outputs
   from canon_private.works x left join canon_private.versions vv on vv.work_id=x.work_id and vv.revision=x.selected_revision
   order by coalesce(vv.title,x.title),x.work_id limit 5000
  ) t),'[]');
 elsif p_action='new' then
  work_key:=p->>'work_id';b:=p->>'text';h:=p->>'sha256';
  if work_key is null or work_key !~ '^writing-[0-9a-f-]{36}$' or b is null or length(b)=0 or h is distinct from canon_private.sha(b) or length(coalesce(p->>'title','')) not between 1 and 240 then raise exception 'Invalid new writing'; end if;
  insert into canon_private.works(work_id,title,kind,classification,source,selected_revision,seq) values(work_key,p->>'title',coalesce(p->>'kind','poem'),'working','{"created_in":"universal_canon"}',1,1);
  insert into canon_private.versions(work_id,revision,witness_id,title,body,sha256,source,actor) values(work_key,1,'new-'||work_key,p->>'title',b,h,'{"origin":"owner_created"}',actor);
  insert into canon_private.events(work_id,action,detail,actor) values(work_key,'new_private_work',jsonb_build_object('revision',1,'sha256',h),actor);
  return jsonb_build_object('work_id',work_key,'revision',1,'seq',1,'published',false);
 elsif p_action='import' then
  if p->>'confirmation' is distinct from 'IMPORT PRIVATELY' or jsonb_typeof(p->'works') is distinct from 'array' or jsonb_array_length(p->'works')>50 then
   raise exception 'Private import confirmation and at most 50 works required'; end if;
  for item in select value from jsonb_array_elements(p->'works') loop
   work_key:=item->>'work_id';
   if work_key is null or work_key !~ '^[A-Za-z0-9_-]{1,120}$' or length(coalesce(item->>'title','')) not between 1 and 240 then raise exception 'Invalid stable identity'; end if;
   if jsonb_typeof(coalesce(item->'source','{}'))<>'object' or jsonb_typeof(coalesce(item->'holds','[]'))<>'array' then raise exception 'Invalid provenance'; end if;
   insert into canon_private.works(work_id,title,kind,classification,source,holds)
    values(work_key,item->>'title',coalesce(item->>'kind','poem'),coalesce(item->>'classification','working'),coalesce(item->'source','{}'),coalesce(item->'holds','[]'))
    on conflict(work_id) do nothing;
   get diagnostics n=row_count; added:=added+n;
   select * into w from canon_private.works where work_id=work_key for update;
   chosen:=null;
   for witness in select value from jsonb_array_elements(coalesce(item->'versions','[]')) loop
    wid:=witness->>'witness_id'; b:=witness->>'text'; h:=witness->>'sha256';
    if wid is null or length(wid) not between 1 and 200 or b is null or octet_length(b)>1048576 or h is null or h<>canon_private.sha(b) then
     raise exception 'Exact-text hash mismatch or invalid witness for %',work_key; end if;
    select * into v from canon_private.versions where work_id=work_key and witness_id=wid;
    if found then
     if v.body<>b or v.sha256<>h or v.title<>coalesce(witness->>'title',item->>'title') then raise exception 'Immutable witness conflict for %',work_key; end if;
     rev:=v.revision;
    else
     select coalesce(max(revision),0)+1 into rev from canon_private.versions where work_id=work_key;
     insert into canon_private.versions(work_id,revision,witness_id,title,body,sha256,source,actor)
      values(work_key,rev,wid,coalesce(witness->>'title',item->>'title'),b,h,coalesce(witness->'source','{}'),actor);
     version_count:=version_count+1;
    end if;
    if wid=item->>'selected_witness_id' then chosen:=rev; end if;
   end loop;
   -- Imported approval flags are never used. Existing selections are never replaced by import.
   if w.selected_revision is null and chosen is not null then
    update canon_private.works set selected_revision=chosen,seq=seq+1,updated_at=now() where work_id=work_key;
   end if;
   for placement in select value from jsonb_array_elements(coalesce(item->'placements','[]')) loop
    if placement->>'book' not in ('brandonmeant','wreckage') then raise exception 'Unknown book'; end if;
    insert into canon_private.placements(book,position,work_id,source) values(placement->>'book',(placement->>'position')::int,work_key,coalesce(placement->'source','{}')) on conflict do nothing;
    if not exists(select 1 from canon_private.placements where book=placement->>'book' and position=(placement->>'position')::int and work_id=work_key) then raise exception 'Book slot conflict'; end if;
   end loop;
  end loop;
  insert into canon_private.events(action,detail,actor) values('private_import',jsonb_build_object('source_hash',p->>'source_hash','works_added',added,'versions_added',version_count,'permission_imported',false),actor);
  return jsonb_build_object('works_added',added,'versions_added',version_count,'published',0);
 elsif p_action='redirects' then
  for red in select value from jsonb_array_elements(p->'items') loop
   if exists(select 1 from canon_private.works where work_id=red->>'old_id') then raise exception 'A primary work cannot become a redirect'; end if;
   insert into canon_private.redirects(old_id,work_id,source) values(red->>'old_id',red->>'work_id',coalesce(red->'source','{}')) on conflict do nothing;
   if not exists(select 1 from canon_private.redirects where old_id=red->>'old_id' and work_id=red->>'work_id') then raise exception 'Identity redirect conflict'; end if;
  end loop;
  return jsonb_build_object('redirects',(select count(*) from canon_private.redirects));
 elsif p_action='backup' then
  -- One database statement snapshot, including all canonical version bodies and private provenance.
  return jsonb_build_object('format','UniversalWritingCanonSnapshot/1','captured_at',now(),
   'scope','canonical works, versions, placements, redirects, audit events and release snapshots; excludes Auth and historic Museum tables',
   'works',coalesce((select jsonb_agg(to_jsonb(x) order by work_id) from canon_private.works x),'[]'),
   'versions',coalesce((select jsonb_agg(to_jsonb(x) order by work_id,revision) from canon_private.versions x),'[]'),
   'placements',coalesce((select jsonb_agg(to_jsonb(x) order by book,position) from canon_private.placements x),'[]'),
   'redirects',coalesce((select jsonb_agg(to_jsonb(x) order by old_id) from canon_private.redirects x),'[]'),
   'events',coalesce((select jsonb_agg(to_jsonb(x) order by x.id) from canon_private.events x),'[]'),
   'publications',coalesce((select jsonb_agg(to_jsonb(x) order by destination,work_id) from public.canon_publications x),'[]'));
 elsif p_action='book' then
  dest:=p->>'book'; if dest is null or dest not in ('brandonmeant','wreckage') then raise exception 'Choose a book'; end if;
  select count(*) into n from canon_private.placements where book=dest;
  if n=0 or exists(select 1 from generate_series(1,n) a where not exists(select 1 from canon_private.placements s where s.book=dest and s.position=a)) then raise exception 'Book order incomplete; nothing exported'; end if;
  if exists(select 1 from canon_private.placements s join canon_private.works x on x.work_id=s.work_id where s.book=dest and x.selected_revision is null) then raise exception 'Book has missing selected texts; nothing exported'; end if;
  return jsonb_build_object('format','UniversalWritingCanonBook/1','book',dest,'visibility','private_review',
   'items',(select jsonb_agg(jsonb_build_object('position',s.position,'work_id',x.work_id,'revision',v.revision,'title',v.title,'text',v.body,'sha256',v.sha256,'author_confirmed',x.confirmed_revision=v.revision,'holds',x.holds) order by s.position)
    from canon_private.placements s join canon_private.works x on x.work_id=s.work_id join canon_private.versions v on v.work_id=x.work_id and v.revision=x.selected_revision where s.book=dest));
 end if;
 work_key:=p->>'work_id';
 select * into w from canon_private.works where work_id=work_key for update;
 if not found then raise exception 'Work not found'; end if;
 if p_action='work' then
  return jsonb_build_object('work',to_jsonb(w),'versions',coalesce((select jsonb_agg(to_jsonb(x) order by revision desc) from canon_private.versions x where work_id=work_key),'[]'),
   'events',coalesce((select jsonb_agg(to_jsonb(t) order by t.id desc) from (select * from canon_private.events where work_id=work_key order by id desc limit 100) t),'[]'));
 end if;
 if (p->>'expected_seq')::int is distinct from w.seq then raise exception 'This work changed in another session. Refresh and compare; your edits were not applied.' using errcode='40001'; end if;
 before_seq:=w.seq;
 if p_action='save' then
  b:=p->>'text';h:=p->>'sha256';
  if b is null or length(b)=0 or h is null or h<>canon_private.sha(b) or length(coalesce(p->>'title','')) not between 1 and 240 then raise exception 'Invalid exact text or title'; end if;
  select coalesce(max(revision),0)+1 into rev from canon_private.versions where work_id=work_key;
  insert into canon_private.versions(work_id,revision,witness_id,title,body,sha256,source,actor)
   values(work_key,rev,'edit-'||gen_random_uuid()::text,p->>'title',b,h,jsonb_build_object('reason',coalesce(p->>'reason',''),'parent_revision',w.selected_revision),actor);
  update canon_private.works set seq=seq+1,updated_at=now() where work_id=work_key;
  insert into canon_private.events(work_id,action,detail,actor) values(work_key,'private_revision_saved',jsonb_build_object('revision',rev,'sha256',h),actor);
  return jsonb_build_object('revision',rev,'seq',before_seq+1,'canonical_changed',false,'published',false);
 elsif p_action='confirm' then
  select * into v from canon_private.versions where work_id=work_key and revision=(p->>'revision')::int;
  if not found or length(v.body)=0 or v.sha256 is distinct from p->>'sha256' or p->>'confirmation' is distinct from 'USE THIS EXACT TEXT' then raise exception 'Exact revision confirmation required'; end if;
  if w.classification in ('excluded','redirect','external') then raise exception 'This is an excluded or redirected record; it cannot be promoted through the standard review flow'; end if;
  if coalesce(length(trim(p->>'author_label')),0) not between 1 and 200 then raise exception 'Confirm authorship credit'; end if;
  if (jsonb_array_length(w.holds)>0 or v.body ~ E'(^|\\n)[\\t ]*(\\.{3,}|…+)[\\t ]*(\\n|$)' or position(chr(65533) in v.body)>0 or v.body ~* E'(^|\\n)[\\t ]*\\[(verse|chorus|bridge)[^]]*\\]') and coalesce(length(trim(p->>'review_note')),0)<8 then
   raise exception 'Source review is required. Record your resolution before choosing this text'; end if;
  update canon_private.works set selected_revision=v.revision,confirmed_revision=v.revision,title=v.title,author_label=p->>'author_label',seq=seq+1,updated_at=now() where work_id=work_key;
  insert into canon_private.events(work_id,action,detail,actor) values(work_key,'canonical_text_confirmed',jsonb_build_object('revision',v.revision,'sha256',v.sha256,'credit',p->>'author_label','review_note',p->>'review_note','previous_selection',w.selected_revision),actor);
  return jsonb_build_object('selected_revision',v.revision,'seq',before_seq+1,'published',false);
 elsif p_action in ('release','withdraw') then
  select * into v from canon_private.versions where work_id=work_key and revision=w.selected_revision;
  if p_action='release' and (not found or w.confirmed_revision is distinct from w.selected_revision or v.sha256 is distinct from p->>'sha256' or v.revision is distinct from (p->>'revision')::int or p->>'confirmation' is distinct from 'PUBLISH CANONICAL VERSION') then raise exception 'Confirm the exact canonical text first, then explicitly release it'; end if;
  if p_action='withdraw' and p->>'confirmation' is distinct from 'WITHDRAW SELECTED DESTINATIONS' then raise exception 'Withdrawal confirmation required'; end if;
  if jsonb_typeof(p->'destinations') is distinct from 'array' or jsonb_array_length(p->'destinations') not between 1 and 4 then raise exception 'Choose destinations'; end if;
  for dest in select jsonb_array_elements_text(p->'destinations') loop
   if dest is null or dest not in ('museum','rhymemosaic','brandonmeant','wreckage') then raise exception 'Unknown destination'; end if;
   if p_action='release' then
    insert into public.canon_publications(destination,work_id,revision,title,body,sha256,author_label,state)
     values(dest,work_key,v.revision,v.title,v.body,v.sha256,w.author_label,'published')
     on conflict(destination,work_id) do update set revision=excluded.revision,title=excluded.title,body=excluded.body,sha256=excluded.sha256,author_label=excluded.author_label,state='published',published_at=now();
   else
    update public.canon_publications set state='withdrawn',title=null,body=null,sha256=null,author_label=null,revision=null,published_at=now() where destination=dest and work_id=work_key;
   end if;
   insert into canon_private.events(work_id,action,detail,actor) values(work_key,p_action,jsonb_build_object('destination',dest,'revision',v.revision,'sha256',v.sha256),actor);
  end loop;
  update canon_private.works set seq=seq+1,updated_at=now() where work_id=work_key;
  return jsonb_build_object('seq',before_seq+1,'action',p_action,'destinations',p->'destinations','external_sites_written',false);
 end if;
 raise exception 'Unsupported canonical operation';
end $$;
revoke all on function canon_private.engine(text,jsonb) from public,anon;
grant execute on function canon_private.engine(text,jsonb) to authenticated;
create function public.canon_rpc(p_action text,p_args jsonb default '{}') returns jsonb
 language sql security invoker set search_path='' as $$ select canon_private.engine(p_action,p_args) $$;
revoke all on function public.canon_rpc(text,jsonb) from public,anon;
grant execute on function public.canon_rpc(text,jsonb) to authenticated;
create function public.canon_feed(p_destination text) returns jsonb
 language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('format','UniversalWritingCanonPublic/1','destination',p_destination,
 'works',coalesce(jsonb_agg(to_jsonb(c) order by c.title,c.work_id),'[]'))
 from public.canon_publications c where c.destination=p_destination
$$;
revoke all on function public.canon_feed(text) from public;
grant execute on function public.canon_feed(text) to anon,authenticated;
comment on schema canon_private is 'Author-owned universal writing canon. Same inherited work IDs; imported evidence is not permission. No direct public access.';
