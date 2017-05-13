const fs = require('fs');
const pdf = require('html-pdf');
const parse = require('csv-parse');
const Mustache = require('mustache');
const config = require('./config.json');

const promises = [];

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

// Load Mustache template
promises.push(new Promise((resolve, reject) => {
  const template = 'index.mustache';
  fs.readFile(`template/${template}`, 'utf8', (err, data) => {
    if (err) reject(`${template} could not be read. ${err}`);
    resolve(data);
  });
}));

// Extract data from CSV and create invoice objects
Promise.all(promises).then(values => {
  const invoiceItems = values[0];
  const customersData = values[1];
  const template = values[2];

  const customers = {};
  const invoices = {};

  customersData.forEach(customer => {
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
      invoices[invoiceNumber].lines.push(line)
    } else {
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
  
  for (const invoiceNumber in invoices) {
    if (invoices.hasOwnProperty(invoiceNumber)) {
      // Generate HTML
      if (config.generateHTML) {
        const html = Mustache.render(template, invoices[invoiceNumber]);
        const htmlFilename = `${config.htmlDirectory}/${invoiceNumber}.html`;
        fs.writeFile(htmlFilename, html, (err) => {
          if (err) throw err;
          console.log(`Saved ${htmlFilename}`);
        });
      }
      
      // Generate PDF
      if (config.generatePDF) {
        const pdfFilename = `${config.pdfDirectory}/${invoiceNumber}.pdf`;
        pdf.create(html).toFile(pdfFilename, (err, res) => {
          if (err) return console.log(err);
          console.log(`Saved ${pdfFilename}`);
        });
      }
    }
  }
}, reason => {
  console.log(reason);
});

