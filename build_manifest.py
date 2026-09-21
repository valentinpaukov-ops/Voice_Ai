#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Пересобирает audio/manifest.json по содержимому папки audio/.

Что делает:
  * находит все аудиофайлы в папке audio/;
  * для новых файлов вытаскивает название и автора из тегов (если есть),
    иначе собирает название из имени файла;
  * считает длительность записи;
  * СОХРАНЯЕТ то, что вы уже поправили руками в manifest.json
    (название, автора, рубрику) — правки не затираются;
  * убирает из манифеста записи, файлы которых удалили.

Порядок эфира = порядок имён файлов по алфавиту.
Поэтому удобно называть файлы с префиксом даты или номера:
    2026-09-21_itogi-nedeli.mp3
    01_utrenniy-brifing.mp3

Запуск вручную:  python tools/build_manifest.py
На GitHub запускается сам при загрузке файлов в папку audio/.
"""

import json
import os
import re
import sys
from datetime import datetime, timezone

AUDIO_DIR = "audio"
MANIFEST = os.path.join(AUDIO_DIR, "manifest.json")

AUDIO_EXT = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".opus", ".flac", ".webm"}

DEFAULT_TAG = "Эфир"
DEFAULT_HOST = "Voice Ai"

# 2026-09-21_ | 2026.09.21- | 01_ | 003-
PREFIX_RE = re.compile(r"^(\d{4}[-.]\d{2}[-.]\d{2}|\d{1,4})[ _.\-]+")
DATE_RE = re.compile(r"^(\d{4})[-.](\d{2})[-.](\d{2})")


def title_from_filename(stem: str) -> str:
    """Человеческое название из имени файла."""
    name = PREFIX_RE.sub("", stem)
    name = name.replace("_", " ").replace("-", " ")
    name = re.sub(r"\s+", " ", name).strip()
    if not name:
        name = stem
    return name[:1].upper() + name[1:]


def date_from_filename(stem: str):
    m = DATE_RE.match(stem)
    if not m:
        return None
    return "%s-%s-%s" % m.groups()


def read_tags(path: str):
    """Название, автор и длительность из тегов файла. mutagen необязателен."""
    title = artist = None
    duration = None
    try:
        from mutagen import File as MutagenFile  # type: ignore
    except ImportError:
        return title, artist, duration

    try:
        audio = MutagenFile(path, easy=True)
    except Exception:
        return title, artist, duration

    if audio is None:
        return title, artist, duration

    try:
        if getattr(audio, "info", None) is not None:
            length = getattr(audio.info, "length", None)
            if length and length > 0:
                duration = round(float(length), 1)
    except Exception:
        pass

    def first(key):
        try:
            val = audio.get(key)
        except Exception:
            return None
        if isinstance(val, list) and val:
            val = val[0]
        val = (val or "").strip() if isinstance(val, str) else None
        return val or None

    title = first("title")
    artist = first("artist") or first("albumartist")
    return title, artist, duration


def load_existing():
    if not os.path.exists(MANIFEST):
        return {}
    try:
        with open(MANIFEST, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError) as exc:
        print("  манифест не прочитан (%s) — соберу заново" % exc)
        return {}
    by_file = {}
    for item in (data.get("tracks") or []):
        if isinstance(item, dict) and item.get("file"):
            by_file[item["file"]] = item
    return by_file


def main() -> int:
    if not os.path.isdir(AUDIO_DIR):
        print("Папки %s нет — создаю." % AUDIO_DIR)
        os.makedirs(AUDIO_DIR, exist_ok=True)

    files = sorted(
        f for f in os.listdir(AUDIO_DIR)
        if os.path.splitext(f)[1].lower() in AUDIO_EXT
        and os.path.isfile(os.path.join(AUDIO_DIR, f))
    )

    existing = load_existing()
    tracks = []
    added = kept = 0

    for fname in files:
        path = os.path.join(AUDIO_DIR, fname)
        stem = os.path.splitext(fname)[0]
        prev = existing.get(fname)

        if prev:
            # запись уже была — бережём всё, что правили руками
            entry = dict(prev)
            entry["file"] = fname
            if not entry.get("duration"):
                _, _, dur = read_tags(path)
                if dur:
                    entry["duration"] = dur
            kept += 1
        else:
            tag_title, tag_artist, dur = read_tags(path)
            entry = {
                "file": fname,
                "title": tag_title or title_from_filename(stem),
                "host": tag_artist or DEFAULT_HOST,
                "tag": DEFAULT_TAG,
            }
            d = date_from_filename(stem)
            if d:
                entry["date"] = d
            if dur:
                entry["duration"] = dur
            added += 1
            print("  + %s — «%s»" % (fname, entry["title"]))

        entry["size"] = os.path.getsize(path)
        tracks.append(entry)

    removed = [f for f in existing if f not in set(files)]
    for f in removed:
        print("  - %s (файла больше нет)" % f)

    manifest = {
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tracks": tracks,
    }

    os.makedirs(AUDIO_DIR, exist_ok=True)
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    total_mb = sum(t.get("size", 0) for t in tracks) / 1e6
    print(
        "Готово: в эфире %d записей (новых %d, сохранено %d, удалено %d), %.1f МБ."
        % (len(tracks), added, kept, len(removed), total_mb)
    )
    if total_mb > 700:
        print("ВНИМАНИЕ: приближаемся к лимиту GitHub Pages в 1 ГБ на сайт.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
