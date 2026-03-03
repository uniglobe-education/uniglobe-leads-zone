/***********************
 * COUNSELLOR FILES
 ***********************/
const COUNSELLORS = {
  rinque: { fileId: "1tsvdE6Rwrrg4VgboSf3kDfaxRHEcJcAk82HcnyUmXSQ" },
  masum: { fileId: "1RPLMwJSQbH-Be051iaeJyl9QuTL_sBF08hSiASThURQ" },
  prosanjit: { fileId: "1OvDUkCNXhfKmUa42kOEpOUfek3zRuHZuHGgqEO6CsaY" },
  branchincharge: { fileId: "1Qd4mLiiRUzUV6OG1CjhsMA0Q14jzMCmLgbV0SU7mg_s" }, // Branch In-Charge
};

/***********************
 * WEBSITE WEBHOOK CONFIG
 * Fill in SITE_URL after deployment.
 * WEBHOOK_SECRET must match the value in your .env file.
 ***********************/
const SITE_URL = "https://apply.uniglobeeducation.co.uk"; // Production site
const WEBHOOK_SECRET = "uniglobe_wh_s3cr3t_2026_xK9mPqR7"; // Must match .env WEBHOOK_SECRET

function norm_(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\n/g, " ")
    .replace(/[_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headerIndexMap_(headers) {
  const map = {};
  headers.forEach((h, i) => (map[norm_(h)] = i));
  return map;
}


function getCounsellorTabNamesSorted_(counsellorKey, fileId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `tabs_v2:${counsellorKey}:${fileId}`;
  const cached = cache.get(cacheKey);
  let tabs = cached ? JSON.parse(cached) : null;

  if (!tabs) {
    const ss = SpreadsheetApp.openById(fileId);
    tabs = ss.getSheets()
      .filter(s => !s.isSheetHidden())
      .map(s => s.getName());
    // Reduced cache time for more reactivity
    cache.put(cacheKey, JSON.stringify(tabs), 900); 
  }

  const props = PropertiesService.getScriptProperties();
  const usageRaw = props.getProperty(`tabUsage:${counsellorKey}`) || "[]";
  const usage = JSON.parse(usageRaw);

  const usageRank = new Map();
  usage.forEach((name, idx) => usageRank.set(name, idx));

  tabs.sort((a, b) => {
    const ra = usageRank.has(a) ? usageRank.get(a) : 999999;
    const rb = usageRank.has(b) ? usageRank.get(b) : 999999;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });

  return tabs;
}

function markTabUsed_(counsellorKey, tabName) {
  const props = PropertiesService.getScriptProperties();
  const key = `tabUsage:${counsellorKey}`;

  const usageRaw = props.getProperty(key) || "[]";
  let usage = JSON.parse(usageRaw);

  usage = usage.filter(x => x !== tabName);
  usage.unshift(tabName);
  usage = usage.slice(0, 50);

  props.setProperty(key, JSON.stringify(usage));
}




/***********************
 * REQUIRED MAIN HEADERS
 ***********************/
const H_ID = "id";
const H_CAMPAIGN = "campaign_name";
const H_ASSIGNED = "assigned_to";
const H_FORM = "assign_form";
const H_PUSHED = "pushed";
const H_LEAD_STATUS = "lead_status";

const LEAD_STATUS_LIST = [
  "CREATED",
  "CONTACTED",
  "NO_RESPONSE",
  "UNQUALIFIED",
  "INTERESTED",
  "QUALIFIED ⭐",
  "APPLICATION_STARTED",
  "OFFER_ISSUED",
  "CAS_ISSUED",
];

/***********************
 * ON OPEN TRIGGER
 ***********************/
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  // Add a custom menu to manually fix layout if needed
  ui.createMenu('CRM 🚀')
    .addItem('Fix Layout \u0026 Check Duplicates ⬇️', 'fixLayoutAndScroll')
    .addSeparator()
    .addItem('\u2699\ufe0f Re-install Triggers (Run Once)', 'setupMainTriggers')
    .addItem('\ud83d\udd04 Clear Cache \u0026 Refresh Tabs', 'clearCRMTabCache')
    .addToUi();

  // Try auto-scrolling immediately
  try {
    fixLayoutAndScroll();
  } catch(e) {
    console.error("onOpen failed: " + e.message);
  }
}

function fixLayoutAndScroll() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getActiveSheet();
  
  // 1. Format
  try { formatSingleSheet_(sheet); } catch(e) {}

  // 2. Check Duplicates (Runs on open/manual trigger)
  try { updateDuplicationStatus_(); } catch(e) {}

  // 3. Scroll to target (Last Row + First Name Col)
  try {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    if (lastRow > 0 && lastCol > 0) {
      let targetCol = 20; // Default to Column T per user request (assigned_to)
      
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      for (let i = 0; i < headers.length; i++) {
        // Explicitly check for "assigned_to" first
        const rawH = String(headers[i]).toLowerCase().trim();
        const normH = rawH.replace(/_/g, " ");
        
        if (rawH === "assigned_to" || normH === "assigned to" || normH === "counselor" || normH === "assignee") {
          targetCol = i + 1;
          break;
        }
      }

      // Target the first EMPTY row (lastRow + 1)
      const maxRows = sheet.getMaxRows();
      const targetRow = lastRow + 1;
      
      // If we are at the very bottom, just stay at lastRow (or add row if needed, but staying is safer for view)
      const finalRow = (targetRow <= maxRows) ? targetRow : lastRow;

      const range = sheet.getRange(finalRow, targetCol);
      range.activate();
      sheet.setActiveRange(range);
    }
  } catch(e) {
    console.error("Scroll error: " + e.message);
  }
}

/***********************
 * SETUP (RUN ONCE)
 * Creates installable trigger for main sheet edits
 ***********************/
