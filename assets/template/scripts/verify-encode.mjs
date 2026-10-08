import fs from 'node:fs';
import {execFileSync, spawn} from 'node:child_process';

const file = 'output/music-score.mp4', source = 'public/piano.wav';
const reportPath = 'encoded-verification.json', failures = [];
const probe = (path) => JSON.parse(execFileSync('ffprobe', [
  '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path,
], {encoding: 'utf8'}));

function decodeWindow(path, start, duration) {
  // Output-side seek preserves AAC priming/edit-list handling, including the first window.
  const b = execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', path,
    '-ss', String(start), '-t', String(duration), '-map', '0:a:0', '-vn', '-ac', '1',
    '-ar', '8000', '-f', 'f32le', 'pipe:1'], {maxBuffer: 2e6});
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

// Stream the full stereo decode instead of imposing a short-song memory limit.
function peakStats(path) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', ['-v', 'error', '-xerror', '-i', path,
      '-map', '0:a:0', '-vn', '-ac', '2', '-ar', '48000', '-f', 'f32le', 'pipe:1']);
    let pending = Buffer.alloc(0), peak = 0, clipped = 0, samples = 0, nonfinite = 0, error = '';
    child.stdout.on('data', (chunk) => {
      const b = Buffer.concat([pending, chunk]), length = b.length - b.length % 4;
      for (let i = 0; i < length; i += 4) {
        const v = b.readFloatLE(i); samples++;
        if (!Number.isFinite(v)) {nonfinite++; continue;}
        peak = Math.max(peak, Math.abs(v));
        if (Math.abs(v) >= .999) clipped++;
      }
      pending = Buffer.from(b.subarray(length));
    });
    child.stderr.on('data', (b) => {error = (error + b.toString()).slice(-4000);});
    child.on('error', reject);
    child.on('close', (code) => code === 0 && pending.length === 0
      ? resolve({peak, clipped, samples, nonfinite}) : reject(new Error(error || 'Audio decode failed')));
  });
}

try {
  const data = JSON.parse(fs.readFileSync('public/score-data.json', 'utf8'));
  if (!Number.isFinite(data.duration) || data.duration <= 0) throw new Error('Invalid score duration');
  const meta = probe(file), sourceMeta = probe(source);
  const video = meta.streams.find((s) => s.codec_type === 'video');
  const audio = meta.streams.find((s) => s.codec_type === 'audio');
  if (!video || !audio) throw new Error('Final MP4 must have video and audio');
  const [n, d] = video.r_frame_rate.split('/').map(Number);
  // Match the bundled Composition; adapt together for a requested output format.
  if (video.width !== 1920 || video.height !== 1080 || Math.abs(n / d - 30) > 1e-6)
    failures.push('Unexpected video dimensions or frame rate');
  const expected = Math.ceil(data.duration * 30) / 30;
  const duration = Number(meta.format.duration), sourceDuration = Number(sourceMeta.format.duration);
  if (!Number.isFinite(duration) || Math.abs(duration - expected) > .05)
    failures.push('Final duration differs from score timeline');
  if (!Number.isFinite(sourceDuration) || Math.abs(sourceDuration - expected) > .05)
    failures.push('Source audio duration differs from score timeline');
  if (!Number.isFinite(Number(audio.duration)) || Math.abs(Number(audio.duration) - expected) > .05)
    failures.push('Encoded audio duration differs from score timeline');
  const available = Math.min(duration, sourceDuration);
  if (!Number.isFinite(available) || available < .3) throw new Error('Audio too short to verify');
  const length = Math.min(2.4, available);
  const starts = [...new Set([0, (available - length) / 2, available - length])], windows = [];
  for (const start of starts) {
    const a = decodeWindow(source, start, length), b = decodeWindow(file, start, length);
    const end = Math.min(a.length, b.length) - 400;
    let energy = 0, count = 0;
    for (let i = 400; i < end; i += 4) {energy += a[i] ** 2; count++;}
    if (!count || energy / count < 1e-10) {windows.push({start, skipped: 'Source window is silent'}); continue;}
    let best = -Infinity, lag = null;
    for (let shift = -400; shift <= 400; shift++) {
      let ab = 0, aa = 0, bb = 0;
      for (let i = 400; i < end; i += 4) {
        const x = a[i], y = b[i + shift]; ab += x * y; aa += x * x; bb += y * y;
      }
      const corr = ab / Math.sqrt(aa * bb);
      if (Number.isFinite(corr) && corr > best) {best = corr; lag = shift;}
    }
    const valid = lag !== null && best >= .9 && Math.abs(lag) <= 8;
    windows.push({start, correlation: Number.isFinite(best) ? best : null, offsetMs: lag === null ? null : lag / 8, passed: valid});
    if (!valid) failures.push(`Audio alignment/correlation failed at ${start.toFixed(3)}s`);
  }
  if (!windows.some((w) => !w.skipped)) failures.push('No audible source window; synchronization is unverified');
  const stats = await peakStats(file);
  if (!stats.samples || stats.nonfinite || stats.peak <= 1e-5 || stats.clipped)
    failures.push('Silent, invalid or clipped encoded audio');
  execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', file, '-f', 'null', '-'], {stdio: ['ignore', 'ignore', 'pipe']});
  const report = {passed: failures.length === 0, failures, windows,
    stereoPeakDb: stats.peak > 0 ? 20 * Math.log10(stats.peak) : null,
    clippedSamples: stats.clipped, fullDecodeOk: true, probe: meta,
    scope: 'Start/middle/end waveform alignment, full stereo peak scan, stream parameters and complete decode. Does not verify notation or listening quality.'};
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({passed: report.passed, failures, windows}));
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  fs.writeFileSync(reportPath, JSON.stringify({passed: false, failures: [...failures, error.message]}, null, 2));
  console.error(error.message);
  process.exitCode = 1;
}
