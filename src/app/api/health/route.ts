export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({status:"ok",service:"naxium"},{headers:{"cache-control":"no-store"}});
}
