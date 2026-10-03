# Nucleus: The Private All-in-One Personal Platform (v2)

Nucleus (renamed from Tessera) is a private, encrypted personal platform for vehicles, money, travel, home, media and everyday tools. Every module links to the others, and plain rules point out what needs attention and why.
It works fully offline. An optional "Online" switch, off by default, adds live currency rates, weather and holidays without ever sending your records.

---

## Who it's for
- People who want one beautiful, organized place for their car, money, trips, home and media, without trusting a cloud company.
- Privacy-minded users who want encryption, hidden amounts, a choice of PIN or biometric unlock, and a decoy mode.
- Non-developers who want deep customization (themes, dashboards, custom tools, rules) without editing anything technical.

---

## Core features and experience (built now)

### 1. Rename and visual overhaul
- **New name:** the app is renamed **Nucleus** everywhere: app name, icon text, lock screen, onboarding and backups.
- **Dark-first premium look:**
  - deep surfaces with soft depth
  - subtle gradients
  - a "hero" visual at the top of every module (gauge, ring, countdown, poster wall)
  - smooth, staggered animations
- **Themes:**
  - Midnight (default dark)
  - AMOLED Black
  - Graphite
  - Dune (warm dark)
  - Paper (light)
  - Follow system
  - each theme can be combined with 6 accent colours
- **Layout:**
  - Density can be Comfortable or Dense.
  - A large-touch option, reduced motion and high contrast are available.
- **Text-overflow audit across every screen:**
  - long names, large amounts and small phones are handled with truncation, wrapping or auto-shrinking
  - chip rows scroll sideways and never wrap or squash

### 2. Today and Boards (custom dashboards)
- **Today:**
  - an Attention summary
  - module tiles that you pick and reorder
  - a global search bar
  - an **Online on/off toggle** in the header
  - current weather when Online is on
- **Boards:** create extra dashboards such as "My Car", "Goa Trip" or "Home". Add tiles from any module, reorder them and choose a size (small, medium or large).
- **Capture bar:** one quick-entry line using simple, fixed patterns. For example:
  - `450 food lunch` becomes an expense
  - `fuel 5.4L 560` becomes a fuel entry
  - `netflix 649 monthly` becomes a subscription
  - A preview shows what will be created before it is saved.

### 3. Attention Center (all modules)
- Urgent, Upcoming and Info, across vehicles, money, travel, home and your rules.
- Every item has a **"Why?"** button showing the rule and the data behind it.
- You can mark items done, snooze them, dismiss them or restore them.
- **Quiet hours** stop reminders at night, except for urgent items.

### 4. Vehicles (existing, polished)
- Fuel log with automatic calculation of the missing value.
- A service form that changes with the service type.
- A service interval learned from your history.
- Insurance and PUC countdowns, and a mileage trend chart.
- **New:** total cost of ownership per km. Fuel used on a trip can also be logged as a trip expense.

### 5. Money (existing, expanded)
- Budget ring, category bars, monthly trends, quick entry, subscriptions, and insights with "Why?".
- **New features:**
  - **Sinking funds:** savings jars for goals such as insurance or a new phone.
  - **Net worth:** assets minus liabilities, tracked over time.
  - **Debts and loans:** with payoff progress.
  - **Multi-currency:** live rates when Online is on, otherwise rates you enter manually.
  - **Month-end projection:** based on how fast you are spending so far this month.

### 6. Travel
- **Trips** with a destination, dates, travellers and a budget.
- **Trip card:** a countdown and a readiness ring. The ring combines packing done, documents present and whether a budget is set, for example "2 things need attention".
- **Packing list:**
  - templates: Weekend, Business, Beach, Trekking, International, Winter, Photography, Custom
  - category progress bars
  - an offer to reuse a previous trip's list
- **Day-by-day itinerary:** a vertical timeline with times, places, bookings and notes.
- **Trip expenses:**
  - in any currency, converted to your home currency
  - shown against the trip budget
  - fuel logged for the trip links in automatically
- **Road-trip calculator:** fuel needed, fuel cost, cost per km and cost per person.
- **Documents checklist:** passport, visa, tickets and insurance, each with an optional expiry date that feeds Attention.
- **When Online is on:** the destination's weather forecast, public holidays during the trip, and country facts (currency, time zone, plug type, driving side).

