import * as fs from 'fs';
import * as path from 'path';

export class Logger {
    private static logFile = path.resolve('logs', 'automation.log');

    /**
     * Cleans the log file at the beginning of the execution.
     * Ensures we start with a fresh log for the new run.
     */
    static clean() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        // Overwrite the file with an empty string
        fs.writeFileSync(this.logFile, ''); 
    }

    /**
     * Logs an INFO message to both console and file.
     */
    static info(message: string) {
        this.write('INFO', message);
    }

    /**
     * Logs an ERROR message to both console and file.
     */
    static error(message: string) {
        this.write('ERROR', message);
    }

    /**
     * Internal method to handle writing to streams.
     * Adds timestamp and handles console coloring.
     */
    private static write(level: string, message: string) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;

        // 1. Console Output (with colors for better DX)
        if (level === 'ERROR') {
            // Red color for errors
            console.error(`\x1b[31m${logMessage}\x1b[0m`); 
        } else {
            // Cyan/Blue for info
            console.log(`\x1b[36m${logMessage}\x1b[0m`); 
        }

        // 2. File Output (Append mode)
        try {
            fs.appendFileSync(this.logFile, logMessage + '\n');
        } catch (e) {
            console.error("Failed to write to log file", e);
        }
    }
}