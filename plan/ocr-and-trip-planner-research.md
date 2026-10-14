Research and audit only. No code was changed and no PR was opened.

---

# Part 1 — On-device OCR / photo scan

## What exists today

Nucleus already **attaches photos** and **parses text with regex**. It does **not** run optical character recognition on images.

| Layer | Status | Paths |
|---|---|---|
| Text recognition library | **None** | No ML Kit, Tesseract, Vision, `expo-camera`, or OCR package in `frontend/package.json` |
| Camera | **Explicitly blocked** | `frontend/app.json` `android.blockedPermissions` includes `android.permission.CAMERA` |
| `expo-image-picker` | **Gallery only** | Plugin sets `cameraPermission: false`, `microphonePermission: false` |
| Paper “extract” | **Regex on PDF bytes / pasted text**, not pixels | `frontend/src/core/paperExtract.ts` |
| Receipt “scan” | **Pasted/shared text**; photo is decoration | `frontend/src/core/receipt.ts`, `receiptPage.ts`, `ReceiptSheet.tsx` |
| Fuel numbers | **Typed / capture grammar** | `fuelCapture.ts`, `capture.ts`, `VehicleForms.tsx` |
| Native module | Widgets / SMS / battery only | `frontend/modules/nucleus-android/` (`index.ts` is empty; Kotlin is widgets + bank notice + battery) |

### Camera / picker / permissions (exact)

```34:54:frontend/app.json
      "blockedPermissions": [
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.CAMERA"
      ]
    },
    "plugins": [
      ...
      [
        "expo-image-picker",
        {
          "photosPermission": "Nucleus uses a photo you choose as a cover on your media shelf.",
          "cameraPermission": false,
          "microphonePermission": false
        }
      ],
```

`expo-camera` is **not** a dependency. The only mention is a cmd-guard alias if someone tries to add the old barcode scanner (`frontend/scripts/cmd-guard/rules.js`).

All photo paths use `ImagePicker.launchImageLibraryAsync` (library, not camera):

- `frontend/src/components/PhotoPick.tsx` — `pickSmallPhoto()`; copy says **“No camera, no text scanning”**
- `frontend/src/core/paperFiles.ts` — `pickPaperPhoto()` / `pickPaperDocument()`
- `frontend/app/media/index.tsx` — covers
- `VehicleSheet.tsx`, `ReceiptSheet.tsx`, `HomeLife.tsx` (`PhotoNote`) — same picker

### `paperExtract.ts` — not OCR

```9:37:frontend/src/core/paperExtract.ts
export function extractPaperFields(text: string): PaperExtract {
  // expiry YYYY-MM-DD (ISO-like only), policy number, insurer names
}
export function mergeExtract(paper, extract) { /* fills empty number/expiry/insurer if confidence !== "low" */ }
export function extractFromPdfDataUri(uri) {
  // atob base64, strip non-ASCII, then extractPaperFields
}
```

Wired only in `PaperSheet.tsx` when the stored file **starts with** `data:application/pdf`. Image papers are **not** parsed. Copy on `PaperAttach.tsx` says “Easy fields may be read when you attach” — that is the PDF ASCII heuristic, not vision.

Tests: `frontend/src/core/v091.test.ts` (`extractPaperFields("Policy number ABC-12345 expiry 2026-05-01")`).

Gaps in that extractor:

- Dates like `11/10/2026` (DD/MM/YYYY) are **not** matched (ISO `20xx-mm-dd` only)
- Scanned PDFs (image-only) yield nothing
- Files stored as `file:` URIs (large PDFs) skip extract entirely
- Indian insurers beyond a short list (`lic`, `hdfc`, `bajaj`, …)

### Receipt path is the closest “scan” UX

`ReceiptSheet` already has: optional photo, confirm-before-save, per-field edit, debit mismatch flag. Photo is **not** read. Amount/date/shop come from **typed/pasted** text (`parseReceipt`: Total/GST lines, `dd/mm/yyyy` with day-first when day > 12, Indian commas stripped). Share-into-app: `app/_layout.tsx` + `app/capture.tsx` + `looksLikeReceipt`.

`cropToPage` in `receiptPage.ts` is a **geometry helper** (does not crop pixels).

Design already reserved OCR as opt-in, default off:

- `docs/NUCLEUS_DESIGN.md` item 13 — ML Kit, labelled, not generative
- `docs/NUCLEUS_DESIGN_PART2.md` Phase 4 — “optional on-device OCR module”

