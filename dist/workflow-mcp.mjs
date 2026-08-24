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
  deriveRepositoryDelta,
  deriveWorkflowState,
  evidenceRepositorySnapshot,
  invalidateManualCheckReceipts,
  loadManualCheckReceipts,
  manualConstraintProjection,
  manualReceiptHash,
  persistCloseout,
  persistWorkReview,
  readManualReceiptRecord,
  repositorySnapshotFingerprint,
  repositorySnapshotHash,
  stableManualReceiptJson,
  validateConsumedNativeReviewReceipt
} from "./chunks/chunk-2WPDU2XE.mjs";
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
} from "./chunks/chunk-5NFZA76G.mjs";
import {
  PlanningEngine,
  approveVerificationProfile,
  auditVerificationProfile,
  draftVerificationProfile,
  inspectVerificationProfile,
  recordVerificationProof,
  resolveCapabilities
} from "./chunks/chunk-M7ERKP7Q.mjs";
import {
  loadWorkflowConfig,
  resolveRouteProfile
} from "./chunks/chunk-QB5KAHPL.mjs";
import {
  CursorWorkerAdapter
} from "./chunks/chunk-7SYGAAH5.mjs";
import "./chunks/chunk-FTS4RQ3D.mjs";
import {
  ArtifactHandoffStore,
  createContentAddressedHandoffStore,
  rememberContentAddressedRoot,
  resolveRootPlanText
} from "./chunks/chunk-TQFRRM3Y.mjs";
import {
  effectiveCliSummary,
  executionContractFromArtifactText,
  inspectArtifactSet,
  inspectArtifactText,
  preflightRootPlan
} from "./chunks/chunk-3CKZRPWU.mjs";
import {
  PreparationStore,
  RunStore,
  defaultHostPreferencesPath,
  defaultStateRoot,
  parsePreferenceYaml,
  resolveHostToolApproval,
  rootContentHash,
  sharedArtifactStateRoot
} from "./chunks/chunk-7JUFD6FK.mjs";
import {
  PLUGIN_VERSION,
  assertCompatibleRun,
  preparationView,
  runView
} from "./chunks/chunk-7NHOTGTA.mjs";
import "./chunks/chunk-WU6JOB3C.mjs";

// src/mcp/workflow-mcp.mjs
import { spawn } from "node:child_process";
import { randomUUID as randomUUID2 } from "node:crypto";
import { mkdirSync as mkdirSync3, rmSync as rmSync2 } from "node:fs";
import { dirname as dirname4, join as join5, resolve as resolve6 } from "node:path";
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
    let clientCapabilities = this._server.getClientCapabilities();
    if ((params.tools || params.toolChoice) && !clientCapabilities?.sampling?.tools)
      throw new Error("Client does not support sampling tools capability.");
    if (params.messages.length > 0) {
      let lastMessage = params.messages[params.messages.length - 1], lastContent = Array.isArray(lastMessage.content) ? lastMessage.content : [lastMessage.content], hasToolResults = lastContent.some((c) => c.type === "tool_result"), previousMessage = params.messages.length > 1 ? params.messages[params.messages.length - 2] : void 0, previousContent = previousMessage ? Array.isArray(previousMessage.content) ? previousMessage.content : [previousMessage.content] : [], hasPreviousToolUse = previousContent.some((c) => c.type === "tool_use");
      if (hasToolResults) {
        if (lastContent.some((c) => c.type !== "tool_result"))
          throw new Error("The last message must contain only tool_result content if any is present");
        if (!hasPreviousToolUse)
          throw new Error("tool_result blocks are not matching any tool_use from the previous message");
      }
      if (hasPreviousToolUse) {
        let toolUseIds = new Set(previousContent.filter((c) => c.type === "tool_use").map((c) => c.id)), toolResultIds = new Set(lastContent.filter((c) => c.type === "tool_result").map((c) => c.toolUseId));
        if (toolUseIds.size !== toolResultIds.size || ![...toolUseIds].every((id) => toolResultIds.has(id)))
          throw new Error("ids of tool_result blocks and tool_use blocks from previous message do not match");
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
    let clientCapabilities = this._server.getClientCapabilities(), mode = params.mode ?? "form";
    switch (mode) {
      case "url": {
        if (!clientCapabilities?.elicitation?.url)
          throw new Error("Client does not support url elicitation.");
        break;
      }
      case "form": {
        if (!clientCapabilities?.elicitation?.form)
          throw new Error("Client does not support form elicitation.");
        break;
      }
    }
    let normalizedParams = mode === "form" && params.mode === void 0 ? { ...params, mode: "form" } : params;
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
    super(options), this._serverInfo = _serverInfo, this._loggingLevels = /* @__PURE__ */ new Map(), this.LOG_LEVEL_SEVERITY = new Map(LoggingLevelSchema.options.map((level, index) => [level, index])), this.isMessageIgnored = (level, sessionId) => {
      let currentLevel = this._loggingLevels.get(sessionId);
      return currentLevel ? this.LOG_LEVEL_SEVERITY.get(level) < this.LOG_LEVEL_SEVERITY.get(currentLevel) : !1;
    }, this._capabilities = options?.capabilities ?? {}, this._instructions = options?.instructions, this._jsonSchemaValidator = options?.jsonSchemaValidator ?? new AjvJsonSchemaValidator(), this.setRequestHandler(InitializeRequestSchema, (request) => this._oninitialize(request)), this.setNotificationHandler(InitializedNotificationSchema, () => this.oninitialized?.()), this._capabilities.logging && this.setRequestHandler(SetLevelRequestSchema, async (request, extra) => {
      let transportSessionId = extra.sessionId || extra.requestInfo?.headers["mcp-session-id"] || void 0, { level } = request.params, parseResult = LoggingLevelSchema.safeParse(level);
      return parseResult.success && this._loggingLevels.set(transportSessionId, parseResult.data), {};
    });
  }
  /**
   * Access experimental features.
   *
   * WARNING: These APIs are experimental and may change without notice.
   *
   * @experimental
   */
  get experimental() {
    return this._experimental || (this._experimental = {
      tasks: new ExperimentalServerTasks(this)
    }), this._experimental;
  }
  /**
   * Registers new capabilities. This can only be called before connecting to a transport.
   *
   * The new capabilities will be merged with any existing capabilities previously given (e.g., at initialization).
   */
  registerCapabilities(capabilities) {
    if (this.transport)
      throw new Error("Cannot register capabilities after connecting to transport");
    this._capabilities = mergeCapabilities(this._capabilities, capabilities);
  }
  /**
   * Override request handler registration to enforce server-side validation for tools/call.
   */
  setRequestHandler(requestSchema, handler) {
    let methodSchema = getObjectShape(requestSchema)?.method;
    if (!methodSchema)
      throw new Error("Schema is missing a method literal");
    let methodValue = getLiteralValue(methodSchema);
    if (typeof methodValue != "string")
      throw new Error("Schema method literal must be a string");
    if (methodValue === "tools/call") {
      let wrappedHandler = async (request, extra) => {
        let validatedRequest = safeParse(CallToolRequestSchema, request);
        if (!validatedRequest.success) {
          let errorMessage = validatedRequest.error instanceof Error ? validatedRequest.error.message : String(validatedRequest.error);
          throw new McpError(ErrorCode.InvalidParams, `Invalid tools/call request: ${errorMessage}`);
        }
        let { params } = validatedRequest.data, result2 = await Promise.resolve(handler(request, extra));
        if (params.task) {
          let taskValidationResult = safeParse(CreateTaskResultSchema, result2);
          if (!taskValidationResult.success) {
            let errorMessage = taskValidationResult.error instanceof Error ? taskValidationResult.error.message : String(taskValidationResult.error);
            throw new McpError(ErrorCode.InvalidParams, `Invalid task creation result: ${errorMessage}`);
          }
          return taskValidationResult.data;
        }
        let validationResult = safeParse(CallToolResultSchema, result2);
        if (!validationResult.success) {
          let errorMessage = validationResult.error instanceof Error ? validationResult.error.message : String(validationResult.error);
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
        if (!this._clientCapabilities?.sampling)
          throw new Error(`Client does not support sampling (required for ${method})`);
        break;
      case "elicitation/create":
        if (!this._clientCapabilities?.elicitation)
          throw new Error(`Client does not support elicitation (required for ${method})`);
        break;
      case "roots/list":
        if (!this._clientCapabilities?.roots)
          throw new Error(`Client does not support listing roots (required for ${method})`);
        break;
      case "ping":
        break;
    }
  }
  assertNotificationCapability(method) {
    switch (method) {
      case "notifications/message":
        if (!this._capabilities.logging)
          throw new Error(`Server does not support logging (required for ${method})`);
        break;
      case "notifications/resources/updated":
      case "notifications/resources/list_changed":
        if (!this._capabilities.resources)
          throw new Error(`Server does not support notifying about resources (required for ${method})`);
        break;
      case "notifications/tools/list_changed":
        if (!this._capabilities.tools)
          throw new Error(`Server does not support notifying of tool list changes (required for ${method})`);
        break;
      case "notifications/prompts/list_changed":
        if (!this._capabilities.prompts)
          throw new Error(`Server does not support notifying of prompt list changes (required for ${method})`);
        break;
      case "notifications/elicitation/complete":
        if (!this._clientCapabilities?.elicitation?.url)
          throw new Error(`Client does not support URL elicitation (required for ${method})`);
        break;
      case "notifications/cancelled":
        break;
      case "notifications/progress":
        break;
    }
  }
  assertRequestHandlerCapability(method) {
    if (this._capabilities)
      switch (method) {
        case "completion/complete":
          if (!this._capabilities.completions)
            throw new Error(`Server does not support completions (required for ${method})`);
          break;
        case "logging/setLevel":
          if (!this._capabilities.logging)
            throw new Error(`Server does not support logging (required for ${method})`);
          break;
        case "prompts/get":
        case "prompts/list":
          if (!this._capabilities.prompts)
            throw new Error(`Server does not support prompts (required for ${method})`);
          break;
        case "resources/list":
        case "resources/templates/list":
        case "resources/read":
          if (!this._capabilities.resources)
            throw new Error(`Server does not support resources (required for ${method})`);
          break;
        case "tools/call":
        case "tools/list":
          if (!this._capabilities.tools)
            throw new Error(`Server does not support tools (required for ${method})`);
          break;
        case "tasks/get":
        case "tasks/list":
        case "tasks/result":
        case "tasks/cancel":
          if (!this._capabilities.tasks)
            throw new Error(`Server does not support tasks capability (required for ${method})`);
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
    this._capabilities && assertToolsCallTaskCapability(this._capabilities.tasks?.requests, method, "Server");
  }
  async _oninitialize(request) {
    let requestedVersion = request.params.protocolVersion;
    return this._clientCapabilities = request.params.capabilities, this._clientVersion = request.params.clientInfo, {
      protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion) ? requestedVersion : LATEST_PROTOCOL_VERSION,
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
    if ((params.tools || params.toolChoice) && !this._clientCapabilities?.sampling?.tools)
      throw new Error("Client does not support sampling tools capability.");
    if (params.messages.length > 0) {
      let lastMessage = params.messages[params.messages.length - 1], lastContent = Array.isArray(lastMessage.content) ? lastMessage.content : [lastMessage.content], hasToolResults = lastContent.some((c) => c.type === "tool_result"), previousMessage = params.messages.length > 1 ? params.messages[params.messages.length - 2] : void 0, previousContent = previousMessage ? Array.isArray(previousMessage.content) ? previousMessage.content : [previousMessage.content] : [], hasPreviousToolUse = previousContent.some((c) => c.type === "tool_use");
      if (hasToolResults) {
        if (lastContent.some((c) => c.type !== "tool_result"))
          throw new Error("The last message must contain only tool_result content if any is present");
        if (!hasPreviousToolUse)
          throw new Error("tool_result blocks are not matching any tool_use from the previous message");
      }
      if (hasPreviousToolUse) {
        let toolUseIds = new Set(previousContent.filter((c) => c.type === "tool_use").map((c) => c.id)), toolResultIds = new Set(lastContent.filter((c) => c.type === "tool_result").map((c) => c.toolUseId));
        if (toolUseIds.size !== toolResultIds.size || ![...toolUseIds].every((id) => toolResultIds.has(id)))
          throw new Error("ids of tool_result blocks and tool_use blocks from previous message do not match");
      }
    }
    return params.tools ? this.request({ method: "sampling/createMessage", params }, CreateMessageResultWithToolsSchema, options) : this.request({ method: "sampling/createMessage", params }, CreateMessageResultSchema, options);
  }
  /**
   * Creates an elicitation request for the given parameters.
   * For backwards compatibility, `mode` may be omitted for form requests and will default to `'form'`.
   * @param params The parameters for the elicitation request.
   * @param options Optional request options.
   * @returns The result of the elicitation request.
   */
  async elicitInput(params, options) {
    switch (params.mode ?? "form") {
      case "url": {
        if (!this._clientCapabilities?.elicitation?.url)
          throw new Error("Client does not support url elicitation.");
        let urlParams = params;
        return this.request({ method: "elicitation/create", params: urlParams }, ElicitResultSchema, options);
      }
      case "form": {
        if (!this._clientCapabilities?.elicitation?.form)
          throw new Error("Client does not support form elicitation.");
        let formParams = params.mode === "form" ? params : { ...params, mode: "form" }, result2 = await this.request({ method: "elicitation/create", params: formParams }, ElicitResultSchema, options);
        if (result2.action === "accept" && result2.content && formParams.requestedSchema)
          try {
            let validationResult = this._jsonSchemaValidator.getValidator(formParams.requestedSchema)(result2.content);
            if (!validationResult.valid)
              throw new McpError(ErrorCode.InvalidParams, `Elicitation response content does not match requested schema: ${validationResult.errorMessage}`);
          } catch (error) {
            throw error instanceof McpError ? error : new McpError(ErrorCode.InternalError, `Error validating elicitation response: ${error instanceof Error ? error.message : String(error)}`);
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
    if (!this._clientCapabilities?.elicitation?.url)
      throw new Error("Client does not support URL elicitation (required for notifications/elicitation/complete)");
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
    if (this._capabilities.logging && !this.isMessageIgnored(params.level, sessionId))
      return this.notification({ method: "notifications/message", params });
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
  return !!schema && typeof schema == "object" && COMPLETABLE_SYMBOL in schema;
}
function getCompleter(schema) {
  return schema[COMPLETABLE_SYMBOL]?.complete;
}
var McpZodTypeKind;
(function(McpZodTypeKind2) {
  McpZodTypeKind2.Completable = "McpCompletable";
})(McpZodTypeKind || (McpZodTypeKind = {}));

// node_modules/@modelcontextprotocol/sdk/dist/esm/shared/toolNameValidation.js
var TOOL_NAME_REGEX = /^[A-Za-z0-9._-]{1,128}$/;
function validateToolName(name) {
  let warnings = [];
  if (name.length === 0)
    return {
      isValid: !1,
      warnings: ["Tool name cannot be empty"]
    };
  if (name.length > 128)
    return {
      isValid: !1,
      warnings: [`Tool name exceeds maximum length of 128 characters (current: ${name.length})`]
    };
  if (name.includes(" ") && warnings.push("Tool name contains spaces, which may cause parsing issues"), name.includes(",") && warnings.push("Tool name contains commas, which may cause parsing issues"), (name.startsWith("-") || name.endsWith("-")) && warnings.push("Tool name starts or ends with a dash, which may cause parsing issues in some contexts"), (name.startsWith(".") || name.endsWith(".")) && warnings.push("Tool name starts or ends with a dot, which may cause parsing issues in some contexts"), !TOOL_NAME_REGEX.test(name)) {
    let invalidChars = name.split("").filter((char) => !/[A-Za-z0-9._-]/.test(char)).filter((char, index, arr) => arr.indexOf(char) === index);
    return warnings.push(`Tool name contains invalid characters: ${invalidChars.map((c) => `"${c}"`).join(", ")}`, "Allowed characters are: A-Z, a-z, 0-9, underscore (_), dash (-), and dot (.)"), {
      isValid: !1,
      warnings
    };
  }
  return {
    isValid: !0,
    warnings
  };
}
function issueToolNameWarning(name, warnings) {
  if (warnings.length > 0) {
    console.warn(`Tool name validation warning for "${name}":`);
    for (let warning of warnings)
      console.warn(`  - ${warning}`);
    console.warn("Tool registration will proceed, but this may cause compatibility issues."), console.warn("Consider updating the tool name to conform to the MCP tool naming standard."), console.warn("See SEP: Specify Format for Tool Names (https://github.com/modelcontextprotocol/modelcontextprotocol/issues/986) for more details.");
  }
}
function validateAndWarnToolName(name) {
  let result2 = validateToolName(name);
  return issueToolNameWarning(name, result2.warnings), result2.isValid;
}

// node_modules/@modelcontextprotocol/sdk/dist/esm/experimental/tasks/mcp-server.js
var ExperimentalMcpServerTasks = class {
  constructor(_mcpServer) {
    this._mcpServer = _mcpServer;
  }
  registerToolTask(name, config, handler) {
    let execution = { taskSupport: "required", ...config.execution };
    if (execution.taskSupport === "forbidden")
      throw new Error(`Cannot register task-based tool '${name}' with taskSupport 'forbidden'. Use registerTool() instead.`);
    return this._mcpServer._createRegisteredTool(name, config.title, config.description, config.inputSchema, config.outputSchema, config.annotations, execution, config._meta, handler);
  }
};

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js
var McpServer = class {
  constructor(serverInfo, options) {
    this._registeredResources = {}, this._registeredResourceTemplates = {}, this._registeredTools = {}, this._registeredPrompts = {}, this._toolHandlersInitialized = !1, this._completionHandlerInitialized = !1, this._resourceHandlersInitialized = !1, this._promptHandlersInitialized = !1, this.server = new Server(serverInfo, options);
  }
  /**
   * Access experimental features.
   *
   * WARNING: These APIs are experimental and may change without notice.
   *
   * @experimental
   */
  get experimental() {
    return this._experimental || (this._experimental = {
      tasks: new ExperimentalMcpServerTasks(this)
    }), this._experimental;
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
    this._toolHandlersInitialized || (this.server.assertCanSetRequestHandler(getMethodValue(ListToolsRequestSchema)), this.server.assertCanSetRequestHandler(getMethodValue(CallToolRequestSchema)), this.server.registerCapabilities({
      tools: {
        listChanged: !0
      }
    }), this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: Object.entries(this._registeredTools).filter(([, tool]) => tool.enabled).map(([name, tool]) => {
        let toolDefinition = {
          name,
          title: tool.title,
          description: tool.description,
          inputSchema: (() => {
            let obj = normalizeObjectSchema(tool.inputSchema);
            return obj ? toJsonSchemaCompat(obj, {
              strictUnions: !0,
              pipeStrategy: "input"
            }) : EMPTY_OBJECT_JSON_SCHEMA;
          })(),
          annotations: tool.annotations,
          execution: tool.execution,
          _meta: tool._meta
        };
        if (tool.outputSchema) {
          let obj = normalizeObjectSchema(tool.outputSchema);
          obj && (toolDefinition.outputSchema = toJsonSchemaCompat(obj, {
            strictUnions: !0,
            pipeStrategy: "output"
          }));
        }
        return toolDefinition;
      })
    })), this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      try {
        let tool = this._registeredTools[request.params.name];
        if (!tool)
          throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} not found`);
        if (!tool.enabled)
          throw new McpError(ErrorCode.InvalidParams, `Tool ${request.params.name} disabled`);
        let isTaskRequest = !!request.params.task, taskSupport = tool.execution?.taskSupport, isTaskHandler = "createTask" in tool.handler;
        if ((taskSupport === "required" || taskSupport === "optional") && !isTaskHandler)
          throw new McpError(ErrorCode.InternalError, `Tool ${request.params.name} has taskSupport '${taskSupport}' but was not registered with registerToolTask`);
        if (taskSupport === "required" && !isTaskRequest)
          throw new McpError(ErrorCode.MethodNotFound, `Tool ${request.params.name} requires task augmentation (taskSupport: 'required')`);
        if (taskSupport === "optional" && !isTaskRequest && isTaskHandler)
          return await this.handleAutomaticTaskPolling(tool, request, extra);
        let args = await this.validateToolInput(tool, request.params.arguments, request.params.name), result2 = await this.executeToolHandler(tool, args, extra);
        return isTaskRequest || await this.validateToolOutput(tool, result2, request.params.name), result2;
      } catch (error) {
        if (error instanceof McpError && error.code === ErrorCode.UrlElicitationRequired)
          throw error;
        return this.createToolError(error instanceof Error ? error.message : String(error));
      }
    }), this._toolHandlersInitialized = !0);
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
      isError: !0
    };
  }
  /**
   * Validates tool input arguments against the tool's input schema.
   */
  async validateToolInput(tool, args, toolName) {
    if (!tool.inputSchema)
      return;
    let schemaToParse = normalizeObjectSchema(tool.inputSchema) ?? tool.inputSchema, parseResult = await safeParseAsync(schemaToParse, args);
    if (!parseResult.success) {
      let error = "error" in parseResult ? parseResult.error : "Unknown error", errorMessage = getParseErrorMessage(error);
      throw new McpError(ErrorCode.InvalidParams, `Input validation error: Invalid arguments for tool ${toolName}: ${errorMessage}`);
    }
    return parseResult.data;
  }
  /**
   * Validates tool output against the tool's output schema.
   */
  async validateToolOutput(tool, result2, toolName) {
    if (!tool.outputSchema || !("content" in result2) || result2.isError)
      return;
    if (!result2.structuredContent)
      throw new McpError(ErrorCode.InvalidParams, `Output validation error: Tool ${toolName} has an output schema but no structured content was provided`);
    let outputObj = normalizeObjectSchema(tool.outputSchema), parseResult = await safeParseAsync(outputObj, result2.structuredContent);
    if (!parseResult.success) {
      let error = "error" in parseResult ? parseResult.error : "Unknown error", errorMessage = getParseErrorMessage(error);
      throw new McpError(ErrorCode.InvalidParams, `Output validation error: Invalid structured content for tool ${toolName}: ${errorMessage}`);
    }
  }
  /**
   * Executes a tool handler (either regular or task-based).
   */
  async executeToolHandler(tool, args, extra) {
    let handler = tool.handler;
    if ("createTask" in handler) {
      if (!extra.taskStore)
        throw new Error("No task store provided.");
      let taskExtra = { ...extra, taskStore: extra.taskStore };
      if (tool.inputSchema) {
        let typedHandler = handler;
        return await Promise.resolve(typedHandler.createTask(args, taskExtra));
      } else {
        let typedHandler = handler;
        return await Promise.resolve(typedHandler.createTask(taskExtra));
      }
    }
    if (tool.inputSchema) {
      let typedHandler = handler;
      return await Promise.resolve(typedHandler(args, extra));
    } else {
      let typedHandler = handler;
      return await Promise.resolve(typedHandler(extra));
    }
  }
  /**
   * Handles automatic task polling for tools with taskSupport 'optional'.
   */
  async handleAutomaticTaskPolling(tool, request, extra) {
    if (!extra.taskStore)
      throw new Error("No task store provided for task-capable tool.");
    let args = await this.validateToolInput(tool, request.params.arguments, request.params.name), handler = tool.handler, taskExtra = { ...extra, taskStore: extra.taskStore }, createTaskResult = args ? await Promise.resolve(handler.createTask(args, taskExtra)) : (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Promise.resolve(handler.createTask(taskExtra))
    ), taskId = createTaskResult.task.taskId, task = createTaskResult.task, pollInterval = task.pollInterval ?? 5e3;
    for (; task.status !== "completed" && task.status !== "failed" && task.status !== "cancelled"; ) {
      await new Promise((resolve7) => setTimeout(resolve7, pollInterval));
      let updatedTask = await extra.taskStore.getTask(taskId);
      if (!updatedTask)
        throw new McpError(ErrorCode.InternalError, `Task ${taskId} not found during polling`);
      task = updatedTask;
    }
    return await extra.taskStore.getTaskResult(taskId);
  }
  setCompletionRequestHandler() {
    this._completionHandlerInitialized || (this.server.assertCanSetRequestHandler(getMethodValue(CompleteRequestSchema)), this.server.registerCapabilities({
      completions: {}
    }), this.server.setRequestHandler(CompleteRequestSchema, async (request) => {
      switch (request.params.ref.type) {
        case "ref/prompt":
          return assertCompleteRequestPrompt(request), this.handlePromptCompletion(request, request.params.ref);
        case "ref/resource":
          return assertCompleteRequestResourceTemplate(request), this.handleResourceCompletion(request, request.params.ref);
        default:
          throw new McpError(ErrorCode.InvalidParams, `Invalid completion reference: ${request.params.ref}`);
      }
    }), this._completionHandlerInitialized = !0);
  }
  async handlePromptCompletion(request, ref) {
    let prompt = this._registeredPrompts[ref.name];
    if (!prompt)
      throw new McpError(ErrorCode.InvalidParams, `Prompt ${ref.name} not found`);
    if (!prompt.enabled)
      throw new McpError(ErrorCode.InvalidParams, `Prompt ${ref.name} disabled`);
    if (!prompt.argsSchema)
      return EMPTY_COMPLETION_RESULT;
    let field = getObjectShape(prompt.argsSchema)?.[request.params.argument.name];
    if (!isCompletable(field))
      return EMPTY_COMPLETION_RESULT;
    let completer = getCompleter(field);
    if (!completer)
      return EMPTY_COMPLETION_RESULT;
    let suggestions = await completer(request.params.argument.value, request.params.context);
    return createCompletionResult(suggestions);
  }
  async handleResourceCompletion(request, ref) {
    let template = Object.values(this._registeredResourceTemplates).find((t) => t.resourceTemplate.uriTemplate.toString() === ref.uri);
    if (!template) {
      if (this._registeredResources[ref.uri])
        return EMPTY_COMPLETION_RESULT;
      throw new McpError(ErrorCode.InvalidParams, `Resource template ${request.params.ref.uri} not found`);
    }
    let completer = template.resourceTemplate.completeCallback(request.params.argument.name);
    if (!completer)
      return EMPTY_COMPLETION_RESULT;
    let suggestions = await completer(request.params.argument.value, request.params.context);
    return createCompletionResult(suggestions);
  }
  setResourceRequestHandlers() {
    this._resourceHandlersInitialized || (this.server.assertCanSetRequestHandler(getMethodValue(ListResourcesRequestSchema)), this.server.assertCanSetRequestHandler(getMethodValue(ListResourceTemplatesRequestSchema)), this.server.assertCanSetRequestHandler(getMethodValue(ReadResourceRequestSchema)), this.server.registerCapabilities({
      resources: {
        listChanged: !0
      }
    }), this.server.setRequestHandler(ListResourcesRequestSchema, async (request, extra) => {
      let resources = Object.entries(this._registeredResources).filter(([_, resource]) => resource.enabled).map(([uri, resource]) => ({
        uri,
        name: resource.name,
        ...resource.metadata
      })), templateResources = [];
      for (let template of Object.values(this._registeredResourceTemplates)) {
        if (!template.resourceTemplate.listCallback)
          continue;
        let result2 = await template.resourceTemplate.listCallback(extra);
        for (let resource of result2.resources)
          templateResources.push({
            ...template.metadata,
            // the defined resource metadata should override the template metadata if present
            ...resource
          });
      }
      return { resources: [...resources, ...templateResources] };
    }), this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: Object.entries(this._registeredResourceTemplates).map(([name, template]) => ({
      name,
      uriTemplate: template.resourceTemplate.uriTemplate.toString(),
      ...template.metadata
    })) })), this.server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) => {
      let uri = new URL(request.params.uri), resource = this._registeredResources[uri.toString()];
      if (resource) {
        if (!resource.enabled)
          throw new McpError(ErrorCode.InvalidParams, `Resource ${uri} disabled`);
        return resource.readCallback(uri, extra);
      }
      for (let template of Object.values(this._registeredResourceTemplates)) {
        let variables = template.resourceTemplate.uriTemplate.match(uri.toString());
        if (variables)
          return template.readCallback(uri, variables, extra);
      }
      throw new McpError(ErrorCode.InvalidParams, `Resource ${uri} not found`);
    }), this._resourceHandlersInitialized = !0);
  }
  setPromptRequestHandlers() {
    this._promptHandlersInitialized || (this.server.assertCanSetRequestHandler(getMethodValue(ListPromptsRequestSchema)), this.server.assertCanSetRequestHandler(getMethodValue(GetPromptRequestSchema)), this.server.registerCapabilities({
      prompts: {
        listChanged: !0
      }
    }), this.server.setRequestHandler(ListPromptsRequestSchema, () => ({
      prompts: Object.entries(this._registeredPrompts).filter(([, prompt]) => prompt.enabled).map(([name, prompt]) => ({
        name,
        title: prompt.title,
        description: prompt.description,
        arguments: prompt.argsSchema ? promptArgumentsFromSchema(prompt.argsSchema) : void 0
      }))
    })), this.server.setRequestHandler(GetPromptRequestSchema, async (request, extra) => {
      let prompt = this._registeredPrompts[request.params.name];
      if (!prompt)
        throw new McpError(ErrorCode.InvalidParams, `Prompt ${request.params.name} not found`);
      if (!prompt.enabled)
        throw new McpError(ErrorCode.InvalidParams, `Prompt ${request.params.name} disabled`);
      if (prompt.argsSchema) {
        let argsObj = normalizeObjectSchema(prompt.argsSchema), parseResult = await safeParseAsync(argsObj, request.params.arguments);
        if (!parseResult.success) {
          let error = "error" in parseResult ? parseResult.error : "Unknown error", errorMessage = getParseErrorMessage(error);
          throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for prompt ${request.params.name}: ${errorMessage}`);
        }
        let args = parseResult.data, cb = prompt.callback;
        return await Promise.resolve(cb(args, extra));
      } else {
        let cb = prompt.callback;
        return await Promise.resolve(cb(extra));
      }
    }), this._promptHandlersInitialized = !0);
  }
  resource(name, uriOrTemplate, ...rest) {
    let metadata;
    typeof rest[0] == "object" && (metadata = rest.shift());
    let readCallback = rest[0];
    if (typeof uriOrTemplate == "string") {
      if (this._registeredResources[uriOrTemplate])
        throw new Error(`Resource ${uriOrTemplate} is already registered`);
      let registeredResource = this._createRegisteredResource(name, void 0, uriOrTemplate, metadata, readCallback);
      return this.setResourceRequestHandlers(), this.sendResourceListChanged(), registeredResource;
    } else {
      if (this._registeredResourceTemplates[name])
        throw new Error(`Resource template ${name} is already registered`);
      let registeredResourceTemplate = this._createRegisteredResourceTemplate(name, void 0, uriOrTemplate, metadata, readCallback);
      return this.setResourceRequestHandlers(), this.sendResourceListChanged(), registeredResourceTemplate;
    }
  }
  registerResource(name, uriOrTemplate, config, readCallback) {
    if (typeof uriOrTemplate == "string") {
      if (this._registeredResources[uriOrTemplate])
        throw new Error(`Resource ${uriOrTemplate} is already registered`);
      let registeredResource = this._createRegisteredResource(name, config.title, uriOrTemplate, config, readCallback);
      return this.setResourceRequestHandlers(), this.sendResourceListChanged(), registeredResource;
    } else {
      if (this._registeredResourceTemplates[name])
        throw new Error(`Resource template ${name} is already registered`);
      let registeredResourceTemplate = this._createRegisteredResourceTemplate(name, config.title, uriOrTemplate, config, readCallback);
      return this.setResourceRequestHandlers(), this.sendResourceListChanged(), registeredResourceTemplate;
    }
  }
  _createRegisteredResource(name, title, uri, metadata, readCallback) {
    let registeredResource = {
      name,
      title,
      metadata,
      readCallback,
      enabled: !0,
      disable: () => registeredResource.update({ enabled: !1 }),
      enable: () => registeredResource.update({ enabled: !0 }),
      remove: () => registeredResource.update({ uri: null }),
      update: (updates) => {
        typeof updates.uri < "u" && updates.uri !== uri && (delete this._registeredResources[uri], updates.uri && (this._registeredResources[updates.uri] = registeredResource)), typeof updates.name < "u" && (registeredResource.name = updates.name), typeof updates.title < "u" && (registeredResource.title = updates.title), typeof updates.metadata < "u" && (registeredResource.metadata = updates.metadata), typeof updates.callback < "u" && (registeredResource.readCallback = updates.callback), typeof updates.enabled < "u" && (registeredResource.enabled = updates.enabled), this.sendResourceListChanged();
      }
    };
    return this._registeredResources[uri] = registeredResource, registeredResource;
  }
  _createRegisteredResourceTemplate(name, title, template, metadata, readCallback) {
    let registeredResourceTemplate = {
      resourceTemplate: template,
      title,
      metadata,
      readCallback,
      enabled: !0,
      disable: () => registeredResourceTemplate.update({ enabled: !1 }),
      enable: () => registeredResourceTemplate.update({ enabled: !0 }),
      remove: () => registeredResourceTemplate.update({ name: null }),
      update: (updates) => {
        typeof updates.name < "u" && updates.name !== name && (delete this._registeredResourceTemplates[name], updates.name && (this._registeredResourceTemplates[updates.name] = registeredResourceTemplate)), typeof updates.title < "u" && (registeredResourceTemplate.title = updates.title), typeof updates.template < "u" && (registeredResourceTemplate.resourceTemplate = updates.template), typeof updates.metadata < "u" && (registeredResourceTemplate.metadata = updates.metadata), typeof updates.callback < "u" && (registeredResourceTemplate.readCallback = updates.callback), typeof updates.enabled < "u" && (registeredResourceTemplate.enabled = updates.enabled), this.sendResourceListChanged();
      }
    };
    this._registeredResourceTemplates[name] = registeredResourceTemplate;
    let variableNames = template.uriTemplate.variableNames;
    return Array.isArray(variableNames) && variableNames.some((v) => !!template.completeCallback(v)) && this.setCompletionRequestHandler(), registeredResourceTemplate;
  }
  _createRegisteredPrompt(name, title, description, argsSchema, callback) {
    let registeredPrompt = {
      title,
      description,
      argsSchema: argsSchema === void 0 ? void 0 : objectFromShape(argsSchema),
      callback,
      enabled: !0,
      disable: () => registeredPrompt.update({ enabled: !1 }),
      enable: () => registeredPrompt.update({ enabled: !0 }),
      remove: () => registeredPrompt.update({ name: null }),
      update: (updates) => {
        typeof updates.name < "u" && updates.name !== name && (delete this._registeredPrompts[name], updates.name && (this._registeredPrompts[updates.name] = registeredPrompt)), typeof updates.title < "u" && (registeredPrompt.title = updates.title), typeof updates.description < "u" && (registeredPrompt.description = updates.description), typeof updates.argsSchema < "u" && (registeredPrompt.argsSchema = objectFromShape(updates.argsSchema)), typeof updates.callback < "u" && (registeredPrompt.callback = updates.callback), typeof updates.enabled < "u" && (registeredPrompt.enabled = updates.enabled), this.sendPromptListChanged();
      }
    };
    return this._registeredPrompts[name] = registeredPrompt, argsSchema && Object.values(argsSchema).some((field) => {
      let inner = field instanceof ZodOptional ? field._def?.innerType : field;
      return isCompletable(inner);
    }) && this.setCompletionRequestHandler(), registeredPrompt;
  }
  _createRegisteredTool(name, title, description, inputSchema, outputSchema, annotations3, execution, _meta, handler) {
    validateAndWarnToolName(name);
    let registeredTool = {
      title,
      description,
      inputSchema: getZodSchemaObject(inputSchema),
      outputSchema: getZodSchemaObject(outputSchema),
      annotations: annotations3,
      execution,
      _meta,
      handler,
      enabled: !0,
      disable: () => registeredTool.update({ enabled: !1 }),
      enable: () => registeredTool.update({ enabled: !0 }),
      remove: () => registeredTool.update({ name: null }),
      update: (updates) => {
        typeof updates.name < "u" && updates.name !== name && (typeof updates.name == "string" && validateAndWarnToolName(updates.name), delete this._registeredTools[name], updates.name && (this._registeredTools[updates.name] = registeredTool)), typeof updates.title < "u" && (registeredTool.title = updates.title), typeof updates.description < "u" && (registeredTool.description = updates.description), typeof updates.paramsSchema < "u" && (registeredTool.inputSchema = objectFromShape(updates.paramsSchema)), typeof updates.outputSchema < "u" && (registeredTool.outputSchema = objectFromShape(updates.outputSchema)), typeof updates.callback < "u" && (registeredTool.handler = updates.callback), typeof updates.annotations < "u" && (registeredTool.annotations = updates.annotations), typeof updates._meta < "u" && (registeredTool._meta = updates._meta), typeof updates.enabled < "u" && (registeredTool.enabled = updates.enabled), this.sendToolListChanged();
      }
    };
    return this._registeredTools[name] = registeredTool, this.setToolRequestHandlers(), this.sendToolListChanged(), registeredTool;
  }
  /**
   * tool() implementation. Parses arguments passed to overrides defined above.
   */
  tool(name, ...rest) {
    if (this._registeredTools[name])
      throw new Error(`Tool ${name} is already registered`);
    let description, inputSchema, outputSchema, annotations3;
    if (typeof rest[0] == "string" && (description = rest.shift()), rest.length > 1) {
      let firstArg = rest[0];
      if (isZodRawShapeCompat(firstArg))
        inputSchema = rest.shift(), rest.length > 1 && typeof rest[0] == "object" && rest[0] !== null && !isZodRawShapeCompat(rest[0]) && (annotations3 = rest.shift());
      else if (typeof firstArg == "object" && firstArg !== null) {
        if (Object.values(firstArg).some((v) => typeof v == "object" && v !== null))
          throw new Error(`Tool ${name} expected a Zod schema or ToolAnnotations, but received an unrecognized object`);
        annotations3 = rest.shift();
      }
    }
    let callback = rest[0];
    return this._createRegisteredTool(name, void 0, description, inputSchema, outputSchema, annotations3, { taskSupport: "forbidden" }, void 0, callback);
  }
  /**
   * Registers a tool with a config object and callback.
   */
  registerTool(name, config, cb) {
    if (this._registeredTools[name])
      throw new Error(`Tool ${name} is already registered`);
    let { title, description, inputSchema, outputSchema, annotations: annotations3, _meta } = config;
    return this._createRegisteredTool(name, title, description, inputSchema, outputSchema, annotations3, { taskSupport: "forbidden" }, _meta, cb);
  }
  prompt(name, ...rest) {
    if (this._registeredPrompts[name])
      throw new Error(`Prompt ${name} is already registered`);
    let description;
    typeof rest[0] == "string" && (description = rest.shift());
    let argsSchema;
    rest.length > 1 && (argsSchema = rest.shift());
    let cb = rest[0], registeredPrompt = this._createRegisteredPrompt(name, void 0, description, argsSchema, cb);
    return this.setPromptRequestHandlers(), this.sendPromptListChanged(), registeredPrompt;
  }
  /**
   * Registers a prompt with a config object and callback.
   */
  registerPrompt(name, config, cb) {
    if (this._registeredPrompts[name])
      throw new Error(`Prompt ${name} is already registered`);
    let { title, description, argsSchema } = config, registeredPrompt = this._createRegisteredPrompt(name, title, description, argsSchema, cb);
    return this.setPromptRequestHandlers(), this.sendPromptListChanged(), registeredPrompt;
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
    this.isConnected() && this.server.sendResourceListChanged();
  }
  /**
   * Sends a tool list changed event to the client, if connected.
   */
  sendToolListChanged() {
    this.isConnected() && this.server.sendToolListChanged();
  }
  /**
   * Sends a prompt list changed event to the client, if connected.
   */
  sendPromptListChanged() {
    this.isConnected() && this.server.sendPromptListChanged();
  }
};
var EMPTY_OBJECT_JSON_SCHEMA = {
  type: "object",
  properties: {}
};
function isZodTypeLike(value) {
  return value !== null && typeof value == "object" && "parse" in value && typeof value.parse == "function" && "safeParse" in value && typeof value.safeParse == "function";
}
function isZodSchemaInstance(obj) {
  return "_def" in obj || "_zod" in obj || isZodTypeLike(obj);
}
function isZodRawShapeCompat(obj) {
  return typeof obj != "object" || obj === null || isZodSchemaInstance(obj) ? !1 : Object.keys(obj).length === 0 ? !0 : Object.values(obj).some(isZodTypeLike);
}
function getZodSchemaObject(schema) {
  if (schema) {
    if (isZodRawShapeCompat(schema))
      return objectFromShape(schema);
    if (!isZodSchemaInstance(schema))
      throw new Error("inputSchema must be a Zod schema or raw shape, received an unrecognized object");
    return schema;
  }
}
function promptArgumentsFromSchema(schema) {
  let shape = getObjectShape(schema);
  return shape ? Object.entries(shape).map(([name, field]) => {
    let description = getSchemaDescription(field), isOptional = isSchemaOptional(field);
    return {
      name,
      description,
      required: !isOptional
    };
  }) : [];
}
function getMethodValue(schema) {
  let methodSchema = getObjectShape(schema)?.method;
  if (!methodSchema)
    throw new Error("Schema is missing a method literal");
  let value = getLiteralValue(methodSchema);
  if (typeof value == "string")
    return value;
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
    hasMore: !1
  }
};

