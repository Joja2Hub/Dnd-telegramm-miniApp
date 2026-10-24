# Effect Shop

The Telegram Mini App and local site share the same catalog and API.

- 28 FX Lab effects are marked NEW and sorted before older effects in every matching category.
- New epic effects use the existing 350-750 spark range; legendary effects use 1000-2000.
- An effect includes its original palette.
- Each of the 13 fixed palettes costs 120 sparks per effect.
- Unlimited custom single-color editing costs 300 sparks per effect.
- Unlimited three-color gradient editing costs 500 sparks per effect, including its direction.
- These are permanent unlocks, not a charge for each edit. A gradient does not require buying custom color first.
- Radius adjustment from 80% to 120% is free. It is saved independently for every effect on each character and is retained when switching effects or palettes.
- Layer selection is free: original composition, entirely in front, between portrait and uploaded frame, or entirely behind both. This is also saved per effect on each character.

Every player account with a linked character can claim a one-time 500-spark shop welcome gift by clicking the floating flame. The gift marker and wallet credit are committed atomically in SQLite. The gift never repeats across campaigns, devices or backend restarts. The announcement links directly to the new-effects category. Browser UI tests mock the claim; real wallet credits are tested only in temporary databases.

Legacy recolors are hidden, not deleted from SQLite. Their owners receive the canonical effect and their existing palette for free. The migration is idempotent; existing achievement rewards using legacy IDs still grant the corresponding palette.

Purchases and style permissions are checked on the server. Applied styles are stored on characters and included in party, profile and combat responses. Shop cards show a frozen frame; only the selected modal preview animates. While a shop preview is open, background effects pause and resume on close. Other windows animate all visible effects normally.

Color changes update the selected renderer in place. Cached Canvas color blending preserves luminance and alpha without CPU pixel readbacks. Slider and color-input updates are coalesced to one update per animation frame.

Palette swatches show all fixed gradients before selection. Effect geometry uses the visible frame footprint (sampled once per frame image), independently of the transparent canvas padding. The padding provides room for glow, not extra effect scale.

The shared Canvas renderer is `frontend/effect-renderer.js`. `frontend/effect-catalog.json` supplies server metadata. After changing the preview catalog, run `node tools/sync_effect_catalog.cjs` and restart the backend.

An explicitly requested announcement replay can be queued for one account in `user_shop_gift_replays`. It does not remove the original gift receipt or award sparks again. The queue entry is consumed atomically when that player opens the announcement.

`tools/upgrade_effect_shop.py` takes a SQLite backup before applying the upgrade. The existing local launch script also applies the idempotent schema migration on startup.
