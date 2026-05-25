import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
workbook.creator = 'GitHub Copilot';
workbook.lastModifiedBy = 'GitHub Copilot';
workbook.created = new Date();
workbook.modified = new Date();

const calendarPage = workbook.addWorksheet('Calendar Page', {
  views: [{ state: 'frozen', xSplit: 6, ySplit: 3 }],
});
const plannerPage = workbook.addWorksheet('Planner Page', {
  views: [{ state: 'frozen', xSplit: 6, ySplit: 3 }],
});
const referenceSheet = workbook.addWorksheet('Reference', {
  views: [{ state: 'frozen', ySplit: 1 }],
});
const schemaSheet = workbook.addWorksheet('Database Schema', {
  views: [{ state: 'frozen', ySplit: 1 }],
});

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const statusOptions = ['Not Started', 'Planned', 'Shot', 'Edited', 'Approved', 'Posted'];
const platformOptions = ['Instagram', 'Facebook', 'YouTube', 'LinkedIn', 'Twitter/X', 'WhatsApp', 'Website', 'Email', 'Other'];
const contentTypeOptions = ['Reel', 'Story', 'Post', 'Video', 'Carousel', 'Blog', 'Campaign', 'Other'];
const typeConfig = {
  Reel: { color: 'FF4C1D95', bg: 'FFC4B5FD' },
  Story: { color: 'FF1E3A8A', bg: 'FF93C5FD' },
  Post: { color: 'FF064E3B', bg: 'FF6EE7B7' },
  Video: { color: 'FF7C2D12', bg: 'FFFDBA74' },
  Carousel: { color: 'FF831843', bg: 'FFF9A8D4' },
  Blog: { color: 'FF042F2E', bg: 'FF5EEAD4' },
  Campaign: { color: 'FF451A03', bg: 'FFFCD34D' },
  Other: { color: 'FF1F2937', bg: 'FFD1D5DB' },
};
const schemaHeaders = ['id', 'content_type', 'planned_date', 'execution_date', 'upload_date', 'status', 'platform', 'responsible_person', 'description', 'IsDelete', 'Date_Added', 'Date_Updated'];

const COLORS = {
  indigo: 'FF2E3093',
  bg: 'FFFBFBFD',
  panel: 'FFFFFFFF',
  panelSoft: 'FFF8FAFC',
  line: 'FFE5E7EB',
  text: 'FF1F2937',
  muted: 'FF6B7280',
  faint: 'FF9CA3AF',
  white: 'FFFFFFFF',
  gray100: 'FFF3F4F6',
  gray50: 'FFF9FAFB',
  blueText: 'FF1D4ED8',
  greenText: 'FF047857',
};

const today = new Date();
const year = today.getFullYear();
const month = today.getMonth() + 1;
const monthTitle = `${MONTH_NAMES[month - 1]} ${year}`;

function setBorder(cell, color = COLORS.line) {
  cell.border = {
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } },
  };
}

function fillCell(cell, color) {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: color },
  };
}

function styleRange(sheet, startRow, endRow, startCol, endCol, color) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      fillCell(sheet.getCell(row, col), color);
    }
  }
}

function styleSheetBase(sheet) {
  sheet.properties.defaultRowHeight = 22;
  styleRange(sheet, 1, 220, 1, 24, COLORS.bg);
}

function setColumns(sheet, widths) {
  sheet.columns = widths.map((width) => ({ width }));
}

function mergeAndStyle(sheet, range, value, options = {}) {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(':')[0]);
  cell.value = value;
  if (options.font) cell.font = options.font;
  if (options.alignment) cell.alignment = options.alignment;
  if (options.fill) {
    const [start, end] = range.split(':');
    const startCell = sheet.getCell(start);
    const endCell = sheet.getCell(end);
    styleRange(sheet, startCell.row, endCell.row, startCell.col, endCell.col, options.fill);
  }
  return cell;
}