// node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js
import process2 from "node:process";
var StdioServerTransport = class {
  constructor(_stdin = process2.stdin, _stdout = process2.stdout, options) {
    this._stdin = _stdin, this._stdout = _stdout, this._started = !1, this._ondata = (chunk) => {
      try {
        this._readBuffer.append(chunk), this.processReadBuffer();
      } catch (error) {
        this.onerror?.(error), this.close().catch(() => {
        });
      }
    }, this._onerror = (error) => {
      this.onerror?.(error);
    }, this._readBuffer = new ReadBuffer({ maxBufferSize: options?.maxBufferSize });
  }
  /**
   * Starts listening for messages on stdin.
   */
  async start() {
    if (this._started)
      throw new Error("StdioServerTransport already started! If using Server class, note that connect() calls start() automatically.");
    this._started = !0, this._stdin.on("data", this._ondata), this._stdin.on("error", this._onerror);
  }
  processReadBuffer() {
    for (; ; )
      try {
        let message = this._readBuffer.readMessage();
        if (message === null)
          break;
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error);
      }
  }
  async close() {
    this._stdin.off("data", this._ondata), this._stdin.off("error", this._onerror), this._stdin.listenerCount("data") === 0 && this._stdin.pause(), this._readBuffer.clear(), this.onclose?.();
  }
  send(message) {
    return new Promise((resolve7) => {
      let json = serializeMessage(message);
      this._stdout.write(json) ? resolve7() : this._stdout.once("drain", resolve7);
    });
  }
};

// src/controller/learning-source-receipt.mjs
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
var receiptSchema = 1, defaultTtlMs = 360 * 60 * 1e3;
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
  let leftBytes = Buffer.from(String(left)), rightBytes = Buffer.from(String(right));
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
function createLearningSourceReceiptAuthority({ secret = randomBytes(32), now = () => Date.now(), ttlMs = defaultTtlMs } = {}) {
  if (!Buffer.isBuffer(secret) || secret.length < 32) throw new Error("learning source receipt secret must contain at least 32 bytes");
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("learning source receipt TTL must be positive");
  return Object.freeze({
    issue(run) {
      if (typeof run?.run_id != "string" || run.run_id === "") throw new Error("learning source receipt requires a Run ID");
      let rootPlanId = run.plan?.fields?.id ?? run.root_plan_id;
      if (!/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId))) throw new Error("learning source receipt requires a Root ID");
      let issuedAt = now(), payload = encode({
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
      if (typeof receipt != "string" || receipt === "") return { confirmed: !1, kind: null, blocker: "controller-learning-source-not-current-task-bound" };
      let [payload, suppliedSignature, extra] = receipt.split(".");
      if (!payload || !suppliedSignature || extra !== void 0 || !safeEqual(signature(secret, payload), suppliedSignature))
        return { confirmed: !1, kind: "ephemeral-receipt", blocker: "controller-learning-source-receipt-invalid" };
      let value;
      try {
        value = decode(payload);
      } catch {
        return { confirmed: !1, kind: "ephemeral-receipt", blocker: "controller-learning-source-receipt-invalid" };
      }
      let rootPlanId = run?.plan?.fields?.id ?? run?.root_plan_id;
      return value?.schema !== receiptSchema || value?.source_kind !== "controller-run" || value?.run_id !== run?.run_id || value?.root_plan_id !== rootPlanId || !Number.isFinite(Date.parse(value?.issued_at)) || !Number.isFinite(Date.parse(value?.expires_at)) ? { confirmed: !1, kind: "ephemeral-receipt", blocker: "controller-learning-source-receipt-invalid" } : Date.parse(value.expires_at) < now() ? { confirmed: !1, kind: "ephemeral-receipt", blocker: "controller-learning-source-receipt-expired" } : { confirmed: !0, kind: "ephemeral-receipt", blocker: null };
    }
  });
}

// src/controller/manual-status.mjs
import { createHash } from "node:crypto";
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
function artifactSetHash(entries) {
  let observations = entries.map(({ label, text }) => ({ label, text_hash: createHash("sha256").update(String(text)).digest("hex") })).sort((left, right) => left.label.localeCompare(right.label) || left.text_hash.localeCompare(right.text_hash));
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
  let blockers = [];
  return snapshot?.state !== "achieved" && blockers.push("learning-source-not-achieved"), snapshot?.delivery_status !== "verified" && blockers.push("learning-source-not-verified"), {
    schema: 1,
    eligible: blockers.length === 0,
    source_kind: "artifact-chain",
    source_id: snapshot?.root_plan_id ?? artifactSummary?.root_plan_id ?? null,
    root_plan_id: snapshot?.root_plan_id ?? artifactSummary?.root_plan_id ?? null,
    effective_profile: "manual",
    blockers,
    workspace_match: { status: "not-required", matched: !0, paths: [] },
    delivery_commit: null,
    delivered_paths: [],
    event_chain_valid: null,
    compatibility: snapshot?.compatibility ?? "compatible",
    source_binding: { status: "confirmed", kind: "current-task-artifacts" },
    candidates: (artifactSummary?.learning_candidates ?? []).map((candidate) => ({ ...candidate }))
  };
}
function incomplete(rootPlanId, entries, observedAt, blockers) {
  let input = baseInput(rootPlanId, entries, observedAt);
  return {
    snapshot: deriveWorkflowState({ ...input, manual_context_incomplete: !0, blockers: unique(blockers) }),
    artifact_summary: summary(rootPlanId, entries),
    diagnostics: []
  };
}
function invalid(rootPlanId, entries, observedAt, blockers, diagnostics = []) {
  let input = baseInput(rootPlanId, entries, observedAt);
  return {
    snapshot: deriveWorkflowState({ ...input, artifact_chain_valid: !1, root_schema_valid: !1, blockers: unique(blockers) }),
    artifact_summary: summary(rootPlanId, entries),
    diagnostics: unique(diagnostics)
  };
}
function referencedIds(fields) {
  return fields.artifact === "work-plan" ? [fields.predecessor_plan_id, fields.replan_source_review_id] : fields.artifact === "delivery-evidence" ? [fields.predecessor_evidence_id, fields.source_review_id] : fields.artifact === "work-review" ? [fields.latest_evidence_id, fields.predecessor_review_id] : [];
}
function normalizeEntries(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length === 0) return [];
  let entries = artifacts.map((entry, index) => {
    if (!entry || typeof entry.label != "string" || entry.label.trim() === "" || typeof entry.text != "string" || entry.text.trim() === "")
      throw new Error(`manual status artifact ${index + 1} requires non-empty label and text`);
    return { label: entry.label, text: entry.text };
  });
  if (new Set(entries.map((entry) => entry.label)).size !== entries.length) throw new Error("manual status artifact labels must be unique");
  return entries;
}
function activeRootFromEntries(entries, pluginRoot2) {
  let roots = entries.map((entry) => inspectArtifactText(entry.text, pluginRoot2).artifact).filter((artifact3) => artifact3?.fields?.artifact === "work-plan");
  if (roots.length === 0) throw new Error("manual active root resolution requires a current work-plan artifact");
  let ids = new Set(roots.map((root) => root.fields.id));
  if (ids.size !== roots.length) throw new Error("manual active root resolution found duplicate work-plan IDs");
  let referenced = new Set(roots.map((root) => root.fields.predecessor_plan_id).filter((id) => ids.has(id))), tips = roots.filter((root) => !referenced.has(root.fields.id)).map((root) => root.fields.id).sort();
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
  let entries = normalizeEntries(artifacts);
  if (rootPlanId ??= activeRootFromEntries(entries, pluginRoot2), !/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/.test(String(rootPlanId))) throw new Error("manual status requires a valid wp-* root_plan_id");
  let inspected = entries.map((entry) => ({ entry, inspection: inspectArtifactText(entry.text, pluginRoot2) })), unparseable = inspected.filter(({ inspection }) => !inspection.artifact?.fields?.artifact);
  if (unparseable.length > 0) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires a parseable current Schema 5 artifact chain");
    return invalid(rootPlanId, entries, observedAt, unparseable.flatMap(({ entry, inspection }) => inspection.errors.map((error) => `${entry.label}: ${error}`)));
  }
  let rootById = new Map(inspected.filter(({ inspection }) => inspection.artifact?.fields?.artifact === "work-plan").map(({ inspection }) => [inspection.artifact.fields.id, inspection.artifact])), lineageRootIds = /* @__PURE__ */ new Set(), lineageCursor = rootPlanId;
  for (; lineageCursor && !lineageRootIds.has(lineageCursor); )
    lineageRootIds.add(lineageCursor), lineageCursor = rootById.get(lineageCursor)?.fields.predecessor_plan_id ?? null;
  let related = inspected.filter(({ inspection }) => {
    let fields = inspection.artifact.fields;
    return lineageRootIds.has(fields.id) || lineageRootIds.has(fields.root_plan_id);
  }), rootRecords = related.filter(({ inspection }) => inspection.artifact.fields.artifact === "work-plan" && inspection.artifact.fields.id === rootPlanId);
  if (rootRecords.length === 0) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires the current root artifact");
    return incomplete(rootPlanId, entries, observedAt, ["manual-root-artifact-missing"]);
  }
  if (rootRecords.length > 1) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires one unambiguous root artifact");
    return invalid(rootPlanId, entries, observedAt, ["manual-root-artifact-ambiguous"]);
  }
  let relatedEntries = related.map(({ entry }) => entry), schemas = new Set(related.map(({ inspection }) => inspection.artifact.fields.schema));
  if (schemas.size === 1 && schemas.has(3)) {
    if (manualAcceptance) throw new Error("Workflow 3 artifact chains are read-only and cannot be accepted");
    let input2 = baseInput(rootPlanId, relatedEntries, observedAt);
    return {
      snapshot: deriveWorkflowState({ ...input2, lifecycle: "stopped", compatibility: "read-only-workflow-3", blockers: ["legacy-workflow-3-read-only"] }),
      artifact_summary: summary(rootPlanId, relatedEntries),
      diagnostics: ["Workflow 3 artifacts are preserved as read-only history and are not converted"]
    };
  }
  if (schemas.size === 1 && schemas.has(4)) {
    if (manualAcceptance) throw new Error("Workflow 4 artifact chains are read-only and cannot be accepted");
    let input2 = baseInput(rootPlanId, relatedEntries, observedAt);
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
  let individualErrors = related.flatMap(({ entry, inspection }) => inspection.errors.map((error) => `${entry.label}: ${error}`));
  if (individualErrors.length > 0) {
    if (manualAcceptance) throw new Error(`manual provisional acceptance rejects an invalid artifact chain: ${individualErrors.join("; ")}`);
    return invalid(rootPlanId, relatedEntries, observedAt, individualErrors, related.flatMap(({ inspection }) => inspection.diagnostics));
  }
  let ids = new Set(related.map(({ inspection }) => inspection.artifact.fields.id)), missingReferences = [];
  for (let { entry, inspection } of related)
    for (let reference of referencedIds(inspection.artifact.fields)) reference && !ids.has(reference) && missingReferences.push(`${entry.label}: manual-artifact-context-missing:${reference}`);
  if (missingReferences.length > 0) {
    if (manualAcceptance) throw new Error("manual provisional acceptance requires every referenced artifact");
    return incomplete(rootPlanId, relatedEntries, observedAt, missingReferences);
  }
  let chain = inspectArtifactSet(
    relatedEntries.map(({ label, text }) => [label, text]),
    pluginRoot2,
    { boundaryReceiptVerifier: boundaryReceiptVerifier2 }
  );
  if (chain.errors.length > 0) {
    if (manualAcceptance) throw new Error(`manual provisional acceptance rejects an invalid artifact chain: ${chain.errors.join("; ")}`);
    let boundaryTrustErrors = chain.errors.filter((error) => /root-boundary review requires a fresh protected host receipt|boundary receipt is not trusted|boundary receipt host verification failed/.test(error));
    if (boundaryTrustErrors.length > 0) {
      let blocked = incomplete(rootPlanId, relatedEntries, observedAt, boundaryTrustErrors);
      return { ...blocked, diagnostics: unique([...blocked.diagnostics, ...chain.diagnostics]) };
    }
    return invalid(rootPlanId, relatedEntries, observedAt, chain.errors, chain.diagnostics);
  }
  let tips = effectiveCliSummary(chain), evidenceTipId = tips.evidence_tips[rootPlanId] ?? null, reviewTipId = tips.review_tips[rootPlanId] ?? null, root = chain.effective.get(rootPlanId), evidence = evidenceTipId ? chain.effective.get(evidenceTipId) : null, review = reviewTipId ? chain.effective.get(reviewTipId) : null, boundaryReview = review?.fields.review_basis === "root-boundary", correctionEvidencePendingReview = !!(review && evidence?.fields.source_review_id === review.fields.id && evidence?.fields.subject_id === review.fields.correction_id), contract = executionContractFromArtifactText(rootRecords[0].entry.text, pluginRoot2), constraintProjection = contract.errors.length === 0 ? manualConstraintProjection({
    checks: contract.checks,
    evidence: evidence?.fields.check_evidence ?? [],
    pending: !evidence
  }) : {}, legacyReceiptGap = (constraintProjection.constraint_summary?.legacy_unattested_verified_checks?.length ?? 0) > 0, repositoryAttribution2 = evidence?.fields.extensions?.workflow?.repository_attribution ?? null, acceptanceEligible = root?.fields.profile_max === "manual" && evidence && review && evidence.fields.status !== "blocked" && evidence.fields.overall_grade !== "failed" && !(evidence.fields.check_evidence ?? []).some((check) => check.grade === "failed") && review.fields.delivery_status === "provisional" && review.fields.next_action === "accept-provisional" && !correctionEvidencePendingReview;
  if (manualAcceptance && !acceptanceEligible)
    throw new Error("manual provisional acceptance requires the unique current provisional review tip, no failed check, no blocked artifact, and no correction awaiting review");
  let input = {
    ...baseInput(rootPlanId, relatedEntries, observedAt),
    contract_level: root.fields.contract_level,
    root_schema_valid: !0,
    artifact_chain_valid: !0,
    plan_status: root.fields.status,
    plan_approved: !!(evidence || boundaryReview),
    intent_ready: root.fields.intent_ready === !0,
    material_open_decisions: root.fields.status !== "ready" || root.fields.intent_ready !== !0,
    product_aligned: !0,
    architecture_aligned: !0,
    program_design_aligned: !0,
    slices_ready: !0,
    execution_started: !!(evidence || boundaryReview),
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
    more_slices: !1
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
    changed_paths: evidence?.fields.changed_paths ?? [],
    ...repositoryAttribution2 ? { repository_attribution: repositoryAttribution2 } : {},
    ...constraintProjection
  };
}

