import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabaseUrl = 'https://bwjldytdrhxcolhjgrml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3amxkeXRkcmh4Y29saGpncm1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDE0OTIwNywiZXhwIjoyMDk5NzI1MjA3fQ.ZFrmHs8mHDDt-2oHxJ8N2GomNajx864zuA068mzXERY';
const supabase = createClient(supabaseUrl, supabaseKey);

const LOJAS = {
  'A&C': '6ef5b80e-fd53-4a02-8d77-e1a73e66ed64',
  'GOLD': '2a32a199-70d1-4e38-96df-c395378e4fd2',
  'ONIX': '6e15f485-c6a0-45ca-972b-e32368e141d4',
  'SORS': '81cbc919-1c83-4447-9ab9-3107faea6855',
};

const STATUS_RANK = {
  'AGUARDANDO_SEPARACAO': 1,
  'SEPARACAO_CONCLUIDA': 2,
  'EM_TRANSITO': 3,
  'PENDENCIA': 4,
  'CONCLUIDA': 5
};

function parseExcelDate(serial: number | string | undefined) {
  if (!serial) return null;
  if (typeof serial === 'string') {
    const parts = serial.split('/');
    if (parts.length === 3) {
      const parsed = `${parts[2]}-${parts[1]}-${parts[0]}`;
      if (isNaN(new Date(parsed).getTime())) return null;
      return parsed;
    }
    return null;
  }
  if (typeof serial === 'number') {
    const utc_days = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400; 
    const date_info = new Date(utc_value * 1000);
    if (isNaN(date_info.getTime())) return null;
    return date_info.toISOString().split('T')[0];
  }
  if (serial instanceof Date) {
    return serial.toISOString().split('T')[0];
  }
  return null;
}

function cleanString(str: any) {
  if (typeof str !== 'string') return str ? String(str).trim() : null;
  
  let fixed = str;
  try {
    fixed = decodeURIComponent(escape(str));
  } catch(e) {
    fixed = str;
  }

  fixed = fixed
    .replace(/Ã§/g, 'c')
    .replace(/Ã£/g, 'a')
    .replace(/Ã³/g, 'o')
    .replace(/Ã©/g, 'e')
    .replace(/Ã­/g, 'i')
    .replace(/Ã¡/g, 'a')
    .replace(/Ãª/g, 'e')
    .replace(/Ã¢/g, 'a')
    .replace(/Ãµ/g, 'o')
    .replace(/Ã/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "");

  return fixed.trim();
}