function setupMainTriggers() {
  const ss = SpreadsheetApp.getActive();
  
  try {
    // delete old triggers for this project (optional but recommended)
    ScriptApp.getProjectTriggers()
      .filter(t => ["mainOnEdit", "mainOnChange", "checkForNewLeads_", "checkAndInsertMainDateSeparator_", "syncFromCounsellorSheets_", "updateDuplicationStatus_"].includes(t.getHandlerFunction()))
      .forEach(t => ScriptApp.deleteTrigger(t));

    ScriptApp.newTrigger("mainOnEdit")
      .forSpreadsheet(ss)
      .onEdit()
      .create();

    ScriptApp.newTrigger("mainOnChange")
      .forSpreadsheet(ss)
      .onChange()
      .create();

    // Time-driven trigger: check for new leads every 5 minutes
    ScriptApp.newTrigger("checkForNewLeads_")
      .timeBased()
      .everyMinutes(5)
      .create();

    // Daily trigger at midnight to insert date separators
    ScriptApp.newTrigger("checkAndInsertMainDateSeparator_")
      .timeBased()
      .atHour(0) // Midnight
      .everyDays(1)
      .create();

    // Reverse sync: Counselor sheets -> Main leads (every 10 minutes)
    ScriptApp.newTrigger("syncFromCounsellorSheets_")
      .timeBased()
      .everyMinutes(10)
      .create();

    // Duplication Check (Every 30 min)
    ScriptApp.newTrigger("updateDuplicationStatus_")
      .timeBased()
      .everyMinutes(30)
      .create();

    // NOTE: Duplication check now runs only when new leads are detected (in checkForNewLeads_)
    // Removed scheduled trigger to optimize performance
    
    // SUCCESS FEEDBACK
    SpreadsheetApp.getActive().toast("✅ All triggers installed! Push, Sync, and Auto-fill are now active.", "Setup Complete", 5);
  } catch(e) {
    SpreadsheetApp.getUi().alert("❌ Trigger setup failed: " + e.message);
    throw e;
  }
}

/***********************
 * TIME-BASED NEW LEAD DETECTION
 ***********************/
function checkForNewLeads_() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  const sheets = ss.getSheets();
  const COUNSELORS_LIST = ["prosanjit", "masum", "rinque", "branchincharge", "ananna", "new"];
  
  let hasNewRows = false;

  sheets.forEach(sheet => {
    const sheetId = sheet.getSheetId();
    const lastRowKey = `lastRow_${sheetId}`;
    const previousRowCount = parseInt(props.getProperty(lastRowKey) || "0");
    const currentRowCount = sheet.getLastRow();

    // Check if rows have been added
    if (currentRowCount > previousRowCount && currentRowCount >= 2) {
      hasNewRows = true;
      
      // Find assigned_to column
      const lastCol = sheet.getLastColumn();
      if (lastCol >= 1) {
        const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        const headersNorm = headers.map(norm_);
        const assignedIdx = headersNorm.findIndex(h => h === "assigned to" || h === "assigned_to");
        const formIdx = headersNorm.findIndex(h => h === "assign form" || h === "assign_form");
        const pushedIdx = headersNorm.findIndex(h => h === "pushed");
        
        if (assignedIdx !== -1) {
          const col = assignedIdx + 1;
          const startRow = Math.max(previousRowCount + 1, 2);
          const numNewRows = currentRowCount - previousRowCount;
          
          // Set "assigned_to" to "new" only if blank
          const range = sheet.getRange(startRow, col, numNewRows, 1);
          const currentValues = range.getValues();
          const newValues = currentValues.map(row => {
             const val = String(row[0]).trim();
             return (val === "" || val === "new") ? ["new"] : [row[0]];
          });
          range.setValues(newValues);
          
          // Apply counselor dropdown
          const rule = SpreadsheetApp.newDataValidation()
            .requireValueInList(COUNSELORS_LIST, true)
            .setAllowInvalid(false)
            .build();
          sheet.getRange(startRow, col, numNewRows, 1).setDataValidation(rule);

          // Force Clear "Assign Form" & "Pushed" to remove garbage or inherited validations
          if (formIdx !== -1) {
            sheet.getRange(startRow, formIdx + 1, numNewRows, 1).clearContent().clearDataValidations();
          }
          if (pushedIdx !== -1) {
             sheet.getRange(startRow, pushedIdx + 1, numNewRows, 1).clearContent().setNote("");
          }
        }
      }
      
      props.setProperty(lastRowKey, currentRowCount.toString());
    }
  });

  // If new rows detected, run duplication check
  if (hasNewRows) {
    updateDuplicationStatus_();
  }
}

/***********************
 * DAILY DATE SEPARATOR FOR MAIN SHEETS
 ***********************/
function checkAndInsertMainDateSeparator_() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  const today = new Date();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  const lastDateStr = props.getProperty("lastMainSeparatorDate");
  
  // Only insert if date has changed
  if (lastDateStr === todayStr) return;
  
  const dateLabel = Utilities.formatDate(today, Session.getScriptTimeZone(), "d MMMM yyyy");
  const separator = `------------------ ${dateLabel} ------------------`;
  
  const sheets = ss.getSheets();
  
  sheets.forEach(sheet => {
    // Skip hidden sheets
    if (sheet.isSheetHidden()) return;
    
    // Check if sheet has data (at least header row)
    if (sheet.getLastRow() < 1) return;
    
    // Insert separator row at the end
    sheet.appendRow([separator]);
    
    // Make it bold and centered with background color
    const lastRow = sheet.getLastRow();
    const separatorCell = sheet.getRange(lastRow, 1);
    separatorCell.setFontWeight("bold");
    separatorCell.setHorizontalAlignment("center");
    separatorCell.setBackground("#E8F0FE"); // Light blue background
  });
  
  // Update last separator date
  props.setProperty("lastMainSeparatorDate", todayStr);
}

/***********************
 * REVERSE SYNC: Counselor Sheets -> Main Leads
 ***********************/
