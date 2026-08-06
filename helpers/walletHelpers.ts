// services/wallet.helpers.ts
import { UserService } from "../services/user.service";
const uservice = new UserService();

export async function getUserWalletDoc(email: string) {
    const doc = await uservice.findOne({ email: email.toLowerCase() });
    if (!doc || !Array.isArray(doc.userWallets)) {
        throw new Error("No wallets found for this user");
    }
    return doc;
}

export function findWallet(doc: any, symbol: string) {
    return (doc.userWallets as any[]).find(w => w.coinSymbol === symbol);
}

export async function ensureWalletExists(email: string, symbol: string) {
    const doc = await uservice.findOne({ email: email.toLowerCase() });
    if (!doc) throw new Error("User not found");

    const exists = (doc.userWallets || []).some((w: any) => w.coinSymbol === symbol);
    if (!exists) {
        await uservice.updatePart(
            { email: email.toLowerCase() },
            { $push: { userWallets: { coinSymbol: symbol, coinBalance: 0, coinLastUsedOn: null } } }
        );
    }
}

export async function adjustBalancesNoTxn(
    email: string,
    spend: { symbol: string; amount: number },
    receive?: { symbol: string; amount: number }
) {
    if (spend.amount <= 0) throw new Error("Spend amount must be > 0");

    email = email.toLowerCase();

    // Make sure spend wallet exists (and receive if needed)
    await ensureWalletExists(email, spend.symbol);
    if (receive) await ensureWalletExists(email, receive.symbol);

    // 1) CONDITIONAL DEBIT (single statement prevents overdraft)
    // Only match if balance >= amount; if not matched => insufficient
    const debitRes: any = await uservice.updatePart(
        {
            email,
            "userWallets.coinSymbol": spend.symbol,
            "userWallets.$.coinBalance": { $gte: spend.amount },
        },
        {
            $inc: { "userWallets.$.coinBalance": -spend.amount },
            $set: { "userWallets.$.coinLastUsedOn": new Date() },
        }
    );

    // NOTE: depending on your `updatePart` wrapper, check matchedCount / modifiedCount / acknowledged.
    if (!debitRes || (debitRes.matchedCount ?? debitRes.nMatched ?? 0) === 0) {
        throw new Error(`Insufficient ${spend.symbol} balance`);
    }

    // 2) CREDIT (separate statement)
    if (receive && receive.amount > 0) {
        await uservice.updatePart(
            { email, "userWallets.coinSymbol": receive.symbol },
            {
                $inc: { "userWallets.$.coinBalance": receive.amount },
                $set: { "userWallets.$.coinLastUsedOn": new Date() },
            }
        );
    }
}
