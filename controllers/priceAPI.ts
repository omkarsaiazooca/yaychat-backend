import Binance from "node-binance-api";
import { PriceTicker } from "../data/priceTicker";
import {
  getIndexxUSDPPrice,
  getIndexxIN500Price,
  getIndexxCryptoPrice,
} from "../data/priceChainlinks";
import { keys } from "../config/keys";
import {
  StockData,
  adjustForNonWorkingDays,
  getLatestStockData,
  getLatestStockPrice,
  getPreviousDayPrice,
} from "../helpers/twelveDataLatestPrice";
import { CurrencyService } from "../services/currency.service";
import moment from "moment";
import axios from "axios";
import { createClient } from "redis";
import { getLatestPriceOfETF } from "../platform/etf.operations";

async function getLiveBtcUsdPrice(): Promise<number | null> {
  const sources: Array<{
    name: string;
    request: () => Promise<number>;
  }> = [
    {
      name: "binance-rest",
      request: async () => {
        const response = await axios.get(
          "https://api.binance.com/api/v3/ticker/price",
          {
            params: { symbol: "BTCUSDT" },
            timeout: 8000,
          }
        );
        return Number(response?.data?.price);
      },
    },
    {
      name: "binance-client",
      request: async () => {
        const querySymbol = "BTCUSDT";
        const results = await binance.prices(querySymbol);
        return Number(results?.[querySymbol]);
      },
    },
    {
      name: "coingecko",
      request: async () => {
        const response = await axios.get(
          "https://api.coingecko.com/api/v3/simple/price",
          {
            params: { ids: "bitcoin", vs_currencies: "usd" },
            timeout: 8000,
          }
        );
        return Number(response?.data?.bitcoin?.usd);
      },
    },
    {
      name: "coinbase",
      request: async () => {
        const response = await axios.get(
          "https://api.coinbase.com/v2/prices/BTC-USD/spot",
          { timeout: 8000 }
        );
        return Number(response?.data?.data?.amount);
      },
    },
  ];

  for (const source of sources) {
    try {
      const price = await source.request();
      if (Number.isFinite(price) && price > 0) {
        return price;
      }
      console.warn(`[getLiveBtcUsdPrice] ${source.name} returned invalid price`, price);
    } catch (err) {
      console.warn(`[getLiveBtcUsdPrice] ${source.name} failed`, err);
    }
  }

  return null;
}

async function getStoredBtcyPrice(): Promise<number | null> {
  try {
    const btcyPrice = await currencyService.findOne({
      code: "BTCY",
      type: "BUY",
    });
    const price = Number(btcyPrice?.buyPrice);
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
  } catch (err) {
    console.warn("[getStoredBtcyPrice] failed to load BTCY DB price", err);
  }

  return null;
}