function syncFromCounsellorSheets_() {
  try {
    const mainSS = SpreadsheetApp.getActive();
    const leadMap = {}; // leadId -> [{ counsellor, sheet, rowData }, ...]
    
    // Step 1: Scan all counselor sheets
    for (const counsellorKey in COUNSELLORS) {
      const fileId = COUNSELLORS[counsellorKey].fileId;
      try {
        const ss = SpreadsheetApp.openById(fileId);
        const sheets = ss.getSheets();
        
        for (const sheet of sheets) {
          if (sheet.isSheetHidden()) continue;
          
          const headerInfo = detectHeaderRow_(sheet);
          if (!headerInfo) continue;
          
          const { headerRow, headersRaw } = headerInfo;
          const headers = headersRaw.map(normalizeHeader);
          
          // Find required columns
          const leadIdIdx = headers.indexOf("lead id");
          const phoneIdx = headers.indexOf("phone");
          const statusIdx = headers.indexOf("status"); // General status column
          const leadStatusIdx = headers.findIndex(h => h === "lead_status" || h === "lead status"); // Lead-specific status
          const noteIdx = headers.indexOf("note");
          const followUpIdx = headers.indexOf("follow up");
          const nextFollowUpIdx = headers.indexOf("next follow up");
          
          if (leadIdIdx === -1) continue; // Must have lead_id
          
          const lastRow = sheet.getLastRow();
          if (lastRow <= headerRow) continue;
          
          // Read all data
          const dataRange = sheet.getRange(headerRow + 1, 1, lastRow - headerRow, headersRaw.length);
          const data = dataRange.getValues();
          
          for (const row of data) {
            const leadId = String(row[leadIdIdx] || "").trim();
            if (!leadId) continue; // Skip rows without lead_id
            
            const rowData = {
              counsellor: counsellorKey,
              sheetName: sheet.getName(),
              phone: phoneIdx !== -1 ? String(row[phoneIdx] || "").trim() : "",
              status: statusIdx !== -1 ? String(row[statusIdx] || "").trim() : "",
              lead_status: leadStatusIdx !== -1 ? String(row[leadStatusIdx] || "").trim() : "",
              note: noteIdx !== -1 ? String(row[noteIdx] || "").trim() : "",
              follow_up: followUpIdx !== -1 ? String(row[followUpIdx] || "").trim() : "",
              next_follow_up: nextFollowUpIdx !== -1 ? String(row[nextFollowUpIdx] || "").trim() : ""
            };
            
            if (!leadMap[leadId]) {
              leadMap[leadId] = [];
            }
            leadMap[leadId].push(rowData);
          }
        }
      } catch(e) {
        console.error(`Error scanning ${counsellorKey} sheets: ${e.message}`);
      }
    }
    
    // Step 2: Sync to main leads
    for (const leadId in leadMap) {
      const locations = leadMap[leadId];
      syncLeadToMain_(mainSS, leadId, locations);
    }
    
  } catch(e) {
    console.error(`Reverse sync error: ${e.message}`);
  }
}

function syncLeadToMain_(mainSS, leadId, locations) {
  // Find lead in main sheet by ID
  for (const ms of mainSS.getSheets()) {
    const lastRow = ms.getLastRow();
    const lastCol = ms.getLastColumn();
    if (lastRow < 2) continue;
    
    const headers = ms.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizeHeader);
    const idIdx = headers.indexOf("id");
    const assignedToIdx = headers.indexOf("assigned to");
    const assignFormIdx = headers.indexOf("assign form");
    const pushedIdx = headers.indexOf("pushed");
    const statusIdx = headers.indexOf("status"); // General status
    const leadStatusIdx = headers.findIndex(h => h === "lead_status" || h === "lead status"); // Lead-specific status
    const noteIdx = headers.indexOf("note");
    const followUpIdx = headers.indexOf("follow up");
    const nextFollowUpIdx = headers.indexOf("next follow up");
    
    if (idIdx === -1) continue;
    
    // Find row with this lead_id
    const ids = ms.getRange(2, idIdx + 1, lastRow - 1, 1).getValues().flat();
    const rowIndex = ids.findIndex(id => String(id).trim() === String(leadId).trim());
    
    if (rowIndex === -1) continue; // Lead not found in this sheet
    
    const actualRow = rowIndex + 2;
    
    // Determine sync values
    const isDuplicate = locations.length > 1;
    let assigned_to, assign_form, pushed;
    
    if (isDuplicate) {
      // Multiple counselors have this lead - CONFLICT
      const names = locations.map(l => capitalize_(l.counsellor)).join("! ");
      assigned_to = names + "! assigned";
      assign_form = "Multiple";
      pushed = "CONFLICT: Multiple counselors";
    } else {
      // Single counselor
      assigned_to = capitalize_(locations[0].counsellor);
      assign_form = locations[0].sheetName;
      pushed = "Auto-synced";
    }
    
    // Use first location's data for actual content
    const data = locations[0];
    
    // Sync assigned_to (only if blank or matches)
    if (assignedToIdx !== -1) {
      const current = String(ms.getRange(actualRow, assignedToIdx + 1).getValue() || "").trim().toLowerCase();
      if (!current || current === "new" || current === data.counsellor) {
        ms.getRange(actualRow, assignedToIdx + 1).setValue(assigned_to);
      }
    }
    
    // Sync assign_form
    if (assignFormIdx !== -1) {
      ms.getRange(actualRow, assignFormIdx + 1).setValue(assign_form);
    }
    
    // Sync pushed
    if (pushedIdx !== -1) {
      ms.getRange(actualRow, pushedIdx + 1).setValue(pushed);
    }
    
    // Sync data columns
    if (statusIdx !== -1 && data.status) {
      ms.getRange(actualRow, statusIdx + 1).setValue(data.status);
    }
    if (leadStatusIdx !== -1 && data.lead_status) {
      ms.getRange(actualRow, leadStatusIdx + 1).setValue(data.lead_status);
    }
    if (noteIdx !== -1 && data.note) {
      ms.getRange(actualRow, noteIdx + 1).setValue(data.note);
    }
    if (followUpIdx !== -1 && data.follow_up) {
      ms.getRange(actualRow, followUpIdx + 1).setValue(data.follow_up);
    }
    if (nextFollowUpIdx !== -1 && data.next_follow_up) {
      ms.getRange(actualRow, nextFollowUpIdx + 1).setValue(data.next_follow_up);
    }
    
    return; // Found and synced, exit
  }
}

