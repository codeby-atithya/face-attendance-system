// ============================================================
// Face Attendance System — Google Apps Script
// Paste this entire file into your Google Apps Script editor.
// Then deploy as a Web App (see SETUP.md for steps).
// ============================================================

const SHEET_NAME = 'Attendance'; // Change if your tab name differs

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'ping') {
    return jsonResponse({ status: 'ok', message: 'Connected to Google Sheets' });
  }
  if (action === 'getAll') {
    return getAllRecords();
  }
  return jsonResponse({ status: 'error', message: 'Unknown action' });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (action === 'appendRows') {
      return appendRows(payload.rows, payload.sheetName || SHEET_NAME);
    }
    if (action === 'clearSheet') {
      return clearSheet(payload.sheetName || SHEET_NAME);
    }
    return jsonResponse({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

function appendRows(rows, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  // Create sheet with headers if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['Name', 'Roll No', 'Role', 'Department', 'Status', 'Date', 'Time', 'Confidence', 'Synced On']);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#1D9E75').setFontColor('white');
    sheet.setFrozenRows(1);
  }

  // Check for duplicates (same Name + Date) to avoid re-syncing
  const existingData = sheet.getDataRange().getValues();
  const existingKeys = new Set(existingData.slice(1).map(r => r[0] + '|' + r[5])); // Name|Date

  let added = 0;
  for (const row of rows) {
    const key = row[0] + '|' + row[5]; // Name|Date
    if (!existingKeys.has(key)) {
      sheet.appendRow([...row, new Date().toLocaleString()]);
      existingKeys.add(key);
      added++;
    }
  }

  // Auto-resize columns
  sheet.autoResizeColumns(1, 9);

  return jsonResponse({ status: 'ok', message: 'Added ' + added + ' new records', added });
}

function getAllRecords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return jsonResponse({ status: 'ok', records: [] });
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const records = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  return jsonResponse({ status: 'ok', records });
}

function clearSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return jsonResponse({ status: 'error', message: 'Sheet not found' });
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
  return jsonResponse({ status: 'ok', message: 'Sheet cleared' });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
