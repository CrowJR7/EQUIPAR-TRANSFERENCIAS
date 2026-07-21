import * as XLSX from 'xlsx';
import fs from 'fs';

const files = [
  '01 JANEIRO.xlsx',
  '02 FEVEREIRO.xlsx',
  '03 MARÇO.xlsx',
  '04 ABRIL.xlsx',
  '05 MAIO.xlsx',
  '06 JUNHO.xlsx',
  '07 JULHO.xlsx'
];

const validSheets = ['A&C', 'GOLD', 'ONIX', 'SORS'];

async function run() {
  const sqlFixes = [];
  
  for (const filename of files) {
    if (!fs.existsSync(filename)) continue;
    
    console.log(`Lendo: ${filename}`);
    const workbook = XLSX.readFile(filename);
    
    for (const sheetName of workbook.SheetNames) {
      if (!validSheets.includes(sheetName)) continue;
      
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      const headers: string[] = [];
      for(let C = range.s.c; C <= range.e.c; ++C) {
        const cell = sheet[XLSX.utils.encode_cell({c: C, r: range.s.r})];
        headers[C] = cell && cell.v ? cell.v.toString().trim().toUpperCase() : `UNKNOWN_${C}`;
      }
      
      const notaCol = headers.findIndex(h => h === 'NOTA' || h === 'NF' || h.includes('NOTA'));
      if (notaCol === -1) continue;

      // Also try to find OBS/MOTIVO columns
      const obsColumns = [];
      for(let C = range.s.c; C <= range.e.c; ++C) {
         const header = headers[C] || '';
         if (header.includes('OBS') || header.includes('MOTIVO') || header.includes('PEND')) {
             obsColumns.push(C);
         }
      }

      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        let notaCell = sheet[XLSX.utils.encode_cell({c: notaCol, r: R})];
        if (!notaCell || !notaCell.v) continue;
        
        let notaStr = notaCell.v.toString();
        const notaNumMatch = notaStr.match(/\d+/);
        if (!notaNumMatch) continue;
        const nota = parseInt(notaNumMatch[0]);

        let obsText = '';
        
        // 1. Check all cell comments on this row
        for(let C = range.s.c; C <= range.e.c; ++C) {
          const cell = sheet[XLSX.utils.encode_cell({c: C, r: R})];
          if (cell && cell.c && cell.c.length > 0) {
             obsText += cell.c.map((comment: any) => comment.t).join(' | ') + '\\n';
          }
        }
        
        // 2. Check text in OBS columns
        for (const C of obsColumns) {
           const cell = sheet[XLSX.utils.encode_cell({c: C, r: R})];
           if (cell && cell.v) obsText += cell.v.toString() + ' | ';
        }
        
        if (obsText.trim()) {
          try {
             obsText = decodeURIComponent(escape(obsText));
          } catch(e) {}
          
          obsText = obsText.trim().replace(/'/g, "''");
          let rawText = obsText.toUpperCase();
          
          const isMod1 = rawText.includes('MOD') && rawText.includes('1') && rawText.length < 15;
          const hasPendencyKeywords = /VEIO|FALTOU|PÇ|UND|AJUSTE|ARRANHADO|QUEBRAD|DETALHE|COD\.|RECEBEU|NÃO|NAO|TROCA/i.test(rawText);
          
          if (isMod1) {
             sqlFixes.push(`UPDATE transferencias SET tipo = 'MOD_1', observacao_pendencia = NULL WHERE numero_nota = ${nota};`);
          } else if (!hasPendencyKeywords) {
             sqlFixes.push(`UPDATE transferencias SET tipo = 'COMPRA', observacao_pendencia = NULL WHERE numero_nota = ${nota};`);
          } else {
             const knownSuppliers = ['TAUROS', 'MARÇON', 'MARCON', 'DSC', 'PILKINGTON', 'MOVITEC', 'AUTOGLASS', 'FREELATAS', 'ARTMOLD', 'ANELISE', 'NAT', 'PINHEIROS', 'CHG', 'CAMPER', 'BELCAR', 'EGMA', 'FOX', 'ABS', 'MG VIDROS', 'NACIONAL BORRACHAS'];
             let foundSupplier = false;
             let newObs = obsText;
             
             for (const sup of knownSuppliers) {
               if (rawText.startsWith(sup)) {
                 foundSupplier = true;
                 if (rawText.startsWith(sup + 'COD') || rawText.startsWith(sup + ' COD')) {
                    // Extract supplier
                    const idx = rawText.indexOf('COD');
                    newObs = obsText.substring(idx);
                 } else if (rawText.includes('\\n')) {
                    const firstLine = rawText.split('\\n')[0];
                    if (firstLine.trim() === sup) {
                       newObs = obsText.substring(firstLine.length).trim();
                    }
                 }
                 break;
               }
             }
             
             if (foundSupplier) {
                sqlFixes.push(`UPDATE transferencias SET tipo = 'COMPRA', observacao_pendencia = '${newObs}' WHERE numero_nota = ${nota};`);
             } else {
                sqlFixes.push(`UPDATE transferencias SET observacao_pendencia = '${newObs}' WHERE numero_nota = ${nota} AND observacao_pendencia IS NULL;`);
             }
          }
        }
      }
    }
  }
  
  fs.writeFileSync('fix_all_missing.sql', sqlFixes.join('\n'));
  console.log(`Gerado fix_all_missing.sql com ${sqlFixes.length} atualizações!`);
}

run().catch(console.error);