function capitalize_(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}



/***********************
 * INSTALLABLE TRIGGER HANDLER
 ***********************/
function mainOnEdit(e) {
  const sh = e.range.getSheet();
  const rowStart = e.range.getRow();
  if (rowStart < 2) return; // header row is 1

  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = headerIndexMap_(headers); // uses norm_()

  // Flexible lookups
  const colAssigned0 = idx["assigned to"] ?? idx["assigned_to"] ?? idx["counselor"] ?? idx["assignee"];
  const colForm0     = idx["assign form"] ?? idx["assign_form"] ?? idx["form name"] ?? idx["form"];
  const colPushed0   = idx["pushed"] ?? idx["push status"];
  const colId0       = idx["id"] ?? idx["lead id"];

  // If any missing, stop (but log it)
  if (colAssigned0 == null || colForm0 == null || colPushed0 == null || colId0 == null) {
    console.warn("Missing required columns in mainOnEdit:", {colAssigned0, colForm0, colPushed0, colId0});
    return;
  }

  const editedCol0 = e.range.getColumn() - 1;

  // -------- lead_status changed → notify website webhook
  const colLeadStatus0 = idx["lead status"] ?? idx["lead_status"];
  if (colLeadStatus0 != null && editedCol0 === colLeadStatus0) {
    const values = e.range.getValues();
    for (let i = 0; i < values.length; i++) {
      const r = rowStart + i;
      const newStatus = String(values[i][0] || "").trim();
      const leadId = String(sh.getRange(r, colId0 + 1).getValue() || "").trim();
      if (leadId && newStatus) {
        notifyWebsiteLeadStatus_(leadId, newStatus);
      }
    }
    // Don't return — allow other handlers below to also run
  }

  // -------- assigned_to changed -> populate dropdown + handle reassignment
  if (editedCol0 === colAssigned0) {
    const values = e.range.getValues();

    for (let i = 0; i < values.length; i++) {
      const r = rowStart + i;
      const counsellorRaw = String(values[i][0] || "").trim();
      
      // Handle empty assignment explicitly
      if (!counsellorRaw) {
        sh.getRange(r, colForm0 + 1).clearContent().clearDataValidations();
        sh.getRange(r, colPushed0 + 1).clearContent().setNote("");
        continue;
      }

      const counsellorKey = counsellorRaw.toLowerCase();
      const leadId = sh.getRange(r, colId0 + 1).getValue();

      // Check if lead was previously assigned to a different counselor
      const oldLocation = findLeadInCounsellorSheets_(leadId);
      if (oldLocation && oldLocation.counsellorKey !== counsellorKey) {
        // RE-ASSIGNMENT! Delete from old counselor's sheet
        try {
          deleteFromCounsellorSheet(oldLocation.counsellorKey, oldLocation.tabName, leadId);
          sh.getRange(r, colPushed0 + 1).setValue("").setNote(`Removed from ${oldLocation.counsellorKey}`);
          sh.getRange(r, colForm0 + 1).clearContent().clearDataValidations();
        } catch(err) {
          sh.getRange(r, colPushed0 + 1).setValue("ERR").setNote(`Failed to remove from old counsellor: ${err.message}`);
          continue;
        }
      }

      // (Branck Manager now handled as standard counselor with external sheet)


      if (counsellorKey === "new") {
        sh.getRange(r, colForm0 + 1).clearContent().clearDataValidations();
        sh.getRange(r, colPushed0 + 1).clearContent().setNote("");
        continue;
      }

      if (!COUNSELLORS[counsellorKey]) {
        sh.getRange(r, colPushed0 + 1).setValue("ERR").setNote(`Unknown counsellor: ${counsellorRaw}`);
        continue;
      }

      try {
        const formNames = getCounsellorTabNamesSorted_(counsellorKey, COUNSELLORS[counsellorKey].fileId);
        const rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(formNames, true)
          .setAllowInvalid(false)
          .build();

        const formCell = sh.getRange(r, colForm0 + 1);
        formCell.clearContent();
        formCell.setDataValidation(rule);

        sh.getRange(r, colPushed0 + 1).setValue("").setNote(""); // clear old errors
      } catch (err) {
        sh.getRange(r, colPushed0 + 1).setValue("ERR").setNote(`Failed to load tabs: ${err.message}`);
        throw err;
      }
    }
    return;
  }



  // -------- assign_form changed -> PUSH
  if (editedCol0 === colForm0) {
    const values = e.range.getValues();

    for (let i = 0; i < values.length; i++) {
      const r = rowStart + i;

      const pushedCell = sh.getRange(r, colPushed0 + 1);
      const pushedVal = String(pushedCell.getValue() || "").trim();
      const newFormName = String(values[i][0] || "").trim();

      const counsellorKey = String(sh.getRange(r, colAssigned0 + 1).getValue() || "").trim().toLowerCase();

      if (!counsellorKey || !newFormName) continue;
      if (!COUNSELLORS[counsellorKey]) {
        pushedCell.setValue("ERR").setNote(`Unknown counsellor: ${counsellorKey}`);
        continue;
      }

      try {
        const metaRow = sh.getRange(r, 1, 1, sh.getLastColumn()).getValues()[0];
        const leadId = get(metaRow, headers, "id");
        if (!leadId) throw new Error("No id in this row");

        // Check if lead was previously pushed to a different form
        const oldTabName = pushedCell.getNote() || pushedVal;
        if (oldTabName && oldTabName !== "ERR" && oldTabName !== newFormName) {
          // Delete from old form
          deleteFromCounsellorSheet(counsellorKey, oldTabName, leadId);
        }

        markTabUsed_(counsellorKey, newFormName);

        // 🔥 THIS IS THE PUSH
        pushToCounsellorSheet(COUNSELLORS[counsellorKey].fileId, newFormName, metaRow, headers);

        // Store the dated form name instead of just the tab name
        const dt = new Date();
        const tz = Session.getScriptTimeZone();
        const dateStr = Utilities.formatDate(dt, tz, "MMM d");
        const displayVal = dateStr + " " + newFormName;
        
        pushedCell.setValue(displayVal).setNote(newFormName);
      } catch (err) {
        pushedCell.setValue("ERR").setNote(`Push failed: ${err.message}`);
        throw err;
      }
    }
  }


}

