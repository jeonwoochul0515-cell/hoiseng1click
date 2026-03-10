import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import type { Env } from './types';

export async function generateDocx(
  templateName: string,
  data: Record<string, unknown>,
  env: Env
): Promise<Uint8Array> {
  const obj = await env.DOCS_BUCKET.get(`templates/docx/${templateName}.docx`);
  if (!obj) throw new Error(`템플릿 없음: ${templateName}.docx`);
  const buf = await obj.arrayBuffer();

  const zip = new PizZip(buf);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  });

  doc.render(data);
  return doc.getZip().generate({ type: 'uint8array' });
}

export async function saveToR2(
  buffer: Uint8Array,
  path: string,
  env: Env
): Promise<string> {
  await env.DOCS_BUCKET.put(path, buffer, {
    httpMetadata: {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  });
  return path;
}