export const allTokens = [
  {
    title: "IN500",
    subTitle: "gatechain-token",
    isCrypto: true,
    isStock: false,
    text1:
      "Indexx500 Low Risk, Secure and Simple Indexx500 stock tokens are the world first secured coins pegged with world largest stock market index S&P 500, having pioneered the concept in the digital token space. Most popular token, already sold over $1M worth of Indexx500",
    text2:
      "Indexx 500 stock tokens are assets that move across the blockchain just as easily as other digital currencies but that are pegged to S&P 500 index on a 1-to-1,000 basis. Indexx 500 stock tokens are referred to as reliable coins because they offer price reliable as they are pegged to a S&P 500 index of US stock market, This offers traders, merchants and funds a low volatility solution when exiting positions in the market. All Indexx 500 stock tokens are pegged at 1-to-1,000 with a matching S&P 500 (e.g., 1 INXS = 1,000 Share of S&P 500 Index) and are backed 100% by Indexx’s reserves.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "INEX",
    subTitle: "satoshi-nakamoto-rune",
    isCrypto: true,
    isStock: false,
    text1:
      "Indexx.ai’s Utility and Reward Token. It will be needed to participate in all derivatives like Daily Fortune, Casino and Games. The price is low at the moment but has the highest potential to increase value because of its characteristics, demand and need. Now is the best time to buy and hold your Indexx INEX tokens. The current price per INEX token is $3.00, while being predicted to increase in value within 3 - 6 months time.",
    text2:
      "Over the past 24 hours, the trading volume for Tether USDt has increased by $-2,425,573,942,181.26, representing a -46.417% rise. Moreover, USDT worth $52.26B has been traded in the last day.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "INEX",
    subTitle: "satoshi-nakamoto-rune",
    isCrypto: true,
    isStock: false,
    text1:
      "Indexx.ai’s Utility and Reward Token. It will be needed to participate in all derivatives like Daily Fortune, Casino and Games. The price is low at the moment but has the highest potential to increase value because of its characteristics, demand and need. Now is the best time to buy and hold your Indexx INEX tokens. The current price per INEX token is $3.00, while being predicted to increase in value within 3 - 6 months time.",
    text2:
      "Over the past 24 hours, the trading volume for Tether USDt has increased by $-2,425,573,942,181.26, representing a -46.417% rise. Moreover, USDT worth $52.26B has been traded in the last day.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "INEX",
    subTitle: "satoshi-nakamoto-rune",
    isCrypto: true,
    isStock: false,
    text1:
      "Indexx.ai’s Utility and Reward Token. It will be needed to participate in all derivatives like Daily Fortune, Casino and Games. The price is low at the moment but has the highest potential to increase value because of its characteristics, demand and need. Now is the best time to buy and hold your Indexx INEX tokens. The current price per INEX token is $3.00, while being predicted to increase in value within 3 - 6 months time.",
    text2:
      "Over the past 24 hours, the trading volume for Tether USDt has increased by $-2,425,573,942,181.26, representing a -46.417% rise. Moreover, USDT worth $52.26B has been traded in the last day.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "WIBS",
    subTitle: "toshi",
    isCrypto: true,
    isStock: false,
    text1:
      "Who Is Bitcoin Satoshi Coin (WIBS) is more than just a cryptocurrency – it's a digital enigma waiting to be unraveled. With a price of $0.0021 and a symbol of WIBS, this meme coin boasts a total issuance of 210 billion tokens. Built upon a decentralized framework, the project holds true to Satoshi's vision, with the creator stepping away to uphold the ethos of anonymity. Utilizing the robust infrastructures of Ethereum blockchais, Who Is Satoshi Coin ensures reliability and scalability.",
    text2:
      "As the journey unfolds, Who Is Bitcoin Satoshi Coin aims to expand its reach. Join us in exploring the depths of the digital realm and uncovering the mystery behind Satoshi's legacy.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "IUSD+",
    subTitle: "tether",
    isCrypto: true,
    isStock: false,
    text1: " IUSD+ is Indexx.ai’s stable coin and Perfect for beginners.",
    text2:
      "indexx USD+ includes 3 components: 1. PEGGED TO USDT 1 : 1 100% collateralized with assets immediately convertable into USDT. 'Risk-first portfolio', i.e. assets are picked primarily to avoid losses on a daily basis(3-4 sigmas away from 0), no exposure to algorithmic stables. USD+ can replace USDT in pools and lending protocols 2. YIELD GENERATING Collateral consists of yield-bearing strategies, including lending and stable-to-stable pools. Portfolio allocation decentrally controlled (community proposals, veto power by token stakers/insurance providers). Portfolio strategy executed decentrally via smart-contracts. Profit paid out daily in indexxUSD+ via rebase 3. INSURANCE Coming soon",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "INXC",
    subTitle: "uma",
    isCrypto: true,
    isStock: false,
    text1:
      "IndexxCrypto is a High Velocity, High Risk, High Reward Hyper Token Long-term Grow This IndexxCrypto token holds the top 10 blue chip crypto assets, allowing the token price to track movements of the broader crypto market.",
    text2:
      " This indexx crypto token holds the top 10 blue chip cryptoassets, allowing the token price to track movements of the broader crypto market. The token's holdings are re-balanced on a weekly basis (with no asset taking up over 10%). This greatly simplifies the effort required to track the broader market's performance.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "ALCRYP",
    subTitle: "AlphaCrypto ETF",
    isCrypto: true,
    isStock: false,
    text1:
      "A Non-Indexx Crypto Heavy ETF is an exchange-traded fund that primarily comprises digital tokens representing a diverse range of cryptocurrencies, excluding those tracked by a specific index like Bitcoin or Ethereum. This ETF offers exposure to a broader selection of digital assets beyond the well-known ones, potentially providing more diversified exposure to the cryptocurrency market.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "AMZN",
    subTitle: "ethereum",
    isCrypto: true,
    isStock: true,
    text1:
      " Amazon's AMZN stock token offers ownership in the world's largest online retailer and cloud services provider, Amazon.com Inc. By holding AMZN tokens, you become a part of Amazon's continuous expansion and dominance in e-commerce and technology. With potential for value growth in the next 3 - 6 months.",
    text2:
      " This Amazon stock token holds the amazon stock assets, allowing the token price to track movements of the broader crypto market. The token's holdings are re-balanced on a weekly basis (with no asset taking up over 10%). This greatly simplifies the effort required to track the broader market's performance.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "APPL",
    subTitle: "bitcoin",
    isCrypto: true,
    isStock: true,
    text1:
      "Apple Inc's AAPL stock token grants ownership in one of the world's most iconic technology companies. Holding AAPL tokens means you have a stake in Apple's innovations in consumer electronics, software, and services. It's poised for potential value growth in the upcoming 3 - 6 months.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "BCM",
    subTitle: "ethereum",
    isCrypto: true,
    isStock: true,
    text1:
      "Broadcom's AVGO stock token offers ownership in a global technology leader specializing in semiconductor and infrastructure software solutions. By investing in AVGO tokens, you can participate in Broadcom's role in advancing the technology industry. Prospects for value growth in the next 3 - 6 months.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "BNB",
    subTitle: "binancecoin",
    isCrypto: true,
    isStock: false,
    text1:
      " BNB is a cryptocurrency that can be used to trade and pay fees on the Binance cryptocurrency exchange. BNB is also the cryptocurrency coin that powers the BNB Chain ecosystem. As one of the world's most popular utility tokens, BNB is useful to users in a wide range of applications and use cases.",
    text2:
      " BNB was launched through an Initial Coin Offering (or ICO) that took place from June 26th to July 3rd, 2017 - 11 days before the Binance Exchange opened for trading. The issue price was 1 ETH for 2,700 BNB or 1 BTC for 20,000 BNB. Although BNB was launched through an ICO, BNB does not provide users with a claim on Binance profits and does not represent an investment in Binance.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "BTC",
    subTitle: "bitcoin",
    isCrypto: true,
    isStock: false,
    text1:
      " Bitcoin is one of the most popular cryptocurrencies in the market. First introduced in 2009 by Satoshi Nakamoto, Bitcoin has held the crypto market’s number one spot according to market capitalization. Bitcoin paved the way for many existing crypto altcoins in the market and marked a pivotal moment for digital payment solutions.",
    text2:
      "As the world’s first cryptocurrency, Bitcoin has come a long way in terms of its value. However, one does not have to buy an entire bitcoin as as the most popular cryptocurrency can be divided into small units called satoshis, named after the creator. A satoshi is equivalent to 0.00000001 bitcoin.",
    text3:
      "There is no physical BTC token so you can think of bitcoin as digital money. Bitcoin transactions are fully transparent and can’t be censored. You can send crypto to anyone in the world with ease. It’s a financial system backed by thousands of computers, known as ‘nodes’, around the world, instead of a single central bank or government, i.e. hence the term ‘decentralization’.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "CRYC10",
    subTitle: "CryptoCap 10 ETF",
    isCrypto: false,
    isStock: false,
    text1:
      "CryptoCap 10 ETF refers to a selection of the ten most prominent and valuable cryptocurrencies in the digital asset market. These tokens include well-known names like Bitcoin, Ethereum, and others, and are typically tracked as a benchmark to gauge the overall performance and trends within the cryptocurrency industry.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "DAI",
    subTitle: "Dai",
    isCrypto: true,
    isStock: false,
    text1:
      " DAI is an Ethereum-based stablecoin (stable-price cryptocurrency) whose issuance and development is managed by the Maker Protocol and the MakerDAO decentralized autonomous organization.",
    text2:
      "The price of DAI is soft-pegged to the U.S. dollar and is collateralized by a mix of other cryptocurrencies that are deposited into smart-contract vaults every time new DAI is minted.",
    text3:
      " It is important to differentiate between Multi-Collateral DAI and Single-Collateral DAI (SAI), an earlier version of the token that could only be collateralized by a single cryptocurrency; SAI also doesn’t support the DAI Savings Rate, which allows users to earn savings by holding DAI tokens.Multi-Collateral DAI was launched in November 2019.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "DOGE",
    subTitle: "Dogecoin",
    isCrypto: true,
    isStock: false,
    text1:
      " Dogecoin (DOGE) is based on the popular Internet meme and features a Shiba Inu on its logo. The open-source digital currency was created by Billy Markus from Portland, Oregon and Jackson Palmer from Sydney, Australia, and was forked from Litecoin in December 2013. Dogecoin's creators envisaged it as a fun, light-hearted cryptocurrency that would have greater appeal beyond the core Bitcoin audience, since it was based on a dog meme. Tesla CEO Elon Musk posted several tweets on social media that Dogecoin is his favorite coin.",
    text2:
      "Dogecoin differs from Bitcoin's proof-of-work protocol in several ways, one of which is by using Scrypt technology. The altcoin has also a block time of 1 minute, and the total supply is uncapped, which means that there is no limit to the number of Dogecoin that can be mined. You can mine Dogecoin either solo, or by joining a mining pool. A Doge miner can mine the digital currency on Windows, Mac or Linux, and with a GPU. As of 2014, you can also mine Litecoin in the same process of mining Dogecoin, as the processes were merged.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "DOT",
    subTitle: "Polkadot",
    isCrypto: true,
    isStock: false,
    text1:
      "Polkadot is an open-source sharded multichain protocol that connects and secures a network of specialized blockchains, facilitating cross-chain transfer of any data or asset types, not just tokens, thereby allowing blockchains to be interoperable with each other. Polkadot was designed to provide a foundation for a decentralized internet of blockchains, also known as Web3.",
    text2:
      "Polkadot is known as a layer-0 metaprotocol because it underlies and describes a format for a network of layer 1 blockchains known as parachains (parallel chains). As a metaprotocol, Polkadot is also capable of autonomously and forklessly updating its own codebase via on-chain governance according to the will of its token holder community.",
    text3:
      "Polkadot provides a foundation to support a decentralized web, controlled by its users, and to simplify the creation of new applications, institutions and services.  The Polkadot protocol can connect public and private chains, permissionless networks, oracles and future technologies, allowing these independent blockchains to trustlessly share information and transactions through the Polkadot Relay Chain.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "CHZ",
    subTitle: "Chiliz",
    isCrypto: true,
    isStock: false,
    text1:
      "Chiliz is the leading digital currency for sports and entertainment by the eponymous Malta-based FinTech provider. It operates the blockchain-based sports entertainment platform Socios, which enables users to participate in the governance of their favorite sports brands. Multiple fan tokens by Socios.com are an example of that. For sports clubs and associations, fan tokens offer a way of connecting with their fans and unlocking new revenue streams.",
    text2:
      "For instance, fans can participate and influence club-related decisions through surveys and polls, such as messages the captain should wear on his armband. The company aims to bridge the gap between being an active and a passive fan.",
    text3:
      "Chiliz has developed partnerships with some of the biggest sporting institutions in the world: FC Barcelona, Manchester City, Juventus Turin, and Paris Saint-Germain. It also boasts partnerships with the UFC and gaming organizations. By purchasing CHZ, fans get access to various fan tokens and literally have a stake in their club.",
    popularity: "#104",
    marketCap: "$111.94B",
    volume: "$22.26B",
    circulationSupply: "92.12B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "VET",
    subTitle: "VeChain",
    isCrypto: true,
    isStock: false,
    text1:
      "VeChainThor (VET) is a versatile enterprise-grade L1 smart contract platform whose origins began in 2015. VeChain is known as a pioneer of real-world enterprise applications, and built a distributed platform powered by Internet of Things (IoT) technologies, NFC chips and blockchain to help various industries solve data-related challenges.",
    text2:
      "VeChain solves major blockchain adoption hurdles. The platform uses an intelligent two token model, VET and VTHO, separating the protocol's Store of Value and gas fee payment mechanisms, ensuring costs can be kept low and stable. Fee delegation allows smart contracts to pay gas fees on behalf of business users, and an advanced transaction model allows data to be packaged more efficiently while ensuring finality of data.",
    text3:
      "VeChain is focused on delivering a wave of incentive-based sustainability dApps through its new platform, VeBetterDAO, working closely with Boston Consulting Group to achieve adoption across enterprise and individual users, and helping onboard the next billion users to Web3 over the coming decade.",
    popularity: "#36",
    marketCap: "$3.94B",
    volume: "$206.26B",
    circulationSupply: "85.12B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "AVAX",
    subTitle: "Avalanche-2",
    isCrypto: true,
    isStock: false,
    text1:
      "Avalanche is a layer one blockchain that functions as a platform for decentralized applications and custom blockchain networks. It is one of Ethereum’s rivals, aiming to unseat Ethereum as the most popular blockchain for smart contracts. It aims to do so by having a higher transaction output of up to 6,500 transactions per second while not compromising scalability.",
    text2:
      "This is made possible by Avalanche’s unique architecture. The Avalanche network consists of three individual blockchains: the X-Chain, C-Chain and P-Chain. Each chain has a distinct purpose, which is radically different from the approach Bitcoin and Ethereum use, namely having all nodes validate all transactions. Avalanche blockchains even use different consensus mechanisms based on their use cases.",
    text3:
      "After its mainnet launch in 2020, Avalanche has worked on developing its own ecosystem of DApps and DeFi. Different Ethereum-based projects such as SushiSwap and TrueUSD have integrated with Avalanche. Furthermore, the platform is constantly working on improving interoperability between its own ecosystem and Ethereum, like through the development of bridges.",
    popularity: "#11",
    marketCap: "$16.94B",
    volume: "$22.26B",
    circulationSupply: "410.12M",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "THETA",
    subTitle: "Theta-token",
    isCrypto: true,
    isStock: false,
    text1:
      "Theta is a Layer 1 blockchain and decentralized infrastructure for Video, AI & Entertainment use cases.",
    text2:
      "Theta is a 'dual network' consisting of two complementary subsystems, the Theta Blockchain and the Theta Edge Network.Theta proof-of-stake blockchain provides payment, reward, staking and smart contract capabilities, while the Edge Network is responsible for the compute, storage and delivery of video streams, AI tasks, and other scientific, simulation and financial modeling use cases. There are two native cryptocurrencies on Theta blockchain: THETA, the staking and governance token, and TFUEL, used as gas for all transactions and on-chain smart contract interactions. The next-generation Edge Network, Theta EdgeCloud, is the first hybrid cloud computing platform built on a fully distributed architecture, set to launch later in 2024.",
    text3:
      "Theta’s Web3 infrastructure enables media companies to drive incremental revenues, user engagement, and new Web3 business models. Theta Video API and Theta Web3 Theater are turn-key decentralized video API for developers offering significantly lower costs for video transcoding, storage, and content delivery, powered by patented Digital Rights Management technology.",
    popularity: "#68",
    marketCap: "$1.94B",
    volume: "$22.26M",
    circulationSupply: "1B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "NOT",
    subTitle: "Notcoin",
    isCrypto: true,
    isStock: false,
    text1:
      "Chiliz is the leading digital currency for sports and entertainment by the eponymous Malta-based FinTech provider. It operates the blockchain-based sports entertainment platform Socios, which enables users to participate in the governance of their favorite sports brands. Multiple fan tokens by Socios.com are an example of that. For sports clubs and associations, fan tokens offer a way of connecting with their fans and unlocking new revenue streams.",
    text2:
      "For instance, fans can participate and influence club-related decisions through surveys and polls, such as messages the captain should wear on his armband. The company aims to bridge the gap between being an active and a passive fan.",
    text3:
      "Chiliz has developed partnerships with some of the biggest sporting institutions in the world: FC Barcelona, Manchester City, Juventus Turin, and Paris Saint-Germain. It also boasts partnerships with the UFC and gaming organizations. By purchasing CHZ, fans get access to various fan tokens and literally have a stake in their club.",
    popularity: "#104",
    marketCap: "$111.94B",
    volume: "$22.26B",
    circulationSupply: "92.12B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "FTM",
    subTitle: "Fantom",
    isCrypto: true,
    isStock: false,
    text1:
      "Chiliz is the leading digital currency for sports and entertainment by the eponymous Malta-based FinTech provider. It operates the blockchain-based sports entertainment platform Socios, which enables users to participate in the governance of their favorite sports brands. Multiple fan tokens by Socios.com are an example of that. For sports clubs and associations, fan tokens offer a way of connecting with their fans and unlocking new revenue streams.",
    text2:
      "For instance, fans can participate and influence club-related decisions through surveys and polls, such as messages the captain should wear on his armband. The company aims to bridge the gap between being an active and a passive fan.",
    text3:
      "Chiliz has developed partnerships with some of the biggest sporting institutions in the world: FC Barcelona, Manchester City, Juventus Turin, and Paris Saint-Germain. It also boasts partnerships with the UFC and gaming organizations. By purchasing CHZ, fans get access to various fan tokens and literally have a stake in their club.",
    popularity: "#104",
    marketCap: "$111.94B",
    volume: "$22.26B",
    circulationSupply: "92.12B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "RUNE",
    subTitle: "thorchain",
    isCrypto: true,
    isStock: false,
    text1:
      "Chiliz is the leading digital currency for sports and entertainment by the eponymous Malta-based FinTech provider. It operates the blockchain-based sports entertainment platform Socios, which enables users to participate in the governance of their favorite sports brands. Multiple fan tokens by Socios.com are an example of that. For sports clubs and associations, fan tokens offer a way of connecting with their fans and unlocking new revenue streams.",
    text2:
      "For instance, fans can participate and influence club-related decisions through surveys and polls, such as messages the captain should wear on his armband. The company aims to bridge the gap between being an active and a passive fan.",
    text3:
      "Chiliz has developed partnerships with some of the biggest sporting institutions in the world: FC Barcelona, Manchester City, Juventus Turin, and Paris Saint-Germain. It also boasts partnerships with the UFC and gaming organizations. By purchasing CHZ, fans get access to various fan tokens and literally have a stake in their club.",
    popularity: "#104",
    marketCap: "$111.94B",
    volume: "$22.26B",
    circulationSupply: "92.12B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "NEAR",
    subTitle: "Near",
    isCrypto: true,
    isStock: false,
    text1:
      "Chiliz is the leading digital currency for sports and entertainment by the eponymous Malta-based FinTech provider. It operates the blockchain-based sports entertainment platform Socios, which enables users to participate in the governance of their favorite sports brands. Multiple fan tokens by Socios.com are an example of that. For sports clubs and associations, fan tokens offer a way of connecting with their fans and unlocking new revenue streams.",
    text2:
      "For instance, fans can participate and influence club-related decisions through surveys and polls, such as messages the captain should wear on his armband. The company aims to bridge the gap between being an active and a passive fan.",
    text3:
      "Chiliz has developed partnerships with some of the biggest sporting institutions in the world: FC Barcelona, Manchester City, Juventus Turin, and Paris Saint-Germain. It also boasts partnerships with the UFC and gaming organizations. By purchasing CHZ, fans get access to various fan tokens and literally have a stake in their club.",
    popularity: "#104",
    marketCap: "$111.94B",
    volume: "$22.26B",
    circulationSupply: "92.12B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "AAVE",
    subTitle: "Aave",
    isCrypto: true,
    isStock: false,
    text1:
      "Chiliz is the leading digital currency for sports and entertainment by the eponymous Malta-based FinTech provider. It operates the blockchain-based sports entertainment platform Socios, which enables users to participate in the governance of their favorite sports brands. Multiple fan tokens by Socios.com are an example of that. For sports clubs and associations, fan tokens offer a way of connecting with their fans and unlocking new revenue streams.",
    text2:
      "For instance, fans can participate and influence club-related decisions through surveys and polls, such as messages the captain should wear on his armband. The company aims to bridge the gap between being an active and a passive fan.",
    text3:
      "Chiliz has developed partnerships with some of the biggest sporting institutions in the world: FC Barcelona, Manchester City, Juventus Turin, and Paris Saint-Germain. It also boasts partnerships with the UFC and gaming organizations. By purchasing CHZ, fans get access to various fan tokens and literally have a stake in their club.",
    popularity: "#104",
    marketCap: "$111.94B",
    volume: "$22.26B",
    circulationSupply: "92.12B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "INJ",
    subTitle: "injective-protocol",
    isCrypto: true,
    isStock: false,
    text1:
      "Chiliz is the leading digital currency for sports and entertainment by the eponymous Malta-based FinTech provider. It operates the blockchain-based sports entertainment platform Socios, which enables users to participate in the governance of their favorite sports brands. Multiple fan tokens by Socios.com are an example of that. For sports clubs and associations, fan tokens offer a way of connecting with their fans and unlocking new revenue streams.",
    text2:
      "For instance, fans can participate and influence club-related decisions through surveys and polls, such as messages the captain should wear on his armband. The company aims to bridge the gap between being an active and a passive fan.",
    text3:
      "Chiliz has developed partnerships with some of the biggest sporting institutions in the world: FC Barcelona, Manchester City, Juventus Turin, and Paris Saint-Germain. It also boasts partnerships with the UFC and gaming organizations. By purchasing CHZ, fans get access to various fan tokens and literally have a stake in their club.",
    popularity: "#104",
    marketCap: "$111.94B",
    volume: "$22.26B",
    circulationSupply: "92.12B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "INJ",
    subTitle: "Injective",
    isCrypto: true,
    isStock: false,
    text1:
      "Chiliz is the leading digital currency for sports and entertainment by the eponymous Malta-based FinTech provider. It operates the blockchain-based sports entertainment platform Socios, which enables users to participate in the governance of their favorite sports brands. Multiple fan tokens by Socios.com are an example of that. For sports clubs and associations, fan tokens offer a way of connecting with their fans and unlocking new revenue streams.",
    text2:
      "For instance, fans can participate and influence club-related decisions through surveys and polls, such as messages the captain should wear on his armband. The company aims to bridge the gap between being an active and a passive fan.",
    text3:
      "Chiliz has developed partnerships with some of the biggest sporting institutions in the world: FC Barcelona, Manchester City, Juventus Turin, and Paris Saint-Germain. It also boasts partnerships with the UFC and gaming organizations. By purchasing CHZ, fans get access to various fan tokens and literally have a stake in their club.",
    popularity: "#104",
    marketCap: "$111.94B",
    volume: "$22.26B",
    circulationSupply: "92.12B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "PYTH",
    subTitle: "pyth-network",
    isCrypto: true,
    isStock: false,
    text1:
      "Chiliz is the leading digital currency for sports and entertainment by the eponymous Malta-based FinTech provider. It operates the blockchain-based sports entertainment platform Socios, which enables users to participate in the governance of their favorite sports brands. Multiple fan tokens by Socios.com are an example of that. For sports clubs and associations, fan tokens offer a way of connecting with their fans and unlocking new revenue streams.",
    text2:
      "For instance, fans can participate and influence club-related decisions through surveys and polls, such as messages the captain should wear on his armband. The company aims to bridge the gap between being an active and a passive fan.",
    text3:
      "Chiliz has developed partnerships with some of the biggest sporting institutions in the world: FC Barcelona, Manchester City, Juventus Turin, and Paris Saint-Germain. It also boasts partnerships with the UFC and gaming organizations. By purchasing CHZ, fans get access to various fan tokens and literally have a stake in their club.",
    popularity: "#104",
    marketCap: "$111.94B",
    volume: "$22.26B",
    circulationSupply: "92.12B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "ADA",
    subTitle: "Cardano",
    isCrypto: true,
    isStock: false,
    text1:
      "Cardano is a proof-of-stake blockchain platform that says its goal is to allow “changemakers, innovators and visionaries” to bring about positive global change.",
    text2:
      "The open-source project also aims to “redistribute power from unaccountable structures to the margins to individuals” — helping to create a society that is more secure, transparent and fair.",
    text3:
      "Cardano was founded back in 2017, and named after the 16th century Italian polymath Gerolamo Cardano. The native ADA token takes its name from the 19th century mathematician Ada Lovelace, widely regarded as the world’s first computer programmer. The ADA token is designed to ensure that owners can participate in the operation of the network. Because of this, those who hold the cryptocurrency have the right to vote on any proposed changes to the software.",
    popularity: "#9",
    marketCap: "$31.94B",
    volume: "$922.26M",
    circulationSupply: "36.12B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "XLM",
    subTitle: "Stellar",
    isCrypto: true,
    isStock: false,
    text1:
      "Stellar (XLM) is a peer-to-peer (P2P) decentralized network created in 2014 by The Stellar Development Foundation or Stellar.org. The network officially launched in 2015 with the purpose of connecting the world's financial systems and ensuring a protocol for payment providers and financial institutions. The platform is designed to move financial resources swiftly and reliably at minimal cost. Stellar links people, banks, payment processors and allows users to create, send and trade multiple types of crypto.",
    text2:
      "The basis of the network is its native digital currency - XLM or Lumens. XLM acts as an intermediate currency for operations and is also used to pay transaction fees. How it works: the protocol converts money in a few seconds, first into XLM, and then into the requested currency.",
    text3:
      "The Stellar payment protocol is based on distributed ledger technology -- an open-source development, community-owned and distributed by community. The crypto asset of the Stellar platform helps with cross-border transactions, overcoming the problems of high fees and slow procedures. XLM is more focused on assisting individuals transfer money than they are with institutions. Thus, Stellar offers access to financial systems, and people can send money at low cost and promptly around the world.",
    popularity: "#19",
    marketCap: "$10.94B",
    volume: "$342.26M",
    circulationSupply: "30.28B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "SUI",
    subTitle: "Sui",
    isCrypto: true,
    isStock: false,
    text1:
      "Sui is a groundbreaking layer-1 blockchain platform designed to support the needs of global adoption by offering a secure, powerful, and scalable development platform. At its core, Sui leverages a novel object-centric data model and the secure Move programming language to address inefficiencies prevalent in existing blockchain architectures.",
    text2:
      "On top of strong technical foundations, Sui prioritizes user experience by eliminating barriers commonly associated with blockchain interactions. Through innovations like zkLogin, sponsored transactions, and programmable transaction blocks, Sui creates a higher standard for user experience within Web3 by ensuring applications are accessible and user-friendly.",
    text3:
      "Sui’s innovative architecture offers low-latency transactions with stable transaction fees, high throughput through horizontal scaling and parallelized execution, and empowers developers with powerful capabilities and tools to craft the next generation of Web3 applications.",
    popularity: "#13",
    marketCap: "$13.94B",
    volume: "$1.82B",
    circulationSupply: "3.5B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "MANA",
    subTitle: "Decentraland",
    isCrypto: true,
    isStock: false,
    text1:
      "Decentraland (MANA) defines itself as a virtual reality platform powered by the Ethereum blockchain that allows users to create, experience, and monetize content and applications.",
    text2:
      "Decentraland was launched following a $24 million initial coin offering (ICO) that was conducted in 2017. The virtual world launched its closed beta in 2019 and opened to the public in February 2020. Since then, users have created a wide range of experiences on their parcels of LAND, including interactive games, sprawling 3D scenes and a variety of other interactive experiences.",
    text3:
      "Decentraland uses two tokens: MANA and LAND. MANA is an ERC-20 token that must be burned to acquire non-fungible ERC-721 LAND tokens. MANA tokens can also be used to pay for a range of avatars, wearables, names, and more on the Decentraland marketplace. Decentraland (MANA) is a decentralized virtual world platform with software based on the Ethereum blockchain, where users create, test and monetize content. In short: users buy virtual plots of land as NFTs with MANA tokens on the Decentraland platform. Progress in the game depends only on players themselves, their efforts and their imagination.",
    popularity: "#104",
    marketCap: "$111.94B",
    volume: "$22.26B",
    circulationSupply: "92.12B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "BEAM",
    subTitle: "beam-2",
    isCrypto: true,
    isStock: false,
    text1:
      "Chiliz is the leading digital currency for sports and entertainment by the eponymous Malta-based FinTech provider. It operates the blockchain-based sports entertainment platform Socios, which enables users to participate in the governance of their favorite sports brands. Multiple fan tokens by Socios.com are an example of that. For sports clubs and associations, fan tokens offer a way of connecting with their fans and unlocking new revenue streams.",
    text2:
      "For instance, fans can participate and influence club-related decisions through surveys and polls, such as messages the captain should wear on his armband. The company aims to bridge the gap between being an active and a passive fan.",
    text3:
      "Chiliz has developed partnerships with some of the biggest sporting institutions in the world: FC Barcelona, Manchester City, Juventus Turin, and Paris Saint-Germain. It also boasts partnerships with the UFC and gaming organizations. By purchasing CHZ, fans get access to various fan tokens and literally have a stake in their club.",
    popularity: "#104",
    marketCap: "$111.94B",
    volume: "$22.26B",
    circulationSupply: "92.12B",
    SevenDaysexchangeRate: "2.34%",
    tewentyFourhourExchangeRate: "+7.21%",
    onemonthExchangeRate: "+32.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "EQSTK",
    subTitle: "EqStocks ETF",
    isCrypto: false,
    isStock: false,
    text1:
      "The EqStocks ETF is an exchange-traded fund that predominantly holds digital tokens representing ownership in a diverse selection of stocks tracked by a specific index. This ETF leverages blockchain technology to provide investors with exposure to the underlying index components through tokenized assets.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "ETH",
    subTitle: "Ethereum",
    isCrypto: true,
    isStock: false,
    text1:
      " Ethereum (ETH) is the second-largest cryptocurrency token in terms of market capitalization. This is due to the fact that it has brought a lot of innovation and use-cases within the industry by introducing smart contract functionality, which has paved the way for the decentralized finance industry (DeFi) and decentralized apps, or Dapps.",
    text2:
      " Ethereum allows users to build and deploy software, commonly in the form of Dapps, which are then powered by a global distributed network of computers all running Ethereum. The Ethereum network is decentralized, making it highly resistant to any form of censorship or downtime.",
    text3:
      "  The Ethereum network can be used by anybody to create and run smart contracts, which are software programs that run autonomously, without user intervention. Ethereum’s growth can be attributed in part to its smart contract capability, which has enabled a growing ecosystem of Dapps, non-fungible tokens (NFTs) and more.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "GOOGL",
    subTitle: "Indexx Stock Token",
    isCrypto: false,
    isStock: true,
    text1:
      " Google's GOOGL stock token grants you ownership in Alphabet Inc., the parent company of Google. GOOG tokens are essential for those who want to partake in the future developments of the world's leading search engine and technology company. It's an ideal time to invest, with potential for value appreciation in the coming months.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "INDXXF",
    subTitle: "Indexx Focus ETF",
    isCrypto: false,
    isStock: false,
    text1:
      "The Indexx Focus ETF is an exchange-traded fund focused on digital tokens that represent ownership in a particular stock market index. Instead of holding actual stocks, it primarily comprises these tokens, which are often blockchain-based. This ETF offers a convenient and decentralized way to gain exposure to the performance of the underlying index. 70% Indexx Tokens, 30% Other Main Tokens",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "LINK",
    subTitle: "ChainLink",
    isCrypto: true,
    isStock: false,
    text1:
      " Founded in 2017, Chainlink is a blockchain abstraction layer that enables universally connected smart contracts. Through a decentralized oracle network, Chainlink allows blockchains to securely interact with external data feeds, events and payment methods, providing the critical off-chain information needed by complex smart contracts to become the dominant form of digital agreement.",
    text2:
      "The Chainlink Network is driven by a large open-source community of data providers, node operators, smart contract developers, researchers, security auditors and more. The company focuses on ensuring that decentralized participation is guaranteed for all node operators and users looking to contribute to the network.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "LTC",
    subTitle: "Litecoin",
    isCrypto: true,
    isStock: false,
    text1:
      "Litecoin (LTC) is an alternative cryptocurrency created in October 2011 by Charles Lee, a former Google engineer. Litecoin was adapted from Bitcoin's open-source code but with several modifications. Like Bitcoin, Litecoin is based on an open-source global payment network that is not controlled by any central authority. Litecoin differs from Bitcoin in aspects like faster block generation rate and use of Scrypt as a proof of work scheme.",
    text2:
      "It is considered to be among the first altcoins, derived from Bitcoin's original open-source code. Initially, it was a strong competitor to Bitcoin. However, as the cryptocurrency market has become much more saturated and competitive in recent years with new offerings, Litecoin's popularity has waned somewhat.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "MATIC",
    subTitle: "matic-network",
    isCrypto: true,
    isStock: false,
    text1:
      "Polygon (previously Matic Network) is the first well-structured, easy-to-use platform for Ethereum scaling and infrastructure development. Its core component is Polygon SDK, a modular, flexible framework that supports building multiple types of applications.",
    text2:
      "Using Polygon, one can create optimistic rollup chains, ZK rollup chains, stand alone chains or any other kind of infra required by the developer. Polygon effectively transforms Ethereum into a full-fledged multi-chain system (aka Internet of Blockchains). This multi-chain system is akin to other ones such as Polkadot, Cosmos, Avalanche etc. with the advantages of Ethereum’s security, vibrant ecosystem and openness.",
    text3:
      "Polygon (formerly Matic Network) is a Layer 2 scaling solution backed by Binance and Coinbase. The project seeks to stimulate mass adoption of cryptocurrencies by resolving the problems of scalability on many blockchains.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "META",
    subTitle: "Indexx Stock Token",
    isCrypto: false,
    isStock: true,
    text1:
      "Meta's META stock token represents ownership in the parent company of the world's largest social media platform, among other tech ventures. Owning META tokens means you're part of Meta Platforms, Inc.'s endeavors in social networking and the metaverse. With expectations of value appreciation in the coming 3 - 6 months",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "MSFT",
    subTitle: "Indexx Stock Token",
    isCrypto: false,
    isStock: true,
    text1:
      "Microsoft's MSFT stock token provides ownership in the renowned technology giant, Microsoft Corporation. Investing in MSFT tokens means you're aligned with Microsoft's ongoing innovations in software, cloud computing, and more. It's anticipated to increase in value in the coming 3 - 6 months.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "NVDA",
    subTitle: "Indexx Stock Token",
    isCrypto: false,
    isStock: true,
    text1:
      " Nvidia's NVDA stock token represents ownership in the leading graphics processing unit (GPU) manufacturer. Investing in NVDA tokens allows you to align with Nvidia's advancements in artificial intelligence, gaming, and data center solutions. With expectations of value appreciation over the next 3 - 6 months.",
    text2:
      "Over the past 24 hours, the trading volume for Tether USDt has increased by $-2,425,573,942,181.26, representing a -46.417% rise. Moreover, USDT worth $52.26B has been traded in the last day.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "PEP",
    subTitle: "Indexx Stock Token",
    isCrypto: false,
    isStock: true,
    text1:
      "Pepsico's PEP stock token represents a share in one of the world's leading food and beverage companies. Holding PEP stock tokens enables you to participate in Pepsico's global growth and portfolio of popular brands. It's expected to see value growth within the next 3 - 6 months.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "SHIB",
    subTitle: "Shiba-Inu",
    isCrypto: true,
    isStock: false,
    text1:
      "SHIB is the main token of the Shiba Inu ecosystem, bringing the power of a decentralized, community-led currency to millions across the globe. Since its inception in late 2020, the Ethereum-based SHIB token has grown to become a worldwide phenomenon, and is now accepted as a form of payment at hundreds of locations, either directly or through third-party intermediaries.",
    text2:
      "Shiba Inu coin was created anonymously in August 2020 under the pseudonym Ryoshi. Ryoshi says about himself that he is a nobody and not important and that the efforts to unmask his identity, even if successful, would be underwhelming. This meme coin quickly gained speed and value as a community of investors was drawn in by the cute charm of the coin paired with headlines and tweets from personalities like Elon Musk and Vitalik Buterin. Vitalik Buterin was long believed to be the originator of Shiba Inu, but denied such rumors on the Lex Fridman podcast on June 5, 2021.",
    text3:
      "Since release SHIB now trades on the ecosystem's proprietary DEX, ShibaSwap. On Sept. 17, 2021, Coinbase, the largest U.S.-based crypto exchange, listed Shiba Inu on their platform. This news caused Shiba Inu price to rise by over 40% in the following two days, bringing the meme dog token into the spotlight again.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "SNP500",
    subTitle: "Indexx Stock Token",
    isCrypto: false,
    isStock: true,
    text1:
      " The S&P 500 stock token (SPX) is an investment in a diverse portfolio of the 500 largest publicly-traded companies in the United States. Holding SPX tokens enables you to track the performance of the U.S. stock market as a whole. With potential for value changes based on overall market performance.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "SOL",
    subTitle: "Solana",
    isCrypto: true,
    isStock: false,
    text1:
      "Solana is a highly functional open source project that banks on blockchain technology’s permissionless nature to provide decentralized finance (DeFi) solutions. While the idea and initial work on the project began in 2017, Solana was officially launched in March 2020 by the Solana Foundation with headquarters in Geneva, Switzerland.",
    text2:
      "The Solana protocol is designed to facilitate decentralized app (DApp) creation. It aims to improve scalability by introducing a proof-of-history (PoH) consensus combined with the underlying proof-of-stake (PoS) consensus of the blockchain.",
    text3:
      "Because of the innovative hybrid consensus model, Solana enjoys interest from small-time traders and institutional traders alike. A significant focus for the Solana Foundation is to make decentralized finance accessible on a larger scale.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "TLSA",
    subTitle: "Indexx Stock Token",
    isCrypto: false,
    isStock: true,
    text1:
      " Tesla's TSLA stock token represents ownership in the electric vehicle and clean energy giant, Tesla Inc. Holding TSLA stock tokens allows you to share in the company's success and future innovations. It's an opportune moment to invest in Tesla's growth. TSLA tokens are expected to increase in value over the next 3 - 6 months.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "TOB",
    subTitle: "Token Blend ETF",
    isCrypto: false,
    isStock: false,
    text1:
      "The Token Blend ETF is an exchange-traded fund designed to provide investors with a combination of exposure to a particular index, typically composed of stocks, and other digital tokens representing various assets. This ETF allocates 50% of its holdings to the specified index and the remaining 50% to a diverse range of other tokenized assets, offering a balanced investment approach.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "TRX",
    subTitle: "Tron",
    isCrypto: true,
    isStock: false,
    text1:
      "TRON (TRX) is a decentralized blockchain-based operating system developed by the Tron Foundation and launched in 2017. Originally TRX tokens were ERC-20-based tokens deployed on Ethereum, but a year later they were moved to their own network.",
    text2:
      "Initially, the project was created with the aim of providing full ownership rights to makers of digital content. The main goal is to help content creators (who receive only a small part of the income) and encourage them with more rewards for their work. How: invite content consumers to reward content makers directly (without intermediaries like YouTube, Facebook or Apple).",
    text3:
      "The TRON software supports smart contracts, various kinds of blockchain systems, and decentralized applications aka dApps. The cryptocurrency platform uses a transaction model similar to Bitcoin (BTC), namely UTXO. Transactions take place in a public ledger, where users can track the history of operations.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "TUSD",
    subTitle: "True USD",
    isCrypto: true,
    isStock: false,
    text1:
      "Launched in 2014, Tether is a blockchain-enabled platform designed to facilitate the use of fiat currencies in a digital manner. Tether works to disrupt the conventional financial system via a more modern approach to money. Tether has made headway by giving customers the ability to transact with traditional currencies across the blockchain, without the inherent volatility and complexity typically associated with a digital currency. As the first blockchain-enabled platform to facilitate the digital use of traditional currencies (a familiar, stable accounting unit), Tether has democratised cross-border transactions across the blockchain.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "USDC",
    subTitle: "USDC",
    isCrypto: true,
    isStock: false,
    text1:
      " USDC is a stablecoin that is pegged to the U.S. dollar on a 1:1 basis. Every unit of this cryptocurrency in circulation is backed up by $1 that is held in reserve, in a mix of cash and short-term U.S. Treasury bonds. The Centre consortium, which is behind this asset, says USDC is issued by regulated financial institutions.",
    text2:
      "The stablecoin originally launched on a limited basis in September 2018. Put simply, USDC’s mantra is “digital money for the digital age” — and the stablecoin is designed for a world where cashless transactions are becoming more common.",
    text3:
      " Several use cases have been unveiled for the USDC. As well as providing a safe haven for crypto traders in times of volatility, those behind the stablecoin say it can also allow businesses to accept payments in digital assets, and shake up an array of sectors including decentralized finance and gaming. Overall, the goal is to create an ecosystem where USDC is accepted by as many wallets, exchanges, service providers and dApps as possible.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "USDT",
    subTitle: "Tether",
    isCrypto: true,
    isStock: false,
    text1:
      "Tether USDt is experiencing a decline in value this week. Currently,Tether USDt is priced at $0.9999988 per USDT, with a circulating supply of 111.94B USDT, resulting in a total market capitalisation of $111.94B.",
    text2:
      "Over the past 24 hours, the trading volume for Tether USDt has increased by $-2,425,573,942,181.26, representing a -46.417% rise. Moreover, USDT worth $52.26B has been traded in the last day.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
  {
    title: "XRP",
    subTitle: "Ripple",
    isCrypto: true,
    isStock: false,
    text1:
      "Launched in 2021, the XRP Ledger (XRPL) is an open-source, permissionless and decentralized technology. Benefits of the XRP Ledger include its low-cost ($0.0002 to transact), speed (settling transactions in 3-5 seconds), scalability (1,500 transactions per second) and inherently green attributes (carbon-neutral and energy-efficient). The XRP Ledger also features the first decentralized exchange (DEX) and custom tokenization capabilities built into the protocol. Since 2012, the XRP Ledger has been operating reliably, having closed 70 million ledgers.",
    text2:
      "In 2012, David Schwartz, Jed McCaleb and Arthur Britto launched the XRP Ledger with its native currency XRP as a faster, more energy-efficient alternative to the Bitcoin blockchain. In September that year, along with Chris Larsen, they founded the company that is today known as Ripple.",
    popularity: "#3",
    marketCap: "$111.94B",
    volume: "$52.26B",
    circulationSupply: "111.94B",
    SevenDaysexchangeRate: "-0.04%",
    tewentyFourhourExchangeRate: "+0.08%",
    onemonthExchangeRate: "+0.05%",
    threemonthExchangeRate: "+0.01%",
  },
];

const redisClient = createClient({
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
  },
});
const currencyService: CurrencyService = new CurrencyService();
const binance = new Binance().options({
  APIKEY: keys.BinanceKey.key,
  APISECRET: keys.BinanceSecret.key,
  family: 0,
});

