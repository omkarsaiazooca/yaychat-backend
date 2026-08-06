export interface UserVestingConfig  {
    email: string;
    option: string;
    startDate: Date;
    nextChangeAllowed: Date; // Restricts changes to once every 6 months
    coinSymbol: string;
}