function buildToolbar(sheet, activeView) {
  styleRange(sheet, 1, 3, 1, 21, COLORS.panel);
  const title = sheet.getCell('A2');
  title.value = 'Content Calendar';
  title.font = { bold: true, size: 12, color: { argb: COLORS.text } };

  mergeAndStyle(sheet, 'H2:I2', '<', {
    fill: COLORS.panelSoft,
    font: { bold: true, size: 11, color: { argb: COLORS.muted } },
    alignment: { vertical: 'middle', horizontal: 'center' },
  });
  mergeAndStyle(sheet, 'J2:K2', monthTitle, {
    fill: COLORS.panel,
    font: { bold: true, size: 11, color: { argb: COLORS.text } },
    alignment: { vertical: 'middle', horizontal: 'center' },
  });
  mergeAndStyle(sheet, 'L2:M2', '>', {
    fill: COLORS.panelSoft,
    font: { bold: true, size: 11, color: { argb: COLORS.muted } },
    alignment: { vertical: 'middle', horizontal: 'center' },
  });
  mergeAndStyle(sheet, 'N2:O2', 'Today', {
    fill: COLORS.panel,
    font: { bold: true, size: 9, color: { argb: COLORS.muted } },
    alignment: { vertical: 'middle', horizontal: 'center' },
  });
  mergeAndStyle(sheet, 'P2:Q2', 'Calendar', {
    fill: activeView === 'calendar' ? COLORS.white : COLORS.panelSoft,
    font: { bold: true, size: 9, color: { argb: activeView === 'calendar' ? COLORS.indigo : COLORS.muted } },
    alignment: { vertical: 'middle', horizontal: 'center' },
  });
  mergeAndStyle(sheet, 'R2:S2', 'Planner', {
    fill: activeView === 'planner' ? COLORS.white : COLORS.panelSoft,
    font: { bold: true, size: 9, color: { argb: activeView === 'planner' ? COLORS.indigo : COLORS.muted } },
    alignment: { vertical: 'middle', horizontal: 'center' },
  });
  mergeAndStyle(sheet, 'T2:U2', '+ Add', {
    fill: COLORS.indigo,
    font: { bold: true, size: 9, color: { argb: COLORS.white } },
    alignment: { vertical: 'middle', horizontal: 'center' },
  });
}