export async function cryptoPrice(coins: string[]) {
  try {
    let data = [];
    for (let i = 0; i < coins.length; i++) {
      let querySymbol = `${coins[i]}USDT`;
      let results: PriceTicker = await binance.prevDay(querySymbol);
      //console.log("result", results);
      let final = {
        symbol: results.symbol,
        priceChange: Number(results.priceChange),
        priceChangePercent: Number(results.priceChangePercent),
        lastPrice: Number(results.lastPrice),
        highPrice: Number(results.highPrice),
        lowPrice: Number(results.lowPrice),
      };
      data.push(final);
    }
    return { status: 200, data: data };
  } catch (err) {
    console.log(err);
    return { status: 500, data: { message: "Unhandled error: " + err } };
  }
}

export async function getCryptoPriceBySymobl(coin: string) {
  try {
    if (coin === "USDT") {
      console.log("I am here");
      coin = "USDC";
    }
    let querySymbol = `${coin}USDT`;
    let results: PriceTicker = await binance.prevDay(querySymbol);
    //console.log("result", results);
    let final = {
      symbol: results.symbol,
      priceChange: Number(results.priceChange),
      priceChangePercent: Number(results.priceChangePercent),
      lastPrice: Number(results.lastPrice),
      highPrice: Number(results.highPrice),
      lowPrice: Number(results.lowPrice),
    };
    return { status: 200, data: final };
  } catch (err) {
    console.log("Some err with", coin);
    console.log("Some err with cond1", coin === "USDT");
    console.log("Some err with cond2", String(coin).localeCompare("USDT"));
    return {
      status: 500,
      data: {
        symbol: coin,
        priceChange: 0,
        priceChangePercent: 0,
        lastPrice: 0,
        highPrice: 0,
        lowPrice: 0,
      },
    };
  }
}

