"use strict";

// Functions under test — extracted from lib/redirect.js.
// Replace with imports after TypeScript migration.

function getParamFromUrl(name, href = window.location.href) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    const regexS = "[?&]" + name + "=([^&#]*)";
    const regex = new RegExp(regexS);
    const results = regex.exec(href);
    if (results == null) return undefined;
    return decodeURIComponent(results[1].replace(/\+/g, " "));
}

function counterbalanceParticipants(inputString, modulus) {
    const digits = inputString.match(/\d/g);
    const sum = digits
        ? digits.reduce((acc, digit) => acc + parseInt(digit), 0)
        : null;
    if (sum === null) return null;
    return sum % modulus;
}

// ---------------------------------------------------------------------------

describe("getParamFromUrl", () => {
    test("returns undefined when param is absent", () => {
        expect(getParamFromUrl("workerId", "http://localhost/?foo=bar")).toBeUndefined();
    });

    test("returns the value when param is present", () => {
        expect(getParamFromUrl("workerId", "http://localhost/?workerId=ABC123")).toBe("ABC123");
    });

    test("returns undefined when no query string", () => {
        expect(getParamFromUrl("workerId", "http://localhost/")).toBeUndefined();
    });

    test("decodes percent-encoded values", () => {
        expect(getParamFromUrl("workerId", "http://localhost/?workerId=hello%20world")).toBe("hello world");
    });

    test("converts plus signs to spaces", () => {
        expect(getParamFromUrl("workerId", "http://localhost/?workerId=hello+world")).toBe("hello world");
    });

    test("returns first matching param when multiple params exist", () => {
        expect(getParamFromUrl("workerId", "http://localhost/?foo=1&workerId=WORKER1&bar=2")).toBe("WORKER1");
    });

    test("handles PROLIFIC_PID (underscore in name)", () => {
        expect(getParamFromUrl("PROLIFIC_PID", "http://localhost/?PROLIFIC_PID=PID123")).toBe("PID123");
    });

    test("is case-sensitive (workerId ≠ workerid)", () => {
        expect(getParamFromUrl("workerId", "http://localhost/?workerid=lower")).toBeUndefined();
    });

    test("returns empty string for param present but empty", () => {
        expect(getParamFromUrl("workerId", "http://localhost/?workerId=")).toBe("");
    });
});

// ---------------------------------------------------------------------------

describe("counterbalanceParticipants", () => {
    test("sums all digits and returns sum % modulus", () => {
        // "123" → 1+2+3=6; 6%2=0
        expect(counterbalanceParticipants("123", 2)).toBe(0);
    });

    test("ignores non-digit characters", () => {
        // "AB12CD3" → 1+2+3=6; 6%3=0
        expect(counterbalanceParticipants("AB12CD3", 3)).toBe(0);
    });

    test("returns null when input has no digits", () => {
        expect(counterbalanceParticipants("ABCDEF", 3)).toBeNull();
    });

    test("handles single digit", () => {
        expect(counterbalanceParticipants("7", 3)).toBe(1); // 7%3=1
    });

    test("modulus of 1 always returns 0", () => {
        expect(counterbalanceParticipants("ABC999", 1)).toBe(0);
    });

    test("typical MTurk workerId distributes across 2 conditions", () => {
        // Verify the math: "A3UBNWPX0VWRU8A" → digits: 3,0,0,8 → sum=11; 11%2=1
        expect(counterbalanceParticipants("A3UBNWPX0VWRU8A", 2)).toBe(1);
    });

    test("handles numeric-only string", () => {
        // "456" → 4+5+6=15; 15%4=3
        expect(counterbalanceParticipants("456", 4)).toBe(3);
    });

    test("larger digit sum distributes within modulus range", () => {
        const result = counterbalanceParticipants("999", 5);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(5);
    });

    test("produces varied outputs across different inputs (not always 0)", () => {
        const inputs = ["A1B", "C22D", "333E", "F4444"];
        const results = new Set(inputs.map((id) => counterbalanceParticipants(id, 7)));
        expect(results.size).toBeGreaterThan(1);
    });
});
