'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
let registered = JSON.parse(localStorage.getItem('fas_registered') || '[]');
let attendanceLog = JSON.parse(localStorage.getItem('fas_log') || '[]');
let settings = JSON.parse(localStorage.getItem('fas_settings') || '{"confThreshold":"60","autoConfirm":true}');

// Convert stored descriptor arrays back to Float32Array
registered = registered.map(p => ({
  ...p,
  descriptors: p.descriptors
    ? p.descriptors.map(d => new Float32Array(Object.values(d)))
    : (p.descriptor ? [new Float32Array(Object.values(p.descriptor))] : [])
}));

let modelsLoaded = false;
let regStream = null;
let scanStream = null;
let scanLoop = null;
let pendingMatch = null;
let isScanning = false;
let capturing = false;

const MODEL_URL = './public/weights';

let weeklyChart = null;
let donutChart = null;
let monthlyChart = null;
let studentPctChart = null;

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadModels();
  renderDashboard();
  renderLog();
  renderStudents();
  applySettings();
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
});

// ─── Models ───────────────────────────────────────────────────────────────────
async function loadModels() {
  setModelStatus('loading', 'Loading models…');
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    modelsLoaded = true;
    setModelStatus('ready', 'Models ready');
  } catch (e) {
    setModelStatus('error', 'Model load failed');
    console.error('Model load error:', e);
  }
}

function setModelStatus(state, text) {
  const el = document.getElementById('model-status');
  el.className = 'model-status ' + state;
  document.getElementById('model-status-text').textContent = text;
  const mobileDot = document.getElementById('mobile-model-dot');
  if (mobileDot) mobileDot.className = 'mobile-model-dot ' + state;
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-section').forEach(s => s.classList.toggle('active', s.id === 'tab-' + name));
  closeSidebar();
  if (name !== 'register' && regStream) stopRegCam();
  if (name !== 'scan' && isScanning) stopScanning();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('visible');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}

// ─── Registration ─────────────────────────────────────────────────────────────
async function toggleRegCam() {
  if (regStream) { stopRegCam(); return; }
  try {
    regStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
    const video = document.getElementById('reg-video');
    video.srcObject = regStream;
    video.style.display = 'block';
    document.getElementById('reg-overlay').style.display = 'block';
    document.getElementById('reg-placeholder').style.display = 'none';
    setRegCamBtnLabel('Stop Camera');
    document.getElementById('reg-capture-btn').disabled = false;
  } catch (e) {
    showFeedback('reg-feedback', 'error', 'Camera access denied. Please allow camera in browser settings.');
  }
}

function stopRegCam() {
  if (regStream) { regStream.getTracks().forEach(t => t.stop()); regStream = null; }
  const video = document.getElementById('reg-video');
  video.style.display = 'none';
  video.srcObject = null;
  document.getElementById('reg-overlay').style.display = 'none';
  document.getElementById('reg-placeholder').style.display = 'flex';
  setRegCamBtnLabel('Start Camera');
  document.getElementById('reg-capture-btn').disabled = true;
}

function setRegCamBtnLabel(label) {
  const btn = document.getElementById('reg-cam-btn');
  const textNode = btn.querySelector('.btn-label');
  if (textNode) textNode.textContent = label;
  else btn.append(document.createTextNode(label));
}