export async function getIndexxTokensPrice() {
  try {
    let INXCPrice = await getIndexxCryptoPrice();
    let IN500Price = await getIndexxIN500Price();
    let USDPPrice = await getIndexxUSDPPrice();
    return {
      status: 200,
      data: {
        INXCPrice: INXCPrice,
        IN500Price: IN500Price,
        USDPPrice: USDPPrice,
      },
    };
  } catch (err) {
    console.log(err);
    return { status: 500, data: { message: "Unhandled error: " + err } };
  }
}

export async function getBinancePrices() {
  try {
    let results = await binance.prices();
    return { status: 200, data: results };
  } catch (err) {
    console.log(err);
    return { status: 500, data: { message: "Unhandled error: " + err } };
  }
}

export async function getPriceByName(name: string) {
  try {
    if (name === "INXC") {
      let INXCPrice = await currencyService.findOne({
        code: "INXC",
        type: "BUY",
      });
      return { status: 200, data: Number(INXCPrice.buyPrice) };
    }
    if (name === "WIBS") {
      // 1) Try Redis cache (1 hour TTL)
      try {
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }
        const cacheKey = `price:WIBS`;
        const cached = await redisClient.get(cacheKey);
        if (cached !== null) {
          return { status: 200, data: Number(cached) };
        }
      } catch (e) {
        // proceed without cache
      }

      // 2) Prefer Moralis Solana token price
      let finalPrice: number | null = null;
      // try {
      //   const mint = "EM6R4tQ15598xsA7GwefGwCq2Z4MbV6H3FYHfh8ENBTY";
      //   const url = `https://solana-gateway.moralis.io/token/mainnet/${mint}/price`;
      //   const response = await axios.get(url, {
      //     timeout: 8000,
      //     headers: {
      //       Accept: "application/json",
      //       "X-API-Key": keys.Moralis.key,
      //     },
      //   });
      //   const price = Number(response?.data?.usdPrice);
      //   if (!isNaN(price) && price > 0) {
      //     finalPrice = price;
      //   }
      // } catch (e) { }

      // // 3) Fallback to pump.fun
      // if (finalPrice === null) {
      //   try {
      //     const mint = "EM6R4tQ15598xsA7GwefGwCq2Z4MbV6H3FYHfh8ENBTY";
      //     const url = `https://frontend-api.pump.fun/coins/${mint}`;
      //     const pf = await axios.get(url, { timeout: 8000 });
      //     const d = pf?.data || {};
      //     const p = Number(d.priceUsd ?? d.usdPrice ?? d.price ?? d.price_usd);
      //     if (!isNaN(p) && p > 0) {
      //       finalPrice = p;
      //     }
      //   } catch { }
      // }

      // 4) Final fallback to internal price
      if (finalPrice === null) {
        const WIBSPrice = await currencyService.findOne({
          code: "WIBS",
          type: "BUY",
        });
        finalPrice = Number(WIBSPrice?.buyPrice ?? 0);
      }

      // Cache for 1 hour if redis available
      try {
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }
        await redisClient.set(`price:WIBS`, String(finalPrice));
        await redisClient.expire(`price:WIBS`, 3600);
      } catch { }

      return { status: 200, data: finalPrice };
    }
    if (name === "IN500") {
      let INXCPrice = await currencyService.findOne({
        code: "IN500",
        type: "BUY",
      });
      return { status: 200, data: Number(INXCPrice.buyPrice) };
    }
    if (name === "IUSD+") {
      let USDPPrice = await currencyService.findOne({
        code: "IUSD+",
        type: "BUY",
      });
      return { status: 200, data: Number(USDPPrice.buyPrice) };
    }
    if (name === "INEX") {
      let INEXPrice = await currencyService.findOne({
        code: "INEX",
        type: "BUY",
      });
      return { status: 200, data: Number(INEXPrice.buyPrice) };
    }
    if (name === "DaCrazy") {
      let dacrazyPrice = await currencyService.findOne({
        code: "DaCrazy",
        type: "BUY",
      });
      return { status: 200, data: Number(dacrazyPrice.buyPrice) };
    }

    if (name === "BTCY") {
      const liveBtcUsdPrice = await getLiveBtcUsdPrice();
      if (liveBtcUsdPrice) {
        // Calculate 1 BTC = 1,000,000 BTCY -> 1 BTCY = BTC price / 1,000,000
        const btcyPriceInUsd = Number((liveBtcUsdPrice / 1_000_000).toFixed(12));
        return { status: 200, data: btcyPriceInUsd };
      }

      const storedBtcyPrice = await getStoredBtcyPrice();
      if (storedBtcyPrice) {
        return { status: 200, data: storedBtcyPrice };
      }

      return {
        status: 500,
        data: 0,
        message: "Unable to resolve live BTCY price",
      };
    }

    const tokens = [
      "AAPL",
      "APPL",
      "AMZN",
      "BCM",
      "GOOGL",
      "META",
      "MSFT",
      "NVDA",
      "PEP",
      "SPX",
      "TSLA",
      "TLSA",
      "SNP500",
    ];
    console.log("tokens.includes(name)", tokens.includes(name));
    if (tokens.includes(name)) {
      let c: string =
        name === "AAPL"
          ? "AAPL"
          : name === "APPL"
            ? "AAPL"
            : name === "AMZN"
              ? "AMZN"
              : name === "BCM"
                ? "AVGO"
                : name === "GOOGL"
                  ? "GOOGL"
                  : name === "META"
                    ? "META"
                    : name === "MSFT"
                      ? "MSFT"
                      : name === "NVDA"
                        ? "NVDA"
                        : name === "PEP"
                          ? "PEP"
                          : name === "SNP500"
                            ? "SPX"
                            : name === "SPX"
                              ? "SPX"
                              : "TSLA";
      console.log("c", c, name);
      const getStockVale = await getLatestStockPrice(c);
      console.log("final price", getStockVale / 1);
      return { status: 200, data: Number(getStockVale / 1) };
    } else {
      console.log("name === USDT", name === "USDT");
      console.log("name.stringUSDT", String(name).localeCompare("USDT"));
      if (name === "USDT" || name === "USDC") {
        console.log("I am here");
        return { status: 200, data: Number(1) };
      } else {
        name = (name === "BEAM") ? "BEAMX" : name;
        let querySymbol = `${name}USDT`;
        let results = await binance.prices(querySymbol);
        return { status: 200, data: Number(results[querySymbol]) };
      }
    }
  } catch (err: any) {
    console.error("[getPriceByName] unhandled price lookup error", {
      name,
      message: err?.message || String(err),
      errorName: err?.name,
      code: err?.code,
      responseStatus: err?.response?.status,
      responseData: err?.response?.data,
      stack: err?.stack,
    });
    return { status: 500, data: 0 };
  }
}

