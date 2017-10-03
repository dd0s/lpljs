function InputStream(input) {
    var pos = 0, line = 1, col = 0;
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
function TokenStream() {
    var current = null;
    var keywords = " if then else lambda true false";
    return {
        next: next,
        peek: peek,
        eof: eof,
        croak: input.croak
    };
    function is_whitespace(ch) {
        return " \t\n".indexOf(ch) >= 0;
    }
    function is_digit(ch) {
        return /[0-9]/i.test(ch);
    }
    function is_id_start(ch) {
        return /[a-z_]/i.test(ch);
    }
    function is_id(ch) {
        return is_id_start(ch) || "?!-<>s"
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

    }
    function skip_comment() {
        read_while(function(ch) { return ch != '\n' });
        input.next();
    }
    function read_next() {
        // skip over whitespace
        read_while(is_whitespace);
        if (input.eof()) return null;
        // peek a character
        var ch = input.peek();
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
}

