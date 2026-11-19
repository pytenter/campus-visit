#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Compose an actual browser recording with measured Chinese speech and subtitles.

Run from the project root after ``node video/record.mjs`` has completed::
    /path/to/python3 video/compose.py

No website source is changed. ``--allow-short`` is only for technical dry runs.
"""
from __future__ import annotations

import argparse
from array import array
import datetime as dt
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import wave

ROOT = Path(__file__).resolve().parent.parent
VIDEO = ROOT / "video"
PREFIX = "saturday-campus-explained-zh"
FPS = 25
FONT = "Noto Sans SC"


def run(args: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run([str(x) for x in args], check=True, **kwargs)


def ffmpeg_binary(override: str | None) -> str:
    for candidate in [override, shutil.which("ffmpeg")]:
        if candidate and Path(candidate).is_file():
            return candidate
    try:
        import imageio_ffmpeg
        candidate = imageio_ffmpeg.get_ffmpeg_exe()
        if Path(candidate).is_file():
            return candidate
    except ImportError:
        pass
    raise RuntimeError("找不到 FFmpeg。请安装支持 libass/libx264 的版本或通过 --ffmpeg 指定。")


def probe(binary: str, file: Path) -> dict:
    result = subprocess.run([binary, "-hide_banner", "-i", str(file)], capture_output=True, text=True)
    text = result.stderr
    match = re.search(r"Duration:\s*(\d+):(\d+):([\d.]+)", text)
    duration = int(match[1]) * 3600 + int(match[2]) * 60 + float(match[3]) if match else None
    return {"duration": duration, "video": "Video:" in text, "audio": "Audio:" in text,
            "h264": bool(re.search(r"Video:\s*h264", text)), "aac": bool(re.search(r"Audio:\s*aac", text)),
            "full_hd": bool(re.search(r"\b1920x1080\b", text)), "raw": text}


def audio_metrics(binary: str, movie: Path) -> dict:
    result = subprocess.run([binary, "-hide_banner", "-i", str(movie), "-vn", "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True, check=True)
    mean = re.search(r"mean_volume:\s*(-?[\d.]+) dB", result.stderr)
    maximum = re.search(r"max_volume:\s*(-?[\d.]+) dB", result.stderr)
    if not mean or not maximum:
        raise RuntimeError("成片声音没有可测量的有效音量。")
    values = {"mean_dbfs": float(mean[1]), "max_dbfs": float(maximum[1])}
    if values["mean_dbfs"] < -45 or values["max_dbfs"] < -20:
        raise RuntimeError(f"成片声音过小或接近静音：{values}")
    return values


def marker_offset(binary: str, raw: Path) -> float:
    """Locate the first production frame after the removable magenta slate."""
    for window in (20, 60):
        args = [binary, "-v", "error", "-i", str(raw), "-t", str(window),
                "-vf", f"fps={FPS},crop=4:4:0:0,scale=1:1:flags=area,format=rgb24",
                "-an", "-f", "rawvideo", "pipe:1"]
        data = run(args, capture_output=True).stdout
        matches = [i // 3 for i in range(0, len(data) - 2, 3)
                   if data[i] > 220 and data[i + 1] < 65 and data[i + 2] > 220]
        if matches:
            # A one-second slate must occupy many frames, never a single random pixel.
            if len(matches) < 8:
                raise RuntimeError(f"定位标记只有 {len(matches)} 帧，不能可靠同步。")
            offset = (matches[-1] + 1) / FPS
            print(f"SYNC trim={offset:.3f}s marker_frames={len(matches)}", flush=True)
            return offset
    raise RuntimeError("视频前60秒未找到洋红定位标记，不能可靠同步旁白。")


def audio_file(line: dict) -> Path:
    value = Path(line["file"])
    return value if value.is_absolute() else VIDEO / value


def validate_recording(record: dict, allow_short: bool) -> tuple[float, list[dict]]:
    if record.get("errors"):
        raise RuntimeError("浏览器录制有未解决的 pageerror：" + repr(record["errors"]))
    segments = record.get("segments", [])
    if not segments:
        raise RuntimeError("录制没有时间线。")
    lines = sorted((line for segment in segments for line in segment.get("lines", [])), key=lambda x: x["start"])
    if not lines:
        raise RuntimeError("录制没有逐句旁白时间。")
    duration = max(float(record.get("duration", 0)), max(float(x["end"]) for x in lines) + .3)
    if not allow_short:
        if len(segments) != 30 or len(lines) < 85 or duration < 300:
            raise RuntimeError("当前清单看起来是排练/未完成录制；正式合成须30段、完整旁白且至少300秒。")
        for before, after in zip(lines, lines[1:]):
            if float(after["start"]) < float(before["end"]) - .04:
                raise RuntimeError("旁白时间重叠，可能用了加速排练清单。")
    for line in lines:
        source = audio_file(line)
        if not source.is_file() or source.stat().st_size < 100:
            raise RuntimeError(f"缺少实际音频：{source}")
    return duration, lines


def make_voice_track(lines: list[dict], duration: float, target: Path) -> dict:
    rate = 24000
    pcm = bytearray(math.ceil((duration + .3) * rate) * 2)
    spoken_frames = 0
    peak = 0
    for line in lines:
        with wave.open(str(audio_file(line)), "rb") as wav:
            if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (1, 2, rate):
                raise RuntimeError(f"音频格式不一致：{audio_file(line)}")
            frames = wav.readframes(wav.getnframes())
            actual = len(frames) / 2 / rate
        if abs(actual - float(line["duration"])) > .025:
            raise RuntimeError(f"音频时长与时间线不一致：{audio_file(line)}")
        at = round(float(line["start"]) * rate) * 2
        pcm[at:at + len(frames)] = frames
        spoken_frames += len(frames) // 2
        values = array("h", frames)
        if sys.byteorder != "little":
            values.byteswap()
        if values:
            peak = max(peak, max(abs(value) for value in values))
    if peak < 100:
        raise RuntimeError("旁白音轨接近静音。")
    with wave.open(str(target), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(pcm)
    return {"sample_rate": rate, "channels": 1, "peak_pcm": peak,
            "spoken_seconds": spoken_frames / rate, "timeline_seconds": duration}


def ass_time(value: float) -> str:
    ticks = max(0, round(value * 100))
    h, rest = divmod(ticks, 360000)
    m, rest = divmod(rest, 6000)
    s, cs = divmod(rest, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def srt_time(value: float) -> str:
    ticks = max(0, round(value * 1000))
    h, rest = divmod(ticks, 3600000)
    m, rest = divmod(rest, 60000)
    s, ms = divmod(rest, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def clock(value: float) -> str:
    total = int(value)
    return f"{total // 60:02d}:{total % 60:02d}"


def ass_text(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "｛").replace("}", "｝").replace("\n", r"\N")


def wrap_caption(text: str, max_units: float = 36) -> str:
    # ASCII IDs take less room than Chinese glyphs. Prefer a single readable line.
    rows, current, units = [], "", 0.0
    for char in text:
        weight = .55 if ord(char) < 128 else 1
        if current and units + weight > max_units:
            rows.append(current)
            current, units = "", 0
        current += char
        units += weight
    if current:
        rows.append(current)
    if len(rows) > 2:
        raise RuntimeError("字幕超过两行，请先缩短该句旁白：" + text)
    return "\n".join(rows)


def make_subtitles(record: dict, lines: list[dict], duration: float, out: Path) -> tuple[Path, Path]:
    ass_file = out / f"{PREFIX}.ass"
    srt_file = out / f"{PREFIX}.srt"
    header = f"""[Script Info]
