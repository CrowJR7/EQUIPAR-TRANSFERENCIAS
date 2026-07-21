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
  const sqlFixes = [];

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

    const notaCol = headers.indexOf('NOTA');
    if (notaCol === -1) continue;

    for (let R = range.s.r + 1; R <= range.e.c + 10000; ++R) {
      let notaCell = sheet[XLSX.utils.encode_cell({c: notaCol, r: R})];
      if (!notaCell || !notaCell.v) continue;
      
      const valStr = notaCell.v.toString().trim().toUpperCase();
      
      // If it contains letters (except just spaces around numbers)
      if (/[A-Z]/.test(valStr)) {
         // console.log(`Encontrado na nota: ${valStr}`);
         const notaNumMatch = valStr.match(/\d+/);
         if (notaNumMatch) {
            const nota = parseInt(notaNumMatch[0]);
            
            if (valStr.includes('MOD')) {
               sqlFixes.push(`UPDATE transferencias SET tipo = 'MOD_1' WHERE numero_nota = ${nota};`);
            } else {
               sqlFixes.push(`UPDATE transferencias SET tipo = 'COMPRA' WHERE numero_nota = ${nota};`);
            }
         } else {
             // no number?
             console.log(`No number in: ${valStr}`);
         }
      }
    }
  }
  
  fs.writeFileSync('fix_tipos_direto_da_nota.sql', sqlFixes.join('\n'));
  console.log(`Gerado fix_tipos_direto_da_nota.sql com ${sqlFixes.length} registros!`);
}

run().catch(console.error);
