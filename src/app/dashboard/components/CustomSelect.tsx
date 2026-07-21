import { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export const CustomSelect = ({ 
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
