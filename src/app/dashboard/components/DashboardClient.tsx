'use client'
import { useState, useEffect, useMemo } from 'react'
import { criarTransferencia, avancarSituacao, resolverPendencia } from '../actions'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronUp, Search, AlertCircle, Package, CheckCircle, Truck, Image as ImageIcon, Clock, Settings, BarChart3, ListFilter, TrendingUp, UserX, Store, DollarSign, Check } from 'lucide-react'

const CustomSelect = ({ 
  options, 
  name, 
  placeholder, 
  required, 
  value, 
  onChange 
}: { 
  options: { id: string, nome: string }[], 
  name: string, 
  placeholder: string,
  required?: boolean,
  value: string,
  onChange: (val: string) => void
}) => {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} required={required && !value} />
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-slate-50 border ${isOpen ? 'border-primary ring-4 ring-primary/10' : 'border-slate-200'} rounded-xl p-3.5 text-slate-800 font-medium flex justify-between items-center cursor-pointer hover:bg-slate-100/50 transition-all`}
      >
        <span className={!value ? 'text-slate-400 font-normal' : ''}>
          {value ? options.find(o => o.id === value)?.nome : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-2xl overflow-hidden py-1 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95">
            <div 
              className={`px-4 py-3 text-sm cursor-pointer hover:bg-slate-50 flex items-center justify-between ${!value ? 'text-primary font-bold' : 'text-slate-500'}`}
              onClick={() => { onChange(''); setIsOpen(false); }}
            >
              {placeholder}
              {!value && <Check className="w-4 h-4" />}
            </div>
            {options.map(opt => {
              const isSelected = value === opt.id
              return (
                <div 
                  key={opt.id}
                  className={`px-4 py-3 text-sm cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-between ${isSelected ? 'bg-primary/5 text-primary font-bold' : 'text-slate-700 font-medium'}`}
                  onClick={() => { onChange(opt.id); setIsOpen(false); }}
                >
                  {opt.nome}
                  {isSelected && <Check className="w-4 h-4" />}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function DashboardClient({ lojas, enviando, recebendo, profile }: { lojas: any[], enviando: any[], recebendo: any[], profile: any }) {
  const [activeTab, setActiveTab] = useState<'enviando' | 'recebendo' | 'pendencias' | 'historico'>('enviando')
  const [admTab, setAdmTab] = useState<'gerencial' | 'lista'>('gerencial')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [novaOrigem, setNovaOrigem] = useState('')
  const [novoDestino, setNovoDestino] = useState('')
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
    actionType: 'separar' | 'enviar' | 'conferir' | 'resolver_pendencia' | null
  }>({ isOpen: false, transferId: null, actionType: null })

  const [conferirStatus, setConferirStatus] = useState<'ok' | 'pendencia'>('ok')
  const [fotosPendencia, setFotosPendencia] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const openActionModal = (id: string, type: 'separar' | 'enviar' | 'conferir' | 'resolver_pendencia') => {
    setActionModal({ isOpen: true, transferId: id, actionType: type })
    setConferirStatus('ok') // reset status
  }

  const closeActionModal = () => {
    setActionModal({ isOpen: false, transferId: null, actionType: null })
    setFotosPendencia([])
  }

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
    let totalLojasOriginadas: Record<string, number> = {};
    
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
  }, [isAdm, enviando, recebendo, activeTab, busca, filtroStatus, filtroMes, enviandoAtivos, recebendoAtivos, pendenciasUnicas, historicoUnico])

  const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage)
  const paginatedTransfers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredTransfers.slice(start, start + itemsPerPage)
  }, [filteredTransfers, currentPage])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    d.setHours(d.getHours() + 3) // adjust timezone naive
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
  }

  const calcDias = (dateStr: string) => {
    if (!dateStr) return 0
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return 0
    const diffTime = Math.abs(new Date().getTime() - d.getTime())
    return Math.floor(diffTime / (1000 * 60 * 60 * 24))
  }

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
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar por NF ou Loja..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-white/80 backdrop-blur-sm border border-gray-200/80 shadow-sm hover:shadow-md hover:border-gray-300 rounded-xl pl-12 pr-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-slate-400"
            />
          </div>
          <select 
            value={filtroMes} 
            onChange={(e) => setFiltroMes(e.target.value)}
            className="bg-white/80 backdrop-blur-sm border border-gray-200/80 shadow-sm hover:shadow-md hover:border-gray-300 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none pr-10 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1.2em_1.2em] bg-no-repeat bg-[right_0.75rem_center]"
          >
            <option value="TODOS">Todos os Meses</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
          <select 
            value={filtroStatus} 
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="bg-white/80 backdrop-blur-sm border border-gray-200/80 shadow-sm hover:shadow-md hover:border-gray-300 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all appearance-none pr-10 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1.2em_1.2em] bg-no-repeat bg-[right_0.75rem_center]"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="EM_TRANSITO">Somente em Trânsito</option>
            <option value="PENDENCIA">Pendências</option>
            <option value="CONCLUIDA">Concluídas</option>
          </select>
        </div>
      <div className="space-y-4 animate-in fade-in">
        {paginatedTransfers.length === 0 ? (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-12 flex flex-col items-center justify-center text-slate-500 font-sans">
            <Package className="w-12 h-12 mb-3 text-slate-300 opacity-80" />
            <p>Nenhuma transferência encontrada com estes filtros.</p>
          </div>
        ) : (
          paginatedTransfers.map(item => {
            const isOrigin = isAdm || profile?.loja_id === item.origem_loja_id
            const isDest = isAdm || profile?.loja_id === item.destino_loja_id
            const isExpanded = expandedItems.includes(item.id)
            const isPendencyState = item.situacao === 'PENDENCIA' || item.situacao === 'PENDENCIA_ENVIADA'
            const isConcluida = item.situacao === 'CONCLUIDA'

            let hoverBgClass = 'group-hover:bg-primary group-hover:border-primary group-hover:text-white'
            let borderHoverClass = 'hover:border-blue-200'
            let lineThemeClass = 'bg-blue-100'
            let truckThemeClass = 'text-blue-400 group-hover:text-primary'

            if (isPendencyState) {
              hoverBgClass = 'group-hover:bg-rose-600 group-hover:border-rose-600 group-hover:text-white'
              borderHoverClass = 'hover:border-rose-200'
              lineThemeClass = 'bg-rose-100'
              truckThemeClass = 'text-rose-400 group-hover:text-rose-600'
            } else if (isConcluida) {
              hoverBgClass = 'group-hover:bg-emerald-600 group-hover:border-emerald-600 group-hover:text-white'
              borderHoverClass = 'hover:border-emerald-200'
              lineThemeClass = 'bg-emerald-100'
              truckThemeClass = 'text-emerald-400 group-hover:text-emerald-600'
            } else if (activeTab === 'recebendo') {
              hoverBgClass = 'group-hover:bg-amber-500 group-hover:border-amber-500 group-hover:text-white'
              borderHoverClass = 'hover:border-amber-200'
              lineThemeClass = 'bg-amber-100'
              truckThemeClass = 'text-amber-400 group-hover:text-amber-500'
            }

            return (
              <div key={item.id} className={`relative bg-white rounded-2xl p-5 md:p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border border-gray-100 group shadow-sm ${borderHoverClass}`}>

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
                          {item.origem?.nome?.substring(0, 3) || 'ORI'}
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
                          {item.destino?.nome?.substring(0, 3) || 'DES'}
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{item.destino?.nome || 'Você'}</span>
                     </div>
                  </div>

                  {/* Bloco 2: Informações e Status */}
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <div className="text-slate-800 font-bold text-2xl tracking-tight">NF: {item.numero_nota}</div>
                      
                      <div className={`text-[10px] px-3 py-1 rounded-md font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${isPendencyState ? 'bg-red-50 text-red-700 border border-red-100' : item.situacao === 'CONCLUIDA' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                        {isPendencyState && <AlertCircle className="w-3 h-3" />}
                        {item.situacao === 'CONCLUIDA' && <CheckCircle className="w-3 h-3" />}
                        {!isPendencyState && item.situacao !== 'CONCLUIDA' && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />}
                        {item.situacao.replace(/_/g, ' ')}
                      </div>

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
                      <button onClick={() => openActionModal(item.id, 'separar')} className="px-5 py-2.5 text-sm bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-md active:scale-95">
                        Separar
                      </button>
                    )}
                    {isOrigin && item.situacao === 'SEPARADO' && (
                      <button onClick={() => openActionModal(item.id, 'enviar')} className="px-5 py-2.5 text-sm bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-md active:scale-95">
                        Enviar
                      </button>
                    )}
                    {isDest && item.situacao === 'ENVIADO' && (
                      <button onClick={async () => await avancarSituacao(item.id, 'receber')} className="px-5 py-2.5 text-sm bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all shadow-md active:scale-95">
                        Receber
                      </button>
                    )}
                    {isDest && item.situacao === 'RECEBIDO' && (
                      <button onClick={() => openActionModal(item.id, 'conferir')} className="px-5 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95">
                        Conferir
                      </button>
                    )}
                    {isOrigin && item.situacao === 'PENDENCIA' && (
                      <button onClick={() => openActionModal(item.id, 'resolver_pendencia')} className="px-5 py-2.5 text-sm bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 shadow-rose-200">
                        Resolver Pendência
                      </button>
                    )}
                    {isDest && item.situacao === 'PENDENCIA_ENVIADA' && (
                      <button onClick={async () => await avancarSituacao(item.id, 'receber_pendencia')} className="px-5 py-2.5 text-sm bg-primary hover:bg-primary/90 text-white font-bold rounded-lg transition-all shadow-md active:scale-95">
                        Receber Pendência
                      </button>
                    )}
                    
                    <button 
                      className={`p-2 rounded-xl transition-all ${isExpanded ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
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

                {/* Detalhes Expandidos */}
                {isExpanded && (
                  <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm animate-in fade-in slide-in-from-top-2 duration-300 pl-2">
                    {isPendencyState && item.observacao_pendencia && (
                      <div className="col-span-full mb-2 bg-gradient-to-r from-red-50 to-rose-50 border border-red-100/80 rounded-xl p-5 flex gap-4 shadow-sm">
                        <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <strong className="block text-red-700 mb-1.5 font-bold uppercase tracking-wide text-xs">Motivo da Pendência</strong>
                          <div className="text-red-900 leading-relaxed font-medium mb-3">
                            {item.observacao_pendencia.includes('||FOTOS||') ? (
                              <>
                                <p className="mb-3 whitespace-pre-wrap">{item.observacao_pendencia.split('||FOTOS||')[0]}</p>
                                <div className="mt-4">
                                  <strong className="block text-red-700 mb-2 font-bold text-[10px] uppercase tracking-wider">Fotos Anexadas</strong>
                                  <div className="flex gap-2 flex-wrap">
                                    {item.observacao_pendencia.split('||FOTOS||')[1].split(',').map((url: string, i: number) => (
                                      <a key={i} href={url.trim()} target="_blank" rel="noreferrer" className="inline-block border-2 border-red-200 rounded-lg overflow-hidden hover:opacity-80 transition-opacity hover:shadow-md">
                                        <img src={url.trim()} alt="Anexo Pendência" className="h-32 w-auto object-cover" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <p className="whitespace-pre-wrap">{item.observacao_pendencia}</p>
                            )}
                          </div>
                          {item.foto_pendencia_url && (
                            <div className="mt-4">
                              <strong className="block text-red-700 mb-2 font-bold text-[10px] uppercase tracking-wider">Foto da Resolução</strong>
                              <a href={item.foto_pendencia_url} target="_blank" rel="noreferrer" className="inline-block border-2 border-red-200 rounded-lg overflow-hidden hover:opacity-80 transition-opacity hover:shadow-md">
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
                )}
                
              </div>
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

      {/* MODAL DE AÇÕES */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-display font-bold text-slate-800 mb-6 tracking-wide uppercase">
              {actionModal.actionType === 'separar' && 'Confirmar Separação'}
              {actionModal.actionType === 'enviar' && 'Registrar Envio'}
              {actionModal.actionType === 'conferir' && 'Conferir Mercadoria'}
              {actionModal.actionType === 'resolver_pendencia' && 'Resolver Pendência'}
            </h3>
            
            <form action={async (formData) => {
              if (!actionModal.transferId || !actionModal.actionType) return

              if (actionModal.actionType === 'resolver_pendencia') {
                const obs = formData.get('observacao_resolucao') as string
                const foto = formData.get('foto') as File
                if ((!obs || obs.trim() === '') && (!foto || foto.size === 0)) {
                  toast.error('Você deve fornecer uma anotação ou uma foto para resolver a pendência.', { id: 'resolver_err' })
                  return
                }

                try {
                  toast.loading('Enviando...', { id: 'resolver' })
                  formData.append('transferenciaId', actionModal.transferId)
                  await resolverPendencia(formData)
                  toast.success('Pendência resolvida e enviada!', { id: 'resolver' })
                  closeActionModal()
                } catch (e: any) {
                  toast.error('Erro: ' + e.message, { id: 'resolver' })
                }
                return
              }

              let dados: any = {}
              if (actionModal.actionType === 'separar') {
                dados.separador = formData.get('separador')
                const vols = formData.get('volumes')
                dados.volumes = vols ? parseInt(vols as string) : null
              } else if (actionModal.actionType === 'enviar') {
                dados.motorista = formData.get('motorista')
              } else if (actionModal.actionType === 'conferir') {
                dados.conferente = formData.get('conferente')
                dados.tudoOk = conferirStatus === 'ok'
                if (!dados.tudoOk) {
                  dados.observacao = formData.get('observacao')
                }
              }

              try {
                toast.loading('Processando...', { id: 'acao' })
                let uploadedUrls: string[] = []
                if (actionModal.actionType === 'conferir' && conferirStatus === 'pendencia' && fotosPendencia.length > 0) {
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

                await avancarSituacao(actionModal.transferId, actionModal.actionType, dados)
                toast.success('Situação atualizada!', { id: 'acao' })
                closeActionModal()
              } catch (e: any) {
                toast.error('Erro: ' + e.message, { id: 'acao' })
              } finally {
                setIsUploading(false)
              }
            }} className="space-y-5 font-sans">

              {actionModal.actionType === 'separar' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Separador</label>
                    <input required type="text" name="separador" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Quem separou?" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Quantos Volumes? (Opcional)</label>
                    <input type="number" name="volumes" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors" placeholder="Ex: 3" />
                  </div>
                </>
              )}

              {actionModal.actionType === 'enviar' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Motorista</label>
                  <input required type="text" name="motorista" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="Quem está levando?" />
                </div>
              )}

              {actionModal.actionType === 'conferir' && (
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

              {actionModal.actionType === 'resolver_pendencia' && (
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

              <div className="pt-6 flex justify-end gap-3">
                <button type="button" onClick={closeActionModal} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" disabled={isUploading} className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all shadow-md active:scale-95 text-white disabled:opacity-50 ${actionModal.actionType === 'conferir' ? (conferirStatus === 'ok' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-secondary hover:bg-secondary/90') : 'bg-primary hover:bg-primary/90'}`}>
                  {isUploading ? 'Enviando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            
            <form action={async (formData) => {
              const destino = formData.get('destino') as string
              const numero_nota = formData.get('numero_nota') as string
              const volumes_str = formData.get('volumes') as string
              const observacao = formData.get('observacao') as string
              const origem_loja = formData.get('origem') as string
              
              if (!destino || !numero_nota) return
              
              const formDataAction = new FormData()
              formDataAction.append('numero_nota', numero_nota)
              formDataAction.append('destino_loja_id', destino)
              formDataAction.append('origem_loja_id', origem_loja || profile?.loja_id)
              if (volumes_str) formDataAction.append('volumes', volumes_str)
              if (observacao) formDataAction.append('observacao', observacao)
              formDataAction.append('emitida_por', profile?.nome || 'Admin')

              try {
                toast.loading('Criando...', { id: 'nova_transf' })
                await criarTransferencia(formDataAction)
                toast.success('Transferência criada!', { id: 'nova_transf' })
                setIsModalOpen(false)
              } catch (e: any) {
                toast.error('Erro ao criar: ' + e.message, { id: 'nova_transf' })
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Número da NF</label>
                  <input required type="number" name="numero_nota" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-800 font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all hover:bg-slate-100/50" placeholder="Ex: 12345" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Qtd. Volumes</label>
                  <input type="number" name="volumes" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-800 font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all hover:bg-slate-100/50" placeholder="Ex: 3" />
                </div>
              </div>

              <div className="pt-8 flex justify-end gap-3">
                <button type="button" onClick={() => { setIsModalOpen(false); setNovaOrigem(''); setNovoDestino(''); }} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="px-8 py-3 bg-primary text-white hover:bg-primary/90 font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Criar Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
