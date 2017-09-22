const fs = require('fs');
const path = require('path');
const pdf = require('html-pdf');
const parse = require('csv-parse');
const mustache = require('mustache');
const moment = require('moment');
const numeral = require('numeral');
require('numeral/locales');

const promises = [];

function ensureDirectoryExists(filePath) {
  var dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExists(dirname);
  fs.mkdirSync(dirname);
}

function successMessage(message) {
  console.log(`\x1b[32m${message}\x1b[0m`);
}

function errorString(message) {
  return `\x1b[31mError: ${message}\x1b[0m`;
}

module.exports = function(config) {
  numeral.locale(config.locale);

  function formatCurrency(number) {
    return numeral(number).format(config.currencyFormat);
  }

  // Load and parse CSV files
  ['invoice_items', 'customers'].forEach(file => {
    promises.push(new Promise((resolve, reject) => {
      fs.readFile(`${config.dataDirectory}/${file}.csv`, 'utf8', (err, data) => {
        if (err) reject(errorString(`${file}.csv could not be read. ${err}`));

        parse(data, { columns: true }, (err, output) => {
          if (err) reject(errorString(`${file}.csv could not be parsed. ${err}`));
          resolve(output);
        });
      });
    }));
  });
  
  // Load Mustache template
  promises.push(new Promise((resolve, reject) => {
    fs.readFile(`${config.template}`, 'utf8', (err, data) => {
      if (err) reject(errorString(`${config.template} could not be read. ${err}`));
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
        total: invoiceItem.amount * invoiceItem.quantity,
      };
    
      if (invoiceNumber in invoices) {
        invoices[invoiceNumber].lines.push(line)
      } else {
        const customer = customers[invoiceItem.customer];
        invoices[invoiceNumber] = {
          business: config.business,
          number: invoiceNumber,
          customer: {
            name: customer.customer_name,
            email: customer.email,
            firstName: customer.contact_first_name,
            lastName: customer.contact_last_name,
            phone: customer.phone,
            fax: customer.fax,
            mobile: customer.mobile,
            tollFree: customer.toll_free,
            website: customer.website,
            country: customer.country,
            province: customer['province/state'],
            address1: customer.address_line_1,
            address2: customer.address_line_2,
            city: customer.city,
            postalCode: customer['postal_code/zip_code'],
          },
          lines: [line],
          currency: invoiceItem.currency,
          date: moment(invoiceItem.invoice_date).format(config.dateFormat),
          due: invoiceItem.due_date,
          taxes: invoiceItem.taxes.split(', ').map(tax => { 
            return { 
              name: tax,
              rate: config.taxes[tax].rate,
              number: config.taxes[tax].number,
            } 
          }),
        }
      }
    });
  
    for (const invoiceNumber in invoices) {
      if (invoices.hasOwnProperty(invoiceNumber)) {
        const invoice = invoices[invoiceNumber];
        
        invoice.subtotal = invoice.lines.map(line => {
          return line.total
        }).reduce((acc, val) => {
          return acc + val;
        });
        
        invoice.taxes.map(tax => {
          tax.amount = Math.round(tax.rate * invoice.subtotal) / 100;
          return tax;
        });
        
        invoice.total = invoice.subtotal + invoice.taxes.map(tax => {
          return tax.amount;
        }).reduce((acc, val) => {
          return acc + val;
        });
        invoice.total = Math.round(invoice.total * 100) / 100;
        
        // Format currency
        invoice.lines.map(line => {
          line.total = formatCurrency(line.total);
          return line;
        });
        
        invoice.taxes.map(tax => {
          tax.amount = formatCurrency(tax.amount);
          return tax;
        });
        
        invoice.subtotal = formatCurrency(invoice.subtotal);
        invoice.total = formatCurrency(invoice.total);
        
        const html = mustache.render(template, invoice);
        
        // Generate HTML
        if (config.generateHTML) {
          const htmlFilename = `${config.htmlDirectory}/${invoiceNumber}.html`;
          ensureDirectoryExists(htmlFilename);
          fs.writeFile(htmlFilename, html, (err) => {
            if (err) throw err;
            successMessage(`Output ${htmlFilename}`);
          });
        }
        
        // Generate PDF
        if (config.generatePDF) {
          const pdfFilename = `${config.pdfDirectory}/${invoiceNumber}.pdf`;
          pdf.create(html, config.pdfConfig).toFile(pdfFilename, (err, res) => {
            if (err) return console.log(err);
            successMessage(`Output ${pdfFilename}`);
          });
        }
      }
    }
  }, reason => {
    console.log(reason);
  });
};