async function captureAndRegister() {
  if (capturing) return;
  const name = document.getElementById('reg-name').value.trim();
  const rollNo = document.getElementById('reg-id').value.trim();
  const role = document.getElementById('reg-role').value;
  const dept = document.getElementById('reg-dept').value.trim();

  if (!name) { showFeedback('reg-feedback', 'error', 'Please enter the student name.'); return; }
  if (!role) { showFeedback('reg-feedback', 'error', 'Please select a role.'); return; }
  if (!modelsLoaded) { showFeedback('reg-feedback', 'error', 'Face models are still loading. Please wait.'); return; }

  const video = document.getElementById('reg-video');
  if (!regStream || !video.srcObject) { showFeedback('reg-feedback', 'error', 'Please start the camera first.'); return; }

  capturing = true;
  document.getElementById('reg-capture-btn').disabled = true;

  // Capture multiple samples for better accuracy
  const SAMPLES = 5;
  const descriptors = [];
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.3 });

  for (let i = 0; i < SAMPLES; i++) {
    showFeedback('reg-feedback', 'info', `Capturing sample ${i + 1} of ${SAMPLES}… Hold still.`);
    await wait(400);
    try {
      const detection = await faceapi.detectSingleFace(video, opts).withFaceLandmarks(true).withFaceDescriptor();
      if (detection) {
        descriptors.push(detection.descriptor);
      }
    } catch (e) { /* skip failed sample */ }
  }

  capturing = false;
  document.getElementById('reg-capture-btn').disabled = false;

  if (descriptors.length === 0) {
    showFeedback('reg-feedback', 'error', 'No face detected in any sample. Ensure good lighting and face the camera directly.');
    return;
  }

  // 1. Roll Number Duplicate Check
  if (rollNo) {
    const idOwner = registered.find(p => p.id === rollNo);
    if (idOwner) {
      showFeedback('reg-feedback', 'error', 'Roll Number already registered.');
      capturing = false;
      document.getElementById('reg-capture-btn').disabled = false;
      return;
    }
  }

  // 2. Face Duplicate Check
  const DUP_THRESHOLD = 0.60;
  let minDistance = 1.0;
  let bestMatch = null;

  for (const person of registered) {
    for (const storedDesc of person.descriptors) {
      for (const newDesc of descriptors) {
        const dist = faceapi.euclideanDistance(newDesc, storedDesc);
        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = person;
        }
      }
    }
  }

  console.log(`[Duplicate Check] Min Distance: ${minDistance.toFixed(4)}, Threshold: ${DUP_THRESHOLD}, Match: ${bestMatch ? bestMatch.name : 'None'}`);

  if (minDistance < DUP_THRESHOLD) {
    showFeedback('reg-feedback', 'error', `This face is already registered as ${bestMatch.role} - ${bestMatch.name}.`);
    capturing = false;
    document.getElementById('reg-capture-btn').disabled = false;
    return;
  }

  const existingIdx = registered.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
  const photo = captureProfilePhoto(video) || (existingIdx >= 0 ? registered[existingIdx].photo : null);

  const person = {
    id: rollNo || 'ID-' + Date.now(),
    name, role, dept,
    descriptors,
    photo,
    registeredAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    registered[existingIdx] = person;
    showFeedback('reg-feedback', 'success', `✓ ${name} updated with ${descriptors.length} face samples!`);
  } else {
    registered.push(person);
    showFeedback('reg-feedback', 'success', `✓ ${name} registered with ${descriptors.length} face samples!`);
  }

  saveRegistered();
  renderStudents();
  renderDashboard();

  document.getElementById('reg-name').value = '';
  document.getElementById('reg-id').value = '';
  document.getElementById('reg-role').value = '';
  document.getElementById('reg-dept').value = '';
}

// ─── Scanning ─────────────────────────────────────────────────────────────────
async function startScanning() {
  if (!registered.length) {
    showFeedback('scan-feedback', 'error', 'No students registered. Go to Register tab first.');
    return;
  }
  if (!modelsLoaded) {
    showFeedback('scan-feedback', 'error', 'Face models not ready yet. Check sidebar status.');
    return;
  }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } });
    const video = document.getElementById('scan-video');
    const overlay = document.getElementById('scan-overlay');
    video.srcObject = scanStream;
    video.style.display = 'block';
    overlay.style.display = 'block';
    document.getElementById('scan-placeholder').style.display = 'none';
    document.getElementById('start-scan-btn').disabled = true;
    document.getElementById('stop-scan-btn').disabled = false;

    const pill = document.getElementById('scan-status-pill');
    pill.className = 'status-pill scanning';
    document.getElementById('scan-status-text').textContent = 'Scanning…';
    isScanning = true;

    // Set overlay size once video is playing
    video.addEventListener('loadedmetadata', () => {
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
    });
    // Fallback set after short delay
    setTimeout(() => {
      if (video.videoWidth) { overlay.width = video.videoWidth; overlay.height = video.videoHeight; }
    }, 1000);

    let lastScan = 0;
    let running = false;
    scanLoop = setInterval(async () => {
      if (!isScanning || pendingMatch || running) return;
      const now = Date.now();
      if (now - lastScan < 800) return;
      lastScan = now;
      running = true;
      await runDetection();
      running = false;
    }, 200);
  } catch (e) {
    showFeedback('scan-feedback', 'error', 'Camera error: ' + (e.message || 'Access denied'));
  }
}