### 7. Home
- **Appliances and inventory:** brand, model, serial number, room, purchase date and price.
- **Warranties:** countdown bars. Expiring warranties appear in Attention.
- **Maintenance plans:** "every 3 months" or "every 6 months" (AC, water purifier, filters, pest control), shown on a 90-day timeline. Logging a maintenance job can create a Money expense.
- **Utilities:**
  - meter readings and bills for electricity, water, LPG and internet
  - a trend chart
  - an estimated next bill shown as a range
- **Chores:** recurring tasks, optionally assigned to family members.
- **Room view:** cards for each room, showing a status for the items in it.

### 8. Notes & Lists
- Quick notes and checklists, including shopping, to-do and chore lists.
- Notes and lists can be linked to any record, such as a trip, vehicle or appliance.
- Lists can be pinned to a Board.

### 9. Media shelf
- Movies, TV, anime, books, games and music.
- Statuses: want, in progress, completed, paused, dropped.
- A poster grid with progress rings, covers picked from your photos, ratings, reviews, tags and collections.
- Everything is entered manually. There are no online lookups.

### 10. Tools (expanded)
- **Existing tools:** units, GST/percentage, tip and bill split, dates, EMI.
- **New tools:**
  - cooking converter with serving scaling (for example 4 → 7 servings)
  - time calculator ("7h 43m after 11:26 PM"), with time zones
  - growth calculators: SIP, CAGR, compound interest, inflation
  - randomizer: dice, coin, cards, teams, weighted pick
  - saved decision wheels
- **Dev Tools:**
  - JSON formatter and validator
  - Base64 and URL encode/decode
  - JWT decoder
  - UUID generator
  - hashes
  - timestamp converter
  - regex tester
  - text diff
  - word, character and line count
  - whitespace cleaner
  - colour picker
  - snippet library
- **Custom Tool Builder:**
  - name the tool
  - add inputs (number, money, with units)
  - write a formula
  - choose outputs
  - the tool then appears and behaves like a built-in tool
  - results can be sent to Money

### 11. Rules and reminders (When / If / Then)
- A visual sentence builder. For example: "When a trip starts within 7 days, if packing is below 80%, then remind me and show it in Attention."
- **Triggers:**
  - dates (renewals, expiries, trip start)
  - thresholds (budget %, km since service)
  - events (fuel added, expense added)
  - battery level
- **Actions:**
  - phone reminder notification
  - add to Attention
  - create a task or expense
  - open a Board
- **Dry run:** shows how often the rule would have fired in the last 90 days, before you save it.
- Phone reminders are requested only when you create your first reminder rule.

### 12. Phone Lab
- **Sensor dashboard:** live graphs for the accelerometer, gyroscope, magnetometer, light and barometer, where the phone has them.
- **Sensor recorder:** records for a set time and exports to CSV or JSON.
- **Measurement tools:**
  - compass
  - light meter
  - approximate sound meter (clearly labelled as an estimate)
  - tone generator
  - pitch detector
- **Battery and device info:**
  - battery level, charging state and health
  - device and display information
- **Tests:**
  - display: solid colours, gradients, dead pixels
  - multi-touch tester
  - vibration test
  - guided microphone, speaker and camera check
- Sensors run only while their screen is open, and a visible timer shows during recordings.
- Camera and microphone permission is requested only when that test is started.

### 13. Profiles and security
- **Multiple local profiles** (for example Personal, Work, Family). Each has its own data, modules, Boards and theme, completely separate from the others.
- **Unlock choice:**
  - Options: PIN only, biometric only, or both.
  - A PIN is always set as a hidden backup, in case biometrics fail.
  - Repeated wrong PINs cause an increasing wait.
- **Decoy PIN (duress mode):**
  - entering it opens a believable decoy profile with sample data
  - nothing on screen shows that it is a decoy
  - Opinion: not overkill. Because profiles exist anyway, it is a small, worthwhile addition.
- **Extra lock per module:** for example, Money asks for biometric/PIN again before it opens.
- **Encryption at rest:**
  - all saved data is encrypted on the device
  - the key is kept in the phone's secure hardware storage
  - no data is stored as plain text
- **Other protections:**
  - privacy mode hides amounts
  - screenshot blocking and hiding the app in the recent-apps switcher
  - copied sensitive values are cleared from the clipboard after 60 seconds
  - reminders on the lock screen hide amounts

### 14. Online features (optional)
- **The switch:**
  - a single **Online** switch, OFF by default
  - available in Settings and as a toggle on Today
  - when it is off, the app makes no network requests at all
