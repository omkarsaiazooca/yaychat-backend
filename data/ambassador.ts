import { Document } from 'mongoose';

export interface ISocialProfile {
  platform:   string;   // e.g. 'twitter', 'instagram', 'tiktok'
  followers:  number;   // non-negative integer
}

export interface Ambassador extends Document {
  fullName:       string;
  email:          string;
  bio:            string;
  socialProfiles: ISocialProfile[];
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedAt:    Date;
}
