import { NewGiftCardService } from "../services/newGiftCard.service";

export const allGiftCards = [
    {
        "slug": "gift-card-50",
        "name": "Gift Card $50",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/GIFTS/Gift+Cards/50--.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "gift-card-100",
        "name": "Gift Card $100",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/GIFTS/Gift+Cards/100--.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "gift-card-200",
        "name": "Gift Card $200",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/GIFTS/Gift+Cards/200--.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "gift-card-300",
        "name": "Gift Card $300",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/GIFTS/Gift+Cards/300--.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "gift-card-400",
        "name": "Gift Card $400",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/GIFTS/Gift+Cards/400--.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "gift-card-500",
        "name": "Gift Card $500",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/GIFTS/Gift+Cards/500--.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "gift-card-800",
        "name": "Gift Card $800",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/GIFTS/Gift+Cards/800--.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "gift-card-1000",
        "name": "Gift Card $1000",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/GIFTS/Gift+Cards/1000--.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "crypto-gift-card-1",
        "name": "Bitcoin Card 1",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Crypto/btc_100.png",
        "currencies": [
            "BTC"
        ]
    },
    {
        "slug": "crypto-gift-card-2",
        "name": "Bitcoin Card 2",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Crypto/btc_200.png",
        "currencies": [
            "BTC"
        ]
    },
    {
        "slug": "crypto-gift-card-3",
        "name": "Bitcoin Card 3",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Crypto/btc_300.png",
        "currencies": [
            "BTC"
        ]
    },
    {
        "slug": "crypto-gift-card-4",
        "name": "Bitcoin Card 4",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Crypto/btc_500.png",
        "currencies": [
            "BTC"
        ]
    },
    {
        "slug": "crypto-gift-card-5",
        "name": "Bitcoin Card 5",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Crypto/btc_1000.png",
        "currencies": [
            "BTC"
        ]
    },
    {
        "slug": "crypto-usdt-cards-1",
        "name": "Tether Card 1",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Crypto/usdt+100.png",
        "currencies": [
            "USDT"
        ]
    },
    {
        "slug": "crypto-usdt-cards-2",
        "name": "Tether Card 2",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Crypto/usdt+200.png",
        "currencies": [
            "USDT"
        ]
    },
    {
        "slug": "crypto-usdt-cards-3",
        "name": "Tether Card 3",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Crypto/usdt+300.png",
        "currencies": [
            "USDT"
        ]
    },
    {
        "slug": "crypto-usdt-cards-4",
        "name": "Tether Card 4",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Crypto/usdt+500.png",
        "currencies": [
            "USDT"
        ]
    },
    {
        "slug": "crypto-usdt-cards-5",
        "name": "Tether Card 5",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Crypto/usdt+1000.png",
        "currencies": [
            "USDT"
        ]
    },
    {
        "slug": "bonus-card-50",
        "name": "Bonus Card $50",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Carnival/Bonus/h1+51.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "bonus-card-100",
        "name": "Bonus Card $100",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Carnival/Bonus/h100.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "bonus-card-150",
        "name": "Bonus Card $150",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Carnival/Bonus/h150.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "bonus-card-250",
        "name": "Bonus Card $250",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Carnival/Bonus/h200+1.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-1",
        "name": "Birthday Card 1",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/1.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-2",
        "name": "Birthday Card 2",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/2.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-3",
        "name": "Birthday Card 3",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/3.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-4",
        "name": "Birthday Card 4",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/4.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-5",
        "name": "Birthday Card 5",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/5.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-6",
        "name": "Birthday Card 6",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/6.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-7",
        "name": "Birthday Card 7",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/7.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-8",
        "name": "Birthday Card 8",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/8.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-9",
        "name": "Birthday Card 9",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/9.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-10",
        "name": "Birthday Card 10",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/10.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-11",
        "name": "Birthday Card 11",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/11.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-12",
        "name": "Birthday Card 12",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/12.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-13",
        "name": "Birthday Card 13",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/13.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-14",
        "name": "Birthday Card 14",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/14.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-15",
        "name": "Birthday Card 15",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/15.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-16",
        "name": "Birthday Card 16",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/16.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-17",
        "name": "Birthday Card 17",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/17.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-18",
        "name": "Birthday Card 18",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/18.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-19",
        "name": "Birthday Card 19",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/19.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-20",
        "name": "Birthday Card 20",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/20.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-21",
        "name": "Birthday Card 21",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/21.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-22",
        "name": "Birthday Card 22",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/22.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-23",
        "name": "Birthday Card 23",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Birthday+cards/23.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-gc-2",
        "name": "Greeting Card 2",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Greeting+Cards/G-22.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-gc-1",
        "name": "Greeting Card 1",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Greeting+Cards/G-28.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-gc-3",
        "name": "Greeting Card 3",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Greeting+Cards/G-36+3.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-gc-4",
        "name": "Greeting Card 4",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Greeting+Cards/greet+01.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-gc-5",
        "name": "Greeting Card 5",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Greeting+Cards/greet+02.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-gc-8",
        "name": "Greeting Card 8",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Greeting+Cards/greet+03.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-gc-6",
        "name": "Greeting Card 6",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Greeting+Cards/greet+04.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "greetings-card-gc-7",
        "name": "Greeting Card 7",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Greeting+Cards/greet+05.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "action-pack",
        "name": "Action Pack",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Hiv+Pack/New+Hive+Packs/grenn+ac.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-1",
        "name": "Seasonal Card 1",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/Christmas2.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-2",
        "name": "Seasonal Card 2",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/Christmas3.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-3",
        "name": "Seasonal Card 3",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/Christmas4.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-4",
        "name": "Seasonal Card 4",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/Christmas5.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-5",
        "name": "Seasonal Card 5",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/thanks1.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-6",
        "name": "Seasonal Card 6",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/thanks2.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-7",
        "name": "Seasonal Card 7",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/thanks3.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-8",
        "name": "Seasonal Card 8",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/thanks4.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-9",
        "name": "Seasonal Card 9",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/thanks5.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-10",
        "name": "Seasonal Card 10",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/Christmas1.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-11",
        "name": "Seasonal Card 11",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/Christmas7.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-12",
        "name": "Seasonal Card 12",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/Christmas8.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-13",
        "name": "Seasonal Card 13",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/Christmas9.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-14",
        "name": "Seasonal Card 14",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/Christmas10.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-15",
        "name": "Seasonal Card 15",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/hal1.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-16",
        "name": "Seasonal Card 16",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/hal2.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-17",
        "name": "Seasonal Card 17",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/hal3.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-18",
        "name": "Seasonal Card 18",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/hal4.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-19",
        "name": "Seasonal Card 19",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/hal5.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "seasonal-card-20",
        "name": "Seasonal Card 20",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Greeting/Seasonal/Christmas6.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "cy-pack",
        "name": "Crypto Pack",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Hiv+Pack/New+Hive+Packs/Crypto+Purp.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "power-pack",
        "name": "Power Pack",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Hiv+Pack/New+Hive+Packs/royal+pack_02+1.png",
        "currencies": [
            "USD"
        ]
    },
    {
        "slug": "token-pack",
        "name": "Token Pack",
        "image": "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx-shop/Hiv+Pack/New+Hive+Packs/blue+star+4.png",
        "currencies": [
            "USD"
        ]
    }
]
const newGiftCardService: NewGiftCardService = new NewGiftCardService();

