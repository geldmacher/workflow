#!/usr/bin/env node
import { createRequire as __workflowCreateRequire } from 'node:module';
const require = __workflowCreateRequire(import.meta.url);
import {
  require_dist
} from "./chunk-7JUFD6FK.mjs";
import {
  __commonJS,
  __toESM
} from "./chunk-WU6JOB3C.mjs";

// node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS({
  "node_modules/ajv/dist/compile/codegen/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
    var _CodeOrName = class {
    };
    exports._CodeOrName = _CodeOrName;
    exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var Name = class extends _CodeOrName {
      constructor(s) {
        if (super(), !exports.IDENTIFIER.test(s))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return !1;
      }
      get names() {
        return { [this.str]: 1 };
      }
    };
    exports.Name = Name;
    var _Code = class extends _CodeOrName {
      constructor(code) {
        super(), this._items = typeof code == "string" ? [code] : code;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return !1;
        let item = this._items[0];
        return item === "" || item === '""';
      }
      get str() {
        var _a;
        return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
      }
      get names() {
        var _a;
        return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => (c instanceof Name && (names[c.str] = (names[c.str] || 0) + 1), names), {});
      }
    };
    exports._Code = _Code;
    exports.nil = new _Code("");
    function _(strs, ...args) {
      let code = [strs[0]], i = 0;
      for (; i < args.length; )
        addCodeArg(code, args[i]), code.push(strs[++i]);
      return new _Code(code);
    }
    exports._ = _;
    var plus = new _Code("+");
    function str(strs, ...args) {
      let expr = [safeStringify(strs[0])], i = 0;
      for (; i < args.length; )
        expr.push(plus), addCodeArg(expr, args[i]), expr.push(plus, safeStringify(strs[++i]));
      return optimize(expr), new _Code(expr);
    }
    exports.str = str;
    function addCodeArg(code, arg) {
      arg instanceof _Code ? code.push(...arg._items) : arg instanceof Name ? code.push(arg) : code.push(interpolate(arg));
    }
    exports.addCodeArg = addCodeArg;
    function optimize(expr) {
      let i = 1;
      for (; i < expr.length - 1; ) {
        if (expr[i] === plus) {
          let res = mergeExprItems(expr[i - 1], expr[i + 1]);
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
      if (typeof a == "string")
        return b instanceof Name || a[a.length - 1] !== '"' ? void 0 : typeof b != "string" ? `${a.slice(0, -1)}${b}"` : b[0] === '"' ? a.slice(0, -1) + b.slice(1) : void 0;
      if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
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
      if (typeof key == "string" && exports.IDENTIFIER.test(key))
        return new _Code(`${key}`);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
    var code_1 = require_code(), ValueError = class extends Error {
      constructor(name) {
        super(`CodeGen: "code" for ${name} not defined`), this.value = name.value;
      }
    }, UsedValueState;
    (function(UsedValueState2) {
      UsedValueState2[UsedValueState2.Started = 0] = "Started", UsedValueState2[UsedValueState2.Completed = 1] = "Completed";
    })(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
    exports.varKinds = {
      const: new code_1.Name("const"),
      let: new code_1.Name("let"),
      var: new code_1.Name("var")
    };
    var Scope = class {
      constructor({ prefixes, parent } = {}) {
        this._names = {}, this._prefixes = prefixes, this._parent = parent;
      }
      toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
      }
      name(prefix) {
        return new code_1.Name(this._newName(prefix));
      }
      _newName(prefix) {
        let ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
      }
      _nameGroup(prefix) {
        var _a, _b;
        if (!((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0) && _b.has(prefix) || this._prefixes && !this._prefixes.has(prefix))
          throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        return this._names[prefix] = { prefix, index: 0 };
      }
    };
    exports.Scope = Scope;
    var ValueScopeName = class extends code_1.Name {
      constructor(prefix, nameStr) {
        super(nameStr), this.prefix = prefix;
      }
      setValue(value, { property, itemIndex }) {
        this.value = value, this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
      }
    };
    exports.ValueScopeName = ValueScopeName;
    var line = (0, code_1._)`\n`, ValueScope = class extends Scope {
      constructor(opts) {
        super(opts), this._values = {}, this._scope = opts.scope, this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
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
        let name = this.toName(nameOrPrefix), { prefix } = name, valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref, vs = this._values[prefix];
        if (vs) {
          let _name = vs.get(valueKey);
          if (_name)
            return _name;
        } else
          vs = this._values[prefix] = /* @__PURE__ */ new Map();
        vs.set(valueKey, name);
        let s = this._scope[prefix] || (this._scope[prefix] = []), itemIndex = s.length;
        return s[itemIndex] = value.ref, name.setValue(value, { property: prefix, itemIndex }), name;
      }
      getValue(prefix, keyOrRef) {
        let vs = this._values[prefix];
        if (vs)
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
        for (let prefix in values) {
          let vs = values[prefix];
          if (!vs)
            continue;
          let nameSet = usedValues[prefix] = usedValues[prefix] || /* @__PURE__ */ new Map();
          vs.forEach((name) => {
            if (nameSet.has(name))
              return;
            nameSet.set(name, UsedValueState.Started);
            let c = valueCode(name);
            if (c) {
              let def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
              code = (0, code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
            } else if (c = getCode?.(name))
              code = (0, code_1._)`${code}${c}${this.opts._n}`;
            else
              throw new ValueError(name);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
    var code_1 = require_code(), scope_1 = require_scope(), code_2 = require_code();
    Object.defineProperty(exports, "_", { enumerable: !0, get: function() {
      return code_2._;
    } });
    Object.defineProperty(exports, "str", { enumerable: !0, get: function() {
      return code_2.str;
    } });
    Object.defineProperty(exports, "strConcat", { enumerable: !0, get: function() {
      return code_2.strConcat;
    } });
    Object.defineProperty(exports, "nil", { enumerable: !0, get: function() {
      return code_2.nil;
    } });
    Object.defineProperty(exports, "getProperty", { enumerable: !0, get: function() {
      return code_2.getProperty;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: !0, get: function() {
      return code_2.stringify;
    } });
    Object.defineProperty(exports, "regexpCode", { enumerable: !0, get: function() {
      return code_2.regexpCode;
    } });
    Object.defineProperty(exports, "Name", { enumerable: !0, get: function() {
      return code_2.Name;
    } });
    var scope_2 = require_scope();
    Object.defineProperty(exports, "Scope", { enumerable: !0, get: function() {
      return scope_2.Scope;
    } });
    Object.defineProperty(exports, "ValueScope", { enumerable: !0, get: function() {
      return scope_2.ValueScope;
    } });
    Object.defineProperty(exports, "ValueScopeName", { enumerable: !0, get: function() {
      return scope_2.ValueScopeName;
    } });
    Object.defineProperty(exports, "varKinds", { enumerable: !0, get: function() {
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
    }, Def = class extends Node {
      constructor(varKind, name, rhs) {
        super(), this.varKind = varKind, this.name = name, this.rhs = rhs;
      }
      render({ es5, _n }) {
        let varKind = es5 ? scope_1.varKinds.var : this.varKind, rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (names[this.name.str])
          return this.rhs && (this.rhs = optimizeExpr(this.rhs, names, constants)), this;
      }
      get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
      }
    }, Assign = class extends Node {
      constructor(lhs, rhs, sideEffects) {
        super(), this.lhs = lhs, this.rhs = rhs, this.sideEffects = sideEffects;
      }
      render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (!(this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects))
          return this.rhs = optimizeExpr(this.rhs, names, constants), this;
      }
      get names() {
        let names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
      }
    }, AssignOp = class extends Assign {
      constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects), this.op = op;
      }
      render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
      }
    }, Label = class extends Node {
      constructor(label) {
        super(), this.label = label, this.names = {};
      }
      render({ _n }) {
        return `${this.label}:` + _n;
      }
    }, Break = class extends Node {
      constructor(label) {
        super(), this.label = label, this.names = {};
      }
      render({ _n }) {
        return `break${this.label ? ` ${this.label}` : ""};` + _n;
      }
    }, Throw = class extends Node {
      constructor(error) {
        super(), this.error = error;
      }
      render({ _n }) {
        return `throw ${this.error};` + _n;
      }
      get names() {
        return this.error.names;
      }
    }, AnyCode = class extends Node {
      constructor(code) {
        super(), this.code = code;
      }
      render({ _n }) {
        return `${this.code};` + _n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(names, constants) {
        return this.code = optimizeExpr(this.code, names, constants), this;
      }
      get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
      }
    }, ParentNode = class extends Node {
      constructor(nodes = []) {
        super(), this.nodes = nodes;
      }
      render(opts) {
        return this.nodes.reduce((code, n) => code + n.render(opts), "");
      }
      optimizeNodes() {
        let { nodes } = this, i = nodes.length;
        for (; i--; ) {
          let n = nodes[i].optimizeNodes();
          Array.isArray(n) ? nodes.splice(i, 1, ...n) : n ? nodes[i] = n : nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      optimizeNames(names, constants) {
        let { nodes } = this, i = nodes.length;
        for (; i--; ) {
          let n = nodes[i];
          n.optimizeNames(names, constants) || (subtractNames(names, n.names), nodes.splice(i, 1));
        }
        return nodes.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
      }
    }, BlockNode = class extends ParentNode {
      render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
      }
    }, Root = class extends ParentNode {
    }, Else = class extends BlockNode {
    };
    Else.kind = "else";
    var If = class _If extends BlockNode {
      constructor(condition, nodes) {
        super(nodes), this.condition = condition;
      }
      render(opts) {
        let code = `if(${this.condition})` + super.render(opts);
        return this.else && (code += "else " + this.else.render(opts)), code;
      }
      optimizeNodes() {
        super.optimizeNodes();
        let cond = this.condition;
        if (cond === !0)
          return this.nodes;
        let e = this.else;
        if (e) {
          let ns = e.optimizeNodes();
          e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e)
          return cond === !1 ? e instanceof _If ? e : e.nodes : this.nodes.length ? this : new _If(not(cond), e instanceof _If ? [e] : e.nodes);
        if (!(cond === !1 || !this.nodes.length))
          return this;
      }
      optimizeNames(names, constants) {
        var _a;
        if (this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants), !!(super.optimizeNames(names, constants) || this.else))
          return this.condition = optimizeExpr(this.condition, names, constants), this;
      }
      get names() {
        let names = super.names;
        return addExprNames(names, this.condition), this.else && addNames(names, this.else.names), names;
      }
    };
    If.kind = "if";
    var For = class extends BlockNode {
    };
    For.kind = "for";
    var ForLoop = class extends For {
      constructor(iteration) {
        super(), this.iteration = iteration;
      }
      render(opts) {
        return `for(${this.iteration})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (super.optimizeNames(names, constants))
          return this.iteration = optimizeExpr(this.iteration, names, constants), this;
      }
      get names() {
        return addNames(super.names, this.iteration.names);
      }
    }, ForRange = class extends For {
      constructor(varKind, name, from, to) {
        super(), this.varKind = varKind, this.name = name, this.from = from, this.to = to;
      }
      render(opts) {
        let varKind = opts.es5 ? scope_1.varKinds.var : this.varKind, { name, from, to } = this;
        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
      }
      get names() {
        let names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
      }
    }, ForIter = class extends For {
      constructor(loop, varKind, name, iterable) {
        super(), this.loop = loop, this.varKind = varKind, this.name = name, this.iterable = iterable;
      }
      render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (super.optimizeNames(names, constants))
          return this.iterable = optimizeExpr(this.iterable, names, constants), this;
      }
      get names() {
        return addNames(super.names, this.iterable.names);
      }
    }, Func = class extends BlockNode {
      constructor(name, args, async) {
        super(), this.name = name, this.args = args, this.async = async;
      }
      render(opts) {
        return `${this.async ? "async " : ""}function ${this.name}(${this.args})` + super.render(opts);
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
        return this.catch && (code += this.catch.render(opts)), this.finally && (code += this.finally.render(opts)), code;
      }
      optimizeNodes() {
        var _a, _b;
        return super.optimizeNodes(), (_a = this.catch) === null || _a === void 0 || _a.optimizeNodes(), (_b = this.finally) === null || _b === void 0 || _b.optimizeNodes(), this;
      }
      optimizeNames(names, constants) {
        var _a, _b;
        return super.optimizeNames(names, constants), (_a = this.catch) === null || _a === void 0 || _a.optimizeNames(names, constants), (_b = this.finally) === null || _b === void 0 || _b.optimizeNames(names, constants), this;
      }
      get names() {
        let names = super.names;
        return this.catch && addNames(names, this.catch.names), this.finally && addNames(names, this.finally.names), names;
      }
    }, Catch = class extends BlockNode {
      constructor(error) {
        super(), this.error = error;
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
        this._values = {}, this._blockStarts = [], this._constants = {}, this.opts = { ...opts, _n: opts.lines ? `
` : "" }, this._extScope = extScope, this._scope = new scope_1.Scope({ parent: extScope }), this._nodes = [new Root()];
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
        let name = this._extScope.value(prefixOrName, value);
        return (this._values[name.prefix] || (this._values[name.prefix] = /* @__PURE__ */ new Set())).add(name), name;
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
        let name = this._scope.toName(nameOrPrefix);
        return rhs !== void 0 && constant && (this._constants[name.str] = rhs), this._leafNode(new Def(varKind, name, rhs)), name;
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
        return typeof c == "function" ? c() : c !== code_1.nil && this._leafNode(new AnyCode(c)), this;
      }
      // returns code for object literal for the passed argument list of key-value pairs
      object(...keyValues) {
        let code = ["{"];
        for (let [key, value] of keyValues)
          code.length > 1 && code.push(","), code.push(key), (key !== value || this.opts.es5) && (code.push(":"), (0, code_1.addCodeArg)(code, value));
        return code.push("}"), new code_1._Code(code);
      }
      // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
      if(condition, thenBody, elseBody) {
        if (this._blockNode(new If(condition)), thenBody && elseBody)
          this.code(thenBody).else().code(elseBody).endIf();
        else if (thenBody)
          this.code(thenBody).endIf();
        else if (elseBody)
          throw new Error('CodeGen: "else" body without "then" body');
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
        return this._blockNode(node), forBody && this.code(forBody).endFor(), this;
      }
      // a generic `for` clause (or statement if `forBody` is passed)
      for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
      }
      // `for` statement for a range of values
      forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        let name = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
      }
      // `for-of` statement (in es5 mode replace with a normal for loop)
      forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        let name = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
          let arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
          return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
            this.var(name, (0, code_1._)`${arr}[${i}]`), forBody(name);
          });
        }
        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
      }
      // `for-in` statement.
      // With option `ownProperties` replaced with a `for-of` loop for object keys
      forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties)
          return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
        let name = this._scope.toName(nameOrPrefix);
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
        let node = new Return();
        if (this._blockNode(node), this.code(value), node.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
      }
      // `try` statement
      try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        let node = new Try();
        if (this._blockNode(node), this.code(tryBody), catchCode) {
          let error = this.name("e");
          this._currNode = node.catch = new Catch(error), catchCode(error);
        }
        return finallyCode && (this._currNode = node.finally = new Finally(), this.code(finallyCode)), this._endBlockNode(Catch, Finally);
      }
      // `throw` statement
      throw(error) {
        return this._leafNode(new Throw(error));
      }
      // start self-balancing block
      block(body, nodeCount) {
        return this._blockStarts.push(this._nodes.length), body && this.code(body).endBlock(nodeCount), this;
      }
      // end the current self-balancing block
      endBlock(nodeCount) {
        let len = this._blockStarts.pop();
        if (len === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        let toClose = this._nodes.length - len;
        if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount)
          throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        return this._nodes.length = len, this;
      }
      // `function` heading (or definition if funcBody is passed)
      func(name, args = code_1.nil, async, funcBody) {
        return this._blockNode(new Func(name, args, async)), funcBody && this.code(funcBody).endFunc(), this;
      }
      // end function definition
      endFunc() {
        return this._endBlockNode(Func);
      }
      optimize(n = 1) {
        for (; n-- > 0; )
          this._root.optimizeNodes(), this._root.optimizeNames(this._root.names, this._constants);
      }
      _leafNode(node) {
        return this._currNode.nodes.push(node), this;
      }
      _blockNode(node) {
        this._currNode.nodes.push(node), this._nodes.push(node);
      }
      _endBlockNode(N1, N2) {
        let n = this._currNode;
        if (n instanceof N1 || N2 && n instanceof N2)
          return this._nodes.pop(), this;
        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
      }
      _elseNode(node) {
        let n = this._currNode;
        if (!(n instanceof If))
          throw new Error('CodeGen: "else" without "if"');
        return this._currNode = n.else = node, this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        let ns = this._nodes;
        return ns[ns.length - 1];
      }
      set _currNode(node) {
        let ns = this._nodes;
        ns[ns.length - 1] = node;
      }
    };
    exports.CodeGen = CodeGen;
    function addNames(names, from) {
      for (let n in from)
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
      return new code_1._Code(expr._items.reduce((items, c) => (c instanceof code_1.Name && (c = replaceName(c)), c instanceof code_1._Code ? items.push(...c._items) : items.push(c), items), []));
      function replaceName(n) {
        let c = constants[n.str];
        return c === void 0 || names[n.str] !== 1 ? n : (delete names[n.str], c);
      }
      function canOptimize(e) {
        return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== void 0);
      }
    }
    function subtractNames(names, from) {
      for (let n in from)
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
    var codegen_1 = require_codegen(), code_1 = require_code();
    function toHash(arr) {
      let hash = {};
      for (let item of arr)
        hash[item] = !0;
      return hash;
    }
    exports.toHash = toHash;
    function alwaysValidSchema(it, schema) {
      return typeof schema == "boolean" ? schema : Object.keys(schema).length === 0 ? !0 : (checkUnknownRules(it, schema), !schemaHasRules(schema, it.self.RULES.all));
    }
    exports.alwaysValidSchema = alwaysValidSchema;
    function checkUnknownRules(it, schema = it.schema) {
      let { opts, self } = it;
      if (!opts.strictSchema || typeof schema == "boolean")
        return;
      let rules = self.RULES.keywords;
      for (let key in schema)
        rules[key] || checkStrictMode(it, `unknown keyword: "${key}"`);
    }
    exports.checkUnknownRules = checkUnknownRules;
    function schemaHasRules(schema, rules) {
      if (typeof schema == "boolean")
        return !schema;
      for (let key in schema)
        if (rules[key])
          return !0;
      return !1;
    }
    exports.schemaHasRules = schemaHasRules;
    function schemaHasRulesButRef(schema, RULES) {
      if (typeof schema == "boolean")
        return !schema;
      for (let key in schema)
        if (key !== "$ref" && RULES.all[key])
          return !0;
      return !1;
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
      return typeof str == "number" ? `${str}` : str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports.escapeJsonPointer = escapeJsonPointer;
    function unescapeJsonPointer(str) {
      return str.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports.unescapeJsonPointer = unescapeJsonPointer;
    function eachItem(xs, f) {
      if (Array.isArray(xs))
        for (let x of xs)
          f(x);
      else
        f(xs);
    }
    exports.eachItem = eachItem;
    function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
      return (gen, from, to, toName) => {
        let res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
      };
    }
    exports.mergeEvaluated = {
      props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
          gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, !0), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
          from === !0 ? gen.assign(to, !0) : (gen.assign(to, (0, codegen_1._)`${to} || {}`), setEvaluated(gen, to, from));
        }),
        mergeValues: (from, to) => from === !0 ? !0 : { ...from, ...to },
        resultToName: evaluatedPropsToName
      }),
      items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === !0 ? !0 : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => from === !0 ? !0 : Math.max(from, to),
        resultToName: (gen, items) => gen.var("items", items)
      })
    };
    function evaluatedPropsToName(gen, ps) {
      if (ps === !0)
        return gen.var("props", !0);
      let props = gen.var("props", (0, codegen_1._)`{}`);
      return ps !== void 0 && setEvaluated(gen, props, ps), props;
    }
    exports.evaluatedPropsToName = evaluatedPropsToName;
    function setEvaluated(gen, props, ps) {
      Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, !0));
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
      Type2[Type2.Num = 0] = "Num", Type2[Type2.Str = 1] = "Str";
    })(Type || (exports.Type = Type = {}));
    function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
      if (dataProp instanceof codegen_1.Name) {
        let isNumber = dataPropType === Type.Num;
        return jsPropertySyntax ? isNumber ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
      }
      return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
    }
    exports.getErrorPath = getErrorPath;
    function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
      if (mode) {
        if (msg = `strict mode: ${msg}`, mode === !0)
          throw new Error(msg);
        it.self.logger.warn(msg);
      }
    }
    exports.checkStrictMode = checkStrictMode;
  }
});

// node_modules/ajv/dist/compile/names.js
var require_names = __commonJS({
  "node_modules/ajv/dist/compile/names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), names = {
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
    var codegen_1 = require_codegen(), util_1 = require_util(), names_1 = require_names();
    exports.keywordError = {
      message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
    };
    exports.keyword$DataError = {
      message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
    };
    function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
      let { it } = cxt, { gen, compositeRule, allErrors } = it, errObj = errorObjectCode(cxt, error, errorPaths);
      overrideAllErrors ?? (compositeRule || allErrors) ? addError(gen, errObj) : returnErrors(it, (0, codegen_1._)`[${errObj}]`);
    }
    exports.reportError = reportError;
    function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
      let { it } = cxt, { gen, compositeRule, allErrors } = it, errObj = errorObjectCode(cxt, error, errorPaths);
      addError(gen, errObj), compositeRule || allErrors || returnErrors(it, names_1.default.vErrors);
    }
    exports.reportExtraError = reportExtraError;
    function resetErrorsCount(gen, errsCount) {
      gen.assign(names_1.default.errors, errsCount), gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
    }
    exports.resetErrorsCount = resetErrorsCount;
    function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
      if (errsCount === void 0)
        throw new Error("ajv implementation error");
      let err = gen.name("err");
      gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`), gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath))), gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`), it.opts.verbose && (gen.assign((0, codegen_1._)`${err}.schema`, schemaValue), gen.assign((0, codegen_1._)`${err}.data`, data));
      });
    }
    exports.extendErrors = extendErrors;
    function addError(gen, errObj) {
      let err = gen.const("err", errObj);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`), gen.code((0, codegen_1._)`${names_1.default.errors}++`);
    }
    function returnErrors(it, errs) {
      let { gen, validateName, schemaEnv } = it;
      schemaEnv.$async ? gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`) : (gen.assign((0, codegen_1._)`${validateName}.errors`, errs), gen.return(!1));
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
      let { createErrors } = cxt.it;
      return createErrors === !1 ? (0, codegen_1._)`{}` : errorObject(cxt, error, errorPaths);
    }
    function errorObject(cxt, error, errorPaths = {}) {
      let { gen, it } = cxt, keyValues = [
        errorInstancePath(it, errorPaths),
        errorSchemaPath(cxt, errorPaths)
      ];
      return extraErrorProps(cxt, error, keyValues), gen.object(...keyValues);
    }
    function errorInstancePath({ errorPath }, { instancePath }) {
      let instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
      return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
    }
    function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
      let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
      return schemaPath && (schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`), [E.schemaPath, schPath];
    }
    function extraErrorProps(cxt, { params, message }, keyValues) {
      let { keyword, data, schemaValue, it } = cxt, { opts, propertyName, topSchemaRef, schemaPath } = it;
      keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]), opts.messages && keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]), opts.verbose && keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]), propertyName && keyValues.push([E.propertyName, propertyName]);
    }
  }
});

