import { Request, Response } from "express";
import { BaseAPIOperations } from "./base.operations";
import { ethers } from "ethers";
import { IndexxService } from "../services/IndexxTokens.service";
import bitcoinBlack from "../contractData/BitcoinBlackXNFT.json";
import bitcoinGreen from "../contractData/BitcoinGreenXNFT.json";
import bitcoinPink from "../contractData/BitcoinPinkXNFT.json";
import bitcoinPurple from "../contractData/BitcoinPurpleXNFT.json";
import bitcoinOrange from "../contractData/BitcoinOrangeXNFT.json";
import bitcoinBlue from "../contractData/BitcoinBlueXNFT.json";
import ethereumBlack from "../contractData/EthereumBlackXNFT.json";
import ethereumGreen from "../contractData/EthereumGreenXNFT.json";
import ethereumPink from "../contractData/EthereumPinkXNFT.json";
import ethereumPurple from "../contractData/EthereumPurpleXNFT.json";
import ethereumOrange from "../contractData/EthereumOrangeXNFT.json";
import ethereumBlue from "../contractData/EthereumBlueXNFT.json";
import e_bitcoinBlack from "../contractData/e_BitcoinBlackXNFT.json";
import e_bitcoinGreen from "../contractData/e_BitcoinGreenXNFT.json";
import e_bitcoinPink from "../contractData/e_BitcoinPinkXNFT.json";
import e_bitcoinPurple from "../contractData/e_BitcoinPurpleXNFT.json";
import e_bitcoinOrange from "../contractData/e_BitcoinOrangeXNFT.json";
import e_bitcoinBlue from "../contractData/e_BitcoinBlueXNFT.json";
import e_ethereumBlack from "../contractData/e_EthereumBlackXNFT.json";
import e_ethereumGreen from "../contractData/e_EthereumGreenXNFT.json";
import e_ethereumPink from "../contractData/e_EthereumPinkXNFT.json";
import e_ethereumPurple from "../contractData/e_EthereumPurpleXNFT.json";
import e_ethereumOrange from "../contractData/e_EthereumOrangeXNFT.json";
import e_ethereumBlue from "../contractData/e_EthereumBlueXNFT.json";
import * as jsonData from "../contractData/contractsAddress.json";
import Web3 from "web3";
import { keys } from "../config/keys";
import { OrderTransaction } from "../data/order";
import { XNFTTransaction } from "../data/xnftTransaction";
import { XNFTTransactionService } from "../services/xnftTransaction.service";
import { XNFTProfileService } from "../services/XNFTProfile.service";
import { XNFTProfile } from "../data/xnftUserProfile";

const indexxService: IndexxService = new IndexxService();
const xNFTTransactionService: XNFTTransactionService =
  new XNFTTransactionService();
const xNFTProfileService: XNFTProfileService = new XNFTProfileService();

