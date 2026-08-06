// --- models/AirdropLottoContent.ts ---
import { Schema, model } from 'mongoose';
import { IDocumentModel } from '../data/base';
import { AirdropContent } from '../data/airdropContent';

export interface AirdropContentModel extends IDocumentModel<AirdropContent>, AirdropContent { }

const airdropLottoContentSchema: Schema = new Schema();

airdropLottoContentSchema.add({
  mainTitle: String,
  highlightedTitle: String,
  subtitle: String,
  bannerImage: String,
  mainCharacterImage: String,
  offerTitle: String,
  mainOfferText: String,
  detailedExplanation: String,
  howItWorks: [
    {
      title: String,
      description: String,
      image: String,
    },
  ],
  keyDatesText: String,
  keyDates: [
    {
      date: String,
      description: String,
    },
  ],
  rules: [String],
  referralTracker: {
    image: String,
    features: [String],
  },
  appImage: String,
  faqs: [
    {
      question: String,
      answer: String,
    },
  ],
  createdAt: Date,
  updatedAt: Date,
  signUpContent: {
    mainTitle: String,
    detailedExplanation: String,
    referralNote: String,
    termsText: String
  }
});

export default airdropLottoContentSchema;
