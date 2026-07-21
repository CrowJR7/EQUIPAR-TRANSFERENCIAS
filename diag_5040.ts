import * as XLSX from 'xlsx';
import fs from 'fs';

async function run() {
    const filename = '06 JUNHO.xlsx';
    if (!fs.existsSync(filename)) return;
    
    const workbook = XLSX.readFile(filename);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const headers: string[] = [];
    for(let C = range.s.c; C <= range.e.c; ++C) {
      const cell = sheet[XLSX.utils.encode_cell({c: C, r: range.s.r})];
      headers[C] = cell && cell.v ? cell.v.toString().trim().toUpperCase() : `UNKNOWN_${C}`;
    }

    const notaCol = headers.indexOf('NOTA');

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      let notaCell = sheet[XLSX.utils.encode_cell({c: notaCol, r: R})];
      if (!notaCell || !notaCell.v) continue;
      
      const v = notaCell.v.toString();
      if (v.includes('504')) {
         console.log(`Linha ${R}: ${v}`);
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

run().catch(console.error);
