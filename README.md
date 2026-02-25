# Explain Energy (Tesla Energy Explainability Demo)

A lightweight, Tesla-style mobile demo that explores an **explainability layer** for the Tesla Energy app.

The core idea: users can select a time window from an energy day chart, tap **Explain**, and see a **timeline of system decisions** with **plausible reasons + evidence**. A **What-If (Replay)** section lets users adjust key parameters (Backup Reserve and Mode) to see how outcomes would change for that same window.

---

## Live Demo (Expo Go)

**Expo Go link (iOS/Android):**  
`exp://u.expo.dev/d100d9c9-048f-4b25-ab3a-16b13c659592?channel-name=preview`

### How to run it on your phone
1. Install **Expo Go**:
   - iOS: App Store (search “Expo Go”)
   - Android: Google Play (search “Expo Go”)
2. Open Expo Go.
3. Paste the link above into Expo Go (or open it from your phone and choose **Open in Expo Go** when prompted).

> Note: This is a demo/prototype. Data and outputs are illustrative.

---

## Demo Video

Watch the walkthrough here:  
`./demo-video.mp4`

---

## What the app does

### 1) Energy Overview
- Displays **daily energy usage** as a chart.
- Lets you select a **time window** using a dual-handle range control.

### 2) Explain Screen
- Shows a **timeline of events** inside the selected window.
- Each event expands into:
  - **What happened** (plain-language description)
  - **Why** (reason + confidence)
  - **Evidence** (simple, computed facts from the selected window)

### 3) What-If (Replay)
- Lets you tweak:
  - **Backup Reserve (%)**
  - **Mode** (Time-Based vs Self-Powered)
- Replays the same selected window under new parameters and shows:
  - **End SOC delta**
  - **Grid import delta**
  - **Battery discharge delta**
- This is a **replay preview**, not a forecast.

---

## Tech Stack
- Expo + React Native + TypeScript
- Tesla-style theming
- A deterministic one-day dataset at 5-minute granularity for realisstic demo

---

## Local Development

### Prerequisites
- Node.js
- npm

### Install & run
```bash
npm install
npx expo start