function stopScanning() {
  isScanning = false;
  clearInterval(scanLoop);
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  const video = document.getElementById('scan-video');
  video.style.display = 'none';
  video.srcObject = null;
  document.getElementById('scan-overlay').style.display = 'none';
  document.getElementById('scan-placeholder').style.display = 'flex';
  document.getElementById('start-scan-btn').disabled = false;
  document.getElementById('stop-scan-btn').disabled = true;
  const pill = document.getElementById('scan-status-pill');
  pill.className = 'status-pill';
  document.getElementById('scan-status-text').textContent = 'Stopped';
  pendingMatch = null;
  document.getElementById('confirm-card').style.display = 'none';
  const overlay = document.getElementById('scan-overlay');
  if (overlay.getContext) {
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }
}

async function runDetection() {
  const video = document.getElementById('scan-video');
  const overlay = document.getElementById('scan-overlay');
  if (!video.videoWidth || !overlay.width) {
    overlay.width = video.videoWidth || 640;
    overlay.height = video.videoHeight || 480;
    return;
  }

  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 });
  let detections;
  try {
    detections = await faceapi.detectAllFaces(video, opts).withFaceLandmarks(true).withFaceDescriptors();
  } catch (e) { return; }

  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  if (!detections || !detections.length) return;

  // Use actual video dimensions for correct scaling
  const vidW = video.videoWidth;
  const vidH = video.videoHeight;
  const scaleX = overlay.width / vidW;
  const scaleY = overlay.height / vidH;

  // Threshold: distance below this = match (lower = stricter)
  const distThresh = (100 - parseInt(settings.confThreshold || 60)) / 100;

  for (const d of detections) {
    const box = d.detection.box;
    const x = box.x * scaleX;
    const y = box.y * scaleY;
    const w = box.width * scaleX;
    const h = box.height * scaleY;

    // Find best matching registered person using all their stored samples
    let bestPerson = null, bestDist = 1;
    for (const p of registered) {
      if (!p.descriptors || !p.descriptors.length) continue;
      // Compare against each stored sample, take the best (lowest) distance
      for (const storedDesc of p.descriptors) {
        const dist = faceapi.euclideanDistance(d.descriptor, storedDesc);
        if (dist < bestDist) { bestDist = dist; bestPerson = p; }
      }
    }

    const matched = bestPerson && bestDist < distThresh;
    const confidence = Math.round((1 - bestDist) * 100);

    // Draw bounding box
    ctx.strokeStyle = matched ? '#1D9E75' : '#dc2626';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    // Draw label background
    const label = matched ? `${bestPerson.name} (${confidence}%)` : `Unknown`;
    ctx.font = 'bold 14px sans-serif';
    const textW = ctx.measureText(label).width + 12;
    const labelY = y > 24 ? y - 24 : y + h + 4;
    ctx.fillStyle = matched ? '#1D9E75' : '#dc2626';
    ctx.fillRect(x, labelY, textW, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 6, labelY + 15);

    // Trigger attendance
    if (matched && !pendingMatch) {
      const alreadyMarked = !settings.allowDupes && attendanceLog.some(
        a => a.name === bestPerson.name && isSameDay(new Date(a.time))
      );
      if (alreadyMarked) {
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('Already marked', x, y > 44 ? y - 28 : y + h + 26);
        continue;
      }
      pendingMatch = { person: bestPerson, confidence };
      if (settings.autoConfirm) {
        markAttendance(bestPerson, confidence);
        pendingMatch = null;
      } else {
        showConfirmDialog(bestPerson, confidence);
      }
    }
  }
}

function showConfirmDialog(person, confidence) {
  document.getElementById('confirm-avatar').innerHTML = avatarHTML(person);
  document.getElementById('confirm-name').textContent = person.name;
  document.getElementById('confirm-meta').textContent = (person.role || '') + (person.id ? ' · ' + person.id : '');
  document.getElementById('confirm-conf').textContent = 'Match confidence: ' + confidence + '%';
  document.getElementById('confirm-card').style.display = 'block';
}

function confirmAttendance(yes) {
  document.getElementById('confirm-card').style.display = 'none';
  if (yes && pendingMatch) {
    markAttendance(pendingMatch.person, pendingMatch.confidence);
  } else {
    showFeedback('scan-feedback', 'error', 'Attendance rejected.');
  }
  pendingMatch = null;
}

