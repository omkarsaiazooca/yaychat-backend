// --- services/airdropLottoContentService.ts ---
import { AirdropContent } from '../data/airdropContent';
import airdropLottoContentSchema, { AirdropContentModel } from '../models/airdropContent';
import { ServiceBase } from './base';

export class AirdropContentService extends ServiceBase<AirdropContent, AirdropContentModel> {
    constructor() {
        super(airdropLottoContentSchema, 'AirdropContents');
    }
}
