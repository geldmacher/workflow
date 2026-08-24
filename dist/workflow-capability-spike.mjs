#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  AjvJsonSchemaValidator,
  CallToolResultSchema,
  CompleteResultSchema,
  CreateMessageRequestSchema,
  CreateMessageResultSchema,
  CreateMessageResultWithToolsSchema,
  CreateTaskResultSchema,
  ElicitRequestSchema,
  ElicitResultSchema,
  EmptyResultSchema,
  ErrorCode,
  GetPromptResultSchema,
  InitializeResultSchema,
  LATEST_PROTOCOL_VERSION,
  ListChangedOptionsBaseSchema,
  ListPromptsResultSchema,
  ListResourceTemplatesResultSchema,
  ListResourcesResultSchema,
  ListToolsResultSchema,
  McpError,
  PromptListChangedNotificationSchema,
  Protocol,
  ReadBuffer,
  ReadResourceResultSchema,
  ResourceListChangedNotificationSchema,
  SUPPORTED_PROTOCOL_VERSIONS,
  ToolListChangedNotificationSchema,
  WORKFLOW_TOOL_NAMES,
  assertClientRequestTaskCapability,
  assertToolsCallTaskCapability,
  getLiteralValue,
  getObjectShape,
  mergeCapabilities,
  safeParse,
  serializeMessage,
  writeWorkerControl
} from "./chunks/chunk-5NFZA76G.mjs";
import {
  CAPABILITY_RECEIPT_SCHEMA,
  REQUIRED_OBSERVATIONS,
  auditVerificationProfile,
  loadPlanningHarness,
  receiptAutomationSafe,
  receiptProfileEligibility,
  writeCapabilityReceipt
} from "./chunks/chunk-M7ERKP7Q.mjs";
import {
  createRunWorktree,
  loadWorkflowConfig,
  repositoryBaseline,
  resolveRouteProfile
} from "./chunks/chunk-QB5KAHPL.mjs";
import {
  CursorWorkerAdapter,
  currentPlatform,
  estimateCost,
  hashPluginTree,
  loadWorkerRuntimeManifest,
  sdkVersion,
  sha256File,
  workerRuntimeDirectory
} from "./chunks/chunk-7SYGAAH5.mjs";
import {
  probeSandboxBoundary
} from "./chunks/chunk-FTS4RQ3D.mjs";
import "./chunks/chunk-3CKZRPWU.mjs";
import {
  PreparationStore,
  RunStore,
  defaultStateRoot
} from "./chunks/chunk-7JUFD6FK.mjs";
import {
  PLUGIN_VERSION
} from "./chunks/chunk-7NHOTGTA.mjs";
import {
  __commonJS,
  __require,
  __toESM
} from "./chunks/chunk-WU6JOB3C.mjs";

// node_modules/isexe/windows.js
var require_windows = __commonJS({
  "node_modules/isexe/windows.js"(exports, module) {
    module.exports = isexe;
    isexe.sync = sync;
    var fs = __require("fs");
    function checkPathExt(path, options) {
      var pathext = options.pathExt !== void 0 ? options.pathExt : process.env.PATHEXT;
      if (!pathext || (pathext = pathext.split(";"), pathext.indexOf("") !== -1))
        return !0;
      for (var i = 0; i < pathext.length; i++) {
        var p = pathext[i].toLowerCase();
        if (p && path.substr(-p.length).toLowerCase() === p)
          return !0;
      }
      return !1;
    }
    function checkStat(stat, path, options) {
      return !stat.isSymbolicLink() && !stat.isFile() ? !1 : checkPathExt(path, options);
    }
    function isexe(path, options, cb) {
      fs.stat(path, function(er, stat) {
        cb(er, er ? !1 : checkStat(stat, path, options));
      });
    }
    function sync(path, options) {
      return checkStat(fs.statSync(path), path, options);
    }
  }
});

// node_modules/isexe/mode.js
var require_mode = __commonJS({
  "node_modules/isexe/mode.js"(exports, module) {
    module.exports = isexe;
    isexe.sync = sync;
    var fs = __require("fs");
    function isexe(path, options, cb) {
      fs.stat(path, function(er, stat) {
        cb(er, er ? !1 : checkStat(stat, options));
      });
    }
    function sync(path, options) {
      return checkStat(fs.statSync(path), options);
    }
    function checkStat(stat, options) {
      return stat.isFile() && checkMode(stat, options);
    }
    function checkMode(stat, options) {
      var mod = stat.mode, uid = stat.uid, gid = stat.gid, myUid = options.uid !== void 0 ? options.uid : process.getuid && process.getuid(), myGid = options.gid !== void 0 ? options.gid : process.getgid && process.getgid(), u = parseInt("100", 8), g = parseInt("010", 8), o = parseInt("001", 8), ug = u | g, ret = mod & o || mod & g && gid === myGid || mod & u && uid === myUid || mod & ug && myUid === 0;
      return ret;
    }
  }
});

// node_modules/isexe/index.js
var require_isexe = __commonJS({
  "node_modules/isexe/index.js"(exports, module) {
    var fs = __require("fs"), core;
    process.platform === "win32" || global.TESTING_WINDOWS ? core = require_windows() : core = require_mode();
    module.exports = isexe;
    isexe.sync = sync;
    function isexe(path, options, cb) {
      if (typeof options == "function" && (cb = options, options = {}), !cb) {
        if (typeof Promise != "function")
          throw new TypeError("callback not provided");
        return new Promise(function(resolve2, reject) {
          isexe(path, options || {}, function(er, is) {
            er ? reject(er) : resolve2(is);
          });
        });
      }
      core(path, options || {}, function(er, is) {
        er && (er.code === "EACCES" || options && options.ignoreErrors) && (er = null, is = !1), cb(er, is);
      });
    }
    function sync(path, options) {
      try {
        return core.sync(path, options || {});
      } catch (er) {
        if (options && options.ignoreErrors || er.code === "EACCES")
          return !1;
        throw er;
      }
    }
  }
});

// node_modules/which/which.js
var require_which = __commonJS({
  "node_modules/which/which.js"(exports, module) {
    var isWindows = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys", path = __require("path"), COLON = isWindows ? ";" : ":", isexe = require_isexe(), getNotFoundError = (cmd) => Object.assign(new Error(`not found: ${cmd}`), { code: "ENOENT" }), getPathInfo = (cmd, opt) => {
      let colon = opt.colon || COLON, pathEnv = cmd.match(/\//) || isWindows && cmd.match(/\\/) ? [""] : [
        // windows always checks the cwd first
        ...isWindows ? [process.cwd()] : [],
        ...(opt.path || process.env.PATH || /* istanbul ignore next: very unusual */
        "").split(colon)
      ], pathExtExe = isWindows ? opt.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM" : "", pathExt = isWindows ? pathExtExe.split(colon) : [""];
      return isWindows && cmd.indexOf(".") !== -1 && pathExt[0] !== "" && pathExt.unshift(""), {
        pathEnv,
        pathExt,
        pathExtExe
      };
    }, which = (cmd, opt, cb) => {
      typeof opt == "function" && (cb = opt, opt = {}), opt || (opt = {});
      let { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt), found = [], step = (i) => new Promise((resolve2, reject) => {
        if (i === pathEnv.length)
          return opt.all && found.length ? resolve2(found) : reject(getNotFoundError(cmd));
        let ppRaw = pathEnv[i], pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw, pCmd = path.join(pathPart, cmd), p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
        resolve2(subStep(p, i, 0));
      }), subStep = (p, i, ii) => new Promise((resolve2, reject) => {
        if (ii === pathExt.length)
          return resolve2(step(i + 1));
        let ext = pathExt[ii];
        isexe(p + ext, { pathExt: pathExtExe }, (er, is) => {
          if (!er && is)
            if (opt.all)
              found.push(p + ext);
            else
              return resolve2(p + ext);
          return resolve2(subStep(p, i, ii + 1));
        });
      });
      return cb ? step(0).then((res) => cb(null, res), cb) : step(0);
    }, whichSync = (cmd, opt) => {
      opt = opt || {};
      let { pathEnv, pathExt, pathExtExe } = getPathInfo(cmd, opt), found = [];
      for (let i = 0; i < pathEnv.length; i++) {
        let ppRaw = pathEnv[i], pathPart = /^".*"$/.test(ppRaw) ? ppRaw.slice(1, -1) : ppRaw, pCmd = path.join(pathPart, cmd), p = !pathPart && /^\.[\\\/]/.test(cmd) ? cmd.slice(0, 2) + pCmd : pCmd;
        for (let j = 0; j < pathExt.length; j++) {
          let cur = p + pathExt[j];
          try {
            if (isexe.sync(cur, { pathExt: pathExtExe }))
              if (opt.all)
                found.push(cur);
              else
                return cur;
          } catch {
          }
        }
      }
      if (opt.all && found.length)
        return found;
      if (opt.nothrow)
        return null;
      throw getNotFoundError(cmd);
    };
    module.exports = which;
    which.sync = whichSync;
  }
});

// node_modules/path-key/index.js
var require_path_key = __commonJS({
  "node_modules/path-key/index.js"(exports, module) {
    "use strict";
    var pathKey = (options = {}) => {
      let environment = options.env || process.env;
      return (options.platform || process.platform) !== "win32" ? "PATH" : Object.keys(environment).reverse().find((key) => key.toUpperCase() === "PATH") || "Path";
    };
    module.exports = pathKey;
    module.exports.default = pathKey;
  }
});

// node_modules/cross-spawn/lib/util/resolveCommand.js
var require_resolveCommand = __commonJS({
  "node_modules/cross-spawn/lib/util/resolveCommand.js"(exports, module) {
    "use strict";
    var path = __require("path"), which = require_which(), getPathKey = require_path_key();
    function resolveCommandAttempt(parsed, withoutPathExt) {
      let env = parsed.options.env || process.env, cwd = process.cwd(), hasCustomCwd = parsed.options.cwd != null, shouldSwitchCwd = hasCustomCwd && process.chdir !== void 0 && !process.chdir.disabled;
      if (shouldSwitchCwd)
        try {
          process.chdir(parsed.options.cwd);
        } catch {
        }
      let resolved;
      try {
        resolved = which.sync(parsed.command, {
          path: env[getPathKey({ env })],
          pathExt: withoutPathExt ? path.delimiter : void 0
        });
      } catch {
      } finally {
        shouldSwitchCwd && process.chdir(cwd);
      }
      return resolved && (resolved = path.resolve(hasCustomCwd ? parsed.options.cwd : "", resolved)), resolved;
    }
    function resolveCommand(parsed) {
      return resolveCommandAttempt(parsed) || resolveCommandAttempt(parsed, !0);
    }
    module.exports = resolveCommand;
  }
});

