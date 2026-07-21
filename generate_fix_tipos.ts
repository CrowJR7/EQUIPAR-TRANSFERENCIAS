import fs from 'fs';

const content = fs.readFileSync('update_observacoes.sql', 'utf-8');
const regex = /UPDATE transferencias SET observacao_pendencia = '(.*?)' WHERE numero_nota = (\d+) AND observacao_pendencia IS NULL;/gs;

const sqlFixes = [];
let match;
while ((match = regex.exec(content)) !== null) {
  const originalText = match[1];
  const nota = match[2];
  let text = originalText.toUpperCase();

  const isMod1 = text.includes('MOD') && text.includes('1') && text.length < 15;
  
  const hasPendencyKeywords = /VEIO|FALTOU|PÇ|UND|AJUSTE|ARRANHADO|QUEBRAD|DETALHE|COD\.|RECEBEU|NÃO|NAO|TROCA/i.test(text);

  if (isMod1) {
    sqlFixes.push(`UPDATE transferencias SET tipo = 'MOD_1', observacao_pendencia = NULL WHERE numero_nota = ${nota};`);
  } else if (!hasPendencyKeywords) {
    // Just a supplier name
    sqlFixes.push(`UPDATE transferencias SET tipo = 'COMPRA', observacao_pendencia = NULL WHERE numero_nota = ${nota};`);
  } else {
    // Contains pendency keywords. Let's see if it starts with a known supplier name
    const knownSuppliers = ['TAUROS', 'MARÇON', 'MARCON', 'DSC', 'PILKINGTON', 'MOVITEC', 'AUTOGLASS', 'FREELATAS', 'ARTMOLD', 'ANELISE', 'NAT', 'PINHEIROS', 'CHG', 'CAMPER', 'BELCAR', 'EGMA', 'FOX', 'ABS'];
    let foundSupplier = false;
    let newObs = originalText;

    for (const sup of knownSuppliers) {
      if (text.startsWith(sup)) {
        foundSupplier = true;
        // Optionally clean up the supplier name from the observation
        if (text.startsWith(sup + 'COD')) {
          newObs = originalText.substring(sup.length); // keep 'COD...'
        }
        break;
      }
    }

    if (foundSupplier) {
       sqlFixes.push(`UPDATE transferencias SET tipo = 'COMPRA', observacao_pendencia = '${newObs}' WHERE numero_nota = ${nota};`);
    } else {
       // Could be just a normal pendency without supplier at the start, leave it as is for observacao, but maybe it's still a compra?
       // The user said "as de MOD 1 vai estar MOD 1 coisa do tipo, as outras vai ser nome de empresa , CHG, ABS etc... isso e transferencia de compra"
       // So we only set COMPRA if we detect the company name or if it's purely a company name.
    }
  }
}

fs.writeFileSync('fix_tipos.sql', sqlFixes.join('\n'));
console.log(`Gerado fix_tipos.sql com ${sqlFixes.length} correções de tipo!`);
