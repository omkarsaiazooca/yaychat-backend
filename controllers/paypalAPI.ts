import { keys } from "../config/keys";
const paypal = require('paypal-rest-sdk');
const env = keys.env.key;
let paypal_client_id_key = env == "development" ? keys.paypal_client_id_test.key : keys.paypal_client_id_live.key;
let paypal_secret_key = env == "development" ? keys.paypal_secret_key_test.key : keys.paypal_secret_key_live.key;


paypal.configure({
  'mode': 'sandbox', //sandbox or live
  'client_id': paypal_client_id_key,
  'client_secret': paypal_secret_key
});
export class PaypalPaymentController {
  constructor() {}

  async createPaypalPaymentOrder(req: any, res: any) {
    try{
        var create_payment_json = {
            "intent": "sale",
            "payer": {
                "payment_method": "paypal"
            },
            "redirect_urls": {
                "return_url": "http://return.url",
                "cancel_url": "http://cancel.url"
            },
            "transactions": [{
                "item_list": {
                    "items": [{
                        "name": "item",
                        "sku": "item",
                        "price": "1.00",
                        "currency": "USD",
                        "quantity": 1
                    }]
                },
                "amount": {
                    "currency": "USD",
                    "total": "1.00"
                },
                "description": "This is the payment description."
            }]
        };
        let res = await paypal.payment.create(create_payment_json)
        console.log(res)
        return res;
    } catch(err) {
        res.statusCode = 500;
        res.send({ status: 500, data: { message: "Unhandled error: " + err } });
        return;
    }
  }

  async executePaypalPayment(req: any, res: any) {}

  async getPaypalPayment(req: any, res: any) {}
}