- **Live currency rates:** used by the converter, multi-currency expenses and trips.
- **Weather:**
  - current conditions and a 7-day forecast for your city and for trip destinations
  - air quality
  - sunrise and sunset
- **Public holidays by country:** used by the date calculator (working days), trip planning and the calendar.
- **Country facts** for trip destinations.
- **What leaves the device:**
  - only the query itself: a currency code, a city name, or your location rounded to about 10 km
  - never your records
  - all requests use encrypted connections (HTTPS)
  - results are cached so they still work offline afterwards
- **Network log:** lists every request ever made (time, service, what was asked).

### 15. Backup, export and Year in Review
- **Encrypted backups:**
  - password-protected by default, with a strength meter
  - a preview is shown before restoring
  - restore can replace your data or merge it with what is already there
- **Exports:**
  - CSV per module
  - calendar (ICS) export of renewals, expiries and itineraries
  - single record or module as JSON
- **Year in Review:**
  - a set of swipeable story cards: km driven, fuel spent, biggest spending category, trips taken, items completed, longest streaks
  - each card can be saved or shared as an image
  - amounts on the cards are hidden by default and can be turned on
- **Timeline:** one chronological feed of everything you recorded, across all modules.
- **Diagnostics:**
  - storage per module
  - active sensors
  - scheduled reminders
  - network log
  - recent errors

---

## User flow
1. **First launch:**
   - welcome
   - choose a theme
   - choose units and currency
   - choose modules
   - choose an unlock method (PIN, biometric or both); optionally set a decoy PIN
   - Online switch (left off unless turned on)
   - start empty or explore with sample data
2. **Unlock**, then **Today**: Attention summary, tiles, weather if Online is on, search, and the capture bar.
3. **Plan a trip:**
   - set the destination and dates
   - pick a packing template or reuse a past list
   - build the itinerary
   - the readiness ring fills and Attention flags anything missing
   - during the trip, expenses in any currency are added and converted
4. **Home:** add an appliance with its warranty. A maintenance plan gets a timeline, and Attention warns before the warranty ends.
5. **Rules:** build "When / If / Then", check the dry run, save. Reminders arrive on the phone.
6. **Tools:** use built-in tools or build your own, and send results to Money.
7. **Profiles:** switch between profiles from Settings. The decoy PIN opens the decoy profile.
8. **Year in Review:** swipe through the cards and share them.
9. **Settings:** themes, Online switch, security, encrypted backup, exports, diagnostics.

**Navigation:** four tabs: **Today · Modules · Attention · Settings**. Boards, search, the capture bar and the timeline are reached from Today.

---

## UI/UX feel
- Dark-first, premium and calm. It should feel like a precision instrument, not a busy dashboard.
- Every module opens with a hero visual (gauge, ring, countdown, poster wall, timeline). Numbers support the visuals, and details are revealed only when asked for.
- Soft depth, subtle gradients, crisp monospaced figures, tick-marked rings and gauges.
- Press animations, staggered entrances, satisfying haptics, and swipe actions on lists.
- Bottom sheets are used for entry. Touch targets are large. Status always shows an icon and a label as well as a colour.
- No text overflows on any screen size. Light themes are just as polished as dark ones.

---

## Implementation phases

### Phase 1: Full platform (built now)
Everything in "Core features" above:
- the rename to Nucleus and the visual overhaul with themes
- the overflow audit
- Boards and the capture bar
- Travel, Home, Notes & Lists, Media
- the expanded Money and Tools
- Dev Tools and the Custom Tool Builder
- Rules with phone reminders
- Phone Lab
- profiles, the PIN/biometric choice and the decoy PIN
- module locks and encryption at rest
- online features with the Online switch and the network log
- encrypted backups, CSV and calendar export
- Year in Review, Timeline and Diagnostics

### Phase 2: Installed-app extras (in the app)
- Android home-screen widgets for a countdown, the budget, the next trip, maintenance, and the battery. Resize them on the home screen. They fill when you open Nucleus. Amounts follow privacy mode.
- Shortcuts from a long-press on the Nucleus icon, up to four, opening a tool or a board.
- These need the installed APK. The emergency card on Nucleus's own lock screen is already in the app (see Life desk).

