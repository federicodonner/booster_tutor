# Booster Tutor

A small web app for playing [Booster Tutor](https://scryfall.com/card/pal04/11/booster-tutor) with physical cards.

When Booster Tutor resolves, the app opens a "pack": it picks **15 random cards, with no repeats**, from a cube on [CubeCobra](https://cubecobra.com) and shows them so you can choose one.

- **Live list.** The card list is read from CubeCobra every time you open a pack. Changes to the cube show up right away and the app stores nothing.
- **Real images.** Images come from the [Scryfall API](https://scryfall.com/docs/api), using the exact printing chosen in the cube.
- **Fast navigation.** A big card plus a strip with magnification like the macOS dock.
- **Mobile-first.** Works in portrait and landscape, on phone, tablet and desktop.
- **No dependencies.** Vanilla HTML, CSS and JS, with no build step.

## Usage

1. Tap **Abrir sobre**.
2. Scroll through the 15 cards:
   - swipe the strip at the bottom, or tap a card to bring it to the center;
   - swipe the big card left or right to go to the next or previous one;
   - tap the big card (or **Girar carta**) to flip double-faced cards;
   - on desktop: mouse wheel over the strip, `←` `→` arrows, and `Space` to flip.
3. **Nuevo sobre** goes back to the start screen. No state is saved.

## Running it locally

With Node (no dependencies, nothing to install):

```bash
npm start
```

Open <http://localhost:8765>. Since it is a static site, any other HTTP server works too (for example `python3 -m http.server 8765`).

> Opening `index.html` directly (`file://`) may fail because of browser restrictions on requests to the APIs. Use a server.

## Configuration

The cube is set in `app.js`:

```js
const CUBE_ID = "85567503-33c0-4004-a138-a8b53187da83";
```

The ID is the last part of the cube's URL: `https://cubecobra.com/cube/list/<ID>`.

You can also pick a different cube without touching the code, with the `cube` parameter:

```
http://localhost:8765/?cube=LSVCube
```

Other settings in the same file:

| Constant    | Default | What it controls                                      |
|-------------|---------|-------------------------------------------------------|
| `PACK_SIZE` | `15`    | Cards per pack                                        |
| `RADIUS`    | `2.6`   | How many cards on each side are affected by the magnification |

The dock's thumbnail size and maximum magnification are CSS variables (`--tw` and `--mag` in `styles.css`), with different values for portrait, landscape phones and large screens.

## How it works

```
[Abrir sobre]
     │
     ▼
CubeCobra  GET /cube/api/cubeJSON/<ID>      → cube list (mainboard)
     │       dedupe by card name
     │       draw 15 at random (partial Fisher–Yates)
     ▼
Scryfall   POST /cards/collection            → data and images for the 15 cards
     │       (if one isn't found, swap it for another card from the cube)
     ▼
Preload thumbnails + first big cards → show the pack
```

- **Dock:** each thumbnail's scale is computed from its distance to the center of the strip (cosine curve). Each card is shifted by the extra width of its neighbors so magnified cards don't overlap. Only `transform` is used, inside `requestAnimationFrame`, so it stays smooth on mobile. Native scroll with `scroll-snap` gives the momentum and the snapping to each card.
- **Big card:** all 15 are rendered stacked and the current one is shown with a short fade, so switching cards doesn't wait on the network.
- **Double-faced cards:** a 3D flip between the two faces Scryfall returns.

### Why CubeCobra and not Moxfield?

The idea was to read the list straight from Moxfield, but its API doesn't allow requests from other sites (no CORS) and sits behind Cloudflare, which rejects calls from servers. CubeCobra exposes the cube as public JSON with CORS enabled. You can import a Moxfield list into CubeCobra (*Import → Paste Text*).

## Structure

```
index.html   markup for both screens (start and pack)
styles.css   design, responsive layout and animations
app.js       data fetching, rendering and dock logic
server.js    minimal static server (Heroku / npm start)
package.json Node configuration for Heroku
```

## Deployment

**Heroku:** `package.json` makes Heroku detect the Node buildpack, and it runs `npm start`, which starts `server.js`. That is a minimal server with no dependencies that serves only `index.html`, `styles.css` and `app.js`, on the port set by `PORT`.

**Static hosting:** it also works on GitHub Pages, Netlify or Cloudflare Pages with no server. On GitHub Pages: *Settings → Pages → Deploy from a branch → `main` / root*.

## Credits

- Card list: [CubeCobra](https://cubecobra.com).
- Images and card data: [Scryfall](https://scryfall.com). Please follow their [usage guidelines](https://scryfall.com/docs/api).
- Magic: The Gathering and its card images are property of Wizards of the Coast. This is an unofficial fan project, not affiliated with Wizards of the Coast.
