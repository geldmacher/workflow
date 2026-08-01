#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  WorkflowEngine,
  buildDeliveryEvidence,
  deriveWorkflowState,
  persistCloseout
} from "./chunks/chunk-H6F3AQXB.mjs";
import {
  AjvJsonSchemaValidator,
  CallToolRequestSchema,
  CallToolResultSchema,
  CompleteRequestSchema,
  CreateMessageResultSchema,
  CreateMessageResultWithToolsSchema,
  CreateTaskResultSchema,
  ElicitResultSchema,
  EmptyResultSchema,
  ErrorCode,
  GetPromptRequestSchema,
  InitializeRequestSchema,
  InitializedNotificationSchema,
  LATEST_PROTOCOL_VERSION,
  ListPromptsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListRootsResultSchema,
  ListToolsRequestSchema,
  LoggingLevelSchema,
  McpError,
  Protocol,
  ReadBuffer,
  ReadResourceRequestSchema,
  RootsListChangedNotificationSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
  SetLevelRequestSchema,
  WORKFLOW_TOOL_NAMES,
  ZodOptional,
  _enum,
  array,
  assertClientRequestTaskCapability,
  assertCompleteRequestPrompt,
  assertCompleteRequestResourceTemplate,
  assertToolsCallTaskCapability,
  awaitCooperativeExit,
  clearWorkerControl,
  getLiteralValue,
  getObjectShape,
  getParseErrorMessage,
  getSchemaDescription,
  isSchemaOptional,
  literal,
  mergeCapabilities,
  normalizeObjectSchema,
  number,
  object,
  objectFromShape,
  safeParse,
  safeParseAsync,
  serializeMessage,
  string,
  toJsonSchemaCompat,
  writeWorkerControl
} from "./chunks/chunk-URFRP5RQ.mjs";
import {
  PlanningEngine,
  approveVerificationProfile,
  auditVerificationProfile,
  draftVerificationProfile,
  inspectVerificationProfile,
  recordVerificationProof,
  resolveCapabilities
} from "./chunks/chunk-GFL7YVNY.mjs";
import {
  loadWorkflowConfig,
  resolveRouteProfile
} from "./chunks/chunk-XAJC6UTH.mjs";
import {
  CursorWorkerAdapter
} from "./chunks/chunk-5IA5FVOS.mjs";
import "./chunks/chunk-PKEO6PA3.mjs";
import {
  ArtifactHandoffStore
} from "./chunks/chunk-ZS6XCYJ6.mjs";
import {
  effectiveCliSummary,
  inspectArtifactSet,
  inspectArtifactText
} from "./chunks/chunk-J7XAELOI.mjs";
import {
  PreparationStore,
  RunStore,
  defaultStateRoot
} from "./chunks/chunk-MAHZMMXQ.mjs";
import {
  PLUGIN_VERSION,
  assertCompatibleRun,
  preparationView,
  runView
} from "./chunks/chunk-YCJPA23W.mjs";
import "./chunks/chunk-IQRLCJ3K.mjs";

