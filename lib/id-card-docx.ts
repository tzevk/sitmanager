import fs from 'node:fs';
import path from 'node:path';
import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, VerticalAlign,
} from 'docx';

export interface IdCardInput {
  name: string;
  course: string;
  batchNo: string;
  contactNo: string;
  validUpto: string;
  /** data URL (data:image/...;base64,xxxx) or null */
  photo?: string | null;
}

const ORG = {
  title: 'SUVIDYA INSTITUTE OF TECHNOLOGY',
  addr1: '18/140, Anand Nagar, Nehru Road, Vakola,',
  addr2: 'Santacruz (E) , Mumbai - 400 055.',
  phone: 'Phone : (022) 26682290, 09821569885',
  email: 'E-mail : enquiry@suvidya.ac.in',
  website: 'Website : www.suvidya.ac.in',
};

const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function decodeDataUrl(dataUrl?: string | null): { data: Buffer; type: 'png' | 'jpg' } | null {
  if (!dataUrl) return null;
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const type = match[1].toLowerCase().startsWith('jp') ? 'jpg' : 'png';
  try {
    return { data: Buffer.from(match[2], 'base64'), type };
  } catch {
    return null;
  }
}

function loadLogo(): { data: Buffer; type: 'png' } | null {
  try {
    const file = path.join(process.cwd(), 'public', 'sit.png');
    return { data: fs.readFileSync(file), type: 'png' };
  } catch {
    return null;
  }
}

/** Bold label + underlined value, on one line — mirrors the printed card. */
function detailLine(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 90 },
    children: [
      new TextRun({ text: `${label}  `, bold: true, size: 20 }),
      new TextRun({ text: value || '________________', underline: {}, size: 20 }),
    ],
  });
}

function headerCell(logo: ReturnType<typeof loadLogo>): TableCell {
  const logoChildren = logo
    ? [new Paragraph({ children: [new ImageRun({ type: logo.type, data: logo.data, transformation: { width: 70, height: 60 } })] })]
    : [new Paragraph({ children: [new TextRun({ text: 'SIT', bold: true, size: 36, color: '2E3093' })] })];

  return new TableCell({
    width: { size: 22, type: WidthType.PERCENTAGE },
    borders: NO_BORDER,
    verticalAlign: VerticalAlign.CENTER,
    children: logoChildren,
  });
}

function buildCardTable(card: IdCardInput, logo: ReturnType<typeof loadLogo>): Table {
  const photo = decodeDataUrl(card.photo);

  // Right side: header band (logo + org), then body (photo + details), then footer.
  const headerBand = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDER,
    rows: [
      new TableRow({
        children: [
          headerCell(logo),
          new TableCell({
            width: { size: 78, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({ children: [new TextRun({ text: ORG.title, bold: true, size: 20 })] }),
              new Paragraph({ children: [new TextRun({ text: ORG.addr1, bold: true, size: 16 })] }),
              new Paragraph({ children: [new TextRun({ text: ORG.addr2, bold: true, size: 16 })] }),
              new Paragraph({ children: [new TextRun({ text: ORG.phone, bold: true, size: 16 })] }),
            ],
          }),
        ],
      }),
    ],
  });

  const photoParagraph = photo
    ? new Paragraph({ children: [new ImageRun({ type: photo.type, data: photo.data, transformation: { width: 95, height: 115 } })] })
    : new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '[ Photo ]', color: '999999', size: 18 })],
      });

  const bodyBand = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            children: [photoParagraph],
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: NO_BORDER,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              detailLine('Name', card.name),
              detailLine('Course', card.course),
              detailLine('Batch No.', card.batchNo),
              detailLine('Contact No', card.contactNo),
              detailLine('Valid Upto', card.validUpto),
            ],
          }),
        ],
      }),
    ],
  });

  const footer = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120 },
    children: [new TextRun({ text: `${ORG.email}   ${ORG.website}`, size: 16 })],
  });

  const singleBorder = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  const cardBorders = { top: singleBorder, bottom: singleBorder, left: singleBorder, right: singleBorder };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          // LEFT — large name
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: cardBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 200, bottom: 200, left: 150, right: 150 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: card.name || ' ', bold: true, size: 56 })],
              }),
            ],
          }),
          // RIGHT — card details
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: cardBorders,
            margins: { top: 120, bottom: 120, left: 150, right: 150 },
            children: [headerBand, new Paragraph({ text: '' }), bodyBand, footer],
          }),
        ],
      }),
    ],
  });
}

export async function buildIdCardsDocx(cards: IdCardInput[]): Promise<Buffer> {
  const logo = loadLogo();
  const children: (Table | Paragraph)[] = [];

  cards.forEach((card, i) => {
    children.push(buildCardTable(card, logo));
    // Spacer between cards; page break every 3 cards keeps the layout tidy.
    children.push(new Paragraph({ text: '' }));
    if ((i + 1) % 3 === 0 && i !== cards.length - 1) {
      children.push(new Paragraph({ pageBreakBefore: true }));
    }
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: children.length ? children : [new Paragraph({ text: 'No ID cards to generate.' })],
    }],
  });

  return Packer.toBuffer(doc);
}
