// pm2 ecosystem config — copy to your experiment repo and customise.
// Start:   pm2 start ecosystem.config.cjs
// Stop:    pm2 stop my-experiment
// Logs:    pm2 logs my-experiment
// Restart: pm2 restart my-experiment

module.exports = {
    apps: [
        {
            name: "my-experiment",
            script: "./node_modules/jspsych-wrap/dist/server/index.js",
            watch: false,
            env: {
                NODE_ENV: "production",
                PORT: 3000,
                // Absolute path to the directory containing index.html, exp/, css/, data/, etc.
                EXPERIMENT_DIR: "/var/www/my-experiment",
                // Directory where CSV data files will be written (must be writable)
                DATA_DIR: "/var/www/my-experiment/data",
            },
        },
    ],
};
