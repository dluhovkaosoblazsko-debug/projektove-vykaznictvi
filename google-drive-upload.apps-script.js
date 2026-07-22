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
const BACKUP_FOLDER_NAME = 'Zálohy - Projektové výkaznictví Osoblažsko';
const BACKUP_RETENTION_COUNT = 12;
const BACKUP_STATUS_PROPERTY = 'FULL_BACKUP_STATUS_V1';
const BACKUP_QUEUED_HANDLER = 'runQueuedFullBackup';
const BACKUP_WEEKLY_HANDLER = 'runScheduledFullBackup';

function authorizeRequiredServices() {
  authorizeBackupTriggers();
  const rootFolder = getOrCreateFolder_(DriveApp.getRootFolder(), RECORDS_ROOT_FOLDER_NAME);
  const testDoc = DocumentApp.create('TEST autorizace - Projektove vykaznictvi');
  testDoc.getBody().appendParagraph('Test opravneni pro automaticke ukladani zapisu.');
  testDoc.saveAndClose();

  const file = DriveApp.getFileById(testDoc.getId());
  file.moveTo(rootFolder);
  file.setTrashed(true);

  return 'Opravneni jsou pripravena.';
}

function authorizeBackupTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log('Oprávnění pro automatické zálohy je aktivní. Počet triggerů: ' + triggers.length);
  return triggers.length;
}

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || '');
    if (action === 'getBackupStatus') return json_({ ok: true, backup: getBackupStatus_() });
    return json_({ ok: true, service: 'Projektové výkaznictví - Google Drive' });
  } catch (error) {
    return json_({ ok: false, error: error.message || String(error) });
  }
}

