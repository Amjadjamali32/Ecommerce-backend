import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export const generateReceipt = async (order, user) => {
  const doc = new PDFDocument();
  const receiptPath = path.join('receipts', `receipt-${order._id}.pdf`);

  // Ensure receipts directory exists
  if (!fs.existsSync('receipts')) fs.mkdirSync('receipts');

  const writeStream = fs.createWriteStream(receiptPath);
  doc.pipe(writeStream);

  doc.fontSize(18).text('🧾 Order Receipt', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Order ID: ${order._id}`);
  doc.text(`User: ${user.name} (${user.email})`);
  doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`);
  doc.text(`Payment Method: ${order.paymentInfo.method}`);
  doc.text(`Payment Status: ${order.paymentInfo.status}`);
  doc.moveDown();

  doc.fontSize(14).text('Order Items:');
  order.orderItems.forEach((item, index) => {
    doc.text(
      `${index + 1}. ${item.name} - $${item.price} x ${item.quantity} = $${item.price * item.quantity}`
    );
  });

  doc.moveDown();
  doc.fontSize(12).text(`Subtotal: $${order.itemsPrice}`);
  doc.text(`Tax: $${order.taxPrice}`);
  doc.text(`Shipping: $${order.shippingPrice}`);
  doc.text(`Total: $${order.totalPrice}`);
  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => {
      resolve(receiptPath);
    });
    writeStream.on('error', reject);
  });
};