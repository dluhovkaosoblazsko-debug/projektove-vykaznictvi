const RECORDS_ROOT_FOLDER_NAME = 'Projektove vykaznictvi - klienti';
const CLIENT_BUNDLE_ROOT_FOLDER_NAME = 'PRACOVKO SLO\u017dKY';
const PROJECT_NAME = '\u0158e\u0161en\u00ed zam\u011bstnanosti a zam\u011bstnatelnosti osob na Osobla\u017esku 2026+';
const PROJECT_CODE = 'CZ.03.01.01/00/25_086/0006246';
const BENEFICIARY_NAME = 'Osobla\u017esk\u00fd cech, z.\u00fa.';
const CLIENT_TEMPLATE_IDS = {
  contract: '1h3SKaa_VsEWMSLfBFnKEadpjn0GJmX23iynNgZ3cY5k',
  consent: '1D0uHwNWSFLYeQeR6oz5hOI1Pv7XoLAer5AqEX78T98M'
};
const MONITORING_TEMPLATE_FILE_ID = '1HCtpMxVuOHy0eQFphmBCHmHan_MKTn-GRCnBD7O9loI';

function authorizeRequiredServices() {
  var rootFolder = getOrCreateFolder_(DriveApp.getRootFolder(), RECORDS_ROOT_FOLDER_NAME);
  var testDoc = DocumentApp.create('TEST autorizace - Projektove vykaznictvi');
  testDoc.getBody().appendParagraph('Test opravneni pro automaticke ukladani zapisu.');
  testDoc.saveAndClose();
  var file = DriveApp.getFileById(testDoc.getId());
  file.moveTo(rootFolder);
  file.setTrashed(true);
  return 'Opravneni jsou pripravena.';
}

function doPost(e) {
  var clientFolder = null;
  try {
    var payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    var client = payload.client || {};

    if (!client.id || !client.fullName) {
      throw new Error('Chybi klient nebo interni ID klienta.');
    }

    if (payload.action === 'provisionClientFolder') {
      return json_({
        ok: true,
        action: 'provisionClientFolder',
        result: provisionClientFolder_(client)
      });
    }

    var record = payload.record || {};
    var rootFolder = getOrCreateFolder_(DriveApp.getRootFolder(), RECORDS_ROOT_FOLDER_NAME);
    var clientFolderName = sanitizeName_(client.fullName + ' - ' + client.id);
    clientFolder = getOrCreateFolder_(rootFolder, clientFolderName);

    var documentName = sanitizeName_(record.filename || record.title || 'zaznam');
    trashExistingFiles_(clientFolder, documentName);

    var doc = DocumentApp.create(documentName);
    writeRecordToDocument_(doc, payload);
    doc.saveAndClose();

    var file = DriveApp.getFileById(doc.getId());
    file.moveTo(clientFolder);
    file.setDescription(JSON.stringify({
      clientId: client.id,
      recordId: record.id || '',
      ka: record.ka || '',
      entityType: record.entityType || '',
      activityDate: record.activityDate || ''
    }, null, 2));

    return json_({
      ok: true,
      rootFolderId: rootFolder.getId(),
      rootFolderUrl: buildFolderUrl_(rootFolder.getId()),
      clientFolderId: clientFolder.getId(),
      clientFolderUrl: buildFolderUrl_(clientFolder.getId()),
      fileId: file.getId(),
      fileUrl: file.getUrl()
    });
  } catch (error) {
    if (clientFolder) {
      clientFolder.createFile(
        sanitizeName_('CHYBA uploadu - ' + new Date().toISOString() + '.txt'),
        error.stack || error.message || String(error),
        MimeType.PLAIN_TEXT
      );
    }
    return json_({ ok: false, error: error.message || String(error) });
  }
}

