// Always served fresh so the client can compare the live build against the
// version baked into its currently-running bundle.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    { version: process.env.NEXT_PUBLIC_BUILD_VERSION ?? "dev" },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
