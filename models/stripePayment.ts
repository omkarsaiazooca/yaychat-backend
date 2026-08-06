import { Schema } from "mongoose";
import { IDocumentModel } from "../data/base";
import { StripePayment, AmountDetails } from "../data/stripePayment";

export interface StripePaymentModel extends IDocumentModel<StripePayment>, StripePayment {
}

const stripePaymentSchemaOptions = {
    timestamps: { createdAt: 'created', updatedAt: 'modified' }
};

var stripePaymentSchema: Schema = new Schema({}, stripePaymentSchemaOptions);

var tipSchema: Schema = new Schema({})


var amountDetailSchema = new Schema({
    tip: { type: tipSchema }
});

var automaticPaymentMethodsSchema = new Schema({
    enabled: Boolean
});

var MetadataSchema = new Schema({
});

var ChargesSchema = new Schema({
    object: String,
    data: Array,
    has_more: Boolean,
    total_count: Number,
    url: String
});

var LinkSchema= new Schema({
    persistent_token: Object,
})

var WechatPaySchema = new Schema({
    app_id: Object,
    client: Object
})

var AlipaySchema= new Schema({
})

var CardSchema = new Schema({
    installments: Object,
    mandate_options: Object,
    network: Object,
    request_three_d_secure: String,
})

var PaymentMethodOptionsSchema = new Schema({
    alipay: AlipaySchema,
    card: CardSchema,
    link: { type: LinkSchema},
    wechat_pay: {type: WechatPaySchema}
})

stripePaymentSchema.add({
    email: String,
    userWalletAddress: String,
    orderId: String,
    object: String,
    amount: Number,
    amount_capturable: Number,
    amount_details: { type: amountDetailSchema },
    amount_received: Number,
    application: Object,
    application_fee_amount: Object,
    automatic_payment_methods: automaticPaymentMethodsSchema,
    canceled_at: Object,
    cancellation_reason: Object,
    capture_method: String,
    charges: ChargesSchema,
    client_secret: String,
    confirmation_method: String,
    created: Number,
    currency: String,
    customer: Object,
    description: Object,
    invoice: Object,
    last_payment_error: Object,
    livemode: Boolean,
    metadata:MetadataSchema,
    next_action: Object,
    on_behalf_of: Object,
    payment_method: Object,
    payment_intent: String,
    payment_method_options: PaymentMethodOptionsSchema,
    payment_method_types: Array,
    processing: Object,
    receipt_email: Object,
    review: Object,
    setup_future_usage: Object,
    shipping: Object,
    source: Object,
    statement_descriptor: Object,
    statement_descriptor_suffix: Object,
    status: String,
    transfer_data: Object,
    transfer_group: Object,
});

export default stripePaymentSchema;