import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function proxyRequest(req: NextRequest) {
  const url = new URL(req.url);
  const backendPath = url.pathname.replace("/api/backend", "");
  const backendUrl = `${API_BASE}${backendPath}${url.search}`;

  // Forward Authorization and Content-Type headers from the browser request
  const headers: Record<string, string> = {};
  const auth = req.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;
  const ct = req.headers.get("content-type");
  // Only forward Content-Type for non-multipart requests;
  // for multipart, let fetch set it with the correct boundary
  const isMultipart = ct?.includes("multipart/form-data");
  if (ct && !isMultipart) headers["Content-Type"] = ct;

  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    if (isMultipart) {
      // Stream binary body as-is to preserve file data
      fetchOptions.body = await req.arrayBuffer();
      // Re-set Content-Type with original boundary for multipart
      if (ct) headers["Content-Type"] = ct;
      fetchOptions.headers = headers;
    } else {
      const body = await req.text();
      if (body) fetchOptions.body = body;
    }
  }

  try {
    console.log(`[proxy] ${req.method} ${backendUrl}`);
    const res = await fetch(backendUrl, fetchOptions);
    const data = await res.text();
    if (res.status >= 400) {
      console.error(`[proxy] ${res.status} response: ${data.slice(0, 500)}`);
    }

    return new NextResponse(data, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown";
    console.error(`[proxy] fetch error: ${msg}`);
    return NextResponse.json(
      { detail: `Backend unreachable: ${msg}` },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest) {
  return proxyRequest(req);
}

export async function POST(req: NextRequest) {
  return proxyRequest(req);
}

export async function PUT(req: NextRequest) {
  return proxyRequest(req);
}

export async function PATCH(req: NextRequest) {
  return proxyRequest(req);
}

export async function DELETE(req: NextRequest) {
  return proxyRequest(req);
}
