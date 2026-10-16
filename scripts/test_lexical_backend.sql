\set ON_ERROR_STOP on
-- DESTRUCTIVE TEST HARNESS: use a disposable PostgreSQL 16 database only.
-- This creates synthetic schema/data. Never run against production Supabase.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
\ir fixtures/word_archive_schema.sql

-- Synthetic legacy rows deliberately model the unsafe historical defaults.
INSERT INTO public.terms(id,slug,term,short_definition,stage,visibility,raw_notes,coined_at,updated_at)
VALUES('00000000-0000-4000-8000-000000000010','fixture-legacy','Fixture Legacy','Legacy wording','canon','public',
  'PRIVATE_BASELINE_SENTINEL','2026-01-01','2020-01-01T00:00:00Z');
INSERT INTO public.source_witnesses(term_id,title,excerpt,occurred_at)
VALUES('00000000-0000-4000-8000-000000000010','Private witness','PRIVATE_WITNESS_SENTINEL','2026-01-01');
\ir ../supabase/migrations/20261016_lexical_observatory.sql

BEGIN;
CREATE FUNCTION public.test_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; END $$;
INSERT INTO public.user_roles(user_id,role) VALUES
 ('00000000-0000-4000-8000-000000000001','admin'),('00000000-0000-4000-8000-000000000002','viewer');
SELECT public.test_assert((SELECT updated_at='2020-01-01T00:00:00Z'::timestamptz FROM public.terms WHERE slug='fixture-legacy'),'migration preserves original modification date');
SELECT public.test_assert((SELECT raw_notes='PRIVATE_BASELINE_SENTINEL' AND coined_at='2026-01-01'::date FROM public.terms WHERE slug='fixture-legacy'),'legacy originals preserved without inventing approval');
SELECT public.test_assert((SELECT count(*)=1 FROM lexical_private.revisions),'baseline revision recorded');

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT public.test_assert(jsonb_array_length(public.lexical_public_snapshot()->'terms')=0,'legacy public flag does not imply publication approval');
DO $$ BEGIN
  BEGIN PERFORM raw_notes FROM public.terms; RAISE EXCEPTION 'FAIL raw terms readable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.terms SET stage='canon'; RAISE EXCEPTION 'FAIL anonymous update'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lexical_capture('Anonymous bad capture'); RAISE EXCEPTION 'FAIL anonymous capture'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lexical_editor_snapshot(); RAISE EXCEPTION 'FAIL anonymous private export'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
  BEGIN PERFORM public.lexical_capture('Viewer bad capture'); RAISE EXCEPTION 'FAIL non-admin capture'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.lexical_editor_snapshot(); RAISE EXCEPTION 'FAIL non-admin export'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.user_roles(user_id,role) VALUES(auth.uid(),'admin'); RAISE EXCEPTION 'FAIL self role escalation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE captured jsonb; duplicate jsonb; BEGIN
  captured:=public.lexical_capture('TEST Lumen','PRIVATE_NEW_SENTINEL');
  PERFORM set_config('test.lexical.term',captured->>'id',true);
  duplicate:=public.lexical_capture('test-lumen','new note must not overwrite');
  PERFORM public.test_assert((duplicate->>'duplicate')::boolean AND duplicate->>'id'=captured->>'id','normalized duplicate returns preserved identity');
  BEGIN
    PERFORM public.lexical_save((captured->>'id')::uuid,1,'{"stage":"canon"}','Unsafe automatic Canon');
    RAISE EXCEPTION 'FAIL Canon without author approval';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.lexical_save((captured->>'id')::uuid,1,
    '{"stage":"lexicon","short_definition":"Definition alpha","authorship":"origin_undetermined"}', 'Develop definition');
  BEGIN
    PERFORM public.lexical_save((captured->>'id')::uuid,2,'{"visibility":"public"}','No publication approval');
    RAISE EXCEPTION 'FAIL publication without approval';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.lexical_save((captured->>'id')::uuid,2,'{"visibility":"public"}', 'Approved public definition',NULL,'PUBLISH TEST Lumen');
END $$;
SELECT public.test_assert(jsonb_array_length(public.lexical_public_snapshot()->'terms')=1,'approved term published');
SELECT public.test_assert(public.lexical_public_snapshot()::text NOT LIKE '%PRIVATE_%','public output omits private notes and witnesses');
SELECT public.test_assert((public.lexical_public_snapshot()->'terms'->0->'earliestVerifiedDate')='null'::jsonb,'imported date never exposed as verified history');
SELECT public.test_assert(public.lexical_public_snapshot()->'terms'->0->'publication'->>'approvedRevision'='3','publication identifies exact revision');
DO $$ DECLARE captured jsonb; BEGIN
  captured:=public.lexical_capture('TEST Shadow','PRIVATE_TARGET_SENTINEL');
  PERFORM set_config('test.lexical.target',captured->>'id',true);