/**
 * Fire-and-forget POST to /api/leads/status on the website.
 * Notifies the website DB + Facebook CAPI of a lead_status change.
 * Uses muteHttpExceptions so it never blocks the sheet editor.
 */
function notifyWebsiteLeadStatus_(leadId, leadStatus) {
  if (!SITE_URL || SITE_URL.includes("YOUR_PRODUCTION_URL")) {
    console.warn("[WEBHOOK] SITE_URL not configured — skipping lead status sync for " + leadId);
    return;
  }
  if (!WEBHOOK_SECRET) {
    console.warn("[WEBHOOK] WEBHOOK_SECRET not set — skipping lead status sync for " + leadId);
    return;
  }

  try {
    const url = SITE_URL.replace(/\/$/, "") + "/api/leads/status";
    const payload = JSON.stringify({
      lead_id: leadId,
      lead_status: leadStatus,
      webhook_secret: WEBHOOK_SECRET
    });

    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: payload,
      muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    if (code === 200) {
      console.log("[WEBHOOK] Status synced: " + leadId + " → " + leadStatus);
    } else {
      console.warn("[WEBHOOK] Status sync failed (" + code + "): " + response.getContentText());
    }
  } catch(err) {
    console.error("[WEBHOOK] Error notifying website: " + err.message);
  }
}



/***********************
 * PUSH (AUTO HEADER ROW DETECT)
 ***********************/
/***********************
 * ON CHANGE TRIGGER (New Sheets)
 ************************/
function mainOnChange(e) {
  ensureTrackingColumns_();
  updateDuplicationStatus_();
  
  // Format new sheets
  try { applyPremiumStyling_(); } catch(e) {}
}

function ensureTrackingColumns_() {
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();
  const HEADERS = ["assigned_to", "assign_form", "pushed", "duplication_check", "status", "note", "follow_up", "next_follow_up"];
  const EXPECTED_NORM = ["assigned to", "assign form", "pushed", "duplication check", "status", "note", "follow up", "next follow up"];

  sheets.forEach(sheet => {
    const lastCol = sheet.getLastColumn();
    if (lastCol < 1) return;

    // optimization: read top row
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const headersNorm = headers.map(norm_);

    const statusIdx = headersNorm.indexOf("lead status");
    if (statusIdx === -1) return;

    // Check if columns already exist
    let matches = true;
    for (let i = 0; i < 8; i++) {
        const h = headersNorm[statusIdx + 1 + i]; 
        if (h !== EXPECTED_NORM[i]) {
            matches = false;
            break;
        }
    }
    
    if (matches) return;

    try {
      sheet.insertColumnsAfter(statusIdx + 1, 8);
      sheet.getRange(1, statusIdx + 2, 1, 8)
        .setValues([HEADERS])
        .setFontWeight("bold");
    } catch (e) {
      console.error(`Failed to add columns to ${sheet.getName()}: ${e.message}`);
    }
  });
}


/***********************
 * FIND LEAD IN COUNSELLOR SHEETS (Helper for reassignment)
 ***********************/
function findLeadInCounsellorSheets_(leadId) {
  // Search all counselor sheets to find where this lead exists
  for (const counsellorKey in COUNSELLORS) {
    const fileId = COUNSELLORS[counsellorKey].fileId;
    try {
      const ss = SpreadsheetApp.openById(fileId);
      const sheets = ss.getSheets();
      
      for (const sheet of sheets) {
        if (sheet.isSheetHidden()) continue;
        
        const headerInfo = detectHeaderRow_(sheet);
        if (!headerInfo) continue;
        
        const { headerRow, headersRaw } = headerInfo;
        const leadIdCol = headersRaw.findIndex(h => {
          const n = normalizeHeader(h);
          return n === "lead id" || n.replace(/\s/g, "") === "leadid";
        });
        
        if (leadIdCol === -1) continue;
        
        const lastRow = sheet.getLastRow();
        if (lastRow <= headerRow) continue;
        
        const ids = sheet.getRange(headerRow + 1, leadIdCol + 1, lastRow - headerRow, 1)
          .getValues()
          .flat();
        
        if (ids.some(id => String(id).trim() === String(leadId).trim())) {
          return { counsellorKey, tabName: sheet.getName() };
        }
      }
    } catch(e) {
      console.error(`Error searching ${counsellorKey} sheets: ${e.message}`);
    }
  }
  return null; // Not found
}

/***********************
 * DELETE LEAD FROM COUNSELLOR SHEET
 ***********************/
