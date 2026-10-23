import { NextResponse } from "next/server";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const mac = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s).digest();
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const account = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME || "dashreply-videos";
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!account || !accessKey || !secretKey || !publicUrl) return NextResponse.json({ error: "R2 não configurado: confira R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY na Vercel." }, { status: 503 });
  try {
    const body = await request.json();
    const filename = typeof body.filename === "string" ? body.filename.slice(0, 180) : "";
    const contentType = typeof body.contentType === "string" ? body.contentType.slice(0, 100) : "";
    const size = Number(body.size);
    if (!filename || !contentType.startsWith("video/") || !Number.isFinite(size) || size <= 0 || size > 300 * 1024 * 1024) return NextResponse.json({ error: "Selecione um vídeo válido de até 300 MB." }, { status: 400 });
    const ext = filename.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0]?.toLowerCase() || ".video";
    const key = "uploads/" + randomUUID() + ext;
    const host = account + ".r2.cloudflarestorage.com";
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const day = date.slice(0, 8);
    const scope = day + "/auto/s3/aws4_request";
    const path = "/" + enc(bucket) + "/" + key.split("/").map(enc).join("/");
    const params: Record<string,string> = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": accessKey + "/" + scope,
      "X-Amz-Date": date,
      "X-Amz-Expires": "900",
      "X-Amz-SignedHeaders": "content-type;host"
    };
    const query = Object.keys(params).sort().map(k => enc(k) + "=" + enc(params[k])).join("&");
    const canonicalHeaders = "content-type:" + contentType.trim() + "\nhost:" + host + "\n";
    const canonicalRequest = ["PUT", path, query, canonicalHeaders, "content-type;host", "UNSIGNED-PAYLOAD"].join("\n");
    const stringToSign = ["AWS4-HMAC-SHA256", date, scope, hash(canonicalRequest)].join("\n");
    const kDate = mac("AWS4" + secretKey, day);
    const kRegion = mac(kDate, "auto");
    const kService = mac(kRegion, "s3");
    const kSigning = mac(kService, "aws4_request");
    const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
    return NextResponse.json({
      uploadUrl: "https://" + host + path + "?" + query + "&X-Amz-Signature=" + signature,
      key,
      publicUrl: publicUrl + "/" + key.split("/").map(enc).join("/"),
      contentType
    });
  } catch (error) {
    console.error("R2 presign failed", error);
    return NextResponse.json({ error: "Não foi possível preparar o upload." }, { status: 500 });
  }
}
