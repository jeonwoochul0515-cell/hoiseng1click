import type { Env } from './types';

export async function generateHwpx(
  templateName: string,
  data: Record<string, unknown>,
  env: Env
): Promise<Uint8Array> {
  const obj = await env.DOCS_BUCKET.get(`templates/hwpx/${templateName}.hwpx`);
  if (!obj) throw new Error(`HWPX 템플릿 없음: ${templateName}`);
  const buf = await obj.arrayBuffer();

  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buf);

  const sectionFile = zip.file('Contents/section0.xml');
  if (!sectionFile) throw new Error('section0.xml not found in HWPX');
  let xml = await sectionFile.async('string');

  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string' || typeof val === 'number') {
      xml = xml.replaceAll(`{{${key}}}`, String(val));
    }
  }

  xml = expandRepeat(xml, 'debts', (data.debts as unknown[]) ?? []);
  xml = expandRepeat(xml, 'assets', (data.assets as unknown[]) ?? []);

  zip.file('Contents/section0.xml', xml);
  return await zip.generateAsync({ type: 'uint8array' });
}

function expandRepeat(xml: string, key: string, rows: unknown[]): string {
  const startTag = `<!--REPEAT:${key}-->`;
  const endTag = `<!--/REPEAT:${key}-->`;
  const start = xml.indexOf(startTag);
  const end = xml.indexOf(endTag);
  if (start === -1 || end === -1) return xml;

  const rowTemplate = xml.slice(start + startTag.length, end);
  const expanded = rows.map(row => {
    let r = rowTemplate;
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      r = r.replaceAll(`{{${k}}}`, String(v ?? ''));
    }
    return r;
  }).join('');

  return xml.slice(0, start) + expanded + xml.slice(end + endTag.length);
}
