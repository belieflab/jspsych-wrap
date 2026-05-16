import type { Request } from "express";

export type ParticipantIds = {
    workerId: string | undefined;
    PROLIFIC_PID: string | undefined;
    participantId: string | undefined;
    src_subject_id: string | undefined;
    ID: string | undefined;
    subjectId: string | undefined;
    studyId: string | undefined;
    candidateId: string | undefined;
    subjectkey: string | undefined;
    sex: string | undefined;
    site: string | undefined;
    subsiteid: string | undefined;
    interview_age: string | undefined;
    phenotype: string | undefined;
    visit: string | undefined;
    week: string | undefined;
    arm: string | undefined;
};

export type FormType = "start" | "nda" | "intake";

function str(v: Request["query"][string]): string | undefined {
    return typeof v === "string" && v !== "" ? v : undefined;
}

export function parseIds(query: Request["query"]): ParticipantIds {
    const workerId      = str(query.workerId);
    const PROLIFIC_PID  = str(query.PROLIFIC_PID);
    const participantId = str(query.participantId);
    const src_subject_id = str(query.src_subject_id);
    const ID            = str(query.ID);

    const subjectId = workerId ?? PROLIFIC_PID ?? participantId ?? src_subject_id ?? ID;

    return {
        workerId,
        PROLIFIC_PID,
        participantId,
        src_subject_id,
        ID,
        subjectId,
        studyId:       str(query.studyId),
        candidateId:   str(query.candidateId),
        subjectkey:    str(query.subjectkey),
        sex:           str(query.sex),
        site:          str(query.site),
        subsiteid:     str(query.subsiteid),
        interview_age: str(query.interview_age),
        phenotype:     str(query.phenotype),
        visit:         str(query.visit),
        week:          str(query.week),
        arm:           str(query.arm),
    };
}

export function getFormType(ids: ParticipantIds): FormType {
    if (ids.workerId || ids.PROLIFIC_PID || ids.participantId) return "start";
    if (ids.src_subject_id || ids.ID) return "nda";
    return "intake";
}
