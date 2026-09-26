#!/usr/bin/env python3
"""Refresh public-channel metadata without losing curated or unreviewed records."""
import copy
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'museum-static' / 'data' / 'youtube-media.js'
CHANNEL_URL = 'https://www.youtube.com/@idunnopoetry'
PREFIX = 'window.IDP_YOUTUBE_MEDIA='
VIDEO_ID = re.compile(r'^[A-Za-z0-9_-]{11}$')


def load_data():
    raw = DATA.read_text(encoding='utf-8').strip()
    if not raw.startswith(PREFIX):
        raise RuntimeError('Unexpected youtube-media.js format')
    return json.loads(raw[len(PREFIX):].removesuffix(';'))


def duration_text(value, fallback=''):
    try:
        seconds = int(round(float(value)))
        if seconds < 0:
            return fallback
    except (TypeError, ValueError, OverflowError):
        return fallback
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f'{hours}:{minutes:02d}:{seconds:02d}' if hours else f'{minutes}:{seconds:02d}'


def iso_date(entry):
    value = entry.get('upload_date')
    if isinstance(value, str) and len(value) == 8 and value.isdigit():
        return f'{value[:4]}-{value[4:6]}-{value[6:]}'
    try:
        if entry.get('timestamp'):
            return datetime.fromtimestamp(float(entry['timestamp']), timezone.utc).date().isoformat()
    except (ValueError, TypeError, OSError, OverflowError):
        pass
    return None


def flatten_videos(node, tab='unknown'):
    """A channel can contain nested Videos, Shorts and Live playlists."""
    if not isinstance(node, dict):
        return
    path = urlparse(node.get('webpage_url') or node.get('original_url') or '').path.rstrip('/')
    last = path.rsplit('/', 1)[-1]
    if last in ('videos', 'shorts', 'streams'):
        tab = last
    if 'entries' in node:
        for child in node.get('entries') or []:
            yield from flatten_videos(child, tab)
    elif VIDEO_ID.fullmatch(str(node.get('id', ''))):
        if '/shorts/' in (node.get('url') or ''):
            tab = 'shorts'
        yield node, tab


def reconcile(old, info, now=None):
    now = now or datetime.now(timezone.utc)
    day = now.date().isoformat()
    known = {v['youtubeId']: v for v in old.get('relevantVideos', []) if v.get('youtubeId')}
    pending = {v['youtubeId']: v for v in old.get('reviewQueue', []) if v.get('youtubeId')}
    entries, tabs = {}, {}
    for entry, tab in flatten_videos(info):
        video_id = entry['id']
        entries.setdefault(video_id, entry)
        tabs.setdefault(tab, set()).add(video_id)
    if not entries:
        raise RuntimeError('No public videos enumerated; previous catalog kept unchanged.')

    curated, review = [], []
    for video_id, entry in entries.items():
        row = copy.deepcopy(known.get(video_id) or pending.get(video_id) or {})
        row.update({
            'youtubeId': video_id,
            'title': entry.get('title') or row.get('title') or video_id,
            'publicUrl': f'https://www.youtube.com/watch?v={video_id}',
            'duration': duration_text(entry.get('duration'), row.get('duration', '')),
            'lastSynced': day,
            'lastSeen': day,
            'sourceTabs': sorted(tab for tab, ids in tabs.items() if video_id in ids),
        })
        row.pop('syncStatus', None)
        views = entry.get('view_count')
        if isinstance(views, (int, float)) and views >= 0:
            row['views'] = int(views)
        uploaded = iso_date(entry)
        if uploaded:
            row['uploadDate'] = uploaded
        if video_id in known:
            curated.append(row)
        else:
            row.setdefault('reason', 'Public channel upload not yet mapped to a canonical archive work.')
            row.setdefault('status', 'needs_review')
            review.append(row)

    # Omission is not proof of deletion. Preserve both layers and their notes.
    for source, destination in ((known, curated), (pending, review)):
        for video_id, original in source.items():
            if video_id not in entries and not (source is pending and video_id in known):
                row = copy.deepcopy(original)
                row['syncStatus'] = 'not_seen_in_latest_enumeration'
                destination.append(row)
    for rows in (curated, review):
        rows.sort(key=lambda v: (v.get('uploadDate') or '', v['youtubeId']), reverse=True)

    channel = copy.deepcopy(old.get('channel') or {})
    channel['title'] = info.get('channel') or info.get('uploader') or channel.get('title') or 'eXemptus'
    channel['handle'] = info.get('uploader_id') or channel.get('handle') or '@idunnopoetry'
    channel['url'] = info.get('channel_url') or channel.get('url') or CHANNEL_URL
    followers = info.get('channel_follower_count')
    if isinstance(followers, (int, float)):
        channel['subscribers'] = int(followers)
    channel['enumeratedRegularVideos'] = len(tabs.get('videos', set()))
    channel['enumeratedPublicVideos'] = len(entries)
    channel['enumeratedByTab'] = {tab: len(ids) for tab, ids in sorted(tabs.items())}
    # playlist_count is not the channel header count. Keep its dated observation.
    reported = channel.get('reportedVideoCount')
    if isinstance(reported, int):
        channel.setdefault('reportedVideoCountChecked', old.get('checked'))
        channel['unresolvedCount'] = max(reported - len(entries), 0)
    else:
        channel['unresolvedCount'] = None

    output = copy.deepcopy(old)
    output.update({
        'checked': day,
        'channel': channel,
        'methodology': 'Daily public-channel scan covering available Videos, Shorts and Live tabs. Uploads are deduplicated by YouTube ID. Curated work mappings and review notes are preserved. Omitted records are retained and flagged; new uploads remain unclassified until reviewed. The dated channel-header count is a separate historical observation, not a live total.',
        'sync': {
            'mode': 'scheduled_public_channel',
            'source': CHANNEL_URL,
            'lastRun': now.isoformat().replace('+00:00', 'Z'),
            'enumerated': len(entries),
            'enumeratedByTab': channel['enumeratedByTab'],
            'curatedRelevant': len(curated),
            'needsReview': len(review),
            'notSeen': sum('syncStatus' in v for v in curated + review),
        },
        'relevantVideos': curated,
        'reviewQueue': review,
    })
    output.setdefault('stats', {}).update({
        'relevantVideos': len(curated),
        'youtubeOnlyWorks': len(output.get('youtubeOnlyWorks') or []),
        'needsReview': len(review),
        'enumeratedRegularVideos': channel['enumeratedRegularVideos'],
        'enumeratedPublicVideos': len(entries),
    })
    return output


def main():
    from yt_dlp import YoutubeDL
    old = load_data()
    options = {'quiet': True, 'no_warnings': True, 'skip_download': True,
               'extract_flat': 'in_playlist', 'socket_timeout': 30, 'retries': 2}
    with YoutubeDL(options) as ydl:
        info = ydl.extract_info(CHANNEL_URL, download=False)
    output = reconcile(old, info)
    staged = DATA.with_suffix('.tmp')
    staged.write_text(PREFIX + json.dumps(output, separators=(',', ':'), ensure_ascii=False) + ';\n', encoding='utf-8')
    staged.replace(DATA)
    print(json.dumps(output['sync'], indent=2))


if __name__ == '__main__':
    main()
