require("dotenv").config();
const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

const DEFAULT_DROPBOX_APP_KEY =
  process.env.DROPBOX_APP_KEY || "uwxv4ofkrmc4zzf";
const DEFAULT_ONEDRIVE_CLIENT_ID =
  process.env.ONEDRIVE_CLIENT_ID || "3729fc1c-0af2-4bec-9376-d7ac4f0ff806";
const DEFAULT_ONEDRIVE_AUTHORITY =
  process.env.ONEDRIVE_AUTHORITY || "https://login.microsoftonline.com/common";
const DEFAULT_REMOTELYSAVE_WEBSITE =
  process.env.REMOTELYSAVE_WEBSITE || "https://remotely-save-site.fyears.org";
const DEFAULT_REMOTELYSAVE_CLIENT_ID =
  process.env.REMOTELYSAVE_CLIENT_ID ||
  "cli-RcskZDNbskll95WHJ3rNa8G34YlD3DML3cmwGOpEpbpvm82rIVGWmQMKJ60NjjGJKB6H_fOeHicW9W0H";
const DEFAULT_GOOGLEDRIVE_CLIENT_ID = process.env.GOOGLEDRIVE_CLIENT_ID || "";
const DEFAULT_GOOGLEDRIVE_CLIENT_SECRET =
  process.env.GOOGLEDRIVE_CLIENT_SECRET || "";
const DEFAULT_BOX_CLIENT_ID =
  process.env.BOX_CLIENT_ID || "o0ohclnln6xf7fpd1pnomqpl42v0w3hl";
const DEFAULT_BOX_CLIENT_SECRET =
  process.env.BOX_CLIENT_SECRET || "oDrcpdgifz24NJMN6OmgC2kvYCChbYMX";
const DEFAULT_PCLOUD_CLIENT_ID =
  process.env.PCLOUD_CLIENT_ID || "zrDphYT1giQ";
const DEFAULT_PCLOUD_CLIENT_SECRET =
  process.env.PCLOUD_CLIENT_SECRET || "TqjVEEaXlsHwCOczzm0R9SBmxf2y";
const DEFAULT_YANDEXDISK_CLIENT_ID =
  process.env.YANDEXDISK_CLIENT_ID || "01d8aee92915469dba50b70965d77323";
const DEFAULT_YANDEXDISK_CLIENT_SECRET =
  process.env.YANDEXDISK_CLIENT_SECRET || "71da4965f9124deab95444df46afa651";
const DEFAULT_KOOFR_CLIENT_ID =
  process.env.KOOFR_CLIENT_ID || "LUOCNJ27DECBGKZRG22RHPBAMVK3CUWF";
const DEFAULT_KOOFR_CLIENT_SECRET =
  process.env.KOOFR_CLIENT_SECRET ||
  "WJH6XQF2AXK6UINDM2T3STD7OAYCX6H4ZL3T4KPYSTW4R5AKI4W26Q6C76WZQ5DT";

