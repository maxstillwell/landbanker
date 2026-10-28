# Map performance: software-rendering release exception

## Map interaction release comparison — 28 October 2026

The unchanged original ten-frame assertion failed at **4,154 ms** when run alone (and 4,608 ms while another browser test was running). Later checks in that file did not execute. A separate temporary observational copy, with the original committed test left intact, sampled five consecutive pan-and-ten-frame measurements per version against the same isolated data fixture and Chromium/SwiftShader setup. The unchanged V2 production baseline `0b3f003445f111d71a2865272ef837e93934b3a3` measured **1,728.5, 2,576.3, 3,423.6, 2,622.0 and 2,662.9 ms** (median **2,622.0 ms**, 93 viewport requests across the five pans). The interaction candidate measured **1,574.4, 2,965.6, 1,795.0, 2,874.0 and 3,049.8 ms** (median **2,874.0 ms**, 90 requests). The candidate median was 9.6% higher, within overlapping observed ranges; these are consecutive samples within one browser session per version, baseline first, not five independent alternating runs. This limited comparison does not show a consistent material regression and does not prove equivalent performance on real devices. The 2,000 ms assertion remains a failure, not a pass.

The original `tests/map-pages.e2e.mjs` ten-frame assertion remains at **2,000 ms**. On this cloud host Chromium uses SwiftShader and `/dev/dri` is absent. Both the previous production commit and the redesign repeatedly exceeded that threshold. The assertion has not been relaxed, skipped or counted as passing. This exception is limited to that software-rendering performance check; it does not waive functional checks or establish performance on real devices.

On 27 October 2026, the existing 500-parcel/500-observation/large-layer scenario was run against isolated local services with the same Chromium executable, fixture tile responses, viewport and data generation. An observational copy printed the ten-frame duration and viewport request counts at the existing assertion point without changing the committed test. Initial measurements alternated baseline `1e32bab7a16ab9274fafdee4e449a148bea8b96d` with the then-current candidate. The final production build was subsequently measured five more times after the direct-layer controls and removal of a redundant delayed resize; these final candidate runs were consecutive rather than alternated.

| Measurement | Five ten-frame durations (ms) | Median (ms) | Range (ms) | Viewport request counts; median |
|---|---|---:|---:|---|
| Baseline, alternating | 3901.1, 3059.6, 3477.9, 3625.5, 4174.5 | 3625.5 | 3059.6–4174.5 | 30, 32, 31, 30, 32; **31** |
| Final build | 3698.2, 3803.2, 3889.2, 3408.3, 2761.9 | 3698.2 | 2761.9–3889.2 | 30, 30, 30, 30, 29; **30** |

The final-build median was approximately 2.0% slower than baseline, within the observed run-to-run variability; the request count did not increase. The paired intermediate candidate samples were 3354.1, 2879.4, 3142.0, 4244.2 and 3868.5 ms (median 3354.1 ms). This small sample provides no evidence of a consistent material redesign regression; it does not rule out smaller regressions or establish causation for the slow software rendering. One baseline response body was unavailable to the test while a request was aborted, without affecting the request count.

Review of the implementation found the floating widgets keep drag state locally and do not recreate the map on pointer movement. The map canvas already has a `ResizeObserver`; an additional delayed resize on sidebar state changes was removed. The map's normal viewport, official-layer and scene effects remain active. Browser/GPU and real-device performance still require observation in production.

After the final-build samples above, a mobile integration check found that the toolbar was underneath a floating widget. The production candidate was rebuilt with a CSS stacking-order correction only; no map data or rendering code was changed. The original threshold is rerun against that rebuilt candidate as part of release validation.

The unchanged original test was then run against the rebuilt candidate: it failed its 2,000 ms assertion at **2,242 ms**. Subsequent tests were run independently; the failure prevented the remaining checks within `map-pages.e2e.mjs` from executing in that run.

A subsequent responsive fix constrained expanded mobile widgets below the header and limited their height; it did not alter the MapLibre renderer. On this final rebuilt candidate, the unchanged original assertion was rerun and failed at **3,459 ms**. Five-sample results above therefore precede these two small widget-layout fixes; the final assertion remains within the measured baseline range. No hardware-accelerated performance measurement is available from this host.