function markAttendance(person, confidence) {
  // Duplicate Present Protection: A student can only have one Present record per day
  const alreadyPresent = attendanceLog.some(
    a => a.name === person.name && a.status === 'Present' && isSameDay(new Date(a.time))
  );
  if (alreadyPresent) {
    showFeedback('scan-feedback', 'info', `${person.name} is already marked Present today.`);
    return;
  }

  // Absent -> Present Transition: Remove today's Absent record if it exists
  attendanceLog = attendanceLog.filter(
    a => !(a.name === person.name && a.status === 'Absent' && isSameDay(new Date(a.time)))
  );

  const record = {
    id: person.id || '',
    name: person.name,
    role: person.role || '',
    dept: person.dept || '',
    status: 'Present',
    time: new Date().toISOString(),
    confidence
  };
  attendanceLog.unshift(record);
  saveLog();
  renderLog();
  renderDashboard();
  updateScanSummary();

  const recentEl = document.getElementById('scan-recent');
  const div = document.createElement('div');
  div.className = 'recent-item';
  div.innerHTML = `
    <div class="recent-avatar">${avatarHTML(person)}</div>
    <div>
      <div class="recent-name">${person.name}</div>
      <div class="recent-meta">${person.role} · ${confidence}% match</div>
    </div>
    <span class="recent-time">${formatTime(new Date())}</span>`;
  if (recentEl.querySelector('.empty')) recentEl.innerHTML = '';
  recentEl.prepend(div);

  showFeedback('scan-feedback', 'success', `✓ ${person.name} marked Present (${confidence}% match)`);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderDashboard() {
  const total = registered.length;
  const todayRecords = attendanceLog.filter(a => isSameDay(new Date(a.time)));
  const presentNames = [...new Set(todayRecords.filter(a => a.status === 'Present').map(a => a.name))];
  const present = presentNames.length;
  const absent = Math.max(0, total - present);
  const rate = total ? Math.round(present / total * 100) : 0;

  document.getElementById('dash-total').textContent = total;
  document.getElementById('dash-present').textContent = present;
  document.getElementById('dash-absent').textContent = absent;
  document.getElementById('dash-rate').textContent = rate + '%';

  const actEl = document.getElementById('recent-activity');
  const recent = attendanceLog.filter(a => isSameDay(new Date(a.time))).slice(0, 8);
  if (!recent.length) {
    actEl.innerHTML = '<p class="empty">No activity today yet.</p>';
  } else {
    actEl.innerHTML = recent.map(a => {
      const person = getPersonByName(a.name);
      return `
    <div class="recent-item">
      <div class="recent-avatar">${avatarHTML(person || a.name)}</div>
      <div>
        <div class="recent-name">${escapeHtml(a.name)}</div>
        <div class="recent-meta">${escapeHtml(a.role)} · ${a.confidence}% match</div>
      </div>
      <span class="recent-time">${formatTime(new Date(a.time))}</span>
    </div>`;
    }).join('');
  }

  renderCharts(total, present, absent, rate);
}

function getWeeklyData() {
  const labels = [];
  const counts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }));
    const dayCount = new Set(
      attendanceLog
        .filter(a => {
          const t = new Date(a.time);
          return a.status === 'Present' && t.getDate() === d.getDate() && t.getMonth() === d.getMonth() && t.getFullYear() === d.getFullYear();
        })
        .map(a => a.name)
    ).size;
    counts.push(dayCount);
  }
  return { labels, counts };
}

function getMonthlyData() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const labels = [];
  const counts = [];
  for (let day = 1; day <= today; day++) {
    labels.push(String(day));
    const dayCount = new Set(
      attendanceLog
        .filter(a => {
          const t = new Date(a.time);
          return a.status === 'Present' && t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
        })
        .map(a => a.name)
    ).size;
    counts.push(dayCount);
  }
  return { labels, counts };
}

function getStudentAttendanceRates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysElapsed = now.getDate();
  if (!registered.length || daysElapsed === 0) return { labels: [], rates: [] };

  const data = registered.map(p => {
    const presentDays = new Set(
      attendanceLog
        .filter(a => {
          if (a.name !== p.name || a.status !== 'Present') return false;
          const t = new Date(a.time);
          return t.getFullYear() === year && t.getMonth() === month;
        })
        .map(a => new Date(a.time).getDate())
    ).size;
    return {
      name: p.name,
      rate: Math.round((presentDays / daysElapsed) * 100)
    };
  });
  data.sort((a, b) => b.rate - a.rate);
  return {
    labels: data.map(d => d.name.length > 20 ? d.name.slice(0, 18) + '…' : d.name),
    rates: data.map(d => d.rate)
  };
}

