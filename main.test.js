const { describe, test, expect } = require("bun:test");
const plugin = require("./main.js");

function clean(text) {
    const result = plugin.transform({ text: text, annotations: {} });
    return result.text;
}

describe("default pipeline cleaner", function() {

    describe("ANSI escape sequence removal", function() {
        test("strips SGR color codes", function() {
            expect(clean("\x1b[31mError\x1b[0m: something failed")).toBe("Error: something failed");
        });

        test("strips bold, underline, and combined styles", function() {
            expect(clean("\x1b[1;4;33mWarning\x1b[0m")).toBe("Warning");
        });

        test("strips cursor movement sequences", function() {
            expect(clean("\x1b[2Jhello\x1b[H")).toBe("hello");
        });

        test("strips OSC sequences (window title)", function() {
            expect(clean("\x1b]0;My Title\x07some text")).toBe("some text");
        });

        test("strips OSC sequences with ST terminator", function() {
            expect(clean("\x1b]8;;https://example.com\x1b\\link\x1b]8;;\x1b\\")).toBe("link");
        });

        test("strips DCS sequences", function() {
            expect(clean("\x1bPdevice control\x1b\\visible")).toBe("visible");
        });

        test("strips SS2/SS3 sequences", function() {
            expect(clean("before\x1bNafter")).toBe("beforeafter");
            expect(clean("before\x1bOafter")).toBe("beforeafter");
        });

        test("strips remaining single-char escapes", function() {
            expect(clean("before\x1b=after")).toBe("beforeafter");
        });

        test("handles multiple ANSI codes in sequence", function() {
            expect(clean("\x1b[32m\x1b[1mGreen Bold\x1b[0m normal")).toBe("Green Bold normal");
        });

        test("strips private CSI sequences (cursor show/hide)", function() {
            expect(clean("\x1b[?25lhidden cursor\x1b[?25h")).toBe("hidden cursor");
        });

        test("strips colon-separated truecolor sequences", function() {
            expect(clean("\x1b[38:2:255:128:0mcolored\x1b[m")).toBe("colored");
        });

        test("strips CSI with intermediate bytes (cursor style)", function() {
            expect(clean("\x1b[0 qtext")).toBe("text");
        });

        test("strips secondary device attributes response", function() {
            expect(clean("\x1b[>0ctext")).toBe("text");
        });
    });

    describe("CRLF normalization", function() {
        test("converts \\r\\n to \\n", function() {
            expect(clean("line1\r\nline2\r\nline3")).toBe("line1\nline2\nline3");
        });

        test("preserves existing \\n", function() {
            expect(clean("line1\nline2\n")).toBe("line1\nline2");
        });

        test("handles mixed line endings", function() {
            expect(clean("a\r\nb\nc\r\n")).toBe("a\nb\nc");
        });
    });

    describe("carriage return overwrite processing", function() {
        test("keeps only final state after \\r", function() {
            expect(clean("Loading 50%\rLoading 100%")).toBe("Loading 100%");
        });

        test("handles multiple \\r overwrites", function() {
            expect(clean("step1\rstep2\rstep3")).toBe("step3");
        });

        test("does not affect lines without \\r", function() {
            expect(clean("normal line")).toBe("normal line");
        });

        test("handles \\r on separate lines", function() {
            expect(clean("progress\rDone\nNext line")).toBe("Done\nNext line");
        });
    });

    describe("backspace processing", function() {
        test("removes previous character on \\b", function() {
            expect(clean("abc\bd")).toBe("abd");
        });

        test("handles multiple backspaces", function() {
            expect(clean("abc\b\bxy")).toBe("axy");
        });

        test("backspace at start of text does nothing", function() {
            expect(clean("\bhello")).toBe("hello");
        });

        test("backspace does not cross newline boundary", function() {
            expect(clean("line1\n\bline2")).toBe("line1\nline2");
        });
    });

    describe("control character removal", function() {
        test("removes NUL and BEL", function() {
            expect(clean("hello\x00world\x07")).toBe("helloworld");
        });

        test("removes SO and SI", function() {
            expect(clean("before\x0e\x0fafter")).toBe("beforeafter");
        });

        test("preserves tabs", function() {
            expect(clean("col1\tcol2\tcol3")).toBe("col1\tcol2\tcol3");
        });

        test("preserves newlines", function() {
            expect(clean("line1\nline2")).toBe("line1\nline2");
        });

        test("removes DEL character (0x7F)", function() {
            expect(clean("hello\x7fworld")).toBe("helloworld");
        });

        test("removes VT and FF characters", function() {
            expect(clean("before\x0bafter")).toBe("beforeafter");
            expect(clean("before\x0cafter")).toBe("beforeafter");
        });
    });

    describe("box-drawing character removal", function() {
        test("removes horizontal and vertical lines", function() {
            expect(clean("\u2500\u2500\u2500")).toBe("");
            expect(clean("\u2502content\u2502")).toBe("content");
        });

        test("removes table corners and junctions", function() {
            expect(clean("\u250c\u2500\u2500\u2510\n\u2502Hi\u2502\n\u2514\u2500\u2500\u2518")).toBe("Hi");
        });

        test("preserves content between box chars", function() {
            expect(clean("\u2502 Name \u2502 Age \u2502")).toBe("Name  Age");
        });
    });

    describe("whitespace normalization", function() {
        test("trims trailing whitespace per line", function() {
            expect(clean("hello   \nworld  ")).toBe("hello\nworld");
        });

        test("collapses multiple blank lines to single newline", function() {
            expect(clean("a\n\n\nb")).toBe("a\nb");
            expect(clean("a\n\nb")).toBe("a\nb");
            expect(clean("a\n\n\n\n\nb")).toBe("a\nb");
        });

        test("trims leading/trailing whitespace of entire text", function() {
            expect(clean("  \nhello\n  ")).toBe("hello");
        });
    });

    describe("passthrough and edge cases", function() {
        test("plain text passes through unchanged", function() {
            expect(clean("Hello, world!")).toBe("Hello, world!");
        });

        test("empty input returns empty string", function() {
            expect(clean("")).toBe("");
        });

        test("whitespace-only input returns empty string", function() {
            expect(clean("   \n  \n   ")).toBe("");
        });

        test("preserves annotations", function() {
            const result = plugin.transform({
                text: "\x1b[31mtest\x1b[0m",
                annotations: { tool: "git", mode: "stdout" }
            });
            expect(result.text).toBe("test");
            expect(result.annotations.tool).toBe("git");
            expect(result.annotations.mode).toBe("stdout");
        });
    });

    describe("combined scenarios", function() {
        test("ANSI colors + CRLF + trailing whitespace", function() {
            expect(clean("\x1b[32mOK\x1b[0m: done   \r\n\x1b[31mERR\x1b[0m: fail  \r\n"))
                .toBe("OK: done\nERR: fail");
        });

        test("progress bar with ANSI + CR overwrite", function() {
            expect(clean("\x1b[32m[####    ] 50%\x1b[0m\r\x1b[32m[########] 100%\x1b[0m"))
                .toBe("[########] 100%");
        });

        test("box-drawing table with ANSI colors", function() {
            const input = "\x1b[1m\u250c\u2500\u2500\u2500\u2500\u2510\x1b[0m\n" +
                        "\x1b[1m\u2502\x1b[0m \x1b[32mOK\x1b[0m \x1b[1m\u2502\x1b[0m\n" +
                        "\x1b[1m\u2514\u2500\u2500\u2500\u2500\u2518\x1b[0m";
            expect(clean(input)).toBe("OK");
        });

        test("mixed CSI + OSC sequences in same string", function() {
            expect(clean("\x1b]0;title\x07\x1b[31mhello\x1b[0m world"))
                .toBe("hello world");
        });

        test("backspace followed by CR overwrite on same line", function() {
            expect(clean("abc\b\b\rdef")).toBe("def");
        });
    });

    describe("edge cases", function() {
        test("partial CR overwrite keeps only text after last CR", function() {
            // Terminal would show "bbllo" (partial overwrite), but per design
            // we keep only text after the last \r for token efficiency
            expect(clean("hello\rbb")).toBe("bb");
        });

        test("truncated CSI at end of string", function() {
            // ESC [ at end of input: CSI regex can't match (no final byte),
            // remaining escape regex excludes [, so ESC removed by control char step, [ remains
            expect(clean("before\x1b[")).toBe("before[");
        });

        test("truncated CSI with params at end of string", function() {
            // ESC [31 at end: no final byte in [@-~] range, CSI regex can't match
            expect(clean("before\x1b[31")).toBe("before[31");
        });

        test("CSI final byte a (CUU) is valid and stripped", function() {
            // a (0x61) is in CSI final byte range [@-~], so \x1b[31a is valid CSI
            expect(clean("before\x1b[31aafter")).toBe("beforeafter");
        });

        test("preserves CJK characters", function() {
            expect(clean("\u4f60\u597d\u4e16\u754c")).toBe("\u4f60\u597d\u4e16\u754c");
        });

        test("preserves emoji", function() {
            expect(clean("status: \u2705 done \ud83d\ude80")).toBe("status: \u2705 done \ud83d\ude80");
        });

        test("preserves accented characters", function() {
            expect(clean("caf\u00e9 na\u00efve \u00fc\u00f1\u00ee")).toBe("caf\u00e9 na\u00efve \u00fc\u00f1\u00ee");
        });

        test("ANSI around Unicode content preserved", function() {
            expect(clean("\x1b[32m\u4f60\u597d\x1b[0m")).toBe("\u4f60\u597d");
        });

        test("lone ESC at end of string removed by control char step", function() {
            // ESC at end: no following char for escape regex, removed as control char (0x1B)
            expect(clean("before\x1b")).toBe("before");
        });

        test("ESC + char treated as 2-byte escape and both removed", function() {
            // ESC followed by any non-excluded char is treated as unknown escape
            expect(clean("before\x1bxafter")).toBe("beforeafter");
        });

        test("multiple CRs with newlines between", function() {
            expect(clean("a\rb\nc\rd")).toBe("b\nd");
        });
    });
});
