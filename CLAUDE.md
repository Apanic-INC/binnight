# BinNight — Australian Bin Collection Reminder App

## Project Plan & Tech Stack Guide for Claude Code

---

## What You're Building

An app that reminds Australians which bins to put out the night before collection. Users enter their address, the app figures out their council and collection schedule, then sends push notifications and shows a home screen widget.

---

## Tech Stack (and why)

### Mobile App: React Native + Expo

- **Why React Native?** You write one codebase and get both iOS and Android apps. Perfect for a beginner — you only learn one thing instead of two.
- **Why Expo?** It's a toolkit on top of React Native that handles the hard stuff for you — push notifications, building the app, app store submissions. Without Expo, you'd be fighting Xcode and Android Studio for weeks.
- **Language:** TypeScript (JavaScript with safety rails). Claude Code writes excellent TypeScript.

### Backend: Supabase

- **What is it?** A hosted database + authentication + serverless functions. Think of it as your app's brain that lives in the cloud.
- **Why Supabase?** Free tier is generous, it gives you a PostgreSQL database, user auth, and "Edge Functions" (little scripts that run on a schedule) — all the pieces you need without managing servers. It's also very well-documented, which helps Claude Code generate accurate code.

### Web Scraping: Playwright

- **What is it?** A tool that controls a real web browser programmatically. It can navigate to a council website, type in an address, wait for results, and read the data.
- **Why Playwright?** Council websites load bin data with JavaScript after you search. Simple scraping tools can't handle this — you need something that runs a real browser. Playwright is the modern standard for this.
- **Where does it run?** On your backend, not in the app. A Supabase Edge Function or a small cloud server triggers Playwright when a new user signs up.

### Push Notifications: Expo Notifications

- **Built into Expo.** You register a user's device, store their push token, and send notifications from your backend on a schedule.

### Home Screen Widget: expo-widget (iOS) / React Native for Android

- **This is the hardest part** and should be saved for later. iOS widgets require a small amount of Swift code. Build the core app first, add the widget as a v2 feature.

---

## Project Structure

This is the folder layout you'll ask Claude Code to create:

```
binnight/
├── app/                        # The mobile app (Expo + React Native)
│   ├── app/                    # Screens (Expo Router file-based routing)
│   │   ├── index.tsx           # Home screen — shows next bin collection
│   │   ├── setup.tsx           # Onboarding — enter your address
│   │   ├── calendar.tsx        # Full calendar view of all collections
│   │   └── settings.tsx        # Notification preferences, change address
│   ├── components/             # Reusable UI pieces
│   │   ├── BinCard.tsx         # Shows a single bin with colour + date
│   │   ├── BinIcon.tsx         # Coloured bin SVG icon
│   │   ├── AddressSearch.tsx   # Address autocomplete input
│   │   └── NextCollection.tsx  # "Tomorrow: Red + Yellow bins" display
│   ├── hooks/                  # Shared logic
│   │   ├── useSchedule.ts     # Fetches and caches bin schedule
│   │   └── useNotifications.ts # Registers and manages push notifications
│   ├── lib/                    # Utilities
│   │   ├── supabase.ts        # Supabase client setup
│   │   ├── types.ts           # TypeScript types for bins, schedules, etc.
│   │   └── colours.ts         # Bin colour definitions (red, yellow, green, purple)
│   ├── assets/                 # Images, fonts, app icon
│   └── app.json               # Expo configuration
│
├── supabase/                   # Backend
│   ├── migrations/             # Database table definitions
│   │   └── 001_initial.sql    # Creates tables for users, schedules, councils
│   ├── functions/              # Serverless functions
│   │   ├── scrape-schedule/   # Playwright scraper that fetches bin calendar
│   │   └── send-notifications/ # Runs daily, sends push notifications
│   └── seed.sql               # Initial council data (start with Merri-bek)
│
└── scrapers/                   # Council-specific scraping logic
    ├── base-scraper.ts        # Shared scraping interface
    └── merri-bek.ts           # Merri-bek specific scraper
```

