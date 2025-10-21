import type { IncomingMessage, ServerResponse } from 'http';
import type { MCPRouter } from './router.js';

export interface HTTPAdapterOptions {
  router: MCPRouter;
  path?: string;
  cors?: boolean;
}

interface JSONRPCRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: unknown;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class HTTPAdapter {
  private router: MCPRouter;
  private path: string;
  private cors: boolean;

  constructor(options: HTTPAdapterOptions) {
    this.router = options.router;
    this.path = options.path || '/mcp/http';
    this.cors = options.cors ?? true;
  }

  private setCORSHeaders(res: ServerResponse) {
    if (this.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
  }

  private sendJSON(res: ServerResponse, statusCode: number, data: unknown) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  }

  private sendError(
    res: ServerResponse,
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown,
  ) {
    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message, data },
    };
    this.sendJSON(res, 200, response);
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    // Check if this request is for our path
    if (req.url !== this.path) {
      return false;
    }

    this.setCORSHeaders(res);

    // Handle OPTIONS for CORS preflight
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return true;
    }

    // Only accept POST
    if (req.method !== 'POST') {
      this.sendError(res, null, -32600, 'Invalid Request: Only POST is supported');
      return true;
    }

    // Read request body
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });

    await new Promise<void>((resolve) => {
      req.on('end', () => resolve());
    });

    let jsonrpcRequest: JSONRPCRequest;
    try {
      jsonrpcRequest = JSON.parse(body);
    } catch (error) {
      this.sendError(res, null, -32700, 'Parse error');
      return true;
    }

    // Validate JSON-RPC request
    if (jsonrpcRequest.jsonrpc !== '2.0' || !jsonrpcRequest.method) {
      this.sendError(res, jsonrpcRequest.id ?? null, -32600, 'Invalid Request');
      return true;
    }

    try {
      const result = await this.handleMethod(
        jsonrpcRequest.method,
        jsonrpcRequest.params,
      );

      const response: JSONRPCResponse = {
        jsonrpc: '2.0',
        id: jsonrpcRequest.id ?? null,
        result,
      };

      this.sendJSON(res, 200, response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.sendError(
        res,
        jsonrpcRequest.id ?? null,
        -32603,
        'Internal error',
        errorMessage,
      );
    }

    return true;
  }

  private async handleMethod(method: string, params: unknown): Promise<unknown> {
    switch (method) {
      case 'initialize':
        // biome-ignore lint/suspicious/noExplicitAny: JSON-RPC params need flexible typing
        return this.router.initialize(params as any);

      case 'tools/list':
        return { tools: await this.router.listTools() };

      case 'tools/call': {
        const callParams = params as { name: string; arguments?: unknown };
        return this.router.callTool(callParams.name, callParams.arguments);
      }

      case 'resources/list':
        return { resources: await this.router.listResources() };

      case 'resources/read': {
        const readParams = params as { uri: string };
        return { contents: await this.router.readResource(readParams.uri) };
      }

      case 'resources/subscribe': {
        const subParams = params as { uri: string };
        await this.router.subscribeToResource(subParams.uri);
        return {};
      }

      case 'resources/unsubscribe': {
        const unsubParams = params as { uri: string };
        await this.router.unsubscribeFromResource(unsubParams.uri);
        return {};
      }

      case 'prompts/list':
        return { prompts: await this.router.listPrompts() };

      case 'prompts/get': {
        const promptParams = params as { name: string; arguments?: Record<string, string> };
        return {
          messages: await this.router.getPrompt(
            promptParams.name,
            promptParams.arguments,
          ),
        };
      }

      default:
        throw new Error(`Method not found: ${method}`);
    }
  }

  createHandler() {
    return async (req: IncomingMessage, res: ServerResponse) => {
      const handled = await this.handle(req, res);
      if (!handled) {
        res.statusCode = 404;
        res.end('Not Found');
      }
    };
  }
}
