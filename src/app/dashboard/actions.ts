'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function criarTransferencia(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
    
  if (!profile) throw new Error('Unauthorized')

  const numero_nota = formData.get('numero_nota')
  const origem_loja_id = formData.get('origem_loja_id')
  const destino_loja_id = formData.get('destino_loja_id')
  const valor = formData.get('valor')
  const volumes = formData.get('volumes')
  const emitida_por = formData.get('emitida_por')

  if (origem_loja_id === destino_loja_id) {
    throw new Error('A loja de origem e destino não podem ser a mesma')
  }

  const { data, error } = await supabase
    .from('transferencias')
    .insert({
      numero_nota: parseInt(numero_nota as string),
      origem_loja_id: origem_loja_id as string,
      destino_loja_id: destino_loja_id as string,
      valor: parseFloat(valor as string),
      volumes: volumes ? parseInt(volumes as string) : null,
      emitida_por: emitida_por as string,
      situacao: 'AGUARDANDO_SEPARACAO'
    })
    .select()
    .single()

  if (error) {
    console.error(error)
    throw new Error('Falha ao criar transferência')
  }

  await supabase.from('transferencia_eventos').insert({
    transferencia_id: data.id,
    tipo_evento: 'CRIADA',
    usuario_id: profile.id
  })

  revalidatePath('/dashboard')
}

export async function avancarSituacao(
  transferenciaId: string,
  acao: 'separar' | 'enviar' | 'receber' | 'conferir' | 'resolver_pendencia' | 'receber_pendencia',
  dados?: any
) {
  console.log('--- INICIO AVANCAR SITUACAO ---')
  console.log('ID:', transferenciaId)
  console.log('Acao:', acao)
  console.log('Dados:', dados)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.error('Sem usuario logado')
    return
  }

  let updateData: any = {}
  let evento = ''

  if (acao === 'separar') {
    updateData = { 
      situacao: 'SEPARADO', 
      separado: true, 
      separador: dados.separador,
      volumes: dados.volumes 
    }
    evento = 'SEPARADA'
  } else if (acao === 'enviar') {
    updateData = { 
      situacao: 'ENVIADO', 
      enviado: true, 
      data_enviado: new Date().toISOString().split('T')[0],
      motorista: dados.motorista
    }
    evento = 'ENVIADA'
  } else if (acao === 'receber') {
    updateData = { 
      situacao: 'RECEBIDO', 
      data_recebida: new Date().toISOString().split('T')[0] 
    }
    evento = 'RECEBIDA'
  } else if (acao === 'conferir') {
    if (dados.tudoOk) {
      updateData = { 
        situacao: 'CONCLUIDA', 
        conferido: true, 
        conferente: dados.conferente,
        data_concluida: new Date().toISOString().split('T')[0]
      }
      evento = 'CONFERIDA'
    } else {
      updateData = { 
        situacao: 'PENDENCIA', 
        conferido: true, 
        conferente: dados.conferente,
        observacao_pendencia: dados.observacao
      }
      evento = 'PENDENCIA_ABERTA'
    }
  } else if (acao === 'resolver_pendencia') {
    updateData = { 
      situacao: 'CONCLUIDA', 
      data_concluida: new Date().toISOString().split('T')[0]
    }
    evento = 'PENDENCIA_RESOLVIDA'
  } else if (acao === 'receber_pendencia') {
    updateData = { 
      situacao: 'CONCLUIDA', 
      data_concluida: new Date().toISOString().split('T')[0]
    }
    evento = 'PENDENCIA_RECEBIDA'
  }

  console.log('Update Data:', updateData)

  const { data: updatedRow, error, count } = await supabase
    .from('transferencias')
    .update(updateData)
    .eq('id', transferenciaId)
    .select()

  console.log('Erro no update:', error)
  console.log('Update Data Retornado:', updatedRow)

  if (error) {
    console.error('Falha ao atualizar situação', error)
    throw new Error('Falha ao atualizar situação')
  }

  const { error: eventError } = await supabase.from('transferencia_eventos').insert({
    transferencia_id: transferenciaId,
    tipo_evento: evento,
    usuario_id: user.id
  })

  console.log('Erro no evento:', eventError)

  console.log('Revalidando /dashboard')
  revalidatePath('/dashboard')
}

export async function resolverPendencia(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const transferenciaId = formData.get('transferenciaId') as string
  const foto = formData.get('foto') as File | null
  const observacao_resolucao = formData.get('observacao_resolucao') as string | null

  if (!transferenciaId) throw new Error('ID missing')

  let fotoUrl = null

  if (foto && foto.size > 0) {
    const fileExt = foto.name.split('.').pop()
    const fileName = `${transferenciaId}_${Date.now()}.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('fotos_pendencias')
      .upload(fileName, foto)
    
    if (uploadError) {
      console.error(uploadError)
      throw new Error('Falha no upload da foto')
    }

    const { data: publicUrlData } = supabase.storage
      .from('fotos_pendencias')
      .getPublicUrl(fileName)
    
    fotoUrl = publicUrlData.publicUrl
  }

  let updateObj: any = {
    situacao: 'PENDENCIA_ENVIADA',
    foto_pendencia_url: fotoUrl
  }

  if (observacao_resolucao && observacao_resolucao.trim().length > 0) {
    const { data: curr } = await supabase.from('transferencias').select('observacao_pendencia').eq('id', transferenciaId).single()
    if (curr) {
      updateObj.observacao_pendencia = curr.observacao_pendencia 
        ? `${curr.observacao_pendencia}\n\n[RESOLUÇÃO]: ${observacao_resolucao}` 
        : `[RESOLUÇÃO]: ${observacao_resolucao}`
    }
  }

  const { error } = await supabase
    .from('transferencias')
    .update(updateObj)
    .eq('id', transferenciaId)

  if (error) {
    console.error(error)
    throw new Error('Falha ao atualizar pendência')
  }

  await supabase.from('transferencia_eventos').insert({
    transferencia_id: transferenciaId,
    tipo_evento: 'PENDENCIA_ENVIADA',
    usuario_id: user.id
  })

  revalidatePath('/dashboard')
}
