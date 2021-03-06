// A closure is the combination of a function bundled together (enclosed) with references
// to its surrounding state (the lexical environment). In other words, a closure gives you 
// access to an outer function’s scope from an inner function. In JavaScript, closures are 
// created every time a function is created, at function creation time.

function InputStream(input) {
    var pos = 0, line = 1, col = 0;
    // NOTE THAT CLOSURES ARE INVOLVED IN OUR PROGRAM
    // To use a closure, simply define a function inside another function and expose it. 
    // To expose a function, return it or pass it to another function.
    return {
        next    :   next,   // returns next value and discards it from the stream
        peek    :   peek,   // returns next value without removing it from the stream
        eof     :    eof,
        croak   :  croak
    };

    function next() {
        var ch = input.charAt(pos++);
        if (ch == '\n') line++, col = 0; else col++;
        return ch;
    }
    
    function peek() {
        return input.charAt(pos);
    }

    function eof() {
        return peek() == '';
    }

    function croak(msg) {
        throw new Error(msg + " (" + line + ":" + col + ")");
    }
}


// The tokenizer (also called “lexer”) operates on a character input stream 
// and returns a stream object with the same interface, but the values returned 
// by peek() / next() will be tokens. A token is an object with two properties: 
// type and value. 
function TokenStream(input) {
    var current = null;
    var keywords = " let if then else lambda true false";
    return {
        next    :   next,
        peek    :   peek,
        eof     :   eof,
        croak   :   input.croak
    };
    function is_keyword(x) {
        return keywords.indexOf(" " + x + " ") >= 0;
    }
    function is_digit(ch) {
        // TODO: wtf is .test()
        return /[0-9]/i.test(ch);
    }
    function is_id_start(ch) {
        return /[a-z_]/i.test(ch);
    }
    function is_id(ch) {
        // TODO: does it mean we can use any of "?!-<>=0123456789" chars?
        return is_id_start(ch) || "?!-<>=0123456789".indexOf(ch) >= 0;
    }
    function is_op_char(ch) {
        return "+-*/%=&|<>!".indexOf(ch) >= 0;
    }
    function is_punc(ch) {
        return ",;(){}[]".indexOf(ch) >= 0;
    }
    function is_whitespace(ch) {
        return " \t\n".indexOf(ch) >= 0;
    }
    function read_while(predicate) {
        var str = "";
        while(!input.eof() && predicate(input.peek()))
            str += input.next();
        return str;
    }
    function read_number() {
        var has_dot = false;
        var number = read_while(function(ch) {
            // TODO: wtf is this if doing??
            if (ch == ".") {
                if (has_dot) return false;
                has_dot = true;
                return true;
            }
            return is_digit(ch);
        });
        return { type: 'num', value: parseFloat(number) };
    }
    function read_ident() {
        var id = read_while(is_id);
        return {
            type: is_keyword(id) ? 'kw' : 'var',
            value: id
        };
    }
    function read_escaped(end) {
        var escaped = false, str = "";
        input.next();
        while(!input.eof()) {
            var ch = input.next();
            if (escaped) {
                str += ch;
                escaped = false;
            } else if (ch == "\\") {
                escaped = true;
            } else if (ch == end) {
                break;
            } else {
                str += ch;
            }
        }
        return str;
    }
    function read_string() {
        return { type: 'str', value: read_escaped('"') };
    }
    function skip_comment() {
        read_while(function(ch) { return ch != '\n' });
        input.next();
    }
    function read_next() {
        // skip over whitespace
        read_while(is_whitespace);
        // if eof reached, return nothing
        if (input.eof()) return null;
        // peek a character
        var ch = input.peek();
        // if character happens to be #
        if (ch == '#') {
            skip_comment();
            return read_next();
        }
        if (ch == '"') return read_string();
        if (is_digit(ch)) return read_number();
        if (is_id_start(ch)) return read_ident();
        if (is_punc(ch)) return {
            type: 'punc',
            value: input.next()
        };
        if (is_op_char(ch)) return {
            type: 'op',
            value: read_while(is_op_char)
        };
        input.croak("Can't handle character: " + ch);
    }
    // TODO: wow
    function peek() {
        return current || (current = read_next());
    }
    function next() {
        var tok = current;
        current = null;
        return tok || read_next();
    }
    function eof() {
        return peek() == null;
    }
}

