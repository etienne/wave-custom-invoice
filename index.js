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
        date: invoiceItem.invoice_date,
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
      
      const html = Mustache.render(template, invoice);

      // Generate HTML
      if (config.generateHTML) {
        const htmlFilename = `${config.htmlDirectory}/${invoiceNumber}.html`;
        fs.writeFile(htmlFilename, html, (err) => {
          if (err) throw err;
          console.log(`Saved ${htmlFilename}`);
        });
      }
      
      // Generate PDF
      if (config.generatePDF) {
        const pdfFilename = `${config.pdfDirectory}/${invoiceNumber}.pdf`;
        pdf.create(html, config.pdfConfig).toFile(pdfFilename, (err, res) => {
          if (err) return console.log(err);
          console.log(`Saved ${pdfFilename}`);
        });
      }
    }
  }
}, reason => {
  console.log(reason);
});

