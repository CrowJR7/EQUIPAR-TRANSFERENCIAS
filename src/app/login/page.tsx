import { login, signup } from './actions'
import Image from 'next/image'

export default async function LoginPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  }
) {
  const searchParams = await props.searchParams
  const errorMsg = searchParams.error as string

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-slate-900">
      <div className="w-full max-w-sm p-8 space-y-8 bg-white rounded-xl border border-gray-200 shadow-xl">
        <div className="text-center flex flex-col items-center">
          <div className="bg-blue-700 p-4 rounded-xl w-full flex justify-center mb-6 shadow-inner">
            <Image src="/logo.png" alt="Equipar Logo" width={220} height={80} className="object-contain" />
          </div>
          <h1 className="text-xl font-[Bebas_Neue] text-slate-800 tracking-wider uppercase">Sistema de Transferências</h1>
          <p className="text-slate-500 mt-1 text-sm font-[DM_Sans]">Login para Lojas e Administração</p>
          {errorMsg && (
            <p className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-semibold border border-red-200 w-full">
              {errorMsg}
            </p>
          )}
        </div>

        <form className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="ex: onix@equipar.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="password">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          
          <div className="pt-4">
            <button
              formAction={login}
              className="w-full py-3 bg-blue-700 text-white font-bold rounded-lg hover:bg-blue-800 transition-colors shadow-lg shadow-blue-700/20"
            >
              Entrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
