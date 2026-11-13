# Terrain transition investigation — 2026-11-13

Request: investigate slow terrain quality changes and a possible performance regression. No runtime code was changed in this investigation.

## Reproduction

Open `/tests/terrain_transition_profile.html` through the local HTTP server. Synthetic 128×128 map, grass/sand/water, camera zoom 1.2, 960×600 renderer, 64 terrain chunks in the renderer's visible rectangle. The fixture uses requestAnimationFrame and the actual terrain and grass builders. Default mode disables GPU drawing; `?gpu` enables drawing; `?noidle` disables only requestIdleCallback preparation. Results are individual diagnostic runs, not repeated statistical benchmarks. Timings exclude module loading and renderer construction and are not an exact reproduction of the user's saved city.

| Mode | First complete chunk | All visible complete | Terrain CPU | Grass job CPU | Largest grass job slice |
| --- | ---: | ---: | ---: | ---: | ---: |
| Idle enabled, drawing disabled | 692 ms | 3,586 ms | 757 ms | 1,638 ms | 24.6 ms |
| Idle disabled, drawing disabled | 678 ms | 5,138 ms | 732 ms | 1,716 ms | 23.6 ms |
| Idle enabled, drawing enabled | 1,206 ms | 6,917 ms | 781 ms | 1,883 ms | 25.6 ms |
| Idle disabled, drawing enabled | 979 ms | 6,634 ms | 789 ms | 1,863 ms | 23.7 ms |

A separate run with installation instrumentation produced 6,195,493 published grass instances. Installing completed grass consumed 494 ms in total; the largest individual installation took 19.4 ms. Total grass job CPU includes installation.

## Confirmed mechanisms

1. `renderer_3d.js:7499` prevents publishing a chunk until all its grass root jobs complete. The placeholder remains visible throughout preparation. Fade duration is only 0.4 seconds (`terrain_quality_fade.js`), so it does not explain the multi-second wait before a transition starts.
2. Close detail uses 24×24 roots per grass tile (`terrain_zoom_detail.js`), including the ordinary zoom of 1.2. Generating and installing millions of instances remains substantial main-thread work. Scheduling spreads that work out; it does not reduce its amount.
3. `GrassRootJobs.advance()` checks its deadline before generator steps, then runs completion listeners synchronously (`grass_root_jobs.js:56–58`). Typed-array completion, geometry installation, tinting and flower selection can overrun the requested slice. The observed 19.4 ms installation cannot be interrupted by the scheduler's budget.
4. `renderer_3d.js:7773` prepares terrain/roots for approximately 7 ms each render, then `terrain_idle_work.js:16` permits another slice of up to 8 ms. A timeout permits 2 ms even without idle time. These limits do not bound completion callbacks, so the new scheduler can introduce additional main-thread bursts. This is a credible regression mechanism; the CPU comparison above does not prove a net regression from idle scheduling. Without drawing, idle scheduling reduced total completion latency. With drawing, the idle-enabled run was slightly slower (6.9 versus 6.6 seconds); one run per mode is insufficient to establish a systematic regression.
5. Quality changes put a zoom-dependent signature into terrain and grass root cache keys. Crossing zoom bands can regenerate grass instead of selecting a subset of existing roots. Completed high-detail terrain is swapped as whole chunks, explaining spatial differences while the queue drains.

## Implications for a correction

Reduce/reuse the generated data and make completion work incremental or move it off the main thread. Merely increasing preparation time or shortening the visual fade cannot solve both loading latency and frame stalls. Measure first-visible completion, all-visible completion and worst frame times together; a faster queue drain alone is insufficient evidence.

The diagnostic does not establish that every chunk must take at least two seconds, nor reproduce the full game's initial five seconds. It establishes multi-second preparation without simulation, and deadline overruns in the current implementation.

## Correction and verification

After implementation, the same 128×128 drawing-enabled fixture completed its first chunk at 814 ms and all visible chunks at 3,804 ms (previously 1,206 and 6,917 ms). It retained exactly 6,195,493 blades. The largest main-thread grass preparation slice fell from 25.6 to 0.9 ms; total main-thread grass job work fell from 1,883 to 12.8 ms. Individual installation steps peaked at 0.3 ms. These are individual runs and do not promise instant loading in a populated city.

The module worker now generates roots, bilinear tile tints and sparse flower data and transfers numeric buffers. Typed root buffers avoid growing boxed-number arrays. Completion can yield across the preparation budget, with incremental fallback if workers are unavailable or fail. Terrain and installation share the existing 7 ms allowance instead of leaving the former root reservation unused while the worker runs. Generation of the next queued field overlaps installation of the previous one.

The diagnostic wrapper was updated to forward the ninth request argument (worker preparation options) and measure installation iterator steps. The baseline implementation had no ninth argument; its timings remain applicable.

Focused verification: 56 tests passed, including a real worker transfer, binary root identity, original tile tint equivalence, fallback, stale reply rejection, exclusions, cardboard footprints and terrain scheduling. Browser zoom sequence 2 → 0.7 → 0.4 → 2 restored the same 995,328 close-view blades, with zero shader errors. No density, appearance setting or simulation behavior was reduced to obtain the improvement.