function doPost(e) {
  let clientFolder = null;
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    const client = payload.client || {};

    if (payload.action === 'startFullBackup') {
      return json_({ ok: true, backup: queueFullBackup_() });
    }

    if (payload.action === 'installWeeklyBackup') {
      return json_({ ok: true, backup: installWeeklyBackupTrigger_() });
    }

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

function queueFullBackup_() {
  const current = readBackupStatus_();
  if (current.state === 'queued' || current.state === 'running') return current;

  deleteTriggersByHandler_(BACKUP_QUEUED_HANDLER);
  const status = {
    state: 'queued',
    source: 'manual',
    requestedAt: new Date().toISOString(),
    message: 'Záloha čeká na spuštění.'
  };
  writeBackupStatus_(status);
  if (!hasTrigger_(BACKUP_WEEKLY_HANDLER)) installWeeklyBackupTrigger_();
  ScriptApp.newTrigger(BACKUP_QUEUED_HANDLER).timeBased().after(1000).create();
  return Object.assign({}, status, { weeklyEnabled: hasTrigger_(BACKUP_WEEKLY_HANDLER) });
}

function runQueuedFullBackup() {
  deleteTriggersByHandler_(BACKUP_QUEUED_HANDLER);
  runFullBackupJob_('manual');
}

function runScheduledFullBackup() {
  runFullBackupJob_('scheduled');
}

function runFullBackupJob_(source) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  const startedAt = new Date();
  try {
    writeBackupStatus_({
      state: 'running',
      source: source || 'manual',
      startedAt: startedAt.toISOString(),
      message: 'Probíhá export klientských složek a dokumentů z Google Drive.'
    });
    const result = createFullBackup_();
    writeBackupStatus_(Object.assign({
      state: 'success',
      source: source || 'manual',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      message: 'Kompletní ZIP záloha Google Drive byla vytvořena.'
    }, result));
  } catch (error) {
    writeBackupStatus_({
      state: 'error',
      source: source || 'manual',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      message: String(error && error.message || error)
    });
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function createFullBackup_() {
  const generatedAt = new Date();
  const zipName = buildBackupFileName_(generatedAt);
  const blobs = [];
  const usedArchivePaths = {};
  const manifest = {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    projectName: PROJECT_NAME,
    projectCode: PROJECT_CODE,
    beneficiaryName: BENEFICIARY_NAME,
    sourceFolders: [],
    files: [],
    errors: []
  };

  const clientBundleRoot = getClientBundleRootFolder_();
  manifest.sourceFolders.push({ id: clientBundleRoot.getId(), name: clientBundleRoot.getName(), archivePath: 'klientske-slozky' });
  collectFolderForBackup_(clientBundleRoot, 'klientske-slozky', blobs, manifest, usedArchivePaths);

  const recordsRoot = getOrCreateFolder_(DriveApp.getRootFolder(), RECORDS_ROOT_FOLDER_NAME);
  if (recordsRoot.getId() !== clientBundleRoot.getId()) {
    manifest.sourceFolders.push({ id: recordsRoot.getId(), name: recordsRoot.getName(), archivePath: 'generovane-zapisy' });
    collectFolderForBackup_(recordsRoot, 'generovane-zapisy', blobs, manifest, usedArchivePaths);
  }

  manifest.fileCount = manifest.files.length;
  manifest.errorCount = manifest.errors.length;
  blobs.push(Utilities.newBlob(JSON.stringify(manifest, null, 2), 'application/json', 'manifest.json'));

  if (manifest.errors.length) {
    throw new Error('Záloha nebyla vytvořena kompletně. Počet chyb při exportu: ' + manifest.errors.length + '.');
  }

  const zipBlob = Utilities.zip(blobs, zipName);
  const backupFolder = getBackupFolder_();
  const backupFile = backupFolder.createFile(zipBlob);
  backupFile.setDescription(JSON.stringify({
    projectName: PROJECT_NAME,
    projectCode: PROJECT_CODE,
    generatedAt: generatedAt.toISOString(),
    fileCount: manifest.fileCount
  }));
  pruneOldBackups_(backupFolder, backupFile.getId());

  return {
    fileId: backupFile.getId(),
    fileName: backupFile.getName(),
    fileUrl: backupFile.getUrl(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + backupFile.getId(),
    fileCount: manifest.fileCount,
    errorCount: 0
  };
}

function collectFolderForBackup_(folder, path, blobs, manifest, usedArchivePaths) {
  const files = folder.getFiles();
  while (files.hasNext()) addFileToBackup_(files.next(), path, blobs, manifest, usedArchivePaths);

  const folders = folder.getFolders();
  while (folders.hasNext()) {
    const child = folders.next();
    collectFolderForBackup_(child, path + '/' + sanitizeBackupPathPart_(child.getName()), blobs, manifest, usedArchivePaths);
  }
}

function addFileToBackup_(file, path, blobs, manifest, usedArchivePaths) {
  const originalName = file.getName();
  try {
    const spec = backupExportSpec_(file.getMimeType(), originalName);
    const blob = spec.exportMimeType
      ? exportGoogleFileBlob_(file.getId(), spec.exportMimeType)
      : file.getBlob();
    const requestedName = path + '/' + spec.fileName;
    const targetName = uniqueBackupArchivePath_(requestedName, usedArchivePaths || {});
    blob.setName(targetName);
    blobs.push(blob);
    manifest.files.push({
      id: file.getId(),
      sourceName: originalName,
      archivePath: targetName,
      sourceMimeType: file.getMimeType(),
      exportedMimeType: spec.exportMimeType || file.getMimeType(),
      updatedAt: file.getLastUpdated().toISOString()
    });
  } catch (error) {
    manifest.errors.push({
      id: file.getId(),
      name: originalName,
      path: path,
      error: String(error && error.message || error)
    });
  }
}

function uniqueBackupArchivePath_(requestedPath, usedArchivePaths) {
  const used = usedArchivePaths || {};
  const normalizedPath = String(requestedPath || 'soubor').toLowerCase();
  if (!used[normalizedPath]) {
    used[normalizedPath] = true;
    return requestedPath;
  }

  const slashIndex = requestedPath.lastIndexOf('/');
  const dotIndex = requestedPath.lastIndexOf('.');
  const hasExtension = dotIndex > slashIndex + 1;
  const base = hasExtension ? requestedPath.slice(0, dotIndex) : requestedPath;
  const extension = hasExtension ? requestedPath.slice(dotIndex) : '';
  let suffix = 2;
  let candidate;
  do {
    candidate = base + '-' + suffix + extension;
    suffix += 1;
  } while (used[candidate.toLowerCase()]);
  used[candidate.toLowerCase()] = true;
  return candidate;
}

function backupExportSpec_(mimeType, originalName) {
  const nativeExports = {
    'application/vnd.google-apps.document': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
    'application/vnd.google-apps.spreadsheet': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'],
    'application/vnd.google-apps.presentation': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', '.pptx'],
    'application/vnd.google-apps.drawing': ['application/pdf', '.pdf']
  };
  const exportInfo = nativeExports[mimeType];
  const safeName = sanitizeBackupPathPart_(originalName || 'soubor');
  if (!exportInfo) return { exportMimeType: '', fileName: safeName };
  const extension = exportInfo[1];
  return {
    exportMimeType: exportInfo[0],
    fileName: safeName.toLowerCase().endsWith(extension) ? safeName : safeName + extension
  };
}

function exportGoogleFileBlob_(fileId, mimeType) {
  const url = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '/export?mimeType=' + encodeURIComponent(mimeType);
  const response = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) throw new Error('Export z Google Drive selhal se stavem ' + status + '.');
  return response.getBlob();
}

function getBackupFolder_() {
  return getOrCreateFolder_(DriveApp.getRootFolder(), BACKUP_FOLDER_NAME);
}

function pruneOldBackups_(folder, keepFileId) {
  const backups = [];
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName().indexOf('kompletni-zaloha-osoblazsko-') === 0) backups.push(file);
  }
  backups.sort(function(left, right) { return right.getDateCreated().getTime() - left.getDateCreated().getTime(); });
  backups.slice(Math.max(Number(BACKUP_RETENTION_COUNT) || 12, 1)).forEach(function(file) {
    if (file.getId() !== keepFileId) file.setTrashed(true);
  });
}

