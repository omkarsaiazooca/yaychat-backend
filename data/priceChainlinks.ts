import { ethers } from "ethers";

const chainlinkABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "description",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint80", name: "_roundId", type: "uint80" }],
    name: "getRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

export async function getIndexxUSDPPrice() {
  try {
    let spprice = 0;
    let usdtaddr = "0xEca2605f0BCF2BA5966372C99837b1F182d3D620";
    let rpcProvider = new ethers.providers.JsonRpcProvider(
      "https://data-seed-prebsc-1-s1.binance.org:8545/"
    );
    const spFeed = new ethers.Contract(usdtaddr, chainlinkABI, rpcProvider);
    let res = await spFeed.latestRoundData().then((roundData: any) => {
      spprice = roundData[1] / 10000000000;
      spprice = Math.round(spprice * 100);
      return spprice;
    });
    console.log("in usd+: ", res);

    return res;
  } catch (err) {
    console.log(err);
  }
}

export async function getIndexxIN500Price() {
  try {
    let spprice = 0;
    let spaddr = "0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7";
    let rpcProvider = new ethers.providers.JsonRpcProvider(
      "https://data-seed-prebsc-1-s1.binance.org:8545/"
    );
    const spFeed = new ethers.Contract(spaddr, chainlinkABI, rpcProvider);
    let res = await spFeed.latestRoundData().then((roundData: any) => {
      spprice = roundData[1] / 10000000000;
      console.log("in usd: ", spprice);
      spprice = Math.round(spprice * 100) / 100;
      return spprice;
    });
    console.log("res in500: ", res);
    return res;

  } catch (err) {}
}

export async function getIndexxCryptoPrice() {
  try {
    console.log("Getting Price");
    let final = 0;
    let rpcProvider = new ethers.providers.JsonRpcProvider(
      "https://bsc-dataseed1.binance.org/"
    );

    let adaP = 0;
    let avaxP = 0;
    let bnbP = 0;
    let btcP = 0;
    let dogeP = 0;
    let dotP = 0;
    let ethP = 0;
    let maticP = 0;
    let solP = 0;
    let shibP = 0;
    let trxP = 0;
    let uniP = 0;
    let xrpP = 0;
    let ltcP = 0;
    let fttP = 0;

    let ada = "0xa767f745331D267c7751297D982b050c93985627";
    let avax = "0x5974855ce31EE8E1fff2e76591CbF83D7110F151";
    let bnb = "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE";
    let btc = "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf";
    let doge = "0x3AB0A0d137D4F946fBB19eecc6e92E64660231C8";
    let dot = "0xC333eb0086309a16aa7c8308DfD32c8BBA0a2592";
    let eth = "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e";
    let matic = "0x7CA57b0cA6367191c94C8914d7Df09A57655905f";
    let sol = "0x0E8a53DD9c13589df6382F13dA6B3Ec8F919B323";
    let shib = "0xA615Be6cb0f3F36A641858dB6F30B9242d0ABeD8";
    let trx = "0xF4C5e535756D11994fCBB12Ba8adD0192D9b88be";
    let uni = "0xb57f259E7C24e56a1dA00F66b55A5640d9f9E7e4";
    let xrp = "0x93A67D414896A280bF8FFB3b389fE3686E014fda";
    let ltc = "0x74E72F37A8c415c8f1a98Ed42E78Ff997435791D";
    let ftt = "0x38E05754Eb00171cBE72bA1eE792933d6e8d2891";

    const adaC = new ethers.Contract(ada, chainlinkABI, rpcProvider);
    adaP = await adaC.latestRoundData().then((roundData: any) => {
      let res = 0;
      res = roundData[1] / 100000000;
      return res;
    });
    const avaxC = new ethers.Contract(avax, chainlinkABI, rpcProvider);
    avaxP = await avaxC.latestRoundData().then((roundData: any) => {
      let res = 0;
      res = roundData[1] / 100000000;
      return res;
    });
    const bnbC = new ethers.Contract(bnb, chainlinkABI, rpcProvider);
    bnbP = await bnbC.latestRoundData().then((roundData: any) => {
      let res = 0;
      res = roundData[1] / 100000000;
      return res;
    });
    const btcC = new ethers.Contract(btc, chainlinkABI, rpcProvider);
    btcP = await btcC.latestRoundData().then((roundData: any) => {
      let res = 0;
      res = roundData[1] / 100000000;
      return res;
    });
    const dogeC = new ethers.Contract(doge, chainlinkABI, rpcProvider);
    dogeP = await dogeC.latestRoundData().then((roundData: any) => {
      let res = 0;
      res = roundData[1] / 100000000;
      return res;
    });
    const dotC = new ethers.Contract(dot, chainlinkABI, rpcProvider);
    dotP = await dotC.latestRoundData().then((roundData: any) => {
      let res = 0;
      res = roundData[1] / 100000000;
      return res;
    });
    const ethC = new ethers.Contract(eth, chainlinkABI, rpcProvider);
    ethP = await ethC.latestRoundData().then((roundData: any) => {
      let res = 0;
      res = roundData[1] / 100000000;
      return res;
    });
    const maticC = new ethers.Contract(matic, chainlinkABI, rpcProvider);
    maticP = await maticC.latestRoundData().then((roundData: any) => {
      let res = 0;
      res = roundData[1] / 100000000;
      return res;
    });
    const solC = new ethers.Contract(sol, chainlinkABI, rpcProvider);
    solP = await solC.latestRoundData().then((roundData: any) => {
      let res = 0;
      res = roundData[1] / 100000000;
      return res;
    });
    const shibC = new ethers.Contract(shib, chainlinkABI, rpcProvider);
    shibP = await shibC.latestRoundData().then((roundData: any) => {
      let res = 0;
      shibP = roundData[1] / 100000000;
      return res;
    });
    const trxC = new ethers.Contract(trx, chainlinkABI, rpcProvider);
    trxP = await trxC.latestRoundData().then((roundData: any) => {
      let res = 0;
      res = roundData[1] / 100000000;
      return res;
    });
    const uniC = new ethers.Contract(uni, chainlinkABI, rpcProvider);
    uniP = await uniC.latestRoundData().then((roundData: any) => {
      let res = 0;
      uniP = roundData[1] / 100000000;
      return res;
    });
    const xrpC = new ethers.Contract(xrp, chainlinkABI, rpcProvider);
    xrpP = await xrpC.latestRoundData().then((roundData: any) => {
      let res = 0;
      res = roundData[1] / 100000000;
      return res;
    });
    const ltcC = new ethers.Contract(ltc, chainlinkABI, rpcProvider);
    ltcP = await ltcC.latestRoundData().then((roundData: any) => {
      let res = 0;
      ltcP = roundData[1] / 100000000;
      return res;
    });
    const fttC = new ethers.Contract(ftt, chainlinkABI, rpcProvider);
    fttP = await fttC.latestRoundData().then((roundData: any) => {
      let res = 0;
      res = roundData[1] / 100000000;
      return res;
    });

    final =
      (ethP + btcP) * 0.1 +
      (bnbP + xrpP + adaP + solP + dotP) * 0.08 +
      (dogeP + maticP + avaxP + uniP + shibP + trxP + ltcP + fttP) * 0.05;
    final = final / 1000;

    console.log("final: ", final);
    return final;
  } catch (err) {
    console.log(err);
  }
}
