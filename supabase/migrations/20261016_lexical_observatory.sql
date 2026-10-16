-- Recovery hardening for EXISTING Word Archive qocuyqvjjcgazloahhvc.
-- Prepared against its two 20260930 migrations. NOT APPLIED to production.
-- Reconcile with any newer Lovable migrations before applying. No term is seeded.
-- Existing private originals, UUIDs, definitions and legacy histories are preserved.
BEGIN;

DO $$ BEGIN
  IF to_regclass('public.terms') IS NULL OR to_regclass('public.user_roles') IS NULL THEN
    RAISE EXCEPTION 'Existing Word Archive schema is required; do not create another database';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS lexical_private;
REVOKE ALL ON SCHEMA lexical_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA lexical_private TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA lexical_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS normalized_key text,
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'unprocessed_capture',
  ADD COLUMN IF NOT EXISTS variants text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS authorship text NOT NULL DEFAULT 'origin_undetermined',
  ADD COLUMN IF NOT EXISTS evidence_strength text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS pronunciation_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS canon_approved_by uuid,
  ADD COLUMN IF NOT EXISTS canon_approved_at timestamptz;

CREATE OR REPLACE FUNCTION lexical_private.term_key(v text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT regexp_replace(lower(translate(trim(v),
    'ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑñÇç’‑–—',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc----')),
    '[[:space:][:punct:]]', '', 'g');
$$;
ALTER TABLE public.terms DISABLE TRIGGER terms_updated_at;
UPDATE public.terms SET normalized_key = lexical_private.term_key(term) WHERE normalized_key IS NULL;
ALTER TABLE public.terms ENABLE TRIGGER terms_updated_at;
CREATE INDEX IF NOT EXISTS terms_normalized_key_idx ON public.terms(normalized_key);
ALTER TABLE public.terms ALTER COLUMN provenance_status SET DEFAULT 'uncertain';
ALTER TABLE public.user_roles ALTER COLUMN role SET DEFAULT 'viewer';

ALTER TABLE public.source_witnesses
  ADD COLUMN IF NOT EXISTS approved_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS evidence_strength text NOT NULL DEFAULT 'unknown';
ALTER TABLE public.external_attestations
  ADD COLUMN IF NOT EXISTS approved_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS evidence_strength text NOT NULL DEFAULT 'unknown';
ALTER TABLE public.term_relations
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS evidence_strength text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS approved_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_note text;

-- RLS remains enabled as defense in depth. Client roles get NO raw tables.
-- This closes SELECT * / raw_notes and inherited private source/history leaks.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['terms','term_definition_versions','term_events','term_roots',
    'term_relations','source_witnesses','external_attestations','domains','tags','term_domains','term_tags'] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  END LOOP;
END $$;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.user_roles FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS lexical_private.revisions (
  term_id uuid NOT NULL REFERENCES public.terms(id),
  revision bigint NOT NULL,
  snapshot jsonb NOT NULL,
  actor_id uuid,
  reason text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  previous_hash text,
  entry_hash text NOT NULL,
  PRIMARY KEY(term_id,revision)
);
CREATE TABLE IF NOT EXISTS lexical_private.lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), term_id uuid NOT NULL REFERENCES public.terms(id),
  revision bigint NOT NULL, actor_id uuid NOT NULL, from_stage public.term_stage,
  to_stage public.term_stage NOT NULL, reason text NOT NULL,
  explicit_canon_confirmation boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS lexical_private.publications (
  term_id uuid PRIMARY KEY REFERENCES public.terms(id), revision bigint NOT NULL,
  payload jsonb NOT NULL, approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT clock_timestamp(), revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS lexical_private.publication_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), term_id uuid NOT NULL REFERENCES public.terms(id),
  revision bigint NOT NULL, definition text, stage public.term_stage NOT NULL,
  approved_by uuid NOT NULL, approved_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS lexical_private.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL,
  source_system text NOT NULL, original_payload jsonb NOT NULL,
  preview_token text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  rolled_back_at timestamptz
);
CREATE TABLE IF NOT EXISTS lexical_private.import_items (
  source_system text NOT NULL, external_id text NOT NULL,
  term_id uuid NOT NULL REFERENCES public.terms(id), job_id uuid NOT NULL REFERENCES lexical_private.import_jobs(id),
  created_term boolean NOT NULL, PRIMARY KEY(source_system,external_id)
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['revisions','lifecycle_events','publications','publication_versions','import_jobs','import_items'] LOOP
    EXECUTE format('ALTER TABLE lexical_private.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE lexical_private.%I FROM PUBLIC, anon, authenticated',t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION lexical_private.require_admin()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=actor AND r.role='admin') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='An explicitly provisioned author/admin role is required';
  END IF;
  RETURN actor;
END $$;

CREATE OR REPLACE FUNCTION lexical_private.record_revision(p_term uuid,p_actor uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s jsonb; n bigint; prior text; stamp timestamptz := clock_timestamp(); BEGIN
  SELECT to_jsonb(t),t.revision INTO STRICT s,n FROM public.terms t WHERE t.id=p_term;
  SELECT r.entry_hash INTO prior FROM lexical_private.revisions r WHERE r.term_id=p_term ORDER BY r.revision DESC LIMIT 1;
  INSERT INTO lexical_private.revisions(term_id,revision,snapshot,actor_id,reason,recorded_at,previous_hash,entry_hash)
  VALUES(p_term,n,s,p_actor,p_reason,stamp,prior,
    encode(sha256(convert_to(coalesce(prior,'')||s::text||coalesce(p_actor::text,'')||p_reason||stamp::text,'UTF8')),'hex'));
END $$;

-- A baseline snapshot records what was imported NOW, not a fabricated coinage event.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT id FROM public.terms LOOP
    IF NOT EXISTS(SELECT 1 FROM lexical_private.revisions r WHERE r.term_id=t.id) THEN
      PERFORM lexical_private.record_revision(t.id,NULL,'Recovery baseline; source dates and historical approval not inferred');
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION lexical_private.public_payload(p_term uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'id',t.id,'slug',t.slug,'headword',t.term,'term',t.term,
    'definition',coalesce(t.short_definition,t.full_definition,''),'fullDefinition',t.full_definition,
    'stage',t.stage,'visibility','approved_public','formation',t.formation_type,
    'pronunciation',CASE WHEN t.pronunciation_verified THEN t.pronunciation ELSE NULL END,
    'pronunciationVerified',t.pronunciation_verified AND t.pronunciation IS NOT NULL,
    'variants',to_jsonb(t.variants),'authorship',t.authorship,'provenance',t.provenance_status,
    'evidenceStrength',t.evidence_strength,'revision',t.revision,
    'canonApproval',CASE WHEN t.stage='canon' AND t.canon_approved_at IS NOT NULL
      THEN jsonb_build_object('revision',t.revision,'approvedAt',t.canon_approved_at) ELSE NULL END,
    'provenanceSummary',t.public_notes,
    'components',coalesce((SELECT jsonb_agg(r.root ORDER BY r.position,r.id) FROM public.term_roots r WHERE r.term_id=t.id),'[]'::jsonb),
    'roots',coalesce((SELECT jsonb_agg(r.root ORDER BY r.position,r.id) FROM public.term_roots r WHERE r.term_id=t.id),'[]'::jsonb),
    'domains',coalesce((SELECT jsonb_agg(d.name ORDER BY d.name) FROM public.term_domains td JOIN public.domains d ON d.id=td.domain_id WHERE td.term_id=t.id),'[]'::jsonb),
    'tags',coalesce((SELECT jsonb_agg(g.name ORDER BY g.name) FROM public.term_tags tt JOIN public.tags g ON g.id=tt.tag_id WHERE tt.term_id=t.id),'[]'::jsonb),
    'earliestVerifiedDate',(SELECT min(w.occurred_at) FROM public.source_witnesses w
      WHERE w.term_id=t.id AND w.approved_public AND w.approved_by IS NOT NULL AND w.evidence_strength='verified'),
    'sources',coalesce((SELECT jsonb_agg(jsonb_build_object('id',w.id,'title',w.title,'label',w.title,'url',w.url,
      'approvedExcerpt',w.excerpt,'sourceDate',w.occurred_at,'evidenceStrength',w.evidence_strength,
      'evidence',w.evidence_strength,'visibility','approved_public'))
      FROM public.source_witnesses w WHERE w.term_id=t.id AND w.approved_public AND w.approved_by IS NOT NULL
      AND (w.url IS NULL OR w.url ~* '^https?://')),'[]'::jsonb)
  ) FROM public.terms t WHERE t.id=p_term;
$$;

CREATE OR REPLACE FUNCTION lexical_private.public_snapshot()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH active AS (
    SELECT p.* FROM lexical_private.publications p JOIN public.terms t ON t.id=p.term_id
    WHERE p.revoked_at IS NULL AND t.visibility='public'
  ) SELECT jsonb_build_object(
    'terms',coalesce((SELECT jsonb_agg(a.payload||jsonb_build_object('publication',
      jsonb_build_object('approvedAt',a.approved_at,'approvedRevision',a.revision)) ORDER BY a.payload->>'headword') FROM active a),'[]'::jsonb),
    'relations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'source',r.source_term_id,
      'target',r.target_term_id,'type',r.relation,'note',r.public_note,'evidenceStrength',r.evidence_strength,
      'status',r.review_status,'visibility','approved_public','publicExplanation',r.public_note)) FROM public.term_relations r
      JOIN active s ON s.term_id=r.source_term_id JOIN active t ON t.term_id=r.target_term_id
      WHERE r.approved_public AND r.approved_by IS NOT NULL AND r.review_status='confirmed'),'[]'::jsonb),
    'versions',coalesce((SELECT jsonb_agg(jsonb_build_object('termId',v.term_id,'revision',v.revision,'version',v.revision,
      'definition',v.definition,'stage',v.stage,'approvedAt',v.approved_at,'date',v.approved_at,'effectiveAt',v.approved_at,'visibility','approved_public'))
      FROM lexical_private.publication_versions v JOIN active a ON a.term_id=v.term_id),'[]'::jsonb),
    'generatedAt',now(),'schemaVersion',1);