function renderCharts(total, present, absent) {
  if (typeof Chart === 'undefined') return;

  const weeklyCanvas = document.getElementById('chart-weekly');
  const monthlyCanvas = document.getElementById('chart-monthly');
  const donutCanvas = document.getElementById('chart-donut');
  const studentCanvas = document.getElementById('chart-student-pct');
  const studentEmpty = document.getElementById('student-analytics-empty');
  if (!weeklyCanvas || !donutCanvas) return;

  const { labels, counts } = getWeeklyData();
  const monthly = getMonthlyData();
  const studentRates = getStudentAttendanceRates();
  const chartFont = { family: "'Inter', sans-serif", size: 11 };
  const gridColor = 'rgba(255, 255, 255, 0.06)';
  const tickColor = '#8892a8';
  const tooltipOpts = {
    backgroundColor: 'rgba(12, 18, 32, 0.95)',
    borderColor: 'rgba(0, 245, 212, 0.2)',
    borderWidth: 1,
    titleFont: chartFont,
    bodyFont: chartFont,
    padding: 10
  };

  if (weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(weeklyCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Check-ins',
        data: counts,
        backgroundColor: 'rgba(0, 245, 212, 0.25)',
        borderColor: '#00f5d4',
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: tooltipOpts
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: tickColor, font: chartFont }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: tickColor, font: chartFont, stepSize: 1 }
        }
      }
    }
  });

  if (monthlyCanvas) {
    if (monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart(monthlyCanvas, {
      type: 'line',
      data: {
        labels: monthly.labels,
        datasets: [{
          label: 'Daily check-ins',
          data: monthly.counts,
          borderColor: '#a78bfa',
          backgroundColor: 'rgba(167, 139, 250, 0.15)',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#a78bfa',
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: tooltipOpts },
        scales: {
          x: { grid: { display: false }, ticks: { color: tickColor, font: chartFont, maxTicksLimit: 15 } },
          y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor, font: chartFont, stepSize: 1 } }
        }
      }
    });
  }

  if (donutChart) donutChart.destroy();
  const donutData = total > 0 ? [present, absent] : [0, 1];
  donutChart = new Chart(donutCanvas, {
    type: 'doughnut',
    data: {
      labels: ['Present', 'Absent'],
      datasets: [{
        data: donutData,
        backgroundColor: ['rgba(0, 230, 118, 0.7)', 'rgba(255, 71, 87, 0.5)'],
        borderColor: ['#00e676', '#ff4757'],
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: tickColor, font: chartFont, padding: 16, usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: tooltipOpts
      }
    }
  });

  if (studentCanvas) {
    const hasStudents = studentRates.labels.length > 0;
    if (studentEmpty) studentEmpty.classList.toggle('hidden', hasStudents);
    studentCanvas.style.display = hasStudents ? 'block' : 'none';
    if (studentPctChart) studentPctChart.destroy();
    if (hasStudents) {
      const barHeight = Math.max(200, studentRates.labels.length * 28);
      studentCanvas.parentElement.style.height = barHeight + 'px';
      studentPctChart = new Chart(studentCanvas, {
        type: 'bar',
        data: {
          labels: studentRates.labels,
          datasets: [{
            label: 'Attendance %',
            data: studentRates.rates,
            backgroundColor: studentRates.rates.map(r =>
              r >= 75 ? 'rgba(0, 230, 118, 0.5)' : r >= 50 ? 'rgba(255, 176, 32, 0.5)' : 'rgba(255, 71, 87, 0.5)'
            ),
            borderColor: studentRates.rates.map(r =>
              r >= 75 ? '#00e676' : r >= 50 ? '#ffb020' : '#ff4757'
            ),
            borderWidth: 1.5,
            borderRadius: 4
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltipOpts,
              callbacks: { label: ctx => ctx.raw + '% attendance this month' }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              max: 100,
              grid: { color: gridColor },
              ticks: { color: tickColor, font: chartFont, callback: v => v + '%' }
            },
            y: { grid: { display: false }, ticks: { color: tickColor, font: chartFont } }
          }
        }
      });
    }
  }
}

