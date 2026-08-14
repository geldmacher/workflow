#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  WorkflowEngine,
  buildDeliveryEvidence,
  buildWorkReview,
  canonicalManualWorkspaceRoot,
  captureRepositorySnapshot,
  deriveControllerLearningContext,
  derivePreparationLearningContext,
  deriveWorkflowState,
  invalidateManualCheckReceipts,
  loadManualCheckReceipts,
  manualConstraintProjection,
  manualReceiptHash,
  persistCloseout,
  persistWorkReview,
  readManualReceiptRecord,
  repositorySnapshotFingerprint,
  stableManualReceiptJson
} from "./chunks/chunk-YPPFNCNR.mjs";
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
  boolean,
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
  record,
  safeParse,
  safeParseAsync,
  serializeMessage,
  strictObject,
  string,
  toJsonSchemaCompat,
  union,
  unknown,
  writeWorkerControl
} from "./chunks/chunk-TQ35CSHE.mjs";
import {
  PlanningEngine,
  approveVerificationProfile,
  auditVerificationProfile,
  draftVerificationProfile,
  inspectVerificationProfile,
  recordVerificationProof,
  resolveCapabilities
} from "./chunks/chunk-I6YVFW7V.mjs";
import {
  loadWorkflowConfig,
  resolveRouteProfile
} from "./chunks/chunk-4R2RYEAH.mjs";
import {
  CursorWorkerAdapter
} from "./chunks/chunk-DBXU2LFJ.mjs";
import "./chunks/chunk-PKEO6PA3.mjs";
import {
  ArtifactHandoffStore,
  createContentAddressedHandoffStore,
  rememberContentAddressedRoot,
  resolveRootPlanText
} from "./chunks/chunk-RKPP3PNR.mjs";
import {
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
  preflightRootPlan
} from "./chunks/chunk-JTPOR5B6.mjs";
import {
  PreparationStore,
  RunStore,
  defaultHostPreferencesPath,
  defaultStateRoot,
  parsePreferenceYaml,
  resolveHostToolApproval,
  rootContentHash,
  sharedArtifactStateRoot
} from "./chunks/chunk-LX4EPHHS.mjs";
import {
  PLUGIN_VERSION,
  assertCompatibleRun,
  preparationView,
  runView
} from "./chunks/chunk-H6YRBJ7B.mjs";
import "./chunks/chunk-IQRLCJ3K.mjs";

// src/mcp/workflow-mcp.mjs
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync as mkdirSync2, rmSync as rmSync2 } from "node:fs";
import { dirname as dirname2, join as join4, resolve as resolve4 } from "node:path";
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
      await new Promise((resolve5) => setTimeout(resolve5, pollInterval));
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
  _createRegisteredTool(name, title, description, inputSchema, outputSchema, annotations3, execution, _meta, handler) {
    validateAndWarnToolName(name);
    const registeredTool = {
      title,
      description,
      inputSchema: getZodSchemaObject(inputSchema),
      outputSchema: getZodSchemaObject(outputSchema),
      annotations: annotations3,
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
    let annotations3;
    if (typeof rest[0] === "string") {
      description = rest.shift();
    }
    if (rest.length > 1) {
      const firstArg = rest[0];
      if (isZodRawShapeCompat(firstArg)) {
        inputSchema = rest.shift();
        if (rest.length > 1 && typeof rest[0] === "object" && rest[0] !== null && !isZodRawShapeCompat(rest[0])) {
          annotations3 = rest.shift();
        }
      } else if (typeof firstArg === "object" && firstArg !== null) {
        if (Object.values(firstArg).some((v) => typeof v === "object" && v !== null)) {
          throw new Error(`Tool ${name} expected a Zod schema or ToolAnnotations, but received an unrecognized object`);
        }
        annotations3 = rest.shift();
      }
    }
    const callback = rest[0];
    return this._createRegisteredTool(name, void 0, description, inputSchema, outputSchema, annotations3, { taskSupport: "forbidden" }, void 0, callback);
  }
  /**
   * Registers a tool with a config object and callback.
   */
  registerTool(name, config, cb) {
    if (this._registeredTools[name]) {
      throw new Error(`Tool ${name} is already registered`);
    }
    const { title, description, inputSchema, outputSchema, annotations: annotations3, _meta } = config;
    return this._createRegisteredTool(name, title, description, inputSchema, outputSchema, annotations3, { taskSupport: "forbidden" }, _meta, cb);
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
    return new Promise((resolve5) => {
      const json = serializeMessage(message);
      if (this._stdout.write(json)) {
        resolve5();
      } else {
        this._stdout.once("drain", resolve5);
      }
    });
  }
};

// src/controller/learning-source-receipt.mjs
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
var receiptSchema = 1;
var defaultTtlMs = 6 * 60 * 60 * 1e3;
function encode(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}
function decode(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}
function signature(secret, payload) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
function safeEqual(left, right) {
  const leftBytes = Buffer.from(String(left));
  const rightBytes = Buffer.from(String(right));
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
function createLearningSourceReceiptAuthority({ secret = randomBytes(32), now = () => Date.now(), ttlMs = defaultTtlMs } = {}) {
  if (!Buffer.isBuffer(secret) || secret.length < 32) throw new Error("learning source receipt secret must contain at least 32 bytes");
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("learning source receipt TTL must be positive");
  return Object.freeze({
    issue(run) {
      if (typeof run?.run_id !== "string" || run.run_id === "") throw new Error("learning source receipt requires a Run ID");
      const rootPlanId = run.plan?.fields?.id ?? run.root_plan_id;
      if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId))) throw new Error("learning source receipt requires a Root ID");
      const issuedAt = now();
      const payload = encode({
        schema: receiptSchema,
        source_kind: "controller-run",
        run_id: run.run_id,
        root_plan_id: rootPlanId,
        issued_at: new Date(issuedAt).toISOString(),
        expires_at: new Date(issuedAt + ttlMs).toISOString(),
        nonce: randomBytes(16).toString("base64url")
      });
      return `${payload}.${signature(secret, payload)}`;
    },
    verify(receipt, run) {
      if (typeof receipt !== "string" || receipt === "") return { confirmed: false, kind: null, blocker: "controller-learning-source-not-current-task-bound" };
      const [payload, suppliedSignature, extra] = receipt.split(".");
      if (!payload || !suppliedSignature || extra !== void 0 || !safeEqual(signature(secret, payload), suppliedSignature)) {
        return { confirmed: false, kind: "ephemeral-receipt", blocker: "controller-learning-source-receipt-invalid" };
      }
      let value;
      try {
        value = decode(payload);
      } catch {
        return { confirmed: false, kind: "ephemeral-receipt", blocker: "controller-learning-source-receipt-invalid" };
      }
      const rootPlanId = run?.plan?.fields?.id ?? run?.root_plan_id;
      if (value?.schema !== receiptSchema || value?.source_kind !== "controller-run" || value?.run_id !== run?.run_id || value?.root_plan_id !== rootPlanId || !Number.isFinite(Date.parse(value?.issued_at)) || !Number.isFinite(Date.parse(value?.expires_at))) {
        return { confirmed: false, kind: "ephemeral-receipt", blocker: "controller-learning-source-receipt-invalid" };
      }
      if (Date.parse(value.expires_at) < now()) return { confirmed: false, kind: "ephemeral-receipt", blocker: "controller-learning-source-receipt-expired" };
      return { confirmed: true, kind: "ephemeral-receipt", blocker: null };
    }
  });
}

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
function summary(rootPlanId, entries, evidenceTip = null, reviewTip = null, learningCandidates = [], traceability = {}) {
  return {
    root_plan_id: rootPlanId,
    artifact_count: entries.length,
    evidence_tip: evidenceTip,
    review_tip: reviewTip,
    learning_candidates: learningCandidates,
    ...traceability
  };
}
function deriveManualLearningProjection({ snapshot, artifact_summary: artifactSummary }) {
  const blockers = [];
  if (snapshot?.state !== "achieved") blockers.push("learning-source-not-achieved");
  if (snapshot?.delivery_status !== "verified") blockers.push("learning-source-not-verified");
  return {
    schema: 1,
    eligible: blockers.length === 0,
    source_kind: "artifact-chain",
    source_id: snapshot?.root_plan_id ?? artifactSummary?.root_plan_id ?? null,
    root_plan_id: snapshot?.root_plan_id ?? artifactSummary?.root_plan_id ?? null,
    effective_profile: "manual",
    blockers,
    workspace_match: { status: "not-required", matched: true, paths: [] },
    delivery_commit: null,
    delivered_paths: [],
    event_chain_valid: null,
    compatibility: snapshot?.compatibility ?? "compatible",
    source_binding: { status: "confirmed", kind: "current-task-artifacts" },
    candidates: (artifactSummary?.learning_candidates ?? []).map((candidate) => ({ ...candidate }))
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
  const roots = entries.map((entry) => inspectArtifactText(entry.text, pluginRoot2).artifact).filter((artifact3) => artifact3?.fields?.artifact === "work-plan");
  if (roots.length === 0) throw new Error("manual active root resolution requires a current work-plan artifact");
  const ids = new Set(roots.map((root) => root.fields.id));
  if (ids.size !== roots.length) throw new Error("manual active root resolution found duplicate work-plan IDs");
  const referenced = new Set(roots.map((root) => root.fields.predecessor_plan_id).filter((id) => ids.has(id)));
  const tips = roots.filter((root) => !referenced.has(root.fields.id)).map((root) => root.fields.id).sort();
  if (tips.length === 0) throw new Error("manual active root resolution found cyclic work-plan lineage");
  if (tips.length > 1) throw new Error(`manual active root resolution is ambiguous: ${tips.join(", ")}`);
  return tips[0];
}
function deriveManualWorkflowSnapshot({ rootPlanId, artifacts, pluginRoot: pluginRoot2, observedAt = (/* @__PURE__ */ new Date()).toISOString(), manualAcceptance = null, boundaryReceiptVerifier: boundaryReceiptVerifier2 = null }) {
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
  const chain = inspectArtifactSet(
    relatedEntries.map(({ label, text }) => [label, text]),
    pluginRoot2,
    { boundaryReceiptVerifier: boundaryReceiptVerifier2 }
  );
  if (chain.errors.length > 0) {
    if (manualAcceptance) throw new Error(`manual provisional acceptance rejects an invalid artifact chain: ${chain.errors.join("; ")}`);
    const boundaryTrustErrors = chain.errors.filter((error) => /root-boundary review requires a fresh protected host receipt|boundary receipt is not trusted|boundary receipt host verification failed/.test(error));
    if (boundaryTrustErrors.length > 0) {
      const blocked = incomplete(rootPlanId, relatedEntries, observedAt, boundaryTrustErrors);
      return { ...blocked, diagnostics: unique([...blocked.diagnostics, ...chain.diagnostics]) };
    }
    return invalid(rootPlanId, relatedEntries, observedAt, chain.errors, chain.diagnostics);
  }
  const tips = effectiveCliSummary(chain);
  const evidenceTipId = tips.evidence_tips[rootPlanId] ?? null;
  const reviewTipId = tips.review_tips[rootPlanId] ?? null;
  const root = chain.effective.get(rootPlanId);
  const evidence = evidenceTipId ? chain.effective.get(evidenceTipId) : null;
  const review = reviewTipId ? chain.effective.get(reviewTipId) : null;
  const boundaryReview = review?.fields.review_basis === "root-boundary";
  const correctionEvidencePendingReview = Boolean(review && evidence?.fields.source_review_id === review.fields.id && evidence?.fields.subject_id === review.fields.correction_id);
  const contract = executionContractFromArtifactText(rootRecords[0].entry.text, pluginRoot2);
  const constraintProjection = contract.errors.length === 0 ? manualConstraintProjection({
    checks: contract.checks,
    evidence: evidence?.fields.check_evidence ?? [],
    pending: !evidence
  }) : {};
  const legacyReceiptGap = (constraintProjection.constraint_summary?.legacy_unattested_verified_checks?.length ?? 0) > 0;
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
    plan_approved: Boolean(evidence || boundaryReview),
    intent_ready: root.fields.intent_ready === true,
    material_open_decisions: root.fields.status !== "ready" || root.fields.intent_ready !== true,
    product_aligned: true,
    architecture_aligned: true,
    program_design_aligned: true,
    slices_ready: true,
    execution_started: Boolean(evidence || boundaryReview),
    evidence_tip: evidenceTipId,
    review_tip: reviewTipId,
    review: review?.fields ?? null,
    evidence_grade: legacyReceiptGap ? "supported" : evidence?.fields.overall_grade ?? null,
    delivery_status: legacyReceiptGap ? null : review?.fields.delivery_status ?? null,
    intent_hash: evidence?.fields.intent_hash ?? null,
    strategy_revision: evidence?.fields.strategy_revision ?? (evidence?.fields.evidence_mode === "lean" ? 0 : null),
    manual_acceptance: manualAcceptance,
    acceptance_basis_hash: manualAcceptance ? artifactSetHash(relatedEntries) : null,
    correction_evidence_pending_review: correctionEvidencePendingReview,
    boundary_review: boundaryReview,
    root_review_complete: !legacyReceiptGap && review?.fields.assessment === "achieved" && review?.fields.next_action === "none",
    more_slices: false
  };
  return {
    snapshot: deriveWorkflowState(input),
    artifact_summary: summary(rootPlanId, relatedEntries, evidenceTipId, reviewTipId, tips.learning_candidates, {
      artifact_set_hash: artifactSetHash(relatedEntries),
      root_content_hash: createHash("sha256").update(root.text).digest("hex"),
      evidence_hash: evidence ? createHash("sha256").update(evidence.text).digest("hex") : null,
      review_hash: review ? createHash("sha256").update(review.text).digest("hex") : null,
      finding_ids: (review?.findings ?? []).map((finding2) => finding2["Finding key"]).filter(Boolean),
      receipt_ids: [...new Set((evidence?.fields.check_evidence ?? []).flatMap((check) => check.artifact_hashes ?? []))]
    }),
    diagnostics: unique([...chain.normalizations, ...chain.diagnostics]),
    ...constraintProjection
  };
}

// src/core/manual-boundary-receipts.mjs
import { join, relative, resolve } from "node:path";
var MANUAL_BOUNDARY_RECEIPT_TTL_MS = 15 * 60 * 1e3;
var MANUAL_BOUNDARY_RECOVERY_REASONS = Object.freeze({
  "baseline-unavailable-after-mutation": "baseline-unavailable-after-mutation",
  "authority-violation": "out-of-authority-changes",
  "repository-observation-conflict": "workspace-ambiguous-after-mutation",
  "artifact-text-conflict": "root-binding-lost-after-mutation"
});
var sha256 = manualReceiptHash;
var stableJson = stableManualReceiptJson;
var canonicalWorkspaceRoot = canonicalManualWorkspaceRoot;
function normalizedObservedPaths(paths, repositoryRoot) {
  const root = resolve(repositoryRoot);
  return [...new Set((paths ?? []).map((value) => {
    const source = String(value ?? "").trim();
    if (!source || source.includes("\\") || source.includes("\0")) throw new Error("boundary receipt observed paths must be normalized repository-relative paths");
    const candidate = resolve(root, source);
    const rel = relative(root, candidate).replaceAll("\\", "/");
    if (!rel || rel === ".." || rel.startsWith("../") || rel.startsWith("/")) {
      throw new Error(`boundary receipt path escapes the repository: ${source}`);
    }
    return rel;
  }))].sort();
}
function receiptBase(workspaceRoot3, rootHash, options = {}) {
  return join(sharedArtifactStateRoot(workspaceRoot3, options), "manual-boundary-receipts", rootHash);
}
function exactRoot(rootPlanText, pluginRoot2) {
  const inspected = inspectArtifactText(rootPlanText, pluginRoot2);
  if (inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan" || inspected.artifact?.fields?.schema !== 5) {
    throw new Error(`boundary receipt requires an exact valid Schema-5 Root: ${inspected.errors.join("; ") || "not a work-plan"}`);
  }
  return inspected.artifact.fields;
}
function receiptIdentity(receipt) {
  return `br-${sha256(stableJson({ ...receipt, receipt_id: void 0 }))}`;
}
function verifyManualBoundaryReceipt({
  receipt,
  rootPlanText,
  pluginRoot: pluginRoot2,
  workspaceRoot: workspaceRoot3,
  captureSnapshot = captureRepositorySnapshot,
  now = () => /* @__PURE__ */ new Date(),
  options = {}
}) {
  try {
    exactRoot(rootPlanText, pluginRoot2);
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) throw new Error("boundary receipt is missing");
    if (!/^br-[a-f0-9]{64}$/.test(String(receipt.receipt_id ?? "")) || receiptIdentity(receipt) !== receipt.receipt_id) {
      throw new Error("boundary receipt identity is invalid");
    }
    const expectedReason = MANUAL_BOUNDARY_RECOVERY_REASONS[receipt.recovery_error_code];
    if (!expectedReason || receipt.reason_codes?.length !== 1 || receipt.reason_codes[0] !== expectedReason) {
      throw new Error("boundary receipt recovery proof is invalid");
    }
    if (receipt.root_content_hash !== rootContentHash(rootPlanText)) throw new Error("boundary receipt Root binding is stale");
    const snapshot = captureSnapshot(workspaceRoot3);
    const repositoryRoot = canonicalWorkspaceRoot(snapshot.repository_root);
    if (repositoryRoot !== canonicalWorkspaceRoot(workspaceRoot3)) throw new Error("boundary receipt repository binding is invalid");
    if (receipt.repository_snapshot_hash !== repositorySnapshotFingerprint(snapshot)) throw new Error("boundary receipt repository snapshot is stale");
    const paths = normalizedObservedPaths(receipt.observed_paths, repositoryRoot);
    if (stableJson(paths) !== stableJson(receipt.observed_paths)) throw new Error("boundary receipt observed paths are not canonical");
    if (stableJson(paths) !== stableJson(normalizedObservedPaths(snapshot.dirty_paths, repositoryRoot))) {
      throw new Error("boundary receipt observed paths no longer equal the complete current dirty-path set");
    }
    if (expectedReason === "out-of-authority-changes" && paths.length === 0) throw new Error("boundary receipt omits the out-of-authority path");
    const stateRoot = sharedArtifactStateRoot(repositoryRoot, options);
    const path = join(receiptBase(repositoryRoot, receipt.root_content_hash, options), `${receipt.receipt_id}.json`);
    const record2 = readManualReceiptRecord(path, stateRoot);
    if (!record2) throw new Error("boundary receipt has no safe protected host record");
    if (record2?.schema !== 1 || record2?.kind !== "manual-boundary-receipt-record") throw new Error("boundary receipt host record is incompatible");
    if (record2.repository_root !== repositoryRoot || record2.receipt_hash !== sha256(stableJson(receipt)) || stableJson(record2.receipt) !== stableJson(receipt)) {
      throw new Error("boundary receipt host record does not match the artifact");
    }
    const observed = Date.parse(receipt.observed_at);
    const expires = Date.parse(record2.expires_at);
    const currentTime = now().getTime();
    if (!Number.isFinite(observed) || !Number.isFinite(expires) || observed > currentTime || expires <= currentTime) {
      throw new Error("boundary receipt is expired or not fresh");
    }
    return { ok: true, receipt_id: receipt.receipt_id, repository_snapshot_hash: receipt.repository_snapshot_hash };
  } catch (error) {
    return { ok: false, reason: String(error?.message ?? error) };
  }
}
function boundaryReceiptVerifier({ pluginRoot: pluginRoot2, workspaceRoot: workspaceRoot3, captureSnapshot, now, options = {} }) {
  return ({ receipt, rootPlanText }) => verifyManualBoundaryReceipt({
    receipt,
    rootPlanText,
    pluginRoot: pluginRoot2,
    workspaceRoot: workspaceRoot3,
    captureSnapshot,
    now,
    options
  });
}