function provisionClientFolder_(client) {
  var rootFolder = getOrCreateFolder_(DriveApp.getRootFolder(), CLIENT_BUNDLE_ROOT_FOLDER_NAME);
  var clientFolderName = sanitizeName_(client.id + ' - ' + client.fullName);
  var clientFolder = getOrCreateFolder_(rootFolder, clientFolderName);
  var replacements = buildClientTemplateReplacements_(client);

  var contract = getOrCreateFilledGoogleDoc_(
    CLIENT_TEMPLATE_IDS.contract,
    clientFolder,
    sanitizeName_('Smlouva - ' + client.fullName),
    replacements
  );
  var consent = getOrCreateFilledGoogleDoc_(
    CLIENT_TEMPLATE_IDS.consent,
    clientFolder,
    sanitizeName_('Souhlas se zpracovanim osobnich udaju - ' + client.fullName),
    replacements
  );
  var monList = getOrCreateMonitoringSheet_(
    clientFolder,
    sanitizeName_('MON list - ' + client.fullName),
    replacements
  );

  return {
    rootFolderId: rootFolder.getId(),
    rootFolderName: rootFolder.getName(),
    rootFolderUrl: buildFolderUrl_(rootFolder.getId()),
    clientFolderId: clientFolder.getId(),
    clientFolderName: clientFolder.getName(),
    clientFolderUrl: buildFolderUrl_(clientFolder.getId()),
    contractFileId: contract.getId(),
    contractFileName: contract.getName(),
    contractFileUrl: contract.getUrl(),
    consentFileId: consent.getId(),
    consentFileName: consent.getName(),
    consentFileUrl: consent.getUrl(),
    monListFileId: monList.getId(),
    monListFileName: monList.getName(),
    monListFileUrl: monList.getUrl()
  };
}

function buildClientTemplateReplacements_(client) {
  var address = [client.ulice, client.cisloPopisne].filter(Boolean).join(' ').trim();
  var addressLine = [address, client.psc, client.mesto].filter(Boolean).join(', ');
  return {
    '{{PROJECT_NAME}}': PROJECT_NAME,
    '{{PROJECT_CODE}}': PROJECT_CODE,
    '{{BENEFICIARY_NAME}}': BENEFICIARY_NAME,
    '{{CLIENT_NAME}}': client.fullName || '',
    '{{CLIENT_ID}}': client.id || '',
    '{{CLIENT_FIRST_NAME}}': client.jmeno || '',
    '{{CLIENT_LAST_NAME}}': client.prijmeni || '',
    '{{CLIENT_BIRTH_DATE}}': client.datumNarozeni || '',
    '{{CLIENT_ADDRESS}}': addressLine,
    '{{CLIENT_STREET}}': client.ulice || '',
    '{{CLIENT_CITY}}': client.mesto || '',
    '{{CLIENT_POSTAL_CODE}}': client.psc || '',
    '{{CLIENT_HOUSE_NUMBER}}': client.cisloPopisne || '',
    '{{CLIENT_DISTRICT_CITY}}': client.spadoveMesto || '',
    '{{CLIENT_GENDER}}': client.pohlavi || '',
    '{{CLIENT_LABOUR_STATUS}}': client.postaveniNaTrhu || '',
    '{{CLIENT_EDUCATION}}': client.vzdelani || '',
    '{{CLIENT_DISADVANTAGE}}': client.znevyhodneni || '',
    '{{CLIENT_PHONE}}': client.telefon || '',
    '{{CLIENT_EMAIL}}': client.email || '',
    '{{SIGN_CITY}}': client.mesto || '',
    '{{SIGN_DATE}}': formatCzechDate_(new Date()),
    '{{CLIENT_SIGNATURE}}': ''
  };
}

function getOrCreateFilledGoogleDoc_(templateId, targetFolder, targetName, replacements) {
  var copy = getExistingFileByName_(targetFolder, targetName);
  if (!copy) {
    copy = DriveApp.getFileById(templateId).makeCopy(targetName, targetFolder);
  }

  var document = DocumentApp.openById(copy.getId());
  var body = document.getBody();
  Object.keys(replacements).forEach(function (placeholder) {
    body.replaceText(escapeForRegex_(placeholder), replacements[placeholder] || '');
  });
  document.saveAndClose();
  copy.setDescription(JSON.stringify({
    projectName: PROJECT_NAME,
    projectCode: PROJECT_CODE,
    generatedFromTemplateId: templateId
  }, null, 2));
  return copy;
}

function getOrCreateMonitoringSheet_(targetFolder, targetName, replacements) {
  var copy = getExistingFileByName_(targetFolder, targetName);
  if (!copy) {
    copy = DriveApp.getFileById(MONITORING_TEMPLATE_FILE_ID).makeCopy(targetName, targetFolder);
  }
  fillSpreadsheetTemplate_(copy.getId(), replacements || {});
  return copy;
}

