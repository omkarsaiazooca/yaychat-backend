import jsPDF from "jspdf";
import "jspdf-autotable";
import { getPriceByName } from "../controllers/priceAPI";
import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";
import { SendEmail } from "../platform/email.operations";
import { UserWallet } from "../data/user";

// Extend jsPDF interface to include autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number }; // Adding lastAutoTable to the interface
    previousAutoTable: {
      finalY: number;
    };
  }
}

// Define the structure of the portfolio summary
interface AssetSummary {
  quantity: number;
  marketPrice: number;
  marketValue: number;
  balanceType: string; // 'Available' or 'Staked'
}

// Calculate portfolio summary based on UserWallet data
async function calculatePortfolioSummary(wallets: UserWallet[]) {
  const assetSummary: Record<string, AssetSummary[]> = {};

  // Aggregate data from user wallets
  for (const wallet of wallets) {
    if (wallet.coinBalance > 0) {
      const currency = wallet.coinSymbol || "USD";
      const quantity = wallet.coinBalance || 0;
      const balanceType = "Available";

      if (!assetSummary[currency]) {
        assetSummary[currency] = [];
      }
      assetSummary[currency].push({
        quantity,
        marketPrice: 0, // This will be populated later
        marketValue: 0, // This will be populated later
        balanceType,
      });
    }

    if (wallet.coinStakedBalance > 0) {
      const currency = wallet.coinSymbol || "USD";
      const quantity = wallet.coinStakedBalance || 0;
      const balanceType = "Staked";

      if (!assetSummary[currency]) {
        assetSummary[currency] = [];
      }
      assetSummary[currency].push({
        quantity,
        marketPrice: 0, // This will be populated later
        marketValue: 0, // This will be populated later
        balanceType,
      });
    }
  }

  // Fetch the latest market prices using getPriceByName
  for (const currency of Object.keys(assetSummary)) {
    const marketPrice = await getPriceByName(currency);

    // Update each balance entry for the currency with the market price and value
    assetSummary[currency].forEach((entry) => {
      entry.marketPrice = marketPrice.data;
      entry.marketValue = marketPrice.data * entry.quantity;
    });
  }

  return assetSummary;
}

