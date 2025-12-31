import { MongoClient, Db, Collection, Document } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Logger } from './logger';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    throw new Error("FATAL ERROR: MONGO_URI is not set in .env file");
}

/**
 * MongoHelper.
 * Handles the low-level database connection.
 * Provides access to collections for Repositories.
 */
export class MongoHelper {
    private client: MongoClient;
    private db: Db | undefined;

    constructor() {
        this.client = new MongoClient(MONGO_URI!, {
            maxPoolSize: 10,
            minPoolSize: 1, 
            serverSelectionTimeoutMS: 5000
        });
    }

    /**
     * Connects to the database.
     * Should be called in 'beforeAll'.
     */
    async connect() {
        try {
            if (!this.db) {
                await this.client.connect();
                this.db = this.client.db('test');
                Logger.info('[MongoHelper] Successfully connected to MongoDB.');
            }
        } catch (error) {
            Logger.error(`[MongoHelper] Failed to connect to MongoDB: ${error}`);
            throw error;
        }
    }

    /**
     * Disconnects from the database.
     * Should be called in 'afterAll'.
     */
    async disconnect() {
        try {
            await this.client.close();
            this.db = undefined;
            Logger.info('[MongoHelper] Disconnected from MongoDB.');
        } catch (error) {
            Logger.error(`[MongoHelper] Error during disconnect: ${error}`);
        }
    }

    /**
     * Returns a MongoDB Collection to perform operations on.
     * This generic method allows Repositories to access any collection safely.
     * * @param name - The name of the collection (e.g., 'galleries', 'users')
     */
    public getCollection<T extends Document>(name: string): Collection<T> {
        if (!this.db) {
            throw new Error("[MongoHelper] Database not connected. Call connect() first.");
        }
        return this.db.collection<T>(name);
    }
}