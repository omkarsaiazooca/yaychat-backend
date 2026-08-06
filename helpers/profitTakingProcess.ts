import { writeFileSync, appendFileSync } from "fs";
import { getCurrencyPriceByType } from "../platform/currency.operations";
import { TransactionService } from "../services/transaction.service";
import moment from "moment";
import { UserService } from "../services/user.service";
import { OrderService } from "../services/order.service";
import { ProfitLogService } from "../services/profitLog.service";
import { Transaction } from "../data/transaction";
import { OrderStatus } from "../data/order";
import { SendEmail } from "../platform/email.operations";
import { getCryptoPriceBySymobl } from "../controllers/priceAPI";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const txservice: TransactionService = new TransactionService();
let uservice: UserService = new UserService();
let orderService: OrderService = new OrderService();
let profitLogService: ProfitLogService = new ProfitLogService();
const profitAccountEmail = "wallet@azooca.com";
const logFile = "profit_calculation_logs.txt";

// Function to log data to a file
const logToFile = (message: string) => {
  appendFileSync(logFile, `${message}\n`);
};

export async function profitCalculation() {
  try {
    const emails = [
      "banks144@yahoo.com",
      "donpanchos4me@gmail.com",
      "rey.barthelemy@gmail.com",
      "fowlertrucking14@yahoo.com",
      "cielinoinc@gmail.com",
      "trujillolouis@icloud.com",
      "martinmonge@verizon.net",
      "kathy.oglesbee@yahoo.com",
      "sherri@tristatematerials.com",
      "dbrevolution11@gmail.com",
      "taylorfowler@icloud.com",
      "wwrv@verizon.net",
      "devin.delamora@icloud.com",
      "daniel.estrada1991@yahoo.com",
      "sj.brown@yahoo.com",
      "brownst81@yahoo.com",
      "vosloo.wilmie@gmail.com",
      "bmoralez12@gmail.com",
      "carrieslyons@yahoo.com",
    ];

    for (let index = 0; index < emails.length; index++) {
      const userEmail = emails[index];
      // Start log for the user
      logToFile(
        `\n================= Start Processing User: ${userEmail} =================`
      );
      // Get all investment transactions for this user in the last month
      const lastMonthDate = moment()
        .subtract(1, "months") // Fixed argument to subtract method
        .startOf("month")
        .toDate();
      const currentMonthDate = moment().toDate(); // Use today's date

      const transactions = await txservice.find({
        email: userEmail,
        transactionType: "INVESTMENT",
        txDate: {
          $gte: lastMonthDate, // Greater than or equal to the start of last month
          $lt: currentMonthDate, // Less than the start of the current month
        },
      });

      if (!transactions || transactions.length === 0) {
        logToFile(`No transactions for ${userEmail} in the last month.`);
        console.log(
          `No transactions for ${userEmail} in the last month or profits already taken`
        );
        continue;
      }

      // Loop through all investment transactions and calculate profit
      for (const tx of transactions) {
        const originalInvestment = Number(tx.amountInvested); // Amount the user originally invested (in USD or chosen currency)
        const currentAmount = tx.amount; // Current investment amount in crypto (e.g., BTC)
        const currencyRef = String(tx.currencyRef); // The currency of the investment (e.g., BTC)

        // Log the details before calculations
        console.log(
          `Processing transaction ${tx.orderId} for user ${userEmail}`
        );
        console.log(`Original Investment (USD): $${originalInvestment}`);
        console.log(`Current Amount of ${currencyRef}: ${currentAmount}`);

        // Fetch the current price of the asset (e.g., BTC)
        const currentPriceResponse = await getCryptoPriceBySymobl(currencyRef);
        const currentPrice = currentPriceResponse.data.lastPrice;

        console.log(`Current Price of ${currencyRef}: $${currentPrice}`);

        // Fetch the price at the time of the transaction (assuming you have access to it)
        const previousPrice = originalInvestment / currentAmount; // Assuming the investment was in USD and this is a derived price

        // Calculate the value of the current amount in USD
        const currentValue = currentAmount * currentPrice;

        console.log(`Current Value (USD): $${currentValue}`);

        // Calculate the profit
        const profit = currentValue - originalInvestment;

        console.log(`Calculated Profit: $${profit}`);

        if (profit > 0) {
          // Calculate 10% of the profit in USD
          const profitToTakeInUsd = profit * 0.1;

          // Convert the USD profit to crypto amount (e.g., BTC)
          const profitToTakeInCrypto = profitToTakeInUsd / currentPrice;

          // Log both previous and current price
          console.log(
            `User ${userEmail} invested at $${previousPrice.toFixed(
              5
            )} per ${currencyRef}, current price is $${currentPrice.toFixed(
              5
            )} per ${currencyRef}.`
          );
          logToFile(
            `User ${userEmail} invested at $${previousPrice.toFixed(
              5
            )} per ${currencyRef}, current price is $${currentPrice.toFixed(
              5
            )} per ${currencyRef}. Investment amount: ${
              tx.amount
            } ${currencyRef}`
          );
          console.log(
            `User ${userEmail} made a profit of $${profit.toFixed(
              5
            )}. Taking 10% profit, which equals ${profitToTakeInCrypto.toFixed(
              8
            )} ${currencyRef}.(${profitToTakeInUsd} USD)`
          );
          logToFile(
            `User ${userEmail} made a profit of $${profit.toFixed(
              5
            )}. Taking 10% profit, which equals ${profitToTakeInCrypto.toFixed(
              8
            )} ${currencyRef}.`
          );

          logToFile(
            `User ${userEmail}: Transaction ${
              tx.orderId
            }, Profit: $${profit.toFixed(
              2
            )}, 10% taken: ${profitToTakeInCrypto.toFixed(8)} ${currencyRef}`
          );

          // Subtract the profit (in crypto) from the user's wallet
          await subtractFromUserWallet(
            userEmail,
            currencyRef,
            profitToTakeInCrypto
          );

          // Add the profit (in crypto) to the profit account
          await addToUserWallet(
            profitAccountEmail,
            currencyRef,
            profitToTakeInCrypto
          );

          // Log the profit details in the new table (profit_logs)
          await profitLogService.create({
            userEmail: userEmail,
            profitAccountEmail: profitAccountEmail,
            currencyRef: currencyRef,
            profitInCrypto: profitToTakeInCrypto,
            profitInUsd: profitToTakeInUsd,
            txDate: tx.txDate,
            originalInvestment: originalInvestment,
            currentValue: currentValue,
            logDate: new Date(),
            note: `10% profit taken from ${userEmail} in ${currencyRef} (Crypto: ${profitToTakeInCrypto.toFixed(
              8
            )} ${currencyRef}, USD: $${profitToTakeInUsd.toFixed(
              2
            )}) and transferred to wallet@azooca.com`,
            type: "Profit",
          });

          // Send email notification after logging the profit details
          await new SendEmail().sendProfitTakenEmail({
            userEmail: userEmail,
            profitAccountEmail: profitAccountEmail,
            currencyRef: currencyRef,
            profitToTakeInCrypto: profitToTakeInCrypto,
            profitToTakeInUsd: profitToTakeInUsd,
            txDate: tx.txDate,
            originalInvestment: originalInvestment,
            currentValue: currentValue,
          });
          // Create a new transaction for the profit account
          const newProfitTransaction: Transaction = {
            orderId: tx.orderId, // Reference the original transaction
            extRef: "", // Optional external reference
            txId: "", // Optional transaction ID
            from: userEmail, // From the user's email
            to: profitAccountEmail, // To the profit account
            amount: profitToTakeInCrypto, // Amount of crypto taken as profit
            info: "Profit transferred", // Information about the transaction
            status: OrderStatus.Completed, // Status of the transaction
            currencyRef: currencyRef, // The currency in which profit is transferred (e.g., BTC)
            walletType: "Profit Account", // Indicate that this is for the profit account
            transactionType: "PROFIT", // Type of transaction
            exchangeName: tx.exchangeName, // Exchange name if applicable
            email: profitAccountEmail, // The email for the profit account
            txDate: new Date(), // Date of the profit transaction
            benificaryAddress: "", // Beneficiary address if applicable
            notes: `Profit of ${profitToTakeInCrypto.toFixed(
              8
            )} ${currencyRef} taken from ${userEmail} and transferred to profit account`,
          };

          // Save the new transaction
          await txservice.create(newProfitTransaction);

          // Mark the original transaction as profit taken
          await txservice.updatePart(
            {
              email: userEmail,
              txDate: tx.txDate, // Matching with the transaction date
            },
            {
              $set: {
                profitTaken: true,
                profitLastTakenDate: new Date(),
                notes:
                  tx.notes +
                  ", " +
                  `10% tip taken in ${currencyRef} (Crypto: ${profitToTakeInCrypto.toFixed(
                    8
                  )} ${currencyRef}, USD: $${profitToTakeInUsd.toFixed(
                    2
                  )}) and transferred to wallet@azooca.com on ${new Date()}`,
              },
            }
          );
        } else {
          // Log details when no profit is made
          console.log(
            `No profit for user ${userEmail} on transaction ${tx.orderId}.`
          );
          console.log(
            `Original investment: $${originalInvestment.toFixed(
              2
            )}, Current value: $${currentValue.toFixed(
              2
            )}, Profit: $${profit.toFixed(
              2
            )}. Reason: The current value is lower than or equal to the original investment.`
          );
          logToFile(
            `User ${userEmail}: No profit for transaction ${
              tx.orderId
            }. Original: $${originalInvestment.toFixed(
              2
            )}, Current: $${currentValue.toFixed(2)}`
          );
        }
      }
      // End log for the user
      logToFile(
        `================= End Processing User: ${userEmail} =================\n`
      );
    }
  } catch (err: any) {
    console.log("Error during profit calculation:", err);
    logToFile(`General error during profit calculation: ${err.message}`);
  }
}

