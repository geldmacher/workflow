#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  require_dist
} from "./chunk-QOWQ6ETR.mjs";
import {
  __commonJS,
  __toESM
} from "./chunk-IQRLCJ3K.mjs";

// node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS({
  "node_modules/ajv/dist/compile/codegen/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
    var _CodeOrName = class {
    };
    exports._CodeOrName = _CodeOrName;
    exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var Name = class extends _CodeOrName {
      constructor(s) {
        super();
        if (!exports.IDENTIFIER.test(s))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return false;
      }
      get names() {
        return { [this.str]: 1 };
      }
    };
    exports.Name = Name;
    var _Code = class extends _CodeOrName {
      constructor(code) {
        super();
        this._items = typeof code === "string" ? [code] : code;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return false;
        const item = this._items[0];
        return item === "" || item === '""';
      }
      get str() {
        var _a;
        return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
      }
      get names() {
        var _a;
        return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => {
          if (c instanceof Name)
            names[c.str] = (names[c.str] || 0) + 1;
          return names;
        }, {});
      }
    };
    exports._Code = _Code;
    exports.nil = new _Code("");
    function _(strs, ...args) {
      const code = [strs[0]];
      let i = 0;
      while (i < args.length) {
        addCodeArg(code, args[i]);
        code.push(strs[++i]);
      }
      return new _Code(code);
    }
    exports._ = _;
    var plus = new _Code("+");
    function str(strs, ...args) {
      const expr = [safeStringify(strs[0])];
      let i = 0;
      while (i < args.length) {
        expr.push(plus);
        addCodeArg(expr, args[i]);
        expr.push(plus, safeStringify(strs[++i]));
      }
      optimize(expr);
      return new _Code(expr);
    }
    exports.str = str;
    function addCodeArg(code, arg) {
      if (arg instanceof _Code)
        code.push(...arg._items);
      else if (arg instanceof Name)
        code.push(arg);
      else
        code.push(interpolate(arg));
    }
    exports.addCodeArg = addCodeArg;
    function optimize(expr) {
      let i = 1;
      while (i < expr.length - 1) {
        if (expr[i] === plus) {
          const res = mergeExprItems(expr[i - 1], expr[i + 1]);
          if (res !== void 0) {
            expr.splice(i - 1, 3, res);
            continue;
          }
          expr[i++] = "+";
        }
        i++;
      }
    }
    function mergeExprItems(a, b) {
      if (b === '""')
        return a;
      if (a === '""')
        return b;
      if (typeof a == "string") {
        if (b instanceof Name || a[a.length - 1] !== '"')
          return;
        if (typeof b != "string")
          return `${a.slice(0, -1)}${b}"`;
        if (b[0] === '"')
          return a.slice(0, -1) + b.slice(1);
        return;
      }
      if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
      return;
    }
    function strConcat(c1, c2) {
      return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
    }
    exports.strConcat = strConcat;
    function interpolate(x) {
      return typeof x == "number" || typeof x == "boolean" || x === null ? x : safeStringify(Array.isArray(x) ? x.join(",") : x);
    }
    function stringify(x) {
      return new _Code(safeStringify(x));
    }
    exports.stringify = stringify;
    function safeStringify(x) {
      return JSON.stringify(x).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    exports.safeStringify = safeStringify;
    function getProperty(key) {
      return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _`[${key}]`;
    }
    exports.getProperty = getProperty;
    function getEsmExportName(key) {
      if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
        return new _Code(`${key}`);
      }
      throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
    }
    exports.getEsmExportName = getEsmExportName;
    function regexpCode(rx) {
      return new _Code(rx.toString());
    }
    exports.regexpCode = regexpCode;
  }
});

// node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS({
  "node_modules/ajv/dist/compile/codegen/scope.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
    var code_1 = require_code();
    var ValueError = class extends Error {
      constructor(name) {
        super(`CodeGen: "code" for ${name} not defined`);
        this.value = name.value;
      }
    };
    var UsedValueState;
    (function(UsedValueState2) {
      UsedValueState2[UsedValueState2["Started"] = 0] = "Started";
      UsedValueState2[UsedValueState2["Completed"] = 1] = "Completed";
    })(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
    exports.varKinds = {
      const: new code_1.Name("const"),
      let: new code_1.Name("let"),
      var: new code_1.Name("var")
    };
    var Scope = class {
      constructor({ prefixes, parent } = {}) {
        this._names = {};
        this._prefixes = prefixes;
        this._parent = parent;
      }
      toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
      }
      name(prefix) {
        return new code_1.Name(this._newName(prefix));
      }
      _newName(prefix) {
        const ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
      }
      _nameGroup(prefix) {
        var _a, _b;
        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) {
          throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        }
        return this._names[prefix] = { prefix, index: 0 };
      }
    };
    exports.Scope = Scope;
    var ValueScopeName = class extends code_1.Name {
      constructor(prefix, nameStr) {
        super(nameStr);
        this.prefix = prefix;
      }
      setValue(value, { property, itemIndex }) {
        this.value = value;
        this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
      }
    };
    exports.ValueScopeName = ValueScopeName;
    var line = (0, code_1._)`\n`;
    var ValueScope = class extends Scope {
      constructor(opts) {
        super(opts);
        this._values = {};
        this._scope = opts.scope;
        this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
      }
      get() {
        return this._scope;
      }
      name(prefix) {
        return new ValueScopeName(prefix, this._newName(prefix));
      }
      value(nameOrPrefix, value) {
        var _a;
        if (value.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value");
        const name = this.toName(nameOrPrefix);
        const { prefix } = name;
        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
        let vs = this._values[prefix];
        if (vs) {
          const _name = vs.get(valueKey);
          if (_name)
            return _name;
        } else {
          vs = this._values[prefix] = /* @__PURE__ */ new Map();
        }
        vs.set(valueKey, name);
        const s = this._scope[prefix] || (this._scope[prefix] = []);
        const itemIndex = s.length;
        s[itemIndex] = value.ref;
        name.setValue(value, { property: prefix, itemIndex });
        return name;
      }
      getValue(prefix, keyOrRef) {
        const vs = this._values[prefix];
        if (!vs)
          return;
        return vs.get(keyOrRef);
      }
      scopeRefs(scopeName, values = this._values) {
        return this._reduceValues(values, (name) => {
          if (name.scopePath === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return (0, code_1._)`${scopeName}${name.scopePath}`;
        });
      }
      scopeCode(values = this._values, usedValues, getCode) {
        return this._reduceValues(values, (name) => {
          if (name.value === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return name.value.code;
        }, usedValues, getCode);
      }
      _reduceValues(values, valueCode, usedValues = {}, getCode) {
        let code = code_1.nil;
        for (const prefix in values) {
          const vs = values[prefix];
          if (!vs)
            continue;
          const nameSet = usedValues[prefix] = usedValues[prefix] || /* @__PURE__ */ new Map();
          vs.forEach((name) => {
            if (nameSet.has(name))
              return;
            nameSet.set(name, UsedValueState.Started);
            let c = valueCode(name);
            if (c) {
              const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
              code = (0, code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
            } else if (c = getCode === null || getCode === void 0 ? void 0 : getCode(name)) {
              code = (0, code_1._)`${code}${c}${this.opts._n}`;
            } else {
              throw new ValueError(name);
            }
            nameSet.set(name, UsedValueState.Completed);
          });
        }
        return code;
      }
    };
    exports.ValueScope = ValueScope;
  }
});

// node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS({
  "node_modules/ajv/dist/compile/codegen/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
    var code_1 = require_code();
    var scope_1 = require_scope();
    var code_2 = require_code();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return code_2._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return code_2.str;
    } });
    Object.defineProperty(exports, "strConcat", { enumerable: true, get: function() {
      return code_2.strConcat;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return code_2.nil;
    } });
    Object.defineProperty(exports, "getProperty", { enumerable: true, get: function() {
      return code_2.getProperty;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return code_2.stringify;
    } });
    Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function() {
      return code_2.regexpCode;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return code_2.Name;
    } });
    var scope_2 = require_scope();
    Object.defineProperty(exports, "Scope", { enumerable: true, get: function() {
      return scope_2.Scope;
    } });
    Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function() {
      return scope_2.ValueScope;
    } });
    Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function() {
      return scope_2.ValueScopeName;
    } });
    Object.defineProperty(exports, "varKinds", { enumerable: true, get: function() {
      return scope_2.varKinds;
    } });
    exports.operators = {
      GT: new code_1._Code(">"),
      GTE: new code_1._Code(">="),
      LT: new code_1._Code("<"),
      LTE: new code_1._Code("<="),
      EQ: new code_1._Code("==="),
      NEQ: new code_1._Code("!=="),
      NOT: new code_1._Code("!"),
      OR: new code_1._Code("||"),
      AND: new code_1._Code("&&"),
      ADD: new code_1._Code("+")
    };
    var Node = class {
      optimizeNodes() {
        return this;
      }
      optimizeNames(_names, _constants) {
        return this;
      }
    };
    var Def = class extends Node {
      constructor(varKind, name, rhs) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.rhs = rhs;
      }
      render({ es5, _n }) {
        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
        const rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (!names[this.name.str])
          return;
        if (this.rhs)
          this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
      }
    };
    var Assign = class extends Node {
      constructor(lhs, rhs, sideEffects) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
        this.sideEffects = sideEffects;
      }
      render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
          return;
        this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
      }
    };
    var AssignOp = class extends Assign {
      constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects);
        this.op = op;
      }
      render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
      }
    };
    var Label = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        return `${this.label}:` + _n;
      }
    };
    var Break = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        const label = this.label ? ` ${this.label}` : "";
        return `break${label};` + _n;
      }
    };
    var Throw = class extends Node {
      constructor(error) {
        super();
        this.error = error;
      }
      render({ _n }) {
        return `throw ${this.error};` + _n;
      }
      get names() {
        return this.error.names;
      }
    };
    var AnyCode = class extends Node {
      constructor(code) {
        super();
        this.code = code;
      }
      render({ _n }) {
        return `${this.code};` + _n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(names, constants) {
        this.code = optimizeExpr(this.code, names, constants);
        return this;
      }
      get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
      }
    };
    var ParentNode = class extends Node {
      constructor(nodes = []) {
        super();
        this.nodes = nodes;
      }
      render(opts) {
        return this.nodes.reduce((code, n) => code + n.render(opts), "");
      }
      optimizeNodes() {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i].optimizeNodes();
          if (Array.isArray(n))
            nodes.splice(i, 1, ...n);
          else if (n)
            nodes[i] = n;
          else
            nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      optimizeNames(names, constants) {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i];
          if (n.optimizeNames(names, constants))
            continue;
          subtractNames(names, n.names);
          nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
      }
    };
    var BlockNode = class extends ParentNode {
      render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
      }
    };
    var Root = class extends ParentNode {
    };
    var Else = class extends BlockNode {
    };
    Else.kind = "else";
    var If = class _If extends BlockNode {
      constructor(condition, nodes) {
        super(nodes);
        this.condition = condition;
      }
      render(opts) {
        let code = `if(${this.condition})` + super.render(opts);
        if (this.else)
          code += "else " + this.else.render(opts);
        return code;
      }
      optimizeNodes() {
        super.optimizeNodes();
        const cond = this.condition;
        if (cond === true)
          return this.nodes;
        let e = this.else;
        if (e) {
          const ns = e.optimizeNodes();
          e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e) {
          if (cond === false)
            return e instanceof _If ? e : e.nodes;
          if (this.nodes.length)
            return this;
          return new _If(not(cond), e instanceof _If ? [e] : e.nodes);
        }
        if (cond === false || !this.nodes.length)
          return void 0;
        return this;
      }
      optimizeNames(names, constants) {
        var _a;
        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        if (!(super.optimizeNames(names, constants) || this.else))
          return;
        this.condition = optimizeExpr(this.condition, names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        addExprNames(names, this.condition);
        if (this.else)
          addNames(names, this.else.names);
        return names;
      }
    };
    If.kind = "if";
    var For = class extends BlockNode {
    };
    For.kind = "for";
    var ForLoop = class extends For {
      constructor(iteration) {
        super();
        this.iteration = iteration;
      }
      render(opts) {
        return `for(${this.iteration})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iteration = optimizeExpr(this.iteration, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iteration.names);
      }
    };
    var ForRange = class extends For {
      constructor(varKind, name, from, to) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.from = from;
        this.to = to;
      }
      render(opts) {
        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
        const { name, from, to } = this;
        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
      }
      get names() {
        const names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
      }
    };
    var ForIter = class extends For {
      constructor(loop, varKind, name, iterable) {
        super();
        this.loop = loop;
        this.varKind = varKind;
        this.name = name;
        this.iterable = iterable;
      }
      render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iterable = optimizeExpr(this.iterable, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iterable.names);
      }
    };
    var Func = class extends BlockNode {
      constructor(name, args, async) {
        super();
        this.name = name;
        this.args = args;
        this.async = async;
      }
      render(opts) {
        const _async = this.async ? "async " : "";
        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
      }
    };
    Func.kind = "func";
    var Return = class extends ParentNode {
      render(opts) {
        return "return " + super.render(opts);
      }
    };
    Return.kind = "return";
    var Try = class extends BlockNode {
      render(opts) {
        let code = "try" + super.render(opts);
        if (this.catch)
          code += this.catch.render(opts);
        if (this.finally)
          code += this.finally.render(opts);
        return code;
      }
      optimizeNodes() {
        var _a, _b;
        super.optimizeNodes();
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
        return this;
      }
      optimizeNames(names, constants) {
        var _a, _b;
        super.optimizeNames(names, constants);
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        if (this.catch)
          addNames(names, this.catch.names);
        if (this.finally)
          addNames(names, this.finally.names);
        return names;
      }
    };
    var Catch = class extends BlockNode {
      constructor(error) {
        super();
        this.error = error;
      }
      render(opts) {
        return `catch(${this.error})` + super.render(opts);
      }
    };
    Catch.kind = "catch";
    var Finally = class extends BlockNode {
      render(opts) {
        return "finally" + super.render(opts);
      }
    };
    Finally.kind = "finally";
    var CodeGen = class {
      constructor(extScope, opts = {}) {
        this._values = {};
        this._blockStarts = [];
        this._constants = {};
        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
        this._extScope = extScope;
        this._scope = new scope_1.Scope({ parent: extScope });
        this._nodes = [new Root()];
      }
      toString() {
        return this._root.render(this.opts);
      }
      // returns unique name in the internal scope
      name(prefix) {
        return this._scope.name(prefix);
      }
      // reserves unique name in the external scope
      scopeName(prefix) {
        return this._extScope.name(prefix);
      }
      // reserves unique name in the external scope and assigns value to it
      scopeValue(prefixOrName, value) {
        const name = this._extScope.value(prefixOrName, value);
        const vs = this._values[name.prefix] || (this._values[name.prefix] = /* @__PURE__ */ new Set());
        vs.add(name);
        return name;
      }
      getScopeValue(prefix, keyOrRef) {
        return this._extScope.getValue(prefix, keyOrRef);
      }
      // return code that assigns values in the external scope to the names that are used internally
      // (same names that were returned by gen.scopeName or gen.scopeValue)
      scopeRefs(scopeName) {
        return this._extScope.scopeRefs(scopeName, this._values);
      }
      scopeCode() {
        return this._extScope.scopeCode(this._values);
      }
      _def(varKind, nameOrPrefix, rhs, constant) {
        const name = this._scope.toName(nameOrPrefix);
        if (rhs !== void 0 && constant)
          this._constants[name.str] = rhs;
        this._leafNode(new Def(varKind, name, rhs));
        return name;
      }
      // `const` declaration (`var` in es5 mode)
      const(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
      }
      // `let` declaration with optional assignment (`var` in es5 mode)
      let(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
      }
      // `var` declaration with optional assignment
      var(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
      }
      // assignment code
      assign(lhs, rhs, sideEffects) {
        return this._leafNode(new Assign(lhs, rhs, sideEffects));
      }
      // `+=` code
      add(lhs, rhs) {
        return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
      }
      // appends passed SafeExpr to code or executes Block
      code(c) {
        if (typeof c == "function")
          c();
        else if (c !== code_1.nil)
          this._leafNode(new AnyCode(c));
        return this;
      }
      // returns code for object literal for the passed argument list of key-value pairs
      object(...keyValues) {
        const code = ["{"];
        for (const [key, value] of keyValues) {
          if (code.length > 1)
            code.push(",");
          code.push(key);
          if (key !== value || this.opts.es5) {
            code.push(":");
            (0, code_1.addCodeArg)(code, value);
          }
        }
        code.push("}");
        return new code_1._Code(code);
      }
      // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
      if(condition, thenBody, elseBody) {
        this._blockNode(new If(condition));
        if (thenBody && elseBody) {
          this.code(thenBody).else().code(elseBody).endIf();
        } else if (thenBody) {
          this.code(thenBody).endIf();
        } else if (elseBody) {
          throw new Error('CodeGen: "else" body without "then" body');
        }
        return this;
      }
      // `else if` clause - invalid without `if` or after `else` clauses
      elseIf(condition) {
        return this._elseNode(new If(condition));
      }
      // `else` clause - only valid after `if` or `else if` clauses
      else() {
        return this._elseNode(new Else());
      }
      // end `if` statement (needed if gen.if was used only with condition)
      endIf() {
        return this._endBlockNode(If, Else);
      }
      _for(node, forBody) {
        this._blockNode(node);
        if (forBody)
          this.code(forBody).endFor();
        return this;
      }
      // a generic `for` clause (or statement if `forBody` is passed)
      for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
      }
      // `for` statement for a range of values
      forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
      }
      // `for-of` statement (in es5 mode replace with a normal for loop)
      forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        const name = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
          const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
          return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
            this.var(name, (0, code_1._)`${arr}[${i}]`);
            forBody(name);
          });
        }
        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
      }
      // `for-in` statement.
      // With option `ownProperties` replaced with a `for-of` loop for object keys
      forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties) {
          return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
        }
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
      }
      // end `for` loop
      endFor() {
        return this._endBlockNode(For);
      }
      // `label` statement
      label(label) {
        return this._leafNode(new Label(label));
      }
      // `break` statement
      break(label) {
        return this._leafNode(new Break(label));
      }
      // `return` statement
      return(value) {
        const node = new Return();
        this._blockNode(node);
        this.code(value);
        if (node.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
      }
      // `try` statement
      try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        const node = new Try();
        this._blockNode(node);
        this.code(tryBody);
        if (catchCode) {
          const error = this.name("e");
          this._currNode = node.catch = new Catch(error);
          catchCode(error);
        }
        if (finallyCode) {
          this._currNode = node.finally = new Finally();
          this.code(finallyCode);
        }
        return this._endBlockNode(Catch, Finally);
      }
      // `throw` statement
      throw(error) {
        return this._leafNode(new Throw(error));
      }
      // start self-balancing block
      block(body, nodeCount) {
        this._blockStarts.push(this._nodes.length);
        if (body)
          this.code(body).endBlock(nodeCount);
        return this;
      }
      // end the current self-balancing block
      endBlock(nodeCount) {
        const len = this._blockStarts.pop();
        if (len === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        const toClose = this._nodes.length - len;
        if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount) {
          throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        }
        this._nodes.length = len;
        return this;
      }
      // `function` heading (or definition if funcBody is passed)
      func(name, args = code_1.nil, async, funcBody) {
        this._blockNode(new Func(name, args, async));
        if (funcBody)
          this.code(funcBody).endFunc();
        return this;
      }
      // end function definition
      endFunc() {
        return this._endBlockNode(Func);
      }
      optimize(n = 1) {
        while (n-- > 0) {
          this._root.optimizeNodes();
          this._root.optimizeNames(this._root.names, this._constants);
        }
      }
      _leafNode(node) {
        this._currNode.nodes.push(node);
        return this;
      }
      _blockNode(node) {
        this._currNode.nodes.push(node);
        this._nodes.push(node);
      }
      _endBlockNode(N1, N2) {
        const n = this._currNode;
        if (n instanceof N1 || N2 && n instanceof N2) {
          this._nodes.pop();
          return this;
        }
        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
      }
      _elseNode(node) {
        const n = this._currNode;
        if (!(n instanceof If)) {
          throw new Error('CodeGen: "else" without "if"');
        }
        this._currNode = n.else = node;
        return this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        const ns = this._nodes;
        return ns[ns.length - 1];
      }
      set _currNode(node) {
        const ns = this._nodes;
        ns[ns.length - 1] = node;
      }
    };
    exports.CodeGen = CodeGen;
    function addNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) + (from[n] || 0);
      return names;
    }
    function addExprNames(names, from) {
      return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
    }
    function optimizeExpr(expr, names, constants) {
      if (expr instanceof code_1.Name)
        return replaceName(expr);
      if (!canOptimize(expr))
        return expr;
      return new code_1._Code(expr._items.reduce((items, c) => {
        if (c instanceof code_1.Name)
          c = replaceName(c);
        if (c instanceof code_1._Code)
          items.push(...c._items);
        else
          items.push(c);
        return items;
      }, []));
      function replaceName(n) {
        const c = constants[n.str];
        if (c === void 0 || names[n.str] !== 1)
          return n;
        delete names[n.str];
        return c;
      }
      function canOptimize(e) {
        return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== void 0);
      }
    }
    function subtractNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) - (from[n] || 0);
    }
    function not(x) {
      return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._)`!${par(x)}`;
    }
    exports.not = not;
    var andCode = mappend(exports.operators.AND);
    function and(...args) {
      return args.reduce(andCode);
    }
    exports.and = and;
    var orCode = mappend(exports.operators.OR);
    function or(...args) {
      return args.reduce(orCode);
    }
    exports.or = or;
    function mappend(op) {
      return (x, y) => x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._)`${par(x)} ${op} ${par(y)}`;
    }
    function par(x) {
      return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
    }
  }
});

// node_modules/ajv/dist/compile/util.js
var require_util = __commonJS({
  "node_modules/ajv/dist/compile/util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
    var codegen_1 = require_codegen();
    var code_1 = require_code();
    function toHash(arr) {
      const hash = {};
      for (const item of arr)
        hash[item] = true;
      return hash;
    }
    exports.toHash = toHash;
    function alwaysValidSchema(it, schema) {
      if (typeof schema == "boolean")
        return schema;
      if (Object.keys(schema).length === 0)
        return true;
      checkUnknownRules(it, schema);
      return !schemaHasRules(schema, it.self.RULES.all);
    }
    exports.alwaysValidSchema = alwaysValidSchema;
    function checkUnknownRules(it, schema = it.schema) {
      const { opts, self } = it;
      if (!opts.strictSchema)
        return;
      if (typeof schema === "boolean")
        return;
      const rules = self.RULES.keywords;
      for (const key in schema) {
        if (!rules[key])
          checkStrictMode(it, `unknown keyword: "${key}"`);
      }
    }
    exports.checkUnknownRules = checkUnknownRules;
    function schemaHasRules(schema, rules) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (rules[key])
          return true;
      return false;
    }
    exports.schemaHasRules = schemaHasRules;
    function schemaHasRulesButRef(schema, RULES) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (key !== "$ref" && RULES.all[key])
          return true;
      return false;
    }
    exports.schemaHasRulesButRef = schemaHasRulesButRef;
    function schemaRefOrVal({ topSchemaRef, schemaPath }, schema, keyword, $data) {
      if (!$data) {
        if (typeof schema == "number" || typeof schema == "boolean")
          return schema;
        if (typeof schema == "string")
          return (0, codegen_1._)`${schema}`;
      }
      return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
    }
    exports.schemaRefOrVal = schemaRefOrVal;
    function unescapeFragment(str) {
      return unescapeJsonPointer(decodeURIComponent(str));
    }
    exports.unescapeFragment = unescapeFragment;
    function escapeFragment(str) {
      return encodeURIComponent(escapeJsonPointer(str));
    }
    exports.escapeFragment = escapeFragment;
    function escapeJsonPointer(str) {
      if (typeof str == "number")
        return `${str}`;
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports.escapeJsonPointer = escapeJsonPointer;
    function unescapeJsonPointer(str) {
      return str.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports.unescapeJsonPointer = unescapeJsonPointer;
    function eachItem(xs, f) {
      if (Array.isArray(xs)) {
        for (const x of xs)
          f(x);
      } else {
        f(xs);
      }
    }
    exports.eachItem = eachItem;
    function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
      return (gen, from, to, toName) => {
        const res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
      };
    }
    exports.mergeEvaluated = {
      props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
          gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
          if (from === true) {
            gen.assign(to, true);
          } else {
            gen.assign(to, (0, codegen_1._)`${to} || {}`);
            setEvaluated(gen, to, from);
          }
        }),
        mergeValues: (from, to) => from === true ? true : { ...from, ...to },
        resultToName: evaluatedPropsToName
      }),
      items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => from === true ? true : Math.max(from, to),
        resultToName: (gen, items) => gen.var("items", items)
      })
    };
    function evaluatedPropsToName(gen, ps) {
      if (ps === true)
        return gen.var("props", true);
      const props = gen.var("props", (0, codegen_1._)`{}`);
      if (ps !== void 0)
        setEvaluated(gen, props, ps);
      return props;
    }
    exports.evaluatedPropsToName = evaluatedPropsToName;
    function setEvaluated(gen, props, ps) {
      Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
    }
    exports.setEvaluated = setEvaluated;
    var snippets = {};
    function useFunc(gen, f) {
      return gen.scopeValue("func", {
        ref: f,
        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
      });
    }
    exports.useFunc = useFunc;
    var Type;
    (function(Type2) {
      Type2[Type2["Num"] = 0] = "Num";
      Type2[Type2["Str"] = 1] = "Str";
    })(Type || (exports.Type = Type = {}));
    function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
      if (dataProp instanceof codegen_1.Name) {
        const isNumber = dataPropType === Type.Num;
        return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
      }
      return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
    }
    exports.getErrorPath = getErrorPath;
    function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
      if (!mode)
        return;
      msg = `strict mode: ${msg}`;
      if (mode === true)
        throw new Error(msg);
      it.self.logger.warn(msg);
    }
    exports.checkStrictMode = checkStrictMode;
  }
});

// node_modules/ajv/dist/compile/names.js
var require_names = __commonJS({
  "node_modules/ajv/dist/compile/names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var names = {
      // validation function arguments
      data: new codegen_1.Name("data"),
      // data passed to validation function
      // args passed from referencing schema
      valCxt: new codegen_1.Name("valCxt"),
      // validation/data context - should not be used directly, it is destructured to the names below
      instancePath: new codegen_1.Name("instancePath"),
      parentData: new codegen_1.Name("parentData"),
      parentDataProperty: new codegen_1.Name("parentDataProperty"),
      rootData: new codegen_1.Name("rootData"),
      // root data - same as the data passed to the first/top validation function
      dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
      // used to support recursiveRef and dynamicRef
      // function scoped variables
      vErrors: new codegen_1.Name("vErrors"),
      // null or array of validation errors
      errors: new codegen_1.Name("errors"),
      // counter of validation errors
      this: new codegen_1.Name("this"),
      // "globals"
      self: new codegen_1.Name("self"),
      scope: new codegen_1.Name("scope"),
      // JTD serialize/parse name for JSON string and position
      json: new codegen_1.Name("json"),
      jsonPos: new codegen_1.Name("jsonPos"),
      jsonLen: new codegen_1.Name("jsonLen"),
      jsonPart: new codegen_1.Name("jsonPart")
    };
    exports.default = names;
  }
});

// node_modules/ajv/dist/compile/errors.js
var require_errors = __commonJS({
  "node_modules/ajv/dist/compile/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    exports.keywordError = {
      message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
    };
    exports.keyword$DataError = {
      message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
    };
    function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : compositeRule || allErrors) {
        addError(gen, errObj);
      } else {
        returnErrors(it, (0, codegen_1._)`[${errObj}]`);
      }
    }
    exports.reportError = reportError;
    function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      addError(gen, errObj);
      if (!(compositeRule || allErrors)) {
        returnErrors(it, names_1.default.vErrors);
      }
    }
    exports.reportExtraError = reportExtraError;
    function resetErrorsCount(gen, errsCount) {
      gen.assign(names_1.default.errors, errsCount);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
    }
    exports.resetErrorsCount = resetErrorsCount;
    function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
      if (errsCount === void 0)
        throw new Error("ajv implementation error");
      const err = gen.name("err");
      gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
        gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
        gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`);
        if (it.opts.verbose) {
          gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
          gen.assign((0, codegen_1._)`${err}.data`, data);
        }
      });
    }
    exports.extendErrors = extendErrors;
    function addError(gen, errObj) {
      const err = gen.const("err", errObj);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
      gen.code((0, codegen_1._)`${names_1.default.errors}++`);
    }
    function returnErrors(it, errs) {
      const { gen, validateName, schemaEnv } = it;
      if (schemaEnv.$async) {
        gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
        gen.return(false);
      }
    }
    var E = {
      keyword: new codegen_1.Name("keyword"),
      schemaPath: new codegen_1.Name("schemaPath"),
      // also used in JTD errors
      params: new codegen_1.Name("params"),
      propertyName: new codegen_1.Name("propertyName"),
      message: new codegen_1.Name("message"),
      schema: new codegen_1.Name("schema"),
      parentSchema: new codegen_1.Name("parentSchema")
    };
    function errorObjectCode(cxt, error, errorPaths) {
      const { createErrors } = cxt.it;
      if (createErrors === false)
        return (0, codegen_1._)`{}`;
      return errorObject(cxt, error, errorPaths);
    }
    function errorObject(cxt, error, errorPaths = {}) {
      const { gen, it } = cxt;
      const keyValues = [
        errorInstancePath(it, errorPaths),
        errorSchemaPath(cxt, errorPaths)
      ];
      extraErrorProps(cxt, error, keyValues);
      return gen.object(...keyValues);
    }
    function errorInstancePath({ errorPath }, { instancePath }) {
      const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
      return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
    }
    function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
      let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
      if (schemaPath) {
        schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
      }
      return [E.schemaPath, schPath];
    }
    function extraErrorProps(cxt, { params, message }, keyValues) {
      const { keyword, data, schemaValue, it } = cxt;
      const { opts, propertyName, topSchemaRef, schemaPath } = it;
      keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
      if (opts.messages) {
        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
      }
      if (opts.verbose) {
        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
      }
      if (propertyName)
        keyValues.push([E.propertyName, propertyName]);
    }
  }
});

// node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS({
  "node_modules/ajv/dist/compile/validate/boolSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var boolError = {
      message: "boolean schema is false"
    };
    function topBoolOrEmptySchema(it) {
      const { gen, schema, validateName } = it;
      if (schema === false) {
        falseSchemaError(it, false);
      } else if (typeof schema == "object" && schema.$async === true) {
        gen.return(names_1.default.data);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, null);
        gen.return(true);
      }
    }
    exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
    function boolOrEmptySchema(it, valid) {
      const { gen, schema } = it;
      if (schema === false) {
        gen.var(valid, false);
        falseSchemaError(it);
      } else {
        gen.var(valid, true);
      }
    }
    exports.boolOrEmptySchema = boolOrEmptySchema;
    function falseSchemaError(it, overrideAllErrors) {
      const { gen, data } = it;
      const cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: false,
        schemaCode: false,
        schemaValue: false,
        params: {},
        it
      };
      (0, errors_1.reportError)(cxt, boolError, void 0, overrideAllErrors);
    }
  }
});

// node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS({
  "node_modules/ajv/dist/compile/rules.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getRules = exports.isJSONType = void 0;
    var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
    var jsonTypes = new Set(_jsonTypes);
    function isJSONType(x) {
      return typeof x == "string" && jsonTypes.has(x);
    }
    exports.isJSONType = isJSONType;
    function getRules() {
      const groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] }
      };
      return {
        types: { ...groups, integer: true, boolean: true, null: true },
        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
        post: { rules: [] },
        all: {},
        keywords: {}
      };
    }
    exports.getRules = getRules;
  }
});

// node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS({
  "node_modules/ajv/dist/compile/validate/applicability.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
    function schemaHasRulesForType({ schema, self }, type) {
      const group = self.RULES.types[type];
      return group && group !== true && shouldUseGroup(schema, group);
    }
    exports.schemaHasRulesForType = schemaHasRulesForType;
    function shouldUseGroup(schema, group) {
      return group.rules.some((rule) => shouldUseRule(schema, rule));
    }
    exports.shouldUseGroup = shouldUseGroup;
    function shouldUseRule(schema, rule) {
      var _a;
      return schema[rule.keyword] !== void 0 || ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema[kwd] !== void 0));
    }
    exports.shouldUseRule = shouldUseRule;
  }
});