// src/core/manual-subagent-policy.mjs
import { existsSync, readFileSync } from "node:fs";
var MANUAL_SUBAGENT_POLICY_SCHEMA = 1;
var MANUAL_SUBAGENT_MODES = Object.freeze(["parent-only", "parent-or-approved"]);
var MANUAL_SUBAGENT_HOSTS = Object.freeze(["cursor", "codex"]);
var MANUAL_SUBAGENT_PRESETS = Object.freeze({
  "cursor-composer-grok-v1": Object.freeze({
    host: "cursor",
    version: 1,
    parent_fallback: true,
    candidates: Object.freeze([
      Object.freeze({ model_id: "composer-2.5-fast" }),
      Object.freeze({ model_id: "cursor-grok-4.5-high-fast" })
    ])
  }),
  "codex-efficient-gpt-v1": Object.freeze({
    host: "codex",
    version: 1,
    parent_fallback: true,
    candidates: Object.freeze([
      Object.freeze({ model_id: "gpt-5.6-luna-max", reasoning_effort: "low" }),
      Object.freeze({ model_id: "gpt-5.6-terra-xhigh", reasoning_effort: "medium" })
    ])
  })
});
var objectLike = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
var cleanId = (value) => typeof value === "string" && value.trim() !== "" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 256) : null;
function parentOnlyResolution(source, path, issues = []) {
  return Object.freeze({
    schema: MANUAL_SUBAGENT_POLICY_SCHEMA,
    mode: "parent-only",
    source,
    path,
    authoritative: false,
    hosts: Object.freeze({
      cursor: Object.freeze({ host: "cursor", parent_fallback: true, candidates: Object.freeze([]), preset: null }),
      codex: Object.freeze({ host: "codex", parent_fallback: true, candidates: Object.freeze([]), preset: null })
    }),
    ...issues.length > 0 ? { issues: Object.freeze([...issues]) } : {}
  });
}
function validateCandidate(candidate, label, errors) {
  if (!objectLike(candidate)) {
    errors.push(`${label} must be an object`);
    return null;
  }
  for (const key of Object.keys(candidate)) {
    if (!["model_id", "reasoning_effort"].includes(key)) errors.push(`${label} has unknown field ${key}`);
  }
  const modelId = cleanId(candidate.model_id);
  if (!modelId) errors.push(`${label}.model_id is required`);
  let reasoning = null;
  if (candidate.reasoning_effort !== void 0) {
    reasoning = cleanId(candidate.reasoning_effort);
    if (!reasoning) errors.push(`${label}.reasoning_effort must be a non-empty string when set`);
  }
  return modelId ? Object.freeze({ model_id: modelId, ...reasoning ? { reasoning_effort: reasoning } : {} }) : null;
}
function resolveHostPolicy(raw, host, label, errors) {
  if (raw === void 0) {
    return Object.freeze({ host, parent_fallback: true, candidates: Object.freeze([]), preset: null });
  }
  if (!objectLike(raw)) {
    errors.push(`${label} must be an object`);
    return Object.freeze({ host, parent_fallback: true, candidates: Object.freeze([]), preset: null });
  }
  for (const key of Object.keys(raw)) {
    if (!["preset", "candidates", "parent_fallback"].includes(key)) errors.push(`${label} has unknown field ${key}`);
  }
  if (raw.preset !== void 0 && raw.candidates !== void 0) {
    errors.push(`${label} may set preset or candidates, not both`);
  }
  let preset = null;
  let candidates = [];
  if (raw.preset !== void 0) {
    preset = cleanId(raw.preset);
    if (!preset) errors.push(`${label}.preset must be a non-empty string`);
    else {
      const definition = MANUAL_SUBAGENT_PRESETS[preset];
      if (!definition) errors.push(`${label}.preset is unknown: ${preset}`);
      else if (definition.host !== host) errors.push(`${label}.preset ${preset} is not valid for ${host}`);
      else candidates = definition.candidates.map((entry) => Object.freeze({ ...entry }));
    }
  }
  if (Array.isArray(raw.candidates)) {
    if (raw.candidates.length === 0) errors.push(`${label}.candidates must not be empty`);
    candidates = raw.candidates.map((entry, index) => validateCandidate(entry, `${label}.candidates[${index}]`, errors)).filter(Boolean);
  } else if (raw.candidates !== void 0) {
    errors.push(`${label}.candidates must be an array`);
  }
  const parentFallback = raw.parent_fallback === void 0 ? true : raw.parent_fallback === true ? true : raw.parent_fallback === false ? false : (errors.push(`${label}.parent_fallback must be a boolean`), true);
  if (host === "cursor") {
    for (const [index, candidate] of candidates.entries()) {
      if (candidate.reasoning_effort) errors.push(`${label}.candidates[${index}] must not set reasoning_effort on Cursor`);
    }
  }
  return Object.freeze({
    host,
    parent_fallback: parentFallback,
    candidates: Object.freeze(candidates),
    preset
  });
}
function validateManualSubagentPolicy(value, label = "manual_subagent_policy") {
  const errors = [];
  if (!objectLike(value)) {
    errors.push(`${label} must be an object`);
    return errors;
  }
  for (const key of Object.keys(value)) {
    if (!["schema", "mode", "hosts"].includes(key)) errors.push(`${label} has unknown field ${key}`);
  }
  if (value.schema !== MANUAL_SUBAGENT_POLICY_SCHEMA) errors.push(`${label}.schema must be ${MANUAL_SUBAGENT_POLICY_SCHEMA}`);
  if (!MANUAL_SUBAGENT_MODES.includes(value.mode)) errors.push(`${label}.mode must be parent-only or parent-or-approved`);
  if (value.hosts !== void 0) {
    if (!objectLike(value.hosts)) errors.push(`${label}.hosts must be an object`);
    else {
      for (const key of Object.keys(value.hosts)) {
        if (!MANUAL_SUBAGENT_HOSTS.includes(key)) errors.push(`${label}.hosts has unknown host ${key}`);
      }
      for (const host of MANUAL_SUBAGENT_HOSTS) {
        resolveHostPolicy(value.hosts[host], host, `${label}.hosts.${host}`, errors);
      }
    }
  }
  return errors;
}
function resolveManualSubagentPolicy(options = {}) {
  const path = options.preferencesPath ?? defaultHostPreferencesPath(options);
  if (!existsSync(path)) return parentOnlyResolution("default", path);
  let parsed;
  try {
    parsed = parsePreferenceYaml(readFileSync(path, "utf8"));
  } catch (error) {
    return parentOnlyResolution("invalid-fallback", path, [`preferences file is unreadable: ${error.message}`]);
  }
  if (!objectLike(parsed)) return parentOnlyResolution("invalid-fallback", path, ["preferences must be an object"]);
  if (parsed.manual_subagent_policy === void 0) return parentOnlyResolution("default", path);
  const errors = validateManualSubagentPolicy(parsed.manual_subagent_policy);
  if (errors.length > 0) return parentOnlyResolution("invalid-fallback", path, errors);
  const policy = parsed.manual_subagent_policy;
  if (policy.mode === "parent-only") {
    return Object.freeze({
      ...parentOnlyResolution("file", path),
      mode: "parent-only"
    });
  }
  const hostErrors = [];
  const hosts = Object.freeze({
    cursor: resolveHostPolicy(policy.hosts?.cursor, "cursor", "manual_subagent_policy.hosts.cursor", hostErrors),
    codex: resolveHostPolicy(policy.hosts?.codex, "codex", "manual_subagent_policy.hosts.codex", hostErrors)
  });
  if (hostErrors.length > 0) return parentOnlyResolution("invalid-fallback", path, hostErrors);
  return Object.freeze({
    schema: MANUAL_SUBAGENT_POLICY_SCHEMA,
    mode: "parent-or-approved",
    source: "file",
    path,
    authoritative: false,
    hosts
  });
}