// src/mcp/workflow-mcp.mjs
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync as mkdirSync2, rmSync as rmSync2 } from "node:fs";
import { dirname as dirname2, join as join3, resolve as resolve3 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// node_modules/@modelcontextprotocol/sdk/dist/esm/experimental/tasks/server.js
var ExperimentalServerTasks = class {
  constructor(_server) {
    this._server = _server;
  }
  /**
   * Sends a request and returns an AsyncGenerator that yields response messages.
   * The generator is guaranteed to end with either a 'result' or 'error' message.
   *
   * This method provides streaming access to request processing, allowing you to
   * observe intermediate task status updates for task-augmented requests.
   *
   * @param request - The request to send
   * @param resultSchema - Zod schema for validating the result
   * @param options - Optional request options (timeout, signal, task creation params, etc.)
   * @returns AsyncGenerator that yields ResponseMessage objects
   *
   * @experimental
   */
  requestStream(request, resultSchema, options) {
    return this._server.requestStream(request, resultSchema, options);
  }
  /**
   * Sends a sampling request and returns an AsyncGenerator that yields response messages.
   * The generator is guaranteed to end with either a 'result' or 'error' message.
   *
   * For task-augmented requests, yields 'taskCreated' and 'taskStatus' messages
   * before the final result.
   *
   * @example
   * ```typescript
   * const stream = server.experimental.tasks.createMessageStream({
   *     messages: [{ role: 'user', content: { type: 'text', text: 'Hello' } }],
   *     maxTokens: 100
   * }, {
   *     onprogress: (progress) => {
   *         // Handle streaming tokens via progress notifications
   *         console.log('Progress:', progress.message);
   *     }
   * });
   *
   * for await (const message of stream) {
   *     switch (message.type) {
   *         case 'taskCreated':
   *             console.log('Task created:', message.task.taskId);
   *             break;
   *         case 'taskStatus':
   *             console.log('Task status:', message.task.status);
   *             break;
   *         case 'result':
   *             console.log('Final result:', message.result);
   *             break;
   *         case 'error':
   *             console.error('Error:', message.error);
   *             break;
   *     }
   * }
   * ```
   *
   * @param params - The sampling request parameters
   * @param options - Optional request options (timeout, signal, task creation params, onprogress, etc.)
   * @returns AsyncGenerator that yields ResponseMessage objects
   *
   * @experimental
   */
  createMessageStream(params, options) {
    const clientCapabilities = this._server.getClientCapabilities();
    if ((params.tools || params.toolChoice) && !clientCapabilities?.sampling?.tools) {
      throw new Error("Client does not support sampling tools capability.");
    }
    if (params.messages.length > 0) {
      const lastMessage = params.messages[params.messages.length - 1];
      const lastContent = Array.isArray(lastMessage.content) ? lastMessage.content : [lastMessage.content];
      const hasToolResults = lastContent.some((c) => c.type === "tool_result");
      const previousMessage = params.messages.length > 1 ? params.messages[params.messages.length - 2] : void 0;
      const previousContent = previousMessage ? Array.isArray(previousMessage.content) ? previousMessage.content : [previousMessage.content] : [];
      const hasPreviousToolUse = previousContent.some((c) => c.type === "tool_use");
      if (hasToolResults) {
        if (lastContent.some((c) => c.type !== "tool_result")) {
          throw new Error("The last message must contain only tool_result content if any is present");
        }
        if (!hasPreviousToolUse) {
          throw new Error("tool_result blocks are not matching any tool_use from the previous message");
        }
      }
      if (hasPreviousToolUse) {
        const toolUseIds = new Set(previousContent.filter((c) => c.type === "tool_use").map((c) => c.id));
        const toolResultIds = new Set(lastContent.filter((c) => c.type === "tool_result").map((c) => c.toolUseId));
        if (toolUseIds.size !== toolResultIds.size || ![...toolUseIds].every((id) => toolResultIds.has(id))) {
          throw new Error("ids of tool_result blocks and tool_use blocks from previous message do not match");
        }
      }
    }
    return this.requestStream({
      method: "sampling/createMessage",
      params
    }, CreateMessageResultSchema, options);
  }
  /**
   * Sends an elicitation request and returns an AsyncGenerator that yields response messages.
   * The generator is guaranteed to end with either a 'result' or 'error' message.
   *
   * For task-augmented requests (especially URL-based elicitation), yields 'taskCreated'
   * and 'taskStatus' messages before the final result.
   *
   * @example
   * ```typescript
   * const stream = server.experimental.tasks.elicitInputStream({
   *     mode: 'url',
   *     message: 'Please authenticate',
   *     elicitationId: 'auth-123',
   *     url: 'https://example.com/auth'
   * }, {
   *     task: { ttl: 300000 } // Task-augmented for long-running auth flow
   * });
   *
   * for await (const message of stream) {
   *     switch (message.type) {
   *         case 'taskCreated':
   *             console.log('Task created:', message.task.taskId);
   *             break;
   *         case 'taskStatus':
   *             console.log('Task status:', message.task.status);
   *             break;
   *         case 'result':
   *             console.log('User action:', message.result.action);
   *             break;
   *         case 'error':
   *             console.error('Error:', message.error);
   *             break;
   *     }
   * }
   * ```
   *
   * @param params - The elicitation request parameters
   * @param options - Optional request options (timeout, signal, task creation params, etc.)
   * @returns AsyncGenerator that yields ResponseMessage objects
   *
   * @experimental
   */
  elicitInputStream(params, options) {
    const clientCapabilities = this._server.getClientCapabilities();
    const mode = params.mode ?? "form";
    switch (mode) {
      case "url": {
        if (!clientCapabilities?.elicitation?.url) {
          throw new Error("Client does not support url elicitation.");
        }
        break;
      }
      case "form": {
        if (!clientCapabilities?.elicitation?.form) {
          throw new Error("Client does not support form elicitation.");
        }
        break;
      }
    }
    const normalizedParams = mode === "form" && params.mode === void 0 ? { ...params, mode: "form" } : params;
    return this.requestStream({
      method: "elicitation/create",
      params: normalizedParams
    }, ElicitResultSchema, options);
  }
  /**
   * Gets the current status of a task.
   *
   * @param taskId - The task identifier
   * @param options - Optional request options
   * @returns The task status
   *
   * @experimental
   */
  async getTask(taskId, options) {
    return this._server.getTask({ taskId }, options);
  }
  /**
   * Retrieves the result of a completed task.
   *
   * @param taskId - The task identifier
   * @param resultSchema - Zod schema for validating the result
   * @param options - Optional request options
   * @returns The task result
   *
   * @experimental
   */
  async getTaskResult(taskId, resultSchema, options) {
    return this._server.getTaskResult({ taskId }, resultSchema, options);
  }
  /**
   * Lists tasks with optional pagination.
   *
   * @param cursor - Optional pagination cursor
   * @param options - Optional request options
   * @returns List of tasks with optional next cursor
   *
   * @experimental
   */
  async listTasks(cursor, options) {
    return this._server.listTasks(cursor ? { cursor } : void 0, options);
  }
  /**
   * Cancels a running task.
   *
   * @param taskId - The task identifier
   * @param options - Optional request options
   *
   * @experimental
   */
  async cancelTask(taskId, options) {
    return this._server.cancelTask({ taskId }, options);
  }
};

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js
var Server = class extends Protocol {
  /**
   * Initializes this server with the given name and version information.
   */
  constructor(_serverInfo, options) {
    super(options);
    this._serverInfo = _serverInfo;
    this._loggingLevels = /* @__PURE__ */ new Map();
    this.LOG_LEVEL_SEVERITY = new Map(LoggingLevelSchema.options.map((level, index) => [level, index]));
    this.isMessageIgnored = (level, sessionId) => {
      const currentLevel = this._loggingLevels.get(sessionId);
      return currentLevel ? this.LOG_LEVEL_SEVERITY.get(level) < this.LOG_LEVEL_SEVERITY.get(currentLevel) : false;
    };
    this._capabilities = options?.capabilities ?? {};
    this._instructions = options?.instructions;
    this._jsonSchemaValidator = options?.jsonSchemaValidator ?? new AjvJsonSchemaValidator();
    this.setRequestHandler(InitializeRequestSchema, (request) => this._oninitialize(request));
    this.setNotificationHandler(InitializedNotificationSchema, () => this.oninitialized?.());
    if (this._capabilities.logging) {
      this.setRequestHandler(SetLevelRequestSchema, async (request, extra) => {
        const transportSessionId = extra.sessionId || extra.requestInfo?.headers["mcp-session-id"] || void 0;
        const { level } = request.params;
        const parseResult = LoggingLevelSchema.safeParse(level);
        if (parseResult.success) {
          this._loggingLevels.set(transportSessionId, parseResult.data);
        }
        return {};
      });
    }
  }
  /**
   * Access experimental features.
   *
   * WARNING: These APIs are experimental and may change without notice.
   *
   * @experimental
   */
  get experimental() {
    if (!this._experimental) {
      this._experimental = {
        tasks: new ExperimentalServerTasks(this)
      };
    }
    return this._experimental;
  }
  /**
   * Registers new capabilities. This can only be called before connecting to a transport.
   *
   * The new capabilities will be merged with any existing capabilities previously given (e.g., at initialization).
   */
  registerCapabilities(capabilities) {
    if (this.transport) {
      throw new Error("Cannot register capabilities after connecting to transport");
    }
    this._capabilities = mergeCapabilities(this._capabilities, capabilities);
  }
  /**
   * Override request handler registration to enforce server-side validation for tools/call.
   */
  setRequestHandler(requestSchema, handler) {
    const shape = getObjectShape(requestSchema);
    const methodSchema = shape?.method;
    if (!methodSchema) {
      throw new Error("Schema is missing a method literal");
    }
    const methodValue = getLiteralValue(methodSchema);
    if (typeof methodValue !== "string") {
      throw new Error("Schema method literal must be a string");
    }
    const method = methodValue;
    if (method === "tools/call") {
      const wrappedHandler = async (request, extra) => {
        const validatedRequest = safeParse(CallToolRequestSchema, request);
        if (!validatedRequest.success) {
          const errorMessage = validatedRequest.error instanceof Error ? validatedRequest.error.message : String(validatedRequest.error);
          throw new McpError(ErrorCode.InvalidParams, `Invalid tools/call request: ${errorMessage}`);
        }
        const { params } = validatedRequest.data;
        const result2 = await Promise.resolve(handler(request, extra));
        if (params.task) {
          const taskValidationResult = safeParse(CreateTaskResultSchema, result2);
          if (!taskValidationResult.success) {
            const errorMessage = taskValidationResult.error instanceof Error ? taskValidationResult.error.message : String(taskValidationResult.error);
            throw new McpError(ErrorCode.InvalidParams, `Invalid task creation result: ${errorMessage}`);
          }
          return taskValidationResult.data;
        }
        const validationResult = safeParse(CallToolResultSchema, result2);
        if (!validationResult.success) {
          const errorMessage = validationResult.error instanceof Error ? validationResult.error.message : String(validationResult.error);
          throw new McpError(ErrorCode.InvalidParams, `Invalid tools/call result: ${errorMessage}`);
        }
        return validationResult.data;
      };
      return super.setRequestHandler(requestSchema, wrappedHandler);
    }
    return super.setRequestHandler(requestSchema, handler);
  }
  assertCapabilityForMethod(method) {
    switch (method) {
      case "sampling/createMessage":
        if (!this._clientCapabilities?.sampling) {
          throw new Error(`Client does not support sampling (required for ${method})`);
        }
        break;
      case "elicitation/create":
        if (!this._clientCapabilities?.elicitation) {
          throw new Error(`Client does not support elicitation (required for ${method})`);
        }
        break;
      case "roots/list":
        if (!this._clientCapabilities?.roots) {
          throw new Error(`Client does not support listing roots (required for ${method})`);
        }
        break;
      case "ping":
        break;
    }
  }
  assertNotificationCapability(method) {
    switch (method) {
      case "notifications/message":
        if (!this._capabilities.logging) {
          throw new Error(`Server does not support logging (required for ${method})`);
        }
        break;
      case "notifications/resources/updated":
      case "notifications/resources/list_changed":
        if (!this._capabilities.resources) {
          throw new Error(`Server does not support notifying about resources (required for ${method})`);
        }
        break;
      case "notifications/tools/list_changed":
        if (!this._capabilities.tools) {
          throw new Error(`Server does not support notifying of tool list changes (required for ${method})`);
        }
        break;
      case "notifications/prompts/list_changed":
        if (!this._capabilities.prompts) {
          throw new Error(`Server does not support notifying of prompt list changes (required for ${method})`);
        }
        break;
      case "notifications/elicitation/complete":
        if (!this._clientCapabilities?.elicitation?.url) {
          throw new Error(`Client does not support URL elicitation (required for ${method})`);
        }
        break;
      case "notifications/cancelled":
        break;
      case "notifications/progress":
        break;
    }
  }
  assertRequestHandlerCapability(method) {
    if (!this._capabilities) {
      return;
    }
    switch (method) {
      case "completion/complete":
        if (!this._capabilities.completions) {
          throw new Error(`Server does not support completions (required for ${method})`);
        }
        break;
      case "logging/setLevel":
        if (!this._capabilities.logging) {
          throw new Error(`Server does not support logging (required for ${method})`);
        }
        break;
      case "prompts/get":
      case "prompts/list":
        if (!this._capabilities.prompts) {
          throw new Error(`Server does not support prompts (required for ${method})`);
        }
        break;
      case "resources/list":
      case "resources/templates/list":
      case "resources/read":
        if (!this._capabilities.resources) {
          throw new Error(`Server does not support resources (required for ${method})`);
        }
        break;
      case "tools/call":
      case "tools/list":
        if (!this._capabilities.tools) {
          throw new Error(`Server does not support tools (required for ${method})`);
        }
        break;
      case "tasks/get":
      case "tasks/list":
      case "tasks/result":
      case "tasks/cancel":
        if (!this._capabilities.tasks) {
          throw new Error(`Server does not support tasks capability (required for ${method})`);
        }
        break;
      case "ping":
      case "initialize":
        break;
    }
  }
  assertTaskCapability(method) {
    assertClientRequestTaskCapability(this._clientCapabilities?.tasks?.requests, method, "Client");
  }
  assertTaskHandlerCapability(method) {
    if (!this._capabilities) {
      return;
    }
    assertToolsCallTaskCapability(this._capabilities.tasks?.requests, method, "Server");
  }
  async _oninitialize(request) {
    const requestedVersion = request.params.protocolVersion;
    this._clientCapabilities = request.params.capabilities;
    this._clientVersion = request.params.clientInfo;
    const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion) ? requestedVersion : LATEST_PROTOCOL_VERSION;
    return {
      protocolVersion,
      capabilities: this.getCapabilities(),
      serverInfo: this._serverInfo,
      ...this._instructions && { instructions: this._instructions }
    };
  }
  /**
   * After initialization has completed, this will be populated with the client's reported capabilities.
   */
  getClientCapabilities() {
    return this._clientCapabilities;
  }
  /**
   * After initialization has completed, this will be populated with information about the client's name and version.
   */
  getClientVersion() {
    return this._clientVersion;
  }
  getCapabilities() {
    return this._capabilities;
  }
  async ping() {
    return this.request({ method: "ping" }, EmptyResultSchema);
  }
  // Implementation
  async createMessage(params, options) {
    if (params.tools || params.toolChoice) {
      if (!this._clientCapabilities?.sampling?.tools) {
        throw new Error("Client does not support sampling tools capability.");
      }
    }
    if (params.messages.length > 0) {
      const lastMessage = params.messages[params.messages.length - 1];
      const lastContent = Array.isArray(lastMessage.content) ? lastMessage.content : [lastMessage.content];
      const hasToolResults = lastContent.some((c) => c.type === "tool_result");
      const previousMessage = params.messages.length > 1 ? params.messages[params.messages.length - 2] : void 0;
      const previousContent = previousMessage ? Array.isArray(previousMessage.content) ? previousMessage.content : [previousMessage.content] : [];
      const hasPreviousToolUse = previousContent.some((c) => c.type === "tool_use");
      if (hasToolResults) {
        if (lastContent.some((c) => c.type !== "tool_result")) {
          throw new Error("The last message must contain only tool_result content if any is present");
        }
        if (!hasPreviousToolUse) {
          throw new Error("tool_result blocks are not matching any tool_use from the previous message");
        }
      }
      if (hasPreviousToolUse) {
        const toolUseIds = new Set(previousContent.filter((c) => c.type === "tool_use").map((c) => c.id));
        const toolResultIds = new Set(lastContent.filter((c) => c.type === "tool_result").map((c) => c.toolUseId));
        if (toolUseIds.size !== toolResultIds.size || ![...toolUseIds].every((id) => toolResultIds.has(id))) {
          throw new Error("ids of tool_result blocks and tool_use blocks from previous message do not match");
        }
      }
    }
    if (params.tools) {
      return this.request({ method: "sampling/createMessage", params }, CreateMessageResultWithToolsSchema, options);
    }
    return this.request({ method: "sampling/createMessage", params }, CreateMessageResultSchema, options);
  }
  /**
   * Creates an elicitation request for the given parameters.
   * For backwards compatibility, `mode` may be omitted for form requests and will default to `'form'`.
   * @param params The parameters for the elicitation request.
   * @param options Optional request options.
   * @returns The result of the elicitation request.
   */
  async elicitInput(params, options) {
    const mode = params.mode ?? "form";
    switch (mode) {
      case "url": {
        if (!this._clientCapabilities?.elicitation?.url) {
          throw new Error("Client does not support url elicitation.");
        }
        const urlParams = params;
        return this.request({ method: "elicitation/create", params: urlParams }, ElicitResultSchema, options);
      }
      case "form": {
        if (!this._clientCapabilities?.elicitation?.form) {
          throw new Error("Client does not support form elicitation.");
        }
        const formParams = params.mode === "form" ? params : { ...params, mode: "form" };
        const result2 = await this.request({ method: "elicitation/create", params: formParams }, ElicitResultSchema, options);
        if (result2.action === "accept" && result2.content && formParams.requestedSchema) {
          try {
            const validator = this._jsonSchemaValidator.getValidator(formParams.requestedSchema);
            const validationResult = validator(result2.content);
            if (!validationResult.valid) {
              throw new McpError(ErrorCode.InvalidParams, `Elicitation response content does not match requested schema: ${validationResult.errorMessage}`);
            }
          } catch (error) {
            if (error instanceof McpError) {
              throw error;
            }
            throw new McpError(ErrorCode.InternalError, `Error validating elicitation response: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        return result2;
      }
    }
  }
  /**
   * Creates a reusable callback that, when invoked, will send a `notifications/elicitation/complete`
   * notification for the specified elicitation ID.
   *
   * @param elicitationId The ID of the elicitation to mark as complete.
   * @param options Optional notification options. Useful when the completion notification should be related to a prior request.
   * @returns A function that emits the completion notification when awaited.
   */
  createElicitationCompletionNotifier(elicitationId, options) {
    if (!this._clientCapabilities?.elicitation?.url) {
      throw new Error("Client does not support URL elicitation (required for notifications/elicitation/complete)");
    }
    return () => this.notification({
      method: "notifications/elicitation/complete",
      params: {
        elicitationId
      }
    }, options);
  }
  async listRoots(params, options) {
    return this.request({ method: "roots/list", params }, ListRootsResultSchema, options);
  }
  /**
   * Sends a logging message to the client, if connected.
   * Note: You only need to send the parameters object, not the entire JSON RPC message
   * @see LoggingMessageNotification
   * @param params
   * @param sessionId optional for stateless and backward compatibility
   */
  async sendLoggingMessage(params, sessionId) {
    if (this._capabilities.logging) {
      if (!this.isMessageIgnored(params.level, sessionId)) {
        return this.notification({ method: "notifications/message", params });
      }
    }
  }
  async sendResourceUpdated(params) {
    return this.notification({
      method: "notifications/resources/updated",
      params
    });
  }
  async sendResourceListChanged() {
    return this.notification({
      method: "notifications/resources/list_changed"
    });
  }
  async sendToolListChanged() {
    return this.notification({ method: "notifications/tools/list_changed" });
  }
  async sendPromptListChanged() {
    return this.notification({ method: "notifications/prompts/list_changed" });
  }
};

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/completable.js
var COMPLETABLE_SYMBOL = Symbol.for("mcp.completable");
function isCompletable(schema) {
  return !!schema && typeof schema === "object" && COMPLETABLE_SYMBOL in schema;
}
function getCompleter(schema) {
  const meta = schema[COMPLETABLE_SYMBOL];
  return meta?.complete;
}
var McpZodTypeKind;
(function(McpZodTypeKind2) {
  McpZodTypeKind2["Completable"] = "McpCompletable";
})(McpZodTypeKind || (McpZodTypeKind = {}));

// node_modules/@modelcontextprotocol/sdk/dist/esm/shared/toolNameValidation.js
var TOOL_NAME_REGEX = /^[A-Za-z0-9._-]{1,128}$/;
function validateToolName(name) {
  const warnings = [];
  if (name.length === 0) {
    return {
      isValid: false,
      warnings: ["Tool name cannot be empty"]
    };
  }
  if (name.length > 128) {
    return {
      isValid: false,
      warnings: [`Tool name exceeds maximum length of 128 characters (current: ${name.length})`]
    };
  }
  if (name.includes(" ")) {
    warnings.push("Tool name contains spaces, which may cause parsing issues");
  }
  if (name.includes(",")) {
    warnings.push("Tool name contains commas, which may cause parsing issues");
  }
  if (name.startsWith("-") || name.endsWith("-")) {
    warnings.push("Tool name starts or ends with a dash, which may cause parsing issues in some contexts");
  }
  if (name.startsWith(".") || name.endsWith(".")) {
    warnings.push("Tool name starts or ends with a dot, which may cause parsing issues in some contexts");
  }
  if (!TOOL_NAME_REGEX.test(name)) {
    const invalidChars = name.split("").filter((char) => !/[A-Za-z0-9._-]/.test(char)).filter((char, index, arr) => arr.indexOf(char) === index);
    warnings.push(`Tool name contains invalid characters: ${invalidChars.map((c) => `"${c}"`).join(", ")}`, "Allowed characters are: A-Z, a-z, 0-9, underscore (_), dash (-), and dot (.)");
    return {
      isValid: false,
      warnings
    };
  }
  return {
    isValid: true,
    warnings
  };
}
function issueToolNameWarning(name, warnings) {
  if (warnings.length > 0) {
    console.warn(`Tool name validation warning for "${name}":`);
    for (const warning of warnings) {
      console.warn(`  - ${warning}`);
    }
    console.warn("Tool registration will proceed, but this may cause compatibility issues.");
    console.warn("Consider updating the tool name to conform to the MCP tool naming standard.");
    console.warn("See SEP: Specify Format for Tool Names (https://github.com/modelcontextprotocol/modelcontextprotocol/issues/986) for more details.");
  }
}
function validateAndWarnToolName(name) {
  const result2 = validateToolName(name);
  issueToolNameWarning(name, result2.warnings);
  return result2.isValid;
}

// node_modules/@modelcontextprotocol/sdk/dist/esm/experimental/tasks/mcp-server.js
var ExperimentalMcpServerTasks = class {
  constructor(_mcpServer) {
    this._mcpServer = _mcpServer;
  }
  registerToolTask(name, config, handler) {
    const execution = { taskSupport: "required", ...config.execution };
    if (execution.taskSupport === "forbidden") {
      throw new Error(`Cannot register task-based tool '${name}' with taskSupport 'forbidden'. Use registerTool() instead.`);
    }
    const mcpServerInternal = this._mcpServer;
    return mcpServerInternal._createRegisteredTool(name, config.title, config.description, config.inputSchema, config.outputSchema, config.annotations, execution, config._meta, handler);
  }
};

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js
var McpServer = class {
  constructor(serverInfo, options) {
    this._registeredResources = {};
    this._registeredResourceTemplates = {};
    this._registeredTools = {};
    this._registeredPrompts = {};
    this._toolHandlersInitialized = false;
    this._completionHandlerInitialized = false;
    this._resourceHandlersInitialized = false;
    this._promptHandlersInitialized = false;
    this.server = new Server(serverInfo, options);
  }
  /**
   * Access experimental features.
   *
   * WARNING: These APIs are experimental and may change without notice.
   *
   * @experimental
   */
  get experimental() {
    if (!this._experimental) {
      this._experimental = {
        tasks: new ExperimentalMcpServerTasks(this)
      };
    }
    return this._experimental;
  }
  /**
   * Attaches to the given transport, starts it, and starts listening for messages.
   *
   * The `server` object assumes ownership of the Transport, replacing any callbacks that have already been set, and expects that it is the only user of the Transport instance going forward.
   */
  async connect(transport2) {
    return await this.server.connect(transport2);
  }
  /**
   * Closes the connection.
   */
  async close() {
    await this.server.close();
  }
  setToolRequestHandlers() {
    if (this._toolHandlersInitialized) {
      return;
    }
    this.server.assertCanSetRequestHandler(getMethodValue(ListToolsRequestSchema));
    this.server.assertCanSetRequestHandler(getMethodValue(CallToolRequestSchema));
    this.server.registerCapabilities({
      tools: {
        listChanged: true
      }
    });
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: Object.entries(this._registeredTools).filter(([, tool]) => tool.enabled).map(([name, tool]) => {
        const toolDefinition = {
          name,
          title: tool.title,
          description: tool.description,
          inputSchema: (() => {
            const obj = normalizeObjectSchema(tool.inputSchema);
            return obj ? toJsonSchemaCompat(obj, {
              strictUnions: true,
              pipeStrategy: "input"
            }) : EMPTY_OBJECT_JSON_SCHEMA;
          })(),
          annotations: tool.annotations,
          execution: tool.execution,
          _meta: tool._meta
        };
        if (tool.outputSchema) {
          const obj = normalizeObjectSchema(tool.outputSchema);
          if (obj) {
            toolDefinition.outputSchema = toJsonSchemaCompat(obj, {
              strictUnions: true,
              pipeStrategy: "output"
            });
          }
        }
        return toolDefinition;
      })
    }));
    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      try {
        const tool = this._registeredTools[request.params.name];
        if (!tool) {
          throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} not found`);
        }
        if (!tool.enabled) {
          throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} disabled`);
        }
        const isTaskRequest = !!request.params.task;
        const taskSupport = tool.execution?.taskSupport;
        const isTaskHandler = "createTask" in tool.handler;
        if ((taskSupport === "required" || taskSupport === "optional") && !isTaskHandler) {
          throw new McpError(ErrorCode.InternalError, `Tool ${request.params.name} has taskSupport '${taskSupport}' but was not registered with registerToolTask`);
        }
        if (taskSupport === "required" && !isTaskRequest) {
          throw new McpError(ErrorCode.MethodNotFound, `Tool ${request.params.name} requires task augmentation (taskSupport: 'required')`);
        }
        if (taskSupport === "optional" && !isTaskRequest && isTaskHandler) {
          return await this.handleAutomaticTaskPolling(tool, request, extra);
        }
        const args = await this.validateToolInput(tool, request.params.arguments, request.params.name);
        const result2 = await this.executeToolHandler(tool, args, extra);
        if (isTaskRequest) {
          return result2;
        }
        await this.validateToolOutput(tool, result2, request.params.name);
        return result2;
      } catch (error) {
        if (error instanceof McpError) {
          if (error.code === ErrorCode.UrlElicitationRequired) {
            throw error;
          }
        }
        return this.createToolError(error instanceof Error ? error.message : String(error));
      }
    });
    this._toolHandlersInitialized = true;
  }
  /**
   * Creates a tool error result.
   *
   * @param errorMessage - The error message.
   * @returns The tool error result.
   */
  createToolError(errorMessage) {
    return {
      content: [
        {
          type: "text",
          text: errorMessage
        }
      ],
      isError: true
    };
  }
  /**
   * Validates tool input arguments against the tool's input schema.
   */
  async validateToolInput(tool, args, toolName) {
    if (!tool.inputSchema) {
      return void 0;
    }
    const inputObj = normalizeObjectSchema(tool.inputSchema);
    const schemaToParse = inputObj ?? tool.inputSchema;
    const parseResult = await safeParseAsync(schemaToParse, args);
    if (!parseResult.success) {
      const error = "error" in parseResult ? parseResult.error : "Unknown error";
      const errorMessage = getParseErrorMessage(error);
      throw new McpError(ErrorCode.InvalidParams, `Input validation error: Invalid arguments for tool ${toolName}: ${errorMessage}`);
    }
    return parseResult.data;
  }
  /**
   * Validates tool output against the tool's output schema.
   */
  async validateToolOutput(tool, result2, toolName) {
    if (!tool.outputSchema) {
      return;
    }
    if (!("content" in result2)) {
      return;
    }
    if (result2.isError) {
      return;
    }
    if (!result2.structuredContent) {
      throw new McpError(ErrorCode.InvalidParams, `Output validation error: Tool ${toolName} has an output schema but no structured content was provided`);
    }
    const outputObj = normalizeObjectSchema(tool.outputSchema);
    const parseResult = await safeParseAsync(outputObj, result2.structuredContent);
    if (!parseResult.success) {
      const error = "error" in parseResult ? parseResult.error : "Unknown error";
      const errorMessage = getParseErrorMessage(error);
      throw new McpError(ErrorCode.InvalidParams, `Output validation error: Invalid structured content for tool ${toolName}: ${errorMessage}`);
    }
  }
  /**
   * Executes a tool handler (either regular or task-based).
   */
  async executeToolHandler(tool, args, extra) {
    const handler = tool.handler;
    const isTaskHandler = "createTask" in handler;
    if (isTaskHandler) {
      if (!extra.taskStore) {
        throw new Error("No task store provided.");
      }
      const taskExtra = { ...extra, taskStore: extra.taskStore };
      if (tool.inputSchema) {
        const typedHandler = handler;
        return await Promise.resolve(typedHandler.createTask(args, taskExtra));
      } else {
        const typedHandler = handler;
        return await Promise.resolve(typedHandler.createTask(taskExtra));
      }
    }
    if (tool.inputSchema) {
      const typedHandler = handler;
      return await Promise.resolve(typedHandler(args, extra));
    } else {
      const typedHandler = handler;
      return await Promise.resolve(typedHandler(extra));
    }
  }
  /**
   * Handles automatic task polling for tools with taskSupport 'optional'.
   */
  async handleAutomaticTaskPolling(tool, request, extra) {
    if (!extra.taskStore) {
      throw new Error("No task store provided for task-capable tool.");
    }
    const args = await this.validateToolInput(tool, request.params.arguments, request.params.name);
    const handler = tool.handler;
    const taskExtra = { ...extra, taskStore: extra.taskStore };
    const createTaskResult = args ? await Promise.resolve(handler.createTask(args, taskExtra)) : (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Promise.resolve(handler.createTask(taskExtra))
    );
    const taskId = createTaskResult.task.taskId;
    let task = createTaskResult.task;
    const pollInterval = task.pollInterval ?? 5e3;
    while (task.status !== "completed" && task.status !== "failed" && task.status !== "cancelled") {
      await new Promise((resolve4) => setTimeout(resolve4, pollInterval));
      const updatedTask = await extra.taskStore.getTask(taskId);
      if (!updatedTask) {
        throw new McpError(ErrorCode.InternalError, `Task ${taskId} not found during polling`);
      }
      task = updatedTask;
    }
    return await extra.taskStore.getTaskResult(taskId);
  }
  setCompletionRequestHandler() {
    if (this._completionHandlerInitialized) {
      return;
    }
    this.server.assertCanSetRequestHandler(getMethodValue(CompleteRequestSchema));
    this.server.registerCapabilities({
      completions: {}
    });
    this.server.setRequestHandler(CompleteRequestSchema, async (request) => {
      switch (request.params.ref.type) {
        case "ref/prompt":
          assertCompleteRequestPrompt(request);
          return this.handlePromptCompletion(request, request.params.ref);
        case "ref/resource":
          assertCompleteRequestResourceTemplate(request);
          return this.handleResourceCompletion(request, request.params.ref);
        default:
          throw new McpError(ErrorCode.InvalidParams, `Invalid completion reference: ${request.params.ref}`);
      }
    });
    this._completionHandlerInitialized = true;
  }
  async handlePromptCompletion(request, ref) {
    const prompt = this._registeredPrompts[ref.name];
    if (!prompt) {
      throw new McpError(ErrorCode.InvalidParams, `Prompt ${ref.name} not found`);
    }
    if (!prompt.enabled) {
      throw new McpError(ErrorCode.InvalidParams, `Prompt ${ref.name} disabled`);
    }
    if (!prompt.argsSchema) {
      return EMPTY_COMPLETION_RESULT;
    }
    const promptShape = getObjectShape(prompt.argsSchema);
    const field = promptShape?.[request.params.argument.name];
    if (!isCompletable(field)) {
      return EMPTY_COMPLETION_RESULT;
    }
    const completer = getCompleter(field);
    if (!completer) {
      return EMPTY_COMPLETION_RESULT;
    }
    const suggestions = await completer(request.params.argument.value, request.params.context);
    return createCompletionResult(suggestions);
  }
  async handleResourceCompletion(request, ref) {
    const template = Object.values(this._registeredResourceTemplates).find((t) => t.resourceTemplate.uriTemplate.toString() === ref.uri);
    if (!template) {
      if (this._registeredResources[ref.uri]) {
        return EMPTY_COMPLETION_RESULT;
      }
      throw new McpError(ErrorCode.InvalidParams, `Resource template ${request.params.ref.uri} not found`);
    }
    const completer = template.resourceTemplate.completeCallback(request.params.argument.name);
    if (!completer) {
      return EMPTY_COMPLETION_RESULT;
    }
    const suggestions = await completer(request.params.argument.value, request.params.context);
    return createCompletionResult(suggestions);
  }
  setResourceRequestHandlers() {
    if (this._resourceHandlersInitialized) {
      return;
    }
    this.server.assertCanSetRequestHandler(getMethodValue(ListResourcesRequestSchema));
    this.server.assertCanSetRequestHandler(getMethodValue(ListResourceTemplatesRequestSchema));
    this.server.assertCanSetRequestHandler(getMethodValue(ReadResourceRequestSchema));
    this.server.registerCapabilities({
      resources: {
        listChanged: true
      }
    });
    this.server.setRequestHandler(ListResourcesRequestSchema, async (request, extra) => {
      const resources = Object.entries(this._registeredResources).filter(([_, resource]) => resource.enabled).map(([uri, resource]) => ({
        uri,
        name: resource.name,
        ...resource.metadata
      }));
      const templateResources = [];
      for (const template of Object.values(this._registeredResourceTemplates)) {
        if (!template.resourceTemplate.listCallback) {
          continue;
        }
        const result2 = await template.resourceTemplate.listCallback(extra);
        for (const resource of result2.resources) {
          templateResources.push({
            ...template.metadata,
            // the defined resource metadata should override the template metadata if present
            ...resource
          });
        }
      }
      return { resources: [...resources, ...templateResources] };
    });
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
      const resourceTemplates = Object.entries(this._registeredResourceTemplates).map(([name, template]) => ({
        name,
        uriTemplate: template.resourceTemplate.uriTemplate.toString(),
        ...template.metadata
      }));
      return { resourceTemplates };
    });
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) => {
      const uri = new URL(request.params.uri);
      const resource = this._registeredResources[uri.toString()];
      if (resource) {
        if (!resource.enabled) {
          throw new McpError(ErrorCode.InvalidParams, `Resource ${uri} disabled`);
        }
        return resource.readCallback(uri, extra);
      }
      for (const template of Object.values(this._registeredResourceTemplates)) {
        const variables = template.resourceTemplate.uriTemplate.match(uri.toString());
        if (variables) {
          return template.readCallback(uri, variables, extra);
        }
      }
      throw new McpError(ErrorCode.InvalidParams, `Resource ${uri} not found`);
    });
    this._resourceHandlersInitialized = true;
  }
  setPromptRequestHandlers() {
    if (this._promptHandlersInitialized) {
      return;
    }
    this.server.assertCanSetRequestHandler(getMethodValue(ListPromptsRequestSchema));
    this.server.assertCanSetRequestHandler(getMethodValue(GetPromptRequestSchema));
    this.server.registerCapabilities({
      prompts: {
        listChanged: true
      }
    });
    this.server.setRequestHandler(ListPromptsRequestSchema, () => ({
      prompts: Object.entries(this._registeredPrompts).filter(([, prompt]) => prompt.enabled).map(([name, prompt]) => {
        return {
          name,
          title: prompt.title,
          description: prompt.description,
          arguments: prompt.argsSchema ? promptArgumentsFromSchema(prompt.argsSchema) : void 0
        };
      })
    }));
    this.server.setRequestHandler(GetPromptRequestSchema, async (request, extra) => {
      const prompt = this._registeredPrompts[request.params.name];
      if (!prompt) {
        throw new McpError(ErrorCode.InvalidParams, `Prompt ${request.params.name} not found`);
      }
      if (!prompt.enabled) {
        throw new McpError(ErrorCode.InvalidParams, `Prompt ${request.params.name} disabled`);
      }
      if (prompt.argsSchema) {
        const argsObj = normalizeObjectSchema(prompt.argsSchema);
        const parseResult = await safeParseAsync(argsObj, request.params.arguments);
        if (!parseResult.success) {
          const error = "error" in parseResult ? parseResult.error : "Unknown error";
          const errorMessage = getParseErrorMessage(error);
          throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for prompt ${request.params.name}: ${errorMessage}`);
        }
        const args = parseResult.data;
        const cb = prompt.callback;
        return await Promise.resolve(cb(args, extra));
      } else {
        const cb = prompt.callback;
        return await Promise.resolve(cb(extra));
      }
    });
    this._promptHandlersInitialized = true;
  }
  resource(name, uriOrTemplate, ...rest) {
    let metadata;
    if (typeof rest[0] === "object") {
      metadata = rest.shift();
    }
    const readCallback = rest[0];
    if (typeof uriOrTemplate === "string") {
      if (this._registeredResources[uriOrTemplate]) {
        throw new Error(`Resource ${uriOrTemplate} is already registered`);
      }
      const registeredResource = this._createRegisteredResource(name, void 0, uriOrTemplate, metadata, readCallback);
      this.setResourceRequestHandlers();
      this.sendResourceListChanged();
      return registeredResource;
    } else {
      if (this._registeredResourceTemplates[name]) {
        throw new Error(`Resource template ${name} is already registered`);
      }
      const registeredResourceTemplate = this._createRegisteredResourceTemplate(name, void 0, uriOrTemplate, metadata, readCallback);
      this.setResourceRequestHandlers();
      this.sendResourceListChanged();
      return registeredResourceTemplate;
    }
  }
  registerResource(name, uriOrTemplate, config, readCallback) {
    if (typeof uriOrTemplate === "string") {
      if (this._registeredResources[uriOrTemplate]) {
        throw new Error(`Resource ${uriOrTemplate} is already registered`);
      }
      const registeredResource = this._createRegisteredResource(name, config.title, uriOrTemplate, config, readCallback);
      this.setResourceRequestHandlers();
      this.sendResourceListChanged();
      return registeredResource;
    } else {
      if (this._registeredResourceTemplates[name]) {
        throw new Error(`Resource template ${name} is already registered`);
      }
      const registeredResourceTemplate = this._createRegisteredResourceTemplate(name, config.title, uriOrTemplate, config, readCallback);
      this.setResourceRequestHandlers();
      this.sendResourceListChanged();
      return registeredResourceTemplate;
    }
  }
  _createRegisteredResource(name, title, uri, metadata, readCallback) {
    const registeredResource = {
      name,
      title,
      metadata,
      readCallback,
      enabled: true,
      disable: () => registeredResource.update({ enabled: false }),
      enable: () => registeredResource.update({ enabled: true }),
      remove: () => registeredResource.update({ uri: null }),
      update: (updates) => {
        if (typeof updates.uri !== "undefined" && updates.uri !== uri) {
          delete this._registeredResources[uri];
          if (updates.uri)
            this._registeredResources[updates.uri] = registeredResource;
        }
        if (typeof updates.name !== "undefined")
          registeredResource.name = updates.name;
        if (typeof updates.title !== "undefined")
          registeredResource.title = updates.title;
        if (typeof updates.metadata !== "undefined")
          registeredResource.metadata = updates.metadata;
        if (typeof updates.callback !== "undefined")
          registeredResource.readCallback = updates.callback;
        if (typeof updates.enabled !== "undefined")
          registeredResource.enabled = updates.enabled;
        this.sendResourceListChanged();
      }
    };
    this._registeredResources[uri] = registeredResource;
    return registeredResource;
  }
  _createRegisteredResourceTemplate(name, title, template, metadata, readCallback) {
    const registeredResourceTemplate = {
      resourceTemplate: template,
      title,
      metadata,
      readCallback,
      enabled: true,
      disable: () => registeredResourceTemplate.update({ enabled: false }),
      enable: () => registeredResourceTemplate.update({ enabled: true }),
      remove: () => registeredResourceTemplate.update({ name: null }),
      update: (updates) => {
        if (typeof updates.name !== "undefined" && updates.name !== name) {
          delete this._registeredResourceTemplates[name];
          if (updates.name)
            this._registeredResourceTemplates[updates.name] = registeredResourceTemplate;
        }
        if (typeof updates.title !== "undefined")
          registeredResourceTemplate.title = updates.title;
        if (typeof updates.template !== "undefined")
          registeredResourceTemplate.resourceTemplate = updates.template;
        if (typeof updates.metadata !== "undefined")
          registeredResourceTemplate.metadata = updates.metadata;
        if (typeof updates.callback !== "undefined")
          registeredResourceTemplate.readCallback = updates.callback;
        if (typeof updates.enabled !== "undefined")
          registeredResourceTemplate.enabled = updates.enabled;
        this.sendResourceListChanged();
      }
    };
    this._registeredResourceTemplates[name] = registeredResourceTemplate;
    const variableNames = template.uriTemplate.variableNames;
    const hasCompleter = Array.isArray(variableNames) && variableNames.some((v) => !!template.completeCallback(v));
    if (hasCompleter) {
      this.setCompletionRequestHandler();
    }
    return registeredResourceTemplate;
  }
  _createRegisteredPrompt(name, title, description, argsSchema, callback) {
    const registeredPrompt = {
      title,
      description,
      argsSchema: argsSchema === void 0 ? void 0 : objectFromShape(argsSchema),
      callback,
      enabled: true,
      disable: () => registeredPrompt.update({ enabled: false }),
      enable: () => registeredPrompt.update({ enabled: true }),
      remove: () => registeredPrompt.update({ name: null }),
      update: (updates) => {
        if (typeof updates.name !== "undefined" && updates.name !== name) {
          delete this._registeredPrompts[name];
          if (updates.name)
            this._registeredPrompts[updates.name] = registeredPrompt;
        }
        if (typeof updates.title !== "undefined")
          registeredPrompt.title = updates.title;
        if (typeof updates.description !== "undefined")
          registeredPrompt.description = updates.description;
        if (typeof updates.argsSchema !== "undefined")
          registeredPrompt.argsSchema = objectFromShape(updates.argsSchema);
        if (typeof updates.callback !== "undefined")
          registeredPrompt.callback = updates.callback;
        if (typeof updates.enabled !== "undefined")
          registeredPrompt.enabled = updates.enabled;
        this.sendPromptListChanged();
      }
    };
    this._registeredPrompts[name] = registeredPrompt;
    if (argsSchema) {
      const hasCompletable = Object.values(argsSchema).some((field) => {
        const inner = field instanceof ZodOptional ? field._def?.innerType : field;
        return isCompletable(inner);
      });
      if (hasCompletable) {
        this.setCompletionRequestHandler();
      }
    }
    return registeredPrompt;
  }
  _createRegisteredTool(name, title, description, inputSchema, outputSchema, annotations, execution, _meta, handler) {
    validateAndWarnToolName(name);
    const registeredTool = {
      title,
      description,
      inputSchema: getZodSchemaObject(inputSchema),
      outputSchema: getZodSchemaObject(outputSchema),
      annotations,
      execution,
      _meta,
      handler,
      enabled: true,
      disable: () => registeredTool.update({ enabled: false }),
      enable: () => registeredTool.update({ enabled: true }),
      remove: () => registeredTool.update({ name: null }),
      update: (updates) => {
        if (typeof updates.name !== "undefined" && updates.name !== name) {
          if (typeof updates.name === "string") {
            validateAndWarnToolName(updates.name);
          }
          delete this._registeredTools[name];
          if (updates.name)
            this._registeredTools[updates.name] = registeredTool;
        }
        if (typeof updates.title !== "undefined")
          registeredTool.title = updates.title;
        if (typeof updates.description !== "undefined")
          registeredTool.description = updates.description;
        if (typeof updates.paramsSchema !== "undefined")
          registeredTool.inputSchema = objectFromShape(updates.paramsSchema);
        if (typeof updates.outputSchema !== "undefined")
          registeredTool.outputSchema = objectFromShape(updates.outputSchema);
        if (typeof updates.callback !== "undefined")
          registeredTool.handler = updates.callback;
        if (typeof updates.annotations !== "undefined")
          registeredTool.annotations = updates.annotations;
        if (typeof updates._meta !== "undefined")
          registeredTool._meta = updates._meta;
        if (typeof updates.enabled !== "undefined")
          registeredTool.enabled = updates.enabled;
        this.sendToolListChanged();
      }
    };
    this._registeredTools[name] = registeredTool;
    this.setToolRequestHandlers();
    this.sendToolListChanged();
    return registeredTool;
  }
  /**
   * tool() implementation. Parses arguments passed to overrides defined above.
   */
  tool(name, ...rest) {
    if (this._registeredTools[name]) {
      throw new Error(`Tool ${name} is already registered`);
    }
    let description;
    let inputSchema;
    let outputSchema;
    let annotations;
    if (typeof rest[0] === "string") {
      description = rest.shift();
    }
    if (rest.length > 1) {
      const firstArg = rest[0];
      if (isZodRawShapeCompat(firstArg)) {
        inputSchema = rest.shift();
        if (rest.length > 1 && typeof rest[0] === "object" && rest[0] !== null && !isZodRawShapeCompat(rest[0])) {
          annotations = rest.shift();
        }
      } else if (typeof firstArg === "object" && firstArg !== null) {
        if (Object.values(firstArg).some((v) => typeof v === "object" && v !== null)) {
          throw new Error(`Tool ${name} expected a Zod schema or ToolAnnotations, but received an unrecognized object`);
        }
        annotations = rest.shift();
      }
    }
    const callback = rest[0];
    return this._createRegisteredTool(name, void 0, description, inputSchema, outputSchema, annotations, { taskSupport: "forbidden" }, void 0, callback);
  }
  /**
   * Registers a tool with a config object and callback.
   */
  registerTool(name, config, cb) {
    if (this._registeredTools[name]) {
      throw new Error(`Tool ${name} is already registered`);
    }
    const { title, description, inputSchema, outputSchema, annotations, _meta } = config;
    return this._createRegisteredTool(name, title, description, inputSchema, outputSchema, annotations, { taskSupport: "forbidden" }, _meta, cb);
  }
  prompt(name, ...rest) {
    if (this._registeredPrompts[name]) {
      throw new Error(`Prompt ${name} is already registered`);
    }
    let description;
    if (typeof rest[0] === "string") {
      description = rest.shift();
    }
    let argsSchema;
    if (rest.length > 1) {
      argsSchema = rest.shift();
    }
    const cb = rest[0];
    const registeredPrompt = this._createRegisteredPrompt(name, void 0, description, argsSchema, cb);
    this.setPromptRequestHandlers();
    this.sendPromptListChanged();
    return registeredPrompt;
  }
  /**
   * Registers a prompt with a config object and callback.
   */
  registerPrompt(name, config, cb) {
    if (this._registeredPrompts[name]) {
      throw new Error(`Prompt ${name} is already registered`);
    }
    const { title, description, argsSchema } = config;
    const registeredPrompt = this._createRegisteredPrompt(name, title, description, argsSchema, cb);
    this.setPromptRequestHandlers();
    this.sendPromptListChanged();
    return registeredPrompt;
  }
  /**
   * Checks if the server is connected to a transport.
   * @returns True if the server is connected
   */
  isConnected() {
    return this.server.transport !== void 0;
  }
  /**
   * Sends a logging message to the client, if connected.
   * Note: You only need to send the parameters object, not the entire JSON RPC message
   * @see LoggingMessageNotification
   * @param params
   * @param sessionId optional for stateless and backward compatibility
   */
  async sendLoggingMessage(params, sessionId) {
    return this.server.sendLoggingMessage(params, sessionId);
  }
  /**
   * Sends a resource list changed event to the client, if connected.
   */
  sendResourceListChanged() {
    if (this.isConnected()) {
      this.server.sendResourceListChanged();
    }
  }
  /**
   * Sends a tool list changed event to the client, if connected.
   */
  sendToolListChanged() {
    if (this.isConnected()) {
      this.server.sendToolListChanged();
    }
  }
  /**
   * Sends a prompt list changed event to the client, if connected.
   */
  sendPromptListChanged() {
    if (this.isConnected()) {
      this.server.sendPromptListChanged();
    }
  }
};
var EMPTY_OBJECT_JSON_SCHEMA = {
  type: "object",
  properties: {}
};
function isZodTypeLike(value) {
  return value !== null && typeof value === "object" && "parse" in value && typeof value.parse === "function" && "safeParse" in value && typeof value.safeParse === "function";
}
function isZodSchemaInstance(obj) {
  return "_def" in obj || "_zod" in obj || isZodTypeLike(obj);
}
function isZodRawShapeCompat(obj) {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  if (isZodSchemaInstance(obj)) {
    return false;
  }
  if (Object.keys(obj).length === 0) {
    return true;
  }
  return Object.values(obj).some(isZodTypeLike);
}
function getZodSchemaObject(schema) {
  if (!schema) {
    return void 0;
  }
  if (isZodRawShapeCompat(schema)) {
    return objectFromShape(schema);
  }
  if (!isZodSchemaInstance(schema)) {
    throw new Error("inputSchema must be a Zod schema or raw shape, received an unrecognized object");
  }
  return schema;
}
function promptArgumentsFromSchema(schema) {
  const shape = getObjectShape(schema);
  if (!shape)
    return [];
  return Object.entries(shape).map(([name, field]) => {
    const description = getSchemaDescription(field);
    const isOptional = isSchemaOptional(field);
    return {
      name,
      description,
      required: !isOptional
    };
  });
}
function getMethodValue(schema) {
  const shape = getObjectShape(schema);
  const methodSchema = shape?.method;
  if (!methodSchema) {
    throw new Error("Schema is missing a method literal");
  }
  const value = getLiteralValue(methodSchema);
  if (typeof value === "string") {
    return value;
  }
  throw new Error("Schema method literal must be a string");
}
function createCompletionResult(suggestions) {
  return {
    completion: {
      values: suggestions.slice(0, 100),
      total: suggestions.length,
      hasMore: suggestions.length > 100
    }
  };
}
var EMPTY_COMPLETION_RESULT = {
  completion: {
    values: [],
    hasMore: false
  }
};

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js
import process2 from "node:process";
var StdioServerTransport = class {
  constructor(_stdin = process2.stdin, _stdout = process2.stdout, options) {
    this._stdin = _stdin;
    this._stdout = _stdout;
    this._started = false;
    this._ondata = (chunk) => {
      try {
        this._readBuffer.append(chunk);
        this.processReadBuffer();
      } catch (error) {
        this.onerror?.(error);
        this.close().catch(() => {
        });
      }
    };
    this._onerror = (error) => {
      this.onerror?.(error);
    };
    this._readBuffer = new ReadBuffer({ maxBufferSize: options?.maxBufferSize });
  }
  /**
   * Starts listening for messages on stdin.
   */
  async start() {
    if (this._started) {
      throw new Error("StdioServerTransport already started! If using Server class, note that connect() calls start() automatically.");
    }
    this._started = true;
    this._stdin.on("data", this._ondata);
    this._stdin.on("error", this._onerror);
  }
  processReadBuffer() {
    while (true) {
      try {
        const message = this._readBuffer.readMessage();
        if (message === null) {
          break;
        }
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error);
      }
    }
  }
  async close() {
    this._stdin.off("data", this._ondata);
    this._stdin.off("error", this._onerror);
    const remainingDataListeners = this._stdin.listenerCount("data");
    if (remainingDataListeners === 0) {
      this._stdin.pause();
    }
    this._readBuffer.clear();
    this.onclose?.();
  }
  send(message) {
    return new Promise((resolve4) => {
      const json = serializeMessage(message);
      if (this._stdout.write(json)) {
        resolve4();
      } else {
        this._stdout.once("drain", resolve4);
      }
    });
  }
};

