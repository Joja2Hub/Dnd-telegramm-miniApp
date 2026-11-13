# Profile Banner Shop

Banners belong to player accounts and appear both in the hub and in character
profile previews. The shop includes a framed-character preview and category
filters. The banner section is available both in standalone shop and ordinary
character customization settings. Buying unlocks the banner for the account;
applying from the shop changes only the current owned character. The hub profile
editor separately offers only purchased banners for account decoration.

Prices before discounts: textures 350 sparks, biomes 500, elements 600,
class-themed banners 650, magic 600, city panoramas 700, cyberpunk patterns 400,
cyberpunk locations 650. Existing selected banners are migrated as owned
without charging the player. The standard background can always be restored.

Ownership lives in `user_banner_unlocks`; characters store `custom_banner_id`,
while the hub keeps `player_profiles.profile_json.banner_path`. Purchases use the same atomic
transaction and strongest-active-discount rules as other cosmetics.

API: `GET /api/shop/banners`, `POST /api/shop/purchase` with `item_type=banner`,
and `POST /api/shop/banners/{banner_id}/equip`. Send `character_id` to apply to
that owned character, or omit it for account profile application. Use `default`
to clear the banner. Character application never changes the hub banner.

Tests: `tests/test_profile_banners.py`, `tests/test_local_hub.py`,
and `tests/profile-banners.browser.cjs`. Browser purchases are mocked and do
not modify real balances or profiles.
# Дополнительный тёмный набор

Из сценарных превью выбраны семь баннеров: Дворцовая ночь в Калимшане и Огни Питвина (по 700 искр), Банкомат на буксире (650), Гоблинские леса Мунвуда и Лунная полынь у озера (по 500), Корона пещерного короля и Замок Тёмных Снов над Миринджаром (по 600). Всего в магазине 66 баннеров. Остальные сценарные превью не опубликованы. Внешность короны на баннере является художественной интерпретацией, а не установленным описанием артефакта.

Фэнтези-расширение: ещё 13 изображений, всего 59 баннеров. Добавлены воин, варвар, жрец, монах, чародей и колдун (650 искр); красный и ледяной драконы, бехолдер и кракен (категория «Драконы и чудовища», 700); кладбище колоссов (600), караван (500), библиотека под корнями (600). Все изображения созданы встроенным image_gen; исходные промпты и файлы перечислены в `profile-banners.json`, готовые WebP и миниатюры лежат в `frontend/assets/profile-banners/`.

9 баннеров: чёрно-жёлтый узор, Глубокая Сеть, Чёрный заслон, четыре мрачных фэнтези-пейзажа и два демонических мотива.

Цены: узоры — 400 искр; Сеть и тёмное фэнтези — 600; Бездна — 650. Покупка открывает баннер для аккаунта; применение персонажу и декор профиля остаются независимыми. Промпты и имена исходников находятся в `profile-banners.json`.