export async function profitCalculationOnOverall() {
  try {
    const emails = [
      //   "banks144@yahoo.com",
      //   "donpanchos4me@gmail.com",
      //   "rey.barthelemy@gmail.com",
      //   "fowlertrucking14@yahoo.com",
      //   "cielinoinc@gmail.com",
      //  "trujillolouis@icloud.com",
        "martinmonge@verizon.net",
        //"kathy.oglesbee@yahoo.com",
        "sherri@tristatematerials.com",
        "dbrevolution11@gmail.com",
        "taylorfowler@icloud.com",
        "wwrv@verizon.net",
        "devin.delamora@icloud.com",
        "daniel.estrada1991@yahoo.com",
        // "sj.brown@yahoo.com",
        // "brownst81@yahoo.com",
        // "vosloo.wilmie@gmail.com",
        // "bmoralez12@gmail.com",
        // "carrieslyons@yahoo.com",
        // "chrishumpherys@yahoo.com",
        // "kmonge10@yahoo.com",
        // "jinelliott2013@yahoo.com",
        // "b62721209@gmail.com",
        // "dpar4fam@hotmail.com",
        //  "lino.gomez1@gmail.com",
      // "dlcpmoralez@gmail.com",
      // "espo66@hotmail.com",
      // "judybriggs1@gmail.com",
      // "bo.dagnall@gmail.com",
      // "dave@cdgmaterials.com",
      // "pearlsblingsnthings@gmail.com",
      // "169168011@qq.com",
      // "dawnmsonnier@icloud.com",
      // "lmmecham@yahoo.com",
      // "uscmandyli60@gmail.com",
    ];

    for (let index = 0; index < emails.length; index++) {
      const userEmail = emails[index];

      // Start log for the user
      logToFile(
        `\n================= Start Processing User: ${userEmail} =================`
      );

      // Get all investment transactions for this user in the last 3 months
      const lastMonthDate = moment()
        .subtract(7, "months")
        .startOf("month")
        .toDate();
      // Change currentMonthDate to include the current time
      const currentMonthDate = moment().toDate();

      console.log("lastMonthDate", lastMonthDate);
      console.log("currentMonthDate", currentMonthDate);
      const transactions = await txservice.find({
        email: userEmail,
        transactionType: "INVESTMENT",
        txDate: {
          $gte: lastMonthDate,
          $lt: currentMonthDate,
        },
        currencyRef: {
          $nin: ["INEX", "WIBS", "DaCrazy", "IN500", "IUSD+"], // Exclude these currencies
        },
        amountInvested: {
          $gt: 0, // Ensure amountInvested is greater than 0
        },
      });
      console.log("transactions", transactions.length);

      if (!transactions || transactions.length === 0) {
        logToFile(`No transactions for ${userEmail} in the last month.`);
        console.log(
          `No transactions for ${userEmail} in the last month or profits already taken.`
        );
        continue;
      }

      // Calculate total investment and current value across all tokens
      const tokenAggregates: Record<
        string,
        { originalInvestment: number; currentAmount: number; txId: string }
      > = {};

      let getUser = await uservice.findOne({
        email: userEmail,
      });
      let getUserWallet = getUser.userWallets;
      for (const tx of transactions) {
        const currencyRef = String(tx.currencyRef);
        const originalInvestment = Number(tx.amountInvested);
        const requiredCurrencyWallet = getUserWallet.find(
          (x) => x.coinSymbol === tx.currencyRef
        );
        console.log(requiredCurrencyWallet?.coinBalance);
        const currentAmount = Number(requiredCurrencyWallet?.coinBalance);

        console.log(tokenAggregates);
        console.log(currencyRef);
        if (!tokenAggregates[currencyRef]) {
          tokenAggregates[currencyRef] = {
            originalInvestment: 0,
            currentAmount: 0,
            txId: "",
          };
        } else {
          // If currency already exists, skip adding the original investment
          console.log(
            `${currencyRef} already exists. Skipping original investment addition.`
          );
          tokenAggregates[currencyRef].originalInvestment += originalInvestment;
          continue;
        }

        tokenAggregates[currencyRef].originalInvestment += originalInvestment;
        tokenAggregates[currencyRef].currentAmount += currentAmount;
      }

      console.log("tokenAggregates", tokenAggregates);
      // Fetch current prices for all tokens
      const currentPrices = await Promise.all(
        Object.keys(tokenAggregates).map(async (token) => {
          const response = await getCryptoPriceBySymobl(token);
          return { token, price: response.data.lastPrice };
        })
      );

      let totalOriginalInvestment = 0;
      let totalCurrentValue = 0;
      const profitDetails: any[] = [];

      currentPrices.forEach(({ token, price }) => {
        const aggregate = tokenAggregates[token];
        const currentValue = aggregate.currentAmount * price;
        const originalInvestment = aggregate.originalInvestment;

        totalOriginalInvestment += originalInvestment;
        totalCurrentValue += currentValue;

        if (currentValue > originalInvestment) {
          const profit = currentValue - originalInvestment;
          const profitToTakeInUsd = profit * 0.1;
          const profitToTakeInCrypto = profitToTakeInUsd / price;

          const relevantTx = transactions.find(
            (tx: any) => tx.currencyRef === token && tx.amountInvested > 0
          );
          const txId = profitDetails.push({
            token,
            profit,
            profitToTakeInUsd,
            profitToTakeInCrypto,
            currentValue,
            originalInvestment,
            txDate: relevantTx?.txDate,
            notes: relevantTx?.notes,
            price: price,
          });
        }
      });

      console.log(profitDetails, userEmail);

      console.log("totalOriginalInvestment", totalOriginalInvestment);
      console.log("totalCurrentValue", totalCurrentValue);

      // Log the aggregated profit
      if (totalCurrentValue > totalOriginalInvestment) {
        const totalProfit = totalCurrentValue - totalOriginalInvestment;

        logToFile(
          `User ${userEmail} made a total profit of $${totalProfit.toFixed(
            2
          )} across all tokens.`
        );

        for (const detail of profitDetails) {
          const { token, txDate, notes, price } = detail;

          // Define the start and end of the date ranges for the previous weeks
          const dateRanges = [
            { start: "2024-12-11", end: "2024-12-11" }, // Previous-Previous-Previous week
            { start: "2024-12-18", end: "2024-12-18" }, // Previous-Previous week
            { start: "2024-12-26", end: "2024-12-26" }, // Previous week
          ];

          let previousProfits = [];

          for (const range of dateRanges) {
            const targetDate = new Date(range.start);
            const startOfDay = new Date(targetDate.setUTCHours(0, 0, 0, 0));
            const endOfDay = new Date(targetDate.setUTCHours(23, 59, 59, 999));

            // Query the database for logs within each date range
            const getProfitLogs = await profitLogService.findOne({
              userEmail,
              profitAccountEmail,
              currencyRef: token,
              logDate: { $gte: startOfDay, $lte: endOfDay },
            });

            // Store the profit for this range
            previousProfits.push(Number(getProfitLogs?.totalProfit) || 0);
          }
          console.log("previousProfits", previousProfits);

          const [profitWeek1, profitWeek2, profitWeek3] = previousProfits; // 11-12-2024 and 26-12-2024 profits
          console.log("Profits from two weeks:", {
            profitWeek1,
            profitWeek2,
            profitWeek3,
          });

          let previousProfit = Math.max(profitWeek1, profitWeek2, profitWeek3); // Take the maximum of the two weeks
          console.log("previousProfit:", previousProfit);

          console.log("totalCurrentValue", totalCurrentValue);
          console.log("totalProfit", totalProfit);
          console.log("this week profit", totalProfit - previousProfit);

          let profit, profitToTakeInUsd, profitToTakeInCrypto;
          profit = (totalProfit - previousProfit) / profitDetails.length;
          profitToTakeInUsd = profit * 0.1;
          profitToTakeInCrypto = profitToTakeInUsd / price;

          console.log("profit", profit);
          console.log("profitToTakeInUsd", profitToTakeInUsd);
          console.log("profitToTakeInCrypto", profitToTakeInCrypto);

          if (totalProfit > profitWeek1 && totalProfit > profitWeek2) {
            if (detail.originalInvestment < detail.currentValue) {
              logToFile(
                `Token ${token}: Profit $${profit.toFixed(
                  2
                )}. Taking 10%: $${profitToTakeInUsd.toFixed(
                  2
                )} (${profitToTakeInCrypto.toFixed(8)} ${token}).`
              );

              // Subtract profit in crypto from the user's wallet
              await subtractFromUserWallet(
                userEmail,
                token,
                profitToTakeInCrypto
              );

              // Add the profit to the profit account
              await addToUserWallet(
                profitAccountEmail,
                token,
                profitToTakeInCrypto
              );

              // Log the profit details in the new table (profit_logs)
              await profitLogService.create({
                userEmail,
                profitAccountEmail,
                currencyRef: token,
                profitInCrypto: profitToTakeInCrypto,
                profitInUsd: profitToTakeInUsd,
                originalInvestment: detail.originalInvestment,
                currentValue: detail.currentValue,
                txDate: new Date(),
                logDate: new Date(),
                note: `10% profit taken from ${userEmail} in ${token}.`,
                totalProfit: totalProfit,
                type: "Profit",
              });

              // Create a new transaction for the profit account
              const newProfitTransaction: Transaction = {
                orderId: "", // Reference the original transaction
                extRef: "", // Optional external reference
                txId: "", // Optional transaction ID
                from: userEmail, // From the user's email
                to: profitAccountEmail, // To the profit account
                amount: profitToTakeInCrypto, // Amount of crypto taken as profit
                info: "Profit transferred", // Information about the transaction
                status: OrderStatus.Completed, // Status of the transaction
                currencyRef: token, // The currency in which profit is transferred (e.g., BTC)
                walletType: "Profit Account", // Indicate that this is for the profit account
                transactionType: "PROFIT", // Type of transaction
                exchangeName: "CEX", // Exchange name if applicable
                email: profitAccountEmail, // The email for the profit account
                txDate: new Date(), // Date of the profit transaction
                benificaryAddress: "", // Beneficiary address if applicable
                notes: `Profit of ${profitToTakeInCrypto.toFixed(
                  8
                )} ${token} taken from ${userEmail} and transferred to profit account`,
              };

              await txservice.create(newProfitTransaction);

              // Mark the original transaction as profit taken
              await txservice.updatePart(
                {
                  email: userEmail,
                  txDate: txDate,
                },
                {
                  $set: {
                    profitTaken: true,
                    profitLastTakenDate: new Date(),
                    notes:
                      notes +
                      ", " +
                      `10% tip taken in ${token} (Crypto: ${profitToTakeInCrypto.toFixed(
                        8
                      )} ${token}, USD: $${profitToTakeInUsd.toFixed(
                        2
                      )}) and transferred to wallet@azooca.com on ${new Date()}`,
                  },
                }
              );

              // Send email notification after logging the profit details
              await new SendEmail().sendProfitTakenEmail({
                userEmail: userEmail,
                profitAccountEmail: profitAccountEmail,
                currencyRef: token,
                profitToTakeInCrypto: profitToTakeInCrypto,
                profitToTakeInUsd: profitToTakeInUsd,
                txDate: txDate,
                originalInvestment: detail.originalInvestment,
                currentValue: detail.currentValue,
              });
            } else {
              logToFile(
                `User ${userEmail} has no profit registered in ${
                  detail.token
                }. Original: $${detail.originalInvestment.toFixed(
                  2
                )}, Current: $${detail.currentValue.toFixed(2)}`
              );
            }
          } else {
            logToFile(
              `User ${userEmail} has no significant profit compared to the previous weeks in ${detail.token}.`
            );
          }
        }
      } else {
        logToFile(
          `User ${userEmail} has no overall profit. Original: $${totalOriginalInvestment.toFixed(
            2
          )}, Current: $${totalCurrentValue.toFixed(2)}`
        );

        console.log(`User ${userEmail} has no overall profit. `);
        // Log the profit details in the new table (profit_logs)
        await profitLogService.create({
          userEmail,
          profitAccountEmail,
          currencyRef: "NA",
          profitInCrypto: 0,
          profitInUsd: 0,
          originalInvestment: totalOriginalInvestment,
          currentValue: totalCurrentValue,
          txDate: new Date(),
          logDate: new Date(),
          note: ``,
          totalProfit: 0,
          type: "Profit",
        });
      }

      logToFile(
        `================= End Processing User: ${userEmail} =================\n`
      );
    }
  } catch (err: any) {
    console.log("Error during profit calculation:", err);
    logToFile(`General error during profit calculation: ${err.message}`);
  }
}

