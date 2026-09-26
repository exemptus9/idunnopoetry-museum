import unittest
from datetime import datetime, timezone
from sync_youtube import reconcile

NOW = datetime(2026, 9, 24, tzinfo=timezone.utc)
A, B, C = 'AAAAAAAAAAA', 'BBBBBBBBBBB', 'CCCCCCCCCCC'


def playlist(ids, tab='videos'):
    return {'webpage_url': f'https://www.youtube.com/@idunnopoetry/{tab}',
            'entries': [{'id': video, 'title': 'Public video'} for video in ids]}


class SyncPreservationTests(unittest.TestCase):
    def setUp(self):
        self.old = {'checked': '2026-09-23', 'channel': {'reportedVideoCount': 58},
                    'relevantVideos': [{'youtubeId': A, 'canonicalTitle': 'Original Work', 'syncStatus': 'not_seen_in_latest_enumeration'}],
                    'reviewQueue': [{'youtubeId': B, 'reason': 'Authorship unresolved', 'notes': 'Keep this evidence'}],
                    'youtubeOnlyWorks': ['Original Work'], 'customEvidence': {'preserve': True}}

    def test_missing_review_and_curated_records_are_preserved(self):
        result = reconcile(self.old, playlist([C]), NOW)
        self.assertEqual(result['relevantVideos'][0]['canonicalTitle'], 'Original Work')
        pending = {v['youtubeId']: v for v in result['reviewQueue']}
        self.assertEqual(pending[B]['notes'], 'Keep this evidence')
        self.assertEqual(pending[B]['syncStatus'], 'not_seen_in_latest_enumeration')
        self.assertNotIn('canonicalTitle', pending[C])
        self.assertEqual(result['customEvidence'], self.old['customEvidence'])

    def test_returning_upload_clears_missing_status_without_reclassification(self):
        result = reconcile(self.old, playlist([A, B]), NOW)
        self.assertNotIn('syncStatus', result['relevantVideos'][0])
        self.assertEqual(result['reviewQueue'][0]['reason'], 'Authorship unresolved')
        self.assertEqual(result['reviewQueue'][0]['lastSeen'], '2026-09-24')

    def test_nested_channel_tabs_are_deduplicated(self):
        info = {'entries': [playlist([A, B]), playlist([B, C], 'shorts')]}
        result = reconcile(self.old, info, NOW)
        self.assertEqual(result['sync']['enumerated'], 3)
        self.assertEqual(result['channel']['enumeratedRegularVideos'], 2)
        self.assertEqual(result['channel']['enumeratedByTab'], {'videos': 2, 'shorts': 2})
        self.assertEqual(len(result['reviewQueue']), 2)
        self.assertEqual(result['channel']['reportedVideoCount'], 58)
        self.assertEqual(result['channel']['reportedVideoCountChecked'], '2026-09-23')
        self.assertEqual(result['channel']['unresolvedCount'], 55)

    def test_empty_extraction_fails_without_modifying_snapshot(self):
        with self.assertRaises(RuntimeError):
            reconcile(self.old, {'entries': []}, NOW)
        self.assertEqual(self.old['checked'], '2026-09-23')
        self.assertEqual(len(self.old['reviewQueue']), 1)


if __name__ == '__main__':
    unittest.main()
