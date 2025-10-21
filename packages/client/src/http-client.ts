import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  InitializeRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export interface HTTPMCPClientOptions {
  remoteUrl: string;
  headers?: Record<string, string>;
  onError?: (method: string, error: Error) => void;
}

interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
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

export class HTTPMCPClient {
  public readonly server: Server;
  private readonly options: HTTPMCPClientOptions;
  private requestId = 0;

  constructor(options: HTTPMCPClientOptions) {
    this.server = new Server(
      {
        name: 'Remote MCP HTTP Client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {
            listChanged: true,
          },
          resources: {
            subscribe: true,
            listChanged: true,
          },
          prompts: {
            listChanged: true,
          },
          logging: {},
        },
      },
    );

    this.options = {
      onError: (method, error) => {
        this.server.sendLoggingMessage({
          level: 'error',
          data: `${method}: ${error.message}`,
        });
      },
      ...options,
    };
  }

  private async sendRequest(method: string, params?: unknown): Promise<unknown> {
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params,
    };

    const response = await fetch(this.options.remoteUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.options.headers,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const jsonResponse: JSONRPCResponse = await response.json();

    if (jsonResponse.error) {
      throw new Error(
        `JSON-RPC error ${jsonResponse.error.code}: ${jsonResponse.error.message}`,
      );
    }

    return jsonResponse.result;
  }

  private async setupHandlers() {
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      try {
        const result = await this.sendRequest('initialize', request.params);
        // biome-ignore lint/suspicious/noExplicitAny: MCP SDK requires flexible return types
        return result as any;
      } catch (error) {
        this.options.onError?.(request.method, error as Error);
        throw error;
      }
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      try {
        const result = await this.sendRequest('tools/list', request.params);
        // biome-ignore lint/suspicious/noExplicitAny: MCP SDK requires flexible return types
        return result as any;
      } catch (error) {
        this.options.onError?.(request.method, error as Error);
        throw error;
      }
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const result = await this.sendRequest('tools/call', request.params);
        // biome-ignore lint/suspicious/noExplicitAny: MCP SDK requires flexible return types
        return result as any;
      } catch (error) {
        this.options.onError?.(request.method, error as Error);
        throw error;
      }
    });

    this.server.setRequestHandler(
      ListResourcesRequestSchema,
      async (request) => {
        try {
          const result = await this.sendRequest('resources/list', request.params);
          // biome-ignore lint/suspicious/noExplicitAny: MCP SDK requires flexible return types
          return result as any;
        } catch (error) {
          this.options.onError?.(request.method, error as Error);
          throw error;
        }
      },
    );

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        try {
          const result = await this.sendRequest('resources/read', request.params);
          // biome-ignore lint/suspicious/noExplicitAny: MCP SDK requires flexible return types
          return result as any;
        } catch (error) {
          this.options.onError?.(request.method, error as Error);
          throw error;
        }
      },
    );

    this.server.setRequestHandler(SubscribeRequestSchema, async (request) => {
      try {
        const result = await this.sendRequest('resources/subscribe', request.params);
        // biome-ignore lint/suspicious/noExplicitAny: MCP SDK requires flexible return types
        return result as any;
      } catch (error) {
        this.options.onError?.(request.method, error as Error);
        throw error;
      }
    });

    this.server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
      try {
        const result = await this.sendRequest(
          'resources/unsubscribe',
          request.params,
        );
        // biome-ignore lint/suspicious/noExplicitAny: MCP SDK requires flexible return types
        return result as any;
      } catch (error) {
        this.options.onError?.(request.method, error as Error);
        throw error;
      }
    });

    this.server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
      try {
        const result = await this.sendRequest('prompts/list', request.params);
        // biome-ignore lint/suspicious/noExplicitAny: MCP SDK requires flexible return types
        return result as any;
      } catch (error) {
        this.options.onError?.(request.method, error as Error);
        throw error;
      }
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      try {
        const result = await this.sendRequest('prompts/get', request.params);
        // biome-ignore lint/suspicious/noExplicitAny: MCP SDK requires flexible return types
        return result as any;
      } catch (error) {
        this.options.onError?.(request.method, error as Error);
        throw error;
      }
    });
  }

  async start() {
    this.setupHandlers();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}
