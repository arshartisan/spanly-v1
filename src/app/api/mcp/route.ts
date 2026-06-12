import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/server/api-keys";
import { handleMcpMessage } from "@/server/mcp";

/**
 * MCP endpoint (Phase 11, doc 12). Streamable-HTTP transport, stateless: authenticate by API key
 * (Bearer + API add-on gate, identical to the public v1 API), then dispatch the JSON-RPC message.
 * Single messages and batches are supported; notifications get a 202 with no body.
 */
export async function POST(req: Request) {
  const auth = await authorizeApiRequest(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error." } },
      { status: 400 },
    );
  }

  // Batch: array of messages → array of responses (notifications omitted).
  if (Array.isArray(body)) {
    const responses = (await Promise.all(auth.userId ? body.map((m) => handleMcpMessage(auth.userId, m)) : [])).filter(
      (r): r is object => r !== null,
    );
    if (responses.length === 0) return new NextResponse(null, { status: 202 });
    return NextResponse.json(responses);
  }

  const response = await handleMcpMessage(auth.userId, body);
  if (response === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(response);
}

// The stateless server doesn't open server→client SSE streams.
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. POST JSON-RPC messages to this endpoint." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
