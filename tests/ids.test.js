"use strict";

// Functions under test — extracted from client/lib/ids.js.

function getParam(name, href = window.location.href) {
    const safe = name.replace(/[[\]]/g, "\\$&");
    const regex = new RegExp("[?&]" + safe + "=([^&#]*)");
    const result = regex.exec(href);
    if (!result) return undefined;
    const value = decodeURIComponent(result[1].replace(/\+/g, " "));
    return value !== "" ? value : undefined;
}

function resolveSubjectId(ids) {
    return ids.workerId ?? ids.PROLIFIC_PID ?? ids.participantId ?? ids.src_subject_id ?? ids.ID;
}

function selectForm(ids) {
    if (ids.workerId || ids.PROLIFIC_PID || ids.participantId) return "form-start";
    if (ids.src_subject_id || ids.ID) return "form-nda";
    return "form-intake";
}

function writeCandidateKeys(data, win) {
    if (win.src_subject_id) {
        data.src_subject_id  = win.src_subject_id;
        data.interview_date  = win.interview_date;
        if (win.subjectkey)    data.subjectkey    = win.subjectkey;
        if (win.sex)           data.sex           = win.sex;
        if (win.site)          data.site          = win.site;
        if (win.phenotype)     data.phenotype     = win.phenotype;
        if (win.interview_age) data.interview_age = win.interview_age;
        if (win.subsiteid)     data.subsiteid     = win.subsiteid;
        if (win.visit)         data.visit         = win.visit;
        if (win.week)          data.week          = win.week;
        if (win.arm)           data.arm           = win.arm;
    }
    if (win.ID) {
        data.ID   = win.ID;
        data.date = win.isoDate;
        if (win.studyId) data.studyId = win.studyId;
        if (win.arm)     data.arm     = win.arm;
        if (win.visit)   data.visit   = win.visit;
    }
    for (const key of ["workerId", "PROLIFIC_PID", "participantId"]) {
        if (win[key]) {
            data[key]           = win[key];
            data.interview_date = win.interview_date;
            if (win.visit) data.visit = win.visit;
            if (win.week)  data.week  = win.week;
            if (win.arm)   data.arm   = win.arm;
        }
    }
}

// ---------------------------------------------------------------------------

describe("getParam", () => {
    test("returns undefined when param is absent", () => {
        expect(getParam("workerId", "http://localhost/?foo=bar")).toBeUndefined();
    });

    test("returns value when param is present", () => {
        expect(getParam("workerId", "http://localhost/?workerId=ABC123")).toBe("ABC123");
    });

    test("returns undefined for empty param value", () => {
        expect(getParam("workerId", "http://localhost/?workerId=")).toBeUndefined();
    });

    test("decodes percent-encoded values", () => {
        expect(getParam("workerId", "http://localhost/?workerId=hello%20world")).toBe("hello world");
    });

    test("converts plus signs to spaces", () => {
        expect(getParam("workerId", "http://localhost/?workerId=hello+world")).toBe("hello world");
    });

    test("handles PROLIFIC_PID", () => {
        expect(getParam("PROLIFIC_PID", "http://localhost/?PROLIFIC_PID=PID123")).toBe("PID123");
    });

    test("handles participantId", () => {
        expect(getParam("participantId", "http://localhost/?participantId=REDCap001")).toBe("REDCap001");
    });

    test("handles src_subject_id", () => {
        expect(getParam("src_subject_id", "http://localhost/?src_subject_id=NDAR123")).toBe("NDAR123");
    });

    test("handles ID", () => {
        expect(getParam("ID", "http://localhost/?ID=CPCR001")).toBe("CPCR001");
    });

    test("is case-sensitive", () => {
        expect(getParam("workerid", "http://localhost/?workerId=ABC")).toBeUndefined();
    });

    test("returns first match when param appears multiple times", () => {
        expect(getParam("workerId", "http://localhost/?workerId=FIRST&workerId=SECOND")).toBe("FIRST");
    });
});

// ---------------------------------------------------------------------------

