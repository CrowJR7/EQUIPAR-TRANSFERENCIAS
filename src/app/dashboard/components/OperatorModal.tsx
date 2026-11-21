'use client'

import { useState, useEffect } from 'react'
import { User, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function OperatorModal({ currentOperator, lojaNome }: { currentOperator?: string, lojaNome: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (!currentOperator) {
      setIsOpen(true)
    }
  }, [currentOperator])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || name.trim().length < 2) return
    
    // Set cookie without expiration date so it acts as a session cookie
    document.cookie = `operador_atual=${encodeURIComponent(name.trim().toUpperCase())}; path=/`
    
    setIsOpen(false)
    router.refresh()
  }

  return (
    <>
      <div className="flex items-center gap-4 text-right hidden sm:flex">
        <div>
          <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest mb-0.5">Atuando em</p>
          <h1 className="text-sm font-display font-bold text-white tracking-tight">
            {lojaNome}
          </h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 shadow-inner flex items-center justify-center text-white font-bold text-lg ml-2">
          {lojaNome === 'Administração Geral' ? 'AD' : lojaNome.charAt(0)}
        </div>
        
        {/* Separator */}
        <div className="w-px h-8 bg-white/10 mx-2"></div>

        <div>
          <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest mb-0.5">Operador Atual</p>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-display font-bold text-white tracking-tight">
              {currentOperator || '---'}
            </h1>
            <button 
              onClick={() => setIsOpen(true)}
              className="text-[10px] px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
            >
              Trocar
            </button>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 shadow-inner flex items-center justify-center text-white font-bold ml-2">
          <User className="w-5 h-5" />
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-[100] backdrop-blur-sm animate-in fade-in">
          <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8 w-full max-w-md shadow-2xl relative">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-display font-bold text-slate-800 tracking-wide uppercase">Quem é você?</h2>
              <p className="text-slate-500 text-sm mt-2">Informe seu nome para auditar as ações feitas neste terminal.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite seu nome (ex: CLEBIO)"
                  className="w-full text-center text-xl uppercase bg-slate-50 border border-slate-200 rounded-xl p-4 font-bold text-slate-800 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all hover:bg-slate-100/50"
                  autoFocus
                  required
                  minLength={2}
                />
              </div>
              <button 
                type="submit" 
                disabled={!name || name.trim().length < 2}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-5 h-5" />
                Começar a Usar
              </button>
            </form>
            
            {currentOperator && (
              <button 
                onClick={() => setIsOpen(false)}
                className="w-full mt-4 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
