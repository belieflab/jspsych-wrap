"use strict";

// Functions under test — extracted from lib/fn.js.
// Replace with imports after TypeScript migration.

function generateTimestamp() {
    return new Date()
        .toISOString()
        .replace(/T/, "")
        .replace(/\..+/, "")
        .replace(/-/g, "")
        .replace(/:/g, "");
}

function buildBaseFilename() {
    if (global.visit) return `${global.experimentAlias}_${global.subjectId}_v${global.visit}`;
    if (global.week) return `${global.experimentAlias}_${global.subjectId}_w${global.week}`;
    if (global.phase !== null && global.phase >= 0) return `${global.experimentAlias}_${global.subjectId}_phase${global.phase}`;
    return `${global.experimentAlias}_${global.subjectId}`;
}

function shuffleArray(array) {
    const arrayCopy = [...array];
    for (let i = arrayCopy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
    }
    return arrayCopy;
}

function shuffleKeys(obj) {
    let shuffledKeys = Object.keys(obj).sort(() => Math.random() - 0.5);
    let shuffledObj = {};
    shuffledKeys.forEach(function (key) {
        shuffledObj[key] = obj[key];
    });
    return shuffledObj;
}

function removeOutputVariables(data, ...keysToRemove) {
    keysToRemove.forEach((key) => {
        delete data[key];
    });
    return data;
}

// ---------------------------------------------------------------------------

describe("generateTimestamp", () => {
    test("returns a 14-character numeric string", () => {
        const ts = generateTimestamp();
        expect(ts).toMatch(/^\d{14}$/);
    });

    test("format is YYYYMMDDHHmmss", () => {
        // Fix a known date and verify the output
        const fixedDate = new Date("2025-07-04T13:30:59.000Z");
        jest.spyOn(global, "Date").mockImplementation(() => fixedDate);
        const ts = generateTimestamp();
        expect(ts).toBe("20250704133059");
        jest.restoreAllMocks();
    });

    test("contains no dashes, colons, or T", () => {
        const ts = generateTimestamp();
        expect(ts).not.toContain("-");
        expect(ts).not.toContain(":");
        expect(ts).not.toContain("T");
    });

    test("increases monotonically over time", () => {
        const ts1 = generateTimestamp();
        const ts2 = generateTimestamp();
        expect(ts2 >= ts1).toBe(true);
    });
});

// ---------------------------------------------------------------------------

describe("buildBaseFilename", () => {
    beforeEach(() => {
        global.experimentAlias = "myexp";
        global.subjectId = "P001";
        global.visit = undefined;
        global.week = undefined;
        global.phase = null;
    });

    test("base case: alias_subject with no modifiers", () => {
        expect(buildBaseFilename()).toBe("myexp_P001");
    });

    test("visit modifier: alias_subject_vN", () => {
        global.visit = 2;
        expect(buildBaseFilename()).toBe("myexp_P001_v2");
    });

    test("week modifier: alias_subject_wN", () => {
        global.week = 3;
        expect(buildBaseFilename()).toBe("myexp_P001_w3");
    });

    test("phase modifier: alias_subject_phaseN", () => {
        global.phase = 0;
        expect(buildBaseFilename()).toBe("myexp_P001_phase0");
    });

    test("phase=0 is included (zero is a valid phase)", () => {
        global.phase = 0;
        expect(buildBaseFilename()).toContain("phase0");
    });

    test("phase=-1 is excluded (negative phases are skipped)", () => {
        global.phase = -1;
        expect(buildBaseFilename()).toBe("myexp_P001");
    });

    test("visit takes priority over week when both set", () => {
        global.visit = 1;
        global.week = 2;
        expect(buildBaseFilename()).toBe("myexp_P001_v1");
    });

    test("visit takes priority over phase when both set", () => {
        global.visit = 1;
        global.phase = 0;
        expect(buildBaseFilename()).toBe("myexp_P001_v1");
    });

    test("week takes priority over phase when both set", () => {
        global.week = 2;
        global.phase = 0;
        expect(buildBaseFilename()).toBe("myexp_P001_w2");
    });
});

