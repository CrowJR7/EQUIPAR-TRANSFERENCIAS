'use client'
import { useState, useEffect, useMemo } from 'react'
import { criarTransferencia, avancarSituacao, resolverPendencia } from '../actions'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronUp, Search, AlertCircle, Package, CheckCircle, Truck, Image as ImageIcon, Clock } from 'lucide-react'

export function DashboardClient({ lojas, enviando, recebendo, profile }: { lojas: any[], enviando: any[], recebendo: any[], profile: any }) {
  const [activeTab, setActiveTab] = useState<'enviando' | 'recebendo'>('enviando')
  const [isModalOpen, setIsModalOpen] = useState(false)
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

  const filteredTransfers = useMemo(() => {
    let list = isAdm ? enviando : (activeTab === 'enviando' ? enviando : recebendo)
    
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
    
    return list
  }, [isAdm, enviando, recebendo, activeTab, busca, filtroStatus, filtroMes])

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
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Painel de Transferências</h2>
          {isAdm && <p className="text-slate-500 text-sm">Visão Geral - Administrador</p>}
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-blue-700 text-white font-bold rounded-lg hover:bg-blue-800 transition-colors shadow-lg shadow-blue-700/20 flex items-center gap-2"
        >
          <Package className="w-5 h-5" />
          Nova Transferência
        </button>
      </div>

      {isAdm && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-2">
          <div 
            className="relative overflow-hidden bg-gradient-to-br from-white to-blue-50/50 border border-blue-100/50 shadow-sm hover:shadow-md hover:-translate-y-1 rounded-2xl p-6 flex items-center justify-between group transition-all duration-300 cursor-pointer" 
            onClick={() => setFiltroStatus('EM_TRANSITO')}
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-100/50 rounded-full blur-2xl group-hover:bg-blue-200/50 transition-colors" />
            <div className="relative z-10">
              <div className="text-blue-600/80 text-xs font-bold uppercase tracking-widest mb-1.5">Em Trânsito</div>
              <div className="text-4xl font-[Bebas_Neue] text-blue-700 tracking-wide">{transitoCount}</div>
            </div>
            <div className="relative z-10 w-14 h-14 rounded-2xl bg-white shadow-sm border border-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <Truck className="w-7 h-7" />
            </div>
          </div>

          <div 
            className="relative overflow-hidden bg-gradient-to-br from-white to-red-50/50 border border-red-100/50 shadow-sm hover:shadow-md hover:-translate-y-1 rounded-2xl p-6 flex items-center justify-between group transition-all duration-300 cursor-pointer" 
            onClick={() => setFiltroStatus('PENDENCIA')}
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-100/50 rounded-full blur-2xl group-hover:bg-red-200/50 transition-colors" />
            <div className="relative z-10">
              <div className="text-red-600/80 text-xs font-bold uppercase tracking-widest mb-1.5">Pendências</div>
              <div className="text-4xl font-[Bebas_Neue] text-red-600 tracking-wide">{pendenciasCount}</div>
            </div>
            <div className="relative z-10 w-14 h-14 rounded-2xl bg-white shadow-sm border border-red-50 flex items-center justify-center text-red-600 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <AlertCircle className="w-7 h-7" />
            </div>
          </div>

          <div 
            className="relative overflow-hidden bg-gradient-to-br from-white to-emerald-50/50 border border-emerald-100/50 shadow-sm hover:shadow-md hover:-translate-y-1 rounded-2xl p-6 flex items-center justify-between group transition-all duration-300 cursor-pointer" 
            onClick={() => setFiltroStatus('CONCLUIDA')}
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-100/50 rounded-full blur-2xl group-hover:bg-emerald-200/50 transition-colors" />
            <div className="relative z-10">
              <div className="text-emerald-600/80 text-xs font-bold uppercase tracking-widest mb-1.5">Concluídas</div>
              <div className="text-4xl font-[Bebas_Neue] text-emerald-600 tracking-wide">{concluidasCount}</div>
            </div>
            <div className="relative z-10 w-14 h-14 rounded-2xl bg-white shadow-sm border border-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
              <CheckCircle className="w-7 h-7" />
            </div>
          </div>
        </div>
      )}

      {!isAdm && (
        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            <button
              onClick={() => { setActiveTab('enviando'); setBusca(''); setFiltroStatus('TODOS') }}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'enviando'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Enviando ({enviando.length})
            </button>
            <button
              onClick={() => { setActiveTab('recebendo'); setBusca(''); setFiltroStatus('TODOS') }}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'recebendo'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Recebendo ({recebendo.length})
            </button>
          </nav>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar por NF ou Loja..." 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-white/80 backdrop-blur-sm border border-gray-200/80 shadow-sm hover:shadow-md hover:border-gray-300 rounded-xl pl-12 pr-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
          />
        </div>
        <select 
          value={filtroMes} 
          onChange={(e) => setFiltroMes(e.target.value)}
          className="bg-white/80 backdrop-blur-sm border border-gray-200/80 shadow-sm hover:shadow-md hover:border-gray-300 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none pr-10 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1.2em_1.2em] bg-no-repeat bg-[right_0.75rem_center]"
        >
          <option value="TODOS">Todos os Meses</option>
          {availableMonths.map(m => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
        <select 
          value={filtroStatus} 
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="bg-white/80 backdrop-blur-sm border border-gray-200/80 shadow-sm hover:shadow-md hover:border-gray-300 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none pr-10 bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:1.2em_1.2em] bg-no-repeat bg-[right_0.75rem_center]"
        >
          <option value="TODOS">Todos os Status</option>
          <option value="EM_TRANSITO">Somente em Trânsito</option>
          <option value="PENDENCIA">Pendências</option>
          <option value="CONCLUIDA">Concluídas</option>
        </select>
      </div>

      <div className="space-y-4">
        {paginatedTransfers.length === 0 ? (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-12 flex flex-col items-center justify-center text-slate-500 font-[DM_Sans]">
            <Package className="w-12 h-12 mb-3 text-slate-300 opacity-80" />
            <p>Nenhuma transferência encontrada com estes filtros.</p>
          </div>
        ) : (
          paginatedTransfers.map(item => {
            const isOrigin = isAdm || profile?.loja_id === item.origem_loja_id
            const isDest = isAdm || profile?.loja_id === item.destino_loja_id
            const isExpanded = expandedItems.includes(item.id)
            const isPendencyState = item.situacao === 'PENDENCIA' || item.situacao === 'PENDENCIA_ENVIADA'

            return (
              <div key={item.id} className={`relative bg-white rounded-2xl p-5 md:p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border border-gray-100 group shadow-sm ${isPendencyState ? 'hover:border-red-200' : 'hover:border-blue-200'}`}>

                {/* Linha Principal */}
                <div 
                  className="flex flex-col md:flex-row justify-between md:items-center gap-4 cursor-pointer"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-3 mb-2">
                      <div className="text-slate-800 font-[Bebas_Neue] text-2xl tracking-wide">NF: {item.numero_nota}</div>
                      <div className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 ${isPendencyState ? 'bg-red-50 text-red-700 ring-1 ring-red-200' : item.situacao === 'CONCLUIDA' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'}`}>
                        {isPendencyState && <AlertCircle className="w-3 h-3" />}
                        {item.situacao === 'CONCLUIDA' && <CheckCircle className="w-3 h-3" />}
                        {!isPendencyState && item.situacao !== 'CONCLUIDA' && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />}
                        {item.situacao.replace(/_/g, ' ')}
                      </div>
                      {!['CONCLUIDA', 'PENDENCIA', 'PENDENCIA_ENVIADA'].includes(item.situacao) && (
                        <div className="text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider bg-orange-50 text-orange-700 ring-1 ring-orange-200 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {['AGUARDANDO_SEPARACAO', 'SEPARADO'].includes(item.situacao) ? 'Em aberto há' : 'Em trânsito há'} {calcDias(item.created_at)} dias
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-slate-500 font-medium flex items-center gap-2">
                      <span className="text-slate-700">{item.origem?.nome || 'Você'}</span>
                      <Truck className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-700">{item.destino?.nome || 'Você'}</span>
                      <span className="text-slate-300 mx-1">|</span>
                      <span className="text-xs">Criada em: {formatDate(item.created_at)}</span>
                    </div>
                  </div>
                  
                  {/* Botões de Ação */}
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    {isOrigin && item.situacao === 'AGUARDANDO_SEPARACAO' && (
                      <button onClick={() => openActionModal(item.id, 'separar')} className="px-5 py-2.5 text-sm bg-gray-50 hover:bg-gray-100 text-slate-700 border border-gray-200 rounded-xl font-bold transition-all shadow-sm active:scale-95">
                        Separar
                      </button>
                    )}
                    {isOrigin && item.situacao === 'SEPARADO' && (
                      <button onClick={() => openActionModal(item.id, 'enviar')} className="px-5 py-2.5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95">
                        Enviar
                      </button>
                    )}
                    {isDest && item.situacao === 'ENVIADO' && (
                      <button onClick={async () => await avancarSituacao(item.id, 'receber')} className="px-5 py-2.5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95">
                        Receber
                      </button>
                    )}
                    {isDest && item.situacao === 'RECEBIDO' && (
                      <button onClick={() => openActionModal(item.id, 'conferir')} className="px-5 py-2.5 text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95">
                        Conferir
                      </button>
                    )}
                    {isOrigin && item.situacao === 'PENDENCIA' && (
                      <button onClick={() => openActionModal(item.id, 'resolver_pendencia')} className="px-5 py-2.5 text-sm bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-bold rounded-xl transition-all shadow-md shadow-red-500/20 active:scale-95">
                        Resolver Pendência
                      </button>
                    )}
                    {isDest && item.situacao === 'PENDENCIA_ENVIADA' && (
                      <button onClick={async () => await avancarSituacao(item.id, 'receber_pendencia')} className="px-5 py-2.5 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95">
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

      {/* MODAL DE AÇÕES */}
      {actionModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-[Bebas_Neue] text-slate-800 mb-6 tracking-wide uppercase">
              {actionModal.actionType === 'separar' && 'Confirmar Separação'}
              {actionModal.actionType === 'enviar' && 'Registrar Envio'}
              {actionModal.actionType === 'conferir' && 'Conferir Mercadoria'}
              {actionModal.actionType === 'resolver_pendencia' && 'Resolver Pendência'}
            </h3>
            
            <form action={async (formData) => {
              if (!actionModal.transferId || !actionModal.actionType) return

              if (actionModal.actionType === 'resolver_pendencia') {
                try {
                  toast.loading('Enviando...', { id: 'resolver' })
                  formData.append('transferenciaId', actionModal.transferId)
                  await resolverPendencia(formData)
                  toast.success('Pendência separada e enviada com foto!', { id: 'resolver' })
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
            }} className="space-y-5 font-[DM_Sans]">

              {actionModal.actionType === 'separar' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nome do Separador</label>
                    <input required type="text" name="separador" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="Quem separou?" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Quantos Volumes? (Opcional)</label>
                    <input type="number" name="volumes" className="w-full bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" placeholder="Ex: 3" />
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
                    <p>Você está separando os itens faltantes dessa pendência. Tire uma foto ou escolha da galeria para enviar.</p>
                  </div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Foto da Pendência Separada
                  </label>
                  <input required type="file" name="foto" accept="image/*" capture="environment" className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors border border-gray-300 rounded-lg bg-gray-50 p-2 cursor-pointer" />
                </div>
              )}

              <div className="pt-6 flex justify-end gap-3">
                <button type="button" onClick={closeActionModal} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" disabled={isUploading} className={`px-5 py-2.5 font-bold rounded-xl transition-all shadow-md active:scale-95 ${actionModal.actionType === 'conferir' ? (conferirStatus === 'ok' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-emerald-500/20' : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-red-500/20') : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20'} disabled:opacity-50`}>
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
          <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl p-8 w-full max-w-md shadow-[0_0_40px_-10px_rgba(0,0,0,0.2)]">
            <h3 className="text-3xl font-[Bebas_Neue] text-slate-800 mb-6 tracking-wide uppercase">
              Nova Transferência
            </h3>
            
            <form action={async (formData) => {
              const destino = formData.get('destino') as string
              const numero_nota = formData.get('numero_nota') as string
              const valor_str = formData.get('valor') as string
              const observacao = formData.get('observacao') as string
              const origem_loja = formData.get('origem') as string
              
              if (!destino || !numero_nota) return
              
              const formDataAction = new FormData()
              formDataAction.append('numero_nota', numero_nota)
              formDataAction.append('destino_loja_id', destino)
              formDataAction.append('origem_loja_id', origem_loja || profile?.loja_id)
              if (valor_str) formDataAction.append('valor', valor_str)
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
            }} className="space-y-5 font-[DM_Sans]">
              
              {!profile?.loja_id && (
                 <div>
                   <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-slate-400"/> Loja de Origem</label>
                   <select required name="origem" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all">
                     <option value="">Selecione a origem</option>
                     {lojas.map(loja => (
                       <option key={loja.id} value={loja.id}>{loja.nome}</option>
                     ))}
                   </select>
                 </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-slate-400"/> Loja de Destino</label>
                <select required name="destino" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all">
                  <option value="">Selecione o destino</option>
                  {lojas.filter(l => l.id !== profile?.loja_id).map(loja => (
                    <option key={loja.id} value={loja.id}>{loja.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Número da Nota Fiscal (NF)</label>
                <input required type="number" name="numero_nota" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="Ex: 12345" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Valor Total (R$)</label>
                <input type="number" step="0.01" name="valor" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all" placeholder="Ex: 1500.50" />
              </div>

              <div className="pt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
