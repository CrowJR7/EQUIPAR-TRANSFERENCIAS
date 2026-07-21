import * as XLSX from 'xlsx';

const wb = XLSX.readFile('07 JULHO.xlsx');
const sheetName = 'ONIX'; // User screenshot shows DEST is ONIX, and usually they put it in the DEST sheet or origin sheet. Wait, let's just search all sheets.

for (const sName of wb.SheetNames) {
    const sheet = wb.Sheets[sName];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const headers: string[] = [];
    for(let C = range.s.c; C <= range.e.c; ++C) {
      const cell = sheet[XLSX.utils.encode_cell({c: C, r: range.s.r})];
      headers[C] = cell && cell.v ? cell.v.toString().trim().toUpperCase() : `UNKNOWN_${C}`;
    }

    const notaCol = headers.findIndex(h => h === 'NOTA' || h === 'NF' || h.includes('NOTA'));
    if (notaCol === -1) continue;

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        let notaCell = sheet[XLSX.utils.encode_cell({c: notaCol, r: R})];
        if (notaCell && notaCell.v && String(notaCell.v).includes('5040')) {
            console.log(`FOUND 5040 in ${sName} at row ${R}`);
            // Let's dump all cells on this row
            for(let C = range.s.c; C <= range.e.c; ++C) {
                const cell = sheet[XLSX.utils.encode_cell({c: C, r: R})];
                if (cell) {
                    console.log(`Col ${C} (${headers[C]}):`, Object.keys(cell));
                    if (cell.c) console.log('  Legacy comments:', cell.c);
                    // maybe there are other properties?
                    // sometimes comments are in another sheet or XML part.
                }
            }
        }
    }
}
