import { Schema } from 'mongoose';
import { IDocumentModel } from '../data/base';
import { SorektNFTTx } from '../data/sorektNFTTx';

export interface SorektNFTTxModel extends IDocumentModel<SorektNFTTx>, SorektNFTTx {
}
const sorektNFTTxSchemaOptions = {
    timestamps: { createdAt: 'created', updatedAt: 'modified' }
};

var sorektNFTSchema: Schema = new Schema({}, sorektNFTTxSchemaOptions);

sorektNFTSchema.add({
    txId: String,
    from: String,
    to: String,
    amount: Number,
    info: String,
    txDate: Date
})

export default sorektNFTSchema;