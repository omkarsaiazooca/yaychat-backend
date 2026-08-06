import { Mongoose } from "mongoose";
import { keys } from "../config/keys";

var mongoosePrimary: Mongoose = new Mongoose();
var mongooseSecondary: Mongoose = new Mongoose();

// Set strictQuery to suppress deprecation warning
mongoosePrimary.set('strictQuery', false);
mongooseSecondary.set('strictQuery', false);

// Primary database connection
let primaryDbUrl = String(keys.localMongoDB?.database);
console.log("Primary DB URL:", primaryDbUrl);

mongoosePrimary.set('bufferCommands', false); // Disable mongoose buffering
mongoosePrimary.connect(primaryDbUrl, {
    dbName: keys.MongoDB.testDatabase,
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 30000, // Increased to 30 seconds
    socketTimeoutMS: 60000,
    connectTimeoutMS: 30000,
}).then(() => {
    console.log('Connected to primary MongoDB');
}).catch(err => {
    console.error('Primary MongoDB connection error:', err);
    // Log more details about authentication errors
    if (err.code === 18 || err.codeName === 'AuthenticationFailed') {
        console.error('MongoDB Authentication Failed. Please check:');
        console.error('1. MongoDB connection string credentials');
        console.error('2. Database user permissions');
        console.error('3. Network connectivity to MongoDB server');
    }
});

// Secondary database connection
let secondaryDbUrl = String(keys.localMongoDB?.database); // Adjust according to your config
console.log("Secondary DB URL:", secondaryDbUrl);

mongooseSecondary.set('bufferCommands', false); // Disable mongoose buffering
mongooseSecondary.connect(secondaryDbUrl, {
    dbName: keys.shopMongoDB?.testDatabase,
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 30000, // Increased to 30 seconds
    socketTimeoutMS: 60000,
    connectTimeoutMS: 30000,
}).then(() => {
    console.log('Connected to secondary MongoDB');
}).catch(err => {
    console.error('Secondary MongoDB connection error:', err);
    // Log more details about authentication errors
    if (err.code === 18 || err.codeName === 'AuthenticationFailed') {
        console.error('MongoDB Authentication Failed. Please check:');
        console.error('1. MongoDB connection string credentials');
        console.error('2. Database user permissions');
        console.error('3. Network connectivity to MongoDB server');
    }
});

mongoosePrimary.Promise = global.Promise;
mongooseSecondary.Promise = global.Promise;

let primaryDb = mongoosePrimary.connection;
let secondaryDb = mongooseSecondary.connection;

// Set max listeners to prevent warnings
primaryDb.setMaxListeners(20);
secondaryDb.setMaxListeners(20);

primaryDb.on('error', console.error.bind(console, 'Primary MongoDB connection error:'));
secondaryDb.on('error', console.error.bind(console, 'Secondary MongoDB connection error:'));

const mongo = {
    primary: mongoosePrimary,
    secondary: mongooseSecondary
};

// Track if we're already waiting for connection
let connectionPromise: Promise<boolean> | null = null;

/**
 * Ensure MongoDB connection is ready before operations
 * Returns true if connected, false otherwise
 */
export async function ensureMongoConnected(): Promise<boolean> {
    try {
        // If already connected, return immediately
        if (mongoosePrimary.connection.readyState === 1) {
            return true;
        }

        // If connection is in progress, wait for the existing promise
        if (connectionPromise) {
            return await connectionPromise;
        }

        // Create a new connection promise
        connectionPromise = new Promise((resolve) => {
            // Double-check readyState after creating promise
            if (mongoosePrimary.connection.readyState === 1) {
                connectionPromise = null;
                resolve(true);
                return;
            }

            // If connecting, wait for it to finish
            if (mongoosePrimary.connection.readyState === 2) {
                const checkConnected = () => {
                    if (mongoosePrimary.connection.readyState === 1) {
                        connectionPromise = null;
                        resolve(true);
                    } else if (mongoosePrimary.connection.readyState === 0) {
                        connectionPromise = null;
                        resolve(false);
                    } else {
                        // Still connecting, check again
                        setTimeout(checkConnected, 100);
                    }
                };
                checkConnected();
                return;
            }

            // Connection not started, check status periodically (max 5 seconds)
            const startTime = Date.now();
            const timeout = 5000;
            
            const checkInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                
                if (mongoosePrimary.connection.readyState === 1) {
                    clearInterval(checkInterval);
                    connectionPromise = null;
                    resolve(true);
                } else if (mongoosePrimary.connection.readyState === 0 || elapsed >= timeout) {
                    clearInterval(checkInterval);
                    connectionPromise = null;
                    resolve(false);
                }
            }, 100);
        });

        return await connectionPromise;
    } catch (error) {
        console.error('Error checking MongoDB connection:', error);
        connectionPromise = null;
        return false;
    }
}

export default mongo;