END $$;
DO $$ DECLARE id uuid:=current_setting('test.lexical.target')::uuid; BEGIN
  BEGIN PERFORM public.lexical_save(id,1,'{"term":"!!!"}','Invalid punctuation rename');
    RAISE EXCEPTION 'FAIL empty normalized rename'; EXCEPTION WHEN raise_exception THEN
      IF SQLERRM='FAIL empty normalized rename' THEN RAISE; END IF; END;
  BEGIN PERFORM public.lexical_save(id,1,'{"term":"test-lumen"}','Duplicate rename');
    RAISE EXCEPTION 'FAIL duplicate normalized rename'; EXCEPTION WHEN raise_exception THEN
      IF SQLERRM='FAIL duplicate normalized rename' THEN RAISE; END IF; END;
END $$;
RESET ROLE;

INSERT INTO public.term_relations(id,source_term_id,target_term_id,relation,note)
VALUES('00000000-0000-4000-8000-000000000020',current_setting('test.lexical.term')::uuid,
  current_setting('test.lexical.target')::uuid,'opposition','PRIVATE_RELATION_SENTINEL');
SET LOCAL ROLE authenticated;
SELECT public.lexical_review_relation('00000000-0000-4000-8000-000000000020',true,true,'Approved conceptual contrast','supported');
SELECT public.test_assert(jsonb_array_length(public.lexical_public_snapshot()->'relations')=0,'private target cannot leak through public relationship');
SELECT public.lexical_save(current_setting('test.lexical.target')::uuid,1,'{"visibility":"public"}', 'Approve target',NULL,'PUBLISH TEST Shadow');
SELECT public.test_assert(jsonb_array_length(public.lexical_public_snapshot()->'relations')=1,'reviewed relation visible only when both endpoints public');
SELECT public.test_assert(public.lexical_public_snapshot()::text NOT LIKE '%PRIVATE_RELATION_SENTINEL%','only separately approved relation note exposed');

DO $$ DECLARE id uuid:=current_setting('test.lexical.term')::uuid; snap jsonb; BEGIN
  BEGIN
    PERFORM public.lexical_save(id,3,'{"stage":"canon"}','Wrong typed confirmation','APPROVE CANON wrong');
    RAISE EXCEPTION 'FAIL wrong Canon confirmation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.lexical_save(id,3,'{"stage":"canon"}','Explicit Canon decision','APPROVE CANON TEST Lumen','PUBLISH TEST Lumen');
  SELECT value INTO snap FROM jsonb_array_elements(public.lexical_public_snapshot()->'terms') WHERE value->>'id'=id::text;
  PERFORM public.test_assert(snap->'canonApproval'->>'revision'=snap->>'revision','Canon metadata approves current exact revision');
  PERFORM public.test_assert(NOT (snap->'canonApproval' ? 'actor_id'),'public Canon metadata omits private actor UUID');
  BEGIN
    PERFORM public.lexical_save(id,4,'{"short_definition":"Unapproved Canon change"}','Canonical wording edit');
    RAISE EXCEPTION 'FAIL canonical wording without reapproval'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.lexical_save(id,4,'{"term":"TEST Renamed"}','Canonical headword rename');
    RAISE EXCEPTION 'FAIL canonical rename without reapproval'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.lexical_save(id,3,'{"stage":"forge"}','Stale edit');
    RAISE EXCEPTION 'FAIL optimistic concurrency'; EXCEPTION WHEN serialization_failure THEN NULL; END;
  -- Unpublished edits leave the last approved wording available, never replacing it silently.
  PERFORM public.lexical_save(id,4,'{"stage":"lexicon","short_definition":"Unpublished beta"}','Draft meaning exploration');
  SELECT value INTO snap FROM jsonb_array_elements(public.lexical_public_snapshot()->'terms') WHERE value->>'id'=id::text;
  PERFORM public.test_assert(snap->>'definition'='Definition alpha' AND snap->>'revision'='4','public snapshot remains approved wording');
  PERFORM public.lexical_restore(id,1,5,'Recover original capture');
  PERFORM public.test_assert(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.lexical_public_snapshot()->'terms') t WHERE t->>'id'=id::text),'restore produces private Forge revision');
  PERFORM public.test_assert(EXISTS(SELECT 1 FROM jsonb_array_elements(public.lexical_editor_snapshot()->'revisions') r WHERE r->>'term_id'=id::text AND r->>'revision'='1'),'original revision retained after restore');
  BEGIN UPDATE lexical_private.revisions SET reason='tampered'; RAISE EXCEPTION 'FAIL editor audit mutation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

