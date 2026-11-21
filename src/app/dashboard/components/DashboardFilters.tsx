import { Search } from 'lucide-react'
import { FilterSelect } from './CustomSelect'

interface DashboardFiltersProps {
  busca: string
  setBusca: (val: string) => void
  filtroMes: string
  setFiltroMes: (val: string) => void
  filtroStatus: string
  setFiltroStatus: (val: string) => void
  availableMonths: string[]
  formatMonth: (yyyyMm: string) => string
}

export function DashboardFilters({
  busca,
  setBusca,
  filtroMes,
  setFiltroMes,
  filtroStatus,
  setFiltroStatus,
  availableMonths,
  formatMonth
}: DashboardFiltersProps) {
  return (
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
      <FilterSelect 
        value={filtroMes} 
        onChange={setFiltroMes}
        placeholder="Todos os Meses"
        options={[
          { id: 'TODOS', nome: 'Todos os Meses' },
          ...availableMonths.map(m => ({ id: m, nome: formatMonth(m) }))
        ]}
      />
      <FilterSelect 
        value={filtroStatus} 
        onChange={setFiltroStatus}
        placeholder="Todos os Status"
        options={[
          { id: 'TODOS', nome: 'Todos os Status' },
          { id: 'EM_TRANSITO', nome: 'Somente em Trânsito' },
          { id: 'PENDENCIA', nome: 'Pendências' },
          { id: 'CONCLUIDA', nome: 'Concluídas' }
        ]}
      />
    </div>
  )
}
