import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getDefaultRouteForRole } from "@/lib/navigation";
import type { UserRole } from "@/types/database";

const protectedPrefixes = ["/admin", "/model", "/client"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request
  });

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
          response = NextResponse.next({
            request
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return response;
  }

  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const role = profile?.role as UserRole | undefined;

  if (!role) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("error", "missing_profile");
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(
      new URL(getDefaultRouteForRole(role), request.url)
    );
  }

  if (pathname.startsWith("/model") && role !== "model" && role !== "admin") {
    return NextResponse.redirect(
      new URL(getDefaultRouteForRole(role), request.url)
    );
  }

  if (pathname.startsWith("/client") && role !== "client" && role !== "admin") {
    return NextResponse.redirect(
      new URL(getDefaultRouteForRole(role), request.url)
    );
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/model/:path*", "/client/:path*"]
};
