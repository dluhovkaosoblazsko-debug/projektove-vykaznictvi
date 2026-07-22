import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../google-drive-upload.apps-script.js', import.meta.url), 'utf8');
const context = vm.createContext({
  Utilities: { formatDate: () => '2026-07-22-153045' },
  Session: { getScriptTimeZone: () => 'Europe/Prague' }
});
vm.runInContext(source, context);

test('Google dokument se v ZIP záloze exportuje jako DOCX', () => {
  const spec = context.backupExportSpec_('application/vnd.google-apps.document', 'Zápis klienta');

  assert.equal(spec.exportMimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.equal(spec.fileName, 'Zápis klienta.docx');
});

test('duplicitní názvy v ZIPu dostanou číselnou příponu', () => {
  const used = {};

  assert.equal(context.uniqueBackupArchivePath_('klienti/MON list.xlsx', used), 'klienti/MON list.xlsx');
  assert.equal(context.uniqueBackupArchivePath_('klienti/MON list.xlsx', used), 'klienti/MON list-2.xlsx');
  assert.equal(context.uniqueBackupArchivePath_('klienti/MON LIST.xlsx', used), 'klienti/MON LIST-3.xlsx');
});

test('název ZIP zálohy obsahuje projekt a jednoznačný čas', () => {
  assert.equal(
    context.buildBackupFileName_(new Date()),
    'kompletni-zaloha-osoblazsko-2026-07-22-153045.zip'
  );
});

test('záloha zahrnuje obě projektové složky a manifest', () => {
  assert.match(source, /collectFolderForBackup_\(clientBundleRoot, 'klientske-slozky'/);
  assert.match(source, /collectFolderForBackup_\(recordsRoot, 'generovane-zapisy'/);
  assert.match(source, /'manifest\.json'/);
});

test('manifest Apps Scriptu povoluje správu časových triggerů', () => {
  const manifest = JSON.parse(readFileSync(new URL('../appsscript.json', import.meta.url), 'utf8'));

  assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/script.scriptapp'));
});

