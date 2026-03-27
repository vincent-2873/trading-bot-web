import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseSvc  = process.env.SUPABASE_SERVICE_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnon)

// 伺服器端用（有完整權限）
export const supabaseAdmin = () =>
  createClient(supabaseUrl, supabaseSvc, { auth: { persistSession: false } })

export type Signal = {
  id: number
  symbol: string
  market: 'TW' | 'US' | 'FUTURES' | 'CRYPTO'
  signal_type: 'BUY' | 'SELL' | 'HOLD'
  signal_strength: number
  entry_price: number
  stop_loss: number
  take_profit: number
  ai_analysis: string
  technical_summary: string
  news_sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
  created_at: string
}

export type LineUser = {
  id: number
  line_user_id: string
  display_name: string
  picture_url: string
  subscribed: boolean
  markets: string[]
  created_at: string
}

export type ReviewReport = {
  id: number
  report_date: string
  win_rate: number
  total_pnl_pct: number
  ai_review: Record<string, unknown>
  performance: Record<string, unknown>
}
