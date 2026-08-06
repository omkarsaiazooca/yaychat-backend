import express, { Router } from 'express';
import { PaymentsController } from "../controllers/paymentAPI";
import { PaypalPaymentController } from '../controllers/paypalAPI';

const paymentRouter: Router = Router();
const paymentController: PaymentsController = new PaymentsController();

paymentRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  paymentController.StripeWebhooks
);
paymentRouter.post('/createPaymentIntent', paymentController.createStripePaymentIntent);
paymentRouter.post('/createQuantumPaymentIntent', paymentController.createQuantumStripePaymentIntent);
paymentRouter.post('/getPayment', paymentController.getStripePayment);
paymentRouter.post('/createPaymentLink', paymentController.createStripePaymentLink);
paymentRouter.get('/confirmPayment', paymentController.confirmPayment)

export const paymentsRoute = paymentRouter;

const paypalPaymentRouter: Router = Router();
const paypalPaymentController: PaypalPaymentController = new PaypalPaymentController();

paypalPaymentRouter.post('/createPayment', paypalPaymentController.createPaypalPaymentOrder);
paypalPaymentRouter.post('/executePayment', paypalPaymentController.executePaypalPayment);
paypalPaymentRouter.get('/getPayment', paypalPaymentController.getPaypalPayment);


export const paypalPaymentRoute = paypalPaymentRouter;
