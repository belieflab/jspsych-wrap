"use strict";

// ids.js — client-side participant identity and form selection (compiled from src/client/ids.ts)

function getParam(name) {
    const safe = name.replace(/[[\]]/g, "\\$&");
    const regex = new RegExp("[?&]" + safe + "=([^&#]*)");
    const result = regex.exec(window.location.href);
    if (!result) return undefined;
    const value = decodeURIComponent(result[1].replace(/\+/g, " "));
    return value !== "" ? value : undefined;
}

const _d = new Date();
const _dd = String(_d.getDate()).padStart(2, "0");
const _mm = String(_d.getMonth() + 1).padStart(2, "0");
const _yyyy = _d.getFullYear();
window.isoDate        = `${_yyyy}-${_mm}-${_dd}`;
window.interview_date = `${_mm}/${_dd}/${_yyyy}`;

window.workerId       = getParam("workerId");
window.PROLIFIC_PID   = getParam("PROLIFIC_PID");
window.participantId  = getParam("participantId");
window.src_subject_id = getParam("src_subject_id");
window.ID             = getParam("ID");
window.subjectId      = window.workerId ?? window.PROLIFIC_PID ?? window.participantId ?? window.src_subject_id ?? window.ID;

window.subjectkey     = getParam("subjectkey");
window.sex            = getParam("sex");
window.site           = getParam("site");
window.subsiteid      = getParam("subsiteid");
window.interview_age  = getParam("interview_age");
window.phenotype      = getParam("phenotype");
window.visit          = getParam("visit");
window.week           = getParam("week");
window.arm            = getParam("arm");
window.studyId        = getParam("studyId");

function selectForm() {
    let formId;
    if (window.workerId || window.PROLIFIC_PID || window.participantId) {
        formId = "form-start";
    } else if (window.src_subject_id || window.ID) {
        formId = "form-nda";
    } else {
        formId = "form-intake";
    }
    const el = document.getElementById(formId);
    if (el) el.hidden = false;
}

document.addEventListener("DOMContentLoaded", selectForm);

window.writeCandidateKeys = function (data) {
    if (window.src_subject_id) {
        data.src_subject_id  = window.src_subject_id;
        data.interview_date  = window.interview_date;
        if (window.subjectkey)    data.subjectkey    = window.subjectkey;
        if (window.sex)           data.sex           = window.sex;
        if (window.site)          data.site          = window.site;
        if (window.phenotype)     data.phenotype     = window.phenotype;
        if (window.interview_age) data.interview_age = window.interview_age;
        if (window.subsiteid)     data.subsiteid     = window.subsiteid;
        if (window.visit)         data.visit         = window.visit;
        if (window.week)          data.week          = window.week;
        if (window.arm)           data.arm           = window.arm;
    }
    if (window.ID) {
        data.ID = window.ID;
        data.date = window.isoDate;
        if (window.studyId) data.studyId = window.studyId;
        if (window.arm)     data.arm     = window.arm;
        if (window.visit)   data.visit   = window.visit;
    }
    for (const key of ["workerId", "PROLIFIC_PID", "participantId"]) {
        if (window[key]) {
            data[key]           = window[key];
            data.interview_date = window.interview_date;
            if (window.visit) data.visit = window.visit;
            if (window.week)  data.week  = window.week;
            if (window.arm)   data.arm   = window.arm;
        }
    }
};
