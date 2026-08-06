import axios from "axios";
import { keys } from "../config/keys";
import { getQuantumRedirectUrls } from "../helpers/quantumPaymentRedirects";
//const { CLIENT_ID, APP_SECRET } = process.env;
let CLIENT_ID = keys.paypal_client_id_test.key;
let APP_SECRET = keys.paypal_secret_key_test.key;
//const base = "https://api-m.sandbox.paypal.com";
let base = "https://api-m.paypal.com";

if (keys.env.key === "test" || keys.env.key === "development") {
  console.log("Paypal is in test mode");
  base = "https://api-m.sandbox.paypal.com";
  CLIENT_ID = keys.paypal_client_id_test.key;
  APP_SECRET = keys.paypal_secret_key_test.key;
} else {
  console.log("Paypal is in live mode");
  base = "https://api-m.paypal.com";
  CLIENT_ID = keys.paypal_client_id_live.key;
  APP_SECRET = keys.paypal_secret_key_live.key;
}
/**
 * PayPal API helpers
 */

// Use the orders api to create an order
export async function createPaypalOrder(
  currency: string,
  amount: string,
  email: string
) {
  try {
    const accessToken = await generateAccessToken();
    const url = `${base}/v2/checkout/orders`;
    const response = await axios({
      baseURL: url,
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      data: JSON.stringify({
        intent: "CAPTURE",
        payer: {
          payment_method: "paypal",
        },
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount,
            },
          },
        ],
        //https://cex.indexx.ai/indexx-exchange/buy-sell/buy-in-progress/?token=15N79277MS7123615&PayerID=B7GG9DH5Y8KBN
        application_context: {
          return_url:
            "https://cex.indexx.ai/update/home",
          cancel_url: "https://cex.indexx.ai/update/home?success=false",
        },
      }),
    });
    if (response.status === 201 || response.status === 200) {
      return response.data;
    } else {
      throw new Error(response.statusText);
    }
    //return handleResponse(response);
  } catch (error) {
    console.log(error);
  }
}

export async function createPaypalOrderForBitcoinYay(
  currency: string,  // e.g., "USD"
  amount: string,    // e.g., "5.00"
  email: string,
  orderId?: string,
  source?: string,
  env?: string
) {
  try {
    const accessToken = await generateAccessToken();
    const url = `${base}/v2/checkout/orders`;
    const { successUrl, cancelUrl } = getQuantumRedirectUrls("paypal", source, env);
    const returnUrl = appendQueryParams(successUrl, { orderId });
    const cancelRedirectUrl = appendQueryParams(cancelUrl, { orderId });

    const payload = {
      intent: "CAPTURE",
      payer: {
        payment_method: "paypal",
      },
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount,
          },
        },
      ],
      // Back-compat (PayPal still accepts application_context)
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelRedirectUrl,
        brand_name: "BitcoinYay",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
      },
    };

    const response = await axios({
      baseURL: url,
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      data: JSON.stringify(payload),
    });

    if (response.status === 201 || response.status === 200) {
      return response.data; // contains links[].rel === "approve"
    }
    throw new Error(response.statusText);
  } catch (error) {
    console.error("PayPal create order (BitcoinYay) failed:", error);
    throw error;
  }
}

const appendQueryParams = (
  baseUrl: string,
  params: Record<string, string | undefined>
) => {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (!value) {
      continue;
    }
    url.searchParams.set(key, value);
  }
  return url.toString();
};