---

## (a) Best on-device OCR for this Expo/RN Android APK

**Recommendation:** Google **ML Kit Text Recognition v2, bundled Latin model**, implemented as a small **Expo native module inside the existing `nucleus-android` package** (same pattern as widgets), **not** Play Services “unbundled”, **not** Tesseract.js, **not** a cloud OCR.

Why this fits Nucleus:

- Runs **on-device**; ML Kit ToS: input/output **not sent to Google** for recognition ([ML Kit terms](https://developers.google.com/ml-kit/terms), last modified 14 May 2025)
- **No Play Services required** if you use `com.google.mlkit:text-recognition` (bundled). Unbundled `play-services-mlkit-text-recognition` downloads models via GMS — bad for a sideloaded private APK and Graphene-style phones
- Returns **blocks / lines / elements**, boxes, **confidence** — enough for a confirm screen
- Latin covers English Indian petrol bills, RC, PUC, UPI screens, most pharmacy strips. **Devanagari is optional** (`text-recognition-devanagari`) if Hindi-heavy bills matter
- Expo Go is irrelevant: you already **prebuild + Gradle APK** (`.github/workflows/android-apk.yml`: `npx expo prebuild --platform android` then `assembleRelease` **arm64-v8a only**)

### Size / plugin / pipeline

| Item | Reality |
|---|---|
| Bundled Latin | Google: **~4 MB per script per ABI**. You ship **arm64-v8a only**, so ~4 MB, not 8+ ([Android install](https://developers.google.com/ml-kit/vision/text-recognition/v2/android)) |
| Devanagari extra | Another ~4 MB if bundled |
| Unbundled | ~260 KB APK but needs Play Services + first-use network — **reject** |
| Dev build | Required (native). Matches current pipeline |
| Config plugin | Either a thin Expo config plugin adding the Gradle dep, **or** add the dep in `nucleus-android`’s `build.gradle` (cleaner: one native surface, opt-in JS API) |
| Community wrappers | `expo-mlkit-ocr`, `expo-ocr-kit`, `rn-mlkit-ocr` exist. For Nucleus I would **wrap ML Kit in `nucleus-android`** so you control bundled vs unbundled, telemetry, and don’t add iOS-only `expo-build-properties` (this app is Android-first) |
| Metrics caveat | ML Kit **may contact Google for bugfixes/metrics**. ToS: inform users. For a privacy APK, document this and keep OCR **module-gated, default off** (as the design already says). Unverified: whether bundled-only still phones home on de-Googled devices |

**Do not use:** Tesseract.js (large, slow, weak on receipts/dashboards), cloud Vision/OCR (violates offline-first and “nothing leaves the phone”), Expo Go-only libs.

**Camera vs gallery for v1:** OCR does **not** require CAMERA. Gallery + `allowsEditing` crop is enough and keeps the current permission story. Unblock `CAMERA` + `expo-camera` (or image-picker camera) later for dashboards/glare control. That is a **product/privacy** change: today CAMERA is blocked on purpose.

---

## (b) Accuracy: preprocess, parsers, confirm, learning

OCR is the cheap step. **Parsers + validation + confirm** are what make it usable. You already have most of the parser building blocks.

### Image

1. **Crop-to-page overlay** — reuse `cropToPage` as a real viewfinder (receipt / A4 / dashboard cluster). Force high-contrast region.
2. **Picker `allowsEditing: true` already on** — keep it; raise `quality` for OCR temp files (do not store the full-res scan in the encrypted JSON; store fields + optional small JPEG like today: `MAX_IMAGE_B64` / `pickSmallPhoto` 180k).
3. **Contrast / grayscale / unsharp** — optional JS (`expo-image-manipulator` not currently installed) or native before `recognize`. Helps faded thermal paper.
4. **Perspective** — skip in v1 (hard). v2: four-corner or Document Scanner UI. Analog odometers need a **tight crop**, not deskew.
5. **Tips in UI:** hold phone parallel; shade the cluster; wipe the lens; digital dashboards: wait for digits to stop rolling; retake if confidence low.

### Field parsers (JS, deterministic — Nucleus style)

| Field | Existing hook | Extra rules |
|---|---|---|
| Fuel litres × rate = total | `completeFuelNumbers` already; FuelSheet auto-fills the third | Flag if `\|L*P−T\| > ₹2` or 1%; Indian grouping `1,234.50` / `1,23,456`; `Rs`/`INR`/`₹` like `smsMoney.ts` |
| Odometer | FuelSheet / capture: must be ≥ last known (`currentOdometer`, capture floor) | 4–6 digits typical; reject if jump > e.g. 800 km/day; analog vs digital: prefer line with highest numeric confidence in a “km” box |
| Date | `parseReceipt` already day-first when day>12; `paperExtract` is ISO-only | Unify on **DD/MM/YYYY** + ISO; reject future>2y for bills |
| Station / merchant | `parseFuelDraft` `at\|station`; `parseReceipt` merchant | HP/IOCL/BPCL/Nayara/Jio-bp lexicon |
| Paper expiry | `extractPaperFields` | Also `Valid till`, `Valid upto`, `DOE`; PUC 6-month window check |
| Money | `parseReceipt` Total/GST | Prefer last “Grand total”; ignore CGST/SGST unless needed |

### Confirm screen (v1 must-have)

Copy `ReceiptSheet`: photo + raw text + **per-field value, source, confidence, editable**. Nothing writes until Confirm (`receiptCounts(true)` already encodes that). Low-confidence fields empty, not guessed (`paperExtract` already refuses to invent).

### User-correction learning (keep tiny)

Store **local lexicons** in settings/recents (you already store `recents['fuelPrice:vehicleId']` and `smsMemory`). Examples: last station names, “HPCL often OCR’d as HPCL/HPCL”). Do **not** train a model. Optional: remember crop boxes per document kind.

### Digital vs analog dashboards

- Digital: ML Kit Latin is usually good if glare-free.
- Analog: expect 30–50% error; v1 should say “type the odo” and use OCR as a **hint**. A dedicated 6-digit overlay beats generic OCR.

---

## (c) Reuse map — every plug-in point

Shared primitive to add later (not now): `scanText(uri) → { text, lines, confidence }` then **kind-specific parsers**. Same confirm sheet with a `kind` prop.

| Use | Fill these fields | Plug-in files | Today |
|---|---|---|---|
| **Fuel bill → fuel log** | `FuelEntry`: date, litres, price, total, station; optional odo | `VehicleForms.tsx` `FuelSheet`; `fuelCapture.ts`; `capture.ts`; `actions.addFuel` | No photo on FuelSheet; no station field in the form (type has `station`) |
| **Dashboard → odometer** | `FuelEntry.odometer` / `OdometerLog` / journey start-end | `FuelSheet`; `VehicleJourneySection.tsx`; `intelligence.currentOdometer`; `fuelCapture.estimateOdometer` | Manual + estimate; **timed odo logs are not in `currentOdometer`** (only initial/fuel/service) |
| **Service bill → service** | `ServiceEntry`: date, cost, kind, details, `billFile` | `VehicleForms.tsx` `ServiceSheet`; `record/[kind]/[id].tsx` (already attaches bill photo/PDF **without parse**) | Attachment only |
| **Insurance / PUC / RC / licence expiry** | `Paper.number`, `expiry`, `insurer`; `Vehicle.insuranceExpiry` / `pucExpiry` via `syncVehicleExpiryFields` | `PaperSheet.tsx`; `paperExtract.ts`; `vehicleDocs.ts`; kinds in `life.ts` `PAPER_KINDS` | PDF ASCII only |
| **Bills/receipts → Money** | `Txn`: amount, date, note/merchant, category, `photo` | `ReceiptSheet.tsx`; `receipt.ts`; `app/money/index.tsx`; share `capture.tsx` | Text parse works; photo unused |
| **UPI / payment screenshots** | Same `Txn` | Same + `smsMoney.ts` INR regex | SMS path is stronger than photo |
| **Utility bills** | `UtilityBill`: amount, date, reading, photo | `HomeLife.tsx` `BillSheet` + `PhotoNote` | Photo stored, **explicitly not read** |
| **Warranty cards** | `Paper` kind `warranty` **or** `Appliance.warrantyUntil`, serial, purchaseDate | `PaperSheet`; `app/home/index.tsx` `ApplianceSheet` | Dates typed |
| **Tyre / battery date codes** | `WearPart.installedOn`, `note`; service `details.warranty` | `VehicleCare.tsx`; `ServiceSheet` KIND_FIELDS tyre/battery | Manual |
| **Medicine strip / Rx → reminder** | **No medicine entity.** Health is **water times only** (`app/health/index.tsx`, `useWaterNotify.ts`). Closest: `Note` + Rules, or new entity | Do **not** pretend Health can store doses | **Missing module** |
| **Business card / contact** | `Person` is `{ name, note }` (`papers/index.tsx`); copy: **“Nothing is read from your contacts.”** | Skip or fill `Person.name` + note only | No Contacts permission; stay that way |
| **Trip docs** | `Trip.docs[].expiry` | `travel/[id].tsx` docs tab | Manual checkboxes |

**Minimal first version (proposal)**

1. Opt-in module, default **off**, labelled “On-device text read (not sent anywhere)”.
2. **No CAMERA yet** — gallery + crop.
3. Bundled ML Kit Latin in `nucleus-android`; JS: `recognizeLocal(uri)`.
4. **One flow:** Money receipt photo → OCR → existing `parseReceipt` → existing `ReceiptSheet` confirm. Highest leverage, parsers already exist.
5. Second slice: same engine on **Paper PDF/image** feeding `extractPaperFields` (extend dates to DD/MM/YYYY) + confirm in `PaperSheet`.
6. Third: **Fuel bill** → confirm into `FuelSheet` using `completeFuelNumbers` + odo monotonic check.
7. Dashboard odo, service bills, utilities after that. Medicine and contacts: **out of v1**.

---

# Part 2 — Ride trip planner

## What exists today

This is **not** a route planner. It is a **holiday/travel desk** plus a **cost calculator** plus **range from last fill**.

### Data model (`frontend/src/core/types.ts`)

- `Trip`: name, destination, optional `Place` (lat/lon), dates, travellers, budget, packing, itinerary (`title/place/time`, optional `stop: "fuel" | "snack"`), docs, `weatherSaved` / `weatherReminded`, `mode` personal vs public
- `Vehicle`: `tankLitres?`, fuel type, service interval, cover
- `FuelEntry`: litres, price, total, odo, fillKind full/partial
- `VehicleJourney`: start/end odo timestamps — **rides already taken**, not planned
- `ItineraryItem` is a **manual timeline**, not a polyline

### UI / math

| Piece | Role | Path |
|---|---|---|
| Trip list/create | Destination, dates, personal/public | `app/travel/index.tsx` |
| Trip detail | Packing, itinerary, spend, docs, readiness ring | `app/travel/[id].tsx` |
| TripDesk | Manual fuel/snack marks, range warning, service km, weather **if Online**, reuse past stop names | `TripDesk.tsx` |
| tripMath | `rangeLeft(mileage, lastFillLitres, drivenKm)` warn if `< 50 km`; `OFFLINE_MAP = false` | `tripMath.ts` |
| vehicleMath | Full-to-full mileage; `rangeAfterFullLine(avgKmPerL, tankLitres)` | `vehicleMath.ts` |
| intelligence | `avgMileage`, `lastMileage`, `currentOdometer` | `intelligence.ts` |
| estimateOdometer | Interpolate odo from fuel dates | `fuelCapture.ts` |
| Road trip **tool** | Manual distance + mileage + price + tolls → Money “Budget it” | `tools2.tsx` `RoadTripTool` |
| Packing templates | Weekend/Beach/Trekking… | `domains.ts` `PACK_TEMPLATES` |
| Pack checklists | Importable lists | `packs.ts` |
| Weather | Open-Meteo daily + AQI; destination only | `online.ts`, `WeatherCard.tsx` |
| Geocode | Open-Meteo geocoding when Online | `online.ts` `geocode` |
| Location | **Fine location blocked**; coarse once for home weather | `app.json`, `locationAsk.ts` |
| Online switch | Default **off**; `onlineFetch` refuses otherwise; cache in encrypted netcache | `online.ts` |

**Fuel level:** there is **no gauge %**. Remaining range is `mileage × lastFill.litres − km since that fill`. That is correct for a **partial** last fill, and for a **full** fill it approximates leftover tank. Using `tankLitres × avgMileage` is only “range after brim.” Combining both + a user-entered “tank is ½” would be the honest v1 model.

**Bangalore → Goa on the user’s bike** cannot be computed as a route today. You can: (1) type ~560 km into RoadTripTool, (2) see ~km left from last fill on the trip card, (3) mark snack/fuel stops by name, (4) fetch **destination** weather if Online + place found.

---

## What a planner would need (example: BLRA → Goa, own bike)

| Need | v1 from phone data | Needs network / extra data |
|---|---|---|
| Distance / ETA | User types km + assumed 45–55 km/h moving | Routing engine |
| Range per tank | `tankLitres × avgMileage` (`vehicleStats` + `rangeAfterFullLine`) | — |
| Remaining range now | `rangeLeft` + last fill + odo | — |
| Safe refuel before reserve | e.g. stop by 70–80% of remaining range; never plan into last 40 km | Station locations |
| Stop spacing | Every 100–150 km **or** 2 h (fatigue) — local arithmetic on distance | Route length / duration |
| Meal / rest | Template every N km | POIs |
| Hotels / overnight | Template “if hours > 10, split day” | Places + prices |
| Named fuel stations + hours at ETA | — | OSM/Places + time zone |
| Weather by hour/segment | Open-Meteo **hourly** already exists as a product; you only call **daily** today | Online + many lat/lon along route |
| Road closures / ghats / night | Heuristic: “don’t plan night on ghat” from elevation + sunset (you already have sunrise/sunset) | Live incidents (weak in free APIs) |
| Toll | Manual (RoadTripTool already) | Toll dataset |
| Scenic alt | — | OSM tags / second profile |
| Cost → Money | Fuel litres × last `price` + typed toll/food/stay; `addTripExpense` / RoadTripTool `addTxn` | Live fuel retail (skip) |
| Checklist | New pack template “Bike touring” → `PACK_TEMPLATES` / `packs.ts` | — |
| ETA | distance / assumed speed | Routing duration |

---

## Data sources (verified where possible)

**Legend:** **OK for private 1-user APK** / **use with care** / **avoid as production dep**.

### Routing

| Source | Cost / limits | Fit | Notes |
|---|---|---|---|
| **OpenRouteService** (HeiGIT) | Free Standard: Directions **2000/day, 40/min**; POIs 500/day; key required. [plans](https://openrouteservice.org/plans/) [restrictions](https://openrouteservice.org/restrictions/) | **Best hosted OSM router for this app** | Driving 6000 km max, 50 waypoints. Use `api.heigit.org` not deprecated `api.openrouteservice.org` ([forum Sep 2026](https://ask.openrouteservice.org/t/quota-exceeded-on-directions-while-dashboard-shows-full-quota-standard-key/8068)). Embed key = extractable from APK. |
| **OSRM public demo** | Fair-use, no SLA, can be blocked. [policy](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy) | **Avoid as product dependency** | Fine for you clicking a URL; not for an APK. Self-host India extract is heavy. |
| **GraphHopper Cloud** | Free: **non-commercial**, 500 credits/day, max 5 routing locations. [pricing](https://www.graphhopper.com/pricing/) [terms](https://www.graphhopper.com/terms/) | Weak for production; engine is Apache-2 if **self-hosted** | Commercial free-tier production needs their OK. |
| **Valhalla public** | FOSSGIS demo; **not for third-party production**; 1 req/user/s. [docs](https://valhalla.github.io/valhalla/start/introduction/) | Avoid public; engine good if self-hosted | Elevation/height APIs exist. |
| **Google Routes / Directions** | Essentials ~**10k free/month** then **$5/1k**; Advanced (11–25 waypoints) 5k free then $10/1k. [pricing](https://developers.google.com/maps/billing-and-pricing/pricing) | Overkill + billing account + ToS | Places Nearby Search Pro is **$32/1k** after 5k — terrible for “all fuel along 560 km”. |
| **Mappls / MapmyIndia** | India-strong; **public per-call price not listed**; logo required; free unused 3 months can be revoked. [terms](https://about.mappls.com/api/terms-&-conditions) | Consider only if Harsha wants India POI quality and will put a **user-owned key** in Settings | Third-party writeups say contact sales. **Unverified:** current free daily hit count (docs point at a plans page, not a public number). |

**v2 pick:** OpenRouteService `driving-car` (or cycling if they add a motorcycle profile later — **ORS has no first-class motorcycle**; GraphHopper/Valhalla custom costing is better for bikes). For one BLRA–Goa polyline, **one Directions call** is plenty.

### Places / fuel / hotels / hours

| Source | Limits | Fit |
|---|---|---|
| **OSM + Overpass** `amenity=fuel`, `tourism=hotel`, `opening_hours` | Public instance: one-off ~10k queries/day; **regular app: ~100/day and 10 MB**, all users counted together; identify User-Agent; commercial should self-host. [wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) | **One bbox along the route, cached before leaving** is realistic for a private APK. Opening hours in India OSM are **spotty**. |
| **Nominatim** | 1 req/s, no bulk. [policy](https://operations.osmfoundation.org/policies/nominatim/) | Do **not** geocode every stop. You already use Open-Meteo geocoding. |
| **ORS POIs** | 500/day on free | Alternative to Overpass for a corridor query |
| **Foursquare Places** | From **1 Jun 2026**: **500 free Pro calls/month**, then ~$15/1k; attribution required. [Foursquare pricing](https://www.foursquare.com/pricing/) via [apio summary](https://apio.sh/apis/foursquare-places) | Too tight for station search; skip |
| **Google Places** | Nearby/Text Search Pro **$32/1k** after 5k | Skip for a private app |

### Weather

| Source | Terms | Fit |
|---|---|---|
| **Open-Meteo** (already in app) | Free: **non-commercial**, 10k calls/day; CC BY 4.0 + on-screen credit (you already credit). Commercial needs paid. [terms](https://open-meteo.com/en/terms) [licence](https://open-meteo.com/en/licence) | **Keep.** Hourly forecast along 6–10 waypoints is one call per point. Personal sideload is likely non-commercial; if Nucleus is ever sold, **pay or self-host**. |
| **OpenWeather** | Free: 60/min, 1M/month, **API key**. [price](https://openweathermap.org/price) | Worse privacy (key) and you already have Open-Meteo |
| **IMD** | Official India; **API key bound to static server IP + JWT**. [portal](https://api.imd.gov.in/public/api_reference.html) | **Unusable from a phone APK** (no static IP). Warnings are good but need a backend. |

### Elevation / ghats / scenic

- ORS Elevation 2000/day; Valhalla `/height`; Open-Meteo has elevation on geocode (`Place.elevation` already typed).
- Scenic: OSM `scenic=yes`, prefer `highway=secondary` vs motorway, curvature (ORS doesn’t give a “pretty” score). **Unverified** as a reliable India scenic index. Community GPX (Bikemap etc.) has ToS — don’t scrape.
- Night: Open-Meteo daily already has **sunrise/sunset**. Local rule: “ghat after sunset → warn”.

### Toll / road alerts

| Source | Notes |
|---|---|
| **TollGuru API** | Trial then **$80/mo** for 5k txns. [pricing](https://tollguru.com/toll-api-pricing-plans) | Not low-cost |
| **ForceGT/india-toll-plazas** | Open JSON, NHAI-derived plazas + class rates, no key. [repo](https://github.com/ForceGT/india-toll-plazas) raw `latest.json` | **Best v2/v3 for India.** Intersect plazas with route polyline locally. Not official NHAI; rates go stale. ODbL/source attribution. |
| **NHAI Rajmargyatra** | Public site; **no documented open API for an APK**. Unverified scrape legality — don’t. |
| Live closures | No good free India feed. Optional: user-typed “NH48 night ban” notes. |

---

## Offline-first conflict

Align with existing **Online switch** (`settings.online` default false, `onlineFetch` + encrypted cache).

| On the phone, no net | Needs net once (cache before leave) | Always needs live net |
|---|---|---|
| Tank range, remaining km, refuel **distance** marks (every X km), fatigue spacing, packing template, cost from last ₹/L, checklist, sunset warn if cached | Route polyline, fuel/hotel OSM dump for corridor, Open-Meteo hourly along waypoints, toll plaza JSON | Opening hours “open **now**”, live closures, live petrol prices |

**What leaves the phone:** same rule as today — **query only** (lat/lon or city name), never the vault. Route request = origin/destination coordinates (home city + Goa). Do not send vehicle plate, odo, or fuel log.

**API keys in a private APK:** never ship a shared Google/ORS key. Pattern: **Settings → Online keys** (SecureStore), empty = skip that provider. ORS key is the only one v2 needs. OSM Overpass needs a unique User-Agent, not a secret.

**Offline fallback (must ship with v1):** user types origin/dest/km; app uses stored mileage + tank + last fill; suggests **“refuel by km 180, 360, …”** as itinerary fuel stops without names; packing template; cost = litres × last price + typed extras → `addTripExpense`.

---

## Phased approach

### v1 — offline, stored data only (fits Nucleus now)

New **Ride plan** on a personal `Trip` (or extend RoadTripTool into Travel — don’t fork two UIs).

Inputs: vehicle (`defaultVehicleId` / picker), optional typed distance, optional “tank now: full / ¾ / ½ / ¼ / last-fill estimate”.

Outputs:

- Range full / remaining (`vehicleMath` + `tripMath.rangeLeft`)
- Refuel-by distances with 40–50 km reserve
- Fatigue ticks every 2 h / 120 km (assumed speed)
- Cost: fuel + optional toll/food/stay fields → Money (`addTripExpense` already links)
- Packing: new `PACK_TEMPLATES.BikeTour` (helmet, papers, puncture, rain, hydration)
- Docs check: licence/PUC/insurance via existing `readiness` + `vehicleDocs`
- Weather: existing “save weather before you leave” reminder

No map. No new permission.

### v2 — Online switch on, free APIs, cacheable

- ORS Directions (user key) → distance, duration, geometry
- Sample 6–10 points → Open-Meteo hourly (existing `onlineFetch`)
- One Overpass (or ORS POI) corridor query for `amenity=fuel` → names + coords; **not** live hours
- Persist JSON on trip (`weatherSaved` analogue: `routeCachedAt`)
- Intersect optional downloaded toll JSON; show **estimate**, not FASTag truth
- Fine location stays blocked; geocode typed cities as today

### v3 — scenic / hotels / motorcycle costing

- Second ORS profile or avoid motorways; OSM scenic tags
- Hotels as optional POIs
- Ghat/night warnings from elevation + sunset
- Only then consider Mappls if OSM fuel density on NH48 is poor

---

## Risks

- CAMERA unblock fights a deliberate privacy choice.
- ML Kit metrics vs “nothing leaves the phone” — need a privacy-screen sentence.
- `currentOdometer` ignores `odometerLogs` — range can be wrong after a timed odo.
- Mileage from **full-to-full only**; highway Goa run will beat city average — show Why? (you already have that primitive).
- OSM fuel stations missing/misplaced on NH48; hours often empty.
- ORS key leaked if APK is copied; rate-limit if many forks share one key.
- Open-Meteo commercial clause if the app is ever sold.
- Motorcycle vs car routing (speed, tunnel, highway legality).
- Analog odo OCR will disappoint; don’t lead with it.
- Health/medicine and contacts: no data model; bolting OCR there is product creep.

---

# Recommendation (short)

**OCR:** Ship **opt-in bundled ML Kit Latin** in `nucleus-android`, gallery-first, **ReceiptSheet first**, then papers, then fuel bills. Keep CAMERA blocked until a dashboard-specific capture is worth it. Parsers you have (`completeFuelNumbers`, `parseReceipt`, odo floor) are the accuracy layer.

**Trip planner:** **Do not** start with maps. **v1** is range/refuel spacing/checklist/cost on Travel using `tankLitres`, `fuelMileagePoints`, `rangeLeft`. **v2** is one ORS route + cached OSM fuel + Open-Meteo hourly, behind the existing Online switch and cache. Skip Google Places, Foursquare, TollGuru, IMD, and public OSRM/Valhalla demos.

---

# Open questions for Harsha

1. **OCR default off** as in the 2024 design — still required, or OK as a Vehicles/Money sub-toggle?
2. **Unblock CAMERA** for dashboards, or gallery-only forever?
3. Accept **ML Kit bundled proprietary model + possible metrics ping** on a privacy APK, or wait for a fully OSS recognizer (worse accuracy)?
4. Latin-only vs +Devanagari (~+4 MB)?
5. **Medicine reminders** — new module, or out of scope? Health today is water-only by design (“Nothing is counted”).
6. Trip planner: **Travel module** vs **Tools → Road trip** vs a “Ride” entity linked to `VehicleJourney`?
7. Comfortable putting a **personal ORS key** in Settings, or stay 100% offline for routing?
8. For BLRA–Goa, is **car routing** acceptable or must it be motorcycle-aware?
9. Reserve policy: 50 km (`tripMath` warn) vs 20% tank vs user-set?
10. May we treat Open-Meteo as **non-commercial personal use**, or is there any paid/distribution intent that needs their paid plan?
11. Should `currentOdometer` include timed odo logs before any planner math?
12. Scenic/hotels: wanted, or is v1+v2 (range + named pumps + weather) enough for a long time?