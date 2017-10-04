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
    var keywords = " if then else lambda true false";
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
    function parse_varname() {
        var name = input.text();
        if (name.type != "var") input.croak("Expecting variable name");
        return name.value;
    }
    function parse_lambda() {
        return {
            type: "lambda",
            vars: delimited("(", ")", ",", parse_varname),
            body: parse_expression()
        };
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
    function parse_expression() {
        return maybe_call(function() {
            return maybe_binary(parse_atom(), 0);
        })
    }
    function maybe_call(expr) {
        expr = expr();
        return is_punc("(") ? parse_call(expr) : expr;
    }
    function parse_call(func) {
        return {
            type: "call",
            func: func,
            args: delimited("(", ")", ",", parse_expression)
        }
    }
}