// node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS({
  "node_modules/ajv/dist/compile/validate/boolSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
    var errors_1 = require_errors(), codegen_1 = require_codegen(), names_1 = require_names(), boolError = {
      message: "boolean schema is false"
    };
    function topBoolOrEmptySchema(it) {
      let { gen, schema, validateName } = it;
      schema === !1 ? falseSchemaError(it, !1) : typeof schema == "object" && schema.$async === !0 ? gen.return(names_1.default.data) : (gen.assign((0, codegen_1._)`${validateName}.errors`, null), gen.return(!0));
    }
    exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
    function boolOrEmptySchema(it, valid) {
      let { gen, schema } = it;
      schema === !1 ? (gen.var(valid, !1), falseSchemaError(it)) : gen.var(valid, !0);
    }
    exports.boolOrEmptySchema = boolOrEmptySchema;
    function falseSchemaError(it, overrideAllErrors) {
      let { gen, data } = it, cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: !1,
        schemaCode: !1,
        schemaValue: !1,
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.getRules = exports.isJSONType = void 0;
    var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"], jsonTypes = new Set(_jsonTypes);
    function isJSONType(x) {
      return typeof x == "string" && jsonTypes.has(x);
    }
    exports.isJSONType = isJSONType;
    function getRules() {
      let groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] }
      };
      return {
        types: { ...groups, integer: !0, boolean: !0, null: !0 },
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
    function schemaHasRulesForType({ schema, self }, type) {
      let group = self.RULES.types[type];
      return group && group !== !0 && shouldUseGroup(schema, group);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
    var rules_1 = require_rules(), applicability_1 = require_applicability(), errors_1 = require_errors(), codegen_1 = require_codegen(), util_1 = require_util(), DataType;
    (function(DataType2) {
      DataType2[DataType2.Correct = 0] = "Correct", DataType2[DataType2.Wrong = 1] = "Wrong";
    })(DataType || (exports.DataType = DataType = {}));
    function getSchemaTypes(schema) {
      let types = getJSONTypes(schema.type);
      if (types.includes("null")) {
        if (schema.nullable === !1)
          throw new Error("type: null contradicts nullable: false");
      } else {
        if (!types.length && schema.nullable !== void 0)
          throw new Error('"nullable" cannot be used without "type"');
        schema.nullable === !0 && types.push("null");
      }
      return types;
    }
    exports.getSchemaTypes = getSchemaTypes;
    function getJSONTypes(ts) {
      let types = Array.isArray(ts) ? ts : ts ? [ts] : [];
      if (types.every(rules_1.isJSONType))
        return types;
      throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
    }
    exports.getJSONTypes = getJSONTypes;
    function coerceAndCheckDataType(it, types) {
      let { gen, data, opts } = it, coerceTo = coerceToTypes(types, opts.coerceTypes), checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
      if (checkTypes) {
        let wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
          coerceTo.length ? coerceData(it, types, coerceTo) : reportTypeError(it);
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
      let { gen, data, opts } = it, dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`), coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
      opts.coerceTypes === "array" && gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data))), gen.if((0, codegen_1._)`${coerced} !== undefined`);
      for (let t of coerceTo)
        (COERCIBLE.has(t) || t === "array" && opts.coerceTypes === "array") && coerceSpecificType(t);
      gen.else(), reportTypeError(it), gen.endIf(), gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
        gen.assign(data, coerced), assignParentData(it, coerced);
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
            gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, !1).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, !0);
            return;
          case "null":
            gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`), gen.assign(coerced, null);
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
      let EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ, cond;
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
      if (dataTypes.length === 1)
        return checkDataType(dataTypes[0], data, strictNums, correct);
      let cond, types = (0, util_1.toHash)(dataTypes);
      if (types.array && types.object) {
        let notObj = (0, codegen_1._)`typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`, delete types.null, delete types.array, delete types.object;
      } else
        cond = codegen_1.nil;
      types.number && delete types.integer;
      for (let t in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
      return cond;
    }
    exports.checkDataTypes = checkDataTypes;
    var typeError = {
      message: ({ schema }) => `must be ${schema}`,
      params: ({ schema, schemaValue }) => typeof schema == "string" ? (0, codegen_1._)`{type: ${schema}}` : (0, codegen_1._)`{type: ${schemaValue}}`
    };
    function reportTypeError(it) {
      let cxt = getTypeErrorContext(it);
      (0, errors_1.reportError)(cxt, typeError);
    }
    exports.reportTypeError = reportTypeError;
    function getTypeErrorContext(it) {
      let { gen, data, schema } = it, schemaCode = (0, util_1.schemaRefOrVal)(it, schema, "type");
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.assignDefaults = void 0;
    var codegen_1 = require_codegen(), util_1 = require_util();
    function assignDefaults(it, ty) {
      let { properties, items } = it.schema;
      if (ty === "object" && properties)
        for (let key in properties)
          assignDefault(it, key, properties[key].default);
      else ty === "array" && Array.isArray(items) && items.forEach((sch, i) => assignDefault(it, i, sch.default));
    }
    exports.assignDefaults = assignDefaults;
    function assignDefault(it, prop, defaultValue) {
      let { gen, compositeRule, data, opts } = it;
      if (defaultValue === void 0)
        return;
      let childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
      if (compositeRule) {
        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
        return;
      }
      let condition = (0, codegen_1._)`${childData} === undefined`;
      opts.useDefaults === "empty" && (condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`), gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
    }
  }
});

// node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
    var codegen_1 = require_codegen(), util_1 = require_util(), names_1 = require_names(), util_2 = require_util();
    function checkReportMissingProp(cxt, prop) {
      let { gen, data, it } = cxt;
      gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, !0), cxt.error();
      });
    }
    exports.checkReportMissingProp = checkReportMissingProp;
    function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
      return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
    }
    exports.checkMissingProp = checkMissingProp;
    function reportMissingProp(cxt, missing) {
      cxt.setParams({ missingProperty: missing }, !0), cxt.error();
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
      let cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
      return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
    }
    exports.propertyInData = propertyInData;
    function noPropertyInData(gen, data, property, ownProperties) {
      let cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
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
      let dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data, valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it.parentData],
        [names_1.default.parentDataProperty, it.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData]
      ];
      it.opts.dynamicRef && valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
      let args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
      return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
    }
    exports.callValidateCode = callValidateCode;
    var newRegExp = (0, codegen_1._)`new RegExp`;
    function usePattern({ gen, it: { opts } }, pattern) {
      let u = opts.unicodeRegExp ? "u" : "", { regExp } = opts.code, rx = regExp(pattern, u);
      return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u})`
      });
    }
    exports.usePattern = usePattern;
    function validateArray(cxt) {
      let { gen, data, keyword, it } = cxt, valid = gen.name("valid");
      if (it.allErrors) {
        let validArr = gen.let("valid", !0);
        return validateItems(() => gen.assign(validArr, !1)), validArr;
      }
      return gen.var(valid, !0), validateItems(() => gen.break()), valid;
      function validateItems(notValid) {
        let len = gen.const("len", (0, codegen_1._)`${data}.length`);
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword,
            dataProp: i,
            dataPropType: util_1.Type.Num
          }, valid), gen.if((0, codegen_1.not)(valid), notValid);
        });
      }
    }
    exports.validateArray = validateArray;
    function validateUnion(cxt) {
      let { gen, schema, keyword, it } = cxt;
      if (!Array.isArray(schema))
        throw new Error("ajv implementation error");
      if (schema.some((sch) => (0, util_1.alwaysValidSchema)(it, sch)) && !it.opts.unevaluated)
        return;
      let valid = gen.let("valid", !1), schValid = gen.name("_valid");
      gen.block(() => schema.forEach((_sch, i) => {
        let schCxt = cxt.subschema({
          keyword,
          schemaProp: i,
          compositeRule: !0
        }, schValid);
        gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`), cxt.mergeValidEvaluated(schCxt, schValid) || gen.if((0, codegen_1.not)(valid));
      })), cxt.result(valid, () => cxt.reset(), () => cxt.error(!0));
    }
    exports.validateUnion = validateUnion;
  }
});

// node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS({
  "node_modules/ajv/dist/compile/validate/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
    var codegen_1 = require_codegen(), names_1 = require_names(), code_1 = require_code2(), errors_1 = require_errors();
    function macroKeywordCode(cxt, def) {
      let { gen, keyword, schema, parentSchema, it } = cxt, macroSchema = def.macro.call(it.self, schema, parentSchema, it), schemaRef = useKeyword(gen, keyword, macroSchema);
      it.opts.validateSchema !== !1 && it.self.validateSchema(macroSchema, !0);
      let valid = gen.name("valid");
      cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: !0
      }, valid), cxt.pass(valid, () => cxt.error(!0));
    }
    exports.macroKeywordCode = macroKeywordCode;
    function funcKeywordCode(cxt, def) {
      var _a;
      let { gen, keyword, schema, parentSchema, $data, it } = cxt;
      checkAsyncKeyword(it, def);
      let validate = !$data && def.compile ? def.compile.call(it.self, schema, parentSchema, it) : def.validate, validateRef = useKeyword(gen, keyword, validate), valid = gen.let("valid");
      cxt.block$data(valid, validateKeyword), cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
      function validateKeyword() {
        if (def.errors === !1)
          assignValid(), def.modifying && modifyData(cxt), reportErrs(() => cxt.error());
        else {
          let ruleErrs = def.async ? validateAsync() : validateSync();
          def.modifying && modifyData(cxt), reportErrs(() => addErrs(cxt, ruleErrs));
        }
      }
      function validateAsync() {
        let ruleErrs = gen.let("ruleErrs", null);
        return gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, !1).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e))), ruleErrs;
      }
      function validateSync() {
        let validateErrs = (0, codegen_1._)`${validateRef}.errors`;
        return gen.assign(validateErrs, null), assignValid(codegen_1.nil), validateErrs;
      }
      function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
        let passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self, passSchema = !("compile" in def && !$data || def.schema === !1);
        gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
      }
      function reportErrs(errors) {
        var _a2;
        gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== void 0 ? _a2 : valid), errors);
      }
    }
    exports.funcKeywordCode = funcKeywordCode;
    function modifyData(cxt) {
      let { gen, data, it } = cxt;
      gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
    }
    function addErrs(cxt, errs) {
      let { gen } = cxt;
      gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`), (0, errors_1.extendErrors)(cxt);
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
    function validSchemaType(schema, schemaType, allowUndefined = !1) {
      return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema) : st === "object" ? schema && typeof schema == "object" && !Array.isArray(schema) : typeof schema == st || allowUndefined && typeof schema > "u");
    }
    exports.validSchemaType = validSchemaType;
    function validateKeywordUsage({ schema, opts, self, errSchemaPath }, def, keyword) {
      if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword)
        throw new Error("ajv implementation error");
      let deps = def.dependencies;
      if (deps?.some((kwd) => !Object.prototype.hasOwnProperty.call(schema, kwd)))
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
      if (def.validateSchema && !def.validateSchema(schema[keyword])) {
        let msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self.errorsText(def.validateSchema.errors);
        if (opts.validateSchema === "log")
          self.logger.error(msg);
        else
          throw new Error(msg);
      }
    }
    exports.validateKeywordUsage = validateKeywordUsage;
  }
});

// node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS({
  "node_modules/ajv/dist/compile/validate/subschema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
    var codegen_1 = require_codegen(), util_1 = require_util();
    function getSubschema(it, { keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }) {
      if (keyword !== void 0 && schema !== void 0)
        throw new Error('both "keyword" and "schema" passed, only one allowed');
      if (keyword !== void 0) {
        let sch = it.schema[keyword];
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
        if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0)
          throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
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
      if (data !== void 0 && dataProp !== void 0)
        throw new Error('both "data" and "dataProp" passed, only one allowed');
      let { gen } = it;
      if (dataProp !== void 0) {
        let { errorPath, dataPathArr, opts } = it, nextData = gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, !0);
        dataContextProps(nextData), subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`, subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`, subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
      }
      if (data !== void 0) {
        let nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, !0);
        dataContextProps(nextData), propertyName !== void 0 && (subschema.propertyName = propertyName);
      }
      dataTypes && (subschema.dataTypes = dataTypes);
      function dataContextProps(_nextData) {
        subschema.data = _nextData, subschema.dataLevel = it.dataLevel + 1, subschema.dataTypes = [], it.definedProperties = /* @__PURE__ */ new Set(), subschema.parentData = it.data, subschema.dataNames = [...it.dataNames, _nextData];
      }
    }
    exports.extendSubschemaData = extendSubschemaData;
    function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
      compositeRule !== void 0 && (subschema.compositeRule = compositeRule), createErrors !== void 0 && (subschema.createErrors = createErrors), allErrors !== void 0 && (subschema.allErrors = allErrors), subschema.jtdDiscriminator = jtdDiscriminator, subschema.jtdMetadata = jtdMetadata;
    }
    exports.extendSubschemaMode = extendSubschemaMode;
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return !0;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return !1;
        var length, i, keys;
        if (Array.isArray(a)) {
          if (length = a.length, length != b.length) return !1;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return !1;
          return !0;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        if (keys = Object.keys(a), length = keys.length, length !== Object.keys(b).length) return !1;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return !1;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return !1;
        }
        return !0;
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
      typeof opts == "function" && (cb = opts, opts = {}), cb = opts.cb || cb;
      var pre = typeof cb == "function" ? cb : cb.pre || function() {
      }, post = cb.post || function() {
      };
      _traverse(opts, pre, post, schema, "", schema);
    };
    traverse.keywords = {
      additionalItems: !0,
      items: !0,
      contains: !0,
      additionalProperties: !0,
      propertyNames: !0,
      not: !0,
      if: !0,
      then: !0,
      else: !0
    };
    traverse.arrayKeywords = {
      items: !0,
      allOf: !0,
      anyOf: !0,
      oneOf: !0
    };
    traverse.propsKeywords = {
      $defs: !0,
      definitions: !0,
      properties: !0,
      patternProperties: !0,
      dependencies: !0
    };
    traverse.skipKeywords = {
      default: !0,
      enum: !0,
      const: !0,
      required: !0,
      maximum: !0,
      minimum: !0,
      exclusiveMaximum: !0,
      exclusiveMinimum: !0,
      multipleOf: !0,
      maxLength: !0,
      minLength: !0,
      pattern: !0,
      format: !0,
      maxItems: !0,
      minItems: !0,
      uniqueItems: !0,
      maxProperties: !0,
      minProperties: !0
    };
    function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (schema && typeof schema == "object" && !Array.isArray(schema)) {
        pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        for (var key in schema) {
          var sch = schema[key];
          if (Array.isArray(sch)) {
            if (key in traverse.arrayKeywords)
              for (var i = 0; i < sch.length; i++)
                _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema, i);
          } else if (key in traverse.propsKeywords) {
            if (sch && typeof sch == "object")
              for (var prop in sch)
                _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
          } else (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) && _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
    var util_1 = require_util(), equal = require_fast_deep_equal(), traverse = require_json_schema_traverse(), SIMPLE_INLINED = /* @__PURE__ */ new Set([
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
    function inlineRef(schema, limit = !0) {
      return typeof schema == "boolean" ? !0 : limit === !0 ? !hasRef(schema) : limit ? countKeys(schema) <= limit : !1;
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
      for (let key in schema) {
        if (REF_KEYWORDS.has(key))
          return !0;
        let sch = schema[key];
        if (Array.isArray(sch) && sch.some(hasRef) || typeof sch == "object" && hasRef(sch))
          return !0;
      }
      return !1;
    }
    function countKeys(schema) {
      let count = 0;
      for (let key in schema) {
        if (key === "$ref")
          return 1 / 0;
        if (count++, !SIMPLE_INLINED.has(key) && (typeof schema[key] == "object" && (0, util_1.eachItem)(schema[key], (sch) => count += countKeys(sch)), count === 1 / 0))
          return 1 / 0;
      }
      return count;
    }
    function getFullPath(resolver, id = "", normalize) {
      normalize !== !1 && (id = normalizeId(id));
      let p = resolver.parse(id);
      return _getFullPath(resolver, p);
    }
    exports.getFullPath = getFullPath;
    function _getFullPath(resolver, p) {
      return resolver.serialize(p).split("#")[0] + "#";
    }
    exports._getFullPath = _getFullPath;
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
      return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    exports.normalizeId = normalizeId;
    function resolveUrl(resolver, baseId, id) {
      return id = normalizeId(id), resolver.resolve(baseId, id);
    }
    exports.resolveUrl = resolveUrl;
    var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
    function getSchemaRefs(schema, baseId) {
      if (typeof schema == "boolean")
        return {};
      let { schemaId, uriResolver } = this.opts, schId = normalizeId(schema[schemaId] || baseId), baseIds = { "": schId }, pathPrefix = getFullPath(uriResolver, schId, !1), localRefs = {}, schemaRefs = /* @__PURE__ */ new Set();
      return traverse(schema, { allKeys: !0 }, (sch, jsonPtr, _, parentJsonPtr) => {
        if (parentJsonPtr === void 0)
          return;
        let fullPath = pathPrefix + jsonPtr, innerBaseId = baseIds[parentJsonPtr];
        typeof sch[schemaId] == "string" && (innerBaseId = addRef.call(this, sch[schemaId])), addAnchor.call(this, sch.$anchor), addAnchor.call(this, sch.$dynamicAnchor), baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
          let _resolve = this.opts.uriResolver.resolve;
          if (ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref), schemaRefs.has(ref))
            throw ambiguos(ref);
          schemaRefs.add(ref);
          let schOrRef = this.refs[ref];
          return typeof schOrRef == "string" && (schOrRef = this.refs[schOrRef]), typeof schOrRef == "object" ? checkAmbiguosRef(sch, schOrRef.schema, ref) : ref !== normalizeId(fullPath) && (ref[0] === "#" ? (checkAmbiguosRef(sch, localRefs[ref], ref), localRefs[ref] = sch) : this.refs[ref] = fullPath), ref;
        }
        function addAnchor(anchor) {
          if (typeof anchor == "string") {
            if (!ANCHOR.test(anchor))
              throw new Error(`invalid anchor "${anchor}"`);
            addRef.call(this, `#${anchor}`);
          }
        }
      }), localRefs;
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
    var boolSchema_1 = require_boolSchema(), dataType_1 = require_dataType(), applicability_1 = require_applicability(), dataType_2 = require_dataType(), defaults_1 = require_defaults(), keyword_1 = require_keyword(), subschema_1 = require_subschema(), codegen_1 = require_codegen(), names_1 = require_names(), resolve_1 = require_resolve(), util_1 = require_util(), errors_1 = require_errors();
    function validateFunctionCode(it) {
      if (isSchemaObj(it) && (checkKeywords(it), schemaCxtHasRules(it))) {
        topSchemaObjCode(it);
        return;
      }
      validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
    }
    exports.validateFunctionCode = validateFunctionCode;
    function validateFunction({ gen, validateName, schema, schemaEnv, opts }, body) {
      opts.code.es5 ? gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
        gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema, opts)}`), destructureValCxtES5(gen, opts), gen.code(body);
      }) : gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema, opts)).code(body));
    }
    function destructureValCxt(opts) {
      return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
    }
    function destructureValCxtES5(gen, opts) {
      gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`), gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`), gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`), gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`), opts.dynamicRef && gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
      }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`""`), gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`), gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`), gen.var(names_1.default.rootData, names_1.default.data), opts.dynamicRef && gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
      });
    }
    function topSchemaObjCode(it) {
      let { schema, opts, gen } = it;
      validateFunction(it, () => {
        opts.$comment && schema.$comment && commentKeyword(it), checkNoDefault(it), gen.let(names_1.default.vErrors, null), gen.let(names_1.default.errors, 0), opts.unevaluated && resetEvaluated(it), typeAndKeywords(it), returnResults(it);
      });
    }
    function resetEvaluated(it) {
      let { gen, validateName } = it;
      it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`), gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`)), gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
    }
    function funcSourceUrl(schema, opts) {
      let schId = typeof schema == "object" && schema[opts.schemaId];
      return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
    }
    function subschemaCode(it, valid) {
      if (isSchemaObj(it) && (checkKeywords(it), schemaCxtHasRules(it))) {
        subSchemaObjCode(it, valid);
        return;
      }
      (0, boolSchema_1.boolOrEmptySchema)(it, valid);
    }
    function schemaCxtHasRules({ schema, self }) {
      if (typeof schema == "boolean")
        return !schema;
      for (let key in schema)
        if (self.RULES.all[key])
          return !0;
      return !1;
    }
    function isSchemaObj(it) {
      return typeof it.schema != "boolean";
    }
    function subSchemaObjCode(it, valid) {
      let { schema, gen, opts } = it;
      opts.$comment && schema.$comment && commentKeyword(it), updateContext(it), checkAsyncSchema(it);
      let errsCount = gen.const("_errs", names_1.default.errors);
      typeAndKeywords(it, errsCount), gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
    }
    function checkKeywords(it) {
      (0, util_1.checkUnknownRules)(it), checkRefsAndKeywords(it);
    }
    function typeAndKeywords(it, errsCount) {
      if (it.opts.jtd)
        return schemaKeywords(it, [], !1, errsCount);
      let types = (0, dataType_1.getSchemaTypes)(it.schema), checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
      schemaKeywords(it, types, !checkedTypes, errsCount);
    }
    function checkRefsAndKeywords(it) {
      let { schema, errSchemaPath, opts, self } = it;
      schema.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema, self.RULES) && self.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
    }
    function checkNoDefault(it) {
      let { schema, opts } = it;
      schema.default !== void 0 && opts.useDefaults && opts.strictSchema && (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
    }
    function updateContext(it) {
      let schId = it.schema[it.opts.schemaId];
      schId && (it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId));
    }
    function checkAsyncSchema(it) {
      if (it.schema.$async && !it.schemaEnv.$async)
        throw new Error("async schema in sync schema");
    }
    function commentKeyword({ gen, schemaEnv, schema, errSchemaPath, opts }) {
      let msg = schema.$comment;
      if (opts.$comment === !0)
        gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
      else if (typeof opts.$comment == "function") {
        let schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`, rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
      }
    }
    function returnResults(it) {
      let { gen, schemaEnv, validateName, ValidationError, opts } = it;
      schemaEnv.$async ? gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`)) : (gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors), opts.unevaluated && assignEvaluated(it), gen.return((0, codegen_1._)`${names_1.default.errors} === 0`));
    }
    function assignEvaluated({ gen, evaluated, props, items }) {
      props instanceof codegen_1.Name && gen.assign((0, codegen_1._)`${evaluated}.props`, props), items instanceof codegen_1.Name && gen.assign((0, codegen_1._)`${evaluated}.items`, items);
    }
    function schemaKeywords(it, types, typeErrors, errsCount) {
      let { gen, schema, data, allErrors, opts, self } = it, { RULES } = self;
      if (schema.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema, RULES))) {
        gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition));
        return;
      }
      opts.jtd || checkStrictTypes(it, types), gen.block(() => {
        for (let group of RULES.rules)
          groupKeywords(group);
        groupKeywords(RULES.post);
      });
      function groupKeywords(group) {
        (0, applicability_1.shouldUseGroup)(schema, group) && (group.type ? (gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers)), iterateKeywords(it, group), types.length === 1 && types[0] === group.type && typeErrors && (gen.else(), (0, dataType_2.reportTypeError)(it)), gen.endIf()) : iterateKeywords(it, group), allErrors || gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`));
      }
    }
    function iterateKeywords(it, group) {
      let { gen, schema, opts: { useDefaults } } = it;
      useDefaults && (0, defaults_1.assignDefaults)(it, group.type), gen.block(() => {
        for (let rule of group.rules)
          (0, applicability_1.shouldUseRule)(schema, rule) && keywordCode(it, rule.keyword, rule.definition, group.type);
      });
    }
    function checkStrictTypes(it, types) {
      it.schemaEnv.meta || !it.opts.strictTypes || (checkContextTypes(it, types), it.opts.allowUnionTypes || checkMultipleTypes(it, types), checkKeywordTypes(it, it.dataTypes));
    }
    function checkContextTypes(it, types) {
      if (types.length) {
        if (!it.dataTypes.length) {
          it.dataTypes = types;
          return;
        }
        types.forEach((t) => {
          includesType(it.dataTypes, t) || strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
        }), narrowSchemaTypes(it, types);
      }
    }
    function checkMultipleTypes(it, ts) {
      ts.length > 1 && !(ts.length === 2 && ts.includes("null")) && strictTypesError(it, "use allowUnionTypes to allow union type keyword");
    }
    function checkKeywordTypes(it, ts) {
      let rules = it.self.RULES.all;
      for (let keyword in rules) {
        let rule = rules[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
          let { type } = rule.definition;
          type.length && !type.some((t) => hasApplicableType(ts, t)) && strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
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
      let ts = [];
      for (let t of it.dataTypes)
        includesType(withTypes, t) ? ts.push(t) : withTypes.includes("integer") && t === "number" && ts.push("integer");
      it.dataTypes = ts;
    }
    function strictTypesError(it, msg) {
      let schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
      msg += ` at "${schemaPath}" (strictTypes)`, (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
    }
    var KeywordCxt = class {
      constructor(it, def, keyword) {
        if ((0, keyword_1.validateKeywordUsage)(it, def, keyword), this.gen = it.gen, this.allErrors = it.allErrors, this.keyword = keyword, this.data = it.data, this.schema = it.schema[keyword], this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data, this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data), this.schemaType = def.schemaType, this.parentSchema = it.schema, this.params = {}, this.it = it, this.def = def, this.$data)
          this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
        else if (this.schemaCode = this.schemaValue, !(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined))
          throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
        ("code" in def ? def.trackErrors : def.errors !== !1) && (this.errsCount = it.gen.const("_errs", names_1.default.errors));
      }
      result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
      }
      failResult(condition, successAction, failAction) {
        this.gen.if(condition), failAction ? failAction() : this.error(), successAction ? (this.gen.else(), successAction(), this.allErrors && this.gen.endIf()) : this.allErrors ? this.gen.endIf() : this.gen.else();
      }
      pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), void 0, failAction);
      }
      fail(condition) {
        if (condition === void 0) {
          this.error(), this.allErrors || this.gen.if(!1);
          return;
        }
        this.gen.if(condition), this.error(), this.allErrors ? this.gen.endIf() : this.gen.else();
      }
      fail$data(condition) {
        if (!this.$data)
          return this.fail(condition);
        let { schemaCode } = this;
        this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
      }
      error(append, errorParams, errorPaths) {
        if (errorParams) {
          this.setParams(errorParams), this._error(append, errorPaths), this.setParams({});
          return;
        }
        this._error(append, errorPaths);
      }
      _error(append, errorPaths) {
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
        this.allErrors || this.gen.if(cond);
      }
      setParams(obj, assign) {
        assign ? Object.assign(this.params, obj) : this.params = obj;
      }
      block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
          this.check$data(valid, $dataValid), codeBlock();
        });
      }
      check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
          return;
        let { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid)), valid !== codegen_1.nil && gen.assign(valid, !0), (schemaType.length || def.validateSchema) && (gen.elseIf(this.invalid$data()), this.$dataError(), valid !== codegen_1.nil && gen.assign(valid, !1)), gen.else();
      }
      invalid$data() {
        let { gen, schemaCode, schemaType, def, it } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
          if (schemaType.length) {
            if (!(schemaCode instanceof codegen_1.Name))
              throw new Error("ajv implementation error");
            let st = Array.isArray(schemaType) ? schemaType : [schemaType];
            return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
          }
          return codegen_1.nil;
        }
        function invalid$DataSchema() {
          if (def.validateSchema) {
            let validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
            return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
          }
          return codegen_1.nil;
        }
      }
      subschema(appl, valid) {
        let subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl), (0, subschema_1.extendSubschemaMode)(subschema, appl);
        let nextContext = { ...this.it, ...subschema, items: void 0, props: void 0 };
        return subschemaCode(nextContext, valid), nextContext;
      }
      mergeEvaluated(schemaCxt, toName) {
        let { it, gen } = this;
        it.opts.unevaluated && (it.props !== !0 && schemaCxt.props !== void 0 && (it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName)), it.items !== !0 && schemaCxt.items !== void 0 && (it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName)));
      }
      mergeValidEvaluated(schemaCxt, valid) {
        let { it, gen } = this;
        if (it.opts.unevaluated && (it.props !== !0 || it.items !== !0))
          return gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name)), !0;
      }
    };
    exports.KeywordCxt = KeywordCxt;
    function keywordCode(it, keyword, def, ruleType) {
      let cxt = new KeywordCxt(it, def, keyword);
      "code" in def ? def.code(cxt, ruleType) : cxt.$data && def.validate ? (0, keyword_1.funcKeywordCode)(cxt, def) : "macro" in def ? (0, keyword_1.macroKeywordCode)(cxt, def) : (def.compile || def.validate) && (0, keyword_1.funcKeywordCode)(cxt, def);
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/, RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, { dataLevel, dataNames, dataPathArr }) {
      let jsonPointer, data;
      if ($data === "")
        return names_1.default.rootData;
      if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data, data = names_1.default.rootData;
      } else {
        let matches = RELATIVE_JSON_POINTER.exec($data);
        if (!matches)
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        let up = +matches[1];
        if (jsonPointer = matches[2], jsonPointer === "#") {
          if (up >= dataLevel)
            throw new Error(errorMsg("property/index", up));
          return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
          throw new Error(errorMsg("data", up));
        if (data = dataNames[dataLevel - up], !jsonPointer)
          return data;
      }
      let expr = data, segments = jsonPointer.split("/");
      for (let segment of segments)
        segment && (data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`, expr = (0, codegen_1._)`${expr} && ${data}`);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var ValidationError = class extends Error {
      constructor(errors) {
        super("validation failed"), this.errors = errors, this.ajv = this.validation = !0;
      }
    };
    exports.default = ValidationError;
  }
});

// node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS({
  "node_modules/ajv/dist/compile/ref_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var resolve_1 = require_resolve(), MissingRefError = class extends Error {
      constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`), this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref), this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
      }
    };
    exports.default = MissingRefError;
  }
});

