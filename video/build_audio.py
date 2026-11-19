#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build the local Chinese narration without playing sound.

Requires the macOS /usr/bin/say command and its installed Tingting voice.
Each subtitle sentence receives its own PCM WAV so the recording timeline can
use measured durations rather than estimated reading speed.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
import re
import subprocess
import sys
import wave

BASE = Path(__file__).resolve().parent
SAMPLE_RATE = 24000


def spoken_text(text: str) -> str:
    replacements = (
        ('WebXR', '网络扩展现实'),
        ('webxr', '网络扩展现实'),
        ('O09', '欧零九'),
        ('O01', '欧零一'),
        ('O02', '欧零二'),
        ('S01', '艾斯零一'),
        ('W01', '达不溜零一'),
        ('v1', '版本一'),
        ('v2', '版本二'),
        ('V1', '版本一'),
        ('V2', '版本二'),
    )
    spoken = text
    for source, target in replacements:
        spoken = spoken.replace(source, target)
    # Bound only against ASCII words so Chinese text adjacent to A/B is handled.
    spoken = re.sub(r'(?<![A-Za-z])A(?![A-Za-z])', '诶', spoken)
    spoken = re.sub(r'(?<![A-Za-z])B(?![A-Za-z])', '比', spoken)
    return spoken


def wav_duration(path: Path) -> float:
    if not path.is_file() or path.stat().st_size <= 44:
        raise RuntimeError('Audio output is missing or empty: {}'.format(path))
    with wave.open(str(path), 'rb') as wav:
        if wav.getframerate() != SAMPLE_RATE or wav.getsampwidth() != 2:
            raise RuntimeError('Unexpected PCM format: {}'.format(path))
        if wav.getnchannels() != 1:
            raise RuntimeError('Expected mono audio: {}'.format(path))
        frames = wav.getnframes()
        if frames <= 0:
            raise RuntimeError('Audio has no frames: {}'.format(path))
        return round(frames / wav.getframerate(), 6)


def render_sentence(job: dict, voice: str, rate: int, reuse: bool) -> tuple[int, int, dict]:
    segment_index, line_index = job['segment_index'], job['line_index']
    filename = '{}-{:02d}'.format(job['id'], line_index + 1)
    if not re.fullmatch(r'[A-Za-z0-9_-]+', filename):
        raise ValueError('Audio filenames must be ASCII identifiers: {}'.format(filename))
    text_path = BASE / 'work' / (filename + '.txt')
    audio_path = BASE / 'assets' / (filename + '.wav')
    spoken = spoken_text(job['text'])
    can_reuse = reuse and text_path.is_file() and text_path.read_text(encoding='utf-8') == spoken
    if can_reuse:
        try:
            duration = wav_duration(audio_path)
        except (OSError, EOFError, wave.Error, RuntimeError):
            can_reuse = False
    if not can_reuse:
        text_path.write_text(spoken, encoding='utf-8')
        command = [
            '/usr/bin/say', '-v', voice, '-r', str(rate),
            '--file-format=WAVE', '--data-format=LEI16@24000',
            '-o', str(audio_path), '-f', str(text_path),
        ]
        result = subprocess.run(command, capture_output=True, text=True, timeout=90)
        if result.returncode:
            raise RuntimeError('say failed for {}: {}'.format(filename, result.stderr.strip()[:500]))
        duration = wav_duration(audio_path)
    return segment_index, line_index, {
        'text': job['text'], 'spoken': spoken,
        'file': audio_path.relative_to(BASE).as_posix(), 'duration': duration,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--voice', default='Tingting')
    parser.add_argument('--rate', type=int, default=205)
    parser.add_argument('--workers', type=int, choices=[1, 2], default=2)
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    if not Path('/usr/bin/say').is_file():
        raise RuntimeError('This build needs macOS /usr/bin/say.')
    if args.rate <= 0:
        raise ValueError('The speech rate must be positive.')
    segments = json.loads((BASE / 'narration.json').read_text(encoding='utf-8'))
    if not isinstance(segments, list) or not segments:
        raise ValueError('narration.json must contain a nonempty segment array.')
    for name in ('assets', 'work'):
        (BASE / name).mkdir(parents=True, exist_ok=True)
    settings = {'voice': args.voice, 'rate': args.rate, 'sampleRate': SAMPLE_RATE}
    settings_path = BASE / 'work' / 'audio-settings.json'
    try:
        reuse = not args.force and json.loads(settings_path.read_text(encoding='utf-8')) == settings
    except (OSError, json.JSONDecodeError):
        reuse = False
    jobs = []
    for segment_index, segment in enumerate(segments):
        if not isinstance(segment.get('lines'), list) or not segment['lines']:
            raise ValueError('Every segment needs subtitle lines.')
        for line_index, text in enumerate(segment['lines']):
            if not isinstance(text, str) or not text.strip():
                raise ValueError('Narration lines must contain text.')
            jobs.append({'segment_index': segment_index, 'line_index': line_index,
                         'id': segment['id'], 'text': text})
    voices = [[None] * len(segment['lines']) for segment in segments]
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(render_sentence, job, args.voice, args.rate, reuse) for job in jobs]
        for completed, future in enumerate(as_completed(futures), start=1):
            segment_index, line_index, voice = future.result()
            voices[segment_index][line_index] = voice
            if completed % 10 == 0 or completed == len(jobs):
                print('Rendered {}/{} subtitle sentences'.format(completed, len(jobs)), flush=True)
    manifest = []
    for index, segment in enumerate(segments):
        item = dict(segment)
        item['voices'] = voices[index]
        manifest.append(item)
    output = BASE / 'assets' / 'voice-manifest.json'
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    settings_path.write_text(json.dumps(settings, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    total = sum(voice['duration'] for item in manifest for voice in item['voices'])
    print(json.dumps({'segments': len(manifest), 'sentences': len(jobs),
                      'voice_seconds': round(total, 6), 'voice_minutes': round(total / 60, 3),
                      'manifest': str(output)}, ensure_ascii=False), flush=True)
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print('Audio build failed: {}'.format(error), file=sys.stderr)
        raise SystemExit(1)
