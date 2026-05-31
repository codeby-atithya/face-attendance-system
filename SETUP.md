# Face Attendance System — Setup Guide

## What You're Getting
A complete browser-based face recognition attendance system with:
- Face registration (webcam capture)
- Live scanning with auto/manual confirm
- Attendance log (Present/Absent per student)
- Google Sheets sync
- Export to CSV
- No API cost — face detection runs 100% in your browser

---

## Project Structure

```
face-attendance/
├── index.html                  ← Main app (open this in browser)
├── src/
│   ├── app.js                  ← All application logic
│   └── style.css               ← Styling
├── scripts/
│   └── google-apps-script.js   ← Paste into Google Apps Script
└── SETUP.md                    ← This file
```

---

## Step 1 — Run the Website Locally

You need a local web server (browsers block camera on file:// URLs).

### Option A — Python (easiest, no install needed)
```bash
# macOS / Linux
cd face-attendance
python3 -m http.server 8080

# Windows
cd face-attendance
python -m http.server 8080
```
Open: http://localhost:8080

### Option B — Node.js (if you have Node installed)
```bash
npx serve face-attendance
# OR
npx http-server face-attendance -p 8080
```
Open the URL shown in terminal.

### Option C — VS Code Live Server
1. Install the "Live Server" extension in VS Code
2. Open the `face-attendance` folder
3. Right-click `index.html` → "Open with Live Server"

---

## Step 2 — Connect to Google Sheets

### 2a. Create your Google Sheet
1. Go to https://sheets.google.com → click **+ New**
2. Rename it to **"Face Attendance"**
3. Rename the first tab to **"Attendance"**
4. Add this header row in Row 1:
   ```
   A1: Name  B1: Roll No  C1: Role  D1: Department  E1: Status  F1: Date  G1: Time  H1: Confidence  I1: Synced On
   ```
   (The Apps Script will auto-create this if missing)

### 2b. Copy your Sheet ID
From the browser URL:
```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit
                                        ↑ THIS IS YOUR SHEET ID
```

### 2c. Set up Google Apps Script
1. In your Google Sheet: click **Extensions → Apps Script**
2. Delete any existing code
3. Open the file `scripts/google-apps-script.js` from this project
4. Copy ALL the code and paste it into the Apps Script editor
5. Click **Save** (floppy disk icon or Ctrl+S)

### 2d. Deploy as Web App
1. Click **Deploy → New deployment**
2. Click the gear icon ⚙ next to "Type" → select **Web app**
3. Fill in:
   - Description: `Face Attendance v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**
5. Click **Authorize access** and allow permissions
6. **Copy the Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycby.../exec
   ```

### 2e. Configure the app
1. Open http://localhost:8080 in your browser
2. Go to **Settings** tab
3. Paste:
   - **Google Sheet ID** (from Step 2b)
   - **Sheet Tab Name**: `Attendance`
   - **Google Apps Script Web App URL** (from Step 2d)
4. Click **Save Settings**
5. Click **Test Connection** — you should see "Connection successful!"

---

## Step 3 — Register Students

1. Go to the **Register** tab
2. Fill in:
   - Full Name (required)
   - Roll Number / ID
   - Role (Student / Staff / Teacher / Admin)
   - Department / Section
3. Click **Start Camera** — allow camera access when prompted
4. Look directly at the camera with your face clearly visible
5. Click **Capture & Register**
6. Repeat for each student

**Tips for good registration:**
- Good lighting (no strong backlight)
- Face the camera straight on
- Keep face within frame
- Register each person individually

---

## Step 4 — Take Attendance

1. Go to the **Scan Attendance** tab
2. Wait for the sidebar to show **"Models ready"** (green dot)
3. Click **Start Scanning**
4. As students appear in front of the camera:
   - A green box appears around recognized faces
   - If **Auto-confirm is OFF**: a confirmation dialog appears — click "Mark Present"
   - If **Auto-confirm is ON**: attendance is marked immediately
5. Today's summary updates in real time

---

## Step 5 — View and Sync Attendance

### View the log
- Go to **Attendance Log** tab
- Filter by Today or All Time
- Shows: Name, Roll No, Role, Department, Status, Time, Confidence

### Export CSV
- Click **Export CSV** in the Log tab or Dashboard
- Downloads a `.csv` file you can open in Excel

### Sync to Google Sheets
- Click **Sync to Sheets** in the Log tab or Dashboard
- Records are uploaded to your Google Sheet
- Duplicate entries (same name + date) are skipped automatically

---

## Settings Reference

| Setting | Description |
|---|---|
| Confidence Threshold | How strict the face match must be (70–80% recommended) |
| Auto-confirm | Skip confirmation dialog; mark attendance instantly |
| Allow duplicate daily entry | Let same person be marked multiple times per day |

---

## Troubleshooting

**"Camera access denied"**
→ Click the camera icon in your browser's address bar and allow access. Make sure you're on http://localhost, not file://

**"No face detected"**
→ Improve lighting, face the camera directly, make sure nothing covers your face

**"Model load failed"**
→ Check your internet connection — models load from jsDelivr CDN

**"Sync failed"**
→ Re-check your Web App URL. If you changed the Apps Script, you must create a NEW deployment (not update existing)

**Face not recognized**
→ Lower the confidence threshold in Settings (try 65%)
→ Re-register the person in better lighting

**Google Sheets not updating**
→ Make sure "Who has access" is set to **Anyone** in your deployment
→ Try the "Test Connection" button in Settings

---

## Hosting on the Internet (Optional)

To share with others or access from multiple devices:

### Free options:
- **Netlify Drop**: Drag your `face-attendance` folder to https://app.netlify.com/drop
- **GitHub Pages**: Push to a GitHub repo → Settings → Pages → Deploy from main branch
- **Vercel**: `npx vercel` from the project folder

Note: The site must be served over HTTPS for camera access to work on deployed versions.

---

## Tech Stack
- **Face detection**: face-api.js (TinyFaceDetector + FaceRecognitionNet) — runs in browser, no API cost
- **Storage**: Browser localStorage for face descriptors and attendance
- **Sync**: Google Apps Script Web App (free with Google account)
- **No backend required** — fully static website