function renderLog() {
  const filter = document.getElementById('log-filter-date')?.value || 'today';
  const filtered = filter === 'today'
    ? attendanceLog.filter(a => isSameDay(new Date(a.time)))
    : attendanceLog;
  const tbody = document.getElementById('log-tbody');
  const empty = document.getElementById('log-empty');

  if (!filtered.length) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = filtered.map((a, i) => {
    const person = getPersonByName(a.name);
    return `
    <tr>
      <td>${i + 1}</td>
      <td><div class="table-photo">${avatarHTML(person || a.name)}</div></td>
      <td><strong>${escapeHtml(a.name)}</strong></td>
      <td>${escapeHtml(a.id || '—')}</td>
      <td>${escapeHtml(a.role || '—')}</td>
      <td>${escapeHtml(a.dept || '—')}</td>
      <td><span class="badge badge-${a.status === 'Present' ? 'present' : 'absent'}">${a.status}</span></td>
      <td>${new Date(a.time).toLocaleString('en-IN')}</td>
      <td>${a.confidence}%</td>
    </tr>`;
  }).join('');
}

function renderStudents() {
  const query = document.getElementById('student-search')?.value?.toLowerCase() || '';
  const grid = document.getElementById('student-grid');
  const filtered = registered.filter(p =>
    p.name.toLowerCase().includes(query) || (p.id || '').toLowerCase().includes(query)
  );
  if (!filtered.length) {
    grid.innerHTML = `<div class="empty grid-empty">${query ? 'No students match your search.' : 'No students registered yet.'}</div>`;
    return;
  }
  grid.innerHTML = filtered.map(p => `
    <div class="student-card">
      <button class="student-card-del" onclick="removeStudent(${registered.indexOf(p)})" title="Remove">×</button>
      <div class="student-card-avatar">${avatarHTML(p)}</div>
      <div class="student-card-name">${escapeHtml(p.name)}</div>
      <div class="student-card-id">${p.id || 'No ID'}</div>
      <div class="student-card-role">${p.role}</div>
      <div class="student-card-meta">${p.dept || ''}</div>
      <div class="student-card-samples">${(p.descriptors||[]).length} face samples</div>
    </div>`).join('');
}