// Function to create a gift card
export async function createGiftCard(
  cardSlug: string,
  email: string,
  amount: number
) {
  // Find the matching gift pack by slug
  const giftPack = allGiftCards.find((pack: any) => pack.slug === cardSlug);

  // Generate a random voucher code
  const voucherCode = Array.from({ length: 4 }, () =>
    Math.random().toString(36).toUpperCase().substring(2, 6)
  ).join("-");

  // Default values
  let cardType = String(giftPack?.currencies[0]);
  let giftCardImgUrl = "default-image-url.png"; // Default image
  let amountPerCurrency = amount; // Default full amount

  if (giftPack) {
    //cardType = giftPack.name; // Use the gift pack name as the card type
    giftCardImgUrl = giftPack.image; // Use the gift pack image
    const currencyCount = giftPack.currencies.length;

    // Divide amount equally if there are multiple currencies
    amountPerCurrency = amount / currencyCount;
  }

  // Create the gift card object
  let userGiftCard = {
    voucher: voucherCode,
    amountPerCurrency: amountPerCurrency, // Divided amount per currency
    amount: Number(amount),
    dateOfGeneration: new Date(),
    isUsed: false,
    type: cardType, // Name of the gift pack
    createdBy: email.toLowerCase(),
    createdOn: new Date(),
    giftCardImgUrl: giftCardImgUrl,
    currencies: giftPack ? giftPack.currencies : ["USD"], // Either the specific currencies or default to IUSD+
  };

  let giftCardDetails = await newGiftCardService.create(userGiftCard);

  return userGiftCard;
}


// Function to create a gift card
export async function createFreeGiftCard(
    cardSlug: string,
    email: string,
    amount: number
  ) {
    // Find the matching gift pack by slug
    const giftPack = allGiftCards.find((pack: any) => pack.slug === cardSlug);
  
    // Generate a random voucher code
    const voucherCode = Array.from({ length: 4 }, () =>
      Math.random().toString(36).toUpperCase().substring(2, 6)
    ).join("-");
  
    // Default values
    let cardType = String(giftPack?.currencies[0]);
    let giftCardImgUrl = "default-image-url.png"; // Default image
    let amountPerCurrency = amount; // Default full amount
  
    if (giftPack) {
      //cardType = giftPack.name; // Use the gift pack name as the card type
      giftCardImgUrl = giftPack.image; // Use the gift pack image
      const currencyCount = giftPack.currencies.length;
  
      // Divide amount equally if there are multiple currencies
      amountPerCurrency = amount / currencyCount;
    }
  
    // Create the gift card object
    let userGiftCard = {
      voucher: voucherCode,
      amountPerCurrency: amountPerCurrency, // Divided amount per currency
      amount: Number(amount),
      dateOfGeneration: new Date(),
      isUsed: false,
      type: cardType, // Name of the gift pack
      createdBy: email.toLowerCase(),
      createdOn: new Date(),
      giftCardImgUrl: giftCardImgUrl,
      currencies: giftPack ? giftPack.currencies : ["USD"], // Either the specific currencies or default to IUSD+
    };
  
    let giftCardDetails = await newGiftCardService.create(userGiftCard);
  
    return userGiftCard;
  }