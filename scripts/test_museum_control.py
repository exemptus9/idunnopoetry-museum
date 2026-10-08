"""Static regression checks for Museum editor and public/private separation."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]

class MuseumControlTests(unittest.TestCase):
    def test_public_config_starts_disabled(self):
        cfg=(ROOT/"museum-static/admin/cms-config.js").read_text()
        self.assertIn("url: ''",cfg)
        self.assertIn("publishableKey: ''",cfg)
        self.assertNotIn("sb_secret_",cfg)
    def test_private_seedbank_not_in_public_tree(self):
        for d in [ROOT/"museum-static",ROOT/"public"]:
            self.assertFalse(list(d.rglob("*PRIVATE*")),f"Private file accidentally shipped in {d}")
            self.assertFalse(list(d.rglob("*Seedbank_PRIVATE*")))
    def test_public_projector_declines_extra_fields(self):
        sql=(ROOT/"supabase/migrations/20261008_museum_editorial_backend.sql").read_text()
        self.assertIn("create policy museum_publications_reader",sql)
        for table in ["museum_editors","museum_documents","museum_revisions","museum_publications","museum_events"]:
            self.assertIn("alter table public."+table+" enable row level security",sql)
        for rpc in ["museum_save","museum_approve","museum_publish","museum_withdraw","museum_restore"]:
            self.assertIn("function public."+rpc,sql)
        self.assertIn("'public_note', p_body->>'public_note'",sql)
        self.assertNotIn("'private_notebook', p_body->",sql)
    def test_public_site_uses_only_anonymous_projection(self):
        html=(ROOT/"museum-static/index.html").read_text()
        client=(ROOT/"museum-static/admin/public-overlay.js").read_text()
        self.assertIn('src="admin/public-overlay.js"',html)
        self.assertIn("museum_publications",client)
        self.assertNotIn("museum_documents?",client)
        self.assertNotIn("service_role",client)
        self.assertIn("IDP_CMS_PUBLIC_STATUS='unavailable'",client)
    def test_admin_requires_auth_and_double_approval(self):
        client=(ROOT/"museum-static/admin/admin.js").read_text()
        self.assertIn("museum_my_role",client)
        self.assertIn("museum_approve",client)
        self.assertIn("museum_publish",client)
        self.assertIn("museum_withdraw",client)
        self.assertIn("museum_restore",client)
        self.assertIn("create_user:false",client)
        self.assertIn("No data has been transmitted",client)
    def test_no_public_private_vault_import_scripts(self):
        site=(ROOT/"museum-static/index.html").read_text()
        self.assertNotIn("IDP_Seedbank_PRIVATE_",site)
        self.assertNotIn("Seeds_PRIVATE_",site)
        self.assertIn("IDP_CMS_PUBLIC_READY", (ROOT/"museum-static/museum.js").read_text())

if __name__=="__main__":
    unittest.main()
