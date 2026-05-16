"use strict";

// Functions under test — extracted from lib/validate.js.
// Replace with imports after TypeScript migration.

function addValidationAlert(message) {
    if (!window.validateAlerts) {
        window.validateAlerts = [];
    }
    window.validateAlerts.push(message);
}

function checkScreenResolution() {
    const physicalHeight = window.screen.height * window.devicePixelRatio;
    if (physicalHeight < 768) {
        addValidationAlert(
            "Your screen resolution and/or scaling is too low to view the experiment correctly. Your experimenter can help you increase your screen resolution and/or scaling. Thank you!"
        );
    }
}

function validateField(fieldId, errorMessage) {
    const element = document.getElementById(fieldId);

    if (!element || !element.value) {
        addValidationAlert(errorMessage);
        return null;
    }

    if (fieldId === "guid") {
        element.value = element.value.toUpperCase();
        const regex = /^NDAR[0-9A-Z]{8}$/;
        if (!regex.test(element.value)) {
            addValidationAlert("GUID does not meet format.");
            return null;
        }
    }

    if (fieldId === "subject") {
        element.value = element.value.toUpperCase();

        if (
            typeof intake !== "undefined" &&
            intake.subject &&
            intake.subject.prefix &&
            intake.subject.length &&
            intake.subject.length
        ) {
            if (!element.value.startsWith(intake.subject.prefix)) {
                addValidationAlert(`Subject ID must begin with ${intake.subject.prefix}.`);
                return null;
            }
            if (element.value.length !== intake.subject.length) {
                addValidationAlert(`Subject ID must be exactly ${intake.subject.length} characters long.`);
                return null;
            }
            const digitPart = element.value.substring(intake.subject.prefix.length);
            const expectedDigitCount = intake.subject.length - intake.subject.prefix.length;
            if (digitPart.length !== expectedDigitCount || !/^\d+$/.test(digitPart)) {
                addValidationAlert(`Subject ID must have ${expectedDigitCount} digits after ${intake.subject.prefix}.`);
                return null;
            }
        }

        const siteRule = (typeof intake !== "undefined" && intake.sites) ? intake.sites[site] : undefined;
        if (siteRule) {
            const suffixLength = siteRule.length - siteRule.prefix.length;
            const pattern = new RegExp(`^${siteRule.prefix}.{${suffixLength}}$`);
            if (!pattern.test(element.value)) {
                addValidationAlert(`Subject Id must begin with ${siteRule.prefix} and be ${siteRule.length} characters long.`);
                return null;
            }
        }
    }

    if (fieldId === "dob") {
        const dob = new Date(element.value);
        const today = new Date();

        if (isNaN(dob.getTime())) {
            addValidationAlert("Invalid date of birth.");
            return null;
        }
        if (dob > today) {
            addValidationAlert("Date of birth cannot be in the future.");
            return null;
        }

        let ageInMonths = (today.getFullYear() - dob.getFullYear()) * 12;
        ageInMonths += today.getMonth() - dob.getMonth();
        if (dob.getDate() > 15) ageInMonths++;
        ageInMonths = Math.max(0, ageInMonths);
        return ageInMonths;
    }

    return element.value;
}

function validateRadio(groupName, alertMessage) {
    const radioButtons = document.querySelectorAll(`input[name="${groupName}"]`);
    let selectedValue = null;
    for (const radioButton of radioButtons) {
        if (radioButton.checked) {
            selectedValue = radioButton.value;
            break;
        }
    }

    if (!selectedValue) {
        addValidationAlert(alertMessage);
        return null;
    } else {
        if (groupName === "handedness") {
            window.handedness = selectedValue;
            window.antihandedness = selectedValue === "right" ? "left" : "right";
        }
    }

    return selectedValue;
}

// ---------------------------------------------------------------------------

