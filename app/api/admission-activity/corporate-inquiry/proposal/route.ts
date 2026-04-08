import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/api-auth';
import JSZip from 'jszip';
import { promises as fs } from 'fs';
import path from 'path';

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function replaceFirst(source: string, from: string, to: string): string {
  const idx = source.indexOf(from);
  if (idx < 0) return source;
  return source.slice(0, idx) + to + source.slice(idx + from.length);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, 'corporate_inquiry.update');
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const proposalRefNo = String(body?.proposalRefNo || '').trim();
    const proposalTitle = String(body?.proposalTitle || '').trim();
    const clientName = String(body?.clientName || '').trim();
    const venue = String(body?.venue || '').trim();

    const templatePath = path.join(
      process.cwd(),
      'public',
      'F-CT-03-001-SIT Proposal To LTTS Vadodara- Heat Exchanger Design.docx'
    );

    const templateBuffer = await fs.readFile(templatePath);
    const zip = await JSZip.loadAsync(templateBuffer);

    const docEntry = zip.file('word/document.xml');
    if (!docEntry) {
      return NextResponse.json({ error: 'Template document.xml not found' }, { status: 500 });
    }

    let xml = await docEntry.async('string');

    // Replace key template values while preserving original DOCX formatting structure.
    xml = replaceFirst(xml, 'SITPL/CT/P/04/2026-27/01', xmlEscape(proposalRefNo || 'SITPL/CT/P'));
    xml = replaceFirst(xml, 'L&amp;T Technology Services', xmlEscape(clientName || 'Client Name'));
    xml = replaceFirst(
      xml,
      'Heat Exchanger Design (Mechanical) &amp; HTRI Software for Experience Engineers',
      xmlEscape(proposalTitle || 'Corporate Training Program')
    );

    // Venue appears as city + state in template; map split values when provided.
    const [cityPart, statePartRaw] = (venue || '').split(',');
    const cityPartClean = (cityPart || '').trim();
    const statePartClean = (statePartRaw || '').trim();
    if (cityPartClean) {
      xml = replaceFirst(xml, 'Vadodara', xmlEscape(cityPartClean));
    }
    if (statePartClean) {
      xml = replaceFirst(xml, 'Gujrat', xmlEscape(statePartClean));
    }

    // Date in the source template is split across styled runs, so we avoid unsafe raw substitutions here.
    // Ref no/title/client/venue are replaced safely while preserving document formatting.

    zip.file('word/document.xml', xml);

    const out = await zip.generateAsync({ type: 'nodebuffer' });
    const fileName = `corporate-training-proposal-${Date.now()}.docx`;

    return new NextResponse(out as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate proposal document';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