Title: 如果周六由你开校门 · 中文项目讲解
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Project,{FONT},27,&H0078F0B9,&H00FFFFFF,&H00102F36,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,4,30,30,0,1
Style: Chapter,{FONT},29,&H00F5FAF6,&H00FFFFFF,&H00102F36,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,4,30,30,0,1
Style: Topic,{FONT},22,&H00C7DDDA,&H00FFFFFF,&H00102F36,&H00000000,0,0,0,0,100,100,0,0,1,0,0,6,30,30,0,1
Style: Subtitle,{FONT},43,&H00FFFFFF,&H00FFFFFF,&H00302616,&H80000000,0,0,0,0,100,100,0,0,1,1.5,0,5,80,80,0,1
Style: Observe,{FONT},30,&H0078F0B9,&H00FFFFFF,&H00302616,&H80000000,0,0,0,0,100,100,0,0,1,0,0,5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events: list[str] = []
    def event(start: float, end: float, style: str, text: str, position: str, layer: int = 0):
        if end > start:
            events.append(f"Dialogue: {layer},{ass_time(start)},{ass_time(end)},{style},,0,0,0,,{{{position}}}{ass_text(text)}")
    event(0, duration, "Project", "如果周六由你开校门", r"\an4\pos(32,36)")
    for index, segment in enumerate(record["segments"]):
        start = 0 if index == 0 else float(segment["start"])
        end = float(record["segments"][index + 1]["start"]) if index + 1 < len(record["segments"]) else duration
        event(start, end, "Chapter", segment["chapter"], r"\an4\pos(530,36)")
        event(start, end, "Topic", segment["title"], r"\an6\pos(1888,36)")
        if segment["id"].startswith(("17_", "19_")) and segment.get("lines"):
            gap = float(segment["lines"][-1]["end"]) + .2
            if float(segment["end"]) - gap > .5:
                event(gap, float(segment["end"]), "Observe", "原速重放中，请观察学生通行与访客路线", r"\an5\pos(960,1026)")
    srt = []
    for i, line in enumerate(lines):
        start = float(line["start"])
        end = min(duration, float(line["end"]) + .2)
        if i + 1 < len(lines):
            end = min(end, float(lines[i + 1]["start"]) - .03)
        text = wrap_caption(line["text"])
        srt.append(f"{i + 1}\n{srt_time(start)} --> {srt_time(end)}\n{text}\n")
        event(start, end, "Subtitle", text, r"\an5\pos(960,1026)", layer=1)
    ass_file.write_text(header + "\n".join(events) + "\n", encoding="utf-8-sig")
    srt_file.write_text("\n".join(srt), encoding="utf-8-sig")
    return ass_file, srt_file


