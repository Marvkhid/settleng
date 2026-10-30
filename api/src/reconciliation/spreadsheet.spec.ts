import { Workbook } from 'exceljs';
import { workbookToCsv } from './spreadsheet';

async function xlsxBuffer(build: (sheet: Workbook['worksheets'][number]) => void) {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Statement');
  build(sheet);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

describe('workbookToCsv', () => {
  it('converts the first sheet into a header row and data rows', async () => {
    const buffer = await xlsxBuffer((sheet) => {
      sheet.addRow(['Date', 'Description', 'Credit', 'Debit']);
      sheet.addRow(['2026-01-05', 'Transfer from customer', 25000, null]);
      sheet.addRow(['2026-01-06', 'Fuel', null, 8000]);
    });

    const csv = await workbookToCsv(buffer);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Date,Description,Credit,Debit');
    expect(lines[1]).toBe('2026-01-05,Transfer from customer,25000,');
    expect(lines[2]).toBe('2026-01-06,Fuel,,8000');
  });

  it('quotes a description that contains a comma so columns cannot shift', async () => {
    const buffer = await xlsxBuffer((sheet) => {
      sheet.addRow(['Date', 'Description', 'Amount']);
      sheet.addRow(['2026-01-05', 'POS, Lagos Island', 1500]);
    });

    const csv = await workbookToCsv(buffer);
    expect(csv.split('\n')[1]).toBe('2026-01-05,"POS, Lagos Island",1500');
  });

  it('writes a date cell as an ISO date, not a locale string', async () => {
    const buffer = await xlsxBuffer((sheet) => {
      sheet.addRow(['Date', 'Amount']);
      sheet.addRow([new Date('2026-02-11T00:00:00Z'), 4200]);
    });

    const csv = await workbookToCsv(buffer);
    expect(csv.split('\n')[1]).toBe('2026-02-11,4200');
  });

  it('skips entirely blank rows', async () => {
    const buffer = await xlsxBuffer((sheet) => {
      sheet.addRow(['Date', 'Amount']);
      sheet.addRow(['2026-01-05', 100]);
      sheet.addRow([]);
      sheet.addRow([null, null]);
      sheet.addRow(['2026-01-06', 200]);
    });

    const csv = await workbookToCsv(buffer);
    expect(csv.split('\n')).toHaveLength(3);
  });

  it('throws for a workbook whose first sheet has no rows', async () => {
    const buffer = await xlsxBuffer(() => {
      /* leave the sheet empty */
    });
    await expect(workbookToCsv(buffer)).rejects.toThrow();
  });
});
