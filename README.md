# wave-custom-invoice

Takes Wave CSV data and outputs a custom-designed PDF. Some data (like tax rates) is hard-coded due to the limitations of the Wave CSV, so this only works out of the box for my specific use case. But it's pretty easy to adapt.

Oh, also, it doesn’t really work right now.

## Usage

Download your CSV data from Wave, and put all the files in the `data` folder. Then run:

```
node index.js
```
