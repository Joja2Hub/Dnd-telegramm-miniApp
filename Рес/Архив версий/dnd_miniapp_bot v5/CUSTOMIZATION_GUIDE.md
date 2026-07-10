# Как в будущем добавлять только кастомизацию

Есть два основных файла:

```text
app/db.py
frontend/styles.css
```

Дополнительно при необходимости:
```text
frontend/app.js
```

## 1. Добавить новый эффект

В `app/db.py` найди `COSMETIC_EFFECT_LIBRARY` или блок расширения `COSMETIC_EFFECT_LIBRARY.extend([...])`.

Добавь объект:

```python
{
    "id": "my_new_effect",
    "name": "Название эффекта",
    "description": "Описание эффекта.",
    "rarity": "rare",              # common / rare / epic / legendary
    "category": "unique",          # чтобы эффект был в магазине
    "css_class": "effect-my-new-effect",
    "emoji": "✨",
    "sort_order": 2000,
}
```

Потом в `frontend/styles.css` добавь CSS:

```css
.avatar.effect-my-new-effect::before,
.frame-demo.effect-my-new-effect::before,
.effect-preview-layer.effect-my-new-effect::before {
  inset: -18px;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.9) 0 3px, transparent 4px);
  animation: myEffectAnim 2s ease-in-out infinite;
}

@keyframes myEffectAnim {
  0%, 100% { transform: scale(.95); opacity: .4; }
  50% { transform: scale(1.08); opacity: 1; }
}
```

Важно: анимацию не нужно отдельно останавливать. В v48 уже есть общий CSS/JS, который ставит эффекты на паузу и включает их только по hover/tap/click.

## 2. Добавить новую рамку

В `app/db.py` добавь в `COSMETIC_LIBRARY.extend([...])`:

```python
{
    "id": "my_new_frame",
    "name": "Новая рамка",
    "description": "Описание рамки.",
    "rarity": "epic",
    "category": "unique",
    "css_class": "frame-my-new-frame",
    "emoji": "💠",
    "sort_order": 2000,
}
```

В `frontend/styles.css` добавь переменные:

```css
.frame-my-new-frame {
  --frame-a: #67e8f9;
  --frame-b: #a855f7;
  --frame-c: #f8fafc;
  animation-duration: 3s;
}
```

## 3. Добавить форму тэга

В `app/db.py` добавь в `TAG_LIBRARY` или `TAG_LIBRARY.extend([...])`:

```python
{
    "id": "tag_shape_my_shape",
    "name": "Моя форма",
    "description": "Описание формы.",
    "rarity": "rare",
    "category": "tag_shape",
    "css_class": "tag-my-shape",
    "emoji": "🏷️",
    "sort_order": 2000,
}
```

В `frontend/styles.css`:

```css
.character-tag.tag-my-shape {
  background: linear-gradient(90deg, #111827, #6366f1);
  border-radius: 999px;
}
```

## 4. Добавить текст тэга

В `app/db.py`:

```python
{
    "id": "tag_text_my_title",
    "name": "Кровожадный",
    "description": "Текст тэга.",
    "rarity": "epic",
    "category": "tag_text",
    "css_class": "",
    "emoji": "",
    "sort_order": 2000,
}
```

## 5. Что делать после изменения

Если бот уже запущен:
1. Останови сервер.
2. Запусти снова.

При старте `Database.init_schema()` автоматически вызывает:
- `seed_cosmetics()`
- `seed_cosmetic_effects()`
- `seed_tags()`

То есть новые записи добавятся в базу сами.

## 6. Как не сломать будущие обновления

Лучше добавлять кастомизацию отдельными блоками внизу `app/db.py`, например:

```python
# v49: custom cosmetics
COSMETIC_EFFECT_LIBRARY.extend([
    ...
])
```

А CSS тоже добавлять отдельным блоком в конец `frontend/styles.css`:

```css
/* v49 custom cosmetics */
...
```

Так проще переносить только кастомизацию между версиями проекта.
