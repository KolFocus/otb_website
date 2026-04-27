import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
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
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // 未登录且不在 /login 页 → 跳转登录
  if (!user && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 已登录且访问 /login → 跳回首页
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 已登录且访问受保护页面 → 检查白名单
  if (user && pathname !== "/login") {
    const { data: member } = await supabase
      .from("otb_member")
      .select("granted")
      .eq("email", user.email!)
      .maybeSingle();

    if (!member || !member.granted) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL("/login?error=access_revoked", request.url)
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brands/|data/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
