# wave-custom-invoice

Takes Wave CSV data and outputs a custom-designed PDF.

## Usage

1. Download your CSV data from Wave, and put the files in the `data` folder. The only required files are `invoice_items.csv` and `customers.csv`.

2. Make a copy of `config.json.example`, rename it `config.json`, and edit it to suit your needs.

3. Optionally, customize `template/index.mustache`.

4. Run `node index.js`.