---

## Database Tables

Ask Claude Code to create these Supabase tables:

### `councils`
| Column        | Type    | Description                              |
|---------------|---------|------------------------------------------|
| id            | uuid    | Primary key                              |
| name          | text    | "Merri-bek City Council"                 |
| state         | text    | "VIC"                                    |
| website_url   | text    | Council waste calendar URL               |
| scraper_id    | text    | Which scraper to use, e.g. "merri-bek"   |

### `users`
| Column           | Type      | Description                           |
|------------------|-----------|---------------------------------------|
| id               | uuid      | Primary key                           |
| address          | text      | User's street address                 |
| council_id       | uuid      | Links to their council                |
| collection_zone  | text      | Their specific zone/area within council |
| push_token       | text      | Expo push notification token          |
| notify_time      | time      | When to send reminder (default 6pm)   |
| created_at       | timestamp | When they signed up                   |

### `collection_schedule`
| Column        | Type    | Description                              |
|---------------|---------|------------------------------------------|
| id            | uuid    | Primary key                              |
| council_id    | uuid    | Which council                            |
| zone          | text    | Collection zone within council           |
| date          | date    | Collection date                          |
| bins          | text[]  | Array: ["fogo"], ["fogo","rubbish"], ["recycling"], ["glass"] |
| is_holiday    | boolean | If true, collection is skipped           |

---

## The Build Order (Step by Step)

This is the order you should build things in. Each step is a prompt (or series of prompts) you'll give Claude Code.

### Phase 1: Get the scraper working (Week 1)

This is the proof-of-concept. If you can get bin data from the Merri-bek website, everything else is just UI.

**Prompt 1:** *"Create a Node.js script using Playwright that navigates to https://www.merri-bek.vic.gov.au/living-in-merri-bek/waste-and-recycling/bins-and-collection-services/waste-calendar26/, types in an address, waits for the calendar to load, then extracts all the bin collection dates and their types (FOGO, rubbish, recycling, glass) into a JSON file. The calendar colour-codes dates: green = rubbish + FOGO, yellow = recycling, magenta = glass. FOGO is weekly."*

**Prompt 2:** *"Now store this scraped data in a Supabase database. Set up the database tables for councils, users, and collection_schedule. Insert the Merri-bek council and the scraped schedule data."*

### Phase 2: Build the mobile app shell (Week 2)

**Prompt 3:** *"Create a new Expo React Native app with Expo Router. Set up four screens: a home screen that shows the next upcoming bin collection, a setup screen where users enter their address, a calendar screen showing the full month view, and a settings screen. Use a fun, friendly design with actual bin colours (red lid = rubbish, lime green lid = FOGO, yellow lid = recycling, purple lid = glass). Connect it to Supabase."*

**Prompt 4:** *"Build the address entry flow on the setup screen. Use the Google Places Autocomplete API to let users type their address. When they submit, look up their council (start with just Merri-bek) and store their details in Supabase. Then navigate to the home screen showing their next collection."*

### Phase 3: Push notifications (Week 3)

**Prompt 5:** *"Add push notifications using Expo Notifications. When a user sets up their address, register their push token and store it in Supabase. Create a Supabase Edge Function that runs every day at 6pm AEST, checks which users have a bin collection tomorrow, and sends them a push notification like 'Tomorrow: Put out your red bin and green bin 🗑️'."*

### Phase 4: Polish and widget (Week 4+)

**Prompt 6:** *"Add a calendar view that shows the full month with coloured dots on collection days matching the bin colours. Make the home screen show a countdown to the next collection and large, friendly bin icons showing which bins are next."*

**Prompt 7 (advanced):** *"Add an iOS home screen widget using expo-widget that shows tomorrow's bins as coloured bin icons with the collection day name."*

---

## Key Concepts for a Beginner

### What's an API?
Think of it as a waiter in a restaurant. Your app (the customer) asks the API (the waiter) for data, and the API goes to the kitchen (the database) and brings it back. Your app never talks directly to the database.

