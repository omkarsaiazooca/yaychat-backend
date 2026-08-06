import { Lottery, Ticket } from "../data/lottery";
import { LotterySchema, LotteryModel } from "../models/lottery";
import { ServiceBase } from "./base";

export class LotteryService extends ServiceBase<Lottery, LotteryModel> {
  constructor() {
    super(LotterySchema, "Lottery");
  }

  async refreshTimes2() {
    try {
      let getAllLotteries = await this.find({});
      // Set the current date to midnight for accurate comparison
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      for (let index = 0; index < getAllLotteries.length; index++) {
        const element = getAllLotteries[index];
        let elementDrawDate = new Date(element.drawDate);
        elementDrawDate.setHours(0, 0, 0, 0);

        if (
          element.status === "open" &&
          elementDrawDate.getTime() === currentDate.getTime()
        ) {
          // Refresh the draw and close date to another 7 days
          let nextDrawDate = new Date();
          nextDrawDate.setDate(currentDate.getDate() + 7);
          let closeDate = new Date(nextDrawDate.getTime());

          await this.updatePart(
            {
              uniqueCode: element.uniqueCode,
            },
            {
              $set: {
                closeDate: closeDate,
                drawDate: nextDrawDate,
              },
            }
          );
          console.log(
            "Refreshed time for lottery with unique Code",
            element.uniqueCode
          );
        }
      }
    } catch (err) {
      console.error("Error in refreshTimes function:", err);
    }
  }

  async refreshTimes() {
    try {
      let getAllLotteries = await this.find({});
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0); // Sets the current date to midnight for comparison

      for (let index = 0; index < getAllLotteries.length; index++) {
        const element = getAllLotteries[index];
        let elementDrawDate = new Date(element.drawDate);
        elementDrawDate.setHours(0, 0, 0, 0);

        // Check if the lottery is open and the draw date has passed or is today
        if (
          element.status === "open" &&
          elementDrawDate.getTime() <= currentDate.getTime()
        ) {
          // Refresh the draw and close date to 7 days from now
          let nextDrawDate = new Date(currentDate.getTime());
          nextDrawDate.setDate(currentDate.getDate() + 7); // Set to 7 days ahead
          let closeDate = new Date(nextDrawDate.getTime()); // Copy of nextDrawDate for the closeDate

          await this.updatePart(
            {
              uniqueCode: element.uniqueCode,
            },
            {
              $set: {
                closeDate: closeDate,
                drawDate: nextDrawDate,
              },
            }
          );
          console.log(
            "Refreshed time for lottery with unique Code",
            element.uniqueCode
          );
        }
      }
    } catch (err) {
      console.error("Error in refreshTimes function:", err);
    }
  }
}
