const RECORDS_ROOT_FOLDER_NAME = 'Projektove vykaznictvi - klienti';
const CLIENT_BUNDLE_ROOT_FOLDER_NAMES = ['PRACOVKO SLOŽKY', 'PRACOVKO SLOZKY', 'Pracovko slozky'];
const PROJECT_NAME = 'Řešení zaměstnanosti a zaměstnatelnosti osob na Osoblažsku 2026+';
const PROJECT_CODE = 'CZ.03.01.01/00/25_086/0006246';
const BENEFICIARY_NAME = 'Osoblažský cech, z.ú.';
const CLIENT_TEMPLATE_IDS = {
  contract: '1h3SKaa_VsEWMSLfBFnKEadpjn0GJmX23iynNgZ3cY5k',
  consent: '1D0uHwNWSFLYeQeR6oz5hOI1Pv7XoLAer5AqEX78T98M'
};
const MONITORING_TEMPLATE_FILE_ID = '1HCtpMxVuOHy0eQFphmBCHmHan_MKTn-GRCnBD7O9loI';

function authorizeRequiredServices() {
  const rootFolder = getOrCreateFolder_(DriveApp.getRootFolder(), RECORDS_ROOT_FOLDER_NAME);
  const testDoc = DocumentApp.create('TEST autorizace - Projektove vykaznictvi');
  testDoc.getBody().appendParagraph('Test opravneni pro automaticke ukladani zapisu.');
  testDoc.saveAndClose();

  const file = DriveApp.getFileById(testDoc.getId());
  file.moveTo(rootFolder);
  file.setTrashed(true);

  return 'Opravneni jsou pripravena.';
}

function doPost(e) {
  let clientFolder = null;
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    const client = payload.client || {};

    if (!client.id || !client.fullName) {
      throw new Error('Chybi klient nebo interni ID klienta.');
    }

    if (payload.action === 'provisionClientFolder') {
      const provisioned = provisionClientFolder_(client);
      return json_({
        ok: true,
        action: 'provisionClientFolder',
        result: provisioned
      });
    }

    const record = payload.record || {};
    const rootFolder = getOrCreateFolder_(DriveApp.getRootFolder(), RECORDS_ROOT_FOLDER_NAME);
    const clientFolderName = sanitizeName_(`${client.fullName} - ${client.id}`);
    clientFolder = getOrCreateFolder_(rootFolder, clientFolderName);

    const documentName = sanitizeName_(record.filename || record.title || 'zaznam');
    trashExistingFiles_(clientFolder, documentName);

    const doc = DocumentApp.create(documentName);
    writeRecordToDocument_(doc, payload);
    doc.saveAndClose();

    const file = DriveApp.getFileById(doc.getId());
    file.moveTo(clientFolder);
    file.setDescription(
      JSON.stringify(
        {
          clientId: client.id,
          recordId: record.id || '',
          ka: record.ka || '',
          entityType: record.entityType || '',
          activityDate: record.activityDate || ''
        },
        null,
        2
      )
    );

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
        sanitizeName_(`CHYBA uploadu - ${new Date().toISOString()}.txt`),
        error.stack || error.message || String(error),
        MimeType.PLAIN_TEXT
      );
    }
    return json_({
      ok: false,
      error: error.message || String(error)
    });
  }
}