// ---------------------------------------------------------------------------

describe("shuffleArray", () => {
    test("returns an array of the same length", () => {
        const arr = [1, 2, 3, 4, 5];
        expect(shuffleArray(arr)).toHaveLength(5);
    });

    test("does not modify the original array", () => {
        const arr = [1, 2, 3];
        const copy = [...arr];
        shuffleArray(arr);
        expect(arr).toEqual(copy);
    });

    test("returned array contains the same elements", () => {
        const arr = [1, 2, 3, 4, 5];
        expect(shuffleArray(arr).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    });

    test("handles empty array", () => {
        expect(shuffleArray([])).toEqual([]);
    });

    test("handles single-element array", () => {
        expect(shuffleArray([42])).toEqual([42]);
    });

    test("works with non-numeric elements", () => {
        const arr = ["a", "b", "c"];
        const result = shuffleArray(arr);
        expect(result.sort()).toEqual(["a", "b", "c"]);
    });

    test("produces varied orderings across many runs (not always sorted)", () => {
        const arr = [1, 2, 3, 4, 5, 6, 7, 8];
        const results = new Set();
        for (let i = 0; i < 50; i++) {
            results.add(JSON.stringify(shuffleArray(arr)));
        }
        // Probability of identical ordering in all 50 runs is astronomically small
        expect(results.size).toBeGreaterThan(1);
    });
});

// ---------------------------------------------------------------------------

describe("shuffleKeys", () => {
    test("returned object has the same keys", () => {
        const obj = { a: 1, b: 2, c: 3 };
        const result = shuffleKeys(obj);
        expect(Object.keys(result).sort()).toEqual(["a", "b", "c"]);
    });

    test("returned object has the same values", () => {
        const obj = { x: 10, y: 20, z: 30 };
        const result = shuffleKeys(obj);
        expect(result.x).toBe(10);
        expect(result.y).toBe(20);
        expect(result.z).toBe(30);
    });

    test("handles empty object", () => {
        expect(shuffleKeys({})).toEqual({});
    });

    test("handles single-key object", () => {
        expect(shuffleKeys({ a: 1 })).toEqual({ a: 1 });
    });

    test("does not mutate the original object", () => {
        const obj = { a: 1, b: 2 };
        shuffleKeys(obj);
        expect(obj).toEqual({ a: 1, b: 2 });
    });

    test("produces varied key orderings across many runs", () => {
        const obj = { a: 1, b: 2, c: 3, d: 4, e: 5 };
        const orderings = new Set();
        for (let i = 0; i < 50; i++) {
            orderings.add(JSON.stringify(Object.keys(shuffleKeys(obj))));
        }
        expect(orderings.size).toBeGreaterThan(1);
    });
});

// ---------------------------------------------------------------------------

describe("removeOutputVariables", () => {
    test("removes a single key from the object", () => {
        const data = { a: 1, b: 2, c: 3 };
        removeOutputVariables(data, "b");
        expect(data).toEqual({ a: 1, c: 3 });
    });

    test("removes multiple keys", () => {
        const data = { a: 1, b: 2, c: 3, d: 4 };
        removeOutputVariables(data, "a", "c");
        expect(data).toEqual({ b: 2, d: 4 });
    });

    test("returns the modified object", () => {
        const data = { a: 1 };
        const result = removeOutputVariables(data, "a");
        expect(result).toBe(data);
    });

    test("ignores keys that do not exist on the object", () => {
        const data = { a: 1 };
        expect(() => removeOutputVariables(data, "missing")).not.toThrow();
        expect(data).toEqual({ a: 1 });
    });

    test("called with no keys leaves the object unchanged", () => {
        const data = { a: 1, b: 2 };
        removeOutputVariables(data);
        expect(data).toEqual({ a: 1, b: 2 });
    });
});