export async function generatePDF(
  email: string,
  wallets: UserWallet[],
  orders: any[],
  transactions: any[],
  startDate: Date,
  endDate: Date,
  options?: {
    sendEmail?: boolean;
    outputDir?: string;
    filename?: string;
    includeOrders?: boolean;
    includeTransactions?: boolean;
    totalInvestment?: number;
  }
): Promise<string> {
  const doc = new jsPDF();
  const padding = 10;

  // Format the start and end dates
  const dateOptions: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  };
  const formattedStartDate = new Intl.DateTimeFormat(
    "en-US",
    dateOptions
  ).format(
    startDate
  );
  const formattedEndDate = new Intl.DateTimeFormat(
    "en-US",
    dateOptions
  ).format(
    endDate
  );

  // Load the logo image
  const logoUrl =
    "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png";
  const logoImage = await loadImage(logoUrl);

  // Create a canvas and draw the image on it
  const canvas = createCanvas(logoImage.width, logoImage.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(logoImage, 0, 0);

  // Get the Data URL of the image
  const logoDataUrl = canvas.toDataURL("image/png");

  // Add the logo to the top right corner
  const pageWidth = doc.internal.pageSize.getWidth();
  const imgWidth = 50; // Adjust width as needed
  const imgHeight = (logoImage.height / logoImage.width) * imgWidth; // Maintain aspect ratio
  doc.addImage(
    logoDataUrl,
    "PNG",
    pageWidth - imgWidth - padding,
    padding,
    imgWidth,
    imgHeight
  );

  // Add some space after the logo before starting other content
  let currentY = padding + imgHeight + 10;

  doc.setFontSize(12);
  doc.text(`Transaction History Report for Indexx`, padding, currentY);

  doc.setFontSize(9);
  currentY += 10; // Add some space between lines
  doc.text(
    `You can use this transaction report to inform your likely tax obligations.`,
    padding,
    currentY
  );

  // Add customer email after the introductory text
  currentY += 10; // Add some space before the email
  doc.setFontSize(10);
  doc.text(`Customer: ${email}`, padding, currentY);

  // Calculate dynamic portfolio summary
  currentY += 10; // Add space before the portfolio summary
  const portfolioSummary = await calculatePortfolioSummary(wallets);

  // Portfolio summary section
  doc.setFontSize(12);
  doc.text("Portfolio summary", padding, currentY);

  const portfolioSummaryData = Object.entries(portfolioSummary).flatMap(
    ([currency, entries]) =>
      entries.map((entry) => [
        currency,
        entry.balanceType,
        entry.quantity.toFixed(3), // Ensure 3 decimal places for quantity
        `${entry.marketPrice.toFixed(
          entry.marketPrice < 1 ? 5 : 2
        )} USD/${currency}`,
        `${entry.marketValue.toFixed(2)} USD`,
      ])
  );

  portfolioSummaryData.push([
    "Total Market Value",
    "",
    "",
    "",
    `${portfolioSummaryData
      .reduce((sum, item) => sum + parseFloat(item[4]), 0)
      .toFixed(2)} USD`,
  ]);

  doc.autoTable({
    startY: currentY + 5,
    head: [["Asset", "Type", "Quantity", "Market Price", "Market Value"]],
    body: portfolioSummaryData,
    styles: { fontSize: 8 },
    headStyles: {
      fillColor: [211, 211, 211],
      textColor: 0,
      fontStyle: "bold",
    },
    margin: { left: padding, right: padding },
  });

  const shouldIncludeOrders = options?.includeOrders !== false;
  const shouldIncludeTransactions = options?.includeTransactions !== false;

  // Orders Section with Date Range
  if (shouldIncludeOrders && orders.length > 0) {
    const ordersStartY = doc.lastAutoTable
      ? doc.lastAutoTable.finalY + 10
      : currentY + 20;
    doc.setFontSize(12);
    doc.text("Orders", padding, ordersStartY);

    doc.setFontSize(10);
    doc.text(
      `Date Range Filter: From ${formattedStartDate} To ${formattedEndDate}`,
      padding,
      ordersStartY + 5
    );

    const orderData = orders.map((order: any) => [
      order.orderId,
      order.orderType,
      order.breakdown?.outCurrencyName,
      order.breakdown?.inAmount || 0,
      order.breakdown?.outAmount + ` ${order.breakdown?.outCurrencyName}` || 0,
      order.status,
      new Date(order.created).toLocaleString(),
      order.notes || "",
    ]);

    doc.autoTable({
      startY: ordersStartY + 10,
      head: [
        [
          "Order ID",
          "Type",
          "Asset",
          "Amount in USD",
          "Quantity Transacted",
          "Status",
          "Created Date",
          "Notes",
        ],
      ],
      body: orderData,
      styles: { fontSize: 8 },
      headStyles: {
        fillColor: [211, 211, 211],
        textColor: 0,
        fontStyle: "bold",
      },
      margin: { left: padding, right: padding },
    });
  }

  // Transactions Section with Date Range
  if (shouldIncludeTransactions && transactions.length > 0) {
    const transactionsStartY = doc.lastAutoTable
      ? doc.lastAutoTable.finalY + 10
      : currentY + 35;

    doc.setFontSize(12);
    doc.text("Transactions", padding, transactionsStartY);

    doc.setFontSize(10);
    doc.text(
      `Date Range Filter: From ${formattedStartDate} To ${formattedEndDate}`,
      padding,
      transactionsStartY + 5
    );

    const transactionData = transactions.map((tx: any) => [
      tx.txId ? tx.txId : "NA",
      tx.transactionType,
      tx.amount,
      tx.currencyRef,
      tx.status,
      new Date(tx.txDate).toLocaleString(),
    ]);

    // Check if all transaction IDs are "NA"
    const allTxIdsNA = transactionData.every((tx) => tx[0] === "NA");

    // Remove "Transaction ID" column if all IDs are "NA"
    const tableHeaders = allTxIdsNA
      ? ["Type", "Amount", "Currency", "Status", "Date"]
      : ["Transaction ID", "Type", "Amount", "Currency", "Status", "Date"];

    const transactionDataFiltered = allTxIdsNA
      ? transactionData.map((tx) => tx.slice(1))
      : transactionData;

    doc.autoTable({
      startY: transactionsStartY + 10,
      head: [tableHeaders],
      body: transactionDataFiltered,
      styles: { fontSize: 8 },
      headStyles: {
        fillColor: [211, 211, 211],
        textColor: 0,
        fontStyle: "bold",
      },
      margin: { left: padding, right: padding },
    });
  }

  if (typeof options?.totalInvestment === "number" && !Number.isNaN(options.totalInvestment)) {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    let totalY = doc.lastAutoTable
      ? doc.lastAutoTable.finalY + 10
      : currentY + 20;
    const pageHeight = doc.internal.pageSize.getHeight();
    if (totalY > pageHeight - 20) {
      doc.addPage();
      totalY = padding;
    }
    doc.setFontSize(11);
    doc.text(`Total Investment: ${formatter.format(options.totalInvestment)}`, padding, totalY);
  }

  // Define the reports directory
  const reportsDir = options?.outputDir || path.join(__dirname, "reports");

  // Check if the reports directory exists, if not, create it
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Define the full path to save the PDF
  const defaultFilename = `${email}_Transaction_Report.pdf`;
  const filePath = path.join(
    reportsDir,
    options?.filename || defaultFilename
  );

  // Convert ArrayBuffer to Buffer
  const pdfData = doc.output("arraybuffer");
  const buffer = Buffer.from(pdfData);

  // Save the PDF to the file system
  fs.writeFileSync(filePath, buffer);

  console.log(`Report saved to ${filePath}`);

  if (options?.sendEmail !== false) {
    //if (email === "omkar@azooca.com")
    new SendEmail().sendMonthlyReportEmail(email, startDate, endDate, filePath);
  }

  return filePath;
}


