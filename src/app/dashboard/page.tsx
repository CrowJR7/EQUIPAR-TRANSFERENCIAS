import { createClient } from '@/utils/supabase/server'
import { DashboardClient } from './components/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single()

  const { data: lojas, error: lojasError } = await supabase.from('lojas').select('*').order('nome')

  if (lojasError) {
    console.error('Erro buscando lojas:', lojasError)
  }

  let enviandoQuery = supabase
    .from('transferencias')
    .select('*, destino:lojas!transferencias_destino_loja_id_fkey(nome), origem:lojas!transferencias_origem_loja_id_fkey(nome)')
    .order('created_at', { ascending: false })

  let recebendoQuery = supabase
    .from('transferencias')
    .select('*, destino:lojas!transferencias_destino_loja_id_fkey(nome), origem:lojas!transferencias_origem_loja_id_fkey(nome)')
    .order('created_at', { ascending: false })

  if (profile?.role !== 'admin' && profile?.loja_id) {
    enviandoQuery = enviandoQuery.eq('origem_loja_id', profile.loja_id)
    recebendoQuery = recebendoQuery.eq('destino_loja_id', profile.loja_id)
  }

  const { data: enviando } = await enviandoQuery
  const { data: recebendo } = await recebendoQuery

  return (
    <DashboardClient 
      lojas={lojas || []} 
      enviando={enviando || []} 
      recebendo={recebendo || []} 
      profile={profile}
    />
  )
}
