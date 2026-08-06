import { Schema } from 'mongoose';
import { Ambassador, ISocialProfile } from '../data/ambassador';
import { IDocumentModel } from '../data/base';

export interface AmbassadorModel extends IDocumentModel<Ambassador>, Ambassador {
}
const SocialProfileSchema = new Schema<ISocialProfile>({
  platform: { type: String, required: true },
  followers: { type: Number, min: 0, required: true }
});

const AmbassadorSchema = new Schema<Ambassador>({
  fullName: { type: String, required: true },
  email:    { type: String, required: true, lowercase: true },
  bio:      { type: String, required: true },
  socialProfiles: { type: [SocialProfileSchema], required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  submittedAt: { type: Date, default: Date.now }
});



export default AmbassadorSchema;