export async function profitCalculationOnOverallPdf() {
  try {
    const emails = [
      "banks144@yahoo.com",
      "donpanchos4me@gmail.com",
      "rey.barthelemy@gmail.com",
      "fowlertrucking14@yahoo.com",
      "cielinoinc@gmail.com",
      "trujillolouis@icloud.com",
      "martinmonge@verizon.net",
      "kathy.oglesbee@yahoo.com",
      "sherri@tristatematerials.com",
      "dbrevolution11@gmail.com",
      "taylorfowler@icloud.com",
      "wwrv@verizon.net",
      "devin.delamora@icloud.com",
      "daniel.estrada1991@yahoo.com",
      "sj.brown@yahoo.com",
      "brownst81@yahoo.com",
      "vosloo.wilmie@gmail.com",
      "bmoralez12@gmail.com",
      "carrieslyons@yahoo.com",
    ];

    for (let index = 0; index < emails.length; index++) {
      const userEmail = emails[index];

      logToFile(
        `\n================= Start Processing User: ${userEmail} =================`
      );

      const lastMonthDate = moment()
        .subtract(3, "months")
        .startOf("month")
        .toDate();
      const currentMonthDate = moment().toDate();

      const transactions = await txservice.find({
        email: userEmail,
        transactionType: "INVESTMENT",
        txDate: {
          $gte: lastMonthDate,
          $lt: currentMonthDate,
        },
        currencyRef: {
          $nin: ["INEX", "WIBS", "DaCrazy", "IN500", "IUSD+"],
        },
        amountInvested: {
          $gt: 0,
        },
      });

      if (!transactions || transactions.length === 0) {
        logToFile(`No transactions for ${userEmail} in the last month.`);
        continue;
      }

      const tokenAggregates: Record<
        string,
        { originalInvestment: number; currentAmount: number }
      > = {};

      for (const tx of transactions) {
        const currencyRef = String(tx.currencyRef);
        const originalInvestment = Number(tx.amountInvested);
        const currentAmount = tx.amount;

        if (!tokenAggregates[currencyRef]) {
          tokenAggregates[currencyRef] = {
            originalInvestment: 0,
            currentAmount: 0,
          };
        }

        tokenAggregates[currencyRef].originalInvestment += originalInvestment;
        tokenAggregates[currencyRef].currentAmount += currentAmount;
      }

      const currentPrices = await Promise.all(
        Object.keys(tokenAggregates).map(async (token) => {
          const response = await getCryptoPriceBySymobl(token);
          return { token, price: response.data.lastPrice };
        })
      );

      const profitDetails: any[] = [];
      let totalOriginalInvestment = 0;
      let totalCurrentInvestment = 0;

      currentPrices.forEach(({ token, price }) => {
        const aggregate = tokenAggregates[token];
        const currentValue = aggregate.currentAmount * price;
        const originalInvestment = aggregate.originalInvestment;

        profitDetails.push({
          token,
          originalInvestment,
          currentInvestment: currentValue,
          investmentRate: originalInvestment / aggregate.currentAmount,
          currentRate: price,
          txDate: transactions.find(
            (tx: any) => tx.currencyRef === token && tx.amountInvested > 0
          )?.txDate,
        });

        totalOriginalInvestment += originalInvestment;
        totalCurrentInvestment += currentValue;
      });

      const totalProfitOrLoss =
        totalCurrentInvestment - totalOriginalInvestment;
      const profitOrLossPercentage =
        (totalProfitOrLoss / totalOriginalInvestment) * 100;

      logToFile(`Generated profit details for ${userEmail}`);

      // Generate PDF Report
      generateStyledPDFReport(
        userEmail,
        profitDetails,
        totalOriginalInvestment,
        totalProfitOrLoss,
        profitOrLossPercentage,
        totalCurrentInvestment
      );

      logToFile(
        `================= End Processing User: ${userEmail} =================\n`
      );
    }
  } catch (err: any) {
    console.log("Error during profit calculation:", err);
    logToFile(`General error during profit calculation: ${err.message}`);
  }
}