### What's a "serverless function"?
A tiny script that runs in the cloud when triggered. You don't manage a server — it just runs when needed. Your notification sender is a serverless function that wakes up every evening, checks who needs a reminder, sends it, then goes back to sleep.

### What's "scraping"?
Automatically reading data from a website. Instead of you going to the council website, typing your address, and reading the calendar — a script does exactly that, but stores the result in your database.

### What does "deploy" mean?
Putting your app somewhere people can use it. For the mobile app, that means submitting it to the Apple App Store and Google Play Store. Expo makes this relatively painless with `eas build` and `eas submit`.

---

## Costs to Expect

| Service                | Free Tier                        | When You'd Pay              |
|------------------------|----------------------------------|-----------------------------|
| Supabase               | 50,000 rows, 500MB              | Thousands of users          |
| Expo                   | Free for development             | ~$99/year Apple dev account |
| Google Places API      | $200/month free credit           | Unlikely to exceed at first |
| Apple Developer Account| N/A                              | $149 AUD/year (required)    |
| Google Play Console    | N/A                              | $35 AUD one-time            |

**Total to launch:** ~$185 AUD, mostly Apple's developer fee.

---

## Tips for Working with Claude Code

1. **Work in small steps.** Don't ask Claude Code to build the whole app at once. Follow the phase order above — one prompt at a time.
2. **Test each step.** After each prompt, run the code and make sure it works before moving on.
3. **Share errors.** When something breaks (it will), paste the full error message into Claude Code. It's very good at debugging.
4. **Keep a CLAUDE.md file** in your project root that describes what the app does, what tech you're using, and what's been built so far. Claude Code reads this to stay on track.
5. **Use git.** After each working step, commit your code. Claude Code can help you with this too.

---

## Your CLAUDE.md File (Put This in Your Project Root)

```markdown
# BinNight

## What This App Does
Reminds Australians which bins to put out the night before collection day.
Users enter their address, we look up their council's bin schedule, and send
them a push notification every collection eve with which coloured bins to
put out. Also shows a home screen widget.

## Tech Stack
- Mobile app: React Native + Expo (TypeScript), Expo Router for navigation
- Backend: Supabase (PostgreSQL database, Edge Functions, Auth)
- Scraping: Playwright (headless browser to scrape council websites)
- Notifications: Expo Notifications
- Address lookup: Google Places Autocomplete API

## Current Status
- [ ] Playwright scraper for Merri-bek council
- [ ] Supabase database tables
- [ ] Expo app with basic screens
- [ ] Address entry and council lookup
- [ ] Push notification system
- [ ] Calendar view
- [ ] Home screen widget

## Bin Types (Merri-bek)
- FOGO (lime green lid) — collected weekly
- General rubbish (red lid) — collected fortnightly
- Mixed recycling (yellow lid) — collected fortnightly (alternates with rubbish)
- Glass recycling (purple lid) — collected monthly (or drop-off point)

## Key URLs
- Merri-bek waste calendar: https://www.merri-bek.vic.gov.au/living-in-merri-bek/waste-and-recycling/bins-and-collection-services/waste-calendar26/

## Design Notes
- Friendly, simple, not corporate
- Use actual bin lid colours as the primary colour palette
- Big, clear bin icons on home screen
- Notification tone should be casual: "Tomorrow: Red bin + Green bin 🗑️"
```

---

## Quick Start Commands

Once you're ready to begin with Claude Code:

```bash
# 1. Install Claude Code (if you haven't)
npm install -g @anthropic-ai/claude-code

# 2. Create your project folder
mkdir binnight && cd binnight

# 3. Create the CLAUDE.md file (paste the content above)

# 4. Start Claude Code
claude

# 5. Give it your first prompt:
# "Set up a new Expo React Native project with TypeScript and Expo Router.
#  Also set up a Playwright script in a /scrapers folder. Read CLAUDE.md
#  for full project context."
```