function buildSidebar(sheet) {
  styleRange(sheet, 4, 40, 1, 6, COLORS.panelSoft);
  mergeAndStyle(sheet, 'A4:F4', 'Content Tracker', {
    fill: 'FFEFF2FF',
    font: { bold: true, size: 9, color: { argb: COLORS.indigo } },
    alignment: { vertical: 'middle', horizontal: 'left' },
  });

  ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col, index) => {
    const cell = sheet.getCell(`${col}6`);
    if (index === 0) cell.value = 'Total';
    if (index === 3) cell.value = { formula: 'SUM(D9:D16)' };
    if (index === 4) cell.value = { formula: 'SUM(E9:E16)' };
    if (index === 5) cell.value = { formula: 'SUM(F9:F16)' };
    cell.font = { bold: true, size: 9, color: { argb: COLORS.text } };
    cell.alignment = { vertical: 'middle', horizontal: index >= 3 ? 'center' : 'left' };
    fillCell(cell, COLORS.gray100);
    setBorder(cell);
  });

  ['Content Type', 'Frequency', 'Responsible', 'Tgt', 'Pln', 'Done'].forEach((label, index) => {
    const cell = sheet.getCell(7, index + 1);
    cell.value = label;
    cell.font = { bold: true, size: 9, color: { argb: COLORS.white } };
    cell.alignment = { vertical: 'middle', horizontal: index >= 3 ? 'center' : 'left' };
    fillCell(cell, COLORS.indigo);
    setBorder(cell);
  });

  contentTypeOptions.forEach((type, index) => {
    const rowNumber = index + 9;
    const config = typeConfig[type];
    for (let col = 1; col <= 6; col += 1) {
      const cell = sheet.getCell(rowNumber, col);
      fillCell(cell, rowNumber % 2 === 0 ? COLORS.gray50 : COLORS.white);
      setBorder(cell);
      cell.alignment = { vertical: 'middle', horizontal: col >= 4 ? 'center' : 'left' };
      cell.font = { size: 9, color: { argb: COLORS.text } };
    }
    sheet.getCell(`A${rowNumber}`).value = type;
    sheet.getCell(`A${rowNumber}`).font = { bold: true, size: 9, color: { argb: config.color } };
    sheet.getCell(`A${rowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: config.bg } };
    sheet.getCell(`E${rowNumber}`).value = { formula: `COUNTIF('Planner Page'!I$7:I$206,A${rowNumber})` };
    sheet.getCell(`E${rowNumber}`).font = { bold: true, size: 9, color: { argb: COLORS.blueText } };
    sheet.getCell(`F${rowNumber}`).value = { formula: `COUNTIFS('Planner Page'!I$7:I$206,A${rowNumber},'Planner Page'!L$7:L$206,"Approved")+COUNTIFS('Planner Page'!I$7:I$206,A${rowNumber},'Planner Page'!L$7:L$206,"Posted")` };
    sheet.getCell(`F${rowNumber}`).font = { bold: true, size: 9, color: { argb: COLORS.greenText } };
  });
}

function buildCalDays(targetYear, targetMonth) {
  const first = new Date(targetYear, targetMonth - 1, 1);
  const last = new Date(targetYear, targetMonth, 0);
  const days = [];
  for (let i = first.getDay() - 1; i >= 0; i -= 1) days.push(new Date(targetYear, targetMonth - 1, -i));
  for (let day = 1; day <= last.getDate(); day += 1) days.push(new Date(targetYear, targetMonth - 1, day));
  const pad = (7 - (days.length % 7)) % 7;
  for (let day = 1; day <= pad; day += 1) days.push(new Date(targetYear, targetMonth, day));
  return days;
}

function isSameDate(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function buildCalendarPage(sheet) {
  styleSheetBase(sheet);
  setColumns(sheet, [16, 11, 12, 8, 8, 8, 15, 16, 16, 16, 16, 16, 16, 16, 6, 6, 6, 6, 6, 6, 6]);
  buildToolbar(sheet, 'calendar');
  buildSidebar(sheet);

  const statBlocks = [
    ['H5:J6', 'TOTAL POSTS', 'COUNTA(I10:I209)', COLORS.text],
    ['K5:M6', 'COMPLETED', 'COUNTIF(L10:L209,"Approved")+COUNTIF(L10:L209,"Posted")', COLORS.greenText],
    ['N5:P6', 'ACTIVE', 'MAX(0,COUNTA(I10:I209)-(COUNTIF(L10:L209,"Approved")+COUNTIF(L10:L209,"Posted")))', COLORS.blueText],
  ];

  statBlocks.forEach(([range, label, formula, color]) => {
    const [start, end] = range.split(':');
    const startCell = sheet.getCell(start);
    const endCell = sheet.getCell(end);
    styleRange(sheet, startCell.row, endCell.row, startCell.col, endCell.col, COLORS.white);
    mergeAndStyle(sheet, `${start}:${String.fromCharCode(startCell.col + 64 + 2)}5`, label, {
      fill: COLORS.white,
      font: { bold: true, size: 8, color: { argb: COLORS.faint } },
      alignment: { vertical: 'middle', horizontal: 'left' },
    });
    mergeAndStyle(sheet, `${start.replace(/\d+$/, '6')}:${String.fromCharCode(startCell.col + 64 + 2)}6`, { formula }, {
      fill: COLORS.white,
      font: { bold: true, size: 16, color: { argb: color } },
      alignment: { vertical: 'middle', horizontal: 'left' },
    });
  });

  WEEKDAYS.forEach((day, index) => {
    const cell = sheet.getCell(8, 8 + index);
    cell.value = day;
    cell.font = { bold: true, size: 9, color: { argb: COLORS.faint } };
    cell.alignment = { horizontal: 'center' };
  });

  const days = buildCalDays(year, month);
  let pointer = 0;
  for (let row = 9; row <= 14; row += 1) {
    sheet.getRow(row).height = 72;
    for (let col = 8; col <= 14; col += 1) {
      const day = days[pointer++];
      const isCurrentMonth = day.getMonth() + 1 === month;
      const isToday = isSameDate(day, today);
      const cell = sheet.getCell(row, col);
      fillCell(cell, isCurrentMonth ? COLORS.white : COLORS.gray100);
      setBorder(cell);
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      cell.font = { size: 9, color: { argb: isCurrentMonth ? COLORS.text : COLORS.faint } };
      cell.value = `${day.getDate()}${isToday ? '  Today' : ''}\n\n${isCurrentMonth ? 'No posts' : '—'}`;
      if (isToday) fillCell(cell, 'FFF5F7FF');
    }
  }
}

function buildPlannerPage(sheet) {
  styleSheetBase(sheet);
  setColumns(sheet, [16, 11, 12, 8, 8, 8, 5, 6, 18, 14, 14, 14, 14, 16, 18, 22, 28, 6, 6, 6, 6]);
  buildToolbar(sheet, 'planner');
  buildSidebar(sheet);

  const headers = ['#', 'Content Type', 'Planned', 'Execution', 'Status', 'Upload', 'Platform', 'Responsible', 'Description'];
  for (let index = 0; index < headers.length; index += 1) {
    const cell = sheet.getCell(5, 8 + index);
    cell.value = headers[index];
    cell.font = { bold: true, size: 9, color: { argb: COLORS.faint } };
    cell.alignment = { vertical: 'middle', horizontal: index === 0 ? 'center' : 'left' };
    fillCell(cell, COLORS.gray50);
    setBorder(cell);
  }

  for (let row = 7; row <= 206; row += 1) {
    for (let col = 8; col <= 16; col += 1) {
      const cell = sheet.getCell(row, col);
      fillCell(cell, row % 2 === 0 ? COLORS.gray50 : COLORS.white);
      setBorder(cell);
      cell.alignment = { vertical: 'middle', horizontal: col === 8 ? 'center' : 'left', wrapText: col === 16 };
      cell.font = { size: 9, color: { argb: COLORS.text } };
    }

    sheet.getCell(`H${row}`).value = { formula: `IF(I${row}="","",ROW()-6)` };
    sheet.getCell(`J${row}`).numFmt = 'dd/mm/yyyy';
    sheet.getCell(`K${row}`).numFmt = 'dd/mm/yyyy';
    sheet.getCell(`M${row}`).numFmt = 'dd/mm/yyyy';

    ['I', 'L', 'N'].forEach((column) => {
      sheet.getCell(`${column}${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [
          column === 'I'
            ? 'Reference!$A$2:$A$9'
            : column === 'L'
              ? 'Reference!$B$2:$B$7'
              : 'Reference!$C$2:$C$10',
        ],
        showErrorMessage: true,
      };
    });
  }
}

