# 🎓 AI Face Recognition Attendance System

An enterprise-ready, serverless, and browser-native **AI Face Recognition Attendance System** designed to streamline attendance tracking with zero server costs, maximum privacy, and seamless cloud integration.

Powered by advanced machine learning models running directly in the browser via `face-api.js`, this application eliminates the need for expensive dedicated hardware, cloud AI API subscriptions, or complex backend infrastructures. All biometric calculations, face matching, and database storage are handled on the client-side, ensuring robust security and absolute data privacy.

---

## 🚀 Project Overview

Managing attendance in educational institutions and corporate settings is traditionally plagued by manual errors, proxy attendance ("buddy punching"), and cumbersome hardware setups. 

This project solves these issues by delivering a **zero-cost, highly secure, and instant face-recognition solution**. By running high-performance neural networks (TinyFaceDetector and FaceRecognitionNet) locally inside standard browser environments, it achieves high-fidelity face tracking, matching, and logging. The system is designed to run completely offline or integrate seamlessly with cloud platforms like Google Sheets.

---

## ✨ Features

- **👤 AI-Powered Face Registration**: Captures 5 distinct webcam samples per user to build a highly stable and robust average face descriptor, minimizing detection variance under different poses.
- **🔍 Real-Time Face Recognition Attendance**: Conducts live webcam scanning with real-time bounding boxes, landmark tracking, confidence indicators, and custom confirmation flows.
- **🛡️ Cross-Role Face Duplicate Detection**: Leverages an advanced **Average Minimum Distance** algorithm with a strict duplicate threshold (`0.52`) to compare new face registrations against the entire database. Prevents cross-role duplications (Student ↔ Staff) and blocks duplicate registrations of the same face under different profiles.
- **🆔 Roll Number Duplicate Check**: Performs a database-wide search for Roll Numbers/IDs during registration to ensure absolute data integrity and prevent identifier collisions.
- **✅ Finalize Attendance Flow**: Allows administrators to finalize the attendance session, which automatically identifies all registered students who were not scanned today and logs them as `Absent` with zero confidence.
- **🔄 Absent ➔ Present Status Transition**: Intelligently handles late arrivals. If a student is marked `Absent` during finalization but is subsequently scanned, the system automatically removes their `Absent` record for the day and logs a `Present` entry.
- **📊 Real-Time Analytics & Charts**: Interactive dashboard showing total registrations, presence rates, and absence counts. Dynamic bar and line charts powered by `Chart.js` track weekly and monthly trends, filtering out `Absent` records to maintain absolute reporting integrity.
- **📥 One-Click CSV Export**: Downloads complete attendance histories in standard CSV format, fully compatible with Excel and Google Sheets.
- **📄 Professional PDF Export**: Generates landscape-oriented, branded PDF reports containing session summaries, metrics, and formatted grid tables with automatically calculated percentages.
- **☁️ Cloud Google Sheets Integration**: Syncs attendance data directly to a configured Google Sheet using a free Google Apps Script web app, skipping duplicate entries automatically.
- **💾 LocalStorage Persistence**: Stores face descriptors, configurations, and attendance logs in the browser's persistent storage, ensuring zero database upkeep.
- **🎨 Glassmorphism Responsive UI**: High-end modern styling featuring vibrant gradients, dark mode aesthetics, and micro-animations optimized for mobile and desktop screens.

---

## 🛠️ Technology Stack

- **Core**: HTML5, Vanilla JavaScript (ES5/ES6+), Modern Semantic Structures
- **Styling**: Vanilla CSS3 (Advanced Flexbox/Grid, Custom Properties, Glassmorphism Animations)
- **AI / Machine Learning**: `face-api.js` (tinyFaceDetector, faceLandmark68TinyNet, faceRecognitionNet models)
- **Data Visualization**: `Chart.js` (Modular Canvas-based rendering)
- **PDF Generation**: `jsPDF` & `jsPDF-AutoTable`
- **Cloud Sync**: Google Apps Script (Web App Endpoint Interface)
- **Version Control**: Git & GitHub

---

## 📦 Project Structure

```text
face-attendance/
├── index.html                   # Main single-page application structure & UI
├── src/
│   ├── app.js                   # State engine, AI recognition loop, and business logic
│   └── style.css                # Premium custom variables, layouts, and animations
├── public/
│   ├── face-api.min.js          # Pre-compiled face-api.js library
│   └── weights/                 # Local neural network model weights
│       ├── tiny_face_detector_model-shard1
│       ├── face_landmark_68_tiny_model-shard1
│       └── face_recognition_model-shard1 & shard2
├── scripts/
│   └── google-apps-script.js    # Google Sheets Apps Script integration source
├── package.json                 # Node package configuration and serving scripts
├── SETUP.md                     # Comprehensive setup guide
└── README.md                    # Developer portfolio documentation
```

---

## ⚙️ Installation & Setup

### Prerequisites
Ensure you have **Node.js** installed on your system.

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/ai-face-attendance-system.git
cd ai-face-attendance-system
```

### 2. Install Development Dependencies
```bash
npm install
```

---

## 🚀 Running the Project

According to `package.json`, you can launch the local serving environments using the following commands (camera access requires a local web server):

### Start the production server (npx serve):
```bash
npm start
```
This runs the application locally at **[http://localhost:3000](http://localhost:3000)**.

### Run in local development mode (npx live-server):
```bash
npm run dev
```

### Serve via HTTP server with CORS enabled (npx http-server):
```bash
npm run serve
```

> ⚠️ **Important**: Browsers block camera access on local filesystem `file://` URLs. Always run the application using one of the NPM commands above.

---

## 📸 Screenshots & UI

Below are visual demonstrations of the system interface:

### 1. Analytics & Monitoring Dashboard
*Premium glassmorphism dashboard displaying real-time metrics, recent scan history, and presence graphs.*
![Dashboard Placeholder](https://via.placeholder.com/800x450/0c1220/00e676?text=Dashboard+Analytics+Interface)

### 2. Live Scanning & AI Recognition
*Real-time facial detection showing bounding boxes, localized landmark overlay, and confidence level percentage.*
![Scanning Placeholder](https://via.placeholder.com/800x450/0c1220/00f5d4?text=Live+AI+Scanning+Interface)

### 3. Student & Staff Registry
*Grid layout displaying registered users, base64 cached profile photos, and count of face samples.*
![Registry Placeholder](https://via.placeholder.com/800x450/0c1220/a78bfa?text=Registry+Management+Grid)

---

## 🔮 Future Improvements

- **Hybrid SQLite/Node Backend**: Transition option to a persistent lightweight Node server using SQLite for large-scale corporate deployments.
- **Liveness Detection**: Introduce blinking and head-movement checks to prevent spoofing with static photos.
- **Multi-Camera Support**: Allow administrators to select and toggle between multiple active USB/IP webcams in real-time.
- **Automated Email Reports**: Automated daily presence/absence email alerts to parents or department heads.

---

## 📄 License

This project is licensed under the MIT License.

---

## ✍ Honor & Authorship

**Your Name**
- GitHub: [@your-username](https://github.com/your-username)
- LinkedIn: [Your Profile](https://linkedin.com/in/your-profile)
- Portfolio: [Your Website](https://your-portfolio.com)
