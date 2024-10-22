const path = require('path');
const WebpackCopyPlugin = require('copy-webpack-plugin');

module.exports = {
	entry: './src/index.js',
	output: {
		filename: 'index.js',
		path: path.resolve(__dirname, 'dist'),
		clean: true,
	},
	devtool: false,
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
				},
			},
		],
	},
	plugins: [
		new WebpackCopyPlugin({
			patterns: [{ from: 'src/manifest.json', to: '' }],
		}),
		new WebpackCopyPlugin({
			patterns: [{ from: 'src/devtools.html', to: '' }],
		}),
		new WebpackCopyPlugin({
			patterns: [{ from: 'src/panel.html', to: '' }],
		}),
		new WebpackCopyPlugin({
			patterns: [{ from: 'src/devtools.js', to: '' }],
		}),
	],
	mode: 'development',
};
