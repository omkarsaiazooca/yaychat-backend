import { SorektNFTTx } from "../data/sorektNFTTx";
import { UserRoleTypes } from "../data/user";
import { UserOperations } from "../platform/user.operations";
import { CurrencyService } from "../services/currency.service";
import { SorektNFTTxService } from "../services/sorekt.service";
import { ethers } from "ethers";
import { UserService } from "../services/user.service";
import { keys } from "../config/keys";
import { test_Sorekt_NFT } from "../helpers/test_sorekt_nft";
import { testSoRekttokenABI } from "../helpers/test_sorekt";
import { CoreWalletService } from "../services/coreWallet.service";
import { CoreWallet } from "../data/coreWallet";
import { decryptData } from "../services/crypto.service";
import { whiteListedUsers } from "../helpers/sorektWhitelistedUsers";
var Web3 = require("web3");

let coreWalletService: CoreWalletService = new CoreWalletService();
const currencyService: CurrencyService = new CurrencyService();
const userService: UserService = new UserService();
const sorektNFTTxService: SorektNFTTxService = new SorektNFTTxService();
export class SorektController {
  constructor() {}

  async checkTx(req: any, res: any) {
    try {
      let txHash = req.body.txHash;
      let getTx = await sorektNFTTxService.findOne({
        txId: txHash,
      });
      if (getTx) {
        res.status(200).json({
          status: 200,
          message: "Tx already exist",
          data: getTx,
        });
      } else {
        const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
        let rpcURL =
          keys.env.key == "development"
            ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
            : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
        console.log("rpcURL", rpcURL);
        const sorektNFTAdddress =
          keys.env.key == "development" || keys.env.key == "test"
            ? keys.TestIndexxUSDPContract.key
            : keys.MainIndexxUSDPContract.key;
        let rpcProvider = new ethers.providers.JsonRpcProvider(rpcURL);
        let getTx = await rpcProvider.getTransaction(txHash);
        let sorektTx = {
          txId: txHash,
          from: String(""),
          to: String(""),
          amount: Number(),
          info: "",
          txDate: Date.now(),
        } as unknown as SorektNFTTx;
        console.log("getTx", getTx);
        // let updateINEXprice = await sorektNFTTxService.create(sorektTx);
        const iface = new ethers.utils.Interface(test_Sorekt_NFT);
        let decodedData = iface.parseTransaction({
          data: getTx.data,
          value: getTx.value,
        });
        console.log(decodedData);
        console.log(decodedData.functionFragment.name);
        console.log(decodedData.functionFragment.inputs);
        res.status(200).json({
          status: 200,
          message: "Price updated successfully",
          data: "{",
        });
      }
    } catch (err) {
      console.log(err);
    }
  }

  async mintSorekt(req: any, res: any) {
    try {
      let environment = req.body.env;
      let toAddress = req.body.address;
      let amount = req.body.amount;
      const YOUR_INFURA_API_KEY = keys.INFURA_KEY.key;
      let contractAddress;
      let rpcURL =
        environment == "development" || environment == "test"
          ? "https://goerli.infura.io/v3/" + YOUR_INFURA_API_KEY
          : "https://mainnet.infura.io/v3/" + YOUR_INFURA_API_KEY;
      if (environment == "prod") {
        contractAddress = keys.MainSoRektContract.key;
      } else if (
        environment == "test" ||
        environment == "development"
      ) {
        contractAddress = keys.TestSoRektContract.key;
      }
      console.log("contractAddress", contractAddress, rpcURL);
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      let soRektContract = new web3.eth.Contract(
        testSoRekttokenABI,
        contractAddress
      );
      const getCWalletDetails =  await coreWalletService.findOneSelect(
        { coin: "SRT" },
        {}
      );
      
      let privateKey;
      privateKey = await decryptData(getCWalletDetails.coinPrivateKey);
      const signerObj = web3.eth.accounts.privateKeyToAccount(privateKey);
      console.log(signerObj.address);
      let gasEstimate = await soRektContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .estimateGas({ from: signerObj.address });
      let parameter = {
        from: signerObj.address,
        gas: gasEstimate,
      };
      console.log("parameter", parameter)
      web3.eth.accounts.wallet.add(privateKey);
      let soRekt = await soRektContract.methods
        .mint(toAddress, web3.utils.toWei(String(amount), "ether"))
        .send(parameter);

      if (soRekt.status) {
        res.status(200).json({
          status: 200,
          message: "Price updated successfully",
          data: soRekt as any,
        });
      } else {
        return { status: 500, data: "Failed to transfer" as any };
      }
    } catch (err) {
      console.log("err", err);
      return { status: 500, data: "Failed to transfer" as any };
    }
  }


  async checkAddressIsWhitelisted(req: any, res: any) {
    try {
      let userAddress = req.body.address;
      console.log(userAddress)
      console.log(whiteListedUsers.findIndex(item => item.toLowerCase() === userAddress.toLowerCase()))
      if(whiteListedUsers.findIndex(item => item.toLowerCase() === userAddress.toLowerCase()) !== -1) {
        res.status(200).json({
          status: 200,
          message: "Address is whitelisted",
          data: true,
        });
      } else {
        res.status(200).json({
          status: 200,
          message: "Address is not whitelisted",
          data: false,
        });
      }
    } catch(err) {
      console.log(err)
    }
  }
  //This method is used for getting the core wallet details for a specific coin
  async getCoreWalletDetails(coin: string) {
    try {
      console.log('coin', coin)
      let coreWallet = await coreWalletService.findOneSelect(
        { coin: coin },
        {}
      );
      if (coreWallet) {
        return coreWallet;
      } else {
        return {} as CoreWallet;
      }
    } catch (err) {
      return {} as CoreWallet;
    }
  }
}
