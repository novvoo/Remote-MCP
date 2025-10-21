import { createServer } from 'node:http';
import { LogLevel, MCPRouter, HTTPAdapter } from '@remote-mcp/server';
import { z } from 'zod';

// Create router instance
const mcpRouter = new MCPRouter({
  logLevel: LogLevel.DEBUG,
  name: 'http-example-server',
  version: '1.0.0',
  capabilities: {
    logging: {},
  },
});

// Add example tool
mcpRouter.addTool(
  'calculator',
  {
    description:
      'Perform basic calculations. Add, subtract, multiply, divide. Invoke this every time you need to perform a calculation.',
    schema: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.string(),
      b: z.string(),
    }),
  },
  async (args) => {
    const a = Number(args.a);
    const b = Number(args.b);

    let result: number;
    switch (args.operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) throw new Error('Division by zero');
        result = a / b;
        break;
    }

    return {
      content: [{ type: 'text', text: `${result}` }],
    };
  },
);

// Create HTTP adapter
const httpAdapter = new HTTPAdapter({
  router: mcpRouter,
  path: '/mcp/http',
  cors: true,
});

// Create HTTP server
const server = createServer(httpAdapter.createHandler());

const port = Number(process.env.PORT || 9513);
server.listen(port, () => {
  console.log(`HTTP MCP Server listening on http://localhost:${port}/mcp/http`);
});
