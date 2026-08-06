import { Request } from "express";
import { AuditLog } from "../data/auditLog";
import { keys } from "./keys";

const milliSeconds = 1000;
const env = process.env.NODE_ENV ? process.env.NODE_ENV.trim() : "prod";

export function getEnvValue(req: Request): string {
  let env;
  if (
    req.hostname.includes("test") ||
    req.hostname.includes("localhost") ||
    req.hostname.includes("ngrok")
  ) {
    env = "test";
  } else {
    env = "main";
  }
  return env;
}

export function coinValue(coin: string) {
  let coinFor;
  if (env.localeCompare("test") == 0) {
    if (localeCompareCaseInsenstive(coin, "tbtc")) {
      coinFor = "BTC";
    } else if (localeCompareCaseInsenstive(coin, "tltc")) {
      coinFor = "LTC";
    } else if (localeCompareCaseInsenstive(coin, "tbch")) {
      coinFor = "BCH";
    }
  } else {
    if (localeCompareCaseInsenstive(coin, "btc")) {
      coinFor = "BTC";
    } else if (localeCompareCaseInsenstive(coin, "ltc")) {
      coinFor = "LTC";
    } else if (localeCompareCaseInsenstive(coin, "bch")) {
      coinFor = "BCH";
    }
  }
  return coinFor;
}

export function AddHours(h: number): number {
  let newDt = new Date();
  let timestamp = Math.round(
    newDt.setHours(newDt.getHours() + h) / milliSeconds
  );
  return timestamp;
}

export function currentTimeStamp(): number {
  let nowTimestamp = Math.floor(Date.now() / milliSeconds);
  return nowTimestamp;
}

export function AuditData(
  source: string,
  userId: string = "",
  status: number,
  message: object
) {
  let auditLogData = {
    source: source,
    userId: userId,
    //   orderId: orderId,
    status: status,
    message: message,
    created: new Date(),
  } as AuditLog;
  return auditLogData;
}

export function search(nameKey: string, myArray: any) {
  for (var i = 0; i < myArray.length; i++) {
    if (myArray[i].name === nameKey) {
      return myArray[i];
    }
  }
}

//string comparsion irrespective of case
function localeCompareCaseInsenstive(a: string, b: string) {
  return typeof a === "string" && typeof b === "string"
    ? a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0
    : a === b;
}

export function deserializeRecords<T>(json: []): T[] {
  let collection: T[] = [];
  json.map((item: T) => {
    collection.push(item);
  });
  return collection;
}

export function dateFromObjectId(objectId: string) {
  return new Date(parseInt(objectId.toString().substring(0, 8), 16) * 1000);
}

// export function resolveUrl(url: string) {
//     if (url.includes('localhost')) {
//         return keys.MONNIBASEURL;
//     } else if (url.includes('test')) {
//         return keys.MONNIBASEURL;
//     } else {
//         return keys.MONNIBASEURL;
//     }
// }

// export function resolveReturnUrl(url: string) {
//     if (url.includes('localhost')) {
//         return keys.APPURL;
//     } else if (url.includes('test')) {
//         return keys.APPURL;
//     } else {
//         return keys.APPURL;
//     }
// }

// export function resolveAdminStatus(adminStatus: string) {
//     if (adminStatus.localeCompare("Approve") === 0) {
//         return AdminStatus.Verified;
//     }
//     else if (adminStatus.localeCompare("Reject") === 0) {
//         return AdminStatus.Rejected;
//     }
//     else if (adminStatus.localeCompare("Request") === 0) {
//         return AdminStatus.Due;
//     }
// }