function buildReferenceSheet(sheet) {
  sheet.columns = [{ width: 18 }, { width: 18 }, { width: 18 }, { width: 20 }, { width: 34 }];
  const header = sheet.getRow(1);
  header.values = ['Content Types', 'Statuses', 'Platforms', 'API Field', 'Meaning'];
  header.font = { bold: true, size: 10, color: { argb: COLORS.white } };
  header.eachCell((cell) => {
    fillCell(cell, COLORS.indigo);
    setBorder(cell);
  });

  const fieldMappings = [
    ['content_type', 'Content type used in the widget'],
    ['planned_date', 'Date used in the calendar view'],
    ['execution_date', 'Shoot or execution date'],
    ['upload_date', 'Publish date'],
    ['status', 'Workflow stage'],
    ['platform', 'Comma-separated platform list'],
    ['responsible_person', 'Owner of the task'],
    ['description', 'Content brief'],
  ];
  const maxRows = Math.max(contentTypeOptions.length, statusOptions.length, platformOptions.length, fieldMappings.length);
  for (let index = 0; index < maxRows; index += 1) {
    const row = sheet.getRow(index + 2);
    row.getCell(1).value = contentTypeOptions[index] ?? '';
    row.getCell(2).value = statusOptions[index] ?? '';
    row.getCell(3).value = platformOptions[index] ?? '';
    row.getCell(4).value = fieldMappings[index]?.[0] ?? '';
    row.getCell(5).value = fieldMappings[index]?.[1] ?? '';
    row.eachCell({ includeEmpty: true }, (cell) => {
      fillCell(cell, index % 2 === 0 ? COLORS.white : COLORS.gray50);
      setBorder(cell);
    });
  }
}

function buildSchemaSheet(sheet) {
  sheet.columns = schemaHeaders.map((header) => ({ header, key: header, width: Math.max(header.length + 5, 18) }));
  const header = sheet.getRow(1);
  header.values = schemaHeaders;
  header.font = { bold: true, size: 10, color: { argb: COLORS.white } };
  header.eachCell((cell) => {
    fillCell(cell, COLORS.indigo);
    setBorder(cell);
  });
}

buildCalendarPage(calendarPage);
buildPlannerPage(plannerPage);
buildReferenceSheet(referenceSheet);
buildSchemaSheet(schemaSheet);

await workbook.xlsx.writeFile('public/content_calendar_blank_template.xlsx');
console.log('Created public/content_calendar_blank_template.xlsx');