// hooks/model-inheritance-state.mjs
import {
  chmodSync,
  existsSync as existsSync2,
  mkdirSync,
  readFileSync as readFileSync2,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join as join2, resolve as resolve2 } from "node:path";
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
var modelRoot = (stateRoot) => join2(stateRoot, "model-inheritance");
var incidentDirectory = (stateRoot, incidentId) => join2(modelRoot(stateRoot), "incidents", incidentId);
var incidentPath = (stateRoot, incidentId) => join2(incidentDirectory(stateRoot, incidentId), "incident.json");
function readJson(path) {
  try {
    const value = JSON.parse(readFileSync2(path, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
function readIncident(stateRoot, incidentId) {
  const incident = readJson(incidentPath(stateRoot, incidentId));
  if (!incident) return null;
  const observationsDirectory = join2(incidentDirectory(stateRoot, incidentId), "observations");
  let childExecuted = false;
  let resultReturned = false;
  let lastObservedAt = incident.recorded_at;
  if (existsSync2(observationsDirectory)) {
    for (const name of readdirSync(observationsDirectory).sort()) {
      if (!name.endsWith(".json")) continue;
      const observation = readJson(join2(observationsDirectory, name));
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
    match_mode: value.match_mode ?? null,
    policy_mode: value.policy_mode ?? null,
    cursor_version: value.cursor_version,
    enforcement: value.enforcement,
    child_executed: value.child_executed,
    result_returned: value.result_returned,
    recorded_at: value.recorded_at,
    last_observed_at: value.last_observed_at
  };
}
function cleanSummary(overrides = {}) {
  return {
    authoritative: false,
    status: "clean",
    incident_count: 0,
    last_incident: null,
    enforcement: "no-incident",
    evidence_effect: "none",
    result_policy: "verified-results-remain-usable",
    qualification_policy: "exact-model-attestation-still-required",
    match_policy: "parent-or-configured-approved-candidates",
    ...overrides
  };
}
function modelInheritanceSummary(stateRoot) {
  const incidentsRoot = join2(modelRoot(stateRoot), "incidents");
  if (!existsSync2(incidentsRoot)) return cleanSummary();
  let incidentEntries;
  try {
    incidentEntries = readdirSync(incidentsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  } catch {
    return cleanSummary({
      status: "unattestable",
      enforcement: "diagnostic-state-unavailable"
    });
  }
  let unreadable = false;
  const incidents = incidentEntries.map((entry) => {
    const incident = readIncident(stateRoot, entry.name);
    unreadable ||= !incident;
    return incident;
  }).filter(Boolean).sort((left, right) => String(left.last_observed_at ?? "").localeCompare(String(right.last_observed_at ?? "")));
  const hasDeviation = incidents.some((entry) => entry.status === "deviated");
  const lastIncident = incidents.at(-1) ?? null;
  return cleanSummary({
    status: hasDeviation ? "deviated" : incidents.length > 0 || unreadable ? "unattestable" : "clean",
    incident_count: incidents.length,
    last_incident: publicIncident(lastIncident),
    enforcement: lastIncident?.enforcement ?? (unreadable ? "diagnostic-state-unavailable" : "no-incident")
  });
}

// src/mcp/artifact-handlers.mjs
import { createHash as createHash2 } from "node:crypto";

// src/mcp/workspace-roots.mjs
import { lstatSync, realpathSync, statSync as statSync2 } from "node:fs";
import { resolve as resolve3 } from "node:path";
import { fileURLToPath } from "node:url";
var HOST_WORKSPACE_ENV = "GELDMACHER_WORKFLOW_WORKSPACE_ROOT";
var WorkspaceRootError = class extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "WorkspaceRootError";
    this.code = code;
  }
};
function isWorkspaceRootsUnavailable(error) {
  return error instanceof WorkspaceRootError && [
    "roots-request-failed",
    "roots-empty",
    "host-workspace-unavailable"
  ].includes(error.code);
}
function validateDirectoryRoot(advertised, {
  unavailableCode = "root-unavailable",
  symlinkCode = "root-symlink",
  notDirectoryCode = "root-not-directory",
  label = "workspace root"
} = {}) {
  let stat;
  try {
    stat = lstatSync(advertised);
  } catch (error) {
    throw new WorkspaceRootError(unavailableCode, `${label} is unavailable: ${advertised}`, { cause: error });
  }
  if (stat.isSymbolicLink()) throw new WorkspaceRootError(symlinkCode, `${label} may not be symlink redirected: ${advertised}`);
  let canonical;
  try {
    canonical = realpathSync(advertised);
  } catch (error) {
    throw new WorkspaceRootError(unavailableCode, `${label} is unavailable: ${advertised}`, { cause: error });
  }
  let canonicalStat;
  try {
    canonicalStat = statSync2(canonical);
  } catch (error) {
    throw new WorkspaceRootError(unavailableCode, `${label} is unavailable: ${advertised}`, { cause: error });
  }
  if (!canonicalStat.isDirectory()) throw new WorkspaceRootError(notDirectoryCode, `${label} is not a directory: ${advertised}`);
  return { advertised, canonical };
}
function rootPath(root) {
  if (!root || typeof root.uri !== "string") throw new WorkspaceRootError("root-invalid", "MCP client returned an invalid workspace root");
  let url;
  try {
    url = new URL(root.uri);
  } catch (error) {
    throw new WorkspaceRootError("root-invalid", `MCP client returned an invalid workspace root URI: ${root.uri}`, { cause: error });
  }
  if (url.protocol !== "file:") throw new WorkspaceRootError("root-non-file", `Workflow supports only file workspace roots: ${root.uri}`);
  let advertised;
  try {
    advertised = resolve3(fileURLToPath(url));
  } catch (error) {
    throw new WorkspaceRootError("root-invalid", `MCP client returned an invalid file workspace root: ${root.uri}`, { cause: error });
  }
  return validateDirectoryRoot(advertised, { label: "MCP workspace root" });
}
function hostConfiguredRoot(env = process.env) {
  const raw = env?.[HOST_WORKSPACE_ENV];
  if (raw === void 0 || raw === null || String(raw).trim() === "") return null;
  const value = String(raw).trim();
  if (/\$\{[^}]+\}/.test(value)) return null;
  const advertised = resolve3(value);
  return {
    ...validateDirectoryRoot(advertised, {
      unavailableCode: "host-workspace-unavailable",
      symlinkCode: "host-workspace-symlink",
      notDirectoryCode: "host-workspace-not-directory",
      label: `host-configured ${HOST_WORKSPACE_ENV}`
    }),
    source: "host-configured"
  };
}
var WorkspaceRootAuthority = class {
  constructor(listRoots, options = {}) {
    if (typeof listRoots !== "function") throw new TypeError("WorkspaceRootAuthority requires listRoots");
    this.listRoots = listRoots;
    this.env = options.env ?? process.env;
    this.cached = null;
    this.unavailable = null;
  }
  invalidate() {
    this.cached = null;
    this.unavailable = null;
  }
  async roots() {
    if (this.unavailable) throw this.unavailable;
    if (!this.cached) {
      this.cached = Promise.resolve().then(async () => {
        let response;
        try {
          response = await this.listRoots();
        } catch (error) {
          const reason = String(error?.message ?? error ?? "unknown error").replace(/\s+/g, " ").slice(0, 300);
          throw new WorkspaceRootError("roots-request-failed", `trusted MCP workspace roots request failed: ${reason}`, { cause: error });
        }
        const entries = (response?.roots ?? []).map(rootPath);
        const unique2 = new Map(entries.map((entry) => [entry.canonical, entry]));
        if (unique2.size === 0) throw new WorkspaceRootError("roots-empty", "trusted MCP workspace roots list is empty");
        return [...unique2.values()].sort((left, right) => left.canonical.localeCompare(right.canonical));
      });
    }
    try {
      return await this.cached;
    } catch (error) {
      if (isWorkspaceRootsUnavailable(error)) this.unavailable = error;
      this.cached = null;
      throw error;
    }
  }
  async resolve(selector = void 0) {
    const host = hostConfiguredRoot(this.env);
    let roots = null;
    let rootsError = null;
    try {
      roots = await this.roots();
    } catch (error) {
      if (!isWorkspaceRootsUnavailable(error)) throw error;
      rootsError = error;
    }
    if (host) {
      if (roots) {
        const allowed2 = roots.find((entry) => entry.advertised === host.advertised || entry.canonical === host.canonical);
        if (!allowed2) throw new WorkspaceRootError("root-foreign", `host-configured workspace_root is not an advertised MCP root: ${host.advertised}`);
        if (host.canonical !== allowed2.canonical) {
          throw new WorkspaceRootError("root-drift", `host-configured workspace_root changed after MCP root discovery: ${host.advertised}`);
        }
      }
      if (selector !== void 0 && selector !== null && selector !== "") {
        const requested = resolve3(selector);
        if (requested !== host.advertised && requested !== host.canonical) {
          throw new WorkspaceRootError("root-foreign", `workspace_root does not match host-configured workspace: ${requested}`);
        }
      }
      return host.canonical;
    }
    if (rootsError) throw rootsError;
    if (selector === void 0 || selector === null || selector === "") {
      if (roots.length !== 1) throw new WorkspaceRootError("roots-multiple", "multiple MCP workspace roots require workspace_root");
      return roots[0].canonical;
    }
    const advertised = resolve3(selector);
    const allowed = roots.find((entry) => entry.advertised === advertised);
    if (!allowed) throw new WorkspaceRootError("root-foreign", `workspace_root is not an advertised MCP root: ${advertised}`);
    let canonical;
    try {
      canonical = realpathSync(advertised);
    } catch (error) {
      throw new WorkspaceRootError("root-unavailable", `workspace_root is unavailable: ${advertised}`, { cause: error });
    }
    if (canonical !== allowed.canonical) throw new WorkspaceRootError("root-drift", `workspace_root changed after MCP root discovery: ${advertised}`);
    return canonical;
  }
};

// src/mcp/artifact-handlers.mjs
var bundleSize = (artifacts = []) => artifacts.reduce((total, artifact3) => total + artifact3.text.length, 0);
function createArtifactHandlers({
  pluginRoot: pluginRoot2,
  resolveOperationalContext,
  result: result2,
  handoffStoreFactory = createContentAddressedHandoffStore,
  receiptOptions = {}
}) {
  const toolResult = (toolName, value, isError = false) => {
    if (typeof result2 === "function" && result2.toolAware === true) return result2(toolName, value, isError);
    return result2(value, isError);
  };
  const failure2 = (toolName) => (error) => toolResult(toolName, {
    error: error.message,
    ...error?.code ? { error_code: error.code } : {}
  }, true);
  const codedError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
  };
  const mergeArtifacts = (entries) => {
    const merged = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      const prior = merged.get(entry.label);
      if (prior && prior.text !== entry.text) throw new Error(`closeout artifact label ${entry.label} has conflicting text`);
      merged.set(entry.label, {
        label: entry.label,
        text: entry.text,
        ...entry.builder_provenance ? { builder_provenance: entry.builder_provenance } : prior?.builder_provenance ? { builder_provenance: prior.builder_provenance } : {},
        ...entry.legacy_review_recorded === true || prior?.legacy_review_recorded === true ? { legacy_review_recorded: true } : {}
      });
    }
    return merged;
  };
  const inferredRootPlanId = (rootPlanId, artifacts = []) => {
    if (rootPlanId) return rootPlanId;
    for (const entry of artifacts) {
      if (!entry?.text) continue;
      const inspected = inspectArtifactText(entry.text, pluginRoot2);
      if (inspected.errors.length > 0) continue;
      if (inspected.artifact?.fields?.artifact === "work-plan") return inspected.artifact.fields.id;
      if (inspected.artifact?.fields?.artifact === "work-review") return inspected.artifact.fields.root_plan_id;
      if (inspected.artifact?.fields?.artifact === "delivery-evidence") return inspected.artifact.fields.root_plan_id;
    }
    return null;
  };
  const containsRootEvidence = (artifacts = [], rootPlanId = null) => artifacts.some((entry) => {
    if (typeof entry?.text !== "string") return false;
    const inspected = inspectArtifactText(entry.text, pluginRoot2);
    const fields = inspected.artifact?.fields;
    return inspected.errors.length === 0 && fields?.artifact === "delivery-evidence" && (!rootPlanId || fields.root_plan_id === rootPlanId);
  });
  const assertConsistentArtifactTexts = (artifacts = [], { rootPlan = null } = {}) => {
    const byId = /* @__PURE__ */ new Map();
    const consider = (text, label = "artifact") => {
      if (typeof text !== "string" || !text.trim()) return;
      const inspected = inspectArtifactText(text, pluginRoot2);
      if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) return;
      const id = inspected.artifact.fields.id;
      const prior = byId.get(id);
      if (prior && prior !== text) {
        throw new Error(`handoff artifact ${id} has conflicting text`);
      }
      byId.set(id, text);
      return id;
    };
    if (rootPlan) consider(rootPlan, "root");
    for (const entry of artifacts) {
      consider(entry?.text, entry?.label ?? "artifact");
    }
    return byId;
  };
  const contentHandoff = ({ rootPlanId = null, rootPlan = null, artifacts = [], remember = false } = {}) => {
    assertConsistentArtifactTexts(artifacts, { rootPlan });
    const resolvedId = inferredRootPlanId(rootPlanId, artifacts);
    const rootPlanText = resolveRootPlanText(pluginRoot2, { rootPlanId: resolvedId, rootPlan, artifacts });
    const root_content_hash = rootContentHash(rootPlanText);
    const handoffStore = handoffStoreFactory(rootPlanText, pluginRoot2);
    if (remember) rememberContentAddressedRoot(rootPlanText, pluginRoot2);
    return { rootPlanText, root_content_hash, handoffStore, rootPlanId: resolvedId };
  };
  const hydrateLineageArtifacts = (rootPlanText, handoffStore, workspace = null) => {
    const seeded = [];
    let current = rootPlanText;
    const seen = /* @__PURE__ */ new Set();
    while (current) {
      const inspected = inspectArtifactText(current, pluginRoot2);
      const id = inspected.artifact?.fields?.id;
      if (!id || seen.has(id)) break;
      seen.add(id);
      seeded.push({ label: id, text: current });
      try {
        const chain = handoffStore.context(id, current);
        for (const entry of chain.artifacts) seeded.push({ label: entry.label, text: entry.text });
      } catch {
      }
      const predecessorId = inspected.artifact?.fields?.predecessor_plan_id;
      if (!predecessorId) break;
      try {
        current = resolveRootPlanText(pluginRoot2, { rootPlanId: predecessorId });
      } catch {
        break;
      }
      const predecessorStore = handoffStoreFactory(current, pluginRoot2);
      bindBoundaryTrust(predecessorStore, workspace);
      try {
        const chain = predecessorStore.context(predecessorId, current);
        for (const entry of chain.artifacts) seeded.push({ label: entry.label, text: entry.text });
      } catch {
        seeded.push({ label: predecessorId, text: current });
      }
    }
    return seeded;
  };
  const optionalOperational = async (workspaceRoot3) => {
    try {
      return { ...await resolveOperationalContext(workspaceRoot3), workspace_binding: "trusted-root" };
    } catch (error) {
      if (!isWorkspaceRootsUnavailable(error)) throw error;
      return {
        workspace: null,
        stateRoot: null,
        workspace_binding: "not-established",
        workspace_error: error
      };
    }
  };
  const bindBoundaryTrust = (handoffStore, workspace) => {
    handoffStore.artifactSetOptions = workspace ? { boundaryReceiptVerifier: boundaryReceiptVerifier({ pluginRoot: pluginRoot2, workspaceRoot: workspace, options: receiptOptions }) } : {};
  };
  const buildCloseout = (input, merged, workspace = null) => {
    const rootPlan = input.root_plan ?? [...merged.values()].find((entry) => {
      const inspected = inspectArtifactText(entry.text, pluginRoot2);
      return inspected.artifact?.fields?.artifact === "work-plan" && inspected.artifact.fields.id === input.root_plan_id;
    })?.text;
    if (!rootPlan) throw new Error("workflow_closeout requires the active Root text or a cached Root");
    if ((input.artifact_kind ?? "delivery-evidence") === "work-review") {
      if (!input.review_input) {
        throw codedError("review-input-invalid", "workflow_closeout work-review mode requires review_input schema 1; Root, Evidence, and repository work remain unchanged, so correct the named review_input field and repeat Review in this task");
      }
      const reviewResult = buildWorkReview({
        rootPlanText: rootPlan,
        artifacts: [...merged.values()],
        reviewInput: input.review_input,
        pluginRoot: pluginRoot2
      });
      if (reviewResult.fields.root_plan_id !== input.root_plan_id) throw new Error(`workflow_closeout Root ID mismatch: expected ${input.root_plan_id}, received ${reviewResult.fields.root_plan_id}`);
      return { rootPlan, closeoutResult: reviewResult, artifactKind: "work-review" };
    }
    if (input.review_input) throw new Error("workflow_closeout review_input is allowed only when artifact_kind is work-review");
    const manualCheckReceipts = workspace ? loadManualCheckReceipts({ rootPlanText: rootPlan, pluginRoot: pluginRoot2, workspaceRoot: workspace, options: receiptOptions }) : [];
    const closeoutResult = buildDeliveryEvidence({
      rootPlanText: rootPlan,
      artifacts: [...merged.values()],
      checkEvidence: input.check_evidence,
      changedPaths: input.changed_paths,
      strategyRevision: input.strategy_revision,
      effectiveProfile: input.effective_profile,
      repositorySnapshot: input.repository_snapshot ?? null,
      summary: input.summary ?? null,
      manualCheckReceipts,
      enforceManualCheckReceipts: input.effective_profile === "manual",
      pluginRoot: pluginRoot2
    });
    if (closeoutResult.fields.root_plan_id !== input.root_plan_id) throw new Error(`workflow_closeout Root ID mismatch: expected ${input.root_plan_id}, received ${closeoutResult.fields.root_plan_id}`);
    if (!closeoutResult.artifact) throw new Error("closeout resolved an evidence tip without its exact artifact text");
    return { rootPlan, closeoutResult, artifactKind: "delivery-evidence" };
  };
  const closeoutPayload = ({
    input,
    workspace,
    workspaceBinding,
    closeoutResult,
    persisted,
    warning,
    handoffErrorCode,
    rootContentHashValue,
    handoffMode
  }) => ({
    ...workspace ? { workspace_root: workspace } : {},
    workspace_binding: workspaceBinding ?? (workspace ? "trusted-root" : "not-established"),
    workspace_root_used: Boolean(workspace),
    root_plan_id: input.root_plan_id,
    delivery_evidence_id: closeoutResult.fields.id,
    artifact: persisted.artifact,
    artifact_hash: persisted.artifact_hash ?? createHash2("sha256").update(persisted.artifact).digest("hex"),
    evidence_mode: persisted.fields.evidence_mode,
    overall_grade: persisted.fields.overall_grade,
    status: persisted.fields.status,
    subject_id: persisted.fields.subject_id ?? input.root_plan_id,
    source_review_id: persisted.fields.source_review_id ?? null,
    predecessor_evidence_id: persisted.fields.predecessor_evidence_id ?? null,
    changed_paths: persisted.fields.changed_paths ?? input.changed_paths ?? [],
    check_evidence: persisted.fields.check_evidence ?? [],
    duplicate: persisted.duplicate,
    handoff_persisted: persisted.handoff_persisted,
    handoff_authoritative: false,
    handoff_mode: handoffMode ?? (persisted.handoff_persisted ? "root-content-cache" : "stateless"),
    ...rootContentHashValue ? { root_content_hash: rootContentHashValue } : {},
    ...closeoutResult.constraint_summary ? { constraint_summary: closeoutResult.constraint_summary } : {},
    ...closeoutResult.human_attention ? { human_attention: closeoutResult.human_attention } : {},
    ...closeoutResult.problem_details ? { problem_details: closeoutResult.problem_details } : {},
    ...persisted.artifact_set_hash ? { artifact_set_hash: persisted.artifact_set_hash } : {},
    ...warning ? { warning } : {},
    ...handoffErrorCode || persisted.handoff_error_code ? { handoff_error_code: handoffErrorCode ?? persisted.handoff_error_code } : {}
  });
  const reviewPayload = ({
    input,
    workspace,
    workspaceBinding,
    reviewResult,
    persisted,
    warning,
    handoffErrorCode,
    rootContentHashValue,
    handoffMode
  }) => ({
    ...workspace ? { workspace_root: workspace } : {},
    workspace_binding: workspaceBinding ?? (workspace ? "trusted-root" : "not-established"),
    workspace_root_used: Boolean(workspace),
    artifact_kind: "work-review",
    root_plan_id: input.root_plan_id,
    work_review_id: reviewResult.fields.id,
    artifact: persisted.artifact,
    artifact_hash: persisted.artifact_hash ?? createHash2("sha256").update(persisted.artifact).digest("hex"),
    review_input_hash: persisted.review_input_hash,
    authoritative_fields: persisted.fields,
    assessment: persisted.fields.assessment,
    delivery_status: persisted.fields.delivery_status,
    next_action: persisted.fields.next_action,
    review_route: persisted.fields.review_route,
    latest_evidence_id: persisted.fields.latest_evidence_id ?? null,
    predecessor_review_id: persisted.fields.predecessor_review_id ?? null,
    correction_id: persisted.fields.correction_id ?? null,
    duplicate: persisted.duplicate,
    task_local_valid: true,
    handoff_persisted: persisted.handoff_persisted,
    handoff_authoritative: false,
    handoff_mode: handoffMode ?? (persisted.handoff_persisted ? "root-content-cache" : "stateless"),
    ...rootContentHashValue ? { root_content_hash: rootContentHashValue } : {},
    ...persisted.artifact_set_hash ? { artifact_set_hash: persisted.artifact_set_hash } : {},
    ...warning ? { warning } : {},
    ...handoffErrorCode || persisted.handoff_error_code ? { handoff_error_code: handoffErrorCode ?? persisted.handoff_error_code } : {}
  });
  const record2 = async (input) => {
    try {
      if (bundleSize(input.artifacts) > 1e6) throw new Error("handoff artifact bundle exceeds 1000000 characters");
      for (const entry of input.artifacts) {
        const inspected = inspectArtifactText(entry.text, pluginRoot2);
        if (inspected.errors.length > 0 || inspected.artifact?.fields?.schema !== 5 || inspected.artifact?.fields?.artifact !== "work-plan") {
          if (inspected.artifact?.fields?.artifact === "work-review") {
            throw codedError("review-artifact-rejected", "new full model-authored work-review artifacts cannot establish authority; pass review_input schema 1 to workflow_closeout with artifact_kind work-review and repeat Review in this task");
          }
          throw new Error("workflow_artifact_record accepts only valid Schema-5 work-plan artifacts");
        }
      }
      let rootPlanText;
      let root_content_hash;
      let handoffStore;
      try {
        ({ rootPlanText, root_content_hash, handoffStore } = contentHandoff({
          rootPlan: input.root_plan,
          artifacts: input.artifacts,
          remember: true
        }));
      } catch (error) {
        if (/conflict|invalid|corrupt|incompatible|stale|ambiguous|multiple|exact Root/i.test(error.message)) throw error;
        return toolResult("workflow_artifact_record", {
          workspace_binding: "not-established",
          workspace_root_used: false,
          handoff_authoritative: false,
          handoff_persisted: false,
          handoff_mode: "stateless",
          handoff_error_code: "handoff-persist-failed",
          recorded: [],
          duplicates: [],
          warning: `handoff cache unavailable: ${error.message}; attach the exact artifact explicitly to the next Workflow command`
        });
      }
      const operational = await optionalOperational(input.workspace_root);
      bindBoundaryTrust(handoffStore, operational.workspace);
      const lineage = hydrateLineageArtifacts(rootPlanText, handoffStore, operational.workspace);
      const byId = /* @__PURE__ */ new Map();
      for (const entry of [...lineage, ...input.artifacts]) {
        const inspected = inspectArtifactText(entry.text, pluginRoot2);
        if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) {
          const priorLabel = byId.get(entry.label);
          if (priorLabel && priorLabel.text !== entry.text) {
            throw new Error(`handoff artifact label ${entry.label} has conflicting text`);
          }
          byId.set(entry.label, entry);
          continue;
        }
        const id = inspected.artifact.fields.id;
        const prior = byId.get(id);
        if (prior && prior.text !== entry.text) {
          throw new Error(`handoff artifact ${id} has conflicting text`);
        }
        byId.set(id, { label: id, text: entry.text });
      }
      try {
        const recorded = handoffStore.record([...byId.values()]);
        return toolResult("workflow_artifact_record", {
          ...operational.workspace ? { workspace_root: operational.workspace } : {},
          workspace_binding: operational.workspace_binding,
          workspace_root_used: Boolean(operational.workspace),
          handoff_authoritative: false,
          handoff_persisted: true,
          handoff_mode: "root-content-cache",
          root_content_hash,
          ...recorded,
          ...operational.workspace_error && input.workspace_root ? { warning: `workspace binding unavailable (${operational.workspace_error.code}); recorded under root-content handoff namespace` } : {}
        });
      } catch (error) {
        if (/concurrent|conflict|invalid|corrupt|incompatible|stale|ambiguous|multiple/i.test(error.message)) throw error;
        return toolResult("workflow_artifact_record", {
          ...operational.workspace ? { workspace_root: operational.workspace } : {},
          workspace_binding: operational.workspace_binding,
          workspace_root_used: Boolean(operational.workspace),
          handoff_authoritative: false,
          handoff_persisted: false,
          handoff_mode: "stateless",
          handoff_error_code: "handoff-persist-failed",
          root_content_hash,
          recorded: [],
          duplicates: [],
          warning: `handoff cache unavailable: ${error.message}; attach the exact artifact explicitly to the next Workflow command`
        });
      }
    } catch (error) {
      return failure2("workflow_artifact_record")(error);
    }
  };
  const context2 = async (input) => {
    try {
      const { root_content_hash, handoffStore } = contentHandoff({
        rootPlanId: input.root_plan_id,
        rootPlan: input.root_plan,
        artifacts: input.artifacts
      });
      const operational = await optionalOperational(input.workspace_root);
      bindBoundaryTrust(handoffStore, operational.workspace);
      const chain = handoffStore.context(input.root_plan_id, input.root_plan ?? null);
      return toolResult("workflow_artifact_context", {
        ...operational.workspace ? { workspace_root: operational.workspace } : {},
        workspace_binding: operational.workspace_binding,
        workspace_root_used: Boolean(operational.workspace),
        handoff_authoritative: false,
        handoff_mode: "root-content-cache",
        root_content_hash,
        ...chain,
        model_inheritance: operational.stateRoot ? modelInheritanceSummary(operational.stateRoot) : { authoritative: false, status: "unavailable", evidence_effect: "none", reason: "workspace-binding-not-established" }
      });
    } catch (error) {
      return failure2("workflow_artifact_context")(error);
    }
  };
  const closeout = async (input) => {
    try {
      if (bundleSize(input.artifacts) > 1e6) throw new Error("closeout artifact bundle exceeds 1000000 characters");
      const operational = await optionalOperational(input.workspace_root);
      let handoff;
      try {
        handoff = contentHandoff({
          rootPlanId: input.root_plan_id,
          rootPlan: input.root_plan,
          artifacts: input.artifacts,
          remember: true
        });
      } catch (error) {
        if (operational.legacyHandoffStore && !input.root_plan) {
          try {
            const legacy = operational.legacyHandoffStore.context(input.root_plan_id, null);
            const rootPlan2 = legacy.artifacts.find((entry) => entry.label === input.root_plan_id)?.text;
            if (rootPlan2) {
              handoff = contentHandoff({
                rootPlanId: input.root_plan_id,
                rootPlan: rootPlan2,
                artifacts: [...legacy.artifacts, ...input.artifacts ?? []],
                remember: true
              });
            }
          } catch {
          }
        }
        if (!handoff) {
          if (!input.root_plan) throw error;
          const merged2 = mergeArtifacts(input.artifacts ?? []);
          const { closeoutResult: closeoutResult2, artifactKind: artifactKind2 } = buildCloseout(input, merged2, operational.workspace);
          const payload2 = artifactKind2 === "work-review" ? reviewPayload : closeoutPayload;
          return toolResult("workflow_closeout", payload2({
            input,
            workspace: operational.workspace,
            workspaceBinding: operational.workspace_binding,
            ...artifactKind2 === "work-review" ? { reviewResult: closeoutResult2 } : { closeoutResult: closeoutResult2 },
            persisted: { ...closeoutResult2, handoff_persisted: false },
            warning: `optional cross-task handoff unavailable: ${error.message}; task-local ${artifactKind2 === "work-review" ? "Review" : "continuation"} remains valid`,
            handoffErrorCode: "handoff-persist-failed",
            handoffMode: "stateless"
          }));
        }
      }
      const { rootPlanText, root_content_hash, handoffStore } = handoff;
      let cached = [];
      const taskLocalReviewChain = (input.artifact_kind ?? "delivery-evidence") === "work-review" && containsRootEvidence(input.artifacts ?? [], input.root_plan_id);
      if (!taskLocalReviewChain) {
        try {
          cached = handoffStore.context(input.root_plan_id, rootPlanText).artifacts.map(({ label, text, builder_provenance, legacy_review_recorded }) => ({ label, text, ...builder_provenance ? { builder_provenance } : {}, ...legacy_review_recorded === true ? { legacy_review_recorded: true } : {} }));
        } catch {
        }
      }
      const merged = mergeArtifacts([...cached, ...input.artifacts ?? [], { label: "root", text: rootPlanText }]);
      let { rootPlan, closeoutResult, artifactKind } = buildCloseout({ ...input, root_plan: rootPlanText }, merged, operational.workspace);
      if (artifactKind === "work-review" && taskLocalReviewChain && !closeoutResult.duplicate) {
        try {
          const cachedReview = handoffStore.context(input.root_plan_id, rootPlanText).artifacts.find((entry) => entry.label === closeoutResult.fields.id);
          if (cachedReview?.text === closeoutResult.artifact && cachedReview.builder_provenance?.kind === "host-work-review-builder" && cachedReview.builder_provenance.review_input_hash === closeoutResult.review_input_hash && cachedReview.builder_provenance.artifact_hash === closeoutResult.artifact_hash) {
            closeoutResult = { ...closeoutResult, duplicate: true };
          }
        } catch {
        }
      }
      const persisted = artifactKind === "work-review" ? persistWorkReview({
        handoffStore,
        rootPlanText: rootPlan,
        artifacts: [...merged.values()],
        review: closeoutResult
      }) : persistCloseout({
        handoffStore,
        rootPlanText: rootPlan,
        artifacts: [...merged.values()],
        closeout: closeoutResult
      });
      if (persisted.handoff_persisted) rememberContentAddressedRoot(rootPlan, pluginRoot2);
      if (artifactKind === "delivery-evidence" && persisted.handoff_persisted && operational.workspace) {
        invalidateManualCheckReceipts({ rootPlanText: rootPlan, workspaceRoot: operational.workspace, options: receiptOptions });
      }
      const selectorNotice = !operational.workspace && input.workspace_root ? `; the supplied workspace_root was not used (${operational.workspace_error?.code ?? "workspace-binding-not-established"})` : "";
      const warning = persisted.warning ?? (selectorNotice ? `workspace binding unavailable${selectorNotice}` : void 0);
      const payload = artifactKind === "work-review" ? reviewPayload : closeoutPayload;
      return toolResult("workflow_closeout", payload({
        input,
        workspace: operational.workspace,
        workspaceBinding: operational.workspace_binding,
        ...artifactKind === "work-review" ? { reviewResult: closeoutResult } : { closeoutResult },
        persisted,
        warning,
        rootContentHashValue: root_content_hash ?? rootContentHash(rootPlan),
        handoffMode: persisted.handoff_persisted ? "root-content-cache" : "stateless",
        handoffErrorCode: persisted.handoff_error_code
      }));
    } catch (error) {
      return failure2("workflow_closeout")(error);
    }
  };
  return Object.freeze({ record: record2, context: context2, closeout });
}

