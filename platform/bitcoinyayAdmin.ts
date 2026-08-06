import { TronWeb } from "tronweb";
import * as dotenv from "dotenv";

dotenv.config();

const bitcoinyayAbi = [
  {
    inputs: [
      {
        internalType: "address[]",
        name: "addrs",
        type: "address[]",
      },
    ],
    name: "addToAirdropWhitelist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address[]",
        name: "addrs",
        type: "address[]",
      },
    ],
    name: "removeFromAirdropWhitelist",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address[]",
        name: "recipients",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]",
      },
    ],
    name: "setAirdropAllocations",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address[]",
        name: "recipients",
        type: "address[]",
      },
      {
        internalType: "uint256[]",
        name: "amounts",
        type: "uint256[]",
      },
    ],
    name: "airdrop",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "newCapWhole",
        type: "uint256",
      },
    ],
    name: "updateAirdropPoolCap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "claimAirdrop",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "airdropWhitelist",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "hasClaimedAirdrop",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "airdropAllocations",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "airdropPoolCap",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "airdropPoolDistributed",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const FULL_NODE = process.env.TRON_FULL_NODE;
const PRIVATE_KEY = process.env.TRON_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.BITCOINYAY_CONTRACT_ADDRESS;
const DECIMALS = Number(process.env.BITCOINYAY_DECIMALS ?? 18);
const FEE_LIMIT = 100_000_000;

let contractInstance: any | null = null;

export async function getBitcoinyayContract() {
  if (!FULL_NODE || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
    throw new Error(
      "Bitcoinyay TRON operations are unavailable: configure TRON_FULL_NODE, TRON_PRIVATE_KEY, and BITCOINYAY_CONTRACT_ADDRESS"
    );
  }

  if (!contractInstance) {
    const tronWeb = new TronWeb({
      fullHost: FULL_NODE,
      privateKey: PRIVATE_KEY,
    });
    contractInstance = await tronWeb.contract(bitcoinyayAbi as any, CONTRACT_ADDRESS);
  }
  return contractInstance;
}

export function toUnits(whole: string | number): string {
  const normalized = BigInt(whole.toString());
  const factor = BigInt(10) ** BigInt(DECIMALS);
  return (normalized * factor).toString();
}

export async function addToAirdropWhitelist(addresses: string[]) {
  if (addresses.length === 0) {
    return null;
  }
  const contract = await getBitcoinyayContract();
  return contract.addToAirdropWhitelist(addresses).send({
    feeLimit: FEE_LIMIT,
  });
}

export async function removeFromAirdropWhitelist(addresses: string[]) {
  if (addresses.length === 0) {
    return null;
  }
  const contract = await getBitcoinyayContract();
  return contract.removeFromAirdropWhitelist(addresses).send({
    feeLimit: FEE_LIMIT,
  });
}

export async function setAirdropAllocations(
  recipients: string[],
  amountsWhole: (string | number)[]
) {
  if (recipients.length === 0 || recipients.length !== amountsWhole.length) {
    throw new Error("Airdrop recipients and amounts must align");
  }
  const contract = await getBitcoinyayContract();
  const amountsUnits = amountsWhole.map((amount) => toUnits(amount));
  return contract.setAirdropAllocations(recipients, amountsUnits).send({
    feeLimit: FEE_LIMIT,
  });
}

export async function finalizeAirdropRecipient(address: string) {
  if (!address) {
    return null;
  }
  await setAirdropAllocations([address], [0]);
  return removeFromAirdropWhitelist([address]);
}