$$;

CREATE OR REPLACE FUNCTION lexical_private.editor_snapshot()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN
  PERFORM lexical_private.require_admin();
  RETURN jsonb_build_object('terms',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.terms t),
    'revisions',(SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM lexical_private.revisions r),
    'events',(SELECT coalesce(jsonb_agg(to_jsonb(e)),'[]') FROM lexical_private.lifecycle_events e),
    'relations',(SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM public.term_relations r),
    'witnesses',(SELECT coalesce(jsonb_agg(to_jsonb(w)),'[]') FROM public.source_witnesses w),
    'imports',(SELECT coalesce(jsonb_agg(to_jsonb(j)-'original_payload'),'[]') FROM lexical_private.import_jobs j));
END $$;

CREATE OR REPLACE FUNCTION lexical_private.capture(p_term text,p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid:=lexical_private.require_admin(); k text; found_id uuid; new_id uuid; BEGIN
  IF p_term IS NULL OR char_length(trim(p_term)) NOT BETWEEN 1 AND 160 OR char_length(coalesce(p_note,''))>20000 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Headword must be 1–160 characters; note at most 20000';
  END IF;
  k:=lexical_private.term_key(p_term);
  IF k='' THEN RAISE EXCEPTION 'Headword needs a recognizable lexical form'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(k,0));
  SELECT id INTO found_id FROM public.terms WHERE normalized_key=k ORDER BY created_at,id LIMIT 1;
  IF found_id IS NOT NULL THEN RETURN jsonb_build_object('id',found_id,'duplicate',true); END IF;
  INSERT INTO public.terms(slug,term,normalized_key,raw_notes,stage,visibility,provenance_status,coined_at,coined_precision)
  VALUES('term-'||gen_random_uuid()::text,trim(p_term),k,p_note,'forge','private','uncertain',NULL,'unknown') RETURNING id INTO new_id;
  PERFORM lexical_private.record_revision(new_id,actor,'Rapid capture; origin and history unresolved');
  INSERT INTO lexical_private.lifecycle_events(term_id,revision,actor_id,to_stage,reason)
    VALUES(new_id,1,actor,'forge','Rapid capture');
  RETURN jsonb_build_object('id',new_id,'duplicate',false,'revision',1);
