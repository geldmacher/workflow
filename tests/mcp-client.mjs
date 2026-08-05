import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export function workflowClient(name, roots = [], { advertiseRoots = true, rootError = null } = {}) {
  const client = new Client(
    { name, version: "1.0.0" },
    { capabilities: advertiseRoots ? { roots: { listChanged: true } } : {} },
  );
  if (advertiseRoots) {
    client.setRequestHandler(ListRootsRequestSchema, async () => {
      if (rootError) throw new Error(rootError);
      return { roots: roots.map((path) => ({ uri: pathToFileURL(path).href })) };
    });
  }
  return client;
}
