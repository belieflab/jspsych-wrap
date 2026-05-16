var jsPsychSurveyMultiChoiceTouch = (function (jspsych) {
  "use strict";

  const info = {
      name: "survey-multi-choice-touch",
      parameters: {
          /**
           * Array containing objects with parameters for the questions.
           */
          questions: {
              type: jspsych.ParameterType.COMPLEX,
              array: true,
              pretty_name: "Questions",
              default: undefined,
              nested: {
                  /** The HTML string to be displayed as the question prompt. */
                  prompt: {
                      type: jspsych.ParameterType.HTML_STRING,
                      pretty_name: "Prompt",
                      default: undefined,
                  },
                  /** Array of strings for the multiple-choice options. */
                  options: {
                      type: jspsych.ParameterType.STRING,
                      pretty_name: "Options",
                      array: true,
                      default: undefined,
                  },
                  /** Whether a response to this question is required. */
                  required: {
                      type: jspsych.ParameterType.BOOL,
                      pretty_name: "Required",
                      default: false,
                  },
                  /** Whether the options should appear in a horizontal line. */
                  horizontal: {
                      type: jspsych.ParameterType.BOOL,
                      pretty_name: "Horizontal",
                      default: false,
                  },
                  /** The name of this question (used for data storage). */
                  name: {
                      type: jspsych.ParameterType.STRING,
                      pretty_name: "Question Name",
                      default: "",
                  },
              },
          },
          /**
           * If true, the order of the questions will be randomized.
           */
          randomize_question_order: {
              type: jspsych.ParameterType.BOOL,
              pretty_name: "Randomize Question Order",
              default: false,
          },
          /**
           * HTML string to display at the top of the page above all the questions.
           */
          preamble: {
              type: jspsych.ParameterType.HTML_STRING,
              pretty_name: "Preamble",
              default: null,
          },
          /**
           * Label of the button to submit responses.
           */
          button_label: {
              type: jspsych.ParameterType.STRING,
              pretty_name: "Button label",
              default: "Continue",
          },
          /**
           * Array containing the key(s) the subject is allowed to press to respond to the stimulus.
           */
          choices: {
              type: jspsych.ParameterType.KEYS,
              pretty_name: "Choices",
              default: "ALL_KEYS",
          },
      },
  };

  /**
   * **survey-multi-choice-touch**
   *
   * jsPsych plugin for multiple choice survey questions with touch support
   *
   * @author Shane Martin (original)
   * @see {@link https://www.jspsych.org/plugins/jspsych-survey-multi-choice/ survey-multi-choice plugin documentation on jspsych.org}
   */
  class SurveyMultiChoiceTouchPlugin {
      constructor(jsPsych) {
          this.jsPsych = jsPsych;
          this.lastResponseTime = Date.now(); // Initialize lastResponseTime to now
          this.acceptResponse = true; // Initially accept responses
          this.cooldownTimer = null; // Holds the reference to the cooldown timeout
      }

      trial(display_element, trial) {
          // Reset response state for new trial
          this.lastResponseTime = Date.now();
          this.acceptResponse = true;
          
          let html = "";

          // inject CSS for trial
          html += '<style id="jspsych-survey-multi-choice-css">';
          html +=
              ".jspsych-survey-multi-choice-question { margin-top: 2em; margin-bottom: 2em; text-align: center; }" +
              ".jspsych-survey-multi-choice-text span.required { color: red; font-size: 1.5em; margin-left: 3px; vertical-align: middle; display: inline-block;}" +
              ".jspsych-survey-multi-choice-horizontal .jspsych-survey-multi-choice-text { text-align: center; }" +
              ".jspsych-survey-multi-choice-option { line-height: 2; position: relative; }" +
              ".jspsych-survey-multi-choice-horizontal .jspsych-survey-multi-choice-option { display: inline-block; margin-left: 1em; margin-right: 1em; vertical-align: top; }" +
              "label.jspsych-survey-multi-choice-text input[type='radio'] { margin-right: 1em; }" +
              
              // Enhanced touch styles with visible radio buttons
              ".jspsych-survey-multi-choice-option { cursor: pointer; }" +
              ".jspsych-survey-multi-choice-option.selected { background-color: rgba(0,0,0,0.05); border-radius: 5px; }" +
              ".jspsych-survey-multi-choice-horizontal .jspsych-survey-multi-choice-option { padding: 10px; border: 1px solid transparent; }" +
              
              // Radio button visualization
              ".jspsych-survey-multi-choice-option::before { content: ''; display: inline-block; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #ccc; margin-right: 10px; vertical-align: middle; }" +
              ".jspsych-survey-multi-choice-option.selected::before { border-color: #555; background-color: #fff; box-shadow: inset 0 0 0 5px #fff, inset 0 0 0 7px #555; }" +
              
              // Hide the actual radio buttons
              ".jspsych-survey-multi-choice-option input[type='radio'] { display: none; }" +
              
              // Style for the submit button
              ".jspsych-btn { padding: 12px 20px; font-size: 1.2em; margin-top: 20px; }" +
              
              // Center the submit button
              "#jspsych-survey-multi-choice-next { display: block; margin: 20px auto; }";
          html += "</style>";

          // show preamble text
          if (trial.preamble !== null) {
              html +=
                  '<div id="jspsych-survey-multi-choice-preamble" class="jspsych-survey-multi-choice-preamble">' +
                  trial.preamble +
                  "</div>";
          }

          // form element
          html += '<form id="jspsych-survey-multi-choice-form">';

          // generate question order
          let question_order = [];
          for (let i = 0; i < trial.questions.length; i++) {
              question_order.push(i);
          }
          if (trial.randomize_question_order) {
              question_order = this.jsPsych.randomization.shuffle(question_order);
          }

          // add multiple-choice questions
          for (let i = 0; i < trial.questions.length; i++) {
              // get question based on question_order
              let question = trial.questions[question_order[i]];
              let question_id = question_order[i];

              // create question container
              let question_classes = ["jspsych-survey-multi-choice-question"];
              if (question.horizontal) {
                  question_classes.push("jspsych-survey-multi-choice-horizontal");
              }

              html +=
                  '<div id="jspsych-survey-multi-choice-' +
                  question_id +
                  '" class="' +
                  question_classes.join(" ") +
                  '"  data-name="' +
                  question.name +
                  '">';

              // add question text with red star asterisk right next to prompt
              html += '<p class="jspsych-survey-multi-choice-text survey-multi-choice">' + question.prompt;
              if (question.required) {
                  html += "<span class='required'>*</span>";
              }
              html += "</p>";

              // create option radio buttons
              for (let j = 0; j < question.options.length; j++) {
                  // add label and question text
                  let option_id_name = "jspsych-survey-multi-choice-option-" + question_id + "-" + j;
                  let input_name = "jspsych-survey-multi-choice-response-" + question_id;
                  let input_id = "jspsych-survey-multi-choice-response-" + question_id + "-" + j;

                  let required_attr = question.required ? "required" : "";

                  // add radio button container
                  html +=
                      '<div id="' +
                      option_id_name +
                      '" class="jspsych-survey-multi-choice-option" data-input-id="' +
                      input_id +
                      '" data-input-name="' +
                      input_name +
                      '">';
                  html +=
                      '<label class="jspsych-survey-multi-choice-text" for="' +
                      input_id +
                      '">' + 
                      question.options[j] +
                      "</label>";
                  html +=
                      '<input type="radio" name="' +
                      input_name +
                      '" id="' +
                      input_id +
                      '" value="' +
                      question.options[j] +
                      '" ' +
                      required_attr +
                      "></input>";
                  html += "</div>";
              }

              html += "</div>";
          }

          // add submit button
          html +=
              '<input type="submit" id="jspsych-survey-multi-choice-next" class="jspsych-survey-multi-choice jspsych-btn"' +
              (trial.button_label ? ' value="' + trial.button_label + '"' : "") +
              "></input>";
          html += "</form>";

          // render
          display_element.innerHTML = html;

          // Add touch/click event listeners to options
          const options = display_element.querySelectorAll(".jspsych-survey-multi-choice-option");
          for (let i = 0; i < options.length; i++) {
              options[i].addEventListener("click", (event) => {
                  if (!this.acceptResponse) {
                      return; // Exit if we're not accepting responses
                  }

                  const currentTime = Date.now();
                  const timeSinceLastResponse = currentTime - this.lastResponseTime;

                  if (timeSinceLastResponse < 150) {
                      // Anti-button mashing protection
                      this.acceptResponse = false;
                      
                      clearTimeout(this.cooldownTimer);
                      this.cooldownTimer = setTimeout(() => {
                          this.acceptResponse = true;
                          this.lastResponseTime = Date.now();
                      }, 150);
                      
                      return;
                  }

                  this.lastResponseTime = currentTime;

                  const targetElement = event.currentTarget;
                  const inputId = targetElement.getAttribute("data-input-id");
                  const inputName = targetElement.getAttribute("data-input-name");

                  // First, deselect all options in this group
                  const optionsInGroup = display_element.querySelectorAll(
                      '[data-input-name="' + inputName + '"]'
                  );
                  for (let j = 0; j < optionsInGroup.length; j++) {
                      optionsInGroup[j].classList.remove("selected");
                      document.getElementById(
                          optionsInGroup[j].getAttribute("data-input-id")
                      ).checked = false;
                  }

                  // Then select this option
                  targetElement.classList.add("selected");
                  document.getElementById(inputId).checked = true;
              });
          }

          // Add submit event listener
          const startTime = performance.now();
          display_element.querySelector("#jspsych-survey-multi-choice-form").addEventListener("submit", (event) => {
              event.preventDefault();
              
              if (!this.acceptResponse) {
                  return; // Exit if we're not accepting responses
              }
              
              const currentTime = Date.now();
              const timeSinceLastResponse = currentTime - this.lastResponseTime;
              
              if (timeSinceLastResponse < 150) {
                  // Anti-button mashing protection
                  this.acceptResponse = false;
                  
                  clearTimeout(this.cooldownTimer);
                  this.cooldownTimer = setTimeout(() => {
                      this.acceptResponse = true;
                      this.lastResponseTime = Date.now();
                  }, 150);
                  
                  return;
              }
              
              this.lastResponseTime = currentTime;

              // measure response time
              const endTime = performance.now();
              const response_time = endTime - startTime;

              // create object to hold responses
              const response = {};
              for (let i = 0; i < trial.questions.length; i++) {
                  const match = display_element.querySelector("#jspsych-survey-multi-choice-" + i);
                  let val = "";
                  if (match.querySelector("input[type=radio]:checked") !== null) {
                      val = match.querySelector("input[type=radio]:checked").value;
                  }
                  
                  let name = match.getAttribute("data-name");
                  if (!name || name === "") {
                      name = "Q" + i;
                  }
                  response[name] = val;
              }

              // save data
              const trial_data = {
                  rt: response_time,
                  response: response,
                  question_order: question_order,
              };

              // clear the display
              display_element.innerHTML = "";

              // finish trial
              this.jsPsych.finishTrial(trial_data);
          });

          // Start keyboard listener if trial specifies valid keyboard responses
          if (trial.choices != "NO_KEYS") {
              this.jsPsych.pluginAPI.getKeyboardResponse({
                  callback_function: (info) => {
                      if (!this.acceptResponse) {
                          return; // Exit if we're not accepting responses
                      }

                      const currentTime = Date.now();
                      const timeSinceLastResponse = currentTime - this.lastResponseTime;

                      if (timeSinceLastResponse < 150) {
                          // Anti-button mashing protection
                          this.acceptResponse = false;
                          this.jsPsych.pluginAPI.cancelAllKeyboardResponses();

                          clearTimeout(this.cooldownTimer);
                          this.cooldownTimer = setTimeout(() => {
                              this.acceptResponse = true;
                              this.lastResponseTime = Date.now();
                              
                              // Restart keyboard listener
                              this.jsPsych.pluginAPI.getKeyboardResponse({
                                  callback_function: this.after_response,
                                  valid_responses: trial.choices,
                                  rt_method: "performance",
                                  persist: false,
                                  allow_held_key: false,
                              });
                          }, 150);

                          return;
                      }

                      this.lastResponseTime = currentTime;
                      
                      // Submit the form on valid keypress
                      display_element.querySelector("#jspsych-survey-multi-choice-next").click();
                  },
                  valid_responses: trial.choices,
                  rt_method: "performance",
                  persist: false,
                  allow_held_key: false,
              });
          }
      }

      simulate(trial, simulation_mode, simulation_options, load_callback) {
          if (simulation_mode == "data-only") {
              load_callback();
              this.simulate_data_only(trial, simulation_options);
          }
          if (simulation_mode == "visual") {
              this.simulate_visual(trial, simulation_options, load_callback);
          }
      }

      create_simulation_data(trial, simulation_options) {
          const question_data = {};
          for (const q of trial.questions) {
              const name = q.name ? q.name : `Q${trial.questions.indexOf(q)}`;
              question_data[name] = this.jsPsych.randomization.sampleWithoutReplacement(q.options, 1)[0];
          }

          const default_data = {
              response: question_data,
              rt: this.jsPsych.randomization.sampleExGaussian(2000, 200, 1/200, true),
              question_order: [...Array(trial.questions.length).keys()],
          };

          const data = this.jsPsych.pluginAPI.mergeSimulationData(default_data, simulation_options);
          this.jsPsych.pluginAPI.ensureSimulationDataConsistency(trial, data);
          return data;
      }

      simulate_data_only(trial, simulation_options) {
          const data = this.create_simulation_data(trial, simulation_options);
          this.jsPsych.finishTrial(data);
      }

      simulate_visual(trial, simulation_options, load_callback) {
          const data = this.create_simulation_data(trial, simulation_options);
          const display_element = this.jsPsych.getDisplayElement();

          this.trial(display_element, trial);
          load_callback();

          // Simulate clicking on options
          for (const q in data.response) {
              const question_index = trial.questions.findIndex(question => 
                  (question.name === q) || (question.name === "" && q.includes("Q"))
              );
              if (question_index >= 0) {
                  const option_index = trial.questions[question_index].options.indexOf(data.response[q]);
                  if (option_index >= 0) {
                      const option_element = display_element.querySelector(
                          `#jspsych-survey-multi-choice-option-${question_index}-${option_index}`
                      );
                      if (option_element) {
                          this.jsPsych.pluginAPI.clickTarget(option_element);
                      }
                  }
              }
          }

          // Submit the form after a delay
          setTimeout(() => {
              const submit_button = display_element.querySelector("input[type=submit]");
              if (submit_button) {
                  this.jsPsych.pluginAPI.clickTarget(submit_button);
              }
          }, data.rt);
      }
  }
  SurveyMultiChoiceTouchPlugin.info = info;

  return SurveyMultiChoiceTouchPlugin;
})(jsPsychModule);