// node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS({
  "node_modules/ajv/dist/compile/validate/dataType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
    var rules_1 = require_rules();
    var applicability_1 = require_applicability();
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var DataType;
    (function(DataType2) {
      DataType2[DataType2["Correct"] = 0] = "Correct";
      DataType2[DataType2["Wrong"] = 1] = "Wrong";
    })(DataType || (exports.DataType = DataType = {}));
    function getSchemaTypes(schema) {
      const types = getJSONTypes(schema.type);
      const hasNull = types.includes("null");
      if (hasNull) {
        if (schema.nullable === false)
          throw new Error("type: null contradicts nullable: false");
      } else {
        if (!types.length && schema.nullable !== void 0) {
          throw new Error('"nullable" cannot be used without "type"');
        }
        if (schema.nullable === true)
          types.push("null");
      }
      return types;
    }
    exports.getSchemaTypes = getSchemaTypes;
    function getJSONTypes(ts) {
      const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
      if (types.every(rules_1.isJSONType))
        return types;
      throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
    }
    exports.getJSONTypes = getJSONTypes;
    function coerceAndCheckDataType(it, types) {
      const { gen, data, opts } = it;
      const coerceTo = coerceToTypes(types, opts.coerceTypes);
      const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
      if (checkTypes) {
        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
          if (coerceTo.length)
            coerceData(it, types, coerceTo);
          else
            reportTypeError(it);
        });
      }
      return checkTypes;
    }
    exports.coerceAndCheckDataType = coerceAndCheckDataType;
    var COERCIBLE = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null"]);
    function coerceToTypes(types, coerceTypes) {
      return coerceTypes ? types.filter((t) => COERCIBLE.has(t) || coerceTypes === "array" && t === "array") : [];
    }
    function coerceData(it, types, coerceTo) {
      const { gen, data, opts } = it;
      const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
      const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
      if (opts.coerceTypes === "array") {
        gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
      }
      gen.if((0, codegen_1._)`${coerced} !== undefined`);
      for (const t of coerceTo) {
        if (COERCIBLE.has(t) || t === "array" && opts.coerceTypes === "array") {
          coerceSpecificType(t);
        }
      }
      gen.else();
      reportTypeError(it);
      gen.endIf();
      gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
        gen.assign(data, coerced);
        assignParentData(it, coerced);
      });
      function coerceSpecificType(t) {
        switch (t) {
          case "string":
            gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
            return;
          case "number":
            gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "integer":
            gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "boolean":
            gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
            return;
          case "null":
            gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
            gen.assign(coerced, null);
            return;
          case "array":
            gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
        }
      }
    }
    function assignParentData({ gen, parentData, parentDataProperty }, expr) {
      gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
    }
    function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
      const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
      let cond;
      switch (dataType) {
        case "null":
          return (0, codegen_1._)`${data} ${EQ} null`;
        case "array":
          cond = (0, codegen_1._)`Array.isArray(${data})`;
          break;
        case "object":
          cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
          break;
        case "integer":
          cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
          break;
        case "number":
          cond = numCond();
          break;
        default:
          return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
      }
      return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
      function numCond(_cond = codegen_1.nil) {
        return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
      }
    }
    exports.checkDataType = checkDataType;
    function checkDataTypes(dataTypes, data, strictNums, correct) {
      if (dataTypes.length === 1) {
        return checkDataType(dataTypes[0], data, strictNums, correct);
      }
      let cond;
      const types = (0, util_1.toHash)(dataTypes);
      if (types.array && types.object) {
        const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
        delete types.null;
        delete types.array;
        delete types.object;
      } else {
        cond = codegen_1.nil;
      }
      if (types.number)
        delete types.integer;
      for (const t in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
      return cond;
    }
    exports.checkDataTypes = checkDataTypes;
    var typeError = {
      message: ({ schema }) => `must be ${schema}`,
      params: ({ schema, schemaValue }) => typeof schema == "string" ? (0, codegen_1._)`{type: ${schema}}` : (0, codegen_1._)`{type: ${schemaValue}}`
    };
    function reportTypeError(it) {
      const cxt = getTypeErrorContext(it);
      (0, errors_1.reportError)(cxt, typeError);
    }
    exports.reportTypeError = reportTypeError;
    function getTypeErrorContext(it) {
      const { gen, data, schema } = it;
      const schemaCode = (0, util_1.schemaRefOrVal)(it, schema, "type");
      return {
        gen,
        keyword: "type",
        data,
        schema: schema.type,
        schemaCode,
        schemaValue: schemaCode,
        parentSchema: schema,
        params: {},
        it
      };
    }
  }
});

// node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS({
  "node_modules/ajv/dist/compile/validate/defaults.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assignDefaults = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function assignDefaults(it, ty) {
      const { properties, items } = it.schema;
      if (ty === "object" && properties) {
        for (const key in properties) {
          assignDefault(it, key, properties[key].default);
        }
      } else if (ty === "array" && Array.isArray(items)) {
        items.forEach((sch, i) => assignDefault(it, i, sch.default));
      }
    }
    exports.assignDefaults = assignDefaults;
    function assignDefault(it, prop, defaultValue) {
      const { gen, compositeRule, data, opts } = it;
      if (defaultValue === void 0)
        return;
      const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
      if (compositeRule) {
        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
        return;
      }
      let condition = (0, codegen_1._)`${childData} === undefined`;
      if (opts.useDefaults === "empty") {
        condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
      }
      gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
    }
  }
});

// node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var util_2 = require_util();
    function checkReportMissingProp(cxt, prop) {
      const { gen, data, it } = cxt;
      gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
        cxt.error();
      });
    }
    exports.checkReportMissingProp = checkReportMissingProp;
    function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
      return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
    }
    exports.checkMissingProp = checkMissingProp;
    function reportMissingProp(cxt, missing) {
      cxt.setParams({ missingProperty: missing }, true);
      cxt.error();
    }
    exports.reportMissingProp = reportMissingProp;
    function hasPropFunc(gen) {
      return gen.scopeValue("func", {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ref: Object.prototype.hasOwnProperty,
        code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
      });
    }
    exports.hasPropFunc = hasPropFunc;
    function isOwnProperty(gen, data, property) {
      return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
    }
    exports.isOwnProperty = isOwnProperty;
    function propertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
      return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
    }
    exports.propertyInData = propertyInData;
    function noPropertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
      return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
    }
    exports.noPropertyInData = noPropertyInData;
    function allSchemaProperties(schemaMap) {
      return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
    }
    exports.allSchemaProperties = allSchemaProperties;
    function schemaProperties(it, schemaMap) {
      return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
    }
    exports.schemaProperties = schemaProperties;
    function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
      const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
      const valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it.parentData],
        [names_1.default.parentDataProperty, it.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData]
      ];
      if (it.opts.dynamicRef)
        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
      const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
      return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
    }
    exports.callValidateCode = callValidateCode;
    var newRegExp = (0, codegen_1._)`new RegExp`;
    function usePattern({ gen, it: { opts } }, pattern) {
      const u = opts.unicodeRegExp ? "u" : "";
      const { regExp } = opts.code;
      const rx = regExp(pattern, u);
      return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
      });
    }
    exports.usePattern = usePattern;
    function validateArray(cxt) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      if (it.allErrors) {
        const validArr = gen.let("valid", true);
        validateItems(() => gen.assign(validArr, false));
        return validArr;
      }
      gen.var(valid, true);
      validateItems(() => gen.break());
      return valid;
      function validateItems(notValid) {
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword,
            dataProp: i,
            dataPropType: util_1.Type.Num
          }, valid);
          gen.if((0, codegen_1.not)(valid), notValid);
        });
      }
    }
    exports.validateArray = validateArray;
    function validateUnion(cxt) {
      const { gen, schema, keyword, it } = cxt;
      if (!Array.isArray(schema))
        throw new Error("ajv implementation error");
      const alwaysValid = schema.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
      if (alwaysValid && !it.opts.unevaluated)
        return;
      const valid = gen.let("valid", false);
      const schValid = gen.name("_valid");
      gen.block(() => schema.forEach((_sch, i) => {
        const schCxt = cxt.subschema({
          keyword,
          schemaProp: i,
          compositeRule: true
        }, schValid);
        gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
        if (!merged)
          gen.if((0, codegen_1.not)(valid));
      }));
      cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
    }
    exports.validateUnion = validateUnion;
  }
});

// node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS({
  "node_modules/ajv/dist/compile/validate/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var code_1 = require_code2();
    var errors_1 = require_errors();
    function macroKeywordCode(cxt, def) {
      const { gen, keyword, schema, parentSchema, it } = cxt;
      const macroSchema = def.macro.call(it.self, schema, parentSchema, it);
      const schemaRef = useKeyword(gen, keyword, macroSchema);
      if (it.opts.validateSchema !== false)
        it.self.validateSchema(macroSchema, true);
      const valid = gen.name("valid");
      cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: true
      }, valid);
      cxt.pass(valid, () => cxt.error(true));
    }
    exports.macroKeywordCode = macroKeywordCode;
    function funcKeywordCode(cxt, def) {
      var _a;
      const { gen, keyword, schema, parentSchema, $data, it } = cxt;
      checkAsyncKeyword(it, def);
      const validate = !$data && def.compile ? def.compile.call(it.self, schema, parentSchema, it) : def.validate;
      const validateRef = useKeyword(gen, keyword, validate);
      const valid = gen.let("valid");
      cxt.block$data(valid, validateKeyword);
      cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
      function validateKeyword() {
        if (def.errors === false) {
          assignValid();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => cxt.error());
        } else {
          const ruleErrs = def.async ? validateAsync() : validateSync();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => addErrs(cxt, ruleErrs));
        }
      }
      function validateAsync() {
        const ruleErrs = gen.let("ruleErrs", null);
        gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
        return ruleErrs;
      }
      function validateSync() {
        const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
        gen.assign(validateErrs, null);
        assignValid(codegen_1.nil);
        return validateErrs;
      }
      function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
        const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
        const passSchema = !("compile" in def && !$data || def.schema === false);
        gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
      }
      function reportErrs(errors) {
        var _a2;
        gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== void 0 ? _a2 : valid), errors);
      }
    }
    exports.funcKeywordCode = funcKeywordCode;
    function modifyData(cxt) {
      const { gen, data, it } = cxt;
      gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
    }
    function addErrs(cxt, errs) {
      const { gen } = cxt;
      gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
        (0, errors_1.extendErrors)(cxt);
      }, () => cxt.error());
    }
    function checkAsyncKeyword({ schemaEnv }, def) {
      if (def.async && !schemaEnv.$async)
        throw new Error("async keyword in sync schema");
    }
    function useKeyword(gen, keyword, result) {
      if (result === void 0)
        throw new Error(`keyword "${keyword}" failed to compile`);
      return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
    }
    function validSchemaType(schema, schemaType, allowUndefined = false) {
      return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema) : st === "object" ? schema && typeof schema == "object" && !Array.isArray(schema) : typeof schema == st || allowUndefined && typeof schema == "undefined");
    }
    exports.validSchemaType = validSchemaType;
    function validateKeywordUsage({ schema, opts, self, errSchemaPath }, def, keyword) {
      if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
        throw new Error("ajv implementation error");
      }
      const deps = def.dependencies;
      if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema, kwd))) {
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
      }
      if (def.validateSchema) {
        const valid = def.validateSchema(schema[keyword]);
        if (!valid) {
          const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self.errorsText(def.validateSchema.errors);
          if (opts.validateSchema === "log")
            self.logger.error(msg);
          else
            throw new Error(msg);
        }
      }
    }
    exports.validateKeywordUsage = validateKeywordUsage;
  }
});

// node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS({
  "node_modules/ajv/dist/compile/validate/subschema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function getSubschema(it, { keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }) {
      if (keyword !== void 0 && schema !== void 0) {
        throw new Error('both "keyword" and "schema" passed, only one allowed');
      }
      if (keyword !== void 0) {
        const sch = it.schema[keyword];
        return schemaProp === void 0 ? {
          schema: sch,
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}`
        } : {
          schema: sch[schemaProp],
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
        };
      }
      if (schema !== void 0) {
        if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0) {
          throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
        }
        return {
          schema,
          schemaPath,
          topSchemaRef,
          errSchemaPath
        };
      }
      throw new Error('either "keyword" or "schema" must be passed');
    }
    exports.getSubschema = getSubschema;
    function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
      if (data !== void 0 && dataProp !== void 0) {
        throw new Error('both "data" and "dataProp" passed, only one allowed');
      }
      const { gen } = it;
      if (dataProp !== void 0) {
        const { errorPath, dataPathArr, opts } = it;
        const nextData = gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
        dataContextProps(nextData);
        subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
        subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
      }
      if (data !== void 0) {
        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true);
        dataContextProps(nextData);
        if (propertyName !== void 0)
          subschema.propertyName = propertyName;
      }
      if (dataTypes)
        subschema.dataTypes = dataTypes;
      function dataContextProps(_nextData) {
        subschema.data = _nextData;
        subschema.dataLevel = it.dataLevel + 1;
        subschema.dataTypes = [];
        it.definedProperties = /* @__PURE__ */ new Set();
        subschema.parentData = it.data;
        subschema.dataNames = [...it.dataNames, _nextData];
      }
    }
    exports.extendSubschemaData = extendSubschemaData;
    function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
      if (compositeRule !== void 0)
        subschema.compositeRule = compositeRule;
      if (createErrors !== void 0)
        subschema.createErrors = createErrors;
      if (allErrors !== void 0)
        subschema.allErrors = allErrors;
      subschema.jtdDiscriminator = jtdDiscriminator;
      subschema.jtdMetadata = jtdMetadata;
    }
    exports.extendSubschemaMode = extendSubschemaMode;
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS({
  "node_modules/json-schema-traverse/index.js"(exports, module) {
    "use strict";
    var traverse = module.exports = function(schema, opts, cb) {
      if (typeof opts == "function") {
        cb = opts;
        opts = {};
      }
      cb = opts.cb || cb;
      var pre = typeof cb == "function" ? cb : cb.pre || function() {
      };
      var post = cb.post || function() {
      };
      _traverse(opts, pre, post, schema, "", schema);
    };
    traverse.keywords = {
      additionalItems: true,
      items: true,
      contains: true,
      additionalProperties: true,
      propertyNames: true,
      not: true,
      if: true,
      then: true,
      else: true
    };
    traverse.arrayKeywords = {
      items: true,
      allOf: true,
      anyOf: true,
      oneOf: true
    };
    traverse.propsKeywords = {
      $defs: true,
      definitions: true,
      properties: true,
      patternProperties: true,
      dependencies: true
    };
    traverse.skipKeywords = {
      default: true,
      enum: true,
      const: true,
      required: true,
      maximum: true,
      minimum: true,
      exclusiveMaximum: true,
      exclusiveMinimum: true,
      multipleOf: true,
      maxLength: true,
      minLength: true,
      pattern: true,
      format: true,
      maxItems: true,
      minItems: true,
      uniqueItems: true,
      maxProperties: true,
      minProperties: true
    };
    function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (schema && typeof schema == "object" && !Array.isArray(schema)) {
        pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        for (var key in schema) {
          var sch = schema[key];
          if (Array.isArray(sch)) {
            if (key in traverse.arrayKeywords) {
              for (var i = 0; i < sch.length; i++)
                _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema, i);
            }
          } else if (key in traverse.propsKeywords) {
            if (sch && typeof sch == "object") {
              for (var prop in sch)
                _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
            }
          } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
            _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema);
          }
        }
        post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      }
    }
    function escapeJsonPtr(str) {
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
  }
});

// node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS({
  "node_modules/ajv/dist/compile/resolve.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
    var util_1 = require_util();
    var equal = require_fast_deep_equal();
    var traverse = require_json_schema_traverse();
    var SIMPLE_INLINED = /* @__PURE__ */ new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const"
    ]);
    function inlineRef(schema, limit = true) {
      if (typeof schema == "boolean")
        return true;
      if (limit === true)
        return !hasRef(schema);
      if (!limit)
        return false;
      return countKeys(schema) <= limit;
    }
    exports.inlineRef = inlineRef;
    var REF_KEYWORDS = /* @__PURE__ */ new Set([
      "$ref",
      "$recursiveRef",
      "$recursiveAnchor",
      "$dynamicRef",
      "$dynamicAnchor"
    ]);
    function hasRef(schema) {
      for (const key in schema) {
        if (REF_KEYWORDS.has(key))
          return true;
        const sch = schema[key];
        if (Array.isArray(sch) && sch.some(hasRef))
          return true;
        if (typeof sch == "object" && hasRef(sch))
          return true;
      }
      return false;
    }
    function countKeys(schema) {
      let count = 0;
      for (const key in schema) {
        if (key === "$ref")
          return Infinity;
        count++;
        if (SIMPLE_INLINED.has(key))
          continue;
        if (typeof schema[key] == "object") {
          (0, util_1.eachItem)(schema[key], (sch) => count += countKeys(sch));
        }
        if (count === Infinity)
          return Infinity;
      }
      return count;
    }
    function getFullPath(resolver, id = "", normalize) {
      if (normalize !== false)
        id = normalizeId(id);
      const p = resolver.parse(id);
      return _getFullPath(resolver, p);
    }
    exports.getFullPath = getFullPath;
    function _getFullPath(resolver, p) {
      const serialized = resolver.serialize(p);
      return serialized.split("#")[0] + "#";
    }
    exports._getFullPath = _getFullPath;
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
      return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    exports.normalizeId = normalizeId;
    function resolveUrl(resolver, baseId, id) {
      id = normalizeId(id);
      return resolver.resolve(baseId, id);
    }
    exports.resolveUrl = resolveUrl;
    var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
    function getSchemaRefs(schema, baseId) {
      if (typeof schema == "boolean")
        return {};
      const { schemaId, uriResolver } = this.opts;
      const schId = normalizeId(schema[schemaId] || baseId);
      const baseIds = { "": schId };
      const pathPrefix = getFullPath(uriResolver, schId, false);
      const localRefs = {};
      const schemaRefs = /* @__PURE__ */ new Set();
      traverse(schema, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
        if (parentJsonPtr === void 0)
          return;
        const fullPath = pathPrefix + jsonPtr;
        let innerBaseId = baseIds[parentJsonPtr];
        if (typeof sch[schemaId] == "string")
          innerBaseId = addRef.call(this, sch[schemaId]);
        addAnchor.call(this, sch.$anchor);
        addAnchor.call(this, sch.$dynamicAnchor);
        baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
          const _resolve = this.opts.uriResolver.resolve;
          ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
          if (schemaRefs.has(ref))
            throw ambiguos(ref);
          schemaRefs.add(ref);
          let schOrRef = this.refs[ref];
          if (typeof schOrRef == "string")
            schOrRef = this.refs[schOrRef];
          if (typeof schOrRef == "object") {
            checkAmbiguosRef(sch, schOrRef.schema, ref);
          } else if (ref !== normalizeId(fullPath)) {
            if (ref[0] === "#") {
              checkAmbiguosRef(sch, localRefs[ref], ref);
              localRefs[ref] = sch;
            } else {
              this.refs[ref] = fullPath;
            }
          }
          return ref;
        }
        function addAnchor(anchor) {
          if (typeof anchor == "string") {
            if (!ANCHOR.test(anchor))
              throw new Error(`invalid anchor "${anchor}"`);
            addRef.call(this, `#${anchor}`);
          }
        }
      });
      return localRefs;
      function checkAmbiguosRef(sch1, sch2, ref) {
        if (sch2 !== void 0 && !equal(sch1, sch2))
          throw ambiguos(ref);
      }
      function ambiguos(ref) {
        return new Error(`reference "${ref}" resolves to more than one schema`);
      }
    }
    exports.getSchemaRefs = getSchemaRefs;
  }
});

// node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS({
  "node_modules/ajv/dist/compile/validate/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
    var boolSchema_1 = require_boolSchema();
    var dataType_1 = require_dataType();
    var applicability_1 = require_applicability();
    var dataType_2 = require_dataType();
    var defaults_1 = require_defaults();
    var keyword_1 = require_keyword();
    var subschema_1 = require_subschema();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var errors_1 = require_errors();
    function validateFunctionCode(it) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          topSchemaObjCode(it);
          return;
        }
      }
      validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
    }
    exports.validateFunctionCode = validateFunctionCode;
    function validateFunction({ gen, validateName, schema, schemaEnv, opts }, body) {
      if (opts.code.es5) {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
          gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema, opts)}`);
          destructureValCxtES5(gen, opts);
          gen.code(body);
        });
      } else {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema, opts)).code(body));
      }
    }
    function destructureValCxt(opts) {
      return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
    }
    function destructureValCxtES5(gen, opts) {
      gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
        gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
      }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.rootData, names_1.default.data);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
      });
    }
    function topSchemaObjCode(it) {
      const { schema, opts, gen } = it;
      validateFunction(it, () => {
        if (opts.$comment && schema.$comment)
          commentKeyword(it);
        checkNoDefault(it);
        gen.let(names_1.default.vErrors, null);
        gen.let(names_1.default.errors, 0);
        if (opts.unevaluated)
          resetEvaluated(it);
        typeAndKeywords(it);
        returnResults(it);
      });
      return;
    }
    function resetEvaluated(it) {
      const { gen, validateName } = it;
      it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`));
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
    }
    function funcSourceUrl(schema, opts) {
      const schId = typeof schema == "object" && schema[opts.schemaId];
      return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
    }
    function subschemaCode(it, valid) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          subSchemaObjCode(it, valid);
          return;
        }
      }
      (0, boolSchema_1.boolOrEmptySchema)(it, valid);
    }
    function schemaCxtHasRules({ schema, self }) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (self.RULES.all[key])
          return true;
      return false;
    }
    function isSchemaObj(it) {
      return typeof it.schema != "boolean";
    }
    function subSchemaObjCode(it, valid) {
      const { schema, gen, opts } = it;
      if (opts.$comment && schema.$comment)
        commentKeyword(it);
      updateContext(it);
      checkAsyncSchema(it);
      const errsCount = gen.const("_errs", names_1.default.errors);
      typeAndKeywords(it, errsCount);
      gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
    }
    function checkKeywords(it) {
      (0, util_1.checkUnknownRules)(it);
      checkRefsAndKeywords(it);
    }
    function typeAndKeywords(it, errsCount) {
      if (it.opts.jtd)
        return schemaKeywords(it, [], false, errsCount);
      const types = (0, dataType_1.getSchemaTypes)(it.schema);
      const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
      schemaKeywords(it, types, !checkedTypes, errsCount);
    }
    function checkRefsAndKeywords(it) {
      const { schema, errSchemaPath, opts, self } = it;
      if (schema.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema, self.RULES)) {
        self.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
      }
    }
    function checkNoDefault(it) {
      const { schema, opts } = it;
      if (schema.default !== void 0 && opts.useDefaults && opts.strictSchema) {
        (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
      }
    }
    function updateContext(it) {
      const schId = it.schema[it.opts.schemaId];
      if (schId)
        it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
    }
    function checkAsyncSchema(it) {
      if (it.schema.$async && !it.schemaEnv.$async)
        throw new Error("async schema in sync schema");
    }
    function commentKeyword({ gen, schemaEnv, schema, errSchemaPath, opts }) {
      const msg = schema.$comment;
      if (opts.$comment === true) {
        gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
      } else if (typeof opts.$comment == "function") {
        const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
      }
    }
    function returnResults(it) {
      const { gen, schemaEnv, validateName, ValidationError, opts } = it;
      if (schemaEnv.$async) {
        gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
        if (opts.unevaluated)
          assignEvaluated(it);
        gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
      }
    }
    function assignEvaluated({ gen, evaluated, props, items }) {
      if (props instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.props`, props);
      if (items instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.items`, items);
    }
    function schemaKeywords(it, types, typeErrors, errsCount) {
      const { gen, schema, data, allErrors, opts, self } = it;
      const { RULES } = self;
      if (schema.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema, RULES))) {
        gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition));
        return;
      }
      if (!opts.jtd)
        checkStrictTypes(it, types);
      gen.block(() => {
        for (const group of RULES.rules)
          groupKeywords(group);
        groupKeywords(RULES.post);
      });
      function groupKeywords(group) {
        if (!(0, applicability_1.shouldUseGroup)(schema, group))
          return;
        if (group.type) {
          gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
          iterateKeywords(it, group);
          if (types.length === 1 && types[0] === group.type && typeErrors) {
            gen.else();
            (0, dataType_2.reportTypeError)(it);
          }
          gen.endIf();
        } else {
          iterateKeywords(it, group);
        }
        if (!allErrors)
          gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
      }
    }
    function iterateKeywords(it, group) {
      const { gen, schema, opts: { useDefaults } } = it;
      if (useDefaults)
        (0, defaults_1.assignDefaults)(it, group.type);
      gen.block(() => {
        for (const rule of group.rules) {
          if ((0, applicability_1.shouldUseRule)(schema, rule)) {
            keywordCode(it, rule.keyword, rule.definition, group.type);
          }
        }
      });
    }
    function checkStrictTypes(it, types) {
      if (it.schemaEnv.meta || !it.opts.strictTypes)
        return;
      checkContextTypes(it, types);
      if (!it.opts.allowUnionTypes)
        checkMultipleTypes(it, types);
      checkKeywordTypes(it, it.dataTypes);
    }
    function checkContextTypes(it, types) {
      if (!types.length)
        return;
      if (!it.dataTypes.length) {
        it.dataTypes = types;
        return;
      }
      types.forEach((t) => {
        if (!includesType(it.dataTypes, t)) {
          strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
        }
      });
      narrowSchemaTypes(it, types);
    }
    function checkMultipleTypes(it, ts) {
      if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
        strictTypesError(it, "use allowUnionTypes to allow union type keyword");
      }
    }
    function checkKeywordTypes(it, ts) {
      const rules = it.self.RULES.all;
      for (const keyword in rules) {
        const rule = rules[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
          const { type } = rule.definition;
          if (type.length && !type.some((t) => hasApplicableType(ts, t))) {
            strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
          }
        }
      }
    }
    function hasApplicableType(schTs, kwdT) {
      return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
    }
    function includesType(ts, t) {
      return ts.includes(t) || t === "integer" && ts.includes("number");
    }
    function narrowSchemaTypes(it, withTypes) {
      const ts = [];
      for (const t of it.dataTypes) {
        if (includesType(withTypes, t))
          ts.push(t);
        else if (withTypes.includes("integer") && t === "number")
          ts.push("integer");
      }
      it.dataTypes = ts;
    }
    function strictTypesError(it, msg) {
      const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
      msg += ` at "${schemaPath}" (strictTypes)`;
      (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
    }
    var KeywordCxt = class {
      constructor(it, def, keyword) {
        (0, keyword_1.validateKeywordUsage)(it, def, keyword);
        this.gen = it.gen;
        this.allErrors = it.allErrors;
        this.keyword = keyword;
        this.data = it.data;
        this.schema = it.schema[keyword];
        this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
        this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
        this.schemaType = def.schemaType;
        this.parentSchema = it.schema;
        this.params = {};
        this.it = it;
        this.def = def;
        if (this.$data) {
          this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
        } else {
          this.schemaCode = this.schemaValue;
          if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
            throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
          }
        }
        if ("code" in def ? def.trackErrors : def.errors !== false) {
          this.errsCount = it.gen.const("_errs", names_1.default.errors);
        }
      }
      result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
      }
      failResult(condition, successAction, failAction) {
        this.gen.if(condition);
        if (failAction)
          failAction();
        else
          this.error();
        if (successAction) {
          this.gen.else();
          successAction();
          if (this.allErrors)
            this.gen.endIf();
        } else {
          if (this.allErrors)
            this.gen.endIf();
          else
            this.gen.else();
        }
      }
      pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), void 0, failAction);
      }
      fail(condition) {
        if (condition === void 0) {
          this.error();
          if (!this.allErrors)
            this.gen.if(false);
          return;
        }
        this.gen.if(condition);
        this.error();
        if (this.allErrors)
          this.gen.endIf();
        else
          this.gen.else();
      }
      fail$data(condition) {
        if (!this.$data)
          return this.fail(condition);
        const { schemaCode } = this;
        this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
      }
      error(append, errorParams, errorPaths) {
        if (errorParams) {
          this.setParams(errorParams);
          this._error(append, errorPaths);
          this.setParams({});
          return;
        }
        this._error(append, errorPaths);
      }
      _error(append, errorPaths) {
        ;
        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
      }
      $dataError() {
        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
      }
      reset() {
        if (this.errsCount === void 0)
          throw new Error('add "trackErrors" to keyword definition');
        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
      }
      ok(cond) {
        if (!this.allErrors)
          this.gen.if(cond);
      }
      setParams(obj, assign) {
        if (assign)
          Object.assign(this.params, obj);
        else
          this.params = obj;
      }
      block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
          this.check$data(valid, $dataValid);
          codeBlock();
        });
      }
      check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
          return;
        const { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
        if (valid !== codegen_1.nil)
          gen.assign(valid, true);
        if (schemaType.length || def.validateSchema) {
          gen.elseIf(this.invalid$data());
          this.$dataError();
          if (valid !== codegen_1.nil)
            gen.assign(valid, false);
        }
        gen.else();
      }
      invalid$data() {
        const { gen, schemaCode, schemaType, def, it } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
          if (schemaType.length) {
            if (!(schemaCode instanceof codegen_1.Name))
              throw new Error("ajv implementation error");
            const st = Array.isArray(schemaType) ? schemaType : [schemaType];
            return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
          }
          return codegen_1.nil;
        }
        function invalid$DataSchema() {
          if (def.validateSchema) {
            const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
            return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
          }
          return codegen_1.nil;
        }
      }
      subschema(appl, valid) {
        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
        (0, subschema_1.extendSubschemaMode)(subschema, appl);
        const nextContext = { ...this.it, ...subschema, items: void 0, props: void 0 };
        subschemaCode(nextContext, valid);
        return nextContext;
      }
      mergeEvaluated(schemaCxt, toName) {
        const { it, gen } = this;
        if (!it.opts.unevaluated)
          return;
        if (it.props !== true && schemaCxt.props !== void 0) {
          it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
        }
        if (it.items !== true && schemaCxt.items !== void 0) {
          it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
        }
      }
      mergeValidEvaluated(schemaCxt, valid) {
        const { it, gen } = this;
        if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
          gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
          return true;
        }
      }
    };
    exports.KeywordCxt = KeywordCxt;
    function keywordCode(it, keyword, def, ruleType) {
      const cxt = new KeywordCxt(it, def, keyword);
      if ("code" in def) {
        def.code(cxt, ruleType);
      } else if (cxt.$data && def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      } else if ("macro" in def) {
        (0, keyword_1.macroKeywordCode)(cxt, def);
      } else if (def.compile || def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      }
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
    var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, { dataLevel, dataNames, dataPathArr }) {
      let jsonPointer;
      let data;
      if ($data === "")
        return names_1.default.rootData;
      if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data;
        data = names_1.default.rootData;
      } else {
        const matches2 = RELATIVE_JSON_POINTER.exec($data);
        if (!matches2)
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        const up = +matches2[1];
        jsonPointer = matches2[2];
        if (jsonPointer === "#") {
          if (up >= dataLevel)
            throw new Error(errorMsg("property/index", up));
          return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
          throw new Error(errorMsg("data", up));
        data = dataNames[dataLevel - up];
        if (!jsonPointer)
          return data;
      }
      let expr = data;
      const segments = jsonPointer.split("/");
      for (const segment of segments) {
        if (segment) {
          data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
          expr = (0, codegen_1._)`${expr} && ${data}`;
        }
      }
      return expr;
      function errorMsg(pointerType, up) {
        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
      }
    }
    exports.getData = getData;
  }
});

// node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS({
  "node_modules/ajv/dist/runtime/validation_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ValidationError = class extends Error {
      constructor(errors) {
        super("validation failed");
        this.errors = errors;
        this.ajv = this.validation = true;
      }
    };
    exports.default = ValidationError;
  }
});

// node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS({
  "node_modules/ajv/dist/compile/ref_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var resolve_1 = require_resolve();
    var MissingRefError = class extends Error {
      constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
      }
    };
    exports.default = MissingRefError;
  }
});

// node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS({
  "node_modules/ajv/dist/compile/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
    var codegen_1 = require_codegen();
    var validation_error_1 = require_validation_error();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var validate_1 = require_validate();
    var SchemaEnv = class {
      constructor(env) {
        var _a;
        this.refs = {};
        this.dynamicAnchors = {};
        let schema;
        if (typeof env.schema == "object")
          schema = env.schema;
        this.schema = env.schema;
        this.schemaId = env.schemaId;
        this.root = env.root || this;
        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema === null || schema === void 0 ? void 0 : schema[env.schemaId || "$id"]);
        this.schemaPath = env.schemaPath;
        this.localRefs = env.localRefs;
        this.meta = env.meta;
        this.$async = schema === null || schema === void 0 ? void 0 : schema.$async;
        this.refs = {};
      }
    };
    exports.SchemaEnv = SchemaEnv;
    function compileSchema(sch) {
      const _sch = getCompilingSchema.call(this, sch);
      if (_sch)
        return _sch;
      const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
      const { es5, lines } = this.opts.code;
      const { ownProperties } = this.opts;
      const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
      let _ValidationError;
      if (sch.$async) {
        _ValidationError = gen.scopeValue("Error", {
          ref: validation_error_1.default,
          code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
        });
      }
      const validateName = gen.scopeName("validate");
      sch.validateName = validateName;
      const schemaCxt = {
        gen,
        allErrors: this.opts.allErrors,
        data: names_1.default.data,
        parentData: names_1.default.parentData,
        parentDataProperty: names_1.default.parentDataProperty,
        dataNames: [names_1.default.data],
        dataPathArr: [codegen_1.nil],
        // TODO can its length be used as dataLevel if nil is removed?
        dataLevel: 0,
        dataTypes: [],
        definedProperties: /* @__PURE__ */ new Set(),
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
        validateName,
        ValidationError: _ValidationError,
        schema: sch.schema,
        schemaEnv: sch,
        rootId,
        baseId: sch.baseId || rootId,
        schemaPath: codegen_1.nil,
        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, codegen_1._)`""`,
        opts: this.opts,
        self: this
      };
      let sourceCode;
      try {
        this._compilations.add(sch);
        (0, validate_1.validateFunctionCode)(schemaCxt);
        gen.optimize(this.opts.code.optimize);
        const validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
        if (this.opts.code.process)
          sourceCode = this.opts.code.process(sourceCode, sch);
        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
        const validate = makeValidate(this, this.scope.get());
        this.scope.value(validateName, { ref: validate });
        validate.errors = null;
        validate.schema = sch.schema;
        validate.schemaEnv = sch;
        if (sch.$async)
          validate.$async = true;
        if (this.opts.code.source === true) {
          validate.source = { validateName, validateCode, scopeValues: gen._values };
        }
        if (this.opts.unevaluated) {
          const { props, items } = schemaCxt;
          validate.evaluated = {
            props: props instanceof codegen_1.Name ? void 0 : props,
            items: items instanceof codegen_1.Name ? void 0 : items,
            dynamicProps: props instanceof codegen_1.Name,
            dynamicItems: items instanceof codegen_1.Name
          };
          if (validate.source)
            validate.source.evaluated = (0, codegen_1.stringify)(validate.evaluated);
        }
        sch.validate = validate;
        return sch;
      } catch (e) {
        delete sch.validate;
        delete sch.validateName;
        if (sourceCode)
          this.logger.error("Error compiling schema, function code:", sourceCode);
        throw e;
      } finally {
        this._compilations.delete(sch);
      }
    }
    exports.compileSchema = compileSchema;
    function resolveRef(root, baseId, ref) {
      var _a;
      ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
      const schOrFunc = root.refs[ref];
      if (schOrFunc)
        return schOrFunc;
      let _sch = resolve3.call(this, root, ref);
      if (_sch === void 0) {
        const schema = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref];
        const { schemaId } = this.opts;
        if (schema)
          _sch = new SchemaEnv({ schema, schemaId, root, baseId });
      }
      if (_sch === void 0)
        return;
      return root.refs[ref] = inlineOrCompile.call(this, _sch);
    }
    exports.resolveRef = resolveRef;
    function inlineOrCompile(sch) {
      if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
        return sch.schema;
      return sch.validate ? sch : compileSchema.call(this, sch);
    }
    function getCompilingSchema(schEnv) {
      for (const sch of this._compilations) {
        if (sameSchemaEnv(sch, schEnv))
          return sch;
      }
    }
    exports.getCompilingSchema = getCompilingSchema;
    function sameSchemaEnv(s1, s2) {
      return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
    }
    function resolve3(root, ref) {
      let sch;
      while (typeof (sch = this.refs[ref]) == "string")
        ref = sch;
      return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
    }
    function resolveSchema(root, ref) {
      const p = this.opts.uriResolver.parse(ref);
      const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
      let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
      if (Object.keys(root.schema).length > 0 && refPath === baseId) {
        return getJsonPointer.call(this, p, root);
      }
      const id = (0, resolve_1.normalizeId)(refPath);
      const schOrRef = this.refs[id] || this.schemas[id];
      if (typeof schOrRef == "string") {
        const sch = resolveSchema.call(this, root, schOrRef);
        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
          return;
        return getJsonPointer.call(this, p, sch);
      }
      if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
        return;
      if (!schOrRef.validate)
        compileSchema.call(this, schOrRef);
      if (id === (0, resolve_1.normalizeId)(ref)) {
        const { schema } = schOrRef;
        const { schemaId } = this.opts;
        const schId = schema[schemaId];
        if (schId)
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        return new SchemaEnv({ schema, schemaId, root, baseId });
      }
      return getJsonPointer.call(this, p, schOrRef);
    }
    exports.resolveSchema = resolveSchema;
    var PREVENT_SCOPE_CHANGE = /* @__PURE__ */ new Set([
      "properties",
      "patternProperties",
      "enum",
      "dependencies",
      "definitions"
    ]);
    function getJsonPointer(parsedRef, { baseId, schema, root }) {
      var _a;
      if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
        return;
      for (const part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema === "boolean")
          return;
        const partSchema = schema[(0, util_1.unescapeFragment)(part)];
        if (partSchema === void 0)
          return;
        schema = partSchema;
        const schId = typeof schema === "object" && schema[this.opts.schemaId];
        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        }
      }
      let env;
      if (typeof schema != "boolean" && schema.$ref && !(0, util_1.schemaHasRulesButRef)(schema, this.RULES)) {
        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema.$ref);
        env = resolveSchema.call(this, root, $ref);
      }
      const { schemaId } = this.opts;
      env = env || new SchemaEnv({ schema, schemaId, root, baseId });
      if (env.schema !== env.root.schema)
        return env;
      return void 0;
    }
  }
});

