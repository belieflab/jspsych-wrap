"use strict";

timeline.push(preload);
timeline.push(config);
timeline.push(welcome);
timeline.push(instruction1);
timeline.push(procedure);
timeline.push(dataSave);

if (subjectId) {
    jsPsych.run(timeline);
}