// src/core/manual-journey.mjs
var MANUAL_JOURNEY_STATE_LABELS = Object.freeze({
  "plan-ready": "Plan ready",
  "implementation-active": "Implementation active",
  "closeout-recovery-required": "Closeout recovery required",
  "review-ready": "Review required",
  "review-active": "Review active",
  "correction-approval-required": "Correction approval required",
  "replan-approval-required": "Replan approval required",
  "provisional-acceptance-required": "Provisional acceptance required",
  "clarification-required": "Clarification required",
  blocked: "Blocked",
  done: "Done"
});
var MANUAL_PRIMARY_ACTIONS = Object.freeze({
  "repair-root": Object.freeze({ label: "Repair the Root", command: "plan-work" }),
  "implement-plan": Object.freeze({ label: "Implement the Plan", command: "Implement Plan" }),
  "attach-artifact": Object.freeze({ label: "Export the exact artifact", command: "attach-artifact" }),
  "review-root": Object.freeze({ label: "Review delivery", command: "review-work" }),
  "accept-provisional": Object.freeze({ label: "Accept provisional delivery", command: "accept-work" }),
  closeout: Object.freeze({ label: "Deterministic closeout", command: "close-work" }),
  correct: Object.freeze({ label: "Fix failing Checks", command: "correct-work" }),
  "approve-correction": Object.freeze({ label: "Apply bounded correction", command: "correct-work" }),
  "provide-artifacts": Object.freeze({ label: "Supply artifact chain", command: "work-status" }),
  replan: Object.freeze({ label: "Replan the Root", command: "plan-work replan" }),
  "retry-review": Object.freeze({ label: "Retry review", command: "review-work" }),
  answer: Object.freeze({ label: "Answer clarification", command: "answer clarification" }),
  "resolve-intent": Object.freeze({ label: "Resolve intent", command: "plan-work" }),
  none: Object.freeze({ label: "Done", command: "none" }),
  learn: Object.freeze({ label: "Persist learnings", command: "learn-from-work" }),
  explain: Object.freeze({ label: "Explain the chain", command: "explain-work" })
});
var SAFE_BLOCKED_ACTIONS = /* @__PURE__ */ new Set([
  "repair-root",
  "attach-artifact",
  "review-root",
  "closeout",
  "provide-artifacts",
  "replan",
  "retry-review",
  "answer",
  "resolve-intent"
]);
function normalizeManualPrimaryAction(presentation, action) {
  if (!["blocked", "failed"].includes(presentation?.outcome)) return action;
  if (SAFE_BLOCKED_ACTIONS.has(action)) return action;
  if (action === "implement-plan") return "repair-root";
  if (["accept-provisional", "approve-correction", "correct"].includes(action)) return "retry-review";
  return "provide-artifacts";
}
function deriveManualJourneyState(presentation, action) {
  const state = presentation?.workflow_state;
  if (["achieved", "accepted-provisional"].includes(state) || action === "none") return "done";
  if (action === "implement-plan") return "plan-ready";
  if (action === "approve-correction") return "correction-approval-required";
  if (action === "replan") return "replan-approval-required";
  if (action === "accept-provisional") return "provisional-acceptance-required";
  if (["blocked", "failed"].includes(presentation?.outcome)) return "blocked";
  if (["review-root", "retry-review"].includes(action)) return "review-ready";
  if (["answer", "resolve-intent", "provide-artifacts"].includes(action)) return "clarification-required";
  if (["closeout", "attach-artifact"].includes(action)) return "closeout-recovery-required";
  return presentation?.phase === "review" ? "review-active" : "implementation-active";
}
function taskBoundManualInvoke(action, trace = {}) {
  const catalog = MANUAL_PRIMARY_ACTIONS[action] ?? { command: String(action), label: String(action) };
  const root = trace.root_plan_id ?? null;
  const evidence = trace.evidence_id ?? null;
  const review = trace.review_id ?? null;
  if (action === "none") return "No further Workflow action required";
  if (action === "implement-plan") return catalog.command;
  if (action === "accept-provisional") return [catalog.command, root, "provisional"].filter(Boolean).join(" ");
  if (action === "attach-artifact") return [catalog.command, evidence ?? root].filter(Boolean).join(" ");
  if (action === "answer") return [catalog.command, review ?? root].filter(Boolean).join(" ");
  return [catalog.command, root].filter(Boolean).join(" ");
}

