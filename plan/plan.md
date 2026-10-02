# Tessera: A Local-First Personal Platform

Tessera is a private, offline Android app where you put together your own toolkit from modules (vehicles, money, quick tools), and those modules link to each other.
It uses plain rules and your own history to point out what needs attention and why. It uses no AI, no cloud and no account.

*(Name idea: a tessera is one tile in a mosaic. Each module is a tile, and together they make one picture. The design document lists other names to choose from.)*

---

## Who it's for
- People who want one organized place for their car or bike, spending and everyday calculations, without sending data to anyone.
- Privacy-minded users who don't trust cloud apps with financial or personal records.
- Power users who want deep customization but still need things to work right away.

---

## Core features and experience (MVP)

### 1. Today (home)
- A short, visual summary first. Example: "3 things need attention", a budget ring showing 79% used, and a service gauge showing 4,700 km since the last service.
- Each module shows a small summary tile. You tap it for details (overview → details → explanation → raw data).
- A global search bar at the top.

### 2. Attention Center
- One list across all modules, grouped into **Urgent / Upcoming / Info**. Examples: insurance expiring, PUC expiring, a service coming up, a subscription renewing, a budget limit reached, unusual spending.
- Items are ranked by clear rules (how soon and how severe). They are never ranked by guesswork.
- Every item has a **"Why?"** button. It shows the reasoning and the data behind it, for example: "Your last 4 service intervals averaged 5,150 km. You are at 4,700 km."
- You can mark an item done, snooze it, or dismiss it.

### 3. Vehicles module
- Add vehicles (car, bike, other) and choose a default one.
- **Fuel log:** enter odometer, litres and either price or total. The missing value is filled in automatically. The app works out mileage, cost per km, monthly spend and a mileage trend chart.
- **Service log:** the form changes with the service type. Engine oil asks for grade, quantity and odometer. Tyres ask for size, front/rear, brand and warranty. Other types ask for what fits them.
- **Service interval estimate:** worked out from your own past services, with a plain explanation.
- **Documents and dates:** insurance and PUC expiry dates feed the Attention Center.
- **Vehicle dashboard:** a mileage gauge, a service countdown, expiry indicators and recent costs.

### 4. Money module
- Income and expense entries with categories. Entry is quick, with a number pad, category chips and recent values.
- Monthly budget plus optional budgets per category. Shown as a ring, then a category breakdown, then the individual transactions.
- **Subscriptions:** cost, billing cycle, renewal date and annual cost. Renewals feed the Attention Center.
- **Trend and anomaly insights:** for example "Electricity spending is trending up" or "Fuel this month is 34% above your 6-month average", each with "Why?".

### 5. Cross-module links (the core idea)
- A fuel entry or service cost can create a linked expense in Money automatically. This is on by default and you can turn it off.
- Every record has a **"Linked"** section, so you can move between related items (Vehicle → Fuel → Expenses).
- Search results are grouped by type. Searching "Activa", for example, shows the vehicle, 12 fuel entries, ₹8,420 spent and the next service.

### 6. Quick Tools
- Unit converter, percentage/GST/discount, tip and bill split, date calculator, and an EMI/loan calculator.
- The unit selector sits right next to the input. Values you used recently are remembered.
- Results can be copied, saved to history, or sent to another module. For example, an EMI can become a recurring expense.

### 7. Modules and customization
- A module library where you turn modules on or off, hide them and reorder them. Turned-off modules disappear from Today, search and Attention.
- You can choose and reorder the Today tiles.
- Theme: light, dark or system, with a choice of accent color.
- Density: Comfortable or Dense.
- Defaults: currency, distance and fuel units, temperature, and 12h or 24h time.

### 8. Security and privacy
- **Whole-app lock:** a PIN plus fingerprint or face unlock where the device supports it. The app locks again after a set time in the background.
- **Privacy mode:** hides all amounts until you tap to show them.
- The app's content is hidden in the recent-apps switcher. Screenshots are blocked where the device supports it.
- No account and no network use. Data never leaves the device unless you export it.

### 9. Backup
- **Export everything** to a single backup file that you save or share yourself.
- **Restore** from a backup file, with a preview of what will be replaced.