// node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS({
  "node_modules/ajv/dist/compile/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
    var codegen_1 = require_codegen(), validation_error_1 = require_validation_error(), names_1 = require_names(), resolve_1 = require_resolve(), util_1 = require_util(), validate_1 = require_validate(), SchemaEnv = class {
      constructor(env) {
        var _a;
        this.refs = {}, this.dynamicAnchors = {};
        let schema;
        typeof env.schema == "object" && (schema = env.schema), this.schema = env.schema, this.schemaId = env.schemaId, this.root = env.root || this, this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema?.[env.schemaId || "$id"]), this.schemaPath = env.schemaPath, this.localRefs = env.localRefs, this.meta = env.meta, this.$async = schema?.$async, this.refs = {};
      }
    };
    exports.SchemaEnv = SchemaEnv;
    function compileSchema(sch) {
      let _sch = getCompilingSchema.call(this, sch);
      if (_sch)
        return _sch;
      let rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId), { es5, lines } = this.opts.code, { ownProperties } = this.opts, gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties }), _ValidationError;
      sch.$async && (_ValidationError = gen.scopeValue("Error", {
        ref: validation_error_1.default,
        code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
      }));
      let validateName = gen.scopeName("validate");
      sch.validateName = validateName;
      let schemaCxt = {
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
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === !0 ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
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
      }, sourceCode;
      try {
        this._compilations.add(sch), (0, validate_1.validateFunctionCode)(schemaCxt), gen.optimize(this.opts.code.optimize);
        let validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`, this.opts.code.process && (sourceCode = this.opts.code.process(sourceCode, sch));
        let validate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode)(this, this.scope.get());
        if (this.scope.value(validateName, { ref: validate }), validate.errors = null, validate.schema = sch.schema, validate.schemaEnv = sch, sch.$async && (validate.$async = !0), this.opts.code.source === !0 && (validate.source = { validateName, validateCode, scopeValues: gen._values }), this.opts.unevaluated) {
          let { props, items } = schemaCxt;
          validate.evaluated = {
            props: props instanceof codegen_1.Name ? void 0 : props,
            items: items instanceof codegen_1.Name ? void 0 : items,
            dynamicProps: props instanceof codegen_1.Name,
            dynamicItems: items instanceof codegen_1.Name
          }, validate.source && (validate.source.evaluated = (0, codegen_1.stringify)(validate.evaluated));
        }
        return sch.validate = validate, sch;
      } catch (e) {
        throw delete sch.validate, delete sch.validateName, sourceCode && this.logger.error("Error compiling schema, function code:", sourceCode), e;
      } finally {
        this._compilations.delete(sch);
      }
    }
    exports.compileSchema = compileSchema;
    function resolveRef(root, baseId, ref) {
      var _a;
      ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
      let schOrFunc = root.refs[ref];
      if (schOrFunc)
        return schOrFunc;
      let _sch = resolve3.call(this, root, ref);
      if (_sch === void 0) {
        let schema = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref], { schemaId } = this.opts;
        schema && (_sch = new SchemaEnv({ schema, schemaId, root, baseId }));
      }
      if (_sch !== void 0)
        return root.refs[ref] = inlineOrCompile.call(this, _sch);
    }
    exports.resolveRef = resolveRef;
    function inlineOrCompile(sch) {
      return (0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs) ? sch.schema : sch.validate ? sch : compileSchema.call(this, sch);
    }
    function getCompilingSchema(schEnv) {
      for (let sch of this._compilations)
        if (sameSchemaEnv(sch, schEnv))
          return sch;
    }
    exports.getCompilingSchema = getCompilingSchema;
    function sameSchemaEnv(s1, s2) {
      return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
    }
    function resolve3(root, ref) {
      let sch;
      for (; typeof (sch = this.refs[ref]) == "string"; )
        ref = sch;
      return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
    }
    function resolveSchema(root, ref) {
      let p = this.opts.uriResolver.parse(ref), refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p), baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
      if (Object.keys(root.schema).length > 0 && refPath === baseId)
        return getJsonPointer.call(this, p, root);
      let id = (0, resolve_1.normalizeId)(refPath), schOrRef = this.refs[id] || this.schemas[id];
      if (typeof schOrRef == "string") {
        let sch = resolveSchema.call(this, root, schOrRef);
        return typeof sch?.schema != "object" ? void 0 : getJsonPointer.call(this, p, sch);
      }
      if (typeof schOrRef?.schema == "object") {
        if (schOrRef.validate || compileSchema.call(this, schOrRef), id === (0, resolve_1.normalizeId)(ref)) {
          let { schema } = schOrRef, { schemaId } = this.opts, schId = schema[schemaId];
          return schId && (baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId)), new SchemaEnv({ schema, schemaId, root, baseId });
        }
        return getJsonPointer.call(this, p, schOrRef);
      }
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
      for (let part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema == "boolean")
          return;
        let partSchema = schema[(0, util_1.unescapeFragment)(part)];
        if (partSchema === void 0)
          return;
        schema = partSchema;
        let schId = typeof schema == "object" && schema[this.opts.schemaId];
        !PREVENT_SCOPE_CHANGE.has(part) && schId && (baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId));
      }
      let env;
      if (typeof schema != "boolean" && schema.$ref && !(0, util_1.schemaHasRulesButRef)(schema, this.RULES)) {
        let $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema.$ref);
        env = resolveSchema.call(this, root, $ref);
      }
      let { schemaId } = this.opts;
      if (env = env || new SchemaEnv({ schema, schemaId, root, baseId }), env.schema !== env.root.schema)
        return env;
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
      additionalProperties: !1
    };
  }
});

// node_modules/fast-uri/lib/utils.js
var require_utils = __commonJS({
  "node_modules/fast-uri/lib/utils.js"(exports, module) {
    "use strict";
    var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu), isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u), isHexPair = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu), isUnreserved = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu), isPathCharacter = RegExp.prototype.test.bind(/^[\da-z\-._~!$&'()*+,;=:@/]$/iu);
    function stringArrayToHexStripped(input) {
      let acc = "", code = 0, i = 0;
      for (i = 0; i < input.length; i++)
        if (code = input[i].charCodeAt(0), code !== 48) {
          if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102))
            return "";
          acc += input[i];
          break;
        }
      for (i += 1; i < input.length; i++) {
        if (code = input[i].charCodeAt(0), !(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102))
          return "";
        acc += input[i];
      }
      return acc;
    }
    var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
    function consumeIsZone(buffer) {
      return buffer.length = 0, !0;
    }
    function consumeHextets(buffer, address, output) {
      if (buffer.length) {
        let hex = stringArrayToHexStripped(buffer);
        if (hex !== "")
          address.push(hex);
        else
          return output.error = !0, !1;
        buffer.length = 0;
      }
      return !0;
    }
    function getIPV6(input) {
      let tokenCount = 0, output = { error: !1, address: "", zone: "" }, address = [], buffer = [], endipv6Encountered = !1, endIpv6 = !1, consume = consumeHextets;
      for (let i = 0; i < input.length; i++) {
        let cursor = input[i];
        if (!(cursor === "[" || cursor === "]"))
          if (cursor === ":") {
            if (endipv6Encountered === !0 && (endIpv6 = !0), !consume(buffer, address, output))
              break;
            if (++tokenCount > 7) {
              output.error = !0;
              break;
            }
            i > 0 && input[i - 1] === ":" && (endipv6Encountered = !0), address.push(":");
            continue;
          } else if (cursor === "%") {
            if (!consume(buffer, address, output))
              break;
            consume = consumeIsZone;
          } else {
            buffer.push(cursor);
            continue;
          }
      }
      return buffer.length && (consume === consumeIsZone ? output.zone = buffer.join("") : endIpv6 ? address.push(buffer.join("")) : address.push(stringArrayToHexStripped(buffer))), output.address = address.join(""), output;
    }
    function normalizeIPv6(host) {
      if (findToken(host, ":") < 2)
        return { host, isIPV6: !1 };
      let ipv6 = getIPV6(host);
      if (ipv6.error)
        return { host, isIPV6: !1 };
      {
        let newHost = ipv6.address, escapedHost = ipv6.address;
        return ipv6.zone && (newHost += "%" + ipv6.zone, escapedHost += "%25" + ipv6.zone), { host: newHost, isIPV6: !0, escapedHost };
      }
    }
    function findToken(str, token) {
      let ind = 0;
      for (let i = 0; i < str.length; i++)
        str[i] === token && ind++;
      return ind;
    }
    function removeDotSegments(path) {
      let input = path, output = [], nextSlash = -1, len = 0;
      for (; len = input.length; ) {
        if (len === 1) {
          if (input === ".")
            break;
          if (input === "/") {
            output.push("/");
            break;
          } else {
            output.push(input);
            break;
          }
        } else if (len === 2) {
          if (input[0] === ".") {
            if (input[1] === ".")
              break;
            if (input[1] === "/") {
              input = input.slice(2);
              continue;
            }
          } else if (input[0] === "/" && (input[1] === "." || input[1] === "/")) {
            output.push("/");
            break;
          }
        } else if (len === 3 && input === "/..") {
          output.length !== 0 && output.pop(), output.push("/");
          break;
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
        } else if (input[0] === "/" && input[1] === ".") {
          if (input[2] === "/") {
            input = input.slice(2);
            continue;
          } else if (input[2] === "." && input[3] === "/") {
            input = input.slice(3), output.length !== 0 && output.pop();
            continue;
          }
        }
        if ((nextSlash = input.indexOf("/", 1)) === -1) {
          output.push(input);
          break;
        } else
          output.push(input.slice(0, nextSlash)), input = input.slice(nextSlash);
      }
      return output.join("");
    }
    var HOST_DELIMS = { "@": "%40", "/": "%2F", "?": "%3F", "#": "%23", ":": "%3A" }, HOST_DELIM_RE = /[@/?#:]/g, HOST_DELIM_NO_COLON_RE = /[@/?#]/g;
    function reescapeHostDelimiters(host, isIP) {
      let re = isIP ? HOST_DELIM_NO_COLON_RE : HOST_DELIM_RE;
      return re.lastIndex = 0, host.replace(re, (ch) => HOST_DELIMS[ch]);
    }
    function normalizePercentEncoding(input, decodeUnreserved = !1) {
      if (input.indexOf("%") === -1)
        return input;
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          let hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            let normalizedHex = hex.toUpperCase(), decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            decodeUnreserved && isUnreserved(decoded) ? output += decoded : output += "%" + normalizedHex, i += 2;
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
          let hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            let normalizedHex = hex.toUpperCase(), decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            decoded !== "." && isUnreserved(decoded) ? output += decoded : output += "%" + normalizedHex, i += 2;
            continue;
          }
        }
        isPathCharacter(input[i]) ? output += input[i] : output += escape(input[i]);
      }
      return output;
    }
    function escapePreservingEscapes(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          let hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase(), i += 2;
            continue;
          }
        }
        output += escape(input[i]);
      }
      return output;
    }
    function recomposeAuthority(component) {
      let uriTokens = [];
      if (component.userinfo !== void 0 && (uriTokens.push(component.userinfo), uriTokens.push("@")), component.host !== void 0) {
        let host = unescape(component.host);
        if (!isIPv4(host)) {
          let ipV6res = normalizeIPv6(host);
          ipV6res.isIPV6 === !0 ? host = `[${ipV6res.escapedHost}]` : host = reescapeHostDelimiters(host, !1);
        }
        uriTokens.push(host);
      }
      return (typeof component.port == "number" || typeof component.port == "string") && (uriTokens.push(":"), uriTokens.push(String(component.port))), uriTokens.length ? uriTokens.join("") : void 0;
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
    var { isUUID } = require_utils(), URN_REG = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu, supportedSchemeNames = (
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
      return wsComponent.secure === !0 ? !0 : wsComponent.secure === !1 ? !1 : wsComponent.scheme ? wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S") : !1;
    }
    function httpParse(component) {
      return component.host || (component.error = component.error || "HTTP URIs must have a host."), component;
    }
    function httpSerialize(component) {
      let secure = String(component.scheme).toLowerCase() === "https";
      return (component.port === (secure ? 443 : 80) || component.port === "") && (component.port = void 0), component.path || (component.path = "/"), component;
    }
    function wsParse(wsComponent) {
      return wsComponent.secure = wsIsSecure(wsComponent), wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : ""), wsComponent.path = void 0, wsComponent.query = void 0, wsComponent;
    }
    function wsSerialize(wsComponent) {
      if ((wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") && (wsComponent.port = void 0), typeof wsComponent.secure == "boolean" && (wsComponent.scheme = wsComponent.secure ? "wss" : "ws", wsComponent.secure = void 0), wsComponent.resourceName) {
        let [path, query] = wsComponent.resourceName.split("?");
        wsComponent.path = path && path !== "/" ? path : void 0, wsComponent.query = query, wsComponent.resourceName = void 0;
      }
      return wsComponent.fragment = void 0, wsComponent;
    }
    function urnParse(urnComponent, options) {
      if (!urnComponent.path)
        return urnComponent.error = "URN can not be parsed", urnComponent;
      let matches = urnComponent.path.match(URN_REG);
      if (matches) {
        let scheme = options.scheme || urnComponent.scheme || "urn";
        urnComponent.nid = matches[1].toLowerCase(), urnComponent.nss = matches[2];
        let urnScheme = `${scheme}:${options.nid || urnComponent.nid}`, schemeHandler = getSchemeHandler(urnScheme);
        urnComponent.path = void 0, schemeHandler && (urnComponent = schemeHandler.parse(urnComponent, options));
      } else
        urnComponent.error = urnComponent.error || "URN can not be parsed.";
      return urnComponent;
    }
    function urnSerialize(urnComponent, options) {
      if (urnComponent.nid === void 0)
        throw new Error("URN without nid cannot be serialized");
      let scheme = options.scheme || urnComponent.scheme || "urn", nid = urnComponent.nid.toLowerCase(), urnScheme = `${scheme}:${options.nid || nid}`, schemeHandler = getSchemeHandler(urnScheme);
      schemeHandler && (urnComponent = schemeHandler.serialize(urnComponent, options));
      let uriComponent = urnComponent, nss = urnComponent.nss;
      return uriComponent.path = `${nid || options.nid}:${nss}`, options.skipEscape = !0, uriComponent;
    }
    function urnuuidParse(urnComponent, options) {
      let uuidComponent = urnComponent;
      return uuidComponent.uuid = uuidComponent.nss, uuidComponent.nss = void 0, !options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid)) && (uuidComponent.error = uuidComponent.error || "UUID is not valid."), uuidComponent;
    }
    function urnuuidSerialize(uuidComponent) {
      let urnComponent = uuidComponent;
      return urnComponent.nss = (uuidComponent.uuid || "").toLowerCase(), urnComponent;
    }
    var http = (
      /** @type {SchemeHandler} */
      {
        scheme: "http",
        domainHost: !0,
        parse: httpParse,
        serialize: httpSerialize
      }
    ), https = (
      /** @type {SchemeHandler} */
      {
        scheme: "https",
        domainHost: http.domainHost,
        parse: httpParse,
        serialize: httpSerialize
      }
    ), ws = (
      /** @type {SchemeHandler} */
      {
        scheme: "ws",
        domainHost: !0,
        parse: wsParse,
        serialize: wsSerialize
      }
    ), wss = (
      /** @type {SchemeHandler} */
      {
        scheme: "wss",
        domainHost: ws.domainHost,
        parse: ws.parse,
        serialize: ws.serialize
      }
    ), urn = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn",
        parse: urnParse,
        serialize: urnSerialize,
        skipNormalize: !0
      }
    ), urnuuid = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn:uuid",
        parse: urnuuidParse,
        serialize: urnuuidSerialize,
        skipNormalize: !0
      }
    ), SCHEMES = (
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
    var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizePercentEncoding, normalizePathEncoding, escapePreservingEscapes, reescapeHostDelimiters, isIPv4, nonSimpleDomain } = require_utils(), { SCHEMES, getSchemeHandler } = require_schemes();
    function normalize(uri, options) {
      return typeof uri == "string" ? uri = /** @type {T} */
      normalizeString(uri, options) : typeof uri == "object" && (uri = /** @type {T} */
      parse(serialize(uri, options), options)), uri;
    }
    function resolve3(baseURI, relativeURI, options) {
      let schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" }, resolved = resolveComponent(parse(baseURI, schemelessOptions), parse(relativeURI, schemelessOptions), schemelessOptions, !0);
      return schemelessOptions.skipEscape = !0, serialize(resolved, schemelessOptions);
    }
    function resolveComponent(base, relative, options, skipNormalization) {
      let target = {};
      return skipNormalization || (base = parse(serialize(base, options), options), relative = parse(serialize(relative, options), options)), options = options || {}, !options.tolerant && relative.scheme ? (target.scheme = relative.scheme, target.userinfo = relative.userinfo, target.host = relative.host, target.port = relative.port, target.path = removeDotSegments(relative.path || ""), target.query = relative.query) : (relative.userinfo !== void 0 || relative.host !== void 0 || relative.port !== void 0 ? (target.userinfo = relative.userinfo, target.host = relative.host, target.port = relative.port, target.path = removeDotSegments(relative.path || ""), target.query = relative.query) : (relative.path ? (relative.path[0] === "/" ? target.path = removeDotSegments(relative.path) : ((base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0) && !base.path ? target.path = "/" + relative.path : base.path ? target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative.path : target.path = relative.path, target.path = removeDotSegments(target.path)), target.query = relative.query) : (target.path = base.path, relative.query !== void 0 ? target.query = relative.query : target.query = base.query), target.userinfo = base.userinfo, target.host = base.host, target.port = base.port), target.scheme = base.scheme), target.fragment = relative.fragment, target;
    }
    function equal(uriA, uriB, options) {
      let normalizedA = normalizeComparableURI(uriA, options), normalizedB = normalizeComparableURI(uriB, options);
      return normalizedA !== void 0 && normalizedB !== void 0 && normalizedA.toLowerCase() === normalizedB.toLowerCase();
    }
    function serialize(cmpts, opts) {
      let component = {
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
      }, options = Object.assign({}, opts), uriTokens = [], schemeHandler = getSchemeHandler(options.scheme || component.scheme);
      schemeHandler && schemeHandler.serialize && schemeHandler.serialize(component, options), component.path !== void 0 && (options.skipEscape ? component.path = normalizePercentEncoding(component.path) : (component.path = escapePreservingEscapes(component.path), component.scheme !== void 0 && (component.path = component.path.split("%3A").join(":")))), options.reference !== "suffix" && component.scheme && uriTokens.push(component.scheme, ":");
      let authority = recomposeAuthority(component);
      if (authority !== void 0 && (options.reference !== "suffix" && uriTokens.push("//"), uriTokens.push(authority), component.path && component.path[0] !== "/" && uriTokens.push("/")), component.path !== void 0) {
        let s = component.path;
        !options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath) && (s = removeDotSegments(s)), authority === void 0 && s[0] === "/" && s[1] === "/" && (s = "/%2F" + s.slice(2)), uriTokens.push(s);
      }
      return component.query !== void 0 && uriTokens.push("?", component.query), component.fragment !== void 0 && uriTokens.push("#", component.fragment), uriTokens.join("");
    }
    var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u, AUTHORITY_PREFIX = /^(?:[^#/:?]+:)?\/\/([^/?#]*)/;
    function getParseError(parsed, matches) {
      if (matches[2] !== void 0 && parsed.path && parsed.path[0] !== "/")
        return 'URI path must start with "/" when authority is present.';
      if (typeof parsed.port == "number" && (parsed.port < 0 || parsed.port > 65535))
        return "URI port is malformed.";
    }
    function parseWithStatus(uri, opts) {
      let options = Object.assign({}, opts), parsed = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0
      }, malformedAuthorityOrPort = !1, isIP = !1;
      options.reference === "suffix" && (options.scheme ? uri = options.scheme + ":" + uri : uri = "//" + uri);
      let authorityMatch = uri.match(AUTHORITY_PREFIX);
      authorityMatch !== null && authorityMatch[1].indexOf("\\") !== -1 && (parsed.error = "URI authority must not contain a literal backslash.", malformedAuthorityOrPort = !0);
      let matches = uri.match(URI_PARSE);
      if (matches) {
        parsed.scheme = matches[1], parsed.userinfo = matches[3], parsed.host = matches[4], parsed.port = parseInt(matches[5], 10), parsed.path = matches[6] || "", parsed.query = matches[7], parsed.fragment = matches[8], isNaN(parsed.port) && (parsed.port = matches[5]);
        let parseError = getParseError(parsed, matches);
        if (parseError !== void 0 && (parsed.error = parsed.error || parseError, malformedAuthorityOrPort = !0), parsed.host)
          if (isIPv4(parsed.host) === !1) {
            let ipv6result = normalizeIPv6(parsed.host);
            parsed.host = ipv6result.host.toLowerCase(), isIP = ipv6result.isIPV6;
          } else
            isIP = !0;
        parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path ? parsed.reference = "same-document" : parsed.scheme === void 0 ? parsed.reference = "relative" : parsed.fragment === void 0 ? parsed.reference = "absolute" : parsed.reference = "uri", options.reference && options.reference !== "suffix" && options.reference !== parsed.reference && (parsed.error = parsed.error || "URI is not a " + options.reference + " reference.");
        let schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
        if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport) && parsed.host && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === !1 && nonSimpleDomain(parsed.host))
          try {
            parsed.host = new URL("http://" + parsed.host).hostname;
          } catch (e) {
            parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
          }
        if ((!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) && (uri.indexOf("%") !== -1 && (parsed.scheme !== void 0 && (parsed.scheme = unescape(parsed.scheme)), parsed.host !== void 0 && (parsed.host = reescapeHostDelimiters(unescape(parsed.host), isIP))), parsed.path && (parsed.path = normalizePathEncoding(parsed.path)), parsed.fragment))
          try {
            parsed.fragment = encodeURI(decodeURIComponent(parsed.fragment));
          } catch {
            parsed.error = parsed.error || "URI malformed";
          }
        schemeHandler && schemeHandler.parse && schemeHandler.parse(parsed, options);
      } else
        parsed.error = parsed.error || "URI can not be parsed.";
      return { parsed, malformedAuthorityOrPort };
    }
    function parse(uri, opts) {
      return parseWithStatus(uri, opts).parsed;
    }
    function normalizeString(uri, opts) {
      return normalizeStringWithStatus(uri, opts).normalized;
    }
    function normalizeStringWithStatus(uri, opts) {
      let { parsed, malformedAuthorityOrPort } = parseWithStatus(uri, opts);
      return {
        normalized: malformedAuthorityOrPort ? uri : serialize(parsed, opts),
        malformedAuthorityOrPort
      };
    }
    function normalizeComparableURI(uri, opts) {
      if (typeof uri == "string") {
        let { normalized, malformedAuthorityOrPort } = normalizeStringWithStatus(uri, opts);
        return malformedAuthorityOrPort ? void 0 : normalized;
      }
      if (typeof uri == "object")
        return serialize(uri, opts);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var uri = require_fast_uri();
    uri.code = 'require("ajv/dist/runtime/uri").default';
    exports.default = uri;
  }
});

// node_modules/ajv/dist/core.js
var require_core = __commonJS({
  "node_modules/ajv/dist/core.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: !0, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: !0, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: !0, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: !0, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: !0, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: !0, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: !0, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error(), ref_error_1 = require_ref_error(), rules_1 = require_rules(), compile_1 = require_compile(), codegen_2 = require_codegen(), resolve_1 = require_resolve(), dataType_1 = require_dataType(), util_1 = require_util(), $dataRefSchema = require_data(), uri_1 = require_uri(), defaultRegExp = (str, flags) => new RegExp(str, flags);
    defaultRegExp.code = "new RegExp";
    var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"], EXT_SCOPE_NAMES = /* @__PURE__ */ new Set([
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
    ]), removedOptions = {
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
    }, deprecatedOptions = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    }, MAX_EXPRESSION = 200;
    function requiredOptions(o) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
      let s = o.strict, _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize, optimize = _optz === !0 || _optz === void 0 ? 1 : _optz || 0, regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp, uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
      return {
        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : !0,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : !0,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : !1,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : !0,
        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : !0,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : !0,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : !0,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : !0,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : !0,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : !0,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : !0,
        uriResolver
      };
    }
    var Ajv2 = class {
      constructor(opts = {}) {
        this.schemas = {}, this.refs = {}, this.formats = /* @__PURE__ */ Object.create(null), this._compilations = /* @__PURE__ */ new Set(), this._loading = {}, this._cache = /* @__PURE__ */ new Map(), opts = this.opts = { ...opts, ...requiredOptions(opts) };
        let { es5, lines } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines }), this.logger = getLogger(opts.logger);
        let formatOpt = opts.validateFormats;
        opts.validateFormats = !1, this.RULES = (0, rules_1.getRules)(), checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED"), checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn"), this._metaOpts = getMetaSchemaOptions.call(this), opts.formats && addInitialFormats.call(this), this._addVocabularies(), this._addDefaultMetaSchema(), opts.keywords && addInitialKeywords.call(this, opts.keywords), typeof opts.meta == "object" && this.addMetaSchema(opts.meta), addInitialSchemas.call(this), opts.validateFormats = formatOpt;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        let { $data, meta, schemaId } = this.opts, _dataRefSchema = $dataRefSchema;
        schemaId === "id" && (_dataRefSchema = { ...$dataRefSchema }, _dataRefSchema.id = _dataRefSchema.$id, delete _dataRefSchema.$id), meta && $data && this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], !1);
      }
      defaultMeta() {
        let { meta, schemaId } = this.opts;
        return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : void 0;
      }
      validate(schemaKeyRef, data) {
        let v;
        if (typeof schemaKeyRef == "string") {
          if (v = this.getSchema(schemaKeyRef), !v)
            throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        } else
          v = this.compile(schemaKeyRef);
        let valid = v(data);
        return "$async" in v || (this.errors = v.errors), valid;
      }
      compile(schema, _meta) {
        let sch = this._addSchema(schema, _meta);
        return sch.validate || this._compileSchemaEnv(sch);
      }
      compileAsync(schema, meta) {
        if (typeof this.opts.loadSchema != "function")
          throw new Error("options.loadSchema should be a function");
        let { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema, meta);
        async function runCompileAsync(_schema, _meta) {
          await loadMetaSchema.call(this, _schema.$schema);
          let sch = this._addSchema(_schema, _meta);
          return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
          $ref && !this.getSchema($ref) && await runCompileAsync.call(this, { $ref }, !0);
        }
        async function _compileAsync(sch) {
          try {
            return this._compileSchemaEnv(sch);
          } catch (e) {
            if (!(e instanceof ref_error_1.default))
              throw e;
            return checkLoaded.call(this, e), await loadMissingSchema.call(this, e.missingSchema), _compileAsync.call(this, sch);
          }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
          if (this.refs[ref])
            throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
        }
        async function loadMissingSchema(ref) {
          let _schema = await _loadSchema.call(this, ref);
          this.refs[ref] || await loadMetaSchema.call(this, _schema.$schema), this.refs[ref] || this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
          let p = this._loading[ref];
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
          for (let sch of schema)
            this.addSchema(sch, void 0, _meta, _validateSchema);
          return this;
        }
        let id;
        if (typeof schema == "object") {
          let { schemaId } = this.opts;
          if (id = schema[schemaId], id !== void 0 && typeof id != "string")
            throw new Error(`schema ${schemaId} must be string`);
        }
        return key = (0, resolve_1.normalizeId)(key || id), this._checkUnique(key), this.schemas[key] = this._addSchema(schema, _meta, key, _validateSchema, !0), this;
      }
      // Add schema that will be used to validate other schemas
      // options in META_IGNORE_OPTIONS are alway set to false
      addMetaSchema(schema, key, _validateSchema = this.opts.validateSchema) {
        return this.addSchema(schema, key, !0, _validateSchema), this;
      }
      //  Validate schema against its meta-schema
      validateSchema(schema, throwOrLogError) {
        if (typeof schema == "boolean")
          return !0;
        let $schema;
        if ($schema = schema.$schema, $schema !== void 0 && typeof $schema != "string")
          throw new Error("$schema must be a string");
        if ($schema = $schema || this.opts.defaultMeta || this.defaultMeta(), !$schema)
          return this.logger.warn("meta-schema not available"), this.errors = null, !0;
        let valid = this.validate($schema, schema);
        if (!valid && throwOrLogError) {
          let message = "schema is invalid: " + this.errorsText();
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
        for (; typeof (sch = getSchEnv.call(this, keyRef)) == "string"; )
          keyRef = sch;
        if (sch === void 0) {
          let { schemaId } = this.opts, root = new compile_1.SchemaEnv({ schema: {}, schemaId });
          if (sch = compile_1.resolveSchema.call(this, root, keyRef), !sch)
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
        if (schemaKeyRef instanceof RegExp)
          return this._removeAllSchemas(this.schemas, schemaKeyRef), this._removeAllSchemas(this.refs, schemaKeyRef), this;
        switch (typeof schemaKeyRef) {
          case "undefined":
            return this._removeAllSchemas(this.schemas), this._removeAllSchemas(this.refs), this._cache.clear(), this;
          case "string": {
            let sch = getSchEnv.call(this, schemaKeyRef);
            return typeof sch == "object" && this._cache.delete(sch.schema), delete this.schemas[schemaKeyRef], delete this.refs[schemaKeyRef], this;
          }
          case "object": {
            let cacheKey = schemaKeyRef;
            this._cache.delete(cacheKey);
            let id = schemaKeyRef[this.opts.schemaId];
            return id && (id = (0, resolve_1.normalizeId)(id), delete this.schemas[id], delete this.refs[id]), this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      // add "vocabulary" - a collection of keywords
      addVocabulary(definitions) {
        for (let def of definitions)
          this.addKeyword(def);
        return this;
      }
      addKeyword(kwdOrDef, def) {
        let keyword;
        if (typeof kwdOrDef == "string")
          keyword = kwdOrDef, typeof def == "object" && (this.logger.warn("these parameters are deprecated, see docs for addKeyword"), def.keyword = keyword);
        else if (typeof kwdOrDef == "object" && def === void 0) {
          if (def = kwdOrDef, keyword = def.keyword, Array.isArray(keyword) && !keyword.length)
            throw new Error("addKeywords: keyword must be string or non-empty array");
        } else
          throw new Error("invalid addKeywords parameters");
        if (checkKeyword.call(this, keyword, def), !def)
          return (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd)), this;
        keywordMetaschema.call(this, def);
        let definition = {
          ...def,
          type: (0, dataType_1.getJSONTypes)(def.type),
          schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
        };
        return (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t))), this;
      }
      getKeyword(keyword) {
        let rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
      }
      // Remove keyword
      removeKeyword(keyword) {
        let { RULES } = this;
        delete RULES.keywords[keyword], delete RULES.all[keyword];
        for (let group of RULES.rules) {
          let i = group.rules.findIndex((rule) => rule.keyword === keyword);
          i >= 0 && group.rules.splice(i, 1);
        }
        return this;
      }
      // Add format
      addFormat(name, format) {
        return typeof format == "string" && (format = new RegExp(format)), this.formats[name] = format, this;
      }
      errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
        return !errors || errors.length === 0 ? "No errors" : errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
      }
      $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        let rules = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (let jsonPointer of keywordsJsonPointers) {
          let segments = jsonPointer.split("/").slice(1), keywords = metaSchema;
          for (let seg of segments)
            keywords = keywords[seg];
          for (let key in rules) {
            let rule = rules[key];
            if (typeof rule != "object")
              continue;
            let { $data } = rule.definition, schema = keywords[key];
            $data && schema && (keywords[key] = schemaOrData(schema));
          }
        }
        return metaSchema;
      }
      _removeAllSchemas(schemas, regex) {
        for (let keyRef in schemas) {
          let sch = schemas[keyRef];
          (!regex || regex.test(keyRef)) && (typeof sch == "string" ? delete schemas[keyRef] : sch && !sch.meta && (this._cache.delete(sch.schema), delete schemas[keyRef]));
        }
      }
      _addSchema(schema, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id, { schemaId } = this.opts;
        if (typeof schema == "object")
          id = schema[schemaId];
        else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          if (typeof schema != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema);
        if (sch !== void 0)
          return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        let localRefs = resolve_1.getSchemaRefs.call(this, schema, baseId);
        return sch = new compile_1.SchemaEnv({ schema, schemaId, meta, baseId, localRefs }), this._cache.set(sch.schema, sch), addSchema && !baseId.startsWith("#") && (baseId && this._checkUnique(baseId), this.refs[baseId] = sch), validateSchema && this.validateSchema(schema, !0), sch;
      }
      _checkUnique(id) {
        if (this.schemas[id] || this.refs[id])
          throw new Error(`schema with key or id "${id}" already exists`);
      }
      _compileSchemaEnv(sch) {
        if (sch.meta ? this._compileMetaSchema(sch) : compile_1.compileSchema.call(this, sch), !sch.validate)
          throw new Error("ajv implementation error");
        return sch.validate;
      }
      _compileMetaSchema(sch) {
        let currentOpts = this.opts;
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
      for (let key in checkOpts) {
        let opt = key;
        opt in options && this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
      }
    }
    function getSchEnv(keyRef) {
      return keyRef = (0, resolve_1.normalizeId)(keyRef), this.schemas[keyRef] || this.refs[keyRef];
    }
    function addInitialSchemas() {
      let optsSchemas = this.opts.schemas;
      if (optsSchemas)
        if (Array.isArray(optsSchemas))
          this.addSchema(optsSchemas);
        else
          for (let key in optsSchemas)
            this.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats() {
      for (let name in this.opts.formats) {
        let format = this.opts.formats[name];
        format && this.addFormat(name, format);
      }
    }
    function addInitialKeywords(defs) {
      if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (let keyword in defs) {
        let def = defs[keyword];
        def.keyword || (def.keyword = keyword), this.addKeyword(def);
      }
    }
    function getMetaSchemaOptions() {
      let metaOpts = { ...this.opts };
      for (let opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
      return metaOpts;
    }
    var noLogs = { log() {
    }, warn() {
    }, error() {
    } };
    function getLogger(logger) {
      if (logger === !1)
        return noLogs;
      if (logger === void 0)
        return console;
      if (logger.log && logger.warn && logger.error)
        return logger;
      throw new Error("logger must implement log, warn and error methods");
    }
    var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
    function checkKeyword(keyword, def) {
      let { RULES } = this;
      if ((0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES.keywords[kwd])
          throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
          throw new Error(`Keyword ${kwd} has invalid name`);
      }), !!def && def.$data && !("code" in def || "validate" in def))
        throw new Error('$data keyword must have "code" or "validate" function');
    }
    function addRule(keyword, definition, dataType) {
      var _a;
      let post = definition?.post;
      if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
      let { RULES } = this, ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t }) => t === dataType);
      if (ruleGroup || (ruleGroup = { type: dataType, rules: [] }, RULES.rules.push(ruleGroup)), RULES.keywords[keyword] = !0, !definition)
        return;
      let rule = {
        keyword,
        definition: {
          ...definition,
          type: (0, dataType_1.getJSONTypes)(definition.type),
          schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
        }
      };
      definition.before ? addBeforeRule.call(this, ruleGroup, rule, definition.before) : ruleGroup.rules.push(rule), RULES.all[keyword] = rule, (_a = definition.implements) === null || _a === void 0 || _a.forEach((kwd) => this.addKeyword(kwd));
    }
    function addBeforeRule(ruleGroup, rule, before) {
      let i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
      i >= 0 ? ruleGroup.rules.splice(i, 0, rule) : (ruleGroup.rules.push(rule), this.logger.warn(`rule ${before} is not defined`));
    }
    function keywordMetaschema(def) {
      let { metaSchema } = def;
      metaSchema !== void 0 && (def.$data && this.opts.$data && (metaSchema = schemaOrData(metaSchema)), def.validateSchema = this.compile(metaSchema, !0));
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.callRef = exports.getValidate = void 0;
    var ref_error_1 = require_ref_error(), code_1 = require_code2(), codegen_1 = require_codegen(), names_1 = require_names(), compile_1 = require_compile(), util_1 = require_util(), def = {
      keyword: "$ref",
      schemaType: "string",
      code(cxt) {
        let { gen, schema: $ref, it } = cxt, { baseId, schemaEnv: env, validateName, opts, self } = it, { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
          return callRootRef();
        let schOrEnv = compile_1.resolveRef.call(self, root, baseId, $ref);
        if (schOrEnv === void 0)
          throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
          return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
          if (env === root)
            return callRef(cxt, validateName, env, env.$async);
          let rootName = gen.scopeValue("root", { ref: root });
          return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
          let v = getValidate(cxt, sch);
          callRef(cxt, v, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
          let schName = gen.scopeValue("schema", opts.code.source === !0 ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch }), valid = gen.name("valid"), schCxt = cxt.subschema({
            schema: sch,
            dataTypes: [],
            schemaPath: codegen_1.nil,
            topSchemaRef: schName,
            errSchemaPath: $ref
          }, valid);
          cxt.mergeEvaluated(schCxt), cxt.ok(valid);
        }
      }
    };
    function getValidate(cxt, sch) {
      let { gen } = cxt;
      return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
    }
    exports.getValidate = getValidate;
    function callRef(cxt, v, sch, $async) {
      let { gen, it } = cxt, { allErrors, schemaEnv: env, opts } = it, passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
      $async ? callAsyncRef() : callSyncRef();
      function callAsyncRef() {
        if (!env.$async)
          throw new Error("async schema referenced by sync schema");
        let valid = gen.let("valid");
        gen.try(() => {
          gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v, passCxt)}`), addEvaluatedFrom(v), allErrors || gen.assign(valid, !0);
        }, (e) => {
          gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e)), addErrorsFrom(e), allErrors || gen.assign(valid, !1);
        }), cxt.ok(valid);
      }
      function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v, passCxt), () => addEvaluatedFrom(v), () => addErrorsFrom(v));
      }
      function addErrorsFrom(source) {
        let errs = (0, codegen_1._)`${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`), gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      }
      function addEvaluatedFrom(source) {
        var _a;
        if (!it.opts.unevaluated)
          return;
        let schEvaluated = (_a = sch?.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        if (it.props !== !0)
          if (schEvaluated && !schEvaluated.dynamicProps)
            schEvaluated.props !== void 0 && (it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props));
          else {
            let props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
            it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
          }
        if (it.items !== !0)
          if (schEvaluated && !schEvaluated.dynamicItems)
            schEvaluated.items !== void 0 && (it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items));
          else {
            let items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
            it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var id_1 = require_id(), ref_1 = require_ref(), core = [
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), ops = codegen_1.operators, KWDs = {
      maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    }, error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    }, def = {
      keyword: Object.keys(KWDs),
      type: "number",
      schemaType: "number",
      $data: !0,
      error,
      code(cxt) {
        let { keyword, data, schemaCode } = cxt;
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
      params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
    }, def = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: !0,
      error,
      code(cxt) {
        let { gen, data, schemaCode, it } = cxt, prec = it.opts.multipleOfPrecision, res = gen.let("res"), invalid = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    function ucs2length(str) {
      let len = str.length, length = 0, pos = 0, value;
      for (; pos < len; )
        length++, value = str.charCodeAt(pos++), value >= 55296 && value <= 56319 && pos < len && (value = str.charCodeAt(pos), (value & 64512) === 56320 && pos++);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), util_1 = require_util(), ucs2length_1 = require_ucs2length(), error = {
      message({ keyword, schemaCode }) {
        let comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    }, def = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: !0,
      error,
      code(cxt) {
        let { keyword, data, schemaCode, it } = cxt, op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT, len = it.opts.unicode === !1 ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var code_1 = require_code2(), util_1 = require_util(), codegen_1 = require_codegen(), error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
    }, def = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: !0,
      error,
      code(cxt) {
        let { gen, data, $data, schema, schemaCode, it } = cxt, u = it.opts.unicodeRegExp ? "u" : "";
        if ($data) {
          let { regExp } = it.opts.code, regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp), valid = gen.let("valid");
          gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u}).test(${data})`), () => gen.assign(valid, !1)), cxt.fail$data((0, codegen_1._)`!${valid}`);
        } else {
          let regExp = (0, code_1.usePattern)(cxt, schema);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), error = {
      message({ keyword, schemaCode }) {
        let comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    }, def = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: !0,
      error,
      code(cxt) {
        let { keyword, data, schemaCode } = cxt, op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var code_1 = require_code2(), codegen_1 = require_codegen(), util_1 = require_util(), error = {
      message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
      params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
    }, def = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: !0,
      error,
      code(cxt) {
        let { gen, schema, schemaCode, data, $data, it } = cxt, { opts } = it;
        if (!$data && schema.length === 0)
          return;
        let useLoop = schema.length >= opts.loopRequired;
        if (it.allErrors ? allErrorsMode() : exitOnErrorMode(), opts.strictRequired) {
          let props = cxt.parentSchema.properties, { definedProperties } = cxt.it;
          for (let requiredKey of schema)
            if (props?.[requiredKey] === void 0 && !definedProperties.has(requiredKey)) {
              let schemaPath = it.schemaEnv.baseId + it.errSchemaPath, msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
              (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
            }
        }
        function allErrorsMode() {
          if (useLoop || $data)
            cxt.block$data(codegen_1.nil, loopAllRequired);
          else
            for (let prop of schema)
              (0, code_1.checkReportMissingProp)(cxt, prop);
        }
        function exitOnErrorMode() {
          let missing = gen.let("missing");
          if (useLoop || $data) {
            let valid = gen.let("valid", !0);
            cxt.block$data(valid, () => loopUntilMissing(missing, valid)), cxt.ok(valid);
          } else
            gen.if((0, code_1.checkMissingProp)(cxt, schema, missing)), (0, code_1.reportMissingProp)(cxt, missing), gen.else();
        }
        function loopAllRequired() {
          gen.forOf("prop", schemaCode, (prop) => {
            cxt.setParams({ missingProperty: prop }), gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
          });
        }
        function loopUntilMissing(missing, valid) {
          cxt.setParams({ missingProperty: missing }), gen.forOf(missing, schemaCode, () => {
            gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties)), gen.if((0, codegen_1.not)(valid), () => {
              cxt.error(), gen.break();
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), error = {
      message({ keyword, schemaCode }) {
        let comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    }, def = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: !0,
      error,
      code(cxt) {
        let { keyword, data, schemaCode } = cxt, op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/uniqueItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var dataType_1 = require_dataType(), codegen_1 = require_codegen(), util_1 = require_util(), equal_1 = require_equal(), error = {
      message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
      params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
    }, def = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: !0,
      error,
      code(cxt) {
        let { gen, data, $data, schema, parentSchema, schemaCode, it } = cxt;
        if (!$data && !schema)
          return;
        let valid = gen.let("valid"), itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`), cxt.ok(valid);
        function validateUniqueItems() {
          let i = gen.let("i", (0, codegen_1._)`${data}.length`), j = gen.let("j");
          cxt.setParams({ i, j }), gen.assign(valid, !0), gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
        }
        function canOptimize() {
          return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
        }
        function loopN(i, j) {
          let item = gen.name("item"), wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong), indices = gen.const("indices", (0, codegen_1._)`{}`);
          gen.for((0, codegen_1._)`;${i}--;`, () => {
            gen.let(item, (0, codegen_1._)`${data}[${i}]`), gen.if(wrongType, (0, codegen_1._)`continue`), itemTypes.length > 1 && gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`), gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
              gen.assign(j, (0, codegen_1._)`${indices}[${item}]`), cxt.error(), gen.assign(valid, !1).break();
            }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
          });
        }
        function loopN2(i, j) {
          let eql = (0, util_1.useFunc)(gen, equal_1.default), outer = gen.name("outer");
          gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
            cxt.error(), gen.assign(valid, !1).break(outer);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), util_1 = require_util(), equal_1 = require_equal(), error = {
      message: "must be equal to constant",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
    }, def = {
      keyword: "const",
      $data: !0,
      error,
      code(cxt) {
        let { gen, data, $data, schemaCode, schema } = cxt;
        $data || schema && typeof schema == "object" ? cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`) : cxt.fail((0, codegen_1._)`${schema} !== ${data}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), util_1 = require_util(), equal_1 = require_equal(), error = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
    }, def = {
      keyword: "enum",
      schemaType: "array",
      $data: !0,
      error,
      code(cxt) {
        let { gen, data, $data, schema, schemaCode, it } = cxt;
        if (!$data && schema.length === 0)
          throw new Error("enum must have non-empty array");
        let useLoop = schema.length >= it.opts.loopEnum, eql, getEql = () => eql ?? (eql = (0, util_1.useFunc)(gen, equal_1.default)), valid;
        if (useLoop || $data)
          valid = gen.let("valid"), cxt.block$data(valid, loopEnum);
        else {
          if (!Array.isArray(schema))
            throw new Error("ajv implementation error");
          let vSchema = gen.const("vSchema", schemaCode);
          valid = (0, codegen_1.or)(...schema.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
          gen.assign(valid, !1), gen.forOf("v", schemaCode, (v) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v})`, () => gen.assign(valid, !0).break()));
        }
        function equalCode(vSchema, i) {
          let sch = schema[i];
          return typeof sch == "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var limitNumber_1 = require_limitNumber(), multipleOf_1 = require_multipleOf(), limitLength_1 = require_limitLength(), pattern_1 = require_pattern(), limitProperties_1 = require_limitProperties(), required_1 = require_required(), limitItems_1 = require_limitItems(), uniqueItems_1 = require_uniqueItems(), const_1 = require_const(), enum_1 = require_enum(), validation = [
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.validateAdditionalItems = void 0;
    var codegen_1 = require_codegen(), util_1 = require_util(), error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    }, def = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error,
      code(cxt) {
        let { parentSchema, it } = cxt, { items } = parentSchema;
        if (!Array.isArray(items)) {
          (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        validateAdditionalItems(cxt, items);
      }
    };
    function validateAdditionalItems(cxt, items) {
      let { gen, schema, data, keyword, it } = cxt;
      it.items = !0;
      let len = gen.const("len", (0, codegen_1._)`${data}.length`);
      if (schema === !1)
        cxt.setParams({ len: items.length }), cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
      else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
        let valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid)), cxt.ok(valid);
      }
      function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
          cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid), it.allErrors || gen.if((0, codegen_1.not)(valid), () => gen.break());
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.validateTuple = void 0;
    var codegen_1 = require_codegen(), util_1 = require_util(), code_1 = require_code2(), def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(cxt) {
        let { schema, it } = cxt;
        if (Array.isArray(schema))
          return validateTuple(cxt, "additionalItems", schema);
        it.items = !0, !(0, util_1.alwaysValidSchema)(it, schema) && cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    function validateTuple(cxt, extraItems, schArr = cxt.schema) {
      let { gen, parentSchema, data, keyword, it } = cxt;
      checkStrictTuple(parentSchema), it.opts.unevaluated && schArr.length && it.items !== !0 && (it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items));
      let valid = gen.name("valid"), len = gen.const("len", (0, codegen_1._)`${data}.length`);
      schArr.forEach((sch, i) => {
        (0, util_1.alwaysValidSchema)(it, sch) || (gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
          keyword,
          schemaProp: i,
          dataProp: i
        }, valid)), cxt.ok(valid));
      });
      function checkStrictTuple(sch) {
        let { opts, errSchemaPath } = it, l = schArr.length, fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === !1);
        if (opts.strictTuples && !fullTuple) {
          let msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var items_1 = require_items(), def = {
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), util_1 = require_util(), code_1 = require_code2(), additionalItems_1 = require_additionalItems(), error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    }, def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error,
      code(cxt) {
        let { schema, parentSchema, it } = cxt, { prefixItems } = parentSchema;
        it.items = !0, !(0, util_1.alwaysValidSchema)(it, schema) && (prefixItems ? (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems) : cxt.ok((0, code_1.validateArray)(cxt)));
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/contains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), util_1 = require_util(), error = {
      message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
      params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
    }, def = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: !0,
      error,
      code(cxt) {
        let { gen, schema, parentSchema, data, it } = cxt, min, max, { minContains, maxContains } = parentSchema;
        it.opts.next ? (min = minContains === void 0 ? 1 : minContains, max = maxContains) : min = 1;
        let len = gen.const("len", (0, codegen_1._)`${data}.length`);
        if (cxt.setParams({ min, max }), max === void 0 && min === 0) {
          (0, util_1.checkStrictMode)(it, '"minContains" == 0 without "maxContains": "contains" keyword ignored');
          return;
        }
        if (max !== void 0 && min > max) {
          (0, util_1.checkStrictMode)(it, '"minContains" > "maxContains" is always invalid'), cxt.fail();
          return;
        }
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          let cond = (0, codegen_1._)`${len} >= ${min}`;
          max !== void 0 && (cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`), cxt.pass(cond);
          return;
        }
        it.items = !0;
        let valid = gen.name("valid");
        max === void 0 && min === 1 ? validateItems(valid, () => gen.if(valid, () => gen.break())) : min === 0 ? (gen.let(valid, !0), max !== void 0 && gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount)) : (gen.let(valid, !1), validateItemsWithCount()), cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
          let schValid = gen.name("_valid"), count = gen.let("count", 0);
          validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block) {
          gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
              keyword: "contains",
              dataProp: i,
              dataPropType: util_1.Type.Num,
              compositeRule: !0
            }, _valid), block();
          });
        }
        function checkLimits(count) {
          gen.code((0, codegen_1._)`${count}++`), max === void 0 ? gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, !0).break()) : (gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, !1).break()), min === 1 ? gen.assign(valid, !0) : gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, !0)));
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
    var codegen_1 = require_codegen(), util_1 = require_util(), code_1 = require_code2();
    exports.error = {
      message: ({ params: { property, depsCount, deps } }) => {
        let property_ies = depsCount === 1 ? "property" : "properties";
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
        let [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps), validateSchemaDeps(cxt, schDeps);
      }
    };
    function splitDependencies({ schema }) {
      let propertyDeps = {}, schemaDeps = {};
      for (let key in schema) {
        if (key === "__proto__")
          continue;
        let deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema[key];
      }
      return [propertyDeps, schemaDeps];
    }
    function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
      let { gen, data, it } = cxt;
      if (Object.keys(propertyDeps).length === 0)
        return;
      let missing = gen.let("missing");
      for (let prop in propertyDeps) {
        let deps = propertyDeps[prop];
        if (deps.length === 0)
          continue;
        let hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
        cxt.setParams({
          property: prop,
          depsCount: deps.length,
          deps: deps.join(", ")
        }), it.allErrors ? gen.if(hasProperty, () => {
          for (let depProp of deps)
            (0, code_1.checkReportMissingProp)(cxt, depProp);
        }) : (gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`), (0, code_1.reportMissingProp)(cxt, missing), gen.else());
      }
    }
    exports.validatePropertyDeps = validatePropertyDeps;
    function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
      let { gen, data, keyword, it } = cxt, valid = gen.name("valid");
      for (let prop in schemaDeps)
        (0, util_1.alwaysValidSchema)(it, schemaDeps[prop]) || (gen.if(
          (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties),
          () => {
            let schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
            cxt.mergeValidEvaluated(schCxt, valid);
          },
          () => gen.var(valid, !0)
          // TODO var
        ), cxt.ok(valid));
    }
    exports.validateSchemaDeps = validateSchemaDeps;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/propertyNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), util_1 = require_util(), error = {
      message: "property name must be valid",
      params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
    }, def = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error,
      code(cxt) {
        let { gen, schema, data, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        let valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
          cxt.setParams({ propertyName: key }), cxt.subschema({
            keyword: "propertyNames",
            data: key,
            dataTypes: ["string"],
            propertyName: key,
            compositeRule: !0
          }, valid), gen.if((0, codegen_1.not)(valid), () => {
            cxt.error(!0), it.allErrors || gen.break();
          });
        }), cxt.ok(valid);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var code_1 = require_code2(), codegen_1 = require_codegen(), names_1 = require_names(), util_1 = require_util(), error = {
      message: "must NOT have additional properties",
      params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
    }, def = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: !0,
      trackErrors: !0,
      error,
      code(cxt) {
        let { gen, schema, parentSchema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        let { allErrors, opts } = it;
        if (it.props = !0, opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema))
          return;
        let props = (0, code_1.allSchemaProperties)(parentSchema.properties), patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties(), cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
          gen.forIn("key", data, (key) => {
            !props.length && !patProps.length ? additionalPropertyCode(key) : gen.if(isAdditional(key), () => additionalPropertyCode(key));
          });
        }
        function isAdditional(key) {
          let definedProp;
          if (props.length > 8) {
            let propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
            definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
          } else props.length ? definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`)) : definedProp = codegen_1.nil;
          return patProps.length && (definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`))), (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
          gen.code((0, codegen_1._)`delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
          if (opts.removeAdditional === "all" || opts.removeAdditional && schema === !1) {
            deleteAdditional(key);
            return;
          }
          if (schema === !1) {
            cxt.setParams({ additionalProperty: key }), cxt.error(), allErrors || gen.break();
            return;
          }
          if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
            let valid = gen.name("valid");
            opts.removeAdditional === "failing" ? (applyAdditionalSchema(key, valid, !1), gen.if((0, codegen_1.not)(valid), () => {
              cxt.reset(), deleteAdditional(key);
            })) : (applyAdditionalSchema(key, valid), allErrors || gen.if((0, codegen_1.not)(valid), () => gen.break()));
          }
        }
        function applyAdditionalSchema(key, valid, errors) {
          let subschema = {
            keyword: "additionalProperties",
            dataProp: key,
            dataPropType: util_1.Type.Str
          };
          errors === !1 && Object.assign(subschema, {
            compositeRule: !0,
            createErrors: !1,
            allErrors: !1
          }), cxt.subschema(subschema, valid);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var validate_1 = require_validate(), code_1 = require_code2(), util_1 = require_util(), additionalProperties_1 = require_additionalProperties(), def = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        let { gen, schema, parentSchema, data, it } = cxt;
        it.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0 && additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
        let allProps = (0, code_1.allSchemaProperties)(schema);
        for (let prop of allProps)
          it.definedProperties.add(prop);
        it.opts.unevaluated && allProps.length && it.props !== !0 && (it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props));
        let properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema[p]));
        if (properties.length === 0)
          return;
        let valid = gen.name("valid");
        for (let prop of properties)
          hasDefault(prop) ? applyPropertySchema(prop) : (gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties)), applyPropertySchema(prop), it.allErrors || gen.else().var(valid, !0), gen.endIf()), cxt.it.definedProperties.add(prop), cxt.ok(valid);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var code_1 = require_code2(), codegen_1 = require_codegen(), util_1 = require_util(), util_2 = require_util(), def = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        let { gen, schema, data, parentSchema, it } = cxt, { opts } = it, patterns = (0, code_1.allSchemaProperties)(schema), alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema[p]));
        if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === !0))
          return;
        let checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties, valid = gen.name("valid");
        it.props !== !0 && !(it.props instanceof codegen_1.Name) && (it.props = (0, util_2.evaluatedPropsToName)(gen, it.props));
        let { props } = it;
        validatePatternProperties();
        function validatePatternProperties() {
          for (let pat of patterns)
            checkProperties && checkMatchingProperties(pat), it.allErrors ? validateProperties(pat) : (gen.var(valid, !0), validateProperties(pat), gen.if(valid));
        }
        function checkMatchingProperties(pat) {
          for (let prop in checkProperties)
            new RegExp(pat).test(prop) && (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
        }
        function validateProperties(pat) {
          gen.forIn("key", data, (key) => {
            gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
              let alwaysValid = alwaysValidPatterns.includes(pat);
              alwaysValid || cxt.subschema({
                keyword: "patternProperties",
                schemaProp: pat,
                dataProp: key,
                dataPropType: util_2.Type.Str
              }, valid), it.opts.unevaluated && props !== !0 ? gen.assign((0, codegen_1._)`${props}[${key}]`, !0) : !alwaysValid && !it.allErrors && gen.if((0, codegen_1.not)(valid), () => gen.break());
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var util_1 = require_util(), def = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: !0,
      code(cxt) {
        let { gen, schema, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          cxt.fail();
          return;
        }
        let valid = gen.name("valid");
        cxt.subschema({
          keyword: "not",
          compositeRule: !0,
          createErrors: !1,
          allErrors: !1
        }, valid), cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var code_1 = require_code2(), def = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: !0,
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), util_1 = require_util(), error = {
      message: "must match exactly one schema in oneOf",
      params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
    }, def = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: !0,
      error,
      code(cxt) {
        let { gen, schema, parentSchema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        if (it.opts.discriminator && parentSchema.discriminator)
          return;
        let schArr = schema, valid = gen.let("valid", !1), passing = gen.let("passing", null), schValid = gen.name("_valid");
        cxt.setParams({ passing }), gen.block(validateOneOf), cxt.result(valid, () => cxt.reset(), () => cxt.error(!0));
        function validateOneOf() {
          schArr.forEach((sch, i) => {
            let schCxt;
            (0, util_1.alwaysValidSchema)(it, sch) ? gen.var(schValid, !0) : schCxt = cxt.subschema({
              keyword: "oneOf",
              schemaProp: i,
              compositeRule: !0
            }, schValid), i > 0 && gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, !1).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else(), gen.if(schValid, () => {
              gen.assign(valid, !0), gen.assign(passing, i), schCxt && cxt.mergeEvaluated(schCxt, codegen_1.Name);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var util_1 = require_util(), def = {
      keyword: "allOf",
      schemaType: "array",
      code(cxt) {
        let { gen, schema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        let valid = gen.name("valid");
        schema.forEach((sch, i) => {
          if ((0, util_1.alwaysValidSchema)(it, sch))
            return;
          let schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
          cxt.ok(valid), cxt.mergeEvaluated(schCxt);
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), util_1 = require_util(), error = {
      message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
      params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
    }, def = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: !0,
      error,
      code(cxt) {
        let { gen, parentSchema, it } = cxt;
        parentSchema.then === void 0 && parentSchema.else === void 0 && (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
        let hasThen = hasSchema(it, "then"), hasElse = hasSchema(it, "else");
        if (!hasThen && !hasElse)
          return;
        let valid = gen.let("valid", !0), schValid = gen.name("_valid");
        if (validateIf(), cxt.reset(), hasThen && hasElse) {
          let ifClause = gen.let("ifClause");
          cxt.setParams({ ifClause }), gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        } else hasThen ? gen.if(schValid, validateClause("then")) : gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        cxt.pass(valid, () => cxt.error(!0));
        function validateIf() {
          let schCxt = cxt.subschema({
            keyword: "if",
            compositeRule: !0,
            createErrors: !1,
            allErrors: !1
          }, schValid);
          cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
          return () => {
            let schCxt = cxt.subschema({ keyword }, schValid);
            gen.assign(valid, schValid), cxt.mergeValidEvaluated(schCxt, valid), ifClause ? gen.assign(ifClause, (0, codegen_1._)`${keyword}`) : cxt.setParams({ ifClause: keyword });
          };
        }
      }
    };
    function hasSchema(it, keyword) {
      let schema = it.schema[keyword];
      return schema !== void 0 && !(0, util_1.alwaysValidSchema)(it, schema);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/thenElse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var util_1 = require_util(), def = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword, parentSchema, it }) {
        parentSchema.if === void 0 && (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var additionalItems_1 = require_additionalItems(), prefixItems_1 = require_prefixItems(), items_1 = require_items(), items2020_1 = require_items2020(), contains_1 = require_contains(), dependencies_1 = require_dependencies(), propertyNames_1 = require_propertyNames(), additionalProperties_1 = require_additionalProperties(), properties_1 = require_properties(), patternProperties_1 = require_patternProperties(), not_1 = require_not(), anyOf_1 = require_anyOf(), oneOf_1 = require_oneOf(), allOf_1 = require_allOf(), if_1 = require_if(), thenElse_1 = require_thenElse();
    function getApplicator(draft2020 = !1) {
      let applicator = [
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
      return draft2020 ? applicator.push(prefixItems_1.default, items2020_1.default) : applicator.push(additionalItems_1.default, items_1.default), applicator.push(contains_1.default), applicator;
    }
    exports.default = getApplicator;
  }
});

// node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/format.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
    }, def = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: !0,
      error,
      code(cxt, ruleType) {
        let { gen, data, $data, schema, schemaCode, it } = cxt, { opts, errSchemaPath, schemaEnv, self } = it;
        if (!opts.validateFormats)
          return;
        $data ? validate$DataFormat() : validateFormat();
        function validate$DataFormat() {
          let fmts = gen.scopeValue("formats", {
            ref: self.formats,
            code: opts.code.formats
          }), fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`), fType = gen.let("fType"), format = gen.let("format");
          gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef)), cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
          function unknownFmt() {
            return opts.strictSchema === !1 ? codegen_1.nil : (0, codegen_1._)`${schemaCode} && !${format}`;
          }
          function invalidFmt() {
            let callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`, validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
            return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
          }
        }
        function validateFormat() {
          let formatDef = self.formats[schema];
          if (!formatDef) {
            unknownFormat();
            return;
          }
          if (formatDef === !0)
            return;
          let [fmtType, format, fmtRef] = getFormat(formatDef);
          fmtType === ruleType && cxt.pass(validCondition());
          function unknownFormat() {
            if (opts.strictSchema === !1) {
              self.logger.warn(unknownMsg());
              return;
            }
            throw new Error(unknownMsg());
            function unknownMsg() {
              return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
            }
          }
          function getFormat(fmtDef) {
            let code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema)}` : void 0, fmt = gen.scopeValue("formats", { key: schema, ref: fmtDef, code });
            return typeof fmtDef == "object" && !(fmtDef instanceof RegExp) ? [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`] : ["string", fmtDef, fmt];
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var format_1 = require_format(), format = [format_1.default];
    exports.default = format;
  }
});

// node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS({
  "node_modules/ajv/dist/vocabularies/metadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var core_1 = require_core2(), validation_1 = require_validation(), applicator_1 = require_applicator(), format_1 = require_format2(), metadata_1 = require_metadata(), draft7Vocabularies = [
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
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.DiscrError = void 0;
    var DiscrError;
    (function(DiscrError2) {
      DiscrError2.Tag = "tag", DiscrError2.Mapping = "mapping";
    })(DiscrError || (exports.DiscrError = DiscrError = {}));
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var codegen_1 = require_codegen(), types_1 = require_types(), compile_1 = require_compile(), ref_error_1 = require_ref_error(), util_1 = require_util(), error = {
      message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
      params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
    }, def = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error,
      code(cxt) {
        let { gen, data, schema, parentSchema, it } = cxt, { oneOf } = parentSchema;
        if (!it.opts.discriminator)
          throw new Error("discriminator: requires discriminator option");
        let tagName = schema.propertyName;
        if (typeof tagName != "string")
          throw new Error("discriminator: requires propertyName");
        if (schema.mapping)
          throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
          throw new Error("discriminator: requires oneOf keyword");
        let valid = gen.let("valid", !1), tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(!1, { discrError: types_1.DiscrError.Tag, tag, tagName })), cxt.ok(valid);
        function validateMapping() {
          let mapping = getMapping();
          gen.if(!1);
          for (let tagValue in mapping)
            gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`), gen.assign(valid, applyTagSchema(mapping[tagValue]));
          gen.else(), cxt.error(!1, { discrError: types_1.DiscrError.Mapping, tag, tagName }), gen.endIf();
        }
        function applyTagSchema(schemaProp) {
          let _valid = gen.name("valid"), schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
          return cxt.mergeEvaluated(schCxt, codegen_1.Name), _valid;
        }
        function getMapping() {
          var _a;
          let oneOfMapping = {}, topRequired = hasRequired(parentSchema), tagRequired = !0;
          for (let i = 0; i < oneOf.length; i++) {
            let sch = oneOf[i];
            if (sch?.$ref && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
              let ref = sch.$ref;
              if (sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref), sch instanceof compile_1.SchemaEnv && (sch = sch.schema), sch === void 0)
                throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
            }
            let propSch = (_a = sch?.properties) === null || _a === void 0 ? void 0 : _a[tagName];
            if (typeof propSch != "object")
              throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
            tagRequired = tagRequired && (topRequired || hasRequired(sch)), addMappings(propSch, i);
          }
          if (!tagRequired)
            throw new Error(`discriminator: "${tagName}" must be required`);
          return oneOfMapping;
          function hasRequired({ required }) {
            return Array.isArray(required) && required.includes(tagName);
          }
          function addMappings(sch, i) {
            if (sch.const)
              addMapping(sch.const, i);
            else if (sch.enum)
              for (let tagValue of sch.enum)
                addMapping(tagValue, i);
            else
              throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
          }
          function addMapping(tagValue, i) {
            if (typeof tagValue != "string" || tagValue in oneOfMapping)
              throw new Error(`discriminator: "${tagName}" values must be unique strings`);
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
          uniqueItems: !0,
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
        default: !0,
        readOnly: {
          type: "boolean",
          default: !1
        },
        examples: {
          type: "array",
          items: !0
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
          default: !0
        },
        maxItems: { $ref: "#/definitions/nonNegativeInteger" },
        minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: !1
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
        const: !0,
        enum: {
          type: "array",
          items: !0,
          minItems: 1,
          uniqueItems: !0
        },
        type: {
          anyOf: [
            { $ref: "#/definitions/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/definitions/simpleTypes" },
              minItems: 1,
              uniqueItems: !0
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
      default: !0
    };
  }
});