// node_modules/cross-spawn/lib/util/escape.js
var require_escape = __commonJS({
  "node_modules/cross-spawn/lib/util/escape.js"(exports, module) {
    "use strict";
    var metaCharsRegExp = /([()\][%!^"`<>&|;, *?])/g;
    function escapeCommand(arg) {
      return arg = arg.replace(metaCharsRegExp, "^$1"), arg;
    }
    function escapeArgument(arg, doubleEscapeMetaChars) {
      return arg = `${arg}`, arg = arg.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"'), arg = arg.replace(/(?=(\\+?)?)\1$/, "$1$1"), arg = `"${arg}"`, arg = arg.replace(metaCharsRegExp, "^$1"), doubleEscapeMetaChars && (arg = arg.replace(metaCharsRegExp, "^$1")), arg;
    }
    module.exports.command = escapeCommand;
    module.exports.argument = escapeArgument;
  }
});

// node_modules/shebang-regex/index.js
var require_shebang_regex = __commonJS({
  "node_modules/shebang-regex/index.js"(exports, module) {
    "use strict";
    module.exports = /^#!(.*)/;
  }
});

// node_modules/shebang-command/index.js
var require_shebang_command = __commonJS({
  "node_modules/shebang-command/index.js"(exports, module) {
    "use strict";
    var shebangRegex = require_shebang_regex();
    module.exports = (string = "") => {
      let match = string.match(shebangRegex);
      if (!match)
        return null;
      let [path, argument2] = match[0].replace(/#! ?/, "").split(" "), binary = path.split("/").pop();
      return binary === "env" ? argument2 : argument2 ? `${binary} ${argument2}` : binary;
    };
  }
});

// node_modules/cross-spawn/lib/util/readShebang.js
var require_readShebang = __commonJS({
  "node_modules/cross-spawn/lib/util/readShebang.js"(exports, module) {
    "use strict";
    var fs = __require("fs"), shebangCommand = require_shebang_command();
    function readShebang(command) {
      let buffer = Buffer.alloc(150), fd;
      try {
        fd = fs.openSync(command, "r"), fs.readSync(fd, buffer, 0, 150, 0), fs.closeSync(fd);
      } catch {
      }
      return shebangCommand(buffer.toString());
    }
    module.exports = readShebang;
  }
});

// node_modules/cross-spawn/lib/parse.js
var require_parse = __commonJS({
  "node_modules/cross-spawn/lib/parse.js"(exports, module) {
    "use strict";
    var path = __require("path"), resolveCommand = require_resolveCommand(), escape = require_escape(), readShebang = require_readShebang(), isWin = process.platform === "win32", isExecutableRegExp = /\.(?:com|exe)$/i, isCmdShimRegExp = /node_modules[\\/].bin[\\/][^\\/]+\.cmd$/i;
    function detectShebang(parsed) {
      parsed.file = resolveCommand(parsed);
      let shebang = parsed.file && readShebang(parsed.file);
      return shebang ? (parsed.args.unshift(parsed.file), parsed.command = shebang, resolveCommand(parsed)) : parsed.file;
    }
    function parseNonShell(parsed) {
      if (!isWin)
        return parsed;
      let commandFile = detectShebang(parsed), needsShell = !isExecutableRegExp.test(commandFile);
      if (parsed.options.forceShell || needsShell) {
        let needsDoubleEscapeMetaChars = isCmdShimRegExp.test(commandFile);
        parsed.command = path.normalize(parsed.command), parsed.command = escape.command(parsed.command), parsed.args = parsed.args.map((arg) => escape.argument(arg, needsDoubleEscapeMetaChars));
        let shellCommand = [parsed.command].concat(parsed.args).join(" ");
        parsed.args = ["/d", "/s", "/c", `"${shellCommand}"`], parsed.command = process.env.comspec || "cmd.exe", parsed.options.windowsVerbatimArguments = !0;
      }
      return parsed;
    }
    function parse(command, args, options) {
      args && !Array.isArray(args) && (options = args, args = null), args = args ? args.slice(0) : [], options = Object.assign({}, options);
      let parsed = {
        command,
        args,
        options,
        file: void 0,
        original: {
          command,
          args
        }
      };
      return options.shell ? parsed : parseNonShell(parsed);
    }
    module.exports = parse;
  }
});

// node_modules/cross-spawn/lib/enoent.js
var require_enoent = __commonJS({
  "node_modules/cross-spawn/lib/enoent.js"(exports, module) {
    "use strict";
    var isWin = process.platform === "win32";
    function notFoundError(original, syscall) {
      return Object.assign(new Error(`${syscall} ${original.command} ENOENT`), {
        code: "ENOENT",
        errno: "ENOENT",
        syscall: `${syscall} ${original.command}`,
        path: original.command,
        spawnargs: original.args
      });
    }
    function hookChildProcess(cp, parsed) {
      if (!isWin)
        return;
      let originalEmit = cp.emit;
      cp.emit = function(name, arg1) {
        if (name === "exit") {
          let err = verifyENOENT(arg1, parsed);
          if (err)
            return originalEmit.call(cp, "error", err);
        }
        return originalEmit.apply(cp, arguments);
      };
    }
    function verifyENOENT(status, parsed) {
      return isWin && status === 1 && !parsed.file ? notFoundError(parsed.original, "spawn") : null;
    }
    function verifyENOENTSync(status, parsed) {
      return isWin && status === 1 && !parsed.file ? notFoundError(parsed.original, "spawnSync") : null;
    }
    module.exports = {
      hookChildProcess,
      verifyENOENT,
      verifyENOENTSync,
      notFoundError
    };
  }
});

// node_modules/cross-spawn/index.js
var require_cross_spawn = __commonJS({
  "node_modules/cross-spawn/index.js"(exports, module) {
    "use strict";
    var cp = __require("child_process"), parse = require_parse(), enoent = require_enoent();
    function spawn3(command, args, options) {
      let parsed = parse(command, args, options), spawned = cp.spawn(parsed.command, parsed.args, parsed.options);
      return enoent.hookChildProcess(spawned, parsed), spawned;
    }
    function spawnSync2(command, args, options) {
      let parsed = parse(command, args, options), result = cp.spawnSync(parsed.command, parsed.args, parsed.options);
      return result.error = result.error || enoent.verifyENOENTSync(result.status, parsed), result;
    }
    module.exports = spawn3;
    module.exports.spawn = spawn3;
    module.exports.sync = spawnSync2;
    module.exports._parse = parse;
    module.exports._enoent = enoent;
  }
});

// scripts/capability-spike.mjs
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { platform as osPlatform, release as osRelease, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn as spawn2, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";

// node_modules/@modelcontextprotocol/sdk/dist/esm/experimental/tasks/client.js
var ExperimentalClientTasks = class {
  constructor(_client) {
    this._client = _client;
  }
  /**
   * Calls a tool and returns an AsyncGenerator that yields response messages.
   * The generator is guaranteed to end with either a 'result' or 'error' message.
   *
   * This method provides streaming access to tool execution, allowing you to
   * observe intermediate task status updates for long-running tool calls.
   * Automatically validates structured output if the tool has an outputSchema.
   *
   * @example
   * ```typescript
   * const stream = client.experimental.tasks.callToolStream({ name: 'myTool', arguments: {} });
   * for await (const message of stream) {
   *   switch (message.type) {
   *     case 'taskCreated':
   *       console.log('Tool execution started:', message.task.taskId);
   *       break;
   *     case 'taskStatus':
   *       console.log('Tool status:', message.task.status);
   *       break;
   *     case 'result':
   *       console.log('Tool result:', message.result);
   *       break;
   *     case 'error':
   *       console.error('Tool error:', message.error);
   *       break;
   *   }
   * }
   * ```
   *
   * @param params - Tool call parameters (name and arguments)
   * @param resultSchema - Zod schema for validating the result (defaults to CallToolResultSchema)
   * @param options - Optional request options (timeout, signal, task creation params, etc.)
   * @returns AsyncGenerator that yields ResponseMessage objects
   *
   * @experimental
   */
  async *callToolStream(params, resultSchema = CallToolResultSchema, options) {
    let clientInternal = this._client, optionsWithTask = {
      ...options,
      // We check if the tool is known to be a task during auto-configuration, but assume
      // the caller knows what they're doing if they pass this explicitly
      task: options?.task ?? (clientInternal.isToolTask(params.name) ? {} : void 0)
    }, stream = clientInternal.requestStream({ method: "tools/call", params }, resultSchema, optionsWithTask), validator = clientInternal.getToolOutputValidator(params.name);
    for await (let message of stream) {
      if (message.type === "result" && validator) {
        let result = message.result;
        if (!result.structuredContent && !result.isError) {
          yield {
            type: "error",
            error: new McpError(ErrorCode.InvalidRequest, `Tool ${params.name} has an output schema but did not return structured content`)
          };
          return;
        }
        if (result.structuredContent)
          try {
            let validationResult = validator(result.structuredContent);
            if (!validationResult.valid) {
              yield {
                type: "error",
                error: new McpError(ErrorCode.InvalidParams, `Structured content does not match the tool's output schema: ${validationResult.errorMessage}`)
              };
              return;
            }
          } catch (error) {
            if (error instanceof McpError) {
              yield { type: "error", error };
              return;
            }
            yield {
              type: "error",
              error: new McpError(ErrorCode.InvalidParams, `Failed to validate structured content: ${error instanceof Error ? error.message : String(error)}`)
            };
            return;
          }
      }
      yield message;
    }
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
    return this._client.getTask({ taskId }, options);
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
    return this._client.getTaskResult({ taskId }, resultSchema, options);
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
    return this._client.listTasks(cursor ? { cursor } : void 0, options);
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
    return this._client.cancelTask({ taskId }, options);
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
    return this._client.requestStream(request, resultSchema, options);
  }
};

// node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js
function applyElicitationDefaults(schema, data) {
  if (!(!schema || data === null || typeof data != "object")) {
    if (schema.type === "object" && schema.properties && typeof schema.properties == "object") {
      let obj = data, props = schema.properties;
      for (let key of Object.keys(props)) {
        let propSchema = props[key];
        obj[key] === void 0 && Object.prototype.hasOwnProperty.call(propSchema, "default") && (obj[key] = propSchema.default), obj[key] !== void 0 && applyElicitationDefaults(propSchema, obj[key]);
      }
    }
    if (Array.isArray(schema.anyOf))
      for (let sub of schema.anyOf)
        typeof sub != "boolean" && applyElicitationDefaults(sub, data);
    if (Array.isArray(schema.oneOf))
      for (let sub of schema.oneOf)
        typeof sub != "boolean" && applyElicitationDefaults(sub, data);
  }
}
function getSupportedElicitationModes(capabilities) {
  if (!capabilities)
    return { supportsFormMode: !1, supportsUrlMode: !1 };
  let hasFormCapability = capabilities.form !== void 0, hasUrlCapability = capabilities.url !== void 0;
  return { supportsFormMode: hasFormCapability || !hasFormCapability && !hasUrlCapability, supportsUrlMode: hasUrlCapability };
}
var Client = class extends Protocol {
  /**
   * Initializes this client with the given name and version information.
   */
  constructor(_clientInfo, options) {
    super(options), this._clientInfo = _clientInfo, this._cachedToolOutputValidators = /* @__PURE__ */ new Map(), this._cachedKnownTaskTools = /* @__PURE__ */ new Set(), this._cachedRequiredTaskTools = /* @__PURE__ */ new Set(), this._listChangedDebounceTimers = /* @__PURE__ */ new Map(), this._capabilities = options?.capabilities ?? {}, this._jsonSchemaValidator = options?.jsonSchemaValidator ?? new AjvJsonSchemaValidator(), options?.listChanged && (this._pendingListChangedConfig = options.listChanged);
  }
  /**
   * Set up handlers for list changed notifications based on config and server capabilities.
   * This should only be called after initialization when server capabilities are known.
   * Handlers are silently skipped if the server doesn't advertise the corresponding listChanged capability.
   * @internal
   */
  _setupListChangedHandlers(config) {
    config.tools && this._serverCapabilities?.tools?.listChanged && this._setupListChangedHandler("tools", ToolListChangedNotificationSchema, config.tools, async () => (await this.listTools()).tools), config.prompts && this._serverCapabilities?.prompts?.listChanged && this._setupListChangedHandler("prompts", PromptListChangedNotificationSchema, config.prompts, async () => (await this.listPrompts()).prompts), config.resources && this._serverCapabilities?.resources?.listChanged && this._setupListChangedHandler("resources", ResourceListChangedNotificationSchema, config.resources, async () => (await this.listResources()).resources);
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
      tasks: new ExperimentalClientTasks(this)
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
   * Override request handler registration to enforce client-side validation for elicitation.
   */
  setRequestHandler(requestSchema, handler) {
    let methodSchema = getObjectShape(requestSchema)?.method;
    if (!methodSchema)
      throw new Error("Schema is missing a method literal");
    let methodValue = getLiteralValue(methodSchema);
    if (typeof methodValue != "string")
      throw new Error("Schema method literal must be a string");
    let method = methodValue;
    if (method === "elicitation/create") {
      let wrappedHandler = async (request, extra) => {
        let validatedRequest = safeParse(ElicitRequestSchema, request);
        if (!validatedRequest.success) {
          let errorMessage = validatedRequest.error instanceof Error ? validatedRequest.error.message : String(validatedRequest.error);
          throw new McpError(ErrorCode.InvalidParams, `Invalid elicitation request: ${errorMessage}`);
        }
        let { params } = validatedRequest.data;
        params.mode = params.mode ?? "form";
        let { supportsFormMode, supportsUrlMode } = getSupportedElicitationModes(this._capabilities.elicitation);
        if (params.mode === "form" && !supportsFormMode)
          throw new McpError(ErrorCode.InvalidParams, "Client does not support form-mode elicitation requests");
        if (params.mode === "url" && !supportsUrlMode)
          throw new McpError(ErrorCode.InvalidParams, "Client does not support URL-mode elicitation requests");
        let result = await Promise.resolve(handler(request, extra));
        if (params.task) {
          let taskValidationResult = safeParse(CreateTaskResultSchema, result);
          if (!taskValidationResult.success) {
            let errorMessage = taskValidationResult.error instanceof Error ? taskValidationResult.error.message : String(taskValidationResult.error);
            throw new McpError(ErrorCode.InvalidParams, `Invalid task creation result: ${errorMessage}`);
          }
          return taskValidationResult.data;
        }
        let validationResult = safeParse(ElicitResultSchema, result);
        if (!validationResult.success) {
          let errorMessage = validationResult.error instanceof Error ? validationResult.error.message : String(validationResult.error);
          throw new McpError(ErrorCode.InvalidParams, `Invalid elicitation result: ${errorMessage}`);
        }
        let validatedResult = validationResult.data, requestedSchema = params.mode === "form" ? params.requestedSchema : void 0;
        if (params.mode === "form" && validatedResult.action === "accept" && validatedResult.content && requestedSchema && this._capabilities.elicitation?.form?.applyDefaults)
          try {
            applyElicitationDefaults(requestedSchema, validatedResult.content);
          } catch {
          }
        return validatedResult;
      };
      return super.setRequestHandler(requestSchema, wrappedHandler);
    }
    if (method === "sampling/createMessage") {
      let wrappedHandler = async (request, extra) => {
        let validatedRequest = safeParse(CreateMessageRequestSchema, request);
        if (!validatedRequest.success) {
          let errorMessage = validatedRequest.error instanceof Error ? validatedRequest.error.message : String(validatedRequest.error);
          throw new McpError(ErrorCode.InvalidParams, `Invalid sampling request: ${errorMessage}`);
        }
        let { params } = validatedRequest.data, result = await Promise.resolve(handler(request, extra));
        if (params.task) {
          let taskValidationResult = safeParse(CreateTaskResultSchema, result);
          if (!taskValidationResult.success) {
            let errorMessage = taskValidationResult.error instanceof Error ? taskValidationResult.error.message : String(taskValidationResult.error);
            throw new McpError(ErrorCode.InvalidParams, `Invalid task creation result: ${errorMessage}`);
          }
          return taskValidationResult.data;
        }
        let resultSchema = params.tools || params.toolChoice ? CreateMessageResultWithToolsSchema : CreateMessageResultSchema, validationResult = safeParse(resultSchema, result);
        if (!validationResult.success) {
          let errorMessage = validationResult.error instanceof Error ? validationResult.error.message : String(validationResult.error);
          throw new McpError(ErrorCode.InvalidParams, `Invalid sampling result: ${errorMessage}`);
        }
        return validationResult.data;
      };
      return super.setRequestHandler(requestSchema, wrappedHandler);
    }
    return super.setRequestHandler(requestSchema, handler);
  }
  assertCapability(capability, method) {
    if (!this._serverCapabilities?.[capability])
      throw new Error(`Server does not support ${capability} (required for ${method})`);
  }
  async connect(transport, options) {
    if (await super.connect(transport), transport.sessionId === void 0)
      try {
        let result = await this.request({
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: this._capabilities,
            clientInfo: this._clientInfo
          }
        }, InitializeResultSchema, options);
        if (result === void 0)
          throw new Error(`Server sent invalid initialize result: ${result}`);
        if (!SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion))
          throw new Error(`Server's protocol version is not supported: ${result.protocolVersion}`);
        this._serverCapabilities = result.capabilities, this._serverVersion = result.serverInfo, transport.setProtocolVersion && transport.setProtocolVersion(result.protocolVersion), this._instructions = result.instructions, await this.notification({
          method: "notifications/initialized"
        }), this._pendingListChangedConfig && (this._setupListChangedHandlers(this._pendingListChangedConfig), this._pendingListChangedConfig = void 0);
      } catch (error) {
        throw this.close(), error;
      }
  }
  /**
   * After initialization has completed, this will be populated with the server's reported capabilities.
   */
  getServerCapabilities() {
    return this._serverCapabilities;
  }
  /**
   * After initialization has completed, this will be populated with information about the server's name and version.
   */
  getServerVersion() {
    return this._serverVersion;
  }
  /**
   * After initialization has completed, this may be populated with information about the server's instructions.
   */
  getInstructions() {
    return this._instructions;
  }
  assertCapabilityForMethod(method) {
    switch (method) {
      case "logging/setLevel":
        if (!this._serverCapabilities?.logging)
          throw new Error(`Server does not support logging (required for ${method})`);
        break;
      case "prompts/get":
      case "prompts/list":
        if (!this._serverCapabilities?.prompts)
          throw new Error(`Server does not support prompts (required for ${method})`);
        break;
      case "resources/list":
      case "resources/templates/list":
      case "resources/read":
      case "resources/subscribe":
      case "resources/unsubscribe":
        if (!this._serverCapabilities?.resources)
          throw new Error(`Server does not support resources (required for ${method})`);
        if (method === "resources/subscribe" && !this._serverCapabilities.resources.subscribe)
          throw new Error(`Server does not support resource subscriptions (required for ${method})`);
        break;
      case "tools/call":
      case "tools/list":
        if (!this._serverCapabilities?.tools)
          throw new Error(`Server does not support tools (required for ${method})`);
        break;
      case "completion/complete":
        if (!this._serverCapabilities?.completions)
          throw new Error(`Server does not support completions (required for ${method})`);
        break;
      case "initialize":
        break;
      case "ping":
        break;
    }
  }
  assertNotificationCapability(method) {
    switch (method) {
      case "notifications/roots/list_changed":
        if (!this._capabilities.roots?.listChanged)
          throw new Error(`Client does not support roots list changed notifications (required for ${method})`);
        break;
      case "notifications/initialized":
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
        case "sampling/createMessage":
          if (!this._capabilities.sampling)
            throw new Error(`Client does not support sampling capability (required for ${method})`);
          break;
        case "elicitation/create":
          if (!this._capabilities.elicitation)
            throw new Error(`Client does not support elicitation capability (required for ${method})`);
          break;
        case "roots/list":
          if (!this._capabilities.roots)
            throw new Error(`Client does not support roots capability (required for ${method})`);
          break;
        case "tasks/get":
        case "tasks/list":
        case "tasks/result":
        case "tasks/cancel":
          if (!this._capabilities.tasks)
            throw new Error(`Client does not support tasks capability (required for ${method})`);
          break;
        case "ping":
          break;
      }
  }
  assertTaskCapability(method) {
    assertToolsCallTaskCapability(this._serverCapabilities?.tasks?.requests, method, "Server");
  }
  assertTaskHandlerCapability(method) {
    this._capabilities && assertClientRequestTaskCapability(this._capabilities.tasks?.requests, method, "Client");
  }
  async ping(options) {
    return this.request({ method: "ping" }, EmptyResultSchema, options);
  }
  async complete(params, options) {
    return this.request({ method: "completion/complete", params }, CompleteResultSchema, options);
  }
  async setLoggingLevel(level, options) {
    return this.request({ method: "logging/setLevel", params: { level } }, EmptyResultSchema, options);
  }
  async getPrompt(params, options) {
    return this.request({ method: "prompts/get", params }, GetPromptResultSchema, options);
  }
  async listPrompts(params, options) {
    return this.request({ method: "prompts/list", params }, ListPromptsResultSchema, options);
  }
  async listResources(params, options) {
    return this.request({ method: "resources/list", params }, ListResourcesResultSchema, options);
  }
  async listResourceTemplates(params, options) {
    return this.request({ method: "resources/templates/list", params }, ListResourceTemplatesResultSchema, options);
  }
  async readResource(params, options) {
    return this.request({ method: "resources/read", params }, ReadResourceResultSchema, options);
  }
  async subscribeResource(params, options) {
    return this.request({ method: "resources/subscribe", params }, EmptyResultSchema, options);
  }
  async unsubscribeResource(params, options) {
    return this.request({ method: "resources/unsubscribe", params }, EmptyResultSchema, options);
  }
  /**
   * Calls a tool and waits for the result. Automatically validates structured output if the tool has an outputSchema.
   *
   * For task-based execution with streaming behavior, use client.experimental.tasks.callToolStream() instead.
   */
  async callTool(params, resultSchema = CallToolResultSchema, options) {
    if (this.isToolTaskRequired(params.name))
      throw new McpError(ErrorCode.InvalidRequest, `Tool "${params.name}" requires task-based execution. Use client.experimental.tasks.callToolStream() instead.`);
    let result = await this.request({ method: "tools/call", params }, resultSchema, options), validator = this.getToolOutputValidator(params.name);
    if (validator) {
      if (!result.structuredContent && !result.isError)
        throw new McpError(ErrorCode.InvalidRequest, `Tool ${params.name} has an output schema but did not return structured content`);
      if (result.structuredContent)
        try {
          let validationResult = validator(result.structuredContent);
          if (!validationResult.valid)
            throw new McpError(ErrorCode.InvalidParams, `Structured content does not match the tool's output schema: ${validationResult.errorMessage}`);
        } catch (error) {
          throw error instanceof McpError ? error : new McpError(ErrorCode.InvalidParams, `Failed to validate structured content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return result;
  }
  isToolTask(toolName) {
    return this._serverCapabilities?.tasks?.requests?.tools?.call ? this._cachedKnownTaskTools.has(toolName) : !1;
  }
  /**
   * Check if a tool requires task-based execution.
   * Unlike isToolTask which includes 'optional' tools, this only checks for 'required'.
   */
  isToolTaskRequired(toolName) {
    return this._cachedRequiredTaskTools.has(toolName);
  }
  /**
   * Cache validators for tool output schemas.
   * Called after listTools() to pre-compile validators for better performance.
   */
  cacheToolMetadata(tools) {
    this._cachedToolOutputValidators.clear(), this._cachedKnownTaskTools.clear(), this._cachedRequiredTaskTools.clear();
    for (let tool of tools) {
      if (tool.outputSchema) {
        let toolValidator = this._jsonSchemaValidator.getValidator(tool.outputSchema);
        this._cachedToolOutputValidators.set(tool.name, toolValidator);
      }
      let taskSupport = tool.execution?.taskSupport;
      (taskSupport === "required" || taskSupport === "optional") && this._cachedKnownTaskTools.add(tool.name), taskSupport === "required" && this._cachedRequiredTaskTools.add(tool.name);
    }
  }
  /**
   * Get cached validator for a tool
   */
  getToolOutputValidator(toolName) {
    return this._cachedToolOutputValidators.get(toolName);
  }
  async listTools(params, options) {
    let result = await this.request({ method: "tools/list", params }, ListToolsResultSchema, options);
    return this.cacheToolMetadata(result.tools), result;
  }
  /**
   * Set up a single list changed handler.
   * @internal
   */
  _setupListChangedHandler(listType, notificationSchema, options, fetcher) {
    let parseResult = ListChangedOptionsBaseSchema.safeParse(options);
    if (!parseResult.success)
      throw new Error(`Invalid ${listType} listChanged options: ${parseResult.error.message}`);
    if (typeof options.onChanged != "function")
      throw new Error(`Invalid ${listType} listChanged options: onChanged must be a function`);
    let { autoRefresh, debounceMs } = parseResult.data, { onChanged } = options, refresh = async () => {
      if (!autoRefresh) {
        onChanged(null, null);
        return;
      }
      try {
        let items = await fetcher();
        onChanged(null, items);
      } catch (e) {
        let error = e instanceof Error ? e : new Error(String(e));
        onChanged(error, null);
      }
    }, handler = () => {
      if (debounceMs) {
        let existingTimer = this._listChangedDebounceTimers.get(listType);
        existingTimer && clearTimeout(existingTimer);
        let timer = setTimeout(refresh, debounceMs);
        this._listChangedDebounceTimers.set(listType, timer);
      } else
        refresh();
    };
    this.setNotificationHandler(notificationSchema, handler);
  }
  async sendRootsListChanged() {
    return this.notification({ method: "notifications/roots/list_changed" });
  }
};

// node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js
var import_cross_spawn = __toESM(require_cross_spawn(), 1);
import process2 from "node:process";
import { PassThrough } from "node:stream";
var DEFAULT_INHERITED_ENV_VARS = process2.platform === "win32" ? [
  "APPDATA",
  "HOMEDRIVE",
  "HOMEPATH",
  "LOCALAPPDATA",
  "PATH",
  "PROCESSOR_ARCHITECTURE",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "USERNAME",
  "USERPROFILE",
  "PROGRAMFILES"
] : (
  /* list inspired by the default env inheritance of sudo */
  ["HOME", "LOGNAME", "PATH", "SHELL", "TERM", "USER"]
);
function getDefaultEnvironment() {
  let env = {};
  for (let key of DEFAULT_INHERITED_ENV_VARS) {
    let value = process2.env[key];
    value !== void 0 && (value.startsWith("()") || (env[key] = value));
  }
  return env;
}
var StdioClientTransport = class {
  constructor(server) {
    this._stderrStream = null, this._serverParams = server, this._readBuffer = new ReadBuffer({ maxBufferSize: server.maxBufferSize }), (server.stderr === "pipe" || server.stderr === "overlapped") && (this._stderrStream = new PassThrough());
  }
  /**
   * Starts the server process and prepares to communicate with it.
   */
  async start() {
    if (this._process)
      throw new Error("StdioClientTransport already started! If using Client class, note that connect() calls start() automatically.");
    return new Promise((resolve2, reject) => {
      this._process = (0, import_cross_spawn.default)(this._serverParams.command, this._serverParams.args ?? [], {
        // merge default env with server env because mcp server needs some env vars
        env: {
          ...getDefaultEnvironment(),
          ...this._serverParams.env
        },
        stdio: ["pipe", "pipe", this._serverParams.stderr ?? "inherit"],
        shell: !1,
        windowsHide: process2.platform === "win32",
        cwd: this._serverParams.cwd
      }), this._process.on("error", (error) => {
        reject(error), this.onerror?.(error);
      }), this._process.on("spawn", () => {
        resolve2();
      }), this._process.on("close", (_code) => {
        this._process = void 0, this.onclose?.();
      }), this._process.stdin?.on("error", (error) => {
        this.onerror?.(error);
      }), this._process.stdout?.on("data", (chunk) => {
        try {
          this._readBuffer.append(chunk), this.processReadBuffer();
        } catch (error) {
          this.onerror?.(error), this.close().catch(() => {
          });
        }
      }), this._process.stdout?.on("error", (error) => {
        this.onerror?.(error);
      }), this._stderrStream && this._process.stderr && this._process.stderr.pipe(this._stderrStream);
    });
  }
  /**
   * The stderr stream of the child process, if `StdioServerParameters.stderr` was set to "pipe" or "overlapped".
   *
   * If stderr piping was requested, a PassThrough stream is returned _immediately_, allowing callers to
   * attach listeners before the start method is invoked. This prevents loss of any early
   * error output emitted by the child process.
   */
  get stderr() {
    return this._stderrStream ? this._stderrStream : this._process?.stderr ?? null;
  }
  /**
   * The child process pid spawned by this transport.
   *
   * This is only available after the transport has been started.
   */
  get pid() {
    return this._process?.pid ?? null;
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
    if (this._process) {
      let processToClose = this._process;
      this._process = void 0;
      let closePromise = new Promise((resolve2) => {
        processToClose.once("close", () => {
          resolve2();
        });
      });
      try {
        processToClose.stdin?.end();
      } catch {
      }
      if (await Promise.race([closePromise, new Promise((resolve2) => setTimeout(resolve2, 2e3).unref())]), processToClose.exitCode === null) {
        try {
          processToClose.kill("SIGTERM");
        } catch {
        }
        await Promise.race([closePromise, new Promise((resolve2) => setTimeout(resolve2, 2e3).unref())]);
      }
      if (processToClose.exitCode === null)
        try {
          processToClose.kill("SIGKILL");
        } catch {
        }
    }
    this._readBuffer.clear();
  }
  send(message) {
    return new Promise((resolve2) => {
      if (!this._process?.stdin)
        throw new Error("Not connected");
      let json = serializeMessage(message);
      this._process.stdin.write(json) ? resolve2() : this._process.stdin.once("drain", resolve2);
    });
  }
};

// scripts/capability-spike.mjs
var root = dirname(dirname(fileURLToPath(import.meta.url))), temporary = mkdtempSync(join(tmpdir(), "workflow-capability-spike-")), paidCostLedger = null, paidExecutionAllowed = !1, paidExecutionBlocker = "requires explicit --approve-sdk-cost";
function argument(name) {
  let index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}
function git(cwd, args) {
  let result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim());
}
function hash(value) {
  return createHash("sha256").update(typeof value == "string" ? value : JSON.stringify(value)).digest("hex");
}
function skipped(reason) {
  return { verified: !1, skipped: !0, reason };
}
function observation(value, repetitions = 1) {
  return { verified: value?.verified === !0, repetitions: value?.verified === !0 ? repetitions : 0, evidence_hash: hash(value) };
}
function recordPaidCost(label, cost) {
  if (paidCostLedger) {
    if (!Number.isFinite(cost)) throw new Error(`paid capability phase ${label} returned no attestable usage/pricing; refusing the next paid call`);
    if (paidCostLedger.spent_usd += cost, paidCostLedger.entries.push({ label, cost_usd: cost }), paidCostLedger.spent_usd > paidCostLedger.max_cost_usd) throw new Error(`paid capability cost cap exceeded after ${label}: ${paidCostLedger.spent_usd} > ${paidCostLedger.max_cost_usd}`);
  }
}
function assertPaidBudgetRemaining(label) {
  if (paidCostLedger && paidCostLedger.spent_usd >= paidCostLedger.max_cost_usd) throw new Error(`no paid capability budget remains before ${label}`);
}
function archiveExternalEvidence(stateRoot, name, value) {
  let directory = join(stateRoot, "certification", (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-"));
  mkdirSync(directory, { recursive: !0, mode: 448 });
  let path = join(directory, name), temporary2 = `${path}.${process.pid}.${randomUUID()}.tmp`;
  return writeFileSync(temporary2, `${JSON.stringify(value, null, 2)}
`, { mode: 384 }), renameSync(temporary2, path), path;
}
async function startNetworkCanary() {
  let child = spawn2(process.execPath, ["-e", "const http=require('node:http');let hits=0;const server=http.createServer((q,s)=>{if(q.url==='/status'){s.writeHead(200,{'content-type':'application/json'});s.end(JSON.stringify({hits}));return}hits+=1;s.writeHead(204);s.end()});server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));"], { stdio: ["ignore", "pipe", "pipe"] }), port = await new Promise((resolvePort, reject) => {
    let output = "", timer = setTimeout(() => reject(new Error("network canary startup timed out")), 5e3);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      let line = output.split(`
`)[0];
      /^\d+$/.test(line) && (clearTimeout(timer), resolvePort(Number(line)));
    }), child.once("error", (error) => {
      clearTimeout(timer), reject(error);
    }), child.once("exit", (code) => {
      /^\d+\n/.test(output) || (clearTimeout(timer), reject(new Error(`network canary exited ${code}`)));
    });
  });
  return {
    url: `http://127.0.0.1:${port}/capability-canary`,
    async hits() {
      return (await (await fetch(`http://127.0.0.1:${port}/status`)).json()).hits;
    },
    stop: () => child.kill("SIGTERM")
  };
}
async function mcpSmoke(pluginRoot) {
  let entrypoint = join(pluginRoot, "dist", "workflow-mcp.mjs"), transport = new StdioClientTransport({ command: process.execPath, args: [entrypoint], cwd: pluginRoot, env: { ...process.env, CURSOR_PLUGIN_ROOT: pluginRoot }, stderr: "pipe" }), client = new Client({ name: "workflow-capability-spike", version: "1.0.0" });
  try {
    await client.connect(transport);
    let tools = (await client.listTools()).tools.map((tool) => tool.name).sort(), expected = [...WORKFLOW_TOOL_NAMES];
    return { verified: JSON.stringify(tools) === JSON.stringify(expected), tools };
  } catch (error) {
    return { verified: !1, error: error.message };
  } finally {
    await client.close().catch(() => {
    });
  }
}
function stateAndWorktreeSmoke() {
  let repo = join(temporary, "repo"), init = spawnSync("git", ["init", repo], { encoding: "utf8" });
  if (init.status !== 0) throw new Error(init.stderr.trim());
  writeFileSync(join(repo, "README.md"), `capability spike
`), git(repo, ["add", "README.md"]), git(repo, ["-c", "user.name=Workflow Spike", "-c", "user.email=spike@local.invalid", "commit", "-m", "baseline"]);
  let stateRoot = join(temporary, "state"), store = new RunStore(stateRoot), preparationStore = new PreparationStore(stateRoot), preparation = preparationStore.create({ status: "planning", source_kind: "goal", requested_profile: "supervised", expires_at: new Date(Date.now() + 6e4).toISOString() });
  preparation = preparationStore.update(preparation.preparation_id, preparation.revision, "spike-preparation", (draft) => ({ ...draft, status: "interrupted", runner_pid: null }), "spike-preparation-interrupted");
  let run = store.create({ requested_profile: "supervised", lifecycle: "waiting-human" });
  run = store.update(run.run_id, run.revision, "spike-update", (draft) => ({ ...draft, lifecycle: "paused" }), "spike-paused");
  let reopened = new RunStore(stateRoot).get(run.run_id), worktree = createRunWorktree(repo, run.run_id, { root: join(temporary, "worktrees") }), reopenedPreparation = new PreparationStore(stateRoot).get(preparation.preparation_id);
  return { verified: reopened.lifecycle === "paused" && reopenedPreparation.status === "interrupted" && worktree.baseline.status === "", revision: reopened.revision, preparation_revision: reopenedPreparation.revision, branch: worktree.branch };
}
function workerRuntimeSmoke(pluginRoot) {
  let result = spawnSync(process.execPath, [join(pluginRoot, "dist", "workflow-worker.mjs")], {
    cwd: pluginRoot,
    input: `{}
`,
    encoding: "utf8",
    env: { ...process.env, CURSOR_API_KEY: "" }
  }), dependencyMissing = /ERR_MODULE_NOT_FOUND|Cannot find package/.test(result.stderr);
  return {
    verified: result.stdout.includes("WORKFLOW_RESULT=") && !dependencyMissing,
    expected_fatal_without_job: !dependencyMissing,
    reason: dependencyMissing ? "pinned-sdk-runtime-missing" : void 0
  };
}
function isolatedWorkerSmoke() {
  let isolatedRoot = join(temporary, "isolated-plugin");
  return mkdirSync(join(isolatedRoot, "dist"), { recursive: !0 }), cpSync(join(root, "dist", "workflow-worker.mjs"), join(isolatedRoot, "dist", "workflow-worker.mjs")), workerRuntimeSmoke(isolatedRoot);
}
function provisionedWorkerRuntimeSmoke(pluginRoot) {
  let pluginHash = hashPluginTree(pluginRoot), runtimeDirectory = workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion }), runtime = loadWorkerRuntimeManifest(runtimeDirectory, {
    plugin_version: PLUGIN_VERSION,
    plugin_hash: pluginHash,
    sdk_version: sdkVersion,
    platform: currentPlatform()
  });
  if (!runtime.valid) return { verified: !1, reason: runtime.reason, reasons: runtime.reasons ?? [] };
  let workerMatches = runtime.manifest.worker_hash === sha256File(join(pluginRoot, "dist", "workflow-worker.mjs"));
  return { verified: workerMatches, reason: workerMatches ? null : "marketplace-worker-hash-mismatch", manifest: runtime.manifest };
}
async function liveModelsSmoke(workspace) {
  if (!process.argv.includes("--live-models")) return { verified: !1, skipped: !0, reason: "requires --live-models" };
  if (!process.env.CURSOR_API_KEY) return { verified: !1, skipped: !0, reason: "CURSOR_API_KEY missing" };
  let config = loadWorkflowConfig(workspace);
  if (config.errors.length > 0) return { verified: !1, errors: config.errors };
  let profile = resolveRouteProfile(config, argument("route-profile") ?? "default");
  return new CursorWorkerAdapter({ runDirectory: join(temporary, "live-models"), pluginRoot: root }).validateProfile(profile);
}
async function paidReadOnlyAgentSmoke(workspace) {
  if (!paidExecutionAllowed) return skipped(paidExecutionBlocker);
  if (!process.argv.includes("--approve-sdk-cost")) return { verified: !1, skipped: !0, reason: "requires explicit --approve-sdk-cost" };
  if (!process.env.CURSOR_API_KEY) return { verified: !1, skipped: !0, reason: "CURSOR_API_KEY missing" };
  let config = loadWorkflowConfig(workspace);
  if (config.errors.length > 0) return { verified: !1, errors: config.errors };
  let profile = resolveRouteProfile(config, argument("route-profile") ?? "default"), runDirectory = join(temporary, "live-agent"), firstAdapter = new CursorWorkerAdapter({ runDirectory, pluginRoot: root }), validation = firstAdapter.validateProfile(profile);
  if (!validation.verified) return { verified: !1, errors: validation.errors };
  let before = repositoryBaseline(workspace), acceptedModel = validation.routes.explainer.model;
  assertPaidBudgetRemaining("read-only-create");
  let first = firstAdapter.runPhase({
    role: "explainer",
    route: validation.routes.explainer.selected_candidate,
    routePoolHash: validation.routes.explainer.pool_hash,
    selectionReason: validation.routes.explainer.selection_reason,
    acceptedModel,
    cwd: workspace,
    prompt: "Read package.json and return only its package name. Do not modify any file or perform any external effect."
  });
  recordPaidCost("read-only-create", first.receipt.cost_usd);
  let resumedAdapter = new CursorWorkerAdapter({ runDirectory, pluginRoot: root });
  assertPaidBudgetRemaining("read-only-resume");
  let second = resumedAdapter.runPhase({
    role: "explainer",
    route: validation.routes.explainer.selected_candidate,
    routePoolHash: validation.routes.explainer.pool_hash,
    selectionReason: validation.routes.explainer.selection_reason,
    acceptedModel,
    cwd: workspace,
    agentId: first.receipt.agent_id,
    prompt: "Return the same package name again. Do not modify any file or perform any external effect."
  });
  recordPaidCost("read-only-resume", second.receipt.cost_usd);
  let after = repositoryBaseline(workspace);
  return {
    verified: first.response.ok && second.response.ok && first.receipt.model_attested && second.receipt.model_attested && before.head === after.head && before.status === after.status,
    first_receipt: first.receipt,
    resumed_receipt: second.receipt,
    repository_unchanged: before.head === after.head && before.status === after.status
  };
}
async function paidPlanningAgentSmoke(workspace) {
  if (!paidExecutionAllowed) return skipped(paidExecutionBlocker);
  if (!process.argv.includes("--approve-sdk-cost")) return { verified: !1, skipped: !0, reason: "requires explicit --approve-sdk-cost" };
  if (!process.env.CURSOR_API_KEY) return { verified: !1, skipped: !0, reason: "CURSOR_API_KEY missing" };
  let config = loadWorkflowConfig(workspace);
  if (config.errors.length > 0) return { verified: !1, errors: config.errors };
  let profile = resolveRouteProfile(config, argument("route-profile") ?? "default"), runDirectory = join(temporary, "live-planner"), adapter = new CursorWorkerAdapter({ runDirectory, pluginRoot: root }), validation = adapter.validateProfile(profile);
  if (!validation.verified) return { verified: !1, errors: validation.errors };
  let rootPlan = readFileSync(join(root, "tests", "fixtures", "artifacts", "work-plan.valid.md"), "utf8"), routeHash = createHash("sha256").update(JSON.stringify(profile)).digest("hex"), harnessHash = createHash("sha256").update("capability-spike-create-plan-capture-v1").digest("hex"), before = repositoryBaseline(workspace);
  assertPaidBudgetRemaining("planner-create-plan");
  let first = adapter.runPlanningPhase({
    route: validation.routes.planner.selected_candidate,
    routePoolHash: validation.routes.planner.pool_hash,
    selectionReason: validation.routes.planner.selection_reason,
    acceptedModel: validation.routes.planner.model,
    cwd: workspace,
    configurationHash: routeHash,
    harnessHash,
    deniedReadPaths: [join(workspace, ".git"), join(workspace, ".cursor", "workflow-policy.yaml")],
    prompt: `Read the repository without modifying it. Call CreatePlan exactly once with this exact complete plan and do not call report_intent_blockers.

${rootPlan}`
  });
  recordPaidCost("planner-create-plan", first.receipt.cost_usd), first.response.ok && assertPaidBudgetRemaining("planner-technical-resume");
  let second = first.response.ok ? adapter.runPlanningPhase({
    route: validation.routes.planner.selected_candidate,
    routePoolHash: validation.routes.planner.pool_hash,
    selectionReason: validation.routes.planner.selection_reason,
    acceptedModel: validation.routes.planner.model,
    cwd: workspace,
    agentId: first.receipt.agent_id,
    configurationHash: routeHash,
    harnessHash,
    deniedReadPaths: [join(workspace, ".git"), join(workspace, ".cursor", "workflow-policy.yaml")],
    prompt: `Technical capture retry: call CreatePlan exactly once again with this exact complete plan, preserve intent, and do not call report_intent_blockers.

${rootPlan}`
  }) : null;
  second && recordPaidCost("planner-technical-resume", second.receipt.cost_usd);
  let after = repositoryBaseline(workspace), unchanged = before.head === after.head && before.branch === after.branch && before.status === after.status;
  return {
    verified: first.response.ok && second?.response.ok && first.planningOutput?.kind === "root" && second.planningOutput?.kind === "root" && first.receipt.model_attested && second.receipt.model_attested && first.receipt.agent_id === second.receipt.agent_id && unchanged,
    first_receipt: first.receipt,
    resumed_receipt: second?.receipt ?? null,
    create_plan_captured: first.planningOutput?.kind === "root" && second?.planningOutput?.kind === "root",
    same_agent: first.receipt.agent_id === second?.receipt.agent_id,
    repository_unchanged: unchanged
  };
}
async function paidRemainingRouteSmokes(workspace) {
  if (!paidExecutionAllowed) return skipped(paidExecutionBlocker);
  if (!process.argv.includes("--approve-sdk-cost")) return skipped("requires explicit --approve-sdk-cost");
  if (!process.env.CURSOR_API_KEY) return skipped("CURSOR_API_KEY missing");
  let config = loadWorkflowConfig(workspace);
  if (config.errors.length > 0) return { verified: !1, errors: config.errors };
  let profile = resolveRouteProfile(config, argument("route-profile") ?? "default"), adapter = new CursorWorkerAdapter({ runDirectory: join(temporary, "remaining-routes"), pluginRoot: root }), validation = adapter.validateProfile(profile);
  if (!validation.verified) return { verified: !1, errors: validation.errors };
  let before = repositoryBaseline(workspace), repetitions = [];
  for (let role of ["investigator", "writer_escalated", "verifier", "reviewer"])
    for (let index = 0; index < 3; index += 1) {
      assertPaidBudgetRemaining(`${role}-attestation-${index}`);
      let phase = adapter.runPhase({
        role,
        route: validation.routes[role].selected_candidate,
        routePoolHash: validation.routes[role].pool_hash,
        selectionReason: validation.routes[role].selection_reason,
        acceptedModel: validation.routes[role].model,
        cwd: workspace,
        prompt: "Read package.json and return only its package name. Do not modify any file or perform any external effect."
      });
      recordPaidCost(`${role}-attestation-${index}`, phase.receipt.cost_usd), repetitions.push({ role, phase });
    }
  let after = repositoryBaseline(workspace);
  return {
    verified: repetitions.length === 12 && repetitions.every((item) => item.phase.response.ok && item.phase.receipt.model_attested) && before.head === after.head && before.status === after.status,
    repetitions,
    repository_unchanged: before.head === after.head && before.status === after.status
  };
}
async function paidBoundarySmokes(workspace) {
  if (!paidExecutionAllowed) return skipped(paidExecutionBlocker);
  if (!process.argv.includes("--approve-sdk-cost")) return skipped("requires explicit --approve-sdk-cost");
  if (!process.env.CURSOR_API_KEY) return skipped("CURSOR_API_KEY missing");
  let config = loadWorkflowConfig(workspace);
  if (config.errors.length > 0) return { verified: !1, errors: config.errors };
  let profile = resolveRouteProfile(config, argument("route-profile") ?? "default"), validation = new CursorWorkerAdapter({ runDirectory: join(temporary, "boundary-validation"), pluginRoot: root }).validateProfile(profile);
  if (!validation.verified) return { verified: !1, errors: validation.errors };
  let canary = await startNetworkCanary(), secret = `WORKFLOW_SECRET_CANARY_${createHash("sha256").update(String(Date.now())).digest("hex")}`, previousSecret = process.env.WORKFLOW_CAPABILITY_SECRET_CANARY;
  process.env.WORKFLOW_CAPABILITY_SECRET_CANARY = secret;
  let repetitions = [];
  try {
    for (let index = 0; index < 3; index += 1) {
      let probeRoot = join(temporary, `boundary-${index}`), allowed = join(probeRoot, "allowed"), protectedRoot = join(probeRoot, "protected"), foreignRoot = join(temporary, `foreign-${index}`);
      mkdirSync(allowed, { recursive: !0 }), mkdirSync(protectedRoot, { recursive: !0 }), mkdirSync(foreignRoot, { recursive: !0 });
      let adapter = new CursorWorkerAdapter({ runDirectory: join(probeRoot, "run"), pluginRoot: root });
      assertPaidBudgetRemaining(`boundary-probe-${index}`);
      let networkHitsBefore = await canary.hits(), response = adapter.runCapabilityProbe({
        route: validation.routes.writer.selected_candidate,
        acceptedModel: validation.routes.writer.model,
        cwd: probeRoot,
        writerWritablePaths: [allowed],
        writerDeniedPaths: [protectedRoot, foreignRoot],
        probe: {
          allowed_write_path: join(allowed, "canary.txt"),
          protected_write_path: join(protectedRoot, "canary.txt"),
          foreign_write_path: join(foreignRoot, "canary.txt"),
          network_canary_url: canary.url,
          secret_hash: hash(secret)
        }
      }), networkHitsAfter = await canary.hits();
      recordPaidCost(`boundary-probe-${index}`, estimateCost(response.usage, validation.routes.writer.selected_candidate.pricing_usd_per_million));
      let report = response.capability_probe, serialized = JSON.stringify(response);
      repetitions.push({
        response,
        role: "writer",
        accepted_model: validation.routes.writer.model,
        write_verified: response.ok === !0 && response.capability_write_attempt_observed === !0 && existsSync(join(allowed, "canary.txt")) && !existsSync(join(protectedRoot, "canary.txt")) && !existsSync(join(foreignRoot, "canary.txt")),
        network_verified: response.ok === !0 && response.capability_network_attempt_observed === !0 && networkHitsAfter === networkHitsBefore,
        network_hits_before: networkHitsBefore,
        network_hits_after: networkHitsAfter,
        secret_verified: response.ok === !0 && response.capability_secret_attempt_observed === !0 && report?.environment_secret_present === !1 && !serialized.includes(secret),
        model_verified: response.ok === !0 && JSON.stringify(response.observed_model) === JSON.stringify(validation.routes.writer.model)
      });
    }
  } finally {
    canary.stop(), previousSecret === void 0 ? delete process.env.WORKFLOW_CAPABILITY_SECRET_CANARY : process.env.WORKFLOW_CAPABILITY_SECRET_CANARY = previousSecret;
  }
  return {
    verified: repetitions.length === 3 && repetitions.every((item) => item.write_verified && item.network_verified && item.secret_verified && item.model_verified),
    repetitions,
    write_verified: repetitions.length === 3 && repetitions.every((item) => item.write_verified),
    network_verified: repetitions.length === 3 && repetitions.every((item) => item.network_verified),
    secret_verified: repetitions.length === 3 && repetitions.every((item) => item.secret_verified),
    model_verified: repetitions.length === 3 && repetitions.every((item) => item.model_verified)
  };
}
async function paidCancelSmokes(workspace) {
  if (!paidExecutionAllowed) return skipped(paidExecutionBlocker);
  if (!process.argv.includes("--approve-sdk-cost")) return skipped("requires explicit --approve-sdk-cost");
  if (!process.env.CURSOR_API_KEY) return skipped("CURSOR_API_KEY missing");
  let config = loadWorkflowConfig(workspace);
  if (config.errors.length > 0) return { verified: !1, errors: config.errors };
  let profile = resolveRouteProfile(config, argument("route-profile") ?? "default"), validation = new CursorWorkerAdapter({ runDirectory: join(temporary, "cancel-validation"), pluginRoot: root }).validateProfile(profile);
  if (!validation.verified) return { verified: !1, errors: validation.errors };
  let repetitions = [];
  for (let index = 0; index < 3; index += 1) {
    let runDirectory = join(temporary, `cancel-${index}`);
    mkdirSync(runDirectory, { recursive: !0 }), writeWorkerControl(runDirectory, "budget", { reason: "capability-probe" });
    let adapter = new CursorWorkerAdapter({ runDirectory, pluginRoot: root });
    assertPaidBudgetRemaining(`cancel-probe-${index}`);
    let phase = adapter.runPhase({
      role: "explainer",
      route: validation.routes.explainer.selected_candidate,
      routePoolHash: validation.routes.explainer.pool_hash,
      selectionReason: validation.routes.explainer.selection_reason,
      acceptedModel: validation.routes.explainer.model,
      cwd: workspace,
      prompt: "Inspect package.json and produce a detailed read-only explanation. Do not modify files or perform external effects.",
      timeoutMs: 6e4,
      cancelGraceMs: 5e3
    });
    recordPaidCost(`cancel-probe-${index}`, phase.receipt.cost_usd), repetitions.push(phase);
  }
  return {
    verified: repetitions.every((phase) => phase.response.status === "cancelled" && phase.receipt.cancel?.sdk_cancel_called === !0 && phase.receipt.cancel?.within_grace_period === !0),
    repetitions
  };
}
function dependencyAuditForReceipt() {
  if (!process.argv.includes("--issue-receipt")) return skipped("audit runs only for explicit --issue-receipt");
  let cache = join(temporary, "npm-cache"), result = spawnSync("npm", ["audit", "--omit=dev", "--json", "--cache", cache], { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }), report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    return { verified: !1, error: result.stderr.trim() || "npm audit returned invalid JSON" };
  }
  let vulnerabilities = report.metadata?.vulnerabilities ?? {}, riskAcceptance = argument("risk-acceptance");
  return {
    verified: (vulnerabilities.high ?? 0) === 0 && (vulnerabilities.critical ?? 0) === 0 && ((vulnerabilities.moderate ?? 0) === 0 || !!(riskAcceptance && existsSync(resolve(riskAcceptance)))),
    report,
    evidence_hash: hash(report),
    production_packages: report.metadata?.dependencies?.prod ?? 0,
    high: vulnerabilities.high ?? 0,
    critical: vulnerabilities.critical ?? 0,
    moderate: vulnerabilities.moderate ?? 0
  };
}
function verifiedExternalReport(path, label) {
  if (!path) return skipped(`no --${label}`);
  let absolute = resolve(path);
  if (!existsSync(absolute)) return { verified: !1, reason: `${label}-missing` };
  try {
    let report = JSON.parse(readFileSync(absolute, "utf8"));
    return { verified: report.verified === !0, report, evidence_hash: sha256File(absolute) };
  } catch (error) {
    return { verified: !1, reason: `${label}-invalid`, error: error.message };
  }
}
function verifiedCrashReport(path, pluginRoot) {
  let source = verifiedExternalReport(path, "crash-probe-report");
  if (!source.report) return source;
  let runtime = loadWorkerRuntimeManifest(workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion }), {
    plugin_version: PLUGIN_VERSION,
    plugin_hash: hashPluginTree(pluginRoot),
    sdk_version: sdkVersion,
    platform: currentPlatform()
  }), report = source.report, repetitions = Array.isArray(report.repetitions) ? report.repetitions : [], verified = source.verified === !0 && report.schema === 1 && report.generated_by === "geldmacher-workflow-sdk-crash-probe" && runtime.valid && report.plugin_hash === runtime.manifest.plugin_hash && report.worker_hash === runtime.manifest.worker_hash && report.runtime_hash === runtime.manifest.runtime_hash && repetitions.length === 3 && repetitions.every((item) => item.crash_state === "interrupted" && item.explicit_resume === !0 && item.initial_agent_id === item.resumed_agent_id && item.resumed_status === "finished" && item.model_attested === !0 && typeof item.request_id == "string" && typeof item.worker_run_id == "string" && /^[a-f0-9]{64}$/.test(item.store_hash));
  return { ...source, verified, repetitions: repetitions.length, reason: verified ? null : "crash-probe-contract-invalid" };
}
function verifiedCursorHarnessReport(path, pluginRoot, expectedCursorVersion) {
  let source = verifiedExternalReport(path, "cursor-harness-report");
  if (!source.report) return source;
  let runtime = loadWorkerRuntimeManifest(workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion }), {
    plugin_version: PLUGIN_VERSION,
    plugin_hash: hashPluginTree(pluginRoot),
    sdk_version: sdkVersion,
    platform: currentPlatform()
  }), report = source.report, requiredCases = ["clear-plan", "ambiguous-plan", "implement-plan", "fresh-review", "approved-correction", "repeat-review", "work-status", "explain-work", "learn-from-work", "schema-2-rejection", "mixed-chain-rejection", "cli", "editor"], cases = Array.isArray(report.cases) ? report.cases : [], verified = source.verified === !0 && report.schema === 1 && report.generated_by === "geldmacher-workflow-cursor-harness" && runtime.valid && report.plugin_hash === runtime.manifest.plugin_hash && report.marketplace_git_commit === runtime.manifest.marketplace_git_commit && report.cursor_version === expectedCursorVersion && requiredCases.every((id) => cases.some((item) => item.id === id && item.passed === !0 && /^[a-f0-9]{64}$/.test(item.evidence_hash))) && Array.isArray(report.artifact_ids) && report.artifact_ids.length > 0 && report.file_hashes && Object.keys(report.file_hashes).length > 0 && Object.values(report.file_hashes).every((value) => /^[a-f0-9]{64}$/.test(value)) && Array.isArray(report.model_usage) && report.model_usage.length > 0 && /^[a-f0-9]{64}$/.test(report.git_before_hash) && /^[a-f0-9]{64}$/.test(report.git_after_hash);
  return { ...source, verified, reason: verified ? null : "cursor-harness-contract-invalid" };
}
try {
  let workspace = resolve(argument("workspace") ?? root), marketplaceRootArgument = argument("marketplace-root"), marketplaceRoot = marketplaceRootArgument ? resolve(marketplaceRootArgument) : null, crashResume = verifiedCrashReport(argument("crash-probe-report"), marketplaceRoot ?? root), maxCost = Number(argument("max-cost-usd"));
  if (process.argv.includes("--approve-sdk-cost") && (!Number.isFinite(maxCost) || maxCost <= 0 || maxCost > 6)) throw new Error("--approve-sdk-cost requires --max-cost-usd greater than 0 and no more than 6 for the capability phase");
  let audit = dependencyAuditForReceipt();
  if (process.argv.includes("--issue-receipt") && audit.report && (audit.archive_path = archiveExternalEvidence(defaultStateRoot(workspace), "npm-audit.json", {
    lockfile_hash: sha256File(join(root, "npm-shrinkwrap.json")),
    report: audit.report
  })), process.argv.includes("--approve-sdk-cost") ? process.env.CURSOR_API_KEY ? process.argv.includes("--issue-receipt") && audit.verified !== !0 ? paidExecutionBlocker = "dependency audit gate failed before paid probes" : process.argv.includes("--issue-receipt") && !crashResume.verified ? paidExecutionBlocker = "valid three-run crash report required before paid receipt probes" : paidExecutionAllowed = !0 : paidExecutionBlocker = "CURSOR_API_KEY missing" : paidExecutionBlocker = "requires explicit --approve-sdk-cost", paidExecutionAllowed) {
    let priorCrashCost = process.argv.includes("--issue-receipt") && crashResume.verified ? crashResume.report.spent_usd : 0;
    if (!Number.isFinite(priorCrashCost) || priorCrashCost < 0 || priorCrashCost >= maxCost) throw new Error("crash-probe cost leaves no valid capability budget");
    paidCostLedger = { max_cost_usd: maxCost, spent_usd: priorCrashCost, entries: priorCrashCost > 0 ? [{ label: "prior-crash-probe", cost_usd: priorCrashCost }] : [] };
  }
  let paidAgentRuns = [], paidPlannerRuns = [];
  if (paidExecutionAllowed) {
    for (let index = 0; index < 3; index += 1) paidAgentRuns.push(await paidReadOnlyAgentSmoke(workspace));
    for (let index = 0; index < 3; index += 1) paidPlannerRuns.push(await paidPlanningAgentSmoke(workspace));
  }
  let paidAgent = paidAgentRuns.length === 3 ? { verified: paidAgentRuns.every((item) => item.verified), repetitions: paidAgentRuns } : skipped(paidExecutionBlocker), paidPlanner = paidPlannerRuns.length === 3 ? { verified: paidPlannerRuns.every((item) => item.verified), repetitions: paidPlannerRuns } : skipped(paidExecutionBlocker), remainingRoutes = await paidRemainingRouteSmokes(workspace), boundaries = await paidBoundarySmokes(workspace), cancellation = await paidCancelSmokes(workspace), cursorHarness = verifiedCursorHarnessReport(argument("cursor-harness-report"), marketplaceRoot ?? root, argument("cursor-version") ?? ""), workflowConfig = loadWorkflowConfig(workspace), verificationAudit = workflowConfig.errors.length === 0 && workflowConfig.project.verification_profile ? auditVerificationProfile(
    workspace,
    workflowConfig.project.verification_profile.manifest_path,
    root,
    defaultStateRoot(workspace)
  ) : { status: "blocked", errors: workflowConfig.errors.length > 0 ? workflowConfig.errors : ["verification profile is not configured"] }, costTracking = process.argv.includes("--approve-sdk-cost") ? paidCostLedger ? { verified: paidCostLedger.entries.length > 0, blocker: null, ...paidCostLedger } : { verified: !1, blocker: paidExecutionBlocker, spent_usd: 0, max_cost_usd: maxCost, entries: [] } : { verified: !0, spent_usd: 0, max_cost_usd: null, entries: [] }, observations = {
    schema: CAPABILITY_RECEIPT_SCHEMA,
    plugin_version: PLUGIN_VERSION,
    artifact_schema: 5,
    controller_protocol: 5,
    sdk_version: sdkVersion,
    platform: `${process.platform}-${process.arch}`,
    local_mcp: await mcpSmoke(root),
    marketplace_mcp: marketplaceRoot ? await mcpSmoke(marketplaceRoot) : skipped("no --marketplace-root"),
    local_worker_runtime: workerRuntimeSmoke(root),
    isolated_worker_runtime: isolatedWorkerSmoke(),
    marketplace_worker_runtime: marketplaceRoot ? provisionedWorkerRuntimeSmoke(marketplaceRoot) : skipped("no --marketplace-root"),
    outer_sandbox: probeSandboxBoundary(),
    state_worktree_restart: stateAndWorktreeSmoke(),
    model_catalog: await liveModelsSmoke(workspace),
    model_attestation: paidAgent,
    planner_submission: paidPlanner,
    remaining_route_attestation: remainingRoutes,
    boundary_probes: boundaries,
    cancel_probes: cancellation,
    crash_interrupt_resume: crashResume,
    cursor_harness: cursorHarness,
    verification_profile: verificationAudit,
    dependency_audit: audit,
    cost_tracking: costTracking,
    sdk_write_boundary_verified: boundaries.write_verified === !0,
    worker_network_isolated: boundaries.network_verified === !0,
    sdk_secret_isolated: boundaries.secret_verified === !0,
    sdk_budget_cancel_verified: cancellation.verified === !0,
    planner_submission_verified: paidPlanner.verified === !0,
    restart_resume_verified: paidAgent.verified === !0,
    crash_interrupt_resume_verified: crashResume.verified === !0 && crashResume.repetitions >= 3,
    model_configuration_exact_verified: boundaries.model_verified === !0 && paidAgent.verified === !0 && paidPlanner.verified === !0 && remainingRoutes.verified === !0,
    cursor_harness_verified: cursorHarness.verified === !0
  };
  if (observations.automation_safe = observations.local_mcp.verified && observations.marketplace_mcp.verified && observations.marketplace_worker_runtime.verified && observations.outer_sandbox.verified && observations.state_worktree_restart.verified && observations.model_catalog.verified && observations.sdk_write_boundary_verified && observations.worker_network_isolated && observations.sdk_secret_isolated && observations.sdk_budget_cancel_verified && observations.planner_submission_verified && observations.restart_resume_verified && observations.crash_interrupt_resume_verified && observations.model_configuration_exact_verified && observations.cursor_harness_verified && verificationAudit.status === "clean" && audit.verified === !0 && costTracking.verified === !0, process.argv.includes("--issue-receipt")) {
    let certifiedPluginRoot = marketplaceRoot ?? root, runtime = loadWorkerRuntimeManifest(workerRuntimeDirectory({ pluginVersion: PLUGIN_VERSION, sdkVersion }), {
      plugin_version: PLUGIN_VERSION,
      plugin_hash: hashPluginTree(certifiedPluginRoot),
      sdk_version: sdkVersion,
      platform: currentPlatform()
    }), planningHarness = loadPlanningHarness(certifiedPluginRoot), routeProfile = argument("route-profile") ?? "default", config = workflowConfig, route = config.errors.length === 0 ? resolveRouteProfile(config, routeProfile) : null, routeHash = route ? hash(route) : null, verificationProfileHash = verificationAudit.profile_hash ?? hash("verification-profile-unapproved"), requestedTaskClass = argument("task-class"), requestedRegion = argument("certified-region"), qualificationBindings = requestedTaskClass && requestedRegion && ["bugfix", "refactor", "performance", "feature", "investigation", "verify-existing"].includes(requestedTaskClass) && config.project.certified_regions.includes(requestedRegion) && verificationAudit.status === "clean" && routeHash ? [{ task_class: requestedTaskClass, verification_profile_hash: verificationProfileHash, route_pool_hash: routeHash, certified_region: requestedRegion }] : [], allPhaseReceipts = [
      ...paidAgentRuns.flatMap((item) => [item.first_receipt, item.resumed_receipt]),
      ...paidPlannerRuns.flatMap((item) => [item.first_receipt, item.resumed_receipt]),
      ...(remainingRoutes.repetitions ?? []).map((item) => item.phase.receipt),
      ...(boundaries.repetitions ?? []).map((item) => ({
        phase: item.role,
        accepted_model: item.accepted_model,
        observed_model: item.response?.observed_model,
        request_id: item.response?.request_id,
        agent_id: item.response?.agent_id,
        worker_run_id: item.response?.run_id
      }))
    ].filter(Boolean), canonicalModel = (role, model) => ({ role, id: model?.id ?? "", params: model?.params ?? [] }), requested = allPhaseReceipts.map((receipt2) => canonicalModel(receipt2.phase, receipt2.accepted_model)), accepted = allPhaseReceipts.map((receipt2) => canonicalModel(receipt2.phase, receipt2.accepted_model)), observed = allPhaseReceipts.map((receipt2) => canonicalModel(receipt2.phase, receipt2.observed_model)), certifiedModels = [...new Map(accepted.map((model) => [`${model.role}:${model.id}:${JSON.stringify(model.params)}`, model])).values()], receiptObservations = {
      local_mcp: observation(observations.local_mcp),
      marketplace_mcp: observation(observations.marketplace_mcp),
      marketplace_worker_runtime: observation(observations.marketplace_worker_runtime),
      sdk_write_boundary: observation({ verified: observations.sdk_write_boundary_verified, evidence: boundaries }, 3),
      worker_network_isolated: observation({ verified: observations.worker_network_isolated, evidence: boundaries }, 3),
      sdk_secret_isolated: observation({ verified: observations.sdk_secret_isolated, evidence: boundaries }, 3),
      sdk_budget_cancel: observation(cancellation, 3),
      restart_resume: observation(paidAgent, 3),
      crash_interrupt_resume: observation(crashResume, crashResume.repetitions ?? 0),
      planner_submission: observation(paidPlanner, 3),
      model_configuration_exact: observation({ verified: observations.model_configuration_exact_verified, evidence: { boundaries, paidAgent, paidPlanner, remainingRoutes } }, 3),
      cursor_harness: observation(cursorHarness)
    }, issuedAt = /* @__PURE__ */ new Date(), receipt = {
      schema: CAPABILITY_RECEIPT_SCHEMA,
      generated_by: "geldmacher-workflow-capability-spike",
      issued_at: issuedAt.toISOString(),
      expires_at: new Date(issuedAt.getTime() + 720 * 60 * 60 * 1e3).toISOString(),
      plugin_version: PLUGIN_VERSION,
      artifact_schema: 5,
      controller_protocol: 5,
      sdk_version: sdkVersion,
      platform: currentPlatform(),
      node_version: process.version,
      os_version: `${osPlatform()}-${osRelease()}`,
      cursor_version: argument("cursor-version") ?? "",
      marketplace_git_commit: runtime.manifest?.marketplace_git_commit ?? argument("marketplace-git-commit") ?? "",
      plugin_hash: hashPluginTree(certifiedPluginRoot),
      worker_hash: runtime.manifest?.worker_hash ?? "",
      runtime_hash: runtime.manifest?.runtime_hash ?? "",
      lockfile_hash: runtime.manifest?.lockfile_hash ?? sha256File(join(certifiedPluginRoot, "npm-shrinkwrap.json")),
      attested_route_pool_hash: routeHash ?? hash("route-pool-unavailable"),
      model_catalog_hash: observations.model_catalog.catalog_hash ?? "",
      planning_harness_hash: planningHarness.hash,
      cursor_harness_hash: cursorHarness.evidence_hash ?? "",
      verification_profile_hash: verificationProfileHash,
      model_attestation: {
        requested,
        accepted,
        observed,
        request_ids: allPhaseReceipts.map((item) => item.request_id).filter(Boolean),
        agent_ids: allPhaseReceipts.map((item) => item.agent_id).filter(Boolean),
        run_ids: allPhaseReceipts.map((item) => item.worker_run_id).filter(Boolean)
      },
      certified_models: certifiedModels,
      audit: {
        lockfile_hash: runtime.manifest?.lockfile_hash ?? sha256File(join(certifiedPluginRoot, "npm-shrinkwrap.json")),
        evidence_hash: audit.evidence_hash ?? "",
        production_packages: audit.production_packages ?? 0,
        high: audit.high ?? 1,
        critical: audit.critical ?? 1,
        moderate: audit.moderate ?? 0,
        risk_acceptance_hash: argument("risk-acceptance") ? sha256File(resolve(argument("risk-acceptance"))) : null
      },
      observations: receiptObservations,
      capability_vector: {
        write_boundary: observations.sdk_write_boundary_verified,
        network_isolation: observations.worker_network_isolated,
        secret_isolation: observations.sdk_secret_isolated,
        budget_cancel: observations.sdk_budget_cancel_verified,
        planning: observations.planner_submission_verified,
        verification_profile: verificationAudit.status === "clean",
        route_pool: observations.model_configuration_exact_verified
      },
      qualification_bindings: qualificationBindings,
      profile_eligibility: { supervised: !1, autonomous: !1 },
      evidence_hashes: Object.fromEntries(REQUIRED_OBSERVATIONS.map((key) => [key, receiptObservations[key].evidence_hash])),
      automation_safe: !1
    };
    if (receipt.profile_eligibility = receiptProfileEligibility(receipt), receipt.automation_safe = receiptAutomationSafe(receipt), observations.receipt_candidate = receipt, !observations.automation_safe || !receipt.automation_safe)
      observations.receipt_issued = !1, observations.receipt_blocker = "capability-observations-or-dependency-gate-failed";
    else {
      let stateRoot = defaultStateRoot(workspace);
      observations.receipt_path = writeCapabilityReceipt(stateRoot, receipt, {
        plugin_hash: receipt.plugin_hash,
        worker_hash: receipt.worker_hash,
        runtime_hash: receipt.runtime_hash,
        lockfile_hash: receipt.lockfile_hash,
        attested_route_pool_hash: receipt.attested_route_pool_hash,
        planning_harness_hash: receipt.planning_harness_hash
      }), observations.receipt_issued = !0;
    }
  }
  console.log(JSON.stringify(observations, null, 2)), process.argv.includes("--require-automation-safe") && !observations.automation_safe && (process.exitCode = 1);
} finally {
  rmSync(temporary, { recursive: !0, force: !0 });
}