### Phase 3: Ecosystem (in the app)
- Packs: templates, custom tools, checklists and rules, shared as a file. A short pack can also be shown as a code. On the other phone you approve each row before it is added.
- A backup file from another phone merges into this one. Settings on this phone stay as they are.
- Kanban boards and a wiki. A wiki page links to another with `[[Page title]]`, and the page lists what links back to it.
- Network checks: ping, DNS, and a scan of this phone's own private network. Online must be on. The scan runs only while that screen is open, and it does not save the addresses it finds.
- Receipt text: paste or share the words from a bill, and Nucleus reads the total with fixed rules. It does not read a photo and it does not load a model.

### Life desk (approved and in the app)
These use records you already keep. None of them call a model.
- Papers: licence, registration, insurance, passport, FASTag, with an expiry that reaches Attention.
- A month of dates already stored (insurance, renewals, trips, chores, warranties, papers).
- True cost of a vehicle (fuel, service, other linked spend) and of an appliance (price plus repairs).
- Money left this week, from the monthly budget and what is already spent.
- Household names, used on chores and papers. No contact sync.
- Wear parts (tyres, battery, chain, brakes) and home shop notes (filter size, paint code).
- A photo on an expense, a utility bill, or a paper. The photo is stored; the text on it is not read.
- Data health: a backwards odometer, or the same expense entered twice.
- Sharing a line such as `450 food lunch` into the capture bar. The grammar is fixed. It does not classify with ML or AI.
- A morning line on the home screen.
- An emergency card on the lock screen, only when you turn it on.
- Hybrid fuel (petrol-electric and diesel-electric) and a side view chosen from the model name (Activa is a scooter, a Duke is a naked bike, a City is a sedan). The drawing is original. It is not a photograph of that model.
- The home board is the lasting layout. A named board, such as a trip, is temporary. The tab can stay Today.

### Explicitly not in the product
- Habit tracker.
- Password vault.
- A chat assistant. That would need an on-device or cloud model, and both fight the battery and the local-first rule.
- A photo model for receipts. The receipt tool reads text you paste or share.
- A scan of any network other than this phone's own private subnet.

### Later, not a backend
- Copying an encrypted backup between your own devices (file merge already exists). A cloud account that syncs by itself is not part of this app.

---

## Assumptions
- **Building the APK:**
  - Android APK/AAB builds are made through the platform's **Publish** button: Deploy → Generate Android build. No developer setup is needed.
  - A GitHub Actions workflow builds an arm64 APK. With no release secrets it is signed with the same debug keystore every time, so a newer APK installs over the current one. A private release keystore is optional and, once used, replaces that key.
  - The code can still be saved to GitHub with "Save to GitHub".
- **App identity:**
  - The app's internal Android/iOS ID changes to match the new name (com.nucleus.app).
  - This is safe because the app has not been published yet. After publishing, the ID must never change.
- **Internet permission:** the installed app includes internet permission because the Online features need it. When the Online switch is off, no requests are made, and the network log shows this.
- **Online data sources:**
  - free public services that need no account or key: Frankfurter (currency), Open-Meteo (weather, air quality, place search), Nager.Date (holidays), REST Countries (country facts)
  - weather data is credited in the app, as its licence requires
  - if a service is down, the last cached data is shown with its date
- **Location:** used only for local weather. A saved city is sent rounded to about 1 km, and the forecast prefers a land cell. Typing a city works without location permission.
- **Encryption and passwords:**
  - All data is encrypted at rest on the device.
  - Backups are protected by a password you choose. If that password is forgotten, the backup cannot be opened.
  - The app-wide PIN still cannot be recovered. A forgotten PIN means erasing the data and restoring a backup.
- **Decoy PIN:**
  - It opens a separate decoy profile.
  - It protects against someone looking over your shoulder or forcing you to unlock. It is not proof against forensic examination of the phone.
- **Biometric only:** a PIN is still set during setup as a hidden fallback and is asked for only if biometrics fail or change.
- **Reminders:** phone reminders are scheduled locally and work in the installed app. In the Expo Go preview they may be limited.
- **Phone Lab:**
  - Sensors and readings depend on the phone. Missing sensors are shown as "not available".
  - Battery current, voltage and temperature, and detailed chip and RAM information, need an installed build or may not be exposed by the phone. Only what the phone allows is shown.
  - The sound meter is an uncalibrated estimate.
- **Media covers** come from your own photos. There are no online movie or book lookups.
- **Language and data entry:** English only. Data is still entered by hand: no bank or SMS import.
- **Profiles:** the existing data becomes the "Personal" profile, and nothing is lost in the upgrade.
- **Defaults:** INR, km, litres, °C and 12-hour time, all changeable.
- **Design document:** the existing design document is updated to the Nucleus name and the new scope.
