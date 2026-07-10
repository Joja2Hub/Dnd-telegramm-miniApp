from __future__ import annotations

import random
from typing import Any

from app.legacy import final_generator_v25 as legacy
from app import formatters


def generate_mood_from_text(text: str, rng: random.Random | None = None) -> tuple[dict[str, Any], str]:
    """
    Формат: мораль;n;категории
    Пример: 42;3;123
    Категории: 1 бой, 2 социалка, 3 исследование.
    """
    rng = rng or random.Random()
    parts = [p.strip() for p in text.replace(",", ";").split(";")]
    if len(parts) < 3:
        raise ValueError("Введите в формате: 42;3;123")
    morale = int(parts[0])
    n = int(parts[1])
    raw_cats = parts[2]
    cats = []
    if "1" in raw_cats:
        cats.append("combat")
    if "2" in raw_cats:
        cats.append("social")
    if "3" in raw_cats:
        cats.append("exploration")
    if not cats:
        raise ValueError("Нужно выбрать категории: 1, 2, 3 или их комбинацию.")
    result = legacy.generate_cocktail(morale=morale, n=n, categories=cats, rng=rng)
    return result, formatters.generator_mood_text(result)


def generate_weather_text(rng: random.Random | None = None) -> tuple[dict[str, Any], str]:
    rng = rng or random.Random()
    w = legacy.generate_weather(rng)
    return w, formatters.weather_text(w)


def generate_events_text(rng: random.Random | None = None) -> tuple[list[dict[str, Any]], str]:
    rng = rng or random.Random()
    events = legacy.generate_location_events(rng)
    return events, formatters.location_events_text(events)
