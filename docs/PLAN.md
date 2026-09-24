# Tend plan

Tend is a daily journal that grows a garden. Every Good you write becomes a flower. Every Bad becomes a weed. When you are done with a Bad, you pull the weed, and it turns into compost that makes that week's flowers bloom bigger.

The idea comes from a real habit. One bad thing can outweigh fifty good ones in your head, and writing the Goods down pushes back on that. The name comes from "tend your own garden", which means look after yourself, enjoy your flowers and pull your weeds.

The look is risograph print on a 3D scene. The inspiration is [riso-windowseat](https://github.com/sevenevesai/riso-windowseat).

## v1 decisions

Decided in a planning session on 2026-09-23. Do not reopen these without a reason.

| Area | Decision |
|---|---|
| Users | Public app. Supabase email OTP login, same flow as Gymie. Row Level Security, so each user reads only their own entries. Account delete removes everything. |
| Entries | 1 flower per Good, 1 weed per Bad. Past dates are allowed, so a paper journal can be copied in. No streaks. A skipped day changes nothing. |
| Flowers | Each Good gets one of 5 tags, and each tag is one flower species. Default tags are people, body, work, nature and small joys. Weeds have no tag. |
| Garden | Plants go in by date, newest at the front. Old flowers stay forever. Tap a plant to read its entry. |
| Compost | A pulled weed keeps its journal entry. Flowers from the same week bloom bigger. |
| Look | 3D scene with a riso post-process filter. 3 inks, fluorescent pink, blue and yellow. Overprints give green, orange and purple. |
| Camera | Limited orbit. Pan along the timeline, turn about 30° each way, zoom a little. Flowers never get smaller than a few halftone dots. |
| Shapes | Procedural geometry in code, one function per species, seeded so every flower varies. No model files. |
| Device | Phone first, installable PWA. |
| Visitors | Logged-out visitors see a demo garden. Its data comes from a fixed seed in code, not from the database. |
| Stack | Next.js 16, React 19.2, React Three Fiber 9.8, `@react-three/postprocessing` 3.1, Supabase, Vercel. |

Not in v1: creatures, sound, share links. They are GitHub issues with the `v2` label.

## Milestones

The hours are guesses.

1. **Riso filter on a test scene.** ~6-10 h. Details below.
2. **Garden with demo data.** 5 flower species and 1 weed, instanced, placed by date, seeded demo garden, limited orbit. ~15-25 h.
3. **Journal and login.** Supabase auth, entries table with RLS, journal form with a tag picker, tap to read, pull weed into compost. ~12-20 h.
4. **Ship.** PWA install, account delete, speed pass on a real phone, card on the DEV 64 portfolio with screenshots in `devOli/public/projects/tend/`. ~6-10 h.

v1 is done when you use Tend for 2 weeks on your phone and it has a card on DEV 64.

## Milestone 1, riso filter

The filter is one custom `Effect` in the pmndrs `postprocessing` library, in `src/lib/riso-effect.ts`. For each frame it does this.

1. three.js renders the scene in normal 3D.
2. The effect splits each pixel into 3 ink amounts with a Beer-Lambert model. The pixel density relative to the paper is a mix of the 3 ink densities, and a 3x3 matrix solves that mix.
3. Each ink plate gets its own grid of round halftone dots, turned to its own angle (15°, 45°, 75°).
4. Each plate shifts a few pixels, like a misaligned print.
5. Each plate gets uneven ink and pinholes. The inks multiply onto a grainy paper color.

The test scene at `/` has 3 spheres (green, orange, purple) for the overprints, thin stems with pink, yellow and blue heads for pure inks and thin shapes, and a slow camera swing to show how the dots behave in motion.

Milestone 1 is done when all of these are true.

- On a phone, the scene reads as a print, not as a filter on a render.
- Green, orange and purple come only from overprinted inks.
- The thinnest stem that survives the dots is known. That width is the minimum for flower stems in milestone 2.
- The camera swing looks like an animated print, not a screen door.
- The scene holds about 60 fps on a mid-range phone.

If the look fails here, change the art plan before milestone 2.

### What milestone 1 found

- **Screen per pixel, not per cell.** The first version sampled one color per halftone cell. That snapped every edge to the 6 px grid and made small shapes look pixelated. Now each pixel compares its own coverage with a round spot, like a RIP does. Solid ink keeps the true edge, and only tints break into dots.
- **Ink floor.** `#0078bf` has no red, so blue over pink printed navy. Every ink channel now has a floor of 0.08 (`INK_FLOOR`), and the darkest printable color (all three inks) floors the target. Purple prints as `#4c1e74`.
- **Blotches change density, not coverage.** Thinner coverage let red leak through blue and made hard-edged patches.
- **Stem width.** Solid stems hold down to about 1.6 CSS px on a phone. Tinted or lit parts break up below one cell, 6 CSS px. Milestone 2 stems must be solid ink, or at least 6 CSS px wide at the smallest zoom.
- **Portrait.** The camera backs off below aspect 1.3 (`FIT_ASPECT`), so a 390x844 phone shows the whole test scene. The garden camera in milestone 2 needs its own rule for portrait.

## Milestone 2, garden

The timeline runs into the screen. Today is the front row, and older days recede. Every row is 4 world units wide, and the camera stands where one row plus a margin fills the screen width (`fitDistance` in `src/lib/camera-fit.ts`). Rows fade into the paper where a flower head drops under 12 CSS px, because fog in the paper color prints no ink.

### What milestone 2 found

- **Pitch depends on the aspect.** A phone's front heads are about 26 px, so the rows fade out within about twice the front distance. At a 32° pitch, that depth filled a thin band under an empty upper half of the screen. `pitchFor()` now goes from 32° on landscape to 55° on a 390x844 phone.
- **Slots follow creation order.** The k-th entry of a day takes slot k, so a new entry never moves the plants already there. Sorting by id would break that once ids are random UUIDs in milestone 3.
- **R3F fires `onClick` after a drag.** The pick mesh ignores clicks that moved more than 8 px.
- **The entry card is a sibling of the canvas.** Inside the R3F container, a tap on the card would reach the garden as a phantom hit.