function provisionClientFolder_(client) {
  const rootFolder = getClientBundleRootFolder_();
  const clientFolderName = sanitizeName_(`${client.id} - ${client.fullName}`);
  const clientFolder = getOrCreateFolder_(rootFolder, clientFolderName);
  const replacements = buildClientTemplateReplacements_(client);

  const contract = copyAndFillGoogleDocTemplate_(
    CLIENT_TEMPLATE_IDS.contract,
    clientFolder,
    sanitizeName_(`Smlouva - ${client.fullName}`),
    replacements
  );
  const consent = copyAndFillGoogleDocTemplate_(
    CLIENT_TEMPLATE_IDS.consent,
    clientFolder,
    sanitizeName_(`Souhlas se zpracováním osobních údajů - ${client.fullName}`),
    replacements
  );
  const monList = copyMonitoringTemplate_(clientFolder, sanitizeName_(`MON list - ${client.fullName}`), replacements);

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
  const address = [client.ulice, client.cisloPopisne].filter(Boolean).join(' ').trim();
  const addressLine = [address, client.psc, client.mesto].filter(Boolean).join(', ');
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

function copyAndFillGoogleDocTemplate_(templateId, targetFolder, targetName, replacements) {
  trashExistingFiles_(targetFolder, targetName);
  const copy = DriveApp.getFileById(templateId).makeCopy(targetName, targetFolder);
  const document = DocumentApp.openById(copy.getId());
  const body = document.getBody();

  Object.keys(replacements).forEach((placeholder) => {
    body.replaceText(escapeForRegex_(placeholder), replacements[placeholder] || '');
  });

  document.saveAndClose();
  copy.setDescription(
    JSON.stringify(
      {
        projectName: PROJECT_NAME,
        projectCode: PROJECT_CODE,
        generatedFromTemplateId: templateId
      },
      null,
      2
    )
  );
  return copy;
}

function copyMonitoringTemplate_(targetFolder, targetName, replacements) {
  trashExistingFiles_(targetFolder, targetName);
  const template = DriveApp.getFileById(MONITORING_TEMPLATE_FILE_ID);
  const copy = template.makeCopy(targetName, targetFolder);
  fillSpreadsheetTemplate_(copy.getId(), replacements || {});
  return copy;
}

function fillSpreadsheetTemplate_(spreadsheetId, replacements) {
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const primarySheet = findMonitoringSheet_(spreadsheet) || spreadsheet.getSheets()[0];

  if (primarySheet) {
    const directValues = {
      C3: PROJECT_CODE,
      C4: PROJECT_NAME,
      C5: BENEFICIARY_NAME,
      C7: replacements['{{CLIENT_FIRST_NAME}}'] || '',
      C8: replacements['{{CLIENT_LAST_NAME}}'] || '',
      C9: replacements['{{CLIENT_BIRTH_DATE}}'] || '',
      C11: replacements['{{CLIENT_STREET}}'] || '',
      C12: replacements['{{CLIENT_CITY}}'] || '',
      C13: replacements['{{CLIENT_HOUSE_NUMBER}}'] || '',
      C14: replacements['{{CLIENT_POSTAL_CODE}}'] || '',
      C15: replacements['{{CLIENT_EMAIL}}'] || '',
      C16: replacements['{{CLIENT_PHONE}}'] || '',
      C18: replacements['{{CLIENT_GENDER}}'] || '',
      C19: replacements['{{CLIENT_LABOUR_STATUS}}'] || '',
      C20: replacements['{{CLIENT_EDUCATION}}'] || '',
      C21: replacements['{{CLIENT_DISADVANTAGE}}'] || ''
    };

    Object.keys(directValues).forEach((cell) => {
      primarySheet.getRange(cell).setValue(directValues[cell]);
    });
    SpreadsheetApp.flush();
  }

  spreadsheet.getSheets().forEach((sheet) => {
    Object.keys(replacements).forEach((placeholder) => {
      const replacement = replacements[placeholder] || '';
      sheet.createTextFinder(placeholder).matchCase(true).replaceAllWith(replacement);
    });
  });
}

function getClientBundleRootFolder_() {
  const root = DriveApp.getRootFolder();
  for (let index = 0; index < CLIENT_BUNDLE_ROOT_FOLDER_NAMES.length; index += 1) {
    const name = CLIENT_BUNDLE_ROOT_FOLDER_NAMES[index];
    const folders = root.getFoldersByName(name);
    if (folders.hasNext()) return folders.next();
  }
  return root.createFolder(CLIENT_BUNDLE_ROOT_FOLDER_NAMES[0]);
}

function findMonitoringSheet_(spreadsheet) {
  const sheets = spreadsheet.getSheets();
  for (let index = 0; index < sheets.length; index += 1) {
    const sheet = sheets[index];
    const header = String(sheet.getRange('B1').getDisplayValue() || '').toLowerCase();
    if (header.includes('monitorovaci list') || header.includes('monitorovací list')) {
      return sheet;
    }
  }
  return null;
}

function getOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

function trashExistingFiles_(folder, baseName) {
  const exact = folder.getFilesByName(baseName);
  while (exact.hasNext()) {
    exact.next().setTrashed(true);
  }
}

function writeRecordToDocument_(doc, payload) {
  const body = doc.getBody();

  const client = payload.client || {};
  const record = payload.record || {};
  const payloadData = record.payload || {};

  body.appendParagraph(record.title || 'Záznam').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(`${record.activityDate || 'Bez data'} | ${record.ka || 'Bez KA'} | ${record.worker || 'Bez pracovníka'}`);

  body.appendParagraph('Klient').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(`Jméno: ${client.fullName || record.clientName || ''}`);
  body.appendParagraph(`Interní ID: ${client.id || ''}`);
  if (client.datumNarozeni) body.appendParagraph(`Datum narození: ${client.datumNarozeni}`);
  if (client.mesto) body.appendParagraph(`Obec: ${client.mesto}`);

  body.appendParagraph('Strukturovaná data').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  const dataRows = Object.keys(payloadData)
    .filter((key) => payloadData[key] !== '' && payloadData[key] !== false && payloadData[key] != null)
    .map((key) => [translateFieldLabel_(key), stringify_(payloadData[key])]);

  if (dataRows.length) {
    body.appendTable([['Pole', 'Hodnota']].concat(dataRows));
  } else {
    body.appendParagraph('Bez strukturovaných polí.');
  }

  body.appendParagraph('Text zápisu').setHeading(DocumentApp.ParagraphHeading.HEADING2);
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
  const labels = {
    currentSituation: 'Výchozí situace',
    goals: 'Cíle',
    barriers: 'Bariéry',
    plannedSteps: 'Plánované kroky',
    durationMinutes: 'Délka v minutách',
    consultationType: 'Typ konzultace',
    topics: 'Témata',
    outcome: 'Vyhodnocení',
    nextSteps: 'Další kroky',
    debtSummary: 'Mapované závazky',
    debtCauses: 'Příčiny předlužení',
    debtStage: 'Fáze řešení',
    solutionPlan: 'Plán řešení',
    educationTopic: 'Edukace',
    targetJob: 'Cílová pozice',
    experience: 'Zkušenosti',
    skills: 'Dovednosti',
    workplace: 'Pracoviště',
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
  return `https://drive.google.com/drive/folders/${folderId}`;
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
