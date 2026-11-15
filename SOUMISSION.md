# Sillon — Submission to the NASA Space Apps Challenge 2026

Challenge: **Field Shift: Adapting Farms with NASA Data**.

## 1. Summary (120 words)

Sillon is a browser-based decision aid for smallholders in the Sahel. It takes a
plot's location, soil and climate, the crops the farmer grows and his priorities,
and returns a ranked rotation with a plain-language explanation, a comparison
table in FCFA per hectare, and a list of the rotations it rejected and why. Every
figure comes from a calculation or from a labelled source; nothing is invented.
Observations from NASA POWER, ERA5 and MODIS drive the water balance and the
erosion estimate; SoilGrids and SRTM drive the soil. The engine is deterministic,
tested by 24 cases, and states its own limits. It does not prescribe: it proposes,
shows its work, and leaves the final decision to the farmer and his agronomist.

## 2. Problem

In the Sahel, rainfall has become more erratic and shorter, soils are thinning
on slopes, and input prices rise faster than grain prices. A smallholder who
changes his rotation on instinct risks losing a season; one who changes it on
generic advice risks a mismatch with his water, his budget or his equipment. The
information he needs exists (satellite climate, global soil maps), but it is not
in his language, not on his scale, and not ranked against his priorities.

## 3. Named user

Awa, 38, farms 2.5 ha near Ouahigouya (Burkina Faso), on a gentle slope with
heavy soil. She grows mil, sorghum and cowpea, keeps no livestock, and has a
small input budget. Her mil lost roughly a third of its yield in the dry years
of 2022 and 2023. She has no agronomist within reach and no money to lose a
season. Sillon is built for her: it ranks rotations on her water, her budget and
her labour, in French, and tells her what it could not see.

The five reference scenarios in `src/moteur/__tests__/scenarios.ts` are built on
her type of plot. They are not a single measurement.

## 4. Challenge requirement → file

| Requirement of the challenge | Where it is met |
|---|---|
| Earth observations | `src/analyse/features.ts` (NASA POWER daily, ERA5, MODIS via GIBS) |
| Soil data | `src/analyse/features.ts` (SoilGrids v2, SRTM/USGS 3DEP) |
| Crop characteristics | `src/data/cultures.ts` (24 crops, cycles, water needs, prices) |
| Farmer priorities | `src/App.tsx:46` (6 sliders), `src/moteur/moteur.ts:76` (`calculerPoids`) |
| Adaptation recommendation | `src/rapport/rapport.ts:120` (`construireRapport`) |
| Limits stated | `src/rapport/rapport.ts` block 6, `README.md` §10 |

## 5. NASA data used (endpoints)

- `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M,T2M_MAX,T2M_MIN,GWETTOP` — NASA POWER, 2001–2024, daily.
- `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/...` — MODIS Terra, current.
- `https://climate-api.open-meteo.com/v1/climate` — ERA5 historical and CMIP6 projection (single model).
- `https://rest.isric.org/soilgrids/v2.0/properties/query` and `/classification/query` — SoilGrids v2.
- `https://api.open-meteo.com/v1/elevation` and `https://epqs.nationalmap.gov/v1/json` — SRTM / USGS 3DEP.

Every request is made from the browser; no Sillon server sits in between. Each
source reports its own status in the report (block 8).

## 6. Methodology and formulas

- Water balance per succession: seasonal rainfall vs. ET0 × Kc per crop × share of season, with a 15-day tolerance. Successions exceeding 55 % water stress are rejected (`EAU`).
- Erosion: RUSLE from annual rainfall, soil texture (K tabulated), slope (SRTM), cover.
- Score: weighted sum of six criteria (water, revenue, soil, security, inputs, labour), weights from the farmer's sliders, normalised to 1:
  `poids.eau = 1 + 2·sobrieteEau`, `poids.revenu = 1 + 3·revenu`,
  `poids.securite = 1 + 3·securiteAlimentaire`, `poids.intrants = 1 + 2·autonomieIntrants`,
  `poids.sol = 1 + 1·preservationSol`, `poids.travail = 1 + 1·(100 − mainOeuvre)`.
- Budget: input cost per year vs. declared budget (`CAPITAL`).
- Return interval: a crop must wait `retour` years before coming back (`RETOUR`).
- Soil pH: each crop has a pH range (`PH`).
- Market: fodder crops need livestock (`MARCHE`).
- Cycle fit: each crop must fit the season (`CYCLE`).
- Stability: the ranking is replayed at −10 % and −20 % rainfall; if the gap between rank 1 and rank 3 is under 4 points, `stabilite: "fragile"`.
- Determinism: seed = FNV-1a 32-bit over `lat|lon|cropIds`; mulberry32 for variants. No `Math.random()`.

## 7. What the tool cannot see

Listed in the report itself (block 6) and in `README.md` §10:

- Soil is a 250 m prediction, not a measurement of her field. One soil sample can contradict the whole report.
- A single CMIP6 model, not a probability distribution.
- Compaction is invisible: nothing in the data sees a plough pan.
- Pests and diseases are invisible; return intervals are rules of thumb.
- No campaign prices: margins come from a fixed table.
- RUSLE K is tabulated, not fitted to the local soil.
- Seven public APIs, browser-side CORS: any can fail or change a field.
- The Google Maps key is client-side (restricted by referer and quota).
- The ERA5 label says ≈ 9 km; the native grid is 0.25° (≈ 25–30 km).
- Input costs, not profits: no credit, no family labour valuation, no land tenure.
- No field validation: the output has not been compared to measured yields.

## 8. Results on the witness scenarios

`npm run tableau` on the five reference scenarios:

| Scenario | Top succession | Score |
|---|---|---|
| Dry plot, income priority | Mil then Sorghum | 49.1 |
| No livestock declared | Cowpea then Maize then Cowpea | 61.4 |
| History containing maize | Wheat then Lucerne | 61.9 |
| Income priority (case 4A) | Cowpea then Sorghum then Cowpea | 56.7 |
| Humid plot, livestock, medium budget | Maize then Peanut then Maize | 55.4 |

No succession wins more than one scenario out of five: the engine does not
have a favourite, it answers the plot. Margin of error: the scores are ordinal
and depend on a fixed price table and on global soil predictions; they are not
yield forecasts.

## 9. Roadmap to a cooperative deployment

1. Calibrate the price table with the cooperative's buyers.
2. Replace the 250 m soil prediction with one analysis of soil per member plot.
3. Add a seasonal forecast (not only climatology) once a reliable source is chosen.
4. Field validation: compare recommendations to measured yields on 10 plots over one season.
5. Offline mode and a voice interface in Mooré and Dioula.
6. A shared, anonymised database of plots to improve the coefficients.

## 10. Team and credits

Soil AI Crew — NASA Space Apps Challenge 2026. Code under MIT licence
(`LICENSE`). Third-party data under their own terms (see `LICENSE`). No new
npm dependency was added; the app runs on React and Vite only.

## Links

- Live: https://soil-ai-app.vercel.app
- Repository: https://github.com/gandxo-tech/sillon
- Audit: `AUDIT.md`
- Oral script: `ORAL.md`
