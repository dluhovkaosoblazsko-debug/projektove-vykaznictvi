import AdmZip from 'adm-zip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.env.PORT || 3000);
const distDir = resolve('dist');
const planTemplatePath = resolve('templates', 'plan_tabulka_template.docx');
const basicUser = process.env.BASIC_AUTH_USER || '';
const basicPassword = process.env.BASIC_AUTH_PASSWORD || '';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function unauthorized(response) {
  response.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Projektove vykaznictvi", charset="UTF-8"',
    'Content-Type': 'text/plain; charset=utf-8'
  });
  response.end('Prihlaseni je vyzadovano.');
}

function isAuthorized(request) {
  if (!basicUser || !basicPassword) return true;

  const header = request.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;

  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return false;

  const user = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  return user === basicUser && password === basicPassword;
}

function getSafeFilePath(urlPath) {
  const parsedPath = decodeURIComponent((urlPath || '/').split('?')[0]);
  const normalizedPath = normalize(parsedPath).replace(/^(\.\.[/\\])+/, '');
  const requestedPath = resolve(join(distDir, normalizedPath));

  if (!requestedPath.startsWith(distDir)) {
    return null;
  }

  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    return requestedPath;
  }

  return join(distDir, 'index.html');
}

function readJsonBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk.toString('utf8');
    });
    request.on('end', () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch (error) {
        rejectBody(error);
      }
    });
    request.on('error', rejectBody);
  });
}

function getNodeText(node) {
  if (!node) return '';
  return (node.textContent || '').trim();
}

function setNodeText(doc, node, value) {
  if (!node) return;
  const textNodes = Array.from(node.getElementsByTagName('w:t'));
  if (textNodes.length > 0) {
    textNodes[0].textContent = value;
    textNodes.slice(1).forEach((item) => {
      item.textContent = '';
    });
    return;
  }

  const paragraph = doc.createElement('w:p');
  const run = doc.createElement('w:r');
  const text = doc.createElement('w:t');
  text.appendChild(doc.createTextNode(value));
  run.appendChild(text);
  paragraph.appendChild(run);
  node.appendChild(paragraph);
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildWordParagraph(value, style = '') {
  const safeValue = String(value ?? '').trim();
  if (!safeValue) return '';
  const styleXml = style ?`<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
  const lines = safeValue.split(/\r?\n/).map((line) => escapeXml(line));
  const runs = lines
    .map((line, index) => `${index > 0 ?'<w:br/>' : ''}<w:t xml:space="preserve">${line}</w:t>`)
    .join('');
  return `<w:p>${styleXml}<w:r>${runs}</w:r></w:p>`;
}

function buildWordTable(rows) {
  const validRows = Array.isArray(rows) ?rows.filter((row) => row && (row.label || row.value)) : [];
  if (validRows.length === 0) return '';

  const tableRows = validRows
    .map(
      (row) => `
        <w:tr>
          <w:tc><w:tcPr><w:tcW w:w="2600" w:type="dxa"/></w:tcPr>${buildWordParagraph(row.label || '')}</w:tc>
          <w:tc><w:tcPr><w:tcW w:w="6400" w:type="dxa"/></w:tcPr>${buildWordParagraph(row.value || '')}</w:tc>
        </w:tr>`
    )
    .join('');

  return `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideV w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        </w:tblBorders>
      </w:tblPr>
      ${tableRows}
    </w:tbl>`;
}

function buildRecordDocx(payload) {
  const zip = new AdmZip();
  const title = payload.title || 'Záznam aktivity';
  const meta = [payload.activityDate, payload.ka, payload.worker].filter(Boolean).join(' | ');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${buildWordParagraph(title, 'Title')}
        ${buildWordParagraph(meta)}
        ${buildWordParagraph('Strukturovaná data', 'Heading1')}
        ${buildWordTable(payload.rows || [])}
        ${buildWordParagraph('Text zápisu', 'Heading1')}
        ${buildWordParagraph(payload.text || '')}
        <w:sectPr>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
        </w:sectPr>
      </w:body>
    </w:document>`;

  zip.addFile(
    '[Content_Types].xml',
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>`, 'utf8')
  );
  zip.addFile(
    '_rels/.rels',
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>`, 'utf8')
  );
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
  return zip.toBuffer();
}

