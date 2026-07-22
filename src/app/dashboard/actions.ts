'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function criarTransferencia(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      
    if (!profile) throw new Error('Unauthorized')

    const tipo = formData.get('tipo')
    const numero_nota = formData.get('numero_nota')
    const origem_loja_id = formData.get('origem_loja_id')
    const destino_loja_id = formData.get('destino_loja_id')
    const valor = formData.get('valor')
    const volumes = formData.get('volumes')
    const emitida_por = formData.get('emitida_por')

    if (origem_loja_id === destino_loja_id) {
      throw new Error('A loja de origem e destino não podem ser a mesma')
    }

    const isMod1 = tipo === 'MOD_1'

    const { data, error } = await supabase
      .from('transferencias')
      .insert({
        tipo: tipo as string,
        numero_nota: parseInt(numero_nota as string),
        origem_loja_id: origem_loja_id as string,
        destino_loja_id: destino_loja_id as string,
        valor: valor ? parseFloat(valor as string) : null,
        volumes: volumes ? parseInt(volumes as string) : null,
        emitida_por: emitida_por as string,
        situacao: isMod1 ? 'CONCLUIDA' : 'AGUARDANDO_SEPARACAO',
        separado: isMod1 ? true : false,
        enviado: isMod1 ? true : false,
        conferido: isMod1 ? true : false,
        data_concluida: isMod1 ? new Date().toISOString().split('T')[0] : null
      })
      .select()
      .single()

    if (error) {
      console.error(error)
      throw new Error(`Falha ao criar transferência: ${error.message}`)
    }

    const { error: eventError } = await supabase.from('transferencia_eventos').insert({
      transferencia_id: data.id,
      tipo_evento: 'CRIADA',
      usuario_id: profile.id
    })

    if (isMod1) {
      await supabase.from('transferencia_eventos').insert({
        transferencia_id: data.id,
        tipo_evento: 'CONFERIDA',
        usuario_id: profile.id
      })
    }

    if (eventError) {
      console.error('Falha evento:', eventError)
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
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

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('Sem usuario logado')
      return { success: false, error: 'Sessão expirada. Faça login novamente.' }
    }

    let updateData: any = {}
    let evento = ''

    if (acao === 'separar') {
      updateData = { 
        situacao: 'SEPARADO', 
        separado: true, 
        separador: dados.separador,
        data_separado: new Date().toISOString()
      }
      if (dados.valor !== undefined) {
        updateData.valor = dados.valor
      }
      evento = 'SEPARADA'
    } else if (acao === 'enviar') {
      updateData = { 
        situacao: 'ENVIADO', 
        enviado: true, 
        data_enviado: new Date().toISOString().split('T')[0],
        motorista: dados.motorista,
        volumes: dados.volumes
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
          observacao_pendencia: dados.observacao,
          prazo_pendencia: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
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
      return { success: false, error: error.message || 'Falha ao atualizar situação no banco de dados.' }
    }

    if (!updatedRow || updatedRow.length === 0) {
      return { success: false, error: 'Acesso negado ou transferência não encontrada.' }
    }

    const { error: eventError } = await supabase.from('transferencia_eventos').insert({
      transferencia_id: transferenciaId,
      tipo_evento: evento,
      usuario_id: user.id
    })

    if (eventError) {
      console.error('Falha evento:', eventError)
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('Erro inesperado em avancarSituacao:', err)
    return { success: false, error: err.message || 'Erro interno no servidor.' }
  }
}

export async function resolverPendencia(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Sessão expirada' }

    const transferenciaId = formData.get('transferenciaId') as string
    const foto = formData.get('foto') as File | null
    const observacao_resolucao = formData.get('observacao_resolucao') as string | null

    if (!transferenciaId) return { success: false, error: 'ID missing' }

    let fotoUrl = null

    if (foto && foto.size > 0) {
      const fileExt = foto.name.split('.').pop()
      const fileName = `${transferenciaId}_${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('fotos_pendencias')
        .upload(fileName, foto)
      
      if (uploadError) {
        console.error(uploadError)
        return { success: false, error: 'Falha no upload da foto' }
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
        if (curr.observacao_pendencia && curr.observacao_pendencia.includes('||FOTOS||')) {
          const parts = curr.observacao_pendencia.split('||FOTOS||')
          updateObj.observacao_pendencia = `${parts[0]}\n\n[RESOLUÇÃO]: ${observacao_resolucao} ||FOTOS|| ${parts[1]}`
        } else {
          updateObj.observacao_pendencia = curr.observacao_pendencia 
            ? `${curr.observacao_pendencia}\n\n[RESOLUÇÃO]: ${observacao_resolucao}` 
            : `[RESOLUÇÃO]: ${observacao_resolucao}`
        }
      }
    }

    const { error } = await supabase
      .from('transferencias')
      .update(updateObj)
      .eq('id', transferenciaId)

    if (error) {
      console.error(error)
      return { success: false, error: error.message }
    }

    await supabase.from('transferencia_eventos').insert({
      transferencia_id: transferenciaId,
      tipo_evento: 'PENDENCIA_ENVIADA',
      usuario_id: user.id
    })

    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

export async function editarTransferencia(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!profile) return { success: false, error: 'Unauthorized' }

    const id = formData.get('id') as string
    if (!id) return { success: false, error: 'ID missing' }

    let updateData: any = {}
    
    const volumes = formData.get('volumes')
    if (volumes) updateData.volumes = parseInt(volumes as string)
    
    const valor = formData.get('valor')
    if (valor) updateData.valor = parseFloat(valor as string)
    
    const observacao = formData.get('observacao')
    if (observacao) updateData.observacao = observacao as string

    // Admin only edits
    if (profile.role === 'admin') {
      const tipo = formData.get('tipo')
      if (tipo) updateData.tipo = tipo as string
      
      const numero_nota = formData.get('numero_nota')
      if (numero_nota) updateData.numero_nota = parseInt(numero_nota as string)
      
      const origem_loja_id = formData.get('origem_loja_id')
      if (origem_loja_id) updateData.origem_loja_id = origem_loja_id as string
      
      const destino_loja_id = formData.get('destino_loja_id')
      if (destino_loja_id) updateData.destino_loja_id = destino_loja_id as string
    }

    const { error } = await supabase.from('transferencias').update(updateData).eq('id', id)
    
    if (error) {
      console.error(error)
      return { success: false, error: 'Falha ao editar transferência' }
    }

    await supabase.from('transferencia_eventos').insert({
      transferencia_id: id,
      tipo_evento: 'EDITADA',
      usuario_id: user.id
    })

    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

export async function cancelarTransferencia(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return { success: false, error: 'Forbidden' }

    const { error } = await supabase.from('transferencias').update({ situacao: 'CANCELADA' }).eq('id', id)
    if (error) return { success: false, error: 'Falha ao cancelar' }

    await supabase.from('transferencia_eventos').insert({
      transferencia_id: id,
      tipo_evento: 'CANCELADA',
      usuario_id: user.id
    })

    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

export async function excluirTransferencia(id: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return { success: false, error: 'Forbidden' }

    const { error } = await supabase.from('transferencias').delete().eq('id', id)
    if (error) return { success: false, error: 'Falha ao excluir' }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

export async function obterHistorico(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('transferencia_eventos')
    .select(`
      *,
      profiles(nome)
    `)
    .eq('transferencia_id', id)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Erro ao buscar histórico')
  return data
}