// The parser creates the AST nodes
function parse(input) {
    var PRECEDENCE = {
        "=": 1,
        "||": 2,
        "&&": 3,
        "<": 7, ">": 7, "<=": 7, ">=": 7, "==": 7, "!=": 7,
        "+": 10, "-": 10,
        "*": 20, "/": 20, "%": 20
    };
    var FALSE = { type: "bool", value: false };
    return parse_toplevel();
    function is_punc(ch) {
        var tok = input.peek();
        // READ THESE: 
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Logical_Operators
        // https://stackoverflow.com/questions/2966430/
        // expr1 && expr2: Returns expr1 if it can be converted to false; otherwise, returns expr2. 
        // expr1 || expr2: Returns expr1 if it can be converted to true; otherwise, returns expr2. 
        // TODO: why couldn't we write: return tok && tok.type == 'punc' && tok.value == ch && tok;
        return tok && tok.type == 'punc' && (!ch || tok.value == ch) && tok;
    }
    function is_kw(kw) {
        var tok = input.peek();
        // TODO: WTF
        return tok && tok.type == 'kw' && (!kw || tok.value == kw) && tok;
    }
    function is_op(op) {
        var tok = input.peek();
        // TODO: WTF
        return tok && tok.type == 'op' && (!op || tok.value == op) && tok;
    }
    function skip_punc(ch) {
        if (is_punc(ch)) input.next();
        else input.croak("Expecting punctuation: \"" + ch + "\"");
    }
    function skip_kw(kw) {
        if (is_kw(kw)) input.next();
        else input.croak("Expecting keyword: \"" + kw + "\"");
    }
    function skip_op(op) {
        if (is_op(op)) input.next();
        else input.croak("Expecting operator: \"" + ch + "\"");
    }
    function unexpected() {
        input.croak("Unexpected token: " + JSON.stringify(input.peek()));
    }
    function maybe_binary(left, my_prec) {
        var tok = is_op();
        if (tok) {
            var his_prec = PRECEDENCE[tok.value];
            if (his_prec > my_prec) {
                input.next();
                return maybe_binary({
                    type: tok.value == "=" ? "assign" : "binary",
                    operator: tok.value,
                    left: left,
                    right: maybe_binary(parse_atom(), his_prec)
                }, my_prec);
            }
        }
        return left;
    }
    function delimited(start, stop, separator, parser) {
        var a = [], first = true;
        skip_punc(start);
        while(!input.eof()) {
            if (is_punc(stop)) break;
            if (first) first = false; else skip_punc(separator);
            if (is_punc(stop)) break;
            a.push(parser());
        }
        skip_punc(stop);
        return a;
    }
    function parse_call(func) {
        return {
            type: "call",
            func: func,
            args: delimited("(", ")", ",", parse_expression)
        }
    }
    function parse_varname() {
        var name = input.next();
        if (name.type != "var") input.croak("Expecting variable name");
        return name.value;
    }
    function parse_if() {
        skip_kw("if");
        var cond = parse_expression();
        var ret = {
            type: "if",
            cond: cond,
            then: then
        };
        if (is_kw("else")) {
            input.next();
            ret.else = parse_expression();
        }
        return ret;
    }
    function parse_lambda() {
        return {
            type: "lambda",
            name: input.peek().type == "var" ? input.next().value : null,
            vars: delimited("(", ")", ",", parse_varname),
            body: parse_expression()
        };
    }
    function parse_let() {
        skip_kw("let");
        if (input.peek().type == "var") {
            var name = input.next().value;
            var defs = delimited("(", ")", ",", parse_vardef);
            return {
                type: "call",
                func: {
                    type: "lambda",
                    name: name,
                    vars: defs.map(function(def) { return def.name }),
                    body: parse_expression()
                },
                args: defs.map(function(def) { return def.def || FALSE })
            };
        }
        return {
            type: "let",
            vars: delimimited("(", ")", ",", parse_vardef),
            body: parse_expression()
        };
    }
    function parse_vardef() {
        var name = parse_varname(), def;
        if (is_op("=")) {
            input.next();
            def = parse_expression();
        }
        return { name: name, def: def };
    }
    function parse_bool() {
        return {
            type: bool,
            value: input.next().value == "true"
        };
    }
    function maybe_call(expr) {
        expr = expr();
        return is_punc("(") ? parse_call(expr) : expr;
    }
    function parse_atom() {
        return maybe_call(function() {
            if (is_punc("(")) {
                input.next();
                var exp = parse_expression();
                skip_punc(")");
                return exp;
            }
            if (is_punc("{")) return parse_prog();
            if (is_kw("let")) return parse_let();
            if (is_kw("if")) return parse_if();
            if (is_kw("true") || is_kw("false")) return parse_bool();
            if (is_kw("lambda")) {
                input.next();
                return parse_lambda();
            }
            var tok = input.next();
            if (tok.type == "var" || tok.type == "num" || tok.type == "str")
                return tok;
            unexpected();
        });    
    }
    // Parse the whole program. 
    // Since we have no statements, we simply call 
    // parse_expression() until we get to the end of the input
    function parse_toplevel() {
        var prog = [];
        while (!input.eof()) {
            prog.push(parse_expression());
            if (!input.eof()) skip_punc(";");
        }
        return { type: "prog", prog: prog };
    }
    function parse_prog() {
        var prog = delimited("{", "}", ";", parse_expression);
        if (prog.length == 0) return FALSE;
        if (prog.length == 1) return prog[0];
        return { type: "prog", prog: prog };
    }
    function parse_expression() {
        return maybe_call(function() {
            return maybe_binary(parse_atom(), 0);
        })
    }
}

