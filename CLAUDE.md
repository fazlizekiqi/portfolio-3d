# portfolio-3d — Project Overview for AI Assistants

## What this application is

An **interactive 3D portfolio website** for Fazli Zekiqi, Senior Software Engineer based in Stockholm, Sweden.
Built with **Three.js + Vite**. Instead of a static résumé page, the portfolio is a real-time 3D scene rendered
entirely in the browser where a humanoid avatar (representing the engineer) acts, animates, and transforms to
deliver each section of the CV as a cinematic experience.

---

## Tech stack

| Layer | Technology |
|---|---|
| 3D engine | Three.js (WebGL) |
| Build tool | Vite |
| Language | Vanilla JavaScript (ES modules) |
| Models | GLTF/GLB (character + environment) |
| Shaders | Custom GLSL injected via `onBeforeCompile` and `ShaderMaterial` |
| UI | Vanilla DOM / CSS (no framework) |
| Controls | OrbitControls (presentation) · WASD + mobile joystick (free mode) |

---

## Repository structure

```
portfolio-3d/
├── index.html
├── vite.config.js
├── package.json
├── public/
│   ├── models/           # character.glb, env-2-redone-bigger.glb
│   ├── experience/       # company logo wireframe PNGs
│   ├── projects/         # project screenshot PNGs
│   └── how-i-work/       # principle illustration PNGs
└── src/
    ├── main.js           # entry point — render loop
    ├── scene.js          # Three.js scene, camera, renderer, lights
    ├── layers.js         # render layer constants (BLUE / WHITE world)
    ├── loader.js         # loading screen
    ├── fps.js            # FPS counter (dev)
    ├── gui.js            # dat.GUI debug panel (dev)
    ├── joystick.js       # mobile virtual joystick
    ├── transition.js     # iris wipe transition between worlds
    ├── style.css
    ├── character/
    │   ├── model.js          # GLB load, animation mixer, clip helpers
    │   ├── player.js         # WASD third-person controller
    │   ├── about-wireframe.js # About Me hologram burn/reveal effect
    │   └── explode.js        # particle explosion on world transition
    ├── presentation/
    │   ├── slides.js         # pure slide data (no side-effects)
    │   ├── presentation.js   # orchestrator — wires slides, camera, UI
    │   ├── camera.js         # camera move/drift/easing helpers
    │   ├── bubbles.js        # skill + project bubble/card system
    │   ├── ui.js             # all DOM elements and visibility helpers
    │   └── how-i-work-overlay.js
    ├── world/
    │   ├── blueworld.js      # blue presentation environment
    │   ├── whiteworld.js     # white free-exploration environment
    │   └── tornado-travel.js # tornado particle travel effect
    └── shaders/
        ├── background.*      # animated background gradient
        ├── blueprint.*       # blueprint grid effect
        ├── cartoon.*         # cel-shading inject (white world)
        ├── explode.*         # particle explode shader
        ├── raindrop.*        # rain particle shader
        ├── tornado.*         # tornado travel shader
        └── transition.*      # iris wipe shader
```

---

## Two worlds

### Blue world — Presentation mode
The default mode. A linear cinematic slide show of **7 slides** (8 including the world-transition slide).
The character stands in a stylised blue-lit environment. Each slide has a unique camera angle,
character animation, and DOM overlay delivering CV content.

### White world — Free exploration mode
After the presentation an **iris wipe transition** opens and the visitor enters a cartoon-shaded
white environment. They walk around freely using WASD (desktop) or an on-screen joystick (mobile).
The character uses a full third-person controller with idle, walk, run, strafe, and turn animations.

---

## The 7 presentation slides

| # | Name | Character animation | Content |
|---|---|---|---|
| 1 | **Intro** | Waving → idle | Terminal boot-sequence overlay, name + title |
| 2 | **Skills** | Arm gesture sequence | 29 skill bubbles arc around character; click to expand domain |
| 3 | **Projects** | Happy idle | 9 project cards in 3D space; hover = head nod, click = open URL |
| 4 | **How I Work** | Idle | 4 engineering-principle cards in side columns |
| 5 | **Experience** | Idle | Animated SVG timeline — SEB · Cepheid · Expleo |
| 6 | **About Me** | T-pose frozen | Biometric scan + burn/hologram/reassemble sequence (see below) |
| 7 | **Let's Connect** | Hands-forward gesture | Blueprint contact cards (email · LinkedIn · GitHub) |
| 8 | **My World** | Acknowledge | Camera sweeps behind character → iris transition to white world |

---

## About Me slide — the centrepiece effect

The most technically complex slide. Timeline over ~18 seconds:

