import { PaymentTxLock } from "../data/paymentTxLock";
import PaymentTxLockSchema, {
  PaymentTxLockModel,
} from "../models/paymentTxLock";
import { ServiceBase } from "./base";

function isDuplicateKeyError(error: any) {
  return error?.code === 11000;
}

export class PaymentTxLockService extends ServiceBase<
  PaymentTxLock,
  PaymentTxLockModel
> {
  constructor() {
    super(PaymentTxLockSchema, "PaymentTxLock");
  }

  async claimTxHash(input: {
    txHash: string;
    orderId: string;
    email?: string;
    status?: string;
    blockchain?: string;
    paymentType?: string;
    amount?: number;
    receiverAddress?: string;
  }) {
    const txHash = String(input.txHash || "").trim();
    const orderId = String(input.orderId || "").trim();

    if (!txHash || !orderId) {
      return { ok: false as const, existingOrderId: null };
    }

    const setOnInsert = {
      txHash,
      orderId,
      email: String(input.email || "").trim().toLowerCase(),
      status: input.status || "reserved",
      blockchain: String(input.blockchain || ""),
      paymentType: String(input.paymentType || ""),
      amount: Number(input.amount || 0),
      receiverAddress: String(input.receiverAddress || ""),
    };

    try {
      const lock = await this.upsertOneAndGet(
        { txHash },
        { $setOnInsert: setOnInsert },
        { new: true, setDefaultsOnInsert: true }
      );

      if (lock?.orderId && String(lock.orderId) !== orderId) {
        return {
          ok: false as const,
          existingOrderId: String(lock.orderId || "") || null,
        };
      }

      return { ok: true as const, lock };
    } catch (error: any) {
      if (isDuplicateKeyError(error)) {
        const existing = await this.findOne({ txHash });
        if (existing?.orderId && String(existing.orderId) !== orderId) {
          return {
            ok: false as const,
            existingOrderId: String(existing.orderId || "") || null,
          };
        }
        return { ok: true as const, lock: existing || null };
      }
      throw error;
    }
  }

  async markStatus(
    txHash: string,
    orderId: string,
    status: string,
    extra: Record<string, any> = {}
  ) {
    return this.updatePart(
      { txHash: String(txHash || "").trim(), orderId: String(orderId || "").trim() },
      {
        $set: {
          status,
          ...extra,
        },
      }
    );
  }
}
