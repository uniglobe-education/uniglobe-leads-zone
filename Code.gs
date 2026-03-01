function doGet(e) {
  var formId = (e && e.parameter && e.parameter.form_id) ? e.parameter.form_id : null;
  
  if (e && e.parameter && e.parameter.route === 'api_questions') {
    if (!formId) {
       return ContentService.createTextOutput(JSON.stringify({ error: 'Missing form_id parameter' }))
           .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({
      questions: getQuestions(formId)
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  var template = HtmlService.createTemplateFromFile('Index');
  template.formId = formId; 
  return template.evaluate()
    .setTitle('Free Study Consultation - UniGlobe Education')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var formId = payload.formId;
    var answers = payload.answers || {};
    var urlParams = payload.urlParams || {};
    
    if (!formId) {
      return ContentService.createTextOutput(JSON.stringify({success: false, error: 'Missing form_id'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Find target CRM sheet
    var adminSheet = SpreadsheetApp.getActiveSpreadsheet();
    var formsTab = adminSheet.getSheetByName('FORMS');
    if (!formsTab) throw new Error("FORMS tab missing in ADMIN sheet");
    
    var formsData = formsTab.getDataRange().getValues();
    var formsHeaders = formsData[0];
    var formIdIdx = formsHeaders.indexOf('form_id');
    var targetSheetIdIdx = formsHeaders.indexOf('target_spreadsheet_id');
    
    var targetSheetId = null;
    var formName = "";
    var formNameIdx = formsHeaders.indexOf('form_name');
    
    for (var i = 1; i < formsData.length; i++) {
        if (formsData[i][formIdIdx] === formId) {
            targetSheetId = formsData[i][targetSheetIdIdx];
            if (formNameIdx > -1) formName = formsData[i][formNameIdx];
            break;
        }
    }
    
    if (!targetSheetId) {
      return ContentService.createTextOutput(JSON.stringify({success: false, error: 'Form ID not found or missing CRM spreadsheet ID'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var crmSpreadsheet = SpreadsheetApp.openById(targetSheetId);
    var targetTabName = 'LEADS__' + formId;
    var targetSheet = crmSpreadsheet.getSheetByName(targetTabName);
    
    if (!targetSheet) {
      return ContentService.createTextOutput(JSON.stringify({success: false, error: 'Target CRM tab ' + targetTabName + ' does not exist. Please run syncForms().'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var headers = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
    
    // Generate id
    var now = new Date();
    var dateString = now.getFullYear().toString() +
                     ('0' + (now.getMonth() + 1)).slice(-2) +
                     ('0' + now.getDate()).slice(-2);
    
    var scriptProperties = PropertiesService.getScriptProperties();
    var count = parseInt(scriptProperties.getProperty('leadCount_' + dateString) || '0', 10) + 1;
    scriptProperties.setProperty('leadCount_' + dateString, count.toString());
    var id = 'UG-' + dateString + '-' + ('000000' + count).slice(-6);
    
    var phone = answers['phone'] || '';
    var dedupeCheck = '';
    
    // Global Dedupe check across ALL LEADS__* tabs
    if (phone) {
      var allTabs = crmSpreadsheet.getSheets();
      var cleanPhone = String(phone).replace(/[^0-9]/g, '');
      
      for (var t = 0; t < allTabs.length; t++) {
        var tab = allTabs[t];
        if (tab.getName().indexOf('LEADS__') === 0 && dedupeCheck === '') {
           var tabData = tab.getDataRange().getValues();
           if (tabData.length > 0) {
              var tabHeaders = tabData[0];
              var phoneColIdx = tabHeaders.indexOf('phone');
              if (phoneColIdx > -1) {
                  for (var r = 1; r < tabData.length; r++) {
                      if (String(tabData[r][phoneColIdx]).replace(/[^0-9]/g, '') === cleanPhone) {
                          dedupeCheck = 'DUPLICATE';
                          break;
                      }
                  }
              }
           }
        }
      }
    }
    
    var rowData = [];
    for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        if (h === 'id') rowData.push(id);
        else if (h === 'created_time') rowData.push(now);
        else if (h === 'form_id') rowData.push(formId);
        else if (h === 'form_name') rowData.push(formName);
        else if (h === 'duplication_check') rowData.push(dedupeCheck);
        else if (answers[h] !== undefined) rowData.push(answers[h]);
        else if (urlParams[h] !== undefined) rowData.push(urlParams[h]);
        else rowData.push(''); // blank
    }
    
    targetSheet.appendRow(rowData);
    
    return ContentService.createTextOutput(JSON.stringify({success: true, id: id}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function syncForms() {
  var adminSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var formsTab = adminSpreadsheet.getSheetByName('FORMS');
  var questionsTab = adminSpreadsheet.getSheetByName('QUESTIONS');
  
  if (!formsTab || !questionsTab) {
      Logger.log("Missing FORMS or QUESTIONS tab in ADMIN sheet.");
      return;
  }
  
  var formsData = formsTab.getDataRange().getValues();
  var formsHeaders = formsData[0];
  
  var questionsData = questionsTab.getDataRange().getValues();
  var questionsHeaders = questionsData[0];
  
  var baseTrackingColumns = [
    "id", "created_time", "platform", "is_organic", 
    "campaign_id", "campaign_name", "adset_id", "adset_name", 
    "ad_id", "ad_name", "form_id", "form_name", 
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", 
    "fbclid", "_fbp", "fbc", "landing_page"
  ];
  
  var crmColumns = [
    "lead_status", "assigned_to", "note", "follow_up", "next_follow_up", "duplication_check", "status"
  ];
  
  // Iterate through forms
  for (var i = 1; i < formsData.length; i++) {
     var formRow = formsData[i];
     var formId = formRow[formsHeaders.indexOf('form_id')];
     var status = formRow[formsHeaders.indexOf('status')];
     var targetSheetId = formRow[formsHeaders.indexOf('target_spreadsheet_id')];
     
     if (!formId || String(status).toUpperCase() !== 'ACTIVE' || !targetSheetId) continue;
     
     try {
         var crmSpreadsheet = SpreadsheetApp.openById(targetSheetId);
         var targetTabName = 'LEADS__' + formId;
         var targetSheet = crmSpreadsheet.getSheetByName(targetTabName);
         
         if (!targetSheet) {
             targetSheet = crmSpreadsheet.insertSheet(targetTabName);
         }
         
         // Collect dynamic question keys
         var dynamicColumns = [];
         for (var j = 1; j < questionsData.length; j++) {
             var qRow = questionsData[j];
             if (qRow[questionsHeaders.indexOf('form_id')] === formId) {
                 var qKey = qRow[questionsHeaders.indexOf('key')];
                 if (qKey) dynamicColumns.push(qKey);
             }
         }
         
         // Ensure standard base column for answers exists natively if not specified, like 'phone', 'first_name', 'email' etc are dynamic columns.
         // Build the desired header array
         var desiredHeaders = baseTrackingColumns.concat(dynamicColumns).concat(crmColumns);
         
         // Only write headers if row 1 is empty or doesn't match length. 
         // In a robust implementation you might append missing headers, MVP we write it if A1 is blank.
         var currentHeadersRange = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn() || 1);
         var currentHeaders = currentHeadersRange.getValues()[0];
         
         if (!currentHeaders[0] || currentHeaders.length === 1 && currentHeaders[0] === "") {
             targetSheet.getRange(1, 1, 1, desiredHeaders.length).setValues([desiredHeaders]);
             // Formatting
             targetSheet.getRange(1, 1, 1, desiredHeaders.length).setFontWeight("bold").setBackground("#f3f4f6");
             targetSheet.setFrozenRows(1);
         } else {
             // Append missing columns
             var missingCols = [];
             for (var k = 0; k < desiredHeaders.length; k++) {
                 if (currentHeaders.indexOf(desiredHeaders[k]) === -1) {
                     missingCols.push(desiredHeaders[k]);
                 }
             }
             if (missingCols.length > 0) {
                 var nextColIndex = targetSheet.getLastColumn() + 1;
                 targetSheet.getRange(1, nextColIndex, 1, missingCols.length).setValues([missingCols]);
                 targetSheet.getRange(1, nextColIndex, 1, missingCols.length).setFontWeight("bold").setBackground("#f3f4f6");
             }
         }
     } catch (err) {
         Logger.log("Error syncing form " + formId + ": " + err.toString());
     }
  }
}

function getQuestions(formId) {
  try {
    var adminSheet = SpreadsheetApp.getActiveSpreadsheet();
    var questionsTab = adminSheet.getSheetByName('QUESTIONS');
    if (!questionsTab) return [];
    
    var data = questionsTab.getDataRange().getValues();
    var headers = data[0];
    var questions = [];
    
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[headers.indexOf('form_id')] !== formId) continue;
        
        var q = {};
        for (var j = 0; j < headers.length; j++) {
            q[headers[j]] = row[j];
        }
        
        if (q.enabled === true || String(q.enabled).toUpperCase() === 'TRUE') {
            q.required = (q.required === true || String(q.required).toUpperCase() === 'TRUE');
            if (q.options && typeof q.options === 'string') {
              q.options = q.options.split('|');
            } else {
              q.options = [];
            }
            questions.push(q);
        }
    }
    
    questions.sort(function(a, b) {
        return (a.order || 99) - (b.order || 99);
    });
    
    return questions;
  } catch (err) {
    return [];
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
