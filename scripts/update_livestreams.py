#!/usr/bin/env python3
"""Update the 6 newest public Dream Drops Crew YouTube livestreams.

Runs in GitHub Actions, which keeps YOUTUBE_API_KEY out of public HTML/JS.
Only standard-library modules are required. Never writes API credentials to JSON.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

CHANNEL_HANDLE = os.environ.get('YOUTUBE_HANDLE', 'DreamDropsCrew').lstrip('@')
API_KEY = os.environ.get('YOUTUBE_API_KEY', '').strip()
SITE_DIR = Path(os.environ.get('SITE_DIR', 'dreamdropscrew'))
DEST = SITE_DIR / 'data' / 'livestreams.json'
API = 'https://www.googleapis.com/youtube/v3/'


def youtube(method, **kwargs):
    params = {'key': API_KEY, **kwargs}
    url = API + method + '?' + urlencode(params)
    req = Request(url, headers={'User-Agent': 'DreamDropsCrew-SiteFeed/1.0'})
    with urlopen(req, timeout=25) as response:
        return json.load(response)


def main():
    if not API_KEY:
        raise SystemExit('Missing YOUTUBE_API_KEY. Add it in GitHub repository Actions secrets.')
    if not SITE_DIR.is_dir():
        raise SystemExit(f'Site folder does not exist: {SITE_DIR}')
    channel_resp = youtube('channels', part='id', forHandle=CHANNEL_HANDLE)
    matches = channel_resp.get('items', [])
    if not matches:
        raise SystemExit(f'No YouTube channel found for @{CHANNEL_HANDLE}')
    channel_id = matches[0]['id']

    # Search only public completed and currently live broadcasts, not normal uploads.
    ids = []
    for event_type in ('live', 'completed'):
        data = youtube('search', part='snippet', channelId=channel_id,
                       type='video', eventType=event_type, order='date', maxResults=25)
        for item in data.get('items', []):
            video_id = item.get('id', {}).get('videoId', '')
            if video_id and video_id not in ids:
                ids.append(video_id)

    if ids:
        details = youtube('videos', part='snippet,liveStreamingDetails,status', id=','.join(ids[:50]), maxResults=50)
        results = []
        for item in details.get('items', []):
            detail = item.get('liveStreamingDetails') or {}
            snippet = item.get('snippet') or {}
            status = item.get('status') or {}
            # Published/public videos only; privacy settings are respected.
            if status.get('privacyStatus') != 'public':
                continue
            start = detail.get('actualStartTime')
            if not start:
                continue  # skip anything never actually broadcast
            results.append({
                'id': item['id'], 'title': snippet.get('title', 'Livestream'),
                'publishedAt': snippet.get('publishedAt'),
                'startedAt': start,
                'live': not bool(detail.get('actualEndTime'))
            })
        results.sort(key=lambda x: x['startedAt'], reverse=True)
        videos = results[:6]
    else:
        videos = []

    # If YouTube suddenly returns zero livestreams, don't erase an existing valid feed.
    previous = {}
    if DEST.exists():
        try:
            previous = json.loads(DEST.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            pass
    if not videos and previous.get('videos'):
        raise SystemExit('YouTube returned no livestreams; leaving the previous feed unchanged.')
    if previous.get('videos') == videos:
        print('No livestream changes; feed already up to date.')
        return
    result = {
        'channel': '@' + CHANNEL_HANDLE,
        'updatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
        'videos': videos,
    }
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Updated {DEST}: {len(videos)} livestreams.')


if __name__ == '__main__':
    main()