// node_modules/ajv/dist/refs/data.json
var require_data = __commonJS({
  "node_modules/ajv/dist/refs/data.json"(exports, module) {
    module.exports = {
      $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
      description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
      type: "object",
      required: ["$data"],
      properties: {
        $data: {
          type: "string",
          anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
        }
      },
      additionalProperties: false
    };
  }
});

// node_modules/fast-uri/lib/utils.js
var require_utils = __commonJS({
  "node_modules/fast-uri/lib/utils.js"(exports, module) {
    "use strict";
    var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
    var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
    var isHexPair = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu);
    var isUnreserved = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu);
    var isPathCharacter = RegExp.prototype.test.bind(/^[\da-z\-._~!$&'()*+,;=:@/]$/iu);
    function stringArrayToHexStripped(input) {
      let acc = "";
      let code = 0;
      let i = 0;
      for (i = 0; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (code === 48) {
          continue;
        }
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
        break;
      }
      for (i += 1; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
      }
      return acc;
    }
    var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
    function consumeIsZone(buffer) {
      buffer.length = 0;
      return true;
    }
    function consumeHextets(buffer, address, output) {
      if (buffer.length) {
        const hex = stringArrayToHexStripped(buffer);
        if (hex !== "") {
          address.push(hex);
        } else {
          output.error = true;
          return false;
        }
        buffer.length = 0;
      }
      return true;
    }
    function getIPV6(input) {
      let tokenCount = 0;
      const output = { error: false, address: "", zone: "" };
      const address = [];
      const buffer = [];
      let endipv6Encountered = false;
      let endIpv6 = false;
      let consume = consumeHextets;
      for (let i = 0; i < input.length; i++) {
        const cursor = input[i];
        if (cursor === "[" || cursor === "]") {
          continue;
        }
        if (cursor === ":") {
          if (endipv6Encountered === true) {
            endIpv6 = true;
          }
          if (!consume(buffer, address, output)) {
            break;
          }
          if (++tokenCount > 7) {
            output.error = true;
            break;
          }
          if (i > 0 && input[i - 1] === ":") {
            endipv6Encountered = true;
          }
          address.push(":");
          continue;
        } else if (cursor === "%") {
          if (!consume(buffer, address, output)) {
            break;
          }
          consume = consumeIsZone;
        } else {
          buffer.push(cursor);
          continue;
        }
      }
      if (buffer.length) {
        if (consume === consumeIsZone) {
          output.zone = buffer.join("");
        } else if (endIpv6) {
          address.push(buffer.join(""));
        } else {
          address.push(stringArrayToHexStripped(buffer));
        }
      }
      output.address = address.join("");
      return output;
    }
    function normalizeIPv6(host) {
      if (findToken(host, ":") < 2) {
        return { host, isIPV6: false };
      }
      const ipv6 = getIPV6(host);
      if (!ipv6.error) {
        let newHost = ipv6.address;
        let escapedHost = ipv6.address;
        if (ipv6.zone) {
          newHost += "%" + ipv6.zone;
          escapedHost += "%25" + ipv6.zone;
        }
        return { host: newHost, isIPV6: true, escapedHost };
      } else {
        return { host, isIPV6: false };
      }
    }
    function findToken(str, token) {
      let ind = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === token) ind++;
      }
      return ind;
    }
    function removeDotSegments(path) {
      let input = path;
      const output = [];
      let nextSlash = -1;
      let len = 0;
      while (len = input.length) {
        if (len === 1) {
          if (input === ".") {
            break;
          } else if (input === "/") {
            output.push("/");
            break;
          } else {
            output.push(input);
            break;
          }
        } else if (len === 2) {
          if (input[0] === ".") {
            if (input[1] === ".") {
              break;
            } else if (input[1] === "/") {
              input = input.slice(2);
              continue;
            }
          } else if (input[0] === "/") {
            if (input[1] === "." || input[1] === "/") {
              output.push("/");
              break;
            }
          }
        } else if (len === 3) {
          if (input === "/..") {
            if (output.length !== 0) {
              output.pop();
            }
            output.push("/");
            break;
          }
        }
        if (input[0] === ".") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(3);
              continue;
            }
          } else if (input[1] === "/") {
            input = input.slice(2);
            continue;
          }
        } else if (input[0] === "/") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(2);
              continue;
            } else if (input[2] === ".") {
              if (input[3] === "/") {
                input = input.slice(3);
                if (output.length !== 0) {
                  output.pop();
                }
                continue;
              }
            }
          }
        }
        if ((nextSlash = input.indexOf("/", 1)) === -1) {
          output.push(input);
          break;
        } else {
          output.push(input.slice(0, nextSlash));
          input = input.slice(nextSlash);
        }
      }
      return output.join("");
    }
    var HOST_DELIMS = { "@": "%40", "/": "%2F", "?": "%3F", "#": "%23", ":": "%3A" };
    var HOST_DELIM_RE = /[@/?#:]/g;
    var HOST_DELIM_NO_COLON_RE = /[@/?#]/g;
    function reescapeHostDelimiters(host, isIP) {
      const re = isIP ? HOST_DELIM_NO_COLON_RE : HOST_DELIM_RE;
      re.lastIndex = 0;
      return host.replace(re, (ch) => HOST_DELIMS[ch]);
    }
    function normalizePercentEncoding(input, decodeUnreserved = false) {
      if (input.indexOf("%") === -1) {
        return input;
      }
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decodeUnreserved && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        output += input[i];
      }
      return output;
    }
    function normalizePathEncoding(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decoded !== "." && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isPathCharacter(input[i])) {
          output += input[i];
        } else {
          output += escape(input[i]);
        }
      }
      return output;
    }
    function escapePreservingEscapes(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        output += escape(input[i]);
      }
      return output;
    }
    function recomposeAuthority(component) {
      const uriTokens = [];
      if (component.userinfo !== void 0) {
        uriTokens.push(component.userinfo);
        uriTokens.push("@");
      }
      if (component.host !== void 0) {
        let host = unescape(component.host);
        if (!isIPv4(host)) {
          const ipV6res = normalizeIPv6(host);
          if (ipV6res.isIPV6 === true) {
            host = `[${ipV6res.escapedHost}]`;
          } else {
            host = reescapeHostDelimiters(host, false);
          }
        }
        uriTokens.push(host);
      }
      if (typeof component.port === "number" || typeof component.port === "string") {
        uriTokens.push(":");
        uriTokens.push(String(component.port));
      }
      return uriTokens.length ? uriTokens.join("") : void 0;
    }
    module.exports = {
      nonSimpleDomain,
      recomposeAuthority,
      reescapeHostDelimiters,
      normalizePercentEncoding,
      normalizePathEncoding,
      escapePreservingEscapes,
      removeDotSegments,
      isIPv4,
      isUUID,
      normalizeIPv6,
      stringArrayToHexStripped
    };
  }
});

// node_modules/fast-uri/lib/schemes.js
var require_schemes = __commonJS({
  "node_modules/fast-uri/lib/schemes.js"(exports, module) {
    "use strict";
    var { isUUID } = require_utils();
    var URN_REG = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu;
    var supportedSchemeNames = (
      /** @type {const} */
      [
        "http",
        "https",
        "ws",
        "wss",
        "urn",
        "urn:uuid"
      ]
    );
    function isValidSchemeName(name) {
      return supportedSchemeNames.indexOf(
        /** @type {*} */
        name
      ) !== -1;
    }
    function wsIsSecure(wsComponent) {
      if (wsComponent.secure === true) {
        return true;
      } else if (wsComponent.secure === false) {
        return false;
      } else if (wsComponent.scheme) {
        return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
      } else {
        return false;
      }
    }
    function httpParse(component) {
      if (!component.host) {
        component.error = component.error || "HTTP URIs must have a host.";
      }
      return component;
    }
    function httpSerialize(component) {
      const secure = String(component.scheme).toLowerCase() === "https";
      if (component.port === (secure ? 443 : 80) || component.port === "") {
        component.port = void 0;
      }
      if (!component.path) {
        component.path = "/";
      }
      return component;
    }
    function wsParse(wsComponent) {
      wsComponent.secure = wsIsSecure(wsComponent);
      wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
      wsComponent.path = void 0;
      wsComponent.query = void 0;
      return wsComponent;
    }
    function wsSerialize(wsComponent) {
      if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") {
        wsComponent.port = void 0;
      }
      if (typeof wsComponent.secure === "boolean") {
        wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
        wsComponent.secure = void 0;
      }
      if (wsComponent.resourceName) {
        const [path, query] = wsComponent.resourceName.split("?");
        wsComponent.path = path && path !== "/" ? path : void 0;
        wsComponent.query = query;
        wsComponent.resourceName = void 0;
      }
      wsComponent.fragment = void 0;
      return wsComponent;
    }
    function urnParse(urnComponent, options) {
      if (!urnComponent.path) {
        urnComponent.error = "URN can not be parsed";
        return urnComponent;
      }
      const matches2 = urnComponent.path.match(URN_REG);
      if (matches2) {
        const scheme = options.scheme || urnComponent.scheme || "urn";
        urnComponent.nid = matches2[1].toLowerCase();
        urnComponent.nss = matches2[2];
        const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
        const schemeHandler = getSchemeHandler(urnScheme);
        urnComponent.path = void 0;
        if (schemeHandler) {
          urnComponent = schemeHandler.parse(urnComponent, options);
        }
      } else {
        urnComponent.error = urnComponent.error || "URN can not be parsed.";
      }
      return urnComponent;
    }
    function urnSerialize(urnComponent, options) {
      if (urnComponent.nid === void 0) {
        throw new Error("URN without nid cannot be serialized");
      }
      const scheme = options.scheme || urnComponent.scheme || "urn";
      const nid = urnComponent.nid.toLowerCase();
      const urnScheme = `${scheme}:${options.nid || nid}`;
      const schemeHandler = getSchemeHandler(urnScheme);
      if (schemeHandler) {
        urnComponent = schemeHandler.serialize(urnComponent, options);
      }
      const uriComponent = urnComponent;
      const nss = urnComponent.nss;
      uriComponent.path = `${nid || options.nid}:${nss}`;
      options.skipEscape = true;
      return uriComponent;
    }
    function urnuuidParse(urnComponent, options) {
      const uuidComponent = urnComponent;
      uuidComponent.uuid = uuidComponent.nss;
      uuidComponent.nss = void 0;
      if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
        uuidComponent.error = uuidComponent.error || "UUID is not valid.";
      }
      return uuidComponent;
    }
    function urnuuidSerialize(uuidComponent) {
      const urnComponent = uuidComponent;
      urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
      return urnComponent;
    }
    var http = (
      /** @type {SchemeHandler} */
      {
        scheme: "http",
        domainHost: true,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var https = (
      /** @type {SchemeHandler} */
      {
        scheme: "https",
        domainHost: http.domainHost,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var ws = (
      /** @type {SchemeHandler} */
      {
        scheme: "ws",
        domainHost: true,
        parse: wsParse,
        serialize: wsSerialize
      }
    );
    var wss = (
      /** @type {SchemeHandler} */
      {
        scheme: "wss",
        domainHost: ws.domainHost,
        parse: ws.parse,
        serialize: ws.serialize
      }
    );
    var urn = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn",
        parse: urnParse,
        serialize: urnSerialize,
        skipNormalize: true
      }
    );
    var urnuuid = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn:uuid",
        parse: urnuuidParse,
        serialize: urnuuidSerialize,
        skipNormalize: true
      }
    );
    var SCHEMES = (
      /** @type {Record<SchemeName, SchemeHandler>} */
      {
        http,
        https,
        ws,
        wss,
        urn,
        "urn:uuid": urnuuid
      }
    );
    Object.setPrototypeOf(SCHEMES, null);
    function getSchemeHandler(scheme) {
      return scheme && (SCHEMES[
        /** @type {SchemeName} */
        scheme
      ] || SCHEMES[
        /** @type {SchemeName} */
        scheme.toLowerCase()
      ]) || void 0;
    }
    module.exports = {
      wsIsSecure,
      SCHEMES,
      isValidSchemeName,
      getSchemeHandler
    };
  }
});

// node_modules/fast-uri/index.js
var require_fast_uri = __commonJS({
  "node_modules/fast-uri/index.js"(exports, module) {
    "use strict";
    var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizePercentEncoding, normalizePathEncoding, escapePreservingEscapes, reescapeHostDelimiters, isIPv4, nonSimpleDomain } = require_utils();
    var { SCHEMES, getSchemeHandler } = require_schemes();
    function normalize(uri, options) {
      if (typeof uri === "string") {
        uri = /** @type {T} */
        normalizeString(uri, options);
      } else if (typeof uri === "object") {
        uri = /** @type {T} */
        parse(serialize(uri, options), options);
      }
      return uri;
    }
    function resolve3(baseURI, relativeURI, options) {
      const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
      const resolved = resolveComponent(parse(baseURI, schemelessOptions), parse(relativeURI, schemelessOptions), schemelessOptions, true);
      schemelessOptions.skipEscape = true;
      return serialize(resolved, schemelessOptions);
    }
    function resolveComponent(base, relative, options, skipNormalization) {
      const target = {};
      if (!skipNormalization) {
        base = parse(serialize(base, options), options);
        relative = parse(serialize(relative, options), options);
      }
      options = options || {};
      if (!options.tolerant && relative.scheme) {
        target.scheme = relative.scheme;
        target.userinfo = relative.userinfo;
        target.host = relative.host;
        target.port = relative.port;
        target.path = removeDotSegments(relative.path || "");
        target.query = relative.query;
      } else {
        if (relative.userinfo !== void 0 || relative.host !== void 0 || relative.port !== void 0) {
          target.userinfo = relative.userinfo;
          target.host = relative.host;
          target.port = relative.port;
          target.path = removeDotSegments(relative.path || "");
          target.query = relative.query;
        } else {
          if (!relative.path) {
            target.path = base.path;
            if (relative.query !== void 0) {
              target.query = relative.query;
            } else {
              target.query = base.query;
            }
          } else {
            if (relative.path[0] === "/") {
              target.path = removeDotSegments(relative.path);
            } else {
              if ((base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0) && !base.path) {
                target.path = "/" + relative.path;
              } else if (!base.path) {
                target.path = relative.path;
              } else {
                target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative.path;
              }
              target.path = removeDotSegments(target.path);
            }
            target.query = relative.query;
          }
          target.userinfo = base.userinfo;
          target.host = base.host;
          target.port = base.port;
        }
        target.scheme = base.scheme;
      }
      target.fragment = relative.fragment;
      return target;
    }
    function equal(uriA, uriB, options) {
      const normalizedA = normalizeComparableURI(uriA, options);
      const normalizedB = normalizeComparableURI(uriB, options);
      return normalizedA !== void 0 && normalizedB !== void 0 && normalizedA.toLowerCase() === normalizedB.toLowerCase();
    }
    function serialize(cmpts, opts) {
      const component = {
        host: cmpts.host,
        scheme: cmpts.scheme,
        userinfo: cmpts.userinfo,
        port: cmpts.port,
        path: cmpts.path,
        query: cmpts.query,
        nid: cmpts.nid,
        nss: cmpts.nss,
        uuid: cmpts.uuid,
        fragment: cmpts.fragment,
        reference: cmpts.reference,
        resourceName: cmpts.resourceName,
        secure: cmpts.secure,
        error: ""
      };
      const options = Object.assign({}, opts);
      const uriTokens = [];
      const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
      if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(component, options);
      if (component.path !== void 0) {
        if (!options.skipEscape) {
          component.path = escapePreservingEscapes(component.path);
          if (component.scheme !== void 0) {
            component.path = component.path.split("%3A").join(":");
          }
        } else {
          component.path = normalizePercentEncoding(component.path);
        }
      }
      if (options.reference !== "suffix" && component.scheme) {
        uriTokens.push(component.scheme, ":");
      }
      const authority = recomposeAuthority(component);
      if (authority !== void 0) {
        if (options.reference !== "suffix") {
          uriTokens.push("//");
        }
        uriTokens.push(authority);
        if (component.path && component.path[0] !== "/") {
          uriTokens.push("/");
        }
      }
      if (component.path !== void 0) {
        let s = component.path;
        if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
          s = removeDotSegments(s);
        }
        if (authority === void 0 && s[0] === "/" && s[1] === "/") {
          s = "/%2F" + s.slice(2);
        }
        uriTokens.push(s);
      }
      if (component.query !== void 0) {
        uriTokens.push("?", component.query);
      }
      if (component.fragment !== void 0) {
        uriTokens.push("#", component.fragment);
      }
      return uriTokens.join("");
    }
    var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
    var AUTHORITY_PREFIX = /^(?:[^#/:?]+:)?\/\/([^/?#]*)/;
    function getParseError(parsed, matches2) {
      if (matches2[2] !== void 0 && parsed.path && parsed.path[0] !== "/") {
        return 'URI path must start with "/" when authority is present.';
      }
      if (typeof parsed.port === "number" && (parsed.port < 0 || parsed.port > 65535)) {
        return "URI port is malformed.";
      }
      return void 0;
    }
    function parseWithStatus(uri, opts) {
      const options = Object.assign({}, opts);
      const parsed = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0
      };
      let malformedAuthorityOrPort = false;
      let isIP = false;
      if (options.reference === "suffix") {
        if (options.scheme) {
          uri = options.scheme + ":" + uri;
        } else {
          uri = "//" + uri;
        }
      }
      const authorityMatch = uri.match(AUTHORITY_PREFIX);
      if (authorityMatch !== null && authorityMatch[1].indexOf("\\") !== -1) {
        parsed.error = "URI authority must not contain a literal backslash.";
        malformedAuthorityOrPort = true;
      }
      const matches2 = uri.match(URI_PARSE);
      if (matches2) {
        parsed.scheme = matches2[1];
        parsed.userinfo = matches2[3];
        parsed.host = matches2[4];
        parsed.port = parseInt(matches2[5], 10);
        parsed.path = matches2[6] || "";
        parsed.query = matches2[7];
        parsed.fragment = matches2[8];
        if (isNaN(parsed.port)) {
          parsed.port = matches2[5];
        }
        const parseError = getParseError(parsed, matches2);
        if (parseError !== void 0) {
          parsed.error = parsed.error || parseError;
          malformedAuthorityOrPort = true;
        }
        if (parsed.host) {
          const ipv4result = isIPv4(parsed.host);
          if (ipv4result === false) {
            const ipv6result = normalizeIPv6(parsed.host);
            parsed.host = ipv6result.host.toLowerCase();
            isIP = ipv6result.isIPV6;
          } else {
            isIP = true;
          }
        }
        if (parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path) {
          parsed.reference = "same-document";
        } else if (parsed.scheme === void 0) {
          parsed.reference = "relative";
        } else if (parsed.fragment === void 0) {
          parsed.reference = "absolute";
        } else {
          parsed.reference = "uri";
        }
        if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) {
          parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
        }
        const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
        if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport)) {
          if (parsed.host && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) {
            try {
              parsed.host = new URL("http://" + parsed.host).hostname;
            } catch (e) {
              parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
            }
          }
        }
        if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
          if (uri.indexOf("%") !== -1) {
            if (parsed.scheme !== void 0) {
              parsed.scheme = unescape(parsed.scheme);
            }
            if (parsed.host !== void 0) {
              parsed.host = reescapeHostDelimiters(unescape(parsed.host), isIP);
            }
          }
          if (parsed.path) {
            parsed.path = normalizePathEncoding(parsed.path);
          }
          if (parsed.fragment) {
            try {
              parsed.fragment = encodeURI(decodeURIComponent(parsed.fragment));
            } catch {
              parsed.error = parsed.error || "URI malformed";
            }
          }
        }
        if (schemeHandler && schemeHandler.parse) {
          schemeHandler.parse(parsed, options);
        }
      } else {
        parsed.error = parsed.error || "URI can not be parsed.";
      }
      return { parsed, malformedAuthorityOrPort };
    }
    function parse(uri, opts) {
      return parseWithStatus(uri, opts).parsed;
    }
    function normalizeString(uri, opts) {
      return normalizeStringWithStatus(uri, opts).normalized;
    }
    function normalizeStringWithStatus(uri, opts) {
      const { parsed, malformedAuthorityOrPort } = parseWithStatus(uri, opts);
      return {
        normalized: malformedAuthorityOrPort ? uri : serialize(parsed, opts),
        malformedAuthorityOrPort
      };
    }
    function normalizeComparableURI(uri, opts) {
      if (typeof uri === "string") {
        const { normalized, malformedAuthorityOrPort } = normalizeStringWithStatus(uri, opts);
        return malformedAuthorityOrPort ? void 0 : normalized;
      }
      if (typeof uri === "object") {
        return serialize(uri, opts);
      }
    }
    var fastUri = {
      SCHEMES,
      normalize,
      resolve: resolve3,
      resolveComponent,
      equal,
      serialize,
      parse
    };
    module.exports = fastUri;
    module.exports.default = fastUri;
    module.exports.fastUri = fastUri;
  }
});

// node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS({
  "node_modules/ajv/dist/runtime/uri.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var uri = require_fast_uri();
    uri.code = 'require("ajv/dist/runtime/uri").default';
    exports.default = uri;
  }
});

// node_modules/ajv/dist/core.js
var require_core = __commonJS({
  "node_modules/ajv/dist/core.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    var ref_error_1 = require_ref_error();
    var rules_1 = require_rules();
    var compile_1 = require_compile();
    var codegen_2 = require_codegen();
    var resolve_1 = require_resolve();
    var dataType_1 = require_dataType();
    var util_1 = require_util();
    var $dataRefSchema = require_data();
    var uri_1 = require_uri();
    var defaultRegExp = (str, flags) => new RegExp(str, flags);
    defaultRegExp.code = "new RegExp";
    var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
    var EXT_SCOPE_NAMES = /* @__PURE__ */ new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error"
    ]);
    var removedOptions = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now."
    };
    var deprecatedOptions = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    };
    var MAX_EXPRESSION = 200;
    function requiredOptions(o) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
      const s = o.strict;
      const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
      const optimize = _optz === true || _optz === void 0 ? 1 : _optz || 0;
      const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
      const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
      return {
        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
        uriResolver
      };
    }
    var Ajv2 = class {
      constructor(opts = {}) {
        this.schemas = {};
        this.refs = {};
        this.formats = /* @__PURE__ */ Object.create(null);
        this._compilations = /* @__PURE__ */ new Set();
        this._loading = {};
        this._cache = /* @__PURE__ */ new Map();
        opts = this.opts = { ...opts, ...requiredOptions(opts) };
        const { es5, lines } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
        this.logger = getLogger(opts.logger);
        const formatOpt = opts.validateFormats;
        opts.validateFormats = false;
        this.RULES = (0, rules_1.getRules)();
        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
        this._metaOpts = getMetaSchemaOptions.call(this);
        if (opts.formats)
          addInitialFormats.call(this);
        this._addVocabularies();
        this._addDefaultMetaSchema();
        if (opts.keywords)
          addInitialKeywords.call(this, opts.keywords);
        if (typeof opts.meta == "object")
          this.addMetaSchema(opts.meta);
        addInitialSchemas.call(this);
        opts.validateFormats = formatOpt;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        const { $data, meta, schemaId } = this.opts;
        let _dataRefSchema = $dataRefSchema;
        if (schemaId === "id") {
          _dataRefSchema = { ...$dataRefSchema };
          _dataRefSchema.id = _dataRefSchema.$id;
          delete _dataRefSchema.$id;
        }
        if (meta && $data)
          this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
      }
      defaultMeta() {
        const { meta, schemaId } = this.opts;
        return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : void 0;
      }
      validate(schemaKeyRef, data) {
        let v;
        if (typeof schemaKeyRef == "string") {
          v = this.getSchema(schemaKeyRef);
          if (!v)
            throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        } else {
          v = this.compile(schemaKeyRef);
        }
        const valid = v(data);
        if (!("$async" in v))
          this.errors = v.errors;
        return valid;
      }
      compile(schema, _meta) {
        const sch = this._addSchema(schema, _meta);
        return sch.validate || this._compileSchemaEnv(sch);
      }
      compileAsync(schema, meta) {
        if (typeof this.opts.loadSchema != "function") {
          throw new Error("options.loadSchema should be a function");
        }
        const { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema, meta);
        async function runCompileAsync(_schema, _meta) {
          await loadMetaSchema.call(this, _schema.$schema);
          const sch = this._addSchema(_schema, _meta);
          return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
          if ($ref && !this.getSchema($ref)) {
            await runCompileAsync.call(this, { $ref }, true);
          }
        }
        async function _compileAsync(sch) {
          try {
            return this._compileSchemaEnv(sch);
          } catch (e) {
            if (!(e instanceof ref_error_1.default))
              throw e;
            checkLoaded.call(this, e);
            await loadMissingSchema.call(this, e.missingSchema);
            return _compileAsync.call(this, sch);
          }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
          if (this.refs[ref]) {
            throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
          }
        }
        async function loadMissingSchema(ref) {
          const _schema = await _loadSchema.call(this, ref);
          if (!this.refs[ref])
            await loadMetaSchema.call(this, _schema.$schema);
          if (!this.refs[ref])
            this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
          const p = this._loading[ref];
          if (p)
            return p;
          try {
            return await (this._loading[ref] = loadSchema(ref));
          } finally {
            delete this._loading[ref];
          }
        }
      }
      // Adds schema to the instance
      addSchema(schema, key, _meta, _validateSchema = this.opts.validateSchema) {
        if (Array.isArray(schema)) {
          for (const sch of schema)
            this.addSchema(sch, void 0, _meta, _validateSchema);
          return this;
        }
        let id;
        if (typeof schema === "object") {
          const { schemaId } = this.opts;
          id = schema[schemaId];
          if (id !== void 0 && typeof id != "string") {
            throw new Error(`schema ${schemaId} must be string`);
          }
        }
        key = (0, resolve_1.normalizeId)(key || id);
        this._checkUnique(key);
        this.schemas[key] = this._addSchema(schema, _meta, key, _validateSchema, true);
        return this;
      }
      // Add schema that will be used to validate other schemas
      // options in META_IGNORE_OPTIONS are alway set to false
      addMetaSchema(schema, key, _validateSchema = this.opts.validateSchema) {
        this.addSchema(schema, key, true, _validateSchema);
        return this;
      }
      //  Validate schema against its meta-schema
      validateSchema(schema, throwOrLogError) {
        if (typeof schema == "boolean")
          return true;
        let $schema;
        $schema = schema.$schema;
        if ($schema !== void 0 && typeof $schema != "string") {
          throw new Error("$schema must be a string");
        }
        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
        if (!$schema) {
          this.logger.warn("meta-schema not available");
          this.errors = null;
          return true;
        }
        const valid = this.validate($schema, schema);
        if (!valid && throwOrLogError) {
          const message = "schema is invalid: " + this.errorsText();
          if (this.opts.validateSchema === "log")
            this.logger.error(message);
          else
            throw new Error(message);
        }
        return valid;
      }
      // Get compiled schema by `key` or `ref`.
      // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
      getSchema(keyRef) {
        let sch;
        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
          keyRef = sch;
        if (sch === void 0) {
          const { schemaId } = this.opts;
          const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
          sch = compile_1.resolveSchema.call(this, root, keyRef);
          if (!sch)
            return;
          this.refs[keyRef] = sch;
        }
        return sch.validate || this._compileSchemaEnv(sch);
      }
      // Remove cached schema(s).
      // If no parameter is passed all schemas but meta-schemas are removed.
      // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
      // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
      removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
          this._removeAllSchemas(this.schemas, schemaKeyRef);
          this._removeAllSchemas(this.refs, schemaKeyRef);
          return this;
        }
        switch (typeof schemaKeyRef) {
          case "undefined":
            this._removeAllSchemas(this.schemas);
            this._removeAllSchemas(this.refs);
            this._cache.clear();
            return this;
          case "string": {
            const sch = getSchEnv.call(this, schemaKeyRef);
            if (typeof sch == "object")
              this._cache.delete(sch.schema);
            delete this.schemas[schemaKeyRef];
            delete this.refs[schemaKeyRef];
            return this;
          }
          case "object": {
            const cacheKey = schemaKeyRef;
            this._cache.delete(cacheKey);
            let id = schemaKeyRef[this.opts.schemaId];
            if (id) {
              id = (0, resolve_1.normalizeId)(id);
              delete this.schemas[id];
              delete this.refs[id];
            }
            return this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      // add "vocabulary" - a collection of keywords
      addVocabulary(definitions) {
        for (const def of definitions)
          this.addKeyword(def);
        return this;
      }
      addKeyword(kwdOrDef, def) {
        let keyword;
        if (typeof kwdOrDef == "string") {
          keyword = kwdOrDef;
          if (typeof def == "object") {
            this.logger.warn("these parameters are deprecated, see docs for addKeyword");
            def.keyword = keyword;
          }
        } else if (typeof kwdOrDef == "object" && def === void 0) {
          def = kwdOrDef;
          keyword = def.keyword;
          if (Array.isArray(keyword) && !keyword.length) {
            throw new Error("addKeywords: keyword must be string or non-empty array");
          }
        } else {
          throw new Error("invalid addKeywords parameters");
        }
        checkKeyword.call(this, keyword, def);
        if (!def) {
          (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
          return this;
        }
        keywordMetaschema.call(this, def);
        const definition = {
          ...def,
          type: (0, dataType_1.getJSONTypes)(def.type),
          schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
        };
        (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t)));
        return this;
      }
      getKeyword(keyword) {
        const rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
      }
      // Remove keyword
      removeKeyword(keyword) {
        const { RULES } = this;
        delete RULES.keywords[keyword];
        delete RULES.all[keyword];
        for (const group of RULES.rules) {
          const i = group.rules.findIndex((rule) => rule.keyword === keyword);
          if (i >= 0)
            group.rules.splice(i, 1);
        }
        return this;
      }
      // Add format
      addFormat(name, format) {
        if (typeof format == "string")
          format = new RegExp(format);
        this.formats[name] = format;
        return this;
      }
      errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
        if (!errors || errors.length === 0)
          return "No errors";
        return errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
      }
      $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        const rules = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (const jsonPointer of keywordsJsonPointers) {
          const segments = jsonPointer.split("/").slice(1);
          let keywords = metaSchema;
          for (const seg of segments)
            keywords = keywords[seg];
          for (const key in rules) {
            const rule = rules[key];
            if (typeof rule != "object")
              continue;
            const { $data } = rule.definition;
            const schema = keywords[key];
            if ($data && schema)
              keywords[key] = schemaOrData(schema);
          }
        }
        return metaSchema;
      }
      _removeAllSchemas(schemas, regex) {
        for (const keyRef in schemas) {
          const sch = schemas[keyRef];
          if (!regex || regex.test(keyRef)) {
            if (typeof sch == "string") {
              delete schemas[keyRef];
            } else if (sch && !sch.meta) {
              this._cache.delete(sch.schema);
              delete schemas[keyRef];
            }
          }
        }
      }
      _addSchema(schema, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id;
        const { schemaId } = this.opts;
        if (typeof schema == "object") {
          id = schema[schemaId];
        } else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          else if (typeof schema != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema);
        if (sch !== void 0)
          return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        const localRefs = resolve_1.getSchemaRefs.call(this, schema, baseId);
        sch = new compile_1.SchemaEnv({ schema, schemaId, meta, baseId, localRefs });
        this._cache.set(sch.schema, sch);
        if (addSchema && !baseId.startsWith("#")) {
          if (baseId)
            this._checkUnique(baseId);
          this.refs[baseId] = sch;
        }
        if (validateSchema)
          this.validateSchema(schema, true);
        return sch;
      }
      _checkUnique(id) {
        if (this.schemas[id] || this.refs[id]) {
          throw new Error(`schema with key or id "${id}" already exists`);
        }
      }
      _compileSchemaEnv(sch) {
        if (sch.meta)
          this._compileMetaSchema(sch);
        else
          compile_1.compileSchema.call(this, sch);
        if (!sch.validate)
          throw new Error("ajv implementation error");
        return sch.validate;
      }
      _compileMetaSchema(sch) {
        const currentOpts = this.opts;
        this.opts = this._metaOpts;
        try {
          compile_1.compileSchema.call(this, sch);
        } finally {
          this.opts = currentOpts;
        }
      }
    };
    Ajv2.ValidationError = validation_error_1.default;
    Ajv2.MissingRefError = ref_error_1.default;
    exports.default = Ajv2;
    function checkOptions(checkOpts, options, msg, log = "error") {
      for (const key in checkOpts) {
        const opt = key;
        if (opt in options)
          this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
      }
    }
    function getSchEnv(keyRef) {
      keyRef = (0, resolve_1.normalizeId)(keyRef);
      return this.schemas[keyRef] || this.refs[keyRef];
    }
    function addInitialSchemas() {
      const optsSchemas = this.opts.schemas;
      if (!optsSchemas)
        return;
      if (Array.isArray(optsSchemas))
        this.addSchema(optsSchemas);
      else
        for (const key in optsSchemas)
          this.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats() {
      for (const name in this.opts.formats) {
        const format = this.opts.formats[name];
        if (format)
          this.addFormat(name, format);
      }
    }
    function addInitialKeywords(defs) {
      if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (const keyword in defs) {
        const def = defs[keyword];
        if (!def.keyword)
          def.keyword = keyword;
        this.addKeyword(def);
      }
    }
    function getMetaSchemaOptions() {
      const metaOpts = { ...this.opts };
      for (const opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
      return metaOpts;
    }
    var noLogs = { log() {
    }, warn() {
    }, error() {
    } };
    function getLogger(logger) {
      if (logger === false)
        return noLogs;
      if (logger === void 0)
        return console;
      if (logger.log && logger.warn && logger.error)
        return logger;
      throw new Error("logger must implement log, warn and error methods");
    }
    var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
    function checkKeyword(keyword, def) {
      const { RULES } = this;
      (0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES.keywords[kwd])
          throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
          throw new Error(`Keyword ${kwd} has invalid name`);
      });
      if (!def)
        return;
      if (def.$data && !("code" in def || "validate" in def)) {
        throw new Error('$data keyword must have "code" or "validate" function');
      }
    }
    function addRule(keyword, definition, dataType) {
      var _a;
      const post = definition === null || definition === void 0 ? void 0 : definition.post;
      if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
      const { RULES } = this;
      let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t }) => t === dataType);
      if (!ruleGroup) {
        ruleGroup = { type: dataType, rules: [] };
        RULES.rules.push(ruleGroup);
      }
      RULES.keywords[keyword] = true;
      if (!definition)
        return;
      const rule = {
        keyword,
        definition: {
          ...definition,
          type: (0, dataType_1.getJSONTypes)(definition.type),
          schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
        }
      };
      if (definition.before)
        addBeforeRule.call(this, ruleGroup, rule, definition.before);
      else
        ruleGroup.rules.push(rule);
      RULES.all[keyword] = rule;
      (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
    }
    function addBeforeRule(ruleGroup, rule, before) {
      const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
      if (i >= 0) {
        ruleGroup.rules.splice(i, 0, rule);
      } else {
        ruleGroup.rules.push(rule);
        this.logger.warn(`rule ${before} is not defined`);
      }
    }
    function keywordMetaschema(def) {
      let { metaSchema } = def;
      if (metaSchema === void 0)
        return;
      if (def.$data && this.opts.$data)
        metaSchema = schemaOrData(metaSchema);
      def.validateSchema = this.compile(metaSchema, true);
    }
    var $dataRef = {
      $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
    };
    function schemaOrData(schema) {
      return { anyOf: [schema, $dataRef] };
    }
  }
});