// node_modules/ajv/dist/ajv.js
var require_ajv = __commonJS({
  "node_modules/ajv/dist/ajv.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv = void 0;
    var core_1 = require_core(), draft7_1 = require_draft7(), discriminator_1 = require_discriminator(), draft7MetaSchema = require_json_schema_draft_07(), META_SUPPORT_DATA = ["/properties"], META_SCHEMA_ID = "http://json-schema.org/draft-07/schema", Ajv2 = class extends core_1.default {
      _addVocabularies() {
        super._addVocabularies(), draft7_1.default.forEach((v) => this.addVocabulary(v)), this.opts.discriminator && this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        if (super._addDefaultMetaSchema(), !this.opts.meta)
          return;
        let metaSchema = this.opts.$data ? this.$dataMetaSchema(draft7MetaSchema, META_SUPPORT_DATA) : draft7MetaSchema;
        this.addMetaSchema(metaSchema, META_SCHEMA_ID, !1), this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv = Ajv2;
    module.exports = exports = Ajv2;
    module.exports.Ajv = Ajv2;
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.default = Ajv2;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: !0, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: !0, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: !0, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: !0, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: !0, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: !0, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: !0, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: !0, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: !0, get: function() {
      return ref_error_1.default;
    } });
  }
});

// node_modules/ajv-formats/dist/formats.js
var require_formats = __commonJS({
  "node_modules/ajv-formats/dist/formats.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.formatNames = exports.fastFormats = exports.fullFormats = void 0;
    function fmtDef(validate, compare) {
      return { validate, compare };
    }
    exports.fullFormats = {
      // date: http://tools.ietf.org/html/rfc3339#section-5.6
      date: fmtDef(date, compareDate),
      // date-time: http://tools.ietf.org/html/rfc3339#section-5.6
      time: fmtDef(getTime(!0), compareTime),
      "date-time": fmtDef(getDateTime(!0), compareDateTime),
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
      password: !0,
      // unchecked string payload
      binary: !0
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
    var DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/, DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    function date(str) {
      let matches = DATE.exec(str);
      if (!matches)
        return !1;
      let year = +matches[1], month = +matches[2], day = +matches[3];
      return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
    }
    function compareDate(d1, d2) {
      if (d1 && d2)
        return d1 > d2 ? 1 : d1 < d2 ? -1 : 0;
    }
    var TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
    function getTime(strictTimeZone) {
      return function(str) {
        let matches = TIME.exec(str);
        if (!matches)
          return !1;
        let hr = +matches[1], min = +matches[2], sec = +matches[3], tz = matches[4], tzSign = matches[5] === "-" ? -1 : 1, tzH = +(matches[6] || 0), tzM = +(matches[7] || 0);
        if (tzH > 23 || tzM > 59 || strictTimeZone && !tz)
          return !1;
        if (hr <= 23 && min <= 59 && sec < 60)
          return !0;
        let utcMin = min - tzM * tzSign, utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
        return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
      };
    }
    function compareTime(s1, s2) {
      if (!(s1 && s2))
        return;
      let t1 = (/* @__PURE__ */ new Date("2020-01-01T" + s1)).valueOf(), t2 = (/* @__PURE__ */ new Date("2020-01-01T" + s2)).valueOf();
      if (t1 && t2)
        return t1 - t2;
    }
    function compareIsoTime(t1, t2) {
      if (!(t1 && t2))
        return;
      let a1 = TIME.exec(t1), a2 = TIME.exec(t2);
      if (a1 && a2)
        return t1 = a1[1] + a1[2] + a1[3], t2 = a2[1] + a2[2] + a2[3], t1 > t2 ? 1 : t1 < t2 ? -1 : 0;
    }
    var DATE_TIME_SEPARATOR = /t|\s/i;
    function getDateTime(strictTimeZone) {
      let time = getTime(strictTimeZone);
      return function(str) {
        let dateTime = str.split(DATE_TIME_SEPARATOR);
        return dateTime.length === 2 && date(dateTime[0]) && time(dateTime[1]);
      };
    }
    function compareDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return;
      let d1 = new Date(dt1).valueOf(), d2 = new Date(dt2).valueOf();
      if (d1 && d2)
        return d1 - d2;
    }
    function compareIsoDateTime(dt1, dt2) {
      if (!(dt1 && dt2))
        return;
      let [d1, t1] = dt1.split(DATE_TIME_SEPARATOR), [d2, t2] = dt2.split(DATE_TIME_SEPARATOR), res = compareDate(d1, d2);
      if (res !== void 0)
        return res || compareTime(t1, t2);
    }
    var NOT_URI_FRAGMENT = /\/|:/, URI = /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
    function uri(str) {
      return NOT_URI_FRAGMENT.test(str) && URI.test(str);
    }
    var BYTE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
    function byte(str) {
      return BYTE.lastIndex = 0, BYTE.test(str);
    }
    var MIN_INT32 = -(2 ** 31), MAX_INT32 = 2 ** 31 - 1;
    function validateInt32(value) {
      return Number.isInteger(value) && value <= MAX_INT32 && value >= MIN_INT32;
    }
    function validateInt64(value) {
      return Number.isInteger(value);
    }
    function validateNumber() {
      return !0;
    }
    var Z_ANCHOR = /[^\\]\\Z/;
    function regex(str) {
      if (Z_ANCHOR.test(str))
        return !1;
      try {
        return new RegExp(str), !0;
      } catch {
        return !1;
      }
    }
  }
});

