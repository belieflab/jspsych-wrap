var jsPsychTouchResponse = (function (jspsych) {
    "use strict";

    const info = {
        name: "touch-response",
        parameters: {
            /**
             * The HTML string to be displayed.
             */
            stimulus: {
                type: jspsych.ParameterType.HTML_STRING,
                pretty_name: "Stimulus",
                default: undefined,
            },
            /**
             * Array containing the key(s) the subject is allowed to press to respond to the stimulus.
             */
            choices: {
                type: jspsych.ParameterType.KEYS,
                pretty_name: "Choices",
                default: "ALL_KEYS",
            },
            /**
             * Any content here will be displayed below the stimulus.
             */
            prompt: {
                type: jspsych.ParameterType.HTML_STRING,
                pretty_name: "Prompt",
                default: null,
            },
            /**
             * How long to show the stimulus.
             */
            stimulus_duration: {
                type: jspsych.ParameterType.INT,
                pretty_name: "Stimulus duration",
                default: null,
            },
            /**
             * How long to show trial before it ends.
             */
            trial_duration: {
                type: jspsych.ParameterType.INT,
                pretty_name: "Trial duration",
                default: null,
            },
            /**
             * If true, trial will end when subject makes a response.
             */
            response_ends_trial: {
                type: jspsych.ParameterType.BOOL,
                pretty_name: "Response ends trial",
                default: true,
            },
            /**
             * IDs of the touch-responsive elements
             */
            touch_elements: {
                type: jspsych.ParameterType.STRING,
                pretty_name: "Touch elements",
                array: true,
                default: [],
            },
            /**
             * If true, touching anywhere on the screen will register as response "0"
             */
            allow_screen_touch: {
                type: jspsych.ParameterType.BOOL,
                pretty_name: "Allow screen touch",
                default: false,
            },
        },
    };

    /**
     * **touch-response**
     *
     * jsPsych plugin for displaying a stimulus and getting touch or keyboard responses
     *
     * @see {@link https://www.jspsych.org/plugins/jspsych-html-keyboard-response/ html-keyboard-response plugin documentation on jspsych.org}
     */
    class TouchResponsePlugin {
        constructor(jsPsych) {
            this.jsPsych = jsPsych;
            this.lastResponseTime = Date.now(); // Initialize lastResponseTime to now
            this.acceptResponse = true; // Initially accept responses
            this.cooldownTimer = null; // Holds the reference to the cooldown timeout
        }

        // Method to start or restart the keyboard listener
        startKeyboardListener(callback_function, valid_responses) {
            return this.jsPsych.pluginAPI.getKeyboardResponse({
                callback_function: callback_function,
                valid_responses: valid_responses,
                rt_method: "performance",
                persist: false,
                allow_held_key: false,
            });
        }

        trial(display_element, trial) {
            // Record start time
            const startTime = performance.now();
            
            var new_html =
                '<div id="jspsych-touch-response-stimulus">' +
                trial.stimulus +
                "</div>";
            // add prompt
            if (trial.prompt !== null) {
                new_html += trial.prompt;
            }
            // draw
            display_element.innerHTML = new_html;

            // store response
            var response = {
                rt: null,
                key: null,
                touch_element: null
            };

            // function to end trial when it is time
            const end_trial = () => {
                // kill any remaining setTimeout handlers
                this.jsPsych.pluginAPI.clearAllTimeouts();

                // remove event listeners
                if (trial.touch_elements && trial.touch_elements.length > 0) {
                    trial.touch_elements.forEach((identifier) => {
                        // First try to find by ID
                        let elements = [display_element.querySelector('#' + identifier)];
                        
                        // If not found by ID, try to find by class
                        if (!elements[0]) {
                            elements = Array.from(display_element.querySelectorAll('.' + identifier));
                        }
                        
                        // Remove event listeners from all matching elements
                        elements.forEach(element => {
                            if (element) {
                                element.removeEventListener('click', imageClickHandler);
                                element.removeEventListener('touchend', imageTouchHandler);
                            }
                        });
                    });
                }

                if (trial.allow_screen_touch) {
                    document.removeEventListener('click', screenClickHandler);
                    document.removeEventListener('touchend', screenTouchHandler);
                    if (this.spaceBarListener) {
                        document.removeEventListener('keydown', this.spaceBarListener);
                    }
                }

                // Cancel any active keyboard listeners
                this.jsPsych.pluginAPI.cancelAllKeyboardResponses();

                // gather the data to store for the trial
                var trial_data = {
                    rt: response.rt,
                    stimulus: trial.stimulus,
                    response: response.key,
                    touch_element: response.touch_element
                };
                
                // clear the display
                display_element.innerHTML = "";
                
                // move on to the next trial
                this.jsPsych.finishTrial(trial_data);
            };

            // Process response, with cooldown check
            const processResponse = (info) => {
                if (!this.acceptResponse) {
                    return; // Exit if we're not accepting responses
                }

                var currentTime = Date.now();
                var timeSinceLastResponse = currentTime - this.lastResponseTime;

                if (timeSinceLastResponse < 150) {
                    // Button mashing/double tap detected, ignore
                    this.acceptResponse = false;
                    this.jsPsych.pluginAPI.cancelAllKeyboardResponses();

                    clearTimeout(this.cooldownTimer);
                    this.cooldownTimer = setTimeout(() => {
                        this.acceptResponse = true;
                        this.lastResponseTime = Date.now();
                        
                        // Restart keyboard listener
                        if (trial.choices != "NO_KEYS") {
                            this.startKeyboardListener(
                                after_response,
                                trial.choices
                            );
                        }
                    }, 150);

                    return;
                }

                this.lastResponseTime = currentTime; // Update lastResponseTime for valid responses

                // after a valid response, the stimulus will have the CSS class 'responded'
                const stimulusElement = display_element.querySelector("#jspsych-touch-response-stimulus");
                if (stimulusElement) {
                    stimulusElement.className += " responded";
                }

                // only record the first response
                if (response.key == null) {
                    response = info;
                }
                
                if (trial.response_ends_trial) {
                    end_trial();
                }
            };

            // Function for keyboard responses
            var after_response = (info) => {
                processResponse(info);
            };

            // Function to handle touch element clicks
            var imageClickHandler = function(e) {
                e.stopPropagation(); // Prevent triggering the screen-wide click handler
                
                let elementId = e.currentTarget.id;
                let elementClass = null;
                
                // If no id, try to get the class that matches one of our touch_elements
                if (!elementId || trial.touch_elements.indexOf(elementId) === -1) {
                    // Check if any of the element's classes match our touch_elements
                    for (let i = 0; i < e.currentTarget.classList.length; i++) {
                        let className = e.currentTarget.classList[i];
                        if (trial.touch_elements.indexOf(className) > -1) {
                            elementClass = className;
                            break;
                        }
                    }
                }
                
                const elementIdentifier = elementId || elementClass;
                const elementIndex = trial.touch_elements.indexOf(elementIdentifier);
                
                if (elementIndex > -1) {
                    const responseInfo = {
                        rt: performance.now() - startTime,  // FIX: Subtract startTime
                        key: (elementIndex + 1).toString(), // Convert to 1, 2, or 3
                        touch_element: elementIdentifier
                    };
                    
                    processResponse(responseInfo);
                }
            };

            // Function to handle touch element touches
            var imageTouchHandler = function(e) {
                e.preventDefault(); // Prevent scrolling
                e.stopPropagation(); // Prevent triggering the screen-wide touch handler
                imageClickHandler(e);
            };

            // Function to handle screen-wide click
            var screenClickHandler = function(e) {
                // Process any click on the display when screen touch is allowed
                const responseInfo = {
                    rt: performance.now() - startTime,  // FIX: Subtract startTime
                    key: "0", // Full screen touch is coded as "0"
                    touch_element: null
                };
                
                processResponse(responseInfo);
                
                // Prevent default behavior that might interfere
                e.preventDefault();
                e.stopPropagation();
            };

            // Function to handle screen-wide touch
            var screenTouchHandler = function(e) {
                e.preventDefault(); // Prevent scrolling
                screenClickHandler(e);
            };

            // Add click and touch event listeners to each specified element
            if (trial.touch_elements && trial.touch_elements.length > 0) {
                trial.touch_elements.forEach((identifier) => {
                    // First try to find by ID
                    let elements = [display_element.querySelector('#' + identifier)];
                    
                    // If not found by ID, try to find by class
                    if (!elements[0]) {
                        elements = Array.from(display_element.querySelectorAll('.' + identifier));
                    }
                    
                    // Add event listeners to all matching elements
                    elements.forEach(element => {
                        if (element) {
                            element.addEventListener('click', imageClickHandler);
                            element.addEventListener('touchend', imageTouchHandler);
                            // Make it obvious these are clickable
                            element.style.cursor = 'pointer';
                        }
                    });
                });
            }

            // Add screen-wide touch listener if enabled
            if (trial.allow_screen_touch) {
                // Add event listener to the entire document to catch all clicks
                document.addEventListener('click', screenClickHandler);
                document.addEventListener('touchend', screenTouchHandler);
                
                // Also explicitly listen for space bar presses
                const spaceBarListener = function(e) {
                    if (e.code === 'Space' || e.keyCode === 32) {
                        const responseInfo = {
                            rt: performance.now() - startTime,  // FIX: Subtract startTime
                            key: "0", // Space bar is also coded as "0"
                            touch_element: null
                        };
                        processResponse(responseInfo);
                        e.preventDefault(); // Prevent scrolling
                    }
                };
                document.addEventListener('keydown', spaceBarListener);
                
                // Store the listener reference for cleanup
                this.spaceBarListener = spaceBarListener;
                
                // Make it obvious the screen is clickable
                display_element.style.cursor = 'pointer';
            }

            // start the response listener for keyboard
            if (trial.choices != "NO_KEYS") {
                var keyboardListener =
                    this.jsPsych.pluginAPI.getKeyboardResponse({
                        callback_function: after_response,
                        valid_responses: trial.choices,
                        rt_method: "performance",
                        persist: false,
                        allow_held_key: false,
                    });
            }

            // hide stimulus if stimulus_duration is set
            if (trial.stimulus_duration !== null) {
                this.jsPsych.pluginAPI.setTimeout(() => {
                    const stimulusElement = display_element.querySelector("#jspsych-touch-response-stimulus");
                    if (stimulusElement) {
                        stimulusElement.style.visibility = "hidden";
                    }
                }, trial.stimulus_duration);
            }
            
            // end trial if trial_duration is set
            if (trial.trial_duration !== null) {
                this.jsPsych.pluginAPI.setTimeout(
                    end_trial,
                    trial.trial_duration
                );
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
            const default_data = {
                stimulus: trial.stimulus,
                rt: this.jsPsych.randomization.sampleExGaussian(
                    500,
                    50,
                    1 / 150,
                    true
                ),
                response: this.jsPsych.pluginAPI.getValidKey(trial.choices),
                touch_element: null
            };
            const data = this.jsPsych.pluginAPI.mergeSimulationData(
                default_data,
                simulation_options
            );
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
            if (data.rt !== null) {
                this.jsPsych.pluginAPI.pressKey(data.response, data.rt);
            }
        }
    }
    TouchResponsePlugin.info = info;

    return TouchResponsePlugin;
})(jsPsychModule);