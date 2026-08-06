import { UserCartTicket } from "../data/lottery";
import { UserCartTicketModel, UserCartTicketSchema } from "../models/lottery";
import { ServiceBase } from "./base";

export class UserCartTicketService extends ServiceBase<
  UserCartTicket,
  UserCartTicketModel
> {
  constructor() {
    super(UserCartTicketSchema, "UserCartTickets");
  }
  /*
  async updateCartItems0(
    cartId: string,
    lotteryId: string,
    tickets: number[]
  ): Promise<UserCartTicket | null> {
    const query = { cartId: cartId, "tickets.lotteryId": lotteryId };
    const update = {
      $set: { "tickets.$.ticketNumbers": tickets },
    };

    return this.updatePart(query, update);
  }

  async updateCartItems1(
    cartId: string,
    lotteryId: string,
    updatedTickets: { ticketNumbers: string[]; isWinningTicket: boolean }[]
  ): Promise<UserCartTicket | null> {
    // Find the cart based on cartId and lotteryId
    const cart = await this.findOne({ cartId, "tickets.lotteryId": lotteryId });
    if (!cart) {
      console.log("Cart not found.");
      return null;
    }

    // Update the tickets within the cart
    const newTickets = cart.tickets.map((ticket) => {
      // Find the corresponding updated ticket, if it exists
      const updatedTicket = updatedTickets.find(
        (ut) => ut.ticketNumbers.toString() === ticket.ticketNumbers.toString()
      );
      if (updatedTicket) {
        return { ...ticket, ...updatedTicket };
      }
      return ticket;
    });

    // Update the cart with the new tickets array
    const updatedCart = await this.updatePart(
      { cartId },
      { $set: { tickets: newTickets } }
    );

    return updatedCart;
  }

  // async updateCartItems2(cartId: string, lotteryId: string, updatedTickets: any[]): Promise<any> {
  //   const cart = await this.findOne({ cartId, 'tickets.lotteryId': lotteryId });
  //   if (!cart) {
  //     console.log('Cart not found.');
  //     return null;
  //   }

  //   // Modify the `ticketNumbers` in application code
  //   cart.tickets.forEach(ticket => {
  //     if(ticket.lotteryId === lotteryId) {
  //       const updateInfo = updatedTickets.find(ut => ut.id === ticket.id);
  //       if(updateInfo) {
  //         ticket.ticketNumbers = updateInfo.ticketNumbers;
  //         ticket.isWinningTicket = updateInfo.isWinningTicket;
  //       }
  //     }
  //   });

  //   // Update the entire document or just the tickets array
  //   await this.updatePart(
  //     { cartId },
  //     { $set: { 'tickets': cart.tickets } }
  //   );
  // }

  async updateCartItems3(
    cartId: string,
    lotteryId: string,
    updatedTickets: any[]
  ): Promise<any> {
    try {
      const cart = await this.findOne({
        cartId,
        "tickets.lotteryId": lotteryId,
      });
      if (!cart) {
        console.log("Cart not found.");
        return null;
      }

      // Assuming `updatedTickets` include identifiable information, perhaps matching on ticketNumbers directly
      cart.tickets.forEach((ticket, index) => {
        if (ticket.lotteryId === lotteryId) {
          const updateInfo = updatedTickets.find(
            (ut) =>
              JSON.stringify(ut.ticketNumbers.sort()) ===
              JSON.stringify(ticket.ticketNumbers.sort())
          );
          console.log("updateInfo", updateInfo)
          if (updateInfo) {
            // Directly modifying the subdocument fields. Avoid direct `id` usage.
            cart.tickets[index].ticketNumbers = updateInfo.ticketNumbers;
          }
        }
      });

      console.log("cart.tickets", cart.tickets)
      console.log("cart.tickets", cart.tickets[0].ticketNumbers)
      // Update the entire document or just the tickets array
      await this.updatePart({ cartId }, { $set: { tickets: cart.tickets } });
    } catch (err: any) {
      console.log("err", err);
    }
  }

  async updateCartItems(cartId: string, lotteryId: string, updatedTickets: any[]): Promise<any> {
    try {
      const cart = await this.findOne({ cartId, "tickets.lotteryId": lotteryId });
      if (!cart) {
        console.log("Cart not found.");
        return null;
      }
  
      // Directly update tickets with updatedTickets information
      const newTickets = cart.tickets.map(ticket => {
        // Assuming lotteryId matches and you're updating all tickets under this lotteryId
        if (ticket.lotteryId === lotteryId) {
          // Find the corresponding ticket update information based on some logic
          const updateInfo = updatedTickets.find(ut => 
            // Assuming a matching condition can be established here
            JSON.stringify(ut.ticketNumbers.sort()) === JSON.stringify(ticket.ticketNumbers.sort())
          );
          console.log("updateInfo", updateInfo)
          if (updateInfo) {
            return { ...ticket, ticketNumbers: updateInfo.ticketNumbers };
          }
        }
        return ticket;
      });
  
      // Update the cart with the newly formed tickets array
      await this.updatePart({ cartId }, { $set: { tickets: newTickets } });
      console.log("Tickets updated successfully.");
    } catch (err) {
      console.log("Error updating cart items:", err);
    }
  } */
}