// src/controller/manual-status.mjs
import { createHash } from "node:crypto";
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
function artifactSetHash(entries) {
  const observations = entries.map(({ label, text }) => ({ label, text_hash: createHash("sha256").update(String(text)).digest("hex") })).sort((left, right) => left.label.localeCompare(right.label) || left.text_hash.localeCompare(right.text_hash));
  return createHash("sha256").update(JSON.stringify(observations)).digest("hex");
}
function baseInput(rootPlanId, entries, observedAt) {
  return {
    run_id: null,
    root_plan_id: rootPlanId,
    requested_profile: "manual",
    effective_profile: "manual",
    snapshot_source: "artifact-chain",
    artifact_set_hash: artifactSetHash(entries),
    observed_at: observedAt,
    revision: null
  };
}
function summary(rootPlanId, entries, evidenceTip = null, reviewTip = null) {
  return {
    root_plan_id: rootPlanId,
    artifact_count: entries.length,
    evidence_tip: evidenceTip,
    review_tip: reviewTip
  };
}
function incomplete(rootPlanId, entries, observedAt, blockers) {
  const input = baseInput(rootPlanId, entries, observedAt);
  return {
    snapshot: deriveWorkflowState({ ...input, manual_context_incomplete: true, blockers: unique(blockers) }),
    artifact_summary: summary(rootPlanId, entries),
    diagnostics: []
  };
}
function invalid(rootPlanId, entries, observedAt, blockers, diagnostics = []) {
  const input = baseInput(rootPlanId, entries, observedAt);
  return {
    snapshot: deriveWorkflowState({ ...input, artifact_chain_valid: false, root_schema_valid: false, blockers: unique(blockers) }),
    artifact_summary: summary(rootPlanId, entries),
    diagnostics: unique(diagnostics)
  };
}
function referencedIds(fields) {
  if (fields.artifact === "work-plan") return [fields.predecessor_plan_id, fields.replan_source_review_id];
  if (fields.artifact === "delivery-evidence") return [fields.predecessor_evidence_id, fields.source_review_id];
  if (fields.artifact === "work-review") return [fields.latest_evidence_id, fields.predecessor_review_id];
  return [];
}
function normalizeEntries(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length === 0) return [];
  const entries = artifacts.map((entry, index) => {
    if (!entry || typeof entry.label !== "string" || entry.label.trim() === "" || typeof entry.text !== "string" || entry.text.trim() === "") {
      throw new Error(`manual status artifact ${index + 1} requires non-empty label and text`);
    }
    return { label: entry.label, text: entry.text };
  });
  if (new Set(entries.map((entry) => entry.label)).size !== entries.length) throw new Error("manual status artifact labels must be unique");
  return entries;
}
function activeRootFromEntries(entries, pluginRoot2) {
  const roots = entries.map((entry) => inspectArtifactText(entry.text, pluginRoot2).artifact).filter((artifact2) => artifact2?.fields?.artifact === "work-plan");
  if (roots.length === 0) throw new Error("manual active root resolution requires a current work-plan artifact");
  const ids = new Set(roots.map((root) => root.fields.id));
  if (ids.size !== roots.length) throw new Error("manual active root resolution found duplicate work-plan IDs");
  const referenced = new Set(roots.map((root) => root.fields.predecessor_plan_id).filter((id) => ids.has(id)));
  const tips = roots.filter((root) => !referenced.has(root.fields.id)).map((root) => root.fields.id).sort();
  if (tips.length === 0) throw new Error("manual active root resolution found cyclic work-plan lineage");
  if (tips.length > 1) throw new Error(`manual active root resolution is ambiguous: ${tips.join(", ")}`);
  return tips[0];
}
function deriveManualWorkflowSnapshot({ rootPlanId, artifacts, pluginRoot: pluginRoot2, observedAt = (/* @__PURE__ */ new Date()).toISOString(), manualAcceptance = null }) {
  if (manualAcceptance !== null && manualAcceptance !== "provisional") throw new Error("manual acceptance must be provisional");
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires a complete current Schema 5 artifact chain");
    if (!rootPlanId) throw new Error("manual active root resolution requires current-task artifacts");
    return incomplete(rootPlanId, [], observedAt, ["manual-artifact-context-missing"]);
  }
  const entries = normalizeEntries(artifacts);
  rootPlanId ??= activeRootFromEntries(entries, pluginRoot2);
  if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId))) throw new Error("manual status requires a valid wp-* root_plan_id");
  const inspected = entries.map((entry) => ({ entry, inspection: inspectArtifactText(entry.text, pluginRoot2) }));
  const unparseable = inspected.filter(({ inspection }) => !inspection.artifact?.fields?.artifact);
  if (unparseable.length > 0) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires a parseable current Schema 5 artifact chain");
    return invalid(rootPlanId, entries, observedAt, unparseable.flatMap(({ entry, inspection }) => inspection.errors.map((error) => `${entry.label}: ${error}`)));
  }
  const rootById = new Map(inspected.filter(({ inspection }) => inspection.artifact?.fields?.artifact === "work-plan").map(({ inspection }) => [inspection.artifact.fields.id, inspection.artifact]));
  const lineageRootIds = /* @__PURE__ */ new Set();
  let lineageCursor = rootPlanId;
  while (lineageCursor && !lineageRootIds.has(lineageCursor)) {
    lineageRootIds.add(lineageCursor);
    lineageCursor = rootById.get(lineageCursor)?.fields.predecessor_plan_id ?? null;
  }
  const related = inspected.filter(({ inspection }) => {
    const fields = inspection.artifact.fields;
    return lineageRootIds.has(fields.id) || lineageRootIds.has(fields.root_plan_id);
  });
  const rootRecords = related.filter(({ inspection }) => inspection.artifact.fields.artifact === "work-plan" && inspection.artifact.fields.id === rootPlanId);
  if (rootRecords.length === 0) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires the current root artifact");
    return incomplete(rootPlanId, entries, observedAt, ["manual-root-artifact-missing"]);
  }
  if (rootRecords.length > 1) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires one unambiguous root artifact");
    return invalid(rootPlanId, entries, observedAt, ["manual-root-artifact-ambiguous"]);
  }
  const relatedEntries = related.map(({ entry }) => entry);
  const schemas = new Set(related.map(({ inspection }) => inspection.artifact.fields.schema));
  if (schemas.size === 1 && schemas.has(3)) {
    if (manualAcceptance) throw new Error("Workflow 3 artifact chains are read-only and cannot be accepted");
    const input2 = baseInput(rootPlanId, relatedEntries, observedAt);
    return {
      snapshot: deriveWorkflowState({ ...input2, lifecycle: "stopped", compatibility: "read-only-workflow-3", blockers: ["legacy-workflow-3-read-only"] }),
      artifact_summary: summary(rootPlanId, relatedEntries),
      diagnostics: ["Workflow 3 artifacts are preserved as read-only history and are not converted"]
    };
  }
  if (schemas.size === 1 && schemas.has(4)) {
    if (manualAcceptance) throw new Error("Workflow 4 artifact chains are read-only and cannot be accepted");
    const input2 = baseInput(rootPlanId, relatedEntries, observedAt);
    return {
      snapshot: deriveWorkflowState({ ...input2, lifecycle: "stopped", compatibility: "read-only-workflow-4", blockers: ["legacy-workflow-4-read-only"] }),
      artifact_summary: summary(rootPlanId, relatedEntries),
      diagnostics: ["Workflow 4 artifacts are preserved as read-only history and are not converted"]
    };
  }
  if (schemas.size > 1 || !schemas.has(5)) {
    if (manualAcceptance) throw new Error("manual provisional acceptance rejects mixed or non-current Workflow schemas");
    return invalid(rootPlanId, relatedEntries, observedAt, ["mixed or unsupported Workflow artifact schemas are not supported"]);
  }
  const individualErrors = related.flatMap(({ entry, inspection }) => inspection.errors.map((error) => `${entry.label}: ${error}`));
  if (individualErrors.length > 0) {
    if (manualAcceptance) throw new Error(`manual provisional acceptance rejects an invalid artifact chain: ${individualErrors.join("; ")}`);
    return invalid(rootPlanId, relatedEntries, observedAt, individualErrors, related.flatMap(({ inspection }) => inspection.diagnostics));
  }
  const ids = new Set(related.map(({ inspection }) => inspection.artifact.fields.id));
  const missingReferences = [];
  for (const { entry, inspection } of related) {
    for (const reference of referencedIds(inspection.artifact.fields)) if (reference && !ids.has(reference)) missingReferences.push(`${entry.label}: manual-artifact-context-missing:${reference}`);
  }
  if (missingReferences.length > 0) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires every referenced artifact");
    return incomplete(rootPlanId, relatedEntries, observedAt, missingReferences);
  }
  const chain = inspectArtifactSet(relatedEntries.map(({ label, text }) => [label, text]), pluginRoot2);
  if (chain.errors.length > 0) {
    if (manualAcceptance) throw new Error(`manual provisional acceptance rejects an invalid artifact chain: ${chain.errors.join("; ")}`);
    return invalid(rootPlanId, relatedEntries, observedAt, chain.errors, chain.diagnostics);
  }
  const tips = effectiveCliSummary(chain);
  const evidenceTipId = tips.evidence_tips[rootPlanId] ?? null;
  const reviewTipId = tips.review_tips[rootPlanId] ?? null;
  const root = chain.effective.get(rootPlanId);
  const evidence = evidenceTipId ? chain.effective.get(evidenceTipId) : null;
  const review = reviewTipId ? chain.effective.get(reviewTipId) : null;
  const correctionEvidencePendingReview = Boolean(review && evidence?.fields.source_review_id === review.fields.id && evidence?.fields.subject_id === review.fields.correction_id);
  const acceptanceEligible = root?.fields.profile_max === "manual" && evidence && review && evidence.fields.status !== "blocked" && evidence.fields.overall_grade !== "failed" && !(evidence.fields.check_evidence ?? []).some((check) => check.grade === "failed") && review.fields.delivery_status === "provisional" && review.fields.next_action === "accept-provisional" && !correctionEvidencePendingReview;
  if (manualAcceptance && !acceptanceEligible) {
    throw new Error("manual provisional acceptance requires the unique current provisional review tip, no failed check, no blocked artifact, and no correction awaiting review");
  }
  const input = {
    ...baseInput(rootPlanId, relatedEntries, observedAt),
    contract_level: root.fields.contract_level,
    root_schema_valid: true,
    artifact_chain_valid: true,
    plan_status: root.fields.status,
    plan_approved: Boolean(evidence),
    intent_ready: root.fields.intent_ready === true,
    material_open_decisions: root.fields.status !== "ready" || root.fields.intent_ready !== true,
    product_aligned: true,
    architecture_aligned: true,
    program_design_aligned: true,
    slices_ready: true,
    execution_started: Boolean(evidence),
    evidence_tip: evidenceTipId,
    review_tip: reviewTipId,
    review: review?.fields ?? null,
    evidence_grade: evidence?.fields.overall_grade ?? null,
    delivery_status: review?.fields.delivery_status ?? null,
    intent_hash: evidence?.fields.intent_hash ?? null,
    strategy_revision: evidence?.fields.strategy_revision ?? (evidence?.fields.evidence_mode === "lean" ? 0 : null),
    manual_acceptance: manualAcceptance,
    acceptance_basis_hash: manualAcceptance ? artifactSetHash(relatedEntries) : null,
    correction_evidence_pending_review: correctionEvidencePendingReview,
    root_review_complete: review?.fields.assessment === "achieved" && review?.fields.next_action === "none",
    more_slices: false
  };
  return {
    snapshot: deriveWorkflowState(input),
    artifact_summary: summary(rootPlanId, relatedEntries, evidenceTipId, reviewTipId),
    diagnostics: unique([...chain.normalizations, ...chain.diagnostics])
  };
}

