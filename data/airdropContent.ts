import { IDocumentModel, IModel } from "./base";

export interface AirdropContent extends IModel, IDocumentModel<AirdropContent> {
  mainTitle: string;
  highlightedTitle: string;
  subtitle: string;
  bannerImage: string;
  mainCharacterImage: string;
  offerTitle: string;
  mainOfferText: string;
  detailedExplanation: string;
  howItWorks: { title: string; description: string; image: string }[];
  keyDatesText: string;
  keyDates: { date: string; description: string }[];
  rules: string[];
  referralTracker: {
    image: string;
    features: string[];
  };
  appImage: string;
  faqs: { question: string; answer: string }[];
  signUpContent: {
    mainTitle: string,
    detailedExplanation: string,
    referralNote: string,
    termsText: string
  }
}