beforeEach(() => {
    window.validateAlerts = [];
    global.site = undefined;
    global.intake = undefined;
    document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------

describe("addValidationAlert", () => {
    test("initialises validateAlerts if absent and pushes message", () => {
        delete window.validateAlerts;
        addValidationAlert("test error");
        expect(window.validateAlerts).toEqual(["test error"]);
    });

    test("appends to an existing alerts array", () => {
        window.validateAlerts = ["first"];
        addValidationAlert("second");
        expect(window.validateAlerts).toEqual(["first", "second"]);
    });

    test("accumulates multiple distinct messages", () => {
        addValidationAlert("A");
        addValidationAlert("B");
        addValidationAlert("C");
        expect(window.validateAlerts).toHaveLength(3);
    });
});

// ---------------------------------------------------------------------------

describe("checkScreenResolution", () => {
    function setScreen(height, dpr) {
        Object.defineProperty(window.screen, "height", { value: height, writable: true, configurable: true });
        Object.defineProperty(window, "devicePixelRatio", { value: dpr, writable: true, configurable: true });
    }

    test("adds alert when physical height < 768", () => {
        setScreen(400, 1); // 400*1 = 400
        checkScreenResolution();
        expect(window.validateAlerts).toHaveLength(1);
        expect(window.validateAlerts[0]).toMatch(/screen resolution/);
    });

    test("adds alert when DPR makes physical height < 768", () => {
        setScreen(700, 1); // 700 < 768
        checkScreenResolution();
        expect(window.validateAlerts).toHaveLength(1);
    });

    test("adds no alert when physical height >= 768", () => {
        setScreen(1080, 1); // 1080 >= 768
        checkScreenResolution();
        expect(window.validateAlerts).toHaveLength(0);
    });

    test("adds no alert when DPR boosts height above threshold", () => {
        setScreen(400, 2); // 400*2 = 800 >= 768
        checkScreenResolution();
        expect(window.validateAlerts).toHaveLength(0);
    });

    test("boundary: exactly 768 passes", () => {
        setScreen(768, 1);
        checkScreenResolution();
        expect(window.validateAlerts).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------

describe("validateField — generic fields", () => {
    function addInput(id, value) {
        const el = document.createElement("input");
        el.id = id;
        el.value = value;
        document.body.appendChild(el);
        return el;
    }

    test("returns null and adds alert when element is missing", () => {
        const result = validateField("nonexistent", "Field is required.");
        expect(result).toBeNull();
        expect(window.validateAlerts).toContain("Field is required.");
    });

    test("returns null and adds alert when element value is empty", () => {
        addInput("myfield", "");
        const result = validateField("myfield", "Field is required.");
        expect(result).toBeNull();
        expect(window.validateAlerts).toHaveLength(1);
    });

    test("returns element value for a plain non-special field", () => {
        addInput("visit", "3");
        const result = validateField("visit", "Enter visit.");
        expect(result).toBe("3");
        expect(window.validateAlerts).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------

describe("validateField — GUID", () => {
    function addGuid(value) {
        const el = document.createElement("input");
        el.id = "guid";
        el.value = value;
        document.body.appendChild(el);
        return el;
    }

    test("accepts a well-formed GUID (NDAR + 8 alphanumeric chars)", () => {
        addGuid("NDAR12345678");
        expect(validateField("guid", "Enter GUID.")).toBe("NDAR12345678");
        expect(window.validateAlerts).toHaveLength(0);
    });

    test("upcases the value before testing", () => {
        addGuid("ndar12345678");
        const result = validateField("guid", "Enter GUID.");
        expect(result).toBe("NDAR12345678");
    });

    test("rejects GUID that doesn't start with NDAR", () => {
        addGuid("ABCD12345678");
        expect(validateField("guid", "Enter GUID.")).toBeNull();
        expect(window.validateAlerts).toContain("GUID does not meet format.");
    });

    test("rejects GUID that is too short", () => {
        addGuid("NDAR123");
        expect(validateField("guid", "Enter GUID.")).toBeNull();
    });

    test("rejects GUID that is too long", () => {
        addGuid("NDAR123456789");
        expect(validateField("guid", "Enter GUID.")).toBeNull();
    });

    test("accepts GUIDs with uppercase letters in suffix", () => {
        addGuid("NDARABCDEFGH");
        expect(validateField("guid", "Enter GUID.")).toBe("NDARABCDEFGH");
    });
});

// ---------------------------------------------------------------------------

describe("validateField — subject ID (no site rule, no intake config)", () => {
    function addSubject(value) {
        const el = document.createElement("input");
        el.id = "subject";
        el.value = value;
        document.body.appendChild(el);
    }

    beforeEach(() => {
        global.site = "UNKNOWN_SITE"; // No rule for this site
    });

    test("returns uppercased value for a generic subject ID", () => {
        addSubject("abc123");
        expect(validateField("subject", "Enter subject.")).toBe("ABC123");
    });

    test("returns null and alerts when field is empty", () => {
        addSubject("");
        expect(validateField("subject", "Enter subject.")).toBeNull();
        expect(window.validateAlerts).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------

describe("validateField — subject ID site-specific rules", () => {
    beforeEach(() => {
        global.intake = {
            sites: {
                UCD:      { prefix: "C10D", length: 8 },
                UMN:      { prefix: "C10M", length: 8 },
                Maryland: { prefix: "C10B", length: 8 },
                UChicago: { prefix: "C10C", length: 8 },
                WashU:    { prefix: "C10W", length: 8 },
            },
        };
    });

    function addSubject(value) {
        const el = document.createElement("input");
        el.id = "subject";
        el.value = value;
        document.body.appendChild(el);
    }

    test.each([
        ["UCD",      "C10D", "C10DABCD"],
        ["UMN",      "C10M", "C10MABCD"],
        ["Maryland", "C10B", "C10BABCD"],
        ["UChicago", "C10C", "C10CABCD"],
        ["WashU",    "C10W", "C10WABCD"],
    ])("%s: accepts valid subject ID %s", (siteName, _prefix, id) => {
        global.site = siteName;
        addSubject(id);
        expect(validateField("subject", "Enter subject.")).not.toBeNull();
        expect(window.validateAlerts).toHaveLength(0);
    });

    test.each([
        ["UCD",      "BADPREFIX"],
        ["UMN",      "C10M123"],   // too short (7 chars)
        ["Maryland", "C10BABCDE"], // too long (9 chars)
    ])("%s: rejects invalid subject ID '%s'", (siteName, id) => {
        global.site = siteName;
        addSubject(id);
        expect(validateField("subject", "Enter subject.")).toBeNull();
        expect(window.validateAlerts).toHaveLength(1);
    });

    test("no site rule: any non-empty subject ID is accepted", () => {
        global.site = "RANDOM";
        addSubject("anything");
        expect(validateField("subject", "Enter subject.")).toBe("ANYTHING");
    });
});

// ---------------------------------------------------------------------------

describe("validateField — subject ID intake config", () => {
    function addSubject(value) {
        const el = document.createElement("input");
        el.id = "subject";
        el.value = value;
        document.body.appendChild(el);
    }

    beforeEach(() => {
        global.site = "UNKNOWN_SITE"; // skip site rule
        global.intake = {
            subject: { prefix: "VIP", length: 6 },
        };
    });

    test("accepts subject with correct prefix and digit suffix", () => {
        addSubject("VIP123");
        expect(validateField("subject", "Enter subject.")).toBe("VIP123");
    });

    test("rejects subject missing the prefix", () => {
        addSubject("ABC123");
        expect(validateField("subject", "Enter subject.")).toBeNull();
        expect(window.validateAlerts[0]).toMatch(/must begin with VIP/);
    });

    test("rejects subject that is the wrong length", () => {
        addSubject("VIP12");
        expect(validateField("subject", "Enter subject.")).toBeNull();
        expect(window.validateAlerts[0]).toMatch(/exactly 6 characters/);
    });

    test("rejects subject where suffix contains non-digits", () => {
        addSubject("VIPABC");
        expect(validateField("subject", "Enter subject.")).toBeNull();
        expect(window.validateAlerts[0]).toMatch(/digits after VIP/);
    });
});

// ---------------------------------------------------------------------------

describe("validateField — date of birth", () => {
    function addDob(value) {
        const el = document.createElement("input");
        el.id = "dob";
        el.type = "date";
        el.value = value;
        document.body.appendChild(el);
    }

    test("returns age in months for a valid past date", () => {
        // Use a date far enough in the past to guarantee positive months
        addDob("2000-01-01");
        const result = validateField("dob", "Enter DOB.");
        expect(result).toBeGreaterThan(0);
    });

    test("returns null and alerts for a future date", () => {
        addDob("2099-01-01");
        expect(validateField("dob", "Enter DOB.")).toBeNull();
        expect(window.validateAlerts).toContain("Date of birth cannot be in the future.");
    });

    test("returns a number when birth day > 15 (extra month added)", () => {
        // Born on day 20 (> 15) — verifies the +1 month path runs without error
        addDob("1990-06-20");
        const result = validateField("dob", "Enter DOB.");
        expect(typeof result).toBe("number");
        expect(result).toBeGreaterThan(0);
    });

    test("returns null and alerts for an invalid date string", () => {
        // Use type="text" — type="date" inputs sanitise invalid values to "",
        // which triggers the empty-field guard before the date-parse check.
        const el = document.createElement("input");
        el.id = "dob";
        el.type = "text";
        el.value = "not-a-date";
        document.body.appendChild(el);
        expect(validateField("dob", "Enter DOB.")).toBeNull();
        expect(window.validateAlerts).toContain("Invalid date of birth.");
    });

    test("returns 0 (not negative) for a date of today", () => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        addDob(`${yyyy}-${mm}-${dd}`);
        const result = validateField("dob", "Enter DOB.");
        expect(result).toBeGreaterThanOrEqual(0);
    });
});

// ---------------------------------------------------------------------------

describe("validateRadio", () => {
    function buildRadioGroup(name, values, checkedValue = null) {
        values.forEach((v) => {
            const input = document.createElement("input");
            input.type = "radio";
            input.name = name;
            input.value = v;
            if (v === checkedValue) input.checked = true;
            document.body.appendChild(input);
        });
    }

    test("returns null and adds alert when nothing is checked", () => {
        buildRadioGroup("sex", ["M", "F"]);
        expect(validateRadio("sex", "Please select sex.")).toBeNull();
        expect(window.validateAlerts).toContain("Please select sex.");
    });

    test("returns the checked value", () => {
        buildRadioGroup("sex", ["M", "F"], "F");
        expect(validateRadio("sex", "Please select sex.")).toBe("F");
        expect(window.validateAlerts).toHaveLength(0);
    });

    test("sets window.handedness and window.antihandedness for handedness group", () => {
        buildRadioGroup("handedness", ["left", "right"], "right");
        validateRadio("handedness", "Select hand.");
        expect(window.handedness).toBe("right");
        expect(window.antihandedness).toBe("left");
    });

    test("antihandedness is 'right' when handedness is 'left'", () => {
        buildRadioGroup("handedness", ["left", "right"], "left");
        validateRadio("handedness", "Select hand.");
        expect(window.handedness).toBe("left");
        expect(window.antihandedness).toBe("right");
    });

    test("does not set handedness globals for non-handedness groups", () => {
        delete window.handedness;
        buildRadioGroup("sex", ["M", "F"], "M");
        validateRadio("sex", "Select sex.");
        expect(window.handedness).toBeUndefined();
    });

    test("returns null and adds alert when group has no radio buttons at all", () => {
        expect(validateRadio("nonexistent", "Field required.")).toBeNull();
        expect(window.validateAlerts).toHaveLength(1);
    });
});