describe("resolveSubjectId", () => {
    test("workerId takes priority over all others", () => {
        expect(resolveSubjectId({
            workerId: "W1", PROLIFIC_PID: "P1", participantId: "R1", src_subject_id: "N1", ID: "I1",
        })).toBe("W1");
    });

    test("PROLIFIC_PID used when no workerId", () => {
        expect(resolveSubjectId({
            workerId: undefined, PROLIFIC_PID: "P1", participantId: "R1",
        })).toBe("P1");
    });

    test("participantId used when no workerId or PROLIFIC_PID", () => {
        expect(resolveSubjectId({
            workerId: undefined, PROLIFIC_PID: undefined, participantId: "R1",
        })).toBe("R1");
    });

    test("src_subject_id used when online identifiers absent", () => {
        expect(resolveSubjectId({
            workerId: undefined, PROLIFIC_PID: undefined, participantId: undefined, src_subject_id: "NDAR001", ID: "I1",
        })).toBe("NDAR001");
    });

    test("ID used when all others absent", () => {
        expect(resolveSubjectId({
            workerId: undefined, PROLIFIC_PID: undefined, participantId: undefined, src_subject_id: undefined, ID: "CPCR001",
        })).toBe("CPCR001");
    });

    test("returns undefined when all identifiers absent", () => {
        expect(resolveSubjectId({
            workerId: undefined, PROLIFIC_PID: undefined, participantId: undefined, src_subject_id: undefined, ID: undefined,
        })).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------

describe("selectForm", () => {
    test("shows form-start for workerId", () => {
        expect(selectForm({ workerId: "W1" })).toBe("form-start");
    });

    test("shows form-start for PROLIFIC_PID", () => {
        expect(selectForm({ PROLIFIC_PID: "P1" })).toBe("form-start");
    });

    test("shows form-start for participantId", () => {
        expect(selectForm({ participantId: "R1" })).toBe("form-start");
    });

    test("shows form-nda for src_subject_id", () => {
        expect(selectForm({ src_subject_id: "NDAR001" })).toBe("form-nda");
    });

    test("shows form-nda for ID", () => {
        expect(selectForm({ ID: "CPCR001" })).toBe("form-nda");
    });

    test("shows form-intake when no identifier present", () => {
        expect(selectForm({})).toBe("form-intake");
    });

    test("form-start takes priority over form-nda", () => {
        expect(selectForm({ workerId: "W1", src_subject_id: "NDAR001" })).toBe("form-start");
    });
});

// ---------------------------------------------------------------------------

describe("writeCandidateKeys", () => {
    const BASE_WIN = {
        interview_date: "05/16/2026",
        isoDate: "2026-05-16",
    };

    test("adds workerId and interview_date for MTurk participant", () => {
        const data = {};
        writeCandidateKeys(data, { ...BASE_WIN, workerId: "W1" });
        expect(data.workerId).toBe("W1");
        expect(data.interview_date).toBe("05/16/2026");
    });

    test("adds PROLIFIC_PID for Prolific participant", () => {
        const data = {};
        writeCandidateKeys(data, { ...BASE_WIN, PROLIFIC_PID: "P1" });
        expect(data.PROLIFIC_PID).toBe("P1");
        expect(data.interview_date).toBe("05/16/2026");
    });

    test("adds participantId for REDCap participant", () => {
        const data = {};
        writeCandidateKeys(data, { ...BASE_WIN, participantId: "R1" });
        expect(data.participantId).toBe("R1");
    });

    test("adds NDA fields for src_subject_id participant", () => {
        const data = {};
        writeCandidateKeys(data, {
            ...BASE_WIN,
            src_subject_id: "NDAR001",
            subjectkey: "SK1",
            sex: "M",
            site: "Yale",
            phenotype: "hc",
            interview_age: "300",
        });
        expect(data.src_subject_id).toBe("NDAR001");
        expect(data.subjectkey).toBe("SK1");
        expect(data.sex).toBe("M");
        expect(data.site).toBe("Yale");
        expect(data.phenotype).toBe("hc");
        expect(data.interview_age).toBe("300");
        expect(data.interview_date).toBe("05/16/2026");
    });

    test("adds ID and isoDate for Hopkins CPCR participant", () => {
        const data = {};
        writeCandidateKeys(data, { ...BASE_WIN, ID: "CPCR001", studyId: "S1" });
        expect(data.ID).toBe("CPCR001");
        expect(data.date).toBe("2026-05-16");
        expect(data.studyId).toBe("S1");
    });

    test("adds optional visit/week/arm when present for online participant", () => {
        const data = {};
        writeCandidateKeys(data, { ...BASE_WIN, workerId: "W1", visit: "2", week: "3", arm: "A" });
        expect(data.visit).toBe("2");
        expect(data.week).toBe("3");
        expect(data.arm).toBe("A");
    });

    test("omits optional NDA fields when absent", () => {
        const data = {};
        writeCandidateKeys(data, { ...BASE_WIN, src_subject_id: "NDAR001" });
        expect(data.subjectkey).toBeUndefined();
        expect(data.sex).toBeUndefined();
        expect(data.site).toBeUndefined();
    });

    test("does not modify data when no identifier present", () => {
        const data = { existing: "value" };
        writeCandidateKeys(data, { ...BASE_WIN });
        expect(data).toEqual({ existing: "value" });
    });
});
