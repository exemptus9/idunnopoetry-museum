-- DISPOSABLE TEST DATABASE ONLY. This script must never run against production.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
grant usage on schema extensions to authenticated;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated;
grant execute on function auth.uid() to anon,authenticated;
create table public.museum_editors(user_id uuid primary key,role text);
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.museum_editors values('11111111-1111-4111-8111-111111111111','owner');
\ir canon.sql
set role authenticated;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
do $$begin
 begin perform public.canon_rpc('library','{}');raise exception 'outsider accepted';exception when insufficient_privilege then null;end;
end$$;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
do $$
declare a jsonb; args jsonb; snap jsonb; w jsonb; h text; content text:=E'Exact “quoted” text\r\n\r\nFinal word'; n int;
begin
 h:=encode(extensions.digest(convert_to(content,'UTF8'),'sha256'),'hex');
 args:=jsonb_build_object('confirmation','IMPORT PRIVATELY','works',jsonb_build_array(jsonb_build_object('work_id','legacy-01','title','Exact Work','selected_witness_id','witness-01','versions',jsonb_build_array(jsonb_build_object('witness_id','witness-01','text',content,'sha256',h)),'placements',jsonb_build_array(jsonb_build_object('book','brandonmeant','position',1)),'public_export_approved',true)));
 a:=public.canon_rpc('import',args);if (a->>'works_added')::int<>1 then raise exception 'import failed';end if;
 a:=public.canon_rpc('import',args);if (a->>'works_added')::int<>0 or (a->>'versions_added')::int<>0 then raise exception 'not idempotent';end if;
 a:=public.canon_rpc('library','{}');if a->0->>'sha256'<>h or a->0->>'confirmed_revision' is not null then raise exception 'import changed authority';end if;
 begin perform public.canon_rpc('release',jsonb_build_object('work_id','legacy-01','expected_seq',1,'revision',1,'sha256',h,'confirmation','PUBLISH CANONICAL VERSION','destinations',jsonb_build_array('museum')));raise exception 'unconfirmed publication accepted';exception when raise_exception then if sqlerrm='unconfirmed publication accepted' then raise;end if;end;
 a:=public.canon_rpc('confirm',jsonb_build_object('work_id','legacy-01','expected_seq',1,'revision',1,'sha256',h,'confirmation','USE THIS EXACT TEXT','author_label','Synthetic Author'));
 a:=public.canon_rpc('release',jsonb_build_object('work_id','legacy-01','expected_seq',2,'revision',1,'sha256',h,'confirmation','PUBLISH CANONICAL VERSION','destinations',jsonb_build_array('museum','rhymemosaic')));
 if jsonb_array_length(public.canon_feed('museum')->'works')<>1 then raise exception 'feed not published';end if;
 if public.canon_feed('museum')->'works'->0->>'body'<>content then raise exception 'public bytes changed';end if;
 a:=public.canon_rpc('save',jsonb_build_object('work_id','legacy-01','expected_seq',3,'title','New title','text','Private new text','sha256',encode(extensions.digest(convert_to('Private new text','UTF8'),'sha256'),'hex')));
 if public.canon_feed('museum')->'works'->0->>'body'<>content then raise exception 'draft leaked';end if;
 begin perform public.canon_rpc('save',jsonb_build_object('work_id','legacy-01','expected_seq',3,'title','Stale title','text','Private new text','sha256',encode(extensions.digest(convert_to('Private new text','UTF8'),'sha256'),'hex')));raise exception 'stale update accepted';exception when serialization_failure then null;end;
 a:=public.canon_rpc('book','{"book":"brandonmeant"}');if a->'items'->0->>'text'<>content then raise exception 'book does not use canon';end if;
 snap:=public.canon_rpc('backup','{}');if jsonb_array_length(snap->'versions')<>2 then raise exception 'backup lost history';end if;
 begin perform public.canon_rpc('restore',jsonb_build_object('confirmation','RESTORE INTO EMPTY CANON','snapshot',snap));raise exception 'nonempty restore allowed';exception when raise_exception then if sqlerrm='nonempty restore allowed' then raise;end if;end;
 a:=public.canon_rpc('withdraw','{"work_id":"legacy-01","expected_seq":4,"confirmation":"WITHDRAW SELECTED DESTINATIONS","destinations":["museum"]}');
 if public.canon_feed('museum')->'works'->0->>'body' is not null then raise exception 'withdrawal leaked text';end if;
 if public.canon_feed('rhymemosaic')->'works'->0->>'body'<>content then raise exception 'withdraw changed another target';end if;
 begin execute 'select * from canon_private.works';raise exception 'direct table read allowed';exception when insufficient_privilege then null;end;
 begin execute 'update public.canon_publications set state=''published''';raise exception 'direct publication write allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
-- Recover the synthetic snapshot into an empty store, then undo this entire rehearsal.
begin;
create temp table recovery as select canon_private.engine('backup','{}') as data;
delete from public.canon_publications;
delete from canon_private.events;
delete from canon_private.redirects;
delete from canon_private.placements;
update canon_private.works set selected_revision=null,confirmed_revision=null;
delete from canon_private.versions;
delete from canon_private.works;
select canon_private.engine('restore',jsonb_build_object('confirmation','RESTORE INTO EMPTY CANON','snapshot',data)) from recovery;
do $$begin
 if (select count(*) from canon_private.works)<>1 or (select count(*) from canon_private.versions)<>2 or exists(select 1 from public.canon_publications) or exists(select 1 from canon_private.works where confirmed_revision is not null) then raise exception 'recovery scope or permission replay failed';end if;
end$$;
rollback;
set role anon;
do $$begin
 perform public.canon_feed('rhymemosaic');
 begin perform public.canon_rpc('backup','{}');raise exception 'anonymous backup accepted';exception when insufficient_privilege then null;end;
 begin execute 'select * from canon_private.versions';raise exception 'anonymous private read';exception when insufficient_privilege then null;end;
end$$;
reset role;
select 'PASS: exact import, idempotency, privacy, canonical selection, destination release, stale-write refusal, draft isolation, book projection, full-scope recovery and no permission replay' result;