// node_modules/ajv-formats/dist/limit.js
var require_limit = __commonJS({
  "node_modules/ajv-formats/dist/limit.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.formatLimitDefinition = void 0;
    var ajv_1 = require_ajv(), codegen_1 = require_codegen(), ops = codegen_1.operators, KWDs = {
      formatMaximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      formatMinimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      formatExclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      formatExclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    }, error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`should be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    exports.formatLimitDefinition = {
      keyword: Object.keys(KWDs),
      type: "string",
      schemaType: "string",
      $data: !0,
      error,
      code(cxt) {
        let { gen, data, schemaCode, keyword, it } = cxt, { opts, self } = it;
        if (!opts.validateFormats)
          return;
        let fCxt = new ajv_1.KeywordCxt(it, self.RULES.all.format.definition, "format");
        fCxt.$data ? validate$DataFormat() : validateFormat();
        function validate$DataFormat() {
          let fmts = gen.scopeValue("formats", {
            ref: self.formats,
            code: opts.code.formats
          }), fmt = gen.const("fmt", (0, codegen_1._)`${fmts}[${fCxt.schemaCode}]`);
          cxt.fail$data((0, codegen_1.or)((0, codegen_1._)`typeof ${fmt} != "object"`, (0, codegen_1._)`${fmt} instanceof RegExp`, (0, codegen_1._)`typeof ${fmt}.compare != "function"`, compareCode(fmt)));
        }
        function validateFormat() {
          let format = fCxt.schema, fmtDef = self.formats[format];
          if (!fmtDef || fmtDef === !0)
            return;
          if (typeof fmtDef != "object" || fmtDef instanceof RegExp || typeof fmtDef.compare != "function")
            throw new Error(`"${keyword}": format "${format}" does not define "compare" function`);
          let fmt = gen.scopeValue("formats", {
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
    var formatLimitPlugin = (ajv) => (ajv.addKeyword(exports.formatLimitDefinition), ajv);
    exports.default = formatLimitPlugin;
  }
});

// node_modules/ajv-formats/dist/index.js
var require_dist2 = __commonJS({
  "node_modules/ajv-formats/dist/index.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: !0 });
    var formats_1 = require_formats(), limit_1 = require_limit(), codegen_1 = require_codegen(), fullName = new codegen_1.Name("fullFormats"), fastName = new codegen_1.Name("fastFormats"), formatsPlugin = (ajv, opts = { keywords: !0 }) => {
      if (Array.isArray(opts))
        return addFormats2(ajv, opts, formats_1.fullFormats, fullName), ajv;
      let [formats, exportName] = opts.mode === "fast" ? [formats_1.fastFormats, fastName] : [formats_1.fullFormats, fullName], list = opts.formats || formats_1.formatNames;
      return addFormats2(ajv, list, formats, exportName), opts.keywords && (0, limit_1.default)(ajv), ajv;
    };
    formatsPlugin.get = (name, mode = "full") => {
      let f = (mode === "fast" ? formats_1.fastFormats : formats_1.fullFormats)[name];
      if (!f)
        throw new Error(`Unknown format "${name}"`);
      return f;
    };
    function addFormats2(ajv, list, fs, exportName) {
      var _a, _b;
      (_a = (_b = ajv.opts.code).formats) !== null && _a !== void 0 || (_b.formats = (0, codegen_1._)`require("ajv-formats/dist/formats").${exportName}`);
      for (let f of list)
        ajv.addFormat(f, fs[f]);
    }
    module.exports = exports = formatsPlugin;
    Object.defineProperty(exports, "__esModule", { value: !0 });
    exports.default = formatsPlugin;
  }
});

// scripts/artifact-validator/parser.mjs
var import_yaml = __toESM(require_dist(), 1);
function yamlObject(source, label, failures) {
  let document = (0, import_yaml.parseDocument)(source, { prettyErrors: !1, uniqueKeys: !0 });
  for (let error of document.errors) failures.push(`${label}: invalid YAML: ${error.message}`);
  if (document.errors.length > 0) return null;
  let value = document.toJS();
  return !value || typeof value != "object" || Array.isArray(value) ? (failures.push(`${label} must be a YAML object`), null) : value;
}
function visibleH2Headings(source) {
  let headings = [], fenced = !1;
  for (let line of String(source).split(/\r?\n/)) {
    if (/^```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    let match = line.match(/^## ([^#].*)$/);
    match && headings.push(match[1].trim());
  }
  return headings;
}
function validateHumanFirstNextStep(projection, failures) {
  let source = String(projection);
  if ([...source.matchAll(/^### Next step\s*$/gm)].length !== 1) {
    failures.push("human-first native plan projection requires exactly one complete ### Next step block");
    return;
  }
  let quick = source.match(/^## Quick decision\s*$([\s\S]*?)(?=^## Details\s*$)/m)?.[1] ?? "", block = quick.match(/^### Next step\s*$([\s\S]*)$/m);
  if (!block || !quick.trimEnd().endsWith(block[0].trimEnd())) {
    failures.push("human-first native plan projection requires ### Next step at the end of Quick decision");
    return;
  }
  let lines = block[1].trim().split(/\r?\n/).filter(Boolean), expected = ["Now", "How", "Why"];
  (lines.length !== expected.length || expected.some((label, index) => !new RegExp(`^- ${label}:\\s*\\S`).test(lines[index]))) && failures.push("human-first native plan projection requires complete Now, How, and Why lines in ### Next step");
}
function parsePlanContainer(text, wrapper, failures, normalizations = []) {
  let match = String(text).match(/(?:^|\n)# ([^\r\n]+)\r?\n([\s\S]*?)```yaml artifact-envelope\r?\n([\s\S]*?)\r?\n```(?:\r?\n|$)/);
  if (!match)
    return failures.push("native plan must contain one H1 and one yaml artifact-envelope"), null;
  let projection = match[2].trim();
  if (projection) {
    let headings = visibleH2Headings(projection), expected = ["Quick decision", "Details", "Agent and machine contract (authoritative)"];
    if (headings.length !== expected.length || headings.some((heading, index) => heading !== expected[index]))
      return failures.push("human-first native plan projection must order Quick decision, Details, then Agent and machine contract (authoritative)"), null;
    if (validateHumanFirstNextStep(projection, failures), failures.length > 0) return null;
  }
  let fields = yamlObject(match[3], "artifact envelope", failures);
  return fields ? (fields.artifact !== "work-plan" && failures.push("native plan containers may contain only work-plan"), match.index + (match[0].startsWith(`
`) ? 1 : 0) > 0 && normalizations.push("ignored Cursor progress text before native plan"), projection && normalizations.push("validated human-first native plan projection"), { fields, body: String(text).slice(match.index + match[0].length), wrapper, container: "cursor-plan", title: match[1], normalizations }) : null;
}
function parseArtifact(text, failures = [], normalizations = []) {
  let source = String(text), candidates = [], expression = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/gm;
  for (let match2 of source.matchAll(expression)) {
    let probeFailures = [], fields2 = yamlObject(match2[1], "frontmatter", probeFailures);
    if (!fields2) continue;
    (typeof fields2.artifact == "string" || ["name", "overview", "todos", "isProject"].some((field) => field in fields2)) && candidates.push({ match: match2, fields: fields2 });
  }
  let envelopes = [], envelopeExpression = /```yaml(?: artifact-envelope)?\r?\n([\s\S]*?)\r?\n```(?:\r?\n|$)/g;
  for (let match2 of source.matchAll(envelopeExpression)) {
    let probeFailures = [], fields2 = yamlObject(match2[1], "artifact envelope", probeFailures);
    fields2?.artifact && envelopes.push({ match: match2, fields: fields2 });
  }
  if (candidates.length === 0) {
    if (envelopes.length > 1)
      return failures.push("response contains multiple workflow artifact candidates"), null;
    if (envelopes.length === 1) {
      let [{ match: match2, fields: fields2 }] = envelopes;
      return normalizations.push("normalized fenced Workflow artifact to chat artifact"), match2.index > 0 && normalizations.push("ignored Cursor progress preamble"), { fields: fields2, body: source.slice(match2.index + match2[0].length), wrapper: null, container: "normalized-envelope", normalizations };
    }
    return failures.push("response is missing workflow YAML frontmatter"), null;
  }
  if (candidates.length > 1 || envelopes.length > 1)
    return failures.push("response contains multiple workflow artifact candidates"), null;
  let [{ match, fields }] = candidates;
  return typeof fields.artifact == "string" && envelopes.length > 0 ? (failures.push("response contains multiple workflow artifact candidates"), null) : (match.index > 0 && normalizations.push("ignored Cursor progress preamble"), typeof fields.artifact == "string" ? { fields, body: source.slice(match.index + match[0].length), wrapper: null, container: "chat-artifact", normalizations } : ["name", "overview", "todos", "isProject"].some((field) => field in fields) ? parsePlanContainer(source.slice(match.index + match[0].length), fields, failures, normalizations) : (failures.push("artifact type is missing"), null));
}
function artifactYamlCandidate(text) {
  let source = String(text), candidates = [], frontmatterExpression = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/gm;
  for (let match of source.matchAll(frontmatterExpression)) {
    let failures = [], fields = yamlObject(match[1], "frontmatter", failures);
    failures.length === 0 && typeof fields?.artifact == "string" && candidates.push({ match, yaml: match[1] });
  }
  let envelopeExpression = /```yaml(?: artifact-envelope)?\r?\n([\s\S]*?)\r?\n```(?:\r?\n|$)/g;
  for (let match of source.matchAll(envelopeExpression)) {
    let failures = [], fields = yamlObject(match[1], "artifact envelope", failures);
    failures.length === 0 && typeof fields?.artifact == "string" && candidates.push({ match, yaml: match[1] });
  }
  if (candidates.length !== 1) throw new Error(`artifact text requires exactly one Workflow YAML candidate; observed ${candidates.length}`);
  let candidate = candidates[0], start = candidate.match.index + candidate.match[0].indexOf(candidate.yaml);
  return { source, yaml: candidate.yaml, start, end: start + candidate.yaml.length };
}
function opaqueExtensionsFromArtifactText(text) {
  let candidate = artifactYamlCandidate(text), document = (0, import_yaml.parseDocument)(candidate.yaml, { prettyErrors: !1, uniqueKeys: !0 });
  if (document.errors.length > 0) throw new Error(`invalid Workflow YAML: ${document.errors.map((error) => error.message).join("; ")}`);
  let fields = document.toJS();
  return Object.hasOwn(fields, "extensions") ? { present: !0, value: structuredClone(fields.extensions) } : { present: !1, value: null };
}
function replaceOpaqueExtensions(text, opaque = { present: !1, value: null }) {
  let candidate = artifactYamlCandidate(text), document = (0, import_yaml.parseDocument)(candidate.yaml, { prettyErrors: !1, uniqueKeys: !0 });
  if (document.errors.length > 0) throw new Error(`invalid Workflow YAML: ${document.errors.map((error) => error.message).join("; ")}`);
  if (document.delete("extensions"), opaque.present === !0) {
    if (!opaque.value || typeof opaque.value != "object" || Array.isArray(opaque.value)) throw new Error("opaque extensions must be an object");
    document.set("extensions", structuredClone(opaque.value));
  }
  let yaml = document.toString({ lineWidth: 0 }).trimEnd();
  return `${candidate.source.slice(0, candidate.start)}${yaml}${candidate.source.slice(candidate.end)}`;
}

// scripts/validate-artifact.source.mjs
import { existsSync as existsSync2, readFileSync as readFileSync2, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, resolve as resolve2 } from "node:path";
import { fileURLToPath } from "node:url";

// scripts/artifact-validator/evidence.mjs
function leanEvidenceData(fields) {
  let objectiveStatus = fields.status === "complete" ? "achieved" : fields.status === "blocked" ? "blocked" : "partially-achieved", outcomes = (fields.affected_objectives ?? []).map((id) => ({
    "Objective ID": id,
    Status: objectiveStatus,
    Evidence: `lean evidence ${fields.id}`
  })), checks = (fields.check_evidence ?? []).map((entry) => ({
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
  let byId = new Map(items.map((item) => [item.fields.id, item])), starts = items.filter((item) => !item.fields[predecessorField]);
  starts.length !== 1 && failures.push(`${label}: chain requires exactly one initial artifact`);
  let successors = /* @__PURE__ */ new Map();
  for (let item of items) {
    let predecessor = item.fields[predecessorField];
    if (!predecessor) continue;
    byId.has(predecessor) || failures.push(`${item.label}: missing predecessor ${predecessor}`);
    let list = successors.get(predecessor) ?? [];
    list.push(item), successors.set(predecessor, list);
  }
  for (let [id, list] of successors) list.length > 1 && failures.push(`${label}: chain branches after ${id}`);
  let ordered = [], seen = /* @__PURE__ */ new Set(), cursor = starts[0];
  for (; cursor && !seen.has(cursor.fields.id); )
    seen.add(cursor.fields.id), ordered.push(cursor), cursor = successors.get(cursor.fields.id)?.[0];
  return (cursor || ordered.length !== items.length) && failures.push(`${label}: chain is cyclic or disconnected`), ordered;
}
function lineageTips(items, predecessorField) {
  let referenced = new Set(items.map((item) => item.fields[predecessorField]).filter(Boolean));
  return items.filter((item) => !referenced.has(item.fields.id));
}

// scripts/artifact-validator/schema.mjs
var import_ajv = __toESM(require_ajv(), 1), import_ajv_formats = __toESM(require_dist2(), 1);
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
function formatAjv(error) {
  let location = error.instancePath || "/";
  return error.keyword === "additionalProperties" ? `${location}: additional property ${error.params.additionalProperty}` : `${location}: ${error.message}`;
}
function schemaFor(root, artifact) {
  return join(resolve(root), "schemas", "artifacts", `${artifact}.schema.json`);
}
function validateArtifactSchema(root, parsed, failures) {
  let path = schemaFor(root, parsed.fields.artifact);
  if (!existsSync(path))
    return failures.push(`unsupported artifact type: ${parsed.fields.artifact}`), null;
  let ajv = new import_ajv.default({ allErrors: !0, strict: !1 });
  if ((0, import_ajv_formats.default)(ajv), parsed.wrapper) {
    let wrapperSchema = JSON.parse(readFileSync(join(resolve(root), "schemas", "cursor-plan-wrapper.schema.json"), "utf8")), validateWrapper = ajv.compile(wrapperSchema);
    validateWrapper(parsed.wrapper) || failures.push(...validateWrapper.errors.map((error) => `Cursor wrapper ${formatAjv(error)}`));
  }
  let schema = JSON.parse(readFileSync(path, "utf8")), validate = ajv.compile(schema);
  return validate(parsed.fields) || failures.push(...validate.errors.map(formatAjv)), schema;
}

// src/core/manual-attestation.mjs
var import_yaml2 = __toESM(require_dist(), 1), PLAN_CLOSEOUT_ATTESTATION = Object.freeze({
  schema: 1,
  kind: "plan-closeout",
  action: "delivery-closeout"
}), LEGACY_PLAN_CLOSEOUT_ATTESTATION = Object.freeze({
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
]), CHECK_EVIDENCE_FIELDS = Object.freeze([
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
var scriptDirectory = dirname(fileURLToPath(import.meta.url)), defaultRoot = dirname(scriptDirectory), knownArtifacts = /* @__PURE__ */ new Set([
  "work-plan",
  "delivery-evidence",
  "work-review"
]), riskRank = Object.freeze({ low: 1, medium: 2, high: 3 }), assuranceRank = Object.freeze({ lean: 1, standard: 2, deep: 3 }), hardTriggers = /* @__PURE__ */ new Set([
  "security-secrets",
  "destructive-data",
  "regulated-or-monetary",
  "breaking-external-contract",
  "irreversible-external-effect",
  "no-recovery-path",
  "broad-runtime-impact",
  "material-uncertainty"
]), objectivePattern = /\bOBJ-[1-9][0-9]*\b/g, fixPattern = /\bFIX-[1-9][0-9]*\b/g, checkPattern = /\bCHECK-[1-9][0-9]*\b/g;
var slicePattern = /\bSLICE-[1-9][0-9]*\b/g, learningPattern = /\bLRN-[A-Za-z0-9][A-Za-z0-9-]*\b/g, requiredScopeCategories = ["required", "permitted", "prohibited"], baselineKinds = ["repository", "head", "dirty-files", "known-failures", "targets-and-prerequisites"], sectionAliases = Object.freeze({
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
}), headerAliases = Object.freeze({
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
}), optionalTableCells = /* @__PURE__ */ new Set(["prerequisite fingerprints", "relevant fingerprints"]), tables = Object.freeze({
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
}), assuranceFactors = Object.freeze([
  ["Failure impact", 0, 3],
  ["Irreversibility", 0, 2],
  ["Uncertainty", 0, 2],
  ["Evidence weakness", 0, 2],
  ["Change surface", 0, 1]
]), costRank = Object.freeze({ cheap: 1, standard: 2, expensive: 3 }), readinessItems = [
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
  return Array.isArray(value) ? value.map(stableValue) : !value || typeof value != "object" ? value : Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}
function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
function maskFences(text) {
  let fence = null;
  return String(text).split(/(?<=\n)/).map((line) => {
    if (!fence) {
      let marker = line.match(/^[ \t]*(`{3,}|~{3,})/);
      return marker ? (fence = { char: marker[1][0], size: marker[1].length }, line.replace(/[^\r\n]/g, " ")) : line;
    }
    let masked = line.replace(/[^\r\n]/g, " ");
    return new RegExp(`^[ \\t]*${fence.char}{${fence.size},}[ \\t]*(?:\\r?\\n)?$`).test(line) && (fence = null), masked;
  }).join("");
}
function sectionMap(body, required, failures, normalizations = []) {
  let matches = [...maskFences(body).matchAll(/^## ([^\r\n]+)$/gm)], actual = matches.map((match) => match[1].trim()), sections = /* @__PURE__ */ new Map();
  matches.forEach((match, index) => {
    let start = match.index + match[0].length, end = matches[index + 1]?.index ?? body.length, content = body.slice(start, end).trim(), actualName = match[1].trim(), normalizedActual = normalizedHeader(actualName), canonical = Object.entries(sectionAliases).find(
      ([name, aliases]) => normalizedHeader(name) === normalizedActual || aliases.some((alias) => normalizedHeader(alias) === normalizedActual)
    )?.[0] ?? actualName;
    canonical !== actualName && normalizations.push(`normalized section ${actualName} to ${canonical}`), sections.has(canonical) && failures.push(`${canonical}: duplicate section`), sections.set(canonical, content);
  });
  for (let name of required) sections.has(name) || failures.push(`missing required section ${name}`);
  return actual.filter((name) => required.some((candidate) => candidate.toLowerCase() === name.toLowerCase())).map((name) => name.toLowerCase()).join(`
`) !== required.filter((name) => sections.has(name)).map((name) => name.toLowerCase()).join(`
`) && normalizations.push("normalized Markdown section order"), sections;
}
function trimTrailingNotes(body, required, normalizations) {
  let separators = [...maskFences(body).matchAll(/^---[ \t]*$/gm)];
  for (let separator of separators.toReversed()) {
    let prefix = body.slice(0, separator.index), headings = new Set([...maskFences(prefix).matchAll(/^## ([^\r\n]+)$/gm)].map((match) => match[1].trim().toLowerCase()));
    if (required.every((name) => headings.has(name.toLowerCase())))
      return normalizations.push("ignored trailing explanation after workflow artifact"), prefix.trimEnd();
  }
  return body;
}
function cells(line) {
  let parsed = [], current = "", escaped = !1;
  for (let char of String(line).trim()) {
    if (escaped) {
      current += char, escaped = !1;
      continue;
    }
    if (char === "\\") {
      escaped = !0;
      continue;
    }
    if (char === "|") {
      parsed.push(current.trim()), current = "";
      continue;
    }
    current += char;
  }
  return parsed.push(current.trim()), parsed[0] === "" && parsed.shift(), parsed.at(-1) === "" && parsed.pop(), parsed;
}
function markdownTables(content) {
  let lines = maskFences(content).split(/\r?\n/), found = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    let headers = cells(lines[index]), separator = cells(lines[index + 1]);
    if (headers.length < 2 || separator.length !== headers.length || !separator.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    let rows = [];
    for (index += 2; index < lines.length && lines[index].includes("|"); ) {
      let row = cells(lines[index]);
      if (row.length !== headers.length) break;
      rows.push(Object.fromEntries(headers.map((header, cellIndex) => [header, row[cellIndex]]))), index += 1;
    }
    index -= 1, found.push({ headers, rows });
  }
  return found;
}
function normalizedHeader(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tableMatching(content, headers) {
  let resolveHeader = (candidate, expected) => {
    let normalizedCandidate = normalizedHeader(candidate), normalizedExpected = normalizedHeader(expected);
    return normalizedCandidate === normalizedExpected || (headerAliases[normalizedExpected] ?? []).some((alias) => normalizedHeader(alias) === normalizedCandidate);
  };
  return markdownTables(content).flatMap((candidate) => {
    let mapping = /* @__PURE__ */ new Map();
    for (let expected of headers) {
      let matches = candidate.headers.filter((actual) => resolveHeader(actual, expected));
      if (matches.length !== 1) return [];
      mapping.set(expected, matches[0]);
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
  let matches = [...maskFences(content).matchAll(/^### ([^\r\n]+)$/gm)], index = matches.findIndex((match) => normalizedHeader(match[1]) === normalizedHeader(name));
  if (index < 0) return "";
  let start = matches[index].index + matches[index][0].length, end = matches[index + 1]?.index ?? content.length;
  return content.slice(start, end).trim();
}
function verificationSectionContent(artifact) {
  let sections = artifact?.sections instanceof Map ? artifact.sections : /* @__PURE__ */ new Map(), topLevel = sections.get("Verification") ?? "";
  if (tableRows(topLevel, tables.verification).length > 0 || tableRows(topLevel, tables.verificationWithClass).length > 0)
    return topLevel;
  if ((artifact?.fields?.schema ?? 0) >= 5) {
    let nested = subsection(sections.get("Acceptance") ?? "", "Verification");
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
function requireTable(sections, sectionName, headers, failures, { allowNone = !1, optional = !1, normalizations = [] } = {}) {
  let content = sections.get(sectionName) ?? "";
  if (allowNone && noneLike(content))
    return content.trim() !== "None." && normalizations.push(`${sectionName}: normalized empty marker`), { headers, rows: [], none: !0 };
  if (optional && !content.trim()) return { headers, rows: [], none: !0 };
  let matches = tableMatching(content, headers);
  return allowNone && matches.length === 0 && hasStandaloneNone(content) ? (normalizations.push(`${sectionName}: materialized embedded empty marker`), { headers, rows: [], none: !0 }) : matches.length !== 1 ? (failures.push(`${sectionName}: requires exactly one table [${headers.join(", ")}]`), { headers, rows: [] }) : (matches[0].normalized && normalizations.push(`${sectionName}: normalized table column order or casing`), matches[0].rows.length === 0 && failures.push(`${sectionName}: required table must contain a row`), matches[0].rows.forEach((row, index) => {
    for (let header of headers) !row[header] && !optionalTableCells.has(normalizedHeader(header)) && failures.push(`${sectionName}: row ${index + 1} has empty ${header}`);
  }), matches[0]);
}
function placeholder(value) {
  return /<(?:placeholder|replace[-_ ]?me|insert[-_ ][^>\r\n]+|[^>\r\n]*\.{3}[^>\r\n]*)>/i.test(String(value)) || /\b(?:TBD|TODO|UNKNOWN)\b/.test(String(value));
}
function rejectPlaceholders(parsed, schema, sections, failures) {
  if (["ready", "complete", "current", "active"].includes(parsed.fields.status)) {
    for (let field of schema.required ?? []) placeholder(parsed.fields[field]) && failures.push(`frontmatter ${field} contains a placeholder`);
    for (let [name, content] of sections) placeholder(content) && failures.push(`${name}: contains a placeholder`);
  }
}
function exactIdSet(rows, column, pattern, label, failures) {
  let values = rows.map((row) => row[column]);
  for (let value of values) new RegExp(`^(?:${pattern.source})$`).test(value) || failures.push(`${label}: invalid ID ${value}`);
  return new Set(values).size !== values.length && failures.push(`${label}: IDs must be unique`), new Set(values);
}
function targetTokens(value) {
  let inline = [...String(value).matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  return (inline.length ? inline : String(value).split(",")).map((entry) => entry.trim().replace(/^\.\//, "")).filter(Boolean);
}
function targetMatches(value, scope) {
  let target = value.replace(/^\.\//, ""), candidate = scope.replace(/^\.\//, "");
  if (/^all other (?:files|paths|targets)$/i.test(candidate) || target === candidate || target.startsWith(`${candidate}/`) || target.startsWith(`${candidate}#`) || target.startsWith(`${candidate}:`)) return !0;
  if (!candidate.includes("*")) return !1;
  let expression = candidate.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("**", "\xA7\xA7").replaceAll("*", "[^/]*").replaceAll("\xA7\xA7", ".*");
  return new RegExp(`^${expression}$`).test(target);
}
function authorityTargetState(target, authority = {}) {
  let allowed = (authority.allowed_roots ?? []).some((scope) => targetMatches(target, scope)), protectedTarget = (authority.protected_paths ?? []).some((scope) => targetMatches(target, scope)), approvalRequired = (authority.approval_required_paths ?? []).some((scope) => targetMatches(target, scope));
  return { allowed, protected: protectedTarget, approval_required: approvalRequired };
}
function acceptanceChangeTargets(parsed) {
  let sources = [
    ...parsed.fields.acceptance ?? [],
    parsed.sections?.get("Acceptance") ?? ""
  ], pathLike = (value) => !/^(?:https?:|[A-Za-z][A-Za-z0-9+.-]*:)/.test(value) && !value.startsWith("/") && value !== ".." && !value.startsWith("../") && !/\s/.test(value) && (value.includes("/") || /^\.[A-Za-z0-9_-]/.test(value) || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+$/.test(value)), targets = [];
  for (let source of sources)
    for (let match of String(source).matchAll(/`([^`]+)`/g)) {
      let target = match[1].trim().replace(/^\.\//, "");
      pathLike(target) && targets.push(target);
    }
  return unique(targets);
}
function issue(code, message, details = {}) {
  return { code, message, ...details };
}
function fingerprintMap(value) {
  let entries = String(value ?? "").split(/;\s*/).flatMap((entry) => {
    let match = entry.match(/^`?([^=`]+?)`?=(.+)$/);
    if (!match) return [];
    let path = match[1].trim().replace(/^\.\//, "");
    return !path || ["index", "status"].includes(path) ? [] : [[path, match[2].trim()]];
  });
  return new Map(entries);
}
function validateCostOrder(rows, column, label, parsed) {
  let previous = 0;
  for (let row of rows) {
    let current = costRank[row[column]] ?? 99;
    if (current < previous) {
      parsed.normalizations.push(`${label}: normalized economic check order cheap, standard, expensive`);
      return;
    }
    previous = current;
  }
}
function derivedAssurance(score, triggers) {
  return (triggers ?? []).length > 0 ? "deep" : score <= 3 ? "lean" : score <= 6 ? "standard" : "deep";
}
function planData(artifact) {
  if (artifact.fields.schema >= 4) {
    let objectives2 = artifact.fields.acceptance.map((outcome, index) => ({
      "Objective ID": `OBJ-${index + 1}`,
      "Observable outcome": outcome,
      "Acceptance evidence": outcome
    })), verificationContent2 = verificationSectionContent(artifact), declaredChecks = tableRows(verificationContent2, tables.verification), declaredWithClass = tableRows(verificationContent2, tables.verificationWithClass), checks2 = declaredChecks.length > 0 ? declaredChecks : objectives2.map((objective, index) => ({
      "Check ID": `CHECK-${index + 1}`,
      Objectives: objective["Objective ID"],
      "Working Directory": "repository root",
      "Command or Inspection": "verification-profile",
      "Expected Result": objective["Observable outcome"],
      Required: "yes",
      "Cost Class": "standard",
      Prerequisites: artifact.fields.authority.allowed_roots.join(", ")
    })), evidenceClasses = declaredWithClass.length > 0 ? new Map(declaredWithClass.map((row) => [row["Check ID"], row["Evidence Class"]])) : new Map(checks2.map((row) => [row["Check ID"], "human-review-required"])), objectiveIds = objectives2.map((row) => row["Objective ID"]), objectiveDependencies2 = new Map(objectiveIds.map((id) => [id, /* @__PURE__ */ new Set()]));
    for (let check of checks2)
      for (let objective of ids(check.Objectives, objectivePattern))
        for (let target of targetTokens(check.Prerequisites)) objectiveDependencies2.get(objective)?.add(target);
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
  let objectives = tableRows(artifact.sections.get("Objectives") ?? "", tables.objectives), verificationContent = verificationSectionContent(artifact), checks = tableRows(verificationContent, tables.verification), steps = tableRows(artifact.sections.get("Execution steps") ?? "", tables.steps), scope = tableRows(artifact.sections.get("Scope and targets") ?? "", tables.scope), verificationWithClass = tableRows(verificationContent, tables.verificationWithClass), slices = tableRows(subsection(artifact.sections.get("Execution steps") ?? "", "Vertical slices"), tables.slices), objectiveDependencies = new Map(objectives.map((row) => [row["Objective ID"], /* @__PURE__ */ new Set()]));
  for (let check of checks) for (let objective of ids(check.Objectives, objectivePattern)) for (let target of targetTokens(check.Prerequisites)) objectiveDependencies.get(objective)?.add(target);
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
  for (let section of ["Intent", "Acceptance", "Boundaries", "Risks"])
    (sections.get(section) ?? "").trim() || failures.push(`${section}: section must not be empty`);
  let expectedLevel = { manual: "lean", supervised: "controlled", autonomous: "certified" }[parsed.fields.profile_max];
  parsed.fields.contract_level !== expectedLevel && failures.push(`contract_level must be ${expectedLevel} for ${parsed.fields.profile_max}`), parsed.fields.status === "ready" && parsed.fields.intent_ready !== !0 && failures.push("ready work-plan requires intent_ready true"), parsed.fields.profile_max === "autonomous" && (parsed.fields.hard_triggers ?? []).length > 0 && failures.push("hard-trigger work cannot be autonomous");
  let authority = parsed.fields.authority ?? {};
  for (let path of [...authority.allowed_roots ?? [], ...authority.protected_paths ?? [], ...authority.approval_required_paths ?? []])
    (path.startsWith("/") || path === ".." || path.startsWith("../")) && failures.push(`authority path must remain repository-relative: ${path}`);
  if (["controlled", "certified"].includes(parsed.fields.contract_level))
    for (let field of ["max_active_minutes", "max_total_tokens", "max_cost_usd"]) (!Number.isFinite(authority[field]) || authority[field] <= 0) && failures.push(`controlled authority requires ${field}`);
  let data = planData(parsed), verification = tableRows(verificationSectionContent(parsed), tables.verificationWithClass);
  for (let row of verification)
    /^CHECK-[1-9][0-9]*$/.test(row["Check ID"]) || failures.push(`Verification: invalid Check ID ${row["Check ID"]}`), /^(?:yes|no)$/.test(row.Required) || failures.push(`Verification: ${row["Check ID"]} Required must be yes|no`), /^(?:machine-verifiable|human-review-required|human-approval-required)$/.test(row["Evidence Class"]) || failures.push(`Verification: ${row["Check ID"]} invalid Evidence Class`);
  verification.length === 0 && parsed.normalizations.push("synthesized strategy checks from acceptance outcomes"), data.objectives.size !== parsed.fields.acceptance.length && failures.push("acceptance outcomes must map one-to-one to objectives"), parsed.wrapper && (parsed.wrapper.todos ?? []).length === 0 && failures.push("native Plan must include at least one implementation todo");
}
function evidenceData(artifact) {
  if (artifact.fields.schema === 5 && artifact.fields.evidence_mode === "lean") return leanEvidenceData(artifact.fields);
  let results = tableRows(artifact.sections.get("Subject results") ?? "", tables.results), outcomes = tableRows(artifact.sections.get("Objective outcomes") ?? "", tables.objectiveOutcomes), changes = tableRows(artifact.sections.get("Changes") ?? "", tables.changes), snapshot = tableRows(artifact.sections.get("Repository snapshot") ?? "", tables.snapshot)[0], checks = tableRows(artifact.sections.get("Checks") ?? "", tables.checks), steps = tableRows(artifact.sections.get("Idempotency and resume") ?? "", tables.resume);
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
  let coverage = tableRows(artifact.sections.get("Evidence coverage") ?? "", tables.coverage), findings = tableRows(artifact.sections.get("Findings") ?? "", tables.findings);
  return { coverage, findings };
}
function validatePlan(parsed, sections, failures) {
  let options = { normalizations: parsed.normalizations }, readiness = requireTable(sections, "Intent and decisions", tables.readiness, failures, options), readinessByKey = new Map(readiness.rows.map((row) => [normalizedHeader(row["Readiness item"]), row]));
  for (let item of readinessItems) readinessByKey.has(normalizedHeader(item)) || failures.push(`Intent Readiness is missing ${item}`);
  readiness.rows.map((row) => normalizedHeader(row["Readiness item"])).join(`
`) !== readinessItems.map(normalizedHeader).join(`
`) && parsed.normalizations.push("normalized Intent Readiness row order");
  let openDecisions = readinessByKey.get(normalizedHeader("Material open decisions"));
  parsed.fields.status === "ready" && !noneLike(openDecisions?.Resolution) && failures.push("ready work-plan requires no material open decisions");
  let decisions = requireTable(sections, "Intent and decisions", tables.decisions, failures, { allowNone: !0, normalizations: parsed.normalizations }), decisionIds = exactIdSet(decisions.rows, "Decision ID", /DEC-[1-9][0-9]*/, "Decisions", failures), objectives = requireTable(sections, "Objectives", tables.objectives, failures, options), objectiveIds = exactIdSet(objectives.rows, "Objective ID", /OBJ-[1-9][0-9]*/, "Objectives", failures), baseline = requireTable(sections, "Evidence and baseline", tables.baseline, failures, options), kinds = new Set(baseline.rows.map((row) => row.Kind));
  kinds.has("repository") || failures.push("baseline requires repository evidence");
  for (let kind of kinds) baselineKinds.includes(kind) || parsed.normalizations.push(`baseline uses additional Kind ${kind}`);
  let scope = requireTable(sections, "Scope and targets", tables.scope, failures, options), categories = new Set(scope.rows.map((row) => row.Category));
  for (let category of requiredScopeCategories) categories.has(category) || failures.push(`scope is missing required category ${category}`);
  for (let category of categories) [...requiredScopeCategories, "incidental"].includes(category) || failures.push(`scope has unsupported category ${category}`);
  categories.has("incidental") || parsed.normalizations.push("Scope and targets: omitted incidental scope materialized as empty");
  let steps = requireTable(sections, "Execution steps", tables.steps, failures, options);
  exactIdSet(steps.rows, "Step ID", /STEP-[1-9][0-9]*/, "Execution steps", failures);
  let coveredObjectives = /* @__PURE__ */ new Set(), referencedChecks = /* @__PURE__ */ new Set();
  for (let row of steps.rows) {
    for (let objective of ids(row.Objectives, objectivePattern))
      coveredObjectives.add(objective), objectiveIds.has(objective) || failures.push(`Execution steps: unknown ${objective}`);
    let rowChecks = ids(row["Check IDs"], checkPattern);
    rowChecks.length === 0 && failures.push(`Execution steps: ${row["Step ID"]} has no Check ID`), rowChecks.forEach((check) => referencedChecks.add(check)), /PROBE-[1-9][0-9]*:/.test(row["Completion probe"]) || failures.push(`Execution steps: ${row["Step ID"]} needs a PROBE-N completion probe`);
  }
  sameSet(coveredObjectives, objectiveIds) || failures.push("Execution steps must cover every objective");
  let checks = requireTable(sections, "Verification", tables.verification, failures, options), classifiedChecks = tableRows(sections.get("Verification") ?? "", tables.verificationWithClass), classifications = new Map(classifiedChecks.map((row) => [row["Check ID"], row["Evidence Class"]])), checkIds = exactIdSet(checks.rows, "Check ID", /CHECK-[1-9][0-9]*/, "Verification", failures);
  for (let row of checks.rows) {
    let covered = ids(row.Objectives, objectivePattern);
    covered.length === 0 && failures.push(`Verification: ${row["Check ID"]} has no objective`), covered.forEach((objective) => {
      objectiveIds.has(objective) || failures.push(`Verification: unknown ${objective}`);
    }), /^(?:yes|no)$/.test(row.Required) || failures.push(`Verification: ${row["Check ID"]} Required must be yes|no`), /^(?:cheap|standard|expensive)$/.test(row["Cost Class"]) || failures.push(`Verification: ${row["Check ID"]} invalid Cost Class`), targetTokens(row.Prerequisites).length === 0 && failures.push(`Verification: ${row["Check ID"]} needs concrete Prerequisites`);
    let evidenceClass = classifications.get(row["Check ID"]);
    evidenceClass || failures.push(`Verification: ${row["Check ID"]} needs Evidence Class`), evidenceClass && !/^(?:machine-verifiable|human-review-required|human-approval-required)$/.test(evidenceClass) && failures.push(`Verification: ${row["Check ID"]} invalid Evidence Class`);
  }
  validateCostOrder(checks.rows, "Cost Class", "Verification", parsed);
  for (let check of referencedChecks) checkIds.has(check) || failures.push(`Execution steps reference unknown ${check}`);
  for (let objective of objectiveIds) checks.rows.some((row) => ids(row.Objectives, objectivePattern).includes(objective)) || failures.push(`${objective} has no verification Check`);
  for (let objective of objectiveIds) checks.rows.some((row) => row.Required === "yes" && ids(row.Objectives, objectivePattern).includes(objective)) || failures.push(`${objective} has no required verification Check`);
  let intentContent = sections.get("Intent and decisions") ?? "", scopeContent = sections.get("Scope and targets") ?? "", executionContent = sections.get("Execution steps") ?? "", productRequirements = tableRows(subsection(intentContent, "Product requirements"), tables.productRequirements), systemImpact = tableRows(subsection(scopeContent, "System architecture"), tables.systemImpact), programDesign = tableRows(subsection(scopeContent, "Program design"), tables.programDesign), slices = tableRows(subsection(executionContent, "Vertical slices"), tables.slices);
  ["compact", "full"].includes(parsed.fields.design_depth) && (systemImpact.length === 0 && failures.push(`${parsed.fields.design_depth} design requires a System architecture table`), slices.length === 0 && failures.push(`${parsed.fields.design_depth} design requires a Vertical slices table`)), parsed.fields.design_depth === "full" && (productRequirements.length === 0 && failures.push("full design requires a Product requirements table"), programDesign.length === 0 && failures.push("full design requires a Program design table"));
  let sliceIds = exactIdSet(slices, "Slice ID", /SLICE-[1-9][0-9]*/, "Vertical slices", failures);
  for (let row of slices) {
    let sliceObjectives = ids(row.Objectives, objectivePattern);
    sliceObjectives.length === 0 && failures.push(`Vertical slices: ${row["Slice ID"]} has no objective`);
    for (let objective of sliceObjectives) objectiveIds.has(objective) || failures.push(`Vertical slices: ${row["Slice ID"]} references unknown ${objective}`);
    for (let dependency of ids(row.Dependencies, slicePattern)) sliceIds.has(dependency) || failures.push(`Vertical slices: ${row["Slice ID"]} references unknown ${dependency}`);
    let sliceChecks = ids(row["Check IDs"], checkPattern);
    sliceChecks.length === 0 && failures.push(`Vertical slices: ${row["Slice ID"]} has no Check ID`);
    for (let check of sliceChecks) checkIds.has(check) || failures.push(`Vertical slices: ${row["Slice ID"]} references unknown ${check}`);
    /^(?:yes|no)$/.test(row["Human review"]) || failures.push(`Vertical slices: ${row["Slice ID"]} Human review must be yes|no`);
  }
  if (parsed.fields.automation_profile_max !== "manual") {
    let bounds = parsed.fields.automation_bounds;
    if (!bounds) failures.push(`${parsed.fields.automation_profile_max} plan requires automation_bounds`);
    else {
      let scopedTargets = scope.rows.filter((row) => ["required", "permitted"].includes(row.Category)).flatMap((row) => targetTokens(row.Targets));
      for (let target of bounds.allowed_targets ?? []) scopedTargets.some((scopeTarget) => targetMatches(target, scopeTarget)) || failures.push(`automation_bounds target ${target} is outside required/permitted scope`);
      (riskRank[bounds.max_risk] ?? 0) > (riskRank[parsed.fields.risk] ?? 0) && failures.push("automation_bounds max_risk cannot exceed root risk");
    }
  }
  let operational = requireTable(sections, "Operational readiness", tables.operational, failures, options), concerns = new Set(operational.rows.map((row) => row.Concern)), notApplicable = concerns.has("Not applicable");
  if (parsed.fields.runtime_relevant === !0) {
    notApplicable && failures.push("runtime-relevant work cannot use Not applicable operational readiness");
    for (let concern of ["Observable signal", "Failure condition", "Recovery or rollback"])
      concerns.has(concern) || failures.push(`Operational readiness: missing ${concern}`);
  } else (operational.rows.length !== 1 || operational.rows[0]?.Concern !== "Not applicable") && failures.push("non-runtime work requires exactly one Not applicable operational readiness row");
  let factors = requireTable(sections, "Risk and closeout", tables.assuranceFactors, failures, options), factorNames = new Set(factors.rows.map((row) => normalizedHeader(row.Factor)));
  for (let [factor] of assuranceFactors) factorNames.has(normalizedHeader(factor)) || failures.push(`Assurance factors are missing ${factor}`);
  factors.rows.map((row) => normalizedHeader(row.Factor)).join(`
`) !== assuranceFactors.map(([factor]) => normalizedHeader(factor)).join(`
`) && parsed.normalizations.push("normalized assurance factor order");
  let score = 0;
  for (let [factor, minimum, maximum] of assuranceFactors) {
    let raw = factors.rows.find((row) => normalizedHeader(row.Factor) === normalizedHeader(factor))?.Score, value = Number(raw);
    !Number.isInteger(value) || value < minimum || value > maximum ? failures.push(`Assurance factor ${factor} Score must be an integer ${minimum}..${maximum}`) : score += value;
  }
  score !== parsed.fields.assurance_score && failures.push(`assurance_score must equal computed score ${score}`);
  let triggers = parsed.fields.hard_triggers ?? [];
  for (let trigger of triggers) hardTriggers.has(trigger) || failures.push(`unknown hard trigger ${trigger}`);
  let derived = derivedAssurance(score, triggers), selectedRank = assuranceRank[parsed.fields.assurance_profile] ?? 0, derivedRank = assuranceRank[derived];
  if (parsed.fields.assurance_override === "none" && parsed.fields.assurance_profile !== derived && failures.push(`assurance_profile must equal derived profile ${derived} without override`), parsed.fields.assurance_override === "raised" && selectedRank <= derivedRank && failures.push("raised assurance override must select a higher profile than derived"), parsed.fields.assurance_override === "lowered") {
    triggers.length > 0 && failures.push("hard-trigger assurance cannot be lowered"), selectedRank >= derivedRank && failures.push("lowered assurance override must select a lower profile than derived");
    let decision = decisions.rows.find((row) => row["Decision ID"] === parsed.fields.assurance_override_decision_id);
    (!decisionIds.has(parsed.fields.assurance_override_decision_id) || !/\bHuman (?:decision|approval)\b/i.test(decision?.Source ?? "")) && failures.push("lowered assurance requires a human-sourced decision");
  }
  let controls = requireTable(sections, "Risk and closeout", tables.controls, failures, { allowNone: !0, normalizations: parsed.normalizations });
  exactIdSet(controls.rows, "Control ID", /CTRL-[1-9][0-9]*/, "Pareto controls", failures);
  for (let row of controls.rows)
    /^(?:cheap|standard|expensive)$/.test(row["Cost class"]) || failures.push(`Pareto controls: ${row["Control ID"]} invalid Cost class`), /^(?:include|defer)$/.test(row.Decision) || failures.push(`Pareto controls: ${row["Control ID"]} Decision must be include|defer`), triggers.filter((trigger) => row["Objective or failure mode"].includes(trigger)).length > 0 && row.Decision !== "include" && failures.push(`Pareto controls: hard-trigger control ${row["Control ID"]} cannot be deferred`);
  for (let trigger of triggers) controls.rows.some((row) => row["Objective or failure mode"].includes(trigger) && row.Decision === "include") || failures.push(`hard trigger ${trigger} requires an included Pareto control`);
  if (parsed.fields.status === "ready" && parsed.fields.intent_ready !== !0 && failures.push("ready work-plan requires intent_ready true"), parsed.wrapper) {
    let todos = parsed.wrapper.todos ?? [], stepIds = steps.rows.map((row) => row["Step ID"]);
    for (let stepId of stepIds) todos.some((todo) => String(todo.content).includes(stepId)) || failures.push(`native todos must project ${stepId}`);
    let final = String(todos.at(-1)?.content ?? "");
    /verify|check|evidence|snapshot/i.test(final) || failures.push("final native todo must verify or evidence the implemented result"), /\/correct-work/.test(final) && failures.push("initial native implementation must not require another Workflow command");
  }
}
function resultIdPattern(fields) {
  return String(fields.subject_id ?? "").startsWith("cp-") ? fixPattern : objectivePattern;
}
function validateEvidenceGrades(parsed, failures) {
  let entries = parsed.fields.check_evidence ?? [], grades = entries.map((entry) => entry.grade), patched = entries.filter((entry) => (entry.baseline_or_patched ?? (parsed.fields.evidence_mode === "lean" ? "patched" : null)) === "patched");
  grades.includes("failed") && parsed.fields.overall_grade !== "failed" && failures.push("failed check evidence requires overall_grade failed"), parsed.fields.status === "complete" && parsed.fields.overall_grade !== "verified" && failures.push("complete evidence requires overall_grade verified"), parsed.fields.status === "complete" && patched.some((entry) => entry.grade !== "verified") && failures.push("complete evidence requires every patched Check grade verified"), parsed.fields.status === "provisional" && !["supported", "partial", "unavailable"].includes(parsed.fields.overall_grade) && failures.push("provisional evidence requires supported, partial, or unavailable grade"), parsed.fields.status !== "blocked" && grades.includes("failed") && failures.push("failed check evidence must be blocked");
}
function validateLeanEvidence(parsed, sections, failures) {
  (sections.get("Summary") ?? "").trim() || failures.push("Summary: section must not be empty");
  let affected = new Set(parsed.fields.affected_objectives ?? []), reusedObjectives = new Set(parsed.fields.reused_objectives ?? []);
  for (let id of affected) reusedObjectives.has(id) && failures.push(`Objective ${id} cannot be both affected and reused`);
  let executed = new Set(parsed.fields.executed_checks ?? []), reusedChecks = new Set(parsed.fields.reused_checks ?? []);
  for (let id of executed) reusedChecks.has(id) && failures.push(`Check ${id} cannot be both executed and reused`);
  let checkIds = (parsed.fields.check_evidence ?? []).map((entry) => entry.check_id);
  new Set(checkIds).size !== checkIds.length && failures.push("check_evidence Check IDs must be unique"), sameSet(new Set(checkIds), executed) || failures.push("check_evidence must exactly match executed_checks");
  for (let path of parsed.fields.changed_paths ?? [])
    (path.startsWith("/") || path === ".." || path.startsWith("../")) && failures.push(`changed path must remain repository-relative: ${path}`);
  validateEvidenceGrades(parsed, failures), Object.hasOwn(parsed.fields, "strategy_revision") || parsed.normalizations.push("lean evidence: interpreted missing strategy_revision as 0");
  for (let entry of parsed.fields.check_evidence ?? [])
    Object.hasOwn(entry, "baseline_or_patched") || parsed.normalizations.push(`lean evidence: interpreted ${entry.check_id} baseline_or_patched as patched`);
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
  let options = { normalizations: parsed.normalizations }, pattern = resultIdPattern(parsed.fields), results = requireTable(sections, "Subject results", tables.results, failures, { optional: !0, normalizations: parsed.normalizations }), resultIds = exactIdSet(results.rows, "Objective ID", pattern, "Subject results", failures);
  for (let row of results.rows) /^(?:achieved|partially-achieved|not-achieved|blocked)$/.test(row.Result) || failures.push(`Subject results: ${row["Objective ID"]} invalid Result`);
  let outcomes = requireTable(sections, "Objective outcomes", tables.objectiveOutcomes, failures, options), outcomeIds = exactIdSet(outcomes.rows, "Objective ID", /OBJ-[1-9][0-9]*/, "Objective outcomes", failures);
  sameSet(outcomeIds, new Set(parsed.fields.affected_objectives ?? [])) || failures.push("Objective outcomes must exactly match affected_objectives");
  for (let row of outcomes.rows) /^(?:achieved|partially-achieved|not-achieved|blocked)$/.test(row.Status) || failures.push(`Objective outcomes: ${row["Objective ID"]} invalid Status`);
  let affected = new Set(parsed.fields.affected_objectives ?? []), reusedObjectives = new Set(parsed.fields.reused_objectives ?? []);
  for (let id of affected) reusedObjectives.has(id) && failures.push(`Objective ${id} cannot be both affected and reused`);
  let executed = new Set(parsed.fields.executed_checks ?? []), reusedChecks = new Set(parsed.fields.reused_checks ?? []);
  for (let id of executed) reusedChecks.has(id) && failures.push(`Check ${id} cannot be both executed and reused`);
  let changes = requireTable(sections, "Changes", tables.changes, failures, { allowNone: !0, optional: !0, normalizations: parsed.normalizations }), declaredChangedPaths = new Set(parsed.fields.changed_paths ?? []), visibleChangedPaths = new Set(changes.rows.flatMap((row) => targetTokens(row["Path or Symbol"])));
  parsed.fields.schema === 5 && !sameSet(declaredChangedPaths, visibleChangedPaths) && failures.push("Changes table must exactly match changed_paths");
  for (let path of declaredChangedPaths)
    (path.startsWith("/") || path === ".." || path.startsWith("../")) && failures.push(`changed path must remain repository-relative: ${path}`);
  for (let row of changes.rows) {
    let covered = ids(row["Objective Coverage"], pattern);
    covered.length === 0 && failures.push("Changes: every row must name a subject objective"), covered.forEach((id) => {
      (resultIds.size > 0 ? resultIds : outcomeIds).has(id) || failures.push(`Changes: unknown ${id}`);
    });
  }
  let snapshot = requireTable(sections, "Repository snapshot", tables.snapshot, failures, options), snapshotFingerprints = /* @__PURE__ */ new Map();
  if (snapshot.rows.length === 1) {
    let row = snapshot.rows[0];
    parsed.fields.snapshot_id = row["Snapshot ID"], snapshotFingerprints = fingerprintMap(row["Relevant fingerprints"]);
  }
  let checks = requireTable(sections, "Checks", tables.checks, failures, options), checkIds = exactIdSet(checks.rows, "Check ID", /CHECK-[1-9][0-9]*/, "Checks", failures);
  sameSet(checkIds, executed) || failures.push("Checks table must exactly match executed_checks");
  for (let row of checks.rows) {
    /^(?:passed|failed|blocked|skipped)$/.test(row.Status) || failures.push(`Checks: ${row["Check ID"]} invalid Status`);
    let prerequisites = fingerprintMap(row["Prerequisite fingerprints"]);
    for (let [path, hash] of prerequisites) snapshotFingerprints.get(path) !== hash && failures.push(`Checks: ${row["Check ID"]} prerequisite ${path} must match Repository snapshot`);
    row.Status === "blocked" && !/^blocked-by:CHECK-[1-9][0-9]*\b/.test(row["Observed Result"]) && failures.push(`Checks: ${row["Check ID"]} blocked status needs blocked-by:CHECK-N evidence`);
  }
  if (parsed.fields.schema >= 4) {
    let entries = parsed.fields.check_evidence ?? [], patched = new Map(entries.filter((entry) => entry.baseline_or_patched === "patched").map((entry) => [entry.check_id, entry]));
    for (let check of parsed.fields.executed_checks ?? []) patched.has(check) || failures.push(`check_evidence requires patched evidence for ${check}`);
    validateEvidenceGrades(parsed, failures);
  }
  let resume = requireTable(sections, "Idempotency and resume", tables.resume, failures, { optional: !0, normalizations: parsed.normalizations });
  exactIdSet(resume.rows, "Step ID", /STEP-[1-9][0-9]*/, "Idempotency and resume", failures);
  for (let row of resume.rows)
    /^(?:satisfied|pending|partial|conflicted)$/.test(row.State) || failures.push(`Idempotency and resume: ${row["Step ID"]} invalid State`), /PROBE-[1-9][0-9]*:/.test(row["Completion probe"]) || failures.push(`Idempotency and resume: ${row["Step ID"]} needs a PROBE-N completion probe`);
  let deviations = requireTable(sections, "Deviations", tables.deviations, failures, { allowNone: !0, optional: !0, normalizations: parsed.normalizations });
  for (let row of deviations.rows) /^DEV-[1-9][0-9]*$/.test(row["Deviation ID"]) || failures.push(`Deviations: invalid ${row["Deviation ID"]}`);
  parsed.fields.status === "complete" ? (results.rows.some((row) => row.Result === "blocked") && failures.push("complete evidence cannot contain blocked subject results"), checks.rows.some((row) => row.Status === "blocked") && failures.push("complete evidence cannot contain blocked Checks"), resume.rows.some((row) => ["pending", "partial", "conflicted"].includes(row.State)) && failures.push("complete evidence requires every step state satisfied")) : parsed.fields.status === "blocked" && !results.rows.some((row) => row.Result === "blocked") && !checks.rows.some((row) => row.Status === "blocked") && !/BLOCKER:\s*\S.{10,}/i.test(sections.get("Summary") ?? "") && failures.push("blocked evidence requires blocked work or a concrete BLOCKER reason");
  let operationalEvidence = (sections.get("Operational evidence") ?? "").trim();
  operationalEvidence && !/^not applicable\.?$/i.test(operationalEvidence) && requireTable(sections, "Operational evidence", tables.operationalEvidence, failures), /production (?:is|was) (?:healthy|successful|verified)/i.test(operationalEvidence) && failures.push("repository evidence must not claim observed production success");
}
function parseCorrection(parsed, sections, failures) {
  let content = sections.get("Correction plan") ?? "";
  if (parsed.fields.next_action !== "correct")
    return content.trim() && !noneLike(content) && failures.push("Correction plan is allowed only when next_action is correct"), null;
  let headings = [...maskFences(content).matchAll(/^### (cp-[^\r\n]+)$/gm)].map((match) => match[1]);
  headings.length !== 1 && failures.push("correct review must embed exactly one cp-* correction as an H3"), headings.length === 1 && parsed.fields.correction_id !== headings[0] && failures.push("embedded correction ID conflicts with frontmatter");
  let metadata = requireTable(/* @__PURE__ */ new Map([["Correction plan", content]]), "Correction plan", tables.correctionMeta, failures, { normalizations: parsed.normalizations }), fixes = { rows: tableRows(content, tables.fixes) }, steps = { rows: tableRows(content, tables.correctionSteps) }, checks = { rows: tableRows(content, tables.correctionChecks) };
  fixes.rows.length === 0 && failures.push("Correction plan requires a FIX table"), steps.rows.length === 0 && failures.push("Correction plan requires a step table"), checks.rows.length === 0 && failures.push("Correction plan requires a Check table");
  let declaredLearnings = Array.isArray(parsed.fields.learning_candidates) ? parsed.fields.learning_candidates : [], learnings = requireTable(/* @__PURE__ */ new Map([["Correction plan", content]]), "Correction plan", tables.learningCandidates, failures, { normalizations: parsed.normalizations }), learningIds = exactIdSet(learnings.rows, "Learning ID", learningPattern, "Correction learning", failures);
  sameSet(learningIds, new Set(declaredLearnings)) || failures.push("Correction learning table must exactly match learning_candidates");
  for (let row of learnings.rows) {
    let keys = String(row["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean);
    (keys.length === 0 || keys.some((key) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key))) && failures.push(`Learning ${row["Learning ID"]} needs valid source Finding keys`);
  }
  let fixIds = exactIdSet(fixes.rows, "FIX ID", /FIX-[1-9][0-9]*/, "Correction FIX", failures);
  exactIdSet(steps.rows, "Step ID", /STEP-[1-9][0-9]*/, "Correction steps", failures);
  let checkIds = exactIdSet(checks.rows, "Check ID", /CHECK-[1-9][0-9]*/, "Correction checks", failures);
  for (let row of fixes.rows) {
    let keys = String(row["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean);
    (keys.length === 0 || keys.some((key) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key))) && failures.push(`Correction ${row["FIX ID"]} needs valid source Finding keys`), ids(row["Root Objectives"], objectivePattern).length === 0 && failures.push(`Correction ${row["FIX ID"]} needs root objectives`), ids(row["Root Checks"], checkPattern).length === 0 && failures.push(`Correction ${row["FIX ID"]} needs root Checks`);
  }
  let coveredFixes = /* @__PURE__ */ new Set();
  for (let row of steps.rows)
    ids(row["FIX IDs"], fixPattern).forEach((id) => coveredFixes.add(id)), /PROBE-[1-9][0-9]*:/.test(row["Completion probe"]) || failures.push(`Correction ${row["Step ID"]} needs a PROBE-N completion probe`), ids(row["Check IDs"], checkPattern).forEach((id) => {
      checkIds.has(id) || failures.push(`Correction step references unknown ${id}`);
    });
  for (let fix of fixIds) coveredFixes.has(fix) || failures.push(`Correction steps do not cover ${fix}`);
  for (let row of checks.rows)
    /^(?:yes|no)$/.test(row.Required) || failures.push(`Correction check ${row["Check ID"]} Required must be yes|no`), /^(?:cheap|standard|expensive)$/.test(row["Cost Class"]) || failures.push(`Correction check ${row["Check ID"]} invalid Cost Class`), targetTokens(row.Prerequisites).length === 0 && failures.push(`Correction check ${row["Check ID"]} needs concrete Prerequisites`), ids(row["FIX IDs"], fixPattern).forEach((id) => {
      fixIds.has(id) || failures.push(`Correction check references unknown ${id}`);
    });
  return validateCostOrder(checks.rows, "Cost Class", "Correction checks", parsed), { id: headings[0], metadata: metadata.rows[0], fixes: fixes.rows, steps: steps.rows, checks: checks.rows, learnings: learnings.rows };
}
function validateCompactReview(parsed, sections, failures) {
  let options = { normalizations: parsed.normalizations };
  (sections.get("Assessment") ?? "").toLowerCase().includes(String(parsed.fields.assessment).toLowerCase()) || failures.push("Assessment section must state frontmatter assessment");
  let coverage = requireTable(sections, "Evidence coverage", tables.coverage, failures, { optional: !0, normalizations: parsed.normalizations }), coverageByKind = /* @__PURE__ */ new Map();
  for (let row of coverage.rows) {
    let kind = normalizedHeader(row.Kind), rows = coverageByKind.get(kind) ?? [];
    rows.push(row), coverageByKind.set(kind, rows);
  }
  let inspectedObjectives = new Set(parsed.fields.inspected_objectives ?? []), reusedObjectives = new Set(parsed.fields.reused_objectives ?? []), inspectedChecks = new Set(parsed.fields.inspected_checks ?? []), reusedChecks = new Set(parsed.fields.reused_checks ?? []);
  for (let id of inspectedObjectives) reusedObjectives.has(id) && failures.push(`Objective ${id} cannot be both inspected and reused`);
  for (let id of inspectedChecks) reusedChecks.has(id) && failures.push(`Check ${id} cannot be both inspected and reused`);
  let coverageLists = [
    ["Objectives", "Inspected", inspectedObjectives, objectivePattern],
    ["Objectives", "Reused", reusedObjectives, objectivePattern],
    ["Checks", "Inspected", inspectedChecks, checkPattern],
    ["Checks", "Reused", reusedChecks, checkPattern]
  ];
  for (let [kind, column, expected, pattern] of coverageLists) {
    let row = coverageByKind.get(normalizedHeader(kind))?.[0], visible = new Set(ids(row?.[column], pattern));
    sameSet(visible, expected) || parsed.normalizations.push(`Evidence coverage: ${kind} ${column.toLowerCase()} summary derived from frontmatter`);
  }
  let findingContent = sections.get("Findings") ?? "", findings = { rows: [], none: !0 };
  findingContent.trim() && (findings = requireTable(sections, "Findings", tables.findings, failures, { allowNone: !0, normalizations: parsed.normalizations }));
  let keys = /* @__PURE__ */ new Set();
  for (let row of findings.rows) {
    let key = row["Finding key"];
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) || failures.push(`Findings: invalid Finding key ${key}`), keys.has(key) && failures.push(`Findings: duplicate Finding key ${key}`), keys.add(key), /^(?:low|medium|high|critical)$/.test(row.Severity) || failures.push(`Findings: ${key} has invalid Severity`), ids(row.Objectives, objectivePattern).length === 0 && failures.push(`Findings: ${key} needs root Objectives`), ids(row.Checks, checkPattern).length === 0 && failures.push(`Findings: ${key} needs root Checks`);
  }
  parsed.fields.review_basis === "root-boundary" && findings.rows.length > 0 && failures.push("root-boundary review cannot contain delivery findings"), parsed.findings = findings.rows;
  let actualAuditors = new Set(parsed.fields.auditors_run ?? []), auditorRow = coverageByKind.get(normalizedHeader("Auditors"))?.[0], visibleAuditors = new Set(String(auditorRow?.Inspected ?? "").split(",").map((value) => value.trim()).filter((value) => value && !noneLike(value)));
  coverage.rows.length > 0 && !sameSet(visibleAuditors, actualAuditors) && parsed.normalizations.push("Evidence coverage: auditor summary derived from frontmatter");
  let routeRank = { inline: 1, targeted: 2, full: 3 }, decisiveBoundary = ["correct", "replan", "clarify"].includes(parsed.fields.next_action), unresolvedHighFinding = findings.rows.some((row) => /^(?:high|critical)$/.test(row.Severity)) && !decisiveBoundary, minimumRoute = actualAuditors.has("risk-auditor") || unresolvedHighFinding ? "full" : actualAuditors.has("delivery-auditor") || actualAuditors.has("work-design-auditor") ? "targeted" : "inline";
  routeRank[parsed.fields.review_route] < routeRank[minimumRoute] && failures.push(`review_route must be at least computed minimum ${minimumRoute}`);
  let missingAuditors = (parsed.fields.review_route === "inline" ? ["inline"] : parsed.fields.review_route === "full" ? ["inline", "delivery-auditor", "risk-auditor"] : ["inline"]).filter((auditor) => !actualAuditors.has(auditor));
  missingAuditors.forEach((auditor) => failures.push(`${parsed.fields.review_route} review requires auditor ${auditor}`));
  let targetedSpecialists = ["delivery-auditor", "work-design-auditor"].filter((auditor) => actualAuditors.has(auditor));
  if (parsed.fields.review_route === "inline" && actualAuditors.size !== 1 && failures.push("inline review permits only the inline auditor"), parsed.fields.review_route === "targeted" && (targetedSpecialists.length !== 1 || actualAuditors.size !== 2 || actualAuditors.has("risk-auditor")) && failures.push("targeted review requires inline plus exactly one delivery or design auditor"), parsed.fields.review_route === "full") {
    let permitted = /* @__PURE__ */ new Set(["inline", "delivery-auditor", "risk-auditor", "work-design-auditor"]);
    [...actualAuditors].some((auditor) => !permitted.has(auditor)) && failures.push("full review contains an unsupported auditor");
  }
  if ((sections.get("Next action") ?? "").toLowerCase().includes(String(parsed.fields.next_action).toLowerCase()) || failures.push("Next action section must state frontmatter next_action"), parsed.fields.assessment === "achieved") {
    parsed.fields.next_action !== "none" && failures.push("achieved review requires next_action none"), findings.rows.length > 0 && failures.push("achieved review cannot contain findings");
    let snapshotRow = coverageByKind.get(normalizedHeader("Snapshot"))?.[0];
    coverage.rows.length > 0 && (normalizedHeader(snapshotRow?.Result) !== "consistent" || noneLike(snapshotRow?.Inspected)) && failures.push("achieved review coverage contradicts current snapshot consistency");
  }
  parsed.fields.next_action === "none" && parsed.fields.assessment !== "achieved" && failures.push("next_action none requires assessment achieved"), parsed.fields.schema >= 4 && (parsed.fields.delivery_status === "verified" && parsed.fields.assessment !== "achieved" && failures.push("verified delivery requires achieved assessment"), parsed.fields.delivery_status === "provisional" && parsed.fields.next_action !== "accept-provisional" && failures.push("provisional delivery requires accept-provisional"), parsed.fields.next_action === "accept-provisional" && parsed.fields.delivery_status !== "provisional" && failures.push("accept-provisional requires provisional delivery")), parsed.fields.next_action === "correct" && findings.rows.length === 0 && failures.push("correct review requires findings"), parsed.fields.next_action !== "correct" && Array.isArray(parsed.fields.learning_candidates) && failures.push("learning_candidates are allowed only when next_action is correct"), parsed.fields.next_action === "retry-review" && parsed.fields.assessment !== "insufficient-evidence" && failures.push("retry-review requires assessment insufficient-evidence");
  let correction = parseCorrection(parsed, sections, failures);
  if (correction) {
    for (let fix of correction.fixes) {
      let referenced = String(fix["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean);
      for (let key of referenced) keys.has(key) || failures.push(`Correction ${fix["FIX ID"]} references unknown Finding key ${key}`);
    }
    for (let learning of correction.learnings) {
      let referenced = String(learning["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean);
      for (let key of referenced) keys.has(key) || failures.push(`Learning ${learning["Learning ID"]} references unknown Finding key ${key}`);
    }
  }
  return parsed.effective = {
    plannedAssurance: null,
    assuranceUsed: parsed.fields.review_route === "full" ? "deep" : parsed.fields.review_route === "targeted" ? "standard" : null,
    inspectedObjectives: [...inspectedObjectives],
    reusedObjectives: [...reusedObjectives],
    inspectedChecks: [...inspectedChecks],
    reusedChecks: [...reusedChecks],
    auditorsRun: [...actualAuditors],
    missingAuditors,
    findings: findings.rows
  }, correction;
}
function buildArtifact(text, root, options = {}) {
  let failures = [], diagnostics = [], normalizations = [], parsed = parseArtifact(text, failures, normalizations);
  if (!parsed) return { failures, diagnostics, normalizations, parsed: null };
  parsed.normalizations = normalizations;
  let schema = validateArtifactSchema(root, parsed, failures);
  if (!schema) return { failures, diagnostics, normalizations, parsed };
  let requiredSections = schema["x-required-sections"] ?? schema["x-markdown-sections"] ?? [], sections = sectionMap(trimTrailingNotes(parsed.body, requiredSections, normalizations), requiredSections, failures, normalizations);
  return parsed.sections = sections, sections.size > 0 && (rejectPlaceholders(parsed, schema, sections, failures), parsed.fields.artifact === "work-plan" && (parsed.fields.schema >= 4 ? validatePlanV4(parsed, sections, failures) : validatePlan(parsed, sections, failures)), parsed.fields.artifact === "delivery-evidence" && validateEvidence(parsed, sections, failures), parsed.fields.artifact === "work-review" && (parsed.correction = validateCompactReview(parsed, sections, failures))), { failures: unique(failures), diagnostics: unique(diagnostics), normalizations: unique(normalizations), parsed };
}
function inspectArtifactText(text, root = defaultRoot, options = {}) {
  let built = buildArtifact(text, root, options);
  return {
    errors: built.failures,
    diagnostics: built.diagnostics,
    normalizations: built.normalizations,
    effective: built.parsed?.effective ?? null,
    artifact: built.parsed ?? null
  };
}
function preflightRootPlan(text, root = defaultRoot) {
  let inspected = inspectArtifactText(text, root), parsed = inspected.artifact;
  if (inspected.errors.length > 0 || parsed?.fields?.artifact !== "work-plan" || parsed.fields.schema !== 5)
    return {
      feasible: !1,
      root_plan_id: parsed?.fields?.id ?? null,
      root_projection_hash: null,
      blocking_issues: (inspected.errors.length > 0 ? inspected.errors : ["input must be one Schema-5 work-plan"]).map((message) => issue("invalid-root", message)),
      advisories: [],
      required_checks: [],
      deferred_checks: [],
      cost_classes: { cheap: 0, standard: 0, expensive: 0 },
      approval_granted: !1,
      mutation_performed: !1
    };
  let blocking = [], advisories = [], authority = parsed.fields.authority ?? {}, denied = [
    ...(authority.protected_paths ?? []).map((path) => ({ kind: "protected", path })),
    ...(authority.approval_required_paths ?? []).map((path) => ({ kind: "approval-required", path }))
  ];
  for (let allowed of authority.allowed_roots ?? []) {
    let shadow = denied.find((entry) => targetMatches(allowed, entry.path));
    shadow && blocking.push(issue(
      "shadowed-allowed-root",
      `allowed root ${allowed} is fully shadowed by ${shadow.kind} path ${shadow.path}`,
      { target: allowed, boundary: shadow.path, boundary_kind: shadow.kind }
    ));
  }
  for (let target of acceptanceChangeTargets(parsed)) {
    let state = authorityTargetState(target, authority);
    (!state.allowed || state.protected || state.approval_required) && blocking.push(issue(
      "acceptance-path-outside-authority",
      `Acceptance requires changing ${target}, but the current Root does not authorize that target`,
      { target, ...state }
    ));
  }
  let rows = tableRows(verificationSectionContent(parsed), tables.verificationWithClass), objectiveIds = new Set((parsed.fields.acceptance ?? []).map((_, index) => `OBJ-${index + 1}`)), requiredChecks = [], deferredChecks = [], costs = { cheap: 0, standard: 0, expensive: 0 };
  if (rows.length === 0)
    blocking.push(issue("explicit-verification-required", "new Schema-5 roots require an explicit Verification table for Pareto check selection"));
  else {
    let seenIds = /* @__PURE__ */ new Set(), signatures = /* @__PURE__ */ new Map(), requiredObjectives = /* @__PURE__ */ new Set(), classifiedChecks = [];
    for (let row of rows) {
      let checkId = row["Check ID"];
      /^CHECK-[1-9][0-9]*$/.test(checkId) ? seenIds.has(checkId) ? blocking.push(issue("duplicate-check-id", `Verification repeats ${checkId}`, { check_id: checkId })) : seenIds.add(checkId) : blocking.push(issue("invalid-check-id", `Verification has invalid Check ID ${checkId || "<missing>"}`));
      let boundObjectives = ids(row.Objectives, objectivePattern);
      if ((boundObjectives.length === 0 || boundObjectives.some((id) => !objectiveIds.has(id))) && blocking.push(issue(
        "invalid-check-objectives",
        `${checkId || "Verification Check"} must reference only current Acceptance objectives`,
        { check_id: checkId || null, objectives: boundObjectives }
      )), /^(?:yes|no)$/.test(row.Required) || blocking.push(issue("invalid-required-value", `${checkId || "Verification Check"} Required must be yes or no`, { check_id: checkId || null })), /^(?:machine-verifiable|human-review-required|human-approval-required)$/.test(row["Evidence Class"]) || blocking.push(issue("invalid-evidence-class", `${checkId || "Verification Check"} has an invalid Evidence Class`, { check_id: checkId || null })), /^(?:cheap|standard|expensive)$/.test(row["Cost Class"]) ? costs[row["Cost Class"]] += 1 : blocking.push(issue("invalid-cost-class", `${checkId || "Verification Check"} has an invalid Cost Class`, { check_id: checkId || null })), row.Required === "yes") {
        requiredChecks.push(checkId), boundObjectives.forEach((id) => requiredObjectives.add(id));
        let signature = [boundObjectives.sort().join(","), row["Command or Inspection"], row["Expected Result"], targetTokens(row.Prerequisites).sort().join(",")].map((value) => normalizedHeader(value)).join("|");
        classifiedChecks.push({ check_id: checkId, required: !0, cost: row["Cost Class"], signature });
        let prior = signatures.get(signature);
        prior ? blocking.push(issue("duplicate-required-check", `${checkId} duplicates required Check ${prior}`, { check_id: checkId, duplicate_of: prior })) : signatures.set(signature, checkId), row["Cost Class"] === "expensive" && parsed.fields.risk !== "high" && (parsed.fields.hard_triggers ?? []).length === 0 && advisories.push(issue(
          "expensive-required-check",
          `${checkId} is expensive and required; retain it only when no cheaper equivalent proves the same essential outcome`,
          { check_id: checkId }
        ));
      } else row.Required === "no" && (deferredChecks.push(checkId), classifiedChecks.push({
        check_id: checkId,
        required: !1,
        cost: row["Cost Class"],
        signature: [boundObjectives.sort().join(","), row["Command or Inspection"], row["Expected Result"], targetTokens(row.Prerequisites).sort().join(",")].map((value) => normalizedHeader(value)).join("|")
      }));
    }
    for (let check of classifiedChecks.filter((entry) => entry.required && entry.cost === "expensive")) {
      let cheaper = classifiedChecks.find((entry) => entry.check_id !== check.check_id && entry.signature === check.signature && entry.cost !== "expensive");
      cheaper && blocking.push(issue(
        "expensive-required-equivalent",
        `${check.check_id} is required despite cheaper equivalent ${cheaper.check_id}`,
        { check_id: check.check_id, cheaper_check_id: cheaper.check_id }
      ));
    }
    for (let objective of objectiveIds) requiredObjectives.has(objective) || blocking.push(issue(
      "missing-required-check",
      `${objective} needs at least one required falsifiable Check`,
      { objective_id: objective }
    ));
  }
  let projection = authoritativeArtifactProjectionFromText(text, root);
  return {
    feasible: blocking.length === 0,
    root_plan_id: parsed.fields.id,
    root_projection_hash: projection.projection_hash ?? null,
    blocking_issues: blocking,
    advisories,
    required_checks: requiredChecks.filter(Boolean),
    deferred_checks: deferredChecks.filter(Boolean),
    cost_classes: costs,
    approval_granted: !1,
    mutation_performed: !1
  };
}
function authoritativeArtifactProjection(artifact, root) {
  let schema = JSON.parse(readFileSync2(schemaFor(root, artifact.fields.artifact), "utf8")), fields = Object.fromEntries(Object.keys(schema.properties ?? {}).filter((key) => key !== "extensions" && Object.hasOwn(artifact.fields, key)).map((key) => [key, structuredClone(artifact.fields[key])])), sections = (schema["x-required-sections"] ?? schema["x-markdown-sections"] ?? []).map((name) => ({ name, content: artifact.sections.get(name) ?? "" })), projection = stableValue({ fields, sections }), projectionText = JSON.stringify(projection, null, 2);
  return {
    errors: [],
    projection,
    projection_text: projectionText,
    projection_hash: sha256(projectionText)
  };
}
function authoritativeArtifactProjectionFromText(text, root = defaultRoot) {
  let inspected = inspectArtifactText(text, root);
  return inspected.errors.length > 0 || !inspected.artifact?.fields?.artifact ? { errors: inspected.errors.length > 0 ? inspected.errors : ["input is not a Workflow artifact"] } : authoritativeArtifactProjection(inspected.artifact, root);
}
function executionContractFromArtifactText(text, root = defaultRoot) {
  let inspected = inspectArtifactText(text, root);
  if (inspected.errors.length > 0 || inspected.artifact?.fields.artifact !== "work-plan")
    return { errors: inspected.errors.length > 0 ? inspected.errors : ["input is not a work-plan"] };
  let artifact = inspected.artifact, data = planData(artifact), authoritative = authoritativeArtifactProjectionFromText(text, root);
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
  let a = new Set(left ?? []), b = new Set(right ?? []);
  for (let value of a) b.has(value) && failures.push(`${label}: ${value} appears in both fresh and reused coverage`);
  sameSet(setUnion(a, b), new Set(expected)) || failures.push(`${label}: fresh and reused coverage must exactly partition the root set`);
}
function compareReusePaths(paths, current, predecessor, basis, label, requiresStrong, failures) {
  for (let path of paths) {
    let currentHash = current.get(path), previousHash = predecessor.get(path);
    if (currentHash && previousHash && currentHash === previousHash) continue;
    let inspectedUnchanged = String(basis ?? "").includes(path) && /(?:inspected|unchanged|no relevant change)/i.test(String(basis));
    !requiresStrong && inspectedUnchanged || (currentHash && previousHash && currentHash !== previousHash ? failures.push(`${label}: changed fingerprint for ${path} invalidates reuse`) : failures.push(`${label}: reuse lacks ${requiresStrong ? "strong fingerprint" : "fingerprint or current change-impact inspection"} evidence for ${path}`));
  }
}
function correctionForId(artifacts, id) {
  return [...artifacts.values()].find((artifact) => artifact.fields.artifact === "work-review" && artifact.fields.correction_id === id)?.correction ?? null;
}
function materializeEvidence(artifact, artifacts, cache, failures, rootDirectory, active = /* @__PURE__ */ new Set()) {
  if (cache.has(artifact.fields.id)) return cache.get(artifact.fields.id);
  if (active.has(artifact.fields.id))
    return failures.push(`${artifact.label}: cyclic evidence chain`), null;
  active.add(artifact.fields.id);
  let root = artifacts.get(artifact.fields.root_plan_id);
  if (!root || root.fields.artifact !== "work-plan")
    return failures.push(`${artifact.label}: missing root plan ${artifact.fields.root_plan_id}`), null;
  if (root.fields.schema === 5) {
    let authoritativeRoot = authoritativeArtifactProjection(root, rootDirectory);
    artifact.fields.intent_hash !== authoritativeRoot.projection_hash && failures.push(`${artifact.label}: intent_hash does not match authoritative Root projection`);
  }
  let plan = planData(root), data = evidenceData(artifact), leanMode = artifact.fields.schema === 5 && artifact.fields.evidence_mode === "lean";
  root.fields.schema === 5 && (root.fields.profile_max !== "manual" || root.fields.risk === "high" || (root.fields.hard_triggers ?? []).length > 0) && leanMode && failures.push(`${artifact.label}: ${root.fields.profile_max} ${root.fields.risk}-risk root requires evidence_mode full`);
  let currentFingerprints = fingerprintMap(data.snapshot?.["Relevant fingerprints"]), reuseBasis = data.snapshot?.["Relevant fingerprints"] ?? "", strongReuse = root.fields.schema >= 4 ? root.fields.contract_level === "certified" || (root.fields.hard_triggers ?? []).length > 0 : root.fields.assurance_profile === "deep" || (root.fields.hard_triggers ?? []).length > 0, predecessor = artifact.fields.predecessor_evidence_id ? artifacts.get(artifact.fields.predecessor_evidence_id) : null, predecessorEffective = predecessor?.fields.artifact === "delivery-evidence" ? materializeEvidence(predecessor, artifacts, cache, failures, rootDirectory, active) : null;
  artifact.fields.predecessor_evidence_id && !predecessorEffective && failures.push(`${artifact.label}: missing predecessor evidence ${artifact.fields.predecessor_evidence_id}`), predecessor && predecessor.fields.root_plan_id !== artifact.fields.root_plan_id && failures.push(`${artifact.label}: predecessor evidence must use the same root plan`);
  let affected = new Set(artifact.fields.affected_objectives ?? []), reusedObjectives = new Set(artifact.fields.reused_objectives ?? []), executed = new Set(artifact.fields.executed_checks ?? []), reusedChecks = new Set(artifact.fields.reused_checks ?? []);
  disjointCoverage(affected, reusedObjectives, plan.objectives, `${artifact.label}: objective`, failures), disjointCoverage([...executed].filter((id) => plan.requiredChecks.has(id)), reusedChecks, plan.requiredChecks, `${artifact.label}: root Check`, failures);
  let initial = artifact.fields.subject_id === root.fields.id;
  initial && artifact.fields.representation !== "full" && failures.push(`${artifact.label}: initial evidence must use full representation`), !initial && !predecessorEffective && failures.push(`${artifact.label}: correction evidence requires direct predecessor evidence`), artifact.fields.representation === "full" && (reusedObjectives.size > 0 || reusedChecks.size > 0) && failures.push(`${artifact.label}: full representation cannot declare reused root state`);
  let objectives = /* @__PURE__ */ new Map();
  for (let objective of affected) {
    let row = data.outcomeRows.get(objective);
    row ? objectives.set(objective, { status: row.Status, evidence: row.Evidence, source: artifact.fields.id }) : failures.push(`${artifact.label}: affected ${objective} lacks an Objective outcomes row`);
  }
  for (let objective of reusedObjectives) {
    let previous = predecessorEffective?.objectives.get(objective);
    previous ? (leanMode || compareReusePaths(plan.objectiveDependencies.get(objective) ?? [], currentFingerprints, predecessorEffective.snapshotFingerprints, reuseBasis, `${artifact.label}: reused ${objective}`, strongReuse, failures), objectives.set(objective, { ...previous, reusedFrom: predecessor.fields.id })) : failures.push(`${artifact.label}: reused ${objective} is absent from direct predecessor evidence`);
  }
  let checks = /* @__PURE__ */ new Map();
  for (let id of executed) {
    let row = data.checkRows.get(id);
    if (!row) {
      failures.push(`${artifact.label}: executed ${id} lacks a Checks row`);
      continue;
    }
    if (!(plan.checkRows.get(id) ?? correctionForId(artifacts, artifact.fields.subject_id)?.checks.find((candidate) => candidate["Check ID"] === id))) failures.push(`${artifact.label}: executed unknown ${id}`);
    else {
      let prerequisiteFingerprints = fingerprintMap(row["Prerequisite fingerprints"]);
      for (let [prerequisite, hash] of prerequisiteFingerprints) currentFingerprints.get(prerequisite) !== hash && failures.push(`${artifact.label}: ${id} fingerprint ${prerequisite} is not current`);
    }
    checks.set(id, { status: row.Status, observed: row["Observed Result"], fingerprints: row["Prerequisite fingerprints"], source: artifact.fields.id });
  }
  for (let id of reusedChecks) {
    let previous = predecessorEffective?.checks.get(id), planned = plan.checkRows.get(id);
    !previous || !planned ? failures.push(`${artifact.label}: reused ${id} is absent from direct predecessor root evidence`) : (leanMode || compareReusePaths(targetTokens(planned.Prerequisites), currentFingerprints, predecessorEffective.snapshotFingerprints, reuseBasis, `${artifact.label}: reused ${id}`, strongReuse, failures), checks.set(id, { ...previous, reusedFrom: predecessor.fields.id }));
  }
  for (let change of data.changes) for (let target of targetTokens(change["Path or Symbol"])) {
    let allowed = plan.allowedTargets.some((scope) => targetMatches(target, scope)), prohibited = plan.prohibitedTargets.filter((scope) => !/^all other (?:files|paths|targets)$/i.test(scope)).some((scope) => targetMatches(target, scope));
    (!allowed || prohibited) && failures.push(`${artifact.label}: changed target ${target} is outside root scope`);
  }
  let operationalContent = (artifact.sections.get("Operational evidence") ?? "").trim(), operationalReady = !0;
  if (root.fields.schema >= 4) {
    if (operationalContent && !/^not applicable\.?$/i.test(operationalContent)) {
      let operationalRows = tableRows(operationalContent, tables.operationalEvidence);
      operationalReady = operationalRows.length > 0 && operationalRows.every((row) => row.Status === "satisfied");
    }
  } else if (root.fields.runtime_relevant === !0) {
    let operationalRows = tableRows(operationalContent, tables.operationalEvidence), byConcern = new Map(operationalRows.map((row) => [normalizedHeader(row.Concern), row]));
    for (let concern of ["Observable signal", "Failure condition", "Recovery or rollback"]) {
      let row = byConcern.get(normalizedHeader(concern));
      row || failures.push(`${artifact.label}: runtime operational evidence is missing ${concern}`), row && !/^(?:satisfied|unsatisfied|blocked)$/.test(row.Status) && failures.push(`${artifact.label}: runtime operational evidence ${concern} has invalid Status`), row?.Status !== "satisfied" && (operationalReady = !1);
    }
    artifact.fields.status === "complete" && !operationalReady && failures.push(`${artifact.label}: complete runtime evidence requires satisfied operational proof`);
  } else operationalContent && !/^not applicable\.?$/i.test(operationalContent) && (failures.push(`${artifact.label}: non-runtime operational evidence must be omitted or Not applicable.`), operationalReady = !1);
  if (initial) {
    let delivered = data.results.length > 0 ? new Set(data.results.map((row) => row["Objective ID"])) : new Set(data.outcomes.map((row) => row["Objective ID"]));
    sameSet(delivered, plan.objectives) || failures.push(`${artifact.label}: initial evidence must cover every root objective`), (artifact.fields.source_review_id || artifact.fields.predecessor_evidence_id) && failures.push(`${artifact.label}: initial evidence cannot reference review or predecessor evidence`);
  } else {
    let sourceReview = artifacts.get(artifact.fields.source_review_id), correction = correctionForId(artifacts, artifact.fields.subject_id);
    if (!sourceReview || sourceReview.fields.correction_id !== artifact.fields.subject_id || !correction) failures.push(`${artifact.label}: correction evidence does not resolve its source review and correction`);
    else {
      let expectedFixes = new Set(correction.fixes.map((row) => row["FIX ID"]));
      !leanMode && !sameSet(new Set(data.results.map((row) => row["Objective ID"])), expectedFixes) && failures.push(`${artifact.label}: correction Subject results must cover every FIX`);
      for (let check of correction.checks.filter((row) => row.Required === "yes")) executed.has(check["Check ID"]) || failures.push(`${artifact.label}: missing executed correction Check ${check["Check ID"]}`);
    }
  }
  let reviewReady = artifact.fields.status === "complete" && (artifact.fields.schema < 4 || artifact.fields.overall_grade === "verified") && operationalReady && [...plan.requiredChecks].every((id) => checks.get(id)?.status === "passed"), effective = { root, plan, objectives, checks, snapshot: data.snapshot, snapshotFingerprints: currentFingerprints, operationalReady, reviewReady, predecessor: predecessorEffective };
  return artifact.effective = effective, cache.set(artifact.fields.id, effective), active.delete(artifact.fields.id), effective;
}
function validateCompactCorrection(review, root, evidence, artifacts, failures) {
  let correction = review.correction;
  if (!correction) return;
  let metadata = correction.metadata ?? {};
  metadata["Correction ID"] !== review.fields.correction_id && failures.push(`${review.label}: correction metadata ID mismatch`), metadata["Root Plan"] !== root.fields.id && failures.push(`${review.label}: correction root mismatch`), metadata["Source Review"] !== review.fields.id && failures.push(`${review.label}: correction source review mismatch`), metadata["Base Evidence"] !== evidence.fields.id && failures.push(`${review.label}: correction base evidence mismatch`), (riskRank[metadata.Risk] ?? 99) > (riskRank[root.fields.risk] ?? 0) && failures.push(`${review.label}: correction raises root risk and requires replan`);
  let plan = planData(root), findingKeys = new Set(reviewData(review).findings.map((row) => row["Finding key"]));
  for (let fix of correction.fixes) {
    for (let key of String(fix["Finding keys"]).split(",").map((value) => value.trim()).filter(Boolean)) findingKeys.has(key) || failures.push(`${review.label}: correction references unknown Finding key ${key}`);
    for (let objective of ids(fix["Root Objectives"], objectivePattern)) plan.objectives.has(objective) || failures.push(`${review.label}: correction references unknown root ${objective}`);
    for (let check of ids(fix["Root Checks"], checkPattern)) plan.checks.has(check) || failures.push(`${review.label}: correction references unknown root ${check}`);
  }
  for (let step of correction.steps) for (let target of targetTokens(step.Targets)) {
    let allowed = plan.allowedTargets.some((scope) => targetMatches(target, scope)), prohibited = plan.prohibitedTargets.filter((scope) => !/^all other (?:files|paths|targets)$/i.test(scope)).some((scope) => targetMatches(target, scope));
    (!allowed || prohibited) && failures.push(`${review.label}: correction target ${target} is outside root scope`);
  }
}
function progressState(review, artifacts) {
  let effective = artifacts.get(review.fields.latest_evidence_id)?.effective, findings = reviewData(review).findings;
  return new Map(findings.map((finding) => {
    let objectives = ids(finding.Objectives, objectivePattern), checks = ids(finding.Checks, checkPattern), objectiveRank = objectives.reduce((sum, id) => sum + ({ blocked: 0, "not-achieved": 1, "partially-achieved": 2, achieved: 3 }[effective?.objectives.get(id)?.status] ?? 0), 0), passedChecks = checks.filter((id) => effective?.checks.get(id)?.status === "passed").length, fingerprintSignature = objectives.flatMap((id) => [...effective?.plan.objectiveDependencies.get(id) ?? []]).sort().map((path) => `${path}=${effective?.snapshotFingerprints.get(path) ?? "missing"}`).join(";");
    return [finding["Finding key"], { severity: { critical: 4, high: 3, medium: 2, low: 1 }[finding.Severity] ?? 9, objectiveRank, passedChecks, fingerprintSignature }];
  }));
}
function measurableProgress(previous, current) {
  return !previous || !current ? !1 : current.severity < previous.severity || current.objectiveRank > previous.objectiveRank || current.passedChecks > previous.passedChecks || current.fingerprintSignature !== previous.fingerprintSignature;
}
function validatePlanLineage(artifacts, failures) {
  let plans = [...artifacts.values()].filter((artifact) => artifact.fields.artifact === "work-plan"), plansById = new Map(plans.map((plan) => [plan.fields.id, plan])), successors = /* @__PURE__ */ new Map();
  for (let plan of plans) {
    let predecessorId = plan.fields.predecessor_plan_id, sourceReviewId = plan.fields.replan_source_review_id;
    if (!predecessorId && !sourceReviewId || !predecessorId || !sourceReviewId) continue;
    predecessorId === plan.fields.id && failures.push(`${plan.label}: replan root cannot reference itself`);
    let predecessor = plansById.get(predecessorId);
    predecessor ? predecessor.fields.schema !== 5 && failures.push(`${plan.label}: predecessor plan must use Schema 5`) : failures.push(`${plan.label}: missing predecessor plan ${predecessorId}`);
    let sourceReview = artifacts.get(sourceReviewId);
    if (!sourceReview || sourceReview.fields.artifact !== "work-review") failures.push(`${plan.label}: missing replan source review ${sourceReviewId}`);
    else {
      sourceReview.fields.schema !== 5 && failures.push(`${plan.label}: replan source review must use Schema 5`), sourceReview.fields.root_plan_id !== predecessorId && failures.push(`${plan.label}: replan source review must belong to predecessor plan ${predecessorId}`), sourceReview.fields.next_action !== "replan" && failures.push(`${plan.label}: replan source review must require next_action replan`);
      let predecessorReviews = [...artifacts.values()].filter((artifact) => artifact.fields.artifact === "work-review" && artifact.fields.root_plan_id === predecessorId), referencedReviews = new Set(predecessorReviews.map((review) => review.fields.predecessor_review_id).filter(Boolean)), reviewTips = predecessorReviews.filter((review) => !referencedReviews.has(review.fields.id));
      (reviewTips.length !== 1 || reviewTips[0].fields.id !== sourceReviewId) && failures.push(`${plan.label}: replan source review must be the unique current predecessor review tip`);
    }
    let list = successors.get(predecessorId) ?? [];
    list.push(plan), successors.set(predecessorId, list);
  }
  for (let [predecessorId, list] of successors) list.length > 1 && failures.push(`work-plan lineage branches after ${predecessorId}`);
  let visiting = /* @__PURE__ */ new Set(), visited = /* @__PURE__ */ new Set(), visit = (plan) => {
    if (visited.has(plan.fields.id)) return;
    if (visiting.has(plan.fields.id)) {
      failures.push(`work-plan lineage is cyclic at ${plan.fields.id}`);
      return;
    }
    visiting.add(plan.fields.id);
    let predecessor = plansById.get(plan.fields.predecessor_plan_id);
    predecessor && visit(predecessor), visiting.delete(plan.fields.id), visited.add(plan.fields.id);
  };
  plans.forEach(visit);
  let referencedPlans = new Set(plans.map((plan) => plan.fields.predecessor_plan_id).filter(Boolean));
  return plans.filter((plan) => !referencedPlans.has(plan.fields.id)).map((plan) => plan.fields.id).sort();
}
function inspectCompactArtifactSet(entries, root = defaultRoot, options = {}) {
  let errors = [], diagnostics = [], normalizations = [], artifacts = /* @__PURE__ */ new Map();
  for (let [label, text] of entries) {
    let probe = parseArtifact(text, [], []), type = probe?.fields.artifact;
    if (type && !knownArtifacts.has(type) && !existsSync2(schemaFor(root, type))) {
      (/^(?:work|delivery)-/.test(type) || /^(?:wp|de|wr|cp|rs)-/.test(String(probe?.fields.id ?? ""))) && errors.push(`${label}: unsupported workflow artifact type`);
      continue;
    }
    let built = buildArtifact(text, root, { deferReferences: !0 });
    built.failures.forEach((failure) => errors.push(`${label}: ${failure}`)), built.diagnostics.forEach((item) => diagnostics.push(`${label}: ${item}`)), built.normalizations.forEach((item) => normalizations.push(`${label}: ${item}`)), !(built.failures.length > 0 || !built.parsed?.fields.id) && (artifacts.has(built.parsed.fields.id) && errors.push(`${label}: duplicate artifact ID ${built.parsed.fields.id}`), artifacts.set(built.parsed.fields.id, { label, text, ...built.parsed }));
  }
  let rootTips = validatePlanLineage(artifacts, errors), evidenceCache = /* @__PURE__ */ new Map(), evidenceByRoot = /* @__PURE__ */ new Map(), orderedEvidenceByRoot = /* @__PURE__ */ new Map(), reviewsByRoot = /* @__PURE__ */ new Map();
  for (let artifact of artifacts.values()) {
    if (artifact.fields.artifact === "delivery-evidence") {
      materializeEvidence(artifact, artifacts, evidenceCache, errors, root);
      let list = evidenceByRoot.get(artifact.fields.root_plan_id) ?? [];
      list.push(artifact), evidenceByRoot.set(artifact.fields.root_plan_id, list);
    }
    if (artifact.fields.artifact === "work-review") {
      let list = reviewsByRoot.get(artifact.fields.root_plan_id) ?? [];
      list.push(artifact), reviewsByRoot.set(artifact.fields.root_plan_id, list);
    }
  }
  for (let [rootId, evidence] of evidenceByRoot)
    evidence.filter((item) => item.fields.subject_id === rootId).length !== 1 && errors.push(`${rootId}: evidence chain requires exactly one initial root delivery`), orderedEvidenceByRoot.set(rootId, linearChain(evidence, "predecessor_evidence_id", `${rootId}: evidence`, errors));
  for (let [rootId, reviews] of reviewsByRoot) {
    let rootPlan = artifacts.get(rootId);
    if (!rootPlan || rootPlan.fields.artifact !== "work-plan") {
      errors.push(`${rootId}: reviews require a root plan`);
      continue;
    }
    let plan = planData(rootPlan), ordered = linearChain(reviews, "predecessor_review_id", `${rootId}: review`, errors), learningOwners = /* @__PURE__ */ new Map();
    for (let review of ordered) for (let learning of review.correction?.learnings ?? []) {
      let id = learning["Learning ID"];
      learningOwners.has(id) ? errors.push(`${review.label}: learning candidate ${id} duplicates ${learningOwners.get(id)} within root ${rootId}`) : learningOwners.set(id, review.label);
    }
    let reviewIndex = new Map(ordered.map((review, index) => [review.fields.id, index])), rootEvidence = orderedEvidenceByRoot.get(rootId) ?? [];
    for (let index = 0; index < ordered.length; index += 1) {
      let review = ordered[index];
      if (review.fields.review_basis === "root-boundary") {
        let receipt = review.fields.boundary_receipt ?? {};
        receipt.root_content_hash !== sha256(rootPlan.text) && errors.push(`${review.label}: boundary receipt root_content_hash does not match exact Root bytes`);
        for (let path of receipt.observed_paths ?? [])
          (path.startsWith("/") || path === ".." || path.startsWith("../") || path.includes("\\")) && errors.push(`${review.label}: boundary receipt path must remain normalized and repository-relative: ${path}`);
        if (typeof options.boundaryReceiptVerifier != "function")
          errors.push(`${review.label}: root-boundary review requires a fresh protected host receipt; portable or rootless validation fails closed`);
        else
          try {
            let trusted = options.boundaryReceiptVerifier({ receipt, rootPlanText: rootPlan.text, reviewFields: review.fields });
            trusted?.ok !== !0 && errors.push(`${review.label}: boundary receipt is not trusted: ${trusted?.reason ?? "host verification failed"}`);
          } catch (error) {
            errors.push(`${review.label}: boundary receipt host verification failed: ${String(error?.message ?? error)}`);
          }
        review.effective = {
          ...review.effective,
          plannedAssurance: rootPlan.fields.contract_level === "certified" ? "deep" : rootPlan.fields.contract_level === "controlled" ? "standard" : "lean",
          assuranceUsed: "inline",
          snapshotId: receipt.repository_snapshot_hash ?? null,
          correctionRound: rootEvidence.length > 0 ? rootEvidence.length - 1 : 0,
          reviewReady: !1,
          loopState: "blocked",
          boundaryReview: !0,
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
      let evidence = artifacts.get(review.fields.latest_evidence_id);
      if (!evidence || evidence.fields.artifact !== "delivery-evidence") {
        errors.push(`${review.label}: missing latest evidence ${review.fields.latest_evidence_id}`);
        continue;
      }
      let effective = evidence.effective;
      evidence.fields.root_plan_id !== rootId && errors.push(`${review.label}: latest evidence belongs to another root`);
      let knownFailedEvidence = evidenceHasKnownFailure(evidence.fields);
      knownFailedEvidence && review.fields.delivery_status !== "blocked" && errors.push(`${review.label}: known failed or blocked evidence requires blocked delivery_status`), knownFailedEvidence && ["accept-provisional", "none"].includes(review.fields.next_action) && errors.push(`${review.label}: known failed or blocked evidence cannot be accepted or achieved`);
      let candidates = rootEvidence.filter((item) => item.fields.source_review_id === null || (reviewIndex.get(item.fields.source_review_id) ?? Number.POSITIVE_INFINITY) < index);
      candidates.at(-1)?.fields.id !== review.fields.latest_evidence_id && errors.push(`${review.label}: latest_evidence_id is not the evidence tip at review time`), disjointCoverage(review.fields.inspected_objectives, review.fields.reused_objectives, plan.objectives, `${review.label}: objective review`, errors), disjointCoverage(review.fields.inspected_checks, review.fields.reused_checks, plan.requiredChecks, `${review.label}: Check review`, errors), index === 0 && ((review.fields.reused_objectives ?? []).length > 0 || (review.fields.reused_checks ?? []).length > 0) && errors.push(`${review.label}: first review must inspect all root evidence`);
      let fullReviewRequired = rootPlan.fields.schema >= 4 ? rootPlan.fields.contract_level === "certified" || rootPlan.fields.risk === "high" || (rootPlan.fields.hard_triggers ?? []).length > 0 : rootPlan.fields.assurance_profile === "deep" || (rootPlan.fields.hard_triggers ?? []).length > 0, deterministicBlockedRoute = review.fields.delivery_status === "blocked" && review.fields.review_route === "inline" && (review.fields.next_action === "replan" || review.fields.next_action === "correct" && knownFailedEvidence);
      fullReviewRequired && review.fields.review_route !== "full" && !deterministicBlockedRoute && errors.push(`${review.label}: certified, high-risk, or hard-trigger root requires review_route full`);
      for (let objective of review.fields.reused_objectives ?? [])
        evidence.fields.reused_objectives.includes(objective) || errors.push(`${review.label}: reused review objective ${objective} lacks delta-evidence reuse`), (index > 0 ? artifacts.get(ordered[index - 1].fields.latest_evidence_id)?.effective : null)?.objectives.get(objective)?.status !== "achieved" && errors.push(`${review.label}: reused objective ${objective} requires achieved predecessor status`), reviewData(review).findings.some((finding) => ids(finding.Objectives, objectivePattern).includes(objective)) && errors.push(`${review.label}: reused objective ${objective} has a current finding`);
      for (let check of review.fields.reused_checks ?? []) (!evidence.fields.reused_checks.includes(check) || effective?.checks.get(check)?.status !== "passed") && errors.push(`${review.label}: reused Check ${check} lacks valid passed delta evidence`);
      review.fields.assessment === "achieved" && (effective?.reviewReady || errors.push(`${review.label}: achieved requires complete effective root-check evidence`), [...plan.objectives].some((id) => effective?.objectives.get(id)?.status !== "achieved") && errors.push(`${review.label}: achieved requires every effective root objective achieved`), reviewData(review).findings.length > 0 && errors.push(`${review.label}: achieved cannot contain findings`));
      let plannedAssurance = rootPlan.fields.schema >= 4 ? { lean: "lean", controlled: "standard", certified: "deep" }[rootPlan.fields.contract_level] ?? "standard" : rootPlan.fields.assurance_profile;
      review.effective = {
        ...review.effective,
        plannedAssurance,
        assuranceUsed: review.fields.review_route === "full" ? "deep" : review.fields.review_route === "targeted" ? "standard" : plannedAssurance,
        snapshotId: effective?.snapshot?.["Snapshot ID"] ?? null,
        correctionRound: candidates.length - 1,
        reviewReady: effective?.reviewReady ?? !1,
        loopState: reviewData(review).findings.length > 0 ? "degraded" : "healthy",
        proxies: {
          objectivesInspected: review.fields.inspected_objectives.length,
          objectivesReused: review.fields.reused_objectives.length,
          checksExecuted: review.fields.inspected_checks.length,
          checksReused: review.fields.reused_checks.length,
          auditorsRun: (review.fields.auditors_run ?? []).length
        }
      }, validateCompactCorrection(review, rootPlan, evidence, artifacts, errors);
    }
    for (let index = 2; index < ordered.length; index += 1) {
      let window = ordered.slice(index - 2, index + 1);
      if (window.some((review) => review.fields.review_basis === "root-boundary") || !window.slice(0, 2).every((review) => review.fields.correction_id && [...artifacts.values()].some((candidate) => candidate.fields.artifact === "delivery-evidence" && candidate.fields.subject_id === review.fields.correction_id))) continue;
      let states = window.map((review) => progressState(review, artifacts));
      for (let key of states[2].keys()) {
        if (!states[0].has(key) || !states[1].has(key)) continue;
        if (!(measurableProgress(states[0].get(key), states[1].get(key)) || measurableProgress(states[1].get(key), states[2].get(key)))) {
          let current = window[2];
          current.effective.loopState = "stalled", diagnostics.push(`${current.label}: Finding key ${key} survived two corrections without measurable progress; clarify or replan is recommended`), ["clarify", "replan"].includes(current.fields.next_action) || errors.push(`${current.label}: two correction rounds without measurable progress require next_action clarify or replan`);
        }
      }
      window[2].effective.loopState || (window[2].effective.loopState = reviewData(window[2]).findings.length > 0 ? "degraded" : "healthy");
    }
  }
  return { errors: unique(errors), diagnostics: unique(diagnostics), normalizations: unique(normalizations), effective: artifacts, root_tips: rootTips };
}
function inspectArtifactSet(entries, root = defaultRoot, options = {}) {
  return inspectCompactArtifactSet(entries, root, options);
}
function effectiveCliSummary(inspection) {
  if (!(inspection.effective instanceof Map)) return { active_root_id: null, root_tips: [], evidence_tips: {}, review_tips: {}, actionable_reviews: [], learning_candidates: [] };
  let artifacts = [...inspection.effective.values()], tips = (type, predecessorField) => {
    let items = artifacts.filter((artifact) => artifact.fields.artifact === type);
    return Object.fromEntries(lineageTips(items, predecessorField).map((artifact) => [artifact.fields.root_plan_id, artifact.fields.id]));
  }, rootTips = inspection.root_tips ?? validatePlanLineage(inspection.effective, []), activeRootId = rootTips.length === 1 ? rootTips[0] : null, evidenceTips = tips("delivery-evidence", "predecessor_evidence_id"), reviewTips = tips("work-review", "predecessor_review_id"), activeReview = activeRootId && reviewTips[activeRootId] ? inspection.effective.get(reviewTips[activeRootId]) : null, learningCandidates = artifacts.filter((artifact) => artifact.fields.artifact === "work-review" && artifact.fields.root_plan_id === activeRootId && activeReview?.fields.assessment === "achieved" && activeReview?.fields.delivery_status === "verified" && artifact.correction?.learnings?.length > 0).flatMap((artifact) => artifact.correction.learnings.map((learning) => {
    let evidence = artifacts.find((candidate) => candidate.fields.artifact === "delivery-evidence" && candidate.fields.subject_id === artifact.fields.correction_id && candidate.fields.status === "complete");
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
      evidence_confirmed: !!evidence
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
  let diagnosticsRequested = process.argv.includes("--diagnostics"), effectiveRequested = process.argv.includes("--effective"), paths = process.argv.slice(2).filter((value) => !["--diagnostics", "--effective"].includes(value));
  if (paths.length === 0) {
    console.error("Usage: validate-artifact.mjs [--diagnostics] [--effective] <artifact.md> [related-artifact.md ...]"), process.exitCode = 2;
    return;
  }
  let entries = paths.map((path) => [path, readFileSync2(resolve2(path), "utf8")]), inspection = entries.length === 1 ? inspectArtifactText(entries[0][1]) : inspectArtifactSet(entries);
  if (inspection.errors.length > 0) {
    console.error("Artifact validation failed:"), inspection.errors.forEach((failure) => console.error(`- ${failure}`)), process.exitCode = 1;
    return;
  }
  if (effectiveRequested) {
    console.log(JSON.stringify({ status: "passed", ...effectiveCliSummary(inspection), normalizations: diagnosticsRequested ? inspection.normalizations : void 0, diagnostics: diagnosticsRequested ? inspection.diagnostics : void 0 }, null, 2));
    return;
  }
  console.log(entries.length === 1 ? "Artifact validation passed." : "Artifact chain validation passed."), diagnosticsRequested && (inspection.normalizations.forEach((item) => console.log(`NORMALIZED: ${item}`)), inspection.diagnostics.forEach((item) => console.log(`DIAGNOSTIC: ${item}`)));
}
process.argv[1] && ["validate-artifact.source.mjs", "validate-artifact.mjs"].includes(basename(process.argv[1])) && realpathSync(resolve2(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url)) && runCli();

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
