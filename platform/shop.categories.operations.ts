import { Category } from "../data/categories";
import { ShopCategoriesService } from "../services/shop.catogeries.service";
import { BaseAPIOperations } from "./base.operations";
import { Request, Response } from "express";
import { createPaypalOrderForShop } from "./paypal.wrapper";
import { ShopOrdersService } from "../services/shop.order.service";
import { UserService } from "../services/user.service";
import { UserWallet } from "../data/user";
import { NewGiftCard } from "../data/newGiftCard";
import { NewGiftCardService } from "../services/newGiftCard.service";
import { TransactionService } from "../services/transaction.service";
import { OrderStatus } from "../data/order";
import { v1 as uuidv1 } from "uuid";
import { getPriceByName } from "../controllers/priceAPI";
import { SendEmail } from "./email.operations";
import {
  createFreeGiftCard,
  createGiftCard,
} from "../helpers/createShopGiftCard";

const shopCategoriesService: ShopCategoriesService =
  new ShopCategoriesService();
const shopOrdersService: ShopOrdersService = new ShopOrdersService();
const uservice: UserService = new UserService();
const newGiftCardService: NewGiftCardService = new NewGiftCardService();
const txService: TransactionService = new TransactionService();
export class ShopCategoriesOperations extends BaseAPIOperations {
  constructor(req: Request, res: Response) {
    super(req, res);
  }

