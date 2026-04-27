const path = require('path');
const fs = require('fs');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

const auctionMatches = [
  'https://*.iaai.com/*',
  'https://ca.iaai.com/*',
  'https://*.copart.com/*',
  'https://copart.com/*',
  'https://www.copart.com/*',
  'https://*.copart.ca/*',
  'https://copart.ca/*',
  'https://*.progi.com/*',
  'https://progi.com/*',
  'https://*.progi.ca/*',
  'https://progi.ca/*',
  'https://*.manheim-adesa.com/*',
  'https://manheim-adesa.com/*',
];

const manifest = {
  manifest_version: 3,
  name: 'MrFrik — Aukcje samochodowe',
  short_name: 'MrFrik',
  version: pkg.version.split('-')[0],
  description:
    'Twórz oferty Bitrix24 ze stron IAAI, Copart, Manheim/ADESA i Progi (USA/Kanada) — jednym kliknięciem.',
  icons: {
    '16': 'icons/icon16.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
  action: {
    default_popup: 'popup.html',
    default_title: 'MrFrik — Aukcje',
    default_icon: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
  permissions: ['storage', 'tabs'],
  host_permissions: [
    ...auctionMatches,
    'https://mrfrik.com/mrfrik/*',
    'https://*.bitrix24.pl/*',
    'https://*.bitrix24.com/*',
  ],
  content_scripts: [
    {
      matches: [
        'https://mrfrik.com/mrfrik/*',
        'https://*.bitrix24.pl/*',
        'https://*.bitrix24.com/*',
      ],
      js: ['contentDetect.bundle.js'],
      run_at: 'document_start',
      all_frames: true,
    },
    {
      matches: auctionMatches,
      js: ['contentAuction.bundle.js'],
      run_at: 'document_idle',
      all_frames: true,
    },
  ],
  background: {
    service_worker: 'background.bundle.js',
  },
  web_accessible_resources: [
    {
      resources: ['pdf.worker.min.js'],
      matches: auctionMatches,
    },
  ],
};

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: 'cheap-module-source-map',
  entry: {
    popup: './popup.js',
    background: './background.js',
    contentDetect: './content-detect.js',
    contentAuction: ['./auction-sources.js', './pdf-progi-helper-entry.js', './content-auction.js'],
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
    clean: true,
  },
  plugins: [
    new webpack.DefinePlugin({
      __FRIK_EXTENSION_VERSION__: JSON.stringify(pkg.version),
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'icons', to: 'icons' },
        { from: 'auction-config.json', to: '.' },
        {
          from: path.join(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.js'),
          to: 'pdf.worker.min.js',
          noErrorOnMissing: false,
        },
        {
          from: 'popup.html',
          to: 'popup.html',
          transform(content) {
            return content.toString().replace('popup.js', 'popup.bundle.js');
          },
        },
      ],
    }),
    {
      apply(compiler) {
        compiler.hooks.afterEmit.tap('emit-manifest', function () {
          fs.writeFileSync(path.join(__dirname, 'dist/manifest.json'), JSON.stringify(manifest, null, 2));
        });
      },
    },
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules\/(?!pdfjs-dist)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [['@babel/preset-env', { targets: { chrome: '100' } }]],
          },
        },
      },
    ],
  },
};