// node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/id.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var def = {
      keyword: "id",
      code() {
        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/ref.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.callRef = exports.getValidate = void 0;
    var ref_error_1 = require_ref_error();
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var util_1 = require_util();
    var def = {
      keyword: "$ref",
      schemaType: "string",
      code(cxt) {
        const { gen, schema: $ref, it } = cxt;
        const { baseId, schemaEnv: env, validateName, opts, self } = it;
        const { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
          return callRootRef();
        const schOrEnv = compile_1.resolveRef.call(self, root, baseId, $ref);
        if (schOrEnv === void 0)
          throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
          return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
          if (env === root)
            return callRef(cxt, validateName, env, env.$async);
          const rootName = gen.scopeValue("root", { ref: root });
          return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
          const v = getValidate(cxt, sch);
          callRef(cxt, v, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
          const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
          const valid = gen.name("valid");
          const schCxt = cxt.subschema({
            schema: sch,
            dataTypes: [],
            schemaPath: codegen_1.nil,
            topSchemaRef: schName,
            errSchemaPath: $ref
          }, valid);
          cxt.mergeEvaluated(schCxt);
          cxt.ok(valid);
        }
      }
    };
    function getValidate(cxt, sch) {
      const { gen } = cxt;
      return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
    }
    exports.getValidate = getValidate;
    function callRef(cxt, v, sch, $async) {
      const { gen, it } = cxt;
      const { allErrors, schemaEnv: env, opts } = it;
      const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
      if ($async)
        callAsyncRef();
      else
        callSyncRef();
      function callAsyncRef() {
        if (!env.$async)
          throw new Error("async schema referenced by sync schema");
        const valid = gen.let("valid");
        gen.try(() => {
          gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`);
          addEvaluatedFrom(v);
          if (!allErrors)
            gen.assign(valid, true);
        }, (e) => {
          gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
          addErrorsFrom(e);
          if (!allErrors)
            gen.assign(valid, false);
        });
        cxt.ok(valid);
      }
      function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
      }
      function addErrorsFrom(source) {
        const errs = (0, codegen_1._)`${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
        gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      }
      function addEvaluatedFrom(source) {
        var _a;
        if (!it.opts.unevaluated)
          return;
        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        if (it.props !== true) {
          if (schEvaluated && !schEvaluated.dynamicProps) {
            if (schEvaluated.props !== void 0) {
              it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
            }
          } else {
            const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
            it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
          }
        }
        if (it.items !== true) {
          if (schEvaluated && !schEvaluated.dynamicItems) {
            if (schEvaluated.items !== void 0) {
              it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
            }
          } else {
            const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
            it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
          }
        }
      }
    }
    exports.callRef = callRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var id_1 = require_id();
    var ref_1 = require_ref();
    var core = [
      "$schema",
      "$id",
      "$defs",
      "$vocabulary",
      { keyword: "$comment" },
      "definitions",
      id_1.default,
      ref_1.default
    ];
    exports.default = core;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitNumber.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    var def = {
      keyword: Object.keys(KWDs),
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/multipleOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
      params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
    };
    var def = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, schemaCode, it } = cxt;
        const prec = it.opts.multipleOfPrecision;
        const res = gen.let("res");
        const invalid = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
        cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitLength.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var ucs2length_1 = require_ucs2length();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode, it } = cxt;
        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
        const len = it.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
        cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/pattern.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var util_1 = require_util();
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
    };
    var def = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const u = it.opts.unicodeRegExp ? "u" : "";
        if ($data) {
          const { regExp } = it.opts.code;
          const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
          const valid = gen.let("valid");
          gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, false));
          cxt.fail$data((0, codegen_1._)`!${valid}`);
        } else {
          const regExp = (0, code_1.usePattern)(cxt, schema);
          cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/required.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
      params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
    };
    var def = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, schema, schemaCode, data, $data, it } = cxt;
        const { opts } = it;
        if (!$data && schema.length === 0)
          return;
        const useLoop = schema.length >= opts.loopRequired;
        if (it.allErrors)
          allErrorsMode();
        else
          exitOnErrorMode();
        if (opts.strictRequired) {
          const props = cxt.parentSchema.properties;
          const { definedProperties } = cxt.it;
          for (const requiredKey of schema) {
            if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === void 0 && !definedProperties.has(requiredKey)) {
              const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
              const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
              (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
            }
          }
        }
        function allErrorsMode() {
          if (useLoop || $data) {
            cxt.block$data(codegen_1.nil, loopAllRequired);
          } else {
            for (const prop of schema) {
              (0, code_1.checkReportMissingProp)(cxt, prop);
            }
          }
        }
        function exitOnErrorMode() {
          const missing = gen.let("missing");
          if (useLoop || $data) {
            const valid = gen.let("valid", true);
            cxt.block$data(valid, () => loopUntilMissing(missing, valid));
            cxt.ok(valid);
          } else {
            gen.if((0, code_1.checkMissingProp)(cxt, schema, missing));
            (0, code_1.reportMissingProp)(cxt, missing);
            gen.else();
          }
        }
        function loopAllRequired() {
          gen.forOf("prop", schemaCode, (prop) => {
            cxt.setParams({ missingProperty: prop });
            gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
          });
        }
        function loopUntilMissing(missing, valid) {
          cxt.setParams({ missingProperty: missing });
          gen.forOf(missing, schemaCode, () => {
            gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
            gen.if((0, codegen_1.not)(valid), () => {
              cxt.error();
              gen.break();
            });
          }, codegen_1.nil);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/uniqueItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dataType_1 = require_dataType();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
      params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
    };
    var def = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, parentSchema, schemaCode, it } = cxt;
        if (!$data && !schema)
          return;
        const valid = gen.let("valid");
        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
        cxt.ok(valid);
        function validateUniqueItems() {
          const i = gen.let("i", (0, codegen_1._)`${data}.length`);
          const j = gen.let("j");
          cxt.setParams({ i, j });
          gen.assign(valid, true);
          gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
        }
        function canOptimize() {
          return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
        }
        function loopN(i, j) {
          const item = gen.name("item");
          const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
          const indices = gen.const("indices", (0, codegen_1._)`{}`);
          gen.for((0, codegen_1._)`;${i}--;`, () => {
            gen.let(item, (0, codegen_1._)`${data}[${i}]`);
            gen.if(wrongType, (0, codegen_1._)`continue`);
            if (itemTypes.length > 1)
              gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
            gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
              gen.assign(j, (0, codegen_1._)`${indices}[${item}]`);
              cxt.error();
              gen.assign(valid, false).break();
            }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
          });
        }
        function loopN2(i, j) {
          const eql = (0, util_1.useFunc)(gen, equal_1.default);
          const outer = gen.name("outer");
          gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
            cxt.error();
            gen.assign(valid, false).break(outer);
          })));
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/const.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to constant",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
    };
    var def = {
      keyword: "const",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schemaCode, schema } = cxt;
        if ($data || schema && typeof schema == "object") {
          cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
        } else {
          cxt.fail((0, codegen_1._)`${schema} !== ${data}`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
    };
    var def = {
      keyword: "enum",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        if (!$data && schema.length === 0)
          throw new Error("enum must have non-empty array");
        const useLoop = schema.length >= it.opts.loopEnum;
        let eql;
        const getEql = () => eql !== null && eql !== void 0 ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
        let valid;
        if (useLoop || $data) {
          valid = gen.let("valid");
          cxt.block$data(valid, loopEnum);
        } else {
          if (!Array.isArray(schema))
            throw new Error("ajv implementation error");
          const vSchema = gen.const("vSchema", schemaCode);
          valid = (0, codegen_1.or)(...schema.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
          gen.assign(valid, false);
          gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, true).break()));
        }
        function equalCode(vSchema, i) {
          const sch = schema[i];
          return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var limitNumber_1 = require_limitNumber();
    var multipleOf_1 = require_multipleOf();
    var limitLength_1 = require_limitLength();
    var pattern_1 = require_pattern();
    var limitProperties_1 = require_limitProperties();
    var required_1 = require_required();
    var limitItems_1 = require_limitItems();
    var uniqueItems_1 = require_uniqueItems();
    var const_1 = require_const();
    var enum_1 = require_enum();
    var validation = [
      // number
      limitNumber_1.default,
      multipleOf_1.default,
      // string
      limitLength_1.default,
      pattern_1.default,
      // object
      limitProperties_1.default,
      required_1.default,
      // array
      limitItems_1.default,
      uniqueItems_1.default,
      // any
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      const_1.default,
      enum_1.default
    ];
    exports.default = validation;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateAdditionalItems = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { parentSchema, it } = cxt;
        const { items } = parentSchema;
        if (!Array.isArray(items)) {
          (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        validateAdditionalItems(cxt, items);
      }
    };
    function validateAdditionalItems(cxt, items) {
      const { gen, schema, data, keyword, it } = cxt;
      it.items = true;
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      if (schema === false) {
        cxt.setParams({ len: items.length });
        cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
      } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
        const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
        cxt.ok(valid);
      }
      function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
          cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
          if (!it.allErrors)
            gen.if((0, codegen_1.not)(valid), () => gen.break());
        });
      }
    }
    exports.validateAdditionalItems = validateAdditionalItems;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateTuple = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(cxt) {
        const { schema, it } = cxt;
        if (Array.isArray(schema))
          return validateTuple(cxt, "additionalItems", schema);
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    function validateTuple(cxt, extraItems, schArr = cxt.schema) {
      const { gen, parentSchema, data, keyword, it } = cxt;
      checkStrictTuple(parentSchema);
      if (it.opts.unevaluated && schArr.length && it.items !== true) {
        it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
      }
      const valid = gen.name("valid");
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      schArr.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it, sch))
          return;
        gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
          keyword,
          schemaProp: i,
          dataProp: i
        }, valid));
        cxt.ok(valid);
      });
      function checkStrictTuple(sch) {
        const { opts, errSchemaPath } = it;
        const l = schArr.length;
        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
        if (opts.strictTuples && !fullTuple) {
          const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
          (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
        }
      }
    }
    exports.validateTuple = validateTuple;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/prefixItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var items_1 = require_items();
    var def = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var additionalItems_1 = require_additionalItems();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { schema, parentSchema, it } = cxt;
        const { prefixItems } = parentSchema;
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        if (prefixItems)
          (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
        else
          cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/contains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
      params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
    };
    var def = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        let min;
        let max;
        const { minContains, maxContains } = parentSchema;
        if (it.opts.next) {
          min = minContains === void 0 ? 1 : minContains;
          max = maxContains;
        } else {
          min = 1;
        }
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        cxt.setParams({ min, max });
        if (max === void 0 && min === 0) {
          (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
          return;
        }
        if (max !== void 0 && min > max) {
          (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
          cxt.fail();
          return;
        }
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          let cond = (0, codegen_1._)`${len} >= ${min}`;
          if (max !== void 0)
            cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
          cxt.pass(cond);
          return;
        }
        it.items = true;
        const valid = gen.name("valid");
        if (max === void 0 && min === 1) {
          validateItems(valid, () => gen.if(valid, () => gen.break()));
        } else if (min === 0) {
          gen.let(valid, true);
          if (max !== void 0)
            gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
        } else {
          gen.let(valid, false);
          validateItemsWithCount();
        }
        cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
          const schValid = gen.name("_valid");
          const count = gen.let("count", 0);
          validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block) {
          gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
              keyword: "contains",
              dataProp: i,
              dataPropType: util_1.Type.Num,
              compositeRule: true
            }, _valid);
            block();
          });
        }
        function checkLimits(count) {
          gen.code((0, codegen_1._)`${count}++`);
          if (max === void 0) {
            gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
          } else {
            gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
            if (min === 1)
              gen.assign(valid, true);
            else
              gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependencies.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    exports.error = {
      message: ({ params: { property, depsCount, deps } }) => {
        const property_ies = depsCount === 1 ? "property" : "properties";
        return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
      },
      params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
      // TODO change to reference
    };
    var def = {
      keyword: "dependencies",
      type: "object",
      schemaType: "object",
      error: exports.error,
      code(cxt) {
        const [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps);
        validateSchemaDeps(cxt, schDeps);
      }
    };
    function splitDependencies({ schema }) {
      const propertyDeps = {};
      const schemaDeps = {};
      for (const key in schema) {
        if (key === "__proto__")
          continue;
        const deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema[key];
      }
      return [propertyDeps, schemaDeps];
    }
    function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
      const { gen, data, it } = cxt;
      if (Object.keys(propertyDeps).length === 0)
        return;
      const missing = gen.let("missing");
      for (const prop in propertyDeps) {
        const deps = propertyDeps[prop];
        if (deps.length === 0)
          continue;
        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
        cxt.setParams({
          property: prop,
          depsCount: deps.length,
          deps: deps.join(", ")
        });
        if (it.allErrors) {
          gen.if(hasProperty, () => {
            for (const depProp of deps) {
              (0, code_1.checkReportMissingProp)(cxt, depProp);
            }
          });
        } else {
          gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
          (0, code_1.reportMissingProp)(cxt, missing);
          gen.else();
        }
      }
    }
    exports.validatePropertyDeps = validatePropertyDeps;
    function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      for (const prop in schemaDeps) {
        if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
          continue;
        gen.if(
          (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties),
          () => {
            const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
            cxt.mergeValidEvaluated(schCxt, valid);
          },
          () => gen.var(valid, true)
          // TODO var
        );
        cxt.ok(valid);
      }
    }
    exports.validateSchemaDeps = validateSchemaDeps;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/propertyNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "property name must be valid",
      params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
    };
    var def = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error,
      code(cxt) {
        const { gen, schema, data, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        const valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
          cxt.setParams({ propertyName: key });
          cxt.subschema({
            keyword: "propertyNames",
            data: key,
            dataTypes: ["string"],
            propertyName: key,
            compositeRule: true
          }, valid);
          gen.if((0, codegen_1.not)(valid), () => {
            cxt.error(true);
            if (!it.allErrors)
              gen.break();
          });
        });
        cxt.ok(valid);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var util_1 = require_util();
    var error = {
      message: "must NOT have additional properties",
      params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
    };
    var def = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: true,
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, opts } = it;
        it.props = true;
        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema))
          return;
        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties();
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
          gen.forIn("key", data, (key) => {
            if (!props.length && !patProps.length)
              additionalPropertyCode(key);
            else
              gen.if(isAdditional(key), () => additionalPropertyCode(key));
          });
        }
        function isAdditional(key) {
          let definedProp;
          if (props.length > 8) {
            const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
            definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
          } else if (props.length) {
            definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
          } else {
            definedProp = codegen_1.nil;
          }
          if (patProps.length) {
            definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
          }
          return (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
          gen.code((0, codegen_1._)`delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
          if (opts.removeAdditional === "all" || opts.removeAdditional && schema === false) {
            deleteAdditional(key);
            return;
          }
          if (schema === false) {
            cxt.setParams({ additionalProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
            const valid = gen.name("valid");
            if (opts.removeAdditional === "failing") {
              applyAdditionalSchema(key, valid, false);
              gen.if((0, codegen_1.not)(valid), () => {
                cxt.reset();
                deleteAdditional(key);
              });
            } else {
              applyAdditionalSchema(key, valid);
              if (!allErrors)
                gen.if((0, codegen_1.not)(valid), () => gen.break());
            }
          }
        }
        function applyAdditionalSchema(key, valid, errors) {
          const subschema = {
            keyword: "additionalProperties",
            dataProp: key,
            dataPropType: util_1.Type.Str
          };
          if (errors === false) {
            Object.assign(subschema, {
              compositeRule: true,
              createErrors: false,
              allErrors: false
            });
          }
          cxt.subschema(subschema, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/properties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var validate_1 = require_validate();
    var code_1 = require_code2();
    var util_1 = require_util();
    var additionalProperties_1 = require_additionalProperties();
    var def = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0) {
          additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
        }
        const allProps = (0, code_1.allSchemaProperties)(schema);
        for (const prop of allProps) {
          it.definedProperties.add(prop);
        }
        if (it.opts.unevaluated && allProps.length && it.props !== true) {
          it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
        }
        const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema[p]));
        if (properties.length === 0)
          return;
        const valid = gen.name("valid");
        for (const prop of properties) {
          if (hasDefault(prop)) {
            applyPropertySchema(prop);
          } else {
            gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
            applyPropertySchema(prop);
            if (!it.allErrors)
              gen.else().var(valid, true);
            gen.endIf();
          }
          cxt.it.definedProperties.add(prop);
          cxt.ok(valid);
        }
        function hasDefault(prop) {
          return it.opts.useDefaults && !it.compositeRule && schema[prop].default !== void 0;
        }
        function applyPropertySchema(prop) {
          cxt.subschema({
            keyword: "properties",
            schemaProp: prop,
            dataProp: prop
          }, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/patternProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var util_2 = require_util();
    var def = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, data, parentSchema, it } = cxt;
        const { opts } = it;
        const patterns = (0, code_1.allSchemaProperties)(schema);
        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema[p]));
        if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === true)) {
          return;
        }
        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
        const valid = gen.name("valid");
        if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
          it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
        }
        const { props } = it;
        validatePatternProperties();
        function validatePatternProperties() {
          for (const pat of patterns) {
            if (checkProperties)
              checkMatchingProperties(pat);
            if (it.allErrors) {
              validateProperties(pat);
            } else {
              gen.var(valid, true);
              validateProperties(pat);
              gen.if(valid);
            }
          }
        }
        function checkMatchingProperties(pat) {
          for (const prop in checkProperties) {
            if (new RegExp(pat).test(prop)) {
              (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
            }
          }
        }
        function validateProperties(pat) {
          gen.forIn("key", data, (key) => {
            gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
              const alwaysValid = alwaysValidPatterns.includes(pat);
              if (!alwaysValid) {
                cxt.subschema({
                  keyword: "patternProperties",
                  schemaProp: pat,
                  dataProp: key,
                  dataPropType: util_2.Type.Str
                }, valid);
              }
              if (it.opts.unevaluated && props !== true) {
                gen.assign((0, codegen_1._)`${props}[${key}]`, true);
              } else if (!alwaysValid && !it.allErrors) {
                gen.if((0, codegen_1.not)(valid), () => gen.break());
              }
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/not.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      code(cxt) {
        const { gen, schema, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          cxt.fail();
          return;
        }
        const valid = gen.name("valid");
        cxt.subschema({
          keyword: "not",
          compositeRule: true,
          createErrors: false,
          allErrors: false
        }, valid);
        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
      },
      error: { message: "must NOT be valid" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/anyOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var def = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: true,
      code: code_1.validateUnion,
      error: { message: "must match a schema in anyOf" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/oneOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "must match exactly one schema in oneOf",
      params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
    };
    var def = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        if (it.opts.discriminator && parentSchema.discriminator)
          return;
        const schArr = schema;
        const valid = gen.let("valid", false);
        const passing = gen.let("passing", null);
        const schValid = gen.name("_valid");
        cxt.setParams({ passing });
        gen.block(validateOneOf);
        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
        function validateOneOf() {
          schArr.forEach((sch, i) => {
            let schCxt;
            if ((0, util_1.alwaysValidSchema)(it, sch)) {
              gen.var(schValid, true);
            } else {
              schCxt = cxt.subschema({
                keyword: "oneOf",
                schemaProp: i,
                compositeRule: true
              }, schValid);
            }
            if (i > 0) {
              gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
            }
            gen.if(schValid, () => {
              gen.assign(valid, true);
              gen.assign(passing, i);
              if (schCxt)
                cxt.mergeEvaluated(schCxt, codegen_1.Name);
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/allOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "allOf",
      schemaType: "array",
      code(cxt) {
        const { gen, schema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        const valid = gen.name("valid");
        schema.forEach((sch, i) => {
          if ((0, util_1.alwaysValidSchema)(it, sch))
            return;
          const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
          cxt.ok(valid);
          cxt.mergeEvaluated(schCxt);
        });
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/if.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
      params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
    };
    var def = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, parentSchema, it } = cxt;
        if (parentSchema.then === void 0 && parentSchema.else === void 0) {
          (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
        }
        const hasThen = hasSchema(it, "then");
        const hasElse = hasSchema(it, "else");
        if (!hasThen && !hasElse)
          return;
        const valid = gen.let("valid", true);
        const schValid = gen.name("_valid");
        validateIf();
        cxt.reset();
        if (hasThen && hasElse) {
          const ifClause = gen.let("ifClause");
          cxt.setParams({ ifClause });
          gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        } else if (hasThen) {
          gen.if(schValid, validateClause("then"));
        } else {
          gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        }
        cxt.pass(valid, () => cxt.error(true));
        function validateIf() {
          const schCxt = cxt.subschema({
            keyword: "if",
            compositeRule: true,
            createErrors: false,
            allErrors: false
          }, schValid);
          cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
          return () => {
            const schCxt = cxt.subschema({ keyword }, schValid);
            gen.assign(valid, schValid);
            cxt.mergeValidEvaluated(schCxt, valid);
            if (ifClause)
              gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
            else
              cxt.setParams({ ifClause: keyword });
          };
        }
      }
    };
    function hasSchema(it, keyword) {
      const schema = it.schema[keyword];
      return schema !== void 0 && !(0, util_1.alwaysValidSchema)(it, schema);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/thenElse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword, parentSchema, it }) {
        if (parentSchema.if === void 0)
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var additionalItems_1 = require_additionalItems();
    var prefixItems_1 = require_prefixItems();
    var items_1 = require_items();
    var items2020_1 = require_items2020();
    var contains_1 = require_contains();
    var dependencies_1 = require_dependencies();
    var propertyNames_1 = require_propertyNames();
    var additionalProperties_1 = require_additionalProperties();
    var properties_1 = require_properties();
    var patternProperties_1 = require_patternProperties();
    var not_1 = require_not();
    var anyOf_1 = require_anyOf();
    var oneOf_1 = require_oneOf();
    var allOf_1 = require_allOf();
    var if_1 = require_if();
    var thenElse_1 = require_thenElse();
    function getApplicator(draft2020 = false) {
      const applicator = [
        // any
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        // object
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default
      ];
      if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
      else
        applicator.push(additionalItems_1.default, items_1.default);
      applicator.push(contains_1.default);
      return applicator;
    }
    exports.default = getApplicator;
  }
});

// node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/format.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
    };
    var def = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: true,
      error,
      code(cxt, ruleType) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const { opts, errSchemaPath, schemaEnv, self } = it;
        if (!opts.validateFormats)
          return;
        if ($data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self.formats,
            code: opts.code.formats
          });
          const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
          const fType = gen.let("fType");
          const format = gen.let("format");
          gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef));
          cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
          function unknownFmt() {
            if (opts.strictSchema === false)
              return codegen_1.nil;
            return (0, codegen_1._)`${schemaCode} && !${format}`;
          }
          function invalidFmt() {
            const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`;
            const validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
            return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
          }
        }
        function validateFormat() {
          const formatDef = self.formats[schema];
          if (!formatDef) {
            unknownFormat();
            return;
          }
          if (formatDef === true)
            return;
          const [fmtType, format, fmtRef] = getFormat(formatDef);
          if (fmtType === ruleType)
            cxt.pass(validCondition());
          function unknownFormat() {
            if (opts.strictSchema === false) {
              self.logger.warn(unknownMsg());
              return;
            }
            throw new Error(unknownMsg());
            function unknownMsg() {
              return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
            }
          }
          function getFormat(fmtDef) {
            const code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema)}` : void 0;
            const fmt = gen.scopeValue("formats", { key: schema, ref: fmtDef, code });
            if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
              return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`];
            }
            return ["string", fmtDef, fmt];
          }
          function validCondition() {
            if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
              if (!schemaEnv.$async)
                throw new Error("async format in sync schema");
              return (0, codegen_1._)`await ${fmtRef}(${data})`;
            }
            return typeof format == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var format_1 = require_format();
    var format = [format_1.default];
    exports.default = format;
  }
});

// node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS({
  "node_modules/ajv/dist/vocabularies/metadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.contentVocabulary = exports.metadataVocabulary = void 0;
    exports.metadataVocabulary = [
      "title",
      "description",
      "default",
      "deprecated",
      "readOnly",
      "writeOnly",
      "examples"
    ];
    exports.contentVocabulary = [
      "contentMediaType",
      "contentEncoding",
      "contentSchema"
    ];
  }
});

// node_modules/ajv/dist/vocabularies/draft7.js
var require_draft7 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft7.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft7Vocabularies = [
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary
    ];
    exports.default = draft7Vocabularies;
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiscrError = void 0;
    var DiscrError;
    (function(DiscrError2) {
      DiscrError2["Tag"] = "tag";
      DiscrError2["Mapping"] = "mapping";
    })(DiscrError || (exports.DiscrError = DiscrError = {}));
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var types_1 = require_types();
    var compile_1 = require_compile();
    var ref_error_1 = require_ref_error();
    var util_1 = require_util();
    var error = {
      message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
      params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
    };
    var def = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error,
      code(cxt) {
        const { gen, data, schema, parentSchema, it } = cxt;
        const { oneOf } = parentSchema;
        if (!it.opts.discriminator) {
          throw new Error("discriminator: requires discriminator option");
        }
        const tagName = schema.propertyName;
        if (typeof tagName != "string")
          throw new Error("discriminator: requires propertyName");
        if (schema.mapping)
          throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
          throw new Error("discriminator: requires oneOf keyword");
        const valid = gen.let("valid", false);
        const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
        cxt.ok(valid);
        function validateMapping() {
          const mapping = getMapping();
          gen.if(false);
          for (const tagValue in mapping) {
            gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
            gen.assign(valid, applyTagSchema(mapping[tagValue]));
          }
          gen.else();
          cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
          gen.endIf();
        }
        function applyTagSchema(schemaProp) {
          const _valid = gen.name("valid");
          const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
          cxt.mergeEvaluated(schCxt, codegen_1.Name);
          return _valid;
        }
        function getMapping() {
          var _a;
          const oneOfMapping = {};
          const topRequired = hasRequired(parentSchema);
          let tagRequired = true;
          for (let i = 0; i < oneOf.length; i++) {
            let sch = oneOf[i];
            if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
              const ref = sch.$ref;
              sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
              if (sch instanceof compile_1.SchemaEnv)
                sch = sch.schema;
              if (sch === void 0)
                throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
            }
            const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
            if (typeof propSch != "object") {
              throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
            }
            tagRequired = tagRequired && (topRequired || hasRequired(sch));
            addMappings(propSch, i);
          }
          if (!tagRequired)
            throw new Error(`discriminator: "${tagName}" must be required`);
          return oneOfMapping;
          function hasRequired({ required }) {
            return Array.isArray(required) && required.includes(tagName);
          }
          function addMappings(sch, i) {
            if (sch.const) {
              addMapping(sch.const, i);
            } else if (sch.enum) {
              for (const tagValue of sch.enum) {
                addMapping(tagValue, i);
              }
            } else {
              throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
            }
          }
          function addMapping(tagValue, i) {
            if (typeof tagValue != "string" || tagValue in oneOfMapping) {
              throw new Error(`discriminator: "${tagName}" values must be unique strings`);
            }
            oneOfMapping[tagValue] = i;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/refs/json-schema-draft-07.json
var require_json_schema_draft_07 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-draft-07.json"(exports, module) {
    module.exports = {
      $schema: "http://json-schema.org/draft-07/schema#",
      $id: "http://json-schema.org/draft-07/schema#",
      title: "Core schema meta-schema",
      definitions: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $ref: "#" }
        },
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          allOf: [{ $ref: "#/definitions/nonNegativeInteger" }, { default: 0 }]
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      },
      type: ["object", "boolean"],
      properties: {
        $id: {
          type: "string",
          format: "uri-reference"
        },
        $schema: {
          type: "string",
          format: "uri"
        },
        $ref: {
          type: "string",
          format: "uri-reference"
        },
        $comment: {
          type: "string"
        },
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        readOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/definitions/nonNegativeInteger" },
        minLength: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        additionalItems: { $ref: "#" },
        items: {
          anyOf: [{ $ref: "#" }, { $ref: "#/definitions/schemaArray" }],
          default: true
        },
        maxItems: { $ref: "#/definitions/nonNegativeInteger" },
        minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        contains: { $ref: "#" },
        maxProperties: { $ref: "#/definitions/nonNegativeInteger" },
        minProperties: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        required: { $ref: "#/definitions/stringArray" },
        additionalProperties: { $ref: "#" },
        definitions: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        properties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $ref: "#" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependencies: {
          type: "object",
          additionalProperties: {
            anyOf: [{ $ref: "#" }, { $ref: "#/definitions/stringArray" }]
          }
        },
        propertyNames: { $ref: "#" },
        const: true,
        enum: {
          type: "array",
          items: true,
          minItems: 1,
          uniqueItems: true
        },
        type: {
          anyOf: [
            { $ref: "#/definitions/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/definitions/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        format: { type: "string" },
        contentMediaType: { type: "string" },
        contentEncoding: { type: "string" },
        if: { $ref: "#" },
        then: { $ref: "#" },
        else: { $ref: "#" },
        allOf: { $ref: "#/definitions/schemaArray" },
        anyOf: { $ref: "#/definitions/schemaArray" },
        oneOf: { $ref: "#/definitions/schemaArray" },
        not: { $ref: "#" }
      },
      default: true
    };
  }
});

