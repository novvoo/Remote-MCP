#!/usr/bin/env node

import { RemoteMCPClient } from './client.js';
import { HTTPMCPClient } from './http-client.js';

export { RemoteMCPClient } from './client.js';
export { HTTPMCPClient } from './http-client.js';
export default RemoteMCPClient;

const headers = Object.keys(process.env)
  .filter((key) => key.startsWith('HTTP_HEADER_'))
  .reduce(
    (headers, key) => {
      const headerKey = key
        .substring('HTTP_HEADER_'.length)
        .toLowerCase()
        .replace(/_/g, '-');
      const headerValue = process.env[key] || '';
      headers[headerKey] = headerValue;
      return headers;
    },
    {} as Record<string, string>,
  );

const remoteUrl = process.env.REMOTE_MCP_URL || 'http://localhost:9512';
const transport = process.env.REMOTE_MCP_TRANSPORT || 'trpc';

if (transport === 'http') {
  const client = new HTTPMCPClient({
    remoteUrl,
    headers,
  });
  void client.start();
} else {
  const client = new RemoteMCPClient({
    remoteUrl,
    headers,
  });
  void client.start();
}
