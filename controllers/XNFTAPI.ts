import { Request, Response } from "express";
import Moralis from "moralis";
import { EvmChain } from "@moralisweb3/common-evm-utils";
import { createClient } from "redis";
import { XNFTOperations } from "../platform/xnft.operations";

const client = createClient();
Moralis.start({
  apiKey: process.env.XNFT_API_KEY || "",
});

export class XNFTController {
  constructor() {}

  async getAllNftsByAddress(req: Request, res: Response) {
    try {
      const chain = EvmChain.POLYGON;
      console.log(req.body.address);
      let NFTs = await Moralis.EvmApi.nft.getContractNFTs({
        address: req.body.address,
        chain: chain,
      });
      const result = NFTs.raw;

      return res.status(200).json({ result });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getAllNftsByAddressWithCache(req: Request, res: Response) {
    const { address } = req.body;
    await client.connect();

    try {
      // Try fetching the result from Redis first in case we have it cached
      let result = await client.get(`nfts:${address}`);
      console.log("result", result);
      if (result) {
        await client.quit();
        // If the result exists in cache, we return it immediately
        return res.status(200).json({ result: JSON.parse(result) });
      } else {
        const chain = EvmChain.POLYGON;
        let NFTs = await Moralis.EvmApi.nft.getContractNFTs({
          address,
          chain,
        });
        const newResult = NFTs.raw;

        // Save the API response in Redis and set an expiration time of 12 hours
        await client.setEx(
          `nfts:${address}`,
          12 * 3600,
          JSON.stringify(newResult)
        );
        await client.quit();
        return res.status(200).json({ result: newResult });
      }
    } catch (err) {
      await client.quit();
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async swapXnftForCrypto(req: Request, res: Response) {
    const { address, userNFTData } = req.body;
    console.log(address, userNFTData);
    try {
      const xnftOperations = new XNFTOperations(req, res);
      let validateUserXNFT = await xnftOperations.validateXNFT(
        address,
        userNFTData
      );
      let data;
      if (validateUserXNFT.data) {
        console.log("proceed further to swap");
        let redeemData = {
          value: validateUserXNFT.xnftValue,
          type: userNFTData.type,
          blockchain: userNFTData.blockchain,
          userReceiveAddress: address,
          contractAddress: userNFTData?.contractAddress,
          tokenId: userNFTData?.tokenId,
          bitcoinWalletAddress: userNFTData?.bitcoinWalletAddress,
        };
        let tx = await xnftOperations.redeemXFNT(redeemData);
        console.log("tx", tx);
        if (tx) {
          data = {
            data: tx?.data,
            status: tx?.status,
          };
        } else {
          data = {
            data: {
              message:
                "Failed to convert. Contact admin or try again after some time.",
            },
            status: 500,
          };
        }
      } else {
        data = {
          data: {
            message: "Invalid xnft or User has already claimed xnft",
            tx: "",
          },
          status: 500,
        };
      }
      return res.status(200).json({ data });
    } catch (err) {
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async swapINEXForCrypto(req: Request, res: Response) {
    const { address, userNFTData } = req.body;
    console.log(address, userNFTData);
    try {
      const xnftOperations = new XNFTOperations(req, res);
      let validateUserXNFT = await xnftOperations.validateXNFTForINEX(
        address,
        userNFTData
      );
      let data;
      if (validateUserXNFT.data) {
        console.log("proceed further to swap");
        let redeemData = {
          value: validateUserXNFT.xnftValue,
          type: userNFTData.type,
          blockchain: userNFTData.blockchain,
          userReceiveAddress: address,
          contractAddress: userNFTData?.contractAddress,
          tokenId: userNFTData?.tokenId,
          bitcoinWalletAddress: userNFTData?.bitcoinWalletAddress,
          inexValue: userNFTData?.inexTransferred,
        };
        let tx = await xnftOperations.redeemXFNTINEX(redeemData);
        console.log("tx", tx);
        if (tx) {
          data = {
            data: tx?.data,
            status: tx?.status,
          };
        } else {
          data = {
            data: {
              message:
                "Failed to convert. Contact admin or try again after some time.",
            },
            status: 500,
          };
        }
      } else {
        data = {
          data: {
            message: "Invalid xnft or User has already claimed xnft",
            tx: "",
          },
          status: 500,
        };
      }
      return res.status(200).json({ data });
    } catch (err) {
      console.log("err", err);
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async swapINEXForCryptoValidate(req: Request, res: Response) {
    const { address, userNFTData } = req.body;
    console.log(address, userNFTData);
    try {
      const xnftOperations = new XNFTOperations(req, res);
      let validateUserXNFT = await xnftOperations.validateXNFTForINEX(
        address,
        userNFTData
      );
      let data;
      if (validateUserXNFT.data) {
        console.log("proceed further to swap");
        let redeemData = {
          value: validateUserXNFT.xnftValue,
          type: userNFTData.type,
          blockchain: userNFTData.blockchain,
          userReceiveAddress: address,
          contractAddress: userNFTData?.contractAddress,
          tokenId: userNFTData?.tokenId,
          bitcoinWalletAddress: userNFTData?.bitcoinWalletAddress,
          inexValue: userNFTData?.inexTransferred,
        };
        data = {
          data: {
            message: "Valid xnft or User has not already claimed xnft",
            tx: "",
          },
          status: 200,
        };
      } else {
        data = {
          data: {
            message: "Invalid xnft or User has already claimed nxft inex",
            tx: "",
          },
          status: 500,
        };
      }
      return res.status(200).json({ data });
    } catch (err) {
      console.log("err", err);
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async xnftProfileUpdate(req: Request, res: Response) {
    const { address, profileImageuRL } = req.body;
    console.log(address, profileImageuRL);
    try {
      const xnftOperations = new XNFTOperations(req, res);
      let addUserProfileImage = await xnftOperations.addXNFTUserProfileImage(
        address,
        profileImageuRL
      );
      return res.status(200).json({ addUserProfileImage });
    } catch (err) {
      console.log("err", err);
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }

  async getXnftProfile(req: Request, res: Response) {
    const { address } = req.body;
    console.log(address);
    try {
      const xnftOperations = new XNFTOperations(req, res);
      let addUserProfileImage = await xnftOperations.getXNFTUserProfileImage(
        address
      );
      return res.status(200).json({ addUserProfileImage });
    } catch (err) {
      console.log("err", err);
      return res
        .status(500)
        .send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }
  /*
   async getAllNftsByAddressWithCache2(req: Request, res: Response): Promise<Response> {
    const { address } = req.body;
    
    return new Promise((resolve, reject) => {
      // Try fetching the result from Redis first in case we have it cached
      client.get(`nfts:${address}`, async (error, result) => {
        if (result) {
          // If the result exists in cache, we return it immediately
          resolve(res.status(200).json({ result: JSON.parse(result) }));
        } else {
          try {
            const chain = EvmChain.MUMBAI;
            let NFTs = await Moralis.EvmApi.nft.getContractNFTs({
              address: req.body.address,
              chain: chain,
            });
            const newResult = NFTs.raw;
  
            // Save the API response in Redis and set an expiration time of 12 hours
            client.setex(`nfts:${address}`, 12 * 60 * 60, JSON.stringify(newResult));
            
            resolve(res.status(200).json({ result: newResult }));
          } catch (err) {
            reject(res.status(500).send({ status: 500, data: { message: "Unhandled error: " + err } }));
          }
        }
      });
    });
  } */
  async getAllContractAddressesNFTs(req: Request, res: Response) {
    try {
      const chain = EvmChain.MUMBAI;
      let addresses: string[] = [
        "0x8c034b0346a68aBE5e9Ca07B5b5dA129bE92E881",
        "0xaE8F8C78d51DFaFb2c246877819C2Ad38594bB2c",
        "0x1c01F64882E60EFDeC659b6F7c2B35F3434d8F3F",
        "0xBE4cAcF5b2132578587d454B856184dDA0D5a6dc",
        "0x2f394FaA89C807C0251A17709540426c40A1507A",
        "0x732799Bf3ba77a5a6C774cc76FA479B3098e6a99",
        "0xD96031e03ee3C57a47C3d4785958E912a56c2c69",
        "0x6681F1e93CAA90ec684b34582481f70bc6dE65AF",
        "0xED57FC4CDd710F95e6900D5e19fBD1569eb4602A",
        "0x415D03cc37242Fc7f533573580065Ca1aE24ED62",
        "0x8688CE3A94e25c743a85c8D2C0B006a31B5F3839",
        "0x20627adF2ecA7B8fdE0f9c4533dea121FcE1A4e5",
      ];
      let results = [];
      for (let i = 0; i < addresses.length; i++) {
        const NFTs = await Moralis.EvmApi.nft.getContractNFTs({
          chain: chain,
          address: addresses[i],
        });
        const result = NFTs.raw;
        results.push(result);
      }
      return res.status(200).json({ results });
    } catch (err) {
      res.statusCode = 500;
      res.send({ status: 500, data: { message: "Unhandled error: " + err } });
    }
  }
}
