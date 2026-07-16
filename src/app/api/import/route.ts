import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // if (!user) {
  //   return NextResponse.json({ error: 'Não autenticado. Faça login no sistema primeiro.' }, { status: 401 });
  // }

  const LOJAS = {
    'A&C': '6ef5b80e-fd53-4a02-8d77-e1a73e66ed64',
    'GOLD': '2a32a199-70d1-4e38-96df-c395378e4fd2',
    'ONIX': '6e15f485-c6a0-45ca-972b-e32368e141d4',
    'SORS': '81cbc919-1c83-4447-9ab9-3107faea6855',
  };

  const files = [
    '01 JANEIRO 2026.xlsx',
    '02 FEVEREIRO.xlsx',
    '03 MARÇO.xlsx',
    '04 ABRIL.xlsx',
    '05 MAIO.xlsx',
    '06 JUNHO.xlsx'
  ];

  function parseExcelDate(serial: any) {
    if (!serial) return null;
    if (serial instanceof Date) {
      if (isNaN(serial.getTime())) return null;
      return serial.toISOString();
    }
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
      return date_info.toISOString();
    }
    return null;
  }

  function cleanString(str: any) {
    if (typeof str !== 'string') return str;
    return str.trim();
  }

  const { data: allTransfers, error: fetchErr } = await supabase
    .from('transferencias')
    .select('id, numero_nota, valor, situacao, observacao_pendencia');

  if (fetchErr) {
    console.error("Fetch error:", fetchErr);
    return NextResponse.json({ error: 'Erro ao buscar dados existentes' }, { status: 500 });
  }

  const transferMap = new Map();
  if (allTransfers) {
    for (const t of allTransfers) {
      transferMap.set(Number(t.numero_nota), t);
    }
  }

  const inserts: any[] = [];
  const updates: any[] = [];
  const fileErrors: string[] = [];
  const filesFound: string[] = [];
  const filesNotFound: string[] = [];

  for (const filename of files) {
    const filepath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filepath)) {
      filesNotFound.push(filepath);
      continue;
    }
    
    filesFound.push(filepath);
    let data: any[] = [];
    const commentsByRow: Record<number, string> = {};

    try {
      const fileBuffer = fs.readFileSync(filepath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellText: false, cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      for (const key in sheet) {
        if (key[0] === '!') continue;
        const cell = sheet[key];
        if (cell.c && cell.c.length > 0) {
          const decoded = XLSX.utils.decode_cell(key);
          const row = decoded.r;
          
          let text = cell.c[0].t;
          if (text) {
             try { text = Buffer.from(text, 'latin1').toString('utf8'); } catch(e) {}
             text = text.replace(/^(?:Equipar|Equipar ADM).*?\d{1,2} de [a-z]{3}\.?\n?/is, '').trim(); 
             
             if (commentsByRow[row]) {
                commentsByRow[row] += ' | ' + text;
             } else {
                commentsByRow[row] = text;
             }
          }
        }
      }
      
      data = XLSX.utils.sheet_to_json<any>(sheet, { raw: true });
    } catch (e: any) {
      console.error(`Error reading ${filename}:`, e);
      fileErrors.push(`${filename}: ${e.message}`);
      continue;
    }
    
    for (const row of data) {
      const nota = parseInt(row['NOTA']);
      let destKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'DEST');
      const dest = destKey ? cleanString(row[destKey]) : null;
      
      const origemId = LOJAS['A&C'];
      const destinoId = dest ? (LOJAS as any)[dest] : null;
      
      if (!nota || !destinoId) continue;
      
      let valorKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'VALOR');
      let valor = 0;
      if (valorKey && row[valorKey] !== undefined) {
         let val = row[valorKey];
         if (typeof val === 'string') val = parseFloat(val.replace(',', '.'));
         if (!isNaN(val)) valor = val;
      }
      
      let situacaoKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'SITUAÇÃO' || k.trim().toUpperCase() === 'SITUACAO');
      const situacaoRaw = situacaoKey ? cleanString(row[situacaoKey]) : '';
      let dbSituacao = situacaoRaw ? situacaoRaw.toUpperCase() : 'CONCLUIDA';
      
      if (dbSituacao === 'PENDÊNCIA' || dbSituacao === 'PENDENCIA') dbSituacao = 'PENDENCIA';
      else if (dbSituacao === 'CONCLUIDA' || dbSituacao === 'CONCLUÍDA' || dbSituacao === 'CONCLUIDO' || dbSituacao === 'CONCLUÍDO') dbSituacao = 'CONCLUIDA';
      else dbSituacao = 'AGUARDANDO_SEPARACAO';
      
      const emissao = parseExcelDate(row['EMISSÃO']);
      const emitidaPor = cleanString(row['EMITIDA POR']);
      const volumes = parseInt(row['VOLUMES']) || null;
      const separador = cleanString(row['SEPARADOR']);
      const conferente = cleanString(row['CONFERENTE']);
      const dataEnviada = parseExcelDate(row['DATA ENVIADA']);
      const dataRecebida = parseExcelDate(row['DATA RECEBIDA']);
      const dataConcluida = parseExcelDate(row['DATA CONCLUÍDA']);
      
      const separado = row['SEPARADO'] === 'SIM';
      const enviado = row['ENVIADO'] === 'SIM';
      const conferido = row['CONF'] === 'SIM';
      
      const comment = commentsByRow[row.__rowNum__] || null;
      
      const record = {
        numero_nota: nota,
        origem_loja_id: origemId,
        destino_loja_id: destinoId,
        valor: valor,
        emitida_por: emitidaPor || '',
        situacao: dbSituacao,
        separado: separado,
        separador: separador || null,
        volumes: volumes,
        enviado: enviado,
        data_enviado: dataEnviada || null,
        data_recebida: dataRecebida || null,
        conferido: conferido,
        conferente: conferente || null,
        data_concluida: dataConcluida || null,
        observacao_pendencia: comment,
        created_at: emissao ? `${emissao} 12:00:00` : new Date().toISOString()
      };
      
      const existing = transferMap.get(nota);
      
      if (!existing) {
        inserts.push(record);
        transferMap.set(nota, true);
      } else {
        if (existing !== true && (existing.valor !== valor || existing.situacao !== dbSituacao || (comment && existing.observacao_pendencia !== comment))) {
          updates.push({ id: existing.id, ...record });
          transferMap.set(nota, true);
        }
      }
    }
  }

  let insertErrors = 0;
  let updateErrors = 0;

  const chunkSize = 200;
  for (let i = 0; i < inserts.length; i += chunkSize) {
    const chunk = inserts.slice(i, i + chunkSize);
    const { error } = await supabase.from('transferencias').insert(chunk);
    if (error) insertErrors++;
  }
  
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    const { error } = await supabase.from('transferencias').upsert(chunk);
    if (error) updateErrors++;
  }

  if (fileErrors.length > 0) {
    return NextResponse.json({ 
        success: false, 
        message: 'Algumas planilhas estão abertas no Excel e não puderam ser lidas. Feche o Excel e tente novamente.',
        erros: fileErrors
    }, { status: 400 });
  }

  return NextResponse.json({ 
    success: true, 
    inserts: inserts.length, 
    updates: updates.length,
    insertErrors,
    updateErrors,
    filesFound,
    filesNotFound,
    cwd: process.cwd(),
    cwdFiles: fs.readdirSync(process.cwd()).slice(0, 20),
    message: 'Importação concluída com sucesso! Volte para a tela inicial e recarregue a página.'
  });
}
