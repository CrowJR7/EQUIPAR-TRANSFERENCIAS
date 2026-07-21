'use client'

import { useState, useEffect } from 'react'
import { Activity, AlertCircle, Check, Image as ImageIcon, XCircle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/utils/supabase/client'
import { CustomSelect } from './CustomSelect'
import { resolverPendencia, editarTransferencia, cancelarTransferencia, excluirTransferencia, avancarSituacao } from '../actions'

interface ActionModalProps {
  isOpen: boolean
  actionType: 'separar' | 'enviar' | 'conferir' | 'resolver_pendencia' | 'editar' | 'rastreamento' | 'cancelar' | 'excluir' | null
  transferId: string | null
  onClose: () => void
  enviando: any[]
  recebendo: any[]
  lojas: any[]
  profile: any
}

export function ActionModal({
  isOpen,
  actionType,
  transferId,
  onClose,
  enviando,
  recebendo,
  lojas,
  profile
}: ActionModalProps) {
  const [conferirStatus, setConferirStatus] = useState<'ok' | 'pendencia'>('ok')
  const [fotosPendencia, setFotosPendencia] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [historicoEventos, setHistoricoEventos] = useState<any[]>([])
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(false)
  const [editOrigem, setEditOrigem] = useState('')
  const [editDestino, setEditDestino] = useState('')
  const [editTipo, setEditTipo] = useState('')
  const supabase = createClient()

  const item = enviando.find(x => x.id === transferId) || recebendo.find(x => x.id === transferId)
  const isAdm = profile?.role === 'admin'

  useEffect(() => {
    if (isOpen && transferId) {
      // Reset states
      setConferirStatus('ok')
      setFotosPendencia([])
      
      if (actionType === 'editar' && item) {
        setEditOrigem(item.origem_loja_id || '')
        setEditDestino(item.destino_loja_id || '')
        setEditTipo(item.tipo || '')
      }

      if (actionType === 'rastreamento') {
        const fetchHist = async () => {
          setIsLoadingHistorico(true)
          try {
            const { data: events, error } = await supabase
              .from('transferencia_eventos')
              .select('*, profiles(nome)')
              .eq('transferencia_id', transferId)
              .order('created_at', { ascending: true })
            
            if (error) throw new Error(error.message)
            setHistoricoEventos(events || [])
          } catch (e) {
            console.error('Erro detalhado no rastreamento:', e)
            toast.error('Falha ao carregar rastro')
          } finally {
            setIsLoadingHistorico(false)
          }
        }
        fetchHist()
      }
    }
  }, [isOpen, transferId, actionType, item])

  if (!isOpen || !actionType || !transferId) return null

  const handleClose = () => {
    setFotosPendencia([])
    setHistoricoEventos([])
    onClose()
  }

  // Rastreamento View (Read Only)
  if (actionType === 'rastreamento') {
    return (
      <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-in fade-in" onClick={handleClose}>
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-[24px] p-8 w-full max-w-lg shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Rastreabilidade</h3>
              <p className="text-sm text-slate-500 font-medium">Histórico ponta-a-ponta</p>
            </div>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            {isLoadingHistorico ? (
              <div className="text-center text-slate-500 py-10 animate-pulse">Carregando rastro...</div>
            ) : historicoEventos.length === 0 ? (
              <div className="text-center text-slate-500 py-10">Nenhum evento registrado.</div>
            ) : (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {historicoEventos.map((evt, idx) => {
                  return (
                    <div key={evt.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        <Check className="w-4 h-4" />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-center justify-between space-x-2 mb-1">
                          <div className="font-bold text-slate-700 text-sm">{evt.tipo_evento.replace(/_/g, ' ')}</div>
                          <time className="text-xs text-slate-400 font-medium">{new Date(evt.created_at).toLocaleString()}</time>
                        </div>
                        <div className="text-slate-500 text-xs">
                          Usuário: <span className="font-semibold text-slate-700">{evt.profiles?.nome || 'Sistema'}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
          <div className="pt-8 flex justify-end">
            <button type="button" onClick={handleClose} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Fechar</button>
          </div>
        </div>
      </div>
    )
  }

  // Formulário Dinâmico
  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-2xl font-display font-bold text-slate-800 mb-6 tracking-wide uppercase">
          {actionType === 'separar' && 'Confirmar Separação'}
          {actionType === 'enviar' && 'Registrar Envio'}
          {actionType === 'conferir' && 'Conferir Mercadoria'}
          {actionType === 'resolver_pendencia' && 'Resolver Pendência'}
          {actionType === 'editar' && 'Editar Transferência'}
          {actionType === 'cancelar' && 'Cancelar Transferência'}
          {actionType === 'excluir' && 'Excluir Transferência'}
        </h3>
        
        <form action={async (formData) => {
          if (!transferId || !actionType) return

          if (actionType === 'resolver_pendencia') {
            const obs = formData.get('observacao_resolucao') as string
            const foto = formData.get('foto') as File
            if ((!obs || obs.trim() === '') && (!foto || foto.size === 0)) {
              toast.error('Você deve fornecer uma anotação ou uma foto para resolver a pendência.', { id: 'resolver_err' })
              return
            }

            try {
              toast.loading('Enviando...', { id: 'resolver' })
              formData.append('transferenciaId', transferId)
              await resolverPendencia(formData)
              toast.success('Pendência resolvida e enviada!', { id: 'resolver' })
              handleClose()
            } catch (e: any) {
              toast.error('Erro: ' + e.message, { id: 'resolver' })
            }
            return
          }
          
          if (actionType === 'editar') {
            try {
              toast.loading('Salvando edição...', { id: 'editar' })
              formData.append('id', transferId)
              await editarTransferencia(formData)
              toast.success('Transferência editada!', { id: 'editar' })
              handleClose()
            } catch (e: any) {
              toast.error('Erro: ' + e.message, { id: 'editar' })
            }
            return
          }
          
          if (actionType === 'cancelar') {
            try {
              toast.loading('Cancelando...', { id: 'cancel' })
              await cancelarTransferencia(transferId)
              toast.success('Cancelada!', { id: 'cancel' })
              handleClose()
            } catch (e: any) {
              toast.error('Erro: ' + e.message, { id: 'cancel' })
            }
            return
          }
          
          if (actionType === 'excluir') {
            try {
              toast.loading('Excluindo...', { id: 'delete' })
              await excluirTransferencia(transferId)
              toast.success('Excluída!', { id: 'delete' })
              handleClose()
            } catch (e: any) {
              toast.error('Erro: ' + e.message, { id: 'delete' })
            }
            return
          }

          let dados: any = {}
          if (actionType === 'separar') {
            dados.separador = formData.get('separador')?.toString().trim()
            const valorRaw = formData.get('valor')?.toString().trim()
            if (valorRaw) {
              const num = parseFloat(valorRaw)
              if (!isNaN(num)) dados.valor = num
            }
          } else if (actionType === 'enviar') {
            dados.motorista = formData.get('motorista')?.toString().trim()
            const vols = formData.get('volumes')?.toString().trim()
            if (vols) {
              const numVols = parseInt(vols, 10)
              if (!isNaN(numVols)) dados.volumes = numVols
            }
          } else if (actionType === 'conferir') {
            dados.conferente = formData.get('conferente')?.toString().trim()
            dados.tudoOk = conferirStatus === 'ok'
            if (!dados.tudoOk) {
              dados.observacao = formData.get('observacao')?.toString().trim()
            }
          }

          try {
            toast.loading('Processando...', { id: 'acao' })
            let uploadedUrls: string[] = []
            if (actionType === 'conferir' && conferirStatus === 'pendencia' && fotosPendencia.length > 0) {
              setIsUploading(true)
              toast.loading('Enviando fotos...', { id: 'acao' })
              for (const file of fotosPendencia) {
                const fileExt = file.name.split('.').pop()
                const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`
                const { data, error } = await supabase.storage.from('pendencias').upload(fileName, file)
                if (error) {
                  throw new Error('Erro ao fazer upload da foto. Verifique se o bucket "pendencias" existe e é público no Supabase.')
                }
                if (data) {
                  const { data: publicUrlData } = supabase.storage.from('pendencias').getPublicUrl(data.path)
                  uploadedUrls.push(publicUrlData.publicUrl)
                }
              }
            }
            
            if (uploadedUrls.length > 0) {
              dados.observacao = dados.observacao + " ||FOTOS|| " + uploadedUrls.join(',')
            }

            const result = await avancarSituacao(transferId, actionType as any, dados)
            if (result && result.error) {
              throw new Error(result.error)
            }
            toast.success('Situação atualizada!', { id: 'acao' })
            handleClose()
          } catch (e: any) {
            toast.error('Erro: ' + e.message, { id: 'acao' })
          } finally {
            setIsUploading(false)
          }
        }} className="space-y-5 font-sans">

          {actionType === 'separar' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Separador</label>
                <input required type="text" name="separador" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Quem separou?" />
              </div>
              {item?.tipo === 'VENDA' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Valor da Nota Final (R$)</label>
                  <input required type="number" step="0.01" name="valor" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Ex: 1500.50" />
                </div>
              )}
            </>
          )}

          {actionType === 'enviar' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Motorista</label>
                <input required type="text" name="motorista" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="Quem está levando?" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1 mt-3">Quantos Volumes?</label>
                <input required type="number" name="volumes" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="Ex: 3" />
              </div>
            </>
          )}

          {actionType === 'conferir' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Conferente</label>
                <input required type="text" name="conferente" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="Quem está conferindo?" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Status da Mercadoria</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-50 border border-gray-200 py-2 px-3 rounded-lg flex-1">
                    <input type="radio" name="status" value="ok" checked={conferirStatus === 'ok'} onChange={() => setConferirStatus('ok')} className="accent-blue-600 w-4 h-4" />
                    <span className="text-slate-800 text-sm font-medium">Tudo Certo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-50 border border-gray-200 py-2 px-3 rounded-lg flex-1">
                    <input type="radio" name="status" value="pendencia" checked={conferirStatus === 'pendencia'} onChange={() => setConferirStatus('pendencia')} className="accent-red-600 w-4 h-4" />
                    <span className="text-slate-800 text-sm font-medium">Com Pendência</span>
                  </label>
                </div>
              </div>
              {conferirStatus === 'pendencia' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1 text-red-600">Qual foi a pendência?</label>
                    <textarea required name="observacao" rows={3} className="w-full bg-red-50 border border-red-200 rounded-lg p-2.5 text-red-900 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors" placeholder="Ex: Faltou 2 caixas de produto X..."></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2 mt-2">
                      <ImageIcon className="w-4 h-4" />
                      Fotos da Pendência (Opcional)
                    </label>
                    <input type="file" accept="image/*" multiple capture="environment" onChange={(e) => {
                      if (e.target.files) {
                        setFotosPendencia(Array.from(e.target.files))
                      }
                    }} className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 transition-colors border border-gray-300 rounded-lg bg-gray-50 p-2 cursor-pointer" />
                  </div>
                </>
              )}
            </>
          )}

          {actionType === 'resolver_pendencia' && (
            <div>
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3 text-blue-800 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>Você está separando os itens faltantes dessa pendência. Descreva a solução e/ou envie uma foto comprovando.</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Anotação da Resolução <span className="text-slate-400 font-normal">(Opcional se enviar foto)</span></label>
                <textarea 
                  name="observacao_resolucao" 
                  rows={3} 
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" 
                  placeholder="Ex: Encontrado as 2 caixas faltando, seguem na próxima viagem."
                ></textarea>
              </div>

              <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Foto da Pendência <span className="text-slate-400 font-normal">(Opcional se preencher anotação)</span>
              </label>
              <input type="file" name="foto" accept="image/*" capture="environment" className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors border border-gray-300 rounded-lg bg-gray-50 p-2 cursor-pointer" />
            </div>
          )}
          
          {actionType === 'editar' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-800 flex gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p><strong>Atenção:</strong> Você pode editar os dados básicos da transferência. Alterações ficarão registradas no rastreamento.</p>
              </div>
              {isAdm && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Loja de Origem</label>
                      <CustomSelect name="origem_loja_id" options={lojas} value={editOrigem} onChange={setEditOrigem} placeholder="Origem" required />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Loja de Destino</label>
                      <CustomSelect name="destino_loja_id" options={lojas} value={editDestino} onChange={setEditDestino} placeholder="Destino" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Número NF</label>
                      <input defaultValue={item?.numero_nota} required type="number" name="numero_nota" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo</label>
                      <CustomSelect 
                        name="tipo" 
                        value={editTipo} 
                        onChange={setEditTipo}
                        placeholder="Selecione o tipo..."
                        options={[
                          { id: 'INTERNA', nome: 'Abastecimento (Interna)' },
                          { id: 'COMPRA', nome: 'Compra' },
                          { id: 'VENDA', nome: 'Venda' },
                          { id: 'MOD_1', nome: 'MOD 1' }
                        ]}
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Quantos Volumes?</label>
                  <input defaultValue={item?.volumes || ''} type="number" name="volumes" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Valor Final (R$)</label>
                  <input defaultValue={item?.valor || ''} type="number" step="0.01" name="valor" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Observações</label>
                <textarea defaultValue={item?.observacao || ''} name="observacao" rows={2} className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5"></textarea>
              </div>
            </div>
          )}
          
          {actionType === 'cancelar' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-800 flex gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-orange-600" />
              <p>Tem certeza que deseja <strong>CANCELAR</strong> esta transferência? Ela não será apagada, apenas ficará registrada como Cancelada no histórico.</p>
            </div>
          )}
          
          {actionType === 'excluir' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 flex gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
              <p>Tem certeza que deseja <strong>EXCLUIR DEFINITIVAMENTE</strong> esta transferência? Essa ação apagará a transferência e todo o seu histórico do banco de dados e <strong>não pode ser desfeita</strong>.</p>
            </div>
          )}

          <div className="pt-6 flex justify-end gap-3">
            <button type="button" onClick={handleClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={isUploading} className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all shadow-md active:scale-95 text-white disabled:opacity-50 ${actionType === 'conferir' ? (conferirStatus === 'ok' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-secondary hover:bg-secondary/90') : actionType === 'cancelar' ? 'bg-orange-600 hover:bg-orange-700' : actionType === 'excluir' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'}`}>
              {isUploading ? 'Processando...' : actionType === 'cancelar' ? 'Sim, Cancelar' : actionType === 'excluir' ? 'Sim, Excluir' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