function fillSpreadsheetTemplate_(spreadsheetId, replacements) {
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheet = spreadsheet.getSheetByName('List1') || spreadsheet.getSheets()[0];
  if (!sheet) throw new Error('MON list nema zadny list.');

  sheet.getRange('C3').setValue(PROJECT_CODE);
  sheet.getRange('C4').setValue(PROJECT_NAME);
  sheet.getRange('C5').setValue(BENEFICIARY_NAME);
  sheet.getRange('C7').setValue(replacements['{{CLIENT_FIRST_NAME}}'] || '');
  sheet.getRange('C8').setValue(replacements['{{CLIENT_LAST_NAME}}'] || '');
  sheet.getRange('C9').setValue(replacements['{{CLIENT_BIRTH_DATE}}'] || '');
  sheet.getRange('C11').setValue(replacements['{{CLIENT_STREET}}'] || '');
  sheet.getRange('C12').setValue(replacements['{{CLIENT_CITY}}'] || '');
  sheet.getRange('C13').setValue(replacements['{{CLIENT_HOUSE_NUMBER}}'] || '');
  sheet.getRange('C14').setValue(replacements['{{CLIENT_POSTAL_CODE}}'] || '');
  sheet.getRange('C15').setValue(replacements['{{CLIENT_EMAIL}}'] || '');
  sheet.getRange('C16').setValue(replacements['{{CLIENT_PHONE}}'] || '');
  sheet.getRange('C18').setValue(replacements['{{CLIENT_GENDER}}'] || '');
  sheet.getRange('C19').setValue(replacements['{{CLIENT_LABOUR_STATUS}}'] || '');
  sheet.getRange('C20').setValue(replacements['{{CLIENT_EDUCATION}}'] || '');
  sheet.getRange('C21').setValue(replacements['{{CLIENT_DISADVANTAGE}}'] || '');

  SpreadsheetApp.flush();
}

function getExistingFileByName_(folder, name) {
  var files = folder.getFilesByName(name);
  return files.hasNext() ? files.next() : null;
}

function getOrCreateFolder_(parent, name) {
  var folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

function trashExistingFiles_(folder, baseName) {
  var exact = folder.getFilesByName(baseName);
  while (exact.hasNext()) {
    exact.next().setTrashed(true);
  }
}

function writeRecordToDocument_(doc, payload) {
  var body = doc.getBody();
  var client = payload.client || {};
  var record = payload.record || {};
  var payloadData = record.payload || {};

  body.appendParagraph(record.title || 'Zaznam').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph((record.activityDate || 'Bez data') + ' | ' + (record.ka || 'Bez KA') + ' | ' + (record.worker || 'Bez pracovnika'));
  body.appendParagraph('Klient').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Jmeno: ' + (client.fullName || record.clientName || ''));
  body.appendParagraph('Interni ID: ' + (client.id || ''));
  if (client.datumNarozeni) body.appendParagraph('Datum narozeni: ' + client.datumNarozeni);
  if (client.mesto) body.appendParagraph('Obec: ' + client.mesto);

  body.appendParagraph('Strukturovana data').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  var dataRows = Object.keys(payloadData)
    .filter(function (key) {
      return payloadData[key] !== '' && payloadData[key] !== false && payloadData[key] != null;
    })
    .map(function (key) {
      return [translateFieldLabel_(key), stringify_(payloadData[key])];
    });

  if (dataRows.length) {
    body.appendTable([['Pole', 'Hodnota']].concat(dataRows));
  } else {
    body.appendParagraph('Bez strukturovanych poli.');
  }

  body.appendParagraph('Text zapisu').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(record.documentText || JSON.stringify(payloadData, null, 2) || 'Bez textu.');
}

function sanitizeName_(value) {
  return String(value || 'bez-nazvu')
    .replace(/[\\/:*?"<>|#%{}~&]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function translateFieldLabel_(key) {
  var labels = {
    currentSituation: 'Vychozi situace',
    goals: 'Cile',
    barriers: 'Bariery',
    plannedSteps: 'Planovane kroky',
    durationMinutes: 'Delka v minutach',
    consultationType: 'Typ konzultace',
    topics: 'Temata',
    outcome: 'Vyhodnoceni',
    nextSteps: 'Dalsi kroky',
    debtSummary: 'Mapovane zavazky',
    debtCauses: 'Priciny predluzeni',
    debtStage: 'Faze reseni',
    solutionPlan: 'Plan reseni',
    educationTopic: 'Edukace',
    targetJob: 'Cilova pozice',
    experience: 'Zkusenosti',
    skills: 'Dovednosti',
    workplace: 'Pracoviste',
    progressSummary: 'Pokrok'
  };
  return labels[key] || key;
}

function stringify_(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function buildFolderUrl_(folderId) {
  return 'https://drive.google.com/drive/folders/' + folderId;
}

function formatCzechDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Europe/Prague', 'd.M.yyyy');
}

function escapeForRegex_(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
