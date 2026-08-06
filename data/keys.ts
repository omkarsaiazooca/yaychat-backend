export interface BitgoData {
    testWalletIds: WalletIds,
    mainWalletIds: WalletIds,
    accessToken: string,
    walletPassphrase: string,
    totpKey: string,
    testUrl: string,
    prodUrl: string,
}

export interface WalletIds {
    btc?: string,
    ltc?: string,
    bch?: string
}