### 10. Design document (delivered alongside the app)
A separate in-depth document covering:
- a critique of the original concept (what was merged, removed or redesigned)
- new ideas
- product identity and naming options
- information structure and navigation
- visual language
- full architecture: modules, events, relationships, rules, intelligence, search, dashboards, widgets, plugins and capabilities
- security model and threat model
- performance and battery strategy
- UX for each module
- roadmap and extensibility

---

## User flow
1. **First launch:**
   - choose defaults (currency, units, time format)
   - choose modules (Vehicles, Money, Tools)
   - set a PIN and optionally turn on biometric unlock
2. **Unlock**, then land on **Today**.
3. **Add a vehicle**, then log fuel. Mileage and cost appear right away, and a linked expense shows up in Money.
4. **Set a budget and add expenses.** The ring fills, and insights appear once there is enough history.
5. **Open Attention**, check "Why?" on any item, then mark it done or snooze it.
6. **Use a quick tool**, then send the result to Money or save it.
7. **Settings:** reorder modules and tiles, change theme and density, export a backup.

**Navigation:** four tabs: **Today · Modules · Attention · Settings**. Search is reached from Today.

---

## UI/UX feel
- Calm, precise and instrument-like. It should feel like a well-made workbench, not a busy dashboard.
- Visuals come before text: rings, gauges, trend lines, timelines and countdown bars. Numbers back up the visuals rather than replace them.
- Layouts are left-aligned with a clear order of importance. Each screen answers "what matters?" first.
- Bottom sheets are used for quick entry. Touch targets are large and there are small press animations.
- Status is never shown by color alone. Icons and labels are always used too.
- Light and dark themes are both fully supported.

---

## Implementation phases

### Phase 1: MVP (built now)
Everything in "Core features" above:
- Today, Attention Center with "Why?", Vehicles, Money and subscriptions
- automatic cross-module links, grouped global search, five quick tools
- module library, theme, density and defaults
- whole-app PIN/biometric lock, privacy mode
- full backup export and restore
- the design document

### Phase 2: Broaden the platform
- **Travel:** trips, packing templates, itinerary timeline, trip expenses linked to fuel and Money, and a trip readiness summary.
- **Home:** appliances, warranties, maintenance schedules and utility tracking.
- **Visual rule builder (When / If / Then):** with local reminder notifications.
- Custom dashboards and multiple local profiles.
- Password-encrypted backups, plus CSV and calendar (ICS) export.
- Developer tools pack.
- Per-module extra lock for Money.

### Phase 3: Advanced platform
- **Custom tool builder:** inputs, formula and output, which then behaves like a built-in tool.
- Declarative module packs, with permissions granted one at a time.
- Android home-screen widgets and shortcuts. These need an installed app build and won't run in the Expo Go preview.
- Phone Lab: sensors, battery, display and touch tests.
- Media library.
- Network tools.
- A self-diagnostics screen.
- Tablet and landscape layouts.

---

## Assumptions
- **Product name:** "Tessera" replaces the working name.
- **Platform:**
  - Built so it runs well on Android first. It also works on iPhone.
  - The Expo Go preview is used for testing. Screenshot blocking and app-switcher hiding only work fully in an installed app build.
- **Storage:**
  - All data is stored on the device only. No server is used, even though the workspace includes one.
  - Uninstalling the app deletes the data unless a backup was exported first.
- **Locale and units:**
  - Defaults are INR, km, litres, °C and 12-hour time, all changeable in onboarding and Settings.
  - Money uses one currency in the MVP.
- **Profiles:** one profile in the MVP. Multiple profiles come in Phase 2.
- **App lock:** the whole app is locked by PIN, with biometric unlock as an option. If you forget the PIN, the app can only be reset (data wiped) or restored from a backup. There is no recovery path.
- **Backups:** the MVP backup file is not password-protected and the app warns about this. Encrypted backups come in Phase 2.
- **Data entry:**
  - All data is entered by hand. There is no bank or SMS import and no online lookups.
  - No photos or attachments in the MVP.
- **Insights:** they appear only when there is enough history (at least 3 services for an interval estimate, at least 3 months for spending trends). Until then the app says what data is still needed.
- **Reminders:** reminders appear inside the app (Attention Center). Phone notifications come in Phase 2.
- **Language:** English only.
- **Design document:** the design document is delivered as a written document in the project. It is not shown inside the app.