  // Create a new category
  async createCategory(req: any, res: any) {
    try {
      const categoryData = req.body as Category;
      console.log("categoryData", categoryData);
      const createdCategory = await shopCategoriesService.create(categoryData);
      return {
        status: 200,
        data: createdCategory,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  // Get all categories
  async getCategories(req: any, res: any) {
    try {
      const categories = await shopCategoriesService.find({});
      return {
        status: 200,
        data: categories,
      };
    } catch (err) {
      return { status: 500, data: err };
    }
  }

  // Get a category by ID
  async getCategoryById(req: any, res: any) {
    try {
      const categoryId = req.params.id;
      const category = await shopCategoriesService.findOne(categoryId);
      if (category) {
        return {
          status: 200,
          data: category,
        };
      } else {
        return {
          status: 500,
          data: {
            message: "Category not found",
          },
        };
      }
    } catch (err: any) {
      return { status: 500, data: err };
    }
  }

  async createOrder(req: any, res: any) {
    try {
      const category = await shopOrdersService.create(req.body);

      if (category) {
        return {
          status: 200,
          data: category,
        };
      } else {
        return {
          status: 500,
          data: {
            message: "Category not found",
          },
        };
      }
    } catch (err: any) {
      return { status: 500, data: err };
    }
  }

  async updateOrder(req: any, res: any) {
    try {
      const { tracking_number } = req.body; // Assuming the tracking number is passed as a URL parameter
      const updateData = req.body; // The fields to update, expected to be in the request body

      // Find the order by tracking_number and update it with the new data
      const getOrder = await shopOrdersService.findOne({ tracking_number });

      if (getOrder) {
        const updateOrder = await shopOrdersService.updatePart(
          {
            tracking_number,
          },
          {
            $set: {
              payment_details: updateData.payment_details,
            },
          }
        );
        return {
          status: 200,
          data: getOrder,
        };
      } else {
        return {
          status: 404,
          data: {
            message: "Order not found",
          },
        };
      }
    } catch (err: any) {
      return {
        status: 500,
        data: {
          message: "An error occurred while updating the order",
          error: err.message,
        },
      };
    }
  }

  async updateOrderUsingWallet(req: any, res: any) {
    try {
      const { tracking_number } = req.body; // Assuming the tracking number is passed as a URL parameter
      const updateData = req.body; // The fields to update, expected to be in the request body

      // Find the order by tracking_number and update it with the new data
      const getShopOrder = await shopOrdersService.findOne({ tracking_number });

      if (getShopOrder) {
        const updateOrder = await shopOrdersService.updatePart(
          {
            tracking_number,
          },
          {
            $set: {
              payment_details: updateData.payment_details,
            },
          }
        );

        console.log("Processing shop order", getShopOrder);
        if (
          getShopOrder.order_status === "order-pending" &&
          getShopOrder.payment_status === "payment-pending"
        ) {
          const updateOrder = await shopOrdersService.updatePart(
            {
              tracking_number: getShopOrder.tracking_number,
            },
            {
              $set: {
                order_status: "order-completed",
                payment_status: "payment-success",
              },
            }
          );
          let defaultCurrency = "USD";
          const usdRate = await getPriceByName(defaultCurrency);
          for (let i = 0; i < getShopOrder.products.length; i++) {
            // Get the product's order quantity and unit price
            let product = getShopOrder.products[i];
            let productQuantity = Number(product.order_quantity); // Convert order quantity to integer
            let unitPrice = Number(product.unit_price); // Convert unit price to a number

            let user = await uservice.findOne({
              email: getShopOrder.customer_contact,
            });
            let updateUser = await uservice.updatePart(
              {
                email:getShopOrder.customer_contact,
                "userWallets.coinSymbol": getShopOrder.payment_details.currency_details.currency,
              },
              {
                $inc: {
                  "userWallets.$.coinBalance": -1 * Number(getShopOrder.payment_details.currency_details.amount), // Decrement the crypto balance
                },
                $set: {
                  coinLastUsedOn: new Date(),
                },
              }
            );
            // Loop through the product quantity and create a gift card for each unit
            for (let j = 0; j < productQuantity; j++) {
              let createGiftCardForUser = await createGiftCard(
                product.slug,
                getShopOrder.customer_contact,
                unitPrice
              );
              /*
              let userReferralCode = user.referralCodeUsed;
 
              if (userReferralCode) {
                try {
                  let referredUser = await uservice.findOne({
                    referralCode: userReferralCode,
                  });
 
                  if (referredUser) {
                    let getUserReferralData =
                      await referralEarningService.findOne({
                        referrerEmail: referredUser.email,
                      });
 
                    if (getUserReferralData) {
                      let existingOrders = getUserReferralData.orders || [];
                      let commissionValue = unitPrice; // USD value
                      let latestBaseRate = await currencyService.findOne({
                        code: "INEX",
                      });
 
                      if (latestBaseRate && latestBaseRate.buyPrice) {
                        let finalCommission =
                          (commissionValue / latestBaseRate.buyPrice) *
                          (1 / 100);
 
                        let addNewOrder = {
                          email: user.email,
                          amount: unitPrice,
                          currency: product.name,
                          type: "Shop Purchase",
                          date: new Date(),
                          commissionValue: finalCommission,
                        };
 
                        existingOrders.push(addNewOrder);
 
                        // Add the referral commission
                        let updateCommissionData =
                          await referralEarningService.updatePart(
                            {
                              referrerEmail: referredUser.email,
                            },
                            {
                              $set: {
                                commissionCurrency: "INEX",
                                commissionPercentage: 5,
                                orders: existingOrders,
                                totalEarned:
                                  (getUserReferralData.totalEarned || 0) +
                                  finalCommission,
                              },
                            }
                          );
 
                        if (updateCommissionData) {
                          console.log(
                            "Referral commission updated successfully."
                          );
                        } else {
                          console.error(
                            "Failed to update referral commission."
                          );
                        }
                      } else {
                        console.error("Invalid base rate data.");
                      }
                    } else {
                      console.error(
                        "Referral data not found for the referrer."
                      );
                    }
                  } else {
                    console.error("Referred user not found.");
                  }
                } catch (error) {
                  console.error(
                    "Error processing referral commission:",
                    error
                  );
                }
              } */


              await new SendEmail().sendSelfGiftCardNotification(
                product.receiver_email
                  ? product.receiver_email
                  : getShopOrder.customer_contact,
                product.name,
                createGiftCardForUser.currencies,
                unitPrice,
                createGiftCardForUser.voucher,
                product.image,
                unitPrice,
                product.personal_message
              );
            }
          }
        }

        return {
          status: 200,
          data: getShopOrder,
        };
      } else {
        return {
          status: 404,
          data: {
            message: "Order not found",
          },
        };
      }
    } catch (err: any) {
      return {
        status: 500,
        data: {
          message: "An error occurred while updating the order",
          error: err.message,
        },
      };
    }
  }

  async getOrders(req: any, res: any) {
    try {
      const category = await shopOrdersService.find({});

      if (category) {
        return {
          status: 200,
          data: category,
        };
      } else {
        return {
          status: 500,
          data: {
            message: "Category not found",
          },
        };
      }
    } catch (err: any) {
      return { status: 500, data: err };
    }
  }

  async getUserOrders(req: any, res: any) {
    try {
      const category = await shopOrdersService.find({
        customer_contact: String(req.params.email).toLowerCase(),
      });

      if (category) {
        return {
          status: 200,
          data: category,
        };
      } else {
        return {
          status: 500,
          data: {
            message: "No Orders found",
          },
        };
      }
    } catch (err: any) {
      console.log("i am here ", err);
      return { status: 500, data: err };
    }
  }

  async getUserByTrackingNumber(req: any, res: any) {
    try {
      console.log("eq.params", req.params);
      let category;
      if (req.params.email) {
        category = await shopOrdersService.findOne({
          tracking_number: String(req.params.email).toLowerCase(),
        });
      }
      if (req.params.id) {
        category = await shopOrdersService.findOne({
          tracking_number: String(req.params.id).toLowerCase(),
        });
      }

      console.log("tra", req.params.id);
      if (category) {
        return {
          status: 200,
          data: category,
        };
      } else {
        return {
          status: 500,
          data: {
            message: "No Orders found",
          },
        };
      }
    } catch (err: any) {
      console.log("i am here ", err);
      return { status: 500, data: err };
    }
  }

  async updateOrderByAdmin(req: any, res: any) {
    try {
      const { tracking_number } = req.body; // Assuming the tracking number is passed as a URL parameter
      const updateData = req.body; // The fields to update, expected to be in the request body

      // Find the order by tracking_number and update it with the new data
      const getOrder = await shopOrdersService.findOne({ tracking_number });

      if (getOrder) {
        const updateOrder = await shopOrdersService.updatePart(
          {
            tracking_number,
          },
          {
            $set: {
              order_status: updateData.orderStatus,
              payment_status: updateData.paymentStatus,
            },
          }
        );
        if (updateData.paymentStatus === "Completed") {
          let defaultCurrency = "USD";
          const usdRate = await getPriceByName(defaultCurrency);
          for (let i = 0; i < getOrder.products.length; i++) {
            // Get the product's order quantity and unit price
            let product = getOrder.products[i];
            let productQuantity = Number(product.order_quantity); // Convert order quantity to integer
            let unitPrice = Number(product.unit_price); // Convert unit price to a number

            // Loop through the product quantity and create a gift card for each unit
            for (let j = 0; j < productQuantity; j++) {
              let createGiftCardForUser = await createGiftCard(
                product.slug,
                getOrder.customer_contact,
                unitPrice
              );

              await new SendEmail().sendSelfGiftCardNotification(
                product.receiver_email
                  ? product.receiver_email
                  : getOrder.customer_contact,
                product.name,
                createGiftCardForUser.currencies,
                unitPrice,
                createGiftCardForUser.voucher,
                product.image,
                unitPrice,
                product.personal_message
              );
            }
          }
        }

        //check if user is first user on shop order
        const gerOrderByEmail = await shopOrdersService.find({
          customer_contact: getOrder.customer_contact,
          order_status: "order-completed",
          payment_status: "payment-success",
        });
        console.log("gerOrderByEmail", gerOrderByEmail);
        console.log("gerOrderByEmail length", gerOrderByEmail.length);
        // Sending a free gift card if the customer has no prior orders this is first order
        if (gerOrderByEmail.length === 1) {
          let createFreeGiftCardForUser = await createFreeGiftCard(
            "gift-card-50",
            getOrder.customer_contact,
            50
          );
          await new SendEmail().sendSelfFreeGiftCardNotification(
            getOrder.customer_contact,
            "Gift Card $50",
            createFreeGiftCardForUser.currencies,
            50,
            createFreeGiftCardForUser.voucher,
            "",
            50
          );
        }
        return {
          status: 200,
          data: getOrder,
        };
      } else {
        return {
          status: 404,
          data: {
            message: "Order not found",
          },
        };
      }
    } catch (err: any) {
      return {
        status: 500,
        data: {
          message: "An error occurred while updating the order",
          error: err.message,
        },
      };
    }
  }

  async refundOrder(req: any, res: any) {
    try {
      const { tracking_number } = req.body; // Assuming the tracking number is passed in the request body

      // Find the order by tracking_number
      const getOrder = await shopOrdersService.findOne({ tracking_number });

      if (getOrder) {
        const objectIdDate = getOrder.created;

        console.log("objectIdDate", objectIdDate);

        // Check if the order status is "completed"
        if (getOrder.order_status === "order-completed") {
          // Get the current date
          const currentDate = new Date();

          // Calculate the difference in days between the current date and the order creation date
          const timeDifference = currentDate.getTime() - objectIdDate.getTime();
          const daysDifference = timeDifference / (1000 * 3600 * 24);

          // If the order is older than 30 days, refund is not possible
          if (daysDifference > 30) {
            return {
              status: 400,
              data: {
                message: "Refund not possible. Order is older than 30 days.",
              },
            };
          } else {
            // Send emails to the admin and the user if within the 30-day window
            const userEmail = getOrder.customer_contact;
            const adminEmail = "wallet@azooca.com"; // Set the admin email here
            const product = getOrder.products[0]; // Assuming one product

            // Create email data
            const emailData = {
              email: userEmail,
              toEmail: userEmail,
              adminEmail: adminEmail,
              giftcardType: product.name,
              senderName: "Indexx Shop",
              giftToken: product.name,
              giftTokenAmount: product.order_quantity,
              messageFromSender: "Refund approved for your order",
              redeemCode: "N/A", // Assuming no redeem code for refund
              imageUrl: product.image,
              amountInUsd: product.unit_price,
              tracking_number: getOrder.tracking_number,
              paymentGateway: getOrder.payment_gateway,
            };

            const updateOrder = await shopOrdersService.updatePart(
              {
                tracking_number: getOrder.tracking_number,
              },
              {
                $set: {
                  order_status: "order-cancelled",
                  payment_status: "refund-in-progress",
                },
              }
            );

            // Send user and admin emails
            await Promise.all([
              new SendEmail().sendRefundEmailToUser(emailData),
              new SendEmail().sendRefundEmailToAdmin(emailData),
            ]);
          }
        } else {
          return {
            status: 400,
            data: {
              message: "Refund not possible. Order is not completed.",
            },
          };
        }

        // Proceed with the refund logic here if applicable
        return {
          status: 200,
          data: {
            message: "Refund processed successfully",
          },
        };
      } else {
        return {
          status: 404,
          data: {
            message: "Order not found",
          },
        };
      }
    } catch (err: any) {
      return {
        status: 500,
        data: {
          message: "An error occurred while processing the refund",
          error: err.message,
        },
      };
    }
  }

  async generateGiftCard(
    amount: any,
    email: any,
    currency: any,
    giftCardUrl: any,
    cardType: any
  ) {
    try {
      const voucherCode = Array.from({ length: 4 }, () =>
        Math.random().toString(36).toUpperCase().substring(2, 6)
      ).join("-");
      let userGiftCard = {
        voucher: voucherCode,
        amount: amount,
        dateOfGeneration: new Date(),
        isUsed: false,
        type: currency,
        createdBy: String(email).toLowerCase(),
        createdOn: new Date(),
        giftCardImgUrl: giftCardUrl,
        cardType: cardType,
      } as NewGiftCard;
      let giftCardDetails = await newGiftCardService.create(userGiftCard);
      //const toEmail = String(recevierEmail).toLowerCase();

      //create a transaction
      let newTx = await txService.create({
        email: email,
        orderId: uuidv1(),
        extRef: "",
        txId: "",
        from: "",

        to: "",
        amount: amount,
        info: "Created Gift Card",
        notes: `Gift Card (${voucherCode})`,
        status: OrderStatus.Completed,
        currencyRef: currency,
        walletType: "ASSET_WALLET",
        transactionType: "Create Gift",
        exchangeName: "CEX",
        txDate: new Date(),
        benificaryAddress: "",
      });

      let message = "Successfully created gift card";
      return { status: 200, data: { message, giftCardDetails } };
    } catch (err) {
      return { status: 500, data: err };
    }
  }
}