function updateScanSummary() {
  const today = attendanceLog.filter(a => isSameDay(new Date(a.time)));
  const present = new Set(today.filter(a => a.status === 'Present').map(a => a.name)).size;
  document.getElementById('scan-present').textContent = present;
  document.getElementById('scan-total').textContent = registered.length;
  document.getElementById('scan-pct').textContent = registered.length
    ? Math.round(present / registered.length * 100) + '%' : '0%';
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportCSV() {
  if (!attendanceLog.length) { showToast('error', 'Export failed', 'No attendance data to export.'); return; }
  const headers = ['Name', 'Roll No', 'Role', 'Department', 'Status', 'Date', 'Time', 'Confidence'];
  const rows = attendanceLog.map(a => {
    const d = new Date(a.time);
    return [a.name, a.id || '', a.role || '', a.dept || '', a.status,
      d.toLocaleDateString('en-IN'), d.toLocaleTimeString('en-IN'), a.confidence + '%'];
  });
  const csv = [headers, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'attendance_' + toDateStr(new Date()) + '.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('success', 'Export complete', 'Attendance CSV downloaded successfully.');
}

function exportPDF() {
  if (!attendanceLog.length) {
    showToast('error', 'Export failed', 'No attendance data to export.');
    return;
  }
  if (typeof window.jspdf === 'undefined') {
    showToast('error', 'Export failed', 'PDF library not loaded. Please refresh the page.');
    return;
  }

  const filter = document.getElementById('log-filter-date')?.value || 'today';
  const records = filter === 'today'
    ? attendanceLog.filter(a => isSameDay(new Date(a.time)))
    : [...attendanceLog];

  if (!records.length) {
    showToast('error', 'Export failed', 'No records match the current filter.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const generated = new Date().toLocaleString('en-IN');
  const filterLabel = filter === 'today' ? 'Today' : 'All Time';
  const uniquePresent = new Set(records.filter(r => r.status === 'Present').map(r => r.name)).size;
  const totalRegistered = registered.length;
  const rate = totalRegistered ? Math.round(uniquePresent / totalRegistered * 100) : 0;

  doc.setFillColor(10, 15, 26);
  doc.rect(0, 0, pageW, 32, 'F');
  doc.setTextColor(0, 245, 212);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Face Attendance Report', 14, 14);
  doc.setTextColor(136, 146, 168);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${generated}  |  Filter: ${filterLabel}  |  Records: ${records.length}`, 14, 22);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.text(`Summary — Present: ${uniquePresent}  |  Registered: ${totalRegistered}  |  Rate: ${rate}%`, 14, 40);

  const tableBody = records.map((a, i) => {
    const d = new Date(a.time);
    return [
      i + 1,
      a.name,
      a.id || '—',
      a.role || '—',
      a.dept || '—',
      a.status,
      d.toLocaleDateString('en-IN'),
      d.toLocaleTimeString('en-IN'),
      a.confidence + '%'
    ];
  });

  doc.autoTable({
    startY: 46,
    head: [['#', 'Name', 'Roll No', 'Role', 'Department', 'Status', 'Date', 'Time', 'Confidence']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [0, 180, 160], textColor: [6, 10, 18], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 10 },
      5: { cellWidth: 18 },
      8: { cellWidth: 18 }
    },
    margin: { left: 14, right: 14 },
    didDrawPage(data) {
      doc.setFontSize(8);
      doc.setTextColor(136, 146, 168);
      doc.text(
        `Page ${doc.internal.getNumberOfPages()}`,
        pageW - 14,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'right' }
      );
    }
  });

  doc.save('attendance_report_' + toDateStr(new Date()) + '.pdf');
  showToast('success', 'PDF exported', `Report with ${records.length} records downloaded.`);
}

// ─── Google Sheets Sync ───────────────────────────────────────────────────────
async function syncToSheets() {
  const url = settings.scriptUrl;
  if (!url) {
    showFeedback('sync-feedback', 'error', 'No Apps Script URL configured. Go to Settings and add it.');
    return;
  }
  showFeedback('sync-feedback', 'info', 'Syncing to Google Sheets…');
  try {
    const rows = attendanceLog.map(a => {
      const d = new Date(a.time);
      return [a.name, a.id || '', a.role || '', a.dept || '', a.status,
        d.toLocaleDateString('en-IN'), d.toLocaleTimeString('en-IN'), a.confidence + '%', toDateStr(d)];
    });
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'appendRows', rows, sheetName: settings.sheetTab || 'Attendance' })
    });
    const result = await resp.json();
    if (result.status === 'ok') {
      showFeedback('sync-feedback', 'success', 'Synced ' + rows.length + ' records to Google Sheets!');
    } else {
      showFeedback('sync-feedback', 'error', 'Sync failed: ' + (result.message || 'Unknown error'));
    }
  } catch (e) {
    showFeedback('sync-feedback', 'error', 'Network error. Check your Apps Script URL and try again.');
  }
}

async function testSheetConnection() {
  const url = document.getElementById('cfg-script-url').value.trim();
  if (!url) { showFeedback('settings-feedback', 'error', 'Enter a Web App URL first.'); return; }
  showFeedback('settings-feedback', 'info', 'Testing connection…');
  try {
    const resp = await fetch(url + '?action=ping');
    const result = await resp.json();
    if (result.status === 'ok') {
      showFeedback('settings-feedback', 'success', 'Connection successful! Google Sheets is ready.');
    } else {
      showFeedback('settings-feedback', 'error', 'Connected but received unexpected response.');
    }
  } catch (e) {
    showFeedback('settings-feedback', 'error', 'Could not connect. Check the URL and re-deploy the Apps Script.');
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function saveSettings() {
  settings = {
    sheetId: document.getElementById('cfg-sheet-id').value.trim(),
    sheetTab: document.getElementById('cfg-sheet-tab').value.trim() || 'Attendance',
    scriptUrl: document.getElementById('cfg-script-url').value.trim(),
    confThreshold: document.getElementById('cfg-conf').value,
    autoConfirm: document.getElementById('cfg-auto-confirm').checked,
    allowDupes: document.getElementById('cfg-allow-dupes').checked
  };
  localStorage.setItem('fas_settings', JSON.stringify(settings));
  showFeedback('settings-feedback', 'success', 'Settings saved!');
}

function applySettings() {
  if (settings.sheetId) document.getElementById('cfg-sheet-id').value = settings.sheetId;
  if (settings.sheetTab) document.getElementById('cfg-sheet-tab').value = settings.sheetTab;
  if (settings.scriptUrl) document.getElementById('cfg-script-url').value = settings.scriptUrl;
  const conf = settings.confThreshold || '60';
  document.getElementById('cfg-conf').value = conf;
  document.getElementById('conf-val').textContent = conf + '%';
  if (settings.autoConfirm !== false) document.getElementById('cfg-auto-confirm').checked = true;
  if (settings.allowDupes) document.getElementById('cfg-allow-dupes').checked = true;
}

// ─── Data Management ──────────────────────────────────────────────────────────
function removeStudent(idx) {
  if (!confirm('Remove ' + registered[idx].name + '?')) return;
  const name = registered[idx].name;
  registered.splice(idx, 1);
  saveRegistered();
  renderStudents();
  renderDashboard();
  showToast('success', 'Student removed', name + ' has been removed from the registry.');
}

function clearAllStudents() {
  if (!confirm('Remove ALL registered students? This cannot be undone.')) return;
  registered = [];
  saveRegistered();
  renderStudents();
  renderDashboard();
  showToast('info', 'Registry cleared', 'All registered students have been removed.');
}

function clearAllData() {
  if (!confirm('Delete ALL attendance records? This cannot be undone.')) return;
  attendanceLog = [];
  saveLog();
  renderLog();
  renderDashboard();
  showToast('info', 'Data cleared', 'All attendance records have been deleted.');
}

function saveRegistered() {
  const serializable = registered.map(p => ({
    ...p,
    descriptors: (p.descriptors || []).map(d => Array.from(d)),
    descriptor: undefined
  }));
  localStorage.setItem('fas_registered', JSON.stringify(serializable));
}

function saveLog() {
  localStorage.setItem('fas_log', JSON.stringify(attendanceLog));
}

// ─── Utilities ────────────────────────────────────────────────────────────────
const TOAST_TITLES = { success: 'Success', error: 'Error', info: 'Notice' };
const TOAST_ICONS = {
  success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
  error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
};

function showToast(type, title, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
    <div class="toast-body">
      <div class="toast-title">${title || TOAST_TITLES[type]}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-close" aria-label="Dismiss">&times;</button>`;
  toast.querySelector('.toast-close').onclick = () => dismissToast(toast);
  container.appendChild(toast);
  const timer = setTimeout(() => dismissToast(toast), 5000);
  toast._timer = timer;
}

function dismissToast(toast) {
  if (!toast || toast.classList.contains('removing')) return;
  clearTimeout(toast._timer);
  toast.classList.add('removing');
  toast.addEventListener('animationend', () => toast.remove());
}

function showFeedback(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'feedback ' + type;
  el.textContent = msg;
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { el.className = 'feedback hidden'; }, 6000);
  if (type !== 'info' || !msg.includes('…')) {
    showToast(type, TOAST_TITLES[type], msg.replace(/^✓\s*/, ''));
  }
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getPersonByName(name) {
  return registered.find(p => p.name === name);
}

function captureProfilePhoto(video) {
  try {
    const canvas = document.createElement('canvas');
    const size = 200;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.75);
  } catch (e) {
    return null;
  }
}

function avatarHTML(personOrName) {
  const person = typeof personOrName === 'string' ? getPersonByName(personOrName) : personOrName;
  const name = person?.name || (typeof personOrName === 'string' ? personOrName : '');
  if (person?.photo) {
    return `<img class="profile-photo" src="${person.photo}" alt="${escapeHtml(name)}">`;
  }
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return `<span class="avatar-fallback">${initials}</span>`;
}

function isSameDay(d) {
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}
function formatTime(d) { return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
function toDateStr(d) { return d.toISOString().split('T')[0]; }

async function finalizeAttendance() {
  if (!registered.length) {
    showToast('error', 'Finalize failed', 'No students registered.');
    return;
  }
  
  const todayRecords = attendanceLog.filter(a => isSameDay(new Date(a.time)));
  const alreadyMarkedNames = new Set(todayRecords.map(a => a.name));
  
  let added = 0;
  registered.forEach(p => {
    if (!alreadyMarkedNames.has(p.name)) {
      attendanceLog.unshift({
        id: p.id || '',
        name: p.name,
        role: p.role || '',
        dept: p.dept || '',
        status: 'Absent',
        time: new Date().toISOString(),
        confidence: 0
      });
      added++;
    }
  });
  
  if (added > 0) {
    saveLog();
    renderLog();
    renderDashboard();
    updateScanSummary();
    showToast('success', 'Finalized', `${added} students marked Absent.`);
  } else {
    showToast('info', 'No changes', 'All registered students already have an attendance record for today.');
  }
}