async function run(dryRun = true) {
  console.log(`[SYNC] Iniciando sincronização (Dry Run: ${dryRun})`);
  
  const filename = '07 JULHO.xlsx';
  const workbook = XLSX.readFile(filename, { cellDates: true });
  
  const allData: { row: any, aba: string, rowNum: number, comments: string[] }[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    if (!LOJAS[sheetName as keyof typeof LOJAS]) continue;
    
    const sheet = workbook.Sheets[sheetName];
    
    // Extrair comentários do Excel
    const commentsByRow: Record<number, string[]> = {};
    const cellKeys = Object.keys(sheet).filter(k => k[0] !== '!');
    let foundComments = 0;
    for (const k of cellKeys) {
      if (sheet[k] && sheet[k].c) {
         foundComments++;
         const rowNum = parseInt(k.replace(/\D/g, ''));
         const commentText = cleanString(sheet[k].c.map((c: any) => c.t).join(' '));
         if (commentText) {
            if (!commentsByRow[rowNum]) commentsByRow[rowNum] = [];
            commentsByRow[rowNum].push(commentText);
         }
      }
    }
    console.log(`[DEBUG] Aba ${sheetName}: found ${foundComments} comments in cells.`);

    const data = XLSX.utils.sheet_to_json<any>(sheet, { raw: true, defval: null });
    
    // sheet_to_json doesn't give row numbers easily, but typically row 0 in array is row 2 in Excel
    // However, some rows might be empty. It's safer to get the __rowNum if available, but sheet_to_json doesn't add it by default unless we pass blankrows?
    // Let's use sheet_to_json with blankrows to keep array index aligned with Excel row numbers.
    const dataWithBlanks = XLSX.utils.sheet_to_json<any>(sheet, { raw: true, defval: null, blankrows: true });
    
    // In XLSX, headers are usually row 1. So array index 0 corresponds to Excel row 2.
    for (let i = 0; i < dataWithBlanks.length; i++) {
      const r = dataWithBlanks[i];
      if (!r || Object.keys(r).length === 0) continue;
      
      const rowNum = i + 2; // +1 for 0-index, +1 because headers are row 1
      const comments = commentsByRow[rowNum] || [];
      
      allData.push({ row: r, aba: sheetName, rowNum, comments });
    }
  }
  
  const notasNaPlanilha = allData
    .map(d => parseInt(d.row['NOTA']))
    .filter(n => !isNaN(n));
    
  console.log(`[SYNC] ${notasNaPlanilha.length} notas encontradas na planilha em todas as abas válidas.`);
  
  const { data: dbData, error } = await supabase
    .from('transferencias')
    .select('*')
    .in('numero_nota', notasNaPlanilha);
    
  if (error) {
    console.error("Erro ao buscar no Supabase:", error);
    return;
  }
  
  const dbNotasMap = new Map();
  for (const row of dbData || []) {
    dbNotasMap.set(`${row.numero_nota}-${row.origem_loja_id}`, row);
  }
  
  console.log(`[SYNC] ${dbData?.length || 0} notas relevantes já existem no banco de dados.`);
  
  const toInsert = [];
  const toUpdate = [];
  let noChanges = 0;
  
  for (const { row, aba, rowNum, comments } of allData) {
    const nota = parseInt(row['NOTA']);
    if (!nota) continue;
    
    let destKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'DEST');
    const dest = destKey ? cleanString(row[destKey]) : null;
    
    const origemId = LOJAS[aba as keyof typeof LOJAS];
    const destinoId = dest ? LOJAS[dest as keyof typeof LOJAS] : null;
    
    if (!destinoId || !origemId) continue;
    
    let valorKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'VALOR');
    let valor = null;
    if (valorKey && row[valorKey] !== null) {
       let val = row[valorKey];
       if (typeof val === 'string') val = parseFloat(val.replace(',', '.'));
       if (!isNaN(val)) valor = val;
    }
    
    let situacaoKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'SITUAÇÃO' || k.trim().toUpperCase() === 'SITUACAO');
    const situacaoRaw = situacaoKey ? cleanString(row[situacaoKey]) : '';
    let excelSituacao = situacaoRaw ? situacaoRaw.toUpperCase() : 'AGUARDANDO_SEPARACAO';
    
    if (excelSituacao.includes('PEND')) excelSituacao = 'PENDENCIA';
    else if (excelSituacao.includes('CONCLU')) excelSituacao = 'CONCLUIDA';
    else excelSituacao = 'AGUARDANDO_SEPARACAO';
    
    const emissao = parseExcelDate(row['EMISSÃO']);
    const emitidaPor = cleanString(row['EMITIDA POR']);
    const volumes = parseInt(row['VOLUMES']) || null;
    const separador = cleanString(row['SEPARADOR']);
    const conferente = cleanString(row['CONFERENTE']);
    const dataEnviada = parseExcelDate(row['DATA ENVIADA']);
    const dataRecebida = parseExcelDate(row['DATA RECEBIDA']);
    const dataConcluida = parseExcelDate(row['DATA CONCLUÍDA']);
    
    const separado = cleanString(row['SEPARADO']) === 'SIM';
    const enviado = cleanString(row['ENVIADO']) === 'SIM';
    let confKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'CONF');
    const conferido = confKey ? cleanString(row[confKey]) === 'SIM' : false;
    
    if (comments.length > 0) {
       console.log(`[DEBUG] Aba ${aba} Nota ${nota} (Linha ${rowNum}): ${comments.join(' | ')}`);
    }
    
    // Observacoes de colunas vazias + comentarios nativos
    const extraCols = Object.keys(row).filter(k => k.startsWith('__EMPTY'));
    let allObs = [...comments];
    for (const col of extraCols) {
      if (row[col]) {
        allObs.push(cleanString(row[col]) as string);
      }
    }
    const observacaoExcel = allObs.join(' | ').trim();
    
    const baseRecord = {
      numero_nota: nota,
      origem_loja_id: origemId,
      destino_loja_id: destinoId,
      tipo: 'INTERNA',
      valor: valor,
      emitida_por: emitidaPor,
      situacao: excelSituacao,
      separado: separado,
      separador: separador,
      volumes: volumes,
      enviado: enviado,
      data_enviado: dataEnviada,
      data_recebida: dataRecebida,
      conferido: conferido,
      conferente: conferente,
      data_concluida: dataConcluida,
      created_at: emissao ? `${emissao} 12:00:00` : new Date().toISOString()
    };
    
    if (observacaoExcel) {
      (baseRecord as any).observacao_pendencia = observacaoExcel;
    }

    const dbRowKey = `${nota}-${origemId}`;
    const dbRow = dbNotasMap.get(dbRowKey);
    
    if (!dbRow) {
      toInsert.push(baseRecord);
    } else {
      let needsUpdate = false;
      const updatedRecord: any = { id: dbRow.id, numero_nota: nota };
      
      const rankDb = STATUS_RANK[dbRow.situacao as keyof typeof STATUS_RANK] || 0;
      const rankEx = STATUS_RANK[excelSituacao as keyof typeof STATUS_RANK] || 0;
      
      if (rankEx > rankDb) {
        updatedRecord.situacao = excelSituacao;
        needsUpdate = true;
      }
      
      if (!dbRow.data_enviado && dataEnviada) { updatedRecord.data_enviado = dataEnviada; needsUpdate = true; }
      if (!dbRow.data_recebida && dataRecebida) { updatedRecord.data_recebida = dataRecebida; needsUpdate = true; }
      if (!dbRow.data_concluida && dataConcluida) { updatedRecord.data_concluida = dataConcluida; needsUpdate = true; }
      
      if (!dbRow.separado && separado) { updatedRecord.separado = separado; needsUpdate = true; }
      if (!dbRow.enviado && enviado) { updatedRecord.enviado = enviado; needsUpdate = true; }
      if (!dbRow.conferido && conferido) { updatedRecord.conferido = conferido; needsUpdate = true; }
      
      if (!dbRow.separador && separador) { updatedRecord.separador = separador; needsUpdate = true; }
      if (!dbRow.conferente && conferente) { updatedRecord.conferente = conferente; needsUpdate = true; }
      if (!dbRow.volumes && volumes) { updatedRecord.volumes = volumes; needsUpdate = true; }
      if (!dbRow.emitida_por && emitidaPor) { updatedRecord.emitida_por = emitidaPor; needsUpdate = true; }
      if (!dbRow.valor && valor) { updatedRecord.valor = valor; needsUpdate = true; }
      
      if (observacaoExcel) {
        if (!dbRow.observacao_pendencia) {
          updatedRecord.observacao_pendencia = observacaoExcel;
          needsUpdate = true;
        } else if (!dbRow.observacao_pendencia.includes(observacaoExcel)) {
          updatedRecord.observacao_pendencia = `${dbRow.observacao_pendencia} | ${observacaoExcel}`;
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        toUpdate.push(updatedRecord);
      } else {
        noChanges++;
      }
    }
  }
  
  console.log(`[SYNC] Resultados da Análise:`);
  console.log(` - Inserir novas notas: ${toInsert.length}`);
  console.log(` - Atualizar notas existentes: ${toUpdate.length}`);
  console.log(` - Sem mudanças / Banco mais atualizado: ${noChanges}`);
  
  if (toInsert.length > 0) {
    console.log(`\nExemplo de INSERT:`, toInsert[0]);
  }
  if (toUpdate.length > 0) {
    console.log(`\nExemplo de UPDATE:`, toUpdate[0]);
  }
  
  if (!dryRun) {
    console.log(`\n[SYNC] Efetuando mudanças no banco de dados...`);
    
    if (toInsert.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize);
        const { error } = await supabase.from('transferencias').insert(chunk);
        if (error) console.error(`Erro ao inserir lote ${i}:`, error.message);
      }
      console.log(`[SYNC] Inserts concluídos.`);
    }
    
    if (toUpdate.length > 0) {
      console.log(`[SYNC] Executando ${toUpdate.length} updates...`);
      for (const record of toUpdate) {
        const { id, ...dataToUpdate } = record;
        const { error } = await supabase.from('transferencias').update(dataToUpdate).eq('id', id);
        if (error) console.error(`Erro ao atualizar nota ${record.numero_nota}:`, error.message);
      }
      console.log(`[SYNC] Updates concluídos.`);
    }
  }
}

const isDry = !process.argv.includes('--execute');
run(isDry).catch(console.error);