export async function generatePDFForWeekly(
  email: string,
  wallets: UserWallet[],
  orders: any[],
  transactions: any[],
  startDate: Date,
  endDate: Date,
  options?: {
    sendEmail?: boolean;
    outputDir?: string;
    filename?: string;
    includeOrders?: boolean;
    includeTransactions?: boolean;
    totalInvestment?: number;
  }
): Promise<string> {
  const doc = new jsPDF();
  const padding = 10;

  // Format the start and end dates
  const dateOptions: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  };
  const formattedStartDate = new Intl.DateTimeFormat(
    "en-US",
    dateOptions
  ).format(
    startDate
  );
  const formattedEndDate = new Intl.DateTimeFormat(
    "en-US",
    dateOptions
  ).format(
    endDate
  );

  // Load the logo image
  const logoUrl =
    "https://indexx-exchange-2.s3.ap-northeast-1.amazonaws.com/indexx_email_logo.png";
  const logoImage = await loadImage(logoUrl);

  // Create a canvas and draw the image on it
  const canvas = createCanvas(logoImage.width, logoImage.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(logoImage, 0, 0);

  // Get the Data URL of the image
  const logoDataUrl = canvas.toDataURL("image/png");

  // Add the logo to the top right corner
  const pageWidth = doc.internal.pageSize.getWidth();
  const imgWidth = 50; // Adjust width as needed
  const imgHeight = (logoImage.height / logoImage.width) * imgWidth; // Maintain aspect ratio
  doc.addImage(
    logoDataUrl,
    "PNG",
    pageWidth - imgWidth - padding,
    padding,
    imgWidth,
    imgHeight
  );

  // Add some space after the logo before starting other content
  let currentY = padding + imgHeight + 10;

  doc.setFontSize(12);
  doc.text(`Transaction History Report for Indexx`, padding, currentY);

  doc.setFontSize(9);
  currentY += 10; // Add some space between lines
  doc.text(
    `You can use this transaction report to inform your likely tax obligations.`,
    padding,
    currentY
  );

  // Add customer email after the introductory text
  currentY += 10; // Add some space before the email
  doc.setFontSize(10);
  doc.text(`Customer: ${email}`, padding, currentY);

  // Calculate dynamic portfolio summary
  currentY += 10; // Add space before the portfolio summary
  const portfolioSummary = await calculatePortfolioSummary(wallets);

  // Portfolio summary section
  doc.setFontSize(12);
  doc.text("Portfolio summary", padding, currentY);

  const portfolioSummaryData = Object.entries(portfolioSummary).flatMap(
    ([currency, entries]) =>
      entries.map((entry) => [
        currency,
        entry.balanceType,
        entry.quantity.toFixed(3), // Ensure 3 decimal places for quantity
        `${entry.marketPrice.toFixed(
          entry.marketPrice < 1 ? 5 : 2
        )} USD/${currency}`,
        `${entry.marketValue.toFixed(2)} USD`,
      ])
  );

  portfolioSummaryData.push([
    "Total Market Value",
    "",
    "",
    "",
    `${portfolioSummaryData
      .reduce((sum, item) => sum + parseFloat(item[4]), 0)
      .toFixed(2)} USD`,
  ]);

  doc.autoTable({
    startY: currentY + 5,
    head: [["Asset", "Type", "Quantity", "Market Price", "Market Value"]],
    body: portfolioSummaryData,
    styles: { fontSize: 8 },
    headStyles: {
      fillColor: [211, 211, 211],
      textColor: 0,
      fontStyle: "bold",
    },
    margin: { left: padding, right: padding },
  });

  const shouldIncludeOrders = options?.includeOrders !== false;
  const shouldIncludeTransactions = options?.includeTransactions !== false;

  // Orders Section with Date Range
  if (shouldIncludeOrders && orders.length > 0) {
    const ordersStartY = doc.lastAutoTable
      ? doc.lastAutoTable.finalY + 10
      : currentY + 20;
    doc.setFontSize(12);
    doc.text("Orders", padding, ordersStartY);

    doc.setFontSize(10);
    doc.text(
      `Date Range Filter: From ${formattedStartDate} To ${formattedEndDate}`,
      padding,
      ordersStartY + 5
    );

    const orderData = orders.map((order: any) => [
      order.orderId,
      order.orderType,
      order.breakdown?.outCurrencyName,
      order.breakdown?.inAmount || 0,
      order.breakdown?.outAmount + ` ${order.breakdown?.outCurrencyName}` || 0,
      order.status,
      new Date(order.created).toLocaleString(),
      order.notes || "",
    ]);

    doc.autoTable({
      startY: ordersStartY + 10,
      head: [
        [
          "Order ID",
          "Type",
          "Asset",
          "Amount in USD",
          "Quantity Transacted",
          "Status",
          "Created Date",
          "Notes",
        ],
      ],
      body: orderData,
      styles: { fontSize: 8 },
      headStyles: {
        fillColor: [211, 211, 211],
        textColor: 0,
        fontStyle: "bold",
      },
      margin: { left: padding, right: padding },
    });
  }

  // Transactions Section with Date Range
  if (shouldIncludeTransactions && transactions.length > 0) {
    const transactionsStartY = doc.lastAutoTable
      ? doc.lastAutoTable.finalY + 10
      : currentY + 35;

    doc.setFontSize(12);
    doc.text("Transactions", padding, transactionsStartY);

    doc.setFontSize(10);
    doc.text(
      `Date Range Filter: From ${formattedStartDate} To ${formattedEndDate}`,
      padding,
      transactionsStartY + 5
    );

    const transactionData = transactions.map((tx: any) => [
      tx.txId ? tx.txId : "NA",
      tx.transactionType,
      tx.amount,
      tx.currencyRef,
      tx.status,
      new Date(tx.txDate).toLocaleString(),
    ]);

    // Check if all transaction IDs are "NA"
    const allTxIdsNA = transactionData.every((tx) => tx[0] === "NA");

    // Remove "Transaction ID" column if all IDs are "NA"
    const tableHeaders = allTxIdsNA
      ? ["Type", "Amount", "Currency", "Status", "Date"]
      : ["Transaction ID", "Type", "Amount", "Currency", "Status", "Date"];

    const transactionDataFiltered = allTxIdsNA
      ? transactionData.map((tx) => tx.slice(1))
      : transactionData;

    doc.autoTable({
      startY: transactionsStartY + 10,
      head: [tableHeaders],
      body: transactionDataFiltered,
      styles: { fontSize: 8 },
      headStyles: {
        fillColor: [211, 211, 211],
        textColor: 0,
        fontStyle: "bold",
      },
      margin: { left: padding, right: padding },
    });
  }

  if (typeof options?.totalInvestment === "number" && !Number.isNaN(options.totalInvestment)) {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    let totalY = doc.lastAutoTable
      ? doc.lastAutoTable.finalY + 10
      : currentY + 20;
    const pageHeight = doc.internal.pageSize.getHeight();
    if (totalY > pageHeight - 20) {
      doc.addPage();
      totalY = padding;
    }
    doc.setFontSize(11);
    doc.text(`Total Investment: ${formatter.format(options.totalInvestment)}`, padding, totalY);
  }

  // Define the reports directory
  const reportsDir = options?.outputDir || path.join(__dirname, "reports");

  // Check if the reports directory exists, if not, create it
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Define the full path to save the PDF
  const defaultFilename = `${email}_Transaction_Report.pdf`;
  const filePath = path.join(
    reportsDir,
    options?.filename || defaultFilename
  );

  // Convert ArrayBuffer to Buffer
  const pdfData = doc.output("arraybuffer");
  const buffer = Buffer.from(pdfData);

  // Save the PDF to the file system
  fs.writeFileSync(filePath, buffer);

  console.log(`Report saved to ${filePath}`);

  if (options?.sendEmail !== false) {
    //if (email === "omkar@azooca.com")
    new SendEmail().sendWeeklyReportEmail(email, startDate, endDate, filePath);
  }

  return filePath;
}
