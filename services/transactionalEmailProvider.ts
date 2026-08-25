import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
  SendRawEmailCommand,
} from "@aws-sdk/client-ses";
import { keys } from "../config/keys";

type EmailAddress = { email: string; name?: string };
type EmailAttachment = { name: string; content: string | Buffer };
type TransactionalEmail = {
  subject: string;
  sender: EmailAddress;
  replyTo?: EmailAddress;
  to?: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  htmlContent?: string;
  textContent?: string;
  attachment?: EmailAttachment[];
};
type Provider = "ses" | "brevo";

function configuredProvider(value: string, name: string, defaultValue: Provider): Provider {
  const provider = String(value || defaultValue).trim().toLowerCase();
  if (provider !== "ses" && provider !== "brevo") {
    throw new Error(`${name} must be either "ses" or "brevo"`);
  }
  return provider;
}

function addresses(items?: EmailAddress[]): string[] {
  return (items || []).filter((item) => Boolean(item?.email)).map((item) => item.email);
}

function mailbox(item: EmailAddress): string {
  const name = String(item.name || "").replace(/[\r\n"]/g, "").trim();
  return name ? `"${name}" <${item.email}>` : item.email;
}

function safeHeader(value: string): string {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function wrapBase64(value: Buffer | string): string {
  const encoded = Buffer.isBuffer(value)
    ? value.toString("base64")
    : Buffer.from(value, "utf8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") || "";
}

function attachmentBase64(value: Buffer | string): string {
  if (Buffer.isBuffer(value)) return wrapBase64(value);
  const encoded = String(value || "")
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/\s+/g, "");
  return encoded.match(/.{1,76}/g)?.join("\r\n") || "";
}

function contentType(fileName: string): string {
  const types: Record<string, string> = {
    pdf: "application/pdf",
    zip: "application/zip",
    csv: "text/csv",
    txt: "text/plain",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  return types[fileName.toLowerCase().split(".").pop() || ""] || "application/octet-stream";
}

function rawMessage(input: TransactionalEmail): Buffer {
  const mixed = `mixed_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const alternative = `alt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const recipients = [...addresses(input.to), ...addresses(input.cc), ...addresses(input.bcc)];
  if (!recipients.length) throw new Error("Transactional email has no recipients");

  const lines = [
    `From: ${mailbox(input.sender)}`,
    `To: ${addresses(input.to).join(", ")}`,
    ...(addresses(input.cc).length ? [`Cc: ${addresses(input.cc).join(", ")}`] : []),
    ...(input.replyTo?.email ? [`Reply-To: ${mailbox(input.replyTo)}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(safeHeader(input.subject), "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    "",
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alternative}"`,
    "",
  ];

  if (input.textContent) {
    lines.push(
      `--${alternative}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(input.textContent),
      ""
    );
  }
  lines.push(
    `--${alternative}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(input.htmlContent || ""),
    "",
    `--${alternative}--`
  );

  for (const attachment of input.attachment || []) {
    const name = safeHeader(attachment.name).replace(/"/g, "") || "attachment";
    lines.push(
      `--${mixed}`,
      `Content-Type: ${contentType(name)}; name="${name}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${name}"`,
      "",
      attachmentBase64(attachment.content),
      ""
    );
  }
  lines.push(`--${mixed}--`, "");
  return Buffer.from(lines.join("\r\n"), "utf8");
}

function sesClient(): SESClient {
  const { awsAccessKeyId, awsSecretAccessKey, awsSessionToken, awsSesRegion } = keys.marketingEmail;
  return new SESClient({
    region: awsSesRegion,
    credentials: awsAccessKeyId && awsSecretAccessKey
      ? { accessKeyId: awsAccessKeyId, secretAccessKey: awsSecretAccessKey, sessionToken: awsSessionToken || undefined }
      : undefined,
  });
}

function batches(input: TransactionalEmail): TransactionalEmail[] {
  const recipients = [
    ...(input.to || []).map((value) => ({ type: "to" as const, value })),
    ...(input.cc || []).map((value) => ({ type: "cc" as const, value })),
    ...(input.bcc || []).map((value) => ({ type: "bcc" as const, value })),
  ];
  if (!recipients.length) throw new Error("Transactional email has no recipients");

  const result: TransactionalEmail[] = [];
  for (let offset = 0; offset < recipients.length; offset += 50) {
    const batch = recipients.slice(offset, offset + 50);
    result.push({
      ...input,
      to: batch.filter((item) => item.type === "to").map((item) => item.value),
      cc: batch.filter((item) => item.type === "cc").map((item) => item.value),
      bcc: batch.filter((item) => item.type === "bcc").map((item) => item.value),
    });
  }
  return result;
}

async function sendSingleWithSes(client: SESClient, input: TransactionalEmail): Promise<string | undefined> {
  const configurationSet = keys.marketingEmail.awsSesConfigurationSet.trim() || undefined;
  if (input.attachment?.length) {
    const result = await client.send(new SendRawEmailCommand({
      Source: mailbox(input.sender),
      Destinations: [...addresses(input.to), ...addresses(input.cc), ...addresses(input.bcc)],
      RawMessage: { Data: rawMessage(input) },
      ConfigurationSetName: configurationSet,
    }));
    return result.MessageId;
  }

  const command: SendEmailCommandInput = {
    Source: mailbox(input.sender),
    Destination: {
      ToAddresses: addresses(input.to),
      CcAddresses: addresses(input.cc),
      BccAddresses: addresses(input.bcc),
    },
    ReplyToAddresses: input.replyTo?.email ? [input.replyTo.email] : undefined,
    Message: {
      Subject: { Data: input.subject, Charset: "UTF-8" },
      Body: {
        Html: input.htmlContent ? { Data: input.htmlContent, Charset: "UTF-8" } : undefined,
        Text: input.textContent ? { Data: input.textContent, Charset: "UTF-8" } : undefined,
      },
    },
    ConfigurationSetName: configurationSet,
  };
  const result = await client.send(new SendEmailCommand(command));
  return result.MessageId;
}

async function sendWithSes(input: TransactionalEmail): Promise<any> {
  if (!input.sender?.email) throw new Error("Transactional email sender is required");
  const client = sesClient();
  const messageIds: string[] = [];
  for (const batch of batches(input)) {
    const messageId = await sendSingleWithSes(client, batch);
    if (messageId) messageIds.push(messageId);
  }
  console.log(`[EmailProvider] Sent via SES: ${messageIds.join(", ") || "no message id"}`);
  return { provider: "ses", messageId: messageIds[0], messageIds, body: { messageId: messageIds[0], messageIds } };
}

/** Routes existing Brevo-shaped transactional sends while retaining Brevo reporting APIs. */
export function routedTransactionalEmailsApi(BrevoApi: any): any {
  return class RoutedTransactionalEmailsApi {
    private readonly brevo = new BrevoApi();

    async sendTransacEmail(input: TransactionalEmail): Promise<any> {
      const primary = configuredProvider(keys.marketingEmail.transactionalProvider, "EMAIL_PROVIDER", "ses");
      const fallbackValue = keys.marketingEmail.transactionalFallbackProvider.trim().toLowerCase();
      const fallback = fallbackValue
        ? configuredProvider(fallbackValue, "EMAIL_FALLBACK_PROVIDER", primary)
        : undefined;
      try {
        return primary === "ses" ? await sendWithSes(input) : await this.brevo.sendTransacEmail(input);
      } catch (error) {
        if (!fallback || fallback === primary) throw error;
        console.error(`[EmailProvider] ${primary} send failed; trying ${fallback}.`, error);
        return fallback === "ses" ? sendWithSes(input) : this.brevo.sendTransacEmail(input);
      }
    }

    getTransacEmailsList(...args: any[]): Promise<any> {
      return this.brevo.getTransacEmailsList(...args);
    }

    getEmailEventReport(...args: any[]): Promise<any> {
      return this.brevo.getEmailEventReport(...args);
    }
  };
}
