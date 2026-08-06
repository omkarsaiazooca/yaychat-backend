// iap.controller.ts

import axios from 'axios';
import { Request, Response } from 'express';

export const verifyAppleReceipt = async (req: Request, res: Response) => {
  const { receiptData } = req.body;

  if (!receiptData) {
    return res.status(400).json({ error: 'Missing receipt data' });
  }

  try {
    const response = await axios.post('https://buy.itunes.apple.com/verifyReceipt', {
      'receipt-data': receiptData,
      'password': process.env.APPLE_SHARED_SECRET, // App Store Connect -> App-Specific Shared Secret
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const { status, latest_receipt_info } = response.data;

    if (status === 0) {
      // ✅ Successful validation
      const latestReceipt = latest_receipt_info?.[0];

      // Save latestReceipt details into database here
      // example: subscription id, expiry date, product_id, transaction_id

      return res.json({ success: true, latestReceipt });
    } else {
      return res.status(400).json({ error: 'Invalid receipt', details: response.data });
    }
  } catch (error: any) {
    console.error('Receipt verification error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
