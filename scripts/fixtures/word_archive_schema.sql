-- Schema-only fixture recovered from Word Archive b7189f2e5773beae409d5c51d7056cd61b3c14fe.
-- No historical term/content data. Disposable PostgreSQL tests only.

CREATE TYPE public.term_stage AS ENUM ('forge','lexicon','canon');
CREATE TYPE public.term_visibility AS ENUM ('draft','private','public');
CREATE TYPE public.word_idea_order AS ENUM ('idea_first','word_first','simultaneous','uncertain');
CREATE TYPE public.provenance_status AS ENUM ('claimed_coinage','earlier_use_found','independent_convergence','uncertain');
CREATE TYPE public.transmission_stage AS ENUM ('self','direct_audience','follower_of_follower','stranger','unattributed_circulation');
CREATE TYPE public.relation_type AS ENUM ('derivative_of','semantic_relative','opposition','depends_on','same_domain','phonetic_relative');
CREATE TYPE public.app_role AS ENUM ('admin','editor','viewer');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE TABLE public.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  term text NOT NULL,
  pronunciation text,
  short_definition text,
  full_definition text,
  stage public.term_stage NOT NULL DEFAULT 'forge',
  visibility public.term_visibility NOT NULL DEFAULT 'draft',
  coined_at date,
  coined_precision text NOT NULL DEFAULT 'year',
  first_published_at date,
  formation_type text,
  word_idea_order public.word_idea_order NOT NULL DEFAULT 'uncertain',
  conceptual_role text,
  birth_condition text,
  provenance_status public.provenance_status NOT NULL DEFAULT 'claimed_coinage',
  transmission_stage public.transmission_stage NOT NULL DEFAULT 'self',
  semantic_drift_notes text,
  public_notes text,
  raw_notes text,
  import_batch text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX terms_stage_idx ON public.terms (stage);
CREATE INDEX terms_visibility_idx ON public.terms (visibility);
GRANT SELECT ON public.terms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terms TO authenticated;
GRANT ALL ON public.terms TO service_role;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public terms readable" ON public.terms FOR SELECT TO anon, authenticated USING (visibility = 'public');
CREATE POLICY "admins read all terms" ON public.terms FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "admins write terms" ON public.terms FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "admins update terms" ON public.terms FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admins delete terms" ON public.terms FOR DELETE TO authenticated USING (public.is_admin());
CREATE TRIGGER terms_updated_at BEFORE UPDATE ON public.terms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.term_definition_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  version integer NOT NULL,
  short_definition text,
  full_definition text,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (term_id, version)
);
CREATE TABLE public.term_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_stage public.term_stage,
  to_stage public.term_stage,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.term_roots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  root text NOT NULL,
  language text,
  gloss text,
  role text,
  phonetic_hinge text,
  literal_derivation text,
  position integer NOT NULL DEFAULT 0
);
CREATE TABLE public.term_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  target_term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  relation public.relation_type NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_term_id, target_term_id, relation)
);
CREATE TABLE public.source_witnesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  title text,
  url text,
  excerpt text,
  source_type text,
  occurred_at date,
  is_first_appearance boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.external_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  source text,
  url text,
  context text,
  occurred_at date,
  independent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text
);
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL
);
CREATE TABLE public.term_domains (
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES public.domains(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, domain_id)
);
CREATE TABLE public.term_tags (
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (term_id, tag_id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['term_definition_versions','term_events','term_roots','term_relations','source_witnesses','external_attestations','term_domains','term_tags'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "public child readable" ON public.%I FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.terms x WHERE x.id = %s AND x.visibility = ''public''))',
      t, CASE WHEN t = 'term_relations' THEN 'source_term_id' ELSE 'term_id' END);
    EXECUTE format('CREATE POLICY "admins all child" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['domains','tags'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "readable by all" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "admins all" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;


CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin');
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


