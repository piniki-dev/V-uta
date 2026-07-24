import { NextResponse, type NextRequest } from 'next/server'
import { get } from '@vercel/edge-config'
import { updateSession } from '@/utils/supabase/proxy'

const BYPASS_TOKEN = process.env.MAINTENANCE_BYPASS_TOKEN
const BYPASS_COOKIE_NAME = 'vuta_maintenance_bypass'

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // 1. クエリパラメータでバイパスキーが渡された場合のチェック（環境変数が設定されている場合のみ有効）
  const bypassParam = searchParams.get('bypass')
  const isBypassAttempt = Boolean(BYPASS_TOKEN && bypassParam === BYPASS_TOKEN)
  const hasBypassCookie = isBypassAttempt || request.cookies.get(BYPASS_COOKIE_NAME)?.value === 'true'

  // 2. Vercel Edge Config またはローカル環境変数からメンテナンスフラグを取得
  let isMaintenance = process.env.LOCAL_MAINTENANCE === 'true'

  if (!isMaintenance && process.env.EDGE_CONFIG) {
    try {
      const maintenanceStatus = await get<boolean>('isMaintenance')
      isMaintenance = Boolean(maintenanceStatus)
    } catch (error) {
      console.error('[Proxy] Failed to fetch Edge Config:', error)
    }
  }

  // 3. メンテナンスモード中の制御
  if (isMaintenance && !hasBypassCookie) {
    if (pathname !== '/maintenance') {
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-is-maintenance', 'true')

      const response = NextResponse.rewrite(new URL('/maintenance', request.url), {
        status: 503,
        statusText: 'Service Unavailable',
        request: {
          headers: requestHeaders,
        },
      })
      response.headers.set('Retry-After', '3600')
      return response
    }
    return NextResponse.next()
  }

  // 4. 通常時（isMaintenance = false）に /maintenance に直接アクセスされた場合はトップへリダイレクト
  if (!isMaintenance && pathname === '/maintenance') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 5. 通常時の Supabase セッション更新処理
  const response = await updateSession(request)

  // バイパスURLアクセス時はバイパスクッキーを付与
  if (isBypassAttempt) {
    response.cookies.set(BYPASS_COOKIE_NAME, 'true', {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * 以下のパスを除くすべてのリクエストで実行:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化API)
     * - favicon.ico (ファビコン)
     * - auth/callback
     * - 画像拡張子 (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