export class XNFTOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  /*
  nftData= {
    blockchain= "", //Polygon or Ethereum
    type="Bitcoin", // Bitcoin or Ethereum
    tokenId="",
    contractAddress=""
  }
  */
  async validateXNFT(userWallet: any, nftData: any) {
    try {
      console.log({
        userWalletAddress: userWallet,
        blockchain: nftData?.blockchain,
        contractAddress: nftData?.contractAddress,
        tokenId: nftData?.tokenId,
        type: nftData?.type,
      });
      let checkIsClaimed = await xNFTTransactionService.findOne({
        userWalletAddress: userWallet,
        blockchain: nftData?.blockchain,
        contractAddress: nftData?.contractAddress,
        tokenId: nftData?.tokenId,
        type: nftData?.type,
      });
      console.log(checkIsClaimed);
      if (checkIsClaimed) {
        return {
          data: false,
          xnftValue: 0,
          message: "User has already claimed nftx",
        };
      } else {
        if (nftData.blockchain === "Polygon" && nftData.type === "Bitcoin") {
          let checkNft = await this.BitcoinXNFTMaticChain(nftData, userWallet);
          console.log("checkNFT", checkNft);
          return checkNft;
        } else if (
          nftData.blockchain === "Polygon" &&
          nftData.type === "Ethereum"
        ) {
          let checkNft = await this.EthereumXNFTMaticChain(nftData, userWallet);
          console.log("checkNFT", checkNft);
          return checkNft;
        } else if (
          nftData.blockchain === "Ethereum" &&
          nftData.type === "Bitcoin"
        ) {
          let checkNft = await this.BitcoinXNFTEthereumChain(
            nftData,
            userWallet
          );
          console.log("checkNFT", checkNft);
          return checkNft;
        } else if (
          nftData.blockchain === "Ethereum" &&
          nftData.type === "Ethereum"
        ) {
          let checkNft = await this.EthereumXNFTEthereumChain(
            nftData,
            userWallet
          );
          console.log("checkNFT", checkNft);
          return checkNft;
        } else {
          return {
            data: false,
            xnftValue: 0,
          };
        }
      }
    } catch (err) {
      console.log(err);
      return {
        data: false,
        xnftValue: 0,
      };
    }
  }

  async validateXNFTForINEX(userWallet: any, nftData: any) {
    try {
      console.log({
        userWalletAddress: userWallet,
        blockchain: nftData?.blockchain,
        contractAddress: nftData?.contractAddress,
        tokenId: nftData?.tokenId,
        type: nftData?.type,
        isINEXConvert: nftData?.isINEXConvert,
      });
      let checkIsClaimed = await xNFTTransactionService.findOne({
        userWalletAddress: userWallet,
        blockchain: nftData?.blockchain,
        contractAddress: nftData?.contractAddress,
        tokenId: nftData?.tokenId,
        type: nftData?.type,
        isINEXConvert: nftData?.isINEXConvert,
        transactionType: "XNFT INEX Swap",
      });
      console.log(checkIsClaimed);
      if (checkIsClaimed) {
        return {
          data: false,
          xnftValue: 0,
          message: "User has already claimed nftx",
        };
      } else {
        if (nftData.blockchain === "Polygon" && nftData.type === "Bitcoin") {
          let checkNft = await this.BitcoinXNFTMaticChain(nftData, userWallet);
          console.log("checkNFT", checkNft);
          return checkNft;
        } else if (
          nftData.blockchain === "Polygon" &&
          nftData.type === "Ethereum"
        ) {
          let checkNft = await this.EthereumXNFTMaticChain(nftData, userWallet);
          console.log("checkNFT", checkNft);
          return checkNft;
        } else if (
          nftData.blockchain === "Ethereum" &&
          nftData.type === "Bitcoin"
        ) {
          let checkNft = await this.BitcoinXNFTEthereumChain(
            nftData,
            userWallet
          );
          console.log("checkNFT", checkNft);
          return checkNft;
        } else if (
          nftData.blockchain === "Ethereum" &&
          nftData.type === "Ethereum"
        ) {
          let checkNft = await this.EthereumXNFTEthereumChain(
            nftData,
            userWallet
          );
          console.log("checkNFT", checkNft);
          return checkNft;
        } else {
          return {
            data: false,
            xnftValue: 0,
          };
        }
      }
    } catch (err) {
      console.log(err);
      return {
        data: false,
        xnftValue: 0,
      };
    }
  }

  async addXNFTUserProfileImage(userWallet: any, profileImage: any) {
    try {
      let checkIsUserExists = await xNFTProfileService.findOne({
        address: userWallet,
      });
      console.log(checkIsUserExists);
      if (checkIsUserExists) {
        let updateUserProflie = await xNFTProfileService.updatePart(
          {
            address: userWallet,
          },
          {
            $set: {
              profileImage: profileImage,
              updateOn: new Date(),
            },
          }
        );
        return {
          status: true,
          message: "Update Successfully",
        };
      } else {
        //create new User Profile
        let newData = {
          address: userWallet,
          profileImage: profileImage,
          updateOn: new Date(),
        } as XNFTProfile;
        let updateUserProflie = await xNFTProfileService.create(newData);
        return {
          status: true,
          message: "Update Successfully",
        };
      }
    } catch (err) {
      console.log(err);
      return {
        status: false,
        message: "Update failed",
      };
    }
  }

  async getXNFTUserProfileImage(userWallet: any) {
    try {
      let checkIsUserExists = await xNFTProfileService.findOne({
        address: userWallet,
      });
      console.log(checkIsUserExists);
      if (checkIsUserExists) {
        return {
          status: true,
          userData: checkIsUserExists,
        };
      } else {
        return {
          status: false,
          userData: null,
        };
      }
    } catch (err) {
      console.log(err);
      return {
        status: false,
        message: "Get User failed",
      };
    }
  }

  async redeemXFNT(redeemData: any) {
    try {
      console.log("redee here in redeemXNFT", redeemData);
      if (redeemData.type === "Ethereum") {
        let payOut = await indexxService.transferEthereumbyAdmin(
          redeemData.userReceiveAddress,
          redeemData.value * 0.8,
          "XNFT"
        );
        console.log(payOut, "payOut");
        if (payOut.status === 200) {
          let createXNFTTx = {
            txId: payOut.data.hash,
            amount: redeemData.value,
            walletType: redeemData.walletType,
            transactionType: "XNFT Convert",
            exchangeName: "XNFT",
            userWalletAddress: redeemData.userReceiveAddress,
            txDate: new Date(),
            currencyRef: "ETH",
            created: new Date(),
            status: "Completed",
            blockchain: redeemData.blockchain,
            contractAddress: redeemData.contractAddress,
            tokenId: redeemData.tokenId,
            type: redeemData.type,
            isINEXConvert: false,
          } as XNFTTransaction;

          await xNFTTransactionService.create(createXNFTTx);

          return {
            status: 200,
            data: { message: "Convert completed", tx: payOut.data.hash },
          };
        }
      } else if (redeemData.type === "Bitcoin") {
        let payOut = await indexxService.transferBitcoinbyAdmin(
          redeemData.bitcoinWalletAddress,
          redeemData.value * 0.8,
          "XNFT"
        );
        console.log(payOut, "payOut");
        if (payOut.status === 200) {
          let createXNFTTx = {
            txId: payOut.data,
            amount: redeemData.value,
            walletType: redeemData.walletType,
            transactionType: "XNFT Convert",
            exchangeName: "XNFT",
            userWalletAddress: redeemData.userReceiveAddress,
            txDate: new Date(),
            currencyRef: "BTC" + redeemData.bitcoinWalletAddress,
            created: new Date(),
            status: "Completed",
            blockchain: redeemData.blockchain,
            contractAddress: redeemData.contractAddress,
            tokenId: redeemData.tokenId,
            type: redeemData.type,
            isINEXConvert: false,
          } as XNFTTransaction;

          await xNFTTransactionService.create(createXNFTTx);

          return {
            status: 200,
            data: { message: "Convert completed", tx: payOut.data },
          };
        }
      }
    } catch (err) {
      throw new Error("Error in Redeeming XFNT");
    }
  }

  async redeemXFNTINEX(redeemData: any) {
    try {
      console.log("redee", redeemData);
      if (redeemData.blockchain === "Ethereum") {
        let payOut = await indexxService.transferEthereumbyAdmin(
          redeemData.userReceiveAddress,
          redeemData.inexValue, //INEX TOKENS TRANSFERED
          "XNFT"
        );
        console.log(payOut, "payOut");
        if (payOut.status === 200) {
          let createXNFTTx = {
            txId: payOut.data.hash,
            amount: redeemData.value,
            walletType: redeemData.walletType,
            transactionType: "XnFT INEX Swap",
            exchangeName: "XNFT",
            userWalletAddress: redeemData.userReceiveAddress,
            txDate: new Date(),
            currencyRef: "ETH",
            created: new Date(),
            status: "Completed",
            blockchain: redeemData.blockchain,
            contractAddress: redeemData.contractAddress,
            tokenId: redeemData.tokenId,
            type: redeemData.type,
            isINEXConvert: false,
          } as XNFTTransaction;

          await xNFTTransactionService.create(createXNFTTx);

          return {
            status: 200,
            data: { message: "Convert completed", tx: payOut.data.hash },
          };
        }
      } else if (redeemData.blockchain === "Polygon") {
        let payOut = await indexxService.transferPolygonbyAdmin(
          redeemData.userReceiveAddress,
          redeemData.inexValue, //INEX TOKENS TRANSFERED
          "XNFT"
        );
        console.log(payOut, "payOut");
        if (payOut.status === 200) {
          let createXNFTTx = {
            txId: payOut.data.hash,
            amount: redeemData.inexValue,
            walletType: redeemData.walletType,
            transactionType: "XNFT INEX Swap",
            exchangeName: "XNFT",
            userWalletAddress: redeemData.userReceiveAddress,
            txDate: new Date(),
            currencyRef: "MATIC",
            created: new Date(),
            status: "Completed",
            blockchain: redeemData.blockchain,
            contractAddress: redeemData.contractAddress,
            tokenId: redeemData.tokenId,
            type: redeemData.type,
            isINEXConvert: true,
          } as XNFTTransaction;

          await xNFTTransactionService.create(createXNFTTx);

          return {
            status: 200,
            data: { message: "Convert completed", tx: payOut.data.hash },
          };
        }
      }
    } catch (err) {
      throw new Error("Error in Redeeming XFNT");
    }
  }

  //Helpers
  async EthereumXNFTMaticChain(userNFTData: any, userWalletAddress: string) {
    try {
      let contracts = [
        {
          address: jsonData.ethereumBlack,
          abi: ethereumBlack.abi,
          value: 1,
        },
        {
          address: jsonData.ethereumBlue,
          abi: ethereumBlue.abi,
          value: 0.25,
        },
        {
          address: jsonData.ethereumGreen,
          abi: ethereumGreen.abi,
          value: 0.1,
        },
        {
          address: jsonData.ethereumPurple,
          abi: ethereumPurple.abi,
          value: 0.5,
        },
        {
          address: jsonData.ethereumPink,
          abi: ethereumPink.abi,
          value: 0.01,
        },
        {
          address: jsonData.ethereumOrange,
          abi: ethereumOrange.abi,
          value: 0.001,
        },
      ];

      const element = contracts.find(
        (x) =>
          String(x.address).toLowerCase() ===
          String(userNFTData?.contractAddress).toLowerCase()
      );
      const abi = element?.abi as any;
      let rpcURL = keys.MATIC_RPC_TEST.key;
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      let xnftContract = new web3.eth.Contract(abi, element?.address);

      // Call the `ownerOf` method with the token ID from nftData
      const owner = await xnftContract.methods
        .ownerOf(userNFTData.tokenId)
        .call();

      // Check if the returned owner matches the userWallet
      if (owner.toLowerCase() === userWalletAddress.toLowerCase()) {
        console.log("This wallet owns the NFT.");
        return {
          data: true,
          xnftValue: Number(element?.value),
        };
      } else {
        console.log("This wallet does not own the NFT.");
        return {
          data: false,
          xnftValue: Number(element?.value),
        };
      }
    } catch (err) {
      console.log(err);
      return {
        data: false,
        xnftValue: 0,
      };
    }
  }

  async BitcoinXNFTMaticChain(userNFTData: any, userWalletAddress: string) {
    try {
      let contracts = [
        {
          address: jsonData.bitcoinBlack,
          abi: bitcoinBlack.abi,
          value: 1,
        },
        {
          address: jsonData.bitcoinBlue,
          abi: bitcoinBlue.abi,
          value: 0.25,
        },
        {
          address: jsonData.bitcoinGreen,
          abi: bitcoinGreen.abi,
          value: 0.1,
        },
        {
          address: jsonData.bitcoinPurple,
          abi: bitcoinPurple.abi,
          value: 0.5,
        },
        {
          address: jsonData.bitcoinPink,
          abi: bitcoinPink.abi,
          value: 0.01,
        },
        {
          address: jsonData.bitcoinOrange,
          abi: bitcoinOrange.abi,
          value: 0.001,
        },
      ];

      const element = contracts.find(
        (x) =>
          String(x.address).toLowerCase() ===
          String(userNFTData?.contractAddress).toLowerCase()
      );
      const abi = element?.abi as any;
      let rpcURL = keys.MATIC_RPC_TEST.key;
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      let xnftContract = new web3.eth.Contract(abi, element?.address);

      // Call the `ownerOf` method with the token ID from nftData
      const owner = await xnftContract.methods
        .ownerOf(userNFTData.tokenId)
        .call();

      // Check if the returned owner matches the userWallet
      if (owner.toLowerCase() === userWalletAddress.toLowerCase()) {
        console.log("This wallet owns the NFT.");
        return {
          data: true,
          xnftValue: Number(element?.value),
        };
      } else {
        console.log("This wallet does not own the NFT.");
        return {
          data: false,
          xnftValue: Number(element?.value),
        };
      }
    } catch (err) {
      console.log(err);
      return {
        data: false,
        xnftValue: 0,
      };
    }
  }

  async EthereumXNFTEthereumChain(userNFTData: any, userWalletAddress: string) {
    try {
      console.log("i am here", userNFTData, userWalletAddress);
      let contracts = [
        {
          address: jsonData.e_ethereumBlack,
          abi: e_ethereumBlack.abi,
          value: 1,
        },
        {
          address: jsonData.e_ethereumBlue,
          abi: e_ethereumBlue.abi,
          value: 0.25,
        },
        {
          address: jsonData.e_ethereumGreen,
          abi: e_ethereumGreen.abi,
          value: 0.1,
        },
        {
          address: jsonData.e_ethereumPurple,
          abi: e_ethereumPurple.abi,
          value: 0.5,
        },
        {
          address: jsonData.e_ethereumPink,
          abi: e_ethereumPink.abi,
          value: 0.01,
        },
        {
          address: jsonData.e_ethereumOrange,
          abi: e_ethereumOrange.abi,
          value: 0.001,
        },
      ];
      const element = contracts.find(
        (x) =>
          String(x.address).toLowerCase() ===
          String(userNFTData?.contractAddress).toLowerCase()
      );
      const abi = element?.abi as any;
      let rpcURL = keys.ETH_RPC_MAIN.key;
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      let xnftContract = new web3.eth.Contract(abi, element?.address);

      // Call the `ownerOf` method with the token ID from nftData
      const owner = await xnftContract.methods
        .ownerOf(userNFTData.tokenId)
        .call();

      console.log("owner", owner);
      // Check if the returned owner matches the userWallet
      if (owner.toLowerCase() === userWalletAddress.toLowerCase()) {
        console.log("This wallet owns the NFT.");
        return {
          data: true,
          xnftValue: Number(element?.value),
        };
      } else {
        console.log("This wallet does not own the NFT.");
        return {
          data: false,
          xnftValue: Number(element?.value),
        };
      }
    } catch (err) {
      console.log(err);
      return {
        data: false,
        xnftValue: 0,
      };
    }
  }

  async BitcoinXNFTEthereumChain(userNFTData: any, userWalletAddress: string) {
    try {
      let contracts = [
        {
          address: jsonData.bitcoinBlack,
          abi: bitcoinBlack.abi,
          value: 1,
        },
        {
          address: jsonData.bitcoinBlue,
          abi: bitcoinBlue.abi,
          value: 0.25,
        },
        {
          address: jsonData.bitcoinGreen,
          abi: bitcoinGreen.abi,
          value: 0.1,
        },
        {
          address: jsonData.bitcoinPurple,
          abi: bitcoinPurple.abi,
          value: 0.5,
        },
        {
          address: jsonData.bitcoinPink,
          abi: bitcoinPink.abi,
          value: 0.01,
        },
        {
          address: jsonData.bitcoinOrange,
          abi: bitcoinOrange.abi,
          value: 0.001,
        },
      ];

      const element = contracts.find(
        (x) =>
          String(x.address).toLowerCase() ===
          String(userNFTData?.contractAddress).toLowerCase()
      );
      const abi = element?.abi as any;
      let rpcURL = keys.ETH_RPC_MAIN.key;
      var web3 = new Web3(new Web3.providers.HttpProvider(rpcURL));

      let xnftContract = new web3.eth.Contract(abi, element?.address);

      // Call the `ownerOf` method with the token ID from nftData
      const owner = await xnftContract.methods
        .ownerOf(userNFTData.tokenId)
        .call();

      // Check if the returned owner matches the userWallet
      if (owner.toLowerCase() === userWalletAddress.toLowerCase()) {
        console.log("This wallet owns the NFT.");
        return {
          data: true,
          xnftValue: Number(element?.value),
        };
      } else {
        console.log("This wallet does not own the NFT.");
        return {
          data: false,
          xnftValue: Number(element?.value),
        };
      }
    } catch (err) {
      console.log(err);
      return {
        data: false,
        xnftValue: 0,
      };
    }
  }
}
