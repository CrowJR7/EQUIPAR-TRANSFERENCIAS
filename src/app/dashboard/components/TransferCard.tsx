import { 
  Truck, AlertCircle, CheckCircle, XCircle, Flag, Clock, 
  UserX, Package, ChevronUp, ChevronDown, Trash2 
} from 'lucide-react'
import toast from 'react-hot-toast'

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'
  d.setHours(d.getHours() + 3) // adjust timezone naive
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

export const calcDias = (dateStr: string) => {
  if (!dateStr) return 0
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 0
  const diffTime = Math.abs(new Date().getTime() - d.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

export const isSlaAtrasado = (prazo: string | null) => {
  if (!prazo) return false;
  return new Date() > new Date(prazo);
}

interface TransferCardProps {
  item: any;
  profile: any;
  activeTab: 'enviando' | 'recebendo' | 'pendencias' | 'historico';
  isExpanded: boolean;
  toggleExpand: (id: string) => void;
  openActionModal: (id: string, type: 'separar' | 'enviar' | 'conferir' | 'resolver_pendencia' | 'editar' | 'rastreamento' | 'cancelar' | 'excluir') => void;
  avancarSituacao: (id: string, acao: 'separar' | 'enviar' | 'receber' | 'conferir' | 'resolver_pendencia' | 'receber_pendencia', dados?: any) => Promise<{ success: boolean, error?: string }>;
  index?: number;
}

export function TransferCard({
  item,
  profile,
  activeTab,
  isExpanded,
  toggleExpand,
  openActionModal,
  avancarSituacao,
  index = 0
}: TransferCardProps) {
  
  const isAdm = profile?.role === 'admin'
  const isOrigin = isAdm ? true : item.origem_loja_id === profile?.loja_id
  const isDest = isAdm ? true : item.destino_loja_id === profile?.loja_id
  const isPendencyState = item.situacao === 'PENDENCIA' || item.situacao === 'PENDENCIA_ENVIADA'

  // Tema Base - Depende da Aba (Enviando vs Recebendo)
  let hoverBgClass = 'group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white'
  let borderHoverClass = 'hover:border-blue-200'
  let lineThemeClass = 'bg-slate-200'
  let truckThemeClass = 'text-slate-300 group-hover:text-blue-600'
  
  if (isPendencyState) {
    hoverBgClass = 'group-hover:bg-red-600 group-hover:border-red-600 group-hover:text-white'
    borderHoverClass = 'hover:border-red-300'
    lineThemeClass = 'bg-red-100'
    truckThemeClass = 'text-red-400 group-hover:text-red-600'
  } else if (item.situacao === 'CONCLUIDA') {
    hoverBgClass = 'group-hover:bg-emerald-500 group-hover:border-emerald-500 group-hover:text-white'
    borderHoverClass = 'hover:border-emerald-200'
    lineThemeClass = 'bg-emerald-100'
    truckThemeClass = 'text-emerald-400 group-hover:text-emerald-500'
  } else if (activeTab === 'recebendo') {
    hoverBgClass = 'group-hover:bg-amber-500 group-hover:border-amber-500 group-hover:text-white'
    borderHoverClass = 'hover:border-amber-200'
    lineThemeClass = 'bg-amber-100'
    truckThemeClass = 'text-amber-400 group-hover:text-amber-500'
  }

  // Motion Stagger animation delay
  const staggerDelay = { animationDelay: `${index * 50}ms`, animationFillMode: 'both' as const }

  return (
    <div 
      className={`relative bg-white rounded-2xl p-5 md:p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border border-gray-100 group shadow-sm animate-slide-up-fade ${borderHoverClass}`}
      style={staggerDelay}
    >

      {/* Linha Principal - Premium Layout */}
      <div 
        className="flex flex-col md:flex-row justify-between gap-6 cursor-pointer"
        onClick={() => toggleExpand(item.id)}
      >
        
        {/* Bloco 1: Rota Visual (Origem -> Destino) */}
        <div className="flex items-center gap-3 md:min-w-[280px]">
           {/* Origem */}
           <div className="flex flex-col items-center min-w-[60px]">
              <div className={`w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm mb-1.5 transition-all duration-300 shadow-sm ${hoverBgClass}`}>
                {item.origem?.nome?.substring(0, 4) || 'ORIG'}
              </div>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{item.origem?.nome || 'Você'}</span>
           </div>
           
           {/* Pipeline */}
           <div className="flex-1 flex flex-col items-center justify-center relative mx-2">
              <div className={`w-full h-0.5 absolute top-1/2 -translate-y-1/2 rounded-full ${lineThemeClass}`}></div>
              <div className={`bg-white px-2 relative z-10 transition-colors duration-300 ${truckThemeClass}`}>
                 <Truck className="w-5 h-5" />
              </div>
           </div>

           {/* Destino */}
           <div className="flex flex-col items-center min-w-[60px]">
              <div className={`w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm mb-1.5 transition-all duration-300 shadow-sm ${hoverBgClass}`}>
                {item.destino?.nome?.substring(0, 4) || 'DEST'}
              </div>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{item.destino?.nome || 'Você'}</span>
           </div>
        </div>

        {/* Bloco 2: Informações e Status */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="text-slate-800 font-bold text-2xl tracking-tight">NF: {item.numero_nota}</div>
            
            <div className={`text-[10px] px-3 py-1 rounded-md font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${isPendencyState ? 'bg-red-50 text-red-700 border border-red-100' : item.situacao === 'CONCLUIDA' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : item.situacao === 'CANCELADA' ? 'bg-gray-100 text-gray-600 border border-gray-200' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
              {isPendencyState && <AlertCircle className="w-3 h-3 text-red-600 animate-pulse" />}
              {item.situacao === 'CONCLUIDA' && <CheckCircle className="w-3 h-3" />}
              {item.situacao === 'CANCELADA' && <XCircle className="w-3 h-3" />}
              {!isPendencyState && !['CONCLUIDA', 'CANCELADA'].includes(item.situacao) && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />}
              {item.situacao === 'PENDENCIA' ? (
                isOrigin && !isDest ? 'PENDÊNCIA — SUA VEZ DE RESPONDER' :
                isDest && !isOrigin ? `PENDÊNCIA — AGUARDANDO RESP. ${item.origem?.nome || 'ORIGEM'}` :
                'PENDÊNCIA ABERTA'
              ) : item.situacao === 'PENDENCIA_ENVIADA' ? (
                isDest && !isOrigin ? 'RESPOSTA RECEBIDA — CONFIRME O RECEBIMENTO' :
                isOrigin && !isDest ? `RESPOSTA ENVIADA — AGUARDANDO ${item.destino?.nome || 'DESTINO'}` :
                'PENDÊNCIA RESPONDIDA'
              ) : (
                item.situacao.replace(/_/g, ' ')
              )}
            </div>

            {isPendencyState && isSlaAtrasado(item.prazo_pendencia) && (
              <div className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-rose-600 text-white border border-rose-700 flex items-center gap-1.5 shadow-sm animate-pulse" title="Tempo de resolução vencido!">
                <Flag className="w-3 h-3" /> SLA VENCIDO
              </div>
            )}

            {item.tipo && (
              <div className="text-[9px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 flex items-center shadow-sm">
                {item.tipo.replace('_', ' ')}
              </div>
            )}

            {!['CONCLUIDA', 'PENDENCIA', 'PENDENCIA_ENVIADA'].includes(item.situacao) && (
              <div className="text-[10px] px-3 py-1 rounded-md font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-100 flex items-center gap-1.5 shadow-sm">
                <Clock className="w-3 h-3" />
                {['AGUARDANDO_SEPARACAO', 'SEPARADO'].includes(item.situacao) ? 'Em aberto há' : 'Em trânsito há'} {calcDias(item.created_at)} dias
              </div>
            )}
          </div>
          
          <div className="text-sm text-slate-500 font-medium flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-slate-400"/> {formatDate(item.created_at)}</span>
            <span className="flex items-center gap-1.5"><UserX className="w-4 h-4 text-slate-400"/> Emitida por: <span className="text-slate-700">{item.emitida_por || 'N/A'}</span></span>
            {item.volumes && <span className="flex items-center gap-1.5"><Package className="w-4 h-4 text-slate-400"/> {item.volumes} Volumes</span>}
          </div>
        </div>
        
        {/* Bloco 3: Botões de Ação */}
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          {isOrigin && item.situacao === 'AGUARDANDO_SEPARACAO' && (
            <button onClick={() => openActionModal(item.id, 'separar')} className="px-5 py-2.5 text-sm bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-md hover:-translate-y-0.5 active:scale-95">
              Separar
            </button>
          )}
          {isOrigin && item.situacao === 'SEPARADO' && (
            <button onClick={() => openActionModal(item.id, 'enviar')} className="px-5 py-2.5 text-sm bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-md hover:-translate-y-0.5 active:scale-95">
              Enviar
            </button>
          )}
          {isDest && item.situacao === 'ENVIADO' && (
            <button onClick={() => {
              toast.promise(avancarSituacao(item.id, 'receber').then((res: any) => {
                if (res?.error) throw new Error(res.error)
                return res
              }), {
                loading: 'Registrando recebimento...',
                success: 'Mercadoria recebida!',
                error: (e: any) => `Erro: ${e.message}`
              })
            }} className="px-5 py-2.5 text-sm bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-md hover:-translate-y-0.5 active:scale-95">
              Receber
            </button>
          )}
          {isDest && item.situacao === 'RECEBIDO' && (
            <button onClick={() => openActionModal(item.id, 'conferir')} className="px-5 py-2.5 text-sm bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-md hover:-translate-y-0.5 active:scale-95">
              Conferir
            </button>
          )}

          {isOrigin && item.situacao === 'PENDENCIA' && (
            <button onClick={() => openActionModal(item.id, 'resolver_pendencia')} className="px-4 py-2.5 text-sm bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-md hover:-translate-y-0.5 active:scale-95">
              Responder
            </button>
          )}

          {isDest && item.situacao === 'PENDENCIA_ENVIADA' && (
            <button onClick={() => {
              toast.promise(avancarSituacao(item.id, 'receber_pendencia').then((res: any) => {
                if (res?.error) throw new Error(res.error)
                return res
              }), {
                loading: 'Confirmando...',
                success: 'Pendência resolvida!',
                error: (e: any) => `Erro: ${e.message}`
              })
            }} className="px-4 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md hover:-translate-y-0.5 active:scale-95">
              Confirmar Recebimento
            </button>
          )}
          
          <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-100">
            <button onClick={(e) => { e.stopPropagation(); openActionModal(item.id, 'rastreamento'); }} className="p-2.5 text-slate-400 hover:text-primary transition-colors bg-white/0 hover:bg-white rounded-lg" title="Ver Histórico">
              <Clock className="w-4 h-4" />
            </button>
            {isAdm && (
              <button onClick={(e) => { e.stopPropagation(); openActionModal(item.id, 'editar'); }} className="p-2.5 text-slate-400 hover:text-amber-500 transition-colors bg-white/0 hover:bg-white rounded-lg" title="Editar Nota">
                <span className="font-bold text-[10px]">EDIT</span>
              </button>
            )}
            {isAdm && !['CANCELADA', 'CONCLUIDA'].includes(item.situacao) && (
              <button onClick={(e) => { e.stopPropagation(); openActionModal(item.id, 'cancelar'); }} className="p-2.5 text-slate-400 hover:text-rose-500 transition-colors bg-white/0 hover:bg-white rounded-lg" title="Cancelar Nota">
                <XCircle className="w-4 h-4" />
              </button>
            )}
            {isAdm && (
              <button onClick={(e) => { e.stopPropagation(); openActionModal(item.id, 'excluir'); }} className="p-2.5 text-slate-400 hover:text-rose-600 transition-colors bg-slate-50 hover:bg-rose-50 rounded-lg border border-slate-100 ml-1" title="Excluir Definitivamente">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            
            <button 
              className={`p-2 rounded-lg transition-all ml-1 ${isExpanded ? 'bg-slate-200 text-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
              title={isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(item.id)
              }}
            >
              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Detalhes Expandidos */}
      <div 
        className={`grid transition-all duration-300 ease-out ${
          isExpanded 
            ? "grid-rows-[1fr] opacity-100 mt-5 pt-5 border-t border-gray-100" 
            : "grid-rows-[0fr] opacity-0 mt-0 pt-0 border-transparent"
        }`}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm pl-2 pb-2">
            {isPendencyState && (
              <div className="col-span-full mb-2 bg-gradient-to-r from-red-50 to-rose-50 border border-red-100/80 rounded-xl p-5 flex gap-4 shadow-sm">
                <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <strong className="block text-red-700 font-bold uppercase tracking-wide text-xs">Motivo da Pendência</strong>
                    {item.prazo_pendencia && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm ${isSlaAtrasado(item.prazo_pendencia) ? 'bg-red-600 text-white animate-pulse' : 'bg-white text-red-700 border border-red-200'}`}>
                        <Clock className="w-3 h-3" />
                        {isSlaAtrasado(item.prazo_pendencia) ? 'PRAZO VENCIDO' : `Vence em: ${new Date(item.prazo_pendencia).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>

                  {item.situacao === 'PENDENCIA' && isOrigin && !isAdm && (
                    <div className="mb-3 p-3 bg-red-100 border border-red-200 rounded-xl text-red-900 text-xs font-bold flex items-center gap-2">
                      <span>👉 Sua loja ({item.origem?.nome}) é a ORIGEM desta transferência. A loja {item.destino?.nome} relatou este problema. Clique no botão vermelho <strong>[ Responder ]</strong> acima para enviar a solução.</span>
                    </div>
                  )}

                  {item.situacao === 'PENDENCIA' && isDest && !isAdm && (
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
                      <span>⏳ Sua loja ({item.destino?.nome}) relatou esta pendência. A loja de origem ({item.origem?.nome}) foi notificada e precisa responder com a solução.</span>
                    </div>
                  )}

                  {item.situacao === 'PENDENCIA_ENVIADA' && isDest && !isAdm && (
                    <div className="mb-3 p-3 bg-emerald-100 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2">
                      <span>✅ A loja de origem ({item.origem?.nome}) enviou a resposta da pendência. Verifique as fotos/anotações abaixo e clique em <strong>[ Confirmar Recebimento ]</strong>.</span>
                    </div>
                  )}

                  {item.situacao === 'PENDENCIA_ENVIADA' && isOrigin && !isAdm && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs font-semibold flex items-center gap-2">
                      <span>ℹ️ Você enviou a resposta desta pendência. Aguardando a loja de destino ({item.destino?.nome}) conferir a solução e confirmar o recebimento.</span>
                    </div>
                  )}
                  <div className="text-red-900 leading-relaxed font-medium mb-3">
                    {item.observacao_pendencia ? (
                      item.observacao_pendencia.includes('||FOTOS||') ? (
                        <>
                          <p className="mb-3 whitespace-pre-wrap">{item.observacao_pendencia.split('||FOTOS||')[0]}</p>
                          <div className="mt-4">
                            <strong className="block text-red-700 mb-2 font-bold text-[10px] uppercase tracking-wider">Fotos Anexadas</strong>
                            <div className="flex gap-2 flex-wrap">
                              {item.observacao_pendencia.split('||FOTOS||')[1].split(',').map((url: string, i: number) => (
                                <a key={i} href={url.trim()} target="_blank" rel="noreferrer" className="inline-block border-2 border-red-200 rounded-lg overflow-hidden hover:opacity-80 transition-opacity hover:shadow-md">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={url.trim()} alt="Anexo Pendência" className="h-32 w-auto object-cover" />
                                </a>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="whitespace-pre-wrap">{item.observacao_pendencia}</p>
                      )
                    ) : (
                      <p className="whitespace-pre-wrap italic opacity-80">Nenhum motivo preenchido ou foto enviada.</p>
                    )}
                  </div>
                  {item.foto_pendencia_url && (
                    <div className="mt-4">
                      <strong className="block text-red-700 mb-2 font-bold text-[10px] uppercase tracking-wider">Foto da Resolução</strong>
                      <a href={item.foto_pendencia_url} target="_blank" rel="noreferrer" className="inline-block border-2 border-red-200 rounded-lg overflow-hidden hover:opacity-80 transition-opacity hover:shadow-md">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.foto_pendencia_url} alt="Foto da Pendência" className="h-32 w-auto object-cover" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="bg-slate-50/80 rounded-xl p-4">
              <div className="text-slate-400 font-bold mb-1.5 flex items-center gap-1.5 uppercase text-[10px] tracking-widest"><Package className="w-3.5 h-3.5"/> Emitida por</div>
              <div className="text-slate-800 font-semibold">{item.emitida_por || '-'}</div>
            </div>
            <div className="bg-slate-50/80 rounded-xl p-4">
              <div className="text-slate-400 font-bold mb-1.5 uppercase text-[10px] tracking-widest">Valor Total</div>
              <div className="text-slate-800 font-bold text-lg">
                {item.valor ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor) : '-'}
              </div>
            </div>
            <div className="bg-slate-50/80 rounded-xl p-4">
              <div className="text-slate-400 font-bold mb-1.5 uppercase text-[10px] tracking-widest">Separador</div>
              <div className="text-slate-800 font-semibold">{item.separador || '-'} <span className="text-slate-400 text-xs ml-1 font-normal">(Vols: {item.volumes || '-'})</span></div>
            </div>
            <div className="bg-slate-50/80 rounded-xl p-4">
              <div className="text-slate-400 font-bold mb-1.5 flex items-center gap-1.5 uppercase text-[10px] tracking-widest"><CheckCircle className="w-3.5 h-3.5"/> Conferente</div>
              <div className="text-slate-800 font-semibold">{item.conferente || '-'}</div>
            </div>
            {item.fornecedor && (
              <div className="bg-slate-50/80 rounded-xl p-4">
                <div className="text-slate-400 font-bold mb-1.5 uppercase text-[10px] tracking-widest">Fornecedor</div>
                <div className="text-slate-800 font-semibold">{item.fornecedor}</div>
              </div>
            )}
            <div className="bg-slate-50/80 rounded-xl p-4 md:col-span-4 mt-2">
              <div className="text-slate-400 font-bold mb-3 flex items-center gap-1.5 uppercase text-[10px] tracking-widest"><Clock className="w-3.5 h-3.5"/> Histórico de Datas</div>
              <div className="text-xs text-slate-700 flex flex-wrap gap-3">
                {item.data_enviado && <div className="bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">Enviado</span> <span className="font-semibold">{formatDate(item.data_enviado)}</span></div>}
                {item.data_recebida && <div className="bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">Recebido</span> <span className="font-semibold">{formatDate(item.data_recebida)}</span></div>}
                {item.data_concluida && <div className="bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block mb-0.5">Concluído</span> <span className="font-semibold">{formatDate(item.data_concluida)}</span></div>}
                {!item.data_enviado && !item.data_recebida && !item.data_concluida && <div className="text-slate-400 py-1.5">-</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  )
}