// src/core/manual-boundary-receipts.mjs
import { join, relative, resolve } from "node:path";
var MANUAL_BOUNDARY_RECEIPT_TTL_MS = 900 * 1e3, MANUAL_BOUNDARY_RECOVERY_REASONS = Object.freeze({
  "baseline-unavailable-after-mutation": "baseline-unavailable-after-mutation",
  "authority-violation": "out-of-authority-changes",
  "repository-observation-conflict": "workspace-ambiguous-after-mutation",
  "artifact-text-conflict": "root-binding-lost-after-mutation"
}), sha256 = manualReceiptHash, stableJson = stableManualReceiptJson, canonicalWorkspaceRoot = canonicalManualWorkspaceRoot;
function normalizedObservedPaths(paths, repositoryRoot) {
  let root = resolve(repositoryRoot);
  return [...new Set((paths ?? []).map((value) => {
    let source = String(value ?? "").trim();
    if (!source || source.includes("\\") || source.includes("\0")) throw new Error("boundary receipt observed paths must be normalized repository-relative paths");
    let candidate = resolve(root, source), rel = relative(root, candidate).replaceAll("\\", "/");
    if (!rel || rel === ".." || rel.startsWith("../") || rel.startsWith("/"))
      throw new Error(`boundary receipt path escapes the repository: ${source}`);
    return rel;
  }))].sort();
}
function receiptBase(workspaceRoot3, rootHash, options = {}) {
  return join(sharedArtifactStateRoot(workspaceRoot3, options), "manual-boundary-receipts", rootHash);
}
function exactRoot(rootPlanText, pluginRoot2) {
  let inspected = inspectArtifactText(rootPlanText, pluginRoot2);
  if (inspected.errors.length > 0 || inspected.artifact?.fields?.artifact !== "work-plan" || inspected.artifact?.fields?.schema !== 5)
    throw new Error(`boundary receipt requires an exact valid Schema-5 Root: ${inspected.errors.join("; ") || "not a work-plan"}`);
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
    if (exactRoot(rootPlanText, pluginRoot2), !receipt || typeof receipt != "object" || Array.isArray(receipt)) throw new Error("boundary receipt is missing");
    if (!/^br-[a-f0-9]{64}$/.test(String(receipt.receipt_id ?? "")) || receiptIdentity(receipt) !== receipt.receipt_id)
      throw new Error("boundary receipt identity is invalid");
    let expectedReason = MANUAL_BOUNDARY_RECOVERY_REASONS[receipt.recovery_error_code];
    if (!expectedReason || receipt.reason_codes?.length !== 1 || receipt.reason_codes[0] !== expectedReason)
      throw new Error("boundary receipt recovery proof is invalid");
    if (receipt.root_content_hash !== rootContentHash(rootPlanText)) throw new Error("boundary receipt Root binding is stale");
    let snapshot = captureSnapshot(workspaceRoot3), repositoryRoot = canonicalWorkspaceRoot(snapshot.repository_root);
    if (repositoryRoot !== canonicalWorkspaceRoot(workspaceRoot3)) throw new Error("boundary receipt repository binding is invalid");
    if (receipt.repository_snapshot_hash !== repositorySnapshotFingerprint(snapshot)) throw new Error("boundary receipt repository snapshot is stale");
    let paths = normalizedObservedPaths(receipt.observed_paths, repositoryRoot);
    if (stableJson(paths) !== stableJson(receipt.observed_paths)) throw new Error("boundary receipt observed paths are not canonical");
    if (stableJson(paths) !== stableJson(normalizedObservedPaths(snapshot.dirty_paths, repositoryRoot)))
      throw new Error("boundary receipt observed paths no longer equal the complete current dirty-path set");
    if (expectedReason === "out-of-authority-changes" && paths.length === 0) throw new Error("boundary receipt omits the out-of-authority path");
    let stateRoot = sharedArtifactStateRoot(repositoryRoot, options), path = join(receiptBase(repositoryRoot, receipt.root_content_hash, options), `${receipt.receipt_id}.json`), record2 = readManualReceiptRecord(path, stateRoot);
    if (!record2) throw new Error("boundary receipt has no safe protected host record");
    if (record2?.schema !== 1 || record2?.kind !== "manual-boundary-receipt-record") throw new Error("boundary receipt host record is incompatible");
    if (record2.repository_root !== repositoryRoot || record2.receipt_hash !== sha256(stableJson(receipt)) || stableJson(record2.receipt) !== stableJson(receipt))
      throw new Error("boundary receipt host record does not match the artifact");
    let observed = Date.parse(receipt.observed_at), expires = Date.parse(record2.expires_at), currentTime = now().getTime();
    if (!Number.isFinite(observed) || !Number.isFinite(expires) || observed > currentTime || expires <= currentTime)
      throw new Error("boundary receipt is expired or not fresh");
    return { ok: !0, receipt_id: receipt.receipt_id, repository_snapshot_hash: receipt.repository_snapshot_hash };
  } catch (error) {
    return { ok: !1, reason: String(error?.message ?? error) };
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
var MANUAL_SUBAGENT_POLICY_SCHEMA = 1, MANUAL_SUBAGENT_MODES = Object.freeze(["parent-only", "parent-or-approved"]), MANUAL_SUBAGENT_HOSTS = Object.freeze(["cursor", "codex"]), MANUAL_SUBAGENT_PRESETS = Object.freeze({
  "cursor-composer-grok-v1": Object.freeze({
    host: "cursor",
    version: 1,
    parent_fallback: !0,
    candidates: Object.freeze([
      Object.freeze({ model_id: "composer-2.5-fast" }),
      Object.freeze({ model_id: "cursor-grok-4.5-high-fast" })
    ])
  }),
  "codex-efficient-gpt-v1": Object.freeze({
    host: "codex",
    version: 1,
    parent_fallback: !0,
    candidates: Object.freeze([
      Object.freeze({ model_id: "gpt-5.6-luna-max", reasoning_effort: "low" }),
      Object.freeze({ model_id: "gpt-5.6-terra-xhigh", reasoning_effort: "medium" })
    ])
  })
}), objectLike = (value) => !!value && typeof value == "object" && !Array.isArray(value), cleanId = (value) => typeof value == "string" && value.trim() !== "" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 256) : null;
function parentOnlyResolution(source, path, issues = []) {
  return Object.freeze({
    schema: MANUAL_SUBAGENT_POLICY_SCHEMA,
    mode: "parent-only",
    source,
    path,
    authoritative: !1,
    hosts: Object.freeze({
      cursor: Object.freeze({ host: "cursor", parent_fallback: !0, candidates: Object.freeze([]), preset: null }),
      codex: Object.freeze({ host: "codex", parent_fallback: !0, candidates: Object.freeze([]), preset: null })
    }),
    ...issues.length > 0 ? { issues: Object.freeze([...issues]) } : {}
  });
}
function validateCandidate(candidate, label, errors) {
  if (!objectLike(candidate))
    return errors.push(`${label} must be an object`), null;
  for (let key of Object.keys(candidate))
    ["model_id", "reasoning_effort"].includes(key) || errors.push(`${label} has unknown field ${key}`);
  let modelId = cleanId(candidate.model_id);
  modelId || errors.push(`${label}.model_id is required`);
  let reasoning = null;
  return candidate.reasoning_effort !== void 0 && (reasoning = cleanId(candidate.reasoning_effort), reasoning || errors.push(`${label}.reasoning_effort must be a non-empty string when set`)), modelId ? Object.freeze({ model_id: modelId, ...reasoning ? { reasoning_effort: reasoning } : {} }) : null;
}
function resolveHostPolicy(raw, host, label, errors) {
  if (raw === void 0)
    return Object.freeze({ host, parent_fallback: !0, candidates: Object.freeze([]), preset: null });
  if (!objectLike(raw))
    return errors.push(`${label} must be an object`), Object.freeze({ host, parent_fallback: !0, candidates: Object.freeze([]), preset: null });
  for (let key of Object.keys(raw))
    ["preset", "candidates", "parent_fallback"].includes(key) || errors.push(`${label} has unknown field ${key}`);
  raw.preset !== void 0 && raw.candidates !== void 0 && errors.push(`${label} may set preset or candidates, not both`);
  let preset = null, candidates = [];
  if (raw.preset !== void 0)
    if (preset = cleanId(raw.preset), !preset) errors.push(`${label}.preset must be a non-empty string`);
    else {
      let definition = MANUAL_SUBAGENT_PRESETS[preset];
      definition ? definition.host !== host ? errors.push(`${label}.preset ${preset} is not valid for ${host}`) : candidates = definition.candidates.map((entry) => Object.freeze({ ...entry })) : errors.push(`${label}.preset is unknown: ${preset}`);
    }
  Array.isArray(raw.candidates) ? (raw.candidates.length === 0 && errors.push(`${label}.candidates must not be empty`), candidates = raw.candidates.map((entry, index) => validateCandidate(entry, `${label}.candidates[${index}]`, errors)).filter(Boolean)) : raw.candidates !== void 0 && errors.push(`${label}.candidates must be an array`);
  let parentFallback = raw.parent_fallback === void 0 || raw.parent_fallback === !0 ? !0 : raw.parent_fallback === !1 ? !1 : (errors.push(`${label}.parent_fallback must be a boolean`), !0);
  if (host === "cursor")
    for (let [index, candidate] of candidates.entries())
      candidate.reasoning_effort && errors.push(`${label}.candidates[${index}] must not set reasoning_effort on Cursor`);
  return Object.freeze({
    host,
    parent_fallback: parentFallback,
    candidates: Object.freeze(candidates),
    preset
  });
}
function validateManualSubagentPolicy(value, label = "manual_subagent_policy") {
  let errors = [];
  if (!objectLike(value))
    return errors.push(`${label} must be an object`), errors;
  for (let key of Object.keys(value))
    ["schema", "mode", "hosts"].includes(key) || errors.push(`${label} has unknown field ${key}`);
  if (value.schema !== MANUAL_SUBAGENT_POLICY_SCHEMA && errors.push(`${label}.schema must be ${MANUAL_SUBAGENT_POLICY_SCHEMA}`), MANUAL_SUBAGENT_MODES.includes(value.mode) || errors.push(`${label}.mode must be parent-only or parent-or-approved`), value.hosts !== void 0)
    if (!objectLike(value.hosts)) errors.push(`${label}.hosts must be an object`);
    else {
      for (let key of Object.keys(value.hosts))
        MANUAL_SUBAGENT_HOSTS.includes(key) || errors.push(`${label}.hosts has unknown host ${key}`);
      for (let host of MANUAL_SUBAGENT_HOSTS)
        resolveHostPolicy(value.hosts[host], host, `${label}.hosts.${host}`, errors);
    }
  return errors;
}
function resolveManualSubagentPolicy(options = {}) {
  let path = options.preferencesPath ?? defaultHostPreferencesPath(options);
  if (!existsSync(path)) return parentOnlyResolution("default", path);
  let parsed;
  try {
    parsed = parsePreferenceYaml(readFileSync(path, "utf8"));
  } catch (error) {
    return parentOnlyResolution("invalid-fallback", path, [`preferences file is unreadable: ${error.message}`]);
  }
  if (!objectLike(parsed)) return parentOnlyResolution("invalid-fallback", path, ["preferences must be an object"]);
  if (parsed.manual_subagent_policy === void 0) return parentOnlyResolution("default", path);
  let errors = validateManualSubagentPolicy(parsed.manual_subagent_policy);
  if (errors.length > 0) return parentOnlyResolution("invalid-fallback", path, errors);
  let policy = parsed.manual_subagent_policy;
  if (policy.mode === "parent-only")
    return Object.freeze({
      ...parentOnlyResolution("file", path),
      mode: "parent-only"
    });
  let hostErrors = [], hosts = Object.freeze({
    cursor: resolveHostPolicy(policy.hosts?.cursor, "cursor", "manual_subagent_policy.hosts.cursor", hostErrors),
    codex: resolveHostPolicy(policy.hosts?.codex, "codex", "manual_subagent_policy.hosts.codex", hostErrors)
  });
  return hostErrors.length > 0 ? parentOnlyResolution("invalid-fallback", path, hostErrors) : Object.freeze({
    schema: MANUAL_SUBAGENT_POLICY_SCHEMA,
    mode: "parent-or-approved",
    source: "file",
    path,
    authoritative: !1,
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
]), CAUSES = new Set(MODEL_INCIDENT_CAUSES), TRANSIENT_TTL_MS = 1440 * 60 * 1e3;
var modelRoot = (stateRoot) => join2(stateRoot, "model-inheritance");
var incidentDirectory = (stateRoot, incidentId) => join2(modelRoot(stateRoot), "incidents", incidentId), incidentPath = (stateRoot, incidentId) => join2(incidentDirectory(stateRoot, incidentId), "incident.json");
function readJson(path) {
  try {
    let value = JSON.parse(readFileSync2(path, "utf8"));
    return value && typeof value == "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
function readIncident(stateRoot, incidentId) {
  let incident = readJson(incidentPath(stateRoot, incidentId));
  if (!incident) return null;
  let observationsDirectory = join2(incidentDirectory(stateRoot, incidentId), "observations"), childExecuted = !1, resultReturned = !1, lastObservedAt = incident.recorded_at;
  if (existsSync2(observationsDirectory))
    for (let name of readdirSync(observationsDirectory).sort()) {
      if (!name.endsWith(".json")) continue;
      let observation = readJson(join2(observationsDirectory, name));
      observation && (childExecuted ||= observation.child_executed === !0, resultReturned ||= observation.result_returned === !0, observation.observed_at && (!lastObservedAt || observation.observed_at > lastObservedAt) && (lastObservedAt = observation.observed_at));
    }
  return {
    ...incident,
    child_executed: childExecuted,
    result_returned: resultReturned,
    last_observed_at: lastObservedAt
  };
}
function publicIncident(value) {
  return value ? {
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
  } : null;
}
function cleanSummary(overrides = {}) {
  return {
    authoritative: !1,
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
  let incidentsRoot = join2(modelRoot(stateRoot), "incidents");
  if (!existsSync2(incidentsRoot)) return cleanSummary();
  let incidentEntries;
  try {
    incidentEntries = readdirSync(incidentsRoot, { withFileTypes: !0 }).filter((entry) => entry.isDirectory());
  } catch {
    return cleanSummary({
      status: "unattestable",
      enforcement: "diagnostic-state-unavailable"
    });
  }
  let unreadable = !1, incidents = incidentEntries.map((entry) => {
    let incident = readIncident(stateRoot, entry.name);
    return unreadable ||= !incident, incident;
  }).filter(Boolean).sort((left, right) => String(left.last_observed_at ?? "").localeCompare(String(right.last_observed_at ?? ""))), hasDeviation = incidents.some((entry) => entry.status === "deviated"), lastIncident = incidents.at(-1) ?? null;
  return cleanSummary({
    status: hasDeviation ? "deviated" : incidents.length > 0 || unreadable ? "unattestable" : "clean",
    incident_count: incidents.length,
    last_incident: publicIncident(lastIncident),
    enforcement: lastIncident?.enforcement ?? (unreadable ? "diagnostic-state-unavailable" : "no-incident")
  });
}

// src/mcp/artifact-handlers.mjs
import { createHash as createHash5 } from "node:crypto";

// src/controller/manual-review-lifecycle.mjs
import { createHash as createHash2 } from "node:crypto";

// src/core/manual-path-authority.mjs
import { existsSync as existsSync3, realpathSync } from "node:fs";
import { dirname as dirname2, isAbsolute, relative as relative2, resolve as resolve3, sep } from "node:path";
function uniqueSorted(values) {
  return [...new Set((values ?? []).map(String).map((value) => value.trim()).filter(Boolean))].sort();
}
function pathMatchesRoot(path, root) {
  return path === root || path.startsWith(`${root}/`);
}
function repositoryAuthorityPaths(repositoryRoot, repositoryPath) {
  let root = realpathSync(repositoryRoot), lexical = resolve3(root, repositoryPath);
  if (lexical !== root && !lexical.startsWith(`${root}${sep}`))
    throw new Error(`native closeout path escapes the repository: ${repositoryPath}`);
  let existing = lexical;
  for (; !existsSync3(existing) && existing !== root; ) existing = dirname2(existing);
  let resolvedExisting = realpathSync(existing);
  if (resolvedExisting !== root && !resolvedExisting.startsWith(`${root}${sep}`))
    throw new Error(`native closeout path resolves outside the repository: ${repositoryPath}`);
  let unresolved = relative2(existing, lexical), resolved = resolve3(resolvedExisting, unresolved);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`))
    throw new Error(`native closeout path resolves outside the repository: ${repositoryPath}`);
  let normalizeRelative = (value) => relative2(root, value).replaceAll("\\", "/") || ".";
  return {
    lexical: normalizeRelative(lexical),
    resolved: normalizeRelative(resolved)
  };
}
function authorityViolation(authorityPath, { allowed, protectedPaths, approvalRequired }) {
  return protectedPaths.some((entry) => pathMatchesRoot(authorityPath, entry)) ? `native closeout path is protected by the Root: ${authorityPath}` : approvalRequired.some((entry) => pathMatchesRoot(authorityPath, entry)) ? `native closeout path requires separate human approval that the closeout report cannot grant: ${authorityPath}` : allowed.some((entry) => pathMatchesRoot(authorityPath, entry)) ? null : `native closeout path is outside Root authority: ${authorityPath}`;
}
function assertChangedPathAuthority(rootFields, changedPaths, repositoryRoot) {
  let authority = rootFields?.authority ?? {}, allowed = uniqueSorted(authority.allowed_roots), protectedPaths = uniqueSorted(authority.protected_paths), approvalRequired = uniqueSorted(authority.approval_required_paths);
  if (allowed.length === 0) throw new Error("native closeout Root has no allowed path authority");
  for (let path of uniqueSorted(changedPaths)) {
    if (isAbsolute(path) || path.includes("\\") || path.includes("\0"))
      throw new Error(`native closeout path is not repository-relative: ${path}`);
    let candidates = repositoryAuthorityPaths(repositoryRoot, path);
    for (let candidate of uniqueSorted([candidates.lexical, candidates.resolved])) {
      let violation = authorityViolation(candidate, { allowed, protectedPaths, approvalRequired });
      if (violation) throw new Error(violation);
    }
  }
}

// src/controller/manual-review-lifecycle.mjs
function codedError(code, message) {
  let error = new Error(message);
  return error.code = code, error;
}
function validReviewProvenance(provenance, text) {
  return provenance?.schema === 1 && provenance?.kind === "host-work-review-builder" && /^[a-f0-9]{64}$/.test(String(provenance.review_input_hash ?? "")) && provenance.artifact_hash === createHash2("sha256").update(text, "utf8").digest("hex") && Object.keys(provenance).every((key) => ["schema", "kind", "review_input_hash", "artifact_hash"].includes(key));
}
function exactEntries(rootPlanText, artifacts, pluginRoot2) {
  let root = inspectArtifactText(rootPlanText, pluginRoot2);
  if (root.errors.length > 0 || root.artifact?.fields?.artifact !== "work-plan" || root.artifact.fields.schema !== 5)
    throw new Error(`manual Review requires the exact native Schema-5 Root: ${root.errors.join("; ") || "not a work-plan"}`);
  let byId = /* @__PURE__ */ new Map([[root.artifact.fields.id, { label: root.artifact.fields.id, text: rootPlanText }]]);
  for (let entry of artifacts ?? []) {
    if (!entry || typeof entry.text != "string" || !entry.text.trim()) continue;
    let inspected = inspectArtifactText(entry.text, pluginRoot2);
    if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id)
      throw new Error(`manual Review artifact ${entry.label ?? "unknown"} is invalid: ${inspected.errors.join("; ")}`);
    let id = inspected.artifact.fields.id;
    if (inspected.artifact.fields.artifact === "work-review") {
      let provenance = entry.builder_provenance ?? null;
      if (provenance && !validReviewProvenance(provenance, entry.text))
        throw codedError("review-artifact-rejected", `manual Review artifact ${id} has invalid host builder provenance`);
      if (!provenance && entry.legacy_review_recorded !== !0)
        throw codedError("review-artifact-rejected", `manual Review rejects newly imported work-review ${id} without protected builder provenance`);
    }
    let prior = byId.get(id);
    if (prior && prior.text !== entry.text) throw new Error(`manual Review artifact ${id} has conflicting immutable bytes`);
    byId.set(id, {
      label: id,
      text: entry.text,
      ...entry.builder_provenance ? { builder_provenance: entry.builder_provenance } : {},
      ...entry.legacy_review_recorded === !0 ? { legacy_review_recorded: !0 } : {}
    });
  }
  return { rootFields: root.artifact.fields, entries: [...byId.values()] };
}
function currentTips(entries, pluginRoot2) {
  let inspected = inspectArtifactSet(entries.map((entry) => [entry.label, entry.text]), pluginRoot2);
  if (inspected.errors.length > 0) throw new Error(`manual Review chain is invalid: ${inspected.errors.join("; ")}`);
  let tips = effectiveCliSummary(inspected);
  return { inspected, tips };
}
function boundedLine(value, maximum = 1900) {
  let source = String(value ?? "").trim();
  if (source.length <= maximum) return source;
  let suffix = " \u2026 [bounded]";
  return `${source.slice(0, maximum - suffix.length).trimEnd()}${suffix}`;
}
function appendBoundedSummary(summary2, message) {
  return boundedLine(`${summary2 ?? ""} ${boundedLine(message)}`.trim());
}
function authorityLimitation(reviewInput, message) {
  let boundedMessage = boundedLine(message);
  return {
    ...reviewInput,
    assessment: ["achieved", "provisional"].includes(reviewInput.assessment) ? "partially-achieved" : reviewInput.assessment,
    recommended_action: "clarify",
    snapshot_assessment: "incomplete",
    snapshot_summary: appendBoundedSummary(reviewInput.snapshot_summary, boundedMessage),
    missing_evidence: [.../* @__PURE__ */ new Set([...reviewInput.missing_evidence ?? [], boundedMessage])],
    correction: void 0
  };
}
function attributionLimitation(reviewInput, message) {
  let boundedMessage = boundedLine(message), decisionCanRemainEvidenceOnly = ["none", "accept-provisional"].includes(reviewInput.recommended_action) && (reviewInput.findings ?? []).length === 0 && (reviewInput.missing_evidence ?? []).length === 0 && reviewInput.snapshot_assessment !== "contradicted";
  return {
    ...reviewInput,
    assessment: ["achieved", "provisional"].includes(reviewInput.assessment) ? "provisional" : reviewInput.assessment,
    recommended_action: decisionCanRemainEvidenceOnly ? "accept-provisional" : reviewInput.recommended_action,
    snapshot_assessment: decisionCanRemainEvidenceOnly ? "consistent" : reviewInput.snapshot_assessment,
    snapshot_summary: appendBoundedSummary(reviewInput.snapshot_summary, boundedMessage)
  };
}
function supportedOnBoundary(checkEvidence3, message) {
  let boundedMessage = boundedLine(message);
  return (checkEvidence3 ?? []).map((entry) => ({
    ...entry,
    grade: entry.grade === "verified" ? "supported" : entry.grade,
    limitations: [.../* @__PURE__ */ new Set([...entry.limitations ?? [], boundedMessage])]
  }));
}
function sortedPaths(values) {
  return [...new Set((values ?? []).map(String).map((value) => value.trim()).filter(Boolean))].sort();
}
function summarizedPaths(values, maximum = 750) {
  let paths = sortedPaths(values);
  if (paths.length === 0) return "none";
  let visible = [];
  for (let path of paths) {
    let suffix = paths.length > visible.length + 1 ? `, \u2026 (+${paths.length - visible.length - 1} more)` : "";
    if (visible.length > 0 && `${visible.join(", ")}, ${path}${suffix}`.length > maximum) break;
    if (visible.push(path), `${visible.join(", ")}${suffix}`.length > maximum) {
      visible[visible.length - 1] = boundedLine(path, Math.max(80, maximum - suffix.length));
      break;
    }
  }
  let remaining = paths.length - visible.length;
  return `${visible.join(", ")}${remaining > 0 ? `, \u2026 (+${remaining} more)` : ""}`;
}
function samePathSet(left, right) {
  return JSON.stringify(sortedPaths(left)) === JSON.stringify(sortedPaths(right));
}
function buildManualReviewLifecycle({
  rootPlanText,
  artifacts = [],
  reviewInput,
  checkEvidence: checkEvidence3 = [],
  strategyRevision = 0,
  summary: summary2 = null,
  workspaceRoot: workspaceRoot3,
  pluginRoot: pluginRoot2,
  repositoryBaseline = null,
  repositoryAttribution: repositoryAttribution2 = null,
  captureSnapshot = captureRepositorySnapshot
}) {
  if (!reviewInput) throw new Error("manual Review requires review_input schema 1");
  if (!workspaceRoot3) throw new Error("manual Review could not resolve the current repository root");
  let exact = exactEntries(rootPlanText, artifacts, pluginRoot2), initial = currentTips(exact.entries, pluginRoot2), evidenceTipId = initial.tips.evidence_tips[exact.rootFields.id] ?? null, reviewTipId = initial.tips.review_tips[exact.rootFields.id] ?? null, reviewTip = reviewTipId ? initial.inspected.effective.get(reviewTipId) : null, correctionPending = !!(evidenceTipId && reviewTip?.fields?.latest_evidence_id === evidenceTipId && reviewTip?.fields?.next_action === "correct" && reviewTip?.fields?.correction_id), current = captureSnapshot(workspaceRoot3), suppliedReasonCodes = [
    ...repositoryAttribution2?.reason_codes ?? [],
    ...repositoryAttribution2?.status === "provisional" && (repositoryAttribution2?.reason_codes ?? []).length === 0 ? ["attribution-unavailable"] : []
  ], repositoryDelta = deriveRepositoryDelta(repositoryBaseline, current, {
    boundary: repositoryAttribution2?.boundary ?? "create-plan",
    reasonCodes: suppliedReasonCodes
  }), evidenceChangedPaths = repositoryDelta.changed_paths, evidenceSnapshot = repositoryDelta.repository_snapshot, effectiveReviewInput = reviewInput, effectiveCheckEvidence = checkEvidence3;
  if (repositoryDelta.attribution_status !== "attributed") {
    let message = `Repository attribution is provisional (${repositoryDelta.attribution_reason_codes.join(", ") || "attribution-unavailable"}); current checks remain usable, but Workflow cannot claim an exclusive task delta.`;
    effectiveReviewInput = attributionLimitation(effectiveReviewInput, message), effectiveCheckEvidence = supportedOnBoundary(effectiveCheckEvidence, message);
  }
  try {
    assertChangedPathAuthority(exact.rootFields, repositoryDelta.changed_paths, current.repository_root);
  } catch (error) {
    let message = `Current repository changes do not fit the native Plan authority: ${String(error?.message ?? error)}`;
    effectiveReviewInput = authorityLimitation(effectiveReviewInput, message), effectiveCheckEvidence = supportedOnBoundary(effectiveCheckEvidence, message), evidenceChangedPaths = repositoryDelta.changed_paths.filter((path) => {
      try {
        return assertChangedPathAuthority(exact.rootFields, [path], current.repository_root), !0;
      } catch {
        return !1;
      }
    }), evidenceSnapshot = evidenceRepositorySnapshot(current, evidenceChangedPaths, { baselineAvailable: !1 });
  }
  let evidenceTip = evidenceTipId ? initial.inspected.effective.get(evidenceTipId) : null;
  if (evidenceTipId && !correctionPending && evidenceTip?.fields?.artifact === "delivery-evidence" && !samePathSet(evidenceTip.fields.changed_paths, repositoryDelta.changed_paths)) {
    let observed = summarizedPaths(repositoryDelta.changed_paths), claimed = summarizedPaths(evidenceTip.fields.changed_paths), message = `Current repository delivery delta (${observed}) does not match Evidence ${evidenceTipId} changed_paths (${claimed})`;
    effectiveReviewInput = authorityLimitation(effectiveReviewInput, message), effectiveCheckEvidence = supportedOnBoundary(effectiveCheckEvidence, message);
  }
  let evidence = null, reviewArtifacts = exact.entries, chainUpdate = "reuse";
  if (!evidenceTipId || correctionPending)
    evidence = buildDeliveryEvidence({
      rootPlanText,
      artifacts: exact.entries,
      checkEvidence: effectiveCheckEvidence,
      changedPaths: evidenceChangedPaths,
      strategyRevision,
      effectiveProfile: "manual",
      repositorySnapshot: evidenceSnapshot,
      repositoryAttribution: {
        status: repositoryDelta.attribution_status,
        boundary: repositoryDelta.attribution_boundary,
        baseline_hash: repositoryDelta.baseline_hash,
        reason_codes: repositoryDelta.attribution_reason_codes
      },
      summary: summary2,
      manualCheckReceipts: [],
      // Manual verification is the fresh reviewer observation. Certified
      // controller profiles keep their independent receipt requirements.
      enforceManualCheckReceipts: !1,
      pluginRoot: pluginRoot2
    }), reviewArtifacts = [...exact.entries, { label: evidence.fields.id, text: evidence.artifact }], chainUpdate = "append";
  else {
    let refreshBaseEntries = exact.entries.filter((entry) => ![evidenceTipId, reviewTipId].includes(entry.label)), candidate = buildDeliveryEvidence({
      rootPlanText,
      artifacts: refreshBaseEntries,
      checkEvidence: effectiveCheckEvidence,
      changedPaths: evidenceChangedPaths,
      strategyRevision,
      effectiveProfile: "manual",
      repositorySnapshot: evidenceSnapshot,
      repositoryAttribution: {
        status: repositoryDelta.attribution_status,
        boundary: repositoryDelta.attribution_boundary,
        baseline_hash: repositoryDelta.baseline_hash,
        reason_codes: repositoryDelta.attribution_reason_codes
      },
      summary: summary2,
      manualCheckReceipts: [],
      enforceManualCheckReceipts: !1,
      pluginRoot: pluginRoot2
    });
    (exact.entries.find((entry) => entry.label === evidenceTipId)?.text ?? null) === candidate.artifact ? (evidence = { ...candidate, duplicate: !0 }, reviewArtifacts = exact.entries, chainUpdate = "reuse") : (evidence = candidate, reviewArtifacts = [...refreshBaseEntries, { label: candidate.fields.id, text: candidate.artifact }], chainUpdate = candidate.fields.representation === "delta" ? "replace-delta-suffix" : "replace-full-tip");
  }
  let review = buildWorkReview({
    rootPlanText,
    artifacts: reviewArtifacts,
    reviewInput: effectiveReviewInput,
    pluginRoot: pluginRoot2
  });
  return {
    artifact_kind: "work-review",
    root_plan_id: exact.rootFields.id,
    repository_snapshot: evidenceSnapshot,
    repository_state_hash: repositorySnapshotHash(current),
    chain_update: chainUpdate,
    changed_paths: evidenceChangedPaths,
    observed_dirty_paths: repositoryDelta.observed_dirty_paths,
    pre_existing_paths: repositoryDelta.pre_existing_paths,
    repository_attribution: {
      status: repositoryDelta.attribution_status,
      boundary: repositoryDelta.attribution_boundary,
      baseline_hash: repositoryDelta.baseline_hash,
      reason_codes: repositoryDelta.attribution_reason_codes
    },
    delivery_evidence: evidence,
    review
  };
}

// src/core/native-plan-resolution.mjs
import { createHash as createHash3 } from "node:crypto";
var sha2562 = (text) => createHash3("sha256").update(text, "utf8").digest("hex");
function resolveNativePlan({ candidates = [], attemptedSources = [], pluginRoot: pluginRoot2 } = {}) {
  let attempted = [.../* @__PURE__ */ new Set([
    ...attemptedSources,
    ...candidates.map((entry) => entry?.source).filter(Boolean)
  ])], valid = [], rejected = [];
  for (let candidate of candidates) {
    if (typeof candidate?.root_text != "string" || !candidate.root_text.trim()) continue;
    let inspected = inspectArtifactText(candidate.root_text, pluginRoot2), fields = inspected.artifact?.fields;
    if (inspected.errors.length > 0 || fields?.artifact !== "work-plan" || fields?.schema !== 5) {
      rejected.push({
        source: candidate.source ?? "native-task-plan",
        validation_errors: (inspected.errors.length > 0 ? inspected.errors : ["not a Schema-5 work-plan"]).slice(0, 8).map((entry) => String(entry).replace(/\s+/g, " ").slice(0, 300))
      });
      continue;
    }
    valid.push({
      root_text: candidate.root_text,
      root_id: fields.id,
      root_hash: sha2562(candidate.root_text),
      source: candidate.source ?? "native-task-plan"
    });
  }
  let unique2 = [...new Map(valid.map((entry) => [entry.root_hash, entry])).values()];
  return unique2.length === 0 ? rejected.length > 0 ? {
    status: "invalid",
    attempted_sources: attempted,
    rejected_sources: rejected,
    resolution: "Supply the complete exact Schema-5 native Plan from this task, then repeat Review."
  } : {
    status: "unavailable",
    attempted_sources: attempted,
    resolution: "Restore the Schema-5 native Plan in this same task or create and approve a new native Plan, then repeat Review."
  } : unique2.length > 1 ? {
    status: "ambiguous",
    candidate_ids: [...new Set(unique2.map((entry) => entry.root_id))].sort(),
    attempted_sources: attempted,
    resolution: "Keep exactly one Schema-5 native Plan in the current task context, then repeat Review."
  } : { status: "resolved", ...unique2[0] };
}

// hooks/native-review-receipt.mjs
import { createHash as createHash4, randomUUID } from "node:crypto";
import {
  chmodSync as chmodSync2,
  existsSync as existsSync4,
  mkdirSync as mkdirSync2,
  readFileSync as readFileSync3,
  renameSync as renameSync2,
  writeFileSync as writeFileSync2
} from "node:fs";
import { dirname as dirname3, join as join3 } from "node:path";
import { resolve as resolve4 } from "node:path";
var MAX_RECEIPT_BYTES = 2 * 1024 * 1024, TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/, sha2563 = (value) => createHash4("sha256").update(String(value), "utf8").digest("hex");
function timestamp(options = {}) {
  let value = options.now ? options.now() : /* @__PURE__ */ new Date();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
function nowMs(options = {}) {
  return Date.parse(timestamp(options));
}
function ensureDirectory(path) {
  mkdirSync2(path, { recursive: !0, mode: 448 });
  try {
    chmodSync2(path, 448);
  } catch {
  }
}
function atomicNativeReviewReceipt(path, value) {
  ensureDirectory(dirname3(path));
  let source = `${JSON.stringify(value, null, 2)}
`;
  if (Buffer.byteLength(source) > MAX_RECEIPT_BYTES) throw new Error("native Review receipt exceeds size limit");
  let temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync2(temporary, source, { encoding: "utf8", mode: 384 }), renameSync2(temporary, path);
  try {
    chmodSync2(path, 384);
  } catch {
  }
}
function readJson2(path) {
  try {
    let value = JSON.parse(readFileSync3(path, "utf8"));
    return value && typeof value == "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
function canonicalValue(value) {
  return Array.isArray(value) ? value.map(canonicalValue) : !value || typeof value != "object" ? value : Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}
function nativeReviewReceiptBindingHash(receipt) {
  if (!receipt || typeof receipt != "object" || Array.isArray(receipt)) return null;
  let {
    binding_hash: ignoredBindingHash,
    consumed_at: ignoredConsumedAt,
    expired_at: ignoredExpiredAt,
    revoked_at: ignoredRevokedAt,
    ...binding
  } = receipt;
  return sha2563(JSON.stringify(canonicalValue(binding)));
}
function nativeReviewRequestHash(input = {}) {
  let semantic = {
    artifact_kind: input.artifact_kind ?? "delivery-evidence",
    effective_profile: input.effective_profile ?? "manual",
    strategy_revision: input.strategy_revision ?? 0,
    check_evidence: input.check_evidence ?? [],
    review_input: input.review_input ?? null,
    summary: input.summary ?? null
  };
  return sha2563(JSON.stringify(canonicalValue(semantic)));
}
function nativeReviewReceiptDirectory(stateRoot, bucket = "pending") {
  return join3(stateRoot, "manual-native-task-review", "receipts", bucket);
}
function nativeReviewReceiptPath(stateRoot, token, bucket = "pending") {
  return typeof token != "string" || !TOKEN_PATTERN.test(token) ? null : join3(nativeReviewReceiptDirectory(stateRoot, bucket), `${sha2563(token)}.json`);
}
function validReceipt(receipt, stateRoot, tokenHash, requestHash) {
  return receipt?.schema === 4 && receipt?.kind === "cursor-native-review-receipt" && /^[a-f0-9]{64}$/.test(String(receipt.binding_hash ?? "")) && receipt.binding_hash === nativeReviewReceiptBindingHash(receipt) && receipt.token_hash === tokenHash && receipt.request_hash === requestHash && receipt.workspace_hash === sha2563(stateRoot).slice(0, 32) && /^[a-f0-9]{32}$/.test(String(receipt.conversation_hash ?? "")) && /^[a-f0-9]{32}$/.test(String(receipt.generation_hash ?? "")) && /^[a-f0-9]{32}$/.test(String(receipt.tool_hash ?? "")) && Number.isInteger(receipt.context_revision) && receipt.context_revision > 0 && /^[a-f0-9]{64}$/.test(String(receipt.root_hash ?? "")) && typeof receipt.root_text == "string" && receipt.root_hash === sha2563(receipt.root_text) && validRootBinding(receipt.root_binding, receipt.root_source) && Array.isArray(receipt.artifacts) && ["task-chain", "full-rebuild"].includes(receipt.predecessor_mode) && receipt.artifacts.length > 0 == (receipt.predecessor_mode === "task-chain") && validBaselineBinding(receipt) && validReviewEnforcement(receipt.review_enforcement) && Number.isFinite(Date.parse(receipt.expires_at));
}
function validRootBinding(value, rootSource) {
  return !value || typeof value != "object" || Array.isArray(value) || !Array.isArray(value.reason_codes) || value.reason_codes.some((reason) => typeof reason != "string") ? !1 : value.status === "enforced" ? ["post-tool-use", "task-transcript-stop"].includes(value.source) && value.reason_codes.length === 0 && rootSource === "cursor-create-plan" : value.status === "provisional" && value.source === "recent-plan-file-stop" && value.reason_codes.includes("native-plan-transcript-unavailable") && rootSource === "cursor-plan-file";
}
function validReviewEnforcement(value) {
  return value && ["enforced", "unavailable"].includes(value.status) && Array.isArray(value.reason_codes) && value.reason_codes.every((reason) => typeof reason == "string") && (value.status === "enforced" ? value.reason_codes.length === 0 : value.reason_codes.includes("review-observer-unavailable"));
}
function validBaselineBinding(receipt) {
  let attribution = receipt?.repository_attribution, epoch = receipt?.mutation_epoch;
  if (!attribution || typeof attribution != "object" || !epoch || typeof epoch != "object" || !/^[a-f0-9]{64}$/.test(String(epoch.id ?? "")) || !["open", "closed"].includes(epoch.status)) return !1;
  let computed = repositorySnapshotHash(receipt.baseline);
  return computed ? typeof receipt.workspace_root != "string" || typeof receipt.baseline?.repository_root != "string" ? !1 : receipt.baseline_hash === computed && epoch.baseline_hash === computed && attribution.baseline_available === !0 && attribution.baseline_hash === computed && resolve4(receipt.workspace_root) === resolve4(receipt.baseline.repository_root) : receipt.baseline === null && receipt.baseline_hash === null && epoch.baseline_hash === null && attribution.baseline_available === !1 && attribution.baseline_hash === null;
}
function moveClaimedReceipt(source, target, receipt, field, options) {
  ensureDirectory(dirname3(target));
  try {
    renameSync2(source, target);
  } catch (error) {
    if (error?.code === "ENOENT") return !1;
    throw error;
  }
  return atomicNativeReviewReceipt(target, { ...receipt, [field]: timestamp(options) }), !0;
}
function consumeNativeReviewReceipt({ stateRoot, token, input = {}, options = {} }) {
  if (typeof token != "string" || !TOKEN_PATTERN.test(token)) return { status: "unavailable" };
  let tokenHash = sha2563(token), requestHash = nativeReviewRequestHash(input), pendingPath = nativeReviewReceiptPath(stateRoot, token, "pending"), consumedPath = nativeReviewReceiptPath(stateRoot, token, "consumed"), expiredPath = nativeReviewReceiptPath(stateRoot, token, "expired"), currentMs = nowMs(options);
  if (!existsSync4(pendingPath)) {
    let consumed = readJson2(consumedPath);
    if (consumed)
      return validReceipt(consumed, stateRoot, tokenHash, consumed.request_hash) ? consumed.request_hash === requestHash ? { status: "replayed" } : { status: "mismatch" } : { status: "mismatch" };
    let expired = readJson2(expiredPath);
    return expired ? validReceipt(expired, stateRoot, tokenHash, expired.request_hash) ? expired.request_hash === requestHash ? { status: "expired" } : { status: "mismatch" } : { status: "mismatch" } : { status: "unavailable" };
  }
  let receipt = readJson2(pendingPath);
  return validReceipt(receipt, stateRoot, tokenHash, requestHash) ? Date.parse(receipt.expires_at) <= currentMs ? (moveClaimedReceipt(pendingPath, expiredPath, receipt, "expired_at", options), { status: "expired" }) : moveClaimedReceipt(pendingPath, consumedPath, receipt, "consumed_at", options) ? { status: "resolved", receipt } : existsSync4(consumedPath) ? { status: "replayed" } : { status: "unavailable" } : { status: "mismatch" };
}

// src/mcp/workspace-roots.mjs
import { lstatSync, realpathSync as realpathSync2, statSync as statSync2 } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute as isAbsolute2, resolve as resolve5 } from "node:path";
import { fileURLToPath } from "node:url";
var HOST_WORKSPACE_ENV = "GELDMACHER_WORKFLOW_WORKSPACE_ROOT", WorkspaceRootError = class extends Error {
  constructor(code, message, options = {}) {
    super(message, options), this.name = "WorkspaceRootError", this.code = code;
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
    canonical = realpathSync2(advertised);
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
  if (!root || typeof root.uri != "string") throw new WorkspaceRootError("root-invalid", "MCP client returned an invalid workspace root");
  let url;
  try {
    url = new URL(root.uri);
  } catch (error) {
    throw new WorkspaceRootError("root-invalid", `MCP client returned an invalid workspace root URI: ${root.uri}`, { cause: error });
  }
  if (url.protocol !== "file:") throw new WorkspaceRootError("root-non-file", `Workflow supports only file workspace roots: ${root.uri}`);
  let advertised;
  try {
    advertised = resolve5(fileURLToPath(url));
  } catch (error) {
    throw new WorkspaceRootError("root-invalid", `MCP client returned an invalid file workspace root: ${root.uri}`, { cause: error });
  }
  return validateDirectoryRoot(advertised, { label: "MCP workspace root" });
}
function hostConfiguredRoot(env = process.env, home = homedir()) {
  let raw = env?.[HOST_WORKSPACE_ENV];
  if (raw == null || String(raw).trim() === "") return null;
  let value = String(raw).trim();
  if (/\$\{[^}]+\}/.test(value)) return null;
  let expanded = value === "~" ? resolve5(home) : /^~[\\/]/.test(value) ? resolve5(home, value.slice(2)) : value;
  if (!isAbsolute2(expanded))
    throw new WorkspaceRootError(
      "host-workspace-invalid",
      `host-configured ${HOST_WORKSPACE_ENV} must be an absolute path or use ~/ for the current home: ${value}`
    );
  let advertised = resolve5(expanded);
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
    if (typeof listRoots != "function") throw new TypeError("WorkspaceRootAuthority requires listRoots");
    this.listRoots = listRoots, this.env = options.env ?? process.env, this.home = options.home ?? homedir(), this.cached = null, this.unavailable = null;
  }
  invalidate() {
    this.cached = null, this.unavailable = null;
  }
  async roots() {
    if (this.unavailable) throw this.unavailable;
    this.cached || (this.cached = Promise.resolve().then(async () => {
      let response;
      try {
        response = await this.listRoots();
      } catch (error) {
        let reason = String(error?.message ?? error ?? "unknown error").replace(/\s+/g, " ").slice(0, 300);
        throw new WorkspaceRootError("roots-request-failed", `trusted MCP workspace roots request failed: ${reason}`, { cause: error });
      }
      let entries = (response?.roots ?? []).map(rootPath), unique2 = new Map(entries.map((entry) => [entry.canonical, entry]));
      if (unique2.size === 0) throw new WorkspaceRootError("roots-empty", "trusted MCP workspace roots list is empty");
      return [...unique2.values()].sort((left, right) => left.canonical.localeCompare(right.canonical));
    }));
    try {
      return await this.cached;
    } catch (error) {
      throw isWorkspaceRootsUnavailable(error) && (this.unavailable = error), this.cached = null, error;
    }
  }
  async resolve(selector = void 0) {
    let host = hostConfiguredRoot(this.env, this.home), roots = null, rootsError = null;
    try {
      roots = await this.roots();
    } catch (error) {
      if (!isWorkspaceRootsUnavailable(error)) throw error;
      rootsError = error;
    }
    if (host) {
      if (roots) {
        let allowed2 = roots.find((entry) => entry.advertised === host.advertised || entry.canonical === host.canonical);
        if (!allowed2) throw new WorkspaceRootError("root-foreign", `host-configured workspace_root is not an advertised MCP root: ${host.advertised}`);
        if (host.canonical !== allowed2.canonical)
          throw new WorkspaceRootError("root-drift", `host-configured workspace_root changed after MCP root discovery: ${host.advertised}`);
      }
      if (selector != null && selector !== "") {
        let requested = resolve5(selector);
        if (requested !== host.advertised && requested !== host.canonical)
          throw new WorkspaceRootError("root-foreign", `workspace_root does not match host-configured workspace: ${requested}`);
      }
      return host.canonical;
    }
    if (rootsError) throw rootsError;
    if (selector == null || selector === "") {
      if (roots.length !== 1) throw new WorkspaceRootError("roots-multiple", "multiple MCP workspace roots require workspace_root");
      return roots[0].canonical;
    }
    let advertised = resolve5(selector), allowed = roots.find((entry) => entry.advertised === advertised);
    if (!allowed) throw new WorkspaceRootError("root-foreign", `workspace_root is not an advertised MCP root: ${advertised}`);
    let canonical;
    try {
      canonical = realpathSync2(advertised);
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
  receiptOptions = {},
  clientHost = "portable",
  consumeReviewReceipt = consumeNativeReviewReceipt
}) {
  let toolResult = (toolName, value, isError = !1) => typeof result2 == "function" && result2.toolAware === !0 ? result2(toolName, value, isError) : result2(value, isError), failure2 = (toolName) => (error) => toolResult(toolName, {
    error: error.message,
    ...error?.code ? { error_code: error.code } : {},
    ...Array.isArray(error?.attempted_sources) ? { attempted_sources: error.attempted_sources } : {},
    ...Array.isArray(error?.candidate_ids) ? { candidate_ids: error.candidate_ids } : {},
    ...Array.isArray(error?.rejected_sources) ? { rejected_sources: error.rejected_sources } : {},
    ...typeof error?.resolution == "string" ? { resolution: error.resolution } : {}
  }, !0), codedError2 = (code, message, details = {}) => {
    let error = new Error(message);
    return error.code = code, Object.assign(error, details), error;
  }, mergeArtifacts = (entries) => {
    let merged = /* @__PURE__ */ new Map();
    for (let entry of entries) {
      let prior = merged.get(entry.label);
      if (prior && prior.text !== entry.text) throw new Error(`closeout artifact label ${entry.label} has conflicting text`);
      merged.set(entry.label, {
        label: entry.label,
        text: entry.text,
        ...entry.builder_provenance ? { builder_provenance: entry.builder_provenance } : prior?.builder_provenance ? { builder_provenance: prior.builder_provenance } : {},
        ...entry.legacy_review_recorded === !0 || prior?.legacy_review_recorded === !0 ? { legacy_review_recorded: !0 } : {}
      });
    }
    return merged;
  }, inferredRootPlanId = (rootPlanId, artifacts = []) => {
    if (rootPlanId) return rootPlanId;
    for (let entry of artifacts) {
      if (!entry?.text) continue;
      let inspected = inspectArtifactText(entry.text, pluginRoot2);
      if (!(inspected.errors.length > 0)) {
        if (inspected.artifact?.fields?.artifact === "work-plan") return inspected.artifact.fields.id;
        if (inspected.artifact?.fields?.artifact === "work-review" || inspected.artifact?.fields?.artifact === "delivery-evidence") return inspected.artifact.fields.root_plan_id;
      }
    }
    return null;
  }, containsRootEvidence = (artifacts = [], rootPlanId = null) => artifacts.some((entry) => {
    if (typeof entry?.text != "string") return !1;
    let inspected = inspectArtifactText(entry.text, pluginRoot2), fields = inspected.artifact?.fields;
    return inspected.errors.length === 0 && fields?.artifact === "delivery-evidence" && (!rootPlanId || fields.root_plan_id === rootPlanId);
  }), assertConsistentArtifactTexts = (artifacts = [], { rootPlan = null } = {}) => {
    let byId = /* @__PURE__ */ new Map(), consider = (text, label = "artifact") => {
      if (typeof text != "string" || !text.trim()) return;
      let inspected = inspectArtifactText(text, pluginRoot2);
      if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) return;
      let id = inspected.artifact.fields.id, prior = byId.get(id);
      if (prior && prior !== text)
        throw new Error(`handoff artifact ${id} has conflicting text`);
      return byId.set(id, text), id;
    };
    rootPlan && consider(rootPlan, "root");
    for (let entry of artifacts)
      consider(entry?.text, entry?.label ?? "artifact");
    return byId;
  }, contentHandoff = ({ rootPlanId = null, rootPlan = null, artifacts = [], remember = !1 } = {}) => {
    assertConsistentArtifactTexts(artifacts, { rootPlan });
    let resolvedId = inferredRootPlanId(rootPlanId, artifacts), rootPlanText = resolveRootPlanText(pluginRoot2, { rootPlanId: resolvedId, rootPlan, artifacts }), root_content_hash = rootContentHash(rootPlanText), handoffStore = handoffStoreFactory(rootPlanText, pluginRoot2);
    return remember && rememberContentAddressedRoot(rootPlanText, pluginRoot2), { rootPlanText, root_content_hash, handoffStore, rootPlanId: resolvedId };
  }, hydrateLineageArtifacts = (rootPlanText, handoffStore, workspace = null) => {
    let seeded = [], current = rootPlanText, seen = /* @__PURE__ */ new Set();
    for (; current; ) {
      let inspected = inspectArtifactText(current, pluginRoot2), id = inspected.artifact?.fields?.id;
      if (!id || seen.has(id)) break;
      seen.add(id), seeded.push({ label: id, text: current });
      try {
        let chain = handoffStore.context(id, current);
        for (let entry of chain.artifacts) seeded.push({ label: entry.label, text: entry.text });
      } catch {
      }
      let predecessorId = inspected.artifact?.fields?.predecessor_plan_id;
      if (!predecessorId) break;
      try {
        current = resolveRootPlanText(pluginRoot2, { rootPlanId: predecessorId });
      } catch {
        break;
      }
      let predecessorStore = handoffStoreFactory(current, pluginRoot2);
      bindBoundaryTrust(predecessorStore, workspace);
      try {
        let chain = predecessorStore.context(predecessorId, current);
        for (let entry of chain.artifacts) seeded.push({ label: entry.label, text: entry.text });
      } catch {
        seeded.push({ label: predecessorId, text: current });
      }
    }
    return seeded;
  }, optionalOperational = async (workspaceRoot3) => {
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
  }, bindBoundaryTrust = (handoffStore, workspace) => {
    handoffStore.artifactSetOptions = workspace ? { boundaryReceiptVerifier: boundaryReceiptVerifier({ pluginRoot: pluginRoot2, workspaceRoot: workspace, options: receiptOptions }) } : {};
  }, buildCloseout = (input, merged, workspace = null) => {
    let rootPlan = input.root_plan ?? [...merged.values()].find((entry) => {
      let inspected = inspectArtifactText(entry.text, pluginRoot2);
      return inspected.artifact?.fields?.artifact === "work-plan" && inspected.artifact.fields.id === input.root_plan_id;
    })?.text;
    if (!rootPlan) throw new Error("workflow_closeout requires the active Root text or a cached Root");
    if ((input.artifact_kind ?? "delivery-evidence") === "work-review") {
      if (!input.review_input)
        throw codedError2("review-input-invalid", "workflow_closeout work-review mode requires review_input schema 1; Root, Evidence, and repository work remain unchanged, so correct the named review_input field and repeat Review in this task");
      let reviewResult = buildWorkReview({
        rootPlanText: rootPlan,
        artifacts: [...merged.values()],
        reviewInput: input.review_input,
        pluginRoot: pluginRoot2
      });
      if (reviewResult.fields.root_plan_id !== input.root_plan_id) throw new Error(`workflow_closeout Root ID mismatch: expected ${input.root_plan_id}, received ${reviewResult.fields.root_plan_id}`);
      return { rootPlan, closeoutResult: reviewResult, artifactKind: "work-review" };
    }
    if (input.review_input) throw new Error("workflow_closeout review_input is allowed only when artifact_kind is work-review");
    let manualCheckReceipts = workspace ? loadManualCheckReceipts({ rootPlanText: rootPlan, pluginRoot: pluginRoot2, workspaceRoot: workspace, options: receiptOptions }) : [], closeoutResult = buildDeliveryEvidence({
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
  }, closeoutPayload = ({
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
    workspace_root_used: !!workspace,
    root_plan_id: input.root_plan_id,
    delivery_evidence_id: closeoutResult.fields.id,
    artifact: persisted.artifact,
    artifact_hash: persisted.artifact_hash ?? createHash5("sha256").update(persisted.artifact).digest("hex"),
    evidence_mode: persisted.fields.evidence_mode,
    overall_grade: persisted.fields.overall_grade,
    status: persisted.fields.status,
    subject_id: persisted.fields.subject_id ?? input.root_plan_id,
    source_review_id: persisted.fields.source_review_id ?? null,
    predecessor_evidence_id: persisted.fields.predecessor_evidence_id ?? null,
    changed_paths: persisted.fields.changed_paths ?? input.changed_paths ?? [],
    check_evidence: persisted.fields.check_evidence ?? [],
    ...persisted.fields.extensions?.workflow?.repository_attribution ? { repository_attribution: persisted.fields.extensions.workflow.repository_attribution } : {},
    duplicate: persisted.duplicate,
    handoff_persisted: persisted.handoff_persisted,
    handoff_authoritative: !1,
    handoff_mode: handoffMode ?? (persisted.handoff_persisted ? "root-content-cache" : "stateless"),
    ...rootContentHashValue ? { root_content_hash: rootContentHashValue } : {},
    ...closeoutResult.constraint_summary ? { constraint_summary: closeoutResult.constraint_summary } : {},
    ...closeoutResult.human_attention ? { human_attention: closeoutResult.human_attention } : {},
    ...closeoutResult.problem_details ? { problem_details: closeoutResult.problem_details } : {},
    ...persisted.artifact_set_hash ? { artifact_set_hash: persisted.artifact_set_hash } : {},
    ...warning ? { warning } : {},
    ...handoffErrorCode || persisted.handoff_error_code ? { handoff_error_code: handoffErrorCode ?? persisted.handoff_error_code } : {}
  }), reviewPayload = ({
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
    workspace_root_used: !!workspace,
    artifact_kind: "work-review",
    root_plan_id: input.root_plan_id,
    work_review_id: reviewResult.fields.id,
    artifact: persisted.artifact,
    artifact_hash: persisted.artifact_hash ?? createHash5("sha256").update(persisted.artifact).digest("hex"),
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
    task_local_valid: !0,
    handoff_persisted: persisted.handoff_persisted,
    handoff_authoritative: !1,
    handoff_mode: handoffMode ?? (persisted.handoff_persisted ? "root-content-cache" : "stateless"),
    ...rootContentHashValue ? { root_content_hash: rootContentHashValue } : {},
    ...persisted.artifact_set_hash ? { artifact_set_hash: persisted.artifact_set_hash } : {},
    ...warning ? { warning } : {},
    ...handoffErrorCode || persisted.handoff_error_code ? { handoff_error_code: handoffErrorCode ?? persisted.handoff_error_code } : {}
  }), reviewBundlePayload = ({ input, workspace, bundle, rootPlanId, rootContentHashValue, nativeBinding = null }) => ({
    ...workspace ? { workspace_root: workspace } : {},
    workspace_binding: workspace ? "trusted-root" : "not-established",
    workspace_root_used: !!workspace,
    artifact_kind: "work-review",
    root_plan_id: rootPlanId,
    root_content_hash: rootContentHashValue,
    delivery_evidence_id: bundle.delivery_evidence.fields.id,
    delivery_evidence_artifact: bundle.delivery_evidence.artifact,
    delivery_evidence_hash: bundle.delivery_evidence.artifact_hash,
    work_review_id: bundle.review.fields.id,
    artifact: bundle.review.artifact,
    artifact_hash: bundle.review.artifact_hash,
    review_input_hash: bundle.review.review_input_hash,
    authoritative_fields: bundle.review.fields,
    assessment: bundle.review.fields.assessment,
    delivery_status: bundle.review.fields.delivery_status,
    evidence_status: bundle.delivery_evidence.fields.status,
    evidence_grade: bundle.delivery_evidence.fields.overall_grade,
    check_evidence: bundle.delivery_evidence.fields.check_evidence ?? [],
    finding_ids: (bundle.review.normalized_review_input?.findings ?? []).map((finding2) => finding2.key).filter(Boolean),
    next_action: bundle.review.fields.next_action,
    review_route: bundle.review.fields.review_route,
    latest_evidence_id: bundle.review.fields.latest_evidence_id,
    predecessor_review_id: bundle.review.fields.predecessor_review_id ?? null,
    correction_id: bundle.review.fields.correction_id ?? null,
    changed_paths: bundle.changed_paths,
    observed_dirty_paths: bundle.observed_dirty_paths,
    pre_existing_paths: bundle.pre_existing_paths ?? [],
    repository_snapshot: bundle.repository_snapshot,
    repository_state_hash: bundle.repository_state_hash,
    chain_update: bundle.chain_update,
    repository_attribution: bundle.repository_attribution ?? {
      status: "provisional",
      boundary: "unknown",
      baseline_hash: null,
      reason_codes: ["attribution-unavailable"]
    },
    duplicate: bundle.review.duplicate && bundle.delivery_evidence.duplicate,
    task_local_valid: !0,
    handoff_persisted: !1,
    handoff_authoritative: !1,
    handoff_mode: "task-local",
    ...nativeBinding ? {
      native_task_binding: nativeBinding.binding_source,
      native_root_source: nativeBinding.root_source,
      native_root_binding: nativeBinding.root_binding,
      predecessor_mode: nativeBinding.predecessor_mode,
      implementation_authorization: "host-owned-unattested",
      review_selection_source: nativeBinding.review_selection_source ?? "explicit-review-command",
      review_enforcement: nativeBinding.review_enforcement ?? { status: "enforced", reason_codes: [] }
    } : {}
  });
  return Object.freeze({ record: async (input) => {
    try {
      if (bundleSize(input.artifacts) > 1e6) throw new Error("handoff artifact bundle exceeds 1000000 characters");
      for (let entry of input.artifacts) {
        let inspected = inspectArtifactText(entry.text, pluginRoot2);
        if (inspected.errors.length > 0 || inspected.artifact?.fields?.schema !== 5 || inspected.artifact?.fields?.artifact !== "work-plan")
          throw inspected.artifact?.fields?.artifact === "work-review" ? codedError2("review-artifact-rejected", "new full model-authored work-review artifacts cannot establish authority; pass review_input schema 1 to workflow_closeout with artifact_kind work-review and repeat Review in this task") : new Error("workflow_artifact_record accepts only valid Schema-5 work-plan artifacts");
      }
      let rootPlanText, root_content_hash, handoffStore;
      try {
        ({ rootPlanText, root_content_hash, handoffStore } = contentHandoff({
          rootPlan: input.root_plan,
          artifacts: input.artifacts,
          remember: !0
        }));
      } catch (error) {
        if (/conflict|invalid|corrupt|incompatible|stale|ambiguous|multiple|exact Root/i.test(error.message)) throw error;
        return toolResult("workflow_artifact_record", {
          workspace_binding: "not-established",
          workspace_root_used: !1,
          handoff_authoritative: !1,
          handoff_persisted: !1,
          handoff_mode: "stateless",
          handoff_error_code: "handoff-persist-failed",
          recorded: [],
          duplicates: [],
          warning: `handoff cache unavailable: ${error.message}; attach the exact artifact explicitly to the next Workflow command`
        });
      }
      let operational = await optionalOperational(input.workspace_root);
      bindBoundaryTrust(handoffStore, operational.workspace);
      let lineage = hydrateLineageArtifacts(rootPlanText, handoffStore, operational.workspace), byId = /* @__PURE__ */ new Map();
      for (let entry of [...lineage, ...input.artifacts]) {
        let inspected = inspectArtifactText(entry.text, pluginRoot2);
        if (inspected.errors.length > 0 || !inspected.artifact?.fields?.id) {
          let priorLabel = byId.get(entry.label);
          if (priorLabel && priorLabel.text !== entry.text)
            throw new Error(`handoff artifact label ${entry.label} has conflicting text`);
          byId.set(entry.label, entry);
          continue;
        }
        let id = inspected.artifact.fields.id, prior = byId.get(id);
        if (prior && prior.text !== entry.text)
          throw new Error(`handoff artifact ${id} has conflicting text`);
        byId.set(id, { label: id, text: entry.text });
      }
      try {
        let recorded = handoffStore.record([...byId.values()]);
        return toolResult("workflow_artifact_record", {
          ...operational.workspace ? { workspace_root: operational.workspace } : {},
          workspace_binding: operational.workspace_binding,
          workspace_root_used: !!operational.workspace,
          handoff_authoritative: !1,
          handoff_persisted: !0,
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
          workspace_root_used: !!operational.workspace,
          handoff_authoritative: !1,
          handoff_persisted: !1,
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
  }, context: async (input) => {
    try {
      let { root_content_hash, handoffStore } = contentHandoff({
        rootPlanId: input.root_plan_id,
        rootPlan: input.root_plan,
        artifacts: input.artifacts
      }), operational = await optionalOperational(input.workspace_root);
      bindBoundaryTrust(handoffStore, operational.workspace);
      let chain = handoffStore.context(input.root_plan_id, input.root_plan ?? null);
      return toolResult("workflow_artifact_context", {
        ...operational.workspace ? { workspace_root: operational.workspace } : {},
        workspace_binding: operational.workspace_binding,
        workspace_root_used: !!operational.workspace,
        handoff_authoritative: !1,
        handoff_mode: "root-content-cache",
        root_content_hash,
        ...chain,
        model_inheritance: operational.stateRoot ? modelInheritanceSummary(operational.stateRoot) : { authoritative: !1, status: "unavailable", evidence_effect: "none", reason: "workspace-binding-not-established" }
      });
    } catch (error) {
      return failure2("workflow_artifact_context")(error);
    }
  }, closeout: async (input) => {
    try {
      if (bundleSize(input.artifacts) > 1e6) throw new Error("closeout artifact bundle exceeds 1000000 characters");
      let operational = await optionalOperational(input.workspace_root);
      if ((input.artifact_kind ?? "delivery-evidence") !== "work-review" && !input.root_plan_id)
        throw codedError2("root-plan-id-required", "workflow_closeout delivery-evidence mode requires root_plan_id");
      if ((input.artifact_kind ?? "delivery-evidence") === "work-review") {
        let rootPlanText2 = input.root_plan ?? null, rootPlanId = input.root_plan_id ?? null, taskArtifacts = input.artifacts ?? [], nativeBinding = null, nativeReceipt = null;
        if (clientHost === "cursor") {
          if (!operational.workspace || !operational.stateRoot)
            throw codedError2("native-task-receipt-unavailable", "Cursor work-review could not establish the trusted workspace needed for its native task receipt");
          if (!input.native_review_receipt)
            throw codedError2("native-task-receipt-unavailable", "Cursor work-review requires the opaque receipt injected by the native preToolUse hook. Repeat /review-work in the same task; do not set native_review_receipt yourself.");
          let consumed = consumeReviewReceipt({
            stateRoot: operational.stateRoot,
            token: input.native_review_receipt,
            input,
            options: receiptOptions
          }), receiptFailures = {
            unavailable: ["native-task-receipt-unavailable", "No protected Cursor task receipt matched this work-review call. Repeat /review-work in the same approved native Plan task."],
            expired: ["native-task-receipt-expired", "The protected Cursor task receipt expired before workflow_closeout consumed it. Repeat /review-work to create a fresh receipt."],
            replayed: ["native-task-receipt-replayed", "This protected Cursor task receipt was already consumed. Repeat /review-work to create a fresh receipt."],
            mismatch: ["native-task-receipt-mismatch", "The protected Cursor task receipt does not match this work-review call. Repeat /review-work without model-supplied Root transport."],
            stale: ["native-task-receipt-stale", "The Cursor Root, repository epoch, or native Review turn changed before workflow_closeout consumed its receipt. Start a fresh /review-work turn."],
            busy: ["native-review-busy", "Another Cursor Review call is already active for this Root. Wait for it to finish or repeat /review-work after its failure."],
            invalid: ["native-task-receipt-invalid", "The protected Cursor task receipt is invalid. Create a fresh Plan and repeat /review-work."]
          };
          if (consumed.status !== "resolved") {
            let [code, message] = receiptFailures[consumed.status] ?? receiptFailures.unavailable;
            throw codedError2(code, message);
          }
          if (input.root_plan_id && input.root_plan_id !== consumed.receipt.root_plan_id)
            throw codedError2("native-task-receipt-mismatch", `Cursor work-review Root ID mismatch: host-approved ${consumed.receipt.root_plan_id}, model supplied ${input.root_plan_id}`);
          rootPlanText2 = consumed.receipt.root_text, rootPlanId = consumed.receipt.root_plan_id, taskArtifacts = consumed.receipt.artifacts ?? [], nativeReceipt = consumed.receipt, nativeBinding = {
            binding_source: "cursor-receipt",
            root_source: consumed.receipt.root_source,
            root_binding: consumed.receipt.root_binding,
            predecessor_mode: consumed.receipt.predecessor_mode ?? "full-rebuild",
            review_selection_source: consumed.receipt.review_selection_source,
            review_enforcement: consumed.receipt.review_enforcement
          };
        }
        let nativePlan = resolveNativePlan({
          candidates: rootPlanText2 ? [{ source: nativeBinding ? "protected Cursor native task receipt" : "workflow_closeout.root_plan from current Review task", root_text: rootPlanText2 }] : [],
          attemptedSources: [nativeBinding ? "protected Cursor native task receipt" : "workflow_closeout.root_plan from current Review task"],
          pluginRoot: pluginRoot2
        });
        if (nativePlan.status !== "resolved")
          throw codedError2(
            `native-plan-${nativePlan.status}`,
            `workflow_closeout work-review native Root is ${nativePlan.status}. Inspected: ${nativePlan.attempted_sources.join(", ") || "no native source was supplied"}. ${nativePlan.resolution}`,
            nativePlan
          );
        if (nativeReceipt && nativePlan.root_hash !== nativeReceipt.root_hash)
          throw codedError2("native-task-receipt-mismatch", "Cursor work-review native task receipt Root hash changed before review construction");
        if (!operational.workspace)
          throw codedError2(
            "review-workspace-unavailable",
            `workflow_closeout could not inspect the current repository${operational.workspace_error?.message ? `: ${operational.workspace_error.message}` : ""}`
          );
        let bundle = buildManualReviewLifecycle({
          rootPlanText: nativePlan.root_text,
          artifacts: taskArtifacts,
          reviewInput: input.review_input,
          checkEvidence: input.check_evidence ?? [],
          strategyRevision: input.strategy_revision ?? 0,
          summary: input.summary ?? null,
          workspaceRoot: operational.workspace,
          pluginRoot: pluginRoot2,
          repositoryBaseline: nativeReceipt?.baseline ?? null,
          repositoryAttribution: nativeReceipt?.repository_attribution ? {
            status: nativeReceipt.repository_attribution.status === "bounded" && nativeReceipt.review_enforcement?.status === "enforced" && nativeReceipt.root_binding?.status === "enforced" ? "attributed" : "provisional",
            boundary: nativeReceipt.repository_attribution.boundary,
            reason_codes: [.../* @__PURE__ */ new Set([
              ...nativeReceipt.repository_attribution.reason_codes ?? [],
              ...nativeReceipt.review_enforcement?.reason_codes ?? [],
              ...nativeReceipt.root_binding?.reason_codes ?? []
            ])]
          } : null
        });
        if (!rootPlanId || nativePlan.root_id !== rootPlanId || bundle.root_plan_id !== rootPlanId)
          throw new Error(`workflow_closeout Root ID mismatch: expected ${rootPlanId ?? "<unavailable>"}, received ${bundle.root_plan_id}`);
        if (nativeReceipt) {
          let postBuildRepositoryHash = repositorySnapshotHash(captureRepositorySnapshot(operational.workspace));
          if (!bundle.repository_state_hash || postBuildRepositoryHash !== bundle.repository_state_hash)
            throw codedError2(
              "native-task-receipt-stale",
              "Cursor work-review repository state changed during repository observation. Start a fresh /review-work turn."
            );
          let revalidated = validateConsumedNativeReviewReceipt({
            stateRoot: operational.stateRoot,
            receipt: nativeReceipt,
            options: receiptOptions
          });
          if (revalidated.status !== "valid")
            throw codedError2(
              "native-task-receipt-stale",
              `Cursor work-review authority changed during repository observation (${revalidated.reason ?? revalidated.status}). Start a fresh /review-work turn.`
            );
        }
        return toolResult("workflow_closeout", reviewBundlePayload({
          input,
          workspace: operational.workspace,
          bundle,
          rootPlanId,
          rootContentHashValue: nativePlan.root_hash,
          nativeBinding
        }));
      }
      let handoff;
      try {
        handoff = contentHandoff({
          rootPlanId: input.root_plan_id,
          rootPlan: input.root_plan,
          artifacts: input.artifacts,
          remember: !0
        });
      } catch (error) {
        if (operational.legacyHandoffStore && !input.root_plan)
          try {
            let legacy = operational.legacyHandoffStore.context(input.root_plan_id, null), rootPlan2 = legacy.artifacts.find((entry) => entry.label === input.root_plan_id)?.text;
            rootPlan2 && (handoff = contentHandoff({
              rootPlanId: input.root_plan_id,
              rootPlan: rootPlan2,
              artifacts: [...legacy.artifacts, ...input.artifacts ?? []],
              remember: !0
            }));
          } catch {
          }
        if (!handoff) {
          if (!input.root_plan) throw error;
          let merged2 = mergeArtifacts(input.artifacts ?? []), { closeoutResult: closeoutResult2, artifactKind: artifactKind2 } = buildCloseout(input, merged2, operational.workspace);
          return toolResult("workflow_closeout", (artifactKind2 === "work-review" ? reviewPayload : closeoutPayload)({
            input,
            workspace: operational.workspace,
            workspaceBinding: operational.workspace_binding,
            ...artifactKind2 === "work-review" ? { reviewResult: closeoutResult2 } : { closeoutResult: closeoutResult2 },
            persisted: { ...closeoutResult2, handoff_persisted: !1 },
            warning: `optional cross-task handoff unavailable: ${error.message}; task-local ${artifactKind2 === "work-review" ? "Review" : "continuation"} remains valid`,
            handoffErrorCode: "handoff-persist-failed",
            handoffMode: "stateless"
          }));
        }
      }
      let { rootPlanText, root_content_hash, handoffStore } = handoff, cached = [], taskLocalReviewChain = (input.artifact_kind ?? "delivery-evidence") === "work-review" && containsRootEvidence(input.artifacts ?? [], input.root_plan_id);
      if (!taskLocalReviewChain)
        try {
          cached = handoffStore.context(input.root_plan_id, rootPlanText).artifacts.map(({ label, text, builder_provenance, legacy_review_recorded }) => ({ label, text, ...builder_provenance ? { builder_provenance } : {}, ...legacy_review_recorded === !0 ? { legacy_review_recorded: !0 } : {} }));
        } catch {
        }
      let merged = mergeArtifacts([...cached, ...input.artifacts ?? [], { label: "root", text: rootPlanText }]), { rootPlan, closeoutResult, artifactKind } = buildCloseout({ ...input, root_plan: rootPlanText }, merged, operational.workspace);
      if (artifactKind === "work-review" && taskLocalReviewChain && !closeoutResult.duplicate)
        try {
          let cachedReview = handoffStore.context(input.root_plan_id, rootPlanText).artifacts.find((entry) => entry.label === closeoutResult.fields.id);
          cachedReview?.text === closeoutResult.artifact && cachedReview.builder_provenance?.kind === "host-work-review-builder" && cachedReview.builder_provenance.review_input_hash === closeoutResult.review_input_hash && cachedReview.builder_provenance.artifact_hash === closeoutResult.artifact_hash && (closeoutResult = { ...closeoutResult, duplicate: !0 });
        } catch {
        }
      let persisted = artifactKind === "work-review" ? persistWorkReview({
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
      persisted.handoff_persisted && rememberContentAddressedRoot(rootPlan, pluginRoot2), artifactKind === "delivery-evidence" && persisted.handoff_persisted && operational.workspace && invalidateManualCheckReceipts({ rootPlanText: rootPlan, workspaceRoot: operational.workspace, options: receiptOptions });
      let selectorNotice = !operational.workspace && input.workspace_root ? `; the supplied workspace_root was not used (${operational.workspace_error?.code ?? "workspace-binding-not-established"})` : "", warning = persisted.warning ?? (selectorNotice ? `workspace binding unavailable${selectorNotice}` : void 0);
      return toolResult("workflow_closeout", (artifactKind === "work-review" ? reviewPayload : closeoutPayload)({
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
  } });
}

// src/mcp/manual-presentation.mjs
import { createHash as createHash6 } from "node:crypto";

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
}), HUMAN_WORKFLOW_PHASE_LABELS = Object.freeze({
  "plan-ready": "Plan ready",
  "in-progress": "In progress",
  "review-needed": "Review needed",
  "decision-needed": "Decision needed",
  blocked: "Blocked",
  completed: "Completed"
}), MANUAL_PRIMARY_ACTIONS = Object.freeze({
  "repair-root": Object.freeze({ label: "Repair the Root", command: "plan-work" }),
  "implement-plan": Object.freeze({ label: "Implement the Plan", command: "Implement Plan" }),
  "attach-artifact": Object.freeze({ label: "Export the exact artifact", command: "attach-artifact" }),
  "review-root": Object.freeze({ label: "Review delivery", command: "review-work" }),
  "accept-provisional": Object.freeze({ label: "Acknowledge the provisional gap", command: "accept-work" }),
  closeout: Object.freeze({ label: "Portable Evidence build", command: "workflow_closeout" }),
  correct: Object.freeze({ label: "Fix failing Checks", command: "correct-work" }),
  "approve-correction": Object.freeze({ label: "Apply bounded correction", command: "correct-work" }),
  "provide-artifacts": Object.freeze({ label: "Supply artifact chain", command: "work-status" }),
  replan: Object.freeze({ label: "Replan the Root", command: "plan-work replan" }),
  "retry-review": Object.freeze({ label: "Retry review", command: "review-work" }),
  answer: Object.freeze({ label: "Answer clarification", command: "answer clarification" }),
  "resolve-intent": Object.freeze({ label: "Resolve intent", command: "plan-work" }),
  "resolve-blocker": Object.freeze({ label: "Resolve the named blocker", command: "resolve blocker, then work-status" }),
  none: Object.freeze({ label: "Done", command: "none" }),
  learn: Object.freeze({ label: "Persist learnings", command: "learn-from-work" }),
  explain: Object.freeze({ label: "Explain the chain", command: "explain-work" })
}), MANUAL_HOST_ACTION_INVOKES = Object.freeze({
  cursor: Object.freeze({
    "repair-root": "/plan-work",
    "implement-plan": "Implement Plan",
    "attach-artifact": "Attach the exact artifact",
    "review-root": "/review-work",
    "accept-provisional": "/accept-work provisional",
    closeout: "/review-work",
    correct: "/correct-work",
    "approve-correction": "/correct-work",
    "provide-artifacts": "/work-status",
    replan: "/plan-work replan",
    "retry-review": "/review-work",
    answer: "Reply with the requested answer",
    "resolve-intent": "/plan-work",
    "resolve-blocker": "Fix the named cause, then run /work-status again",
    none: "No further Workflow action required",
    learn: "/learn-from-work",
    explain: "/explain-work"
  }),
  codex: Object.freeze({
    "repair-root": "$plan-work",
    "implement-plan": "Implement Plan",
    "attach-artifact": "Attach the exact artifact",
    "review-root": "$review-work",
    "accept-provisional": "$accept-work provisional",
    closeout: "$review-work",
    correct: "$correct-work",
    "approve-correction": "$correct-work",
    "provide-artifacts": "$work-status",
    replan: "$plan-work replan",
    "retry-review": "$review-work",
    answer: "Reply with the requested answer",
    "resolve-intent": "$plan-work",
    "resolve-blocker": "Fix the named cause, then run $work-status again",
    none: "No further Workflow action required",
    learn: "$learn-from-work",
    explain: "$explain-work"
  }),
  portable: Object.freeze({
    "repair-root": "plan-work",
    "implement-plan": "implement-work",
    "attach-artifact": "attach-artifact",
    "review-root": "review-work",
    "accept-provisional": "accept-work provisional",
    closeout: "workflow_closeout",
    correct: "correct-work",
    "approve-correction": "correct-work",
    "provide-artifacts": "work-status",
    replan: "plan-work replan",
    "retry-review": "review-work",
    answer: "Reply with the requested answer",
    "resolve-intent": "plan-work",
    "resolve-blocker": "Fix the named cause, then run work-status again",
    none: "No further Workflow action required",
    learn: "learn-from-work",
    explain: "explain-work"
  })
}), SAFE_BLOCKED_ACTIONS = /* @__PURE__ */ new Set([
  "repair-root",
  "attach-artifact",
  "review-root",
  "closeout",
  "provide-artifacts",
  "replan",
  "retry-review",
  "answer",
  "resolve-intent",
  "resolve-blocker"
]);
function normalizeManualPrimaryAction(presentation, action) {
  return action === "none" && presentation?.workflow_state === "stopped" ? "none" : !["blocked", "failed"].includes(presentation?.outcome) || SAFE_BLOCKED_ACTIONS.has(action) ? action : action === "implement-plan" ? "repair-root" : ["accept-provisional", "approve-correction", "correct"].includes(action) ? "retry-review" : "provide-artifacts";
}
function deriveManualJourneyState(presentation, action) {
  let state = presentation?.workflow_state;
  return ["achieved", "accepted-provisional"].includes(state) || action === "none" ? "done" : action === "implement-plan" ? "plan-ready" : action === "approve-correction" ? "correction-approval-required" : action === "replan" ? "replan-approval-required" : action === "accept-provisional" ? "provisional-acceptance-required" : ["blocked", "failed"].includes(presentation?.outcome) ? "blocked" : ["review-root", "retry-review"].includes(action) ? "review-ready" : ["answer", "resolve-intent", "resolve-blocker", "provide-artifacts"].includes(action) ? "clarification-required" : ["closeout", "attach-artifact"].includes(action) ? "closeout-recovery-required" : presentation?.phase === "review" ? "review-active" : "implementation-active";
}
function deriveHumanWorkflowPhase({ journeyState, workflowState, outcome } = {}) {
  return ["achieved", "accepted-provisional", "stopped"].includes(workflowState) || journeyState === "done" ? "completed" : journeyState === "plan-ready" ? "plan-ready" : ["review-ready", "review-active", "closeout-recovery-required"].includes(journeyState) ? "review-needed" : [
    "correction-approval-required",
    "replan-approval-required",
    "provisional-acceptance-required",
    "clarification-required"
  ].includes(journeyState) ? "decision-needed" : outcome === "blocked" || outcome === "failed" || journeyState === "blocked" ? "blocked" : "in-progress";
}
function taskBoundManualInvoke(action, _trace = {}, clientHost = "portable") {
  let host = MANUAL_HOST_ACTION_INVOKES[clientHost] ? clientHost : "portable";
  return MANUAL_HOST_ACTION_INVOKES[host][action] ?? MANUAL_PRIMARY_ACTIONS[action]?.command ?? String(action);
}

// src/mcp/manual-presentation.mjs
var MANUAL_TOOLS = /* @__PURE__ */ new Set([
  "workflow_plan_preflight",
  "workflow_artifact_record",
  "workflow_artifact_context",
  "workflow_closeout",
  "workflow_status"
]), MAX_DISPLAY_CHANGED_PATHS = 10, TERMINAL_READY_STATES = /* @__PURE__ */ new Set(["achieved", "accepted-provisional"]), TERMINAL_BLOCKED_STATES = /* @__PURE__ */ new Set(["blocked", "stopped", "failed"]), MANUAL_GUIDE_URL = "https://github.com/geldmacher/workflow/blob/main/docs/manual-workflow.md", MANUAL_GUIDE_LABEL = "Manual Workflow guide";
var HUMAN_PHASE_LABELS = HUMAN_WORKFLOW_PHASE_LABELS;
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
    "Cursor and Codex trust exact current-task artifact bytes; handoff remains portable transport and never restores native task authority."
  ),
  "recovery-and-troubleshooting": helpEntry(
    "recovery-and-troubleshooting",
    "recovery-and-troubleshooting",
    "The requested Workflow operation did not produce an actionable result; repair the reported input, chain, or environment issue before continuing."
  )
}), MANUAL_STATE_HELP = Object.freeze({
  "intent-clarification": helpEntry(
    "manual-state-intent-clarification",
    "manual-states",
    "The Root is not intent-ready because a material goal, acceptance, authority, or risk decision still needs a human answer."
  ),
  "root-plan-review": helpEntry(
    "manual-state-root-plan-review",
    "manual-states",
    "A ready native Intent Root exists and waits for human Implement Plan approval before repository implementation."
  ),
  "root-review": helpEntry(
    "manual-state-root-review",
    "manual-states",
    "Implementation finished and now needs fresh read-only Review to create Evidence and the delivery verdict atomically."
  ),
  "waiting-human": helpEntry(
    "manual-state-waiting-human",
    "manual-states",
    "Workflow needs the human to resolve the listed clarification, correction approval, or missing exact context."
  ),
  replan: helpEntry(
    "manual-state-replan",
    "manual-states",
    "The current Root or chain cannot safely authorize the required work and must be replaced through a newly approved plan."
  ),
  "delivery-ready-provisional": helpEntry(
    "manual-state-delivery-ready-provisional",
    "manual-states",
    "No known failed required Check blocks delivery, but proof remains incomplete or unavailable and needs an explicit human decision."
  ),
  "accepted-provisional": helpEntry(
    "manual-state-accepted-provisional",
    "manual-states",
    "The human acknowledged this evidence gap for one response; the delivery is still not verified and the acknowledgement is not persisted."
  ),
  achieved: helpEntry(
    "manual-state-achieved",
    "manual-states",
    "A fresh review verified the required Checks for this repository-only Root, so no further Workflow action is required."
  ),
  blocked: helpEntry(
    "manual-state-blocked",
    "manual-states",
    "A known failure or safety boundary prevents delivery and cannot be overridden by provisional acceptance."
  ),
  failed: helpEntry(
    "manual-state-failed",
    "manual-states",
    "Workflow could not produce a valid result; repair the reported failure before retrying."
  ),
  stopped: helpEntry(
    "manual-state-stopped",
    "manual-states",
    "This subject is intentionally non-actionable, commonly because it is read-only Workflow-3 or Workflow-4 history."
  )
}), MANUAL_EVIDENCE_HELP = Object.freeze({
  verified: helpEntry(
    "manual-evidence-verified",
    "evidence-grades",
    "The required Check was directly observed with the method and repetition needed for verified Evidence."
  ),
  supported: helpEntry(
    "manual-evidence-supported",
    "evidence-grades",
    "Meaningful inspection supports the claim, but the proof is not strong enough for verified delivery."
  ),
  partial: helpEntry(
    "manual-evidence-partial",
    "evidence-grades",
    "Some relevant proof exists, but it does not fully cover the required Check or expected result."
  ),
  unavailable: helpEntry(
    "manual-evidence-unavailable",
    "evidence-grades",
    "The required proof surface could not be used; the named limitation is missing proof, not success or failure."
  ),
  failed: helpEntry(
    "manual-evidence-failed",
    "evidence-grades",
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
  if (snapshot.run_id) return !1;
  let requested = snapshot.requested_profile ?? "manual", effective = snapshot.effective_profile ?? requested;
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
    benefit: "Delivers inside the approved Root and finishes normally.",
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
    recovery: "Run Review in the current task; its atomic builder creates any missing Evidence together with the Review."
  },
  "accept-provisional": {
    label: "Acknowledge the provisional gap",
    invoke: "Ask/Agent: /accept-work provisional or $accept-work provisional only for an explicit provisional acknowledgement",
    benefit: "Confirms this evidence gap for the current response without persisting acceptance.",
    blocked_when: "Current review is not provisional.",
    recovery: "Run a fresh review before acknowledging the gap."
  },
  closeout: {
    label: "Portable Evidence build",
    invoke: "Compatible portable client: call workflow_closeout delivery-evidence mode",
    benefit: "Preserves portable transport; Cursor and Codex use fresh Review instead.",
    blocked_when: "Exact Root/chain or Check observations are missing.",
    recovery: "On Cursor or Codex start fresh Review; portable clients supply exact artifacts and observations."
  },
  correct: {
    label: "Fix failing Checks",
    invoke: "Agent: repair failing required Checks, then run fresh Review",
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
  "resolve-blocker": {
    label: "Resolve the named blocker",
    invoke: "Fix the named cause, then run status again",
    benefit: "Removes the concrete blocker before status is inspected again.",
    blocked_when: "The named cause has not been resolved yet.",
    recovery: "Fix the blocker described above, then run status once to confirm the new state."
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
  return Array.isArray(value) ? value.map((entry) => typeof entry == "string" ? entry : String(entry && typeof entry == "object" ? entry.message ?? entry.code ?? JSON.stringify(entry) : entry)).filter(Boolean) : [];
}
function firstLine(text, fallback = "No summary.") {
  return String(text ?? "").replace(/\s+/g, " ").trim() || fallback;
}
function humanBlocker(value, fallbackRecovery = "Follow the single next action, then retry the same Workflow phase.") {
  let technical = firstLine(value, "Workflow could not complete this phase.");
  return /handoff|cache/i.test(technical) ? {
    reason: "Optional cross-task handoff is unavailable; the exact task-local chain is still usable in the current task.",
    recovery: "Continue in the current task. Export the exact artifact only if you intentionally switch tasks or hosts."
  } : /roots-request-failed|roots-empty|workspace roots|workspace binding/i.test(technical) ? {
    reason: "Workflow cannot establish an optional workspace handoff context.",
    recovery: "Continue with the exact artifacts already held in this task; otherwise select the current Root explicitly."
  } : /baseline/i.test(technical) ? {
    reason: "Workflow cannot prove which repository changes belong to this delivery because the pre-change baseline is unavailable.",
    recovery: "Use the named replan action to create a new clean approval and baseline boundary."
  } : /authority|outside (?:the )?(?:root|scope)|protected path|approval-required/i.test(technical) ? {
    reason: "The requested or observed change is outside the approved plan boundary.",
    recovery: "Keep the change inside the approved Root, or run plan-work replan and approve the expanded boundary."
  } : /required .*check.*failed|failed .*required .*check|check .*failed/i.test(technical) ? {
    reason: "A required verification Check failed, so Workflow cannot call the delivery successful.",
    recovery: "Run Review in this task, then apply its bounded correction or replan action."
  } : /missing .*evidence|evidence .*missing|no evidence tip/i.test(technical) ? {
    reason: "Delivery Evidence is not available yet for the approved Root.",
    recovery: fallbackRecovery
  } : /missing .*root|no .*root|exact root .*unavailable|root .*required/i.test(technical) ? {
    reason: "The approved Intent Root is not available in this task.",
    recovery: "Select or approve the exact current Root, then retry the same Workflow phase."
  } : /ambiguous|multiple|conflict|mismatch|different immutable/i.test(technical) ? {
    reason: "Workflow found conflicting or ambiguous versions and cannot determine one safe current chain.",
    recovery: "Select the exact current wp-* Root in this task and retry without reconstructing artifact text."
  } : { reason: technical, recovery: fallbackRecovery };
}
function resolveNextStep(action, overrides = {}) {
  let entry = NEXT_STEP_CATALOG[action], shared = MANUAL_PRIMARY_ACTIONS[action];
  if (!entry)
    return {
      action,
      label: shared?.label ?? action,
      invoke: action,
      benefit: "Continue with the stated Workflow action.",
      blocked_reason: overrides.blocked_reason ?? null,
      recovery: overrides.recovery ?? null,
      label_line: action
    };
  let blockedReason = overrides.blocked_reason ?? null, recovery = overrides.recovery ?? (blockedReason ? entry.recovery : null);
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
function uniqueLines(values) {
  return [...new Set(values.map((value) => firstLine(value, "")).filter(Boolean))];
}
function presentationSeverity(presentation) {
  let gaps = asList(presentation.gaps), attention = asList(presentation.human_attention), problems = asList(presentation.problems), errors = asList(presentation.errors), transitionBlocked = ["blocked", "failed"].includes(presentation.outcome), blockers = uniqueLines([
    ...asList(presentation.blocker ? [presentation.blocker] : []),
    ...transitionBlocked ? [...gaps, ...attention, ...problems, ...errors] : []
  ]), limitations = uniqueLines([
    ...asList(presentation.limitations),
    ...transitionBlocked ? [] : [...gaps, ...attention, ...problems]
  ]);
  return Object.freeze({
    blockers,
    limitations,
    warnings: uniqueLines(asList(presentation.warnings)),
    advisories: uniqueLines(asList(presentation.advisories))
  });
}
function firstBlocker(presentation) {
  return presentation.severity?.blockers?.[0] ?? presentationSeverity(presentation).blockers[0] ?? null;
}
function firstLimitation(presentation) {
  return presentation.severity?.limitations?.[0] ?? presentationSeverity(presentation).limitations[0] ?? null;
}
function canonicalValue2(value) {
  return Array.isArray(value) ? value.map(canonicalValue2) : value && typeof value == "object" ? Object.fromEntries(Object.keys(value).filter((key) => value[key] !== void 0).sort().map((key) => [key, canonicalValue2(value[key])])) : value ?? null;
}
function semanticPresentationHash(presentation) {
  let { deduplication_key: _key, update_suppressed: _suppressed, ...semantic } = presentation;
  return createHash6("sha256").update(JSON.stringify(canonicalValue2(semantic))).digest("hex");
}
function primaryActorFor(action) {
  return action === "none" ? "none" : ["review-root", "retry-review"].includes(action) ? "reviewer" : ["implement-plan", "accept-provisional", "approve-correction", "replan", "answer", "resolve-intent", "resolve-blocker"].includes(action) ? "human" : "agent";
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
    receipt_ids: presentation.receipt_ids ?? [],
    review_enforcement: presentation.review_enforcement ?? null
  };
}
function normalizedEnforcementLevel(value) {
  return ["host-native", "explicit"].includes(value) ? value : "explicit";
}
function finalizePresentation(presentation, { clientHost = presentation.client_host ?? "portable", primaryAction = void 0 } = {}) {
  let host = ["cursor", "codex", "portable"].includes(clientHost) ? clientHost : "portable", hasPrimaryOverride = primaryAction !== void 0, normalizedAction = hasPrimaryOverride ? primaryAction?.id ?? "none" : normalizeManualPrimaryAction(presentation, presentation.next_action ?? "none"), step = resolveNextStep(normalizedAction), technicalTraceability = presentation.technical_traceability ?? defaultTechnicalTraceability(presentation), journeyState = presentation.journey_state ?? journeyStateFor(presentation, normalizedAction), enforcementLevel = normalizedEnforcementLevel(presentation.enforcement_level), severity = presentationSeverity(presentation), humanPhase = deriveHumanWorkflowPhase({
    journeyState,
    workflowState: presentation.workflow_state,
    outcome: presentation.outcome
  }), actor = presentation.primary_actor ?? primaryAction?.actor ?? primaryActorFor(normalizedAction), primaryInvoke = primaryAction?.invoke ?? taskBoundManualInvoke(normalizedAction, technicalTraceability, host), actionValue = hasPrimaryOverride ? primaryAction ? { id: primaryAction.id, label: primaryAction.label, invoke: primaryAction.invoke, why: primaryAction.why } : null : normalizedAction === "none" ? null : { id: normalizedAction, label: step.label, invoke: primaryInvoke, why: step.benefit }, { blocker: _legacyBlocker, ...base } = presentation, finalized = {
    ...base,
    ...severity.blockers[0] ? { blocker: severity.blockers[0] } : {},
    journey_state: journeyState,
    human_projection: {
      phase: humanPhase,
      label: HUMAN_PHASE_LABELS[humanPhase],
      status: presentation.workflow_state ?? journeyState
    },
    limitations: severity.limitations,
    severity,
    primary_actor: actor,
    client_host: host,
    enforcement_level: enforcementLevel,
    primary_action: actionValue,
    technical_traceability: { ...technicalTraceability, enforcement_level: enforcementLevel },
    next_action: normalizedAction,
    next_action_label: actionValue?.label ?? step.label,
    next_action_invoke: actionValue?.invoke ?? taskBoundManualInvoke("none", technicalTraceability, host),
    next_action_benefit: actionValue?.why ?? step.benefit,
    update_suppressed: !1
  };
  return { ...finalized, deduplication_key: semanticPresentationHash(finalized) };
}
function withNextStepFields(presentation, action, overrides = {}) {
  let normalizedAction = normalizeManualPrimaryAction(presentation, action), step = resolveNextStep(normalizedAction, overrides), technicalTraceability = presentation.technical_traceability ?? defaultTechnicalTraceability(presentation), journeyState = presentation.journey_state ?? journeyStateFor(presentation, normalizedAction), enforcementLevel = normalizedEnforcementLevel(presentation.enforcement_level);
  return finalizePresentation({
    ...presentation,
    journey_state: journeyState,
    enforcement_level: enforcementLevel,
    technical_traceability: { ...technicalTraceability, enforcement_level: enforcementLevel },
    next_action: normalizedAction,
    next_action_label: step.label,
    next_action_invoke: taskBoundManualInvoke(normalizedAction, technicalTraceability),
    next_action_benefit: step.benefit,
    ...step.blocked_reason ? {
      next_action_blocked_reason: step.blocked_reason,
      next_action_recovery: step.recovery
    } : {}
  });
}
function withHelpFields(presentation, help) {
  return help ? { ...presentation, help } : presentation;
}
function formatHostToolApproval(value) {
  if (!value) return null;
  if (typeof value == "string") return `host approvals: ${value}; Workflow grants none`;
  if (typeof value != "object" || Array.isArray(value)) return `host approvals: ${String(value)}; Workflow grants none`;
  let mode = value.tool_approval ?? value.mode;
  if (!mode) return null;
  let source = value.source ? ` (source: ${value.source})` : "";
  return mode === "strict" ? `host approvals: per-call prompts expected${source}; Workflow grants none` : mode === "allowlisted" ? `host approvals: host allowlist expected${source}; preference grants none` : `host approvals: ${mode}${source}; Workflow grants none`;
}
function formatChangedPaths(paths, { maxDisplay = MAX_DISPLAY_CHANGED_PATHS } = {}) {
  if (!Array.isArray(paths) || paths.length === 0) return "changed paths: none";
  if (paths.length <= maxDisplay) return `changed paths (${paths.length}): ${paths.join(", ")}`;
  let shown = paths.slice(0, maxDisplay).join(", ");
  return `changed paths (${paths.length}, showing ${maxDisplay}): ${shown}, \u2026 (+${paths.length - maxDisplay} more)`;
}
function receiptCoverageLine(summary2) {
  let coverage = summary2?.receipt_coverage;
  return !coverage || !Number.isInteger(coverage.attested) || !Number.isInteger(coverage.eligible) ? null : `host-attested machine Checks: ${coverage.attested}/${coverage.eligible}`;
}
function repositoryAttribution(value) {
  let attribution = value?.repository_attribution;
  return !attribution || typeof attribution != "object" || Array.isArray(attribution) ? null : {
    status: attribution.status ?? "unknown",
    boundary: attribution.boundary ?? null,
    baseline_hash: attribution.baseline_hash ?? null,
    reason_codes: asList(attribution.reason_codes)
  };
}
function attributionLimitation2(value) {
  let attribution = repositoryAttribution(value);
  return attribution?.status !== "provisional" ? null : `Repository change attribution is provisional because ${attribution.reason_codes.some((code) => /baseline/.test(code)) ? "a reliable pre-change baseline is unavailable" : attribution.reason_codes.includes("native-plan-transcript-unavailable") ? "the exact task transcript was unavailable and the Root came only from one recent native Plan file" : attribution.reason_codes.some((code) => /concurrent|post-review|drift/.test(code)) ? "other repository activity overlaps the observed delivery" : "the repository boundary could not be attributed completely"}; verified behavior cannot prove that every observed change belongs to this delivery.`;
}
function reviewEnforcementLimitation(value) {
  return value?.review_enforcement?.status !== "unavailable" ? null : "Cursor could not enforce the Review activation because its observer was unavailable; Evidence is capped at supported. Verify Hook Trust, reload Cursor, then submit exactly /review-work again.";
}
function concreteEvidenceLimitations(value, evidenceChecks = []) {
  let missing = value?.constraint_summary?.evidence_gap_checks ?? [], limited = evidenceChecks.filter((entry) => ["supported", "partial", "unavailable"].includes(entry?.grade)), enforcementUnavailable = value?.review_enforcement?.status === "unavailable";
  return uniqueLines([
    ...missing.length > 0 ? [`Required proof is missing for ${missing.join(", ")}.`] : [],
    ...(enforcementUnavailable ? [] : limited).map((entry) => {
      let detail = asList(entry.limitations)[0];
      return detail ? `${entry.check_id}: ${detail}` : `${entry.check_id}: the available observation reaches only ${entry.grade} evidence.`;
    }),
    reviewEnforcementLimitation(value),
    attributionLimitation2(value)
  ].filter(Boolean));
}
function manualStatusSummary(state, requiredActor, blockers) {
  let summaries = {
    "delivery-ready-provisional": "Delivery has no known failed required Check, but it can be considered only provisionally because required proof is incomplete.",
    "accepted-provisional": "The provisional evidence gap is acknowledged for this response only; delivery is not verified and no acceptance state was persisted.",
    achieved: "Fresh review verified the required repository evidence; this Root is complete.",
    stopped: "This Workflow subject ended without a repository delivery claim.",
    blocked: "Delivery cannot proceed until the named blocking cause is resolved.",
    failed: "Workflow could not produce a valid delivery result; the named failure must be repaired first.",
    "root-review": "Implementation is complete and now needs one fresh read-only Review.",
    "root-plan-review": "The plan is ready for a human implementation decision; no implementation Evidence exists yet."
  };
  return summaries[state] ? summaries[state] : blockers.length > 0 ? "Workflow needs the named evidence or context problem resolved before delivery can continue." : requiredActor === "none" ? "No further actor is required for the current Manual delivery." : "The current Manual delivery has one concrete next actor and action.";
}
function humanAttentionLines(value) {
  return value?.required !== !0 || !Array.isArray(value.reasons) ? [] : value.reasons.map((reason) => typeof reason == "string" ? reason : `${reason?.check_id ? `${reason.check_id}: ` : ""}${reason?.message ?? reason?.code ?? "Human attention required"}${reason?.recovery ? ` \u2192 ${reason.recovery}` : ""}`);
}
function problemLines(value) {
  return Array.isArray(value) ? value.map((problem) => typeof problem == "string" ? problem : `${problem?.problem ?? "Workflow problem"} Why: ${problem?.why ?? "The current delivery claim is incomplete."} Resolution: ${problem?.resolution ?? "Follow the stated Workflow recovery."}`) : [];
}
function statusPresentationOutcome(snapshot) {
  let blockers = asList(snapshot.blockers), state = snapshot.state ?? "unknown";
  return blockers.length > 0 ? "blocked" : TERMINAL_READY_STATES.has(state) ? "ready" : TERMINAL_BLOCKED_STATES.has(state) ? "blocked" : "partial";
}
function closeoutPresentation(value) {
  if (value.artifact_kind === "work-review") {
    let blocked2 = value.delivery_status === "blocked", provisional = value.delivery_status === "provisional", outcome2 = blocked2 ? "blocked" : provisional ? "partial" : "ready", nextAction2 = value.next_action ?? "retry-review", evidenceChecks = Array.isArray(value.check_evidence) ? value.check_evidence : [], failedChecks = evidenceChecks.filter((entry) => entry?.grade === "failed").map((entry) => entry.check_id).filter(Boolean), gradeCounts = Object.fromEntries(["verified", "supported", "partial", "unavailable", "failed"].map((grade2) => [grade2, evidenceChecks.filter((entry) => entry?.grade === grade2).length])), checkSummary = evidenceChecks.length > 0 ? `Required Checks: ${evidenceChecks.length}; verified ${gradeCounts.verified}, supported ${gradeCounts.supported}, partial ${gradeCounts.partial}, unavailable ${gradeCounts.unavailable}, failed ${gradeCounts.failed}.` : "Required Check observations are unavailable in this response; inspect the exact Evidence artifact.", recovery = nextAction2 === "retry-review" ? "Correct the named review_input field and repeat Review in this task; no repository work or new task is required." : `Continue with ${nextAction2} in this task.`;
    return withNextStepFields({
      schema: 1,
      tool: "workflow_closeout",
      phase: "review",
      outcome: outcome2,
      summary: blocked2 ? `The host built a valid task-local Review and selected ${nextAction2}.` : provisional ? "The host built a valid task-local provisional Review." : "The host built a valid task-local verified Review.",
      check_summary: checkSummary,
      enforcement_level: value.review_enforcement?.status === "unavailable" ? "explicit" : "host-native",
      technical_traceability: {
        root_plan_id: value.root_plan_id ?? null,
        root_content_hash: value.root_content_hash ?? null,
        evidence_id: value.latest_evidence_id ?? null,
        review_id: value.work_review_id ?? null,
        review_hash: value.artifact_hash ?? null,
        correction_id: value.correction_id ?? null,
        artifact_set_hash: value.artifact_set_hash ?? null,
        check_ids: [.../* @__PURE__ */ new Set([
          ...value.authoritative_fields?.inspected_checks ?? [],
          ...evidenceChecks.map((entry) => entry.check_id).filter(Boolean)
        ])],
        finding_ids: value.finding_ids ?? [],
        changed_paths: value.changed_paths ?? [],
        handoff_persisted: value.handoff_persisted !== !1,
        repository_attribution: repositoryAttribution(value),
        pre_existing_paths: value.pre_existing_paths ?? [],
        observed_dirty_paths: value.observed_dirty_paths ?? [],
        implementation_authorization: value.implementation_authorization ?? null,
        ...value.native_root_binding ? {
          native_root_source: value.native_root_source ?? null,
          native_root_binding: value.native_root_binding
        } : {},
        review_selection_source: value.review_selection_source ?? null,
        review_enforcement: value.review_enforcement ?? null
      },
      checks: [
        ...evidenceChecks.map((entry) => `${entry.check_id}: ${entry.grade}`),
        `assessment: ${value.assessment ?? "unknown"}`,
        `delivery status: ${value.delivery_status ?? "unknown"}`,
        `review route: ${value.review_route ?? "unknown"}`,
        `task-local valid: ${value.task_local_valid === !0 ? "yes" : "unknown"}`,
        `handoff persisted: ${value.handoff_persisted === !0 ? "yes" : "no"}`
      ],
      gaps: blocked2 ? failedChecks.length > 0 ? [`Required ${failedChecks.join(", ")} failed; delivery is blocked until the failure is corrected and reviewed again.`] : ["Review found a delivery blocker that must be corrected before another Review."] : [],
      limitations: concreteEvidenceLimitations(value, evidenceChecks),
      advisories: [
        "The exact task-local artifact is authoritative; optional handoff persistence is resilience only.",
        ...value.handoff_persisted === !1 ? ["Handoff failure did not invalidate this Review."] : []
      ],
      warnings: asList(value.warning ? [value.warning] : []),
      errors: []
    }, nextAction2, blocked2 ? { blocked_reason: `Review selected ${nextAction2}.`, recovery } : {});
  }
  let persisted = value.handoff_persisted !== !1, status = value.status ?? "unknown", grade = value.overall_grade ?? "ungraded", warnings = asList(value.warning ? [value.warning] : []), evidenceGaps = value.constraint_summary?.evidence_gap_checks ?? [], legacyReceiptGaps = value.constraint_summary?.legacy_unattested_verified_checks ?? [], blocked = status === "blocked" || grade === "failed", provisionalEvidence = status === "provisional" || grade === "partial" || grade === "unavailable" || grade === "supported" || evidenceGaps.length > 0, outcome = "ready";
  blocked ? outcome = "blocked" : provisionalEvidence && (outcome = "partial");
  let summary2 = blocked ? "Portable delivery Evidence is blocked because a required Check has a known failure." : outcome === "partial" ? "Portable delivery Evidence has at least one limited required proof." : "Portable delivery Evidence is complete and ready for task-local read-only Review.", nextAction = "review-root", overrides = {};
  blocked ? (nextAction = "review-root", overrides = {
    blocked_reason: `Evidence status ${status} with grade ${grade} blocks delivery acceptance.`,
    recovery: "Run one fresh independent review and follow only the single action it selects."
  }) : legacyReceiptGaps.length > 0 ? overrides = {
    blocked_reason: `Legacy verified claims lack current host receipts: ${legacyReceiptGaps.join(", ")}.`,
    recovery: "Ask: run a fresh /review-work or $review-work and follow its bounded correction route."
  } : outcome === "partial" && evidenceGaps.length > 0 ? overrides = {
    benefit: "Lets the fresh read-only review decide whether to rerun proof, correct, or accept a provisional limit.",
    blocked_reason: `Evidence is ${grade} / ${status}; verified acceptance is not available yet.`,
    recovery: "Run Review in this task and follow its one bounded next action."
  } : outcome === "partial" && (overrides = {
    blocked_reason: `Evidence is ${grade} / ${status}; verified acceptance is not available yet.`,
    recovery: "Ask: /review-work or $review-work; accept provisional only if the review allows it."
  });
  let help = blocked ? manualEvidenceHelp("failed") : persisted ? manualEvidenceHelp(grade) : MANUAL_HELP_TOPICS["artifacts-tips-and-handoff"];
  return withHelpFields(withNextStepFields({
    schema: 1,
    tool: "workflow_closeout",
    phase: "closeout",
    outcome,
    summary: summary2,
    check_summary: blocked ? "Required delivery evidence contains a known failure." : outcome === "partial" ? `${evidenceGaps.length || 1} required proof gap${evidenceGaps.length === 1 ? "" : "s"} remain.` : "Required portable Evidence is ready for fresh Review.",
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
      handoff_persisted: persisted,
      repository_attribution: repositoryAttribution(value),
      pre_existing_paths: value.pre_existing_paths ?? [],
      observed_dirty_paths: value.observed_dirty_paths ?? [],
      implementation_authorization: value.implementation_authorization ?? null,
      review_selection_source: value.review_selection_source ?? null
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
    limitations: concreteEvidenceLimitations(value, value.check_evidence ?? []),
    human_attention: humanAttentionLines(value.human_attention),
    problems: problemLines(value.problem_details),
    advisories: persisted ? [] : ["Task-local Evidence remains valid; optional cross-task handoff is unavailable."],
    warnings,
    errors: []
  }, nextAction, overrides), help);
}
function errorPresentation(toolName, value) {
  let technical = firstLine(value?.error, "Workflow tool failed."), reviewErrorCode = value?.error_code ?? (/review_input|workflow-review-input/i.test(technical) ? "review-input-invalid" : /model-authored work-review|newly imported work-review|host builder provenance/i.test(technical) ? "review-artifact-rejected" : null);
  if (["review-input-invalid", "review-artifact-rejected"].includes(reviewErrorCode)) {
    let rejectedArtifact = reviewErrorCode === "review-artifact-rejected", reason = rejectedArtifact ? "Workflow rejected a supplied Review artifact because it cannot establish host-owned Review authority." : "The reviewer response could not be converted into a valid host-owned Review.";
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
      recovery: rejectedArtifact ? "Remove the supplied work-review artifact, pass only review_input schema 1, and repeat Review in this task. Root, Evidence, Checks, and repository work remain unchanged; no new task, Root repair, or replan is required." : "Correct the named review_input field and repeat Review in this task. Root, Evidence, Checks, and repository work remain unchanged; no new task, Root repair, or replan is required.",
      invoke: "Current task, read-only phase: correct the named Review input and rerun /review-work or $review-work"
    }), MANUAL_HELP_TOPICS["recovery-and-troubleshooting"]);
  }
  let closeoutFailed = toolName === "workflow_closeout", nextAction = toolName === "workflow_plan_preflight" ? "repair-root" : closeoutFailed ? "review-root" : "provide-artifacts", guidance = humanBlocker(technical, toolName === "workflow_plan_preflight" ? "Repair the Root blockers, then retry validation or /plan-work." : closeoutFailed ? "Repair the exact Root/chain and Check observations, then retry closeout or Ask: /review-work." : "Supply the exact current Schema-5 artifacts, then retry the failed Workflow command.");
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
function buildPresentationBase(toolName, value, { isError = !1 } = {}) {
  if (isError || value?.error)
    return errorPresentation(toolName, value);
  if (toolName === "workflow_plan_preflight") {
    let blockers = asList(value.blocking_issues), advisories = asList(value.advisories), feasible = value.feasible === !0 && blockers.length === 0, nextAction = feasible ? "implement-plan" : "repair-root", blockerGuidance = feasible ? null : humanBlocker(blockers[0] ?? "Root cannot be presented yet.", "Repair the Root blockers, then retry /plan-work."), overrides = feasible ? {} : {
      blocked_reason: blockerGuidance.reason,
      recovery: blockerGuidance.recovery
    }, presentation = withNextStepFields({
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
        changed_paths: value.changed_paths ?? []
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
    let persisted = value.handoff_persisted !== !1 && value.handoff_mode !== "stateless", warnings = asList(value.warning ? [value.warning] : []), containsReview = [...asList(value.recorded), ...asList(value.duplicates)].some((id) => /^wr-/.test(id)), nextAction = persisted ? containsReview ? "provide-artifacts" : "implement-plan" : "attach-artifact", overrides = persisted ? {} : {
      blocked_reason: "Artifact validated; handoff cache was unavailable.",
      recovery: "Attach the exact artifact explicitly; handoff is transport only."
    }, presentation = withNextStepFields({
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
    let count = Array.isArray(value.artifacts) ? value.artifacts.length : 0, nextAction = "review-root", overrides = value.evidence_tip ? {} : {
      blocked_reason: "No Evidence tip is loaded for this Root.",
      recovery: "Run Review in this task; it attempts one internal idempotent closeout before asking for another action."
    }, presentation = withNextStepFields({
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
        changed_paths: value.changed_paths ?? [],
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
  if (toolName === "workflow_closeout")
    return closeoutPresentation(value);
  if (toolName === "workflow_status") {
    let snapshot = value.snapshot ?? {}, blockers = asList(snapshot.blockers), state = snapshot.state ?? "unknown", action = snapshot.next_action ?? "none", requestedProfile = snapshot.requested_profile ?? "manual", effectiveProfile = snapshot.effective_profile ?? requestedProfile, requiredActor = snapshot.required_actor ?? "unknown", downgradeReason = snapshot.downgrade_reason ?? null, outcome = statusPresentationOutcome(snapshot), safeAction = normalizeManualPrimaryAction({ outcome, workflow_state: state }, action), overrides = state === "stopped" ? {} : blockers.length > 0 && (outcome === "blocked" || outcome === "partial") && action !== "none" ? {
      blocked_reason: humanBlocker(blockers[0] ?? `Manual state is ${state}.`, resolveNextStep(safeAction).recovery).reason,
      recovery: humanBlocker(blockers[0] ?? `Manual state is ${state}.`, resolveNextStep(safeAction).recovery).recovery
    } : outcome === "blocked" && blockers.length > 0 ? {
      blocked_reason: humanBlocker(blockers[0]).reason,
      recovery: humanBlocker(blockers[0], "Clear the named issue, then re-check /work-status.").recovery
    } : {}, presentation = withNextStepFields({
      schema: 1,
      tool: toolName,
      phase: "status",
      workflow_state: state,
      acceptance_persisted: state === "accepted-provisional" ? snapshot.acceptance_persisted === !0 : void 0,
      journey_state: snapshot.journey_state ?? null,
      outcome,
      summary: manualStatusSummary(state, requiredActor, blockers),
      check_summary: state === "accepted-provisional" ? "Evidence remains provisional; acceptance_persisted: false." : state === "achieved" ? "Fresh review verified the required repository evidence." : state === "root-review" ? "Delivery Evidence is ready for fresh review." : state === "root-plan-review" ? "Implementation Evidence does not exist yet." : blockers.length > 0 ? "The current Workflow state has blocking evidence or context." : "Current Checks and evidence remain visible in technical traceability.",
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
        changed_paths: value.changed_paths ?? [],
        artifact_set_hash: snapshot.artifact_set_hash ?? value.artifact_summary?.artifact_set_hash ?? null,
        repository_snapshot_hash: value.repository_snapshot_hash ?? null,
        receipt_ids: value.receipt_ids ?? value.artifact_summary?.receipt_ids ?? [],
        workflow_state: state,
        repository_attribution: repositoryAttribution(value),
        pre_existing_paths: value.pre_existing_paths ?? [],
        observed_dirty_paths: value.observed_dirty_paths ?? [],
        implementation_authorization: value.implementation_authorization ?? null,
        review_selection_source: value.review_selection_source ?? null,
        review_enforcement: value.review_enforcement ?? null,
        stopped_reasons: state === "stopped" ? blockers : []
      },
      checks: [
        requestedProfile === effectiveProfile ? `profile: ${effectiveProfile}` : `profile: ${requestedProfile} \u2192 ${effectiveProfile}`,
        `required actor: ${requiredActor}`,
        `evidence: ${snapshot.latest_evidence_id ?? snapshot.evidence_tip ?? "none"}`,
        `review: ${snapshot.latest_review_id ?? snapshot.review_tip ?? "none"}`,
        receiptCoverageLine(value.constraint_summary)
      ].filter(Boolean),
      gaps: state === "stopped" ? [] : blockers,
      limitations: [
        ...concreteEvidenceLimitations(value, value.check_evidence ?? []),
        ...state === "accepted-provisional" ? ["This acknowledgement is ephemeral, does not verify the delivery, and does not authorize qualification or Learning."] : []
      ],
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
function buildPresentation(toolName, value, options = {}) {
  return finalizePresentation(buildPresentationBase(toolName, value, options), {
    clientHost: options.clientHost ?? "portable"
  });
}
function controllerSubject(value) {
  let snapshot = value?.snapshot ?? null, run = value?.run ?? null, preparation = value?.preparation ?? null;
  return run || snapshot?.run_id ? {
    kind: "run",
    id: run?.run_id ?? snapshot?.run_id,
    state: snapshot?.state ?? run?.lifecycle ?? "unknown",
    nextAction: snapshot?.next_action ?? run?.next_action ?? "none",
    actor: snapshot?.required_actor ?? "controller",
    blockers: asList(snapshot?.blockers ?? run?.blockers),
    requestedProfile: snapshot?.requested_profile ?? run?.requested_profile ?? null,
    effectiveProfile: snapshot?.effective_profile ?? run?.effective_profile ?? null,
    deliveryStatus: snapshot?.delivery_status ?? run?.delivery_status ?? null,
    evidenceGrade: snapshot?.evidence_grade ?? run?.evidence_grade ?? null,
    rootPlanId: snapshot?.root_plan_id ?? run?.plan?.fields?.id ?? null,
    revision: snapshot?.revision ?? run?.revision ?? null,
    acceptedAs: run?.accepted_as ?? null,
    deliveryAccepted: run?.delivery_accepted === !0
  } : preparation ? {
    kind: "preparation",
    id: preparation.preparation_id,
    state: preparation.status ?? "unknown",
    nextAction: preparation.status === "root-ready" ? "approve" : preparation.status === "planning" ? "watch" : "none",
    actor: preparation.status === "root-ready" ? "human" : "controller",
    blockers: asList(preparation.blockers),
    requestedProfile: preparation.requested_profile ?? null,
    effectiveProfile: null,
    deliveryStatus: null,
    evidenceGrade: null,
    rootPlanId: preparation.root_plan_contract?.fields?.id ?? null,
    revision: preparation.revision ?? null,
    acceptedAs: null,
    deliveryAccepted: !1
  } : null;
}
function controllerPrimaryAction(subject2, toolName) {
  if (!subject2) return null;
  let id = subject2.id;
  return subject2.kind === "preparation" ? subject2.state === "root-ready" ? {
    id: "approve",
    label: "Approve the prepared Root",
    invoke: `/auto-work ${id} approve`,
    why: "Starts only the exact prepared Root after human approval.",
    actor: "human"
  } : subject2.state === "planning" ? {
    id: "watch",
    label: "Watch preparation",
    invoke: `/work-watch ${id}`,
    why: "Shows planning progress without creating another preparation.",
    actor: "human"
  } : null : ["achieved", "accepted-provisional", "stopped"].includes(subject2.state) ? null : subject2.nextAction === "accept-verified" ? {
    id: "accept-verified",
    label: "Accept verified delivery",
    invoke: `/work-control ${id} accept verified`,
    why: "Persists the required human acceptance for this supervised Run.",
    actor: "human"
  } : subject2.nextAction === "accept-provisional" ? {
    id: "accept-provisional",
    label: "Accept provisional delivery",
    invoke: `/work-control ${id} accept provisional`,
    why: "Persists this Run decision without calling the delivery verified or qualification-eligible.",
    actor: "human"
  } : ["resume", "reconcile-and-resume"].includes(subject2.nextAction) || ["paused", "interrupted"].includes(subject2.state) ? {
    id: "resume",
    label: "Resume the Run",
    invoke: `/work-control ${id} resume`,
    why: "Continues the same approved Run from its recorded state.",
    actor: "human"
  } : subject2.state === "waiting-human" || subject2.nextAction === "answer" ? {
    id: "answer",
    label: "Answer the open question",
    invoke: `/work-control ${id} answer <text>`,
    why: "Records the missing human decision without expanding Root authority.",
    actor: "human"
  } : ["blocked", "failed"].includes(subject2.state) ? {
    id: toolName === "workflow_status" ? "resolve-blocker" : "inspect",
    label: toolName === "workflow_status" ? "Resolve the named blocker" : "Inspect the blocker",
    invoke: toolName === "workflow_status" ? `Fix the named cause, then run /work-status ${id} again` : `/work-status ${id}`,
    why: toolName === "workflow_status" ? "Moves the blocked subject forward before status is checked again." : "Shows the exact reason and safe recovery before any new authorization.",
    actor: "human"
  } : {
    id: "watch",
    label: "Watch the Run",
    invoke: `/work-watch ${id}`,
    why: "Shows progress and the next decision without starting another Run.",
    actor: "human"
  };
}
function controllerRecoveryAction(toolName, outcome) {
  return ["blocked", "failed"].includes(outcome) ? toolName === "workflow_validate_models" ? {
    id: "retry-model-validation",
    label: "Re-run model validation",
    invoke: "/work-models",
    why: "Rechecks the configured model routes without starting a Run.",
    actor: "human"
  } : toolName === "workflow_verification_profile" ? {
    id: "inspect-verification-profile",
    label: "Inspect verification profile",
    invoke: "/work-verification inspect",
    why: "Shows the invalid profile detail before any approval or execution.",
    actor: "human"
  } : {
    id: "inspect-controller-state",
    label: "Inspect controller state",
    invoke: "/work-status",
    why: "Shows the exact failure and safe recovery without creating or resuming a Run.",
    actor: "human"
  } : null;
}
function controllerJourneyState(subject2, outcome) {
  return subject2 ? ["achieved", "accepted-provisional", "stopped", "failed"].includes(subject2.state) ? subject2.state === "failed" ? "blocked" : "done" : outcome === "blocked" || subject2.state === "blocked" ? "blocked" : subject2.kind === "preparation" && subject2.state === "root-ready" ? "plan-ready" : ["waiting-human", "paused", "interrupted", "delivery-ready-verified", "delivery-ready-provisional"].includes(subject2.state) ? "clarification-required" : ["root-review", "slice-review"].includes(subject2.state) ? "review-active" : "implementation-active" : ["blocked", "failed"].includes(outcome) ? "blocked" : "done";
}
function controllerOutcome(subject2, value, isError) {
  return isError || value?.error ? "failed" : value?.verified === !1 || value?.valid === !1 ? "blocked" : subject2 ? ["blocked", "failed"].includes(subject2.state) ? "blocked" : ["achieved", "accepted-provisional", "stopped"].includes(subject2.state) ? "ready" : subject2.kind === "preparation" && ["failed", "expired"].includes(subject2.state) ? "blocked" : "partial" : "ready";
}
function buildControllerPresentation(toolName, value, { isError = !1 } = {}) {
  let subject2 = controllerSubject(value), outcome = controllerOutcome(subject2, value, isError), state = subject2?.state ?? (value?.workflow_active === !1 ? "inactive" : outcome === "failed" ? "failed" : outcome === "blocked" ? "validation-failed" : "completed"), action = controllerPrimaryAction(subject2, toolName) ?? controllerRecoveryAction(toolName, outcome), profileLine = subject2?.requestedProfile ? subject2.requestedProfile === subject2.effectiveProfile || !subject2.effectiveProfile ? `profile: ${subject2.requestedProfile}` : `profile: ${subject2.requestedProfile} \u2192 ${subject2.effectiveProfile}` : null, provisionalAccepted = subject2?.state === "accepted-provisional" && subject2.deliveryAccepted, summary2 = value?.error ? humanBlocker(value.error).reason : provisionalAccepted ? "The human accepted this controller Run provisionally; the persisted decision does not verify the delivery or qualify future autonomy." : value?.workflow_active === !1 ? "No controller Run or preparation is active; native Manual work remains unaffected." : subject2?.kind === "preparation" ? subject2.state === "root-ready" ? "The prepared Root is ready for explicit human approval." : `Controller preparation is ${subject2.state}.` : subject2 ? subject2.state === "stopped" ? "The controller subject ended without a repository delivery claim." : subject2.state === "blocked" ? "The controller delivery is blocked by the named cause; resolve it before checking status again." : subject2.state === "failed" ? "The controller operation failed; repair the named cause before retrying." : subject2.actor === "none" ? "The controller subject needs no further actor." : "The controller subject has one recorded next actor and action." : toolName === "workflow_validate_models" ? value?.verified === !0 ? "Configured model routes are verified." : "Configured model routes are not verified." : "The controller operation completed.", limitations = uniqueLines([
    ...provisionalAccepted ? ["The persisted Run acceptance is provisional, unverified, and non-qualifying."] : [],
    ...subject2 && outcome !== "blocked" ? subject2.blockers : [],
    ...asList(value?.limitations)
  ]), warnings = uniqueLines([
    ...asList(value?.warnings),
    ...asList(value?.integration_warnings),
    ...subject2?.requestedProfile && subject2.effectiveProfile && subject2.requestedProfile !== subject2.effectiveProfile ? [`profile downgrade: ${subject2.requestedProfile} \u2192 ${subject2.effectiveProfile}`] : []
  ]), presentation = {
    schema: 1,
    tool: toolName,
    phase: subject2?.kind ?? "controller",
    workflow_state: state,
    acceptance_persisted: provisionalAccepted ? !0 : void 0,
    outcome,
    summary: summary2,
    check_summary: subject2 ? [profileLine, subject2.deliveryStatus ? `delivery: ${subject2.deliveryStatus}` : null, subject2.evidenceGrade ? `evidence: ${subject2.evidenceGrade}` : null].filter(Boolean).join("; ") || "Controller state is recorded." : value?.verified !== void 0 ? `verified: ${value.verified === !0 ? "yes" : "no"}` : "Controller result is available in structured content.",
    journey_state: controllerJourneyState(subject2, outcome),
    primary_actor: action?.actor ?? subject2?.actor ?? "none",
    enforcement_level: "explicit",
    technical_traceability: {
      root_plan_id: subject2?.rootPlanId ?? null,
      evidence_id: value?.snapshot?.evidence_tip ?? null,
      review_id: value?.snapshot?.review_tip ?? null,
      correction_id: null,
      check_ids: [],
      finding_ids: [],
      changed_paths: value?.run?.delivered_paths ?? [],
      subject_kind: subject2?.kind ?? value?.subject_kind ?? "controller",
      subject_id: subject2?.id ?? null,
      revision: subject2?.revision ?? null
    },
    checks: [profileLine, subject2?.deliveryStatus ? `delivery: ${subject2.deliveryStatus}` : null, subject2?.evidenceGrade ? `evidence: ${subject2.evidenceGrade}` : null].filter(Boolean),
    gaps: outcome === "blocked" ? uniqueLines([...subject2?.blockers ?? [], ...asList(value?.errors), ...value?.error ? [value.error] : []]) : [],
    limitations,
    advisories: [],
    warnings,
    errors: isError ? uniqueLines([value?.error ?? "Controller operation failed."]) : [],
    next_action: action?.id ?? "none",
    ...["blocked", "failed"].includes(outcome) && action ? {
      next_action_blocked_reason: value?.error ?? subject2?.blockers?.[0] ?? "The controller result is not ready for safe continuation.",
      next_action_recovery: `${action.label}: ${action.invoke}`
    } : {}
  };
  return finalizePresentation(presentation, { clientHost: "cursor", primaryAction: action });
}
function controllerMcpResult(toolName, value, isError = !1) {
  if (process.env.GELDMACHER_WORKFLOW_LEGACY_MCP_TEXT === "1")
    return {
      content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
      structuredContent: value,
      isError
    };
  let presentation = buildControllerPresentation(toolName, value, { isError });
  return {
    content: [{ type: "text", text: formatManualToolContent(presentation) }],
    structuredContent: value,
    isError
  };
}
function formatSection(title, items) {
  return !items || items.length === 0 ? null : [`${title}:`, ...items.map((item) => `- ${item}`)].join(`
`);
}
function formatHelp(help) {
  return !help?.meaning || !help?.label || !help?.url ? null : [
    `Meaning: ${help.meaning}`,
    `Learn more: [${help.label}](${help.url})`
  ].join(`
`);
}
function formatNextStepFooter(presentation) {
  if (presentation.tool === "workflow_status" && presentation.workflow_state === "achieved" && presentation.next_action === "none")
    return [
      "### Done",
      "Repository delivery is complete for this Root."
    ].join(`
`);
  if (presentation.workflow_state === "accepted-provisional" && presentation.next_action === "none")
    return presentation.acceptance_persisted === !0 ? [
      "### Provisional controller delivery accepted",
      "The Run decision is persisted, but the delivery remains unverified and does not qualify future autonomous work."
    ].join(`
`) : [
      "### Provisional gap acknowledged",
      "This acknowledgement applies only to this response. It is not persisted or verified; the next status returns delivery-ready-provisional."
    ].join(`
`);
  if (presentation.workflow_state === "stopped" && presentation.next_action === "none")
    return [
      "### Ended without delivery",
      "The Workflow subject is closed without a repository delivery claim."
    ].join(`
`);
  let primary = presentation.primary_action;
  return primary ? [
    "### Next step",
    `- Now: ${primary.label}`,
    `- How: ${primary.invoke}`,
    `- Why: ${primary.why}`
  ].join(`
`) : ["### Done", "No further Workflow action is required."].join(`
`);
}
function traceValue(value) {
  return Array.isArray(value) ? value.length > 0 ? value.join(", ") : "none" : value && typeof value == "object" ? JSON.stringify(value) : value == null || value === "" ? "none" : String(value);
}
function tracePaths(label, paths, max = 5) {
  if (!Array.isArray(paths) || paths.length === 0) return `${label}: none`;
  let shown = paths.slice(0, max).join(", ");
  return `${label} (${paths.length}): ${shown}${paths.length > max ? `, \u2026 (+${paths.length - max} more)` : ""}`;
}
function formatTechnicalTraceability(presentation, { disclosure = !0 } = {}) {
  let trace = presentation.technical_traceability ?? {}, identity = [
    `Root: ${trace.root_plan_id ?? "none"}`,
    `Root hash: ${trace.root_content_hash ?? "none"}`,
    `Evidence: ${trace.evidence_id ?? "none"}`,
    `Evidence hash: ${trace.evidence_hash ?? "none"}`,
    `Review: ${trace.review_id ?? "none"}`,
    `Review hash: ${trace.review_hash ?? "none"}`,
    `Correction: ${trace.correction_id ?? "none"}`,
    `Artifact set hash: ${trace.artifact_set_hash ?? "none"}`,
    `Repository snapshot hash: ${trace.repository_snapshot_hash ?? "none"}`,
    `Repository attribution: ${traceValue(trace.repository_attribution)}`,
    tracePaths("Pre-existing paths", trace.pre_existing_paths),
    tracePaths("Observed dirty paths", trace.observed_dirty_paths),
    `Implementation authorization: ${trace.implementation_authorization ?? "none"}`,
    ...trace.native_root_binding ? [
      `Native Root source: ${trace.native_root_source ?? "none"}`,
      `Native Root binding: ${traceValue(trace.native_root_binding)}`
    ] : [],
    `Review selection source: ${trace.review_selection_source ?? "none"}`,
    `Review enforcement: ${traceValue(trace.review_enforcement)}`,
    `Stopped reasons: ${traceValue(trace.stopped_reasons)}`,
    `Receipt IDs: ${traceValue(trace.receipt_ids)}`,
    `Subject: ${trace.subject_kind ?? "manual"}${trace.subject_id ? ` ${trace.subject_id}` : ""}`,
    `Revision: ${trace.revision ?? "none"}`,
    `Check IDs: ${traceValue(trace.check_ids)}`,
    `Finding IDs: ${traceValue(trace.finding_ids)}`,
    formatChangedPaths(trace.changed_paths),
    `Client host: ${presentation.client_host ?? "portable"}`,
    `Human phase: ${presentation.human_projection?.phase ?? "unknown"}`,
    `Enforcement: ${presentation.enforcement_level ?? trace.enforcement_level ?? "explicit"}`,
    `Update key: ${presentation.deduplication_key ?? "none"}`
  ], body = [
    `${presentation.tool} \u2014 ${presentation.outcome}`,
    ...identity,
    formatSection("Checks", presentation.checks),
    formatSection("Blockers", presentation.severity?.blockers),
    formatSection("Limitations", presentation.severity?.limitations),
    formatSection("Gaps", presentation.gaps),
    formatSection("Human attention", presentation.human_attention),
    formatSection("Problems", presentation.problems),
    formatSection("Advisories", presentation.advisories),
    formatSection("Warnings", presentation.warnings),
    formatSection("Errors", presentation.errors),
    presentation.next_action_blocked_reason ? `${firstBlocker(presentation) ? "Action blocker" : "Action limit"}: ${presentation.next_action_blocked_reason}` : null,
    presentation.next_action_recovery ? `Recovery detail: ${presentation.next_action_recovery}` : null,
    formatHelp(presentation.help)
  ].filter((line2) => line2 != null).join(`
`).replace(/\n{3,}/g, `

`).trim();
  return disclosure ? `<details><summary>Agent and machine contract (authoritative) \xB7 Technical traceability</summary>

Structured content is authoritative; this is a bounded human-readable index.

${body}

</details>` : `---

### Agent and machine contract (authoritative)

Structured content is authoritative; this is a bounded human-readable index.

#### Technical traceability

${body}`;
}
function scopeBoundaryLine(presentation) {
  let trace = presentation.technical_traceability ?? {};
  return ["controller", "run", "preparation"].includes(presentation.phase) || trace.subject_kind === "controller" ? "This result applies only to the displayed controller subject; it grants no new Root, deployment, publication, or host permission." : !trace.root_plan_id || presentation.tool === "workflow_plan_preflight" ? "This result does not establish repository authority or approve implementation, deployment, publication, or a host action." : "This result is bounded to the displayed Root's repository scope; it does not itself attest implementation approval or grant deployment, publication, or host permission.";
}
function presentationMeaning(presentation) {
  return presentation.workflow_state === "stopped" ? "The subject is closed for history and makes no repository delivery claim; no follow-up action is expected." : presentation.outcome === "blocked" ? "A known failure or safety boundary prevents delivery; the named cause must be resolved before success can be reconsidered." : presentation.help?.meaning ? presentation.help.meaning : presentation.outcome === "partial" ? "The result is usable only within the stated evidence limit and must not be described as verified delivery." : presentation.phase === "review" ? "A fresh read-only Review produced the repository delivery decision shown above." : "This result reports the current Workflow decision without granting any additional repository or host authority.";
}
function formatManualToolContent(presentation, { technicalDisclosure = !0 } = {}) {
  let humanLabel = presentation.human_projection?.label ?? HUMAN_PHASE_LABELS[deriveHumanWorkflowPhase({
    journeyState: presentation.journey_state,
    workflowState: presentation.workflow_state,
    outcome: presentation.outcome
  })] ?? "Workflow state", blocker = firstBlocker(presentation), limitation = firstLimitation(presentation), warning = presentation.severity?.warnings?.[0] ?? null, limitations = presentation.severity?.limitations ?? [], reviewedOutput = presentation.phase === "review" || presentation.tool === "workflow_status", finalExplanation = presentation.workflow_state === "achieved" || presentation.phase === "review" && presentation.outcome === "ready" && presentation.next_action === "none", explanationLabel = reviewedOutput ? finalExplanation ? "Final repository explanation" : "Preliminary explanation" : null;
  return `${[
    `## Workflow \xB7 ${humanLabel}`,
    "### Quick decision",
    `What happened: ${presentation.summary}`,
    `Checks: ${presentation.check_summary ?? "See technical traceability for exact evidence."}`,
    limitation ? `Limitation: ${limitation}` : null,
    warning ? `Warning: ${warning}` : null,
    blocker ? `Blocker: ${blocker}` : null,
    blocker && presentation.next_action_recovery ? `Resolution: ${presentation.next_action_recovery}` : null,
    formatNextStepFooter(presentation),
    "### Details",
    "#### Outcome and meaning",
    explanationLabel ? `**${explanationLabel}**` : null,
    presentationMeaning(presentation),
    "#### Scope and boundaries",
    scopeBoundaryLine(presentation),
    "#### Verification, limits, and recovery",
    presentation.check_summary ?? "See technical traceability for exact evidence.",
    limitations.length > 0 ? formatSection("Limitations", limitations) : "No material evidence limitation was reported.",
    (presentation.severity?.warnings?.length ?? 0) > 0 ? formatSection("Warnings", presentation.severity.warnings) : null,
    presentation.next_action_recovery ? `Recovery: ${presentation.next_action_recovery}` : null,
    formatTechnicalTraceability(presentation, { disclosure: technicalDisclosure })
  ].filter((line2) => line2 != null).join(`
`).replace(/\n{3,}/g, `

`).trim()}
`;
}
function isManualWorkflowTool(toolName) {
  return MANUAL_TOOLS.has(toolName);
}
function coalesceManualPresentation(presentation) {
  return { ...presentation, update_suppressed: !1 };
}
function manualMcpResult(toolName, value, isError = !1, { clientHost = "portable" } = {}) {
  if (process.env.GELDMACHER_WORKFLOW_LEGACY_MCP_TEXT === "1" || !isManualWorkflowTool(toolName))
    return {
      content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
      structuredContent: value,
      isError
    };
  let presentation = coalesceManualPresentation(buildPresentation(toolName, value, { isError, clientHost })), structuredContent = { ...value, presentation };
  return {
    content: [{ type: "text", text: formatManualToolContent(presentation) }],
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
]), MANUAL_WORKFLOW_TOOL_ANNOTATIONS = Object.freeze({
  workflow_plan_preflight: annotations({
    readOnlyHint: !0,
    destructiveHint: !1,
    idempotentHint: !0,
    openWorldHint: !1
  }),
  workflow_artifact_context: annotations({
    readOnlyHint: !0,
    destructiveHint: !1,
    idempotentHint: !0,
    openWorldHint: !1
  }),
  workflow_status: annotations({
    readOnlyHint: !0,
    destructiveHint: !1,
    idempotentHint: !0,
    openWorldHint: !1
  }),
  workflow_artifact_record: annotations({
    readOnlyHint: !1,
    destructiveHint: !1,
    idempotentHint: !0,
    openWorldHint: !1
  }),
  workflow_closeout: annotations({
    readOnlyHint: !1,
    destructiveHint: !1,
    idempotentHint: !0,
    openWorldHint: !1
  })
});
if (Object.keys(MANUAL_WORKFLOW_TOOL_ANNOTATIONS).sort().join(`
`) !== [...MANUAL_WORKFLOW_TOOL_NAMES].sort().join(`
`))
  throw new Error("Manual MCP tool annotations differ from the Manual tool set");
function manualToolAnnotations(name) {
  let value = MANUAL_WORKFLOW_TOOL_ANNOTATIONS[name];
  if (!value) throw new Error(`unknown Manual Workflow MCP tool annotations ${name}`);
  return value;
}

// src/mcp/review-input-contract.mjs
var semanticKey = string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), objectiveId = string().regex(/^OBJ-[1-9][0-9]*$/), checkId = string().regex(/^CHECK-[1-9][0-9]*$/), line = (max = 2e3) => string().min(1).max(max), finding = strictObject({
  key: semanticKey,
  severity: _enum(["low", "medium", "high", "critical"]),
  objective_ids: array(objectiveId).min(1).max(64),
  check_ids: array(checkId).min(1).max(128),
  evidence: line(4e3),
  reasoning: line(4e3),
  resolution: _enum(["correct", "clarify", "replan"])
}), correction = strictObject({
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
}), reviewInputSchema = strictObject({
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
}), malformedReviewInputCandidate = record(string().max(200), unknown()).refine((value) => Object.keys(value).length <= 32, "review_input recovery candidate exceeds 32 fields").describe("Recovery-only malformed review_input object. The host-owned builder still requires the closed Schema-1 branch and never infers missing judgments."), reviewInputTransportSchema = union([
  reviewInputSchema,
  malformedReviewInputCandidate
]);

// src/mcp/manual-tool-contracts.mjs
var workspaceRoot = string().min(1).optional(), artifact = object({
  label: string().min(1).max(200),
  text: string().min(1).max(25e4)
}), checkEvidence = object({
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
}), contracts = Object.freeze({
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
  let contract = contracts[name];
  if (!contract) throw new Error(`unknown Manual Workflow MCP tool ${name}`);
  return { ...contract, annotations: manualToolAnnotations(name) };
}

// src/mcp/manual-tools.mjs
function publicManualSubagentPolicy(policy = resolveManualSubagentPolicy()) {
  return Object.freeze({
    authoritative: !1,
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
  includeStatus = !0,
  contract = manualToolContract,
  clientHost = "portable",
  resolveHostToolApprovalPreference = resolveHostToolApproval,
  resolveManualSubagentPolicyPreference = resolveManualSubagentPolicy
}) {
  let namedResult = (toolName) => (value, isError = !1) => manualMcpResult(toolName, value, isError, { clientHost }), namedFailure = (toolName) => (error) => namedResult(toolName)({
    error: error.message,
    ...error?.code ? { error_code: error.code } : {}
  }, !0), toolAwareResult = (toolName, value, isError = !1) => namedResult(toolName)(value, isError);
  toolAwareResult.toolAware = !0;
  let resolveOperationalContext = async (workspaceRoot3) => {
    let workspace = await workspaceAuthority2.resolve(workspaceRoot3);
    return {
      workspace,
      stateRoot: operationalStateRoot(workspace),
      legacyHandoffStore: new ArtifactHandoffStore(handoffStateRoot(workspace), pluginRoot2)
    };
  }, handoffStoreFactory = (rootPlanText, root) => createContentAddressedHandoffStore(rootPlanText, root), contextResult = namedResult("workflow_artifact_context"), statusResult = namedResult("workflow_status"), preflightResult = namedResult("workflow_plan_preflight"), artifactHandlers = createArtifactHandlers({
    pluginRoot: pluginRoot2,
    resolveOperationalContext,
    result: toolAwareResult,
    handoffStoreFactory,
    clientHost
  }), status = async (input) => {
    try {
      if (input.run_id || input.preparation_id) throw new Error("manual workflow_status does not accept controller subjects");
      if (input.root_plan_id && !input.artifacts) throw new Error("manual workflow_status requires artifacts with root_plan_id");
      if (!input.artifacts) throw new Error("manual workflow_status requires current-task artifacts");
      if (input.artifacts.reduce((total, artifact3) => total + artifact3.text.length, 0) > 1e6)
        throw new Error("manual workflow_status artifact bundle exceeds 1000000 characters");
      let workspace = null, stateRoot = null, workspaceBinding = "not-established";
      try {
        let operational = await resolveOperationalContext(input.workspace_root);
        workspace = operational.workspace, stateRoot = operational.stateRoot, workspaceBinding = "trusted-root";
      } catch (error) {
        if (!isWorkspaceRootsUnavailable(error)) throw error;
      }
      let manual = deriveManualWorkflowSnapshot({
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
        workspace_root_used: !!workspace,
        model_inheritance: stateRoot ? modelInheritanceSummary(stateRoot) : { authoritative: !1, status: "unavailable", evidence_effect: "none", reason: "workspace-binding-not-established" },
        host_tool_approval: resolveHostToolApprovalPreference(),
        manual_subagent_policy: publicManualSubagentPolicy(resolveManualSubagentPolicyPreference())
      });
    } catch (error) {
      return namedFailure("workflow_status")(error);
    }
  };
  return server2.registerTool("workflow_plan_preflight", contract("workflow_plan_preflight"), async (input) => preflightResult(preflightRootPlan(input.root_plan, pluginRoot2))), server2.registerTool("workflow_artifact_record", contract("workflow_artifact_record"), artifactHandlers.record), server2.registerTool("workflow_artifact_context", contract("workflow_artifact_context"), async (input) => {
    try {
      if (!input.root_plan)
        try {
          let operational = await resolveOperationalContext(input.workspace_root), legacy = operational.legacyHandoffStore.context(input.root_plan_id, null);
          return contextResult({
            workspace_root: operational.workspace,
            workspace_binding: "trusted-root",
            workspace_root_used: !0,
            handoff_authoritative: !1,
            handoff_mode: "legacy-repository-cache",
            ...legacy,
            model_inheritance: modelInheritanceSummary(operational.stateRoot)
          });
        } catch (error) {
          throw !isWorkspaceRootsUnavailable(error) && !/no handoff Root/.test(error.message) ? error : new Error(`workflow_artifact_context requires exact root_plan text for content-bound handoff${error?.message ? `; ${error.message}` : ""}`);
        }
      return resolveRootPlanText(pluginRoot2, { rootPlanId: input.root_plan_id, rootPlan: input.root_plan }), artifactHandlers.context(input);
    } catch (error) {
      return namedFailure("workflow_artifact_context")(error);
    }
  }), server2.registerTool("workflow_closeout", contract("workflow_closeout"), artifactHandlers.closeout), includeStatus && server2.registerTool("workflow_status", contract("workflow_status"), status), Object.freeze({ status });
}

// src/mcp/proof-artifacts.mjs
import { createHash as createHash7 } from "node:crypto";
import { lstatSync as lstatSync2, readFileSync as readFileSync4, readdirSync as readdirSync2 } from "node:fs";
import { join as join4 } from "node:path";
var PROOF_LIMITS = Object.freeze({ files: 128, file_bytes: 10 * 1024 * 1024, total_bytes: 32 * 1024 * 1024, depth: 8 });
function hashStableProofFile(path, stat = lstatSync2, read = readFileSync4, before = stat(path)) {
  if (before.size > PROOF_LIMITS.file_bytes) throw new Error(`verification proof artifact exceeds 10 MiB: ${path}`);
  let content = read(path), after = stat(path);
  if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error(`verification proof artifact changed while hashing: ${path}`);
  return { size: before.size, hash: createHash7("sha256").update(content).digest("hex") };
}
function proofArtifacts(root) {
  let files = [], totalBytes = 0, visit = (directory, depth = 0) => {
    if (depth > PROOF_LIMITS.depth) throw new Error(`verification proof artifact depth exceeds ${PROOF_LIMITS.depth}: ${directory}`);
    for (let entry of readdirSync2(directory, { withFileTypes: !0 })) {
      let path = join4(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`verification proof artifact may not be a symlink: ${path}`);
      if (entry.isDirectory()) visit(path, depth + 1);
      else if (entry.isFile()) {
        if (files.length >= PROOF_LIMITS.files) throw new Error(`verification proof artifact count exceeds ${PROOF_LIMITS.files}`);
        let before = lstatSync2(path);
        if (before.size > PROOF_LIMITS.file_bytes) throw new Error(`verification proof artifact exceeds 10 MiB: ${path}`);
        if (totalBytes += before.size, totalBytes > PROOF_LIMITS.total_bytes) throw new Error("verification proof artifacts exceed 32 MiB total");
        let stable = hashStableProofFile(path, lstatSync2, readFileSync4, before);
        files.push({ path, hash: stable.hash });
      } else throw new Error(`verification proof artifact must be a regular file or directory: ${path}`);
    }
  };
  return visit(root), files.sort((left, right) => left.path.localeCompare(right.path));
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
    readOnlyHint: !0,
    destructiveHint: !1,
    idempotentHint: !0,
    openWorldHint: !1
  }),
  workflow_validate_models: annotations2({
    readOnlyHint: !0,
    destructiveHint: !1,
    idempotentHint: !0,
    openWorldHint: !0
  }),
  workflow_prepare: annotations2({
    readOnlyHint: !1,
    destructiveHint: !1,
    idempotentHint: !1,
    openWorldHint: !1
  }),
  workflow_start: annotations2({
    readOnlyHint: !1,
    destructiveHint: !1,
    idempotentHint: !1,
    openWorldHint: !1
  }),
  workflow_answer: annotations2({
    readOnlyHint: !1,
    destructiveHint: !1,
    idempotentHint: !1,
    openWorldHint: !1
  }),
  workflow_control: annotations2({
    readOnlyHint: !1,
    destructiveHint: !0,
    idempotentHint: !1,
    openWorldHint: !1
  }),
  workflow_verification_profile: annotations2({
    readOnlyHint: !1,
    destructiveHint: !1,
    idempotentHint: !1,
    openWorldHint: !1
  })
});
if (Object.keys(WORKFLOW_TOOL_ANNOTATIONS).sort().join(`
`) !== [...WORKFLOW_TOOL_NAMES].sort().join(`
`))
  throw new Error("MCP tool annotations differ from the canonical tool registry");
function toolAnnotations(name) {
  let value = WORKFLOW_TOOL_ANNOTATIONS[name];
  if (!value) throw new Error(`unknown Workflow MCP tool annotations ${name}`);
  return value;
}

// src/mcp/tool-contracts.mjs
var workspaceRoot2 = string().min(1).optional(), artifact2 = object({
  label: string().min(1).max(200),
  text: string().min(1).max(25e4)
}), subject = {
  workspace_root: workspaceRoot2,
  run_id: string().min(1).optional(),
  preparation_id: string().min(1).optional()
}, checkEvidence2 = object({
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
}), WORKFLOW_TOOL_CONTRACTS = Object.freeze({
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
    description: "For Cursor native Manual Review, atomically build paired Schema-5 delivery-evidence and work-review artifacts from the protected current-task receipt and fresh observations; delivery-evidence and portable clients retain exact Root inputs.",
    inputSchema: {
      workspace_root: workspaceRoot2,
      native_review_receipt: string().regex(/^[A-Za-z0-9_-]{43}$/).describe("Cursor host-injected opaque Review receipt. Models and users must never set this field.").optional(),
      root_plan_id: string().regex(/^wp-[A-Za-z0-9][A-Za-z0-9-]*$/).optional(),
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
    description: "Return current status and a uniform read-only learning projection for one preparation, adaptive run, or explicit/uniquely active stateless manual schema-5 artifact chain. With no subject it reports Workflow inactive and never gates native Manual implementation. Controller learning authority requires the ephemeral source receipt from an operational response, and Workflow-3/4 subjects remain read-only.",
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
if (Object.keys(WORKFLOW_TOOL_CONTRACTS).sort().join(`
`) !== [...WORKFLOW_TOOL_NAMES].sort().join(`
`))
  throw new Error("MCP tool contracts differ from the canonical tool registry");
function toolContract(name) {
  let contract = WORKFLOW_TOOL_CONTRACTS[name];
  if (!contract) throw new Error(`unknown Workflow MCP tool ${name}`);
  return { ...contract, annotations: toolAnnotations(name) };
}

// src/mcp/workflow-mcp.mjs
var pluginRoot = resolve6(process.env.CURSOR_PLUGIN_ROOT ?? dirname4(dirname4(fileURLToPath2(import.meta.url)))), server = new McpServer({ name: "workflow", version: PLUGIN_VERSION }), workspaceAuthority = new WorkspaceRootAuthority(() => server.server.listRoots()), learningSourceReceipts = createLearningSourceReceiptAuthority();
server.server.setNotificationHandler(RootsListChangedNotificationSchema, async () => workspaceAuthority.invalidate());
function result(value, isError = !1) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value, isError };
}
function failure(error) {
  return result({
    error: error.message,
    ...error instanceof WorkspaceRootError ? { error_code: error.code } : {}
  }, !0);
}
function controllerResult(toolName, value, isError = !1) {
  return controllerMcpResult(toolName, value, isError);
}
function controllerFailure(toolName, error) {
  return controllerResult(toolName, {
    error: error.message,
    ...error instanceof WorkspaceRootError ? { error_code: error.code } : {}
  }, !0);
}
function proofResult(text) {
  let source = String(text ?? ""), fenced = source.match(/```json\s*([\s\S]*?)```/i)?.[1], value = JSON.parse(fenced ?? source.slice(source.indexOf("{"), source.lastIndexOf("}") + 1));
  if (!value || typeof value != "object" || Array.isArray(value)) throw new Error("verification proof returned no object");
  return value;
}
async function context(workspaceRoot3) {
  let workspace = await workspaceAuthority.resolve(workspaceRoot3), stateRoot = defaultStateRoot(workspace), store = new RunStore(stateRoot), preparationStore = new PreparationStore(stateRoot), engine = new WorkflowEngine({ workspaceRoot: workspace, store, preparationStore, pluginRoot, stateRoot }), planningEngine = new PlanningEngine({ workspaceRoot: workspace, store: preparationStore, pluginRoot, stateRoot });
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
  includeStatus: !1,
  contract: toolContract,
  clientHost: "cursor"
});
function runnerPath() {
  return resolve6(process.env.GELDMACHER_WORKFLOW_RUNNER ?? fileURLToPath2(new URL("./workflow-runner.mjs", import.meta.url)));
}
function launchRunner({ action, workspace, stateRoot, runId = null, preparationId = null }) {
  let subjectArgs = runId ? ["--run-id", runId] : ["--preparation-id", preparationId], child = spawn(process.execPath, [runnerPath(), "--action", action, ...subjectArgs, "--workspace", workspace, "--state-root", stateRoot, "--plugin-root", pluginRoot], {
    detached: !0,
    stdio: "ignore",
    env: process.env
  });
  return child.unref(), child.pid;
}
function requireOneSubject(input) {
  if (!!input.run_id == !!input.preparation_id) throw new Error("exactly one of run_id or preparation_id is required");
}
function idempotentRunMutation(store, runId, expectedRevision, idempotencyKey, operation) {
  let before = store.get(runId);
  if (assertCompatibleRun(before), before.idempotency?.[idempotencyKey]) return { value: before, duplicate: !0 };
  if (before.revision !== expectedRevision) throw new Error(`revision conflict: expected ${expectedRevision}, current ${before.revision}`);
  operation(before);
  let after = store.get(runId);
  return { value: store.update(runId, after.revision, idempotencyKey, (draft) => draft, "idempotency-recorded"), duplicate: !1 };
}
async function watchEvents(readEvents, afterEvent, timeoutMs) {
  let deadline = Date.now() + timeoutMs;
  for (; ; ) {
    let events = readEvents(afterEvent);
    if (events.length > 0 || Date.now() >= deadline) return events;
    await new Promise((resolveWait) => setTimeout(resolveWait, Math.min(250, Math.max(0, deadline - Date.now()))));
  }
}
server.registerTool("workflow_prepare", toolContract("workflow_prepare"), async (input) => {
  try {
    if (!!input.goal == !!input.root_plan) throw new Error("workflow_prepare requires exactly one of goal or root_plan");
    if (input.root_artifacts && !input.root_plan) throw new Error("workflow_prepare root_artifacts require root_plan");
    if ((input.root_artifacts ?? []).reduce((total, artifact3) => total + artifact3.text.length, 0) > 1e6) throw new Error("workflow_prepare root_artifacts exceed 1000000 characters");
    let { workspace, stateRoot, preparationStore, planningEngine } = await context(input.workspace_root), created = planningEngine.prepare({
      goal: input.goal,
      rootPlan: input.root_plan,
      rootArtifacts: input.root_artifacts,
      requestedProfile: input.requested_profile,
      routeProfile: input.route_profile,
      idempotencyKey: input.idempotency_key
    }), preparation = created.preparation;
    if (!created.duplicate && preparation.status === "planning") {
      let pid = launchRunner({ action: "prepare", workspace, stateRoot, preparationId: preparation.preparation_id });
      preparation = preparationStore.update(preparation.preparation_id, preparation.revision, null, (draft) => ({ ...draft, runner_pid: pid }), "planner-runner-launched");
    }
    return controllerResult("workflow_prepare", { preparation: preparationView(preparation), duplicate: created.duplicate });
  } catch (error) {
    return controllerFailure("workflow_prepare", error);
  }
});
server.registerTool("workflow_start", toolContract("workflow_start"), async (input) => {
  try {
    let { workspace, engine, store, stateRoot } = await context(input.workspace_root), started = engine.start({
      preparationId: input.preparation_id,
      approvedRootHash: input.approved_root_hash,
      expectedPreparationRevision: input.expected_preparation_revision,
      idempotencyKey: input.idempotency_key
    }), run = started.run;
    if (!started.duplicate && run.lifecycle === "queued") {
      let pid = launchRunner({ action: "execute", workspace, stateRoot, runId: run.run_id });
      run = store.update(run.run_id, run.revision, null, (draft) => ({ ...draft, runner_pid: pid }), "runner-launched");
    }
    return controllerResult("workflow_start", {
      run: runView(run),
      snapshot: engine.snapshot(run),
      preparation: preparationView(started.preparation),
      learning_source_receipt: learningSourceReceipts.issue(run),
      duplicate: started.duplicate
    });
  } catch (error) {
    return controllerFailure("workflow_start", error);
  }
});
server.registerTool("workflow_status", toolContract("workflow_status"), async (input) => {
  try {
    if ([input.run_id, input.preparation_id, input.root_plan_id].filter(Boolean).length > 1) throw new Error("workflow_status accepts only one of run_id, preparation_id, or root_plan_id");
    if (input.artifacts && (input.run_id || input.preparation_id)) throw new Error("workflow_status artifacts cannot be combined with a controller subject");
    if (input.artifacts && input.learning_source_receipt) throw new Error("manual workflow_status does not accept a controller learning source receipt");
    if (input.root_plan_id && !input.artifacts) throw new Error("manual workflow_status requires artifacts with root_plan_id");
    if (input.artifacts) return manualTools.status(input);
    if (input.manual_acceptance) throw new Error("workflow_status manual_acceptance requires current-task artifacts");
    let { workspace, stateRoot, store, preparationStore, engine } = await context(input.workspace_root), model_inheritance = modelInheritanceSummary(stateRoot);
    if (input.run_id) {
      let run = store.get(input.run_id), sourceBinding = learningSourceReceipts.verify(input.learning_source_receipt, run);
      return controllerResult("workflow_status", {
        subject_kind: "run",
        run: runView(run),
        snapshot: engine.snapshot(run),
        learning: deriveControllerLearningContext({ run, events: store.events(run.run_id), workspaceRoot: workspace, pluginRoot, sourceBinding }),
        model_inheritance
      });
    }
    if (input.preparation_id) {
      let preparation = preparationStore.get(input.preparation_id);
      return controllerResult("workflow_status", { subject_kind: "preparation", preparation: preparationView(preparation), learning: derivePreparationLearningContext(preparation), model_inheritance });
    }
    let active = [
      ...store.active().map((run) => ({ kind: "run", value: run })),
      ...preparationStore.active().map((preparation) => ({ kind: "preparation", value: preparation }))
    ];
    if (active.length === 0)
      return controllerResult("workflow_status", {
        subject_kind: "none",
        workflow_active: !1,
        message: "Workflow is inactive. This status is informational and never gates native Manual implementation.",
        model_inheritance
      });
    if (active.length > 1) throw new Error("multiple active Workflow subjects require an explicit ID");
    if (active[0].kind === "run") {
      let sourceBinding = learningSourceReceipts.verify(input.learning_source_receipt, active[0].value);
      return controllerResult("workflow_status", {
        subject_kind: "run",
        run: runView(active[0].value),
        snapshot: engine.snapshot(active[0].value),
        learning: deriveControllerLearningContext({ run: active[0].value, events: store.events(active[0].value.run_id), workspaceRoot: workspace, pluginRoot, sourceBinding }),
        model_inheritance
      });
    }
    return controllerResult("workflow_status", { subject_kind: "preparation", preparation: preparationView(active[0].value), learning: derivePreparationLearningContext(active[0].value), model_inheritance });
  } catch (error) {
    return controllerFailure("workflow_status", error);
  }
});
server.registerTool("workflow_watch", toolContract("workflow_watch"), async (input) => {
  try {
    requireOneSubject(input);
    let { store, preparationStore, engine } = await context(input.workspace_root);
    if (input.run_id) {
      let events2 = await watchEvents((after) => store.events(input.run_id, after), input.after_event, input.timeout_ms), run = store.get(input.run_id);
      return controllerResult("workflow_watch", { subject_kind: "run", events: events2, next_event: input.after_event + events2.length, run: runView(run), snapshot: engine.snapshot(run) });
    }
    let events = await watchEvents((after) => preparationStore.events(input.preparation_id, after), input.after_event, input.timeout_ms), preparation = preparationStore.get(input.preparation_id);
    return controllerResult("workflow_watch", { subject_kind: "preparation", events, next_event: input.after_event + events.length, preparation: preparationView(preparation) });
  } catch (error) {
    return controllerFailure("workflow_watch", error);
  }
});
server.registerTool("workflow_control", toolContract("workflow_control"), async (input) => {
  try {
    requireOneSubject(input);
    let { workspace, store, preparationStore, engine, stateRoot } = await context(input.workspace_root);
    if (input.preparation_id) {
      if (input.action !== "stop") throw new Error("preparations accept only stop");
      let runnerPid = null, mutation2 = preparationStore.controlUpdate(input.preparation_id, input.expected_revision, input.idempotency_key, (before) => {
        if (["consumed", "expired", "stopped"].includes(before.status)) throw new Error(`cannot stop preparation status ${before.status}`);
        return runnerPid = before.runner_pid, { ...before, status: "stopped", runner_pid: null, blockers: [.../* @__PURE__ */ new Set([...before.blockers ?? [], "stopped-by-user"])] };
      }, "preparation-stopped");
      if (!mutation2.duplicate && runnerPid) {
        writeWorkerControl(preparationStore.preparationDirectory(input.preparation_id), "stop", { reason: "user-stop" });
        let cooperative = await awaitCooperativeExit(runnerPid);
        if (cooperative.hard_kill_required) {
          try {
            process.kill(-runnerPid, "SIGTERM");
          } catch {
          }
          preparationStore.appendEvent(input.preparation_id, "planner-hard-cancelled", cooperative);
          let latest = preparationStore.get(input.preparation_id);
          preparationStore.update(input.preparation_id, latest.revision, null, (draft) => ({ ...draft, status: "interrupted", runner_pid: null, blockers: [.../* @__PURE__ */ new Set([...draft.blockers ?? [], "cooperative-cancel-grace-exceeded"])] }), "planner-cancel-interrupted");
        } else preparationStore.appendEvent(input.preparation_id, "planner-cooperatively-cancelled", cooperative);
      }
      return controllerResult("workflow_control", { subject_kind: "preparation", preparation: preparationView(mutation2.preparation), duplicate: mutation2.duplicate });
    }
    let controlledRunnerPid = null, mutation = idempotentRunMutation(store, input.run_id, input.expected_revision, input.idempotency_key, (before) => {
      if (input.action === "accept") {
        if (!["accept-verified", "accept-provisional"].includes(before.next_action)) throw new Error("delivery is not awaiting acceptance");
        if (!input.acceptance) throw new Error("delivery acceptance requires verified or provisional");
        engine.acceptDelivery(input.run_id, input.acceptance);
      } else if (input.action === "pause")
        controlledRunnerPid = before.runner_pid, engine.update(input.run_id, (draft) => ({ ...draft, lifecycle: "paused", next_action: "resume" }), "run-paused");
      else if (input.action === "resume") {
        if (!["paused", "interrupted"].includes(before.lifecycle)) throw new Error(`cannot resume lifecycle ${before.lifecycle}`);
        if (!before.plan) throw new Error("cannot resume without a complete schema-5 intent root");
        clearWorkerControl(store.runDirectory(input.run_id)), engine.update(input.run_id, (draft) => ({ ...draft, lifecycle: "queued", blockers: [], next_action: "execute-strategy" }), "run-resumed");
      } else input.action === "stop" && (controlledRunnerPid = before.runner_pid, engine.update(input.run_id, (draft) => ({ ...draft, lifecycle: "stopped", next_action: "none" }), "run-stopped"));
    }), run = mutation.value;
    if (!mutation.duplicate && ["pause", "stop"].includes(input.action) && controlledRunnerPid) {
      writeWorkerControl(store.runDirectory(input.run_id), input.action, { reason: `user-${input.action}` });
      let cooperative = await awaitCooperativeExit(controlledRunnerPid);
      if (cooperative.hard_kill_required) {
        try {
          process.kill(-controlledRunnerPid, "SIGTERM");
        } catch {
        }
        store.appendEvent(input.run_id, "runner-hard-cancelled", cooperative);
        let latest = store.get(input.run_id);
        run = store.update(input.run_id, latest.revision, null, (draft) => ({ ...draft, lifecycle: "interrupted", runner_pid: null, blockers: [.../* @__PURE__ */ new Set([...draft.blockers ?? [], "cooperative-cancel-grace-exceeded"])] }), "runner-cancel-interrupted");
      } else store.appendEvent(input.run_id, "runner-cooperatively-cancelled", cooperative);
    }
    if (!mutation.duplicate && run.lifecycle === "queued") {
      let pid = launchRunner({ action: "execute", workspace, stateRoot, runId: run.run_id });
      run = store.update(run.run_id, run.revision, null, (draft) => ({ ...draft, runner_pid: pid }), "runner-launched");
    }
    return controllerResult("workflow_control", { subject_kind: "run", run: runView(run), snapshot: engine.snapshot(run), learning_source_receipt: learningSourceReceipts.issue(run), duplicate: mutation.duplicate });
  } catch (error) {
    return controllerFailure("workflow_control", error);
  }
});
server.registerTool("workflow_answer", toolContract("workflow_answer"), async (input) => {
  try {
    let { store, engine } = await context(input.workspace_root), mutation = idempotentRunMutation(store, input.run_id, input.expected_revision, input.idempotency_key, (before) => {
      if (before.lifecycle !== "waiting-human") throw new Error("run is not waiting for a human answer");
      engine.update(input.run_id, (draft) => ({ ...draft, answers: [...draft.answers ?? [], { at: (/* @__PURE__ */ new Date()).toISOString(), answer: input.answer }], blockers: [], next_action: "replan" }), "answer-recorded");
    });
    return controllerResult("workflow_answer", { run: runView(mutation.value), snapshot: engine.snapshot(mutation.value), learning_source_receipt: learningSourceReceipts.issue(mutation.value), duplicate: mutation.duplicate });
  } catch (error) {
    return controllerFailure("workflow_answer", error);
  }
});
server.registerTool("workflow_validate_models", toolContract("workflow_validate_models"), async ({ workspace_root, route_profile }) => {
  try {
    let { workspace, stateRoot } = await context(workspace_root), config = loadWorkflowConfig(workspace);
    if (config.errors.length > 0) return controllerResult("workflow_validate_models", { verified: !1, errors: config.errors, capabilities: resolveCapabilities(stateRoot, {}, { pluginRoot }) });
    let profile = resolveRouteProfile(config, route_profile), validation = new CursorWorkerAdapter({ runDirectory: resolve6(stateRoot, "model-validation"), pluginRoot }).validateProfile(profile);
    return controllerResult("workflow_validate_models", { ...validation, capabilities: resolveCapabilities(stateRoot, { model_catalog_verified: validation.verified }, { pluginRoot }) });
  } catch (error) {
    return controllerResult("workflow_validate_models", {
      verified: !1,
      errors: [error.message],
      ...error instanceof WorkspaceRootError ? { error_code: error.code } : {}
    }, !0);
  }
});
server.registerTool("workflow_verification_profile", toolContract("workflow_verification_profile"), async (input) => {
  let ownedProofRoot = null, retainProof = !1;
  try {
    let { workspace, stateRoot } = await context(input.workspace_root);
    if (input.action === "draft") {
      if (!input.surface) throw new Error("draft requires surface");
      return controllerResult("workflow_verification_profile", draftVerificationProfile(workspace, input.surface, pluginRoot, input.manifest_path));
    }
    let inspection = inspectVerificationProfile(workspace, input.manifest_path, pluginRoot);
    if (input.action === "inspect") return controllerResult("workflow_verification_profile", inspection, !inspection.valid);
    if (input.action === "audit") return controllerResult("workflow_verification_profile", auditVerificationProfile(workspace, input.manifest_path, pluginRoot, stateRoot));
    if (input.action === "prove") {
      if (!inspection.valid) throw new Error(`verification profile invalid: ${inspection.errors.join("; ")}`);
      let config = loadWorkflowConfig(workspace);
      if (config.errors.length > 0) throw new Error(`workflow configuration invalid: ${config.errors.join("; ")}`);
      let route = resolveRouteProfile(config, input.route_profile), proofRoot = join5(stateRoot, "verification-proof-artifacts", inspection.profile_hash, randomUUID2());
      ownedProofRoot = proofRoot, mkdirSync3(proofRoot, { recursive: !0, mode: 448 });
      let adapter = new CursorWorkerAdapter({ runDirectory: join5(stateRoot, "verification-proof-runs", inspection.profile_hash), pluginRoot }), validation = adapter.validateProfile(route), verifier = validation.routes?.verifier;
      if (!validation.verified || !verifier?.selected_candidate || !verifier.model) throw new Error(`verifier route unavailable: ${(validation.errors ?? []).join("; ")}`);
      let prompt = [
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
      ].join(`

`), phase = adapter.runPhase({
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
      let reported = proofResult(phase.response.result), artifacts = proofArtifacts(proofRoot);
      if (artifacts.length === 0) throw new Error("verification proof produced no external artifacts");
      let recorded = recordVerificationProof(stateRoot, inspection, {
        capabilities: reported.capabilities,
        observations: reported.observations ?? null,
        limitations: reported.limitations ?? [],
        evidence_hashes: artifacts.map((artifact3) => artifact3.hash),
        artifacts,
        actor_receipt: phase.receipt
      });
      return retainProof = !0, controllerResult("workflow_verification_profile", recorded);
    }
    if (!input.approved_hash) throw new Error("approve requires approved_hash");
    if (!inspection.valid || inspection.profile_hash !== input.approved_hash) throw new Error("current verification profile does not match approved_hash");
    return controllerResult("workflow_verification_profile", approveVerificationProfile(stateRoot, inspection.manifest.profile_id, input.approved_hash));
  } catch (error) {
    return controllerFailure("workflow_verification_profile", error);
  } finally {
    ownedProofRoot && !retainProof && rmSync2(ownedProofRoot, { recursive: !0, force: !0 });
  }
});
var transport = new StdioServerTransport();
await server.connect(transport);