function deleteFromCounsellorSheet(counsellorKey, tabName, leadId) {
  if (!COUNSELLORS[counsellorKey]) return;
  
  try {
    const fileId = COUNSELLORS[counsellorKey].fileId;
    const ss = SpreadsheetApp.openById(fileId);
    const sheet = ss.getSheetByName(tabName);
    
    if (!sheet) return; // Tab doesn't exist anymore
    
    // Find the header row and lead_id column
    const headerInfo = detectHeaderRow_(sheet);
    if (!headerInfo) return;
    
    const { headerRow, headersRaw } = headerInfo;
    const leadIdCol = headersRaw.findIndex(h => {
      const n = normalizeHeader(h);
      return n === "lead id" || n.replace(/\s/g, "") === "leadid";
    });
    
    if (leadIdCol === -1) return;
    
    // Search for the row with this lead ID
    const lastRow = sheet.getLastRow();
    if (lastRow <= headerRow) return;
    
    const ids = sheet.getRange(headerRow + 1, leadIdCol + 1, lastRow - headerRow, 1)
      .getValues()
      .flat();
    const rowIndex = ids.findIndex(id => String(id).trim() === String(leadId).trim());
    
    if (rowIndex !== -1) {
      const actualRow = headerRow + 1 + rowIndex;
      sheet.deleteRow(actualRow);
    }
  } catch (err) {
    console.error(`Failed to delete lead ${leadId} from ${tabName}: ${err.message}`);
    // Don't throw - continue with push even if delete fails
  }
}

function pushToCounsellorSheet(fileId, tabName, metaRow, metaHeaders) {
  const ss = SpreadsheetApp.openById(fileId);
  const target = ss.getSheetByName(tabName);
  if (!target) throw new Error(`Tab not found: ${tabName}`);
  target.activate();

  const payload = buildCounsellorPayload(metaRow, metaHeaders, tabName);
  const leadId = payload.leadId;

  if (sheetContainsLeadId(target, leadId)) return;

  // ensureDateSeparator(target, payload.separatorLabel);

  // ✅ auto-detect header row by finding row that contains "lead_id" or "lead status"
  const headerInfo = detectHeaderRow_(target);
  if (!headerInfo) throw new Error(`Cannot detect header row in tab: ${tabName}`);

  const { headerRow, headersRaw } = headerInfo;

  const out = headersRaw.map(h => resolveCounsellorValue(h, payload, leadId));
  target.appendRow(out);

  // ✅ Apply dropdown validation to lead_status column for all data rows
  applyLeadStatusValidation_(target, headerRow, headersRaw);
}

/***********************
 * Header row detection (checks first 10 rows)
 ***********************/
function detectHeaderRow_(sheet) {
  const lastCol = sheet.getLastColumn();
  const scanRows = Math.min(10, sheet.getLastRow());
  if (lastCol < 1 || scanRows < 1) return null;

  const grid = sheet.getRange(1, 1, scanRows, lastCol).getValues();
  for (let r = 0; r < grid.length; r++) {
    const normalized = grid[r].map(normalizeHeader);
    const hasLeadId = normalized.some(h => h.replace(/_/g, "") === "leadid" || h === "lead id");
    const hasLeadStatus = normalized.some(h => h.replace(/_/g, "") === "leadstatus" || h === "lead status");
    // accept header row if it contains at least one strong identifier
    if (hasLeadId || hasLeadStatus) {
      return { headerRow: r + 1, headersRaw: grid[r] };
    }
  }
  return null;
}

/***********************
 * Lead status dropdown for counsellor sheets
 ***********************/
function applyLeadStatusValidation_(sheet, headerRow, headersRow) {
  const headerIndex = headersRow.findIndex(h => {
    const t = normalizeHeader(h);
    return t.replace(/_/g, "") === "leadstatus" || t === "lead status";
  });
  if (headerIndex === -1) return;

  const col = headerIndex + 1;
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(LEAD_STATUS_LIST, true)
    .setAllowInvalid(false)
    .build();

  const startRow = headerRow + 1; // ✅ data starts under detected header
  const lastRow = Math.max(sheet.getLastRow(), startRow);
  sheet.getRange(startRow, col, lastRow - startRow + 1, 1).setDataValidation(rule);
}

/***********************
 * UTIL (same as yours)
 ***********************/

/***********************
 * Meta -> Counsellor row builder
 ***********************/
function buildCounsellorPayload(metaRow, metaHeaders) {
  const campaign = get(metaRow, metaHeaders, "ad_name") || get(metaRow, metaHeaders, "ad name") || "Ad";

  const dt = new Date();
  const tz = Session.getScriptTimeZone();
  const dateStr = Utilities.formatDate(dt, tz, "MMM d");
  const prettyDate = Utilities.formatDate(dt, tz, "dd MMMM yyyy");
  
  // Use "MMM d + Ad Name" as the first column content
  const dateField = dateStr + " " + campaign;

  const lastEduRaw = get(
    metaRow,
    metaHeaders,
    "your_last_educational_qualification_with_passing_year?_(e.g:__hsc_2024))_"
  );

  const passingYear = extractYear(lastEduRaw);
  const metaLeadStatus = get(metaRow, metaHeaders, H_LEAD_STATUS) || "CREATED";

  return {
    leadId: get(metaRow, metaHeaders, H_ID),
    separatorLabel: `------------------ ${prettyDate} ------------------`,
    values: {
      dateField,
      studentName: get(metaRow, metaHeaders, "first name"),
      phone: get(metaRow, metaHeaders, "phone"),
      city: get(metaRow, metaHeaders, "city"),
      preferredProgram: get(metaRow, metaHeaders, "preferred_course_of_yours"),
      englishCondition: get(metaRow, metaHeaders, "what_is_your_english_proficiency"),
      lastEduQualification: stripYear(lastEduRaw),
      cgpa: get(metaRow, metaHeaders, "what_is_your_cgpa/_gpa/_division?__(_e.g:_cgpa_3.68_)"),
      lastAcademicPassingYear: passingYear,
      institute: "",
      englishScore: "",
      status: "",
      note: "",
      followUp: "",
      nextFollowUp: "",
      leadStatus: metaLeadStatus,
    }
  };
}



function get(row, headers, name) {
  const i = headers.indexOf(name);
  return i === -1 ? "" : row[i];
}

function extractYear(text) {
  const m = String(text || "").match(/\b(19\d{2}|20\d{2})\b/);
  return m ? m[1] : "";
}

