var jsPsychColorWheel = (function(jsPsych) {
    "use strict";

    const info = {
        name: "color-wheel-rating",
        parameters: {
            stimulus: {
                type: jsPsych.ParameterType.STRING,
                pretty_name: "Stimulus",
                default: undefined,
                description: "The image or content to display above the color wheel."
            },
            prompt: {
                type: jsPsych.ParameterType.HTML_STRING,
                pretty_name: "Prompt",
                default: "What color does the object seem to be?",
                description: "The question or instruction displayed below the stimulus."
            },
            stimulus_duration: {
                type: jsPsych.ParameterType.INT,
                pretty_name: "Stimulus duration",
                default: null
            },
            trial_duration: {
                type: jsPsych.ParameterType.INT,
                pretty_name: "Trial duration",
                default: null
            },
            response_ends_trial: {
                type: jsPsych.ParameterType.BOOL,
                pretty_name: "Response ends trial",
                default: true
            },
            theme: {
                type: jsPsych.ParameterType.STRING,
                pretty_name: "Theme",
                default: "light",
                description: "The color theme to use. Can be 'light' or 'dark'."
            },
            stimulus_height: {
                type: jsPsych.ParameterType.STRING,
                pretty_name: "Stimulus height",
                default: "50vh",
                description: "The maximum height of the stimulus image (e.g., '50vh', '400px', '80%')."
            }
        }
    };

    class ColorWheelPlugin {
        constructor(jsPsych) {
            this.jsPsych = jsPsych;
        }

        trial(display_element, trial) {
            // Determine theme settings
            const isDarkTheme = trial.theme === "dark";
            
            // Theme-specific styles
            const themeStyles = {
                backgroundColor: isDarkTheme ? "#000" : "#fff",
                modalBackgroundColor: isDarkTheme ? "rgba(0, 0, 0, 0.8)" : "rgb(187, 187, 187)",
                modalContentBackgroundColor: isDarkTheme ? "#222" : "white",
                textColor: isDarkTheme ? "#ffffff" : "#2d3748",
                borderColor: isDarkTheme ? "#fff" : "#000",
                previewBorderColor: isDarkTheme ? "#444" : "#ccc",
                submitBtnStyle: isDarkTheme ? "background-color: #333; color: #fff; border: 1px solid #555;" : "",
                cursorIconColor: isDarkTheme ? "#cbd5e1" : "#64748b",
                bodyBackgroundColor: isDarkTheme ? "#000" : "inherit"
            };

            // Add modal styles
            const modalStyle = document.createElement('style');
            modalStyle.id = "jspsych-color-wheel-styles";
            modalStyle.textContent = `
                .jspsych-color-wheel-modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: transparent;
                    z-index: 1000;
                    pointer-events: none;
                }

                .jspsych-color-wheel-modal-content {
                    background-color: ${themeStyles.modalContentBackgroundColor};
                    padding: 10px;
                    border-radius: 8px;
                    position: relative;
                    text-align: center;
                    color: ${themeStyles.textColor};
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    pointer-events: auto;
                }

                .jspsych-color-wheel-close {
                    position: absolute;
                    right: 5px;
                    top: 5px;
                    font-size: 20px;
                    cursor: pointer;
                    background: none;
                    border: none;
                    padding: 2px 6px;
                    line-height: 1;
                    color: ${themeStyles.textColor};
                }

                .jspsych-color-wheel-stimulus {
                    cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23${isDarkTheme ? 'cbd5e1' : '64748b'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m2 22 1-1h3l9-9'%3E%3C/path%3E%3Cpath d='M3 21v-3l9-9'%3E%3C/path%3E%3Cpath d='m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l-3-3Z'%3E%3C/path%3E%3C/svg%3E") 2 2, pointer;
                }
                
                body {
                    background-color: ${themeStyles.bodyBackgroundColor};
                }
            `;
            document.head.appendChild(modalStyle);

            let html = `
                <div id="jspsych-color-wheel-container" style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0;
                    font-family: Arial, sans-serif;
                    background-color: ${themeStyles.backgroundColor};">
                    <div id="jspsych-color-wheel-stimulus" class="jspsych-color-wheel-stimulus" style="margin-top: -1rem;">
                        <img src="${trial.stimulus}" style="max-height: ${trial.stimulus_height}; width: auto; object-fit: contain;">
                    </div>

                    <div style="display: flex; align-items: center; gap: 1rem; margin-top: 1rem;">
                        <p id="jspsych-color-wheel-prompt" style="
                            font-size: 1.1rem;
                            color: ${themeStyles.textColor};
                            margin: 0;">
                            ${trial.prompt}
                        </p>
                        <button id="show-color-wheel" class="jspsych-btn" style="
                            padding: 0.5rem;
                            border: 1px solid ${themeStyles.borderColor};
                            background: none;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            color: ${themeStyles.textColor};">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" 
                                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m2 22 1-1h3l9-9"></path>
                                <path d="M3 21v-3l9-9"></path>
                                <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l-3-3Z"></path>
                            </svg>
                        </button>
                    </div>

                <div id="color-wheel-modal" class="jspsych-color-wheel-modal">
                    <div class="jspsych-color-wheel-modal-content">
                        <button class="jspsych-color-wheel-close">&times;</button>
                        <div style="display: flex; flex-direction: row; align-items: center; gap: 20px;">
                            <canvas id="color-wheel" width="600" height="600" style="width: 24.5vh; height: 24.5vh; border-radius: 50%;"></canvas>
                            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                                <div id="color-preview" style="width: 100px; height: 100px; border: 2px solid ${themeStyles.previewBorderColor}; border-radius: 4px;"></div>
                                <button id="jspsych-color-wheel-submit" class="jspsych-btn" style="padding: 4px 10px; font-size: 12px; ${themeStyles.submitBtnStyle}" disabled>Submit</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            display_element.innerHTML = html;

            const modal = document.getElementById("color-wheel-modal");
            const showButton = document.getElementById("show-color-wheel");
            const closeButton = document.querySelector(".jspsych-color-wheel-close");
            const canvas = document.getElementById("color-wheel");
            const stimulusDiv = document.getElementById("jspsych-color-wheel-stimulus");
            const ctx = canvas.getContext("2d");
            const radius = canvas.width / 2;
            let selectedRGB = null;
            const start_time = performance.now();
            const submitButton = display_element.querySelector("#jspsych-color-wheel-submit");

            // Modal controls
            const openModal = (event) => {
                const clickX = event.clientX;
                const clickY = event.clientY;
                
                const modalContent = modal.querySelector('.jspsych-color-wheel-modal-content');
                modalContent.style.position = 'fixed';
                
                // Get modal dimensions (after it's displayed)
                modal.style.display = "flex";
                const rect = modalContent.getBoundingClientRect();
                const modalWidth = rect.width;
                const modalHeight = rect.height;
                
                // Calculate position with bounds checking
                let left = clickX;
                let top = clickY;
                
                // Keep within viewport (adjusted for left-aligned modal)
                if (left + modalWidth > window.innerWidth) {
                    left = window.innerWidth - modalWidth - 10;
                }
                if (left < 0) {
                    left = 10;
                }
                if (top + modalHeight/2 > window.innerHeight) {
                    top = window.innerHeight - modalHeight/2 - 10;
                }
                if (top - modalHeight/2 < 0) {
                    top = modalHeight/2 + 10;
                }
                
                modalContent.style.left = `${left}px`;
                modalContent.style.top = `${top}px`;
                modalContent.style.transform = 'translateY(-50%)';  // Only center vertically
            };

            showButton.onclick = openModal;
            stimulusDiv.onclick = openModal;

            closeButton.onclick = () => {
                modal.style.display = "none";
            };

            window.onclick = (event) => {
                if (event.target === modal) {
                    modal.style.display = "none";
                }
            };

            // Generate random rotation angle at trial start
            const rotationOffset = Math.random() * 360;
            
            // Function to get color at specific coordinates
            const getColorAtPosition = (x, y) => {
                const dx = x - radius;
                const dy = y - radius;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= radius) {
                    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    angle = (angle + rotationOffset + 360) % 360;

                    const hue = angle / 360;
                    const saturation = distance / radius;
                    const lightness = 1 - saturation / 2;

                    return hslToRgb(hue, saturation, lightness);
                }
                return null;
            };
            
            // Function to draw the RGB color wheel with white gradient
            const drawColorWheel = () => {
                const image = ctx.createImageData(canvas.width, canvas.height);
                const data = image.data;

                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const rgb = getColorAtPosition(x, y);
                        if (rgb) {
                            const index = (y * canvas.width + x) * 4;
                            data[index] = rgb[0];
                            data[index + 1] = rgb[1];
                            data[index + 2] = rgb[2];
                            data[index + 3] = 255;
                        }
                    }
                }
                ctx.putImageData(image, 0, 0);
            };

            // Convert HSL to RGB
            function hslToRgb(h, s, l) {
                let r, g, b;

                if (s === 0) {
                    r = g = b = l * 255;
                } else {
                    const hue2rgb = (p, q, t) => {
                        if (t < 0) t += 1;
                        if (t > 1) t -= 1;
                        if (t < 1 / 6) return p + (q - p) * 6 * t;
                        if (t < 1 / 2) return q;
                        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                        return p;
                    };

                    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                    const p = 2 * l - q;
                    r = hue2rgb(p, q, h + 1 / 3);
                    g = hue2rgb(p, q, h);
                    b = hue2rgb(p, q, h - 1 / 3);
                }

                return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
            }

            let clickPosition = null;

            // Handle clicks on the wheel
            canvas.addEventListener("click", (event) => {
                const rect = canvas.getBoundingClientRect();
                const x = (event.clientX - rect.left) * (canvas.width / rect.width);
                const y = (event.clientY - rect.top) * (canvas.height / rect.height);
                
                const dx = x - radius;
                const dy = y - radius;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= radius) {
                    clickPosition = { x, y };
                    const rgb = getColorAtPosition(x, y);
                    if (rgb) {
                        selectedRGB = { r: rgb[0], g: rgb[1], b: rgb[2] };
                        submitButton.disabled = false;
                        
                        // Update color preview
                        const preview = document.getElementById('color-preview');
                        preview.style.backgroundColor = `rgb(${selectedRGB.r}, ${selectedRGB.g}, ${selectedRGB.b})`;
                        
                        // Redraw wheel with marker
                        redrawWheelWithMarker();
                    }
                }
            });

            // Redraw the wheel with the click marker
            const redrawWheelWithMarker = () => {
                drawColorWheel();

                if (clickPosition) {
                    ctx.beginPath();
                    ctx.arc(clickPosition.x, clickPosition.y, 6, 0, 2 * Math.PI);
                    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
                    ctx.fill();
                    ctx.strokeStyle = "white";
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            };

            drawColorWheel();

            submitButton.addEventListener("click", () => {
                const response = {
                    rt: performance.now() - start_time,
                    rgb: selectedRGB || { r: 255, g: 255, b: 255 },
                    stimulus: trial.stimulus,
                    x: clickPosition ? clickPosition.x : null,
                    y: clickPosition ? clickPosition.y : null,
                    distance_from_center: clickPosition ? 
                        Math.sqrt(Math.pow(clickPosition.x - radius, 2) + Math.pow(clickPosition.y - radius, 2)) / radius : null,
                    angle: clickPosition ? 
                        ((Math.atan2(clickPosition.y - radius, clickPosition.x - radius) * (180 / Math.PI) + rotationOffset + 360) % 360) : null
                };

                modal.style.display = "none";
                this.endTrial(display_element, trial, response);
            });
        }

        endTrial(display_element, trial, response) {
            // Clean up the style element to prevent it from affecting other trials
            const styleElement = document.getElementById("jspsych-color-wheel-styles");
            if (styleElement) {
                styleElement.remove();
            }
            
            display_element.innerHTML = "";
            this.jsPsych.finishTrial(response);
        }
    }

    ColorWheelPlugin.info = info;

    return ColorWheelPlugin;
})(jsPsychModule);