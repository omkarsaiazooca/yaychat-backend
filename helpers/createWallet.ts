import { UserService } from "../services/user.service";
import { WalletOperations } from "../platform/wallet.operations";
import { OrderService } from "../services/order.service";

const referralCodes = require("referral-codes");

const userService = new UserService();
let orderService: OrderService = new OrderService();

export async function createFirstTimeWallets(
  email: string,
  inexBalance: number = 0,
  freeTrailUserWallets?: boolean
) {
  try {
    userService
      .findOne({
        email: email,
      })
      .then((element) => {
        console.log(element);
        if (element.email == email) {
          const coins = [
            "ETH",
            "IN500",
            "INXC",
            "INEX",
            "DaCrazy",
            "IUSD+",
            "WIBS",
            "BNB",
            "BTC",
            "USD",
            "DOGE",
            "SHIB",
            "MATIC",
            "USDT",
            "TRX",
            //"FTT",
            //"INXP",
            "APPL",
            "AMZN",
            "BCM",
            "GOOGL",
            "META",
            "MSFT",
            "NVDA",
            "PEP",
            "SNP500",
            "TLSA",
            "CHZ",
            "NOT",
            "FTM",
            "RUNE",
            "NEAR",
            "AAVE",
            "INJ",
            "PYTH",
            "BEAM",
            "VET",
            "AVAX",
            "THETA",
            "ADA",
            "XLM",
            "SUI",
            "MANA",
            "BTCY"
          ];
          coins.forEach((c) => {
            console.log();
            if (c == "ETH") {
              orderService
                .createEthereumWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "IN500") {
              orderService
                .createIN500Wallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "INXC") {
              orderService
                .createINXCWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "INEX") {
              orderService
                .createINEXWallet(
                  element.email,
                  c,
                  inexBalance,
                  freeTrailUserWallets
                )
                .then((x: any) => {
                  console.log(x);
                });
              orderService
                .createMATICINEXWallet(
                  element.email,
                  c,
                  inexBalance,
                  freeTrailUserWallets
                )
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "DaCrazy") {
              orderService
                .createDaCrazyWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "DaCrazy") {
              orderService
                .createDaCrazyWallet(element.email, c)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "IUSD+") {
              orderService
                .createIUSDPWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "WIBS") {
              orderService
                .createETHWIBSWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "BNB") {
              orderService
                .createBinanceWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "FTT") {
              orderService
                .createFTTETHWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "INXP") {
              orderService
                .createINXPWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "BTC") {
              orderService
                .createBitcoinWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "DOGE") {
              orderService
                .createDOGEWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "SHIB") {
              orderService
                .createSHIBBNBWallet(element.email, c, 0, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "CHZ") {
              orderService
                .createChilizWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "NOT") {
              orderService
                .createNotWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "FTM") {
              orderService
                .createFTMWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "RUNE") {
              orderService
                .createThorChainWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "NEAR") {
              orderService
                .createNEARWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "AAVE") {
              orderService
                .createAAVEWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "INJ") {
              orderService
                .createINJWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "PYTH") {
              orderService
                .createPYTHWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "BEAM") {
              orderService
                .createBEAMWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "VET") {
              orderService
                .createVETWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "BTCY") {
              orderService
                .createBitcoinYahWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            }
            else if (c == "AVAX") {
              orderService
                .createAVAXWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "THETA") {
              orderService
                .createTHETAWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            }
            else if (c == "ADA") {
              orderService
                .createADAWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "MANA") {
              orderService
                .createMANAWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "XLM") {
              orderService
                .createXLMWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "SUI") {
              orderService
                .createSUIWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            }else if (c == "USD") {
              orderService
                .createUSDWallet(element.email, c, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "APPL") {
              orderService
                .createIAppleWallet(element.email, c, 0, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "AMZN") {
              orderService
                .createIAmazonWallet(element.email, c, 0, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "BCM") {
              orderService
                .createIBroadcomWallet(
                  element.email,
                  c,
                  0,
                  freeTrailUserWallets
                )
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "GOOGL") {
              orderService
                .createIGoogleWallet(element.email, c, 0, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "META") {
              orderService
                .createIMetaWallet(element.email, c, 0, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "MSFT") {
              orderService
                .createIMicrosoftWallet(
                  element.email,
                  c,
                  0,
                  freeTrailUserWallets
                )
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "NVDA") {
              orderService
                .createINividaWallet(element.email, c, 0, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "PEP") {
              orderService
                .createIPespiCoWallet(element.email, c, 0, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "SNP500") {
              orderService
                .createISNP500Wallet(element.email, c, 0, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            } else if (c == "TLSA" || c == "TSLA") {
              orderService
                .createITelsaWallet(element.email, c, 0, freeTrailUserWallets)
                .then((x: any) => {
                  console.log(x);
                });
            }
          });
        }
      });
    return 200;
  } catch (err) {
    console.log(err);
    return 500;
  }
}
