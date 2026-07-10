/**
 * One-time export: all cash vouchers dated in June 2026 from the legacy DB
 * (OLD_DB_*), with two sheets — Vouchers (header + computed total) and
 * Line Items (every awt_cashvoucherchild row for those vouchers).
 *
 * Usage: node scripts/db/export-legacy-cashvoucher-june.mjs [outputPath]
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import ExcelJS from 'exceljs';

const outputPath = process.argv[2] || 'cash-voucher-june-2026.xlsx';

async function main() {
  const pool = mysql.createPool({
    host: process.env.OLD_DB_HOST, port: Number(process.env.OLD_DB_PORT || 3306),
    database: process.env.OLD_DB_NAME, user: process.env.OLD_DB_USER, password: process.env.OLD_DB_PASSWORD,
  });

  const [vouchers] = await pool.query(
    `SELECT id, company, voucherno, date, paidto, paidby, prepaired_by, approved_by, checked_by
     FROM awt_cashvoucher
     WHERE deleted = 0 AND date LIKE '2026-06%'
     ORDER BY date ASC, id ASC`
  );

  const ids = vouchers.map((v) => v.id);
  const [items] = ids.length
    ? await pool.query(
        `SELECT voucherid, bill_no, date, account_head, amount, description, project, training_programee, batch_code
         FROM awt_cashvoucherchild
         WHERE deleted = 0 AND voucherid IN (?)
         ORDER BY voucherid ASC, id ASC`,
        [ids]
      )
    : [[]];

  const totalsByVoucher = new Map();
  for (const it of items) {
    const amt = Number(it.amount || 0);
    totalsByVoucher.set(it.voucherid, (totalsByVoucher.get(it.voucherid) || 0) + amt);
  }

  const workbook = new ExcelJS.Workbook();

  const voucherSheet = workbook.addWorksheet('Vouchers');
  voucherSheet.columns = [
    { header: 'Voucher No', key: 'voucherno', width: 14 },
    { header: 'Date', key: 'date', width: 12 },
    { header: 'Company', key: 'company', width: 12 },
    { header: 'Paid To', key: 'paidto', width: 26 },
    { header: 'Paid By', key: 'paidby', width: 10 },
    { header: 'Prepared By', key: 'prepaired_by', width: 20 },
    { header: 'Approved By', key: 'approved_by', width: 16 },
    { header: 'Checked By', key: 'checked_by', width: 16 },
    { header: 'Total', key: 'total', width: 12 },
  ];
  voucherSheet.getRow(1).font = { bold: true };
  for (const v of vouchers) {
    voucherSheet.addRow({
      voucherno: v.voucherno,
      date: v.date,
      company: v.company || 'SUVIDYA',
      paidto: v.paidto,
      paidby: v.paidby,
      prepaired_by: v.prepaired_by,
      approved_by: v.approved_by,
      checked_by: v.checked_by,
      total: totalsByVoucher.get(v.id) || 0,
    });
  }

  const voucherById = new Map(vouchers.map((v) => [v.id, v]));
  const itemSheet = workbook.addWorksheet('Line Items');
  itemSheet.columns = [
    { header: 'Voucher No', key: 'voucherno', width: 14 },
    { header: 'Bill Date', key: 'date', width: 12 },
    { header: 'Bill No', key: 'bill_no', width: 12 },
    { header: 'Account Head', key: 'account_head', width: 22 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Description', key: 'description', width: 40 },
  ];
  itemSheet.getRow(1).font = { bold: true };
  for (const it of items) {
    if (!(Number(it.amount) > 0)) continue; // skip the blank padding rows
    itemSheet.addRow({
      voucherno: voucherById.get(it.voucherid)?.voucherno || '',
      date: it.date,
      bill_no: it.bill_no,
      account_head: it.account_head,
      amount: Number(it.amount),
      description: it.description,
    });
  }

  await workbook.xlsx.writeFile(outputPath);

  console.log(`Vouchers: ${vouchers.length}`);
  console.log(`Line items (with amount > 0): ${items.filter((i) => Number(i.amount) > 0).length}`);
  console.log(`Written to: ${outputPath}`);

  await pool.end();
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
