"""Protect manually reviewed media links and notes during subsequent daily syncs."""
import json
from pathlib import Path
import unittest
from sync_youtube import reconcile

SITE = Path(__file__).resolve().parents[1] / 'museum-static'


def load(name):
    return json.loads((SITE / 'data' / name).read_text().split('=', 1)[1].strip().removesuffix(';'))


class MediaReconciliationTests(unittest.TestCase):
    def test_title_links_point_to_the_matching_preserved_work(self):
        media, poems = load('youtube-media.js'), load('poetry.js')
        works = {w['id']: w for w in poems['works']}
        rows = media['relevantVideos'] + media['reviewQueue']
        self.assertEqual(len(rows), len({v['youtubeId'] for v in rows}))
        for row in media['relevantVideos']:
            if row.get('mappingEvidence', {}).get('method') == 'title_match':
                work = works[row['canonicalWorkId']]
                self.assertEqual(row['canonicalTitle'], work['title'])
                self.assertEqual(row['mappingEvidence']['workId'], work['id'])
                self.assertEqual(work['credit'], 'Brandon Smith')
                self.assertIn('not been compared', row['mappingEvidence']['scope'])

    def test_daily_refresh_preserves_links_and_review_decisions(self):
        old = load('youtube-media.js')
        rows = old['relevantVideos'] + old['reviewQueue']
        info = {'webpage_url': 'https://www.youtube.com/@idunnopoetry/videos',
                'entries': [{'id': row['youtubeId'], 'title': row['title']} for row in rows]}
        refreshed = reconcile(old, info)
        before = {v['youtubeId']: v for v in rows}
        after = {v['youtubeId']: v for v in refreshed['relevantVideos'] + refreshed['reviewQueue']}
        self.assertEqual(set(before), set(after))
        for video_id, original in before.items():
            for field in ('canonicalTitle', 'canonicalWorkId', 'mappingEvidence', 'reviewCategory', 'reason', 'reviewScope'):
                if field in original:
                    self.assertEqual(after[video_id][field], original[field])


if __name__ == '__main__':
    unittest.main()
