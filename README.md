# 🎓 Face Attendance System

A **free, browser-based** face recognition attendance system.  
No API keys. No backend. No cost. Runs entirely in your browser.

![Stack](https://img.shields.io/badge/face--api.js-0.22.2-green) ![License](https://img.shields.io/badge/license-MIT-blue) ![Cost](https://img.shields.io/badge/API%20cost-%240-brightgreen)

---

## ✨ Features

| Feature | Details |
|---|---|
| 👤 Face Registration | Webcam capture → store face descriptor locally |
| 🔍 Live Scanning | Real-time face detection + matching |
| ✅ Auto / Manual confirm | Mark instantly or show confirm dialog |
| 📋 Attendance Log | Present/Absent records with timestamp |
| 📊 Google Sheets Sync | Push records to your Google Sheet |
| 📥 CSV Export | Download attendance as CSV |
| 💾 Local Storage | All data saved in browser, no server needed |

---

## 🚀 Quick Start (3 steps)

### Step 1 — Open terminal in this folder

```bash
# Install (one time only)
npm install

# Start the app
npm start
```

Open **http://localhost:3000** in your browser.

> ⚠️ Must use localhost — camera doesn't work on file://

---

### Step 2 — Register students

1. Click **Register** in the sidebar
2. Enter name, roll number, role, department
3. Click **Start Camera** → face the camera → click **Capture & Register**
4. Repeat for all students

---

### Step 3 — Take attendance

1. Click **Scan Attendance**
2. Wait for **"Models ready"** (green dot in sidebar)
3. Click **Start Scanning**
4. Students stand in front of camera — attendance auto-marks!

---

## 🔗 Connect to Google Sheets

See **[SETUP.md](./SETUP.md)** for the full step-by-step guide.

**Quick summary:**
1. Create a Google Sheet
2. Open Extensions → Apps Script
3. Paste code from `scripts/google-apps-script.js`
4. Deploy as Web App (Anyone can access)
5. Paste the URL in Settings tab of the app

---

## 📁 Project Structure

```
face-attendance/
├── index.html                   # Main single-page app
├── src/
│   ├── app.js                   # All JS logic
│   └── style.css                # All styles
├── scripts/
│   └── google-apps-script.js    # Google Sheets connector
├── package.json                 # npm scripts
├── .cursorrules                 # Cursor AI context
├── SETUP.md                     # Detailed setup guide
└── README.md                    # This file
```

---

## 🛠 Tech Stack

- **[face-api.js](https://github.com/justadudewhohacks/face-api.js)** — Face detection & recognition (runs in browser, free)
- **localStorage** — Stores face descriptors and attendance records
- **Google Apps Script** — Free Google Sheets integration
- **Vanilla JS / HTML / CSS** — No frameworks, no build step

---

## 🆘 Troubleshooting

| Problem | Fix |
|---|---|
| Camera denied | Allow camera in browser → address bar → camera icon |
| No face detected | Better lighting, face camera directly |
| Models not loading | Check internet — loads from jsDelivr CDN |
| Face not recognized | Lower confidence threshold in Settings (try 65%) |
| Sheets sync fails | Re-deploy Apps Script, set access to "Anyone" |

Full troubleshooting: see [SETUP.md](./SETUP.md)
