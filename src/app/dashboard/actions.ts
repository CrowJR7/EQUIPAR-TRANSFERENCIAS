'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
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
    const fornecedor = formData.get('fornecedor')
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
        fornecedor: fornecedor as string | null,
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

    const { data: profile } = await supabase.from('profiles').select('loja_id, role').eq('id', user.id).single()
    if (!profile) return { success: false, error: 'Perfil não encontrado' }

    const supabaseAdmin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    
    const { data: currTransfer } = await supabaseAdmin.from('transferencias').select('origem_loja_id, destino_loja_id').eq('id', transferenciaId).single()
    if (!currTransfer) return { success: false, error: 'Transferência não encontrada' }

    if (profile.role !== 'admin' && profile.loja_id !== currTransfer.origem_loja_id && profile.loja_id !== currTransfer.destino_loja_id) {
      return { success: false, error: 'Acesso negado: Você não pertence à loja de origem ou destino.' }
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

    console.log('Update Data:', updateData)

    const { data: updatedRow, error, count } = await supabaseAdmin
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

    const { error: eventError } = await supabaseAdmin.from('transferencia_eventos').insert({
      transferencia_id: transferenciaId,
      tipo_evento: evento,
      usuario_id: user.id
    })

    if (eventError) {
      console.error('Falha evento:', eventError)
    }

    if (evento === 'PENDENCIA_ABERTA') {
      let fotosStr = null
      let msg = dados.observacao || ''
      if (msg.includes('||FOTOS||')) {
        const parts = msg.split('||FOTOS||')
        msg = parts[0].trim()
        fotosStr = parts[1].trim()
      }
      
      const { data: profile } = await supabaseAdmin.from('profiles').select('nome').eq('id', user.id).single()
      await supabaseAdmin.from('historico_pendencias').insert({
        transferencia_id: transferenciaId,
        perfil_id: user.id,
        nome_usuario: profile?.nome || 'Usuário',
        mensagem: msg || 'Pendência aberta.',
        fotos: fotosStr,
        tipo_acao: 'ABERTURA'
      })
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

    const { data: profile } = await supabase.from('profiles').select('loja_id, role').eq('id', user.id).single()
    if (!profile) return { success: false, error: 'Perfil não encontrado' }

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

    const supabaseAdmin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: currTransfer } = await supabaseAdmin.from('transferencias').select('origem_loja_id, destino_loja_id, observacao_pendencia').eq('id', transferenciaId).single()
    
    if (!currTransfer) return { success: false, error: 'Transferência não encontrada' }
    if (profile.role !== 'admin' && profile.loja_id !== currTransfer.origem_loja_id && profile.loja_id !== currTransfer.destino_loja_id) {
      return { success: false, error: 'Acesso negado: Você não pertence à loja de origem ou destino.' }
    }

    if (observacao_resolucao && observacao_resolucao.trim().length > 0) {
      if (currTransfer.observacao_pendencia && currTransfer.observacao_pendencia.includes('||FOTOS||')) {
        const parts = currTransfer.observacao_pendencia.split('||FOTOS||')
        updateObj.observacao_pendencia = `${parts[0]}\n\n[RESOLUÇÃO]: ${observacao_resolucao} ||FOTOS|| ${parts[1]}`
      } else {
        updateObj.observacao_pendencia = currTransfer.observacao_pendencia 
          ? `${currTransfer.observacao_pendencia}\n\n[RESOLUÇÃO]: ${observacao_resolucao}` 
          : `[RESOLUÇÃO]: ${observacao_resolucao}`
      }
    }

    const { data: updatedRow, error } = await supabaseAdmin
      .from('transferencias')
      .update(updateObj)
      .eq('id', transferenciaId)
      .select()

    if (error) return { success: false, error: 'Falha ao atualizar situação' }
    if (!updatedRow || updatedRow.length === 0) return { success: false, error: 'Transferência não encontrada ou bloqueada.' }

    await supabaseAdmin.from('transferencia_eventos').insert({
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
    if (observacao !== null) updateData.observacao_pendencia = observacao as string
    
    const fornecedor = formData.get('fornecedor')
    if (fornecedor !== null) updateData.fornecedor = (fornecedor as string).trim() || null

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

    const supabaseAdmin = profile.role === 'admin' 
      ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : supabase

    const { data: updatedRow, error } = await supabaseAdmin.from('transferencias').update(updateData).eq('id', id).select()
    
    if (error) {
      console.error(error)
      return { success: false, error: 'Falha ao editar transferência: ' + error.message }
    }
    if (!updatedRow || updatedRow.length === 0) {
      return { success: false, error: 'Transferência não encontrada ou sem permissão para editar.' }
    }

    await supabaseAdmin.from('transferencia_eventos').insert({
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

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: updatedRow, error } = await supabaseAdmin.from('transferencias').update({ situacao: 'CANCELADA' }).eq('id', id).select()
    if (error) return { success: false, error: 'Falha ao cancelar: ' + error.message }
    if (!updatedRow || updatedRow.length === 0) return { success: false, error: 'Transferência não encontrada ou bloqueada.' }

    await supabaseAdmin.from('transferencia_eventos').insert({
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

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Primeiro exclui os eventos para não dar erro de chave estrangeira
    const { error: eventsError } = await supabaseAdmin.from('transferencia_eventos').delete().eq('transferencia_id', id)
    if (eventsError) return { success: false, error: 'Falha ao excluir histórico da transferência: ' + eventsError.message }

    const { data: deletedRow, error } = await supabaseAdmin.from('transferencias').delete().eq('id', id).select()
    if (error) return { success: false, error: 'Falha ao excluir: ' + error.message }
    if (!deletedRow || deletedRow.length === 0) return { success: false, error: 'Transferência não encontrada ou já excluída.' }

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

export async function adicionarHistoricoPendencia(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Sessão expirada' }

    const { data: profile } = await supabase.from('profiles').select('loja_id, role, nome').eq('id', user.id).single()
    if (!profile) return { success: false, error: 'Perfil não encontrado' }

    const transferenciaId = formData.get('transferenciaId') as string
    const mensagem = formData.get('mensagem') as string
    const tipoAcao = formData.get('tipoAcao') as string
    const foto = formData.get('foto') as File | null
    
    if (!transferenciaId || !mensagem || !tipoAcao) {
      return { success: false, error: 'Campos obrigatórios faltando' }
    }

    let fotosStr = ''
    if (foto && foto.size > 0) {
      const fileExt = foto.name.split('.').pop()
      const fileName = `${transferenciaId}_${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('fotos_pendencias')
        .upload(fileName, foto)
      
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('fotos_pendencias').getPublicUrl(fileName)
        fotosStr = publicUrlData.publicUrl
      }
    }

    const supabaseAdmin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    
    // Inserir no histórico
    const { error: histError } = await supabaseAdmin.from('historico_pendencias').insert({
      transferencia_id: transferenciaId,
      perfil_id: user.id,
      nome_usuario: profile.nome || 'Usuário',
      mensagem,
      fotos: fotosStr || null,
      tipo_acao: tipoAcao
    })

    if (histError) throw new Error(histError.message)

    // Se for resolução total, altera o status da nota
    if (tipoAcao === 'RESOLUCAO_TOTAL') {
      await supabaseAdmin.from('transferencias')
        .update({
          situacao: 'CONCLUIDA',
          data_concluida: new Date().toISOString().split('T')[0]
        })
        .eq('id', transferenciaId)
        
      await supabaseAdmin.from('transferencia_eventos').insert({
        transferencia_id: transferenciaId,
        tipo_evento: 'PENDENCIA_RESOLVIDA',
        usuario_id: user.id
      })
    } else {
      await supabaseAdmin.from('transferencia_eventos').insert({
        transferencia_id: transferenciaId,
        tipo_evento: 'ATUALIZACAO_PENDENCIA',
        usuario_id: user.id
      })
    }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}
