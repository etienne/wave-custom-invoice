const axios = require('axios');
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;
const mustache = require('mustache');
const moment = require('moment');
const numeral = require('numeral');
require('numeral/locales');

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

module.exports = function(config) {
  if (!config.token) {
    console.error('Wave API token is missing');
    return;
  }

  function formatCurrency(number) {
    return numeral(number).format(config.currencyFormat);
  }

  function formatPhone(number) {
    // TODO: Customize phone number formatting
    return number.replace(/\D+/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
  }

  numeral.locale(config.locale);

  // Load Mustache template
  const template = fs.readFileSync(`${config.template}`, 'utf8');

  axios({
    url: 'https://gql.waveapps.com/graphql/public',
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + config.token,
      'Content-Type': 'application/json',
    },
    data: {
      query: `
        query {
          businesses {
            edges {
              node {
                invoices(page: 1, pageSize: 5) {
                  edges {
                    node {
                      invoiceNumber,
                      poNumber,
                      invoiceDate,
                      dueDate,
                      status,
                      amountDue { ...money },
                      amountPaid { ...money },
                      taxTotal { ...money },
                      total { ...money },
                      currency { code },
                      exchangeRate,
                      items {
                        description,
                        quantity,
                        unitPrice,
                        subtotal { ...money },
                        total { ...money },
                        taxes {
                          amount { ...money },
                          rate,
                          salesTax {
                            name,
                            abbreviation,
                            description,
                            taxNumber,
                            rate,
                            isCompound,
                            isRecoverable,
                            isArchived,
                          },
                        },
                        product {
                          name,
                          description,
                          unitPrice,
                          isSold,
                          isBought,
                          isArchived,
                        },
                      },
                      memo,
                      footer,
                      customer {
                        name,
                        address { ...address },
                        firstName,
                        lastName,
                        email,
                        mobile,
                        phone,
                        website,
                      },
                      business {
                        name,
                        address { ...address },
                        phone,
                        website
                      }
                    }
                  }
                }
              }
            }
          }
        }

        fragment money on Money {
          raw,
          value,
          currency {
            code,
          }
        }
        
        fragment address on Address {
          addressLine1,
          addressLine2,
          city,
          province { name },
          country { name },
          postalCode,
        }
      `,
      variables: {}
    },
  })
  .then(r => {
    let invoices = [];
    r.data.data.businesses.edges.forEach(b => invoices = [...invoices, ...b.node.invoices.edges]);

    invoices.forEach(({ node: invoice }) => {
      let taxes = {};
      let rawSubtotal = 0;

      invoice.items.forEach(i => {
        rawSubtotal = rawSubtotal + i.subtotal.raw;
        i.subtotal.formatted = formatCurrency(i.subtotal.raw / 100);

        i.taxes.forEach(t => {
          if (taxes[t.salesTax.name]) {
            const existingRawAmount = taxes[t.salesTax.name].amount.raw;
            taxes[t.salesTax.name].amount.raw = existingRawAmount + t.amount.raw;
            taxes[t.salesTax.name].amount.value = taxes[t.salesTax.name].amount.raw / 100;
            taxes[t.salesTax.name].amount.formatted = formatCurrency(taxes[t.salesTax.name].amount.value);
          } else {
            taxes[t.salesTax.name] = t;
            taxes[t.salesTax.name].salesTax.percent = numeral(t.salesTax.rate * 100).format('0.[000]');
            taxes[t.salesTax.name].amount.formatted = formatCurrency(taxes[t.salesTax.name].amount.raw / 100);
          }
        })
      });

      invoice.taxes = Object.values(taxes).sort((a, b) => a.salesTax.name > b.salesTax.name ? 1 : -1);

      invoice.subtotal = {
        raw: rawSubtotal,
        formatted: formatCurrency(rawSubtotal / 100),
      }

      invoice.business.phone = formatPhone(invoice.business.phone);

      if (invoice.business.address.province.name == 'Quebec') {
        invoice.business.address.province.name = 'Québec';
      }

      if (invoice.customer && invoice.customer.address && invoice.customer.address.province && invoice.customer.address.province.name == 'Quebec') {
        invoice.customer.address.province.name = 'Québec';
      }

      invoice.invoiceDate = moment(invoice.invoiceDate).format(config.dateFormat);
      invoice.total.formatted = formatCurrency(invoice.total.raw / 100);

      const html = mustache.render(template, invoice);
        
      // Generate HTML
      if (config.generateHTML) {
        const htmlFilename = `${config.htmlDirectory}/${invoice.invoiceNumber}.html`;
        ensureDirectoryExists(htmlFilename);
        try {
          fs.writeFileSync(htmlFilename, html);
          successMessage(`Output ${htmlFilename}`);
        } catch (error) {
          console.error(error);
        }
      }
      
      // Generate PDF
      if (config.generatePDF) {
        const pdfFilename = `${config.pdfDirectory}/${invoice.invoiceNumber}.pdf`;
        exec(`weasyprint http://${config.serverHost}:${config.serverPort}/${invoice.invoiceNumber}.html ${pdfFilename}`,
          (error, stdout, stderr) => {
            if (stderr) {
              console.error('stderr: ' + stderr);
            }
            if (error !== null) {
              console.error('exec error: ' + error);
            }
          });
        
        successMessage(`Output ${pdfFilename}`);
      }
    });
  });
};