// node_modules/ajv/dist/ajv.js
var require_ajv = __commonJS({
  "node_modules/ajv/dist/ajv.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv = void 0;
    var core_1 = require_core();
    var draft7_1 = require_draft7();
    var discriminator_1 = require_discriminator();
    var draft7MetaSchema = require_json_schema_draft_07();
    var META_SUPPORT_DATA = ["/properties"];
    var META_SCHEMA_ID = "http://json-schema.org/draft-07/schema";
    var Ajv2 = class extends core_1.default {
      _addVocabularies() {
        super._addVocabularies();
        draft7_1.default.forEach((v) => this.addVocabulary(v));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        if (!this.opts.meta)
          return;
        const metaSchema = this.opts.$data ? this.$dataMetaSchema(draft7MetaSchema, META_SUPPORT_DATA) : draft7MetaSchema;
        this.addMetaSchema(metaSchema, META_SCHEMA_ID, false);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv = Ajv2;
    module.exports = exports = Ajv2;
    module.exports.Ajv = Ajv2;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv2;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// node_modules/ajv-formats/dist/formats.js
var require_formats = __commonJS({
  "node_modules/ajv-formats/dist/formats.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.formatNames = exports.fastFormats = exports.fullFormats = void 0;
    function fmtDef(validate, compare) {
      return { validate, compare };
    }
    exports.fullFormats = {
      // date: http://tools.ietf.org/html/rfc3339#section-5.6
      date: fmtDef(date, compareDate),
      // date-time: http://tools.ietf.org/html/rfc3339#section-5.6
      time: fmtDef(getTime(true), compareTime),
      "date-time": fmtDef(getDateTime(true), compareDateTime),
      "iso-time": fmtDef(getTime(), compareIsoTime),
      "iso-date-time": fmtDef(getDateTime(), compareIsoDateTime),
      // duration: https://tools.ietf.org/html/rfc3339#appendix-A
      duration: /^P(?!$)((\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?|(\d+W)?)$/,
      uri,
      "uri-reference": /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
      // uri-template: https://tools.ietf.org/html/rfc6570
      "uri-template": /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
      // For the source: https://gist.github.com/dperini/729294
      // For test cases: https://mathiasbynens.be/demo/url-regex
      url: /^(?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)(?:\.(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu,
      email: /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
      hostname: /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
      // optimized https://www.safaribooksonline.com/library/view/regular-expressions-cookbook/9780596802837/ch07s16.html
      ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
      ipv6: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i,
      regex,
      // uuid: http://tools.ietf.org/html/rfc4122
      uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
      // JSON-pointer: https://tools.ietf.org/html/rfc6901
      // uri fragment: https://tools.ietf.org/html/rfc3986#appendix-A
      "json-pointer": /^(?:\/(?:[^~/]|~0|~1)*)*$/,
      "json-pointer-uri-fragment": /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i,
      // relative JSON-pointer: http://tools.ietf.org/html/draft-luff-relative-json-pointer-00
      "relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/,
      // the following formats are used by the openapi specification: https://spec.openapis.org/oas/v3.0.0#data-types
      // byte: https://github.com/miguelmota/is-base64
      byte,
      // signed 32 bit integer
      int32: { type: "number", validate: validateInt32 },
      // signed 64 bit integer
      int64: { type: "number", validate: validateInt64 },
      // C-type float
      float: { type: "number", validate: validateNumber },
      // C-type double
      double: { type: "number", validate: validateNumber },
      // hint to the UI to hide input strings
      password: true,
      // unchecked string payload
      binary: true
    };
    exports.fastFormats = {
      ...exports.fullFormats,
      date: fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d$/, compareDate),
      time: fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareTime),
      "date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, compareDateTime),
      "iso-time": fmtDef(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoTime),
      "iso-date-time": fmtDef(/^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, compareIsoDateTime),
      // uri: https://github.com/mafintosh/is-my-json-valid/blob/master/formats.js
      uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
      "uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
      // email (sources from jsen validator):
      // http://stackoverflow.com/questions/201323/using-a-regular-expression-to-validate-an-email-address#answer-8829363
      // http://www.w3.org/TR/html5/forms.html#valid-e-mail-address (search for 'wilful violation')
      email: /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i
    };
    exports.formatNames = Object.keys(exports.fullFormats);
    function isLeapYear(year) {
      return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }
    var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
    var DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    function date(str) {
      const matches2 = DATE.exec(str);
      if (!matches2)
        return false;
      const year = +matches2[1];
      const month = +matches2[2];
      const day = +matches2[3];
      return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
    }
    function compareDate(d1, d2) {
      if (!(d1 && d2))
        return void 0;
      if (d1 > d2)
        return 1;
      if (d1 < d2)
        return -1;
      return 0;
    }
    var TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
    function getTime(strictTimeZone) {
      return function time(str) {
        const matches2 = TIME.exec(str);
        if (!matches2)
          return false;
        const hr = +matches2[1];
        const min = +matches2[2];
        const sec = +matches2[3];
        const tz = matches2[4];
        const tzSign = matches2[5] === "-" ? -1 : 1;
        const tzH = +(matches2[6] || 0);
        const tzM = +(matches2[7] || 0);
        if (tzH > 23 || tzM > 59 || strictTimeZone && !tz)
          return false;
        if (hr <= 23 && min <= 59 && sec < 60)
          return true;
        const utcMin = min - tzM * tzSign;
        const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
        return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
      };
    }
    function compareTime(s1, s2) {
      if (!(s1 && s2))
        return void 0;
      const t1 = (/* @__PURE__ */ new Date("2020-01-01T" + s1)).valueOf();
      const t2 = (/* @__PURE__ */ new Date("2020-01-01T" + s2)).valueOf();
      if (!(t1 && t2))
        return void 0;
      return t1 - t2;
    }
    function compareIsoTime(t1, t2) {
      if (!(t1 && t2))
        return void 0;
      const a1 = TIME.exec(t1);
      const a2 = TIME.exec(t2);
      if (!(a1 && a2))
        return void 0;
      t1 = a1[1] + a1[2] + a1[3];
      t2 = a2[1] + a2[2] + a2[3];
      if (t1 > t2)
        return 1;
      if (t1 < t2)
        return -1;
      return 0;
    }
    var DATE_TIME_SEPARATOR = /t|\s/i;
    function getDateTime(strictTimeZone) {
      const time = getTime(strictTimeZone);
      return function date_time(str) {
        const dateTime = str.split(DATE_TIME_SEPARATOR);
        return dateTime.length === 2 && date(dateTime[0]) && time(dateTime[1]);
      };
    }
    function compareDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const d1 = new Date(dt1).valueOf();
      const d2 = new Date(dt2).valueOf();
      if (!(d1 && d2))
        return void 0;
      return d1 - d2;
    }
    function compareIsoDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return void 0;
      const [d1, t1] = dt1.split(DATE_TIME_SEPARATOR);
      const [d2, t2] = dt2.split(DATE_TIME_SEPARATOR);
      const res = compareDate(d1, d2);
      if (res === void 0)
        return void 0;
      return res || compareTime(t1, t2);
    }
    var NOT_URI_FRAGMENT = /\/|:/;
    var URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
    function uri(str) {
      return NOT_URI_FRAGMENT.test(str) && URI.test(str);
    }
    var BYTE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
    function byte(str) {
      BYTE.lastIndex = 0;
      return BYTE.test(str);
    }
    var MIN_INT32 = -(2 ** 31);
    var MAX_INT32 = 2 ** 31 - 1;
    function validateInt32(value) {
      return Number.isInteger(value) && value <= MAX_INT32 && value >= MIN_INT32;
    }
    function validateInt64(value) {
      return Number.isInteger(value);
    }
    function validateNumber() {
      return true;
    }
    var Z_ANCHOR = /[^\\]\\Z/;
    function regex(str) {
      if (Z_ANCHOR.test(str))
        return false;
      try {
        new RegExp(str);
        return true;
      } catch (e) {
        return false;
      }
    }
  }
});

// node_modules/ajv-formats/dist/limit.js
var require_limit = __commonJS({
  "node_modules/ajv-formats/dist/limit.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.formatLimitDefinition = void 0;
    var ajv_1 = require_ajv();
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      formatMaximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      formatMinimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      formatExclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      formatExclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`should be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    exports.formatLimitDefinition = {
      keyword: Object.keys(KWDs),
      type: "string",
      schemaType: "string",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, schemaCode, keyword, it } = cxt;
        const { opts, self } = it;
        if (!opts.validateFormats)
          return;
        const fCxt = new ajv_1.KeywordCxt(it, self.RULES.all.format.definition, "format");
        if (fCxt.$data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self.formats,
            code: opts.code.formats
          });
          const fmt = gen.const("fmt", (0, codegen_1._)`${fmts}[${fCxt.schemaCode}]`);
          cxt.fail$data((0, codegen_1.or)((0, codegen_1._)`typeof ${fmt} != "object"`, (0, codegen_1._)`${fmt} instanceof RegExp`, (0, codegen_1._)`typeof ${fmt}.compare != "function"`, compareCode(fmt)));
        }
        function validateFormat() {
          const format = fCxt.schema;
          const fmtDef = self.formats[format];
          if (!fmtDef || fmtDef === true)
            return;
          if (typeof fmtDef != "object" || fmtDef instanceof RegExp || typeof fmtDef.compare != "function") {
            throw new Error(`"${keyword}": format "${format}" does not define "compare" function`);
          }
          const fmt = gen.scopeValue("formats", {
            key: format,
            ref: fmtDef,
            code: opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(format)}` : void 0
          });
          cxt.fail$data(compareCode(fmt));
        }
        function compareCode(fmt) {
          return (0, codegen_1._)`${fmt}.compare(${data}, ${schemaCode}) ${KWDs[keyword].fail} 0`;
        }
      },
      dependencies: ["format"]
    };
    var formatLimitPlugin = (ajv) => {
      ajv.addKeyword(exports.formatLimitDefinition);
      return ajv;
    };
    exports.default = formatLimitPlugin;
  }
});

// node_modules/ajv-formats/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/ajv-formats/dist/index.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var formats_1 = require_formats();
    var limit_1 = require_limit();
    var codegen_1 = require_codegen();
    var fullName = new codegen_1.Name("fullFormats");
    var fastName = new codegen_1.Name("fastFormats");
    var formatsPlugin = (ajv, opts = { keywords: true }) => {
      if (Array.isArray(opts)) {
        addFormats2(ajv, opts, formats_1.fullFormats, fullName);
        return ajv;
      }
      const [formats, exportName] = opts.mode === "fast" ? [formats_1.fastFormats, fastName] : [formats_1.fullFormats, fullName];
      const list = opts.formats || formats_1.formatNames;
      addFormats2(ajv, list, formats, exportName);
      if (opts.keywords)
        (0, limit_1.default)(ajv);
      return ajv;
    };
    formatsPlugin.get = (name, mode = "full") => {
      const formats = mode === "fast" ? formats_1.fastFormats : formats_1.fullFormats;
      const f = formats[name];
      if (!f)
        throw new Error(`Unknown format "${name}"`);
      return f;
    };
    function addFormats2(ajv, list, fs, exportName) {
      var _a;
      var _b;
      (_a = (_b = ajv.opts.code).formats) !== null && _a !== void 0 ? _a : _b.formats = (0, codegen_1._)`require("ajv-formats/dist/formats").${exportName}`;
      for (const f of list)
        ajv.addFormat(f, fs[f]);
    }
    module.exports = exports = formatsPlugin;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = formatsPlugin;
  }
});

// scripts/artifact-validator/parser.mjs
var import_yaml = __toESM(require_dist(), 1);

// src/core/human-plan-layout.mjs
var REQUIRED_HEADINGS = Object.freeze([
  "Quick decision",
  "Details",
  "Agent and machine contract (authoritative)"
]);
var H2 = /^##[ \t]+([^\r\n]+?)[ \t]*$/gm;
var H3 = /^###[ \t]+([^\r\n]+?)[ \t]*$/gm;
var ROOT_FENCE = /^```yaml artifact-envelope[ \t]*$/gm;
var NEXT_STEP = /^###[ \t]+Next step[ \t]*$/gm;
var DETAIL_SECTIONS = Object.freeze([
  ["Outcome and approach", ["Outcome", "Approach and rationale"]],
  ["Scope and boundaries", ["In scope", "Non-goals", "Constraints"]],
  ["Verification, risks, and recovery", ["Acceptance and verification", "Risks and trade-offs", "Unknowns and recovery"]]
]);
function matches(source, expression) {
  expression.lastIndex = 0;
  return [...source.matchAll(expression)];
}
function inspectHumanFirstPlanLayout(source) {
  const text = String(source ?? "").replace(/\r\n/g, "\n");
  const failures = [];
  const fences = matches(text, ROOT_FENCE);
  if (fences.length !== 1) {
    failures.push(`native Plan requires exactly one yaml artifact-envelope in the final agent and machine layer; observed ${fences.length}`);
    return { ok: false, failures };
  }
  const prefix = text.slice(0, fences[0].index);
  const headings = matches(prefix, H2);
  const observed = headings.map((match) => match[1].trim());
  if (JSON.stringify(observed) !== JSON.stringify(REQUIRED_HEADINGS)) {
    failures.push(`native Plan requires exactly these ordered H2 layers before the Root: ${REQUIRED_HEADINGS.join(" -> ")}`);
    return { ok: false, failures };
  }
  if (prefix.slice(0, headings[0].index).trim()) {
    failures.push("native Plan must start with Quick decision before other presentation prose");
  }
  const sectionBody = (index, end) => prefix.slice(headings[index].index + headings[index][0].length, end).trim();
  const quickDecision = sectionBody(0, headings[1].index);
  const details = sectionBody(1, headings[2].index);
  const agentContractIntroduction = sectionBody(2, prefix.length);
  if (!quickDecision) failures.push("Quick decision must contain a human decision summary");
  if (!details) failures.push("Details must contain the human deep dive");
  if (!agentContractIntroduction) failures.push("Agent and machine contract must explain that the exact Root below is authoritative");
  if (agentContractIntroduction && !/(?:human layers|sections above)[\s\S]*(?:projections|oversight)[\s\S]*exact Root[\s\S]*(?:only|sole)[\s\S]*authorit/i.test(agentContractIntroduction)) {
    failures.push("Agent and machine contract must identify the human layers as oversight projections and the exact Root as the only implementation authority");
  }
  const detailH3 = matches(details, H3);
  const detailH3Names = detailH3.map((match) => match[1].trim());
  if (JSON.stringify(detailH3Names) !== JSON.stringify(DETAIL_SECTIONS.map(([name]) => name))) {
    failures.push(`Details requires exactly these ordered H3 sections: ${DETAIL_SECTIONS.map(([name]) => name).join(" -> ")}`);
  } else {
    DETAIL_SECTIONS.forEach(([, labels], index) => {
      const start = detailH3[index].index + detailH3[index][0].length;
      const end = detailH3[index + 1]?.index ?? details.length;
      const body = details.slice(start, end);
      for (const label of labels) {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (!new RegExp(`^-[ \\t]+${escaped}:[ \\t]+\\S.*$`, "m").test(body)) {
          failures.push(`Details coverage requires a non-empty - ${label}: value line`);
        }
      }
    });
  }
  const agentH3 = matches(agentContractIntroduction, H3);
  const agentH3Names = agentH3.map((match) => match[1].trim());
  if (JSON.stringify(agentH3Names) !== JSON.stringify(["Completion handoff"])) {
    failures.push("Agent and machine contract requires exactly one ### Completion handoff before the Root");
  } else {
    const handoff = agentContractIntroduction.slice(agentH3[0].index + agentH3[0][0].length).trim();
    const orderedTokens = ["`Quick decision`", "`Details`", "`Agent and machine contract`"];
    const positions = orderedTokens.map((token) => handoff.indexOf(token));
    const ordered = positions.every((position) => position >= 0) && positions.every((position, index) => index === 0 || position > positions[index - 1]);
    const complete = /\bImplement Plan\b/i.test(handoff) && ordered && /Human:[\s\S]*(?:\/review-work|\$review-work)/i.test(handoff) && /changed paths/i.test(handoff) && /Check commands\/directories\/observations/i.test(handoff) && /failures\/uncertainty/i.test(handoff) && /(?:do not|never) claim[\s\S]*Evidence[\s\S]*Review[\s\S]*Learning/i.test(handoff);
    if (!complete) failures.push("Completion handoff must carry the three-layer implementation reply, exact implementation observations, fresh human Review action, and no Evidence/Review/Learning claim");
  }
  const allNextSteps = matches(prefix, NEXT_STEP);
  const quickNextSteps = matches(quickDecision, NEXT_STEP);
  if (allNextSteps.length !== 1) {
    failures.push(`Quick decision requires exactly one ### Next step section across all human layers; observed ${allNextSteps.length}`);
  } else if (quickNextSteps.length !== 1) {
    failures.push("the only ### Next step section must be inside Quick decision");
  }
  return { ok: failures.length === 0, failures };
}