// src/mcp/manual-presentation.mjs
var MANUAL_TOOLS = /* @__PURE__ */ new Set([
  "workflow_plan_preflight",
  "workflow_artifact_record",
  "workflow_artifact_context",
  "workflow_closeout",
  "workflow_status"
]);
var MAX_DISPLAY_CHANGED_PATHS = 10;
var TERMINAL_READY_STATES = /* @__PURE__ */ new Set(["achieved", "accepted-provisional"]);
var TERMINAL_BLOCKED_STATES = /* @__PURE__ */ new Set(["blocked", "stopped", "failed"]);
var MANUAL_GUIDE_URL = "https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md";
var MANUAL_GUIDE_LABEL = "Manual Workflow guide";
var JOURNEY_STATE_LABELS = MANUAL_JOURNEY_STATE_LABELS;
var RECENT_PRESENTATION_UPDATES = /* @__PURE__ */ new Map();
var MAX_RECENT_PRESENTATION_UPDATES = 256;
function helpEntry(topic, anchor, meaning) {
  return Object.freeze({
    topic,
    meaning,
    label: MANUAL_GUIDE_LABEL,
    url: `${MANUAL_GUIDE_URL}#${anchor}`
  });
}
var MANUAL_HELP_TOPICS = Object.freeze({
  "manual-states": helpEntry(
    "manual-states",
    "manual-states",
    "Workflow derived this read-only Manual state from the current artifact chain; its blockers and next action remain authoritative."
  ),
  "intent-root-and-plan": helpEntry(
    "intent-root-and-plan",
    "intent-root-and-plan",
    "The Intent Root must define a feasible goal, acceptance, authority, risk, and required Checks before implementation can be approved."
  ),
  "artifacts-tips-and-handoff": helpEntry(
    "artifacts-tips-and-handoff",
    "artifacts-tips-and-handoff",
    "Handoff only transports exact artifact bytes; missing cache context requires explicit artifacts and grants no authority."
  ),
  "recovery-and-troubleshooting": helpEntry(
    "recovery-and-troubleshooting",
    "recovery-and-troubleshooting",
    "The requested Workflow operation did not produce an actionable result; repair the reported input, chain, or environment issue before continuing."
  )
});
var MANUAL_STATE_HELP = Object.freeze({
  "intent-clarification": helpEntry(
    "manual-state-intent-clarification",
    "intent-clarification",
    "The Root is not intent-ready because a material goal, acceptance, authority, or risk decision still needs a human answer."
  ),
  "root-plan-review": helpEntry(
    "manual-state-root-plan-review",
    "root-plan-review",
    "A ready Intent Root exists and waits for human Implement Plan approval before Delivery Evidence can be created."
  ),
  "root-review": helpEntry(
    "manual-state-root-review",
    "root-review",
    "Delivery Evidence exists and now needs a fresh read-only review against the approved Root."
  ),
  "waiting-human": helpEntry(
    "manual-state-waiting-human",
    "waiting-human",
    "Workflow needs the human to resolve the listed clarification, correction approval, or missing exact context."
  ),
  replan: helpEntry(
    "manual-state-replan",
    "replan",
    "The current Root or chain cannot safely authorize the required work and must be replaced through a newly approved plan."
  ),
  "delivery-ready-provisional": helpEntry(
    "manual-state-delivery-ready-provisional",
    "delivery-ready-provisional",
    "No known failed required Check blocks delivery, but proof remains incomplete or unavailable and needs an explicit human decision."
  ),
  "accepted-provisional": helpEntry(
    "manual-state-accepted-provisional",
    "accepted-provisional",
    "The human accepted this evidence gap once; the delivery is still not verified and the acceptance is not persisted."
  ),
  achieved: helpEntry(
    "manual-state-achieved",
    "achieved",
    "A fresh review verified the required Checks for this repository-only Root, so no further Workflow action is required."
  ),
  blocked: helpEntry(
    "manual-state-blocked",
    "blocked",
    "A known failure or safety boundary prevents delivery and cannot be overridden by provisional acceptance."
  ),
  failed: helpEntry(
    "manual-state-failed",
    "failed",
    "Workflow could not produce a valid result; repair the reported failure before retrying."
  ),
  stopped: helpEntry(
    "manual-state-stopped",
    "stopped",
    "This subject is intentionally non-actionable, commonly because it is read-only Workflow-3 or Workflow-4 history."
  )
});
var MANUAL_EVIDENCE_HELP = Object.freeze({
  verified: helpEntry(
    "manual-evidence-verified",
    "verified",
    "The required Check was directly observed with the method and repetition needed for verified Evidence."
  ),
  supported: helpEntry(
    "manual-evidence-supported",
    "supported",
    "Meaningful inspection supports the claim, but the proof is not strong enough for verified delivery."
  ),
  partial: helpEntry(
    "manual-evidence-partial",
    "partial",
    "Some relevant proof exists, but it does not fully cover the required Check or expected result."
  ),
  unavailable: helpEntry(
    "manual-evidence-unavailable",
    "unavailable",
    "The required proof surface could not be used; the named limitation is missing proof, not success or failure."
  ),
  failed: helpEntry(
    "manual-evidence-failed",
    "failed-evidence",
    "The observed result contradicted a required Check, so delivery is blocked and cannot be accepted provisionally."
  )
});
function manualStateHelp(state) {
  return MANUAL_STATE_HELP[state] ?? MANUAL_HELP_TOPICS["manual-states"];
}
function manualEvidenceHelp(grade) {
  return MANUAL_EVIDENCE_HELP[grade] ?? helpEntry(
    "manual-evidence-grades",
    "evidence-grades",
    "Evidence grades describe how directly each required Check was observed and never become stronger through review wording alone."
  );
}
function isManualStatusSnapshot(snapshot) {
  if (snapshot.snapshot_source) return snapshot.snapshot_source === "artifact-chain";
  if (snapshot.run_id) return false;
  const requested = snapshot.requested_profile ?? "manual";
  const effective = snapshot.effective_profile ?? requested;
  return requested === "manual" && effective === "manual";
}
var NEXT_STEP_CATALOG = {
  "repair-root": {
    label: "Repair the Root",
    invoke: "Plan: fix blockers, then /plan-work or $plan-work again",
    benefit: "Makes the Root feasible before approval.",
    blocked_when: "Root is infeasible or incomplete.",
    recovery: "Resolve blocking issues, then re-validate the exact Root."
  },
  "implement-plan": {
    label: "Implement the Plan",
    invoke: "Human: native Implement Plan (approves the presented Root)",
    benefit: "Delivers inside the approved Root and runs deterministic closeout.",
    blocked_when: "No approved Root is ready for implementation.",
    recovery: "Finish Plan presentation and human approval first."
  },
  "attach-artifact": {
    label: "Export the exact artifact",
    invoke: "Agent: attach exact Root/Evidence text only when intentionally continuing in another task or host",
    benefit: "Exports the chain when optional cross-task transport is unavailable.",
    blocked_when: "A deliberate cross-task continuation cannot load the exact artifact.",
    recovery: "Stay in the current task, or paste the exact artifact bytes into the chosen new task."
  },
  "review-root": {
    label: "Review delivery",
    invoke: "Current task, read-only phase: run /review-work or $review-work against the exact task-local chain",
    benefit: "Produces a fresh read-only verdict without requiring a new task or chat.",
    blocked_when: "The current task cannot resolve one exact Root/Evidence chain.",
    recovery: "Run Review in the current task; it attempts one internal missing-Evidence recovery before asking for another action."
  },
  "accept-provisional": {
    label: "Accept provisional delivery",
    invoke: "Ask/Agent: /accept-work provisional or $accept-work provisional only for an explicit provisional acceptance",
    benefit: "Records a one-time human acceptance of an evidence gap.",
    blocked_when: "Current review is not provisional.",
    recovery: "Run a fresh review before accepting."
  },
  closeout: {
    label: "Deterministic closeout",
    invoke: "Agent: /close-work [wp-id] or $close-work, or finish Implement Plan closeout",
    benefit: "Builds validated Evidence from observed Checks.",
    blocked_when: "Exact Root/chain or Check observations are missing.",
    recovery: "Supply exact artifacts and required Check observations, then retry."
  },
  correct: {
    label: "Fix failing Checks",
    invoke: "Agent: repair failing required Checks, then closeout again",
    benefit: "Restores a deliverable Evidence grade.",
    blocked_when: "Intent, scope, or risk must change.",
    recovery: "Use /plan-work replan or $plan-work replan instead."
  },
  "approve-correction": {
    label: "Apply bounded correction",
    invoke: "Agent: /correct-work or $correct-work, then Ask: fresh /review-work",
    benefit: "Applies only the review-approved in-scope FIX set.",
    blocked_when: "No actionable correction tip is present.",
    recovery: "Run /review-work or $review-work first."
  },
  "provide-artifacts": {
    label: "Supply artifact chain",
    invoke: "Ask/Agent: pass current Schema-5 Root/Evidence/Review to workflow_status",
    benefit: "Derives status without inventing tips.",
    blocked_when: "Tips are missing or ambiguous.",
    recovery: "Pass an explicit wp-* plus exact artifacts."
  },
  replan: {
    label: "Replan the Root",
    invoke: "Plan: /plan-work replan or $plan-work replan, then approve the replacement",
    benefit: "Creates a new approval boundary when Intent must change.",
    blocked_when: "Current review does not require next_action replan.",
    recovery: "Run a fresh review that requests replan first."
  },
  "retry-review": {
    label: "Retry review",
    invoke: "Current task, read-only phase: rerun /review-work or $review-work with the updated evidence",
    benefit: "Reassesses once Evidence or context is complete.",
    blocked_when: "Evidence is still missing or incomplete.",
    recovery: "Keep the exact chain in this task, resolve the named evidence gap, then rerun Review."
  },
  answer: {
    label: "Answer clarification",
    invoke: "Ask: answer the open review clarification",
    benefit: "Unblocks a human decision without mutating delivery.",
    blocked_when: "No open clarify decision is pending.",
    recovery: "Run /work-status or $work-status to see the current tip."
  },
  "resolve-intent": {
    label: "Resolve intent",
    invoke: "Plan: answer open intent questions or replan",
    benefit: "Restores Intent Readiness before a Root is presented.",
    blocked_when: "Goal or acceptance decisions remain open.",
    recovery: "Run /plan-work <goal> or $plan-work <goal> with decisive answers."
  },
  none: {
    label: "Done",
    invoke: "No further Workflow command required",
    benefit: "Delivery is complete for this Root.",
    blocked_when: null,
    recovery: "Optional: /learn-from-work or /explain-work (Codex: $learn-from-work / $explain-work)."
  },
  learn: {
    label: "Persist learnings",
    invoke: "Agent: /learn-from-work or $learn-from-work",
    benefit: "Captures confirmed reusable guidance after earned delivery.",
    blocked_when: "Delivery is not verified and achieved.",
    recovery: "Finish a verified achieved review; provisional acceptance never authorizes Learning."
  },
  explain: {
    label: "Explain the chain",
    invoke: "Ask: /explain-work or $explain-work",
    benefit: "Translates the Root/Evidence/Review chain for humans.",
    blocked_when: "No exact chain is available.",
    recovery: "Run /work-status or supply exact artifacts first."
  }
};
function asList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object") return String(entry.message ?? entry.code ?? JSON.stringify(entry));
    return String(entry);
  }).filter(Boolean);
}
function firstLine(text, fallback = "No summary.") {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value || fallback;
}
function humanBlocker(value, fallbackRecovery = "Follow the single next action, then retry the same Workflow phase.") {
  const technical = firstLine(value, "Workflow could not complete this phase.");
  if (/handoff|cache/i.test(technical)) return {
    reason: "Optional cross-task handoff is unavailable; the exact task-local chain is still usable in the current task.",
    recovery: "Continue in the current task. Export the exact artifact only if you intentionally switch tasks or hosts."
  };
  if (/roots-request-failed|roots-empty|workspace roots|workspace binding/i.test(technical)) return {
    reason: "Workflow cannot establish an optional workspace handoff context.",
    recovery: "Continue with the exact artifacts already held in this task; otherwise select the current Root explicitly."
  };
  if (/baseline/i.test(technical)) return {
    reason: "Workflow cannot prove which repository changes belong to this delivery because the pre-change baseline is unavailable.",
    recovery: "Use the named replan action to create a new clean approval and baseline boundary."
  };
  if (/authority|outside (?:the )?(?:root|scope)|protected path|approval-required/i.test(technical)) return {
    reason: "The requested or observed change is outside the approved plan boundary.",
    recovery: "Keep the change inside the approved Root, or run plan-work replan and approve the expanded boundary."
  };
  if (/required .*check.*failed|failed .*required .*check|check .*failed/i.test(technical)) return {
    reason: "A required verification Check failed, so Workflow cannot call the delivery successful.",
    recovery: "Run Review in this task, then apply its bounded correction or replan action."
  };
  if (/missing .*evidence|evidence .*missing|no evidence tip/i.test(technical)) return {
    reason: "Delivery Evidence is not available yet for the approved Root.",
    recovery: fallbackRecovery
  };
  if (/missing .*root|no .*root|exact root .*unavailable|root .*required/i.test(technical)) return {
    reason: "The approved Intent Root is not available in this task.",
    recovery: "Select or approve the exact current Root, then retry the same Workflow phase."
  };
  if (/ambiguous|multiple|conflict|mismatch|different immutable/i.test(technical)) return {
    reason: "Workflow found conflicting or ambiguous versions and cannot determine one safe current chain.",
    recovery: "Select the exact current wp-* Root in this task and retry without reconstructing artifact text."
  };
  return { reason: technical, recovery: fallbackRecovery };
}
function resolveNextStep(action, overrides = {}) {
  const entry = NEXT_STEP_CATALOG[action];
  const shared = MANUAL_PRIMARY_ACTIONS[action];
  if (!entry) {
    return {
      action,
      label: shared?.label ?? action,
      invoke: action,
      benefit: "Continue with the stated Workflow action.",
      blocked_reason: overrides.blocked_reason ?? null,
      recovery: overrides.recovery ?? null,
      label_line: action
    };
  }
  const blockedReason = overrides.blocked_reason ?? null;
  const recovery = overrides.recovery ?? (blockedReason ? entry.recovery : null);
  return {
    action,
    label: shared?.label ?? entry.label,
    invoke: overrides.invoke ?? shared?.command ?? entry.invoke,
    benefit: overrides.benefit ?? entry.benefit,
    blocked_reason: blockedReason,
    recovery,
    // Keep a short compatible summary that still embeds the exact invoke tokens.
    label_line: overrides.invoke ?? shared?.command ?? entry.invoke
  };
}
function journeyStateFor(presentation, action) {
  return deriveManualJourneyState(presentation, action);
}
function firstProblem(presentation) {
  return [
    ...asList(presentation.blocker ? [presentation.blocker] : []),
    ...asList(presentation.gaps),
    ...asList(presentation.human_attention),
    ...asList(presentation.problems),
    ...asList(presentation.errors)
  ][0] ?? null;
}
function defaultTechnicalTraceability(presentation) {
  return {
    root_plan_id: presentation.root_plan_id ?? null,
    evidence_id: presentation.evidence_id ?? null,
    review_id: presentation.review_id ?? null,
    correction_id: presentation.correction_id ?? null,
    check_ids: presentation.check_ids ?? [],
    finding_ids: presentation.finding_ids ?? [],
    changed_paths: presentation.changed_paths ?? [],
    root_content_hash: presentation.root_content_hash ?? null,
    evidence_hash: presentation.evidence_hash ?? null,
    review_hash: presentation.review_hash ?? null,
    artifact_set_hash: presentation.artifact_set_hash ?? null,
    repository_snapshot_hash: presentation.repository_snapshot_hash ?? null,
    receipt_ids: presentation.receipt_ids ?? []
  };
}
function normalizedEnforcementLevel(value) {
  return ["host-native", "explicit"].includes(value) ? value : "explicit";
}
function withNextStepFields(presentation, action, overrides = {}) {
  const normalizedAction = normalizeManualPrimaryAction(presentation, action);
  const step = resolveNextStep(normalizedAction, overrides);
  const technicalTraceability = presentation.technical_traceability ?? defaultTechnicalTraceability(presentation);
  const journeyState = presentation.journey_state ?? journeyStateFor(presentation, normalizedAction);
  const enforcementLevel = normalizedEnforcementLevel(presentation.enforcement_level);
  const problem = firstProblem(presentation) ?? step.blocked_reason ?? null;
  const primaryInvoke = taskBoundManualInvoke(normalizedAction, technicalTraceability);
  return {
    ...presentation,
    ...problem ? { blocker: problem } : {},
    journey_state: journeyState,
    enforcement_level: enforcementLevel,
    primary_action: normalizedAction === "none" ? null : { id: normalizedAction, label: step.label, invoke: primaryInvoke, why: step.benefit },
    technical_traceability: { ...technicalTraceability, enforcement_level: enforcementLevel },
    deduplication_key: [
      technicalTraceability.root_plan_id ?? "no-root",
      technicalTraceability.evidence_id ?? "no-evidence",
      technicalTraceability.review_id ?? "no-review",
      journeyState,
      problem ?? "no-problem",
      normalizedAction
    ].join("|"),
    next_action: normalizedAction,
    next_action_label: step.label,
    next_action_invoke: primaryInvoke,
    next_action_benefit: step.benefit,
    ...step.blocked_reason ? {
      next_action_blocked_reason: step.blocked_reason,
      next_action_recovery: step.recovery
    } : {}
  };
}
function withHelpFields(presentation, help) {
  return help ? { ...presentation, help } : presentation;
}
function formatHostToolApproval(value) {
  if (!value) return null;
  if (typeof value === "string") return `host approvals: ${value}; Workflow grants none`;
  if (typeof value !== "object" || Array.isArray(value)) return `host approvals: ${String(value)}; Workflow grants none`;
  const mode = value.tool_approval ?? value.mode;
  if (!mode) return null;
  const source = value.source ? ` (source: ${value.source})` : "";
  if (mode === "strict") return `host approvals: per-call prompts expected${source}; Workflow grants none`;
  if (mode === "allowlisted") return `host approvals: host allowlist expected${source}; preference grants none`;
  return `host approvals: ${mode}${source}; Workflow grants none`;
}
function formatChangedPaths(paths, { maxDisplay = MAX_DISPLAY_CHANGED_PATHS } = {}) {
  if (!Array.isArray(paths) || paths.length === 0) return "changed paths: none";
  if (paths.length <= maxDisplay) return `changed paths (${paths.length}): ${paths.join(", ")}`;
  const shown = paths.slice(0, maxDisplay).join(", ");
  return `changed paths (${paths.length}, showing ${maxDisplay}): ${shown}, \u2026 (+${paths.length - maxDisplay} more)`;
}
function receiptCoverageLine(summary2) {
  const coverage = summary2?.receipt_coverage;
  if (!coverage || !Number.isInteger(coverage.attested) || !Number.isInteger(coverage.eligible)) return null;
  return `host-attested machine Checks: ${coverage.attested}/${coverage.eligible}`;
}
function humanAttentionLines(value) {
  if (value?.required !== true || !Array.isArray(value.reasons)) return [];
  return value.reasons.map((reason) => {
    if (typeof reason === "string") return reason;
    const check = reason?.check_id ? `${reason.check_id}: ` : "";
    return `${check}${reason?.message ?? reason?.code ?? "Human attention required"}${reason?.recovery ? ` \u2192 ${reason.recovery}` : ""}`;
  });
}
function problemLines(value) {
  if (!Array.isArray(value)) return [];
  return value.map((problem) => {
    if (typeof problem === "string") return problem;
    return `${problem?.problem ?? "Workflow problem"} Why: ${problem?.why ?? "The current delivery claim is incomplete."} Resolution: ${problem?.resolution ?? "Follow the stated Workflow recovery."}`;
  });
}
function statusPresentationOutcome(snapshot) {
  const blockers = asList(snapshot.blockers);
  const state = snapshot.state ?? "unknown";
  if (blockers.length > 0) return "blocked";
  if (TERMINAL_READY_STATES.has(state)) return "ready";
  if (TERMINAL_BLOCKED_STATES.has(state)) return "blocked";
  return "partial";
}
function closeoutPresentation(value) {
  if (value.artifact_kind === "work-review") {
    const blocked2 = value.delivery_status === "blocked";
    const provisional = value.delivery_status === "provisional";
    const outcome2 = blocked2 ? "blocked" : provisional ? "partial" : "ready";
    const nextAction2 = value.next_action ?? "retry-review";
    const recovery = nextAction2 === "retry-review" ? "Correct the named review_input field and repeat Review in this task; no repository work or new task is required." : `Continue with ${nextAction2} in this task.`;
    return withNextStepFields({
      schema: 1,
      tool: "workflow_closeout",
      phase: "review",
      outcome: outcome2,
      summary: blocked2 ? `The host built a valid task-local Review and selected ${nextAction2}.` : provisional ? "The host built a valid task-local provisional Review." : "The host built a valid task-local verified Review.",
      check_summary: `Review input and exact Root/Evidence chain produced ${value.work_review_id ?? "one work-review"}.`,
      enforcement_level: "host-native",
      technical_traceability: {
        root_plan_id: value.root_plan_id ?? null,
        root_content_hash: value.root_content_hash ?? null,
        evidence_id: value.latest_evidence_id ?? null,
        review_id: value.work_review_id ?? null,
        review_hash: value.artifact_hash ?? null,
        correction_id: value.correction_id ?? null,
        artifact_set_hash: value.artifact_set_hash ?? null,
        check_ids: value.authoritative_fields?.inspected_checks ?? [],
        finding_ids: [],
        changed_paths: [],
        handoff_persisted: value.handoff_persisted !== false
      },
      checks: [
        `assessment: ${value.assessment ?? "unknown"}`,
        `delivery status: ${value.delivery_status ?? "unknown"}`,
        `review route: ${value.review_route ?? "unknown"}`,
        `task-local valid: ${value.task_local_valid === true ? "yes" : "unknown"}`,
        `handoff persisted: ${value.handoff_persisted === true ? "yes" : "no"}`
      ],
      gaps: blocked2 ? [`Review selected ${nextAction2}; only the Review/delivery route is blocked.`] : [],
      advisories: [
        "The exact task-local artifact is authoritative; optional handoff persistence is resilience only.",
        ...value.handoff_persisted === false ? ["Handoff failure did not invalidate this Review."] : []
      ],
      warnings: asList(value.warning ? [value.warning] : []),
      errors: []
    }, nextAction2, blocked2 ? { blocked_reason: `Review selected ${nextAction2}.`, recovery } : {});
  }
  const persisted = value.handoff_persisted !== false;
  const status = value.status ?? "unknown";
  const grade = value.overall_grade ?? "ungraded";
  const warnings = asList(value.warning ? [value.warning] : []);
  const evidenceGaps = value.constraint_summary?.evidence_gap_checks ?? [];
  const legacyReceiptGaps = value.constraint_summary?.legacy_unattested_verified_checks ?? [];
  const blocked = status === "blocked" || grade === "failed";
  const provisionalEvidence = status === "provisional" || grade === "partial" || grade === "unavailable" || grade === "supported" || evidenceGaps.length > 0;
  let outcome = "ready";
  if (blocked) outcome = "blocked";
  else if (provisionalEvidence) outcome = "partial";
  const summary2 = blocked ? "Delivery is blocked because required evidence contains a known failure." : outcome === "partial" ? "Implementation closeout is incomplete; at least one required proof remains limited." : "Implementation closeout is complete and ready for task-local read-only review.";
  let nextAction = "review-root";
  let overrides = {};
  if (blocked) {
    nextAction = "review-root";
    overrides = {
      blocked_reason: `Evidence status ${status} with grade ${grade} blocks delivery acceptance.`,
      recovery: "Run one fresh independent review and follow only the single action it selects."
    };
  } else if (legacyReceiptGaps.length > 0) {
    overrides = {
      blocked_reason: `Legacy verified claims lack current host receipts: ${legacyReceiptGaps.join(", ")}.`,
      recovery: "Ask: run a fresh /review-work or $review-work and follow its bounded correction route."
    };
  } else if (outcome === "partial" && evidenceGaps.length > 0) {
    overrides = {
      benefit: "Lets the fresh read-only review decide whether to rerun proof, correct, or accept a provisional limit.",
      blocked_reason: `Evidence is ${grade} / ${status}; verified acceptance is not available yet.`,
      recovery: "Run Review in this task and follow its one bounded next action."
    };
  } else if (outcome === "partial") {
    overrides = {
      blocked_reason: `Evidence is ${grade} / ${status}; verified acceptance is not available yet.`,
      recovery: "Ask: /review-work or $review-work; accept provisional only if the review allows it."
    };
  }
  const help = blocked ? manualEvidenceHelp("failed") : !persisted ? MANUAL_HELP_TOPICS["artifacts-tips-and-handoff"] : manualEvidenceHelp(grade);
  return withHelpFields(withNextStepFields({
    schema: 1,
    tool: "workflow_closeout",
    phase: "closeout",
    outcome,
    summary: summary2,
    check_summary: blocked ? "Required delivery evidence contains a known failure." : outcome === "partial" ? `${evidenceGaps.length || 1} required proof gap${evidenceGaps.length === 1 ? "" : "s"} remain.` : "Required closeout evidence is ready for fresh review.",
    enforcement_level: value.enforcement_level ?? ((value.constraint_summary?.receipt_coverage?.eligible ?? 0) > 0 && value.constraint_summary.receipt_coverage.attested === value.constraint_summary.receipt_coverage.eligible ? "host-native" : "explicit"),
    technical_traceability: {
      root_plan_id: value.root_plan_id ?? null,
      root_content_hash: value.root_content_hash ?? null,
      evidence_id: value.delivery_evidence_id ?? null,
      evidence_hash: value.artifact_hash ?? null,
      artifact_set_hash: value.artifact_set_hash ?? null,
      repository_snapshot_hash: value.repository_snapshot_hash ?? null,
      review_id: value.source_review_id ?? null,
      correction_id: value.correction_id ?? null,
      check_ids: (value.check_evidence ?? []).map((entry) => entry.check_id).filter(Boolean),
      finding_ids: [],
      changed_paths: value.changed_paths ?? [],
      receipt_ids: [...new Set((value.check_evidence ?? []).flatMap((entry) => entry.artifact_hashes ?? []))],
      evidence_status: status,
      evidence_grade: grade,
      handoff_persisted: persisted
    },
    checks: [
      `evidence mode: ${value.evidence_mode ?? "unknown"}`,
      `handoff persisted: ${persisted ? "yes" : "no"}`,
      formatChangedPaths(value.changed_paths),
      receiptCoverageLine(value.constraint_summary)
    ].filter(Boolean),
    gaps: [
      ...blocked ? [`Evidence status ${status} with grade ${grade} blocks delivery acceptance.`] : [],
      ...(value.constraint_summary?.evidence_gap_checks ?? []).length > 0 ? [`Evidence gaps: ${value.constraint_summary.evidence_gap_checks.join(", ")}.`] : []
    ],
    human_attention: humanAttentionLines(value.human_attention),
    problems: problemLines(value.problem_details),
    advisories: persisted ? [] : ["Task-local Evidence remains valid; optional cross-task handoff is unavailable."],
    warnings,
    errors: []
  }, nextAction, overrides), help);
}
function errorPresentation(toolName, value) {
  const technical = firstLine(value?.error, "Workflow tool failed.");
  const reviewErrorCode = value?.error_code ?? (/review_input|workflow-review-input/i.test(technical) ? "review-input-invalid" : /model-authored work-review|newly imported work-review|host builder provenance/i.test(technical) ? "review-artifact-rejected" : null);
  if (["review-input-invalid", "review-artifact-rejected"].includes(reviewErrorCode)) {
    const rejectedArtifact = reviewErrorCode === "review-artifact-rejected";
    const reason = rejectedArtifact ? "Workflow rejected a supplied Review artifact because it cannot establish host-owned Review authority." : "The reviewer response could not be converted into a valid host-owned Review.";
    const recovery = rejectedArtifact ? "Remove the supplied work-review artifact, pass only review_input schema 1, and repeat Review in this task. Root, Evidence, Checks, and repository work remain unchanged; no new task, Root repair, or replan is required." : "Correct the named review_input field and repeat Review in this task. Root, Evidence, Checks, and repository work remain unchanged; no new task, Root repair, or replan is required.";
    return withHelpFields(withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "review",
      outcome: "blocked",
      summary: reason,
      blocker: reason,
      checks: [],
      gaps: [reason],
      advisories: [],
      warnings: [],
      errors: [technical]
    }, "retry-review", {
      blocked_reason: reason,
      recovery,
      invoke: "Current task, read-only phase: correct the named Review input and rerun /review-work or $review-work"
    }), MANUAL_HELP_TOPICS["recovery-and-troubleshooting"]);
  }
  const closeoutFailed = toolName === "workflow_closeout";
  const nextAction = toolName === "workflow_plan_preflight" ? "repair-root" : closeoutFailed ? "review-root" : "provide-artifacts";
  const fallbackRecovery = toolName === "workflow_plan_preflight" ? "Repair the Root blockers, then retry validation or /plan-work." : closeoutFailed ? "Repair the exact Root/chain and Check observations, then retry closeout or Ask: /review-work." : "Supply the exact current Schema-5 artifacts, then retry the failed Workflow command.";
  const guidance = humanBlocker(technical, fallbackRecovery);
  return withHelpFields(withNextStepFields({
    schema: 1,
    tool: toolName,
    phase: toolName.replace(/^workflow_/, "").replaceAll("_", "-"),
    outcome: closeoutFailed ? "blocked" : "failed",
    summary: guidance.reason,
    blocker: guidance.reason,
    checks: [],
    gaps: [guidance.reason],
    advisories: [],
    warnings: [],
    errors: [technical]
  }, nextAction, {
    blocked_reason: guidance.reason,
    recovery: guidance.recovery
  }), MANUAL_HELP_TOPICS["recovery-and-troubleshooting"]);
}
function buildPresentation(toolName, value, { isError = false } = {}) {
  if (isError || value?.error) {
    return errorPresentation(toolName, value);
  }
  if (toolName === "workflow_plan_preflight") {
    const blockers = asList(value.blocking_issues);
    const advisories = asList(value.advisories);
    const feasible = value.feasible === true && blockers.length === 0;
    const nextAction = feasible ? "implement-plan" : "repair-root";
    const blockerGuidance = feasible ? null : humanBlocker(blockers[0] ?? "Root cannot be presented yet.", "Repair the Root blockers, then retry /plan-work.");
    const overrides = feasible ? {} : {
      blocked_reason: blockerGuidance.reason,
      recovery: blockerGuidance.recovery
    };
    const presentation = withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "plan-preflight",
      outcome: feasible ? "ready" : "blocked",
      ...blockerGuidance ? { blocker: blockerGuidance.reason } : {},
      summary: feasible ? "The Intent Root is valid and ready for human implementation approval." : "The Intent Root is not ready for implementation approval.",
      check_summary: feasible ? "Root structure and required Checks are feasible." : "Root validation has blocking issues.",
      technical_traceability: {
        root_plan_id: value.root_plan_id ?? null,
        root_content_hash: value.root_content_hash ?? null,
        evidence_id: null,
        review_id: null,
        correction_id: null,
        check_ids: value.required_checks ?? [],
        finding_ids: [],
        changed_paths: []
      },
      checks: [
        `required: ${(value.required_checks ?? []).join(", ") || "none"}`,
        `deferred: ${(value.deferred_checks ?? []).join(", ") || "none"}`
      ],
      gaps: blockers,
      advisories,
      warnings: [],
      errors: []
    }, nextAction, overrides);
    return feasible ? presentation : withHelpFields(presentation, MANUAL_HELP_TOPICS["intent-root-and-plan"]);
  }
  if (toolName === "workflow_artifact_record") {
    const persisted = value.handoff_persisted !== false && value.handoff_mode !== "stateless";
    const warnings = asList(value.warning ? [value.warning] : []);
    const recordedIds = [...asList(value.recorded), ...asList(value.duplicates)];
    const containsReview = recordedIds.some((id) => /^wr-/.test(id));
    const nextAction = persisted ? containsReview ? "provide-artifacts" : "implement-plan" : "attach-artifact";
    const overrides = persisted ? {} : {
      blocked_reason: "Artifact validated; handoff cache was unavailable.",
      recovery: "Attach the exact artifact explicitly; handoff is transport only."
    };
    const presentation = withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "artifact-record",
      outcome: persisted ? "ready" : "partial",
      summary: persisted ? "The exact artifact chain is available for the next Manual phase." : "Artifact validated; handoff cache was unavailable.",
      check_summary: persisted ? "Artifact bytes were validated and retained." : "Artifact bytes are valid but not retained.",
      checks: [
        `recorded: ${(value.recorded ?? []).join(", ") || "none"}`,
        `duplicates: ${(value.duplicates ?? []).join(", ") || "none"}`
      ],
      gaps: persisted ? [] : ["Attach the exact artifact explicitly; handoff is transport only."],
      advisories: ["Handoff is transport only and never grants authority."],
      warnings,
      errors: []
    }, nextAction, overrides);
    return persisted ? presentation : withHelpFields(presentation, MANUAL_HELP_TOPICS["artifacts-tips-and-handoff"]);
  }
  if (toolName === "workflow_artifact_context") {
    const count = Array.isArray(value.artifacts) ? value.artifacts.length : 0;
    const nextAction = "review-root";
    const overrides = value.evidence_tip ? {} : {
      blocked_reason: "No Evidence tip is loaded for this Root.",
      recovery: "Run Review in this task; it attempts one internal idempotent closeout before asking for another action."
    };
    const presentation = withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "artifact-context",
      outcome: value.evidence_tip ? "ready" : "partial",
      summary: value.evidence_tip ? "The exact current artifact chain is ready for task-local read-only review." : "The current Root is loaded; task-local Review will attempt one internal Evidence recovery.",
      check_summary: value.evidence_tip ? "Delivery Evidence is available." : "Delivery Evidence is missing.",
      technical_traceability: {
        root_plan_id: value.root_plan_id ?? null,
        root_content_hash: value.root_content_hash ?? null,
        evidence_id: value.evidence_tip ?? null,
        review_id: value.review_tip ?? null,
        correction_id: null,
        check_ids: [],
        finding_ids: [],
        changed_paths: [],
        artifact_count: count
      },
      checks: [
        `evidence tip: ${value.evidence_tip ?? "none"}`,
        `review tip: ${value.review_tip ?? "none"}`
      ],
      gaps: value.evidence_tip ? [] : ["Evidence tip missing; Review will attempt one internal recovery."],
      advisories: ["Task artifacts remain authoritative; context is enrichment only."],
      warnings: asList(value.warning ? [value.warning] : []),
      errors: []
    }, nextAction, overrides);
    return value.evidence_tip && !value.warning ? presentation : withHelpFields(presentation, MANUAL_HELP_TOPICS["artifacts-tips-and-handoff"]);
  }
  if (toolName === "workflow_closeout") {
    return closeoutPresentation(value);
  }
  if (toolName === "workflow_status") {
    const snapshot = value.snapshot ?? {};
    const blockers = asList(snapshot.blockers);
    const state = snapshot.state ?? "unknown";
    const action = snapshot.next_action ?? "none";
    const requestedProfile = snapshot.requested_profile ?? "manual";
    const effectiveProfile = snapshot.effective_profile ?? requestedProfile;
    const requiredActor = snapshot.required_actor ?? "unknown";
    const downgradeReason = snapshot.downgrade_reason ?? null;
    const outcome = statusPresentationOutcome(snapshot);
    const safeAction = normalizeManualPrimaryAction({ outcome }, action);
    const overrides = blockers.length > 0 && (outcome === "blocked" || outcome === "partial") && action !== "none" ? {
      blocked_reason: humanBlocker(blockers[0] ?? `Manual state is ${state}.`, resolveNextStep(safeAction).recovery).reason,
      recovery: humanBlocker(blockers[0] ?? `Manual state is ${state}.`, resolveNextStep(safeAction).recovery).recovery
    } : outcome === "blocked" && blockers.length > 0 ? {
      blocked_reason: humanBlocker(blockers[0]).reason,
      recovery: humanBlocker(blockers[0], "Clear the named issue, then re-check /work-status.").recovery
    } : {};
    const presentation = withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "status",
      workflow_state: state,
      journey_state: snapshot.journey_state ?? null,
      outcome,
      summary: requiredActor === "none" ? `The Manual delivery is ${state}; no further actor is required.` : `The Manual delivery is ${state}; ${requiredActor} acts next.`,
      check_summary: state === "achieved" ? "Fresh review verified the required repository evidence." : state === "root-review" ? "Delivery Evidence is ready for fresh review." : state === "root-plan-review" ? "Implementation Evidence does not exist yet." : blockers.length > 0 ? "The current Workflow state has blocking evidence or context." : "Current Checks and evidence remain visible in technical traceability.",
      enforcement_level: value.enforcement_level ?? "explicit",
      technical_traceability: {
        root_plan_id: snapshot.root_plan_id ?? value.root_plan_id ?? null,
        root_content_hash: value.root_content_hash ?? value.artifact_summary?.root_content_hash ?? null,
        evidence_id: snapshot.latest_evidence_id ?? snapshot.evidence_tip ?? null,
        evidence_hash: value.evidence_hash ?? value.artifact_summary?.evidence_hash ?? null,
        review_id: snapshot.latest_review_id ?? snapshot.review_tip ?? null,
        review_hash: value.artifact_summary?.review_hash ?? null,
        correction_id: snapshot.review?.correction_id ?? null,
        check_ids: value.constraint_summary?.required_checks ?? [],
        finding_ids: value.artifact_summary?.finding_ids ?? [],
        changed_paths: [],
        artifact_set_hash: snapshot.artifact_set_hash ?? value.artifact_summary?.artifact_set_hash ?? null,
        repository_snapshot_hash: value.repository_snapshot_hash ?? null,
        receipt_ids: value.receipt_ids ?? value.artifact_summary?.receipt_ids ?? [],
        workflow_state: state
      },
      checks: [
        requestedProfile === effectiveProfile ? `profile: ${effectiveProfile}` : `profile: ${requestedProfile} \u2192 ${effectiveProfile}`,
        `required actor: ${requiredActor}`,
        `evidence: ${snapshot.latest_evidence_id ?? snapshot.evidence_tip ?? "none"}`,
        `review: ${snapshot.latest_review_id ?? snapshot.review_tip ?? "none"}`,
        receiptCoverageLine(value.constraint_summary)
      ].filter(Boolean),
      gaps: blockers,
      advisories: asList([
        formatHostToolApproval(value.host_tool_approval),
        value.model_inheritance?.status ? `model_inheritance: ${value.model_inheritance.status}` : null
      ].filter(Boolean)),
      warnings: asList([
        ...value.warning ? [value.warning] : [],
        ...downgradeReason ? [`profile downgrade: ${requestedProfile} \u2192 ${effectiveProfile} (${downgradeReason})`] : []
      ]),
      errors: [],
      human_attention: humanAttentionLines(value.human_attention),
      problems: problemLines(value.problem_details)
    }, safeAction, overrides);
    return isManualStatusSnapshot(snapshot) ? withHelpFields(presentation, manualStateHelp(state)) : presentation;
  }
  return withNextStepFields({
    schema: 1,
    tool: toolName,
    phase: "manual",
    outcome: "ready",
    summary: firstLine(JSON.stringify(value), "Workflow tool completed."),
    checks: [],
    gaps: [],
    advisories: [],
    warnings: [],
    errors: []
  }, "none");
}
function formatSection(title, items) {
  if (!items || items.length === 0) return null;
  return [`${title}:`, ...items.map((item) => `- ${item}`)].join("\n");
}
function formatHelp(help) {
  if (!help?.meaning || !help?.label || !help?.url) return null;
  return [
    `Meaning: ${help.meaning}`,
    `Learn more: [${help.label}](${help.url})`
  ].join("\n");
}
function formatNextStepFooter(presentation) {
  if (presentation.tool === "workflow_status" && presentation.workflow_state === "achieved" && presentation.next_action === "none") {
    return [
      "### Done",
      "Repository delivery is complete for this Root."
    ].join("\n");
  }
  if (presentation.tool === "workflow_status" && presentation.workflow_state === "accepted-provisional" && presentation.next_action === "none") {
    return [
      "### Accepted provisionally",
      "This one-time acceptance is not persisted; the next /work-status or $work-status returns delivery-ready-provisional."
    ].join("\n");
  }
  const primary = presentation.primary_action;
  if (!primary) return ["### Done", "No further Workflow action is required."].join("\n");
  return [
    "### Next step",
    `- Now: ${primary.label}`,
    `- How: ${primary.invoke}`,
    `- Why: ${primary.why}`
  ].join("\n");
}
function traceValue(value) {
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "none";
  if (value && typeof value === "object") return JSON.stringify(value);
  return value === null || value === void 0 || value === "" ? "none" : String(value);
}
function formatTechnicalTraceability(presentation, { disclosure = true } = {}) {
  const trace = presentation.technical_traceability ?? {};
  const identity = [
    `Root: ${trace.root_plan_id ?? "none"}`,
    `Root hash: ${trace.root_content_hash ?? "none"}`,
    `Evidence: ${trace.evidence_id ?? "none"}`,
    `Evidence hash: ${trace.evidence_hash ?? "none"}`,
    `Review: ${trace.review_id ?? "none"}`,
    `Review hash: ${trace.review_hash ?? "none"}`,
    `Correction: ${trace.correction_id ?? "none"}`,
    `Artifact set hash: ${trace.artifact_set_hash ?? "none"}`,
    `Repository snapshot hash: ${trace.repository_snapshot_hash ?? "none"}`,
    `Receipt IDs: ${traceValue(trace.receipt_ids)}`,
    `Check IDs: ${traceValue(trace.check_ids)}`,
    `Finding IDs: ${traceValue(trace.finding_ids)}`,
    formatChangedPaths(trace.changed_paths),
    `Enforcement: ${presentation.enforcement_level ?? trace.enforcement_level ?? "explicit"}`,
    `Update key: ${presentation.deduplication_key ?? "none"}`
  ];
  const body = [
    `${presentation.tool} \u2014 ${presentation.outcome}`,
    ...identity,
    formatSection("Checks", presentation.checks),
    formatSection("Gaps", presentation.gaps),
    formatSection("Human attention", presentation.human_attention),
    formatSection("Problems", presentation.problems),
    formatSection("Advisories", presentation.advisories),
    formatSection("Warnings", presentation.warnings),
    formatSection("Errors", presentation.errors),
    presentation.next_action_blocked_reason ? `Action blocker: ${presentation.next_action_blocked_reason}` : null,
    presentation.next_action_recovery ? `Recovery detail: ${presentation.next_action_recovery}` : null,
    formatHelp(presentation.help)
  ].filter((line2) => line2 !== null && line2 !== void 0).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return disclosure ? `<details><summary>Technical traceability</summary>

${body}

</details>` : `---

### Technical traceability

${body}`;
}
function formatManualToolContent(presentation, { technicalDisclosure = true } = {}) {
  const journeyLabel = JOURNEY_STATE_LABELS[presentation.journey_state] ?? presentation.journey_state ?? "Manual state";
  const blocker = firstProblem(presentation);
  const lines = [
    `## Workflow \xB7 ${journeyLabel}`,
    `What happened: ${presentation.summary}`,
    `Checks: ${presentation.check_summary ?? "See technical traceability for exact evidence."}`,
    blocker ? `Blocker: ${blocker}` : null,
    blocker && presentation.next_action_recovery ? `Resolution: ${presentation.next_action_recovery}` : null,
    formatNextStepFooter(presentation),
    formatTechnicalTraceability(presentation, { disclosure: technicalDisclosure })
  ].filter((line2) => line2 !== null && line2 !== void 0);
  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}
