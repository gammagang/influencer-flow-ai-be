const path = require('path')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
const nodeExternals = require('webpack-node-externals')

module.exports = {
  // bundling mode
  mode: 'production',
  // entry files
  entry: './src/index.ts',

  // output bundles (location)
  output: {
    libraryTarget: 'commonjs',
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js'
  },
  target: 'node',
  externals: [nodeExternals()],

  // file resolutions
  resolve: {
    extensions: ['.ts', '.js'],
    plugins: [
      new TsconfigPathsPlugin({
        configFile: './tsconfig.paths.json'
      })
    ]
  },

  // loaders
  module: {
    rules: [
      {
        test: /\.tsx?/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  }
}