module.exports = {
  entry: "./src/main.ts",
  target: "web",
  output: {
    filename: "main.js",
    path: __dirname,
    libraryTarget: "commonjs",
  },
  plugins: [
    new webpack.DefinePlugin({
      "global.DEFAULT_DROPBOX_APP_KEY": `"${DEFAULT_DROPBOX_APP_KEY}"`,
      "global.DEFAULT_ONEDRIVE_CLIENT_ID": `"${DEFAULT_ONEDRIVE_CLIENT_ID}"`,
      "global.DEFAULT_ONEDRIVE_AUTHORITY": `"${DEFAULT_ONEDRIVE_AUTHORITY}"`,
      "global.DEFAULT_REMOTELYSAVE_WEBSITE": `"${DEFAULT_REMOTELYSAVE_WEBSITE}"`,
      "global.DEFAULT_REMOTELYSAVE_CLIENT_ID": `"${DEFAULT_REMOTELYSAVE_CLIENT_ID}"`,
      "global.DEFAULT_GOOGLEDRIVE_CLIENT_ID": `"${DEFAULT_GOOGLEDRIVE_CLIENT_ID}"`,
      "global.DEFAULT_GOOGLEDRIVE_CLIENT_SECRET": `"${DEFAULT_GOOGLEDRIVE_CLIENT_SECRET}"`,
      "global.DEFAULT_BOX_CLIENT_ID": `"${DEFAULT_BOX_CLIENT_ID}"`,
      "global.DEFAULT_BOX_CLIENT_SECRET": `"${DEFAULT_BOX_CLIENT_SECRET}"`,
      "global.DEFAULT_PCLOUD_CLIENT_ID": `"${DEFAULT_PCLOUD_CLIENT_ID}"`,
      "global.DEFAULT_PCLOUD_CLIENT_SECRET": `"${DEFAULT_PCLOUD_CLIENT_SECRET}"`,
      "global.DEFAULT_YANDEXDISK_CLIENT_ID": `"${DEFAULT_YANDEXDISK_CLIENT_ID}"`,
      "global.DEFAULT_YANDEXDISK_CLIENT_SECRET": `"${DEFAULT_YANDEXDISK_CLIENT_SECRET}"`,
      "global.DEFAULT_KOOFR_CLIENT_ID": `"${DEFAULT_KOOFR_CLIENT_ID}"`,
      "global.DEFAULT_KOOFR_CLIENT_SECRET": `"${DEFAULT_KOOFR_CLIENT_SECRET}"`,

      "process.env.NODE_DEBUG": `undefined`, // ugly fix
      "process.env.DEBUG": `undefined`, // ugly fix
      // "process.version": `"v20.10.0"`, // who's using this?
      // "process":`undefined`,
      // "global.process":`undefined`,

      // make azure blob storage happy
      // https://github.com/Azure/azure-sdk-for-js/blob/main/sdk/core/core-util/src/checkEnvironment.ts
      "globalThis.process.versions": `undefined`,
    }),
    // Work around for Buffer is undefined:
    // https://github.com/webpack/changelog-v5/issues/10
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
    }),
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
    new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
      resource.request = resource.request.replace(/^node:/, "");
    }),
  ],
  module: {
    rules: [
      {
        test: /\.worker\.ts$/,
        loader: "worker-loader",
        options: {
          inline: "no-fallback",
        },
      },
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          transpileOnly: true,
        },
        exclude: /node_modules/,
      },
      {
        test: /\.svg?$/,
        type: "asset/source",
      },
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false, // process/browser returns some errors before
        },
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    mainFields: ["browser", "module", "main"],
    alias: {
      "node:url": require.resolve("url/"),
      "node:buffer": require.resolve("buffer/"),
      "node:stream": require.resolve("stream-browserify"),
      "node:path": require.resolve("path-browserify"),
      "node:process": require.resolve("process/browser"),
      "node:crypto": require.resolve("crypto-browserify"),
      "node:util": require.resolve("util/"),
    },
    fallback: {
      // assert: require.resolve("assert"),
      // buffer: require.resolve("buffer/"),
      // console: require.resolve("console-browserify"),
      // constants: require.resolve("constants-browserify"),
      crypto: require.resolve("crypto-browserify"),
      // crypto: false,
      // domain: require.resolve("domain-browser"),
      // events: require.resolve("events"),
      fs: false,
      http: false,
      // http: require.resolve("stream-http"),
      https: false,
      // https: require.resolve("https-browserify"),
      net: false,
      // os: require.resolve("os-browserify/browser"),
      path: require.resolve("path-browserify"),
      // punycode: require.resolve("punycode"),
      process: require.resolve("process/browser"),
      // querystring: require.resolve("querystring-es3"),
      stream: require.resolve("stream-browserify"),
      // string_decoder: require.resolve("string_decoder"),
      // sys: require.resolve("util"),
      // timers: require.resolve("timers-browserify"),
      tls: false,
      // tty: require.resolve("tty-browserify"),
      url: require.resolve("url/"),
      // util: require.resolve("util"),
      // vm: require.resolve("vm-browserify"),
      vm: false,
      // zlib: require.resolve("browserify-zlib"),
    },
  },
  externals: {
    obsidian: "commonjs2 obsidian",
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({ extractComments: false })],
  },
};