`;
}
function isManualWorkflowTool(toolName) {
  return MANUAL_TOOLS.has(toolName);
}
function coalesceManualPresentation(presentation) {
  const trace = presentation.technical_traceability ?? {};
  const subject2 = trace.root_plan_id ? `root|${trace.root_plan_id}` : [presentation.tool, "no-root", presentation.phase ?? "manual"].join("|");
  const duplicate = RECENT_PRESENTATION_UPDATES.get(subject2) === presentation.deduplication_key;
  if (!duplicate) {
    RECENT_PRESENTATION_UPDATES.delete(subject2);
    RECENT_PRESENTATION_UPDATES.set(subject2, presentation.deduplication_key);
    while (RECENT_PRESENTATION_UPDATES.size > MAX_RECENT_PRESENTATION_UPDATES) {
      RECENT_PRESENTATION_UPDATES.delete(RECENT_PRESENTATION_UPDATES.keys().next().value);
    }
  }
  return { ...presentation, update_suppressed: duplicate };
}
function manualMcpResult(toolName, value, isError = false) {
  if (process.env.GELDMACHER_WORKFLOW_LEGACY_MCP_TEXT === "1" || !isManualWorkflowTool(toolName)) {
    return {
      content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
      structuredContent: value,
      isError
    };
  }
  const presentation = coalesceManualPresentation(buildPresentation(toolName, value, { isError }));
  const structuredContent = { ...value, presentation };
  return {
    content: presentation.update_suppressed ? [] : [{ type: "text", text: formatManualToolContent(presentation) }],
    structuredContent,
    isError
  };
}

// src/mcp/manual-tool-annotations.mjs
function annotations({ readOnlyHint, destructiveHint, idempotentHint, openWorldHint }) {
  return Object.freeze({
    readOnlyHint,
    destructiveHint,
    idempotentHint,
    openWorldHint
  });
}
var MANUAL_WORKFLOW_TOOL_NAMES = Object.freeze([
  "workflow_artifact_context",
  "workflow_artifact_record",
  "workflow_closeout",
  "workflow_plan_preflight",
  "workflow_status"
]);
var MANUAL_WORKFLOW_TOOL_ANNOTATIONS = Object.freeze({
  workflow_plan_preflight: annotations({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }),
  workflow_artifact_context: annotations({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }),
  workflow_status: annotations({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }),
  workflow_artifact_record: annotations({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }),
  workflow_closeout: annotations({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  })
});
if (Object.keys(MANUAL_WORKFLOW_TOOL_ANNOTATIONS).sort().join("\n") !== [...MANUAL_WORKFLOW_TOOL_NAMES].sort().join("\n")) {
  throw new Error("Manual MCP tool annotations differ from the Manual tool set");
}
function manualToolAnnotations(name) {
  const value = MANUAL_WORKFLOW_TOOL_ANNOTATIONS[name];
  if (!value) throw new Error(`unknown Manual Workflow MCP tool annotations ${name}`);
  return value;
}

// src/mcp/review-input-contract.mjs
var semanticKey = string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
var objectiveId = string().regex(/^OBJ-[1-9][0-9]*$/);
var checkId = string().regex(/^CHECK-[1-9][0-9]*$/);
var line = (max = 2e3) => string().min(1).max(max);
var finding = strictObject({
  key: semanticKey,
  severity: _enum(["low", "medium", "high", "critical"]),
  objective_ids: array(objectiveId).min(1).max(64),
  check_ids: array(checkId).min(1).max(128),
  evidence: line(4e3),
  reasoning: line(4e3),
  resolution: _enum(["correct", "clarify", "replan"])
});
var correction = strictObject({
  fixes: array(strictObject({
    key: semanticKey,
    finding_keys: array(semanticKey).min(1).max(32),
    required_outcome: line(),
    evidence: line()
  })).min(1).max(32),
  checks: array(strictObject({
    key: semanticKey,
    fix_keys: array(semanticKey).min(1).max(32),
    working_directory: line(1e3),
    command_or_inspection: line(),
    expected_result: line(),
    required: boolean(),
    cost_class: _enum(["cheap", "standard", "expensive"]),
    prerequisites: array(line(1e3)).min(1).max(64)
  })).min(1).max(32),
  steps: array(strictObject({
    key: semanticKey,
    fix_keys: array(semanticKey).min(1).max(32),
    targets: array(line(1e3)).min(1).max(64),
    required_outcome: line(),
    implementation_latitude: line(),
    completion_probe: line(),
    check_keys: array(semanticKey).min(1).max(32),
    deviation_action: line()
  })).min(1).max(32),
  learning_candidates: array(strictObject({
    key: semanticKey,
    finding_keys: array(semanticKey).min(1).max(32),
    reusable_guidance: line(),
    candidate_targets: array(line(1e3)).min(1).max(64),
    confirmation_evidence: line()
  })).min(1).max(32)
});
var reviewInputSchema = strictObject({
  schema: literal(1),
  kind: literal("review-input"),
  assessment: _enum(["achieved", "provisional", "mostly-achieved", "partially-achieved", "not-achieved", "insufficient-evidence"]),
  recommended_action: _enum(["none", "accept-provisional", "correct", "clarify", "replan", "retry-review"]),
  assessment_summary: line(),
  snapshot_assessment: _enum(["consistent", "contradicted", "incomplete"]),
  snapshot_summary: line(),
  findings: array(finding).max(32),
  missing_evidence: array(line()).max(32),
  auditor_reports: array(strictObject({
    role: _enum(["delivery-auditor", "risk-auditor", "work-design-auditor"]),
    assessment: _enum(["achieved", "provisional", "mostly-achieved", "partially-achieved", "not-achieved", "insufficient-evidence"]),
    summary: line()
  })).max(3),
  correction: correction.optional()
});
var malformedReviewInputCandidate = record(string().max(200), unknown()).refine((value) => Object.keys(value).length <= 32, "review_input recovery candidate exceeds 32 fields").describe("Recovery-only malformed review_input object. The host-owned builder still requires the closed Schema-1 branch and never infers missing judgments.");
var reviewInputTransportSchema = union([
  reviewInputSchema,
  malformedReviewInputCandidate
]);

// src/mcp/manual-tool-contracts.mjs
var workspaceRoot = string().min(1).optional();
var artifact = object({
  label: string().min(1).max(200),
  text: string().min(1).max(25e4)
});
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
var contracts = Object.freeze({
  workflow_plan_preflight: {
    description: "Validate one exact Schema-5 Root for authority feasibility and Pareto Check selection without workspace discovery, persistence, approval, or mutation. Optional diagnostic for low/medium Manual; CreatePlan still validates Schema-5 Roots.",
    inputSchema: { root_plan: string().min(1).max(25e4) }
  },
  workflow_artifact_record: {
    description: "Best-effort transport for exact Schema-5 work-plan artifacts. New work-review authority is created only by workflow_closeout work-review mode; historical cached reviews remain readable.",
    inputSchema: { workspace_root: workspaceRoot, artifacts: array(artifact).min(1).max(32) }
  },
  workflow_artifact_context: {
    description: "Best-effort transport enrichment: return the exact revalidated non-authoritative Schema-5 artifact chain cached for one Root under its root-content namespace, optionally hash-bound to the supplied active native Plan. Task artifacts remain authoritative.",
    inputSchema: {
      workspace_root: workspaceRoot,
      root_plan_id: string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
      root_plan: string().min(1).max(25e4).optional()
    }
  },
  workflow_closeout: {
    description: "Deterministically build one host-owned Schema-5 delivery-evidence or work-review artifact and best-effort cache it. delivery-evidence remains the default.",
    inputSchema: {
      workspace_root: workspaceRoot,
      root_plan_id: string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
      root_plan: string().min(1).max(25e4).optional(),
      artifacts: array(artifact).min(1).max(32).optional(),
      artifact_kind: _enum(["delivery-evidence", "work-review"]).default("delivery-evidence"),
      review_input: reviewInputTransportSchema.optional(),
      effective_profile: literal("manual").default("manual"),
      strategy_revision: number().int().min(0).default(0),
      changed_paths: array(string().min(1).max(1e3)).max(1e3).default([]),
      check_evidence: array(checkEvidence).max(128).default([]),
      summary: string().min(1).max(2e3).optional(),
      repository_snapshot: object({
        head: string().min(1).optional(),
        working_tree: string().min(1).optional(),
        relevant_fingerprints: string().min(1).optional(),
        known_failures: string().min(1).optional()
      }).optional()
    }
  },
  workflow_status: {
    description: "Return current status and a uniform read-only learning projection for an explicit stateless Manual Schema-5 artifact chain.",
    inputSchema: {
      workspace_root: workspaceRoot,
      root_plan_id: string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
      manual_acceptance: _enum(["provisional"]).optional(),
      artifacts: array(artifact).min(1).max(32)
    }
  }
});
function manualToolContract(name) {
  const contract = contracts[name];
  if (!contract) throw new Error(`unknown Manual Workflow MCP tool ${name}`);
  return { ...contract, annotations: manualToolAnnotations(name) };
}

// src/mcp/manual-tools.mjs
function publicManualSubagentPolicy(policy = resolveManualSubagentPolicy()) {
  return Object.freeze({
    authoritative: false,
    schema: policy.schema,
    mode: policy.mode,
    source: policy.source,
    path: policy.path,
    hosts: Object.freeze({
      cursor: Object.freeze({
        preset: policy.hosts.cursor.preset,
        parent_fallback: policy.hosts.cursor.parent_fallback,
        candidates: policy.hosts.cursor.candidates.map((entry) => entry.model_id)
      }),
      codex: Object.freeze({
        preset: policy.hosts.codex.preset,
        parent_fallback: policy.hosts.codex.parent_fallback,
        candidates: policy.hosts.codex.candidates.map((entry) => entry.model_id)
      })
    }),
    ...policy.issues ? { issues: policy.issues } : {}
  });
}
function registerManualWorkflowTools({
  server: server2,
  pluginRoot: pluginRoot2,
  workspaceAuthority: workspaceAuthority2,
  operationalStateRoot,
  handoffStateRoot = sharedArtifactStateRoot,
  result: result2,
  failure: failure2,
  includeStatus = true,
  contract = manualToolContract,
  resolveHostToolApprovalPreference = resolveHostToolApproval,
  resolveManualSubagentPolicyPreference = resolveManualSubagentPolicy
}) {
  const namedResult = (toolName) => (value, isError = false) => manualMcpResult(toolName, value, isError);
  const namedFailure = (toolName) => (error) => namedResult(toolName)({
    error: error.message,
    ...error?.code ? { error_code: error.code } : {}
  }, true);
  const toolAwareResult = (toolName, value, isError = false) => namedResult(toolName)(value, isError);
  toolAwareResult.toolAware = true;
  const resolveOperationalContext = async (workspaceRoot3) => {
    const workspace = await workspaceAuthority2.resolve(workspaceRoot3);
    return {
      workspace,
      stateRoot: operationalStateRoot(workspace),
      legacyHandoffStore: new ArtifactHandoffStore(handoffStateRoot(workspace), pluginRoot2)
    };
  };
  const handoffStoreFactory = (rootPlanText, root) => createContentAddressedHandoffStore(rootPlanText, root);
  const contextResult = namedResult("workflow_artifact_context");
  const statusResult = namedResult("workflow_status");
  const preflightResult = namedResult("workflow_plan_preflight");
  const artifactHandlers = createArtifactHandlers({
    pluginRoot: pluginRoot2,
    resolveOperationalContext,
    result: toolAwareResult,
    handoffStoreFactory
  });
  const status = async (input) => {
    try {
      if (input.run_id || input.preparation_id) throw new Error("manual workflow_status does not accept controller subjects");
      if (input.root_plan_id && !input.artifacts) throw new Error("manual workflow_status requires artifacts with root_plan_id");
      if (!input.artifacts) throw new Error("manual workflow_status requires current-task artifacts");
      if (input.artifacts.reduce((total, artifact3) => total + artifact3.text.length, 0) > 1e6) {
        throw new Error("manual workflow_status artifact bundle exceeds 1000000 characters");
      }
      let workspace = null;
      let stateRoot = null;
      let workspaceBinding = "not-established";
      try {
        const operational = await resolveOperationalContext(input.workspace_root);
        workspace = operational.workspace;
        stateRoot = operational.stateRoot;
        workspaceBinding = "trusted-root";
      } catch (error) {
        if (!isWorkspaceRootsUnavailable(error)) throw error;
      }
      const manual = deriveManualWorkflowSnapshot({
        rootPlanId: input.root_plan_id,
        artifacts: input.artifacts,
        pluginRoot: pluginRoot2,
        manualAcceptance: input.manual_acceptance ?? null,
        boundaryReceiptVerifier: workspace ? boundaryReceiptVerifier({ pluginRoot: pluginRoot2, workspaceRoot: workspace }) : null
      });
      return statusResult({
        subject_kind: "artifact-chain",
        run: null,
        ...manual,
        learning: deriveManualLearningProjection(manual),
        ...workspace ? { workspace_root: workspace } : {},
        workspace_binding: workspaceBinding,
        workspace_root_used: Boolean(workspace),
        model_inheritance: stateRoot ? modelInheritanceSummary(stateRoot) : { authoritative: false, status: "unavailable", evidence_effect: "none", reason: "workspace-binding-not-established" },
        host_tool_approval: resolveHostToolApprovalPreference(),
        manual_subagent_policy: publicManualSubagentPolicy(resolveManualSubagentPolicyPreference())
      });
    } catch (error) {
      return namedFailure("workflow_status")(error);
    }
  };
  server2.registerTool("workflow_plan_preflight", contract("workflow_plan_preflight"), async (input) => preflightResult(preflightRootPlan(input.root_plan, pluginRoot2)));
  server2.registerTool("workflow_artifact_record", contract("workflow_artifact_record"), artifactHandlers.record);
  server2.registerTool("workflow_artifact_context", contract("workflow_artifact_context"), async (input) => {
    try {
      if (!input.root_plan) {
        try {
          const operational = await resolveOperationalContext(input.workspace_root);
          const legacy = operational.legacyHandoffStore.context(input.root_plan_id, null);
          return contextResult({
            workspace_root: operational.workspace,
            workspace_binding: "trusted-root",
            workspace_root_used: true,
            handoff_authoritative: false,
            handoff_mode: "legacy-repository-cache",
            ...legacy,
            model_inheritance: modelInheritanceSummary(operational.stateRoot)
          });
        } catch (error) {
          if (!isWorkspaceRootsUnavailable(error) && !/no handoff Root/.test(error.message)) throw error;
          throw new Error(`workflow_artifact_context requires exact root_plan text for content-bound handoff${error?.message ? `; ${error.message}` : ""}`);
        }
      }
      resolveRootPlanText(pluginRoot2, { rootPlanId: input.root_plan_id, rootPlan: input.root_plan });
      return artifactHandlers.context(input);
    } catch (error) {
      return namedFailure("workflow_artifact_context")(error);
    }
  });
  server2.registerTool("workflow_closeout", contract("workflow_closeout"), artifactHandlers.closeout);
  if (includeStatus) server2.registerTool("workflow_status", contract("workflow_status"), status);
  return Object.freeze({ status });
}

// src/mcp/proof-artifacts.mjs
import { createHash as createHash3 } from "node:crypto";
import { lstatSync as lstatSync2, readFileSync as readFileSync3, readdirSync as readdirSync2 } from "node:fs";
import { join as join3 } from "node:path";
var PROOF_LIMITS = Object.freeze({ files: 128, file_bytes: 10 * 1024 * 1024, total_bytes: 32 * 1024 * 1024, depth: 8 });
function hashStableProofFile(path, stat = lstatSync2, read = readFileSync3, before = stat(path)) {
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
      const path = join3(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`verification proof artifact may not be a symlink: ${path}`);
      if (entry.isDirectory()) visit(path, depth + 1);
      else if (entry.isFile()) {
        if (files.length >= PROOF_LIMITS.files) throw new Error(`verification proof artifact count exceeds ${PROOF_LIMITS.files}`);
        const before = lstatSync2(path);
        if (before.size > PROOF_LIMITS.file_bytes) throw new Error(`verification proof artifact exceeds 10 MiB: ${path}`);
        totalBytes += before.size;
        if (totalBytes > PROOF_LIMITS.total_bytes) throw new Error("verification proof artifacts exceed 32 MiB total");
        const stable = hashStableProofFile(path, lstatSync2, readFileSync3, before);
        files.push({ path, hash: stable.hash });
      } else throw new Error(`verification proof artifact must be a regular file or directory: ${path}`);
    }
  };
  visit(root);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

// src/mcp/tool-annotations.mjs
function annotations2({ readOnlyHint, destructiveHint, idempotentHint, openWorldHint }) {
  return Object.freeze({
    readOnlyHint,
    destructiveHint,
    idempotentHint,
    openWorldHint
  });
}
var WORKFLOW_TOOL_ANNOTATIONS = Object.freeze({
  ...MANUAL_WORKFLOW_TOOL_ANNOTATIONS,
  workflow_watch: annotations2({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }),
  workflow_validate_models: annotations2({
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }),
  workflow_prepare: annotations2({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }),
  workflow_start: annotations2({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }),
  workflow_answer: annotations2({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }),
  workflow_control: annotations2({
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false
  }),
  workflow_verification_profile: annotations2({
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  })
});
if (Object.keys(WORKFLOW_TOOL_ANNOTATIONS).sort().join("\n") !== [...WORKFLOW_TOOL_NAMES].sort().join("\n")) {
  throw new Error("MCP tool annotations differ from the canonical tool registry");
}
function toolAnnotations(name) {
  const value = WORKFLOW_TOOL_ANNOTATIONS[name];
  if (!value) throw new Error(`unknown Workflow MCP tool annotations ${name}`);
  return value;
}

// src/mcp/tool-contracts.mjs
var workspaceRoot2 = string().min(1).optional();
var artifact2 = object({
  label: string().min(1).max(200),
  text: string().min(1).max(25e4)
});
var subject = {
  workspace_root: workspaceRoot2,
  run_id: string().min(1).optional(),
  preparation_id: string().min(1).optional()
};
var checkEvidence2 = object({
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
  workflow_plan_preflight: {
    description: "Validate one exact Schema-5 Root for authority feasibility and Pareto Check selection without workspace discovery, persistence, approval, or mutation.",
    inputSchema: { root_plan: string().min(1).max(25e4) }
  },
  workflow_prepare: {
    description: "Run the configured planner pool in a read-only pre-run phase and produce either one approvable schema-5 intent root or manual intent questions.",
    inputSchema: {
      workspace_root: workspaceRoot2,
      goal: string().min(1).optional(),
      root_plan: string().min(1).optional(),
      root_artifacts: array(artifact2).min(1).max(32).optional(),
      requested_profile: _enum(["supervised", "autonomous"]),
      route_profile: string().min(1).default("default"),
      expected_revision: literal(0),
      idempotency_key: string().min(8)
    }
  },
  workflow_start: {
    description: "Atomically consume one displayed root-ready preparation after explicit root-hash approval and create exactly one approved run.",
    inputSchema: {
      workspace_root: workspaceRoot2,
      preparation_id: string().min(1),
      approved_root_hash: string().length(64),
      expected_preparation_revision: number().int().min(0),
      idempotency_key: string().min(8)
    }
  },
  workflow_artifact_record: {
    description: "Cache exact Schema-5 work-plan artifacts. New work-review authority is created only by workflow_closeout work-review mode; historical cached reviews remain readable.",
    inputSchema: { workspace_root: workspaceRoot2, artifacts: array(artifact2).min(1).max(32) }
  },
  workflow_artifact_context: {
    description: "Return the exact revalidated non-authoritative Schema-5 artifact chain cached for one Root, optionally hash-bound to the supplied active native Plan.",
    inputSchema: {
      workspace_root: workspaceRoot2,
      root_plan_id: string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
      root_plan: string().min(1).max(25e4).optional()
    }
  },
  workflow_closeout: {
    description: "Deterministically build one host-owned Schema-5 delivery-evidence or work-review artifact and cache it; delivery-evidence remains the default.",
    inputSchema: {
      workspace_root: workspaceRoot2,
      root_plan_id: string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/),
      root_plan: string().min(1).max(25e4).optional(),
      artifacts: array(artifact2).min(1).max(32).optional(),
      artifact_kind: _enum(["delivery-evidence", "work-review"]).default("delivery-evidence"),
      review_input: reviewInputTransportSchema.optional(),
      effective_profile: _enum(["manual", "supervised", "autonomous"]).default("manual"),
      strategy_revision: number().int().min(0).default(0),
      changed_paths: array(string().min(1).max(1e3)).max(1e3).default([]),
      check_evidence: array(checkEvidence2).max(128).default([]),
      summary: string().min(1).max(2e3).optional(),
      repository_snapshot: object({
        head: string().min(1).optional(),
        working_tree: string().min(1).optional(),
        relevant_fingerprints: string().min(1).optional(),
        known_failures: string().min(1).optional()
      }).optional()
    }
  },
  workflow_status: {
    description: "Return current status and a uniform read-only learning projection for one preparation, adaptive run, or explicit/uniquely active stateless manual schema-5 artifact chain; controller learning authority requires the ephemeral source receipt from an operational response, and Workflow-3/4 subjects remain read-only.",
    inputSchema: {
      ...subject,
      root_plan_id: string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/).optional(),
      learning_source_receipt: string().min(1).max(2e3).optional(),
      manual_acceptance: _enum(["provisional"]).optional(),
      artifacts: array(artifact2).min(1).max(32).optional()
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
      workspace_root: workspaceRoot2,
      run_id: string().min(1),
      answer: string().min(1),
      expected_revision: number().int().min(0),
      idempotency_key: string().min(8)
    }
  },
  workflow_validate_models: {
    description: "Validate ordered pools of concrete approved model candidates against the live Cursor catalog.",
    inputSchema: { workspace_root: workspaceRoot2, route_profile: string().min(1).default("default") }
  },
  workflow_verification_profile: {
    description: "Draft, inspect, prove, approve, or audit one hash-bound project verification profile.",
    inputSchema: {
      workspace_root: workspaceRoot2,
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
  return { ...contract, annotations: toolAnnotations(name) };
}

// src/mcp/workflow-mcp.mjs
var pluginRoot = resolve4(process.env.CURSOR_PLUGIN_ROOT ?? dirname2(dirname2(fileURLToPath2(import.meta.url))));
var server = new McpServer({ name: "workflow", version: PLUGIN_VERSION });
var workspaceAuthority = new WorkspaceRootAuthority(() => server.server.listRoots());
var learningSourceReceipts = createLearningSourceReceiptAuthority();
server.server.setNotificationHandler(RootsListChangedNotificationSchema, async () => workspaceAuthority.invalidate());
function result(value, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value, isError };
}
function failure(error) {
  return result({
    error: error.message,
    ...error instanceof WorkspaceRootError ? { error_code: error.code } : {}
  }, true);
}
function proofResult(text) {
  const source = String(text ?? "");
  const fenced = source.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const value = JSON.parse(fenced ?? source.slice(source.indexOf("{"), source.lastIndexOf("}") + 1));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("verification proof returned no object");
  return value;
}
async function context(workspaceRoot3) {
  const workspace = await workspaceAuthority.resolve(workspaceRoot3);
  const stateRoot = defaultStateRoot(workspace);
  const store = new RunStore(stateRoot);
  const preparationStore = new PreparationStore(stateRoot);
  const engine = new WorkflowEngine({ workspaceRoot: workspace, store, preparationStore, pluginRoot, stateRoot });
  const planningEngine = new PlanningEngine({ workspaceRoot: workspace, store: preparationStore, pluginRoot, stateRoot });
  return { workspace, stateRoot, store, preparationStore, engine, planningEngine };
}
var manualTools = registerManualWorkflowTools({
  server,
  pluginRoot,
  workspaceAuthority,
  operationalStateRoot: defaultStateRoot,
  handoffStateRoot: sharedArtifactStateRoot,
  result,
  failure,
  includeStatus: false,
  contract: toolContract
});
function runnerPath() {
  return resolve4(process.env.GELDMACHER_WORKFLOW_RUNNER ?? fileURLToPath2(new URL("./workflow-runner.mjs", import.meta.url)));
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
    if ((input.root_artifacts ?? []).reduce((total, artifact3) => total + artifact3.text.length, 0) > 1e6) throw new Error("workflow_prepare root_artifacts exceed 1000000 characters");
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
    return failure(error);
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
    return result({
      run: runView(run),
      snapshot: engine.snapshot(run),
      preparation: preparationView(started.preparation),
      learning_source_receipt: learningSourceReceipts.issue(run),
      duplicate: started.duplicate
    });
  } catch (error) {
    return failure(error);
  }
});
server.registerTool("workflow_status", toolContract("workflow_status"), async (input) => {
  try {
    const subjectCount = [input.run_id, input.preparation_id, input.root_plan_id].filter(Boolean).length;
    if (subjectCount > 1) throw new Error("workflow_status accepts only one of run_id, preparation_id, or root_plan_id");
    if (input.artifacts && (input.run_id || input.preparation_id)) throw new Error("workflow_status artifacts cannot be combined with a controller subject");
    if (input.artifacts && input.learning_source_receipt) throw new Error("manual workflow_status does not accept a controller learning source receipt");
    if (input.root_plan_id && !input.artifacts) throw new Error("manual workflow_status requires artifacts with root_plan_id");
    if (input.artifacts) return manualTools.status(input);
    if (input.manual_acceptance) throw new Error("workflow_status manual_acceptance requires current-task artifacts");
    const { workspace, stateRoot, store, preparationStore, engine } = await context(input.workspace_root);
    const model_inheritance = modelInheritanceSummary(stateRoot);
    if (input.run_id) {
      const run = store.get(input.run_id);
      const sourceBinding = learningSourceReceipts.verify(input.learning_source_receipt, run);
      return result({
        subject_kind: "run",
        run: runView(run),
        snapshot: engine.snapshot(run),
        learning: deriveControllerLearningContext({ run, events: store.events(run.run_id), workspaceRoot: workspace, pluginRoot, sourceBinding }),
        model_inheritance
      });
    }
    if (input.preparation_id) {
      const preparation = preparationStore.get(input.preparation_id);
      return result({ subject_kind: "preparation", preparation: preparationView(preparation), learning: derivePreparationLearningContext(preparation), model_inheritance });
    }
    const active = [
      ...store.active().map((run) => ({ kind: "run", value: run })),
      ...preparationStore.active().map((preparation) => ({ kind: "preparation", value: preparation }))
    ];
    if (active.length === 0) throw new Error("no active Workflow Preparation or Run");
    if (active.length > 1) throw new Error("multiple active Workflow subjects require an explicit ID");
    if (active[0].kind === "run") {
      const sourceBinding = learningSourceReceipts.verify(input.learning_source_receipt, active[0].value);
      return result({
        subject_kind: "run",
        run: runView(active[0].value),
        snapshot: engine.snapshot(active[0].value),
        learning: deriveControllerLearningContext({ run: active[0].value, events: store.events(active[0].value.run_id), workspaceRoot: workspace, pluginRoot, sourceBinding }),
        model_inheritance
      });
    }
    return result({ subject_kind: "preparation", preparation: preparationView(active[0].value), learning: derivePreparationLearningContext(active[0].value), model_inheritance });
  } catch (error) {
    return failure(error);
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
    return failure(error);
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
    return result({ subject_kind: "run", run: runView(run), snapshot: engine.snapshot(run), learning_source_receipt: learningSourceReceipts.issue(run), duplicate: mutation.duplicate });
  } catch (error) {
    return failure(error);
  }
});
server.registerTool("workflow_answer", toolContract("workflow_answer"), async (input) => {
  try {
    const { store, engine } = await context(input.workspace_root);
    const mutation = idempotentRunMutation(store, input.run_id, input.expected_revision, input.idempotency_key, (before) => {
      if (before.lifecycle !== "waiting-human") throw new Error("run is not waiting for a human answer");
      engine.update(input.run_id, (draft) => ({ ...draft, answers: [...draft.answers ?? [], { at: (/* @__PURE__ */ new Date()).toISOString(), answer: input.answer }], blockers: [], next_action: "replan" }), "answer-recorded");
    });
    return result({ run: runView(mutation.value), snapshot: engine.snapshot(mutation.value), learning_source_receipt: learningSourceReceipts.issue(mutation.value), duplicate: mutation.duplicate });
  } catch (error) {
    return failure(error);
  }
});
server.registerTool("workflow_validate_models", toolContract("workflow_validate_models"), async ({ workspace_root, route_profile }) => {
  try {
    const { workspace, stateRoot } = await context(workspace_root);
    const config = loadWorkflowConfig(workspace);
    if (config.errors.length > 0) return result({ verified: false, errors: config.errors, capabilities: resolveCapabilities(stateRoot, {}, { pluginRoot }) });
    const profile = resolveRouteProfile(config, route_profile);
    const validation = new CursorWorkerAdapter({ runDirectory: resolve4(stateRoot, "model-validation"), pluginRoot }).validateProfile(profile);
    return result({ ...validation, capabilities: resolveCapabilities(stateRoot, { model_catalog_verified: validation.verified }, { pluginRoot }) });
  } catch (error) {
    return result({
      verified: false,
      errors: [error.message],
      ...error instanceof WorkspaceRootError ? { error_code: error.code } : {}
    }, true);
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
      const proofRoot = join4(stateRoot, "verification-proof-artifacts", inspection.profile_hash, randomUUID());
      ownedProofRoot = proofRoot;
      mkdirSync2(proofRoot, { recursive: true, mode: 448 });
      const adapter = new CursorWorkerAdapter({ runDirectory: join4(stateRoot, "verification-proof-runs", inspection.profile_hash), pluginRoot });
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
        evidence_hashes: artifacts.map((artifact3) => artifact3.hash),
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
    return failure(error);
  } finally {
    if (ownedProofRoot && !retainProof) rmSync2(ownedProofRoot, { recursive: true, force: true });
  }
});
var transport = new StdioServerTransport();
await server.connect(transport);
