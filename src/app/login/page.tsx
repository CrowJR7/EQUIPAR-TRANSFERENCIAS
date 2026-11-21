import { login, signup } from './actions'
import Image from 'next/image'
import { SubmitButton } from './submit-button'

export default async function LoginPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  }
) {
  const searchParams = await props.searchParams
  const errorMsg = searchParams.error as string

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] text-slate-900 font-sans">
      <div className="w-full max-w-sm p-8 space-y-8 bg-white rounded-2xl border border-gray-200/80 shadow-xl">
        <div className="text-center flex flex-col items-center">
          <div className="bg-primary p-6 rounded-2xl w-full flex justify-center mb-6 shadow-inner">
            <Image src="/logo.png" alt="Equipar Logo" width={220} height={80} className="object-contain drop-shadow-md" priority />
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-800 tracking-tight uppercase">Sistema de Transferências</h1>
          <p className="text-slate-500 mt-2 text-sm">Login para Lojas e Administração</p>
          {errorMsg && (
            <p className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-semibold border border-red-200 w-full">
              {errorMsg}
            </p>
          )}
        </div>

        <form className="space-y-5" action={login}>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="email">Email</label>
            <input 
              id="email"
              type="email" 
              name="email" 
              placeholder="ex: onix@equipar.com" 
              required 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-800 font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all hover:bg-slate-100/50 placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="password">Senha</label>
            <input 
              id="password"
              type="password" 
              name="password" 
              placeholder="Sua senha de acesso" 
              required 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-800 font-medium focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all hover:bg-slate-100/50 placeholder:text-slate-400 placeholder:font-normal"
            />
          </div>
          
          <div className="pt-4">
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  )
}