export async function getPrevDayPriceByName(name: string, network?: string) {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    const cacheKey = `previousDayPrice:${name}`;
    const cachedPrice = await redisClient.get(cacheKey);

    if (cachedPrice !== null) {
      return { status: 200, data: Number(cachedPrice) };
    }

    let price;
    // Special handling for WIBS previous-day price: use Moralis/pump.fun spot with 1h cache
    if (name === "WIBS") {
      try {
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }
        const wibsCacheKey = `price:WIBS`;
        const cached = await redisClient.get(wibsCacheKey);
        if (cached !== null) {
          await redisClient.set(cacheKey, cached);
          await redisClient.expire(cacheKey, 86400);
          return { status: 200, data: Number(cached) };
        }
      } catch { }

      let finalPrice: number | null = null;
      // try {
      //   const mint = "EM6R4tQ15598xsA7GwefGwCq2Z4MbV6H3FYHfh8ENBTY";
      //   const url = `https://solana-gateway.moralis.io/token/mainnet/${mint}/price`;
      //   const response = await axios.get(url, {
      //     timeout: 8000,
      //     headers: { Accept: "application/json", "X-API-Key": keys.Moralis.key },
      //   });
      //   const p = Number(response?.data?.usdPrice);
      //   if (!isNaN(p) && p > 0) finalPrice = p;
      // } catch { }

      // if (finalPrice === null) {
      //   try {
      //     const mint = "EM6R4tQ15598xsA7GwefGwCq2Z4MbV6H3FYHfh8ENBTY";
      //     const url = `https://frontend-api.pump.fun/coins/${mint}`;
      //     const pf = await axios.get(url, { timeout: 8000 });
      //     const d = pf?.data || {};
      //     const p = Number(d.priceUsd ?? d.usdPrice ?? d.price ?? d.price_usd);
      //     if (!isNaN(p) && p > 0) finalPrice = p;
      //   } catch { }
      // }

      if (finalPrice === null) {
        const WIBSPrice = await currencyService.findOne({ code: "WIBS", type: "BUY" });
        finalPrice = Number(WIBSPrice?.buyPrice ?? 0);
      }

      try {
        if (!redisClient.isOpen) {
          await redisClient.connect();
        }
        await redisClient.set(`price:WIBS`, String(finalPrice));
        await redisClient.expire(`price:WIBS`, 3600);
      } catch { }

      await redisClient.set(cacheKey, String(finalPrice));
      await redisClient.expire(cacheKey, 86400);
      return { status: 200, data: finalPrice };
    }

    if (name === "BTCY") {
        let querySymbol = `BTCUSDT`;
        let results = await binance.prices(querySymbol);
        console.log("results", results);
        let btcPrice = Number(results[querySymbol]);

        // Calculate 1 BTC = 1,000,000 BTCY -> 1 BTCY = btcPrice / 1,000,000
        let btcyPriceInUSDT = btcPrice / 1_000_000;

        console.log(`Calculated BTCY price (1 BTC = 1,000,000 BTCY): ${btcyPriceInUSDT}`);

        return { status: 200, data: Number(btcyPriceInUSDT) };
      }

    if (
      name === "INXC" ||
      name === "IN500" ||
      name === "IUSD+" ||
      name === "INEX" ||
      name === "DaCrazy"
    ) {
      let priceData = await currencyService.findOne({
        code: name,
        type: "BUY",
      });
      price = Number(priceData.buyPrice);
    } else {
      const tokens = [
        "AAPL",
        "APPL",
        "AMZN",
        "BCM",
        "GOOGL",
        "META",
        "MSFT",
        "NVDA",
        "PEP",
        "SPX",
        "TSLA",
        "TLSA",
        "SNP500",
      ];

      if (tokens.includes(name)) {
        let c =
          name === "AAPL"
            ? "AAPL"
            : name === "APPL"
              ? "AAPL"
              : name === "AMZN"
                ? "AMZN"
                : name === "BCM"
                  ? "AVGO"
                  : name === "GOOGL"
                    ? "GOOGL"
                    : name === "META"
                      ? "META"
                      : name === "MSFT"
                        ? "MSFT"
                        : name === "NVDA"
                          ? "NVDA"
                          : name === "PEP"
                            ? "PEP"
                            : name === "SNP500"
                              ? "SPX"
                              : name === "SPX"
                                ? "SPX"
                                : "TSLA";

        const getStockVale = await getPreviousDayPrice(c);
        price = Number(getStockVale.data);
      } else if (
        name.includes("EQSTK") ||
        name.includes("INDXXF") ||
        name.includes("CRYC10") ||
        name.includes("TOB") ||
        name.includes("ALCRYP")
      ) {
        const getLatestPrice = await getLatestPriceOfETF(name);
        price = Number(getLatestPrice?.data.totalETFPrice);
      } else if (name === "USDT" || name === "USDC") {
        price = 1;
      } else {
        const newName = allTokens.find((x) => x.title === name);
        console.log("newName", newName?.subTitle);
        const previousDay = await adjustForNonWorkingDays(
          moment().subtract(1, "days")
        );
        const previousDayString = previousDay.format("DD-MM-YYYY");

        const response = await axios.get(
          `https://api.coingecko.com/api/v3/coins/${String(
            newName?.subTitle
          ).toLowerCase()}/history`,
          {
            params: { date: previousDayString, localization: "false" },
          }
        );

        if (response.data && response.data.market_data) {
          price = Number(response.data.market_data.current_price.usd);
        } else {
          return { status: 404, data: 0 };
        }
      }
    }

    await redisClient.set(cacheKey, price);
    await redisClient.expire(cacheKey, 86400); // cache for 24 hours

    return { status: 200, data: price };
  } catch (err) {
    console.log("Error in getPrevDayPriceByName", err);
    return { status: 500, data: 0 };
  }
}

