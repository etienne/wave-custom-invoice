# wave-custom-invoice

Takes Wave API data and outputs custom HTML and PDF.

## Usage

Install in your project:

```
npm install --save wave-custom-invoice
```

Install WeasyPrint:

```
brew install weasyprint
```

Next, you need to create an application in Wave, and generate a token.

You will also need a Mustache template. An example is provided in [`template.mustache`](template.mustache).

In your project, require `wave-custom-invoice` and pass it a config object.

```js
const wave = require('wave-custom-invoice');

const waveConfig = {
  token: 'your_wave_application_token',
  template: 'template.mustache',

  htmlDirectory: "output",
  pdfDirectory: './output/pdf',

  generateHTML: true,
  generatePDF: true,

  serverHost: 'localhost',
  serverPort: 8080,

  locale: 'fr-ca',
  currencyFormat: '0,0.00 $', // Uses Numeral.js
  dateFormat: 'YYYY.MM.DD', // Uses Moment.js
};

wave(waveConfig);
```