function generateStyledPDFReport(
  userEmail: string,
  profitDetails: any[],
  totalOriginalInvestment: number,
  totalProfitOrLoss: number,
  profitOrLossPercentage: number,
  totalCurrentValue: number
) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(`Investment Report for ${userEmail}`, 10, 10);
  doc.setFontSize(12);
  doc.text(`Generated on: ${moment().format("YYYY-MM-DD HH:mm:ss")}`, 10, 20);

  autoTable(doc, {
    startY: 30,
    head: [
      [
        "Token",
        "Original Investment",
        "Current Investment",
        "Investment Rate",
        "Current Rate",
        "Transaction Date",
      ],
    ],
    body: profitDetails.map((detail) => [
      detail.token,
      `$${detail.originalInvestment.toFixed(2)}`,
      `$${detail.currentInvestment.toFixed(2)}`,
      `$${detail.investmentRate.toFixed(4)}`,
      `$${detail.currentRate.toFixed(4)}`,
      moment(detail.txDate).format("YYYY-MM-DD HH:mm:ss"),
    ]),
    styles: { fontSize: 10 },
    theme: "grid",
  });

  const summaryStartY = doc.previousAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.text("Summary:", 10, summaryStartY);
  doc.setFontSize(10);
  doc.text(
    `Total Original Investment: $${totalOriginalInvestment.toFixed(2)}`,
    10,
    summaryStartY + 10
  );
  doc.text(
    `Total Current  Investment: $${totalCurrentValue.toFixed(2)}`,
    10,
    summaryStartY + 20
  );
  doc.text(
    `Total Profit/Loss: $${totalProfitOrLoss.toFixed(2)}`,
    10,
    summaryStartY + 30
  );
  doc.text(
    `Profit/Loss Percentage: ${profitOrLossPercentage.toFixed(2)}%`,
    10,
    summaryStartY + 40
  );

  const filename = `Investment_Report_${userEmail.replace(/[@.]/g, "_")}.pdf`;
  doc.save(filename);

  logToFile(`PDF report saved: ${filename}`);
}