export async function getsStockPriceByName(name: string): Promise<StockData> {
  try {
    const tokens = [
      "AAPL",
      "APPL",
      "AMZN",
      "BCM",
      "GOOGL",
      "META",
      "MSFT",
      "NVDA",
      "PEP",
      "SPX",
      "TSLA",
      "TLSA",
      "SNP500",
    ];
    console.log("tokens.includes(name)", tokens.includes(name));
    if (tokens.includes(name)) {
      let c: string =
        name === "AAPL"
          ? "AAPL"
          : name === "APPL"
            ? "AAPL"
            : name === "AMZN"
              ? "AMZN"
              : name === "BCM"
                ? "AVGO"
                : name === "GOOGL"
                  ? "GOOGL"
                  : name === "META"
                    ? "META"
                    : name === "MSFT"
                      ? "MSFT"
                      : name === "NVDA"
                        ? "NVDA"
                        : name === "PEP"
                          ? "PEP"
                          : name === "SNP500"
                            ? "SPX"
                            : name === "SPX"
                              ? "SPX"
                              : "TSLA";
      console.log("c", c, name);
      const getStockVale = await getLatestStockData(c);
      console.log("final price", getStockVale);
      return getStockVale;
    } else {
      let res = {
        price: 0,
        priceChangePercentage: 0,
        lowPrice: 0,
        highPrice: 0,
      };
      return res;
    }
  } catch (err) {
    let res = {
      price: 0,
      priceChangePercentage: 0,
      lowPrice: 0,
      highPrice: 0,
    };
    return res;
  }
}

export async function getIndexxCoinsPrice(name: string) {
  try {
    let results = await binance.prices(name);
    return { status: 200, data: results };
  } catch (err) {
    console.log(err);
    return { status: 500, data: { message: "Unhandled error: " + err } };
  }
}