END $$;

CREATE OR REPLACE FUNCTION lexical_private.save_term(p_id uuid,p_expected_revision bigint,p_changes jsonb,p_reason text,
  p_canon_confirmation text DEFAULT NULL,p_publish_confirmation text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid:=lexical_private.require_admin(); old public.terms; new_stage public.term_stage;
  new_visibility public.term_visibility; new_term text; key_name text; canon_decision boolean:=false;
  publish_decision boolean:=false; changed_definition boolean; new_revision bigint; new_key text;
BEGIN
  IF p_reason IS NULL OR char_length(trim(p_reason)) NOT BETWEEN 1 AND 2000 OR jsonb_typeof(p_changes) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='An object of changes and a concise editorial reason are required';
  END IF;
  FOR key_name IN SELECT jsonb_object_keys(p_changes) LOOP
    IF key_name NOT IN ('term','short_definition','full_definition','formation_type','conceptual_role','public_notes',
      'raw_notes','pronunciation','pronunciation_verified','operational_status','variants','authorship','evidence_strength','stage','visibility') THEN
      RAISE EXCEPTION 'Unsupported editable field: %',key_name;
    END IF;
  END LOOP;
  SELECT * INTO old FROM public.terms WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Term not found'; END IF;
  IF p_expected_revision IS DISTINCT FROM old.revision THEN
    RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Revision conflict: reload and review before saving';
  END IF;
  new_term:=CASE WHEN p_changes ? 'term' THEN trim(p_changes->>'term') ELSE old.term END;
  IF new_term IS NULL OR char_length(new_term) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'Invalid headword'; END IF;
  new_key:=lexical_private.term_key(new_term);
  IF new_key='' THEN RAISE EXCEPTION 'Headword needs a recognizable lexical form'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(new_key,0));
  IF new_key IS DISTINCT FROM old.normalized_key AND EXISTS(SELECT 1 FROM public.terms WHERE normalized_key=new_key AND id<>p_id) THEN
    RAISE EXCEPTION 'Duplicate lexical identity; review an explicit merge instead of overwriting'; END IF;
  new_stage:=coalesce((p_changes->>'stage')::public.term_stage,old.stage);
  new_visibility:=coalesce((p_changes->>'visibility')::public.term_visibility,old.visibility);
  changed_definition:=(p_changes ? 'short_definition' AND (p_changes->>'short_definition') IS DISTINCT FROM old.short_definition)
    OR (p_changes ? 'full_definition' AND (p_changes->>'full_definition') IS DISTINCT FROM old.full_definition);
  IF new_stage='canon' THEN
    IF p_canon_confirmation IS DISTINCT FROM 'APPROVE CANON '||new_term THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Canon requires exact explicit author confirmation';
    END IF;
    canon_decision:=true;
  END IF;
  IF p_publish_confirmation IS NOT NULL THEN
    IF new_visibility<>'public' OR p_publish_confirmation IS DISTINCT FROM 'PUBLISH '||new_term THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Publication requires exact explicit author confirmation';
    END IF;
    publish_decision:=true;
  END IF;
  IF new_visibility='public' AND NOT publish_decision AND NOT EXISTS(
    SELECT 1 FROM lexical_private.publications WHERE term_id=p_id AND revoked_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='No approved public snapshot; explicit publication is required';
  END IF;
  IF p_changes ? 'variants' AND (jsonb_typeof(p_changes->'variants')<>'array' OR jsonb_array_length(p_changes->'variants')>50) THEN
    RAISE EXCEPTION 'Variants must be an array with at most 50 forms';
  END IF;
  IF coalesce(p_changes->>'evidence_strength',old.evidence_strength) NOT IN ('verified','supported','reported','hypothetical','unknown') THEN
    RAISE EXCEPTION 'Invalid evidence strength'; END IF;
  IF coalesce(p_changes->>'operational_status',old.operational_status) NOT IN ('unprocessed_capture','pending_research',
    'awaiting_definition','needs_attribution_review','duplicate_candidate','rejected','archived','superseded','active') THEN
    RAISE EXCEPTION 'Invalid operational status'; END IF;
  IF coalesce(p_changes->>'authorship',old.authorship) NOT IN ('author_created','documented_prior_writing','conversation_observation',
    'ai_suggestion','collaborative_revision','borrowed','author_reinterpretation','origin_undetermined') THEN
    RAISE EXCEPTION 'Invalid authorship classification'; END IF;
  IF octet_length(p_changes::text)>200000 THEN RAISE EXCEPTION 'Changes exceed 200 KB'; END IF;
  UPDATE public.terms SET term=new_term,normalized_key=lexical_private.term_key(new_term),stage=new_stage,visibility=new_visibility,
    short_definition=CASE WHEN p_changes?'short_definition' THEN p_changes->>'short_definition' ELSE old.short_definition END,
    full_definition=CASE WHEN p_changes?'full_definition' THEN p_changes->>'full_definition' ELSE old.full_definition END,
    formation_type=CASE WHEN p_changes?'formation_type' THEN p_changes->>'formation_type' ELSE old.formation_type END,
    conceptual_role=CASE WHEN p_changes?'conceptual_role' THEN p_changes->>'conceptual_role' ELSE old.conceptual_role END,
    public_notes=CASE WHEN p_changes?'public_notes' THEN p_changes->>'public_notes' ELSE old.public_notes END,
    raw_notes=CASE WHEN p_changes?'raw_notes' THEN p_changes->>'raw_notes' ELSE old.raw_notes END,
    pronunciation=CASE WHEN p_changes?'pronunciation' THEN p_changes->>'pronunciation' ELSE old.pronunciation END,
    pronunciation_verified=coalesce((p_changes->>'pronunciation_verified')::boolean,old.pronunciation_verified),
    operational_status=coalesce(p_changes->>'operational_status',old.operational_status),
    variants=CASE WHEN p_changes?'variants' THEN ARRAY(SELECT jsonb_array_elements_text(p_changes->'variants')) ELSE old.variants END,
    authorship=coalesce(p_changes->>'authorship',old.authorship),evidence_strength=coalesce(p_changes->>'evidence_strength',old.evidence_strength),
    canon_approved_by=CASE WHEN canon_decision THEN actor WHEN new_stage<>'canon' THEN NULL ELSE old.canon_approved_by END,
    canon_approved_at=CASE WHEN canon_decision THEN clock_timestamp() WHEN new_stage<>'canon' THEN NULL ELSE old.canon_approved_at END,
    revision=old.revision+1 WHERE id=p_id RETURNING revision INTO new_revision;
  PERFORM lexical_private.record_revision(p_id,actor,p_reason);
  IF new_stage IS DISTINCT FROM old.stage OR canon_decision THEN
    INSERT INTO lexical_private.lifecycle_events(term_id,revision,actor_id,from_stage,to_stage,reason,explicit_canon_confirmation)
    VALUES(p_id,new_revision,actor,old.stage,new_stage,p_reason,canon_decision);
  END IF;
  IF new_visibility<>'public' THEN UPDATE lexical_private.publications SET revoked_at=clock_timestamp() WHERE term_id=p_id;
  ELSIF publish_decision THEN
    IF new_stage='canon' AND NOT EXISTS(SELECT 1 FROM public.terms WHERE id=p_id AND canon_approved_by IS NOT NULL) THEN
      RAISE EXCEPTION 'Legacy Canon status has not been author approved'; END IF;
    INSERT INTO lexical_private.publications(term_id,revision,payload,approved_by) VALUES(p_id,new_revision,lexical_private.public_payload(p_id),actor)
    ON CONFLICT(term_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,approved_by=excluded.approved_by,
      approved_at=clock_timestamp(),revoked_at=NULL;
    INSERT INTO lexical_private.publication_versions(term_id,revision,definition,stage,approved_by)
      SELECT id,revision,coalesce(short_definition,full_definition,''),stage,actor FROM public.terms WHERE id=p_id;
  END IF;
  RETURN jsonb_build_object('id',p_id,'revision',new_revision,'published',publish_decision,'canonDecision',canon_decision);
END $$;

CREATE OR REPLACE FUNCTION lexical_private.restore_term(p_id uuid,p_revision bigint,p_expected_revision bigint,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s jsonb; changes jsonb; BEGIN
  PERFORM lexical_private.require_admin();
  SELECT snapshot INTO s FROM lexical_private.revisions WHERE term_id=p_id AND revision=p_revision;
  IF s IS NULL THEN RAISE EXCEPTION 'Revision not found'; END IF;
  -- Restore wording as a NEW private Forge revision; never restore approval implicitly.
  changes:=jsonb_build_object('term',s->>'term','short_definition',s->'short_definition','full_definition',s->'full_definition',
    'raw_notes',s->'raw_notes','stage','forge','visibility','private','operational_status','pending_research');
  RETURN lexical_private.save_term(p_id,p_expected_revision,changes,'Restore revision '||p_revision||': '||p_reason,NULL,NULL);
END $$;

CREATE OR REPLACE FUNCTION lexical_private.review_relation(p_id uuid,p_approve boolean,p_public boolean,p_public_note text,p_evidence text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid:=lexical_private.require_admin(); BEGIN
  IF p_public AND NOT p_approve THEN RAISE EXCEPTION 'Rejected relationships cannot be public'; END IF;
  IF p_evidence NOT IN ('verified','supported','reported','hypothetical','unknown') THEN RAISE EXCEPTION 'Invalid evidence strength'; END IF;
  IF char_length(coalesce(p_public_note,''))>4000 THEN RAISE EXCEPTION 'Public note too long'; END IF;
  UPDATE public.term_relations SET review_status=CASE WHEN p_approve THEN 'confirmed' ELSE 'rejected' END,
    approved_public=p_public,public_note=p_public_note,evidence_strength=p_evidence,approved_by=actor,approved_at=clock_timestamp() WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Relationship not found'; END IF;
END $$;

CREATE OR REPLACE FUNCTION lexical_private.import_preview(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE rows jsonb; item jsonb; source_name text; ext text; word text; seen text[]:='{}'; seen_keys text[]:='{}'; result jsonb:='[]'; existing uuid; BEGIN
  PERFORM lexical_private.require_admin();
  rows:=p_payload->'terms'; source_name:=trim(p_payload->>'sourceSystem');
  IF source_name IS NULL OR char_length(source_name) NOT BETWEEN 1 AND 120 OR jsonb_typeof(rows) IS DISTINCT FROM 'array'
    OR jsonb_array_length(rows)>500 OR octet_length(p_payload::text)>2000000 THEN
    RAISE EXCEPTION 'Import requires sourceSystem, at most 500 terms, and at most 2 MB'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(rows) LOOP
    word:=trim(coalesce(item->>'headword',item->>'term',''));
    ext:=coalesce(nullif(item->>'sourceId',''),nullif(item->>'id',''),lexical_private.term_key(word));
    IF char_length(word) NOT BETWEEN 1 AND 160 OR lexical_private.term_key(word)='' OR char_length(ext)>300 THEN
      RAISE EXCEPTION 'Invalid import headword/source identifier'; END IF;
    existing:=NULL;
    SELECT term_id INTO existing FROM lexical_private.import_items WHERE source_system=source_name AND external_id=ext;
    IF existing IS NULL THEN SELECT id INTO existing FROM public.terms WHERE normalized_key=lexical_private.term_key(word) ORDER BY created_at,id LIMIT 1; END IF;
    result:=result||jsonb_build_array(jsonb_build_object('headword',word,'sourceId',ext,'existingId',existing,
      'action',CASE WHEN ext=ANY(seen) OR lexical_private.term_key(word)=ANY(seen_keys) THEN 'duplicate_in_file' WHEN existing IS NOT NULL THEN 'preserve_existing' ELSE 'create_private_forge' END));
    seen:=array_append(seen,ext);
    seen_keys:=array_append(seen_keys,lexical_private.term_key(word));
  END LOOP;
  RETURN jsonb_build_object('previewToken',encode(sha256(convert_to(jsonb_build_object('payload',p_payload,'plan',result)::text,'UTF8')),'hex'),'items',result);
END $$;

CREATE OR REPLACE FUNCTION lexical_private.import_terms(p_payload jsonb,p_preview_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid:=lexical_private.require_admin(); preview jsonb; row_item jsonb; item jsonb; source_name text;
  job uuid; saved jsonb; term_uuid uuid; created_count int:=0; preserved_count int:=0; BEGIN
  preview:=lexical_private.import_preview(p_payload);
  IF p_preview_token IS DISTINCT FROM preview->>'previewToken' THEN RAISE EXCEPTION 'Dry-run token mismatch: review this exact payload first'; END IF;
  source_name:=trim(p_payload->>'sourceSystem');
  PERFORM pg_advisory_xact_lock(hashtextextended('import:'||source_name,0));
  preview:=lexical_private.import_preview(p_payload);
  IF p_preview_token IS DISTINCT FROM preview->>'previewToken' THEN RAISE EXCEPTION 'Import plan changed: run a new dry-run preview'; END IF;
  INSERT INTO lexical_private.import_jobs(actor_id,source_system,original_payload,preview_token)
    VALUES(actor,source_name,p_payload,p_preview_token) RETURNING id INTO job;
  FOR row_item IN SELECT value FROM jsonb_array_elements(preview->'items') LOOP
    IF row_item->>'action'='duplicate_in_file' THEN preserved_count:=preserved_count+1; CONTINUE; END IF;
    IF row_item->>'existingId' IS NOT NULL THEN
      INSERT INTO lexical_private.import_items(source_system,external_id,term_id,job_id,created_term)
        VALUES(source_name,row_item->>'sourceId',(row_item->>'existingId')::uuid,job,false) ON CONFLICT DO NOTHING;
      preserved_count:=preserved_count+1; CONTINUE;
    END IF;
    SELECT value INTO item FROM jsonb_array_elements(p_payload->'terms') WHERE trim(coalesce(value->>'headword',value->>'term',''))=row_item->>'headword' LIMIT 1;
    saved:=lexical_private.capture(row_item->>'headword','Private import from '||source_name||'; original payload retained in import job '||job::text);
    term_uuid:=(saved->>'id')::uuid;
    IF NOT (saved->>'duplicate')::boolean THEN
      UPDATE public.terms SET short_definition=coalesce(item->>'definition',item->>'short_definition'),
        full_definition=item->>'full_definition',operational_status='needs_attribution_review',import_batch=job::text WHERE id=term_uuid;
      -- Capture snapshot already preserves original payload; a second explicit imported revision records wording.
      UPDATE public.terms SET revision=revision+1 WHERE id=term_uuid;
      PERFORM lexical_private.record_revision(term_uuid,actor,'Private import; definition and attribution require review');
      created_count:=created_count+1;
    ELSE preserved_count:=preserved_count+1; END IF;
    INSERT INTO lexical_private.import_items(source_system,external_id,term_id,job_id,created_term)
      VALUES(source_name,row_item->>'sourceId',term_uuid,job,NOT (saved->>'duplicate')::boolean) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN jsonb_build_object('jobId',job,'created',created_count,'preserved',preserved_count);
END $$;

CREATE OR REPLACE FUNCTION lexical_private.rollback_import(p_job uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid:=lexical_private.require_admin(); item record; archived_count int:=0; skipped_count int:=0; BEGIN
  IF NOT EXISTS(SELECT 1 FROM lexical_private.import_jobs WHERE id=p_job AND rolled_back_at IS NULL) THEN
    RAISE EXCEPTION 'Import not found or already recovered'; END IF;
  FOR item IN SELECT t.id,t.revision FROM lexical_private.import_items i JOIN public.terms t ON t.id=i.term_id
    WHERE i.job_id=p_job AND i.created_term FOR UPDATE OF t LOOP
    IF item.revision=2 THEN
      PERFORM lexical_private.save_term(item.id,item.revision,
        '{"visibility":"private","stage":"forge","operational_status":"archived"}'::jsonb,
        'Import recovery (originals retained): '||p_reason,NULL,NULL);
      archived_count:=archived_count+1;
    ELSE skipped_count:=skipped_count+1; END IF;
  END LOOP;
  UPDATE lexical_private.import_jobs SET rolled_back_at=clock_timestamp() WHERE id=p_job;
  RETURN jsonb_build_object('archived',archived_count,'editedEntriesPreserved',skipped_count);
END $$;

-- Public API wrappers contain no elevated code. Private implementations have fixed
-- search paths, explicit auth guards (except the intentional sanitized public read).
CREATE OR REPLACE FUNCTION public.lexical_public_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT lexical_private.public_snapshot(); $$;
CREATE OR REPLACE FUNCTION public.lexical_editor_snapshot() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT lexical_private.editor_snapshot(); $$;
CREATE OR REPLACE FUNCTION public.lexical_capture(p_term text,p_note text DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT lexical_private.capture(p_term,p_note); $$;
CREATE OR REPLACE FUNCTION public.lexical_save(p_id uuid,p_expected_revision bigint,p_changes jsonb,p_reason text,
  p_canon_confirmation text DEFAULT NULL,p_publish_confirmation text DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT lexical_private.save_term(p_id,p_expected_revision,p_changes,p_reason,p_canon_confirmation,p_publish_confirmation); $$;
CREATE OR REPLACE FUNCTION public.lexical_restore(p_id uuid,p_revision bigint,p_expected_revision bigint,p_reason text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT lexical_private.restore_term(p_id,p_revision,p_expected_revision,p_reason); $$;
CREATE OR REPLACE FUNCTION public.lexical_review_relation(p_id uuid,p_approve boolean,p_public boolean,p_public_note text,p_evidence text) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT lexical_private.review_relation(p_id,p_approve,p_public,p_public_note,p_evidence); $$;
CREATE OR REPLACE FUNCTION public.lexical_import_preview(p_payload jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT lexical_private.import_preview(p_payload); $$;
CREATE OR REPLACE FUNCTION public.lexical_import(p_payload jsonb,p_preview_token text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT lexical_private.import_terms(p_payload,p_preview_token); $$;
CREATE OR REPLACE FUNCTION public.lexical_rollback_import(p_job uuid,p_reason text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT lexical_private.rollback_import(p_job,p_reason); $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA lexical_private FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION lexical_private.public_snapshot() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION lexical_private.editor_snapshot(),lexical_private.capture(text,text),
  lexical_private.save_term(uuid,bigint,jsonb,text,text,text),lexical_private.restore_term(uuid,bigint,bigint,text),
  lexical_private.review_relation(uuid,boolean,boolean,text,text),lexical_private.import_preview(jsonb),
  lexical_private.import_terms(jsonb,text),lexical_private.rollback_import(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.lexical_public_snapshot(),public.lexical_editor_snapshot(),public.lexical_capture(text,text),
  public.lexical_save(uuid,bigint,jsonb,text,text,text),public.lexical_restore(uuid,bigint,bigint,text),
  public.lexical_review_relation(uuid,boolean,boolean,text,text),public.lexical_import_preview(jsonb),public.lexical_import(jsonb,text),public.lexical_rollback_import(uuid,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lexical_public_snapshot() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lexical_editor_snapshot(),public.lexical_capture(text,text),
  public.lexical_save(uuid,bigint,jsonb,text,text,text),public.lexical_restore(uuid,bigint,bigint,text),
  public.lexical_review_relation(uuid,boolean,boolean,text,text),public.lexical_import_preview(jsonb),public.lexical_import(jsonb,text),public.lexical_rollback_import(uuid,text)
  TO authenticated;

COMMENT ON FUNCTION public.lexical_public_snapshot() IS 'Only explicit approved snapshots; raw notes, private history and source bodies are never inherited by a public term.';
COMMENT ON SCHEMA lexical_private IS 'Must remain excluded from PostgREST exposed schemas. Client roles have no raw table grants. No personal seed content in this migration.';
NOTIFY pgrst,'reload schema';
COMMIT;