function stripYear(text) {
  const s = String(text || "");
  const y = extractYear(s);
  if (!y) return s.trim();
  return s.replace(y, "").replace(/[-,()]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeHeader(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/\n/g, " ")
    .replace(/[_]/g, " ") // Fix: normalize underscores to spaces
    .replace(/\s+/g, " ")
    .trim();
}

/***********************
 * Resolve value for specific counsellor header
 ***********************/
function resolveCounsellorValue(headerCell, payload, leadId) {
  const h = normalizeHeader(headerCell);

  if (h === "date") return payload.values.dateField;
  if (h === "student name") return payload.values.studentName;
  if (h === "phone") return payload.values.phone;
  if (h === "city") return payload.values.city;
  if (h === "preferred program") return payload.values.preferredProgram;
  if (h === "english condition") return payload.values.englishCondition;
  if (h === "last education qualification") return payload.values.lastEduQualification;
  if (h === "cgpa") return payload.values.cgpa;
  if (h === "last academic passing year") return payload.values.lastAcademicPassingYear;
  if (h.includes("institute")) return payload.values.institute;
  if (h === "english score") return payload.values.englishScore;
  if (h === "status") return payload.values.status;
  if (h === "note") return payload.values.note;
  if (h === "follow up") return payload.values.followUp;
  if (h === "next follow up") return payload.values.nextFollowUp;

  if (h === "lead status" || h === "lead status") return payload.values.leadStatus;
  if (h === "lead id" || h === "lead id") return leadId;

  if (h === "lead id" || h === "lead id") return leadId;

  return "";

}

/***********************
 * Check if sheet already has this lead ID
 ***********************/
function sheetContainsLeadId(sheet, leadId) {
  const headerInfo = detectHeaderRow_(sheet);
  if (!headerInfo) return false;

  const { headerRow, headersRaw } = headerInfo;
  const colIndex = headersRaw.findIndex(h => {
    const n = normalizeHeader(h);
    // Matches "lead id" (normalized from "lead_id")
    return n === "lead id" || n.replace(/\s/g, "") === "leadid"; 
  });

  if (colIndex === -1) return false;

  const lastRow = sheet.getLastRow();
  if (lastRow <= headerRow) return false;

  // Check all values in the lead_id column
  const ids = sheet.getRange(headerRow + 1, colIndex + 1, lastRow - headerRow, 1).getValues().flat();
  return ids.some(id => String(id).trim() === String(leadId).trim());
}

/***********************
 * Add date separator if needed
 ***********************/
function ensureDateSeparator(sheet, label) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    sheet.appendRow([label]);
    return;
  }

  const lastValue = sheet.getRange(lastRow, 1).getValue();
  if (String(lastValue).trim() !== String(label).trim()) {
    sheet.appendRow([label]);
  }
}


/***********************
 * PHONE DUPLICATION DETECTION
 ***********************/

/**
 * Normalize phone number for comparison
 */
