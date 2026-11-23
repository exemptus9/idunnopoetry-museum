"""Check the actual museum reader's chronology and unchanged poem text."""
import pathlib,subprocess,unittest
class PoemChronologyTests(unittest.TestCase):
    def test_reader_dates_preserve_text_and_other_authors(self):
        root=pathlib.Path(__file__).resolve().parents[1]
        result=subprocess.run(['node','scripts/test_poem_chronology_dom.mjs'],cwd=root,text=True,capture_output=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