DO $$ DECLARE payload jsonb; preview jsonb; first_result jsonb; again jsonb; job uuid; BEGIN
  payload:='{"sourceSystem":"synthetic-recovery-test","terms":[{"sourceId":"source-1","headword":"TEST Import","definition":"Private draft definition","stage":"canon","visibility":"public"},{"sourceId":"source-2","headword":"test-import","definition":"Conflicting wording"}]}'::jsonb;
  preview:=public.lexical_import_preview(payload);
  PERFORM public.test_assert(preview->'items'->1->>'action'='duplicate_in_file','dry run flags normalized file duplicates');
  BEGIN PERFORM public.lexical_import(payload,'wrong-token'); RAISE EXCEPTION 'FAIL stale import token'; EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='FAIL stale import token' THEN RAISE; END IF; END;
  first_result:=public.lexical_import(payload,preview->>'previewToken');job:=(first_result->>'jobId')::uuid;
  PERFORM public.test_assert(first_result->>'created'='1','one private entry imported');
  preview:=public.lexical_import_preview(payload);again:=public.lexical_import(payload,preview->>'previewToken');
  PERFORM public.test_assert(again->>'created'='0','repeated import idempotent');
  payload:=jsonb_set(payload,'{terms}', '[{"sourceId":"source-1","headword":"TEST Import renamed externally","definition":"Must preserve approved/local wording"}]');
  preview:=public.lexical_import_preview(payload);again:=public.lexical_import(payload,preview->>'previewToken');
  PERFORM public.test_assert(again->>'created'='0','stable source ID survives external rename without duplicate');
  PERFORM public.test_assert(EXISTS(SELECT 1 FROM jsonb_array_elements(public.lexical_editor_snapshot()->'terms') t
    WHERE t->>'term'='TEST Import' AND t->>'stage'='forge' AND t->>'visibility'='private'
    AND t->>'short_definition'='Private draft definition' AND t->'coined_at'='null'::jsonb),'import cannot grant Canon/public or overwrite local wording');
  again:=public.lexical_rollback_import(job,'Test reversible import recovery');
  PERFORM public.test_assert(again->>'archived'='1','import recovery archives originals');
END $$;
DO $$ DECLARE payload jsonb; preview jsonb; result jsonb; BEGIN
  payload:=jsonb_build_object('sourceSystem','large-row-test','terms',jsonb_build_array(
    jsonb_build_object('sourceId','large-row','headword','TEST Large Import','definition',repeat('x',21000))));
  preview:=public.lexical_import_preview(payload);
  result:=public.lexical_import(payload,preview->>'previewToken');
  PERFORM public.test_assert(result->>'created'='1','preview and commit agree for a row larger than the capture-note limit');
  -- A different record inserted after dry-run changes the reviewed plan.
  payload:='{"sourceSystem":"stale-plan-test","terms":[{"headword":"TEST Plan Change"}]}'::jsonb;
  preview:=public.lexical_import_preview(payload);
  PERFORM public.lexical_capture('TEST Plan Change');
  BEGIN PERFORM public.lexical_import(payload,preview->>'previewToken');
    RAISE EXCEPTION 'FAIL stale import plan accepted'; EXCEPTION WHEN raise_exception THEN
      IF SQLERRM='FAIL stale import plan accepted' THEN RAISE; END IF; END;
END $$;
RESET ROLE;

-- Verify the append-only hash chain independently as the disposable DB owner.
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM lexical_private.revisions r WHERE r.entry_hash<>
  encode(sha256(convert_to(coalesce(r.previous_hash,'')||r.snapshot::text||coalesce(r.actor_id::text,'')||r.reason||r.recorded_at::text,'UTF8')),'hex')),'revision content hashes match');
SELECT public.test_assert(NOT EXISTS(SELECT 1 FROM (SELECT term_id,revision,previous_hash,
  lag(entry_hash) OVER(PARTITION BY term_id ORDER BY revision) expected FROM lexical_private.revisions) chain
  WHERE chain.previous_hash IS DISTINCT FROM chain.expected),'revision hash chain contiguous');
SELECT public.test_assert((SELECT count(*)>=5 FROM lexical_private.lifecycle_events WHERE actor_id='00000000-0000-4000-8000-000000000001'),'lifecycle records authenticated actor');
SELECT public.test_assert((SELECT count(*)=1 FROM lexical_private.lifecycle_events WHERE explicit_canon_confirmation),'one explicit Canon decision recorded');
SELECT 'PASS: lexical backend role, privacy, lifecycle, revisions, publication, import and recovery assertions' AS result;
ROLLBACK;
