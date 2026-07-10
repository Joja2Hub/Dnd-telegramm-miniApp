from __future__ import annotations

import io
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from PIL import Image, ImageOps, UnidentifiedImageError

ImageKind = Literal["avatar", "achievement", "frame"]


@dataclass(frozen=True)
class OptimizedImage:
    asset_path: str
    thumb_path: str
    asset_file: Path
    thumb_file: Path


KIND_SETTINGS: dict[str, tuple[int, int, int]] = {
    # main_px, thumb_px, quality
    "avatar": (512, 128, 82),
    "achievement": (768, 160, 88),
    "frame": (768, 192, 88),
}


def _safe_stem(stem: str) -> str:
    out = "".join(ch.lower() if ch.isalnum() else "_" for ch in str(stem or "image"))
    out = "_".join(part for part in out.split("_") if part)
    return out[:80] or "image"


def _open_rgba(raw: bytes) -> Image.Image:
    if not raw:
        raise ValueError("Пустой файл")
    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)
        return img.convert("RGBA")
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError("Не удалось прочитать изображение") from exc


def _center_frame_hole(canvas: Image.Image) -> Image.Image:
    """Center the transparent inner hole of an avatar frame on the canvas center.

    Many decorative frames have spikes or ornaments, so centering by the visible alpha
    bounding box shifts the avatar hole. We instead find the largest transparent
    component not touching the image edge and translate the whole frame so that this
    hole is centered. If no inner hole is found, the image is returned unchanged.
    """
    if canvas.mode != "RGBA":
        canvas = canvas.convert("RGBA")
    w, h = canvas.size
    if w < 32 or h < 32:
        return canvas
    alpha = canvas.getchannel("A")
    data = alpha.load()
    visited = bytearray(w * h)
    best_count = 0
    best_sum_x = 0
    best_sum_y = 0
    # Transparent threshold: keeps soft antialiasing out of the hole mask.
    threshold = 18

    from collections import deque

    def idx(x: int, y: int) -> int:
        return y * w + x

    # Ignore the outermost edge by starting from 1..w-2. Edge-touching components
    # are the outside transparency and are not useful.
    for sy in range(1, h - 1):
        base = sy * w
        for sx in range(1, w - 1):
            k = base + sx
            if visited[k] or data[sx, sy] > threshold:
                continue
            q = deque([(sx, sy)])
            visited[k] = 1
            touches_edge = False
            count = 0
            sum_x = 0
            sum_y = 0
            while q:
                x, y = q.popleft()
                count += 1
                sum_x += x
                sum_y += y
                if x <= 0 or y <= 0 or x >= w - 1 or y >= h - 1:
                    touches_edge = True
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    ni = idx(nx, ny)
                    if not visited[ni] and data[nx, ny] <= threshold:
                        visited[ni] = 1
                        q.append((nx, ny))
            if not touches_edge and count > best_count:
                best_count, best_sum_x, best_sum_y = count, sum_x, sum_y

    # Avoid tiny decorative transparent gaps. The avatar hole should be meaningful.
    if best_count < (w * h * 0.03):
        return canvas
    cx = best_sum_x / best_count
    cy = best_sum_y / best_count
    dx = int(round(w / 2 - cx))
    dy = int(round(h / 2 - cy))
    if abs(dx) <= 1 and abs(dy) <= 1:
        return canvas
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.alpha_composite(canvas, (dx, dy))
    return out


def _fit_square(img: Image.Image, px: int, *, contain: bool) -> Image.Image:
    """Return square RGBA image. Avatars/icons are cropped; frames keep full canvas and hole-centered."""
    if contain:
        # Do NOT alpha-crop decorative frames: their visible bbox can be asymmetric
        # because of spikes/ornaments. Fit the whole uploaded canvas into a square,
        # then align the transparent inner hole with the exact center.
        img.thumbnail((px, px), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        canvas.alpha_composite(img, ((px - img.width) // 2, (px - img.height) // 2))
        return _center_frame_hole(canvas)
    return ImageOps.fit(img, (px, px), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def optimize_upload(
    raw: bytes,
    *,
    upload_root: Path,
    kind: ImageKind,
    stem: str,
    max_bytes: int | None = None,
) -> OptimizedImage:
    """Convert upload to optimized WebP + thumbnail WebP and return public paths."""
    if max_bytes is not None and len(raw) > max_bytes:
        raise ValueError(f"Файл слишком большой. Максимум {max_bytes // (1024 * 1024)} МБ")
    if kind not in KIND_SETTINGS:
        raise ValueError("Неизвестный тип изображения")
    main_px, thumb_px, quality = KIND_SETTINGS[kind]
    img = _open_rgba(raw)
    stem = _safe_stem(stem)
    folder = {"avatar": "avatars", "achievement": "achievements", "frame": "frames"}[kind]
    root = Path(upload_root) / folder
    thumbs = root / "thumbs"
    root.mkdir(parents=True, exist_ok=True)
    thumbs.mkdir(parents=True, exist_ok=True)

    # For frames keep the whole transparent ornament; for avatars/icons crop to square.
    contain = kind == "frame"
    main_img = _fit_square(img.copy(), main_px, contain=contain)
    thumb_img = _fit_square(img.copy(), thumb_px, contain=contain)

    main_file = root / f"{stem}.webp"
    thumb_file = thumbs / f"{stem}_thumb.webp"
    main_img.save(main_file, "WEBP", quality=quality, method=6, lossless=False)
    thumb_img.save(thumb_file, "WEBP", quality=max(68, quality - 6), method=6, lossless=False)
    return OptimizedImage(
        asset_path=f"/uploads/{folder}/{main_file.name}",
        thumb_path=f"/uploads/{folder}/thumbs/{thumb_file.name}",
        asset_file=main_file,
        thumb_file=thumb_file,
    )


def optimized_thumb_path(asset_path: str) -> str:
    """Return conventional thumb path for an already optimized asset path."""
    text = str(asset_path or "")
    if not text.startswith("/uploads/"):
        return ""
    path = Path(text)
    return str(path.parent / "thumbs" / f"{path.stem}_thumb.webp").replace("\\", "/")
