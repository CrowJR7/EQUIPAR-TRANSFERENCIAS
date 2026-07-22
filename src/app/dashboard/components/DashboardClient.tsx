'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { criarTransferencia, avancarSituacao, resolverPendencia, editarTransferencia, excluirTransferencia, cancelarTransferencia, obterHistorico } from '../actions'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { AlertCircle, Package, CheckCircle, Truck, Settings, BarChart3, ListFilter, UserX, Store, Loader2 } from 'lucide-react'
import { TransferCard } from './TransferCard'
import { CustomSelect } from './CustomSelect'
import { DashboardFilters } from './DashboardFilters'
import { ActionModal } from './ActionModal'
export function DashboardClient({ lojas, enviando, recebendo, profile }: { lojas: any[], enviando: any[], recebendo: any[], profile: any }) {
  const [activeTab, setActiveTab] = useState<'enviando' | 'recebendo' | 'pendencias' | 'historico'>('enviando')
  const [admTab, setAdmTab] = useState<'gerencial' | 'lista'>('gerencial')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCriando, setIsCriando] = useState(false)
  const [novaOrigem, setNovaOrigem] = useState('')
  const [novoDestino, setNovoDestino] = useState('')
  const [tipoTransf, setTipoTransf] = useState('INTERNA')
  const router = useRouter()
  const supabase = createClient()
  
  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('TODOS')
  const [filtroMes, setFiltroMes] = useState('TODOS')

  // Paginação
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, busca, filtroStatus, filtroMes])

  useEffect(() => {
    const channel = supabase.channel('transferencias_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transferencias' }, (payload) => {
        
        if (payload.eventType === 'INSERT' && payload.new.destino_loja_id === profile?.loja_id) {
          toast.success(`Nova transferência (NF: ${payload.new.numero_nota}) destinada à sua loja!`, { duration: 5000, icon: '📦' })
        }
        
        if (payload.eventType === 'UPDATE') {
          const wasStatusChanged = payload.old.situacao !== payload.new.situacao
          
          if (wasStatusChanged && (payload.new.situacao === 'PENDENCIA' || payload.new.situacao === 'PENDENCIA_ENVIADA')) {
            const isMine = payload.new.origem_loja_id === profile?.loja_id || payload.new.destino_loja_id === profile?.loja_id
            if (isMine || profile?.role === 'admin') {
              toast.error(`Pendência registrada na NF: ${payload.new.numero_nota}`, { duration: 6000 })
            }
          }
          
          if (wasStatusChanged && payload.new.situacao === 'CONCLUIDA' && payload.new.origem_loja_id === profile?.loja_id) {
            toast.success(`A NF: ${payload.new.numero_nota} foi recebida e conferida com sucesso!`, { duration: 5000, icon: '✅' })
          }
        }

        router.refresh()
      })
      .subscribe()
      
    return () => {
      supabase.removeChannel(channel)
    }
  }, [router, supabase, profile])

  const [actionModal, setActionModal] = useState<{
    isOpen: boolean,
    transferId: string | null,
    actionType: 'separar' | 'enviar' | 'conferir' | 'resolver_pendencia' | 'editar' | 'rastreamento' | 'cancelar' | 'excluir' | null
  }>({ isOpen: false, transferId: null, actionType: null })

  const openActionModal = (id: string, type: 'separar' | 'enviar' | 'conferir' | 'resolver_pendencia' | 'editar' | 'rastreamento' | 'cancelar' | 'excluir') => {
    setActionModal({ isOpen: true, transferId: id, actionType: type })
  }

  const closeActionModal = () => {
    setActionModal({ isOpen: false, transferId: null, actionType: null })
  }

  // const handleCancel = (id: string) => {
  //   openActionModal(id, 'cancelar')
  // }

  // const handleDelete = (id: string) => {
  //   openActionModal(id, 'excluir')
  // }
  
  // const isSlaAtrasado = (prazo: string | null) => {
  //   if (!prazo) return false;
  //   return new Date() > new Date(prazo);
  // }

  const [expandedItems, setExpandedItems] = useState<string[]>([])

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const isAdm = profile?.role === 'admin'
  const transitoCount = (isAdm ? enviando : []).filter(t => !['CONCLUIDA', 'PENDENCIA', 'PENDENCIA_ENVIADA'].includes(t.situacao)).length
  const pendenciasCount = (isAdm ? enviando : []).filter(t => t.situacao === 'PENDENCIA' || t.situacao === 'PENDENCIA_ENVIADA').length
  const concluidasCount = (isAdm ? enviando : []).filter(t => t.situacao === 'CONCLUIDA').length

  const admStats = useMemo(() => {
    if (!isAdm) return null;
    
    const lojaPendenciasCount: Record<string, number> = {};
    const separadorPendenciasCount: Record<string, number> = {};
    let notasEmAndamento = 0;
    let notasComPendencia = 0;
    const totalLojasOriginadas: Record<string, number> = {};
    
    enviando.forEach(t => {
       const isPendency = t.situacao === 'PENDENCIA' || t.situacao === 'PENDENCIA_ENVIADA';
       const isConcluida = t.situacao === 'CONCLUIDA';
       
       if (!isConcluida && !isPendency) {
          notasEmAndamento++;
       }
       
       if (isPendency) {
          notasComPendencia++;
          
          const origemNome = t.origem?.nome || 'Desconhecida';
          lojaPendenciasCount[origemNome] = (lojaPendenciasCount[origemNome] || 0) + 1;
          
          if (t.separador) {
             const sepNome = t.separador.toUpperCase().trim();
             separadorPendenciasCount[sepNome] = (separadorPendenciasCount[sepNome] || 0) + 1;
          }
       }
       
       const origemNome = t.origem?.nome || 'Desconhecida';
       totalLojasOriginadas[origemNome] = (totalLojasOriginadas[origemNome] || 0) + 1;
    });
    
    // Calcula % de falhas por loja (Pendencias / Total Emitido)
    const rankingLojas = Object.entries(lojaPendenciasCount).map(([nome, pendencias]) => {
      const total = totalLojasOriginadas[nome] || 1;
      return { nome, pendencias, total, taxaErro: (pendencias / total) * 100 }
    }).sort((a,b) => b.pendencias - a.pendencias).slice(0, 5);
    
    const rankingSeparadores = Object.entries(separadorPendenciasCount).sort((a,b) => b[1] - a[1]).slice(0, 5);
    
    return {
       rankingLojas,
       rankingSeparadores,
       notasEmAndamento,
       notasComPendencia,
       taxaErroGlobal: enviando.length > 0 ? ((notasComPendencia / enviando.length) * 100).toFixed(1) : '0.0'
    }
  }, [isAdm, enviando]);

  const availableMonths = useMemo(() => {
    const allTransfers = isAdm ? enviando : [...enviando, ...recebendo];
    const months = new Set<string>();
    allTransfers.forEach(t => {
      if (t.created_at) {
        const dateStr = t.created_at.substring(0, 7); // "YYYY-MM"
        const year = parseInt(dateStr.substring(0, 4));
        if (year >= 2020 && year <= 2030) {
          months.add(dateStr);
        }
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a)); // Descending
  }, [isAdm, enviando, recebendo]);

  const formatMonth = (yyyyMm: string) => {
    const [year, month] = yyyyMm.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleString('pt-BR', { month: 'long' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${year}`;
  }

  const enviandoAtivos = enviando.filter(t => !['CONCLUIDA', 'PENDENCIA', 'PENDENCIA_ENVIADA'].includes(t.situacao))
  const recebendoAtivos = recebendo.filter(t => !['CONCLUIDA', 'PENDENCIA', 'PENDENCIA_ENVIADA'].includes(t.situacao))
  
  const pendenciasTodos = [...enviando, ...recebendo].filter(t => ['PENDENCIA', 'PENDENCIA_ENVIADA'].includes(t.situacao))
  const pendenciasUnicas = Array.from(new Map(pendenciasTodos.map(item => [item.id, item])).values())
  
  const historicoTodos = [...enviando, ...recebendo].filter(t => t.situacao === 'CONCLUIDA')
  const historicoUnico = Array.from(new Map(historicoTodos.map(item => [item.id, item])).values())

  const filteredTransfers = useMemo(() => {
    let list = isAdm ? [...enviando] : 
               (activeTab === 'enviando' ? [...enviandoAtivos] : 
               (activeTab === 'recebendo' ? [...recebendoAtivos] : 
               (activeTab === 'pendencias' ? [...pendenciasUnicas] : [...historicoUnico])))
    
    if (busca) {
      list = list.filter(t => t.numero_nota?.toString().includes(busca) || t.origem?.nome.toLowerCase().includes(busca.toLowerCase()) || t.destino?.nome.toLowerCase().includes(busca.toLowerCase()))
    }
    
    if (filtroStatus !== 'TODOS') {
      if (filtroStatus === 'EM_TRANSITO') {
        list = list.filter(t => !['CONCLUIDA', 'PENDENCIA', 'PENDENCIA_ENVIADA'].includes(t.situacao))
      } else if (filtroStatus === 'PENDENCIA') {
        list = list.filter(t => t.situacao === 'PENDENCIA' || t.situacao === 'PENDENCIA_ENVIADA')
      } else {
        list = list.filter(t => t.situacao === filtroStatus)
      }
    }
    
    if (filtroMes !== 'TODOS') {
      list = list.filter(t => t.created_at && t.created_at.startsWith(filtroMes));
    }
    
    list.sort((a, b) => {
      if (!a.created_at) return 1;
      if (!b.created_at) return -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    return list
  }, [isAdm, enviando, activeTab, busca, filtroStatus, filtroMes, enviandoAtivos, recebendoAtivos, pendenciasUnicas, historicoUnico])

  const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage)
  const paginatedTransfers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredTransfers.slice(start, start + itemsPerPage)
  }, [filteredTransfers, currentPage])



  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Painel de Transferências</h1>
            <p className="text-sm text-slate-500 mt-1">
              {isAdm ? 'Visão Geral - Administrador' : `Loja: ${lojas.find(l => l.id === profile?.loja_id)?.nome || profile?.loja_id}`}
            </p>
          </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-md flex items-center gap-2"
        >
          <Package className="w-5 h-5" />
          Nova Transferência
        </button>
      </div>

      {isAdm && (
        <div className="flex bg-slate-100/50 p-1.5 rounded-xl border border-slate-200/60 w-full sm:w-fit mb-4">
          <button
            onClick={() => setAdmTab('gerencial')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${admTab === 'gerencial' ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            <BarChart3 className="w-4 h-4" />
            Visão Gerencial
          </button>
          <button
            onClick={() => setAdmTab('lista')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${admTab === 'lista' ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            <ListFilter className="w-4 h-4" />
            Lista de Notas
          </button>
        </div>
      )}

      {isAdm && admTab === 'gerencial' && admStats && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* CARD 1 - Estilo Principal Dark (Igual Portal de Devoluções) */}
            <div className="bg-primary rounded-2xl p-6 text-white shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-6 opacity-5"><Truck className="w-32 h-32" /></div>
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 flex items-center justify-center mb-6 relative z-10">
                 <Truck className="w-5 h-5 text-blue-300" />
              </div>
              <div className="relative z-10">
                 <div className="text-white/60 font-bold uppercase tracking-wider text-[10px] mb-1">Fluxo Operacional (Ativo)</div>
                 <div className="text-4xl font-bold tracking-tight">
                   {admStats.notasEmAndamento}
                 </div>
                 <div className="text-white/40 text-[10px] uppercase font-semibold mt-3 flex justify-between items-center">
                   <span>Mercadorias Rodando</span>
                   <span className="text-white/80">Hoje</span>
                 </div>
              </div>
            </div>
            
            {/* CARD 2 - Estilo Branco Limpo */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between relative">
              <div className="absolute top-6 right-6">
                <span className="bg-rose-50 text-rose-600 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider">
                  Gargalos
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center mb-6">
                 <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                 <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Notas Travadas (Pendências)</div>
                 <div className="text-4xl font-bold text-slate-800 tracking-tight">
                   {admStats.notasComPendencia}
                 </div>
                 <div className="text-slate-400 text-[10px] uppercase font-semibold mt-3 flex justify-between items-center">
                   <span>Taxa de Erro Histórica</span>
                   <span className="text-rose-500 font-bold">{admStats.taxaErroGlobal}%</span>
                 </div>
              </div>
            </div>

            {/* CARD 3 - Novo para fechar as 3 colunas padrão */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between relative">
              <div className="absolute top-6 right-6">
                <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider">
                  Volume
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center mb-6">
                 <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                 <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">Total de Transferências</div>
                 <div className="text-4xl font-bold text-slate-800 tracking-tight">
                   {enviando.length}
                 </div>
                 <div className="text-slate-400 text-[10px] uppercase font-semibold mt-3 flex justify-between items-center">
                   <span>Histórico Completo</span>
                   <span className="text-indigo-500 font-bold">100%</span>
                 </div>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Store className="w-5 h-5 text-slate-400" />
                <h3 className="text-lg font-bold text-slate-800">Top Lojas (Problemas na Origem)</h3>
              </div>
              <div className="space-y-4">
                {admStats.rankingLojas.length === 0 ? (
                  <p className="text-slate-500 text-sm">Nenhuma pendência registrada.</p>
                ) : (() => {
                  const maxPend = Math.max(...admStats.rankingLojas.map(l => l.pendencias), 1)
                  return admStats.rankingLojas.map((loja, i) => {
                    const pct = Math.min(100, (loja.pendencias / maxPend) * 100)
                    const medalClass = i === 0 ? 'bg-gradient-to-br from-yellow-200 to-amber-400 text-amber-900 border border-yellow-400 shadow-sm' :
                                       i === 1 ? 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 border border-slate-300 shadow-sm' :
                                       i === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-900 border border-orange-400 shadow-sm' :
                                       'bg-slate-100 text-slate-500'

                    return (
                      <div key={loja.nome} className="relative overflow-hidden flex items-center justify-between p-3.5 bg-white border border-gray-100 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all group z-0">
                        {/* Sparkline Progress */}
                        <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-50/80 to-transparent -z-10 transition-all duration-1000 ease-out rounded-r-full" style={{ width: `${pct}%` }}></div>
                        
                        <div className="flex items-center gap-3.5 z-10">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${medalClass}`}>
                            {i + 1}º
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 tracking-tight">{loja.nome}</div>
                            <div className="text-[11px] text-slate-500 font-medium">{loja.taxaErro.toFixed(1)}% de falha ({loja.pendencias} pendências em {loja.total} envios)</div>
                          </div>
                        </div>
                        <div className="font-display font-bold text-red-500 text-xl z-10 pr-2">{loja.pendencias}</div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <UserX className="w-5 h-5 text-slate-400" />
                <h3 className="text-lg font-bold text-slate-800">Separadores com Mais Erros</h3>
              </div>
              <div className="space-y-4">
                {admStats.rankingSeparadores.length === 0 ? (
                  <p className="text-slate-500 text-sm">Nenhuma falha de separação registrada.</p>
                ) : (() => {
                  const maxErr = Math.max(...admStats.rankingSeparadores.map(s => s[1]), 1)
                  return admStats.rankingSeparadores.map(([nome, count], i) => {
                    const pct = Math.min(100, (count / maxErr) * 100)
                    const medalClass = i === 0 ? 'bg-gradient-to-br from-yellow-200 to-amber-400 text-amber-900 border border-yellow-400 shadow-sm' :
                                       i === 1 ? 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 border border-slate-300 shadow-sm' :
                                       i === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-orange-900 border border-orange-400 shadow-sm' :
                                       'bg-slate-100 text-slate-500'

                    return (
                      <div key={nome} className="relative overflow-hidden flex items-center justify-between p-3.5 bg-white border border-gray-100 rounded-xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-md transition-all group z-0">
                        {/* Sparkline Progress */}
                        <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-50/80 to-transparent -z-10 transition-all duration-1000 ease-out rounded-r-full" style={{ width: `${pct}%` }}></div>
                        
                        <div className="flex items-center gap-3.5 z-10">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${medalClass}`}>
                            {i + 1}º
                          </div>
                          <div className="font-bold text-slate-800 tracking-tight">{nome}</div>
                        </div>
                        <div className="font-display font-bold text-orange-600 text-xl z-10 pr-2">{count}</div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </div>

        </div>
      )}

      {(!isAdm || admTab === 'lista') && (
        <>
          {isAdm && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-2 animate-in fade-in slide-in-from-top-2">
          {/* Card Em Trânsito - Destacado */}
          <div 
            className="relative overflow-hidden bg-primary rounded-2xl p-6 flex flex-col justify-between shadow-lg cursor-pointer group transition-all hover:-translate-y-1" 
            onClick={() => setFiltroStatus('EM_TRANSITO')}
          >
            <Settings className="absolute -right-12 -bottom-12 w-64 h-64 text-white/5 animate-[spin_40s_linear_infinite] pointer-events-none" />
            <div className="relative z-10">
              <div className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1.5 flex items-center gap-2">
                <Truck className="w-4 h-4" /> Em Trânsito
              </div>
              <div className="text-5xl font-display font-bold text-white tracking-wide mt-4">{transitoCount}</div>
            </div>
          </div>

          {/* Card Pendências */}
          <div 
            className="relative overflow-hidden bg-white border border-gray-100 rounded-2xl p-6 flex flex-col justify-between shadow-sm cursor-pointer hover:shadow-md transition-all hover:-translate-y-1" 
            onClick={() => setFiltroStatus('PENDENCIA')}
          >
            <div className="relative z-10">
              <div className="text-red-500 text-xs font-bold uppercase tracking-widest mb-1.5 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Pendências
              </div>
              <div className="text-5xl font-display font-bold text-slate-800 tracking-wide mt-4">{pendenciasCount}</div>
            </div>
          </div>

          {/* Card Concluídas */}
          <div 
            className="relative overflow-hidden bg-white border border-gray-100 rounded-2xl p-6 flex flex-col justify-between shadow-sm cursor-pointer hover:shadow-md transition-all hover:-translate-y-1" 
            onClick={() => setFiltroStatus('CONCLUIDA')}
          >
            <div className="relative z-10">
              <div className="text-emerald-500 text-xs font-bold uppercase tracking-widest mb-1.5 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Concluídas
              </div>
              <div className="text-5xl font-display font-bold text-slate-800 tracking-wide mt-4">{concluidasCount}</div>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {!isAdm && (
        <div className="border-b border-gray-200">
          <nav className="flex gap-2">
            <button
              onClick={() => { setActiveTab('enviando'); setBusca(''); setFiltroStatus('TODOS') }}
              className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all rounded-t-xl bg-primary/5 text-primary hover:bg-primary/10 ${
                activeTab === 'enviando' ? 'border-primary' : 'border-transparent'
              }`}
            >
              Enviando 
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-white shadow-sm">
                {enviandoAtivos.length}
              </span>
            </button>
            
            <button
              onClick={() => { setActiveTab('recebendo'); setBusca(''); setFiltroStatus('TODOS') }}
              className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all rounded-t-xl bg-amber-50 text-amber-700 hover:bg-amber-100 ${
                activeTab === 'recebendo' ? 'border-amber-500' : 'border-transparent'
              }`}
            >
              Recebendo 
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm">
                {recebendoAtivos.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('pendencias'); setBusca(''); setFiltroStatus('TODOS') }}
              className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all rounded-t-xl bg-red-50 text-red-700 hover:bg-red-100 ${
                activeTab === 'pendencias' ? 'border-red-600' : 'border-transparent'
              }`}
            >
              {pendenciasUnicas.length > 0 && (
                <AlertCircle className={`w-4 h-4 text-red-600 ${activeTab !== 'pendencias' ? 'animate-bounce' : ''}`} />
              )}
              Pendências 
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white shadow-sm ${pendenciasUnicas.length > 0 ? 'ring-4 ring-red-600/20' : ''}`}>
                {pendenciasUnicas.length}
              </span>
            </button>
            
            <button
              onClick={() => { setActiveTab('historico'); setBusca(''); setFiltroStatus('TODOS') }}
              className={`flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all rounded-t-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ${
                activeTab === 'historico' ? 'border-emerald-600' : 'border-transparent'
              }`}
            >
              Histórico 
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm">
                {historicoUnico.length}
              </span>
            </button>
          </nav>
        </div>
      )}

      {(!isAdm || admTab === 'lista') && (
      <>
        {/* Barra de Filtros e Busca */}
        <DashboardFilters 
          busca={busca}
          setBusca={setBusca}
          filtroMes={filtroMes}
          setFiltroMes={setFiltroMes}
          filtroStatus={filtroStatus}
          setFiltroStatus={setFiltroStatus}
          availableMonths={availableMonths}
          formatMonth={formatMonth}
        />
      <div className="space-y-4 animate-in fade-in">
        {paginatedTransfers.length === 0 ? (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-12 flex flex-col items-center justify-center text-slate-500 font-sans">
            <Package className="w-12 h-12 mb-3 text-slate-300 opacity-80" />
            <p>Nenhuma transferência encontrada com estes filtros.</p>
          </div>
        ) : (
          paginatedTransfers.map((item, index) => {
            const isExpanded = expandedItems.includes(item.id)
            return (
              <TransferCard 
                key={item.id}
                item={item}
                profile={profile}
                activeTab={activeTab}
                isExpanded={isExpanded}
                toggleExpand={toggleExpand}
                openActionModal={openActionModal}
                avancarSituacao={avancarSituacao}
                index={index}
              />
            )
          })
        )}
      </div>

      {/* Controles de Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4 mt-6">
          <p className="text-sm text-slate-600">
            Mostrando <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-bold">{Math.min(currentPage * itemsPerPage, filteredTransfers.length)}</span> de <span className="font-bold">{filteredTransfers.length}</span> resultados
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
      </>
      )}

      <ActionModal
        isOpen={actionModal.isOpen}
        actionType={actionModal.actionType}
        transferId={actionModal.transferId}
        onClose={closeActionModal}
        enviando={enviando}
        recebendo={recebendo}
        lojas={lojas}
        profile={profile}
      />

      {/* MODAL DE NOVA TRANSFERENCIA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-in fade-in">
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-[24px] p-8 w-full max-w-md shadow-2xl relative overflow-hidden">
            {/* Elemento Decorativo */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10" />

            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                  Nova Transferência
                </h3>
                <p className="text-sm text-slate-500 font-medium">Preencha os dados de envio</p>
              </div>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              if (isCriando) return
              setIsCriando(true)

              const destino = formData.get('destino') as string
              const numero_nota = formData.get('numero_nota') as string
              const observacao = formData.get('observacao') as string
              const origem_loja = formData.get('origem') as string
              const valor = formData.get('valor') as string
              const volumes = formData.get('volumes') as string
              const tipo = formData.get('tipo') as string || tipoTransf
              const emissor = formData.get('emissor') as string
              
              if (!destino || !numero_nota) {
                setIsCriando(false)
                return
              }
              
              const formDataAction = new FormData()
              formDataAction.append('numero_nota', numero_nota)
              formDataAction.append('destino_loja_id', destino)
              formDataAction.append('origem_loja_id', origem_loja || profile?.loja_id)
              formDataAction.append('tipo', tipo)
              if (observacao) formDataAction.append('observacao', observacao)
              if (valor) formDataAction.append('valor', valor)
              if (volumes) formDataAction.append('volumes', volumes)
              formDataAction.append('emitida_por', emissor || profile?.nome || 'Admin')

              try {
                toast.loading('Criando...', { id: 'nova_transf' })
                const result = await criarTransferencia(formDataAction)
                if (result && result.error) {
                  toast.error('Erro ao criar: ' + result.error, { id: 'nova_transf' })
                } else {
                  toast.success('Transferência criada!', { id: 'nova_transf' })
                  setIsModalOpen(false)
                }
              } catch (e: any) {
                toast.error('Erro inesperado: ' + e.message, { id: 'nova_transf' })
              } finally {
                setIsCriando(false)
              }
            }} className="space-y-5 font-sans relative z-10">
              
              {!profile?.loja_id && (
                 <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><Store className="w-4 h-4 text-slate-400"/> Loja de Origem</label>
                   <CustomSelect 
                     name="origem"
                     placeholder="Selecione a origem..."
                     options={lojas}
                     required={true}
                     value={novaOrigem}
                     onChange={setNovaOrigem}
                   />
                 </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><Truck className="w-4 h-4 text-slate-400"/> Loja de Destino</label>
                <CustomSelect 
                  name="destino"
                  placeholder="Selecione o destino..."
                  options={lojas.filter(l => l.id !== profile?.loja_id)}
                  required={true}
                  value={novoDestino}
                  onChange={setNovoDestino}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><ListFilter className="w-4 h-4 text-slate-400"/> Tipo de Transferência</label>
                <CustomSelect 
                  name="tipo"
                  placeholder="Selecione o tipo..."
                  options={[
                    { id: 'INTERNA', nome: 'Interna de Depósito' },
                    { id: 'COMPRA', nome: 'Transferência de Compra' },
                    { id: 'VENDA', nome: 'Transferência de Venda' },
                    { id: 'MOD_1', nome: 'Transferência MOD 1' }
                  ]}
                  required={true}
                  value={tipoTransf}
                  onChange={setTipoTransf}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Número da NF</label>
                  <input required type="number" name="numero_nota" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-800 font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all hover:bg-slate-100/50" placeholder="Ex: 12345" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5"><UserX className="w-4 h-4 text-slate-400"/> Nome do Emissor</label>
                  <input required type="text" name="emissor" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-800 font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all hover:bg-slate-100/50" placeholder="Quem está enviando?" />
                </div>
              </div>

              {(tipoTransf === 'INTERNA' || tipoTransf === 'COMPRA' || tipoTransf === 'MOD_1') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Valor Total (R$)</label>
                    <input required type="number" step="0.01" name="valor" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-800 font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all hover:bg-slate-100/50" placeholder="Ex: 1500.50" />
                  </div>
                  {tipoTransf === 'MOD_1' && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Qtd. Volumes (Opcional)</label>
                      <input type="number" name="volumes" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-800 font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all hover:bg-slate-100/50" placeholder="Ex: 3" />
                    </div>
                  )}
                </div>
              )}

              <div className="pt-8 flex justify-end gap-3">
                <button type="button" disabled={isCriando} onClick={() => { setIsModalOpen(false); setNovaOrigem(''); setNovoDestino(''); }} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={isCriando} className="px-8 py-3 bg-primary text-white hover:bg-primary/90 font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                  {isCriando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4" />
                      Criar Transferência
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