// src/mcp/artifact-handlers.mjs
import { createHash as createHash2 } from "node:crypto";

// hooks/model-inheritance-state.mjs
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
var MODEL_INCIDENT_CAUSES = Object.freeze([
  "explicit-child-model",
  "actual-child-mismatch",
  "parent-model-unavailable",
  "child-model-unavailable",
  "uncorrelated-subagent-start",
  "deny-not-enforced"
]);
var CAUSES = new Set(MODEL_INCIDENT_CAUSES);
var TRANSIENT_TTL_MS = 24 * 60 * 60 * 1e3;
var modelRoot = (stateRoot) => join(stateRoot, "model-inheritance");
var incidentDirectory = (stateRoot, incidentId) => join(modelRoot(stateRoot), "incidents", incidentId);
var incidentPath = (stateRoot, incidentId) => join(incidentDirectory(stateRoot, incidentId), "incident.json");
function readJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
function readIncident(stateRoot, incidentId) {
  const incident = readJson(incidentPath(stateRoot, incidentId));
  if (!incident) return null;
  const observationsDirectory = join(incidentDirectory(stateRoot, incidentId), "observations");
  let childExecuted = false;
  let resultReturned = false;
  let lastObservedAt = incident.recorded_at;
  if (existsSync(observationsDirectory)) {
    for (const name of readdirSync(observationsDirectory).sort()) {
      if (!name.endsWith(".json")) continue;
      const observation = readJson(join(observationsDirectory, name));
      if (!observation) continue;
      childExecuted ||= observation.child_executed === true;
      resultReturned ||= observation.result_returned === true;
      if (observation.observed_at && (!lastObservedAt || observation.observed_at > lastObservedAt)) lastObservedAt = observation.observed_at;
    }
  }
  return {
    ...incident,
    child_executed: childExecuted,
    result_returned: resultReturned,
    last_observed_at: lastObservedAt
  };
}
function publicIncident(value) {
  if (!value) return null;
  return {
    incident_id: value.incident_id,
    cause: value.cause,
    status: value.status,
    phase: value.phase,
    subagent_type: value.subagent_type,
    parent_model: value.parent_model,
    parent_model_id: value.parent_model_id,
    parent_model_params: value.parent_model_params,
    requested_child_model: value.requested_child_model,
    observed_child_model: value.observed_child_model,
    cursor_version: value.cursor_version,
    enforcement: value.enforcement,
    child_executed: value.child_executed,
    result_returned: value.result_returned,
    recorded_at: value.recorded_at,
    last_observed_at: value.last_observed_at
  };
}
function modelInheritanceSummary(stateRoot) {
  const incidentsRoot = join(modelRoot(stateRoot), "incidents");
  if (!existsSync(incidentsRoot)) return {
    authoritative: false,
    status: "clean",
    incident_count: 0,
    last_incident: null,
    enforcement: "no-incident",
    evidence_effect: "none",
    result_policy: "verified-results-remain-usable",
    qualification_policy: "exact-model-attestation-still-required"
  };
  let incidentEntries;
  try {
    incidentEntries = readdirSync(incidentsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  } catch {
    return {
      authoritative: false,
      status: "unattestable",
      incident_count: 0,
      last_incident: null,
      enforcement: "diagnostic-state-unavailable",
      evidence_effect: "none",
      result_policy: "verified-results-remain-usable",
      qualification_policy: "exact-model-attestation-still-required"
    };
  }
  let unreadable = false;
  const incidents = incidentEntries.map((entry) => {
    const incident = readIncident(stateRoot, entry.name);
    unreadable ||= !incident;
    return incident;
  }).filter(Boolean).sort((left, right) => String(left.last_observed_at ?? "").localeCompare(String(right.last_observed_at ?? "")));
  const hasDeviation = incidents.some((entry) => entry.status === "deviated");
  const lastIncident = incidents.at(-1) ?? null;
  return {
    authoritative: false,
    status: hasDeviation ? "deviated" : incidents.length > 0 || unreadable ? "unattestable" : "clean",
    incident_count: incidents.length,
    last_incident: publicIncident(lastIncident),
    enforcement: lastIncident?.enforcement ?? (unreadable ? "diagnostic-state-unavailable" : "no-incident"),
    evidence_effect: "none",
    result_policy: "verified-results-remain-usable",
    qualification_policy: "exact-model-attestation-still-required"
  };
}

// src/mcp/artifact-handlers.mjs
var bundleSize = (artifacts = []) => artifacts.reduce((total, artifact2) => total + artifact2.text.length, 0);
function createArtifactHandlers({ pluginRoot: pluginRoot2, handoffContext: handoffContext2, result: result2 }) {
  const record = async (input) => {
    try {
      if (bundleSize(input.artifacts) > 1e6) throw new Error("handoff artifact bundle exceeds 1000000 characters");
      for (const entry of input.artifacts) {
        const inspected = inspectArtifactText(entry.text, pluginRoot2);
        if (inspected.errors.length > 0 || inspected.artifact?.fields?.schema !== 5 || !["work-plan", "work-review"].includes(inspected.artifact?.fields?.artifact)) {
          throw new Error("workflow_artifact_record accepts only valid Schema-5 work-plan and work-review artifacts");
        }
      }
      const { workspace, handoffStore } = await handoffContext2(input.workspace_root);
      return result2({ workspace_root: workspace, ...handoffStore.record(input.artifacts), handoff_authoritative: false });
    } catch (error) {
      return result2({ error: error.message }, true);
    }
  };
  const context2 = async (input) => {
    try {
      const { workspace, stateRoot, handoffStore } = await handoffContext2(input.workspace_root);
      return result2({
        workspace_root: workspace,
        handoff_authoritative: false,
        ...handoffStore.context(input.root_plan_id, input.root_plan ?? null),
        model_inheritance: modelInheritanceSummary(stateRoot)
      });
    } catch (error) {
      return result2({ error: error.message }, true);
    }
  };
  const closeout = async (input) => {
    try {
      if (bundleSize(input.artifacts) > 1e6) throw new Error("closeout artifact bundle exceeds 1000000 characters");
      const { workspace, handoffStore } = await handoffContext2(input.workspace_root);
      let cached = [];
      try {
        cached = handoffStore.context(input.root_plan_id, input.root_plan ?? null).artifacts.map(({ label, text }) => ({ label, text }));
      } catch (error) {
        if (!input.root_plan) throw error;
      }
      const merged = /* @__PURE__ */ new Map();
      for (const entry of [...cached, ...input.artifacts ?? []]) {
        const prior = merged.get(entry.label);
        if (prior && prior !== entry.text) throw new Error(`closeout artifact label ${entry.label} has conflicting text`);
        merged.set(entry.label, entry.text);
      }
      const rootPlan = input.root_plan ?? [...merged.values()].find((text) => {
        const inspected = inspectArtifactText(text, pluginRoot2);
        return inspected.artifact?.fields?.artifact === "work-plan" && inspected.artifact.fields.id === input.root_plan_id;
      });
      if (!rootPlan) throw new Error("workflow_closeout requires the active Root text or a cached Root");
      const closeoutResult = buildDeliveryEvidence({
        rootPlanText: rootPlan,
        artifacts: [...merged].map(([label, text]) => ({ label, text })),
        checkEvidence: input.check_evidence,
        changedPaths: input.changed_paths,
        strategyRevision: input.strategy_revision,
        effectiveProfile: input.effective_profile,
        repositorySnapshot: input.repository_snapshot ?? null,
        pluginRoot: pluginRoot2
      });
      if (!closeoutResult.artifact) throw new Error("closeout resolved an evidence tip without its exact artifact text");
      const persisted = persistCloseout({
        handoffStore,
        rootPlanText: rootPlan,
        artifacts: [...merged].map(([label, text]) => ({ label, text })),
        closeout: closeoutResult
      });
      return result2({
        workspace_root: workspace,
        root_plan_id: input.root_plan_id,
        delivery_evidence_id: closeoutResult.fields.id,
        artifact: persisted.artifact,
        artifact_hash: persisted.artifact_hash ?? createHash2("sha256").update(persisted.artifact).digest("hex"),
        evidence_mode: persisted.fields.evidence_mode,
        overall_grade: persisted.fields.overall_grade,
        status: persisted.fields.status,
        duplicate: persisted.duplicate,
        handoff_persisted: persisted.handoff_persisted,
        handoff_authoritative: false,
        ...persisted.artifact_set_hash ? { artifact_set_hash: persisted.artifact_set_hash } : {},
        ...persisted.warning ? { warning: persisted.warning } : {}
      });
    } catch (error) {
      return result2({ error: error.message }, true);
    }
  };
  return Object.freeze({ record, context: context2, closeout });
}

// src/mcp/workspace-roots.mjs
import { lstatSync, realpathSync, statSync as statSync2 } from "node:fs";
import { resolve as resolve2 } from "node:path";
import { fileURLToPath } from "node:url";
function rootPath(root) {
  if (!root || typeof root.uri !== "string") throw new Error("MCP client returned an invalid workspace root");
  const url = new URL(root.uri);
  if (url.protocol !== "file:") throw new Error(`Workflow supports only file workspace roots: ${root.uri}`);
  const advertised = resolve2(fileURLToPath(url));
  if (lstatSync(advertised).isSymbolicLink()) throw new Error(`MCP workspace root may not be symlink redirected: ${advertised}`);
  const canonical = realpathSync(advertised);
  if (!statSync2(canonical).isDirectory()) throw new Error(`MCP workspace root is not a directory: ${advertised}`);
  return { advertised, canonical };
}
var WorkspaceRootAuthority = class {
  constructor(listRoots) {
    if (typeof listRoots !== "function") throw new TypeError("WorkspaceRootAuthority requires listRoots");
    this.listRoots = listRoots;
    this.cached = null;
  }
  invalidate() {
    this.cached = null;
  }
  async roots() {
    if (!this.cached) {
      this.cached = Promise.resolve().then(async () => {
        let response;
        try {
          response = await this.listRoots();
        } catch {
          throw new Error("trusted MCP workspace roots are unavailable");
        }
        const entries = (response?.roots ?? []).map(rootPath);
        const unique2 = new Map(entries.map((entry) => [entry.canonical, entry]));
        if (unique2.size === 0) throw new Error("trusted MCP workspace roots are unavailable");
        return [...unique2.values()].sort((left, right) => left.canonical.localeCompare(right.canonical));
      });
    }
    try {
      return await this.cached;
    } catch (error) {
      this.cached = null;
      throw error;
    }
  }
  async resolve(selector = void 0) {
    const roots = await this.roots();
    if (selector === void 0 || selector === null || selector === "") {
      if (roots.length !== 1) throw new Error("multiple MCP workspace roots require workspace_root");
      return roots[0].canonical;
    }
    const advertised = resolve2(selector);
    const allowed = roots.find((entry) => entry.advertised === advertised);
    if (!allowed) throw new Error(`workspace_root is not an advertised MCP root: ${advertised}`);
    let canonical;
    try {
      canonical = realpathSync(advertised);
    } catch {
      throw new Error(`workspace_root is unavailable: ${advertised}`);
    }
    if (canonical !== allowed.canonical) throw new Error(`workspace_root changed after MCP root discovery: ${advertised}`);
    return canonical;
  }
};

// src/mcp/proof-artifacts.mjs
import { createHash as createHash3 } from "node:crypto";
import { lstatSync as lstatSync2, readFileSync as readFileSync2, readdirSync as readdirSync2 } from "node:fs";
import { join as join2 } from "node:path";
var PROOF_LIMITS = Object.freeze({ files: 128, file_bytes: 10 * 1024 * 1024, total_bytes: 32 * 1024 * 1024, depth: 8 });
function hashStableProofFile(path, stat = lstatSync2, read = readFileSync2, before = stat(path)) {
  if (before.size > PROOF_LIMITS.file_bytes) throw new Error(`verification proof artifact exceeds 10 MiB: ${path}`);
  const content = read(path);
  const after = stat(path);
  if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error(`verification proof artifact changed while hashing: ${path}`);
  return { size: before.size, hash: createHash3("sha256").update(content).digest("hex") };
}
function proofArtifacts(root) {
  const files = [];
  let totalBytes = 0;
  const visit = (directory, depth = 0) => {
    if (depth > PROOF_LIMITS.depth) throw new Error(`verification proof artifact depth exceeds ${PROOF_LIMITS.depth}: ${directory}`);
    for (const entry of readdirSync2(directory, { withFileTypes: true })) {
      const path = join2(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`verification proof artifact may not be a symlink: ${path}`);
      if (entry.isDirectory()) visit(path, depth + 1);
      else if (entry.isFile()) {
        if (files.length >= PROOF_LIMITS.files) throw new Error(`verification proof artifact count exceeds ${PROOF_LIMITS.files}`);
        const before = lstatSync2(path);
        if (before.size > PROOF_LIMITS.file_bytes) throw new Error(`verification proof artifact exceeds 10 MiB: ${path}`);
        totalBytes += before.size;
        if (totalBytes > PROOF_LIMITS.total_bytes) throw new Error("verification proof artifacts exceed 32 MiB total");
        const stable = hashStableProofFile(path, lstatSync2, readFileSync2, before);
        files.push({ path, hash: stable.hash });
      } else throw new Error(`verification proof artifact must be a regular file or directory: ${path}`);
    }
  };
  visit(root);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

// src/mcp/tool-contracts.mjs
var workspaceRoot = string().min(1).optional();
var artifact = object({
  label: string().min(1).max(200),
  text: string().min(1).max(25e4)
});
var subject = {
  workspace_root: workspaceRoot,
  run_id: string().min(1).optional(),
  preparation_id: string().min(1).optional()
};
var checkEvidence = object({
  check_id: string().regex(/^CHECK-[1-9][0-9]*$/),
  feature_id: string().min(1).nullable().optional(),
  grade: _enum(["verified", "supported", "partial", "unavailable", "failed"]),
  surface: string().min(1).optional(),
  method: string().min(1).optional(),
  expected: string().min(1).optional(),
  observed: string().min(1),
  repetitions: number().int().min(0).optional(),
  artifact_hashes: array(string().regex(/^[a-f0-9]{64}$/)).max(64).optional(),
  limitations: array(string().min(1)).max(64).optional()
});
var WORKFLOW_TOOL_CONTRACTS = Object.freeze({
  workflow_prepare: {
    description: "Run the configured planner pool in a read-only pre-run phase and produce either one approvable schema-5 intent root or manual intent questions.",
    inputSchema: {
      workspace_root: workspaceRoot,
      goal: string().min(1).optional(),
      root_plan: string().min(1).optional(),
      root_artifacts: array(artifact).min(1).max(32).optional(),
      requested_profile: _enum(["supervised", "autonomous"]),
      route_profile: string().min(1).default("default"),
      expected_revision: literal(0),
      idempotency_key: string().min(8)
    }
  },
  workflow_start: {
    description: "Atomically consume one displayed root-ready preparation after explicit root-hash approval and create exactly one approved run.",
    inputSchema: {
      workspace_root: workspaceRoot,
      preparation_id: string().min(1),
      approved_root_hash: string().length(64),
      expected_preparation_revision: number().int().min(0),
      idempotency_key: string().min(8)
    }
  },
  workflow_artifact_record: {
    description: "Validate and atomically cache exact Schema-5 work-plan or work-review artifacts as non-authoritative cross-context handoff data.",
    inputSchema: { workspace_root: workspaceRoot, artifacts: array(artifact).min(1).max(32) }
  },
  workflow_artifact_context: {
    description: "Return the exact revalidated non-authoritative Schema-5 artifact chain cached for one Root, optionally hash-bound to the supplied active native Plan.",
    inputSchema: {
      workspace_root: workspaceRoot,
      root_plan_id: string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
      root_plan: string().min(1).max(25e4).optional()
    }
  },
  workflow_closeout: {
    description: "Deterministically build, validate, and cache one Schema-5 delivery-evidence artifact from observed Checks without accepting caller-supplied identity, hashes, grade, status, or topology.",
    inputSchema: {
      workspace_root: workspaceRoot,
      root_plan_id: string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
      root_plan: string().min(1).max(25e4).optional(),
      artifacts: array(artifact).min(1).max(32).optional(),
      effective_profile: _enum(["manual", "supervised", "autonomous"]).default("manual"),
      strategy_revision: number().int().min(0).default(0),
      changed_paths: array(string().min(1).max(1e3)).max(1e3).default([]),
      check_evidence: array(checkEvidence).max(128).default([]),
      repository_snapshot: object({
        head: string().min(1).optional(),
        working_tree: string().min(1).optional(),
        relevant_fingerprints: string().min(1).optional(),
        known_failures: string().min(1).optional()
      }).optional()
    }
  },
  workflow_status: {
    description: "Return current status for one preparation, adaptive run, or explicit/uniquely active stateless manual schema-5 artifact chain; Workflow-3/4 subjects remain read-only.",
    inputSchema: {
      ...subject,
      root_plan_id: string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/).optional(),
      manual_acceptance: _enum(["provisional"]).optional(),
      artifacts: array(artifact).min(1).max(32).optional()
    }
  },
  workflow_watch: {
    description: "Return events after a cursor for exactly one planning preparation or run without mutation.",
    inputSchema: {
      ...subject,
      after_event: number().int().min(0).default(0),
      timeout_ms: number().int().min(0).max(3e4).default(0)
    }
  },
  workflow_control: {
    description: "Stop a preparation, or pause, resume, stop, or accept one Run delivery using optimistic revision and idempotency.",
    inputSchema: {
      ...subject,
      action: _enum(["pause", "resume", "stop", "accept"]),
      acceptance: _enum(["verified", "provisional"]).optional(),
      expected_revision: number().int().min(0),
      idempotency_key: string().min(8)
    }
  },
  workflow_answer: {
    description: "Record a human answer for a waiting run; planning preparations intentionally have no answer loop.",
    inputSchema: {
      workspace_root: workspaceRoot,
      run_id: string().min(1),
      answer: string().min(1),
      expected_revision: number().int().min(0),
      idempotency_key: string().min(8)
    }
  },
  workflow_validate_models: {
    description: "Validate ordered pools of concrete approved model candidates against the live Cursor catalog.",
    inputSchema: { workspace_root: workspaceRoot, route_profile: string().min(1).default("default") }
  },
  workflow_verification_profile: {
    description: "Draft, inspect, prove, approve, or audit one hash-bound project verification profile.",
    inputSchema: {
      workspace_root: workspaceRoot,
      action: _enum(["draft", "inspect", "prove", "approve", "audit"]),
      manifest_path: string().min(1).default(".cursor/workflow-verification.yaml"),
      surface: string().min(1).optional(),
      route_profile: string().min(1).default("default"),
      approved_hash: string().length(64).optional()
    }
  }
});
if (Object.keys(WORKFLOW_TOOL_CONTRACTS).sort().join("\n") !== [...WORKFLOW_TOOL_NAMES].sort().join("\n")) {
  throw new Error("MCP tool contracts differ from the canonical tool registry");
}
function toolContract(name) {
  const contract = WORKFLOW_TOOL_CONTRACTS[name];
  if (!contract) throw new Error(`unknown Workflow MCP tool ${name}`);
  return contract;
}

// src/mcp/workflow-mcp.mjs
var pluginRoot = resolve3(process.env.CURSOR_PLUGIN_ROOT ?? dirname2(dirname2(fileURLToPath2(import.meta.url))));
var server = new McpServer({ name: "workflow", version: PLUGIN_VERSION });
var workspaceAuthority = new WorkspaceRootAuthority(() => server.server.listRoots());
server.server.setNotificationHandler(RootsListChangedNotificationSchema, async () => workspaceAuthority.invalidate());
function result(value, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value, isError };
}
function proofResult(text) {
  const source = String(text ?? "");
  const fenced = source.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const value = JSON.parse(fenced ?? source.slice(source.indexOf("{"), source.lastIndexOf("}") + 1));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("verification proof returned no object");
  return value;
}
async function context(workspaceRoot2) {
  const workspace = await workspaceAuthority.resolve(workspaceRoot2);
  const stateRoot = defaultStateRoot(workspace);
  const store = new RunStore(stateRoot);
  const preparationStore = new PreparationStore(stateRoot);
  const handoffStore = new ArtifactHandoffStore(stateRoot, pluginRoot);
  const engine = new WorkflowEngine({ workspaceRoot: workspace, store, preparationStore, pluginRoot, stateRoot });
  const planningEngine = new PlanningEngine({ workspaceRoot: workspace, store: preparationStore, pluginRoot, stateRoot });
  return { workspace, stateRoot, store, preparationStore, handoffStore, engine, planningEngine };
}
async function handoffContext(workspaceRoot2) {
  const workspace = await workspaceAuthority.resolve(workspaceRoot2);
  const stateRoot = defaultStateRoot(workspace);
  return { workspace, stateRoot, handoffStore: new ArtifactHandoffStore(stateRoot, pluginRoot) };
}
var artifactHandlers = createArtifactHandlers({ pluginRoot, handoffContext, result });
function runnerPath() {
  return resolve3(process.env.GELDMACHER_WORKFLOW_RUNNER ?? fileURLToPath2(new URL("./workflow-runner.mjs", import.meta.url)));
}
function launchRunner({ action, workspace, stateRoot, runId = null, preparationId = null }) {
  const subjectArgs = runId ? ["--run-id", runId] : ["--preparation-id", preparationId];
  const child = spawn(process.execPath, [runnerPath(), "--action", action, ...subjectArgs, "--workspace", workspace, "--state-root", stateRoot, "--plugin-root", pluginRoot], {
    detached: true,
    stdio: "ignore",
    env: process.env
  });
  child.unref();
  return child.pid;
}
function requireOneSubject(input) {
  if (Boolean(input.run_id) === Boolean(input.preparation_id)) throw new Error("exactly one of run_id or preparation_id is required");
}
function idempotentRunMutation(store, runId, expectedRevision, idempotencyKey, operation) {
  const before = store.get(runId);
  assertCompatibleRun(before);
  if (before.idempotency?.[idempotencyKey]) return { value: before, duplicate: true };
  if (before.revision !== expectedRevision) throw new Error(`revision conflict: expected ${expectedRevision}, current ${before.revision}`);
  operation(before);
  const after = store.get(runId);
  const recorded = store.update(runId, after.revision, idempotencyKey, (draft) => draft, "idempotency-recorded");
  return { value: recorded, duplicate: false };
}
async function watchEvents(readEvents, afterEvent, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const events = readEvents(afterEvent);
    if (events.length > 0 || Date.now() >= deadline) return events;
    await new Promise((resolveWait) => setTimeout(resolveWait, Math.min(250, Math.max(0, deadline - Date.now()))));
  }
}
server.registerTool("workflow_prepare", toolContract("workflow_prepare"), async (input) => {
  try {
    if (Boolean(input.goal) === Boolean(input.root_plan)) throw new Error("workflow_prepare requires exactly one of goal or root_plan");
    if (input.root_artifacts && !input.root_plan) throw new Error("workflow_prepare root_artifacts require root_plan");
    if ((input.root_artifacts ?? []).reduce((total, artifact2) => total + artifact2.text.length, 0) > 1e6) throw new Error("workflow_prepare root_artifacts exceed 1000000 characters");
    const { workspace, stateRoot, preparationStore, planningEngine } = await context(input.workspace_root);
    const created = planningEngine.prepare({
      goal: input.goal,
      rootPlan: input.root_plan,
      rootArtifacts: input.root_artifacts,
      requestedProfile: input.requested_profile,
      routeProfile: input.route_profile,
      idempotencyKey: input.idempotency_key
    });
    let preparation = created.preparation;
    if (!created.duplicate && preparation.status === "planning") {
      const pid = launchRunner({ action: "prepare", workspace, stateRoot, preparationId: preparation.preparation_id });
      preparation = preparationStore.update(preparation.preparation_id, preparation.revision, null, (draft) => ({ ...draft, runner_pid: pid }), "planner-runner-launched");
    }
    return result({ preparation: preparationView(preparation), duplicate: created.duplicate });
  } catch (error) {
    return result({ error: error.message }, true);
  }
});
server.registerTool("workflow_start", toolContract("workflow_start"), async (input) => {
  try {
    const { workspace, engine, store, stateRoot } = await context(input.workspace_root);
    const started = engine.start({
      preparationId: input.preparation_id,
      approvedRootHash: input.approved_root_hash,
      expectedPreparationRevision: input.expected_preparation_revision,
      idempotencyKey: input.idempotency_key
    });
    let run = started.run;
    if (!started.duplicate && run.lifecycle === "queued") {
      const pid = launchRunner({ action: "execute", workspace, stateRoot, runId: run.run_id });
      run = store.update(run.run_id, run.revision, null, (draft) => ({ ...draft, runner_pid: pid }), "runner-launched");
    }
    return result({ run: runView(run), snapshot: engine.snapshot(run), preparation: preparationView(started.preparation), duplicate: started.duplicate });
  } catch (error) {
    return result({ error: error.message }, true);
  }
});
server.registerTool("workflow_artifact_record", toolContract("workflow_artifact_record"), artifactHandlers.record);
server.registerTool("workflow_artifact_context", toolContract("workflow_artifact_context"), artifactHandlers.context);
server.registerTool("workflow_closeout", toolContract("workflow_closeout"), artifactHandlers.closeout);
server.registerTool("workflow_status", toolContract("workflow_status"), async (input) => {
  try {
    const subjectCount = [input.run_id, input.preparation_id, input.root_plan_id].filter(Boolean).length;
    if (subjectCount > 1) throw new Error("workflow_status accepts only one of run_id, preparation_id, or root_plan_id");
    if (input.artifacts && (input.run_id || input.preparation_id)) throw new Error("workflow_status artifacts cannot be combined with a controller subject");
    if (input.root_plan_id && !input.artifacts) throw new Error("manual workflow_status requires artifacts with root_plan_id");
    if (input.artifacts) {
      if (input.artifacts.reduce((total, artifact2) => total + artifact2.text.length, 0) > 1e6) throw new Error("manual workflow_status artifact bundle exceeds 1000000 characters");
      const workspace = await workspaceAuthority.resolve(input.workspace_root);
      const stateRoot2 = defaultStateRoot(workspace);
      const manual = deriveManualWorkflowSnapshot({ rootPlanId: input.root_plan_id, artifacts: input.artifacts, pluginRoot, manualAcceptance: input.manual_acceptance ?? null });
      return result({ subject_kind: "artifact-chain", run: null, ...manual, workspace_root: workspace, model_inheritance: modelInheritanceSummary(stateRoot2) });
    }
    if (input.manual_acceptance) throw new Error("workflow_status manual_acceptance requires current-task artifacts");
    const { stateRoot, store, preparationStore, engine } = await context(input.workspace_root);
    const model_inheritance = modelInheritanceSummary(stateRoot);
    if (input.run_id) {
      const run = store.get(input.run_id);
      return result({ subject_kind: "run", run: runView(run), snapshot: engine.snapshot(run), model_inheritance });
    }
    if (input.preparation_id) return result({ subject_kind: "preparation", preparation: preparationView(preparationStore.get(input.preparation_id)), model_inheritance });
    const active = [
      ...store.active().map((run) => ({ kind: "run", value: run })),
      ...preparationStore.active().map((preparation) => ({ kind: "preparation", value: preparation }))
    ];
    if (active.length === 0) throw new Error("no active Workflow Preparation or Run");
    if (active.length > 1) throw new Error("multiple active Workflow subjects require an explicit ID");
    if (active[0].kind === "run") return result({ subject_kind: "run", run: runView(active[0].value), snapshot: engine.snapshot(active[0].value), model_inheritance });
    return result({ subject_kind: "preparation", preparation: preparationView(active[0].value), model_inheritance });
  } catch (error) {
    return result({ error: error.message }, true);
  }
});
server.registerTool("workflow_watch", toolContract("workflow_watch"), async (input) => {
  try {
    requireOneSubject(input);
    const { store, preparationStore, engine } = await context(input.workspace_root);
    if (input.run_id) {
      const events2 = await watchEvents((after) => store.events(input.run_id, after), input.after_event, input.timeout_ms);
      const run = store.get(input.run_id);
      return result({ subject_kind: "run", events: events2, next_event: input.after_event + events2.length, run: runView(run), snapshot: engine.snapshot(run) });
    }
    const events = await watchEvents((after) => preparationStore.events(input.preparation_id, after), input.after_event, input.timeout_ms);
    const preparation = preparationStore.get(input.preparation_id);
    return result({ subject_kind: "preparation", events, next_event: input.after_event + events.length, preparation: preparationView(preparation) });
  } catch (error) {
    return result({ error: error.message }, true);
  }
});
server.registerTool("workflow_control", toolContract("workflow_control"), async (input) => {
  try {
    requireOneSubject(input);
    const { workspace, store, preparationStore, engine, stateRoot } = await context(input.workspace_root);
    if (input.preparation_id) {
      if (input.action !== "stop") throw new Error("preparations accept only stop");
      let runnerPid = null;
      const mutation2 = preparationStore.controlUpdate(input.preparation_id, input.expected_revision, input.idempotency_key, (before) => {
        if (["consumed", "expired", "stopped"].includes(before.status)) throw new Error(`cannot stop preparation status ${before.status}`);
        runnerPid = before.runner_pid;
        return { ...before, status: "stopped", runner_pid: null, blockers: [.../* @__PURE__ */ new Set([...before.blockers ?? [], "stopped-by-user"])] };
      }, "preparation-stopped");
      if (!mutation2.duplicate && runnerPid) {
        writeWorkerControl(preparationStore.preparationDirectory(input.preparation_id), "stop", { reason: "user-stop" });
        const cooperative = await awaitCooperativeExit(runnerPid);
        if (cooperative.hard_kill_required) {
          try {
            process.kill(-runnerPid, "SIGTERM");
          } catch {
          }
          preparationStore.appendEvent(input.preparation_id, "planner-hard-cancelled", cooperative);
          const latest = preparationStore.get(input.preparation_id);
          preparationStore.update(input.preparation_id, latest.revision, null, (draft) => ({ ...draft, status: "interrupted", runner_pid: null, blockers: [.../* @__PURE__ */ new Set([...draft.blockers ?? [], "cooperative-cancel-grace-exceeded"])] }), "planner-cancel-interrupted");
        } else preparationStore.appendEvent(input.preparation_id, "planner-cooperatively-cancelled", cooperative);
      }
      return result({ subject_kind: "preparation", preparation: preparationView(mutation2.preparation), duplicate: mutation2.duplicate });
    }
    let controlledRunnerPid = null;
    const mutation = idempotentRunMutation(store, input.run_id, input.expected_revision, input.idempotency_key, (before) => {
      if (input.action === "accept") {
        if (!["accept-verified", "accept-provisional"].includes(before.next_action)) throw new Error("delivery is not awaiting acceptance");
        if (!input.acceptance) throw new Error("delivery acceptance requires verified or provisional");
        engine.acceptDelivery(input.run_id, input.acceptance);
      } else if (input.action === "pause") {
        controlledRunnerPid = before.runner_pid;
        engine.update(input.run_id, (draft) => ({ ...draft, lifecycle: "paused", next_action: "resume" }), "run-paused");
      } else if (input.action === "resume") {
        if (!["paused", "interrupted"].includes(before.lifecycle)) throw new Error(`cannot resume lifecycle ${before.lifecycle}`);
        if (!before.plan) throw new Error("cannot resume without a complete schema-5 intent root");
        clearWorkerControl(store.runDirectory(input.run_id));
        engine.update(input.run_id, (draft) => ({ ...draft, lifecycle: "queued", blockers: [], next_action: "execute-strategy" }), "run-resumed");
      } else if (input.action === "stop") {
        controlledRunnerPid = before.runner_pid;
        engine.update(input.run_id, (draft) => ({ ...draft, lifecycle: "stopped", next_action: "none" }), "run-stopped");
      }
    });
    let run = mutation.value;
    if (!mutation.duplicate && ["pause", "stop"].includes(input.action) && controlledRunnerPid) {
      writeWorkerControl(store.runDirectory(input.run_id), input.action, { reason: `user-${input.action}` });
      const cooperative = await awaitCooperativeExit(controlledRunnerPid);
      if (cooperative.hard_kill_required) {
        try {
          process.kill(-controlledRunnerPid, "SIGTERM");
        } catch {
        }
        store.appendEvent(input.run_id, "runner-hard-cancelled", cooperative);
        const latest = store.get(input.run_id);
        run = store.update(input.run_id, latest.revision, null, (draft) => ({ ...draft, lifecycle: "interrupted", runner_pid: null, blockers: [.../* @__PURE__ */ new Set([...draft.blockers ?? [], "cooperative-cancel-grace-exceeded"])] }), "runner-cancel-interrupted");
      } else store.appendEvent(input.run_id, "runner-cooperatively-cancelled", cooperative);
    }
    if (!mutation.duplicate && run.lifecycle === "queued") {
      const pid = launchRunner({ action: "execute", workspace, stateRoot, runId: run.run_id });
      run = store.update(run.run_id, run.revision, null, (draft) => ({ ...draft, runner_pid: pid }), "runner-launched");
    }
    return result({ subject_kind: "run", run: runView(run), snapshot: engine.snapshot(run), duplicate: mutation.duplicate });
  } catch (error) {
    return result({ error: error.message }, true);
  }
});
server.registerTool("workflow_answer", toolContract("workflow_answer"), async (input) => {
  try {
    const { store, engine } = await context(input.workspace_root);
    const mutation = idempotentRunMutation(store, input.run_id, input.expected_revision, input.idempotency_key, (before) => {
      if (before.lifecycle !== "waiting-human") throw new Error("run is not waiting for a human answer");
      engine.update(input.run_id, (draft) => ({ ...draft, answers: [...draft.answers ?? [], { at: (/* @__PURE__ */ new Date()).toISOString(), answer: input.answer }], blockers: [], next_action: "replan" }), "answer-recorded");
    });
    return result({ run: runView(mutation.value), snapshot: engine.snapshot(mutation.value), duplicate: mutation.duplicate });
  } catch (error) {
    return result({ error: error.message }, true);
  }
});
server.registerTool("workflow_validate_models", toolContract("workflow_validate_models"), async ({ workspace_root, route_profile }) => {
  try {
    const { workspace, stateRoot } = await context(workspace_root);
    const config = loadWorkflowConfig(workspace);
    if (config.errors.length > 0) return result({ verified: false, errors: config.errors, capabilities: resolveCapabilities(stateRoot, {}, { pluginRoot }) });
    const profile = resolveRouteProfile(config, route_profile);
    const validation = new CursorWorkerAdapter({ runDirectory: resolve3(stateRoot, "model-validation"), pluginRoot }).validateProfile(profile);
    return result({ ...validation, capabilities: resolveCapabilities(stateRoot, { model_catalog_verified: validation.verified }, { pluginRoot }) });
  } catch (error) {
    return result({ verified: false, errors: [error.message] }, true);
  }
});
server.registerTool("workflow_verification_profile", toolContract("workflow_verification_profile"), async (input) => {
  let ownedProofRoot = null;
  let retainProof = false;
  try {
    const { workspace, stateRoot } = await context(input.workspace_root);
    if (input.action === "draft") {
      if (!input.surface) throw new Error("draft requires surface");
      return result(draftVerificationProfile(workspace, input.surface, pluginRoot, input.manifest_path));
    }
    const inspection = inspectVerificationProfile(workspace, input.manifest_path, pluginRoot);
    if (input.action === "inspect") return result(inspection, !inspection.valid);
    if (input.action === "audit") return result(auditVerificationProfile(workspace, input.manifest_path, pluginRoot, stateRoot));
    if (input.action === "prove") {
      if (!inspection.valid) throw new Error(`verification profile invalid: ${inspection.errors.join("; ")}`);
      const config = loadWorkflowConfig(workspace);
      if (config.errors.length > 0) throw new Error(`workflow configuration invalid: ${config.errors.join("; ")}`);
      const route = resolveRouteProfile(config, input.route_profile);
      const proofRoot = join3(stateRoot, "verification-proof-artifacts", inspection.profile_hash, randomUUID());
      ownedProofRoot = proofRoot;
      mkdirSync2(proofRoot, { recursive: true, mode: 448 });
      const adapter = new CursorWorkerAdapter({ runDirectory: join3(stateRoot, "verification-proof-runs", inspection.profile_hash), pluginRoot });
      const validation = adapter.validateProfile(route);
      const verifier = validation.routes?.verifier;
      if (!validation.verified || !verifier?.selected_candidate || !verifier.model) throw new Error(`verifier route unavailable: ${(validation.errors ?? []).join("; ")}`);
      const prompt = [
        "Execute the referenced project Verification Profile now. Repository files are read-only.",
        "Perform launch, doctor, one representative feature drive, observe, evidence capture, reset, and cleanup in that order.",
        "Write every screenshot, trace, log, and receipt only to the external artifact directory. Do not claim a capability without actually performing it.",
        "Return JSON with capabilities containing boolean launch, doctor, drive, observe, evidence, reset, cleanup plus observations and limitations.",
        `PROFILE HASH
${inspection.profile_hash}`,
        `EXTERNAL ARTIFACT DIRECTORY
${proofRoot}`,
        ...inspection.sources.map(({ path, content }) => `SOURCE ${path}
${content}`)
      ].join("\n\n");
      const phase = adapter.runPhase({
        role: "verifier",
        route: verifier.selected_candidate,
        routePoolHash: verifier.pool_hash,
        selectionReason: verifier.selection_reason,
        acceptedModel: verifier.model,
        prompt,
        cwd: workspace,
        verifierArtifactPaths: [proofRoot],
        configurationHash: verifier.pool_hash,
        artifactProjectionHash: inspection.profile_hash
      });
      if (!phase.response.ok || !phase.receipt.model_attested) throw new Error(phase.response.error?.message ?? "verification proof model was not attested");
      const reported = proofResult(phase.response.result);
      const artifacts = proofArtifacts(proofRoot);
      if (artifacts.length === 0) throw new Error("verification proof produced no external artifacts");
      const recorded = recordVerificationProof(stateRoot, inspection, {
        capabilities: reported.capabilities,
        observations: reported.observations ?? null,
        limitations: reported.limitations ?? [],
        evidence_hashes: artifacts.map((artifact2) => artifact2.hash),
        artifacts,
        actor_receipt: phase.receipt
      });
      retainProof = true;
      return result(recorded);
    }
    if (!input.approved_hash) throw new Error("approve requires approved_hash");
    if (!inspection.valid || inspection.profile_hash !== input.approved_hash) throw new Error("current verification profile does not match approved_hash");
    return result(approveVerificationProfile(stateRoot, inspection.manifest.profile_id, input.approved_hash));
  } catch (error) {
    return result({ error: error.message }, true);
  } finally {
    if (ownedProofRoot && !retainProof) rmSync2(ownedProofRoot, { recursive: true, force: true });
  }
});
var transport = new StdioServerTransport();
await server.connect(transport);
