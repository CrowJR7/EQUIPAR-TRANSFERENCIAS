import * as XLSX from 'xlsx';
import fs from 'fs';

const files = [
  '01 JANEIRO 2026.xlsx',
  '02 FEVEREIRO.xlsx',
  '03 MARÇO.xlsx',
  '04 ABRIL.xlsx',
  '05 MAIO.xlsx',
  '06 JUNHO.xlsx',
  '07 JULHO.xlsx'
];

async function run() {
  for (const filename of files) {
    if (!fs.existsSync(filename)) continue;
    
    const workbook = XLSX.readFile(filename);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const headers: string[] = [];
    for(let C = range.s.c; C <= range.e.c; ++C) {
      const cell = sheet[XLSX.utils.encode_cell({c: C, r: range.s.r})];
      headers[C] = cell && cell.v ? cell.v.toString().trim().toUpperCase() : `UNKNOWN_${C}`;
    }

    const notaCol = headers.findIndex(h => h === 'NOTA' || h === 'NF' || h.includes('NOTA'));
    if (notaCol === -1) {
       console.log(`[${filename}] NOTA COL NOT FOUND. Headers:`, headers);
       continue;
    }

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      let notaCell = sheet[XLSX.utils.encode_cell({c: notaCol, r: R})];
      if (!notaCell || !notaCell.v) continue;
      
      const v = notaCell.v.toString();
      if (v.includes('504')) {
         console.log(`[${filename}] Linha ${R}: ${v}`);
         let obsText = '';
         for(let C = range.s.c; C <= range.e.c; ++C) {
            const cell = sheet[XLSX.utils.encode_cell({c: C, r: R})];
            if (cell && cell.c && cell.c.length > 0) {
               console.log(`Comentário na coluna ${C}: ${cell.c.map((cc:any) => cc.t).join(' | ')}`);
            }
         }
      }
    }
  }
}

run().catch(console.error);
