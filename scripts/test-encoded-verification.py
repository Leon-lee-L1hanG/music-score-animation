"""Regression checks for final MP4 verification; requires Node, FFmpeg and ffprobe."""
import json
import math
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import wave


def main():
    validator = Path(__file__).resolve().parents[1] / 'assets/template/scripts/verify-encode.mjs'
    for command in ('node', 'ffmpeg', 'ffprobe'):
        if not shutil.which(command):
            raise RuntimeError(f'Missing {command}')
    results = []
    with tempfile.TemporaryDirectory(prefix='score-verifier-') as temporary:
        root = Path(temporary)
        (root / 'public').mkdir()
        (root / 'output').mkdir()
        duration, rate = 5, 48000

        def run(args):
            return subprocess.run(args, cwd=root, check=True, capture_output=True)

        def wav(name, kind):
            with wave.open(str(root / name), 'wb') as stream:
                stream.setparams((2, 2, rate, 0, 'NONE', 'not compressed'))
                values = bytearray()
                for i in range(duration * rate):
                    t = i / rate
                    amplitude = min(1, t * 10, (duration - t) * 10) * .22
                    signal = math.sin(2 * math.pi * (220 * t + 53 * t * t))
                    signal += .35 * math.sin(2 * math.pi * (391 * t + 11 * t * t))
                    if kind == 'wrong':
                        signal = math.sin(2 * math.pi * (700 * t + 89 * t * t))
                    if kind == 'silent':
                        signal = 0
                    sample = round(amplitude * signal * 32767)
                    values.extend(struct.pack('<hh', sample, sample))
                stream.writeframes(values)

        for kind in ('good', 'silent', 'wrong'):
            wav(kind + '.wav', kind)
        run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i',
             'color=c=black:s=1920x1080:r=30:d=5', '-an', '-c:v', 'libx264',
             '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', 'base.mp4'])
        cases = [
            ('synchronized', 'good', 'good', None, 5, True),
            ('silent_both', 'silent', 'silent', None, 5, False),
            ('silent_output', 'good', 'silent', None, 5, False),
            ('unrelated_audio', 'good', 'wrong', None, 5, False),
            ('delayed_30ms', 'good', 'good', 'adelay=30|30', 5, False),
            ('timeline_mismatch', 'good', 'good', None, 6, False),
            ('missing_audio', 'good', None, None, 5, False),
        ]
        for name, source, encoded, audio_filter, expected_duration, expected_pass in cases:
            shutil.copyfile(root / (source + '.wav'), root / 'public/piano.wav')
            (root / 'public/score-data.json').write_text(json.dumps({'duration': expected_duration}))
            args = ['ffmpeg', '-y', '-v', 'error', '-i', 'base.mp4']
            if encoded:
                args += ['-i', encoded + '.wav', '-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '320k']
                if audio_filter:
                    args += ['-af', audio_filter]
            else:
                args += ['-an']
            run(args + ['-c:v', 'copy', '-t', '5', 'output/music-score.mp4'])
            result = subprocess.run(['node', str(validator)], cwd=root, capture_output=True)
            report = json.loads((root / 'encoded-verification.json').read_text())
            actual_pass = result.returncode == 0 and report['passed'] is True
            assert actual_pass == expected_pass, (name, result.stderr.decode(errors='replace'), report)
            results.append({'case': name, 'expected_pass': expected_pass, 'actual_pass': actual_pass})
    print(json.dumps({'passed': True, 'cases': results}, indent=2))


if __name__ == '__main__':
    main()