export async function createPaypalOrderForDeposit(
  currency: string,                 // e.g. "USD"
  amount: string,                   // e.g. "20.00"
  email?: string,                   // payer email (optional)
  internalOrderId?: string,         // your own orderId if you want it in the response
  metadata?: Record<string, string> // optional descriptors (custom_id / invoice_id / description)
) {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders`;

  const RETURN_URL = "https://cex.indexx.ai/deposit-add-account-information?paypalStatus=success";
  const CANCEL_URL = "https://cex.indexx.ai/deposit-add-account-information?paypalStatus=cancel";

  const payload: any = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: { currency_code: currency, value: amount },
        // Optional tracking (PayPal constraints apply)
        custom_id: metadata?.custom_id || undefined,
        invoice_id: metadata?.invoice_id || undefined,
        description: metadata?.description || "Fiat deposit",
      },
    ],
    application_context: {
      brand_name: "Indexx Exchange",
      user_action: "PAY_NOW",
      shipping_preference: "NO_SHIPPING",
      return_url: RETURN_URL,
      cancel_url: CANCEL_URL,
    },
    payer: email ? { email_address: email } : undefined,
  };

  const response = await axios({
    baseURL: url,
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    data: JSON.stringify(payload),
  });

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(response.statusText);
  }

  const data = response.data; // PayPal order object
  const nowIso = new Date().toISOString();

  // Map PayPal links while preserving structure your API already uses
  const links = Array.isArray(data?.links)
    ? data.links.map((l: any) => ({
        href: l.href,
        rel: l.rel,
        method: l.method,
        // _id is a Mongo field your backend adds; leave undefined here
      }))
    : [];

  // Conform to your existing format
  return {
    status: 200,
    data: {
      _id: internalOrderId || undefined,       // your DB _id if you want to pass it in
      paypalId: data?.id || "",                // PayPal order id
      orderId: internalOrderId || data?.id || "", // keep both fields like your samples
      status: data?.status || "CREATED",
      links,                                   // includes the "approve" link
      orderAmount: amount,
      orderCurrency: currency,
      payerEmail: email || "",
      payerName: "",
      payerLastName: "",
      payerId: "",
      created: nowIso,
      modified: nowIso,
      __v: 0,
    },
  };
}


export async function createPaypalOrderForShop(
  currency: string,
  amount: string,
  email: string
) {
  try {
    console.log("createOrder", currency, amount, email);
    const accessToken = await generateAccessToken();
    const url = `${base}/v2/checkout/orders`;
    const response = await axios({
      baseURL: url,
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      data: JSON.stringify({
        intent: "CAPTURE",
        payer: {
          payment_method: "paypal",
        },
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount,
            },
          },
        ],
        //https://cex.indexx.ai/indexx-exchange/buy-sell/buy-in-progress/?token=15N79277MS7123615&PayerID=B7GG9DH5Y8KBN
        application_context: {
          return_url:
            "https://indexxshop.indexx.ai/",
          cancel_url: "https://indexxshop.indexx.ai/?success=false",
        },
      }),
    });
    if (response.status === 201 || response.status === 200) {
      return response.data;
    } else {
      throw new Error(response.statusText);
    }
    //return handleResponse(response);
  } catch (error) {
    console.log(error);
  }
}

export async function createDEXPaypalOrder(
  currency: string,
  amount: string,
  email?: string
) {
  try {
    console.log("createOrder", currency, amount);
    const accessToken = await generateAccessToken();
    const url = `${base}/v2/checkout/orders`;
    const response = await axios({
      baseURL: url,
      method: "post",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      data: JSON.stringify({
        intent: "CAPTURE",
        payer: {
          payment_method: "paypal",
        },
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount,
            },
          },
        ],
        application_context: {
          return_url: "https://dex.indexx.ai/buy/payment-success",
          cancel_url: "https://dex.indexx.ai/buy/payment-failed",
        },
      }),
    });
    if (response.status === 201 || response.status === 200) {
      return response.data;
    } else {
      throw new Error(response.statusText);
    }
    //return handleResponse(response);
  } catch (error) {
    console.log(error);
  }
}
// Use the orders api to capture payment for an order
export async function capturePayment(orderId: any) {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderId}/capture`;
  const response = await axios.post(
    url,
    {},
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  console.log(response);
  if (response.status === 201 || response.status === 200) {
    return response.data;
  } else {
    throw new Error(response.statusText);
  }

  //return handleResponse(response);
}

export async function getPaymenByLink(link: string) {
  const accessToken = await generateAccessToken();
  const response = await axios({
    baseURL: link,
    method: "get",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  console.log(response);
  return response;
  //return handleResponse(response);
}

export async function generateAccessToken() {
  const auth = Buffer.from(CLIENT_ID + ":" + APP_SECRET).toString("base64");
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "post",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  const jsonData = await handleResponse(response);
  return jsonData.access_token;
}

async function handleResponse(response: any) {
  if (response.status === 200 || response.status === 201) {
    console.log(response);
    return response.json();
  }

  const errorMessage = await response.text();
  console.log("errorMessage", errorMessage);
  throw new Error(errorMessage);
}

export async function createProduct() {
  try {
    const accessToken = await generateAccessToken();
    const url = `${base}/v1/catalogs/products`;
    const response = await axios.post(
      url,
      {
        name: "Monthly Indexx INEX Token Subscription Plan",
        description:
          "Plan to charge $300 monthly for Indexx Exchange(INEX) token purchase",
        type: "SERVICE",
        category: "OTHER",
        image_url:
          "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png",
        home_url: "https://cex.indexx.ai/",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error creating product:", error);
    throw error;
  }
}

export async function createProductForHoneyBeeSubscription() {
  try {
    const accessToken = await generateAccessToken();
    const url = `${base}/v1/catalogs/products`;
    const response = await axios.post(
      url,
      {
        name: "Monthly Indexx INEX Token Subscription Plan",
        description:
          "Plan to charge $150 monthly for Indexx Exchange(INEX) token purchase",
        type: "SERVICE",
        category: "OTHER",
        image_url:
          "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png",
        home_url: "https://cex.indexx.ai/",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error creating product:", error);
    throw error;
  }
}

export async function createPlan(productId: string) {
  try {
    const accessToken = await generateAccessToken();
    const url = `${base}/v1/billing/plans`;
    const response = await axios.post(
      url,
      {
        product_id: productId,
        name: "Monthly Indexx INEX Token Subscription Plan",
        description:
          "Plan to charge $300 monthly for Indexx Exchaange(INEX) purchase",
        billing_cycles: [
          {
            frequency: {
              interval_unit: "MONTH",
              interval_count: 1,
            },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 12,
            pricing_scheme: {
              fixed_price: {
                value: "300",
                currency_code: "USD",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
            value: "0",
            currency_code: "USD",
          },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
        taxes: {
          percentage: "0",
          inclusive: false,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error creating plan:", error);
    throw error;
  }
}

export async function createPlanForHoneyBeeSubscription(productId: string) {
  try {
    const accessToken = await generateAccessToken();
    const url = `${base}/v1/billing/plans`;
    const response = await axios.post(
      url,
      {
        product_id: productId,
        name: "Monthly Indexx INEX Token Subscription Plan",
        description:
          "Plan to charge $150 monthly for Indexx Exchange(INEX) token purchase",
        billing_cycles: [
          {
            frequency: {
              interval_unit: "MONTH",
              interval_count: 1,
            },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 12,
            pricing_scheme: {
              fixed_price: {
                value: "150",
                currency_code: "USD",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
            value: "0",
            currency_code: "USD",
          },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
        taxes: {
          percentage: "0",
          inclusive: false,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error creating plan:", error);
    throw error;
  }
}

export async function createSubscription(
  planId: string,
  email: string = "",
  phone: string = ""
) {
  try {
    const accessToken = await generateAccessToken();
    const url = `${base}/v1/billing/subscriptions`;
    const response = await axios.post(
      url,
      {
        plan_id: planId,
        //start_time: "Current time",
        application_context: {
          brand_name: "Indexx.ai",
          locale: "en-US",
          shipping_preference: "SET_PROVIDED_ADDRESS",
          user_action: "SUBSCRIBE_NOW",
          payment_method: {
            payer_selected: "PAYPAL",
            payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
          },
          return_url:
            "https://cex.indexx.ai/indexx-exchange/buy-sell/buy-in-progress/",
          cancel_url: "https://cex.indexx.ai/indexx-exchange/buy-sell?success=false",
        },
        subscriber: {
          email_address: email,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }
}

export async function getProductDetails(productId: string) {
  const accessToken = await generateAccessToken();
  const url = `${base}/v1/catalogs/products/${productId}`;
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}

export async function getPlanDetails(planId: string) {
  const accessToken = await generateAccessToken();
  const url = `${base}/v1/billing/plans/${planId}`;
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}

export async function listSubscriptionTransactions(
  subscriptionId: string,
  startTime: string,
  endTime: string
) {
  const accessToken = await generateAccessToken(); // Replace with your method to get access token
  const url = `${base}/v1/billing/subscriptions/${subscriptionId}/transactions`;
  const params = {
    start_time: startTime,
    end_time: endTime,
  };

  try {
    const response = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      params,
    });

    return response.data;
  } catch (error) {
    console.error("Error fetching subscription transactions:", error);
    throw error;
  }
}

export async function getSubscriptionDetails(subscriptionId: string) {
  const accessToken = await generateAccessToken(); // Replace with your method to get an access token
  const url = `${base}/v1/billing/subscriptions/${subscriptionId}`;

  try {
    const response = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error("Error fetching subscription details:", error);
    console.log(error.response?.data);
    return null;
  }
}

export async function cancelSubscription(
  subscriptionId: string,
  reason: string = "Not specified"
) {
  try {
    const accessToken = await generateAccessToken();
    const url = `${base}/v1/billing/subscriptions/${subscriptionId}/cancel`;
    const response = await axios.post(
      url,
      {
        reason: reason, // Reason for the cancellation
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    return response.data; // Check the response for success or failure
  } catch (error: any) {
    console.error("Error canceling subscription:", error);
    console.error(
      "Error canceling subscription data:",
      JSON.stringify(error?.response.data)
    );
    throw error;
  }
}
