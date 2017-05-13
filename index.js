const fs = require('fs');
const parse = require('csv-parse');

const promises = [];
const taxes = {
  TPS: 0.05,
  TVQ: 0.09975,
};

// Load and parse CSV files
['invoice_items', 'customers'].forEach(file => {
  promises.push(new Promise((resolve, reject) => {
    fs.readFile(`data/${file}.csv`, 'utf8', (err, data) => {
      if (err) reject(`${file}.csv could not be read. ${err}`);

      parse(data, { columns: true }, (err, output) => {
        if (err) reject(`${file}.csv could not be parsed. ${err}`);
        resolve(output);
      });
    });
  }));
});

// Extract data from CSV and create invoice objects
Promise.all(promises).then(values => {
  const customers = {};
  const invoices = {};

  const invoiceItems = values[0];
  values[1].forEach(customer => {
    customers[customer.customer_name] = customer;
  });
  
  invoiceItems.forEach(invoiceItem => {
    const invoiceNumber = invoiceItem.invoice_num;
    const line = {
      description: invoiceItem.description,
      product: invoiceItem.product,
      amount: invoiceItem.amount,
      quantity: invoiceItem.quantity,
    };
    
    if (invoiceNumber in invoices) {
      // Invoice already exists; add line item
      invoices[invoiceNumber].lines.push(line)
    } else {
      // Invoice doesn’t exist yet; create it
      invoices[invoiceNumber] = {
        number: invoiceNumber,
        customer: customers[invoiceItem.customer],
        lines: [line],
        currency: invoiceItem.currency,
        date: invoiceItem.invoice_date,
        due: invoiceItem.due_date,
        taxes: invoiceItem.taxes.split(', '),
      }
    }
  });
  
  console.log(invoices);
}, reason => {
  console.log(reason);
});