// Function to subtract from the user's wallet (decrement balance)
async function subtractFromUserWallet(
  userEmail: string,
  currencyRef: string,
  amount: number
) {
  console.log(`Subtracting ${amount} ${currencyRef} from user ${userEmail}`);

  await orderService.checkAndCreateUserWallet(userEmail, currencyRef);

  let updateUser = await uservice.updatePart(
    {
      email: userEmail,
      "userWallets.coinSymbol": currencyRef,
    },
    {
      $inc: {
        "userWallets.$.coinBalance": -1 * amount, // Decrement the crypto balance
      },
      $set: {
        coinLastUsedOn: new Date(),
      },
    }
  );
}

// Function to add to the profit account (increment balance)
async function addToUserWallet(
  userEmail: string,
  currencyRef: string,
  amount: number
) {
  console.log(
    `Adding ${amount} ${currencyRef} to profit account (${userEmail})`
  );

  await orderService.checkAndCreateUserWallet(userEmail, currencyRef);

  let updateUser = await uservice.updatePart(
    {
      email: userEmail,
      "userWallets.coinSymbol": currencyRef,
    },
    {
      $inc: {
        "userWallets.$.coinBalance": amount, // Increment the crypto balance
      },
      $set: {
        coinLastUsedOn: new Date(),
      },
    }
  );
}
