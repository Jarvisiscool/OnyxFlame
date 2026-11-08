# Recording the demo video (~80 seconds)

The app has a built-in **video mode**. It plays the whole story by itself: before, during and after a threat, the family lines and practice. Large captions appear beside the phone.

## Setup (2 minutes)
1. `git pull && npm install`. Your key goes in `.env.local`.
2. Optional: `npm run dev`, then press **N** nine times with your key so every demo message has a real Nemotron run saved in `recordings/`.
3. `npm run dev` and open http://localhost:3000 in Chrome.
4. Tick **Replay saved runs** (bottom left) so timing is smooth and doesn't depend on Wi-Fi.
5. Pick a look: **Dark mode / Light mode** link (bottom left).
6. Make the browser full screen (⌃⌘F on Mac). 1440×900 or 1280×720 looks best.

## Record
1. Start screen recording: on Mac, **⇧⌘5** → "Record entire screen" (or a selected portion around the browser).
2. Click in the page, then press **P**. The demo plays automatically (13 scenes, about 80 s).
3. Stop the recording when the last caption ("Detection is the start. Feeling protected is the product.") disappears.
- **Esc** stops video mode at any time. Press **P** again to restart from the beginning.

## Voice-over (optional)
Read each caption as it appears. The pacing leaves room for it. For a 2-minute cut, pause the recording after scene 5 (the calm pause) and narrate the judges' card on the right: Nemotron 3.5 Lightning quick check → Nemotron 3.5 Super investigation with real tools → safety rules → verdict.

## Scenes
1. Meet Maria
2. Toll text arrives and is checked privately
3. Lock-screen warning
4. In-thread warning
5. **Calm pause**
6. Recovery timeline
7. Real code gets a quiet tick
8. Dad's line (alerts only, privacy)
9. Sofia's line
10. Activity log
11. Nemotron practice lesson
12. Under the hood
13. Closing line

To change the wording or timing, edit `src/components/tour.ts`.
