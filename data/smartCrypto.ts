import { IDocumentModel } from "./base";

export interface Cryptocurrency {
  token: string; // Symbol of the cryptocurrency (e.g., BTC, LINK)
  name: string; // Full name of the cryptocurrency (e.g., Bitcoin, ChainLink)
  percentage: number; // Percentage of the portfolio allocated to this token
  valueInUSD: number; // Value of the allocation in USD
}

export interface SmartCrypto extends IDocumentModel<SmartCrypto> {
  title: string; // Title for the portfolio or specific token section
  description: string; // Description of the cryptocurrency or its purpose
  subTitle: string; // Sub-title providing additional context
  portfolioName: string; // Name of the portfolio (e.g., "SmartCrypto Investment")
  totalInvestment: number; // Total investment amount in USD
  cryptocurrencies: Cryptocurrency[]; // Array of cryptocurrencies within the portfolio
  createdDate: Date; // Date the portfolio was created
  managedBy: string; // The entity managing the overall portfolio
  updatedOn: Date; // Date the portfolio is updated
  isActive: boolean;
}