function buildKa01AttendanceDocx(payload) {
  const title = 'KA01 - Prezencni listina akteru site';
  const dateLine = `Datum vytvoreni: ${payload.date || ''}`;
  const meetingLine = 'Schuzka dne: ........................................   Od: ....................   Do: ....................';
  const rows = Array.isArray(payload.rows) ?payload.rows : [];

  const bodyRows = rows.map((row) => {
    const order = escapeXml(row.order || '');
    const firstName = escapeXml(row.firstName || '');
    const lastName = escapeXml(row.lastName || '');
    const organization = escapeXml(row.organization || '');
    const role = escapeXml(row.role || '');

    return `
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="700" w:type="dxa"/></w:tcPr>${buildWordParagraph(order)}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/></w:tcPr>${buildWordParagraph(firstName)}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1700" w:type="dxa"/></w:tcPr>${buildWordParagraph(lastName)}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2800" w:type="dxa"/></w:tcPr>${buildWordParagraph(organization)}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr>${buildWordParagraph(role)}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1900" w:type="dxa"/></w:tcPr>${buildWordParagraph(' ')}</w:tc>
      </w:tr>`;
  }).join('');

  const tableXml = `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideV w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="700" w:type="dxa"/></w:tcPr>${buildWordParagraph('#')}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/></w:tcPr>${buildWordParagraph('Jmeno')}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1700" w:type="dxa"/></w:tcPr>${buildWordParagraph('Prijmeni')}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2800" w:type="dxa"/></w:tcPr>${buildWordParagraph('Organizace')}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr>${buildWordParagraph('Funkce v organizaci')}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1900" w:type="dxa"/></w:tcPr>${buildWordParagraph('Podpis')}</w:tc>
      </w:tr>
      ${bodyRows}
    </w:tbl>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${buildWordParagraph(title, 'Title')}
        ${buildWordParagraph(dateLine)}
        ${buildWordParagraph(meetingLine)}
        ${tableXml}
        <w:sectPr>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
        </w:sectPr>
      </w:body>
    </w:document>`;

  const zip = new AdmZip();
  zip.addFile(
    '[Content_Types].xml',
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
      </Types>`, 'utf8')
  );
  zip.addFile(
    '_rels/.rels',
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>`, 'utf8')
  );
  zip.addFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
  return zip.toBuffer();
}

function buildPlanDocx(planData) {
  if (!existsSync(planTemplatePath)) {
    throw new Error('Šablona plánu nebyla nalezena.');
  }

  const zip = new AdmZip(readFileSync(planTemplatePath));
  const entry = zip.getEntry('word/document.xml');
  if (!entry) {
    throw new Error('Soubor document.xml v šabloně nebyl nalezen.');
  }

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const xml = zip.readAsText(entry);
  const doc = parser.parseFromString(xml, 'text/xml');
  const rows = Array.from(doc.getElementsByTagName('w:tr'));
  const rowMap = {
    'Identifikace klienta': planData.clientIdentification || '',
    'Výchozí situace klienta': planData.currentSituation || '',
    'Silné stránky a zdroje klienta': planData.strengthsResources || '',
    'Identifikované bariéry vstupu na trh práce': planData.barriers || '',
    'Hlavní cíl spolupráce': planData.mainGoal || '',
    'Dílčí cíle spolupráce': planData.subGoals || '',
    'Plánované kroky podpory': planData.plannedSteps || '',
    'Zapojení dalších služeb': planData.otherServices || '',
    'Vyhodnocování a aktualizace plánu': planData.evaluationUpdates || ''
  };

  rows.forEach((row) => {
    const cells = Array.from(row.getElementsByTagName('w:tc'));
    if (cells.length < 2) return;
    const key = getNodeText(cells[0]);
    if (!Object.prototype.hasOwnProperty.call(rowMap, key)) return;
    setNodeText(doc, cells[1], rowMap[key]);
  });

  const paragraphs = Array.from(doc.getElementsByTagName('w:p'));
  paragraphs.forEach((paragraph) => {
    const text = getNodeText(paragraph);
    if (text.startsWith('Datum:')) {
      setNodeText(doc, paragraph, `Datum: ${planData.planDate || ''}`);
    }
    if (text.startsWith('Podpis pracovníka:')) {
      setNodeText(doc, paragraph, `Podpis pracovníka: ${planData.workerSignature || ''}`);
    }
  });

  zip.updateFile('word/document.xml', Buffer.from(serializer.serializeToString(doc), 'utf8'));
  return zip.toBuffer();
}

const server = createServer(async (request, response) => {
  if (!isAuthorized(request)) {
    unauthorized(response);
    return;
  }

  if (request.url?.startsWith('/api/ai/')) {
    response.writeHead(410, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({
      ok: false,
      error: 'Serverove AI endpointy jsou vypnute. Aplikace generuje texty vyhradne pres Gemini ve frontendu.'
    }));
    return;
  }

  if (request.method === 'POST' && request.url === '/api/export-plan-docx') {
    try {
      const payload = await readJsonBody(request);
      const fileBuffer = buildPlanDocx(payload);
      const safeFilename = payload.filename || 'plan-osobniho-rozvoje.docx';
      response.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Content-Length': fileBuffer.length
      });
      response.end(fileBuffer);
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: false, error: error.message || 'Export DOCX selhal.' }));
    }
    return;
  }

  if (request.method === 'POST' && request.url === '/api/export-record-docx') {
    try {
      const payload = await readJsonBody(request);
      const fileBuffer = buildRecordDocx(payload);
      const safeFilename = payload.filename || 'zaznam-aktivity.docx';
      response.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Content-Length': fileBuffer.length
      });
      response.end(fileBuffer);
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: false, error: error.message || 'Export DOCX selhal.' }));
    }
    return;
  }

  if (request.method === 'POST' && request.url === '/api/export-ka01-attendance-docx') {
    try {
      const payload = await readJsonBody(request);
      const fileBuffer = buildKa01AttendanceDocx(payload);
      const safeFilename = payload.filename || 'prezencni-listina.docx';
      response.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Content-Length': fileBuffer.length
      });
      response.end(fileBuffer);
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: false, error: error.message || 'Export DOCX selhal.' }));
    }
    return;
  }

  const filePath = getSafeFilePath(request.url);
  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Soubor nenalezen.');
    return;
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable'
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  console.log(`Projektove vykaznictvi bezi na portu ${port}. AI generovani probiha vyhradne ve frontendu pres Gemini.`);
});