def make_chapters(record: dict, duration: float, out: Path) -> tuple[Path, list[dict]]:
    groups = []
    for segment in record["segments"]:
        if not groups or groups[-1]["title"] != segment["chapter"]:
            groups.append({"start": 0.0 if not groups else float(segment["start"]), "title": segment["chapter"]})
    for i, group in enumerate(groups):
        group["end"] = groups[i + 1]["start"] if i + 1 < len(groups) else duration
    (out / "chapters.txt").write_text("\n".join(f"{clock(g['start'])} {g['title']}" for g in groups) + "\n", encoding="utf-8")
    metadata = out / f"{PREFIX}.ffmetadata"
    def escape(text: str):
        return text.replace("\\", "\\\\").replace("=", r"\=").replace(";", r"\;").replace("#", r"\#").replace("\n", " ")
    content = ";FFMETADATA1\ntitle=如果周六由你开校门 · 中文项目讲解\n"
    for group in groups:
        content += f"\n[CHAPTER]\nTIMEBASE=1/1000\nSTART={round(group['start'] * 1000)}\nEND={round(group['end'] * 1000)}\ntitle={escape(group['title'])}\n"
    metadata.write_text(content, encoding="utf-8")
    return metadata, groups


def encode(binary: str, raw: Path, offset: float, duration: float, voice: Path,
           ass: Path, metadata: Path, movie: Path, log: Path, threads: int):
    # Relative filter paths avoid escaping the user's Chinese workspace name.
    ass_relative = ass.relative_to(ROOT).as_posix()
    filter_chain = (
        f"trim=start={offset:.6f},setpts=PTS-STARTPTS,scale=1920:900:flags=lanczos,"
        "pad=1920:1080:0:72:color=0x102f36,"
        f"fps={FPS},tpad=stop_mode=clone:stop_duration=2,trim=duration={duration:.6f},"
        f"ass=filename='{ass_relative}':fontsdir='video/work/fonts',"
        f"fade=t=in:st=0:d=0.3,fade=t=out:st={max(0, duration - .5):.6f}:d=0.5"
    )
    args = [binary, "-y", "-hide_banner", "-i", str(raw), "-i", str(voice),
            "-f", "ffmetadata", "-i", str(metadata), "-map", "0:v:0", "-map", "1:a:0",
            "-map_metadata", "2", "-map_chapters", "2", "-vf", filter_chain,
            "-af", f"loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,afade=t=out:st={max(0, duration - .35):.6f}:d=0.35",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
            "-threads", str(threads), "-r", str(FPS), "-g", "50", "-c:a", "aac", "-b:a", "160k",
            "-t", f"{duration:.6f}", "-movflags", "+faststart", "-metadata", "title=如果周六由你开校门 · 中文项目讲解",
            "-metadata", "comment=实际桌面浏览器录制，中文合成旁白与嵌入式字幕；课堂原型，尚无实体头显实测。",
            "-progress", "pipe:1", "-nostats", str(movie)]
    (log.parent / "encode-command.json").write_text(json.dumps(args, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"ENCODE 0% duration={duration:.2f}s", flush=True)
    with log.open("w", encoding="utf-8") as errors:
        process = subprocess.Popen(args, cwd=ROOT, stdout=subprocess.PIPE, stderr=errors, text=True)
        last = 0.0
        for text in process.stdout:
            if text.startswith("out_time_us="):
                try:
                    current = int(text.strip().split("=", 1)[1]) / 1e6
                except ValueError:
                    continue
                if current >= last + 15:
                    print(f"ENCODE {min(100, current / duration * 100):.1f}% time={clock(current)}", flush=True)
                    last = current
        code = process.wait()
    if code:
        raise RuntimeError(f"FFmpeg合成失败({code})：\n" + log.read_text(encoding="utf-8")[-6000:])
    print("ENCODE 100%", flush=True)


def screenshots(binary: str, movie: Path, record: dict, duration: float, out: Path):
    from PIL import Image, ImageDraw, ImageFont
    qa = out / "qa"
    qa.mkdir(exist_ok=True)
    wanted = ["01_", "04_", "09_", "17_", "19_", "26_", "29_", "30_"]
    samples = []
    for prefix in wanted:
        segment = next((s for s in record["segments"] if s["id"].startswith(prefix)), None)
        if not segment:
            continue
        elapsed = 10 if prefix in ("17_", "19_") else 7 if prefix == "29_" else 4
        at = min(duration - 1, float(segment["start"]) + min(elapsed, max(1, float(segment["end"]) - float(segment["start"]) - .5)))
        target = qa / f"{segment['id']}.png"
        run([binary, "-y", "-v", "error", "-ss", f"{at:.4f}", "-i", str(movie), "-frames:v", "1", str(target)], capture_output=True)
        samples.append({"file": str(target), "at": at, "chapter": segment["chapter"], "title": segment["title"]})
    if not samples:
        raise RuntimeError("未能提取预览帧。")
    shutil.copyfile(samples[0]["file"], out / "poster.png")
    thumb_w, thumb_h, label_h = 640, 360, 54
    sheet = Image.new("RGB", (thumb_w * 2, (thumb_h + label_h) * math.ceil(len(samples) / 2)), "#102f36")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype(str(ROOT / "public/assets/NotoSansSC-Regular.otf"), 19)
    for i, sample in enumerate(samples):
        x, y = (i % 2) * thumb_w, (i // 2) * (thumb_h + label_h)
        with Image.open(sample["file"]) as source:
            sheet.paste(source.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS), (x, y))
        draw.text((x + 12, y + thumb_h + 8), f"{clock(sample['at'])}  {sample['chapter']}", font=font, fill="#b9f078")
    sheet.save(out / "qa-contact-sheet.png")
    return samples


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--recording", default=str(VIDEO / "work/recording.json"))
    parser.add_argument("--output-dir", default=str(VIDEO / "output"))
    parser.add_argument("--ffmpeg")
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--allow-short", action="store_true", help="Only for clearly labelled technical dry runs")
    parser.add_argument("--skip-decode-check", action="store_true")
    args = parser.parse_args()
    binary = ffmpeg_binary(args.ffmpeg)
    recording = Path(args.recording).resolve()
    record = json.loads(recording.read_text(encoding="utf-8"))
    raw = Path(record["raw"])
    if not raw.is_file():
        raise RuntimeError(f"找不到原始录屏：{raw}")
    duration, lines = validate_recording(record, args.allow_short)
    out = Path(args.output_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    # Keep filter paths portable and predictable for FFmpeg's filter grammar.
    if not out.is_relative_to(ROOT):
        raise RuntimeError("输出目录须位于项目目录内，以便使用安全的相对字幕路径。")
    font_dir = VIDEO / "work/fonts"
    font_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / "public/assets/NotoSansSC-Regular.otf", font_dir / "NotoSansSC-Regular.otf")
    offset = marker_offset(binary, raw)
    voice = out / f"{PREFIX}-narration.wav"
    audio = make_voice_track(lines, duration, voice)
    ass, srt = make_subtitles(record, lines, duration, out)
    metadata, chapters = make_chapters(record, duration, out)
    movie = out / f"{PREFIX}.mp4"
    started = time.monotonic()
    encode(binary, raw, offset, duration, voice, ass, metadata, movie, out / "encode.log", max(1, args.threads))
    media = probe(binary, movie)
    if not all(media.get(key) for key in ("video", "audio", "h264", "aac", "full_hd")):
        raise RuntimeError("成片格式验证失败：" + media["raw"])
    if media["duration"] is None or abs(media["duration"] - duration) > .25:
        raise RuntimeError(f"成片时长不匹配：{media['duration']} vs {duration}")
    if movie.stat().st_size < 100000:
        raise RuntimeError("成片文件异常小。")
    if not args.skip_decode_check:
        print("VERIFY decoding video and audio", flush=True)
        run([binary, "-v", "error", "-i", str(movie), "-f", "null", "-"], capture_output=True)
    audio_level = audio_metrics(binary, movie)
    samples = screenshots(binary, movie, record, duration, out)
    report = {"kind": "technical-dry-run" if args.allow_short else "full-project-explanation",
              "recording": str(recording), "movie": str(movie), "duration": media["duration"], "fps": FPS,
              "resolution": "1920x1080", "video_codec": "H.264", "audio_codec": "AAC", "sample_rate": 48000,
              "hard_subtitles": True, "voice": "macOS Tingting / Mandarin / synthetic voice", "subtitle_cues": len(lines),
              "sections": len(record["segments"]), "chapters": chapters, "trim_offset": offset,
              "marker_alignment_precision_seconds": 1 / FPS, "audio": audio, "encoded_audio_level": audio_level, "bytes": movie.stat().st_size,
              "full_decode_verified": not args.skip_decode_check, "browser_errors": record.get("errors", []),
              "samples": samples, "encode_seconds": time.monotonic() - started}
    (out / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    note = "技术排练文件，不能当作正式讲解交付。\n\n" if args.allow_short else ""
    readme = f"""# 《如果周六由你开校门》中文讲解视频

{note}成片：`{PREFIX}.mp4`，时长 {clock(duration)}，1920×1080，25 fps，H.264/AAC。中文字幕已嵌入画面，打开 MP4 即可同时看到字幕、听到讲解。

视频实际录制本地网站中的点击、规则比较、两个原速人物重放、移桌、暂缓审批、重新通过、发布与下一位访客体验。中文旁白使用系统普通话合成声音 Tingting。手机画面为浏览器尺寸演示；本视频是桌面录制，没有实体头显实测。

- `{PREFIX}.srt`：可修改的逐句中文字幕。
- `{PREFIX}.ass`：标题栏、章节与字幕的排版源文件。
- `{PREFIX}-narration.wav`：重建时生成的中文旁白，不纳入源码仓库。
- `chapters.txt`：章节时间点。
- `poster.png`：成片预览图。
- `qa-contact-sheet.png`：本地重建产生的检视图，不纳入源码仓库。
- `verification.json`：本地重建产生的检查记录，不纳入源码仓库。

重建：在项目根目录运行 `python3 video/compose.py`。需要支持 libass、libx264 的 FFmpeg，可通过 `--ffmpeg /absolute/path/to/ffmpeg` 指定。字体使用项目自带的 Noto Sans SC，许可随 `public/assets/` 保留。旁白原文与逐句音频在 `video/narration.json`、`video/assets/`，录制脚本在 `video/record.mjs`。

全部制度情境、资源额度和格网结果属于课堂原型，真实效果仍待观察、访谈和现场测试。录屏中的演示身份固定为 O09，以便清楚比较 A/B 的结果，网站正式交互仍按原逻辑抽取身份。
"""
    (out / "README.md").write_text(readme, encoding="utf-8")
    print(f"COMPLETE {movie} duration={duration:.3f}s bytes={movie.stat().st_size}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR {error}", file=sys.stderr, flush=True)
        raise