function installWeeklyBackupTrigger_() {
  deleteTriggersByHandler_(BACKUP_WEEKLY_HANDLER);
  ScriptApp.newTrigger(BACKUP_WEEKLY_HANDLER)
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(2)
    .create();
  return getBackupStatus_();
}

function getBackupStatus_() {
  const status = readBackupStatus_();
  try {
    status.weeklyEnabled = hasTrigger_(BACKUP_WEEKLY_HANDLER);
  } catch (error) {
    if (!isTriggerAuthorizationError_(error)) throw error;
    status.weeklyEnabled = false;
    status.authorizationRequired = true;
    status.state = 'authorization_required';
    status.message = 'Automatické zálohy čekají na jednorázové povolení v Apps Scriptu. Spusťte funkci authorizeBackupTriggers a potvrďte oprávnění.';
  }
  status.retentionCount = Number(BACKUP_RETENTION_COUNT) || 12;
  return status;
}

function readBackupStatus_() {
  const raw = PropertiesService.getScriptProperties().getProperty(BACKUP_STATUS_PROPERTY);
  if (!raw) return { state: 'idle', message: 'Záloha zatím nebyla vytvořena.' };
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { state: 'error', message: 'Stav poslední zálohy nelze načíst.' };
  }
}

function writeBackupStatus_(status) {
  PropertiesService.getScriptProperties().setProperty(BACKUP_STATUS_PROPERTY, JSON.stringify(status || {}));
}

function hasTrigger_(handler) {
  return getProjectTriggers_().some(function(trigger) {
    return trigger.getHandlerFunction() === handler;
  });
}

function deleteTriggersByHandler_(handler) {
  getProjectTriggers_().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === handler) ScriptApp.deleteTrigger(trigger);
  });
}

function getProjectTriggers_() {
  try {
    return ScriptApp.getProjectTriggers();
  } catch (error) {
    if (isTriggerAuthorizationError_(error)) {
      throw new Error('[TRIGGER_AUTH_REQUIRED] Nejdříve v editoru Apps Scriptu spusťte funkci authorizeBackupTriggers a potvrďte požadovaná oprávnění.');
    }
    throw error;
  }
}

function isTriggerAuthorizationError_(error) {
  const message = String(error && (error.message || error));
  return message.indexOf('[TRIGGER_AUTH_REQUIRED]') !== -1
    || message.indexOf('ScriptApp.getProjectTriggers') !== -1
    || message.indexOf('script.scriptapp') !== -1;
}

function buildBackupFileName_(date) {
  return 'kompletni-zaloha-osoblazsko-' + Utilities.formatDate(date || new Date(), Session.getScriptTimeZone() || 'Europe/Prague', 'yyyy-MM-dd-HHmmss') + '.zip';
}

function sanitizeBackupPathPart_(value) {
  return sanitizeName_(value).replace(/\.+$/g, '').slice(0, 180) || 'soubor';
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