// The key to correct execution is to properly maintain 
// the environment — a structure holding variable bindings. 
// It will be passed as an argument to our evaluate function. 
// Each time we enter a "lambda" node we must extend the environment 
// with new variables (function's arguments) and initialize them with 
// values passed at run time.
function Environment(parent) {
    this.vars = Object.create(parent ? parent.vars : null);
    this.parent = parent;
}
Environment.prototype = {
    extend: function() {
        return new Environment(this);
    },
    lookup: function(name) {
        var scope = this;
        while (scope) {
            if (Object.prototype.hasOwnProperty.call(scope.vars, name))
                return scope;
            scope = scope.parent;
        }
    },
    get: function(name) {
        if (name in this.vars) {
            return this.vars[name];
        }
        throw new Error("Undefined variable " + name);
    },
    set: function(name, value) {
        var scope = this.lookup(name);
        if (!scope && this.parent) {
            throw new Error("Undefined variable " + name);
        }
        // TODO: what a crazy return statement!
        return (scope || this).vars[name] = value;
    },
    def: function(name, value) {
        return this.vars[name] = value;
    }
}

function evaluate(exp, env, callback) {
    switch(exp.type) {
        case "num":
        case "str":
        case "bool":
            callback(exp.value);
            return;
        
        case "var":
            callback(env.get(exp.value));
        
        case "assign":
            if (exp.left.type != "var") 
                throw new Error("Cannot assign to " + JSON.stringify(exp.left));
            evaluate(exp.right, env, function(right) {
                callback(env.set(exp.left.value, right));
            });
            return;
        
        case "binary":
            evaluate(exp.left, env, function (left) {
                evaluate(exp.right, env, function(right) {
                    callback(apply_op(exp.operator, lefr, right));
                });
            });
            return;
        
        case "let":
            (function loop(env, i) {
                if (i < exp.vars.length) {
                    var v = exp.vars[i];
                    if (v.def) evaluate(v.def, env, function (value) {
                        var scope = env.extend();
                        scope.def(v.name, value);
                        loop(scope, i + 1);
                    }); else {
                        var scope = env.extend();
                        scope.def(v.name, false);
                        loop(scope, i + 1);
                    }
                } else  {
                    evaluate(exp.body, env, callback);
                }
            })(env, 0);
            return;

        case "lambda":
            callback(make_lambda(env, exp));
            return;
        
        case "if":
            evaluate(exp.cond, env, function (cond) {
                if (cond !== false) evaluate(exp.then, env, callback);
                else if (exp.else) evaluate(exp.else, env, callback);
                else callback(false);
            });
            return;
        
        case "prog":
            (function loop(last, i) {
                if (i < exp.prog.length) evaluate(exp.prog[i], env, function (val) {
                    loop(val, i + 1);
                }); else {
                    callback(last);
                }
            })(false, 0);
            return;
        
        case "call":
            evaluate(exp.fucn, env, function (fucn) {
                (function loop(args, i) {
                    if (i < exp.args.length) evaluate(exp.args[i], env, function (arg) {
                        args[i + 1] = arg;
                        loop(args, i + 1);
                    }); else {
                        fucn.apply(null, args);
                    }
                // TODO: WOOO0OWW, WTF, REALLY
                })([ callback ], 0);
            });
            return;

        default:
            throw new Error("I don't know how to evaluate " + exp.type);
    }
}

function apply_op(op, a, b) {
    function num(x) {
        if (typeof x != "number") {
            throw new Error("Expected number but got " + x);
        }
        return x;
    }
    function div(x) {
        if (num(x) == 0) {
            throw new Error("Divide by zero");
        }
        return x;
    }
    switch(op) {
        case "+": return num(a) + num(b);
        case "-": return num(a) - num(b);
        case "*": return num(a) * num(b);
        case "/": return num(a) / div(b);
        case "%": return num(a) % div(b);
        case "&&": return a !== false && b;
        case "||": return a !== false ? a : b;
        case "<": return num(a) < num(b);
        case ">": return num(a) > num(b);
        case "<=": return num(a) <= num(b);
        case ">=": return num(a) >= num(b);
        case "==": return a === b;
        case "!=": return a !== b;
    }
    throw new Error("Can't apply operator " + op);
}

function make_lambda() {
    if (exp.name) {
        env = env.extend();
        env.def(exp.name, lambda);
    }
    function lambda(callback) {
        var names = exp.vars;
        var scope = env.extend();
        for (var i = 0; i < names.length; ++i)
            scope.def(names[i], 
                        i + 1 < arguments.length 
                        ? arguments[i + 1] 
                        : false);
        evaluate(exp.body, scope, callback);
    }
    return lambda;
}

/**
 * ------ [entry point for NodeJS] ------
 */
var globalEnv = new Environment();

globalEnv.def("time", function(func) {
    try {
        console.time("time");
        return func();
    } finally {
        console.timeEnd("time");
    }
});

if (typeof process != "undefined") (function() {
    var util = require("util");
    
    globalEnv.def("println", function(k, val) {
        console.log(val);
        k(false);
    });

    globalEnv.def("print", function(k, val) {
        console.log(val);
        k(false);
    });
    
    var code = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("readable", function() {
        var chunk = process.stdin.read();
        if (chunk) code += chunk;
    });
    process.stdin.on("end", function() {
        var ast = parse(TokenStream(InputStream(code)));
        evaluate(ast, globalEnv);
    })
})();