// scripts/artifact-validator/parser.mjs
function yamlObject(source, label, failures) {
  const document = (0, import_yaml.parseDocument)(source, { prettyErrors: false, uniqueKeys: true });
  for (const error of document.errors) failures.push(`${label}: invalid YAML: ${error.message}`);
  if (document.errors.length > 0) return null;
  const value = document.toJS();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    failures.push(`${label} must be a YAML object`);
    return null;
  }
  return value;
}
function parsePlanContainer(text, wrapper, failures, normalizations = []) {
  const source = String(text);
  const match = source.match(/(?:^|\n)# ([^\r\n]+)\r?\n[\s\S]*?```yaml artifact-envelope\r?\n([\s\S]*?)\r?\n```(?:\r?\n|$)/);
  if (!match) {
    failures.push("native plan must contain one H1 and a later yaml artifact-envelope");
    return null;
  }
  const offset = match.index + (match[0].startsWith("\n") ? 1 : 0);
  const presentation = source.slice(offset).replace(/^# [^\r\n]+\r?\n/, "");
  const layout = inspectHumanFirstPlanLayout(presentation);
  if (!layout.ok) {
    failures.push(...layout.failures);
    return null;
  }
  const fields = yamlObject(match[2], "artifact envelope", failures);
  if (!fields) return null;
  if (fields.artifact !== "work-plan") failures.push("native plan containers may contain only work-plan");
  if (offset > 0) normalizations.push("ignored Cursor progress text before native plan");
  return { fields, body: source.slice(match.index + match[0].length), wrapper, container: "cursor-plan", title: match[1], normalizations };
}
function parseArtifact(text, failures = [], normalizations = []) {
  const source = String(text);
  const candidates = [];
  const expression = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/gm;
  for (const match2 of source.matchAll(expression)) {
    const probeFailures = [];
    const fields2 = yamlObject(match2[1], "frontmatter", probeFailures);
    if (!fields2) continue;
    const workflow = typeof fields2.artifact === "string" || ["name", "overview", "todos", "isProject"].some((field) => field in fields2);
    if (workflow) candidates.push({ match: match2, fields: fields2 });
  }
  const envelopes = [];
  const envelopeExpression = /```yaml(?: artifact-envelope)?\r?\n([\s\S]*?)\r?\n```(?:\r?\n|$)/g;
  for (const match2 of source.matchAll(envelopeExpression)) {
    const probeFailures = [];
    const fields2 = yamlObject(match2[1], "artifact envelope", probeFailures);
    if (fields2?.artifact) envelopes.push({ match: match2, fields: fields2 });
  }
  if (candidates.length === 0) {
    if (envelopes.length > 1) {
      failures.push("response contains multiple workflow artifact candidates");
      return null;
    }
    if (envelopes.length === 1) {
      const [{ match: match2, fields: fields2 }] = envelopes;
      normalizations.push("normalized fenced Workflow artifact to chat artifact");
      if (match2.index > 0) normalizations.push("ignored Cursor progress preamble");
      return { fields: fields2, body: source.slice(match2.index + match2[0].length), wrapper: null, container: "normalized-envelope", normalizations };
    }
    failures.push("response is missing workflow YAML frontmatter");
    return null;
  }
  if (candidates.length > 1) {
    failures.push("response contains multiple workflow artifact candidates");
    return null;
  }
  const [{ match, fields }] = candidates;
  if (typeof fields.artifact === "string" && envelopes.length > 0) {
    failures.push("response contains multiple workflow artifact candidates");
    return null;
  }
  if (match.index > 0) normalizations.push("ignored Cursor progress preamble");
  if (typeof fields.artifact === "string") return { fields, body: source.slice(match.index + match[0].length), wrapper: null, container: "chat-artifact", normalizations };
  if (["name", "overview", "todos", "isProject"].some((field) => field in fields)) return parsePlanContainer(source.slice(match.index + match[0].length), fields, failures, normalizations);
  failures.push("artifact type is missing");
  return null;
}
function artifactYamlCandidate(text) {
  const source = String(text);
  const candidates = [];
  const frontmatterExpression = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/gm;
  for (const match of source.matchAll(frontmatterExpression)) {
    const failures = [];
    const fields = yamlObject(match[1], "frontmatter", failures);
    if (failures.length === 0 && typeof fields?.artifact === "string") candidates.push({ match, yaml: match[1] });
  }
  const envelopeExpression = /```yaml(?: artifact-envelope)?\r?\n([\s\S]*?)\r?\n```(?:\r?\n|$)/g;
  for (const match of source.matchAll(envelopeExpression)) {
    const failures = [];
    const fields = yamlObject(match[1], "artifact envelope", failures);
    if (failures.length === 0 && typeof fields?.artifact === "string") candidates.push({ match, yaml: match[1] });
  }
  if (candidates.length !== 1) throw new Error(`artifact text requires exactly one Workflow YAML candidate; observed ${candidates.length}`);
  const candidate = candidates[0];
  const start = candidate.match.index + candidate.match[0].indexOf(candidate.yaml);
  return { source, yaml: candidate.yaml, start, end: start + candidate.yaml.length };
}
function opaqueExtensionsFromArtifactText(text) {
  const candidate = artifactYamlCandidate(text);
  const document = (0, import_yaml.parseDocument)(candidate.yaml, { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) throw new Error(`invalid Workflow YAML: ${document.errors.map((error) => error.message).join("; ")}`);
  const fields = document.toJS();
  return Object.hasOwn(fields, "extensions") ? { present: true, value: structuredClone(fields.extensions) } : { present: false, value: null };
}
function replaceOpaqueExtensions(text, opaque = { present: false, value: null }) {
  const candidate = artifactYamlCandidate(text);
  const document = (0, import_yaml.parseDocument)(candidate.yaml, { prettyErrors: false, uniqueKeys: true });
  if (document.errors.length > 0) throw new Error(`invalid Workflow YAML: ${document.errors.map((error) => error.message).join("; ")}`);
  document.delete("extensions");
  if (opaque.present === true) {
    if (!opaque.value || typeof opaque.value !== "object" || Array.isArray(opaque.value)) throw new Error("opaque extensions must be an object");
    document.set("extensions", structuredClone(opaque.value));
  }
  const yaml = document.toString({ lineWidth: 0 }).trimEnd();
  return `${candidate.source.slice(0, candidate.start)}${yaml}${candidate.source.slice(candidate.end)}`;
}

// scripts/validate-artifact.source.mjs
import { existsSync as existsSync2, readFileSync as readFileSync2, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join as join2, resolve as resolve2 } from "node:path";
import { fileURLToPath } from "node:url";

// scripts/artifact-validator/evidence.mjs
function leanEvidenceData(fields) {
  const objectiveStatus = fields.status === "complete" ? "achieved" : fields.status === "blocked" ? "blocked" : "partially-achieved";
  const outcomes = (fields.affected_objectives ?? []).map((id) => ({
    "Objective ID": id,
    Status: objectiveStatus,
    Evidence: `lean evidence ${fields.id}`
  }));
  const checks = (fields.check_evidence ?? []).map((entry) => ({
    "Check ID": entry.check_id,
    "Observed Result": entry.observed,
    Status: entry.grade === "verified" ? "passed" : entry.grade === "failed" ? "failed" : "skipped",
    "Prerequisite fingerprints": ""
  }));
  return {
    results: [],
    outcomes,
    outcomeRows: new Map(outcomes.map((row) => [row["Objective ID"], row])),
    changes: (fields.changed_paths ?? []).map((path) => ({ "Path or Symbol": path, Change: "declared in lean evidence", "Objective Coverage": (fields.affected_objectives ?? []).join(", ") })),
    snapshot: null,
    checks,
    checkRows: new Map(checks.map((row) => [row["Check ID"], row])),
    steps: []
  };
}
function evidenceHasKnownFailure(fields) {
  return fields.status === "blocked" || fields.overall_grade === "failed" || (fields.check_evidence ?? []).some((entry) => entry.grade === "failed");
}

// scripts/artifact-validator/lineage.mjs
function linearChain(items, predecessorField, label, failures) {
  if (items.length === 0) return [];
  const byId = new Map(items.map((item) => [item.fields.id, item]));
  const starts = items.filter((item) => !item.fields[predecessorField]);
  if (starts.length !== 1) failures.push(`${label}: chain requires exactly one initial artifact`);
  const successors = /* @__PURE__ */ new Map();
  for (const item of items) {
    const predecessor = item.fields[predecessorField];
    if (!predecessor) continue;
    if (!byId.has(predecessor)) failures.push(`${item.label}: missing predecessor ${predecessor}`);
    const list = successors.get(predecessor) ?? [];
    list.push(item);
    successors.set(predecessor, list);
  }
  for (const [id, list] of successors) if (list.length > 1) failures.push(`${label}: chain branches after ${id}`);
  const ordered = [];
  const seen = /* @__PURE__ */ new Set();
  let cursor = starts[0];
  while (cursor && !seen.has(cursor.fields.id)) {
    seen.add(cursor.fields.id);
    ordered.push(cursor);
    cursor = successors.get(cursor.fields.id)?.[0];
  }
  if (cursor || ordered.length !== items.length) failures.push(`${label}: chain is cyclic or disconnected`);
  return ordered;
}
function lineageTips(items, predecessorField) {
  const referenced = new Set(items.map((item) => item.fields[predecessorField]).filter(Boolean));
  return items.filter((item) => !referenced.has(item.fields.id));
}

// scripts/artifact-validator/schema.mjs
var import_ajv = __toESM(require_ajv(), 1);
var import_ajv_formats = __toESM(require_dist2(), 1);
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
function formatAjv(error) {
  const location = error.instancePath || "/";
  return error.keyword === "additionalProperties" ? `${location}: additional property ${error.params.additionalProperty}` : `${location}: ${error.message}`;
}
function schemaFor(root, artifact) {
  return join(resolve(root), "schemas", "artifacts", `${artifact}.schema.json`);
}
function validateArtifactSchema(root, parsed, failures) {
  const path = schemaFor(root, parsed.fields.artifact);
  if (!existsSync(path)) {
    failures.push(`unsupported artifact type: ${parsed.fields.artifact}`);
    return null;
  }
  const ajv = new import_ajv.default({ allErrors: true, strict: false });
  (0, import_ajv_formats.default)(ajv);
  if (parsed.wrapper) {
    const wrapperSchema = JSON.parse(readFileSync(join(resolve(root), "schemas", "cursor-plan-wrapper.schema.json"), "utf8"));
    const validateWrapper = ajv.compile(wrapperSchema);
    if (!validateWrapper(parsed.wrapper)) failures.push(...validateWrapper.errors.map((error) => `Cursor wrapper ${formatAjv(error)}`));
  }
  const schema = JSON.parse(readFileSync(path, "utf8"));
  const validate = ajv.compile(schema);
  if (!validate(parsed.fields)) failures.push(...validate.errors.map(formatAjv));
  return schema;
}

// src/core/manual-attestation.mjs
var import_yaml2 = __toESM(require_dist(), 1);
var PLAN_CLOSEOUT_ATTESTATION = Object.freeze({
  schema: 1,
  kind: "plan-closeout",
  action: "delivery-closeout"
});
var LEGACY_PLAN_CLOSEOUT_ATTESTATION = Object.freeze({
  schema: 1,
  kind: "plan-closeout",
  action: "workflow_closeout"
});
var CLOSEOUT_INPUT_PHASES = Object.freeze([
  "implementation",
  "correction",
  "review-recovery"
]);
var CLOSEOUT_INPUT_FIELDS = Object.freeze([
  "schema",
  "kind",
  "phase",
  "root_plan_id",
  "strategy_revision",
  "changed_paths",
  "check_evidence",
  "summary"
]);
var CHECK_EVIDENCE_FIELDS = Object.freeze([
  "check_id",
  "feature_id",
  "grade",
  "surface",
  "method",
  "expected",
  "observed",
  "repetitions",
  "limitations"
]);

// scripts/validate-artifact.source.mjs
var scriptDirectory = dirname(fileURLToPath(import.meta.url));
var defaultRoot = dirname(scriptDirectory);
var knownArtifacts = /* @__PURE__ */ new Set([
  "work-plan",
  "delivery-evidence",
  "work-review"
]);
var riskRank = Object.freeze({ low: 1, medium: 2, high: 3 });
var assuranceRank = Object.freeze({ lean: 1, standard: 2, deep: 3 });
var hardTriggers = /* @__PURE__ */ new Set([
  "security-secrets",
  "destructive-data",
  "regulated-or-monetary",
  "breaking-external-contract",
  "irreversible-external-effect",
  "no-recovery-path",
  "broad-runtime-impact",
  "material-uncertainty"
]);
var objectivePattern = /\bOBJ-[1-9][0-9]*\b/g;
var fixPattern = /\bFIX-[1-9][0-9]*\b/g;
var checkPattern = /\bCHECK-[1-9][0-9]*\b/g;
var slicePattern = /\bSLICE-[1-9][0-9]*\b/g;
var learningPattern = /\bLRN-[A-Za-z0-9][A-Za-z0-9-]*\b/g;
var requiredScopeCategories = ["required", "permitted", "prohibited"];
var baselineKinds = ["repository", "head", "dirty-files", "known-failures", "targets-and-prerequisites"];
var sectionAliases = Object.freeze({
  Intent: ["intent", "goal", "intent contract"],
  Acceptance: ["acceptance", "acceptance outcomes", "success criteria"],
  Boundaries: ["boundaries", "authority", "authority envelope"],
  Risks: ["risks", "risk summary"],
  "Intent and decisions": ["intent", "intent readiness", "intent and decisions"],
  Objectives: ["objectives", "goals"],
  "Evidence and baseline": ["baseline", "baseline evidence", "evidence and baseline"],
  "Scope and targets": ["scope", "targets", "scope and targets"],
  "Execution steps": ["steps", "implementation steps", "execution steps"],
  Verification: ["verification", "root checks", "planned checks"],
  "Operational readiness": ["operations", "operational readiness"],
  "Risk and closeout": ["risk", "assurance", "risk and closeout"],
  Summary: ["summary", "delivery summary"],
  "Subject results": ["subject results", "fix results"],
  "Objective outcomes": ["objective outcomes", "delivered objectives"],
  Changes: ["changes", "changed targets"],
  "Repository snapshot": ["snapshot", "repository snapshot"],
  Checks: ["checks", "check results", "verification results"],
  "Idempotency and resume": ["resume", "execution state", "idempotency and resume"],
  Deviations: ["deviations"],
  "Operational evidence": ["operational evidence", "operations evidence"],
  "Residual risks": ["residual risks", "remaining risks"],
  Assessment: ["assessment", "result", "review result"],
  "Evidence coverage": ["coverage", "evidence coverage"],
  Findings: ["findings", "issues"],
  "Next action": ["next action", "recommendation"],
  "Correction plan": ["correction", "correction plan"]
});
var headerAliases = Object.freeze({
  "objective id": ["objective", "objective id"],
  "check id": ["check", "check id"],
  "step id": ["step", "step id"],
  "observed result": ["observed", "observed result", "actual result"],
  "expected result": ["expected", "expected result", "pass condition"],
  "command or inspection": ["command", "inspection", "command or inspection", "execution"],
  "working directory": ["working directory", "cwd"],
  "cost class": ["cost", "cost class"],
  "evidence class": ["evidence class", "verification owner", "evidence owner"],
  prerequisites: ["prerequisite", "prerequisites", "dependencies"],
  "prerequisite fingerprints": ["prerequisite fingerprints", "dependency fingerprints", "reuse evidence"],
  "relevant fingerprints": ["relevant fingerprints", "dependency fingerprints", "reuse evidence"],
  "finding key": ["finding", "finding key"],
  "learning id": ["learning", "learning id", "candidate", "candidate id"]
});
var optionalTableCells = /* @__PURE__ */ new Set(["prerequisite fingerprints", "relevant fingerprints"]);
var tables = Object.freeze({
  readiness: ["Readiness item", "Resolution", "Evidence"],
  decisions: ["Decision ID", "Choice", "Rationale", "Rejected alternative", "Source"],
  objectives: ["Objective ID", "Observable outcome", "Acceptance evidence"],
  baseline: ["Evidence ID", "Kind", "Observation", "Source"],
  scope: ["Category", "Targets", "Boundary"],
  steps: ["Step ID", "Objectives", "Targets", "Required outcome", "Implementation latitude", "Completion probe", "Check IDs", "Deviation action"],
  verification: ["Check ID", "Objectives", "Working Directory", "Command or Inspection", "Expected Result", "Required", "Cost Class", "Prerequisites"],
  verificationWithClass: ["Check ID", "Objectives", "Working Directory", "Command or Inspection", "Expected Result", "Required", "Evidence Class", "Cost Class", "Prerequisites"],
  productRequirements: ["Requirement ID", "Need", "Actor", "Observable outcome", "Non-goal or constraint"],
  systemImpact: ["Surface", "Current state", "Required change", "Invariant", "Evidence"],
  programDesign: ["Design ID", "Responsibility", "Interfaces", "Invariants", "Failure handling"],
  slices: ["Slice ID", "Objectives", "Dependencies", "Targets", "Observable outcome", "Check IDs", "Human review"],
  operational: ["Concern", "Requirement", "Repository proof"],
  assuranceFactors: ["Factor", "Score", "Evidence"],
  controls: ["Control ID", "Control", "Objective or failure mode", "Expected benefit", "Cost class", "Decision", "Rationale"],
  results: ["Objective ID", "Result", "Evidence"],
  changes: ["Path or Symbol", "Change", "Objective Coverage"],
  objectiveOutcomes: ["Objective ID", "Status", "Evidence"],
  snapshot: ["Snapshot ID", "HEAD", "Working tree", "Changed paths", "Relevant fingerprints", "Known failures"],
  checks: ["Check ID", "Observed Result", "Status", "Prerequisite fingerprints"],
  resume: ["Step ID", "State", "Completion probe", "Evidence"],
  deviations: ["Deviation ID", "Scope", "Approval", "Outcome", "Evidence"],
  operationalEvidence: ["Concern", "Plan requirement", "Repository proof", "Status"],
  coverage: ["Kind", "Inspected", "Reused", "Result", "Evidence"],
  findings: ["Finding key", "Severity", "Objectives", "Checks", "Evidence", "Reasoning"],
  correctionMeta: ["Correction ID", "Root Plan", "Source Review", "Base Evidence", "Predecessor Correction", "Risk"],
  fixes: ["FIX ID", "Finding keys", "Root Objectives", "Root Checks", "Required outcome", "Evidence"],
  correctionSteps: ["Step ID", "FIX IDs", "Targets", "Required outcome", "Implementation latitude", "Completion probe", "Check IDs", "Deviation action"],
  correctionChecks: ["Check ID", "FIX IDs", "Working Directory", "Command or Inspection", "Expected Result", "Required", "Cost Class", "Prerequisites"],
  learningCandidates: ["Learning ID", "Finding keys", "Reusable guidance", "Candidate targets", "Confirmation evidence"]
});
var assuranceFactors = Object.freeze([
  ["Failure impact", 0, 3],
  ["Irreversibility", 0, 2],
  ["Uncertainty", 0, 2],
  ["Evidence weakness", 0, 2],
  ["Change surface", 0, 1]
]);
var costRank = Object.freeze({ cheap: 1, standard: 2, expensive: 3 });
var readinessItems = [
  "Goal",
  "Actor",
  "Outcome",
  "Non-goals",
  "Constraints",
  "Repository boundary",
  "Acceptance evidence",
  "Critical assumptions",
  "Operational impact",
  "Review risk",
  "Material open decisions"
];
function unique(values) {
  return [...new Set(values)];
}
function ids(value, pattern) {
  return unique(String(value ?? "").match(pattern) ?? []);
}
function sameSet(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}
function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
function maskFences(text) {
  let fence = null;
  return String(text).split(/(?<=\n)/).map((line) => {
    if (!fence) {
      const marker = line.match(/^[ \t]*(`{3,}|~{3,})/);
      if (!marker) return line;
      fence = { char: marker[1][0], size: marker[1].length };
      return line.replace(/[^\r\n]/g, " ");
    }
    const masked = line.replace(/[^\r\n]/g, " ");
    if (new RegExp(`^[ \\t]*${fence.char}{${fence.size},}[ \\t]*(?:\\r?\\n)?$`).test(line)) fence = null;
    return masked;
  }).join("");
}
function sectionMap(body, required, failures, normalizations = []) {
  const structural = maskFences(body);
  const matches2 = [...structural.matchAll(/^## ([^\r\n]+)$/gm)];
  const actual = matches2.map((match) => match[1].trim());
  const sections = /* @__PURE__ */ new Map();
  matches2.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = matches2[index + 1]?.index ?? body.length;
    const content = body.slice(start, end).trim();
    const actualName = match[1].trim();
    const normalizedActual = normalizedHeader(actualName);
    const canonical = Object.entries(sectionAliases).find(
      ([name, aliases]) => normalizedHeader(name) === normalizedActual || aliases.some((alias) => normalizedHeader(alias) === normalizedActual)
    )?.[0] ?? actualName;
    if (canonical !== actualName) normalizations.push(`normalized section ${actualName} to ${canonical}`);
    if (sections.has(canonical)) failures.push(`${canonical}: duplicate section`);
    sections.set(canonical, content);
  });
  for (const name of required) if (!sections.has(name)) failures.push(`missing required section ${name}`);
  const requiredInOutput = actual.filter((name) => required.some((candidate) => candidate.toLowerCase() === name.toLowerCase()));
  if (requiredInOutput.map((name) => name.toLowerCase()).join("\n") !== required.filter((name) => sections.has(name)).map((name) => name.toLowerCase()).join("\n")) normalizations.push("normalized Markdown section order");
  return sections;
}
function trimTrailingNotes(body, required, normalizations) {
  const structural = maskFences(body);
  const separators = [...structural.matchAll(/^---[ \t]*$/gm)];
  for (const separator of separators.toReversed()) {
    const prefix = body.slice(0, separator.index);
    const headings = new Set([...maskFences(prefix).matchAll(/^## ([^\r\n]+)$/gm)].map((match) => match[1].trim().toLowerCase()));
    if (required.every((name) => headings.has(name.toLowerCase()))) {
      normalizations.push("ignored trailing explanation after workflow artifact");
      return prefix.trimEnd();
    }
  }
  return body;
}
function cells(line) {
  const parsed = [];
  let current = "";
  let escaped = false;
  for (const char of String(line).trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "|") {
      parsed.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  parsed.push(current.trim());
  if (parsed[0] === "") parsed.shift();
  if (parsed.at(-1) === "") parsed.pop();
  return parsed;
}
function markdownTables(content) {
  const lines = maskFences(content).split(/\r?\n/);
  const found = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const headers = cells(lines[index]);
    const separator = cells(lines[index + 1]);
    if (headers.length < 2 || separator.length !== headers.length || !separator.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    const rows = [];
    index += 2;
    while (index < lines.length && lines[index].includes("|")) {
      const row = cells(lines[index]);
      if (row.length !== headers.length) break;
      rows.push(Object.fromEntries(headers.map((header, cellIndex) => [header, row[cellIndex]])));
      index += 1;
    }
    index -= 1;
    found.push({ headers, rows });
  }
  return found;
}
function normalizedHeader(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tableMatching(content, headers) {
  const resolveHeader = (candidate, expected) => {
    const normalizedCandidate = normalizedHeader(candidate);
    const normalizedExpected = normalizedHeader(expected);
    return normalizedCandidate === normalizedExpected || (headerAliases[normalizedExpected] ?? []).some((alias) => normalizedHeader(alias) === normalizedCandidate);
  };
  return markdownTables(content).flatMap((candidate) => {
    const mapping = /* @__PURE__ */ new Map();
    for (const expected of headers) {
      const matches2 = candidate.headers.filter((actual) => resolveHeader(actual, expected));
      if (matches2.length !== 1) return [];
      mapping.set(expected, matches2[0]);
    }
    return [{
      headers,
      rows: candidate.rows.map((row) => Object.fromEntries(headers.map((expected) => [expected, row[mapping.get(expected)]]))),
      normalized: candidate.headers.length !== headers.length || candidate.headers.some((header, index) => header !== headers[index])
    }];
  });
}
function tableRows(content, headers) {
  return tableMatching(content, headers)[0]?.rows ?? [];
}
function subsection(content, name) {
  const structural = maskFences(content);
  const matches2 = [...structural.matchAll(/^### ([^\r\n]+)$/gm)];
  const index = matches2.findIndex((match) => normalizedHeader(match[1]) === normalizedHeader(name));
  if (index < 0) return "";
  const start = matches2[index].index + matches2[index][0].length;
  const end = matches2[index + 1]?.index ?? content.length;
  return content.slice(start, end).trim();
}
function verificationSectionContent(artifact) {
  const sections = artifact?.sections instanceof Map ? artifact.sections : /* @__PURE__ */ new Map();
  const topLevel = sections.get("Verification") ?? "";
  if (tableRows(topLevel, tables.verification).length > 0 || tableRows(topLevel, tables.verificationWithClass).length > 0) {
    return topLevel;
  }
  if ((artifact?.fields?.schema ?? 0) >= 5) {
    const nested = subsection(sections.get("Acceptance") ?? "", "Verification");
    if (nested.trim()) return nested;
  }
  return "";
}
function noneLike(value) {
  return /^(?:none\.?|no (?:findings|changes|deviations|candidates|correction|open decisions)\.?)$/i.test(String(value).trim());
}
function hasStandaloneNone(content) {
  return String(content).split(/\r?\n/).some((line) => /^(?:\*\*[^*\r\n]+:\*\*\s*)?None\.?$/i.test(line.trim()));
}
function requireTable(sections, sectionName, headers, failures, { allowNone = false, optional = false, normalizations = [] } = {}) {
  const content = sections.get(sectionName) ?? "";
  if (allowNone && noneLike(content)) {
    if (content.trim() !== "None.") normalizations.push(`${sectionName}: normalized empty marker`);
    return { headers, rows: [], none: true };
  }
  if (optional && !content.trim()) return { headers, rows: [], none: true };
  const matches2 = tableMatching(content, headers);
  if (allowNone && matches2.length === 0 && hasStandaloneNone(content)) {
    normalizations.push(`${sectionName}: materialized embedded empty marker`);
    return { headers, rows: [], none: true };
  }
  if (matches2.length !== 1) {
    failures.push(`${sectionName}: requires exactly one table [${headers.join(", ")}]`);
    return { headers, rows: [] };
  }
  if (matches2[0].normalized) normalizations.push(`${sectionName}: normalized table column order or casing`);
  if (matches2[0].rows.length === 0) failures.push(`${sectionName}: required table must contain a row`);
  matches2[0].rows.forEach((row, index) => {
    for (const header of headers) if (!row[header] && !optionalTableCells.has(normalizedHeader(header))) failures.push(`${sectionName}: row ${index + 1} has empty ${header}`);
  });
  return matches2[0];
}
function placeholder(value) {
  return /<(?:placeholder|replace[-_ ]?me|insert[-_ ][^>\r\n]+|[^>\r\n]*\.{3}[^>\r\n]*)>/i.test(String(value)) || /\b(?:TBD|TODO|UNKNOWN)\b/.test(String(value));
}
function rejectPlaceholders(parsed, schema, sections, failures) {
  if (!["ready", "complete", "current", "active"].includes(parsed.fields.status)) return;
  for (const field of schema.required ?? []) if (placeholder(parsed.fields[field])) failures.push(`frontmatter ${field} contains a placeholder`);
  for (const [name, content] of sections) if (placeholder(content)) failures.push(`${name}: contains a placeholder`);
}
function exactIdSet(rows, column, pattern, label, failures) {
  const values = rows.map((row) => row[column]);
  for (const value of values) if (!new RegExp(`^(?:${pattern.source})$`).test(value)) failures.push(`${label}: invalid ID ${value}`);
  if (new Set(values).size !== values.length) failures.push(`${label}: IDs must be unique`);
  return new Set(values);
}
function targetTokens(value) {
  const inline = [...String(value).matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  return (inline.length ? inline : String(value).split(",")).map((entry) => entry.trim().replace(/^\.\//, "")).filter(Boolean);
}
function targetMatches(value, scope) {
  const target = value.replace(/^\.\//, "");
  const candidate = scope.replace(/^\.\//, "");
  if (/^all other (?:files|paths|targets)$/i.test(candidate)) return true;
  if (target === candidate || target.startsWith(`${candidate}/`) || target.startsWith(`${candidate}#`) || target.startsWith(`${candidate}:`)) return true;
  if (!candidate.includes("*")) return false;
  const expression = candidate.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("**", "\xA7\xA7").replaceAll("*", "[^/]*").replaceAll("\xA7\xA7", ".*");
  return new RegExp(`^${expression}$`).test(target);
}
function authorityTargetState(target, authority = {}) {
  const allowed = (authority.allowed_roots ?? []).some((scope) => targetMatches(target, scope));
  const protectedTarget = (authority.protected_paths ?? []).some((scope) => targetMatches(target, scope));
  const approvalRequired = (authority.approval_required_paths ?? []).some((scope) => targetMatches(target, scope));
  return { allowed, protected: protectedTarget, approval_required: approvalRequired };
}
function acceptanceChangeTargets(parsed) {
  const sources = [
    ...parsed.fields.acceptance ?? [],
    parsed.sections?.get("Acceptance") ?? ""
  ];
  const pathLike = (value) => !/^(?:https?:|[A-Za-z][A-Za-z0-9+.-]*:)/.test(value) && !value.startsWith("/") && value !== ".." && !value.startsWith("../") && !/\s/.test(value) && (value.includes("/") || /^\.[A-Za-z0-9_-]/.test(value) || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+$/.test(value));
  const targets = [];
  for (const source of sources) {
    for (const match of String(source).matchAll(/`([^`]+)`/g)) {
      const target = match[1].trim().replace(/^\.\//, "");
      if (pathLike(target)) targets.push(target);
    }
  }
  return unique(targets);
}
function issue(code, message, details = {}) {
  return { code, message, ...details };
}
function fingerprintMap(value) {
  const entries = String(value ?? "").split(/;\s*/).flatMap((entry) => {
    const match = entry.match(/^`?([^=`]+?)`?=(.+)$/);
    if (!match) return [];
    const path = match[1].trim().replace(/^\.\//, "");
    if (!path || ["index", "status"].includes(path)) return [];
    return [[path, match[2].trim()]];
  });
  return new Map(entries);
}
function validateCostOrder(rows, column, label, parsed) {
  let previous = 0;
  for (const row of rows) {
    const current = costRank[row[column]] ?? 99;
    if (current < previous) {
      parsed.normalizations.push(`${label}: normalized economic check order cheap, standard, expensive`);
      return;
    }
    previous = current;
  }
}
function derivedAssurance(score, triggers) {
  if ((triggers ?? []).length > 0) return "deep";
  if (score <= 3) return "lean";
  if (score <= 6) return "standard";
  return "deep";
}
function planData(artifact) {
  if (artifact.fields.schema >= 4) {
    const objectives2 = artifact.fields.acceptance.map((outcome, index) => ({
      "Objective ID": `OBJ-${index + 1}`,
      "Observable outcome": outcome,
      "Acceptance evidence": outcome
    }));
    const verificationContent2 = verificationSectionContent(artifact);
    const declaredChecks = tableRows(verificationContent2, tables.verification);
    const declaredWithClass = tableRows(verificationContent2, tables.verificationWithClass);
    const checks2 = declaredChecks.length > 0 ? declaredChecks : objectives2.map((objective, index) => ({
      "Check ID": `CHECK-${index + 1}`,
      Objectives: objective["Objective ID"],
      "Working Directory": "repository root",
      "Command or Inspection": "verification-profile",
      "Expected Result": objective["Observable outcome"],
      Required: "yes",
      "Cost Class": "standard",
      Prerequisites: artifact.fields.authority.allowed_roots.join(", ")
    }));
    const evidenceClasses = declaredWithClass.length > 0 ? new Map(declaredWithClass.map((row) => [row["Check ID"], row["Evidence Class"]])) : new Map(checks2.map((row) => [row["Check ID"], "human-review-required"]));
    const objectiveIds = objectives2.map((row) => row["Objective ID"]);
    const objectiveDependencies2 = new Map(objectiveIds.map((id) => [id, /* @__PURE__ */ new Set()]));
    for (const check of checks2) {
      for (const objective of ids(check.Objectives, objectivePattern)) {
        for (const target of targetTokens(check.Prerequisites)) objectiveDependencies2.get(objective)?.add(target);
      }
    }
    return {
      objectives: new Set(objectiveIds),
      checks: new Set(checks2.map((row) => row["Check ID"])),
      checkRows: new Map(checks2.map((row) => [row["Check ID"], row])),
      evidenceClasses,
      slices: [{
        "Slice ID": "SLICE-1",
        Objectives: objectiveIds.join(", "),
        Dependencies: "None.",
        Targets: artifact.fields.authority.allowed_roots.join(", "),
        "Observable outcome": artifact.fields.goal,
        "Check IDs": checks2.map((row) => row["Check ID"]).join(", "),
        "Human review": "no"
      }],
      steps: /* @__PURE__ */ new Set(["STEP-1"]),
      requiredChecks: new Set(checks2.filter((row) => row.Required === "yes").map((row) => row["Check ID"])),
      allowedTargets: [...artifact.fields.authority.allowed_roots],
      prohibitedTargets: [...artifact.fields.authority.protected_paths, ...artifact.fields.authority.approval_required_paths],
      objectiveDependencies: objectiveDependencies2
    };
  }
  const objectives = tableRows(artifact.sections.get("Objectives") ?? "", tables.objectives);
  const verificationContent = verificationSectionContent(artifact);
  const checks = tableRows(verificationContent, tables.verification);
  const steps = tableRows(artifact.sections.get("Execution steps") ?? "", tables.steps);
  const scope = tableRows(artifact.sections.get("Scope and targets") ?? "", tables.scope);
  const verificationWithClass = tableRows(verificationContent, tables.verificationWithClass);
  const slices = tableRows(subsection(artifact.sections.get("Execution steps") ?? "", "Vertical slices"), tables.slices);
  const objectiveDependencies = new Map(objectives.map((row) => [row["Objective ID"], /* @__PURE__ */ new Set()]));
  for (const check of checks) for (const objective of ids(check.Objectives, objectivePattern)) for (const target of targetTokens(check.Prerequisites)) objectiveDependencies.get(objective)?.add(target);
  return {
    objectives: new Set(objectives.map((row) => row["Objective ID"])),
    checks: new Set(checks.map((row) => row["Check ID"])),
    checkRows: new Map(checks.map((row) => [row["Check ID"], row])),
    evidenceClasses: new Map(verificationWithClass.map((row) => [row["Check ID"], row["Evidence Class"]])),
    slices,
    steps: new Set(steps.map((row) => row["Step ID"])),
    requiredChecks: new Set(checks.filter((row) => row.Required === "yes").map((row) => row["Check ID"])),
    allowedTargets: scope.filter((row) => ["required", "permitted", "incidental"].includes(row.Category)).flatMap((row) => targetTokens(row.Targets)),
    prohibitedTargets: scope.filter((row) => row.Category === "prohibited").flatMap((row) => targetTokens(row.Targets)),
    objectiveDependencies
  };
}
function validatePlanV4(parsed, sections, failures) {
  for (const section of ["Intent", "Acceptance", "Boundaries", "Risks"]) {
    if (!(sections.get(section) ?? "").trim()) failures.push(`${section}: section must not be empty`);
  }
  const expectedLevel = { manual: "lean", supervised: "controlled", autonomous: "certified" }[parsed.fields.profile_max];
  if (parsed.fields.contract_level !== expectedLevel) failures.push(`contract_level must be ${expectedLevel} for ${parsed.fields.profile_max}`);
  if (parsed.fields.status === "ready" && parsed.fields.intent_ready !== true) failures.push("ready work-plan requires intent_ready true");
  if (parsed.fields.profile_max === "autonomous" && (parsed.fields.hard_triggers ?? []).length > 0) failures.push("hard-trigger work cannot be autonomous");
  const authority = parsed.fields.authority ?? {};
  for (const path of [...authority.allowed_roots ?? [], ...authority.protected_paths ?? [], ...authority.approval_required_paths ?? []]) {
    if (path.startsWith("/") || path === ".." || path.startsWith("../")) failures.push(`authority path must remain repository-relative: ${path}`);
  }
  if (["controlled", "certified"].includes(parsed.fields.contract_level)) {
    for (const field of ["max_active_minutes", "max_total_tokens", "max_cost_usd"]) if (!Number.isFinite(authority[field]) || authority[field] <= 0) failures.push(`controlled authority requires ${field}`);
  }
  const data = planData(parsed);
  const verification = tableRows(verificationSectionContent(parsed), tables.verificationWithClass);
  for (const row of verification) {
    if (!/^CHECK-[1-9][0-9]*$/.test(row["Check ID"])) failures.push(`Verification: invalid Check ID ${row["Check ID"]}`);
    if (!/^(?:yes|no)$/.test(row.Required)) failures.push(`Verification: ${row["Check ID"]} Required must be yes|no`);
    if (!/^(?:machine-verifiable|human-review-required|human-approval-required)$/.test(row["Evidence Class"])) failures.push(`Verification: ${row["Check ID"]} invalid Evidence Class`);
  }
  if (verification.length === 0) parsed.normalizations.push("synthesized strategy checks from acceptance outcomes");
  if (data.objectives.size !== parsed.fields.acceptance.length) failures.push("acceptance outcomes must map one-to-one to objectives");
  if (parsed.wrapper) {
    const todos = parsed.wrapper.todos ?? [];
    if (todos.length === 0) failures.push("native Plan must include at least one implementation todo");
  }
}
function evidenceData(artifact) {
  if (artifact.fields.schema === 5 && artifact.fields.evidence_mode === "lean") return leanEvidenceData(artifact.fields);
  const results = tableRows(artifact.sections.get("Subject results") ?? "", tables.results);
  const outcomes = tableRows(artifact.sections.get("Objective outcomes") ?? "", tables.objectiveOutcomes);
  const changes = tableRows(artifact.sections.get("Changes") ?? "", tables.changes);
  const snapshot = tableRows(artifact.sections.get("Repository snapshot") ?? "", tables.snapshot)[0];
  const checks = tableRows(artifact.sections.get("Checks") ?? "", tables.checks);
  const steps = tableRows(artifact.sections.get("Idempotency and resume") ?? "", tables.resume);
  return {
    results,
    outcomes,
    outcomeRows: new Map(outcomes.map((row) => [row["Objective ID"], row])),
    changes,
    snapshot,
    checks,
    checkRows: new Map(checks.map((row) => [row["Check ID"], row])),
    steps
  };
}
function reviewData(artifact) {
  const coverage = tableRows(artifact.sections.get("Evidence coverage") ?? "", tables.coverage);
  const findings = tableRows(artifact.sections.get("Findings") ?? "", tables.findings);
  return { coverage, findings };
}
function validatePlan(parsed, sections, failures) {
  const options = { normalizations: parsed.normalizations };
  const readiness = requireTable(sections, "Intent and decisions", tables.readiness, failures, options);
  const readinessByKey = new Map(readiness.rows.map((row) => [normalizedHeader(row["Readiness item"]), row]));
  for (const item of readinessItems) if (!readinessByKey.has(normalizedHeader(item))) failures.push(`Intent Readiness is missing ${item}`);
  if (readiness.rows.map((row) => normalizedHeader(row["Readiness item"])).join("\n") !== readinessItems.map(normalizedHeader).join("\n")) parsed.normalizations.push("normalized Intent Readiness row order");
  const openDecisions = readinessByKey.get(normalizedHeader("Material open decisions"));
  if (parsed.fields.status === "ready" && !noneLike(openDecisions?.Resolution)) failures.push("ready work-plan requires no material open decisions");
  const decisions = requireTable(sections, "Intent and decisions", tables.decisions, failures, { allowNone: true, normalizations: parsed.normalizations });
  const decisionIds = exactIdSet(decisions.rows, "Decision ID", /DEC-[1-9][0-9]*/, "Decisions", failures);
  const objectives = requireTable(sections, "Objectives", tables.objectives, failures, options);
  const objectiveIds = exactIdSet(objectives.rows, "Objective ID", /OBJ-[1-9][0-9]*/, "Objectives", failures);
  const baseline = requireTable(sections, "Evidence and baseline", tables.baseline, failures, options);
  const kinds = new Set(baseline.rows.map((row) => row.Kind));
  if (!kinds.has("repository")) failures.push("baseline requires repository evidence");
  for (const kind of kinds) if (!baselineKinds.includes(kind)) parsed.normalizations.push(`baseline uses additional Kind ${kind}`);
  const scope = requireTable(sections, "Scope and targets", tables.scope, failures, options);
  const categories = new Set(scope.rows.map((row) => row.Category));
  for (const category of requiredScopeCategories) if (!categories.has(category)) failures.push(`scope is missing required category ${category}`);
  for (const category of categories) if (![...requiredScopeCategories, "incidental"].includes(category)) failures.push(`scope has unsupported category ${category}`);
  if (!categories.has("incidental")) parsed.normalizations.push("Scope and targets: omitted incidental scope materialized as empty");
  const steps = requireTable(sections, "Execution steps", tables.steps, failures, options);
  exactIdSet(steps.rows, "Step ID", /STEP-[1-9][0-9]*/, "Execution steps", failures);
  const coveredObjectives = /* @__PURE__ */ new Set();
  const referencedChecks = /* @__PURE__ */ new Set();
  for (const row of steps.rows) {
    for (const objective of ids(row.Objectives, objectivePattern)) {
      coveredObjectives.add(objective);
      if (!objectiveIds.has(objective)) failures.push(`Execution steps: unknown ${objective}`);
    }
    const rowChecks = ids(row["Check IDs"], checkPattern);
    if (rowChecks.length === 0) failures.push(`Execution steps: ${row["Step ID"]} has no Check ID`);
    rowChecks.forEach((check) => referencedChecks.add(check));
    if (!/PROBE-[1-9][0-9]*:/.test(row["Completion probe"])) failures.push(`Execution steps: ${row["Step ID"]} needs a PROBE-N completion probe`);
  }
  if (!sameSet(coveredObjectives, objectiveIds)) failures.push("Execution steps must cover every objective");
  const checks = requireTable(sections, "Verification", tables.verification, failures, options);
  const classifiedChecks = tableRows(sections.get("Verification") ?? "", tables.verificationWithClass);
  const classifications = new Map(classifiedChecks.map((row) => [row["Check ID"], row["Evidence Class"]]));
  const checkIds = exactIdSet(checks.rows, "Check ID", /CHECK-[1-9][0-9]*/, "Verification", failures);
  for (const row of checks.rows) {
    const covered = ids(row.Objectives, objectivePattern);
    if (covered.length === 0) failures.push(`Verification: ${row["Check ID"]} has no objective`);
    covered.forEach((objective) => {
      if (!objectiveIds.has(objective)) failures.push(`Verification: unknown ${objective}`);
    });
    if (!/^(?:yes|no)$/.test(row.Required)) failures.push(`Verification: ${row["Check ID"]} Required must be yes|no`);
    if (!/^(?:cheap|standard|expensive)$/.test(row["Cost Class"])) failures.push(`Verification: ${row["Check ID"]} invalid Cost Class`);
    if (targetTokens(row.Prerequisites).length === 0) failures.push(`Verification: ${row["Check ID"]} needs concrete Prerequisites`);
    const evidenceClass = classifications.get(row["Check ID"]);
    if (!evidenceClass) failures.push(`Verification: ${row["Check ID"]} needs Evidence Class`);
    if (evidenceClass && !/^(?:machine-verifiable|human-review-required|human-approval-required)$/.test(evidenceClass)) failures.push(`Verification: ${row["Check ID"]} invalid Evidence Class`);
  }
  validateCostOrder(checks.rows, "Cost Class", "Verification", parsed);
  for (const check of referencedChecks) if (!checkIds.has(check)) failures.push(`Execution steps reference unknown ${check}`);
  for (const objective of objectiveIds) if (!checks.rows.some((row) => ids(row.Objectives, objectivePattern).includes(objective))) failures.push(`${objective} has no verification Check`);
  for (const objective of objectiveIds) if (!checks.rows.some((row) => row.Required === "yes" && ids(row.Objectives, objectivePattern).includes(objective))) failures.push(`${objective} has no required verification Check`);
  const intentContent = sections.get("Intent and decisions") ?? "";
  const scopeContent = sections.get("Scope and targets") ?? "";
  const executionContent = sections.get("Execution steps") ?? "";
  const productRequirements = tableRows(subsection(intentContent, "Product requirements"), tables.productRequirements);
  const systemImpact = tableRows(subsection(scopeContent, "System architecture"), tables.systemImpact);
  const programDesign = tableRows(subsection(scopeContent, "Program design"), tables.programDesign);
  const slices = tableRows(subsection(executionContent, "Vertical slices"), tables.slices);
  if (["compact", "full"].includes(parsed.fields.design_depth)) {
    if (systemImpact.length === 0) failures.push(`${parsed.fields.design_depth} design requires a System architecture table`);
    if (slices.length === 0) failures.push(`${parsed.fields.design_depth} design requires a Vertical slices table`);
  }
  if (parsed.fields.design_depth === "full") {
    if (productRequirements.length === 0) failures.push("full design requires a Product requirements table");
    if (programDesign.length === 0) failures.push("full design requires a Program design table");
  }
  const sliceIds = exactIdSet(slices, "Slice ID", /SLICE-[1-9][0-9]*/, "Vertical slices", failures);
  for (const row of slices) {
    const sliceObjectives = ids(row.Objectives, objectivePattern);
    if (sliceObjectives.length === 0) failures.push(`Vertical slices: ${row["Slice ID"]} has no objective`);
    for (const objective of sliceObjectives) if (!objectiveIds.has(objective)) failures.push(`Vertical slices: ${row["Slice ID"]} references unknown ${objective}`);
    for (const dependency of ids(row.Dependencies, slicePattern)) if (!sliceIds.has(dependency)) failures.push(`Vertical slices: ${row["Slice ID"]} references unknown ${dependency}`);
    const sliceChecks = ids(row["Check IDs"], checkPattern);
    if (sliceChecks.length === 0) failures.push(`Vertical slices: ${row["Slice ID"]} has no Check ID`);
    for (const check of sliceChecks) if (!checkIds.has(check)) failures.push(`Vertical slices: ${row["Slice ID"]} references unknown ${check}`);
    if (!/^(?:yes|no)$/.test(row["Human review"])) failures.push(`Vertical slices: ${row["Slice ID"]} Human review must be yes|no`);
  }
  if (parsed.fields.automation_profile_max !== "manual") {
    const bounds = parsed.fields.automation_bounds;
    if (!bounds) failures.push(`${parsed.fields.automation_profile_max} plan requires automation_bounds`);
    else {
      const scopedTargets = scope.rows.filter((row) => ["required", "permitted"].includes(row.Category)).flatMap((row) => targetTokens(row.Targets));
      for (const target of bounds.allowed_targets ?? []) if (!scopedTargets.some((scopeTarget) => targetMatches(target, scopeTarget))) failures.push(`automation_bounds target ${target} is outside required/permitted scope`);
      if ((riskRank[bounds.max_risk] ?? 0) > (riskRank[parsed.fields.risk] ?? 0)) failures.push("automation_bounds max_risk cannot exceed root risk");
    }
  }
  const operational = requireTable(sections, "Operational readiness", tables.operational, failures, options);
  const concerns = new Set(operational.rows.map((row) => row.Concern));
  const notApplicable = concerns.has("Not applicable");
  if (parsed.fields.runtime_relevant === true) {
    if (notApplicable) failures.push("runtime-relevant work cannot use Not applicable operational readiness");
    for (const concern of ["Observable signal", "Failure condition", "Recovery or rollback"]) {
      if (!concerns.has(concern)) failures.push(`Operational readiness: missing ${concern}`);
    }
  } else if (operational.rows.length !== 1 || operational.rows[0]?.Concern !== "Not applicable") {
    failures.push("non-runtime work requires exactly one Not applicable operational readiness row");
  }
  const factors = requireTable(sections, "Risk and closeout", tables.assuranceFactors, failures, options);
  const factorNames = new Set(factors.rows.map((row) => normalizedHeader(row.Factor)));
  for (const [factor] of assuranceFactors) if (!factorNames.has(normalizedHeader(factor))) failures.push(`Assurance factors are missing ${factor}`);
  if (factors.rows.map((row) => normalizedHeader(row.Factor)).join("\n") !== assuranceFactors.map(([factor]) => normalizedHeader(factor)).join("\n")) parsed.normalizations.push("normalized assurance factor order");
  let score = 0;
  for (const [factor, minimum, maximum] of assuranceFactors) {
    const raw = factors.rows.find((row) => normalizedHeader(row.Factor) === normalizedHeader(factor))?.Score;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < minimum || value > maximum) failures.push(`Assurance factor ${factor} Score must be an integer ${minimum}..${maximum}`);
    else score += value;
  }
  if (score !== parsed.fields.assurance_score) failures.push(`assurance_score must equal computed score ${score}`);
  const triggers = parsed.fields.hard_triggers ?? [];
  for (const trigger of triggers) if (!hardTriggers.has(trigger)) failures.push(`unknown hard trigger ${trigger}`);
  const derived = derivedAssurance(score, triggers);
  const selectedRank = assuranceRank[parsed.fields.assurance_profile] ?? 0;
  const derivedRank = assuranceRank[derived];
  if (parsed.fields.assurance_override === "none" && parsed.fields.assurance_profile !== derived) failures.push(`assurance_profile must equal derived profile ${derived} without override`);
  if (parsed.fields.assurance_override === "raised" && selectedRank <= derivedRank) failures.push("raised assurance override must select a higher profile than derived");
  if (parsed.fields.assurance_override === "lowered") {
    if (triggers.length > 0) failures.push("hard-trigger assurance cannot be lowered");
    if (selectedRank >= derivedRank) failures.push("lowered assurance override must select a lower profile than derived");
    const decision = decisions.rows.find((row) => row["Decision ID"] === parsed.fields.assurance_override_decision_id);
    if (!decisionIds.has(parsed.fields.assurance_override_decision_id) || !/\bHuman (?:decision|approval)\b/i.test(decision?.Source ?? "")) failures.push("lowered assurance requires a human-sourced decision");
  }
  const controls = requireTable(sections, "Risk and closeout", tables.controls, failures, { allowNone: true, normalizations: parsed.normalizations });
  exactIdSet(controls.rows, "Control ID", /CTRL-[1-9][0-9]*/, "Pareto controls", failures);
  for (const row of controls.rows) {
    if (!/^(?:cheap|standard|expensive)$/.test(row["Cost class"])) failures.push(`Pareto controls: ${row["Control ID"]} invalid Cost class`);
    if (!/^(?:include|defer)$/.test(row.Decision)) failures.push(`Pareto controls: ${row["Control ID"]} Decision must be include|defer`);
    const matchedTriggers = triggers.filter((trigger) => row["Objective or failure mode"].includes(trigger));
    if (matchedTriggers.length > 0 && row.Decision !== "include") failures.push(`Pareto controls: hard-trigger control ${row["Control ID"]} cannot be deferred`);
  }
  for (const trigger of triggers) if (!controls.rows.some((row) => row["Objective or failure mode"].includes(trigger) && row.Decision === "include")) failures.push(`hard trigger ${trigger} requires an included Pareto control`);
  if (parsed.fields.status === "ready" && parsed.fields.intent_ready !== true) failures.push("ready work-plan requires intent_ready true");
  if (parsed.wrapper) {
    const todos = parsed.wrapper.todos ?? [];
    const stepIds = steps.rows.map((row) => row["Step ID"]);
    for (const stepId of stepIds) if (!todos.some((todo) => String(todo.content).includes(stepId))) failures.push(`native todos must project ${stepId}`);
    const final = String(todos.at(-1)?.content ?? "");
    if (!/verify|check|evidence|snapshot/i.test(final)) failures.push("final native todo must verify or evidence the implemented result");
    if (/\/correct-work/.test(final)) failures.push("initial native implementation must not require another Workflow command");
  }
}
function resultIdPattern(fields) {
  return String(fields.subject_id ?? "").startsWith("cp-") ? fixPattern : objectivePattern;
}
function validateEvidenceGrades(parsed, failures) {
  const entries = parsed.fields.check_evidence ?? [];
  const grades = entries.map((entry) => entry.grade);
  const patched = entries.filter((entry) => (entry.baseline_or_patched ?? (parsed.fields.evidence_mode === "lean" ? "patched" : null)) === "patched");
  if (grades.includes("failed") && parsed.fields.overall_grade !== "failed") failures.push("failed check evidence requires overall_grade failed");
  if (parsed.fields.status === "complete" && parsed.fields.overall_grade !== "verified") failures.push("complete evidence requires overall_grade verified");
  if (parsed.fields.status === "complete" && patched.some((entry) => entry.grade !== "verified")) failures.push("complete evidence requires every patched Check grade verified");
  if (parsed.fields.status === "provisional" && !["supported", "partial", "unavailable"].includes(parsed.fields.overall_grade)) failures.push("provisional evidence requires supported, partial, or unavailable grade");
  if (parsed.fields.status !== "blocked" && grades.includes("failed")) failures.push("failed check evidence must be blocked");
}
function validateLeanEvidence(parsed, sections, failures) {
  if (!(sections.get("Summary") ?? "").trim()) failures.push("Summary: section must not be empty");
  const affected = new Set(parsed.fields.affected_objectives ?? []);
  const reusedObjectives = new Set(parsed.fields.reused_objectives ?? []);
  for (const id of affected) if (reusedObjectives.has(id)) failures.push(`Objective ${id} cannot be both affected and reused`);
  const executed = new Set(parsed.fields.executed_checks ?? []);
  const reusedChecks = new Set(parsed.fields.reused_checks ?? []);
  for (const id of executed) if (reusedChecks.has(id)) failures.push(`Check ${id} cannot be both executed and reused`);
  const checkIds = (parsed.fields.check_evidence ?? []).map((entry) => entry.check_id);
  if (new Set(checkIds).size !== checkIds.length) failures.push("check_evidence Check IDs must be unique");
  if (!sameSet(new Set(checkIds), executed)) failures.push("check_evidence must exactly match executed_checks");
  for (const path of parsed.fields.changed_paths ?? []) {
    if (path.startsWith("/") || path === ".." || path.startsWith("../")) failures.push(`changed path must remain repository-relative: ${path}`);
  }
  validateEvidenceGrades(parsed, failures);
  if (!Object.hasOwn(parsed.fields, "strategy_revision")) parsed.normalizations.push("lean evidence: interpreted missing strategy_revision as 0");
  for (const entry of parsed.fields.check_evidence ?? []) {
    if (!Object.hasOwn(entry, "baseline_or_patched")) parsed.normalizations.push(`lean evidence: interpreted ${entry.check_id} baseline_or_patched as patched`);
  }
  parsed.effective = {
    strategyRevision: parsed.fields.strategy_revision ?? 0,
    checkEvidence: (parsed.fields.check_evidence ?? []).map((entry) => ({ baseline_or_patched: "patched", ...entry }))
  };
}
function validateEvidence(parsed, sections, failures) {
  if (parsed.fields.schema === 5 && parsed.fields.evidence_mode === "lean") {
    validateLeanEvidence(parsed, sections, failures);
    return;
  }
  const options = { normalizations: parsed.normalizations };
  const pattern = resultIdPattern(parsed.fields);
  const results = requireTable(sections, "Subject results", tables.results, failures, { optional: true, normalizations: parsed.normalizations });
  const resultIds = exactIdSet(results.rows, "Objective ID", pattern, "Subject results", failures);
  for (const row of results.rows) if (!/^(?:achieved|partially-achieved|not-achieved|blocked)$/.test(row.Result)) failures.push(`Subject results: ${row["Objective ID"]} invalid Result`);
  const outcomes = requireTable(sections, "Objective outcomes", tables.objectiveOutcomes, failures, options);
  const outcomeIds = exactIdSet(outcomes.rows, "Objective ID", /OBJ-[1-9][0-9]*/, "Objective outcomes", failures);
  if (!sameSet(outcomeIds, new Set(parsed.fields.affected_objectives ?? []))) failures.push("Objective outcomes must exactly match affected_objectives");
  for (const row of outcomes.rows) if (!/^(?:achieved|partially-achieved|not-achieved|blocked)$/.test(row.Status)) failures.push(`Objective outcomes: ${row["Objective ID"]} invalid Status`);
  const affected = new Set(parsed.fields.affected_objectives ?? []);
  const reusedObjectives = new Set(parsed.fields.reused_objectives ?? []);
  for (const id of affected) if (reusedObjectives.has(id)) failures.push(`Objective ${id} cannot be both affected and reused`);
  const executed = new Set(parsed.fields.executed_checks ?? []);
  const reusedChecks = new Set(parsed.fields.reused_checks ?? []);
  for (const id of executed) if (reusedChecks.has(id)) failures.push(`Check ${id} cannot be both executed and reused`);
  const changes = requireTable(sections, "Changes", tables.changes, failures, { allowNone: true, optional: true, normalizations: parsed.normalizations });
  const declaredChangedPaths = new Set(parsed.fields.changed_paths ?? []);
  const visibleChangedPaths = new Set(changes.rows.flatMap((row) => targetTokens(row["Path or Symbol"])));
  if (parsed.fields.schema === 5 && !sameSet(declaredChangedPaths, visibleChangedPaths)) failures.push("Changes table must exactly match changed_paths");
  for (const path of declaredChangedPaths) {
    if (path.startsWith("/") || path === ".." || path.startsWith("../")) failures.push(`changed path must remain repository-relative: ${path}`);
  }
  for (const row of changes.rows) {
    const covered = ids(row["Objective Coverage"], pattern);
    if (covered.length === 0) failures.push("Changes: every row must name a subject objective");
    covered.forEach((id) => {
      if (!(resultIds.size > 0 ? resultIds : outcomeIds).has(id)) failures.push(`Changes: unknown ${id}`);
    });
  }
  const snapshot = requireTable(sections, "Repository snapshot", tables.snapshot, failures, options);
  let snapshotFingerprints = /* @__PURE__ */ new Map();
  if (snapshot.rows.length === 1) {
    const row = snapshot.rows[0];
    parsed.fields.snapshot_id = row["Snapshot ID"];
    snapshotFingerprints = fingerprintMap(row["Relevant fingerprints"]);
  }
  const checks = requireTable(sections, "Checks", tables.checks, failures, options);
  const checkIds = exactIdSet(checks.rows, "Check ID", /CHECK-[1-9][0-9]*/, "Checks", failures);
  if (!sameSet(checkIds, executed)) failures.push("Checks table must exactly match executed_checks");
  for (const row of checks.rows) {
    if (!/^(?:passed|failed|blocked|skipped)$/.test(row.Status)) failures.push(`Checks: ${row["Check ID"]} invalid Status`);
    const prerequisites = fingerprintMap(row["Prerequisite fingerprints"]);
    for (const [path, hash] of prerequisites) if (snapshotFingerprints.get(path) !== hash) failures.push(`Checks: ${row["Check ID"]} prerequisite ${path} must match Repository snapshot`);
    if (row.Status === "blocked" && !/^blocked-by:CHECK-[1-9][0-9]*\b/.test(row["Observed Result"])) failures.push(`Checks: ${row["Check ID"]} blocked status needs blocked-by:CHECK-N evidence`);
  }
  if (parsed.fields.schema >= 4) {
    const entries = parsed.fields.check_evidence ?? [];
    const patched = new Map(entries.filter((entry) => entry.baseline_or_patched === "patched").map((entry) => [entry.check_id, entry]));
    for (const check of parsed.fields.executed_checks ?? []) if (!patched.has(check)) failures.push(`check_evidence requires patched evidence for ${check}`);
    validateEvidenceGrades(parsed, failures);
  }
  const resume = requireTable(sections, "Idempotency and resume", tables.resume, failures, { optional: true, normalizations: parsed.normalizations });
  exactIdSet(resume.rows, "Step ID", /STEP-[1-9][0-9]*/, "Idempotency and resume", failures);
  for (const row of resume.rows) {
    if (!/^(?:satisfied|pending|partial|conflicted)$/.test(row.State)) failures.push(`Idempotency and resume: ${row["Step ID"]} invalid State`);
    if (!/PROBE-[1-9][0-9]*:/.test(row["Completion probe"])) failures.push(`Idempotency and resume: ${row["Step ID"]} needs a PROBE-N completion probe`);
  }
  const deviations = requireTable(sections, "Deviations", tables.deviations, failures, { allowNone: true, optional: true, normalizations: parsed.normalizations });
  for (const row of deviations.rows) if (!/^DEV-[1-9][0-9]*$/.test(row["Deviation ID"])) failures.push(`Deviations: invalid ${row["Deviation ID"]}`);
  if (parsed.fields.status === "complete") {
    if (results.rows.some((row) => row.Result === "blocked")) failures.push("complete evidence cannot contain blocked subject results");
    if (checks.rows.some((row) => row.Status === "blocked")) failures.push("complete evidence cannot contain blocked Checks");
    if (resume.rows.some((row) => ["pending", "partial", "conflicted"].includes(row.State))) failures.push("complete evidence requires every step state satisfied");
  } else if (parsed.fields.status === "blocked" && !results.rows.some((row) => row.Result === "blocked") && !checks.rows.some((row) => row.Status === "blocked") && !/BLOCKER:\s*\S.{10,}/i.test(sections.get("Summary") ?? "")) {
    failures.push("blocked evidence requires blocked work or a concrete BLOCKER reason");
  }
  const operationalEvidence = (sections.get("Operational evidence") ?? "").trim();
  if (operationalEvidence && !/^not applicable\.?$/i.test(operationalEvidence)) requireTable(sections, "Operational evidence", tables.operationalEvidence, failures);
  if (/production (?:is|was) (?:healthy|successful|verified)/i.test(operationalEvidence)) failures.push("repository evidence must not claim observed production success");
}
function parseCorrection(parsed, sections, failures) {
  const content = sections.get("Correction plan") ?? "";
  if (parsed.fields.next_action !== "correct") {
    if (content.trim() && !noneLike(content)) failures.push("Correction plan is allowed only when next_action is correct");
    return null;
  }
  const headings = [...maskFences(content).matchAll(/^### (cp-[^\r\n]+)$/gm)].map((match) => match[1]);
  if (headings.length !== 1) failures.push("correct review must embed exactly one cp-* correction as an H3");
  if (headings.length === 1) {
    if (parsed.fields.correction_id !== headings[0]) failures.push("embedded correction ID conflicts with frontmatter");
  }
  const pseudo = /* @__PURE__ */ new Map([["Correction plan", content]]);
  const metadata = requireTable(pseudo, "Correction plan", tables.correctionMeta, failures, { normalizations: parsed.normalizations });
  const fixes = { rows: tableRows(content, tables.fixes) };
  const steps = { rows: tableRows(content, tables.correctionSteps) };
  const checks = { rows: tableRows(content, tables.correctionChecks) };
  if (fixes.rows.length === 0) failures.push("Correction plan requires a FIX table");
  if (steps.rows.length === 0) failures.push("Correction plan requires a step table");
  if (checks.rows.length === 0) failures.push("Correction plan requires a Check table");
  const declaredLearnings = Array.isArray(parsed.fields.learning_candidates) ? parsed.fields.learning_candidates : [];
  const pseudoLearning = /* @__PURE__ */ new Map([["Correction plan", content]]);
  const learnings = requireTable(pseudoLearning, "Correction plan", tables.learningCandidates, failures, { normalizations: parsed.normalizations });
  const learningIds = exactIdSet(learnings.rows, "Learning ID", learningPattern, "Correction learning", failures);
  if (!sameSet(learningIds, new Set(declaredLearnings))) failures.push("Correction learning table must exactly match learning_candidates");
  for (const row of learnings.rows) {
    const keys = String(row["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean);
    if (keys.length === 0 || keys.some((key) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key))) failures.push(`Learning ${row["Learning ID"]} needs valid source Finding keys`);
  }
  const fixIds = exactIdSet(fixes.rows, "FIX ID", /FIX-[1-9][0-9]*/, "Correction FIX", failures);
  exactIdSet(steps.rows, "Step ID", /STEP-[1-9][0-9]*/, "Correction steps", failures);
  const checkIds = exactIdSet(checks.rows, "Check ID", /CHECK-[1-9][0-9]*/, "Correction checks", failures);
  for (const row of fixes.rows) {
    const keys = String(row["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean);
    if (keys.length === 0 || keys.some((key) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key))) failures.push(`Correction ${row["FIX ID"]} needs valid source Finding keys`);
    if (ids(row["Root Objectives"], objectivePattern).length === 0) failures.push(`Correction ${row["FIX ID"]} needs root objectives`);
    if (ids(row["Root Checks"], checkPattern).length === 0) failures.push(`Correction ${row["FIX ID"]} needs root Checks`);
  }
  const coveredFixes = /* @__PURE__ */ new Set();
  for (const row of steps.rows) {
    ids(row["FIX IDs"], fixPattern).forEach((id) => coveredFixes.add(id));
    if (!/PROBE-[1-9][0-9]*:/.test(row["Completion probe"])) failures.push(`Correction ${row["Step ID"]} needs a PROBE-N completion probe`);
    ids(row["Check IDs"], checkPattern).forEach((id) => {
      if (!checkIds.has(id)) failures.push(`Correction step references unknown ${id}`);
    });
  }
  for (const fix of fixIds) if (!coveredFixes.has(fix)) failures.push(`Correction steps do not cover ${fix}`);
  for (const row of checks.rows) {
    if (!/^(?:yes|no)$/.test(row.Required)) failures.push(`Correction check ${row["Check ID"]} Required must be yes|no`);
    if (!/^(?:cheap|standard|expensive)$/.test(row["Cost Class"])) failures.push(`Correction check ${row["Check ID"]} invalid Cost Class`);
    if (targetTokens(row.Prerequisites).length === 0) failures.push(`Correction check ${row["Check ID"]} needs concrete Prerequisites`);
    ids(row["FIX IDs"], fixPattern).forEach((id) => {
      if (!fixIds.has(id)) failures.push(`Correction check references unknown ${id}`);
    });
  }
  validateCostOrder(checks.rows, "Cost Class", "Correction checks", parsed);
  return { id: headings[0], metadata: metadata.rows[0], fixes: fixes.rows, steps: steps.rows, checks: checks.rows, learnings: learnings.rows };
}
function validateCompactReview(parsed, sections, failures) {
  const options = { normalizations: parsed.normalizations };
  const assessment = sections.get("Assessment") ?? "";
  if (!assessment.toLowerCase().includes(String(parsed.fields.assessment).toLowerCase())) failures.push("Assessment section must state frontmatter assessment");
  const coverage = requireTable(sections, "Evidence coverage", tables.coverage, failures, { optional: true, normalizations: parsed.normalizations });
  const coverageByKind = /* @__PURE__ */ new Map();
  for (const row of coverage.rows) {
    const kind = normalizedHeader(row.Kind);
    const rows = coverageByKind.get(kind) ?? [];
    rows.push(row);
    coverageByKind.set(kind, rows);
  }
  const inspectedObjectives = new Set(parsed.fields.inspected_objectives ?? []);
  const reusedObjectives = new Set(parsed.fields.reused_objectives ?? []);
  const inspectedChecks = new Set(parsed.fields.inspected_checks ?? []);
  const reusedChecks = new Set(parsed.fields.reused_checks ?? []);
  for (const id of inspectedObjectives) if (reusedObjectives.has(id)) failures.push(`Objective ${id} cannot be both inspected and reused`);
  for (const id of inspectedChecks) if (reusedChecks.has(id)) failures.push(`Check ${id} cannot be both inspected and reused`);
  const coverageLists = [
    ["Objectives", "Inspected", inspectedObjectives, objectivePattern],
    ["Objectives", "Reused", reusedObjectives, objectivePattern],
    ["Checks", "Inspected", inspectedChecks, checkPattern],
    ["Checks", "Reused", reusedChecks, checkPattern]
  ];
  for (const [kind, column, expected, pattern] of coverageLists) {
    const row = coverageByKind.get(normalizedHeader(kind))?.[0];
    const visible = new Set(ids(row?.[column], pattern));
    if (!sameSet(visible, expected)) parsed.normalizations.push(`Evidence coverage: ${kind} ${column.toLowerCase()} summary derived from frontmatter`);
  }
  const findingContent = sections.get("Findings") ?? "";
  let findings = { rows: [], none: true };
  if (findingContent.trim()) findings = requireTable(sections, "Findings", tables.findings, failures, { allowNone: true, normalizations: parsed.normalizations });
  const keys = /* @__PURE__ */ new Set();
  for (const row of findings.rows) {
    const key = row["Finding key"];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) failures.push(`Findings: invalid Finding key ${key}`);
    if (keys.has(key)) failures.push(`Findings: duplicate Finding key ${key}`);
    keys.add(key);
    if (!/^(?:low|medium|high|critical)$/.test(row.Severity)) failures.push(`Findings: ${key} has invalid Severity`);
    if (ids(row.Objectives, objectivePattern).length === 0) failures.push(`Findings: ${key} needs root Objectives`);
    if (ids(row.Checks, checkPattern).length === 0) failures.push(`Findings: ${key} needs root Checks`);
  }
  const boundaryReview = parsed.fields.review_basis === "root-boundary";
  if (boundaryReview && findings.rows.length > 0) failures.push("root-boundary review cannot contain delivery findings");
  parsed.findings = findings.rows;
  const actualAuditors = new Set(parsed.fields.auditors_run ?? []);
  const auditorRow = coverageByKind.get(normalizedHeader("Auditors"))?.[0];
  const visibleAuditors = new Set(String(auditorRow?.Inspected ?? "").split(",").map((value) => value.trim()).filter((value) => value && !noneLike(value)));
  if (coverage.rows.length > 0 && !sameSet(visibleAuditors, actualAuditors)) parsed.normalizations.push("Evidence coverage: auditor summary derived from frontmatter");
  const routeRank = { inline: 1, targeted: 2, full: 3 };
  const decisiveBoundary = ["correct", "replan", "clarify"].includes(parsed.fields.next_action);
  const unresolvedHighFinding = findings.rows.some((row) => /^(?:high|critical)$/.test(row.Severity)) && !decisiveBoundary;
  let minimumRoute = actualAuditors.has("risk-auditor") || unresolvedHighFinding ? "full" : actualAuditors.has("delivery-auditor") || actualAuditors.has("work-design-auditor") ? "targeted" : "inline";
  if (routeRank[parsed.fields.review_route] < routeRank[minimumRoute]) failures.push(`review_route must be at least computed minimum ${minimumRoute}`);
  const requiredAuditors = parsed.fields.review_route === "inline" ? ["inline"] : parsed.fields.review_route === "full" ? ["inline", "delivery-auditor", "risk-auditor"] : ["inline"];
  const missingAuditors = requiredAuditors.filter((auditor) => !actualAuditors.has(auditor));
  missingAuditors.forEach((auditor) => failures.push(`${parsed.fields.review_route} review requires auditor ${auditor}`));
  const targetedSpecialists = ["delivery-auditor", "work-design-auditor"].filter((auditor) => actualAuditors.has(auditor));
  if (parsed.fields.review_route === "inline" && actualAuditors.size !== 1) failures.push("inline review permits only the inline auditor");
  if (parsed.fields.review_route === "targeted" && (targetedSpecialists.length !== 1 || actualAuditors.size !== 2 || actualAuditors.has("risk-auditor"))) {
    failures.push("targeted review requires inline plus exactly one delivery or design auditor");
  }
  if (parsed.fields.review_route === "full") {
    const permitted = /* @__PURE__ */ new Set(["inline", "delivery-auditor", "risk-auditor", "work-design-auditor"]);
    if ([...actualAuditors].some((auditor) => !permitted.has(auditor))) failures.push("full review contains an unsupported auditor");
  }
  const next = sections.get("Next action") ?? "";
  if (!next.toLowerCase().includes(String(parsed.fields.next_action).toLowerCase())) failures.push("Next action section must state frontmatter next_action");
  if (parsed.fields.assessment === "achieved") {
    if (parsed.fields.next_action !== "none") failures.push("achieved review requires next_action none");
    if (findings.rows.length > 0) failures.push("achieved review cannot contain findings");
    const snapshotRow = coverageByKind.get(normalizedHeader("Snapshot"))?.[0];
    if (coverage.rows.length > 0 && (normalizedHeader(snapshotRow?.Result) !== "consistent" || noneLike(snapshotRow?.Inspected))) failures.push("achieved review coverage contradicts current snapshot consistency");
  }
  if (parsed.fields.next_action === "none" && parsed.fields.assessment !== "achieved") failures.push("next_action none requires assessment achieved");
  if (parsed.fields.schema >= 4) {
    if (parsed.fields.delivery_status === "verified" && parsed.fields.assessment !== "achieved") failures.push("verified delivery requires achieved assessment");
    if (parsed.fields.delivery_status === "provisional" && parsed.fields.next_action !== "accept-provisional") failures.push("provisional delivery requires accept-provisional");
    if (parsed.fields.next_action === "accept-provisional" && parsed.fields.delivery_status !== "provisional") failures.push("accept-provisional requires provisional delivery");
  }
  if (parsed.fields.next_action === "correct" && findings.rows.length === 0) failures.push("correct review requires findings");
  if (parsed.fields.next_action !== "correct" && Array.isArray(parsed.fields.learning_candidates)) failures.push("learning_candidates are allowed only when next_action is correct");
  if (parsed.fields.next_action === "retry-review" && parsed.fields.assessment !== "insufficient-evidence") failures.push("retry-review requires assessment insufficient-evidence");
  const correction = parseCorrection(parsed, sections, failures);
  if (correction) {
    for (const fix of correction.fixes) {
      const referenced = String(fix["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean);
      for (const key of referenced) if (!keys.has(key)) failures.push(`Correction ${fix["FIX ID"]} references unknown Finding key ${key}`);
    }
    for (const learning of correction.learnings) {
      const referenced = String(learning["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean);
      for (const key of referenced) if (!keys.has(key)) failures.push(`Learning ${learning["Learning ID"]} references unknown Finding key ${key}`);
    }
  }
  parsed.effective = {
    plannedAssurance: null,
    assuranceUsed: parsed.fields.review_route === "full" ? "deep" : parsed.fields.review_route === "targeted" ? "standard" : null,
    inspectedObjectives: [...inspectedObjectives],
    reusedObjectives: [...reusedObjectives],
    inspectedChecks: [...inspectedChecks],
    reusedChecks: [...reusedChecks],
    auditorsRun: [...actualAuditors],
    missingAuditors,
    findings: findings.rows
  };
  return correction;
}
function buildArtifact(text, root, options = {}) {
  const failures = [];
  const diagnostics = [];
  const normalizations = [];
  const parsed = parseArtifact(text, failures, normalizations);
  if (!parsed) return { failures, diagnostics, normalizations, parsed: null };
  parsed.normalizations = normalizations;
  const schema = validateArtifactSchema(root, parsed, failures);
  if (!schema) return { failures, diagnostics, normalizations, parsed };
  const requiredSections = schema["x-required-sections"] ?? schema["x-markdown-sections"] ?? [];
  const sections = sectionMap(trimTrailingNotes(parsed.body, requiredSections, normalizations), requiredSections, failures, normalizations);
  parsed.sections = sections;
  if (sections.size > 0) {
    rejectPlaceholders(parsed, schema, sections, failures);
    if (parsed.fields.artifact === "work-plan") {
      if (parsed.fields.schema >= 4) validatePlanV4(parsed, sections, failures);
      else validatePlan(parsed, sections, failures);
    }
    if (parsed.fields.artifact === "delivery-evidence") validateEvidence(parsed, sections, failures);
    if (parsed.fields.artifact === "work-review") parsed.correction = validateCompactReview(parsed, sections, failures);
  }
  return { failures: unique(failures), diagnostics: unique(diagnostics), normalizations: unique(normalizations), parsed };
}
function inspectArtifactText(text, root = defaultRoot, options = {}) {
  const built = buildArtifact(text, root, options);
  return {
    errors: built.failures,
    diagnostics: built.diagnostics,
    normalizations: built.normalizations,
    effective: built.parsed?.effective ?? null,
    artifact: built.parsed ?? null
  };
}
function preflightRootPlan(text, root = defaultRoot) {
  const inspected = inspectArtifactText(text, root);
  const parsed = inspected.artifact;
  if (inspected.errors.length > 0 || parsed?.fields?.artifact !== "work-plan" || parsed.fields.schema !== 5) {
    return {
      feasible: false,
      root_plan_id: parsed?.fields?.id ?? null,
      root_projection_hash: null,
      blocking_issues: (inspected.errors.length > 0 ? inspected.errors : ["input must be one Schema-5 work-plan"]).map((message) => issue("invalid-root", message)),
      advisories: [],
      required_checks: [],
      deferred_checks: [],
      cost_classes: { cheap: 0, standard: 0, expensive: 0 },
      approval_granted: false,
      mutation_performed: false
    };
  }
  const blocking = [];
  const advisories = [];
  const authority = parsed.fields.authority ?? {};
  const denied = [
    ...(authority.protected_paths ?? []).map((path) => ({ kind: "protected", path })),
    ...(authority.approval_required_paths ?? []).map((path) => ({ kind: "approval-required", path }))
  ];
  for (const allowed of authority.allowed_roots ?? []) {
    const shadow = denied.find((entry) => targetMatches(allowed, entry.path));
    if (shadow) blocking.push(issue(
      "shadowed-allowed-root",
      `allowed root ${allowed} is fully shadowed by ${shadow.kind} path ${shadow.path}`,
      { target: allowed, boundary: shadow.path, boundary_kind: shadow.kind }
    ));
  }
  for (const target of acceptanceChangeTargets(parsed)) {
    const state = authorityTargetState(target, authority);
    if (!state.allowed || state.protected || state.approval_required) blocking.push(issue(
      "acceptance-path-outside-authority",
      `Acceptance requires changing ${target}, but the current Root does not authorize that target`,
      { target, ...state }
    ));
  }
  const rows = tableRows(verificationSectionContent(parsed), tables.verificationWithClass);
  const objectiveIds = new Set((parsed.fields.acceptance ?? []).map((_, index) => `OBJ-${index + 1}`));
  const requiredChecks = [];
  const deferredChecks = [];
  const costs = { cheap: 0, standard: 0, expensive: 0 };
  if (rows.length === 0) {
    blocking.push(issue("explicit-verification-required", "new Schema-5 roots require an explicit Verification table for Pareto check selection"));
  } else {
    const seenIds = /* @__PURE__ */ new Set();
    const signatures = /* @__PURE__ */ new Map();
    const requiredObjectives = /* @__PURE__ */ new Set();
    const classifiedChecks = [];
    for (const row of rows) {
      const checkId = row["Check ID"];
      if (!/^CHECK-[1-9][0-9]*$/.test(checkId)) blocking.push(issue("invalid-check-id", `Verification has invalid Check ID ${checkId || "<missing>"}`));
      else if (seenIds.has(checkId)) blocking.push(issue("duplicate-check-id", `Verification repeats ${checkId}`, { check_id: checkId }));
      else seenIds.add(checkId);
      const boundObjectives = ids(row.Objectives, objectivePattern);
      if (boundObjectives.length === 0 || boundObjectives.some((id) => !objectiveIds.has(id))) blocking.push(issue(
        "invalid-check-objectives",
        `${checkId || "Verification Check"} must reference only current Acceptance objectives`,
        { check_id: checkId || null, objectives: boundObjectives }
      ));
      if (!/^(?:yes|no)$/.test(row.Required)) blocking.push(issue("invalid-required-value", `${checkId || "Verification Check"} Required must be yes or no`, { check_id: checkId || null }));
      if (!/^(?:machine-verifiable|human-review-required|human-approval-required)$/.test(row["Evidence Class"])) blocking.push(issue("invalid-evidence-class", `${checkId || "Verification Check"} has an invalid Evidence Class`, { check_id: checkId || null }));
      if (!/^(?:cheap|standard|expensive)$/.test(row["Cost Class"])) blocking.push(issue("invalid-cost-class", `${checkId || "Verification Check"} has an invalid Cost Class`, { check_id: checkId || null }));
      else costs[row["Cost Class"]] += 1;
      if (row.Required === "yes") {
        requiredChecks.push(checkId);
        boundObjectives.forEach((id) => requiredObjectives.add(id));
        const signature = [boundObjectives.sort().join(","), row["Command or Inspection"], row["Expected Result"], targetTokens(row.Prerequisites).sort().join(",")].map((value) => normalizedHeader(value)).join("|");
        classifiedChecks.push({ check_id: checkId, required: true, cost: row["Cost Class"], signature });
        const prior = signatures.get(signature);
        if (prior) blocking.push(issue("duplicate-required-check", `${checkId} duplicates required Check ${prior}`, { check_id: checkId, duplicate_of: prior }));
        else signatures.set(signature, checkId);
        if (row["Cost Class"] === "expensive" && parsed.fields.risk !== "high" && (parsed.fields.hard_triggers ?? []).length === 0) advisories.push(issue(
          "expensive-required-check",
          `${checkId} is expensive and required; retain it only when no cheaper equivalent proves the same essential outcome`,
          { check_id: checkId }
        ));
      } else if (row.Required === "no") {
        deferredChecks.push(checkId);
        classifiedChecks.push({
          check_id: checkId,
          required: false,
          cost: row["Cost Class"],
          signature: [boundObjectives.sort().join(","), row["Command or Inspection"], row["Expected Result"], targetTokens(row.Prerequisites).sort().join(",")].map((value) => normalizedHeader(value)).join("|")
        });
      }
    }
    for (const check of classifiedChecks.filter((entry) => entry.required && entry.cost === "expensive")) {
      const cheaper = classifiedChecks.find((entry) => entry.check_id !== check.check_id && entry.signature === check.signature && entry.cost !== "expensive");
      if (cheaper) blocking.push(issue(
        "expensive-required-equivalent",
        `${check.check_id} is required despite cheaper equivalent ${cheaper.check_id}`,
        { check_id: check.check_id, cheaper_check_id: cheaper.check_id }
      ));
    }
    for (const objective of objectiveIds) if (!requiredObjectives.has(objective)) blocking.push(issue(
      "missing-required-check",
      `${objective} needs at least one required falsifiable Check`,
      { objective_id: objective }
    ));
  }
  const projection = authoritativeArtifactProjectionFromText(text, root);
  return {
    feasible: blocking.length === 0,
    root_plan_id: parsed.fields.id,
    root_projection_hash: projection.projection_hash ?? null,
    blocking_issues: blocking,
    advisories,
    required_checks: requiredChecks.filter(Boolean),
    deferred_checks: deferredChecks.filter(Boolean),
    cost_classes: costs,
    approval_granted: false,
    mutation_performed: false
  };
}
function authoritativeArtifactProjection(artifact, root) {
  const schema = JSON.parse(readFileSync2(schemaFor(root, artifact.fields.artifact), "utf8"));
  const fields = Object.fromEntries(Object.keys(schema.properties ?? {}).filter((key) => key !== "extensions" && Object.hasOwn(artifact.fields, key)).map((key) => [key, structuredClone(artifact.fields[key])]));
  const sections = (schema["x-required-sections"] ?? schema["x-markdown-sections"] ?? []).map((name) => ({ name, content: artifact.sections.get(name) ?? "" }));
  const projection = stableValue({ fields, sections });
  const projectionText = JSON.stringify(projection, null, 2);
  return {
    errors: [],
    projection,
    projection_text: projectionText,
    projection_hash: sha256(projectionText)
  };
}
function authoritativeArtifactProjectionFromText(text, root = defaultRoot) {
  const inspected = inspectArtifactText(text, root);
  if (inspected.errors.length > 0 || !inspected.artifact?.fields?.artifact) {
    return { errors: inspected.errors.length > 0 ? inspected.errors : ["input is not a Workflow artifact"] };
  }
  return authoritativeArtifactProjection(inspected.artifact, root);
}
function executionContractFromArtifactText(text, root = defaultRoot) {
  const inspected = inspectArtifactText(text, root);
  if (inspected.errors.length > 0 || inspected.artifact?.fields.artifact !== "work-plan") {
    return { errors: inspected.errors.length > 0 ? inspected.errors : ["input is not a work-plan"] };
  }
  const artifact = inspected.artifact;
  const data = planData(artifact);
  const authoritative = authoritativeArtifactProjectionFromText(text, root);
  return {
    errors: [],
    fields: structuredClone(authoritative.projection.fields),
    objectives: [...data.objectives],
    checks: [...data.checkRows.values()].map((row) => ({ ...row, "Evidence Class": data.evidenceClasses.get(row["Check ID"]) })),
    slices: data.slices.map((row) => ({ ...row })),
    allowedTargets: [...data.allowedTargets],
    prohibitedTargets: [...data.prohibitedTargets],
    strategy: artifact.fields.schema >= 4 ? {
      strategy_id: `strategy-${artifact.fields.id.slice(3)}`,
      revision: 0,
      parent_hash: null,
      root_projection_hash: authoritative.projection_hash,
      task_class: artifact.fields.certification?.task_recipe ?? null,
      recipe_version: "workflow-recipe-1",
      primary_targets: [...data.allowedTargets],
      steps: data.slices.map((row) => ({ ...row })),
      checks: [...data.checkRows.values()].map((row) => ({ ...row, "Evidence Class": data.evidenceClasses.get(row["Check ID"]) })),
      evidence_requirements: artifact.fields.profile_max === "autonomous" ? "verified" : "provisional-allowed",
      deviations: [],
      rationale: "initial strategy derived from the approved intent root",
      created_by: "planner"
    } : null,
    authoritative_projection: authoritative.projection,
    authoritative_projection_text: authoritative.projection_text,
    authoritative_projection_hash: authoritative.projection_hash
  };
}
function setUnion(left, right) {
  return /* @__PURE__ */ new Set([...left ?? [], ...right ?? []]);
}
function disjointCoverage(left, right, expected, label, failures) {
  const a = new Set(left ?? []);
  const b = new Set(right ?? []);
  for (const value of a) if (b.has(value)) failures.push(`${label}: ${value} appears in both fresh and reused coverage`);
  if (!sameSet(setUnion(a, b), new Set(expected))) failures.push(`${label}: fresh and reused coverage must exactly partition the root set`);
}
function compareReusePaths(paths, current, predecessor, basis, label, requiresStrong, failures) {
  for (const path of paths) {
    const currentHash = current.get(path);
    const previousHash = predecessor.get(path);
    if (currentHash && previousHash && currentHash === previousHash) continue;
    const inspectedUnchanged = String(basis ?? "").includes(path) && /(?:inspected|unchanged|no relevant change)/i.test(String(basis));
    if (!requiresStrong && inspectedUnchanged) continue;
    if (currentHash && previousHash && currentHash !== previousHash) failures.push(`${label}: changed fingerprint for ${path} invalidates reuse`);
    else failures.push(`${label}: reuse lacks ${requiresStrong ? "strong fingerprint" : "fingerprint or current change-impact inspection"} evidence for ${path}`);
  }
}
function correctionForId(artifacts, id) {
  return [...artifacts.values()].find((artifact) => artifact.fields.artifact === "work-review" && artifact.fields.correction_id === id)?.correction ?? null;
}
function materializeEvidence(artifact, artifacts, cache, failures, rootDirectory, active = /* @__PURE__ */ new Set()) {
  if (cache.has(artifact.fields.id)) return cache.get(artifact.fields.id);
  if (active.has(artifact.fields.id)) {
    failures.push(`${artifact.label}: cyclic evidence chain`);
    return null;
  }
  active.add(artifact.fields.id);
  const root = artifacts.get(artifact.fields.root_plan_id);
  if (!root || root.fields.artifact !== "work-plan") {
    failures.push(`${artifact.label}: missing root plan ${artifact.fields.root_plan_id}`);
    return null;
  }
  if (root.fields.schema === 5) {
    const authoritativeRoot = authoritativeArtifactProjection(root, rootDirectory);
    if (artifact.fields.intent_hash !== authoritativeRoot.projection_hash) failures.push(`${artifact.label}: intent_hash does not match authoritative Root projection`);
  }
  const plan = planData(root);
  const data = evidenceData(artifact);
  const leanMode = artifact.fields.schema === 5 && artifact.fields.evidence_mode === "lean";
  if (root.fields.schema === 5) {
    const fullRequired = root.fields.profile_max !== "manual" || root.fields.risk === "high" || (root.fields.hard_triggers ?? []).length > 0;
    if (fullRequired && leanMode) failures.push(`${artifact.label}: ${root.fields.profile_max} ${root.fields.risk}-risk root requires evidence_mode full`);
  }
  const currentFingerprints = fingerprintMap(data.snapshot?.["Relevant fingerprints"]);
  const reuseBasis = data.snapshot?.["Relevant fingerprints"] ?? "";
  const strongReuse = root.fields.schema >= 4 ? root.fields.contract_level === "certified" || (root.fields.hard_triggers ?? []).length > 0 : root.fields.assurance_profile === "deep" || (root.fields.hard_triggers ?? []).length > 0;
  const predecessor = artifact.fields.predecessor_evidence_id ? artifacts.get(artifact.fields.predecessor_evidence_id) : null;
  const predecessorEffective = predecessor?.fields.artifact === "delivery-evidence" ? materializeEvidence(predecessor, artifacts, cache, failures, rootDirectory, active) : null;
  if (artifact.fields.predecessor_evidence_id && !predecessorEffective) failures.push(`${artifact.label}: missing predecessor evidence ${artifact.fields.predecessor_evidence_id}`);
  if (predecessor && predecessor.fields.root_plan_id !== artifact.fields.root_plan_id) failures.push(`${artifact.label}: predecessor evidence must use the same root plan`);
  const affected = new Set(artifact.fields.affected_objectives ?? []);
  const reusedObjectives = new Set(artifact.fields.reused_objectives ?? []);
  const executed = new Set(artifact.fields.executed_checks ?? []);
  const reusedChecks = new Set(artifact.fields.reused_checks ?? []);
  disjointCoverage(affected, reusedObjectives, plan.objectives, `${artifact.label}: objective`, failures);
  disjointCoverage([...executed].filter((id) => plan.requiredChecks.has(id)), reusedChecks, plan.requiredChecks, `${artifact.label}: root Check`, failures);
  const initial = artifact.fields.subject_id === root.fields.id;
  if (initial && artifact.fields.representation !== "full") failures.push(`${artifact.label}: initial evidence must use full representation`);
  if (!initial && !predecessorEffective) failures.push(`${artifact.label}: correction evidence requires direct predecessor evidence`);
  if (artifact.fields.representation === "full" && (reusedObjectives.size > 0 || reusedChecks.size > 0)) failures.push(`${artifact.label}: full representation cannot declare reused root state`);
  const objectives = /* @__PURE__ */ new Map();
  for (const objective of affected) {
    const row = data.outcomeRows.get(objective);
    if (!row) failures.push(`${artifact.label}: affected ${objective} lacks an Objective outcomes row`);
    else objectives.set(objective, { status: row.Status, evidence: row.Evidence, source: artifact.fields.id });
  }
  for (const objective of reusedObjectives) {
    const previous = predecessorEffective?.objectives.get(objective);
    if (!previous) failures.push(`${artifact.label}: reused ${objective} is absent from direct predecessor evidence`);
    else {
      if (!leanMode) compareReusePaths(plan.objectiveDependencies.get(objective) ?? [], currentFingerprints, predecessorEffective.snapshotFingerprints, reuseBasis, `${artifact.label}: reused ${objective}`, strongReuse, failures);
      objectives.set(objective, { ...previous, reusedFrom: predecessor.fields.id });
    }
  }
  const checks = /* @__PURE__ */ new Map();
  for (const id of executed) {
    const row = data.checkRows.get(id);
    if (!row) {
      failures.push(`${artifact.label}: executed ${id} lacks a Checks row`);
      continue;
    }
    const planned = plan.checkRows.get(id) ?? correctionForId(artifacts, artifact.fields.subject_id)?.checks.find((candidate) => candidate["Check ID"] === id);
    if (!planned) failures.push(`${artifact.label}: executed unknown ${id}`);
    else {
      const prerequisiteFingerprints = fingerprintMap(row["Prerequisite fingerprints"]);
      for (const [prerequisite, hash] of prerequisiteFingerprints) if (currentFingerprints.get(prerequisite) !== hash) failures.push(`${artifact.label}: ${id} fingerprint ${prerequisite} is not current`);
    }
    checks.set(id, { status: row.Status, observed: row["Observed Result"], fingerprints: row["Prerequisite fingerprints"], source: artifact.fields.id });
  }
  for (const id of reusedChecks) {
    const previous = predecessorEffective?.checks.get(id);
    const planned = plan.checkRows.get(id);
    if (!previous || !planned) failures.push(`${artifact.label}: reused ${id} is absent from direct predecessor root evidence`);
    else {
      if (!leanMode) compareReusePaths(targetTokens(planned.Prerequisites), currentFingerprints, predecessorEffective.snapshotFingerprints, reuseBasis, `${artifact.label}: reused ${id}`, strongReuse, failures);
      checks.set(id, { ...previous, reusedFrom: predecessor.fields.id });
    }
  }
  for (const change of data.changes) for (const target of targetTokens(change["Path or Symbol"])) {
    const allowed = plan.allowedTargets.some((scope) => targetMatches(target, scope));
    const prohibited = plan.prohibitedTargets.filter((scope) => !/^all other (?:files|paths|targets)$/i.test(scope)).some((scope) => targetMatches(target, scope));
    if (!allowed || prohibited) failures.push(`${artifact.label}: changed target ${target} is outside root scope`);
  }
  const operationalContent = (artifact.sections.get("Operational evidence") ?? "").trim();
  let operationalReady = true;
  if (root.fields.schema >= 4) {
    if (operationalContent && !/^not applicable\.?$/i.test(operationalContent)) {
      const operationalRows = tableRows(operationalContent, tables.operationalEvidence);
      operationalReady = operationalRows.length > 0 && operationalRows.every((row) => row.Status === "satisfied");
    }
  } else if (root.fields.runtime_relevant === true) {
    const operationalRows = tableRows(operationalContent, tables.operationalEvidence);
    const byConcern = new Map(operationalRows.map((row) => [normalizedHeader(row.Concern), row]));
    for (const concern of ["Observable signal", "Failure condition", "Recovery or rollback"]) {
      const row = byConcern.get(normalizedHeader(concern));
      if (!row) failures.push(`${artifact.label}: runtime operational evidence is missing ${concern}`);
      if (row && !/^(?:satisfied|unsatisfied|blocked)$/.test(row.Status)) failures.push(`${artifact.label}: runtime operational evidence ${concern} has invalid Status`);
      if (row?.Status !== "satisfied") operationalReady = false;
    }
    if (artifact.fields.status === "complete" && !operationalReady) failures.push(`${artifact.label}: complete runtime evidence requires satisfied operational proof`);
  } else if (operationalContent && !/^not applicable\.?$/i.test(operationalContent)) {
    failures.push(`${artifact.label}: non-runtime operational evidence must be omitted or Not applicable.`);
    operationalReady = false;
  }
  if (initial) {
    const delivered = data.results.length > 0 ? new Set(data.results.map((row) => row["Objective ID"])) : new Set(data.outcomes.map((row) => row["Objective ID"]));
    if (!sameSet(delivered, plan.objectives)) failures.push(`${artifact.label}: initial evidence must cover every root objective`);
    if (artifact.fields.source_review_id || artifact.fields.predecessor_evidence_id) failures.push(`${artifact.label}: initial evidence cannot reference review or predecessor evidence`);
  } else {
    const sourceReview = artifacts.get(artifact.fields.source_review_id);
    const correction = correctionForId(artifacts, artifact.fields.subject_id);
    if (!sourceReview || sourceReview.fields.correction_id !== artifact.fields.subject_id || !correction) failures.push(`${artifact.label}: correction evidence does not resolve its source review and correction`);
    else {
      const expectedFixes = new Set(correction.fixes.map((row) => row["FIX ID"]));
      if (!leanMode && !sameSet(new Set(data.results.map((row) => row["Objective ID"])), expectedFixes)) failures.push(`${artifact.label}: correction Subject results must cover every FIX`);
      for (const check of correction.checks.filter((row) => row.Required === "yes")) if (!executed.has(check["Check ID"])) failures.push(`${artifact.label}: missing executed correction Check ${check["Check ID"]}`);
    }
  }
  const reviewReady = artifact.fields.status === "complete" && (artifact.fields.schema < 4 || artifact.fields.overall_grade === "verified") && operationalReady && [...plan.requiredChecks].every((id) => checks.get(id)?.status === "passed");
  const effective = { root, plan, objectives, checks, snapshot: data.snapshot, snapshotFingerprints: currentFingerprints, operationalReady, reviewReady, predecessor: predecessorEffective };
  artifact.effective = effective;
  cache.set(artifact.fields.id, effective);
  active.delete(artifact.fields.id);
  return effective;
}
function validateCompactCorrection(review, root, evidence, artifacts, failures) {
  const correction = review.correction;
  if (!correction) return;
  const metadata = correction.metadata ?? {};
  if (metadata["Correction ID"] !== review.fields.correction_id) failures.push(`${review.label}: correction metadata ID mismatch`);
  if (metadata["Root Plan"] !== root.fields.id) failures.push(`${review.label}: correction root mismatch`);
  if (metadata["Source Review"] !== review.fields.id) failures.push(`${review.label}: correction source review mismatch`);
  if (metadata["Base Evidence"] !== evidence.fields.id) failures.push(`${review.label}: correction base evidence mismatch`);
  if ((riskRank[metadata.Risk] ?? 99) > (riskRank[root.fields.risk] ?? 0)) failures.push(`${review.label}: correction raises root risk and requires replan`);
  const plan = planData(root);
  const findingKeys = new Set(reviewData(review).findings.map((row) => row["Finding key"]));
  for (const fix of correction.fixes) {
    for (const key of String(fix["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean)) if (!findingKeys.has(key)) failures.push(`${review.label}: correction references unknown Finding key ${key}`);
    for (const objective of ids(fix["Root Objectives"], objectivePattern)) if (!plan.objectives.has(objective)) failures.push(`${review.label}: correction references unknown root ${objective}`);
    for (const check of ids(fix["Root Checks"], checkPattern)) if (!plan.checks.has(check)) failures.push(`${review.label}: correction references unknown root ${check}`);
  }
  for (const step of correction.steps) for (const target of targetTokens(step.Targets)) {
    const allowed = plan.allowedTargets.some((scope) => targetMatches(target, scope));
    const prohibited = plan.prohibitedTargets.filter((scope) => !/^all other (?:files|paths|targets)$/i.test(scope)).some((scope) => targetMatches(target, scope));
    if (!allowed || prohibited) failures.push(`${review.label}: correction target ${target} is outside root scope`);
  }
}
function progressState(review, artifacts) {
  const evidence = artifacts.get(review.fields.latest_evidence_id);
  const effective = evidence?.effective;
  const findings = reviewData(review).findings;
  return new Map(findings.map((finding) => {
    const objectives = ids(finding.Objectives, objectivePattern);
    const checks = ids(finding.Checks, checkPattern);
    const objectiveRank = objectives.reduce((sum, id) => sum + ({ blocked: 0, "not-achieved": 1, "partially-achieved": 2, achieved: 3 }[effective?.objectives.get(id)?.status] ?? 0), 0);
    const passedChecks = checks.filter((id) => effective?.checks.get(id)?.status === "passed").length;
    const fingerprintSignature = objectives.flatMap((id) => [...effective?.plan.objectiveDependencies.get(id) ?? []]).sort().map((path) => `${path}=${effective?.snapshotFingerprints.get(path) ?? "missing"}`).join(";");
    return [finding["Finding key"], { severity: { critical: 4, high: 3, medium: 2, low: 1 }[finding.Severity] ?? 9, objectiveRank, passedChecks, fingerprintSignature }];
  }));
}
function measurableProgress(previous, current) {
  if (!previous || !current) return false;
  return current.severity < previous.severity || current.objectiveRank > previous.objectiveRank || current.passedChecks > previous.passedChecks || current.fingerprintSignature !== previous.fingerprintSignature;
}
function validatePlanLineage(artifacts, failures) {
  const plans = [...artifacts.values()].filter((artifact) => artifact.fields.artifact === "work-plan");
  const plansById = new Map(plans.map((plan) => [plan.fields.id, plan]));
  const successors = /* @__PURE__ */ new Map();
  for (const plan of plans) {
    const predecessorId = plan.fields.predecessor_plan_id;
    const sourceReviewId = plan.fields.replan_source_review_id;
    if (!predecessorId && !sourceReviewId) continue;
    if (!predecessorId || !sourceReviewId) continue;
    if (predecessorId === plan.fields.id) failures.push(`${plan.label}: replan root cannot reference itself`);
    const predecessor = plansById.get(predecessorId);
    if (!predecessor) failures.push(`${plan.label}: missing predecessor plan ${predecessorId}`);
    else if (predecessor.fields.schema !== 5) failures.push(`${plan.label}: predecessor plan must use Schema 5`);
    const sourceReview = artifacts.get(sourceReviewId);
    if (!sourceReview || sourceReview.fields.artifact !== "work-review") failures.push(`${plan.label}: missing replan source review ${sourceReviewId}`);
    else {
      if (sourceReview.fields.schema !== 5) failures.push(`${plan.label}: replan source review must use Schema 5`);
      if (sourceReview.fields.root_plan_id !== predecessorId) failures.push(`${plan.label}: replan source review must belong to predecessor plan ${predecessorId}`);
      if (sourceReview.fields.next_action !== "replan") failures.push(`${plan.label}: replan source review must require next_action replan`);
      const predecessorReviews = [...artifacts.values()].filter((artifact) => artifact.fields.artifact === "work-review" && artifact.fields.root_plan_id === predecessorId);
      const referencedReviews = new Set(predecessorReviews.map((review) => review.fields.predecessor_review_id).filter(Boolean));
      const reviewTips = predecessorReviews.filter((review) => !referencedReviews.has(review.fields.id));
      if (reviewTips.length !== 1 || reviewTips[0].fields.id !== sourceReviewId) failures.push(`${plan.label}: replan source review must be the unique current predecessor review tip`);
    }
    const list = successors.get(predecessorId) ?? [];
    list.push(plan);
    successors.set(predecessorId, list);
  }
  for (const [predecessorId, list] of successors) if (list.length > 1) failures.push(`work-plan lineage branches after ${predecessorId}`);
  const visiting = /* @__PURE__ */ new Set();
  const visited = /* @__PURE__ */ new Set();
  const visit = (plan) => {
    if (visited.has(plan.fields.id)) return;
    if (visiting.has(plan.fields.id)) {
      failures.push(`work-plan lineage is cyclic at ${plan.fields.id}`);
      return;
    }
    visiting.add(plan.fields.id);
    const predecessor = plansById.get(plan.fields.predecessor_plan_id);
    if (predecessor) visit(predecessor);
    visiting.delete(plan.fields.id);
    visited.add(plan.fields.id);
  };
  plans.forEach(visit);
  const referencedPlans = new Set(plans.map((plan) => plan.fields.predecessor_plan_id).filter(Boolean));
  return plans.filter((plan) => !referencedPlans.has(plan.fields.id)).map((plan) => plan.fields.id).sort();
}
function inspectCompactArtifactSet(entries, root = defaultRoot, options = {}) {
  const errors = [];
  const diagnostics = [];
  const normalizations = [];
  const artifacts = /* @__PURE__ */ new Map();
  for (const [label, text] of entries) {
    const probeErrors = [];
    const probe = parseArtifact(text, probeErrors, []);
    const type = probe?.fields.artifact;
    if (type && !knownArtifacts.has(type) && !existsSync2(schemaFor(root, type))) {
      const workflowShaped = /^(?:work|delivery)-/.test(type) || /^(?:wp|de|wr|cp|rs)-/.test(String(probe?.fields.id ?? ""));
      if (workflowShaped) errors.push(`${label}: unsupported workflow artifact type`);
      continue;
    }
    const built = buildArtifact(text, root, { deferReferences: true });
    built.failures.forEach((failure) => errors.push(`${label}: ${failure}`));
    built.diagnostics.forEach((item) => diagnostics.push(`${label}: ${item}`));
    built.normalizations.forEach((item) => normalizations.push(`${label}: ${item}`));
    if (built.failures.length > 0 || !built.parsed?.fields.id) continue;
    if (artifacts.has(built.parsed.fields.id)) errors.push(`${label}: duplicate artifact ID ${built.parsed.fields.id}`);
    artifacts.set(built.parsed.fields.id, { label, text, ...built.parsed });
  }
  const rootTips = validatePlanLineage(artifacts, errors);
  const evidenceCache = /* @__PURE__ */ new Map();
  const evidenceByRoot = /* @__PURE__ */ new Map();
  const orderedEvidenceByRoot = /* @__PURE__ */ new Map();
  const reviewsByRoot = /* @__PURE__ */ new Map();
  for (const artifact of artifacts.values()) {
    if (artifact.fields.artifact === "delivery-evidence") {
      materializeEvidence(artifact, artifacts, evidenceCache, errors, root);
      const list = evidenceByRoot.get(artifact.fields.root_plan_id) ?? [];
      list.push(artifact);
      evidenceByRoot.set(artifact.fields.root_plan_id, list);
    }
    if (artifact.fields.artifact === "work-review") {
      const list = reviewsByRoot.get(artifact.fields.root_plan_id) ?? [];
      list.push(artifact);
      reviewsByRoot.set(artifact.fields.root_plan_id, list);
    }
  }
  for (const [rootId, evidence] of evidenceByRoot) {
    if (evidence.filter((item) => item.fields.subject_id === rootId).length !== 1) errors.push(`${rootId}: evidence chain requires exactly one initial root delivery`);
    orderedEvidenceByRoot.set(rootId, linearChain(evidence, "predecessor_evidence_id", `${rootId}: evidence`, errors));
  }
  for (const [rootId, reviews] of reviewsByRoot) {
    const rootPlan = artifacts.get(rootId);
    if (!rootPlan || rootPlan.fields.artifact !== "work-plan") {
      errors.push(`${rootId}: reviews require a root plan`);
      continue;
    }
    const plan = planData(rootPlan);
    const ordered = linearChain(reviews, "predecessor_review_id", `${rootId}: review`, errors);
    const learningOwners = /* @__PURE__ */ new Map();
    for (const review of ordered) for (const learning of review.correction?.learnings ?? []) {
      const id = learning["Learning ID"];
      if (learningOwners.has(id)) errors.push(`${review.label}: learning candidate ${id} duplicates ${learningOwners.get(id)} within root ${rootId}`);
      else learningOwners.set(id, review.label);
    }
    const reviewIndex = new Map(ordered.map((review, index) => [review.fields.id, index]));
    const rootEvidence = orderedEvidenceByRoot.get(rootId) ?? [];
    for (let index = 0; index < ordered.length; index += 1) {
      const review = ordered[index];
      const boundaryReview = review.fields.review_basis === "root-boundary";
      if (boundaryReview) {
        const receipt = review.fields.boundary_receipt ?? {};
        if (receipt.root_content_hash !== sha256(rootPlan.text)) errors.push(`${review.label}: boundary receipt root_content_hash does not match exact Root bytes`);
        for (const path of receipt.observed_paths ?? []) {
          if (path.startsWith("/") || path === ".." || path.startsWith("../") || path.includes("\\")) {
            errors.push(`${review.label}: boundary receipt path must remain normalized and repository-relative: ${path}`);
          }
        }
        if (typeof options.boundaryReceiptVerifier !== "function") {
          errors.push(`${review.label}: root-boundary review requires a fresh protected host receipt; portable or rootless validation fails closed`);
        } else {
          try {
            const trusted = options.boundaryReceiptVerifier({ receipt, rootPlanText: rootPlan.text, reviewFields: review.fields });
            if (trusted?.ok !== true) errors.push(`${review.label}: boundary receipt is not trusted: ${trusted?.reason ?? "host verification failed"}`);
          } catch (error) {
            errors.push(`${review.label}: boundary receipt host verification failed: ${String(error?.message ?? error)}`);
          }
        }
        review.effective = {
          ...review.effective,
          plannedAssurance: rootPlan.fields.contract_level === "certified" ? "deep" : rootPlan.fields.contract_level === "controlled" ? "standard" : "lean",
          assuranceUsed: "inline",
          snapshotId: receipt.repository_snapshot_hash ?? null,
          correctionRound: rootEvidence.length > 0 ? rootEvidence.length - 1 : 0,
          reviewReady: false,
          loopState: "blocked",
          boundaryReview: true,
          proxies: {
            objectivesInspected: 0,
            objectivesReused: 0,
            checksExecuted: 0,
            checksReused: 0,
            auditorsRun: 1
          }
        };
        continue;
      }
      const evidence = artifacts.get(review.fields.latest_evidence_id);
      if (!evidence || evidence.fields.artifact !== "delivery-evidence") {
        errors.push(`${review.label}: missing latest evidence ${review.fields.latest_evidence_id}`);
        continue;
      }
      const effective = evidence.effective;
      if (evidence.fields.root_plan_id !== rootId) errors.push(`${review.label}: latest evidence belongs to another root`);
      const knownFailedEvidence = evidenceHasKnownFailure(evidence.fields);
      if (knownFailedEvidence && review.fields.delivery_status !== "blocked") errors.push(`${review.label}: known failed or blocked evidence requires blocked delivery_status`);
      if (knownFailedEvidence && ["accept-provisional", "none"].includes(review.fields.next_action)) errors.push(`${review.label}: known failed or blocked evidence cannot be accepted or achieved`);
      const candidates = rootEvidence.filter((item) => item.fields.source_review_id === null || (reviewIndex.get(item.fields.source_review_id) ?? Number.POSITIVE_INFINITY) < index);
      if (candidates.at(-1)?.fields.id !== review.fields.latest_evidence_id) errors.push(`${review.label}: latest_evidence_id is not the evidence tip at review time`);
      disjointCoverage(review.fields.inspected_objectives, review.fields.reused_objectives, plan.objectives, `${review.label}: objective review`, errors);
      disjointCoverage(review.fields.inspected_checks, review.fields.reused_checks, plan.requiredChecks, `${review.label}: Check review`, errors);
      if (index === 0 && ((review.fields.reused_objectives ?? []).length > 0 || (review.fields.reused_checks ?? []).length > 0)) errors.push(`${review.label}: first review must inspect all root evidence`);
      const fullReviewRequired = rootPlan.fields.schema >= 4 ? rootPlan.fields.contract_level === "certified" || rootPlan.fields.risk === "high" || (rootPlan.fields.hard_triggers ?? []).length > 0 : rootPlan.fields.assurance_profile === "deep" || (rootPlan.fields.hard_triggers ?? []).length > 0;
      const deterministicBlockedRoute = review.fields.delivery_status === "blocked" && review.fields.review_route === "inline" && (review.fields.next_action === "replan" || review.fields.next_action === "correct" && knownFailedEvidence);
      if (fullReviewRequired && review.fields.review_route !== "full" && !deterministicBlockedRoute) {
        errors.push(`${review.label}: certified, high-risk, or hard-trigger root requires review_route full`);
      }
      for (const objective of review.fields.reused_objectives ?? []) {
        if (!evidence.fields.reused_objectives.includes(objective)) errors.push(`${review.label}: reused review objective ${objective} lacks delta-evidence reuse`);
        const previousEvidence = index > 0 ? artifacts.get(ordered[index - 1].fields.latest_evidence_id)?.effective : null;
        if (previousEvidence?.objectives.get(objective)?.status !== "achieved") errors.push(`${review.label}: reused objective ${objective} requires achieved predecessor status`);
        if (reviewData(review).findings.some((finding) => ids(finding.Objectives, objectivePattern).includes(objective))) errors.push(`${review.label}: reused objective ${objective} has a current finding`);
      }
      for (const check of review.fields.reused_checks ?? []) if (!evidence.fields.reused_checks.includes(check) || effective?.checks.get(check)?.status !== "passed") errors.push(`${review.label}: reused Check ${check} lacks valid passed delta evidence`);
      if (review.fields.assessment === "achieved") {
        if (!effective?.reviewReady) errors.push(`${review.label}: achieved requires complete effective root-check evidence`);
        if ([...plan.objectives].some((id) => effective?.objectives.get(id)?.status !== "achieved")) errors.push(`${review.label}: achieved requires every effective root objective achieved`);
        if (reviewData(review).findings.length > 0) errors.push(`${review.label}: achieved cannot contain findings`);
      }
      const plannedAssurance = rootPlan.fields.schema >= 4 ? { lean: "lean", controlled: "standard", certified: "deep" }[rootPlan.fields.contract_level] ?? "standard" : rootPlan.fields.assurance_profile;
      review.effective = {
        ...review.effective,
        plannedAssurance,
        assuranceUsed: review.fields.review_route === "full" ? "deep" : review.fields.review_route === "targeted" ? "standard" : plannedAssurance,
        snapshotId: effective?.snapshot?.["Snapshot ID"] ?? null,
        correctionRound: candidates.length - 1,
        reviewReady: effective?.reviewReady ?? false,
        loopState: reviewData(review).findings.length > 0 ? "degraded" : "healthy",
        proxies: {
          objectivesInspected: review.fields.inspected_objectives.length,
          objectivesReused: review.fields.reused_objectives.length,
          checksExecuted: review.fields.inspected_checks.length,
          checksReused: review.fields.reused_checks.length,
          auditorsRun: (review.fields.auditors_run ?? []).length
        }
      };
      validateCompactCorrection(review, rootPlan, evidence, artifacts, errors);
    }
    for (let index = 2; index < ordered.length; index += 1) {
      const window = ordered.slice(index - 2, index + 1);
      if (window.some((review) => review.fields.review_basis === "root-boundary")) continue;
      const priorCorrectionsExecuted = window.slice(0, 2).every((review) => review.fields.correction_id && [...artifacts.values()].some((candidate) => candidate.fields.artifact === "delivery-evidence" && candidate.fields.subject_id === review.fields.correction_id));
      if (!priorCorrectionsExecuted) continue;
      const states = window.map((review) => progressState(review, artifacts));
      for (const key of states[2].keys()) {
        if (!states[0].has(key) || !states[1].has(key)) continue;
        const progressed = measurableProgress(states[0].get(key), states[1].get(key)) || measurableProgress(states[1].get(key), states[2].get(key));
        if (!progressed) {
          const current = window[2];
          current.effective.loopState = "stalled";
          diagnostics.push(`${current.label}: Finding key ${key} survived two corrections without measurable progress; clarify or replan is recommended`);
          if (!["clarify", "replan"].includes(current.fields.next_action)) {
            errors.push(`${current.label}: two correction rounds without measurable progress require next_action clarify or replan`);
          }
        }
      }
      if (!window[2].effective.loopState) window[2].effective.loopState = reviewData(window[2]).findings.length > 0 ? "degraded" : "healthy";
    }
  }
  return { errors: unique(errors), diagnostics: unique(diagnostics), normalizations: unique(normalizations), effective: artifacts, root_tips: rootTips };
}
function inspectArtifactSet(entries, root = defaultRoot, options = {}) {
  return inspectCompactArtifactSet(entries, root, options);
}
function effectiveCliSummary(inspection) {
  if (!(inspection.effective instanceof Map)) return { active_root_id: null, root_tips: [], evidence_tips: {}, review_tips: {}, actionable_reviews: [], learning_candidates: [] };
  const artifacts = [...inspection.effective.values()];
  const tips = (type, predecessorField) => {
    const items = artifacts.filter((artifact) => artifact.fields.artifact === type);
    return Object.fromEntries(lineageTips(items, predecessorField).map((artifact) => [artifact.fields.root_plan_id, artifact.fields.id]));
  };
  const rootTips = inspection.root_tips ?? validatePlanLineage(inspection.effective, []);
  const activeRootId = rootTips.length === 1 ? rootTips[0] : null;
  const evidenceTips = tips("delivery-evidence", "predecessor_evidence_id");
  const reviewTips = tips("work-review", "predecessor_review_id");
  const activeReview = activeRootId && reviewTips[activeRootId] ? inspection.effective.get(reviewTips[activeRootId]) : null;
  const learningCandidates = artifacts.filter((artifact) => artifact.fields.artifact === "work-review" && artifact.fields.root_plan_id === activeRootId && activeReview?.fields.assessment === "achieved" && activeReview?.fields.delivery_status === "verified" && artifact.correction?.learnings?.length > 0).flatMap((artifact) => artifact.correction.learnings.map((learning) => {
    const evidence = artifacts.find((candidate) => candidate.fields.artifact === "delivery-evidence" && candidate.fields.subject_id === artifact.fields.correction_id && candidate.fields.status === "complete");
    return {
      source_kind: "manual-correction",
      root_plan_id: artifact.fields.root_plan_id,
      review_id: artifact.fields.id,
      correction_id: artifact.fields.correction_id,
      learning_id: learning["Learning ID"],
      finding_keys: String(learning["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean),
      reusable_guidance: learning["Reusable guidance"],
      candidate_targets: targetTokens(learning["Candidate targets"]),
      confirmation_evidence: learning["Confirmation evidence"],
      correction_evidence_id: evidence?.fields.id ?? null,
      evidence_confirmed: Boolean(evidence)
    };
  })).toSorted((left, right) => left.review_id.localeCompare(right.review_id) || left.learning_id.localeCompare(right.learning_id));
  return {
    active_root_id: activeRootId,
    root_tips: rootTips,
    evidence_tips: evidenceTips,
    review_tips: reviewTips,
    actionable_reviews: artifacts.filter((artifact) => artifact.fields.artifact === "work-review" && artifact.fields.root_plan_id === activeRootId && artifact.fields.id === reviewTips[activeRootId] && artifact.fields.next_action === "correct").map((artifact) => ({ root_plan_id: artifact.fields.root_plan_id, review_id: artifact.fields.id, correction_id: artifact.fields.correction_id, base_evidence_id: artifact.fields.latest_evidence_id })),
    learning_candidates: learningCandidates
  };
}
function runCli() {
  const diagnosticsRequested = process.argv.includes("--diagnostics");
  const effectiveRequested = process.argv.includes("--effective");
  const paths = process.argv.slice(2).filter((value) => !["--diagnostics", "--effective"].includes(value));
  if (paths.length === 0) {
    console.error("Usage: validate-artifact.mjs [--diagnostics] [--effective] <artifact.md> [related-artifact.md ...]");
    process.exitCode = 2;
    return;
  }
  const entries = paths.map((path) => [path, readFileSync2(resolve2(path), "utf8")]);
  const inspection = entries.length === 1 ? inspectArtifactText(entries[0][1]) : inspectArtifactSet(entries);
  if (inspection.errors.length > 0) {
    console.error("Artifact validation failed:");
    inspection.errors.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }
  if (effectiveRequested) {
    console.log(JSON.stringify({ status: "passed", ...effectiveCliSummary(inspection), normalizations: diagnosticsRequested ? inspection.normalizations : void 0, diagnostics: diagnosticsRequested ? inspection.diagnostics : void 0 }, null, 2));
    return;
  }
  console.log(entries.length === 1 ? "Artifact validation passed." : "Artifact chain validation passed.");
  if (diagnosticsRequested) {
    inspection.normalizations.forEach((item) => console.log(`NORMALIZED: ${item}`));
    inspection.diagnostics.forEach((item) => console.log(`DIAGNOSTIC: ${item}`));
  }
}
if (process.argv[1] && ["validate-artifact.source.mjs", "validate-artifact.mjs"].includes(basename(process.argv[1])) && realpathSync(resolve2(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) runCli();

export {
  require_ajv,
  require_dist2 as require_dist,
  opaqueExtensionsFromArtifactText,
  replaceOpaqueExtensions,
  inspectArtifactText,
  preflightRootPlan,
  executionContractFromArtifactText,
  inspectArtifactSet,
  effectiveCliSummary
};
