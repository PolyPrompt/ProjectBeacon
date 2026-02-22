import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from "next/server";
import { isE2EAuthBypassEnabled } from "@/lib/auth/e2e-bypass";

const isProtectedPageRoute = createRouteMatcher(["/projects(.*)"]);
const isApiRoute = createRouteMatcher(["/api(.*)"]);
const isPublicApiRoute = createRouteMatcher([
  "/api/public(.*)",
  "/api/health(.*)",
]);

const clerkAuthMiddleware = clerkMiddleware(async (auth, request) => {
  if (isProtectedPageRoute(request)) {
    const { userId } = await auth();

    if (!userId) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect_url", request.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  if (isApiRoute(request) && !isPublicApiRoute(request)) {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required.",
            details: null,
          },
        },
        { status: 401 },
      );
    }
  }

  return NextResponse.next();
});

export default function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  if (isE2EAuthBypassEnabled()) {
    return NextResponse.next();
  }

  return clerkAuthMiddleware(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