1. **0 – 3.8 s** — Character crossfades into T-pose (`t-pose-frozen` clip). Biometric scan panel fades in.
2. **3.8 – 7.0 s** — **Burn (head → feet)**: a per-fragment noise dissolve shader sweeps down the character mesh. As each region is discarded, a hologram ghost (fresnel + scanlines) is revealed in its place. A cyan/gold glow stripe tracks the burn front. DOM scan labels appear at body-region milestones.
3. **7.0 – 13.0 s** — **Build phase**: hologram glows at full brightness, gentle rotation sway, electric pulse bursts, electricity wire shader animates current flowing through the wireframe mesh.
4. **13.0 – 17.0 s** — **Outro (feet → head, reverse)**: shared boundary sweeps upward. Character re-materialises from the feet up (reverse burn), hologram clips away from the bottom in sync. Scan line reverses, biometric panel fades out, progress bar counts back to 0%.

### Shaders involved
- **Character burn**: `onBeforeCompile` inject into `MeshStandardMaterial`. `uBurnY` uniform drives world-Y threshold; FBM noise creates ragged paper-burn edge; cyan→gold glow at the boundary.
- **Hologram shell**: custom `ShaderMaterial` with fresnel rim, scanline pulse, `uClipY` / `uClipYMax` uniforms for boundary sync, and noise-based outro burn.
- **Electricity wire**: custom `ShaderMaterial` with `wireframe:true`. Two animated current bands flow up the mesh via `fract(y * freq - time * speed)`. `uClipY` uniform keeps it in sync with the burn boundary. Colour ramp: dim-cyan → bright-cyan → near-white.
- **Burn-edge glow stripe**: screen-space plane mesh positioned at the burn/reveal front, moves up or down each frame.

---

## Key files explained

### `src/presentation/slides.js`
Pure data — no imports from the app. Each slide object defines:
- `name` — unique id used by the orchestrator
- `camPos` / `camTarget` (or `anchor` for character-relative cameras)
- `clip` / `clips` / `clipLoop` — which character animations to play
- `duration` — auto-advance timer in ms
- `title` / `subtitle` / `body` — card text (special tokens: `__ABOUT_STATS__`, `__CTA_LINKS__`, etc.)

### `src/presentation/presentation.js`
Orchestrator. Reads slide data, starts camera moves, triggers character clips, shows/hides overlays.
Special-cases: `about` (wireframe sequence), `experience` (character rotation), `myworld` (iris transition).

### `src/character/about-wireframe.js`
Self-contained module for the About Me visual sequence. Exports:
- `initAboutWireframe(charMeshes, modelGroup)` — call once after model loads
- `showAboutWireframe(onTPoseCue)` — starts the sequence
- `hideAboutWireframe()` — fades out ghost, resets character burn
- `tickAboutWireframe(delta)` — call every frame from the render loop

### `src/presentation/ui.js`
All DOM creation and manipulation. Exports `showCard`, `hideCard`, `showIdleUI`, `showPresentingUI`,
`showWhiteWorldUI`, `setProgressFill`, etc. Also contains CSS for all UI components in a single
`<style>` tag injected into `<head>`.

---

## Character animations (clip names used in code)

`idle`, `waving`, `waving-both-hands`, `arm-gesture`, `arm-gesture-mirror.001`,
`briefcase-standing`, `t-pose-frozen`, `happy-idle`, `hands-forward-gesture`,
`head-nod-yes`, `acknowledge`, `walking`, `running`, `backward walking`,
`idle-to-walk`, `walking-to-idle`, `left turn`, `right turn`, `left turn 90`, `right turn 90`,
`left strafe walking`, `right strafe walking`, `left strafe running`, `right strafe running`,
`yawn`, `relieved-sigh`, `whatever`, `bored`, `wiping-sweat`, `annoyed-head-shake`,
`telling-a-secret`, `listen-to-music`, `praying`, `victory`, `salute`,
`gangam-style`, `pick-fruit`, `jump`, `idle-to-push-up`, `push-up`, `push-up-to-idle`

---

## Person info (the portfolio owner)

| Field | Value |
|---|---|
| Name | Fazli Zekiqi |
| Title | Senior Software Engineer |
| Location | Stockholm, Sweden |
| Experience | 6+ years |
| Companies | SEB Stockholm · Cepheid AB Stockholm · Expleo Stockholm |
| Stack | Java · Kafka · GCP · OpenShift · Angular · Spring Boot · AWS · React · MySQL |
| Technologies | 29 across 7 domains |
| Projects | 50+ shipped |
| Email | fazlizekiqi1@hotmail.com |
| LinkedIn | linkedin.com/in/fazli-zekiqi |
| GitHub | github.com/fazlizekiqi |
| Interests | Training · Running · Electronics · Robots |

---

## The point of this app

It turns a CV into an **experience**. A recruiter or collaborator visiting the site doesn't just
read about the engineer — they watch an interactive 3D scene that demonstrates technical creativity
while delivering the same professional information (skills, projects, experience, contact info).

The medium is part of the message: a software engineer who builds something like this is
**showing, not just telling**.

