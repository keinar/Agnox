import { ObjectId } from 'mongodb';
import { MongoHelper } from '../helpers/mongoHelper'

export class GalleryRepository {
    constructor(private mongo: MongoHelper) {}

    async findById(id: string) {
        const collection = await this.mongo.getCollection('galleries');
        return await collection.findOne({ _id: new ObjectId(id) });
    }
    
    // דוגמה לשאילתה עסקית "אמיתית"
    async isGalleryExists(title: string): Promise<boolean> {
        const collection = await this.mongo.getCollection('galleries');
        const count = await collection.countDocuments({ title });
        return count > 0;
    }
}