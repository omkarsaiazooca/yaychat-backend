import * as fs from "fs";

export function logToFile(message: string) {
  // Define the path to your log file
  const logFilePath = "stakedCoins.log";

  // Create or append to the log file
  fs.appendFile(
    logFilePath,
    `${new Date().toISOString()}: ${message}\n`,
    (err) => {
      if (err) {
        console.error("Error writing to log file:", err);
      }
    }
  );
}


export function downgradeRankLogToFile(message: string): void {
  const logFilePath = 'downgradeRanksLog.txt';
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;

  fs.appendFileSync(logFilePath, logMessage, 'utf8');
}