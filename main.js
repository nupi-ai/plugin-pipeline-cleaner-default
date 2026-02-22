module.exports = {
    name: "default",
    transform: function(input) {
        let text = input.text;

        // Step 1: Normalize line endings (moved from service.go)
        text = text.replace(/\r\n/g, '\n');

        // Step 2: Strip ANSI escape sequences
        // CSI sequences per ECMA-48: ESC [ <params> <intermediates> <final>
        //   params: 0x30-0x3F (digits, ;:, <=>?)  intermediates: 0x20-0x2F  final: 0x40-0x7E
        text = text.replace(/\x1b\[[0-9:;<=>?]*[ -/]*[@-~]/g, '');
        // OSC sequences: ESC ] ... BEL or ST (window titles, hyperlinks, progress)
        text = text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');
        // DCS sequences: ESC P ... ST (device control strings)
        text = text.replace(/\x1bP[^\x1b]*\x1b\\/g, '');
        // SS2, SS3 and other 2-char escapes
        text = text.replace(/\x1b[NOco]/g, '');
        // Any remaining ESC + single char (keypad modes, etc.)
        text = text.replace(/\x1b[^[\]PNOco]/g, '');

        // Step 3: Remove control characters (keep \b, \t, \n, \r)
        // C0 controls (0x00-0x07, 0x0E-0x1F incl. lone ESC from truncated sequences),
        // VT (0x0B), FF (0x0C), and DEL (0x7F)
        text = text.replace(/[\x00-\x07\x0b\x0c\x0e-\x1f\x7f]/g, '');

        // Step 4: Process backspace sequences
        const result = [];
        for (let i = 0; i < text.length; i++) {
            if (text[i] === '\b') {
                if (result.length > 0 && result[result.length - 1] !== '\n') {
                    result.pop();
                }
            } else {
                result.push(text[i]);
            }
        }
        text = result.join('');

        // Step 5: Process carriage return overwrites
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const crIdx = lines[i].lastIndexOf('\r');
            if (crIdx !== -1) {
                lines[i] = lines[i].substring(crIdx + 1);
            }
        }
        text = lines.join('\n');

        // Step 6: Remove box-drawing characters (U+2500-U+257F)
        text = text.replace(/[\u2500-\u257f]/g, '');

        // Step 7: Normalize whitespace
        text = text.replace(/[ \t]+$/gm, '');
        text = text.replace(/\n{2,}/g, '\n');
        text = text.trim();

        return { text: text, annotations: input.annotations };
    }
};
