'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Clock, MessageSquare, AlertCircle, CheckCircle2, User, Image as ImageIcon } from 'lucide-react'

type HistoricoItem = {
  id: string
  transferencia_id: string
  perfil_id: string
  nome_usuario: string
  mensagem: string
  fotos: string | null
  tipo_acao: 'ABERTURA' | 'ATUALIZACAO' | 'RESOLUCAO_PARCIAL' | 'RESOLUCAO_TOTAL'
  created_at: string
}

export function PendencyTimeline({ transferenciaId, observacaoLegacy }: { transferenciaId: string, observacaoLegacy?: string | null }) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadHistorico() {
      const { data, error } = await supabase
        .from('historico_pendencias')
        .select('*')
        .eq('transferencia_id', transferenciaId)
        .order('created_at', { ascending: true })

      if (!error && data) {
        setHistorico(data)
      }
      setLoading(false)
    }

    if (transferenciaId) {
      loadHistorico()
    }
  }, [transferenciaId, supabase])

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (historico.length === 0) {
    if (observacaoLegacy) {
      let msg = observacaoLegacy
      if (msg.includes('||FOTOS||')) {
        msg = msg.split('||FOTOS||')[0].trim()
      }
      return (
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 border-red-200 bg-red-50 text-red-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Sistema (Legado)
                </div>
              </div>
              <div className="text-xs font-medium text-slate-500 mb-2">
                Abriu a pendência
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100">
                {msg}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="text-center p-4 text-slate-500 text-sm bg-slate-50 rounded-lg">
        Nenhum histórico encontrado para esta pendência.
      </div>
    )
  }

  const getIconAndColor = (tipo: string) => {
    switch (tipo) {
      case 'ABERTURA':
        return { icon: <AlertCircle className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' }
      case 'ATUALIZACAO':
        return { icon: <MessageSquare className="w-5 h-5" />, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' }
      case 'RESOLUCAO_PARCIAL':
        return { icon: <Clock className="w-5 h-5" />, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' }
      case 'RESOLUCAO_TOTAL':
        return { icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' }
      default:
        return { icon: <MessageSquare className="w-5 h-5" />, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' }
    }
  }

  const getLabel = (tipo: string) => {
    switch (tipo) {
      case 'ABERTURA': return 'Abriu a pendência'
      case 'ATUALIZACAO': return 'Enviou uma atualização'
      case 'RESOLUCAO_PARCIAL': return 'Resolveu parcialmente'
      case 'RESOLUCAO_TOTAL': return 'Resolveu totalmente a pendência'
      default: return 'Atualizou'
    }
  }

  return (
    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
      {historico.map((item) => {
        const style = getIconAndColor(item.tipo_acao)
        const date = new Date(item.created_at)
        const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        
        let fotosUrls: string[] = []
        if (item.fotos) {
          try {
             fotosUrls = item.fotos.split(',').filter(f => f.trim().length > 0)
          } catch(e) {}
        }

        return (
          <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${style.border} ${style.bg} ${style.color} shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2`}>
              {style.icon}
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {item.nome_usuario || 'Usuário'}
                </div>
                <time className="text-xs text-slate-500 font-medium">{dateStr}</time>
              </div>
              <div className="text-xs font-medium text-slate-500 mb-2">
                {getLabel(item.tipo_acao)}
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100">
                {item.mensagem}
              </div>
              
              {fotosUrls.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    Anexos ({fotosUrls.length})
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {fotosUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="block relative group overflow-hidden rounded-md border border-slate-200">
                        <img src={url} alt="Anexo" className="h-16 w-16 object-cover hover:scale-110 transition-transform" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
