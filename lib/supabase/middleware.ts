import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 매 요청마다 세션을 갱신하고, 미로그인 사용자는 /login 으로 보낸다.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 로그인한 사용자의 역할 확인 — 대리점(dealer)은 사후관리만 접근
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const isDealer = profile?.role === "dealer";

    if (path.startsWith("/login")) {
      const url = request.nextUrl.clone();
      url.pathname = isDealer ? "/aftercare" : "/";
      return NextResponse.redirect(url);
    }

    if (
      isDealer &&
      !path.startsWith("/aftercare") &&
      !path.startsWith("/help")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/aftercare";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