function normalizePhone_(phone) {
  return String(phone || "")
    .replace(/[\s\-()]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Scan all sheets and build phone duplication map
 * Returns: Map<normalizedPhone, Array<{sheetName, sheetId, row, counselor, phone}>>
 */
function scanPhoneDuplicates_() {
  const ss = SpreadsheetApp.getActive();
  const sheets = ss.getSheets();
  const phoneMap = new Map();

  sheets.forEach(sheet => {
    const lastCol = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();
    if (lastCol < 1 || lastRow < 2) return;

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const headersNorm = headers.map(norm_);

    const phoneIdx = headersNorm.indexOf("phone");
    const assignedIdx = headersNorm.findIndex(h => h === "assigned to" || h === "assigned_to");
    
    if (phoneIdx === -1) return;

    // Read all phone numbers and assigned_to values
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    const data = dataRange.getValues();

    data.forEach((row, idx) => {
      const actualRow = idx + 2;
      const phone = row[phoneIdx];
      const phoneNorm = normalizePhone_(phone);
      
      if (!phoneNorm) return; // Skip empty phones

      const counselor = assignedIdx !== -1 ? String(row[assignedIdx] || "").trim() : "";
      
      const entry = {
        sheetName: sheet.getName(),
        sheetId: sheet.getSheetId(),
        row: actualRow,
        counselor: counselor,
        phone: phone
      };

      if (!phoneMap.has(phoneNorm)) {
        phoneMap.set(phoneNorm, []);
      }
      phoneMap.get(phoneNorm).push(entry);
    });
  });

  return phoneMap;
}

/**
 * Update duplication status for all sheets
 */
function updateDuplicationStatus_() {
  const ss = SpreadsheetApp.getActive();
  const phoneMap = scanPhoneDuplicates_();
  const sheets = ss.getSheets();

  sheets.forEach(sheet => {
    const lastCol = sheet.getLastColumn();
    const lastRow = sheet.getLastRow();
    if (lastCol < 1 || lastRow < 2) return;

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const headersNorm = headers.map(norm_);

    const phoneIdx = headersNorm.indexOf("phone");
    const dupCheckIdx = headersNorm.findIndex(h => h === "duplication check" || h === "duplication_check");
    const statusIdx = headersNorm.findIndex(h => h === "lead_status" || h === "lead status");
    
    if (phoneIdx === -1) return;

    // Process each row
    for (let row = 2; row <= lastRow; row++) {
      const phone = sheet.getRange(row, phoneIdx + 1).getValue();
      const phoneNorm = normalizePhone_(phone);
      
      if (!phoneNorm) continue;

      const duplicates = phoneMap.get(phoneNorm) || [];
      const count = duplicates.length;

      // Set phone cell background color
      const phoneCell = sheet.getRange(row, phoneIdx + 1);
      if (count === 1) {
        phoneCell.setBackground(null); // Clear/white
      } else if (count === 2) {
        phoneCell.setBackground("#FFFF00"); // Yellow
      } else {
        phoneCell.setBackground("#FF0000"); // Red
      }

      // Set duplication_check column if it exists
      if (dupCheckIdx !== -1) {
        const dupCell = sheet.getRange(row, dupCheckIdx + 1);
        
        if (count === 1) {
          dupCell.setValue("Fresh");
        } else {
          // Build rich text with links
          const parts = [];
          const currentSheet = sheet.getName();
          
          duplicates.forEach(dup => {
            const isSameSheet = dup.sheetName === currentSheet;
            const sheetPrefix = isSameSheet ? "" : `${dup.sheetName}: `;
            const url = `#gid=${dup.sheetId}&range=A${dup.row}`;
            
            let info = `${sheetPrefix}Row ${dup.row}`;
            if (dup.counselor) {
              info += ` (${dup.counselor})`;
            }
            
            parts.push({
              text: info,
              url: url
            });
          });

          // Create rich text with hyperlinks
          const richTextBuilder = SpreadsheetApp.newRichTextValue();
          let fullText = "";
          const textParts = [];
          
          parts.forEach((part, idx) => {
            if (idx > 0) fullText += ", ";
            const startIdx = fullText.length;
            fullText += part.text;
            const endIdx = fullText.length;
            textParts.push({ start: startIdx, end: endIdx, url: part.url });
          });

          richTextBuilder.setText(fullText);
          textParts.forEach(tp => {
            richTextBuilder.setLinkUrl(tp.start, tp.end, tp.url);
          });

          dupCell.setRichTextValue(richTextBuilder.build());
        }
      }

      // Update lead_status to DUPLICATE if needed (and single time)
      if (count > 1 && statusIdx !== -1) {
        const statusCell = sheet.getRange(row, statusIdx + 1);
        const currentStatus = String(statusCell.getValue() || "").trim().toUpperCase();
        
        // Only mark as DUPLICATE if it's currently fresh/created
        // This allows counselors to overwrite it with QUALIFIED etc.
        if (currentStatus === "" || currentStatus === "CREATED") {
          statusCell.setValue("DUPLICATE");
        }
      }
    }
  });
}

/**
 * Create custom menu on open
 */
/**
 * Create custom menu on open
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Lead Tools')
    .addItem('Check Phone Duplicates', 'updateDuplicationStatus_')
    .addToUi();
    
  // Scroll current sheet to bottom on load
  scrollToBottom_(SpreadsheetApp.getActiveSheet());

  // Freeze header row for all sheets
  freezeAllSheets_();

  // Apply visual enhancements
  applyPremiumStyling_();
  
  // Track initial sheet for tab switching
  try {
    PropertiesService.getUserProperties().setProperty('lastSheetId', SpreadsheetApp.getActiveSheet().getSheetId().toString());
  } catch (e) {}
}

/**
 * Handle tab switching to scroll to bottom
 */
function onSelectionChange(e) {
  if (!e) return;
  handleTabSwitch_(e.range.getSheet());
}

function handleTabSwitch_(sheet) {
  try {
    const props = PropertiesService.getUserProperties();
    const lastSheetId = props.getProperty('lastSheetId');
    const currentSheetId = sheet.getSheetId().toString();
    
    if (lastSheetId !== currentSheetId) {
      // Tab switched!
      scrollToBottom_(sheet);
      props.setProperty('lastSheetId', currentSheetId);
    }
  } catch (e) {
    // PropertiesService might fail in simple trigger context - ignore
  }
}

function scrollToBottom_(sheet) {
   const lastRow = sheet.getLastRow();
   if (lastRow > 0) {
     const range = sheet.getRange(lastRow, 1);
     sheet.setActiveRange(range);
   }
}


function freezeAllSheets_() {
  const ss = SpreadsheetApp.getActive();
  ss.getSheets().forEach(sheet => {
    if (sheet.getLastRow() > 0) {
      sheet.setFrozenRows(1);
    }
  });
}

function applyPremiumStyling_() {
  const ss = SpreadsheetApp.getActive();
  ss.getSheets().forEach(sheet => {
    formatSingleSheet_(sheet);
  });
}

function formatSingleSheet_(sheet) {
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  
  if (lastCol < 1 || lastRow < 1) return;

  // 1. Header Styling & Freezing
  sheet.setFrozenRows(1);

  const headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange
    .setBackground("#0C343D") // Deep Blue
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);

  sheet.setRowHeight(1, 40);

  // 2. Data Styling
  if (lastRow > 1) {
    const numDataRows = lastRow - 1;
    if (numDataRows > 0) {
      const dataRange = sheet.getRange(2, 1, numDataRows, lastCol);
      dataRange
        .setVerticalAlignment("middle")
        .setFontFamily("Roboto")
        .setBorder(true, true, true, true, true, true, "#E0E0E0", SpreadsheetApp.BorderStyle.SOLID)
        .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
      
      // Zebra Striping
      const bandings = sheet.getBandings();
      bandings.forEach(b => b.remove());
      dataRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
      
      // Fixed height
      sheet.setRowHeights(2, numDataRows, 35);
    }
  }

  // 3. Smart Column Sizing & Formatting
  try {
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).toLowerCase().trim());
    
    for (let i = 0; i < headers.length; i++) {
      const col = i + 1;
      const h = headers[i];
      
      // FORMAT Created Time (12hr + Date)
      if (h === "created_time" || h === "created time") {
        sheet.getRange(2, col, lastRow - 1, 1).setNumberFormat("d MMM yyyy h:mm am/pm");
        sheet.setColumnWidth(col, 160);
        continue;
      }

      // SIZE specific columns
      if (h.includes("note")) {
        sheet.setColumnWidth(col, 200);
      } else if (h.includes("status") || h.includes("email")) {
        sheet.setColumnWidth(col, 180);
      } else if (h.includes("phone")) {
        sheet.setColumnWidth(col, 140);
      } else if (h.includes("date") || h.includes("created")) {
        sheet.setColumnWidth(col, 140);
      } else {
        sheet.setColumnWidth(col, 150);
      }
    }
  } catch(e) {
    console.error("Format error: " + e.message);
  }
}

