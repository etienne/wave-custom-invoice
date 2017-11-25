# wave-custom-invoice

Takes Wave CSV data and outputs custom HTML and PDF.

## Usage

First, install in your project:

```
npm install --save wave-custom-invoice
```

Next, you need to download your CSV data from Wave (Settings → Data Export → Export as CSV), and put the files in the directory of your choice (`data` in the example below). The only required files from Wave are `invoice_items.csv` and `customers.csv`.

You will also need a Mustache template. An example is provided in [`template.mustache`](template.mustache).

In your project, require `wave-custom-invoice` and feed it a config object.

```js
const wave = require('wave-custom-invoice');

const waveConfig = {
  dataDirectory: 'data',
  template: 'template.mustache',
  
  htmlDirectory: "./output/html",
  pdfDirectory: "./output/pdf",

  generateHTML: true,
  generatePDF: true,

  pdfConfig: {
    format: "Letter" 
  },
  
  business: {
    name: "Roger Sampleson",
    address: "123, Sample St.",
    city: "Sampleville",
    province: "PV",
    postalCode: "A1B 2C3",
    phone: "555-555-1212",
    email: "roger@example.com"
  },

  taxes: {
    TPS: {
      rate: 5,
      number: "123456789 RT0001"
    },
    TVQ: {
      rate: 9.975,
      number: "1234567890 TQ0001"
    },
  },
  
  locale: 'fr-ca',
  currencyFormat: '0,0.00 $', // Uses Numeral.js
  dateFormat: 'YYYY.MM.DD', // Uses Moment.js
};

wave(waveConfig);
```
