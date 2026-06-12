import "server-only";
import { z } from "zod";
import { prisma } from "@/server/db";
import { createApiTextPost, getPublishingState } from "@/server/posts";

/**
 * Minimal MCP (Model Context Protocol) server (Phase 11). Exposes a small set of Spanly tools
 * to AI agents over the Streamable-HTTP transport — i.e. JSON-RPC 2.0 messages POSTed to
 * `/api/mcp`. The transport stays stateless: each request is authenticated by API key (same
 * Bearer + add-on gate as the public v1 API, doc 12) and answered with a single JSON response.
 *
 * We hand-roll the protocol (initialize / tools/list / tools/call) rather than pull in the MCP
 * SDK + a Node transport, matching the project's dependency-light posture and keeping the whole
 * surface trivially testable over plain fetch. Tools reuse the exact posts service used by the
 * REST API, so the two programmatic surfaces can never drift.
 */

export const MCP_PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "spanly", version: "1.0.0" };

// ─────────────────────────── tool definitions ───────────────────────────

const TOOLS = [
  {
    name: "list_accounts",
    description: "List the user's connected (active) social accounts, with their platform, handle, and supported post types.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "create_post",
    description:
      "Create a text post and either publish it now or schedule it. Provide the target account IDs (from list_accounts). Returns the created post id and status.",
    inputSchema: {
      type: "object",
      properties: {
        caption: { type: "string", description: "The post text/caption." },
        accountIds: {
          type: "array",
          items: { type: "string" },
          description: "IDs of the accounts to post to (from list_accounts).",
        },
        publishAt: {
          type: "string",
          description: "Optional ISO-8601 instant to schedule for. Omit to publish immediately.",
        },
      },
      required: ["caption", "accountIds"],
      additionalProperties: false,
    },
  },
  {
    name: "get_post_status",
    description: "Get the current status of a post and each of its per-account targets (status, link, error).",
    inputSchema: {
      type: "object",
      properties: { postId: { type: "string", description: "The post id returned by create_post." } },
      required: ["postId"],
      additionalProperties: false,
    },
  },
] as const;

// ─────────────────────────── tool execution ───────────────────────────

const createPostArgs = z.object({
  caption: z.string().min(1).max(5000),
  accountIds: z.array(z.string()).min(1).max(50),
  publishAt: z.string().datetime().optional(),
});
const getStatusArgs = z.object({ postId: z.string().min(1) });

/** A tool result: `data` is JSON-encoded into MCP text content; `isError` marks tool failures. */
type ToolResult = { data: unknown; isError?: boolean };

async function callTool(userId: string, name: string, args: unknown): Promise<ToolResult> {
  switch (name) {
    case "list_accounts": {
      const accounts = await prisma.socialAccount.findMany({
        where: { userId, disconnectedAt: null, status: "active" },
        orderBy: { connectedAt: "asc" },
      });
      return {
        data: {
          accounts: accounts.map((a) => ({
            id: a.id,
            platform: a.platform,
            handle: a.handle,
            displayName: a.displayName,
            capabilities: a.capabilities,
          })),
        },
      };
    }

    case "create_post": {
      const parsed = createPostArgs.safeParse(args);
      if (!parsed.success) {
        return { data: { error: "Invalid arguments.", issues: parsed.error.flatten() }, isError: true };
      }
      const outcome = await createApiTextPost(userId, {
        caption: parsed.data.caption,
        accountIds: parsed.data.accountIds,
        publishAt: parsed.data.publishAt ? new Date(parsed.data.publishAt) : undefined,
      });
      if (!outcome.ok) {
        return { data: { error: outcome.errors }, isError: true };
      }
      return {
        data: { id: outcome.post.id, status: outcome.post.status, publishAt: outcome.post.publishAt },
      };
    }

    case "get_post_status": {
      const parsed = getStatusArgs.safeParse(args);
      if (!parsed.success) {
        return { data: { error: "Invalid arguments.", issues: parsed.error.flatten() }, isError: true };
      }
      const state = await getPublishingState(userId, parsed.data.postId);
      if (!state) return { data: { error: "Post not found." }, isError: true };
      return { data: state };
    }

    default:
      return { data: { error: `Unknown tool: ${name}` }, isError: true };
  }
}

// ─────────────────────────── JSON-RPC dispatch ───────────────────────────

type JsonRpcId = string | number | null;
type JsonRpcMessage = { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: unknown };

function result(id: JsonRpcId, value: unknown) {
  return { jsonrpc: "2.0" as const, id, result: value };
}
function error(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

/**
 * Handle one JSON-RPC message for the authenticated user. Returns the response object, or null
 * for notifications (which the transport answers with 202 + empty body).
 */
export async function handleMcpMessage(
  userId: string,
  msg: JsonRpcMessage,
): Promise<object | null> {
  const { id = null, method } = msg;

  // Notifications (e.g. notifications/initialized) carry no id and expect no response.
  if (method?.startsWith("notifications/")) return null;

  switch (method) {
    case "initialize": {
      const params = (msg.params ?? {}) as { protocolVersion?: string };
      return result(id, {
        protocolVersion: params.protocolVersion ?? MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    }

    case "ping":
      return result(id, {});

    case "tools/list":
      return result(id, { tools: TOOLS });

    case "tools/call": {
      const params = (msg.params ?? {}) as { name?: string; arguments?: unknown };
      if (!params.name) return error(id, -32602, "Missing tool name.");
      const out = await callTool(userId, params.name, params.arguments ?? {});
      return result(id, {
        content: [{ type: "text", text: JSON.stringify(out.data, null, 2) }],
        isError: out.isError ?? false,
      });
    }

    default:
      return error(id, -32601, `Method not found: ${method ?? "(none)"}`);
  }
}
